// Manila city life (owner, 11 Nov 2026: docs/manila-city-life.md; "I want it to be like a real city Manila"). Steps 1 and 3:
// a city, not a park (city ground, the jeepney loop road with sidewalks and crosswalks, rows of shophouses), the jeepney
// and its 6 waiting sheds (players ride it: "Para po", 15G), the crowd in the busy places, the plaza floor bigger; the
// Business Towers and their office workers and guard, the Mall (outside: shoppers, a guard, the Ferris wheel; inside: its
// own small map with shops, a food court, roamers, a guard and a sales lady). Chinatown and the Talipapa: their places kept
// for steps 2 and 4.
// Content only (it adds to C.MANILA from 00-zzzzzzzzzzzzzzzzzzz-manila.js). Rules: 01-logicZZZZZZZZZZZZZZZ-manila-life.js.
// The world: 19zzzzzzzzzzzzzzzzzzzzzzzzzz-manila-life.js.
// PICTURES: none of the owner's city-life pictures yet (art-src/MANILA-CITY-LIFE-PROMPTS.md). Each new building, prop and
// the jeepney is drawn by the game until its picture comes in the 'manila' pack (C.MANILA.life.art: the importer's list,
// tools/manila/manila-import.js); its people wear the stand-in sheets below until theirs come (one list per role).
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  var H = 60;

  // ---------- city ground ----------
  M.base = 'concrete'; // (was grass: the city's ground is concrete now; grass stays where it is painted)
  M.spawns.from_mall = [29, 82.1, 'down']; // (out of the Mall's door)
  M.ground.push(
    ['grass', 12, 0, 32, 2], ['grass', 48, 0, 42, 2], // (the tree line along the north edge)
    ['cobble', 3, 69, 9, 14], // the Ferris wheel's pier on the bay, by the Mall
    ['tplaza', 49, 28, 14, 3], // the towers' forecourt
    ['grass', 42, 70, 21, 15], // the College's lawn
    ['grass', 55, 65, 7, 5] // the paddock
  );
  M.scatter = [
    ['palm', 69, 64, 83, 83, 6, 2, 2, 1], ['palm', 42, 70, 62, 84, 4, 2, 2, 1], ['planter', 42, 70, 62, 84, 3, 2, 1, 1],
  ];
  M.looseTrees = [];
  M.bushes = [];
  M.trees = [[18, 0, 42, 0], [48, 0, 55, 0], [66, 0, 88, 0]];

  // ---------- the jeepney (owner: "they can ride the jeep and roam around the city") ----------
  // Its loop, clockwise, along road centre lines (on tile edges: a road of 2 lanes covers the tiles either side); the road,
  // its sidewalks and these crosswalks are painted from it. Where it is at any moment is worked out from the clock alone
  // (L.jeepAt), so every phone sees it in the same place without the server. Speed in tiles a second; a stop lasts stopMs.
  M.jeep = {
    path: [[45, 14], [87, 14], [87, 55], [65, 55], [65, 87], [22, 87], [22, 45], [39, 45], [39, 33], [45, 33]],
    speed: 3.2, stopMs: 6000, fare: 15,
    // the 6 waiting sheds: where it stops (on the road), the shed's box, where you wait and get off (the sidewalk)
    stops: [
      { key: 'station', name: 'Station', at: [51, 14], shed: [50, 10, 3, 2], wait: [51.5, 12.6] },
      { key: 'talipapa', name: 'Talipapa', at: [87, 40], shed: [82, 39, 3, 2], wait: [85.5, 40.6] },
      { key: 'college', name: 'College', at: [51, 87], shed: [50, 83, 3, 2], wait: [51.5, 85.6] },
      { key: 'mall', name: 'Mall', at: [32, 87], shed: [31, 83, 3, 2], wait: [32.5, 85.6] },
      { key: 'baywalk', name: 'Bay Walk', at: [24, 45], shed: [23, 41, 3, 2], wait: [24.5, 43.6] },
      { key: 'plaza', name: 'Plaza', at: [39, 42], shed: [41, 41, 3, 2], wait: [40.5, 42.6] },
    ],
    // crosswalks: [x, y, w, h, 'h' (on a road running east-west) or 'v']: people cross the road only here
    cross: [[48, 13, 2, 2, 'h'], [65, 13, 2, 2, 'h'], [80, 13, 2, 2, 'h'], [44, 20, 2, 2, 'v'], [44, 29, 2, 2, 'v'], [41, 32, 2, 2, 'h'],
      [38, 37, 2, 2, 'v'], [27, 44, 3, 2, 'h'], [34, 44, 2, 2, 'h'], [21, 50, 2, 2, 'v'], [21, 60, 2, 2, 'v'], [21, 70, 2, 2, 'v'],
      [21, 80, 2, 2, 'v'], [29, 86, 3, 2, 'h'], [40, 86, 2, 2, 'h'], [55, 86, 2, 2, 'h'], [64, 60, 2, 2, 'v'], [64, 72, 2, 2, 'v'],
      [70, 54, 2, 2, 'h'], [82, 54, 2, 2, 'h'], [86, 44, 2, 2, 'v'], [86, 30, 2, 2, 'v']],
    night: [21 * H, 5 * H], // (at night it runs every other loop, its lights on from 6 PM)
    lights: [18 * H, 6 * H],
    lines: ['Para po! The jeep stops here.', 'Beep beep!'],
  };

  // ---------- new buildings (drawn stand-ins until their pictures: stand '@<name>') ----------
  M.buildings.push(
    { key: 'tower1', name: 'Business Tower', box: [50, 17, 5, 11], stand: '@tower', v: 0, foot: 3, art: 'office_tower_1', text: 'A business tower: offices up to the clouds. Its doors are for the people who work there.' },
    { key: 'tower2', name: 'Business Tower', box: [57, 17, 5, 11], stand: '@tower', v: 1, foot: 3, art: 'office_tower_2', text: 'A business tower: offices up to the clouds. Its doors are for the people who work there.' },
    { key: 'mall', name: 'The Mall', box: [23, 73, 12, 8], stand: '@mall', foot: 3, art: 'mall', mall: 1, text: 'The Mall by the bay.' },
    { key: 'ferris', name: 'Ferris Wheel', box: [4, 70, 7, 10], stand: '@ferris_base', foot: 2, art: 'ferris_stand', ferris: 1, text: 'The Ferris wheel by the bay. Rides: coming soon!' },
    { key: 'college', name: 'College', box: [44, 72, 14, 9], stand: '@college', foot: 3, art: 'college_building', text: 'The College. Its students and its gate: coming soon!' },
    { key: 'chinatown', name: 'Chinatown', box: [70, 20, 8, 4], stand: '@sign_board', v: 0, foot: 1, art: 'chinatown_arch', text: 'CHINATOWN\nThe red arch, the hopia bakery and the dimsum stall are coming here soon!' },
    { key: 'talipapa', name: 'Talipapa', box: [81, 33, 4, 3], stand: '@sign_board', v: 1, foot: 1, art: '', text: 'TALIPAPA\nThe wet market: meat, fish and vegetables. Coming soon!' },
    // (owner's additions, 11 Nov 2026) Chinatown's two carts ahead of its arch, and the pickleball court by the Stables
    { key: 'dimsum_cart', name: '', box: [71, 24, 2, 2], stand: '@cart', v: 0, foot: 1, art: 'dimsum_stall', text: 'A dimsum stall: siomai and siopao, steaming hot. Coming soon!' },
    { key: 'castanas_cart', name: '', box: [77, 24, 2, 2], stand: '@cart', v: 1, foot: 1, art: 'chestnut_cart', text: 'A castanas cart: roasted chestnuts in a little paper bag. Coming soon!' },
    { key: 'pickleball', name: 'Pickleball Court', box: [45, 59, 8, 5], stand: '@pickleball_court', foot: 0, flat: 1, art: 'pickleball_court' }
  );
  M.jeep.stops.forEach(function (st, i) {
    M.buildings.push({ key: 'shed_' + st.key, name: '', box: st.shed, stand: '@shed', foot: 1, art: 'shed_' + st.key, shed: i, text: 'A waiting shed. The jeepney stops here.' });
  });
  // rows of plain 2-storey shophouses (store below, home above): they don't open; four looks
  [[48, 3], [52, 3], [26, 49], [30, 49], [43, 64], [47, 65], [16, 68], [16, 73], [16, 78], [69, 16], [75, 16]]
    .forEach(function (p, i) {
      M.buildings.push({ key: 'shop_' + i, name: '', box: [p[0], p[1], 4, 4], stand: '@shophouse', v: i % 4, foot: 2, art: 'shophouse_' + (i % 6 + 1) });
    });

  // ---------- the crowd, in the busy places ----------
  // About 55 by day in all (owner's people + the named 7 + passers-by); the passers-by stay where players go.
  var Z = M.crowd;
  Z.day = 44;
  Z.night = 8;
  Z.cheap = 5;
  Z.cheapNight = 4;
  Z.zones = {
    plaza: { w: [3, 4, 7, 2], at: [[44, 41], [48, 41], [51, 42], [55, 46], [43, 47], [47, 50], [52, 50], [55, 43], [44, 51], [45, 41, 'sit'], [50, 50, 'sit'], [45, 50, 'sit'], [41, 38]] },
    market: { w: [7, 4, 2, 0], at: [[61, 49, 'browse'], [64, 49, 'browse'], [67, 49, 'browse'], [70, 49, 'browse'], [75, 49, 'browse'], [78, 49, 'browse'], [66, 46], [70, 44], [76, 45], [64, 45], [79, 45, 'browse']] },
    platform: { w: [4, 2, 3, 1], at: [[58, 9, 'wait'], [66, 9, 'wait'], [70, 8, 'wait'], [74, 9, 'wait'], [78, 8, 'wait'], [82, 9, 'wait'], [86, 8, 'wait'], [68, 8, 'sit'], [76, 8, 'sit']] },
    port: { w: [2, 2, 3, 1], at: [[3, 61, 'left'], [5, 62, 'down'], [8, 61, 'down'], [11, 62, 'down'], [3, 56], [7, 56, 'down'], [15, 60], [18, 61], [13, 53]] },
    sheds: { w: [4, 3, 4, 2], at: [[51, 12, 'down'], [53, 12, 'down'], [85, 41, 'right'], [85, 38, 'right'], [51, 85, 'down'], [53, 85, 'down'], [33, 85, 'down'], [30, 85, 'down'], [25, 43, 'down'], [26, 43, 'down'], [40, 43, 'left'], [40, 40, 'left']] },
    mallfront: { w: [2, 4, 4, 0], at: [[25, 82], [28, 82], [33, 82], [26, 84], [35, 82], [24, 83]] },
    calle: { w: [2, 3, 3, 1], at: [[28, 33], [29, 37], [27, 40], [30, 42], [26, 36, 'left'], [30, 34, 'right']] },
    baywalk: { w: [1, 1, 3, 1], at: [[13, 10, 'left'], [14, 17], [13, 21, 'left'], [14, 28], [13, 37, 'left'], [12, 12, 'sit'], [12, 24, 'sit'], [12, 74, 'sit'], [13, 70, 'left']] },
    church: { w: [2, 1, 1, 0], at: [[25, 18, 'up'], [27, 17, 'up'], [26, 21], [30, 20]] },
    towers: { w: [2, 2, 1, 0], at: [[52, 29], [56, 30], [60, 29], [50, 30], [62, 30]] },
  };

  // ---------- roles (one list each: its looks are stand-in sheets until the owner's people come; a sheet not on this phone
  // is skipped). post: where they stand; schedule: [minute of the day, where] ('in:' a door: inside, not seen) ----------
  var GUARD = [['tw_people', 1, 0x7a8cc8], ['tw_people', 3, 0x7a8cc8]];
  M.roles = {
    office: { n: 3, sheets: ['npc_office_worker_1', 'npc_office_worker_2', 'npc_office_worker_3'], looks: [['tw_people', 3, 0xd0d4dc], ['tw_people', 2, 0xd0d4dc], ['tw_people', 0, 0xd0d4dc]],
      // in by morning (off the jeep at the Station), out at lunch (the plaza), home at 6 PM
      schedule: [[0, 'in:home'], [7 * H + 20, 'station_shed'], [8 * H, 'in:tower'], [12 * H, 'plaza'], [13 * H, 'in:tower'], [18 * H, 'station_shed'], [18 * H + 40, 'in:home']],
      lines: ['Lunch break at last! Time for the plaza.', 'Reports, reports, reports. And then the jeep home.', 'The view from the 30th floor is amazing.'] },
    tower_guard: { n: 1, sheets: ['npc_street_guard'], looks: GUARD, post: [55.5, 29.6, 'down'], lines: ['Good day! Only people with an office ID inside, sorry.', 'Stay safe out there.'] },
    mall_guard: { n: 1, sheets: ['npc_mall_guard'], looks: GUARD, post: [26.5, 81.6, 'down'], lines: ['Welcome to the Mall! Bags open, please. Thank you!', 'The Mall opens at ten. Enjoy!'] },
    // (owner's additions, 11 Nov 2026) hours: when they are out (else in, at their post)
    priest: { n: 1, sheets: ['npc_priest'], looks: [['tw_people', 4, 0x9a9aa8]], post: [27.5, 17.6, 'down'], hours: [[6 * H, 11 * H], [16 * H, 20 * H]],
      lines: ['Good morning, my child. God bless your day.', 'The bells ring at six. Come and listen.', 'Be kind to one another. That is the whole of it.'] },
    dimsum: { n: 1, sheets: ['npc_dimsum_vendor'], looks: [['tw_people', 3, 0xffe8c8]], post: [72.5, 26.6, 'down'], hours: [[9 * H, 21 * H]],
      lines: ['Siomai! Siopao! Fresh from the steamer!', 'Chinatown is coming soon. My dimsum is ready already!'] },
    castanas: { n: 1, sheets: ['npc_castanas_vendor'], looks: [['tw_people', 1, 0xf0d0b0]], post: [78.5, 26.6, 'down'], hours: [[9 * H, 21 * H]],
      lines: ['Castanas! Warm roasted chestnuts!', 'Careful, they are hot. Peel and enjoy!'] },
    pickleball: { n: 4, sheets: ['npc_pickleball_1', 'npc_pickleball_2'], looks: [['tw_people', 0, 0xd8f0ff], ['tw_people', 2, 0xffe0c8], ['tw_people', 0, 0xffd8e0], ['tw_people', 2, 0xd8ffd8]],
      hours: [[7 * H, 19 * H]], court: [45, 59, 8, 5],
      lines: ['Nice shot! Want to play next round?', 'Pickleball is the city\'s new favourite game!', 'Watch the kitchen line!'] },
    shopper: { n: 6, cheap: 3, sheets: ['npc_shopper_1', 'npc_shopper_2'], looks: [['tw_people', 0], ['tw_people', 2], ['tw_people', 4], ['npc_diday', 0], ['tw_people', 1, 0xffe0f0], ['tw_people', 3, 0xe8f0ff]],
      open: [10 * H, 21 * H], // (going in and out with bags while the Mall is open)
      lines: ['So many sales today! My bags are full.', 'I came for one shirt. I have four now!', 'The food court has the best halo-halo.'] },
  };

  // ---------- the Mall inside: its own small map, like the house (enter by the door, leave the same way) ----------
  // Its floor and walls are the Mall's own sheet (the owner's swatches, mall_floors and mall_walls, painted in at run time;
  // drawn until then). zones: [x, y, w, h, floor] painted over the main hall's floor; the back wall's sections by x.
  M.mall = {
    W: 28, H: 18,
    floors: [['entrance', 12, 15, 4, 2], ['food', 1, 6, 12, 7], ['walk', 1, 11, 26, 2], ['boutique', 1, 2, 4, 3], ['toys', 5, 2, 4, 3], ['arcade', 17, 2, 4, 3], ['cinema', 21, 2, 4, 3], ['garden', 19, 7, 6, 4]],
    walls: [['boutique', 1, 4], ['toys', 5, 4], ['main', 9, 4], ['bay', 13, 4], ['arcade', 17, 4], ['cinema', 21, 4], ['garden', 25, 2]],
    // the shop fronts along the back wall (mall_shopfronts' cells), and the food court's three stalls
    shops: [
      { key: 'boutique', name: 'Boutique', box: [1, 2, 4, 3], art: 'mall_boutique', text: 'BOUTIQUE\nCity outfits for your farmer. Coming soon!' },
      { key: 'toys', name: 'Toys & Pets', box: [5, 2, 4, 3], art: 'mall_toy_pet_shop', text: 'TOYS AND PETS\nToys, and friends for your pets. Coming soon!' },
      { key: 'shut', name: 'Coming Soon', box: [9, 2, 4, 3], art: 'mall_shop_shuttered', text: 'A NEW SHOP\nOpening here soon!' },
      { key: 'doors', name: '', box: [13, 2, 4, 3], art: 'mall_main_doors', text: 'THE BAY DOORS\nThe terrace by the bay opens soon.' },
      { key: 'arcade', name: 'Arcade', box: [17, 2, 4, 3], art: 'mall_arcade', text: 'ARCADE\nMini-games are coming soon!' },
      { key: 'cinema', name: 'Cinema', box: [21, 2, 4, 3], art: 'mall_cinema', text: 'CINEMA\nFilms for the festivals: coming soon!' },
      { key: 'food1', name: 'Rice & Noodles', box: [1, 6, 4, 3], art: 'mall_food_rice', food: 1 },
      { key: 'food2', name: 'Barbecue', box: [5, 6, 4, 3], art: 'mall_food_bbq', food: 1 },
      { key: 'food3', name: 'Halo-halo', box: [9, 6, 4, 3], art: 'mall_food_halo', food: 1 },
    ],
    // eat at the food court: [item, Gold] (its energy is the item's own: L.energyOf)
    food: [['bread', 60], ['cookie', 40], ['hot_soup', 250]],
    // [piece (mall_furniture's), x, y, w, h, foot]
    props: [['escalator', 15, 7, 3, 3, 2], ['fountain', 21, 7, 3, 3, 2], ['table', 2, 10, 2, 1, 1], ['table', 6, 10, 2, 1, 1], ['table', 10, 10, 2, 1, 1],
      ['bench', 8, 14, 2, 1, 1], ['bench', 18, 14, 2, 1, 1], ['palm', 1, 13, 1, 2, 1], ['palm', 26, 13, 1, 2, 1], ['planter', 19, 12, 3, 1, 1],
      ['map_kiosk', 17, 15, 1, 2, 1], ['claw', 18, 5, 1, 2, 1], ['cabinet', 20, 5, 1, 2, 1], ['counter', 3, 5, 2, 1, 1], ['palm', 26, 7, 1, 2, 1]],
    door: [13, 17, 2, 1], entrance: [14, 16.6], out: [29, 81.6], // (out: where you come out, in front of the Mall's door)
    zones: {
      walk: { w: [3, 3, 3, 0], at: [[4, 14], [8, 15], [14, 13], [20, 15], [24, 12], [14, 10], [24, 6], [19, 11], [12, 14], [26, 11]] },
      shops: { w: [3, 3, 3, 0], at: [[6, 5, 'up'], [7, 5, 'up'], [11, 5, 'up'], [19, 7, 'up'], [23, 5, 'up'], [3, 9, 'up'], [7, 9, 'up'], [11, 9, 'up']] },
      sit: { w: [1, 1, 1, 0], at: [[8, 15, 'sit'], [18, 15, 'sit']] },
    },
    crowd: { day: 12, night: 0, cheap: 6, cheapNight: 0 },
    roles: {
      guard: { n: 1, sheets: ['npc_mall_guard'], looks: GUARD, post: [11.5, 15.6, 'down'], lines: ['Welcome! The exit is behind me.', 'No running on the escalator, please.'] },
      sales: { n: 1, sheets: ['npc_sales_lady'], looks: [['tw_people', 2, 0xffd8e8]], post: [2.5, 5.6, 'down'], lines: ['Hello! New city outfits are coming soon. You will look great!', 'May I help you? Our boutique opens very soon.', 'Try the food court: the soup is warm and good.'] },
    },
    lines: ['This Mall is so cool. The aircon!', 'Shall we watch a film later?', 'I love the food court.', 'Window shopping is free, ha!', 'The arcade opens soon, they say.'],
  };

  // ---------- the owner's pictures for all this: EXACTLY art-src/MANILA-CITY-LIFE-PROMPTS.md's files (art-src/manila/city/) ----------
  // What each file becomes (tools/manila/manila-import.js; tools/manila/manila-art.js lists them for the pack):
  //   tex: a ground texture, manila_tex_<as> (painted into the ground sheet); swatch: a grid of textures, manila_tex_<prefix><name>
  //   single: props/manila_<as> at [w, h] tiles; sheet: [cols, rows, pieces] (cells in the prompt's "Row by row" order; '' = a
  //   cell the game does not use yet) into props/manila_<piece>; vehicle: a 3 x 3 driving sheet (rows: down, up, left;
  //   columns: stopped, driving 1, driving 2) into manila_<as>; person: a 3 x 3 walking sheet into <file>.
  // later: files kept for a later step of docs/manila-city-life.md (the importer knows them and leaves them).
  M.life = {
    folder: 'city',
    files: {
      ground_asphalt: { tex: 'asphalt' }, ground_asphalt_line: { tex: 'asphalt_line' }, ground_sidewalk: { tex: 'sidewalk' },
      ground_crosswalk: { tex: 'crosswalk' }, ground_concrete: { tex: 'concrete' },
      jeepney: { vehicle: 'jeepney', size: [4, 3] },
      waiting_sheds: { sheet: [3, 2, ['shed_station', 'shed_plaza', 'shed_talipapa', 'shed_college', 'shed_mall', 'shed_baywalk']], w: 3 },
      shophouses: { sheet: [3, 2, ['shophouse_1', 'shophouse_2', 'shophouse_3', 'shophouse_4', 'shophouse_5', 'shophouse_6']], w: 4 },
      college_building: { single: 'college_building', size: [10, 7] },
      office_tower_1: { single: 'office_tower_1', size: [6, 11] }, office_tower_2: { single: 'office_tower_2', size: [6, 10] },
      mall: { single: 'mall', size: [16, 9] },
      ferris_whole: { single: 'ferris_whole', size: [7, 10] }, ferris_stand: { single: 'ferris_stand', size: [7, 10] },
      ferris_wheel: { single: 'ferris_wheel', size: [7, 7], square: true },
      ferris_cars: { sheet: [4, 2, ['ferris_car_1', 'ferris_car_2', 'ferris_car_3', 'ferris_car_4', 'ferris_car_5', 'ferris_car_6', 'ferris_car_7', 'ferris_car_8']], w: 1 },
      mall_floors: { swatch: [5, 2, ['main', 'walk', 'food', 'boutique', 'toys', 'arcade', 'cinema', 'garden', 'entrance']], prefix: 'mallfloor_' },
      mall_walls: { swatch: [5, 2, ['main', 'bay', 'food', 'boutique', 'toys', 'arcade', 'cinema', 'garden', 'plain']], prefix: 'mallwall_' },
      mall_shopfronts: { sheet: [3, 3, ['mall_food_rice', 'mall_food_bbq', 'mall_food_halo', 'mall_boutique', 'mall_toy_pet_shop', 'mall_arcade', 'mall_cinema', 'mall_main_doors', 'mall_shop_shuttered']], w: 4 },
      mall_furniture: { sheet: [5, 2, ['mall_escalator', 'mall_fountain', 'mall_table', 'mall_bench', 'mall_palm', 'mall_planter', 'mall_map_kiosk', 'mall_claw', 'mall_cabinet', 'mall_counter']], w: 2 },
      chinatown_arch: { single: 'chinatown_arch', size: [8, 5] },
      chinatown_props: { sheet: [3, 2, ['dimsum_stall', '', '', '', 'chestnut_cart', '']], w: 2 }, // (cells 2-4 and 6: Chinatown, step 4)
      pickleball_court: { single: 'pickleball_court', size: [8, 5] },
      npc_office_worker_1: { person: 1 }, npc_office_worker_2: { person: 1 }, npc_office_worker_3: { person: 1 },
      npc_shopper_1: { person: 1 }, npc_shopper_2: { person: 1 }, npc_mall_guard: { person: 1 }, npc_sales_lady: { person: 1 }, npc_street_guard: { person: 1 },
      npc_priest: { person: 1 }, npc_dimsum_vendor: { person: 1 }, npc_castanas_vendor: { person: 1 }, npc_pickleball_1: { person: 1 }, npc_pickleball_2: { person: 1 },
    },
    later: ['talipapa_stalls', 'street_food_carts', 'college_gate', 'basketball_court', 'sari_sari', 'carinderia', 'barangay_hall', 'tricycle', 'calesa',
      'hopia_bakery', 'rail_deck', 'rail_pieces', 'city_train_head', 'city_train_car',
      'npc_student_1', 'npc_student_2', 'npc_student_3', 'npc_fishball_vendor', 'npc_taho_vendor', 'npc_jeepney_driver', 'npc_meat_vendor', 'npc_fish_vendor',
      'npc_vegetable_vendor', 'npc_sorbetero', 'npc_sampaguita_seller', 'npc_calesa_driver', 'npc_tricycle_driver', 'npc_tanod', 'npc_baller_1', 'npc_baller_2',
      'npc_jogger', 'npc_fisherman', 'npc_balut_vendor', 'npc_traffic_enforcer', 'npc_hopia_baker', 'npc_carinderia_cook', 'npc_couple_her', 'npc_couple_him'],
  };
  M.life.people = Object.keys(M.life.files).filter(function (k) { return M.life.files[k].person; });
})(window.Farm = window.Farm || {});
