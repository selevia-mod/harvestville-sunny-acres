// Manila's second hunting ground: THE BAMBOO JUNGLE, the Javelin's ground, and its 50-floor cave, the Bamboo Hollows
// (owner, 18 Nov 2026; design docs/manila-proposals.md 3b, with the owner's decisions over it: a shot costs the Bow's
// energy, the difficulty is in the animals (about 1.5 times the notes' hits); opens at 70 hunts; the horse rides free,
// 8 hearts here, 10 and the Lantern Bridle in the cave; the Bamboo set about 10 times the first note; drops sell at the
// notes' prices; creatures cute, bosses grumpy, never wicked; the Bamboo Giant is our own).
// South of Manila: in by the city's Jungle Gate (the south edge of the turned-round city, 00-...-manila-flip.js), which
// opens at 70 hunts. Tight 2-tile trails between thick bamboo, two streams with stepping stones and a bamboo bridge, the
// waterfall pool in the middle, Diday's weaving hut by the gate, the cave's door in the far south.
// Two new rules (owner): TALL BAMBOO BLOCKS SHOTS LONGER THAN 4 TILES (your shot that would pass through a bamboo clump
// more than 4 tiles out stops at the clump: L.bambooStop), and `zigzag: true` (the Pilandok dodges side to side as it
// runs: L.zigzagTurn). The Baboy-damo go about in pairs (`flock: 2`, the Plains' key).
// A place like the Plains (F.addPlace): its maps built in code at load (L.jungleMap, L.jungleCaveMap), its pictures the
// 'jungle' download pack (tools/manila/plains-import.js jungle), drawn stand-ins until then. Rules
// 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZ-jungle.js; the world 19zzz...z-jungle.js. Saves: everything by the place's id (pl.jungle,
// pk, pm); items appended; no new key, no new map index.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  if (!M || !F.addPlace || !C.PLACES.plains) return;

  // ---------- the icons: painted into frames of the items texture past the sheet (as the Plains') ----------
  // The owner's icons_jungle.png (16, in its order) and row 2 of icons_manila_gear.png (the Bamboo set) come in the pack as
  // one sheet, jungle_icons, 8 a row of 128; until then each frame is the stand-in icon below, copied.
  C.JUNGLE_ICON_BASE = 2400;
  C.JUNGLE_ICONS = ['fur_bugkon', 'feather_kalaw', 'casque_kalaw', 'meat_baboy', 'warty_tusk', 'maral_pelt', 'whisker_maral', 'skin_tuko',
    'silver_hoof', 'cape_kagwang', 'twig_sprite', 'tigmamanukan_feather', 'bamboo_heart', 'sinigang_baboy', 'bamboo_poles', 'bamboo_mat',
    'jungle_hat', 'jungle_vest', 'jungle_sandals', 'jungle_charm'];
  C.JUNGLE_STAND = { fur_bugkon: 'fur_rabbit', feather_kalaw: 'feather_labuyo', casque_kalaw: 'antler', meat_baboy: 'meat_boar', warty_tusk: 'tusk',
    maral_pelt: 'pelt_tiger', whisker_maral: 'feather_labuyo', skin_tuko: 'leather_soft', silver_hoof: 'gold_tusk', cape_kagwang: 'pelt_wolf',
    twig_sprite: 'lumber', tigmamanukan_feather: 'blue_feather', bamboo_heart: 'emerald', sinigang_baboy: 'kaldereta', bamboo_poles: 'lumber',
    bamboo_mat: 'leather_soft', jungle_hat: 'gear_cloak', jungle_vest: 'gear_cloak', jungle_sandals: 'gear_boots', jungle_charm: 'gear_charm' };
  C.jungleIcon = function (name) { var i = C.JUNGLE_ICONS.indexOf(name); return i < 0 ? -1 : C.JUNGLE_ICON_BASE + i; };
  C.JUNGLE_ICONS.forEach(function (n) { C.ICON[n] = C.jungleIcon(n); }); // (never in C.ICON_ORDER: the page's sheet does not grow)

  var P = F.addPlace({
    id: 'jungle', n: 22, name: 'The Bamboo Jungle', unlock: 70, map: 'jungle', grass: 0, icon: 'feather_kalaw', jeep: 'from_city',
    pack: 'jungle', artDir: 'manila/jungle', noJeep: true, // (reached by Manila's Jungle Gate, not Kanor's Jeep)
    serverLater: true, // (its online rows wait for the owner's SQL: node tools/places/server-rows.js jungle prints them)
    shut: 'The Bamboo Jungle opens at 70 hunts',
    opened: 'THE BAMBOO JUNGLE IS OPEN\nDiday: "70 hunts! Come through Manila\'s Jungle Gate, south of the plaza. Bring a Javelin: the bamboo is thick and the animals jump out close."',

    // Drops sell at the notes' prices (owner): the jungle's 60 to 300, the silver hoof 1,500, the guard's 900 to 2,200,
    // the boss's 1,400 to 3,400.
    items: {
      fur_bugkon: { name: 'Bugkon Fur', kind: 'hunt', sell: 70, desc: 'A tuft of soft grey fur from a Bugkon, the bushy-tailed cloud rat.' },
      feather_kalaw: { name: 'Kalaw Feather', kind: 'hunt', sell: 85, desc: 'A bright orange feather from a Kalaw, the jungle\'s hornbill.' },
      casque_kalaw: { name: 'Kalaw Casque', kind: 'hunt', sell: 240, desc: 'The red-and-gold casque a Kalaw shed. It grows a new one.' },
      meat_baboy: { name: 'Baboy-damo Meat', kind: 'meat', sell: 90, desc: 'A good cut from a warty wild pig. Cook Sinigang with it.' },
      warty_tusk: { name: 'Warty Tusk', kind: 'hunt', sell: 180, desc: 'A bumpy little tusk. Panday Lando wants it for the Copper Javelin.' },
      maral_pelt: { name: 'Maral Pelt', kind: 'hunt', sell: 200, desc: 'A soft spotted pelt from the Maral, the leopard cat. For the Silver Javelin.' },
      whisker_maral: { name: 'Maral Whiskers', kind: 'hunt', sell: 160, desc: 'Three long white whiskers, tied with red string.' },
      skin_tuko: { name: 'Tuko Skin', kind: 'hunt', sell: 60, desc: 'A gecko\'s shed skin, blue with orange spots. The Tuko grows a new one.' },
      silver_hoof: { name: 'Silver Hoof', kind: 'hunt', sell: 1500, desc: 'The tiny silver hoof charm the clever Pilandok dropped as it dodged away.' },
      cape_kagwang: { name: 'Kagwang Cape', kind: 'hunt', sell: 260, desc: 'A soft gliding cape a Kagwang left on a root in the Hollows.' },
      twig_sprite: { name: 'Sprite Twig', kind: 'hunt', sell: 280, desc: 'A green bamboo twig that still grows leaves. A Bamboo Sprite let it go.' },
      tigmamanukan_feather: { name: 'Tigmamanukan Feather', kind: 'hunt', sell: 2000, desc: 'A shimmering blue tail feather of the old omen bird. For the Gold Javelin.' },
      bamboo_heart: { name: 'Bamboo Heart', kind: 'hunt', sell: 3200, desc: 'The glowing green heart the sleepy Bamboo Giant gave you. It hums softly.' },
      bamboo_poles: { name: 'Bamboo Poles', kind: 'goods', sell: 60, desc: 'Three straight bamboo poles, tied with rope. From a hidden chest.' },
      bamboo_mat: { name: 'Bamboo Mat', kind: 'goods', sell: 120, desc: 'A mat Diday wove from split bamboo. Cool to sit on.' },
      sinigang_baboy: { name: 'Sinigang na Baboy-damo', kind: 'dish', sell: 380, energy: 110, desc: 'A sour tamarind soup with wild pork, taro and tomato.' },
    },

    // Cute and kind; the bosses grumpy, never wicked (owner). About 1.5 times the notes' hits to bring one down, and a
    // charge costs a little more (the Plains' way): the difficulty is in the animals. They hide until you are 2 to 3
    // tiles off, then run or jump at you: the Javelin's ground.
    creatures: {
      bugkon: { name: 'Bugkon', sheet: 'wild_bugkon', row: 0, sheetRow: 'rabbit', tint: 0xa8a8b0, px: 182, w: 0.8, hop: 0.08, kg: 1.8, hp: 5, walk: 0.6, run: 4.4, shy: 2.2,
        drops: [['fur_bugkon', 1, 1]] },
      kalaw: { name: 'Kalaw', sheet: 'wild_kalaw', row: 0, sheetRow: 'labuyo', tint: 0xe06a3a, px: 160, w: 1.2, kg: 2.2, hp: 6, walk: 0.6, run: 5, shy: 2.8, flies: true,
        drops: [['feather_kalaw', 1, 1], ['casque_kalaw', 1, 0.5]] },
      // in pairs (flock 2): when one charges, its friend comes along; the Moon Javelin hits the two side by side
      baboydamo: { name: 'Baboy-damo', sheet: 'wild_baboydamo', row: 0, sheetRow: 'boar', tint: 0x6a5446, px: 180, w: 1.4, ground: true, kg: 70, hp: 9, walk: 0.7, run: 4.2, angry: 2.2, hit: 16, flock: 2,
        drops: [['meat_baboy', 2, 1], ['warty_tusk', 1, 0.5]] },
      maral: { name: 'Maral', sheet: 'wild_maral', row: 0, sheetRow: 'wolf', tint: 0xd0a050, px: 168, w: 1, ground: true, kg: 4, hp: 8, walk: 0.9, run: 5, angry: 2.4, hit: 14,
        drops: [['maral_pelt', 1, 1], ['whisker_maral', 1, 0.5]] },
      tuko: { name: 'Tuko', sheet: 'wild_tuko', row: 0, sheetRow: 'rabbit', tint: 0x6a8ad8, px: 175, w: 0.7, ground: true, kg: 0.3, hp: 3, walk: 0.5, run: 4, shy: 2,
        drops: [['skin_tuko', 1, 1]] },
      // the clever mouse deer: fast, and it zigzags as it runs (the owner's `zigzag`)
      pilandok: { name: 'Pilandok', sheet: 'wild_pilandok', row: 0, sheetRow: 'deer', tint: 0xb08a60, px: 146, w: 0.7, ground: true, kg: 2, hp: 9, walk: 0.8, run: 6.8, shy: 3, zigzag: true,
        rare: true, respawn: 120, drops: [['silver_hoof', 1, 1]] },
      // the tame one: a warty piglet, never a target
      biik: { name: 'Biik', sheet: 'wild_biik', row: 0, sheetRow: 'boar', tint: 0x9a7a6a, px: 174, w: 0.6, ground: true, kg: 3, hp: 1, walk: 0.6, run: 4, shy: 2.2, drops: [] },
    },
    animals: { bugkon: 4, kalaw: 4, baboydamo: 4, tuko: 4 },
    extra: [{ kind: 'maral', n: 3, when: 'dusk' }, { kind: 'kalaw', n: 2, when: 'dawn' }, { kind: 'baboydamo', n: 2, when: 'rain' }, { kind: 'pilandok', n: 1, when: 'rare' }],

    // the Biik: planted cassava, 9 feedings, it may run off; it fetches what a hunt leaves near you (fetch)
    tame: { kind: 'biik', food: 'cassava', feedings: 9, runOff: 0.25, back: 20, skill: 'fetch' },

    // the Bamboo set (owner: about 10 times the first note, like the Plainsrunner set, plus drops)
    gear: { name: 'Bamboo', pieces: {
      head: { id: 'jungle_hat', name: 'Bamboo Hat', standIn: 'gear_cloak', needs: [['feather_kalaw', 10], ['casque_kalaw', 4], ['bamboo_poles', 6]], gold: 30000 },
      body: { id: 'jungle_vest', name: 'Maral Vest', standIn: 'gear_cloak', needs: [['maral_pelt', 8], ['whisker_maral', 4], ['cape_kagwang', 6]], gold: 50000 },
      feet: { id: 'jungle_sandals', name: 'Bamboo Sandals', standIn: 'gear_boots', needs: [['skin_tuko', 10], ['twig_sprite', 6], ['bamboo_mat', 3]], gold: 35000 },
      charm: { id: 'jungle_charm', name: 'Pilandok Charm', standIn: 'gear_charm', needs: [['silver_hoof', 3], ['tigmamanukan_feather', 2], ['bamboo_heart', 1]], gold: 60000 },
    } },

    // 5 hidden chests, one in each side glade and one by the pool (kept free: L.jungleMap)
    chests: [[5, 11], [46, 16], [5, 39], [46, 34], [34, 28]],
    chestLoot: [['javelins', 5, 1], ['bamboo_poles', 2, 1], ['bamboo_mat', 1, 0.7], ['cassava', 2, 0.5]],

    // Diday, the bamboo weaver, by her hut at the gate: first visit, a few hunts, the guard, the boss
    npc: { engineGifts: true, name: 'Diday', look: 'ivy', sheet: 'npc_diday', at: [23, 7], lines: [
      { text: 'Magandang araw! I am Diday. I weave baskets from the jungle\'s bamboo. The bamboo is tall here: a long shot stops in it. Get close, with a Javelin. Here, cassava for the little Biik.', gift: [['cassava', 5]] },
      { text: 'You walk softly! The Baboy-damo go about in pairs: when one charges, its friend comes too. The Pilandok zigzags as it runs: wait for it to come straight. Take these javelins.', need: { hunts: 5 }, hint: 'Hunt here a few more times.', gift: [['javelins', 10]] },
      { text: 'You calmed the Tigmamanukan? It is only an old omen bird, cross that someone came into its Hollows. Here, rope for Panday Lando\'s Javelins.', need: { guard: 1 }, hint: 'Beat the guard on floor 10 of the Bamboo Hollows.', gift: [['rope', 3]] },
      { text: 'The Bamboo Giant! It only wanted to sleep, you know. My lola cooked this for the friend of the jungle. Salamat!', need: { boss: 1 }, hint: 'Beat the boss on floor 50 of the Bamboo Hollows.', gift: [['sinigang_baboy', 2]] },
    ] },

    dungeon: {
      key: 'jungle_cave', name: 'The Bamboo Hollows', floors: 50, liftEvery: 10, guardFloor: 10, guardEvery: 10, guardHpPer: 0.5, bossFloor: 50,
      count: { base: 3, per: 10, max: 7 }, escort: 2,
      creatures: {
        // a little bamboo sprite: it runs off round the corners
        kawayansprite: { name: 'Bamboo Sprite', sheet: 'wild_kawayansprite', row: 0, sheetRow: 'sigbin', tint: 0x9ad070, px: 110, w: 0.9, ground: true, kg: 3, hp: 8, walk: 0.7, run: 5, shy: 3.4,
          drops: [['twig_sprite', 1, 1], ['bamboo_poles', 1, 0.3]] },
        // the gliding colugo: it drops on you
        kagwang: { name: 'Kagwang', sheet: 'wild_kagwang', row: 0, sheetRow: 'labuyo', tint: 0x8a7a6a, px: 152, w: 1, kg: 1.5, hp: 9, walk: 0.6, run: 4.6, angry: 3, hit: 14,
          drops: [['cape_kagwang', 1, 1]] },
        // the guard of every 10th floor: the omen bird of Tagalog legend, old and cross (not the Lost Tower's: its own
        // picture, art-src/manila/jungle/wild_tigmamanukan.png, saved as wild_jungle_tigma)
        jg_tigma: { name: 'Tigmamanukan', sheet: 'wild_jungle_tigma', src: 'wild_tigmamanukan', row: 0, sheetRow: 'labuyo', tint: 0x60a0e0, px: 166, w: 2, kg: 90, hp: 38, walk: 0.7, run: 4, angry: 3.6, hit: 17, boss: true,
          drops: [['tigmamanukan_feather', 1, 1], ['warty_tusk', 2, 1], ['bamboo_poles', 2, 0.6]] },
        // the floor 50 boss: our own gentle giant of bamboo and moss, old, sleepy and grumpy at being woken; soloable,
        // more health with friends
        bamboogiant: { name: 'Bamboo Giant', sheet: 'wild_bamboogiant', row: 0, sheetRow: 'bungisngis', tint: 0x9ab050, px: 143, w: 3.4, ground: true, kg: 2200, hp: 58, hpEach: 22, minHits: 3,
          walk: 0.5, run: 3.4, angry: 4, hit: 21, boss: true, drops: [['bamboo_heart', 2, 1], ['tigmamanukan_feather', 1, 1], ['silver_hoof', 1, 0.2]] },
      },
      floorKinds: [['kawayansprite', 1, 50], ['kagwang', 6, 50]],
      guard: 'jg_tigma', boss: 'bamboogiant',
      // the boss's daily chest (stacks to 3)
      chest: [['bamboo_heart', 1, 1], ['javelins', 10, 1], ['bamboo_poles', 3, 1], ['tigmamanukan_feather', 1, 0.25], ['bamboo_mat', 2, 0.5]],
      // dark earth, bamboo-root walls, a green pool
      look: { floor: ['#2a2010', '#6a5530', '#b89a60'], wall: ['#1a1408', '#5a4a20', '#a08a40'], top: ['#0e0a04', '#2e2410', '#5a4a20'], crust: ['#1e1808', '#4a3c18', '#8a7434'] },
      lava: { rim: '#1a2a10', hot: ['#d8f8c0', '#80c060', '#2a6a20'], plate: ['rgba(40,90,30,0.85)', 'rgba(70,130,50,0.8)'], embers: false },
      bg: '#0e0a04', propTint: 0xc8d890, icon: 'bamboo_heart',
      art: { mouth: 'props/jungle_mouth', gate: 'props/jungle_gate', cave: 'jungle_cave' },
    },
  });

  // painted items, and the gear pieces' painted icons
  Object.keys(P.items).forEach(function (id) { C.ITEMS[id].painted = true; });
  C.GEAR_SLOTS.forEach(function (slot) { var g = C.PLACE_GEAR['jungle_' + slot]; if (g && g.art) g.icon = C.jungleIcon(g.art); });

  // the local dish, and its power: charges cost half (the jungle's animals jump at you)
  C.RECIPES.push({ dish: 'sinigang_baboy', needs: ['meat_baboy', 'taro', 'tomato'] });
  if (C.DISH_POWERS) {
    C.DISH_POWERS.sinigang_baboy = { key: 'charge', text: 'charges cost half the energy' };
    C.ITEMS.sinigang_baboy.desc += ' For ' + C.DISH_POWER_MINS + ' minutes, ' + C.DISH_POWERS.sinigang_baboy.text + '.';
  }

  // the two new rules' numbers
  C.WILD.bambooFrom = 4; // tiles: a shot longer than this stops at the first bamboo clump past it (yours; a friend's shows)
  C.WILD.zigzag = { every: 360, turn: 0.8 }; // ms each way, radians off its line
  C.WILD.pairGap = 1.1; // tiles between a pair standing side by side (under C.WEAPON_PAIR, 1.4: the Moon Javelin hits both)

  // ---------- the map (L.jungleMap builds it; the world draws what the map cannot) ----------
  // Boxes are [x, y, w, h] in tiles. The way back to Manila is the gap at the top, `gate` (2 wide).
  C.JUNGLE = {
    W: 52, H: 52,
    gate: [25, 0],
    // open ground: the glades, then the 2-tile trails between them; everything else is bamboo
    glades: [[19, 3, 14, 7], [4, 10, 10, 8], [38, 10, 10, 8], [17, 18, 20, 12], [4, 33, 10, 8], [38, 33, 10, 8], [19, 42, 14, 7]],
    trails: [[25, 0, 2, 4], [25, 10, 2, 8], [9, 6, 10, 2], [9, 6, 2, 4], [33, 6, 10, 2], [41, 6, 2, 4], [8, 18, 2, 15], [42, 18, 2, 15],
      [10, 20, 7, 2], [37, 27, 5, 2], [21, 30, 2, 12], [8, 41, 2, 5], [42, 41, 2, 5], [8, 45, 11, 2], [33, 45, 11, 2]],
    pool: [28, 21, 7, 6], falls: [29, 20], // the waterfall pool; the waterfall's foot (4 wide) on its north edge
    streams: [[2, 24, 26], [35, 24, 15]], // [x, y, length]: the streams out of the pool, west and east
    crossings: [['stones', 8, 24], ['bridge', 21, 24], ['stones', 42, 24]], // where a trail crosses a stream
    hut: [27, 5], rack: [20, 4], baskets: [30, 8], chime: [32, 5], // Diday's hut (foot row) and her things
    door: [27, 45], // the cave's door (its mouth stands on it, facing you)
    deco: [['treefern', 18, 12], ['treefern', 33, 13], ['banana', 5, 16], ['banana', 45, 12], ['log', 10, 38], ['log', 39, 38], ['banana', 30, 47], ['treefern', 17, 47]],
    // the owner's 12 props (props_jungle.png, props_jungle_2.png, 3 x 2 each, in that order: tools/manila/plains-import.js)
    kinds: ['bamboo', 'thicket', 'treefern', 'log', 'stones', 'bridge', 'hut', 'rack', 'banana', 'waterfall', 'baskets', 'chime'],
    clumps: ['bamboo_bush', 'fern_bush'], // the stand-ins that are tall bamboo (they block long shots)
    tours: ['jungle'], // the first-time tour (C.TIPS: jungle_tour)
  };
  // the owner's props over the map's stand-ins (src/19zzzzzzz-place-art.js), and its ground (the grass, the water)
  C.PLACE_PROP_KINDS.jungle = C.JUNGLE.kinds;
  C.PLACE_PROP_SWAP.jungle = { bamboo_bush: 'bamboo', fern_bush: 'thicket', pine_tree: 'treefern', mossy_log: 'log', wildflowers: 'stones', flower_arch: 'bridge',
    shack: 'hut', trader_tent: 'rack', mud_spring: 'banana', rainforest_tree: 'waterfall', pumpkin_pile: 'baskets', lamp: 'chime' };
  C.PLACE_GROUND.push('jungle');

  // ---------- Manila's Jungle Gate: the way in once it is open (70 hunts) ----------
  // Shut, it is as before (the fence across its road, its arch's solid foot) and says when it opens; open, the world takes
  // the fence and the arch's foot away and the gate's box is a walk-through warp (19zzz...z-jungle.js).
  M.gates.forEach(function (g) { if (g.key === 'jungle') { g.text = 'JUNGLE GATE\nThe Bamboo Jungle lies south: the Javelin\'s hunting ground. It opens at 70 hunts.'; M.jungleGate = g; } });

  // the weapons work here (as everywhere), and here the Javelin shines
  if (C.WEAPON_GROUNDS) C.WEAPON_GROUNDS.push('jungle', 'jungle_cave');
})(window.Farm = window.Farm || {});
