// Unit tests for the deeper Mine (src/00-zzmine.js, src/01-logicF.js): the bands, what rocks drop and pay, chests, the
// energy bar, the lift's stops, Saffron, badges, and that the first 200 floors and old saves stay as they were.
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

const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const NEW = ['crystal', 'amethyst', 'jade', 'emerald', 'obsidian', 'ruby', 'moonstone', 'sapphire', 'starstone', 'diamond'];
const average = (floor) => {
  let g = 0;
  for (let i = 0; i < 20000; i++) { const id = L.mineDrop(floor, (i + 0.5) / 20000); if (id && id !== 'stone') g += C.ITEMS[id].sell; }
  return g / 20000;
};

test('the six bands start at the agreed floors, and past 1,200 it stays the Star Core', () => {
  assert.deepStrictEqual(Array.from(C.MINE.bands, (b) => b.from), [1, 201, 401, 601, 801, 1001]);
  assert.deepStrictEqual([1, 200, 201, 400, 401, 600, 601, 800, 801, 1000, 1001, 1200, 5000].map(L.mineBand), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
});

test('prices double each band and a rock is worth the agreed average', () => {
  assert.deepStrictEqual(NEW.map((id) => C.ITEMS[id].sell), [300, 800, 600, 1600, 1200, 3200, 2400, 6400, 4800, 12800]);
  assert.deepStrictEqual([100, 300, 500, 700, 900, 1100].map((f) => Math.round(average(f))), [44, 87, 171, 342, 684, 1368]);
});

test('floors 1 to 200 drop exactly what they always did', () => {
  [1, 3, 4, 7, 8, 9, 10, 199, 200].forEach((floor) => {
    for (let i = 0; i < 1000; i++) {
      const r = (i + 0.5) / 1000, want = (() => { let acc = 0; for (const d of C.MINE.drops) { if (floor < (d.minFloor || 0)) continue; acc += d.p; if (r < acc) return d.id; } return null; })();
      assert.strictEqual(L.mineDrop(floor, r), want);
    }
  });
  assert.strictEqual(L.mineEnergy(fresh(), 1000), L.mineEnergy(fresh(), 1) + 200, 'rock energy stays as it was');
});

test('each band keeps the stone, drops its cheapest ore and adds its own', () => {
  assert.strictEqual(L.mineDrop(250, 0.1), 'stone');
  assert.strictEqual(L.mineDrop(250, 0.5), 'ore_silver');
  assert.strictEqual(L.mineDrop(250, 0.7), 'ore_gold');
  assert.strictEqual(L.mineDrop(250, 0.8), 'crystal');
  assert.strictEqual(L.mineDrop(250, 0.86), 'amethyst');
  assert.strictEqual(L.mineDrop(250, 0.9), null);
  assert.strictEqual(L.mineDrop(9000, 0.86), 'diamond');
});

test('chests pay the same gold, once, with the band\'s gem from floor 201 down', () => {
  const s = fresh();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.openChest(s, 25).items)), [['gem', 1], ['ore_gold', 2]]);
  const r = L.openChest(s, 205);
  assert.strictEqual(r.gold, 300 * 41);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.items)), [['amethyst', 1], ['ore_gold', 2]]);
  assert.strictEqual(L.openChest(s, 205).error, 'opened');
  const back = roundTrip(s);
  assert.strictEqual(L.openChest(back, 205).error, 'opened', 'also after a save: going back by the lift pays nothing');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.openChest(s, 1005).items)), [['diamond', 1], ['ore_gold', 2]]);
});

test('the bar grows by 10 for each band first reached, comes from the deepest floor, and stays after a save', () => {
  const s = fresh(), base = L.maxEnergy(s);
  assert.strictEqual(base, C.MAX_ENERGY);
  [[200, 0], [201, 10], [401, 20], [601, 30], [801, 40], [1001, 50], [5000, 50]].forEach(([deep, extra]) => {
    s.stats.deepest = deep;
    assert.strictEqual(L.maxEnergy(s), base + extra, 'floor ' + deep);
  });
  s.energy = 150;
  const back = roundTrip(s);
  assert.strictEqual(L.maxEnergy(back), base + 50);
  assert.strictEqual(back.energy, 150, 'the extra energy itself is kept');
  assert.strictEqual(L.regenEvery(s), C.ENERGY_EVERY, 'it comes back no faster');
});

test('the lift stops at the first floor of each band you reached', () => {
  const s = fresh();
  assert.deepStrictEqual(Array.from(L.liftStops(s)), [1]);
  s.stats.deepest = 200;
  assert.deepStrictEqual(Array.from(L.liftStops(s)), [1]);
  s.stats.deepest = 450;
  assert.deepStrictEqual(Array.from(L.liftStops(s)), [1, 201, 401]);
});

test('every new thing can be sold, Saffron buys them, and her wanted list stays what anyone can bring', () => {
  const s = fresh();
  NEW.forEach((id) => { assert.ok(L.basePrice(id) > 0); assert.ok(C.TRADER.buys.includes(id)); assert.ok(C.COLLECTION.includes(id)); });
  for (let d = 0; d < 60; d++) { s.day += 1; L.traderWanted(s).forEach((id) => assert.ok(!NEW.includes(id), id)); }
  L.addItem(s, 'diamond', 2);
  const gold = s.gold;
  const paid = L.traderSell(s, 'diamond', 2);
  assert.strictEqual(paid, Math.round(12800 * C.TRADER.pay) * 2);
  assert.strictEqual(s.gold, gold + paid);
  L.addItem(s, 'ruby', 1);
  const slot = s.inv.findIndex((x) => x && x.id === 'ruby');
  assert.ok(L.sellNow(s, slot, 1) > 0, 'the shipping box takes it');
});

test('old saves keep their collection, and the new icons sit at the end of the sheet', () => {
  assert.deepStrictEqual(NEW.map((id) => C.ICON_ORDER.indexOf(id)), NEW.map((_, i) => 243 + i));
  const i = C.COLLECTION.indexOf('crystal');
  assert.ok(i > C.COLLECTION.indexOf('meat_labuyo'), 'after everything that was already saved');
  assert.strictEqual(C.COLLECTION.length - i, NEW.length);
});

test('a badge for each band', () => {
  const s = fresh(), from = 20;
  assert.strictEqual(C.ACHIEVEMENTS.length, 25);
  assert.strictEqual(L.achReady(s, from), false);
  s.stats.deepest = 201;
  assert.strictEqual(L.achReady(s, from), true);
  const stars = s.stars;
  L.claimAch(s, from);
  assert.strictEqual(s.stars, stars + 2);
  assert.ok(L.achDone(roundTrip(s), from));
  assert.strictEqual(L.achReady(s, 24), false);
});
