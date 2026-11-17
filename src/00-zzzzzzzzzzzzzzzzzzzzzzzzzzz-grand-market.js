// Aling Rosa's Grand Market and the horse cart: step 1 of the truck plan (owner, 18 Nov 2026:
// docs/superpowers/specs/2026-11-18-grand-market-horse-cart-design.md). Every number in one place: the ones in the spec are
// "decided by me, the owner can change". Rules: 01-logicZZZZZZZZZZZZZZZZZZZZZZZ-grand-market.js; the world (the price
// board, the cart on the farm and behind the horse, Mang Kardo's trips, the tours):
// 19zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-grand-market.js. The town stall, orders, requests, station crates and
// the online Market are not touched: the Grand Market simply pays better for big loads, by cart only.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;

  C.GRAND_MARKET = {
    on: true,
    // the price board: each farm crop's sell price x a multiplier, new every day, the same for every player (from the day
    // and the crop's key, a fixed hash); 3 hot crops a day pay more
    mult: [1.1, 1.6],
    hot: [1.6, 1.8],
    hotN: 3,
    minLoad: 50, // the Grand Market buys at least this many of one crop at a time, and only from a cart's cargo
    // contracts: 3 a day per player (from the day and the farm's own seed), 100 to 200 of one crop (in tens), at 1.7x the
    // sell price (a Silver or Gold crop counts as plain); filled in one or more deliveries until the end of the next day
    // (48 hours from the start of its day); each finished one is a Market Star
    contract: { n: 3, min: 100, max: 200, step: 10, pay: 1.7, days: 2 },
    // the horse cart, made at Bram's Forge (one a farm; it needs the Stable's horse); it carries 100 crops, any mix
    cart: { cap: 100, gold: 20000, lumber: 60, needs: [['ore_copper', 10], ['farm_cement', 3]] },
    // Mang Kardo drives the cart to Manila for you: back 30 real minutes later with the gold, less his fee
    driver: { fee: 0.1, mins: 30 },
    near: 9, // tiles from the Grand Market's door where a cart can sell (decided by me)
    tours: ['board', 'cart'], // the first-time tours, a bit each in the save (append only)
  };

  // Manila: the Grand Market opens (its "Coming soon" goes away; the Trading Post's stays), and the valley road takes the
  // horse (6 hearts and Horseshoes: the owner's rule, 01-logicZZZZZZZZZZZZZZ-manila.js L.manilaRoad / L.horseRoadOk)
  if (M) {
    M.horseRoad = true;
    M.buildings.forEach(function (b) {
      if (b.key === 'market') b.text = "Aling Rosa's Grand Market. She buys big loads, 50 or more of one crop, brought in a cart. Her price board is out front.";
    });
    var rosa = M.people.rosa;
    if (rosa) {
      rosa.lines = ['My board has big orders: 100 to 200 of one crop, and good Gold for them!',
        'Bring your harvest in a cart, 50 or more of a kind. The city is always hungry!',
        'Ay, my feet! The market is busy from six in the morning.'];
    }
    var kardo = M.people.kardo;
    if (kardo) kardo.lines = kardo.lines.concat(['No time to drive your cart to the city? Send it with me. Thirty minutes, and I only keep ten percent!']);
    M.crowd.lines = M.crowd.lines.map(function (l) { return l === 'The Grand Market opens soon. My basket is ready!' ? 'The Grand Market is open! Aling Rosa pays well for big loads.' : l; });
  }
})(window.Farm = window.Farm || {});
