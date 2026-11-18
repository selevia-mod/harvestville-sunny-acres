// The trucks and the barangay City Orders, the rules (steps 2 and 3 of the truck plan, owner 18 Nov 2026; numbers in
// C.TRUCKS, 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzz-trucks.js; the world 19zzz...z-trucks.js; the server supabase/farm_city_orders.sql).
//  - Three trucks at Bram's Forge (Pickup 300, Farm Truck 800, Big Truck 1,500): each needs Market Stars EARNED (a
//    threshold, never spent), gold, lumber and materials. One vehicle is in use (gm.use: 0 the cart, 1-3 a truck); a
//    bigger one made takes over. Switching moves the load with you: what the new one cannot hold stays parked in the old
//    one (gm.park) until it is unloaded or you switch back. Nothing in a vehicle is ever lost.
//  - A truck needs no horse: driven by you (the valley road, walked rules: L.manilaRoad) or by Mang Kardo (his trip as now).
//  - The City Order: one a week per barangay, Monday 8 AM to Sunday 7 PM Manila (L.coWeek), 4 crops Lily sells that week,
//    chosen by the week and the barangay (L.coOrder), 150 of each per 5 members. The server holds the shared progress and
//    caps each delivery; the game takes crops out of the vehicle only into a delivery waiting for its answer (gm.co.q:
//    saved, so an answer lost on the way is asked again with the same id), pays 2x the sell price for what the server
//    took and puts the rest back. No answer: it waits. "Not there" (the SQL not applied) or no: all of it goes back.
//  - Filled: +3 Market Stars to each who delivered, the barangay's first: a City Order Plaque (claimed from the server;
//    paid once a week: gm.co.p).
// The save, appended to 'gm': [8] = [trucks owned (bits), the vehicle in use, parked loads [vehicle, crop, quality, n, ...]],
// [9] = [the week of my deliveries (its Monday), the last week paid, mine [crop, n, ...], the waiting delivery [id, week,
// crop, Kardo 0/1, [crop, quality, n, ...]] or 0]; a trip for the City Order: its [2][5] = 1. An older save has none.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TR = C.TRUCKS;
  var G = C.GRAND_MARKET;
  if (!TR || !TR.on || !G) return;
  var V = TR.list, CO = TR.city, DAY = 864e5, MIN = 60000, MANILA = 8 * 3600e3;
  var ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var total = function (c) { var n = 0; for (var k in c) n += c[k]; return n; };
  var add = function (c, k, n) { if (n > 0) c[k] = (c[k] || 0) + n; };
  var crop = function (id) { return typeof id === 'string' && id.length > 0 && id.length <= 40; };
  // a crop's keys in a load, plain first, then Silver and Gold
  var keysOf = function (c, id) { return [0, 1, 2].map(function (q) { return L.gmKey(id, q); }).filter(function (k) { return c[k] > 0; }); };

  // ---------- the vehicles ----------
  var gmNew = L.gmNew;
  L.gmNew = function () { var g = gmNew.apply(this, arguments); g.veh = 0; g.use = 0; g.park = {}; g.co = null; return g; };
  L.trkOwns = function (s, i) { var g = s && s.gm; return !!g && (i === 0 ? !!g.cart : i > 0 && i < V.length && !!((g.veh >> (i - 1)) & 1)); };
  L.trkUse = function (s) { var u = s && s.gm ? s.gm.use | 0 : 0; return u > 0 && L.trkOwns(s, u) ? u : 0; };
  L.trkCapOf = function (i) { return i ? V[i].cap : G.cart.cap; };
  L.trkNameOf = function (i) { return i ? V[i].name : 'Horse Cart'; };
  L.trkCount = function (s) { var n = 0; for (var i = 0; i < V.length; i++) if (L.trkOwns(s, i)) n++; return n; };
  L.gmHasCart = function (s) { return L.trkCount(s) > 0; };
  L.gmCap = function (s) { return L.trkCapOf(L.trkUse(s)); };
  L.gmVehName = function (s) { return L.trkNameOf(L.trkUse(s)); };
  // what a vehicle holds: the one in use its cargo, another what was left parked in it
  L.trkLoadOf = function (s, i) { var g = s && s.gm; return !g ? 0 : i === L.trkUse(s) ? L.gmLoad(s) : total((g.park && g.park[i]) || {}); };
  var busy = function (s) { return L.gmAway(s) ? 'away' : s.gm.co && s.gm.co.q ? 'busy' : null; };

  // Switch to vehicle `to`: { ok, moved, left (stayed parked in the one you left) } or { why: 'none' | 'same' | 'away' | 'busy' }
  L.trkSwitch = function (s, to) {
    var g = L.gm(s), from = g.use | 0;
    if (!L.trkOwns(s, to)) return { why: 'none' };
    if (to === from) return { why: 'same' };
    var b = busy(s);
    if (b) return { why: b };
    g.park = g.park || {};
    var dest = g.park[to] || {}, room = L.trkCapOf(to) - total(dest), moved = 0;
    delete g.park[to];
    Object.keys(g.cargo).sort().forEach(function (k) {
      var n = Math.min(g.cargo[k], room);
      if (n > 0) { add(dest, k, n); g.cargo[k] -= n; room -= n; moved += n; }
      if (!(g.cargo[k] > 0)) delete g.cargo[k];
    });
    if (total(g.cargo)) g.park[from] = g.cargo;
    g.cargo = dest;
    g.use = to;
    return { ok: true, moved: moved, left: total(g.park[from] || {}) };
  };
  // Bram makes truck i: 'ok' | 'have' | 'stars' | 'gold' | 'lumber' | 'needs'. A bigger one than the farm's takes over.
  L.trkMake = function (s, i) {
    var R = V[i];
    if (!R) return 'bad';
    if (L.trkOwns(s, i)) return 'have';
    if (L.gmStars(s) < R.stars) return 'stars';
    if (s.gold < R.gold) return 'gold';
    if ((s.lumber || 0) < R.lumber) return 'lumber';
    if (!L.hasNeeds(s, R.needs)) return 'needs';
    s.gold -= R.gold;
    s.lumber -= R.lumber;
    L.takeNeeds(s, R.needs);
    var g = L.gm(s), u = L.trkUse(s), had = L.trkOwns(s, u);
    g.veh |= 1 << (i - 1);
    if (!had) g.use = i;
    else if (R.cap > L.trkCapOf(u) && !busy(s)) L.trkSwitch(s, i);
    return 'ok';
  };
  // a load back to the farm: plain crops into the Silo first, then the bag; what fits nowhere stays. How many came out.
  var unload = function (s, c, key, n) {
    var p = L.gmSplit(key), k = Math.min(n == null ? Infinity : n, c[key] || 0), left = k;
    if (!(k > 0)) return 0;
    if (!p.q) left = L.siloPut(s, p.id, left);
    if (left > 0 && C.ITEMS[p.id]) left = p.q ? L.addItemQ(s, p.id, left, p.q) : L.addItem(s, p.id, left);
    c[key] -= k - left;
    if (!(c[key] > 0)) delete c[key];
    return k - left;
  };
  // empties what was left parked in vehicle i
  L.trkUnloadParked = function (s, i) {
    var g = s.gm, c = g && g.park && g.park[i];
    if (!c) return 0;
    var n = Object.keys(c).reduce(function (a, k) { return a + unload(s, c, k); }, 0);
    if (!total(c)) delete g.park[i];
    return n;
  };
  // Can you drive the farm's vehicle to Manila yourself now? A truck: no horse needed (the walked valley road's rules).
  L.trkDriveOk = function (s) {
    if (!L.trkUse(s)) return { why: 'cart' };
    if (L.gmAway(s)) return { why: 'away' };
    var r = L.manilaRoad ? L.manilaRoad(s, false) : { ok: true };
    return r.ok ? { ok: true } : { why: 'road', text: r.why };
  };
  var sendQuote = L.gmSendQuote;
  L.gmSendQuote = function (s, how) { return s && s.gm && s.gm.co && s.gm.co.q ? { why: 'busy' } : sendQuote.apply(this, arguments); };
  var tripPay = L.gmTripPay;
  L.gmTripPay = function (trip) { var r = tripPay.apply(this, arguments); if (trip && trip.co) r.co = 1; return r; };

  // ---------- the City Order's week, Manila time ----------
  var iso = function (d) { return new Date(d * DAY).toISOString().slice(0, 10); };
  // { day: its Monday (a day number), key 'YYYY-MM-DD', start, end (ms), open, next (when one opens next) }
  L.coWeek = function (ms) {
    var now = ms == null ? L.clock() : ms, d = Math.floor((now + MANILA) / DAY), mon = d - (d + 3) % 7; // (1 Jan 1970 was a Thursday)
    var start = mon * DAY + CO.open * MIN - MANILA, end = (mon + 6) * DAY + CO.close * MIN - MANILA;
    return { day: mon, key: iso(mon), start: start, end: end, open: now >= start && now < end, next: now < start ? start : start + 7 * DAY };
  };
  L.coDayOf = function (key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : -1;
  };
  // the crops a City Order may ask: the farm crops Lily sells that day (every member can grow them), in the board's order
  L.coCrops = function (day) {
    var ok = {};
    (L.seedsInSeason ? L.seedsInSeason(day) : []).forEach(function (id) {
      var it = C.ITEMS[id], c = it && it.crop && C.CROPS[it.crop];
      if (c && c.item && L.isFarmCrop(c.item)) ok[c.item] = 1;
    });
    return L.gmCrops().filter(function (id) { return ok[id]; });
  };
  // a barangay's order that week: 4 crops (the week and the barangay choose: the same on every phone), and how many of each
  L.coOrder = function (week, hood, members) {
    var m = int(members, 1, CO.most, 1);
    var kinds = L.coCrops(week).map(function (id) { return [L.gmUnit('co', week, hood, id), id]; })
      .sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); }).slice(0, CO.kinds).map(function (p) { return p[1]; });
    return { kinds: kinds, need: CO.per5 / CO.kinds * Math.ceil(m / 5) };
  };

  // ---------- the server's answers (every value checked) ----------
  // farm_city_order_v1: { ok, week, hood, members, kinds, need, got, mine, done, ends_in } | { ok: false, code, hood, members }
  L.coRead = function (r) {
    if (!r || typeof r !== 'object') return null;
    var out = { code: typeof r.code === 'string' ? r.code.slice(0, 12) : null, hood: int(r.hood, 0, 1e15, 0), name: typeof r.name === 'string' ? r.name.slice(0, 24) : '',
      members: int(r.members, 0, CO.most, 0) };
    if (!r.ok) return out;
    var kinds = Array.isArray(r.kinds) ? r.kinds : [], day = L.coDayOf(r.week);
    if (day < 0 || kinds.length !== CO.kinds || !kinds.every(crop)) return null;
    var nums = function (a) { return kinds.map(function (k, i) { return int(Array.isArray(a) ? a[i] : 0, 0, 1e6, 0); }); };
    out.ok = true;
    out.day = day;
    out.kinds = kinds.slice();
    out.need = int(r.need, 1, 1e6, 1);
    out.got = nums(r.got).map(function (n) { return Math.min(n, out.need); });
    out.mine = nums(r.mine);
    out.done = !!r.done || out.got.every(function (n) { return n >= out.need; });
    out.endsIn = int(r.ends_in, 0, 7 * 86400, 0);
    return out;
  };
  // farm_city_claim_v1: [{ week, stars, plaque }] -> [{ day, stars, plaque }]
  L.coClaimRead = function (list) {
    return (Array.isArray(list) ? list : []).map(function (x) { return x && { day: L.coDayOf(x.week), stars: int(x.stars, 0, 10, 0), plaque: !!x.plaque }; })
      .filter(function (x) { return x && x.day >= 0; }).sort(function (a, b) { return a.day - b.day; });
  };

  // ---------- my deliveries ----------
  L.coRec = function (s) { var g = L.gm(s); return g.co || (g.co = { w: 0, d: {}, p: 0, q: null }); };
  L.coMine = function (s, week) { var c = s.gm && s.gm.co; return c && c.w === week ? c.d : {}; };
  L.coWaiting = function (s) { var q = s && s.gm && s.gm.co && s.gm.co.q; return q ? total(q.lots) : 0; };
  // A delivery starts: up to n of a crop out of the vehicle (plain first), waiting for the server's answer under its id.
  // how: 's' (you, at the Grand Market) or 'k' (Mang Kardo). { ok, n, q } or { why: 'cart' | 'away' | 'busy' | 'none' }
  L.coBegin = function (s, kind, n, how, id, week) {
    if (!L.gmHasCart(s)) return { why: 'cart' };
    var b = busy(s);
    if (b) return { why: b };
    var g = s.gm, lots = {}, left = Math.min(int(n, 0, 1e6, 0), L.gmCropLoad(s, kind));
    if (!(left > 0) || !L.isFarmCrop(kind) || !ID.test(String(id))) return { why: 'none' };
    keysOf(g.cargo, kind).forEach(function (k) {
      var m = Math.min(left, g.cargo[k]);
      if (m > 0) { add(lots, k, m); g.cargo[k] -= m; left -= m; if (!g.cargo[k]) delete g.cargo[k]; }
    });
    var q = L.coRec(s).q = { id: String(id), w: int(week, 0, 1e7, 0), kind: kind, lots: lots, how: how === 'k' ? 'k' : 's' };
    return { ok: true, n: total(lots), q: q };
  };
  // The server answered (r: its reply; 'missing': the SQL is not there; null: no answer yet, it waits). The crops it took
  // are paid 2x their sell price (you: now; Mang Kardo: his trip, 30 minutes, his fee), the rest goes back in the vehicle.
  // { ok, took, back, gold, how, done } | { why, back } | { wait: true } | null (nothing waiting)
  L.coAnswer = function (s, r, now) {
    var c = s && s.gm && s.gm.co, q = c && c.q, g = s && s.gm;
    if (!q) return null;
    if (r == null) return { wait: true };
    var n = total(q.lots), took = r && r.ok ? int(r.took, 0, n, 0) : 0, want = took, paid = {}, pay = {}, gold = 0;
    keysOf(q.lots, q.kind).concat(Object.keys(q.lots).filter(function (k) { return L.gmSplit(k).id !== q.kind; })).forEach(function (k) {
      var m = Math.min(want, q.lots[k]);
      if (m > 0) { add(paid, k, m); want -= m; pay[k] = CO.pay * L.qualityPrice(L.gmSplit(k).id, L.gmSplit(k).q); gold += m * pay[k]; }
      add(g.cargo, k, q.lots[k] - Math.max(0, m)); // (the rest back in the vehicle, never lost)
    });
    c.q = null;
    if (!took) return { why: r && r.ok ? 'full' : (r && r.code) || 'missing', back: n };
    if (c.w !== q.w) { c.w = q.w; c.d = {}; }
    add(c.d, q.kind, took);
    if (q.how === 'k' && !g.trip) {
      g.trip = { at: Math.floor(now == null ? L.nowMin() : now), cargo: paid, pay: pay, k: -1, st: 0, co: 1 };
      var rate = L.gmFeeRate ? L.gmFeeRate(s) : G.driver.fee;
      if (rate !== G.driver.fee) g.trip.fee = rate;
    } else {
      s.gold += gold;
      if (s.stats) s.stats.earned = (s.stats.earned || 0) + gold;
    }
    return { ok: true, took: took, back: n - took, gold: gold, how: q.how === 'k' && g.trip && g.trip.co ? 'k' : 's', done: !!r.done };
  };
  // The prizes the server gave (L.coClaimRead), each week once: +3 Market Stars, and the plaque (the barangay's first)
  L.coPay = function (s, list) {
    var c = L.coRec(s), H = C.HOME, out = [];
    list.forEach(function (x) {
      if (x.day <= c.p) return;
      L.gm(s).ms += x.stars;
      if (x.plaque) { var k = L.furnKey(H.typeIndex.trophy_city_order, 0); s.home.bag[k] = (s.home.bag[k] || 0) + 1; }
      c.p = x.day;
      out.push(x);
    });
    return out;
  };

  // ---------- the save ----------
  var flat = function (c, a, pre) { Object.keys(c).sort().forEach(function (k) { if (c[k] > 0) { var p = L.gmSplit(k); if (pre != null) a.push(pre); a.push(p.id, p.q, c[k]); } }); return a; };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize.apply(this, arguments), g = s.gm;
    if (!g) return o;
    var park = [];
    Object.keys(g.park || {}).sort().forEach(function (v) { flat(g.park[v], park, Number(v)); });
    var a8 = g.veh || g.use || park.length ? [g.veh & 7, g.use | 0, park] : null, c = g.co, a9 = null;
    if (c) {
      var d = [];
      Object.keys(c.d || {}).sort().forEach(function (k) { if (c.d[k] > 0) d.push(k, c.d[k]); });
      a9 = [c.w || 0, c.p || 0, d, c.q ? [c.q.id, c.q.w, c.q.kind, c.q.how === 'k' ? 1 : 0, flat(c.q.lots, [])] : 0];
    }
    var co = g.trip && g.trip.co;
    if (a8 || a9 || co) {
      if (!o.gm) o.gm = [0, [], 0, [], 0, 0, []];
      if (a8) o.gm[8] = a8;
      if (a9) o.gm[9] = a9;
      if (co && Array.isArray(o.gm[2])) o.gm[2][5] = 1;
    }
    return o;
  };
  var lotsOf = function (a, c) {
    for (var i = 0; Array.isArray(a) && i + 2 < a.length; i += 3) { if (crop(a[i])) add(c, L.gmKey(a[i], int(a[i + 1], 0, 2, 0)), int(a[i + 2], 0, 1e7, 0)); }
    return c;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize.apply(this, arguments);
    if (!s || !s.gm) return s;
    var g = s.gm, b = o && Array.isArray(o.gm) ? o.gm : null;
    if (!b) return s;
    var a8 = Array.isArray(b[8]) ? b[8] : null, u = 0;
    if (a8) {
      g.veh = int(a8[0], 0, 7, 0);
      u = int(a8[1], 0, V.length - 1, 0);
      var p = Array.isArray(a8[2]) ? a8[2] : [];
      for (var i = 0; i + 3 < p.length; i += 4) {
        var v = int(p[i], 0, V.length - 1, -1), into = v < 0 || v === u || !L.trkOwns(s, v) ? g.cargo : (g.park[v] = g.park[v] || {}); // (never lost)
        lotsOf([p[i + 1], p[i + 2], p[i + 3]], into);
      }
    }
    // the vehicle in use: one the farm owns (else its biggest)
    g.use = L.trkOwns(s, u) ? u : [3, 2, 1, 0].filter(function (k) { return L.trkOwns(s, k); })[0] || 0;
    if (g.use !== u && g.park[g.use]) { lotsOf(flat(g.park[g.use], []), g.cargo); delete g.park[g.use]; }
    var a9 = Array.isArray(b[9]) ? b[9] : null;
    if (a9) {
      var c = g.co = { w: int(a9[0], 0, 1e7, 0), p: int(a9[1], 0, 1e7, 0), d: {}, q: null }, d = Array.isArray(a9[2]) ? a9[2] : [];
      for (var j = 0; j + 1 < d.length; j += 2) if (crop(d[j])) add(c.d, d[j], int(d[j + 1], 0, 1e7, 0));
      var q = Array.isArray(a9[3]) ? a9[3] : null, lots = q ? lotsOf(q[4], {}) : {};
      if (total(lots)) {
        if (ID.test(String(q[0])) && crop(q[2])) c.q = { id: String(q[0]), w: int(q[1], 0, 1e7, 0), kind: q[2], lots: lots, how: q[3] ? 'k' : 's' };
        else lotsOf(flat(lots, []), g.cargo); // (a broken one: its crops back in the vehicle)
      }
    }
    if (g.trip && Array.isArray(b[2]) && b[2][5]) g.trip.co = 1;
    return s;
  };
})(window.Farm = window.Farm || {});
