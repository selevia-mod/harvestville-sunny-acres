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
  var SIDE_GRIP = [[33, 199], [43, 199], [36, 199]];
  var POSE = {
    down: { row: 0, grip: [[170, 231], [179, 232], [180, 230]] },
    up: { row: 1, grip: [[92, 49], [86, 49], [94, 48]], behind: true },
    left: { row: 2, grip: SIDE_GRIP },
    right: { row: 2, grip: SIDE_GRIP, flip: true },
  };
  var LET_GO = 2;
  var HELD_LEN = { rifle: 1.15, javelin: 1.5, boomerang: 0.5 }; // tiles

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
  var whyNot = function (k) { return 'The ' + W[k].name + ' is for the hunting grounds past Manila.'; };

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
    var t = F.weaponTexture(w, k, lv), len = HELD_LEN[k] * T, sc = len / t.w;
    return w.add.image(x, y, t.key).setOrigin(t.grip, 0.5).setScale(sc).setRotation(k === 'boomerang' ? ang - Math.PI / 2 : ang)
      .setFlipY(k !== 'boomerang' && Math.cos(ang) < 0); // (pointing left: the right way up)
  };
  var glowAt = function (w, x, y, r, depth) {
    return w.add.circle(x, y, r, F.WPN_GLOW, 0.32).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  };
  // where the fist is in this pose, in the world
  var gripAt = function (p, dir, stage) {
    var at = POSE[dir], side = at.flip ? -1 : 1, g = at.grip[stage];
    return { x: p.x + (g[0] - 144) * side, y: p.y + g[1] - 192 };
  };
  // The farmer in their pose with the weapon (the archer sheets as stand-ins), turned to the animal while it lasts.
  var posePut = function (w, sh) {
    var p = w.player, at = POSE[sh.dir], pt = sh.body ? gripAt(p, sh.dir, sh.stage) : { x: p.x + Math.cos(sh.ang) * 0.3 * T, y: p.y - 0.15 * T };
    var a = sh.target;
    if (a && a.hp > 0 && a.img.active && sh.stage !== LET_GO) sh.ang = Math.atan2((a.y - 0.3 * a.def.w * T) - pt.y, a.x - pt.x);
    var kick = sh.kick || 0;
    pt = { x: pt.x - Math.cos(sh.ang) * kick, y: pt.y - Math.sin(sh.ang) * kick };
    sh.grip = pt;
    if (sh.held) sh.held.setPosition(pt.x, pt.y).setRotation(sh.k === 'boomerang' ? sh.ang - Math.PI / 2 + (sh.spin || 0) : sh.ang).setFlipY(sh.k !== 'boomerang' && Math.cos(sh.ang) < 0);
    if (sh.glow) sh.glow.setPosition(pt.x + Math.cos(sh.ang) * 0.3 * T, pt.y + Math.sin(sh.ang) * 0.3 * T);
    if (sh.body) {
      var frame = at.row * 3 + sh.stage;
      sh.body.setPosition(p.x, p.y).setFrame(frame).setFlipX(!!at.flip);
      if (sh.fist) { var g = at.grip[sh.stage]; sh.fist.setPosition(p.x, p.y).setFrame(frame).setFlipX(!!at.flip).setCrop(g[0] - 30, g[1] - 30, 60, 60); }
    }
  };
  var poseEnd = function (w, sh) {
    [sh.body, sh.fist, sh.held, sh.glow].forEach(function (o) { if (o && o.active) o.destroy(); });
    sh.held = sh.glow = null;
    if (w.wpnShot === sh) w.wpnShot = null;
    if (w.player && w.player.active) w.player.setVisible(true);
  };
  // the tip of the weapon in the hand: where the shot leaves
  var tipOf = function (sh) {
    var t = F.weaponTexture(F.world, sh.k, sh.lv), len = HELD_LEN[sh.k] * T, out = (t.tip - t.grip) * len;
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
    var d = this.dirVec(), at = POSE[this.dir], key = F.weaponPoseKey(k), depth = p.depth + (at.behind ? -0.001 : 0.001), how = SHOT[k];
    p.anims.stop();
    var sh = this.wpnShot = { k: k, lv: lv, dir: this.dir, target: target, ang: Math.atan2(d[1], d[0]), stage: key ? how.stage : 0, broke: r === 'broke' };
    if (key) {
      F.ensureTexture(this, key);
      sh.body = this.add.image(p.x, p.y, key, 0).setDepth(p.depth);
      if (!at.behind) sh.fist = this.add.image(p.x, p.y, key, 0).setDepth(depth + 0.0003);
      p.setVisible(false);
    }
    sh.held = heldImage(this, k, lv, p.x, p.y, sh.ang).setDepth(depth);
    if (L.weaponMoon(k, lv)) sh.glow = glowAt(this, p.x, p.y, 0.7 * T, depth - 0.0005);
    posePut(this, sh);
    this.acting = W[k].still;
    this.wpnNext = this.time.now + L.weaponGap(k);
    sfx(k === 'rifle' ? 'cast' : 'swoosh');
    this.time.delayedCall(how.at, function () { if (self.wpnShot === sh) self.weaponLoose(sh); });
    // a boomerang wearing out: a word at 20 throws left; its last throw flies, and it breaks as it comes back
    if (r === 'warn') F.ui.toast('Your Boomerang has ' + W.boomerang.warn + ' throws left. Bram can fix it at the Forge.', 3000, 0x7a5a12);
    F.bus.emit('hud');
    this.changed();
  };

  P.weaponLoose = function (sh) {
    // (it leaves from the hand, so an animal right in front is not flown past; the Rifle's round shows from the muzzle on)
    var self = this, k = sh.k, range = L.weaponRange(k, sh.lv) * T, tip = tipOf(sh), from = sh.grip;
    sh.stage = sh.body ? LET_GO : 0;
    if (k === 'rifle') { // a pop, a puff, and the kick
      sfx('smash');
      this.wpnPuff(tip.x, tip.y, sh.lv);
      this.tweens.addCounter({ from: 1, to: 0, duration: 200, onUpdate: function (tw) { sh.kick = 14 * tw.getValue(); if (self.wpnShot === sh) posePut(self, sh); } });
    } else {
      sfx('bowshot');
      if (sh.held) sh.held.setVisible(false); // (it is in the air now)
      if (sh.glow) sh.glow.setVisible(false);
    }
    posePut(this, sh);
    this.wpnFly({ k: k, lv: sh.lv, x: from.x, y: from.y, ang: sh.ang, range: range, shown: false, broke: sh.broke, hide: k === 'rifle' ? Math.hypot(tip.x - from.x, tip.y - from.y) : 0 });
    this.tellArrow({ x: Math.round(from.x), y: Math.round(from.y), a: sh.ang, l: L.shotRange(range, k), b: sh.lv });
    var rest = Math.max(60, W[k].still - SHOT[k].at);
    this.time.delayedCall(rest, function () { if (self.wpnShot === sh) { poseEnd(self, sh); self.idle(); } });
  };

  // the Rifle's puff at the muzzle (cheap: a few soft circles)
  P.wpnPuff = function (x, y, lv) {
    var moon = !!L.weaponMoon('rifle', lv), n = cheap() ? 2 : 4;
    for (var i = 0; i < n; i++) {
      var c = this.add.circle(x, y, (0.1 + Math.random() * 0.06) * T, moon ? F.WPN_GLOW : 0xfff3d6, 0.85).setDepth(DEPTH.fx + 0.02);
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
      sh.img = this.add.image(o.x, o.y, F.bulletTexture(this, o.lv)).setDisplaySize(0.2 * T, 0.2 * T).setDepth(DEPTH.fx).setVisible(!sh.hide);
      sh.streak = this.add.rectangle(o.x, o.y, 1, moon ? 16 : 10, moon ? F.WPN_GLOW : 0xfff3d6, moon ? 0.9 : 0.7).setOrigin(1, 0.5).setRotation(o.ang).setDepth(DEPTH.fx - 0.001).setVisible(!sh.hide);
    } else {
      var t = F.weaponTexture(this, o.k, o.lv), len = HELD_LEN[o.k] * T;
      sh.img = this.add.image(o.x, o.y, t.key).setScale(len / t.w).setDepth(DEPTH.fx).setRotation(o.k === 'boomerang' ? 0 : o.ang).setFlipY(o.k === 'javelin' && c < 0)
        .setOrigin(o.k === 'javelin' ? 0.97 : 0.5, 0.5); // (a javelin's point leads: it is where it hits)
      sh.shade = this.add.ellipse(o.x, o.y, (o.k === 'javelin' ? 0.9 : 0.4) * T, 0.12 * T, 0x000000, 0.22).setDepth(DEPTH.shadow).setRotation(o.k === 'javelin' ? o.ang * 0.25 : 0);
    }
    if (moon) sh.glow = glowAt(this, o.x, o.y, (o.k === 'rifle' ? 0.3 : 0.5) * T, DEPTH.fx - 0.002);
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
    if (sh.moon && sh.glow) sh.glow.setPosition(sh.x, sh.y - (sh.h || 0));
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
        if (sh.k === 'javelin') return this.wpnStick(sh, 260);
        drop(this, sh);
        return false;
      }
      if (sh.went >= sh.range) {
        if (sh.k === 'javelin') return this.wpnStick(sh, 520);
        if (this.bits) this.bits.dust.explode(2, sh.x, sh.y);
        drop(this, sh);
        return false;
      }
    }
    if (sh.k === 'rifle') {
      var out = sh.went - sh.hide;
      sh.img.setPosition(sh.x, sh.y).setVisible(out > 0);
      sh.streak.setPosition(sh.x, sh.y).setSize(Math.max(1, Math.min(out, 2.2 * T)), sh.streak.height).setVisible(out > 0);
    } else { // the javelin's arc: up and down again over its reach, its point following the path
      var u = Math.min(1, sh.went / sh.range), H = (0.3 + 0.07 * sh.range / T) * T, h = 4 * H * u * (1 - u), dh = 4 * H * (1 - 2 * u) / sh.range * speed;
      sh.h = h;
      sh.img.setPosition(sh.x, sh.y - h).setRotation(Math.atan2(sh.s * speed - dh, sh.c * speed)).setFlipY(sh.c < 0);
      sh.shade.setPosition(sh.x, sh.y + 0.05 * T);
    }
    return true;
  };
  // a javelin stands where it came down for a moment, then fades
  P.wpnStick = function (sh, ms) {
    var img = sh.img;
    if (sh.streak) sh.streak.destroy();
    if (sh.glow) sh.glow.destroy();
    if (this.bits) this.bits.dust.explode(2, sh.x, sh.y + 0.1 * T);
    if (sh.shade) sh.shade.destroy();
    if (img && img.active) {
      img.setPosition(sh.x, sh.y - 0.15 * T).setRotation(sh.c < 0 ? -2.3 : -0.85).setFlipY(false).setDepth(DEPTH.actor + sh.y / 1e5);
      this.tweens.add({ targets: img, alpha: 0, delay: ms, duration: 220, onComplete: function () { img.destroy(); } });
    }
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
    if (Math.floor(time / 250) !== this.wpnChipAt) { this.wpnChipAt = Math.floor(time / 250); this.weaponChip(); }
  };

  // ---------- friends' shots ----------
  // (their 'ar': the weapon is in its range's low bits; a Bow's shot has none). Their farmer stays as they are; their
  // weapon shows a moment where the shot leaves, and the shot flies (it hits nothing on this phone: theirs tells).
  P.wpnRemote = function (x, y, ang, l, lv, k, who) {
    lv = Math.max(0, Math.min(5, Math.floor(Number(lv)) || 0));
    var range = Math.max(T, Math.min(8 * T, Math.floor(l / 8) * 8));
    var img = heldImage(this, k, lv, x - Math.cos(ang) * 0.4 * T, y - Math.sin(ang) * 0.4 * T, ang).setDepth(DEPTH.fx);
    this.tweens.add({ targets: img, alpha: 0, delay: k === 'rifle' ? 260 : 80, duration: 200, onComplete: function () { img.destroy(); } });
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

  F.bus.on('hud', function () { var w = F.world; if (w && w.sys && w.sys.isActive() && w.state) w.weaponChip(); }); // (at once when you switch)

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
