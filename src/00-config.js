// Game constants and content tables. Everything balance-related lives here.
(function (F) {
  'use strict';

  F.Config = {
    WIDTH: 360,
    HEIGHT: 640,
    TILE: 16,
    ZOOM: 2,
    SPEED: 72, // world px per second

    DAY_START: 6 * 60, // 6:00 AM, minutes after midnight
    PASS_OUT: 26 * 60, // 2:00 AM the next morning
    NIGHT_START: 17 * 60,
    NIGHT_FULL: 20 * 60,
    MS_PER_MINUTE: 500, // real milliseconds per in-game minute
    SHOP_OPEN: 9 * 60,
    SHOP_CLOSE: 17 * 60,

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
      turnip: { name: 'Turnip', icon: 5, kind: 'crop', sell: 60, desc: 'A crunchy white turnip. Ship it for 60G.' },
      potato: { name: 'Potato', icon: 6, kind: 'crop', sell: 110, desc: 'A hearty potato. Ship it for 110G.' },
      strawberry: { name: 'Strawberry', icon: 7, kind: 'crop', sell: 170, desc: 'A sweet strawberry. Ship it for 170G.' },
    },

    // row = row in the crops sprite sheet (4 growth frames per row)
    CROPS: {
      turnip: { days: 3, item: 'turnip', row: 0 },
      potato: { days: 5, item: 'potato', row: 1 },
      strawberry: { days: 7, item: 'strawberry', row: 2 },
    },
    CROP_KEYS: ['turnip', 'potato', 'strawberry'], // stable order, used by the save format

    SHOP_STOCK: ['seed_turnip', 'seed_potato', 'seed_strawberry'],

    ICON: { coin: 8, bolt: 9, bag: 10, moon: 11, drop: 12, sparkle: 13, crate: 14, tag: 15 },

    START_ITEMS: [['hoe', 1], ['can', 1], ['seed_turnip', 6]],
  };
})(window.Farm = window.Farm || {});
