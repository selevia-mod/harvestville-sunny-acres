// Unit tests for Bayanihan Projects (owner, 6 Nov 2026: the whole server builds the town together): the rules
// (src/00-zzzzzzzzzzz-bayanihan.js, src/01-logicZZZZ-bayanihan.js), the test server's answers (test/mock-bayanihan.js,
// the same as supabase/farm_online_20.sql), the save, and the town map (tools/bayanihan-town.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createServer } = require('./net-mock');
const { PROJECTS } = require('./mock-bayanihan');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const BH = C.BH;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 7; s.inv = s.inv.map(() => null); return s; };
const RID = (n) => '00000000-0000-4000-a000-' + String(n).padStart(12, '0');

// players on the test server, and a call as one of them (as the app bridge calls)
function world(n) {
  const server = createServer();
  const ids = Array.from({ length: n }, () => server.newUser());
  ids.forEach((id, i) => server.db.players.set(id, { id, farm_name: 'Farm ' + (i + 1), friend_code: id.slice(0, 8), listed: true, seen: Date.now() }));
  const call = async (uid, name, args) => {
    const { data, error } = await server.supabaseFor(uid).rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
  // small numbers: the bridge needs 10 lumber and 4 copper
  const small = () => {
    const p = server.db.bh.projects[0];
    p.needs = [{ item: 'lumber', goal: 10, pts: 1, dayMax: 6, have: 0 }, { item: 'ore_copper', goal: 4, pts: 2, dayMax: 3, have: 0 }];
    Object.assign(p, { cap: 12, tier2: 6, tier3: 10 });
  };
  return { server, ids, call, small };
}

test('five projects in order, each needing things from every part of the game; the game and the server agree', () => {
  assert.deepStrictEqual(plain(BH.projects.map((p) => p.key)), ['bridge', 'market', 'fountain', 'bell', 'pier']);
  assert.deepStrictEqual(plain(BH.projects.map((p) => [p.key, p.needs])), PROJECTS, 'the board offline shows the server\'s numbers');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_online_20.sql'), 'utf8');
  BH.projects.forEach((p) => p.needs.forEach(([id, goal, pts, day], k) => {
    assert.ok(sql.includes(`('${p.key}', '${id}', ${k + 1}, ${goal}, ${pts}, ${day})`), p.key + ': ' + id + ' is the same in the SQL');
    assert.ok(L.bhOk(id), id + ' is a thing a farm can have');
  }));
  const kinds = new Set(BH.projects.flatMap((p) => p.needs.map(([id]) => (BH.names[id] ? 'lumber' : C.ITEMS[id].kind))));
  ['crop', 'produce', 'goods', 'fish', 'ore', 'hunt', 'lumber', 'meat'].forEach((k) => assert.ok(kinds.has(k), 'something of kind ' + k));
  BH.projects.forEach((p) => {
    assert.ok(p.title && p.benefit && p.what && C.ICON[p.icon] != null, p.key + ' has its words and icon');
    const t = C.OUTDOOR.types[C.OUTDOOR.index[p.deco]];
    assert.ok(t && t.cat === 'none' && t.price === 0, p.deco + ': a yard piece that is not sold');
  });
  assert.ok(sql.includes('cap int not null default ' + BH.cap) && sql.includes('tier2 int not null default ' + BH.tiers[1].at) && sql.includes('gold3 int not null default ' + BH.tiers[2].gold));
});

test('the SQL is additive, safe to run twice, and closed to anyone not signed in', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_online_20.sql'), 'utf8');
  const body = sql.split('-- ---------- to undo part 20')[0];
  assert.ok(/Run AFTER part 19/.test(sql));
  assert.ok(!/^\s*drop /im.test(body), 'nothing is dropped (outside the undo block)');
  assert.ok(!/^\s*create function/im.test(body), 'functions are CREATE OR REPLACE (drop + create would widen grants)');
  assert.ok(!/^\s*create table (?!if not exists)/im.test(body) && !/^\s*create index (?!if not exists)/im.test(body));
  assert.ok(/set local lock_timeout = '5s'/.test(body) && /notify pgrst, 'reload schema'/.test(body));
  (body.match(/function public\.(farm_[a-z_]+)\(/g) || []).forEach((m) => assert.ok(/^function public\.farm_[a-z_]{1,40}_v1\($/.test(m), m + ' fits the bridge'));
  ['farm_project_state_v1()', 'farm_project_give_v1(text, int, uuid, text)', 'farm_project_claim_v1(text)'].forEach((f) => assert.ok(body.includes('public.' + f), f + ' is granted and revoked'));
  ['bh_projects', 'bh_needs', 'bh_gifts', 'bh_givers', 'bh_hoods', 'bh_claims'].forEach((t) => assert.ok(body.includes('alter table farm.' + t + ' enable row level security'), t + ': RLS on'));
  assert.ok(!/create policy/i.test(body), 'no policies');
  assert.ok(!/coin|star_balance|wallet/i.test(body.replace(/--.*$/gm, '')), 'nothing about Coins or Stars');
});

test('giving on the server: one progress for everyone, the daily and project caps, the receipt, the barangay', async () => {
  const { server, ids, call, small } = world(3);
  small();
  server.db.hoods.set(1, { id: 1, name: 'Bayan Uno' });
  server.db.hoodOf.set(ids[0], { hood: 1, joined: 1 });
  server.db.hoodOf.set(ids[1], { hood: 1, joined: 2 });
  let st = await call(ids[0], 'farm_project_state_v1', {});
  assert.strictEqual(st.current.key, 'bridge');
  assert.deepStrictEqual(st.current.hood, { name: 'Bayan Uno', pts: 0 });
  let r = await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 4, p_request_id: RID(1), p_project: 'bridge' });
  assert.deepStrictEqual(r, { ok: true, project: 'bridge', item: 'lumber', n: 4, have: 4, goal: 10, today: 4, mine: 4, done: false });
  r = await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 4, p_request_id: RID(1), p_project: 'bridge' });
  assert.ok(r.again && r.n === 4 && r.have === 4, 'the same request again counts once');
  r = await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 5, p_request_id: RID(2) });
  assert.strictEqual(r.n, 2, 'the day allows 2 more');
  assert.strictEqual((await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1, p_request_id: RID(3) })).code, 'day');
  assert.strictEqual((await call(ids[0], 'farm_project_give_v1', { p_item: 'stone', p_n: 1, p_request_id: RID(4) })).code, 'closed');
  assert.deepStrictEqual(await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1, p_request_id: RID(5), p_project: 'market' }), { ok: false, code: 'moved', project: 'bridge' });
  assert.strictEqual((await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1 })).code, 'request-required');
  r = await call(ids[0], 'farm_project_give_v1', { p_item: 'ore_copper', p_n: 3, p_request_id: RID(6) });
  assert.strictEqual(r.mine, 12);
  server.db.bh.gifts.forEach((g) => { g.day = '2000-01-01'; }); // the next day
  assert.strictEqual((await call(ids[0], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1, p_request_id: RID(7) })).code, 'cap', 'the project cap holds across days');
  await call(ids[1], 'farm_project_give_v1', { p_item: 'lumber', p_n: 3, p_request_id: RID(1) });
  st = await call(ids[2], 'farm_project_state_v1', {});
  assert.strictEqual(st.current.needs[0].have, 9, 'everyone sees the same progress');
  assert.deepStrictEqual(st.current.top.map((g) => [g.name, g.pts, g.me]), [['Farm 1', 12, false], ['Farm 2', 3, false]]);
  assert.strictEqual(st.current.hood, null);
  assert.strictEqual((await call(ids[1], 'farm_project_state_v1', {})).current.hood.pts, 15, 'two members count for the barangay');
  server.db.guests.add(ids[2]);
  assert.strictEqual((await call(ids[2], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1, p_request_id: RID(9) })).code, 'guest');
  server.db.guests.delete(ids[2]);
  await call(ids[2], 'farm_project_give_v1', { p_item: 'lumber', p_n: 1, p_request_id: RID(10) });
  r = await call(ids[2], 'farm_project_give_v1', { p_item: 'ore_copper', p_n: 9, p_request_id: RID(11) });
  assert.ok(r.done && r.n === 1, 'the last gift finishes it');
  st = await call(ids[2], 'farm_project_state_v1', {});
  assert.strictEqual(st.current.key, 'market');
  assert.deepStrictEqual(st.done.map((d) => [d.key, d.tier, d.claimed]), [['bridge', 1, false]]);
  assert.deepStrictEqual(await call(ids[0], 'farm_project_claim_v1', { p_project: 'bridge' }), { ok: true, project: 'bridge', tier: 3, gold: 2500 });
  assert.ok((await call(ids[0], 'farm_project_claim_v1', { p_project: 'bridge' })).again);
  assert.strictEqual((await call(ids[1], 'farm_project_claim_v1', { p_project: 'bridge' })).gold, 300);
  assert.strictEqual((await call(ids[1], 'farm_project_claim_v1', { p_project: 'market' })).code, 'not-done');
  server.db.noBh = true;
  await assert.rejects(call(ids[0], 'farm_project_state_v1', {}), /schema cache/, 'before part 20: the function is missing');
});

test('the game reads the server\'s state, checking every value; the town follows what is built', () => {
  const s = fresh();
  assert.strictEqual(L.bhRead(null), null);
  assert.strictEqual(L.bhRead({ ok: false, code: 'not-player' }), null);
  const st = L.bhRead({
    ok: true, can_give: true,
    current: { key: 'market', cap: 800, mine: 20, givers: 3, needs: [{ item: 'egg', goal: 600, have: 9999, pts: 2, day_max: 20, today: 4 }, { item: 'nope', goal: 1 }, { item: 'lumber', goal: 5, have: -3 }],
      top: [{ id: 'a', name: 'Farm <b>', pts: 30 }, { name: 'no id' }], hood: { name: 'Bayan', pts: 12 } },
    done: [{ key: 'bridge', ago: 10, mine: 20, tier: 1, claimed: false }, { key: 'castle' }],
  });
  assert.strictEqual(st.current.def.name, 'The Market Hall');
  assert.deepStrictEqual(plain(st.current.needs), [{ id: 'egg', goal: 600, have: 600, pts: 2, day: 20, today: 4 }, { id: 'lumber', goal: 5, have: 0, pts: 1, day: 0, today: 0 }]);
  assert.strictEqual(st.current.top.length, 1);
  assert.deepStrictEqual(plain(st.current.tiers), plain(BH.tiers), 'no tiers from the server: the game\'s own');
  const tuned = L.bhRead({ ok: true, current: { key: 'bridge', needs: [], tiers: [1, 20, 'x'], gold: [5, 6, 7] }, done: [] }).current.tiers;
  assert.deepStrictEqual(plain(tuned), [{ name: 'Helper', at: 1, gold: 5 }, { name: 'Builder', at: 20, gold: 6 }, { name: 'Hero', at: 500, gold: 7 }]);
  assert.strictEqual(L.bhTier(25, tuned), 2);
  assert.deepStrictEqual(plain(st.done), [{ key: 'bridge', mine: 20, tier: 1, claimed: false, ago: 10 }]);
  assert.strictEqual(L.bhRead({ ok: true, current: { key: 'castle' }, done: [] }).current, null, 'a project this game does not know');
  assert.strictEqual(L.bhNext(s).key, 'bridge');
  assert.deepStrictEqual(plain(L.bhSync(s, st)), ['bridge']);
  assert.deepStrictEqual(plain(L.bhSync(s, st)), [], 'once');
  assert.ok(L.bhBuilt(s, 'bridge') && !L.bhBuilt(s, 'market'));
  assert.strictEqual(L.bhNext(s).key, 'market');
  assert.strictEqual(L.bhToCelebrate(s).key, 'bridge');
  L.bhCelebrated(s, 'bridge');
  assert.strictEqual(L.bhToCelebrate(s), null);
  const back = roundTrip(s);
  assert.ok(L.bhBuilt(back, 'bridge') && L.bhToCelebrate(back) === null, 'the save keeps what is built and celebrated');
});

test('giving in the game: the things leave the bag only on ok, as many as the server took; a lost answer is asked again', () => {
  const s = fresh();
  s.lumber = 30;
  L.addItem(s, 'ore_copper', 5);
  const cur = L.bhRead({ ok: true, current: { key: 'bridge', cap: 12, mine: 0, hood: { name: 'Bayan', pts: 40 }, needs: [{ item: 'lumber', goal: 10, have: 2, pts: 1, day_max: 6, today: 1 }, { item: 'ore_copper', goal: 4, have: 0, pts: 2, day_max: 3, today: 0 }] }, done: [] }).current;
  const [lum, cop] = cur.needs;
  assert.strictEqual(L.bhGiveMax(s, cur, lum), 5, 'the day: 5 more lumber');
  assert.strictEqual(L.bhGiveMax(s, cur, cop), 3);
  cur.mine = 9;
  assert.strictEqual(L.bhGiveMax(s, cur, cop), 1, 'the cap: 3 points left, 1 copper');
  cur.mine = 0;
  L.bhAsk(s, 'bridge', 'lumber', 5, RID(1));
  const kept = roundTrip(s);
  assert.deepStrictEqual(plain(L.bhPending(kept)), { r: RID(1), i: 'lumber', n: 5, k: 'bridge' }, 'the request is kept in the save');
  assert.strictEqual(s.lumber, 30, 'nothing left the bag yet');
  let a = L.bhAnswer(s, { ok: false, code: 'day' }, cur);
  assert.deepStrictEqual(plain(a), { ok: false, n: 0, code: 'day' });
  assert.strictEqual(s.lumber, 30, 'not ok: it all stays');
  assert.strictEqual(L.bhPending(s), null);
  L.bhAsk(s, 'bridge', 'lumber', 5, RID(2));
  a = L.bhAnswer(s, { ok: true, n: 3, have: 5, today: 4, mine: 3 }, cur);
  assert.deepStrictEqual(plain(a), { ok: true, n: 3, code: '', done: false });
  assert.strictEqual(s.lumber, 27, 'only the 3 the server took');
  assert.deepStrictEqual([lum.have, lum.today, cur.mine, cur.hood.pts], [5, 4, 3, 43], 'the board moves, the barangay too');
  L.bhAsk(s, 'bridge', 'ore_copper', 3, RID(3));
  a = L.bhAnswer(s, { ok: true, n: 99, done: true }, cur);
  assert.strictEqual(a.n, 3, 'never more than was asked');
  assert.ok(a.done);
  assert.strictEqual(L.countItem(s, 'ore_copper'), 2);
  L.bhAsk(s, 'bridge', 'ore_copper', 3, RID(4));
  L.removeItem(s, 'ore_copper', 2); // (used up meanwhile)
  assert.strictEqual(L.bhAnswer(s, { ok: true, n: 3 }, cur).n, 0, 'never more than is in the bag');
  const bad = L.serialize(fresh());
  bad.bh = [0, 0, 0, 0, 0, 0, ['not-a-uuid', 'lumber', 2, 'bridge']];
  assert.strictEqual(L.deserialize(bad).bh.p, null, 'a broken request in a save is dropped');
});

test('the reward: Gold as the server says (never more than the top), the title and the yard piece, once', () => {
  const s = fresh(), gold = s.gold, bench = C.OUTDOOR.index.bh_bench;
  assert.strictEqual(L.bhClaim(s, 'bridge', { ok: false, code: 'none' }), 'bad');
  const r = L.bhClaim(s, 'bridge', { ok: true, tier: 2, gold: 1000 });
  assert.deepStrictEqual(plain(r), { gold: 1000, title: 'Bridge Builder', deco: 'Bayanihan Bench', tier: 2 });
  assert.strictEqual(s.gold, gold + 1000);
  assert.strictEqual(s.yard.bag[bench], 1);
  assert.strictEqual(L.bhClaim(s, 'bridge', { ok: true, tier: 2, gold: 1000 }), 'claimed', 'once');
  assert.strictEqual(s.gold, gold + 1000);
  assert.ok(L.bhBuilt(s, 'bridge'), 'a claim means it is built');
  assert.deepStrictEqual(plain(L.bhTitles(s)), ['Bridge Builder']);
  L.bhClaim(s, 'market', { ok: true, tier: 3, gold: 1e9 });
  assert.strictEqual(s.gold, gold + 1000 + BH.tiers[2].gold * 2, 'a silly amount is cut down');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(L.bhTitles(back)), ['Bridge Builder', 'Market Maker']);
  assert.strictEqual(back.yard.bag[bench], 1, 'the bench is in yard storage after a reload');
  assert.deepStrictEqual([0, 1, 150, 499, 500].map((n) => L.bhTier(n)), [0, 1, 2, 2, 3]);
});

test('the benefits: the Market Hall\'s stall, the fountain\'s wish, the Chapel Bell, the boatman, the bridge\'s fish', () => {
  const s = fresh();
  // the Market Hall: a sale pays 10% more; shelves hold C.BH.hallShelf more (50), and keep them through the save
  const cap = L.twShelfCap(s);
  s.shelves[0] = { id: 'turnip', n: 10, price: 1, left: 0, coins: 0 };
  const plainSale = L.sellLot(s, 0, 'lily').coins;
  s.bh.built = 0b10;
  assert.strictEqual(L.twShelfCap(s), cap + 50);
  s.shelves[0] = { id: 'turnip', n: 10, price: 1, left: 0, coins: 0 };
  assert.strictEqual(L.sellLot(s, 0, 'lily').coins, Math.round(plainSale * 1.1));
  s.shelves[1] = { id: 'turnip', n: cap + 50, price: 1, left: 60, coins: 0 };
  assert.strictEqual(roundTrip(s).shelves[1].n, cap + 50, 'a bigger lot loads whole');
  // the fountain: once a day
  assert.strictEqual(L.bhWish(s), 'built');
  s.bh.built |= 0b100;
  const w = L.bhWish(s);
  assert.ok(w.gold > 0 || w.n > 0);
  assert.strictEqual(L.bhWish(s), 'done');
  s.day++;
  assert.ok(typeof L.bhWish(s) === 'object', 'again the next day');
  // the bell: festival days only, once
  s.bh.built |= 0b1000;
  assert.strictEqual(L.bhRing(s), 'day');
  const fest = C.FESTIVALS[0], d = L.dayOf(new Date(2026, fest.date[0] - 1, fest.date[1], 12).getTime());
  s.day = d;
  const g = s.gold;
  assert.deepStrictEqual(plain(L.bhRing(s)), { gold: BH.bellGold });
  assert.strictEqual(s.gold, g + BH.bellGold);
  assert.strictEqual(L.bhRing(s), 'done');
  // the boat: once a day
  assert.strictEqual(L.bhBoat(fresh()), 'built');
  s.bh.built |= 0b10000;
  assert.deepStrictEqual(plain(L.bhBoat(s).items), plain(BH.boat));
  assert.strictEqual(L.countItem(s, 'fish_l'), 1);
  assert.strictEqual(L.bhBoat(s), 'done');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.bh.d), [s.bh.d[0], d, d], 'the days are saved');
  // the bridge's fishing spot: bigger fish more often than the river
  const big = (w) => Object.entries(C.FISH_TABLE[w]).filter(([k]) => k === 'fish_l' || k === 'fish_k').reduce((a, [, v]) => a + v, 0);
  assert.ok(big('bridge') > big('river'));
  assert.ok(Math.abs(Object.values(C.FISH_TABLE.bridge).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('older saves load (no bh key), and a new farm saves nothing extra', () => {
  const s = fresh(), o = L.serialize(s);
  assert.strictEqual(o.bh, undefined, 'nothing to save yet');
  delete o.bh;
  const back = L.deserialize(o);
  assert.deepStrictEqual(plain(back.bh), { built: 0, got: 0, shown: 0, d: [0, 0, 0], p: null });
  const odd = L.serialize(s);
  odd.bh = ['x', -4, 1e9, 'y'];
  assert.deepStrictEqual(plain(L.deserialize(odd).bh), { built: 0, got: 0, shown: 31, d: [0, 0, 0], p: null });
  assert.ok(C.TIPS.some((t) => t.key === 'bh_tour'));
  assert.ok(L.takeTip(s, 'bh_tour'));
  assert.strictEqual(L.tipSeen(roundTrip(s), 'bh_tour'), true);
});

test('the town map: the board, the broken Old Bridge (stubs on each bank, a path to each) and the projects\' places', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'town.json'), 'utf8'));
  const W = m.width, ground = m.layers.find((l) => l.name === 'Ground').data, walls = m.layers.find((l) => l.name === 'Walls').data;
  const { TILES } = require('../tools/tiles');
  const first = m.tilesets.find((t) => t.name === 'tiles').firstgid, dock = TILES.T.dock + first, water = TILES.T.water + first, pathTile = TILES.T.path + first;
  const objs = m.layers.find((l) => l.type === 'objectgroup').objects, by = (n) => objs.find((o) => o.name === n);
  ['bh_board', 'bh_bridge', 'bh_fountain', 'bh_bell', 'bh_pier', 'bh_boat', 'bh_hall'].forEach((n) => assert.ok(by(n), n + ' is on the map'));
  assert.deepStrictEqual([ground[32 * W + 6], ground[35 * W + 6]], [dock, dock], 'a stub on each bank');
  assert.deepStrictEqual([ground[33 * W + 6], ground[34 * W + 6]], [water, water], 'the river between, until it is built');
  [29, 30, 31, 36, 37, 38, 39].forEach((y) => { assert.strictEqual(ground[y * W + 6], pathTile, 'a path at y ' + y); assert.strictEqual(walls[y * W + 6], 0); });
  assert.strictEqual(by('bh_bridge').properties.find((p) => p.name === 'fix').value, dock, 'built, the river gets the dock planks');
  [38, 39, 40, 41].forEach((y) => [42, 43, 44].forEach((x) => assert.strictEqual(ground[y * W + x], water, 'the pier\'s end is water until it is built')));
  // the board stands on free ground, clear of every other place
  const b = by('bh_board'), bx = b.x / 256, byy = b.y / 256;
  objs.filter((o) => o !== b && !o.point && o.type !== 'forage').forEach((o) => {
    const ox = o.x / 256, oy = o.y / 256, ow = o.width / 256, oh = o.height / 256;
    const top = o.gid ? oy - oh : oy; // (a prop's y is its bottom)
    const apart = ox >= bx + 2 || ox + ow <= bx || top >= byy + 2 || top + oh <= byy;
    assert.ok(apart, 'the board does not sit on ' + (o.name || o.type));
  });
  assert.strictEqual(require('../tools/bayanihan-town').bayanihanKeep(6, 30), true);
});
