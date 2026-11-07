// Players' ideas (owner, 5 Nov 2026): the shops never close, Mira takes two jobs at once, Double Drops twice a week (by
// Manila time), dropping things you no longer need (friends nearby may pick them up), and new seeds: flowers (rose,
// sampaguita, gumamela), cotton, sugarcane, cacao and oregano, grown to craft yard pieces at Mira's instead of buying
// them, and two new bakes. Loaded last of the content files, so the new icons and crops go at the end of their lists
// (icon and crop numbers are saved). Rules in 01-logicZZ-players.js, the screen in 19zzz-a-players.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60;

  // ---------- the shops never close (a festival still closes them; the school and the Mayor keep their hours) ----------
  // (C.SHOP_OPEN / C.SHOP_CLOSE stay: they also say when it is night. L.shopOpen and L.marketOpen: 01-logicZZ-players.js.)
  Object.keys(C.BUILDINGS).forEach(function (k) {
    var b = C.BUILDINGS[k];
    if (b.owner && b.open && k !== 'school') b.open = [0, 99 * H];
  });
  if (C.TRADER && C.TRADER.open) C.TRADER.open = [0, 99 * H];
  // Kanor (Wild Lands) and Tita Luz (Tailor Shop) keep their own hours: there at every hour too (owner, 5 Nov 2026)
  [C.KANOR, C.TAILOR].forEach(function (k) { if (k) { k.open = 0; k.close = 99 * H; } });

  // ---------- Mira: two jobs at once ----------
  C.MIRA_JOBS = 2;
  // (a player thought the Bigger Barn did nothing for pigs: it doubles every barn animal)
  C.BUILDS.barn2.desc = 'Room for 8 cows, 4 pigs and 4 carabao.';
  C.BUILDS.coop2.desc = 'Room for 8 chickens.';

  // ---------- animals: a product some hours after each feeding (it was once a day, the morning after) ----------
  // Owner, 5 Nov 2026 (players: "24 hours for 1 egg is too long"), from the numbers: a chicken every 8 hours, a cow,
  // pig or carabao every 12. Prices stay; a full, happy ranch makes at most about 2.2 times what it did, and a player
  // who comes once a day makes the same as before.
  // Owner, 8 Nov 2026: "8 and 12 still far too long": an egg 4 hours after feeding, milk (and a truffle) 6.
  C.ANIMAL_HOURS = { chicken: 4, cow: 6, pig: 6, carabao: 6 };
  Object.keys(C.ANIMAL_HOURS).forEach(function (k) {
    var a = C.ANIMALS[k], h = C.ANIMAL_HOURS[k], what = { chicken: 'Lays an egg', cow: 'Gives milk', pig: 'Sniffs out a truffle', carabao: 'Gives creamy carabao milk' }[k];
    if (!a) return;
    a.desc = (k === 'carabao' ? 'Strong and gentle. ' : '') + what + ' ' + h + ' hours after it is fed.';
    a.shop = what + ' every ' + h + ' hours when fed.';
  });

  // ---------- Double Drops: Wednesday and Saturday, 12-1 PM and 8-10 PM Manila time ----------
  // Picking crops, forage, mine rocks and what a hunted animal leaves: twice as much.
  C.DOUBLE = { days: [3, 6], windows: [[12 * H, 13 * H], [20 * H, 22 * H]], tz: 8 * H };

  // ---------- dropping things ----------
  // A dropped stack lies on the ground for C.DROP.mins, then it is gone. A friend on the same map may pick it up
  // (it goes to them as a gift: the server's friends-only rules and daily limits). Tools can't be dropped.
  C.DROP = { mins: 5, most: 12, pile: 99 }; // most: stacks on the ground at once; pile: the most in one (a friend takes it
  // as a gift, and the server's gift is 1 to 99: farm_give_v1, part 9; a slot holds 999 since 7 Nov 2026)

  // ---------- new seeds ----------
  // On the same ladder as every other crop: grow time -> seed price and what one sells for.
  var LADDER = { 60: [30, 7], 240: [50, 12], 360: [55, 14], 720: [75, 18], 1440: [100, 25] };
  var when = function (m) { return m < 60 ? m + ' minutes' : m < 1440 ? m / 60 + (m === 60 ? ' hour' : ' hours') : m / 1440 + (m === 1440 ? ' day' : ' days'); };
  var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  var CROPS = [
    // key, name, seasons, minutes, plant, shape, colour, colour 2, energy, what it is for
    ['rose', 'Rose', ['spring'], 720, 'flower', 'flower', '#e0405a', '#ffd0d8', 0, 'A red rose. Craft a Rose Bush or a Flower Arch at Mira\'s.'],
    ['sampaguita', 'Sampaguita', ['summer'], 240, 'flower', 'flower', '#fbf8ee', '#f2e6b0', 0, 'Small white jasmine, sweet-smelling. Mira crafts hedges and arches from it.'],
    ['gumamela', 'Gumamela', ['fall'], 360, 'flower', 'flower', '#ff4a5a', '#ffd23f', 0, 'A big red hibiscus. Craft Flower Beds and hedges at Mira\'s.'],
    ['cotton', 'Cotton', ['summer'], 1440, 'bush', 'round', '#ffffff', '#e8e0d0', 0, 'Soft white cotton. Mira makes a Scarecrow from it.'],
    ['sugarcane', 'Sugarcane', ['fall'], 1440, 'stalk', 'long', '#c8d870', '#8a6a3a', 6, 'Sweet canes. The Bakery uses it for Chocolate Cake.'],
    ['cacao', 'Cacao', ['winter'], 720, 'bush', 'lump', '#c8782a', '#6a3a1a', 4, 'Cacao pods. The Bakery makes Sikwate and Chocolate Cake.'],
    ['oregano', 'Oregano', ['spring', 'summer', 'fall'], 60, 'leafy', 'leaf', '#7ab84a', '#4f8a2e', 3, 'A fragrant herb. Mira makes a Planter from it.'],
  ];
  var ITEMS = {};
  CROPS.forEach(function (c) {
    var key = c[0], mins = c[3], price = LADDER[mins];
    var seasons = c[2].length === 3 ? 'Spring, summer and fall' : c[2].map(cap).join(' and ');
    ITEMS['seed_' + key] = { name: c[1] + ' Seeds', kind: 'seed', crop: key, price: price[0], desc: seasons + '. Plants 3x3. Ready in ' + when(mins) + '.' };
    ITEMS[key] = { name: c[1], kind: 'crop', sell: price[1], energy: c[8], desc: c[9] };
    C.CROPS[key] = { mins: mins, item: key, art: C.CROP_KEYS.length, seasons: c[2], plant: c[4], shape: c[5], color: c[6], color2: c[7] };
    C.CROP_KEYS.push(key);
    C.SHOP_STOCK.push('seed_' + key);
  });
  C.CROP_WITHERED = 2 + C.CROP_KEYS.length * 2; // (after every crop's two frames)
  C.NEW_CROPS = CROPS.map(function (c) { return c[0]; });

  // ---------- two new bakes ----------
  ITEMS.sikwate = { name: 'Sikwate', kind: 'goods', sell: 190, energy: 40, desc: 'Thick hot chocolate from your own cacao.' };
  ITEMS.chocolate_cake = { name: 'Chocolate Cake', kind: 'goods', sell: 240, energy: 60, desc: 'A rich cake of cacao, sugarcane and wheat.' };
  C.WORKSHOPS.bakery.recipes.push(
    { out: 'sikwate', mins: 30, needs: [['cacao', 2], ['milk', 1]] },
    { out: 'chocolate_cake', mins: 120, needs: [['cacao', 2], ['wheat', 2], ['egg', 1], ['sugarcane', 1]] }
  );
  C.WORKSHOPS.bakery.desc = 'Bakes bread, pandesal, cakes and sikwate.';
  C.MADE_IN.sikwate = 'bakery';
  C.MADE_IN.chocolate_cake = 'bakery';

  // appended: icon numbers are saved, so the sheet only grows at its end
  Object.keys(ITEMS).forEach(function (id) {
    if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id);
    C.ICON[id] = C.ICON_ORDER.indexOf(id);
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
  });

  // ---------- crafting yard pieces at Mira's from your own harvest (instead of buying them) ----------
  // needs: [item, n]; 'lumber' and 'stone' come from your wood and stone. About a third of the piece's price in goods.
  C.CRAFT = [
    { key: 'flower_bed', needs: [['tulip', 4], ['gumamela', 2]] },
    { key: 'rose_bush', needs: [['rose', 5]] },
    { key: 'sunflowers', needs: [['sunflower', 5]] },
    { key: 'flower_hedge', needs: [['sampaguita', 3], ['gumamela', 2]] },
    { key: 'planter', needs: [['oregano', 3], ['lumber', 1]] },
    { key: 'scarecrow', needs: [['cotton', 3], ['wheat', 3], ['lumber', 1]] },
    { key: 'hay_bales', needs: [['wheat', 30]] },
    { key: 'flower_arch', needs: [['rose', 10], ['sampaguita', 4], ['lumber', 5]] },
  ];

  // ---------- quests: clearing (mine rocks count too) ----------
  C.QUESTS.hard.forEach(function (d) { d.list.forEach(function (q) { if (q.c === 'clear' && q.n > 15) q.n = 15; }); });

  // ---------- the yard holds more (every path tile and fence piece is one piece) ----------
  C.YARD_MAX = 500;

})(window.Farm = window.Farm || {});
