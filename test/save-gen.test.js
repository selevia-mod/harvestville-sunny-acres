// The save's generation (owner, 13 Nov 2026: "redesign is not saving"): src/01-logicZZZZZZZZZZZZZZZZZZZZZZZZ-save-gen.js
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
const plain = (o) => JSON.parse(JSON.stringify(o));

test('every save says which game wrote it (gg = C.SAVE_GEN); a reload keeps the farm and writes it again', () => {
  const s = L.newState();
  const o = plain(L.serialize(s));
  assert.strictEqual(C.SAVE_GEN, 2);
  assert.strictEqual(o.gg, 2);
  assert.strictEqual(o.ef, 1, 'Edit Farm\'s flag is still written');
  const again = plain(L.serialize(L.deserialize(o)));
  assert.strictEqual(again.gg, 2);
  assert.deepStrictEqual(again.yd, o.yd, 'the buildings where they were');
});

test('an older save\'s generation: none 0, Edit Farm (ef) 1, gg as written; junk is 0', () => {
  assert.strictEqual(L.saveGen({}), 0);
  assert.strictEqual(L.saveGen({ ef: 1 }), 1);
  assert.strictEqual(L.saveGen({ ef: 1, gg: 2 }), 2);
  assert.strictEqual(L.saveGen({ gg: 'x', ef: 1 }), 1);
  assert.strictEqual(L.saveGen(null), 0);
  assert.strictEqual(L.saveGen({ gg: -3 }), 0);
});
