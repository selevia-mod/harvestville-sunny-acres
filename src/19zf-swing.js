// Friends see each other work (owner, 3 Nov 2026: "users are walking or smashing the rock but I can't see how they doing
// that. It looks like lagging then suddenly the rock gone"). Each tool swing is told to the others on the same map (and
// mine floor), and their farmer swings it on your screen (18-polish.js remoteUse). A rock they break pops when their
// hammer lands (19r-follow.js remoteRock).
(function (F) {
  'use strict';
  var C = F.Config;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var EVERY = 180; // ms: the quickest swings are told (a held, charged swing is one message)
  var DIRS = { down: 1, up: 1, left: 1, right: 1 };
  var sent = 0;

  var floorOf = function (w) { return w.mapKey === 'mine' ? F.session.mineFloor : 0; };
  var near = function (w) {
    var fl = floorOf(w);
    for (var k in O.others) if (O.others[k].map === w.mapKey && (O.others[k].fl || 0) === fl) return true;
    return false;
  };

  var animateUse = P.animateUse;
  P.animateUse = function (frame, kind) {
    animateUse.call(this, frame, kind);
    var now = Date.now();
    if (!O.on || !O.chan || this.busy || now - sent < EVERY || !near(this)) return;
    sent = now;
    O.send('use', { map: this.mapKey, fl: floorOf(this), f: frame, k: kind === 'pour' ? 'pour' : 'swing', d: this.dir });
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event !== 'use') return onMessage.call(O, event, payload);
    var p = payload && typeof payload === 'object' ? payload : {}, w = F.world;
    var r = w && w.remotes && typeof p.id === 'string' ? w.remotes[p.id] : null, frame = Math.floor(Number(p.f));
    if (!r || !w.sys || !w.sys.isActive() || w.busy || p.map !== w.mapKey || (Number(p.fl) || 0) !== floorOf(w)) return;
    if (!(frame >= 0 && frame < C.ICON_ORDER.length) || !DIRS[p.d]) return;
    w.remoteUse(r, p.d, frame, p.k === 'pour' ? 'pour' : 'swing');
  };
})(window.Farm = window.Farm || {});
