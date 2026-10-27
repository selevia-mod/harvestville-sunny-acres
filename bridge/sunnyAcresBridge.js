// Sunny Acres online play, the Selebox app's side (React Native + react-native-webview + supabase-js).
//
// The game makes no network calls itself. It asks the app through window.gameHost.net; this file puts that
// object into the game's WebView and answers it with the app's own signed-in Supabase client. The game can only
// call the farm_*_v1 database functions and use farm:<id> live channels: nothing else in the app's data.
//
//   const bridge = useMemo(() => createSunnyAcresBridge({ supabase, webViewRef }), []);
//   useEffect(() => () => bridge.dispose(), [bridge]);
//   <WebView ref={webViewRef} source={...}
//     injectedJavaScriptBeforeContentLoaded={bridge.injectedJavaScriptBeforeContentLoaded + yourOwnGameHostScript}
//     onMessage={(e) => { if (bridge.onMessage(e)) return; /* your own messages (save, ...) */ }} />
//
// See bridge/README.md.

const RPC_NAME = /^farm_[a-z_]{1,40}_v1$/;
const TOPIC = /^farm:[0-9a-f-]{36}$/;
const EVENT = /^[a-z]{1,16}$/;
const MAX_JSON = 256 * 1024; // the biggest call is publishing a farm (tens of KB)
const TIMEOUT_MS = 15000; // a call with no answer by then fails, so the game never waits forever on a bad network

// Runs inside the WebView before the game loads (ES5: works in old Android WebViews too).
const GAME_NET_SCRIPT = `(function () {
  if (window.__sunnyNet || !window.ReactNativeWebView) return;
  var seq = 0, pending = {}, handlers = {};
  var post = function (msg) { msg.__sunnyNet = 1; window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var call = function (op, args) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      post({ op: op, id: id, args: args });
    });
  };
  window.__sunnyNet = {
    reply: function (id, ok, value) {
      var p = pending[id];
      if (!p) return;
      delete pending[id];
      if (ok) p.resolve(value); else p.reject(new Error(value || 'failed'));
    },
    event: function (ch, kind, a, b) {
      var h = handlers[ch];
      if (!h) return;
      if (kind === 'presence') h.presence(a); else h.message(a, b);
    },
  };
  window.gameHost = window.gameHost || {};
  window.gameHost.net = {
    session: function () { return call('session', []); },
    rpc: function (name, args) { return call('rpc', [name, args || {}]); },
    join: function (topic, me, on) {
      var ch = ++seq;
      handlers[ch] = on;
      call('join', [ch, topic, me]).catch(function () {});
      return {
        track: function (state) { return call('track', [ch, state]); },
        send: function (event, payload) { return call('send', [ch, event, payload]); },
        leave: function () { delete handlers[ch]; return call('leave', [ch]); },
      };
    },
  };
})();
true;`;

// Text safe to put inside injected JavaScript.
const js = (v) => JSON.stringify(v === undefined ? null : v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function createSunnyAcresBridge({ supabase, webViewRef }) {
  const channels = new Map(); // ch (the game's number) -> { topic, state }
  const rooms = new Map(); // topic -> one live channel per farm room: { channel, uid, owner (ch) | null, subscribed, ready }
  let disposed = false;
  const LINGER_MS = 20000; // a room you left stays open this long (you are hidden from it): coming back reuses it

  const inject = (code) => {
    const view = webViewRef && webViewRef.current;
    if (view && !disposed) view.injectJavaScript(code + ';true;');
  };
  const reply = (id, ok, value) => inject(`window.__sunnyNet && window.__sunnyNet.reply(${js(id)}, ${ok ? 'true' : 'false'}, ${js(value)})`);
  const emit = (ch, kind, a, b) => inject(`window.__sunnyNet && window.__sunnyNet.event(${js(ch)}, ${js(kind)}, ${js(a)}, ${js(b)})`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const userId = async () => {
    const { data } = await supabase.auth.getSession();
    return (data && data.session && data.session.user && data.session.user.id) || null;
  };

  // supabase-js keeps one channel per topic: channel(topic) hands back one still closing (which never joins again),
  // and a channel that closes takes every channel of its topic out of the client's list (so a late close knocks out
  // its replacement). Hence one channel per room, kept a while after you leave and reused when you come back; and a
  // room is opened again only once the client has no channel of that topic left.
  const listed = (topic) => (supabase.getChannels ? supabase.getChannels() : []).filter((c) => c.topic === 'realtime:' + topic || c.topic === topic);
  const settle = async (topic) => {
    for (let i = 0; i < 100 && listed(topic).length; i++) await sleep(100);
  };

  // The others in a room. A key can briefly hold two entries (an old one on its way out): the newest wins.
  const others = (room) => {
    const all = room.channel.presenceState(), out = [];
    Object.keys(all).forEach((key) => {
      const metas = all[key];
      if (key === room.uid || !Array.isArray(metas) || !metas[0]) return;
      let best = metas[0];
      metas.forEach((m) => { if ((Number(m && m.t) || 0) > (Number(best.t) || 0)) best = m; });
      const { presence_ref, ...state } = best; // eslint-disable-line no-unused-vars
      out.push({ ...state, id: key }); // who they are is the server-checked key, never what they say
    });
    return out;
  };
  const push = (room) => { if (room.owner != null && room.subscribed) emit(room.owner, 'presence', others(room)); };

  function connect(room) {
    const channel = supabase.channel(room.topic, { config: { private: true, broadcast: { self: false }, presence: { key: room.uid } } });
    room.channel = channel;
    room.subscribed = false;
    channel.on('presence', { event: 'sync' }, () => { if (room.channel === channel) push(room); });
    channel.on('broadcast', { event: '*' }, (m) => { if (room.channel === channel && room.owner != null) emit(room.owner, 'message', m.event, m.payload); });
    channel.subscribe((status) => {
      if (rooms.get(room.topic) !== room || room.channel !== channel || disposed) return;
      if (status === 'SUBSCRIBED') {
        room.subscribed = true;
        room.tries = 0;
        const entry = room.owner != null && channels.get(room.owner);
        if (entry) channel.track(entry.state); // (who is here comes with the server's first presence sync)
        return;
      }
      if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') return;
      // dropped by the server (a network cut, an error): joined again by itself after a few seconds, a few times
      room.subscribed = false;
      if (room.retry || room.tries >= 5) return;
      room.retry = setTimeout(async () => {
        room.retry = null;
        if (rooms.get(room.topic) !== room || disposed) return;
        room.tries++;
        if (room.owner != null) emit(room.owner, 'presence', []); // until it is back, nobody is seen there
        room.channel = null;
        await Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
        await settle(room.topic);
        if (rooms.get(room.topic) === room && !disposed) connect(room);
      }, Math.min(30000, 2000 * Math.pow(2, room.tries)));
    });
  }

  function close(room) {
    if (rooms.get(room.topic) === room) rooms.delete(room.topic);
    clearTimeout(room.retry);
    clearTimeout(room.linger);
    if (room.channel) Promise.resolve(supabase.removeChannel(room.channel)).catch(() => {});
    room.channel = null;
  }

  // The room for a topic: the open (or lingering) one, or a new one once nothing of that topic is left in the client.
  function roomFor(topic, uid) {
    let room = rooms.get(topic);
    if (room && room.uid !== uid) { close(room); room = null; } // (another account on this phone)
    if (room) return room;
    room = { topic, uid, channel: null, owner: null, subscribed: false, linger: null, retry: null, tries: 0 };
    rooms.set(topic, room);
    room.ready = settle(topic).then(() => { if (rooms.get(topic) === room && !disposed) connect(room); });
    return room;
  }

  const ops = {
    session: () => userId(),

    async rpc(name, args) {
      if (!RPC_NAME.test(String(name))) throw new Error('not allowed');
      const { data, error } = await supabase.rpc(name, args && typeof args === 'object' ? args : {});
      if (error) throw new Error(error.message || 'failed');
      return data;
    },

    async join(ch, topic, me) {
      if (!TOPIC.test(String(topic)) || channels.has(ch)) throw new Error('not allowed');
      // kept from the start, so a leave (or the screen closing) while signing in cancels the join
      const entry = { topic, state: me };
      channels.set(ch, entry);
      const uid = await userId();
      if (channels.get(ch) !== entry || disposed) return false;
      if (!uid) { channels.delete(ch); throw new Error('not signed in'); }
      const room = roomFor(topic, uid);
      clearTimeout(room.linger);
      room.linger = null;
      room.owner = ch;
      if (room.subscribed) {
        room.channel.track(entry.state);
        push(room);
      }
      return true;
    },

    async track(ch, state) {
      const entry = channels.get(ch);
      if (!entry) return false;
      entry.state = state;
      const room = rooms.get(entry.topic);
      if (room && room.owner === ch && room.subscribed) await room.channel.track(state);
      return true;
    },

    async send(ch, event, payload) {
      const entry = channels.get(ch), room = entry && rooms.get(entry.topic);
      if (!room || room.owner !== ch || !room.channel || !EVENT.test(String(event))) return false;
      await room.channel.send({ type: 'broadcast', event, payload });
      return true;
    },

    async leave(ch) {
      const entry = channels.get(ch);
      if (!entry) return false;
      channels.delete(ch);
      const room = rooms.get(entry.topic);
      if (!room || room.owner !== ch) return true;
      room.owner = null;
      if (room.channel && room.subscribed) await Promise.resolve(room.channel.untrack()).catch(() => {}); // the others see you go now
      clearTimeout(room.linger);
      room.linger = setTimeout(() => { if (room.owner == null) close(room); }, LINGER_MS);
      return true;
    },
  };

  // Returns true when the message was the game's (handled here), false for any other message.
  const onMessage = (event) => {
    const raw = event && event.nativeEvent ? event.nativeEvent.data : event;
    if (typeof raw !== 'string' || raw.indexOf('__sunnyNet') < 0) return false;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return false; }
    if (!msg || msg.__sunnyNet !== 1 || !ops[msg.op] || !Array.isArray(msg.args)) return false;
    if (raw.length > MAX_JSON) { reply(msg.id, false, 'too big'); return true; }
    let timer;
    const timeout = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS); });
    Promise.race([Promise.resolve().then(() => ops[msg.op](...msg.args)), timeout])
      .finally(() => clearTimeout(timer))
      .then((value) => reply(msg.id, true, value), (e) => reply(msg.id, false, (e && e.message) || 'failed'));
    return true;
  };

  // Call when the game screen closes: leaves every live channel.
  const dispose = () => {
    disposed = true;
    [...rooms.values()].forEach(close);
    channels.clear();
  };

  return { injectedJavaScriptBeforeContentLoaded: GAME_NET_SCRIPT, onMessage, dispose };
}

module.exports = { createSunnyAcresBridge, GAME_NET_SCRIPT };
