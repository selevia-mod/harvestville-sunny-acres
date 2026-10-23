// Game constants and content tables. Everything balance-related lives here.
(function (F) {
  'use strict';

  F.Config = {
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
    // icon = frame in the items sheet; also used for the falling petals / leaves / snow
    SEASONS: [
      { key: 'spring', name: 'Spring', icon: 32, particles: { scale: [0.07, 0.11], every: 650, fall: [25, 50] } },
      { key: 'summer', name: 'Summer', icon: 33, particles: null },
      { key: 'fall', name: 'Fall', icon: 34, particles: { scale: [0.09, 0.14], every: 550, fall: [30, 60] } },
      { key: 'winter', name: 'Winter', icon: 35, particles: { scale: [0.05, 0.1], every: 160, fall: [28, 55] } },
    ],

    MAX_ENERGY: 100,
    START_GOLD: 300,
    CAN_CAPACITY: 20,
    INV_SIZE: 18,
    HOTBAR: 6,
    MAX_STACK: 99,
    ENERGY_COST: { hoe: 2, can: 1 },

    SAVE_VERSION: 1,
    MAX_SAVE_BYTES: 16384,

    // icon = frame in the items sprite sheet
    ITEMS: {
      hoe: { name: 'Hoe', icon: 0, kind: 'tool', desc: 'Till the field so you can plant. Uses 2 energy.' },
      can: { name: 'Watering Can', icon: 1, kind: 'tool', desc: 'Water tilled soil daily. Refill it at the pond.' },
      seed_turnip: { name: 'Turnip Seeds', icon: 2, kind: 'seed', crop: 'turnip', price: 20, desc: 'Ready in 3 days. Sells for 60G.' },
      seed_potato: { name: 'Potato Seeds', icon: 3, kind: 'seed', crop: 'potato', price: 40, desc: 'Ready in 5 days. Sells for 110G.' },
      seed_strawberry: { name: 'Strawberry Seeds', icon: 4, kind: 'seed', crop: 'strawberry', price: 60, desc: 'Ready in 7 days. Sells for 170G.' },
      seed_tomato: { name: 'Tomato Seeds', icon: 24, kind: 'seed', crop: 'tomato', price: 50, desc: 'Summer. Ready in 6 days. Sells for 130G.' },
      seed_corn: { name: 'Corn Seeds', icon: 25, kind: 'seed', crop: 'corn', price: 70, desc: 'Summer. Ready in 9 days. Sells for 220G.' },
      seed_carrot: { name: 'Carrot Seeds', icon: 26, kind: 'seed', crop: 'carrot', price: 30, desc: 'Fall. Ready in 4 days. Sells for 90G.' },
      seed_pumpkin: { name: 'Pumpkin Seeds', icon: 27, kind: 'seed', crop: 'pumpkin', price: 100, desc: 'Fall. Ready in 10 days. Sells for 360G.' },
      turnip: { name: 'Turnip', icon: 5, kind: 'crop', sell: 60, desc: 'A crunchy white turnip. Ship it for 60G.' },
      potato: { name: 'Potato', icon: 6, kind: 'crop', sell: 110, desc: 'A hearty potato. Ship it for 110G.' },
      strawberry: { name: 'Strawberry', icon: 7, kind: 'crop', sell: 170, desc: 'A sweet strawberry. Ship it for 170G.' },
      tomato: { name: 'Tomato', icon: 28, kind: 'crop', sell: 130, desc: 'A juicy tomato. Ship it for 130G.' },
      corn: { name: 'Corn', icon: 29, kind: 'crop', sell: 220, desc: 'Sweet corn. Ship it for 220G.' },
      carrot: { name: 'Carrot', icon: 30, kind: 'crop', sell: 90, desc: 'A crunchy carrot. Ship it for 90G.' },
      pumpkin: { name: 'Pumpkin', icon: 31, kind: 'crop', sell: 360, desc: 'A giant pumpkin. Ship it for 360G.' },
      egg: { name: 'Egg', icon: 16, kind: 'produce', sell: 50, desc: 'A fresh egg. Ship it for 50G.' },
      milk: { name: 'Milk', icon: 17, kind: 'produce', sell: 120, desc: 'Fresh milk. Ship it for 120G.' },
      chicken_feed: { name: 'Chicken Feed', icon: 18, kind: 'feed', animal: 'chicken', price: 10, desc: 'Feed a chicken once a day and it lays an egg.', shop: 'One a day for each chicken.' },
      fodder: { name: 'Fodder', icon: 19, kind: 'feed', animal: 'cow', price: 20, desc: 'Feed a cow once a day and it gives milk.', shop: 'One a day for each cow.' },
    },

    // frame0 = first frame in the animals sheet (poses: walk A, walk B, eat, sleep; 5 frames per row)
    ANIMALS: {
      chicken: {
        name: 'Chicken', price: 250, max: 4, feed: 'chicken_feed', product: 'egg', icon: 21, frame0: 0,
        speed: 230, reach: 0.6, height: 0.6, names: ['Clucky', 'Nugget', 'Pecky', 'Henrietta'],
        desc: 'Lays an egg every morning after a day it was fed.', shop: 'Lays an egg when fed every day.', home: 'coop',
      },
      cow: {
        name: 'Cow', price: 1000, max: 4, feed: 'fodder', product: 'milk', icon: 22, frame0: 5,
        speed: 140, reach: 0.9, height: 1.0, names: ['Daisy', 'Bessie', 'Clover', 'Buttercup'],
        desc: 'Gives milk every morning after a day it was fed.', shop: 'Gives milk when fed every day.', home: 'barn',
      },
    },
    ANIMAL_KEYS: ['chicken', 'cow'], // stable order, used by the save format
    LOVE: { pet: 4, feed: 2, hungry: -6, lonely: -3, max: 100 },
    START_ANIMALS: ['chicken'],

    // art = index in the crops sheet (frames 0 seeds and 1 sprout are shared; then growing, ripe per crop).
    // A crop only grows in its seasons; when the season changes, crops that don't belong wither.
    CROPS: {
      turnip: { days: 3, item: 'turnip', art: 0, seasons: ['spring'] },
      potato: { days: 5, item: 'potato', art: 1, seasons: ['spring'] },
      strawberry: { days: 7, item: 'strawberry', art: 2, seasons: ['spring'] },
      tomato: { days: 6, item: 'tomato', art: 3, seasons: ['summer'] },
      corn: { days: 9, item: 'corn', art: 4, seasons: ['summer'] },
      carrot: { days: 4, item: 'carrot', art: 5, seasons: ['fall'] },
      pumpkin: { days: 10, item: 'pumpkin', art: 6, seasons: ['fall'] },
    },
    CROP_KEYS: ['turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin'], // stable order, used by the save format

    SHOP_STOCK: ['seed_turnip', 'seed_potato', 'seed_strawberry', 'seed_tomato', 'seed_corn', 'seed_carrot', 'seed_pumpkin'],
    SHOP_ANIMALS: ['chicken', 'cow'],
    SHOP_FEED: ['chicken_feed', 'fodder'],

    ICON: { coin: 8, bolt: 9, bag: 10, moon: 11, drop: 12, sparkle: 13, crate: 14, tag: 15, heart: 20, bubble: 23 },

    START_ITEMS: [['hoe', 1], ['can', 1], ['seed_turnip', 6], ['chicken_feed', 5]],
  };
})(window.Farm = window.Farm || {});
