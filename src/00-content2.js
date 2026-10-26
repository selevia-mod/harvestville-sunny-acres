// Content for the first-days goals, tips, the collection book, pets, furniture, the mine's treasure,
// fishing difficulty and festival mini-games. Text-heavy story content (letters, heart events) is in 00-story.js.
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- first-days goals (shown under the top bar, one at a time) ----------
  // event = what counts (see Logic.progress); target = where the pointer arrow leads:
  // { map, point } (a Tiled point), { map, object } (a Tiled object by name) or { map, x, y } (a tile).
  C.GOALS = [
    { event: 'clear', need: 3, text: 'Clear 3 weeds, branches or stones in your field', target: { map: 'farm', x: 8, y: 13 }, reward: { gold: 100 } },
    { event: 'till', need: 3, text: 'Till 3 tiles of cleared soil with the Hoe', target: { map: 'farm', x: 8, y: 13 }, reward: { item: 'starter', n: 1 } }, // 'starter': this season's starter seeds (STARTER_SEEDS)
    { event: 'plant', need: 1, text: 'Plant a seed bag on your tilled soil', target: { map: 'farm', x: 8, y: 13 }, reward: { gold: 50 } },
    { event: 'water', need: 3, text: 'Water your seeds: they grow faster', target: { map: 'farm', x: 8, y: 13 }, reward: { gold: 50 } },
    { event: 'feed', need: 1, text: 'Feed Clucky in the pen (hold the Chicken Feed)', target: { map: 'farm', object: 'animal_pen' }, reward: { item: 'chicken_feed', n: 3 } },
    { event: 'harvest', need: 1, text: 'Harvest your {crop}s when they are ripe (about 15 minutes)', target: { map: 'farm', x: 8, y: 13 }, reward: { gold: 200 } },
    { event: 'town', need: 1, text: 'Visit Willowbrook, down the road south', target: { map: 'town', point: 'plaza_n' }, reward: { gold: 100 } },
    { event: 'ship', need: 1, text: 'Sell something at the market stall in the town plaza', target: { map: 'town', object: 'farm_stand' }, reward: { gold: 100 } },
    { event: 'meet', need: 3, text: 'Say hello to 3 villagers in town', target: { map: 'town', point: 'plaza_c' }, reward: { gold: 200 } },
    { event: 'collect', need: 1, text: "Tomorrow: collect Clucky's egg in the pen", target: { map: 'farm', object: 'animal_pen' }, reward: { gold: 50 } },
  ];
  // How to get from one map toward another: the warp object to head for.
  C.ROUTES = {
    farm: { town: 'road_south', house: 'house_door', mine: 'road_south' },
    house: { farm: 'exit', town: 'exit', mine: 'exit' },
    town: { farm: 'road_north', house: 'road_north', mine: 'mine_door' },
    mine: { farm: 'exit', town: 'exit', house: 'exit' },
  };

  // ---------- tips: shown once, the first time you hold something ----------
  C.TIPS = [
    { key: 'hoe', text: 'HOE: tills cleared field soil. Seeds need tilled soil.' },
    { key: 'can', text: 'WATERING CAN: watered crops grow 25% faster. Refill it at the pond.' },
    { key: 'axe', text: 'AXE: chops branches (1 lumber) and stumps (4 lumber, several swings).' },
    { key: 'hammer', text: 'HAMMER: breaks stones and boulders for stone, and rocks in the mine.' },
    { key: 'sickle', text: 'SICKLE: cuts weeds, and cuts ripe grass into Fodder for cows.' },
    { key: 'seed', text: 'SEED BAG: plants the 3x3 tilled patch around the highlighted tile. Crops grow in real time; pick them before they wither!' },
    { key: 'feed', text: 'FEED: face an animal in the pen and tap to feed it. Once a day each.' },
    { key: 'rod', text: 'FISHING ROD: face water and tap. When the "!" pops up, keep the fish in the green bar.' },
    { key: 'brush', text: 'BRUSH: brush each animal once a day for extra hearts.' },
    { key: 'milker', text: 'MILKER: face a cow with a milk bubble to milk it.' },
    { key: 'food', text: 'FOOD: tap the action button with nothing in front of you to eat it and get energy back.' },
    { key: 'feather', text: 'BLUE FEATHER: show it to the one you love (8+ hearts, with the House Extension).' },
    { key: 'upgrade', text: 'UPGRADED TOOL: hold the action button to charge, then let go to work a bigger area.' },
  ];

  // ---------- the collection book: everything you can sell, catch, find or cook ----------
  C.COLLECTION = [
    'turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin',
    'egg', 'egg_l', 'milk', 'milk_l',
    'fish_s', 'fish_m', 'fish_l', 'fish_k',
    'herb', 'berry', 'mushroom', 'root',
    'ore_copper', 'ore_silver', 'ore_gold', 'gem',
    'boiled_egg', 'hot_milk', 'baked_potato', 'jam', 'tomato_soup', 'grilled_fish', 'veggie_stew', 'pumpkin_pie',
    'mushroom_soup', 'sandwich', 'hot_soup', 'tonic',
    'truffle', 'carabao_milk', // appended: saved as a bitset in this order
    // the crops added with real-time farming
    'radish', 'lettuce', 'peas', 'cabbage', 'cauliflower', 'onion', 'tulip', 'okra', 'chili', 'cucumber', 'bell_pepper',
    'eggplant', 'sunflower', 'melon', 'watermelon', 'spinach', 'bok_choy', 'beet', 'garlic', 'sweet_potato', 'cranberry',
    'rice', 'grapes', 'kale', 'celery', 'broccoli', 'leek', 'parsnip', 'red_cabbage', 'brussels', 'ginger', 'winter_squash', 'coffee',
  ];

  // ---------- pets ----------
  C.HORSE = { name: 'Chestnut', frame0: 15, speed: 1.7, reach: 0.9, height: 1.0 };
  C.CAT = { name: 'Mochi', frame0: 20, speed: 260, reach: 0.6, height: 0.4 };

  // ---------- furniture from Mira (bought outright; it appears in the farmhouse) ----------
  C.FURNITURE = {
    f_plant: { name: 'Big Plant', gold: 400, icon: 'big_plant', desc: 'A leafy plant for the corner.' },
    f_music: { name: 'Music Box', gold: 800, icon: 'music_box', desc: 'Plays a little tune. Lifts your spirits (+5 energy, once a day).' },
    f_aquarium: { name: 'Aquarium', gold: 1500, icon: 'aquarium', desc: 'A tank for your fish. Shows what you have caught.' },
    f_cat: { name: 'Cat Basket', gold: 600, icon: 'cat_basket', desc: 'A cosy basket... and a cat comes to live with you!' },
  };
  C.FURNITURE_KEYS = ['f_plant', 'f_music', 'f_aquarium', 'f_cat'];
  C.BUILDS.stable = { name: 'Stable', gold: 4000, lumber: 60, stone: 0, desc: 'A horse to ride: faster, and a saddlebag that reaches the market stall from anywhere.' };
  C.BUILD_KEYS.push('stable', 'f_plant', 'f_music', 'f_aquarium', 'f_cat'); // appended: older saves keep their order

  // ---------- the mine gets harder (and richer) the deeper you go ----------
  C.MINE.energyPer5 = 1; // extra energy per swing for every 5 floors
  C.MINE.chestEvery = 5; // a treasure chest on floors 5, 10, 15...
  C.MINE.chestGold = 300; // x floor / 5

  // ---------- fishing mini-game ----------
  // The fish darts up and down; hold the action button to lift the green bar and keep the fish in it.
  // speed = how fast it darts (bar heights per second); zone = height of the green bar (share of the track).
  C.FISH_GAME = {
    fish_s: { speed: 0.55, zone: 0.34 },
    fish_m: { speed: 0.8, zone: 0.3 },
    fish_l: { speed: 1.1, zone: 0.26 },
    fish_k: { speed: 1.5, zone: 0.22 },
    fill: 0.32, // catch meter gained per second while the fish is in the bar
    drain: 0.22, // lost per second while it is outside
    start: 0.3,
  };

  // ---------- festival mini-games ----------
  C.DANCE = { beats: 12, bpm: 96, window: 0.28 }; // tap on the beat; window = seconds either side that count
  C.DANCE_BONUS = 10; // up to this much extra friendship for a perfect dance

  // resolve icon names to sprite frames
  var frame = function (name) {
    var i = C.ICON_ORDER.indexOf(name);
    if (i < 0) throw new Error('Unknown icon "' + name + '"');
    return i;
  };
  Object.keys(C.FURNITURE).forEach(function (k) { C.FURNITURE[k].icon = frame(C.FURNITURE[k].icon); });
  C.GOALS.forEach(function (g) { if (g.reward.item && g.reward.item !== 'starter' && !C.ITEMS[g.reward.item]) throw new Error('bad goal reward ' + g.reward.item); });
})(window.Farm = window.Farm || {});
