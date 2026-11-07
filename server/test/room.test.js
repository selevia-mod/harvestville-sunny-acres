// The rooms with fake phones (docs/game-server.md): joining, a full floor, refusals, hits and their limits, who shares a
// kill, the floor cleared, a charge that reaches you, a reconnect, the bosses' strength and the Bakunawa.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { world, TOPIC } = require('./helpers');

const plain = (x) => JSON.parse(JSON.stringify(x));

test('a good hi: the whole floor (as a first visitor finds it), and the others see you come', async () => {
  const w = world(), R = w.game.R, L = R.L;
  const a = await w.phone('anna', { floor: 3 });
  const wl = a.last('wl');
  assert.strictEqual(wl.you, 'anna');
  assert.strictEqual(wl.tick, 50);
  assert.strictEqual(wl.cap, 8);
  assert.deepStrictEqual(wl.ppl, []);
  // the floor's own list, in its order, as tough as the floor makes them, packed as L.wildPack packs them
  const roster = plain(L.lairRoster(3));
  assert.deepStrictEqual(wl.mons.map((r) => r[0]), roster.map((e) => e.slot));
  wl.mons.forEach((r, i) => {
    const o = L.wildUnpack(r);
    assert.strictEqual(o.kind, roster[i].kind);
    assert.strictEqual(o.hp, L.lairHp(o.kind, 3));
    assert.ok(Math.hypot(o.x - 1408, o.y - 922) >= 6 * R.T, 'placed 6 tiles or more from the first phone');
  });
  const b = await w.phone('ben', { floor: 3, name: 'Ben', look: 'girl', x: 2000, y: 2000 });
  assert.deepStrictEqual(b.last('wl').ppl, [['anna', 'anna', 'boy', 1408, 922, 'down', 0]]);
  assert.deepStrictEqual(b.last('wl').mons, wl.mons, 'the same monsters for both');
  w.run(50);
  assert.deepStrictEqual(a.last('tk').come, [['ben', 'Ben', 'girl', 2000, 2000, 'down', 0]]);
  assert.strictEqual(b.all('tk').filter((t) => t.come.length).length, 0, 'not told of yourself');
  // a move goes to the others, not back to you
  b.say({ t: 'mv', x: 2100, y: 2000, dir: 'right', m: 1, hg: 0, sk: 0 });
  w.run(50);
  assert.deepStrictEqual(a.last('tk').p, [['ben', 2100, 2000, 'right', 1]]);
  assert.ok(!b.got.some((m) => m.t === 'tk' && m.p.some((p) => p[0] === 'ben')));
  // ping
  a.say({ t: 'pi', c: 1234 });
  assert.deepStrictEqual(a.last('po'), { t: 'po', c: 1234, st: w.now() });
  // a place's cave too: Banaue's tunnels, floor 10, its guard first (50 floors now: a guard every 10th)
  const c = await w.phone('cara', { map: 'banaue_cave', floor: 10 });
  const g = L.wildUnpack(c.last('wl').mons[0]);
  assert.strictEqual(g.kind, 'kibaan_chief');
});

test('a place\'s cave is 50 floors (owner, 8 Nov 2026): its guard every 10th floor, tougher the deeper; its boss on 50; no floor 51', async () => {
  const w = world(), L = w.game.R.L;
  const hp = async (floor, who) => { const p = await w.phone(who, { map: 'banaue_cave', floor }); return L.wildUnpack(p.last('wl').mons[0]); };
  const g10 = await hp(10, 'g10'), g40 = await hp(40, 'g40'), boss = await hp(50, 'b50');
  assert.deepStrictEqual([g10.kind, g40.kind, boss.kind], ['kibaan_chief', 'kibaan_chief', 'amomongo']);
  assert.strictEqual(g40.hp - g10.hp, 15, '0.5 more for each floor below floor 10');
  assert.strictEqual((await w.phone('x', { map: 'banaue_cave', floor: 51 })).last('no').why, 'topic', 'no floor 51');
});

test('a refused hi: version, topic, auth (and the socket is closed)', async () => {
  const w = world();
  const v = await w.phone('a', { v: 2 });
  assert.deepStrictEqual(v.last('no'), { t: 'no', why: 'version' });
  assert.ok(v.closed);
  assert.strictEqual((await w.phone('b', { topic: 'farm:nope' })).last('no').why, 'topic');
  assert.strictEqual((await w.phone('b', { map: 'farm' })).last('no').why, 'topic', 'not a cave');
  assert.strictEqual((await w.phone('b', { floor: 51 })).last('no').why, 'topic', 'no such floor');
  assert.strictEqual((await w.phone('b', { token: 'stolen' })).last('no').why, 'auth');
  assert.strictEqual((await w.phone('outsider')).last('no').why, 'topic', 'Supabase says no: not on this farm');
  assert.strictEqual(w.game.rooms.size, 0, 'no room made for them');
});

test('at most 8 on a floor: the 9th is told it is full; one of the 8 coming back still gets in', async () => {
  const w = world();
  const ps = [];
  for (let i = 0; i < 8; i++) ps.push(await w.phone('p' + i));
  ps.forEach((p) => assert.ok(p.last('wl')));
  const ninth = await w.phone('p8');
  assert.deepStrictEqual(ninth.last('no'), { t: 'no', why: 'full' });
  assert.ok(ninth.closed);
  assert.strictEqual(w.room('lair', 1).players.size, 8);
  // another floor has room
  assert.ok((await w.phone('p8', { floor: 2 })).last('wl'));
  // p3's phone reconnects on a new socket: in, and its old socket is let go
  const again = await w.phone('p3');
  assert.ok(again.last('wl'));
  assert.strictEqual(ps[3].closed.code, 4001);
  assert.strictEqual(w.room('lair', 1).players.size, 8);
});

test('a hit: everyone hears it at once; the damage is capped; one a 150 ms per phone per monster; not from afar', async () => {
  const w = world(), R = w.game.R;
  const a = await w.phone('a', { floor: 30 }); // a Bungisngis guards it: 39 hp
  const b = await w.phone('b', { floor: 30 });
  const boss = a.last('wl').mons[0];
  assert.strictEqual(R.L.wildUnpack(boss).kind, 'bungisngis');
  a.say({ t: 'mv', x: boss[2] + 300, y: boss[3], dir: 'left', m: 0 });
  a.say({ t: 'hit', s: 0, d: 2, n: 1 });
  assert.deepStrictEqual(a.last('hp'), { t: 'hp', s: 0, hp: 37, by: 'a', n: 1 });
  assert.deepStrictEqual(b.last('hp'), { t: 'hp', s: 0, hp: 37, by: 'a', n: 1 });
  // again at once: not counted, and only this phone is told (its bar comes back)
  a.say({ t: 'hit', s: 0, d: 2, n: 2 });
  assert.deepStrictEqual(a.last('hp'), { t: 'hp', s: 0, hp: 37, by: 'a', n: 2 });
  assert.strictEqual(b.all('hp').length, 1);
  w.wait(150);
  a.say({ t: 'hit', s: 0, d: 999, n: 3 }); // no bow hits that hard: the best bow and a strong shot
  assert.strictEqual(a.last('hp').hp, 37 - R.maxDamage);
  assert.strictEqual(R.maxDamage, 4);
  // nonsense is dropped
  w.wait(150);
  a.say({ t: 'hit', s: 0, d: 'lots', n: 4 });
  a.say({ t: 'hit', s: 9, d: 1, n: 5 });
  assert.strictEqual(a.all('hp').length, 3);
  // from across the cave (12 tiles or more): not counted
  b.say({ t: 'mv', x: 100, y: 100, dir: 'down', m: 0 });
  const hpNow = a.last('hp').hp;
  b.say({ t: 'hit', s: 0, d: 1, n: 1 });
  assert.strictEqual(b.last('hp').hp, hpNow);
  assert.strictEqual(a.last('hp').hp, hpNow);
});

// every monster on the floor shot down by these phones, standing beside each in turn
const shootAll = (w, phones, opts) => {
  const o = opts || {}, room = w.room(o.map || 'lair', o.floor || 1);
  let n = 0, guard = 0;
  while (room.mons.length && guard++ < 2000) {
    const m = room.mons[0];
    phones.forEach((p) => {
      if (!room.mons.includes(m)) return;
      p.say({ t: 'mv', x: m.x + 200, y: m.y, dir: 'left', m: 0 });
      p.say({ t: 'hit', s: m.slot, d: 1, n: ++n });
    });
    w.wait(160);
  }
};

test('a kill: dn to everyone with the shares (minHits hits, and the last hit); the floor clear: cl to everyone', async () => {
  const w = world();
  const a = await w.phone('a', { map: 'banaue_cave', floor: 50 }); // the Amomongo: minHits 3
  const b = await w.phone('b', { map: 'banaue_cave', floor: 50 });
  const c = await w.phone('c', { map: 'banaue_cave', floor: 50 });
  const room = w.room('banaue_cave', 50), boss = room.mons[0];
  assert.strictEqual(boss.kind, 'amomongo');
  assert.strictEqual(boss.def.minHits, 3);
  const at = (p) => p.say({ t: 'mv', x: boss.x + 200, y: boss.y, dir: 'left', m: 0 });
  [a, b, c].forEach(at);
  const hit = (p, n) => { at(p); p.say({ t: 'hit', s: boss.slot, d: 4, n }); w.wait(160); };
  // a: 3 hits, b: 1 hit; c lands the last
  hit(a, 1); hit(a, 2); hit(a, 3); hit(b, 1);
  boss.hp = 2; // (the rest of its hp: as if they had kept at it)
  hit(c, 1);
  const dn = a.last('dn');
  assert.strictEqual(dn.s, boss.slot);
  assert.strictEqual(dn.kind, 'amomongo');
  assert.deepStrictEqual(dn.by.sort(), ['a', 'c'], 'b landed only 1 of 3: no share');
  assert.deepStrictEqual(b.last('dn'), dn);
  assert.strictEqual(typeof dn.size, 'number');
  assert.strictEqual(a.last('hp').hp, 0, 'its last hp comes first');
  assert.ok(!a.last('cl'), 'not clear yet: its escort is still about');
  w.run(50);
  assert.ok(a.last('tk').gone.includes(boss.slot));
  shootAll(w, [a, b], { map: 'banaue_cave', floor: 50 });
  [a, b, c].forEach((p) => assert.strictEqual(p.all('cl').length, 1, 'cl once, to everyone'));
  // a friend who comes later finds it clear
  const late = await w.phone('d', { map: 'banaue_cave', floor: 50 });
  assert.deepStrictEqual(late.last('wl').mons, []);
  assert.ok(late.last('cl'));
});

test('a charge that reaches you: bp to you only, with its hit; it backs off', async () => {
  const w = world();
  const a = await w.phone('a', { floor: 30 });
  const b = await w.phone('b', { floor: 30, x: 1408, y: 922 });
  const room = w.room('lair', 30), boss = room.mons[0];
  boss.x = 2000; boss.y = 2600; boss.mode = 'idle'; boss.t = 99999;
  a.say({ t: 'mv', x: 2000 + 2.5 * 256, y: 2600, dir: 'left', m: 0 }); // 2.5 tiles: it is angry at 5
  let guard = 0;
  while (!a.last('bp') && guard++ < 100) w.run(50);
  assert.deepStrictEqual(a.last('bp'), { t: 'bp', s: boss.slot, hit: boss.def.hit });
  assert.strictEqual(b.all('bp').length, 0);
  assert.strictEqual(boss.mode, 'walk');
  assert.strictEqual(boss.cool, 5000);
  w.run(1000);
  assert.strictEqual(a.all('bp').filter((m) => m.s === boss.slot).length, 1, 'once: then it keeps away a while');
});

test('a shy one runs from you; walls, the zone and the gate hold every monster', async () => {
  const w = world();
  const a = await w.phone('a', { floor: 2 });
  const room = w.room('lair', 2), fl = room.fl, T = 256;
  const s = room.mons.filter((m) => m.kind === 'santelmo')[0];
  assert.ok(s, 'floor 2 has a Santelmo');
  s.mode = 'idle'; s.t = 99999;
  a.say({ t: 'mv', x: s.x + T, y: s.y, dir: 'left', m: 1 });
  w.run(50);
  assert.strictEqual(s.mode, 'flee');
  // a minute of running about: every one on free ground (a Santelmo flies when it flees: within the zone)
  for (let k = 0; k < 1200; k++) {
    w.run(50);
    room.mons.forEach((m) => {
      if (m.def.flies && m.mode === 'flee') {
        const z = fl.zone;
        assert.ok(m.x >= z.x0 * T && m.x <= (z.x1 + 1) * T && m.y >= z.y0 * T && m.y <= (z.y1 + 1) * T);
      } else assert.ok(w.game.wild.wildFree(fl, Math.floor(m.x / T), Math.floor(m.y / T)), m.kind + ' on a wall at ' + m.x + ',' + m.y);
    });
    if (k % 10 === 0) a.say({ t: 'mv', x: 1408 + (k % 400) * 8, y: 1500 + (k % 300) * 6, dir: 'down', m: 1 });
  }
});

test('a dropped phone: the others see it go; back, it gets the whole floor again, and its hits still count', async () => {
  const w = world();
  const a = await w.phone('a', { map: 'bohol_cave', floor: 50 }); // the Great Nuno: minHits 3
  const b = await w.phone('b', { map: 'bohol_cave', floor: 50 });
  const room = w.room('bohol_cave', 50), boss = room.mons[0];
  const at = (p) => p.say({ t: 'mv', x: boss.x + 200, y: boss.y, dir: 'left', m: 0 });
  for (let n = 1; n <= 3; n++) { at(a); a.say({ t: 'hit', s: boss.slot, d: 2, n }); w.wait(160); }
  const hp = boss.hp;
  a.drop();
  w.run(50);
  assert.deepStrictEqual(b.last('tk').left, ['a']);
  w.run(2000);
  const back = await w.phone('a', { map: 'bohol_cave', floor: 50, x: 1500, y: 1500 });
  const wl = back.last('wl');
  assert.deepStrictEqual(wl.ppl.map((p) => p[0]), ['b']);
  const row = wl.mons.filter((r) => r[0] === boss.slot)[0];
  assert.strictEqual(row[7], hp, 'its hp as the hits left it');
  assert.deepStrictEqual(wl.mons.map((r) => r[0]), room.mons.map((m) => m.slot));
  w.run(50);
  assert.deepStrictEqual(b.last('tk').come.map((p) => p[0]), ['a']);
  // b finishes it: a still has its 3 hits
  boss.hp = 1;
  at(b);
  b.say({ t: 'hit', s: boss.slot, d: 1, n: 1 });
  assert.deepStrictEqual(back.last('dn').by.sort(), ['a', 'b']);
});

test('bye leaves the floor; an empty floor stays as it is 30 s, then goes', async () => {
  const w = world();
  const a = await w.phone('a', { floor: 4 });
  const first = a.last('wl').mons;
  a.say({ t: 'bye' });
  assert.strictEqual(w.room('lair', 4).players.size, 0);
  w.run(10000);
  const back = await w.phone('a', { floor: 4 });
  assert.deepStrictEqual(back.last('wl').mons, first, 'the same monsters, where they were (an empty floor stands still)');
  back.say({ t: 'bye' });
  // a new floor on the same socket after bye
  back.say({ t: 'hi', v: 1, token: 'tok:a', topic: TOPIC, map: 'lair', floor: 5, name: 'a', look: 'boy', x: 1408, y: 922, dir: 'down', hg: 0, sk: 0 });
  await new Promise((r) => setImmediate(r));
  assert.ok(w.room('lair', 5).players.has('a'));
  w.run(31000);
  assert.ok(!w.room('lair', 4), 'gone after 30 s empty');
  assert.ok(w.room('lair', 5), 'a floor with someone on it stays');
});

test("a place's boss grows for each friend who comes down (L.dunHp), and never shrinks", async () => {
  const w = world(), L = w.game.R.L;
  const a = await w.phone('a', { map: 'taal_crater', floor: 50 });
  const room = w.room('taal_crater', 50), boss = room.mons[0];
  assert.strictEqual(boss.kind, 'berberoka');
  assert.strictEqual(boss.hp, L.dunHp('berberoka', 1));
  const b = await w.phone('b', { map: 'taal_crater', floor: 50 });
  const c = await w.phone('c', { map: 'taal_crater', floor: 50 });
  assert.strictEqual(boss.max, L.dunHp('berberoka', 3));
  assert.strictEqual(L.wildUnpack(c.last('wl').mons[0]).max, L.dunHp('berberoka', 3));
  b.say({ t: 'bye' });
  assert.strictEqual(boss.max, L.dunHp('berberoka', 3));
  void a;
});

test('Lair floor 50: the Bakunawa rises for two or more whose Bakunawa is ready today, as strong as the crew, once', async () => {
  const w = world();
  const a = await w.phone('a', { floor: 50, bk: 1 });
  const room = w.room('lair', 50);
  assert.deepStrictEqual(room.mons.map((m) => m.kind).sort(), ['tikbalang', 'tikbalang'], 'it sleeps for one hunter alone');
  w.run(45000);
  assert.ok(!room.mons.some((m) => m.kind === 'bakunawa'));
  // a friend whose Bakunawa was already hunted today: still asleep
  const b = await w.phone('b', { floor: 50, bk: 0 });
  w.run(90000);
  assert.ok(!room.mons.some((m) => m.kind === 'bakunawa'), 'two hunters, but only one of them ready');
  // a third, ready: it rises (hp for the three)
  const c = await w.phone('c', { floor: 50, bk: 1 });
  let guard = 0;
  while (!room.mons.some((m) => m.kind === 'bakunawa') && guard++ < 1000) w.run(50);
  const bk = room.mons.filter((m) => m.kind === 'bakunawa')[0];
  assert.ok(bk, 'it rose');
  assert.strictEqual(bk.hp, 60);
  assert.strictEqual(bk.max, 60);
  assert.strictEqual(bk.size, 1);
  assert.ok(a.got.some((m) => m.t === 'tk' && m.m.some((r) => r[0] === bk.slot)), 'every phone hears it');
  shootAll(w, [a, b, c], { floor: 50 });
  assert.ok(a.last('cl'));
  w.run(90000);
  assert.ok(!room.mons.length, 'once');
});

test('a player with a menu open (b: 1) is not seen: nothing runs from them or charges them, until they close it', async () => {
  const w = world();
  const a = await w.phone('a', { floor: 30, b: 1 });
  const room = w.room('lair', 30), boss = room.mons[0];
  boss.x = 2000; boss.y = 2600; boss.mode = 'idle'; boss.t = 99999;
  a.say({ t: 'mv', x: 2000 + 2 * 256, y: 2600, dir: 'left', m: 0, b: 1 });
  w.run(3000);
  assert.strictEqual(a.all('bp').length, 0);
  assert.notStrictEqual(boss.mode, 'charge');
  assert.deepStrictEqual(room.fl.crew, []);
  // a shy one beside them does not run either
  const s = room.mons.filter((m) => m.def.shy)[0];
  if (s) { s.x = 2000; s.y = 2600 + 256; s.mode = 'idle'; s.t = 99999; w.run(100); assert.notStrictEqual(s.mode, 'flee'); }
  // menu closed: it sees them, and charges
  boss.t = 99999;
  a.say({ t: 'mv', x: 2000 + 2 * 256, y: 2600, dir: 'left', m: 0, b: 0 });
  let guard = 0;
  while (!a.last('bp') && guard++ < 100) w.run(50);
  assert.ok(a.last('bp'));
});
