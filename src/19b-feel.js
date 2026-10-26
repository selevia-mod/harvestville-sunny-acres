// Game feel for the farmer: what happens when a tool lands (dirt, chips, splashes, the hit thing shaking and
// popping, a small camera bump), and how walking feels (easing in and out, steady facing on diagonals,
// steps that match the speed, footstep dust and sounds). Mixed into WorldScene; runs after 18-polish.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // When the tool lands, in ms after the button: the swing's raise lasts 110 ms, poured water takes a bit longer.
  P.IMPACT = { swing: 110, pour: 120 };

  // Rows of the effects sheet (assets/fx.png, 4 pieces each; the order is FX_KINDS in tools/art-manifest.js).
  var FX_ROW = { dirt: 0, wood: 1, stone: 2, leaf: 3, water: 4, dust: 5 };
  var fxFrames = function (kind, list) { return (list || [0, 1, 2, 3]).map(function (k) { return FX_ROW[kind] * 4 + k; }); };
  P.fxFrame = function (kind, k) { return FX_ROW[kind] * 4 + k; };

  // Bits that fly off, by material: which pieces, how they fly and how big they are (a piece is 128 px; a tile
  // is 256 world units).
  var BITS = {
    dirt: { speed: [450, 1000], gravity: 4200, life: [420, 620], scale: [0.42, 0.3], spin: true },
    wood: { speed: [550, 1150], gravity: 4200, life: [450, 650], scale: [0.5, 0.36], spin: true },
    stone: { speed: [550, 1200], gravity: 4600, life: [400, 600], scale: [0.42, 0.3], spin: true },
    leaf: { speed: [320, 750], gravity: 1500, life: [600, 850], scale: [0.48, 0.36], spin: true },
    water: { frames: [0, 1], speed: [280, 700], gravity: 3600, life: [380, 560], scale: [0.32, 0.18] },
    dust: { speed: [50, 200], gravity: -250, life: [380, 560], scale: [0.35, 0.8], alpha: [0.85, 0] },
  };

  function makeTextures(scene) {
    var tex = scene.textures;
    var draw = function (key, w, h, fn) {
      if (tex.exists(key)) return;
      var c = tex.createCanvas(key, w, h), g = c.getContext();
      fn(g);
      c.refresh();
    };
    draw('fx-ring', 160, 80, function (g) {
      g.beginPath();
      g.ellipse(80, 40, 72, 32, 0, 0, Math.PI * 2);
      g.lineWidth = 9;
      g.strokeStyle = '#ffffff';
      g.stroke();
    });
  }

  P.setupFeel = function () {
    var self = this;
    makeTextures(this);
    this.bits = {};
    Object.keys(BITS).forEach(function (k) {
      var b = BITS[k];
      self.bits[k] = self.add.particles(0, 0, F.ensureTexture(self, 'fx'), {
        frame: fxFrames(k, b.frames),
        speed: { min: b.speed[0], max: b.speed[1] },
        angle: k === 'dust' ? { min: 180, max: 360 } : { min: 200, max: 340 }, // upward fan
        gravityY: b.gravity,
        lifespan: { min: b.life[0], max: b.life[1] },
        scale: { start: b.scale[0], end: b.scale[1] },
        alpha: b.alpha ? { start: b.alpha[0], end: b.alpha[1] } : { start: 1, end: 0.6 },
        rotate: b.spin ? { start: Phaser.Math.Between(0, 360), end: 540 } : { min: -25, max: 25 },
        emitting: false,
      }).setDepth(DEPTH.fx);
    });
    // footsteps: a puff of dust and a soft sound on each step frame
    this.player.on('animationupdate', function (anim, frame) {
      if (anim.key.indexOf('walk-') !== 0 || frame.index % 2 === 0) return; // frames 1 and 3 are the steps
      self.footstep();
    });
    this.stepSide = 0;
  };
  var setupPolish = P.setupPolish;
  P.setupPolish = function () {
    setupPolish.call(this);
    this.setupFeel();
  };

  // Throws n bits of a material from a world point.
  P.burst = function (kind, x, y, n) {
    if (this.bits && this.bits[kind] && n > 0) this.bits[kind].explode(n, x, y);
  };

  // The middle and the ground line of a tile, in world units.
  var mid = function (t) { return { x: t.x * T + T / 2, y: t.y * T + T * 0.62 }; };

  // A flat ring that spreads out on the ground (impact, splash, charged swing).
  P.ring = function (x, y, color, scale) {
    var r = this.add.image(x, y, 'fx-ring').setTint(color || 0xffffff).setAlpha(0.75).setScale(0.3 * (scale || 1)).setDepth(DEPTH.Soil + 0.5);
    this.tweens.add({ targets: r, scale: 1.5 * (scale || 1), alpha: 0, duration: 380, ease: 'Quad.out', onComplete: function () { r.destroy(); } });
  };

  // ---------- the thing that was hit reacts ----------
  // A loose copy of a map tile (debris, a mine rock, soil) that can shake, squash and pop while the real
  // tile is hidden underneath.
  P.tileImage = function (layerName, x, y) {
    var layer = this.layers[layerName], tile = layer && layer.getTileAt(x, y);
    if (!tile || !tile.tileset) return null;
    var ts = tile.tileset, key = ts.image.key, fk = 'tile' + tile.index, texture = this.textures.get(key);
    if (!texture.has(fk)) {
      var c = ts.getTileTextureCoordinates(tile.index);
      if (!c) return null;
      texture.add(fk, 0, c.x, c.y, ts.tileWidth, ts.tileHeight);
    }
    var img = this.add.image(x * T + T / 2, (y + 1) * T, key, fk).setOrigin(0.5, 1).setDepth(layer.depth + 0.01);
    img.tile = tile;
    return img;
  };

  // A hit that doesn't break it yet: it rocks on its base.
  P.wobble = function (layerName, t) {
    var img = this.tileImage(layerName, t.x, t.y);
    if (!img) return;
    img.tile.setAlpha(0);
    var side = Math.random() < 0.5 ? -1 : 1;
    img.setAngle(16 * side).setScale(1.18, 0.82);
    this.tweens.add({
      targets: img, angle: 0, scaleX: 1, scaleY: 1, duration: 420, ease: 'Elastic.out', easeParams: [1.2, 0.35],
      onComplete: function () { img.tile.setAlpha(1); img.destroy(); },
    });
  };

  // Broken: it swells for a moment, then shrinks away. Call before the tile is removed.
  P.popOut = function (layerName, t) {
    var img = this.tileImage(layerName, t.x, t.y);
    if (!img) return;
    img.tile = null;
    this.tweens.chain({
      targets: img,
      tweens: [
        { scaleX: 1.18, scaleY: 1.12, duration: 70, ease: 'Quad.out' },
        { scaleX: 0.2, scaleY: 0.1, alpha: 0, angle: Phaser.Math.Between(-25, 25), duration: 200, ease: 'Quad.in' },
      ],
      onComplete: function () { img.destroy(); },
    });
  };

  // Freshly tilled soil springs out of the ground.
  P.soilPop = function (t) {
    var img = this.tileImage('Soil', t.x, t.y);
    if (!img) return;
    var tile = img.tile;
    tile.setAlpha(0);
    img.setOrigin(0.5, 0.5).setPosition(t.x * T + T / 2, t.y * T + T / 2).setScale(0.55, 0.35);
    this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 240, ease: 'Back.out', onComplete: function () { tile.setAlpha(1); img.destroy(); } });
  };

  // Watered soil darkens gradually: the dry tile fades away over the wet one. Call before refreshTile.
  P.soakIn = function (t) {
    var img = this.tileImage('Soil', t.x, t.y);
    if (!img) return null;
    img.tile = null;
    var self = this;
    return function () {
      self.tweens.add({ targets: img, alpha: 0, duration: 520, ease: 'Sine.in', onComplete: function () { img.destroy(); } });
    };
  };

  // ---------- effects used by the tools (replace the simple ones in 11-world.js / 18-polish.js) ----------
  P.puff = function (t, color, n) {
    var m = mid(t);
    this.burst('dust', m.x, m.y, n + 1);
  };

  P.chips = function (t, color, n) {
    var m = mid(t), kind = color === 0x6cbf4a || color === 0x93d66b ? 'leaf' : color === 0x9aa0a8 || color === 0x8a7a6a ? 'stone' : 'wood';
    this.burst(kind, m.x, m.y - 40, n);
  };

  // A stream of water from the can's spout onto the tile, then a splash. Watering many tiles at once (an upgraded
  // can) shares the drops out: 18 for one tile, a few each for 15, so a big swing doesn't spawn hundreds at once.
  P.drops = function (t, tiles) {
    var self = this, m = mid(t), from = this.spout(), n = Math.max(3, Math.round(18 / Math.max(1, tiles || 1))), many = (tiles || 1) > 3;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var d = self.add.image(from.x + Phaser.Math.Between(-14, 14), from.y, 'fx', self.fxFrame('water', 0)).setScale(Phaser.Math.FloatBetween(0.26, 0.36)).setDepth(DEPTH.fx);
        var tx = m.x + Phaser.Math.Between(-80, 80), ty = m.y + Phaser.Math.Between(-40, 30);
        d.setRotation(Math.atan2(ty - from.y, tx - from.x) - Math.PI / 2); // the drop's point trails behind
        self.tweens.add({ targets: d, x: tx, duration: 200, delay: i * 16, ease: 'Linear' });
        self.tweens.add({
          targets: d, y: ty, duration: 200, delay: i * 16, ease: 'Quad.in',
          onComplete: function () { d.destroy(); if (!many && i % 4 === 0) self.burst('water', tx, ty, 2); },
        });
      })(i);
    }
    this.time.delayedCall(200, function () {
      self.burst('water', m.x, m.y, many ? 2 : 6);
      self.splash(m.x, m.y);
    });
  };

  // A splash crown that pops up and a ripple ring that spreads where water lands.
  P.splash = function (x, y) {
    var crown = this.add.image(x, y + 20, 'fx', this.fxFrame('water', 2)).setOrigin(0.5, 0.85).setScale(0.3, 0.1).setDepth(DEPTH.fx);
    this.tweens.add({ targets: crown, scaleX: 0.75, scaleY: 0.65, duration: 160, ease: 'Back.out' });
    this.tweens.add({ targets: crown, alpha: 0, delay: 170, duration: 220, onComplete: function () { crown.destroy(); } });
    var ring = this.add.image(x, y + 20, 'fx', this.fxFrame('water', 3)).setScale(0.3).setAlpha(0.9).setDepth(DEPTH.Soil + 0.5);
    this.tweens.add({ targets: ring, scale: 1.3, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: function () { ring.destroy(); } });
  };

  // Where the watering can's spout is: in front of the farmer, at hand height.
  P.spout = function () {
    var f = this.feet(), d = this.dirVec();
    return { x: f.x + d[0] * 150, y: f.y - 150 + (d[1] > 0 ? 90 : d[1] < 0 ? -40 : 0) };
  };

  // What the camera does on impact: heavier hits bump harder.
  P.bump = function (strength) {
    this.cameras.main.shake(strength > 1 ? 120 : 70, strength > 1 ? 0.0035 : 0.0016);
  };

  // Motion trail: fading copies of the tool between where it was raised and where it lands.
  P.swoosh = function (tool, from) {
    var self = this;
    for (var i = 1; i <= 4; i++) {
      var k = i / 5;
      var g = this.add.image(from.x + (tool.x - from.x) * k, from.y + (tool.y - from.y) * k, tool.texture.key, tool.frame.name)
        .setOrigin(tool.originX, tool.originY).setScale(tool.scaleX, tool.scaleY).setFlipX(tool.flipX)
        .setAngle(from.angle + Phaser.Math.Angle.ShortestBetween(from.angle, tool.angle) * k)
        .setDepth(tool.depth - 0.0005).setAlpha(0.12 + 0.3 * k).setTintFill(0xffffff);
      self.tweens.add({ targets: g, alpha: 0, duration: 150, ease: 'Quad.out', onComplete: function (tw, targets) { targets[0].destroy(); } });
    }
    sfx('swoosh');
  };

  // ---------- what each kind of impact looks like ----------
  // e = a tool effect from toolEffect(); tile = { x, y }; broke = the debris broke on this hit.
  P.impact = function (tool, e, tile, broke) {
    var m = mid(tile);
    if (e.kind === 'till') {
      this.soilPop(tile);
      this.burst('dirt', m.x, m.y, 7);
      this.puff(tile, 0xd9b98a, 2);
    } else if (e.kind === 'untill') {
      this.burst('dirt', m.x, m.y, 5);
      this.puff(tile, 0xd9b98a, 3);
    } else if (e.kind === 'cut') {
      this.burst('leaf', m.x, m.y - 60, 6);
    } else if (e.kind === 'debris') {
      var kind = e.debris === 'weed' ? 'leaf' : e.debris === 'branch' || e.debris === 'stump' ? 'wood' : 'stone';
      if (!broke) {
        this.wobble('Debris', tile);
        this.burst(kind, m.x, m.y - 100, 3); // from the top of it, so the pieces don't cover it
        this.puff(tile, 0xd9c8a8, 1);
        return;
      }
      this.burst(kind, m.x, m.y - 80, e.debris === 'stump' || e.debris === 'boulder' ? 10 : 6);
      if (e.debris === 'branch') this.burst('leaf', m.x, m.y - 60, 4);
      this.puff(tile, kind === 'stone' ? 0xc8c8c8 : 0xd9c8a8, e.debris === 'boulder' || e.debris === 'stump' ? 5 : 3);
      if (e.debris === 'stump' || e.debris === 'boulder') this.ring(m.x, m.y, 0xffffff, 1.1);
    } else if (e.kind === 'rock') {
      this.burst('stone', m.x, m.y - 80, 9);
      this.puff(tile, 0xb8b0a0, 5);
    }
  };

  // Charged swings land with a ring across the whole area.
  P.chargeImpact = function (tiles, level) {
    if (!level || !tiles.length) return;
    var x = 0, y = 0;
    tiles.forEach(function (p) { x += p[0]; y += p[1]; });
    var c = mid({ x: x / tiles.length, y: y / tiles.length });
    this.ring(c.x, c.y, 0xfff2b0, 1.4 + level * 0.5);
  };

  // ---------- walking ----------
  var ACCEL_MS = 70; // time constant to reach walking speed
  var STOP_MS = 45; // and to stop
  var SIDE_BIAS = 1.15; // on a diagonal, keep facing the way you were until one axis clearly wins

  P.move = function (body) {
    var vx = F.input.jx, vy = F.input.jy, k = this.keys;
    if (k) {
      if (k.LEFT.isDown || k.A.isDown) vx = -1;
      else if (k.RIGHT.isDown || k.D.isDown) vx = 1;
      if (k.UP.isDown || k.W.isDown) vy = -1;
      else if (k.DOWN.isDown || k.S.isDown) vy = 1;
    }
    var len = Math.sqrt(vx * vx + vy * vy);
    if (len < 0.2) { vx = vy = 0; len = 0; } else if (len > 1) { vx /= len; vy /= len; len = 1; }
    var speed = C.SPEED * (F.session.riding ? C.HORSE.speed : 1);
    // ease toward the wanted velocity instead of jumping to it
    var dt = Math.min(this.game.loop.delta, 100), going = len > 0;
    var ease = 1 - Math.exp(-dt / (going ? ACCEL_MS : STOP_MS));
    var nx = body.velocity.x + (vx * speed - body.velocity.x) * ease;
    var ny = body.velocity.y + (vy * speed - body.velocity.y) * ease;
    if (!going && Math.abs(nx) < 30 && Math.abs(ny) < 30) nx = ny = 0;
    body.setVelocity(nx, ny);
    if (going) this.dir = this.pickDir(vx, vy);
    if (F.session.riding) {
      if (vx) this.rideFlip = vx > 0;
      this.moving = going;
      return;
    }
    if (going) {
      this.player.anims.play(F.walkAnim(this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir), true);
      this.player.setFlipX(this.dir === 'right');
      // a gentle push of the stick walks slowly, with slower steps
      var actual = Math.hypot(nx, ny) / speed;
      this.player.anims.timeScale = 0.55 + 0.65 * Math.min(1, Math.max(len, actual));
    } else if (this.player.anims.isPlaying) {
      this.idle();
    }
  };

  // Which way to face for a movement: no flicker between side and up/down on a diagonal.
  P.pickDir = function (vx, vy) {
    var ax = Math.abs(vx), ay = Math.abs(vy);
    var h = vx < 0 ? 'left' : 'right', v = vy < 0 ? 'up' : 'down';
    if (ax > ay * SIDE_BIAS || !vy) return h;
    if (ay > ax * SIDE_BIAS || !vx) return v;
    return this.dir === h || this.dir === v ? this.dir : ax >= ay ? h : v;
  };

  P.footstep = function () {
    var f = this.feet(), sp = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y);
    if (sp < C.SPEED * 0.35) return;
    this.stepSide = 1 - this.stepSide;
    var side = (this.stepSide ? 1 : -1) * 34;
    var indoor = this.mapKey === 'house';
    if (!indoor && this.bits) {
      this.bits.dust.explode(1, f.x + side, f.y + 20);
    }
    if (F.Audio) F.Audio.sfx(indoor ? 'stepWood' : 'step');
  };
})(window.Farm = window.Farm || {});
