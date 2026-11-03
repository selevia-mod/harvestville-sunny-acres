// Guards against a changed game on the same channel (the 4 Nov 2026 online review: a broadcast says who sent it, and
// nothing on the server checks it). Until the server stamps the sender itself, this keeps the harm small:
//   - "help", "pick" and "give" each start a server call on the owner's phone: at most one every 15 s per kind (one more
//     after the wait, so a real friend's help is still collected), whatever floods in;
//   - "rocks" (a list of broken rocks on a mine floor) is only taken as an answer to this phone's own question
//     ("rocksq", 19r-follow.js), for a few seconds after asking;
//   - a charge in a hunt someone else's phone runs (19v-wild.js wildCopy) costs energy at most once every 3 s, and at
//     most 40 energy in 2 minutes.
// Loaded after every other 19zz- file, so these wrappers see the messages first.
(function (F) {
  'use strict';
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var SPACE = 15000, ASKED = 8000, HIT_GAP = 3000, HIT_WINDOW = 120000, HIT_MAX = 40;

  // ---------- server calls started by others' messages ----------
  var last = {}, later = {};
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event === 'help' || event === 'pick' || event === 'give') {
      var now = Date.now(), wait = (last[event] || 0) + SPACE - now;
      if (wait > 0) {
        if (!later[event]) later[event] = setTimeout(function () { later[event] = null; last[event] = Date.now(); onMessage.call(O, event, payload); }, wait);
        return;
      }
      last[event] = now;
    }
    if (event === 'rocks' && !(O.rocksAsked && Date.now() - O.rocksAsked < ASKED)) return;
    return onMessage.call(O, event, payload);
  };
  var send = O.send;
  O.send = function (event, payload) {
    if (event === 'rocksq') O.rocksAsked = Date.now();
    return send.call(O, event, payload);
  };

  // ---------- a charge from a hunt run on someone else's phone ----------
  var wildHit = P.wildHit;
  P.wildHit = function (a) {
    if (this.wild && this.wild.lead) {
      var g = F.session.hitGuard = F.session.hitGuard || { at: 0, list: [] }, now = Date.now();
      g.list = g.list.filter(function (h) { return now - h.t < HIT_WINDOW; });
      var lost = g.list.reduce(function (n, h) { return n + h.e; }, 0);
      if (now - g.at < HIT_GAP || lost >= HIT_MAX) return this.wildBack(a, this.feet()); // (it still backs off)
      var before = this.state.energy;
      wildHit.call(this, a);
      g.at = now;
      g.list.push({ t: now, e: Math.max(0, before - this.state.energy) });
      return;
    }
    return wildHit.call(this, a);
  };
})(window.Farm = window.Farm || {});
