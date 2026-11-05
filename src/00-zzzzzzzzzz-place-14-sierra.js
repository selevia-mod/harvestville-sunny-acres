// Place 14: Sierra Madre (owner, 6 Nov 2026): a deep mountain rainforest, open at 130 hunts by Kanor's Jeep. Mossy
// ground with orchids, a clear river (not walkable) from a small waterfall pool, giant narra trees, rattan palms, jungle
// grass where the animals hide, mossy logs, and the huge balete whose hollow is the way down to Kapre's Roots.
//  - Animals: the Unggoy (a shy long-tailed macaque; it drops the wild bananas it carried), the Wild Carabao (charges)
//    and the rare Silver Carabao.
//  - The tame: a Little Unggoy (a young one, never for the Bow: the grown ones stay huntable), fed wild bananas; ~10
//    feedings, it may run off; once tamed it picks up what a hunt leaves near you (fetch).
//  - Kapre's Roots: 10 floors under the balete (root-woven earth, glowing mushrooms, glowing pools): Anggitay and Wood
//    Spirits; the Anggitay Queen guards floor 5; floor 10 is the Kapre's, a huge gentle tree giant covered in moss
//    (owner, 6 Nov 2026: no cigar or smoking, and he is a tree being, not a dark-skinned man). Soloable, more health with
//    friends, a daily chest (up to 3 wait).
//  - Ka Ramon, the forest ranger: four lines (first visit, a few hunts, the guard, the boss) about looking after the
//    forest, each with a small gift the first time it is read (01-logicZZZZZ-place-14-sierra.js gives it).
//  - The Kapre set at Kanor's (Ranger Hat, Vest, Boots and the Kapre Charm) from this place's drops and Gold.
//  - Local food: Kare-Kare (a dish: any meat, an eggplant and wild bananas, for the banana heart), Wild Honey (sweet,
//    eat it) and Narra Wood (a material: the Kapre Charm takes it; Kanor buys it too).
// Numbers are a step above Taal Lake (place 13); they are listed in docs/places/sierra.md.
// Art (art-src/places/sierra/, docs/places-items.json): every name is wired; until a picture is in, the engine draws
// the stand-in named here (another animal's row, tinted; a villager; the drawn mouth and gate; the Mine's cave tiles in
// these colours). The 16 icons: call F.placeIcons(SIERRA_ICONS) only once icons_sierra.png is painted into
// assets/items.png (never before: an icon past the sheet's end draws nothing).
(function (F) {
  'use strict';
  var C = F.Config;
  // icons_sierra.png, 4 x 4 in this order (docs/places-items.json "sierra")
  C.SIERRA_ICONS = ['banana_wild', 'fur_unggoy', 'horn_carabao', 'hide_carabao', 'silver_horn', 'mane_anggitay', 'moss_spirit', 'ribbon_queen',
    'bark_kapre', 'ranger_hat', 'ranger_vest', 'ranger_boots', 'kapre_charm', 'kare_kare', 'wild_honey', 'narra_wood'];

  F.addPlace({
    id: 'sierra', n: 14, name: 'Sierra Madre', unlock: 130, map: 'sierra',
    grass: 1, // (Makiling's tuft: forest grass)
    icon: 'banana_wild',
    shut: 'The Sierra Madre is far to the east, past the mountains',
    opened: 'SIERRA MADRE IS OPEN\nKanor: "130 hunts! My Jeep can take you to the Sierra Madre now. Mind the carabao, and greet the ranger for me."',
    // ground_sierra.png, ground_sierra_water.png and props_sierra.png (the map's own tiles and props) wait for an import
    // step in tools/art; until then the map uses the Wild Lands' forest ground, the farm's water and Makiling's props.
    art: { ground: 'ground_sierra', water: 'ground_sierra_water', props: 'props_sierra' },

    items: {
      banana_wild: { name: 'Wild Bananas', kind: 'forage', sell: 35, energy: 8, standIn: 'mango',
        desc: 'A small bunch an Unggoy was carrying. Little monkeys love them.' },
      fur_unggoy: { name: 'Unggoy Fur', kind: 'hunt', sell: 140, standIn: 'fur_rabbit', desc: 'A tuft of soft grey-brown monkey fur.' },
      horn_carabao: { name: 'Carabao Horn', kind: 'hunt', sell: 360, standIn: 'horn_rhino', desc: 'A big curved horn from a Wild Carabao.' },
      hide_carabao: { name: 'Carabao Hide', kind: 'hunt', sell: 300, standIn: 'hide_rhino', desc: 'Thick slate-grey hide.' },
      silver_horn: { name: 'Silver Horn', kind: 'hunt', sell: 2400, standIn: 'white_antler', desc: 'A shining horn from the rare Silver Carabao.' },
      mane_anggitay: { name: 'Anggitay Mane', kind: 'hunt', sell: 480, standIn: 'tikbalang_mane', desc: 'A braided chestnut mane with a little flower in it.' },
      moss_spirit: { name: 'Spirit Moss', kind: 'hunt', sell: 420, standIn: 'herb', desc: 'Forest moss that glows a soft green.' },
      ribbon_queen: { name: "Queen's Ribbon", kind: 'hunt', sell: 2200, standIn: 'ribbon', desc: 'The Anggitay Queen\'s golden ribbon.' },
      bark_kapre: { name: 'Kapre Bark', kind: 'hunt', sell: 3200, standIn: 'lumber', desc: 'Thick mossy bark from the gentle Kapre, with a vine on it.' },
      kare_kare: { name: 'Kare-Kare', kind: 'dish', energy: 110, sell: 260, standIn: 'veggie_stew',
        desc: 'A thick peanut stew with meat, eggplant and banana heart.' },
      wild_honey: { name: 'Wild Honey', kind: 'forage', energy: 30, sell: 160, standIn: 'jam', desc: 'Golden honey from the forest bees. Sweet!' },
      narra_wood: { name: 'Narra Wood', kind: 'hunt', sell: 220, standIn: 'lumber', desc: 'Red-brown wood from the old narra. Kanor carves charms from it.' },
    },
    // stand-ins until the owner's sheets (wild_<name>.png): px = the stand-in row's frame width (a sheet of its own
    // brings its own px: tools/art/wild3q-import.js prints it)
    creatures: {
      // shy: it scampers off when you come close (sneak up slowly)
      unggoy: { name: 'Unggoy', sheet: 'wild_unggoy', row: 0, sheetRow: 'sigbin', tint: 0xc8b49a, px: 162, w: 0.95, hop: 0.06, kg: 9, hp: 4,
        walk: 0.9, run: 5.2, shy: 4.4, drops: [['banana_wild', 2, 1], ['fur_unggoy', 1, 0.7]] },
      carabaoligaw: { name: 'Wild Carabao', sheet: 'wild_carabaoligaw', row: 0, sheetRow: 'rhino', tint: 0x8c97a6, px: 214, w: 2.3, ground: true,
        kg: 800, hp: 10, walk: 0.5, run: 4, angry: 3.2, hit: 18, respawn: 15, drops: [['hide_carabao', 1, 1], ['horn_carabao', 1, 0.5]] },
      silvercarabao: { name: 'Silver Carabao', sheet: 'wild_silvercarabao', row: 0, sheetRow: 'rhino', tint: 0xeef4ff, px: 214, w: 2.5, ground: true,
        kg: 900, hp: 14, walk: 0.5, run: 4.4, angry: 3.4, hit: 20, rare: true, respawn: 120, drops: [['silver_horn', 1, 1], ['hide_carabao', 2, 1]] },
      // the tame one: a young Unggoy, calm until you come near (the grown ones are for the Bow; this one never is)
      unggoy_bata: { name: 'Little Unggoy', sheet: 'wild_unggoy', row: 0, sheetRow: 'sigbin', tint: 0xe0cfb4, px: 162, w: 0.75, hop: 0.06, kg: 4, hp: 1,
        walk: 0.6, run: 4.2, shy: 2.4, drops: [] },
    },
    animals: { unggoy: 4, carabaoligaw: 3 },
    extra: [{ kind: 'unggoy', n: 2, when: 'dawn' }, { kind: 'carabaoligaw', n: 1, when: 'rain' }, { kind: 'silvercarabao', n: 1, when: 'rare' }],

    tame: { kind: 'unggoy_bata', food: 'banana_wild', feedings: 10, runOff: 0.25, back: 20, skill: 'fetch' },

    gear: { name: 'Kapre', pieces: {
      head: { id: 'ranger_hat', name: 'Ranger Hat', standIn: 'gear_cloak', needs: [['fur_unggoy', 8], ['banana_wild', 6]], gold: 4500 },
      body: { id: 'ranger_vest', name: 'Ranger Vest', standIn: 'gear_cloak', needs: [['hide_carabao', 6], ['mane_anggitay', 3]], gold: 8000 },
      feet: { id: 'ranger_boots', name: 'Ranger Boots', standIn: 'gear_boots', needs: [['hide_carabao', 4], ['moss_spirit', 4]], gold: 4500 },
      charm: { id: 'kapre_charm', name: 'Kapre Charm', standIn: 'gear_charm', needs: [['bark_kapre', 2], ['narra_wood', 3], ['ribbon_queen', 1]], gold: 8000 },
    } },

    // five hidden chests (tiles on maps/sierra.json kept free by tools/make-map.js' sierra())
    chests: [[3, 3], [29, 7], [8, 13], [16, 25], [27, 22]],
    chestLoot: [['arrows', 8, 1], ['wild_honey', 1, 1], ['banana_wild', 2, 0.6], ['narra_wood', 1, 0.5]],

    // Ka Ramon (art: npc_ka_ramon.png); gift: what he gives the first time you hear that line
    npc: { name: 'Ka Ramon', look: 'owen', sheet: 'npc_ka_ramon', at: [9, 20], lines: [
      { text: 'Mabuhay! I am Ka Ramon, ranger of the Sierra Madre. This forest keeps the rain for half of Luzon. Hunt only what you need, and leave the little ones be. Here, some honey for the walk.',
        gift: [['wild_honey', 2]] },
      { text: 'You hunt like someone who listens to the forest. Did you see the Little Unggoy by the river? Hold out wild bananas, come slowly, and one day it may follow you home. These arrows are for you.',
        need: { hunts: 5 }, hint: 'Hunt here a few times.', gift: [['arrows', 10]] },
      { text: 'The Anggitay Queen let you pass? She guards the roots for the Kapre. He sleeps below her floors. He is gentle, but he tests everyone who comes. Take some narra wood, for luck.',
        need: { guard: 1 }, hint: 'Go down under the balete and get past the guard of floor 5.', gift: [['narra_wood', 2]] },
      { text: 'You met the Kapre, and the forest is still standing. Salamat! Plant a tree for every one you take, ha? My wife made you kare-kare.',
        need: { boss: 1 }, hint: 'Meet the Kapre on floor 10 of his roots.', gift: [['kare_kare', 1], ['wild_honey', 1]] },
    ] },

    dungeon: {
      key: 'sierra_cave', name: "Kapre's Roots", floors: 10, liftEvery: 5, guardFloor: 5, bossFloor: 10,
      count: { base: 3, per: 3, max: 6 },
      escort: 2,
      creatures: {
        // a small cheerful centaur girl: she gallops off when you come near
        anggitay: { name: 'Anggitay', sheet: 'wild_anggitay', row: 0, sheetRow: 'tikbalang', tint: 0xe8c090, px: 110, w: 1, bar: 1.9, kg: 120, hp: 8,
          walk: 0.9, run: 5.4, shy: 3.8, ground: true, drops: [['mane_anggitay', 1, 0.6], ['wild_honey', 1, 0.2]] },
        // a walking mossy stump: slow, but it charges
        woodspirit: { name: 'Wood Spirit', sheet: 'wild_woodspirit', row: 0, sheetRow: 'sigbin', tint: 0x9cc080, px: 162, w: 1, kg: 30, hp: 10,
          walk: 0.6, run: 3.6, angry: 3, hit: 15, ground: true, drops: [['moss_spirit', 1, 1], ['narra_wood', 1, 0.4]] },
        // the guard of floor 5
        anggitayqueen: { name: 'Anggitay Queen', sheet: 'wild_anggitayqueen', row: 0, sheetRow: 'tikbalang', tint: 0xfff2d8, px: 110, w: 1.5, bar: 2.6, kg: 300, hp: 30,
          walk: 0.8, run: 4.6, angry: 4, hit: 20, ground: true, boss: true, drops: [['ribbon_queen', 1, 1], ['mane_anggitay', 2, 1]] },
        // floor 10: the Kapre, a huge gentle tree giant covered in moss; soloable, 22 more health for each friend
        kapre: { name: 'Kapre', sheet: 'wild_kapre', row: 0, sheetRow: 'bungisngis', tint: 0x86b070, px: 164, w: 3.2, kg: 2000, hp: 41, hpEach: 16, minHits: 3,
          walk: 0.5, run: 3.2, angry: 3.4, hit: 24, ground: true, boss: true, drops: [['bark_kapre', 2, 1], ['moss_spirit', 3, 1], ['narra_wood', 2, 0.6]] },
      },
      floorKinds: [['anggitay', 1, 10], ['woodspirit', 3, 10]],
      guard: 'anggitayqueen', boss: 'kapre',
      chest: [['bark_kapre', 2, 1], ['narra_wood', 3, 1], ['wild_honey', 2, 1], ['arrows', 12, 1], ['silver_horn', 1, 0.15]],
      // root-woven earth (dark to light), roots for walls, moss on the crust
      look: { floor: ['#1a120a', '#3e2c18', '#6a5030'], wall: ['#120c06', '#3a2814', '#5e4424'], top: ['#080502', '#1c140a', '#33261a'], crust: ['#0e1a10', '#1c3a24', '#2e5a38'] },
      // the glowing pools: blue-green water, no sparks
      lava: { rim: '#04140f', hot: ['#c8fff0', '#4ad8b0', '#16705a'], plate: ['rgba(8,40,30,0.85)', 'rgba(16,70,52,0.8)'], embers: false, glow: true },
      bg: '#0a0805', propTint: 0xa8d8a0, icon: 'mushroom',
      art: { mouth: 'props/sierra_mouth', gate: 'props/sierra_gate', cave: 'sierra_cave' },
    },
  });

  // Kare-Kare in the kitchen (appended: the kitchen's list is not saved): any meat, an eggplant, and wild bananas for the
  // banana heart (owner, 6 Nov 2026: a local dish)
  C.RECIPES.push({ dish: 'kare_kare', needs: ['meat', 'eggplant', 'banana_wild'] });
})(window.Farm = window.Farm || {});
