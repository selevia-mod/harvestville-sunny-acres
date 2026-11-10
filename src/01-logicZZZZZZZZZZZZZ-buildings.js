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
})(window.Farm = window.Farm || {});
