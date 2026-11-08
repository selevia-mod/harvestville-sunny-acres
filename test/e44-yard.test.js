// e44 (owner, 8 Nov 2026, approved): paths and fences stored compactly (a run of the same tile in a row or a column is
// one entry), with their own limit of 1,500 tiles; decorations keep the 500. A full farm's save stays small (the server
// refuses one over 32 KB). Older saves (every tile its own entry) load the same; a visit sees the whole yard.
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
require('./clock')(ctx);
const O = C.OUTDOOR;
const plain = (x) => JSON.parse(JSON.stringify(x));
const key = (it) => it.t + ':' + it.x + ',' + it.y;
const items = (s) => plain(s.yard.items.map(key).sort());

// a farm with a long path, a fence round a square, a few lone tiles and some decorations
const builtYard = (tiles, decos) => {
  const s = L.newState(), path = O.index.stone_path, fence = O.index.wood_fence, bench = O.index.bench;
  s.yard.items = [];
  for (let k = 0; k < tiles; k++) s.yard.items.push({ t: k % 3 ? path : fence, x: k % 60, y: 100 + Math.floor(k / 60) });
  for (let k = 0; k < decos; k++) s.yard.items.push({ t: bench, x: k % 60, y: 200 + Math.floor(k / 60) });
  return s;
};

test('paths and fences are tiles with their own limit (1,500); decorations keep theirs (500)', () => {
  assert.strictEqual(C.YARD_MAX, 500);
  assert.strictEqual(C.YARD_TILES_MAX, 1500);
  assert.ok(L.isYardTile(O.index.stone_path) && L.isYardTile(O.index.wood_fence) && L.isYardTile(O.index.field_fence));
  assert.ok(!L.isYardTile(O.index.bench) && !L.isYardTile(O.index.gazebo));
  const s = builtYard(0, 500);
  s.yard.bag[O.index.bench] = 1;
  s.yard.bag[O.index.stone_path] = 1;
  assert.strictEqual(L.yardRoom(s, O.index.bench), 0, 'decorations full');
  assert.ok(L.yardRoom(s, O.index.stone_path) > 0, 'paths still have room');
  const t = builtYard(1500, 0);
  assert.strictEqual(L.yardRoom(t, O.index.stone_path), 0, 'tiles full');
  assert.ok(L.yardRoom(t, O.index.bench) > 0, 'decorations still have room');
});

test('the save keeps runs of tiles: a full farm (1,500 tiles, 500 decorations) saves well under 32 KB, and loads the same', () => {
  const s = builtYard(1500, 500);
  const o = plain(L.serialize(s));
  assert.ok(Array.isArray(o.yd[2]), 'runs');
  assert.ok(o.yd[2].length < 1500, 'fewer entries than tiles: ' + o.yd[2].length / 4);
  assert.ok(JSON.stringify(o).length < 28000, 'save ' + JSON.stringify(o).length + ' bytes');
  const back = L.deserialize(o);
  assert.deepStrictEqual(items(back), items(s));
  assert.deepStrictEqual(items(L.deserialize(plain(L.serialize(back)))), items(s), 'again');
});

test('an older save (every tile its own entry, 500 at most) loads every piece; bad runs are dropped', () => {
  const s = builtYard(300, 200);
  const o = plain(L.serialize(s));
  o.yd = [[].concat(...s.yard.items.map((it) => [it.t, it.x, it.y])), o.yd[1]]; // the old way
  assert.deepStrictEqual(items(L.deserialize(o)), items(s));
  const bad = plain(L.serialize(builtYard(0, 1)));
  bad.yd[2] = [O.index.bench, 1, 1, 5, O.index.stone_path, 2, 2, 9999, 'x', 1, 1, 1, O.index.stone_path, 3, 3, -2];
  const b = L.deserialize(bad);
  assert.ok(!b.yard.items.some((it) => it.t === O.index.bench && it.y === 1), 'a decoration is never a run');
  assert.ok(b.yard.items.filter((it) => it.t === O.index.stone_path).length <= 120 + 2);
});

test('a visit sees the whole yard (it stopped at 360 pieces): tiles as runs in the snapshot', () => {
  const s = builtYard(900, 300);
  const snap = plain(L.snapshot(s));
  const v = L.visitState(snap, L.newState());
  assert.strictEqual(v.yard.items.length, 1200);
  assert.deepStrictEqual(items(v), items(s));
});
