// Manila's third hunting ground: THE ROCKY GORGE, the Boomerang's ground, and its 50-floor cave, the Echo Caves (owner,
// 18 Nov 2026; design docs/manila-proposals.md 3c, with the owner's decisions over it: a shot costs the Bow's energy (2,
// never 4), the difficulty is in the animals (about 1.5 times the notes' hits); opens at 110 hunts; the horse rides free,
// 8 hearts here, 10 and the Lantern Bridle in the cave; the Climber set about 10 times the first note; drops sell at the
// notes' prices; creatures cute, bosses grumpy, never wicked; the Sarimanok left out on purpose).
// North of Manila: in by the city's Gorge Gate (the north edge, 00-...-manila-flip.js), open at 110 hunts. A canyon: cliffs
// you cannot climb, wide ledges with a cliff face under each, a stream down the middle (x 24-27) with two rope bridges,
// Tata Ambo's climbers' camp by the gate, the cave's door in the north cliff.
// The Boomerang's ground: the birds and the living stones stand in FLOCKS of 3 to 5 side by side on the ledges (`abreast`:
// a row, each within C.WEAPON_PAIR of the next), and the Boomerang hits the first on the way out and the first again on the
// way back (L.boomStep, 01-logicZZZZZZZZZZZZZZ-weapons.js); the Moon one hits 2 side by side each way.
// The Ibong Adarna: when it sings, every animal near it (itself too) stands still for 3 seconds (C.WILD.song).
// Clashes: the Lost Tower has a Langay-langayan, an Alitaptap and a Galura of its own (C.WILD.animals langay, alitaptap,
// galura): the Gorge's are gr_langay, gr_alitaptap, gr_galura, their pictures saved as wild_gorge_* (named by `src`).
// The weapons file's materials are these drops' ids: kalapati_feather, banog_feather, bato_crown, galura_feather.
// A place like the Plains (F.addPlace): maps built in code (L.gorgeMap, L.gorgeCaveMap), pictures the 'gorge' pack
// (tools/manila/plains-import.js gorge). Rules 01-logicZ...Z-gorge.js; the world 19zzz...z-gorge.js. Saves: by the
// place's id (pl.gorge, pk, pm); items appended; no new key, no new map index.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  if (!M || !F.addPlace || !C.PLACES.jungle) return;

  // ---------- the icons: icons_gorge.png (16, its order) and row 3 of icons_manila_gear.png (the Climber set) ----------
  C.GORGE_ICON_BASE = 2500;
  C.GORGE_ICONS = ['kalapati_feather', 'langay_feather', 'mud_nest', 'ibid_sail', 'banog_feather', 'banog_talon', 'bato_pebble', 'adarna_feather',
    'gorge_crystal', 'glow_jar', 'kabog_wing', 'bato_crown', 'galura_feather', 'ginisang_monggo', 'kalapati_meat', 'climbing_rope',
    'gorge_cap', 'gorge_cape', 'gorge_boots', 'gorge_charm'];
  C.GORGE_STAND = { kalapati_feather: 'feather_labuyo', langay_feather: 'feather_labuyo', mud_nest: 'leather_soft', ibid_sail: 'leather_soft', banog_feather: 'feather_labuyo',
    banog_talon: 'tusk', bato_pebble: 'jade', adarna_feather: 'blue_feather', gorge_crystal: 'emerald', glow_jar: 'jade', kabog_wing: 'pelt_wolf', bato_crown: 'ruby',
    galura_feather: 'blue_feather', ginisang_monggo: 'kaldereta', kalapati_meat: 'meat_labuyo', climbing_rope: 'lumber',
    gorge_cap: 'gear_cloak', gorge_cape: 'gear_cloak', gorge_boots: 'gear_boots', gorge_charm: 'gear_charm' };
  C.gorgeIcon = function (name) { var i = C.GORGE_ICONS.indexOf(name); return i < 0 ? -1 : C.GORGE_ICON_BASE + i; };
  C.GORGE_ICONS.forEach(function (n) { C.ICON[n] = C.gorgeIcon(n); }); // (never in C.ICON_ORDER: the page's sheet does not grow)

  var P = F.addPlace({
    id: 'gorge', n: 23, name: 'The Rocky Gorge', unlock: 110, map: 'gorge', grass: 0, icon: 'kalapati_feather', jeep: 'from_city',
    pack: 'gorge', artDir: 'manila/gorge', noJeep: true, serverLater: true, // (its online rows: node tools/places/server-rows.js gorge)
    shut: 'The Rocky Gorge opens at 110 hunts',
    opened: 'THE ROCKY GORGE IS OPEN\nTata Ambo: "110 hunts! Come through Manila\'s Gorge Gate, north of the plaza. Bring a Boomerang: the birds stand in flocks on the ledges."',

    // Drops sell at the notes' prices (owner): the Gorge's 100 to 480, the Adarna feather 2,600, the guard's crown 2,200,
    // the boss's feather 3,400.
    items: {
      kalapati_feather: { name: 'Kalapati Feather', kind: 'hunt', sell: 100, desc: 'A soft blue-grey pigeon feather with a green shimmer. For the Copper Boomerang.' },
      kalapati_meat: { name: 'Kalapati Meat', kind: 'meat', sell: 110, desc: 'A little pigeon drumstick. Cook Ginisang Monggo with it.' },
      langay_feather: { name: 'Langay Feather', kind: 'hunt', sell: 120, desc: 'A forked tail feather from a quick little swallow.' },
      mud_nest: { name: 'Mud Nest', kind: 'hunt', sell: 260, desc: 'A tiny cup of dried mud a swallow built, and left behind. Empty.' },
      ibid_sail: { name: 'Ibid Sail', kind: 'hunt', sell: 220, desc: 'A green fin-shaped scale from the sailfin lizard. It grows a new one.' },
      banog_feather: { name: 'Banog Feather', kind: 'hunt', sell: 300, desc: 'A dark-brown eagle feather with white dots. For the Silver Boomerang.' },
      banog_talon: { name: 'Banog Talon', kind: 'hunt', sell: 420, desc: 'A curved yellow talon the Banog shed. It has others.' },
      bato_pebble: { name: 'Bato Pebble', kind: 'hunt', sell: 100, desc: 'A round grey pebble with a tiny happy face. A Bato-Bato gave it away.' },
      gorge_crystal: { name: 'Gorge Crystal', kind: 'hunt', sell: 480, desc: 'A cluster of pale blue crystals from the gorge. It hums when you hold it.' },
      adarna_feather: { name: 'Adarna Feather', kind: 'hunt', sell: 2600, desc: 'A feather of seven colours the Ibong Adarna let fall as it flew off singing.' },
      glow_jar: { name: 'Glow Jar', kind: 'hunt', sell: 280, desc: 'A little jar of soft firefly light. The Alitaptap filled it and flew on.' },
      kabog_wing: { name: 'Kabog Wing', kind: 'hunt', sell: 340, desc: 'A soft folded wing-cape a Kabog left on a crystal in the Echo Caves.' },
      bato_crown: { name: 'Bato Crown', kind: 'hunt', sell: 2200, desc: 'A glowing blue crystal from the Bato King\'s crown. He grew another. For the Gold Boomerang.' },
      galura_feather: { name: 'Galura Feather', kind: 'hunt', sell: 3400, desc: 'A huge silver storm feather, crackling with tiny blue sparks. The Galura gave it, grumbling.' },
      climbing_rope: { name: 'Climbing Rope', kind: 'goods', sell: 150, desc: 'A coil of strong climbing rope from a hidden chest. Tata Ambo approves.' },
      ginisang_monggo: { name: 'Ginisang Monggo', kind: 'dish', sell: 420, energy: 120, desc: 'Mung bean stew with pigeon meat, garlic and greens.' },
    },

    // Cute and kind; the bosses grumpy, never wicked (owner). About 1.5 times the notes' hits, a charge a point dearer (the
    // Plains' and the Jungle's way). The birds and the living stones come in flocks that stand in a row (abreast) on the
    // ledges: the Boomerang's ground.
    creatures: {
      kalapati: { name: 'Kalapati', sheet: 'wild_kalapati', row: 0, sheetRow: 'labuyo', tint: 0x9aa8c0, px: 154, w: 0.7, kg: 1, hp: 5, walk: 0.6, run: 5, shy: 3.4, flies: true, flock: 4, abreast: true,
        drops: [['kalapati_feather', 1, 1], ['kalapati_meat', 1, 0.6]] },
      gr_langay: { name: 'Langay-langayan', sheet: 'wild_gorge_langay', src: 'wild_langay', row: 0, sheetRow: 'labuyo', tint: 0x4a5a9a, px: 170, w: 0.55, kg: 1, hp: 3, walk: 0.6, run: 6, shy: 3, flies: true, flock: 5, abreast: true,
        drops: [['langay_feather', 1, 1], ['mud_nest', 1, 0.3]] },
      ibid: { name: 'Ibid', sheet: 'wild_ibid', row: 0, sheetRow: 'rabbit', tint: 0x6aa060, px: 170, w: 1.1, ground: true, kg: 1.2, hp: 6, walk: 0.6, run: 5.4, shy: 3.2,
        drops: [['ibid_sail', 1, 1]] },
      // it swoops at you
      banog: { name: 'Banog', sheet: 'wild_banog', row: 0, sheetRow: 'labuyo', tint: 0x6a4a30, px: 130, w: 1.3, kg: 1.6, hp: 9, walk: 0.6, run: 5.2, angry: 4, hit: 15, flies: true,
        drops: [['banog_feather', 1, 1], ['banog_talon', 1, 0.5]] },
      // little living stones: they roll at you, three together
      batobato: { name: 'Bato-Bato', sheet: 'wild_batobato', row: 0, sheetRow: 'boar', tint: 0x9a9a98, px: 169, w: 0.9, ground: true, kg: 60, hp: 11, walk: 0.5, run: 4, angry: 2.6, hit: 14, flock: 3, abreast: true,
        drops: [['bato_pebble', 2, 1], ['gorge_crystal', 1, 0.3]] },
      // the magic singing bird of the old epic: when it sings, every animal near stands still for 3 s (C.WILD.song)
      adarna: { name: 'Ibong Adarna', sheet: 'wild_adarna', row: 0, sheetRow: 'labuyo', tint: 0xe08ad0, px: 169, w: 1.2, kg: 1, hp: 12, walk: 0.6, run: 6.4, shy: 7, flies: true, sings: true,
        rare: true, respawn: 120, drops: [['adarna_feather', 1, 1]] },
      // the tame one: a young pigeon (the Kalapati's picture, smaller), never a target
      squab: { name: 'Little Kalapati', sheet: 'wild_kalapati', row: 0, sheetRow: 'labuyo', tint: 0xb0b8d0, px: 154, w: 0.5, kg: 0.15, hp: 1, walk: 0.5, run: 4.2, shy: 2.2, flies: true, drops: [] },
    },
    animals: { kalapati: 8, gr_langay: 5, ibid: 3, batobato: 3 },
    extra: [{ kind: 'banog', n: 2, when: 'dawn' }, { kind: 'banog', n: 1, when: 'dusk' }, { kind: 'gr_langay', n: 5, when: 'rain' }, { kind: 'adarna', n: 1, when: 'rare' }],

    // the Little Kalapati: planted mung beans, 9 feedings; it coos when the Ibong Adarna is out, and points the way (spot)
    tame: { kind: 'squab', food: 'mung_bean', feedings: 9, runOff: 0.22, back: 20, skill: 'spot' },

    // the Climber set (owner: about 10 times the first note, 30,000 to 60,000 a piece, plus drops)
    gear: { name: 'Climber', pieces: {
      head: { id: 'gorge_cap', name: 'Knitted Climber\'s Cap', standIn: 'gear_cloak', needs: [['kalapati_feather', 12], ['langay_feather', 8], ['climbing_rope', 4]], gold: 30000 },
      body: { id: 'gorge_cape', name: 'Banog Cape', standIn: 'gear_cloak', needs: [['banog_feather', 10], ['banog_talon', 4], ['kabog_wing', 6]], gold: 50000 },
      feet: { id: 'gorge_boots', name: 'Climbing Boots', standIn: 'gear_boots', needs: [['ibid_sail', 8], ['bato_pebble', 12], ['climbing_rope', 4]], gold: 35000 },
      charm: { id: 'gorge_charm', name: 'Adarna Charm', standIn: 'gear_charm', needs: [['adarna_feather', 3], ['bato_crown', 2], ['galura_feather', 1]], gold: 60000 },
    } },

    // 5 hidden chests: one on each ledge, one by the cave (kept free: L.gorgeMap)
    chests: [[5, 12], [5, 26], [5, 40], [46, 18], [46, 32]],
    chestLoot: [['climbing_rope', 2, 1], ['beeswax', 1, 0.6], ['mung_bean', 2, 0.5], ['gorge_crystal', 1, 0.3]],

    // Tata Ambo, the old climber, by his camp at the gate: first visit, a few hunts, the guard, the boss
    npc: { engineGifts: true, name: 'Tata Ambo', look: 'tomas', sheet: 'npc_tata_ambo', at: [13, 46], lines: [
      { text: 'Magandang araw! I am Ambo. Fifty years I have climbed this gorge. The birds sit in rows on the ledges: a Boomerang hits one going out and again coming back. Here, mung beans for the Little Kalapati.', gift: [['mung_bean', 5]] },
      { text: 'Good throwing! When the Ibong Adarna sings, every animal near it stands still for three seconds. Listen for it! Take this beeswax for Panday Lando\'s Boomerangs.', need: { hunts: 5 }, hint: 'Hunt here a few more times.', gift: [['beeswax', 3]] },
      { text: 'You calmed the Bato King? He is only proud of his crown. Here, rope: Bram mends a worn Boomerang with it.', need: { guard: 1 }, hint: 'Beat the guard on floor 10 of the Echo Caves.', gift: [['rope', 3]] },
      { text: 'The Galura! It only wanted its storm to itself, you know. My lola cooked this for brave climbers. Salamat!', need: { boss: 1 }, hint: 'Beat the boss on floor 50 of the Echo Caves.', gift: [['ginisang_monggo', 2]] },
    ] },

    dungeon: {
      key: 'gorge_cave', name: 'The Echo Caves', floors: 50, liftEvery: 10, guardFloor: 10, guardEvery: 10, guardHpPer: 0.5, bossFloor: 50,
      count: { base: 3, per: 10, max: 6 }, escort: 3,
      creatures: {
        // big friendly fireflies, three together: they flit off (the Gorge's own, not the Lost Tower's)
        gr_alitaptap: { name: 'Alitaptap', sheet: 'wild_gorge_alitaptap', src: 'wild_alitaptap', row: 0, sheetRow: 'santelmo', tint: 0xe0f080, px: 164, w: 0.8, kg: 0.5, hp: 6, walk: 0.7, run: 5.4, shy: 3, flies: true, flock: 3, abreast: true,
          drops: [['glow_jar', 1, 1], ['gorge_crystal', 1, 0.3]] },
        // chubby cave fruit bats, three together: they dive at you
        kabog: { name: 'Kabog', sheet: 'wild_kabog', row: 0, sheetRow: 'labuyo', tint: 0x7a5a40, px: 186, w: 1, kg: 1, hp: 11, walk: 0.6, run: 5, angry: 3.4, hit: 16, flies: true, flock: 3, abreast: true,
          drops: [['kabog_wing', 1, 1]] },
        // the guard of every 10th floor: the chief of the living stones, proud of his crystal crown
        batoking: { name: 'Bato King', sheet: 'wild_batoking', row: 0, sheetRow: 'bungisngis', tint: 0x8a8a90, px: 166, w: 2.6, ground: true, kg: 3000, hp: 45, walk: 0.5, run: 3.6, angry: 3.4, hit: 18, boss: true,
          drops: [['bato_crown', 1, 1], ['bato_pebble', 3, 1], ['gorge_crystal', 2, 0.6]] },
        // the floor 50 boss: the storm eagle of Kapampangan legend, grand and grumpy; soloable, more with friends (the Gorge's
        // own, not the Lost Tower's)
        gr_galura: { name: 'Galura', sheet: 'wild_gorge_galura', src: 'wild_galura', row: 0, sheetRow: 'bakunawa', tint: 0xc0c8d8, px: 148, w: 3.4, kg: 300, hp: 66, hpEach: 25, minHits: 3,
          walk: 0.6, run: 3.8, angry: 4, hit: 21, boss: true, drops: [['galura_feather', 2, 1], ['bato_crown', 1, 1], ['adarna_feather', 1, 0.2]] },
      },
      floorKinds: [['gr_alitaptap', 1, 50], ['kabog', 6, 50]],
      guard: 'batoking', boss: 'gr_galura',
      chest: [['galura_feather', 1, 1], ['climbing_rope', 3, 1], ['gorge_crystal', 2, 1], ['bato_crown', 1, 0.25], ['beeswax', 2, 0.5]],
      // blue crystal caves
      look: { floor: ['#141a2a', '#3a4a6a', '#8aa0c8'], wall: ['#0c1020', '#2e3c5c', '#7a90b8'], top: ['#060810', '#182038', '#2e3c5c'], crust: ['#101830', '#2a3a60', '#6a80b0'] },
      lava: { rim: '#0a1428', hot: ['#e0f4ff', '#80c0f0', '#2a5a9a'], plate: ['rgba(40,80,140,0.85)', 'rgba(80,130,200,0.8)'], embers: false },
      bg: '#060810', propTint: 0xa8d0ff, icon: 'galura_feather',
      art: { mouth: 'props/gorge_mouth', gate: 'props/gorge_gate', cave: 'gorge_cave' },
    },
  });

  Object.keys(P.items).forEach(function (id) { C.ITEMS[id].painted = true; });
  C.GEAR_SLOTS.forEach(function (slot) { var g = C.PLACE_GEAR['gorge_' + slot]; if (g && g.art) g.icon = C.gorgeIcon(g.art); });

  // the local dish, and its power: you walk 20% faster (up and down the gorge)
  C.RECIPES.push({ dish: 'ginisang_monggo', needs: ['mung_bean', 'kalapati_meat', 'garlic'] });
  if (C.DISH_POWERS) {
    C.DISH_POWERS.ginisang_monggo = { key: 'walk', text: 'you walk 20% faster' };
    C.ITEMS.ginisang_monggo.desc += ' For ' + C.DISH_POWER_MINS + ' minutes, ' + C.DISH_POWERS.ginisang_monggo.text + '.';
  }

  // the new numbers: a flock abreast stands in a row 1 tile apart (each next to the next, inside C.WEAPON_PAIR); the song
  C.WILD.rowGap = 1;
  C.WILD.song = { every: [9000, 15000], still: 3000, reach: 6, hear: 11 }; // ms between songs, ms standing still, tiles it reaches; you see it within `hear`

  // ---------- the map (L.gorgeMap builds it) ----------
  // Boxes [x, y, w, h] in tiles. The way back to Manila is the gap in the bottom cliff, `gate` (2 wide).
  C.GORGE = {
    W: 52, H: 52,
    gate: [18, 50],
    rim: 4, // the canyon's cliffs: 4 tiles on each side and at the top, 2 at the bottom
    face: 2, // the north cliff's face, under its top
    stream: [24, 6, 4, 44], // the stream down the middle
    bridges: [18, 36], // the rope bridges' rows (2 deep each)
    // the ledges: a shelf [x, y, w, h] with a cliff face under it and an outcrop of cliff (top, face) above; open at its
    // inner end (the way up)
    ledges: [[4, 10, 10, 4], [4, 24, 10, 4], [4, 38, 9, 3], [38, 16, 10, 4], [38, 30, 10, 4]],
    door: [37, 5], // the cave's door in the north cliff
    falls: [24, 6], // the waterfall at the stream's head
    camp: [7, 46], pulley: [5, 44], horn: [16, 44], lookout: [30, 46], // Tata Ambo's camp and things
    // the owner's 12 props (props_gorge.png, props_gorge_2.png, 3 x 2 each, in that order)
    kinds: ['boulder', 'ledge', 'bridge', 'grass', 'crystals', 'cairn', 'camp', 'pulley', 'waterfall', 'pine', 'lookout', 'horn'],
    grounds: ['ground_gorge_cliff', 'ground_gorge_face'], // two more ground textures: the cliffs' top and face
    // (the tiles sheet's tiles the map uses for them, solid in this map's own copy: the top, a face one tile high, and the
    // north cliff's taller face, its upper and lower half)
    tiles: { floor: 94, top: 97, face: 92, faceHi: 91, faceLo: 98 },
    tours: ['gorge'],
  };
  C.PLACE_PROP_KINDS.gorge = C.GORGE.kinds;
  C.PLACE_PROP_SWAP.gorge = { boulder_moss: 'boulder', mossy_log: 'ledge', flower_arch: 'bridge', fern_bush: 'grass', mushroom_rock: 'crystals', statue: 'cairn',
    trader_tent: 'camp', lamp: 'pulley', rainforest_tree: 'waterfall', pine_tree: 'pine', gazebo: 'lookout', lantern: 'horn' };

  // ---------- Manila's Gorge Gate: the way in once it is open (110 hunts); shut, as before, and it says when ----------
  M.gates.forEach(function (g) { if (g.key === 'gorge') { g.text = 'GORGE GATE\nThe Rocky Gorge lies north: the Boomerang\'s hunting ground. It opens at 110 hunts.'; M.gorgeGate = g; } });

  if (C.WEAPON_GROUNDS) C.WEAPON_GROUNDS.push('gorge', 'gorge_cave');
})(window.Farm = window.Farm || {});
