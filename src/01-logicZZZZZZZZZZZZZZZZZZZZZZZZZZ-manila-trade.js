// Mang Danny's Trading Post and the Talipapa's vendors, the rules (owner, 18 Nov 2026; numbers in C.MNTRADE,
// 00-zzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-trade.js). Each shop sells its items at 2 x their sell price, up to its daily
// stock of each (a new day, a full shelf again). Mang Danny buys his (the Mixer's goods) at the sell price, any amount.
// What you buy goes into the bag; what the bag has no room for waits in the basket by the farmhouse; with no room in
// either, nothing is bought. The save: 'tx' = [day, [item, bought that day, ...], tours seen (bits)], only when there is
// anything in it (an old save has none).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var X = C.MNTRADE;
  if (!X) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var sell = function (id) { return (C.ITEMS[id] && C.ITEMS[id].sell) || 0; };
  L.txItems = function (shop) {
    var sh = X.shops[shop];
    return !sh ? [] : sh.items === 'mixer' ? C.WORKSHOPS.mixer.recipes.map(function (r) { return r.out; }) : sh.items;
  };
  L.txShopOf = function (id) { for (var k in X.shops) if (L.txItems(k).indexOf(id) >= 0) return k; return null; };
  L.txPrice = function (id) { return Math.max(1, Math.round(sell(id) * X.mult)); }; // (what they ask)
  L.txPays = sell; // (what Mang Danny pays)
  L.txNew = function () { return { d: 0, n: {}, t: 0 }; };
  var tx = function (s) { if (!s.tx) s.tx = L.txNew(); if (s.tx.d !== s.day) { s.tx.d = s.day; s.tx.n = {}; } return s.tx; };
  L.txLeft = function (s, id) {
    var sh = X.shops[L.txShopOf(id)], t = s.tx;
    return sh ? Math.max(0, sh.stock - (t && t.d === s.day ? t.n[id] || 0 : 0)) : 0;
  };
  // how many fit: the bag first, then the basket (999 of an item at most)
  var room = function (s, id, n) {
    var k = 0;
    while (k < n && L.canAdd(s, id, k + 1)) k++;
    return k + Math.max(0, 999 - ((s.basket || {})[id] || 0));
  };
  // buy up to n (what is left today): { ok, n, gold, basket } or { why: 'shop' | 'stock' | 'gold' | 'full', cost }
  L.txBuy = function (s, shop, id, n) {
    if (L.txShopOf(id) !== shop) return { why: 'shop' };
    n = Math.min(int(n, 1, 999, 1), L.txLeft(s, id));
    if (n <= 0) return { why: 'stock' };
    var cost = n * L.txPrice(id);
    if (s.gold < cost) return { why: 'gold', cost: cost };
    if (room(s, id, n) < n) return { why: 'full' };
    s.gold -= cost;
    var left = L.addItem(s, id, n);
    if (left > 0) { s.basket = s.basket || {}; s.basket[id] = (s.basket[id] || 0) + left; }
    var t = tx(s);
    t.n[id] = (t.n[id] || 0) + n;
    return { ok: true, n: n, gold: cost, basket: left };
  };
  // sell up to n from the bag to Mang Danny: { ok, n, gold } or { why: 'item' | 'none' }
  L.txSell = function (s, id, n) {
    var sh = X.shops[L.txShopOf(id)];
    if (!sh || !sh.buys) return { why: 'item' };
    var k = Math.min(int(n, 1, 1e6, 1), L.countItem(s, id));
    if (!(k > 0)) return { why: 'none' };
    k = L.removeItem(s, id, k);
    var gold = k * L.txPays(id);
    s.gold += gold;
    if (s.stats) s.stats.earned = (s.stats.earned || 0) + gold;
    return { ok: true, n: k, gold: gold };
  };
  L.txTourSeen = function (s, key) { var i = X.tours.indexOf(key); return i < 0 || !!(((s.tx && s.tx.t) >> i) & 1); };
  L.txTourTake = function (s, key) {
    if (L.txTourSeen(s, key)) return false;
    if (!s.tx) s.tx = L.txNew();
    s.tx.t |= 1 << X.tours.indexOf(key);
    return true;
  };

  var newState = L.newState;
  L.newState = function (info) { var s = newState(info); s.tx = L.txNew(); return s; };
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) { var r = endDay(s, passedOut, info); if (s.tx && s.tx.d !== s.day) { s.tx.d = 0; s.tx.n = {}; } return r; };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), t = s.tx, n = [];
    if (!t) return o;
    if (t.d === s.day) Object.keys(t.n).sort().forEach(function (id) { if (t.n[id] > 0) n.push(id, t.n[id]); });
    if (n.length || t.t) o.tx = [n.length ? t.d : 0, n, t.t || 0];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var t = s.tx = L.txNew(), a = o && Array.isArray(o.tx) ? o.tx : null;
    if (!a) return s;
    t.t = int(a[2], 0, 0xffff, 0);
    var b = Array.isArray(a[1]) ? a[1] : [], d = int(a[0], 0, 1e7, 0);
    if (d && d === s.day) {
      for (var i = 0; i + 1 < b.length; i += 2) { var n = int(b[i + 1], 0, 1e6, 0); if (n && L.txShopOf(b[i])) t.n[b[i]] = n; }
      if (Object.keys(t.n).length) t.d = d;
    }
    return s;
  };
})(window.Farm = window.Farm || {});
