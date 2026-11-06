// Town Rank and the Hall of Fame (owner, 6 Nov 2026). The words and numbers; the rules are 01-logicZZZZ-rank.js, the
// world, the pages and the tours 19zzzz-rank.js, the server supabase/farm_online_22.sql.
//   Town Rank ("Town Rank is better than Hunter ranking"): one ranking each month of how much you did for Harvest Ville,
//   across everything: farming, cooking and workshop goods, fishing, mining, hunting and helping the town. Bronze,
//   Silver, Gold and Champion by points this month, and the Top 100. Rewards are looks only (a badge colour by your name
//   and a title), never power. It starts over on the 1st of each month, Manila time; your best rank ever stays on your
//   card. Fair play: each kind of point has a daily cap (the server keeps the same caps), and nothing you buy gives points.
//   The Hall of Fame (owner: "inside the museum is the name of the player who get the big boar, or first defeat boss
//   something like that"): Central Park's museum, inside. Plaques with names from the server: the biggest catch of each
//   animal and each Derby fish, the first to beat the Bakunawa and each Lair guard, Town Rank champions, and (when it
//   comes) the Bayanihan Project's top givers.
// Adds nothing to a saved list (no icons, items or crops).
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- Town Rank ----------
  // Points for each kind of thing you do, and the most of each that counts in one day (Manila's day). The server keeps
  // the same daily caps (farm.rank_sources in part 22): a changed game cannot send more.
  C.RANK = {
    sources: {
      farm: { name: 'Farming', each: 1, day: 300, icon: 'turnip', what: '1 for each crop you pick or animal product you collect' },
      goods: { name: 'Cooking and goods', each: 3, day: 150, icon: 'bread', what: '3 for each dish you cook or good you make' },
      fish: { name: 'Fishing', each: 3, day: 150, icon: 'fish_m', what: '3 for each fish you catch' },
      mine: { name: 'Mining', each: 1, day: 150, icon: 'ore_copper', what: '1 for each rock you break in the Mine' },
      hunt: { name: 'Hunting', each: 5, day: 150, icon: 'meat_boar', what: '5 for each animal you hunt' },
      help: { name: 'Helping the town', each: 5, day: 300, icon: 'crate', what: '5 a cargo crate, 20 more for a full cargo order, 10 a villager\'s request, 5 a shipping order' },
      // The Bayanihan Project (another part of the game, coming): its gifts count here. It calls L.rankAdd(s, 'bayanihan', n).
      bayanihan: { name: 'Bayanihan Project', each: 10, day: 200, icon: 'gift', what: '10 for each gift to the Bayanihan Project' },
    },
    order: ['farm', 'goods', 'fish', 'mine', 'hunt', 'help', 'bayanihan'], // (the server's list too: a new kind is appended)
    help: { crate: 5, cargo: 20, request: 10, order: 5 }, // helping the town, by what you did
    // Points this month for each rank. Looks only: the badge's colour and a title.
    tiers: [
      { key: 'bronze', name: 'Bronze', at: 300, color: 0xc77b3a, css: '#c77b3a', title: 'Town Helper' },
      { key: 'silver', name: 'Silver', at: 2000, color: 0xb8c4d0, css: '#8a98a8', title: 'Pride of the Town' },
      { key: 'gold', name: 'Gold', at: 8000, color: 0xf2c230, css: '#c99a10', title: 'Hero of Harvest Ville' },
      { key: 'champion', name: 'Champion', at: 20000, color: 0xd070f0, css: '#9a3ac0', title: 'Champion of Harvest Ville' },
    ],
    top: 100, // the board's length
    sendEvery: 60000, // ms between sends of the points you earned (and when you leave a place, or the game sleeps)
    offline: 'Join online play to see the Top 100.',
  };

  // ---------- the Hall of Fame ----------
  // What each plaque or pedestal in the hall (maps/hall.json, objects of type 'plaque' with a 'spot') shows. kind:
  //   'catch' the biggest of each animal of a place (WILD.areas[area], from the server's Biggest catch records);
  //   'animal' one animal's biggest; 'fish' the Derby's biggest of each fish; 'firsts' the firsts in `keys`;
  //   'first' one first; 'champs' Town Rank's champions; 'top' this month's Town Rank top 10 (the big board);
  //   'more' any records no other plaque shows (a new hunting place's animals, until it has its own plaque);
  //   'bayanihan' the Bayanihan Project's top givers (filled when that part comes); 'soon' an empty plaque.
  // A new hunting place: give its animals a spot here (one line). Its dungeon's boss is a first by itself (below, on the
  // plaque w8) and needs one row in the server's list (farm.hall_first_keys: '<place>_boss'). Another first: one line in
  // FIRSTS, one row on the server.
  C.HALL = {
    name: 'The Hall of Fame',
    offline: 'Join online play to see the names.',
    loading: 'Reading the names...',
    later: 'The names go up here very soon.', // (online, but the server has no Hall of Fame yet)
    soon: 'A new plaque will hang here soon.',
    you: "That's you!",
    spots: {
      w1: { kind: 'catch', area: 'pulag', title: 'BIGGEST CATCHES: PULAG', icon: 'white_antler', trophy: 'trophy_stag' },
      w2: { kind: 'catch', area: 'makiling', title: 'BIGGEST CATCHES: MAKILING', icon: 'gold_tusk', trophy: 'trophy_goldboar' },
      w3: { kind: 'catch', area: 'magayon', title: 'BIGGEST CATCHES: MAGAYON', icon: 'tusk_mammoth', trophy: 'trophy_mammoth' },
      board: { kind: 'top', title: 'TOWN RANK: THIS MONTH', icon: 'star' },
      w4: { kind: 'fish', title: 'FISHING DERBY RECORDS', icon: 'fish_k' },
      w5: { kind: 'firsts', keys: ['lair_10', 'lair_20', 'lair_30', 'lair_40'], title: "FIRSTS: BAKUNAWA'S LAIR", icon: 'bungisngis_tooth' },
      w6: { kind: 'champs', title: 'TOWN RANK CHAMPIONS', icon: 'ribbon' },
      w7: { kind: 'more', title: 'MORE HUNTING RECORDS', icon: 'antler' },
      w8: { kind: 'firsts', keys: [], title: 'FIRSTS: THE NEW DUNGEONS', icon: 'sparkle' }, // (keys: below)
      d1: { kind: 'animal', animal: 'boar', title: 'THE BIGGEST WILD BOAR', icon: 'tusk', cup: 'gold' },
      d2: { kind: 'first', key: 'bakunawa', title: 'FIRST TO BEAT THE BAKUNAWA', icon: 'bakunawa_scale', cup: 'gold' },
      d3: { kind: 'champs', title: 'LAST MONTH\'S CHAMPION', icon: 'ribbon', cup: 'champion', last: true },
      d4: { kind: 'first', key: 'greatmammoth', title: 'FIRST TO HUNT THE GREAT MAMMOTH', icon: 'great_tusk', cup: 'silver' },
      d5: { kind: 'bayanihan', title: 'BAYANIHAN PROJECT: TOP GIVERS', icon: 'gift', cup: 'silver' },
    },
    // The firsts the server keeps (its allow-list: farm.hall_first_keys in part 22). Each is won by whoever claims it
    // first, once. map + kind = the hunt that wins it; floor = only on that floor (the Lair's guards).
    FIRSTS: [
      { key: 'bakunawa', map: 'lair', kind: 'bakunawa', name: 'the Bakunawa' },
      { key: 'lair_10', map: 'lair', kind: 'bungisngis', floor: 10, name: 'the guard of floor 10' },
      { key: 'lair_20', map: 'lair', kind: 'bungisngis', floor: 20, name: 'the guard of floor 20' },
      { key: 'lair_30', map: 'lair', kind: 'bungisngis', floor: 30, name: 'the guard of floor 30' },
      { key: 'lair_40', map: 'lair', kind: 'bungisngis', floor: 40, name: 'the guard of floor 40' },
      { key: 'greatmammoth', map: 'magayon', kind: 'greatmammoth', name: 'the Great Mammoth' },
      // (each new dungeon boss: one line here, e.g. { key: 'cave_boss', map: 'cave', kind: 'boss_kind', name: 'the ...' })
    ],
    words: "THE HALL OF FAME\nThe names of Harvest Ville's best hunters, farmers and anglers. Walk up to a plaque to read it.",
  };

  // Each new hunting place's dungeon boss (owner, 7 Nov 2026): the first to beat it, '<place>_boss', from the places'
  // own data (so a place added later is here by itself), all on the plaque w8
  C.PLACE_ORDER.forEach(function (id) {
    var p = C.PLACES[id], d = p.dungeon, boss = d && d.boss && C.WILD.animals[d.boss];
    if (!(p.n > 10) || p.dev || !boss) return;
    C.HALL.FIRSTS.push({ key: id + '_boss', map: d.key, kind: d.boss, name: 'the ' + boss.name });
    C.HALL.spots.w8.keys.push(id + '_boss');
  });

  // the way out of the hall toward everywhere else (the goal arrow, following a friend): out the door, then the park's way
  var R = C.ROUTES;
  R.hall = {};
  Object.keys(R).forEach(function (m) {
    if (m === 'hall') return;
    R.hall[m] = 'exit';
    R[m].hall = m === 'park' ? 'hall_door' : R[m].park;
  });
})(window.Farm = window.Farm || {});
