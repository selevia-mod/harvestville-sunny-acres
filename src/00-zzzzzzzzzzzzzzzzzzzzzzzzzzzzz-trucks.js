// The trucks and the barangay City Orders: steps 2 and 3 of the truck plan (owner, 18 Nov 2026:
// docs/superpowers/specs/2026-11-18-trucks-and-city-orders-design.md). Every number here; "decided by me" ones are marked.
// Rules: 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-trucks.js; the world: 19zzz...z-trucks.js; the server: supabase/farm_city_orders.sql.
(function (F) {
  'use strict';
  var C = F.Config;
  var G = C.GRAND_MARKET;
  if (!G) return;
  // index 1-3 (0 is the horse cart). stars: Market Stars earned (a threshold, never spent). w/h: the side view in tiles,
  // fw/fh the front and back views (decided by me); the colours keep each truck apart (cab, bed, trim)
  C.TRUCKS = {
    on: true,
    list: [null,
      { key: 'pickup', name: 'Pickup', cap: 300, stars: 10, gold: 150000, lumber: 80, needs: [['ore_silver', 15], ['farm_cement', 6], ['rope', 4]],
        w: 2.7, h: 1.6, fw: 1.6, fh: 1.6, cab: '#d2463a', bed: '#b8382e', trim: '#f4efe6', kind: 0 },
      { key: 'farm_truck', name: 'Farm Truck', cap: 800, stars: 30, gold: 600000, lumber: 120, needs: [['ore_gold', 15], ['farm_cement', 12], ['rope', 8]],
        w: 3.3, h: 2.0, fw: 1.9, fh: 2.0, cab: '#3f8f3a', bed: '#a8743c', trim: '#f2d34a', kind: 1 },
      { key: 'big_truck', name: 'Big Truck', cap: 1500, stars: 60, gold: 1500000, lumber: 200, needs: [['ore_gold', 20], ['farm_cement', 20], ['rope', 12], ['obsidian', 10]],
        w: 4.1, h: 2.4, fw: 2.2, fh: 2.4, cab: '#3567b8', bed: '#e3a52a', trim: '#e8eef6', kind: 2 },
    ],
    bay: [29.5, 46.4], // Manila: the Grand Market's loading bay (backed into the lane by the market, clear of the street lamp; decided by me), its feet
    // the weekly City Order of a barangay: Monday 8 AM to Sunday 7 PM Manila; 4 crops; 600 crops for every 5 members
    // (150 of each kind per 5, by the members when the week's order is made: decided by me); 2x the sell price for each
    // one delivered; +3 Market Stars to each who delivered when it is filled; the first a barangay fills: a plaque
    city: { kinds: 4, per5: 600, pay: 2, stars: 3, open: 8 * 60, close: 19 * 60, most: 30 },
  };
  G.tours.push('trucks', 'city'); // (bits 2 and 3 of the tours seen: append only)
  // the City Order plaque (a house trophy, appended last: a piece's number is its place)
  var H = C.HOME;
  H.wagonN = H.types.length; // (Marco's wagon picks from the pieces it always did)
  H.types.push({ key: 'trophy_city_order', name: 'City Order Plaque', w: 1, h: 1, foot: 0, place: 'wall', price: 0, beauty: 30, trophy: true,
    what: 'a round brass plaque on dark wood: a truck under a city skyline, "City Order"' });
  H.typeIndex.trophy_city_order = H.types.length - 1;
})(window.Farm = window.Farm || {});
