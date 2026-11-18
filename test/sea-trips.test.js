// Sea trips (boats step 1, owner 18 Nov 2026; src/00-zzz...z-sea.js, src/01-logicZ...Z-sea.js): the fish and their odds,
// the snag, the group bonus, the ticket (and Marisol's free one), the 10 minutes and the bell, no energy for riding, the
// spots, the Marlin's once-a-trip rule, landing and the sea's fish book, the crate, Marisol's tasks, friends aboard, the
// five dishes and their powers, Sea Fertilizer, Capiz, the fish vendor, the map, the server rows, and the save.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const S = C.SEA;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (x) => JSON.parse(JSON.stringify(x));
const MIN = 60000;
const fresh = () => { clock.set(2026, 11, 18, 10, 0); const s = L.newState(); s.seed = 31; L.takeNotes(); s.gold = 20000; L.addItem(s, 'rod', 1); return s; };
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const hearts = (s, n) => { L.friend(s, 'mn_marisol').pts = n * 10; };

test('the six sea fish: their odds (100% together), prices and games; the Marlin apart; new items only', () => {
  const rows = S.fish.map((f) => [f[0], f[2], f[3], f[4]]);
  assert.deepStrictEqual(plain(rows), [['galunggong', 0.3, 80, 'easy'], ['sea_pusit', 0.2, 120, 'easy'], ['maya_maya', 0.18, 200, 'medium'], ['lapu_lapu', 0.14, 320, 'medium'],
    ['tanigue', 0.11, 450, 'hard'], ['tuna', 0.07, 700, 'hard'], ['marlin', 0, 5000, 'boss']]);
  assert.strictEqual(Math.round(S.fish.reduce((a, f) => a + f[2], 0) * 100), 100);
  S.ids.forEach((id) => { assert.strictEqual(C.ITEMS[id].kind, 'fish'); assert.ok(C.FISH_GAME[id].speed > 0); assert.ok(C.ITEMS[id].icon >= C.SEA_ICON_BASE, id); });
  assert.ok(C.FISH_GAME.marlin.zone < C.FISH_GAME.tuna.zone && C.FISH_GAME.marlin.speed > C.FISH_GAME.tuna.speed, 'the Marlin: harder');
  // the river stays as it was
  assert.deepStrictEqual(plain(C.FISH_ORDER), ['fish_s', 'fish_m', 'fish_l', 'fish_k']);
  assert.deepStrictEqual(plain(C.FISH_GAME.fish_k), { speed: 1.5, zone: 0.22 });
  assert.strictEqual(C.ITEMS.grilled_fish.energy > 0 && C.ITEMS.fish_s.sell, 30);
  assert.ok(!('galunggong' in C.FISH_KG), 'no sea fish in the Derby\'s weights');
  // a bite: each fish its share (a fixed stream), Seaweed 1 in 10
  const n = {}, rnd = ((r) => () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; })(7);
  for (let i = 0; i < 40000; i++) { const k = L.seaRoll(rnd, 1); n[k] = (n[k] || 0) + 1; }
  assert.ok(Math.abs(n.seaweed / 40000 - 0.1) < 0.01, 'snags ' + n.seaweed);
  S.fish.filter((f) => f[2]).forEach((f) => assert.ok(Math.abs(n[f[0]] / 36000 - f[2]) < 0.012, f[0] + ' ' + n[f[0]]));
  assert.ok(!n.marlin, 'never a Marlin from the table');
  assert.strictEqual(L.seaRoll(seq(0.05), 1), 'seaweed');
  assert.strictEqual(L.seaRoll(seq(0.5, 0.0), 1), 'galunggong');
  assert.strictEqual(L.seaRoll(seq(0.5, 0.999), 1), 'tuna');
});

test('the group bonus: +10% chance of one size bigger for each extra player aboard, at most 4 aboard', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 9].map(L.seaBonus), [0, 0.1, 0.2, 0.3, 0.3]);
  assert.strictEqual(L.seaRoll(seq(0.5, 0.0, 0.05), 2), 'sea_pusit', 'a galunggong became a pusit');
  assert.strictEqual(L.seaRoll(seq(0.5, 0.0, 0.15), 2), 'galunggong', 'not this time');
  assert.strictEqual(L.seaRoll(seq(0.5, 0.0, 0.25), 4), 'sea_pusit');
  assert.strictEqual(L.seaRoll(seq(0.5, 0.999, 0.0), 4), 'tuna', 'nothing bigger than a tuna from the table');
  assert.ok(L.seaMarlinZone(4) > L.seaMarlinZone(1), 'friends reeling: the Marlin\'s zone a little wider');
});

test('the ticket: 3,000 Gold, a rod needed, one trip at a time; Marisol\'s free one at 8 hearts, once a day', () => {
  const s = fresh(), t0 = clock.ms;
  L.removeItem(s, 'rod', 1);
  assert.deepStrictEqual(plain(L.seaStart(s, t0)), { why: 'rod' });
  L.addItem(s, 'rod', 1);
  s.gold = 2999;
  assert.deepStrictEqual(plain(L.seaStart(s, t0)), { why: 'gold' });
  s.gold = 5000;
  assert.deepStrictEqual(plain(L.seaStart(s, t0, false, () => 0.99)), { ok: true, paid: 3000 });
  assert.strictEqual(s.gold, 2000);
  assert.strictEqual(s.sea.t.sh, 3, '1-3 Capiz Shells in the crate');
  assert.deepStrictEqual(plain(L.seaStart(s, t0)), { why: 'busy' });
  L.seaEnd(s, t0 + MIN);
  // free: not before 8 hearts, then once a day
  assert.strictEqual(L.seaFreeOk(s), false);
  hearts(s, 8);
  assert.strictEqual(L.seaFreeOk(s), true);
  s.gold = 0;
  assert.deepStrictEqual(plain(L.seaStart(s, t0, true, () => 0)), { ok: true, paid: 0 });
  assert.strictEqual(s.sea.t.sh, 1);
  L.seaEnd(s, t0);
  assert.strictEqual(L.seaFreeOk(s), false, 'once a day');
  assert.deepStrictEqual(plain(L.seaStart(s, t0, true)), { why: 'gold' });
  clock.nextDay(L, s);
  assert.strictEqual(L.seaFreeOk(s), true, 'a new day');
});

test('10 real minutes, the bell at 1 minute left; riding costs no energy; a cast costs the river\'s', () => {
  const s = fresh(), t0 = clock.ms, e = s.energy;
  L.seaStart(s, t0);
  assert.strictEqual(s.energy, e, 'a ticket and a ride: no energy');
  const t = s.sea.t;
  assert.strictEqual(L.seaLeft(t, t0), 10 * MIN);
  assert.strictEqual(L.seaBellAt(t), t0 + 9 * MIN);
  assert.strictEqual(L.seaLeft(t, t0 + 9.5 * MIN), 0.5 * MIN);
  assert.strictEqual(L.seaLeft(t, t0 + 10 * MIN), 0);
  assert.strictEqual(C.FISH_ENERGY, 2);
  assert.strictEqual(S.mins, 10);
  const r = L.seaEnd(s, t0 + 10 * MIN);
  assert.strictEqual(r.mins, 10);
  assert.strictEqual(s.energy, e, 'the trip back: no energy');
});

test('the spots: 4 of them, the same for everyone on the trip, new ones every 90 s; a 5th at 6 hearts; a cast reaches its tile and those beside it', () => {
  const t = { a: 1794967200000 };
  const a = L.seaSpots(t, t.a), b = L.seaSpots(t, t.a + 89000), c = L.seaSpots(t, t.a + 90000);
  assert.strictEqual(a.length, 4);
  assert.deepStrictEqual(plain(a), plain(b), 'the same for 90 s (and on every phone)');
  assert.notDeepStrictEqual(plain(a), plain(c), 'they move');
  assert.strictEqual(new Set(a.map(String)).size, 4, 'four different places');
  assert.strictEqual(L.seaSpots(t, t.a, true).length, 5);
  assert.deepStrictEqual(plain(L.seaSpots(t, t.a, true)[4]), plain(S.near));
  const fx = fresh();
  assert.strictEqual(L.seaNearOk(fx), false);
  hearts(fx, 6);
  assert.strictEqual(L.seaNearOk(fx), true);
  const top = [[9, 4]], side = [[19, 9]];
  assert.deepStrictEqual([8, 9, 10, 11].map((x) => L.seaSpotAt(top, x, 4)), [0, 0, 0, -1]);
  assert.strictEqual(L.seaSpotAt(top, 9, 5), -1, 'not the deck');
  assert.deepStrictEqual([8, 9, 10, 11].map((y) => L.seaSpotAt(side, 19, y)), [0, 0, 0, -1]);
  // every spot is water beside the rail, reached from a free deck tile
  const d = S.deck, onDeck = (x, y) => x >= d[0] && x < d[0] + d[2] && y >= d[1] && y < d[1] + d[3] && !(x >= S.house[0] && x < S.house[0] + S.house[2] && y >= S.house[1] && y < S.house[1] + S.house[3]) && !(x === S.crate[0] && y === S.crate[1]);
  S.slots.concat([S.near]).forEach((p) => {
    assert.ok(!onDeck(p[0], p[1]), p + ' is water');
    assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some((v) => onDeck(p[0] + v[0], p[1] + v[1])), p + ' is beside the deck');
  });
});

test('the Marlin: after 5 minutes, at most once a trip; lost, back once 60 s later; landed, it is the trip\'s', () => {
  const s = fresh(), t0 = clock.ms;
  L.seaStart(s, t0);
  const t = s.sea.t;
  assert.strictEqual(L.seaMarlinOut(t, t0 + 4.9 * MIN), false);
  assert.strictEqual(L.seaMarlinOut(t, t0 + 5 * MIN), true);
  assert.ok(L.seaMarlinSpot(t, t0 + 5 * MIN) < S.spots, 'one of the four that move');
  L.seaMarlinLost(s, t0 + 5.5 * MIN);
  assert.strictEqual(L.seaMarlinOut(t, t0 + 5.5 * MIN + 59000), false, 'gone for a minute');
  assert.strictEqual(L.seaMarlinOut(t, t0 + 5.5 * MIN + 60000), true, 'back once');
  L.seaMarlinLost(s, t0 + 7 * MIN);
  assert.strictEqual(L.seaMarlinOut(t, t0 + 9 * MIN), false, 'lost twice: gone for the trip');
  // another trip: landed
  L.seaEnd(s, t0 + 10 * MIN);
  L.seaStart(s, t0 + 11 * MIN);
  assert.strictEqual(L.landFish(s, 'marlin', seq(0.5, 0.5)), 'marlin');
  assert.strictEqual(s.sea.t.mc, 1);
  assert.strictEqual(L.seaMarlinOut(s.sea.t, t0 + 17 * MIN), false, 'once a trip');
  assert.deepStrictEqual(plain(s.lastFish), { id: 'marlin', kg: 150, giant: false, record: false, sea: true });
  assert.strictEqual(s.sea.c.marlin, 1, 'the Marlin medal');
  assert.ok(C.HALL.FIRSTS.some((f) => f.key === 'sea_boss' && f.kind === 'marlin'), 'the Hall of Fame\'s first Marlin');
  assert.ok(L.hallWant(s, 'sea_boss'));
  assert.ok(!L.hallWant(s, 'sea_boss'), 'claimed once');
});

test('landing: weighed, the biggest of each kept, counted; Seaweed is a snag, not a fish; a full bag', () => {
  const s = fresh(), fish = s.stats.fish;
  L.seaStart(s, clock.ms);
  assert.strictEqual(L.landFish(s, 'tuna', seq(0.5, 0.5)), 'tuna');
  assert.strictEqual(s.lastFish.kg, 18);
  assert.strictEqual(L.landFish(s, 'tuna', seq(0.01, 1)), 'tuna');
  assert.deepStrictEqual(plain(s.lastFish), { id: 'tuna', kg: 28.8, giant: true, record: true, sea: true });
  L.landFish(s, 'tuna', seq(0.5, 0));
  assert.strictEqual(s.sea.b.tuna, 28800, 'the biggest kept');
  assert.strictEqual(s.sea.c.tuna, 3);
  assert.strictEqual(s.stats.fish, fish + 3);
  assert.strictEqual(L.countItem(s, 'tuna'), 3);
  assert.strictEqual(L.landFish(s, 'seaweed'), 'seaweed');
  assert.strictEqual(s.lastFish, null);
  assert.strictEqual(s.stats.fish, fish + 3, 'Seaweed is no fish');
  assert.strictEqual(s.sea.w, 1);
  assert.strictEqual(s.sea.t.w, 1);
  assert.strictEqual(L.seaScoop(s), 'ok');
  assert.strictEqual(L.countItem(s, 'seaweed'), 2);
  assert.strictEqual(s.sea.t.n, 3);
  // the river: as before
  L.landFish(s, 'fish_l', seq(0.5, 0.5));
  assert.deepStrictEqual(plain(s.lastFish), { id: 'fish_l', kg: 3.5, giant: false, record: false });
  // a full bag
  const f = fresh();
  for (let i = 0; i < f.inv.length; i++) if (!f.inv[i]) f.inv[i] = { id: 'stone', n: 999 };
  f.inv = f.inv.map((x) => x || { id: 'stone', n: 999 });
  assert.strictEqual(L.landFish(f, 'galunggong'), '!full');
  assert.strictEqual(L.landFish(f, 'seaweed'), '!full');
});

test('the end of a trip: the crate\'s shells into the bag (the basket when full); the trip counted', () => {
  const s = fresh();
  L.seaStart(s, clock.ms, false, () => 0.5);
  assert.strictEqual(s.sea.t.sh, 2);
  const r = L.seaEnd(s, clock.ms + 4 * MIN);
  assert.deepStrictEqual(plain(r), { fish: 0, weed: 0, shells: 2, basket: 0, marlin: false, mins: 4 });
  assert.strictEqual(L.countItem(s, 'capiz'), 2);
  assert.strictEqual(s.sea.tr, 1);
  assert.strictEqual(s.sea.cp, 2);
  assert.strictEqual(L.seaEnd(s, clock.ms), null, 'no trip, nothing');
  const f = fresh();
  L.seaStart(f, clock.ms, false, () => 0.99);
  f.inv = f.inv.map((x) => x || { id: 'stone', n: 999 });
  assert.strictEqual(L.seaEnd(f, clock.ms).basket, 3);
  assert.strictEqual(f.basket.capiz, 3);
});

test('Capiz: sells for 150, loved by Kapitana Marisol, Lola Amparo and Bea; the fish vendor buys sea fish at their price', () => {
  assert.strictEqual(C.ITEMS.capiz.sell, 150);
  ['mn_marisol', 'mn_amparo', 'mn_bea'].forEach((k) => assert.strictEqual(L.reaction(k, 'capiz'), 'love', k));
  assert.strictEqual(L.reaction('mn_tibo', 'capiz'), 'neutral');
  const s = fresh(), g = s.gold;
  L.addItem(s, 'tanigue', 3);
  assert.deepStrictEqual(plain(L.seaSell(s, 'tanigue', 2)), { ok: true, n: 2, gold: 900 });
  assert.strictEqual(s.gold, g + 900);
  assert.deepStrictEqual(plain(L.seaSell(s, 'fish_s', 1)), { why: 'item' }, 'only sea fish');
  assert.deepStrictEqual(plain(L.seaSell(s, 'tuna', 1)), { why: 'none' });
  assert.deepStrictEqual(plain(C.MNTRADE.shops.fish_vendor.items), ['fish_s', 'fish_m', 'fish_l'], 'what she sells: as before');
});

test('Kapitana Marisol\'s sea tasks: bring fish, or a Tuna over 20 kg; friendship and Gold; round again', () => {
  const s = fresh(), g = s.gold;
  assert.deepStrictEqual(plain(L.seaTaskNow(s)), { kind: 'bring', id: 'galunggong', n: 5, have: 0, ready: false });
  assert.strictEqual(L.seaTaskDo(s), 'missing');
  L.addItem(s, 'galunggong', 6);
  assert.strictEqual(L.seaTaskDo(s), 'ok');
  assert.strictEqual(L.countItem(s, 'galunggong'), 1);
  assert.strictEqual(L.friend(s, 'mn_marisol').pts, S.taskPts);
  assert.strictEqual(s.gold, g + S.taskGold);
  s.sea.ti = 3;
  assert.deepStrictEqual(plain(L.seaTaskNow(s)), { kind: 'kg', id: 'tuna', n: 20, have: 0, ready: false });
  L.landFish(s, 'tuna', seq(0.5, 0.5)); // (18 kg: not over 20)
  assert.strictEqual(L.seaTaskNow(s).ready, false);
  L.landFish(s, 'tuna', seq(0.01, 0.5)); // (a giant: 26.8 kg)
  assert.strictEqual(L.seaTaskNow(s).ready, true);
  assert.strictEqual(L.countItem(s, 'tuna'), 2);
  assert.strictEqual(L.seaTaskDo(s), 'ok');
  assert.strictEqual(L.countItem(s, 'tuna'), 2, 'a catch to show, not to give');
  s.sea.ti = S.tasks.length - 1;
  L.addItem(s, 'tuna', 3);
  L.seaTaskDo(s);
  assert.strictEqual(L.seaTask(s)[1], 'galunggong', 'round again');
});

test('friends aboard: +1 friendship once a day each', () => {
  const s = fresh(), id = 'A1B2C3D4-0000-4000-8000-000000000001';
  assert.strictEqual(L.seaFriend(s, id, 'Ana', s.day), true);
  assert.strictEqual(L.seaFriend(s, id, 'Ana', s.day), false, 'once a day');
  assert.strictEqual(L.seaFriend(s, id, 'Ana B', s.day + 1), true);
  assert.deepStrictEqual(plain(s.sea.fr), [[id.toLowerCase(), 'Ana B', 2, s.day + 2]]);
  assert.strictEqual(L.seaFriend(s, 'not-an-id', 'X', s.day), false);
  for (let i = 0; i < 40; i++) L.seaFriend(s, 'a1b2c3d4-0000-4000-8000-0000000001' + String(i).padStart(2, '0'), 'P' + i, s.day + i);
  assert.strictEqual(s.sea.fr.length, 30, 'at most 30 kept');
});

test('the five sea dishes in the Kitchen; their powers on the potions\' clocks, a new one replaces, never adds', () => {
  const want = { fried_galunggong: [['galunggong', 'rice'], 40, []], adobo_pusit_dagat: [['sea_pusit', 'garlic', 'onion'], 55, [['shots', 5]]],
    sinigang_lapu: [['lapu_lapu', 'tomato', 'radish'], 60, [['charge', 10]]], kinilaw_tuna: [['tuna', 'onion', 'ginger'], 70, [['walk', 10]]],
    inihaw_marlin: [['marlin', 'garlic', 'chili'], 150, [['charge', 10], ['walk', 10], ['shots', 10]]] };
  Object.keys(want).forEach((id) => {
    const r = C.RECIPES.find((x) => x.dish === id);
    assert.deepStrictEqual(plain(r.needs), want[id][0], id);
    assert.strictEqual(C.ITEMS[id].energy, want[id][1]);
    assert.strictEqual(C.ITEMS[id].kind, 'dish');
    assert.deepStrictEqual(plain(S.powers[id]), want[id][2]);
  });
  assert.ok(C.RECIPES.find((x) => x.dish === 'grilled_fish'), 'Grilled Fish stays');
  const s = fresh(), now = L.nowMin();
  s.energy = 10;
  L.addItem(s, 'inihaw_marlin', 1);
  L.addItem(s, 'adobo_pusit_dagat', 1);
  L.addItem(s, 'kinilaw_tuna', 1);
  const at = (id) => s.inv.findIndex((x) => x && x.id === id);
  assert.strictEqual(L.eat(s, at('inihaw_marlin')), Math.min(150, L.maxEnergy(s) - 10), '+150 energy (as far as it goes)');
  assert.deepStrictEqual([L.power(s, 'charge'), L.power(s, 'walk'), L.power(s, 'shots')], [true, true, true], 'all three');
  assert.deepStrictEqual(plain(s.ptn), { charge: now + 10, walk: now + 10, shots: now + 10 });
  clock.advance(3);
  L.eat(s, at('adobo_pusit_dagat'));
  assert.strictEqual(s.ptn.shots, now + 3 + 5, 'replaced (5 minutes from now), never added');
  assert.strictEqual(s.ptn.charge, now + 10);
  s.energy = L.maxEnergy(s);
  assert.strictEqual(L.eat(s, at('kinilaw_tuna')), -2, 'full: eaten for the power alone');
  assert.strictEqual(L.countItem(s, 'kinilaw_tuna'), 0);
  assert.strictEqual(s.ptn.walk, now + 3 + 10);
  assert.strictEqual(L.shotEnergy(s, 2), 0, 'shots cost no energy');
  L.addItem(s, 'fried_galunggong', 1);
  s.energy = 10;
  assert.strictEqual(L.eat(s, at('fried_galunggong')), Math.min(40, L.maxEnergy(s) - 10), 'no power: just energy');
});

test('Sea Fertilizer: the Mixer, 3 Seaweed + 1 Fertilizer; the best Silver and Gold odds in the game', () => {
  const mx = C.WORKSHOPS.mixer.recipes, r = mx[mx.length - 1];
  assert.deepStrictEqual(plain(r), { out: 'fert_sea', mins: 45, needs: [['seaweed', 3], ['fert', 1]] });
  assert.deepStrictEqual(plain(mx.slice(0, 4).map((x) => x.out)), ['farm_cement', 'rope', 'sili_powder', 'beeswax'], 'the Mixer\'s first four where they were');
  assert.strictEqual(L.fertOf('fert_sea'), 3);
  const q = C.QUALITY.chance;
  assert.ok(q[3][0] > q[2][0] && q[3][1] > q[2][1], 'better than Rich Fertilizer');
  q.forEach((c, i) => { if (i < 3) assert.ok(q[3][0] + q[3][1] > c[0] + c[1]); });
  const s = fresh();
  s.yard.items.push({ t: C.OUTDOOR.types.findIndex((t) => t.key === 'mixer'), x: 30, y: 20 });
  L.addItem(s, 'seaweed', 3);
  L.addItem(s, 'fert', 1);
  assert.strictEqual(L.startJob(s, 'mixer', mx.length - 1), 'ok');
  clock.advance(46);
  L.collectJobs(s, 'mixer');
  assert.strictEqual(L.countItem(s, 'fert_sea'), 1);
  // on soil: level 3, its odds
  const idx = 20 * C.FARM_W + 20;
  L.till(s, idx);
  assert.strictEqual(L.fertilize(s, [idx], s.inv.findIndex((x) => x && x.id === 'fert_sea')), 1);
  assert.strictEqual(s.soil[idx].f, 3);
  assert.deepStrictEqual(plain(L.qualityChance(s, s.soil[idx])), [0.45, 0.32]);
  assert.strictEqual(roundTrip(s).soil[idx].f, 3, 'saved');
});

test('the map: the deck 14 x 8 walkable on water you fish from; a spawn on it', () => {
  const m = L.seaMap(JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', 'pulag.json'), 'utf8')));
  assert.strictEqual(m.width, S.W);
  assert.strictEqual(m.height, S.H);
  const ts = m.tilesets.find((t) => t.name === 'tiles'), props = (gid) => ((ts.tiles || []).find((t) => t.id === gid - ts.firstgid) || {}).properties || [];
  const water = (x, y) => props(m.layers[0].data[y * m.width + x]).some((p) => p.name === 'water' && p.value);
  const solid = (x, y) => props(m.layers[0].data[y * m.width + x]).some((p) => p.name === 'collides' && p.value);
  let deck = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) { if (!water(x, y) && !solid(x, y)) deck++; else assert.ok(water(x, y) && solid(x, y)); }
  assert.strictEqual(deck, 14 * 8);
  const sp = m.layers[3].objects.find((o) => o.name === 'deck');
  assert.ok(!water(Math.floor(sp.x / 256), Math.floor(sp.y / 256)));
});

test('the server rows: the boat for Hunting now, the sea fish for the Biggest catch, the first Marlin', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'places', 'server-rows.js'), 'sea'], { encoding: 'utf8' });
  assert.match(out, /insert into farm\.hunt_maps \(map\) values \('sea'\)/);
  S.fish.forEach((f) => assert.ok(out.includes("('" + f[0] + "', " + f[5] + ')'), f[0]));
  assert.match(out, /\('sea_boss', 'the Marlin, Manila Bay'\)/);
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'docs', 'sea-trips-server-rows.sql'), 'utf8').includes(out.trim()), true, 'docs/sea-trips-server-rows.sql is up to date');
  assert.ok(C.ONLINE_MORE_MAPS.includes('sea'));
});

test('the save (\'sv\'): a trip, the book, the counts, the tasks and friends come back exactly; an old save has none; a save at sea is on the pier', () => {
  const s = fresh(), t0 = clock.ms;
  assert.strictEqual(L.serialize(s).sv, undefined, 'nothing yet, nothing saved');
  const old = plain(L.serialize(s));
  assert.deepStrictEqual(plain(roundTrip(s).sea), plain(L.seaNew()), 'an old save: a fresh sea');
  assert.strictEqual(old.gg, 3, 'save generation 3');
  L.seaStart(s, t0, false, () => 0.5);
  L.landFish(s, 'lapu_lapu', seq(0.5, 0.5));
  L.landFish(s, 'seaweed');
  L.seaMarlinLost(s, t0 + 6 * MIN);
  s.sea.ti = 4; s.sea.tk = 1; s.sea.fd = s.day + 1;
  L.seaFriend(s, 'a1b2c3d4-0000-4000-8000-000000000009', 'Bo', s.day);
  s.map = 'sea';
  s.player = { x: 2900, y: 2400, dir: 'left' };
  const o = plain(L.serialize(s)), back = L.deserialize(o);
  assert.deepStrictEqual(plain(back.sea), plain(s.sea));
  assert.strictEqual(back.map, 'manila', 'a save at sea: the pier');
  const p = L.seaPier();
  assert.deepStrictEqual([back.player.x, back.player.y], [p.x, p.y]);
  assert.strictEqual(o.gg, 3);
  // junk in a save is kept to what it can be
  const bad = L.deserialize(Object.assign(plain(o), { sv: [[-5, 99, 'x', 9], [1e12, 'x'], [-1], ['a', 1e20, -4], [['nope', 1], 7]] }));
  assert.strictEqual(bad.sea.t, null);
  assert.ok(bad.sea.b.galunggong <= 400 && bad.sea.fr.length === 0);
  assert.deepStrictEqual(plain(L.deserialize(Object.assign(plain(o), { sv: 'junk' })).sea), plain(L.seaNew()));
});
