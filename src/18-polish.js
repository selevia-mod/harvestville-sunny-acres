// Polish for the world: the farmer's tool swings, items flying into the bag, chips and wiggles, night
// darkness with glowing windows and lamps, fireflies, villager name tags and emotes, goals and tips.
// Mixed into WorldScene; setupPolish() runs at the end of create().
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var NIGHT_DEPTH = 30, GLOW_DEPTH = 31;

  // Tool pose frames in the player sheet (rows 3-4) and where the hands are in the 256x384 frame.
  var USE = {
    down: { raise: 9, strike: 10, hand: { raise: [128, 66], strike: [128, 300] }, angle: { raise: -45, strike: 135 } },
    up: { raise: 11, strike: 12, hand: { raise: [128, 64], strike: [128, 236] }, angle: { raise: -45, strike: -80 } },
    left: { raise: 13, strike: 14, hand: { raise: [206, 78], strike: [46, 268] }, angle: { raise: 0, strike: 180 } },
    right: { raise: 13, strike: 14, hand: { raise: [50, 78], strike: [210, 268] }, angle: { raise: 0, strike: 180 }, flip: true },
  };

  var M = {};

  M.setupPolish = function () {
    var self = this, mw = this.map.widthInPixels, mh = this.map.heightInPixels;
    this.acting = 0; // ms left in a tool swing (the farmer can't walk meanwhile)
    // night: a dark sheet over the whole map (under the HUD), with lights glowing through it
    this.nightRect = this.add.rectangle(-4 * T, -4 * T, mw + 8 * T, mh + 8 * T, 0x0d1440, 1).setOrigin(0).setDepth(NIGHT_DEPTH).setAlpha(0);
    if (!this.textures.exists('fx-glow')) {
      var c = this.textures.createCanvas('fx-glow', 128, 128), g = c.getContext();
      var gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,140,0.95)');
      gr.addColorStop(0.4, 'rgba(255,190,90,0.45)');
      gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      c.refresh();
    }
    this.glows = [];
    var glow = function (x, y, size) {
      self.glows.push(self.add.image(x, y, 'fx-glow').setDisplaySize(size, size).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH).setAlpha(0));
    };
    this.props.forEach(function (p) {
      var name = p.texture.key.replace('props/', ''), x = p.x, y = p.y, w = p.displayWidth, h = p.displayHeight;
      if (name === 'lamp' || name === 'lantern') glow(x + w / 2, y - h * 0.8, 3.2 * T);
      else if (['mayor', 'inn', 'forge', 'woodshop', 'clinic', 'cottage', 'cabin'].indexOf(name) >= 0) {
        glow(x + w * 0.22, y - h * 0.42, 2.4 * T);
        glow(x + w * 0.78, y - h * 0.42, 2.4 * T);
      } else if (name === 'fireplace') glow(x + w / 2, y - h * 0.3, 3 * T);
    });
    if (this.mapKey === 'farm') { // the farmhouse windows (the house is drawn in the tileset)
      glow(5.3 * T, 5.1 * T, 2.2 * T);
      glow(7.7 * T, 5.1 * T, 2.2 * T);
    }
    // fireflies on summer nights, around the farmer
    this.fireflies = null;
    if (this.outdoors && L.date(this.state.day).key === 'summer') {
      this.fireflies = this.add.particles(0, 0, 'fx-glow', {
        x: { min: -6 * T, max: 6 * T }, y: { min: -9 * T, max: 6 * T },
        lifespan: 4000, speedX: { min: -40, max: 40 }, speedY: { min: -50, max: 20 },
        scale: { start: 0.35, end: 0.15 }, alpha: { onUpdate: function (p, key, t) { return Math.sin(t * Math.PI) * 0.9; } },
        frequency: 260, blendMode: 'ADD', tint: 0xd8ff7a, emitting: false,
      }).setDepth(GLOW_DEPTH);
    }
    // a name tag over the nearest villager
    this.nameTag = this.add.text(0, 0, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '76px', fontStyle: 'bold', color: '#ffffff', stroke: '#3d2614', strokeThickness: 14 })
      .setOrigin(0.5, 1).setDepth(DEPTH.Above + 2).setVisible(false);
    this.emoteMs = 4000;
    this.lastHeld = undefined;
    this.applyDark(F.ui ? F.ui.darkness() : 0);
  };

  // How dark the night sheet is (0..1), set by the UI with the clock.
  M.applyDark = function (alpha) {
    if (!this.nightRect) return;
    this.nightRect.setAlpha(alpha);
    var lit = Math.min(1, alpha / 0.35);
    this.glows.forEach(function (gl) { gl.setAlpha(lit * 0.85); });
    if (this.fireflies) this.fireflies.emitting = alpha > 0.3;
  };

  M.updatePolish = function (dt, time) {
    var self = this;
    if (this.acting > 0) this.acting -= dt;
    var f = this.feet();
    if (this.fireflies) this.fireflies.setPosition(f.x, f.y);
    // name tag over the nearest villager within 2.5 tiles
    if (this.villagers) {
      var near = null, best = 2.5 * T;
      this.villagers.list.forEach(function (v) {
        if (!v.visible) return;
        var d = Math.hypot(v.x - f.x, v.y - f.y);
        if (d < best) { best = d; near = v; }
      });
      this.nameTag.setVisible(!!near);
      if (near) this.nameTag.setText(near.def.name).setPosition(near.x, near.y - 1.75 * T);
      // now and then someone hums a tune
      this.emoteMs -= dt;
      if (this.emoteMs <= 0) {
        this.emoteMs = Phaser.Math.Between(5000, 11000);
        var idle = this.villagers.list.filter(function (v) { return v.visible && !v.path.length && Math.abs(v.x - f.x) < 6 * T && Math.abs(v.y - f.y) < 9 * T; });
        if (idle.length) this.emote(idle[Math.floor(Math.random() * idle.length)], C.ICON.note);
      }
    }
    // a tip the first time you hold something
    var held = L.held(this.state), id = held ? held.id : null;
    if (id !== this.lastHeld) {
      var first = this.lastHeld === undefined;
      this.lastHeld = id;
      if (id && !first) {
        var key = L.tipKey(id), tip = key && L.takeTip(this.state, key);
        if (tip) {
          F.ui.tip(tip, L.iconOf(this.state, id));
          F.session.dirty = true;
        }
      }
    }
    void time;
    void self;
  };

  // A little speech bubble over a villager (or any world point).
  M.emote = function (v, frame) {
    var b = this.add.image(v.x, v.y - 1.6 * T, 'items', C.ICON.bubble).setDepth(DEPTH.Above + 1).setScale(0.8);
    var i = this.add.image(v.x, v.y - 1.66 * T, 'items', frame).setDepth(DEPTH.Above + 1).setScale(0.5);
    this.tweens.add({ targets: [b, i], y: '-=40', duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: [b, i], alpha: 0, delay: 1500, duration: 300, onComplete: function () { b.destroy(); i.destroy(); } });
  };

  // ---------- the farmer swings a tool ----------
  // kind: 'swing' (raise, then strike) or 'pour' (strike only, held out a little longer)
  M.animateUse = function (frame, kind) {
    var self = this, u = USE[this.dir], p = this.player;
    var flip = !!u.flip;
    this.acting = kind === 'pour' ? 420 : 320;
    p.anims.stop();
    var tool = this.add.image(0, 0, 'items', frame).setOrigin(0.18, 0.82).setScale(1.3).setFlipX(flip);
    var place = function (pose) {
      p.setFrame(u[pose]).setFlipX(flip);
      var h = u.hand[pose];
      tool.setPosition(p.x - 128 + h[0], p.y - 192 + h[1]).setAngle(u.angle[pose] + (flip ? 0 : 0));
      tool.setDepth(self.dir === 'up' && pose === 'strike' ? p.depth - 0.001 : p.depth + 0.001);
    };
    if (kind === 'pour') {
      place('strike');
      this.tweens.add({ targets: tool, angle: tool.angle + (flip ? 30 : -30), duration: 300, yoyo: true });
    } else {
      place('raise');
      this.time.delayedCall(110, function () { place('strike'); });
    }
    this.time.delayedCall(this.acting, function () {
      tool.destroy();
      self.idle();
    });
  };

  // ---------- items fly from the world into the bag ----------
  M.flyItem = function (wx, wy, frame) {
    var cam = this.cameras.main;
    F.ui.flyToBag((wx - cam.worldView.x) * cam.zoom / F.R, (wy - cam.worldView.y) * cam.zoom / F.R, frame);
  };

  M.flyTile = function (t, frame) {
    this.flyItem(t.x * T + T / 2, t.y * T + T / 2, frame);
  };

  // chips of wood or stone that fly out when debris is hit or breaks
  M.chips = function (t, color, n) {
    for (var i = 0; i < n; i++) {
      var r = this.add.rectangle(t.x * T + T / 2, t.y * T + T / 2, Phaser.Math.Between(18, 34), Phaser.Math.Between(14, 26), color).setDepth(DEPTH.fx);
      r.setStrokeStyle(5, 0x3b2312);
      var dx = Phaser.Math.Between(-150, 150), up = Phaser.Math.Between(90, 200);
      this.tweens.add({ targets: r, x: r.x + dx, angle: Phaser.Math.Between(-360, 360), duration: 520, ease: 'Linear' });
      this.tweens.add({ targets: r, y: r.y - up, duration: 220, ease: 'Quad.out', yoyo: true, onComplete: function (tw, targets) { targets[0].destroy(); } });
    }
  };

  // a crop wiggles happily when watered
  M.wiggle = function (idx) {
    var spr = this.crops && this.crops[idx];
    if (!spr || spr.sway) return;
    this.tweens.add({ targets: spr, scaleY: { from: 0.85, to: 1 }, scaleX: { from: 1.1, to: 1 }, duration: 380, ease: 'Back.out' });
  };

  // ---------- goals ----------
  M.progress = function (event, n) {
    var r = L.progress(this.state, event, n);
    F.bus.emit('goal');
    if (r) {
      F.session.dirty = true;
      F.ui.goalDone(r);
      F.bus.emit('hud');
    }
    return r;
  };

  // Where the current goal's arrow should point, as a world point (or null).
  M.goalPoint = function () {
    var g = L.goal(this.state);
    if (!g) return null;
    var t = g.target, name = t.map === this.mapKey ? null : C.ROUTES[this.mapKey][t.map];
    if (!name) {
      if (t.x != null) return { x: t.x * T + T / 2, y: t.y * T + T / 2 };
      if (t.point && this.points[t.point]) return this.points[t.point];
      name = t.object;
    }
    var o = this.objects.filter(function (x) { return x.name === name; })[0];
    if (!o) Object.keys(this.zones).forEach(function (k) { (this.zones[k] || []).forEach(function (z) { if (z.name === name) o = z; }); }, this);
    return o ? { x: (o.x0 + o.x1 + 1) / 2 * T, y: (o.y0 + o.y1 + 1) / 2 * T } : null;
  };

  Object.assign(F.WorldScene.prototype, M);
})(window.Farm = window.Farm || {});
