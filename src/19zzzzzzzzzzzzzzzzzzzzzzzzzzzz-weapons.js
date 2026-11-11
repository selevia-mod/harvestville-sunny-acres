// The Rifle, the Javelin and the Boomerang in the world (content 00-zzzzzzzzzzzzzzzzzzz-weapons.js, rules
// 01-logicZZZZZZZZZZZZZZ-weapons.js, pictures 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons-art.js). Hold one in a hunting ground
// where they work (L.weaponsWork): the ring marks the animal in its reach and Shoot (the Rifle) or Throw turns you to it.
//   the Rifle: you raise it, a pop and a puff, a bright round with a streak, a kick back; 1.4 s to the next.
//   the Javelin: thrown in an arc (its shadow on the ground), it stands in what it hits; 0.35 s to the next.
//   the Boomerang: spins out to its reach and back to your hand, hitting the first animal on its way; 1.0 s.
// The Moon ones glow; the Moon Rifle's shot goes through the first animal into the one behind (like the Moon Bow), and
// the Moon Javelin and Moon Boomerang hit 2 animals standing side by side. A hit is a Bow's hit with the weapon's damage
// (s.wpnHit while P.wildStruck runs), so friends, the game server and a Strong shot count it the same way.
// Friends see the shot (your 'ar', the weapon in its range's low bits: L.shotRange). A chip over the action button shows
// the ammo, or the boomerang's throws left. The Armory panel is F.ui.openArmory (Manila's Armory will open it); for now
// only window.gameHost.devWeapons shows a way to it, in Kanor's Lodge. The boomerang is also fixed at Bram's Forge.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var W = C.WEAPONS;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var GREEN_BTN = 0x5fa84a, GREY_BTN = 0xa08a68, BLUE_BTN = 0x4a90c9;
  var cheap = function () { return !!(F.cheapPhone && F.cheapPhone()); };
  var dev = function () { return !!(F.devWeapons || (window.gameHost && window.gameHost.devWeapons)); };
  var commas = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  // how a shot goes: when it leaves (ms after you start), and how fast (tiles a second)
  var SHOT = {
    rifle: { at: 260, speed: 30, stage: 1 },
    javelin: { at: 140, speed: 14, stage: 0 },
    boomerang: { at: 150, trip: 820, stage: 0 }, // trip: ms out and back
  };
  // The archer poses (the hands empty: tools/art/archer-import.js) and the fist that holds the weapon in each, as
  // 19w-bow.js has them (rows facing you, away, left; columns ready, full, let go).
  var SIDE_GRIP = F.ARCHER_GRIPS.boy.side; // (each archer sheet's own: F.archerGrip, 19w-bow.js)
  var POSE = {
    down: { row: 0, grip: F.ARCHER_GRIPS.boy.down },
    up: { row: 1, grip: F.ARCHER_GRIPS.boy.up, behind: true },
    left: { row: 2, grip: SIDE_GRIP },
    right: { row: 2, grip: SIDE_GRIP, flip: true },
  };
  var LET_GO = 2;
  var HELD_LEN = { rifle: 0.85, javelin: 1.2, boomerang: 0.55 }; // tiles
  // (the owner's new boomerang, wpn_boom, flies at the size it has in the throw pictures)
  var lenOf = function (k) { return (k === 'boomerang' && F.images && F.images.wpn_boom ? 0.42 : HELD_LEN[k]) * T; };
  // seen along its length (aiming up or down the screen) a long weapon looks shorter
  var along = function (k, ang) { return k === 'boomerang' ? 1 : 1 - 0.35 * Math.abs(Math.sin(ang)); };

  // ---------- holding one ----------
  var create = P.create;
  P.create = function () {
    this.wpnShots = [];
    this.wpnShot = null;
    this.wpnNext = 0;
    create.call(this);
    if (this.wild && C.WEAPON_KINDS.some(function (k) { return L.hasWeapon(F.session.state, k); }) && F.askWeaponArt) F.askWeaponArt();
  };
  var works = function (w) { return !!w.wild && L.weaponsWork(w.mapKey); };
  var whyNot = function (k) { return 'The ' + W[k].name + ' works only in the hunting places.'; };

  var resolve = P.resolve;
  P.resolve = function () {
    var self = this, s = this.state, k = L.heldWeapon(s), r0 = resolve.call(this);
    if (!k) return r0;
    if (r0 && !r0.disabled) return r0; // (someone or something in front: talking to Kanor, a chest...)
    var icon = L.iconOf(s, k);
    if (!this.wild) return r0; // (out of the hunting places it does nothing: a raid on the farm keeps its own button)
    if (!works(this)) return { label: W[k].verb, icon: icon, disabled: true, why: whyNot(k) };
    return { label: W[k].verb, icon: icon, run: function () { self.fireWeapon(); } };
  };

  // The nearest animal ahead of you in the weapon's reach (as the Bow's: within 60 degrees), or null.
  var wildTarget = P.wildTarget;
  P.wildTarget = function (reach) {
    var s = this.state, k = L.heldWeapon(s);
    if (!k && reach == null) return wildTarget.call(this);
    var f = this.feet(), d = this.dirVec(), range = (reach != null ? reach : L.weaponRange(k, L.weaponLevel(s, k))) * T, best = null, bd = range;
    (this.wild ? this.wild.animals : []).forEach(function (a) {
      var ax = a.x - f.x, ay = (a.y - 0.3 * T) - (f.y - 0.5 * T), dist = Math.hypot(ax, ay);
      if (dist > range || dist < 1 || a.def.tameOnly) return;
      var cos = (ax * d[0] + ay * d[1]) / dist;
      if (cos < 0.5 || dist >= bd) return;
      bd = dist;
      best = a;
    });
    return best;
  };
  // the ring under the animal you would hit, and the arrow at the edge towards the nearest one (as with the Bow)
  var updateAim = P.updateAim;
  P.updateAim = function (time) {
    updateAim.call(this, time);
    var w0 = this.wild, k = L.heldWeapon(this.state);
    if (!k || !works(this)) return;
    var a = this.wildTarget(), ring = w0.ring, hint = w0.hint;
    ring.setVisible(!!a);
    if (a) {
      var rw = (0.55 + a.def.w * 0.55) * a.size * T * (1 + Math.sin(time / 160) * 0.05);
      ring.setPosition(a.x, a.y - 0.08 * T).setDisplaySize(rw, rw * 0.46);
    }
    var f = this.feet(), view = this.cameras.main.worldView, near = null, bd = Infinity;
    w0.animals.forEach(function (x) { var dd = Math.hypot(x.x - f.x, x.y - f.y); if (dd < bd) { bd = dd; near = x; } });
    var show = !!near && !view.contains(near.x, near.y - 0.3 * T);
    hint.setVisible(show);
    if (show) {
      var ang = Math.atan2(near.y - f.y, near.x - f.x), r = (1.5 + Math.sin(time / 220) * 0.12) * T;
      hint.setPosition(f.x + Math.cos(ang) * r, f.y - 0.5 * T + Math.sin(ang) * r).setRotation(ang + Math.PI / 2);
    }
  };

  // ---------- your shot ----------
  // The weapon in the farmer's hand, turned to `ang`: its grip at (x, y).
  var heldImage = function (w, k, lv, x, y, ang) {
    var t = F.weaponTexture(w, k, lv), len = lenOf(k), sc = len / t.w;
    return w.add.image(x, y, t.key).setOrigin(t.grip, 0.5).setScale(sc * along(k, ang), sc).setRotation(k === 'boomerang' ? ang - Math.PI / 2 : ang)
      .setFlipY(k !== 'boomerang' && Math.cos(ang) < 0); // (pointing left: the right way up)
  };
  var glowAt = function (w, x, y, r, depth) {
    return w.add.circle(x, y, r, F.WPN_GLOW, 0.2).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  };
  // where the fist is in this pose, in the world
  // (the owner's pose sheets have their own hands: F.WPN_GRIPS; the archer's stand in with the Bow's)
  // (the weapon drawn in the hands, wpn_hold_*: its hand and tip, F.WPN_HOLD_PTS, in frames of 384)
  var isHold = function (key) { return !!key && key.indexOf('wpn_hold_') === 0; };
  var handOf = function (key, dir, stage, k, tip) {
    var at = POSE[dir], i = at.row * 3 + stage;
    if (isHold(key)) { var q = F.holdPts(key, k)[i]; return tip ? q.tip : q.hand; }
    var own = key && F.WPN_GRIPS[key];
    return own ? own[i] : F.archerGrip ? F.archerGrip(key, dir, stage) : at.grip[stage];
  };
  var gripAt = function (p, dir, stage, key, k, tip) {
    var at = POSE[dir], side = at.flip ? -1 : 1, g = handOf(key, dir, stage, k, tip), half = isHold(key) ? F.holdFW(key) / 2 : 144;
    return { x: p.x + (g[0] - half) * side, y: p.y + g[1] - 192 };
  };
  // The shot's motion on the sheet (owner, 11 Nov 2026: smoother, as the rig was): the whole farmer eases up into the
  // aim, breathes while he holds it, the Rifle's kick pushes him back and tips him (held a moment on a hit), a throw
  // lunges forward and settles. Offsets of the pose, by the shot's clock.
  var motion = function (w, sh) {
    var now = w.time.now, t = now - (sh.t0 || now), up = L.rigRaise(t), v = [Math.cos(sh.ang), Math.sin(sh.ang)], o = { x: 0, y: 7 * (1 - up), rot: 0 };
    if (!sh.fired && sh.k === 'rifle') o.y += Math.sin(t / 330) * up;
    if (sh.fired && sh.k === 'rifle') {
      var kk = L.rigKick(now - sh.fired - (sh.stop || 0));
      o.x -= v[0] * 9 * kk; o.y -= v[1] * 9 * kk;
      if (sh.dir === 'left' || sh.dir === 'right') o.rot = (sh.dir === 'left' ? 0.06 : -0.06) * kk; // (he rocks back)
      sh.kick = 0;
    } else if (sh.k === 'javelin') {
      // the javelin (owner, 11 Nov 2026: polish): a wind-up, leaning back (~100 ms), then on the throw a quick forward
      // lunge, a few px, that settles back
      var lean = sh.dir === 'left' ? 1 : sh.dir === 'right' ? -1 : 0;
      if (!sh.fired) { var wu = Math.min(1, t / 100); o.x -= v[0] * 5 * wu; o.y -= v[1] * 5 * wu; o.rot = 0.07 * lean * wu; }
      else {
        var ul = (now - sh.fired) / 240, fl = ul < 0.2 ? ul / 0.2 : Math.max(0, 1 - (ul - 0.2) / 0.8);
        fl = fl * fl * (3 - 2 * fl);
        o.x += v[0] * 9 * fl; o.y += v[1] * 9 * fl; o.rot = -0.05 * lean * fl;
      }
    } else if (sh.fired) {
      var u = Math.min(1, (now - sh.fired) / 220), f = 6 * Math.sin(Math.PI * u);
      o.x += v[0] * f; o.y += v[1] * f;
    }
    return o;
  };
  // The farmer in their pose with the weapon (the archer sheets as stand-ins), turned to the animal while it lasts.
  var posePut = function (w, sh) {
    if (sh.rig) return w.rigPose(sh); // (the Rifle's rig: 19zzzzzzzzzzzzzzzzzzzzzzzzzzzzz-rig.js)
    var p = w.player, at = POSE[sh.dir], mo = motion(w, sh), pt = sh.body ? gripAt(p, sh.dir, sh.stage, sh.key, sh.k) : { x: p.x + Math.cos(sh.ang) * 0.3 * T, y: p.y - 0.15 * T };
    var a = sh.target;
    if (a && a.hp > 0 && a.img.active && sh.stage !== LET_GO) sh.ang = Math.atan2((a.y - 0.3 * a.def.w * T) - pt.y, a.x - pt.x);
    var kick = sh.kick || 0;
    pt = { x: pt.x - Math.cos(sh.ang) * kick + mo.x, y: pt.y - Math.sin(sh.ang) * kick + mo.y };
    sh.grip = pt;
    if (sh.drawnIn) { var tp = gripAt(p, sh.dir, sh.stage, sh.key, sh.k, true); sh.tipPt = { x: tp.x + mo.x, y: tp.y + mo.y }; }
    if (sh.held) {
      // (a boomerang is held by one arm, tilted, over the hand; a long weapon lies along the aim, its grip in the fist)
      var boom = sh.k === 'boomerang', tilt = at.flip || (sh.dir !== 'left' && Math.cos(sh.ang) > 0) ? 0.55 : -0.55;
      // facing you, never across the face: the weapon tilts out to the side of the hand, and the Rifle is held short and low
      var front = sh.dir === 'down' && !boom, da = front ? sh.ang + (pt.x < p.x ? 0.45 : -0.45) : sh.ang, low = front && sh.k === 'rifle';
      sh.held.setPosition(pt.x, pt.y - (boom ? 0.12 * T : 0) + (low ? 0.12 * T : 0)).setRotation(boom ? tilt : da).setFlipY(!boom && Math.cos(da) < 0);
      sh.held.scaleX = sh.held.scaleY * along(sh.k, da) * (low ? 0.75 : 1);
      if (low) sh.grip = pt = { x: pt.x, y: pt.y + 0.12 * T };
    }
    if (sh.glow && sh.drawnIn) sh.glow.setPosition((pt.x + sh.tipPt.x) / 2, (pt.y + sh.tipPt.y) / 2); // (round the weapon in the picture)
    else if (sh.glow) sh.glow.setPosition(pt.x + Math.cos(sh.ang) * 0.15 * T, pt.y + Math.sin(sh.ang) * 0.15 * T);
    if (sh.body) {
      var frame = at.row * 3 + sh.stage;
      sh.body.setPosition(p.x + mo.x, p.y + mo.y).setRotation(mo.rot).setFrame(frame).setFlipX(!!at.flip);
      if (sh.fist) { var g = handOf(sh.key, sh.dir, sh.stage, sh.k); sh.fist.setPosition(p.x + mo.x, p.y + mo.y).setRotation(mo.rot).setFrame(frame).setFlipX(!!at.flip).setCrop(g[0] - 30, g[1] - 30, 60, 60); }
    }
  };
  P.wpnPose = function () { if (this.wpnShot) posePut(this, this.wpnShot); }; // (the tests' pose checks)
  var poseEnd = function (w, sh) {
    if (sh.rig) w.rigEnd(sh);
    [sh.body, sh.fist, sh.held, sh.glow].forEach(function (o) { if (o && o.active) o.destroy(); });
    sh.held = sh.glow = null;
    if (w.wpnShot === sh) w.wpnShot = null;
    if (w.player && w.player.active) w.player.setVisible(true);
  };
  // the tip of the weapon in the hand: where the shot leaves
  var tipOf = function (sh) {
    if (sh.rig && sh.rigTip) return sh.rigTip;
    if (sh.drawnIn && sh.tipPt) return sh.tipPt;
    var t = F.weaponTexture(F.world, sh.k, sh.lv), len = lenOf(sh.k), out = (t.tip - t.grip) * len;
    return { x: sh.grip.x + Math.cos(sh.ang) * out, y: sh.grip.y + Math.sin(sh.ang) * out };
  };

  P.fireWeapon = function () {
    var self = this, s = this.state, k = L.heldWeapon(s);
    if (!k || this.wpnShot || this.shot || this.time.now < this.wpnNext) return;
    if (!works(this)) return F.ui.toast(whyNot(k));
    var lv = L.weaponLevel(s, k), r = L.fireWeapon(s, k);
    if (r === 'ammo') return F.ui.toast(k === 'rifle' ? 'No bullets left. The Armory sells them.' : 'No javelins left. The Armory sells them.');
    if (r === 'tired') return F.ui.toast('Too tired to ' + W[k].verb.toLowerCase() + '. Eat something first.');
    if (r === 'none') return null;
    var target = this.wildTarget(L.weaponRange(k, lv)), f = this.feet(), p = this.player;
    if (target) {
      var tx = target.x - f.x, ty = target.y - f.y;
      this.dir = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
    }
    // the pose: the weapon drawn in the hands when your look has that sheet (wpn_hold_*), else the empty-hand poses with the
    // weapon drawn over them (a look without one yet), else the archer's
    var hold = F.holdOwn(k);
    hold = hold && !F.holdOff && F.holdHere(hold) && L.holdHas(hold, this.dir) ? F.holdSheet(hold) : null; // (a direction it has no picture for: the old way; F.holdOff: always the old way)
    var d = this.dirVec(), at = POSE[this.dir], key = hold || F.weaponPoseKey(k), depth = p.depth + (at.behind ? -0.001 : 0.001), how = SHOT[k];
    p.anims.stop();
    var own = !!(key && (hold || F.WPN_GRIPS[key])); // (the owner's poses: ready, then aim or throw, then after)
    var sh = this.wpnShot = { k: k, lv: lv, dir: this.dir, target: target, ang: Math.atan2(d[1], d[0]), stage: key && !own ? how.stage : 0, broke: r === 'broke', key: key, own: own,
      drawnIn: !!hold, t0: this.time.now, stop: 0 };
    if (F.rigFor && F.rigFor(this, k)) { // (the boy with the Rifle: built from parts and moved, not a pose sheet)
      this.idle(); // (from his standing frame, which the rig matches)
      this.rigStart(sh);
      this.acting = W[k].still;
      this.wpnNext = this.time.now + L.weaponGap(k);
      sfx('cast');
      this.time.delayedCall(how.at, function () { if (self.wpnShot === sh) self.weaponLoose(sh); });
      F.bus.emit('hud');
      this.changed();
      return null;
    }
    if (key) {
      F.ensureTexture(this, key);
      sh.body = this.add.image(p.x, p.y, key, 0).setDepth(p.depth);
      if (!at.behind && k !== 'boomerang' && !hold) sh.fist = this.add.image(p.x, p.y, key, 0).setDepth(depth + 0.0003);
      p.setVisible(false);
    }
    if (!hold) sh.held = heldImage(this, k, lv, p.x, p.y, sh.ang).setDepth(depth);
    if (hold && lv) { // (drawn in its plain look: the level shows as a soft glow of its colour round it; the Moon's own glow)
      var moonLv = L.weaponMoon(k, lv), col = moonLv ? F.WPN_GLOW : parseInt(F.WPN_PAL[lv].shot.slice(1), 16);
      sh.glow = this.add.circle(p.x, p.y, (moonLv ? 0.32 : 0.22) * T, col, moonLv ? 0.26 : 0.14).setDepth(p.depth + 0.0008).setBlendMode(Phaser.BlendModes.ADD);
    } else if (!hold && L.weaponMoon(k, lv)) sh.glow = glowAt(this, p.x, p.y, 0.36 * T, depth - 0.0005); // (the Moon pictures glow too: a soft one)
    posePut(this, sh);
    this.acting = W[k].still;
    this.wpnNext = this.time.now + L.weaponGap(k);
    sfx(k === 'rifle' ? 'cast' : 'swoosh');
    if (own && k === 'rifle') this.time.delayedCall(110, function () { if (self.wpnShot === sh) { sh.stage = 1; posePut(self, sh); } }); // (up to the shoulder)
    // (drawn in: the throw picture shows just before the weapon leaves, so it can be gone from the hand the moment it flies)
    if (sh.drawnIn && k !== 'rifle') this.time.delayedCall(Math.max(0, how.at - 70), function () { if (self.wpnShot === sh) { sh.stage = 1; posePut(self, sh); } });
    this.time.delayedCall(how.at, function () { if (self.wpnShot === sh) self.weaponLoose(sh); });
    // a boomerang wearing out: a word at 20 throws left; its last throw flies, and it breaks as it comes back
    if (r === 'warn') F.ui.toast('Your Boomerang has ' + W.boomerang.warn + ' throws left. Bram can fix it at the Forge.', 3000, 0x7a5a12);
    F.bus.emit('hud');
    this.changed();
  };

  P.weaponLoose = function (sh) {
    // (it leaves from the hand, so an animal right in front is not flown past; the Rifle's round shows from the muzzle on)
    var self = this, k = sh.k, range = L.weaponRange(k, sh.lv) * T;
    // (the owner's poses: a javelin or boomerang leaves the hand at the throw, then the arm follows through)
    // Drawn in, the weapon is never in the picture and in the air at once: a javelin goes straight to the empty hand after
    // the throw; a boomerang keeps the throw picture where its hand is empty (side on, facing away: the importer left the
    // flying one out), and facing you, where it is still drawn in the hand, he is back to standing at once. (A drawn-in
    // boomerang's third picture is the catch: never while it is out.)
    var drawnBoom = sh.drawnIn && k === 'boomerang', drawnJav = sh.drawnIn && k === 'javelin';
    sh.stage = !sh.body ? 0 : sh.own && k !== 'rifle' ? 1 : LET_GO; // (the javelin's hand of the throw: where it leaves)
    sh.fired = this.time.now;
    posePut(this, sh);
    if (sh.own && k !== 'rifle' && !sh.drawnIn) this.time.delayedCall(90, function () { if (self.wpnShot === sh) { sh.stage = LET_GO; posePut(self, sh); } });
    var tip = tipOf(sh), from = sh.grip;
    if (drawnJav && sh.body) { sh.stage = LET_GO; posePut(this, sh); } // (the same moment: the empty hand, nothing drawn in it)
    if (k === 'rifle' && sh.rig) { sfx('smash'); this.rigFire(sh); this.wpnPuff(sh.rigTip.x, sh.rigTip.y, sh.lv, sh.rig.view === 'back' ? sh.rig.cont.depth - 0.002 : null); } // (facing away: behind his head)
    else if (k === 'rifle') { // a pop, a flash, a puff, a light shake and the kick (motion: the shot's clock)
      sfx('smash');
      var behind = POSE[sh.dir].behind && sh.body ? sh.body.depth - 0.002 : null; // (facing away: behind his head)
      if (sh.dir === 'down' && sh.drawnIn) { // (facing you the muzzle is at his face: a small quick flash, the smoke off to the side)
        this.wpnFlashAt(tip.x, tip.y, sh.ang, sh.lv, null, 0.45);
        this.wpnPuff(tip.x, tip.y, sh.lv, null, true);
      } else {
        this.wpnFlashAt(tip.x, tip.y, sh.ang, sh.lv, behind);
        this.wpnPuff(tip.x, tip.y, sh.lv, behind);
      }
      this.cameras.main.shake(100, 0.002);
    } else {
      sfx('bowshot');
      if (sh.held) sh.held.setVisible(false); // (it is in the air now)
      if (sh.glow) sh.glow.setVisible(false);
    }
    posePut(this, sh);
    var fa = sh.rig && sh.rigAng != null ? sh.rigAng : sh.ang; // (the rig's rifle points where it can: the shot goes that way)
    var tg = sh.target, flight = tg && tg.hp > 0 && tg.img.active ? Math.hypot(tg.x - from.x, (tg.y - 0.3 * tg.def.w * T) - from.y) + 0.3 * T : 0;
    this.wpnFly({ k: k, lv: sh.lv, x: from.x, y: from.y, ang: fa, range: range, shown: false, broke: sh.broke, hide: k === 'rifle' ? Math.hypot(tip.x - from.x, tip.y - from.y) : 0, flight: flight });
    this.tellArrow({ x: Math.round(from.x), y: Math.round(from.y), a: fa, l: L.shotRange(range, k), b: sh.lv });
    var rest = drawnBoom ? (sh.dir === 'down' ? 0 : 90) : Math.max(60, W[k].still - SHOT[k].at);
    if (!rest) { poseEnd(this, sh); this.idle(); }
    else this.time.delayedCall(rest, function () { if (self.wpnShot === sh) { poseEnd(self, sh); self.idle(); } });
  };

  // the Rifle's flash at the muzzle: a bright dot and a little cross, gone in 80 ms (depth: behind him, facing away)
  P.wpnFlashAt = function (x, y, ang, lv, depth, size) {
    var c = L.weaponMoon('rifle', lv) ? F.WPN_GLOW : 0xfff2b0, d = depth != null ? depth : DEPTH.fx + 0.03, z = size || 1;
    var bits = [this.add.circle(x, y, 0.13 * T * z, c, 0.95)].concat([0, 1].map(function (i) { return this.add.rectangle(x, y, 0.5 * T * z, 0.05 * T * z, c, 0.9).setRotation(ang + i * Math.PI / 2); }, this));
    bits.forEach(function (b) { b.setDepth(d).setBlendMode(Phaser.BlendModes.ADD); });
    this.tweens.add({ targets: bits, alpha: 0, scale: 1.6, duration: 80, onComplete: function () { bits.forEach(function (b) { b.destroy(); }); } });
  };
  // the Rifle's puff at the muzzle (cheap: a few soft circles)
  P.wpnPuff = function (x, y, lv, depth, aside) {
    var moon = !!L.weaponMoon('rifle', lv), n = cheap() ? 2 : 4;
    if (aside) { // (facing you: small puffs that start below and to the side of the muzzle and drift away from the face, gone in 0.2 s)
      var sideways = Math.random() < 0.5 ? -1 : 1;
      for (var j = 0; j < Math.min(n, 3); j++) {
        var px = x + sideways * (0.28 + 0.08 * j) * T, py = y + 0.18 * T;
        var q = this.add.circle(px, py, (0.05 + Math.random() * 0.03) * T, moon ? F.WPN_GLOW : 0xfff3d6, 0.75).setDepth(depth != null ? depth : DEPTH.fx + 0.02);
        this.tweens.add({ targets: q, x: px + sideways * 0.3 * T, y: py + 0.06 * T, alpha: 0, scale: 1.6, duration: 200, onComplete: function (tw, t) { t[0].destroy(); } });
      }
      return;
    }
    for (var i = 0; i < n; i++) {
      var c = this.add.circle(x, y, (0.1 + Math.random() * 0.06) * T, moon ? F.WPN_GLOW : 0xfff3d6, 0.85).setDepth(depth != null ? depth : DEPTH.fx + 0.02);
      this.tweens.add({ targets: c, x: x + (Math.random() - 0.5) * 0.4 * T, y: y - (0.1 + Math.random() * 0.3) * T, alpha: 0, scale: 2.2, duration: 320 + i * 60, onComplete: function (tw, t) { t[0].destroy(); } });
    }
  };

  // ---------- shots in flight ----------
  // o: { k, lv, x, y, ang, range (world units), shown (a friend's: it hits nothing here), broke, back (whom a boomerang
  // flies back to: a farmer's sprite, or null for where it left) }
  P.wpnFly = function (o) {
    var moon = L.weaponMoon(o.k, o.lv), c = Math.cos(o.ang), sn = Math.sin(o.ang), sh;
    sh = { k: o.k, lv: o.lv, x: o.x, y: o.y, x0: o.x, y0: o.y, ang: o.ang, c: c, s: sn, range: o.range, went: 0, t: 0, shown: !!o.shown,
      broke: !!o.broke, back: o.back || null, moon: moon, pierce: moon === 'pierce' ? 1 : 0, through: [], hit: false, sparkAt: 0, hide: o.hide || 0 };
    if (o.k === 'rifle') {
      sh.img = this.add.image(o.x, o.y, F.bulletTexture(this, o.lv)).setDisplaySize(0.22 * T, 0.22 * T).setRotation(o.ang).setDepth(DEPTH.fx).setVisible(!sh.hide);
      sh.streak = this.add.rectangle(o.x, o.y, 1, moon ? 16 : 10, moon ? F.WPN_GLOW : 0xfff3d6, moon ? 0.9 : 0.7).setOrigin(1, 0.5).setRotation(o.ang).setDepth(DEPTH.fx - 0.001).setVisible(!sh.hide);
    } else {
      var t = F.weaponTexture(this, o.k, o.lv), len = lenOf(o.k);
      sh.img = this.add.image(o.x, o.y, t.key).setScale(len / t.w).setDepth(DEPTH.fx).setRotation(o.k === 'boomerang' ? 0 : o.ang).setFlipY(o.k === 'javelin' && c < 0)
        .setOrigin(o.k === 'javelin' ? 0.97 : 0.5, 0.5); // (a javelin's point leads: it is where it hits)
      sh.sc0 = len / t.w;
      sh.shade = this.add.ellipse(o.x, o.y, (o.k === 'javelin' ? 0.9 : 0.4) * T, 0.12 * T, 0x000000, 0.22).setDepth(DEPTH.shadow).setRotation(o.k === 'javelin' ? o.ang * 0.25 : 0);
      if (o.k === 'javelin') {
        // seen along its flight (thrown at you or away), a javelin is short: about a third of its side-on length
        sh.fore = 1 - 0.66 * Math.abs(sn);
        sh.img.setScale(sh.sc0 * sh.fore, sh.sc0);
        sh.shade.setSize((0.15 + 0.75 * sh.fore) * T, 0.12 * T);
        sh.flight = Math.max(0.5 * T, Math.min(o.range, o.flight || o.range)); // (it comes down on what it was thrown at)
        // a faint speed trail behind it, in its level's colour
        var tc = moon ? F.WPN_GLOW : parseInt(F.WPN_PAL[o.lv].shot.slice(1), 16);
        sh.streak = this.add.rectangle(o.x, o.y, 1, 0.05 * T, tc, 0.35).setOrigin(1, 0.5).setDepth(DEPTH.fx - 0.001);
      }
    }
    if (moon) sh.glow = glowAt(this, o.x, o.y, (o.k === 'rifle' ? 0.2 : 0.3) * T, DEPTH.fx - 0.002);
    else if (o.k === 'boomerang' && o.lv && F.images && F.images.wpn_boom) // (one wooden boomerang for every level: its level a soft glow of its colour)
      sh.glow = this.add.circle(o.x, o.y, 0.24 * T, parseInt(F.WPN_PAL[o.lv].shot.slice(1), 16), 0.22).setDepth(DEPTH.fx - 0.002).setBlendMode(Phaser.BlendModes.ADD);
    this.wpnShots.push(sh);
    return sh;
  };
  // the animal this point is touching (the Bow's rule), not one of `skip`
  var touching = function (w, sh, x, y, skip, more) {
    var hit = null;
    (w.wild ? w.wild.animals : []).forEach(function (a) {
      if (!hit && a.hp > 0 && skip.indexOf(a) < 0 && !(sh.shown && a.gsLocal) && !a.def.tameOnly &&
        Math.hypot(x - a.x, y - (a.y - 0.3 * a.def.w * T)) < Math.max(0.45, 0.55 * a.def.w) * T + (more || 0)) hit = a;
    });
    return hit;
  };
  // the one standing next to it (a Moon Javelin's or Moon Boomerang's second hit)
  var beside = function (w, a, skip) {
    var best = null, bd = C.WEAPON_PAIR * T;
    (w.wild ? w.wild.animals : []).forEach(function (b) {
      if (b === a || b.hp <= 0 || skip.indexOf(b) >= 0 || b.def.tameOnly) return;
      var dd = Math.hypot(b.x - a.x, b.y - a.y);
      if (dd < bd) { bd = dd; best = b; }
    });
    return best;
  };
  // A hit: your shot's counts (the weapon's damage), a friend's only shows
  P.wpnStrike = function (sh, a) {
    if (sh.moon && this.moonSpark) this.moonSpark(sh.x, sh.y, true);
    if (sh.shown) { if (this.bits) this.bits.dust.explode(2, sh.x, sh.y); return; }
    var s = this.state;
    if (sh.k === 'rifle' && this.rigHitStop) this.rigHitStop(this.wpnShot);
    if (sh.k === 'rifle' && this.wpnShot && !this.wpnShot.rig) this.wpnShot.stop += 40; // (the hit pause: the kick holds a moment)
    s.wpnHit = { k: sh.k, lv: sh.lv };
    try { this.wildStruck(a); } finally { s.wpnHit = null; }
  };
  var drop = function (w, sh) {
    [sh.img, sh.streak, sh.shade, sh.glow].forEach(function (o) { if (o && o.active) o.destroy(); });
  };
  P.updateWeaponShots = function (dt) {
    var self = this;
    this.wpnShots = this.wpnShots.filter(function (sh) { return self.wpnStep(sh, dt); });
  };
  // one shot's frame: false when it is done
  // (in small steps, a quarter tile at most: on a slow phone a frame can be 0.1 s, and a bullet goes 3 tiles in that)
  var STEP = 0.25 * T;
  P.wpnStep = function (sh, dt) {
    if (sh.glow) sh.glow.setPosition(sh.x, sh.y - (sh.h || 0) - (sh.k === 'boomerang' ? 0.15 * T : 0));
    if (sh.moon && !cheap() && this.moonSpark && sh.went >= sh.sparkAt) { sh.sparkAt = sh.went + 0.4 * T; this.moonSpark(sh.x, sh.y - (sh.h || 0)); }
    if (sh.k === 'boomerang') return this.wpnBoomerang(sh, dt);
    var speed = SHOT[sh.k].speed * T, total = speed * dt / 1000, n = Math.max(1, Math.ceil(total / STEP)), step = total / n;
    for (var i = 0; i < n; i++) {
      sh.x += sh.c * step;
      sh.y += sh.s * step;
      sh.went += step;
      var hit = touching(this, sh, sh.x, sh.y, sh.through);
      if (hit) {
        var pair = sh.moon === 'pair' ? beside(this, hit, sh.through) : null;
        this.wpnStrike(sh, hit);
        if (pair) { sh.through.push(hit); this.wpnStrike(sh, pair); }
        if (sh.pierce > 0) { sh.pierce -= 1; sh.through.push(hit); continue; } // (the Moon Rifle: on into the one behind)
        if (sh.k === 'javelin') return this.wpnStick(sh, 450, hit);
        drop(this, sh);
        return false;
      }
      if (sh.went >= (sh.k === 'javelin' ? sh.flight || sh.range : sh.range)) {
        if (sh.k === 'javelin') return this.wpnStick(sh, 1000); // (a miss: in the ground at an angle, about a second)
        if (this.bits) this.bits.dust.explode(2, sh.x, sh.y);
        drop(this, sh);
        return false;
      }
    }
    if (sh.k === 'rifle') {
      var out = sh.went - sh.hide;
      sh.img.setPosition(sh.x, sh.y).setVisible(out > 0);
      sh.streak.setPosition(sh.x, sh.y).setSize(Math.max(1, Math.min(out, 2.2 * T)), sh.streak.height).setVisible(out > 0);
    } else { // the javelin's arc: a little up, then down onto what it was thrown at, its point following the path
      var D = sh.flight || sh.range, u = Math.min(1, sh.went / D), H = Math.min(0.22 * D, (0.18 + 0.05 * D / T) * T), h = 4 * H * u * (1 - u), dh = 4 * H * (1 - 2 * u) / D * speed;
      var away = sh.s < -0.5 ? 1 - 0.3 * u : 1, rot = Math.atan2(sh.s * speed - dh, sh.c * speed) + (Math.abs(sh.s) > 0.85 ? (sh.c < 0 ? -0.25 : 0.25) : 0);
      sh.h = h;
      sh.img.setPosition(sh.x, sh.y - h).setRotation(rot).setFlipY(sh.c < -0.05).setScale(sh.sc0 * sh.fore * away, sh.sc0 * away); // (away: smaller as it goes)
      sh.shade.setPosition(sh.x, sh.y + 0.05 * T).setScale(away);
      var tl = lenOf('javelin') * sh.fore * away;
      if (sh.streak) sh.streak.setPosition(sh.x, sh.y - h).setRotation(rot).setSize(tl + Math.min(sh.went, 0.7 * T) * sh.fore, sh.streak.height);
    }
    return true;
  };
  // a javelin stands where it came down for a moment, then fades
  // A javelin that hit: a short thunk (it pops and the screen gives a tiny jolt), it stays in the animal as it flew, then
  // fades. A miss: it stands in the ground at an angle, its point in, for about a second.
  P.wpnStick = function (sh, ms, hit) {
    var img = sh.img;
    if (sh.streak) sh.streak.destroy();
    if (sh.glow) sh.glow.destroy();
    if (sh.shade) sh.shade.destroy();
    if (!(img && img.active)) return false;
    if (hit) {
      if (!sh.shown) this.cameras.main.shake(60, 0.0018);
      var sx = img.scaleX, sy = img.scaleY;
      img.setDepth(hit.img.depth + 0.0001);
      this.tweens.add({ targets: img, scaleX: sx * 1.12, scaleY: sy * 1.12, duration: 50, yoyo: true });
      this.tweens.add({ targets: img, alpha: 0, delay: ms, duration: 220, onComplete: function () { img.destroy(); } });
      return false;
    }
    if (this.bits) this.bits.dust.explode(2, sh.x, sh.y + 0.1 * T);
    var side = Math.abs(sh.c) > 0.5, f = sh.fore || 1;
    img.setPosition(sh.x, sh.y).setRotation(side ? (sh.c < 0 ? Math.PI - 0.9 : 0.9) : (sh.s > 0 ? 1.25 : 1.9)) /* (the point down in the ground) */.setFlipY(false)
      .setScale((sh.sc0 || img.scaleY) * Math.max(0.55, f), sh.sc0 || img.scaleY).setDepth(DEPTH.actor + sh.y / 1e5);
    this.tweens.add({ targets: img, alpha: 0, delay: ms, duration: 250, onComplete: function () { img.destroy(); } });
    return false;
  };
  // The boomerang: out to its reach and back in a loop, spinning; it hits the first animal it touches (the Moon one: that
  // one and the one beside it), then only flies home. Caught: done (the last throw: it breaks in your hands).
  P.wpnBoomerang = function (sh, dt) {
    var trip = SHOT.boomerang.trip, R = sh.range, n = Math.max(1, Math.ceil(dt / 16)), tau = 0, x = sh.x, y = sh.y;
    var home = sh.shown ? (sh.back && sh.back.active ? { x: sh.back.x, y: sh.back.y } : { x: sh.x0, y: sh.y0 }) : (this.player && this.player.active ? { x: this.player.x, y: this.player.y } : { x: sh.x0, y: sh.y0 });
    for (var i = 0; i < n; i++) {
      sh.t += dt / n;
      tau = Math.min(1, sh.t / trip);
      var along = R / 2 * (1 - Math.cos(2 * Math.PI * tau)), side = R * 0.14 * Math.sin(2 * Math.PI * tau);
      var pull = tau < 0.5 ? 0 : (tau - 0.5) * 2; // (back to where the thrower is now)
      pull = pull * pull * (3 - 2 * pull);
      x = sh.x0 + sh.c * along - sh.s * side + (home.x - sh.x0) * pull;
      y = sh.y0 + sh.s * along + sh.c * side + (home.y - sh.y0) * pull;
      sh.went += Math.hypot(x - sh.x, y - sh.y);
      sh.x = x;
      sh.y = y;
      if (sh.hit || tau >= 1) continue;
      var hit = touching(this, sh, x, y, sh.through, 0.15 * T); // (a wide spinning thing: a little more room)
      if (!hit) continue;
      sh.hit = true;
      var pair = sh.moon === 'pair' ? beside(this, hit, sh.through) : null;
      this.wpnStrike(sh, hit);
      if (pair) this.wpnStrike(sh, pair);
      if (tau < 0.5) sh.t = trip - sh.t; // (it turns back from what it hit)
    }
    sh.img.setPosition(x, y - 0.15 * T).setRotation(sh.img.rotation + dt * 0.022);
    sh.shade.setPosition(x, y + 0.2 * T);
    if (tau < 1) return true;
    drop(this, sh);
    if (sh.shown) return false;
    if (sh.broke) this.wpnBroke(x, y);
    else sfx('catch');
    return false;
  };
  P.wpnBroke = function (x, y) {
    sfx('woodbreak');
    for (var i = 0; i < 2; i++) {
      var bit = this.add.image(x, y, 'items', C.wpnIcon('boomerang_broken')).setScale(0.35).setDepth(DEPTH.fx);
      this.tweens.add({ targets: bit, x: x + (i ? 1 : -1) * 0.5 * T, y: y + 0.4 * T, angle: i ? 140 : -140, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: function (tw, t) { t[0].destroy(); } });
    }
    F.ui.toast('Your Boomerang broke! The Armory sells a new one.', 3200, 0x7a3a22);
    this.changed();
    this.save();
  };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.wpnShots && this.wpnShots.length && this.wild && !this.busy) this.updateWeaponShots(Math.min(delta, 100));
    if (this.wpnShot && !this.wpnShot.rig && this.wpnShot.body) posePut(this, this.wpnShot); // (the shot's motion)
    if (this.wpnRemotePoses && this.wpnRemotePoses.length) this.updateRemotePoses();
    if (Math.floor(time / 5000) !== this.holdSweepAt) { this.holdSweepAt = Math.floor(time / 5000); F.holdSweep(); }
    if (Math.floor(time / 250) !== this.wpnChipAt) { this.wpnChipAt = Math.floor(time / 250); this.weaponChip(); }
  };

  // ---------- friends' shots ----------
  // (their 'ar': the weapon is in its range's low bits; a Bow's shot has none). Their farmer stays as they are; their
  // weapon shows a moment where the shot leaves, and the shot flies (it hits nothing on this phone: theirs tells).
  P.wpnRemote = function (x, y, ang, l, lv, k, who) {
    lv = Math.max(0, Math.min(5, Math.floor(Number(lv)) || 0));
    var range = Math.max(T, Math.min(8 * T, Math.floor(l / 8) * 8));
    var c = Math.cos(ang), sn = Math.sin(ang), dir = Math.abs(c) > Math.abs(sn) ? (c > 0 ? 'right' : 'left') : (sn > 0 ? 'down' : 'up');
    var hold = who && who.spr && who.spr.active && !who.horse ? F.holdForOther(who.look, who.cs, k, dir) : null;
    if (hold) this.wpnRemotePose(who, hold, k, lv, ang); // (their farmer holds it, in their own pose sheet)
    else {
      var img = heldImage(this, k, lv, x - c * 0.4 * T, y - sn * 0.4 * T, ang).setDepth(DEPTH.fx);
      this.tweens.add({ targets: img, alpha: 0, delay: k === 'rifle' ? 260 : 80, duration: 200, onComplete: function () { img.destroy(); } });
    }
    if (k === 'rifle') this.wpnPuff(x, y, lv);
    if (who) this.remoteSound(who, k === 'rifle' ? 'smash' : 'bowshot');
    this.wpnFly({ k: k, lv: lv, x: x, y: y, ang: ang, range: range, shown: true, back: who && who.spr ? who.spr : null });
  };
  var remoteShot = P.remoteShot;
  P.remoteShot = function (r, x, y, ang, l, level) {
    var k = L.shotWeapon(l);
    if (!k) return remoteShot.apply(this, arguments);
    if (!r || !r.spr || !r.spr.active) return false;
    this.wpnRemote(x, y, ang, l, level, k, r);
    return true;
  };
  var wildArrow = P.wildArrow;
  P.wildArrow = function (x, y, ang, left, shown, level) {
    var k = shown ? L.shotWeapon(left) : null;
    if (!k) return wildArrow.apply(this, arguments);
    this.wpnFlash = true; // (its bowFlash, next: not a bow)
    this.wpnRemote(x, y, ang, left, level, k, null);
    return null;
  };
  var bowFlash = P.bowFlash;
  P.bowFlash = function () {
    if (this.wpnFlash) { this.wpnFlash = false; return; }
    return bowFlash.apply(this, arguments);
  };

  // ---------- the chip: ammo, or the boomerang's throws left ----------
  P.weaponChip = function () {
    var ui = F.ui, s = this.state, k = s && !this.busy ? L.heldWeapon(s) : null;
    if (!ui || !ui.add || !ui.sys || !ui.sys.isActive()) return;
    if (!ui.wpnChip) {
      var bg = ui.add.rectangle(0, 0, 92, 28, 0x2e1c0c, 0.8).setOrigin(0, 0.5).setStrokeStyle(1.5, 0xfff3c4, 0.6);
      ui.wpnChipIcon = ui.add.image(15, 0, 'items', C.wpnIcon('bullets')).setScale(0.18);
      ui.wpnChipText = ui.add.text(31, 0, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff6e0' }).setOrigin(0, 0.5);
      ui.wpnChipBar = ui.add.rectangle(31, 9, 52, 4, 0x6fd06a).setOrigin(0, 0.5);
      ui.wpnChipBarBg = ui.add.rectangle(31, 9, 52, 4, 0x000000, 0.45).setOrigin(0, 0.5);
      ui.wpnChip = ui.add.container(262, 448, [bg, ui.wpnChipIcon, ui.wpnChipText, ui.wpnChipBarBg, ui.wpnChipBar]).setDepth(45).setVisible(false);
    }
    var on = !!k && !!this.wild;
    ui.wpnChip.setVisible(on);
    if (!on) return;
    var boom = k === 'boomerang', n = L.ammoLeft(s, k), most = boom ? L.throwsMax(s) : 0, low = boom && L.throwsLow(s);
    ui.wpnChipIcon.setFrame(boom ? L.iconOf(s, 'boomerang') : C.wpnIcon(W[k].ammo));
    ui.wpnChipText.setText(boom ? n + '/' + most : 'x' + n).setY(boom ? -3 : 0).setColor(low || (!boom && !n) ? '#ff9a8a' : '#fff6e0');
    ui.wpnChipBar.setVisible(boom).setSize(Math.max(1, 52 * (most ? n / most : 0)), 4).setFillStyle(low ? 0xe5484d : 0x6fd06a);
    ui.wpnChipBarBg.setVisible(boom);
  };

  F.bus.on('hud', function () {
    var w = F.world;
    if (!(w && w.sys && w.sys.isActive() && w.state)) return;
    w.weaponChip(); // (at once when you switch)
    if (w.wild && F.askHold) F.askHold(); // (the sheet of the weapon now in your hands, from the pack)
  });

  // ---------- the others' weapons drawn in their hands ----------
  // Another hunter's shot plays their own pose sheet when this phone holds it: up to C.WPN_HOLD.others looks at once (4
  // on a cheap phone), asked for the first time it is wanted (the shot after shows it), let go after 30 s unseen
  // (L.sheetPick, L.sheetStale; as riding v2). Past the cap, or before it is here: as before (a flash of their weapon).
  var heldOthers = F.holdHeld = {};
  var ownHolds = function () { return ['rifle', 'javelin', 'boomerang'].map(function (w) { return F.holdOwn(w); }).filter(Boolean); };
  F.holdForOther = function (look, cos, k, dir) {
    var want = F.holdSheet(L.holdKey(k, look, cos || ''));
    if (!F.holdPacked(want) || !L.holdHas(want, dir)) return null;
    var cap = F.cheapPhone && F.cheapPhone() ? C.WPN_HOLD.othersCheap : C.WPN_HOLD.others;
    var key = L.sheetPick(heldOthers, want, ownHolds(), Date.now(), cap);
    if (!key) return null;
    if (!F.holdHere(key)) { if (F.needImage) F.needImage(key); return null; }
    return key;
  };
  F.holdSweep = function (now) {
    var tex = F.game && F.game.textures;
    L.sheetStale(heldOthers, now || Date.now(), C.WPN_HOLD.letGo).forEach(function (k) {
      if (tex && tex.exists(k) && F.freeTexture && !F.freeTexture(k)) { heldOthers[k] = Date.now(); return; } // (still on screen)
      if (F.images && F.packedFile && F.packedFile(k)) delete F.images[k]; // (its picture too: asked for again if wanted)
    });
  };
  P.wpnRemotePose = function (who, key, k, lv, ang) {
    var self = this, p = who.spr, c = Math.cos(ang), sn = Math.sin(ang), dir = Math.abs(c) > Math.abs(sn) ? (c > 0 ? 'right' : 'left') : (sn > 0 ? 'down' : 'up');
    var at = POSE[dir], img = this.add.image(p.x, p.y, F.ensureTexture(this, key), at.row * 3 + 1).setDepth(p.depth + 0.0001).setFlipX(!!at.flip);
    var glow = lv ? this.add.circle(p.x, p.y, 0.3 * T, L.weaponMoon(k, lv) ? F.WPN_GLOW : parseInt(F.WPN_PAL[lv].shot.slice(1), 16), 0.2).setDepth(p.depth + 0.0002).setBlendMode(Phaser.BlendModes.ADD) : null;
    var pose = { who: who, img: img, glow: glow, k: k, dir: dir, until: this.time.now + 380, at: this.time.now + 160, key: key };
    who.useUntil = this.time.now + 420;
    who.anim = null;
    p.anims.stop();
    p.setVisible(false);
    (this.wpnRemotePoses = this.wpnRemotePoses || []).push(pose);
    void self;
  };
  P.updateRemotePoses = function () {
    var now = this.time.now;
    this.wpnRemotePoses = (this.wpnRemotePoses || []).filter(function (q) {
      var p = q.who.spr, done = now >= q.until || !p || !p.active;
      if (done) { q.img.destroy(); if (q.glow) q.glow.destroy(); if (p && p.active) p.setVisible(true); return false; }
      var at = POSE[q.dir], hp = F.holdPts(q.key, q.k)[at.row * 3 + 1], side = at.flip ? -1 : 1;
      q.img.setPosition(p.x, p.y).setFrame(at.row * 3 + (now >= q.at ? 2 : 1));
      if (q.glow) q.glow.setPosition(p.x + (hp.hand[0] - F.holdFW(q.key) / 2) * side, p.y + hp.hand[1] - 192);
      heldOthers[q.key] = now; // (seen)
      return true;
    });
  };

  // ---------- the Armory: buying, upgrading, ammo, repairs (Manila's Armory opens this) ----------
  var needText = function (s, needs) {
    return needs.map(function (n) { return n[1] + ' ' + L.weaponNeedName(n[0]) + ' (' + L.weaponHave(s, n[0]) + ')'; }).join(', ');
  };
  var secs = function (ms) { return (ms / 1000).toFixed(ms % 1000 ? (ms % 100 ? 2 : 1) : 0).replace(/\.0+$/, '') + ' s'; };
  // opts: { title, tab, page, back (what the corner button opens again) }
  U.openArmory = function (opts) {
    opts = opts || {};
    var self = this, s = F.session.state, rows = [], tab = opts.tab || 'arms', page = opts.page || 0;
    var again = function (t, p) { self.closeModal(); self.openArmory(Object.assign({}, opts, { tab: t || tab, page: p == null ? page : p })); };
    var done = function (r, ok) {
      if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
      if (r === 'full') { sfx('nope'); return self.toast('Your bag is full.'); }
      if (r === 'short') { sfx('nope'); return self.toast('You need more for that one.'); }
      if (r !== 'ok') return null;
      sfx('anvil');
      self.toast(ok, 2400, 0x2f5a22);
      F.world.changed();
      F.world.save();
      F.bus.emit('hud');
      again();
      return null;
    };
    if (tab === 'arms') {
      C.WEAPON_KINDS.forEach(function (k) {
        var next = L.nextWeapon(s, k), have = L.hasWeapon(s, k), lv = L.weaponLevel(s, k), d = W[k];
        if (!next) {
          rows.push({ icon: L.iconOf(s, k), name: L.weaponName(k, lv), desc: 'The best there is. Reach ' + d.range[lv] + ', hits ' + d.damage[lv] + '.' });
          return;
        }
        var nl = next.level, ok = s.gold >= next.gold && next.needs.every(function (n) { return L.weaponHave(s, n[0]) >= n[1]; });
        var what = 'Reach ' + d.range[nl] + (have ? ' (now ' + d.range[lv] + ')' : '') + ', hits ' + d.damage[nl] + (have ? ' (now ' + d.damage[lv] + ')' : '') + '.';
        var more = (have ? '' : ' One ' + (d.verb === 'Shoot' ? 'shot' : 'throw') + ' every ' + secs(d.gap) + '. ' + (d.ammo ? 'Needs ' + C.ITEMS[d.ammo].name.toLowerCase() + '.' : 'No ammo; it wears out.')) +
          (L.weaponMoon(k, nl) ? (d.moon === 'pierce' ? ' Goes through the first animal and hits the one behind.' : ' Hits 2 animals side by side.') : '');
        rows.push({ icon: L.weaponIcon(k, nl), name: have ? 'Upgrade to ' + L.weaponName(k, nl) : d.name, desc: what + more + (next.needs.length ? ' Takes ' + needText(s, next.needs) + '.' : ''),
          buttons: [{ label: (have ? '' : 'Buy ') + commas(next.gold) + 'G', color: ok ? GREEN_BTN : GREY_BTN, cb: function () {
            var r = L.getWeapon(s, k);
            if (r === 'ok' && !have) s.inv.forEach(function (x, i) { if (x && x.id === k) s.sel = i; }); // in your hands right away
            done(r, have ? 'Your ' + L.weaponName(k, L.weaponLevel(s, k)) + ' is ready!' : 'A ' + d.name + '! You are holding it: tap ' + d.verb + '.');
          } }] });
      });
    } else if (tab === 'ammo') {
      ['bullets', 'javelins'].forEach(function (id) {
        var it = C.ITEMS[id], unit = C.AMMO[id].pack;
        rows.push({ icon: it.icon, name: it.name + ' x' + unit, desc: 'You have ' + L.countItem(s, id) + '. One a ' + (id === 'bullets' ? 'shot' : 'throw') + '.',
          buttons: [1, 10].map(function (n, i) {
            var price = it.price * n;
            return { label: (n > 1 ? 'x' + n + ' ' : 'Buy ') + commas(price) + 'G', color: s.gold >= price ? (i ? BLUE_BTN : GREEN_BTN) : GREY_BTN,
              cb: function () { done(L.buyAmmo(s, id, n), commas(unit * n) + ' ' + it.name.toLowerCase() + '.'); } };
          }),
          amount: { start: 1, max: 999, price: function (n) { return it.price * n; }, word: function (n) { return commas(unit * n) + ' ' + it.name.toLowerCase(); },
            buy: function (n) { done(L.buyAmmo(s, id, n), commas(unit * n) + ' ' + it.name.toLowerCase() + '.'); } } });
      });
    } else {
      var fix = self.boomerangRow(s, function () { again(); });
      if (fix) rows.push(fix);
    }
    this.listPanel({
      title: opts.title || 'The Armory', tab: tab, page: page, rows: rows,
      tabs: [['arms', 'Weapons'], ['ammo', 'Ammo'], ['fix', 'Repairs']],
      corner: opts.back ? { label: 'Back', color: GREY_BTN, cb: function () { self.closeModal(); opts.back(); } } : null,
      sub: function () { return 'Gold ' + commas(s.gold) + '     Lumber ' + (s.lumber || 0); },
      empty: 'Bring your Boomerang here when it wears out.',
      reopen: function (t, p) { self.openArmory(Object.assign({}, opts, { tab: t, page: p })); },
    });
  };
  // The boomerang's repair, back to full (the Armory's Repairs, Bram's Forge): a row, or null with no boomerang
  U.boomerangRow = function (s, after) {
    if (!L.hasWeapon(s, 'boomerang')) return null;
    var self = this, cost = L.repairCost(s), left = L.throwsLeft(s), most = L.throwsMax(s);
    var ok = cost && s.gold >= cost.gold && cost.needs.every(function (n) { return L.weaponHave(s, n[0]) >= n[1]; });
    return { icon: L.iconOf(s, 'boomerang'), name: 'Fix your ' + L.itemName(s, 'boomerang'),
      desc: left + ' of ' + most + ' throws left.' + (cost ? ' Back to ' + most + ': ' + needText(s, cost.needs) + '.' : ' Like new!'),
      buttons: cost ? [{ label: commas(cost.gold) + 'G', color: ok ? GREEN_BTN : GREY_BTN, cb: function () {
        var r = L.repairBoomerang(s);
        if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
        if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, cost.needs) + '.'); }
        if (r !== 'ok') return null;
        sfx('anvil');
        F.world.changed();
        F.world.save();
        F.bus.emit('hud');
        self.toast('Good as new! ' + most + ' throws.', 2400, 0x2f5a22);
        if (after) after();
        return null;
      } }] : [] };
  };
  // rows added to a panel while `fn` opens it (as 19zz-farmtech.js adds the Forge's sprinklers)
  var withRows = function (ui, extra, fn) {
    var lp = ui.listPanel;
    ui.listPanel = function (o) { o.rows = o.rows.concat(extra(o)); return lp.call(this, o); };
    try { return fn(); } finally { if (ui.hasOwnProperty('listPanel')) delete ui.listPanel; }
  };
  // Bram fixes a boomerang (only someone who has one sees the row)
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this, s = F.session.state;
    if (!L.hasWeapon(s, 'boomerang')) return openForge.call(this, page);
    return withRows(this, function () { var r = self.boomerangRow(s, function () { self.closeModal(); self.openForge(page); }); return r ? [r] : []; }, function () { return openForge.call(self, page); });
  };
  // For now (until Manila's Armory): a way in from Kanor's Lodge, only with window.gameHost.devWeapons (tests, dev).
  var openKanor = U.openKanor;
  U.openKanor = function (tab, page) {
    var self = this;
    if (!dev() || (tab && tab !== 'buy')) return openKanor.apply(this, arguments);
    return withRows(this, function () {
      return [{ icon: C.wpnIcon('rifle_0'), name: 'Armory (test)', desc: 'Rifle, Javelin, Boomerang, their ammo and repairs. Not for players yet.',
        buttons: [{ label: 'Open', color: BLUE_BTN, cb: function () { self.closeModal(); self.openArmory({ back: function () { self.openKanor('buy', 0); } }); } }] }];
    }, function () { return openKanor.call(self, tab, page); });
  };
})(window.Farm = window.Farm || {});
