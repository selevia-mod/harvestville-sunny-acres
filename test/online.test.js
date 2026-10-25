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
  s.net = { id: 'abc', name: 'Moon Meadow', code: 'ABCDEFGH', wk: 20000, e0: 10, q0: 2, named: 1 };
  assert.deepStrictEqual(plain(roundTrip(s).net), plain(s.net));
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
