// Drawing the Bow (owner, 2 Nov 2026: "just a standing character with automatically firing arrows"). Shoot is now a real
// shot: you turn to the animal in an archer's stance (assets/archer*.png, hands empty, tools/art/archer-import.js), the
// bow comes up with an arrow on the string, you pull back to the cheek, let go, the string shivers, the bow kicks and the
// arrow leaves with a streak behind it. The bow follows the animal while you draw. One arrow at a time, and you stand
// still for it, like a tool swing. Friends see your bow flash where your arrow starts. The rules (arrows, energy, range,
// what a hit does) are in 01-logicD.js and 19v-wild.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var O = F.Online;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  var READY_MS = 90, DRAW_MS = 160, AFTER_MS = 180; // bow up, pulling back, then what follows the arrow
  var BOW_SCALE = 1.55;
  var ARROW_W = 0.85 * T, ARROW_H = 0.28 * T;

  // The archer sheets: rows facing you, away and left; columns READY, FULL (drawn), LET GO. `grip` = the fist that holds
  // the bow in each column of the 288x384 frame: the bow stays in that hand from start to finish (owner, 2 Nov: "it
  // floats"), and the fist is drawn again over it, gripping it. `back` = how far the string comes back. Aiming up, the
  // bow is beyond the farmer, so the arm, cap and head are in front of it, and it looks smaller; aiming down it is
  // nearer. Facing you the string only comes back a little, or it would cross the face.
  var READY = 0, FULL = 1, LET_GO = 2;
  // (the owner's 30-degree archers, 12 Nov 2026, measured on the imported sheets: the boy's and the girl's fists are not in
  // quite the same places any more, so each has its own; a look's bow sheet is cut onto its farmer's, so it takes theirs)
  F.ARCHER_GRIPS = {
    boy: { down: [[185, 252], [187, 257], [189, 257]], up: [[91, 55], [87, 55], [89, 54]], side: [[48, 203], [46, 200], [46, 205]] },
    girl: { down: [[171, 252], [176, 255], [176, 256]], up: [[89, 59], [85, 60], [82, 60]], side: [[46, 192], [43, 192], [44, 193]] },
  };
  var SIDE_GRIP = F.ARCHER_GRIPS.boy.side;
  var POSE = {
    down: { row: 0, grip: F.ARCHER_GRIPS.boy.down, back: 14, scale: 1.4 },
    up: { row: 1, grip: F.ARCHER_GRIPS.boy.up, back: 40, scale: 1.3, behind: true },
    left: { row: 2, grip: SIDE_GRIP, back: 84 },
    right: { row: 2, grip: SIDE_GRIP, back: 84, flip: true },
  };
  // the fist holding the bow in this archer sheet (archer, archer_girl, look_<cos>_<boy|girl>_archer), its direction and stage
  F.archerGrip = function (key, dir, stage) {
    var g = F.ARCHER_GRIPS[/girl/.test(key || '') ? 'girl' : 'boy'];
    return g[dir === 'left' || dir === 'right' ? 'side' : dir][stage];
  };
  var FIST = 30; // half the square around the fist that goes over the bow
  var RECOIL = 8; // world units you rock back when you let go
  var archerKey = function () { // (in your look, when you wear one: 19zj-looks.js)
    var s = F.session.state;
    return F.archerKeyFor ? F.archerKeyFor(s.look, L.wornLook(s)) : s.look === 'girl' ? 'archer_girl' : 'archer';
  };

  // In the 128x128 bow icons (all four levels line up): where the string ties on at each end, the grip, and the way the
  // bow faces. The icons have a string drawn on, pulled back a little: it is taken off so ours can move.
  var ICON = { top: [113, 26], low: [33, 112], knot: [89, 92], grip: [58, 54], facing: -137.4 };

  var bowTexture = function (scene, frame) {
    var key = 'fx-bow-' + frame;
    if (scene.textures.exists(key)) return key;
    F.ensureTexture(scene, 'items');
    var f = scene.textures.getFrame('items', frame), c = scene.textures.createCanvas(key, 128, 128), g = c.getContext();
    var img = F.images.items, k = (img.naturalWidth || img.width) / f.source.width; // (a small phone may have a smaller sheet)
    g.drawImage(img, f.cutX * k, f.cutY * k, 128 * k, 128 * k, 0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(ICON.top[0], ICON.top[1]);
    g.lineTo(ICON.knot[0], ICON.knot[1]);
    g.lineTo(ICON.low[0], ICON.low[1]);
    g.closePath();
    g.fill();
    g.stroke();
    c.refresh();
    return key;
  };

  // The same bow, turned to `ang`: an image with its grip at (x, y).
  var bowImage = function (scene, frame, x, y, ang, scale) {
    return scene.add.image(x, y, bowTexture(scene, frame)).setOrigin(ICON.grip[0] / 128, ICON.grip[1] / 128).setScale(scale || BOW_SCALE)
      .setRotation(ang - Phaser.Math.DegToRad(ICON.facing));
  };

  // A point on the bow's icon, in the world.
  var onBow = function (img, pt) {
    var dx = (pt[0] - ICON.grip[0]) * img.scaleX, dy = (pt[1] - ICON.grip[1]) * img.scaleX, c = Math.cos(img.rotation), s = Math.sin(img.rotation);
    return { x: img.x + dx * c - dy * s, y: img.y + dx * s + dy * c };
  };

  // The bow turned to what you aim at, the string, the arrow on it, and the farmer's pose.
  var pose = function (w, shot) {
    var p = shot.who || w.player, at = POSE[shot.dir || w.dir], side = at.flip ? -1 : 1, grip = F.archerGrip(shot.body && shot.body.texture && shot.body.texture.key, shot.dir || w.dir, shot.stage);
    var bx = p.x - Math.cos(shot.ang) * shot.recoil, by = p.y - Math.sin(shot.ang) * shot.recoil;
    var x = bx + (grip[0] - 144) * side, y = by + grip[1] - 192;
    var a = shot.target;
    if (a && a.hp > 0 && a.img.active) shot.ang = Math.atan2((a.y - 0.3 * a.def.w * T) - y, a.x - x);
    var cx = Math.cos(shot.ang), cy = Math.sin(shot.ang), bow = shot.bow;
    bow.setPosition(x, y).setRotation(shot.ang - Phaser.Math.DegToRad(ICON.facing));
    var top = onBow(bow, ICON.top), low = onBow(bow, ICON.low);
    if (shot.halo) shot.halo.setPosition((top.x + low.x) / 2, (top.y + low.y) / 2); // (the Moon Bow's glow, round the bow)
    var nx = (top.x + low.x) / 2 - cx * shot.pull * at.back, ny = (top.y + low.y) / 2 - cy * shot.pull * at.back;
    shot.nock = { x: nx, y: ny };
    shot.string.clear();
    [[9, 0x3b2312, 0.8], [5, 0xf6ecd2, 1]].forEach(function (st) {
      shot.string.lineStyle(st[0], st[1], st[2]);
      shot.string.beginPath();
      shot.string.moveTo(top.x, top.y);
      shot.string.lineTo(nx, ny);
      shot.string.lineTo(low.x, low.y);
      shot.string.strokePath();
    });
    if (shot.arrow) shot.arrow.setPosition(nx, ny).setRotation(shot.ang);
    var frame = at.row * 3 + shot.stage;
    shot.body.setPosition(bx, by).setFrame(frame).setFlipX(!!at.flip);
    if (shot.fist) shot.fist.setPosition(bx, by).setFrame(frame).setFlipX(!!at.flip).setCrop(grip[0] - FIST, grip[1] - FIST, FIST * 2, FIST * 2);
  };

  // What a shot put on the map: the archer, the bow, the string, the arrow on it and the fist over the grip.
  var clear = function (shot) {
    [shot.body, shot.bow, shot.string, shot.arrow, shot.fist, shot.halo].forEach(function (o) { if (o) o.destroy(); });
    shot.arrow = null;
    shot.halo = null;
  };
  // Haliya's Moon Bow (00-zzzzzzzzzzzz-moon.js): a soft white moon glow round the bow while it is drawn, that breathes;
  // friends see it too (their shot says the bow's level). Nothing for any other bow.
  var moonHalo = function (w, shot, level) {
    if (!(L.moonShot && L.moonShot(level))) return;
    shot.halo = w.add.circle(shot.bow.x, shot.bow.y, 1.1 * T, C.MOON_BOW.shine, 0.32).setDepth(shot.bow.depth - 0.0005).setBlendMode(Phaser.BlendModes.ADD);
    w.tweens.add({ targets: shot.halo, alpha: 0.5, scale: 1.12, duration: 160, yoyo: true, repeat: 2 });
  };

  var loose = function (w, shot) {
    var s = w.state, cx = Math.cos(shot.ang), cy = Math.sin(shot.ang), x = shot.nock.x + cx * ARROW_W / 2, y = shot.nock.y + cy * ARROW_W / 2;
    var range = shot.remote ? shot.range : L.bowRange(s) * T;
    shot.arrow.destroy();
    shot.arrow = null;
    shot.stage = LET_GO;
    w.wildArrow(x, y, shot.ang, range, !!shot.remote, shot.remote ? shot.level : L.bowLevel(s));
    if (!shot.remote) w.tellArrow({ x: Math.round(x), y: Math.round(y), a: shot.ang, l: range, b: L.bowLevel(s) });
    if (shot.remote) w.remoteSound(shot.r, 'bowshot');
    else sfx('bowshot');
    w.tweens.addCounter({
      from: 1, to: 0, duration: AFTER_MS,
      onUpdate: function (tw) {
        var v = tw.getValue();
        shot.pull = -0.2 * Math.sin(v * Math.PI * 5) * v; // the string shivers
        shot.recoil = RECOIL * Math.sin(v * Math.PI);
        pose(w, shot);
      },
      onComplete: function () {
        clear(shot);
        if (shot.remote) return shot.done();
        w.player.setVisible(true);
        w.shot = null;
        w.idle();
      },
    });
  };

  // Keeps the sheet ready for the first shot.
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (this.wild && L.hasBow(this.state)) F.ensureTexture(this, archerKey());
  };

  P.shoot = function () {
    if (this.shot) return;
    var self = this, s = this.state, r = L.shoot(s);
    if (r === 'arrows') return F.ui.toast('No arrows left. Kanor sells them at his Lodge.');
    if (r === 'tired') return F.ui.toast('Too tired to draw the bow. Eat something first.');
    var target = this.wildTarget(), f = this.feet(), d, p = this.player;
    if (target) { // you turn to it
      var tx = target.x - f.x, ty = target.y - f.y;
      this.dir = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
    }
    d = this.dirVec();
    var at = POSE[this.dir], depth = p.depth + (at.behind ? -0.001 : 0.001);
    p.anims.stop();
    var shot = this.shot = {
      target: target, ang: Math.atan2(d[1], d[0]), pull: 0, recoil: 0, nock: null, stage: READY,
      body: this.add.image(p.x, p.y, F.ensureTexture(this, archerKey()), 0).setDepth(p.depth),
      bow: bowImage(this, L.iconOf(s, 'bow'), p.x, p.y, 0, at.scale).setDepth(depth),
      string: this.add.graphics().setDepth(depth + 0.0002),
      arrow: this.add.image(p.x, p.y, F.ensureTexture(this, 'props/arrow_fly')).setOrigin(0, 0.5).setDisplaySize(ARROW_W, ARROW_H).setDepth(depth + 0.0001),
      fist: at.behind ? null : this.add.image(p.x, p.y, archerKey(), 0).setDepth(depth + 0.0003),
    };
    p.setVisible(false);
    this.acting = READY_MS + DRAW_MS + AFTER_MS;
    shot.pull = 0.1;
    moonHalo(this, shot, L.bowLevel(s));
    pose(this, shot);
    sfx('bowdraw');
    this.time.delayedCall(READY_MS, function () {
      if (self.shot !== shot) return;
      shot.stage = FULL;
      self.tweens.addCounter({
        from: 0.72, to: 1, duration: DRAW_MS, ease: 'Quad.out',
        onUpdate: function (tw) { shot.pull = tw.getValue(); pose(self, shot); },
        onComplete: function () { loose(self, shot); },
      });
    });
    F.bus.emit('hud');
    this.changed();
  };

  // Your arrow in flight, for the friends here to see (a hunting place's public room: the game server, 19zzzzzzzzz-gameserver.js).
  P.tellArrow = function (m) { if (Object.keys(this.remotes || {}).length) O.send('ar', m); };

  // A friend's shot (owner, 3 Nov 2026: what the other player does should show, not just its result). Heard when their arrow
  // leaves (19v-wild.js 'ar'), their farmer plays the same shot a little quicker: bow up, a pull to the cheek, and the arrow
  // goes from their string. r = their farmer (19h-online.js); x, y = where their arrow started; l = its range.
  P.remoteShot = function (r, x, y, ang, l, level) {
    var self = this, p = r.spr;
    if (!p || !p.active || r.horse || r.shot) return false;
    // in a look whose bow picture is still coming: just the arrow and the bow's flash (the caller), not plain clothes
    // for a moment (one that can't come at all: the plain archer, as before)
    if (r.cs && F.lookReady && !F.lookReady(r.cs, r.look, true) && F.lookPending && F.lookPending(r.cs, r.look, true)) return false;
    var c = Math.cos(ang), sn = Math.sin(ang), dir = Math.abs(c) > Math.abs(sn) ? (c > 0 ? 'right' : 'left') : (sn > 0 ? 'down' : 'up');
    var at = POSE[dir], depth = p.depth + (at.behind ? -0.001 : 0.001), key = F.ensureTexture(this, F.archerKeyFor ? F.archerKeyFor(r.look, r.cs) : r.look === 'girl' ? 'archer_girl' : 'archer');
    var icon = L.bowIcon ? L.bowIcon(level) : C.ICON[level > 0 ? 'bow_' + Math.min(3, Math.floor(level)) : 'bow'];
    var shot = r.shot = {
      remote: true, r: r, who: p, dir: dir, target: null, ang: ang, range: l, level: level, pull: 0.1, recoil: 0, nock: null, stage: READY,
      body: this.add.image(p.x, p.y, key, 0).setDepth(p.depth),
      bow: bowImage(this, icon, p.x, p.y, 0, at.scale).setDepth(depth),
      string: this.add.graphics().setDepth(depth + 0.0002),
      arrow: this.add.image(p.x, p.y, F.ensureTexture(this, 'props/arrow_fly')).setOrigin(0, 0.5).setDisplaySize(ARROW_W, ARROW_H).setDepth(depth + 0.0001),
      fist: at.behind ? null : this.add.image(p.x, p.y, key, 0).setDepth(depth + 0.0003),
      done: function () { if (r.shot === shot) r.shot = null; r.useUntil = 0; if (p.active) p.setVisible(true); },
    };
    var quick = { ready: 60, draw: 100 };
    r.useUntil = this.time.now + quick.ready + quick.draw + AFTER_MS + 40;
    r.anim = null;
    p.anims.stop();
    p.setVisible(false);
    moonHalo(this, shot, level);
    pose(this, shot);
    this.remoteSound(r, 'bowdraw');
    this.time.delayedCall(quick.ready, function () {
      if (r.shot !== shot) return;
      // their farmer was made again (a new look) or left before the bow came up: the shot goes with it. It used to stay on
      // the map for good, a bow with an arrow on it: a rarer road to what players saw, 6 Nov 2026 ("bow and arrows lang
      // nakikita na parang lumulutang"; the usual one is in 19h-online.js create).
      if (!p.active) { clear(shot); return shot.done(); }
      shot.stage = FULL;
      self.tweens.addCounter({
        from: 0.72, to: 1, duration: quick.draw, ease: 'Quad.out',
        onUpdate: function (tw) { if (r.shot === shot) { shot.pull = tw.getValue(); pose(self, shot); } },
        onComplete: function () { if (r.shot === shot) loose(self, shot); },
      });
    });
    void x; void y;
    return true;
  };

  // A friend's shot when their farmer can't play it (on a horse, already shooting): their bow, there for a moment where the arrow starts.
  P.bowFlash = function (x, y, ang, level) {
    var icon = L.bowIcon ? L.bowIcon(level) : C.ICON[level > 0 ? 'bow_' + Math.min(3, Math.floor(level)) : 'bow'];
    var img = bowImage(this, icon, x - Math.cos(ang) * ARROW_W * 0.5, y - Math.sin(ang) * ARROW_W * 0.5, ang).setDepth(F.WorldScene.DEPTH.fx);
    this.tweens.add({ targets: img, alpha: 0, delay: 120, duration: 200, onComplete: function () { img.destroy(); } });
    if (L.moonShot && L.moonShot(level)) {
      var halo = this.add.circle(img.x, img.y, 1.1 * T, C.MOON_BOW.shine, 0.45).setDepth(img.depth - 0.0005).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: halo, alpha: 0, scale: 1.4, delay: 80, duration: 300, onComplete: function () { halo.destroy(); } });
    }
  };
})(window.Farm = window.Farm || {});
