// Step 2 (docs/game-server.md): the hunting places, open to everyone, 30 a room. With fake phones: who may join, which
// room, the shared animals (the Philippine clock, nights, the weekend's Great Mammoth for two), respawn by crowd, more
// copies for a crowd, animals walking in out of sight, the tame never here, who sees whom (15 nearest within 18 tiles),
// bait, arrows in flight, no `cl`, an empty room gone at once.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');
const { world } = require('./helpers');
const { sharedState, PUB_CAP, VIEW, VIEW_MAX } = require('../lib/pub');

const FRI_4PM = 1800000000000; // Fri 15 Jan 2027, 4 PM in the Philippines (8 AM UTC)
const H = 3600000, DAY = 864e5;

// shoot it down, standing beside it
const kill = (w, p, room, a) => {
  let n = 0, guard = 0;
  while (room.mons.includes(a) && guard++ < 400) {
    p.say({ t: 'mv', x: a.x + 100, y: a.y, dir: 'left', m: 0 });
    p.say({ t: 'hit', s: a.slot, d: 4, n: ++n });
    w.wait(150); // (HIT_GAP; a multiple of 50, so the phones still ping on the 2 s mark)
  }
  assert.ok(!room.mons.includes(a), 'down');
};
const near = (a, list, tiles, T) => list.some((p) => Math.hypot(a[2] - p.x, a[3] - p.y) < tiles * T);
const plain = (x) => JSON.parse(JSON.stringify(x)); // (the game's rules live in a vm: its arrays are not ours)
const kindOf = (R, row) => (row[1] >= 1000 ? R.WI.more[row[1] - 1000] : R.WI.order[row[1]]);

test('a public hi: any good token, the place as L.wildHere gives it now (never the tame), ch and cap; not a cave, not a place in the making', async () => {
  const w = world(), R = w.game.R, L = R.L, T = R.T;
  const a = await w.pub('outsider', 'banaue', { x: 3 * T, y: 3 * T, lk: { cs: 'x'.repeat(100), pt: 1, rd: 'yes' } }); // (no farm needed)
  const wl = a.last('wl');
  assert.ok(wl, 'in');
  assert.strictEqual(wl.ch, 1);
  assert.strictEqual(wl.cap, 30);
  assert.strictEqual(PUB_CAP, 30);
  assert.deepStrictEqual(wl.ppl, []);
  const want = L.wildHere(sharedState(w.now()), 'banaue').filter((e) => !e.tame);
  assert.deepStrictEqual(wl.mons.map((r) => r[0]), plain(want.map((e) => e.slot)));
  assert.ok(L.wildSlots('banaue').some((e) => e.tame), 'Banaue has a tame slot ...');
  assert.ok(!wl.mons.some((r) => R.WI.animals[kindOf(R, r)].tameOnly), '... never on the server');
  wl.mons.forEach((r) => assert.ok(Math.hypot(r[2] - 3 * T, r[3] - 3 * T) >= 6 * T, 'placed 6 tiles or more from the first phone'));
  // the next one sees them, with how they look (the 8th of the row), the look kept short
  const b = await w.pub('ben', 'banaue', { x: 4 * T, y: 3 * T, name: 'Ben​\u0007' });
  assert.deepStrictEqual(b.last('wl').ppl, [['outsider', 'outsider', 'boy', 3 * T, 3 * T, 'down', 0, { cs: 'x'.repeat(64), pt: 1, rd: 1 }]]);
  assert.deepStrictEqual(b.last('wl').mons, wl.mons, 'the same animals for both');
  w.run(50);
  assert.deepStrictEqual(a.last('tk').come, [['ben', 'Ben', 'boy', 4 * T, 3 * T, 'down', 0, { cs: '', pt: 0, rd: 0 }]]);
  // refused: a cave, a farm map, a place still in the making, nowhere, a bad token
  for (const map of ['lair', 'banaue_cave', 'farm', 'park', 'sample_place', 'nowhere', 42]) {
    assert.strictEqual((await w.pub('c', map)).last('no').why, 'topic', String(map));
  }
  assert.strictEqual((await w.pub('c', 'banaue', { token: 'stolen' })).last('no').why, 'auth');
  // every hunting place opens
  for (const map of ['pulag', 'makiling', 'magayon', 'banaue', 'bohol', 'taal', 'sierra', 'palawan']) assert.ok((await w.pub('d-' + map, map)).last('wl'), map);
});

test('the clock the animals keep is the phones\' in the Philippines (L.dayOf, L.minuteOf there)', () => {
  const root = path.join(__dirname, '..', '..');
  const times = [FRI_4PM, FRI_4PM + 15 * H + 59 * 60000, FRI_4PM + 8 * H, 1767196800000 - 1, 1767196800000 + 16 * H];
  const out = JSON.parse(execFileSync(process.execPath, ['-e', `
    const { rules } = require(${JSON.stringify(path.join(__dirname, '..', 'lib', 'rules'))});
    const L = rules().L;
    console.log(JSON.stringify(${JSON.stringify(times)}.map((t) => [L.dayOf(t), L.minuteOf(t)])));`], { env: Object.assign({}, process.env, { TZ: 'Asia/Manila' }), cwd: root }).toString());
  times.forEach((t, i) => {
    const s = sharedState(t);
    assert.strictEqual(s.day, out[i][0]);
    assert.ok(Math.abs(s.time - out[i][1]) < 1 / 60, 'minute ' + s.time + ' vs ' + out[i][1]);
  });
});

test('room choice: 30 a room; the 31st opens room 2; `with` if it has space; else the fullest; a dropped line comes back; a new one takes the lowest free number', async () => {
  const w = world(), T = w.game.R.T;
  const ps = [];
  for (let i = 0; i < 30; i++) ps.push(await w.pub('p' + i, 'banaue', { x: (2 + (i % 10)) * T, y: (2 + Math.floor(i / 10)) * T }));
  ps.forEach((p) => assert.strictEqual(p.last('wl').ch, 1));
  assert.strictEqual(w.pubRoom('banaue', 1).players.size, 30);
  const p30 = await w.pub('p30');
  assert.strictEqual(p30.last('wl').ch, 2, 'the 31st: a new room, never `full`');
  assert.ok(!p30.last('no'));
  assert.strictEqual((await w.pub('p31', 'banaue', { with: 'p3' })).last('wl').ch, 2, 'with a friend in a full room: the fullest with space');
  ps[0].say({ t: 'bye' });
  assert.strictEqual((await w.pub('q', 'banaue', { with: 'p30' })).last('wl').ch, 2, 'with: their room, though room 1 is fuller');
  assert.strictEqual((await w.pub('r')).last('wl').ch, 1, 'no with: the fullest with space (29 > 3)');
  assert.strictEqual((await w.pub('s', 'banaue', { with: 'p31' })).last('wl').ch, 2, 'room 1 is full again: with p31 in room 2');
  assert.strictEqual((await w.pub('t', 'pulag', { with: 'p5' })).last('wl').ch, 1, 'another place has its own rooms');
  // the same player on a second socket takes their place back (the old one is let go)
  const again = await w.pub('p7');
  assert.strictEqual(again.last('wl').ch, 1);
  assert.strictEqual(ps[7].closed.code, 4001);
  assert.strictEqual(w.pubRoom('banaue', 1).players.size, 30);

  // small rooms (pubCap 3) for the rest
  const v = world({ pubCap: 3 });
  const [a, b, c] = [await v.pub('a'), await v.pub('b'), await v.pub('c')];
  const [d, e] = [await v.pub('d'), await v.pub('e')];
  assert.deepStrictEqual([a, b, c, d, e].map((x) => x.last('wl').ch), [1, 1, 1, 2, 2]);
  c.say({ t: 'bye' });
  a.drop(); // (a's line drops: room 1 has b, room 2 has d and e)
  assert.strictEqual((await v.pub('a')).last('wl').ch, 1, 'a dropped line comes back to its room, not the fullest');
  // an empty room goes at once; a new one takes the lowest free number
  d.say({ t: 'bye' });
  e.say({ t: 'bye' });
  assert.strictEqual(v.pubRoom('banaue', 2), undefined, 'room 2 went at once');
  const f = await v.pub('f'), g = await v.pub('g'), h = await v.pub('h');
  assert.deepStrictEqual([f, g, h].map((x) => x.last('wl').ch), [1, 2, 2], 'room 1 fills up, then 2 again');
});

test('an empty public room goes at once: the next one finds the place fresh', async () => {
  const w = world(), R = w.game.R;
  const a = await w.pub('a');
  const room = w.pubRoom('banaue', 1);
  kill(w, a, room, room.mons[0]);
  assert.strictEqual(room.gone.size, 1);
  a.say({ t: 'bye' });
  assert.strictEqual(w.game.rooms.size, 0);
  const b = await w.pub('b');
  assert.notStrictEqual(w.pubRoom('banaue', 1), room);
  assert.strictEqual(b.last('wl').mons.length, R.L.wildHere(sharedState(w.now()), 'banaue').filter((e) => !e.tame).length, 'all of them again');
});

test('who sees whom: the 15 nearest within 18 tiles; walking into view is a `come` (with the look), out of it a `left`', async () => {
  const w = world(), T = w.game.R.T, k = T / Math.SQRT2;
  const a = await w.pub('a', 'banaue', { x: 2 * T, y: 2 * T });
  // 17 within 18 tiles (2 .. 18), 3 beyond (20, 22, 24), on a slant from a
  const dists = [];
  for (let d = 2; d <= 18; d++) dists.push(d);
  dists.push(20, 22, 24);
  const at = (d) => ({ x: Math.round(2 * T + d * k), y: Math.round(2 * T + d * k) });
  for (const d of dists) await w.pub('d' + d, 'banaue', Object.assign({ lk: { cs: 'look' + d } }, at(d)));
  w.run(50);
  const seen = new Set(a.all('tk').reduce((l, t) => l.concat(t.come.map((r) => r[0])), []));
  const want = dists.slice(0, VIEW_MAX).map((d) => 'd' + d);
  assert.strictEqual(VIEW, 18);
  assert.strictEqual(VIEW_MAX, 15);
  assert.deepStrictEqual(Array.from(seen).sort(), want.slice().sort(), 'a hears of the 15 nearest (2 .. 16 tiles)');
  // a newcomer's wl has the same rule
  const z = await w.pub('z', 'banaue', { x: 2 * T, y: 2 * T });
  assert.deepStrictEqual(z.last('wl').ppl.map((r) => r[0]).filter((id) => id !== 'a').sort(), dists.slice(0, VIEW_MAX - 1).map((d) => 'd' + d).sort());
  assert.ok(z.last('wl').ppl.every((r) => r.length === 8 && r[7] && typeof r[7].cs === 'string'));
  z.say({ t: 'bye' });
  w.run(50);
  // no one ever hears of more than 15
  w.pubRoom('banaue', 1).players.forEach((p) => assert.ok(p.view.size <= VIEW_MAX));
  // a far one's moves never reach a
  const n0 = a.got.length;
  const d24 = w.phones.find((p) => p.uid === 'd24');
  d24.say({ t: 'mv', x: at(23).x, y: at(23).y, dir: 'left', m: 1 });
  w.run(50);
  assert.ok(!a.got.slice(n0).some((m) => m.t === 'tk' && m.p.some((r) => r[0] === 'd24')));
  // d18 walks right up to a: it comes (the whole row, its look too), the 16-tile one is pushed out of the 15
  const d18 = w.phones.find((p) => p.uid === 'd18');
  d18.say({ t: 'mv', x: 3 * T, y: 2 * T, dir: 'left', m: 1 });
  w.run(50);
  let tk = a.last('tk');
  assert.deepStrictEqual(tk.come, [['d18', 'd18', 'boy', 3 * T, 2 * T, 'left', 1, { cs: 'look18', pt: 0, rd: 0 }]]);
  assert.deepStrictEqual(tk.left, ['d16']);
  // it walks off again, beyond 18 tiles: it leaves, and the 16-tile one is back
  d18.say({ t: 'mv', x: at(25).x, y: at(25).y, dir: 'right', m: 1 });
  w.run(50);
  tk = a.last('tk');
  assert.deepStrictEqual(tk.left, ['d18']);
  assert.deepStrictEqual(tk.come.map((r) => r[0]), ['d16']);
  // a moves among them: only the ones it sees move on its phone
  const d3 = w.phones.find((p) => p.uid === 'd3');
  d3.say({ t: 'mv', x: at(3).x + 50, y: at(3).y, dir: 'right', m: 1 });
  w.run(50);
  assert.deepStrictEqual(a.last('tk').p, [['d3', at(3).x + 50, at(3).y, 'right', 1]]);
  // one who leaves the room while in view: a `left`
  d3.say({ t: 'bye' });
  w.run(50);
  assert.ok(a.last('tk').left.includes('d3'));
});

test('respawn by crowd: a hunted slot waits its minutes, divided by ceil(players / 5), at most 3; it walks back in out of sight', async () => {
  const w = world(), R = w.game.R, T = R.T;
  const a = await w.pub('a', 'banaue', { x: 3 * T, y: 3 * T });
  const room = w.pubRoom('banaue', 1);
  const crowdFor = [];
  for (let i = 2; i <= 30; i++) {
    await w.pub('c' + i, 'banaue', { x: 3 * T + (i % 3) * 30, y: 3 * T + Math.floor(i / 3) * 30 });
    crowdFor[i] = room.crowd();
  }
  assert.deepStrictEqual([5, 6, 10, 11, 15, 16, 30].map((n) => crowdFor[n]), [1, 2, 2, 3, 3, 3, 3]);
  // the Great Mammoth's weekend is not a crowd's (30 here: 3 days, not one)
  room.gone.set(998, w.now());
  w.wait(4319 * 60000);
  assert.ok(room.waiting(998, R.WI.animals.greatmammoth));
  // the rule itself, at each crowd
  const def = R.WI.animals.itik, mins = def.respawn || R.WI.respawn;
  assert.strictEqual(mins, 6);
  const leaveTo = (n) => { while (room.players.size > n) w.phones.filter((p) => !p.closed && !p.quiet && p.c.room === room).slice(-1)[0].say({ t: 'bye' }); };
  [[30, 2], [10, 3], [5, 6]].forEach(([n, m]) => {
    leaveTo(n);
    room.gone.set(999, w.now());
    w.wait(m * 60000 - 1000);
    assert.ok(room.waiting(999, def), n + ' players: still waiting at ' + m + ' min less a second');
    w.wait(1000);
    assert.ok(!room.waiting(999, def), n + ' players: back after ' + m + ' min');
  });

  // in play, 10 hunters (crowd 2): an itik shot down is back after 3 minutes, not before, walking in from the edge
  const v = world(), V = v.game.R;
  const hunters = [];
  for (let i = 0; i < 10; i++) hunters.push(await v.pub('h' + i, 'banaue', { x: 3 * T + i * 20, y: 3 * T }));
  const vr = v.pubRoom('banaue', 1);
  const itik = vr.mons.find((x) => x.kind === 'itik');
  kill(v, hunters[0], vr, itik);
  hunters[0].say({ t: 'mv', x: 3 * T, y: 3 * T, dir: 'down', m: 0 });
  assert.ok(hunters[5].all('dn').some((d) => d.s === itik.slot));
  const t0 = v.now();
  v.run(3 * 60000 - 2000);
  assert.ok(!vr.mons.some((x) => x.slot === itik.slot), 'not back before 3 minutes');
  const before = hunters[5].got.length;
  v.run(45000);
  const back = vr.mons.find((x) => x.slot === itik.slot);
  assert.ok(back, 'back within the next 20-40 s after 3 minutes (' + (v.now() - t0) / 1000 + ' s)');
  const first = hunters[5].got.slice(before).find((m) => m.t === 'tk' && m.m.some((r) => r[0] === itik.slot)).m.find((r) => r[0] === itik.slot);
  assert.ok(!near(first, hunters.map((h, i) => ({ x: 3 * T + i * 20, y: 3 * T })), 5.9, T), 'it walked in out of sight (6 tiles or more from every hunter)');
  assert.strictEqual(V.L.wildUnpack(first).mode, 'walk');
});

test('a crowd brings more copies of the roster: one more for each 6 beyond the first 6, at most 3 (slots 100 * copy + slot), never a second rare one', async () => {
  const w = world({ seed: 11 }), R = w.game.R, T = R.T;
  const ps = [await w.pub('p0', 'pulag', { x: 3 * T, y: 3 * T })];
  const room = w.pubRoom('pulag', 1), copies = [];
  for (let i = 1; i < 30; i++) {
    copies[i] = room.copies();
    ps.push(await w.pub('p' + i, 'pulag', { x: 3 * T + (i % 6) * 40, y: 3 * T + Math.floor(i / 6) * 40 }));
  }
  copies[30] = room.copies();
  assert.deepStrictEqual([1, 6, 11, 12, 17, 18, 24, 30].map((n) => copies[n]), [1, 1, 1, 2, 2, 3, 3, 3]);
  const at = ps.map((p, i) => (i ? { x: 3 * T + (i % 6) * 40, y: 3 * T + Math.floor(i / 6) * 40 } : { x: 3 * T, y: 3 * T }));
  const base = room.roster(0);
  // a few minutes on: copies 1 and 2 walk in, one at a time per copy, out of everyone's sight
  const firstSeen = new Map();
  for (let k = 0; k < 6 * 60 * 20; k++) {
    w.run(50);
    const tk = ps[29].last('tk');
    if (tk) tk.m.forEach((r) => { if (r[0] >= 100 && !firstSeen.has(r[0])) firstSeen.set(r[0], r); });
    ps[29].got.length = 0;
  }
  const up = room.mons.map((a) => a.slot);
  assert.ok(up.some((s) => s >= 100 && s < 200), 'copy 1 is here');
  assert.ok(up.some((s) => s >= 200 && s < 300), 'copy 2 is here');
  assert.ok(!up.some((s) => s >= 300), 'never a 4th');
  room.mons.forEach((a) => {
    if (a.slot < 100) return;
    const e = base.find((x) => x.slot === a.slot % 100);
    assert.ok(e && e.kind === a.kind, 'a copy of the place\'s own slot: ' + a.slot + ' ' + a.kind);
    assert.ok(!a.def.rare && !a.def.great, 'never a second rare one');
  });
  firstSeen.forEach((r) => assert.ok(!near(r, at, 5.9, T), 'walked in out of sight: ' + r[0]));
  // the crowd goes: a copy no longer brought walks off once nobody can see it
  for (let i = 29; i >= 6; i--) ps[i].say({ t: 'bye' });
  assert.strictEqual(room.copies(), 1);
  room.mons.forEach((a) => { if (a.slot >= 100) { a.x = 28 * T; a.y = 24 * T; a.mode = 'idle'; a.vx = a.vy = 0; a.t = 1e9; } });
  w.run(6000);
  assert.ok(!room.mons.some((a) => a.slot >= 100), 'the copies walked off');
  assert.ok(room.mons.some((a) => a.slot < 100), 'the place\'s own stay');
});

test('the Great Mammoth: on its weekend only, and only with two or more hunters, as strong as the crew', async () => {
  const sat = FRI_4PM + DAY;
  const w = world({ t: sat }), R = w.game.R, T = R.T;
  assert.ok(R.L.weekendMarket(sharedState(sat).day));
  const a = await w.pub('a', 'magayon', { x: 3 * T, y: 3 * T });
  const room = w.pubRoom('magayon', 1);
  assert.ok(!a.last('wl').mons.some((r) => kindOf(R, r) === 'greatmammoth'), 'never there for a first visitor');
  w.run(4 * 60000);
  assert.ok(!room.mons.some((x) => x.def.great), 'never for one hunter alone');
  await w.pub('b', 'magayon', { x: 3 * T, y: 4 * T });
  w.run(90000);
  const g = room.mons.find((x) => x.def.great);
  assert.ok(g, 'two: it walks in');
  assert.strictEqual(g.slot, R.L.wildSlots('magayon').find((e) => e.kind === 'greatmammoth').slot);
  assert.strictEqual(g.max, R.WI.animals.greatmammoth.hpEach * 2);
  // a crowd: as strong as nine (its own hp, what the phones' L.wildUnpack shows at most)
  assert.strictEqual(w.game.wild.walkIn(room.fl, 'greatmammoth', 8, [], 30).max, R.WI.animals.greatmammoth.hp);
  // on a Friday, never, even for two
  const v = world({ t: FRI_4PM });
  await v.pub('a', 'magayon', { x: 3 * T, y: 3 * T });
  await v.pub('b', 'magayon', { x: 3 * T, y: 4 * T });
  v.run(5 * 60000);
  assert.ok(!v.pubRoom('magayon', 1).mons.some((x) => x.def.great));
});

test('wolves only at night (Philippine time); at sunrise they walk off out of sight; the tame never comes, even for 30 over minutes', async () => {
  const night = FRI_4PM + 4 * H; // 8 PM
  const w = world({ t: night }), R = w.game.R, T = R.T;
  const a = await w.pub('a', 'makiling', { x: 3 * T, y: 3 * T });
  assert.ok(a.last('wl').mons.some((r) => kindOf(R, r) === 'wolf'), 'wolves at 8 PM');
  const day = world({ t: FRI_4PM });
  assert.ok(!(await day.pub('a', 'makiling')).last('wl').mons.some((r) => kindOf(R, r) === 'wolf'), 'none at 4 PM');
  // morning comes (6 AM): the wolves go once out of sight
  w.wait(10 * H);
  a.say({ t: 'pi', c: 1 }); // (still here)
  const room = w.pubRoom('makiling', 1);
  room.mons.forEach((x) => { if (x.kind === 'wolf') { x.x = 27 * T; x.y = 26 * T; x.mode = 'idle'; x.vx = x.vy = 0; x.t = 1e9; } });
  w.run(6000);
  assert.ok(!room.mons.some((x) => x.kind === 'wolf'));
  assert.ok(!room.gone.size, 'walked off, not hunted: no slot waits');

  // Banaue with 30 hunters for 8 minutes: never its tame itik
  const v = world({ seed: 5 });
  const ps = [];
  for (let i = 0; i < 30; i++) ps.push(await v.pub('p' + i, 'banaue', { x: 3 * T + (i % 6) * 40, y: 3 * T + Math.floor(i / 6) * 40 }));
  const isTame = (r) => R.WI.animals[kindOf(R, r)].tameOnly;
  assert.ok(!ps.some((p) => p.last('wl').mons.some(isTame)));
  for (let k = 0; k < 8 * 60 * 20; k++) {
    v.run(50);
    const tk = ps[0].last('tk');
    assert.ok(!tk || !tk.m.some(isTame));
    ps[0].got.length = 0;
  }
  assert.ok(!v.pubRoom('banaue', 1).mons.some((x) => x.def.tameOnly));
});

test('bait: one a phone at a time, the nearest shy one walks to it and eats; the others are told (and a late comer); not in a cave', async () => {
  const w = world(), R = w.game.R, T = R.T, W = w.game.wild;
  const a = await w.pub('a', 'banaue', { x: 2 * T, y: 2 * T });
  const b = await w.pub('b', 'banaue', { x: 2 * T, y: 3 * T });
  const room = w.pubRoom('banaue', 1), fl = room.fl;
  // a shy one, far from both, with open ground beside it
  const free = (x, y) => W.wildFree(fl, Math.floor(x / T), Math.floor(y / T));
  let shy = null, spot = null;
  room.mons.filter((x) => x.def.shy).forEach((x) => {
    if (spot || Math.hypot(x.x - 2 * T, x.y - 2 * T) < 8 * T) return;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      if (spot) return;
      if (free(x.x + dx * T * 0.5, x.y + dy * T * 0.5) && free(x.x + dx * T, x.y + dy * T) && free(x.x + dx * T * 1.5, x.y + dy * T * 1.5)) { shy = x; spot = { x: Math.round(x.x + dx * T * 1.5), y: Math.round(x.y + dy * T * 1.5) }; }
    });
  });
  assert.ok(shy, 'a shy animal with room beside it');
  shy.mode = 'idle'; shy.vx = shy.vy = 0;
  a.say({ t: 'bt', x: spot.x, y: spot.y });
  const until = w.now() + R.WI.baitMins * 60000 + 30000;
  assert.deepStrictEqual(b.last('bt'), { t: 'bt', id: 'a', x: spot.x, y: spot.y, until });
  assert.ok(!a.last('bt'), 'not back to the one who put it down');
  assert.strictEqual(shy.mode, 'toBait');
  w.run(4000);
  assert.strictEqual(shy.mode, 'eat', 'it got there and eats');
  assert.ok(Math.hypot(shy.x - spot.x, shy.y - spot.y) < 0.4 * T);
  assert.ok(b.all('tk').some((t) => t.m.some((r) => r[0] === shy.slot && R.L.wildUnpack(r).mode === 'eat')), 'the phones see it eat');
  // one at a time: a second while the first is down is not put down
  a.say({ t: 'bt', x: 3 * T, y: 3 * T });
  assert.strictEqual(b.all('bt').length, 1);
  // a late comer is told of it, after its wl
  const c = await w.pub('c', 'banaue', { x: 3 * T, y: 3 * T });
  const i = c.got.findIndex((m) => m.t === 'wl');
  assert.deepStrictEqual(c.got.slice(i + 1).find((m) => m.t === 'bt'), { t: 'bt', id: 'a', x: spot.x, y: spot.y, until });
  // nonsense is dropped
  b.say({ t: 'bt', x: 'here', y: 1 });
  assert.strictEqual(a.all('bt').length, 0);
  // once it has run out, another
  w.run(R.WI.baitMins * 60000 + 30000);
  assert.strictEqual(room.baits.size, 0);
  a.say({ t: 'bt', x: 3 * T, y: 3 * T });
  assert.strictEqual(b.all('bt').length, 2);
  // a cave keeps bait on the old relay (step 1): nothing happens
  const k1 = await w.phone('k1', { floor: 2 }), k2 = await w.phone('k2', { floor: 2 });
  k1.say({ t: 'bt', x: 1000, y: 1000 });
  k1.say({ t: 'ar', x: 1000, y: 1000, a: 1, l: 500, b: 1 });
  assert.ok(!k2.last('bt') && !k2.last('ar'));
});

test('an arrow in flight goes to the phones that see the shooter, cleaned and small; never damage; at most 8 a second', async () => {
  const w = world(), T = w.game.R.T;
  const a = await w.pub('a', 'banaue', { x: 2 * T, y: 2 * T });
  const b = await w.pub('b', 'banaue', { x: 4 * T, y: 2 * T });
  const far = await w.pub('far', 'banaue', { x: 2 * T + 20 * T, y: 2 * T + 20 * T });
  w.run(50);
  const room = w.pubRoom('banaue', 1), hp = room.mons.map((x) => x.hp);
  a.say({ t: 'ar', x: 600, y: 700.6, a: 1.23456789, l: 99999, b: 7, junk: 'x'.repeat(2000), s: 0, d: 4 });
  assert.deepStrictEqual(b.last('ar'), { t: 'ar', id: 'a', x: 600, y: 701, a: 1.235, l: 8 * T, b: 3 });
  assert.ok(!far.last('ar'), 'out of view: not told');
  assert.ok(!a.last('ar'), 'not back to the shooter');
  assert.deepStrictEqual(room.mons.map((x) => x.hp), hp, 'an arrow in flight never hurts anything');
  b.say({ t: 'ar', x: 'q', y: 1, a: 0 });
  b.say({ t: 'ar', x: 1, y: 1 });
  assert.ok(!a.last('ar'), 'nonsense is dropped');
  w.wait(1000);
  for (let i = 0; i < 12; i++) a.say({ t: 'ar', x: 600, y: 700, a: 0.5, l: 300, b: 1 });
  assert.strictEqual(b.all('ar').length, 1 + 8);
});

test('a public room never sends cl, even with every animal down; hits, shares and charges as a cave', async () => {
  const w = world(), R = w.game.R, T = R.T;
  const a = await w.pub('a', 'bohol', { x: 3 * T, y: 3 * T });
  const b = await w.pub('b', 'bohol', { x: 3 * T, y: 4 * T });
  const room = w.pubRoom('bohol', 1);
  const first = room.mons[0];
  a.say({ t: 'mv', x: first.x + 100, y: first.y, dir: 'left', m: 0 });
  a.say({ t: 'hit', s: first.slot, d: 1, n: 1 });
  assert.deepStrictEqual(b.last('hp'), { t: 'hp', s: first.slot, hp: first.def.hp - 1, by: 'a', n: 1 });
  while (room.mons.length) kill(w, a, room, room.mons[0]);
  w.run(100);
  assert.ok(!a.last('cl') && !b.last('cl'));
  assert.ok(b.all('dn').length >= 3 && b.all('dn').every((d) => d.by.includes('a')));
});

test('a cave row carries the look only when the phone sent one (step 1 rows stay as they were)', async () => {
  const w = world();
  await w.phone('anna', { floor: 4, lk: { cs: 'robe', pt: 0, rd: 1 } });
  const b = await w.phone('ben', { floor: 4 });
  assert.deepStrictEqual(b.last('wl').ppl, [['anna', 'anna', 'boy', 1408, 922, 'down', 0, { cs: 'robe', pt: 0, rd: 1 }]]);
  const c = await w.phone('cara', { floor: 4 });
  assert.deepStrictEqual(c.last('wl').ppl.find((r) => r[0] === 'ben'), ['ben', 'ben', 'boy', 1408, 922, 'down', 0]);
});
