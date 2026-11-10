// Riding v2: how many of the others' riding sheets a phone holds at once (owner, 11 Nov 2026: 15 outfits x 2 in the new
// format, up to 30 farmers in a place; every different sheet is about 5 MB on the GPU). Your own always rides in its
// v2 sheet, and so may anyone in the farm clothes (ride2_default_*: shared, already in); another outfit's v2 sheet is
// held for up to C.RIDE2.others riders' outfits at once (C.RIDE2.othersCheap on a cheap phone); past that they ride in
// the farm clothes' v2 sheet. One not seen for C.RIDE2.letGo ms is let go (19-extras.js). Pure rules, tested in
// test/looks.test.js.
(function (F) {
  'use strict';
  var L = F.Logic;

  // The sheet another rider is drawn with. held: { key: when last seen }, the others' sheets this phone holds (changed
  // here: a sheet picked is marked seen now); want: the sheet of what they wear; keep: sheets always fine (yours, the
  // farm clothes'). Returns want, or null (draw the farm clothes' instead).
  L.ride2Pick = function (held, want, keep, now, cap) {
    if (!want) return null;
    if (keep.indexOf(want) >= 0) return want;
    if (held[want] == null && Object.keys(held).length >= cap) return null;
    held[want] = now;
    return want;
  };
  // The held sheets not seen for ms (taken out of held): to let go.
  L.ride2Stale = function (held, now, ms) {
    return Object.keys(held).filter(function (k) { if (now - held[k] < ms) return false; delete held[k]; return true; });
  };
})(window.Farm = window.Farm || {});
