// Turning furniture (owner, 8 Nov 2026): the rules (01-logicZZZZZZZZZZ-furn-turn.js).
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
const H = C.HOME, ti = (k) => H.typeIndex[k];
const plain = (v) => JSON.parse(JSON.stringify(v));

test('beds, double beds, chairs, armchairs, sofas and tables turn four ways; the rest flip as before', () => {
  ['bed', 'double_bed', 'chair', 'armchair', 'sofa', 'table'].forEach((k) => {
    assert.ok(L.furnTurns(ti(k)), k);
    const seq = [0];
    for (let n = 0; n < 4; n++) seq.push(L.nextTurn(ti(k), seq[seq.length - 1]));
    assert.deepStrictEqual(seq, [0, 2, 3, 4, 0], k);
    assert.strictEqual(L.nextTurn(ti(k), 1), 2, k + ': a flipped one (from before) turns on');
  });
  ['rug', 'bookshelf', 'fireplace', 'wardrobe'].forEach((k) => {
    assert.ok(!L.furnTurns(ti(k)), k);
    assert.deepStrictEqual([L.nextTurn(ti(k), 0), L.nextTurn(ti(k), 1), L.furnF(ti(k), 3)], [1, 0, 1], k);
  });
});

test('the picture for each turn: front, side, back, side mirrored', () => {
  const sofa = ti('sofa');
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((f) => plain(L.furnView(sofa, f))), [null, null, { frame: 8, flip: false }, { frame: 9, flip: false }, { frame: 8, flip: true }]);
  assert.deepStrictEqual(plain(L.furnTurnBox(ti('double_bed'), 256)), { x: 0, y: 85, w: 256, h: 171 }, 'a 3 x 2 piece: a wide box on the bottom edge');
  assert.deepStrictEqual(plain(L.furnTurnBox(ti('armchair'), 256)), { x: 64, y: 0, w: 128, h: 256 });
});

test('kept in the save and in a friend\'s copy; an old save\'s flip stays a flip', () => {
  const s = L.newState();
  const bed = s.home.items.findIndex((it) => H.types[it.t].key === 'bed');
  assert.strictEqual(L.moveFurn(s, bed, s.home.items[bed].x, s.home.items[bed].y, 3), 'ok');
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.strictEqual(back.home.items[bed].f, 3);
  const o = L.serialize(s);
  const snap = L.snapshot(s);
  const visit = L.visitState(JSON.parse(JSON.stringify(snap)));
  assert.strictEqual(visit.home.items[bed].f, 3, 'friends see it turned');
  assert.strictEqual(L.furnF(H.types.findIndex((x) => x.key === 'bed'), true), 1);
  void o;
});
