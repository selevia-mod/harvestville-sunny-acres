// Manila, the big city (owner, 11 Nov 2026: docs/big-city-and-weapons.md; the layout, people and prices proposed in
// docs/manila-proposals.md). Step 1: the city itself, the train and the valley road there and back, its people at their
// places with a few words each. Shops, the Hall of Fame, the gates to the three hunting grounds: "Coming soon".
// Content only. Rules (the map built from this layout, tickets, the save): 01-logicZZZZZZZZZZZZZZ-manila.js. The world
// (the drawn ground, the buildings, the people, the station's Manila tab): 19zzzzzzzzzzzzzzzzzzzzzzzzz-manila.js.
//
// The map is NOT a file in maps/ (the page is nearly full): it is built at run time from the boxes below. x goes left to
// right (0-89), y top to bottom (0-89), in tiles, as in the proposals. A box is [x, y, w, h].
// PICTURES: none of the owner's yet (art-src/MANILA-PROMPTS.md, batches 1-2). Until they come, every building and prop
// borrows a town picture (`stand`) scaled into its box, with its name on a small label, and the ground is drawn on a
// canvas. Each one's own picture (`art`, art-src/manila/<art>.png) goes into the download pack 'manila' by
// tools/manila/manila-import.js and takes over once it is on the phone.
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60;

  C.MANILA = {
    on: true, // (the whole city: off, and the station's tab and the valley road are gone again)
    key: 'manila', W: 90, H: 90,
    // the train (Willowbrook Station <-> Manila Central): one way, any time; the first ride free (proposals 4)
    fare: 250, freeRides: 1,
    // The valley road on horseback (owner: 6 hearts and Horseshoes) belongs to farm-economy-v2 part 5, not built yet: for
    // now the road is walked. Turn this on (and fill in L.manilaRoad) when the horse goes out.
    horseRoad: false, horseHearts: 6,
    // Open to everyone: the game server's public rooms, 30 a room ("Manila 1", "Manila 2"...), as the hunting places, with
    // no animals (server/lib/pub.js: a city room). A server from before says no to it: then you see the friends in your
    // farm's room there, as anywhere else. Off: always that.
    pub: true,
    soon: 'Coming soon!',

    // ---------- the ground (painted in order; later boxes win) ----------
    // kinds: grass, flowers, path, sand, dock, tplaza (the town's plaza stone), water (the town's), and Manila's own
    // drawn tiles: cobble, plaza, baywalk, bay (water), wall (old stone), track, rails
    ground: [
      ['bay', 0, 0, 12, 90],
      ['sand', 12, 0, 1, 90],
      ['baywalk', 12, 6, 4, 43], ['baywalk', 12, 67, 4, 21],
      // the port: the quay, the breakwater out to the lighthouse, the pier with its three berths
      ['cobble', 12, 49, 9, 18], ['cobble', 2, 50, 5, 7], ['cobble', 7, 55, 5, 2], ['dock', 2, 60, 11, 3],
      // the walled quarter: cobbles inside, the walls round it (2 thick), the bastions at the corners, the two gates
      ['cobble', 16, 4, 25, 27],
      ['wall', 16, 4, 25, 2], ['wall', 16, 29, 25, 2], ['wall', 16, 4, 2, 27], ['wall', 39, 4, 2, 27],
      ['wall', 14, 3, 2, 2], ['wall', 41, 3, 2, 2], ['wall', 14, 30, 2, 2], ['wall', 41, 30, 2, 2],
      ['cobble', 16, 14, 2, 3], ['cobble', 27, 29, 3, 2], // (the Sea Gate, west; the Plaza Gate, south)
      ['plaza', 24, 16, 5, 4], // the little square in front of the church
      // Calle Real, from the Plaza Gate down to the avenue; the avenue east to the Plains Gate and west to the bay walk
      ['cobble', 26, 31, 5, 13], ['path', 12, 44, 78, 2],
      // the roads: north to the Gorge Gate, the lane to the station, south to the stables, south-west to the Jungle Gate
      ['path', 44, 0, 4, 36], ['path', 48, 8, 8, 2], ['path', 52, 55, 3, 3],
      ['path', 39, 55, 3, 15], ['path', 28, 88, 4, 2], // (the Jungle Gate's road off the jeep's south road)
      // the station: its platform (the rails are drawn by the game)
      ['tplaza', 56, 8, 31, 2], ['rails', 56, 10, 34, 2],
      // Central Plaza, Grand Market's cobbles
      ['plaza', 40, 36, 19, 19], ['cobble', 60, 43, 21, 8],
      // the barrio's lane (city life: the Mall took its south half)
      ['path', 23, 66, 15, 2],
      // the stables' yard, the paddock's grass, the race track (an oval 2 tiles wide)
      ['path', 53, 55, 10, 2], ['track', 66, 61, 21, 26],
      ['grass', 68, 63, 17, 22],
    ],
    // the oval's corners, cut back to grass (round, not a box)
    trackCorners: [[66, 61], [86, 61], [66, 86], [86, 86]],

    // ---------- buildings and props ----------
    // box [x, y, w, h]; stand: the town picture it borrows (fitted into the box, its feet on the box's bottom); foot: the
    // rows at the bottom you cannot walk through; art: its own picture to come (art-src/manila/<art>.png); name: the label
    // over the stand-in and what it says when you look at it (text). who: the person who keeps it.
    buildings: [
      { key: 'church', name: 'Old Stone Church', box: [22, 7, 9, 9], stand: 'chapel', foot: 3, art: 'old_church', text: 'An old stone church with two bell towers. Its bells ring at six, at noon and at six again.' },
      { key: 'armory', name: 'Armory', box: [31, 18, 7, 6], stand: 'forge', foot: 3, art: 'armory', who: 'lando', tint: 0xd8d0c0, text: "Panday Lando's armory in the old fort. The Rifle, the Javelin and the Boomerang: coming soon!" },
      { key: 'amparo', name: "Lola Amparo's", box: [18, 22, 5, 6], stand: 'cottage', foot: 2, art: 'house_5', who: 'amparo', text: "Lola Amparo's little house. Her room of old things opens soon." },
      { key: 'oldhouse1', name: '', box: [18, 7, 4, 4], stand: 'townhouse_1', foot: 2, art: 'house_1', tint: 0xe8dcc8 },
      { key: 'oldhouse2', name: '', box: [32, 6, 4, 4], stand: 'townhouse_3', foot: 2, art: 'house_1', tint: 0xe8dcc8 },
      { key: 'oldhouse3', name: '', box: [34, 11, 4, 4], stand: 'townhouse_2', foot: 2, art: 'house_2', tint: 0xe8dcc8 },
      { key: 'station', name: 'Manila Central', box: [56, 2, 9, 6], stand: 'tw_station', foot: 2, art: 'station_manila', who: 'tibo', station: true },
      { key: 'harbor', name: 'Harbor Office', box: [14, 54, 6, 5], stand: 'post', foot: 2, art: 'harbor_office', who: 'marisol', tint: 0xdde8f4, text: "Kapitana Marisol's Harbor Office. Boats on Manila Bay: coming soon!" },
      { key: 'lighthouse', name: 'Lighthouse', box: [3, 50, 3, 6], stand: 'lantern', foot: 1, art: 'lighthouse', tint: 0xffd0c8, text: 'The lighthouse at the end of the breakwater. Its lamp guides the boats home.' },
      { key: 'fountain', name: '', box: [47, 43, 5, 5], stand: 'fountain', foot: 3, art: 'plaza_fountain', text: 'The big fountain of the Central Plaza, where everyone meets.' },
      { key: 'hall', name: 'Hall of Fame', box: [51, 36, 8, 6], stand: 'mayor', foot: 2, art: 'hall_of_fame_manila', tint: 0xf4ecd8, text: "Manila's Hall of Fame: the city's best hunters, farmers and riders. Coming soon!" },
      { key: 'stage', name: 'Event Stage', box: [39, 50, 5, 4], stand: 'gazebo', foot: 2, art: 'plaza_stage', text: 'The plaza stage. Shows and events: coming soon!' },
      { key: 'market', name: 'Grand Market', box: [62, 35, 11, 8], stand: 'inn', foot: 3, art: 'grand_market', who: 'rosa', tint: 0xfff0d0, text: "The Grand Market. Aling Rosa's big crop orders: coming soon!" },
      { key: 'trading', name: 'Trading Post', box: [74, 36, 6, 6], stand: 'vet', foot: 2, art: 'trading_post', who: 'danny', tint: 0xe0c8a8, text: "Mang Danny's Trading Post: rope, cement, wax and chili. Coming soon!" },
      { key: 'stables', name: 'Stables', box: [54, 57, 8, 6], stand: 'stable', foot: 2, art: 'stables', who: 'kardo', text: "Mang Kardo's Stables. Horse gear, oats and the weekly race: coming soon!" },
      { key: 'grandstand', name: 'Grandstand', box: [68, 56, 13, 4], stand: 'school', foot: 2, art: 'grandstand', tint: 0xf8e0e0, text: 'The grandstand of the race track. The Manila Cup: coming soon!' },
      { key: 'store', name: 'Corner Store', box: [23, 57, 4, 4], stand: 'florist', foot: 2, art: 'house_4', text: 'A little corner store. Opens soon!' },
      { key: 'house1', name: '', box: [27, 57, 4, 4], stand: 'townhouse_1', foot: 2, art: 'house_2' },
      { key: 'house2', name: '', box: [30, 61, 4, 4], stand: 'townhouse_2', foot: 2, art: 'house_3' },
      { key: 'house3', name: '', box: [28, 68, 4, 4], stand: 'townhouse_3', foot: 2, art: 'house_5' },
      { key: 'house4', name: '', box: [33, 68, 4, 4], stand: 'townhouse_4', foot: 2, art: 'house_6' },
      { key: 'house8', name: '', box: [36, 57, 3, 4], stand: 'townhouse_4', foot: 2, art: 'house_3' },
      { key: 'cafe', name: '', box: [18, 33, 5, 4], stand: 'bakery', foot: 2, art: 'house_4', tint: 0xf4e4cc, text: 'A bakery on Calle Real. Opens soon!' },
      { key: 'shop2', name: '', box: [32, 33, 5, 4], stand: 'post', foot: 2, art: 'house_4', tint: 0xf0d8c8, text: 'A shop on Calle Real. Opens soon!' },
      { key: 'shop3', name: '', box: [18, 38, 4, 4], stand: 'townhouse_3', foot: 2, art: 'house_2' },
      { key: 'shop4', name: '', box: [33, 38, 4, 4], stand: 'townhouse_1', foot: 2, art: 'house_6' },
    ],
    // small props: [stand, x, y, w, h, foot, art] (art: its piece of one of the sheets of 6 below)
    props: [
      // the plaza: the notice board, benches, lamps
      ['notice', 42, 37, 2, 2, 1, 'notice_board'], ['bench', 45, 40, 2, 1, 1, 'park_bench'], ['bench', 50, 49, 2, 1, 1, 'park_bench'],
      ['bench', 45, 49, 2, 1, 1, 'park_bench'], ['lamp', 45, 42, 1, 2, 1, 'street_lamp'], ['lamp', 53, 42, 1, 2, 1, 'street_lamp'],
      ['lamp', 45, 47, 1, 2, 1, 'street_lamp'], ['lamp', 53, 47, 1, 2, 1, 'street_lamp'], ['statue', 40, 45, 2, 3, 1, 'planter'],
      // the market's stalls and the contract board
      ['order_board', 63, 43, 2, 2, 1, 'notice_board'], ['fruit_stall', 61, 47, 2, 2, 1, 'fruit_stall'], ['cloth_stall', 64, 47, 2, 2, 1, 'market_baskets'],
      ['fruit_stall', 67, 47, 2, 2, 1, 'fruit_stall'], ['umbrella', 70, 47, 2, 2, 1, 'food_cart'], ['trader_tent', 74, 47, 3, 2, 1, 'kiosk'],
      ['farm_stand', 78, 47, 2, 2, 1, 'market_baskets'],
      // Calle Real's carts
      ['umbrella', 23, 38, 2, 2, 1, 'food_cart'], ['farm_stand', 31, 41, 2, 2, 1, 'market_baskets'], ['fruit_stall', 24, 35, 2, 2, 1, 'fruit_stall'],
      // the church square, the walled quarter
      ['flowerbed', 24, 19, 2, 1, 1, 'planter'], ['flowerbed', 27, 19, 2, 1, 1, 'planter'], ['lamp', 23, 16, 1, 2, 1, 'street_lamp'], ['lamp', 29, 16, 1, 2, 1, 'street_lamp'],
      ['wagon', 23, 23, 3, 3, 2, 'kalesa'],
      // the port: crates and rope (and nothing in the three berths yet)
      ['farm_stand', 13, 62, 2, 2, 1, 'cargo'],
      // the barrio: the kalesa stand, the jeep stop, the court
      ['wagon', 36, 62, 3, 3, 2, 'kalesa'],
      // the station's benches
      ['bench', 68, 7, 2, 1, 1, 'park_bench'], ['bench', 76, 7, 2, 1, 1, 'park_bench'],
    ],
    // the bay walk's lamps (x 15) and benches (x 12), every few tiles
    baywalk: { lamps: [8, 19, 25, 36, 42, 70, 76, 82], benches: [11, 23, 35, 73, 85] },
    // tree rows round the edge (2 x 2 trees), and loose trees and bushes
    trees: [
      [18, 0, 42, 0], [48, 0, 55, 0], [66, 0, 88, 0], [88, 12, 88, 40], [88, 48, 88, 86], [16, 88, 26, 88], [32, 88, 88, 88],
    ],
    looseTrees: [[42, 7], [42, 14], [42, 22], [49, 20], [49, 27], [53, 15], [53, 24], [66, 15], [72, 18], [80, 15], [83, 25], [76, 28], [68, 26],
      [17, 47], [36, 47], [44, 58], [47, 66], [44, 74], [47, 82], [38, 79], [26, 49], [82, 52]],
    bushes: [[43, 30], [55, 30], [60, 30], [61, 52], [79, 52], [37, 52], [21, 52], [63, 19], [77, 22]],
    // fences: [x0, y0, x1, y1, gate x] (the paddock by the stables, its gate in the top side)
    fences: [[54, 64, 62, 70, 58]],
    // crates on the quay (solid boxes)
    crates: [[16, 63], [17, 63], [16, 64], [19, 49]],

    // ---------- the three berths, the gates, the signs ----------
    berths: [[4, 60], [7, 60], [10, 60]], // (sign posts on the pier's north edge; the water beside them is the berth)
    gates: [
      { key: 'plains', name: 'Plains Gate', box: [89, 42, 1, 6], warp: true, sign: [88, 42], text: 'PLAINS GATE\nThe valley road home to Willowbrook goes east from here.\nThe Open Plains hunting ground: coming soon!' },
      { key: 'gorge', name: 'Gorge Gate', box: [44, 0, 4, 2], sign: [43, 2], text: 'GORGE GATE\nThe Rocky Gorge lies north. Coming soon!' },
      { key: 'jungle', name: 'Jungle Gate', box: [28, 88, 4, 2], sign: [26, 88], text: 'JUNGLE GATE\nThe Bamboo Jungle lies south. Coming soon!' },
    ],
    signs: [
      [18, 13, 'SEA GATE\nThe old walled quarter. The church, the Armory, and Lola Amparo.'],
      [26, 31, 'PLAZA GATE\nInto the walled quarter. Calle Real runs south to the Central Plaza.'],
      [57, 52, 'CENTRAL PLAZA\nWelcome to Manila! The station is north, the market east, the stables south-east, the bay west.'],
      [13, 48, 'MANILA BAY\nThe port and the pier are south. Boats: coming soon!'],
      [52, 10, 'MANILA CENTRAL\nTrains to Willowbrook. Mang Tibo sells the tickets.'],
    ],

    // ---------- decorations: the owner's pieces, drawn only once their picture is in (no stand-in, nothing in the way
    // until then) ----------
    // [art, x, y, w, h, foot] (foot 0: drawn over what is already solid, or something you walk under or past)
    decor: [
      // the three gates (owner's art): the Gorge and Jungle arches over their shut roads, the Plains gatehouse by the road
      ['gate_gorge', 44, 0, 4, 3, 0], ['gate_jungle', 28, 88, 4, 2, 0], ['gate_plains', 82, 46, 4, 4, 1],
      // the old walls: straight pieces along the north and south walls, bastions at the corners, the Plaza Gate's arch,
      // towers on the west and east walls (all drawn over the solid stone)
      ['wall_bastion', 14, 2, 3, 3, 0], ['wall_bastion', 40, 2, 3, 3, 0], ['wall_bastion', 14, 29, 3, 3, 0], ['wall_bastion', 40, 29, 3, 3, 0],
      ['wall_straight', 18, 4, 3, 2, 0], ['wall_straight', 21, 4, 3, 2, 0], ['wall_straight', 24, 4, 3, 2, 0], ['wall_straight', 27, 4, 3, 2, 0],
      ['wall_straight', 30, 4, 3, 2, 0], ['wall_straight', 33, 4, 3, 2, 0], ['wall_straight', 36, 4, 3, 2, 0],
      ['wall_straight', 17, 29, 3, 2, 0], ['wall_straight', 20, 29, 3, 2, 0], ['wall_straight', 23, 29, 3, 2, 0],
      ['wall_straight', 31, 29, 3, 2, 0], ['wall_straight', 34, 29, 3, 2, 0], ['wall_straight', 37, 29, 3, 2, 0], ['wall_gate', 27, 28, 3, 3, 0],
      ['wall_tower', 16, 7, 2, 3, 0], ['wall_tower', 16, 19, 2, 3, 0], ['wall_tower', 16, 24, 2, 3, 0],
      ['wall_tower', 39, 8, 2, 3, 0], ['wall_tower', 39, 15, 2, 3, 0], ['wall_tower', 39, 23, 2, 3, 0], ['wall_stair', 36, 26, 2, 2, 1],
      // the port: mooring posts in the berths' water, cargo, rope and an anchor, a signpost
      ['mooring_post', 3, 63, 1, 1, 0], ['mooring_post', 6, 63, 1, 1, 0], ['mooring_post', 9, 63, 1, 1, 0], ['mooring_post', 12, 63, 1, 1, 0],
      ['cargo', 17, 50, 2, 2, 1], ['rope_anchor', 13, 51, 2, 2, 1], ['signpost', 13, 57, 1, 2, 1], ['cargo', 18, 63, 2, 2, 1],
      ['palm', 17, 52, 2, 2, 1], ['palm', 13, 65, 2, 2, 1],
      // the race: the start arch over the track, 6 hurdles on it, flags, the podium, the oats trough by the stables
      ['race_arch', 75, 60, 3, 3, 0], ['hurdle', 70, 61, 2, 1, 0], ['hurdle', 81, 61, 2, 1, 0], ['hurdle', 70, 85, 2, 1, 0],
      ['hurdle', 80, 85, 2, 1, 0], ['hurdle', 66, 72, 2, 1, 0], ['hurdle', 85, 74, 2, 1, 0],
      ['flag_post', 66, 58, 1, 2, 1], ['flag_post', 87, 59, 1, 2, 1], ['flag_post', 76, 73, 1, 2, 1], ['podium', 82, 57, 2, 2, 1],
      ['trough_oats', 52, 65, 2, 2, 1],
      // the plaza: palms, a kiosk, a food cart
      ['palm', 56, 50, 2, 2, 1], ['kiosk', 52, 51, 3, 3, 1], ['food_cart', 44, 52, 2, 2, 1],
      // the market and the station
      ['food_cart', 62, 49, 2, 2, 1], ['market_baskets', 72, 49, 2, 2, 1],
      ['palm', 66, 5, 2, 2, 1], ['palm', 80, 5, 2, 2, 1], ['kiosk', 84, 4, 3, 3, 1],
      // the streets: lamps on the north road and the avenue's east end
      ['street_lamp', 48, 11, 1, 2, 1], ['street_lamp', 48, 17, 1, 2, 1], ['street_lamp', 48, 24, 1, 2, 1], ['street_lamp', 48, 31, 1, 2, 1],
      ['street_lamp', 82, 42, 1, 2, 1], ['street_lamp', 81, 46, 1, 2, 1], ['street_lamp', 60, 42, 1, 2, 1],
      // the bay walk's palms, the barrio's
      ['palm', 14, 33, 2, 2, 1], ['palm', 14, 39, 2, 2, 1], ['palm', 14, 67, 2, 2, 1], ['palm', 14, 80, 2, 2, 1],
      ['palm', 38, 73, 2, 2, 1], ['food_cart', 26, 70, 2, 2, 1], ['planter', 31, 56, 2, 1, 1],
    ],
    // and scattered (the same everywhere, a seeded random): [art, x0, y0, x1, y1, how many, w, h, foot]; only on grass, with
    // a tile of grass all round, so no walk is ever narrowed
    scatter: [
      ['palm', 49, 13, 86, 33, 16, 2, 2, 1], ['park_bench', 50, 14, 86, 33, 5, 2, 1, 1], ['planter', 50, 14, 86, 33, 5, 2, 1, 1],
      ['food_cart', 50, 14, 86, 33, 2, 2, 2, 1], ['palm', 69, 64, 83, 83, 6, 2, 2, 1], ['palm', 42, 56, 52, 86, 7, 2, 2, 1],
      ['planter', 42, 56, 52, 86, 3, 2, 1, 1], ['palm', 56, 72, 64, 86, 4, 2, 2, 1], ['palm', 16, 42, 38, 54, 4, 2, 2, 1],
    ],

    // ---------- the city folk: the crowd in the streets (owner, 11 Nov 2026: "make it crowded, we need at least 30") ----------
    // How many walk about besides the 7 above: by day, at night (about a third of the whole), and on a cheap phone (about
    // 15 in all). Each has a look (a walking sheet of 9 frames a row like the villagers': [sheet, row]; never Willowbrook's
    // own villagers) and a tint; a look whose sheet is not on this phone yet is skipped. New city-folk sheets go in this
    // one list.
    crowd: {
      day: 26, night: 4, cheap: 8, cheapNight: 3,
      looks: [['tw_people', 0], ['tw_people', 1], ['tw_people', 2], ['tw_people', 3], ['tw_people', 4],
        ['npc_ka_pedring', 0], ['npc_diday', 0], ['npc_tata_ambo', 0],
        ['npc_mang_celso', 0], ['npc_mang_pido', 0], ['npc_mang_tonyo', 0], ['npc_ka_ramon', 0], ['npc_lola_bugan', 0]],
      tints: [0, 0xffe2d0, 0xdce8ff, 0xe4ffd4, 0xfff0b0, 0xf0d8ff, 0xd8fff4],
      // their own sheets, the three ground guides (art-src/manila/), in the 'manila' pack: passers-by until their grounds open
      sheets: ['npc_ka_pedring', 'npc_diday', 'npc_tata_ambo'],
      // where they go: [x, y, what they do there] (stand, sit: on the bench beside it, browse: facing up at a stall, wait,
      // watch: facing the way given); w: how many go there [morning 6-11, midday 11-16, evening 16-21, night 21-6]
      zones: {
        plaza: { w: [2, 3, 6, 2], at: [[44, 41], [48, 41], [51, 42], [55, 46], [43, 47], [47, 50], [52, 50], [55, 43], [44, 51], [49, 52], [45, 41, 'sit'], [50, 50, 'sit'], [45, 50, 'sit']] },
        market: { w: [6, 3, 2, 0], at: [[61, 49, 'browse'], [64, 49, 'browse'], [67, 49, 'browse'], [70, 49, 'browse'], [75, 49, 'browse'], [78, 49, 'browse'], [66, 46], [70, 44], [76, 45], [64, 45], [79, 45, 'browse']] },
        baywalk: { w: [2, 2, 4, 1], at: [[13, 10, 'left'], [14, 17], [13, 21, 'left'], [14, 28], [13, 37, 'left'], [14, 45], [13, 70, 'left'], [14, 75], [13, 83, 'left'], [12, 12, 'sit'], [12, 24, 'sit'], [12, 74, 'sit']] },
        platform: { w: [3, 2, 2, 1], at: [[58, 9, 'wait'], [66, 9, 'wait'], [70, 8, 'wait'], [74, 9, 'wait'], [78, 8, 'wait'], [82, 9, 'wait'], [86, 8, 'wait'], [68, 8, 'sit'], [76, 8, 'sit']] },
        track: { w: [1, 2, 3, 0], at: [[69, 60, 'down'], [72, 60, 'down'], [75, 63, 'down'], [79, 60, 'down'], [65, 70, 'right'], [65, 78, 'right'], [87, 66, 'left'], [87, 80, 'left']] },
        pier: { w: [1, 1, 2, 1], at: [[3, 61, 'left'], [5, 62, 'down'], [8, 61, 'down'], [11, 62, 'down'], [3, 56], [7, 56, 'down']] },
        calle: { w: [2, 3, 3, 1], at: [[28, 33], [29, 37], [27, 40], [30, 42], [26, 36, 'left'], [30, 34, 'right']] },
        church: { w: [2, 1, 1, 0], at: [[25, 18, 'up'], [27, 17, 'up'], [26, 21], [30, 20], [21, 16], [34, 16]] },
        barrio: { w: [2, 2, 2, 3], at: [[24, 64], [30, 66], [35, 64], [26, 73], [33, 79], [35, 80], [22, 67], [29, 74]] },
        park: { w: [1, 2, 1, 0], at: [[55, 18], [62, 22], [70, 16], [77, 23], [59, 29], [74, 31], [84, 20], [66, 28]] },
      },
      // what a passer-by says (one at random)
      lines: ['Have you seen the sunset over the bay? Pure gold!', 'The Grand Market opens soon. My basket is ready!',
        'I came in on the morning train. What a ride!', 'They say boats are coming to the bay soon. I cannot wait!',
        'Every weekend there will be a race at the track. Bring your horse!', 'The fountain is my favourite place to meet friends.',
        'Mang Tibo has kept the trains on time for forty years.', 'Calle Real has the best street food. Try the barbecue!',
        'The old walls are older than my lola\'s lola.', 'Mabuhay! First time in Manila?', 'The church bells woke me up again. I love it.',
        'I am saving up for a ride on a kalesa.', 'Aling Rosa says the city needs more corn. Plant some!',
        'The bay breeze is so nice this time of day.', 'My lola sells kakanin by the station.', 'Watch your step on the pier!',
        'The Armory is making something new. Very secret!', 'A jeep ride round the city? Soon, they say.',
        'I walk the bay walk every day. Good for the heart!', 'Manila is busy, but everyone has time to say hello.'],
    },

    // ---------- the owner's pictures (art-src/manila/, MANILA-PROMPTS batches 1-2) ----------
    // tools/manila/manila-import.js makes each into the 'manila' pack: a ground texture into manila_tex_<slot> (the game
    // paints it into its ground sheet), a single picture into props/manila_<name>, a sheet's pieces (cols x rows, in the
    // prompt's order) into props/manila_<piece>, a person's 3 x 3 sheet into <sheet> (C.MANILA.people). [w, h]: about how
    // many tiles each one is (the prompts' sizes): a picture is kept at 128 px a tile. Every one is fitted into its box.
    art: {
      ground: { cobble: 'ground_manila_cobble', plaza: 'ground_manila_plaza', bay: 'ground_manila_bay', baywalk: 'ground_baywalk' },
      singles: { plaza_fountain: [5, 5], grand_market: [10, 7], trading_post: [5, 4], armory: [7, 5], stables: [8, 6], grandstand: [12, 4],
        station_manila: [9, 6], old_church: [7, 8], harbor_office: [5, 4], lighthouse: [3, 6], hall_of_fame_manila: [8, 6] },
      sheets: {
        manila_walls: [3, 2, ['wall_straight', 'wall_bastion', 'wall_gate', 'wall_tower', 'wall_stair', 'wall_ruin'], 3],
        manila_gates: [3, 1, ['gate_plains', 'gate_jungle', 'gate_gorge'], 4],
        manila_houses: [3, 2, ['house_1', 'house_2', 'house_3', 'house_4', 'house_5', 'house_6'], 4],
        pier_props: [3, 2, ['pier', 'mooring_post', 'cargo', 'boat_banca', 'rope_anchor', 'signpost'], 2],
        race_props: [3, 2, ['race_arch', 'hurdle', 'rail_fence', 'flag_post', 'trough_oats', 'podium'], 2],
        city_props: [3, 2, ['street_lamp', 'palm', 'park_bench', 'notice_board', 'planter', 'food_cart'], 2],
        city_props_2: [3, 2, ['kalesa', 'jeep', 'fruit_stall', 'market_baskets', 'kiosk', 'plaza_stage'], 3],
      },
    },

    // ---------- where things are (tile points) ----------
    spawns: { from_train: [64.5, 9.6, 'down'], from_valley: [88.5, 44.6, 'left'] },
    // where the city people go (their schedules name these); 'door_<building>' is in front of its door
    spots: {
      door_market: [67.5, 43.6], door_trading: [76.5, 42.6], door_armory: [34.5, 24.6], door_stables: [57.5, 63.6], door_harbor: [16.5, 59.6],
      door_station: [61.5, 8.6], door_amparo: [20.5, 28.6], door_church: [26.5, 16.6],
      barrio1: [26.5, 62.6], barrio2: [29.5, 67.6], barrio3: [37.5, 70.6],
      plaza_s: [49.5, 50.6], plaza_fountain: [46.5, 48.6], calle_cart: [28.5, 39.6], church_square: [26.5, 18.6],
      paddock: [57.5, 68.6], grandstand: [73.5, 60.6], pier_end: [5.5, 61.6], baywalk_sunset: [14.5, 46.6],
    },

    // ---------- the city people (proposals 2; the three hunting guides come with their grounds) ----------
    // look: the stand-in, a row of the train visitors' sheet (tw_people) and a tint; sheet: their own picture to come
    // (art-src/manila/<sheet>.png, a 3 x 3 walking sheet like the villagers'). Schedules as the proposals (H = an hour);
    // 'in:x' stands at x's door (step 1: everyone stays out, so there is always someone to talk to).
    // lines: met is the first time; then the others in turn.
    people: {
      order: ['rosa', 'danny', 'lando', 'kardo', 'marisol', 'tibo', 'amparo'],
      rosa: { name: 'Aling Rosa', role: 'Grand Market buyer', look: [2, 0xffe2cc], sheet: 'npc_aling_rosa',
        schedule: [[6 * H, 'in:market'], [12 * H, 'plaza_s'], [13 * H, 'in:market'], [19 * H, 'barrio1']],
        met: "Welcome to Manila, dear! I am Aling Rosa. I buy crops for the whole city here at the Grand Market.",
        lines: ['Soon my board will have big orders: 200 corn, 150 oats... and good Gold for them!',
          'Plant plenty at home and bring it to Manila. The city is always hungry!',
          'Ay, my feet! The market is busy from six in the morning.'] },
      danny: { name: 'Mang Danny', role: 'Trading Post keeper', look: [1, 0xd8e4ff], sheet: 'npc_mang_danny',
        schedule: [[6 * H, 'in:trading'], [18 * H, 'calle_cart'], [20 * H, 'barrio2']],
        met: 'Mang Danny, Trading Post. Rope, cement, wax. If you build with it, I trade it.',
        lines: ['My shelves are still empty. The carts from the farms come soon.',
          'Make your own rope at home and it costs you less. That is my secret, ha!',
          'Calle Real has the best street food in Manila. Try the carts!'] },
      lando: { name: 'Panday Lando', role: 'Armory smith', look: [3, 0xffd0b8], sheet: 'npc_panday_lando',
        schedule: [[6 * H, 'in:armory'], [12 * H, 'church_square'], [13 * H, 'in:armory']],
        met: 'I am Panday Lando, the smith. This old fort is my Armory now.',
        lines: ['I am making something new: a Rifle, a Javelin and a Boomerang. Not ready yet!',
          'A good hunter keeps their tools clean. Come back when my forge is hot.',
          'The Boomerang flies back to you. No arrows needed, but it wears out. Mind that!'] },
      kardo: { name: 'Mang Kardo', role: 'Stable master and race host', look: [0, 0xffe8a8], sheet: 'npc_mang_kardo',
        schedule: [[5 * H, 'in:stables'], [9 * H, 'paddock'], [16 * H, 'grandstand'], [20 * H, 'in:stables']],
        met: 'Mang Kardo! I keep the Stables and the race track. Ding ding! That is my bell.',
        lines: ['One day you will race your horse here. Feed it oats and it runs like the wind!',
          'The track is ready. The hurdles and the cups are coming. Soon, soon!',
          'A happy horse is a fast horse. Brush yours every day.'] },
      marisol: { name: 'Kapitana Marisol', role: 'Harbor master', look: [4, 0xd0e0ff], sheet: 'npc_kapitana_marisol',
        schedule: [[6 * H, 'in:harbor'], [11 * H, 'pier_end'], [17 * H, 'baywalk_sunset'], [19 * H, 'in:harbor']],
        met: 'Kapitana Marisol, harbor master of Manila Bay. Welcome to the port!',
        lines: ['Three berths, all empty. One day boats will tie up here. Maybe yours!',
          'The sunset over the bay is the best in the world. Stay and see it.',
          'The lighthouse has not missed a night in a hundred years.'] },
      tibo: { name: 'Mang Tibo', role: 'Station master', look: [1, 0xc8e8c8], sheet: 'npc_mang_tibo',
        schedule: [[5 * H, 'in:station'], [22 * H, 'barrio3']],
        met: 'Good day! Mang Tibo, station master. My train goes to Willowbrook and back.',
        lines: ['A ticket home is 250 Gold. Or walk the valley road: out the Plains Gate, east.',
          'Forty years at this station, and the trains still run on time. Mostly!',
          'The station door sells the tickets. Just tap it.'] },
      amparo: { name: 'Lola Amparo', role: 'Storyteller of the walled quarter', look: [2, 0xf0d8ff], sheet: 'npc_lola_amparo',
        schedule: [[6 * H, 'church_square'], [8 * H, 'in:amparo'], [15 * H, 'plaza_fountain'], [18 * H, 'in:amparo']],
        met: 'Come, sit with me, apo. I am Lola Amparo. I keep the stories of the old walls.',
        lines: ['These walls are older than anyone remembers. One day I will tell you all their stories.',
          'Long ago, boats filled the bay. They will come back, you will see.',
          'The church bells ring at six, at noon and at six again. Listen!'] },
    },
  };
})(window.Farm = window.Farm || {});
