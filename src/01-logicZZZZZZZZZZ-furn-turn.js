// Turning furniture (owner, 8 Nov 2026: "Furniture should be turned not just flip"; art: tools/art/furn-turn-import.js):
// beds, double beds, chairs, armchairs, sofas and tables turn four ways, each a quarter turn: front, facing left (its
// side), back, facing right (the side, mirrored). Every other piece still only flips. A piece keeps its place on the
// floor (its footprint), however it is turned. Saved in a piece's f: 0 front, 1 front flipped (as before), 2 facing left,
// 3 back, 4 facing right (an app from before shows 2-4 as flipped).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;
  // the turned pictures' order in each style's sheet (two each: side, back)
  C.FURN_TURNS = { bed: 0, double_bed: 1, chair: 2, armchair: 3, sofa: 4, table: 5 };
  L.furnTurns = function (t) { var type = H.types[t]; return !!type && C.FURN_TURNS[type.key] != null; };
  // a piece's f, as saved: 0..4 for one that turns, 0 or 1 for the rest
  L.furnF = function (t, f) {
    var n = f === true ? 1 : Math.floor(Number(f)) || 0;
    return L.furnTurns(t) ? Math.max(0, Math.min(4, n)) : n ? 1 : 0;
  };
  // the next quarter turn (front -> facing left -> back -> facing right -> front); a piece that only flips: flips
  L.nextTurn = function (t, f) {
    f = L.furnF(t, f);
    if (!L.furnTurns(t)) return f ? 0 : 1;
    return f <= 1 ? 2 : f === 4 ? 0 : f + 1;
  };
  // the turned picture: { frame (in the style's turned sheet), flip } or null (the front picture)
  L.furnView = function (t, f) {
    f = L.furnF(t, f);
    if (f < 2 || !L.furnTurns(t)) return null;
    return { frame: C.FURN_TURNS[H.types[t].key] * 2 + (f === 3 ? 1 : 0), flip: f === 4 };
  };
  // its box in a 256 x 256 cell: the piece's footprint shape, standing on the cell's bottom edge (the import draws it so)
  L.furnTurnBox = function (t, cell) {
    var type = H.types[t], w = type.w, h = type.h;
    var bw = w >= h ? cell : Math.round(cell * w / h), bh = h >= w ? cell : Math.round(cell * h / w);
    return { x: Math.round((cell - bw) / 2), y: cell - bh, w: bw, h: bh };
  };
})(window.Farm = window.Farm || {});
