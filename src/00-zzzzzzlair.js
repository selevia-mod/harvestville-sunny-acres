// Bakunawa's Lair (owner, 4 Nov 2026: "Use agent and build this": a dungeon inside Magayon, "like mine but something
// else so players have something to grind"). Floors of lava caves under the volcano; on each one, fire creatures from
// Filipino legend (drawn cute) to clear with the Bow, and the gate down opens when they are all down. Every 10th floor a
// Bungisngis guards it; on floor 50 the Bakunawa, the moon-eating sea serpent, which only rises for two or more hunters.
// What they leave: Ember Shards, Obsidian, their parts, and the rare Bakunawa Scale, for the Magma Bow and the Fire
// Charm at Kanor's. Rules 01-logicN.js; the cave 19zt-lair.js; Kanor's rows, the tour 19zu-lair-ui.js. Design:
// docs/lair-design.md. Loaded after every other 00- file: its icons and animals are appended.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;

  // ---------- the creatures (appended to C.WILD.order: the save counts them in that order) ----------
  // Each has its own row of assets/wild.png (art-src/lair/wild_<kind>.png, 4 Nov 2026). lair: true keeps them out of the
  // Wild Lands' own places.
  var KINDS = {
    santelmo: { name: 'Santelmo', px: 128, w: 0.85, kg: 0.4, hp: 2, walk: 0.9, run: 5, shy: 3.4, flies: true,
      drops: [['ember_shard', 1, 1], ['santelmo_flame', 1, 0.5]] },
    sigbin: { name: 'Sigbin', px: 162, w: 1, kg: 12, hp: 3, walk: 0.8, run: 4.4, angry: 3, hit: 8, ground: true,
      drops: [['ember_shard', 2, 1], ['sigbin_horn', 1, 0.5]] },
    // upright and tall, so narrower than its height: bar puts its health bar over its head, not at the width's height
    tikbalang: { name: 'Tikbalang', px: 110, w: 1.1, bar: 2.05, kg: 140, hp: 6, walk: 0.9, run: 4.8, angry: 4, hit: 12, ground: true,
      drops: [['ember_shard', 2, 1], ['tikbalang_mane', 1, 0.5], ['obsidian', 1, 0.4]] },
    // guards every 10th floor: tougher the deeper (C.LAIR.bossHpPer)
    bungisngis: { name: 'Bungisngis', px: 164, w: 2.4, kg: 600, hp: 24, walk: 0.6, run: 3.4, angry: 5, hit: 16, ground: true, boss: true,
      drops: [['ember_shard', 6, 1], ['bungisngis_tooth', 1, 1], ['obsidian', 2, 0.7], ['bakunawa_scale', 1, 0.05]] },
    // floor 50, for two or more (like the Great Mammoth: hpEach for each hunter, minHits to share it), once a day
    bakunawa: { name: 'Bakunawa', px: 143, w: 3.8, kg: 9000, hp: 60, walk: 0.5, run: 3, angry: 3.2, hit: 22, ground: true,
      great: true, hpEach: 20, minHits: 3, boss: true,
      drops: [['bakunawa_scale', 2, 1], ['ember_shard', 10, 1], ['obsidian', 3, 1]] },
  };
  Object.keys(KINDS).forEach(function (k) {
    KINDS[k].lair = true;
    KINDS[k].respawn = 0; // (a floor's roster is the floor's, not a slot waiting to come back)
    WI.animals[k] = KINDS[k];
    if (WI.order.indexOf(k) < 0) WI.order.push(k);
  });

  // The Lair is one more wild place (L.isWildMap): the Bow, the dog, Hunter's gear and hunting with friends all work
  // there. Its animals come from the floor (L.lairRoster), not from this list.
  WI.areas.lair = { name: "Bakunawa's Lair", animals: {}, unlock: 40, shut: 'The Lair is past Magayon Peaks' };
  C.LAIR = {
    floors: 50,
    liftEvery: 10, // the lift by the way in stops at 1, 11, 21, 31, 41 (the ones you have reached)
    bossEvery: 10,
    bossHpPer: 0.5, // + this much hp for each floor down
    bakunawaFloor: 50,
    // each floor: 3 creatures, one more every 10 floors, at most 7
    count: { base: 3, per: 10, max: 7 },
  };

  // ---------- what they leave (icons appended to the items sheet: tools/art/lair-icons.js) ----------
  var ITEMS = {
    ember_shard: { name: 'Ember Shard', kind: 'hunt', sell: 60, desc: 'A warm red shard from the Lair. Kanor makes fire gear with them.' },
    santelmo_flame: { name: 'Santelmo Flame', kind: 'hunt', sell: 220, desc: 'A little flame that never goes out.' },
    sigbin_horn: { name: 'Sigbin Horn', kind: 'hunt', sell: 260, desc: 'Small, curved and still warm.' },
    tikbalang_mane: { name: 'Tikbalang Mane', kind: 'hunt', sell: 420, desc: 'Long, wild hair from a Tikbalang.' },
    bungisngis_tooth: { name: 'Bungisngis Tooth', kind: 'hunt', sell: 1800, desc: 'A huge tooth from the laughing giant.' },
    bakunawa_scale: { name: 'Bakunawa Scale', kind: 'hunt', sell: 6000, desc: 'A scale like a piece of the night sky. Very rare.' },
  };
  Object.keys(ITEMS).forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  ['bow_4', 'gear_charm'].forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  Object.keys(ITEMS).forEach(function (id) {
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
    if (C.COLLECTION.indexOf(id) < 0) C.COLLECTION.push(id);
  });

  // ---------- the Magma Bow: past the Gold Bow, from Kanor ----------
  WI.bow.range.push(7);
  WI.bow.damage.push(3);
  C.MAGMA_BOW = { name: 'Magma Bow', level: 4, gold: 25000, needs: [['ember_shard', 40], ['bakunawa_scale', 3], ['obsidian', 5]] };

  // ---------- the Fire Charm: Hunter's gear, bought with what the Lair gives ----------
  // A charge that reaches you costs less energy (C.GEAR_RULES.charm).
  C.GEAR.push({ key: 'charm', name: 'Fire Charm', gold: 6000, needs: [['ember_shard', 25], ['santelmo_flame', 3]], desc: 'A charge that reaches you costs 40% less energy.', short: 'Charges cost 40% less.' });
  C.GEAR_RULES.charm = 0.6;
  C.GEAR[C.GEAR.length - 1].icon = C.ICON.gear_charm;
})(window.Farm = window.Farm || {});
