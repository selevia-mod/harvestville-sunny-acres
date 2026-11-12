// Unit tests for lands 7, 8 and 9 (docs/superpowers/specs/2026-11-12-lands-7-9-design.md; src/00-zzland.js, src/01-logicE.js,
// src/01-logicZZZZZZZZZZZZZZZZZZZ-lands79.js, maps/farm.json from tools/widen-farm-75.js): the prices in Gold and Pearls, the
// order, the wider map, and every save and friend's snapshot from the 64-wide farm moved once to 75, each crop, soil tile,
// debris, yard piece and cleared decoration on the same spot.
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
const W = C.FARM_W, OLD = 64;
const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 11, 12, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const own = (s, n) => { s.gold = 1e7; s.pearls = 1e4; for (let i = 0; i < n; i++) assert.strictEqual(L.buyLand(s), 'ok'); s.gold = 0; s.pearls = 0; };

test('the farm is 75 wide: a third column of blocks at x 62-71, a track at x 72, trees at x 73-74', () => {
  assert.strictEqual(W, 75);
  assert.strictEqual(MAP.width, 75);
  MAP.layers.filter((l) => l.type === 'tilelayer').forEach((l) => assert.strictEqual(l.data.length, 75 * MAP.height, l.name));
  const B = C.LAND.blocks.slice(6);
  assert.deepStrictEqual(plain(B.map((b) => [b.x0, b.y0, b.x1, b.y1])), [[62, 25, 71, 34], [62, 14, 71, 23], [62, 3, 71, 12]], 'bottom first: nearest the way in');
  const ground = MAP.layers.filter((l) => l.name === 'Ground')[0].data, walls = MAP.layers.filter((l) => l.name === 'Walls')[0].data;
  for (let y = 2; y <= 35; y++) { assert.strictEqual(ground[y * W + 72], 28, 'the track at x 72, row ' + y); assert.strictEqual(ground[y * W + 61], 28); }
  for (let y = 3; y <= 35; y += 2) assert.ok(walls[y * W + 73] && walls[y * W + 74], 'the tree line, row ' + y);
  B.forEach((b) => assert.strictEqual(walls[b.sign[1] * W + b.sign[0]], 0, 'its sign is put up by the game'));
});

test('lands 7, 8 and 9: 800,000 / 1,600,000 / 3,000,000 Gold plus 250 / 800 / 2,500 Pearls, after land 6, in order', () => {
  assert.deepStrictEqual(Array.from(C.LAND.prices.slice(6)), [800000, 1600000, 3000000]);
  assert.deepStrictEqual(Array.from(C.LAND.pearls), [0, 0, 0, 0, 0, 0, 250, 800, 2500]);
  const s = fresh();
  own(s, 6);
  assert.strictEqual(L.landPrice(s), 800000);
  assert.strictEqual(L.landPearls(s), 250);
  s.gold = 800000; s.pearls = 249;
  assert.strictEqual(L.buyLand(s), 'pearls', 'Gold without the Pearls');
  assert.deepStrictEqual([s.gold, s.pearls, L.landOwned(s)], [800000, 249, 6], 'nothing taken');
  s.gold = 799999; s.pearls = 5000;
  assert.strictEqual(L.buyLand(s), 'gold', 'Pearls without the Gold');
  assert.deepStrictEqual([s.gold, s.pearls, L.landOwned(s)], [799999, 5000, 6], 'nothing taken');
  s.gold = 1e7; s.pearls = 5000;
  assert.strictEqual(L.buyLand(s), 'ok');
  assert.deepStrictEqual([s.gold, s.pearls, L.landOwned(s)], [1e7 - 800000, 4750, 7], 'land 7 takes both');
  assert.ok(L.landOpen(s, 62, 25) && !L.landOpen(s, 62, 14) && !L.landOpen(s, 62, 3));
  assert.strictEqual(L.landPrice(s), 1600000);
  assert.strictEqual(L.landPearls(s), 800);
  assert.strictEqual(L.buyLand(s), 'ok');
  assert.strictEqual(s.pearls, 3950);
  assert.ok(L.landOpen(s, 70, 20), 'land 8 is the middle one');
  assert.strictEqual(L.landPearls(s), 2500);
  assert.strictEqual(L.buyLand(s), 'ok');
  assert.strictEqual(s.pearls, 1450);
  assert.strictEqual(L.buyLand(s), 'max');
  const t = fresh();
  own(t, 5);
  t.gold = 1e9; t.pearls = 1e5;
  assert.strictEqual(L.buyLand(t), 'ok');
  assert.ok(L.landOpen(t, 51, 3) && !L.landOpen(t, 62, 3), 'land 9 needs 7 and 8 first: they sell one at a time');
  const u = fresh();
  own(u, 0);
  u.gold = 1e9; u.pearls = 0;
  for (let i = 0; i < 6; i++) assert.strictEqual(L.buyLand(u), 'ok', 'lands 1 to 6 take no Pearls');
});

test('a piece goes on land 7 once it is yours (and the tiles there can be tilled), not before', () => {
  const s = fresh();
  own(s, 6);
  const t = C.OUTDOOR.index.planter;
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 65, 28), 'outside');
  own(s, 1);
  assert.strictEqual(L.landOwned(s), 7);
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 65, 28), null);
  assert.strictEqual(L.yardCantPlace(s, FARM, t, 72, 28), 'outside', 'the new track');
  s.yard.bag[t] = 1;
  assert.strictEqual(typeof L.placeYard(s, FARM, t, 65, 28), 'number');
  assert.strictEqual(L.yardRepair(s, FARM), 0);
});

const spots = [[45, 29], [60, 34], [63, 5], [5, 15], [0, 37], [63, 37], [30, 33]];

test('a save from the 64-wide farm: every crop, soil tile, debris, yard piece and cleared decoration on the same spot; not moved twice', () => {
  const s = fresh();
  own(s, 6);
  const now = L.nowMin();
  s.soil = {}; s.debris = {};
  spots.forEach(([x, y], i) => { s.soil[y * W + x] = { w: i % 2, c: i % 3 ? 'turnip' : null, p: now - i, r: 0 }; });
  s.debris[12 * W + 63] = 'weed';
  s.debris[30 * W + 2] = 'stone';
  s.decoGone = [20 * W + 33, 5 * W + 63];
  const plotsBefore = plain(s.yard.items);
  // the same farm as an app before lands 7-9 saved it: its tile numbers 64 wide (soil, debris and 'dco' are by number)
  const remap = (i) => Math.floor(i / W) * OLD + i % W;
  const sold = fresh();
  own(sold, 6);
  sold.soil = {}; sold.debris = {};
  Object.keys(s.soil).forEach((k) => { sold.soil[remap(+k)] = s.soil[k]; });
  Object.keys(s.debris).forEach((k) => { sold.debris[remap(+k)] = s.debris[k]; });
  sold.decoGone = s.decoGone.map(remap);
  sold.yard = s.yard;
  const o = plain(L.serialize(sold));
  o.fw = OLD;
  const b = L.deserialize(o);
  assert.deepStrictEqual(Object.keys(b.soil).map(Number).sort((x, y) => x - y), Object.keys(s.soil).map(Number).sort((x, y) => x - y), 'soil on the same spots');
  spots.forEach(([x, y], i) => {
    const t = b.soil[y * W + x];
    assert.ok(t, 'soil at ' + x + ',' + y);
    assert.strictEqual(t.c, i % 3 ? 'turnip' : null, 'the crop at ' + x + ',' + y);
  });
  assert.strictEqual(b.debris[12 * W + 63], 'weed');
  assert.strictEqual(b.debris[30 * W + 2], 'stone');
  assert.deepStrictEqual(plain(b.decoGone).sort(), plain(s.decoGone).sort(), 'cleared decorations stay cleared, on their tiles');
  assert.deepStrictEqual(plain(b.yard.items).length, plotsBefore.length, 'yard pieces are by x and y: none lost');
  assert.deepStrictEqual(plain(b.yard.items).map((it) => [it.t, it.x, it.y]).sort(), plotsBefore.map((it) => [it.t, it.x, it.y]).sort());
  assert.strictEqual(b.yard.items.filter((it) => it.t === C.OUTDOOR.index.field_fence).length, 60, 'the field fence once');
  // saved again (fw 75 now) and loaded again: nothing moves a second time
  const again = plain(L.serialize(b));
  assert.strictEqual(again.fw, W);
  const c = L.deserialize(again);
  assert.deepStrictEqual(Object.keys(c.soil).sort(), Object.keys(b.soil).sort(), 'not moved twice');
  assert.deepStrictEqual(plain(c.decoGone), plain(b.decoGone));
  assert.deepStrictEqual(plain(c.debris), plain(b.debris));
  const d = roundTrip(roundTrip(c));
  assert.deepStrictEqual(Object.keys(d.soil).sort(), Object.keys(b.soil).sort());
});

test("a friend's 64-wide snapshot shows right: crops, debris and cleared decorations on their tiles, its own fence not doubled", () => {
  const s = fresh();
  own(s, 6);
  s.soil = {}; s.debris = {};
  s.soil[29 * W + 45] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
  s.soil[34 * W + 60] = { w: 0, c: null, p: 0, r: 0 };
  s.debris[12 * W + 63] = 'weed';
  s.decoGone = [5 * W + 63];
  const ff = C.OUTDOOR.index.field_fence;
  const i = s.yard.items.findIndex((it) => it.t === ff && it.x === 20 && it.y === 15);
  assert.strictEqual(L.moveYard(s, FARM, i, 22, 15), 'ok', 'its farmer moved a piece of the fence');
  const snap = plain(L.snapshot(s));
  // written as a 64-wide app sends it (and reads it), every tile here at x 0-63 (01-logic...-farm-tiles.js)
  const remap = (k) => Math.floor(k / W) * OLD + k % W;
  assert.strictEqual(snap.fw, OLD);
  assert.strictEqual(snap.fx, undefined);
  assert.deepStrictEqual(snap.soil.map((e) => e[0]).sort(), [remap(29 * W + 45), remap(34 * W + 60)].sort());
  assert.deepStrictEqual(snap.dco, [remap(5 * W + 63)]);
  const v = L.visitState(snap, fresh());
  assert.ok(v.soil[29 * W + 45] && v.soil[29 * W + 45].c === 'turnip');
  assert.ok(v.soil[34 * W + 60]);
  assert.strictEqual(Object.keys(v.soil).length, 2);
  assert.ok(v.debris[12 * W + 63]);
  assert.deepStrictEqual(plain(v.decoGone), [5 * W + 63]);
  assert.strictEqual(v.yard.items.filter((it) => it.t === ff).length, 60, 'the fence is not put back where it was moved from');
  assert.ok(!v.yard.items.some((it) => it.t === ff && it.x === 20 && it.y === 15), 'the moved piece stays moved');
  assert.strictEqual(v.land, 6);
  // a 75-wide snapshot: as it is
  const now = plain(L.snapshot(s)), v2 = L.visitState(now, fresh());
  assert.ok(v2.soil[29 * W + 45]);
  assert.deepStrictEqual(plain(v2.decoGone), [5 * W + 63]);
});

test('a full farm of nine blocks and the field, every tile planted, fits a save and a snapshot', () => {
  const s = fresh();
  own(s, 9);
  s.soil = {};
  const now = L.nowMin();
  C.LAND.blocks.forEach((b) => { for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) s.soil[y * W + x] = { w: 1, c: 'pumpkin', p: now, r: 0 }; });
  L.fieldPlotTiles(s).forEach((i) => { s.soil[i] = { w: 1, c: 'pumpkin', p: now, r: 0 }; });
  const size = JSON.stringify(L.serialize(s)).length, snap = JSON.stringify(L.snapshot(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, 'save is ' + size);
  assert.ok(snap < 32768, 'snapshot is ' + snap);
  console.log('a full nine-block farm: save', size, 'bytes, snapshot', snap);
});
