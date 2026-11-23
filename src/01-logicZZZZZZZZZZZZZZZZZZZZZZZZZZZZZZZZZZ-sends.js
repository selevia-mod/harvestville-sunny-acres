// Things on their way to the server (security check, 23 Nov 2026): a gift to a friend (Give, or a friend picking up what
// you dropped) and a lot put up at the Market stall. Out of the bag first, then sent with a request id kept in the save
// ('ps'), as refills are (L.cleanBuys): an answer lost to a bad connection was refunded at once before, though the server
// had it already, so the friend got the 99 and the giver had them again. Now an unanswered one waits, and is asked
// again with the same id (farm_give_req_v1, farm_market_list_req_v1: the server answers a known id as it did the first time):
// sent, it is done; refused, it comes back to the bag. On the screen: 19zzz...-sends.js.
//   L.sendsOf(s)              the list: [{ r, k: 'g' gift | 'm' Market lot, to, id, n, q, price, at }]
//   L.sendAdd(s, e)           one more (at most 20 waiting: the oldest then comes back to the bag)
//   L.sendDone(s, r)          sent: off the list
//   L.sendBack(s, r)          refused: off the list and back into the bag (the Harvest Basket if it is full)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var MOST = 20;
  var int = function (v, lo, hi, d) { v = Math.floor(Number(v)); return isFinite(v) && v >= lo && v <= hi ? v : d; };
  var ok = function (id) { return !!(C.ITEMS[id] && C.ITEMS[id].kind !== 'tool'); };

  L.sendsOf = function (s) { return s.ps || (s.ps = []); };
  var giveBack = function (s, e) {
    var left = e.q && L.addItemQ ? L.addItemQ(s, e.id, e.n, e.q) : L.addItem(s, e.id, e.n); // (a Silver or Gold crop as it was)
    if (left) s.basket[e.id] = Math.min(999, (s.basket[e.id] || 0) + left);
  };
  L.sendAdd = function (s, e) {
    var list = L.sendsOf(s);
    list.push({ r: e.r, k: e.k === 'm' ? 'm' : 'g', to: e.to || '', id: e.id, n: e.n, q: e.q || 0, price: e.price || 0, at: e.at || Date.now() });
    while (list.length > MOST) giveBack(s, list.shift());
    return e;
  };
  L.sendDone = function (s, r) { s.ps = L.sendsOf(s).filter(function (e) { return e.r !== r; }); };
  L.sendBack = function (s, r) {
    var e = L.sendsOf(s).filter(function (x) { return x.r === r; })[0];
    if (!e) return null;
    L.sendDone(s, r);
    giveBack(s, e);
    return e;
  };

  // The lots this farm put up at its stall (security check, 23 Nov 2026: the server keeps no bag, so a lot put up from
  // outside the game, of things never owned, paid out its Gold when bought and its items when taken back). Kept in the
  // save ('mr': [since, item, qty, price, id, ...]): what sold or came back is paid only for a lot on it, once.
  // A farm from before this (no 'mr' yet) is paid for any lot for 3 days (MR_GRACE): the lots it had up then (2 days).
  var MR_GRACE = 3 * 86400000, MR_MOST = 12;
  L.mrOf = function (s) { return s.mr || (s.mr = { since: 1, lots: [] }); };
  L.mrAdd = function (s, item, qty, price, id) {
    var m = L.mrOf(s);
    m.lots.push({ item: item, qty: qty, price: price, id: Number(id) || 0 });
    if (m.lots.length > MR_MOST) m.lots.shift();
  };
  // is it on the record (or in the grace)? (Take back asks first: the server hands the items back as it takes the lot down)
  L.mrHas = function (s, item, qty, id, now) {
    var m = L.mrOf(s);
    return m.lots.some(function (l) { return id && l.id ? l.id === id : l.item === item && l.qty === qty; }) || (now == null ? Date.now() : now) - m.since < MR_GRACE;
  };
  // a lot that sold, came back or was taken back: true (and off the record) when this farm put it up
  L.mrTake = function (s, item, qty, price, id, now) {
    var m = L.mrOf(s), i = -1;
    m.lots.some(function (l, k) { if (id && l.id === id ? true : (!id || !l.id) && l.item === item && l.qty === qty && (price == null || l.price === price)) { i = k; return true; } return false; });
    if (i >= 0) { m.lots.splice(i, 1); return true; }
    return (now == null ? Date.now() : now) - m.since < MR_GRACE;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), list = s.ps || [];
    if (list.length) o.ps = list.map(function (e) { return [e.r, e.k, e.to, e.id, e.n, e.q, e.price, e.at]; });
    var m = L.mrOf(s);
    o.mr = [m.since].concat.apply([m.since], m.lots.map(function (l) { return [l.item, l.qty, l.price, l.id]; }));
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.ps = (o && Array.isArray(o.ps) ? o.ps : []).filter(function (a) {
      return Array.isArray(a) && UUID.test(String(a[0])) && (a[1] === 'g' || a[1] === 'm') && typeof a[3] === 'string' && ok(a[3]);
    }).slice(-MOST).map(function (a) {
      return { r: String(a[0]), k: a[1], to: typeof a[2] === 'string' ? a[2].slice(0, 40) : '', id: a[3], n: int(a[4], 1, 99, 1), q: int(a[5], 0, 9, 0),
        price: int(a[6], 0, 100000, 0), at: int(a[7], 0, 1e14, 0) };
    });
    var mr = o && Array.isArray(o.mr) ? o.mr : null, lots = [];
    for (var i = 1; mr && i + 3 < mr.length && lots.length < MR_MOST; i += 4) {
      if (typeof mr[i] === 'string' && C.ITEMS[mr[i]]) lots.push({ item: mr[i], qty: int(mr[i + 1], 1, 99, 1), price: int(mr[i + 2], 0, 100000, 0), id: int(mr[i + 3], 0, 9e15, 0) });
    }
    var older = !mr && o && typeof o === 'object' && Object.keys(o).length > 0; // (no 'mr' in a farm's save: from before it, 3 days' grace)
    s.mr = { since: mr ? int(mr[0], 0, 1e14, 1) : older ? Date.now() : 1, lots: lots };
    return s;
  };
})(window.Farm = window.Farm || {});
