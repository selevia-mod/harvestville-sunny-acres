// The farm's buildings, round 2 (src/00-zzzzzzzzzzzzzzzzzzz-farm2.js): the animals' patch in front of the barn and the
// dog's in front of his doghouse; nothing is built on the animals' patch; old farms get their old fences once (save 'fv2').
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR;
  var area = function (it, k) {
    var type = it && O.types[it.t], a = type && type[k];
    return a ? { x0: it.x + a.dx, y0: it.y + a.dy, x1: it.x + a.dx + a.w - 1, y1: it.y + a.dy + a.h - 1 } : null;
  };
  L.penArea = function (it) { return area(it, 'pen'); };
  L.dogArea = function (it) { return area(it, 'dog'); };
  var tilesOf = function (a) { var out = []; if (a) for (var y = a.y0; y <= a.y1; y++) for (var x = a.x0; x <= a.x1; x++) out.push([x, y]); return out; };
  L.penTiles = function (it) { return tilesOf(L.penArea(it)); };

  // ---------- Decorate: the animals' patch stays free ----------
  var inside = function (a, p) { return a && p[0] >= a.x0 && p[0] <= a.x1 && p[1] >= a.y0 && p[1] <= a.y1; };
  var cantPlace = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) {
    var why = cantPlace(s, farm, t, x, y, skip);
    if (why || !O.types[t]) return why;
    var items = (s.yard && s.yard.items) || [], box = L.yardBox(t, x, y), j;
    for (j = 0; j < items.length; j++) { // nothing on a ranch's patch
      if (j === skip) continue;
      var pa = L.penArea(items[j]);
      if (pa && box.some(function (p) { return inside(pa, p); })) return 'taken';
    }
    var mine = L.penArea({ t: t, x: x, y: y });
    if (!mine) return null;
    var W = farm && farm.w, H = farm && farm.h, tiles = tilesOf(mine); // a ranch: its patch must be open ground, free
    for (var k = 0; k < tiles.length; k++) {
      var p = tiles[k];
      if (farm && (p[0] < 1 || p[1] < 1 || p[0] > W - 2 || p[1] > H - 2)) return 'outside';
      if (farm && farm.noPlace && farm.noPlace[p[1] * W + p[0]] && !(farm.deco && farm.deco[p[1] * W + p[0]])) return 'blocked';
    }
    for (j = 0; j < items.length; j++) {
      if (j === skip) continue;
      if (L.yardBox(items[j].t, items[j].x, items[j].y).some(function (p) { return inside(mine, p); })) return 'taken';
    }
    return null;
  };

  // ---------- old farms: their old fences as real pieces, once ----------
  // the fences the old pictures had: round the pen (sides and front, its gate in the middle) and the dog yard's back and sides
  var fenceSpots = function (it) {
    var type = O.types[it.t], out = [], k;
    if (type.key === 'ranch') {
      for (k = 4; k <= 8; k++) out.push([it.x, it.y + k], [it.x + 8, it.y + k]);
      for (k = 1; k <= 7; k++) if (k !== 4) out.push([it.x + k, it.y + 8]);
    } else if (type.key === 'dog_yard') {
      var ox = it.x - 1, oy = it.y - 1; // (the old yard's corner)
      for (k = 0; k <= 3; k++) out.push([ox + k, oy]);
      for (k = 1; k <= 2; k++) out.push([ox, oy + k], [ox + 3, oy + k]);
    }
    return out;
  };
  L.farmV2 = function (s, shiftDogs) {
    if (!s || !s.yard || s.fv2) return;
    s.fv2 = 1;
    var items = s.yard.items, fence = O.index.ranch_fence, W = C.FARM_W;
    if (shiftDogs) items.forEach(function (it) { if (O.types[it.t] && O.types[it.t].key === 'dog_yard') { it.x += 1; it.y += 1; } });
    var taken = {};
    items.forEach(function (it) { if (O.types[it.t]) L.yardBox(it.t, it.x, it.y).forEach(function (p) { taken[p[1] * W + p[0]] = 1; }); });
    items.slice().forEach(function (it) {
      fenceSpots(it).forEach(function (p) {
        var i = p[1] * W + p[0];
        if (p[0] < 1 || p[1] < 1 || taken[i] || (s.soil && s.soil[i])) return;
        taken[i] = 1;
        items.push({ t: fence, x: p[0], y: p[1] });
      });
    });
  };
  var newState = L.newState;
  L.newState = function () { var s = newState.apply(this, arguments); L.farmV2(s, false); return s; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s) { s.fv2 = o && o.fv2 ? 1 : 0; L.farmV2(s, !!(o && o.ef)); } // (a farm from before Edit Farm got its doghouse where it is now)
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); if (s.fv2) o.fv2 = 1; return o; };
  var snapshot = L.snapshot;
  L.snapshot = function (s) { var o = snapshot(s); if (s.fv2) o.fv2 = 1; return o; };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState.apply(this, arguments);
    if (s) { s.fv2 = snap && snap.fv2 ? 1 : 0; L.farmV2(s, !!(snap && snap.ef)); }
    return s;
  };
})(window.Farm = window.Farm || {});
