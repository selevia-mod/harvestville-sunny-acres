// Place 15: Palawan Underground River (owner, 6 Nov 2026), opens at 160 hunts; its dungeon the River Caves (10 floors).
// A jungle beach where a turquoise river runs into a limestone cliff (maps/palawan.json); the cave under the cliff
// (maps/palawan_cave.json). The hardest of the first five places (above Sierra Madre, place 14), still below the
// Lair's deep floors: the numbers are listed in docs/places/palawan.md. Engine contract: docs/hunting-places-engine.md.
// Art (art-src/places/palawan/, owner's pictures): every name is wired below; until a picture is in, the creature uses
// another animal's row of the wild sheet, tinted, the person a villager's look, the items a stand-in icon.
(function (F) {
  'use strict';
  var C = F.Config;
  // Its 16 icons (docs/places-items.json "palawan", in that order). Turn this on ONLY after tools/art has painted
  // art-src/places/palawan/icons_palawan.png into assets/items.png (an icon past the sheet's end draws nothing):
  // F.placeIcons(['fig_wild', 'wing_paniki', 'skin_sawa', 'scale_sawa', 'golden_scale', 'shell_crab', 'glow_light', 'nest_swiftlet',
  //   'feather_minokawa', 'cavern_hat', 'cavern_vest', 'cavern_boots', 'cavern_charm', 'ginataang_alimasag', 'cashew_palawan', 'stalactite_chip']);

  F.addPlace({
    id: 'palawan', n: 15, name: 'Palawan Underground River', unlock: 160, map: 'palawan', grass: 1, icon: 'fig_wild',
    shut: 'The Underground River is far down south, in Palawan',
    opened: 'PALAWAN UNDERGROUND RIVER IS OPEN\nKanor: "160 hunts! Ride my Jeep by the Lodge to Sabang. Mang Pido rows you in."',

    items: {
      fig_wild: { name: 'Wild Figs', kind: 'hunt', sell: 60, energy: 12, standIn: 'berry', desc: 'Sweet wild figs. A Paniki drops the fruit it was carrying.' },
      wing_paniki: { name: 'Paniki Wing', kind: 'hunt', sell: 140, standIn: 'fur_bear', desc: 'A soft folded fruit-bat wing. Kanor makes the Cavern Hat with it.' },
      skin_sawa: { name: 'Sawa Skin', kind: 'hunt', sell: 260, standIn: 'hide_rhino', desc: 'Patterned python skin, tough and light.' },
      scale_sawa: { name: 'Sawa Scale', kind: 'hunt', sell: 320, standIn: 'jade', desc: 'A shiny brown-and-gold python scale.' },
      golden_scale: { name: 'Golden Scale', kind: 'hunt', sell: 2600, standIn: 'gold_tusk', desc: 'From the rare Golden Sawa. It glows a little.' },
      shell_crab: { name: 'Crab Shell', kind: 'hunt', sell: 300, standIn: 'claw_tiger', desc: 'A blue claw shell from a Cave Crab. Cook Ginataang Alimasag with it.' },
      glow_light: { name: 'Glow Light', kind: 'hunt', sell: 380, standIn: 'santelmo_flame', desc: 'A jar of cyan light from a Glow Eel.' },
      nest_swiftlet: { name: 'Swiftlet Nest', kind: 'hunt', sell: 900, standIn: 'egg_l', desc: 'A little white cup of a nest, from the Balinsasayaw Queen.' },
      feather_minokawa: { name: 'Minokawa Feather', kind: 'hunt', sell: 3200, standIn: 'blue_feather', desc: 'A long silver feather from the moon-eating bird.' },
      stalactite_chip: { name: 'Stalactite Chip', kind: 'hunt', sell: 150, standIn: 'crystal', desc: 'A pale limestone tip from the River Caves.' },
      cashew_palawan: { name: 'Palawan Cashews', kind: 'goods', sell: 70, energy: 25, standIn: 'cookie', desc: 'Roasted cashews from Palawan. A good snack on the trail.' },
      ginataang_alimasag: { name: 'Ginataang Alimasag', kind: 'dish', sell: 420, energy: 120, standIn: 'veggie_stew', desc: 'Crab cooked in coconut milk with ginger and chili.' },
    },

    creatures: {
      // a fruit bat: shy, it flies off; it drops the fruit it carried (owner, 6 Nov 2026)
      paniki: { name: 'Paniki', sheet: 'wild_paniki', row: 0, sheetRow: 'labuyo', tint: 0x9a7a62, px: 165, w: 0.85, kg: 0.9, hp: 2, walk: 0.7, run: 5.2, shy: 3.6, flies: true,
        drops: [['fig_wild', 1, 1], ['wing_paniki', 1, 0.6]] },
      // a cute chubby python: it charges
      sawa: { name: 'Sawa', sheet: 'wild_sawa', row: 0, sheetRow: 'boar', tint: 0xc8a466, px: 178, w: 1.5, ground: true, kg: 45, hp: 8, walk: 0.6, run: 3.8, angry: 3, hit: 16,
        drops: [['skin_sawa', 1, 1], ['scale_sawa', 1, 0.6]] },
      golden_sawa: { name: 'Golden Sawa', sheet: 'wild_goldensawa', row: 0, sheetRow: 'goldboar', tint: 0xffe07a, px: 178, w: 1.7, ground: true, kg: 70, hp: 12, walk: 0.6, run: 4, angry: 3.4, hit: 18,
        rare: true, respawn: 120, drops: [['skin_sawa', 2, 1], ['golden_scale', 1, 1]] },
      // the tame one: a Paniki pup, never for the Bow (the grown Paniki above is the one you hunt)
      paniki_pup: { name: 'Paniki Pup', sheet: 'wild_paniki', row: 0, sheetRow: 'labuyo', tint: 0xb89478, px: 165, w: 0.65, kg: 0.4, hp: 1, walk: 0.6, run: 4.4, shy: 2.4, flies: true, drops: [] },
    },
    animals: { paniki: 3, sawa: 3 },
    extra: [{ kind: 'paniki', n: 2, when: 'dusk' }, { kind: 'sawa', n: 1, when: 'rain' }, { kind: 'golden_sawa', n: 1, when: 'rare' }],

    // the Paniki pup: a mango (the game has it), 10 feedings, it may fly off; it spots a rare one for you
    tame: { kind: 'paniki_pup', food: 'mango', feedings: 10, runOff: 0.25, back: 25, skill: 'spot' },

    gear: { name: 'Cavern', pieces: {
      head: { id: 'cavern_hat', name: 'Cavern Hat', standIn: 'gear_cloak', needs: [['wing_paniki', 8], ['glow_light', 3]], gold: 6000 },
      body: { id: 'cavern_vest', name: 'Cavern Vest', standIn: 'gear_cloak', needs: [['skin_sawa', 8], ['scale_sawa', 4], ['shell_crab', 4]], gold: 10000 },
      feet: { id: 'cavern_boots', name: 'Cavern Boots', standIn: 'gear_boots', needs: [['skin_sawa', 4], ['shell_crab', 6], ['stalactite_chip', 6]], gold: 6000 },
      charm: { id: 'cavern_charm', name: 'Cavern Charm', standIn: 'gear_charm', needs: [['feather_minokawa', 2], ['nest_swiftlet', 3], ['golden_scale', 1]], gold: 12000 },
    } },

    // 5 hidden chests (tiles of maps/palawan.json, kept free there)
    chests: [[3, 4], [11, 9], [28, 5], [16, 21], [29, 21]],
    chestLoot: [['arrows', 8, 1], ['cashew_palawan', 2, 1], ['stalactite_chip', 2, 0.7], ['mango', 2, 0.5]],

    // Mang Pido, the Sabang boatman, at the land end of his dock: first visit, a few hunts, the guard, the boss
    npc: { name: 'Mang Pido', look: 'hollis', sheet: 'npc_mang_pido', at: [21, 14], lines: [
      { text: 'Magandang araw! I am Pido, I row the bangka at Sabang. Up by the cliff the river goes into the rock: the River Caves. Hunt out here first. The Sawa will test you. Here, mangoes for the Paniki pups.', gift: [['mango', 3]] },
      { text: 'Not bad, hunter! The pups love mangoes. Walk slowly, feed one while it is calm, ten times, and it is your friend for life. Take some cashews for the road.', need: { hunts: 5 }, hint: 'Hunt here a few more times.', gift: [['cashew_palawan', 3]] },
      { text: 'You beat the Balinsasayaw Queen? The swiftlets were singing about you all morning. Ingat on the way down. Take these arrows.', need: { guard: 1 }, hint: 'Beat the guard on floor 5 of the River Caves.', gift: [['arrows', 15]] },
      { text: 'The Minokawa! My lolo said it wanted to swallow the moon. You only sent it home to the sky. My lola cooked this for you. Salamat, hunter!', need: { boss: 1 }, hint: 'Beat the boss on floor 10 of the River Caves.', gift: [['ginataang_alimasag', 1]] },
    ] },

    dungeon: {
      key: 'palawan_cave', name: 'River Caves', floors: 10, liftEvery: 5, guardFloor: 5, bossFloor: 10,
      count: { base: 3, per: 3, max: 6 }, escort: 2,
      creatures: {
        cave_crab: { name: 'Cave Crab', sheet: 'wild_cavecrab', row: 0, sheetRow: 'sigbin', tint: 0x7ab4ff, px: 162, w: 1, ground: true, kg: 4, hp: 6, walk: 0.7, run: 4, angry: 2.6, hit: 14,
          drops: [['shell_crab', 1, 1], ['stalactite_chip', 1, 0.5]] },
        glow_eel: { name: 'Glow Eel', sheet: 'wild_gloweel', row: 0, sheetRow: 'santelmo', tint: 0x7affee, px: 128, w: 1, ground: true, kg: 6, hp: 7, walk: 0.9, run: 4.8, angry: 3.6, hit: 15,
          drops: [['glow_light', 1, 1], ['stalactite_chip', 1, 0.4]] },
        // the floor 5 guard: a giant cave swiftlet
        balinsasayaw: { name: 'Balinsasayaw Queen', sheet: 'wild_balinsasayaw', row: 0, sheetRow: 'labuyo', tint: 0xd8e0ff, px: 165, w: 2.2, kg: 30, hp: 28, walk: 0.8, run: 4.4, angry: 4, hit: 17, boss: true,
          drops: [['nest_swiftlet', 2, 1], ['stalactite_chip', 3, 1], ['glow_light', 1, 0.6]] },
        // the floor 10 boss: the giant moon-eating bird of Bagobo legend, grand but cute; soloable, more with friends
        minokawa: { name: 'Minokawa', sheet: 'wild_minokawa', row: 0, sheetRow: 'bakunawa', tint: 0xe8f2ff, px: 143, w: 3.4, kg: 2500, hp: 42, hpEach: 14, minHits: 3,
          walk: 0.6, run: 3.4, angry: 3.6, hit: 20, ground: true, boss: true, drops: [['feather_minokawa', 2, 1], ['nest_swiftlet', 1, 1], ['golden_scale', 1, 0.1]] },
      },
      floorKinds: [['cave_crab', 1, 10], ['glow_eel', 3, 10]],
      guard: 'balinsasayaw', boss: 'minokawa',
      // the boss's daily chest (stacks to 3)
      chest: [['feather_minokawa', 1, 1], ['stalactite_chip', 4, 1], ['arrows', 15, 1], ['golden_scale', 1, 0.25], ['cashew_palawan', 2, 0.5]],
      // wet limestone, a turquoise underground river
      look: { floor: ['#14262a', '#3e6462', '#93b6ae'], wall: ['#101c1e', '#3a5654', '#a6bcb2'], top: ['#081214', '#1a2e30', '#3a5654'], crust: ['#0c1a1c', '#22403e', '#4a7470'] },
      lava: { rim: '#06201f', hot: ['#c4fff2', '#3fd6c6', '#0f8a8c'], plate: ['rgba(8,64,72,0.85)', 'rgba(26,118,126,0.8)'], embers: false },
      bg: '#061618', propTint: 0xb4d6ce, icon: 'feather_minokawa',
      art: { mouth: 'props/palawan_mouth', gate: 'props/palawan_gate', cave: 'palawan_cave' },
    },
  });

  // The local dish: cooked in the Kitchen (C.RECIPES is a list by name, not saved by index); its power, by its id.
  C.RECIPES.push({ dish: 'ginataang_alimasag', needs: ['shell_crab', 'ginger', 'chili'] });
  if (C.DISH_POWERS) {
    C.DISH_POWERS.ginataang_alimasag = { key: 'charge', text: 'charges cost half the energy' };
    C.ITEMS.ginataang_alimasag.desc += ' For ' + C.DISH_POWER_MINS + ' minutes, ' + C.DISH_POWERS.ginataang_alimasag.text + '.';
  }
})(window.Farm = window.Farm || {});
