// Unit tests for outdoor decorations: where the farm map lets you build, buying, placing, moving, storing,
// fences that join up, keeping every door reachable, beauty, the save, and older saves on the wider farm.
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
L.weather = () => 'sunny';

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const FARM = L.farmInfo(MAP);
const O = C.OUTDOOR, ix = O.index;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { const s = L.newState(); s.seed = 11; s.gold = 1e6; return s; };

test('the farm is 38 wide and the save says so; the meadow is free to build on, the field and buildings are not', () => {
  assert.strictEqual(MAP.width, C.FARM_W);
  const free = (x, y) => !FARM.noPlace[y * FARM.w + x];
  assert.ok(free(28, 15) && free(24, 30), 'the meadow');
  assert.ok(!free(10, 15), 'the field');
  assert.ok(!free(6, 4), 'the house');
  assert.ok(!free(5, 31), 'the pen');
  assert.ok(!free(11, 37) && !free(0, 10), 'the road and the edge');
  assert.ok(FARM.start >= 0 && L.yardReachable(FARM, []), 'everything reachable to begin with');
});

test('a new farm starts with a few pieces in storage; buying adds more, festival ones only in season', () => {
  const s = fresh();
  assert.strictEqual(s.yard.bag[ix.wood_fence], 8);
  assert.strictEqual(L.buyYard(s, ix.stone_path, 10), 'ok');
  assert.strictEqual(s.yard.bag[ix.stone_path], 10);
  assert.strictEqual(s.gold, 1e6 - 300);
  s.day = 1; // spring: the flower festival's arch is on sale, the harvest pumpkins are not
  assert.strictEqual(L.buyYard(s, ix.flower_arch, 1), 'ok');
  assert.strictEqual(L.buyYard(s, ix.pumpkin_pile, 1), 'season');
  s.gold = 10;
  assert.strictEqual(L.buyYard(s, ix.gazebo, 1), 'gold');
});

test('placing, moving and storing pieces; pieces never overlap; paths go under things', () => {
  const s = fresh();
  L.buyYard(s, ix.apple_tree, 2);
  L.buyYard(s, ix.stone_path, 3);
  const a = L.placeYard(s, FARM, ix.apple_tree, 25, 14);
  assert.strictEqual(a, 0);
  assert.strictEqual(L.placeYard(s, FARM, ix.apple_tree, 25, 14), 'taken');
  assert.strictEqual(L.placeYard(s, FARM, ix.apple_tree, 26, 12), 0 + 1, 'a tree behind another: only the trunks must not touch');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 25, 16), 2, 'a path under the tree trunk row is fine');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 25, 16), 'taken', 'but not two paths');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 10, 15), 'blocked', 'not on the field');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 36, 15), 'blocked', 'not under the border trees');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 37, 15), 'outside');
  assert.strictEqual(L.moveYard(s, FARM, 0, 30, 20), 'ok');
  assert.deepStrictEqual(plain(s.yard.items[0]), { t: ix.apple_tree, x: 30, y: 20 });
  assert.strictEqual(L.storeYard(s, 0), 'ok');
  assert.strictEqual(s.yard.bag[ix.apple_tree], 1);
  assert.strictEqual(s.yard.items.length, 2);
});

test('fences join their neighbours: rails along a row, a column, posts at corners and on their own', () => {
  const s = fresh();
  [[24, 20], [25, 20], [26, 20], [26, 21], [26, 22], [30, 30]].forEach(([x, y]) => { L.buyYard(s, ix.picket_fence, 1); L.placeYard(s, FARM, ix.picket_fence, x, y); });
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((i) => L.fenceShape(s, i)), ['h', 'h', 'p', 'v', 'v', 'p']);
});

test('nothing can wall off the house, the field gates, the pen, the shop or the road', () => {
  const s = fresh();
  L.buyYard(s, ix.hedge, 3);
  // the house door opens onto (6, 7): hedges either side are fine, but not the last one shutting it in
  assert.strictEqual(L.placeYard(s, FARM, ix.hedge, 5, 7), 0);
  assert.strictEqual(L.placeYard(s, FARM, ix.hedge, 7, 7), 1);
  assert.strictEqual(L.placeYard(s, FARM, ix.hedge, 6, 8), 'blocks');
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 6, 8), 'none', 'paths never block (and we have none)');
  assert.ok(L.yardReachable(FARM, s.yard.items));
});

test('outdoor beauty adds to Home Beauty: tile pieces every time, other repeats count half', () => {
  const s = fresh();
  const base = L.homeBeauty(s);
  L.buyYard(s, ix.bench, 1);
  L.buyYard(s, ix.wood_fence, 2);
  L.placeYard(s, FARM, ix.bench, 24, 14);
  L.placeYard(s, FARM, ix.bench, 28, 14);
  L.placeYard(s, FARM, ix.wood_fence, 24, 20);
  L.placeYard(s, FARM, ix.wood_fence, 25, 20);
  assert.strictEqual(L.yardBeauty(s), 13, 'bench 7 + second bench 3.5 + two fences 1 each, rounded');
  assert.strictEqual(L.homeBeauty(s), base + L.yardBeauty(s));
});

test('the yard is saved; pieces that no longer fit go back into storage', () => {
  const s = fresh();
  L.buyYard(s, ix.windmill, 1);
  L.placeYard(s, FARM, ix.windmill, 30, 10);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.yard), plain(s.yard));
  back.yard.items.push({ t: ix.well, x: 10, y: 15 }); // on the field (a bad save)
  assert.strictEqual(L.yardRepair(back, FARM), 1);
  assert.strictEqual(back.yard.bag[ix.well], 1);
  assert.strictEqual(back.yard.items.length, 1);
});

test('an older save (24 tiles wide) keeps its crops and debris in the same places on the wider farm', () => {
  const s = fresh();
  const o = L.serialize(s);
  delete o.fw;
  delete o.yd;
  o.f = [[3 * 24 + 5, 1, 1, 2], [12 * 24 + 10, 0, 0, 0]]; // tilled tiles at (5, 3) and (10, 12)
  const back = L.deserialize(JSON.parse(JSON.stringify(o)));
  assert.ok(back.soil[3 * 38 + 5] && back.soil[12 * 38 + 10]);
  assert.strictEqual(back.soil[3 * 38 + 5].w, 1);
  assert.strictEqual(Object.keys(back.soil).length, 2);
  assert.strictEqual(back.yard.bag[ix.wood_fence], 8, 'and gets the starter pieces');
  const again = roundTrip(back);
  assert.ok(again.soil[3 * 38 + 5], 'the new width is saved, so it is not moved twice');
});

test('a full yard still fits in the save', () => {
  const s = fresh();
  for (let i = 0; i < 300; i++) s.yard.items.push({ t: i % O.types.length, x: 20 + (i % 15), y: 2 + Math.floor(i / 15) });
  C.VILLAGER_ORDER.forEach((k) => { s.friends[k] = { pts: 100, talked: 1, gifted: 1, met: 1, ev: 3 }; });
  assert.ok(JSON.stringify(L.serialize(s)).length < C.MAX_SAVE_BYTES);
});
