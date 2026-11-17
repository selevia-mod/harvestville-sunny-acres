// Aling Rosa's Grand Market and the horse cart, the rules (step 1 of the truck plan, owner 18 Nov 2026; the numbers in
// C.GRAND_MARKET, 00-zzzzzzzzzzzzzzzzzzzzzzzzzzz-grand-market.js; the world: 19zzzz...-grand-market.js).
//  - The price board (L.gmBoard): each farm crop's sell price x a multiplier from the game day and the crop's key (a fixed
//    hash: the same board on every phone, no server), 3 hot crops a day on top. Silver and Gold: L.qualityPrice x the same.
//  - Bulk and by cart only: at least 50 of one crop (all its qualities together), from the cart's cargo. The bag keeps the
//    town stall, orders, requests and station crates, all as they were.
//  - 3 contracts a day per farm (the day and the farm's seed choose, from the crops it can grow now: L.gmGrowable):
//    100-200 of one crop at 1.7x, delivered from the cart in one or more loads until the end of the next day; a finished
//    one is a Market Star. An unfinished one just ends.
//  - The horse cart (Bram's Forge, one a farm, needs the horse): 100 crops, loaded from the Silo or the bag (farm crops
//    only), unloaded back (the Silo first, then the bag; what fits nowhere stays in the cart).
//  - Mang Kardo drives it for you: the load sells at the board of the moment he left (or fills the chosen contract), the
//    gold comes 30 real minutes later less his 10%, and the cart is away until then. A trip finishes by the clock.
//  - The valley road on horseback (the owner's rule): 6 hearts and Horseshoes (L.horseRoadOk); the horse may go into
//    Manila ('city': stamina, the Horseshoes, it follows you on foot there, as out in the Wild Lands).
// The save: 'gm' = [cart 0/1, cargo [id, quality, n, ...], the trip or 0 [minute left, [id, quality, n, each, ...],
// contract or -1, star 0/1], contracts [contract, delivered, ...], Market Stars, tours seen (bits), the running days'
// contracts [day, crop, need, crop, need, crop, need, ...]]. Only when there is anything in it: an old save has none.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var G = C.GRAND_MARKET;
  var M = C.MANILA;
  if (!G) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var CON = G.contract;

  // ---------- a fixed hash: the same number for the same words on every phone ----------
  var hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  };
  // a number from 0 up to (not) 1, from its words
  L.gmUnit = function () { return hash(Array.prototype.join.call(arguments, ':')) / 4294967296; };
  var round2 = function (x) { return Math.round(x * 100) / 100; };

  // ---------- the crops the Grand Market buys: every planted farm crop ----------
  var CROPS = null;
  L.gmCrops = function () {
    if (!CROPS) {
      CROPS = [];
      C.CROP_KEYS.forEach(function (k) { var id = C.CROPS[k] && C.CROPS[k].item; if (id && L.isFarmCrop(id) && CROPS.indexOf(id) < 0) CROPS.push(id); });
    }
    return CROPS;
  };
  var sell = function (id) { return (C.ITEMS[id] && C.ITEMS[id].sell) || 0; };

  // ---------- the price board ----------
  var hotDay = null, hotList = null;
  // today's hot crops (3): the crops with the smallest hash for the day
  L.gmHot = function (day) {
    if (hotDay === day && hotList) return hotList;
    hotList = L.gmCrops().map(function (id) { return [L.gmUnit('hot', day, id), id]; }).sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); })
      .slice(0, G.hotN).map(function (p) { return p[1]; });
    hotDay = day;
    return hotList;
  };
  L.gmIsHot = function (day, id) { return L.gmHot(day).indexOf(id) >= 0; };
  // a crop's multiplier on a day (two decimals): 1.1-1.6, a hot crop 1.6-1.8; 0 for what the market does not buy
  L.gmMult = function (day, id) {
    if (!L.isFarmCrop(id)) return 0;
    var r = L.gmIsHot(day, id) ? G.hot : G.mult;
    return round2(r[0] + (r[1] - r[0]) * L.gmUnit('mult', day, id));
  };
  // what one is worth at the Grand Market that day (a Silver or Gold one: its quality price x the same multiplier)
  L.gmPrice = function (day, id, q) {
    var m = L.gmMult(day, id);
    return m ? Math.max(1, Math.round(L.qualityPrice(id, q || 0) * m)) : 0;
  };
  // the board: every crop, the hot ones on top, then the best paying
  L.gmBoard = function (day) {
    return L.gmCrops().map(function (id) { return { id: id, mult: L.gmMult(day, id), hot: L.gmIsHot(day, id), price: L.gmPrice(day, id, 0), sell: sell(id) }; })
      .sort(function (a, b) { return (b.hot - a.hot) || (b.mult - a.mult) || (a.id < b.id ? -1 : 1); });
  };

  // ---------- the state ----------
  L.gmNew = function () { return { cart: 0, cargo: {}, trip: null, con: {}, ms: 0, tour: 0, cs: {} }; };
  L.gm = function (s) { if (!s.gm) s.gm = L.gmNew(); return s.gm; };
  // a cargo key: the crop, and its quality after a '~' (Silver 1, Gold 2)
  L.gmKey = function (id, q) { return q ? id + '~' + q : id; };
  L.gmSplit = function (key) { var i = key.indexOf('~'); return i < 0 ? { id: key, q: 0 } : { id: key.slice(0, i), q: int(key.slice(i + 1), 0, 2, 0) }; };
  L.gmHasCart = function (s) { return !!(s && s.gm && s.gm.cart); };
  L.gmAway = function (s) { return !!(s && s.gm && s.gm.trip); };
  var total = function (c) { var n = 0; for (var k in c) n += c[k]; return n; };
  L.gmLoad = function (s) { return s && s.gm ? total(s.gm.cargo) : 0; };
  L.gmRoom = function (s) { return Math.max(0, G.cart.cap - L.gmLoad(s)); };
  // how many of a crop (every quality) are in the cart; and its keys, plain first
  var keysOf = function (cargo, id) { return [0, 1, 2].map(function (q) { return L.gmKey(id, q); }).filter(function (k) { return cargo[k] > 0; }); };
  L.gmCropLoad = function (s, id) { var c = (s && s.gm && s.gm.cargo) || {}; return keysOf(c, id).reduce(function (n, k) { return n + c[k]; }, 0); };
  // the crops in the cart (each once, in the board's crop order; anything else after)
  L.gmCargoCrops = function (s) {
    var c = (s && s.gm && s.gm.cargo) || {}, out = [];
    Object.keys(c).forEach(function (k) { var id = L.gmSplit(k).id; if (out.indexOf(id) < 0) out.push(id); });
    var order = L.gmCrops();
    return out.sort(function (a, b) { var i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 1e4 : i) - (j < 0 ? 1e4 : j) || (a < b ? -1 : 1); });
  };
  var put = function (s, key, n) { var c = L.gm(s).cargo; c[key] = (c[key] || 0) + n; };
  var take = function (s, key, n) { var c = L.gm(s).cargo, k = Math.min(n, c[key] || 0); if (k > 0) { c[key] -= k; if (!c[key]) delete c[key]; } return Math.max(0, k); };

  // ---------- the cart ----------
  // Bram makes it: 'ok' | 'have' | 'horse' (no horse yet) | 'gold' | 'lumber' | 'needs'
  L.gmMakeCart = function (s) {
    var R = G.cart;
    if (L.gmHasCart(s)) return 'have';
    if (!s.horse) return 'horse';
    if (s.gold < R.gold) return 'gold';
    if ((s.lumber || 0) < R.lumber) return 'lumber';
    if (!L.hasNeeds(s, R.needs)) return 'needs';
    s.gold -= R.gold;
    s.lumber -= R.lumber;
    L.takeNeeds(s, R.needs);
    L.gm(s).cart = 1;
    return 'ok';
  };
  // why the cart cannot be loaded now: null, 'cart' (none), 'away' (Mang Kardo has it) or 'full'
  L.gmWhyNot = function (s) { return !L.gmHasCart(s) ? 'cart' : L.gmAway(s) ? 'away' : L.gmRoom(s) <= 0 ? 'full' : null; };
  // up to n of a crop from the Silo; how many went in
  L.gmLoadSilo = function (s, id, n) {
    if (L.gmWhyNot(s) || !L.isFarmCrop(id)) return 0;
    var k = Math.min(n, L.gmRoom(s), L.siloHas(s, id));
    if (!(k > 0)) return 0;
    k = L.siloTake(s, id, k);
    put(s, id, k);
    return k;
  };
  // up to n from a bag slot (a farm crop: a Silver or Gold one keeps its star); how many went in
  L.gmLoadBag = function (s, slot, n) {
    var it = s.inv[slot];
    if (L.gmWhyNot(s) || !it || !L.isFarmCrop(it.id)) return 0;
    var k = Math.min(n, L.gmRoom(s), it.n), id = it.id, q = it.q || 0;
    if (!(k > 0)) return 0;
    k = L.removeAt(s, slot, k);
    put(s, L.gmKey(id, q), k);
    return k;
  };
  // up to n of a cargo key back: into the Silo first (a plain crop: the Silo keeps no stars), then the bag. What fits
  // nowhere stays in the cart. How many came out.
  L.gmUnload = function (s, key, n) {
    if (!L.gmHasCart(s) || L.gmAway(s)) return 0;
    var c = L.gm(s).cargo, k = Math.min(n == null ? Infinity : n, c[key] || 0), p = L.gmSplit(key), left = k;
    if (!(k > 0)) return 0;
    if (!p.q) left = L.siloPut(s, p.id, left);
    if (left > 0 && C.ITEMS[p.id]) left = p.q ? L.addItemQ(s, p.id, left, p.q) : L.addItem(s, p.id, left);
    return take(s, key, k - left);
  };
  L.gmUnloadAll = function (s) { return Object.keys((s.gm && s.gm.cargo) || {}).reduce(function (n, k) { return n + L.gmUnload(s, k); }, 0); };

  // ---------- selling at the Grand Market, driven there yourself (no fee) ----------
  // what a crop's whole load fetches that day: [{ key, n, each }], gold
  L.gmQuote = function (s, day, id) {
    var c = (s.gm && s.gm.cargo) || {}, lots = keysOf(c, id).map(function (k) { return { key: k, n: c[k], each: L.gmPrice(day, id, L.gmSplit(k).q) }; });
    return { lots: lots, n: lots.reduce(function (a, l) { return a + l.n; }, 0), gold: lots.reduce(function (a, l) { return a + l.n * l.each; }, 0) };
  };
  // sells all of a crop in the cart: { ok, n, gold } or { why: 'none' | 'min' | 'crop' }
  L.gmSell = function (s, id, day) {
    if (!L.gmHasCart(s) || L.gmAway(s)) return { why: 'none' };
    if (!L.isFarmCrop(id)) return { why: 'crop' };
    var qt = L.gmQuote(s, day, id);
    if (!qt.n) return { why: 'none' };
    if (qt.n < G.minLoad) return { why: 'min', n: qt.n };
    qt.lots.forEach(function (l) { take(s, l.key, l.n); });
    s.gold += qt.gold;
    if (s.stats) s.stats.earned = (s.stats.earned || 0) + qt.gold;
    return { ok: true, n: qt.n, gold: qt.gold };
  };

  // ---------- contracts ----------
  // What this farm can grow now (owner, 18 Nov 2026: contracts ask only for these): the farm crops whose seeds Lily sells
  // today or are in the bag or the storage chest, in season, and from a place that is open (a seed that belongs to a
  // place: its item's `place`; none does yet). In the board's crop order.
  L.gmGrowable = function (s) {
    var seeds = {};
    (L.seedsInSeason ? L.seedsInSeason(s.day) : []).forEach(function (id) { seeds[id] = 1; });
    (s.inv || []).concat(s.store || []).forEach(function (x) { if (x && C.ITEMS[x.id] && C.ITEMS[x.id].kind === 'seed') seeds[x.id] = 1; });
    var ok = {};
    Object.keys(seeds).forEach(function (id) {
      var it = C.ITEMS[id], crop = it && it.crop, item = crop && C.CROPS[crop] && C.CROPS[crop].item;
      if (!item || !L.isFarmCrop(item)) return;
      if (L.cropInSeason && !L.cropInSeason(crop, s.day)) return;
      if (it.place && !(L.placeOpen && L.placeOpen(s, it.place))) return;
      ok[item] = 1;
    });
    return L.gmCrops().filter(function (id) { return ok[id]; });
  };
  // A day's 3 from a list of crops (deterministic: the day and the farm's seed choose): different crops while the list has
  // them, else a crop again with another amount. [{ crop, need }]
  L.gmPick = function (crops, seed, day) {
    var out = [], used = {}, steps = Math.floor((CON.max - CON.min) / CON.step) + 1;
    if (!crops.length) return out;
    for (var i = 0; i < CON.n; i++) {
      var j = Math.floor(L.gmUnit('con', seed, day, i) * crops.length), fresh = Object.keys(used).length < crops.length;
      if (fresh) while (used[crops[j]]) j = (j + 1) % crops.length;
      var crop = crops[j], n = Math.min(steps - 1, Math.floor(L.gmUnit('need', seed, day, i) * steps));
      while ((used[crop] || []).indexOf(n) >= 0) n = (n + 1) % steps; // (the same crop again: another amount)
      (used[crop] = used[crop] || []).push(n);
      out.push({ crop: crop, need: CON.min + CON.step * n });
    }
    return out;
  };
  // a day's 3 for this farm: { k (its number: day x 3 + i), day, crop, need, each }. Chosen from what it can grow on the
  // first look that day, and kept (in the save) while they run, so buying seeds or opening a place later that day never
  // changes a contract under way.
  L.gmContractsOf = function (s, day) {
    var g = s && s.gm, keep = g && day <= s.day && day > s.day - CON.days, list = keep && g.cs && g.cs[day];
    if (!list) {
      list = L.gmPick(L.gmGrowable(s), (s && s.seed) | 0, day).map(function (c) { return [c.crop, c.need]; });
      if (keep) (g.cs = g.cs || {})[day] = list;
    }
    return list.map(function (c, i) { return { k: day * CON.n + i, day: day, crop: c[0], need: c[1], each: Math.max(1, Math.round(sell(c[0]) * CON.pay)) }; });
  };
  // the ones on the board now (today's and those from the days before still running), with how far each has come:
  // got, left, done, and the minutes until it ends
  L.gmContracts = function (s) {
    var out = [], con = (s.gm && s.gm.con) || {};
    for (var d = s.day; d > s.day - CON.days; d--) {
      L.gmContractsOf(s, d).forEach(function (c) {
        c.got = Math.min(c.need, con[c.k] || 0);
        c.left = c.need - c.got;
        c.done = c.left <= 0;
        c.mins = Math.max(0, Math.round((c.day + CON.days - s.day) * 1440 - (s.time || 0)));
        out.push(c);
      });
    }
    return out;
  };
  L.gmContract = function (s, k) { return L.gmContracts(s).filter(function (c) { return c.k === k; })[0] || null; };
  // how many of a contract's crop the cart can deliver now (at least 50, or all that is left of it if less), or 0
  L.gmCanDeliver = function (s, c) {
    if (!c || c.done || !L.gmHasCart(s) || L.gmAway(s)) return 0;
    var n = Math.min(L.gmCropLoad(s, c.crop), c.left);
    return n >= Math.min(G.minLoad, c.left) ? n : 0;
  };
  // the lots a delivery takes: plain first, then Silver, then Gold (all count as plain)
  var deliveryLots = function (s, c, n) {
    var cg = s.gm.cargo, lots = [];
    keysOf(cg, c.crop).forEach(function (k) { var m = Math.min(n, cg[k]); if (m > 0) { lots.push({ key: k, n: m, each: c.each }); n -= m; } });
    return lots;
  };
  // delivers to contract k from the cart: { ok, n, gold, done } or { why: 'none' | 'done' | 'min' }
  L.gmDeliver = function (s, k) {
    var c = L.gmContract(s, k);
    if (!c) return { why: 'none' };
    if (c.done) return { why: 'done' };
    var n = L.gmCanDeliver(s, c);
    if (!n) return { why: L.gmCropLoad(s, c.crop) ? 'min' : 'none', need: Math.min(G.minLoad, c.left) };
    deliveryLots(s, c, n).forEach(function (l) { take(s, l.key, l.n); });
    var gold = n * c.each, g = L.gm(s);
    g.con[k] = c.got + n;
    s.gold += gold;
    if (s.stats) s.stats.earned = (s.stats.earned || 0) + gold;
    var done = g.con[k] >= c.need;
    if (done) g.ms++;
    return { ok: true, n: n, gold: gold, done: done };
  };
  L.gmStars = function (s) { return (s.gm && s.gm.ms) || 0; };

  // ---------- Mang Kardo drives it there ----------
  // What he would take: how = 'sell' (every crop with 50 or more, at today's board) or a contract's number.
  // { lots: [{ key, n, each }], n, gold, fee, net, k, star } or { why: 'cart' | 'away' | 'empty' | 'min' | 'none' | 'done' }
  L.gmSendQuote = function (s, how) {
    if (!L.gmHasCart(s)) return { why: 'cart' };
    if (L.gmAway(s)) return { why: 'away' };
    if (!L.gmLoad(s)) return { why: 'empty' };
    var lots = [], k = -1, star = 0;
    if (how === 'sell') {
      L.gmCargoCrops(s).forEach(function (id) { if (L.isFarmCrop(id) && L.gmCropLoad(s, id) >= G.minLoad) lots = lots.concat(L.gmQuote(s, s.day, id).lots); });
      if (!lots.length) return { why: 'min' };
    } else {
      var c = L.gmContract(s, how);
      if (!c) return { why: 'none' };
      if (c.done) return { why: 'done' };
      var n = L.gmCanDeliver(s, c);
      if (!n) return { why: L.gmCropLoad(s, c.crop) ? 'min' : 'none' };
      lots = deliveryLots(s, c, n);
      k = c.k;
      star = n >= c.left ? 1 : 0;
    }
    var gold = lots.reduce(function (a, l) { return a + l.n * l.each; }, 0), fee = Math.round(gold * G.driver.fee);
    return { lots: lots, n: lots.reduce(function (a, l) { return a + l.n; }, 0), gold: gold, fee: fee, net: gold - fee, k: k, star: star };
  };
  // He leaves with the load (now: real minutes); what is not his to take stays in the cart. A contract is booked as he
  // leaves (so its deadline cannot pass on the road); its Market Star and all the gold come with him.
  L.gmSend = function (s, how, now) {
    var q = L.gmSendQuote(s, how);
    if (q.why) return q;
    var g = L.gm(s), trip = { at: Math.floor(now), cargo: {}, pay: {}, k: q.k, st: q.star };
    q.lots.forEach(function (l) { take(s, l.key, l.n); trip.cargo[l.key] = (trip.cargo[l.key] || 0) + l.n; trip.pay[l.key] = l.each; });
    if (q.k >= 0) g.con[q.k] = (g.con[q.k] || 0) + q.n;
    g.trip = trip;
    q.ok = true;
    return q;
  };
  L.gmDue = function (s) { return s.gm && s.gm.trip ? s.gm.trip.at + G.driver.mins : null; };
  L.gmLeft = function (s, now) { var d = L.gmDue(s); return d == null ? 0 : Math.max(0, d - Math.floor(now)); };
  // what a trip brings: { gold, fee, net, lots, star, k }
  L.gmTripPay = function (trip) {
    var lots = Object.keys(trip.cargo).map(function (k) { return { key: k, n: trip.cargo[k], each: trip.pay[k] || 0 }; });
    var gold = lots.reduce(function (a, l) { return a + l.n * l.each; }, 0), fee = Math.round(gold * G.driver.fee);
    return { gold: gold, fee: fee, net: gold - fee, lots: lots, star: trip.st ? 1 : 0, k: trip.k };
  };
  // Back? (now: real minutes) The gold in, the star, the cart home; what it brought, or null while he is on the road.
  L.gmFinish = function (s, now) {
    var g = s.gm, trip = g && g.trip;
    if (!trip || Math.floor(now) < trip.at + G.driver.mins) return null;
    var r = L.gmTripPay(trip);
    s.gold += r.net;
    if (s.stats) s.stats.earned = (s.stats.earned || 0) + r.net;
    if (r.star) g.ms++;
    g.trip = null;
    return r;
  };

  // ---------- the horse on the valley road, and in Manila ----------
  var city = function () { return !!(M && M.on && M.horseRoad); };
  var zone = L.horseZone;
  L.horseZone = function (map) { return map === 'manila' && city() ? 'city' : zone(map); };
  var out = L.horseOut;
  L.horseOut = function (map) { return L.horseZone(map) === 'city' || out(map); };
  var zoneName = L.horseZoneName;
  L.horseZoneName = function (z) { return z === 'city' ? 'Manila' : zoneName(z); };
  var mayGo = L.horseMayGo;
  L.horseMayGo = function (s, map) {
    if (L.horseZone(map) !== 'city') return mayGo(s, map);
    if (!s.horse) return { why: 'none', zone: 'city' };
    if (L.horseHearts(s) < M.horseHearts) return { why: 'hearts', need: M.horseHearts, zone: 'city' };
    if (!L.horseHas(s, 'horseshoes')) return { why: 'shoes', zone: 'city' };
    return { ok: true, zone: 'city' };
  };
  // The owner's rule for the valley road (L.manilaRoad asks it when C.MANILA.horseRoad is on): walking it is free as ever;
  // riding it takes 6 hearts and Horseshoes (and a horse not worn out).
  L.horseRoadOk = function (s, riding) {
    if (!riding) return { ok: true };
    var r = L.horseCanRide(s, 'manila');
    return r.ok ? { ok: true } : { ok: false, why: L.horseWhy(s, r) };
  };
  // the road itself, ridden: its stamina, as any ride out there (never the last point: the horse makes it to the gate)
  L.gmRoadRide = function (s) {
    if (!s.horse) return 0;
    var st = L.horseStamina(s), k = Math.max(0, Math.min(G.road, st - 1));
    if (k > 0) s.horse.st = st - k;
    return k;
  };

  // ---------- the tours (a bit each) ----------
  L.gmTourSeen = function (s, key) { var i = G.tours.indexOf(key); return i < 0 || !!((L.gm(s).tour >> i) & 1); };
  L.gmTourTake = function (s, key) {
    if (L.gmTourSeen(s, key)) return false;
    L.gm(s).tour |= 1 << G.tours.indexOf(key);
    return true;
  };

  // ---------- the day and the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.gm = L.gmNew();
    return s;
  };
  // a new day: contracts past their end are let go (their stars are already counted)
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info), con = s.gm && s.gm.con;
    if (con) Object.keys(con).forEach(function (k) { if (Math.floor(Number(k) / CON.n) <= s.day - CON.days) delete con[k]; });
    var cs = s.gm && s.gm.cs;
    if (cs) Object.keys(cs).forEach(function (d) { if (Number(d) <= s.day - CON.days) delete cs[d]; });
    return r;
  };
  var flat = function (c, pay) {
    var a = [];
    Object.keys(c).sort().forEach(function (k) { if (!(c[k] > 0)) return; var p = L.gmSplit(k); a.push(p.id, p.q, c[k]); if (pay) a.push(pay[k] || 0); });
    return a;
  };
  var unflat = function (a, each, pay) {
    var c = {}, w = each ? 4 : 3;
    if (!Array.isArray(a)) return c;
    for (var i = 0; i + w - 1 < a.length; i += w) {
      var id = typeof a[i] === 'string' && a[i].length && a[i].length <= 40 ? a[i] : null, n = int(a[i + 2], 0, 1e7, 0);
      if (!id || !n) continue;
      var key = L.gmKey(id, int(a[i + 1], 0, 2, 0));
      c[key] = (c[key] || 0) + n;
      if (pay) pay[key] = int(a[i + 3], 0, 1e7, 0);
    }
    return c;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), g = s.gm;
    if (!g) return o;
    var cargo = flat(g.cargo || {}), con = [];
    Object.keys(g.con || {}).sort(function (a, b) { return a - b; }).forEach(function (k) { if (g.con[k] > 0) con.push(Number(k), g.con[k]); });
    var t = g.trip ? [g.trip.at, flat(g.trip.cargo || {}, g.trip.pay || {}), g.trip.k == null ? -1 : g.trip.k, g.trip.st ? 1 : 0] : 0;
    var cs = [];
    Object.keys(g.cs || {}).sort(function (a, b) { return a - b; }).forEach(function (d) { cs.push(Number(d)); g.cs[d].forEach(function (c) { cs.push(c[0], c[1]); }); });
    if (g.cart || cargo.length || t || con.length || g.ms || g.tour || cs.length) o.gm = [g.cart ? 1 : 0, cargo, t, con, g.ms || 0, g.tour || 0, cs];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var g = s.gm = L.gmNew(), a = o && Array.isArray(o.gm) ? o.gm : null;
    if (!a) return s;
    g.cart = a[0] ? 1 : 0;
    g.cargo = unflat(a[1], false);
    if (Array.isArray(a[2])) {
      var pay = {}, tc = unflat(a[2][1], true, pay);
      // (a trip is never lost: it finishes by the clock on the next open)
      if (Object.keys(tc).length) g.trip = { at: int(a[2][0], 0, 1e9, 0), cargo: tc, pay: pay, k: int(a[2][2], -1, 1e9, -1), st: a[2][3] ? 1 : 0 };
    }
    if (Array.isArray(a[3])) for (var i = 0; i + 1 < a[3].length; i += 2) { var k = int(a[3][i], 0, 1e9, -1), n = int(a[3][i + 1], 0, 1e6, 0); if (k >= 0 && n) g.con[k] = n; }
    g.ms = int(a[4], 0, 1e6, 0);
    g.tour = int(a[5], 0, 0xffff, 0);
    // the running contracts: [day, crop, need, crop, need, crop, need, ...]
    var b = Array.isArray(a[6]) ? a[6] : [], w = 1 + 2 * CON.n;
    for (var j = 0; j + w - 1 < b.length; j += w) {
      var d = int(b[j], 0, 1e7, -1), list = [];
      for (var q = 0; q < CON.n; q++) { var cr = b[j + 1 + 2 * q], nd = int(b[j + 2 + 2 * q], 1, 1e5, 0); if (typeof cr === 'string' && cr.length <= 40 && nd) list.push([cr, nd]); }
      if (d >= 0 && list.length === CON.n) g.cs[d] = list;
    }
    return s;
  };
})(window.Farm = window.Farm || {});
