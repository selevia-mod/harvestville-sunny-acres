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

test('a phone that says it is beside each monster in turn (security check, 23 Nov 2026): its hits count no faster than a gallop takes it there', async () => {
  const w = world({ leash: true });
  const T = w.game.R.T;
  const a = await w.pub('ann', 'pulag', { x: 2 * T, y: 2 * T });
  const room = w.pubRoom('pulag', 1);
  const far = room.mons.filter((x) => Math.hypot(x.x - 2 * T, x.y - 2 * T) > 24 * T)[0];
  assert.ok(far, 'a monster far from Ann');
  // straight there in one message, and the hit at once: not counted (she could not be there yet)
  a.say({ t: 'mv', x: far.x + T, y: far.y, dir: 'left', m: 0 });
  a.say({ t: 'hit', s: far.slot, d: 1, n: 1 });
  assert.strictEqual(w.game.report().hitsOk || 0, 0, 'a jump across the map is not a hit');
  // walking there (messages as she goes, the time it takes at walking speed): counted
  const steps = Math.ceil(Math.hypot(far.x - 2 * T, far.y - 2 * T) / (4 * T));
  a.say({ t: 'mv', x: 2 * T, y: 2 * T, dir: 'left', m: 1 });
  for (let i = 1; i <= steps; i++) {
    w.run(1000);
    const k = i / steps, m = room.mons.find((x) => x.slot === far.slot) || far;
    a.say({ t: 'mv', x: Math.round(2 * T + (m.x + T - 2 * T) * k), y: Math.round(2 * T + (m.y - 2 * T) * k), dir: 'left', m: 1 });
  }
  const m = room.mons.find((x) => x.slot === far.slot);
  if (m) { a.say({ t: 'mv', x: m.x + T, y: m.y, dir: 'left', m: 0 }); a.say({ t: 'hit', s: m.slot, d: 1, n: 2 }); }
  assert.strictEqual(w.game.report().hitsOk, 1, 'walking there, the hit counts');
});
