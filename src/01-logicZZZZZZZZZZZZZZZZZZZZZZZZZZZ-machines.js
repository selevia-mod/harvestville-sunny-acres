// Bram's farm machines, the rules (numbers in 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-machines.js; the world 19zzz...-machines.js).
// Every tile a machine works goes through the same function the hand tools use (L.till, L.clearDebris / L.clearDeco,
// L.plantBag, L.harvest), so every rule of the field still holds: the season and the greenhouse, sprinklers, fertilizer,
// crop quality, golden crops, crop stars, Double Drops, skills XP (inside L.skillAct, as the farmer's own work).
//  - Owning one: made at Bram's Forge (s.mc, a bit each) and its item, held in a bag slot (or put away in Storage) like a
//    tool. A made one missing from the bag and Storage can be had back at the Forge, free: never lost.
//  - Energy: L.mcEnergy, 8 tiles' worth of the cheapest way by hand (one swing a tile, or one charged swing over them all).
//  - The Harvester's crops: plain farm crops into the Silo while it has room, then the bag, then the basket; a Silver or
//    Gold one keeps its star in the bag. A tile is only picked when there is room for all it can give (a quality crop:
//    room in the bag), so nothing is ever lost: what has no room stays ripe in the field.
// The save: 'mc' = bits (1 Tractor, 2 Seeder, 4 Harvester made; 8 the tour seen); only when not 0, an old save has none.
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, M = C.MACHINES, K = C.MACHINE_KINDS;
  if (!M) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var bit = function (k) { return 1 << K.indexOf(k); };
  var TOUR = 1 << K.length, ALL = (TOUR << 1) - 1;
  var act = function (s, fn) { return L.skillAct ? L.skillAct(s, fn) : fn(); };

  // ---------- owning one ----------
  L.mcHeld = function (s) { var h = s && L.held(s), d = h && C.ITEMS[h.id]; return d && d.machine ? d.machine : null; };
  L.mcMade = function (s, k) { return K.indexOf(k) >= 0 && !!((s.mc || 0) & bit(k)); };
  L.mcHave = function (s, k) { return L.hasItem(s, k) || (s.store || []).some(function (x) { return x && x.id === k; }); };
  L.mcLost = function (s, k) { return L.mcMade(s, k) && !L.mcHave(s, k); };
  L.mcTourSeen = function (s) { return !!((s.mc || 0) & TOUR); };
  L.mcTourTake = function (s) { s.mc = (s.mc || 0) | TOUR; };
  // Bram makes it: 'ok' | 'have' | 'gold' | 'lumber' | 'needs' | 'full' (the bag) | 'none'
  L.mcMake = function (s, k) {
    var R = M[k];
    if (K.indexOf(k) < 0) return 'none';
    if (L.mcMade(s, k) || L.mcHave(s, k)) return 'have';
    if (s.gold < R.gold) return 'gold';
    if ((s.lumber || 0) < R.lumber) return 'lumber';
    if (!L.hasNeeds(s, R.needs)) return 'needs';
    if (!L.canAdd(s, k, 1)) return 'full';
    s.gold -= R.gold;
    s.lumber -= R.lumber;
    L.takeNeeds(s, R.needs);
    L.addItem(s, k, 1);
    s.mc = (s.mc || 0) | bit(k);
    return 'ok';
  };
  // a made one that is in neither the bag nor Storage, back in the bag: 'ok' | 'have' | 'full'
  L.mcBack = function (s, k) {
    if (!L.mcLost(s, k)) return 'have';
    return L.addItem(s, k, 1) ? 'full' : 'ok';
  };

  // ---------- where it works ----------
  // The tiles from (fx, fy), the tile ahead, facing (dx, dy): the 3x3 block ahead (as L.chargeTiles' level 2), or the row.
  L.mcTiles = function (fx, fy, dx, dy, row) {
    var depth = row ? M.row : 3, half = row ? 0 : 1, out = [];
    for (var d = 0; d < depth; d++) for (var w = -half; w <= half; w++) out.push([fx + dx * d - dy * w, fy + dy * d + dx * w]);
    return out;
  };

  // ---------- energy: never more than by hand ----------
  // counts: { tool: tiles } of the hand work it stands for
  L.mcHandEnergy = function (s, counts) {
    var e = 0;
    Object.keys(counts).forEach(function (t) { var n = counts[t]; if (n > 0) e += Math.min(L.toolEnergy(s, t, n), n * L.toolEnergy(s, t, 1)); });
    return e;
  };
  L.mcEnergy = function (s, counts) { var h = L.mcHandEnergy(s, counts); return h ? Math.max(1, Math.floor(h * M.save + 1e-9)) : 0; };

  // ---------- the Tractor ----------
  // plan: [{ idx, clear: a debris kind or null, deco: 1 for an old decoration of the map, till: 1 when the world says the
  // tile is field soil }]. Returns 'none' | 'tired' | { till, clear, lumber, stone, energy, cleared: [idx], tilled: [idx] }.
  var clearOk = function (s, p) {
    if (!p.clear || M.clears.indexOf(p.clear) < 0 || !C.DEBRIS[p.clear]) return false;
    return p.deco ? !s.debris[p.idx] && L.decoGone(s).indexOf(p.idx) < 0 : s.debris[p.idx] === p.clear;
  };
  var tillOk = function (s, p, cleared) {
    var t = s.soil[p.idx];
    return !!p.till && (cleared || !s.debris[p.idx]) && (!t || (!t.sp && L.isWithered(t)));
  };
  L.mcTillPlan = function (s, plan) {
    var counts = { hoe: 0 }, todo = [];
    (plan || []).forEach(function (p) {
      var c = clearOk(s, p), t = (c || !p.clear) && tillOk(s, p, c);
      if (c) { var tool = C.DEBRIS[p.clear].tool; counts[tool] = (counts[tool] || 0) + 1; }
      if (t) counts.hoe++;
      if (c || t) todo.push({ idx: p.idx, clear: c ? p.clear : null, deco: c && p.deco, till: t });
    });
    return { todo: todo, counts: counts, energy: L.mcEnergy(s, counts) };
  };
  L.mcTill = function (s, plan) {
    var w = L.mcTillPlan(s, plan);
    if (!w.todo.length) return 'none';
    if (!L.spendEnergy(s, w.energy)) return 'tired';
    var r = { till: 0, clear: 0, lumber: 0, stone: 0, energy: w.energy, cleared: [], tilled: [] };
    act(s, function () {
      w.todo.forEach(function (p) {
        if (p.clear) {
          var got = p.deco ? L.clearDeco(s, p.idx, p.clear) : L.clearDebris(s, p.idx);
          if (got) { r.clear++; r.lumber += got.lumber; r.stone += got.stone; r.cleared.push(p.idx); }
        }
        if (p.till) { var t = L.till(s, p.idx); if (t === 'ok' || t === 'cleared') { r.till++; r.tilled.push(p.idx); } }
      });
    });
    return r;
  };

  // ---------- the Seeder ----------
  // The seed packet it plants: the one you held last (`id`) while it is in the bag, else the bag's first. A slot, or -1.
  L.mcSeedSlot = function (s, id) {
    var first = -1;
    for (var i = 0; i < s.inv.length; i++) {
      var x = s.inv[i], d = x && C.ITEMS[x.id];
      if (!d || d.kind !== 'seed') continue;
      if (x.id === id) return i;
      if (first < 0) first = i;
    }
    return first;
  };
  // the hand's seed bag on these tiles: how many were planted, or 'noseed' / 'season' / 'nospace' (no energy, as by hand)
  L.mcPlant = function (s, idxs, slot) { return act(s, function () { return L.plantBag(s, idxs, slot); }); };

  // ---------- the Harvester ----------
  var basketRoom = function (s, id) { return Math.max(0, 999 - ((s.basket || {})[id] || 0)); };
  // room for all one tile of `id` (its first one at quality q) can give
  L.mcRoom = function (s, id, q) {
    if (q && !L.canAddQ(s, id, 1, q)) return false;
    var room = basketRoom(s, id) + (L.isFarmCrop && L.isFarmCrop(id) ? Math.max(0, L.siloCap(s) - L.siloCount(s)) : 0);
    return room >= M.most || L.canAdd(s, id, M.most - room);
  };
  // Picks one tile with `pick` (L.harvest: every rule of picking by hand) into a bag of its own for that moment, then puts
  // what it gave where it goes. out (optional) counts { silo, bag, basket }. The item id, or '!notripe' / '!full'.
  L.mcPick = function (s, idx, pick, out) {
    var t = s.soil[idx];
    if (!L.isRipe(t) || C.CROPS[t.c].sickle) return '!notripe';
    var id = C.CROPS[t.c].item, q = !s.isVisit && L.cropGrade ? L.cropGrade(s, idx) : 0;
    if (!L.mcRoom(s, id, q)) return '!full';
    out = out || {};
    var bag = s.inv, tmp = [null, null, null, null, null, null, null, null], got;
    s.inv = tmp;
    try { got = (pick || L.harvest)(s, idx); } finally { s.inv = bag; }
    var add = function (k, n) { out[k] = (out[k] || 0) + n; };
    tmp.forEach(function (x) {
      if (!x) return;
      var n = x.n, k;
      if (!x.q && L.siloPut && L.isFarmCrop(x.id)) { k = n - L.siloPut(s, x.id, n); add('silo', k); n -= k; }
      if (n > 0) { k = n - (x.q ? L.addItemQ(s, x.id, n, x.q) : L.addItem(s, x.id, n)); add('bag', k); n -= k; }
      if (n > 0) { s.basket = s.basket || {}; s.basket[x.id] = (s.basket[x.id] || 0) + n; add('basket', n); }
    });
    return got;
  };
  // Every ripe crop on these tiles: { n, silo, bag, basket, items: { id: n }, picked: [idx], full: tiles left for room }
  L.mcHarvest = function (s, idxs) {
    var out = { n: 0, silo: 0, bag: 0, basket: 0, items: {}, picked: [], full: 0 };
    act(s, function () {
      idxs.forEach(function (idx) {
        var got = L.mcPick(s, idx, null, out);
        if (got === '!full') out.full++;
        if (got[0] === '!') return;
        out.n++;
        out.items[got] = (out.items[got] || 0) + 1;
        out.picked.push(idx);
      });
    });
    return out;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) { var s = newState(info); s.mc = 0; return s; };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); if (s.mc) o.mc = s.mc & ALL; return o; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s) s.mc = int(o.mc, 0, ALL, 0);
    return s;
  };
})(window.Farm = window.Farm || {});
