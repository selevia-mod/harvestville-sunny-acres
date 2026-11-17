// Manila's first hunting ground: THE OPEN PLAINS, the Rifle's ground, and its 50-floor cave, Sarangay's Halls (owner,
// 18 Nov 2026; design docs/manila-proposals.md 3a, with the owner's decisions over it: a shot costs the Bow's energy, the
// difficulty is in the animals; opens at 30 hunts; the horse rides free, 8 hearts here, 10 and the Lantern Bridle in the
// cave; the Plainsrunner set about 10 times the first note; the Tamaraw Calf carries 6 more things in your bag).
// The valley road from Willowbrook runs across it (town east end -> the Plains -> Manila's Plains Gate), with the Plains
// Halt and its water trough on the way. Ka Pedring the herdsman looks after the last wild Tamaraw herd in his fenced
// meadow: the grown Tamaraw are never hunted (scenery), only the calf comes home with you, as a friend.
// A place like the five before it (F.addPlace): its maps are built in code at load (L.plainsMap, L.plainsCaveMap: the
// page is nearly full), its pictures are the 'plains' download pack (tools/manila/plains-import.js), drawn stand-ins until
// then (another animal's row of the wild sheet, tinted; the icons copied from items the game has).
// Rules 01-logicZZZZZZZZZZZZZZZZZZZZZZZZ-plains.js; the world 19zzz...z-plains.js. Saves: everything by the place's id
// (pl.plains, pk, pm: 01-logicZZZZ-places.js); items appended; no new map index.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;
  if (!C.MANILA || !F.addPlace) return;

  // ---------- the icons: painted into frames of the items texture past the sheet (as the weapons', the Tower's) ----------
  // The owner's icons_plains.png (16, in its order) and row 1 of icons_manila_gear.png (the Plainsrunner set) come in the
  // pack as one sheet, plains_icons, 8 a row of 128; until then each frame is the stand-in icon below, copied.
  C.PLAINS_ICON_BASE = 2300;
  C.PLAINS_ICONS = ['meat_pugo', 'egg_pugo', 'feather_tikling', 'venison_batik', 'antler_batik', 'feather_kuwago', 'toro_hide', 'toro_horn',
    'comet_feather', 'lampong_hat', 'shell_salagubang', 'sarangay_jewel', 'arimaonga_mane', 'kwek_kwek', 'plains_seeds', 'cogon_bundle',
    'plains_hat', 'plains_vest', 'plains_boots', 'plains_charm'];
  C.PLAINS_STAND = { meat_pugo: 'meat_labuyo', egg_pugo: 'egg', feather_tikling: 'feather_labuyo', venison_batik: 'venison', antler_batik: 'antler',
    feather_kuwago: 'feather_labuyo', toro_hide: 'leather_thick', toro_horn: 'tusk', comet_feather: 'feather_labuyo', lampong_hat: 'gear_cloak',
    shell_salagubang: 'jade', sarangay_jewel: 'ruby', arimaonga_mane: 'fur_bear', kwek_kwek: 'cookie', plains_seeds: 'seed_wheat', cogon_bundle: 'lumber',
    plains_hat: 'gear_cloak', plains_vest: 'gear_cloak', plains_boots: 'gear_boots', plains_charm: 'gear_charm' };
  C.plainsIcon = function (name) { var i = C.PLAINS_ICONS.indexOf(name); return i < 0 ? -1 : C.PLAINS_ICON_BASE + i; };
  // (by name, so F.addPlace and the medals pick the painted frame; never in C.ICON_ORDER: the page's sheet does not grow)
  C.PLAINS_ICONS.forEach(function (n) { C.ICON[n] = C.plainsIcon(n); });

  // the Tamaraw Calf's skill: carry (owner, 18 Nov 2026, approved): 6 more bag slots while it walks with you
  C.COMPANION_SKILLS.carry = { name: 'Pack Calf', text: 'Carries your things: 6 more bag slots while it walks with you.', slots: 6 };

  var P = F.addPlace({
    id: 'plains', n: 21, name: 'The Open Plains', unlock: 30, map: 'plains', grass: 0, icon: 'comet_feather', jeep: 'from_town',
    pack: 'plains', artDir: 'manila/plains', noJeep: true, // (reached by the valley road and Manila's Plains Gate, not Kanor's Jeep)
    // its rows on the online server (Hunting now, Biggest catch, the Hall's first boss) wait for the owner's SQL:
    // node tools/places/server-rows.js plains prints them (supabase/farm_online_23.sql keeps the five places')
    serverLater: true,
    shut: 'The Open Plains open at 30 hunts',
    opened: 'THE OPEN PLAINS ARE OPEN\nKa Pedring: "30 hunts! The valley road to Manila now crosses my plains. Bring a Rifle, the animals see you from far off."',

    items: {
      meat_pugo: { name: 'Pugo Meat', kind: 'meat', sell: 20, desc: 'A little quail drumstick from the plains.' },
      egg_pugo: { name: 'Pugo Eggs', kind: 'hunt', sell: 25, desc: 'Three speckled quail eggs. Cook Kwek-Kwek with them.' },
      feather_tikling: { name: 'Tikling Feather', kind: 'hunt', sell: 45, desc: 'A black-and-white barred feather from the quick Tikling.' },
      venison_batik: { name: 'Batik Venison', kind: 'meat', sell: 70, desc: 'Lean meat from a Batik Deer.' },
      antler_batik: { name: 'Batik Antler', kind: 'hunt', sell: 110, desc: 'A small spotted antler. Kanor makes Rancher Boots with it.' },
      feather_kuwago: { name: 'Kuwago Feather', kind: 'hunt', sell: 60, desc: 'A soft golden owl feather, from the dusk.' },
      beef_toro: { name: 'Toro Beef', kind: 'meat', sell: 90, standIn: 'meat_boar', desc: 'A big cut from a Wild Toro.' },
      toro_hide: { name: 'Toro Hide', kind: 'hunt', sell: 120, desc: 'A thick reddish hide. Panday Lando wants it for the Copper Rifle.' },
      toro_horn: { name: 'Toro Horn', kind: 'hunt', sell: 150, desc: 'A short pale horn. Panday Lando wants it for the Silver Rifle.' },
      comet_feather: { name: 'Comet Feather', kind: 'hunt', sell: 900, desc: 'A glowing tail feather of the rare Bulalakaw, the comet bird.' },
      lampong_hat: { name: 'Lampong Hat', kind: 'hunt', sell: 140, desc: 'A tiny pointed hat a Lampong left behind when it ran off.' },
      shell_salagubang: { name: 'Salagubang Shell', kind: 'hunt', sell: 150, desc: 'A shiny green-gold beetle shell from Sarangay\'s Halls.' },
      sarangay_jewel: { name: 'Sarangay Jewel', kind: 'hunt', sell: 1800, desc: 'The red jewel a Sarangay guards. It gave it up, grumbling.' },
      arimaonga_mane: { name: 'Arimaonga Mane', kind: 'hunt', sell: 3000, desc: 'A tuft of the sun-maned Arimaonga\'s mane. It glows like sunrise.' },
      plains_seeds: { name: 'Plains Grass Seeds', kind: 'goods', sell: 50, desc: 'A bag of golden grass seed from a hidden chest. Horses love the smell.' },
      cogon_bundle: { name: 'Cogon Bundle', kind: 'goods', sell: 40, desc: 'Dry golden cogon grass, tied with string. Good for roofs.' },
      kwek_kwek: { name: 'Kwek-Kwek', kind: 'dish', sell: 260, energy: 70, desc: 'Quail eggs fried in bright orange batter, with a vinegar dip.' },
    },

    // Every creature is cute and kind; the bosses are grumpy, never wicked (owner). Harder than the notes (the owner: the
    // difficulty is in the animals, not in the energy a shot costs): about 1.5 times the notes' hits to bring one down.
    creatures: {
      // a flock of 3 (C.WILD `flock`: they come and go together, side by side, and run off together)
      pugo: { name: 'Pugo', sheet: 'wild_pugo', row: 0, sheetRow: 'labuyo', tint: 0xc8a070, px: 170, w: 0.6, kg: 0.2, hp: 2, walk: 0.6, run: 5, shy: 4.8, flies: true, flock: 3,
        drops: [['meat_pugo', 1, 1], ['egg_pugo', 2, 0.6]] },
      tikling: { name: 'Tikling', sheet: 'wild_tikling', row: 0, sheetRow: 'labuyo', tint: 0x9aa0a8, px: 148, w: 0.75, ground: true, kg: 0.35, hp: 3, walk: 0.7, run: 6.2, shy: 5.4,
        drops: [['feather_tikling', 1, 1], ['meat_pugo', 1, 0.4]] },
      // a herd of 3 in a line: the Moon Rifle's shot goes through one into the one behind
      batikdeer: { name: 'Batik Deer', sheet: 'wild_batikdeer', row: 0, sheetRow: 'deer', tint: 0xb07a4a, px: 148, w: 1.3, kg: 55, hp: 6, walk: 0.8, run: 5.2, shy: 6.5, flock: 3,
        drops: [['venison_batik', 2, 1], ['antler_batik', 1, 0.5]] },
      kuwago: { name: 'Kuwago', sheet: 'wild_kuwago', row: 0, sheetRow: 'labuyo', tint: 0xe0c080, px: 154, w: 0.9, kg: 0.5, hp: 3, walk: 0.5, run: 4.8, shy: 5, flies: true,
        drops: [['feather_kuwago', 1, 1]] },
      // it charges from far off: the Rifle (reach 4 to 8) can hit it before it starts
      toro: { name: 'Wild Toro', sheet: 'wild_toro', row: 0, sheetRow: 'boar', tint: 0xb0603a, px: 162, w: 1.9, ground: true, kg: 420, hp: 12, walk: 0.6, run: 4.6, angry: 4.5, hit: 16,
        drops: [['beef_toro', 2, 1], ['toro_hide', 1, 1], ['toro_horn', 1, 0.6]] },
      // the comet bird: only a sneaking Rifle reaches it
      bulalakaw: { name: 'Bulalakaw', sheet: 'wild_bulalakaw', row: 0, sheetRow: 'labuyo', tint: 0x6a8aff, px: 180, w: 1.2, kg: 3, hp: 8, walk: 0.6, run: 7.2, shy: 9, flies: true,
        rare: true, respawn: 120, drops: [['comet_feather', 1, 1]] },
      // the tame one: never a target (the grown Tamaraw in Ka Pedring's meadow are scenery, drawn by the world)
      tamaraw_calf: { name: 'Tamaraw Calf', sheet: 'wild_tamaraw', row: 0, sheetRow: 'deer', tint: 0x6a5a50, px: 194, w: 0.9, ground: true, kg: 60, hp: 1, walk: 0.5, run: 3.8, shy: 2.4, drops: [] },
    },
    animals: { pugo: 6, tikling: 4, batikdeer: 6, toro: 3 },
    extra: [{ kind: 'kuwago', n: 3, when: 'dusk' }, { kind: 'pugo', n: 3, when: 'dawn' }, { kind: 'toro', n: 2, when: 'rain' }, { kind: 'bulalakaw', n: 1, when: 'rare' }],

    // the Tamaraw Calf: planted oats, 10 feedings, it may run off; while it walks with you it carries 6 more things (carry)
    tame: { kind: 'tamaraw_calf', food: 'oats', feedings: 10, runOff: 0.25, back: 20, skill: 'carry' },

    // the Plainsrunner set (owner, 18 Nov 2026: about 10 times the first note, 30,000 to 60,000 Gold a piece, plus drops)
    gear: { name: 'Plainsrunner', pieces: {
      head: { id: 'plains_hat', name: 'Salakot Hat', standIn: 'gear_cloak', needs: [['feather_tikling', 10], ['feather_kuwago', 6], ['comet_feather', 1]], gold: 30000 },
      body: { id: 'plains_vest', name: 'Toro Vest', standIn: 'gear_cloak', needs: [['toro_hide', 10], ['toro_horn', 4], ['shell_salagubang', 6]], gold: 50000 },
      feet: { id: 'plains_boots', name: 'Rancher Boots', standIn: 'gear_boots', needs: [['toro_hide', 6], ['antler_batik', 8], ['lampong_hat', 4]], gold: 35000 },
      charm: { id: 'plains_charm', name: 'Comet Charm', standIn: 'gear_charm', needs: [['comet_feather', 3], ['sarangay_jewel', 2], ['arimaonga_mane', 1]], gold: 60000 },
    } },

    // 5 hidden chests (tiles of the built map, kept free: L.plainsMap)
    chests: [[4, 4], [24, 8], [47, 18], [6, 46], [27, 48]],
    chestLoot: [['bullets', 5, 1], ['cogon_bundle', 2, 1], ['plains_seeds', 1, 0.7], ['oats', 2, 0.5]],

    // Ka Pedring, the herdsman, by his hut at the meadow's gate: first visit, a few hunts, the guard, the boss
    npc: { engineGifts: true, name: 'Ka Pedring', look: 'hollis', sheet: 'npc_ka_pedring', at: [33, 33], lines: [
      { text: 'Magandang araw! I am Pedring. I keep the last wild Tamaraw herd here, in my meadow. We never hunt them. The little calf likes oats, though. Here, take some.', gift: [['oats', 5]] },
      { text: 'You hunt well! Out here the animals see you from far off: the Rifle reaches them. And the Wild Toro charges from four tiles: shoot it first. Take these bullets.', need: { hunts: 5 }, hint: 'Hunt here a few more times.', gift: [['bullets', 10]] },
      { text: 'You got past the Sarangay? It only guards its jewel, you know. It is grumpy, not bad. Here, cement for Panday Lando\'s Rifles.', need: { guard: 1 }, hint: "Beat the guard on floor 10 of Sarangay's Halls.", gift: [['farm_cement', 2]] },
      { text: 'The Arimaonga! It only wanted to see the sun up close. My lola fried these for the hero of the plains. Salamat!', need: { boss: 1 }, hint: "Beat the boss on floor 50 of Sarangay's Halls.", gift: [['kwek_kwek', 2]] },
    ] },

    dungeon: {
      key: 'plains_cave', name: "Sarangay's Halls", floors: 50, liftEvery: 10, guardFloor: 10, guardEvery: 10, guardHpPer: 0.5, bossFloor: 50,
      count: { base: 3, per: 10, max: 7 }, escort: 2,
      creatures: {
        // a little herder dwarf: it runs off (long halls: the Rifle again)
        lampong: { name: 'Lampong', sheet: 'wild_lampong', row: 0, sheetRow: 'sigbin', tint: 0xd8b080, px: 142, w: 0.9, ground: true, kg: 8, hp: 6, walk: 0.7, run: 5, shy: 3.6,
          drops: [['lampong_hat', 1, 1], ['cogon_bundle', 1, 0.3]] },
        // a big friendly June beetle: it charges
        salagubang: { name: 'Cave Salagubang', sheet: 'wild_salagubang', row: 0, sheetRow: 'sigbin', tint: 0x6ab060, px: 159, w: 1.1, ground: true, kg: 6, hp: 8, walk: 0.6, run: 4.2, angry: 3, hit: 13,
          drops: [['shell_salagubang', 1, 1]] },
        // the guard of every 10th floor: the bull-headed keeper of a jewel, proud and goofy
        sarangay: { name: 'Sarangay', sheet: 'wild_sarangay', row: 0, sheetRow: 'bungisngis', tint: 0xc07848, px: 145, w: 2.3, ground: true, kg: 700, hp: 32, walk: 0.7, run: 4, angry: 3.4, hit: 16, boss: true,
          drops: [['sarangay_jewel', 1, 1], ['toro_horn', 2, 1], ['cogon_bundle', 2, 0.6]] },
        // the floor 50 boss: the sun-maned lion of Maranao legend, big, fluffy and grumpy; soloable, more with friends
        arimaonga: { name: 'Arimaonga', sheet: 'wild_arimaonga', row: 0, sheetRow: 'bakunawa', tint: 0xffb040, px: 156, w: 3.4, ground: true, kg: 1500, hp: 50, hpEach: 18, minHits: 3,
          walk: 0.6, run: 3.6, angry: 4, hit: 20, boss: true, drops: [['arimaonga_mane', 2, 1], ['sarangay_jewel', 1, 1], ['comet_feather', 1, 0.2]] },
      },
      floorKinds: [['lampong', 1, 50], ['salagubang', 6, 50]],
      guard: 'sarangay', boss: 'arimaonga',
      // the boss's daily chest (stacks to 3)
      chest: [['arimaonga_mane', 1, 1], ['bullets', 20, 1], ['cogon_bundle', 3, 1], ['sarangay_jewel', 1, 0.25], ['plains_seeds', 2, 0.5]],
      // warm sandstone, an amber pool
      look: { floor: ['#3a2210', '#9a6a3a', '#e8c48a'], wall: ['#2a160a', '#8a5226', '#d89a5a'], top: ['#1a0e06', '#4a2a12', '#8a5226'], crust: ['#2a1608', '#5a3416', '#9a6230'] },
      lava: { rim: '#3a2208', hot: ['#fff0c0', '#f0c060', '#b07a20'], plate: ['rgba(120,80,20,0.85)', 'rgba(170,120,40,0.8)'], embers: false },
      bg: '#1a0e06', propTint: 0xe8b884, icon: 'sarangay_jewel',
      art: { mouth: 'props/plains_mouth', gate: 'props/plains_gate', cave: 'plains_cave' },
    },
  });

  // painted items, and the gear pieces' painted icons
  Object.keys(P.items).forEach(function (id) { if (C.PLAINS_ICONS.indexOf(id) >= 0) C.ITEMS[id].painted = true; });
  C.GEAR_SLOTS.forEach(function (slot) { var g = C.PLACE_GEAR['plains_' + slot]; if (g && g.art) g.icon = C.plainsIcon(g.art); });

  // the shy ones and the flocks: a new key, `flock: n` (that many come and go together, side by side)
  WI.flockGap = 1.1; // tiles between two of a flock

  // the local dish (C.RECIPES is a list by name), and its power: the shy plains animals notice you less
  C.RECIPES.push({ dish: 'kwek_kwek', needs: ['egg_pugo', 'wheat'] });
  if (C.DISH_POWERS) {
    C.DISH_POWERS.kwek_kwek = { key: 'sneak', text: 'shy animals notice you less' };
    C.ITEMS.kwek_kwek.desc += ' For ' + C.DISH_POWER_MINS + ' minutes, ' + C.DISH_POWERS.kwek_kwek.text + '.';
  }

  // ---------- the map's own things (L.plainsMap builds it; the world draws what the map cannot) ----------
  C.PLAINS = {
    W: 52, H: 52,
    road: { y: 25, h: 2 }, // the valley road, west (Willowbrook) to east (Manila's Plains Gate)
    halt: { box: [17, 22, 3, 3], trough: [21, 23], hitch: [16, 23] }, // the Plains Halt: the shelter, the trough (the horse drinks), a hitching post
    meadow: [36, 30, 12, 11], // Ka Pedring's fenced Tamaraw meadow [x, y, w, h], its gate on the left side, at gateY
    gateY: 34,
    hut: [30, 29, 3, 3], // his hut
    herd: 4, // grown Tamaraw in the meadow (scenery)
    pond: [7, 35, 6, 5],
    mesa: [42, 2, 8, 6], // the low mesa in the far north-east, the cave's door in it
    door: [45, 5], // the cave's door tile (dungeon_door)
    windmill: [11, 12],
    // the owner's 12 props (props_plains.png, props_plains_2.png, 3 x 2 each, in that order: tools/manila/plains-import.js)
    kinds: ['cogon', 'flattree', 'windmill', 'fence', 'boulder', 'haystack', 'halt', 'trough', 'hitch', 'hut', 'meadowgate', 'flowers'],
    trough: 'full', // the horse drinks at the trough: its stamina full at once (owner: "the horse drinks: instant stamina")
    tours: ['plains', 'armory'], // the first-time tours (C.TIPS: plains_tour, armory_tour)
  };

  // the owner's props over the map's stand-ins (src/19zzzzzzz-place-art.js), and its ground (the grass, the pond)
  C.PLACE_PROP_KINDS.plains = C.PLAINS.kinds;
  C.PLACE_PROP_SWAP.plains = { tall_grass: 'cogon', rainforest_tree: 'flattree', pine_tree: 'windmill', mossy_log: 'fence', boulder_moss: 'boulder',
    pumpkin_pile: 'haystack', trader_tent: 'halt', flowerbed: 'trough', lamp: 'hitch', shack: 'hut', flower_arch: 'meadowgate', wildflowers: 'flowers' };
  C.PLACE_GROUND.push('plains');

  // ---------- the Armory opens (owner, 18 Nov 2026): Panday Lando sells and upgrades the Rifle, the Javelin and the
  // Boomerang, sells bullets and javelins and mends boomerangs. Its "coming soon" goes; every other one stays. ----------
  C.MANILA.armory = { on: true, who: 'lando' };
  C.MANILA.buildings.forEach(function (b) {
    if (b.key === 'armory') b.text = "Panday Lando's Armory in the old fort: the Rifle, the Javelin and the Boomerang, bullets and javelins, and boomerang repairs.";
  });
  var lando = C.MANILA.people.lando;
  if (lando) {
    lando.lines = ['My Armory is open! The Rifle, the Javelin and the Boomerang. Step inside: tap my door.',
      'The Rifle reaches far: just right for the Open Plains. Bring me Toro Hide and I make it better.',
      'The Boomerang flies back to you. No arrows needed, but it wears out. Bring it to me before it breaks!'];
  }

  // the weapons work here (they work in every hunting place: C.WEAPONS_OLD_PLACES), and here they shine
  if (C.WEAPON_GROUNDS) C.WEAPON_GROUNDS.push('plains', 'plains_cave');
})(window.Farm = window.Farm || {});
