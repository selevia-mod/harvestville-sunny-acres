// Unit tests for the pure game rules in src/01-logic.js (no browser needed).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
['00-config.js', '01-logic.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;

// Objects made inside the vm context have a different prototype; compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, msg) => assert.deepStrictEqual(plain(a), plain(b), msg);
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const growToRipe = (s, idx) => {
  for (let i = 0; i < 20 && !L.isRipe(s.soil[idx]); i++) {
    L.water(s, idx);
    L.refill(s);
    L.endDay(s);
  }
};

test('new game starts with tools, seeds and gold', () => {
  const s = L.newState();
  assert.strictEqual(s.gold, C.START_GOLD);
  assert.strictEqual(L.countItem(s, 'hoe'), 1);
  assert.strictEqual(L.countItem(s, 'can'), 1);
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 6);
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

test('till, plant, water and grow a turnip to harvest', () => {
  const s = L.newState();
  const seeds = slotOf(s, 'seed_turnip');
  assert.strictEqual(L.plant(s, 5, seeds), 'nosoil');
  assert.strictEqual(L.till(s, 5), 'ok');
  assert.strictEqual(L.till(s, 5), 'already');
  assert.strictEqual(L.plant(s, 5, seeds), 'ok');
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 5);
  assert.strictEqual(L.plant(s, 5, seeds), 'occupied');
  assert.strictEqual(L.cropStage(s.soil[5]), 0);

  // an unwatered day does not grow
  L.endDay(s);
  assert.strictEqual(s.soil[5].d, 0);

  for (let day = 1; day <= C.CROPS.turnip.days; day++) {
    assert.strictEqual(L.harvest(s, 5), '!notripe');
    assert.strictEqual(L.water(s, 5), 'ok');
    assert.strictEqual(L.water(s, 5), 'already');
    L.endDay(s);
    assert.strictEqual(s.soil[5].w, 0, 'watering resets overnight');
  }
  assert.ok(L.isRipe(s.soil[5]));
  assert.strictEqual(L.harvest(s, 5), 'turnip');
  assert.strictEqual(L.countItem(s, 'turnip'), 1);
  same(s.soil[5], { w: 0, c: null, d: 0 }, 'soil stays tilled after harvest');
});

test('growth stages progress for every crop', () => {
  C.CROP_KEYS.forEach((crop) => {
    const days = C.CROPS[crop].days;
    const stages = [];
    for (let d = 0; d <= days; d++) stages.push(L.cropStage({ c: crop, d, w: 0 }));
    assert.strictEqual(stages[0], 0);
    assert.strictEqual(stages[days], 3);
    stages.slice(1, -1).forEach((st) => assert.ok(st === 1 || st === 2));
    for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1]);
  });
});

test('watering can runs dry and refills', () => {
  const s = L.newState();
  for (let i = 0; i < C.CAN_CAPACITY; i++) {
    L.till(s, i);
    assert.strictEqual(L.water(s, i), 'ok');
  }
  L.till(s, 999);
  assert.strictEqual(L.water(s, 999), 'empty');
  L.refill(s);
  assert.strictEqual(L.water(s, 999), 'ok');
});

test('energy is spent and restored by sleeping', () => {
  const s = L.newState();
  assert.ok(L.spendEnergy(s, 99));
  assert.strictEqual(L.spendEnergy(s, 2), false);
  L.endDay(s);
  assert.strictEqual(s.energy, C.MAX_ENERGY);
  L.endDay(s, true);
  assert.strictEqual(s.energy, C.MAX_ENERGY / 2, 'passing out restores only half');
});

test('shipping pays out overnight', () => {
  const s = L.newState();
  L.addItem(s, 'turnip', 3);
  L.addItem(s, 'strawberry', 2);
  assert.strictEqual(L.ship(s, slotOf(s, 'hoe')), null, 'tools cannot be shipped');
  assert.strictEqual(L.ship(s, slotOf(s, 'turnip')).value, 180);
  L.ship(s, slotOf(s, 'strawberry'));
  assert.strictEqual(L.countItem(s, 'turnip'), 0);
  assert.strictEqual(L.boxValue(s), 180 + 2 * C.ITEMS.strawberry.sell);
  const gold = s.gold;
  const r = L.endDay(s);
  assert.strictEqual(r.earned, 180 + 2 * C.ITEMS.strawberry.sell);
  assert.strictEqual(s.gold, gold + r.earned);
  assert.strictEqual(s.box.length, 0);
  assert.strictEqual(s.day, 2);
  assert.strictEqual(s.time, C.DAY_START);
});

test('shop checks gold and bag space', () => {
  const s = L.newState();
  s.gold = 100;
  assert.strictEqual(L.buy(s, 'seed_potato', 5), 'gold');
  assert.strictEqual(L.buy(s, 'seed_potato', 2), 'ok');
  assert.strictEqual(s.gold, 20);
  assert.strictEqual(L.countItem(s, 'seed_potato'), 2);
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
  assert.strictEqual(L.formatTime(725), '12:00 PM');
  assert.strictEqual(L.formatTime(1439), '11:50 PM');
  assert.strictEqual(L.formatTime(1500), '1:00 AM');
});

test('save round-trips through JSON', () => {
  const s = L.newState();
  L.till(s, 300);
  L.plant(s, 300, slotOf(s, 'seed_turnip'));
  L.water(s, 300);
  L.till(s, 301);
  growToRipe(s, 300);
  L.addItem(s, 'potato', 4);
  L.ship(s, slotOf(s, 'potato'));
  s.player = { x: 100.4, y: 200.6, dir: 'left' };
  s.time = 800;
  s.sel = 2;
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
  same(back.soil, s.soil);
  same(back.inv, s.inv);
  same(back.box, s.box);
  same(back.player, { x: 100, y: 201, dir: 'left' });
  ['day', 'time', 'gold', 'energy', 'water', 'sel'].forEach((k) => assert.strictEqual(back[k], s[k], k));
});

test('worst-case save stays under 16 KB', () => {
  const s = L.newState();
  for (let idx = 0; idx < 38 * 24; idx++) { // every tile on the map planted
    L.till(s, idx);
    s.soil[idx] = { w: 1, c: 'strawberry', d: 6 };
  }
  s.inv = s.inv.map(() => ({ id: 'seed_strawberry', n: 99 }));
  C.CROP_KEYS.forEach((c) => s.box.push({ id: c, n: 9999 }));
  s.gold = 999999999;
  s.day = 999999;
  s.player = { x: 12345, y: 12345, dir: 'right' };
  s.animals = [];
  C.ANIMAL_KEYS.forEach((k) => { for (let i = 0; i < C.ANIMALS[k].max; i++) s.animals.push({ kind: k, name: 'Buttercup 99', love: 100, fed: 1, pet: 1, ready: 1 }); });
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, `save is ${size} bytes`);
});

test('bad or foreign save data is rejected or sanitised', () => {
  [null, undefined, 'x', 42, [], {}, { v: 99 }].forEach((bad) => assert.strictEqual(L.deserialize(bad), null));
  const s = L.deserialize({
    v: 1, d: -5, t: 'noon', g: 1e20, e: 500, w: -1, s: 77,
    i: [['hoe', 1], ['rocket', 3], ['turnip', 1000], 'junk'],
    b: [['hoe', 1], ['turnip', 2]],
    f: [[10, 1, 9, 3], [11, 0, 1, 99], 'junk', [-1, 0, 0, 0]],
    p: [1, 2],
  });
  assert.strictEqual(s.day, 1);
  assert.strictEqual(s.time, C.DAY_START);
  assert.strictEqual(s.energy, C.MAX_ENERGY);
  assert.strictEqual(s.water, 0);
  assert.strictEqual(s.sel, C.INV_SIZE - 1);
  same(s.inv.slice(0, 4), [{ id: 'hoe', n: 1 }, null, { id: 'turnip', n: 99 }, null]);
  same(s.box, [{ id: 'turnip', n: 2 }]);
  same(s.soil[10], { w: 1, c: null, d: 0 });
  same(s.soil[11], { w: 0, c: 'turnip', d: C.CROPS.turnip.days });
  assert.strictEqual(s.player.x, null);
});

test('a new game starts with one chicken and some feed', () => {
  const s = L.newState();
  assert.strictEqual(s.animals.length, 1);
  same(s.animals[0], { kind: 'chicken', name: 'Clucky', love: 0, fed: 0, pet: 0, ready: 0 });
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
  same(s.animals[0], { kind: 'cow', name: 'Daisy', love: C.LOVE.max, fed: 1, pet: 0, ready: 0 });
  assert.strictEqual(L.animalCount(s, 'chicken'), C.ANIMALS.chicken.max);
});
