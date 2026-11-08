// e44 (owner, 8 Nov 2026: "Sprinkler on snows park farm when i visit, i cannot see them"): a farm's sprinklers go in
// its snapshot, so a visitor sees them where the owner put them (and the visit never waters with them: 01-logicZ-farmtech.js).
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

const plain = (x) => JSON.parse(JSON.stringify(x));

test('a visitor sees the farm\'s sprinklers, each its own kind, on the tile it stands on', () => {
  const s = L.newState();
  const W = 64, a = 21 * W + 25, b = 22 * W + 30;
  [a, b, a + 1].forEach((k) => L.till(s, k));
  s.soil[a].sp = 1; // copper
  s.soil[b].sp = 3; // gold
  const snap = plain(L.snapshot(s));
  const v = L.visitState(snap, L.newState());
  assert.strictEqual(v.soil[a] && v.soil[a].sp, 1, 'the copper sprinkler');
  assert.strictEqual(v.soil[b] && v.soil[b].sp, 3, 'the gold one');
  assert.ok(!v.soil[a + 1].sp, 'tilled soil stays soil');
  assert.deepStrictEqual(plain(L.sprinklers(v)).map((p) => [p.idx, p.tier]).sort((x, y) => x[0] - y[0]), [[a, 0], [b, 2]]);
  // bad data from another player is dropped: no tile, a planted tile, an unknown kind
  const bad = plain(snap);
  bad.sp = [999999, 1, a + 1, 9, 'x', 2];
  const w = L.visitState(bad, L.newState());
  assert.strictEqual(L.sprinklers(w).length, 0);
});
