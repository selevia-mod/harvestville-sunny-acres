// The deeper Mine: the rules (bands, new items: 00-zzmine.js; the cave and the lift: 19y-mine.js). Nothing new is saved:
// the bar, the badges and the lift all come from the deepest floor you ever reached.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var B = C.MINE.bands;

  // appended here, after everything else, because the collection is saved as a bitset in this order
  B.slice(1).forEach(function (b) { b.ids.slice(2).forEach(function (id) { if (C.COLLECTION.indexOf(id) < 0) C.COLLECTION.push(id); }); });

  L.mineBand = function (floor) {
    for (var i = B.length - 1; i > 0; i--) if (floor >= B[i].from) return i;
    return 0;
  };
  // Each band reached for the first time: +10 energy on the bar. It adds nothing to how fast energy comes back.
  L.bandBonus = function (s) { return s.stats ? L.mineBand(s.stats.deepest || 0) * 10 : 0; };
  // Where the lift goes: every C.MINE.liftEvery floors you have reached (1, 51, 101 ...), the first floor of every band
  // among them.
  L.liftStops = function (s) {
    var every = C.MINE.liftEvery, deepest = (s.stats && s.stats.deepest) || 0, out = [];
    for (var f = 1; f <= Math.max(1, deepest); f += every) out.push(f);
    B.forEach(function (b) { if (b.from <= deepest && out.indexOf(b.from) < 0) out.push(b.from); }); // (if the step is ever changed)
    return out.sort(function (a, b) { return a - b; });
  };
  // What a chest holds instead of the plain Gem, floor 201 and down.
  L.chestGem = function (floor) { return B[L.mineBand(floor)].ids[3]; };

  var mineDrop = L.mineDrop;
  L.mineDrop = function (floor, r) {
    var band = L.mineBand(floor);
    if (!band) return mineDrop(floor, r);
    var acc = 0, drops = C.MINE.drops, ids = B[band].ids;
    for (var i = 0; i < drops.length; i++) {
      acc += drops[i].p;
      if (r < acc) return i ? ids[i - 1] : drops[0].id;
    }
    return null;
  };
})(window.Farm = window.Farm || {});
