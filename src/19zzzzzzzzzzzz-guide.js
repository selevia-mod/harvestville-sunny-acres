// Quests v2 on screen (owner, 8 Nov 2026; docs/quests-v2.md; rules 01-logicZZZZZZZY-quests2.js):
//  - your dog's name: asked once on your farm, renamed from the Paused card ("let users name it")
//  - the quest card: one daily quest at the left, with its progress ring and Go; done, it turns gold: tap to claim
//  - the dog's tip: now and then, when you stand still, your dog says the quest's reason in a bubble under the card
//  - the dog guide: Go (or the tip) and your dog runs ahead, leaving paw prints, and your farmer walks after it on their
//    own, through roads and doors to the right map ("it's always the lead when they tap"). The joystick stops it at
//    once; there, the dog sits and barks, and nothing is done for you.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var A = F.Anim, FACING = A.FACING, STEPS = A.STEPS, DOG = C.DOG;
  var K = F.UI_CONST, W = K.W;
  var INK = '#3d2614', BLUE = 0x4a90c9;
  var sfx = function (name, soft) { if (F.Audio) { if (soft && F.Audio.sfxSoft) F.Audio.sfxSoft(name, 0.5); else F.Audio.sfx(name); } };
  var world = function () { return F.world; };

  C.TIPS.push({ key: 'dog_name', text: 'NAME YOUR DOG' }); // (asked once: last, so older saves keep their tips)
  var G = F.GUIDE = { card: { x: 8, y: 104, w: 186, h: 42 }, ahead: 1.6, lead: 1.8, near: 0.32, tipEvery: 150000, tipStill: 6000, stuck: 1300 };

  // ---------- your dog's name ----------
  var WHY = { empty: 'Type a name for your dog.', rude: "Let's keep Harvest Ville friendly. Try another name." };
  U.askDogName = function (done) {
    var self = this, s = F.session.state;
    this.askText('Name your dog', L.dogNamed(s) ? L.dogName(s) : '', C.FARMER_NAME, function (text) {
      var r = L.setDogName(s, text);
      if (r !== 'ok') {
        sfx('nope');
        self.toast(WHY[r], 2400);
        return self.time.delayedCall(250, function () { self.askDogName(done); });
      }
      F.session.dirty = true;
      if (world() && world().save) world().save();
      sfx('woof');
      self.toast(L.dogName(s) + ' wags happily!', 1800, 0x2f5a22);
      if (done) done();
    }, { hint: 'Up to ' + C.FARMER_NAME + ' letters. Your dog leads you to your quests.', cancel: done });
  };
  // asked once on your farm, when it is quiet (after the farmer's own name: 19n-name.js)
  var create = P.create;
  P.create = function () {
    create.call(this);
    this.guideDog = null;
    this.guidePrints = [];
    if (this.mapKey === 'farm' && !(this.state && this.state.isVisit) && !F.session.isNew && !(window.gameHost && window.gameHost.quiet)) {
      var self = this;
      var ask = function () {
        var s = F.session.state;
        if (!self.sys || !self.sys.isActive() || L.dogNamed(s) || !s.name) return;
        if (self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return self.time.delayedCall(3000, ask);
        if (!L.takeTip(s, 'dog_name')) return;
        self.save();
        F.ui.askDogName(null);
      };
      this.time.delayedCall(9000, ask);
    }
    // a guide on its way here from another map goes on
    if (F.session.guide && !F.session.visit) { var me = this; this.time.delayedCall(500, function () { if (me.sys && me.sys.isActive()) me.guideRun(); }); }
  };

  // ---------- the guide: a path over the tiles ----------
  // The tiles round a rectangle (and in it), as goal tests.
  var nearRect = function (r, x, y, inside) {
    if (inside) return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    return x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1;
  };
  // Where to go on this map: { goal(x, y), exit (the warp object, when it leads on), name }.
  P.guideGoal = function (place) {
    var self = this, s = this.state;
    if (this.mapKey !== place.map) {
      var name = C.ROUTES[this.mapKey] && C.ROUTES[this.mapKey][place.map];
      var o = name && this.objects.filter(function (x) { return x.name === name; })[0];
      if (!o) return null;
      var walk = o.type === 'warp' && o.props && o.props.walk;
      return { exit: o, walk: walk, goal: function (x, y) { return nearRect(o, x, y, walk); } };
    }
    var to = place.to;
    if (to === 'villager') {
      var f0 = this.feet(), vs = (this.villagers && this.villagers.list || []).filter(function (v) {
        return v.visible && v.sprite && v.sprite.visible && !(L.friend(s, v.key) || {})[place.not || 'talked'];
      }).sort(function (a, b) { return Math.hypot(a.sprite.x - f0.x, a.sprite.y - f0.y) - Math.hypot(b.sprite.x - f0.x, b.sprite.y - f0.y); });
      if (vs.length) {
        var v = vs[0], vx = Math.floor(v.sprite.x / T), vy = Math.floor(v.sprite.y / T);
        return { who: v, goal: function (x, y) { return Math.abs(x - vx) + Math.abs(y - vy) === 1; } };
      }
      to = 'fountain';
      var fo = this.objects.filter(function (x) { return x.name === to; })[0];
      return fo ? { goal: function (x, y) { return nearRect(fo, x, y); } } : null;
    }
    if (to === 'water') return { goal: function (x, y) { return self.isWater(x + 1, y) || self.isWater(x - 1, y) || self.isWater(x, y + 1) || self.isWater(x, y - 1); } };
    if (to === 'debris') return { goal: function (x, y) { var w = self.map.width; return !!(s.debris[(y + 1) * w + x] || s.debris[(y - 1) * w + x] || s.debris[y * w + x + 1] || s.debris[y * w + x - 1]); } };
    if (to === 'field') { var fs = this.objects.filter(function (x) { return x.name === 'field_sign'; })[0]; if (fs) return { goal: function (x, y) { return nearRect(fs, x, y); } }; }
    if (to.indexOf('zone:') === 0) {
      var zs = this.zones[to.slice(5)] || [];
      if (!zs.length) return null;
      return { goal: function (x, y) { return zs.some(function (z) { return nearRect(z, x, y, true); }); } };
    }
    var ob = this.objects.filter(function (x) { return x.name === to; })[0];
    return ob ? { goal: function (x, y) { return nearRect(ob, x, y); } } : null;
  };
  // The shortest way over walkable tiles (4 ways) from the farmer to the first tile the goal accepts: [{x, y}] or null.
  P.guidePath = function (goal) {
    var w = this.map.width, h = this.map.height, f = this.feet(), sx = Math.floor(f.x / T), sy = Math.floor(f.y / T);
    var from = new Int32Array(w * h).fill(-1), q = [sy * w + sx], head = 0, start = sy * w + sx, end = -1;
    from[start] = start;
    while (head < q.length && head < 40000) {
      var k = q[head++], x = k % w, y = (k - x) / w;
      if (goal(x, y)) { end = k; break; }
      var next = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (var i = 0; i < 4; i++) {
        var nx = next[i][0], ny = next[i][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var n = ny * w + nx;
        if (from[n] >= 0 || !(this.walkable(nx, ny) || goal(nx, ny) && this.inMap(nx, ny) && !this.blocked[n])) continue;
        from[n] = k;
        q.push(n);
      }
    }
    if (end < 0) return null;
    var path = [];
    for (var c = end; c !== start; c = from[c]) path.unshift({ x: c % w, y: Math.floor(c / w) });
    return path;
  };

  // Starts the guide to a daily quest (by its index): the dog leads, the farmer follows.
  P.guideTo = function (i) {
    var s = this.state, q = s.dq && s.dq.list[i], place = q && L.questPlace(q.c);
    if (!place || F.session.visit) return false;
    F.session.guide = { i: i, c: q.c, place: place };
    sfx('woof', true);
    return this.guideRun();
  };
  P.guideRun = function () {
    var g = F.session.guide;
    if (!g || !this.player || this.busy) return false;
    // a quest you can do anywhere (fish, forage): the nearest on this map first (owner, 8 Nov 2026: by the town's river,
    // "it drags me to the pond in the farm"); the place's own map only when there is none here
    var spot = null, path = null;
    if (g.place.here && this.mapKey !== g.place.map) {
      spot = this.guideGoal({ map: this.mapKey, to: g.place.to });
      path = spot && this.guidePath(spot.goal);
      if (path) g.local = this.mapKey;
    }
    if (!path && g.local === this.mapKey) path = null;
    if (!path) { spot = this.guideGoal(g.local && g.local === this.mapKey ? { map: this.mapKey, to: g.place.to } : g.place); path = spot && this.guidePath(spot.goal); }
    if (!path) { this.guideStop(this.mapKey === g.place.map ? 'here' : 'lost'); return false; }
    this.guide = { path: path, k: 0, spot: spot, last: this.feet(), at: Date.now(), tries: (this.guide && this.guide.tries) || 0 };
    if (!path.length) { // already there: say so (owner: "nothing happen")
      this.guideDogShow();
      F.ui.toast(L.dogName(this.state) + ': we\'re here! ' + (g.place.say || ''), 2200, 0x2f5a22);
      this.guideArrive();
    } else this.guideDogShow();
    return true;
  };
  // why: 'arrived' | 'stopped' (the joystick) | 'lost' | 'blocked' | 'here'
  P.guideStop = function (why) {
    this.guide = null;
    F.session.guide = null;
    var d = this.guideDog;
    if (d && why === 'arrived') { this.huntDogBark ? this.huntDogBark(d, 2) : sfx('woof'); }
    if (why === 'lost' || why === 'blocked') F.ui.toast(L.dogName(this.state) + ' can\'t find the way from here.', 2200);
    if (d && why !== 'arrived') this.guideDogHide();
    else if (d) { var self = this; this.time.delayedCall(2600, function () { if (!self.guide) self.guideDogHide(); }); }
    F.bus.emit('guide', why);
  };
  P.guideArrive = function () {
    var g = this.guide;
    // a villager walks on: follow them until you are beside them (a few times at most)
    if (g && g.spot.who && g.spot.who.sprite && g.spot.who.visible) {
      var f = this.feet(), v = g.spot.who.sprite, chase = (g.chase || 0) + 1;
      if (Math.hypot(v.x - f.x, v.y - f.y) > 1.8 * T && chase <= 6) {
        var spot = this.guideGoal(F.session.guide.local ? { map: this.mapKey, to: 'villager', not: F.session.guide.place.not } : F.session.guide.place), path = spot && this.guidePath(spot.goal);
        if (path && path.length) { this.guide = { path: path, k: 0, spot: spot, last: f, at: Date.now(), tries: g.tries, chase: chase }; return; }
      }
    }
    if (g && g.spot.exit) { // a door or a road on: through it, and on from the next map
      var o = g.spot.exit;
      this.guide = null;
      if (!g.spot.walk && o.props && o.props.to) this.travel(o.props.to, o.props.spawn);
      return; // (a road you walk onto: checkWalkWarp takes you)
    }
    var place = F.session.guide && F.session.guide.place;
    this.guideStop('arrived');
    if (place && place.say) this.floatTextAt(this.feet().x, this.feet().y - 1.4 * T, 'Here!');
  };

  // The joystick or the keys: you walk. Otherwise, on a guide: the way to its next tile.
  var move = P.move;
  P.move = function (body) {
    var g = this.guide;
    if (!g) return move.call(this, body);
    var jx = F.input.jx, jy = F.input.jy, k = this.keys;
    var manual = Math.hypot(jx || 0, jy || 0) > 0.25 || (k && (k.LEFT.isDown || k.RIGHT.isDown || k.UP.isDown || k.DOWN.isDown || k.A.isDown || k.D.isDown || k.W.isDown || k.S.isDown));
    if (manual) { this.guideStop('stopped'); return move.call(this, body); }
    var f = this.feet(), now = Date.now();
    while (g.k < g.path.length) {
      var t = g.path[g.k];
      if (Math.hypot((t.x + 0.5) * T - f.x, (t.y + 0.5) * T - f.y) > G.near * T) break;
      g.k++;
    }
    if (g.k >= g.path.length) { body.setVelocity(0, 0); F.input.jx = F.input.jy = 0; move.call(this, body); this.guideArrive(); return; }
    // stuck (something in the way): find the way again, a few times
    if (now - g.at > G.stuck) {
      if (Math.hypot(f.x - g.last.x, f.y - g.last.y) < 0.15 * T) {
        if (++g.tries > 3) { this.guideStop('blocked'); return move.call(this, body); }
        this.guideRun();
        return;
      }
      g.last = f;
      g.at = now;
    }
    if (g.spot.who && now - (g.aimed || g.at) > 900) { // (a villager on the move: aim again now and then)
      g.aimed = now;
      var end = g.path[g.path.length - 1], vs = g.spot.who.sprite;
      if (vs && Math.hypot((end.x + 0.5) * T - vs.x, (end.y + 0.5) * T - vs.y) > 2 * T) {
        var sp2 = this.guideGoal(F.session.guide.local ? { map: this.mapKey, to: 'villager', not: F.session.guide.place.not } : F.session.guide.place), p2 = sp2 && this.guidePath(sp2.goal);
        if (p2 && p2.length) { g.path = p2; g.k = 0; g.spot = sp2; }
      }
    }
    var w = g.path[g.k], dx = (w.x + 0.5) * T - f.x, dy = (w.y + 0.5) * T - f.y, len = Math.hypot(dx, dy) || 1;
    F.input.jx = dx / len;
    F.input.jy = dy / len;
    try { move.call(this, body); } finally { F.input.jx = jx; F.input.jy = jy; }
  };

  // ---------- the dog that leads ----------
  P.guideDogShow = function () {
    if (this.guideDog || !this.player) return;
    var f = this.feet(), d = this.guideDog = { x: f.x + 0.6 * T, y: f.y + 0.2 * T, dir: 'side', flip: false, still: 0, seed: 1.3, printAt: 0 };
    d.sprite = A.image(this, d.x, d.y, DOG);
    d.sh = A.shadow(this, d.x, d.y, DOG);
    d.scale = A.scale(DOG);
    d.sprite.setAlpha(0);
    this.tweens.add({ targets: d.sprite, alpha: 1, duration: 250 });
    // only one dog: the farm's (in its yard) and the hunting one step aside while this one leads
    if (this.dog && this.dog.sprite) { this.dog.sprite.setVisible(false); if (this.dog.sh) this.dog.sh.setVisible(false); }
    if (this.huntDog) { this.huntDog.sprite.setVisible(false); this.huntDog.sh.setVisible(false); }
  };
  P.guideDogHide = function () {
    var d = this.guideDog;
    if (!d) return;
    this.guideDog = null;
    this.tweens.add({ targets: [d.sprite, d.sh], alpha: 0, duration: 300, onComplete: function () { d.sprite.destroy(); d.sh.destroy(); } });
    if (this.dog && this.dog.sprite) { this.dog.sprite.setVisible(true); if (this.dog.sh) this.dog.sh.setVisible(true); }
    if (this.huntDog) { this.huntDog.sprite.setVisible(true); this.huntDog.sh.setVisible(true); }
  };
  // a paw print, fading
  var pawTex = function (scene) {
    var key = 'fx-paw';
    if (scene.textures.exists(key)) return key;
    var t = scene.textures.createCanvas(key, 64, 64), g = t.getContext();
    g.fillStyle = 'rgba(92,58,26,0.75)';
    g.beginPath(); g.ellipse(32, 40, 13, 11, 0, 0, Math.PI * 2); g.fill();
    [[16, 22], [27, 15], [38, 15], [49, 22]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 6, 7, 0, 0, Math.PI * 2); g.fill(); });
    t.refresh();
    return key;
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    var d = this.guideDog;
    if (!d || !this.sys || !this.sys.isActive() || !this.player) return;
    var dt = Math.min(delta, 100), g = this.guide, f = this.feet(), tx = f.x, ty = f.y, leading = !!(g && g.path.length);
    if (leading) {
      // a point that slides along the way, G.lead ahead of you (owner, 8 Nov 2026: it ran, stopped, ran, stopped: it
      // aimed at the next tile and stopped on each one); the dog runs to it at your pace, so it never stops while you go
      var left = G.lead * T, px = f.x, py = f.y;
      for (var k = g.k; k < g.path.length && left > 0; k++) {
        var qx = (g.path[k].x + 0.5) * T, qy = (g.path[k].y + 0.5) * T, seg = Math.hypot(qx - px, qy - py);
        if (seg >= left) { px += (qx - px) * left / seg; py += (qy - py) * left / seg; left = 0; break; }
        left -= seg; px = qx; py = qy;
      }
      tx = px; ty = py;
    } else { tx = f.x + 0.7 * T; ty = f.y + 0.1 * T; }
    var dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy), fr;
    var bv = this.player.body && this.player.body.velocity, walking = !!bv && Math.hypot(bv.x, bv.y) > 40;
    var moving = leading ? (dist > 0.04 * T || walking) : dist > 0.2 * T; // (while you walk after it, it runs)
    if (dist > 10 * T) { d.x = tx; d.y = ty; dist = 0; moving = false; }
    if (moving) {
      // your pace, a little quicker when behind, easing (not stopping) when ahead of the point
      var pace = C.SPEED * (dist > 1.2 * T ? 1.5 : dist > 0.3 * T ? 1.05 : 0.9), want = Math.min(dist, pace * dt / 1000);
      d.vel = (d.vel || 0) + (want - (d.vel || 0)) * Math.min(1, dt / 90);
      var step = Math.min(dist, d.vel);
      if (dist > 0.5) { d.x += dx / dist * step; d.y += dy / dist * step; }
      if (dist > 0.12 * T) A.face(d, dx, dy); // (not turning on the spot when it is right at the point)
      d.still = 0;
      // (its legs keep their own beat, not restarted each step)
      d.run = (d.run || 0) + dt;
      // running: the gallop sideways (the hunting dog's two running frames), quick steps up and down
      fr = d.dir === 'side' ? (Math.floor(d.run / 110) % 2 ? 11 : 7) : FACING[d.dir] + STEPS[Math.floor(d.run / 95) % 4];
      if (time - d.printAt > 260) { // paw prints behind it
        d.printAt = time;
        var p = this.add.image(d.x + (d.flip ? -1 : 1) * 0.12 * T, d.y + 0.05 * T, pawTex(this)).setScale(0.55).setAngle(Math.atan2(dy, dx) * 180 / Math.PI + 90).setDepth(DEPTH.flat + 0.1).setAlpha(0.8);
        this.tweens.add({ targets: p, alpha: 0, delay: 900, duration: 1400, onComplete: function () { p.destroy(); } });
      }
    } else {
      d.vel = 0;
      d.still += dt;
      if (Math.abs(f.x - d.x) > 20) d.flip = f.x > d.x;
      fr = d.still > 600 ? 9 : FACING[d.dir];
    }
    A.show(d, DOG.frame0 + fr, fr >= 6 && fr !== 9 && d.flip);
    if (moving) d.sprite.setScale(d.scale); else A.breathe(d.sprite, d.scale, time, d.seed, fr === 9);
    d.sprite.setPosition(d.x, d.y);
    d.sh.setPosition(d.x, d.y);
    F.depthTo(d.sprite, DEPTH.actor + d.y / 1e5);
  };

  // ---------- the quest card ----------
  var ICON = { water: 'can', till: 'hoe', plant: 'seed_turnip', harvest: 'sickle', clear: 'axe', fish: 'rod', care: 'heart', collect: 'egg',
    pet: 'dog', forage: 'mushroom', talk: 'letter', gift: 'gift', earned: 'coin', cooked: 'cake', order: 'crate', request: 'letter', floor: 'stone' };
  var iconOf = function (c) { var k = ICON[c]; return k && C.ICON[k] != null ? C.ICON[k] : C.ICON.star; };
  var uiCreate = U.create;
  U.create = function () {
    uiCreate.call(this);
    var self = this, c = this.questCardBox = this.add.container(G.card.x, G.card.y).setDepth(41).setVisible(false);
    this.qcBg = this.add.graphics();
    this.qcRing = this.add.graphics();
    this.qcIcon = this.add.image(22, G.card.h / 2, 'items', C.ICON.star).setScale(0.16);
    this.qcText = this.txt(42, 9, '', 11, '#fff6d8', { fontStyle: 'bold' });
    this.qcSub = this.txt(42, 25, '', 10, '#d9c49a');
    this.qcGo = this.add.container(G.card.w - 22, G.card.h / 2);
    // a small blue "Go" (owner, 8 Nov 2026): the word to tap, though anywhere on the card goes
    this.qcGo.add([this.txt(0, 0, 'Go', 11, '#8fd0ff', { fontStyle: 'bold' }).setOrigin(0.5)]);
    var z = this.qcZone = this.add.zone(G.card.w / 2, G.card.h / 2, G.card.w, G.card.h).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { self.questCardTap(); });
    c.add([this.qcBg, this.qcRing, this.qcIcon, this.qcText, this.qcSub, this.qcGo, z]);
    // the dog's tip, under the card
    this.qcTip = this.add.container(G.card.x, G.card.y + G.card.h + 6).setDepth(41).setVisible(false);
    this.qcTipAt = Date.now();
    F.bus.on('guide', this.refreshQuestCard, this);
    this.events.once('shutdown', function () { F.bus.off('guide', this.refreshQuestCard, this); }, this);
  };
  U.questCardTap = function () {
    var s = F.session.state, card = L.questCard(s), w = world();
    if (!card || this.modals.length || !w) return;
    if (card.ready) {
      var r = L.claimQuest(s, 'daily', card.i);
      if (r === 'full') { sfx('nope'); return this.toast('Your bag is full! Make room first.'); }
      if (typeof r !== 'object') return;
      sfx('coin');
      w.changed();
      w.save();
      this.toast('Quest prize: ' + L.rewardLabel(r) + '!', 2400, 0x7a4d12);
      this.refreshQuestCard();
      return;
    }
    if (!L.questPlace(card.q.c)) return this.toast(L.dogName(s) + ': you can do this one anywhere!', 2200);
    if (w.guide) { w.guideStop('stopped'); return; }
    this.qcTip.setVisible(false);
    if (!L.dogNamed(s)) { // first, a name for the dog that leads you
      var self = this;
      return this.askDogName(function () { if (world()) world().guideTo(card.i); self.refreshQuestCard(); });
    }
    w.guideTo(card.i);
    this.refreshQuestCard();
  };
  // Soft and small (owner, 8 Nov 2026: "Too strong, its blocking the view"): a see-through card that opens for a few
  // seconds when its quest or progress changes (and while the dog leads), then folds to a small round badge (the icon in
  // its progress ring), as Today's Event does. A tap on either: the dog leads (or claims, when it is done: a gold badge).
  G.open = 5000;
  U.refreshQuestCard = function () {
    var box = this.questCardBox;
    if (!box) return;
    var s = F.session.state, card = s && L.questCard(s), w = world();
    var show = !!card && !!w && !F.session.visit && !this.decorating && !(this.photo);
    box.setVisible(show);
    if (!show) { this.qcTip.setVisible(false); return; }
    var q = card.q, p = L.questProgress(s, q), go = !card.ready && !!L.questPlace(q.c), guiding = !!(w && w.guide), now = Date.now();
    var what = [card.i, q.text, p, card.ready, guiding, q.got || 0].join('|');
    if (what !== this.qcWhat) { this.qcWhat = what; this.qcOpenUntil = now + G.open; }
    var open = guiding || now < (this.qcOpenUntil || 0);
    var key = what + '|' + open + '|' + go;
    if (key === this.qcKey) return;
    this.qcKey = key;
    var H = 32, R = 16, ring = 11;
    var room = 130, text = this.qcText, sub = this.qcSub;
    text.setText(q.text).setColor(card.ready ? '#4a2a08' : '#fff6d8').setScale(1).setPosition(36, 4).setFontSize(10);
    if (text.width > room) text.setScale(room / text.width);
    var adv = L.advOf && L.advOf(q); // (a daily adventure: where, or who to bring it to: 19zzzzzzzzzzzzzz-adventures.js)
    var advSub = adv && ((q.got || 0) >= q.n ? 'Bring it to ' + L.advWho(adv) : (q.n > 1 ? p + '/' + q.n + '  ·  ' : '') + L.advWhere(adv));
    sub.setText(card.ready ? 'Tap to claim!' : guiding ? L.dogName(s) + ' is leading you...' : advSub || p + '/' + q.n + (go ? '' : '  ·  anywhere')).setColor(card.ready ? '#4a2a08' : '#e8dcc0').setPosition(36, 17).setFontSize(9);
    var Wd = open ? Math.max(text.displayWidth, sub.width) + 36 + (go && !guiding ? 30 : 10) : H;
    this.qcBg.clear().fillStyle(card.ready ? 0xe9a91c : 0x24160b, card.ready ? 0.88 : 0.5).fillRoundedRect(0, 0, Wd, H, R);
    this.qcBg.lineStyle(1, 0xffffff, card.ready ? 0.6 : 0.22).strokeRoundedRect(0.5, 0.5, Wd - 1, H - 1, R - 0.5);
    this.qcRing.clear().lineStyle(3, card.ready ? 0x7a4d12 : 0x000000, card.ready ? 0.9 : 0.3).strokeCircle(R, H / 2, ring);
    var frac = Math.min(1, p / Math.max(1, q.n));
    if (frac > 0) this.qcRing.lineStyle(3, card.ready ? 0xfff3c8 : 0x7fd05a, 0.95).beginPath().arc(R, H / 2, ring, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).strokePath();
    this.qcIcon.setFrame(adv ? L.advIcon(adv) : iconOf(q.c)).setPosition(R, H / 2).setScale(0.12);
    text.setVisible(open);
    sub.setVisible(open);
    this.qcGo.setVisible(open && go && !guiding).setPosition(Wd - 17, H / 2);
    this.qcZone.setPosition(Wd / 2, H / 2).setSize(Wd, H);
    if (this.qcZone.input) this.qcZone.input.hitArea.setSize(Wd, H);
    this.qcTip.setY(G.card.y + H + 6);
  };
  // the dog's tip: the reason, now and then, when you stand still
  U.questTip = function () {
    var s = F.session.state, card = L.questCard(s), w = world();
    if (!card || card.ready || !L.questPlace(card.q.c) || !w || w.guide || this.modals.length || F.session.visit) return;
    var r = L.questReason(s, card.i), place = L.questPlace(card.q.c);
    var line = 'Arf! ' + (r ? r.text + ' ' : '') + place.say;
    var t = this.qcTip, self = this;
    t.removeAll(true);
    var words = this.txt(30, 8, line, 10, INK, { wordWrap: { width: 180 }, lineSpacing: 1 });
    var h = Math.max(30, words.height + 14), wd = Math.min(W - 24, Math.max(150, words.width + 40)), bg = this.add.graphics();
    bg.fillStyle(0xfff6dc, 0.97).fillRoundedRect(0, 0, wd, h, 10).lineStyle(1.5, 0x7a4d26, 0.6).strokeRoundedRect(0, 0, wd, h, 10);
    bg.fillStyle(0xfff6dc, 0.97).fillTriangle(18, 0, 30, 0, 22, -7);
    var face = this.add.image(15, h / 2, 'items', C.ICON.dog).setScale(0.14);
    var z = this.add.zone(wd / 2, h / 2, wd, h).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { t.setVisible(false); self.questCardTap(); });
    t.add([bg, face, words, z]);
    t.setAlpha(0).setVisible(true);
    this.tweens.add({ targets: t, alpha: 1, duration: 250 });
    this.time.delayedCall(6500, function () { self.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: function () { t.setVisible(false); } }); });
  };
  var checkQuests = U.checkQuests;
  U.checkQuests = function () {
    checkQuests.call(this);
    this.refreshQuestCard();
    var w = world(), now = Date.now();
    if (!w || !w.player) return;
    var f = w.feet();
    if (!this.qcStill || Math.hypot(f.x - this.qcStill.x, f.y - this.qcStill.y) > 8) this.qcStill = { x: f.x, y: f.y, at: now };
    if (now - this.qcTipAt > G.tipEvery && now - this.qcStill.at > G.tipStill) { this.qcTipAt = now; this.questTip(); }
  };

  // ---------- the Paused card: your dog's name on the birthday line (tap: rename) ----------
  var openPause = U.openPause;
  U.openPause = function () {
    openPause.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1], bday = null;
    if (!m || F.session.visit || !m.c.pauseLinks) return;
    var find = function (list) { list.forEach(function (o) { if (o.type === 'Text' && /^(Birthday:|Set your birthday)/.test(o.text)) bday = o; if (o.list) find(o.list); }); };
    find(m.c.list);
    var y = bday ? bday.y : m.c.pauseLinks.y - 48, R0 = W - 42, link = this.add.container(0, 0);
    var t = this.txt(R0 - 12, y, L.dogName(F.session.state), 12, '#2f6fae', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    var face = this.add.image(t.x - t.width - 10, y, 'items', C.ICON.dog).setScale(0.13);
    var z = this.add.zone((face.x - 10 + R0) / 2, y, R0 - face.x + 16, 26).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { self.closeModal(); self.askDogName(function () { self.openPause(); }); });
    link.add([t, face, z]);
    link.name = 'dog-link';
    m.c.add(link);
    if (bday && bday.x + bday.width * bday.scaleX > face.x - 14) bday.setScale(Math.max(0.6, (face.x - 14 - bday.x) / bday.width));
  };

})(window.Farm = window.Farm || {});
