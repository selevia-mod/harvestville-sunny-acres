// The Wild Lands (owner, 30 Oct 2026): hunting places past the town, each with a few wild animals that roam the map
// like real life. Shy ones (labuyo, rabbit, deer) run from you; a boar or a wolf charges when you come too close. Hit
// one with arrows from the Bow and it leaves meat and the like on the ground (no blood: "like any other simple game").
// Pulag Grassland is open from the start; Makiling Forest after your first 10 hunts. Kanor the hunter sells the Bow,
// arrows and bait at his Lodge in Pulag, buys what you bring back, has a request each day and makes trophies for your
// house from rare drops. Every animal has its own size: your biggest of each goes in the Hunter's Book, which friends
// can see. Which animals are out changes with the hour, the weather and the season, and now and then a rare one is
// about (the same for everyone: a White Stag in Pulag, a Golden Boar in Makiling). Magayon Peaks (bear, mammoth) comes later.
// Loaded after 00-workshop.js: everything is appended (icons after the old ones), so older saves keep working.
// Rules in 01-logicD.js, the world side in 19v-wild.js.
(function (F) {
  'use strict';
  var C = F.Config;

  C.WILD = {
    order: ['rabbit', 'labuyo', 'deer', 'boar', 'wolf', 'whitedeer', 'goldboar'], // rows of assets/wild.png (12 frames each); appended only (the save)
    // px = its walking-left frame's width in assets/wild.png (tools/art/wild3q-import.js prints it); w = that width on
    // the map, in tiles; hp = arrows to bring it
    // down (a Silver or Gold Bow hits twice as hard); run = tiles a second when it runs; shy = it runs when you come
    // this close (tiles; walking slowly lets you get nearer); hop = how high it bounces as it goes (tiles; the others
    // keep their feet down); ground = its run stays on the ground (no leaps); angry = it charges when you come this close, and a
    // charge that reaches you costs `hit` energy. kg = an average one's weight (Hunter's Book). rare = no more than
    // one about, for its `when: 'rare'` time. drops: [item, how many, chance].
    animals: {
      rabbit: { name: 'Rabbit', px: 140, w: 0.75, hop: 0.14, kg: 2, hp: 1, walk: 0.7, run: 4.2, shy: 3.2, drops: [['meat_rabbit', 1, 1], ['fur_rabbit', 1, 0.6]] },
      labuyo: { name: 'Labuyo', px: 165, w: 0.9, kg: 1.4, hp: 1, walk: 0.6, run: 4.6, shy: 2.8, flies: true, drops: [['meat_labuyo', 1, 1], ['feather_labuyo', 1, 0.7]] },
      deer: { name: 'Deer', px: 179, w: 1.6, kg: 60, hp: 2, walk: 0.8, run: 4.4, shy: 4.2, drops: [['venison', 2, 1], ['antler', 1, 0.5]] },
      boar: { name: 'Wild Boar', px: 178, w: 1.4, ground: true, kg: 90, hp: 3, walk: 0.7, run: 3.4, angry: 2.6, hit: 8, drops: [['meat_boar', 2, 1], ['tusk', 1, 0.5]] },
      wolf: { name: 'Wolf', px: 158, w: 1.5, kg: 40, hp: 3, walk: 0.9, run: 4.0, angry: 4, hit: 10, night: true, drops: [['pelt_wolf', 1, 1], ['fang_wolf', 1, 0.6]] },
      whitedeer: { name: 'White Stag', px: 179, w: 1.7, kg: 75, hp: 3, walk: 0.8, run: 5.4, shy: 6, rare: true, respawn: 120, drops: [['venison', 3, 1], ['white_antler', 1, 1]] },
      goldboar: { name: 'Golden Boar', px: 178, w: 1.6, ground: true, kg: 120, hp: 6, walk: 0.7, run: 3.8, angry: 3.2, hit: 12, rare: true, respawn: 120, drops: [['meat_boar', 3, 1], ['gold_tusk', 1, 1]] },
    },
    // the places: how many of each animal roam there, and who else comes out `when` it is dawn, dusk, rain, fall or a
    // rare time (appended only: an animal's place in this list is its slot in the save)
    areas: {
      pulag: { name: 'Pulag Grassland', animals: { labuyo: 3, rabbit: 3, deer: 2 },
        extra: [{ kind: 'rabbit', n: 2, when: 'dawn' }, { kind: 'deer', n: 1, when: 'dusk' }, { kind: 'deer', n: 2, when: 'rain' }, { kind: 'whitedeer', n: 1, when: 'rare' }] },
      makiling: { name: 'Makiling Forest', animals: { deer: 2, boar: 3, wolf: 2 }, unlock: 10,
        extra: [{ kind: 'boar', n: 2, when: 'rain' }, { kind: 'boar', n: 1, when: 'fall' }, { kind: 'deer', n: 1, when: 'dusk' }, { kind: 'goldboar', n: 1, when: 'rare' }] },
    },
    respawn: 30, // minutes until a hunted animal is back
    arrive: [45000, 90000], // ms between new animals walking in while you are there, if any are due
    rareOdds: 0.1, // the chance, for each 2 hours of each day, that a place has its rare animal (the same for everyone)
    giant: { odds: 0.08, size: [1.35, 1.5] }, // 1 in 12 is a giant; the rest are 0.8 to 1.2 times the usual size
    nightFrom: 18 * 60, // wolves come out from 6 PM to 6 AM
    nightTo: 6 * 60,
    shotEnergy: 2,
    // the Bow, by level (Basic, Copper, Silver, Gold): how far it shoots (tiles) and how hard it hits
    bow: { price: 800, range: [6, 7, 8, 9], damage: [1, 1, 2, 2],
      upgrades: [{ gold: 2000, ore: 'ore_copper', n: 5 }, { gold: 6000, ore: 'ore_silver', n: 5 }, { gold: 15000, ore: 'ore_gold', n: 5 }] },
    arrowPack: 10, // arrows bought at a time
    baitMins: 1, // how long an animal eats bait, in minutes
    // Kanor's request of the day (item, how many); it pays jobPay times what he would give for them. after = needs Makiling
    jobs: [['fur_rabbit', 3], ['feather_labuyo', 3], ['meat_rabbit', 4], ['meat_labuyo', 4], ['venison', 4], ['antler', 2],
      ['meat_boar', 4, 1], ['tusk', 2, 1], ['pelt_wolf', 2, 1], ['fang_wolf', 3, 1]],
    jobPay: 2.5,
    // Trophies Kanor makes for your house (C.HOME.types), from what you bring him
    trophies: [
      { type: 'trophy_antler', needs: [['antler', 3]], gold: 500 },
      { type: 'trophy_tusk', needs: [['tusk', 3]], gold: 800 },
      { type: 'wolf_rug', needs: [['pelt_wolf', 3], ['fang_wolf', 2]], gold: 1000 },
      { type: 'trophy_stag', needs: [['white_antler', 1]], gold: 2000 },
      { type: 'trophy_goldboar', needs: [['gold_tusk', 1]], gold: 2500 },
    ],
  };

  // ---------- new items (icons appended to the items sheet: tools/art/wild-import.js) ----------
  var ITEMS = {
    bow: { name: 'Bow', kind: 'tool', tool: 'bow', desc: 'Hunt in Pulag Grassland and Makiling Forest. Hold it, face an animal and shoot. Needs arrows.' },
    arrows: { name: 'Arrows', kind: 'gear', price: 60, desc: 'For the Bow. Kanor sells them by ten.' },
    bait: { name: 'Berry Bait', kind: 'gear', price: 40, desc: 'Put it down: a shy animal nearby comes to eat and stays still a while.' },
    meat_labuyo: { name: 'Labuyo Meat', kind: 'meat', sell: 24, desc: 'Wild chicken. Cook it into Labuyo Tinola.' },
    meat_rabbit: { name: 'Rabbit Meat', kind: 'meat', sell: 20, desc: 'Lean rabbit meat. Cook it into Rabbit Stew.' },
    venison: { name: 'Venison', kind: 'meat', sell: 45, desc: 'Deer meat. Cook it into Venison Tapa.' },
    meat_boar: { name: 'Boar Meat', kind: 'meat', sell: 60, desc: 'Wild boar (baboy-ramo). Cook it into Boar Adobo.' },
    feather_labuyo: { name: 'Labuyo Feather', kind: 'hunt', sell: 15, desc: 'A long green-black tail feather.' },
    fur_rabbit: { name: 'Rabbit Fur', kind: 'hunt', sell: 30, desc: 'Soft brown fur.' },
    antler: { name: 'Deer Antler', kind: 'hunt', sell: 70, desc: 'A small branched antler.' },
    tusk: { name: 'Boar Tusk', kind: 'hunt', sell: 80, desc: 'A curved white tusk.' },
    pelt_wolf: { name: 'Wolf Pelt', kind: 'hunt', sell: 130, desc: 'A thick grey pelt.' },
    fang_wolf: { name: 'Wolf Fang', kind: 'hunt', sell: 90, desc: 'A long white fang.' },
    tinola: { name: 'Labuyo Tinola', kind: 'dish', energy: 60, sell: 90, desc: 'Ginger chicken soup with green papaya.' },
    rabbit_stew: { name: 'Rabbit Stew', kind: 'dish', energy: 55, sell: 85, desc: 'A hearty stew with carrots and potatoes.' },
    venison_tapa: { name: 'Venison Tapa', kind: 'dish', energy: 75, sell: 130, desc: 'Cured venison with egg and garlic rice.' },
    boar_adobo: { name: 'Boar Adobo', kind: 'dish', energy: 85, sell: 150, desc: 'Boar meat in soy, vinegar and garlic, with rice.' },
    white_antler: { name: 'White Antler', kind: 'hunt', sell: 600, desc: 'From the White Stag. Kanor can make a trophy of it.' },
    gold_tusk: { name: 'Golden Tusk', kind: 'hunt', sell: 800, desc: 'From the Golden Boar. Kanor can make a trophy of it.' },
    inihaw: { name: 'Inihaw Skewers', kind: 'dish', energy: 50, sell: 70, desc: 'Grilled meat on sticks.' },
  };
  var ICONS = ['bow', 'bow_1', 'bow_2', 'bow_3', 'arrows', 'bait', 'meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar',
    'feather_labuyo', 'fur_rabbit', 'antler', 'tusk', 'pelt_wolf', 'fang_wolf', 'tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw', 'white_antler', 'gold_tusk'];
  ICONS.forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  Object.keys(ITEMS).forEach(function (id) {
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
  });

  // ---------- cooking (the kitchen) ----------
  C.FOOD_GROUPS.meat = ['meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar'];
  C.RECIPES.push(
    { dish: 'tinola', needs: ['meat_labuyo', 'ginger'] },
    { dish: 'rabbit_stew', needs: ['meat_rabbit', 'carrot', 'potato'] },
    { dish: 'venison_tapa', needs: ['venison', 'rice', 'egg'] },
    { dish: 'boar_adobo', needs: ['meat_boar', 'garlic', 'rice'] },
    { dish: 'inihaw', needs: ['meat', 'onion'] }
  );

  // the way out of each place towards the others (the goal arrow follows these: C.ROUTES)
  C.ROUTES.pulag = { farm: 'road_east', house: 'road_east', town: 'road_east', mine: 'road_east', makiling: 'trail_north' };
  C.ROUTES.makiling = { farm: 'trail_south', house: 'trail_south', town: 'trail_south', mine: 'trail_south', pulag: 'trail_south' };
  ['farm', 'house', 'mine'].forEach(function (m) { C.ROUTES[m].pulag = C.ROUTES[m].makiling = C.ROUTES[m].town; });
  C.ROUTES.town.pulag = C.ROUTES.town.makiling = 'road_west';

  // Kanor the hunter, at his Lodge in Pulag
  C.KANOR = { name: 'Kanor', open: 6 * 60, close: 22 * 60,
    hello: "Magandang araw! I'm Kanor. I look after these grasslands. Hunt what you need and the herds stay healthy. Need a bow?" };
})(window.Farm = window.Farm || {});
