// More land: the rules (blocks and prices: 00-zzland.js, the map: 19x-land.js). s.land = blocks owned, in order. Saved as
// 'ld'. A friend's snapshot says how wide its tile numbers are: one from before the farm grew is 38.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var LAND = C.LAND;
  var OLD_W = 38;
  C.TIPS.push({ key: 'toolbar', text: 'NEW: swipe your toolbar left or right for two more toolbars. The dots show which one you are on.' });

  L.landOwned = function (s) { return Math.max(0, Math.min(LAND.blocks.length, Number(s.land) || 0)); };
  L.landBlockAt = function (x, y) {
    for (var i = 0; i < LAND.blocks.length; i++) {
      var b = LAND.blocks[i];
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return i;
    }
    return -1;
  };
  L.landOpen = function (s, x, y) {
    var i = L.landBlockAt(x, y);
    return i >= 0 && i < L.landOwned(s);
  };
  L.landPrice = function (s) { return LAND.prices[L.landOwned(s)] || 0; };
  // lands 7 to 9 take Pearls too (from The Lost Tower: s.pearls), with the Gold (owner, 12 Nov 2026)
  L.landPearls = function (s) { return (LAND.pearls && LAND.pearls[L.landOwned(s)]) || 0; };
  // 'ok' | 'max' | 'gold' | 'pearls' (nothing is taken unless both are there)
  L.buyLand = function (s) {
    if (L.landOwned(s) >= LAND.blocks.length) return 'max';
    var price = L.landPrice(s), pearls = L.landPearls(s);
    if (s.gold < price) return 'gold';
    if ((s.pearls || 0) < pearls) return 'pearls';
    s.gold -= price;
    if (pearls) s.pearls -= pearls;
    s.land = L.landOwned(s) + 1;
    return 'ok';
  };

  // A yard piece out here goes only on land you own, and not on soil. A Field Plot or the greenhouse may stand on soil:
  // it is there to be tilled (players, 10 Nov 2026, "nawawala yung mga display ko": a planted greenhouse or plot on bought
  // land failed this every time the farm opened and went back into storage, and its crops were left behind).
  L.landCantPlace = function (s, t, x, y) {
    var box = L.yardBox(t, x, y), plot = L.isPlot && L.isPlot(t);
    for (var i = 0; i < box.length; i++) {
      var px = box[i][0], py = box[i][1];
      if (px < LAND.x0) continue;
      if (!L.landOpen(s, px, py) || (!plot && s.soil[py * C.FARM_W + px])) return true;
    }
    return false;
  };
  // When the farm opens, a piece on bought land with empty soil under it (no crop, no sprinkler: tilled after, or by
  // mistake) keeps its place and the soil goes, instead of the piece going into storage (players, 10 Nov 2026: a whole
  // fence went). With a crop or a sprinkler under it, the crop stays and the piece still goes to storage.
  var yardRepair = L.yardRepair;
  L.yardRepair = function (s, farm) {
    (s.yard.items || []).forEach(function (it) {
      if (L.isPlot && L.isPlot(it.t)) return;
      var box = L.yardBox(it.t, it.x, it.y), under = [];
      for (var i = 0; i < box.length; i++) {
        var px = box[i][0], py = box[i][1], idx = py * C.FARM_W + px, t = s.soil[idx];
        if (px < LAND.x0) continue;
        if (!L.landOpen(s, px, py)) return; // (off your land: not a soil question)
        if (t) { if (t.c || t.sp) return; under.push(idx); }
      }
      under.forEach(function (idx) { delete s.soil[idx]; });
    });
    return yardRepair(s, farm);
  };

  // Is a yard piece standing here? (Nothing is tilled under one.) Not a Field Plot or the greenhouse: they are there to be
  // tilled (owner, 8 Nov 2026: players with the greenhouse on their bought land "cannot farm it").
  L.landTaken = function (s, x, y) {
    return s.yard.items.some(function (it) {
      if (L.isPlot && L.isPlot(it.t)) return false;
      return L.yardBox(it.t, it.x, it.y).some(function (p) { return p[0] === x && p[1] === y; });
    });
  };

  // The field's fence, as yard pieces (each farm once: saved as 'fm').
  L.addFieldFence = function (s) {
    var taken = {};
    s.yard.items.forEach(function (it) {
      if (C.OUTDOOR.types[it.t].kind === 'path') return;
      L.yardBox(it.t, it.x, it.y).forEach(function (p) { taken[p[0] + ',' + p[1]] = 1; });
    });
    C.LAND.fence.forEach(function (p) {
      if (!taken[p[0] + ',' + p[1]]) s.yard.items.push({ t: C.OUTDOOR.index.field_fence, x: p[0], y: p[1] });
    });
  };
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    L.addFieldFence(s);
    return s;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (L.landOwned(s)) o.ld = L.landOwned(s);
    o.fm = 1;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.land = Math.max(0, Math.min(LAND.blocks.length, Math.floor(Number(o.ld)) || 0));
    if (!o.fm) L.addFieldFence(s);
    return s;
  };

  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var snap = snapshot(s);
    snap.fw = C.FARM_W;
    snap.land = L.landOwned(s);
    return snap;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine);
    s.land = Math.max(0, Math.min(LAND.blocks.length, Math.floor(Number(snap && snap.land)) || 0));
    var fw = Math.floor(Number(snap && snap.fw)) || OLD_W;
    if (fw !== C.FARM_W) {
      if (fw <= OLD_W) L.addFieldFence(s); // from before it was yard pieces (a 64-wide farm has its own, maybe moved)
      var move = function (table) {
        var out = {};
        Object.keys(table).forEach(function (idx) { out[Math.floor(idx / fw) * C.FARM_W + idx % fw] = table[idx]; });
        return out;
      };
      s.soil = move(s.soil);
      s.debris = move(s.debris);
    }
    return s;
  };
})(window.Farm = window.Farm || {});
