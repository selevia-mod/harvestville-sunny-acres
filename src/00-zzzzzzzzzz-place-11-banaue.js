// Place 11: Banaue Terraces (owner, 6 Nov 2026), and its dungeon, the Terrace Tunnels. A green mountain of rice terraces
// up north, opened at 60 hunts and reached by Kanor's Jeep: stone terrace walls, paddies of water you cannot walk in,
// huts on stilts, tree ferns, rice drying racks, boulders and tall rice grass where the animals hide. Wild Ducks (shy,
// they run and fly off), Bayawak (monitor lizards: they charge), and now and then a Golden Duck. One calm Wild Duck
// wanders the paddies: feed it heirloom rice and it becomes your companion (a Spotter: it says when the Golden Duck is
// out). Lola Bugan, the terrace elder, tells a short story as you go and gives a little gift at each step. Under the
// terraces, the Terrace Tunnels: 10 floors of earthen tunnels with roots and an underground stream, Kibaan and Cave
// Bayawak (more of them deeper), the Kibaan Chief guarding floor 5 and the Amomongo at the bottom (soloable; stronger
// for each friend), who leaves a chest once a day. Kanor makes the Terrace set from what it all gives.
// Respect (owner, 6 Nov 2026): the bulul, the sacred Ifugao rice-god carvings, are never enemies here; Lola Bugan only
// speaks of them kindly. Everything is kept family-friendly: the Amomongo and the Kibaan are drawn cute and playful.
// The engine is src/00-zzzzzzzzz-places.js (how to add a place: docs/hunting-places-engine.md); this place's numbers,
// story and art names are in docs/places/banaue.md. The rest of this place: src/01-logicZZZZZ-place-11-banaue.js (Lola
// Bugan's gifts), src/19zzzzzz-place-11-banaue.js (the props drawn until their pictures come), maps/banaue.json and
// maps/banaue_cave.json (tools/places/banaue-map.js). The owner's pictures (art-src/PLACES-1-5-PROMPTS.md, 1-18, in
// art-src/places/banaue/) go in with tools/art/banaue-import.js; until then everything here is a stand-in.
(function (F) {
  'use strict';
  var C = F.Config;

  // The 16 icons of docs/places-items.json, in its order (art-src/places/banaue/icons_banaue.png, 4 x 4). They are NOT
  // in the items sheet yet: once tools/art/banaue-import.js has painted them in, call F.placeIcons(BANAUE_ICONS) here
  // (never before: an icon past the sheet's end draws nothing). Until then each item uses its standIn.
  var BANAUE_ICONS = ['feather_itik', 'meat_itik', 'scale_bayawak', 'tail_bayawak', 'golden_feather', 'cap_kibaan', 'scale_cave', 'staff_kibaan',
    'fur_amomongo', 'terrace_hat', 'terrace_vest', 'terrace_sandals', 'terrace_charm', 'adobong_itik', 'terrace_stone', 'heirloom_rice'];
  F.BANAUE_ICONS = BANAUE_ICONS;
  var ICONS_IN = false; // (tools/art/banaue-import.js sets this to true when it paints them into assets/items.png)
  if (ICONS_IN) F.placeIcons(BANAUE_ICONS);

  // The place's props (art-src/places/banaue/props_banaue.png, 3 x 2, in this order), drawn on its maps by
  // src/19zzzzzz-place-11-banaue.js over the 'place_prop' objects of maps/banaue.json and maps/banaue_cave.json.
  // w: drawn width in tiles (a wall: one section; a longer wall is drawn in sections); h: the stand-in's height (the
  // picture keeps its own shape); standIn: a picture of the Wild Lands to use until this one's own is in (else drawn).
  F.BANAUE_PROPS = {
    banaue_wall: { w: 3, h: 1.45 }, // old stone terrace wall with a grassy top
    banaue_hut: { w: 2.6, h: 3.4 }, // a native hut on four stilts, tall pyramid thatched roof
    banaue_fern: { w: 2, h: 3.2 }, // a tall tree fern
    banaue_rack: { w: 2.3, h: 1.9 }, // a wooden rack hung with golden bundles of rice
    banaue_boulder: { w: 2, h: 1.7, standIn: 'props/boulder_moss' }, // a mossy grey boulder
    banaue_grass: { w: 1.15, h: 1.3, standIn: 'props/tall_grass' }, // tall rice-field grass where animals hide
    banaue_shroom: { w: 1, h: 1, standIn: 'props/mushroom_rock', drawnOnly: true }, // (the tunnels' glowing mushrooms: no picture of their own)
  };
  F.BANAUE_PROP_ORDER = ['banaue_wall', 'banaue_hut', 'banaue_fern', 'banaue_rack', 'banaue_boulder', 'banaue_grass']; // (the picture's cells)

  // The Wild Duck's numbers, shared by the ones you hunt and the calm one you tame (the same bird, the same picture).
  var duck = { px: 165, w: 0.85, kg: 1.1, hp: 1, walk: 0.6, run: 4.8, shy: 3, flies: true };
  var with_ = function (base, more) { var o = {}; [base, more].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); }); return o; };

  F.addPlace({
    id: 'banaue', n: 11, name: 'Banaue Terraces', unlock: 60, map: 'banaue', grass: 1, icon: 'feather_itik',
    shut: 'Banaue is far up north, past every trail',
    opened: 'BANAUE TERRACES IS OPEN\nKanor: "Sixty hunts! My Jeep can take you up north now, to the rice terraces of Banaue. Lola Bugan looks after them. Be kind to her paddies."',

    // (owner, 6 Nov 2026: numbers between Makiling and Magayon; the doc lists them all)
    items: {
      feather_itik: { name: 'Itik Feather', kind: 'hunt', sell: 25, standIn: 'feather_labuyo', desc: 'A soft brown speckled duck feather.' },
      meat_itik: { name: 'Itik Meat', kind: 'meat', sell: 32, standIn: 'meat_labuyo', desc: 'Wild duck. Cook it into Adobong Itik.' },
      scale_bayawak: { name: 'Bayawak Scale', kind: 'hunt', sell: 110, standIn: 'jade', desc: 'A shiny olive-and-yellow lizard scale.' },
      tail_bayawak: { name: 'Bayawak Tail', kind: 'hunt', sell: 140, standIn: 'leather_soft', desc: 'A curled lizard tail tip.' },
      golden_feather: { name: 'Golden Feather', kind: 'hunt', sell: 700, standIn: 'blue_feather', desc: 'From the Golden Duck. It glows a little.' },
      cap_kibaan: { name: 'Kibaan Cap', kind: 'hunt', sell: 90, standIn: 'herb', desc: 'A tiny pointed green leaf hat.' },
      scale_cave: { name: 'Cave Scale', kind: 'hunt', sell: 160, standIn: 'sapphire', desc: 'A pale blue-spotted scale from the tunnels.' },
      staff_kibaan: { name: 'Kibaan Staff', kind: 'hunt', sell: 900, standIn: 'lumber', desc: 'The Kibaan Chief\'s little carved staff, with a red feather.' },
      fur_amomongo: { name: 'Amomongo Fur', kind: 'hunt', sell: 1400, standIn: 'wool_mammoth', desc: 'A tuft of long grey-white fur.' },
      adobong_itik: { name: 'Adobong Itik', kind: 'dish', energy: 80, sell: 160, standIn: 'boar_adobo', desc: 'Duck stewed in soy, vinegar and garlic, with heirloom rice.' },
      terrace_stone: { name: 'Terrace Stone', kind: 'hunt', sell: 40, standIn: 'stone', desc: 'A smooth grey stone, like the ones in the terrace walls.' },
      heirloom_rice: { name: 'Heirloom Rice', kind: 'hunt', sell: 50, standIn: 'rice', desc: 'Red-and-white rice grown on the terraces for hundreds of years. Wild ducks love it.' },
    },

    // Art: each creature's own sheet (art-src/places/banaue/wild_<name>.png) once it is in assets/; until then another
    // animal's row of the wild sheet (sheetRow, its px) and a tint.
    creatures: {
      itik: with_(duck, { name: 'Wild Duck', sheet: 'wild_itik', sheetRow: 'labuyo', tint: 0xc9a77a, drops: [['meat_itik', 1, 1], ['feather_itik', 1, 0.7]] }),
      // the calm one you tame: the same bird, a little less shy (sneak up slowly); never for the Bow
      itik_calm: with_(duck, { name: 'Wild Duck', sheet: 'wild_itik', sheetRow: 'labuyo', tint: 0xe2c79a, shy: 2.2, drops: [] }),
      bayawak: { name: 'Bayawak', sheet: 'wild_bayawak', sheetRow: 'boar', tint: 0x9aa860, px: 178, w: 1.3, ground: true, kg: 18, hp: 4,
        walk: 0.6, run: 3.8, angry: 3, hit: 10, drops: [['scale_bayawak', 1, 1], ['tail_bayawak', 1, 0.5]] },
      goldduck: with_(duck, { name: 'Golden Duck', sheet: 'wild_goldduck', sheetRow: 'labuyo', tint: 0xffd860, w: 0.95, kg: 1.6, hp: 2, run: 5.4, shy: 5,
        rare: true, respawn: 120, drops: [['golden_feather', 1, 1], ['meat_itik', 2, 1]] }),
    },
    animals: { itik: 4, bayawak: 3 },
    extra: [{ kind: 'itik', n: 2, when: 'dawn' }, { kind: 'bayawak', n: 1, when: 'rain' }, { kind: 'goldduck', n: 1, when: 'rare' }],

    // (owner, 6 Nov 2026: "a little bit hard but not too hard") 8 feedings of heirloom rice; after each, 1 in 4 it flies
    // off for 15 minutes. Lola Bugan's first two gifts are 8 heirloom rice: enough, if you do not sell them.
    tame: { kind: 'itik_calm', food: 'heirloom_rice', feedings: 8, runOff: 0.25, back: 15, skill: 'spot' },

    gear: { name: 'Terrace', pieces: {
      head: { id: 'terrace_hat', name: 'Terrace Hat', standIn: 'gear_cloak', needs: [['feather_itik', 8], ['cap_kibaan', 3]], gold: 3000 },
      body: { id: 'terrace_vest', name: 'Terrace Vest', standIn: 'gear_cloak', needs: [['scale_bayawak', 6], ['tail_bayawak', 2], ['scale_cave', 3]], gold: 5000 },
      feet: { id: 'terrace_sandals', name: 'Terrace Sandals', standIn: 'gear_boots', needs: [['scale_cave', 4], ['terrace_stone', 6]], gold: 3000 },
      charm: { id: 'terrace_charm', name: 'Terrace Charm', standIn: 'gear_charm', needs: [['fur_amomongo', 2], ['staff_kibaan', 1], ['heirloom_rice', 3]], gold: 6000 },
    } },

    // 5 hidden chests (tiles of maps/banaue.json, kept free of props): a corner of the village, the end of a dike, the
    // middle of a paddy's dike, under the ferns by the west stairs, the far corner past the jeep
    chests: [[2, 2], [29, 9], [18, 11], [2, 15], [28, 27]],
    chestLoot: [['arrows', 6, 1], ['heirloom_rice', 2, 1], ['terrace_stone', 2, 1], ['golden_feather', 1, 0.1]],

    // Lola Bugan, the terrace elder. Each step's gift (given once, the first time she says it: 01-logicZZZZZ-place-11-banaue.js).
    npc: { name: 'Lola Bugan', look: 'pearl', sheet: 'npc_lola_bugan', at: [12, 3], lines: [
      { text: 'Welcome up the mountain, apo! Our grandparents\' grandparents built these terraces by hand, stone by stone. Here, take some heirloom rice. One calm wild duck walks the paddies: feed it slowly and it may follow you home.',
        gift: [['heirloom_rice', 4]] },
      { text: 'You hunt with care, I can see it. The paddies stay healthy when the hunters only take what they need. More rice for your duck, and some arrows. Under the terraces run old tunnels that carry our water. The Kibaan play down there.',
        need: { hunts: 5 }, hint: 'Hunt here a few more times, then visit Lola Bugan.', gift: [['heirloom_rice', 4], ['arrows', 10]] },
      { text: 'You beat the Kibaan Chief? Hay naku, he only wanted shiny things! Now the water flows freely again. Deep at the bottom lives the Amomongo. It is not wicked, only grumpy and hungry. Be brave, apo. Take these stones for your sandals.',
        need: { guard: 1 }, hint: 'The Kibaan Chief guards floor 5 of the tunnels.', gift: [['terrace_stone', 6], ['heirloom_rice', 2]] },
      { text: 'The Amomongo is calm and the stream sings again. The bulul by my granary watch over the harvest, and now you do too. You are family on these terraces. I cooked for you. Come back whenever the rice is golden.',
        need: { boss: 1 }, hint: 'The Amomongo waits on floor 10 of the tunnels.', gift: [['adobong_itik', 2], ['heirloom_rice', 3]] },
    ] },

    dungeon: {
      key: 'banaue_cave', name: 'Terrace Tunnels', floors: 10, liftEvery: 5, guardFloor: 5, bossFloor: 10,
      count: { base: 3, per: 4, max: 5 }, escort: 2, // 3 a floor, 4 from floor 4, 5 from floor 8
      creatures: {
        // playful little folk who run off with your things; they flee more than they fight
        kibaan: { name: 'Kibaan', sheet: 'wild_kibaan', sheetRow: 'tikbalang', tint: 0x9ad08a, px: 110, w: 0.75, bar: 2.05, kg: 9, hp: 2,
          walk: 0.9, run: 5, shy: 3.4, ground: true, drops: [['cap_kibaan', 1, 1], ['heirloom_rice', 1, 0.25], ['terrace_stone', 1, 0.3]] },
        cave_bayawak: { name: 'Cave Bayawak', sheet: 'wild_cavebayawak', sheetRow: 'boar', tint: 0xa8c8d8, px: 178, w: 1.35, kg: 22, hp: 5,
          walk: 0.6, run: 4, angry: 3.4, hit: 11, ground: true, drops: [['scale_cave', 1, 1], ['tail_bayawak', 1, 0.3]] },
        kibaan_chief: { name: 'Kibaan Chief', sheet: 'wild_kibaanchief', sheetRow: 'bungisngis', tint: 0xb8e0a0, px: 164, w: 1.6, kg: 40, hp: 14,
          walk: 0.7, run: 3.8, angry: 4, hit: 12, ground: true, boss: true, drops: [['staff_kibaan', 1, 1], ['cap_kibaan', 3, 1], ['terrace_stone', 2, 1]] },
        // soloable (30 arrows' worth, 15 with a Silver Bow); 12 more for each friend down with you; a share is 3 hits
        amomongo: { name: 'Amomongo', sheet: 'wild_amomongo', sheetRow: 'bear', tint: 0xe2ddd2, px: 148, w: 2.3, kg: 260, hp: 30, hpEach: 12, minHits: 3,
          walk: 0.6, run: 3.4, angry: 3.6, hit: 15, ground: true, boss: true, drops: [['fur_amomongo', 2, 1], ['scale_cave', 2, 1], ['terrace_stone', 3, 1]] },
      },
      // Kibaan on every floor; Cave Bayawak from floor 3, and twice as likely from floor 7 (more of them deeper)
      floorKinds: [['kibaan', 1, 10], ['cave_bayawak', 3, 10], ['cave_bayawak', 7, 10]],
      guard: 'kibaan_chief', boss: 'amomongo',
      chest: [['fur_amomongo', 1, 1], ['heirloom_rice', 2, 1], ['terrace_stone', 3, 1], ['arrows', 10, 1], ['golden_feather', 1, 0.15]],
      // earthen tunnels with roots, and an underground stream (the 'void' pools: water)
      look: { floor: ['#1a120b', '#4a3522', '#8a6a46'], wall: ['#120c07', '#3e2c1c', '#7a5c3a'], top: ['#0a0704', '#22180f', '#3e2c1c'], crust: ['#0c1410', '#1e3428', '#3a5a44'] },
      lava: { rim: '#0a1a14', hot: ['#b8f0e0', '#4aa8b8', '#1a5a78'], plate: ['rgba(14,46,52,0.85)', 'rgba(24,74,84,0.8)'], embers: false },
      bg: '#0b0906', propTint: 0xa8dcb0, icon: 'staff_kibaan', // (propTint: the drawn mouth's light, green like the prompt's)
      art: { mouth: 'props/banaue_mouth', gate: 'props/banaue_gate', cave: 'banaue_cave' },
    },
  });

  // Adobong Itik, cooked in your kitchen like the Wild Lands' dishes (C.RECIPES); duck counts as meat in other dishes.
  C.RECIPES.push({ dish: 'adobong_itik', needs: ['meat_itik', 'garlic', 'heirloom_rice'] });
  C.FOOD_GROUPS.meat.push('meat_itik');
})(window.Farm = window.Farm || {});
