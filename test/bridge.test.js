// The Selebox app's side of online play (bridge/sunnyAcresBridge.js): the script it puts into the game's
// WebView, and its answers from the app's supabase client (a stand-in here, test/net-mock.js).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { createSunnyAcresBridge, GAME_NET_SCRIPT } = require('../bridge/sunnyAcresBridge');
const { createServer } = require('./net-mock');

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const plain = (v) => JSON.parse(JSON.stringify(v));

// A WebView: its own window running the injected script, and the app's bridge answering it.
function webview(server, uid) {
  const supabase = server.supabaseFor(uid);
  const ctx = { console };
  ctx.window = ctx;
  const ref = { current: { injectJavaScript: (code) => vm.runInContext(code, ctx) } };
  const bridge = createSunnyAcresBridge({ supabase, webViewRef: ref });
  const other = [];
  ctx.ReactNativeWebView = { postMessage: (data) => setTimeout(() => { if (!bridge.onMessage({ nativeEvent: { data } })) other.push(data); }, 0) };
  vm.createContext(ctx);
  vm.runInContext(bridge.injectedJavaScriptBeforeContentLoaded, ctx);
  return { ctx, net: ctx.gameHost.net, bridge, other };
}

test('the game asks who is signed in and calls the farm functions through the app', async () => {
  const server = createServer(), uid = server.newUser();
  const v = webview(server, uid);
  assert.strictEqual(await v.net.session(), uid);
  const me = plain(await v.net.rpc('farm_join_v1', { p_farm_name: 'Moon Meadow' }));
  assert.strictEqual(me.farm_name, 'Moon Meadow');
  assert.strictEqual(me.id, uid);
  assert.strictEqual(await v.net.rpc('farm_set_listed_v1', { p_listed: false }), null);
  assert.strictEqual(server.db.players.get(uid).listed, false);
  await assert.rejects(v.net.rpc('farm_visit_v1', { p_host: uid }), /own farm/, 'database errors come back as errors');
  await assert.rejects(v.net.rpc('delete_everything', {}), /not allowed/, 'only farm_*_v1 functions');
  await assert.rejects(v.net.rpc('farm_join', {}), /not allowed/);
  await assert.rejects(v.net.rpc('invite_collect_anything_v1', {}), /not allowed/, 'and the one Invite Friends call, by its exact name');
  assert.strictEqual(await webview(server, null).net.session(), null, 'nobody signed in');
});

test('the game asks for the access token for the game server (docs/game-server.md): the session\'s, or null signed out', async () => {
  const server = createServer(), uid = server.newUser();
  const v = webview(server, uid);
  assert.strictEqual(await v.net.token(), 'test-token:' + uid, 'the current session\'s access token');
  assert.strictEqual(await webview(server, null).net.token(), null, 'nobody signed in: null');
  // a session without a token (or a getSession that fails to give one) is null too, never an error
  const supabase = server.supabaseFor(uid);
  supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid } } }, error: null });
  const ctx = { console };
  ctx.window = ctx;
  const bridge = createSunnyAcresBridge({ supabase, webViewRef: { current: { injectJavaScript: (code) => vm.runInContext(code, ctx) } } });
  ctx.ReactNativeWebView = { postMessage: (data) => setTimeout(() => bridge.onMessage({ nativeEvent: { data } }), 0) };
  vm.createContext(ctx);
  vm.runInContext(bridge.injectedJavaScriptBeforeContentLoaded, ctx);
  assert.strictEqual(await ctx.gameHost.net.token(), null);
  assert.strictEqual(typeof v.net.token(), 'object', 'a Promise, like session() and rpc()');
});

test('two players on one farm channel see each other, get broadcasts, and see a leave', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = { A: [], B: [] }, msgs = { A: [], B: [] };
  const on = (k) => ({ presence: (l) => seen[k].push(plain(l)), message: (e, p) => msgs[k].push([e, plain(p)]) });
  const ca = A.net.join(topic, { id: a, name: 'Owner', x: 1 }, on('A'));
  await tick();
  const cb = B.net.join(topic, { id: b, name: 'Visitor', x: 2 }, on('B'));
  await tick(60);
  assert.deepStrictEqual(seen.B.at(-1), [{ id: a, name: 'Owner', x: 1 }], 'the visitor sees the owner (and not themself)');
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor', x: 2 }], 'the owner sees the visitor');
  await cb.send('mv', { id: b, x: 5 });
  await cb.track({ id: b, name: 'Visitor', x: 5 });
  await tick(60);
  assert.deepStrictEqual(msgs.A, [['mv', { id: b, x: 5 }]], 'broadcasts reach the others, not the sender');
  assert.deepStrictEqual(msgs.B, []);
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor', x: 5 }]);
  assert.strictEqual(await cb.send('Bad Event!', {}), false, 'odd event names are dropped');
  await cb.leave();
  await tick(60);
  assert.deepStrictEqual(seen.A.at(-1), [], 'the visitor left');
  void ca;
});

test('only farm channels can be joined; other messages are left to the app; dispose leaves everything', async () => {
  const server = createServer(), a = server.newUser();
  const A = webview(server, a);
  await A.net.rpc('farm_join_v1', {});
  const errs = [];
  A.ctx.__sunnyNet.reply = ((orig) => (id, ok, v) => { if (!ok) errs.push(v); orig(id, ok, v); })(A.ctx.__sunnyNet.reply);
  A.net.join('chat:everyone', { id: a }, { presence() {}, message() {} });
  await tick(40);
  assert.deepStrictEqual(errs, ['not allowed']);
  A.ctx.ReactNativeWebView.postMessage(JSON.stringify({ type: 'save', state: {} }));
  await tick();
  assert.strictEqual(A.other.length, 1, 'the app still gets its own messages (save, ...)');
  A.net.join('farm:' + a, { id: a }, { presence() {}, message() {} });
  await tick(40);
  assert.strictEqual(server.topics.get('farm:' + a).size, 1);
  A.bridge.dispose();
  await tick(40);
  assert.strictEqual(server.topics.get('farm:' + a).size, 0);
});

test('the injected script is plain ES5 and leaves the app\'s own gameHost in place', () => {
  assert.doesNotThrow(() => new vm.Script(GAME_NET_SCRIPT));
  assert.ok(!/=>|\bconst\b|\blet\b|`/.test(GAME_NET_SCRIPT), 'no arrow functions, const/let or template strings');
  const ctx = { gameHost: { state: 'x', save() {} }, ReactNativeWebView: { postMessage() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(GAME_NET_SCRIPT, ctx);
  assert.strictEqual(ctx.gameHost.state, 'x');
  assert.strictEqual(typeof ctx.gameHost.save, 'function');
  assert.strictEqual(typeof ctx.gameHost.net.rpc, 'function');
});

test('a farmer is who the server says: a state naming someone else gets the real id', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const seen = [];
  A.net.join('farm:' + a, { id: a, name: 'Owner' }, { presence: (l) => seen.push(plain(l)), message: () => {} });
  await tick();
  B.net.join('farm:' + a, { id: a, name: 'Fake owner', host: true }, { presence: () => {}, message: () => {} });
  await tick(60);
  assert.strictEqual(seen.at(-1)[0].id, b, 'the visitor cannot pass for the owner');
});

test('leaving while still joining (a slow sign-in) never leaves a ghost on the farm', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a);
  await A.net.rpc('farm_join_v1', {});
  const seen = [];
  A.net.join('farm:' + a, { id: a }, { presence: (l) => seen.push(plain(l)), message: () => {} });
  const supabase = server.supabaseFor(b), getSession = supabase.auth.getSession;
  supabase.auth.getSession = () => tick(200).then(getSession); // the token is refreshing
  const ctx = { console };
  ctx.window = ctx;
  const bridge = createSunnyAcresBridge({ supabase, webViewRef: { current: { injectJavaScript: (code) => vm.runInContext(code, ctx) } } });
  ctx.ReactNativeWebView = { postMessage: (data) => setTimeout(() => bridge.onMessage({ nativeEvent: { data } }), 0) };
  vm.createContext(ctx);
  vm.runInContext(bridge.injectedJavaScriptBeforeContentLoaded, ctx);
  const c = ctx.gameHost.net.join('farm:' + a, { id: b }, { presence: () => {}, message: () => {} });
  await tick(20);
  c.leave();
  await tick(400);
  assert.ok(seen.every((l) => l.length === 0), 'the owner never sees the visitor who left');
  assert.strictEqual(server.topics.get('farm:' + a).size, 1, 'only the owner is on the channel');
});

test('a call with no answer fails after a while instead of waiting forever', async () => {
  const server = createServer(), uid = server.newUser();
  const supabase = server.supabaseFor(uid);
  supabase.rpc = () => new Promise(() => {}); // a hung request
  const replies = [];
  const ref = { current: { injectJavaScript: (code) => replies.push(code) } };
  const bridge = createSunnyAcresBridge({ supabase, webViewRef: ref });
  const real = global.setTimeout;
  global.setTimeout = (fn, ms) => real(fn, ms >= 15000 ? 10 : ms); // the 15 s limit, sped up
  try {
    bridge.onMessage({ nativeEvent: { data: JSON.stringify({ __sunnyNet: 1, op: 'rpc', id: 7, args: ['farm_buy_v1', {}] }) } });
    await tick(60);
  } finally { global.setTimeout = real; }
  assert.ok(replies.some((r) => /reply\(7, false, "timeout"\)/.test(r)), replies.join('\n'));
});

test('leaving a farm channel and joining it again at once (a quick sleep and wake) still works', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = { A: [], B: [] };
  const on = (k) => ({ presence: (l) => seen[k].push(plain(l)), message: () => {} });
  const first = A.net.join(topic, { id: a, name: 'Owner' }, on('A'));
  await tick(60);
  B.net.join(topic, { id: b, name: 'Visitor' }, on('B'));
  await tick(60);
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor' }]);
  // the owner's phone sleeps and wakes: leave, and join the same farm straight away
  first.leave();
  A.net.join(topic, { id: a, name: 'Owner' }, on('A'));
  await tick(300);
  assert.deepStrictEqual(seen.B.at(-1), [{ id: a, name: 'Owner' }], 'the visitor still sees the owner');
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor' }], 'and the owner still sees the visitor');
});

test('a farm channel the server drops is joined again by itself', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = [];
  A.net.join(topic, { id: a, name: 'Owner' }, { presence: () => {}, message: () => {} });
  B.net.join(topic, { id: b, name: 'Visitor' }, { presence: (l) => seen.push(plain(l)), message: () => {} });
  await tick(80);
  assert.deepStrictEqual(seen.at(-1), [{ id: a, name: 'Owner' }]);
  [...server.topics.get(topic)].find((c) => c.key === a).drop();
  await tick(60);
  assert.deepStrictEqual(seen.at(-1), [], 'gone for a moment');
  await tick(3000);
  assert.deepStrictEqual(seen.at(-1), [{ id: a, name: 'Owner' }], 'back, without the game doing anything');
});

test('home and straight back to the same farm while the server is slow to answer the leave: still live', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  server.db.leaveMs = 5000;
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = { A: [], B: [] };
  const on = (k) => ({ presence: (l) => seen[k].push(plain(l)), message: () => {} });
  const owner = A.net.join(topic, { id: a, name: 'Owner', x: 1 }, on('A'));
  await tick(60);
  const visit = B.net.join(topic, { id: b, name: 'Visitor', x: 2 }, on('B'));
  await tick(80);
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor', x: 2 }]);
  // the visitor goes home, then visits again at once
  visit.leave();
  await tick(20);
  B.net.join(topic, { id: b, name: 'Visitor', x: 3 }, on('B'));
  await tick(300);
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Visitor', x: 3 }], 'the owner sees the visitor back');
  // and the visitor hears the owner change
  const before = seen.B.length;
  await owner.track({ id: a, name: 'Owner', x: 9 }); // (signed by the owner's app, as every presence now is)
  await tick(80);
  assert.ok(seen.B.length > before, 'the visitor still gets the room');
  assert.deepStrictEqual(seen.B.at(-1), [{ id: a, name: 'Owner', x: 9 }]);
});

// ---------- signed live messages (owner, 4 Nov 2026: "yes, fix it"; supabase/farm_online_18.sql) ----------
// A changed game (or anyone with a signed-in account) on the same channel, sending straight to the server: the
// supabase-js channel itself, with none of the app's signing.
const raw = (server, topic, uid) => [...server.topics.get(topic)].find((c) => c.key === uid);

async function room3() {
  const server = createServer(), a = server.newUser(), b = server.newUser(), c = server.newUser();
  const A = webview(server, a), B = webview(server, b), C = webview(server, c);
  for (const v of [A, B, C]) await v.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = { A: [], B: [], C: [] }, msgs = { A: [], B: [], C: [] };
  const on = (k) => ({ presence: (l) => seen[k].push(plain(l)), message: (e, p) => msgs[k].push([e, plain(p)]) });
  const ca = A.net.join(topic, { id: a, name: 'Owner', x: 1 }, on('A'));
  await tick(60);
  const cb = B.net.join(topic, { id: b, name: 'Friend', x: 2 }, on('B'));
  await tick(80);
  const cc = C.net.join(topic, { id: c, name: 'Cheat', x: 3 }, on('C'));
  await tick(120);
  return { server, a, b, c, A, B, C, ca, cb, cc, topic, seen, msgs };
}

test('signed: everyone still sees everyone and hears each other', async () => {
  const r = await room3();
  const ids = (l) => (l || []).map((x) => x.id).sort();
  assert.deepStrictEqual(ids(r.seen.A.at(-1)), [r.b, r.c].sort());
  assert.deepStrictEqual(ids(r.seen.B.at(-1)), [r.a, r.c].sort());
  assert.deepStrictEqual(ids(r.seen.C.at(-1)), [r.a, r.b].sort());
  assert.deepStrictEqual(r.seen.A.at(-1).find((x) => x.id === r.b), { id: r.b, name: 'Friend', x: 2 }, 'nothing of the signing reaches the game');
  await r.cb.send('help', { id: r.b });
  await tick(60);
  assert.deepStrictEqual(r.msgs.A, [['help', { id: r.b }]]);
  assert.deepStrictEqual(r.msgs.C, [['help', { id: r.b }]]);
  const p = r.server.db.tracks.length;
  await tick(400);
  assert.strictEqual(r.server.db.tracks.length, p, 'and once all are signed for, no more presence updates');
});

test('signed: a message sent as someone else never arrives', async () => {
  const r = await room3();
  // the cheat's own game asks its app to send as the friend: the app sends it as the cheat
  await r.cc.send('help', { id: r.b });
  await tick(60);
  assert.deepStrictEqual(r.msgs.A, [['help', { id: r.c }]], 'the app always sends as its own player');
  r.msgs.A.length = 0;
  // straight to the server, as the friend: unsigned, or with a signature copied from a real message of the friend's
  const ch = raw(r.server, r.topic, r.c);
  await ch.send({ type: 'broadcast', event: 'help', payload: { id: r.b } });
  await ch.send({ type: 'broadcast', event: 'help', payload: { id: r.b, _t: Date.now(), _s: { [r.a]: '0'.repeat(32) } } });
  await r.cb.send('mv', { id: r.b, x: 5 });
  await tick(60);
  const real = r.msgs.C.find((m) => m[0] === 'mv');
  assert.ok(real, 'the cheat hears the friend');
  r.msgs.A.length = 0;
  const heard = [];
  ch.on('broadcast', { event: '*' }, (m) => heard.push(m.payload)); // (the cheat keeps the signed original)
  await r.cb.send('give', { id: r.b, to: r.a });
  await tick(60);
  const orig = heard.find((x) => x.to === r.a);
  r.msgs.A.length = 0;
  await ch.send({ type: 'broadcast', event: 'give', payload: { ...orig, to: r.c } }); // changed: the signature no longer fits
  await ch.send({ type: 'broadcast', event: 'help', payload: orig }); // under another name: no
  await ch.send({ type: 'broadcast', event: 'give', payload: orig }); // the very same again: a replay
  await tick(60);
  assert.deepStrictEqual(r.msgs.A, [], 'nothing the cheat made up, changed, renamed or sent again');
});

test('signed: a farmer shown as someone else is not shown', async () => {
  const r = await room3();
  const ch = raw(r.server, r.topic, r.c);
  // the cheat's line, keyed as the cheat, says it is the owner: the game still gets the cheat's real id (as before)
  await ch.track({ id: r.a, name: 'Owner', x: 50 });
  await tick(60);
  assert.ok(!(r.seen.B.at(-1) || []).some((x) => x.x === 50), 'an unsigned presence is not shown');
  // a second line keyed as the friend
  const fake = r.server.supabaseFor(r.c).channel(r.topic, { config: { private: true, presence: { key: r.b } } });
  fake.subscribe();
  await tick(20);
  await fake.track({ name: 'Friend', x: 99, t: Date.now() + 99999 });
  await tick(60);
  // (the stand-in server keeps one presence per key, so here the fake one even pushes the friend's out; a real one keeps both)
  assert.ok(!(r.seen.A.at(-1) || []).some((x) => x.x === 99), 'a presence keyed as the friend but not signed by the friend is not shown');
});

test('signed: players who blocked each other get no key, so they never hear or see each other', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser(), c = server.newUser();
  const A = webview(server, a), B = webview(server, b), C = webview(server, c);
  for (const v of [A, B, C]) await v.net.rpc('farm_join_v1', {});
  server.db.blocks.push({ by: b, who: c });
  const topic = 'farm:' + a, seen = { B: [], C: [] }, msgs = { B: [] };
  A.net.join(topic, { id: a, name: 'Owner' }, { presence() {}, message() {} });
  await tick(60);
  const cb = B.net.join(topic, { id: b, name: 'B' }, { presence: (l) => seen.B.push(plain(l)), message: (e, p) => msgs.B.push(e) });
  await tick(80);
  const cc = C.net.join(topic, { id: c, name: 'C' }, { presence: (l) => seen.C.push(plain(l)), message() {} });
  await tick(150);
  assert.deepStrictEqual(seen.B.at(-1).map((x) => x.id), [a]);
  assert.deepStrictEqual(seen.C.at(-1).map((x) => x.id), [a]);
  await cc.send('emote', { id: c, k: 'wave' });
  await tick(60);
  assert.deepStrictEqual(msgs.B, []);
  void cb;
});

test('signed: a server without part 18 works as before (unsigned)', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  server.db.noLineKeys = true;
  const A = webview(server, a), B = webview(server, b);
  await A.net.rpc('farm_join_v1', {});
  await B.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, seen = [], msgs = [];
  A.net.join(topic, { id: a, name: 'Owner' }, { presence: (l) => seen.push(plain(l)), message: (e, p) => msgs.push([e, plain(p)]) });
  await tick(60);
  const cb = B.net.join(topic, { id: b, name: 'Visitor' }, { presence() {}, message() {} });
  await tick(80);
  assert.deepStrictEqual(seen.at(-1), [{ id: b, name: 'Visitor' }]);
  await cb.send('like', { id: b });
  await tick(60);
  assert.deepStrictEqual(msgs, [['like', { id: b }]]);
});

test('signed: the app signs with real SHA-256 (the same as Node)', () => {
  const crypto = require('crypto'), { signing } = require('../bridge/sunnyAcresBridge');
  for (const text of ['', 'abc', 'farm:x\nmv\nid\n{"x":1}', 'ñ€😀 中'.repeat(40)]) {
    const key = crypto.randomBytes(32).toString('hex');
    assert.strictEqual(Buffer.from(signing.sha256(Buffer.from(text, 'utf8'))).toString('hex'), crypto.createHash('sha256').update(text, 'utf8').digest('hex'));
    assert.strictEqual(signing.hmac(key, text), crypto.createHmac('sha256', Buffer.from(key, 'hex')).update(text, 'utf8').digest('hex').slice(0, 32));
  }
  assert.strictEqual(signing.canon({ b: 1, a: [1, { d: undefined, c: 'x' }] }), '{"a":[1,{"c":"x"}],"b":1}', 'the same text whatever the field order');
});

test('signed: two real messages in the same millisecond both arrive', async () => {
  const r = await room3();
  const realNow = Date.now, t = realNow();
  Date.now = () => t;
  try { await Promise.all([r.cb.send('emote', { id: r.b, k: 'wave' }), r.cb.send('emote', { id: r.b, k: 'heart' })]); } finally { Date.now = realNow; }
  await tick(60);
  assert.deepStrictEqual(r.msgs.A.filter((m) => m[0] === 'emote').map((m) => m[1].k), ['wave', 'heart']);
});

test('signed: the first list of who is here waits until they are checked (the game decides there if a farm is full)', async () => {
  const r = await room3();
  const seen = [];
  const D = webview(r.server, r.server.newUser());
  await D.net.rpc('farm_join_v1', {});
  D.net.join(r.topic, { name: 'Dan' }, { presence: (l) => seen.push(plain(l).map((x) => x.id).sort()), message() {} });
  await tick(200);
  assert.ok(seen.length, 'told');
  assert.deepStrictEqual(seen[0], [r.a, r.b, r.c].sort(), 'the very first list already has everyone');
});

// Players, 6 Nov 2026 ("tapos minsan hindi gumagalaw ang ibang kasama sa game"): two ways a friend froze on everyone's
// screen while they walked on their own.
test('signed: a key request that never answers does not stop this phone talking to the others', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser(), c = server.newUser();
  const supa = server.supabaseFor(a), rpc = supa.rpc.bind(supa);
  let hang = false;
  supa.rpc = (name, args) => (hang && name === 'farm_line_keys_v1' ? new Promise(() => {}) : rpc(name, args)); // (Android's fetch has no timeout)
  server.supabaseFor = ((orig) => (uid) => (uid === a ? supa : orig(uid)))(server.supabaseFor.bind(server));
  const A = webview(server, a), B = webview(server, b), C = webview(server, c);
  for (const v of [A, B, C]) await v.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, heardB = [];
  const ca = A.net.join(topic, { id: a, x: 1 }, { presence: () => {}, message: () => {} });
  await tick(60);
  B.net.join(topic, { id: b, x: 2 }, { presence: () => {}, message: (e, p) => heardB.push([e, plain(p)]) });
  await tick(120);
  hang = true; // someone new comes, and this phone's request for their key never answers
  C.net.join(topic, { id: c, x: 3 }, { presence: () => {}, message: () => {} });
  await tick(120);
  ca.send('mv', { id: a, x: 9 });
  await tick(800);
  for (const v of [A, B, C]) v.bridge.dispose();
  assert.deepStrictEqual(heardB.filter((m) => m[0] === 'mv').map((m) => m[1].x), [9], 'the friend still hears this phone move');
});

test('signed: a phone whose clock is 11 minutes off still moves on the others\' screens, and a replay is still refused', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser();
  const A = webview(server, a), B = webview(server, b);
  for (const v of [A, B]) await v.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a, heardA = [];
  A.net.join(topic, { id: a, x: 1 }, { presence: () => {}, message: (e, p) => heardA.push([e, plain(p)]) });
  await tick(60);
  const real = Date.now;
  Date.now = () => real() + 11 * 60000; // (a player who moved the phone's clock for their crops)
  let cb;
  try {
    cb = B.net.join(topic, { id: b, x: 2 }, { presence: () => {}, message: () => {} });
    await tick(150);
    await cb.send('mv', { id: b, x: 5 });
    await cb.send('mv', { id: b, x: 6 });
  } finally { Date.now = real; }
  await tick(150);
  assert.deepStrictEqual(heardA.filter((m) => m[0] === 'mv').map((m) => m[1].x), [5, 6], 'their steps arrive');
  // the very same signed message again: a replay, refused
  const ch = raw(server, topic, b), copy = [];
  ch.on('broadcast', { event: '*' }, (m) => copy.push(m.payload));
  Date.now = () => real() + 11 * 60000;
  try { await cb.send('mv', { id: b, x: 7 }); } finally { Date.now = real; }
  await tick(100);
  const orig = copy.find((p) => p.x === 7);
  heardA.length = 0;
  await ch.send({ type: 'broadcast', event: 'mv', payload: orig });
  await tick(100);
  for (const v of [A, B]) v.bridge.dispose();
  assert.deepStrictEqual(heardA, [], 'the same message again is not taken');
});

test('signed: leaving a room while a presence update waits for a key never shows you in it again (Central Park, 7 Nov 2026: "in my phone they are stuck at the exit")', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser(), c = server.newUser();
  const supa = server.supabaseFor(a), rpc = supa.rpc.bind(supa);
  let slow = false;
  supa.rpc = (name, args) => (slow && name === 'farm_line_keys_v1' ? new Promise((r) => setTimeout(r, 300)).then(() => rpc(name, args)) : rpc(name, args));
  server.supabaseFor = ((orig) => (uid) => (uid === a ? supa : orig(uid)))(server.supabaseFor.bind(server));
  const A = webview(server, a), B = webview(server, b), C = webview(server, c);
  for (const v of [A, B, C]) await v.net.rpc('farm_join_v1', {});
  const topic = 'farm:' + a;
  let seenByB = [];
  const ca = A.net.join(topic, { id: a, x: 1 }, { presence: () => {}, message: () => {} });
  await tick(60);
  B.net.join(topic, { id: b, x: 2 }, { presence: (list) => { seenByB = plain(list).map((p) => p.id); }, message: () => {} });
  await tick(150);
  assert.ok(seenByB.includes(a), 'B sees A in the room');
  slow = true; // someone new comes: A's next presence waits for their key
  C.net.join(topic, { id: c, x: 3 }, { presence: () => {}, message: () => {} });
  await tick(40);
  ca.track({ id: a, x: 5 }); // (A stops at the gate: its place, once)
  await tick(10);
  ca.leave(); // and walks out while that waits for the key
  await tick(900);
  assert.ok(!seenByB.includes(a), 'B no longer sees A: ' + JSON.stringify(seenByB));
  for (const v of [A, B, C]) v.bridge.dispose();
});
