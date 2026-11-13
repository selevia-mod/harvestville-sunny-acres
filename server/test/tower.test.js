// The Lost Tower on the game server (lib/tower.js; docs/game-server.md "Step 4"): a floor is a cave room of up to 4,
// friends put together from their own farms (`with`), the floor's own enemies (never more for a team), kills shared, one
// clear for all with who is paid (`cl` with `pay` and `nw`), and the realms' tricks the server runs: shields, healers,
// flocks, splitters, revivers, waves. Fake phones (test/helpers.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { world } = require('./helpers');
const { rules } = require('../lib/rules');

const R = rules();
const { C, L, T } = R;
const TW = C.TOWER;
const farm = (n) => 'farm:' + String(n).padStart(8, '0') + '-0000-4000-8000-000000000000';
const own = { ann: farm(1), bo: farm(2), cy: farm(3), dee: farm(4), eve: farm(5), fay: farm(6) };
const IN = { x: Math.round(5.5 * T), y: Math.round(3.6 * T) }; // (where a floor's way in puts you)
const up = (w, uid, floor, more) => w.phone(uid, Object.assign({ topic: own[uid], map: 'tower', floor, x: IN.x, y: IN.y, with: Object.keys(own) }, more || {}));
// walks up to it and hits it (d at a time, k the weapon), 200 ms later the next
let hitN = 0;
const strike = (w, p, a, d, k) => {
  p.say({ t: 'mv', x: Math.round(a.x), y: Math.round(a.y), dir: 'down', m: 0 });
  p.say(Object.assign({ t: 'hit', s: a.slot, d: d || 1, n: ++hitN }, k ? { k } : {}));
  w.run(200);
};
// everyone hits a different one until none is left (or `stop` says so)
const clearFloor = (w, phones, room, d, stop) => {
  for (let guard = 0; room.mons.length && guard < 4000; guard++) {
    if (stop && stop()) return;
    phones.forEach((p, i) => { const a = room.mons[i % room.mons.length]; if (a) { p.say({ t: 'mv', x: Math.round(a.x), y: Math.round(a.y), dir: 'down', m: 0 }); p.say({ t: 'hit', s: a.slot, d: d || 5, n: ++hitN }); } });
    w.run(200);
  }
};
const find = (room, fn) => room.mons.filter(fn)[0];

test('a tower floor: its own map, the floor\'s 20 enemies as strong as the floor, up to 4 friends from their own farms on it, the enemies never more for a team', async () => {
  const w = world();
  const ann = await up(w, 'ann', 1, { tn: 1 });
  const wl = ann.last('wl');
  assert.ok(wl, 'welcomed: ' + JSON.stringify(ann.got.slice(0, 2)));
  const room = ann.c.room;
  assert.strictEqual(room.cap, TW.team);
  assert.strictEqual(room.fl.W, 28);
  assert.strictEqual(room.fl.H, 24);
  assert.strictEqual(wl.mons.length, L.towerCount(1), '20 on floor 1');
  assert.deepStrictEqual(wl.tw, { tl: 20, sh: [], ly: [], wv: 0 });
  // the roster's own slots and kinds, each as strong as floor 1 makes it
  assert.deepStrictEqual(room.mons.map((a) => a.slot + ':' + a.kind).sort(), L.towerRoster(1).map((e) => e.slot + ':' + e.kind).sort());
  wl.mons.forEach((row) => { const u = L.wildUnpack(row); assert.ok(u && u.hp === 2 && u.max === 2, 'two hits at damage 1: ' + JSON.stringify(row)); });
  room.mons.forEach((a) => assert.strictEqual(a.def.hit, L.towerLoss(1, null)));
  // three friends, each from their own farm: on Ann's floor; a fifth: their own
  const bo = await up(w, 'bo', 1), cy = await up(w, 'cy', 1), dee = await up(w, 'dee', 1);
  [bo, cy, dee].forEach((p) => assert.ok(p.c.room === room, 'p on the floor'));
  assert.strictEqual(room.players.size, 4);
  const eve = await up(w, 'eve', 1);
  assert.ok(eve.c.room !== room, 'a full floor (4): your own');
  // the same enemies for everyone, no more for four, and no stronger
  assert.deepStrictEqual(bo.last('wl').mons.map((r) => r[0]).sort(), wl.mons.map((r) => r[0]).sort());
  assert.strictEqual(room.mons.length, 20);
  room.mons.forEach((a) => assert.strictEqual(a.max, 2));
  // a deeper floor: bigger, more of them, stronger, its guard first
  const fay = await up(w, 'fay', 120);
  const deep = fay.c.room;
  assert.deepStrictEqual([deep.fl.W, deep.fl.H], [30, 26]);
  assert.strictEqual(deep.mons.length, 26, '25 and the guard');
  const guard = find(deep, (a) => a.def.role === 'guard');
  assert.strictEqual(guard.max, L.towerHits(120, 'guard'));
  assert.ok(L.wildUnpack(L.wildPack(guard)).max === guard.max, 'the phones see its whole bar');
});

test('kills are shared, one clear for the team: everyone on the floor then is told who was new to it (nw); a friend coming later is not paid; one whose line had dropped is, on coming back', async () => {
  const w = world();
  const ann = await up(w, 'ann', 3, { tn: 1 }), bo = await up(w, 'bo', 3, { tn: 0 }), cy = await up(w, 'cy', 3, { tn: 0 });
  const room = ann.c.room;
  assert.ok(bo.c.room === room, 'bo on the floor');
  // a kill: gone for all, with how many are left
  const a0 = room.mons[0];
  for (let k = 0; k < 3 && room.mons.indexOf(a0) >= 0; k++) strike(w, bo, a0, 1);
  const dn = ann.last('dn');
  assert.strictEqual(dn.s, a0.slot);
  assert.deepStrictEqual(dn.by, ['bo']);
  assert.strictEqual(dn.tl, 19);
  assert.strictEqual(cy.last('dn').tl, 19);
  // Dee's line drops before the end (she was on it), Eve comes after it
  const dee = await up(w, 'dee', 3, { tn: 1 });
  assert.ok(dee.c.room === room, 'dee on the floor');
  dee.drop();
  clearFloor(w, [ann, bo, cy], room);
  assert.strictEqual(room.mons.length, 0);
  [ann, bo, cy].forEach((p) => assert.deepStrictEqual(p.all('cl'), [{ t: 'cl', pay: 1, nw: 2 }], p.uid + ': one clear, Ann and Dee new to it'));
  assert.strictEqual(ann.last('dn').tl, 0);
  // Dee comes back within 30 s: paid; again: not twice
  const dee2 = await up(w, 'dee', 3, { tn: 1 });
  assert.deepStrictEqual(dee2.all('cl'), [{ t: 'cl', pay: 1, nw: 2 }]);
  dee2.say({ t: 'bye' });
  const dee3 = await up(w, 'dee', 3, { tn: 0 });
  assert.deepStrictEqual(dee3.all('cl'), [{ t: 'cl' }]);
  dee3.say({ t: 'bye' }); // (four is a full floor)
  // Eve, a friend coming to the cleared floor (she cleared it before): it opens for her, nothing paid
  const eve = await up(w, 'eve', 3, { tn: 0 });
  assert.ok(eve.c.room === room, 'eve on the floor');
  assert.deepStrictEqual(eve.all('cl'), [{ t: 'cl' }]);
  assert.strictEqual(eve.last('wl').tw.tl, 0);
});

test('one new to a floor never lands on a friend\'s cleared floor (its first-time Pearls would be lost): a fresh one; a helper does, and one owed by a dropped line is let back', async () => {
  const w = world();
  const bo = await up(w, 'bo', 6, { tn: 0 }), room = bo.c.room;
  clearFloor(w, [bo], room);
  assert.strictEqual(room.clear, true);
  const ann = await up(w, 'ann', 6, { tn: 1 });
  assert.ok(ann.c.room !== room, 'Ann, new to floor 6: not on Bo\'s cleared floor');
  assert.strictEqual(ann.c.room.mons.length, 20, 'her own, with its enemies');
  assert.deepStrictEqual(ann.all('cl'), []);
  const cy = await up(w, 'cy', 6, { tn: 0 });
  assert.ok(cy.c.room === ann.c.room, 'Cy (cleared it before) goes to a friend\'s floor that is not cleared: Ann\'s');
  // Bo's own floor, cleared while he was away, and he is new to it now (a game from another phone): a fresh one too
  bo.say({ t: 'bye' });
  const bo2 = await up(w, 'bo', 6, { tn: 1, with: [] });
  assert.ok(bo2.c.room !== room && !bo2.c.room.clear, 'a fresh floor');
  // one whose line dropped at the clear comes back to it, new to it or not (they are paid)
  const dee = await up(w, 'dee', 7, { tn: 1, with: [] }), r7 = dee.c.room;
  const eve = await up(w, 'eve', 7, { tn: 1, with: ['dee'] });
  assert.ok(eve.c.room === r7);
  eve.drop();
  clearFloor(w, [dee], r7);
  const eve2 = await up(w, 'eve', 7, { tn: 1, with: ['dee'] });
  assert.ok(eve2.c.room === r7);
  assert.deepStrictEqual(eve2.all('cl'), [{ t: 'cl', pay: 1, nw: 2 }]);
});

test('alone on a floor: the clear says nobody else was new to it', async () => {
  const w = world();
  const ann = await up(w, 'ann', 2, { tn: 0, with: [] });
  clearFloor(w, [ann], ann.c.room);
  assert.deepStrictEqual(ann.all('cl'), [{ t: 'cl', pay: 1, nw: 0 }]);
  const bo = await up(w, 'bo', 2, { tn: 1, with: [] });
  clearFloor(w, [bo], bo.c.room);
  assert.deepStrictEqual(bo.all('cl'), [{ t: 'cl', pay: 1, nw: 1 }]);
});

test('shields (Pugita\'s Deep): a Bow\'s hit bounces off, a Rifle\'s breaks it for everyone and is spent on it; then it takes hits', async () => {
  const w = world();
  let f = 101, ann, room, a;
  for (; f < 200 && !a; f++) {
    ann = await up(w, 'ann', f, { with: [] });
    room = ann.c.room;
    a = find(room, (x) => x.shield && x.def.role === 'normal');
    if (!a) ann.say({ t: 'bye' });
  }
  assert.ok(a, 'a shielded one on a floor of the second realm');
  const bo = await up(w, 'bo', room.floor, { topic: own.bo, with: ['ann'] });
  assert.ok(bo.c.room === room, 'bo on the floor');
  const hp = a.hp;
  strike(w, ann, a, 3);
  assert.strictEqual(a.hp, hp, 'the Bow bounces');
  assert.strictEqual(ann.last('hp').hp, hp);
  assert.strictEqual(bo.all('sh').length, 0);
  strike(w, ann, a, 3, 'javelin');
  assert.strictEqual(a.hp, hp, 'so does a Javelin');
  strike(w, ann, a, 3, 'rifle');
  assert.strictEqual(a.hp, hp, 'the Rifle\'s shot is spent on the shield');
  assert.strictEqual(a.shield, false);
  assert.deepStrictEqual(bo.last('sh'), { t: 'sh', s: a.slot, by: 'ann' }, 'everyone sees it break');
  strike(w, ann, a, 3);
  assert.strictEqual(a.hp, hp - 3, 'now it takes hits');
  // a friend coming now knows it is broken
  const cy = await up(w, 'cy', room.floor, { topic: own.cy, with: ['ann'] });
  assert.ok(cy.last('wl').tw.sh.indexOf(a.slot) >= 0);
});

test('revivers (Mayari\'s Starfall): beaten, one lies 3 s and stands with half its hits; hit while it lies, it is down for good', async () => {
  const w = world();
  const ann = await up(w, 'ann', 801, { with: [] }), room = ann.c.room;
  const a = find(room, (x) => x.revive && !x.shield && x.def.role === 'normal'), b = find(room, (x) => x.revive && !x.shield && x.def.role === 'normal' && x !== a);
  assert.ok(a && b);
  const max = a.max;
  for (let k = 0; k < 40 && !a.lying; k++) strike(w, ann, a, 5);
  assert.ok(a.lying > 0, 'it lies down');
  assert.strictEqual(ann.last('ly').s, a.slot);
  w.run(100);
  const row = [].concat(...ann.all('tk').map((m) => m.m)).filter((r) => r[0] === a.slot).pop();
  assert.ok(row && L.wildUnpack(row).hp > 0 && L.wildUnpack(row).hp < 1, 'the phones see it with a sliver of hits (their arrows can still find it)');
  assert.ok(room.mons.indexOf(a) >= 0, 'still on the floor (the stairs wait for it)');
  assert.ok(!ann.all('dn').some((m) => m.s === a.slot));
  w.run(3100);
  assert.strictEqual(a.lying, 0);
  assert.deepStrictEqual(ann.last('up'), { t: 'up', s: a.slot, hp: L.towerReviveHp(max) });
  assert.strictEqual(a.hp, L.towerReviveHp(max));
  for (let k = 0; k < 40 && room.mons.indexOf(a) >= 0; k++) strike(w, ann, a, 5);
  assert.ok(room.mons.indexOf(a) < 0 && ann.all('dn').some((m) => m.s === a.slot), 'twice: down');
  // finished while it lies
  for (let k = 0; k < 40 && !b.lying; k++) strike(w, ann, b, 5);
  assert.ok(b.lying);
  strike(w, ann, b, 1);
  assert.ok(room.mons.indexOf(b) < 0 && ann.all('dn').some((m) => m.s === b.slot), 'one more hit while it lay: down');
  assert.ok(!ann.all('up').some((m) => m.s === b.slot));
});

test('splitters (Biringan): a beaten one becomes two at half its hits, slots 10000 up; the floor clears only when they are down too', async () => {
  const w = world();
  const ann = await up(w, 'ann', 701, { with: [] }), room = ann.c.room;
  const a = find(room, (x) => x.split && !x.shield && x.def.role === 'normal');
  assert.ok(a);
  const max = a.max, n0 = room.mons.length;
  for (let k = 0; k < 40 && room.mons.indexOf(a) >= 0; k++) strike(w, ann, a, 5);
  const copies = Array.from(room.mons.filter((x) => L.towerIsCopy(x.slot)));
  assert.deepStrictEqual(Array.from(copies.map((x) => x.slot)).sort(), [L.towerCopySlot(a.slot, 0), L.towerCopySlot(a.slot, 1)]);
  copies.forEach((c) => { assert.strictEqual(c.max, L.towerSplitHp(max)); assert.strictEqual(c.split, false); assert.strictEqual(c.revive, false); assert.strictEqual(c.shield, false); });
  assert.strictEqual(ann.last('dn').tl, n0 + 1, 'one gone, two come');
  w.run(100);
  const told = [].concat(...ann.all('tk').map((m) => m.m)).filter((r) => L.towerIsCopy(r[0]));
  assert.ok(told.length >= 2, 'the copies go to the phones as new rows');
  copies.forEach((c) => { for (let k = 0; k < 40 && room.mons.indexOf(c) >= 0; k++) strike(w, ann, c, 5); });
  assert.ok(copies.every((c) => room.mons.indexOf(c) < 0));
  assert.strictEqual(ann.all('cl').length, 0, 'not clear while the rest are up');
});

test('healers (the Kataw Court): every 4 s a healer mends the most hurt one near it, and everyone is told', async () => {
  const w = world();
  const ann = await up(w, 'ann', 501, { with: [] }), room = ann.c.room;
  const h = find(room, (x) => x.heal);
  assert.ok(h, 'a healer');
  const b = find(room, (x) => x !== h && !x.heal && !x.shield && x.def.role === 'normal');
  b.x = h.x + T; b.y = h.y; // (next to it, hurt)
  b.hp = 1;
  h.healT = 100;
  room.mons.forEach((x) => { x.def = Object.assign({}, x.def, { angry: 0 }); x.vx = x.vy = 0; x.t = 1e9; }); // (they stand still)
  w.run(150);
  assert.deepStrictEqual(ann.last('hl'), { t: 'hl', s: h.slot, to: b.slot });
  assert.strictEqual(b.hp, 1 + L.towerHealOf({ hp: 1, max: b.max }));
});

test('flocks (the Storm Gallery): fliers circle the nearest player together and dive at them; a dive that reaches one is a charge (bp)', async () => {
  const w = world();
  const ann = await up(w, 'ann', 401, { with: [] }), room = ann.c.room;
  const flock = room.mons.filter((a) => a.fs);
  assert.ok(flock.length >= 3, 'fliers in flocks');
  const groups = new Set(flock.map((a) => a.fs));
  groups.forEach((fs) => assert.ok(fs.members.length >= 3 && fs.members.length <= 5, 'a flock of 3 to 5'));
  const before = flock.map((a) => [a.x, a.y]);
  w.run(2000);
  assert.ok(flock.some((a, i) => Math.hypot(a.x - before[i][0], a.y - before[i][1]) > T / 2), 'they fly');
  // every row the phones get is a row they can read (no 'flock' mode on the wire)
  [].concat(...ann.all('tk').map((m) => m.m)).forEach((r) => assert.ok(L.wildUnpack(r) || r[0] >= 10000, 'readable: ' + JSON.stringify(r)));
  w.run(20000);
  assert.ok(ann.all('bp').some((m) => flock.some((a) => a.slot === m.s)), 'a dive reached Ann');
});

test('waves (C.TOWER.wave): the floor\'s enemies come in waves when the phones\' test asks for them; the stairs wait for the last wave', async () => {
  const was = TW.wave;
  TW.wave = 8;
  try {
    const w = world();
    const ann = await up(w, 'ann', 2, { with: [] }), room = ann.c.room;
    assert.strictEqual(room.mons.length, 8, 'the first wave');
    assert.strictEqual(ann.last('wl').tw.tl, 20);
    clearFloor(w, [ann], room, 5, () => ann.all('wv').length > 0);
    assert.deepStrictEqual(ann.last('wv'), { t: 'wv', n: 2, of: 3 });
    assert.ok(room.mons.length > 6 && ann.all('cl').length === 0, 'the second came when the first was mostly down');
    clearFloor(w, [ann], room, 5);
    assert.deepStrictEqual(ann.all('wv').map((m) => m.n), [2, 3]);
    assert.deepStrictEqual(ann.all('cl'), [{ t: 'cl', pay: 1, nw: 0 }], 'clear after the last wave');
  } finally { TW.wave = was; }
});

test('fq: on which tower floors your friends are, with space and let in by the server\'s check; the lift can take you there', async () => {
  const w = world();
  const ann = await up(w, 'ann', 13, { with: [] });
  const bo = await up(w, 'bo', 41, { with: [] });
  await up(w, 'cy', 41, { topic: own.cy, with: ['bo'] });
  bo.say({ t: 'fq', with: ['ann', 'zed'] });
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(bo.last('fq'), { t: 'fq', f: [[13, 1, 'ann']] });
  ann.say({ t: 'fq', with: ['bo', 'cy'] });
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(ann.last('fq'), { t: 'fq', f: [[41, 2, 'bo']] });
  ann.say({ t: 'fq', with: ['bo'] });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(ann.all('fq').length, 1, 'one ask in 3 s');
});

test('an old cave floor is as before: 8 a room, no tw in its welcome, a plain cl', async () => {
  const w = world();
  const p = await w.phone('ann');
  assert.strictEqual(p.c.room.cap, 8);
  assert.strictEqual(p.last('wl').tw, undefined);
  assert.strictEqual(p.c.room.tw, null);
});

// ---------- the Tower's food on a shared floor (owner, 13 Nov 2026: "Build the server change now") ----------
// A hit carries `pw`, the power of the Tower dish the hitter ate (L.towerHitPower on the phone).
test('Halo-halo ng Biringan (pw revive): a reviver beaten by its eater lies twice as long (6 s), then stands', async () => {
  const w = world();
  const ann = await up(w, 'ann', 801, { with: [] }), room = ann.c.room;
  const a = find(room, (x) => x.revive && !x.shield && x.def.role === 'normal');
  assert.ok(a);
  for (let k = 0; k < 40 && !a.lying; k++) { ann.say({ t: 'mv', x: Math.round(a.x), y: Math.round(a.y), dir: 'down', m: 0 }); ann.say({ t: 'hit', s: a.slot, d: 5, n: ++hitN, pw: 'revive' }); w.run(200); }
  assert.ok(a.lying > 3200, 'twice 3 s: ' + a.lying);
  assert.strictEqual(L.towerReviveMs(L.towerPowerState('revive')), 2 * R.F.towerTricks.revive.ms);
  w.run(3500);
  assert.ok(a.lying > 0 && !ann.all('up').some((m) => m.s === a.slot), 'still down after 3.5 s');
  w.run(3000);
  assert.strictEqual(a.lying, 0);
  assert.strictEqual(ann.last('up').s, a.slot, 'up after 6 s');
});

test('Bicol Express (pw split): a splitter beaten by its eater becomes two at a quarter of its hits; without it, half', async () => {
  const w = world();
  const ann = await up(w, 'ann', 701, { with: [] }), room = ann.c.room;
  const [a, b] = room.mons.filter((x) => x.split && !x.shield && x.def.role === 'normal');
  assert.ok(a && b);
  const beat = (x, pw) => { for (let k = 0; k < 60 && room.mons.indexOf(x) >= 0; k++) { ann.say({ t: 'mv', x: Math.round(x.x), y: Math.round(x.y), dir: 'down', m: 0 }); ann.say(Object.assign({ t: 'hit', s: x.slot, d: 5, n: ++hitN }, pw ? { pw } : {})); w.run(200); } };
  const max = a.max;
  beat(a, 'split');
  const ca = room.mons.filter((x) => L.towerIsCopy(x.slot) && Math.floor((x.slot - L.towerCopySlot(0, 0)) / 2) === a.slot);
  assert.strictEqual(ca.length, 2);
  ca.forEach((c) => assert.strictEqual(c.max, Math.max(1, Math.ceil(max * 0.25)), 'a quarter'));
  beat(b, null);
  const cb = room.mons.filter((x) => L.towerIsCopy(x.slot) && Math.floor((x.slot - L.towerCopySlot(0, 0)) / 2) === b.slot);
  cb.forEach((c) => assert.strictEqual(c.max, L.towerSplitHp(b.max), 'half, as before'));
});

test('Nido Soup (pw noheal): a healer leaves one its eater hit alone for 5 s, and mends it after; a word it does not know changes nothing', async () => {
  const w = world();
  const ann = await up(w, 'ann', 501, { with: [] }), room = ann.c.room;
  const h = find(room, (x) => x.heal);
  const b = find(room, (x) => x !== h && !x.heal && !x.shield && x.def.role === 'normal');
  assert.ok(h && b);
  room.mons.forEach((x) => { x.def = Object.assign({}, x.def, { angry: 0 }); x.vx = x.vy = 0; x.t = 1e9; });
  b.x = h.x + T; b.y = h.y;
  ann.say({ t: 'mv', x: Math.round(b.x), y: Math.round(b.y), dir: 'down', m: 0 });
  ann.say({ t: 'hit', s: b.slot, d: 1, n: ++hitN, pw: 'noheal' });
  b.hp = 1;
  h.healT = 100;
  w.run(150);
  assert.ok(!ann.all('hl').some((m) => m.to === b.slot), 'not mended while the soup holds');
  assert.strictEqual(b.hp, 1);
  w.run(5200);
  h.healT = 100;
  w.run(150);
  assert.ok(ann.all('hl').some((m) => m.to === b.slot), 'mended once it wears off');
  // a made-up word: as a plain hit
  const was = b.tfNoHeal;
  ann.say({ t: 'hit', s: b.slot, d: 1, n: ++hitN, pw: 'godmode' });
  w.run(200);
  assert.strictEqual(b.tfNoHeal, was, 'a word it does not know: no Nido Soup');
  assert.strictEqual(L.towerPowerState('godmode'), null);
});
