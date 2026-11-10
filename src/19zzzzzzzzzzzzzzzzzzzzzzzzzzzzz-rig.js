// The farmer boy's rig for the Rifle (owner, 11 Nov 2026: "the professional way, light and fast"): while he shoots, he
// is built from parts (C.RIG_BOY from tools/art/rig-import.js; the picture assets/rig_boy is a pack) and moved: the body
// turns a little towards the animal, both hands stay on the rifle (a two-bone reach for each arm, L.rigIK), the cheek
// comes down to the stock with the aiming face, and the shot kicks the shoulder and head back and the muzzle up before
// it settles. Walking keeps the walking sheet: the rig fades in over the standing frame at the same size and place and
// fades back out. Only your own farmer, the boy in his own clothes, with the Rifle (a girl, a look, the other weapons and
// friends' farmers keep the pose sheets: 19zzzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons.js). F.rigOff = true: the old way.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var R = C.RIG;
  var FEET = 178, TALL = 348; // the walking sheet: the boots 178 below the sprite's middle, cap to boots 348
  var RLEN = 0.85 * T; // the rifle, butt to muzzle, as in the hands of the pose sheets
  // points on the rifle's picture (fractions of its width and height): the butt, the hand at the grip, the hand under the
  // barrel, the muzzle (the owner's held_rifle; the drawn stand-in's)
  var RIFLE = { art: { butt: [0.04, 0.58], rear: [0.3, 0.56], fore: [0.645, 0.42], muzzle: [0.965, 0.3] },
    drawn: { butt: [0.03, 0.55], rear: [0.35, 0.53], fore: [0.74, 0.47], muzzle: [0.97, 0.47] } };
  var VIEW = { down: 'front', up: 'back', left: 'side', right: 'side' };
  var SUFFIX = { front: 'front', back: 'back', side: 'left' };

  // Can this shot be rigged? (your boy in his own clothes, the Rifle, the parts here)
  F.rigFor = function (w, k) {
    var s = w.state;
    return k === 'rifle' && !F.rigOff && !!C.RIG_BOY && !!(F.images && F.images.rig_boy) && s.look !== 'girl' && !(L.wornLook && L.wornLook(s));
  };
  var askArt = function () { if (!(F.images && F.images.rig_boy) && F.packedFile && F.packedFile('rig_boy') && F.needImage) F.needImage('rig_boy'); };
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (this.wild && L.hasWeapon(this.state, 'rifle')) askArt();
  };
  var texture = function (w) {
    var tex = w.textures, key = F.ensureTexture(w, 'rig_boy'), t = tex.get(key);
    if (!t.rigFrames) {
      Object.keys(C.RIG_BOY.parts).forEach(function (n) { var f = C.RIG_BOY.parts[n].f; t.add('p:' + n, 0, f[0], f[1], f[2], f[3]); });
      t.rigFrames = true;
    }
    return key;
  };
  var part = function (n) { return C.RIG_BOY.parts[n]; };
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1]]; };
  var rot = function (v, r) { var c = Math.cos(r), s = Math.sin(r); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  var ang = function (v) { return Math.atan2(v[1], v[0]); };

  // ---------- building it ----------
  P.rigStart = function (sh) {
    var w = this, p = this.player, view = VIEW[sh.dir], key = texture(this), k = TALL / C.RIG_BOY.tall;
    // each part turns about its joint: the head on its neck, the body and legs at the hips, an arm at the shoulder, the
    // forearm at the elbow, a hand at the wrist
    var JOINT = { head: 'neck', body: 'hip', legs: 'hip', arm_upper: 'shoulder', arm_fore: 'elbow', hand: 'wrist' };
    var img = function (n) {
      var pt = part(n), o = pt.pv[JOINT[n] || JOINT[n.split('_')[0]]];
      return w.add.image(0, 0, key, 'p:' + n).setOrigin(o[0] / pt.f[2], o[1] / pt.f[3]).setScale(k);
    };
    var t = F.weaponTexture(this, 'rifle', sh.lv);
    // the arm's reach (shoulder to the grip of the hand), and the rifle as long as his arms can hold it: the hand under the
    // barrel must reach it (cartoon arms are short), never longer than in the pose sheets
    var ua = part('arm_upper').pv, fa = part('arm_fore').pv, hg = part('hand_grip').pv;
    var reach = (Math.hypot(ua.elbow[0] - ua.shoulder[0], ua.elbow[1] - ua.shoulder[1]) + Math.hypot(fa.wrist[0] - fa.elbow[0], fa.wrist[1] - fa.elbow[1]) +
      Math.hypot(hg.grip[0] - hg.wrist[0], hg.grip[1] - hg.wrist[1])) * k;
    var rig = { view: view, k: k, reach: reach, rlen: Math.max(0.5 * T, Math.min(RLEN, reach * 1.35)), t0: this.time.now, fired: 0, stop: 0, t: t, pts: t.art ? RIFLE.art : RIFLE.drawn, lastAng: sh.ang,
      legs: img('legs_' + SUFFIX[view]), body: img('body_' + SUFFIX[view]), head: img('head_' + SUFFIX[view]),
      aimHead: view === 'side' ? img('head_aim') : null,
      ua: [img('arm_upper'), img('arm_upper')], fa: [img('arm_fore'), img('arm_fore')], hand: [img('hand_grip'), img('hand_grip')],
      rifle: this.add.image(0, 0, t.key) };
    if (rig.aimHead) rig.aimHead.setVisible(false);
    // the order things are drawn in, by the way he faces (0: the hand at the grip, the near arm; 1: under the barrel)
    var L0 = [rig.ua[0], rig.fa[0], rig.hand[0]], L1 = [rig.ua[1], rig.fa[1], rig.hand[1]], body = [rig.legs, rig.body, rig.head].concat(rig.aimHead ? [rig.aimHead] : []);
    var order = view === 'side' ? L1.concat(body, [rig.rifle], L0) // (the far arm behind him, the near arm in front)
      : view === 'front' ? body.concat([rig.ua[0], rig.ua[1], rig.fa[0], rig.fa[1], rig.hand[1], rig.rifle, rig.hand[0]]) // (both arms reach out to you)
      : [rig.rifle, rig.hand[0], rig.hand[1], rig.fa[0], rig.fa[1], rig.ua[0], rig.ua[1]].concat(body); // (facing away: the rifle behind his head)
    rig.cont = this.add.container(p.x, p.y, order).setDepth(p.depth).setAlpha(0);
    if (sh.dir === 'right') rig.cont.scaleX = -1;
    sh.rig = rig;
    this.rigPose(sh);
    // in over the walking frame, the sheet out (the same size and place: no jump)
    this.tweens.add({ targets: rig.cont, alpha: 1, duration: R.fadeMs });
    this.tweens.add({ targets: p, alpha: 0, duration: R.fadeMs });
    return rig;
  };

  // ---------- each frame ----------
  P.rigPose = function (sh) {
    var rig = sh.rig, p = this.player, now = this.time.now, k = rig.k, view = rig.view, side = view === 'side';
    if (!rig || !rig.cont.active) return;
    var t = now - rig.t0 - rig.stop, a = sh.target;
    // the aim follows the animal until the shot, then stays
    if (!rig.fired && a && a.hp > 0 && a.img.active) sh.ang = Math.atan2((a.y - 0.3 * a.def.w * T) - (p.y - 0.25 * T), a.x - p.x);
    var aim = L.rigAim(sh.dir, sh.ang), up = L.rigRaise(t), kick = rig.fired ? L.rigKick(now - rig.fired - rig.stop) : 0;
    var breathe = rig.fired ? 0 : Math.sin(t / 330) * 1.4 * up;
    // the body turns a little with the aim, and rocks back with the kick
    var lean = side ? aim.dev * R.lean + 0.07 * kick : (view === 'front' ? -1 : 1) * aim.dev * 0.12;
    var lg = part('legs_' + SUFFIX[view]), bd = part('body_' + SUFFIX[view]), hip = [0, FEET - (lg.f[3] - lg.pv.hip[1]) * k];
    var onBody = function (pv) { var v = rot([(pv[0] - bd.pv.hip[0]) * k, (pv[1] - bd.pv.hip[1]) * k], lean); return [hip[0] + v[0], hip[1] + v[1] + breathe]; };
    rig.legs.setPosition(hip[0], hip[1]);
    rig.body.setPosition(hip[0], hip[1] + breathe * 0.5).setRotation(lean);
    var neck = onBody(bd.pv.neck), aiming = side && up > 0.6;
    var headRot = lean * 0.6 + (side ? -0.07 * up + 0.12 * kick : 0);
    [rig.head, rig.aimHead].forEach(function (h) { if (h) h.setPosition(neck[0] - (side ? 3 * up : 0), neck[1] + (side ? 3 * up : 0)).setRotation(headRot); }); // (side on: the cheek down to the stock)
    rig.head.setVisible(!aiming);
    if (rig.aimHead) rig.aimHead.setVisible(aiming);
    // the shoulders: side on, the near one and the far one a little behind and up
    var sL, sR, near, far;
    if (side) { var s0 = onBody(bd.pv.shoulder); near = [s0[0] - 4, s0[1] + 2]; far = [s0[0] - 14, s0[1] - 3]; } // (the far shoulder turned forward to aim)
    else { sL = onBody(bd.pv.shoulderL); sR = onBody(bd.pv.shoulderR); near = view === 'front' ? sL : sR; far = view === 'front' ? sR : sL; } // (his right shoulder: on your left facing you)
    // the rifle: its butt at the near shoulder, low at first, then up along the aim; the kick pushes it back and the muzzle up
    var tw = rig.t.w, th = rig.t.h, pts = rig.pts, flip = Math.cos(aim.ang) < 0, fy = function (q) { return flip ? 1 - q[1] : q[1]; };
    var lowAng = side ? aim.ang - 0.9 : view === 'front' ? aim.ang + 0.7 : aim.ang - 0.7;
    // (facing away the rifle leans a little out to his right shoulder, behind his head)
    var ra = lowAng + (aim.ang - lowAng) * up + (side ? 0.22 : 0) * kick + (view === 'back' ? 0.12 * up : 0);
    var RL = rig.rlen, len = RL * (side ? 1 : view === 'front' ? 0.42 - 0.08 * kick : 0.5);
    var sc = RL / ((pts.muzzle[0] - pts.butt[0]) * tw);
    // the butt against the shoulder, under the cheek (side on); facing you, at his chest; facing away, behind his head
    var at = side ? [near[0] - 0.1 * rig.reach, near[1] + 6] : view === 'front' ? [near[0] + 14, near[1] + 10] : [(near[0] + far[0]) / 2 + 10, near[1] + 2];
    var back = [-Math.cos(aim.ang) * 12 * kick, -Math.sin(aim.ang) * 12 * kick - (side ? 0 : 8 * kick)];
    var butt = [at[0] + back[0], at[1] + (1 - up) * 38 + back[1]];
    var sx = sc * len / RL, axis = Math.atan2((fy(pts.muzzle) - fy(pts.butt)) * th * sc, (pts.muzzle[0] - pts.butt[0]) * tw * sx);
    rig.rifle.setOrigin(pts.butt[0], fy(pts.butt)).setFlipY(flip).setScale(sx, sc).setRotation(ra - axis).setPosition(butt[0], butt[1]); // (butt to muzzle along the aim)
    var onRifle = function (q) { var v = rot([(q[0] - pts.butt[0]) * tw * sx, (fy(q) - fy(pts.butt)) * th * sc], rig.rifle.rotation); return [butt[0] + v[0], butt[1] + v[1]]; };
    rig.muzzle = onRifle(pts.muzzle);
    // the arms: each hand on its place on the rifle
    var ua = part('arm_upper'), fa = part('arm_fore'), hg = part('hand_grip');
    var l1 = Math.hypot.apply(null, sub(ua.pv.elbow, ua.pv.shoulder)) * k, l2 = Math.hypot.apply(null, sub(fa.pv.wrist, fa.pv.elbow)) * k;
    var gv = [(hg.pv.grip[0] - hg.pv.wrist[0]) * k, (hg.pv.grip[1] - hg.pv.wrist[1]) * k], gl = Math.hypot(gv[0], gv[1]), gpart = ang(gv);
    var arm = function (i, S, G) {
      var hd = ang(sub(G, S)), ik = null;
      for (var n = 0; n < 4; n++) { // (the hand carries on from the forearm: a few rounds and it settles on the grip)
        var Wt = [G[0] - Math.cos(hd) * gl, G[1] - Math.sin(hd) * gl];
        ik = L.rigIK(S[0], S[1], Wt[0], Wt[1], l1, l2, L.rigBend(side ? 'side' : 'ahead', S[0], S[1], Wt[0], Wt[1], l1, l2));
        hd = Math.atan2(ik.wy - ik.ey, ik.wx - ik.ex);
      }
      rig.ua[i].setPosition(S[0], S[1]).setRotation(Math.atan2(ik.ey - S[1], ik.ex - S[0]) - ang(sub(ua.pv.elbow, ua.pv.shoulder)));
      rig.fa[i].setPosition(ik.ex, ik.ey).setRotation(hd - ang(sub(fa.pv.wrist, fa.pv.elbow)));
      rig.hand[i].setPosition(ik.wx, ik.wy).setRotation(hd - gpart);
      return [ik.wx + Math.cos(hd) * gl, ik.wy + Math.sin(hd) * gl]; // (where the grip ended up)
    };
    rig.handAt = [arm(0, near, onRifle(pts.rear)), arm(1, far, onRifle(pts.fore))];
    rig.gripAt = [onRifle(pts.rear), onRifle(pts.fore)];
    rig.cont.setPosition(p.x, p.y).setDepth(p.depth);
    // for the shot: where it leaves (the world)
    var m = rig.cont.scaleX;
    sh.grip = { x: p.x + m * rig.gripAt[0][0], y: p.y + rig.gripAt[0][1] };
    sh.rigTip = { x: p.x + m * rig.muzzle[0], y: p.y + rig.muzzle[1] };
    // (the shot flies along the aim, the rig's limits kept)
    if (!rig.fired) sh.rigAng = m < 0 ? Math.PI - aim.ang : aim.ang;
  };

  // The shot: a flash at the muzzle, smoke, the camera shakes a little, the kick begins.
  P.rigFire = function (sh) {
    var rig = sh.rig, tip = sh.rigTip;
    if (!rig) return;
    rig.fired = this.time.now;
    this.cameras.main.shake(110, 0.0022);
    var moon = !!L.weaponMoon('rifle', sh.lv), c = moon ? F.WPN_GLOW : 0xfff2b0;
    var depth = rig.view === 'back' ? rig.cont.depth - 0.002 : DEPTH.fx + 0.03; // (facing away: the flash behind his head)
    var flash = this.add.circle(tip.x, tip.y, 0.13 * T, c, 0.95).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    var rays = [0, 1].map(function (i) { return this.add.rectangle(tip.x, tip.y, 0.5 * T, 0.05 * T, c, 0.9).setRotation(sh.ang + i * Math.PI / 2).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD); }, this);
    this.tweens.add({ targets: [flash].concat(rays), alpha: 0, scale: 1.6, duration: 80, onComplete: function () { flash.destroy(); rays.forEach(function (r) { r.destroy(); }); } });
  };
  // a hit: the kick holds a moment longer (the hit-stop)
  P.rigHitStop = function (sh) { if (sh && sh.rig) sh.rig.stop += 40; };
  // back to the walking sheet: the rig fades out over the standing frame
  P.rigEnd = function (sh) {
    var rig = sh.rig, p = this.player;
    if (!rig) return;
    sh.rig = null;
    if (p && p.active) { p.setVisible(true); this.tweens.add({ targets: p, alpha: 1, duration: R.fadeMs }); }
    this.tweens.add({ targets: rig.cont, alpha: 0, duration: R.fadeMs, onComplete: function () { rig.cont.destroy(); } });
  };
  // (a shot cut short, a new map: the farmer as he was)
  var travel = P.travel;
  P.travel = function () { if (this.player) this.player.setAlpha(1); return travel.apply(this, arguments); };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    var sh = this.wpnShot;
    if (sh && sh.rig) this.rigPose(sh);
  };

  // The dog never stands on the farmer while he shoots: it keeps a little to the side (behind him, side on).
  P.dogAside = function (f) {
    if (!(this.wpnShot || this.shot)) return null;
    var d = this.dir;
    if (d === 'left' || d === 'right') return { x: f.x + (d === 'left' ? 1 : -1) * 0.95 * T, y: f.y + 0.15 * T };
    return { x: f.x - 1.05 * T, y: f.y + 0.1 * T };
  };
})(window.Farm = window.Farm || {});
