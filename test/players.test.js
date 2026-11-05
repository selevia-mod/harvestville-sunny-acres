// Unit tests for the players' ideas and reports (owner, 5 Nov 2026; src/00-zzzzzzzz-players.js, src/01-logicZZ-players.js):
// rain waters what is planted or picked on a rainy day, Mira's two jobs (and the save), Double Drops by Manila time, the
// new seeds on the crop ladder, crafting at Mira's, the bigger yard (and the save size), the clearing quest, dropping.
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
const weather = L.weather;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
// a UTC instant for a Manila wall-clock time (UTC+8)
const manila = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi);

test('rain waters what you plant and pick on a rainy day; on a dry day it waits for water', () => {
  clock.set(2026, 4, 1, 10, 0);
  const dn = L.doubleNow;
  try {
    L.weather = () => 'sunny';
    const s = L.newState();
    L.doubleNow = () => null;
    s.soil[300] = { w: 0, c: null, p: 0, r: 0 }; // tilled yesterday, dry
    s.soil[301] = { w: 0, c: null, p: 0, r: 0 };
    L.addItem(s, 'seed_turnip', 2);
    L.plantBag(s, [300], slotOf(s, 'seed_turnip'));
    assert.ok(L.needsWater(s.soil[300]), 'dry day: waits for water');
    L.weather = () => 'rain';
    L.plantBag(s, [301], slotOf(s, 'seed_turnip'));
    assert.ok(!L.needsWater(s.soil[301]) && s.soil[301].w === 1, 'rainy day: the rain waters it');
    // picked on a rainy day, a crop that grows back starts again at once
    s.soil[302] = { w: 1, c: 'strawberry', p: L.nowMin() - 130, r: 0, h: 1 };
    C.CROPS.strawberry.regrow = C.CROPS.strawberry.regrow || 60;
    assert.strictEqual(L.harvest(s, 302), 'strawberry');
    assert.ok(!L.needsWater(s.soil[302]), 'growing back in the rain');
    // never on a friend's farm
    const v = L.newState();
    v.isVisit = true;
    assert.strictEqual(L.raining(v), false);
  } finally { L.weather = weather; L.doubleNow = dn; }
});

test('Mira takes two jobs at once: a third waits, both finish, the second job is saved', () => {
  clock.set(2026, 4, 1, 10, 0);
  const s = L.newState();
  s.gold = 1e6; s.lumber = 999; s.stone = 999;
  assert.strictEqual(L.startBuild(s, 'kitchen'), 'ok');
  assert.strictEqual(L.startHomeUpgrade(s), 'ok', 'a house upgrade as the second job');
  assert.strictEqual(L.startBuild(s, 'coop2'), 'busy', 'a third waits');
  assert.strictEqual(L.startHomeUpgrade(s), 'busy');
  assert.deepStrictEqual(plain(L.miraJobs(s).map((j) => j.id)), ['kitchen', 'house']);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.project), plain(s.project));
  assert.deepStrictEqual(plain(back.project2), plain(s.project2));
  const lv = s.home.level, days = s.project2.done - s.day;
  for (let d = 0; d < days; d++) L.endDay(s);
  assert.strictEqual(s.builds.kitchen, 1);
  assert.strictEqual(s.home.level, lv + 1, 'the house grew');
  assert.ok(L.homeHas(s, 'kitchen'), 'the kitchen counter is in');
  assert.strictEqual(s.project, null);
  assert.strictEqual(s.project2, null);
  // the first slot is always the older job
  assert.strictEqual(L.startBuild(s, 'coop2'), 'ok');
  assert.strictEqual(L.startBuild(s, 'barn2'), 'ok');
  L.endDay(s);
  assert.ok(s.builds.coop2 && s.builds.barn2);
  // an old save has no p2; a bad one is ignored
  const o = plain(L.serialize(L.newState()));
  o.p2 = ['x', 'y'];
  assert.strictEqual(L.deserialize(o).project2, null);
});

test('Double Drops: Wednesday and Saturday, 12-1 PM and 8-10 PM Manila time, whatever the phone\'s time zone', () => {
  // 4 Nov 2026 is a Wednesday
  assert.ok(L.doubleNow(manila(2026, 11, 4, 12, 0)));
  assert.ok(L.doubleNow(manila(2026, 11, 4, 12, 59)));
  assert.strictEqual(L.doubleNow(manila(2026, 11, 4, 13, 0)), null);
  assert.ok(L.doubleNow(manila(2026, 11, 4, 21, 30)));
  assert.strictEqual(L.doubleNow(manila(2026, 11, 4, 22, 0)), null);
  assert.ok(L.doubleNow(manila(2026, 11, 7, 20, 0)), 'Saturday');
  assert.strictEqual(L.doubleNow(manila(2026, 11, 5, 12, 30)), null, 'not Thursday');
  assert.strictEqual(L.doubleNow(manila(2026, 11, 4, 12, 30)).end, manila(2026, 11, 4, 13, 0));
  assert.deepStrictEqual(plain(L.doubleNext(manila(2026, 11, 4, 14, 0))), { start: manila(2026, 11, 4, 20, 0), end: manila(2026, 11, 4, 22, 0) });
  assert.deepStrictEqual(plain(L.doubleNext(manila(2026, 11, 4, 23, 0))), { start: manila(2026, 11, 7, 12, 0), end: manila(2026, 11, 7, 13, 0) });
  // two windows a day, two days a week: 6 hours a week
  let mins = 0;
  for (let m = 0; m < 7 * 1440; m += 5) if (L.doubleNow(manila(2026, 11, 2, 0) + m * 60000)) mins += 5;
  assert.strictEqual(mins, 6 * 60);
});

test('Double Drops gives one more crop, one more forage find, and twice what a hunted animal leaves', () => {
  clock.ms = manila(2026, 11, 4, 12, 30);
  L.weather = () => 'sunny';
  try {
    const s = L.newState();
    s.soil[400] = { w: 1, c: 'turnip', p: L.nowMin() - 20, r: 0, h: 1 };
    assert.strictEqual(L.harvest(s, 400), 'turnip');
    assert.strictEqual(L.countItem(s, 'turnip'), 2);
    assert.strictEqual(L.doubled, 1);
    const got = L.takeForage(s, 'farm', 0);
    assert.strictEqual(L.countItem(s, got), 2);
    assert.deepStrictEqual(plain(L.huntDrops('whitedeer', () => 0.99)), [['venison', 6], ['white_antler', 2]]);
    clock.ms = manila(2026, 11, 4, 14, 0);
    s.soil[401] = { w: 1, c: 'turnip', p: L.nowMin() - 20, r: 0, h: 1 };
    L.harvest(s, 401);
    assert.strictEqual(L.countItem(s, 'turnip'), 3, 'one when it is over');
    assert.deepStrictEqual(plain(L.huntDrops('whitedeer', () => 0.99)), [['venison', 3], ['white_antler', 1]]);
  } finally { L.weather = weather; }
});

test('seven new seeds on the crop ladder, at Lily\'s in their seasons, with icons and crop frames after every other', () => {
  assert.deepStrictEqual(plain(C.NEW_CROPS), ['rose', 'sampaguita', 'gumamela', 'cotton', 'sugarcane', 'cacao', 'oregano']);
  const ladder = {};
  C.CROP_KEYS.filter((k) => !C.NEW_CROPS.includes(k) && C.ITEMS['seed_' + k]).forEach((k) => { ladder[C.CROPS[k].mins] = [C.ITEMS['seed_' + k].price, C.ITEMS[C.CROPS[k].item].sell]; });
  C.NEW_CROPS.forEach((k, i) => {
    const c = C.CROPS[k];
    assert.deepStrictEqual(plain([C.ITEMS['seed_' + k].price, C.ITEMS[k].sell]), plain(ladder[c.mins]), k + ' is priced like the others that take as long');
    assert.strictEqual(c.art, C.CROP_KEYS.length - C.NEW_CROPS.length + i, k + ' frames after every other crop');
    assert.ok(C.SHOP_STOCK.includes('seed_' + k));
    assert.strictEqual(C.ICON_ORDER[C.ITEMS[k].icon], k);
  });
  assert.strictEqual(C.CROP_WITHERED, 2 + C.CROP_KEYS.length * 2);
  assert.ok(C.CROP_WITHERED < 105, 'the crops sheet holds 105 frames');
  assert.ok(C.ICON_ORDER.indexOf('chocolate_cake') === C.ICON_ORDER.length - 1, 'new icons at the very end');
  const spring = L.seedsInSeason(L.dayOf(new Date(2026, 3, 10, 12).getTime()));
  assert.ok(spring.includes('seed_rose') && spring.includes('seed_oregano') && !spring.includes('seed_cotton'));
  assert.ok(C.WORKSHOPS.bakery.recipes.some((r) => r.out === 'sikwate') && C.MADE_IN.chocolate_cake === 'bakery');
});

test('crafting at Mira\'s: the goods (and lumber) leave, the piece goes into yard storage; missing says what', () => {
  const s = L.newState();
  const bed = C.OUTDOOR.index.flower_bed;
  const had = s.yard.bag[bed] || 0;
  assert.deepStrictEqual(plain(L.craftMissing(s, 'flower_bed')), [['tulip', 4], ['gumamela', 2]]);
  assert.strictEqual(L.craft(s, 'flower_bed'), 'missing');
  L.addItem(s, 'tulip', 5);
  L.addItem(s, 'gumamela', 2);
  assert.strictEqual(L.craft(s, 'flower_bed'), 'ok');
  assert.strictEqual(s.yard.bag[bed], had + 1);
  assert.strictEqual(L.countItem(s, 'tulip'), 1);
  assert.strictEqual(L.countItem(s, 'gumamela'), 0);
  s.lumber = 0;
  L.addItem(s, 'oregano', 3);
  assert.deepStrictEqual(plain(L.craftMissing(s, 'planter')), [['lumber', 1]]);
  s.lumber = 4;
  assert.strictEqual(L.craft(s, 'planter'), 'ok');
  assert.strictEqual(s.lumber, 3);
  C.CRAFT.forEach((r) => {
    const t = C.OUTDOOR.types[C.OUTDOOR.index[r.key]];
    assert.ok(t, r.key + ' is a yard piece');
    const worth = r.needs.reduce((a, n) => a + n[1] * (n[0] === 'lumber' ? C.LUMBER_PRICE : n[0] === 'stone' ? C.STONE_PRICE : C.ITEMS[n[0]].sell), 0);
    assert.ok(worth < t.price, r.key + ': crafting (' + worth + 'G of goods) costs less than buying (' + t.price + 'G)');
  });
});

test('the yard holds 500 pieces, and a maxed farm with a full yard and full cabinets still saves under the limit', () => {
  assert.strictEqual(C.YARD_MAX, 500);
  const s = L.newState();
  const path = C.OUTDOOR.index.stone_path;
  for (let i = 0; i < 500; i++) s.yard.items.push({ t: path, x: 1 + (i % 60), y: 1 + Math.floor(i / 60) });
  s.yard.bag[path] = 1;
  assert.strictEqual(L.placeYard(s, { w: 64, h: 40, noPlace: new Uint8Array(64 * 40), solid: new Uint8Array(64 * 40), needs: [], start: -1 }, path, 2, 30), 'full');
  C.ANIMAL_KEYS.forEach((k) => { for (let i = 0; i < C.ANIMALS[k].max; i++) s.animals.push({ kind: k, name: 'Buttercup 99', love: 100, fed: 1, pet: 1, ready: 2 }); });
  for (let i = 0; i < 24 * 38; i++) if (!s.debris[i]) s.soil[i] = { w: 1, c: 'pumpkin', d: 9 };
  L.resizeBag(s, C.BAG_SIZES.length - 1);
  s.inv = s.inv.map(() => ({ id: 'seed_strawberry', n: 99 }));
  s.store = Array.from({ length: C.STORE_BOXES * 60 }, () => ({ id: 'seed_strawberry', n: 99 }));
  s.project2 = { id: 'barn2', done: s.day + 1 };
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, 'save is ' + size + ' bytes (limit ' + C.MAX_SAVE_BYTES + ')');
  assert.strictEqual(roundTrip(s).yard.items.length, 500);
});

test('the clearing quest asks for 15 at most; shops never close but night is still night; anything but a tool can be dropped', () => {
  C.QUESTS.hard.forEach((d) => d.list.forEach((q) => { if (q.c === 'clear') assert.ok(q.n <= 15); }));
  const s = L.newState();
  s.time = 2 * 60;
  assert.ok(L.shopOpen(s) && L.marketOpen(s) && L.sleepTime(s));
  assert.ok(L.buildingOpen(s, 'bakery') && L.buildingOpen(s, 'woodshop') && !L.buildingOpen(s, 'school'));
  L.addItem(s, 'turnip', 3);
  assert.ok(L.canDrop(s, slotOf(s, 'turnip')));
  assert.ok(!L.canDrop(s, slotOf(s, 'hoe')));
  assert.ok(!L.canDrop(s, s.inv.findIndex((x) => !x)));
});

test('animals: a chicken lays 8 hours after eating, a cow 12; the night only checks who ate today; the timer survives a save', () => {
  clock.set(2026, 4, 1, 9, 0);
  const s = L.newState();
  s.gold = 1e6;
  L.buyAnimal(s, 'cow');
  L.addItem(s, 'fodder', 3);
  L.addItem(s, 'chicken_feed', 3);
  L.addItem(s, 'milker', 1);
  const hen = s.animals[0], cow = s.animals[1];
  assert.strictEqual(L.feedAnimal(s, 0, slotOf(s, 'chicken_feed')), 'ok');
  assert.strictEqual(L.feedAnimal(s, 1, slotOf(s, 'fodder')), 'ok');
  assert.strictEqual(L.feedAnimal(s, 0, slotOf(s, 'chicken_feed')), 'already', 'one meal at a time');
  assert.strictEqual(L.animalLeft(hen), 8 * 60);
  assert.strictEqual(L.animalLeft(cow), 12 * 60);
  // the timer survives a save
  clock.advance(60);
  const back = roundTrip(s);
  assert.strictEqual(L.animalLeft(back.animals[0]), 7 * 60);
  assert.strictEqual(back.animals[0].fd, 1);
  clock.advance(7 * 60); // 5 PM
  L.catchUp(s, clock.ms);
  assert.strictEqual(hen.ready, 1, 'the egg at 5 PM');
  assert.strictEqual(cow.ready, 0, 'the milk not yet');
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(L.feedAnimal(s, 0, slotOf(s, 'chicken_feed')), 'ok', 'fed again');
  clock.advance(4 * 60); // 9 PM
  L.catchUp(s, clock.ms);
  assert.strictEqual(cow.ready, 1);
  // midnight: both ate today, no one is hungry; the hen's second egg comes at 1 AM, after the night
  clock.advance(3 * 60 + 30);
  const r = L.catchUp(s, clock.ms);
  assert.ok(r, 'a new day');
  assert.deepStrictEqual(plain(r.hungry), []);
  clock.advance(60);
  L.catchUp(s, clock.ms);
  assert.strictEqual(hen.ready, 1, 'the second egg');
  // a day without food: hungry at midnight
  L.collect(s, 0); L.collect(s, 1);
  clock.advance(24 * 60);
  const r2 = L.catchUp(s, clock.ms);
  assert.ok(r2.hungry.includes(hen.name) && r2.hungry.includes(cow.name));
  // waiting produce: a fed animal makes the next one when the last is collected
  s.animals[0].ready = 1;
  L.feedAnimal(s, 0, slotOf(s, 'chicken_feed'));
  clock.advance(9 * 60);
  L.catchUp(s, clock.ms);
  assert.strictEqual(hen.fed, 1, 'still waiting: the last egg is in the coop');
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(hen.ready, 1, 'the next one at once');
});
