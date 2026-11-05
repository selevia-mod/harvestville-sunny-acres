// Town Rank and the Hall of Fame (owner, 6 Nov 2026): the rules (src/01-logicZZZZ-rank.js), the words and numbers
// (src/00-zzzzzzzzzzz-rank.js), the hall's map (maps/hall.json, tools/make-map.js hall()), the server part
// (supabase/farm_online_22.sql, checked against the game's own numbers) and the test server's copy of it (test/mock-rank.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createServer } = require('./net-mock');
const MOCK = require('./mock-rank');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
// a moment in Manila's clock (UTC+8), as the phone's ms
const manila = (y, mo, d, h = 10, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi);
const fresh = () => { clock.ms = manila(2026, 11, 6, 10); const s = L.newState(); s.seed = 7; if (L.takeNotes) L.takeNotes(); return s; };
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_online_22.sql'), 'utf8');

// ---------- points ----------
test('points: each kind capped per day; the caps are the same as the server\'s', () => {
  const s = fresh();
  assert.strictEqual(L.rankAdd(s, 'farm', 250), 250);
  assert.strictEqual(L.rankAdd(s, 'farm', 100), 50, 'only up to 300 a day for farming');
  assert.strictEqual(L.rankAdd(s, 'farm', 1), 0, 'full for today');
  assert.strictEqual(L.rankAdd(s, 'hunt', 10), 10, 'hunting has its own cap');
  assert.strictEqual(L.rankAdd(s, 'gold', 10), 0, 'no such kind');
  assert.strictEqual(L.rankAdd(s, 'fish', -3), 0, 'nothing taken away');
  assert.strictEqual(L.rankAdd(s, 'fish', 'lots'), 0);
  assert.strictEqual(s.tr.p, 310);
  assert.deepStrictEqual(plain(L.rankRoom(s)), { farm: 0, goods: 150, fish: 150, mine: 150, hunt: 140, help: 300, bayanihan: 200 });
  // the next day in Manila (midnight there is 4 PM the day before in UTC): today's caps are free again
  clock.ms = manila(2026, 11, 6, 23, 59);
  assert.strictEqual(L.rankAdd(s, 'farm', 5), 0, 'still the 6th in Manila');
  clock.ms = manila(2026, 11, 7, 0, 1);
  assert.strictEqual(L.rankAdd(s, 'farm', 5), 5, 'a new day in Manila');
  assert.strictEqual(s.tr.p, 315, 'the month keeps adding up');
  // the server part has the same kinds and caps, in the same order, and the test server too
  const rows = [...SQL.match(/insert into farm\.rank_sources \(source, day_cap\) values\s+([^;]+?)\son conflict/)[1].matchAll(/\('([a-z_]+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]);
  assert.deepStrictEqual(rows, plain(C.RANK.order.map((k) => [k, C.RANK.sources[k].day])));
  assert.deepStrictEqual(MOCK.SOURCES, Object.fromEntries(rows));
});

test('ranks: Bronze 300, Silver 2,000, Gold 8,000, Champion 20,000; the next rank and what is left; the same as the server', () => {
  assert.deepStrictEqual([0, 299, 300, 1999, 2000, 7999, 8000, 19999, 20000, 1e6].map(L.rankTier), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepStrictEqual(plain(L.rankNext(250)), { tier: 1, def: plain(C.RANK.tiers[0]), need: 50 });
  assert.strictEqual(L.rankNext(8000).need, 12000);
  assert.strictEqual(L.rankNext(20000), null, 'nothing past Champion');
  assert.deepStrictEqual(plain(C.RANK.tiers.map((t) => t.name)), ['Bronze', 'Silver', 'Gold', 'Champion']);
  C.RANK.tiers.forEach((t) => { assert.ok(t.title && t.color != null, t.name + ' has a title and a colour (looks only)'); assert.strictEqual(Object.keys(t).filter((k) => /gold|star|energy|power/i.test(k)).length, 0, 'no power'); });
  assert.strictEqual(SQL.match(/select array\[([\d, ]+)\]/)[1], C.RANK.tiers.map((t) => t.at).join(', '), 'farm.rank_tiers()');
  assert.deepStrictEqual(MOCK.TIERS, plain(C.RANK.tiers.map((t) => t.at)));
});

test('the month starts over on the 1st, Manila time; the best rank ever stays', () => {
  const s = fresh();
  clock.ms = manila(2026, 11, 30, 23, 50);
  for (const k of C.RANK.order) L.rankAdd(s, k, 1000);
  assert.strictEqual(s.tr.p, 1400);
  for (let d = 0; d < 6; d++) { clock.ms += 864e5; for (const k of C.RANK.order) L.rankAdd(s, k, 1000); } // (into December, a day at a time)
  assert.strictEqual(L.manila(clock.ms).mo, 11, 'December');
  assert.strictEqual(s.tr.p, 1400 * 6, 'December has its own six days');
  const t = fresh();
  clock.ms = manila(2026, 11, 30, 12);
  L.rankAdd(t, 'farm', 300);
  t.tr.p = 9000; t.tr.b = 3; // (as if it had been a Gold month)
  clock.ms = manila(2026, 11, 30, 23, 59);
  L.rankAdd(t, 'goods', 3);
  assert.strictEqual(t.tr.p, 9003, 'still November at 11:59 PM in Manila');
  clock.ms = manila(2026, 12, 1, 0, 0); // = 4 PM on 30 Nov in UTC: the phone in another time zone still starts over now
  assert.strictEqual(new Date(clock.ms).getUTCDate(), 30);
  L.rankAdd(t, 'goods', 3);
  assert.strictEqual(t.tr.p, 3, 'December 1st in Manila: a new month');
  assert.strictEqual(t.tr.b, 3, 'the best ever (Gold) stays');
  assert.strictEqual(roundTrip(t).tr.b, 3, 'and is saved');
  assert.strictEqual(L.rankDaysLeft(manila(2026, 12, 1, 0, 0)), 31);
  assert.strictEqual(L.rankDaysLeft(manila(2026, 12, 31, 20, 0)), 1);
  assert.strictEqual(L.monthKey(L.manila(manila(2026, 12, 1)).month), '2026-12');
  assert.strictEqual(L.monthName(L.manila(manila(2026, 12, 1)).month), 'December');
});

test('what earns points: crops and animal products, cooking and goods, fish, rocks, hunts, cargo crates, requests and orders; never on a visit', () => {
  const s = fresh(), R = C.RANK;
  const p = () => s.tr.p;
  L.bump(s, 'harvest', 3);
  assert.strictEqual(p(), 3 * R.sources.farm.each, 'three crops picked');
  L.bump(s, 'collect');
  assert.strictEqual(p(), 4, 'an egg collected');
  L.bump(s, 'water');
  L.bump(s, 'talk');
  assert.strictEqual(p(), 4, 'watering and talking are not points');
  L.bump(s, 'hunt');
  assert.strictEqual(p(), 4 + R.sources.hunt.each, 'a hunt');
  L.bump(s, 'request');
  L.bump(s, 'order');
  assert.strictEqual(p(), 9 + R.help.request + R.help.order, 'a villager\'s request and a shipping order help the town');
  const before = p();
  assert.ok(typeof L.catchFish(s, 'pond', 0.01) === 'string');
  assert.strictEqual(p(), before + R.sources.fish.each, 'a fish');
  L.rankRock(s);
  assert.strictEqual(p(), before + R.sources.fish.each + R.sources.mine.each, 'a rock broken in the Mine');
  // a cooked dish (the kitchen, and what it needs)
  s.builds.kitchen = 1;
  const recipe = C.RECIPES.find((r) => r.dish === 'boiled_egg') || C.RECIPES[0];
  recipe.needs.forEach((n) => L.addItem(s, C.FOOD_GROUPS[n] ? C.FOOD_GROUPS[n][0] : n, 1));
  const b2 = p();
  assert.strictEqual(L.cook(s, recipe), 'ok');
  assert.strictEqual(p(), b2 + R.sources.goods.each, 'a dish cooked');
  // a workshop's goods: each one collected
  const key = Object.keys(C.WORKSHOPS)[0];
  s.ws[key] = [[0, L.nowMin() - 1], [0, L.nowMin() - 1]];
  const b3 = p(), got = L.collectJobs(s, key);
  assert.strictEqual(got.length, 2);
  assert.strictEqual(p(), b3 + 2 * R.sources.goods.each, 'two goods from the workshop');
  // a hunted animal counts once (L.hunted bumps 'hunt')
  const b4 = p();
  L.hunted(s, 'pulag', 0, 'rabbit', 1);
  assert.strictEqual(p(), b4 + R.sources.hunt.each);
  // a visit's sandbox earns nothing (it is someone else's farm)
  const v = fresh();
  v.isVisit = true;
  L.bump(v, 'harvest', 5);
  assert.strictEqual(v.tr.p, 0);
});

test('a cargo crate helps the town, and a full cargo order more', () => {
  const s = fresh();
  if (!L.twFill) return;
  s.tw.o = { at: 0, due: L.nowMin() + 600, no: 1, full: 0, crates: [{ id: 'turnip', n: 1, k: 'crops', pay: 10, done: 0 }, { id: 'potato', n: 1, k: 'crops', pay: 10, done: 0 }], prize: { gold: 10, stars: 1, item: null, n: 0 } };
  L.addItem(s, 'turnip', 1);
  L.addItem(s, 'potato', 1);
  const a = s.tr.p;
  assert.ok(typeof L.twFill(s, 0) === 'object');
  assert.strictEqual(s.tr.p, a + C.RANK.help.crate);
  assert.ok(typeof L.twFill(s, 1) === 'object');
  assert.strictEqual(s.tr.p, a + 2 * C.RANK.help.crate + C.RANK.help.cargo, 'the last crate fills the order');
});

test('sending: each kind waiting goes with its own id; an unanswered send goes again with the same id; saved and loaded', () => {
  const s = fresh();
  L.rankAdd(s, 'farm', 12);
  L.rankAdd(s, 'fish', 6);
  const out = L.rankTake(s);
  assert.deepStrictEqual(plain(out.map((x) => [x.src, x.n])), [['farm', 12], ['fish', 6]]);
  out.forEach((x) => assert.match(x.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  assert.deepStrictEqual(plain(s.tr.q), {}, 'out of the queue');
  L.rankAdd(s, 'farm', 3);
  const again = L.rankTake(s);
  assert.deepStrictEqual(plain(again.slice(0, 2).map((x) => x.id)), plain(out.map((x) => x.id)), 'not answered yet: the same ids again');
  assert.deepStrictEqual(plain(again.slice(2).map((x) => [x.src, x.n])), [['farm', 3]], 'and the new points with a new id');
  L.rankSent(s, out[0].id);
  // the save keeps what waits and what is out (a game closed before the answer sends it again, with the same id)
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.tr.out.map((x) => [x.id, x.src, x.n])), plain(again.slice(1).map((x) => [x.id, x.src, x.n])));
  assert.strictEqual(back.tr.p, 21);
  assert.deepStrictEqual(plain(back.tr.dd), { farm: 15, fish: 6 });
  // the server's word on the best rank
  L.rankServer(back, { best: 4, tier: 0 });
  assert.strictEqual(back.tr.b, 4);
  L.rankServer(back, { best: 'x' });
  assert.strictEqual(back.tr.b, 4, 'never lowered');
  // a new month: last month's unsent points go (the server would count them in the new month)
  clock.ms = manila(2026, 12, 1, 9);
  assert.deepStrictEqual(plain(L.rankTake(back)), []);
});

test('the save: small, old saves load, and changed numbers are cut down to size', () => {
  const s = fresh();
  assert.strictEqual(L.serialize(s).tr, undefined, 'nothing yet, nothing saved');
  const old = L.serialize(s);
  delete old.tr;
  const o = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.deepStrictEqual(plain(o.tr), { m: 0, p: 0, d: 0, dd: {}, q: {}, b: 0, out: [], fq: [], fd: [] }, 'an old save starts with nothing');
  L.rankAdd(s, 'farm', 300);
  L.hallWant(s, 'bakunawa');
  assert.ok(JSON.stringify(L.serialize(s).tr).length < 120, JSON.stringify(L.serialize(s).tr));
  const bad = L.serialize(s);
  bad.tr = { m: 'x', p: -5, d: 1e12, dd: [9999, 'a', -1], q: [5, 0, 0, 0, 0, 0, 0, 7, 8], b: 99, o: [['nope', 0, 5], ['00000000-0000-4000-8000-000000000000', 99, 5]], fq: ['bakunawa', 'dragon', 'bakunawa'], fd: [7] };
  const t = L.deserialize(JSON.parse(JSON.stringify(bad))).tr;
  assert.deepStrictEqual(plain(t), { m: 0, p: 0, d: 1e7, dd: { farm: 300 }, q: { farm: 5 }, b: 4, out: [], fq: ['bakunawa'], fd: [] });
});

// ---------- the Hall of Fame ----------
test('firsts: the Bakunawa, each Lair guard on its own floor, the Great Mammoth; once each; the same list as the server\'s', () => {
  assert.strictEqual(L.hallFirstOf('lair', 'bakunawa', 50), 'bakunawa');
  assert.strictEqual(L.hallFirstOf('lair', 'bungisngis', 10), 'lair_10');
  assert.strictEqual(L.hallFirstOf('lair', 'bungisngis', 40), 'lair_40');
  assert.strictEqual(L.hallFirstOf('lair', 'santelmo', 10), null, 'not a guard');
  assert.strictEqual(L.hallFirstOf('makiling', 'boar', 0), null);
  assert.strictEqual(L.hallFirstOf('magayon', 'greatmammoth', 0), 'greatmammoth');
  const s = fresh();
  assert.strictEqual(L.hallWant(s, 'lair_10'), true);
  assert.strictEqual(L.hallWant(s, 'lair_10'), false, 'asked once');
  assert.strictEqual(L.hallWant(s, 'dragon'), false, 'only firsts there are');
  L.hallClaimed(s, 'lair_10');
  assert.deepStrictEqual(plain(s.tr.fq), []);
  assert.strictEqual(L.hallWant(s, 'lair_10'), false, 'answered: never again');
  assert.deepStrictEqual(plain(roundTrip(s).tr.fd), ['lair_10']);
  const keys = [...SQL.match(/insert into farm\.hall_first_keys \(key, what\) values([^;]+?)on conflict/)[1].matchAll(/\('([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(keys.sort(), plain(C.HALL.FIRSTS.map((f) => f.key).sort()), 'the server\'s allow-list');
  assert.deepStrictEqual(MOCK.FIRSTS.slice().sort(), keys.sort());
  // every guard floor of the Lair has its first
  for (let f = C.LAIR.bossEvery; f < C.LAIR.bakunawaFloor; f += C.LAIR.bossEvery) assert.ok(L.hallFirstOf('lair', 'bungisngis', f), 'floor ' + f);
});

test('plaques: names and records from the server, "That\'s you!", nobody yet, your own best; offline, reading, and before the server has it', () => {
  const s = fresh();
  s.wild.best.boar = 980;
  const data = {
    catches: [{ kind: 'boar', kg10: 1215, id: 'u1', name: 'Juan' }, { kind: 'rabbit', kg10: 25, id: 'me', name: 'Ana' }, { kind: 'newbeast', kg10: 99, id: 'u2', name: 'Bea' }],
    fish: [{ kind: 'fish_k', g: 18000, id: 'u2', name: 'Bea' }],
    firsts: [{ key: 'bakunawa', id: 'me', name: 'Ana' }, { key: 'lair_10', id: 'u1', name: null }],
    champs: { month: '2026-10', last: [{ id: 'u1', name: 'Juan', points: 23456 }], most: [{ id: 'me', name: 'Ana', months: 1 }] },
    top: [{ rank: 1, id: 'u2', name: 'Bea', points: 9100, tier: 3 }, { rank: 2, id: 'me', name: 'Ana', points: 2500, tier: 2 }],
    more: [],
  };
  const text = (spot, d = data) => plain(L.hallShape(spot, d, 'me', s).rows.map((r) => r[1]));
  assert.deepStrictEqual(text('d1'), ['Wild Boar: Juan, 121.5 kg (yours: 98.0 kg)']);
  assert.deepStrictEqual(text('w1'), ['Rabbit: Ana, 2.5 kg  That\'s you!', 'Labuyo: nobody yet. Be the first!', 'Deer: nobody yet. Be the first!', 'White Stag: nobody yet. Be the first!']);
  assert.ok(text('w3').some((t) => /^Great Mammoth: nobody yet/.test(t)), 'Magayon\'s plaque has the Great Mammoth');
  assert.ok(!text('w2').concat(text('w3')).some((t) => /Bakunawa|Santelmo/.test(t)), 'not the Lair\'s creatures');
  assert.deepStrictEqual(text('w7'), ['newbeast: Bea, 9.9 kg'], 'a new place\'s animal goes on More hunting records until it has its own');
  assert.deepStrictEqual(text('w4'), ['Small Fish: nobody yet. Fish on a Monday!', 'Medium Fish: nobody yet. Fish on a Monday!', 'Large Fish: nobody yet. Fish on a Monday!', 'King Trout: Bea, 18.00 kg']);
  assert.deepStrictEqual(text('d2'), ['First to beat the Bakunawa: Ana  That\'s you!']);
  assert.deepStrictEqual(text('w5')[0], 'First to beat the guard of floor 10: Farmer', 'a hidden or blocked name is "Farmer"');
  assert.match(text('w5')[1], /floor 20: nobody yet/);
  assert.deepStrictEqual(text('w6'), ['October\'s Champion: Juan, 23,456 points', 'Most Champion months: Ana, 1 month  That\'s you!']);
  assert.deepStrictEqual(text('d3'), ['October\'s Champion: Juan, 23,456 points'], 'the pedestal: last month only');
  assert.deepStrictEqual(text('board'), ['#1 Bea, 9,100 (Gold)', '#2 Ana, 2,500 (Silver)  That\'s you!']);
  assert.deepStrictEqual(text('d5'), ['Coming soon: the Bayanihan Project\'s top givers will hang here.'], 'the Bayanihan hook, before that part');
  assert.deepStrictEqual(text('d5', Object.assign({}, data, { more: [{ key: 'bayanihan', rows: [{ id: 'me', name: 'Ana', text: '40 gifts' }] }] })), ['#1 Ana, 40 gifts  That\'s you!']);
  assert.deepStrictEqual(text('w8'), [C.HALL.soon]);
  // not online, reading, the server without part 22
  assert.deepStrictEqual(text('d1', null), ['Join online play to see the names.', 'Your biggest Wild Boar: 98.0 kg.']);
  assert.deepStrictEqual(text('w1', null), ['Join online play to see the names.']);
  assert.deepStrictEqual(text('w1', false), ['Reading the names...']);
  assert.deepStrictEqual(text('w1', 'soon'), ['The names go up here very soon.']);
  // untrusted: names are cleaned, junk rows skipped
  const junk = { catches: [null, 5, { kind: 'boar', kg10: 900, id: 'x', name: '<b>' + 'x'.repeat(60) }], top: 'no', champs: 7 };
  assert.ok(text('d1', junk)[0].length < 60);
  assert.deepStrictEqual(text('board', junk), ['Nobody has points this month yet. Be the first!']);
  assert.strictEqual(L.hallShape('nope', data, 'me', s), null);
  // every plaque has a title, an icon there is, and a kind the shaper knows
  Object.keys(C.HALL.spots).forEach((k) => {
    const sp = C.HALL.spots[k], sh = L.hallShape(k, data, 'me', s);
    assert.ok(/^[A-Z0-9 !?.,:'-]+$/.test(sp.title), k + ': a title the dialog shows on its ribbon');
    assert.ok(C.ICON[sp.icon] != null, k + ': ' + sp.icon);
    assert.ok(sh.rows.length >= 1, k);
    if (sp.trophy) assert.ok(C.HOME.types.some((t) => t.key === sp.trophy), k + ': its trophy picture');
  });
});

const S = 256;
const mapOf = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', name + '.json'), 'utf8'));
const objectsOf = (m) => m.layers.find((l) => l.type === 'objectgroup').objects;
const propsOf = (o) => Object.fromEntries((o.properties || []).map((p) => [p.name, p.value]));

test('the hall\'s map: Royal floor and walls, a plaque object for every spot, each one can be walked up to, out to the park\'s door', () => {
  const m = mapOf('hall'), objs = objectsOf(m);
  assert.deepStrictEqual([m.width, m.height], [18, 14]);
  assert.deepStrictEqual(m.tilesets.map((t) => t.name), ['indoor', 'props']);
  const spots = objs.filter((o) => o.type === 'plaque').map((o) => propsOf(o).spot).sort();
  assert.deepStrictEqual(spots, plain(Object.keys(C.HALL.spots).sort()), 'one object for every spot in C.HALL.spots, and no other');
  const exit = objs.find((o) => o.name === 'exit');
  assert.deepStrictEqual(propsOf(exit), { to: 'park', spawn: 'door_hall', walk: true });
  const park = objectsOf(mapOf('park'));
  assert.ok(park.find((o) => o.name === 'door_hall' && o.point), 'the park has the spot in front of the door');
  assert.ok(park.find((o) => o.type === 'hall'), 'and the door itself');
  assert.ok(objs.find((o) => o.name === 'entrance' && o.point));
  // walkable: the floor, less the walls (solid tiles), the pedestals (solid in the game) and the props' feet
  const W = m.width, solid = new Set(), collides = new Set();
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { if ((t.properties || []).some((p) => p.name === 'collides' && p.value)) collides.add(ts.firstgid + t.id); }));
  ['Ground', 'Walls'].forEach((n) => m.layers.find((l) => l.name === n).data.forEach((g, i) => { if (collides.has(g)) solid.add(i); }));
  const { PROPS } = require('../tools/tiles');
  const propSet = m.tilesets.find((t) => t.name === 'props');
  objs.filter((o) => o.gid).forEach((o) => {
    const name = propSet.tiles.find((t) => t.id === o.gid - propSet.firstgid).image.replace(/^.*\/|\.png$/g, ''), p = PROPS[name];
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'props', name + '.webp')), name);
    for (let y = Math.round(o.y / S) - (p.foot || 0); y < Math.round(o.y / S); y++) for (let x = Math.round(o.x / S); x < Math.round(o.x / S) + p.w; x++) solid.add(y * W + x);
  });
  objs.filter((o) => o.type === 'plaque' && propsOf(o).spot[0] === 'd').forEach((o) => { for (let x = o.x / S; x < (o.x + o.width) / S; x++) solid.add((o.y / S) * W + x); });
  const start = Math.floor(exit.y / S - 1) * W + 9, seen = new Set([start]), q = [start];
  assert.ok(!solid.has(start), 'inside the door is open');
  while (q.length) {
    const k = q.pop(), x = k % W;
    [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W].forEach((o) => { if (o >= 0 && o < W * m.height && !seen.has(o) && !solid.has(o)) { seen.add(o); q.push(o); } });
  }
  objs.filter((o) => o.type === 'plaque').forEach((o) => {
    const x0 = o.x / S, y0 = o.y / S, x1 = x0 + o.width / S - 1, around = [];
    for (let x = x0; x <= x1; x++) around.push([x, y0 + 1], [x, y0 - 1]);
    around.push([x0 - 1, y0], [x1 + 1, y0]);
    assert.ok(around.some(([x, y]) => x >= 0 && y >= 0 && x < W && seen.has(y * W + x)), propsOf(o).spot + ' can be walked up to');
  });
});

test('the hall in the save and the routes: a game closed in the hall opens on the park road; the goal arrow knows the way in and out', () => {
  const s = fresh();
  s.map = 'hall';
  s.player = { x: 9 * S, y: 10 * S, dir: 'up' };
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  assert.strictEqual(o.pk, 1, 'saved as the park (which is saved as town, on the park road)');
  assert.strictEqual(o.p, undefined);
  const back = L.deserialize(o);
  assert.strictEqual(back.map, 'town');
  assert.strictEqual(back.player.spawn, 'from_park');
  assert.strictEqual(C.ROUTES.park.hall, 'hall_door');
  assert.strictEqual(C.ROUTES.hall.park, 'exit');
  assert.strictEqual(C.ROUTES.hall.farm, 'exit');
  assert.strictEqual(C.ROUTES.town.hall, C.ROUTES.town.park);
  assert.strictEqual(C.ROUTES.farm.hall, C.ROUTES.farm.park);
  const keys = C.TIPS.map((t) => t.key);
  assert.deepStrictEqual(plain(keys.slice(keys.indexOf('park_tour') + 1, keys.indexOf('park_tour') + 3)), ['rank_tour', 'hall_tour'], 'the tours\' tips, appended after the park\'s');
  const t = fresh();
  L.takeTip(t, 'hall_tour');
  assert.ok(L.tipSeen(roundTrip(t), 'hall_tour') && !L.tipSeen(roundTrip(t), 'rank_tour'));
});

test('the server part: plain-words header, run after part 21 but needs only parts 1, 14, 15; additive, safe twice, the grants', () => {
  const head = SQL.split('\n').slice(0, 3).join('\n');
  assert.match(head, /part 22/);
  assert.match(head, /Run AFTER part 21/);
  assert.ok(!/farm_online_2[01]|part 2[01]'s/.test(SQL.replace(/Run AFTER part 21[^\n]*\n[^\n]*\n[^\n]*/, '')), 'no use of parts 20 or 21');
  assert.match(SQL, /set local lock_timeout = '5s';/);
  assert.match(SQL, /notify pgrst, 'reload schema';/);
  const live = SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\bdrop\s+(function|table)\b/i.test(live), 'nothing dropped outside the undo block');
  assert.ok(!/^create function/m.test(live), 'functions are CREATE OR REPLACE (dropping and making again widens grants)');
  assert.ok(!/^create table (?!if not exists)/m.test(live), 'tables only if not there');
  const fns = [...live.matchAll(/create or replace function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]);
  assert.deepStrictEqual(fns.sort(), ['farm_hall_first_v1', 'farm_hall_v1', 'farm_rank_add_v1', 'farm_rank_board_v1']);
  fns.forEach((f) => {
    assert.match(f, /^farm_[a-z_]{1,40}_v1$/, 'a name the bridge allows');
    assert.ok(new RegExp('revoke all on function[^;]*public\\.' + f + '\\(').test(live), f + ' revoked from public and anon');
    assert.ok(new RegExp('grant execute on function[^;]*public\\.' + f + '\\([^;]*to authenticated').test(live), f + ' for players');
  });
  [...live.matchAll(/create table if not exists (farm\.[a-z_]+)/g)].forEach((m) => assert.ok(live.includes('alter table ' + m[1] + ' enable row level security'), m[1] + ': RLS on'));
  assert.match(SQL, /-- ---------- to undo part 22 ----------/);
});

// ---------- the test server's Town Rank (test/mock-rank.js, as the SQL) ----------
function world(names) {
  const server = createServer();
  const ids = names.map(() => server.newUser());
  ids.forEach((id, i) => server.db.players.set(id, { id, farm_name: names[i], friend_code: id.slice(0, 8), listed: true, seen: Date.now() }));
  const call = async (uid, name, args) => {
    const { data, error } = await server.supabaseFor(uid).rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
  return { server, ids, call };
}
const rid = () => require('crypto').randomUUID();

test('the test server: caps, ids once, the board in order, firsts to whoever claims first, the hall\'s names', async () => {
  const { server, ids: [ana, ben, cara], call } = world(['Ana', 'Ben', 'Cara']);
  const id = rid();
  assert.strictEqual((await call(ana, 'farm_rank_add_v1', { p_source: 'farm', p_points: 250, p_request_id: id })).points, 250);
  assert.strictEqual((await call(ana, 'farm_rank_add_v1', { p_source: 'farm', p_points: 250, p_request_id: id })).added, 0, 'the same id once');
  const r = await call(ana, 'farm_rank_add_v1', { p_source: 'farm', p_points: 250, p_request_id: rid() });
  assert.deepStrictEqual([r.added, r.points, r.tier, r.rank], [50, 300, 1, 1]);
  assert.strictEqual((await call(ana, 'farm_rank_add_v1', { p_source: 'coins', p_points: 9, p_request_id: rid() })).code, 'bad-source');
  await call(ben, 'farm_rank_add_v1', { p_source: 'hunt', p_points: 150, p_request_id: rid() });
  await call(ben, 'farm_rank_add_v1', { p_source: 'help', p_points: 300, p_request_id: rid() });
  await call(cara, 'farm_rank_add_v1', { p_source: 'fish', p_points: 30, p_request_id: rid() });
  const b = await call(cara, 'farm_rank_board_v1', {});
  assert.deepStrictEqual(b.top.map((x) => [x.rank, x.name, x.points, x.tier]), [[1, 'Ben', 450, 1], [2, 'Ana', 300, 1], [3, 'Cara', 30, 0]]);
  assert.deepStrictEqual([b.me.rank, b.me.points], [3, 30]);
  assert.strictEqual((await call(ben, 'farm_hall_first_v1', { p_key: 'bakunawa' })).first, true);
  const late = await call(ana, 'farm_hall_first_v1', { p_key: 'bakunawa' });
  assert.deepStrictEqual([late.first, late.name], [false, 'Ben']);
  assert.strictEqual((await call(ana, 'farm_hall_first_v1', { p_key: 'dragon' })).code, 'bad-key');
  await call(ana, 'farm_catch_v1', { p_kind: 'boar', p_kg10: 1100 });
  await call(ben, 'farm_catch_v1', { p_kind: 'boar', p_kg10: 1000 });
  const h = await call(cara, 'farm_hall_v1', {});
  assert.deepStrictEqual(h.catches.map((c) => [c.kind, c.name, c.kg10]), [['boar', 'Ana', 1100]]);
  assert.deepStrictEqual(h.firsts.map((f) => [f.key, f.name]), [['bakunawa', 'Ben']]);
  assert.deepStrictEqual(h.top.map((x) => x.name), ['Ben', 'Ana', 'Cara']);
  // the game's own shaping of it, as Ana sees it
  const ah = await call(ana, 'farm_hall_v1', {});
  assert.deepStrictEqual(plain(L.hallShape('d1', ah, ana, null).rows.map((x) => x[1])), ['Wild Boar: Ana, 110.0 kg  That\'s you!']);
  server.db.noRank = true;
  await assert.rejects(call(ana, 'farm_hall_v1', {}), /schema cache/, 'before part 22: the function is not there');
});
