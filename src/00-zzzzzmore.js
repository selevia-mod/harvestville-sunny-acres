// Three quick wins (owner, 4 Nov 2026: "Lets do this"): the Fishing Derby on Fish Monday, the Daily gift as a calendar
// with a bigger day 7, and a photo mode for sharing the farm. Rules 01-logicM.js; on screen 19zq-derby.js,
// 19zr-calendar.js and 19zs-photo.js; the Derby's server side supabase/farm_online_15.sql.
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- every fish has a weight ----------
  // A fish is 0.8 to 1.2 times its kind's usual weight; 1 in 15 is a giant, 1.4 to 1.6 times.
  C.FISH_KG = { fish_s: 0.3, fish_m: 1.2, fish_l: 3.5, fish_k: 12 };
  C.FISH_ORDER = ['fish_s', 'fish_m', 'fish_l', 'fish_k']; // (the save keeps each one's biggest in this order: appended only)
  C.FISH_SIZE = { usual: [0.8, 1.2], giant: { odds: 1 / 15, size: [1.4, 1.6] } };

  // Fish Monday says so (Today's Event, 00-zzzlater.js).
  C.EVENTS.forEach(function (e) { if (e.key === 'fish') e.text = 'Fish sell for 25% more, and the Fishing Derby is on!'; });

  // ---------- the Daily gift: day 7 is a chest ----------
  C.LOGIN[6] = { stars: 2, gold: 1500, item: 'power_up', n: 1 };
})(window.Farm = window.Farm || {});
