// Manila Bay boats, step 1: deep-sea fishing trips (owner, 18 Nov 2026: "Start building it";
// docs/superpowers/specs/2026-11-18-boats-step1-sea-trips-design.md). Every number here; "decided by me" in the spec.
// Content only: the rules and the save 01-logicZ...Z-sea.js, the boat, the sea and its panels 19zzz...z-sea.js.
// Kapitana Marisol's boat ties up at berth 1 of Manila's pier: a ticket (3,000 Gold) is 10 real minutes at sea on its own
// small map (the deck, about 14 x 8, on open water), where 4 fishing spots move every 90 s. The same cast and mini game
// as the river (C.FISH_GAME) for C.FISH_ENERGY a cast; riding costs nothing. 6 sea fish and the Marlin (the boss fish),
// Seaweed snags and Capiz Shells. Friends: up to 4 aboard (the farm's room, listed in "Hunting now" as 'sea').
// The items are NEW ids only (the river's four fish, Grilled Fish and C.FISH_ORDER are untouched: the sea's biggest of
// each is kept in its own save, 'sv'). Icons: frames from C.SEA_ICON_BASE of the items texture (never in C.ICON_ORDER),
// the owner's two 4 x 2 sheets (the 'sea' pack: sea/sea_fish_icons, sea/sea_items_icons) or stand-ins.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  var MF = C.MNF;
  if (!M || !M.on || !C.WORKSHOPS.mixer || !C.POTION_KEYS) return;

  var S = C.SEA = {
    on: true,
    ticket: 3000, mins: 10, bell: 1, // a trip: its Gold, its real minutes, the bell this many minutes before the end
    moveSec: 90, spots: 4, // the fishing spots round the boat, each moving every 90 s
    snag: 0.1, // a cast brings up Seaweed instead, 1 in 10
    shells: [1, 3], // the crate's Capiz Shells, a trip
    group: 0.1, most: 4, // each extra player aboard: +10% chance of the bigger fish; at most 4 aboard
    clumpSec: 40, // a clump of seaweed drifts by about this often (scooped from the rail: free)
    // the Marlin: at most once a trip, after 5 minutes; lost, it comes back once more, 60 s later; 3 holds in a row, the
    // zone smaller and the fish faster; each other player aboard makes the zone a little wider for all
    marlin: { after: 5, back: 60, tries: 2, holds: 3, speed: 1.6, zone: 0.2, wider: 0.03 },
    hearts: { spot: 6, free: 8 }, // Kapitana Marisol: a 5th spot at 6 hearts, one free ticket a day at 8
    // the fish: [id, name, chance a bite, sell, game, usual kg, words]. The list is the save's order: APPEND ONLY.
    fish: [
      ['galunggong', 'Galunggong', 0.3, 80, 'easy', 0.25, 'A round scad, silver-blue with a yellow tail. Fried, it is breakfast.'],
      ['sea_pusit', 'Sea Pusit', 0.2, 120, 'easy', 0.6, 'A squid from the open bay, big-eyed and inky.'],
      ['maya_maya', 'Maya-Maya', 0.18, 200, 'medium', 2.5, 'A red snapper, bright as a sunset.'],
      ['lapu_lapu', 'Lapu-Lapu', 0.14, 320, 'medium', 5, 'A spotted grouper with a big mouth. Brave and stubborn.'],
      ['tanigue', 'Tanigue', 0.11, 450, 'hard', 9, 'A Spanish mackerel, long and quick. Kinilaw lovers want it.'],
      ['tuna', 'Tuna', 0.07, 700, 'hard', 18, 'A tambakol tuna, plump and strong.'],
      ['marlin', 'Marlin', 0, 5000, 'boss', 150, 'The blue marlin, king of Manila Bay. A tall sail fin and a long bill.'],
    ],
    games: { easy: { speed: 0.6, zone: 0.32 }, medium: { speed: 0.9, zone: 0.28 }, hard: { speed: 1.2, zone: 0.25 } },
    // the map: W x H tiles; the deck [x, y, w, h] (walkable); the wheelhouse and the crate on it (solid); the spawn
    W: 24, H: 18, deck: [5, 5, 14, 8], house: [5, 7, 2, 3], crate: [17, 11], spawn: [11.5, 9.4],
    // where a spot can be: a water tile beside the rail ([x, y]: you face it from the deck); it covers that tile and the
    // ones beside it along the rail. The 5th spot (6 hearts) stays at `near`, by the stern.
    slots: [[7, 4], [9, 4], [11, 4], [13, 4], [15, 4], [17, 4], [7, 13], [9, 13], [11, 13], [13, 13], [15, 13], [17, 13], [19, 6], [19, 9], [19, 12]],
    near: [4, 11],
    // Kapitana Marisol's sea tasks, in turn (and round again): [kind, fish, n | kg]. Done: friendship (+pts) and Gold.
    tasks: [['bring', 'galunggong', 5], ['bring', 'maya_maya', 3], ['bring', 'tanigue', 5], ['kg', 'tuna', 20], ['bring', 'lapu_lapu', 4], ['bring', 'tuna', 3]],
    taskPts: 10, taskGold: 600,
    tours: ['sea_tour'],
  };

  // ---------- the items (new ids; `sea` marks them) ----------
  var I = C.ITEMS;
  S.ids = S.fish.map(function (f) { return f[0]; });
  S.fish.forEach(function (f) {
    I[f[0]] = { name: f[1], kind: 'fish', sell: f[3], sea: true, desc: f[6] };
    C.FISH_GAME[f[0]] = f[4] === 'boss' ? { speed: S.marlin.speed, zone: S.marlin.zone } : S.games[f[4]];
  });
  I.seaweed = { name: 'Seaweed', kind: 'goods', sell: 20, sea: true, desc: 'A wet bunch of sea weed. The Mixer makes Sea Fertilizer with 3 of it and a Fertilizer.' };
  I.capiz = { name: 'Capiz Shell', kind: 'goods', sell: 150, sea: true, desc: 'A thin, pearly shell from Manila Bay. Manila Friends love it.' };
  I.fert_sea = { name: 'Sea Fertilizer', kind: 'fert', level: 3, sell: 60, sea: true, desc: 'Spread it on a 3x3 tilled patch. Seaweed-rich: the best odds of Silver and Gold crops in the game.' };
  // the five sea dishes: [id, name, needs, energy, sell, powers [[key, minutes], ...], words]
  S.dishes = [
    ['fried_galunggong', 'Fried Galunggong', ['galunggong', 'rice'], 40, 140, [], 'Crispy fried galunggong with rice.'],
    ['adobo_pusit_dagat', 'Adobong Pusit Dagat', ['sea_pusit', 'garlic', 'onion'], 55, 260, [['shots', 5]], 'Sea squid in adobo, with garlic and onion.'],
    ['sinigang_lapu', 'Sinigang na Lapu-Lapu', ['lapu_lapu', 'tomato', 'radish'], 60, 480, [['charge', 10]], 'Sour tamarind soup with grouper, tomato and radish.'],
    ['kinilaw_tuna', 'Kinilaw na Tuna', ['tuna', 'onion', 'ginger'], 70, 950, [['walk', 10]], 'Fresh tuna in vinegar, onion and ginger.'],
    ['inihaw_marlin', 'Inihaw na Marlin', ['marlin', 'garlic', 'chili'], 150, 6000, [['charge', 10], ['walk', 10], ['shots', 10]], 'A thick grilled marlin steak with garlic and sili.'],
  ];
  var POW = { charge: 'a charge hurts half', walk: 'you walk 20% faster', shots: 'shots cost no energy' };
  S.powers = {};
  S.dishes.forEach(function (d) {
    S.powers[d[0]] = d[5];
    I[d[0]] = { name: d[1], kind: 'dish', energy: d[3], sell: d[4], sea: true,
      desc: d[6] + ' +' + d[3] + ' energy' + (d[5].length ? '; ' + d[5].map(function (p) { return p[1] + ' minutes: ' + POW[p[0]]; }).join(', ') : '') + '.' };
    C.RECIPES.push({ dish: d[0], needs: d[2] });
  });
  S.powerText = POW;

  // ---------- the icons: two 4 x 2 sheets, in the prompts' order (art-src/SEA-TRIPS-PROMPTS.md) ----------
  C.SEA_ICON_BASE = 2600;
  C.SEA_ICONS = S.ids.concat(['seaweed', 'fried_galunggong', 'adobo_pusit_dagat', 'sinigang_lapu', 'kinilaw_tuna', 'inihaw_marlin', 'capiz', 'fert_sea', 'sea_medal']);
  // until the art: an icon the game has, tinted (the world paints them: 19zzz...z-sea.js)
  C.SEA_STAND = { galunggong: ['fish_s', '#8ac0e8'], sea_pusit: ['fish_s', '#f4b8c8'], maya_maya: ['fish_m', '#e85a5a'], lapu_lapu: ['fish_m', '#a8703a'],
    tanigue: ['fish_l', '#d0d8e0'], tuna: ['fish_l', '#3a5ab0'], marlin: ['fish_k', '#2a60d0'], seaweed: ['herb', '#2f9a4a'], fried_galunggong: ['grilled_fish', '#e0a040'],
    adobo_pusit_dagat: ['grilled_fish', '#5a3420'], sinigang_lapu: ['hot_soup', '#e8b070'], kinilaw_tuna: ['grilled_fish', '#f08a8a'], inihaw_marlin: ['grilled_fish', '#ffd040'],
    capiz: ['shell_lake', '#ffe4f2'], fert_sea: ['fert_rich', '#30b8a8'], sea_medal: ['ribbon', '#e8b830'] };
  C.SEA_ICONS.forEach(function (n, i) { C.ICON[n] = C.SEA_ICON_BASE + i; if (I[n]) I[n].icon = C.ICON[n]; });

  // ---------- Sea Fertilizer: the Mixer (appended: a recipe's place is saved), level 3 of the fertilizers ----------
  C.WORKSHOPS.mixer.recipes.push({ out: 'fert_sea', mins: 45, needs: [['seaweed', 3], ['fert', 1]] });
  C.MADE_IN.fert_sea = 'mixer';
  C.FERTS.push({ id: 'fert_sea', level: 3, name: 'Sea Fertilizer' });
  C.QUALITY.chance.push([0.45, 0.32]); // ([Silver, Gold]: Rich Fertilizer's are 0.4 and 0.25)

  // ---------- Capiz: loved by Kapitana Marisol, Lola Amparo and Bea (decided by me) ----------
  if (MF) ['mn_marisol', 'mn_amparo', 'mn_bea'].forEach(function (k) { if (MF.friends[k]) MF.friends[k].loves.push('capiz'); });

  // ---------- the Hall of Fame: the first Marlin (the server's farm.hall_first_keys 'sea_boss') ----------
  if (C.HALL) {
    C.HALL.FIRSTS.push({ key: 'sea_boss', map: 'sea', kind: 'marlin', name: 'the Marlin',
      words: 'A FIRST FOR HARVEST VILLE!\nYou are the first player ever to catch the Marlin! Your name is in the Hall of Fame for everyone to see.' });
    C.HALL.spots.w8.keys.push('sea_boss');
  }

  // ---------- the berth, the bay, the harbor ----------
  M.buildings.forEach(function (b) { if (b.key === 'harbor') b.text = "Kapitana Marisol's Harbor Office. Her fishing boat is at berth 1: sea trips, 10 minutes for 3,000 Gold. More boats coming soon!"; });
  M.signs.forEach(function (sg) { if (/^MANILA BAY/.test(sg[2])) sg[2] = 'MANILA BAY\nThe port and the pier are south. Sea trips: Kapitana Marisol\'s boat at berth 1.'; });
  if (M.people.marisol) M.people.marisol.lines[0] = 'My boat is at berth 1 now! A sea trip: ten minutes on the open bay, 3,000 Gold.';
  // the boat's map is seen online ('sea': the farm's room shows who is aboard; 19h-online.js)
  C.ONLINE_MORE_MAPS = (C.ONLINE_MORE_MAPS || []).concat(['sea']);
})(window.Farm = window.Farm || {});
