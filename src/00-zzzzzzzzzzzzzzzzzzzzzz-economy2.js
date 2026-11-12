// Farm economy v2, parts 2, 3 and 4 (owner, 10-11 Nov 2026; docs/farm-economy-v2.md sections 2-5), the content. Rules in
// 01-logicZZZZZZZZZZZZZZZZZ-economy2.js; the farm and the panels in 19zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-economy2.js.
// Loaded after every other content file: the new items' icons, the new yard pieces and the Mixer's workshop number go at
// the very end of their lists (all three are saved by their place in the list: append only).
//  - Part 2: raiders eat crops (training, levels), raids pay in crops (into the Silo), and the Silo itself.
//  - Part 3: the Mixer (a workshop like the Bakery) makes Farm Cement, Rope, Sili Powder and Beeswax; defenses and Raid
//    Camp levels need them; the horse's Saddlebags need Rope.
//  - Part 4: crop potions from the Kitchen; shots in the five new hunting places cost more energy.
// Owner rules since the doc (11 Nov 2026): raids are just for fun, the farm raided loses nothing; the crops a raider wins
// are the battle copy's ripe crops it carried home. Every number not in the doc: "decided by me, owner can change".
(function (F) {
  'use strict';
  var C = F.Config, R = C.FRAID, O = C.OUTDOOR;
  var addIcon = function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); C.ICON[id] = C.ICON_ORDER.indexOf(id); return C.ICON[id]; };

  // ---------- part 2: raiders eat crops ----------
  // Training costs crops as well as Gold (owner, 11 Nov 2026: "about one crop a raider, the big ones a little more"); only
  // planted farm crops, from the Silo first, then the bag.
  var FOOD = { goat: ['cabbage', 1], crow: ['wheat', 1], cat: ['peanut', 2], monkey: ['banana', 2], rooster: ['rice', 2], bayawak: ['taro', 2],
    carabao: ['corn', 3], boar: ['cassava', 3] };
  Object.keys(FOOD).forEach(function (k) { R.raiders[k].crop = FOOD[k]; });
  // a raider's level-up also asks for its own food: x10, x20, x40, x60 (to level 2, 3, 4, 5; owner)
  R.level.crops = [0, 10, 20, 40, 60];

  // ---------- part 2: the Silo ----------
  // Room for crops only: the Raid Camp, the Mixer, the Kitchen (and the other workshops) take from it directly, and won
  // raids deliver into it. 300 at first (owner); each upgrade more room for Gold, lumber and Farm Cement (decided by me).
  C.SILO = {
    levels: [
      { cap: 300 },
      { cap: 450, gold: 4000, lumber: 60, cement: 3 },
      { cap: 650, gold: 10000, lumber: 120, cement: 6 },
      { cap: 900, gold: 22000, lumber: 200, cement: 10 },
      { cap: 1200, gold: 40000, lumber: 300, cement: 16 },
    ],
    at: [21, 4], // a new farm's Silo (top-left tile), right of the pond by the house; an older farm: there or the nearest free spot
    take: 10, // the Silo's Take button
  };

  // ---------- part 3: the Mixer's materials ----------
  // (sell: a little over what their crops sell for, like the Bakery's goods; decided by me)
  var MATS = {
    farm_cement: { name: 'Farm Cement', sell: 120, desc: 'A sack of farm cement from the Mixer. Levels up Watchtowers, Mud Pits, Strong Fences, the Raid Camp and the Silo.' },
    rope: { name: 'Rope', sell: 170, desc: 'A coil of strong rope from the Mixer. Levels up the Raid Camp; the horse\'s Saddlebags need it.' },
    sili_powder: { name: 'Sili Powder', sell: 65, desc: 'Hot red sili powder from the Mixer. Levels up Sili Patches and Sprinkler Blasters.' },
    beeswax: { name: 'Beeswax', sell: 260, desc: 'A golden block of beeswax from the Mixer. Levels up Bee Boxes.' },
  };
  // the game has no farm honey: the Wild Honey of the Sierra Madre stands in (decided by me, owner can change)
  C.WORKSHOPS.mixer = {
    name: 'Mixer', slots: 3, desc: 'Mixes crops into building materials: Farm Cement, Rope, Sili Powder and Beeswax.',
    recipes: [
      { out: 'farm_cement', mins: 60, needs: [['corn', 3], ['wheat', 3], ['carrot', 3]] },
      { out: 'rope', mins: 45, needs: [['cotton', 3], ['sugarcane', 2]] },
      { out: 'sili_powder', mins: 45, needs: [['chili', 3], ['garlic', 2]] },
      { out: 'beeswax', mins: 60, needs: [['sunflower', 3], ['wild_honey', 1]] },
    ],
  };
  C.WORKSHOP_KEYS.push('mixer'); // (appended: the save keeps a workshop's place in this list)
  C.WORKSHOPS.mixer.recipes.forEach(function (r) { C.MADE_IN[r.out] = 'mixer'; });
  // the materials each defense levels with (owner's table), and how many a level: to level 2, 3, 4, 5 (decided by me)
  R.defMats = { tower: 'farm_cement', mudpit: 'farm_cement', fence: 'farm_cement', sili: 'sili_powder', sprinkler: 'sili_powder', beebox: 'beeswax' };
  R.defLevel.mats = [0, 2, 4, 7, 10];
  // the Raid Camp's levels 2-7 need Farm Cement and Rope too (rising; decided by me). A level already reached stays.
  var CAMP = [[0, 0], [3, 1], [5, 2], [8, 4], [12, 6], [16, 8], [20, 10]];
  R.camp.levels.forEach(function (lv, i) { if (i) { lv.cement = CAMP[i][0]; lv.rope = CAMP[i][1]; } });
  // the horse's Saddlebags: on now (they need Rope, part 5's note)
  delete C.HORSE_OUT.gear.saddlebags.soon;

  // ---------- part 4: crop potions (the Kitchen) ----------
  // potion: the power it gives for C.POTION_MINS minutes (the same powers as the dishes': 'charge' a charge hurts half,
  // 'walk' 20% faster; 'shots' is new: shots cost no energy). They last beside a dish's power, each its own clock.
  C.POTION_MINS = 10;
  // (owner, 13 Nov 2026: Hunter's Coffee 5 minutes; another one resets them, never adds: the Tower's food spec)
  C.POTION_MINS_OF = { shots: 5 };
  var mins = function (p) { return (p.potion && C.POTION_MINS_OF[p.potion]) || C.POTION_MINS; };
  var POTIONS = {
    ginger_tonic: { name: 'Ginger Tonic', energy: 50, sell: 190, needs: ['ginger', 'wild_honey'], desc: 'Ginger and honey: +50 energy.' },
    ampalaya_brew: { name: 'Ampalaya Brew', energy: 8, sell: 60, needs: ['bitter_gourd', 'bitter_gourd', 'ginger'], potion: 'charge', text: 'a charge hurts half' },
    pineapple_juice: { name: 'Pineapple Juice', energy: 12, sell: 65, needs: ['pineapple', 'pineapple'], potion: 'walk', text: 'you walk 20% faster' },
    hunters_coffee: { name: 'Hunter\'s Coffee', energy: 12, sell: 110, needs: ['coffee', 'coffee', 'sugarcane'], potion: 'shots', text: 'shots cost no energy' },
  };
  C.POTIONS = {}; // id -> { key, text }
  C.POTION_KEYS = ['charge', 'walk', 'shots']; // (the save keeps their clocks in this order: append only)
  C.DRINKS = Object.keys(POTIONS); // (drunk, not eaten)
  Object.keys(POTIONS).forEach(function (id) {
    var p = POTIONS[id];
    C.ITEMS[id] = { name: p.name, kind: 'dish', energy: p.energy, sell: p.sell, icon: addIcon(id),
      desc: p.desc || 'Drink it: for ' + mins(p) + ' minutes, ' + p.text + '.' };
    C.RECIPES.push({ dish: id, needs: p.needs });
    if (p.potion) C.POTIONS[id] = { key: p.potion, text: p.text };
  });
  // Shots in the five new hunting places cost 3-4 energy (owner); the Wild Lands keep their 2 (C.WILD.shotEnergy). The
  // harder places cost more (decided by me). A place's cave costs what the place does.
  C.SHOT_ENERGY = { banaue: 3, bohol: 3, taal: 3, sierra: 4, palawan: 4 };

  // the materials' items (icons after the potions': the cells of art-src/icons/economy-1.png, tools/art/economy-import.js)
  Object.keys(MATS).forEach(function (id) { C.ITEMS[id] = { name: MATS[id].name, kind: 'goods', sell: MATS[id].sell, icon: addIcon(id), desc: MATS[id].desc }; });
  C.ECON2_ICONS = Object.keys(POTIONS).concat(Object.keys(MATS)); // (the tests: the icons this part appends, in order)

  // ---------- the two buildings ----------
  // Standing pictures, solid only where the picture stands (as the round-2 barn): the Mixer is bought at Mira's
  // (Workshops, one per farm); the Silo comes with every farm (one per farm, free, moved like the other buildings).
  // Until the owner's pictures come (~/Downloads/economy-mixer-silo/PROMPTS.md: assets/props/mixer.png, silo.png), the
  // farm draws stand-ins (19zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-economy2.js).
  var NEW = [
    { key: 'mixer', name: 'Mixer', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: 3500, beauty: 4, one: true, prop: 'mixer',
      mask: ['...', '###', '###'], what: 'a farm workshop hut with a big mixing barrel and a paddle' },
    { key: 'silo', name: 'Silo', kind: 'prop', cat: 'none', w: 3, h: 4, foot: 2, price: 0, beauty: 0, one: true, prop: 'silo', building: 'silo',
      mask: ['...', '...', '###', '###'], what: 'a tall round farm silo with a red dome' },
  ];
  NEW.forEach(function (t) { if (O.index[t.key] == null) { O.index[t.key] = O.types.length; O.types.push(t); } });
  O.cats.filter(function (c) { return c[0] === 'workshops'; })[0][2] = 'A Bakery, a Dairy, a Jam Maker, a Tannery and a Mixer make goods while you play (or sleep). The Raid Camp trains raiders.';
})(window.Farm = window.Farm || {});
