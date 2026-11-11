// The Lost Tower's tricks in the world (the rules and numbers: 01-logicZZZZZZZZZZZZZZZZZZ-tower-tricks.js, F.towerTricks;
// the Tower: 19zzz...z-tower.js; the spec: docs/superpowers/specs/2026-11-12-lost-tower-design.md). Each realm adds one and
// it stays on every realm above; the Seventh Moon has all eight. What each does here:
// - shield: a bubble round the enemy; a Bow, Javelin or Boomerang hit bounces off it ("clink", a small "Shield!"); a Rifle
//   shot breaks it (a pop, the bubble bursts) and is spent on it; from then on it takes hits as any other.
// - burst: a beaten one leaves a puddle (a soft ellipse in the realm's colour until its art comes) for 6 s; standing in one
//   you walk 40% slower. At most TR.burst.most at once, their pictures reused.
// - song: while a singer is alive within 6 tiles, your shots (the Bow's and the weapons') take half as long again between
//   them; notes float up from the singers near you, and a "♪ slowed" mark shows by you.
// - flock: its members circle their flock's middle, which circles you, then dive at you together; one of them reaching
//   you costs energy as a charge does, and the flock pulls back. Fliers fly over the rocks; a pack on foot does not.
// - heal: every 4 s a healer mends the most hurt other one within 5 tiles by a fifth of its hits: a green glow and a "+".
// - dark: a dark sheet over the floor with a hole round you (L.towerSight: 3.5 tiles; the Keeper's Lantern will widen it),
//   and the fire creatures glow through it in their own light.
// - split: a beaten splitter becomes two at 0.6 size with half its hits each (its copies: lr.extra, which the stairs count).
// - revive: a beaten reviver lies dim for 3 s, then stands with half its hits; a hit while it lies finishes it. Once.
// Kept cheap for 60 enemies on a phone: no physics bodies, nothing made each frame (the words, notes, glows and puddles
// come from small pools), the song looked for 5 times a second.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var TR = F.towerTricks;
  var maps = F.ASSETS && F.ASSETS.maps;
  if (!maps || !maps.lair || !TR || !TR.shield || !F.WorldScene) return;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var ADD = Phaser.BlendModes.ADD;
  var DARK = 29.5, LIGHT = 31, WORD = 32; // (the night sheet is 30, its lights 31: 18-polish.js)
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var inTower = function (w) { return !!(w && w.lair && w.lair.cfg.tower); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var hex = function (s) { return parseInt(String(s).replace('#', ''), 16) || 0xffffff; };
  var clearing = false; // (F.towerClearFloor: everything down at once, no tricks)

  // ---------- sounds: the shield's clink and pop, a singer's note ----------
  var A = F.Audio, sfxOf = A && A.sfx;
  var tone = function (freq, dur, type, vol, slide, delay) {
    var ctx = A.ctx, t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(A.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  var OWN = {
    tt_clink: function () { tone(2400, 0.12, 'square', 0.05); tone(3600, 0.18, 'sine', 0.07, null, 0.01); },
    tt_pop: function () { tone(900, 0.12, 'triangle', 0.25, 160); tone(2800, 0.08, 'sine', 0.08); },
    tt_heal: function () { tone(660, 0.18, 'sine', 0.08, 990); },
  };
  if (A && sfxOf) A.sfx = function (name) {
    if (OWN[name]) { if (A.ctx && A.opts.sfx && A.ctx.state === 'running') OWN[name](); return; }
    return sfxOf.apply(A, arguments);
  };

  // ---------- pictures drawn once ----------
  var canvas = function (w, key, size, draw) {
    if (!w.textures.exists(key)) {
      var t = w.textures.createCanvas(key, size, size);
      draw(t.getContext(), size);
      t.refresh();
    }
    return key;
  };
  var shieldTex = function (w) {
    return canvas(w, 'fx-towershield', 128, function (g, n) {
      var gr = g.createRadialGradient(n / 2, n / 2, n * 0.2, n / 2, n / 2, n / 2 - 4);
      gr.addColorStop(0, 'rgba(160,210,255,0.05)');
      gr.addColorStop(0.8, 'rgba(160,210,255,0.22)');
      gr.addColorStop(1, 'rgba(200,235,255,0.5)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 4, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.strokeStyle = 'rgba(220,240,255,0.9)'; g.stroke();
      g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.85)'; // (a shine at the top left)
      g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 16, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    });
  };
  var puddleTex = function (w) {
    return canvas(w, 'fx-towerpuddle', 128, function (g, n) {
      var gr = g.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.7)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, n, n);
      g.fillStyle = 'rgba(255,255,255,0.5)'; // (a few bubbles)
      [[0.35, 0.4, 0.06], [0.62, 0.55, 0.045], [0.5, 0.3, 0.035]].forEach(function (b) { g.beginPath(); g.arc(b[0] * n, b[1] * n, b[2] * n, 0, Math.PI * 2); g.fill(); });
    });
  };
  // the dark: SPAN tiles of night with a soft round hole of HOLE tiles in the middle (scaled with your sight)
  var SPAN = 64, HOLE = 3.5;
  var darkTex = function (w) {
    return canvas(w, 'fx-towerdark', 512, function (g, n) {
      var r = HOLE / SPAN * n;
      g.fillStyle = 'rgb(3,5,12)';
      g.fillRect(0, 0, n, n);
      g.globalCompositeOperation = 'destination-out';
      var gr = g.createRadialGradient(n / 2, n / 2, r * 0.7, n / 2, n / 2, r * 1.15);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, n, n);
      g.globalCompositeOperation = 'source-over';
    });
  };
  var glowKey = function (w) { // (18-polish.js makes it with the world; drawn here too, in case)
    return canvas(w, 'fx-glow', 128, function (g, n) {
      var gr = g.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,220,140,0.95)');
      gr.addColorStop(0.4, 'rgba(255,190,90,0.45)');
      gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, n, n);
    });
  };

  // ---------- small pools: words over the floor, notes, glows (the oldest is reused when all are out) ----------
  var pool = function (k, name, n, make) {
    var p = k.pools[name] || (k.pools[name] = { list: [], i: 0 });
    var o;
    if (p.list.length < n) { o = make(); p.list.push(o); } else { o = p.list[p.i]; p.i = (p.i + 1) % n; }
    return o;
  };
  var STYLE = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '120px', fontStyle: 'bold', color: '#ffffff', stroke: '#1a1020', strokeThickness: 20 };
  // a word that floats up and fades (one pool for each word: its text is drawn once)
  var word = function (w, text, x, y, color) {
    var k = tk(w), o = pool(k, 'w:' + text, 6, function () { return w.add.text(0, 0, text, Object.assign({}, STYLE, { color: color || '#ffffff' })).setOrigin(0.5, 1).setDepth(WORD); });
    w.tweens.killTweensOf(o);
    o.setPosition(x, y).setAlpha(1).setScale(0.8).setVisible(true);
    w.tweens.add({ targets: o, y: y - 0.7 * T, alpha: 0, scale: 1, duration: 800, ease: 'Quad.out', onComplete: function () { o.setVisible(false); } });
    return o;
  };
  var glowAt = function (w, x, y, size, color) {
    var k = tk(w), o = pool(k, 'glow', 8, function () { return w.add.image(0, 0, glowKey(w)).setBlendMode(ADD).setDepth(DEPTH.fx + 0.05); });
    w.tweens.killTweensOf(o);
    o.setPosition(x, y).setTint(color).setDisplaySize(size, size).setAlpha(0.95).setVisible(true);
    w.tweens.add({ targets: o, alpha: 0, scaleX: o.scaleX * 1.5, scaleY: o.scaleY * 1.5, duration: 600, onComplete: function () { o.setVisible(false); } });
  };

  // ---------- each floor's state (made the first time it is asked for: the floor's creatures are placed before the
  // world's create has finished) ----------
  var tk = function (w) {
    var lr = w.lair;
    if (lr.tk) return lr.tk;
    var on = {};
    L.towerTricks(lr.floor).forEach(function (id) { on[id] = true; });
    lr.tk = { on: on, flocks: on.flock ? L.towerFlocks(lr.floor) : {}, fl: {}, puddles: [], pools: {}, sung: false, songMs: 0, noteMs: 0, noteI: 0,
      bowAt: -1e9, bowGap: 0, wpnAt: -1e9, inPud: false, dark: null, sight: 0, mark: null, ring: [0, 0],
      col: hex(lr.cfg.zone && lr.cfg.zone.lava ? lr.cfg.zone.lava.hot[1] : '#80a040') };
    return lr.tk;
  };
  F.towerTk = function (w) { w = w || F.world; return inTower(w) ? tk(w) : null; }; // (the tests)

  // ---------- each enemy: what it carries ----------
  var strength = P.lairStrength;
  P.lairStrength = function (a) {
    strength.apply(this, arguments);
    if (!inTower(this)) return;
    var k = tk(this);
    if (!a.tf) a.tf = L.towerFlags(this.lair.floor, a.kind, a.slot, L.towerIsCopy(a.slot));
    if (a.copyHp) { a.hp = a.max = a.copyHp; a.def.hp = a.max; } // (a splitter's copy: half its hits; lairStrength made a new def)
    var fl = a.tf;
    a.sing = fl.sing;
    a.heal = fl.heal;
    a.fire = fl.fire && k.on.dark;
    a.split = fl.split;
    a.revive = fl.revive;
    if (a.shield == null) a.shield = fl.shield;
    if (a.shield && !a.shieldImg) a.shieldImg = this.add.image(a.x, a.y, shieldTex(this)).setAlpha(0.85);
    if (a.heal && a.healT == null) a.healT = rand(0.3, 1) * TR.heal.every; // (not all at once)
    if (a.fire && !a.light) a.light = this.add.image(a.x, a.y, glowKey(this)).setBlendMode(ADD).setDepth(LIGHT).setTint(a.def.tint || 0xffd890).setAlpha(0.85)
      .setDisplaySize(TR.dark.fireSight * 2.4 * T, TR.dark.fireSight * 2.4 * T);
    if (fl.flock && !a.fs) joinFlock(this, a);
    this.drawWild(a);
  };
  var drawWild = P.drawWild;
  P.drawWild = function (a, dt) {
    drawWild.apply(this, arguments);
    if (!a.tf) return;
    var top = a.y - a.lift - 0.42 * a.def.w * a.size * T;
    if (a.light) {
      a.light.setPosition(a.x, top);
      F.depthTo(a.img, DARK + 0.01 + a.y / 1e7); // (it shines over the dark)
    }
    if (a.shieldImg) {
      var d = (a.def.w * a.size + 0.45) * T;
      a.shieldImg.setPosition(a.x, top).setDisplaySize(d, d);
      F.depthTo(a.shieldImg, a.img.depth + 0.00001);
    }
  };
  var wildGone = P.wildGone;
  P.wildGone = function (a) {
    wildGone.apply(this, arguments);
    if (a.shieldImg) { if (a.shieldImg.active) a.shieldImg.destroy(); a.shieldImg = null; }
    if (a.light) { a.light.destroy(); a.light = null; }
    if (a.fs) leaveFlock(a);
  };

  // ---------- 1. the shield ----------
  var shieldBreak = function (w, a) {
    var img = a.shieldImg;
    a.shield = false;
    a.shieldImg = null;
    sfx('tt_pop');
    if (w.bits) w.bits.dust.explode(5, a.x, a.y - 0.4 * a.def.w * a.size * T);
    if (img && img.active) w.tweens.add({ targets: img, scaleX: img.scaleX * 1.6, scaleY: img.scaleY * 1.6, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: function () { img.destroy(); } });
    word(w, 'Broken!', a.x, a.y - (0.9 + a.def.w * a.size) * T, '#ffe08a');
  };
  var shieldBounce = function (w, a) {
    var img = a.shieldImg;
    sfx('tt_clink');
    if (img && img.active) {
      w.tweens.killTweensOf(img);
      img.setAlpha(1);
      w.tweens.add({ targets: img, alpha: 0.85, duration: 260 });
    }
    word(w, 'Shield!', a.x, a.y - (0.9 + a.def.w * a.size) * T, '#bfe4ff');
  };
  var struck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    if (!inTower(this) || !a.shield || this.wild.lead) return struck.apply(this, arguments);
    // (a friend's hit: their phone has not said with what; it bounces)
    var s = this.state, k = !friend && s.wpnHit ? s.wpnHit.k : null;
    if (!friend && L.towerShieldHit(k) === 'break') shieldBreak(this, a);
    else shieldBounce(this, a);
    if (a.def.angry && !a.fs && !a.lying) { a.cool = 0; this.wildCharge(a); } // (it knows you are there)
  };

  // ---------- 2. the puddles ----------
  var puddle = function (w, x, y) {
    var k = tk(w), list = k.puddles, now = w.time.now, p = null, i;
    if (list.length < TR.burst.most) {
      p = { x: 0, y: 0, until: 0, img: w.add.image(0, 0, puddleTex(w)).setDepth(DEPTH.flat + 0.05).setTint(k.col) };
      list.push(p);
    } else for (i = 0; i < list.length; i++) if (!p || list[i].until < p.until) p = list[i]; // (the oldest goes)
    p.x = x;
    p.y = y;
    p.until = now + TR.burst.ms;
    w.tweens.killTweensOf(p.img);
    p.img.setPosition(x, y).setVisible(true).setAlpha(0.8).setDisplaySize(TR.burst.size * T * 0.3, TR.burst.size * T * 0.3);
    w.tweens.add({ targets: p.img, displayWidth: TR.burst.size * T, displayHeight: TR.burst.size * T, duration: 220, ease: 'Back.out' });
    sfx('water');
  };
  var stepPuddles = function (w, k) {
    var now = w.time.now, list = k.puddles;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], left = p.until - now;
      if (!p.img.visible) continue;
      if (left <= 0) p.img.setVisible(false);
      else if (left < 700) p.img.setAlpha(0.8 * left / 700);
    }
  };
  // in one, you walk slower (the walk's own easing, at a slower top speed)
  var move = P.move;
  P.move = function (body) {
    var k = inTower(this) && this.lair.tk;
    if (!k || !k.puddles.length) return move.apply(this, arguments);
    var c = this.player.body.center, slow = L.towerInPuddle(k.puddles, c.x, c.y, this.time.now, T);
    if (!slow) { k.inPud = false; return move.apply(this, arguments); }
    if (!k.inPud) { k.inPud = true; word(this, 'Sticky!', c.x, c.y - 1.9 * T, '#d8f0a0'); }
    var sp = C.SPEED;
    C.SPEED = sp * L.towerWalk(true);
    try { return move.apply(this, arguments); } finally { C.SPEED = sp; }
  };

  // ---------- 3. the song ----------
  var stepSong = function (w, k, dt) {
    var c = w.player.body.center, list = w.wild.animals;
    if ((k.songMs -= dt) <= 0) { k.songMs = 200; k.sung = L.towerSung(list, c.x, c.y, T); }
    if (k.sung && !k.mark) k.mark = w.add.text(0, 0, '♪ slowed', Object.assign({}, STYLE, { fontSize: '96px', color: '#cfe6ff', strokeThickness: 16 })).setOrigin(0.5, 1).setDepth(WORD);
    if (k.mark) k.mark.setVisible(k.sung).setPosition(c.x, c.y - 2.15 * T);
    // a note from a singer near you (one at a time, round the floor's singers)
    if ((k.noteMs -= dt) > 0 || !list.length) return;
    k.noteMs = 260;
    var reach = (TR.song.reach + 3) * T;
    for (var j = 0; j < list.length; j++) {
      var a = list[(k.noteI + j) % list.length];
      if (!a.sing || !(a.hp > 0) || a.lying || Math.abs(a.x - c.x) > reach || Math.abs(a.y - c.y) > reach) continue;
      k.noteI = (k.noteI + j + 1) % list.length;
      var y = a.y - a.lift - (0.6 + a.def.w * a.size * 0.8) * T, x = a.x + rand(-0.3, 0.3) * T;
      var o = pool(k, 'note', 10, function () { return w.add.text(0, 0, '♪', Object.assign({}, STYLE, { fontSize: '150px', color: '#e6f2ff' })).setOrigin(0.5, 1).setDepth(WORD); });
      w.tweens.killTweensOf(o);
      o.setPosition(x, y).setAlpha(0.95).setVisible(true).setAngle(rand(-15, 15));
      w.tweens.add({ targets: o, x: x + rand(-0.4, 0.4) * T, y: y - 0.9 * T, alpha: 0, duration: 1000, onComplete: function (tw, t) { t[0].setVisible(false); } });
      return;
    }
  };
  var songWait = function (w, k) {
    if (k.mark && k.mark.visible) { w.tweens.killTweensOf(k.mark); k.mark.setScale(1.25); w.tweens.add({ targets: k.mark, scale: 1, duration: 200 }); }
    return null;
  };
  var shoot = P.shoot;
  P.shoot = function () {
    var k = inTower(this) && tk(this);
    if (!k || !k.on.song) return shoot.apply(this, arguments);
    var now = this.time.now, was = this.shot;
    if (k.sung && now < k.bowAt + L.towerGap(k.bowGap, true)) return songWait(this, k);
    var r = shoot.apply(this, arguments);
    if (this.shot && this.shot !== was) { k.bowAt = now; k.bowGap = this.acting || 0; }
    return r;
  };
  var fireWeapon = P.fireWeapon;
  P.fireWeapon = function () {
    var k = inTower(this) && tk(this), wk = k && L.heldWeapon(this.state);
    if (!k || !k.on.song || !wk) return fireWeapon.apply(this, arguments);
    var now = this.time.now, gap = L.towerGap(L.weaponGap(wk), true);
    if (k.sung && now < k.wpnAt + gap) return songWait(this, k);
    var before = this.wpnNext, r = fireWeapon.apply(this, arguments);
    if (this.wpnNext !== before) { k.wpnAt = now; if (k.sung) this.wpnNext = now + gap; }
    return r;
  };

  // ---------- 4. flocks ----------
  var joinFlock = function (w, a) {
    var k = tk(w), n = k.flocks[a.slot];
    if (n == null) return;
    var fs = k.fl[n] || (k.fl[n] = { n: n, members: [], x: a.x, y: a.y, ang: rand(0, 6.3), orb: rand(0, 6.3), spin: Math.random() < 0.5 ? -1 : 1,
      mode: 'circle', t: rand(TR.flock.rest[0], TR.flock.rest[1]), frame: -1 });
    if (fs.members.indexOf(a) < 0) fs.members.push(a);
    a.fs = fs;
  };
  var leaveFlock = function (a) {
    var m = a.fs.members, i = m.indexOf(a);
    if (i >= 0) m.splice(i, 1);
    a.fs = null;
  };
  // (moves p toward x, y at most `most` world units; false when it may not go there)
  var toward = function (o, x, y, most) {
    var dx = x - o.x, dy = y - o.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= most || d < 1) { o.x = x; o.y = y; return d; }
    o.x += dx / d * most;
    o.y += dy / d * most;
    return d;
  };
  // the flock's middle, once a frame: it circles you a few tiles off, then dives at you, then pulls back
  var stepFlock = function (w, fs, dt) {
    var frame = w.game.loop.frame;
    if (fs.frame === frame) return;
    fs.frame = frame;
    var lead = fs.members[0];
    if (!lead) return;
    var c = w.player.body.center, def = lead.def, z = w.wild.zone, R = TR.flock.circle * T, s = dt / 1000;
    fs.ang += fs.spin * dt * 0.0025;
    fs.t -= dt;
    if (fs.mode === 'circle') {
      fs.orb += fs.spin * dt * 0.0005;
      toward(fs, c.x + Math.cos(fs.orb) * R, c.y + Math.sin(fs.orb) * R * 0.8, def.walk * 2.2 * T * s);
      var near = Math.hypot(fs.x - c.x, fs.y - c.y) < R + 3 * T;
      if (fs.t <= 0 && def.angry > 0 && near) { fs.mode = 'dive'; fs.t = TR.flock.dive; fs.hit = false; sfx('nope'); }
      else if (fs.t <= 0) fs.t = 600;
    } else if (fs.mode === 'dive') {
      toward(fs, c.x, c.y, def.run * 1.15 * T * s);
      if (fs.t <= 0) { fs.mode = 'back'; fs.t = TR.flock.back; }
    } else {
      var dx = fs.x - c.x, dy = fs.y - c.y, d = Math.max(1, Math.hypot(dx, dy));
      toward(fs, fs.x + dx / d * T, fs.y + dy / d * T, def.walk * 2.2 * T * s);
      if (fs.t <= 0) { fs.mode = 'circle'; fs.t = rand(TR.flock.rest[0], TR.flock.rest[1]); }
    }
    fs.x = Math.max((z.x0 + 0.5) * T, Math.min((z.x1 + 0.5) * T, fs.x)); // (inside the floor)
    fs.y = Math.max((z.y0 + 0.5) * T, Math.min((z.y1 + 0.5) * T, fs.y));
  };
  var flockMember = function (w, a, dt, frozen) {
    var fs = a.fs, k = w.lair.tk, c = w.player.body.center;
    if (!frozen) stepFlock(w, fs, dt);
    var x0 = a.x, y0 = a.y;
    if (!frozen) {
      L.towerRing(fs.members.indexOf(a), fs.members.length, fs.ang, k.ring);
      var tx = fs.x + k.ring[0] * T, ty = fs.y + k.ring[1] * T, most = a.def.run * 1.5 * T * dt / 1000;
      toward(a, tx, ty, most);
      if (!a.def.flies && !w.wildFree(Math.floor(a.x / T), Math.floor(a.y / T))) { a.x = x0; a.y = y0; } // (a pack on foot goes round the rocks)
    }
    var ms = Math.max(1, dt) / 1000;
    a.vx = Math.abs(a.x - x0) > 0.5 ? (a.x - x0) / ms : 0;
    a.vy = Math.abs(a.y - y0) > 0.5 ? (a.y - y0) / ms : 0;
    a.mode = fs.mode === 'dive' ? 'charge' : 'flock';
    a.t = 1000;
    var d = Math.hypot(a.x - c.x, a.y - c.y) / T;
    if (fs.mode === 'dive' && !fs.hit && !frozen && d < 0.7) { // one of them reaches you: the flock pulls back
      fs.hit = true;
      fs.mode = 'back';
      fs.t = TR.flock.back;
      w.wildHit(a);
      if (!w.lair || !a.fs) return; // (out of energy: out of the Tower)
      a.mode = 'flock';
    }
    w.wildShow(a, d, dt);
  };
  // a flock's flier is up in the air the whole time, in its flying picture
  var wildPose = P.wildPose;
  P.wildPose = function (a) { return a.fs && a.def.flies && (a.vx || a.vy) ? 11 : wildPose.apply(this, arguments); };
  var wildFeel = P.wildFeel;
  P.wildFeel = function (a, was, dt) {
    wildFeel.apply(this, arguments);
    if (a.fs && a.def.flies) a.lift = 0.45 * T + Math.sin((a.step += dt || 0) / 90) * 0.05 * T;
  };

  // ---------- 5. healers ----------
  var heal = function (w, a) {
    var b = L.towerHealPick(a, w.wild.animals, T);
    if (!b) return;
    var n = L.towerHealOf(b);
    b.hp += n;
    var y = b.y - b.lift - 0.45 * b.def.w * b.size * T;
    glowAt(w, b.x, y, (b.def.w * b.size + 1.2) * T, 0x6dff8e);
    glowAt(w, a.x, a.y - a.lift - 0.45 * a.def.w * a.size * T, (a.def.w * a.size + 0.6) * T, 0x6dff8e);
    word(w, '+', b.x, y - 0.5 * b.def.w * b.size * T, '#8dff9e');
    sfx('tt_heal');
  };

  // ---------- 7. splitters, 8. revivers ----------
  var lieDown = function (w, a) {
    a.revived = true;
    a.lying = TR.revive.ms;
    a.hp = 1e-6; // (still there: the stairs wait for it, and a shot can find it; a hit now finishes it)
    a.vx = a.vy = 0;
    a.mode = 'idle';
    a.lift = 0;
    w.drawWild(a);
    a.img.setAlpha(0.4).setAngle(a.left ? -80 : 80);
    a.sh.setAlpha(0.4);
    if (w.bits) w.bits.dust.explode(4, a.x, a.y - 0.2 * T);
  };
  var standUp = function (w, a) {
    a.lying = 0;
    a.hp = L.towerReviveHp(a.max);
    a.img.setAlpha(1).setAngle(0);
    a.sh.setAlpha(1);
    a.cool = 0;
    a.t = 0;
    if (w.bits) w.bits.dust.explode(5, a.x, a.y - 0.3 * T);
    glowAt(w, a.x, a.y - 0.4 * a.def.w * a.size * T, (a.def.w * a.size + 1) * T, 0xd8c8ff);
    word(w, 'Up again!', a.x, a.y - (0.9 + a.def.w * a.size) * T, '#e0d4ff');
    sfx('nope');
    if (a.def.angry) w.wildCharge(a);
    w.wildBar(a);
  };
  var splitOf = function (w, a) {
    var lr = w.lair, extra = lr.extra || (lr.extra = {});
    for (var i = 0; i < TR.split.n; i++) {
      var slot = L.towerCopySlot(a.slot, i);
      if (extra[slot]) continue;
      var x = a.x + (i ? 1 : -1) * 0.45 * T, y = a.y + (i ? 0.15 : -0.15) * T;
      if (!w.wildFree(Math.floor(x / T), Math.floor(y / T))) { x = a.x; y = a.y; }
      extra[slot] = true;
      var c = w.addWildAnimal(a.kind, slot, x, y, TR.split.size * a.size);
      c.copyHp = L.towerSplitHp(a.max);
      c.tf = Object.assign({}, a.tf, { shield: false, flock: false, split: false, revive: false }); // (once: the copies do not split)
      c.left = !a.left;
      w.lairStrength(c);
      c.mode = 'idle';
      c.t = 250;
      c.cool = 0;
    }
    if (w.bits) w.bits.dust.explode(6, a.x, a.y - 0.3 * T);
    word(w, 'Split!', a.x, a.y - (0.9 + a.def.w * a.size) * T, '#ffe8b0');
  };

  // ---------- every enemy, every frame ----------
  var updateWild = P.updateWild;
  P.updateWild = function (a, dt, frozen) {
    if (!a.tf || !inTower(this) || this.wild.lead) return updateWild.apply(this, arguments);
    if (a.lying) { // (it lies there, dim; a menu open: the time waits too)
      if (!frozen && (a.lying -= dt) <= 0) standUp(this, a);
      return;
    }
    if (a.heal && !frozen && (a.healT -= dt) <= 0) { a.healT = TR.heal.every; heal(this, a); }
    if (a.fs) return flockMember(this, a, dt, frozen);
    return updateWild.apply(this, arguments);
  };
  // beaten: a reviver lies down first (once); then a splitter splits and a puddle is left
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    if (!inTower(this) || this.wild.lead || !a.tf || clearing) return wildDown.apply(this, arguments);
    var k = tk(this);
    if (a.revive && !a.revived) return lieDown(this, a);
    a.lying = 0;
    if (a.split) splitOf(this, a);
    if (k.on.burst) puddle(this, a.x, a.y);
    return wildDown.apply(this, arguments);
  };
  var clearFloor = F.towerClearFloor;
  F.towerClearFloor = function () {
    clearing = true;
    try { return clearFloor.apply(this, arguments); } finally { clearing = false; }
  };

  // ---------- 6. the dark, and the floor's own loop ----------
  var setDark = function (w, k) {
    if (!k.dark) k.dark = w.add.image(0, 0, darkTex(w)).setDepth(DARK).setAlpha(0.94);
    var sight = L.towerSight(w.state);
    if (sight !== k.sight) {
      k.sight = sight;
      var size = SPAN * T * sight / HOLE;
      k.dark.setDisplaySize(size, size);
    }
    var c = w.player.body.center;
    k.dark.setPosition(c.x, c.y - 0.4 * T);
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (!inTower(this) || !this.wild || !this.player || !this.player.body || !this.sys.isActive()) return;
    var k = tk(this), dt = Math.min(delta, 100);
    if (k.on.dark) setDark(this, k);
    if (this.busy) return;
    if (k.puddles.length) stepPuddles(this, k);
    if (k.on.song) stepSong(this, k, dt);
  };
})(window.Farm = window.Farm || {});
