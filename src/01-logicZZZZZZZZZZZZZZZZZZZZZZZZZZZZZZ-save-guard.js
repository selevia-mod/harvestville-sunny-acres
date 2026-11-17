// The save guard (owner, 17 Nov 2026: "why they keep losing pieces?"). Each loss so far was a different bug in how one
// part of the farm was written (the wider farm's sprinklers, the farmhouse, the limits, a fence on a path), and each was
// found only after players had lost pieces. So every save now checks itself, last of all: it counts each kind of farm piece
// in the save it is about to write (on the farm, in lines of fences and paths, in storage) against the farm in play. A
// piece the save would leave out goes into storage in that save, never away, and 'yk' says how many, so the server's
// daily check sees a new bug the next morning (and the players keep their pieces while it is fixed).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = C.OUTDOOR;

  // how many of each known kind of farm piece a save holds (an array by kind: cheap enough for every save)
  L.savedYardCounts = function (o) {
    var N = O.types.length, n = new Array(N).fill(0), yd = o && Array.isArray(o.yd) ? o.yd : [];
    var flat = Array.isArray(yd[0]) ? yd[0] : [], bag = Array.isArray(yd[1]) ? yd[1] : [], runs = Array.isArray(yd[2]) ? yd[2] : [], t, i, k;
    for (i = 0; i + 2 < flat.length; i += 3) { t = flat[i]; if (t >= 0 && t < N) n[t]++; }
    for (i = 0; i + 1 < bag.length; i += 2) { t = Number(bag[i]); k = Math.floor(Number(bag[i + 1])) || 0; if (t >= 0 && t < N && k > 0) n[t] += k; }
    // (the lines as L.yardUnrun reads them: a fence or path kind, a place, a length up to 120 either way)
    for (i = 0; i + 3 < runs.length; i += 4) {
      t = runs[i]; k = Math.min(120, Math.abs(Math.floor(Number(runs[i + 3])) || 0));
      if (t >= 0 && t < N && L.isYardTile(t) && runs[i + 1] >= 0 && runs[i + 2] >= 0) n[t] += k;
    }
    return n;
  };
  // and the farm in play
  L.playYardCounts = function (s) {
    var N = O.types.length, n = new Array(N).fill(0), items = s.yard.items || [], bag = s.yard.bag || {}, i, t;
    for (i = 0; i < items.length; i++) { t = items[i].t; if (t >= 0 && t < N) n[t]++; }
    for (t in bag) if (bag[t] > 0 && t >= 0 && t < N) n[t] += bag[t];
    return n;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    try {
      if (!s || !s.yard || !o || !Array.isArray(o.yd)) return o;
      var want = L.playYardCounts(s), got = L.savedYardCounts(o), bag = Array.isArray(o.yd[1]) ? o.yd[1] : (o.yd[1] = []), kept = 0;
      for (var t = 0; t < want.length; t++) {
        var miss = want[t] - got[t];
        if (!(miss > 0) || !O.types[t]) continue;
        kept += miss;
        for (var j = 0; j + 1 < bag.length && Number(bag[j]) !== t; j += 2);
        if (j + 1 < bag.length) bag[j + 1] = Number(bag[j + 1]) + miss; else bag.push(t, miss);
      }
      if (kept) { o.yk = kept; if (typeof console !== 'undefined') console.warn('save guard: ' + kept + ' farm pieces kept in storage'); }
    } catch (e) { /* the guard never stops a save */ }
    return o;
  };
})(window.Farm = window.Farm || {});
