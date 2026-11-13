// Lands 7, 8 and 9 (owner, 12 Nov 2026: docs/superpowers/specs/2026-11-12-lands-7-9-design.md): the farm grew from 64 to
// 75 tiles wide. A save or a friend's snapshot says how wide its tile numbers are (fw): the soil and the debris are moved
// to the same places by 01-logic6.js (saves) and 01-logicE.js (snapshots); yard pieces, fruit trees and buildings are kept
// by x and y and do not move. What else is kept by tile number is moved here: the old decorations cleared ('dco',
// 01-logicZZZ-deco.js, which came after those). A save written now says 75, so nothing is ever moved twice.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var widthOf = function (fw, def) { fw = Math.floor(Number(fw)); return isFinite(fw) && fw >= 1 && fw <= 1000 ? fw : def; };
  var move = function (list, fw) {
    if (fw === C.FARM_W || !Array.isArray(list)) return list;
    return list.map(function (i) { return Math.floor(i / fw) * C.FARM_W + i % fw; });
  };
  L.farmMoveIdx = move;
  // The sprinklers and fertilizer (01-logicZ-farmtech.js 'ft': [tile, value, ...]) are put on the soil after
  // 01-logic6.js has moved it, by their own tile numbers: those must be moved first (owner, 13 Nov 2026: "users lost
  // item update Manila update ... some is sprinkler" - e60 put a 64-wide farm's sprinklers on the wrong tiles, or none).
  var movePairs = function (list, fw) {
    if (fw === C.FARM_W || !Array.isArray(list)) return list;
    var out = list.slice();
    for (var k = 0; k + 1 < out.length; k += 2) { var i = Math.floor(Number(out[k])); if (i >= 0) out[k] = Math.floor(i / fw) * C.FARM_W + i % fw; }
    return out;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var fw = o && typeof o === 'object' ? widthOf(o.fw, 24) : C.FARM_W;
    if (fw !== C.FARM_W && o.ft && typeof o.ft === 'object' && (Array.isArray(o.ft.s) || Array.isArray(o.ft.f))) {
      o = Object.assign({}, o, { ft: Object.assign({}, o.ft, { s: movePairs(o.ft.s, fw), f: movePairs(o.ft.f, fw) }) });
    }
    var s = deserialize(o);
    if (s && s.decoGone) s.decoGone = move(s.decoGone, widthOf(o.fw, 24));
    return s;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine);
    if (s && s.decoGone) s.decoGone = move(s.decoGone, widthOf(snap && snap.fw, 38));
    return s;
  };
})(window.Farm = window.Farm || {});
