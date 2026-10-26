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
  assert.strictEqual(await webview(server, null).net.session(), null, 'nobody signed in');
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
