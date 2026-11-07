// Place 12: Chocolate Hills, Bohol (owner, 6 Nov 2026), and its cave, the Hill Hollows. Opens at 80 hunts and is meant
// a step past Banaue Terraces (place 11): tougher animals and cave, dearer gear (test/bohol.test.js compares the two once
// Banaue is in). The numbers are listed for the owner in docs/places/bohol.md. How a place is made:
// docs/hunting-places-engine.md.
//  - the map (maps/bohol.json): rolling dome hills, a calm green river you can't walk in, nipa huts, coconut palms,
//    bamboo fences, cogon grass, limestone rocks; the Jeep at the bottom left, the Hollows' round door up the trail.
//    Its pictures are drawn stand-ins until the owner's are in (src/19zzzzzz-place-12-bohol.js).
//  - the cave (maps/bohol_cave.json): 50 floors of cream limestone and cave pools. White and Black Duwende, the Punso
//    Golem guards every 10th floor, the Great Nuno is the boss of floor 50 (grumpy but kind; soloable, more health with friends).
//  - Mang Tonyo, the Bohol guide: 4 lines of story, each with a small gift (src/01-logicZZZZZ-place-12-bohol.js).
//  - Local food: Kaldereta (the dish from before) also cooks from goat meat, Peanut Kisses, Kape Alamid.
// Item ids and the order of their 16 icons are fixed in docs/places-items.json ("bohol"). The icons are not in the items
// sheet yet: every item uses its stand-in until tools/art paints icons_bohol.png in (then call F.placeIcons, below).
(function (F) {
  'use strict';
  var C = F.Config;

  // The 16 icons of art-src/places/bohol/icons_bohol.png, in the sheet's order (docs/places-items.json), painted at the
  // end of assets/items.png by tools/art/places-import.js (owner's art, 6 Nov 2026).
  C.BOHOL_ICONS = ['horn_goat', 'meat_goat', 'tail_musang', 'kape_alamid', 'cocoa_horn', 'hat_duwende', 'pebble_duwende', 'clay_golem',
    'moss_nuno', 'hollow_hat', 'hollow_vest', 'hollow_boots', 'hollow_charm', 'kaldereta', 'peanut_kisses', 'limestone_chip'];
  F.placeIcons(C.BOHOL_ICONS);

  F.addPlace({
    id: 'bohol', n: 12, name: 'Chocolate Hills', unlock: 80, map: 'bohol', grass: 0, icon: 'horn_goat',
    shut: 'The Chocolate Hills are far south, in Bohol',
    opened: 'CHOCOLATE HILLS IS OPEN\nKanor: "Eighty hunts! Ride my Jeep to Bohol. Mang Tonyo will show you the hills. Wild goats, the musang in the cogon, and under the hills, they say, the Nuno."',

    items: {
      horn_goat: { name: 'Goat Horn', kind: 'hunt', sell: 95, standIn: 'antler', desc: 'A small curved horn from a wild goat of the Chocolate Hills.' },
      meat_goat: { name: 'Goat Meat', kind: 'meat', sell: 70, standIn: 'venison', desc: 'Wild goat meat. Cook it into Kaldereta, the Bohol way.' },
      tail_musang: { name: 'Musang Tail', kind: 'hunt', sell: 140, standIn: 'fur_rabbit', desc: 'A bushy ringed tail from a musang, the palm civet.' },
      // the musang's coffee (owner, 6 Nov 2026: "keep it light and fun"): a drink, and Kanor buys it
      kape_alamid: { name: 'Kape Alamid', kind: 'hunt', sell: 180, energy: 25, standIn: 'coffee',
        desc: 'Civet coffee. The musang picks only the ripest coffee cherries; the rest of the story Mang Tonyo tells with a grin. Drink it for energy.' },
      cocoa_horn: { name: 'Cocoa Horn', kind: 'hunt', sell: 900, standIn: 'horn_rhino', desc: 'A glossy cream horn from the rare Cocoa Goat. Kanor says it brings luck.' },
      hat_duwende: { name: 'Duwende Hat', kind: 'hunt', sell: 240, standIn: 'ribbon', desc: 'A tiny tall white hat. The White Duwende always has a spare.' },
      pebble_duwende: { name: 'Duwende Pebbles', kind: 'hunt', sell: 280, standIn: 'gem', desc: 'Three shiny juggling pebbles from a Black Duwende.' },
      clay_golem: { name: 'Punso Clay', kind: 'hunt', sell: 1400, standIn: 'ore_copper', desc: 'Brown anthill clay with a tiny flower on it, from the Punso Golem.' },
      moss_nuno: { name: 'Nuno Moss', kind: 'hunt', sell: 4800, standIn: 'herb', desc: 'A glowing tuft of magic moss. The Great Nuno gives it only to polite hunters.' },
      peanut_kisses: { name: 'Peanut Kisses', kind: 'goods', sell: 45, energy: 20, standIn: 'cookie', desc: 'Little peanut cookies from Bohol, shaped like the Chocolate Hills.' },
      limestone_chip: { name: 'Limestone Chip', kind: 'hunt', sell: 35, standIn: 'stone', desc: 'A white chip of limestone from inside the hills.' },
    },

    creatures: {
      // shy: runs when you come close; the Bow needs 3 hits
      kambing: { name: 'Wild Goat', sheet: 'wild_kambing', row: 0, sheetRow: 'deer', tint: 0xd8b888, px: 174, w: 1.15, kg: 45, hp: 3, walk: 0.8, run: 4.8, shy: 4.4,
        drops: [['meat_goat', 2, 1], ['horn_goat', 1, 0.5]] },
      // charges from the cogon grass when you come too close
      musang: { name: 'Musang', sheet: 'wild_musang', row: 0, sheetRow: 'wolf', tint: 0x9a8c80, px: 195, w: 1.05, ground: true, kg: 6, hp: 4, walk: 0.9, run: 4.6, angry: 3.2, hit: 13,
        drops: [['tail_musang', 1, 1], ['kape_alamid', 1, 0.35]] },
      // rare: one about now and then, hard to get near
      cocoagoat: { name: 'Cocoa Goat', sheet: 'wild_cocoagoat', row: 0, sheetRow: 'deer', tint: 0x8a5634, px: 182, w: 1.3, kg: 60, hp: 6, walk: 0.8, run: 5.6, shy: 6, rare: true, respawn: 120,
        drops: [['meat_goat', 3, 1], ['cocoa_horn', 1, 1]] },
      // the tame one: a young wild goat (owner: "Tame: the Wild Goat"), the Wild Goat's own picture a little smaller.
      // Never for the Bow; it wants cabbage.
      kambing_kid: { name: 'Wild Goat Kid', sheet: 'wild_kambing', row: 0, sheetRow: 'deer', tint: 0xe8d0a8, px: 174, w: 0.95, kg: 20, hp: 1, walk: 0.6, run: 4.2, shy: 2.4, drops: [] },
    },
    animals: { kambing: 3, musang: 2 },
    extra: [{ kind: 'kambing', n: 1, when: 'dawn' }, { kind: 'musang', n: 1, when: 'dusk' }, { kind: 'cocoagoat', n: 1, when: 'rare' }],

    // (owner, 6 Nov 2026: "~8-9 feedings, some run-off chance"; it fetches what a hunt leaves near you)
    tame: { kind: 'kambing_kid', food: 'cabbage', feedings: 9, runOff: 0.25, back: 25, skill: 'fetch' },

    gear: { name: 'Hollow', pieces: {
      head: { id: 'hollow_hat', name: 'Hollow Hat', standIn: 'gear_cloak', needs: [['horn_goat', 6], ['tail_musang', 2]], gold: 3500 },
      body: { id: 'hollow_vest', name: 'Hollow Vest', standIn: 'gear_cloak', needs: [['tail_musang', 6], ['hat_duwende', 4]], gold: 6000 },
      feet: { id: 'hollow_boots', name: 'Hollow Boots', standIn: 'gear_boots', needs: [['horn_goat', 4], ['pebble_duwende', 4]], gold: 3500 },
      charm: { id: 'hollow_charm', name: 'Hollow Charm', standIn: 'gear_charm', needs: [['clay_golem', 3], ['moss_nuno', 1]], gold: 6000 },
    } },

    // 5 hidden chests (tiles on maps/bohol.json, kept free of props by tools/make-map.js)
    chests: [[28, 3], [2, 9], [13, 25], [29, 25], [21, 6]],
    chestLoot: [['arrows', 8, 1], ['peanut_kisses', 2, 1], ['limestone_chip', 2, 1], ['kape_alamid', 1, 0.5]],

    // Mang Tonyo, the Bohol guide (owner, 6 Nov 2026): first visit, a few hunts, the guard, the boss. Each line gives a
    // small gift the first time it is read (gift: [[item, n]]; src/01-logicZZZZZ-place-12-bohol.js).
    npc: { name: 'Mang Tonyo', look: 'marco', sheet: 'npc_mang_tonyo', at: [9, 21], lines: [
      { text: 'Maayong pag-abot! Welcome to the Chocolate Hills. I am Tonyo, I guide visitors here. In the dry months the grass on the hills turns brown like chocolate. Wild goats graze on the slopes, and mind the musang hiding in the cogon grass. Here, a little pasalubong.',
        gift: [['peanut_kisses', 3]] },
      { text: 'You hunt like a Boholano now! See the little goat kid by the river? It is shy, but it loves cabbage. Hold some, go slowly while it is calm, and feed it. And try this kape alamid: the musang chose the beans!',
        need: { hunts: 5 }, hint: 'Hunt here a few more times.', gift: [['kape_alamid', 1], ['cabbage', 3]] },
      { text: 'You got past the Punso Golem? That anthill guards the Nuno\'s home. Lola always said: when you pass a punso, say "tabi tabi po" and walk softly. Be polite down there, and he will be fair with you.',
        need: { guard: 1 }, hint: 'Beat the Punso Golem on floor 10 of the Hill Hollows.', gift: [['arrows', 15], ['peanut_kisses', 3]] },
      { text: 'The Great Nuno himself! Grumpy, yes, but he has kept these hills safe for a hundred years. I think he let you win because you asked first. Salamat, hunter. Come and eat with us: kalderetang kambing!',
        need: { boss: 1 }, hint: 'Beat the Great Nuno on floor 50 of the Hill Hollows.', gift: [['kaldereta', 2], ['peanut_kisses', 4]] },
    ] },

    dungeon: {
      key: 'bohol_cave', name: 'Hill Hollows', floors: 50, liftEvery: 10, guardFloor: 10, guardEvery: 10, guardHpPer: 0.5, bossFloor: 50, // (owner, 8 Nov 2026: 50 floors, like the Lair)
      count: { base: 3, per: 10, max: 7 }, escort: 2, // 3 a floor, one more every 10 floors, at most 7
      creatures: {
        // knee-high and shy: they run and hide
        duwendeputi: { name: 'White Duwende', sheet: 'wild_duwendeputi', row: 0, sheetRow: 'bungisngis', tint: 0xe0ecff, px: 122, w: 0.8, kg: 5, hp: 3, walk: 0.9, run: 5, shy: 3.4,
          drops: [['hat_duwende', 1, 0.6], ['limestone_chip', 1, 0.8]] },
        // cheeky: it runs at you
        duwendeitim: { name: 'Black Duwende', sheet: 'wild_duwendeitim', row: 0, sheetRow: 'bungisngis', tint: 0x6a5a8a, px: 134, w: 0.85, kg: 6, hp: 4, walk: 0.9, run: 4.8, angry: 3.4, hit: 12, ground: true,
          drops: [['pebble_duwende', 1, 0.6], ['limestone_chip', 1, 0.8]] },
        // the guard of every 10th floor: a living anthill (punso)
        punsogolem: { name: 'Punso Golem', sheet: 'wild_punsogolem', row: 0, sheetRow: 'bear', tint: 0xa8784a, px: 171, w: 2.2, kg: 900, hp: 22, walk: 0.6, run: 3.2, angry: 3.4, hit: 15, ground: true, boss: true,
          drops: [['clay_golem', 2, 1], ['limestone_chip', 3, 1]] },
        // the boss of floor 50: grumpy but kind. Soloable; 18 more for each friend with you
        greatnuno: { name: 'Great Nuno', sheet: 'wild_greatnuno', row: 0, sheetRow: 'bungisngis', tint: 0xd8d0b0, px: 184, w: 2.6, kg: 1200, hp: 34, hpEach: 16, minHits: 3, walk: 0.5, run: 3.2, angry: 4, hit: 18, ground: true, boss: true,
          drops: [['moss_nuno', 1, 1], ['clay_golem', 1, 1]] },
      },
      floorKinds: [['duwendeputi', 1, 50], ['duwendeitim', 11, 50]],
      guard: 'punsogolem', boss: 'greatnuno',
      chest: [['moss_nuno', 1, 1], ['peanut_kisses', 3, 1], ['kape_alamid', 2, 1], ['limestone_chip', 4, 1], ['arrows', 15, 1], ['clay_golem', 1, 0.5]],
      // cream limestone, cave pools of still turquoise water
      look: { floor: ['#7a6440', '#cfb886', '#f8eac4'], wall: ['#4e4230', '#a08c62', '#dccca0'], top: ['#2a261c', '#5a5240', '#8a7e62'], crust: ['#3e4a3a', '#6a8a72', '#a8c8b0'] },
      lava: { rim: '#4a5a4a', hot: ['#d8fff4', '#6ad8cc', '#2a8a8c'], plate: ['rgba(230,250,245,0.35)', 'rgba(120,210,200,0.3)'], embers: false },
      bg: '#1e1a12', propTint: 0xf0e4c4, icon: 'moss_nuno',
      art: { mouth: 'props/bohol_mouth', gate: 'props/bohol_gate', cave: 'bohol_cave' },
    },
  });

  // Kalderetang kambing (owner, 6 Nov 2026): the Kaldereta from before cooks from goat meat too (one more Kitchen row)
  C.RECIPES.push({ dish: 'kaldereta', needs: ['meat_goat', 'potato', 'bell_pepper'] });
})(window.Farm = window.Farm || {});
