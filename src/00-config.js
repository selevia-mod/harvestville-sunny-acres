// Game constants and content tables. Everything balance-related lives here.
// Icons are given by name; the names index ICON_ORDER, which is also the order of the items sprite sheet
// (tools/make-art.js reads this list), and are turned into frame numbers at the bottom of this file.
(function (F) {
  'use strict';

  var ICON_ORDER = [
    'hoe', 'can', 'seed_turnip', 'seed_potato', 'seed_strawberry', 'turnip', 'potato', 'strawberry',
    'coin', 'bolt', 'bag', 'moon', 'drop', 'sparkle', 'crate', 'tag',
    'egg', 'milk', 'chicken_feed', 'fodder', 'heart', 'chicken', 'cow', 'bubble',
    'seed_tomato', 'seed_corn', 'seed_carrot', 'seed_pumpkin', 'tomato', 'corn', 'carrot', 'pumpkin',
    'spring', 'summer', 'fall', 'winter',
    'hoe_1', 'hoe_2', 'hoe_3', 'can_1', 'can_2', 'can_3', 'axe', 'axe_1', 'axe_2', 'axe_3',
    'hammer', 'hammer_1', 'hammer_2', 'hammer_3', 'sickle', 'sickle_1', 'sickle_2', 'sickle_3',
    'brush', 'milker', 'rod', 'lumber', 'stone', 'ore_copper', 'ore_silver', 'ore_gold', 'gem',
    'fish_s', 'fish_m', 'fish_l', 'fish_k', 'herb', 'berry', 'mushroom', 'root',
    'boiled_egg', 'hot_milk', 'baked_potato', 'jam', 'tomato_soup', 'grilled_fish', 'veggie_stew', 'pumpkin_pie',
    'mushroom_soup', 'sandwich', 'hot_soup', 'tonic', 'egg_l', 'milk_l', 'seed_grass', 'blue_feather', 'miracle',
    'rain', 'storm', 'snow', 'ribbon', 'bobber', 'exclaim', 'gift', 'calendar', 'note', 'dog', 'ring', 'lunch',
    'letter', 'book', 'horse', 'cat', 'chest', 'star', 'aquarium', 'music_box', 'big_plant', 'cat_basket',
    'pig', 'carabao', 'truffle', 'carabao_milk',
    // the 33 crops added with real-time farming: seeds, then the crop
    'seed_radish', 'radish', 'seed_lettuce', 'lettuce', 'seed_peas', 'peas', 'seed_cabbage', 'cabbage',
    'seed_cauliflower', 'cauliflower', 'seed_onion', 'onion', 'seed_tulip', 'tulip', 'seed_okra', 'okra',
    'seed_chili', 'chili', 'seed_cucumber', 'cucumber', 'seed_bell_pepper', 'bell_pepper', 'seed_eggplant', 'eggplant',
    'seed_sunflower', 'sunflower', 'seed_melon', 'melon', 'seed_watermelon', 'watermelon', 'seed_spinach', 'spinach',
    'seed_bok_choy', 'bok_choy', 'seed_beet', 'beet', 'seed_garlic', 'garlic', 'seed_sweet_potato', 'sweet_potato',
    'seed_cranberry', 'cranberry', 'seed_rice', 'rice', 'seed_grapes', 'grapes', 'seed_kale', 'kale',
    'seed_celery', 'celery', 'seed_broccoli', 'broccoli', 'seed_leek', 'leek', 'seed_parsnip', 'parsnip',
    'seed_red_cabbage', 'red_cabbage', 'seed_brussels', 'brussels', 'seed_ginger', 'ginger', 'seed_winter_squash', 'winter_squash',
    'seed_coffee', 'coffee',
  ];

  // Villagers in the order of the people sprite sheet (tools/make-art.js reads this list too).
  var VILLAGER_ORDER = ['lily', 'hollis', 'bram', 'mira', 'rosa', 'leo', 'ivy'];

  var C = F.Config = {
    WIDTH: 360,
    HEIGHT: 640,
    TILE: 256, // world units per tile = pixels per tile in the art
    VIEW_TILE: 32, // on-screen size of one tile, in layout px (WIDTH x HEIGHT space)
    SPEED: 1152, // world units per second (4.5 tiles/s)

    DAY_START: 6 * 60, // 6:00 AM, minutes after midnight
    PASS_OUT: 26 * 60, // 2:00 AM the next morning
    NIGHT_START: 17 * 60,
    NIGHT_FULL: 20 * 60,
    MS_PER_MINUTE: 500, // (old game clock; time now follows the phone's clock)
    ENERGY_EVERY: 3, // real minutes per energy point coming back by itself
    GROW: { boost: 0.25, wither: 1, witherMin: 240 }, // watering takes 25% off the growing time; a ripe crop withers after as long again as it grew (at least 4 hours)
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    SEASON_OF_MONTH: [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3], // Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov, Winter Dec-Feb
    SHOP_OPEN: 7 * 60, // real clock times: open early to late, so people can play after work
    SHOP_CLOSE: 23 * 60,

    DAYS_PER_SEASON: 28,
    // icon also used for the falling petals / leaves / snow
    SEASONS: [
      { key: 'spring', name: 'Spring', icon: 'spring', particles: { scale: [0.07, 0.11], every: 650, fall: [25, 50] } },
      { key: 'summer', name: 'Summer', icon: 'summer', particles: null },
      { key: 'fall', name: 'Fall', icon: 'fall', particles: { scale: [0.09, 0.14], every: 550, fall: [30, 60] } },
      { key: 'winter', name: 'Winter', icon: 'winter', particles: { scale: [0.05, 0.1], every: 160, fall: [28, 55] } },
    ],

    // Weather is rolled from the farm's seed and the day, so tomorrow's forecast is already known.
    WEATHER: {
      sunny: { name: 'Sunny', icon: 'summer' },
      rain: { name: 'Rain', icon: 'rain', waters: true },
      storm: { name: 'Storm', icon: 'storm', waters: true },
      snow: { name: 'Snow', icon: 'snow' },
    },
    WEATHER_ODDS: { // chance of each non-sunny weather, per season
      spring: { rain: 0.25 },
      summer: { rain: 0.14, storm: 0.08 },
      fall: { rain: 0.22 },
      winter: { snow: 0.35 },
    },

    MAX_ENERGY: 100,
    START_GOLD: 300,
    INV_SIZE: 18,
    HOTBAR: 6,
    MAX_STACK: 99,

    // ---------- tools ----------
    TOOL_LEVELS: ['Basic', 'Copper', 'Silver', 'Gold'],
    TOOLS: {
      hoe: { energy: 2, area: true },
      can: { energy: 2, area: true, capacity: [20, 30, 45, 60] },
      axe: { energy: 3, area: true },
      hammer: { energy: 3, area: true },
      sickle: { energy: 1, area: true },
    },
    TOOL_KEYS: ['hoe', 'can', 'axe', 'hammer', 'sickle'], // stable order, used by the save format
    TOOL_ENERGY_SCALE: [1, 0.8, 0.65, 0.5], // energy per tile at each tool level
    CHARGE_MS: 450, // hold the action button this long per charge level
    UPGRADES: [ // cost to reach level 1, 2, 3 at the forge
      { gold: 1000, ore: 'ore_copper', n: 5 },
      { gold: 2500, ore: 'ore_silver', n: 5 },
      { gold: 5000, ore: 'ore_gold', n: 5 },
    ],

    // ---------- field debris ----------
    // hits[level] = swings needed with that tool level (0 = can't break it yet)
    DEBRIS: {
      weed: { tool: 'sickle', hits: [1, 1, 1, 1], walk: true },
      branch: { tool: 'axe', hits: [1, 1, 1, 1], lumber: 1 },
      stone: { tool: 'hammer', hits: [1, 1, 1, 1], stone: 1 },
      stump: { tool: 'axe', hits: [3, 2, 1, 1], lumber: 4 },
      boulder: { tool: 'hammer', hits: [0, 3, 2, 1], stone: 4 },
    },
    DEBRIS_KEYS: ['weed', 'branch', 'stone', 'stump', 'boulder'], // stable order, used by the save format
    DEBRIS_START: { weed: 0.26, branch: 0.11, stone: 0.11, stump: 0.04, boulder: 0.02 }, // share of field tiles
    WEEDS_PER_SEASON: 12,

    // icon = sprite name; frames are filled in below
    ITEMS: {
      hoe: { name: 'Hoe', icon: 'hoe', kind: 'tool', tool: 'hoe', desc: 'Till the field so you can plant.' },
      can: { name: 'Watering Can', icon: 'can', kind: 'tool', tool: 'can', desc: 'Water tilled soil daily. Refill it at the pond.' },
      axe: { name: 'Axe', icon: 'axe', kind: 'tool', tool: 'axe', desc: 'Chop branches and stumps into lumber.' },
      hammer: { name: 'Hammer', icon: 'hammer', kind: 'tool', tool: 'hammer', desc: 'Break stones, boulders and mine rocks.' },
      sickle: { name: 'Sickle', icon: 'sickle', kind: 'tool', tool: 'sickle', desc: 'Cut weeds, and cut grass into fodder.' },
      brush: { name: 'Brush', icon: 'brush', kind: 'tool', price: 100, desc: 'Brush an animal once a day for extra hearts.' },
      milker: { name: 'Milker', icon: 'milker', kind: 'tool', price: 200, desc: 'Needed to milk your cows.' },
      rod: { name: 'Fishing Rod', icon: 'rod', kind: 'tool', price: 400, desc: 'Cast into water, then tap when a fish bites.' },

      seed_turnip: { name: 'Turnip Seeds', icon: 'seed_turnip', kind: 'seed', crop: 'turnip', price: 20, desc: 'Spring. Plants 3x3. Ready in 15 minutes.' },
      seed_radish: { name: 'Radish Seeds', icon: 'seed_radish', kind: 'seed', crop: 'radish', price: 25, desc: 'Spring. Plants 3x3. Ready in 30 minutes.' },
      seed_lettuce: { name: 'Lettuce Seeds', icon: 'seed_lettuce', kind: 'seed', crop: 'lettuce', price: 30, desc: 'Spring. Plants 3x3. Ready in 1 hour.' },
      seed_strawberry: { name: 'Strawberry Seeds', icon: 'seed_strawberry', kind: 'seed', crop: 'strawberry', price: 35, desc: 'Spring. Plants 3x3. Ready in 2 hours.' },
      seed_peas: { name: 'Peas Seeds', icon: 'seed_peas', kind: 'seed', crop: 'peas', price: 50, desc: 'Spring. Plants 3x3. Ready in 4 hours.' },
      seed_potato: { name: 'Potato Seeds', icon: 'seed_potato', kind: 'seed', crop: 'potato', price: 55, desc: 'Spring. Plants 3x3. Ready in 6 hours.' },
      seed_cabbage: { name: 'Cabbage Seeds', icon: 'seed_cabbage', kind: 'seed', crop: 'cabbage', price: 65, desc: 'Spring. Plants 3x3. Ready in 8 hours.' },
      seed_cauliflower: { name: 'Cauliflower Seeds', icon: 'seed_cauliflower', kind: 'seed', crop: 'cauliflower', price: 75, desc: 'Spring. Plants 3x3. Ready in 12 hours.' },
      seed_onion: { name: 'Onion Seeds', icon: 'seed_onion', kind: 'seed', crop: 'onion', price: 100, desc: 'Spring. Plants 3x3. Ready in 1 day.' },
      seed_tulip: { name: 'Tulip Seeds', icon: 'seed_tulip', kind: 'seed', crop: 'tulip', price: 140, desc: 'Spring. Plants 3x3. Ready in 2 days.' },
      seed_okra: { name: 'Okra Seeds', icon: 'seed_okra', kind: 'seed', crop: 'okra', price: 20, desc: 'Summer. Plants 3x3. Ready in 15 minutes.' },
      seed_chili: { name: 'Chili Pepper Seeds', icon: 'seed_chili', kind: 'seed', crop: 'chili', price: 25, desc: 'Summer. Plants 3x3. Ready in 30 minutes.' },
      seed_cucumber: { name: 'Cucumber Seeds', icon: 'seed_cucumber', kind: 'seed', crop: 'cucumber', price: 30, desc: 'Summer. Plants 3x3. Ready in 1 hour.' },
      seed_bell_pepper: { name: 'Bell Pepper Seeds', icon: 'seed_bell_pepper', kind: 'seed', crop: 'bell_pepper', price: 35, desc: 'Summer. Plants 3x3. Ready in 2 hours.' },
      seed_tomato: { name: 'Tomato Seeds', icon: 'seed_tomato', kind: 'seed', crop: 'tomato', price: 50, desc: 'Summer. Plants 3x3. Ready in 4 hours.' },
      seed_eggplant: { name: 'Eggplant Seeds', icon: 'seed_eggplant', kind: 'seed', crop: 'eggplant', price: 55, desc: 'Summer. Plants 3x3. Ready in 6 hours.' },
      seed_sunflower: { name: 'Sunflower Seeds', icon: 'seed_sunflower', kind: 'seed', crop: 'sunflower', price: 65, desc: 'Summer. Plants 3x3. Ready in 8 hours.' },
      seed_corn: { name: 'Corn Seeds', icon: 'seed_corn', kind: 'seed', crop: 'corn', price: 75, desc: 'Summer. Plants 3x3. Ready in 12 hours.' },
      seed_melon: { name: 'Melon Seeds', icon: 'seed_melon', kind: 'seed', crop: 'melon', price: 100, desc: 'Summer. Plants 3x3. Ready in 1 day.' },
      seed_watermelon: { name: 'Watermelon Seeds', icon: 'seed_watermelon', kind: 'seed', crop: 'watermelon', price: 140, desc: 'Summer. Plants 3x3. Ready in 2 days.' },
      seed_carrot: { name: 'Carrot Seeds', icon: 'seed_carrot', kind: 'seed', crop: 'carrot', price: 20, desc: 'Fall. Plants 3x3. Ready in 15 minutes.' },
      seed_spinach: { name: 'Spinach Seeds', icon: 'seed_spinach', kind: 'seed', crop: 'spinach', price: 25, desc: 'Fall. Plants 3x3. Ready in 30 minutes.' },
      seed_bok_choy: { name: 'Bok Choy Seeds', icon: 'seed_bok_choy', kind: 'seed', crop: 'bok_choy', price: 30, desc: 'Fall. Plants 3x3. Ready in 1 hour.' },
      seed_beet: { name: 'Beet Seeds', icon: 'seed_beet', kind: 'seed', crop: 'beet', price: 35, desc: 'Fall. Plants 3x3. Ready in 2 hours.' },
      seed_garlic: { name: 'Garlic Seeds', icon: 'seed_garlic', kind: 'seed', crop: 'garlic', price: 50, desc: 'Fall. Plants 3x3. Ready in 4 hours.' },
      seed_sweet_potato: { name: 'Sweet Potato Seeds', icon: 'seed_sweet_potato', kind: 'seed', crop: 'sweet_potato', price: 55, desc: 'Fall. Plants 3x3. Ready in 6 hours.' },
      seed_cranberry: { name: 'Cranberry Seeds', icon: 'seed_cranberry', kind: 'seed', crop: 'cranberry', price: 65, desc: 'Fall. Plants 3x3. Ready in 8 hours.' },
      seed_rice: { name: 'Rice Seeds', icon: 'seed_rice', kind: 'seed', crop: 'rice', price: 75, desc: 'Fall. Plants 3x3. Ready in 12 hours.' },
      seed_pumpkin: { name: 'Pumpkin Seeds', icon: 'seed_pumpkin', kind: 'seed', crop: 'pumpkin', price: 100, desc: 'Fall. Plants 3x3. Ready in 1 day.' },
      seed_grapes: { name: 'Grapes Seeds', icon: 'seed_grapes', kind: 'seed', crop: 'grapes', price: 140, desc: 'Fall. Plants 3x3. Ready in 2 days.' },
      seed_kale: { name: 'Kale Seeds', icon: 'seed_kale', kind: 'seed', crop: 'kale', price: 20, desc: 'Winter. Plants 3x3. Ready in 15 minutes.' },
      seed_celery: { name: 'Celery Seeds', icon: 'seed_celery', kind: 'seed', crop: 'celery', price: 25, desc: 'Winter. Plants 3x3. Ready in 30 minutes.' },
      seed_broccoli: { name: 'Broccoli Seeds', icon: 'seed_broccoli', kind: 'seed', crop: 'broccoli', price: 30, desc: 'Winter. Plants 3x3. Ready in 1 hour.' },
      seed_leek: { name: 'Leek Seeds', icon: 'seed_leek', kind: 'seed', crop: 'leek', price: 35, desc: 'Winter. Plants 3x3. Ready in 2 hours.' },
      seed_parsnip: { name: 'Parsnip Seeds', icon: 'seed_parsnip', kind: 'seed', crop: 'parsnip', price: 50, desc: 'Winter. Plants 3x3. Ready in 4 hours.' },
      seed_red_cabbage: { name: 'Red Cabbage Seeds', icon: 'seed_red_cabbage', kind: 'seed', crop: 'red_cabbage', price: 55, desc: 'Winter. Plants 3x3. Ready in 6 hours.' },
      seed_brussels: { name: 'Brussels Sprouts Seeds', icon: 'seed_brussels', kind: 'seed', crop: 'brussels', price: 65, desc: 'Winter. Plants 3x3. Ready in 8 hours.' },
      seed_ginger: { name: 'Ginger Seeds', icon: 'seed_ginger', kind: 'seed', crop: 'ginger', price: 75, desc: 'Winter. Plants 3x3. Ready in 12 hours.' },
      seed_winter_squash: { name: 'Winter Squash Seeds', icon: 'seed_winter_squash', kind: 'seed', crop: 'winter_squash', price: 100, desc: 'Winter. Plants 3x3. Ready in 1 day.' },
      seed_coffee: { name: 'Coffee Seeds', icon: 'seed_coffee', kind: 'seed', crop: 'coffee', price: 140, desc: 'Winter. Plants 3x3. Ready in 2 days.' },
      seed_grass: { name: 'Grass Seeds', icon: 'seed_grass', kind: 'seed', crop: 'grass', price: 100, desc: 'Plants 3x3. Cut it with the Sickle for Fodder after 2 hours. Regrows.' },

      turnip: { name: 'Turnip', icon: 'turnip', kind: 'crop', sell: 5, energy: 5, desc: 'A crunchy white turnip.' },
      radish: { name: 'Radish', icon: 'radish', kind: 'crop', sell: 6, energy: 6, desc: 'A peppery little radish.' },
      lettuce: { name: 'Lettuce', icon: 'lettuce', kind: 'crop', sell: 7, energy: 6, desc: 'A fresh head of lettuce.' },
      strawberry: { name: 'Strawberry', icon: 'strawberry', kind: 'crop', sell: 9, energy: 6, desc: 'A sweet strawberry.' },
      peas: { name: 'Peas', icon: 'peas', kind: 'crop', sell: 12, energy: 7, desc: 'A pod of sweet green peas.' },
      potato: { name: 'Potato', icon: 'potato', kind: 'crop', sell: 14, energy: 8, desc: 'A hearty potato.' },
      cabbage: { name: 'Cabbage', icon: 'cabbage', kind: 'crop', sell: 16, energy: 8, desc: 'A firm green cabbage.' },
      cauliflower: { name: 'Cauliflower', icon: 'cauliflower', kind: 'crop', sell: 18, energy: 8, desc: 'A snowy white cauliflower.' },
      onion: { name: 'Onion', icon: 'onion', kind: 'crop', sell: 25, energy: 10, desc: 'A golden onion.' },
      tulip: { name: 'Tulip', icon: 'tulip', kind: 'crop', sell: 34, energy: 12, desc: 'A bright spring tulip.' },
      okra: { name: 'Okra', icon: 'okra', kind: 'crop', sell: 5, energy: 5, desc: 'Tender green okra.' },
      chili: { name: 'Chili Pepper', icon: 'chili', kind: 'crop', sell: 6, energy: 6, desc: 'A fiery little chili.' },
      cucumber: { name: 'Cucumber', icon: 'cucumber', kind: 'crop', sell: 7, energy: 6, desc: 'A cool, crisp cucumber.' },
      bell_pepper: { name: 'Bell Pepper', icon: 'bell_pepper', kind: 'crop', sell: 9, energy: 6, desc: 'A sweet bell pepper.' },
      tomato: { name: 'Tomato', icon: 'tomato', kind: 'crop', sell: 12, energy: 7, desc: 'A juicy tomato.' },
      eggplant: { name: 'Eggplant', icon: 'eggplant', kind: 'crop', sell: 14, energy: 8, desc: 'A shiny purple eggplant.' },
      sunflower: { name: 'Sunflower', icon: 'sunflower', kind: 'crop', sell: 16, energy: 8, desc: 'A sunflower as big as a plate.' },
      corn: { name: 'Corn', icon: 'corn', kind: 'crop', sell: 18, energy: 8, desc: 'Sweet corn.' },
      melon: { name: 'Melon', icon: 'melon', kind: 'crop', sell: 25, energy: 10, desc: 'A sweet honeydew melon.' },
      watermelon: { name: 'Watermelon', icon: 'watermelon', kind: 'crop', sell: 34, energy: 12, desc: 'A huge striped watermelon.' },
      carrot: { name: 'Carrot', icon: 'carrot', kind: 'crop', sell: 5, energy: 5, desc: 'A crunchy carrot.' },
      spinach: { name: 'Spinach', icon: 'spinach', kind: 'crop', sell: 6, energy: 6, desc: 'A bunch of dark green spinach.' },
      bok_choy: { name: 'Bok Choy', icon: 'bok_choy', kind: 'crop', sell: 7, energy: 6, desc: 'Crisp bok choy (pechay).' },
      beet: { name: 'Beet', icon: 'beet', kind: 'crop', sell: 9, energy: 6, desc: 'A deep red beet.' },
      garlic: { name: 'Garlic', icon: 'garlic', kind: 'crop', sell: 12, energy: 7, desc: 'A bulb of garlic.' },
      sweet_potato: { name: 'Sweet Potato', icon: 'sweet_potato', kind: 'crop', sell: 14, energy: 8, desc: 'A sweet potato (kamote).' },
      cranberry: { name: 'Cranberries', icon: 'cranberry', kind: 'crop', sell: 16, energy: 8, desc: 'A handful of tart cranberries.' },
      rice: { name: 'Rice', icon: 'rice', kind: 'crop', sell: 18, energy: 8, desc: 'A sheaf of golden rice.' },
      pumpkin: { name: 'Pumpkin', icon: 'pumpkin', kind: 'crop', sell: 25, energy: 10, desc: 'A giant pumpkin.' },
      grapes: { name: 'Grapes', icon: 'grapes', kind: 'crop', sell: 34, energy: 12, desc: 'A bunch of purple grapes.' },
      kale: { name: 'Kale', icon: 'kale', kind: 'crop', sell: 5, energy: 5, desc: 'Frosty curly kale.' },
      celery: { name: 'Celery', icon: 'celery', kind: 'crop', sell: 6, energy: 6, desc: 'Crunchy celery sticks.' },
      broccoli: { name: 'Broccoli', icon: 'broccoli', kind: 'crop', sell: 7, energy: 6, desc: 'A head of broccoli.' },
      leek: { name: 'Leek', icon: 'leek', kind: 'crop', sell: 9, energy: 6, desc: 'A long winter leek.' },
      parsnip: { name: 'Parsnip', icon: 'parsnip', kind: 'crop', sell: 12, energy: 7, desc: 'A sweet parsnip.' },
      red_cabbage: { name: 'Red Cabbage', icon: 'red_cabbage', kind: 'crop', sell: 14, energy: 8, desc: 'A purple-red cabbage.' },
      brussels: { name: 'Brussels Sprouts', icon: 'brussels', kind: 'crop', sell: 16, energy: 8, desc: 'A stalk of little sprouts.' },
      ginger: { name: 'Ginger', icon: 'ginger', kind: 'crop', sell: 18, energy: 8, desc: 'A knobbly root of ginger (luya).' },
      winter_squash: { name: 'Winter Squash', icon: 'winter_squash', kind: 'crop', sell: 25, energy: 10, desc: 'A sturdy winter squash.' },
      coffee: { name: 'Coffee Beans', icon: 'coffee', kind: 'crop', sell: 34, energy: 12, desc: 'Freshly picked coffee cherries.' },

      egg: { name: 'Egg', icon: 'egg', kind: 'produce', sell: 40, energy: 8, desc: 'A fresh egg.' },
      egg_l: { name: 'Large Egg', icon: 'egg_l', kind: 'produce', sell: 70, energy: 12, desc: 'A big egg from a happy hen.' },
      milk: { name: 'Milk', icon: 'milk', kind: 'produce', sell: 100, energy: 12, desc: 'Fresh milk.' },
      milk_l: { name: 'Large Milk', icon: 'milk_l', kind: 'produce', sell: 150, energy: 18, desc: 'Rich milk from a happy cow.' },
      truffle: { name: 'Truffle', icon: 'truffle', kind: 'produce', sell: 90, desc: 'A rare mushroom your pig sniffed out.' },
      carabao_milk: { name: 'Carabao Milk', icon: 'carabao_milk', kind: 'produce', sell: 130, energy: 16, desc: 'Creamy milk from your carabao.' },
      chicken_feed: { name: 'Chicken Feed', icon: 'chicken_feed', kind: 'feed', animal: 'chicken', price: 10, desc: 'Feed a chicken once a day and it lays an egg.', shop: 'One a day for each chicken.' },
      fodder: { name: 'Fodder', icon: 'fodder', kind: 'feed', animal: 'cow', price: 20, desc: 'Feed a cow, pig or carabao once a day.', shop: 'One a day for each cow, pig and carabao. Or cut grass.' },
      miracle: { name: 'Miracle Potion', icon: 'miracle', kind: 'potion', price: 800, desc: 'Give to a cow with 2+ hearts and a calf arrives in 7 days.' },
      blue_feather: { name: 'Blue Feather', icon: 'blue_feather', kind: 'feather', price: 1000, desc: 'Show it to someone you love to propose.' },

      ore_copper: { name: 'Copper Ore', icon: 'ore_copper', kind: 'ore', sell: 40, desc: 'Bram can make tools with it.' },
      ore_silver: { name: 'Silver Ore', icon: 'ore_silver', kind: 'ore', sell: 80, desc: 'Bram can make tools with it.' },
      ore_gold: { name: 'Gold Ore', icon: 'ore_gold', kind: 'ore', sell: 150, desc: 'Bram can make tools with it.' },
      gem: { name: 'Gem', icon: 'gem', kind: 'ore', sell: 400, desc: 'A sparkling gem from deep in the mine.' },

      fish_s: { name: 'Small Fish', icon: 'fish_s', kind: 'fish', sell: 30, desc: 'A little fish.' },
      fish_m: { name: 'Medium Fish', icon: 'fish_m', kind: 'fish', sell: 70, desc: 'A decent catch.' },
      fish_l: { name: 'Large Fish', icon: 'fish_l', kind: 'fish', sell: 140, desc: 'What a catch!' },
      fish_k: { name: 'King Trout', icon: 'fish_k', kind: 'fish', sell: 600, desc: 'The legendary fish of the river.' },

      herb: { name: 'Wild Herb', icon: 'herb', kind: 'forage', sell: 30, energy: 5, desc: 'A fragrant spring herb.' },
      berry: { name: 'Wild Berry', icon: 'berry', kind: 'forage', sell: 40, energy: 8, desc: 'A sweet summer berry.' },
      mushroom: { name: 'Mushroom', icon: 'mushroom', kind: 'forage', sell: 60, energy: 10, desc: 'A plump fall mushroom.' },
      root: { name: 'Winter Root', icon: 'root', kind: 'forage', sell: 50, energy: 8, desc: 'A hardy root dug from the snow.' },

      boiled_egg: { name: 'Boiled Egg', icon: 'boiled_egg', kind: 'dish', energy: 25, desc: 'Simple and filling.' },
      hot_milk: { name: 'Hot Milk', icon: 'hot_milk', kind: 'dish', energy: 30, desc: 'Warm and cosy.' },
      baked_potato: { name: 'Baked Potato', icon: 'baked_potato', kind: 'dish', energy: 30, desc: 'Fluffy inside.' },
      jam: { name: 'Strawberry Jam', icon: 'jam', kind: 'dish', energy: 30, desc: 'Sweet and bright.' },
      tomato_soup: { name: 'Tomato Soup', icon: 'tomato_soup', kind: 'dish', energy: 60, desc: 'A summer favourite.' },
      grilled_fish: { name: 'Grilled Fish', icon: 'grilled_fish', kind: 'dish', energy: 45, desc: 'Smoky and good.' },
      veggie_stew: { name: 'Veggie Stew', icon: 'veggie_stew', kind: 'dish', energy: 65, desc: 'Hearty farm stew.' },
      pumpkin_pie: { name: 'Pumpkin Pie', icon: 'pumpkin_pie', kind: 'dish', energy: 110, desc: 'The pride of fall.' },
      mushroom_soup: { name: 'Mushroom Soup', icon: 'mushroom_soup', kind: 'dish', energy: 55, desc: 'Earthy and creamy.' },
      sandwich: { name: 'Sandwich', icon: 'sandwich', kind: 'dish', price: 150, energy: 40, desc: "Rosa's famous sandwich." },
      hot_soup: { name: 'Hot Soup', icon: 'hot_soup', kind: 'dish', price: 250, energy: 70, desc: 'The soup of the day.' },
      tonic: { name: 'Energy Tonic', icon: 'tonic', kind: 'dish', price: 120, energy: 50, desc: "Ivy's herbal pick-me-up." },
    },

    // frame0 = first frame in the animals sheet (poses: walk A, walk B, eat, sleep; 5 frames per row)
    ANIMALS: {
      chicken: {
        name: 'Chicken', price: 500, max: 4, feed: 'chicken_feed', product: 'egg', large: 'egg_l', icon: 'chicken', frame0: 0,
        speed: 230, reach: 0.6, height: 0.6, names: ['Clucky', 'Nugget', 'Pecky', 'Henrietta'], grow: 5, young: 'chick',
        desc: 'Lays an egg every morning after a day it was fed.', shop: 'Lays an egg when fed every day.', home: 'coop',
      },
      cow: {
        name: 'Cow', price: 2000, max: 4, feed: 'fodder', product: 'milk', large: 'milk_l', icon: 'cow', frame0: 5,
        speed: 140, reach: 0.9, height: 1.0, names: ['Daisy', 'Bessie', 'Clover', 'Buttercup'], grow: 10, young: 'calf',
        desc: 'Gives milk every morning after a day it was fed.', shop: 'Gives milk when fed every day.', home: 'barn', milk: true,
      },
      // sheet: these two are in the animals2 sheet (4 frames per row)
      pig: {
        name: 'Pig', price: 1500, max: 2, feed: 'fodder', product: 'truffle', large: 'truffle', icon: 'pig', sheet: 'animals2', frame0: 0,
        speed: 160, reach: 0.7, height: 0.7, names: ['Oinky', 'Truffles', 'Porkchop', 'Peaches'], grow: 7, young: 'piglet',
        desc: 'Sniffs out a truffle every morning after a day it was fed.', shop: 'Finds a truffle when fed every day.', home: 'barn',
      },
      carabao: {
        name: 'Carabao', price: 3000, max: 2, feed: 'fodder', product: 'carabao_milk', large: 'carabao_milk', icon: 'carabao', sheet: 'animals2', frame0: 4,
        speed: 120, reach: 1.0, height: 1.1, names: ['Kalabaw', 'Bantay', 'Dakila', 'Tikling'], grow: 10, young: 'calf',
        desc: 'Strong and gentle. Gives creamy milk every morning after a day it was fed.', shop: 'Gives carabao milk when fed every day.', home: 'barn', milk: true,
      },
    },
    ANIMAL_KEYS: ['chicken', 'cow', 'pig', 'carabao'], // stable order, used by the save format
    LOVE: { pet: 4, feed: 2, brush: 3, hungry: -6, lonely: -3, max: 100, large: 60, potion: 40 },
    INCUBATE_DAYS: 3,
    PREGNANT_DAYS: 7,
    START_ANIMALS: ['chicken'],
    DOG: { name: 'Biscuit', frame0: 10, speed: 520, reach: 0.6, height: 0.55 },

    // FarmVille-style crops: they grow in real time (mins) from planting, with no watering needed. Watering a
    // growing crop once makes it grow faster (C.GROW.boost); a ripe crop withers if it is left too long
    // (C.GROW.wither). art = the crop's growing/ripe frames in the crops sheet; plant/shape/color* draw the
    // placeholder art (tools/art/crops2.js). Seeds are sold in their season; a planted crop grows on through the
    // next season.
    // Prices follow the growing time: profit per tile = 1.5 + 2.5 x sqrt(hours) (quick crops pay more per hour,
    // slow ones more per harvest); a seed bag (9 tiles) costs 45% of what its crops sell for.
    CROPS: {
      turnip: { mins: 15, item: 'turnip', art: 0, seasons: ['spring'], plant: 'root', shape: 'round', color: '#f4f0ea', color2: '#b0508a' },
      radish: { mins: 30, item: 'radish', art: 8, seasons: ['spring'], plant: 'root', shape: 'round', color: '#e0405a', color2: '#ffffff' },
      lettuce: { mins: 60, item: 'lettuce', art: 9, seasons: ['spring'], plant: 'leafy', shape: 'leaf', color: '#8fd16a', color2: '#5fa84a' },
      strawberry: { mins: 120, item: 'strawberry', art: 2, seasons: ['spring'], plant: 'bush', shape: 'berry', color: '#e8304a', color2: '#5fa84a' },
      peas: { mins: 240, item: 'peas', art: 10, seasons: ['spring'], plant: 'vine', shape: 'pod', color: '#7ccf5a', color2: '#4f9a3a' },
      potato: { mins: 360, item: 'potato', art: 1, seasons: ['spring'], plant: 'root', shape: 'lump', color: '#c8a060', color2: '#8a6a3a' },
      cabbage: { mins: 480, item: 'cabbage', art: 11, seasons: ['spring'], plant: 'leafy', shape: 'round', color: '#b8e08a', color2: '#7fb85a' },
      cauliflower: { mins: 720, item: 'cauliflower', art: 12, seasons: ['spring'], plant: 'leafy', shape: 'round', color: '#fff6e0', color2: '#7fb85a' },
      onion: { mins: 1440, item: 'onion', art: 13, seasons: ['spring'], plant: 'root', shape: 'round', color: '#e8b85a', color2: '#a0602a' },
      tulip: { mins: 2880, item: 'tulip', art: 14, seasons: ['spring'], plant: 'flower', shape: 'flower', color: '#ff5a7a', color2: '#ffd0e0' },
      okra: { mins: 15, item: 'okra', art: 15, seasons: ['summer'], plant: 'bush', shape: 'long', color: '#6fbf4a', color2: '#3f8f2a' },
      chili: { mins: 30, item: 'chili', art: 16, seasons: ['summer'], plant: 'bush', shape: 'long', color: '#e83a2a', color2: '#ff8a3a' },
      cucumber: { mins: 60, item: 'cucumber', art: 17, seasons: ['summer'], plant: 'vine', shape: 'long', color: '#3f9f3a', color2: '#9fdf7a' },
      bell_pepper: { mins: 120, item: 'bell_pepper', art: 18, seasons: ['summer'], plant: 'bush', shape: 'round', color: '#f7c531', color2: '#e83a2a' },
      tomato: { mins: 240, item: 'tomato', art: 3, seasons: ['summer'], plant: 'bush', shape: 'round', color: '#e8402a', color2: '#5fa84a' },
      eggplant: { mins: 360, item: 'eggplant', art: 19, seasons: ['summer'], plant: 'bush', shape: 'long', color: '#6a3a8a', color2: '#a07ac0' },
      sunflower: { mins: 480, item: 'sunflower', art: 20, seasons: ['summer'], plant: 'flower', shape: 'flower', color: '#ffd23a', color2: '#8a5a2a' },
      corn: { mins: 720, item: 'corn', art: 4, seasons: ['summer'], plant: 'stalk', shape: 'cob', color: '#f7d046', color2: '#5fa84a' },
      melon: { mins: 1440, item: 'melon', art: 21, seasons: ['summer'], plant: 'ground', shape: 'big', color: '#e8e09a', color2: '#a8c86a' },
      watermelon: { mins: 2880, item: 'watermelon', art: 22, seasons: ['summer'], plant: 'ground', shape: 'big', color: '#3f8f3a', color2: '#e8405a' },
      carrot: { mins: 15, item: 'carrot', art: 5, seasons: ['fall'], plant: 'root', shape: 'long', color: '#f08a2a', color2: '#5fa84a' },
      spinach: { mins: 30, item: 'spinach', art: 23, seasons: ['fall'], plant: 'leafy', shape: 'leaf', color: '#3f8f3a', color2: '#2f6f2a' },
      bok_choy: { mins: 60, item: 'bok_choy', art: 24, seasons: ['fall'], plant: 'leafy', shape: 'leaf', color: '#e8f0d0', color2: '#5fa84a' },
      beet: { mins: 120, item: 'beet', art: 25, seasons: ['fall'], plant: 'root', shape: 'round', color: '#a02a5a', color2: '#5fa84a' },
      garlic: { mins: 240, item: 'garlic', art: 26, seasons: ['fall'], plant: 'root', shape: 'round', color: '#f4ecdc', color2: '#c8b8a0' },
      sweet_potato: { mins: 360, item: 'sweet_potato', art: 27, seasons: ['fall'], plant: 'root', shape: 'lump', color: '#c8603a', color2: '#8a3a2a' },
      cranberry: { mins: 480, item: 'cranberry', art: 28, seasons: ['fall'], plant: 'bush', shape: 'berry', color: '#c8203a', color2: '#8a1a2a' },
      rice: { mins: 720, item: 'rice', art: 29, seasons: ['fall'], plant: 'stalk', shape: 'grain', color: '#e8d08a', color2: '#b89a4a' },
      pumpkin: { mins: 1440, item: 'pumpkin', art: 6, seasons: ['fall'], plant: 'ground', shape: 'big', color: '#f08a2a', color2: '#5fa84a' },
      grapes: { mins: 2880, item: 'grapes', art: 30, seasons: ['fall'], plant: 'vine', shape: 'berry', color: '#7a3aa0', color2: '#a06ac8' },
      kale: { mins: 15, item: 'kale', art: 31, seasons: ['winter'], plant: 'leafy', shape: 'leaf', color: '#3f7f5a', color2: '#2f5f4a' },
      celery: { mins: 30, item: 'celery', art: 32, seasons: ['winter'], plant: 'leafy', shape: 'long', color: '#a8d878', color2: '#6fa84a' },
      broccoli: { mins: 60, item: 'broccoli', art: 33, seasons: ['winter'], plant: 'leafy', shape: 'round', color: '#3f8f3a', color2: '#6fbf4a' },
      leek: { mins: 120, item: 'leek', art: 34, seasons: ['winter'], plant: 'leafy', shape: 'long', color: '#e8f0d8', color2: '#5f9f4a' },
      parsnip: { mins: 240, item: 'parsnip', art: 35, seasons: ['winter'], plant: 'root', shape: 'long', color: '#f0e0b0', color2: '#c8a870' },
      red_cabbage: { mins: 360, item: 'red_cabbage', art: 36, seasons: ['winter'], plant: 'leafy', shape: 'round', color: '#7a3a8a', color2: '#a06ac0' },
      brussels: { mins: 480, item: 'brussels', art: 37, seasons: ['winter'], plant: 'stalk', shape: 'berry', color: '#6fbf4a', color2: '#3f8f3a' },
      ginger: { mins: 720, item: 'ginger', art: 38, seasons: ['winter'], plant: 'root', shape: 'lump', color: '#d8b070', color2: '#a08050' },
      winter_squash: { mins: 1440, item: 'winter_squash', art: 39, seasons: ['winter'], plant: 'ground', shape: 'big', color: '#3f7f6a', color2: '#e8a03a' },
      coffee: { mins: 2880, item: 'coffee', art: 40, seasons: ['winter'], plant: 'bush', shape: 'berry', color: '#8a3a2a', color2: '#3a2a1a' },
      grass: { mins: 120, item: 'fodder', art: 7, seasons: ['spring', 'summer', 'fall'], regrow: 120, sickle: true, plant: 'grass', shape: 'leaf', color: '#7fc04a', color2: '#5fa84a' },
    },
    CROP_WITHERED: 0, // the withered frame in the crops sheet (set below: after every crop's frames)
    CROP_KEYS: ['turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin', 'grass', 'radish', 'lettuce', 'peas', 'cabbage', 'cauliflower', 'onion', 'tulip', 'okra', 'chili', 'cucumber', 'bell_pepper', 'eggplant', 'sunflower', 'melon', 'watermelon', 'spinach', 'bok_choy', 'beet', 'garlic', 'sweet_potato', 'cranberry', 'rice', 'grapes', 'kale', 'celery', 'broccoli', 'leek', 'parsnip', 'red_cabbage', 'brussels', 'ginger', 'winter_squash', 'coffee'], // save-format order (new crops at the end)

    SHOP_STOCK: ['seed_turnip', 'seed_radish', 'seed_lettuce', 'seed_strawberry', 'seed_peas', 'seed_potato', 'seed_cabbage', 'seed_cauliflower', 'seed_onion', 'seed_tulip', 'seed_okra', 'seed_chili', 'seed_cucumber', 'seed_bell_pepper', 'seed_tomato', 'seed_eggplant', 'seed_sunflower', 'seed_corn', 'seed_melon', 'seed_watermelon', 'seed_carrot', 'seed_spinach', 'seed_bok_choy', 'seed_beet', 'seed_garlic', 'seed_sweet_potato', 'seed_cranberry', 'seed_rice', 'seed_pumpkin', 'seed_grapes', 'seed_kale', 'seed_celery', 'seed_broccoli', 'seed_leek', 'seed_parsnip', 'seed_red_cabbage', 'seed_brussels', 'seed_ginger', 'seed_winter_squash', 'seed_coffee', 'seed_grass'],
    SHOP_ANIMALS: ['chicken', 'cow', 'pig', 'carabao'],
    SHOP_FEED: ['chicken_feed', 'fodder'],
    SHOP_SUPPLIES: ['brush', 'milker', 'rod', 'miracle', 'blue_feather'],

    // ---------- kitchen & food ----------
    // Ingredients may name a group: any item of that group will do.
    FOOD_GROUPS: { egg: ['egg', 'egg_l'], milk: ['milk', 'milk_l', 'carabao_milk'], fish: ['fish_s', 'fish_m', 'fish_l', 'fish_k'] },
    RECIPES: [
      { dish: 'boiled_egg', needs: ['egg'] },
      { dish: 'hot_milk', needs: ['milk'] },
      { dish: 'baked_potato', needs: ['potato'] },
      { dish: 'jam', needs: ['strawberry'] },
      { dish: 'grilled_fish', needs: ['fish'] },
      { dish: 'mushroom_soup', needs: ['mushroom', 'milk'] },
      { dish: 'tomato_soup', needs: ['tomato', 'milk'] },
      { dish: 'veggie_stew', needs: ['carrot', 'potato'] },
      { dish: 'pumpkin_pie', needs: ['pumpkin', 'egg', 'milk'] },
    ],
    INN_MENU: ['sandwich', 'hot_soup'],
    CLINIC_MENU: ['tonic'],

    // ---------- fishing, foraging, mine ----------
    FISH_ENERGY: 2,
    FISH_BITE: [1500, 4500], // ms until a bite
    FISH_WINDOW: 900, // ms to tap after the bite
    FISH_TABLE: { // chance by size, per kind of water
      pond: { fish_s: 0.6, fish_m: 0.35, fish_l: 0.05 },
      river: { fish_s: 0.35, fish_m: 0.4, fish_l: 0.2, fish_k: 0.05 },
    },
    FORAGE: { spring: 'herb', summer: 'berry', fall: 'mushroom', winter: 'root' },
    FORAGE_COUNT: { farm: 3, town: 6 },
    MINE: {
      rocks: 0.32, // share of floor tiles with a rock
      // drop chances per rock; an ore only appears from minFloor down
      drops: [
        { id: 'stone', p: 0.4 },
        { id: 'ore_copper', p: 0.22, minFloor: 1 },
        { id: 'ore_silver', p: 0.14, minFloor: 4 },
        { id: 'ore_gold', p: 0.08, minFloor: 8 },
        { id: 'gem', p: 0.03, minFloor: 10 },
      ],
    },

    // ---------- the carpenter ----------
    BUILDS: {
      kitchen: { name: 'Kitchen', gold: 2500, lumber: 40, stone: 0, desc: 'Cook dishes at home. They restore lots of energy.' },
      bighouse: { name: 'House Extension', gold: 8000, lumber: 100, stone: 30, desc: 'A bedroom with a double bed. Needed to marry.' },
      coop2: { name: 'Bigger Coop', gold: 3000, lumber: 40, stone: 0, desc: 'Room for 8 chickens.' },
      barn2: { name: 'Bigger Barn', gold: 6000, lumber: 80, stone: 20, desc: 'Room for 8 cows.' },
    },
    BUILD_KEYS: ['kitchen', 'bighouse', 'coop2', 'barn2'], // stable order, used by the save format
    LUMBER_PRICE: 50,
    STONE_PRICE: 30,

    // ---------- villagers ----------
    VILLAGER_ORDER: VILLAGER_ORDER,
    FRIEND: { talk: 3, love: 15, like: 8, neutral: 3, dislike: -6, birthday: 2, max: 100, marry: 80 },
    WEDDING_DELAY: 3,
    // Places on the town map are Tiled points named after these keys; 'in:x' means inside building x,
    // 'away' means not in town (Lily at her farm stand, for example).
    VILLAGERS: {
      lily: {
        name: 'Lily', role: 'Seed shop', candidate: true, home: 'cottage', job: 'away', birthday: [10, 27],
        loves: ['strawberry', 'jam', 'pumpkin_pie'], likes: ['turnip', 'egg', 'egg_l', 'tomato', 'herb'], dislikes: ['fish_s', 'ore_copper'],
        schedule: [[6 * 60, 'in:cottage'], [8 * 60, 'plaza_e'], [8 * 60 + 40, 'away'], [17 * 60, 'plaza_e'], [19 * 60, 'in:inn'], [21 * 60, 'in:cottage']],
      },
      hollis: {
        name: 'Mayor Hollis', role: 'Mayor', home: 'mayor', birthday: [9, 3],
        loves: ['tomato_soup', 'gem', 'pumpkin_pie'], likes: ['milk', 'milk_l', 'corn', 'hot_milk'], dislikes: ['herb', 'fish_s'],
        schedule: [[6 * 60, 'in:mayor'], [9 * 60, 'plaza_c'], [12 * 60, 'in:mayor'], [14 * 60, 'plaza_c'], [18 * 60, 'in:inn'], [20 * 60, 'in:mayor']],
      },
      bram: {
        name: 'Bram', role: 'Blacksmith', home: 'forge', birthday: [1, 11],
        loves: ['ore_gold', 'gem', 'grilled_fish'], likes: ['ore_silver', 'baked_potato', 'corn', 'hot_soup'], dislikes: ['strawberry', 'jam'],
        schedule: [[6 * 60, 'in:forge'], [17 * 60, 'plaza_w'], [18 * 60, 'in:inn'], [22 * 60, 'in:forge']],
      },
      mira: {
        name: 'Mira', role: 'Carpenter', candidate: true, home: 'woodshop', birthday: [6, 9],
        loves: ['veggie_stew', 'pumpkin', 'gem'], likes: ['carrot', 'berry', 'egg_l', 'sandwich'], dislikes: ['fish_m', 'mushroom'],
        schedule: [[6 * 60, 'in:woodshop'], [16 * 60, 'plaza_n'], [18 * 60, 'dock'], [19 * 60, 'in:woodshop']],
      },
      rosa: {
        name: 'Rosa', role: 'Innkeeper', home: 'inn', birthday: [7, 21],
        loves: ['pumpkin_pie', 'milk_l', 'mushroom'], likes: ['tomato', 'potato', 'egg', 'egg_l'], dislikes: ['ore_copper', 'fish_s'],
        schedule: [[6 * 60, 'plaza_s'], [8 * 60, 'in:inn']],
      },
      leo: {
        name: 'Leo', role: 'Fisherman', candidate: true, home: 'cabin', birthday: [3, 5],
        loves: ['fish_k', 'grilled_fish', 'corn'], likes: ['fish_l', 'berry', 'hot_milk'], dislikes: ['herb', 'carrot'],
        schedule: [[6 * 60, 'dock'], [12 * 60, 'plaza_n'], [14 * 60, 'dock'], [18 * 60, 'in:inn'], [21 * 60, 'in:cabin']],
      },
      ivy: {
        name: 'Ivy', role: 'Herbalist', candidate: true, home: 'clinic', birthday: [11, 17],
        loves: ['herb', 'mushroom_soup', 'strawberry'], likes: ['berry', 'root', 'tomato', 'tonic'], dislikes: ['fish_l', 'ore_gold'],
        schedule: [[6 * 60, 'in:clinic'], [7 * 60, 'forest'], [9 * 60, 'in:clinic'], [17 * 60, 'plaza_w'], [19 * 60, 'in:clinic']],
      },
    },

    // Town buildings: who runs them, when they are open, and what they offer.
    BUILDINGS: {
      mayor: { name: "Mayor's House", open: [8 * 60, 21 * 60] },
      inn: { name: 'Sunny Inn', open: [8 * 60, 23 * 60], owner: 'rosa', offers: ['inn'] },
      forge: { name: "Bram's Forge", open: [7 * 60, 23 * 60], owner: 'bram', offers: ['upgrade'] },
      woodshop: { name: "Mira's Woodshop", open: [7 * 60, 23 * 60], owner: 'mira', offers: ['build', 'materials'] },
      clinic: { name: "Ivy's Clinic", open: [7 * 60, 23 * 60], owner: 'ivy', offers: ['clinic'] },
      cottage: { name: "Lily's Cottage" },
      cabin: { name: "Leo's Cabin" },
    },

    // ---------- festivals ----------
    // On fixed real dates (month, day), the same day for every player; from/to are real clock times.
    FESTIVALS: [
      { key: 'flower', name: 'Flower Festival', date: [4, 14], from: 8 * 60, to: 21 * 60, kind: 'dance',
        desc: 'Dance with someone special in the town plaza.' },
      { key: 'fireworks', name: 'Fireworks Night', date: [7, 24], from: 17 * 60, to: 24 * 60, kind: 'date',
        desc: 'Watch the fireworks over the plaza with someone.' },
      { key: 'harvest', name: 'Harvest Festival', date: [10, 12], from: 8 * 60, to: 21 * 60, kind: 'harvest',
        desc: 'Bring your best crop for the judges.' },
      { key: 'cowfest', name: 'Cow Festival', date: [11, 20], from: 8 * 60, to: 21 * 60, kind: 'cow',
        desc: 'Your happiest cow competes for the blue ribbon.' },
      { key: 'starry', name: 'Starry Night', date: [12, 24], from: 17 * 60, to: 24 * 60, kind: 'date',
        desc: 'Spend the starry evening with someone dear.' },
    ],

    SAVE_VERSION: 1,
    MAX_SAVE_BYTES: 16384,

    ICON_ORDER: ICON_ORDER,
    ICON: {},

    START_ITEMS: [['hoe', 1], ['can', 1], ['seed_turnip', 3], ['chicken_feed', 5], ['axe', 1], ['hammer', 1], ['sickle', 1]],
  };

  // ---------- resolve icon names to sprite frames ----------
  var frame = function (name) {
    var i = ICON_ORDER.indexOf(name);
    if (i < 0) throw new Error('Unknown icon "' + name + '"');
    return i;
  };
  ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.CROP_WITHERED = 2 + C.CROP_KEYS.length * 2;
  Object.keys(C.ITEMS).forEach(function (id) { C.ITEMS[id].icon = frame(C.ITEMS[id].icon); });
  Object.keys(C.ANIMALS).forEach(function (k) { C.ANIMALS[k].icon = frame(C.ANIMALS[k].icon); });
  C.SEASONS.forEach(function (s) { s.icon = frame(s.icon); });
  Object.keys(C.WEATHER).forEach(function (k) { C.WEATHER[k].icon = frame(C.WEATHER[k].icon); });
})(window.Farm = window.Farm || {});
