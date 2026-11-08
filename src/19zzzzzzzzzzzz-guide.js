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
  var G = F.GUIDE = { card: { x: 8, y: 104, w: 186, h: 42 }, ahead: 1.6, near: 0.32, tipEvery: 150000, tipStill: 6000, stuck: 1300 };

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
    var spot = this.guideGoal(g.place), path = spot && this.guidePath(spot.goal);
    if (!path) { this.guideStop(this.mapKey === g.place.map ? 'here' : 'lost'); return false; }
    this.guide = { path: path, k: 0, spot: spot, last: this.feet(), at: Date.now(), tries: (this.guide && this.guide.tries) || 0 };
    if (!path.length) this.guideArrive();
    else this.guideDogShow();
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
    var dt = Math.min(delta, 100), g = this.guide, f = this.feet(), tx = f.x, ty = f.y;
    if (g && g.path.length) { // a little ahead on the way
      var k = Math.min(g.path.length - 1, g.k + Math.round(G.ahead)), t = g.path[k];
      tx = (t.x + 0.5) * T; ty = (t.y + 0.5) * T;
    } else { tx = f.x + 0.7 * T; ty = f.y + 0.1 * T; }
    var dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy), moving = dist > 0.2 * T, fr;
    if (dist > 10 * T) { d.x = tx; d.y = ty; dist = 0; moving = false; }
    if (moving) {
      var step = Math.min(dist, C.SPEED * 1.25 * dt / 1000 * Math.min(1, dist / (0.6 * T) + 0.4));
      d.x += dx / dist * step; d.y += dy / dist * step;
      A.face(d, dx, dy);
      d.still = 0;
      fr = d.dir === 'side' ? 6 + STEPS[Math.floor(time / 120) % 4] : FACING[d.dir] + STEPS[Math.floor(time / 120) % 4];
      if (time - d.printAt > 260) { // paw prints behind it
        d.printAt = time;
        var p = this.add.image(d.x + (d.flip ? -1 : 1) * 0.12 * T, d.y + 0.05 * T, pawTex(this)).setScale(0.55).setAngle(Math.atan2(dy, dx) * 180 / Math.PI + 90).setDepth(DEPTH.flat + 0.1).setAlpha(0.8);
        this.tweens.add({ targets: p, alpha: 0, delay: 900, duration: 1400, onComplete: function () { p.destroy(); } });
      }
    } else {
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
    var goBg = this.add.graphics();
    goBg.fillStyle(BLUE, 1).fillRoundedRect(-17, -11, 34, 22, 11);
    goBg.lineStyle(1.5, 0xffffff, 0.6).strokeRoundedRect(-17, -11, 34, 22, 11);
    this.qcGo.add([goBg, this.txt(0, 0, 'Go', 11, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5)]);
    var z = this.add.zone(G.card.w / 2, G.card.h / 2, G.card.w, G.card.h).setInteractive({ useHandCursor: true });
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
  U.refreshQuestCard = function () {
    var box = this.questCardBox;
    if (!box) return;
    var s = F.session.state, card = s && L.questCard(s), w = world();
    var show = !!card && !!w && !F.session.visit && !this.decorating && !(this.photo);
    box.setVisible(show);
    if (!show) { this.qcTip.setVisible(false); return; }
    var q = card.q, p = L.questProgress(s, q), go = !card.ready && !!L.questPlace(q.c), guiding = !!(w && w.guide);
    var key = [card.i, q.text, p, card.ready, go, guiding].join('|');
    if (key === this.qcKey) return;
    this.qcKey = key;
    var Wd = G.card.w, H = G.card.h;
    this.qcBg.clear().fillStyle(card.ready ? 0xe9a91c : 0x24160b, card.ready ? 0.96 : 0.82).fillRoundedRect(0, 0, Wd, H, 12);
    this.qcBg.lineStyle(2, card.ready ? 0xfff3c8 : 0xffd23f, 0.9).strokeRoundedRect(1, 1, Wd - 2, H - 2, 11);
    this.qcRing.clear().lineStyle(4, card.ready ? 0x7a4d12 : 0x6a4a2a, 1).strokeCircle(22, H / 2, 15);
    var frac = Math.min(1, p / Math.max(1, q.n));
    if (frac > 0) this.qcRing.lineStyle(4, card.ready ? 0xfff3c8 : 0x7fd05a, 1).beginPath().arc(22, H / 2, 15, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).strokePath();
    this.qcIcon.setFrame(iconOf(q.c));
    var room = (go ? Wd - 44 : Wd - 8) - 42;
    this.qcText.setText(q.text).setColor(card.ready ? '#4a2a08' : '#fff6d8').setScale(1);
    if (this.qcText.width > room) this.qcText.setScale(room / this.qcText.width);
    this.qcSub.setText(card.ready ? 'Tap to claim!' : guiding ? L.dogName(s) + ' is leading you...' : p + '/' + q.n + (go ? '' : '  ·  anywhere')).setColor(card.ready ? '#4a2a08' : '#d9c49a');
    this.qcGo.setVisible(go && !guiding);
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

  // ---------- the Quests panel's Daily tab: today's trail (owner's pick: option 4) ----------
  // The day's quests as stepping stones on a winding path, from the bottom up to the day's chest at the top: done ones
  // green with a tick, one ready to claim gold, the one on your card ringed. A tap on a stone: the quest, its reason,
  // and Claim, Go or Pin. (Weekly, Monthly and Badges stay lists.)
  var TRAIL = { top: 190, bottom: 512, amp: 92 };
  var stoneAt = function (k, n) {
    var y = TRAIL.bottom - (TRAIL.bottom - TRAIL.top) * k / n;
    return { x: W / 2 + TRAIL.amp * Math.sin(k * 1.05 + 0.4), y: y };
  };
  var openQuests = U.openQuests;
  U.openQuests = function (tab, page) {
    openQuests.apply(this, arguments);
    if ((tab || 'daily') !== 'daily') return;
    var m = this.modals[this.modals.length - 1], s = F.session.state, set = s.dq;
    if (!m || !set) return;
    var c = m.c, self = this, panelBottom = 0;
    // the list's rows and its pages go; the panel, its title, its tabs and its line stay
    c.list.slice().forEach(function (o) {
      var b = o.getBounds && o.getBounds();
      if (!b) return;
      if (b.height >= 300) { panelBottom = Math.max(panelBottom, b.bottom); return; }
      if (b.top >= TRAIL.top - 14) o.destroy();
    });
    TRAIL.bottom = 512; // (the last stone inside the panel: a paged list's panel ends at about 542)
    var n = set.list.length, card = L.questCard(s), pts = [];
    for (var k = 0; k <= n; k++) pts.push(stoneAt(k, n));
    var path = this.add.graphics();
    path.lineStyle(16, 0xc9a46a, 0.9).beginPath().moveTo(pts[0].x, pts[0].y);
    for (k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k];
      path.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 6).lineTo(b.x, b.y);
    }
    path.strokePath();
    path.lineStyle(2, 0x8a6a3a, 0.35).beginPath().moveTo(pts[0].x, pts[0].y);
    for (k = 1; k < pts.length; k++) path.lineTo(pts[k].x, pts[k].y);
    c.add(path);
    set.list.forEach(function (q, i) {
      var pt = pts[i], ready = L.questReady(s, q), done = !!q.done, mine = card && card.i === i;
      var g = self.add.graphics(), fill = done ? 0x7fd05a : ready ? 0xe9b62a : 0xfff6dc;
      g.fillStyle(0x3d2614, 0.25).fillCircle(pt.x, pt.y + 3, 17);
      g.fillStyle(fill, 1).fillCircle(pt.x, pt.y, 16).lineStyle(2, 0x7a4d26, 0.8).strokeCircle(pt.x, pt.y, 16);
      if (mine && !done) g.lineStyle(3, 0x4a90c9, 1).strokeCircle(pt.x, pt.y, 20);
      c.add(g);
      c.add(self.add.image(pt.x, pt.y, 'items', iconOf(q.c)).setScale(0.12).setAlpha(done ? 0.55 : 1));
      if (done) c.add(self.txt(pt.x + 11, pt.y + 9, '✓', 12, '#2f6a1a', { fontStyle: 'bold' }).setOrigin(0.5));
      var left = pt.x > W / 2, words = self.txt(pt.x + (left ? -24 : 24), pt.y, q.text, 10, done ? '#8a7a5a' : INK, { fontStyle: done ? 'normal' : 'bold' }).setOrigin(left ? 1 : 0, 0.5);
      var room = left ? pt.x - 24 - 26 : W - 26 - (pt.x + 24);
      if (words.width > room) words.setScale(room / words.width);
      c.add(words);
      var z = self.add.zone(pt.x, pt.y, 44, 40).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () { self.questStone(i); });
      c.add(z);
    });
    // the day's chest at the top
    var top = pts[n], open = !!set.all, chest = this.add.image(top.x, top.y - 4, 'items', C.ICON.chest).setScale(0.26).setAlpha(open ? 0.5 : 1);
    c.add(chest);
    c.add(this.txt(top.x + (top.x > W / 2 ? -26 : 26), top.y - 4, open ? 'Opened today' : 'Finish all ' + n, 10, INK, { fontStyle: 'bold' }).setOrigin(top.x > W / 2 ? 1 : 0, 0.5));
    if (L.chestReady(s, 'daily')) {
      this.tweens.add({ targets: chest, scale: 0.3, duration: 500, yoyo: true, repeat: -1 });
      var zc = this.add.zone(top.x, top.y, 50, 46).setInteractive({ useHandCursor: true });
      F.tapOn(zc, function () {
        var r = L.claimChest(s, 'daily');
        if (r === 'full') { sfx('nope'); return self.toast('Your bag is full! Make room first.'); }
        if (typeof r !== 'object') return;
        sfx('coin'); world().changed(); world().save();
        self.closeModal(); self.openQuests('daily', 0);
        self.toast('Chest: ' + L.rewardLabel(r) + '!', 2400, 0x7a4d12);
      });
      c.add(zc);
    }
    c.trail = true;
  };
  // A stone's quest: what, why, how far, the prize; Claim, Go or Pin.
  U.questStone = function (i) {
    var self = this, s = F.session.state, q = s.dq && s.dq.list[i];
    if (!q) return;
    this.closeModal();
    var c = this.openModal(function () { self.closeModal(); self.openQuests('daily', 0); });
    var y0 = 190, h = 250;
    this.panelImg(c, 24, y0, W - 48, h);
    var r = L.questReason(s, i), p = L.questProgress(s, q), ready = L.questReady(s, q), place = L.questPlace(q.c), pinned = s.qp && s.qp.d === s.dq.d && s.qp.i === i;
    c.add(this.add.image(W / 2, y0 + 34, 'items', iconOf(q.c)).setScale(0.22));
    c.add(this.txt(W / 2, y0 + 64, q.text, 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    if (r) c.add(this.txt(W / 2, y0 + 90, r.text, 12, '#7a5a3a', { align: 'center', wordWrap: { width: W - 90 } }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, y0 + 130, q.done ? 'Done today!' : p + ' of ' + q.n + '   ·   Prize: ' + (L.rewardLabel(q.reward) || ''), 12, INK).setOrigin(0.5, 0));
    this.closeButton(c, W - 38, y0 + 12, function () { self.closeModal(); self.openQuests('daily', 0); });
    var by = y0 + h - 40, buttons = [];
    if (ready) buttons.push(['Claim', 0xe9a91c, function () { self.closeModal(); s.qp = { d: s.dq.d, i: i }; self.questCardTap(); self.openQuests('daily', 0); }]);
    if (!q.done && !ready && place) buttons.push(['Go', BLUE, function () { self.closeAll(); L.pinQuest(s, i); self.qcKey = null; self.refreshQuestCard(); self.questCardTap(); }]);
    if (!q.done) buttons.push([pinned ? 'Pinned' : 'Pin to screen', 0x5fa84a, function () { L.pinQuest(s, pinned ? -1 : i); F.session.dirty = true; self.qcKey = null; self.refreshQuestCard(); self.closeModal(); self.openQuests('daily', 0); }]);
    var bw = Math.min(130, (W - 80 - (buttons.length - 1) * 10) / Math.max(1, buttons.length));
    buttons.forEach(function (b, k) {
      var x = W / 2 + (k - (buttons.length - 1) / 2) * (bw + 10);
      self.button(c, x, by, bw, 40, b[0], b[2], b[1]);
    });
  };
})(window.Farm = window.Farm || {});
