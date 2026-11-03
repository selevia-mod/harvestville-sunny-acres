// Willowbrook Station's rules (content: 00-zzzzzzz-town.js; the station in town: 19zz-town.js; panels: 19zz-town-ui.js).
// Trains come in four times a day by the phone's clock and stay two hours. A train brings a cargo order when there is
// none: 4 to 6 crates, each wanting goods from a different part of the game, a day or two to fill them; each crate pays
// a little, all of them a big prize; the next train takes the crates and brings a new order (or takes what was filled
// when the time runs out). Visitors get off every train and ask for pasalubong. Crates, visitors and sales while a train
// is in give Town points; the Town Level they make unlocks things (C.TW.levels).
// (Named 01-logicz-…: '01-logic-town.js' would load before 01-logic.js, as '-' sorts before '.'.)
// Saved as 'tw': [points, last train, sales counted this train, orders made, orders filled, order or 0, wishes, kiosk].
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TW = C.TW;
  var DAY = 1440;
  var KINDS = Object.keys(TW.kinds); // stable order: the save keeps a crate's kind as its place here
  var BASE_SHELF = C.STAND.perShelf;

  C.TIPS.push({ key: 'station_tour', text: 'THE TRAIN STATION' });

  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var sellOf = function (id) { var it = C.ITEMS[id]; return it && !it.price && it.sell > 0 ? it.sell : 0; };
  var blank = function () { return { p: 0, t: -1, ts: 0, n: 0, done: 0, o: null, v: [], k: [0, []], up: null }; };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.tw = blank();
    return s;
  };

  // ---------- the clock and the trains ----------
  L.twNow = function (s) { return s.day * DAY + Math.floor(s.time); }; // minutes, by the phone's own date and time
  // The train in at minute lm: { tn (its number), slot, arrive, leave }, or null.
  L.twTrainAt = function (lm) {
    var day = Math.floor(lm / DAY), m = lm - day * DAY;
    for (var k = 0; k < TW.trains.length; k++) {
      if (m >= TW.trains[k] && m < TW.trains[k] + TW.stay) return { tn: day * TW.trains.length + k, slot: k, arrive: day * DAY + TW.trains[k], leave: day * DAY + TW.trains[k] + TW.stay };
    }
    return null;
  };
  L.twTrain = function (s) { return L.twTrainAt(L.twNow(s)); };
  // The next train to come in after minute lm.
  L.twNextTrain = function (lm) {
    var day = Math.floor(lm / DAY);
    for (var d = day; d <= day + 1; d++) {
      for (var k = 0; k < TW.trains.length; k++) {
        var at = d * DAY + TW.trains[k];
        if (at > lm) return { tn: d * TW.trains.length + k, slot: k, arrive: at, leave: at + TW.stay };
      }
    }
    return null;
  };

  // ---------- Town Level ----------
  L.twLevel = function (s) {
    var p = s.tw ? s.tw.p : 0, lv = 1;
    TW.levels.forEach(function (l, i) { if (p >= l.at) lv = i + 1; });
    return lv;
  };
  L.twNextLevel = function (s) {
    var lv = L.twLevel(s), next = TW.levels[lv];
    return next ? { level: lv + 1, at: next.at, text: next.text, from: TW.levels[lv - 1].at } : null;
  };
  // Adds Town points; a new level pays the town's gift and is kept in s.tw.up for the game to show. Returns the new
  // level, or 0.
  var addPoints = function (s, n) {
    var before = L.twLevel(s);
    s.tw.p = Math.min(1e6, s.tw.p + n);
    var after = L.twLevel(s);
    if (after <= before) return 0;
    var gift = 0;
    for (var lv = before + 1; lv <= after; lv++) gift += TW.levelGift * lv;
    s.gold += gift;
    s.tw.up = { level: after, gift: gift };
    return after;
  };
  L.twPayMore = function (s) { return L.twLevel(s) >= TW.payMoreAt ? TW.payMore : 1; };

  // ---------- what the farm can make right now ----------
  var trees = function (s) {
    var out = [];
    ((s.yard && s.yard.items) || []).forEach(function (it) {
      var tree = L.treeOf && L.treeOf(it.t);
      if (tree && L.treeInSeason(tree, s.day) && out.indexOf(tree.fruit) < 0) out.push(tree.fruit);
    });
    return out;
  };
  var made = function (s) {
    var out = [];
    C.WORKSHOP_KEYS.forEach(function (k) {
      if (!L.yardHas(s, k)) return;
      C.WORKSHOPS[k].recipes.forEach(function (r) { if (L.discovered(s, r.out) && out.indexOf(r.out) < 0) out.push(r.out); });
    });
    return out;
  };
  var animals = function (s) {
    var out = [];
    s.animals.forEach(function (a) { var p = C.ANIMALS[a.kind] && C.ANIMALS[a.kind].product; if (p && out.indexOf(p) < 0) out.push(p); });
    return out;
  };
  var hunted = function (s) {
    var out = [], by = (s.wild && s.wild.by) || {};
    C.WILD.order.forEach(function (k) {
      var a = C.WILD.animals[k];
      if (!a || a.rare || !(by[k] > 0)) return;
      a.drops.forEach(function (d) { if (d[2] >= 0.5 && out.indexOf(d[0]) < 0) out.push(d[0]); });
    });
    return out;
  };
  // The goods a crate can want, by kind (only kinds the farmer can get now).
  L.twPools = function (s) {
    var deep = s.stats.deepest || 0, rod = L.hasItem(s, 'rod'), fg = L.forageItem(s.day);
    var pools = {
      crops: C.CROP_KEYS.filter(function (k) { return !C.CROPS[k].sickle && L.cropInSeason(k, s.day); }).map(function (k) { return C.CROPS[k].item; }),
      farm: animals(s).concat(trees(s)),
      workshop: made(s),
      ore: ['ore_copper', 'ore_silver', 'ore_gold'].filter(function (id, i) { return deep >= [1, 4, 8][i]; }),
      fish: rod ? ['fish_s', 'fish_m'] : [],
      hunt: hunted(s),
      forage: fg ? [fg] : [],
    };
    KINDS.forEach(function (k) { pools[k] = pools[k].filter(function (id) { return sellOf(id) > 0; }); });
    return pools;
  };

  // ---------- the cargo order ----------
  var round = function (v, to) { return Math.max(to, Math.round(v / to) * to); };
  L.twMakeOrder = function (s, lm) {
    var lv = L.twLevel(s), want = TW.crates[lv - 1], no = s.tw.n++, more = L.twPayMore(s);
    var r = function (a, b) { return L.rand(s.seed, 9100 + no, a, b || 0); };
    var pools = L.twPools(s);
    var kinds = KINDS.filter(function (k) { return pools[k].length; }).sort(function (a, b) { return r(1, KINDS.indexOf(a)) - r(1, KINDS.indexOf(b)); });
    var crates = [], used = {};
    for (var i = 0; crates.length < want && i < want * 4 && kinds.length; i++) {
      var kind = kinds[i % kinds.length], list = pools[kind].filter(function (id) { return !used[id]; });
      if (!list.length) continue;
      var id = list[Math.floor(r(2, i) * list.length)], sell = sellOf(id);
      used[id] = 1;
      var goal = 220 + 50 * lv + Math.min(500, (s.stats.earned || 0) / 200) + r(3, i) * 120;
      var n = Math.max(1, Math.min(TW.most[kind], Math.round(goal / sell)));
      crates.push({ id: id, n: n, k: kind, pay: round(sell * n * TW.cratePay * more, 5), done: 0 });
    }
    var value = crates.reduce(function (sum, c) { return sum + sellOf(c.id) * c.n; }, 0);
    var item = TW.prizes[no % TW.prizes.length];
    var prize = { gold: round(value * TW.prizePay * more, 50), stars: TW.prizeStars + (lv >= 6 ? 1 : 0), item: item.item, n: item.n };
    s.tw.o = { at: lm, due: lm + (TW.hours[crates.length] || 24) * 60, no: no, full: 0, crates: crates, prize: prize };
    return s.tw.o;
  };
  L.twFilled = function (o) { return o ? o.crates.filter(function (c) { return c.done; }).length : 0; };
  L.twLeft = function (s) { var o = s.tw.o; return o && !o.full ? Math.max(0, o.due - L.twNow(s)) : 0; };

  // Fills crate i. Returns { pay, pts, prize (when it was the last), level } or 'none' / 'done' / 'missing' / 'full'
  // (no room in the bag for the prize).
  L.twFill = function (s, i) {
    var o = s.tw.o, c = o && !o.full && o.crates[i];
    if (!c) return 'none';
    if (c.done) return 'done';
    if (L.countItem(s, c.id) < c.n) return 'missing';
    var last = o.crates.every(function (x, k) { return x.done || k === i; });
    if (last && o.prize.item && !L.canAdd(s, o.prize.item, o.prize.n)) return 'full';
    L.removeItem(s, c.id, c.n);
    L.discover(s, c.id);
    c.done = 1;
    s.gold += c.pay;
    s.stats.earned += c.pay;
    var r = { pay: c.pay, pts: TW.points.crate, prize: null };
    if (last) {
      o.full = 1;
      s.tw.done++;
      s.gold += o.prize.gold;
      s.stats.earned += o.prize.gold;
      s.stars += o.prize.stars;
      if (o.prize.item) L.addItem(s, o.prize.item, o.prize.n);
      r.prize = o.prize;
      r.pts += TW.points.cargo;
    }
    r.level = addPoints(s, r.pts);
    return r;
  };

  // ---------- visitors off the train ----------
  // [item, fewest, most] a visitor may ask for
  L.twWishPool = function (s) {
    var pool = [], rod = L.hasItem(s, 'rod'), fg = L.forageItem(s.day);
    L.twPools(s).crops.forEach(function (id) { pool.push([id, 3, 6]); });
    animals(s).concat(trees(s)).forEach(function (id) { pool.push([id, 2, 4]); });
    made(s).forEach(function (id) { pool.push([id, 1, 2]); });
    if (rod) pool.push(['fish_s', 1, 3], ['fish_m', 1, 2]);
    if (fg) pool.push([fg, 2, 3]);
    return pool.filter(function (e) { return sellOf(e[0]) > 0; });
  };
  // the Collector wants something rare
  L.twRarePool = function (s) {
    var deep = s.stats.deepest || 0, by = (s.wild && s.wild.by) || {}, pool = [];
    if (deep >= 8) pool.push(['ore_gold', 2, 3]);
    if (deep >= 10) pool.push(['gem', 1, 1]);
    if (L.hasItem(s, 'rod')) pool.push(['fish_l', 1, 1]);
    [['deer', 'antler'], ['boar', 'tusk'], ['wolf', 'pelt_wolf'], ['bear', 'fur_bear'], ['tiger', 'pelt_tiger']].forEach(function (e) { if (by[e[0]] > 0) pool.push([e[1], 1, 2]); });
    ['cheese', 'butter', 'cake', 'kesong_puti'].forEach(function (id) { if (made(s).indexOf(id) >= 0) pool.push([id, 1, 2]); });
    if (animals(s).indexOf('truffle') >= 0) pool.push(['truffle', 2, 3]);
    return pool.filter(function (e) { return sellOf(e[0]) > 0; });
  };
  L.twVisitors = function (s) { var lv = L.twLevel(s); return 2 + (lv >= 3 ? 1 : 0) + (lv >= 7 ? 1 : 0); };
  // the Collector comes on one train a day, from Town Level 5
  L.twCollectorTrain = function (s, tn) {
    var n = TW.trains.length, day = Math.floor(tn / n);
    return L.twLevel(s) >= TW.collectorAt && tn % n === Math.floor(L.rand(s.seed, day, 9300) * n);
  };
  // The visitors' wishes for train tn: [{ who (index in TW.visitors, -1 = the Collector), id, n, gold, stars, done }]
  L.twMakeWishes = function (s, tn) {
    var out = [], pool = L.twWishPool(s), more = L.twPayMore(s), count = L.twVisitors(s);
    var r = function (a, b) { return L.rand(s.seed, tn, 9200 + a, b || 0); };
    var first = Math.floor(r(1) * TW.visitors.length);
    for (var k = 0; k < count && pool.length; k++) {
      var e = pool.splice(Math.floor(r(2, k) * pool.length), 1)[0], n = e[1] + Math.floor(r(3, k) * (e[2] - e[1] + 1)); // (each wishes for something else)
      out.push({ who: (first + k) % TW.visitors.length, id: e[0], n: n, gold: round((sellOf(e[0]) * n * 1.6 + 20) * more, 5), stars: 0, done: 0 });
    }
    var rare = L.twRarePool(s);
    if (rare.length && L.twCollectorTrain(s, tn)) {
      var c = rare[Math.floor(r(4) * rare.length)], cn = c[1] + Math.floor(r(5) * (c[2] - c[1] + 1));
      out.push({ who: -1, id: c[0], n: cn, gold: round(sellOf(c[0]) * cn * 1.5 * more, 10), stars: 1, done: 0 });
    }
    return out;
  };
  // The wishes of the visitors in town now ([] when no train is in).
  L.twWishes = function (s) {
    var tr = L.twTrain(s);
    return tr && tr.tn === s.tw.t ? s.tw.v : [];
  };
  L.twWho = function (who) { return who < 0 ? TW.collector : TW.visitors[who] || TW.visitors[0]; };
  // Gives visitor k what they asked for. Returns { gold, stars, pts, level } or 'gone' / 'done' / 'missing'.
  L.twHelp = function (s, k) {
    var w = L.twWishes(s)[k];
    if (!w) return 'gone';
    if (w.done) return 'done';
    if (L.countItem(s, w.id) < w.n) return 'missing';
    L.removeItem(s, w.id, w.n);
    L.discover(s, w.id);
    w.done = 1;
    s.gold += w.gold;
    s.stats.earned += w.gold;
    s.stars += w.stars;
    var pts = w.who < 0 ? TW.points.collector : TW.points.wish;
    return { gold: w.gold, stars: w.stars, pts: pts, level: addPoints(s, pts) };
  };

  // ---------- the trains come and go ----------
  // Brings the station up to the clock: the order running out, a new train (its visitors, and an order if there is
  // none), the first order of all. Returns what happened: { arrived, collected, order, expired: { filled, of }, left }.
  L.twTick = function (s) {
    var tw = s.tw, now = L.twNow(s), tr = L.twTrainAt(now), ev = {};
    if (tw.o && !tw.o.full && now >= tw.o.due) {
      ev.expired = { filled: L.twFilled(tw.o), of: tw.o.crates.length };
      tw.o = null;
    }
    if (tr && tr.tn > tw.t) {
      tw.t = tr.tn;
      tw.ts = 0;
      tw.v = L.twMakeWishes(s, tr.tn);
      ev.arrived = tr;
      if (tw.o && tw.o.full) { tw.o = null; ev.collected = true; }
      if (!tw.o) { L.twMakeOrder(s, now); ev.order = true; }
    }
    if (!tw.o && !tw.n) { L.twMakeOrder(s, now); ev.order = true; } // the very first: waiting from the start
    if (!tr && tw.v.length) { tw.v = []; ev.left = true; }
    return ev;
  };

  // ---------- sales while a train is in count for the town ----------
  var sellLot = L.sellLot;
  L.sellLot = function (s, i, buyer) {
    var who = null;
    if (buyer && !C.VILLAGERS[buyer]) { // a visitor off the train (19zz-town.js): the coins say a villager, the news says them
      var v = TW.visitors.concat([TW.collector]).filter(function (x) { return x.key === buyer; })[0];
      who = v ? v.name : null;
      buyer = null;
    }
    var r = sellLot.call(L, s, i, buyer);
    if (r && s.tw && L.twTrain(s) && s.tw.ts < TW.saleMax) {
      s.tw.ts++;
      r.twLevel = addPoints(s, TW.points.sale);
    }
    if (r && who) r.who = who;
    return r;
  };

  // ---------- a bigger stall (Town Level 2) ----------
  L.twShelfCap = function (s) { return L.twLevel(s) >= TW.shelfAt ? Math.max(BASE_SHELF, TW.shelfMore) : BASE_SHELF; };
  L.twWithShelf = function (cap, fn) {
    var keep = C.STAND.perShelf;
    C.STAND.perShelf = cap;
    try { return fn(); } finally { C.STAND.perShelf = keep; }
  };
  var listItem = L.listItem;
  L.listItem = function (s) {
    var args = arguments;
    return L.twWithShelf(L.twShelfCap(s), function () { return listItem.apply(L, args); });
  };

  // ---------- the kiosk (Town Level 4) ----------
  L.twKiosk = function (s) {
    if (L.twLevel(s) < TW.kioskAt) return [];
    if (s.tw.k[0] !== s.day) s.tw.k = [s.day, []];
    return TW.kiosk.map(function (e, i) { return { id: e[0], gold: e[1], left: Math.max(0, e[2] - (s.tw.k[1][i] || 0)) }; });
  };
  // Returns 'ok', or 'none' / 'soldout' / 'gold' / 'full'.
  L.twBuy = function (s, i) {
    var e = L.twKiosk(s)[i];
    if (!e) return 'none';
    if (!e.left) return 'soldout';
    if (s.gold < e.gold) return 'gold';
    if (!L.canAdd(s, e.id, 1)) return 'full';
    s.gold -= e.gold;
    L.addItem(s, e.id, 1);
    s.tw.k[1][i] = (s.tw.k[1][i] || 0) + 1;
    return 'ok';
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), tw = s.tw || blank(), od = tw.o;
    o.tw = [tw.p, tw.t, tw.ts, tw.n, tw.done,
      od ? [od.at, od.due, od.no, od.full, od.prize.gold, od.prize.stars, od.prize.item || '', od.prize.n || 0,
        od.crates.map(function (c) { return [c.id, c.n, KINDS.indexOf(c.k), c.pay, c.done]; })] : 0,
      tw.v.map(function (w) { return [w.who, w.id, w.n, w.gold, w.stars, w.done]; }),
      [tw.k[0], tw.k[1]]];
    return o;
  };
  var readOrder = function (a) {
    if (!Array.isArray(a) || !Array.isArray(a[8])) return null;
    var crates = a[8].filter(function (c) { return Array.isArray(c) && sellOf(c[0]) > 0 && KINDS[c[2]]; }).slice(0, 8).map(function (c) {
      return { id: c[0], n: int(c[1], 1, 99, 1), k: KINDS[c[2]], pay: int(c[3], 0, 1e5, 0), done: c[4] ? 1 : 0 };
    });
    if (!crates.length) return null;
    var item = C.ITEMS[a[6]] ? a[6] : null;
    return {
      at: int(a[0], 0, 1e9, 0), due: int(a[1], 0, 1e9, 0), no: int(a[2], 0, 1e6, 0), full: a[3] ? 1 : 0, crates: crates,
      prize: { gold: int(a[4], 0, 1e6, 0), stars: int(a[5], 0, 9, 0), item: item, n: item ? int(a[7], 1, 99, 1) : 0 },
    };
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    // shelves of a bigger stall (Town Level 2) keep their 30 on the way in
    var s = L.twWithShelf(Math.max(BASE_SHELF, TW.shelfMore), function () { return deserialize(o); });
    if (!s) return s;
    var a = o && Array.isArray(o.tw) ? o.tw : [];
    s.tw = blank();
    s.tw.p = int(a[0], 0, 1e6, 0);
    s.tw.t = int(a[1], -1, 1e9, -1);
    s.tw.ts = int(a[2], 0, 99, 0);
    s.tw.n = int(a[3], 0, 1e6, 0);
    s.tw.done = int(a[4], 0, 1e6, 0);
    s.tw.o = readOrder(a[5]);
    s.tw.v = (Array.isArray(a[6]) ? a[6] : []).filter(function (w) { return Array.isArray(w) && sellOf(w[1]) > 0; }).slice(0, 6).map(function (w) {
      return { who: int(w[0], -1, TW.visitors.length - 1, 0), id: w[1], n: int(w[2], 1, 99, 1), gold: int(w[3], 0, 1e5, 0), stars: int(w[4], 0, 3, 0), done: w[5] ? 1 : 0 };
    });
    var k = Array.isArray(a[7]) ? a[7] : [];
    s.tw.k = [int(k[0], 0, 1e7, 0), (Array.isArray(k[1]) ? k[1] : []).slice(0, TW.kiosk.length).map(function (n) { return int(n, 0, 99, 0); })];
    return s;
  };
})(window.Farm = window.Farm || {});
