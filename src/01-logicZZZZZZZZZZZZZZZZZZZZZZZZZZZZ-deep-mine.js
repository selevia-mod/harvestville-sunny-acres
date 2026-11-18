// The deep Mine, floor 1,201 and down (owner, 18 Nov 2026: "create better monster and harder monster, taking energy from
// users will get disappointment"). Every 100 floors past 1,200 (a "tier", to 15: floor 2,701 and down is the deepest):
// - the rocks get tougher: more swings to break, fewer with a better hammer (rockHits below). The energy is the rock's, as
//   ever (L.mineEnergy, once, on the swing that breaks it): the extra swings cost time, never energy;
// - grumpy cave critters come out (C.MINE.deep.critters): more bonks to bring down, and a charge that reaches you costs a
//   little more energy each tier, as a cave monster's charge always has. Bonking one costs nothing;
// - a little more Starstone and Diamond, out of the rolls that held nothing (capped at tier 15).
// The world side: 19z...-deep-mine.js. Nothing new is saved: it all comes from the floor and the hammer.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var D = C.MINE.deep = {
    from: 1200, every: 100, tiers: 15,
    // extra swings a tier, by hammer level (Basic, Copper, Silver, Gold): on average 1 + tier x this, each rock its own
    // whole number (some one more than others, the same on every phone)
    rockPer: [0.5, 0.35, 0.25, 0.15],
    // more Starstone and Diamond a tier (out of the "nothing" rolls, 13% at the Star Core)
    odds: { starstone: 0.002, diamond: 0.0015 },
    // the critters: from: the first floor they are out; hp: bonks (one more every 2 tiers); hit: the energy a charge takes
    // (4% more a tier); row: the wild sheet's row they borrow, in their own colour (tint)
    critters: {
      mole: { name: 'Grumpy Mole', from: 1201, row: 'rabbit', tint: 0x8c6e5c, w: 0.8, hp: 3, hit: 6, walk: 0.45, run: 2.6, angry: 2.2 },
      bat: { name: 'Huffy Cave Bat', from: 1401, row: 'labuyo', tint: 0x8a6ab8, w: 0.8, hp: 2, hit: 5, walk: 0.6, run: 3.2, angry: 2.6, flies: true },
      piglet: { name: 'Pebble Piglet', from: 1601, row: 'boar', tint: 0xa4a2ae, w: 0.95, hp: 4, hit: 8, walk: 0.4, run: 2.4, angry: 2 },
    },
    critterOrder: ['mole', 'bat', 'piglet'],
  };

  // 0 to floor 1,200; 1 for 1,201-1,300; ... 15 from 2,701.
  L.deepTier = function (floor) { return floor > D.from ? Math.min(D.tiers, Math.ceil((floor - D.from) / D.every)) : 0; };

  // ---------- the rocks ----------
  // Swings a rock needs: 1 to floor 1,200; deeper, 1 + tier x rockPer[hammer], rounded down or up for each rock by its own
  // number (r, 0..1: L.rand of the floor and the tile), so the average grows every 100 floors.
  L.rockHits = function (s, floor, r) {
    var t = L.deepTier(floor);
    if (!t) return 1;
    var x = 1 + t * D.rockPer[Math.max(0, Math.min(3, L.toolLevel(s, 'hammer')))], n = Math.floor(x);
    return n + ((r == null ? 0.5 : r) < x - n ? 1 : 0);
  };
  // (seed: the mine's, so friends in one mine see the same tough rocks)
  L.rockHitsAt = function (s, floor, idx, seed) { return L.rockHits(s, floor, L.rand(seed == null ? s.seed : seed, s.day, floor, idx, 41)); };
  L.rockHitsAvg = function (s, floor) { var t = L.deepTier(floor); return t ? 1 + t * D.rockPer[L.toolLevel(s, 'hammer')] : 1; };
  // One swing on a rock: cracks holds the swings so far (tile -> n). True when this swing breaks it (and it is forgotten).
  L.strikeRock = function (cracks, idx, hits) {
    var n = (cracks[idx] || 0) + 1;
    if (n < hits) { cracks[idx] = n; return false; }
    delete cracks[idx];
    return true;
  };
  // The energy for a swing: the rock's energy for each rock it breaks, nothing for the ones it only cracks.
  L.rockSwingEnergy = function (s, floor, breaking) { return breaking * L.mineEnergy(s, floor); };

  // ---------- the gems ----------
  // A drop's chances past floor 1,200: the Star Core's, with a little more Starstone and Diamond each tier.
  L.deepOdds = function (floor) {
    var t = L.deepTier(floor), p = C.MINE.drops.map(function (d) { return d.p; });
    p[3] += t * D.odds.starstone;
    p[4] += t * D.odds.diamond;
    return p;
  };
  var mineDrop = L.mineDrop;
  L.mineDrop = function (floor, r) {
    if (!L.deepTier(floor)) return mineDrop(floor, r);
    var p = L.deepOdds(floor), ids = C.MINE.bands[L.mineBand(floor)].ids, acc = 0;
    for (var i = 0; i < p.length; i++) {
      acc += p[i];
      if (r < acc) return i ? ids[i - 1] : C.MINE.drops[0].id;
    }
    return null;
  };
  // What a rock is worth on average (the gold of what it drops), for the tests and the simulation.
  L.rockValue = function (floor) {
    var g = 0, n = 4000;
    for (var i = 0; i < n; i++) { var id = L.mineDrop(floor, (i + 0.5) / n); if (id && id !== 'stone') g += C.ITEMS[id].sell; }
    return g / n;
  };

  // ---------- the critters ----------
  L.critterKinds = function (floor) { return D.critterOrder.filter(function (k) { return floor >= D.critters[k].from; }); };
  // How many are out on a floor: none to 1,200, then 1, 2 from tier 5, 3 from tier 10.
  L.critterCount = function (floor) { var t = L.deepTier(floor); return t ? Math.min(3, 1 + Math.floor(t / 5)) : 0; };
  L.critterHp = function (kind, floor) { return D.critters[kind].hp + Math.floor(L.deepTier(floor) / 2); };
  L.critterHit = function (kind, floor) { return Math.round(D.critters[kind].hit * (1 + 0.04 * L.deepTier(floor))); };
  // The energy a charge that reaches you takes: its hit, halved by a dish's power, as every cave monster's (never under 1).
  L.critterLoss = function (s, kind, floor) {
    var hit = L.critterHit(kind, floor);
    return Math.max(1, Math.ceil(hit / (L.power && L.power(s, 'charge') ? 2 : 1)));
  };
  // A bonked-down critter scampers off and leaves the cave's plainest ore (one), if it fits.
  L.critterDrop = function (floor) { return C.MINE.bands[L.mineBand(floor)].ids[0]; };
})(window.Farm = window.Farm || {});
