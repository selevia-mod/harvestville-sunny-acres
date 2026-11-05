// SAMPLE PLACE (engine proof, 6 Nov 2026): NOT A REAL PLACE. A tiny map (maps/sample_place.json) and a 2-floor cave
// (maps/sample_cave.json) that prove the hunting-places engine end to end: one animal, a tame, one hidden chest, one
// person with a story, a guard and a boss. Every creature is a stand-in (another animal's row of the wild sheet, tinted),
// every item borrows an existing icon. dev: true keeps it out of the Jeep, the Medals page and the % explored unless
// window.gameHost.devPlaces is set (the tests set it). The place agents delete this file and the two maps (and the
// sample tests in test/places.test.js, test/e2e.test.js and test/e2e-online.test.js) when the first real place is in.
(function (F) {
  'use strict';
  F.addPlace({
    id: 'sample_place', n: 99, dev: true, name: 'Sample Place', unlock: 0, map: 'sample_place',
    items: {
      sample_hide: { name: 'Sample Hide', kind: 'hunt', sell: 30, standIn: 'fur_rabbit', desc: 'SAMPLE: a stand-in drop.' },
      sample_fang: { name: 'Sample Fang', kind: 'hunt', sell: 90, standIn: 'fang_wolf', desc: 'SAMPLE: a stand-in drop from the cave.' },
    },
    creatures: {
      sample_hog: { name: 'Sample Hog', sheetRow: 'boar', tint: 0x9ad0ff, px: 178, w: 1.3, ground: true, kg: 50, hp: 2, walk: 0.7, run: 3.4, angry: 2.6, hit: 8,
        drops: [['sample_hide', 1, 1]] },
      // the tame one: calm, a little shy (sneak up), never for the Bow
      sample_kid: { name: 'Sample Kid', sheetRow: 'deer', tint: 0xffe0a0, px: 179, w: 1.1, kg: 30, hp: 1, walk: 0.6, run: 3.6, shy: 2, drops: [] },
    },
    animals: { sample_hog: 1 },
    tame: { kind: 'sample_kid', food: 'berry', feedings: 3, runOff: 0.25, back: 10, skill: 'fetch' },
    gear: { name: 'Sample', pieces: {
      head: { name: 'Sample Hat', standIn: 'gear_cloak', needs: [['sample_hide', 1]], gold: 100 },
      body: { name: 'Sample Vest', standIn: 'gear_cloak', needs: [['sample_hide', 1]], gold: 100 },
      feet: { name: 'Sample Shoes', standIn: 'gear_boots', needs: [['sample_hide', 1]], gold: 100 },
      charm: { name: 'Sample Charm', standIn: 'gear_charm', needs: [['sample_fang', 1]], gold: 100 },
    } },
    chests: [[4, 3]],
    chestLoot: [['arrows', 5, 1], ['sample_hide', 2, 1]],
    npc: { name: 'Sample Guide', look: 'hale', at: [11, 4], lines: [
      { text: 'SAMPLE: Welcome! This place only proves the engine.' },
      { text: 'SAMPLE: You hunted here. Try to tame the little one with berries.', need: { hunts: 1 } },
      { text: 'SAMPLE: A friend for life! Now the cave.', need: { tame: 1 } },
      { text: 'SAMPLE: You beat the cave boss. Well done.', need: { boss: 1 } },
    ] },
    dungeon: {
      key: 'sample_cave', name: 'Sample Cave', floors: 2, liftEvery: 1, guardFloor: 1, bossFloor: 2, count: { base: 1, per: 9, max: 1 },
      creatures: {
        sample_bat: { name: 'Sample Bat', sheetRow: 'santelmo', tint: 0xa0ffd0, px: 128, w: 0.85, kg: 0.5, hp: 1, walk: 0.9, run: 5, shy: 3.4, flies: true, drops: [['sample_fang', 1, 0.5]] },
        sample_guard: { name: 'Sample Guard', sheetRow: 'sigbin', tint: 0xc0a0ff, px: 162, w: 1.2, kg: 40, hp: 4, walk: 0.8, run: 4, angry: 3, hit: 8, ground: true, boss: true,
          drops: [['sample_fang', 1, 1]] },
        // soloable; with friends, hpEach more for each one (like the Bakunawa); minHits to share it
        sample_boss: { name: 'Sample Boss', sheetRow: 'bungisngis', tint: 0xffa0a0, px: 164, w: 2, kg: 300, hp: 6, hpEach: 4, minHits: 2, walk: 0.6, run: 3.4, angry: 4, hit: 12,
          ground: true, boss: true, drops: [['sample_fang', 2, 1]] },
      },
      floorKinds: [['sample_bat', 1, 2]], // who is on each floor: [kind, from floor, to floor]
      guard: 'sample_guard', boss: 'sample_boss',
      chest: [['sample_fang', 2, 1], ['arrows', 10, 1]],
      look: { floor: ['#0b1a22', '#1d4656', '#3f8a9a'], wall: ['#08141a', '#1c4250', '#4a8ea0'], top: ['#04090c', '#0e232b', '#1d4656'], crust: ['#06121a', '#0f2a36', '#1d4a5c'] },
      lava: { rim: '#06161e', hot: ['#bff4ff', '#4ec4e0', '#1a6a8c'], plate: ['rgba(10,40,60,0.85)', 'rgba(20,70,100,0.8)'], glow: true },
      bg: '#06141a', propTint: 0x9cc8d8,
    },
  });
})(window.Farm = window.Farm || {});
