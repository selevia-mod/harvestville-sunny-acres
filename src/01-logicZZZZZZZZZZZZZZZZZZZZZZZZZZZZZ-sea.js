// Sea trips, the rules (boats step 1, owner 18 Nov 2026; numbers in C.SEA, 00-zzz...z-sea.js; the world 19zzz...z-sea.js).
//  - A trip (s.sea.t): bought from Kapitana Marisol at berth 1 (3,000 Gold, or her free one a day at 8 hearts); 10 real
//    minutes from its start (L.clock), then the boat comes back by itself. Riding costs no energy; a cast costs what a
//    river cast does (C.FISH_ENERGY, spent by the world's own startFishing).
//  - The spots: 4 picked from C.SEA.slots, new ones every 90 s, worked out from the trip's start (the same on every
//    phone, so friends aboard see the same spots); a 5th, fixed, at 6 hearts with Marisol.
//  - A bite (L.seaRoll): 1 in 10 Seaweed; else the fish table; each extra player aboard +10% chance of one size bigger.
//  - The Marlin: out after 5 minutes, at the spot of the moment; at most one a trip; lost, it comes back once, 60 s later.
//  - Landing a sea fish weighs it (as the river's) and keeps the biggest of each and how many (the sea's fish book).
//  - The crate's Capiz Shells (1-3, rolled when the trip starts) come with the end of the trip, any end: back early, the
//    time up, or the game closed mid-trip (the save puts you on the pier; the world ends the trip as it opens).
//  - The sea dishes' powers: the crop potions' clocks (s.ptn 'charge', 'walk', 'shots'): a new one replaces, never adds.
// The save: 'sv' = [the trip [start ms, shells, marlin caught, marlin lost, lost at ms, fish, seaweed, Gold paid] or 0,
// biggest grams by C.SEA.fish, how many by C.SEA.fish, [trips, seaweed, capiz, free ticket day + 1, Marisol's task, its
// kg done], friends aboard [[id, name, friendship, day + 1], ...]], only when there is anything (an old save has none).
// A save made at sea says the Manila pier (the trip is over when the game opens again).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var S = C.SEA;
  if (!S || !S.on) return;
  var MIN = 60000, T = C.TILE;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var KG = S.kg = {};
  S.fish.forEach(function (f) { KG[f[0]] = f[5]; });
  var BITE = S.fish.filter(function (f) { return f[2] > 0; });
  var rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  L.seaIs = function (id) { return S.ids.indexOf(id) >= 0; };
  L.seaNew = function () { return { t: null, b: {}, c: {}, tr: 0, w: 0, cp: 0, fd: 0, ti: 0, tk: 0, fr: [] }; };
  L.sea = function (s) { return s.sea || (s.sea = L.seaNew()); };
  L.seaKg = function (id, size) { return Math.max(0.1, Math.round((KG[id] || 1) * size * 10) / 10); };

  // ---------- the trip ----------
  L.seaLeft = function (t, now) { return t ? Math.max(0, t.a + S.mins * MIN - now) : 0; };
  L.seaBellAt = function (t) { return t.a + (S.mins - S.bell) * MIN; };
  L.seaFreeOk = function (s) { return !!(L.mnHas && L.mnHas(s, 'mn_marisol', S.hearts.free)) && L.sea(s).fd !== s.day + 1; };
  L.seaNearOk = function (s) { return !!(L.mnHas && L.mnHas(s, 'mn_marisol', S.hearts.spot)); };
  // A ticket: { ok, paid } or { why: 'busy' (a trip on) | 'rod' | 'gold' }. free: Marisol's one a day (8 hearts).
  L.seaStart = function (s, now, free, rnd) {
    var v = L.sea(s);
    if (v.t) return { why: 'busy' };
    if (!L.hasRod(s)) return { why: 'rod' };
    free = !!free && L.seaFreeOk(s);
    if (!free && s.gold < S.ticket) return { why: 'gold' };
    if (free) v.fd = s.day + 1;
    else s.gold -= S.ticket;
    var n = S.shells[1] - S.shells[0] + 1;
    v.t = { a: now, sh: S.shells[0] + Math.min(n - 1, Math.floor((rnd || Math.random)() * n)), mc: 0, ml: 0, lt: 0, n: 0, w: 0, p: free ? 0 : S.ticket };
    return { ok: true, paid: v.t.p };
  };
  // The end (any end): the crate's shells into the bag (what does not fit waits in the basket). null when no trip is on.
  L.seaEnd = function (s, now) {
    var v = L.sea(s), t = v.t;
    if (!t) return null;
    v.t = null;
    v.tr++;
    v.cp += t.sh;
    var left = L.addItem(s, 'capiz', t.sh);
    if (left > 0) { s.basket = s.basket || {}; s.basket.capiz = Math.min(999, (s.basket.capiz || 0) + left); }
    return { fish: t.n, weed: t.w, shells: t.sh, basket: left, marlin: !!t.mc, mins: Math.max(0, Math.min(S.mins, Math.round((now - t.a) / MIN))) };
  };

  // ---------- the spots ----------
  L.seaSlot = function (t, now) { return Math.max(0, Math.floor((now - t.a) / (S.moveSec * 1000))); };
  L.seaSpots = function (t, now, near) {
    var r = rng((Math.floor(t.a / 1000) ^ (L.seaSlot(t, now) * 7919)) >>> 0), pool = S.slots.slice(), out = [];
    for (var i = 0; i < S.spots && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    if (near) out.push(S.near);
    return out;
  };
  // which spot a cast at tile (x, y) reaches (a spot is its tile and one each side along the rail), or -1
  L.seaSpotAt = function (spots, x, y) {
    var d = S.deck;
    for (var i = 0; i < spots.length; i++) {
      var p = spots[i], side = p[0] < d[0] || p[0] >= d[0] + d[2];
      if (side ? x === p[0] && Math.abs(y - p[1]) <= 1 : y === p[1] && Math.abs(x - p[0]) <= 1) return i;
    }
    return -1;
  };

  // ---------- the Marlin ----------
  L.seaMarlinOut = function (t, now) {
    return !!t && !t.mc && t.ml < S.marlin.tries && now - t.a >= S.marlin.after * MIN && (!t.ml || now - t.lt >= S.marlin.back * 1000) && L.seaLeft(t, now) > 0;
  };
  L.seaMarlinSpot = function (t, now) { return L.seaSlot(t, now) % S.spots; }; // (one of the 4 that move)
  L.seaMarlinLost = function (s, now) { var t = L.sea(s).t; if (t && !t.mc) { t.ml = Math.min(S.marlin.tries, t.ml + 1); t.lt = now; } };
  L.seaMarlinZone = function (aboard) { return Math.min(0.4, S.marlin.zone + S.marlin.wider * (L.seaAboard(aboard) - 1)); };

  // ---------- a bite ----------
  L.seaAboard = function (n) { return Math.max(1, Math.min(S.most, Math.floor(Number(n)) || 1)); };
  L.seaBonus = function (aboard) { return Math.round(S.group * (L.seaAboard(aboard) - 1) * 100) / 100; };
  L.seaRoll = function (rnd, aboard) {
    if (rnd() < S.snag) return 'seaweed';
    var u = rnd(), acc = 0, i = 0;
    for (; i < BITE.length - 1; i++) { acc += BITE[i][2]; if (u < acc) break; }
    if (i < BITE.length - 1 && rnd() < L.seaBonus(aboard)) i++; // (the group bonus: one size bigger)
    return BITE[i][0];
  };

  // ---------- landing: weighed, the biggest of each kept; seaweed ----------
  var landFish = L.landFish;
  L.landFish = function (s, id, rnd) {
    var v;
    if (id === 'seaweed') {
      if (L.addItem(s, 'seaweed', 1) > 0) return '!full';
      L.seaWeed(s);
      s.lastFish = null;
      return 'seaweed';
    }
    if (!L.seaIs(id)) return landFish.apply(this, arguments);
    var got = landFish.apply(this, arguments); // (the bag, the count, the skill's XP; no weight there: C.FISH_KG has no sea fish)
    s.lastFish = null;
    if (got !== id) return got;
    var size = L.fishSize(rnd || Math.random), kg = L.seaKg(id, size), g = Math.round(kg * 1000), old;
    v = L.sea(s);
    old = v.b[id] || 0;
    if (g > old) v.b[id] = g;
    v.c[id] = (v.c[id] || 0) + 1;
    if (v.t) { v.t.n++; if (id === 'marlin') v.t.mc = 1; }
    var task = L.seaTask(s);
    if (task[0] === 'kg' && task[1] === id && kg >= task[2]) v.tk = 1;
    s.lastFish = { id: id, kg: kg, giant: L.fishGiant(size), record: !!old && g > old, sea: true };
    return got;
  };
  L.seaWeed = function (s) { var v = L.sea(s); v.w++; if (v.t) v.t.w++; };
  // a clump floating by, scooped from the rail (free): 'ok' or 'full'
  L.seaScoop = function (s) {
    if (L.addItem(s, 'seaweed', 1) > 0) return 'full';
    L.seaWeed(s);
    return 'ok';
  };

  // ---------- Kapitana Marisol's sea tasks ----------
  L.seaTask = function (s) { return S.tasks[L.sea(s).ti % S.tasks.length]; };
  // { kind, id, n | kg, have, ready }
  L.seaTaskNow = function (s) {
    var t = L.seaTask(s), have = t[0] === 'bring' ? L.countItem(s, t[1]) : L.sea(s).tk;
    return { kind: t[0], id: t[1], n: t[2], have: have, ready: t[0] === 'bring' ? have >= t[2] : !!have };
  };
  // hand it over: 'ok' | 'missing'
  L.seaTaskDo = function (s) {
    var v = L.sea(s), t = L.seaTaskNow(s);
    if (!t.ready) return 'missing';
    if (t.kind === 'bring') L.removeItem(s, t.id, t.n);
    L.addFriend(s, 'mn_marisol', S.taskPts);
    s.gold += S.taskGold;
    v.ti = (v.ti + 1) % 1e6;
    v.tk = 0;
    return 'ok';
  };

  // ---------- friends aboard: +1 friendship, once a day each (30 kept) ----------
  L.seaFriend = function (s, id, name, day) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return false;
    var v = L.sea(s), key = id.toLowerCase(), f = v.fr.filter(function (x) { return x[0] === key; })[0];
    if (!f) { v.fr.push(f = [key, 'Farmer', 0, 0]); if (v.fr.length > 30) v.fr.sort(function (a, b) { return b[3] - a[3]; }).pop(); }
    f[1] = L.cleanText(name, 24) || f[1];
    if (f[3] === day + 1) return false;
    f[2] = Math.min(1e6, f[2] + 1);
    f[3] = day + 1;
    return true;
  };

  // ---------- the sea dishes: their powers on the potions' clocks (a new one replaces, never adds) ----------
  var eat = L.eat;
  L.eat = function (s, slotIndex) {
    var slot = s.inv[slotIndex], pw = slot && S.powers[slot.id];
    if (!pw || !pw.length) return eat.apply(this, arguments);
    var full = s.energy >= L.maxEnergy(s), r = full ? -2 : eat.apply(this, arguments), now = L.nowMin();
    if (full) L.removeAt(s, slotIndex, 1);
    s.ptn = s.ptn || {};
    pw.forEach(function (p) { s.ptn[p[0]] = now + p[1]; });
    return r;
  };

  // ---------- the Talipapa's fish vendor buys sea fish, at their price: { ok, n, gold } or { why: 'item' | 'none' } ----------
  L.seaSell = function (s, id, n) {
    if (!L.seaIs(id)) return { why: 'item' };
    var k = Math.min(int(n, 1, 1e6, 1), L.countItem(s, id));
    if (!(k > 0)) return { why: 'none' };
    k = L.removeItem(s, id, k);
    var gold = k * C.ITEMS[id].sell;
    s.gold += gold;
    if (s.stats) s.stats.earned = (s.stats.earned || 0) + gold;
    return { ok: true, n: k, gold: gold };
  };

  // (Sea Fertilizer is the Mixer's, but not Mang Danny's to sell: his shelves stay the four he has)
  var txItems = L.txItems;
  if (txItems) L.txItems = function (shop) { var out = txItems.apply(this, arguments); return shop === 'danny' ? out.filter(function (id) { return id !== 'fert_sea'; }) : out; };

  // ---------- the map: the deck (walkable, the boat's planks) on open water (solid, water: you fish from the rail) ----------
  L.seaMap = function (template) {
    var K = L.mapKit, sets = K.copySets(template, ['tiles', 'seasons', 'props']), tiles = sets.filter(function (t) { return t.name === 'tiles'; })[0];
    if (!tiles) throw new Error('L.seaMap: the template has no tiles sheet');
    var b = K.build(S.W, S.H, sets), d = S.deck, x, y;
    for (y = 0; y < S.H; y++) for (x = 0; x < S.W; x++) b.put(b.ground, x, y, tiles.firstgid + K.TT[x >= d[0] && x < d[0] + d[2] && y >= d[1] && y < d[1] + d[3] ? 'sand' : 'water']);
    b.point('deck', 'spawn', S.spawn[0], S.spawn[1], 'up');
    return b.done();
  };

  // ---------- where the boat ties up: berth 1 (a save made at sea is on the pier) ----------
  L.seaPier = function () { var b = C.MANILA.berths[0]; return { x: Math.round((b[0] + 0.5) * T), y: Math.round((b[1] + 1.6) * T), dir: 'up' }; };
  var R = C.ROUTES;
  if (R) {
    R.sea = {};
    Object.keys(R).forEach(function (m) { if (m !== 'sea') { R.sea[m] = null; R[m].sea = R[m].manila || null; } });
  }

  // ---------- the save ----------
  var trim = function (a) { while (a.length && !a[a.length - 1]) a.pop(); return a; };
  var newState = L.newState;
  L.newState = function () { var s = newState.apply(this, arguments); s.sea = L.seaNew(); return s; };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize.call(this, s && s.map === 'sea' ? Object.assign({}, s, { map: 'manila', player: L.seaPier() }) : s), v = s && s.sea;
    if (!v) return o;
    var t = v.t, b = trim(S.ids.map(function (id) { return v.b[id] || 0; })), c = trim(S.ids.map(function (id) { return v.c[id] || 0; }));
    var more = trim([v.tr, v.w, v.cp, v.fd, v.ti, v.tk]), fr = v.fr.map(function (f) { return f.slice(0, 4); });
    if (t || b.length || c.length || more.length || fr.length) o.sv = [t ? [t.a, t.sh, t.mc, t.ml, t.lt, t.n, t.w, t.p] : 0, b, c, more, fr];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize.apply(this, arguments);
    if (!s) return s;
    var v = s.sea = L.seaNew(), a = o && Array.isArray(o.sv) ? o.sv : null;
    if (!a) return s;
    var t = a[0], b = Array.isArray(a[1]) ? a[1] : [], c = Array.isArray(a[2]) ? a[2] : [], m = Array.isArray(a[3]) ? a[3] : [];
    if (Array.isArray(t) && int(t[0], 0, 1e15, 0) > 0) {
      v.t = { a: int(t[0], 1, 1e15, 1), sh: int(t[1], S.shells[0], S.shells[1], S.shells[0]), mc: t[2] ? 1 : 0, ml: int(t[3], 0, S.marlin.tries, 0), lt: int(t[4], 0, 1e15, 0),
        n: int(t[5], 0, 1e5, 0), w: int(t[6], 0, 1e5, 0), p: int(t[7], 0, 1e7, 0) };
    }
    S.ids.forEach(function (id, i) {
      var g = int(b[i], 0, Math.ceil(KG[id] * 16) * 100, 0), n = int(c[i], 0, 1e7, 0);
      if (g) v.b[id] = g;
      if (n) v.c[id] = n;
    });
    v.tr = int(m[0], 0, 1e7, 0);
    v.w = int(m[1], 0, 1e9, 0);
    v.cp = int(m[2], 0, 1e9, 0);
    v.fd = int(m[3], 0, 1e7, 0);
    v.ti = int(m[4], 0, 1e6, 0);
    v.tk = m[5] ? 1 : 0;
    (Array.isArray(a[4]) ? a[4] : []).slice(0, 30).forEach(function (f) {
      if (Array.isArray(f) && typeof f[0] === 'string' && /^[0-9a-f-]{36}$/i.test(f[0])) v.fr.push([f[0].toLowerCase(), L.cleanText(f[1], 24) || 'Farmer', int(f[2], 0, 1e6, 0), int(f[3], 0, 1e7, 0)]);
    });
    return s;
  };
})(window.Farm = window.Farm || {});
