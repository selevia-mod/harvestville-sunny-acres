// Place 13: Taal Lake (owner, 6 Nov 2026), opens at 100 hunts. A lakeshore on the volcano island: dark volcanic sand
// with grass, the big blue lake (not walkable; fish from the wooden pier), fishing bancas on the shore, reeds, mango trees,
// steaming rocks and nipa huts. Its animals: the Tagak (a shy egret that flies off), the Buwaya (a cute crocodile that
// charges) and the rare Royal Tagak. A Little Tagak can be tamed with Small Fish. Its person is Mang Celso, the Taal
// fisherman. Its cave is Taal Crater: 10 floors of steaming sulfur rock and green crater water, Siyokoy and Kataw, the
// Lava Buwaya guarding floor 5 and the Berberoka at the bottom. The engine is docs/hunting-places-engine.md; the owner's
// page for this place is docs/places/taal.md (every number is listed there). Maps: maps/taal.json, maps/taal_crater.json
// (tools/make-map.js). Mang Celso's small gifts for each story step are in 01-logicZZZZZ-place-13-taal.js.
// Art (art-src/places/taal/, docs/places-items.json): every picture is wired by name below and the engine draws a
// stand-in until it is in. Icons: icons_taal.png is painted into assets/items.png by tools/art/places-import.js (owner's
// art, 6 Nov 2026), in C.TAAL_ICONS' order.
(function (F) {
  'use strict';
  var C = F.Config;

  // Local food (owner, 6 Nov 2026): a dish and a drink, cooked in the kitchen like the others (recipes are found by
  // their dish, not by their place in the list, so appending is safe).
  C.RECIPES.push({ dish: 'tapang_taal', needs: ['meat_boar', 'garlic', 'egg'] }, { dish: 'kapeng_barako', needs: ['coffee'] });

  // icons_taal.png, 4 x 4 in this order (docs/places-items.json "taal")
  C.TAAL_ICONS = ['plume_tagak', 'shell_lake', 'hide_buwaya', 'tooth_buwaya', 'royal_plume', 'fin_siyokoy', 'pearl_kataw', 'scale_lava',
    'pearl_berberoka', 'lake_hat', 'lake_vest', 'lake_boots', 'lake_charm', 'tapang_taal', 'kapeng_barako', 'sulfur_chip'];
  F.placeIcons(C.TAAL_ICONS);

  F.addPlace({
    id: 'taal', n: 13, name: 'Taal Lake', unlock: 100, map: 'taal', grass: 2, icon: 'plume_tagak',
    shut: 'Taal Lake is a long ride south',
    opened: 'TAAL LAKE IS OPEN\nKanor: "One hundred hunts! Ride my Jeep to Taal Lake. Egrets on the shore, buwaya in the reeds, and a crater full of things I will not name. Bring fish for the little tagak."',

    // the 16 ids of docs/places-items.json "taal" (the four gear pieces are the gear's own icons, below)
    items: {
      plume_tagak: { name: 'Tagak Plume', kind: 'hunt', sell: 55, standIn: 'feather_labuyo', desc: 'A long white egret plume from Taal Lake.' },
      shell_lake: { name: 'Lake Shell', kind: 'hunt', sell: 40, standIn: 'stone', desc: 'A small striped snail shell. Tagak love the snails inside.' },
      hide_buwaya: { name: 'Buwaya Hide', kind: 'hunt', sell: 260, standIn: 'hide_rhino', desc: 'Tough green crocodile hide. Kanor makes vests of it.' },
      tooth_buwaya: { name: 'Buwaya Tooth', kind: 'hunt', sell: 190, standIn: 'bungisngis_tooth', desc: 'A small, rounded crocodile tooth.' },
      royal_plume: { name: 'Royal Plume', kind: 'hunt', sell: 950, standIn: 'blue_feather', desc: 'A shimmering silver-blue plume from the Royal Tagak. Very rare.' },
      fin_siyokoy: { name: 'Siyokoy Fin', kind: 'hunt', sell: 210, standIn: 'fish_m', desc: 'A green fin from a Siyokoy of Taal Crater.' },
      pearl_kataw: { name: 'Kataw Pearl', kind: 'hunt', sell: 360, standIn: 'sapphire', desc: 'A small blue pearl the Kataw keep in their shells.' },
      scale_lava: { name: 'Lava Scale', kind: 'hunt', sell: 750, standIn: 'ruby', desc: 'A dark red scale from the Lava Buwaya, still glowing in its cracks.' },
      pearl_berberoka: { name: 'Berberoka Pearl', kind: 'hunt', sell: 2600, standIn: 'jade', desc: 'A big glowing water pearl from the Berberoka. Kanor makes the Lakeguard Charm with it.' },
      tapang_taal: { name: 'Tapang Taal', kind: 'dish', energy: 110, sell: 240, standIn: 'venison_tapa', desc: 'Sweet red cured pork from Taal, with garlic rice and an egg.' },
      kapeng_barako: { name: 'Kapeng Barako', kind: 'dish', energy: 35, sell: 70, standIn: 'coffee', desc: 'Strong, dark Batangas coffee. Mang Celso drinks it at dawn.' },
      sulfur_chip: { name: 'Sulfur Chip', kind: 'hunt', sell: 45, standIn: 'crystal', desc: 'A bright yellow crystal from the crater. Kanor uses it for the Lakeguard boots and charm.' },
    },

    creatures: {
      // stand-ins until the owner's art: another animal's row of the wild sheet, in its own colour (sheet: the art name)
      tagak: { name: 'Tagak', sheet: 'wild_tagak', sheetRow: 'labuyo', tint: 0xf6f4ea, px: 184, w: 1.05, kg: 1.8, hp: 2, walk: 0.6, run: 4.8, shy: 3.2, flies: true, respawn: 15,
        drops: [['plume_tagak', 1, 1], ['shell_lake', 1, 0.5]] },
      buwaya: { name: 'Buwaya', sheet: 'wild_buwaya', sheetRow: 'boar', tint: 0x8fc070, px: 190, w: 1.8, ground: true, kg: 240, hp: 7, walk: 0.5, run: 3.8, angry: 3, hit: 15, respawn: 15,
        drops: [['hide_buwaya', 1, 1], ['tooth_buwaya', 1, 0.6]] },
      royal_tagak: { name: 'Royal Tagak', sheet: 'wild_royaltagak', sheetRow: 'labuyo', tint: 0xb8dcff, px: 162, w: 1.25, kg: 2.8, hp: 3, walk: 0.6, run: 5.6, shy: 6, flies: true, rare: true, respawn: 120,
        drops: [['royal_plume', 1, 1], ['plume_tagak', 2, 1]] },
      // the tame one (owner: "Tame: the Tagak"): a young egret that follows Mang Celso's banca for fish. The engine makes
      // a tame kind feed-only (never for the Bow), so it is its own kind and the grown Tagak stays a hunt. Smaller, and
      // drawn from the Tagak's own picture once that is in.
      tagak_bata: { name: 'Little Tagak', sheet: 'wild_tagak', sheetRow: 'labuyo', tint: 0xfff8e0, px: 184, w: 0.8, kg: 0.9, hp: 1, walk: 0.5, run: 4.2, shy: 2.2, flies: true, drops: [] },
    },
    animals: { tagak: 4, buwaya: 2 },
    extra: [{ kind: 'royal_tagak', n: 1, when: 'rare' }],

    // Small Fish from the pier (or any water), about 9 feedings; it may fly off after one and comes back later. Its skill:
    // it spots the Royal Tagak (or any rare one) and says so.
    tame: { kind: 'tagak_bata', food: 'fish_s', feedings: 9, runOff: 0.22, back: 20, skill: 'spot' },

    gear: { name: 'Lakeguard', pieces: {
      head: { id: 'lake_hat', name: 'Lakeguard Salakot', standIn: 'gear_cloak', needs: [['plume_tagak', 6], ['shell_lake', 4]], gold: 4000 },
      body: { id: 'lake_vest', name: 'Lakeguard Vest', standIn: 'gear_cloak', needs: [['hide_buwaya', 4], ['tooth_buwaya', 2]], gold: 7000 },
      feet: { id: 'lake_boots', name: 'Lakeguard Boots', standIn: 'gear_boots', needs: [['fin_siyokoy', 4], ['sulfur_chip', 6]], gold: 4500 },
      charm: { id: 'lake_charm', name: 'Lakeguard Charm', standIn: 'gear_charm', needs: [['pearl_berberoka', 1], ['pearl_kataw', 3], ['sulfur_chip', 4]], gold: 7500 },
    } },

    // 5 hidden chests (tiles on maps/taal.json): the end of the pier, in the reeds, behind a nipa hut, by the crater, the far shore
    chests: [[16, 6], [4, 14], [25, 18], [3, 4], [29, 15]],
    chestLoot: [['arrows', 8, 1], ['fish_s', 3, 1], ['sulfur_chip', 2, 1], ['kapeng_barako', 1, 0.5], ['shell_lake', 2, 0.5]],

    npc: { name: 'Mang Celso', look: 'ewan', sheet: 'npc_mang_celso', at: [14, 15], lines: [
      { text: 'Magandang araw! I am Celso. I have fished Taal all my life. The tagak walk the shore, but mind the reeds: a buwaya sleeps there. Here, have a coffee.' },
      { text: 'You hunt well. A little tagak follows my banca for fish. Take these, hold one out, and go slowly. Fish from my pier when you run out.', need: { hunts: 5 }, hint: 'Hunt here a few times.' },
      { text: 'The Lava Buwaya is down? Hay naku, my father said it guarded the crater for a hundred years! Eat, you will need it below.', need: { guard: 1 }, hint: 'Beat the guard on floor 5 of Taal Crater.' },
      { text: 'The Berberoka! It drank our lake dry in the old stories. Taal is yours too now. Come back for coffee anytime.', need: { boss: 1 }, hint: 'Beat the Berberoka at the bottom of Taal Crater.' },
    ] },

    dungeon: {
      key: 'taal_crater', name: 'Taal Crater', floors: 10, liftEvery: 5, guardFloor: 5, bossFloor: 10,
      count: { base: 3, per: 3, max: 7 }, escort: 2,
      creatures: {
        siyokoy: { name: 'Siyokoy', sheet: 'wild_siyokoy', sheetRow: 'sigbin', tint: 0x7fd0a8, px: 162, w: 1.2, kg: 70, hp: 4, walk: 0.8, run: 4.4, angry: 3.2, hit: 12, ground: true,
          drops: [['fin_siyokoy', 1, 1], ['sulfur_chip', 1, 0.5]] },
        kataw: { name: 'Kataw', sheet: 'wild_kataw', sheetRow: 'tikbalang', bar: 2.05, tint: 0x8cc4f0, px: 164, w: 1.15, kg: 90, hp: 6, walk: 0.9, run: 4.6, angry: 3.6, hit: 13, ground: true,
          drops: [['pearl_kataw', 1, 0.6], ['fin_siyokoy', 1, 0.4], ['sulfur_chip', 1, 0.6]] },
        lava_buwaya: { name: 'Lava Buwaya', sheet: 'wild_lavabuwaya', sheetRow: 'rhino', tint: 0xff8a5a, px: 180, w: 2.4, kg: 900, hp: 26, walk: 0.5, run: 3.8, angry: 3.4, hit: 17, ground: true, boss: true,
          drops: [['scale_lava', 1, 1], ['hide_buwaya', 2, 1], ['sulfur_chip', 3, 1]] },
        // soloable; with friends 18 more for each one (like the Bakunawa), and 3 hits to share it
        berberoka: { name: 'Berberoka', sheet: 'wild_berberoka', sheetRow: 'bungisngis', tint: 0x70d8c8, px: 174, w: 2.6, kg: 1200, hp: 40, hpEach: 18, minHits: 3, walk: 0.6, run: 3.4, angry: 4, hit: 19, ground: true, boss: true,
          drops: [['pearl_berberoka', 1, 1], ['pearl_kataw', 2, 1], ['sulfur_chip', 4, 1]] },
      },
      floorKinds: [['siyokoy', 1, 10], ['kataw', 3, 10]],
      guard: 'lava_buwaya', boss: 'berberoka',
      chest: [['pearl_kataw', 2, 1], ['sulfur_chip', 4, 1], ['arrows', 15, 1], ['scale_lava', 1, 0.5], ['pearl_berberoka', 1, 0.25]],
      // yellow sulfur rock (dark to light), the pools green crater water, steam not embers
      look: { floor: ['#3a3010', '#9c8420', '#f2d24a'], wall: ['#2a240c', '#7a6820', '#d8bc3c'], top: ['#121006', '#2e2810', '#5a4e1c'], crust: ['#2c2610', '#5e5020', '#a89030'] },
      lava: { rim: '#18220c', hot: ['#d6ffb4', '#7cd060', '#2c8a3c'], plate: ['rgba(46,96,40,0.85)', 'rgba(80,140,56,0.8)'], embers: false },
      bg: '#11130a', propTint: 0xe6dc8c, icon: 'pearl_berberoka',
      art: { mouth: 'props/taal_mouth', gate: 'props/taal_gate', cave: 'taal_cave' },
    },
  });
})(window.Farm = window.Farm || {});
