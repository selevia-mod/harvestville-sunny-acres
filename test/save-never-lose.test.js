// Owner, 14 Nov 2026 ("why users keep and keep losing items? That's our fault and should never happen again"): loading a
// save never loses a piece: over a limit it goes into storage, an unknown kind (a newer game's) is written back as it
// came, and a stored count is not cut. And a save twice as big as before still saves.
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const count = (s, t) => s.yard.items.filter((it) => it.t === t).length;

test('decorations over the farm\'s limit go into storage on load, never away', () => {
  const s = L.newState({});
  const lamp = O.index.lamp, before = s.yard.items.filter((it) => !L.isYardTile(it.t)).length;
  for (let i = 0; i < C.YARD_MAX - before + 7; i++) s.yard.items.push({ t: lamp, x: i % 60, y: 20 + Math.floor(i / 60) });
  const back = L.deserialize(plain(L.serialize(s)));
  const out = back.yard.items.filter((it) => !L.isYardTile(it.t)).length;
  assert.strictEqual(out, C.YARD_MAX, 'the limit out on the farm');
  assert.strictEqual(count(back, lamp) + (back.yard.bag[lamp] || 0), count(s, lamp) + (s.yard.bag[lamp] || 0), 'every lamp still owned');
  assert.ok(back.yard.bag[lamp] >= 7, 'the extra ones in storage');
});

test('a kind this game does not know (a newer game\'s) comes back with the next save, placed or stored', () => {
  const s = L.newState({});
  const o = plain(L.serialize(s));
  o.yd[0].push(950, 30, 30); // a piece of a kind from the future
  o.yd[1].push(951, 4); // and 4 stored
  const back = L.deserialize(o);
  const again = plain(L.serialize(back));
  const flat = again.yd[0], bag = again.yd[1];
  let found = false;
  for (let i = 0; i + 2 < flat.length; i += 3) if (flat[i] === 950 && flat[i + 1] === 30 && flat[i + 2] === 30) found = true;
  assert.ok(found, 'the unknown piece written back where it was');
  let n = 0;
  for (let k = 0; k + 1 < bag.length; k += 2) if (bag[k] === 951) n = bag[k + 1];
  assert.strictEqual(n, 4, 'the unknown stored ones written back');
});

test('a stored count over 9,999 is kept', () => {
  const s = L.newState({});
  s.yard.bag[O.index.brick_path] = 12345;
  const back = L.deserialize(plain(L.serialize(s)));
  assert.strictEqual(back.yard.bag[O.index.brick_path], 12345);
});

test('the save limit is 48,000 (the biggest farms were within 2,000 of the old 24,000)', () => {
  assert.strictEqual(C.MAX_SAVE_BYTES, 48000);
});

// Zoeley and saint eliska (17 Nov 2026 farm check): a fence or a hedge may stand on a path, but the save wrote one tile a
// square, so the piece underneath was gone after the next load (Zoeley 98 pieces, saint eliska 189 in two days).
test('a fence or a hedge on a path: both come back after a save', () => {
  const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
  const FARM = L.farmInfo(MAP), ix = O.index;
  const s = L.newState(); s.gold = 1e6;
  [ix.stone_path, ix.brick_path, ix.wood_fence, ix.hedge].forEach((t) => { s.yard.bag[t] = 10; });
  const total = (st, t) => count(st, t) + (st.yard.bag[t] || 0);
  // paths with fences on them, paths with hedges on them, and fences put down first with a path under them
  const pair = (under, over, want) => {
    let n = 0;
    for (let y = 26; y < 44 && n < want; y++) for (let x = 26; x < 60 && n < want; x++) {
      if (L.yardCantPlace(s, FARM, under, x, y, null)) continue;
      const i = L.placeYard(s, FARM, under, x, y);
      if (L.placeYard(s, FARM, over, x, y) >= 0) n++; else { s.yard.items.splice(i, 1); s.yard.bag[under] = (s.yard.bag[under] || 0) + 1; }
    }
    assert.strictEqual(n, want, 'placed ' + want);
  };
  pair(ix.stone_path, ix.wood_fence, 4);
  pair(ix.brick_path, ix.hedge, 3);
  pair(ix.wood_fence, ix.stone_path, 2);
  const kinds = [ix.stone_path, ix.brick_path, ix.wood_fence, ix.hedge];
  const before = kinds.map((t) => total(s, t)), placed = kinds.map((t) => count(s, t));
  const back = L.deserialize(plain(L.serialize(s)));
  assert.deepStrictEqual(kinds.map((t) => total(back, t)), before, 'nothing lost');
  assert.deepStrictEqual(kinds.map((t) => count(back, t)), placed, 'all still out on the farm');
  const again = L.deserialize(plain(L.serialize(back)));
  assert.deepStrictEqual(kinds.map((t) => count(again, t)), placed, 'and after a second save');
});

// The save guard (owner, 17 Nov 2026: "why they keep losing pieces?"): whatever a future bug leaves out of the save, the
// save puts into storage and says how many ('yk').
test('the save guard: a piece the save would leave out goes into storage, and the save says so', () => {
  const s = L.newState(); s.gold = 1e6;
  const lamp = O.index.lamp, path_ = O.index.stone_path;
  s.yard.items.push({ t: lamp, x: 30, y: 30 }, { t: path_, x: 31, y: 30 }, { t: path_, x: 32, y: 30 });
  s.yard.bag[lamp] = 2;
  const total = (st, t) => count(st, t) + (st.yard.bag[t] || 0);
  const ok = L.serialize(s);
  assert.strictEqual(ok.yk, undefined, 'a good save is left as it is');
  // a bug: the lines of paths lose a tile
  const runs = L.yardRuns;
  L.yardRuns = (items) => runs(items.filter((it) => !(it.t === path_ && it.x === 32)));
  const o = L.serialize(s);
  L.yardRuns = runs;
  assert.strictEqual(o.yk, 1, 'the path left out of the lines was kept');
  const back = L.deserialize(plain(o));
  assert.strictEqual(total(back, path_), 2, 'both paths still there (one in storage)');
  assert.strictEqual(total(back, lamp), 3, 'the rest as it was');
});

test('the save guard counts what a big farm holds the same as the farm in play', () => {
  const s = L.newState();
  const kinds = [O.index.lamp, O.index.stone_path, O.index.wood_fence, O.index.hedge, O.index.bench];
  for (let i = 0; i < 400; i++) s.yard.items.push({ t: kinds[i % kinds.length], x: 2 + (i % 70), y: 10 + Math.floor(i / 70) });
  kinds.forEach((t) => { s.yard.bag[t] = 25; });
  const o = L.serialize(s);
  assert.strictEqual(o.yk, undefined);
  assert.deepStrictEqual(Array.from(L.savedYardCounts(plain(o))), Array.from(L.playYardCounts(s)));
});
