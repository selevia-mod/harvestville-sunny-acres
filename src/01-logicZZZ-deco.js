// The farm's old decorations can be cleared (owner, 11 Nov 2026: "This stump, rock and other blocking outside the farm land
// should be removable also"). The map has bushes, rocks, stumps and tall grass around the field; now the right tool
// clears them like the field's debris (a bush is a branch, a rock a stone, tall grass a weed) and pays the same. Once
// cleared they stay gone: s.decoGone, the map's tile numbers (saved as 'dco', and in the snapshot friends visit).
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic;
  // the map's tiles (tools/tiles.js, the 'tiles' tileset): bush and tall grass change with the seasons (their slots)
  C.FARM_DECO = { ids: { 76: 'stone', 82: 'stump' }, slots: { 10: 'branch', 11: 'weed' }, mapIds: { 75: 'branch', 76: 'stone', 82: 'stump', 83: 'weed' } };
  var clean = function (list) {
    return (Array.isArray(list) ? list : []).filter(function (n, i, a) { return Number.isInteger(n) && n >= 0 && n < 1e5 && a.indexOf(n) === i; });
  };
  L.decoGone = function (s) { return (s.decoGone = s.decoGone || []); };
  // Clears the decoration at idx (a debris kind) and pays like that debris in the field (the wood event too).
  L.clearDeco = function (s, idx, kind) {
    if (!C.DEBRIS[kind] || L.decoGone(s).indexOf(idx) >= 0) return null;
    s.decoGone.push(idx);
    s.debris[idx] = kind;
    return L.clearDebris(s, idx);
  };
  // Decorate (owner, 11 Nov 2026, a screen recording: the Dog Yard was red everywhere north of the field, "You can't build
  // there"): every decoration tile counted as built-on, so the tufts of grass, bushes, rocks and stumps dotted about left no
  // room for a big piece. Now they give way: a piece may go over them, and placing or moving it there clears them.
  var farmInfo = L.farmInfo;
  L.farmInfo = function (map) {
    var info = farmInfo(map), ts = (map.tilesets || []).filter(function (t) { return t.name === 'tiles'; })[0], first = ts ? ts.firstgid : 1;
    var walls = (map.layers || []).filter(function (l) { return l.name === 'Walls' && l.data; })[0];
    info.deco = {};
    if (walls) walls.data.forEach(function (gid, i) { var k = gid && C.FARM_DECO.mapIds[gid - first]; if (k) info.deco[i] = k; });
    return info;
  };
  var under = function (farm, t, x, y) {
    if (!farm || !farm.deco || !F.Config.OUTDOOR.types[t]) return [];
    return L.yardBox(t, x, y).map(function (p) { return p[1] * farm.w + p[0]; }).filter(function (i) { return farm.deco[i]; });
  };
  var cantPlace = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) {
    var why = cantPlace(s, farm, t, x, y, skip);
    if (why !== 'blocked') return why;
    var np = farm.noPlace, freed = under(farm, t, x, y).filter(function (i) { return np[i]; });
    if (!freed.length) return why;
    freed.forEach(function (i) { np[i] = 0; }); // (blocked only by decorations? ask again with them out of the way)
    try { return cantPlace(s, farm, t, x, y, skip); } finally { freed.forEach(function (i) { np[i] = 1; }); }
  };
  var cover = function (s, farm, t, x, y) {
    var gone = L.decoGone(s);
    under(farm, t, x, y).forEach(function (i) { if (gone.indexOf(i) < 0) gone.push(i); });
  };
  var placeYard = L.placeYard;
  L.placeYard = function (s, farm, t, x, y) {
    var r = placeYard(s, farm, t, x, y);
    if (typeof r === 'number') cover(s, farm, t, x, y);
    return r;
  };
  var moveYard = L.moveYard;
  L.moveYard = function (s, farm, i, x, y) {
    var it = s.yard.items[i], r = moveYard(s, farm, i, x, y);
    if (r === 'ok' && it) cover(s, farm, it.t, x, y);
    return r;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.decoGone && s.decoGone.length) o.dco = s.decoGone.slice();
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s) s.decoGone = clean(o && o.dco);
    return s;
  };
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var snap = snapshot(s);
    if (s.decoGone && s.decoGone.length) snap.dco = s.decoGone.slice();
    return snap;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine);
    if (s) s.decoGone = clean(snap && snap.dco);
    return s;
  };
})(window.Farm = window.Farm || {});
