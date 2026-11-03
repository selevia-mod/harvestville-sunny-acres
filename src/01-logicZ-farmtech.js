// Farm tech rules (content in 00-zzzzzzz-farmtech.js): sprinklers, fertilizer and crop quality, the greenhouse, and their
// save ('ft'). Pure, no Phaser. (Named 01-logicZ-... and not 01-logic-farmtech.js: files load in name order, and "-" sorts
// before "." and every letter, so 01-logic-farmtech.js would load before 01-logic.js has made F.Logic.)
//
// How a sprinkler waters, against the real-time growth rules (01-logic.js, owner 29 Oct 2026: an unwatered seed stays a
// seed): soil is only ever dry at a few moments: when it is tilled, when a crop on it is picked (watering lasts for one
// crop) or dug up, and in a save made before the sprinkler was there. Nothing dries it in between, not even the night.
// So instead of a clock that waters every so often, a sprinkler wets each tile in its reach AT those moments (and when it
// is placed, every morning and when the game loads): the tile is never dry while the sprinkler stands, as if you watered it
// the very minute it dried. A seed planted in its reach starts growing at once; one planted before the sprinkler came starts
// growing the minute the sprinkler is placed (never earlier, so no time is skipped). The greenhouse's misters do the same
// for every tile inside it.
//
// Crop quality is a mark on a bag slot (slot.q: 1 Silver, 2 Gold; normal crops have none). Slots of another quality never
// stack together; taking an item by its name (cooking, requests, gifts) uses normal ones first. Selling a Silver or Gold
// crop by its slot (shipping box, Sell now, a stall shelf) pays its quality's price.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = C.OUTDOOR;
  var Q = C.QUALITY;

  C.TIPS.push({ key: 'sprinkler_tour', text: 'SPRINKLERS' }, { key: 'quality_tour', text: 'SILVER AND GOLD CROPS' }, { key: 'greenhouse_tour', text: 'THE GREENHOUSE' });

  var W = function () { return C.FARM_W; };
  var num = function (v, max) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(0, Math.min(max, v)) : 0; };

  // ---------- the greenhouse ----------
  var GH = O.index.greenhouse;
  // The greenhouse covering farm tile idx (its yard item), or null.
  L.greenhouseAt = function (s, idx) {
    if (!s || !s.yard || !s.yard.items) return null;
    var x = idx % W(), y = Math.floor(idx / W());
    for (var i = 0; i < s.yard.items.length; i++) {
      var it = s.yard.items[i];
      if (it.t === GH && x >= it.x && x < it.x + O.types[GH].w && y >= it.y && y < it.y + O.types[GH].h) return it;
    }
    return null;
  };
  L.inGreenhouse = function (s, idx) { return !!L.greenhouseAt(s, idx); };
  L.hasGreenhouse = function (s) { return !!(s.yard && (s.yard.items.some(function (it) { return it.t === GH; }) || s.yard.bag[GH])); };

  // ---------- sprinklers ----------
  L.sprinklerOf = function (id) { var it = C.ITEMS[id]; return it && it.kind === 'sprinkler' ? C.SPRINKLERS[it.tier] : null; };
  // [dx, dy] of the tiles a sprinkler of a tier (0, 1, 2) keeps watered
  L.sprinklerReach = function (tier) {
    var out = [], reach = C.SPRINKLERS[tier].reach, r = reach === 'big' ? 2 : 1;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      if (reach === 'plus' && dx && dy) continue;
      out.push([dx, dy]);
    }
    return out;
  };
  // the farm tiles (idx) a sprinkler at idx waters (none off the edge of the map, none wrapping onto the next row)
  L.sprinklerTiles = function (idx, tier) {
    var x = idx % W(), y = Math.floor(idx / W());
    return L.sprinklerReach(tier).filter(function (d) { return x + d[0] >= 0 && x + d[0] < W() && y + d[1] >= 0; })
      .map(function (d) { return (y + d[1]) * W() + x + d[0]; });
  };
  // Is tile idx in a sprinkler's reach (or in the greenhouse)? (Looks only at the 5x5 around it.)
  L.wateredBy = function (s, idx) {
    if (L.inGreenhouse(s, idx)) return 'greenhouse';
    var x = idx % W(), y = Math.floor(idx / W());
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= W()) continue;
      var t = s.soil[(y + dy) * W() + x + dx];
      if (!t || !t.sp) continue;
      var tier = t.sp - 1, reach = C.SPRINKLERS[tier] && C.SPRINKLERS[tier].reach;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (reach === 'big' || (reach === 'ring' && ax <= 1 && ay <= 1) || (reach === 'plus' && ax + ay === 1)) return 'sprinkler';
    }
    return null;
  };
  // Wets tile idx now if a sprinkler or the greenhouse waters it and it is dry (not on a friend's farm). True if it did.
  L.autoWater = function (s, idx, now) {
    var t = s.soil[idx];
    if (!t || t.w || t.sp || s.isVisit || L.cropStage(t, now) >= 3 || !L.wateredBy(s, idx)) return false;
    L.wet(t, now);
    return true;
  };
  // Every tile on the farm (in the morning, on load). Returns how many it wet.
  L.autoWaterAll = function (s, now) {
    var n = 0;
    Object.keys(s.soil || {}).forEach(function (k) { if (L.autoWater(s, Number(k), now)) n++; });
    return n;
  };
  L.sprinklers = function (s) {
    var out = [];
    Object.keys(s.soil || {}).forEach(function (k) { var t = s.soil[k]; if (t.sp) out.push({ idx: Number(k), tier: t.sp - 1 }); });
    return out;
  };

  // Why a sprinkler can't go on tile idx, or null.
  L.sprinklerCantPlace = function (s, idx) {
    var t = s.soil[idx];
    if (!t) return 'nosoil';
    if (t.sp) return 'taken';
    if (t.c) return 'crop';
    if (L.inGreenhouse(s, idx)) return 'greenhouse';
    return null;
  };
  // Puts the sprinkler held in bag slot slotIndex on tile idx; it waters its tiles at once. 'ok', or why not.
  L.placeSprinkler = function (s, idx, slotIndex) {
    var slot = s.inv[slotIndex], sp = slot && L.sprinklerOf(slot.id);
    if (!sp) return 'nosprinkler';
    var why = L.sprinklerCantPlace(s, idx);
    if (why) return why;
    var t = s.soil[idx];
    t.sp = C.ITEMS[slot.id].tier + 1;
    t.w = 0;
    delete t.f;
    L.removeAt(s, slotIndex, 1);
    var now = L.nowMin();
    L.sprinklerTiles(idx, t.sp - 1).forEach(function (k) { L.autoWater(s, k, now); });
    return 'ok';
  };
  // Takes the sprinkler on tile idx back into the bag (the tilled soil stays). 'ok', 'none' or 'full'.
  L.pickUpSprinkler = function (s, idx) {
    var t = s.soil[idx];
    if (!t || !t.sp) return 'none';
    var id = C.SPRINKLERS[t.sp - 1].id;
    if (L.addItem(s, id, 1) > 0) return 'full';
    delete t.sp;
    return 'ok';
  };
  // Bram makes one: gold and ore. 'ok', 'gold', 'ore' or 'full'.
  L.makeSprinkler = function (s, tier) {
    var sp = C.SPRINKLERS[tier];
    if (!sp) return 'none';
    if (s.gold < sp.gold) return 'gold';
    if (L.countItem(s, sp.ore) < sp.n) return 'ore';
    if (!L.canAdd(s, sp.id, 1)) return 'full';
    s.gold -= sp.gold;
    L.removeItem(s, sp.ore, sp.n);
    L.addItem(s, sp.id, 1);
    return 'ok';
  };

  // ---------- fertilizer ----------
  L.fertOf = function (id) { var it = C.ITEMS[id]; return it && it.kind === 'fert' ? it.level : 0; };
  // Can fertilizer of a level go on tile idx? Tilled, no sprinkler, nothing past a sprout, not already as good.
  L.canFertilize = function (s, idx, level) {
    var t = s.soil[idx];
    return !!t && !t.sp && (t.f || 0) < level && (!t.c || (!C.CROPS[t.c].sickle && L.cropStage(t) <= 1));
  };
  // A bag of fertilizer (bag slot slotIndex) spread on the tiles idxs (the 3x3 around the target). Returns how many tiles
  // it covered, or 'nofert' / 'nospace'.
  L.fertilize = function (s, idxs, slotIndex) {
    var slot = s.inv[slotIndex], level = slot ? L.fertOf(slot.id) : 0;
    if (!level) return 'nofert';
    var n = 0;
    idxs.forEach(function (idx) { if (L.canFertilize(s, idx, level)) { s.soil[idx].f = level; n++; } });
    if (!n) return 'nospace';
    L.removeAt(s, slotIndex, 1);
    return n;
  };

  // ---------- crop quality ----------
  L.qualityName = function (q) { return Q.names[q] || ''; };
  L.qualityMult = function (q) { return Q.mult[q] || 1; };
  L.qualityOf = function (slot) { return (slot && slot.q) || 0; };
  // A quality's price for one (at least 1G more than a normal one).
  L.qualityPrice = function (id, q) {
    var p = (C.ITEMS[id] && C.ITEMS[id].sell) || 0;
    return q && p ? Math.max(p + 1, Math.round(p * L.qualityMult(q))) : p;
  };
  // The chances [Silver, Gold] for a crop on tile t (its fertilizer, and the crop stars for that crop).
  L.qualityChance = function (s, t) {
    var base = Q.chance[(t && t.f) || 0] || Q.chance[0], stars = t && t.c && L.masteryLevel ? L.masteryLevel(s, t.c) : 0;
    return [base[0] + stars * Q.star[0], base[1] + stars * Q.star[1]];
  };
  // The quality the ripe crop on tile idx will come out as: 0, 1 Silver or 2 Gold. Worked out from the tile and the minute
  // it started growing (like a golden crop), so looking again or reopening the game changes nothing.
  L.cropGrade = function (s, idx) {
    var t = s.soil[idx];
    if (!t || !t.c || C.CROPS[t.c].sickle) return 0;
    var ch = L.qualityChance(s, t), u = L.rand(s.seed, idx, Math.floor(t.p), 91);
    return u < ch[1] ? 2 : u < ch[1] + ch[0] ? 1 : 0;
  };
  // For later (contests): the best quality of an item in the bag (0 if none of it is Silver or Gold, -1 if none at all).
  L.cropQuality = function (s, item) {
    var best = -1;
    s.inv.forEach(function (x) { if (x && x.id === item) best = Math.max(best, x.q || 0); });
    return best;
  };
  // How many of an item the bag has at a quality or better.
  L.countQuality = function (s, item, q) {
    return s.inv.reduce(function (n, x) { return n + (x && x.id === item && (x.q || 0) >= q ? x.n : 0); }, 0);
  };
  // Takes n of an item at quality q or better from the bag, the lowest of those first. Returns how many it took.
  L.takeQuality = function (s, item, q, n) {
    var left = n;
    [0, 1, 2].filter(function (g) { return g >= q; }).forEach(function (g) {
      for (var i = 0; i < s.inv.length && left > 0; i++) if (s.inv[i] && s.inv[i].id === item && (s.inv[i].q || 0) === g) left -= L.removeAt(s, i, left);
    });
    return n - left;
  };

  // A Silver or Gold slot is hidden from the rules that know nothing of quality while they run (they stack and take by
  // id), by renaming it for that moment.
  var HIDE = '~q:';
  var hide = function (list) {
    var hidden = [];
    list.forEach(function (x) { if (x && x.q) { hidden.push([x, x.id]); x.id = HIDE + x.id; } });
    return hidden;
  };
  var show = function (hidden) { hidden.forEach(function (h) { h[0].id = h[1]; }); };
  var withHidden = function (list, fn) {
    var hidden = hide(list);
    try { return fn(); } finally { show(hidden); }
  };

  var addItem = L.addItem;
  L.addItem = function (s, id, n) { return withHidden(s.inv, function () { return addItem(s, id, n); }); };
  var canAdd = L.canAdd;
  L.canAdd = function (s, id, n) { return withHidden(s.inv, function () { return canAdd(s, id, n); }); };
  // Room for n of an item at quality q?
  L.canAddQ = function (s, id, n, q) {
    if (!q) return L.canAdd(s, id, n);
    var room = 0, max = L.stackLimit(id);
    s.inv.forEach(function (x) { if (!x) room += max; else if (x.id === id && x.q === q) room += max - x.n; });
    return room >= n;
  };
  // Adds n of an item at quality q (stacked only with the same quality). Returns how many did not fit.
  L.addItemQ = function (s, id, n, q) {
    if (!q) return L.addItem(s, id, n);
    var max = L.stackLimit(id), i;
    for (i = 0; i < s.inv.length && n > 0; i++) {
      var x = s.inv[i];
      if (x && x.id === id && x.q === q && x.n < max) { var add = Math.min(n, max - x.n); x.n += add; n -= add; }
    }
    for (i = 0; i < s.inv.length && n > 0; i++) {
      if (!s.inv[i]) { var put = Math.min(n, max); s.inv[i] = { id: id, n: put, q: q }; n -= put; }
    }
    return n;
  };
  // Taking by name: normal ones first, then Silver, then Gold.
  var removeItem = L.removeItem;
  L.removeItem = function (s, id, n) {
    var got = withHidden(s.inv, function () { return removeItem(s, id, n); });
    if (got < n) got += L.takeQuality(s, id, 1, n - got);
    return got;
  };

  // Arranging the bag and Storage: different qualities swap instead of stacking.
  var swap = function (list, from, to) {
    var a = list[from], b = list[to];
    list[to] = a;
    list[from] = b || null;
  };
  var moveSlot = L.moveSlot;
  L.moveSlot = function (s, from, to) {
    var a = s.inv[from], b = s.inv[to];
    if (a && b && a !== b && a.id === b.id && (a.q || 0) !== (b.q || 0)) {
      swap(s.inv, from, to);
      if (s.sel === from) s.sel = to;
      else if (s.sel === to) s.sel = from;
      return 'ok';
    }
    return moveSlot(s, from, to);
  };
  if (L.moveStore) {
    var moveStore = L.moveStore;
    L.moveStore = function (s, from, to) {
      var a = s.store[from], b = s.store[to];
      if (a && b && a !== b && a.id === b.id && (a.q || 0) !== (b.q || 0)) { swap(s.store, from, to); return 'ok'; }
      return moveStore(s, from, to);
    };
    var storeIn = L.storeIn;
    L.storeIn = function (s, i, count) {
      var slot = s.inv[i];
      if (!slot || !slot.q) return withHidden(s.store, function () { return storeIn(s, i, count); });
      var max = L.stackLimit(slot.id), want = Math.min(count || slot.n, slot.n), n = want, k;
      for (k = 0; k < s.store.length && n > 0; k++) {
        var st = s.store[k];
        if (st && st.id === slot.id && st.q === slot.q && st.n < max) { var add = Math.min(n, max - st.n); st.n += add; n -= add; }
      }
      for (k = 0; k < s.store.length && n > 0; k++) {
        if (!s.store[k]) { var put = Math.min(n, max); s.store[k] = { id: slot.id, n: put, q: slot.q }; n -= put; }
      }
      var moved = want - n;
      slot.n -= moved;
      if (slot.n <= 0) s.inv[i] = null;
      return moved;
    };
    var storeOut = L.storeOut;
    L.storeOut = function (s, k, count) {
      var st = s.store[k];
      if (!st || !st.q) return storeOut(s, k, count);
      var want = Math.min(count || st.n, st.n), moved = want - L.addItemQ(s, st.id, want, st.q);
      st.n -= moved;
      if (st.n <= 0) s.store[k] = null;
      return moved;
    };
  }

  // ---------- selling by quality ----------
  // While a Silver or Gold lot is priced (Sell now, a shelf), an item's base price is its quality's price.
  var pricing = 0;
  L.withQuality = function (q, fn) {
    var was = pricing;
    pricing = q || 0;
    try { return fn(); } finally { pricing = was; }
  };
  if (L.basePrice) {
    var basePrice = L.basePrice;
    L.basePrice = function (id) { return pricing ? L.qualityPrice(id, pricing) : basePrice(id); };
  }
  if (L.sellNow) {
    var sellNow = L.sellNow;
    L.sellNow = function (s, slotIndex, n) { return L.withQuality(L.qualityOf(s.inv[slotIndex]), function () { return sellNow(s, slotIndex, n); }); };
  }
  if (L.listItem) {
    var listItem = L.listItem;
    L.listItem = function (s, shelf, slotIndex, n, level) {
      var q = L.qualityOf(s.inv[slotIndex]), r = listItem(s, shelf, slotIndex, n, level);
      if (r === 'ok' && q && s.shelves[shelf]) s.shelves[shelf].q = q;
      return r;
    };
    var sellLot = L.sellLot;
    L.sellLot = function (s, i, buyer) { var e = s.shelves[i]; return L.withQuality(e && e.q, function () { return sellLot(s, i, buyer); }); };
    var unlist = L.unlist;
    L.unlist = function (s, shelf) {
      var e = s.shelves[shelf];
      if (!e || !e.q || e.coins) return unlist(s, shelf);
      if (!L.canAddQ(s, e.id, e.n, e.q)) return 'full';
      L.addItemQ(s, e.id, e.n, e.q);
      s.shelves[shelf] = null;
      return 'ok';
    };
  }
  // The shipping box keeps Silver and Gold lots apart ({ id, n, q }) and pays their price overnight.
  var ship = L.ship;
  L.ship = function (s, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || !slot.q) return withHidden(s.box, function () { return ship(s, slotIndex); });
    if (!C.ITEMS[slot.id].sell) return null;
    var entry = s.box.filter(function (b) { return b.id === slot.id && b.q === slot.q; })[0];
    if (entry) entry.n += slot.n;
    else s.box.push({ id: slot.id, n: slot.n, q: slot.q });
    s.inv[slotIndex] = null;
    return { id: slot.id, n: slot.n, q: slot.q, value: L.qualityPrice(slot.id, slot.q) * slot.n };
  };
  var boxValue = L.boxValue;
  L.boxValue = function (s) {
    return boxValue(s) + s.box.reduce(function (sum, b) { return sum + (b.q ? (L.qualityPrice(b.id, b.q) - C.ITEMS[b.id].sell) * b.n : 0); }, 0);
  };

  // ---------- the field ----------
  // Picking by hand: the crop comes out at its quality; the fertilizer is used up; the sprinkler wets the soil again.
  L.ftNotes = [];
  L.takeFtNotes = function () { var n = L.ftNotes; L.ftNotes = []; return n; };
  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var t = s.soil[idx], q = t && L.isRipe(t) && !s.isVisit ? L.cropGrade(s, idx) : 0, got = harvest(s, idx);
    if (typeof got !== 'string' || got[0] === '!') return got;
    if (t) delete t.f;
    if (q && L.removeWithHidden(s, got)) {
      if (L.addItemQ(s, got, 1, q) > 0) L.addItem(s, got, 1); // (no room for it on its own: it stays normal)
      else L.ftNotes.push({ idx: idx, item: got, q: q });
    }
    L.autoWater(s, idx);
    return got;
  };
  // takes one normal `id` from the bag (true if it did)
  L.removeWithHidden = function (s, id) { return withHidden(s.inv, function () { return removeItem(s, id, 1); }) === 1; };
  var cut = L.cut;
  L.cut = function (s, idx) { var got = cut(s, idx); if (typeof got === 'string' && got[0] !== '!') L.autoWater(s, idx); return got; };
  var till = L.till;
  L.till = function (s, idx) { var r = till(s, idx); if (r === 'ok' || r === 'cleared') L.autoWater(s, idx); return r; };
  if (L.digUp) {
    var digUp = L.digUp;
    L.digUp = function (s, idx) { var r = digUp(s, idx); if (r === 'ok') L.autoWater(s, idx); return r; };
  }
  // Planting skips a sprinkler's tile; in a greenhouse any seed grows in any season (out of season, only the greenhouse
  // tiles of the 3x3 are planted); planted tiles a sprinkler or the greenhouse waters start growing now.
  var anySeason = false;
  var cropInSeason = L.cropInSeason;
  L.cropInSeason = function (crop, day) { return anySeason || cropInSeason(crop, day); };
  var plantBag = L.plantBag;
  L.plantBag = function (s, idxs, slotIndex) {
    var slot = s.inv[slotIndex], item = slot && C.ITEMS[slot.id];
    var free = idxs.filter(function (idx) { return !(s.soil[idx] && s.soil[idx].sp); });
    var r;
    if (item && item.kind === 'seed' && !cropInSeason(item.crop, s.day)) {
      var inside = free.filter(function (idx) { return L.inGreenhouse(s, idx); });
      if (!inside.length) return plantBag(s, free, slotIndex);
      anySeason = true;
      try { r = plantBag(s, inside, slotIndex); } finally { anySeason = false; }
      free = inside;
    } else r = plantBag(s, free, slotIndex);
    if (typeof r === 'number') { var now = L.nowMin(); free.forEach(function (idx) { L.autoWater(s, idx, now); }); }
    return r;
  };
  // Can a seed of this crop be planted on any of these tiles today (the season, or a greenhouse tile)?
  L.canPlantHere = function (s, crop, idxs) {
    return cropInSeason(crop, s.day) || idxs.some(function (idx) { return L.inGreenhouse(s, idx); });
  };

  // The night: no weeds sprout in a greenhouse; in the morning the sprinklers have watered everything they reach.
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    Object.keys(s.debris).forEach(function (k) { if (s.debris[k] === 'weed' && L.inGreenhouse(s, Number(k))) { delete s.debris[k]; if (r.weeds) r.weeds--; } });
    L.autoWaterAll(s);
    return r;
  };

  // ---------- the yard: a sprinkler on a Field Plot or the greenhouse ----------
  // The greenhouse: one only, 12,000G. (Moving a plot takes its soil along, sprinklers and fertilizer with it: 01-logicA.js.)
  var yardPrice = L.yardPrice;
  L.yardPrice = function (s, t) { return t === GH ? C.GREENHOUSE.price : yardPrice(s, t); };
  // Putting a plot away: its sprinklers go back into the bag first ('sprinklers' if the bag can't hold them all: those
  // that did not fit stay on it, and so does the plot).
  var storeYard = L.storeYard;
  L.storeYard = function (s, i) {
    var it = s.yard.items[i], type = it && O.types[it.t];
    if (!type || type.kind !== 'plot') return storeYard(s, i);
    var tiles = [];
    for (var y = it.y; y < it.y + type.h; y++) for (var x = it.x; x < it.x + type.w; x++) tiles.push(y * W() + x);
    if (tiles.some(function (k) { return s.soil[k] && s.soil[k].c; })) return storeYard(s, i); // ('crops': it stays)
    var full = false;
    tiles.forEach(function (k) { if (s.soil[k] && s.soil[k].sp && L.pickUpSprinkler(s, k) === 'full') full = true; });
    return full ? 'sprinklers' : storeYard(s, i);
  };
  // Soil that goes (a plot put away, a bad save): a sprinkler on it comes back into the bag (or Storage).
  var rescue = function (s, before) {
    before.forEach(function (p) {
      if (s.soil[p.idx] && s.soil[p.idx].sp) return;
      var id = C.SPRINKLERS[p.tier].id;
      if (L.addItem(s, id, 1) > 0 && s.store) {
        for (var k = 0; k < s.store.length; k++) if (!s.store[k]) { s.store[k] = { id: id, n: 1 }; return; }
      }
    });
  };
  if (L.cleanSoil) {
    var cleanSoil = L.cleanSoil;
    L.cleanSoil = function (s, farm) { var before = L.sprinklers(s), n = cleanSoil(s, farm); rescue(s, before); return n; };
  }

  // ---------- save: 'ft' ----------
  // { s: [tile, tier + 1, ...] sprinklers, f: [tile, level, ...] fertilizer, q: [bag slot, quality, ...],
  //   k: [storage slot, quality, ...], b: [[id, n, quality], ...] Silver and Gold lots in the shipping box (not in 'b'),
  //   h: [shelf, quality, ...] } — only what there is; a farm with none of it saves no 'ft'.
  var pairs = function (list, key) {
    var out = [];
    (list || []).forEach(function (x, i) { if (x && x[key]) out.push(i, x[key]); });
    return out;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), ft = {}, sp = [], f = [];
    Object.keys(s.soil).forEach(function (k) {
      var t = s.soil[k];
      if (t.sp) sp.push(Number(k), t.sp);
      if (t.f) f.push(Number(k), t.f);
    });
    if (sp.length) ft.s = sp;
    if (f.length) ft.f = f;
    var q = pairs(s.inv, 'q'), kq = pairs(s.store, 'q'), hq = pairs(s.shelves, 'q');
    if (q.length) ft.q = q;
    if (kq.length) ft.k = kq;
    if (hq.length) ft.h = hq;
    var bq = s.box.filter(function (b) { return b.q; });
    if (bq.length && Array.isArray(o.b)) {
      ft.b = bq.map(function (b) { return [b.id, b.n, b.q]; });
      o.b = o.b.filter(function (e, k) { return !(s.box[k] && s.box[k].q); });
    }
    if (Object.keys(ft).length) o.ft = ft;
    return o;
  };
  var each = function (list, fn) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i + 1 < list.length; i += 2) fn(num(list[i], 1e6), num(list[i + 1], 99));
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var ft = o.ft && typeof o.ft === 'object' ? o.ft : {};
    each(ft.s, function (k, v) { if (s.soil[k] && v >= 1 && v <= C.SPRINKLERS.length && !s.soil[k].c) { s.soil[k].sp = v; s.soil[k].w = 0; } });
    each(ft.f, function (k, v) { if (s.soil[k] && !s.soil[k].sp && v >= 1 && v <= C.FERTS.length) s.soil[k].f = v; });
    var mark = function (list, k, v) { if (list && list[k] && v >= 1 && v < Q.names.length && C.ITEMS[list[k].id] && C.ITEMS[list[k].id].sell) list[k].q = v; };
    each(ft.q, function (k, v) { mark(s.inv, k, v); });
    each(ft.k, function (k, v) { mark(s.store, k, v); });
    each(ft.h, function (k, v) { mark(s.shelves, k, v); });
    (Array.isArray(ft.b) ? ft.b : []).slice(0, 200).forEach(function (e) {
      if (!Array.isArray(e) || !C.ITEMS[e[0]] || !C.ITEMS[e[0]].sell) return;
      var q = num(e[2], Q.names.length - 1), n = num(e[1], 1e4);
      if (n) s.box.push(q ? { id: e[0], n: n, q: q } : { id: e[0], n: n });
    });
    L.autoWaterAll(s);
    return s;
  };
})(window.Farm = window.Farm || {});
