// Hunting together (owner, 3 Nov 2026: "i like the hunting ideas"): Hunter's gear from Kanor, your farm dog in the Wild
// Lands, and the words for who is out hunting and the biggest catch of the week. Rules 01-logicL.js; on screen
// 19zm-hunt-together.js, 19zn-hunt-dog.js and 19zo-gear.js; the server side supabase/farm_online_14.sql. Loaded after
// every other 00- file: its icons go at the very end of C.ICON_ORDER (drawn by tools/art/gear-icons.js).
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- Hunter's gear: bought once from Kanor, always on in the Wild Lands ----------
  // A bit each in the save ('hg'), in this order: appended only.
  C.GEAR = [
    { key: 'cloak', name: 'Camo Cloak', gold: 3000, desc: 'Animals notice you later: you can get a quarter closer.' },
    { key: 'boots', name: 'Quiet Boots', gold: 2500, desc: 'Sneak at a quicker walk. Shy animals stay put.' },
    { key: 'quiver', name: 'Big Quiver', gold: 4000, desc: 'A missed arrow comes back to you 2 times in 5.' },
  ];
  C.GEAR_RULES = { notice: 0.75, sneak: 0.85, back: 0.4 }; // (sneaking is under 0.6 of full speed without the boots)
  C.GEAR.forEach(function (g) { var id = 'gear_' + g.key; if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.GEAR.forEach(function (g) { g.icon = C.ICON['gear_' + g.key]; });

  // ---------- your dog comes hunting ----------
  C.HUNT_DOG = {
    behind: 1.1, // tiles behind you as you walk
    run: 2.6, // tiles: further than this, it runs to catch up
    sniff: [4.5, 8], // an animal this far away (tiles), out of sight in the grass: it stops and points
    sniffEvery: [9000, 15000], // ms between points
    fetch: [1.6, 9], // a drop this far from you (tiles): it runs, picks it up and brings it back
    settle: 1500, // ms a drop lies before it fetches it
  };
})(window.Farm = window.Farm || {});
