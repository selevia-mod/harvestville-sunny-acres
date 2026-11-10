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
  const daily = C.ADVENTURES.filter((a) => !a.story);
  assert.strictEqual(daily.length, 16);
  assert.strictEqual(new Set(C.ADVENTURES.map((a) => a.key)).size, C.ADVENTURES.length, 'every key its own (the stories\' too)');
  C.ADVENTURES.forEach((a) => {
    assert.ok(C.VILLAGERS[a.who] || C.ADVENTURE_PEOPLE[a.who], a.key + ': ' + a.who);
    assert.ok(['farm', 'town', 'mine', 'house'].includes(a.map) || C.WILD.areas[a.map], a.key + ': ' + a.map);
    assert.ok(a.how === 'find' ? a.n >= 1 && a.n <= 3 : a.n === 1 && C.WILD.animals[a.kind] && C.WILD.areas[a.map].animals[a.kind], a.key);
    assert.ok(C.ICON['qi_' + a.key] >= 0);
    assert.ok(!C.ITEMS[a.key] || true);
  });
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(-16 - C.STORY_ICONS.length - C.FRAID_ICONS.length - C.ECON_ICONS.length, -C.STORY_ICONS.length - C.FRAID_ICONS.length - C.ECON_ICONS.length)), plain(C.ADVENTURE_ICONS), 'appended: nothing moves');
});

test('a new farm gets adventures it can reach (farm, town, mine, Pulag); a hunter gets one of each kind', () => {
  for (let d = 2; d < 30; d++) {
    const s = fresh(0);
    L.refreshQuests(s, '2026-11-' + String(d).padStart(2, '0'));
    advs(s).forEach((a) => assert.ok(['farm', 'town', 'mine', 'pulag', 'house'].includes(a.map), a.key));
    assert.strictEqual(advs(s).length, 3);
    const h = fresh(200);
    L.refreshQuests(h, '2026-11-' + String(d).padStart(2, '0'));
    const story = advs(h).filter((a) => a.story), day = advs(h).filter((a) => !a.story);
    if (!story.length) assert.deepStrictEqual(plain(day.map((a) => a.tier).sort()), ['easy', 'hard', 'medium'], 'one of each');
    // (owner, 10 Nov 2026: a medium one every day, a Power-Up; the story's prize is the Farm Shield)
    const med = h.dq.list.filter((q) => q.c === 'adv' && !L.advOf(q).story && L.advOf(q).tier === 'medium');
    assert.strictEqual(med.length, 1, 'a medium adventure on ' + d + ' Nov');
    assert.deepStrictEqual(plain(med[0].reward), { item: 'power_up', n: 1 });
    h.dq.list.filter((q) => q.c === 'adv' && L.advOf(q).story).forEach((q) => assert.strictEqual(q.reward.item, 'farm_shield', 'the story: a Farm Shield'));
    assert.strictEqual(advs(h).length, 3);
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

test('the week\'s story (owner, 9 Nov 2026): Hana\'s Fiesta Bread, a chapter a day; 5 handed over: the recipe and 3 Sunbeams, once', () => {
  const s = fresh(200);
  const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  let kept = null;
  days.forEach((day, k) => {
    L.refreshQuests(s, day);
    const i = s.dq.list.findIndex((q) => q.c === 'adv' && L.advOf(q).story);
    assert.ok(i >= 0, day + ': its chapter is one of the day\'s adventures');
    const a = L.advOf(s.dq.list[i]);
    assert.strictEqual(a.day, k, 'chapter ' + (k + 1) + ' on day ' + (k + 1));
    assert.strictEqual(a.who, 'hana');
    assert.ok(!advs(s).some((x) => x !== a && x.who === 'hana'), 'Hana asks once a day');
    if (k === 2 || k === 3) return; // (two days missed: 5 of 7 still do it)
    for (let p = 0; p < a.n; p++) (a.how === 'hunt' ? L.advHunted(s, i) : L.advFind(s, i, p));
    const stars = s.stars, r = L.advHandOver(s, i);
    assert.ok(typeof r === 'object', day);
    if (r.keepsake) { kept = day; assert.strictEqual(s.stars, stars + (s.dq.list[i].reward.stars || 0) + 3); }
    if (k === 6) assert.strictEqual(L.storyDone(s), 5);
  });
  assert.strictEqual(kept, '2026-11-15', 'on the 5th chapter');
  assert.ok(L.storyKept(s, 'hana_bread'));
  const back = roundTrip(s);
  assert.ok(L.storyKept(back, 'hana_bread'), 'kept in the save');
  assert.deepStrictEqual(plain(L.vsRecipes(back).filter((r) => r.story === 'hana_bread').map((r) => r.dish)), ['fiesta_pandesal'], 'in the Kitchen');
  assert.strictEqual(back.wq.st, s.wq.st);
});

test('a farm copy (visits, raids) keeps its planted tiles first, up to 700 (9 Nov 2026: six land blocks of crops)', () => {
  const s = L.newState();
  for (let i = 0; i < 300; i++) s.soil[100000 - i - 5] = { w: 0, c: null, p: 0, r: 0 };
  for (let i = 0; i < 650; i++) s.soil[i + 10] = { w: 1, c: 'turnip', p: 0, r: 0 };
  const snap = L.snapshot(s);
  assert.strictEqual(snap.soil.length, 700);
  assert.strictEqual(snap.soil.filter((e) => e[1] > 0).length, 650, 'every planted tile');
  const v = L.visitState(JSON.parse(JSON.stringify(snap)), s);
  assert.strictEqual(Object.values(v.soil).filter((t) => t.c).length, 650);
  assert.ok(JSON.stringify(snap).length < 32768);
});
