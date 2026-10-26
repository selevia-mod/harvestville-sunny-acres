// Unit tests for Phase 3: counting, daily quests (with the hard ones' prizes), weekly and monthly goals, the
// login gift, achievements, villagers' requests and the streak, the trader, Stars, the Power-Up, the Pet Meal.
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
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const fresh = () => { const s = L.newState(); s.seed = 11; s.inv = s.inv.map(() => null); return s; };
const TODAY = '2026-11-02'; // a Monday in November

test('actions are counted: harvesting, watering, gifts, a talk once a day per villager', () => {
  const s = fresh();
  L.addItem(s, 'can', 1);
  L.till(s, 5);
  assert.strictEqual(L.count(s, 'till'), 1);
  s.water = 10;
  L.water(s, 5);
  L.water(s, 5); // already watered: not counted
  assert.strictEqual(L.count(s, 'water'), 1);
  L.talk(s, 'lily');
  L.talk(s, 'lily');
  assert.strictEqual(L.count(s, 'talk'), 1);
  L.addItem(s, 'turnip', 1);
  L.giveGift(s, 'lily', slotOf(s, 'turnip'));
  assert.strictEqual(L.count(s, 'gift'), 1);
  s.stats.earned = 900;
  assert.strictEqual(L.count(s, 'earned'), 900, 'some counters come from the records');
});

test('10 daily quests a day: 5 easy, 2 medium, 3 hard with a Power-Up, a Star and a Pet Meal', () => {
  const s = fresh();
  const news = L.refreshQuests(s, TODAY);
  assert.ok(news.daily && news.weekly && news.monthly);
  assert.strictEqual(s.dq.list.length, 10);
  assert.deepStrictEqual(plain(s.dq.list.map((q) => q.tier)), ['easy', 'easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'hard', 'hard', 'hard']);
  assert.deepStrictEqual(plain(s.dq.list.slice(7).map((q) => q.reward)), [{ item: 'power_up', n: 1 }, { stars: 1 }, { item: 'pet_meal', n: 1 }]);
  assert.strictEqual(new Set(s.dq.list.slice(0, 5).map((q) => q.c)).size, 5, 'the easy ones are all different');
  const again = JSON.stringify(s.dq);
  L.refreshQuests(s, TODAY);
  assert.strictEqual(JSON.stringify(s.dq), again, 'the same list all day');
  L.refreshQuests(s, '2026-11-03');
  assert.notStrictEqual(JSON.stringify(s.dq.list.map((q) => q.text)), JSON.parse(again).list.map((q) => q.text).join(), 'a new list tomorrow');
});

test('winter has crops too, so crop quests come up all year', () => {
  const s = fresh();
  s.day = L.dayOf(new Date(2027, 0, 10, 12).getTime());
  let crop = 0;
  for (let d = 1; d <= 28; d++) {
    L.refreshQuests(s, '2027-01-' + String(d).padStart(2, '0'));
    crop += s.dq.list.filter((q) => ['harvest', 'water', 'plant'].includes(q.c)).length;
  }
  assert.ok(crop > 0);
});

test('claiming quests: only when done, only once; all 10 give a bonus; they count for the month', () => {
  const s = fresh();
  L.refreshQuests(s, TODAY);
  const q = s.dq.list[0];
  assert.strictEqual(L.claimQuest(s, 'daily', 0), 'notyet');
  s.cnt[q.c] = (s.cnt[q.c] || 0) + q.n; // do it (stats-based counters too)
  if (['earned', 'fish', 'cooked'].includes(q.c)) s.stats[q.c] += q.n;
  const gold = s.gold, stars = s.stars;
  const r = L.claimQuest(s, 'daily', 0);
  assert.ok(r.gold || r.item || r.stars);
  assert.ok(s.gold > gold || s.stars > stars || L.countItem(s, r.item) > 0);
  assert.strictEqual(L.claimQuest(s, 'daily', 0), 'done');
  assert.strictEqual(L.count(s, 'dquest'), 1);
  // finish the rest
  s.dq.list.forEach((x) => { x.b = -1e9; });
  for (let i = 1; i < 10; i++) assert.ok(typeof L.claimQuest(s, 'daily', i) === 'object', 'quest ' + i);
  assert.ok(L.chestReady(s, 'daily'));
  const st = s.stars;
  L.claimChest(s, 'daily');
  assert.strictEqual(s.stars, st + 1);
  assert.strictEqual(L.claimChest(s, 'daily'), 'notyet', 'once');
  const month = s.mq.list.find((x) => x.c === 'dquest');
  assert.strictEqual(L.questProgress(s, month), 10, 'November: 10 daily quests done');
  assert.ok(L.questReady(s, month));
});

test('weekly goals: 5 a week, a chest when all are done, counted for the month', () => {
  const s = fresh();
  L.refreshQuests(s, TODAY);
  assert.strictEqual(s.wq.list.length, 5);
  s.wq.list.forEach((q) => { q.b = -1e9; });
  for (let i = 0; i < 5; i++) L.claimQuest(s, 'weekly', i);
  const stars = s.stars;
  assert.ok(typeof L.claimChest(s, 'weekly') === 'object');
  assert.strictEqual(s.stars, stars + C.WEEKLY.chest.stars);
  assert.strictEqual(L.count(s, 'wchest'), 1);
  const w = s.wq.w;
  L.refreshQuests(s, '2026-11-08'); // Sunday: the same week
  assert.strictEqual(s.wq.w, w);
  L.refreshQuests(s, '2026-11-09'); // Monday: a new week
  assert.notStrictEqual(s.wq.w, w);
  assert.strictEqual(s.wq.chest, 0);
});

test('monthly goals reset with the calendar month and count the days you play', () => {
  const s = fresh();
  L.refreshQuests(s, '2026-11-01');
  const login = () => L.questProgress(s, s.mq.list.find((q) => q.c === 'login'));
  assert.strictEqual(login(), 1);
  L.refreshQuests(s, '2026-11-01');
  assert.strictEqual(login(), 1, 'once a day');
  L.refreshQuests(s, '2026-11-05');
  assert.strictEqual(login(), 2);
  L.refreshQuests(s, '2026-12-01');
  assert.strictEqual(s.mq.m, '2026-12');
  assert.strictEqual(login(), 1);
});

test('the login gift: a 7-day cycle that starts again if you miss a day', () => {
  const s = fresh();
  assert.strictEqual(L.loginGift(s, '2026-11-01').day, 1);
  L.claimLogin(s, '2026-11-01');
  assert.strictEqual(L.loginGift(s, '2026-11-01'), null, 'once a day');
  for (let d = 2; d <= 7; d++) assert.strictEqual(L.claimLogin(s, '2026-11-0' + d).day, d);
  assert.strictEqual(s.stars, 2, 'day 7 gives 2 Stars');
  assert.strictEqual(L.loginGift(s, '2026-11-08').day, 1, 'round again');
  L.claimLogin(s, '2026-11-08');
  assert.strictEqual(L.loginGift(s, '2026-11-10').day, 1, 'missed a day: back to day 1');
});

test('achievements unlock from your records and pay Stars once', () => {
  const s = fresh();
  const i = C.ACHIEVEMENTS.findIndex((a) => a.key === 'first_coins');
  assert.ok(!L.achReady(s, i));
  s.stats.earned = 1000;
  assert.ok(L.achReady(s, i));
  L.claimAch(s, i);
  assert.strictEqual(s.stars, 1);
  assert.strictEqual(L.claimAch(s, i), 'notyet');
  assert.ok(L.questsWaiting(s) >= 0);
});

test('requests: 3 on the board and 1 in person each day; finishing them pays more on a streak', () => {
  const s = fresh();
  L.friend(s, 'hana').met = 1;
  L.addItem(s, 'rod', 1);
  const list = L.ensureRequests(s);
  assert.strictEqual(list.filter((r) => r.where === 'board').length, 3);
  assert.strictEqual(list.filter((r) => r.where === 'person').length, 1);
  assert.strictEqual(list.find((r) => r.where === 'person').from, 'hana', 'only someone you know asks in person');
  list.forEach((r) => assert.ok(C.ITEMS[r.id] && r.n >= 1 && r.gold >= 80));
  assert.strictEqual(L.finishRequest(s, 0), 'missing');
  L.addItem(s, list[0].id, list[0].n);
  const gold = s.gold, r1 = L.finishRequest(s, 0);
  assert.strictEqual(s.gold - gold, list[0].gold, 'day 1: no bonus yet');
  assert.strictEqual(r1.pts, C.REQUESTS.pts.board);
  assert.strictEqual(L.finishRequest(s, 0), 'none', 'once');
  // the next day
  L.endDay(s, false);
  const r2 = s.rq.list[0];
  L.addItem(s, r2.id, r2.n);
  const g2 = s.gold;
  L.finishRequest(s, 0);
  assert.strictEqual(s.gold - g2, Math.round(r2.gold * 1.1), 'day 2 in a row: +10%');
  assert.strictEqual(s.rq.streak, 2);
  assert.strictEqual(roundTrip(s).rq.streak, 2, 'saved');
});

test('the trader: here on her days, pays more for the wanted goods of the day, buys a limited amount', () => {
  const s = fresh();
  s.day = 2; // weekday 2
  s.time = 10 * 60;
  assert.ok(L.traderHere(s));
  s.day = 3;
  assert.ok(!L.traderHere(s));
  s.day = 2;
  const wanted = L.traderWanted(s);
  assert.strictEqual(wanted.length, 3);
  const id = wanted[0];
  assert.strictEqual(L.traderPrice(s, id), Math.round(C.ITEMS[id].sell * 1.8));
  L.addItem(s, id, 12);
  const gold = s.gold, got = L.traderSell(s, id, 12);
  assert.strictEqual(got, L.traderPrice(s, id) * 10, 'up to 10 a visit');
  assert.strictEqual(s.gold - gold, got);
  assert.strictEqual(L.countItem(s, id), 2);
  assert.strictEqual(s.stats.earned, got, 'counts as earnings');
});

test('trader swaps: gems for a Star, Stars for a Power-Up, Stars for a festival piece of any season', () => {
  const s = fresh();
  s.day = 2;
  L.addItem(s, 'gem', 5);
  assert.ok(L.canSwap(s, 0));
  L.traderSwap(s, 0);
  assert.strictEqual(s.stars, 1);
  assert.strictEqual(L.traderSwap(s, 1), 'missing');
  s.stars = 8;
  L.traderSwap(s, 1);
  assert.strictEqual(L.countItem(s, 'power_up'), 1);
  const r = L.traderSwap(s, 6);
  assert.ok(C.HOME.styles[r.furniture.v].festival);
  assert.strictEqual(s.home.bag[L.furnKey(r.furniture.t, r.furniture.v)], 1);
  const y = L.traderSwap(s, 7);
  assert.ok(C.OUTDOOR.types[y.yard.t].festival);
  assert.strictEqual(s.stars, 0);
  assert.strictEqual(L.count(s, 'trade'), 4);
});

test('the Power-Up fills your energy and makes tools free for 2 hours; the Pet Meal once a day per pet', () => {
  const s = fresh();
  s.energy = 10;
  s.time = 9 * 60;
  L.addItem(s, 'power_up', 1);
  assert.strictEqual(L.usePowerUp(s, slotOf(s, 'power_up')), 'ok');
  assert.strictEqual(s.energy, L.maxEnergy(s));
  assert.ok(L.spendEnergy(s, 5));
  assert.strictEqual(s.energy, L.maxEnergy(s), 'no energy used');
  s.time = 11 * 60 + 1;
  L.spendEnergy(s, 5);
  assert.strictEqual(s.energy, L.maxEnergy(s) - 5, 'worn off');
  L.addItem(s, 'pet_meal', 2);
  const love = s.dog.love;
  assert.strictEqual(L.feedPet(s, 'dog', slotOf(s, 'pet_meal')), 'ok');
  assert.strictEqual(s.dog.love, love + C.PET_MEAL_LOVE);
  assert.strictEqual(L.feedPet(s, 'dog', slotOf(s, 'pet_meal')), 'already');
  assert.strictEqual(L.feedPet(s, 'cat', slotOf(s, 'pet_meal')), 'none', 'no cat yet');
});

test('everything in Phase 3 is saved, and the save stays small', () => {
  const s = fresh();
  L.refreshQuests(s, TODAY);
  L.claimLogin(s, TODAY);
  L.ensureRequests(s);
  s.stars = 7;
  s.ach = 5;
  s.cnt.harvest = 123;
  const back = roundTrip(s);
  ['stars', 'ach', 'lg', 'seen'].forEach((k) => assert.deepStrictEqual(plain(back[k]), plain(s[k]), k));
  assert.deepStrictEqual(plain(back.dq), plain(s.dq));
  assert.deepStrictEqual(plain(back.wq), plain(s.wq));
  assert.deepStrictEqual(plain(back.mq), plain(s.mq));
  assert.deepStrictEqual(plain(back.rq), plain(s.rq));
  assert.strictEqual(back.cnt.harvest, 123);
  C.VILLAGER_ORDER.forEach((k) => { s.friends[k] = { pts: 100, talked: 1, gifted: 1, met: 1, ev: 3 }; });
  for (let i = 0; i < 300; i++) s.yard.items.push({ t: i % 30, x: 20 + (i % 15), y: 2 + Math.floor(i / 15) });
  assert.ok(JSON.stringify(L.serialize(s)).length < C.MAX_SAVE_BYTES, JSON.stringify(L.serialize(s)).length + ' bytes');
});
