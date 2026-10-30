// Unit tests for the pure game rules in src/01-logic.js (no browser needed).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
// every rules/content file (the Phaser-free ones), in build order
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
// Weather would water test crops on random rainy mornings; keep it sunny unless a test asks for it.
const realWeather = L.weather;
L.weather = () => 'sunny';

// Objects made inside the vm context have a different prototype; compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, msg) => assert.deepStrictEqual(plain(a), plain(b), msg);
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
// crops grow by the clock: move time on until it is ripe
const growToRipe = (s, idx) => {
  clock.advance(Math.ceil(L.growMins(s.soil[idx])));
  assert.ok(L.isRipe(s.soil[idx]));
};

test('new game starts with tools, seeds and gold', () => {
  const s = L.newState();
  assert.strictEqual(s.gold, C.START_GOLD);
  assert.strictEqual(L.countItem(s, 'hoe'), 1);
  assert.strictEqual(L.countItem(s, 'can'), 1);
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 3);
  ['axe', 'hammer', 'sickle'].forEach((t) => assert.strictEqual(L.countItem(s, t), 1, t));
  assert.strictEqual(s.inv.length, C.INV_SIZE);
});

test('inventory stacks, respects limits and reports overflow', () => {
  const s = L.newState();
  assert.strictEqual(L.addItem(s, 'turnip', 150), 0);
  assert.strictEqual(L.countItem(s, 'turnip'), 150);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'turnip').length, 2);
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'potato', n: 99 };
  assert.strictEqual(L.addItem(s, 'strawberry', 3), 3, 'full bag keeps nothing');
  assert.strictEqual(L.canAdd(s, 'turnip', 48), true);
  assert.strictEqual(L.canAdd(s, 'turnip', 49), false);
});

test('till, plant and grow a turnip to harvest in real time; a ripe crop withers if left too long', () => {
  const s = L.newState();
  const seeds = slotOf(s, 'seed_turnip');
  assert.strictEqual(L.plant(s, 5, seeds), 'nosoil');
  assert.strictEqual(L.till(s, 5), 'ok');
  assert.strictEqual(L.till(s, 5), 'already');
  assert.strictEqual(L.plant(s, 5, seeds), 'ok');
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 2);
  assert.strictEqual(L.plant(s, 5, seeds), 'occupied');
  assert.strictEqual(L.cropStage(s.soil[5]), 0);
  assert.strictEqual(C.CROPS.turnip.mins, 15);
  // dry, it stays a seed (owner, 29 Oct 2026: a crop needs water to grow)
  clock.advance(60);
  assert.strictEqual(L.cropStage(s.soil[5]), 0);
  assert.strictEqual(L.cropLeft(s.soil[5]), 15);
  // watered, it grows by the clock in its seed packet's time
  assert.strictEqual(L.water(s, 5), 'ok');
  clock.advance(8);
  assert.strictEqual(L.cropStage(s.soil[5]), 2);
  assert.strictEqual(L.harvest(s, 5), '!notripe');
  assert.strictEqual(L.cropLeft(s.soil[5]), 7);
  clock.advance(7);
  assert.ok(L.isRipe(s.soil[5]));
  assert.strictEqual(L.harvest(s, 5), 'turnip');
  assert.strictEqual(L.countItem(s, 'turnip'), 1);
  same(s.soil[5], { w: 0, c: null, p: 0, r: 0 }, 'soil stays tilled after harvest');

  // ripe for as long as it grew (at least 4 hours), then withered: the Hoe clears it
  L.plant(s, 5, seeds);
  L.water(s, 5);
  clock.advance(15 + C.GROW.witherMin - 1);
  assert.ok(L.isRipe(s.soil[5]));
  clock.advance(1);
  assert.ok(L.isWithered(s.soil[5]));
  assert.strictEqual(L.harvest(s, 5), '!notripe');
  assert.strictEqual(L.till(s, 5), 'cleared');
  same(s.soil[5], { w: 1, c: null, p: 0, r: 0 }, 'cleared, still wet');
});

test('a crop needs water to grow: dry it stays a seed, watered it grows from then (owner, 29 Oct 2026)', () => {
  const s = L.newState();
  s.water = 20;
  L.till(s, 5);
  L.till(s, 6);
  L.water(s, 7); // (no soil there)
  L.plantBag(s, [5, 6], slotOf(s, 'seed_turnip'));
  clock.advance(3 * 60);
  assert.strictEqual(L.cropStage(s.soil[5]), 0, 'three hours dry: still a seed');
  assert.ok(L.needsWater(s.soil[5]));
  assert.strictEqual(L.nextHarvest(s), null, 'nothing to remind about while it waits');
  assert.strictEqual(L.water(s, 5), 'ok');
  assert.strictEqual(L.water(s, 5), 'already');
  assert.strictEqual(L.growMins(s.soil[5]), 15, 'the seed packet\'s time');
  clock.advance(15);
  assert.ok(L.isRipe(s.soil[5]), 'watered: ripe 15 minutes after watering');
  assert.strictEqual(L.cropStage(s.soil[6]), 0, 'the dry one next to it never grew');
  assert.strictEqual(L.water(s, 5), 'already', 'nothing to gain on a ripe crop');
  // soil watered before planting: the crop grows right away
  L.harvest(s, 5);
  L.water(s, 5);
  L.plantBag(s, [5], slotOf(s, 'seed_turnip'));
  clock.advance(15);
  assert.ok(L.isRipe(s.soil[5]));
  const t = L.newState();
  t.water = 20;
  // grass for the animals grows by itself; a crop planted before the rule (no h) grows dry, faster when watered
  L.till(t, 2);
  L.addItem(t, 'seed_grass', 1);
  L.plantBag(t, [2], slotOf(t, 'seed_grass'));
  clock.advance(C.CROPS.grass.mins);
  assert.ok(L.isRipe(t.soil[2]), 'grass needs no water');
  const old = { c: 'turnip', p: L.nowMin(), w: 0, r: 0 };
  clock.advance(15);
  assert.ok(L.isRipe(old), 'an old dry crop still ripens');
  assert.strictEqual(L.growMins({ c: 'turnip', p: 0, w: 1, r: 0 }), 15 * 0.75);
  // rain waters the field and the waiting crops start growing; the rule survives a save
  L.till(t, 3);
  L.addItem(t, 'seed_turnip', 1);
  L.plantBag(t, [3], slotOf(t, 'seed_turnip'));
  assert.strictEqual(L.deserialize(JSON.parse(JSON.stringify(L.serialize(t)))).soil[3].h, 1);
  L.weather = () => 'rain';
  clock.nextDay(L, t);
  L.weather = () => 'sunny';
  clock.advance(15);
  assert.ok(L.isRipe(t.soil[3]), 'the rain watered it');
});

test('growth stages progress for every crop', () => {
  C.CROP_KEYS.forEach((crop) => {
    const mins = C.CROPS[crop].mins, t = { c: crop, p: 1000, w: 0, r: 0 };
    const stages = [];
    for (let k = 0; k <= 8; k++) stages.push(L.cropStage(t, 1000 + Math.round((mins * k) / 8)));
    assert.strictEqual(stages[0], 0, crop);
    assert.strictEqual(stages[8], 3, crop);
    stages.slice(1, -1).forEach((st) => assert.ok(st >= 0 && st <= 2, crop));
    for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], crop);
  });
});

test('watering can runs dry and refills', () => {
  const s = L.newState();
  for (let i = 0; i < L.canCapacity(s); i++) {
    L.till(s, i);
    assert.strictEqual(L.water(s, i), 'ok');
  }
  L.till(s, 999);
  assert.strictEqual(L.water(s, 999), 'empty');
  L.refill(s);
  assert.strictEqual(L.water(s, 999), 'ok');
});

test('energy is spent, and comes back by itself over time (not by sleeping)', () => {
  const s = L.newState();
  assert.ok(L.spendEnergy(s, 99));
  assert.strictEqual(L.spendEnergy(s, 2), false);
  L.endDay(s);
  assert.strictEqual(s.energy, 1, 'a new day does not refill it');
  clock.advance(C.ENERGY_EVERY * 10 + 1);
  assert.strictEqual(L.regen(s), 10);
  assert.strictEqual(s.energy, 11);
  clock.advance(24 * 60); // a day away: full, never more
  L.regen(s);
  assert.strictEqual(s.energy, L.maxEnergy(s));
});

test('shipping pays out at midnight', () => {
  const s = L.newState();
  L.addItem(s, 'turnip', 3);
  L.addItem(s, 'strawberry', 2);
  assert.strictEqual(L.ship(s, slotOf(s, 'hoe')), null, 'tools cannot be shipped');
  assert.strictEqual(L.ship(s, slotOf(s, 'turnip')).value, 3 * C.ITEMS.turnip.sell);
  L.ship(s, slotOf(s, 'strawberry'));
  assert.strictEqual(L.countItem(s, 'turnip'), 0);
  const value = 3 * C.ITEMS.turnip.sell + 2 * C.ITEMS.strawberry.sell;
  assert.strictEqual(L.boxValue(s), value);
  const gold = s.gold, day = s.day;
  const r = clock.nextDay(L, s);
  assert.strictEqual(r.earned, value);
  assert.strictEqual(s.gold, gold + r.earned);
  assert.strictEqual(s.box.length, 0);
  assert.strictEqual(s.day, day + 1);
  assert.strictEqual(s.time, 8 * 60, 'the clock is the phone\'s');
});

test('shop checks gold and bag space', () => {
  const s = L.newState();
  s.gold = 100;
  assert.strictEqual(L.buy(s, 'chicken_feed', 11), 'gold');
  assert.strictEqual(L.buy(s, 'chicken_feed', 8), 'ok');
  assert.strictEqual(s.gold, 20);
  assert.strictEqual(L.countItem(s, 'chicken_feed'), 13);
  s.gold = 1e6;
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'potato', n: 99 };
  assert.strictEqual(L.buy(s, 'seed_strawberry', 1), 'full');
});

test('shop hours', () => {
  const s = L.newState();
  s.time = C.SHOP_OPEN - 1;
  assert.strictEqual(L.shopOpen(s), false);
  s.time = C.SHOP_OPEN;
  assert.strictEqual(L.shopOpen(s), true);
  s.time = C.SHOP_CLOSE;
  assert.strictEqual(L.shopOpen(s), false);
});

test('time formatting', () => {
  assert.strictEqual(L.formatTime(360), '6:00 AM');
  assert.strictEqual(L.formatTime(725), '12:05 PM');
  assert.strictEqual(L.formatTime(1439), '11:59 PM');
  assert.strictEqual(L.formatTime(889.7), '2:49 PM');
  assert.strictEqual(L.formatTime(1500), '1:00 AM');
});

test('save round-trips through JSON', () => {
  const s = L.newState();
  L.till(s, 300);
  L.plant(s, 300, slotOf(s, 'seed_turnip'));
  L.water(s, 300);
  L.till(s, 301);
  clock.advance(5);
  L.addItem(s, 'potato', 4);
  L.ship(s, slotOf(s, 'potato'));
  s.player = { x: 100.4, y: 200.6, dir: 'left' };
  s.sel = 2;
  s.energy = 40;
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  same(back.soil, s.soil);
  same(back.inv, s.inv);
  same(back.box, s.box);
  same(back.player, { x: 100, y: 201, dir: 'left' });
  ['day', 'start', 'gold', 'energy', 'water', 'sel', 'regen'].forEach((k) => assert.strictEqual(back[k], s[k], k));
  assert.strictEqual(L.cropStage(back.soil[300]), L.cropStage(s.soil[300]));
});

test('a save from before real time carries on from today', () => {
  const back = L.deserialize({ v: 1, mg: 2, d: 30, t: 900, f: [[10, 1, 1, 3], [11, 0, 0, 0]], pj: [0, 32], g: 500 });
  const today = L.dayOf(clock.ms);
  assert.strictEqual(back.day, today);
  assert.strictEqual(back.start, today - 29, 'it started 29 days ago');
  assert.strictEqual(back.project.done, today + 2, 'a building still has the days it had left');
  assert.strictEqual(back.soil[10].c, 'turnip');
  assert.ok(L.isRipe(back.soil[10]), 'a turnip grown 3 of 3 days is ripe');
  same(back.soil[11], { w: 0, c: null, p: 0, r: 0 });
});

test('worst-case save stays under 16 KB', () => {
  const s = L.newState();
  for (let idx = 0; idx < 224; idx++) { // the whole field (224 tillable tiles) planted, every tile different
    L.till(s, idx);
    s.soil[idx] = { w: idx % 2, c: C.CROP_KEYS[idx % 40], p: clock.min() - 2000 - idx * 7, r: 0 };
  }
  L.resizeBag(s, 2); // the biggest bag
  s.inv = s.inv.map(() => ({ id: 'seed_strawberry', n: 99 }));
  C.CROP_KEYS.forEach((c) => s.box.push({ id: C.CROPS[c].item, n: 9999 }));
  s.gold = 999999999;
  s.player = { x: 12345, y: 12345, dir: 'right' };
  s.animals = [];
  C.ANIMAL_KEYS.forEach((k) => { for (let i = 0; i < C.ANIMALS[k].max; i++) s.animals.push({ kind: k, name: 'Buttercup 99', love: 100, fed: 1, pet: 1, ready: 1 }); });
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, `save is ${size} bytes`);
});

test('bad or foreign save data is rejected or sanitised', () => {
  [null, undefined, 'x', 42, [], {}, { v: 99 }].forEach((bad) => assert.strictEqual(L.deserialize(bad), null));
  const today = L.dayOf(clock.ms);
  const s = L.deserialize({
    v: 1, mg: 2, rt: 1, d: -5, t: 'noon', g: 1e20, e: 500, w: -1, s: 77,
    i: [['hoe', 1], ['rocket', 3], ['turnip', 1000], 'junk'],
    b: [['hoe', 1], ['turnip', 2]],
    f: [[999, 5, 1, 10], [1, 'x', 0, 11, 'y'], 'junk', [0, 0, 0, -1]],
    p: [1, 2],
  });
  assert.strictEqual(s.day, 0);
  assert.strictEqual(s.energy, C.MAX_ENERGY);
  assert.strictEqual(s.water, 0);
  assert.strictEqual(s.sel, C.INV_SIZE - 1);
  same(s.inv.slice(0, 4), [{ id: 'hoe', n: 1 }, null, { id: 'turnip', n: 99 }, null]);
  same(s.box, [{ id: 'turnip', n: 2 }]);
  same(s.soil[10], { w: 1, c: null, p: 0, r: 0 });
  assert.strictEqual(s.soil[11].c, 'turnip');
  assert.strictEqual(s.player.x, null);
  assert.ok(L.catchUp(s, clock.ms).days > 0, 'a nonsense day just catches up');
  assert.strictEqual(s.day, today);
});

test('a new game starts with one chicken and some feed', () => {
  const s = L.newState();
  assert.strictEqual(s.animals.length, 1);
  same(s.animals[0], { kind: 'chicken', name: 'Clucky', love: 0, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0 });
  assert.strictEqual(L.countItem(s, 'chicken_feed'), 5);
});

test('buying animals checks gold and building space, and names them', () => {
  const s = L.newState();
  s.gold = 999;
  assert.strictEqual(L.buyAnimal(s, 'cow'), 'gold');
  s.gold = 1e6;
  assert.strictEqual(L.buyAnimal(s, 'cow'), 1);
  assert.strictEqual(s.animals[1].name, 'Daisy');
  assert.strictEqual(s.gold, 1e6 - C.ANIMALS.cow.price);
  for (let i = 1; i < C.ANIMALS.chicken.max; i++) L.buyAnimal(s, 'chicken');
  assert.strictEqual(L.animalCount(s, 'chicken'), C.ANIMALS.chicken.max);
  assert.strictEqual(L.buyAnimal(s, 'chicken'), 'full');
  same(s.animals.filter((a) => a.kind === 'chicken').map((a) => a.name), ['Clucky', 'Nugget', 'Pecky', 'Henrietta']);
});

test('names get numbered once the list runs out', () => {
  const s = L.newState();
  s.animals = C.ANIMALS.cow.names.map((name) => ({ kind: 'cow', name, love: 0, fed: 0, pet: 0, ready: 0 }));
  assert.strictEqual(L.nextName(s, 'cow'), 'Daisy 2');
});

test('feeding needs the right feed, once a day', () => {
  const s = L.newState();
  const feed = slotOf(s, 'chicken_feed');
  assert.strictEqual(L.feedAnimal(s, 0, slotOf(s, 'hoe')), 'nofeed');
  L.addItem(s, 'fodder', 1);
  assert.strictEqual(L.feedAnimal(s, 0, slotOf(s, 'fodder')), 'wrong');
  assert.strictEqual(L.feedAnimal(s, 0, feed), 'ok');
  assert.strictEqual(L.countItem(s, 'chicken_feed'), 4);
  assert.strictEqual(L.feedAnimal(s, 0, feed), 'already');
  assert.strictEqual(L.countItem(s, 'chicken_feed'), 4);
});

test('a fed animal has produce the next morning; collecting adds it to the bag', () => {
  const s = L.newState();
  assert.strictEqual(L.collect(s, 0), '!notready');
  L.feedAnimal(s, 0, slotOf(s, 'chicken_feed'));
  const r = L.endDay(s);
  same(r.produced, { egg: 1 });
  same(r.hungry, []);
  assert.strictEqual(s.animals[0].ready, 1);
  assert.strictEqual(s.animals[0].fed, 0, 'hunger resets overnight');
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(L.countItem(s, 'egg'), 1);
  assert.strictEqual(L.collect(s, 0), '!notready');
  // eggs sell through the shipping box like crops
  assert.strictEqual(L.ship(s, slotOf(s, 'egg')).value, C.ITEMS.egg.sell);
});

test('uncollected produce does not stack up', () => {
  const s = L.newState();
  for (let d = 0; d < 3; d++) {
    s.animals[0].fed = 1;
    L.endDay(s);
  }
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(L.collect(s, 0), '!notready');
});

test('a full bag keeps the produce waiting', () => {
  const s = L.newState();
  s.animals[0].ready = 1;
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'potato', n: 99 };
  assert.strictEqual(L.collect(s, 0), '!full');
  assert.strictEqual(s.animals[0].ready, 1);
});

test('love grows with care and drops with neglect', () => {
  const s = L.newState();
  const a = s.animals[0];
  assert.strictEqual(L.petAnimal(s, 0), 'ok');
  assert.strictEqual(L.petAnimal(s, 0), 'already');
  L.feedAnimal(s, 0, slotOf(s, 'chicken_feed'));
  assert.strictEqual(a.love, C.LOVE.pet + C.LOVE.feed);
  L.endDay(s);
  a.love = 50;
  const r = L.endDay(s); // neither fed nor petted
  same(r.hungry, ['Clucky']);
  assert.strictEqual(a.love, 50 + C.LOVE.hungry + C.LOVE.lonely);
  a.love = 99;
  L.petAnimal(s, 0);
  assert.strictEqual(a.love, C.LOVE.max);
  assert.strictEqual(L.hearts(a), 5);
});

test('animals round-trip through the save, and old saves load without them', () => {
  const s = L.newState();
  s.gold = 1e6;
  L.buyAnimal(s, 'cow');
  s.animals[1].love = 42;
  s.animals[1].ready = 1;
  L.petAnimal(s, 0);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  same(back.animals, s.animals);
  const old = L.serialize(s);
  delete old.a;
  same(L.deserialize(old).animals, []);
});

test('bad animal save data is sanitised', () => {
  const o = L.serialize(L.newState());
  o.a = [[9, 1, 1, 1, 1, 'Ghost'], 'junk', [1, 500, 1, 0, 0, 12345], ...Array(6).fill([0, 10, 0, 0, 0, 'Hen'])];
  const s = L.deserialize(o);
  same(s.animals[0], { kind: 'cow', name: 'Daisy', love: C.LOVE.max, fed: 1, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0 });
  assert.strictEqual(L.animalCount(s, 'chicken'), C.ANIMALS.chicken.max);
});

test('calendar: the real date; seasons by month', () => {
  const day = (y, m, d) => L.dayOf(new Date(y, m - 1, d, 12).getTime());
  same(L.date(day(2026, 10, 27)), { season: 2, key: 'fall', name: 'Fall', day: 27, month: 10, monthName: 'October', year: 2026, weekday: 2 });
  assert.strictEqual(L.formatDate(day(2026, 10, 27)), 'Oct 27');
  const season = (m) => L.date(day(2026, m, 15)).key;
  same([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(season),
    ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter']);
  assert.strictEqual(day(2026, 3, 1) - day(2026, 2, 28), 1);
  assert.strictEqual(L.minuteOf(new Date(2026, 0, 1, 13, 45).getTime()), 13 * 60 + 45);
});

test('the shop sells this season\'s 10 seeds (and grass and wheat, but not in winter)', () => {
  const day = (m) => L.dayOf(new Date(2026, m - 1, 10, 12).getTime());
  const seeds = (m) => L.seedsInSeason(day(m));
  assert.strictEqual(seeds(4).length, 12);
  assert.ok(seeds(4).includes('seed_wheat') && seeds(7).includes('seed_wheat') && seeds(10).includes('seed_wheat') && !seeds(1).includes('seed_wheat'));
  assert.ok(seeds(4).includes('seed_turnip') && seeds(4).includes('seed_tulip') && seeds(4).includes('seed_grass'));
  assert.ok(seeds(7).includes('seed_watermelon') && !seeds(7).includes('seed_turnip'));
  assert.ok(seeds(10).includes('seed_pumpkin') && seeds(10).includes('seed_rice'));
  assert.strictEqual(seeds(1).length, 10, 'winter has its own 10');
  assert.ok(seeds(1).includes('seed_coffee') && !seeds(1).includes('seed_grass'));
  assert.strictEqual(L.seasonsOf('tomato'), 'Summer');
});

test('seeds only go in the ground in their season', () => {
  const s = L.newState(); // April: spring
  L.addItem(s, 'seed_tomato', 2);
  L.till(s, 1);
  assert.strictEqual(L.plant(s, 1, slotOf(s, 'seed_tomato')), 'season');
  assert.strictEqual(L.countItem(s, 'seed_tomato'), 2, 'seeds are kept');
  s.day = L.dayOf(new Date(2026, 6, 1, 12).getTime()); // July
  assert.strictEqual(L.plant(s, 1, slotOf(s, 'seed_tomato')), 'ok');
});

test('a crop planted at the end of a season grows on into the next', () => {
  clock.set(2026, 5, 31, 23, 0); // the last hour of spring
  const s = L.newState();
  L.till(s, 1);
  L.addItem(s, 'seed_onion', 1);
  L.plant(s, 1, slotOf(s, 'seed_onion'));
  s.water = 5;
  L.water(s, 1);
  const r = clock.nextDay(L, s); // June 1st: summer
  assert.strictEqual(r.newSeason, 'Summer');
  assert.strictEqual(s.soil[1].c, 'onion');
  clock.advance(24 * 60);
  assert.ok(L.isRipe(s.soil[1]));
  clock.set(2026, 4, 1, 10, 0);
});

test('10 crops in every season, all sellable, from 15 minutes to 2 days', () => {
  // (wheat, for the Bakery, grows in three seasons on top of each season's own 10)
  C.SEASONS.forEach((se) => assert.strictEqual(C.CROP_KEYS.filter((k) => !C.CROPS[k].sickle && k !== 'wheat' && C.CROPS[k].seasons[0] === se.key).length, 10, se.key));
  C.CROP_KEYS.forEach((k) => assert.ok(C.ITEMS[C.CROPS[k].item].sell || C.CROPS[k].sickle, k + ' sells'));
  C.CROP_KEYS.forEach((k) => assert.ok(C.ITEMS['seed_' + k] && C.ITEMS['seed_' + k].crop === k, k + ' has seeds'));
  const mins = C.CROP_KEYS.map((k) => C.CROPS[k].mins);
  assert.strictEqual(Math.min(...mins), 15);
  assert.strictEqual(Math.max(...mins), 2880);
  // longer crops pay more per harvest, quicker ones more per hour
  const per = (k) => C.ITEMS[k].sell - C.ITEMS['seed_' + k].price / 9;
  assert.ok(per('watermelon') > per('turnip'));
  assert.ok(per('turnip') / 15 > per('watermelon') / 2880);
});

test('soil tilled on a rainy day comes out wet; on a dry day it needs watering', () => {
  const s = L.newState(), weather = L.weather;
  try {
    L.weather = () => 'rain';
    L.till(s, 5);
    assert.strictEqual(s.soil[5].w, 1);
    L.weather = () => 'sunny';
    L.till(s, 6);
    assert.strictEqual(s.soil[6].w, 0);
  } finally {
    L.weather = weather;
  }
});

test('coming back after days away: each midnight is counted once, in one report', () => {
  const s = L.newState();
  const day0 = s.day;
  L.addItem(s, 'turnip', 2);
  L.ship(s, slotOf(s, 'turnip'));
  s.animals[0].fed = 1;
  s.energy = 10;
  assert.strictEqual(L.catchUp(s, clock.ms), null, 'still the same day');
  clock.advance(3 * 24 * 60 + 5); // 3 days later
  const r = L.catchUp(s, clock.ms);
  assert.strictEqual(r.days, 3);
  assert.strictEqual(s.day, day0 + 3);
  assert.strictEqual(r.earned, 2 * C.ITEMS.turnip.sell, 'the box paid once');
  assert.strictEqual(r.produced.egg, 1, 'the hen was fed the first day only');
  assert.deepStrictEqual(plain(r.hungry), [s.animals[0].name]);
  assert.strictEqual(s.energy, L.maxEnergy(s), 'energy came back while away');
  assert.strictEqual(L.catchUp(s, clock.ms), null);
  clock.advance(-2 * 24 * 60); // the phone's clock set back: the farm does not go back
  assert.strictEqual(L.catchUp(s, clock.ms), null);
  assert.strictEqual(s.day, day0 + 3);
  clock.set(2026, 4, 1, 10, 0);
});

test('the next crop to ripen, for the phone reminder (grass is left out; Alerts off sends nothing)', () => {
  clock.set(2026, 4, 1, 10, 0);
  const s = L.newState();
  s.debris = {};
  const seeds = slotOf(s, 'seed_turnip');
  assert.strictEqual(L.nextHarvest(s), null, 'nothing growing');
  s.water = 5;
  L.till(s, 5); L.plant(s, 5, seeds); L.water(s, 5);
  L.till(s, 6); L.plant(s, 6, seeds); L.water(s, 6);
  const at = L.nowMin() + Math.ceil(L.growMins(s.soil[5]));
  same(L.nextHarvest(s), { at, item: 'turnip', n: 2 });
  s.soil[7] = { c: 'grass', p: L.nowMin(), w: 0 };
  assert.strictEqual(L.nextHarvest(s).item, 'turnip', 'grass is not a harvest to remind about');
  clock.advance(Math.ceil(L.growMins(s.soil[5])) + 1);
  assert.strictEqual(L.nextHarvest(s), null, 'already ripe: nothing to wait for');

  // the host sends it to the app only when it changes, and null when Alerts is off
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '02-host.js'), 'utf8'), ctx);
  const H = ctx.window.Farm.Host, sent = [];
  ctx.window.gameHost.remind = (r) => sent.push(r && JSON.parse(JSON.stringify(r)));
  const t = L.newState();
  t.debris = {};
  t.water = 5;
  L.till(t, 5); L.plant(t, 5, slotOf(t, 'seed_turnip')); L.water(t, 5);
  H.remind(t);
  H.remind(t);
  assert.strictEqual(sent.length, 1, 'once per change');
  assert.strictEqual(sent[0].at, L.nextHarvest(t).at * 60000);
  assert.match(sent[0].body, /Your turnip crop is ripe!/);
  t.opts.alerts = 0;
  H.remind(t);
  same(sent, [sent[0], null], 'Alerts off clears the reminder');
  delete ctx.window.gameHost.remind;
});

test('Alerts is saved, and older saves have it on', () => {
  const s = L.newState();
  s.opts.alerts = 0;
  assert.strictEqual(L.deserialize(plain(L.serialize(s))).opts.alerts, 0);
  const old = plain(L.serialize(L.newState()));
  old.op = [1, 0];
  same(L.deserialize(old).opts, { music: 1, sfx: 0, alerts: 1 });
});

test("a new farm's starter seeds are the season's 15-minute crop, so they can be planted straight away", () => {
  const seeds = (y, m, d) => { clock.set(y, m, d, 10, 0); const s = L.newState(); return s.inv.filter((x) => x && /^seed_/.test(x.id)).map((x) => x.id + ' x' + x.n); };
  same(seeds(2026, 4, 1), ['seed_turnip x3']);
  same(seeds(2026, 7, 10), ['seed_okra x3']);
  same(seeds(2026, 10, 26), ['seed_carrot x3']);
  same(seeds(2026, 12, 30), ['seed_kale x3']);
  // and each one really can be planted that day
  for (const [m, id] of [[4, 'seed_turnip'], [7, 'seed_okra'], [10, 'seed_carrot'], [1, 'seed_kale']]) {
    clock.set(2026, m, 10, 10, 0);
    const s = L.newState();
    s.debris = {};
    L.till(s, 5);
    assert.strictEqual(L.plant(s, 5, slotOf(s, id)), 'ok', id + ' plants in month ' + m);
  }
  clock.set(2026, 4, 1, 10, 0);
});

test('the forge says what each upgrade gives', () => {
  const s = L.newState();
  assert.strictEqual(L.upgradeText(s, 'can'), 'Copper Can: holds 30 water (now 20) and waters 3 tiles in a line; uses 20% less energy.');
  s.tools.hammer = 0;
  assert.match(L.upgradeText(s, 'hammer'), /can break boulders/);
  s.tools.axe = 1;
  assert.match(L.upgradeText(s, 'axe'), /^Silver Axe: chops a 3 x 3 patch at once and stumps in 1 swing; uses 35% less energy\.$/);
  s.tools.hoe = 3;
  assert.strictEqual(L.upgradeText(s, 'hoe'), null);
});

test("the first-days goals name this season's starter crop and give its seeds", () => {
  clock.set(2026, 10, 26, 10, 0);
  const s = L.newState();
  s.goal = 1;
  assert.strictEqual(L.goal(s).reward.item, 'seed_carrot');
  s.goal = 5;
  assert.match(L.goal(s).text, /^Harvest your carrots when they are ripe/);
  clock.set(2026, 4, 1, 10, 0);
  const t = L.newState();
  t.goal = 5;
  assert.match(L.goal(t).text, /^Harvest your turnips/);
});

test('a bigger bag: 18 -> 24 -> 30 ... 90 slots at Lily\'s, kept in the save, items stay put', () => {
  const s = L.newState();
  assert.strictEqual(s.inv.length, 18);
  same(L.nextBag(s), { size: 24, price: 2000, needs: null });
  s.gold = 1000;
  assert.strictEqual(L.upgradeBag(s), 'gold');
  s.gold = 9000;
  L.addItem(s, 'carrot', 7);
  assert.strictEqual(L.upgradeBag(s), 'ok');
  assert.strictEqual(s.inv.length, 24);
  assert.strictEqual(s.gold, 7000);
  assert.strictEqual(L.upgradeBag(s), 'ok');
  assert.strictEqual(s.inv.length, 30);
  // owner, 30 Oct: then 6 more each time, up to 90 (three pages of 30)
  same(L.nextBag(s), { size: 36, price: 10000, needs: null });
  s.gold = 1e9;
  const sizes = [];
  while (L.upgradeBag(s) === 'ok') sizes.push(s.inv.length);
  same(sizes, [36, 42, 48, 54, 60]);
  assert.strictEqual(L.upgradeBag(s), 'needs', 'from 66 on it takes leather too');
  L.addItem(s, 'leather_soft', 10); L.addItem(s, 'leather_thick', 10); L.addItem(s, 'leather_tough', 5);
  while (L.upgradeBag(s) === 'ok') sizes.push(s.inv.length);
  same(sizes, [36, 42, 48, 54, 60, 66, 72, 78, 84, 90]);
  assert.strictEqual(L.countItem(s, 'leather_soft') + L.countItem(s, 'leather_thick') + L.countItem(s, 'leather_tough'), 0);
  assert.strictEqual(L.upgradeBag(s), 'max');
  assert.strictEqual(L.nextBag(s), null);
  s.inv[89] = { id: 'fish_s', n: 2 };
  s.sel = 89;
  const back = L.deserialize(plain(L.serialize(s)));
  assert.strictEqual(back.inv.length, 90);
  same(back.inv[89], { id: 'fish_s', n: 2 });
  assert.strictEqual(back.sel, 89);
  assert.strictEqual(L.countItem(back, 'carrot'), 7);
  const old = plain(L.serialize(L.newState()));
  assert.strictEqual(L.deserialize(old).inv.length, 18, 'older saves keep 18');
});

test('the Weekend Market: Saturdays and Sundays the stall pays full price and seeds are 20% off', () => {
  clock.set(2026, 10, 31, 10, 0); // a Saturday
  const s = L.newState();
  assert.strictEqual(L.weekendMarket(s.day), true);
  assert.strictEqual(L.priceOf('seed_carrot', s.day), 16);
  assert.strictEqual(L.instantPrice('carrot', 10), 50);
  s.gold = 100;
  assert.strictEqual(L.buy(s, 'seed_carrot', 5), 'ok');
  assert.strictEqual(s.gold, 20);
  clock.set(2026, 10, 28, 10, 0); // a Wednesday
  const t = L.newState();
  assert.strictEqual(L.weekendMarket(t.day), false);
  assert.strictEqual(L.priceOf('seed_carrot', t.day), 20);
  assert.strictEqual(L.instantPrice('carrot', 10), 30);
  assert.strictEqual(L.priceOf('brush', 0), C.ITEMS.brush.price, 'only seeds are on sale');
  clock.set(2026, 4, 1, 10, 0);
});

test('review fixes (26 Oct): energy above 100 from a lovely yard survives a reload', () => {
  const s = L.newState();
  const t = C.OUTDOOR.types.map((x, i) => [x.kind !== 'prop' ? x.beauty : 0, i]).sort((a, b) => b[0] - a[0])[0][1];
  for (let i = 0; i < 300 && L.maxEnergy(s) <= C.MAX_ENERGY; i++) s.yard.items.push({ t, x: i % 20, y: Math.floor(i / 20) });
  assert.ok(L.maxEnergy(s) > C.MAX_ENERGY, 'the yard raised the max (' + L.maxEnergy(s) + ')');
  s.energy = L.maxEnergy(s);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.strictEqual(back.energy, s.energy);
});

test('review fixes: a farm snapshot naming a strange animal kind is ignored, not a crash', () => {
  const mine = L.newState();
  const snap = L.snapshot(L.newState());
  snap.animals = [['constructor', '', 0], ['toString', 'Bob', 0], ['chicken', 'Hen', 0]];
  const st = L.visitState(JSON.parse(JSON.stringify(snap)), mine);
  same(st.animals.map((a) => a.kind), ['chicken']);
});

test('review fixes: a full mailbox never drops a letter with a gift', () => {
  const s = L.newState();
  const gifted = Object.keys(C.LETTERS).filter((k) => C.LETTERS[k].gift && !/fest|bday/.test(k));
  const plainKey = 'bday:' + C.VILLAGER_ORDER[0]; // birthday and festival letters carry no gift
  assert.ok(gifted.length && plainKey);
  s.mail = [gifted[0]];
  for (let i = 0; i < 12; i++) s.mail.push(plainKey);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.ok(back.mail.indexOf(gifted[0]) >= 0, 'the gift letter is still there');
  assert.ok(back.mail.length <= 8);
});

test('review fixes: the music box never takes energy; a Power-Up runs past midnight; deep chests stay opened', () => {
  const s = L.newState();
  s.energy = L.maxEnergy(s) + 10;
  const e = s.energy;
  L.playMusicBox(s);
  assert.ok(s.energy >= e);
  s.day = 100; s.time = 23 * 60 + 30;
  s.pwr = { day: s.day, until: s.time + C.POWER_UP.minutes };
  s.day = 101; s.time = 30;
  assert.strictEqual(L.powered(s), true, '00:30 is inside a Power-Up drunk at 23:30');
  s.time = 120;
  assert.strictEqual(L.powered(s), false);
  const floor = (n) => n * C.MINE.chestEvery;
  s.chests = 0; s.chHi = 0;
  s.chests |= 1;
  s.chHi = 31;
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  assert.strictEqual(L.chestOpened(back, floor(1)), true, 'the first chest');
  assert.strictEqual(L.chestOpened(back, floor(31)), true, 'a chest past floor 150');
  assert.strictEqual(L.chestOpened(back, floor(32)), false);
});

test('review fixes: walking in and out of the mine is not "going down" a floor', () => {
  const s = L.newState();
  const before = L.count(s, 'floor');
  L.reachFloor(s, 1); L.reachFloor(s, 1); L.reachFloor(s, 1); L.reachFloor(s, 2);
  assert.strictEqual(L.count(s, 'floor') - before, 2);
});

test('review fixes 2: setting the date back gives no extra login gift; Landscaper counts pieces in the yard', () => {
  const s = L.newState();
  const day = (n) => '2026-10-' + n; // F.today()'s format
  assert.ok(typeof L.claimLogin(s, day(10)) === 'object', 'day 10');
  assert.ok(typeof L.claimLogin(s, day(11)) === 'object', 'day 11');
  assert.strictEqual(L.loginGift(s, day(10)), null, 'back to day 10: nothing');
  assert.strictEqual(L.loginGift(s, day(11)), null, 'and day 11 again: nothing');
  assert.ok(L.loginGift(s, day(12)), 'day 12: the next gift');
  const i = C.ACHIEVEMENTS.findIndex((a) => a.key === 'landscaper');
  s.cnt.decor = 500; // placed and stored the same piece hundreds of times
  s.yard.items = [];
  assert.strictEqual(L.achReady(s, i), false);
  for (let k = 0; k < 100; k++) s.yard.items.push({ t: 0, x: k % 20, y: Math.floor(k / 20) });
  assert.strictEqual(L.achReady(s, i), true);
});
