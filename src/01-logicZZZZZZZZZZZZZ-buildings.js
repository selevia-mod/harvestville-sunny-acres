// Edit Farm part 1 (docs/edit-farm.md): the buildings' masks (src/00-zzzzzzzzzzzzzzzzzz-buildings.js), the farm's
// placement facts from its pieces, and every farm's buildings once (save flag 'ef').
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR;
  var SOLID = { '#': 1, D: 1, W: 1, S: 1, M: 1, I: 1 };

  // the mask letter at tile (tx, ty) of a piece at (x, y), or null (no mask, or outside it)
  L.maskAt = function (t, x, y, tx, ty) {
    var type = O.types[t], row = type && type.mask && type.mask[ty - y];
    return row && tx >= x && tx < x + type.w ? row.charAt(tx - x) : null;
  };
  var withMask = function (t, x, y, test) {
    return L.yardBox(t, x, y).filter(function (p) { return test(L.maskAt(t, x, y, p[0], p[1])); });
  };
  var yardSolid = L.yardSolid;
  L.yardSolid = function (t, x, y) {
    var type = O.types[t];
    if (!type || !type.mask) return yardSolid(t, x, y);
    return withMask(t, x, y, function (c) { return !!SOLID[c]; });
  };
  L.yardWater = function (t, x, y) { return O.types[t] && O.types[t].mask ? withMask(t, x, y, function (c) { return c === 'W'; }) : []; };
  // the tiles of a piece with a given letter
  L.maskTiles = function (t, x, y, letter) { return O.types[t] && O.types[t].mask ? withMask(t, x, y, function (c) { return c === letter; }) : []; };
  L.isBuilding = function (t) { return !!(O.types[t] && O.types[t].building); };

  // ---------- the farm's placement facts with its buildings where they stand ----------
  // base: L.farmInfo(map) of the farm's frame (F.farm()). The house door is where the farmer comes out and where every
  // other opening is reached from (start); the house door, the ranch's gate, Lily's counter and the stable's spot must
  // stay reachable (needs), as the map's doors were.
  var cache = { base: null, key: null, info: null };
  L.farmFor = function (s, base) {
    if (!base || base.derived) return base;
    var W = base.w, items = (s && s.yard && s.yard.items) || [], key = '';
    items.forEach(function (it) { if (L.isBuilding(it.t)) key += it.t + ':' + it.x + ',' + it.y + ';'; });
    if (cache.base === base && cache.key === key) return cache.info;
    var info = Object.assign({}, base, { needs: base.needs.slice(), start: base.start, derived: true, base: base });
    var below = function (p) { return (p[1] + 1) * W + p[0]; };
    items.forEach(function (it) {
      var b = O.types[it.t] && O.types[it.t].building;
      if (b === 'house') {
        var door = L.maskTiles(it.t, it.x, it.y, 'D')[0];
        if (door) { info.start = below(door); info.needs.push([below(door)]); }
        var mail = L.maskTiles(it.t, it.x, it.y, 'M')[0];
        if (mail) info.needs.push([below(mail), mail[1] * W + mail[0] - 1]);
      } else if (b === 'ranch') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'G').map(below)); // (the tile in front of the gate)
      } else if (b === 'shop') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'S').map(below));
      } else if (b === 'stable') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'H').map(function (p) { return p[1] * W + p[0]; }));
      }
    });
    cache = { base: base, key: key, info: info };
    return info;
  };
  // every placement goes through it (a farm already through it passes as it is)
  var cantPlace = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) { return cantPlace(s, L.farmFor(s, farm), t, x, y, skip); };
  // a building takes its whole ground (nothing in the pen, the dog's yard, a pond or the house), on both layers
  var cantPlace2 = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) {
    var why = cantPlace2(s, farm, t, x, y, skip);
    if (why || !O.types[t]) return why;
    var type = O.types[t], items = s.yard.items;
    for (var j = 0; j < items.length; j++) {
      var it = items[j], o = O.types[it.t];
      if (j === skip || !o || (!type.building && !o.building)) continue;
      if (x < it.x + o.w && it.x < x + type.w && y < it.y + o.h && it.y < y + type.h) return 'taken';
    }
    return null;
  };
  // the repair checks each piece against the ones kept so far: its facts come from the whole farm, not those
  var yardRepair = L.yardRepair;
  L.yardRepair = function (s, farm) { return yardRepair(s, L.farmFor(s, farm)); };


  // A building may stand on the margin tiles beside the back fields (the old ponds reached column 38), not on a field
  // block you don't own: only the tiles inside a block follow the land rule for it.
  var landCantPlace = L.landCantPlace;
  L.landCantPlace = function (s, t, x, y) {
    if (!L.isBuilding(t)) return landCantPlace.apply(this, arguments);
    return L.yardBox(t, x, y).some(function (p) { return L.landBlockAt(p[0], p[1]) >= 0 && (!L.landOpen(s, p[0], p[1]) || s.soil[p[1] * C.FARM_W + p[0]]); });
  };

  // ---------- every farm gets its buildings once (save flag 'ef') ----------
  // Where the map had them: the farm looks the same until its farmer moves something. The stable once it is built: at
  // its old spot, or (farm given, the spot taken since) the nearest free one, or into storage.
  var put = function (s, key, x, y) { s.yard.items.push({ t: O.index[key], x: x, y: y }); };
  L.addBuildings = function (s, farm) {
    var B = C.FARM_BUILDINGS, have = {};
    s.yard.items.forEach(function (it) { var k = O.types[it.t] && O.types[it.t].key; if (k) have[k] = (have[k] || 0) + 1; });
    Object.keys(s.yard.bag).forEach(function (t) { var k = O.types[t] && O.types[t].key; if (k) have[k] = (have[k] || 0) + s.yard.bag[t]; });
    if (!s.ef) {
      B.home.forEach(function (b) { if (have[b[0]]) have[b[0]]--; else put(s, b[0], b[1], b[2]); });
      if (!have.field_plot4 && !have.field_plot42) {
        var f = B.field;
        for (var y = f.y0; y + 3 <= f.y1; y += 4) for (var x = f.x0; x + 3 <= f.x1; x += 4) put(s, 'field_plot4', x, y);
        for (var x2 = f.x0; x2 + 3 <= f.x1; x2 += 4) put(s, 'field_plot42', x2, f.y1 - 1);
      }
      s.ef = 1;
    }
    if (s.builds && s.builds.stable && !have.stable_yard) {
      var st = B.stable, t = O.index[st[0]], spot = { x: st[1], y: st[2] };
      if (farm && L.yardCantPlace(s, farm, t, spot.x, spot.y, null)) spot = L.yardFindSpot(s, farm, t, spot.x, spot.y);
      if (spot) put(s, st[0], spot.x, spot.y); else s.yard.bag[t] = (s.yard.bag[t] || 0) + 1;
    }
  };
  // the old field's tiles (a new farm's first debris), and the field plots' tiles (where weeds come up)
  L.defaultFieldTiles = function () {
    var f = C.FARM_BUILDINGS.field, out = [];
    for (var y = f.y0; y <= f.y1; y++) for (var x = f.x0; x <= f.x1; x++) out.push(y * C.FARM_W + x);
    return out;
  };
  L.fieldPlotTiles = function (s) {
    var out = [];
    (s.yard.items || []).forEach(function (it) {
      if (O.types[it.t] && O.types[it.t].fieldPlot) L.yardBox(it.t, it.x, it.y).forEach(function (p) { out.push(p[1] * C.FARM_W + p[0]); });
    });
    return out;
  };
  var newState = L.newState;
  L.newState = function (info) {
    if (info && info.fieldTiles && !info.fieldTiles.length) info = Object.assign({}, info, { fieldTiles: L.defaultFieldTiles() });
    var s = newState.call(this, info);
    if (s.yard) L.addBuildings(s);
    return s;
  };
  var catchUp = L.catchUp;
  L.catchUp = function (s, now, info) {
    if (info && info.fieldTiles && s.ef) info = Object.assign({}, info, { fieldTiles: L.fieldPlotTiles(s) });
    return catchUp.call(this, s, now, info);
  };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); if (s.ef) o.ef = 1; return o; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.ef = o.ef ? 1 : 0;
    L.addBuildings(s);
    return s;
  };

  // ---------- visits: a friend's farm as they laid it out; a snapshot from before (or a made-up farm) gets the buildings
  // where the map had them ----------
  var snapshot = L.snapshot;
  L.snapshot = function (s) { var o = snapshot(s); if (s.ef) o.ef = 1; return o; };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState.apply(this, arguments);
    s.ef = snap && snap.ef ? 1 : 0;
    if (s.yard) L.addBuildings(s);
    return s;
  };

  // the house and the ranch are only moved, never put away
  var storeYard = L.storeYard;
  L.storeYard = function (s, i) { var it = s.yard.items[i]; return it && O.types[it.t] && O.types[it.t].keep ? 'keep' : storeYard.apply(this, arguments); };
})(window.Farm = window.Farm || {});
