// Following a friend around their world (owner, 29 Oct 2026): into their mine (the same rocks, the same floor, and a
// rock either of you breaks is gone for both), and their town's market stall shows what THEY sell (their Market lots,
// to buy), not your own shelves. Mixed into WorldScene; runs after 19h-online.js and 19l-market.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var noop = function () {};
  var inMine = function (w) { return w && w.mapKey === 'mine' && w.mine && w.sys && w.sys.isActive(); };

  // ---------- their town's stall ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var v = F.session.visit;
    if (o.type === 'stand' && v && v.inTown) {
      return { label: 'Look', icon: C.ICON.crate, run: function () { F.ui.openStall(v.host, v.name, null); } };
    }
    if (o.type === 'orders' && v && v.inTown) {
      return { label: 'Orders', icon: C.ICON.book, run: function () { F.ui.dialog('ORDERS\nThe order board is for your own stall. Your orders are waiting in your own town.'); } };
    }
    return extraObjectAction.call(this, o, held, def);
  };

  // ---------- the mine, together ----------
  // A rock you break: the others on this floor see it go (and the ladder, if it was over it).
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var r = breakRock.call(this, idx, t, items);
    if (r && O.on && O.chan) O.send('rock', { fl: F.session.mineFloor, i: idx });
    return r;
  };
  P.remoteRock = function (idx) {
    var m = this.mine;
    if (!m || m.broken[idx] || m.rocks.indexOf(idx) < 0) return;
    m.broken[idx] = 1;
    var x = idx % this.map.width, y = Math.floor(idx / this.map.width);
    if (idx === m.stairs) this.putTile('Walls', this.gids.ladder_down, x, y);
    else this.layers.Walls.removeTileAt(x, y);
    this.recollide();
  };

  // Walking onto a floor: ask the others there which rocks are gone already.
  var setupMine = P.setupMine;
  P.setupMine = function () {
    setupMine.call(this);
    var floor = F.session.mineFloor;
    if (O.on && O.chan) setTimeout(function () { if (O.chan) O.send('rocksq', { fl: floor }); }, 1500);
  };

  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    var p = payload && typeof payload === 'object' ? payload : {}, w = F.world, who = typeof p.id === 'string' ? O.others[p.id] : null;
    var here = who && inMine(w) && Number(p.fl) === F.session.mineFloor;
    if (event === 'rock') { if (here) w.remoteRock(Math.floor(Number(p.i))); return; }
    if (event === 'rocksq') {
      if (here) {
        var gone = Object.keys(w.mine.broken).map(Number).filter(function (i) { return w.mine.rocks.indexOf(i) >= 0; }).slice(0, 400);
        if (gone.length) O.send('rocks', { fl: F.session.mineFloor, l: gone });
      }
      return;
    }
    if (event === 'rocks') { if (here && Array.isArray(p.l)) p.l.slice(0, 400).forEach(function (i) { w.remoteRock(Math.floor(Number(i))); }); return; }
    onMessage.call(O, event, payload);
  };

  // The owner went into the mine, or to another floor of it (heard as a move or from the presence list): "follow them?"
  var hostMoved = O.hostMoved;
  O.hostMoved = function (v, host) {
    if (host && host.map === 'mine') return O.hostToMine(v, host);
    return hostMoved.call(O, v, host);
  };

  O.hostToMine = function (v, host) {
    var w = F.world, fl = host.fl || 1;
    if (!w || w.busy || !F.ui || !v.inTown || (w.mapKey !== 'town' && w.mapKey !== 'mine') || (w.mapKey === 'mine' && F.session.mineFloor === fl)) return;
    v.asked = v.asked || {};
    if (v.asked['mine:' + fl]) return;
    v.asked['mine:' + fl] = 1;
    var show = function () {
      var ww = F.world;
      if (F.session.visit !== v || !ww || ww.busy) return;
      if (F.ui.modals.length) return setTimeout(show, 1200);
      if (F.Audio) F.Audio.sfx('found');
      F.ui.dialog(v.name.toUpperCase().slice(0, 18) + ' IS IN THE MINE\n' + v.name + ' went to floor ' + fl + ' of the mine. Follow them?', [
        { label: 'Stay here', color: 0xc0703a },
        { label: 'Follow', cb: function () { var w2 = F.world; if (w2 && !w2.busy && F.session.visit === v) w2.travel('mine', 'entrance', fl); } },
      ]);
    };
    show();
  };
  void noop;
})(window.Farm = window.Farm || {});
