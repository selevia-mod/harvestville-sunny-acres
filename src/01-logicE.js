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
  L.buyLand = function (s) {
    if (L.landOwned(s) >= LAND.blocks.length) return 'max';
    var price = L.landPrice(s);
    if (s.gold < price) return 'gold';
    s.gold -= price;
    s.land = L.landOwned(s) + 1;
    return 'ok';
  };

  // A yard piece out here goes only on land you own, and not on soil.
  L.landCantPlace = function (s, t, x, y) {
    var box = L.yardBox(t, x, y);
    for (var i = 0; i < box.length; i++) {
      var px = box[i][0], py = box[i][1];
      if (px < LAND.x0) continue;
      if (!L.landOpen(s, px, py) || s.soil[py * C.FARM_W + px]) return true;
    }
    return false;
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
      L.addFieldFence(s); // from before it was yard pieces
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
