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

  // Tool pose frames in the player sheet (rows 3-4), where the hands are in the 256x384 frame, which way the
  // tool's head points (screen degrees: 0 right, 90 down, -90 up), and which way its working side should face
  // (an x, y vector). Raised facing down or up, the farmer holds the handle across both fists over his head.
  var USE = {
    down: {
      raise: 9, strike: 10, hand: { raise: [52, 70], strike: [128, 290] },
      aim: { raise: 0, strike: 90, pour: 115 }, face: { raise: [0, -1], strike: [0, 1], pour: [0, 1] },
    },
    up: {
      raise: 11, strike: 12, hand: { raise: [52, 58], strike: [128, 120], pour: [150, 215] },
      aim: { raise: 0, strike: -90, pour: -100 }, face: { raise: [0, -1], strike: [0, -1], pour: [0, -1] }, behind: true,
    },
    left: {
      raise: 13, strike: 14, hand: { raise: [183, 55], strike: [46, 268] },
      aim: { raise: -100, strike: 150, pour: 160 }, face: { raise: [-1, -0.3], strike: [-1, 0.5], pour: [-1, 0.5] },
    },
    right: {
      raise: 13, strike: 14, hand: { raise: [73, 55], strike: [210, 268] },
      aim: { raise: -80, strike: 30, pour: 20 }, face: { raise: [1, -0.3], strike: [1, 0.5], pour: [1, 0.5] }, flip: true,
    },
  };
  // How each tool icon is drawn: the grip (handle end, as a share of the 128x128 icon), which way its head
  // points from there, and which way its working side faces (the axe's blade, the hammer's face, the hoe's
  // edge) as an x, y vector in the icon. Anything else (seed bags, food) is held by its middle, upright.
  var GRIP = {
    hoe: { x: 0.84, y: 0.16, dir: 132, edge: [-0.3, 1] },
    axe: { x: 0.2, y: 0.86, dir: -46, edge: [1, 0.3] },
    hammer: { x: 0.2, y: 0.86, dir: -50, edge: [1, 0.4] },
    sickle: { x: 0.2, y: 0.86, dir: -45, edge: [-1, 0.2] },
    rod: { x: 0.18, y: 0.88, dir: -47, edge: [1, 0] },
    can: { x: 0.64, y: 0.28, dir: 180, edge: [-1, 0] }, // held by the top handle; dir = where the spout points
  };
  var TOOL_SCALE = 1.5;
  var gripOf = function (frame) {
    var name = (C.ICON_ORDER[frame] || '').replace(/_\d$/, '');
    return GRIP[name] || null;
  };
  // Places a held tool so its grip is at (x, y), its head points along `aim`, and its working side faces as
  // close to `face` as it can (the icon is mirrored around the grip when that does better).
  var rotate = function (v, deg) {
    var a = Phaser.Math.DegToRad(deg), c = Math.cos(a), s = Math.sin(a);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  };
  var hold = function (img, g, x, y, aim, face) {
    img.setPosition(x, y);
    if (!g) {
      img.setOrigin(0.5, 0.75).setScale(TOOL_SCALE * 0.8).setAngle(face[0] < 0 ? -20 : 20);
      return;
    }
    var pose = function (mirror) {
      var dir = mirror ? 180 - g.dir : g.dir, angle = Phaser.Math.Angle.WrapDegrees(aim - dir);
      var edge = rotate(mirror ? [-g.edge[0], g.edge[1]] : g.edge, angle);
      return { mirror: mirror, angle: angle, score: edge[0] * face[0] + edge[1] * face[1] };
    };
    var a = pose(false), b = pose(true), pick = a.score >= b.score ? a : b;
    img.setOrigin(g.x, g.y).setScale(pick.mirror ? -TOOL_SCALE : TOOL_SCALE, TOOL_SCALE).setFlipX(false).setAngle(pick.angle);
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
    var self = this, u = USE[this.dir], p = this.player, g = gripOf(frame);
    var flip = !!u.flip;
    this.acting = kind === 'pour' ? (g === GRIP.can ? 620 : 420) : 320; // watering holds the can until the stream ends
    p.anims.stop();
    var tool = this.add.image(0, 0, 'items', frame);
    var place = function (pose, use) {
      p.setFrame(u[pose]).setFlipX(flip);
      var h = u.hand[use] || u.hand[pose];
      hold(tool, g, p.x - 128 + h[0], p.y - 192 + h[1], u.aim[use], u.face[use]);
      tool.setDepth(u.behind && use !== 'pour' ? p.depth - 0.001 : p.depth + 0.001);
    };
    if (kind === 'pour') {
      place('strike', 'pour');
      var tip = u.aim.pour > -90 && u.aim.pour < 90 ? 25 : -25; // tip the spout further down, then back
      this.tweens.add({ targets: tool, angle: tool.angle + tip, duration: 220, yoyo: true, hold: 60 });
    } else {
      place('raise', 'raise');
      var from = { x: tool.x, y: tool.y, angle: tool.angle };
      this.time.delayedCall(this.IMPACT ? this.IMPACT.swing : 110, function () {
        place('strike', 'strike');
        if (self.swoosh) self.swoosh(tool, from);
      });
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
