// Players' suggestions (owner, 2 Nov 2026), the rules (on screen: 19z-requests.js). Wood that comes back: a few fallen
// branches and a stump in the meadow each day, and the big trees of Makiling Forest (s.wd, saved as 'wd'). Rod upgrades
// at the forge (s.rod, saved as 'rl'). Digging up a growing crop. How long a Power-Up has left.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  C.WOOD = {
    branches: 4, stumps: 1, cap: 15, // new each day, and the most lying in the meadow at once
    meadow: { x0: 24, x1: 32, y0: 3, y1: 30 },
    trees: 5, // big trees a day
    treeLumber: [2, 2, 3, 3], // by Axe level
    treeSwings: 3, // a tree takes this many tiles' worth of energy
  };
  C.ROD = {
    names: ['Fishing Rod', 'Copper Rod', 'Silver Rod', 'Gold Rod'],
    bar: [1, 1.15, 1.3, 1.45], // the green bar
    drain: [1, 0.85, 0.7, 0.55], // how fast the catch meter falls
    upgrades: [{ gold: 1000, ore: 'ore_copper', n: 5 }, { gold: 2500, ore: 'ore_silver', n: 5 }, { gold: 5000, ore: 'ore_gold', n: 5 }],
  };

  // ---------- wood in the meadow ----------
  var meadowCount = function (s) {
    var m = C.WOOD.meadow, W = C.FARM_W;
    return Object.keys(s.debris).filter(function (idx) {
      var x = idx % W, y = Math.floor(idx / W);
      return x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1 && s.debris[idx] !== 'weed';
    }).length;
  };
  L.dropWood = function (s) {
    var m = C.WOOD.meadow, W = C.FARM_W, taken = {}, room = C.WOOD.cap - meadowCount(s), kinds = [], tiles = [];
    s.yard.items.forEach(function (it) { L.yardBox(it.t, it.x, it.y).forEach(function (p) { taken[p[1] * W + p[0]] = 1; }); });
    for (var y = m.y0; y <= m.y1; y++) for (var x = m.x0; x <= m.x1; x++) {
      var idx = y * W + x;
      if (!taken[idx] && !s.debris[idx] && !s.soil[idx]) tiles.push(idx);
    }
    for (var i = 0; i < C.WOOD.stumps; i++) kinds.push('stump');
    for (var k = 0; k < C.WOOD.branches; k++) kinds.push('branch');
    L.shuffle(tiles, s.seed, s.day, 7);
    kinds.slice(0, Math.max(0, room)).forEach(function (kind, n) { if (tiles[n] != null) s.debris[tiles[n]] = kind; });
  };
  var catchUp = L.catchUp;
  L.catchUp = function (s, now, info) {
    var day = s.day, r = catchUp(s, now, info);
    if (s.day > day) L.dropWood(s);
    return r;
  };
  // A yard piece put down on a branch: the branch is gone.
  var clearUnder = function (s, t, x, y) {
    L.yardBox(t, x, y).forEach(function (p) { delete s.debris[p[1] * C.FARM_W + p[0]]; });
  };
  var placeYard = L.placeYard;
  L.placeYard = function (s, farm, t, x, y) {
    var r = placeYard(s, farm, t, x, y);
    if (typeof r === 'number') clearUnder(s, t, x, y);
    return r;
  };
  var moveYard = L.moveYard;
  L.moveYard = function (s, farm, i, x, y) {
    var r = moveYard(s, farm, i, x, y);
    if (r === 'ok') clearUnder(s, s.yard.items[i].t, x, y);
    return r;
  };

  // ---------- the big trees of Makiling Forest ----------
  var cutToday = function (s) { return s.wd && s.wd.day === s.day ? s.wd.mask : 0; };
  L.treeCut = function (s, i) { return !!((cutToday(s) >> i) & 1); };
  L.treesLeft = function (s) {
    var n = 0, m = cutToday(s);
    while (m) { n += m & 1; m >>= 1; }
    return Math.max(0, C.WOOD.trees - n);
  };
  // Returns the lumber it gave, or 'cut', 'done' (enough for today), 'tired'.
  L.chopTree = function (s, i) {
    if (L.treeCut(s, i)) return 'cut';
    if (!L.treesLeft(s)) return 'done';
    if (!L.spendEnergy(s, L.toolEnergy(s, 'axe', C.WOOD.treeSwings))) return 'tired';
    s.wd = { day: s.day, mask: cutToday(s) | (1 << i) };
    var n = C.WOOD.treeLumber[L.toolLevel(s, 'axe')];
    s.lumber += n;
    return n;
  };

  // ---------- the rod ----------
  L.rodLevel = function (s) { return Math.max(0, Math.min(C.ROD.upgrades.length, Number(s.rod) || 0)); };
  L.hasRod = function (s) { return L.hasItem(s, 'rod') || (s.store || []).some(function (x) { return x && x.id === 'rod'; }); };
  L.rodCost = function (s) { return C.ROD.upgrades[L.rodLevel(s)] || null; };
  L.upgradeRod = function (s) {
    var cost = L.rodCost(s);
    if (!cost) return 'max';
    if (s.gold < cost.gold) return 'gold';
    if (L.countItem(s, cost.ore) < cost.n) return 'ore';
    s.gold -= cost.gold;
    L.removeItem(s, cost.ore, cost.n);
    s.rod = L.rodLevel(s) + 1;
    return 'ok';
  };
  var itemName = L.itemName;
  L.itemName = function (s, id) { return id === 'rod' ? C.ROD.names[L.rodLevel(s)] : itemName(s, id); };

  // ---------- digging up a growing crop ----------
  L.digUp = function (s, idx) {
    var t = s.soil[idx];
    if (!t || !t.c || L.isRipe(t)) return 'none';
    t.c = null;
    t.p = 0;
    t.r = 0;
    delete t.h;
    return 'ok';
  };

  // Free energy refills from Invite Friends (the server hands them over once, 19zd-invite.js): kept here, used one at a time.
  C.FREE_REFILL = 100; // the same as a paid one
  L.refillsLeft = function (s) { return Math.max(0, Math.floor(Number(s.rf)) || 0); };
  L.useFreeRefill = function (s) {
    if (!L.refillsLeft(s) || s.energy >= L.maxEnergy(s)) return 0;
    s.rf = L.refillsLeft(s) - 1;
    return L.refillEnergy(s, C.FREE_REFILL);
  };

  // Minutes a Power-Up has left.
  L.powerUpLeft = function (s) { return L.powered(s) ? s.pwr.day * 1440 + s.pwr.until - (s.day * 1440 + s.time) : 0; };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (L.rodLevel(s)) o.rl = L.rodLevel(s);
    if (L.refillsLeft(s)) o.rf = L.refillsLeft(s);
    if (cutToday(s)) o.wd = [s.wd.day, s.wd.mask];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.rod = Math.max(0, Math.min(C.ROD.upgrades.length, Math.floor(Number(o.rl)) || 0));
    s.rf = Math.max(0, Math.min(9999, Math.floor(Number(o.rf)) || 0));
    s.wd = Array.isArray(o.wd) ? { day: Math.floor(Number(o.wd[0])) || 0, mask: Math.floor(Number(o.wd[1])) & 255 } : null;
    return s;
  };
})(window.Farm = window.Farm || {});
