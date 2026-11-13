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
