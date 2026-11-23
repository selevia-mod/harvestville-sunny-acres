// Gifts and Market lots on their way (01-logicZZ...-sends.js, security check 23 Nov 2026): sent with a request id saved
// first; an answer lost waits and is asked again when the game is next online, never refunded on the spot.
//   O.sendItems(e)  -> Promise of { ok, code, waiting }: waiting when no answer came (it is in the save; checked later)
//   O.settleSends() -> the waiting ones asked again (when the game comes online: O.prizes)
// Until the server has farm_give_req_v1 / farm_market_list_req_v1 (SQL 56), the old calls, as before.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  if (!O) return;
  var SETTLE_AFTER = 30000; // ms: one this old with no answer is asked again
  var missing = function (e) { return /Could not find the function/i.test((e && e.message) || ''); };
  var uuid = function () {
    var c = window.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  O.sendsOld = false; // (the server has no _req_v1 yet, SQL 56: the old calls)
  var call = function (e) {
    if (e.k === 'm') {
      return O.sendsOld ? F.Net.rpc('farm_market_list_v1', { p_item: e.id, p_qty: e.n, p_price: e.price })
        : F.Net.rpc('farm_market_list_req_v1', { p_item: e.id, p_qty: e.n, p_price: e.price, p_request_id: e.r });
    }
    return O.sendsOld ? F.Net.rpc('farm_give_v1', { p_to: e.to, p_item: e.id, p_n: e.n })
      : F.Net.rpc('farm_give_req_v1', { p_to: e.to, p_item: e.id, p_n: e.n, p_request_id: e.r });
  };
  // e: { k: 'g' | 'm', to, id, n, q, price, keep }; its items already out of the bag. keep: a refusal straight away is
  // the caller's to put back (a pile goes back on the ground); one that waited and is refused later comes to the bag.
  O.sendItems = function (e) {
    var s = F.session.state;
    e.r = uuid();
    L.sendAdd(s, e);
    F.Host.save(s);
    var once = function () {
      var old = O.sendsOld;
      return call(e).then(function (r) {
        if ((r && r.ok) || e.keep) L.sendDone(s, e.r); else L.sendBack(s, e.r); // (refused: back into the bag; keep: the caller puts it back)
        F.Host.save(s);
        return r || { ok: false };
      }, function (err) {
        if (!old && missing(err)) { O.sendsOld = true; return once(); }
        if (old) { // (the old call: no id to ask again with, so as before: back into the bag)
          L.sendDone(s, e.r);
          if (!e.keep) giveBackNow(s, e);
          F.Host.save(s);
          throw err;
        }
        F.Host.save(s);
        return { ok: false, waiting: true, error: err };
      });
    };
    return once();
  };
  var giveBackNow = function (s, e) {
    var left = e.q && L.addItemQ ? L.addItemQ(s, e.id, e.n, e.q) : L.addItem(s, e.id, e.n);
    if (left) s.basket[e.id] = Math.min(999, (s.basket[e.id] || 0) + left);
  };
  O.settleSends = function () {
    var s = F.session.state, now = Date.now();
    if (!O.on || O.settlingSends || O.sendsOld) return Promise.resolve(0);
    var old = L.sendsOf(s).filter(function (e) { return now - e.at >= SETTLE_AFTER || e.at > now; });
    if (!old.length) return Promise.resolve(0);
    O.settlingSends = true;
    var back = 0, sent = 0;
    return old.reduce(function (p, e) {
      return p.then(function () {
        return call(e).then(function (r) {
          if (r && r.ok) { L.sendDone(s, e.r); if (e.k === 'm') L.mrAdd(s, e.id, e.n, e.price, r.id); sent++; } else if (L.sendBack(s, e.r)) back++;
        }, function (err) { if (missing(err)) O.sendsOld = true; }); // (no answer again: it waits for next time)
      });
    }, Promise.resolve()).then(function () {
      O.settlingSends = false;
      if (back || sent) {
        F.Host.save(s);
        F.bus.emit('hud');
        if (F.ui && F.ui.toast) {
          if (back) F.ui.toast('Something you sent could not go through. It is back in your bag.', 3000);
          else F.ui.toast('What you sent earlier went through.', 2400, 0x2f5a22);
        }
      }
      return back + sent;
    });
  };
  var prizes = O.prizes;
  O.prizes = function () {
    return prizes.call(O).then(function (won) { return O.settleSends().then(function () { return won; }, function () { return won; }); });
  };
  void C;
})(window.Farm = window.Farm || {});
