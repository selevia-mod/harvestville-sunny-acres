// Rare surprises on screen (rules: 01-logicH.js): a sparkling rock in the Mine and a golden crop on the farm. No new
// pictures: the rock and the crop are tinted, and the stars and their burst are drawn here.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var ROCK_TINT = 0xffcf40, CROP_TINT = 0xffd64a;

  // A four-point star with a soft glow.
  var starTexture = function (w) {
    if (w.textures.exists('fx-star')) return 'fx-star';
    var c = w.textures.createCanvas('fx-star', 64, 64), g = c.getContext(), m = 32;
    var glow = g.createRadialGradient(m, m, 0, m, m, 24);
    glow.addColorStop(0, 'rgba(255,226,120,0.8)');
    glow.addColorStop(1, 'rgba(255,214,80,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fffdf0';
    g.beginPath();
    g.moveTo(m, 1);
    g.quadraticCurveTo(m + 2, m - 2, 63, m);
    g.quadraticCurveTo(m + 2, m + 2, m, 63);
    g.quadraticCurveTo(m - 2, m + 2, 1, m);
    g.quadraticCurveTo(m - 2, m - 2, m, 1);
    g.fill();
    c.refresh();
    return 'fx-star';
  };

  // A soft glow and three stars that come and go over a thing, each at its own spot. Returns them, for stopSparkle.
  P.sparkle = function (x, y, w, h, depth) {
    var self = this, key = starTexture(this), parts = [];
    var glow = this.add.image(x, y, 'fx-glow').setDepth(depth - 0.01).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setDisplaySize(w * 1.7, h * 1.7).setAlpha(0.3);
    this.tweens.add({ targets: glow, alpha: 0.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    parts.push(glow);
    [[-0.32, -0.3, 0.62, 0], [0.36, -0.05, 0.46, 380], [-0.02, 0.32, 0.36, 760]].forEach(function (d) {
      var star = self.add.image(x + d[0] * w, y + d[1] * h, key).setDepth(depth).setScale(0);
      self.tweens.add({ targets: star, scale: d[2] * T / 64, angle: 45, duration: 480, yoyo: true, repeat: -1, repeatDelay: 240, delay: d[3], ease: 'Sine.inOut' });
      parts.push(star);
    });
    return parts;
  };
  P.stopSparkle = function (parts) {
    var self = this;
    (parts || []).forEach(function (part) { self.tweens.killTweensOf(part); part.destroy(); });
  };

  // The small moment after: stars fly out of the spot, a gold ring, the prize rising, and a card saying what you got.
  P.rareBurst = function (x, y, frame, text) {
    var self = this, key = starTexture(this);
    for (var i = 0; i < 12; i++) {
      (function (a, far) {
        var star = self.add.image(x, y, key).setDepth(DEPTH.fx).setScale(0.55 * T / 64);
        self.tweens.add({
          targets: star, x: x + Math.cos(a) * far, y: y + Math.sin(a) * far, scale: 0, angle: 180, duration: 700, ease: 'Quad.out',
          onComplete: function () { star.destroy(); },
        });
      })(i / 12 * Math.PI * 2 + 0.3, T * (i % 2 ? 1.2 : 1.7));
    }
    this.ring(x, y + T * 0.2, 0xffd23f, 1.6);
    var prize = this.add.image(x, y, 'items', frame).setScale(0.85).setDepth(DEPTH.fx);
    this.tweens.add({ targets: prize, y: y - T * 1.1, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: function () { prize.destroy(); } });
    if (F.ui) F.ui.toast(text, 2600, 0x7a5a12);
    sfx('found');
  };

  // ---------- the sparkling rock ----------
  var setupMine = P.setupMine;
  P.setupMine = function () {
    setupMine.call(this);
    var self = this, m = this.mine, w = this.map.width;
    this.sparks = {};
    m.spark.forEach(function (idx) {
      if (m.broken[idx] || !L.rockOpen(self.state, m.seed, F.session.mineFloor, idx)) return;
      var x = idx % w, y = Math.floor(idx / w), tile = self.layers.Walls.getTileAt(x, y);
      if (tile) tile.tint = ROCK_TINT;
      self.sparks[idx] = self.sparkle((x + 0.5) * T, (y + 0.45) * T, T * 0.8, T * 0.7, DEPTH.fx);
    });
  };
  var rockGone = function (w, idx) {
    w.stopSparkle(w.sparks && w.sparks[idx]);
    if (w.sparks) delete w.sparks[idx];
  };
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var self = this, m = this.mine, show = breakRock.call(this, idx, t, items);
    if (!show || m.spark.indexOf(idx) < 0) return show;
    rockGone(this, idx);
    var r = L.claimRock(this.state, m.seed, F.session.mineFloor, idx);
    if (!r) return show;
    return function () {
      show();
      var got = [];
      if (r.item) got.push('+' + r.n + ' ' + C.ITEMS[r.item].name);
      if (r.gold) got.push('+' + r.gold + 'G');
      self.rareBurst((t.x + 0.5) * T, (t.y + 0.5) * T, r.item ? C.ICON[r.item] : C.ICON.coin, 'Sparkling rock! ' + got.join(' and '));
      if (r.item) self.flyTile(t, C.ICON[r.item]);
    };
  };
  var remoteRock = P.remoteRock;
  P.remoteRock = function (idx) {
    remoteRock.call(this, idx);
    if (this.mine && this.mine.broken[idx]) rockGone(this, idx);
  };

  // ---------- the golden crop ----------
  var refreshTile = P.refreshTile;
  P.refreshTile = function (idx) {
    refreshTile.call(this, idx);
    var spr = this.crops[idx], gold = !!spr && L.goldenTile(this.state, idx), fx = this.goldFx = this.goldFx || {};
    if (gold && !fx[idx]) {
      spr.setTint(CROP_TINT);
      fx[idx] = this.sparkle(spr.x, spr.y - T * 0.45, T * 0.8, T * 0.7, DEPTH.crops + 0.1);
    } else if (!gold && fx[idx]) {
      if (spr) spr.clearTint();
      this.stopSparkle(fx[idx]);
      delete fx[idx];
    }
  };
  var create = P.create;
  P.create = function () {
    this.goldFx = {}; // (a new scene's first tiles: the old scene's stars went with it)
    create.call(this);
  };
  var harvest = P.harvest;
  P.harvest = function (t, idx) {
    var self = this, w = this.map.width;
    L.takeGolden();
    harvest.call(this, t, idx);
    L.takeGolden().forEach(function (g, i) {
      var at = { x: g.idx % w, y: Math.floor(g.idx / w) };
      self.time.delayedCall(i * 160, function () {
        self.rareBurst((at.x + 0.5) * T, (at.y + 0.4) * T, C.ICON.coin, 'Golden ' + C.ITEMS[g.item].name + '! +' + g.gold + 'G');
      });
    });
  };
})(window.Farm = window.Farm || {});
