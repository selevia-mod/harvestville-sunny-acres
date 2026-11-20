// Bram's farm machines, the rules (numbers in 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-machines.js; the world 19zzz...-machines.js).
// Every tile a machine works goes through the same function the hand tools use (L.till, L.clearDebris / L.clearDeco,
// L.plantBag, L.harvest), so every rule of the field still holds: the season and the greenhouse, sprinklers, fertilizer,
// crop quality, golden crops, crop stars, Double Drops, skills XP (inside L.skillAct, as the farmer's own work).
//  - Owning one: made at Bram's Forge (s.mk, a bit each) and its item, held in a bag slot (or put away in Storage) like a
//    tool. A made one missing from the bag and Storage can be had back at the Forge, free: never lost.
//  - Energy: L.mkEnergy, 8 tiles' worth of the cheapest way by hand (one swing a tile, or one charged swing over them all).
//  - The Harvester's crops: plain farm crops into the Silo while it has room, then the bag, then the basket; a Silver or
//    Gold one keeps its star in the bag. A tile is only picked when there is room for all it can give (a quality crop:
//    room in the bag), so nothing is ever lost: what has no room stays ripe in the field.
//  - Driven (owner, 20 Nov 2026): it works a strip of M.strip tiles across its way (L.mkStrip) as it goes, through the
//    same rules; the Tractor's energy is paid as it goes, 8/9 of the hand's over the whole drive (L.mkDue carries the
//    part of a point not paid yet). The Harvester's crops go into its tank (L.mkTankPick, M.tank crops) and are unloaded
//    at the Silo (L.mkUnload): plain farm crops into the Silo, the rest into the bag; what has no room stays in the tank.
// The save: 'mk' = bits (1 Tractor, 2 Seeder, 4 Harvester made; 8 the tour seen; 16 the driving tour seen); only when
// not 0, an old save has none. 'mkt' = the Harvester's tank, [[item, quality, n]], only when not empty.
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, M = C.MACHINES, K = C.MACHINE_KINDS;
  if (!M) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var bit = function (k) { return 1 << K.indexOf(k); };
  var TOUR = 1 << K.length, DRIVE_TOUR = TOUR << 1, ALL = (DRIVE_TOUR << 1) - 1;
  var act = function (s, fn) { return L.skillAct ? L.skillAct(s, fn) : fn(); };

  // ---------- owning one ----------
  L.mkHeld = function (s) { var h = s && L.held(s), d = h && C.ITEMS[h.id]; return d && d.machine ? d.machine : null; };
  L.mkMade = function (s, k) { return K.indexOf(k) >= 0 && !!((s.mk || 0) & bit(k)); };
  L.mkHave = function (s, k) { return L.hasItem(s, k) || (s.store || []).some(function (x) { return x && x.id === k; }); };
  L.mkLost = function (s, k) { return L.mkMade(s, k) && !L.mkHave(s, k); };
  L.mkTourSeen = function (s) { return !!((s.mk || 0) & TOUR); };
  L.mkTourTake = function (s) { s.mk = (s.mk || 0) | TOUR | DRIVE_TOUR; }; // (it tells of driving too)
  L.mkDriveTourSeen = function (s) { return !!((s.mk || 0) & DRIVE_TOUR); };
  L.mkDriveTourTake = function (s) { s.mk = (s.mk || 0) | DRIVE_TOUR; };
  // Bram makes it: 'ok' | 'have' | 'gold' | 'lumber' | 'needs' | 'full' (the bag) | 'none'
  L.mkMake = function (s, k) {
    var R = M[k];
    if (K.indexOf(k) < 0) return 'none';
    if (L.mkMade(s, k) || L.mkHave(s, k)) return 'have';
    if (s.gold < R.gold) return 'gold';
    if ((s.lumber || 0) < R.lumber) return 'lumber';
    if (!L.hasNeeds(s, R.needs)) return 'needs';
    if (!L.canAdd(s, k, 1)) return 'full';
    s.gold -= R.gold;
    s.lumber -= R.lumber;
    L.takeNeeds(s, R.needs);
    L.addItem(s, k, 1);
    s.mk = (s.mk || 0) | bit(k);
    return 'ok';
  };
  // a made one that is in neither the bag nor Storage, back in the bag: 'ok' | 'have' | 'full'
  L.mkBack = function (s, k) {
    if (!L.mkLost(s, k)) return 'have';
    return L.addItem(s, k, 1) ? 'full' : 'ok';
  };

  // ---------- where it works ----------
  // The tiles from (fx, fy), the tile ahead, facing (dx, dy): the 3x3 block ahead (as L.chargeTiles' level 2), or the row.
  L.mkTiles = function (fx, fy, dx, dy, row) {
    var depth = row ? M.row : 3, half = row ? 0 : 1, out = [];
    for (var d = 0; d < depth; d++) for (var w = -half; w <= half; w++) out.push([fx + dx * d - dy * w, fy + dy * d + dx * w]);
    return out;
  };

  // ---------- energy: never more than by hand ----------
  // counts: { tool: tiles } of the hand work it stands for
  L.mkHandEnergy = function (s, counts) {
    var e = 0;
    Object.keys(counts).forEach(function (t) { var n = counts[t]; if (n > 0) e += Math.min(L.toolEnergy(s, t, n), n * L.toolEnergy(s, t, 1)); });
    return e;
  };
  L.mkEnergy = function (s, counts) { var h = L.mkHandEnergy(s, counts); return h ? Math.max(1, Math.floor(h * M.save + 1e-9)) : 0; };

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
  L.mkTillPlan = function (s, plan) {
    var counts = { hoe: 0 }, todo = [];
    (plan || []).forEach(function (p) {
      var c = clearOk(s, p), t = (c || !p.clear) && tillOk(s, p, c);
      if (c) { var tool = C.DEBRIS[p.clear].tool; counts[tool] = (counts[tool] || 0) + 1; }
      if (t) counts.hoe++;
      if (c || t) todo.push({ idx: p.idx, clear: c ? p.clear : null, deco: c && p.deco, till: t });
    });
    return { todo: todo, counts: counts, energy: L.mkEnergy(s, counts) };
  };
  // due (driven): { c: the part of a point carried over }, paid as it goes (L.mkDue)
  L.mkTill = function (s, plan, due) {
    var w = L.mkTillPlan(s, plan);
    if (!w.todo.length) return 'none';
    var d = due ? L.mkDue(s, w.counts, due) : null, cost = d ? d.pay : w.energy;
    if (cost && !L.spendEnergy(s, cost)) return 'tired';
    if (d) due.c = d.left;
    var r = { till: 0, clear: 0, lumber: 0, stone: 0, energy: cost, cleared: [], tilled: [] };
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
  L.mkSeedSlot = function (s, id) {
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
  L.mkPlant = function (s, idxs, slot) { return act(s, function () { return L.plantBag(s, idxs, slot); }); };

  // ---------- the Harvester ----------
  var basketRoom = function (s, id) { return Math.max(0, 999 - ((s.basket || {})[id] || 0)); };
  // room for all one tile of `id` (its first one at quality q) can give
  L.mkRoom = function (s, id, q) {
    if (q && !L.canAddQ(s, id, 1, q)) return false;
    var room = basketRoom(s, id) + (L.isFarmCrop && L.isFarmCrop(id) ? Math.max(0, L.siloCap(s) - L.siloCount(s)) : 0);
    return room >= M.most || L.canAdd(s, id, M.most - room);
  };
  // Picks one tile with `pick` (L.harvest: every rule of picking by hand) into a bag of its own for that moment, then puts
  // what it gave where it goes. out (optional) counts { silo, bag, basket }. The item id, or '!notripe' / '!full'.
  L.mkPick = function (s, idx, pick, out) {
    var t = s.soil[idx];
    if (!L.isRipe(t) || C.CROPS[t.c].sickle) return '!notripe';
    var id = C.CROPS[t.c].item, q = !s.isVisit && L.cropGrade ? L.cropGrade(s, idx) : 0;
    if (!L.mkRoom(s, id, q)) return '!full';
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
  L.mkHarvest = function (s, idxs) {
    var out = { n: 0, silo: 0, bag: 0, basket: 0, items: {}, picked: [], full: 0 };
    act(s, function () {
      idxs.forEach(function (idx) {
        var got = L.mkPick(s, idx, null, out);
        if (got === '!full') out.full++;
        if (got[0] === '!') return;
        out.n++;
        out.items[got] = (out.items[got] || 0) + 1;
        out.picked.push(idx);
      });
    });
    return out;
  };

  // ---------- driven ----------
  // the M.strip tiles side by side across its way, (x, y) in the middle, going (dx, dy)
  L.mkStrip = function (x, y, dx, dy) {
    var h = (M.strip - 1) / 2, out = [];
    for (var w = -h; w <= h; w++) out.push([x - dy * w, y + dx * w]);
    return out;
  };
  // what to pay now for this work: { pay, left } (left: carried to the next, so a whole drive costs 8/9 of the hand's)
  L.mkDue = function (s, counts, due) {
    var e = L.mkHandEnergy(s, counts) * M.save + ((due && due.c) || 0), pay = Math.floor(e + 1e-9);
    return { pay: pay, left: Math.max(0, e - pay) };
  };
  // the Harvester's tank
  L.mkTankN = function (s) { return (s.mkTank || []).reduce(function (a, x) { return a + x[2]; }, 0); };
  L.mkTankFull = function (s) { return L.mkTankN(s) + M.most > M.tank; };
  var tankAdd = function (s, id, q, n) {
    s.mkTank = s.mkTank || [];
    for (var i = 0; i < s.mkTank.length; i++) if (s.mkTank[i][0] === id && s.mkTank[i][1] === q) { s.mkTank[i][2] += n; return; }
    s.mkTank.push([id, q, n]);
  };
  // Picks one tile with `pick` (L.harvest) into the tank: only with room for all a tile can give (M.most), so nothing
  // is ever lost. out (optional) counts { n }. The item id, or '!notripe' / '!full'.
  L.mkTankPick = function (s, idx, pick, out) {
    var t = s.soil[idx];
    if (!L.isRipe(t) || C.CROPS[t.c].sickle) return '!notripe';
    if (L.mkTankFull(s)) return '!full';
    var bag = s.inv, tmp = [null, null, null, null, null, null, null, null], got;
    s.inv = tmp;
    try { got = (pick || L.harvest)(s, idx); } finally { s.inv = bag; }
    tmp.forEach(function (x) {
      if (!x) return;
      tankAdd(s, x.id, x.q || 0, x.n);
      if (out) out.n = (out.n || 0) + x.n;
    });
    return got;
  };
  // At the Silo: plain farm crops into the Silo, the rest (Silver, Gold, anything else) into the bag; what has no room
  // stays in the tank. { silo, bag, left }
  L.mkUnload = function (s) {
    var r = { silo: 0, bag: 0, left: 0 }, keep = [];
    (s.mkTank || []).forEach(function (x) {
      var id = x[0], q = x[1], n = x[2], k;
      if (!q && L.siloPut && L.isFarmCrop(id)) { k = n - L.siloPut(s, id, n); r.silo += k; n -= k; }
      else { k = n - (q ? L.addItemQ(s, id, n, q) : L.addItem(s, id, n)); r.bag += k; n -= k; }
      if (n > 0) { keep.push([id, q, n]); r.left += n; }
    });
    s.mkTank = keep;
    return r;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) { var s = newState(info); s.mk = 0; s.mkTank = []; return s; };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.mk) o.mk = s.mk & ALL;
    if (s.mkTank && s.mkTank.length) o.mkt = s.mkTank.map(function (x) { return [x[0], x[1], x[2]]; });
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.mk = int(o.mk, 0, ALL, 0);
    s.mkTank = [];
    if (Array.isArray(o.mkt)) o.mkt.forEach(function (x) {
      if (!Array.isArray(x) || typeof x[0] !== 'string' || !C.ITEMS.hasOwnProperty(x[0])) return;
      var n = int(x[2], 0, 999, 0);
      if (n) tankAdd(s, x[0], int(x[1], 0, 3, 0), n);
    });
    return s;
  };
})(window.Farm = window.Farm || {});
