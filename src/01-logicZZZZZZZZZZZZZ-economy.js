// Farm economy v2, part 1 rules (content in 00-zzzzzzzzzzzzzzzzzz-economy.js; docs/farm-economy-v2.md section 1).
// - No more seasons: every crop can be planted in every season and every fruit tree fruits all year (the content file
//   gives each all four seasons; these say so outright, for anything added later). Seasons still change the land's
//   look, the festivals and the weather.
// - The Greenhouse: a crop planted inside grows 25% faster (C.GREENHOUSE.faster), on top of its watering itself. Done
//   by starting the crop's clock that much earlier the moment it starts growing there (t.p), so nothing new is saved
//   and every reader of a crop's time (its stage, time left, the reminder, a raid's copy, a visitor's view) agrees.
//   Only a crop planted (or first watered) inside gets it, once; a crop already growing when this came keeps its time.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  // ---------- no more seasons ----------
  L.cropInSeason = function () { return true; };
  L.treeInSeason = function () { return true; };
  L.seasonsOf = function () { return 'every season'; };
  // (Lily's seed list: every seed, in every season)
  L.seedsInSeason = function () { return C.SHOP_STOCK.slice(); };
  if (L.canPlantHere) L.canPlantHere = function () { return true; };

  // ---------- the greenhouse: 25% faster ----------
  var faster = function () { return (C.GREENHOUSE && C.GREENHOUSE.faster) || 0; };
  // Starts tile t's crop growing as if it had begun faster x its growing time ago (it is ripe that much sooner).
  L.ghBoost = function (t) {
    if (!t || !t.c || !C.CROPS[t.c] || L.needsWater(t)) return false;
    t.p -= Math.round(faster() * L.growMins(t));
    return true;
  };
  var boosted = null; // the tiles boosted during one planting (so a tile wet as it is planted is not boosted twice)
  if (L.inGreenhouse && L.autoWater) {
    // a crop on dry greenhouse soil starts growing when the misters wet it: it starts boosted
    var autoWater = L.autoWater;
    L.autoWater = function (s, idx, now) {
      var t = s && s.soil && s.soil[idx], waiting = L.needsWater(t);
      var r = autoWater(s, idx, now);
      if (r && waiting && t.c && L.inGreenhouse(s, idx) && L.ghBoost(t) && boosted) boosted[idx] = 1;
      return r;
    };
    // a seed planted on wet greenhouse soil starts growing at once: boosted
    var plantBag = L.plantBag;
    L.plantBag = function (s, idxs, slotIndex) {
      var empty = (idxs || []).filter(function (idx) { return s.soil[idx] && !s.soil[idx].c; });
      boosted = {};
      var r;
      try { r = plantBag(s, idxs, slotIndex); } finally {
        var done = boosted;
        boosted = null;
        if (typeof r === 'number' && !s.isVisit) {
          empty.forEach(function (idx) { if (!done[idx] && s.soil[idx] && s.soil[idx].c && L.inGreenhouse(s, idx)) L.ghBoost(s.soil[idx]); });
        }
      }
      return r;
    };
  }
})(window.Farm = window.Farm || {});
