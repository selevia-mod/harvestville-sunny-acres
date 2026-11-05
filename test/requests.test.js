// Unit tests for the players' suggestions (src/01-logicG.js, src/01-logicC.js): wood that comes back, the forest's trees,
// rod upgrades, digging up a crop, a Power-Up's minutes, and moving part of a stack in storage.
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

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const FARM = L.farmInfo(MAP);
const W = C.FARM_W;
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; s.gold = 1e6; L.takeNotes(); return s; };
const kinds = (s) => Object.values(s.debris).reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {});
const inMeadow = (idx) => { const x = idx % W, y = Math.floor(idx / W), m = C.WOOD.meadow; return x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1; };

test('each new day drops branches and a stump in the meadow, up to the cap, never on a yard piece or a wall', () => {
  const s = fresh();
  const walls = MAP.layers.filter((l) => l.name === 'Walls')[0].data;
  assert.ok(!Object.keys(s.debris).some(inMeadow), 'none at the start');
  s.yard.items.push({ t: C.OUTDOOR.index.planter, x: 26, y: 10 });
  clock.set(2026, 4, 2, 10, 0);
  L.catchUp(s, L.clock());
  const first = Object.keys(s.debris).filter(inMeadow);
  assert.strictEqual(first.length, C.WOOD.branches + C.WOOD.stumps);
  first.forEach((idx) => assert.strictEqual(walls[idx], 0));
  for (let d = 3; d <= 9; d++) { clock.set(2026, 4, d, 10, 0); L.catchUp(s, L.clock()); }
  const all = Object.keys(s.debris).filter(inMeadow);
  assert.strictEqual(all.length, C.WOOD.cap, 'it does not pile up');
  assert.ok(!all.includes(String(10 * W + 26)), 'not under the planter');
});

test('a piece put on a branch takes the branch away', () => {
  const s = fresh(), t = C.OUTDOOR.index.planter;
  s.debris[12 * W + 26] = 'branch';
  s.yard.bag[t] = 2;
  assert.strictEqual(typeof L.placeYard(s, FARM, t, 26, 12), 'number');
  assert.strictEqual(s.debris[12 * W + 26], undefined);
});

test('the forest: 5 big trees a day, each once, for energy and lumber; a better Axe gets more; the save keeps it', () => {
  const s = fresh();
  s.energy = 100;
  const before = s.lumber;
  assert.strictEqual(L.chopTree(s, 0), 2);
  assert.strictEqual(s.lumber, before + 2);
  assert.ok(s.energy < 100);
  assert.strictEqual(L.chopTree(s, 0), 'cut');
  assert.strictEqual(roundTrip(s).wd.mask, 1);
  s.tools.axe = 2;
  assert.strictEqual(L.chopTree(s, 1), 3);
  [2, 3, 4].forEach((i) => assert.strictEqual(typeof L.chopTree(s, i), 'number'));
  assert.strictEqual(L.treesLeft(s), 0);
  assert.strictEqual(L.chopTree(s, 5), 'done');
  s.day += 1;
  assert.strictEqual(L.treesLeft(s), 5, 'a new day');
  assert.strictEqual(L.treeCut(s, 0), false);
  const tired = fresh();
  tired.energy = 0;
  assert.strictEqual(L.chopTree(tired, 0), 'tired');
});

test('the rod upgrades at the forge with gold and ore, and the save keeps it', () => {
  const s = fresh();
  assert.strictEqual(L.upgradeRod(s), 'ore');
  L.addItem(s, 'ore_copper', 5);
  assert.strictEqual(L.upgradeRod(s), 'ok');
  assert.strictEqual(s.gold, 1e6 - 1000);
  assert.strictEqual(L.countItem(s, 'ore_copper'), 0);
  assert.strictEqual(L.itemName(s, 'rod'), 'Copper Rod');
  assert.strictEqual(roundTrip(s).rod, 1);
  s.rod = 3;
  assert.strictEqual(L.upgradeRod(s), 'max');
  assert.strictEqual(L.rodCost(s), null);
  assert.strictEqual(L.deserialize(Object.assign(JSON.parse(JSON.stringify(L.serialize(s))), { rl: 99 })).rod, 3, 'bad numbers stay in range');
  assert.strictEqual(L.rodLevel(fresh()), 0);
});

test('a growing crop can be dug up, leaving the soil; a ripe one is harvested instead', () => {
  const s = fresh(), idx = 12 * W + 5;
  s.soil[idx] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
  assert.strictEqual(L.digUp(s, idx), 'ok');
  assert.ok(s.soil[idx] && !s.soil[idx].c, 'the soil stays');
  assert.strictEqual(L.digUp(s, idx), 'none');
  s.soil[idx] = { w: 0, c: 'turnip', p: L.nowMin() - C.CROPS.turnip.mins, r: 0 };
  assert.strictEqual(L.digUp(s, idx), 'none');
  assert.strictEqual(L.digUp(s, 1), 'none');
});

test('a Power-Up says how many minutes it has left, past midnight too', () => {
  const s = fresh();
  assert.strictEqual(L.powerUpLeft(s), 0);
  L.addItem(s, 'power_up', 1);
  L.usePowerUp(s, s.inv.findIndex((x) => x && x.id === 'power_up'));
  assert.strictEqual(L.powerUpLeft(s), C.POWER_UP.minutes);
  s.time += 30;
  assert.strictEqual(L.powerUpLeft(s), C.POWER_UP.minutes - 30);
  s.pwr = { day: s.day, until: 24 * 60 + 60 };
  s.day += 1;
  s.time = 15;
  assert.strictEqual(L.powerUpLeft(s), 45);
});

test('free refills from Invite Friends: one at a time, the whole 100 on top (5 Nov 2026), kept in the save', () => {
  const s = fresh();
  s.rf = 3;
  s.energy = 0;
  assert.strictEqual(L.useFreeRefill(s), C.FREE_REFILL);
  assert.strictEqual(s.rf, 2);
  assert.strictEqual(L.useFreeRefill(s), C.FREE_REFILL, 'at full energy too: on top');
  assert.strictEqual(s.energy, 200);
  s.energy = C.ENERGY_MOST - 50;
  assert.strictEqual(L.useFreeRefill(s), 0, 'never past the most');
  assert.strictEqual(s.rf, 1, 'none used');
  assert.strictEqual(roundTrip(s).rf, 1);
  assert.strictEqual(roundTrip(s).energy, C.ENERGY_MOST - 50, 'energy past the max survives a save');
  assert.strictEqual(L.serialize(fresh()).rf, undefined);
  assert.strictEqual(L.refillsLeft(L.deserialize(Object.assign(JSON.parse(JSON.stringify(L.serialize(s))), { rf: -5 }))), 0);
});

test('storage: move part of a stack both ways, and arrange the box', () => {
  const s = fresh();
  s.inv[8] = { id: 'carrot', n: 40 };
  assert.strictEqual(L.storeIn(s, 8, 10), 10);
  assert.strictEqual(s.inv[8].n, 30);
  assert.deepStrictEqual({ ...s.store[0] }, { id: 'carrot', n: 10 });
  assert.strictEqual(L.storeIn(s, 8, 99), 30, 'no more than there is');
  assert.strictEqual(s.inv[8], null);
  assert.strictEqual(L.storeOut(s, 0, 1), 1);
  assert.strictEqual(s.store[0].n, 39);
  assert.strictEqual(L.moveStore(s, 0, 4), 'ok');
  assert.strictEqual(s.store[0], null);
  s.store[1] = { id: 'potato', n: 2 };
  assert.strictEqual(L.moveStore(s, 1, 4), 'ok', 'a swap');
  assert.strictEqual(s.store[4].id, 'potato');
  assert.strictEqual(s.store[1].id, 'carrot');
  assert.strictEqual(L.moveStore(s, 1, 1), 'same');
  assert.strictEqual(L.moveStore(s, 0, 1), 'empty');
  s.store[2] = { id: 'carrot', n: 1 };
  assert.strictEqual(L.moveStore(s, 2, 1), 'ok', 'stacked');
  assert.strictEqual(s.store[1].n, 40);
  assert.strictEqual(s.store[2], null);
});
