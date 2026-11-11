// The Lost Tower with friends (owner, 12 Nov 2026; the spec docs/superpowers/specs/2026-11-12-lost-tower-design.md, "Friends
// on a floor"; the wire docs/game-server.md "Step 4"; the server server/lib/tower.js). Up to 4 on a floor: the game server
// holds a tower floor as it holds a cave's (19zzzzzzzzz-gameserver.js), so friends from their own games land on the same
// floor (`with`), see each other and the same enemies, and share the kills. What is the Tower's own here:
// - hi says whether this floor is new to you (tn), so the server can say at the clear how many on it were new (nw);
// - each enemy the server brings is as strong as its floor and carries its tricks (lairStrength), a splitter's copy its
//   parent's; the count of those still to beat is the server's (dn's tl);
// - the clear ('cl' with pay): your Pearls by the team rule (L.towerTeamPay): new to you, its first-time Pearls; cleared
//   before, 1 helper Pearl (50 a day) when another on the floor is new to it; else nothing. A 'cl' without pay (you came
//   after it was cleared) opens the stairs only;
// - the tricks the server runs, as they look here: a shield that bounces or breaks ('sh'), a reviver lying and standing
//   ('ly', 'up'), a healer's mend ('hl'), a splitter's "Split!" and a bursting one's puddle (at its 'dn'), a wave ('wv');
// - the stairs: each walks up on their own (as in the caves), and lands on a friend's floor if one is there;
// - the lift: your friends' floors ('fq'), with Join on one you have reached.
// No server (off, refused, an older one without the Tower): the floor is this phone's alone, as before.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var TW = C.TOWER;
  var GS = F.GameServer, FX = F.towerFx;
  if (!F.WorldScene || !TW || !GS || !FX) return;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var BLUE = 0x1e4a6a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var inTower = function (w) { return !!(w && w.lair && w.lair.cfg.tower); };
  var onServer = function (w) { return inTower(w) && w.wildFollowing() === 'gs'; };
  var cnt = function (v) { v = Math.floor(Number(v)); return isFinite(v) && v >= 0 ? Math.min(v, 9999) : null; };
  var list = function (v) { return Array.isArray(v) ? v.slice(0, 200) : []; };
  var find = function (w, slot) { return w.wild ? w.wild.animals.filter(function (a) { return a.slot === slot && !a.gsLocal; })[0] : null; };

  // ---------- the hi: is this floor new to you ----------
  P.gsHi = function (hi) {
    if (!inTower(this)) return;
    hi.tn = this.lair.floor > L.towerRec(this.state).cl ? 1 : 0;
    this.lair.tn = hi.tn;
  };

  // ---------- each enemy the server brings: as strong as the floor, with its tricks ----------
  P.gsBorn = function (a) {
    if (!inTower(this)) return;
    var lr = this.lair;
    if (L.towerIsCopy(a.slot)) { // a splitter's copy: its parent's tricks, never a shield, a flock, a split or a revive
      a.tf = Object.assign(L.towerFlags(lr.floor, a.kind, Math.floor((a.slot - L.towerCopySlot(0, 0)) / 2), false), { shield: false, flock: false, split: false, revive: false });
      (lr.extra || (lr.extra = {}))[a.slot] = true; // (counted by the stairs if this phone runs the floor after all)
    }
    this.lairStrength(a);
  };

  // ---------- what the server says of the floor ----------
  P.gsHear = function (m) {
    if (!inTower(this)) return;
    var self = this, lr = this.lair, t = m.t, a, b;
    if (t === 'wl') {
      var tw = m.tw && typeof m.tw === 'object' ? m.tw : {}, ly = list(tw.ly), here = {};
      lr.gsTl = cnt(tw.tl);
      lr.wave = cnt(tw.wv) || 0;
      // the ones beaten already are down (should the server go, this phone runs the floor from here)
      this.wild.animals.forEach(function (x) { here[x.slot] = 1; });
      L.towerInWave(L.towerRoster(lr.floor), lr.wave, TW.wave).forEach(function (e) { if (!here[e.slot]) lr.down[e.slot] = true; });
      list(tw.sh).forEach(function (s) { var x = find(self, s); if (x && x.shield) { x.shield = false; if (x.shieldImg) { x.shieldImg.destroy(); x.shieldImg = null; } } });
      this.wild.animals.forEach(function (x) {
        if (ly.indexOf(x.slot) >= 0) { if (!x.lying) FX.lieDown(self, x); } else if (x.lying) FX.standUp(self, x);
      });
      return;
    }
    if (t === 'dn') {
      var tl = cnt(m.tl), x0 = Number(m.x), y0 = Number(m.y);
      if (tl != null) lr.gsTl = tl;
      a = find(this, m.s);
      if (FX.tk(this).on.burst && isFinite(x0) && isFinite(y0)) FX.puddle(this, x0, y0);
      if (a && a.split && !L.towerIsCopy(a.slot)) FX.word(this, 'Split!', a.x, a.y - (0.9 + a.def.w * a.size) * T, '#ffe8b0');
      return;
    }
    if (t === 'cl') { // the floor's last enemy fell: paid if you were on it then
      lr.gsTl = 0;
      if (m.pay && !lr.paid) this.towerCleared(Math.max(0, (cnt(m.nw) || 0) - (lr.tn ? 1 : 0)));
      return;
    }
    if (t === 'sh') { a = find(this, m.s); if (a && a.shield) FX.shieldBreak(this, a); return; }
    if (t === 'ly') { a = find(this, m.s); if (a && !a.lying) FX.lieDown(this, a); return; }
    if (t === 'up') {
      a = find(this, m.s);
      if (!a || !a.lying) return;
      FX.standUp(this, a);
      var hp = cnt(m.hp);
      if (hp != null) a.hp = Math.min(a.max || hp, hp);
      return;
    }
    if (t === 'hl') { a = find(this, m.s); b = find(this, m.to); if (a && b) FX.healFx(this, a, b); return; }
    if (t === 'wv') { var n = cnt(m.n), of = cnt(m.of); if (n && of && F.ui) F.ui.toast('Wave ' + n + ' of ' + of + '!', 1800, BLUE); return; }
    if (t === 'fq') heardFloors(m);
  };

  // ---------- your shot at a shielded one: it bounces here at once; a Rifle's waits for the server to say it broke ----------
  var struck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    if (friend || !a.shield || !onServer(this)) return struck.apply(this, arguments);
    var k = this.state.wpnHit ? this.state.wpnHit.k : undefined;
    if (L.towerShieldHit(k) !== 'break') FX.shieldBounce(this, a);
    GS.hit(a, 1, k);
  };
  // a reviver lying there stays still until the server says it stands
  var wildCopy = P.wildCopy;
  P.wildCopy = function (a) {
    if (a.lying && inTower(this)) return;
    return wildCopy.apply(this, arguments);
  };
  // no server after all (it refused, or did not answer): the floor's enemies, all of them, as alone
  var gsSpawn = P.gsSpawn;
  P.gsSpawn = function () {
    if (!inTower(this)) return gsSpawn.apply(this, arguments);
    this.towerPlace(false);
    this.lair.seen = true;
  };

  // ---------- the lift: your friends' floors ----------
  var fr = { at: 0, list: [] };
  var heardFloors = function (m) {
    fr.at = Date.now();
    fr.list = list(m.f).slice(0, 8).filter(function (f) { return Array.isArray(f) && cnt(f[0]) >= 1 && cnt(f[0]) <= TW.floors; })
      .map(function (f) { return [cnt(f[0]), Math.min(TW.team, cnt(f[1]) || 1), (L.cleanName ? L.cleanName(f[2]) : L.cleanText(f[2], 24)) || 'A friend']; });
    var ui = F.ui, top = ui && ui.modals[ui.modals.length - 1];
    if (top && top === ui.towerLiftM && fr.list.length) ui.swapTo(function () { ui.openLairLift(ui.towerLiftPage || 0); }); // (the lift open: with them now)
  };
  var friendRows = function (ui) {
    var deep = L.towerRec(F.session.state).deep, here = F.session.lairFloor;
    return fr.list.filter(function (f) { return f[0] !== here; }).map(function (f) {
      var floor = f[0], ok = floor <= deep;
      return {
        icon: C.ICON.heart, name: f[2] + ', floor ' + floor, desc: f[1] + ' of ' + TW.team + ' on it. ' + (ok ? 'Climb with them!' : 'Reach floor ' + floor + ' to join them.'),
        buttons: ok ? [{ label: 'Join', cb: function () { ui.closeModal(); sfx('ladder'); F.world.travel('tower', 'entrance', floor); } }] : [],
      };
    });
  };
  var openLairLift = U.openLairLift;
  U.openLairLift = function (page) {
    if (onServer(F.world) && Date.now() - fr.at > 5000) { fr.at = Date.now(); GS.ask({ t: 'fq', with: GS.friends() }); }
    this.towerLiftPage = page || 0;
    return openLairLift.apply(this, arguments);
  };
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    var lift = o && o.title === 'Tower Lift' && inTower(F.world) && Array.isArray(o.rows);
    if (lift && fr.list.length && onServer(F.world)) o = Object.assign({}, o, { rows: friendRows(this).concat(o.rows) });
    var r = listPanel.apply(this, [o].concat([].slice.call(arguments, 1)));
    if (lift) this.towerLiftM = this.modals[this.modals.length - 1];
    return r;
  };
})(window.Farm = window.Farm || {});
