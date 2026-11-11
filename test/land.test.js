// Unit tests for more land (src/00-land.js, src/01-logicE.js): buying the blocks in order, the save, older saves and
// friends' older snapshots, where yard pieces can go, and that a full farm still fits a save.
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

test('six blocks of 10 by 10, 630,000G in all, nothing overlapping, inside the map and clear of walls', () => {
  assert.strictEqual(MAP.width, W);
  assert.strictEqual(C.LAND.blocks.length, 6);
  assert.deepStrictEqual(Array.from(C.LAND.prices), [10000, 20000, 40000, 80000, 160000, 320000]);
  assert.strictEqual(C.LAND.prices.reduce((a, b) => a + b, 0), 630000);
  const seen = {}, walls = MAP.layers.filter((l) => l.name === 'Walls')[0].data;
  C.LAND.blocks.forEach((b) => {
    assert.strictEqual(b.x1 - b.x0, 9);
    assert.strictEqual(b.y1 - b.y0, 9);
    assert.ok(b.x1 < W - 2 && b.y1 < MAP.height - 2);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      assert.ok(!seen[x + ',' + y], 'overlap');
      seen[x + ',' + y] = 1;
      assert.strictEqual(walls[y * W + x], 0, 'wall at ' + x + ',' + y);
    }
  });
  assert.strictEqual(Object.keys(seen).length, 600);
});

test('every block can be walked to from the road, and so can its sign', () => {
  const solid = FARM.solid.slice();
  const walls = MAP.layers.filter((l) => l.name === 'Walls')[0].data;
  const ts = MAP.tilesets[0], hard = new Set();
  ts.tiles.forEach((t) => { if ((t.properties || []).some((p) => p.name === 'collides' && p.value)) hard.add(ts.firstgid + t.id); });
  walls.forEach((g, i) => { if (hard.has(g)) solid[i] = 1; });
  C.LAND.blocks.forEach((b) => { for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1) solid[y * W + x] = 1; });
  const seen = new Set([33 * W + 30]), todo = [33 * W + 30];
  while (todo.length) {
    const n = todo.pop(), x = n % W, y = Math.floor(n / W);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => {
      const p = (y + b) * W + x + a;
      if (x + a < 0 || x + a >= W || y + b < 0 || y + b >= MAP.height || solid[p] || seen.has(p)) return;
      seen.add(p);
      todo.push(p);
    });
  }
  C.LAND.blocks.forEach((b, i) => assert.ok(seen.has(b.sign[1] * W + b.sign[0] - 1), 'block ' + i));
});

test('blocks sell in order for twice the last, and you need the gold', () => {
  const s = fresh();
  s.gold = 9999;
  assert.strictEqual(L.buyLand(s), 'gold');
  assert.strictEqual(L.landOwned(s), 0);
  s.gold = 1e6;
  C.LAND.prices.forEach((p, i) => {
    assert.strictEqual(L.landPrice(s), p);
    const before = s.gold;
    assert.strictEqual(L.buyLand(s), 'ok');
    assert.strictEqual(s.gold, before - p);
    assert.strictEqual(L.landOwned(s), i + 1);
  });
  assert.strictEqual(L.buyLand(s), 'max');
});

test('the save keeps the land, and a farm that never bought any says nothing', () => {
  const s = fresh();
  assert.strictEqual(L.serialize(s).ld, undefined);
  assert.strictEqual(roundTrip(s).land, 0);
  L.buyLand(s);
  L.buyLand(s);
  assert.strictEqual(roundTrip(s).land, 2);
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  o.ld = 99;
  assert.strictEqual(L.deserialize(o).land, 6, 'bad numbers stay in range');
});

test('a save from the 38-wide farm: crops and debris stay on their tiles, and soil on bought land survives a clean', () => {
  const old = fresh();
  old.soil = {};
  old.debris = {};
  old.soil[12 * 38 + 5] = { w: 0 };
  old.debris[13 * 38 + 6] = 'weed';
  const raw = JSON.parse(JSON.stringify(L.serialize(old)));
  raw.fw = 38;
  const back = L.deserialize(raw);
  assert.ok(back.soil[12 * W + 5], 'soil moved');
  assert.strictEqual(back.debris[13 * W + 6], 'weed');
  assert.strictEqual(Object.keys(back.soil).length, 1);
  const u = fresh();
  L.buyLand(u);
  u.soil = {};
  u.soil[29 * W + 45] = { w: 0 }; // on the first block
  u.soil[18 * W + 45] = { w: 0 }; // on the second, not bought
  L.cleanSoil(u, FARM);
  assert.ok(u.soil[29 * W + 45]);
  assert.ok(!u.soil[18 * W + 45]);
});

test('a friend\'s old snapshot keeps its crops on the right tiles; a new one says how much land it has', () => {
  const s = fresh();
  L.buyLand(s);
  s.soil = {};
  s.soil[29 * W + 45] = { w: 0 };
  const snap = JSON.parse(JSON.stringify(L.snapshot(s)));
  assert.strictEqual(snap.land, 1);
  assert.strictEqual(snap.fw, W);
  const v = L.visitState(snap, s);
  assert.strictEqual(v.land, 1);
  assert.ok(v.soil[29 * W + 45]);
  const old = JSON.parse(JSON.stringify(L.snapshot(fresh())));
  delete old.fw;
  delete old.land;
  old.soil = [[12 * 38 + 5, 0, 0, 0]];
  old.debris = [[13 * 38 + 6, 0]];
  const seen = L.visitState(old, s);
  assert.ok(seen.soil[12 * W + 5], 'soil moved');
  assert.ok(seen.debris[13 * W + 6], 'debris moved');
  assert.strictEqual(seen.land, 0);
});

test('yard pieces go on land you own, not on the tracks or fenced land, and not on soil', () => {
  const s = fresh();
  const t = C.OUTDOOR.index.planter;
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 45, 29), 'outside', 'not bought yet');
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 50, 20), 'outside', 'the track');
  L.buyLand(s);
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 45, 29), null);
  s.soil[29 * W + 45] = { w: 0 };
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 45, 29), 'outside', 'soil');
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 30, 20), null, 'the old meadow is as it was');
});

test('the two ponds fill the can from the track, and a yard piece that stood there is moved off', () => {
  const s = fresh(), O = C.OUTDOOR; // (the ponds are yard pieces since Edit Farm, 10 Nov 2026)
  const water = (x, y) => s.yard.items.some((it) => L.yardWater(it.t, it.x, it.y).some((p) => p[0] === x && p[1] === y));
  assert.ok(water(38, 12), 'beside the track'); // (the round-2 pond is an oval: its top row is narrower, 11 Nov 2026)
  assert.ok(water(38, 22));
  assert.ok(!water(38, 11) && !water(34, 10), 'its empty corners are open ground');
  assert.ok(s.yard.items.filter((it) => it.t === O.index.farm_pond).length === 3);
  s.yard.items.push({ t: C.OUTDOOR.index.planter, x: 35, y: 11 });
  assert.strictEqual(L.yardRepair(s, FARM), 1);
  assert.ok(!s.yard.items.some((it) => it.x === 35 && it.y === 11), 'it went to storage');
});

test('a piece on land you own is not sent to storage when the farm loads', () => {
  const s = fresh();
  L.buyLand(s);
  const t = C.OUTDOOR.index.planter;
  s.yard.bag[t] = 1;
  assert.strictEqual(typeof L.placeYard(s, FARM, t, 45, 29), 'number');
  assert.strictEqual(L.yardRepair(s, FARM), 0);
  assert.ok(s.yard.items.some((it) => it.t === t && it.x === 45 && it.y === 29));
});

test('the field\'s fence: 60 pieces on every farm, movable, free, no beauty, not for sale, gates open', () => {
  const s = fresh(), ff = C.OUTDOOR.index.field_fence, before = L.yardBeauty(s);
  const fence = () => s.yard.items.filter((it) => it.t === ff);
  assert.strictEqual(fence().length, 60);
  assert.strictEqual(before, 0, 'no beauty');
  assert.ok(!C.OUTDOOR.cats.some((c) => c[0] === C.OUTDOOR.types[ff].cat), 'not in the shop');
  assert.ok(L.yardReachable(FARM, s.yard.items), 'the gates are open');
  const i = s.yard.items.findIndex((it) => it.t === ff && it.x === 20 && it.y === 15);
  assert.strictEqual(L.moveYard(s, FARM, i, 22, 15), 'ok');
  assert.strictEqual(L.storeYard(s, i), 'ok');
  assert.strictEqual(fence().length, 59);
  assert.strictEqual(s.yard.bag[ff], 1);
  const back = roundTrip(s);
  assert.strictEqual(back.yard.items.filter((it) => it.t === ff).length, 59, 'a stored piece stays stored');
});

test('an older save gets the fence once, around whatever was already there', () => {
  const s = fresh(), ff = C.OUTDOOR.index.field_fence;
  s.yard.items = s.yard.items.filter((it) => it.t !== ff);
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  delete o.fm;
  o.fw = 38;
  const back = L.deserialize(o);
  assert.strictEqual(back.yard.items.filter((it) => it.t === ff).length, 60);
  assert.strictEqual(roundTrip(back).yard.items.filter((it) => it.t === ff).length, 60, 'not twice');
});

test('every tile planted on all six blocks and the old field still fits a save', () => {
  const s = fresh();
  for (let i = 0; i < 6; i++) L.buyLand(s);
  s.soil = {};
  const now = L.nowMin();
  C.LAND.blocks.forEach((b) => { for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) s.soil[y * W + x] = { w: 1, c: 'pumpkin', p: now, r: 0 }; });
  L.fieldPlotTiles(s).forEach((i) => { s.soil[i] = { w: 1, c: 'pumpkin', p: now, r: 0 }; }); // (the field: its plots)
  assert.strictEqual(Object.keys(s.soil).length, 824);
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, 'save is ' + size);
});

test('a planted greenhouse or Field Plot on bought land stays when the farm opens, crops and all (players, 10 Nov 2026: "nawawala yung mga display ko")', () => {
  const s = fresh();
  L.buyLand(s);
  const b = C.LAND.blocks[0], O = C.OUTDOOR;
  [['greenhouse', b.x0 + 1, b.y0 + 1], ['farm_plot', b.x0 + 6, b.y0 + 1]].forEach(([key, x, y]) => {
    const t = O.index[key];
    s.yard.bag[t] = 1;
    assert.strictEqual(typeof L.placeYard(s, FARM, t, x, y), 'number', key);
  });
  s.yard.items.filter((it) => L.isPlot(it.t)).forEach((it) => L.yardBox(it.t, it.x, it.y).forEach((p) => { s.soil[p[1] * W + p[0]] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 }; }));
  const n = Object.keys(s.soil).length;
  const s2 = roundTrip(s);
  assert.strictEqual(L.yardRepair(s2, FARM), 0, 'nothing goes to storage');
  assert.strictEqual(s2.yard.items.filter((it) => L.isPlot(it.t) && !O.types[it.t].fieldPlot).length, 2);
  assert.strictEqual(Object.keys(s2.soil).filter((k) => s2.soil[k].c === 'turnip').length, n, 'the crops stay');
});

test('a fence on bought land with empty soil under it keeps its place and the soil goes; with a crop or a sprinkler under it, the piece goes to storage and they stay', () => {
  const s = fresh();
  L.buyLand(s);
  const b = C.LAND.blocks[0], t = C.OUTDOOR.index.wood_fence;
  s.yard.bag[t] = 3;
  [0, 2, 4].forEach((dx) => assert.strictEqual(typeof L.placeYard(s, FARM, t, b.x0 + dx, b.y1), 'number'));
  const at = (dx) => b.y1 * W + b.x0 + dx;
  s.soil[at(0)] = { w: 1, c: null, p: 0, r: 0 }; // tilled, empty
  s.soil[at(2)] = { w: 0, c: 'turnip', p: L.nowMin(), r: 0 }; // a crop
  s.soil[at(4)] = { w: 0, c: null, p: 0, r: 0, sp: 1 }; // a sprinkler
  const s2 = roundTrip(s);
  assert.strictEqual(L.yardRepair(s2, FARM), 2, 'only the two over a crop or a sprinkler move');
  assert.ok(s2.yard.items.some((it) => it.t === t && it.x === b.x0 && it.y === b.y1), 'the fence over empty soil stays');
  assert.ok(!s2.soil[at(0)], 'its empty soil is gone');
  assert.strictEqual(s2.soil[at(2)].c, 'turnip', 'the crop stays');
  assert.ok(s2.soil[at(4)].sp, 'the sprinkler stays');
  assert.strictEqual(s2.yard.bag[t], 2);
});
