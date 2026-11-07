// Following a friend around their world (owner, 29 Oct 2026): into their mine (the same rocks, the same floor, and a
// rock either of you breaks is gone for both), and their town's market stall shows what THEY sell (their Market lots,
// to buy), not your own shelves. Mixed into WorldScene; runs after 19h-online.js and 19l-market.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
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
    var got = Object.keys(items)[0], icon = got === 'stone' ? C.ICON.stone : got && C.ITEMS[got] ? C.ITEMS[got].icon : -1; // (what came out of it, for the others to see)
    if (r && O.on && O.chan) O.send('rock', { fl: F.session.mineFloor, i: idx, it: icon });
    return r;
  };
  // by = their farmer, when it happened just now: the rock pops with dust and a crack, as yours does, when their hammer
  // lands (owner, 3 Nov 2026: "it looks like lagging then suddenly the rock gone"). A floor's list on arrival just goes.
  P.remoteRock = function (idx, by, icon) {
    var self = this, m = this.mine;
    if (!m || m.broken[idx] || m.rocks.indexOf(idx) < 0) return;
    m.broken[idx] = 1;
    var x = idx % this.map.width, y = Math.floor(idx / this.map.width), t = { x: x, y: y };
    var gone = function () {
      if (!self.mine || self.mine !== m) return;
      if (by) self.popOut('Walls', t);
      if (idx === m.stairs) self.putTile('Walls', self.gids.ladder_down, x, y);
      else self.layers.Walls.removeTileAt(x, y);
      self.recollide();
      if (!by) return;
      self.impact('hammer', { kind: 'debris', debris: 'stone' }, t, true);
      if (icon >= 0 && self.floatIcon) self.floatIcon((x + 0.5) * T, (y + 0.3) * T, icon);
      self.remoteSound({ x: (x + 0.5) * T, y: (y + 0.5) * T }, 'stonebreak');
    };
    if (by && by.useUntil > this.time.now) this.time.delayedCall(this.IMPACT ? this.IMPACT.swing : 110, gone);
    else gone();
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
    if (event === 'rock') {
      var it = Math.floor(Number(p.it));
      if (here) w.remoteRock(Math.floor(Number(p.i)), (w.remotes && w.remotes[p.id]) || {}, it >= 0 && it < C.ICON_ORDER.length ? it : -1);
      return;
    }
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
      F.ui.followNote(v.name + ' went to floor ' + fl + ' of the mine.', 'Follow', function () { var w2 = F.world; if (w2 && !w2.busy && F.session.visit === v) w2.travel('mine', 'entrance', fl); });
    };
    show();
  };
  // ---------- Bakunawa's Lair, together (19zt-lair.js) ----------
  // Into the Lair behind the owner: straight to their floor (from Magayon, or from another floor of it). The floors
  // reached that way do not count as yours (no lift stop): only walking through a gate does.
  var follow = O.follow;
  O.follow = function (to) {
    var w = F.world, v = F.session.visit, host = v && O.others[v.host];
    var cfg = F.dungeonOf && F.dungeonOf(to); // (any cave: the Lair, or a hunting place's own, 19zt-lair.js)
    if (cfg && w && !w.busy && (w.mapKey === cfg.from || w.mapKey === to)) return w.travel(to, 'entrance', (host && host.map === to && host.fl) || 1);
    return follow.call(O, to);
  };
  // The owner went down (or up) to another floor while you are in the Lair: "follow them?", once for each floor.
  // (19zt-lair.js sends it here: it has to come before 19v-wild.js, which sees the same map and stops.)
  O.hostToLair = function (v, host) {
    var w = F.world, fl = host.fl || 1, cave = host.map, cfg = F.dungeonOf && F.dungeonOf(cave);
    if (!w || w.busy || !F.ui || !cfg || w.mapKey !== cave || F.session.lairFloor === fl) return;
    v.asked = v.asked || {};
    if (v.asked[cave + ':' + fl]) return;
    v.asked[cave + ':' + fl] = 1;
    var show = function () {
      var ww = F.world, now = O.others[v.host];
      if (F.session.visit !== v || !ww || ww.busy || ww.mapKey !== cave) return;
      if (!now || now.map !== cave || now.fl !== fl) { delete v.asked[cave + ':' + fl]; return; } // (they have moved on)
      if (F.ui.modals.length) return setTimeout(show, 1200);
      F.ui.followNote(v.name + ' went ' + (fl > F.session.lairFloor ? 'down' : 'up') + ' to floor ' + fl + ' of ' + (cfg.lair ? 'the Lair' : cfg.name) + '.', 'Follow', function () { var w2 = F.world; if (w2 && !w2.busy && F.session.visit === v) w2.travel(cave, 'entrance', fl); });
    };
    show();
  };
  // ---------- a friend went somewhere: a small banner, never a pop-up ----------
  // Owner, 7 Nov 2026: "the stay here and follow them button on dungeon is annoying, we need to improve it and make new
  // rules". The rules: no pop-up that stops your game (a banner at the top, 6 s, tap Follow or let it go); never while you
  // fight (an animal charging near you, or a shot of yours a moment ago: it waits until it is calm); once for each friend
  // and place or floor (as before: v.asked); in a dungeon friends meet on a floor anyway (19zzzzzzzzz-gameserver.js).
  var U = F.UIScene.prototype, NOTE_MS = 6000;
  var fighting = function () {
    var w = F.world;
    if (!w || w.busy) return true;
    if (w.shotAt && Date.now() - w.shotAt < 3000) return true;
    var f = w.player ? w.feet() : null;
    return !!(f && w.wild && w.wild.animals.some(function (a) { return a.mode === 'charge' && Math.hypot(a.x - f.x, a.y - f.y) < 6 * T; }));
  };
  U.followNote = function (text, label, act, still) {
    var self = this, tries = 0;
    if (!P.__shotSeen && typeof P.shoot === 'function') { // (a shot of yours: when, for 'fighting')
      var shoot = P.shoot;
      P.shoot = function () { this.shotAt = Date.now(); return shoot.apply(this, arguments); };
      P.__shotSeen = true;
    }
    var show = function () {
      if (still && !still()) return;
      if ((fighting() || self.modals.length) && tries++ < 60) return setTimeout(show, 1000);
      if (self.followBox) { self.followBox.destroy(); self.followBox = null; }
      var K = F.UI_CONST, W = K.W, w = W - 32, h = 46, c = self.followBox = self.add.container(16, 122).setDepth(60).setAlpha(0);
      var bg = self.add.graphics();
      bg.fillStyle(0x24160b, 0.9).fillRoundedRect(0, 0, w, h, 12);
      bg.lineStyle(1.5, 0xffd23f, 0.8).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 11.25);
      var t = self.txt(12, h / 2, text, 12, '#fff6d8', { fontStyle: 'bold', wordWrap: { width: w - 110 }, maxLines: 2 }).setOrigin(0, 0.5);
      c.add([bg, t]);
      var go = function () { if (self.followBox === c) { c.destroy(); self.followBox = null; } act(); };
      self.button(c, w - 46, h / 2, 76, 30, label || 'Follow', go, 0x5fa84a);
      var z = self.add.zone(0, 0, w - 92, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      F.tapOn(z, go);
      c.add(z);
      if (F.Audio) F.Audio.sfx('found');
      self.tweens.add({ targets: c, alpha: 1, duration: 200 });
      self.time.delayedCall(NOTE_MS, function () {
        if (self.followBox !== c) return;
        self.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: function () { if (self.followBox === c) { c.destroy(); self.followBox = null; } } });
      });
    };
    show();
  };
  void noop;
})(window.Farm = window.Farm || {});
