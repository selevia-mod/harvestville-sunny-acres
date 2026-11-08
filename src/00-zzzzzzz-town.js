// Willowbrook Station (owner, 4 Nov 2026: "a train station in town that brings visitors and big timed orders, and a town
// that grows"). Content only; the rules are 01-logicZ-town.js, the station and the train in town 19zz-town.js, the panels
// and the tour 19zz-town-ui.js. The station stands up the lane by the Post Office, north of Market Street
// (tools/town-station.js puts its ground and places on maps/town.json).
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60;

  C.TW = {
    // the trains, by the phone's clock: in at these times, out again `stay` minutes later
    trains: [7 * H, 11 * H, 15 * H, 19 * H],
    stay: 120,
    back: 12, // visitors walk back to the platform this many minutes before the train leaves

    // Town points and the Town Level they make
    points: { crate: 2, cargo: 10, wish: 3, collector: 5, sale: 1 },
    saleMax: 4, // stall sales a train's visitors count for, per train
    levels: [
      { at: 0, text: 'The station opens: cargo orders of 4 crates, and 2 visitors on every train.' },
      { at: 12, text: 'A bigger market stall: each shelf holds 150, not 100.' },
      { at: 30, text: 'Flags over the plaza. Cargo orders grow to 5 crates, and 3 visitors come on every train.' },
      { at: 55, text: 'The station kiosk opens: Pet Meals and a Power-Up, fresh off the train.' },
      { at: 90, text: 'A new visitor: the Collector, who pays Sunbeams for rare things.' },
      { at: 135, text: 'Bigger cargo: 6 crates, and the full order prize gets 1 more Sunbeam.' },
      { at: 190, text: 'Lanterns along Market Street, and 4 visitors on every train.' },
      { at: 260, text: 'Tourist Town! Crates and visitors pay 20% more.' },
    ],
    levelGift: 250, // gold from the town for each new level, times the level

    // a cargo order: crates by level (index = level - 1), hours to fill them by crate count
    crates: [4, 4, 5, 5, 5, 6, 6, 6],
    hours: { 4: 24, 5: 36, 6: 48 },
    cratePay: 0.4, // each crate pays this share of what is in it, right away
    prizePay: 1.2, // all crates full: this share of the whole order, in gold
    prizeStars: 1,
    // the prize's item, in turn, order after order
    prizes: [{ item: 'pet_meal', n: 2 }, { item: 'power_up', n: 1 }, { item: 'treat', n: 3 }, { item: 'gem', n: 1 }],
    // how many of one thing a crate asks for, by kind of goods
    most: { crops: 20, farm: 10, workshop: 4, ore: 12, fish: 6, hunt: 5, forage: 8 },
    kinds: { crops: 'Crops', farm: 'Farm goods', workshop: 'Workshop goods', ore: 'Ore', fish: 'Fish', hunt: 'Hunted goods', forage: 'Forage' },

    // visitors off the train: each walks in their own sheet (tw_people, in this order; 19zz-town.js), and their words. {n} {item} {gold}
    visitors: [
      { key: 'tw_daytrip', name: 'Day-tripper', line: 'Pasalubong for my family! Do you have {n} {item}? I will pay {gold}G.' },
      { key: 'tw_backpack', name: 'Backpacker', line: 'I heard the farms here are the best. Could I buy {n} {item} for {gold}G?' },
      { key: 'tw_holiday', name: 'Holiday mum', line: 'The children want {n} {item} to take home. {gold}G, is that fair?' },
      { key: 'tw_foodie', name: 'Food blogger', line: 'My readers must taste this town! {n} {item}, please. {gold}G for you.' },
    ],
    collector: { key: 'tw_collector', name: 'The Collector', line: 'I collect the finest thing from every town. Have you {n} {item}? {gold}G and {stars} for it.' },
    thanks: ['Salamat! This will make them so happy.', 'Wonderful! I will be back on the next train.', 'Perfect. Willowbrook is my new favourite town!'],
    // the stops a visitor likes (Tiled points on the town map), besides the market stall
    stops: ['stall_front', 'stall_front', 'market_w', 'market_e', 'plaza_n', 'plaza_e', 'plaza_w', 'park_pond', 'gazebo', 'door_bakery', 'door_florist', 'wagon', 'station_front'],

    // the station kiosk (Town Level 4): [item, gold, a day]
    kiosk: [['pet_meal', 350, 3], ['power_up', 1500, 1]],
    kioskAt: 4,
    collectorAt: 5,
    shelfAt: 2,
    shelfMore: 150, // (Town Level 2: was 30 when a shelf held 20; 8 Nov 2026 a shelf holds 100)
    flagsAt: 3,
    lanternsAt: 7,
    payMoreAt: 8,
    payMore: 1.2,
  };
})(window.Farm = window.Farm || {});
