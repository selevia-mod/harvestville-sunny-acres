// Unit tests for the Harvest Moon systems: weather, tools, debris, crops, animals, food, fishing, mine,
// villagers, buildings, festivals, marriage and the save format.
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
const realWeather = L.weather;
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, msg) => assert.deepStrictEqual(plain(a), plain(b), msg);
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const N = C.DAYS_PER_SEASON;
const FIELD = Array.from({ length: 224 }, (_, i) => 1000 + i);
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => {
  const s = L.newState();
  s.seed = 12345;
  return s;
};

// ---------- weather ----------
test('weather: day 1 and festival days are sunny; the rest follows the season odds', () => {
  const s = fresh();
  assert.strictEqual(realWeather(s, 1), 'sunny');
  const fest = C.FESTIVALS[0];
  const festDay = ['spring', 'summer', 'fall', 'winter'].indexOf(fest.season) * N + fest.day;
  assert.strictEqual(realWeather(s, festDay), 'sunny');
  const count = (from, to, kind) => {
    let n = 0;
    for (let y = 0; y < 40; y++) for (let d = from; d <= to; d++) if (realWeather(s, d + y * 4 * N) === kind) n++;
    return n / (40 * (to - from + 1));
  };
  assert.ok(Math.abs(count(2, N, 'rain') - 0.25) < 0.05, 'spring rain about 25%');
  assert.strictEqual(count(3 * N + 1, 4 * N, 'rain'), 0, 'no rain in winter');
  assert.ok(count(3 * N + 1, 4 * N, 'snow') > 0.25, 'snow in winter');
  assert.strictEqual(realWeather(s, 50), realWeather(s, 50), 'the forecast is fixed');
});

test('rain waters every tilled tile for the new day', () => {
  const s = fresh();
  L.till(s, 1);
  L.till(s, 2);
  L.weather = () => 'rain';
  const r = L.endDay(s);
  L.weather = () => 'sunny';
  assert.strictEqual(r.weather, 'rain');
  assert.strictEqual(s.soil[1].w, 1);
  assert.strictEqual(s.soil[2].w, 1);
});

// ---------- tools ----------
test('charged tools cover a line, a 3x3 patch, then 3x5', () => {
  same(L.chargeTiles(5, 5, 0, 1, 0), [[5, 5]]);
  same(L.chargeTiles(5, 5, 0, 1, 1), [[5, 5], [5, 6], [5, 7]]);
  const patch = L.chargeTiles(5, 5, 1, 0, 2);
  assert.strictEqual(patch.length, 9);
  assert.ok(patch.every(([x, y]) => x >= 5 && x <= 7 && y >= 4 && y <= 6));
  assert.strictEqual(L.chargeTiles(5, 5, 0, -1, 3).length, 15);
});

test('tool upgrades cost gold and ore, and make tools cheaper and the can bigger', () => {
  const s = fresh();
  assert.strictEqual(L.toolEnergy(s, 'hoe', 9), 18);
  s.gold = 10000;
  assert.strictEqual(L.upgradeTool(s, 'can'), 'ore');
  L.addItem(s, 'ore_copper', 5);
  assert.strictEqual(L.upgradeTool(s, 'can'), 'ok');
  assert.strictEqual(s.tools.can, 1);
  assert.strictEqual(L.canCapacity(s), C.TOOLS.can.capacity[1]);
  assert.strictEqual(s.water, L.canCapacity(s), 'the can comes back full');
  assert.strictEqual(L.countItem(s, 'ore_copper'), 0);
  assert.strictEqual(s.gold, 10000 - C.UPGRADES[0].gold);
  s.tools.hoe = 3;
  assert.strictEqual(L.upgradeTool(s, 'hoe'), 'max');
  assert.strictEqual(L.toolEnergy(s, 'hoe', 9), 9);
  assert.strictEqual(L.iconOf(s, 'hoe'), C.ICON.hoe_3);
  assert.strictEqual(L.itemName(s, 'hoe'), 'Gold Hoe');
});

// ---------- debris ----------
test('a new farm starts with debris on the field, and saves keep it', () => {
  const s = L.newState({ fieldTiles: FIELD });
  const kinds = Object.values(s.debris);
  assert.ok(kinds.length > 224 * 0.4 && kinds.length < 224 * 0.65, kinds.length + ' debris tiles');
  C.DEBRIS_KEYS.forEach((k) => assert.ok(kinds.includes(k), 'has ' + k));
  same(roundTrip(s).debris, s.debris);
});

test('debris needs the right tool, and pays out materials', () => {
  const s = fresh();
  s.debris = { 1: 'branch', 2: 'stump', 3: 'boulder', 4: 'weed', 5: 'stone' };
  assert.strictEqual(L.till(s, 1), 'debris');
  assert.strictEqual(L.debrisHits(s, 'branch', 'hammer'), -1);
  assert.strictEqual(L.debrisHits(s, 'stump', 'axe'), 3);
  assert.strictEqual(L.debrisHits(s, 'boulder', 'hammer'), 0, 'boulders need a copper hammer');
  s.tools.hammer = 1;
  assert.strictEqual(L.debrisHits(s, 'boulder', 'hammer'), 3);
  same(L.clearDebris(s, 2), { kind: 'stump', lumber: 4, stone: 0 });
  L.clearDebris(s, 1);
  L.clearDebris(s, 3);
  assert.strictEqual(s.lumber, 5);
  assert.strictEqual(s.stone, 4);
  assert.strictEqual(L.till(s, 1), 'ok');
});

test('weeds sprout on empty field at a new season and vanish in winter', () => {
  const s = fresh();
  s.day = N;
  const r = L.endDay(s, false, { fieldTiles: FIELD });
  assert.strictEqual(r.weeds, C.WEEDS_PER_SEASON);
  assert.strictEqual(Object.values(s.debris).filter((k) => k === 'weed').length, C.WEEDS_PER_SEASON);
  s.day = 3 * N;
  L.endDay(s, false, { fieldTiles: FIELD });
  assert.strictEqual(Object.values(s.debris).filter((k) => k === 'weed').length, 0);
});

// ---------- crops ----------
test('a seed bag plants the tilled tiles of a 3x3 patch', () => {
  const s = fresh();
  [1, 2, 3, 4].forEach((i) => L.till(s, i));
  s.soil[4].c = 'potato';
  const r = L.plantBag(s, [1, 2, 3, 4, 5, 6, 7, 8, 9], slotOf(s, 'seed_turnip'));
  assert.strictEqual(r, 3);
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 2);
  assert.strictEqual(s.soil[4].c, 'potato', 'planted tiles are left alone');
  assert.strictEqual(L.plantBag(s, [5, 6], slotOf(s, 'seed_turnip')), 'nospace');
  assert.strictEqual(L.countItem(s, 'seed_turnip'), 2, 'no bag used when nothing was planted');
});

test('strawberries, tomatoes and corn regrow; turnips do not', () => {
  const s = fresh();
  L.till(s, 1);
  L.till(s, 2);
  s.soil[1] = { w: 0, c: 'strawberry', d: 7 };
  s.soil[2] = { w: 0, c: 'turnip', d: 3 };
  assert.strictEqual(L.harvest(s, 1), 'strawberry');
  same(s.soil[1], { w: 0, c: 'strawberry', d: 4 });
  assert.strictEqual(L.harvest(s, 2), 'turnip');
  assert.strictEqual(s.soil[2].c, null);
});

test('grass is cut with the sickle into fodder and regrows', () => {
  const s = fresh();
  L.till(s, 1);
  s.soil[1] = { w: 0, c: 'grass', d: 4 };
  assert.strictEqual(L.harvest(s, 1), '!sickle');
  assert.strictEqual(L.cut(s, 1), 'fodder');
  assert.strictEqual(L.countItem(s, 'fodder'), 1);
  assert.strictEqual(s.soil[1].c, 'grass');
  assert.strictEqual(L.isRipe(s.soil[1]), false);
});

// ---------- animals ----------
test('happy animals give large produce; cows need the milker', () => {
  const s = fresh();
  s.gold = 1e6;
  L.buyAnimal(s, 'cow');
  s.animals.forEach((a) => { a.love = 70; a.fed = 1; });
  L.endDay(s);
  assert.strictEqual(L.collect(s, 0), 'egg_l');
  assert.strictEqual(L.collect(s, 1), '!milker');
  L.addItem(s, 'milker', 1);
  assert.strictEqual(L.collect(s, 1), 'milk_l');
});

test('brushing adds hearts once a day and needs a brush', () => {
  const s = fresh();
  assert.strictEqual(L.brushAnimal(s, 0), 'nobrush');
  L.addItem(s, 'brush', 1);
  assert.strictEqual(L.brushAnimal(s, 0), 'ok');
  assert.strictEqual(L.brushAnimal(s, 0), 'already');
  assert.strictEqual(s.animals[0].love, C.LOVE.brush);
  L.endDay(s);
  assert.strictEqual(L.brushAnimal(s, 0), 'ok');
});

test('an egg in the incubator hatches into a chick that grows up', () => {
  const s = fresh();
  L.addItem(s, 'egg', 2);
  assert.strictEqual(L.incubate(s, slotOf(s, 'hoe')), 'noegg');
  assert.strictEqual(L.incubate(s, slotOf(s, 'egg')), 'ok');
  assert.strictEqual(L.incubate(s, slotOf(s, 'egg')), 'busy');
  let r;
  for (let d = 0; d < C.INCUBATE_DAYS; d++) r = L.endDay(s);
  assert.strictEqual(s.animals.length, 2);
  same(r.born, [1]);
  const chick = s.animals[1];
  assert.strictEqual(chick.young, C.ANIMALS.chicken.grow);
  L.addItem(s, 'chicken_feed', 1);
  assert.strictEqual(L.feedAnimal(s, 1, slotOf(s, 'chicken_feed')), 'young');
  for (let d = 0; d < C.ANIMALS.chicken.grow; d++) L.endDay(s);
  assert.strictEqual(chick.young, 0);
  assert.ok(L.hearts(chick) === 0 || chick.love >= 0);
});

test('the coop has room for 4 chickens, 8 after the upgrade', () => {
  const s = fresh();
  s.gold = 1e6;
  while (L.buyAnimal(s, 'chicken') !== 'full');
  assert.strictEqual(L.animalCount(s, 'chicken'), 4);
  L.addItem(s, 'egg', 1);
  assert.strictEqual(L.incubate(s, slotOf(s, 'egg')), 'full');
  s.builds.coop2 = 1;
  assert.strictEqual(L.space(s, 'chicken'), 4);
});

test('a miracle potion brings a calf to a cow with 2+ hearts', () => {
  const s = fresh();
  s.gold = 1e6;
  const cow = L.buyAnimal(s, 'cow');
  L.addItem(s, 'miracle', 1);
  assert.strictEqual(L.givePotion(s, 0, slotOf(s, 'miracle')), 'notcow');
  assert.strictEqual(L.givePotion(s, cow, slotOf(s, 'miracle')), 'love');
  s.animals[cow].love = C.LOVE.potion;
  assert.strictEqual(L.givePotion(s, cow, slotOf(s, 'miracle')), 'ok');
  assert.strictEqual(L.space(s, 'cow'), 2, 'the calf is already counted');
  for (let d = 0; d < C.PREGNANT_DAYS; d++) L.endDay(s);
  const calf = s.animals[s.animals.length - 1];
  assert.strictEqual(calf.kind, 'cow');
  assert.strictEqual(calf.young, C.ANIMALS.cow.grow);
  assert.strictEqual(s.animals[cow].preg, 0);
});

test('the dog likes a daily pat', () => {
  const s = fresh();
  assert.strictEqual(L.petDog(s), 'ok');
  assert.strictEqual(L.petDog(s), 'already');
  L.endDay(s);
  L.endDay(s);
  assert.strictEqual(s.dog.love, C.LOVE.pet - 1);
});

// ---------- food ----------
test('eating restores energy, up to the maximum', () => {
  const s = fresh();
  L.addItem(s, 'pumpkin_pie', 1);
  L.addItem(s, 'turnip', 1);
  assert.strictEqual(L.eat(s, slotOf(s, 'turnip')), -1, 'already full');
  s.energy = 50;
  assert.strictEqual(L.eat(s, slotOf(s, 'pumpkin_pie')), 50);
  assert.strictEqual(s.energy, C.MAX_ENERGY);
  assert.strictEqual(L.eat(s, slotOf(s, 'hoe')), 0, 'tools are not food');
});

test('cooking needs a kitchen and the ingredients, and accepts any egg or milk', () => {
  const s = fresh();
  const pie = C.RECIPES.find((r) => r.dish === 'pumpkin_pie');
  L.addItem(s, 'pumpkin', 1);
  L.addItem(s, 'egg_l', 1);
  assert.strictEqual(L.cook(s, pie), 'nokitchen');
  s.builds.kitchen = 1;
  assert.strictEqual(L.cook(s, pie), 'missing');
  L.addItem(s, 'milk', 1);
  assert.ok(L.hasIngredients(s, pie));
  assert.strictEqual(L.cook(s, pie), 'ok');
  assert.strictEqual(L.countItem(s, 'pumpkin_pie'), 1);
  ['pumpkin', 'egg_l', 'milk'].forEach((id) => assert.strictEqual(L.countItem(s, id), 0, id + ' used'));
  // a recipe needing the same group twice needs two items
  assert.strictEqual(L.hasIngredients(s, { dish: 'x', needs: ['egg', 'egg'] }), false);
});

test('every recipe dish and ingredient exists', () => {
  C.RECIPES.forEach((r) => {
    assert.ok(C.ITEMS[r.dish] && C.ITEMS[r.dish].energy, r.dish);
    r.needs.forEach((n) => L.ingredientItems(n).forEach((id) => assert.ok(C.ITEMS[id], id)));
  });
});

// ---------- fishing, forage, mine ----------
test('fish sizes follow the water table', () => {
  const s = fresh();
  assert.strictEqual(L.catchFish(s, 'pond', 0.1), 'fish_s');
  assert.strictEqual(L.catchFish(s, 'pond', 0.99), 'fish_l');
  assert.strictEqual(L.catchFish(s, 'river', 0.99), 'fish_k');
  assert.strictEqual(L.countItem(s, 'fish_s'), 1);
});

test('forage spots are fixed for the day and can be picked once', () => {
  const s = fresh();
  const cand = Array.from({ length: 40 }, (_, i) => i);
  const a = L.forageSpots(s, 'town', cand), b = L.forageSpots(s, 'town', cand);
  same(a, b);
  assert.strictEqual(a.length, C.FORAGE_COUNT.town);
  assert.strictEqual(L.takeForage(s, 'town', a[0]), 'herb');
  same(L.forageTaken(s, 'town'), [a[0]]);
  same(roundTrip(s).forage.town.taken, [a[0]]);
  L.endDay(s);
  same(L.forageTaken(s, 'town'), [], 'new day, new forage');
  s.day = 2 * N + 1;
  assert.strictEqual(L.forageItem(s.day), 'mushroom');
});

test('mine floors have rocks and one ladder; deeper floors drop better ore', () => {
  const s = fresh();
  const tiles = Array.from({ length: 150 }, (_, i) => i);
  const f = L.mineFloor(s, 3, tiles);
  assert.ok(f.rocks.length > 30 && f.rocks.length < 70);
  assert.ok(f.rocks.includes(f.stairs));
  same(L.mineFloor(s, 3, tiles), f, 'the same floor on the same day');
  const drops = (floor) => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(L.mineDrop(floor, i / 1000));
    return seen;
  };
  assert.ok(!drops(1).has('ore_silver'));
  assert.ok(drops(4).has('ore_silver'));
  assert.ok(!drops(9).has('gem'));
  assert.ok(drops(10).has('gem'));
});

// ---------- villagers ----------
test('talking: an introduction first, then daily lines; friendship once a day', () => {
  const s = fresh();
  const first = L.talk(s, 'leo');
  assert.strictEqual(first.first, true);
  assert.strictEqual(first.line, C.DIALOGUE.leo.intro);
  assert.strictEqual(L.friend(s, 'leo').pts, C.FRIEND.talk);
  const again = L.talk(s, 'leo');
  assert.strictEqual(again.first, false);
  assert.strictEqual(L.friend(s, 'leo').pts, C.FRIEND.talk, 'only once a day');
  L.endDay(s);
  L.talk(s, 'leo');
  assert.strictEqual(L.friend(s, 'leo').pts, 2 * C.FRIEND.talk);
});

test('gifts: loved, liked, neutral and disliked; once a day; double on birthdays', () => {
  const s = fresh();
  L.addItem(s, 'strawberry', 3);
  L.addItem(s, 'fish_s', 1);
  let r = L.giveGift(s, 'lily', slotOf(s, 'strawberry'));
  assert.strictEqual(r.reaction, 'love');
  assert.strictEqual(L.friend(s, 'lily').pts, C.FRIEND.love);
  assert.strictEqual(L.giveGift(s, 'lily', slotOf(s, 'strawberry')).error, 'already');
  assert.strictEqual(L.giveGift(s, 'bram', slotOf(s, 'hoe')).error, 'nogift');
  r = L.giveGift(s, 'bram', slotOf(s, 'strawberry'));
  assert.strictEqual(r.reaction, 'dislike');
  assert.strictEqual(L.friend(s, 'bram').pts, 0, 'never below zero');
  s.day = N + 21; // Summer 21: Rosa's birthday
  assert.deepStrictEqual([...L.birthdaysOn(s.day)], ['rosa']);
  r = L.giveGift(s, 'rosa', slotOf(s, 'strawberry'));
  assert.strictEqual(r.pts, C.FRIEND.neutral * C.FRIEND.birthday);
  assert.strictEqual(r.line, C.DIALOGUE.rosa.birthday);
});

test('every villager has a schedule, dialogue for every tier, and real gift items', () => {
  C.VILLAGER_ORDER.forEach((k) => {
    const v = C.VILLAGERS[k], D = C.DIALOGUE[k];
    assert.ok(v.schedule.length && D.tiers.length === 4 && D.intro && D.rain && D.gift.love, k);
    v.loves.concat(v.likes, v.dislikes).forEach((id) => assert.ok(C.ITEMS[id], k + ': ' + id));
    if (v.candidate) assert.ok(D.propose && D.spouse.length, k + ' can be married');
  });
});

test('villagers follow their schedule, gather at festivals, and come home once married', () => {
  const s = fresh();
  assert.strictEqual(L.villagerAt(s, 'bram', 10 * 60), 'in:forge');
  assert.strictEqual(L.villagerAt(s, 'bram', 17 * 60 + 30), 'plaza_w');
  assert.strictEqual(L.villagerAt(s, 'lily', 10 * 60), 'away');
  s.time = 10 * 60;
  assert.ok(L.lilyAtStand(s));
  s.day = 14; // Spring 14: Flower Festival
  assert.strictEqual(L.villagerAt(s, 'bram', 12 * 60), 'fest_' + C.VILLAGER_ORDER.indexOf('bram'));
  assert.strictEqual(L.buildingOpen(s, 'forge'), false, 'shops close for festivals');
  s.day = 15;
  s.spouse = 'mira';
  assert.strictEqual(L.villagerAt(s, 'mira', 7 * 60), 'home');
  assert.strictEqual(L.villagerAt(s, 'mira', 11 * 60), 'in:woodshop');
});

// ---------- buildings ----------
test('the carpenter builds overnight with gold, lumber and stone', () => {
  const s = fresh();
  s.gold = 5000;
  assert.strictEqual(L.startBuild(s, 'kitchen'), 'lumber');
  assert.strictEqual(L.buyMaterial(s, 'lumber', C.BUILDS.kitchen.lumber), 'ok');
  assert.strictEqual(s.gold, 5000 - C.BUILDS.kitchen.lumber * C.LUMBER_PRICE);
  assert.strictEqual(L.startBuild(s, 'kitchen'), 'ok');
  assert.strictEqual(L.startBuild(s, 'coop2'), 'busy');
  same(roundTrip(s).project, s.project);
  const r = L.endDay(s);
  assert.strictEqual(r.built, 'kitchen');
  assert.strictEqual(s.builds.kitchen, 1);
  assert.strictEqual(L.startBuild(s, 'kitchen'), 'built');
  same(roundTrip(s).builds, { kitchen: 1 });
});

// ---------- festivals ----------
test('festivals: dance, judged harvest, cow contest; once a year', () => {
  const s = fresh();
  const flower = C.FESTIVALS.find((f) => f.key === 'flower');
  s.day = 14;
  s.time = 11 * 60;
  assert.strictEqual(L.festivalNow(s).key, 'flower');
  let r = L.joinFestival(s, flower, 'ivy');
  assert.ok(r.text.includes('Ivy'));
  assert.strictEqual(L.friend(s, 'ivy').pts, 10);
  assert.strictEqual(L.joinFestival(s, flower, 'ivy').error, 'joined');

  const harvest = C.FESTIVALS.find((f) => f.key === 'harvest');
  L.addItem(s, 'pumpkin', 1);
  L.addItem(s, 'turnip', 1);
  assert.strictEqual(L.joinFestival(s, harvest, slotOf(s, 'hoe')).error, 'nocrop');
  const gold = s.gold;
  r = L.joinFestival(s, harvest, slotOf(s, 'pumpkin'));
  assert.strictEqual(r.place, 1);
  assert.strictEqual(s.gold, gold + 1000);

  const cowfest = C.FESTIVALS.find((f) => f.key === 'cowfest');
  assert.strictEqual(L.joinFestival(s, cowfest).error, 'nocow');
  s.gold = 1e6;
  const i = L.buyAnimal(s, 'cow');
  s.animals[i].love = 85;
  r = L.joinFestival(s, cowfest);
  assert.strictEqual(r.place, 1);
  assert.ok(r.text.includes('Daisy'));
});

test('the calendar has every festival on a real date', () => {
  C.FESTIVALS.forEach((f) => {
    assert.ok(f.day >= 1 && f.day <= N, f.key);
    assert.ok(['spring', 'summer', 'fall', 'winter'].includes(f.season));
    const day = ['spring', 'summer', 'fall', 'winter'].indexOf(f.season) * N + f.day;
    assert.strictEqual(L.festivalOn(day).key, f.key);
  });
});

// ---------- marriage ----------
test('proposing needs a candidate, a bigger house, 8 hearts and the feather; the wedding follows', () => {
  const s = fresh();
  L.addItem(s, 'blue_feather', 1);
  const feather = () => slotOf(s, 'blue_feather');
  assert.strictEqual(L.propose(s, 'mira', slotOf(s, 'hoe')), 'nofeather');
  assert.strictEqual(L.propose(s, 'bram', feather()), 'notcandidate');
  assert.strictEqual(L.propose(s, 'mira', feather()), 'house');
  s.builds.bighouse = 1;
  assert.strictEqual(L.propose(s, 'mira', feather()), 'hearts');
  L.friend(s, 'mira').pts = C.FRIEND.marry;
  assert.strictEqual(L.propose(s, 'mira', feather()), 'yes');
  assert.strictEqual(L.countItem(s, 'blue_feather'), 0);
  same(roundTrip(s).engaged, s.engaged);
  let r;
  for (let d = 0; d < C.WEDDING_DELAY; d++) r = L.endDay(s);
  assert.strictEqual(r.wedding, 'mira');
  assert.strictEqual(s.spouse, 'mira');
  assert.strictEqual(roundTrip(s).spouse, 'mira');
  assert.strictEqual(L.proposeBlock(s, 'ivy'), 'taken');
  // spouse lunches every third day
  let lunches = 0;
  for (let d = 0; d < 6; d++) if (L.endDay(s).lunch) lunches++;
  assert.strictEqual(lunches, 2);
});

// ---------- save ----------
test('everything new survives a save, and the save stays under 16 KB in the worst case', () => {
  const s = L.newState({ fieldTiles: FIELD });
  s.tools = { hoe: 3, can: 2, axe: 1, hammer: 1, sickle: 0 };
  s.lumber = 999999;
  s.stone = 999999;
  C.VILLAGER_ORDER.forEach((k) => { s.friends[k] = { pts: 100, talked: 1, gifted: 1, met: 1, ev: 3 }; });
  s.builds = { kitchen: 1, bighouse: 1, coop2: 1, barn2: 1 };
  s.inc = 2;
  s.dog = { name: 'Biscuit', love: 50, pet: 1 };
  s.forage = { farm: { day: s.day, taken: [1, 2, 3] }, town: { day: s.day, taken: [4, 5, 6, 7, 8, 9] } };
  C.FESTIVALS.forEach((f) => { s.fest[f.key] = 99; });
  s.spouse = 'ivy';
  s.opts = { music: 0, sfx: 1 };
  s.map = 'town';
  s.animals = [];
  C.ANIMAL_KEYS.forEach((k) => { for (let i = 0; i < L.capacity(s, k); i++) s.animals.push({ kind: k, name: 'Buttercup 99', love: 100, fed: 1, pet: 1, ready: 2, brushed: 1, young: 3, preg: 5 }); });
  for (let i = 0; i < 24 * 38; i++) if (!s.debris[i]) s.soil[i] = { w: 1, c: 'pumpkin', d: 9 };
  s.inv = s.inv.map(() => ({ id: 'seed_strawberry', n: 99 }));
  const back = roundTrip(s);
  ['tools', 'lumber', 'stone', 'friends', 'builds', 'inc', 'dog', 'forage', 'fest', 'spouse', 'opts', 'map', 'animals', 'debris']
    .forEach((k) => same(back[k], s[k], k));
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, 'save is ' + size + ' bytes');
});

test('a save from before tools and the town gets the starter tools and keeps its farm', () => {
  const old = { v: 1, d: 30, t: 400, g: 900, e: 80, w: 10, s: 0, i: [['hoe', 1], ['can', 1], 0, 0], b: [], f: [[5, 1, 1, 2]], a: [[1, 30, 0, 0, 1, 'Daisy']] };
  const s = L.deserialize(old);
  ['axe', 'hammer', 'sickle', 'milker'].forEach((id) => assert.ok(L.hasItem(s, id), id));
  assert.strictEqual(s.map, 'farm');
  same(s.debris, {});
  assert.strictEqual(s.animals[0].kind, 'cow');
  assert.strictEqual(s.gold, 900);
  // the migration only happens once
  const again = roundTrip(s);
  assert.strictEqual(L.countItem(again, 'axe'), 1);
});

test('a farmer in the mine wakes up at the mine entrance in town', () => {
  const s = fresh();
  s.map = 'mine';
  s.player = { x: 100, y: 100, dir: 'up' };
  const back = roundTrip(s);
  assert.strictEqual(back.map, 'town');
  assert.strictEqual(back.player.x, null);
  assert.strictEqual(back.player.spawn, 'from_mine');
});
