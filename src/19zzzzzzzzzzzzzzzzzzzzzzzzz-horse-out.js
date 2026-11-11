// The horse goes out (farm economy v2, part 5; owner, 11 Nov 2026: docs/farm-economy-v2.md section 6; rules
// 01-logicZZZZZZZZZZZZZZ-horse.js, numbers C.HORSE_OUT). Ride past town when the bond and the gear allow it: the Wild
// Lands, the hunting places (Kanor's Jeep takes you both), their caves and the Lair. Out there a bar over the horse
// shows its stamina; at 0 you get off and walk, and it follows you until you feed it (hold oats, an apple or a carrot
// and face it). Get off out there and it follows you too, so it is never lost far from home; where it may not go (a
// house, the mine, a place its hearts or gear do not open) it waits at the door. Shoot from the saddle on the move. In
// a cave a big monster's hit can knock you off: the horse runs back to the entrance and waits (it comes out with you).
// The Stable (face it on the farm): hearts, stamina, and its gear. Visiting a friend's farm: riding as before.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var H = C.HORSE_OUT;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  // on a friend's farm (their horse, as before); in their town or out hunting with them you play your own save (v.inTown)
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown)); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var look = function () { if (O && O.gsLook) O.gsLook(); }; // (others in a hunting place's room see you on it)
  var name = function (s) { return s.horse ? s.horse.name : 'Your horse'; };
  // (its tip is pushed here, by the last file: a tip's place in C.TIPS is a saved bit, and 19- files push tips too)
  C.TIPS.push({ key: 'horse_out', text: 'OUT ON YOUR HORSE' });

  // ---------- where it may be ridden, and where it stands ----------
  var mapOk = P.horseMapOk;
  P.horseMapOk = function (map) {
    if (visiting(this)) return mapOk.call(this, map);
    return !!L.horseCanRide(this.state, map).ok;
  };
  var spot = P.horseSpot;
  P.horseSpot = function () {
    if (visiting(this)) return spot.call(this);
    var S = F.session, at = S.horseAt, f = this.feet();
    if (S.riding) return f;
    if (at && at.map === this.mapKey) {
      if (!at.entrance) return at;
      var e = this.points.entrance || f; // (knocked off in a cave: it waits by the way in, on every floor)
      return { x: e.x + 1.1 * T, y: e.y + 0.3 * T };
    }
    if (S.horseFollow && L.horseMayGo(this.state, this.mapKey).ok) return { x: f.x - 1.1 * T, y: f.y + 0.2 * T };
    return spot.call(this);
  };

  var before = P.beforeTravel;
  P.beforeTravel = function (to) {
    var S = F.session, s = this.state, here = this.mapKey, h = this.horse;
    if (visiting(this) || !s.horse || to === here) return before.call(this, to);
    var r = L.horseCanRide(s, to), go = L.horseMayGo(s, to);
    if (S.riding && !r.ok) {
      this.dismount();
      this.horseWait();
      if (r.why !== 'map') F.ui.toast(L.horseWhy(s, r) + '\nIt waits here for you.', 3600);
    } else if (!S.riding && S.horseFollow && !go.ok) {
      if (h) this.horseWait();
      else S.horseFollow = false;
      if (go.why !== 'map') F.ui.toast(L.horseWhy(s, go) + '\nIt waits here for you.', 3600);
    } else if (!S.riding && S.horseAt && S.horseAt.map === here && S.horseAt.entrance && go.ok) {
      S.horseAt = null; // (it was waiting at the cave's way in: it comes out with you)
      S.horseFollow = true;
    }
    return before.call(this, to);
  };
  // it stays where it stands (on this map, for today)
  P.horseWait = function () {
    var h = this.horse, f = this.feet();
    F.session.horseFollow = false;
    F.session.horseAt = { map: this.mapKey, x: h ? h.x : f.x, y: h ? h.y : f.y + 20 };
  };

  // ---------- getting on and off ----------
  var dismount = P.dismount;
  P.dismount = function () {
    dismount.call(this);
    if (visiting(this)) return;
    if (L.horseOut(this.mapKey)) { F.session.horseAt = null; F.session.horseFollow = true; } // out there it walks with you
    look();
  };
  var mount = P.mount;
  P.mount = function () {
    F.session.horseFollow = false;
    if (this.horse) this.horse.run = null;
    mount.call(this);
    if (visiting(this)) return;
    this.horseLast = null;
    look();
    this.horseTip();
  };
  // the first ride out there: what is new, once
  P.horseTip = function () {
    var s = this.state;
    if (!F.session.riding || !L.horseOut(this.mapKey) || quiet() || !L.takeTip(s, 'horse_out')) return;
    this.changed();
    F.ui.dialog('OUT ON YOUR HORSE\n' + name(s) + ' tires as you ride out here: the bar over its head shows how much. Feed it oats, an apple ' +
      'or a carrot. Hold the Bow to shoot from the saddle, and gallop away from a charge. In caves, a big monster can knock you off.');
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    this.horseLast = null;
    this.horseBarAt = null;
    if (this.horse && !visiting(this)) { var self = this; this.time.delayedCall(700, function () { if (self.sys && self.sys.isActive()) self.horseTip(); }); }
  };

  // ---------- Ride, Feed ----------
  var petAction = P.petAction;
  P.petAction = function (pt) {
    var a = petAction.call(this, pt);
    if (!a || a.label !== 'Ride' || visiting(this)) return a;
    var s = this.state, held = L.held(s);
    if (held && L.horseFood(held.id)) return this.horseFeedAction(held);
    var r = L.horseCanRide(s, this.mapKey);
    if (!r.ok) return { label: 'Ride', icon: C.ICON.horse, disabled: true, why: L.horseWhy(s, r) };
    return a;
  };
  var rideAction = P.rideAction;
  P.rideAction = function (held, def) {
    if (!visiting(this) && held && L.horseFood(held.id) && L.horseStamina(this.state) < H.stamina) return this.horseFeedAction(held);
    return rideAction.call(this, held, def);
  };
  P.horseFeedAction = function (held) {
    var self = this, s = this.state;
    if (L.horseStamina(s) >= H.stamina) return { label: 'Feed', icon: C.ITEMS[held.id].icon, disabled: true, why: name(s) + ' is full. Ride on!' };
    return { label: 'Feed', icon: C.ITEMS[held.id].icon, run: function () { self.horseFeed(); } };
  };
  P.horseFeed = function () {
    var s = this.state, tired = L.horseTired(s), r = L.horseFeed(s, s.sel), h = this.horse;
    if (r === 'full') return F.ui.toast(name(s) + ' is full. Ride on!');
    if (r !== 'ok') return;
    sfx('eat');
    if (h) this.floatTextAt(h.x, h.y - 2 * T, 'Stamina ' + Math.floor(L.horseStamina(s)) + '/' + H.stamina);
    if (tired) { sfx('neigh'); F.ui.toast(name(s) + ' perks up. You can ride again!'); }
    this.changed();
  };

  // ---------- each frame: stamina, following, the bar ----------
  var STEPS = [1, 0, 2, 0], FACING = { down: 0, up: 3, side: 6 };
  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    var h = this.horse, S = F.session, mine = h && !visiting(this);
    if (mine && S.riding) this.horseDrain();
    var moved = mine && !S.riding ? (h.run ? this.horseRun(h, dt) : S.horseFollow ? this.horseFollowStep(h, dt) : null) : null;
    updateExtras.call(this, dt, time);
    if (moved) { // walking (or running to the cave's way in): its steps, the way it goes
      var side = moved.side, k = FACING[moved.d] + STEPS[Math.floor(time / (h.run ? 90 : 150)) % 4];
      F.Anim.show(h, (h.ride ? 0 : C.HORSE.frame0) + k, side && moved.flip);
    }
    if (mine) this.horseBar(h); else if (this.hbar) this.hbar.setVisible(false);
  };
  // the way it goes, for its picture
  var heading = function (dx, dy) {
    var side = Math.abs(dx) > Math.abs(dy) * 1.2;
    return { side: side, d: side ? 'side' : dy > 0 ? 'down' : 'up', flip: dx > 0 };
  };
  // ridden out there: a tile's stamina for each tile gone (a jump of more than 2 tiles is a move, not a ride)
  P.horseDrain = function () {
    var f = this.feet(), last = this.horseLast;
    this.horseLast = { x: f.x, y: f.y };
    if (!last || !L.horseOut(this.mapKey)) return;
    var d = Math.hypot(f.x - last.x, f.y - last.y);
    if (!d || d > 2 * T) return;
    F.session.dirty = true; // (saved with the next autosave; no HUD redraw each frame)
    if (L.horseRide(this.state, this.mapKey, d / T) === 'tired') this.horseTiredOut();
  };
  P.horseTiredOut = function () {
    var s = this.state;
    sfx('neigh');
    this.dismount(); // (out there: it follows you)
    this.player.body.setVelocity(0, 0);
    F.ui.toast(name(s) + ' is worn out and stops. You walk on, and it follows you.\nFeed it oats, an apple or a carrot.', 4200);
    this.changed();
  };
  // following you: a little behind, at your walking pace (it catches up if you went far, say through a road)
  P.horseFollowStep = function (h, dt) {
    var f = this.feet(), dx = f.x - h.x, dy = f.y + 20 - h.y, d = Math.hypot(dx, dy);
    if (d > 9 * T) { h.x = f.x - 1.1 * T; h.y = f.y + 0.2 * T; return null; }
    if (d < 1.3 * T) return null;
    var step = Math.min(d - 1.2 * T, C.SPEED * 0.95 * Math.min(dt, 100) / 1000);
    h.x += dx / d * step;
    h.y += dy / d * step;
    return heading(dx, dy);
  };
  // running off to the cave's way in (knocked off)
  P.horseRun = function (h, dt) {
    var r = h.run, dx = r.x - h.x, dy = r.y - h.y, d = Math.hypot(dx, dy), step = C.SPEED * 1.6 * Math.min(dt, 100) / 1000;
    if (d <= step) { h.x = r.x; h.y = r.y; h.run = null; return null; }
    h.x += dx / d * step;
    h.y += dy / d * step;
    return heading(dx, dy);
  };
  // the stamina bar over its head, out there (drawn again only when it changes)
  P.horseBar = function (h) {
    var s = this.state, show = L.horseOut(this.mapKey) && h.sprite.visible !== false;
    if (!show) { if (this.hbar) this.hbar.setVisible(false); return; }
    var st = L.horseStamina(s), v = Math.ceil(st / H.stamina * 40), bw = 1.3 * T, bh = 0.15 * T;
    if (!this.hbar) this.hbar = this.add.graphics().setDepth(DEPTH.Above + 1);
    if (this.horseBarAt !== v) {
      this.horseBarAt = v;
      var g = this.hbar.clear(), k = st / H.stamina;
      g.fillStyle(0x3d2614, 0.85).fillRoundedRect(-bw / 2 - 8, -bh / 2 - 8, bw + 16, bh + 16, 14);
      g.fillStyle(0x6a5440, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
      if (k > 0) g.fillStyle(k > 0.5 ? 0x7cc455 : k > 0.2 ? 0xf2b632 : 0xe0553a, 1).fillRoundedRect(-bw / 2, -bh / 2, Math.max(16, bw * k), bh, 8);
    }
    this.hbar.setVisible(true).setPosition(h.x, h.y - (F.session.riding ? 2.75 : 2.0) * T);
  };

  // ---------- shooting from the saddle (owner: "users can fire arrow while riding a horse") ----------
  // No archer's stance on a horse: the bow comes up where the arrow leaves (as friends see a rider's shot), and you
  // keep galloping. The same arrows, energy, range and hits as on foot.
  var shoot = P.shoot;
  P.shoot = function () {
    if (!F.session.riding || visiting(this)) return shoot.apply(this, arguments);
    var s = this.state, now = Date.now();
    if (this.rideShotAt && now - this.rideShotAt < H.shotGap) return;
    var r = L.shoot(s);
    if (r === 'arrows') return F.ui.toast('No arrows left. Kanor sells them at his Lodge.');
    if (r === 'tired') return F.ui.toast('Too tired to draw the bow. Eat something first.');
    this.rideShotAt = this.shotAt = now;
    var target = this.wildTarget(), f = this.feet(), x = f.x, y = f.y - 1.25 * T, d = this.dirVec(), ang = Math.atan2(d[1], d[0]);
    if (target) {
      ang = Math.atan2((target.y - 0.3 * target.def.w * T) - y, target.x - x);
      if (Math.abs(target.x - f.x) > Math.abs(target.y - f.y)) this.rideFlip = target.x > f.x;
    }
    var range = L.bowRange(s) * T, lv = L.bowLevel(s);
    x += Math.cos(ang) * 0.5 * T;
    y += Math.sin(ang) * 0.5 * T;
    this.wildArrow(x, y, ang, range, false, lv);
    this.tellArrow({ x: Math.round(x), y: Math.round(y), a: ang, l: range, b: lv });
    this.bowFlash(x, y, ang, lv);
    sfx('bowshot');
    F.bus.emit('hud');
    this.changed();
  };

  // ---------- knocked off in a cave ----------
  var wildHit = P.wildHit;
  P.wildHit = function (a) {
    var rode = F.session.riding && !visiting(this), e = this.state.energy;
    var out = wildHit.apply(this, arguments);
    if (rode && F.session.riding && !this.busy && this.state.energy < e && a && L.horseKnocks(this.mapKey, a.def, Math.random())) this.horseKnockOff();
    return out;
  };
  P.horseKnockOff = function () {
    var s = this.state, h = this.horse, S = F.session, e = this.points.entrance;
    this.dismount();
    S.horseFollow = false;
    S.horseAt = { map: this.mapKey, entrance: true };
    if (h) h.run = e ? { x: e.x + 1.1 * T, y: e.y + 0.3 * T } : null;
    sfx('neigh');
    this.cameras.main.shake(220, 0.006);
    this.floatTextAt(this.feet().x, this.feet().y - 1.6 * T, 'Knocked off!');
    F.ui.toast('Thud! You fell off. ' + name(s) + ' ran back to the way in and waits there.', 3600);
    this.changed();
  };

  // ---------- the Stable ----------
  // its building on the farm (a picture on the map: its 3 x 2 foot is where you face it)
  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    if (this.mapKey !== 'farm' || !this.state.horse || visiting(this)) return;
    // (since Edit Farm the Stable is a yard piece, wherever it was moved: its two solid rows are what you face)
    var st = L.buildingsOf && L.buildingsOf(this.state, 'stable')[0];
    if (st) {
      var w = C.OUTDOOR.types[st.t].w;
      this.objects.push({ type: 'stable', name: 'stable', x0: st.x, y0: st.y + 1, x1: st.x + w - 1, y1: st.y + 2, props: {} });
      return;
    }
    var img =(this.props || []).filter(function (p) { return p.texture && p.texture.key === 'props/stable'; })[0];
    if (!img) return;
    var x0 = Math.round(img.x / T), y1 = Math.round(img.y / T) - 1;
    this.objects.push({ type: 'stable', name: 'stable', x0: x0, y0: y1 - 1, x1: x0 + Math.round(img.displayWidth / T) - 1, y1: y1, props: {} });
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o && o.type === 'stable') return { label: 'Stable', icon: C.ICON.horse, run: function () { F.ui.openStable(); } };
    return extraObjectAction.call(this, o, held, def);
  };

  U.openStable = function () {
    var self = this, s = F.session.state, hz = s.horse;
    if (!hz) return;
    var cost = function (g) { return g.needs.map(function (n) { return n[1] + ' ' + (C.ITEMS[n[0]] ? C.ITEMS[n[0]].name : 'Rope'); }).join(', ') + ', ' + g.gold.toLocaleString('en-US') + 'G'; };
    var rows = H.gearOrder.map(function (id) {
      var g = H.gear[id], have = L.horseHas(s, id);
      return {
        icon: g.icon, name: g.name, desc: (have ? name(s) + ' wears it. ' : g.soon ? g.soon + ' ' : cost(g) + '. ') + g.desc, // (what it takes first: a row shows one line)
        buttons: [{ label: have ? 'Made' : g.soon ? 'Soon' : 'Make', color: have || g.soon ? GREY : GREEN, cb: function () {
          if (have) return;
          var r = L.horseMake(s, id);
          if (r === 'soon') { sfx('nope'); return self.toast(g.soon); }
          if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold: ' + g.gold.toLocaleString('en-US') + 'G.'); }
          if (r === 'needs') { sfx('nope'); return self.toast('You need ' + L.needsText(g.needs) + '.'); }
          if (r !== 'ok') return;
          sfx('coin');
          if (F.world) { F.world.changed(); F.world.save(); }
          self.closeModal();
          self.openStable();
          self.toast(g.name + ' made! ' + name(s) + ' looks proud.');
        } }],
      };
    });
    rows.push({ icon: C.ITEMS.oats.icon, name: 'Feeding', desc: 'Hold it and face ' + name(s) + '. Oats +' + H.food.oats + ', apple +' + H.food.apple + ', carrot +' + H.food.carrot + ' stamina.' });
    var he = H.hearts;
    this.listPanel({ title: name(s) + "'s Stable", rows: rows, reopen: function () { self.openStable(); },
      sub: function () {
        return '♥ ' + L.horseHearts(s) + '/10 hearts · Stamina ' + Math.floor(L.horseStamina(s)) + '/' + H.stamina + '\nTown ' + he.town + '♥ · Wild Lands ' + he.wild + '♥ · Hunting ' + he.hunt + '♥ · Caves ' + he.cave + '♥';
      } });
  };
})(window.Farm = window.Farm || {});
