// Central Park (owner, 6 Nov 2026): one open place for every player, in three parks of 30 (park:1 to park:3). These
// play the test server's park rules (test/net-mock.js, the same as supabase/farm_online_19.sql) and the app bridge's
// park channels.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const plain = (v) => JSON.parse(JSON.stringify(v));

// n players who joined online play, and a call as one of them (through the fake supabase client, as the bridge calls)
function world(n) {
  const server = createServer();
  const ids = Array.from({ length: n }, () => server.newUser());
  ids.forEach((id) => server.db.players.set(id, { id, farm_name: 'Farm', friend_code: id.slice(0, 8), listed: true, seen: Date.now() }));
  const call = async (uid, name, args) => {
    const { data, error } = await server.supabaseFor(uid).rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
  const friends = (a, b) => { const [x, y] = a < b ? [a, b] : [b, a]; server.db.friends.push({ a: x, b: y, by: a, accepted: true }); };
  const age = (uid, s) => { server.db.parkSeats.get(uid).seen = Date.now() - s * 1000; };
  return { server, ids, call, friends, age };
}

test('pick for me fills Park 1 first, then Park 2; a full park says so with the counts', async () => {
  const { ids, call } = world(32);
  assert.deepStrictEqual(await call(ids[0], 'farm_park_counts_v1', {}), { counts: [0, 0, 0] });
  for (let i = 0; i < 30; i++) {
    const r = await call(ids[i], 'farm_park_join_v1', { p_park: null });
    assert.strictEqual(r.park, 1, 'player ' + i + ' goes to Park 1');
  }
  assert.deepStrictEqual(await call(ids[30], 'farm_park_join_v1', { p_park: 1 }), { ok: false, code: 'full', counts: [30, 0, 0] });
  assert.deepStrictEqual(await call(ids[30], 'farm_park_join_v1', {}), { ok: true, park: 2, counts: [30, 1, 0] }, 'no park named = pick for me');
  assert.deepStrictEqual((await call(ids[31], 'farm_park_join_v1', { p_park: 3 })).counts, [30, 1, 1], 'a park can be picked by hand');
  assert.deepStrictEqual((await call(ids[5], 'farm_park_join_v1', { p_park: 1 })).park, 1, 'a full park still has my own seat');
});

test('pick for me goes where a friend is, if there is room; a friend\'s full park falls back to the lowest with room', async () => {
  const { server, ids, call, friends } = world(34);
  await call(ids[0], 'farm_park_join_v1', { p_park: 3 });
  friends(ids[1], ids[0]);
  assert.strictEqual((await call(ids[1], 'farm_park_join_v1', {})).park, 3, 'to my friend in Park 3 (not empty Park 1)');
  await call(ids[2], 'farm_park_join_v1', { p_park: 2 });
  friends(ids[3], ids[2]); friends(ids[3], ids[0]); friends(ids[3], ids[1]);
  assert.strictEqual((await call(ids[3], 'farm_park_join_v1', {})).park, 3, 'to the park with the most friends');
  for (let i = 4; i < 32; i++) await call(ids[i], 'farm_park_join_v1', { p_park: 3 }); // (the last one finds it full)
  assert.deepStrictEqual((await call(ids[0], 'farm_park_counts_v1', {})).counts, [0, 1, 30]);
  friends(ids[32], ids[0]);
  assert.strictEqual((await call(ids[32], 'farm_park_join_v1', {})).park, 1, 'my friend\'s park is full: the lowest park with room');
  server.db.blocks.push({ by: ids[33], who: ids[2] });
  friends(ids[33], ids[2]);
  assert.strictEqual((await call(ids[33], 'farm_park_join_v1', {})).park, 1, 'a blocked "friend" draws nobody');
});

test('a seat lasts 75 s without a beat: stale seats never block anyone, and a stale seat in a full park is gone', async () => {
  const { ids, call, age } = world(31);
  for (let i = 0; i < 30; i++) await call(ids[i], 'farm_park_join_v1', { p_park: 1 });
  age(ids[0], 60);
  assert.deepStrictEqual((await call(ids[0], 'farm_park_beat_v1', {})), { ok: true, park: 1, counts: [30, 0, 0] }, 'a beat within 75 s keeps the seat');
  age(ids[0], 76);
  assert.deepStrictEqual((await call(ids[1], 'farm_park_counts_v1', {})).counts, [29, 0, 0], 'a stale seat does not count');
  assert.strictEqual((await call(ids[30], 'farm_park_join_v1', { p_park: 1 })).park, 1, 'so someone else takes it');
  assert.deepStrictEqual(await call(ids[0], 'farm_park_beat_v1', {}), { ok: true, park: null, counts: [30, 0, 0] }, 'the late one is out, not the 31st');
  assert.strictEqual(await call(ids[30], 'farm_park_leave_v1', {}), null);
  age(ids[1], 80);
  assert.deepStrictEqual(await call(ids[1], 'farm_park_beat_v1', {}), { ok: true, park: 1, counts: [29, 0, 0] }, 'a stale seat with room comes back');
  assert.deepStrictEqual(await call(ids[30], 'farm_park_beat_v1', {}), { ok: true, park: null, counts: [29, 0, 0] }, 'no seat: park null');
});

test('pick for me keeps a fresh seat; naming a park moves me; leave frees the seat; leaving online play leaves the park', async () => {
  const { ids, call, friends } = world(3);
  await call(ids[0], 'farm_park_join_v1', { p_park: 2 });
  await call(ids[1], 'farm_park_join_v1', { p_park: 3 });
  friends(ids[0], ids[1]);
  assert.strictEqual((await call(ids[0], 'farm_park_join_v1', {})).park, 2, 'a reconnect stays in my park');
  assert.deepStrictEqual(await call(ids[0], 'farm_park_join_v1', { p_park: 3 }), { ok: true, park: 3, counts: [0, 0, 2] }, 'moved, not in two parks');
  assert.strictEqual(await call(ids[0], 'farm_park_leave_v1', {}), null);
  assert.deepStrictEqual((await call(ids[0], 'farm_park_counts_v1', {})).counts, [0, 0, 1]);
  await call(ids[1], 'farm_leave_v1', {});
  assert.deepStrictEqual((await call(ids[0], 'farm_park_counts_v1', {})).counts, [0, 0, 0], 'leaving online play leaves the park too');
});

test('the park calls: not a player, not signed in, a park that is not there, and the part not applied yet', async () => {
  const { server, ids, call } = world(1);
  assert.deepStrictEqual(await call(server.newUser(), 'farm_park_join_v1', {}), { ok: false, code: 'not-player' });
  await assert.rejects(call(null, 'farm_park_join_v1', {}), /not signed in/);
  await assert.rejects(call(null, 'farm_park_counts_v1', {}), /not signed in/);
  for (const p of [0, 4, -1]) assert.strictEqual((await call(ids[0], 'farm_park_join_v1', { p_park: p })).code, 'bad', 'park ' + p);
  server.db.noPark = true;
  await assert.rejects(call(ids[0], 'farm_park_counts_v1', {}), /schema cache/);
});

// A WebView running the app bridge against the test server (as test/bridge.test.js does).
function webview(server, uid) {
  const ctx = { console };
  ctx.window = ctx;
  const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef: { current: { injectJavaScript: (code) => vm.runInContext(code, ctx) } } });
  ctx.ReactNativeWebView = { postMessage: (data) => setTimeout(() => bridge.onMessage({ nativeEvent: { data } }), 0) };
  vm.createContext(ctx);
  vm.runInContext(bridge.injectedJavaScriptBeforeContentLoaded, ctx);
  return { ctx, net: ctx.gameHost.net, bridge };
}

test('the bridge joins the park channels: players in one park see each other and get its messages', async () => {
  const server = createServer(), a = server.newUser(), b = server.newUser(), c = server.newUser();
  const A = webview(server, a), B = webview(server, b), C = webview(server, c);
  for (const v of [A, B]) await v.net.rpc('farm_join_v1', {});
  assert.strictEqual((await A.net.rpc('farm_park_join_v1', { p_park: null })).park, 1, 'the park calls pass the bridge');
  const seen = { A: [], B: [] }, msgs = { A: [] };
  A.net.join('park:1', { id: a, name: 'Ana' }, { presence: (l) => seen.A.push(plain(l)), message: (e, p) => msgs.A.push([e, plain(p)]) });
  const cb = B.net.join('park:1', { id: b, name: 'Ben' }, { presence: (l) => seen.B.push(plain(l)), message: () => {} });
  await tick(120);
  assert.deepStrictEqual(seen.A.at(-1), [{ id: b, name: 'Ben' }]);
  assert.deepStrictEqual(seen.B.at(-1), [{ id: a, name: 'Ana' }]);
  await cb.send('emote', { id: b, e: 'wave' });
  await tick(60);
  assert.deepStrictEqual(msgs.A, [['emote', { id: b, e: 'wave' }]]);
  const errs = [];
  A.ctx.__sunnyNet.reply = ((orig) => (id, ok, v) => { if (!ok) errs.push(v); orig(id, ok, v); })(A.ctx.__sunnyNet.reply);
  ['park:4', 'park:0', 'park:1 ', 'park:12', 'park:'].forEach((t) => A.net.join(t, { id: a }, { presence() {}, message() {} }));
  await tick(40);
  assert.deepStrictEqual(errs, ['not allowed', 'not allowed', 'not allowed', 'not allowed', 'not allowed'], 'only park:1 to park:3');
  C.net.join('park:2', { id: c }, { presence() {}, message() {} }); // (signed in, but never joined online play)
  await tick(60);
  assert.ok(!server.topics.get('park:2') || !server.topics.get('park:2').size, 'not a player: the server refuses the channel');
  [A, B, C].forEach((v) => v.bridge.dispose());
  await tick(60);
});
