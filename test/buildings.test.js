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
  assert.ok(O.types[O.index.ranch].mask.some((r) => r.indexOf('G') >= 0), 'the ranch has a gate');
  assert.ok(O.types[O.index.farm_pond].mask.every((r) => /^W+$/.test(r)), 'a pond is all water');
  assert.strictEqual(O.types[O.index.field_plot4].kind, 'plot');
  assert.strictEqual(O.types[O.index.field_plot42].kind, 'plot');
});

test('the masks match the farm map they came from (78b8af5): its walls, the pen, the incubator, the dog\'s yard, the counter', () => {
  const OLD = path.join(__dirname, 'fixtures', 'farm-map-before-edit-farm.json');
  const m = JSON.parse(fs.readFileSync(OLD, 'utf8')), W = m.width, walls = m.layers.find((l) => l.name === 'Walls').data;
  const props = {};
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
  const solidAt = (x, y) => !!(walls[y * W + x] && props[walls[y * W + x]].collides);
  const check = (key, x0, y0, cols) => {
    const t = O.types[O.index[key]];
    for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) {
      if (cols && cols.indexOf(dx) < 0) continue;
      const c = t.mask[dy][dx], solid = '#DWSI'.indexOf(c) >= 0;
      assert.strictEqual(solid, solidAt(x0 + dx, y0 + dy), key + ' ' + (x0 + dx) + ',' + (y0 + dy) + ' "' + c + '"');
    }
  };
  check('farmhouse', 4, 3, [0, 1, 2, 3, 4]); // (the mailbox column is a prop, not a wall)
  check('ranch', 2, 27);
  check('farm_pond', 15, 3); check('farm_pond', 34, 10); check('farm_pond', 34, 20);
  check('seed_stand', 14, 28);
  const obj = (n) => m.layers.find((l) => l.type === 'objectgroup').objects.find((o) => o.name === n), tile = (v) => Math.floor(v / 256);
  const at = (key, x0, y0, letter) => { const t = O.types[O.index[key]], out = []; t.mask.forEach((r, dy) => r.split('').forEach((c, dx) => { if (c === letter) out.push([x0 + dx, y0 + dy]); })); return out; };
  const pen = obj('animal_pen'), P = at('ranch', 2, 27, 'P');
  assert.strictEqual(P.length, (pen.width / 256) * (pen.height / 256));
  assert.deepStrictEqual(P[0], [tile(pen.x), tile(pen.y)]);
  const inc = obj('incubator');
  assert.deepStrictEqual(at('ranch', 2, 27, 'I')[0], [tile(inc.x), tile(inc.y)]);
  const dog = obj('dog_yard');
  assert.deepStrictEqual([at('dog_yard', 11, 5, 'Y')[0][1], at('dog_yard', 11, 5, 'Y').length > 0], [tile(dog.y) + 1, true]);
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
  assert.strictEqual(L.yardSolid(p, 15, 3).length, 20, 'water is solid');
  assert.strictEqual(L.yardWater(p, 15, 3).length, 20);
  assert.strictEqual(L.yardSolid(O.index.field_plot4, 4, 11).length, 0, 'a field plot is walked on');
  assert.strictEqual(L.maskTiles(O.index.ranch, 2, 27, 'G').length, 2, 'the gate');
  // pieces without a mask keep the foot rule
  assert.strictEqual(L.yardSolid(O.index.bench, 5, 5).length, 2);
});
