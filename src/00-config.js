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
    MS_PER_MINUTE: 500, // real milliseconds per in-game minute
    SHOP_OPEN: 9 * 60,
    SHOP_CLOSE: 17 * 60,

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
      can: { energy: 1, area: true, capacity: [20, 30, 45, 60] },
      axe: { energy: 3, area: true },
      hammer: { energy: 3, area: true },
      sickle: { energy: 1, area: true },
    },
    TOOL_KEYS: ['hoe', 'can', 'axe', 'hammer', 'sickle'], // stable order, used by the save format
    TOOL_ENERGY_SCALE: [1, 0.8, 0.65, 0.5], // energy per tile at each tool level
    CHARGE_MS: 450, // hold the action button this long per charge level
    UPGRADES: [ // cost to reach level 1, 2, 3 at the forge
      { gold: 600, ore: 'ore_copper', n: 5 },
      { gold: 1500, ore: 'ore_silver', n: 5 },
      { gold: 3000, ore: 'ore_gold', n: 5 },
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

      seed_turnip: { name: 'Turnip Seeds', icon: 'seed_turnip', kind: 'seed', crop: 'turnip', price: 120, desc: 'Spring. Plants 3x3. Ready in 3 days.' },
      seed_potato: { name: 'Potato Seeds', icon: 'seed_potato', kind: 'seed', crop: 'potato', price: 220, desc: 'Spring. Plants 3x3. Ready in 5 days.' },
      seed_strawberry: { name: 'Strawberry Seeds', icon: 'seed_strawberry', kind: 'seed', crop: 'strawberry', price: 380, desc: 'Spring. Plants 3x3. Ready in 7 days, then every 3.' },
      seed_tomato: { name: 'Tomato Seeds', icon: 'seed_tomato', kind: 'seed', crop: 'tomato', price: 300, desc: 'Summer. Plants 3x3. Ready in 6 days, then every 3.' },
      seed_corn: { name: 'Corn Seeds', icon: 'seed_corn', kind: 'seed', crop: 'corn', price: 420, desc: 'Summer. Plants 3x3. Ready in 9 days, then every 3.' },
      seed_carrot: { name: 'Carrot Seeds', icon: 'seed_carrot', kind: 'seed', crop: 'carrot', price: 180, desc: 'Fall. Plants 3x3. Ready in 4 days.' },
      seed_pumpkin: { name: 'Pumpkin Seeds', icon: 'seed_pumpkin', kind: 'seed', crop: 'pumpkin', price: 600, desc: 'Fall. Plants 3x3. Ready in 10 days.' },
      seed_grass: { name: 'Grass Seeds', icon: 'seed_grass', kind: 'seed', crop: 'grass', price: 100, desc: 'Plants 3x3. Cut it with the Sickle for Fodder. Regrows.' },

      turnip: { name: 'Turnip', icon: 'turnip', kind: 'crop', sell: 60, energy: 8, desc: 'A crunchy white turnip.' },
      potato: { name: 'Potato', icon: 'potato', kind: 'crop', sell: 110, energy: 10, desc: 'A hearty potato.' },
      strawberry: { name: 'Strawberry', icon: 'strawberry', kind: 'crop', sell: 170, energy: 6, desc: 'A sweet strawberry.' },
      tomato: { name: 'Tomato', icon: 'tomato', kind: 'crop', sell: 130, energy: 8, desc: 'A juicy tomato.' },
      corn: { name: 'Corn', icon: 'corn', kind: 'crop', sell: 220, energy: 10, desc: 'Sweet corn.' },
      carrot: { name: 'Carrot', icon: 'carrot', kind: 'crop', sell: 90, energy: 6, desc: 'A crunchy carrot.' },
      pumpkin: { name: 'Pumpkin', icon: 'pumpkin', kind: 'crop', sell: 360, energy: 15, desc: 'A giant pumpkin.' },

      egg: { name: 'Egg', icon: 'egg', kind: 'produce', sell: 50, energy: 8, desc: 'A fresh egg.' },
      egg_l: { name: 'Large Egg', icon: 'egg_l', kind: 'produce', sell: 80, energy: 12, desc: 'A big egg from a happy hen.' },
      milk: { name: 'Milk', icon: 'milk', kind: 'produce', sell: 120, energy: 12, desc: 'Fresh milk.' },
      milk_l: { name: 'Large Milk', icon: 'milk_l', kind: 'produce', sell: 180, energy: 18, desc: 'Rich milk from a happy cow.' },
      chicken_feed: { name: 'Chicken Feed', icon: 'chicken_feed', kind: 'feed', animal: 'chicken', price: 10, desc: 'Feed a chicken once a day and it lays an egg.', shop: 'One a day for each chicken.' },
      fodder: { name: 'Fodder', icon: 'fodder', kind: 'feed', animal: 'cow', price: 20, desc: 'Feed a cow once a day and it gives milk.', shop: 'One a day for each cow. Or cut grass.' },
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
        name: 'Chicken', price: 250, max: 4, feed: 'chicken_feed', product: 'egg', large: 'egg_l', icon: 'chicken', frame0: 0,
        speed: 230, reach: 0.6, height: 0.6, names: ['Clucky', 'Nugget', 'Pecky', 'Henrietta'], grow: 5, young: 'chick',
        desc: 'Lays an egg every morning after a day it was fed.', shop: 'Lays an egg when fed every day.', home: 'coop',
      },
      cow: {
        name: 'Cow', price: 1000, max: 4, feed: 'fodder', product: 'milk', large: 'milk_l', icon: 'cow', frame0: 5,
        speed: 140, reach: 0.9, height: 1.0, names: ['Daisy', 'Bessie', 'Clover', 'Buttercup'], grow: 10, young: 'calf',
        desc: 'Gives milk every morning after a day it was fed.', shop: 'Gives milk when fed every day.', home: 'barn',
      },
    },
    ANIMAL_KEYS: ['chicken', 'cow'], // stable order, used by the save format
    LOVE: { pet: 4, feed: 2, brush: 3, hungry: -6, lonely: -3, max: 100, large: 60, potion: 40 },
    INCUBATE_DAYS: 3,
    PREGNANT_DAYS: 7,
    START_ANIMALS: ['chicken'],
    DOG: { name: 'Biscuit', frame0: 10, speed: 520, reach: 0.6, height: 0.55 },

    // art = index in the crops sheet (frames 0 seeds and 1 sprout are shared; then growing, ripe per crop).
    // A crop only grows in its seasons; when the season changes, crops that don't belong wither.
    // regrow = days until a harvested plant is ripe again (it stays in the ground).
    CROPS: {
      turnip: { days: 3, item: 'turnip', art: 0, seasons: ['spring'] },
      potato: { days: 5, item: 'potato', art: 1, seasons: ['spring'] },
      strawberry: { days: 7, item: 'strawberry', art: 2, seasons: ['spring'], regrow: 3 },
      tomato: { days: 6, item: 'tomato', art: 3, seasons: ['summer'], regrow: 3 },
      corn: { days: 9, item: 'corn', art: 4, seasons: ['summer'], regrow: 3 },
      carrot: { days: 4, item: 'carrot', art: 5, seasons: ['fall'] },
      pumpkin: { days: 10, item: 'pumpkin', art: 6, seasons: ['fall'] },
      grass: { days: 4, item: 'fodder', art: 7, seasons: ['spring', 'summer', 'fall'], regrow: 3, sickle: true },
    },
    CROP_KEYS: ['turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin', 'grass'], // save-format order

    SHOP_STOCK: ['seed_turnip', 'seed_potato', 'seed_strawberry', 'seed_tomato', 'seed_corn', 'seed_carrot', 'seed_pumpkin', 'seed_grass'],
    SHOP_ANIMALS: ['chicken', 'cow'],
    SHOP_FEED: ['chicken_feed', 'fodder'],
    SHOP_SUPPLIES: ['brush', 'milker', 'rod', 'miracle', 'blue_feather'],

    // ---------- kitchen & food ----------
    // Ingredients may name a group: any item of that group will do.
    FOOD_GROUPS: { egg: ['egg', 'egg_l'], milk: ['milk', 'milk_l'], fish: ['fish_s', 'fish_m', 'fish_l', 'fish_k'] },
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
      kitchen: { name: 'Kitchen', gold: 1200, lumber: 30, stone: 0, desc: 'Cook dishes at home. They restore lots of energy.' },
      bighouse: { name: 'House Extension', gold: 3000, lumber: 60, stone: 10, desc: 'A bedroom with a double bed. Needed to marry.' },
      coop2: { name: 'Bigger Coop', gold: 1000, lumber: 25, stone: 0, desc: 'Room for 8 chickens.' },
      barn2: { name: 'Bigger Barn', gold: 2000, lumber: 50, stone: 10, desc: 'Room for 8 cows.' },
    },
    BUILD_KEYS: ['kitchen', 'bighouse', 'coop2', 'barn2'], // stable order, used by the save format
    LUMBER_PRICE: 30,
    STONE_PRICE: 20,

    // ---------- villagers ----------
    VILLAGER_ORDER: VILLAGER_ORDER,
    FRIEND: { talk: 3, love: 15, like: 8, neutral: 3, dislike: -6, birthday: 2, max: 100, marry: 80 },
    WEDDING_DELAY: 3,
    // Places on the town map are Tiled points named after these keys; 'in:x' means inside building x,
    // 'away' means not in town (Lily at her farm stand, for example).
    VILLAGERS: {
      lily: {
        name: 'Lily', role: 'Seed shop', candidate: true, home: 'cottage', job: 'away', birthday: ['spring', 20],
        loves: ['strawberry', 'jam', 'pumpkin_pie'], likes: ['turnip', 'egg', 'egg_l', 'tomato', 'herb'], dislikes: ['fish_s', 'ore_copper'],
        schedule: [[6 * 60, 'in:cottage'], [8 * 60, 'plaza_e'], [8 * 60 + 40, 'away'], [17 * 60, 'plaza_e'], [19 * 60, 'in:inn'], [21 * 60, 'in:cottage']],
      },
      hollis: {
        name: 'Mayor Hollis', role: 'Mayor', home: 'mayor', birthday: ['fall', 3],
        loves: ['tomato_soup', 'gem', 'pumpkin_pie'], likes: ['milk', 'milk_l', 'corn', 'hot_milk'], dislikes: ['herb', 'fish_s'],
        schedule: [[6 * 60, 'in:mayor'], [9 * 60, 'plaza_c'], [12 * 60, 'in:mayor'], [14 * 60, 'plaza_c'], [18 * 60, 'in:inn'], [20 * 60, 'in:mayor']],
      },
      bram: {
        name: 'Bram', role: 'Blacksmith', home: 'forge', birthday: ['winter', 11],
        loves: ['ore_gold', 'gem', 'grilled_fish'], likes: ['ore_silver', 'baked_potato', 'corn', 'hot_soup'], dislikes: ['strawberry', 'jam'],
        schedule: [[6 * 60, 'in:forge'], [17 * 60, 'plaza_w'], [18 * 60, 'in:inn'], [22 * 60, 'in:forge']],
      },
      mira: {
        name: 'Mira', role: 'Carpenter', candidate: true, home: 'woodshop', birthday: ['summer', 9],
        loves: ['veggie_stew', 'pumpkin', 'gem'], likes: ['carrot', 'berry', 'egg_l', 'sandwich'], dislikes: ['fish_m', 'mushroom'],
        schedule: [[6 * 60, 'in:woodshop'], [16 * 60, 'plaza_n'], [18 * 60, 'dock'], [19 * 60, 'in:woodshop']],
      },
      rosa: {
        name: 'Rosa', role: 'Innkeeper', home: 'inn', birthday: ['summer', 21],
        loves: ['pumpkin_pie', 'milk_l', 'mushroom'], likes: ['tomato', 'potato', 'egg', 'egg_l'], dislikes: ['ore_copper', 'fish_s'],
        schedule: [[6 * 60, 'plaza_s'], [8 * 60, 'in:inn']],
      },
      leo: {
        name: 'Leo', role: 'Fisherman', candidate: true, home: 'cabin', birthday: ['spring', 5],
        loves: ['fish_k', 'grilled_fish', 'corn'], likes: ['fish_l', 'berry', 'hot_milk'], dislikes: ['herb', 'carrot'],
        schedule: [[6 * 60, 'dock'], [12 * 60, 'plaza_n'], [14 * 60, 'dock'], [18 * 60, 'in:inn'], [21 * 60, 'in:cabin']],
      },
      ivy: {
        name: 'Ivy', role: 'Herbalist', candidate: true, home: 'clinic', birthday: ['fall', 17],
        loves: ['herb', 'mushroom_soup', 'strawberry'], likes: ['berry', 'root', 'tomato', 'tonic'], dislikes: ['fish_l', 'ore_gold'],
        schedule: [[6 * 60, 'in:clinic'], [7 * 60, 'forest'], [9 * 60, 'in:clinic'], [17 * 60, 'plaza_w'], [19 * 60, 'in:clinic']],
      },
    },

    // Town buildings: who runs them, when they are open, and what they offer.
    BUILDINGS: {
      mayor: { name: "Mayor's House", open: [9 * 60, 18 * 60] },
      inn: { name: 'Sunny Inn', open: [8 * 60, 23 * 60], owner: 'rosa', offers: ['inn'] },
      forge: { name: "Bram's Forge", open: [9 * 60, 17 * 60], owner: 'bram', offers: ['upgrade'] },
      woodshop: { name: "Mira's Woodshop", open: [9 * 60, 16 * 60], owner: 'mira', offers: ['build', 'materials'] },
      clinic: { name: "Ivy's Clinic", open: [9 * 60, 17 * 60], owner: 'ivy', offers: ['clinic'] },
      cottage: { name: "Lily's Cottage" },
      cabin: { name: "Leo's Cabin" },
    },

    // ---------- festivals ----------
    FESTIVALS: [
      { key: 'flower', name: 'Flower Festival', season: 'spring', day: 14, from: 10 * 60, to: 17 * 60, kind: 'dance',
        desc: 'Dance with someone special in the town plaza.' },
      { key: 'fireworks', name: 'Fireworks Night', season: 'summer', day: 24, from: 18 * 60, to: 22 * 60, kind: 'date',
        desc: 'Watch the fireworks over the plaza with someone.' },
      { key: 'harvest', name: 'Harvest Festival', season: 'fall', day: 12, from: 10 * 60, to: 17 * 60, kind: 'harvest',
        desc: 'Bring your best crop for the judges.' },
      { key: 'cowfest', name: 'Cow Festival', season: 'fall', day: 20, from: 10 * 60, to: 16 * 60, kind: 'cow',
        desc: 'Your happiest cow competes for the blue ribbon.' },
      { key: 'starry', name: 'Starry Night', season: 'winter', day: 24, from: 18 * 60, to: 22 * 60, kind: 'date',
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
  Object.keys(C.ITEMS).forEach(function (id) { C.ITEMS[id].icon = frame(C.ITEMS[id].icon); });
  Object.keys(C.ANIMALS).forEach(function (k) { C.ANIMALS[k].icon = frame(C.ANIMALS[k].icon); });
  C.SEASONS.forEach(function (s) { s.icon = frame(s.icon); });
  Object.keys(C.WEATHER).forEach(function (k) { C.WEATHER[k].icon = frame(C.WEATHER[k].icon); });
})(window.Farm = window.Farm || {});
