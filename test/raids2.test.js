// Farm Raids step 2: real raids between players (docs/raids-step2.md): the rules the phone and the game server share
// (src/01-logicZZZZZZZZZZZZ-raids2.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
require('./clock')(ctx).set(2026, 11, 9, 10, 0);
const { Config: C, Logic: L } = ctx.window.Farm;
const R = C.FRAID;
const plain = (v) => JSON.parse(JSON.stringify(v));

// a 20 x 14 farm: 20 ripe crop tiles in two rows, eggs, the stall's goods and its coins at the door
const copy = () => {
  const w = 20, h = 14, loot = [];
  for (let i = 0; i < 20; i++) loot.push({ kind: 'crops', x: 4 + (i % 10), y: 6 + Math.floor(i / 10), n: 1 });
  loot.push({ kind: 'produce', x: 16, y: 3, n: 6 }, { kind: 'gold', x: 10, y: 2, n: 300 }, { kind: 'stall', x: 12, y: 2, n: 20 });
  const farm = { w, h, solid: '0'.repeat(w * h), defs: [{ t: 'dog', x: 10, y: 4, lv: 1 }], loot };
  farm.drop = L.frDropCells(farm);
  return farm;
};

test("a raid's farm: only its share of the loot (by power), the same crops from the same seed", () => {
  const c = copy();
  assert.strictEqual(L.frCopyValue(c), 20 * R.lootValue.crops + 6 * R.lootValue.produce + 300 * R.lootValue.gold + 20 * R.lootValue.stall);
  const f = L.frRealFarm(c, 0.2, 77);
  assert.strictEqual(f.loot.filter((p) => p.kind === 'crops').length, 4, '20% of 20 crop tiles');
  assert.deepStrictEqual(plain(f.loot.filter((p) => p.kind !== 'crops').map((p) => [p.kind, p.n])), [['produce', 2], ['gold', 60], ['stall', 4]]);
  assert.deepStrictEqual(plain(L.frRealFarm(c, 0.2, 77)), plain(f), 'the same seed: the same farm');
  assert.notDeepStrictEqual(plain(L.frRealFarm(c, 0.2, 78).loot.slice(0, 4)), plain(f.loot.slice(0, 4)), 'another seed: other crops');
  assert.ok(L.frCopyValue(f) <= Math.ceil(L.frCopyValue(c) * 0.2) + R.lootValue.crops + R.lootValue.produce + R.lootValue.stall, 'about its share');
  assert.strictEqual(L.frRealFarm(c, 0, 1).loot.length, 0, 'no share: nothing to take');
});

test('a real battle replays the same (the server checks it) and says what was taken, cell by cell', () => {
  const f = L.frRealFarm(copy(), 0.3, 5), army = { goat: { n: 8, lv: 2 }, crow: { n: 2, lv: 1 } };
  const b = L.frStart(f, army, 5);
  let i = 0;
  for (let y = 0; y < f.h && i < 8; y++) for (let x = 0; x < f.w && i < 8; x++) if (L.frDrop(b, 'goat', x, y)) i++;
  while (!b.end) L.frStep(b);
  const t = L.frTaken(b);
  assert.ok(t.value > 0 && t.items.length > 0, 'something taken');
  assert.strictEqual(t.items.reduce((s, it) => s + it[3] * R.lootValue[it[0]], 0), t.value);
  const again = L.frReplay(L.frRealFarm(copy(), 0.3, 5), army, 5, b.moves);
  assert.deepStrictEqual(plain(L.frTaken(again)), plain(t), 'the replay takes the same');
  assert.strictEqual(L.frStars(again), L.frStars(b));
});

test('an army a camp could hold: known raiders, whole numbers, levels 1-5, within the biggest camp', () => {
  assert.ok(L.frArmyOk({ goat: { n: 4, lv: 1 }, crow: { n: 3, lv: 2 } }));
  assert.ok(!L.frArmyOk({ goat: { n: 4, lv: 6 } }), 'level 6');
  assert.ok(!L.frArmyOk({ dragon: { n: 1, lv: 1 } }), 'no such raider');
  assert.ok(!L.frArmyOk({ goat: { n: 1.5, lv: 1 } }), 'half a goat');
  assert.ok(!L.frArmyOk({ goat: { n: 9999, lv: 1 } }), 'more than any camp holds');
  assert.ok(!L.frArmyOk(null));
});

test("the defender's loss: the crops still ripe there, eggs and milk, stall goods and its coins; never twice", () => {
  const s = L.newState(), w = 40;
  s.soil[6 * w + 4] = { c: 'turnip', w: 1, r: 0 }; s.soil[6 * w + 4].p = L.nowMin() - L.growMins(s.soil[6 * w + 4]) - 1; // (just ripe)
  s.soil[6 * w + 5] = { c: 'turnip', p: L.nowMin(), w: 1, r: 0 }; // (not ripe any more: replanted since)
  L.addAnimal(s, 'chicken', false); L.addAnimal(s, 'cow', false);
  s.animals.forEach((a) => { a.young = false; a.ready = 1; });
  s.shelves[0] = { id: 'turnip', n: 10, left: 30 };
  s.shelves[1] = { id: 'egg', n: 5, left: 0, coins: 200 };
  const taken = { w, items: [['crops', 4, 6, 1], ['crops', 5, 6, 1], ['produce', 16, 3, 1], ['stall', 12, 2, 4], ['gold', 10, 2, 150]] };
  assert.ok(L.isRipe(s.soil[6 * w + 4]));
  const lost = L.frLoss(s, taken, w);
  assert.deepStrictEqual(plain(lost), { crops: 1, produce: 1, stall: 4, gold: 150 });
  assert.ok(!s.soil[6 * w + 4].c, 'the ripe one is gone');
  assert.strictEqual(s.soil[6 * w + 5].c, 'turnip', 'the young one stays');
  assert.strictEqual(s.shelves[0].n, 6);
  assert.strictEqual(s.shelves[1].coins, 50);
  assert.deepStrictEqual(plain(L.frLoss(s, { w, items: [['gold', 10, 2, 999]] }, w)), { crops: 0, produce: 0, stall: 0, gold: 50 }, 'never more than is there');
  assert.strictEqual(s.shelves[1], null, 'a sold shelf with no coins left is empty');
});

test("the attacker's prize: Gold and Raid Points", () => {
  const s = L.newState(), g = s.gold;
  L.frWin(s, 467, 50);
  assert.strictEqual(s.gold, g + 467);
  assert.strictEqual(L.frState(s).pts, 50);
  L.frWin(s, -5, 'x');
  assert.strictEqual(s.gold, g + 467, 'nothing odd counts');
});

test('what a farm has out in the open, for its copy', () => {
  const s = L.newState();
  s.shelves[0] = { id: 'turnip', n: 10, left: 30 };
  s.shelves[1] = { id: 'egg', n: 5, left: 0, coins: 200 };
  L.addAnimal(s, 'chicken', false);
  s.animals.forEach((a) => { a.young = false; a.ready = 2; });
  assert.strictEqual(L.frStallLoot(s), 10);
  assert.strictEqual(L.frGoldPot(s), 200);
  assert.strictEqual(L.frProduceLoot(s), 2 * s.animals.length);
});
