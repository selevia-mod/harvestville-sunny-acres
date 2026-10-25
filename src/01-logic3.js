// The market stall in the town plaza (it replaces the shipping box): sell now at a lower price, or put a lot on
// a shelf at a price you pick and a villager comes along to buy it later; coins wait at the stall until you
// collect them. Next to it, an order board with villagers' requests that pay a bonus.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  C.STAND = {
    shelves: 6,
    perShelf: 20, // most of one item on a shelf
    instant: 0.75, // selling right away pays this share of the base price
    // price levels for a shelf: share of the base price, and how long (game minutes) until a buyer comes
    prices: [
      { key: 'cheap', name: 'Low', mult: 1.0, minutes: [20, 60] },
      { key: 'fair', name: 'Fair', mult: 1.2, minutes: [90, 180] },
      { key: 'high', name: 'High', mult: 1.4, minutes: [240, 420] },
    ],
    overnight: 480, // shelf minutes that pass while you sleep
  };
  C.ORDERS = {
    count: 3,
    bonus: 1.5, // an order pays this much more than the items' base price
    friend: 12, // friendship with the villager who asked
    refill: 60, // game minutes until a new order after one is delivered
    skip: 180, // ...or skipped
  };

  // ---------- state ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.shelves = []; // [{ id, n, price (index into STAND.prices), left (minutes), coins (when sold), buyer }]
    for (var i = 0; i < C.STAND.shelves; i++) s.shelves.push(null);
    s.orders = []; // [{ from, items: [[id, n], ...], gold }] or { wait: minutes }
    for (var k = 0; k < C.ORDERS.count; k++) s.orders.push({ wait: k * 30 });
    s.orderNo = 0; // how many orders have been made, for variety
    return s;
  };

  var rand = function (s, a, b) { return L.rand(s.seed, s.day, a, b); };

  // What one sells for: base price, the stand's instant price, or a shelf price level.
  L.basePrice = function (id) { return (C.ITEMS[id] && C.ITEMS[id].sell) || 0; };
  L.instantPrice = function (id, n) { return Math.max(1, Math.floor(L.basePrice(id) * C.STAND.instant)) * n; };
  L.shelfPrice = function (id, n, level) { return Math.round(L.basePrice(id) * C.STAND.prices[level].mult) * n; };

  // Sells n of the item in a bag slot right away. Returns the gold, or 0.
  L.sellNow = function (s, slotIndex, n) {
    var slot = s.inv[slotIndex];
    if (!slot || !L.basePrice(slot.id)) return 0;
    n = Math.max(1, Math.min(n || slot.n, slot.n));
    var id = slot.id, gold = L.instantPrice(id, n);
    L.removeAt(s, slotIndex, n);
    s.gold += gold;
    s.stats.earned += gold;
    L.discover(s, id);
    return gold;
  };

  // Puts n of a bag slot's item on an empty shelf at a price level. Returns 'ok', or 'busy' / 'nosell' / 'empty'.
  L.listItem = function (s, shelf, slotIndex, n, level) {
    var slot = s.inv[slotIndex];
    if (s.shelves[shelf]) return 'busy';
    if (!slot) return 'empty';
    if (!L.basePrice(slot.id)) return 'nosell';
    n = Math.max(1, Math.min(n || slot.n, slot.n, C.STAND.perShelf));
    var p = C.STAND.prices[level] ? level : 1, range = C.STAND.prices[p].minutes;
    var left = Math.round(range[0] + (range[1] - range[0]) * rand(s, 301 + shelf, s.time));
    s.shelves[shelf] = { id: slot.id, n: n, price: p, left: left, coins: 0, buyer: null };
    L.removeAt(s, slotIndex, n);
    L.discover(s, slot.id);
    return 'ok';
  };

  // Takes an unsold lot back into the bag. Returns 'ok', 'sold' or 'full'.
  L.unlist = function (s, shelf) {
    var e = s.shelves[shelf];
    if (!e) return 'ok';
    if (e.coins) return 'sold';
    if (!L.canAdd(s, e.id, e.n)) return 'full';
    L.addItem(s, e.id, e.n);
    s.shelves[shelf] = null;
    return 'ok';
  };

  // Collects the coins from every sold shelf. Returns the gold.
  L.collectStand = function (s) {
    var gold = 0;
    s.shelves.forEach(function (e, i) {
      if (e && e.coins) {
        gold += e.coins;
        s.shelves[i] = null;
      }
    });
    s.gold += gold;
    s.stats.earned += gold;
    return gold;
  };

  L.standCoins = function (s) {
    return s.shelves.reduce(function (sum, e) { return sum + (e && e.coins ? e.coins : 0); }, 0);
  };

  // A villager buys the lot on a shelf (buyer = their key, or null for a random one). Returns the sale.
  L.sellLot = function (s, i, buyer) {
    var e = s.shelves[i];
    if (!e || e.coins) return null;
    e.left = 0;
    e.coins = L.shelfPrice(e.id, e.n, e.price);
    e.buyer = buyer || C.VILLAGER_ORDER[Math.floor(rand(s, 401 + i, s.time) * C.VILLAGER_ORDER.length)];
    return { shelf: i, id: e.id, n: e.n, coins: e.coins, buyer: e.buyer };
  };

  // Time passes for the stall and the order board. Returns { sold: [sales], due: [shelf indexes] }.
  // A lot whose time is up is sold at once, or, with defer, listed as due: the farmer is in town to watch a
  // villager walk up and buy it (the world then calls sellLot).
  L.standTick = function (s, minutes, defer) {
    var sold = [], due = [];
    s.shelves.forEach(function (e, i) {
      if (!e || e.coins) return;
      e.left = Math.max(0, e.left - minutes);
      if (e.left > 0) return;
      if (defer) due.push(i);
      else sold.push(L.sellLot(s, i, null));
    });
    s.orders.forEach(function (o, i) {
      if (o.wait == null) return;
      o.wait -= minutes;
      if (o.wait <= 0) s.orders[i] = L.makeOrder(s, i);
    });
    return { sold: sold, due: due };
  };

  // ---------- orders ----------
  // Things the farmer can get right now: crops in season, what their animals make, fish once they have a rod,
  // and ore from mine floors they have reached.
  L.orderCandidates = function (s) {
    var out = [];
    C.CROP_KEYS.forEach(function (k) {
      var crop = C.CROPS[k];
      if (!crop.sickle && L.cropInSeason(k, s.day)) out.push(crop.item);
    });
    s.animals.forEach(function (a) {
      var p = C.ANIMALS[a.kind].product;
      if (out.indexOf(p) < 0) out.push(p);
    });
    if (L.hasItem(s, 'rod')) out.push('fish_s', 'fish_m');
    C.MINE.drops.forEach(function (d) {
      if (d.id !== 'stone' && d.id !== 'gem' && d.minFloor && s.stats.deepest >= d.minFloor) out.push(d.id);
    });
    return out.filter(function (id) { return L.basePrice(id) > 0; });
  };

  // A new order for a board slot, from a villager who has no other order on the board.
  L.makeOrder = function (s, slot) {
    var pool = L.orderCandidates(s), no = s.orderNo++;
    if (!pool.length) return { wait: 120 };
    var others = s.orders.filter(function (o, i) { return i !== slot && o && o.from; }).map(function (o) { return o.from; });
    for (var attempt = 0; attempt < 8; attempt++) {
      var o = orderFrom(s, pool, no, slot, attempt);
      if (others.indexOf(o.from) < 0) return o;
    }
    return o;
  };

  function orderFrom(s, pool, no, slot, attempt) {
    var r = function (k) { return L.rand(s.seed, no, slot, k, attempt); };
    var kinds = Math.min(pool.length, 1 + (r(1) < 0.55 ? 1 : 0) + (s.stats.earned > 8000 && r(2) < 0.4 ? 1 : 0));
    var items = [], used = {};
    for (var k = 0; items.length < kinds && k < 20; k++) {
      var id = pool[Math.floor(r(10 + k) * pool.length)];
      if (used[id]) continue;
      used[id] = 1;
      // aim for 150-450G of goods per item, 1 to 10 of it
      var want = 150 + r(40 + k) * 300 + Math.min(600, s.stats.earned / 50);
      items.push([id, Math.max(1, Math.min(10, Math.round(want / L.basePrice(id))))]);
    }
    var value = items.reduce(function (sum, it) { return sum + L.basePrice(it[0]) * it[1]; }, 0);
    var from = C.VILLAGER_ORDER[Math.floor(r(3) * C.VILLAGER_ORDER.length)];
    return { from: from, items: items, gold: Math.round(value * C.ORDERS.bonus / 10) * 10 };
  }

  L.canDeliver = function (s, i) {
    var o = s.orders[i];
    return !!o && !!o.items && o.items.every(function (it) { return L.countItem(s, it[0]) >= it[1]; });
  };

  // Hands over an order's items. Returns the gold, or 0 if something is missing.
  L.deliverOrder = function (s, i) {
    if (!L.canDeliver(s, i)) return 0;
    var o = s.orders[i];
    o.items.forEach(function (it) { L.removeItem(s, it[0], it[1]); L.discover(s, it[0]); });
    s.gold += o.gold;
    s.stats.earned += o.gold;
    L.addFriend(s, o.from, C.ORDERS.friend);
    s.orders[i] = { wait: C.ORDERS.refill };
    return o.gold;
  };

  L.skipOrder = function (s, i) {
    if (s.orders[i] && s.orders[i].items) s.orders[i] = { wait: C.ORDERS.skip };
  };

  // ---------- the clock and the night ----------
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    r.standSold = L.standTick(s, C.STAND.overnight).sold;
    r.standCoins = L.standCoins(s);
    return r;
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.sh = s.shelves.map(function (e) {
      return e ? [e.id, e.n, e.price, Math.max(0, Math.round(e.left)), e.coins, e.buyer ? C.VILLAGER_ORDER.indexOf(e.buyer) : -1] : 0;
    });
    o.od = [s.orders.map(function (x) {
      return x.items ? [C.VILLAGER_ORDER.indexOf(x.from), x.gold].concat([].concat.apply([], x.items)) : Math.max(0, Math.round(x.wait));
    }), s.orderNo];
    return o;
  };

  function int(v, min, max, fallback) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return null;
    s.shelves = [];
    for (var i = 0; i < C.STAND.shelves; i++) {
      var e = Array.isArray(o.sh) ? o.sh[i] : null;
      if (Array.isArray(e) && L.basePrice(e[0])) {
        s.shelves.push({
          id: e[0], n: int(e[1], 1, C.STAND.perShelf, 1), price: int(e[2], 0, C.STAND.prices.length - 1, 1),
          left: int(e[3], 0, 1e4, 0), coins: int(e[4], 0, 1e7, 0), buyer: C.VILLAGER_ORDER[int(e[5], -1, 99, -1)] || null,
        });
      } else s.shelves.push(null);
    }
    var list = Array.isArray(o.od) && Array.isArray(o.od[0]) ? o.od[0] : [];
    s.orders = [];
    for (var k = 0; k < C.ORDERS.count; k++) {
      var x = list[k];
      var items = [];
      if (Array.isArray(x)) for (var j = 2; j + 1 < x.length; j += 2) if (L.basePrice(x[j])) items.push([x[j], int(x[j + 1], 1, 99, 1)]);
      if (Array.isArray(x) && items.length && C.VILLAGER_ORDER[x[0]]) s.orders.push({ from: C.VILLAGER_ORDER[x[0]], gold: int(x[1], 1, 1e6, 100), items: items });
      else s.orders.push({ wait: typeof x === 'number' ? int(x, 0, 1e4, 0) : k * 30 });
    }
    s.orderNo = Array.isArray(o.od) ? int(o.od[1], 0, 1e9, 0) : 0;
    return s;
  };
})(window.Farm = window.Farm || {});
