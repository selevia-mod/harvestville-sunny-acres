// The farm grows (owner, 27 Oct 2026, ideas from FarmVille, Hay Day and Harvest Moon): workshops that turn
// crops and milk into goods over real time (the Bakery, the Dairy, the Jam Maker), fruit trees that fruit in their
// seasons, more land (field plots placed in the yard), crop mastery stars, and helping a friend's farm.
// Loaded after 00-town2.js: everything here is appended, so older saves keep working. Rules in 01-logicA.js,
// the farm side in 19k-farm2.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var O = C.OUTDOOR;

  // ---------- new goods (icons appended to the items sheet: tools/art/farm2.js draws them) ----------
  var GOODS = {
    seed_wheat: { name: 'Wheat Seeds', kind: 'seed', crop: 'wheat', price: 25, desc: 'Spring, summer and fall. Plants 3x3. Ready in 20 minutes. The Bakery uses it.' },
    wheat: { name: 'Wheat', kind: 'crop', sell: 6, energy: 4, desc: 'A sheaf of golden wheat. Bake it into bread.' },
    // fruit from the trees
    apple: { name: 'Apple', plural: 'apples', kind: 'fruit', sell: 20, energy: 8, desc: 'A crisp red apple.' },
    orange: { name: 'Orange', plural: 'oranges', kind: 'fruit', sell: 24, energy: 8, desc: 'A juicy orange.' },
    mango: { name: 'Mango', plural: 'mangoes', kind: 'fruit', sell: 30, energy: 10, desc: 'A sweet golden mango (mangga).' },
    peach: { name: 'Peach', plural: 'peaches', kind: 'fruit', sell: 26, energy: 9, desc: 'A soft, fuzzy peach.' },
    // the Bakery (bread and cake are also sold at Hana's, so they sell for less than she asks)
    pandesal: { name: 'Pandesal', kind: 'goods', sell: 110, energy: 20, desc: 'Soft bread rolls, warm from the Bakery.' },
    // the Dairy
    cream: { name: 'Cream', kind: 'goods', sell: 140, energy: 14, desc: 'Thick fresh cream.' },
    butter: { name: 'Butter', kind: 'goods', sell: 280, energy: 16, desc: 'Golden churned butter.' },
    cheese: { name: 'Cheese', kind: 'goods', sell: 450, energy: 30, desc: 'A wheel of farm cheese.' },
    kesong_puti: { name: 'Kesong Puti', kind: 'goods', sell: 360, energy: 28, desc: 'Soft white cheese made from carabao milk.' },
    // the Jam Maker
    grape_jelly: { name: 'Grape Jelly', kind: 'goods', sell: 95, energy: 16, desc: 'Purple grape jelly.' },
    cranberry_sauce: { name: 'Cranberry Sauce', kind: 'goods', sell: 70, energy: 14, desc: 'Tart and sweet.' },
    apple_jam: { name: 'Apple Jam', kind: 'goods', sell: 85, energy: 16, desc: 'Apples cooked down with cinnamon.' },
    marmalade: { name: 'Orange Marmalade', kind: 'goods', sell: 100, energy: 16, desc: 'Bright orange marmalade.' },
    mango_jam: { name: 'Mango Jam', kind: 'goods', sell: 120, energy: 18, desc: 'Golden mango jam.' },
    peach_jam: { name: 'Peach Preserves', kind: 'goods', sell: 105, energy: 18, desc: 'Peaches in syrup.' },
  };
  Object.keys(GOODS).forEach(function (id) {
    if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id);
    GOODS[id].icon = id;
  });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  Object.keys(GOODS).forEach(function (id) {
    GOODS[id].icon = C.ICON[GOODS[id].icon];
    C.ITEMS[id] = GOODS[id];
  });
  // Hana sells these for 60G and 320G: yours sell for less, even on a high shelf or in an order (1.5x)
  C.ITEMS.bread.sell = 38;
  C.ITEMS.cake.sell = 210;

  // ---------- wheat: a quick crop for most of the year ----------
  C.CROPS.wheat = { mins: 20, item: 'wheat', art: C.CROP_KEYS.length, seasons: ['spring', 'summer', 'fall'], plant: 'stalk', shape: 'grain', color: '#f2c94c', color2: '#c8962a' };
  C.CROP_KEYS.push('wheat');
  C.CROP_WITHERED = 2 + C.CROP_KEYS.length * 2;
  C.SHOP_STOCK.push('seed_wheat');

  // ---------- workshops ----------
  // Each makes one thing at a time, in real minutes; up to `slots` jobs wait in line (finished ones too, until you
  // collect them). needs: [item or food group, how many].
  C.WORKSHOPS = {
    bakery: {
      name: 'Bakery', slots: 3, desc: 'Bakes bread, pandesal and cakes from wheat.',
      recipes: [
        { out: 'bread', mins: 30, needs: [['wheat', 3]] },
        { out: 'pandesal', mins: 45, needs: [['wheat', 3], ['egg', 1]] },
        { out: 'cake', mins: 120, needs: [['wheat', 2], ['strawberry', 3], ['egg', 1]] },
      ],
    },
    dairy: {
      name: 'Dairy', slots: 3, desc: 'Turns milk into cream, butter and cheese.',
      recipes: [
        { out: 'cream', mins: 20, needs: [['milk', 1]] },
        { out: 'butter', mins: 45, needs: [['milk', 2]] },
        { out: 'cheese', mins: 90, needs: [['milk', 3]] },
        { out: 'kesong_puti', mins: 120, needs: [['carabao_milk', 2]] },
      ],
    },
    jam_maker: {
      name: 'Jam Maker', slots: 3, desc: 'Makes jams and jellies from fruit and berries.',
      recipes: [
        { out: 'cranberry_sauce', mins: 45, needs: [['cranberry', 3]] },
        { out: 'grape_jelly', mins: 60, needs: [['grapes', 2]] },
        { out: 'apple_jam', mins: 60, needs: [['apple', 3]] },
        { out: 'marmalade', mins: 60, needs: [['orange', 3]] },
        { out: 'peach_jam', mins: 60, needs: [['peach', 3]] },
        { out: 'mango_jam', mins: 75, needs: [['mango', 3]] },
      ],
    },
  };
  C.WORKSHOP_KEYS = ['bakery', 'dairy', 'jam_maker']; // stable order, used by the save format
  // what's made in a workshop, by item
  C.MADE_IN = {};
  C.WORKSHOP_KEYS.forEach(function (k) { C.WORKSHOPS[k].recipes.forEach(function (r) { C.MADE_IN[r.out] = k; }); });

  // ---------- fruit trees: n fruit every `hours`, in their two seasons ----------
  C.FRUIT_TREES = {
    apple_tree: { fruit: 'apple', n: 3, hours: 6, seasons: ['fall', 'winter'] },
    orange_tree: { fruit: 'orange', n: 3, hours: 8, seasons: ['winter', 'spring'] },
    mango_tree: { fruit: 'mango', n: 3, hours: 12, seasons: ['spring', 'summer'] },
    peach_tree: { fruit: 'peach', n: 3, hours: 10, seasons: ['summer', 'fall'] },
  };

  // ---------- more land: field plots, each dearer than the last ----------
  C.PLOTS = { max: 6, price: 1500, step: 1500 }; // the 1st costs 1,500G, the 2nd 3,000G...

  // ---------- the new yard pieces (appended: the save keeps a piece's place in this list) ----------
  // farm2: drawn by tools/art/farm2.js (not part of the garden picture's grid)
  var NEW = [
    { key: 'bakery', name: 'Bakery', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: 2500, beauty: 4, farm2: true, one: true, what: 'a small red-roofed farm bakery hut with a brick oven chimney and a loaf on the sign' },
    { key: 'dairy', name: 'Dairy', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: 4000, beauty: 4, farm2: true, one: true, what: 'a small white and blue farm dairy hut with a butter churn and a milk can by the door' },
    { key: 'jam_maker', name: 'Jam Maker', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: 3500, beauty: 4, farm2: true, one: true, what: 'a small wooden farm hut with a copper jam pot on a stove and jars on a shelf' },
    { key: 'orange_tree', name: 'Orange Tree', kind: 'prop', cat: 'orchard', w: 2, h: 3, foot: 1, price: 1000, beauty: 12, farm2: true, what: 'a round leafy orange tree with bright oranges' },
    { key: 'mango_tree', name: 'Mango Tree', kind: 'prop', cat: 'orchard', w: 2, h: 3, foot: 1, price: 1400, beauty: 12, farm2: true, what: 'a tall broad mango tree with long dark leaves and golden mangoes' },
    { key: 'peach_tree', name: 'Peach Tree', kind: 'prop', cat: 'orchard', w: 2, h: 3, foot: 1, price: 1200, beauty: 12, farm2: true, what: 'a small peach tree with soft green leaves and pink-orange peaches' },
    { key: 'farm_plot', name: 'Field Plot', kind: 'plot', cat: 'land', w: 3, h: 3, foot: 0, price: C.PLOTS.price, beauty: 0, farm2: true, what: 'a square patch of dark tilled farm soil edged with a low wooden border' },
  ];
  NEW.forEach(function (t) {
    t.w = t.w || 1;
    t.h = t.h || 1;
    t.foot = t.foot == null ? 1 : t.foot;
    O.index[t.key] = O.types.length;
    O.types.push(t);
  });
  O.types[O.index.apple_tree].cat = 'orchard'; // the apple tree you could already buy fruits now
  O.types[O.index.apple_tree].price = 800;
  // The owner's sharper pictures (29 Oct 2026), one each instead of a frame of the yard sheet (the sheet keeps its
  // layout). A fruit tree also has a <hd>_bare picture, shown while it has no ripe fruit (19k-farm2.js).
  [['bakery', 'ws_bakery'], ['dairy', 'ws_dairy'], ['jam_maker', 'ws_jam_maker'], ['farm_plot', 'ws_farm_plot'], ['apple_tree', 'tree_apple'],
    ['orange_tree', 'tree_orange'], ['mango_tree', 'tree_mango'], ['peach_tree', 'tree_peach']].forEach(function (p) { O.types[O.index[p[0]]].hd = p[1]; });
  O.cats.push(
    ['workshops', 'Workshops', 'A Bakery, a Dairy and a Jam Maker: they make goods while you play (or sleep).'],
    ['orchard', 'Fruit trees', 'Apple, orange, mango and peach trees. Each fruits in two seasons.'],
    ['land', 'More land', 'Field plots for your yard: more room to grow crops.']
  );

  // ---------- crop mastery: harvest a crop this many times for a star; each star gives a chance of one more ----------
  C.MASTERY = { needs: [50, 200, 500], extra: [0.1, 0.2, 0.3], names: ['Bronze', 'Silver', 'Gold'] };

  // ---------- helping a friend's farm (online): water their growing crops on a visit ----------
  C.HELP = { tiles: 5, gold: 20 }; // per friend per day: up to 5 tiles, 20G for each

  // ---------- the collection book (appended: saved as a bitset in this order) ----------
  C.COLLECTION.push('wheat', 'apple', 'orange', 'mango', 'peach', 'bread', 'pandesal', 'cake', 'cream', 'butter', 'cheese', 'kesong_puti',
    'grape_jelly', 'cranberry_sauce', 'apple_jam', 'marmalade', 'peach_jam', 'mango_jam');

  // ---------- tips: shown once ----------
  C.TIPS.push(
    { key: 'fruit', text: 'FRUIT: eat it for energy, sell it, or make jam in a Jam Maker. Each tree fruits in two seasons.' },
    { key: 'goods', text: 'GOODS: made in your workshops. They sell for much more than what went into them.' },
    { key: 'farm2', text: 'NEW ON YOUR FARM' }, // the "new on your farm" page, shown once
    { key: 'chat', text: 'CHAT: tap the speech bubble on the right to say something. It pops up over your farmer for everyone here.' },
    { key: 'farmer_name', text: 'NAME YOUR FARMER' } // a farm from before asks once (19n-name.js)
  );

  // ---------- villagers who like the new goods ----------
  [['hollis', 'likes', 'cheese'], ['rosa', 'loves', 'cheese'], ['lily', 'likes', 'apple_jam'], ['bram', 'likes', 'pandesal'], ['mira', 'loves', 'mango'],
    ['leo', 'likes', 'peach'], ['ivy', 'likes', 'cream']].forEach(function (e) {
    var v = C.VILLAGERS[e[0]];
    if (v && v[e[1]] && v[e[1]].indexOf(e[2]) < 0) v[e[1]].push(e[2]);
  });
})(window.Farm = window.Farm || {});
