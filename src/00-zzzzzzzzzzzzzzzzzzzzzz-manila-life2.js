// Manila city life, steps 2 and 4 (owner, 11 Nov 2026: docs/manila-city-life.md; 18 Nov 2026: "Make the Manila fully
// build now"). Street life: the Talipapa's three vendors and their shoppers with bayong bags, the fishball cart (the
// College and the Plaza), the taho vendor (mornings, "Tahooo!"), the sorbetes cart and its bell, the College's three
// students (always together) and its gate guard, the barangay court (4 players and watchers, evenings). Then Chinatown
// (the hopia baker; the dimsum and castanas vendors sell now), the calesa (rides inside the old walls), the elevated
// train arriving high with a crowd on its platform, and the night: the balut vendor on the Bay Walk. And the rest of the
// approved table: Father Ramon's sampaguita seller at the church door, joggers in the morning and families in the
// evening on the Plaza, a couple and fishermen at the Bay Walk rail, the carinderia cook, the tanod at the barangay hall,
// the tricycle driver by his parked tricycle, the traffic enforcer at the intersection, and the jeepney and calesa
// drivers when their rides rest.
// Content only. Rules: 01-logicZZZZZZZZZZZZZZZ-manila-life2.js; the world: 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-life2.js.
// WHERE: this file comes after 00-zzzzzzzzzzzzzzzzzzzzz-manila-flip.js, so every place here is in the city as it stands
// now, turned round (the bay on the right, x 78-89; the station and the Talipapa on the left). Tiles [x, y]; points in
// tiles (x.5 is the middle of a tile).
// PICTURES: all the owner's (art-src/manila/city/, the 'manila' pack); a person is out only once their own sheet is in.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  var H = 60;
  if (!M || !M.on || !M.flipped || !M.roles) return;

  // ---------- the scenery that comes to life: no more "Coming soon" where it works ----------
  // The three street-food carts move with their vendors now (drawn by the game beside them); the parked calesa drives.
  var MOVED = { cart_fishball: 1, cart_taho: 1, cart_sorbetes: 1, calesa: 1 };
  M.buildings = M.buildings.filter(function (b) { return !MOVED[b.key]; });
  var TEXT = {
    tp_meat: 'TALIPAPA: THE MEAT STALL\nPork, chicken and longganisa. Mang Berto cuts it fresh every morning.',
    tp_fish: 'TALIPAPA: THE FISH STALL\nBangus and galunggong on ice, from the bay this morning.',
    tp_veg: 'TALIPAPA: THE VEGETABLE STALL\nKangkong, tomatoes and onions, still with the dew on.',
    college_gate: 'THE COLLEGE GATE\nThe students come in by the jeep at half past seven. Manong the guard keeps the gate.',
    college: 'The College. Its three friends are never seen apart.',
    court: 'THE BARANGAY COURT\nPick-up games every evening from four. Come and watch!',
    barangay_hall: 'THE BARANGAY HALL\nThe tanod keeps watch here, day and night.',
    carinderia: 'THE CARINDERIA\nHome cooking by the pot. Aling Nena serves from six to eight.',
    hopia: 'THE HOPIA BAKERY\nWarm hopia, fresh from the oven. The baker sells at the door.',
    tricycle: 'A TRICYCLE\nParked by the barangay. Its driver is having his merienda.',
    chinatown: 'CHINATOWN\nThe red arch, the hopia bakery, the dimsum stall and the castanas cart.',
    dimsum_cart: 'A dimsum stall: siomai and siopao, steaming hot. Buy from the vendor.',
    castanas_cart: 'A castanas cart: roasted chestnuts in a little paper bag. Buy from the vendor.',
  };
  M.buildings.forEach(function (b) { if (TEXT[b.key]) b.text = TEXT[b.key]; });

  // ---------- street food: bought from a vendor and eaten on the spot for energy (decided by me, owner can change:
  // small prices in line with the jeepney's 15G, and about what the Mall's food court gives a Gold) ----------
  M.food = {
    fishball: { name: 'Fishballs', price: 10, energy: 4, icon: 'cookie', what: 'a stick of fishballs and kikiam, with sweet sauce' },
    taho: { name: 'Taho', price: 15, energy: 6, icon: 'milk', what: 'warm taho with arnibal and sago' },
    sorbetes: { name: 'Sorbetes', price: 15, energy: 5, icon: 'milk', what: 'three flavours in a cone' },
    dimsum: { name: 'Siomai', price: 20, energy: 8, icon: 'bread', what: 'four siomai, steaming hot' },
    castanas: { name: 'Castanas', price: 15, energy: 6, icon: 'cookie', what: 'roasted chestnuts in a paper bag' },
    hopia: { name: 'Hopia', price: 15, energy: 6, icon: 'bread', what: 'two hopia, warm from the oven' },
    balut: { name: 'Balut', price: 20, energy: 9, icon: 'egg', what: 'a warm balut with a pinch of salt' },
    meal: { name: 'Rice and Adobo', price: 35, energy: 15, icon: 'hot_soup', what: 'a plate of rice and adobo' },
  };

  // ---------- the calesa: rides inside the old walls (owner, 11 Nov 2026) ----------
  // Its loop round the little square south of the church, clockwise along centre lines on tile edges (like the jeep's:
  // its two lanes are the tiles either side), the same on every phone (the clock alone). It waits at its stand stopMs;
  // a ride is `laps` times round, from the stand back to it. It runs `hours`; then it rests at its stand. Speed in tiles a
  // second. Fare: decided by me (owner can change).
  M.calesa = {
    path: [[60, 21], [66, 21], [66, 27], [60, 27]],
    speed: 1.1, stopMs: 9000, fare: 20, laps: 2,
    stop: { at: [63, 27], wait: [63.5, 28.6] },
    hours: [6 * H, 20 * H],
    lines: ['Sakay na! Round the old walls.', 'Tsk tsk! Easy, easy. Good horse.'],
  };

  // ---------- the elevated train: in from the west high on its rails, stops along the platform, back out again ----------
  // (the clock alone, every `cycle` ms: comes in for `arrive`, waits `stay`, leaves for `leave`). stopX: its west end
  // when it stands at the platform; it has a head at each end (the owner's front car, turned round at the back).
  M.lrt = { cycle: 75000, arrive: 8000, stay: 18000, leave: 8000, stopX: 1, fromX: -20, crowd: 5 };

  // ---------- the people (C.MANILA.roles: one list each; their own sheets, else not out) ----------
  // post: where they stand [x, y, way]; hours: when they are out (else in, not seen); sells: a M.food key; call: what they
  // call out now and then; walk: how they get about (stops: named tiles [x, y, way]; plan: a schedule [minute, stop]
  // ('in:<stop>': gone in there), or 'cycle' (stop to stop in turn) or 'random'; hold: [least, most] ms at a stop);
  // group: how many walk together (always: the first leads, the others close behind and round them when they stop).
  var R = M.roles, T = function (t) { return [['tw_people', t[0], t[1]]]; };
  // the Talipapa (wet market) under its tin roofs: meat, fish and vegetables, from five in the morning
  var TP = [[5 * H, 17 * H]];
  R.meat_vendor = { n: 1, sheets: ['npc_meat_vendor'], looks: T([1, 0xffd8c8]), post: [9.5, 31.6, 'right'], hours: TP, title: 'THE MEAT VENDOR',
    lines: ['Fresh pork, fresh chicken! Longganisa for breakfast?', 'Suki, for you I give the good cut.', 'Up at four every day. The Talipapa never sleeps!'] };
  R.fish_vendor = { n: 1, sheets: ['npc_fish_vendor'], looks: T([3, 0xd8e8ff]), post: [9.5, 34.6, 'right'], hours: TP, title: 'THE FISH VENDOR',
    lines: ['Bangus! Galunggong! Straight from the bay!', 'Smell that? That is the sea, not the fish. Ha!', 'Buy before ten, the best ones go first.'] };
  R.veg_vendor = { n: 1, sheets: ['npc_vegetable_vendor'], looks: T([2, 0xd8ffd0]), post: [9.5, 37.6, 'right'], hours: TP, title: 'THE VEGETABLE VENDOR',
    lines: ['Kangkong, sitaw, kamatis! All from the farms up the valley.', 'Your farm grows these too? Then you know they are good!', 'Pechay for your sinigang, suki?'] };
  // shoppers with bayong bags, browsing the stalls in the morning (they come and go by the Talipapa's waiting shed)
  R.tp_shopper = { n: 3, sheets: ['npc_shopper_2'], looks: T([0, 0xfff0d8]), hours: [[6 * H, 12 * H]], title: 'A SHOPPER',
    walk: { home: [4, 40, 'down'], plan: 'random', hold: [5000, 12000], stops: { a: [10, 31, 'left'], b: [10, 34, 'left'], c: [10, 35, 'left'], d: [11, 32, 'left'], e: [11, 34, 'left'], f: [12, 35, 'left'] } },
    lines: ['My bayong is almost full. Just the fish now!', 'Tawad po? A little discount?', 'Fresh is best. The Talipapa is better than any shop.'] };
  // street food that moves: the fishball cart (the Plaza, and the College at lunch and after class)
  R.fishball = { n: 1, sheets: ['npc_fishball_vendor'], looks: T([3, 0xfff0a0]), title: 'THE FISHBALL VENDOR', sells: 'fishball', cart: 'cart_fishball',
    walk: { speed: 0.9, stops: { college: [43, 82, 'down'], plaza: [40, 50, 'down'] },
      plan: [[0, 'in:plaza'], [7 * H, 'plaza'], [11 * H + 30, 'college'], [14 * H, 'plaza'], [15 * H + 45, 'college'], [19 * H, 'plaza'], [21 * H, 'in:plaza']] },
    lines: ['Fishball, kikiam, squidball! Sweet, spicy or vinegar?', 'Tusok-tusok! Pick your stick.', 'The students are my best customers.'] };
  // the taho vendor: two buckets on a pole, in the morning, calling as he goes
  R.taho = { n: 1, sheets: ['npc_taho_vendor'], looks: T([1, 0xf0e0c0]), hours: [[6 * H, 10 * H]], title: 'THE TAHO VENDOR', sells: 'taho', call: 'Tahooo!',
    walk: { plan: 'cycle', speed: 1.0, hold: [6000, 9000], home: [36, 55, 'down'],
      stops: { a: [36, 55, 'down'], b: [47, 56, 'down'], c: [56, 62, 'down'], d: [62, 67, 'down'], e: [45, 66, 'down'], f: [40, 52, 'down'] } },
    lines: ['Tahooo! Warm taho, with arnibal and sago!', 'Early bird gets the taho. Ha!', 'My lolo sold taho on this same street.'] };
  // the sorbetero and his cart with its bell, about the city in the afternoon
  R.sorbetes = { n: 1, sheets: ['npc_sorbetero'], looks: T([4, 0xfff0f0]), hours: [[10 * H, 18 * H]], title: 'THE SORBETERO', sells: 'sorbetes', cart: 'cart_sorbetes', call: 'Ting-a-ling!',
    walk: { plan: 'cycle', speed: 0.9, hold: [9000, 14000], home: [73, 50, 'down'],
      stops: { a: [73, 50, 'down'], b: [62, 82, 'down'], c: [63, 62, 'down'], d: [42, 53, 'down'] } },
    lines: ['Sorbetes! Ube, keso, tsokolate!', 'Ting-a-ling! Hear the bell? That is me!', 'In a cone or in a bread bun, your choice.'] };
  // the College: its gate guard and its three students (owner: always together), in by the jeep, out for lunch and after class
  R.college_guard = { n: 1, sheets: ['npc_street_guard'], looks: [['tw_people', 1, 0x7a8cc8]], post: [35.5, 84.6, 'down'], hours: [[6 * H, 20 * H]], title: 'THE COLLEGE GUARD',
    lines: ['Good day! Students and teachers only past the gate.', 'IDs out, please. Ah, a visitor? Enjoy the lawn.', 'They grow up so fast. I knew that one when she was a freshman!'] };
  R.students = { n: 3, group: 3, sheets: ['npc_student_1', 'npc_student_2', 'npc_student_3'], looks: T([0, 0xf0f0ff]), title: 'A COLLEGE STUDENT', names: ['BEA', 'MIGS', 'JOY'],
    walk: { speed: 1.4, stops: { shed: [33, 85, 'down'], gate: [39, 84, 'up'], snack: [43, 84, 'up'], lawn: [47, 78, 'down'], plaza: [37, 52, 'down'] },
      plan: [[0, 'in:shed'], [7 * H + 25, 'shed'], [7 * H + 40, 'in:gate'], [12 * H, 'snack'], [12 * H + 40, 'lawn'], [13 * H, 'in:gate'], [16 * H, 'snack'], [16 * H + 40, 'plaza'],
        [18 * H, 'shed'], [18 * H + 30, 'in:shed']] },
    lines: ['Exams next week. Pray for us!', 'We always eat fishballs after class. Tradition!', 'Bea, Migs and Joy: since first year, never apart.', 'The library closes at eight. Let us go to the plaza!'] };
  // the barangay court: four players in the evening (two teams, the owner's two sheets twice each)
  R.ballers = { n: 4, sheets: ['npc_baller_1', 'npc_baller_1', 'npc_baller_2', 'npc_baller_2'], looks: T([0, 0xffd0d0]), hours: [[16 * H, 20 * H]], title: 'A BASKETBALL PLAYER',
    court: [57, 56, 10, 6], game: 'basketball',
    lines: ['Next game is ours! Want to play?', 'Twenty-one, winner stays!', 'Swish! Did you see that?'] };
  // Chinatown's hopia baker at the bakery's door
  R.hopia_baker = { n: 1, sheets: ['npc_hopia_baker'], looks: T([3, 0xffffff]), post: [8.5, 29.6, 'down'], hours: [[6 * H, 19 * H]], title: 'THE HOPIA BAKER', sells: 'hopia',
    lines: ['Hopia mongo, hopia ube! Still warm!', 'My father baked here, and his father too.', 'The secret is the flaky skin. Fold, fold, fold!'] };
  // (the dimsum and castanas vendors were already out: now they sell)
  if (R.dimsum) { R.dimsum.sells = 'dimsum'; R.dimsum.lines = ['Siomai! Siopao! Fresh from the steamer!', 'Four siomai, with calamansi and toyo. Masarap!']; }
  if (R.castanas) { R.castanas.sells = 'castanas'; R.castanas.lines = ['Castanas! Warm roasted chestnuts!', 'Careful, they are hot. Peel and enjoy!']; }
  // the night: the balut vendor on the Bay Walk
  R.balut = { n: 1, sheets: ['npc_balut_vendor'], looks: T([1, 0xd0d0e0]), post: [76.5, 44.6, 'left'], hours: [[18 * H, 24 * H], [0, 2 * H]], title: 'THE BALUT VENDOR', sells: 'balut', call: 'Baluuut!',
    lines: ['Baluuut! Penoy! Warm, warm!', 'A little salt, a little vinegar. Perfect.', 'The bay is beautiful at night. And so is my balut!'] };
  // the rest of the approved table
  R.sampaguita = { n: 1, sheets: ['npc_sampaguita_seller'], looks: T([2, 0xffffff]), post: [65.5, 18.6, 'down'], hours: [[6 * H, 19 * H]], title: 'THE SAMPAGUITA SELLER',
    lines: ['Sampaguita po, for the Virgin. Smell how sweet!', 'Father Ramon blesses my flowers every Sunday.', 'A garland for your lola?'] };
  R.carinderia_cook = { n: 1, sheets: ['npc_carinderia_cook'], looks: T([2, 0xffe8d0]), post: [63.5, 66.6, 'down'], hours: [[6 * H, 20 * H]], title: 'ALING NENA, THE COOK', sells: 'meal',
    lines: ['Kain na! Adobo, sinigang, pinakbet. Point and eat!', 'Unli-rice? Ay, not today, anak.', 'Everything here is cooked this morning.'] };
  R.tanod = { n: 1, sheets: ['npc_tanod'], looks: T([1, 0xc8d8f0]), post: [54.5, 61.6, 'down'], title: 'THE TANOD',
    lines: ['All quiet in the barangay. That is how I like it.', 'Curfew for the kids at ten!', 'Need help? The barangay hall is always open.'] };
  R.tricycle_driver = { n: 1, sheets: ['npc_tricycle_driver'], looks: T([3, 0xe8e8d0]), post: [60.5, 64.6, 'left'], hours: [[6 * H, 21 * H]], title: 'THE TRICYCLE DRIVER',
    lines: ['Merienda first, then back to the road.', 'My tricycle knows every eskinita in the barangay.', 'Bayad muna before we go, ha!'] };
  R.enforcer = { n: 1, sheets: ['npc_traffic_enforcer'], looks: T([0, 0x8aa0d0]), post: [52.5, 43.6, 'down'], hours: [[6 * H, 21 * H]], title: 'THE TRAFFIC ENFORCER', whistle: 'Priiit!',
    lines: ['Priiit! Cross at the crosswalk, please!', 'The jeep goes, you wait. Then you go!', 'Twenty years at this corner. My whistle never rests.'] };
  R.joggers = { n: 2, sheets: ['npc_jogger'], looks: T([0, 0xd8f0ff]), hours: [[5 * H, 8 * H + 30]], title: 'A JOGGER',
    walk: { plan: 'cycle', speed: 2.6, jog: true, hold: [0, 400], stops: { a: [39, 37, 'right'], b: [48, 37, 'down'], c: [48, 48, 'down'], d: [44, 54, 'left'], e: [31, 54, 'up'], f: [30, 43, 'up'] } },
    lines: ['Huff... five laps... huff...', 'Morning! The best air is before seven.', 'Join me tomorrow!'] };
  R.families = { n: 6, group: 3, crowdLooks: 1, child: 2, hours: [[16 * H, 20 * H]], title: 'A FAMILY OUT',
    walk: { plan: 'random', speed: 1.1, hold: [7000, 13000], home: [36, 55, 'down'],
      stops: { a: [45, 49, 'down'], b: [35, 47, 'down'], c: [44, 38, 'down'], d: [41, 53, 'down'], e: [33, 52, 'down'], f: [48, 46, 'left'] } },
    lines: ['Our Sunday walk is every day now!', 'The kids want ice cream again...', 'Family first, then the fountain!'] };
  R.couple = { n: 2, group: 2, sheets: ['npc_couple_him', 'npc_couple_her'], looks: T([2, 0xffd8e8]), hours: [[16 * H, 21 * H]], title: 'A COUPLE AT THE RAIL',
    walk: { plan: 'random', speed: 0.9, hold: [12000, 22000], home: [75, 47, 'right'], sameFace: true,
      stops: { a: [76, 19, 'right'], b: [76, 31, 'right'], c: [76, 44, 'right'], d: [76, 47, 'right'], e: [76, 71, 'right'] } },
    lines: ['Shh... the sunset is the best part.', 'We had our first date right here.', 'Every evening, the same bench, the same sky.'] };
  R.fishermen = { n: 2, sheets: ['npc_fisherman'], looks: T([4, 0xe0d0b0]), posts: [[77.5, 26.6, 'right'], [77.5, 36.6, 'right']], hours: [[5 * H, 10 * H], [15 * H, 19 * H]], title: 'A FISHERMAN', fishing: 1,
    lines: ['Shh, they are biting.', 'Galunggong for dinner, if I am lucky.', 'Forty years at this rail. Still no big one!'] };
  // the drivers, out of their rides when the rides rest (the jeep: at night every other loop; the calesa: after its hours)
  R.jeep_driver = { n: 1, sheets: ['npc_jeepney_driver'], looks: T([3, 0xe0e0c8]), post: [36.5, 12.6, 'down'], when: 'jeepRests', title: 'THE JEEPNEY DRIVER',
    lines: ['One coffee, then one more loop.', 'Para po, they say. Para, I stop!', 'This jeep and I have done a million loops.'] };
  R.calesa_driver = { n: 1, sheets: ['npc_calesa_driver'], looks: T([3, 0xe8d8c0]), post: [61.5, 28.6, 'right'], when: 'calesaRests', title: 'THE CALESA DRIVER',
    lines: ['The horse rests, and so do I. Tomorrow at six!', 'Calesa rides round the old walls, from six in the morning.', 'Good horse. Best horse.'] };

  // ---------- where the city folk stand to watch the court (evenings), and the Talipapa's busy mornings ----------
  var Z = M.crowd.zones;
  Z.court = { w: [0, 0, 4, 0], at: [[57, 62, 'up'], [59, 62, 'up'], [61, 62, 'up'], [63, 62, 'up'], [65, 62, 'up'], [56, 62, 'up']] };
  Z.talipapa = { w: [3, 1, 0, 0], at: [[11, 31, 'left'], [11, 34, 'left'], [12, 34, 'left'], [12, 33], [13, 33]] };

  // ---------- titles the game shows over what they say ----------
  M.lifeTitles = { priest: 'FATHER RAMON' };
})(window.Farm = window.Farm || {});
