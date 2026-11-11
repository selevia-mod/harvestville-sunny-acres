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
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
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
