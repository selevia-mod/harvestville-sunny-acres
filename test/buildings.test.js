// Edit Farm part 1 (docs/edit-farm.md): the buildings as yard pieces, their masks, the migration, placement.
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
const O = C.OUTDOOR;
const KEYS = ['farmhouse', 'ranch', 'dog_yard', 'farm_pond', 'seed_stand', 'stable_yard', 'field_plot4', 'field_plot42'];

test('the buildings are appended yard types, each mask as big as the piece', () => {
  const first = O.index.farmhouse;
  assert.strictEqual(first, 59, 'appended after the last raid defense (def_sprinkler = 58)');
  KEYS.forEach((k, i) => {
    const t = O.types[O.index[k]];
    assert.ok(t, k);
    assert.strictEqual(O.index[k], first + i, k + ' in order');
    assert.strictEqual(t.mask.length, t.h, k + ' rows');
    t.mask.forEach((row) => assert.strictEqual(row.length, t.w, k + ' row width'));
    assert.strictEqual(t.cat, 'none', k + ' is not for sale');
  });
  assert.strictEqual(O.types[O.index.farmhouse].mask.join('').split('D').length - 1, 1, 'one door');
  assert.ok(O.types[O.index.ranch].pen, 'the ranch has its animals\' patch in front (round 2, 11 Nov 2026: no gate, no fence)');
  assert.ok(O.types[O.index.farm_pond].mask.join('').split('W').length - 1 >= 12, 'a pond is mostly water');
  assert.strictEqual(O.types[O.index.field_plot4].kind, 'plot');
  assert.strictEqual(O.types[O.index.field_plot42].kind, 'plot');
});

test('the masks match the farm map they came from (78b8af5): its walls, the pen, the incubator, the dog\'s yard, the counter', () => {
  const OLD = path.join(__dirname, 'fixtures', 'farm-map-before-edit-farm.json');
  const m = JSON.parse(fs.readFileSync(OLD, 'utf8')), W = m.width, walls = m.layers.find((l) => l.name === 'Walls').data;
  const props = {};
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
  const solidAt = (x, y) => !!(walls[y * W + x] && props[walls[y * W + x]].collides);
  // (the ranch's gate moved from the right side (10,31..32) to the front fence (6,35), as the owner's picture has it)
  const MOVED = { '10,31': 1, '10,32': 1, '6,35': 1 };
  const check = (key, x0, y0, cols) => {
    const t = O.types[O.index[key]];
    for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) {
      if (cols && cols.indexOf(dx) < 0) continue;
      if (key === 'ranch' && MOVED[(x0 + dx) + ',' + (y0 + dy)]) continue;
      const c = t.mask[dy][dx], solid = '#DWSI'.indexOf(c) >= 0;
      assert.strictEqual(solid, solidAt(x0 + dx, y0 + dy), key + ' ' + (x0 + dx) + ',' + (y0 + dy) + ' "' + c + '"');
    }
  };
  check('farmhouse', 4, 3, [0, 1, 2, 3, 4]); // (the mailbox column is a prop, not a wall)
  // (the ranch, the doghouse and the pond are the round-2 pictures since 11 Nov 2026: their masks follow the art: test/e2e.test.js)
  check('seed_stand', 14, 28);
  const obj = (n) => m.layers.find((l) => l.type === 'objectgroup').objects.find((o) => o.name === n), tile = (v) => Math.floor(v / 256);
  const at = (key, x0, y0, letter) => { const t = O.types[O.index[key]], out = []; t.mask.forEach((r, dy) => r.split('').forEach((c, dx) => { if (c === letter) out.push([x0 + dx, y0 + dy]); })); return out; };
  const shop = obj('seed_shop');
  assert.deepStrictEqual(at('seed_stand', 14, 28, 'S'), [[tile(shop.x), tile(shop.y)], [tile(shop.x) + 1, tile(shop.y)]]);
  const door = obj('house_door'), d = at('farmhouse', 4, 3, 'D')[0];
  assert.ok(door, 'the door');
  assert.deepStrictEqual(at('farmhouse', 4, 3, 'M')[0], [tile(obj('mailbox').x), 6]);
  void d;
});

test('a building\'s mask decides its solid tiles, its water and its open tiles', () => {
  const h = O.index.farmhouse, solid = L.yardSolid(h, 4, 3).map((p) => p.join(','));
  assert.strictEqual(solid.length, 21, 'the house walls, its door and the mailbox: 24 tiles less the 3 open ones');
  assert.ok(solid.includes('6,6'), 'the door is faced, not walked into');
  assert.ok(!solid.includes('9,3'), 'beside the mailbox is open');
  assert.strictEqual(L.maskAt(h, 4, 3, 6, 6), 'D');
  const p = O.index.farm_pond;
  assert.strictEqual(L.yardSolid(p, 15, 3).length, 13, 'water is solid; the oval\'s corners are open');
  assert.strictEqual(L.yardWater(p, 15, 3).length, 13);
  assert.strictEqual(L.yardSolid(O.index.field_plot4, 4, 11).length, 0, 'a field plot is walked on');
  assert.strictEqual(L.penTiles({ t: O.index.ranch, x: 2, y: 27 }).length, 28, 'the animals\' patch, 7 x 4');
  // pieces without a mask keep the foot rule
  assert.strictEqual(L.yardSolid(O.index.bench, 5, 5).length, 2);
});

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const BASE = L.farmInfo(MAP);
const fresh = () => { const s = L.newState(); s.seed = 3; s.gold = 1e6; if (L.takeNotes) L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));

test('the farm map keeps only its frame: no house, ranch, ponds, stand, field or their objects', () => {
  const props = {};
  MAP.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
  const ground = MAP.layers.find((l) => l.name === 'Ground').data, walls = MAP.layers.find((l) => l.name === 'Walls').data, W = MAP.width;
  assert.ok(!ground.some((g) => props[g] && (props[g].tillable || props[g].water)), 'no field and no water on the ground');
  assert.ok(!walls.some((g) => props[g] && props[g].water), 'no ponds');
  for (let y = 3; y <= 6; y++) for (let x = 4; x <= 8; x++) assert.strictEqual(walls[y * W + x], 0, 'house tile ' + x + ',' + y);
  for (let y = 27; y <= 35; y++) for (let x = 2; x <= 10; x++) assert.strictEqual(walls[y * W + x], 0, 'ranch tile ' + x + ',' + y);
  for (let y = 28; y <= 31; y++) for (let x = 14; x <= 19; x++) assert.strictEqual(walls[y * W + x], 0, 'stand tile ' + x + ',' + y);
  const names = MAP.layers.find((l) => l.type === 'objectgroup').objects.map((o) => o.name);
  ['house_door', 'mailbox', 'seed_shop', 'animal_pen', 'dog_yard', 'incubator', 'horse', 'doghouse', 'stable', 'spawn'].forEach((n) => assert.ok(!names.includes(n), n + ' is gone'));
  ['road_south', 'from_town', 'field_sign', 'yard_sign', 'road_sign', 'land_sign', 'forage_0'].forEach((n) => assert.ok(names.includes(n), n + ' stays'));
  assert.strictEqual(BASE.start, -1, 'the map itself has no house door now');
});

test('a new farm has its buildings where the map had them, and its field as 16 plots', () => {
  const s = fresh(), at = (k) => JSON.parse(JSON.stringify(s.yard.items.filter((it) => it.t === O.index[k]).map((it) => it.x + ',' + it.y)));
  assert.deepStrictEqual(at('farmhouse'), ['4,3']);
  assert.deepStrictEqual(at('ranch'), ['2,27']);
  assert.deepStrictEqual(at('dog_yard'), ['12,6'], 'the doghouse alone, where the old yard\'s house stood');
  assert.deepStrictEqual(at('farm_pond'), ['15,3', '34,10', '34,20']);
  assert.deepStrictEqual(at('seed_stand'), ['14,28']);
  assert.strictEqual(at('field_plot4').length, 12);
  assert.strictEqual(at('field_plot42').length, 4);
  assert.deepStrictEqual(at('stable_yard'), [], 'no stable until it is built');
  assert.strictEqual(L.yardRepair(s, BASE), 0, 'all of them fit');
  const s2 = L.newState({ fieldTiles: [] }); // (the game passes the map's field: empty now)
  const field = L.fieldPlotTiles(s2);
  assert.ok(Object.keys(s2.debris).length > 0 && Object.keys(s2.debris).every((i) => field.includes(Number(i))), 'its first debris on the field');
});

test('the house door and the buildings\' openings come from the pieces', () => {
  const s = fresh(), W = C.FARM_W;
  assert.strictEqual(L.farmFor(s, BASE).start, 7 * W + 6, 'below the door at (6,6)');
  const house = s.yard.items.find((it) => it.t === O.index.farmhouse);
  house.x = 24; house.y = 4;
  const f2 = L.farmFor(s, BASE);
  assert.strictEqual(f2.start, 8 * W + 26, 'the door moved with the house');
  assert.ok(f2.needs.length >= BASE.needs.length + 4);
});

test('the ranch\'s animals\' patch must stay reachable: a fence shutting it in is refused (round 2, 11 Nov 2026)', () => {
  const s = fresh(), t = O.index.wood_fence, r = s.yard.items.find((it) => it.t === O.index.ranch);
  r.x = 24; r.y = 12; // out in the meadow: its patch is (25..31, 16..19), the barn and coop behind it
  assert.deepStrictEqual(plainA(L.penArea(r)), { x0: 25, y0: 16, x1: 31, y1: 19 });
  const ring = [];
  for (let y = 16; y <= 19; y++) ring.push([24, y], [32, y]);
  for (let x = 25; x <= 31; x++) ring.push([x, 20]); // (corners need no fence: the animals walk straight, not diagonally)
  s.yard.bag[t] = ring.length;
  ring.slice(0, -1).forEach((p) => assert.strictEqual(typeof L.placeYard(s, BASE, t, p[0], p[1]), 'number', 'fence at ' + p));
  const last = ring[ring.length - 1];
  assert.strictEqual(L.yardCantPlace(s, BASE, t, last[0], last[1], null), 'blocks', 'the last one shutting the animals in');
  assert.strictEqual(L.yardCantPlace(s, BASE, t, 28, 17, null), 'taken', 'and nothing goes on the patch itself');
});
const plainA = (v) => JSON.parse(JSON.stringify(v));

test('an older save gets them once, its soil and crops stay on the same tiles, and nothing else moves', () => {
  const s = fresh(), W = C.FARM_W;
  s.yard.items = s.yard.items.filter((it) => !L.isBuilding(it.t) && !O.types[it.t].fieldPlot); // as a save from before this update
  s.soil[13 * W + 8] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
  s.builds.stable = 1;
  const n0 = s.yard.items.length;
  const o = JSON.parse(JSON.stringify(L.serialize(s))); delete o.ef;
  const s2 = L.deserialize(o);
  assert.strictEqual(s2.yard.items.length - n0, 7 + 16 + 1, '7 buildings, 16 field plots, the stable');
  assert.strictEqual(s2.soil[13 * W + 8].c, 'turnip');
  assert.strictEqual(L.yardRepair(s2, BASE), 0, 'nothing goes to storage');
  assert.strictEqual(s2.soil[13 * W + 8].c, 'turnip', 'and the crop stays');
  const s3 = roundTrip(s2);
  assert.strictEqual(s3.yard.items.length, s2.yard.items.length, 'once: not again on the next load');
});

test('the house and the ranch can\'t be put away, only moved; the others can', () => {
  const s = fresh(), i = (k) => s.yard.items.findIndex((it) => it.t === O.index[k]);
  assert.strictEqual(L.storeYard(s, i('farmhouse')), 'keep');
  assert.strictEqual(L.storeYard(s, i('ranch')), 'keep');
  assert.strictEqual(L.storeYard(s, i('dog_yard')), 'ok');
});

test('a visit sees the farm as its owner laid it out; an older snapshot (or a made-up farm) gets the buildings where the map had them', () => {
  const s = fresh(), h = s.yard.items.find((it) => it.t === O.index.farmhouse);
  h.x = 24; h.y = 4;
  const v = L.visitState(L.snapshot(s), fresh());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v.yard.items.filter((it) => it.t === O.index.farmhouse).map((it) => [it.x, it.y]))), [[24, 4]]);
  assert.strictEqual(v.yard.items.filter((it) => L.isBuilding(it.t)).length, s.yard.items.filter((it) => L.isBuilding(it.t)).length, 'nothing added twice');
  const old = JSON.parse(JSON.stringify(L.snapshot(s))); delete old.ef; old.yard = old.yard.filter((e) => !L.isBuilding(e[0]) && !O.types[e[0]].fieldPlot);
  const v2 = L.visitState(old, fresh());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v2.yard.items.filter((it) => it.t === O.index.farmhouse).map((it) => [it.x, it.y]))), [[4, 3]], 'given back at (4,3)');
  assert.strictEqual(v2.yard.items.filter((it) => it.t === O.index.farm_pond).length, 3);
  const bare = L.visitState({ v: 1, home: { level: 3 }, soil: [], yard: [], animals: [] }, fresh());
  assert.strictEqual(bare.yard.items.filter((it) => O.types[it.t].fieldPlot).length, 16, 'a made-up farm has its field');
});

// Owner, 14 Nov 2026 ("Game puts it back"): a farmhouse or ranch found in storage (they can never be put away, but a
// piece that no longer fits goes into storage when the farm opens) comes back by itself: at its map spot if free, else
// the nearest free spot; a spare one in storage stays; no room anywhere: it stays in storage.
test('a farmhouse or ranch in storage comes back: its own spot, else the nearest free one; never a second one', () => {
  const FARM = L.farmInfo(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')));
  const FH = O.index.farmhouse, RA = O.index.ranch, BB = O.index.def_beebox;
  // 1. its spot free: back there
  const a = L.newState({});
  a.yard.items = a.yard.items.filter((it) => it.t !== FH);
  a.yard.bag[FH] = 1;
  assert.deepStrictEqual([...L.returnKeepers(a, FARM)], ['farmhouse']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a.yard.items.filter((it) => it.t === FH).map((it) => [it.x, it.y]))), [[4, 3]]);
  assert.strictEqual(a.yard.bag[FH], undefined, 'out of storage');
  // 2. something stands on its spot (as on MsBeariel's farm: a bee box there): the nearest free spot
  const b = L.newState({});
  b.yard.items = b.yard.items.filter((it) => it.t !== FH);
  b.yard.items.push({ t: BB, x: 9, y: 4 });
  b.yard.bag[FH] = 1;
  assert.deepStrictEqual([...L.returnKeepers(b, FARM)], ['farmhouse']);
  const fh = b.yard.items.find((it) => it.t === FH);
  assert.ok(fh && !(fh.x === 4 && fh.y === 3), 'somewhere else: ' + JSON.stringify(fh));
  b.yard.items.splice(b.yard.items.indexOf(fh), 1);
  assert.ok(!L.yardCantPlace(b, FARM, FH, fh.x, fh.y, null), 'a spot it fits');
  // 3. one already stands: the stored one stays a spare
  const c = L.newState({});
  c.yard.bag[RA] = 1;
  assert.deepStrictEqual([...L.returnKeepers(c, FARM)], []);
  assert.strictEqual(c.yard.bag[RA], 1);
  // 4. a visit never moves anything
  const d = L.newState({});
  d.yard.items = d.yard.items.filter((it) => it.t !== FH);
  d.yard.bag[FH] = 1;
  d.isVisit = true;
  assert.deepStrictEqual([...L.returnKeepers(d, FARM)], []);
});
