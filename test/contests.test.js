// Unit tests for the festival contests (src/00-zzzzzzz-contests.js, src/01-logicZ-contests.js): the animal, crop and
// cooking contests at their festivals, the villagers' entries from the year alone, the scores, the prizes, the save
// ('cn'), the notes before the day, and the hooks for crop quality and animal breeds.
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
const plain = (x) => JSON.parse(JSON.stringify(x));
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
// a farm on a festival day (month, day), at `hour`
const on = (m, d, hour = 10, y = 2026) => {
  clock.set(y, m, d, hour, 0);
  const s = L.newState();
  s.day = L.dayOf(clock.ms);
  s.time = hour * 60;
  s.gold = 0;
  s.animals = []; // (no starter chicken)
  return s;
};
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const cow = (s, love, care) => {
  const gold = s.gold;
  s.gold = 1e6;
  const i = L.buyAnimal(s, 'cow');
  s.gold = gold;
  Object.assign(s.animals[i], { love, fed: care ? 1 : 0, pet: care ? 1 : 0, brushed: care ? 1 : 0 });
  return i;
};

test('three contests, each at its own festival; the rivals are real villagers bringing real things', () => {
  assert.deepStrictEqual(plain(C.CONTEST_ORDER), ['animal', 'crop', 'cook']);
  assert.deepStrictEqual(plain(C.CONTESTS.map((c) => [c.key, c.fest])), [['animal', 'cowfest'], ['crop', 'harvest'], ['cook', 'starry']]);
  C.CONTESTS.forEach((ct) => {
    assert.ok(L.ctFest(ct), ct.key);
    assert.strictEqual(L.ctOf(L.ctFest(ct)).key, ct.key);
    assert.ok(C.VILLAGERS[ct.judge], ct.judge);
    assert.ok(ct.rivals.length >= 3);
    ct.rivals.forEach((r) => {
      assert.ok(C.VILLAGERS[r[0]] && r[0] !== ct.judge, r[0]);
      if (ct.what === 'animal') assert.ok(C.ANIMALS[r[1]] && r[2], r[1]);
      else assert.strictEqual(C.ITEMS[r[1]].kind, ct.what, r[1]);
    });
  });
  assert.strictEqual(L.ctOf(C.FESTIVALS.find((f) => f.key === 'flower')), null, 'the Flower Festival is a dance');
  assert.match(C.FESTIVALS.find((f) => f.key === 'cowfest').desc, /Animal Contest/);
  assert.match(C.FESTIVALS.find((f) => f.key === 'starry').desc, /Cook-off/);
  assert.ok(C.TIPS.some((t) => t.key === 'contest_tour'));
});

test('the villagers\' entries come from the year alone: three, the same every time, a new set next year, in their score bands', () => {
  C.CONTEST_ORDER.forEach((k) => {
    const a = plain(L.ctRivals(k, 2026)), b = plain(L.ctRivals(k, 2026));
    assert.deepStrictEqual(a, b, 'the same on every phone');
    assert.strictEqual(a.length, 3);
    assert.strictEqual(new Set(a.map((r) => r.who)).size, 3, 'three different villagers');
    a.forEach((r, t) => assert.ok(r.score >= C.CONTEST.tiers[t][0] && r.score <= C.CONTEST.tiers[t][1], k + ' ' + r.score));
    assert.ok(a[0].score > a[1].score && a[1].score >= a[2].score - 6, 'best first (the bands barely touch)');
  });
  const years = [2026, 2027, 2028, 2029, 2030].map((y) => L.ctRivals('animal', y).map((r) => r.name).join());
  assert.ok(new Set(years).size >= 4, 'different from year to year');
  const r = L.ctRivals('animal', 2026);
  assert.match(r[0].name, /^[A-Z][A-Za-z .]+'s? (cow|carabao|pig|chicken) [A-Z]/);
  assert.match(plain(L.ctRivals('crop', 2027))[0].name, /'s? [A-Z]/);
});

test('the animal\'s score: love, then fed, petted and brushed today; young ones cannot enter', (t) => {
  const breed = L.animalBreed; // (breeds have their own test below: here a bought cow may come in a colour)
  L.animalBreed = undefined;
  t.after(() => { L.animalBreed = breed; });
  const s = on(11, 20);
  const i = cow(s, 100, true), j = cow(s, 50, false);
  assert.strictEqual(L.ctAnimalScore(s, i).score, 92);
  assert.strictEqual(L.ctAnimalScore(s, j).score, 30);
  s.animals[j].fed = 1;
  assert.strictEqual(L.ctAnimalScore(s, j).score, 42);
  L.addAnimal(s, 'chicken', 3); // a chick
  const list = L.ctChoices(s, 'animal');
  assert.deepStrictEqual(plain(list).map((o) => o.choice), [i, j], 'the best first, no chick');
  assert.strictEqual(list[0].kind, 'cow');
});

test('the crop\'s and the dish\'s scores; a bought dish does not count', () => {
  const s = on(10, 12);
  s.inv = s.inv.map(() => null);
  ['grapes', 'pumpkin', 'turnip', 'coffee', 'hoe'].forEach((id) => L.addItem(s, id, 1));
  const crops = L.ctChoices(s, 'crop');
  assert.deepStrictEqual(plain(crops).map((o) => [o.id, o.score]), [['grapes', 94], ['coffee', 88], ['pumpkin', 76], ['turnip', 30]], 'grapes and pumpkin are in season in October');
  ['pumpkin_pie', 'boiled_egg', 'sandwich', 'hot_soup', 'tonic', 'cake', 'bistek'].forEach((id) => L.addItem(s, id, 1));
  const dishes = L.ctChoices(s, 'cook');
  assert.deepStrictEqual(plain(dishes).map((o) => [o.id, o.score]), [['pumpkin_pie', 90], ['bistek', 85], ['boiled_egg', 41]], 'the inn\'s and the bakery\'s food is bought');
  assert.ok(!L.ctHomemade('sandwich') && L.ctHomemade('bistek') && !L.ctHomemade('pumpkin'));
});

test('the Animal Contest: only during the Cow Festival; the best wins 1st, Gold, the year\'s trophy and some love; once a year', () => {
  let s = on(11, 19);
  const k0 = cow(s, 100, true);
  assert.strictEqual(L.ctEnter(s, 'animal', k0).error, 'closed', 'the day before');
  s = on(11, 20, 7);
  cow(s, 100, true);
  assert.strictEqual(L.ctEnter(s, 'animal', 0).error, 'closed', 'before 8 AM');
  s = on(11, 20, 10);
  const i = cow(s, 95, true);
  assert.strictEqual(L.ctEnter(s, 'crop', 0).error, 'closed', 'not the crop one');
  assert.strictEqual(L.ctEnter(s, 'animal', 7).error, 'choice');
  const owen = L.friend(s, 'owen').pts, lily = L.friend(s, 'lily').pts;
  const r = L.ctEnter(s, 'animal', i);
  assert.strictEqual(r.place, 1);
  assert.strictEqual(r.gold, 1500);
  assert.strictEqual(s.gold, 1500);
  assert.ok(r.trophy);
  assert.strictEqual(r.entries.length, 4);
  assert.ok(r.entries[0].me && r.entries[0].name === 'Daisy the cow');
  assert.match(r.text, /1st place! Blue ribbon and 1,500G, and the 2026 trophy!/);
  assert.strictEqual(s.animals[i].love, 100, '+10 love, up to 100');
  assert.strictEqual(L.friend(s, 'owen').pts, owen + 7, 'the judge: 2 + 5');
  assert.strictEqual(L.friend(s, 'lily').pts, lily + 2);
  assert.strictEqual(s.fest.cowfest, 2026, 'the Cow Festival counts as joined');
  assert.strictEqual(L.ctEnter(s, 'animal', i).error, 'entered');
  assert.deepStrictEqual(plain(L.ctResult(s, 'animal')), { c: 'animal', y: 2026, p: 1, w: 'Daisy' });
  assert.strictEqual(L.ctTrophies(s).length, 1);
  assert.strictEqual(L.ctRibbons(s).length, 1);
  // next year it is open again
  const s2 = roundTrip(s);
  clock.set(2027, 11, 20, 10, 0);
  s2.day = L.dayOf(clock.ms);
  s2.time = 600;
  assert.strictEqual(L.ctEntered(s2, 'animal'), false);
  assert.strictEqual(L.ctEnter(s2, 'animal', i).place >= 1, true);
  assert.strictEqual(L.ctRibbons(s2).length >= 1, true);
});

test('a neglected animal comes 4th: 100G and a green ribbon for taking part; a tie goes to you', () => {
  let s = on(11, 20);
  const i = cow(s, 0, false);
  const r = L.ctEnter(s, 'animal', i);
  assert.strictEqual(r.place, 4);
  assert.strictEqual(s.gold, 100);
  assert.ok(!r.trophy);
  assert.match(r.text, /4th place this time\. A green ribbon for taking part, and 100G\./);
  assert.strictEqual(L.ctRibbons(s).length, 1, 'the green thank-you ribbon counts');
  assert.strictEqual(L.ctTrophies(s).length, 0);
  assert.strictEqual(s.animals[i].love, 5, 'a fun day out all the same');
  // a tie with the best rival
  s = on(11, 20);
  const best = L.ctRivals('animal', 2026)[0].score;
  const j = cow(s, 0, false);
  s.animals[j].love = Math.round((best - 32) / 0.6);
  Object.assign(s.animals[j], { fed: 1, pet: 1, brushed: 1 });
  const sc = L.ctAnimalScore(s, j).score;
  if (sc === best) assert.strictEqual(L.ctEnter(s, 'animal', j).place, 1);
  else assert.strictEqual(L.ctEnter(s, 'animal', j).place, sc > best ? 1 : 2);
});

test('the Crop Contest at the Harvest Festival takes the crop; the Cook-off on Starry Night evening takes the dish and leaves the date', () => {
  let s = on(10, 12);
  L.addItem(s, 'grapes', 3);
  L.addItem(s, 'turnip', 1);
  let r = L.ctEnter(s, 'crop', slotOf(s, 'grapes'));
  assert.strictEqual(r.place, 1);
  assert.strictEqual(s.inv[slotOf(s, 'grapes')].n, 2, 'one grape bunch goes to the judges');
  assert.strictEqual(s.fest.harvest, 2026);
  assert.strictEqual(L.ctResult(s, 'crop').w, 'grapes');
  s = on(12, 24, 10);
  L.addItem(s, 'pumpkin_pie', 1);
  assert.strictEqual(L.ctEnter(s, 'cook', slotOf(s, 'pumpkin_pie')).error, 'closed', 'Starry Night starts at 5 PM');
  s = on(12, 24, 19);
  L.addItem(s, 'sandwich', 1);
  L.addItem(s, 'boiled_egg', 1);
  assert.strictEqual(L.ctEnter(s, 'cook', slotOf(s, 'sandwich')).error, 'choice', 'bought at the inn');
  r = L.ctEnter(s, 'cook', slotOf(s, 'boiled_egg'));
  assert.strictEqual(r.place, 4);
  assert.strictEqual(slotOf(s, 'boiled_egg'), -1);
  assert.strictEqual(s.fest.starry, undefined, 'the evening with someone is still to come');
  assert.strictEqual(L.joinFestival(s, L.festivalNow(s), 'lily').error, undefined);
});

test('crop quality and animal breeds count once those features are in (and a broken one does no harm)', () => {
  const s = on(10, 12);
  L.addItem(s, 'pumpkin', 1);
  const i = slotOf(s, 'pumpkin');
  assert.strictEqual(L.ctCropScore(s, i).score, 76);
  try {
    L.cropQuality = (slot) => (slot.id === 'pumpkin' ? 3 : 0);
    assert.strictEqual(L.ctCropScore(s, i).score, 91);
    assert.strictEqual(L.ctChoices(s, 'crop')[0].stars, 3);
    L.cropQuality = () => ({ stars: 1 });
    assert.strictEqual(L.ctCropScore(s, i).score, 81);
    L.cropQuality = () => 9;
    assert.strictEqual(L.ctCropScore(s, i).stars, 3, 'at most 3 stars');
    L.cropQuality = () => { throw new Error('x'); };
    assert.strictEqual(L.ctCropScore(s, i).score, 76);
  } finally { delete L.cropQuality; }
  const t = on(11, 20);
  const k = cow(t, 50, false);
  assert.strictEqual(L.ctAnimalScore(t, k).score, 30);
  try {
    L.animalBreed = () => 'Holstein';
    assert.strictEqual(L.ctAnimalScore(t, k).score, 33);
    assert.strictEqual(L.ctChoices(t, 'animal')[0].breed.name, 'Holstein');
    L.animalBreed = () => ({ name: 'Golden', rare: true });
    assert.strictEqual(L.ctAnimalScore(t, k).score, 38);
    L.animalBreed = () => null;
    assert.strictEqual(L.ctAnimalScore(t, k).score, 30);
  } finally { delete L.animalBreed; }
});

test('the save keeps the results (\'cn\'); an old save loads; junk is dropped; one a year; the newest 30', () => {
  const s = on(11, 20);
  const i = cow(s, 100, true);
  s.cat = { name: C.CAT.name, love: 40, pet: 1 };
  L.ctEnter(s, 'animal', i);
  const o = plain(L.serialize(s));
  assert.deepStrictEqual(o.ct, [40, 1], 'the cat keeps its own key');
  assert.strictEqual(roundTrip(s).cat.love, 40);
  assert.deepStrictEqual(o.cn, [[0, 2026, 1, 'Daisy']]);
  assert.deepStrictEqual(plain(roundTrip(s).cn), { r: [{ c: 'animal', y: 2026, p: 1, w: 'Daisy' }] });
  delete o.cn;
  assert.deepStrictEqual(plain(L.deserialize(o).cn), { r: [] }, 'an old save');
  assert.strictEqual(plain(L.serialize(L.newState())).cn, undefined, 'nothing saved before the first contest');
  o.cn = [[0, 2026, 1, 'Daisy'], [0, 2026, 2, 'Bessie'], [9, 2026, 1], [1, 1999, 1], [1, 2027, 7], 'x', [2, 2026, 3, 42], [1, 2026, 2, 'x'.repeat(99)]];
  assert.deepStrictEqual(plain(L.deserialize(o).cn.r), [
    { c: 'animal', y: 2026, p: 1, w: 'Daisy' }, { c: 'cook', y: 2026, p: 3, w: '' }, { c: 'crop', y: 2026, p: 2, w: 'x'.repeat(24) }]);
  o.cn = [];
  for (let y = 2030; y < 2070; y++) o.cn.push([0, y, 2, 'Bessie']);
  const back = L.deserialize(o).cn.r;
  assert.strictEqual(back.length, 30);
  assert.strictEqual(back[0].y, 2040, 'the newest 30');
});

test('the morning before and the day itself say so', () => {
  let s = on(11, 19, 8);
  assert.match(L.ctNote(s), /^The Animal Contest at the Cow Festival is tomorrow! Get ready: feed, pet and brush your best animal first\.$/);
  s = on(11, 20, 8);
  assert.match(L.ctNote(s), /Animal Contest is on at the Cow Festival today, 8:00 AM to 9:00 PM: talk to Mayor Hollis/);
  L.ctEnter(s, 'animal', cow(s, 10, false));
  assert.strictEqual(L.ctNote(s), null, 'not once you have entered');
  assert.match(L.ctNote(on(12, 23)), /Noche Buena Cook-off at the Starry Night is tomorrow/);
  assert.match(L.ctNote(on(10, 11)), /Crop Contest at the Harvest Festival is tomorrow/);
  assert.strictEqual(L.ctNote(on(4, 13)), null, 'the Flower Festival has no contest');
  assert.strictEqual(L.ctNote(on(11, 4)), null);
});
