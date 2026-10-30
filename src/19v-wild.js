// The Wild Lands in the world (owner, 30 Oct 2026; content 00-wild.js, rules 01-logicD.js): the animals roam the
// map, run from you (shy ones: sneak up slowly with the joystick only part way) or charge you (a boar, a wolf), and new
// ones walk in from the edges while you are there. They leave footprints that fade. Hold the Bow: a ring marks the
// animal you would hit (the nearest one ahead, in range) and Shoot turns you to it. A tough one shows a health bar once
// hit. Each has its own size (a big one looks it); a hunted animal leaves meat and the like on the ground: walk over it to
// pick it up (what is left goes in your bag when you leave). Bait draws a shy animal to eat. Kanor stands by his Lodge
// in Pulag (6 AM to 10 PM): Bow, upgrades, arrows, bait, today's request, trophies; he buys what you hunt. Makiling
// Forest opens after 10 hunts. Hunting is your own trip: not while visiting a friend.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var FRAME_H = 252, FEET = 233; // a wild.png frame, and its feet line (tools/art/animals3q-import.js)
  var BAR_W = 180, BAR_H = 22, HIT_MS = 180;
  var ARROW_SPEED = 16 * T; // world units a second
  var GREEN_BTN = 0x5fa84a, GREY_BTN = 0xa08a68;

  // An animal's 12 frames, drawn from above like the farmer: 0-2 walking toward you, 3-5 away, 6-8 to the left (stand,
  // step, step), 9 facing you (alert; the wolf howls), 10 eating or sniffing, 11 running or flying away. 6-8, 10 and 11
  // face left: flipped for the right.
  var FACING = { down: 0, up: 3, side: 6 }, STEPS = [1, 0, 2, 0];
  var frameOf = function (kind, k) { return WI.order.indexOf(kind) * 12 + k; };

  // Standing on the ground (owner, 30 Oct: "they look like they are floating"): assets/wildshade has the shadow of each
  // frame, a dark patch under every foot and a soft shape joining them (the feet are not on one line in this view: the
  // far legs stand higher). It stays down when the animal leaves the ground: the rabbit hops, a leap, a flying labuyo.
  // The others keep their feet on the ground as they walk. They breathe while they stand; dust where a running foot lands.
  var softShadow = function (scene) { // (for what lies on the ground)
    if (scene.textures.exists('fx-wildshadow')) return;
    var c = scene.textures.createCanvas('fx-wildshadow', 128, 128), g = c.getContext(), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.42)');
    gr.addColorStop(0.8, 'rgba(0,0,0,0.16)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    c.refresh();
  };
  var mine = function () { return F.session.state; };

  // ---------- setting up a wild place ----------
  var create = P.create;
  P.create = function () {
    this.wild = null;
    this.wildDrops = [];
    this.wildArrows = [];
    this.wildBait = null;
    this.kanor = null;
    create.call(this);
    if (!L.isWildMap(this.mapKey) || F.session.visit) return;
    this.setupWild();
    if (this.mapKey === 'pulag') this.setupKanor();
    if (this.mapKey === 'pulag' && !(window.gameHost && window.gameHost.quiet)) {
      var self = this;
      this.time.delayedCall(1200, function () {
        if (!self.sys || !self.sys.isActive() || !F.ui || F.ui.modals.length) return;
        if (L.takeTip(self.state, 'wild')) { self.save(); return F.ui.wildIntro(); }
        // once a day: what Kanor wants
        var j = L.wildJob(self.state);
        if (F.session.jobSaid !== self.state.day && !j.done) {
          F.session.jobSaid = self.state.day;
          F.ui.toast('Kanor needs ' + j.n + ' ' + C.ITEMS[j.item].name + ' today: ' + j.gold + 'G.', 3000);
        }
      });
    }
  };

  P.setupWild = function () {
    var self = this, s = this.state, zone = this.objects.filter(function (o) { return o.type === 'wild'; })[0];
    if (!zone) return;
    F.ensureTexture(this, 'wild');
    F.ensureTexture(this, 'wildshade');
    softShadow(this);
    printTexture(this);
    arrowTexture(this);
    this.wild = { zone: zone, animals: [], next: rand(WI.arrive[0], WI.arrive[1]), prints: [], ring: this.add.image(0, 0, 'fx-ring').setVisible(false).setDepth(DEPTH.shadow + 0.1).setTint(0xffd24a),
      hint: this.add.image(0, 0, 'fx-huntarrow').setVisible(false).setDepth(DEPTH.fx).setScale(1.2) };
    var f = this.feet(), rare = null;
    L.wildHere(s, this.mapKey).forEach(function (e) {
      var p = self.wildSpot(zone, f, 6);
      if (!p) return;
      var a = self.addWildAnimal(e.kind, e.slot, p.x, p.y);
      if (a.def.rare) rare = a;
    });
    if (rare && !(window.gameHost && window.gameHost.quiet)) this.time.delayedCall(1800, function () { if (F.ui) F.ui.toast('Something rare is about: a ' + rare.def.name + '!', 3200, 0x7a5a12); });
  };

  // New animals walk in from the edges while you are there, one at a time, if any are due.
  P.wildArrive = function (dt) {
    var w = this.wild, s = this.state;
    w.next -= dt;
    if (w.next > 0) return;
    w.next = rand(WI.arrive[0], WI.arrive[1]);
    var here = {};
    w.animals.forEach(function (a) { here[a.slot] = true; });
    var due = L.wildHere(s, this.mapKey).filter(function (e) { return !here[e.slot]; });
    if (!due.length) return;
    var e = due[Math.floor(Math.random() * due.length)], p = this.wildEdge(w.zone);
    if (!p) return;
    var a = this.addWildAnimal(e.kind, e.slot, p.x, p.y), z = w.zone;
    var ang = Math.atan2((z.y0 + z.y1) / 2 * T - p.y, (z.x0 + z.x1) / 2 * T - p.x);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * a.def.walk * T;
    a.vy = Math.sin(ang) * a.def.walk * T;
    a.t = rand(2500, 5000);
    a.img.setAlpha(0);
    a.sh.setAlpha(0);
    a.fade = 0;
  };
  // A free tile along the edge of the zone, out of your sight (or null).
  P.wildEdge = function (z) {
    var f = this.feet();
    for (var tries = 0; tries < 60; tries++) {
      var side = Math.random() < 0.5, far = Math.random() < 0.5;
      var x = side ? (far ? z.x1 : z.x0) : z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1));
      var y = side ? z.y0 + Math.floor(Math.random() * (z.y1 - z.y0 + 1)) : (far ? z.y1 : z.y0);
      if (!this.wildFree(x, y)) continue;
      var wx = (x + 0.5) * T, wy = (y + 0.7) * T;
      if (Math.hypot(wx - f.x, wy - f.y) >= 6 * T) return { x: wx, y: wy };
    }
    return null;
  };

  // Footprints: a pair every half tile or so, fading out over 30 seconds. They follow the animal, so they lead to it.
  var printTexture = function (scene) {
    if (scene.textures.exists('fx-print')) return;
    var c = scene.textures.createCanvas('fx-print', 64, 64), g = c.getContext();
    g.fillStyle = '#2e1c0c';
    [[20, 22], [44, 42]].forEach(function (p) {
      g.beginPath();
      g.ellipse(p[0], p[1], 8, 12, 0, 0, Math.PI * 2);
      g.fill();
    });
    c.refresh();
  };
  var PRINT_MAX = 44, PRINT_MS = 30000, PRINT_ALPHA = 0.42;
  P.wildPrint = function (a) {
    var list = this.wild.prints, p = list.length >= PRINT_MAX ? list.shift() : { img: this.add.image(0, 0, 'fx-print').setDepth(DEPTH.flat) };
    var size = Math.max(0.45, a.def.w * 0.55) * a.size;
    p.img.setPosition(a.x, a.y - 8).setRotation(Math.atan2(a.vy, a.vx) + Math.PI / 2).setScale(size).setAlpha(PRINT_ALPHA);
    p.left = PRINT_MS;
    list.push(p);
  };
  P.updatePrints = function (dt) {
    this.wild.prints.forEach(function (p) {
      p.left -= dt;
      p.img.setAlpha(Math.max(0, p.left / PRINT_MS) * PRINT_ALPHA);
    });
  };

  // The ring under the animal you would hit; and with the Bow in hand and nothing on screen, an arrow beside you
  // pointing to the nearest animal (the places are far bigger than the screen).
  var arrowTexture = function (scene) {
    if (scene.textures.exists('fx-huntarrow')) return;
    var c = scene.textures.createCanvas('fx-huntarrow', 96, 96), g = c.getContext();
    g.beginPath();
    g.moveTo(48, 8); g.lineTo(84, 78); g.lineTo(48, 62); g.lineTo(12, 78); g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 8;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.fillStyle = '#4fae3c';
    g.fill();
    c.refresh();
  };
  P.updateAim = function (time) {
    var w0 = this.wild, ring = w0.ring, hint = w0.hint, held = L.held(this.state), bow = held && held.id === 'bow', a = bow ? this.wildTarget() : null;
    ring.setVisible(!!a);
    if (a) {
      var w = (0.55 + a.def.w * 0.55) * a.size * T * (1 + Math.sin(time / 160) * 0.05);
      ring.setPosition(a.x, a.y - 0.08 * T).setDisplaySize(w, w * 0.46);
    }
    var f = this.feet(), view = this.cameras.main.worldView, near = null, bd = Infinity;
    if (bow) w0.animals.forEach(function (x) {
      var d = Math.hypot(x.x - f.x, x.y - f.y);
      if (d < bd) { bd = d; near = x; }
    });
    var show = !!near && !view.contains(near.x, near.y - 0.3 * T);
    hint.setVisible(show);
    if (!show) return;
    var ang = Math.atan2(near.y - f.y, near.x - f.x), r = (1.5 + Math.sin(time / 220) * 0.12) * T;
    hint.setPosition(f.x + Math.cos(ang) * r, f.y - 0.5 * T + Math.sin(ang) * r).setRotation(ang + Math.PI / 2);
  };

  // A free tile in the zone at least `away` tiles from `from`: its middle, in world units (or null).
  P.wildSpot = function (zone, from, away) {
    for (var tries = 0; tries < 80; tries++) {
      var x = zone.x0 + Math.floor(Math.random() * (zone.x1 - zone.x0 + 1)), y = zone.y0 + Math.floor(Math.random() * (zone.y1 - zone.y0 + 1));
      if (!this.wildFree(x, y)) continue;
      var wx = (x + 0.5) * T, wy = (y + 0.7) * T;
      if (from && Math.hypot(wx - from.x, wy - from.y) < away * T) continue;
      return { x: wx, y: wy };
    }
    return null;
  };
  P.wildFree = function (x, y) {
    var z = this.wild && this.wild.zone;
    if (z && (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1)) return false;
    return this.inMap(x, y) && this.walkable(x, y) && !this.blocked[this.idx(x, y)];
  };

  P.addWildAnimal = function (kind, slot, x, y) {
    var def = WI.animals[kind], size = def.rare ? 1 : L.wildSize(Math.random), scale = def.w * T / def.px * size;
    var a = {
      kind: kind, slot: slot, def: def, hp: def.hp, x: x, y: y, vx: 0, vy: 0, mode: 'idle', t: rand(300, 2500), cool: 0, step: 0,
      dir: 'side', left: Math.random() < 0.5, look: false, fr: FACING.side, lift: 0, breath: rand(0, 6), scale: scale, size: size, trail: 0, hitT: 0, glow: 0,
      img: this.add.image(x, y, 'wild', frameOf(kind, FACING.side)).setOrigin(0.5, FEET / FRAME_H).setScale(scale),
      sh: this.add.image(x, y, 'wildshade', frameOf(kind, FACING.side)).setOrigin(0.5, FEET / FRAME_H).setScale(scale).setDepth(DEPTH.shadow),
    };
    a.img.setFlipX(!a.left);
    a.sh.setFlipX(!a.left);
    this.wild.animals.push(a);
    this.drawWild(a);
    return a;
  };

  P.drawWild = function (a, dt) {
    var up = Math.min(0.55, a.lift / T), seen = 1; // off the ground: the shadow shrinks and fades
    if (a.fade != null) { // walking in
      a.fade += dt || 0;
      seen = Math.min(1, a.fade / 700);
      a.img.setAlpha(seen);
      if (seen >= 1) a.fade = null;
    }
    a.sh.setPosition(a.x, a.y).setScale(a.scale * (1 - up * 0.5)).setAlpha((1 - up) * seen);
    a.img.setPosition(a.x, a.y - a.lift);
    F.depthTo(a.img, DEPTH.actor + a.y / 1e5);
    if (a.bar) {
      var by = a.y - a.lift - (0.42 + a.def.w * 0.62) * a.size * T;
      a.bar.bg.setPosition(a.x, by);
      a.bar.fill.setPosition(a.x - BAR_W / 2, by).setSize(BAR_W * Math.max(0, a.hp) / a.def.hp, BAR_H);
    }
  };

  // ---------- every frame ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.wild || this.busy || !this.sys.isActive()) return;
    var dt = Math.min(delta, 100);
    var frozen = !F.ui || F.ui.blocking();
    var self = this;
    this.wild.animals.slice().forEach(function (a) { self.updateWild(a, dt, frozen); });
    this.updateArrows(dt);
    this.updatePrints(dt);
    this.updateAim(time);
    if (!frozen) { this.pickWildDrops(); this.wildArrive(dt); }
    if (this.wildBait && Date.now() > this.wildBait.until) { this.wildBait.img.destroy(); this.wildBait = null; }
    if (this.kanor) this.updateKanor();
  };

  P.updateWild = function (a, dt, frozen) {
    var f = this.feet(), dx = a.x - f.x, dy = a.y - f.y, d = Math.hypot(dx, dy) / T, def = a.def;
    var speed = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y), sneaking = speed < C.SPEED * 0.6;
    a.t -= dt;
    a.cool = Math.max(0, a.cool - dt);
    if (!frozen) {
      if (def.shy && a.mode !== 'flee' && d < def.shy * (sneaking ? 0.55 : 1) && !(a.mode === 'eat' && d > 1.4)) this.wildFlee(a, f);
      else if (def.angry && a.mode !== 'charge' && !a.cool && d < def.angry) this.wildCharge(a);
      if (a.mode === 'charge') {
        var len = Math.max(1, Math.hypot(dx, dy));
        a.vx = -dx / len * def.run * T;
        a.vy = -dy / len * def.run * T;
        if (d < 0.7) this.wildHit(a);
      }
    }
    if (a.mode === 'toBait' && this.wildBait) {
      var bx = this.wildBait.x - a.x, by = this.wildBait.y - a.y, bl = Math.hypot(bx, by);
      if (bl < 0.4 * T) { a.mode = 'eat'; a.vx = a.vy = 0; a.t = WI.baitMins * 60000; }
      else { a.vx = bx / bl * def.walk * T * 1.6; a.vy = by / bl * def.walk * T * 1.6; }
    }
    if (a.t <= 0) this.wildDecide(a);
    // move, around walls (a flying labuyo goes over them)
    if (a.vx || a.vy) {
      var nx = a.x + a.vx * dt / 1000, ny = a.y + a.vy * dt / 1000;
      var ok = def.flies && a.mode === 'flee' ? this.wildInZone(nx, ny) : this.wildFree(Math.floor(nx / T), Math.floor(ny / T));
      if (ok) { a.x = nx; a.y = ny; } else if (a.mode === 'flee' || a.mode === 'charge') { a.vx = -a.vx * 0.5; a.vy = rand(-1, 1) * def.run * T; } else { a.vx = a.vy = 0; a.t = Math.min(a.t, 400); }
      // the way it faces: sideways, or toward / away from you (a little give, so it does not flicker on a slant)
      var ax = Math.abs(a.vx), ay = Math.abs(a.vy);
      if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = a.vy > 0 ? 'down' : 'up';
      if (ax > 4) a.left = a.vx < 0;
      a.step += dt;
      if (ok && !(def.flies && a.mode === 'flee')) {
        a.trail += Math.hypot(a.vx, a.vy) * dt / 1000;
        if (a.trail > 0.6 * T) { a.trail = 0; this.wildPrint(a); }
      }
    }
    var fr = this.wildPose(a, d), was = a.fr, flip = fr >= 6 && fr !== 9 && !a.left;
    a.fr = fr;
    a.img.setFrame(frameOf(a.kind, fr)).setFlipX(flip);
    a.sh.setFrame(frameOf(a.kind, fr)).setFlipX(flip);
    this.wildFeel(a, was, dt);
    this.drawWild(a, dt);
  };

  // Off the ground (a hop, a leap, a flight), its breathing, and dust when it runs.
  P.wildFeel = function (a, was, dt) {
    var def = a.def, moving = a.vx || a.vy, fast = a.mode === 'flee' || a.mode === 'charge', fr = a.fr, lift = 0;
    if (moving && def.flies && a.mode === 'flee') lift = 0.45 * T + Math.sin(a.step / 90) * 0.04 * T;
    else if (moving && fast && a.dir === 'side' && !def.ground) lift = 0.12 * T * def.w * Math.max(0, Math.sin((a.step % 260 - 130) / 130 * Math.PI)); // up on frame 11 only
    else if (moving && def.hop) lift = def.hop * T * Math.abs(Math.sin(a.step / (fast ? 110 : 180) * Math.PI / 2));
    a.lift = lift;
    // breathing while it stands (it grows from its feet, so they stay put)
    var b = moving || dt == null ? 0 : Math.sin((a.breath += dt / 520)), squash = 0;
    if (a.hitT > 0) { a.hitT -= dt; squash = Math.max(0, a.hitT / HIT_MS) * 0.16; } // struck: it flinches
    a.img.setScale(a.scale * (1 - b * 0.006 + squash), a.scale * (1 + b * 0.018 - squash));
    // something rare glitters
    if (def.rare && (a.glow -= dt) <= 0) {
      a.glow = rand(180, 420);
      var spark = this.add.circle(a.x + rand(-0.5, 0.5) * def.w * T, a.y - a.lift - rand(0.1, 0.9) * def.w * T, rand(10, 18), a.kind === 'goldboar' ? 0xffe28a : 0xffffff).setDepth(DEPTH.fx).setAlpha(0.9);
      this.tweens.add({ targets: spark, y: spark.y - rand(40, 90), alpha: 0, scale: 0.4, duration: rand(500, 800), onComplete: function (tw, t) { t[0].destroy(); } });
    }
    // dust: where a running foot lands
    if (this.bits && fast && fr !== was && !(def.flies && a.mode === 'flee')) {
      var land = a.dir === 'side' ? fr === 7 : fr % 3 !== 0;
      if (land) this.bits.dust.explode(def.w > 1.2 ? 2 : 1, a.x + (a.dir === 'side' ? (a.left ? 1 : -1) * 0.25 * def.w * T : 0), a.y);
    }
  };

  // Which of its 12 frames an animal shows: eating, looking up at you when you come near (or now and then), walking
  // with its steps, or running away / charging in long leaps when it goes sideways.
  P.wildPose = function (a, d) {
    var def = a.def, fast = a.mode === 'flee' || a.mode === 'charge';
    if (!(a.vx || a.vy)) {
      if (a.mode === 'eat' || a.mode === 'graze') return 10;
      if (a.mode === 'idle' && (a.look || d < (def.shy || def.angry) * 1.8)) return 9;
      return FACING[a.dir];
    }
    if (def.flies && a.mode === 'flee') return 11;
    if (fast && a.dir === 'side') return Math.floor(a.step / 130) % 2 ? 11 : 7;
    return FACING[a.dir] + STEPS[Math.floor(a.step / (fast ? 110 : 180)) % 4];
  };

  P.wildInZone = function (x, y) {
    var z = this.wild.zone;
    return x >= z.x0 * T && x <= (z.x1 + 1) * T && y >= z.y0 * T && y <= (z.y1 + 1) * T;
  };

  // What an animal does next when it has nothing on: stand or graze a while, or wander a few tiles.
  P.wildDecide = function (a) {
    if (a.mode === 'eat' || a.mode === 'toBait') { a.mode = 'idle'; }
    if (a.mode === 'charge') a.cool = 4000;
    var r = Math.random();
    a.look = false;
    if (r < 0.45) { a.mode = r < 0.25 ? 'graze' : 'idle'; a.look = r > 0.38; a.vx = a.vy = 0; a.t = rand(1500, 4500); return; }
    var ang = rand(0, Math.PI * 2);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * a.def.walk * T;
    a.vy = Math.sin(ang) * a.def.walk * T * 0.7;
    a.t = rand(1200, 3200);
  };

  P.wildFlee = function (a, f) {
    var ang = Math.atan2(a.y - f.y, a.x - f.x) + rand(-0.5, 0.5);
    a.mode = 'flee';
    a.vx = Math.cos(ang) * a.def.run * T;
    a.vy = Math.sin(ang) * a.def.run * T;
    a.t = rand(1800, 2600);
  };

  P.wildCharge = function (a) {
    a.mode = 'charge';
    a.t = 2600;
    sfx('nope');
  };

  // A charge reached you: energy lost, a bump, and it backs off a while.
  P.wildHit = function (a) {
    var s = this.state, f = this.feet(), dx = f.x - a.x, dy = f.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
    s.energy = Math.max(0, s.energy - a.def.hit);
    this.floatTextAt(f.x, f.y - 1.6 * T, '-' + a.def.hit + ' energy');
    this.cameras.main.shake(160, 0.004);
    var nx = f.x + dx / len * 0.6 * T, ny = f.y + dy / len * 0.6 * T;
    if (this.walkable(Math.floor(nx / T), Math.floor(ny / T))) this.setFeet(nx, ny);
    a.mode = 'walk';
    a.vx = -dx / len * a.def.walk * T;
    a.vy = -dy / len * a.def.walk * T;
    a.t = 2500;
    a.cool = 5000;
    F.bus.emit('hud');
    this.changed();
    if (s.energy <= 0) this.faint();
  };

  // ---------- the Bow ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.wild || this.kanor) {
      var self = this, s = this.state, held = L.held(s);
      if (this.kanor && this.kanor.img.visible) {
        var pt = this.front(0.7);
        if (Math.hypot(pt.x - this.kanor.x, pt.y - this.kanor.y) < 0.9 * T) return { label: 'Talk', icon: C.ICON.bow, run: function () { self.talkKanor(); } };
      }
      if (this.wild && held && held.id === 'bow') return { label: 'Shoot', icon: L.iconOf(s, 'bow'), run: function () { self.shoot(); } };
      if (this.wild && held && held.id === 'bait') return { label: 'Put down', icon: C.ICON.bait, run: function () { self.putBait(); } };
    } else {
      var h = L.held(this.state);
      if (h && h.id === 'bow') return { label: 'Shoot', icon: L.iconOf(this.state, 'bow'), disabled: true, why: 'Hunt in Pulag Grassland, past the west end of town.' };
    }
    return resolve.call(this);
  };

  // The nearest animal ahead of you (within 60 degrees) and in range, or null.
  P.wildTarget = function () {
    var f = this.feet(), d = this.dirVec(), range = L.bowRange(this.state) * T, best = null, bd = range;
    (this.wild ? this.wild.animals : []).forEach(function (a) {
      var ax = a.x - f.x, ay = (a.y - 0.3 * T) - (f.y - 0.5 * T), dist = Math.hypot(ax, ay);
      if (dist > range || dist < 1) return;
      var cos = (ax * d[0] + ay * d[1]) / dist;
      if (cos < 0.5 || dist >= bd) return;
      bd = dist;
      best = a;
    });
    return best;
  };

  P.shoot = function () {
    var s = this.state, r = L.shoot(s);
    if (r === 'arrows') return F.ui.toast('No arrows left. Kanor sells them at his Lodge.');
    if (r === 'tired') return F.ui.toast('Too tired to draw the bow. Eat something first.');
    var target = this.wildTarget(), f = this.feet(), ang;
    if (target) { // you turn to it
      var tx = target.x - f.x, ty = target.y - f.y;
      this.dir = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
    }
    var d = this.dirVec(), x = f.x + d[0] * 0.4 * T, y = f.y - 0.55 * T + d[1] * 0.3 * T;
    if (target) ang = Math.atan2((target.y - 0.3 * target.def.w * T) - y, target.x - x);
    else ang = Math.atan2(d[1], d[0]);
    F.ensureTexture(this, 'props/arrow_fly');
    var img = this.add.image(x, y, 'props/arrow_fly').setDisplaySize(0.85 * T, 0.28 * T).setRotation(ang).setDepth(DEPTH.fx);
    this.wildArrows.push({ img: img, x: x, y: y, vx: Math.cos(ang) * ARROW_SPEED, vy: Math.sin(ang) * ARROW_SPEED, left: L.bowRange(s) * T });
    this.idle();
    sfx('swoosh');
    F.bus.emit('hud');
    this.changed();
  };

  P.updateArrows = function (dt) {
    var self = this;
    this.wildArrows = this.wildArrows.filter(function (ar) {
      var step = ARROW_SPEED * dt / 1000;
      ar.x += ar.vx * dt / 1000;
      ar.y += ar.vy * dt / 1000;
      ar.left -= step;
      ar.img.setPosition(ar.x, ar.y);
      var hit = null;
      (self.wild ? self.wild.animals : []).forEach(function (a) {
        if (!hit && Math.hypot(ar.x - a.x, ar.y - (a.y - 0.3 * a.def.w * T)) < Math.max(0.45, 0.55 * a.def.w) * T) hit = a;
      });
      if (hit) { ar.img.destroy(); self.wildStruck(hit); return false; }
      if (ar.left <= 0) {
        self.tweens.add({ targets: ar.img, alpha: 0, y: ar.y + 0.3 * T, duration: 250, onComplete: function () { ar.img.destroy(); } });
        return false;
      }
      return true;
    });
  };

  P.wildStruck = function (a) {
    var s = this.state;
    a.hp -= L.bowDamage(s);
    a.img.setTintFill(0xffffff);
    this.time.delayedCall(90, function () { if (a.img.active) a.img.clearTint(); });
    sfx('chop');
    a.hitT = HIT_MS;
    this.cameras.main.shake(70, 0.0016);
    if (this.bits) this.bits.dust.explode(3, a.x, a.y - 0.3 * a.def.w * T);
    if (a.hp > 0) {
      if (!a.bar) {
        a.bar = { bg: this.add.rectangle(a.x, a.y, BAR_W + 12, BAR_H + 12, 0x2e1c0c, 0.85).setDepth(DEPTH.fx),
          fill: this.add.rectangle(a.x, a.y, BAR_W, BAR_H, 0xe5484d).setOrigin(0, 0.5).setDepth(DEPTH.fx + 0.01) };
      }
      if (a.def.angry) { a.cool = 0; this.wildCharge(a); } else this.wildFlee(a, this.feet());
      return;
    }
    this.wildDown(a);
  };

  // Hunted: a puff, its things on the ground, and its slot waits for it to come back.
  P.wildDown = function (a) {
    var self = this, s = this.state;
    this.wild.animals.splice(this.wild.animals.indexOf(a), 1);
    for (var i = 0; i < 8; i++) {
      var c = this.add.circle(a.x + rand(-0.4, 0.4) * T, a.y - rand(0.1, 0.6) * T, rand(20, 34), 0xfff6e0).setDepth(DEPTH.fx);
      this.tweens.add({ targets: c, y: c.y - rand(60, 140), alpha: 0, scale: 1.6, duration: rand(350, 600), onComplete: function (tw, t) { t[0].destroy(); } });
    }
    a.img.destroy();
    a.sh.destroy();
    if (a.bar) { a.bar.bg.destroy(); a.bar.fill.destroy(); }
    sfx('pick');
    L.huntDrops(a.kind, Math.random).forEach(function (d) {
      for (var k = 0; k < d[1]; k++) self.dropWild(d[0], a.x + rand(-0.6, 0.6) * T, a.y + rand(-0.3, 0.4) * T);
    });
    var r = L.hunted(s, this.mapKey, a.slot, a.kind, a.size);
    var big = a.def.rare ? '' : L.wildGiant(a.size) ? 'Giant ' : '';
    if (a.def.rare) sfx('found');
    this.floatTextAt(a.x, a.y - T, r.kg + ' kg');
    F.ui.toast(r.record ? 'New record! ' + big + a.def.name + ', ' + r.kg + ' kg. In your Hunter\'s Book.'
      : big + a.def.name + ' hunted! Pick up what it left.' + (s.wild.n < WI.areas.makiling.unlock ? ' (' + s.wild.n + '/' + WI.areas.makiling.unlock + ' hunts)' : ''), 2400, r.record ? 0x7a5a12 : 0x2f5a22);
    if (!this.wild.animals.length && !r.opened) this.time.delayedCall(2600, function () { if (F.ui) F.ui.toast('That was the last one nearby. More will wander in soon.', 3000); });
    if (r.opened) this.time.delayedCall(2400, function () { F.ui.dialog('MAKILING FOREST IS OPEN\nKanor: "Ten hunts! You are ready for the forest. Follow the trail north. Mind the wild boars, and the wolves at night."'); });
    this.changed();
    this.save();
  };

  P.dropWild = function (id, x, y) {
    var s = this.state, img = this.add.image(x, y - 0.5 * T, 'items', L.iconOf(s, id)).setScale(1.35).setDepth(DEPTH.actor + y / 1e5);
    softShadow(this);
    var sh = this.add.image(x, y - 0.04 * T, 'fx-wildshadow').setDisplaySize(0.62 * T, 0.2 * T).setDepth(DEPTH.shadow);
    // it pops out, lands, and bobs a little so it is easy to spot in the grass (its shadow stays on the ground)
    this.tweens.add({ targets: img, y: y - 0.2 * T, duration: 420, ease: 'Bounce.out', onComplete: function () {
      if (!img.active) return;
      img.scene.tweens.add({ targets: img, y: y - 0.32 * T, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      img.scene.tweens.add({ targets: sh, scaleX: sh.scaleX * 0.82, scaleY: sh.scaleY * 0.82, alpha: 0.75, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } });
    this.wildDrops.push({ id: id, x: x, y: y, img: img, sh: sh });
  };

  P.pickWildDrops = function () {
    var self = this, s = this.state, f = this.feet(), full = false;
    this.wildDrops = this.wildDrops.filter(function (d) {
      if (Math.hypot(d.x - f.x, d.y - f.y) > 0.65 * T) return true;
      if (!L.canAdd(s, d.id, 1)) { full = true; return true; }
      L.addItem(s, d.id, 1);
      L.discover(s, d.id);
      self.iconPop(d.x, d.y - 0.3 * T, L.iconOf(s, d.id));
      d.img.destroy();
      d.sh.destroy();
      sfx('pick');
      self.changed();
      return false;
    });
    if (full && !this.saidFull) { this.saidFull = true; F.ui.toast('Your bag is full! Make room to pick it up.'); }
    if (!full) this.saidFull = false;
  };

  // Leaving: what is still on the ground goes in your bag (the rest waits in your basket at home).
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    var s = this.state;
    if (L.isWildMap(to) && F.session.visit) return F.ui.toast('Hunting is your own trip: go from your own farm.');
    if (to === 'makiling' && !L.wildOpen(s, 'makiling')) {
      var f = this.feet();
      this.setFeet(f.x, f.y + 0.9 * T);
      this.player.body.setVelocity(0, 0);
      return F.ui.toast('Kanor: "Makiling is wild boar and wolf country. Come after ' + WI.areas.makiling.unlock + ' hunts (' + s.wild.n + ' so far)."', 3200);
    }
    if (this.wildDrops && this.wildDrops.length && !this.busy) {
      var left = 0;
      this.wildDrops.forEach(function (d) {
        if (L.canAdd(s, d.id, 1)) L.addItem(s, d.id, 1);
        else { s.basket[d.id] = Math.min(999, (s.basket[d.id] || 0) + 1); left++; }
        L.discover(s, d.id);
      });
      this.wildDrops = [];
      if (left) F.ui.toast(left + (left > 1 ? ' things' : ' thing') + ' did not fit in your bag: they wait in your basket at home.', 3200);
    }
    return travel.call(this, to, spawn, floor);
  };

  // ---------- bait ----------
  P.putBait = function () {
    var s = this.state, pt = this.front(0.8);
    if (this.wildBait) return F.ui.toast('There is bait down already.');
    L.removeItem(s, 'bait', 1);
    var img = this.add.image(pt.x, pt.y, 'items', C.ICON.bait).setScale(0.7).setDepth(DEPTH.actor + pt.y / 1e5);
    this.wildBait = { x: pt.x, y: pt.y, img: img, until: Date.now() + WI.baitMins * 60000 + 30000 };
    var shy = this.wild.animals.filter(function (a) { return a.def.shy; }).sort(function (a, b) { return Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y); })[0];
    if (shy && Math.hypot(shy.x - pt.x, shy.y - pt.y) < 9 * T) { shy.mode = 'toBait'; shy.t = 20000; }
    F.ui.toast('Bait down. Step back and wait: a shy animal may come to eat.', 2600);
    this.changed();
  };

  // ---------- Kanor ----------
  P.setupKanor = function () {
    var p = this.points.kanor;
    if (!p) return;
    F.ensureTexture(this, 'kanor');
    var img = this.add.sprite(p.x, p.y, 'kanor', 0).setOrigin(0.5, 376 / 384);
    F.depthTo(img, DEPTH.actor + p.y / 1e5);
    var zone = this.add.zone(p.x, p.y - 0.15 * T, 0.6 * T, 0.35 * T);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    this.kanor = { x: p.x, y: p.y, img: img, zone: zone };
    this.updateKanor();
  };
  P.updateKanor = function () {
    var k = this.kanor, s = this.state, here = s.time >= C.KANOR.open && s.time < C.KANOR.close;
    k.img.setVisible(here);
    k.zone.body.enable = here;
    if (!here) return;
    var f = this.feet(), dx = f.x - k.x, dy = f.y - k.y;
    if (Math.hypot(dx, dy) > 3 * T) return k.img.setFrame(0).setFlipX(false);
    if (Math.abs(dx) > Math.abs(dy)) k.img.setFrame(6).setFlipX(dx > 0); // the side frames face left
    else k.img.setFrame(dy < 0 ? 3 : 0).setFlipX(false);
  };
  P.talkKanor = function () {
    sfx('talk');
    if (L.takeTip(this.state, 'kanor')) {
      this.save();
      return F.ui.dialog('KANOR\n' + C.KANOR.hello, [{ label: 'Shop', cb: function () { F.ui.openKanor('buy', 0); } }]);
    }
    var j = L.wildJob(this.state);
    F.ui.openKanor(!j.done && L.countItem(this.state, j.item) >= j.n ? 'job' : 'buy', 0); // you have what he asked for
  };

  // ---------- the panels ----------
  U.openKanor = function (tab, page) {
    var self = this, s = mine(), W = F.world, rows = [], I = C.ITEMS;
    var done = function (r, ok) {
      if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
      if (r === 'full') return self.toast('Your bag is full.');
      if (r === 'ore') { sfx('nope'); return self.toast('You need the ore for it: dig it in the mine.'); }
      if (r !== 'ok') return null;
      sfx('coin');
      self.toast(ok, 2000, 0x2f5a22);
      W.changed();
      W.save();
      self.closeModal();
      self.openKanor(tab, page);
      return null;
    };
    if (tab === 'buy') {
      if (!L.hasBow(s)) {
        rows.push({ icon: I.bow.icon, name: 'Bow', desc: 'Shoots up to ' + WI.bow.range[0] + ' tiles. You need arrows too.',
          buttons: [{ label: 'Buy ' + WI.bow.price + 'G', cb: function () {
            var r = L.buyBow(s);
            if (r === 'ok') { s.inv.forEach(function (x, i) { if (x && x.id === 'bow') s.sel = i; }); self.refresh(); } // in your hands right away
            done(r, 'A Bow! You are holding it: tap Shoot.');
          } }] });
      } else {
        var up = L.nextBow(s), lv = L.bowLevel(s);
        if (up) {
          rows.push({ icon: C.ICON['bow_' + (lv + 1)], name: C.TOOL_LEVELS[lv + 1] + ' Bow',
            desc: 'Shoots ' + WI.bow.range[lv + 1] + ' tiles' + (WI.bow.damage[lv + 1] > WI.bow.damage[lv] ? ' and hits twice as hard' : '') + '. Needs ' + up.n + ' ' + I[up.ore].name + '.',
            buttons: [{ label: up.gold + 'G', cb: function () { done(L.upgradeBow(s), 'Your Bow is now a ' + C.TOOL_LEVELS[lv + 1] + ' Bow!'); } }] });
        }
      }
      rows.push({ icon: I.arrows.icon, name: 'Arrows x' + WI.arrowPack, desc: 'You have ' + L.countItem(s, 'arrows') + '. One a shot.',
        buttons: [{ label: 'Buy ' + I.arrows.price + 'G', cb: function () { done(L.buyWild(s, 'arrows'), WI.arrowPack + ' arrows.'); } }] });
      rows.push({ icon: I.bait.icon, name: 'Berry Bait', desc: 'Put it down: a shy animal comes to eat.',
        buttons: [{ label: 'Buy ' + I.bait.price + 'G', cb: function () { done(L.buyWild(s, 'bait'), 'Berry Bait.'); } }] });
    } else if (tab === 'sell') {
      L.wildGoods(s).forEach(function (id) {
        var n = L.countItem(s, id);
        rows.push({ icon: I[id].icon, name: I[id].name + ' x' + n, desc: I[id].sell + 'G each.',
          buttons: [{ label: 'Sell ' + n * I[id].sell + 'G', cb: function () { var g = L.sellToKanor(s, id); F.bus.emit('hud'); done(g ? 'ok' : null, 'Sold for ' + g + 'G.'); } }] });
      });
    } else if (tab === 'job') {
      var j = L.wildJob(s), have = L.countItem(s, j.item);
      rows.push({ icon: I[j.item].icon, name: j.n + ' ' + I[j.item].name,
        desc: j.done ? 'Done for today. Come back tomorrow!' : 'Today he wants these. You have ' + have + '.',
        buttons: j.done ? [] : [{ label: j.gold + 'G', color: have >= j.n ? GREEN_BTN : GREY_BTN, cb: function () {
          var r = L.doWildJob(s);
          if (r === 'short') { sfx('nope'); return self.toast('You need ' + j.n + ' ' + I[j.item].name + '.'); }
          F.bus.emit('hud');
          done('ok', 'Salamat! ' + j.gold + 'G from Kanor.');
        } }] });
      L.wildNews(s).forEach(function (line) { rows.push({ icon: C.ICON.sparkle, name: 'Kanor says', desc: line }); });
    } else {
      WI.trophies.forEach(function (t, k) {
        var ti = C.HOME.typeIndex[t.type], type = C.HOME.types[ti];
        rows.push({ img: self.furnImg(ti, 0), name: type.name,
          desc: t.needs.map(function (n) { return n[1] + ' ' + I[n[0]].name + ' (' + L.countItem(s, n[0]) + ')'; }).join(', ') + '. +' + type.beauty + ' beauty.',
          buttons: [{ label: t.gold + 'G', cb: function () {
            var r = L.makeTrophy(s, k);
            if (r === 'short') { sfx('nope'); return self.toast('You need more for that one. Hunt some more!'); }
            done(r, type.name + ' done! Find it in your furniture storage: Decorate at home.');
          } }] });
      });
    }
    this.listPanel({
      title: "Kanor's Lodge", tab: tab, page: page, rows: rows,
      tabs: [['buy', 'Buy'], ['sell', 'Sell'], ['job', 'Request'], ['make', 'Trophies']],
      corner: { label: 'Book', color: GREY_BTN, cb: function () { self.closeModal(); self.openBook(s, null, function () { self.openKanor(tab, page); }); } },
      sub: function () { return 'Gold ' + s.gold + '     Hunts ' + s.wild.n; },
      empty: 'Bring meat, feathers, furs, antlers, tusks, pelts and fangs from your hunts.',
      reopen: function (t, p) { self.openKanor(t, p); },
    });
  };

  // ---------- the Hunter's Book: how many of each, and the biggest (yours, or a friend's) ----------
  U.bookRow = function (who) {
    var self = this, st = F.session.visit && F.session.visit.state;
    return { icon: C.ITEMS.antler.icon, name: "Hunter's Book", desc: 'See what ' + who + ' has hunted, and their biggest.',
      buttons: [{ label: 'Look', cb: function () { self.closeModal(); self.openBook(st, who, function () { self.playerMenu(F.session.visit.host, who); }); } }] };
  };
  U.openBook = function (st, who, back, page) {
    var self = this, I = C.ITEMS, total = 0, rows = WI.order.map(function (k) {
      var def = WI.animals[k], n = st.wild.by[k] || 0, seen = n > 0, best = (st.wild.best[k] || 0) / 10;
      total += n;
      if (!seen && def.rare) return { icon: C.ICON.exclaim, name: '???', desc: 'A rare one. ' + (WI.areas.pulag.extra.some(function (x) { return x.kind === k; }) ? 'Seen in Pulag, some days.' : 'Seen in Makiling, some days.') };
      return { icon: I[def.drops[0][0]].icon, name: def.name + (n ? ' x' + n : ''), desc: seen ? 'Biggest: ' + best + ' kg.' : 'Not hunted yet.' };
    });
    this.listPanel({
      title: (who ? who + "'s" : "Hunter's") + ' Book', page: page || 0, rows: rows,
      corner: { label: 'Back', color: GREY_BTN, cb: function () { self.closeModal(); if (back) back(); } },
      sub: function () { return 'Hunts ' + total; },
      reopen: function (t, p) { self.openBook(st, who, back, p); },
    });
  };
  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.call(this);
    var self = this, c = this.modals[this.modals.length - 1].c;
    this.button(c, 228, 150, 88, 30, 'Hunts', function () { self.closeModal(); self.openBook(mine(), null, function () { self.openCollection(); }); }, GREY_BTN);
  };

  U.wildIntro = function () {
    var I = C.ITEMS;
    this.dialog('PULAG GRASSLAND', [{ label: 'OK' }], {
      rows: [
        [I.bow.icon, "Kanor sells a Bow and arrows at his Lodge up the trail. Hold the Bow and tap Shoot."],
        [C.ICON.bolt, 'Sneak: push the joystick only a little. Labuyo, rabbits and deer run if you rush them. Follow their footprints.'],
        [I.meat_boar.icon, 'A hunted animal leaves meat and more on the ground. Cook it at home or sell it to Kanor.'],
        [I.antler.icon, "Kanor has a request each day, and makes trophies for your house. Your biggest catches go in the Hunter's Book."],
        [I.tusk.icon, 'Boars and wolves (in Makiling Forest, after 10 hunts) charge you: keep your distance.'],
      ],
    });
  };
})(window.Farm = window.Farm || {});
