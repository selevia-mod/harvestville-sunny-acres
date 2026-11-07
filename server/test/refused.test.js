// Every hit the server does not count is written down, with why (owner, 7 Nov 2026: "add that so we will know why
// theres a bug": a tiger whose bar dropped and came back on the owner's phone).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../lib/game');
const { world } = require('./helpers');

test('a refused hit is written down: gone (never here, or killed a moment ago), too soon, too far; the minute counts them', async () => {
  const lines = [];
  const w = world();
  w.game.log = (l) => lines.push(l);
  const T = w.game.R.T;
  const a = await w.pub('ann', 'pulag', { x: 3 * T, y: 3 * T });
  const room = w.pubRoom('pulag', 1), m = room.mons.find((x) => x.hp >= 2);
  // too far: Ann 12+ tiles from it by our count
  a.say({ t: 'mv', x: m.x + 13 * T > room.fl.W * T ? m.x - 13 * T : m.x + 13 * T, y: m.y, dir: 'left', m: 0 });
  a.say({ t: 'hit', s: m.slot, d: 1, n: 1 });
  // close, counted; then again at once: too soon
  a.say({ t: 'mv', x: m.x + T, y: m.y, dir: 'left', m: 0 });
  a.say({ t: 'hit', s: m.slot, d: 1, n: 2 });
  a.say({ t: 'hit', s: m.slot, d: 1, n: 3 });
  // a slot that is not here at all
  a.say({ t: 'hit', s: 77, d: 1, n: 4 });
  const why = lines.filter((l) => /^\[hit refused\]/.test(l)).map((l) => l.split(' ')[2]);
  assert.deepStrictEqual(why, ['far', 'soon', 'gone']);
  assert.match(lines.find((l) => / far /.test(l)), /"tiles":1[3-9]/);
  assert.match(lines.find((l) => / gone /.test(l)), /"slot":77,"ago":-1/);
  const r = w.game.report();
  assert.strictEqual(r.hitsOk, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.refused)), { far: 1, soon: 1, gone: 1 });
  void Game;
});
