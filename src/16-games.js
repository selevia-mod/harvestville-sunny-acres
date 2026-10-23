// UI for the first-days goals (banner + guide arrow), items flying into the bag, choices in heart events,
// and the mini-games: fishing (keep the fish in the green bar) and the flower dance (tap on the beat).
// Mixed into UIScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK, COL = K.COL, ICON = K.ICON;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var BAG = { x: 14 + 6 * 48 + 22, y: 606 };

  var M = {};

  // ---------- goal banner + arrow ----------
  M.buildGoal = function () {
    var self = this;
    this.goalBar = this.add.container(0, 0).setDepth(50);
    var bg = this.baked(null, 8, 68, 'ui-goalbar', W - 16, 30, function (g) {
      g.fillStyle(0x24160b, 0.78).fillRoundedRect(0, 0, W - 16, 30, 10);
      g.lineStyle(2, 0xffd23f, 0.9).strokeRoundedRect(1, 1, W - 18, 28, 9);
    });
    this.goalStar = this.add.image(26, 83, 'items', C.ICON.star).setScale(0.17);
    this.goalText = this.txt(42, 75, '', 12, '#fff6d8', { fontStyle: 'bold' });
    var z = this.add.zone(W / 2, 83, W - 16, 32).setInteractive({ useHandCursor: true });
    z.on('pointerdown', function () {
      var g = L.goal(F.session.state);
      if (g && !self.modals.length) self.dialog('GOAL\n' + g.text + '.\n\nReward: ' + (L.rewardText(g.reward) || 'a good night\'s sleep') + '\n\nFollow the yellow arrow.');
    });
    this.goalBar.add([bg, this.goalStar, this.goalText, z]);
    this.arrow = this.add.image(0, 0, this.bake('ui-arrow', 30, 34, function (g) {
      g.fillStyle(0x3d2614, 1).fillTriangle(1, 3, 29, 3, 15, 33);
      g.fillStyle(0xffd23f, 1).fillTriangle(6, 6, 24, 6, 15, 27);
    })).setScale(1 / F.R).setDepth(40).setVisible(false);
    F.bus.on('goal', this.refreshGoal, this);
    this.events.once('shutdown', function () { F.bus.off('goal', this.refreshGoal, this); }, this);
    this.refreshGoal();
  };

  M.refreshGoal = function () {
    var s = F.session.state, g = L.goal(s);
    this.goalBar.setVisible(!!g);
    if (!g) return;
    var text = g.text + (g.need > 1 ? '  ' + s.gp + '/' + g.need : '');
    this.goalText.setText(text).setFontSize(text.length > 46 ? 11 : 12);
  };

  M.updateArrow = function (time) {
    var w = F.world, show = !!(w && w.goalPoint && !this.modals.length && !w.busy && L.goal(F.session.state));
    var p = show ? w.goalPoint() : null;
    if (!p) {
      this.arrow.setVisible(false);
      return;
    }
    var cam = w.cameras.main;
    var sx = (p.x - cam.worldView.x) * cam.zoom / F.R, sy = (p.y - cam.worldView.y) * cam.zoom / F.R;
    var box = { x0: 26, x1: W - 26, y0: 118, y1: 452 };
    var bob = Math.sin(time / 180) * 5;
    if (sx >= box.x0 && sx <= box.x1 && sy >= box.y0 && sy <= box.y1) {
      this.arrow.setVisible(true).setPosition(sx, sy - 30 + bob).setRotation(0);
      return;
    }
    // off screen: sit on the edge, pointing the way
    var cx = W / 2, cy = 290, dx = sx - cx, dy = sy - cy;
    var k = Math.min(dx ? Math.abs((dx > 0 ? box.x1 - cx : cx - box.x0) / dx) : Infinity, dy ? Math.abs((dy > 0 ? box.y1 - cy : cy - box.y0) / dy) : Infinity);
    var ang = Math.atan2(dy, dx);
    this.arrow.setVisible(true).setPosition(cx + dx * k - Math.cos(ang) * bob, cy + dy * k - Math.sin(ang) * bob).setRotation(ang - Math.PI / 2);
  };

  M.goalDone = function (r) {
    var self = this, s = F.session.state, next = L.goal(s);
    sfx('fanfare');
    this.refreshGoal();
    this.toast('GOAL COMPLETE!  ' + (L.rewardText(r.reward) || '') + (next ? '' : '\nAll starter goals done. The farm is yours!'), 3200, 0x7a5a12);
    var star = this.add.image(26, 83, 'items', C.ICON.star).setScale(0.17).setDepth(260);
    this.tweens.add({ targets: star, scale: 0.6, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: function () { star.destroy(); } });
    this.time.delayedCall(100, function () { self.confetti(W / 2, 90); });
  };

  // A quick burst of confetti at a screen point.
  M.confetti = function (x, y) {
    var tex = this.bake('ui-spark', 10, 10, function (g) { g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5); });
    var p = this.add.particles(x, y, tex, {
      speed: { min: 80, max: 200 }, angle: { min: 200, max: 340 }, lifespan: 900, gravityY: 300,
      scale: { start: 0.8 / F.R * 2, end: 0.2 }, tint: [0xff5a5a, 0xffd23f, 0x6ad1ff, 0x9cff6a, 0xff8ae0], emitting: false,
    }).setDepth(260);
    p.explode(28);
    this.time.delayedCall(1000, function () { p.destroy(); });
  };

  // ---------- items fly into the bag ----------
  M.flyToBag = function (x, y, frame) {
    var self = this, img = this.add.image(x, y, 'items', frame).setScale(ICON * 1.4).setDepth(240);
    this.tweens.add({ targets: img, x: BAG.x, duration: 600, ease: 'Sine.in' });
    this.tweens.add({
      targets: img, y: { from: y, to: BAG.y }, scale: ICON * 0.8, duration: 600, ease: 'Back.in',
      onComplete: function () {
        img.destroy();
        if (self.bagWidget) self.tweens.add({ targets: self.bagWidget.icon, scale: { from: ICON * 1.35, to: ICON }, duration: 220, ease: 'Back.out' });
      },
    });
  };

  // ---------- a choice, with the villager's picture (heart events) ----------
  // options: [{ label, cb }]
  M.choose = function (key, question, options) {
    var self = this, c = this.openModal(function () {});
    var h = 150 + options.length * 56, y0 = Math.round((H - h) / 2 - 30);
    this.panelImg(c, 24, y0, W - 48, h);
    if (key) {
      F.ensureTexture(this, 'people');
      c.add(this.add.image(70, y0 + 98, 'people', C.VILLAGER_ORDER.indexOf(key) * 9).setOrigin(0.5, 0.83).setScale(0.42).setCrop(0, 0, 128, 150));
      c.add(this.txt(116, y0 + 30, C.VILLAGERS[key].name, 17, INK, { fontStyle: 'bold' }));
    }
    c.add(this.txt(116, y0 + 56, question, 14, INK, { wordWrap: { width: 190 } }));
    options.forEach(function (o, i) {
      var b = self.button(c, W / 2, y0 + 128 + i * 56, W - 90, 46, o.label, function () {
        self.closeModal();
        o.cb();
      }, i ? 0x4a90c9 : 0x5fa84a);
      b.list[1].setFontSize(13).setWordWrapWidth(W - 110).setAlign('center');
    });
  };

  // Plays a list of [speaker, text] lines one after another, then calls done.
  M.playLines = function (lines, done) {
    var self = this, i = 0;
    var next = function () {
      if (i >= lines.length) return done && done();
      var l = lines[i++];
      if (l[0] === 'me') self.dialog(l[1], [{ label: 'Next', cb: next }]);
      else self.dialog(l[1], [{ label: 'Next', cb: next }], { portrait: l[0] });
    };
    next();
  };

  // ---------- mini-game: fishing ----------
  // Hold (the action button, the screen, or Space) to lift the green bar; keep the fish inside to fill the meter.
  M.startFishGame = function (fishId, done) {
    var self = this, G = C.FISH_GAME, def = G[fishId] || G.fish_m;
    var finished = false;
    var finish = function (ok) {
      if (finished) return;
      finished = true;
      self.game2 = null;
      self.closeModal();
      done(ok);
    };
    var c = this.openModal(function () { finish(false); });
    var TX = 268, TY = 140, TW = 44, TH = 320;
    this.panelImg(c, 24, 110, W - 48, 380);
    c.add(this.txt(40, 136, 'Reel it in!', 20, INK, { fontStyle: 'bold' }));
    c.add(this.txt(40, 170, 'Hold anywhere (or the action button) to lift the green bar. Keep the fish inside it until the meter is full.', 13, INK, { wordWrap: { width: 200 }, lineSpacing: 3 }));
    this.baked(c, TX - 4, TY - 4, 'ui-fishtrack', TW + 8, TH + 8, function (g) {
      g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, TW + 8, TH + 8, 10);
      g.fillStyle(0x2f6fa8, 1).fillRoundedRect(4, 4, TW, TH, 8);
    });
    var zoneH = def.zone * TH;
    var zone = this.add.rectangle(TX + 3, 0, TW - 6, zoneH, 0x7bdc5a, 0.75).setOrigin(0, 1);
    var fish = this.add.image(TX + TW / 2, 0, 'items', C.ITEMS[fishId].icon).setScale(0.26);
    this.baked(c, TX - 30, TY - 4, 'ui-fishmeter', 14, TH + 8, function (g) { g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, 14, TH + 8, 6); });
    var meter = this.add.rectangle(TX - 27, TY + TH, 8, 1, 0xffd23f).setOrigin(0, 1);
    c.add([zone, fish, meter]);
    var hold = this.add.zone(W / 2, H / 2, W, H).setInteractive();
    c.addAt(hold, 1); // over the dim background, under the panel bits
    var st = { zy: 0, zv: 0, fy: 0.5, target: 0.5, timer: 0, meter: G.start, held: false };
    hold.on('pointerdown', function () { st.held = true; });
    hold.on('pointerup', function () { st.held = false; });
    hold.on('pointerout', function () { st.held = false; });
    this.game2 = {
      press: function (down) { st.held = down; },
      update: function (dt) {
        var sec = dt / 1000, up = st.held || F.input.holding;
        st.zv += (up ? 3.2 : -2.6) * sec;
        st.zv = Phaser.Math.Clamp(st.zv, -1.4, 1.4);
        st.zy += st.zv * sec;
        if (st.zy < 0) { st.zy = 0; st.zv = 0; }
        if (st.zy > 1 - def.zone) { st.zy = 1 - def.zone; st.zv = 0; }
        st.timer -= sec;
        if (st.timer <= 0) {
          st.timer = Phaser.Math.FloatBetween(0.5, 1.3);
          st.target = Phaser.Math.FloatBetween(0.05, 0.95);
        }
        st.fy += Phaser.Math.Clamp(st.target - st.fy, -def.speed * sec, def.speed * sec);
        var inside = st.fy >= st.zy && st.fy <= st.zy + def.zone;
        st.meter = Phaser.Math.Clamp(st.meter + (inside ? G.fill : -G.drain) * sec, 0, 1);
        zone.setY(TY + TH - st.zy * TH).setFillStyle(inside ? 0x9cff6a : 0x7bdc5a, 0.75);
        fish.setY(TY + TH - st.fy * TH).setFlipX(st.target > st.fy);
        meter.setSize(8, Math.max(1, st.meter * TH));
        if (st.meter >= 1) finish(true);
        else if (st.meter <= 0) finish(false);
      },
    };
  };

  // ---------- mini-game: the flower dance ----------
  // A ring closes in on each beat; tap when it reaches the circle. Calls done(score 0..1).
  M.startDance = function (partner, done) {
    var self = this, D = C.DANCE, beat = 60 / D.bpm, n = D.beats;
    var c = this.openModal(function () {});
    this.panelImg(c, 24, 100, W - 48, 420);
    c.add(this.txt(W / 2, 122, 'The Flower Dance', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, 152, 'Tap when the ring reaches the circle!', 13, INK).setOrigin(0.5, 0));
    F.ensureTexture(this, 'people');
    c.add(this.add.image(W / 2 - 70, 470, 'player', 0).setOrigin(0.5, 1).setScale(0.36));
    c.add(this.add.image(W / 2 + 70, 470, 'people', C.VILLAGER_ORDER.indexOf(partner) * 9).setOrigin(0.5, 1).setScale(0.72));
    var CX = W / 2, CY = 300, R0 = 40;
    var target = this.add.image(CX, CY, this.bake('ui-dance-target', 92, 92, function (g) {
      g.lineStyle(6, 0x3d2614, 1).strokeCircle(46, 46, 42);
      g.fillStyle(0xffb3d1, 1).fillCircle(46, 46, 36);
    })).setScale(1 / F.R);
    var ringTex = this.bake('ui-dance-ring', 200, 200, function (g) { g.lineStyle(8, 0xe0557a, 1).strokeCircle(100, 100, 94); });
    var flower = this.add.image(CX, CY, 'items', C.ICON.spring).setScale(0.3);
    var scoreText = this.txt(CX, 214, '0 / ' + n, 16, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    var judge = this.txt(CX, 380, '', 20, '#e0557a', { fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5);
    c.add([target, flower, scoreText, judge]);
    var rings = [], hits = 0, t = -1.6; // a short count-in
    for (var i = 0; i < n; i++) {
      var r = this.add.image(CX, CY, ringTex).setScale(1 / F.R).setVisible(false);
      c.add(r);
      rings.push({ img: r, at: i * beat * 2, judged: false });
    }
    var show = function (text, color) {
      judge.setText(text).setColor(color).setScale(1.3).setAlpha(1);
      self.tweens.add({ targets: judge, scale: 1, alpha: 0, delay: 250, duration: 400 });
    };
    var tap = function () {
      var best = null;
      rings.forEach(function (rg) { if (!rg.judged && (!best || Math.abs(rg.at - t) < Math.abs(best.at - t))) best = rg; });
      if (!best || Math.abs(best.at - t) > beat) return;
      best.judged = true;
      best.img.setVisible(false);
      if (Math.abs(best.at - t) <= D.window) {
        hits++;
        scoreText.setText(hits + ' / ' + n);
        show('Great!', '#e0557a');
        sfx('pick');
        self.tweens.add({ targets: flower, angle: '+=72', scale: { from: 0.4, to: 0.3 }, duration: 200 });
      } else {
        show('Miss', '#7a5a3a');
      }
    };
    var zone = this.add.zone(W / 2, H / 2, W, H).setInteractive();
    c.addAt(zone, 1);
    zone.on('pointerdown', tap);
    var ended = false;
    this.game2 = {
      press: function (down) { if (down) tap(); },
      update: function (dt) {
        if (ended) return;
        var prev = t;
        t += dt / 1000;
        if (Math.floor(prev / beat) !== Math.floor(t / beat) && t > -1.6 + 0.01) sfx('tick');
        rings.forEach(function (rg) {
          var lead = rg.at - t; // seconds until it reaches the circle
          if (rg.judged) return;
          if (lead < -D.window) {
            rg.judged = true;
            rg.img.setVisible(false);
            show('Miss', '#7a5a3a');
            return;
          }
          var vis = lead <= beat * 2.2;
          rg.img.setVisible(vis);
          if (vis) rg.img.setScale((R0 + Math.max(0, lead) / (beat * 2.2) * 110) / 94 / F.R);
        });
        if (rings.every(function (rg) { return rg.judged; })) {
          ended = true;
          self.game2 = null;
          self.time.delayedCall(500, function () {
            self.closeModal();
            done(hits / n);
          });
        }
      },
    };
  };

  Object.assign(F.UIScene.prototype, M);
})(window.Farm = window.Farm || {});
