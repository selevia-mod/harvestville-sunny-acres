// Phase 3, more to do: 10 daily quests, weekly goals, monthly goals, a 7-day login gift, achievements (these
// follow the phone's calendar), villagers' requests (on the notice board, and in person) with a streak bonus
// (these follow the game's days), the travelling trader on Market Street, and the new goods: the Power-Up,
// the Pet Meal and Stars.
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- new goods ----------
  ['power_up', 'pet_meal'].forEach(function (n) { C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.ITEMS.power_up = { name: 'Power-Up', icon: C.ICON.power_up, kind: 'boost', desc: 'Drink it: full energy, and your tools cost no energy for 2 hours.' };
  C.ITEMS.pet_meal = { name: 'Pet Meal', icon: C.ICON.pet_meal, kind: 'petfood', desc: 'A feast for your dog, cat or horse. They love you much more.' };
  C.POWER_UP = { minutes: 120 };
  C.PET_MEAL_LOVE = 20;

  // What gets counted (quests compare these with where they were when the quest began). The first three come from
  // the game's records (Logic stats), the rest are counted as you play.
  C.COUNTERS = ['earned', 'fish', 'cooked', 'harvest', 'water', 'till', 'plant', 'gift', 'talk', 'collect', 'care', 'clear',
    'order', 'floor', 'forage', 'request', 'dquest', 'pet', 'decor', 'trade', 'login', 'wchest'];

  // ---------- daily quests (10 a day: 5 easy, 2 medium, 3 hard with the best prizes) ----------
  // c = counter, n = how many, season: false = not in winter (needs crops). reward: { gold, stars, item, n }
  var Q = C.QUESTS = {
    easy: [
      { c: 'water', n: 15, text: 'Water {n} tiles', reward: { gold: 150 }, season: false },
      { c: 'talk', n: 5, text: 'Talk to {n} villagers', reward: { gold: 150 } },
      { c: 'harvest', n: 10, text: 'Harvest {n} crops', reward: { gold: 200 }, season: false },
      { c: 'care', n: 4, text: 'Pet, brush or feed your animals {n} times', reward: { gold: 150 } },
      { c: 'collect', n: 3, text: 'Collect {n} eggs or milk', reward: { gold: 150 } },
      { c: 'forage', n: 3, text: 'Forage {n} wild things', reward: { gold: 150 } },
      { c: 'clear', n: 5, text: 'Clear {n} weeds, branches or stones', reward: { gold: 150 } },
      { c: 'fish', n: 2, text: 'Catch {n} fish', reward: { gold: 200 } },
      { c: 'gift', n: 2, text: 'Give {n} gifts', reward: { gold: 150 } },
      { c: 'earned', n: 500, text: 'Earn {n}G selling', reward: { gold: 150 } },
      { c: 'plant', n: 9, text: 'Plant {n} seeds', reward: { gold: 150 }, season: false },
      { c: 'pet', n: 1, text: 'Pet your dog, cat or horse', reward: { gold: 100 } },
    ],
    medium: [
      { c: 'harvest', n: 30, text: 'Harvest {n} crops', reward: { gold: 500 }, season: false },
      { c: 'fish', n: 5, text: 'Catch {n} fish', reward: { item: 'treat', n: 2 } },
      { c: 'cooked', n: 3, text: 'Cook {n} dishes', reward: { gold: 400 } },
      { c: 'earned', n: 2000, text: 'Earn {n}G selling', reward: { gold: 500 } },
      { c: 'floor', n: 5, text: 'Go down {n} floors in the mine', reward: { item: 'bouquet', n: 1 } },
      { c: 'order', n: 1, text: 'Deliver an order from the order board', reward: { gold: 400 } },
      { c: 'request', n: 2, text: 'Finish {n} villager requests', reward: { gold: 500 } },
      { c: 'gift', n: 4, text: 'Give {n} gifts', reward: { item: 'cake', n: 1 } },
    ],
    // one of each prize, every day
    hard: [
      { prize: 'power_up', list: [
        { c: 'fish', n: 10, text: 'Catch {n} fish' },
        { c: 'cooked', n: 6, text: 'Cook {n} dishes' },
        { c: 'order', n: 3, text: 'Deliver {n} orders' },
        { c: 'floor', n: 12, text: 'Go down {n} floors in the mine' }] },
      { prize: 'star', list: [
        { c: 'harvest', n: 60, text: 'Harvest {n} crops', season: false },
        { c: 'earned', n: 6000, text: 'Earn {n}G selling' },
        { c: 'request', n: 4, text: 'Finish {n} villager requests' },
        { c: 'gift', n: 8, text: 'Give {n} gifts' }] },
      { prize: 'pet_meal', list: [
        { c: 'care', n: 15, text: 'Pet, brush or feed your animals {n} times' },
        { c: 'talk', n: 15, text: 'Talk to {n} villagers' },
        { c: 'forage', n: 10, text: 'Forage {n} wild things' },
        { c: 'clear', n: 25, text: 'Clear {n} weeds, branches or stones' }] },
    ],
    all: { stars: 1, gold: 1000 }, // finishing all 10 in a day
  };
  Q.prizes = { power_up: { item: 'power_up', n: 1 }, star: { stars: 1 }, pet_meal: { item: 'pet_meal', n: 1 } };

  // ---------- weekly goals (Monday to Sunday) ----------
  C.WEEKLY = {
    goals: [
      { c: 'harvest', n: 150, text: 'Harvest {n} crops', reward: { gold: 1000 }, season: false },
      { c: 'fish', n: 25, text: 'Catch {n} fish', reward: { gold: 1000 } },
      { c: 'earned', n: 25000, text: 'Earn {n}G selling', reward: { gold: 1500 } },
      { c: 'request', n: 10, text: 'Finish {n} villager requests', reward: { gold: 1000 } },
      { c: 'dquest', n: 30, text: 'Finish {n} daily quests', reward: { stars: 1 } },
      { c: 'cooked', n: 15, text: 'Cook {n} dishes', reward: { gold: 1000 } },
      { c: 'care', n: 50, text: 'Care for your animals {n} times', reward: { gold: 1000 } },
    ],
    count: 5,
    chest: { stars: 3, gold: 3000, item: 'power_up', n: 1 }, // all 5 done
  };

  // ---------- monthly goals (the phone's calendar month) ----------
  C.MONTHLY = {
    names: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    goals: [
      { c: 'dquest', n: 10, text: 'Finish {n} daily quests', reward: { stars: 2 } },
      { c: 'login', n: 12, text: 'Play on {n} different days', reward: { stars: 2 } },
      { c: 'wchest', n: 2, text: 'Open {n} weekly chests', reward: { stars: 3 } },
    ],
    chest: { stars: 5, gold: 10000, item: 'pet_meal', n: 3 },
  };

  // ---------- the login gift: a 7-day cycle (missing a day starts it again) ----------
  C.LOGIN = [{ gold: 200 }, { item: 'pet_meal', n: 1 }, { gold: 500 }, { item: 'power_up', n: 1 }, { gold: 1000 }, { item: 'treat', n: 3 }, { stars: 2 }];

  // ---------- achievements ----------
  // test: [what, how many] (counter, 'friends5', 'home', 'beauty', 'married', 'animals', 'deepest', 'stars') ; stars = reward
  C.ACHIEVEMENTS = [
    { key: 'first_coins', name: 'First Coins', desc: 'Earn 1,000G selling.', test: ['earned', 1000], stars: 1 },
    { key: 'merchant', name: 'Merchant', desc: 'Earn 50,000G selling.', test: ['earned', 50000], stars: 2 },
    { key: 'tycoon', name: 'Tycoon', desc: 'Earn 500,000G selling.', test: ['earned', 500000], stars: 5 },
    { key: 'green_thumb', name: 'Green Thumb', desc: 'Harvest 100 crops.', test: ['harvest', 100], stars: 1 },
    { key: 'master_farmer', name: 'Master Farmer', desc: 'Harvest 2,000 crops.', test: ['harvest', 2000], stars: 3 },
    { key: 'angler', name: 'Angler', desc: 'Catch 50 fish.', test: ['fish', 50], stars: 1 },
    { key: 'fish_king', name: 'Fish King', desc: 'Catch 500 fish.', test: ['fish', 500], stars: 3 },
    { key: 'chef', name: 'Home Chef', desc: 'Cook 50 dishes.', test: ['cooked', 50], stars: 2 },
    { key: 'miner', name: 'Deep Digger', desc: 'Reach floor 30 of the mine.', test: ['deepest', 30], stars: 2 },
    { key: 'good_neighbour', name: 'Good Neighbour', desc: 'Finish 50 villager requests.', test: ['request', 50], stars: 2 },
    { key: 'quest_hero', name: 'Quest Hero', desc: 'Finish 200 daily quests.', test: ['dquest', 200], stars: 3 },
    { key: 'popular', name: 'Popular', desc: 'Reach 5 hearts with 10 villagers.', test: ['friends5', 10], stars: 2 },
    { key: 'beloved', name: 'Beloved', desc: 'Reach 5 hearts with every villager.', test: ['friends5', 23], stars: 5 },
    { key: 'wedding_bells', name: 'Wedding Bells', desc: 'Get married.', test: ['married', 1], stars: 3 },
    { key: 'rancher', name: 'Rancher', desc: 'Keep 10 animals.', test: ['animals', 10], stars: 2 },
    { key: 'manor_lord', name: 'Grand Home', desc: 'Upgrade your house to a Manor (Lv 6).', test: ['home', 6], stars: 3 },
    { key: 'mansion', name: 'Mansion', desc: 'Upgrade your house to a Mansion (Lv 10).', test: ['home', 10], stars: 5 },
    { key: 'dreamy', name: 'Dreamy Home', desc: 'Reach Home Beauty 750.', test: ['beauty', 750], stars: 3 },
    { key: 'landscaper', name: 'Landscaper', desc: 'Place 100 pieces in your yard.', test: ['decor', 100], stars: 2 },
    { key: 'trader', name: 'Haggler', desc: 'Make 20 trades with the travelling trader.', test: ['trade', 20], stars: 2 },
  ];

  // ---------- villagers' requests (each game day) ----------
  C.REQUESTS = {
    board: 3, // on the notice board each morning
    person: 1, // one villager asks you in person (a "!" over them)
    pts: { board: 8, person: 12 }, // friendship for finishing one
    pay: 1.6, // times what the items would sell for
    streakStep: 0.1, // +10% gold for each day in a row with a request finished...
    streakMax: 0.5, // ...up to +50%
  };

  // ---------- the travelling trader (Market Street, 3 days a week) ----------
  C.TRADER = {
    key: 'trader', name: 'Saffron', look: 'Saffron, a cheerful travelling trader woman with a big orange turban, gold hoop earrings, a purple embroidered coat and baggy brown trousers',
    days: [2, 4, 6], open: [9 * 60, 17 * 60],
    buys: ['ore_copper', 'ore_silver', 'ore_gold', 'gem', 'fish_s', 'fish_m', 'fish_l', 'fish_k', 'truffle'],
    wanted: 3, // today's wanted goods pay the most...
    wantedPay: 1.8,
    pay: 1.3, // ...the rest a little over the stall price
    perDay: 10, // she buys up to this many of each, each visit
    // swaps: give [[item or 'stars', n]...], get { item, n } or { stars } or { furniture } / { yard } (a festival piece of any season)
    swaps: [
      { give: [['gem', 5]], get: { stars: 1 } },
      { give: [['stars', 2]], get: { item: 'power_up', n: 1 } },
      { give: [['fish_m', 3]], get: { item: 'pet_meal', n: 1 } },
      { give: [['ore_gold', 3]], get: { item: 'miracle', n: 1 } },
      { give: [['fish_k', 1], ['gem', 2]], get: { item: 'blue_feather', n: 1 } },
      { give: [['fish_l', 4]], get: { item: 'treat', n: 5 } },
      { give: [['stars', 3]], get: { furniture: 1 } },
      { give: [['stars', 3]], get: { yard: 1 } },
    ],
  };
})(window.Farm = window.Farm || {});
