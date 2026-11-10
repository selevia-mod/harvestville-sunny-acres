// Farm economy v2, part 1 (owner, 10-11 Nov 2026; docs/farm-economy-v2.md section 1): no more seasons for planting,
// and 8 new crops. Loaded last of the content files, so the new crops, seeds and icons go at the very end of their
// lists (crop and icon numbers are saved: C.CROP_KEYS, C.ICON_ORDER and the crops sheet's frames are append-only).
// Rules in 01-logicZZZZZZZZZZZZZ-economy.js.
// - Every crop and fruit tree grows all year ("There will no more season plants, everything can be plant now"): each
//   crop's and tree's seasons become all four, so every check of a season (L.cropInSeason, L.treeInSeason, the
//   greenhouse's planting, the requests, the crates) says yes. Seasons still change the look of the land, the
//   festivals and the weather.
// - Saffron's "Rare" goods were crops sold out of their season: nothing is out of season now, so she has none (her
//   Rare tab goes; what players bought from her stays theirs).
// - The Greenhouse keeps its worth: crops planted in it grow 25% faster (C.GREENHOUSE.faster), on top of watering
//   itself and keeping weeds out.
// - 8 new crops on the price ladder of the others (seed price, what one sells for, by growing time) and with the
//   energy of the crops that take as long. They are not the hunting places' drops: the Sierra Unggoy's Wild Bananas
//   (banana_wild) and Banaue's Heirloom Rice (heirloom_rice) stay their own items (owner, 11 Nov 2026).
// PICTURES: until the owner's art (art-src/FARM-ECONOMY-V2-PROMPTS.md) arrives, their plants, crop icons and seed
// packets are drawn stand-ins from plant/shape/colour below (tools/art/crops2.js, painted in by
// tools/art/crops-fill.js and tools/art/icons-fill.js). The real pictures go in with tools/art/economy-import.js:
// art-src/crops/<key>.png (2 frames, 1536x1024) and art-src/icons/economy-1.png / economy-2.png (4x4 grids).
(function (F) {
  'use strict';
  var C = F.Config;
  var ALL = C.SEASONS.map(function (x) { return x.key; });

  // ---------- no more seasons ----------
  // (crops added after this file would be all-year too: 01-logicZZZZZZZZZZZZZ-economy.js makes L.cropInSeason say yes)
  var allYear = function () { Object.keys(C.CROPS).forEach(function (k) { C.CROPS[k].seasons = ALL.slice(); }); };
  allYear();
  Object.keys(C.FRUIT_TREES || {}).forEach(function (k) { C.FRUIT_TREES[k].seasons = ALL.slice(); }); // (each keeps its hours)
  // a seed's description began with its seasons ("Spring. Plants 3x3...", "Spring, summer and fall. Plants 3x3...")
  var SEASON_WORDS = /^(?:(?:spring|summer|fall|winter)(?:, | and |,? and )?)+\.\s*/i;
  Object.keys(C.ITEMS).forEach(function (id) {
    var it = C.ITEMS[id];
    if (it.kind === 'seed' && typeof it.desc === 'string') it.desc = it.desc.replace(SEASON_WORDS, '');
  });
  // Saffron: her rare goods were out-of-season crops and seeds; there are none now
  if (C.TRADER) C.TRADER.rare = [];
  // the greenhouse: crops planted inside grow this much faster (on top of watering themselves)
  if (C.GREENHOUSE) C.GREENHOUSE.faster = 0.25;
  // older What's new lines that spoke of seasons say what is true now (same icon, title and tour)
  var NOW = {
    'The Greenhouse': 'Buy one from Mira (Outdoor, More land). Crops inside grow 25% faster, it waters itself, and no weeds come in.',
    'Rare goods at Saffron': 'Saffron sold tomato, onion and ginger out of their season. Every crop grows all year now, so she no longer needs to.',
  };
  (C.NEWS || []).forEach(function (n) { n.lines.forEach(function (ln) { if (NOW[ln[1]]) ln[2] = NOW[ln[1]]; }); });

  // ---------- 8 new crops ----------
  // The same ladder as every other crop (and the players' seeds of 5 Nov 2026): grow time -> [seed price, sell price],
  // and the energy one gives, like the crops that take as long (peas 7, potato 8, cauliflower 8, onion 10).
  var LADDER = { 240: [50, 12], 360: [55, 14], 720: [75, 18], 1440: [100, 25] };
  var ENERGY = { 240: 7, 360: 8, 720: 8, 1440: 10 };
  var when = function (m) { return m < 60 ? m + ' minutes' : m < 1440 ? m / 60 + (m === 60 ? ' hour' : ' hours') : m / 1440 + (m === 1440 ? ' day' : ' days'); };
  var CROPS = [
    // key, name, minutes, plant, shape, colour, colour 2 (the stand-in's look: tools/art/crops2.js), what it is
    ['banana', 'Saba Banana', 720, 'stalk', 'long', '#e8d44a', '#8ab83a', 'A bunch of plump saba bananas from your field.'],
    ['oats', 'Oats', 360, 'stalk', 'grain', '#ecd9a0', '#a8884a', 'A sack of golden oats.'],
    ['peanut', 'Peanut', 240, 'bush', 'pod', '#e2c48e', '#b08850', 'A handful of peanuts in their shells (mani).'],
    ['cassava', 'Cassava', 1440, 'root', 'long', '#9a6a3a', '#5a3a1a', 'A thick cassava root (kamoteng kahoy).'],
    ['taro', 'Taro', 720, 'root', 'round', '#8a6a5a', '#5fa84a', 'A round taro corm (gabi).'],
    ['mung_bean', 'Mung Bean', 240, 'bush', 'berry', '#6ab04a', '#2f6f2a', 'A pile of little green mung beans (monggo).'],
    ['pineapple', 'Pineapple', 1440, 'ground', 'round', '#f2b632', '#5fa84a', 'A ripe golden pineapple (pinya).'],
    ['bitter_gourd', 'Bitter Gourd', 360, 'vine', 'long', '#4f9f3a', '#8fcf5a', 'A long bumpy bitter gourd (ampalaya).'],
  ];
  var ITEMS = {}, SEEDS = {};
  CROPS.forEach(function (c) {
    var key = c[0], mins = c[2], price = LADDER[mins];
    if (C.CROPS[key] || C.ITEMS[key]) throw new Error('economy: ' + key + ' is taken');
    ITEMS[key] = { name: c[1], kind: 'crop', sell: price[1], energy: ENERGY[mins], desc: c[7] };
    SEEDS['seed_' + key] = { name: c[1] + ' Seeds', kind: 'seed', crop: key, price: price[0], desc: 'Plants 3x3. Ready in ' + when(mins) + '.' };
    C.CROPS[key] = { mins: mins, item: key, art: C.CROP_KEYS.length, seasons: ALL.slice(), plant: c[3], shape: c[4], color: c[5], color2: c[6] };
    C.CROP_KEYS.push(key);
    C.SHOP_STOCK.push('seed_' + key);
  });
  C.CROP_WITHERED = 2 + C.CROP_KEYS.length * 2; // (after every crop's two frames: tools/art/crops-fill.js moves it)
  C.ECON_CROPS = CROPS.map(function (c) { return c[0]; });

  // appended: icon numbers are saved, so the sheet only grows at its end (the 8 crops, then their 8 seeds)
  C.ECON_ICONS = Object.keys(ITEMS).concat(Object.keys(SEEDS));
  [ITEMS, SEEDS].forEach(function (set) {
    Object.keys(set).forEach(function (id) {
      if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id);
      C.ICON[id] = C.ICON_ORDER.indexOf(id);
      set[id].icon = C.ICON[id];
      C.ITEMS[id] = set[id];
    });
  });
})(window.Farm = window.Farm || {});
