// Manila (owner, 11 Nov 2026: "open to everyone"; src/00-zzzzzzzzzzzzzzzzzzz-manila.js): the city as a public room of the
// game server, like a hunting place but with no animals: any good token, 30 a room (the 31st opens Manila 2), who is
// here and where they walk, chat and waves; never an animal, a hit counted, bait or a 'cl'; an empty room goes at once.
// Its map is built at run time from the game's layout (no maps/manila.json).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { world } = require('./helpers');
const { isPubMap, isCity } = require('../lib/pub');

const plain = (x) => JSON.parse(JSON.stringify(x));

test('the city\'s map: built from the game\'s layout (90 x 90), no file in maps/; it is a public map and a city, not a hunting place', () => {
  const w = world(), R = w.game.R;
  assert.ok(!fs.existsSync(path.join(R.root, 'maps', 'manila.json')), 'no map file');
  const m = w.game.maps.get('manila');
  assert.ok(m, 'built');
  assert.strictEqual(m.W, 90);
  assert.strictEqual(m.H, 90);
  assert.strictEqual(m.zone, null, 'no wild zone: no animals');
  assert.ok(m.walkable(40, 50) && !m.walkable(86, 3), 'the plaza is ground, the bay is not (the bay on the right: owner, 11 Nov 2026)');
  assert.ok(isCity(R, 'manila') && isPubMap(R, w.game.maps, 'manila'));
  assert.ok(!R.L.isWildMap('manila'));
  R.C.MANILA.on = false;
  try { assert.ok(!isPubMap(R, w.game.maps, 'manila'), 'the city shut: no room'); } finally { R.C.MANILA.on = true; }
});

test('a hi in Manila: any good token, room 1 of 30, nobody else yet and no animals; the next one sees the first, both walk, chat and wave', async () => {
  const w = world(), T = w.game.R.T;
  const a = await w.pub('outsider', 'manila', { x: 49 * T, y: 50 * T, name: 'Ann' });
  const wl = a.last('wl');
  assert.ok(wl, 'in');
  assert.strictEqual(wl.ch, 1);
  assert.strictEqual(wl.cap, 30);
  assert.deepStrictEqual(wl.mons, []);
  assert.deepStrictEqual(wl.ppl, []);
  const b = await w.pub('ben', 'manila', { x: 50 * T, y: 50 * T, name: 'Ben' });
  assert.deepStrictEqual(plain(b.last('wl').ppl.map((r) => r.slice(0, 5))), [['outsider', 'Ann', 'boy', 49 * T, 50 * T]]);
  w.run(100);
  assert.ok(a.all('tk').some((t) => (t.come || []).some((r) => r[0] === 'ben')), 'Ann hears Ben come');
  b.say({ t: 'mv', x: 52 * T, y: 50 * T, dir: 'right', m: 1, c: w.now() });
  w.run(100);
  assert.ok(a.all('tk').some((t) => (t.p || []).some((r) => r[0] === 'ben' && r[1] === 52 * T)), 'and sees him walk');
  a.say({ t: 'say', s: 'Hello, Manila!' });
  assert.deepStrictEqual(plain(b.last('say')), { t: 'say', id: 'outsider', n: 'Ann', s: 'Hello, Manila!' });
  a.say({ t: 'em', k: 'wave' });
  assert.ok(b.last('em') && b.last('em').k === 'wave');
  // never an animal, however long they stay; a hit is not counted; bait does nothing; never 'cl'
  b.say({ t: 'hit', s: 0, d: 4, n: 1 });
  b.say({ t: 'bt', x: 50 * T, y: 50 * T });
  w.run(120000);
  const room = w.pubRoom('manila', 1);
  assert.strictEqual(room.mons.length, 0);
  assert.ok(![a, b].some((p) => p.all('tk').some((t) => (t.m || []).length) || p.all('dn').length || p.all('cl').length || p.all('bt').length));
  assert.strictEqual(room.baits.size, 0);
  // both gone: the room goes at once
  a.say({ t: 'bye' });
  b.say({ t: 'bye' });
  assert.strictEqual(w.pubRoom('manila', 1), undefined);
});

test('30 a room: the 31st opens Manila 2; a bad token is refused; a hunting place\'s rooms are its own', async () => {
  const w = world(), T = w.game.R.T;
  for (let i = 0; i < 30; i++) assert.strictEqual((await w.pub('p' + i, 'manila', { x: (40 + (i % 10)) * T, y: (40 + Math.floor(i / 10)) * T })).last('wl').ch, 1);
  assert.strictEqual((await w.pub('p30', 'manila')).last('wl').ch, 2);
  assert.strictEqual((await w.pub('x', 'manila', { token: 'stolen' })).last('no').why, 'auth');
  const h = await w.pub('hunter', 'banaue');
  assert.strictEqual(h.last('wl').ch, 1, 'Banaue 1, not Manila');
  assert.ok(h.last('wl').mons.length > 0, 'and Banaue has its animals');
});
