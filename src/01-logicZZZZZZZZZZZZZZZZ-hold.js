// The weapons drawn in the hands (owner, 11 Nov 2026: "pose sheet still much better"; the pictures
// art-src/weapons/hold/<weapon>-<boy|girl>.png, later <outfit>-<weapon>-<boy|girl>.png; tools/art/weapons-hold-import.js).
// How many of the others' sheets a phone holds at once (each is a few MB on the GPU, up to 30 hunters in a place):
// yours always; another hunter's for up to C.WPN_HOLD.others looks at once (othersCheap on a cheap phone), past that
// their shot shows as before; one not seen for C.WPN_HOLD.letGo ms is let go. (As riding v2 does it.) Pure, unit tested.
(function (F) {
  'use strict';
  var L = F.Logic;
  F.Config.WPN_HOLD = { others: 10, othersCheap: 4, letGo: 30000 };
  // the directions each sheet has (front, back, left: src/00-zzzzzzzzzzzzzzzzzzzzz-hold-rows.js, made by the importer)
  F.Config.WPN_HOLD_ROWS = F.Config.WPN_HOLD_ROWS || {};
  // Does this sheet have the way he faces? (right is left, mirrored)
  L.holdHas = function (key, dir) {
    var rows = F.Config.WPN_HOLD_ROWS[key];
    return !!rows && rows.indexOf(dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'left') >= 0;
  };

  // The sheet to draw another hunter with. held: { key: when last seen } (changed: a sheet picked is marked seen now);
  // want: the sheet of their look and weapon; keep: always fine (yours). Returns want, or null (no room: the old way).
  L.sheetPick = function (held, want, keep, now, cap) {
    if (!want) return null;
    if (keep.indexOf(want) >= 0) return want;
    if (held[want] == null && Object.keys(held).length >= cap) return null;
    held[want] = now;
    return want;
  };
  // The held sheets not seen for ms (taken out of held): to let go.
  L.sheetStale = function (held, now, ms) {
    return Object.keys(held).filter(function (k) { if (now - held[k] < ms) return false; delete held[k]; return true; });
  };
  // A hold sheet's name: the weapon in the hands of the boy or girl, in an outfit (a Tailor Shop look) or the farm clothes.
  L.holdKey = function (weapon, look, outfit) {
    return 'wpn_hold_' + (outfit ? outfit + '_' : '') + weapon + '_' + (look === 'girl' ? 'girl' : 'boy');
  };
})(window.Farm = window.Farm || {});
