// Unit tests for the later additions: chests past floor 150 (src/01-logic2.js), Today's Event, rare surprises, the Town
// Goal and Best Farm of the Week (src/00-zzzlater.js, src/01-logicH.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';

const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const emptyAll = (s) => { s.inv = s.inv.map(() => null); };
const fresh = (d) => { clock.set(2026, 4, d || 1, 10, 0); const s = L.newState(); s.seed = 11; return s; };

// ---------- chests past floor 150 ----------
const chestFloor = (k) => k * C.MINE.chestEvery;

test('a deep chest does not close the chests above it', () => {
  const s = fresh();
  assert.ok(L.openChest(s, chestFloor(100)).gold, 'chest 100 opens first');
  assert.strictEqual(L.chestOpened(s, chestFloor(100)), true);
  assert.strictEqual(L.chestOpened(s, chestFloor(99)), false, 'the one above it stays shut');
  assert.strictEqual(L.chestOpened(s, chestFloor(31)), false);
  assert.ok(L.openChest(s, chestFloor(99)).gold, 'and still pays');
  assert.ok(L.openChest(s, chestFloor(31)).gold);
  assert.strictEqual(s.chHi, 0, 'the old mark is left alone');
});

test('a deep chest pays once, also after a save', () => {
  const s = fresh();
  const gold = L.openChest(s, chestFloor(205)).gold;
  assert.strictEqual(gold, C.MINE.chestGold * 205);
  const before = s.gold;
  assert.strictEqual(L.openChest(s, chestFloor(205)).error, 'opened');
  const back = roundTrip(s);
  assert.strictEqual(L.openChest(back, chestFloor(205)).error, 'opened');
  assert.strictEqual(back.gold, before);
  assert.strictEqual(L.chestOpened(back, chestFloor(204)), false);
  assert.strictEqual(L.chestOpened(back, chestFloor(206)), false);
});

test('every chest is its own bit, in any order', () => {
  const s = fresh();
  const order = [];
  for (let k = 31; k <= 240; k++) order.push(k);
  order.sort((a, b) => (a * 37) % 211 - (b * 37) % 211);
  const seen = {};
  order.forEach((k) => {
    assert.strictEqual(L.chestOpened(s, chestFloor(k)), false, 'chest ' + k + ' before it is opened');
    s.gold = 0;
    s.inv = s.inv.map(() => null);
    assert.ok(L.openChest(s, chestFloor(k)).gold);
    seen[k] = 1;
    if (order.indexOf(k) % 17 === 0) {
      const back = roundTrip(s);
      for (let j = 31; j <= 240; j++) assert.strictEqual(L.chestOpened(back, chestFloor(j)), !!seen[j], 'chest ' + j);
    }
  });
  assert.strictEqual(L.chestOpened(s, chestFloor(241)), false);
});

test('an older save: its high mark still counts as opened, and past it each chest is its own', () => {
  const o = plain(L.serialize(fresh()));
  o.chh = 50;
  delete o.chb;
  const s = L.deserialize(plain(o));
  assert.strictEqual(s.chHi, 50);
  assert.strictEqual(s.chB, '');
  [31, 40, 50].forEach((k) => assert.strictEqual(L.chestOpened(s, chestFloor(k)), true, 'chest ' + k));
  assert.strictEqual(L.openChest(s, chestFloor(40)).error, 'opened', 'never pays twice');
  assert.strictEqual(L.chestOpened(s, chestFloor(51)), false);
  assert.ok(L.openChest(s, chestFloor(60)).gold);
  assert.strictEqual(L.chestOpened(s, chestFloor(51)), false, 'the new record does not close chest 51');
  const back = roundTrip(s);
  assert.strictEqual(back.chHi, 50, 'the old mark stays as it was');
  assert.strictEqual(L.chestOpened(back, chestFloor(60)), true);
  assert.strictEqual(L.chestOpened(back, chestFloor(45)), true);
  assert.strictEqual(L.chestOpened(back, chestFloor(59)), false);
});

test('the first 30 chests stay in the same number', () => {
  const s = fresh();
  L.openChest(s, chestFloor(30));
  assert.strictEqual(s.chests, 1 << 29);
  assert.strictEqual(s.chB, '');
  assert.strictEqual(plain(L.serialize(s)).chb, undefined, 'nothing new in the save until it is needed');
});

test('the save stays small with all 240 chests opened', () => {
  const none = fresh();
  const size = JSON.stringify(L.serialize(none)).length;
  const s = fresh();
  for (let k = 1; k <= 240; k++) { s.inv = s.inv.map(() => null); assert.ok(L.openChest(s, chestFloor(k)).gold); }
  const o = plain(L.serialize(s));
  assert.strictEqual(typeof o.chb, 'string');
  assert.strictEqual(o.chb.length, 42);
  assert.ok(JSON.stringify(o).length - size < 80, 'added ' + (JSON.stringify(o).length - size) + ' bytes');
  const back = L.deserialize(plain(o));
  for (let k = 1; k <= 240; k++) assert.strictEqual(L.chestOpened(back, chestFloor(k)), true, 'chest ' + k);
});

test('a broken record in a save does not load as chests', () => {
  const o = plain(L.serialize(fresh()));
  ['zz', 5, ['1'], '!'].forEach((bad) => {
    o.chb = bad;
    const s = L.deserialize(plain(o));
    assert.strictEqual(s.chB, '');
    assert.strictEqual(L.chestOpened(s, chestFloor(31)), false);
  });
});

// ---------- Today's Event ----------
// Monday 2 Nov 2026 to Sunday 8 Nov 2026
const WEEK = [[2, 'fish', 'Fish Monday'], [3, 'wood', 'Timber Tuesday'], [4, 'lucky', 'Lucky Wednesday'], [5, 'friends', 'Friendly Thursday'], [6, 'feast', 'Feast Friday'], [7, 'hunt', 'Hunter Saturday'], [8, 'gems', 'Gem Sunday']];
const onDay = (d) => { clock.set(2026, 11, d, 10, 0); const s = L.newState(); s.seed = 11; return s; };

test('Monday to Sunday: each day has its own event, from the date, and the week repeats', () => {
  WEEK.forEach(([d, key, name]) => {
    onDay(d);
    assert.strictEqual(L.eventOf().key, key);
    assert.strictEqual(L.eventOf().name, name);
    assert.ok(L.eventOf().text.length < 60, 'short: ' + L.eventOf().text);
    assert.ok(C.ICON[L.eventOf().icon] != null, name + ' has an icon');
    assert.ok(!/—/.test(L.eventOf().text));
    clock.set(2026, 11, d + 7, 23, 59);
    assert.strictEqual(L.eventOf().key, key, 'the next week, late at night');
    assert.strictEqual(L.eventOf(L.dayOf(new Date(2026, 10, d, 0, 0).getTime())).key, key, 'the same for any phone on that date');
  });
  assert.strictEqual(new Set(C.EVENTS.map((e) => e.key)).size, 7);
});

// Each bonus: does it work today? Exactly one day of the week may say yes.
const BONUS = {
  fish: () => L.instantPrice('fish_l', 4) > 4 * Math.floor(140 * L.instantShare()),
  wood: (s) => { s.debris[9] = 'branch'; const r = L.clearDebris(s, 9); assert.strictEqual(s.lumber, r.lumber); return r.lumber === 2; },
  lucky: (s) => { let n = 0; for (let f = 1; f <= 500; f++) n += L.mineFloor(s, f, tiles).spark.length; return n > 42 * 500 / 40 * 1.4; },
  friends: (s) => { L.talk(s, 'lily'); L.talk(s, 'lily'); return L.friend(s, 'lily').pts === C.FRIEND.talk * 2; },
  feast: (s) => { s.inv[0] = { id: 'bread', n: 1 }; s.energy = 10; const e = L.energyOf('bread'); return L.eat(s, 0) > e; },
  hunt: (s) => { s.inv[0] = { id: 'venison', n: 2 }; const before = s.gold, got = L.sellToKanor(s, 'venison'); assert.strictEqual(s.gold - before, got); return got > 2 * C.ITEMS.venison.sell; },
  gems: (s) => L.gemBonus(s, 50, 'gem') === 1,
};
const tiles = Array.from({ length: 132 }, (_, i) => i);

test('Monday to Sunday: each bonus works on its own day and no other', () => {
  Object.keys(BONUS).forEach((key) => {
    const days = WEEK.filter(([d]) => { const s = onDay(d); return BONUS[key](s); }).map(([, k]) => k);
    assert.deepStrictEqual(days, [key], key + ' worked on: ' + days);
  });
});

test('Fish Monday: fish only, Sell now and the shelves, 25% more', () => {
  const s = onDay(2);
  assert.strictEqual(L.instantPrice('fish_m', 1), Math.floor(Math.floor(70 * 0.75) * 1.25));
  assert.strictEqual(L.instantPrice('fish_m', 4), Math.floor(4 * Math.floor(70 * 0.75) * 1.25));
  assert.strictEqual(L.shelfPrice('fish_m', 2, 1), Math.floor(2 * Math.round(70 * 1.2) * 1.25));
  assert.strictEqual(L.instantPrice('turnip', 4), 4 * Math.max(1, Math.floor(C.ITEMS.turnip.sell * 0.75)));
  s.inv[0] = { id: 'fish_m', n: 4 };
  const before = s.gold, got = L.sellNow(s, 0, 4);
  assert.strictEqual(got, L.instantPrice('fish_m', 4) || got);
  assert.strictEqual(s.gold - before, got);
  assert.ok(got > 4 * 52);
});

test('Timber Tuesday: a stump and a big tree give 1 more, stones and weeds nothing', () => {
  const s = onDay(3);
  s.debris[1] = 'stump'; s.debris[2] = 'stone'; s.debris[3] = 'weed';
  assert.strictEqual(L.clearDebris(s, 1).lumber, 5);
  assert.strictEqual(L.clearDebris(s, 2).lumber, 0);
  assert.strictEqual(L.clearDebris(s, 3).lumber, 0);
  assert.strictEqual(s.lumber, 5);
  s.lumber = 0;
  assert.strictEqual(L.chopTree(s, 0), C.WOOD.treeLumber[0] + 1);
  assert.strictEqual(s.lumber, C.WOOD.treeLumber[0] + 1);
});

test('Friendly Thursday: only the first chat of the day, once', () => {
  const s = onDay(5);
  L.talk(s, 'hana');
  const first = L.friend(s, 'hana').pts;
  L.talk(s, 'hana');
  assert.strictEqual(L.friend(s, 'hana').pts, first, 'a second chat adds nothing');
});

test('Feast Friday: never past the bar, and a full bar still says full', () => {
  const s = onDay(6);
  s.inv[0] = { id: 'bread', n: 2 };
  s.energy = L.maxEnergy(s) - 1;
  assert.strictEqual(L.eat(s, 0), 1);
  assert.strictEqual(s.energy, L.maxEnergy(s));
  assert.strictEqual(L.eat(s, 0), -1);
});

test('Gem Sunday: the gem of that floor only, and a full bag loses nothing', () => {
  const s = onDay(8);
  assert.strictEqual(L.mineGem(50), 'gem');
  assert.strictEqual(L.mineGem(250), 'amethyst');
  assert.strictEqual(L.gemBonus(s, 250, 'amethyst'), 1);
  assert.strictEqual(L.countItem(s, 'amethyst'), 1);
  assert.strictEqual(L.gemBonus(s, 250, 'gem'), 0, 'not a gem of this cave');
  assert.strictEqual(L.gemBonus(s, 50, 'ore_gold'), 0);
  s.inv = s.inv.map(() => ({ id: 'stone_x', n: 99 }));
  assert.strictEqual(L.gemBonus(s, 50, 'gem'), 0);
});

test('no bonus reaches double income: the money ones stay small', () => {
  assert.ok(C.EVENT.fish <= 1.25 && C.EVENT.hunt <= 1.15 && C.EVENT.food <= 1.2 && C.EVENT.lumber === 1);
});

test('the pop-up: once a day, kept in the save, never on a farm\'s first day', () => {
  const s = onDay(2);
  assert.strictEqual(L.eventPopup(s), null, 'the first day belongs to the first goals');
  s.start -= 1;
  assert.strictEqual(L.eventPopup(s).key, 'fish');
  L.eventShown(s);
  assert.strictEqual(L.eventPopup(s), null);
  assert.strictEqual(L.eventPopup(roundTrip(s)), null, 'also after closing the game');
  const t = roundTrip(s);
  clock.nextDay(L, t);
  assert.strictEqual(L.eventPopup(t).key, 'wood');
});

test('an older save loads with no event record and the save grows by little', () => {
  const s = onDay(2);
  const o = plain(L.serialize(s));
  assert.strictEqual(o.es, undefined);
  assert.strictEqual(o.rr, undefined);
  const back = L.deserialize(o);
  assert.strictEqual(back.evSeen, 0);
  assert.strictEqual(back.rr, null);
});

// ---------- rare surprises ----------
test('about 1 rock in 40 sparkles, never the ladder, the same for everyone in that mine', () => {
  const tick = (d) => { let rocks = 0, spark = 0; onDay(d); for (let seed = 1; seed <= 150; seed++) for (let f = 1; f <= 40; f++) { const m = L.mineFloor({ seed: seed * 977, day: L.dayOf(L.clock()) }, f, tiles); rocks += m.rocks.length; spark += m.spark.length; assert.ok(m.spark.indexOf(m.stairs) < 0); } return spark / rocks; };
  const normal = tick(2), lucky = tick(4);
  assert.ok(normal > 0.022 && normal < 0.028, 'rate ' + normal);
  assert.ok(lucky > 0.045 && lucky < 0.055, 'lucky rate ' + lucky);
  const a = onDay(2), day = a.day;
  const m1 = L.mineFloor({ seed: 42, day }, 12, tiles), m2 = L.mineFloor({ seed: 42, day }, 12, tiles), m3 = L.mineFloor({ seed: 43, day }, 12, tiles);
  assert.deepStrictEqual(plain(m1.spark), plain(m2.spark));
  assert.strictEqual(m1.seed, 42);
  assert.notDeepStrictEqual(plain(m1.rocks), plain(m3.rocks));
});

test('a sparkling rock holds what fits its floor', () => {
  const day = 20000;
  const kinds = (floor) => { const seen = {}; for (let i = 0; i < 2000; i++) { const p = L.rockPrize(5, day, floor, i); seen[p.item ? p.item + 'x' + p.n : 'gold' + p.gold] = (seen[p.item ? p.item + 'x' + p.n : 'gold' + p.gold] || 0) + 1; } return seen; };
  assert.deepStrictEqual(Object.keys(kinds(1)).sort(), ['gold40', 'ore_copperx2']);
  assert.deepStrictEqual(Object.keys(kinds(5)).sort(), ['gold80', 'ore_silverx2']);
  assert.deepStrictEqual(Object.keys(kinds(9)).sort(), ['gold150', 'ore_goldx2']);
  const f50 = kinds(50);
  assert.deepStrictEqual(Object.keys(f50).sort(), ['gemx1', 'gold200', 'ore_goldx2']);
  assert.ok(f50.gold200 > 850 && f50.gold200 < 1150, 'half gold');
  assert.ok(f50.gemx1 > 220 && f50.gemx1 < 380, 'gems are the rare part');
  assert.deepStrictEqual(Object.keys(kinds(250)).sort(), ['amethystx1', 'crystalx2', 'gold400']);
  assert.deepStrictEqual(Object.keys(kinds(1100)).sort(), ['diamondx1', 'gold6400', 'starstonex2']);
});

test('sparkling rocks add about 15% to what rocks pay', () => {
  [50, 300, 700, 1100].forEach((floor) => {
    let g = 0;
    for (let i = 0; i < 4000; i++) { const p = L.rockPrize(5, 20000, floor, i); g += p.gold || p.n * C.ITEMS[p.item].sell; }
    let rock = 0;
    for (let i = 0; i < 20000; i++) { const id = L.mineDrop(floor, (i + 0.5) / 20000); if (id && id !== 'stone') rock += C.ITEMS[id].sell; }
    const share = (g / 4000 / 40) / (rock / 20000);
    assert.ok(share > 0.1 && share < 0.2, 'floor ' + floor + ': ' + share);
  });
});

test('a rock pays once, also after closing the game, and only so many a day', () => {
  const s = onDay(2);
  s.gold = 0;
  const r = L.claimRock(s, s.seed, 50, 7);
  assert.ok(r && (r.gold || r.item));
  assert.strictEqual(L.claimRock(s, s.seed, 50, 7), null, 'a second try pays nothing');
  assert.strictEqual(L.rockOpen(s, s.seed, 50, 7), false);
  const back = roundTrip(s);
  assert.strictEqual(L.claimRock(back, s.seed, 50, 7), null, 'nor after a reload');
  assert.ok(L.claimRock(back, s.seed, 51, 7), 'the same tile on another floor is another rock');
  assert.ok(L.claimRock(back, s.seed + 1, 50, 7), 'and in a friend\'s mine too');
  let n = back.rr.got.length;
  for (let i = 100; n < C.RARE.rockDay; i++, n++) assert.ok(L.claimRock(back, s.seed, 60, i));
  assert.strictEqual(L.claimRock(back, s.seed, 61, 1), null, 'the day\'s limit');
  assert.strictEqual(L.rockOpen(back, s.seed, 61, 1), false);
  const t = roundTrip(back);
  assert.strictEqual(t.rr.got.length, C.RARE.rockDay);
  clock.nextDay(L, t);
  assert.strictEqual(L.rockOpen(t, s.seed, 50, 7), true, 'tomorrow is new');
  assert.strictEqual(plain(L.serialize(t)).rr, undefined, 'yesterday is not saved');
});

test('a full bag still gets a rock\'s worth, as gold', () => {
  const s = onDay(2);
  s.inv = s.inv.map(() => ({ id: 'lumber_x', n: C.MAX_STACK }));
  s.gold = 0;
  let found = 0;
  for (let i = 0; i < 40 && !found; i++) {
    const p = L.rockPrize(s.seed, s.day, 50, i);
    if (!p.item) continue;
    found = 1;
    const r = L.claimRock(s, s.seed, 50, i);
    assert.strictEqual(r.item, null);
    assert.strictEqual(s.gold, p.n * C.ITEMS[p.item].sell);
  }
  assert.ok(found);
});

const ripeTile = (crop) => { const t = { c: crop, p: 0, w: 0, r: 0 }; t.p = L.nowMin() - L.growMins(t); return t; };

test('about 1 harvest in 100 is golden, and worth several times normal', () => {
  const count = (d) => { const s = onDay(d); let n = 0; for (let i = 0; i < 40000; i++) { s.soil = {}; s.soil[i] = ripeTile('turnip'); if (L.goldenTile(s, i)) n++; } return n / 40000; };
  const normal = count(2), lucky = count(4);
  assert.ok(normal > 0.008 && normal < 0.012, 'rate ' + normal);
  assert.ok(lucky > 0.017 && lucky < 0.023, 'lucky rate ' + lucky);
  const s = onDay(2);
  let idx = 0;
  for (; ; idx++) { s.soil = {}; s.soil[idx] = ripeTile('tomato'); if (L.goldenTile(s, idx)) break; }
  s.gold = 0;
  L.takeGolden();
  assert.strictEqual(L.harvest(s, idx), 'tomato');
  const pay = C.ITEMS.tomato.sell * C.RARE.cropPay;
  assert.ok(C.RARE.cropPay >= 4);
  assert.strictEqual(s.gold, pay);
  assert.deepStrictEqual(plain(L.takeGolden()), [{ idx, item: 'tomato', gold: pay }]);
  assert.strictEqual(L.countItem(s, 'tomato'), 1, 'the crop too');
  assert.strictEqual(s.soil[idx].c, null, 'once');
});

test('a golden crop stays golden through a save, and only a ripe crop can be', () => {
  const s = onDay(2);
  let idx = 0;
  for (; ; idx++) { s.soil = {}; s.soil[idx] = ripeTile('tomato'); if (L.goldenTile(s, idx)) break; }
  assert.strictEqual(L.goldenTile(roundTrip(s), idx), true);
  s.soil[idx].p = L.nowMin() + 5;
  assert.strictEqual(L.goldenTile(s, idx), false, 'not ripe yet');
  assert.strictEqual(L.goldenTile(s, idx + 1), false, 'bare ground');
  const v = onDay(2);
  v.isVisit = true;
  v.soil[idx] = ripeTile('tomato');
  assert.strictEqual(L.goldenTile(v, idx), false, 'nothing golden on a friend\'s farm');
  const g = onDay(2);
  let sickle = 0;
  for (let i = 0; i < 2000; i++) { g.soil = {}; g.soil[i] = ripeTile('grass'); if (L.goldenTile(g, i)) sickle++; }
  assert.strictEqual(sickle, 0, 'grass is never golden');
});

// ---------- the Town Goal and Best Farm of the Week (what comes back from the server is checked) ----------
const GOAL = { kind: 'crop', target: 1000, total: 40, givers: 3, mine: 12, left_today: 28, min: 10, gold: 1000, stars: 1, ends_in: 90000, can_give: true };

test('the goal reads what the server says, and nothing usable means nothing shows', () => {
  const t = L.townRead(GOAL);
  assert.deepStrictEqual(plain(t), { kind: 'crop', target: 1000, total: 40, givers: 3, mine: 12, leftToday: 28, min: 10, gold: 1000, stars: 1, endsIn: 90000, canGive: true });
  [null, undefined, 'x', 5, {}, { kind: 'gems', target: 5 }, { kind: 'crop' }, { kind: 'crop', target: 0 }, { kind: 'ore', target: -3 }].forEach((bad) => assert.strictEqual(L.townRead(bad), null));
  const odd = L.townRead(Object.assign({}, GOAL, { total: 'lots', mine: -5, gold: 1e9, stars: 1e9, left_today: null }));
  assert.deepStrictEqual([odd.total, odd.mine, odd.gold, odd.stars, odd.leftToday], [0, 0, C.TOWN.maxGold, C.TOWN.maxStars, 0]);
  assert.strictEqual(L.townRead(Object.assign({}, GOAL, { can_give: false })).canGive, false);
});

test('what can be given: that week\'s kind from the bag, one line each, cheapest first', () => {
  const s = fresh();
  emptyAll(s);
  s.inv[0] = { id: 'tomato', n: 3 };
  s.inv[1] = { id: 'turnip', n: 2 };
  s.inv[2] = { id: 'turnip', n: 5 };
  s.inv[3] = { id: 'ore_gold', n: 4 };
  s.inv[4] = { id: 'gem', n: 1 };
  s.inv[5] = { id: 'hoe', n: 1 };
  assert.deepStrictEqual(plain(L.townItems(s, 'crop')), [{ id: 'turnip', n: 7 }, { id: 'tomato', n: 3 }]);
  assert.deepStrictEqual(plain(L.townItems(s, 'ore')), [{ id: 'ore_gold', n: 4 }, { id: 'gem', n: 1 }]);
  const t = L.townRead(GOAL);
  assert.strictEqual(L.townStep(t, 60), 10);
  assert.strictEqual(L.townStep(t, 7), 7);
  assert.strictEqual(L.townStep(Object.assign({}, t, { leftToday: 3 }), 60), 3);
});

test('the bag gives up only what the server took', () => {
  const s = fresh();
  emptyAll(s);
  s.inv[0] = { id: 'turnip', n: 20 };
  assert.strictEqual(L.townPaid(s, 'turnip', 10, 4), 4, 'it took fewer');
  assert.strictEqual(L.countItem(s, 'turnip'), 16);
  assert.strictEqual(L.townPaid(s, 'turnip', 10, 500), 10, 'a wild answer never takes more than was asked');
  assert.strictEqual(L.townPaid(s, 'turnip', 10, 'x'), 0);
  assert.strictEqual(L.countItem(s, 'turnip'), 6);
});

test('a claim pays what a prize can be, and four weeks at most', () => {
  const s = fresh();
  s.gold = 0; s.stars = 0;
  const list = L.claimRead([{ gold: 1000, stars: 1 }, { gold: 1e9, stars: 1e9 }, null, 'x', { gold: -5, stars: -1 }, { gold: 'a' }], C.TOWN.maxGold, C.TOWN.maxStars);
  assert.deepStrictEqual(plain(list), [{ gold: 1000, stars: 1 }, { gold: 1000, stars: 1 }]);
  assert.strictEqual(L.payClaims(s, list), 2);
  assert.deepStrictEqual([s.gold, s.stars], [2000, 2]);
  assert.deepStrictEqual(plain(L.claimRead(null, 1000, 1)), []);
  assert.strictEqual(L.claimRead(Array(9).fill({ gold: 1000, stars: 1 }), 1000, 1).length, 4);
});

test('best farm: a name from the server is cleaned, and an empty week is fine', () => {
  const b = L.bestRead({ last: { id: 'abc', farm_name: 'Apple  Acres', likes: 12 }, top: 3, mine: 1, gold: 5000, stars: 5 });
  assert.strictEqual(b.last.id, 'abc');
  assert.strictEqual(b.last.likes, 12);
  assert.ok(b.last.name.length <= 24);
  assert.deepStrictEqual([b.gold, b.stars, b.top, b.mine], [5000, 5, 3, 1]);
  assert.strictEqual(L.bestRead({ last: null, gold: 5000, stars: 5 }).last, null);
  assert.strictEqual(L.bestRead({ last: { farm_name: 'No id' } }).last, null);
  assert.strictEqual(L.bestRead(null), null);
  assert.strictEqual(L.bestRead({ gold: 1e9 }).gold, C.TOWN.bestGold);
});

test('nothing about the town is written to the save', () => {
  const s = fresh();
  const keys = Object.keys(plain(L.serialize(s)));
  ['town', 'tg', 'best'].forEach((k) => assert.ok(keys.indexOf(k) < 0));
  assert.strictEqual(C.SAVE_VERSION, plain(L.serialize(s)).v);
});

test('v2.1 names what is live, the two server features included now the script is applied', () => {
  const news = C.NEWS.filter((n) => n.v === '2.1')[0];
  assert.ok(news, 'v2.1 is still listed');
  const titles = news.lines.map((l) => l[1]);
  ['No more lost chests', "Today's Event", 'Rare surprises', 'Town Goal', 'Best Farm of the Week'].forEach((t) => assert.ok(titles.indexOf(t) >= 0, t));
  news.lines.forEach((l) => { assert.ok(C.ICON[l[0]] != null, l[1]); assert.ok(!/—/.test(l[2])); });
});

test('v2.11 is the newest (your buildings are back, 8 Nov 2026), v2.10 friends\' arrows hit, v2.9 the Great Mammoth for everyone, v2.8 friends meet in dungeons, v2.7 chat with everyone in a hunting place, v2.6 hunt with everyone, v2.5 gear stars, v2.4 Central Park, v2.3 has a storage in every cabinet, v2.2 the Tailor Shop and playing together, every line with a real icon, the tours behind Show me', () => {
  assert.strictEqual(C.NEWS[0].v, '2.11');
  assert.strictEqual(C.NEWS_LATEST, '2.11');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[0].lines.map((l) => l[1]))), ['Your buildings are back', 'Faster eggs and milk', 'Animals work while you are away', 'Greenhouse on your new land']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[1].lines.map((l) => l[1]))), ['Friends\' arrows hit', 'Smoother players', 'Friend requests reach you']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[2].lines.map((l) => l[1]))), ['The Great Mammoth for everyone', 'Online opens at once', 'Villagers stand apart']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[3].lines.map((l) => l[1]))), ['Friends meet in dungeons', 'Who is hunting here', 'Fair hunting for everyone', 'Follow a friend', 'Smoother and neater']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[4].lines.map((l) => l[1]))), ['Chat with everyone', 'Smoother hunting together', 'Hunts with friends']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.NEWS[5].lines.map((l) => l[1]))), ['Hunt with everyone', 'Medal frames', 'Smoother dungeons with friends']);
  const news = C.NEWS.filter((n) => n.v === '2.3')[0];
  assert.ok(news.lines.some((l) => l[1] === 'Every cabinet, its own storage'));
  const titles = C.NEWS.filter((n) => n.v === '2.2')[0].lines.map((l) => l[1]);
  ['The Tailor Shop', 'Play together', 'Reactions', 'Big moments'].forEach((t) => assert.ok(titles.indexOf(t) >= 0, t));
  C.NEWS.forEach((n) => n.lines.forEach((l) => { assert.ok(C.ICON[l[0]] != null, l[1]); assert.ok(!/—/.test(l[2]), l[1]); }));
  const tours = [].concat(...C.NEWS.map((n) => n.lines.filter((l) => l[3]).map((l) => l[3])));
  assert.deepStrictEqual(tours.sort(), ['ads', 'bh', 'breeds', 'contest', 'derby', 'double', 'event', 'farmhands', 'friends', 'gear', 'gear_slots', 'gear_stars', 'greenhouse', 'hall', 'hunt_dog', 'hunt_open', 'hunt_together', 'jeep', 'lair', 'land', 'medals', 'mine', 'nb', 'park', 'photo', 'play_together', 'players', 'quality', 'raid', 'rank', 'rare', 'skills', 'sprinkler', 'station', 'tailor', 'tame', 'town']);
});
