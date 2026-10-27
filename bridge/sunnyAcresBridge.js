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
  const channels = new Map(); // ch (the game's number) -> { channel, state, subscribed }
  const closing = new Map(); // topic -> a channel of that topic still on its way out (a promise)
  let disposed = false;

  // supabase-js keeps one channel per topic: channel(topic) hands back one still leaving (which never joins again),
  // and a channel that closes takes every channel of its topic with it. So a farm is joined again (a sleep and a wake,
  // a visit and back) only once the last channel of that topic is fully gone.
  const listed = (topic) => (supabase.getChannels ? supabase.getChannels() : []).filter((c) => c.topic === 'realtime:' + topic || c.topic === topic);
  const drop = (topic, channel) => {
    const p = Promise.resolve(supabase.removeChannel(channel)).catch(() => {}).then(async () => {
      for (let i = 0; i < 30 && listed(topic).length; i++) await new Promise((r) => setTimeout(r, 100));
    }).finally(() => { if (closing.get(topic) === p) closing.delete(topic); });
    closing.set(topic, p);
    return p;
  };
  const settle = async (topic) => {
    if (closing.has(topic)) await closing.get(topic);
    for (const stale of listed(topic)) await drop(topic, stale); // (a leave that never got its answer)
  };

  const inject = (code) => {
    const view = webViewRef && webViewRef.current;
    if (view && !disposed) view.injectJavaScript(code + ';true;');
  };
  const reply = (id, ok, value) => inject(`window.__sunnyNet && window.__sunnyNet.reply(${js(id)}, ${ok ? 'true' : 'false'}, ${js(value)})`);
  const emit = (ch, kind, a, b) => inject(`window.__sunnyNet && window.__sunnyNet.event(${js(ch)}, ${js(kind)}, ${js(a)}, ${js(b)})`);

  const userId = async () => {
    const { data } = await supabase.auth.getSession();
    return (data && data.session && data.session.user && data.session.user.id) || null;
  };

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
      const entry = { channel: null, state: me, subscribed: false };
      channels.set(ch, entry);
      const uid = await userId();
      if (channels.get(ch) !== entry || disposed) return false;
      if (!uid) { channels.delete(ch); throw new Error('not signed in'); }
      entry.topic = topic;
      entry.tries = 0;
      await open(ch, entry, uid);
      return true;
    },

    async track(ch, state) {
      const entry = channels.get(ch);
      if (!entry) return false;
      entry.state = state;
      if (entry.subscribed) await entry.channel.track(state);
      return true;
    },

    async send(ch, event, payload) {
      const entry = channels.get(ch);
      if (!entry || !entry.channel || !EVENT.test(String(event))) return false;
      await entry.channel.send({ type: 'broadcast', event, payload });
      return true;
    },

    async leave(ch) {
      const entry = channels.get(ch);
      if (!entry) return false;
      channels.delete(ch);
      clearTimeout(entry.retry);
      if (entry.channel) await drop(entry.topic, entry.channel);
      return true;
    },
  };

  // Joins (or joins again) the entry's farm channel. A channel the server drops (a network cut, an error) is joined
  // again by itself after a few seconds, a few times; a deliberate leave never is.
  async function open(ch, entry, uid) {
    const topic = entry.topic;
    await settle(topic);
    if (channels.get(ch) !== entry || disposed) return;
    const channel = supabase.channel(topic, { config: { private: true, broadcast: { self: false }, presence: { key: uid } } });
    entry.channel = channel;
    entry.subscribed = false;
    channel.on('presence', { event: 'sync' }, () => {
      if (entry.channel !== channel) return;
      const all = channel.presenceState(), others = [];
      Object.keys(all).forEach((key) => {
        if (key === uid || !all[key] || !all[key][0]) return;
        const { presence_ref, ...state } = all[key][0]; // eslint-disable-line no-unused-vars
        others.push({ ...state, id: key }); // who they are is the server-checked key, never what they say
      });
      emit(ch, 'presence', others);
    });
    channel.on('broadcast', { event: '*' }, (m) => { if (entry.channel === channel) emit(ch, 'message', m.event, m.payload); });
    channel.subscribe((status) => {
      if (channels.get(ch) !== entry || entry.channel !== channel || disposed) return;
      if (status === 'SUBSCRIBED') {
        entry.subscribed = true;
        entry.tries = 0;
        channel.track(entry.state);
        return;
      }
      if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') return;
      entry.subscribed = false;
      if (entry.tries >= 5 || entry.retry) return;
      entry.retry = setTimeout(async () => {
        entry.retry = null;
        if (channels.get(ch) !== entry || disposed) return;
        entry.tries++;
        emit(ch, 'presence', []); // until it is back, nobody is seen there
        entry.channel = null; // (its CLOSED on the way out is not another drop)
        await drop(topic, channel);
        open(ch, entry, uid).catch(() => {});
      }, Math.min(30000, 2000 * Math.pow(2, entry.tries)));
    });
  }

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
    channels.forEach((entry) => { clearTimeout(entry.retry); if (entry.channel) supabase.removeChannel(entry.channel); });
    channels.clear();
  };

  return { injectedJavaScriptBeforeContentLoaded: GAME_NET_SCRIPT, onMessage, dispose };
}

module.exports = { createSunnyAcresBridge, GAME_NET_SCRIPT };
