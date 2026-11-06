// Sunny Acres online play, the Selebox app's side (React Native + react-native-webview + supabase-js).
//
// The game makes no network calls itself. It asks the app through window.gameHost.net; this file puts that
// object into the game's WebView and answers it with the app's own signed-in Supabase client. The game can only
// call the farm_*_v1 database functions and use farm:<id> and park:1-3 live channels: nothing else in the app's data.
//
//   const bridge = useMemo(() => createSunnyAcresBridge({ supabase, webViewRef }), []);
//   useEffect(() => () => bridge.dispose(), [bridge]);
//   <WebView ref={webViewRef} source={...}
//     injectedJavaScriptBeforeContentLoaded={bridge.injectedJavaScriptBeforeContentLoaded + yourOwnGameHostScript}
//     onMessage={(e) => { if (bridge.onMessage(e)) return; /* your own messages (save, ...) */ }} />
//
// See bridge/README.md.

const RPC_NAME = /^farm_[a-z_]{1,40}_v1$/;
// farm:<owner id> (a farm's room) or park:1 to park:3 (Central Park, owner 6 Nov 2026: one open place for every player)
const TOPIC = /^(farm:[0-9a-f-]{36}|park:[1-3])$/;
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

// ---------- signed live messages (owner, 4 Nov 2026: "yes, fix it"; supabase/farm_online_18.sql) ----------
// A live channel takes anything a phone sends, and says nothing of who sent it, so a changed game could speak (or
// show itself) as another player. Every two players on a farm's channel now share a key from the server
// (farm_line_keys_v1: you only ever get your own keys), and each message and presence carries, for every player in the
// room, a signature made with that pair's key. A message counts only if it is signed for you by the player it names.
const SKEW_MS = 10 * 60 * 1000; // a message stamped further from this phone's clock than this is old (or replayed)
const KEYS_WAIT_MS = 5000; // a request for keys with no answer by then counts as failed (asked again 5 s later)
const PRESENCE = '~presence'; // (what a presence is signed as: never a broadcast's name)
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
// SHA-256 of bytes (plain JS: the app's Hermes has no WebCrypto).
function sha256(bytes) {
  const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(total);
  m.set(bytes);
  m[n] = 0x80;
  const bits = n * 8;
  for (let i = 0; i < 4; i++) m[total - 1 - i] = (bits / Math.pow(2, 8 * i)) & 0xff;
  m[total - 5] = Math.floor(bits / 4294967296) & 0xff;
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) out[4 * i + j] = (h[i] >>> (24 - 8 * j)) & 0xff;
  return out;
}
const utf8 = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
    else if (c >= 0xd800 && c < 0xe000) c = 0xfffd; // (a lone half of a pair, as TextEncoder writes it)
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
};
const hexBytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const toHex = (bytes) => Array.from(bytes, (b) => (b < 16 ? '0' : '') + b.toString(16)).join('');
// HMAC-SHA256 (key: 64 hex), cut to 32 hex: plenty against a guess, short on the wire.
function hmac(keyHex, text) {
  const key = new Uint8Array(64), ipad = new Uint8Array(64), opad = new Uint8Array(64);
  key.set(hexBytes(keyHex));
  for (let i = 0; i < 64; i++) { ipad[i] = key[i] ^ 0x36; opad[i] = key[i] ^ 0x5c; }
  const msg = utf8(text), inner = new Uint8Array(64 + msg.length);
  inner.set(ipad); inner.set(msg, 64);
  const outer = new Uint8Array(96);
  outer.set(opad); outer.set(sha256(inner), 64);
  return toHex(sha256(outer)).slice(0, 32);
}
// The same text for the same value on every phone, whatever order the server hands its fields back in.
const canon = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v) || 'null';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function').sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
};
const signedText = (topic, event, from, body) => topic + '\n' + event + '\n' + from + '\n' + canon(body);
const without = (o, names) => { const c = {}; Object.keys(o).forEach((k) => { if (names.indexOf(k) < 0) c[k] = o[k]; }); return c; };

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

  // ----- the room's keys: one per other player, from the server (farm_line_keys_v1) -----
  const peers = (room) => (room.channel ? Object.keys(room.channel.presenceState() || {}).filter((k) => k !== room.uid) : []);
  // Gets the keys this room still lacks for these players. A player the server gives no key (blocked, or the call
  // failed) is asked again later. A server without part 18 leaves the room unsigned, as before.
  async function keysFor(room, ids) {
    for (;;) {
      if (room.unsigned) return;
      const now = Date.now();
      const missing = ids.filter((id) => id !== room.uid && !room.keys.has(id) && !((room.retryAt.get(id) || 0) > now)).slice(0, 40);
      if (!missing.length) return;
      missing.forEach((id) => room.tried.add(id)); // (asked for at least once: send no longer waits for it)
      if (!room.asking) {
        // (never waits for ever: a request with no answer, as Android's fetch has no timeout, held every message and
        // presence of this phone, so its friends saw it stand frozen. Players, 6 Nov 2026: "hindi gumagalaw")
        room.asking = Promise.resolve()
          .then(() => Promise.race([
            Promise.resolve().then(() => supabase.rpc('farm_line_keys_v1', { p_topic: room.topic, p_peers: missing })),
            new Promise((_, no) => setTimeout(() => no(new Error('timeout')), KEYS_WAIT_MS)),
          ]))
          .then(({ data, error }) => {
            if (error) {
              if (/could not find the function|does not exist/i.test(String(error.message || ''))) room.unsigned = true;
              missing.forEach((id) => room.retryAt.set(id, Date.now() + 5000));
              return;
            }
            missing.forEach((id) => {
              const k = data && data[id];
              if (typeof k === 'string' && /^[0-9a-f]{64}$/.test(k)) { room.keys.set(id, k); room.retryAt.delete(id); }
              else room.retryAt.set(id, Date.now() + 60000); // (no key: blocked, or not allowed here)
            });
          })
          .catch(() => { missing.forEach((id) => room.retryAt.set(id, Date.now() + 5000)); })
          .then(() => { room.asking = null; });
      }
      await room.asking;
    }
  }
  // Signatures of a message for everyone in the room this phone has a key for.
  const signFor = (room, event, body, ids) => {
    const text = signedText(room.topic, event, room.uid, body), sigs = {};
    ids.forEach((id) => { const k = room.keys.get(id); if (k) sigs[id] = hmac(k, text); });
    return sigs;
  };
  // Is this message (or presence) really from `from`, signed for me with our key?
  const signedBy = (room, event, from, value) => {
    const k = room.keys.get(from), sig = value && value._s && value._s[room.uid];
    return !!k && typeof sig === 'string' && sig === hmac(k, signedText(room.topic, event, from, without(value, ['_s', 'presence_ref'])));
  };
  // Presence, signed for everyone in the room now. Signed again (below) when someone new comes.
  async function trackSigned(room, state) {
    const body = without(state && typeof state === 'object' && !Array.isArray(state) ? state : {}, ['_s']);
    body._t = Date.now();
    const owner = room.owner;
    if (!room.unsigned) {
      const ids = peers(room);
      await keysFor(room, ids);
      // left the room while the keys came (walked out of Central Park: owner, 7 Nov 2026, "in my phone they are stuck at
      // the exit"): never shown in it again, or the room, kept open a while after you leave, would show you standing there
      if (owner == null || room.owner !== owner) return null;
      body._s = signFor(room, PRESENCE, body, ids);
      room.signedFor = new Set(Object.keys(body._s));
    }
    if (owner == null || room.owner !== owner) return null;
    room.lastTrack = Date.now();
    if (room.channel && room.subscribed) return room.channel.track(body);
    return null;
  }
  // Someone came that my presence is not signed for: sign it again for them, a moment later (arrivals close together
  // count once). At most RESIGN_MAX of these in RESIGN_WINDOW ms: a phone that updates its presence too often has its
  // line closed (31 Oct), so a crowd arriving waits its turn.
  const RESIGN_MAX = 5, RESIGN_WINDOW = 20000;
  const resignSoon = (room) => {
    if (room.unsigned || room.owner == null || !room.subscribed || room.resign) return;
    const now = Date.now(), need = peers(room).filter((id) => !room.signedFor.has(id) && !((room.retryAt.get(id) || 0) > now));
    if (!need.length) return;
    room.resigned = room.resigned.filter((t) => now - t < RESIGN_WINDOW);
    const wait = room.resigned.length < RESIGN_MAX ? 30 : room.resigned[0] + RESIGN_WINDOW - now;
    room.resign = setTimeout(() => {
      room.resign = null;
      const entry = room.owner != null && channels.get(room.owner);
      if (!entry || !room.subscribed || disposed) return;
      room.resigned.push(Date.now());
      Promise.resolve(trackSigned(room, entry.state)).catch(() => {}).then(() => resignSoon(room)); // (anyone who came meanwhile)
    }, wait);
  };
  // A phone whose clock is far off (a player who moves it for their crops) still talks: its message is new on ITS clock
  // when it is stamped no earlier than its own signed presence here now, and not earlier than its last one I took
  // (an old message replayed is older than both). Players, 6 Nov 2026: "si astreo hindi gumagalaw".
  const onTheirClock = (room, from, t) => {
    if (!Number.isFinite(t) || !room.channel) return false;
    const metas = (room.channel.presenceState() || {})[from];
    const good = Array.isArray(metas) ? metas.filter((m) => m && signedBy(room, PRESENCE, from, m)) : [];
    const pt = Math.max(-Infinity, ...good.map((m) => Number(m._t)).filter(Number.isFinite));
    if (!(pt > 0) || t < pt || t - pt > 24 * 3600 * 1000) return false;
    const last = room.lastT.get(from) || 0;
    if (t < last) return false;
    room.lastT.set(from, t);
    return true;
  };
  // Takes a message only if it is signed for me by the one it names, not too old, and not seen before. One player's
  // messages stay in their order while a key is fetched.
  function accept(room, event, payload) {
    const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    if (!p || typeof p.id !== 'string' || p.id === room.uid) return Promise.resolve(room.unsigned && p ? without(p, ['_s', '_t', '_n']) : null);
    const from = p.id;
    const run = () => {
      if (room.unsigned) return without(p, ['_s', '_t', '_n']);
      const t = Number(p._t);
      if (!signedBy(room, event, from, p) || !(Math.abs(Date.now() - t) <= SKEW_MS || onTheirClock(room, from, t))) return null;
      const id = from + ':' + event + ':' + t + ':' + p._n;
      if (room.seen.has(id)) return null; // (the same message again: a replay)
      room.seen.add(id);
      if (room.seen.size > 2000) room.seen = new Set([...room.seen].slice(-1000));
      return without(p, ['_s', '_t', '_n']);
    };
    const next = (room.chains.get(from) || Promise.resolve())
      .then(() => (room.keys.has(from) ? null : keysFor(room, [from])))
      .then(run, () => null);
    room.chains.set(from, next);
    next.then(() => { if (room.chains.get(from) === next) room.chains.delete(from); });
    return next;
  }

  // The others in a room: only presence signed for me by the player it is keyed by (a key is the phone's own word,
  // so on its own it proves nothing). A key can briefly hold two entries (an old one on its way out): the newest wins.
  const others = (room) => {
    const all = room.channel.presenceState(), out = [], lacking = [];
    out.unchecked = 0; // (here, but not signed for me yet: their new signature is on its way)
    Object.keys(all).forEach((key) => {
      const metas = all[key];
      if (key === room.uid || !Array.isArray(metas) || !metas[0]) return;
      const good = room.unsigned ? metas.filter(Boolean) : metas.filter((m) => m && signedBy(room, PRESENCE, key, m));
      if (!good.length) {
        if (!room.keys.has(key)) lacking.push(key);
        if (room.keys.has(key) || !((room.retryAt.get(key) || 0) > Date.now())) out.unchecked++; // (a blocked player never will be)
        return;
      }
      let best = good[0];
      good.forEach((m) => { if ((Number(m.t) || 0) > (Number(best.t) || 0)) best = m; });
      out.push({ ...without(best, ['presence_ref', '_s', '_t']), id: key });
    });
    // shown once their key is here (asked again a little later if the server gave none yet)
    if (lacking.length && !room.keyWait) {
      room.keyWait = true;
      keysFor(room, lacking).then(() => {
        room.keyWait = false;
        if (lacking.some((id) => room.keys.has(id)) || room.unsigned) push(room);
        else if (!disposed && rooms.get(room.topic) === room && lacking.some((id) => (room.retryAt.get(id) || 0) - Date.now() <= 6000)) setTimeout(() => push(room), 6000); // (only after a failed call)
      });
    }
    return out;
  };
  // The game takes its first list of who is here as the whole room (it decides there whether a farm is full), so the first
  // one waits, at most FIRST_WAIT ms, until everyone in it is checked.
  const FIRST_WAIT = 2500;
  const push = (room) => {
    if (room.owner == null || !room.subscribed || !room.channel) return;
    const list = others(room);
    if (!room.told && list.unchecked && Date.now() - room.since < FIRST_WAIT) {
      if (!room.firstTimer) room.firstTimer = setTimeout(() => { room.firstTimer = null; push(room); }, Math.min(300, room.since + FIRST_WAIT - Date.now()));
      return;
    }
    room.told = true;
    emit(room.owner, 'presence', list);
  };
  const fresh = (room) => { room.told = false; room.since = Date.now(); clearTimeout(room.firstTimer); room.firstTimer = null; };

  function connect(room) {
    const channel = supabase.channel(room.topic, { config: { private: true, broadcast: { self: false }, presence: { key: room.uid } } });
    room.channel = channel;
    room.subscribed = false;
    channel.on('presence', { event: 'sync' }, () => { if (room.channel === channel) { push(room); resignSoon(room); } });
    channel.on('broadcast', { event: '*' }, (m) => {
      if (room.channel !== channel || room.owner == null) return;
      accept(room, m.event, m.payload).then((p) => { if (p && room.channel === channel && room.owner != null) emit(room.owner, 'message', m.event, p); });
    });
    channel.subscribe((status) => {
      if (rooms.get(room.topic) !== room || room.channel !== channel || disposed) return;
      if (status === 'SUBSCRIBED') {
        room.subscribed = true;
        fresh(room);
        room.tries = 0;
        const entry = room.owner != null && channels.get(room.owner);
        if (entry) Promise.resolve(trackSigned(room, entry.state)).catch(() => {}); // (who is here comes with the server's first presence sync)
        return;
      }
      if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') return;
      // dropped by the server (a network cut, an error): joined again by itself after a few seconds, a few times
      room.subscribed = false;
      if (room.retry) return;
      if (room.tries >= 5) { room.gaveUp = true; return; } // Audit 4 Nov 2026: marked, so a join or wake() opens it again
      room.gaveUp = false;
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

  // Audit 4 Nov 2026: a room that gave up after its 5 rejoins stayed dead, and coming back to it reused the dead one.
  // Open it again from scratch (the old channel removed first: supabase-js keeps one channel per topic).
  function revive(room) {
    if (!room.gaveUp || disposed || rooms.get(room.topic) !== room) return;
    room.gaveUp = false;
    room.tries = 0;
    const old = room.channel;
    room.channel = null;
    room.ready = Promise.resolve(old && supabase.removeChannel(old))
      .catch(() => {})
      .then(() => settle(room.topic))
      .then(() => { if (rooms.get(room.topic) === room && !disposed) connect(room); });
  }

  function close(room) {
    if (rooms.get(room.topic) === room) rooms.delete(room.topic);
    clearTimeout(room.retry);
    clearTimeout(room.linger);
    clearTimeout(room.resign);
    room.resign = null;
    clearTimeout(room.firstTimer);
    room.firstTimer = null;
    if (room.channel) Promise.resolve(supabase.removeChannel(room.channel)).catch(() => {});
    room.channel = null;
  }

  // The room for a topic: the open (or lingering) one, or a new one once nothing of that topic is left in the client.
  function roomFor(topic, uid) {
    let room = rooms.get(topic);
    if (room && room.uid !== uid) { close(room); room = null; } // (another account on this phone)
    if (room) return room;
    room = { topic, uid, channel: null, owner: null, subscribed: false, linger: null, retry: null, tries: 0, gaveUp: false,
      keys: new Map(), retryAt: new Map(), lastT: new Map(), tried: new Set(), asking: null, unsigned: false, signedFor: new Set(), lastTrack: 0, resign: null, resigned: [], keyWait: false, told: false, since: 0, firstTimer: null, chains: new Map(), seen: new Set() };
    rooms.set(topic, room);
    room.ready = settle(topic).then(() => { if (rooms.get(topic) === room && !disposed) connect(room); });
    return room;
  }

  const ops = {
    session: () => userId(),

    async rpc(name, args) {
      if (!RPC_NAME.test(String(name)) && name !== 'invite_collect_game_rewards_v1') throw new Error('not allowed');
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
      fresh(room);
      revive(room); // (only a room that gave up)
      if (room.subscribed) {
        Promise.resolve(trackSigned(room, entry.state)).catch(() => {});
        push(room);
      }
      return true;
    },

    async track(ch, state) {
      const entry = channels.get(ch);
      if (!entry) return false;
      entry.state = state;
      const room = rooms.get(entry.topic);
      if (room && room.owner === ch && room.subscribed) await trackSigned(room, state);
      return true;
    },

    async send(ch, event, payload) {
      const entry = channels.get(ch), room = entry && rooms.get(entry.topic);
      if (!room || room.owner !== ch || !room.channel || !EVENT.test(String(event))) return false;
      // who it is from is this phone's signed-in player, whatever the game wrote; signed for everyone in the room
      // (_n: two messages in the same millisecond are still two, not a replay)
      const body = { ...without(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}, ['_s']), id: room.uid, _t: Date.now(), _n: (room.sent = (room.sent || 0) + 1) };
      if (!room.unsigned) {
        const ids = peers(room);
        // A newcomer's key is waited for once (at most KEYS_WAIT_MS: keysFor gives up then). After that a missing key is
        // asked for again behind the scenes, never waited on: one request with no answer must not hold every message.
        const fresh = ids.some((id) => id !== room.uid && !room.keys.has(id) && !room.tried.has(id));
        if (fresh) await keysFor(room, ids);
        else keysFor(room, ids).catch(() => {});
        body._s = signFor(room, String(event), body, ids);
      }
      if (!room.channel || room.owner !== ch) return false;
      await room.channel.send({ type: 'broadcast', event, payload: body });
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

  // Audit 4 Nov 2026: call when the app comes back to the foreground — rooms that gave up open again, and rooms still
  // retrying get their full count of rejoins back.
  const wake = () => {
    if (disposed) return;
    [...rooms.values()].forEach((room) => {
      if (room.subscribed) return;
      if (room.gaveUp) revive(room);
      else room.tries = 0;
    });
  };

  return { injectedJavaScriptBeforeContentLoaded: GAME_NET_SCRIPT, onMessage, dispose, wake };
}

module.exports = { createSunnyAcresBridge, GAME_NET_SCRIPT, signing: { sha256, hmac, canon } };
