// Unit tests for online play: the snapshot others see, rebuilding a visited farm from it (including junk from a
// misbehaving client), weekly scores, and the save.
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
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { const s = L.newState(); s.seed = 11; return s; };

test('the snapshot has the house, furniture, yard, crops and animals, and nothing private', () => {
  const s = fresh();
  s.gold = 99999;
  s.stars = 7;
  L.till(s, 5 * 38 + 6);
  s.yard.items.push({ t: 0, x: 25, y: 10 });
  const snap = plain(L.snapshot(s));
  assert.strictEqual(snap.home.items.length, s.home.items.length);
  assert.deepStrictEqual(snap.yard, [[0, 25, 10]]);
  assert.deepStrictEqual(snap.soil, [[5 * 38 + 6, 0, 0, 0]]);
  assert.deepStrictEqual(snap.animals, [['chicken', 'Clucky', 0]]);
  const text = JSON.stringify(snap);
  ['99999', 'inv', 'gold', 'stars', 'friends', 'seed'].forEach((k) => assert.ok(!text.includes(k), 'no ' + k));
  assert.ok(text.length < 32768);
});

test('a visited farm is rebuilt from the snapshot', () => {
  const host = fresh();
  host.home.level = 3;
  host.home.wall = 4;
  host.look = 'girl';
  L.till(host, 300);
  host.builds.stable = 1;
  host.horse = { name: 'Chestnut', love: 10, pet: 0 };
  const me = fresh();
  me.time = 13 * 60;
  const v = L.visitState(plain(L.snapshot(host)), me);
  assert.strictEqual(v.home.level, 3);
  assert.strictEqual(v.home.wall, 4);
  assert.strictEqual(v.look, 'girl');
  assert.strictEqual(v.home.items.length, host.home.items.length);
  assert.ok(v.soil[300]);
  assert.ok(v.horse && v.builds.stable);
  // crops show the stage they were at, and grow on from there
  L.till(host, 301);
  L.till(host, 302);
  L.till(host, 303);
  host.soil[301] = { w: 0, c: 'pumpkin', p: clock.min() - 800, r: 0 };
  host.soil[302] = { w: 1, c: 'turnip', p: clock.min() - 20, r: 0 };
  host.soil[303] = { w: 0, c: 'carrot', p: clock.min() - 5000, r: 0 };
  const v2 = L.visitState(plain(L.snapshot(host)), me);
  [301, 302, 303].forEach((i) => assert.strictEqual(L.cropStage(v2.soil[i]), L.cropStage(host.soil[i]), 'tile ' + i));
  assert.deepStrictEqual([2, 3, 4].map((st) => st), [301, 302, 303].map((i) => L.cropStage(host.soil[i])));
  assert.strictEqual(v.time, 13 * 60, 'the time is yours');
  assert.strictEqual(v.map, 'farm');
  assert.strictEqual(v.gold, me.gold === undefined ? v.gold : v.gold, 'a fresh state: nothing of theirs but the farm');
});

test('junk in a snapshot is dropped instead of breaking the game', () => {
  const junk = {
    day: 'x', look: '<script>', home: { level: 999, wall: -5, floor: 'a', items: [[0, 0, 1, 2, 0], [999, 0, 1, 1], 'bad', [3, 99, 1, 1], [0, 0, -50, 1e9]] },
    yard: [[9999, 1, 1], null, [0, 'a', 2]], soil: [[1e9, 1, 1], ['x'], [10, 999, 50, 1]],
    animals: [['dragon', 'x'], ['chicken', 'A very long chicken name indeed!!!'], ['cow', '\u0000Bessie']],
    builds: { hacked: 1, stable: 1 }, pets: { dog: 42, cat: 1 },
  };
  const v = L.visitState(junk, fresh());
  assert.strictEqual(v.home.level, C.HOME.levels.length);
  assert.strictEqual(v.home.wall, 0);
  assert.strictEqual(v.look, 'boy');
  assert.ok(v.home.items.every((it) => C.HOME.types[it.t] && C.HOME.styles[it.v]));
  assert.ok(v.yard.items.every((it) => C.OUTDOOR.types[it.t] && Number.isInteger(it.x) && Number.isInteger(it.y)), 'only real pieces');
  const FARM = L.farmInfo(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')));
  L.yardRepair(v, FARM);
  assert.strictEqual(v.yard.items.length, 0, 'and the farm map refuses ones in impossible places');
  assert.ok(!v.builds.hacked);
  assert.deepStrictEqual(plain(v.animals.map((a) => [a.kind, a.name])), [['chicken', 'A very long chic'], ['cow', 'Bessie']]);
  assert.strictEqual(v.dog.name, C.DOG.name);
  assert.ok(Object.keys(v.soil).every((k) => Number(k) <= 1e5));
  assert.strictEqual(L.visitState(null, null).map, 'farm', 'even nothing at all');
});

test('weekly scores count from the Monday of the phone\'s week', () => {
  const s = fresh();
  s.stats.earned = 5000;
  let w = L.weekScores(s, '2026-11-02');
  assert.strictEqual(w.earned, 0);
  s.stats.earned = 6500;
  s.cnt.dquest = 3;
  w = L.weekScores(s, '2026-11-05');
  assert.strictEqual(w.earned, 1500);
  assert.strictEqual(w.quests, 3);
  assert.strictEqual(w.beauty, L.homeBeauty(s));
  w = L.weekScores(s, '2026-11-09');
  assert.strictEqual(w.earned, 0, 'a new week');
});

test('the online player info is saved', () => {
  const s = fresh();
  s.net = { id: 'abc', name: 'Moon Meadow', code: 'ABCDEFGH', wk: 20000, e0: 10, q0: 2, named: 1, off: 1, pb: [] };
  assert.deepStrictEqual(plain(roundTrip(s).net), plain(s.net));
  // an unanswered refill survives a reload, so it can be settled later; junk is dropped
  s.net.pb = [['0b6c1c52-6a4e-4c1f-9f0e-2d3c4b5a6978', 'coins', 5, 1, 1790000000000], ['nope', 'coins', 5, 1, 1], ['0b6c1c52-6a4e-4c1f-9f0e-2d3c4b5a6979', 'gold', 5, 1, 1]];
  assert.deepStrictEqual(plain(roundTrip(s).net.pb), [['0b6c1c52-6a4e-4c1f-9f0e-2d3c4b5a6978', 'coins', 5, 1, 1790000000000]]);
  const old = L.serialize(fresh());
  delete old.nt;
  assert.strictEqual(L.deserialize(JSON.parse(JSON.stringify(old))).net.id, '', 'older saves: not online yet');
});

test('a farm holds the first 8 visitors to arrive; the owner does not count', () => {
  const others = [{ id: 'host', at: 1 }];
  for (let i = 0; i < 8; i++) others.push({ id: 'v' + i, at: 10 + i });
  assert.strictEqual(L.visitorFits(others.slice(0, 8), { id: 'me', at: 50 }, 'host', 8), true, '7 others and me');
  assert.strictEqual(L.visitorFits(others, { id: 'me', at: 50 }, 'host', 8), false, 'the ninth waits');
  assert.strictEqual(L.visitorFits(others, { id: 'me', at: 5 }, 'host', 8), true, 'whoever came first stays');
  assert.strictEqual(L.visitorFits(others, { id: 'host', at: 99 }, 'host', 8), true, 'the owner is always home');
  assert.strictEqual(L.visitorFits([{ id: 'b', at: 7 }], { id: 'a', at: 7 }, 'host', 1), true, 'a tie goes by id');
  assert.strictEqual(L.visitorFits([{ id: 'a', at: 7 }], { id: 'b', at: 7 }, 'host', 1), false);
});

test('typed names and messages are cleaned', () => {
  assert.strictEqual(L.cleanText('  Moon\n\tMeadow \u0007 ', 24), 'Moon Meadow');
  assert.strictEqual(L.cleanText('x'.repeat(50), 24).length, 24);
  assert.strictEqual(L.cleanText(42, 24), '');
});

test('weeds, stones and stumps show on a visited farm too', () => {
  const s = fresh();
  s.debris = { 400: 'weed', 401: 'stone', 520: C.DEBRIS_KEYS[C.DEBRIS_KEYS.length - 1] };
  const v = L.visitState(JSON.parse(JSON.stringify(L.snapshot(s))), fresh());
  assert.deepStrictEqual(plain(v.debris), plain(s.debris));
  const bad = L.visitState({ debris: [[5, 999], [-3, 0], ['x', 0], [7, 0], 'junk'] }, null);
  assert.deepStrictEqual(Object.keys(bad.debris), ['7']);
});

// A walk as it reaches this phone: a step every 250 ms from their phone, each arriving a little late.
const walk = (steps, speed, lateMs, theirClock = 0) => {
  const tr = { list: [], off: 0, heard: 0 };
  const sent = [];
  for (let i = 0; i < steps; i++) sent.push({ t: i * 250 + theirClock, x: 1000 + speed * i / 4, y: 500, dir: 'right', m: 1 });
  return { tr, sent, deliver(upTo) { // everything that has arrived by this time on our phone
    sent.filter((s) => !s.got && s.t - theirClock + lateMs(s) <= upTo).forEach((s) => { s.got = true; L.trailNote(tr, s, s.t - theirClock + lateMs(s)); });
  } };
};

test('a friend walks at an even speed between their steps, however unevenly the steps arrive, and with any clock (owner, 30 Oct)', () => {
  [0, 86400000, -3600000].forEach((theirClock) => {
    const uneven = [40, 170, 60, 130, 30, 190, 80, 150];
    const w = walk(24, C.SPEED, (s) => uneven[Math.round((s.t - theirClock) / 250) % uneven.length], theirClock);
    let was = null, min = Infinity, max = 0;
    for (let now = 1000; now < 5000; now += 16) {
      w.deliver(now);
      const at = L.trailAt(w.tr, now);
      assert.ok(at && at.moving, 'walking all the way: ' + now);
      if (was) { const v = (at.x - was) / 16 * 1000; min = Math.min(min, v); max = Math.max(max, v); }
      was = at.x;
    }
    assert.ok(min > C.SPEED * 0.9 && max < C.SPEED * 1.1, 'steady speed, got ' + Math.round(min) + ' to ' + Math.round(max));
  });
});

test('a friend on a horse glides too: they never fall behind and jump', () => {
  const speed = C.SPEED * C.HORSE.speed, w = walk(24, speed, () => 100);
  let was = null, most = 0;
  for (let now = 1000; now < 5000; now += 16) {
    w.deliver(now);
    const at = L.trailAt(w.tr, now);
    if (was !== null) most = Math.max(most, Math.abs(at.x - was));
    was = at.x;
  }
  assert.ok(most < speed * 0.02, 'a step of ' + Math.round(most));
});

test('a late step: a friend keeps going for a moment, then waits, and stops walking; they catch up when it comes', () => {
  const w = walk(8, C.SPEED, () => 50), lastStep = w.sent[7];
  w.deliver(100000);
  const at = (past) => L.trailAt(w.tr, lastStep.t + C.ONLINE.moveDelay + past + w.tr.off);
  assert.ok(Math.abs(at(100).x - (lastStep.x + C.SPEED / 10)) < 1, 'straight on, for a moment');
  assert.strictEqual(at(150).moving, true);
  const held = at(C.ONLINE.moveAhead + 100).x;
  assert.ok(Math.abs(held - (lastStep.x + C.SPEED * C.ONLINE.moveAhead / 1000)) < 1, 'no further than that');
  assert.strictEqual(at(C.ONLINE.moveEvery * 2 + 1).moving, false, 'no walking on the spot');
  assert.strictEqual(at(4000), null, 'nothing heard for a while: the game goes by their last known place');
});

test('stopping: a friend ends exactly where they stopped; a door or warp is a jump, not a slide across the map', () => {
  const tr = { list: [], off: 0, heard: 0 };
  L.trailNote(tr, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(tr, { t: 1250, x: 288, y: 0, dir: 'right', m: 1 }, 1250);
  L.trailNote(tr, { t: 1500, x: 288, y: 0, dir: 'up', m: 0 }, 1500);
  const stopped = L.trailAt(tr, 2100);
  assert.deepStrictEqual(plain(stopped), { x: 288, y: 0, dir: 'up', moving: false, speed: 0 });
  const jump = { list: [], off: 0, heard: 0 };
  L.trailNote(jump, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(jump, { t: 1250, x: 40 * C.TILE, y: 0, dir: 'right', m: 1 }, 1250);
  assert.strictEqual(L.trailAt(jump, 1500).x, 0, 'still there');
  assert.strictEqual(L.trailAt(jump, 1650).x, 40 * C.TILE, 'then here, at once');
});

test('the steps kept: a late copy and a changed clock do no harm, junk is ignored, and the list never grows', () => {
  const tr = { list: [], off: 0, heard: 0 };
  L.trailNote(tr, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(tr, { t: 1250, x: 100, y: 0, dir: 'right', m: 1 }, 1250);
  L.trailNote(tr, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1260);
  assert.strictEqual(tr.list.length, 2, 'older than the newest: dropped');
  L.trailNote(tr, { t: Infinity, x: 5, y: 0, dir: 'right', m: 1 }, 1300);
  assert.strictEqual(tr.list.length, 2, 'a time that is no time');
  L.trailNote(tr, { t: -500000, x: 9, y: 9, dir: 'right', m: 1 }, 1400);
  assert.deepStrictEqual(plain(tr.list), [{ t: -500000, x: 9, y: 9, dir: 'right', m: 1 }], 'their clock changed: start again');
  for (let i = 1; i <= 100; i++) L.trailNote(tr, { t: -500000 + i * 250, x: i, y: 0, dir: 'right', m: 1 }, 1400 + i * 250);
  assert.ok(tr.list.length <= 12);
  const ahead = { list: [], off: 0, heard: 0 };
  L.trailNote(ahead, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(ahead, { t: 6250, x: 50, y: 0, dir: 'right', m: 1 }, 1250);
  L.trailNote(ahead, { t: 6500, x: 100, y: 0, dir: 'right', m: 1 }, 1500);
  assert.ok(Math.abs(L.trailAt(ahead, 1900).x - 100) < 1, 'their clock jumped ahead: no long wait behind it');
  assert.strictEqual(L.trailAt(null, 1), null);
  assert.strictEqual(L.trailAt({ list: [], off: 0 }, 1), null);
});
