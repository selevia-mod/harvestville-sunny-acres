// Farm Raids between players: the balance (owner, 10 Nov 2026: "it was too imbalance. Learn from clash of clan"). Each
// defender holds what its Raid Camp allows (R.caps) at its level, raiders come down off the field and 3 tiles from it all,
// and the battle is the game's own (L.frStart, L.frDrop, L.frStep). Targets, as Clash of Clans: an equal camp wins 1-2
// stars, two levels higher about 3, two lower at most 1; a maxed camp does not always win 3 stars against a maxed farm.
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
const R = C.FRAID;
const W = 30, H = 24;
// field 10x6 in the middle (no drop on it + 1 round it), pen top-left, stall/gold top-right; defenses round the field
function farm(camp, dlv) {
  const loot = [];
  for (let y = 9; y < 15; y++) for (let x = 10; x < 20; x++) loot.push({ kind: 'crops', x, y, n: 1 });
  loot.push({ kind: 'produce', x: 5, y: 5, n: 6 }, { kind: 'gold', x: 24, y: 5, n: 300 }, { kind: 'stall', x: 26, y: 5, n: 20 });
  const tier = R.caps.tier[camp], want = { dog: 1 };
  ['tower', 'goose', 'beebox', 'sprinkler', 'kampana', 'mudpit', 'sili', 'scarecrow'].forEach((k) => (want[k] = R.caps[k][tier]));
  want.scarecrow = Math.min(want.scarecrow, 2);
  const spots = [[15, 8], [9, 12], [20, 12], [15, 15], [6, 6], [24, 6], [12, 8], [18, 15], [9, 9], [21, 9], [12, 15], [18, 8], [8, 14], [21, 14], [4, 8], [25, 8], [15, 6], [15, 17], [7, 4], [23, 4], [11, 6], [19, 6], [11, 17], [19, 17]];
  const defs = []; let i = 0;
  Object.keys(want).forEach((k) => { for (let n = 0; n < want[k] && i < spots.length; n++, i++) defs.push({ t: k, x: spots[i][0], y: spots[i][1], lv: dlv }); });
  // a ring of plain fences round the field with a gap (walls)
  for (let x = 9; x <= 20; x++) { if (x !== 14) defs.push({ t: 'fence', x, y: 7, lv: dlv }); defs.push({ t: 'fence', x, y: 16, lv: dlv }); }
  let nd = ''; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) nd += (x >= 9 && x <= 20 && y >= 8 && y <= 15) || (x < 9 && y < 9) ? '1' : '0';
  const f = { w: W, h: H, solid: '0'.repeat(W * H), defs, loot, keep: R.battle.keepReal, noDrop: nd };
  f.drop = L.frDropCells(f); return f;
}
function army(camp, rlv) {
  const sp = R.camp.levels[camp - 1].space, open = [].concat(...R.camp.levels.slice(0, camp).map((l) => l.open)), out = {}; let left = sp;
  const pref = ['carabao', 'boar', 'monkey', 'cat', 'rooster', 'bayawak', 'crow', 'goat'].filter((k) => open.includes(k));
  for (const k of pref) { const s = R.raiders[k].space, n = k === 'goat' ? Math.floor(left / s) : Math.min(Math.floor(left / s), Math.ceil(sp / (s * 3))); if (n > 0) { out[k] = { n, lv: rlv }; left -= n * s; } }
  return out;
}
const cost = (a) => Object.keys(a).reduce((g, k) => g + a[k].n * R.raiders[k].gold, 0);
function play(f, a, seed) {
  const b = L.frStart(f, a, seed), cells = []; for (let i = 0; i < f.drop.length; i++) if (f.drop[i] === '1') cells.push(i);
  // a player's plan: all from the side nearest the field, spread along it
  const near = cells.sort((p, q) => { const d = (i) => Math.abs(i % W - 15) + Math.abs(Math.floor(i / W) - 12); return d(p) - d(q); });
  let k = 0; Object.keys(a).forEach((r) => { for (let n = 0; n < a[r].n; n++) { const c = near[(k++ * 7) % Math.min(40, near.length)]; L.frDrop(b, r, c % W, Math.floor(c / W)); } });
  while (!b.end) L.frStep(b);
  const down = b.defs.filter((d) => d.t !== 'fence' && d.max && d.hp <= 0).length, all = b.defs.filter((d) => d.t !== 'fence' && d.max).length;
  return { stars: L.frStars(b), share: L.frShare(b), down: all ? down / all : 0, lost: b.raiders.filter((r) => r.hp <= 0).length / Math.max(1, b.raiders.length) };
}
const lvOf = (camp) => [1, 1, 1, 2, 2, 3, 3, 4][camp];
const stars = (ac, dc, rl, dl) => { let st = 0; for (let s = 1; s <= 8; s++) st += play(farm(dc, dl == null ? lvOf(dc) : dl), army(ac, rl == null ? lvOf(ac) : rl), s * 97).stars; return st / 8; };

test('a defense hits with its own level, its counter 2x; a level-5 defense hits 2x', () => {
  assert.strictEqual(L.frDefMult(5), 2);
  assert.strictEqual(R.counter, 2);
});

test('equal camps: 1 to 2 stars', () => {
  for (const c of [1, 3, 5, 7]) { const s = stars(c, c); assert.ok(s >= 1 && s <= 2.5, 'camp ' + c + ': ' + s); }
});

test('two camp levels higher: 2 to 3 stars; two lower: at most 1', () => {
  for (const [a, d] of [[3, 1], [5, 3], [7, 5]]) { const s = stars(a, d); assert.ok(s >= 2, a + ' v ' + d + ': ' + s); }
  for (const [a, d] of [[3, 5], [5, 7]]) { const s = stars(a, d); assert.ok(s <= 1.2, a + ' v ' + d + ': ' + s); }
});

test('a max camp with level-5 raiders does not always win 3 stars against a maxed farm (owner, 9 Nov 2026)', () => {
  const s = stars(7, 7, 5, 5);
  assert.ok(s < 3, 'max v max: ' + s);
});

test('no defenses: a full camp wins 3 stars', () => {
  const f = farm(1, 1); f.defs = []; f.drop = L.frDropCells(f);
  assert.strictEqual(play(f, army(5, 3), 7).stars, 3);
});
