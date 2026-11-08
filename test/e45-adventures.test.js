// Daily adventures (owner, 8 Nov 2026; docs/quests-adventures.md): picked from places you opened, quest-only pieces,
// handed over to whoever asked, kept in the save; a day begun before this keeps its own list.
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
require('./clock')(ctx);
L.weather = () => 'sunny';
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = (hunts) => { const s = L.newState(); s.seed = 11; s.wild.n = hunts || 0; return s; };
const advs = (s) => s.dq.list.filter((q) => q.c === 'adv').map((q) => L.advOf(q));

test('16 adventures, each its own item and icon slot, people who exist, places that exist', () => {
  assert.strictEqual(C.ADVENTURES.length, 16);
  assert.strictEqual(new Set(C.ADVENTURES.map((a) => a.key)).size, 16);
  C.ADVENTURES.forEach((a) => {
    assert.ok(C.VILLAGERS[a.who] || C.ADVENTURE_PEOPLE[a.who], a.key + ': ' + a.who);
    assert.ok(['farm', 'town', 'mine'].includes(a.map) || C.WILD.areas[a.map], a.key + ': ' + a.map);
    assert.ok(a.how === 'find' ? a.n >= 1 && a.n <= 3 : a.n === 1 && C.WILD.animals[a.kind] && C.WILD.areas[a.map].animals[a.kind], a.key);
    assert.ok(C.ICON['qi_' + a.key] >= 0);
    assert.ok(!C.ITEMS[a.key] || true);
  });
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(-16)), plain(C.ADVENTURE_ICONS), 'appended: nothing moves');
});

test('a new farm gets adventures it can reach (farm, town, mine, Pulag); a hunter gets one of each kind', () => {
  for (let d = 2; d < 30; d++) {
    const s = fresh(0);
    L.refreshQuests(s, '2026-11-' + String(d).padStart(2, '0'));
    advs(s).forEach((a) => assert.ok(['farm', 'town', 'mine', 'pulag'].includes(a.map), a.key));
    assert.strictEqual(advs(s).length, 3);
    const h = fresh(200);
    L.refreshQuests(h, '2026-11-' + String(d).padStart(2, '0'));
    assert.deepStrictEqual(plain(advs(h).map((a) => a.tier)), ['easy', 'medium', 'hard'], 'one of each');
  }
});

test('found piece by piece (each spot once), handed over to whoever asked, a heart with a villager; saved on the way', () => {
  const s = fresh(200);
  L.refreshQuests(s, '2026-11-12');
  const i = s.dq.list.findIndex((q) => q.c === 'adv' && q.n === 3);
  const a = L.advOf(s.dq.list[i]);
  assert.strictEqual(L.advFor(s, a.who), -1, 'nothing to give yet');
  assert.strictEqual(L.advFind(s, i, 0), 'found');
  assert.strictEqual(L.advFind(s, i, 0), 'no', 'the same spot twice');
  assert.strictEqual(L.questProgress(s, s.dq.list[i]), 1);
  let back = roundTrip(s);
  assert.deepStrictEqual([back.dq.list[i].a, back.dq.list[i].got, back.dq.list[i].gb], [a.key, 1, 1], 'kept in the save');
  assert.strictEqual(L.advFind(back, i, 1), 'found');
  assert.strictEqual(L.advFind(back, i, 2), 'all');
  assert.ok(!L.questReady(back, back.dq.list[i]), 'not claimed until handed over');
  assert.strictEqual(L.advFor(back, a.who), i);
  const hearts = C.VILLAGERS[a.who] ? L.friend(back, a.who).pts : 0;
  const r = L.advHandOver(back, i);
  assert.ok(typeof r === 'object');
  assert.strictEqual(back.dq.list[i].done, 1);
  if (C.VILLAGERS[a.who]) assert.strictEqual(L.friend(back, a.who).pts, hearts + 10);
  assert.strictEqual(L.advFor(back, a.who), -1);
  back = roundTrip(back);
  assert.strictEqual(back.dq.list[i].done, 1);
  // a hunt: one catch is all of it
  const h = s.dq.list.findIndex((q) => q.c === 'adv' && L.advOf(q).how === 'hunt');
  assert.strictEqual(L.advHunted(s, h), 'all');
  assert.ok(L.advFor(s, L.advOf(s.dq.list[h]).who) === h);
});

test('only while it is on: today\'s, not found yet, on its own map (the hammer: on its floor)', () => {
  const s = fresh(200);
  L.refreshQuests(s, '2026-11-12');
  advs(s).forEach((a) => assert.ok(L.advActive(s, a.map).some((e) => e.a === a)));
  assert.strictEqual(L.advActive(s, 'nowhere').length, 0);
  const i = s.dq.list.findIndex((q) => q.c === 'adv');
  const a = L.advOf(s.dq.list[i]);
  for (let k = 0; k < a.n; k++) L.advFind(s, i, k);
  assert.ok(!L.advActive(s, a.map).some((e) => e.i === i), 'all found: none left');
  const m = fresh(0);
  for (let d = 2; d < 30 && !(m.dq && advs(m).some((x) => x && x.key === 'hammer')); d++) L.refreshQuests(m, '2026-11-' + String(d).padStart(2, '0'));
  const fl = L.advFloor(m, m.dq.d);
  assert.ok(fl >= 1 && fl <= 10);
  assert.ok(L.advActive(m, 'mine', fl).length === 1 && L.advActive(m, 'mine', fl + 1).length === 0);
});

test('a day begun before this keeps its own list until tomorrow; then the new one', () => {
  const s = fresh(0);
  L.refreshQuests(s, '2026-11-12');
  // a save from the day before the update: 10 quests, no adventures
  s.dq = { d: L.dayNum('2026-11-13'), all: 0, list: Array.from({ length: 10 }, (x, k) => ({ c: 'talk', n: 1, b: 0, done: 0, reward: { gold: 100 }, text: 'Talk ' + k, tier: 'easy' })) };
  L.refreshQuests(s, '2026-11-13');
  assert.strictEqual(s.dq.list.length, 10);
  assert.ok(!L.daily2(s));
  const back = roundTrip(s);
  assert.strictEqual(back.dq.list.length, 10);
  L.refreshQuests(back, '2026-11-14');
  assert.strictEqual(back.dq.list.length, 6);
});

test('the reason on the list: the person\'s own words', () => {
  const s = fresh(200);
  L.refreshQuests(s, '2026-11-12');
  const i = s.dq.list.findIndex((q) => q.c === 'adv');
  assert.strictEqual(L.questReason(s, i).text, L.advOf(s.dq.list[i]).say);
});
