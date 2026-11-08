// Farm Raids, the content (owner, 9 Nov 2026; docs/raids.md). Step 1: the Raid Camp, 8 raiders, 10 defenses, and
// practice raids on bandit farms the game makes. Every number here is a starting point: in step 2 the server sends its
// own (owner: "make it adjustable percentage, not totally fix"), and these stay as the fallback.
(function (F) {
  'use strict';
  var C = F.Config;
  C.RAID = {
    battle: { secs: 120, tick: 100, w: 26, h: 20, edge: 2 }, // a battle: 2 minutes, 10 steps a second, a 26 x 20 farm
    // the Raid Camp: its level opens raiders and makes the raid party bigger (housing space)
    camp: { price: 3000, levels: [
      { space: 10, gold: 0, open: ['goat', 'crow'] },
      { space: 15, gold: 4000, open: ['cat'] },
      { space: 20, gold: 9000, open: ['carabao'] },
      { space: 25, gold: 16000, open: ['monkey'] },
      { space: 30, gold: 26000, open: ['boar'] },
      { space: 35, gold: 40000, open: ['rooster'] },
      { space: 40, gold: 60000, open: ['bayawak'] },
    ] },
    // 8 raiders: space (in the party), train cost and time, and per level (1-5): hp, damage, speed (tiles a second),
    // carry (how much loot it grabs a second). likes: what it goes for. weak: the defense that beats it.
    raiders: {
      goat: { name: 'Goat', sheet: 'wild_kambing', kind: 'kambing', space: 1, gold: 40, secs: 20, hp: 30, dmg: 4, speed: 1.6, carry: 3, likes: 'crops', weak: 'all',
        say: 'Cheap and hungry: eats crops fast, but weak.' },
      crow: { name: 'Crows', sheet: 'raid_crow', space: 1, gold: 50, secs: 25, hp: 18, dmg: 2, speed: 2.4, carry: 2, likes: 'crops', flies: true, weak: 'scarecrow',
        say: 'Fly over fences and grab crops. Scarecrows scare them away.' },
      cat: { name: 'Cat', sheet: 'cat', space: 2, gold: 90, secs: 40, hp: 40, dmg: 6, speed: 2.6, carry: 3, likes: 'produce', weak: 'dog',
        say: 'Fast and sneaky: steals eggs and milk. The guard dog can catch it.' },
      carabao: { name: 'Carabao', sheet: 'wild_carabaoligaw', kind: 'carabaoligaw', space: 5, gold: 300, secs: 120, hp: 260, dmg: 18, speed: 0.9, carry: 2, likes: 'fences', weak: 'beebox',
        say: 'Very tough: breaks fences. Slow, and bees sting it.' },
      monkey: { name: 'Monkey', sheet: 'wild_unggoy', kind: 'unggoy', space: 2, gold: 140, secs: 50, hp: 50, dmg: 6, speed: 2.2, carry: 4, likes: 'stall', weak: 'goose',
        say: 'Climbs into the market stall and takes what is on it. Geese chase it off.' },
      boar: { name: 'Wild Boar', sheet: 'wild', kind: 'boar', space: 4, gold: 220, secs: 90, hp: 160, dmg: 22, speed: 1.4, carry: 2, likes: 'defenses', weak: 'mudpit',
        say: 'Charges and knocks down scarecrows and traps. Mud pits stop it.' },
      rooster: { name: 'Rooster', sheet: 'wild', kind: 'labuyo', space: 2, gold: 120, secs: 45, hp: 70, dmg: 10, speed: 1.9, carry: 1, likes: 'guards', weak: 'tower',
        say: 'A fighter: keeps the dog and the goose busy. The watchtower hits it.' },
      bayawak: { name: 'Bayawak', sheet: 'wild_bayawak', kind: 'bayawak', space: 3, gold: 260, secs: 80, hp: 90, dmg: 8, speed: 1.6, carry: 6, likes: 'gold', weak: 'kampana', through: true,
        say: 'Slips through hedges to the Gold pot. The Kampana gives it away.' },
    },
    raiderOrder: ['goat', 'crow', 'cat', 'carabao', 'monkey', 'boar', 'rooster', 'bayawak'],
    // a raider's level: hp and damage x this; the upgrade's Gold, and one thing from hunting
    level: { mult: [1, 1.25, 1.55, 1.9, 2.3], gold: [0, 1500, 4000, 9000, 18000], need: [null, ['fur_rabbit', 3], ['feather_labuyo', 5], ['pelt_wolf', 2], ['hide_rhino', 1]] },
    // 10 defenses: hp, damage a second, range (tiles), what it does; per level x the same mult. place: how it is set.
    defenses: {
      dog: { name: 'Guard Dog', hp: 160, dps: 14, range: 3, chases: true, beats: 'cat', say: 'Your dog: chases and bites raiders.' },
      scarecrow: { name: 'Scarecrow', hp: 90, dps: 0, range: 3, scares: ['crow', 'goat'], beats: 'crow', say: 'Scares crows and goats away nearby.' },
      fence: { name: 'Strong Fence', hp: 120, dps: 0, range: 0, blocks: true, beats: 'goat', say: 'Blocks the way. Carabao and boar break it.' },
      goose: { name: 'Guard Goose', hp: 110, dps: 10, range: 2.5, chases: true, slows: 0.5, beats: 'monkey', say: 'Honks and bites, slows raiders.' },
      beebox: { name: 'Bee Box', hp: 70, dps: 9, range: 2.5, area: true, beats: 'carabao', say: 'A swarm stings everything nearby.' },
      mudpit: { name: 'Mud Pit', hp: 0, dps: 0, range: 0.8, trap: true, stuck: 6, hidden: true, beats: 'boar', say: 'Hidden: whoever steps in is stuck for a while.' },
      sprinkler: { name: 'Sprinkler Blaster', hp: 80, dps: 6, range: 3, push: true, say: 'Sprays raiders and pushes them back.' },
      tower: { name: 'Bamboo Watchtower', hp: 140, dps: 12, range: 5, beats: 'rooster', say: 'A farmhand with a slingshot, far-reaching.' },
      sili: { name: 'Sili Patch', hp: 60, dps: 0, range: 1, scares: ['goat', 'boar', 'monkey'], hot: true, say: 'Raiders who bite it run off crying.' },
      kampana: { name: 'Kampana', hp: 100, dps: 0, range: 6, alarm: 1.3, beats: 'bayawak', say: 'Rings when raiders come: every defense hits harder for a while.' },
    },
    defenseOrder: ['dog', 'scarecrow', 'fence', 'goose', 'beebox', 'mudpit', 'sprinkler', 'tower', 'sili', 'kampana'],
    defLevel: { gold: [0, 2000, 5000, 11000, 22000] },
    // loot: the cap by power (owner: 10% .. 30%), stars at 50% / 100% of the cap and the main building
    loot: { low: 0.1, mid: 0.2, high: 0.3, stronger: 1.5, weaker: 2 / 3 },
    // Farm Power: these weights (adjustable)
    power: { raider: 3, defense: 4, farm: 10 },
    // practice: the bandit farms (step 1), from easy to hard; points and gold come from the game, never from a player
    bandits: [
      { key: 'b1', name: 'Bandit Shack', defs: { scarecrow: 1, fence: 4 }, lv: 1, loot: { gold: 800, crops: 12, produce: 6, stall: 4 } },
      { key: 'b2', name: 'Bandit Patch', defs: { scarecrow: 2, fence: 6, dog: 1 }, lv: 1, loot: { gold: 1500, crops: 20, produce: 10, stall: 8 } },
      { key: 'b3', name: 'Bandit Ranch', defs: { scarecrow: 2, fence: 8, dog: 1, goose: 1, beebox: 1 }, lv: 2, loot: { gold: 2600, crops: 28, produce: 14, stall: 12 } },
      { key: 'b4', name: 'Bandit Orchard', defs: { scarecrow: 3, fence: 8, dog: 1, goose: 1, beebox: 1, mudpit: 2, tower: 1 }, lv: 2, loot: { gold: 4000, crops: 36, produce: 18, stall: 16 } },
      { key: 'b5', name: 'Bandit Hacienda', defs: { scarecrow: 3, fence: 10, dog: 1, goose: 2, beebox: 2, mudpit: 2, tower: 2, sili: 2, sprinkler: 1, kampana: 1 }, lv: 3, loot: { gold: 7000, crops: 48, produce: 24, stall: 24 } },
    ],
    points: [0, 10, 25, 50], // Raid Points by stars
  };
})(window.Farm = window.Farm || {});
