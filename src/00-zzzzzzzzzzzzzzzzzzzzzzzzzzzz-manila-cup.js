// The Manila Cup (a weekly horse time trial) and Race Day (bet game Gold on the house races), owner 18 Nov 2026:
// docs/superpowers/specs/2026-11-18-manila-cup-and-betting-design.md. Mang Kardo runs both. Words and numbers only: the
// rules are 01-logicZZZZZZZZZZZZZZZZZZZZZZZZ-manila-cup.js, the world 19zzz...z-manila-cup.js, the server
// supabase/farm_manila_cup.sql (the owner applies it). Gold is the game's own money: it cannot be bought with real money
// and cannot be traded between players. Numbers the spec does not give: "decided by me, owner can change".
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  if (!M || !M.on || !M.flipped) return;
  var H = 60;

  C.MANILA_CUP = {
    on: true,
    laps: 3, // (owner)
    open: 8 * H, close: 19 * H, // Monday 8 AM to Sunday 7 PM, Manila time (owner); results at the close
    knockMs: 1500, // a knocked hurdle (owner)
    tryGold: 2000, // the first try of a Manila day is free (owner)
    sprint: { mult: 1.4, ms: 3000 }, // the sprint bar: 1.4x for 3 s of riding a lap, full again each lap (decided by me)
    jump: { ms: 450, gap: 100 }, // in the air 0.45 s, then a moment before the next: hurdles 7 tiles apart can be taken at a sprint (decided by me)
    off: 0.5, // off the track (the grass inside the oval, or outside it): half speed (decided by me)
    floor: 0.95, // a lap under 95% of a perfect ride is refused, here and on the server (decided by me)
    radius: 1, // the centre line's corners (tiles)
    prizes: [150000, 80000, 50000, 20000, 20000, 20000, 20000, 20000, 20000, 20000], // places 1-10 (owner: 10x the old note)
    every: { runs: 3, gold: 3000, oats: 3 }, // everyone with 3 runs that week (owner)
    title: 'Manila Cup Champion',
    cups: ['mc_cup_gold', 'mc_cup_silver', 'mc_cup_bronze'], ribbon: 'mc_ribbon', // places 1-3, 4-10: house trophies
    tours: ['cup', 'race'], // (a bit each in the save, in this order: append only)
    sendEvery: 60000,
    soon: 'Results open soon. Your best time is kept.',
  };

  // Race Day: a race of 6 horses every 10 minutes, 6 AM to 10 PM (owner); its horses, odds and winner come from its number
  C.RACE_DAY = {
    on: true,
    first: 6 * H, last: 21 * H + 50, every: 10, // the first and last starts (minutes after midnight, Manila)
    closeMs: 30000, // bets close 30 s before the start (owner)
    resultMs: 32000, // the result is out (and paid) 32 s after the start (decided by me)
    run: [24, 27], // the winner's time, seconds (owner: about 20-30 s)
    laps: 2, // round the oval twice (decided by me: they gallop about as fast as your horse)
    min: 100, max: 50000, day: 200000, confirm: 10000, // (decided by me)
    edge: 0.1, odds: [1.6, 9], floor: 0.1, // the house keeps about 10% (owner); no horse under this chance
    photo: 0.15, // a finish closer than 0.15 s: a photo finish (about 1 race in 11)
    chips: [100, 1000, 5000, 10000, 50000],
    // the horses (owner: Manila names), each with its own silk colour and coat
    horses: [
      ['Bagyo', 0x3a6fd8, 0x8a5a32], ['Kidlat', 0xf2c230, 0x5a3a24], ['Sampaguita', 0xf4f4f0, 0xc89a64], ['Lakas', 0xd8402a, 0x3a2a20],
      ['Dalisay', 0x8a4ad0, 0xb07a4a], ['Tala', 0x3ab0a0, 0x9a9890], ['Habagat', 0x2a3a6a, 0x6a4a30], ['Amihan', 0x7ac8f0, 0xd8c8b0],
      ['Bituin', 0xf08a2a, 0x7a4a2a], ['Agila', 0x4a8a3a, 0x4a3426], ['Liwayway', 0xf09ac0, 0xa86a3a], ['Dagat', 0x1a8ab8, 0x2a2420],
    ],
  };

  // ---------- the track: the race props where a horse runs through them ----------
  // The arch and the hurdles are front-on pictures, so they stand across the two straights the horses run up and down
  // (the oval's west and east sides): the start and finish arch on the west side, three hurdles on each side.
  var TB = M.ground.filter(function (g) { return g[0] === 'track'; })[0]; // [x, y, w, h]: the oval, 2 tiles wide
  var x0 = TB[1], x1 = TB[1] + TB[3] - 2; // (the west and east straights' left tiles)
  C.MANILA_CUP.arch = [x0 - 1, TB[2] + 3, 4, 3]; // its posts on either side of the track, the opening the track itself
  var hurdles = [[x0, TB[2] + 8], [x0, TB[2] + 15], [x0, TB[2] + 22], [x1, TB[2] + 5], [x1, TB[2] + 12], [x1, TB[2] + 19]]; // (7 tiles apart)
  var hi = 0;
  M.decor.forEach(function (d) {
    if (d[0] === 'race_arch') { d[1] = C.MANILA_CUP.arch[0]; d[2] = C.MANILA_CUP.arch[1]; d[3] = 4; d[4] = 3; }
    if (d[0] === 'hurdle' && hurdles[hi]) { d[1] = hurdles[hi][0]; d[2] = hurdles[hi][1]; hi++; }
  });
  M.pass.race_arch = [1, 2];

  // ---------- what the city says now ----------
  M.buildings.forEach(function (b) {
    if (b.key === 'grandstand') b.text = 'The grandstand of the race track. Race Day: a race every 10 minutes, 6 AM to 10 PM.';
    if (b.key === 'stables') b.text = "Mang Kardo's Stables. He runs the Manila Cup and Race Day: talk to him!";
    if (b.key === 'hall') b.text = "Manila's Hall of Fame: the city's best hunters, farmers and riders.";
  });
  var kardo = M.people.kardo;
  if (kardo) kardo.lines = kardo.lines.map(function (l) { return /Soon, soon/.test(l) ? 'The Manila Cup runs all week: three laps, six hurdles. Beat the clock!' : l; });
  M.crowd.lines = M.crowd.lines.map(function (l) { return /race at the track/.test(l) ? 'Race Day! The horses run every 10 minutes at the track.' : l; });

  // ---------- the cups and the ribbon: house trophies (appended: a piece's number is saved) ----------
  var HM = C.HOME;
  [
    { key: 'mc_cup_gold', name: 'Gold Horseshoe Cup', beauty: 60, what: 'a big shiny gold trophy cup with a golden horseshoe, on a dark wooden base' },
    { key: 'mc_cup_silver', name: 'Silver Horseshoe Cup', beauty: 40, what: 'the Manila Cup in shining silver' },
    { key: 'mc_cup_bronze', name: 'Bronze Horseshoe Cup', beauty: 30, what: 'the Manila Cup in warm bronze' },
    { key: 'mc_ribbon', name: 'Manila Cup Ribbon', beauty: 15, place: 'wall', foot: 0, what: 'a blue rosette ribbon from the Manila Cup' },
  ].forEach(function (t) {
    HM.types.push({ key: t.key, name: t.name, w: 1, h: 1, foot: t.foot != null ? t.foot : 1, place: t.place || 'floor', price: 0, beauty: t.beauty, trophy: true, mc: true, what: t.what });
    HM.typeIndex[t.key] = HM.types.length - 1;
  });
  // the owner's cups (art-src/manila/race_cups.png) go in the 'manila' pack as props/manila_cup_<gold|silver|bronze>
  M.art.sheets.race_cups = [3, 1, ['cup_gold', 'cup_silver', 'cup_bronze'], 1];
})(window.Farm = window.Farm || {});
