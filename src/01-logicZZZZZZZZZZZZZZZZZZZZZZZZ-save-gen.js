// The save's generation (owner, 13 Nov 2026: "redesign is not saving"). An older game drops what it does not know (Edit
// Farm's buildings, the flag 'ef', a newer update's keys) and its save went up over the newer farm. Every save now says
// which game wrote it ('gg'); the server refuses a save from an older generation than the one it holds
// (farm_save_put_v1, ~/Downloads/farm-save-guard-SQL), and the app prefers the server's copy when it comes from a newer
// game (lib/sunny-acres/cloud.js). Raise C.SAVE_GEN when an update adds what an older game would throw away.
//   0: before Edit Farm (no 'ef', no 'gg')   1: Edit Farm, e54/e55 ('ef', no 'gg')
//   2: lands 7-9 and the 75-wide farm, The Lost Tower, Farm Economy v2, the Tower's food, name frames (e58)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  C.SAVE_GEN = 2;
  // the generation of a save (an older one has no 'gg': Edit Farm's 'ef' says 1)
  L.saveGen = function (o) {
    if (!o || typeof o !== 'object') return 0;
    var g = Math.floor(Number(o.gg));
    return isFinite(g) && g > 0 ? g : o.ef ? 1 : 0;
  };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); o.gg = C.SAVE_GEN; return o; };
})(window.Farm = window.Farm || {});
