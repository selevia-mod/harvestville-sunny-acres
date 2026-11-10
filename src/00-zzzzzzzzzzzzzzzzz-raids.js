// Farm Raids, the content (owner, 9 Nov 2026; docs/raids.md). Step 1: the Raid Camp, 8 raiders, 10 defenses, and
// practice raids on bandit farms the game makes. Every number here is a starting point: in step 2 the server sends its
// own (owner: "make it adjustable percentage, not totally fix"), and these stay as the fallback.
(function (F) {
  'use strict';
  var C = F.Config;
  C.FRAID = {
    battle: { secs: 120, tick: 100, w: 16, h: 22, edge: 2, keep: 2, keepReal: 3 }, // (keepReal, owner 10 Nov 2026: a real farm's red zone: 3 tiles round every crop, defense and loot, and never on the field or in the pen) // (keep: on a real farm, raiders come down this many tiles from anything: nearly anywhere in the field) // a battle: 2 minutes, 10 steps a second, a 16 x 22 farm (a phone held upright)
    // the Raid Camp: its level opens raiders and makes the raid party bigger (housing space)
    // (owner, 9 Nov 2026: "Upgrading camp is too easy, i was camp 7 instant": each level now needs lumber, stone, things
    // from hunting and building time (mins); the camp still raids and trains while it builds)
    camp: { price: 3000, levels: [
      { space: 10, gold: 0, open: ['goat', 'crow'] },
      { space: 15, gold: 4000, lumber: 40, stone: 20, need: null, mins: 30, open: ['cat'] },
      { space: 20, gold: 9000, lumber: 80, stone: 40, need: null, mins: 120, open: ['carabao'] },
      { space: 25, gold: 16000, lumber: 120, stone: 60, need: ['fur_rabbit', 3], mins: 240, open: ['monkey'] },
      { space: 30, gold: 26000, lumber: 160, stone: 80, need: ['pelt_wolf', 2], mins: 480, open: ['boar'] },
      { space: 35, gold: 40000, lumber: 220, stone: 120, need: ['hide_rhino', 1], mins: 720, open: ['rooster'] },
      { space: 40, gold: 60000, lumber: 300, stone: 160, need: ['tusk_mammoth', 1], mins: 1440, open: ['bayawak'] },
    ] },
    // 8 raiders: space (in the party), train cost and time, and per level (1-5): hp, damage, speed (tiles a second),
    // (train Gold halved 10 Nov 2026: a raid should earn more than its army costs, owner's approved plan)
    // carry (how much loot it grabs a second). likes: what it goes for. weak: the defense that beats it.
    raiders: {
      goat: { name: 'Goat', sheet: 'wild_kambing', kind: 'kambing', space: 1, gold: 20, secs: 20, hp: 39, dmg: 4, speed: 1.6, carry: 3, likes: 'crops', weak: 'all',
        say: 'Cheap and hungry: eats crops fast, but weak.' },
      crow: { name: 'Crows', sheet: 'raid_crow', space: 1, gold: 25, secs: 25, hp: 23, dmg: 2, speed: 2.4, carry: 2, likes: 'crops', flies: true, weak: 'scarecrow',
        say: 'Fly over fences and grab crops. Scarecrows scare them away.' },
      cat: { name: 'Cat', sheet: 'cat', space: 2, gold: 45, secs: 40, hp: 52, dmg: 6, speed: 2.6, carry: 3, likes: 'produce', weak: 'dog',
        say: 'Fast and sneaky: steals eggs and milk. The guard dog can catch it.' },
      carabao: { name: 'Carabao', sheet: 'wild_carabaoligaw', kind: 'carabaoligaw', space: 5, gold: 150, secs: 120, hp: 338, dmg: 18, speed: 0.9, carry: 2, likes: 'fences', weak: 'beebox',
        say: 'Very tough: breaks fences. Slow, and bees sting it.' },
      monkey: { name: 'Monkey', sheet: 'wild_unggoy', kind: 'unggoy', space: 2, gold: 70, secs: 50, hp: 65, dmg: 6, speed: 2.2, carry: 4, likes: 'stall', weak: 'goose',
        say: 'Climbs into the market stall and takes what is on it. Geese chase it off.' },
      boar: { name: 'Wild Boar', sheet: 'wild', kind: 'boar', space: 4, gold: 110, secs: 90, hp: 208, dmg: 22, speed: 1.4, carry: 2, likes: 'defenses', weak: 'mudpit',
        say: 'Charges and knocks down scarecrows and traps. Mud pits stop it.' },
      rooster: { name: 'Rooster', sheet: 'wild', kind: 'labuyo', space: 2, gold: 60, secs: 45, hp: 91, dmg: 10, speed: 1.9, carry: 1, likes: 'guards', weak: 'tower',
        say: 'A fighter: keeps the dog and the goose busy. The watchtower hits it.' },
      bayawak: { name: 'Bayawak', sheet: 'wild_bayawak', kind: 'bayawak', space: 3, gold: 130, secs: 80, hp: 117, dmg: 8, speed: 1.6, carry: 6, likes: 'gold', weak: 'kampana', through: true,
        say: 'Slips through hedges to the Gold pot. The Kampana gives it away.' },
    },
    raiderOrder: ['goat', 'crow', 'cat', 'carabao', 'monkey', 'boar', 'rooster', 'bayawak'],
    // a raider's level: hp, damage and carry x this (9 Nov 2026: softer at the top, so a max camp can lose to a well-defended farm);
    // the upgrade's Gold, and one thing from hunting
    level: { mult: [1, 1.2, 1.4, 1.65, 1.9], gold: [0, 1500, 4000, 9000, 18000], need: [null, ['fur_rabbit', 3], ['feather_labuyo', 5], ['pelt_wolf', 2], ['hide_rhino', 1]] },
    // 10 defenses: hp, damage a second, range (tiles), what it does; per level x the same mult. place: how it is set.
    defenses: {
      dog: { name: 'Guard Dog', hp: 140, dps: 3.75, range: 2.5, chases: true, beats: 'cat', say: 'Your dog: chases and bites raiders.' },
      scarecrow: { name: 'Scarecrow', hp: 90, dps: 0, range: 3, scares: ['crow', 'goat'], beats: 'crow', say: 'Scares crows and goats away nearby.' },
      fence: { name: 'Strong Fence', hp: 120, dps: 0, range: 0, blocks: true, beats: 'goat', say: 'Blocks the way. Carabao and boar break it.' },
      goose: { name: 'Guard Goose', hp: 110, dps: 3.75, range: 2.5, chases: true, slows: 0.5, beats: 'monkey', say: 'Honks and bites, slows raiders.' },
      beebox: { name: 'Bee Box', hp: 70, dps: 3.38, range: 2.5, area: true, beats: 'carabao', say: 'A swarm stings everything nearby.' },
      mudpit: { name: 'Mud Pit', hp: 0, dps: 0, range: 0.8, trap: true, stuck: 6, hidden: true, beats: 'boar', say: 'Hidden: whoever steps in is stuck for a while.' },
      sprinkler: { name: 'Sprinkler Blaster', hp: 80, dps: 2.25, range: 3, push: true, say: 'Sprays raiders and pushes them back.' },
      tower: { name: 'Bamboo Watchtower', hp: 140, dps: 4.5, range: 5, beats: 'rooster', say: 'A farmhand with a slingshot, far-reaching.' },
      sili: { name: 'Sili Patch', hp: 60, dps: 0, range: 1, scares: ['goat', 'boar', 'monkey'], hot: true, say: 'Raiders who bite it run off crying.' },
      kampana: { name: 'Kampana', hp: 100, dps: 0, range: 6, alarm: 1.3, beats: 'bayawak', say: 'Rings when raiders come: every defense hits harder for a while.' },
    },
    defenseOrder: ['dog', 'scarecrow', 'fence', 'goose', 'beebox', 'mudpit', 'sprinkler', 'tower', 'sili', 'kampana'],
    // a defense's level (9 Nov 2026, owner: "a strategic game": a max camp must not always win): its own, steeper curve
    // (10 Nov 2026, with the limits per camp: tuned by simulated battles, like Clash of Clans: an equal camp wins 1-2 stars, two
    // levels higher about 3, two lower about 1; raiders' hp x1.3 and defenses' damage x0.375 against 9 Nov's, a flatter curve; x0.3 until raiders scared off began looking elsewhere)
    defLevel: { gold: [0, 2000, 5000, 11000, 22000], mult: [1, 1.2, 1.45, 1.7, 2] },
    // how many of each a farm may have, by its Raid Camp's level (owner, 10 Nov 2026: "If I can buy 100 tower, looks like
    // it was imbalance"; like a Town Hall's limits). tier: camp level 0-7 -> a column. More than that: the rest are only
    // decoration in a raid. fence: Strong Fences (plain fences are walls, as before)
    caps: { tier: [0, 0, 0, 1, 1, 2, 2, 3], tower: [1, 2, 3, 4], goose: [1, 2, 2, 3], beebox: [1, 2, 3, 3], sprinkler: [0, 1, 2, 3], kampana: [0, 1, 1, 1],
      mudpit: [2, 3, 4, 5], sili: [2, 3, 4, 5], scarecrow: [4, 4, 5, 6], fence: [20, 40, 60, 80] },
    counter: 2, // a defense hits the raider it beats (its 'beats') this many times harder (3 until 10 Nov 2026)
    // loot: the cap by power (owner: 10% .. 30%), stars at 50% / 100% of the cap and the main building
    loot: { low: 0.1, mid: 0.2, high: 0.3, stronger: 1.5, weaker: 2 / 3 },
    // Farm Power: these weights (adjustable)
    power: { raider: 3, defense: 4, farm: 10 },
    // practice: the bandit farms (step 1), from easy to hard; points and gold come from the game, never from a player
    bandits: [ // (9 Nov 2026: tuned by playing each with the party a camp of its level holds: docs/raids.md)
      { key: 'b1', name: 'Bandit Shack', defs: { fence: 4 }, lv: 1, loot: { gold: 400, crops: 12, produce: 6, stall: 4 } },
      { key: 'b2', name: 'Bandit Patch', defs: { scarecrow: 1, fence: 6 }, lv: 1, loot: { gold: 600, crops: 20, produce: 10, stall: 8 } },
      { key: 'b3', name: 'Bandit Ranch', defs: { scarecrow: 1, fence: 8, dog: 1, beebox: 1 }, lv: 1, loot: { gold: 900, crops: 28, produce: 14, stall: 12 } },
      { key: 'b4', name: 'Bandit Orchard', defs: { scarecrow: 2, fence: 8, dog: 1, goose: 1, beebox: 1, mudpit: 1, tower: 1 }, lv: 2, loot: { gold: 1300, crops: 36, produce: 18, stall: 16 } },
      { key: 'b5', name: 'Bandit Hacienda', defs: { scarecrow: 2, fence: 10, dog: 1, goose: 1, beebox: 1, mudpit: 1, tower: 1, sili: 1, sprinkler: 1, kampana: 1 }, lv: 2, loot: { gold: 2000, crops: 48, produce: 24, stall: 24 } },
    ],

    points: [0, 10, 25, 50], // Raid Points by stars
    lootValue: { gold: 1, crops: 15, produce: 25, stall: 20 }, // each kind's worth in Gold: the stars and a practice prize
  };
  // the raid icons (art-src/raids/raid_icons.png: the 8 raiders' heads, Raid Points, a shield, the raid flag, a bandit),
  // appended to the icons (nothing moves); C.FRAID_ICONS_IN once their picture is in (tools/art/raids-import.js)
  C.FRAID_ICONS = ['ri_goat', 'ri_crow', 'ri_cat', 'ri_carabao', 'ri_monkey', 'ri_boar', 'ri_rooster', 'ri_bayawak', 'ri_points', 'ri_shield', 'ri_flag', 'ri_bandit'];
  C.FRAID_ICONS.forEach(function (n) { if (C.ICON_ORDER.indexOf(n) < 0) C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.FRAID_ICONS_IN = true;
  // the Farm Shield (owner, 9 Nov 2026): a day's story chapter gives one; used from the bag, nobody can raid your farm
  // for 24 hours, and it breaks when you raid another player's farm (practice does not break it)
  C.ITEMS.farm_shield = { name: 'Farm Shield', icon: C.ICON.ri_shield, kind: 'boost', desc: 'Use it: nobody can raid your farm for 24 hours. Raiding another farm breaks it.' };
  C.FRAID.shield = { hours: 24 };

  // ---------- what you place on your farm (owner, 9 Nov 2026: "use the real farm design, let the player design it") ----------
  // The Raid Camp (Workshops) and the new defenses (their own group at Mira's); your fences, scarecrows and dog defend too.
  // Appended to the yard's pieces (a save keeps their numbers: only ever add at the end).
  var O = C.OUTDOOR;
  if (!O.cats.some(function (c) { return c[0] === 'defenses'; })) O.cats.push(['defenses', 'Defenses', 'They guard your farm in a raid. Fences, scarecrows and your dog help too. Level them up at your Raid Camp.']);
  C.FRAID_PIECES = [
    { key: 'raid_camp', name: 'Raid Camp', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: C.FRAID.camp.price, beauty: 4, one: true, hd: 'raid_camp', what: 'a bamboo raid camp with a pennant flag' },
    { key: 'def_goose', name: 'Guard Goose', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 1, price: 1500, beauty: 2, hd: 'def_goose', defense: 'goose', what: 'a brave guard goose in a little cap' },
    { key: 'def_beebox', name: 'Bee Box', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 1, price: 1800, beauty: 2, hd: 'def_beebox', defense: 'beebox', what: 'a wooden bee box with bees' },
    { key: 'def_mudpit', name: 'Mud Pit', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 0, price: 1200, beauty: 0, hd: 'def_mudpit', defense: 'mudpit', flat: true, what: 'a gooey mud pit' },
    { key: 'def_tower', name: 'Bamboo Watchtower', kind: 'prop', cat: 'defenses', w: 1, h: 2, foot: 1, price: 3000, beauty: 3, hd: 'def_tower', defense: 'tower', what: 'a bamboo watchtower with a farmhand' },
    { key: 'def_sili', name: 'Sili Patch', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 1, price: 900, beauty: 2, hd: 'def_sili', defense: 'sili', what: 'a patch of hot red chili plants' },
    { key: 'def_kampana', name: 'Kampana', kind: 'prop', cat: 'defenses', w: 1, h: 2, foot: 1, price: 2500, beauty: 3, hd: 'def_kampana', defense: 'kampana', what: 'a bronze bell in a little wooden frame' },
    { key: 'def_fence', name: 'Strong Fence', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 1, price: 300, beauty: 1, hd: 'def_fence', defense: 'fence', strong: true, what: 'a fence section with iron bands' },
    // (appended: a piece's place is its index in the save)
    { key: 'def_sprinkler', name: 'Sprinkler Blaster', kind: 'prop', cat: 'defenses', w: 1, h: 1, foot: 1, price: 2200, beauty: 2, hd: 'def_sprinkler', defense: 'sprinkler', what: 'a brass sprinkler with a water tank' },
  ];
  C.FRAID_PIECES.forEach(function (p) { if (O.index[p.key] == null) { O.index[p.key] = O.types.length; O.types.push(p); } });
  // (the Workshops page says the Raid Camp is there too)
  O.cats.filter(function (c) { return c[0] === 'workshops'; })[0][2] = 'A Bakery, a Dairy, a Jam Maker and a Tannery make goods while you play (or sleep). The Raid Camp trains raiders.';
  // the yard pieces that defend in a raid (beside the new ones): which defense each one is
  C.FRAID_YARD_DEF = { scarecrow: 'scarecrow' };
  // the battle's effects: frames of assets/raid_fx (tools/art/raids-import.js, prompt #7), in this order
  C.FRAID_FX = ['bees', 'pebble', 'water', 'mud', 'honk', 'star', 'puff'];
  // step 2, real raids between players (the server's own numbers are in farm.fraid_config, part 25; these are what the phone
  // shows and takes: keep them the same)
  C.FRAID.daily = 5;
  C.FRAID.real = { energy: 10, nextGold: 50, shieldHours: 8 };
})(window.Farm = window.Farm || {});
