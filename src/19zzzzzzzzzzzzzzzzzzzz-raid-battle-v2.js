// Farm Raids, the battle you can see (owner, 10 Nov 2026: "the attacking animal looks like just a steady animals, cant
// even see the battle, everything looks static. Cant even know how to drop ... make it more like ... an intense game").
// Only the pictures: the battle's rules (01-logicZZZZZZZZZZZ-raids.js) are the same, so the game server's replay of a raid
// gives the same result. The owner's art (art-src/RAID-BATTLE-V2-PROMPTS.md; tools/art/battle2-import.js):
//   raid_moves: each raider running, attacking, running off with loot, knocked out
//   battle_fx: a hit, landing dust, coins, a crop pulled up, broken planks, rubble, smoke, dizzy stars, a loot sack, the
//     green drop ring, a swing, a heal
// What it does: a clear green drop zone with a "tap here" ring before the first raider; raiders drop in with dust; they
// hop as they run, lunge when they hit, carry what they took; hit sparks, damage numbers and health bars on both sides;
// a defense that falls flashes, shakes the screen and leaves rubble; crops come out of the ground; a loot bar with the
// three star marks, and a big star when one is won.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W;
  var D = F.WorldScene.DEPTH;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var raiding = function (w) { return !!(w && F.session.raid && F.session.visit && F.session.visit.raid && w.mapKey === 'farm'); };

  // the pictures' frames (tools/art/battle2-import.js)
  C.RAID_MOVES = { w: 220, h: 176, run: [196, 174, 188, 204, 168, 200, 172, 207] }; // a row a raider (R.raiderOrder): run, attack, loot, out
  C.BATTLE_FX = ['hit', 'dust', 'coins', 'crop', 'planks', 'rubble', 'smoke', 'dizzy', 'sack', 'ring', 'swoosh', 'heal'];
  if (F.SHEETS) {
    F.SHEETS.raid_moves = { frameWidth: C.RAID_MOVES.w, frameHeight: C.RAID_MOVES.h };
    F.SHEETS.battle_fx = { frameWidth: 160, frameHeight: 160 };
  }
  var on = function () { return !!(F.images.raid_moves && F.images.battle_fx); };
  var MOVE = { run: 0, hit: 1, loot: 2, out: 3 };
  // the owner's animation sheets (10 Nov 2026: "there should also front and back"; tools/art/raider-anim-import.js, the
  // 'raiders' pack): ranim_<k>, 4 frames a row; rows 0-3 sideways (facing left), 4-7 toward you, 8-11 away; in each: run,
  // attack, run with loot, then hurt / tumbling / knocked out / idle. runW: the sideways run frame's width (its size)
  C.RAID_ANIM = { fr: 200, runW: { goat: 167, crow: 139, cat: 121, carabao: 130, monkey: 153, boar: 126, rooster: 126, bayawak: 134 } };
  if (F.SHEETS) R.raiderOrder.forEach(function (k) { F.SHEETS['ranim_' + k] = { frameWidth: 200, frameHeight: 200 }; });
  var animOf = function (scene, k) { var key = 'ranim_' + k; return F.images && F.images[key] ? F.ensureTexture(scene, key) : null; };
  var DIRROW = { side: 0, front: 4, back: 8 };
  var moveFrame = function (k, pose) { return R.raiderOrder.indexOf(k) * 4 + MOVE[pose]; };

  // ---------- effects ----------
  // one effect: grows in, then fades (opts: { scale, life, dy (rise, tiles), rot, depth, keep })
  P.bfx = function (k, x, y, o) {
    if (!F.images.battle_fx) return null;
    o = o || {};
    F.ensureTexture(this, 'battle_fx');
    var s0 = (o.scale || 0.8) * T / 160, im = this.add.image(x, y, 'battle_fx', C.BATTLE_FX.indexOf(k)).setDepth(o.depth || D.fx).setScale(s0 * 0.4);
    if (o.rot) im.setRotation(o.rot);
    if (o.flip) im.setFlipX(true);
    this.tweens.add({ targets: im, scale: s0, duration: 140, ease: 'Back.out' });
    if (o.keep) return im;
    this.tweens.add({ targets: im, alpha: 0, y: y - (o.dy || 0) * T, delay: o.life || 260, duration: 320, onComplete: function () { im.destroy(); } });
    return im;
  };
  // a number that jumps up and fades (damage: red; on a defense: white)
  P.bnum = function (x, y, txt, color, key) {
    // (stacked: a number right after another one on the same thing goes above it, never on it)
    if (key) {
      var st = (this.bvNum = this.bvNum || {})[key], now = this.time.now;
      if (st && now - st.at < 650) { st.n = (st.n + 1) % 3; } else st = this.bvNum[key] = { n: 0 };
      st.at = now;
      y -= st.n * 0.42 * T;
      x += (st.n % 2 ? 0.22 : -0.22) * T * (st.n ? 1 : 0);
    }
    var t = this.add.text(x, y, txt, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: Math.round(0.52 * T) + 'px', color: color, fontStyle: 'bold', stroke: '#2a1408', strokeThickness: Math.round(0.07 * T) })
      .setOrigin(0.5).setDepth(D.fx + 1).setResolution(F.R || 1);
    this.tweens.add({ targets: t, y: y - 0.7 * T, duration: 260, ease: 'Quad.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 380, duration: 260, onComplete: function () { t.destroy(); } });
  };
  // a health bar over something: a dark back, its colour by how much is left
  var bar = function (scene, u, x, y, wide, frac) {
    if (!u.hb) { u.hb = scene.add.graphics().setDepth(D.fx + 0.5); }
    var g = u.hb, w = wide * T, h = 0.16 * T;
    g.clear();
    if (frac >= 1 || frac <= 0) return g.setVisible(false);
    g.setVisible(true).fillStyle(0x1c0f06, 0.8).fillRoundedRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 3)
      .fillStyle(frac > 0.5 ? 0x6fd24a : frac > 0.25 ? 0xf2c23a : 0xe0503a, 1).fillRoundedRect(x - w / 2, y, Math.max(2, w * frac), h, 2);
  };

  // ---------- the drop zone: green, outlined, breathing; a ring and "tap here" before the first raider ----------
  var setup = P.raidSetup;
  P.raidSetup = function () {
    setup.call(this);
    if (!on() || !this.raidB) return;
    var self = this, f = this.raidB.farm, cam = this.cameras.main;
    cam.setZoom(cam.zoom / 0.62 * 0.8); // (closer than before: the raiders big enough to see what they do)
    // the view stays on the farm (owner's simulator check, 10 Nov 2026: an empty band above the map): bounds a little past
    // the map's edges, so its top and bottom rows can come out from under the raid bar and the raiders' cards
    var mw = this.map.widthInPixels, mh = this.map.heightInPixels, padT = 110 * (F.R || 1) / cam.zoom, padB = 130 * (F.R || 1) / cam.zoom; // (layout px of the bars, in world units)
    cam.setBounds(0, -padT, mw, mh + padT + padB);
    this.bv = { units: {}, defs: {}, loot: {}, stars: 0, sprites: null };
    if (F.needImage) Object.keys(this.raidB.left || {}).forEach(function (k) { F.needImage('ranim_' + k); }); // (the raiders' animations)
    if (this.raidDropShade) this.raidDropShade.destroy();
    var dropAt = function (x, y) { return x >= 0 && y >= 0 && x < f.w && y < f.h && f.drop.charCodeAt(y * f.w + x) === 49; };
    var g = this.add.graphics().setDepth(D.flat + 0.05);
    g.fillStyle(0x7dff6a, 0.2);
    for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) if (dropAt(x, y)) g.fillRect(x * T, y * T, T, T);
    g.lineStyle(Math.max(2, 0.08 * T), 0xc8ff9e, 0.95);
    for (var y2 = 0; y2 < f.h; y2++) for (var x2 = 0; x2 < f.w; x2++) {
      if (!dropAt(x2, y2)) continue;
      if (!dropAt(x2, y2 - 1)) g.lineBetween(x2 * T, y2 * T, (x2 + 1) * T, y2 * T);
      if (!dropAt(x2, y2 + 1)) g.lineBetween(x2 * T, (y2 + 1) * T, (x2 + 1) * T, (y2 + 1) * T);
      if (!dropAt(x2 - 1, y2)) g.lineBetween(x2 * T, y2 * T, x2 * T, (y2 + 1) * T);
      if (!dropAt(x2 + 1, y2)) g.lineBetween((x2 + 1) * T, y2 * T, (x2 + 1) * T, (y2 + 1) * T);
    }
    this.raidDropShade = g;
    this.bv.zoneTw = this.tweens.add({ targets: g, alpha: 0.45, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    // the nearest open ground to the middle of the screen: a green ring, the raider above it, "Tap here!"
    // (the view as it is now: worldView is only worked out at the next frame, after the zoom above)
    var vw = cam.width / cam.zoom, vh = cam.height / cam.zoom, wv = { x: cam.scrollX + cam.width / 2 - vw / 2, y: cam.scrollY + cam.height / 2 - vh / 2, width: vw, height: vh };
    var mid = { x: wv.x + wv.width / 2, y: wv.y + wv.height * 0.42 }, best = null, bd = 1e9; // (above the raiders' bar)
    for (var y3 = 0; y3 < f.h; y3++) for (var x3 = 0; x3 < f.w; x3++) {
      var open = true;
      for (var oy = -1; oy <= 1 && open; oy++) for (var ox = -1; ox <= 1; ox++) if (!dropAt(x3 + ox, y3 + oy)) { open = false; break; }
      if (!open) continue;
      var dd = Math.hypot((x3 + 0.5) * T - mid.x, (y3 + 0.5) * T - mid.y);
      if (dd < bd) { bd = dd; best = [x3, y3]; }
    }
    if (best) {
      var hx = (best[0] + 0.5) * T, hy = (best[1] + 0.6) * T;
      if (hy > wv.y + wv.height * 0.68 || hy < wv.y + wv.height * 0.2) cam.centerOn(hx, hy + 0.5 * T); // (off the open part of the screen: there)
      F.ensureTexture(this, 'raid_moves');
      var ring = this.bfx('ring', hx, hy, { scale: 3.2, keep: true, depth: D.flat + 0.1 });
      var k = F.ui && F.ui.raidSel, pic = k ? this.add.image(hx, hy - 0.9 * T, 'raid_moves', moveFrame(k, 'run')).setScale(1.6 * T / C.RAID_MOVES.run[R.raiderOrder.indexOf(k)]).setDepth(D.fx).setAlpha(0.85) : null;
      var word = this.add.text(hx, hy + 0.55 * T, 'Tap here!', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: Math.round(0.6 * T) + 'px', color: '#ffffff', fontStyle: 'bold', stroke: '#1f5a12', strokeThickness: Math.round(0.12 * T) })
        .setOrigin(0.5, 0).setDepth(D.fx).setResolution(F.R || 1);
      this.tweens.add({ targets: ring, scale: ring.scale * 1.18, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.inOut' });
      if (pic) this.tweens.add({ targets: pic, y: hy - 1.25 * T, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
      this.tweens.add({ targets: word, scale: 1.1, yoyo: true, repeat: -1, duration: 520 });
      this.bv.hint = [ring, pic, word].filter(Boolean);
    }
  };
  // a drop: a ring and dust where they land; off the green ground: the forbidden part flashes red for a moment
  var dropAt = P.raidDropAt;
  P.raidDropAt = function (x, y, quiet) {
    var b = this.raidB, was = b ? b.raiders.length : 0;
    var r = dropAt.call(this, x, y, quiet);
    if (!on() || !b || !this.bv) return r;
    if (b.raiders.length > was) {
      if (this.bv.hint) { this.bv.hint.forEach(function (o) { o.destroy(); }); this.bv.hint = null; }
      if (this.bv.zoneTw && !this.bv.zoneSoft) { this.bv.zoneSoft = true; this.bv.zoneTw.stop(); this.tweens.add({ targets: this.raidDropShade, alpha: 0.5, duration: 400 }); }
      this.bfx('ring', (x + 0.5) * T, (y + 0.6) * T, { scale: 1.1, life: 120, depth: D.flat + 0.1 });
      // its card pops (one less in it)
      var k = b.raiders[b.raiders.length - 1].k, cd = F.ui && F.ui.raidCards && F.ui.raidCards[k];
      if (cd && cd.c && cd.c.active) { F.ui.tweens.killTweensOf(cd.c); cd.c.setScale(1); F.ui.tweens.add({ targets: cd.c, scale: 1.14, y: cd.c.y, duration: 90, yoyo: true, ease: 'Quad.out' }); }
    } else if (!quiet && !L.frEdge(b, x, y)) this.raidNoDrop(x, y);
    return r;
  };
  P.raidNoDrop = function (x, y) {
    var f = this.raidB.farm, g = this.add.graphics().setDepth(D.flat + 0.06), R0 = 6;
    g.fillStyle(0xff3a2a, 0.32);
    for (var yy = y - R0; yy <= y + R0; yy++) for (var xx = x - R0; xx <= x + R0; xx++) {
      if (xx < 0 || yy < 0 || xx >= f.w || yy >= f.h || f.drop.charCodeAt(yy * f.w + xx) === 49) continue;
      if (Math.hypot(xx - x, yy - y) <= R0) g.fillRect(xx * T, yy * T, T, T);
    }
    this.tweens.add({ targets: g, alpha: 0, delay: 350, duration: 350, onComplete: function () { g.destroy(); } });
    if (this.raidDropShade) { this.tweens.add({ targets: this.raidDropShade, alpha: 1, yoyo: true, duration: 180 }); }
    sfx('nope');
  };

  // ---------- each frame ----------
  var draw = P.raidDraw;
  P.raidDraw = function (time) {
    if (!on() || !this.bv) return draw.call(this, time);
    F.ensureTexture(this, 'raid_moves');
    var self = this, b = this.raidB, bv = this.bv;
    // the yard pictures of the defenses (fences, scarecrows, the new pieces): matched by their tile
    if (!bv.sprites) {
      bv.sprites = {};
      var items = (this.state.yard && this.state.yard.items) || [], O = C.OUTDOOR;
      items.forEach(function (it, i) {
        var type = O.types[it.t];
        if (!type || !self.yardSprites || !self.yardSprites[i]) return;
        var fy = it.y + Math.max(0, type.h - Math.max(1, type.foot || 1));
        bv.sprites[it.x + ',' + fy] = self.yardSprites[i];
      });
    }
    b.raiders.forEach(function (r) { self.bvRaider(r, time); });
    b.defs.forEach(function (d, i) { self.bvDefense(d, i, time); });
    b.loot.forEach(function (p) { self.bvLoot(p, time); });
    // the dog (a defense that moves): its own picture, as before
    b.defs.forEach(function (dd, i) {
      var img = self.raidDefs[i];
      if (!img) return;
      var mv = Math.abs(dd.x * T - img.x) > 1;
      if (dd.hp > 0) img.setFrame(C.DOG.frame0 + (mv ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 9)).setFlipX(mv ? dd.x * T > img.x : img.flipX);
      img.setPosition(dd.x * T, dd.y * T).setDepth(D.actor + dd.y * T / 1e5).setAlpha(dd.hp > 0 ? 1 : 0.3);
    });
    this.raidShots(time);
  };

  P.bvRaider = function (r, time) {
    var self = this, bv = this.bv, u = bv.units[r.id], d = R.raiders[r.k], row = R.raiderOrder.indexOf(r.k);
    if (!u) {
      // as big as it was (the hunting animal's picture), a little longer for the running pose
      var base = { goat: 1.0, crow: 0.8, cat: 0.85, carabao: 1.7, monkey: 0.95, boar: 1.25, rooster: 0.8, bayawak: 1.15 }[r.k] || 1;
      u = bv.units[r.id] = { base: base, lx: r.x, ly: r.y, hp: r.hp, face: 1, born: time, ph: (row * 37 + r.id.length * 13) % 100 / 15, dustAt: 0, lunge: 0, k: base * 1.45 * T / C.RAID_MOVES.run[row] };
      u.sh = this.add.ellipse(r.x * T, r.y * T, 0.8 * base * T, 0.26 * base * T, 0x000000, 0.28).setDepth(D.flat + 0.2);
      u.img = this.add.image(r.x * T, r.y * T, 'raid_moves', moveFrame(r.k, 'run')).setOrigin(0.5, 0.9).setScale(u.k);
      // it comes down from above: its shadow grows under it, it lands squashed with a ring of dust and springs up; the big
      // ones thump the ground (owner, 10 Nov 2026: "improve the dropping raiders")
      u.fall = 1; u.sq = 0; u.kb = 0; u.spin = (Math.random() - 0.5) * 30;
      this.tweens.add({ targets: u, fall: 0, spin: 0, duration: 380, ease: 'Quad.in', onComplete: function () {
        u.sq = 1;
        self.tweens.add({ targets: u, sq: 0, duration: 420, ease: 'Elastic.out', easeParams: [1.1, 0.5] });
        if (!d.flies) {
          self.bfx('dust', r.x * T, r.y * T + 0.05 * T, { scale: 1.3 * base, life: 160, depth: D.flat + 0.3 });
          var rg = self.bfx('ring', r.x * T, r.y * T + 0.1 * T, { scale: 0.6 * base, keep: true, depth: D.flat + 0.25 });
          if (rg) self.tweens.add({ targets: rg, scale: rg.scale * 3.2, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: function () { rg.destroy(); } });
        }
        if (base >= 1.2) self.cameras.main.shake(110, 0.0025 * base);
        sfx(base >= 1.2 ? 'hammer' : 'plant');
      } });
    }
    var x = r.x * T, y = r.y * T;
    if (r.hp <= 0 && u.px != null) { x = u.px; y = u.py; } // (knocked out where its picture is)
    if (r.hp <= 0) { // knocked out: lies dizzy, then goes in a puff
      if (!u.out) {
        u.out = time;
        var ak = animOf(this, r.k);
        if (ak) { u.img.setTexture(ak, DIRROW[u.dir || 'side'] + 13).setFlipX(u.dir === 'side' || !u.dir ? u.face < 0 : false).setScale(u.ka || u.k); u.dazed = true; } // (tumbling, then lying dizzy)
        else u.img.setFrame(moveFrame(r.k, 'out'));
        u.img.setAngle(ak ? 0 : -25 * u.face).setPosition(x, y).clearTint();
        if (!ak) u.img.setScale(u.k);
        if (ak) this.time.delayedCall(260, function () { if (u.img.active) u.img.setFrame(DIRROW[u.dir || 'side'] + 14); });
        if (u.hb) u.hb.setVisible(false);
        // knocked flying a little, a bounce, and it lies there dizzy
        this.tweens.add({ targets: u.img, y: y - 0.55 * T, x: x + u.face * 0.35 * T, angle: 0, duration: 180, ease: 'Quad.out', yoyo: false, onComplete: function () {
          self.tweens.add({ targets: u.img, y: y, duration: 200, ease: 'Bounce.out' });
        } });
        this.bfx('hit', x, y - 0.5 * T * u.base, { scale: 1.1, life: 80 });
        this.time.delayedCall(1100, function () {
          self.bfx('smoke', x, y - 0.3 * T, { scale: 1.0, life: 120 });
          self.tweens.add({ targets: [u.img, u.sh], alpha: 0, duration: 250 });
        });
      }
      return;
    }
    var dx = r.x - (u.mx != null ? u.mx : u.lx), dy = r.y - (u.my != null ? u.my : u.ly), moving = Math.abs(dx) + Math.abs(dy) > 0.0008, tg = r.target;
    if (this.raidB.t !== u.mt) { u.mt = this.raidB.t; u.mdx = dx; u.mdy = dy; u.mx = r.x; u.my = r.y; } else { dx = u.mdx || 0; dy = u.mdy || 0; moving = Math.abs(dx) + Math.abs(dy) > 0.0008; }
    var near = tg && Math.hypot(tg.x - r.x, tg.y - r.y) <= (tg.left != null ? 0.65 : 1.05);
    var hitting = !moving && near && tg.left == null && r.stuck <= 0, grabbing = !moving && near && tg.left != null;
    if (moving && Math.abs(dx) > 0.0004) u.face = dx > 0 ? -1 : 1; // (the pictures face left)
    if (hitting || grabbing) u.face = tg.x > r.x ? -1 : 1;
    // (owner, 10 Nov 2026: "Birds flying, cats attacking looks awkward, we need better animation")
    // the picture follows the battle smoothly (a turn or a scare no longer snaps it), a little behind
    // (smooth: the battle moves things 10 times a second; between two steps the picture glides from the last to the new place)
    var bt = this.raidB.t, al = Math.max(0, Math.min(1, (this.raidAcc || 0) / R.battle.tick));
    if (u.stepT == null) { u.stepT = bt; u.ax = u.bx = x; u.ay = u.by = y; }
    if (bt !== u.stepT) { u.ax = u.bx; u.ay = u.by; u.bx = x; u.by = y; u.stepT = bt; }
    if (!this.raidStarted || this.raidB.end) al = 1;
    u.px = u.ax + (u.bx - u.ax) * al; u.py = u.ay + (u.by - u.ay) * al;
    var big = r.k === 'carabao' || r.k === 'boar', pose = 'run', hop = 0, tilt = 0, lx = 0, ly = 0, sx = 1, sy = 1, fly = 0;
    var sw = ((time + u.ph * 100) % 800) / 800;
    if (d.flies) {
      // FLYING: no hops. It glides at a height, wings beating (a quick flutter), banking into turns; to peck it swoops low,
      // dips its beak in a beat, and climbs again; scared, it flies up high and fast
      var want = r.flee > 0 ? 1.4 * T : (hitting || grabbing) ? 0.3 * T : 0.95 * T;
      u.alt = u.alt == null ? want : u.alt + (want - u.alt) * 0.08;
      var beat = Math.sin(time / (r.flee > 0 ? 28 : 42) + u.ph);
      fly = u.alt + Math.sin(time / 260 + u.ph) * 0.08 * T;
      sx = 1 + 0.05 * beat; sy = 1 - 0.07 * beat;
      u.bank = (u.bank || 0) + ((moving ? Math.max(-14, Math.min(14, dy * 900)) : 0) - (u.bank || 0)) * 0.15;
      tilt = u.bank - (r.flee > 0 ? 12 : 0);
      if (hitting || grabbing) {
        var pk = ((time + u.ph * 100) % 520) / 520, dip = pk < 0.35 ? Math.sin(pk / 0.35 * Math.PI) : 0;
        ly = dip * 0.12 * T; tilt = -18 * dip; pose = dip > 0.3 ? 'hit' : grabbing ? 'loot' : 'run';
        if (pk < 0.1 && time - (u.peckAt || 0) > 300) { u.peckAt = time; if (hitting) this.bfx('hit', u.px - u.face * 0.25 * T, u.py - 0.25 * T, { scale: 0.45, life: 40 }); }
      } else if (r.got > 0.5) pose = 'loot';
    } else {
      if (moving) {
        // RUNNING: a hop a stride, squashed on landing, stretched in the air, leaning into the run
        var ph = time / (r.flee > 0 ? 70 : 95) + u.ph, h = Math.abs(Math.sin(ph));
        hop = h * (big ? 0.1 : 0.18) * T; tilt = -5 + Math.sin(ph) * 4;
        sx = 1.05 - 0.08 * h; sy = 0.93 + 0.12 * h;
        if (r.got > 0.5) pose = 'loot';
      } else if (grabbing) {
        var g2 = Math.abs(Math.sin(time / 110 + u.ph)); hop = g2 * 0.08 * T; tilt = -10 * g2; sy = 0.95 + 0.08 * g2; pose = 'loot';
      } else if (hitting) {
        // ATTACKING: crouch back, then a pounce (the small ones leap in an arc; the carabao and the boar charge low), a
        // swipe at the moment it lands, and back to its place
        var back = big ? 0.16 : 0.12, reach = big ? 0.42 : 0.36;
        if (sw < 0.4) { var e = sw / 0.4; lx = u.face * back * T * e; sx = 1 + 0.1 * e; sy = 1 - 0.12 * e; tilt = 8 * e; }
        else if (sw < 0.6) {
          var e2 = (sw - 0.4) / 0.2;
          lx = u.face * back * T + (-u.face * (reach + back)) * T * e2; hop = big ? 0 : Math.sin(e2 * Math.PI) * 0.32 * T;
          sx = 0.9; sy = 1.12; tilt = -14; pose = 'hit';
          if (e2 > 0.75 && u.swing !== Math.floor((time + u.ph * 100) / 800)) {
            u.swing = Math.floor((time + u.ph * 100) / 800);
            var swx = this.bfx('swoosh', u.px - u.face * (reach + 0.45) * T, u.py - 0.4 * T * u.base, { scale: 0.4 * u.base, life: 40, flip: u.face < 0 }); // (small and faint, beside it: owner, "too much")
            if (swx) swx.setAlpha(0.6);
            if (big) this.cameras.main.shake(60, 0.0015);
          }
        } else { var e3 = (sw - 0.6) / 0.4; lx = -u.face * reach * T * (1 - e3); pose = e3 < 0.3 ? 'hit' : 'run'; }
      } else if (r.got > 0.5) pose = 'loot';
    }
    if (r.stuck > 0) lx = Math.sin(time / 30) * 0.06 * T;
    u.kb *= 0.85; // (a knock back when hit, fading)
    sx *= 1 + 0.3 * u.sq; sy *= 1 - 0.38 * u.sq; // (landing)
    // the animation sheets, when here: which way it goes (toward you, away, sideways) and the frame of its move; the
    // frames move the body, so the pushes and stretches above are dropped (only the landing squash and the drop stay)
    var ak = animOf(this, r.k);
    if (ak) {
      if (u.ka == null) u.ka = u.base * 1.45 * T / C.RAID_ANIM.runW[r.k];
      var vx = (u.bx - u.ax) || 0, vy = (u.by - u.ay) || 0;
      if ((hitting || grabbing) && tg) { vx = (tg.x - r.x) * T; vy = (tg.y - r.y) * T; }
      if (Math.abs(vx) + Math.abs(vy) > 0.5) u.dir = Math.abs(vy) > Math.abs(vx) * 1.15 ? (vy > 0 ? 'front' : 'back') : 'side';
      var dir = u.dir || 'side', row = DIRROW[dir], col;
      if (hitting) { col = sw < 0.3 ? 0 : sw < 0.45 ? 1 : sw < 0.62 ? 2 : 3; row += 1; }
      else if (time - (u.hitAt || -1e9) < 180) { row += 3; col = 0; } // (hurt)
      else if (pose === 'loot' || grabbing) { row += 2; col = Math.floor(time / (grabbing ? 160 : 85) + u.ph) % 4; }
      else if (moving || d.flies) { col = Math.floor(time / (r.flee > 0 ? 60 : d.flies ? 75 : 85) + u.ph) % 4; }
      else { row += 3; col = 3; } // (idle)
      if (u.img.texture.key !== ak) u.img.setTexture(ak);
      var keepHop = d.flies ? 0 : 0; // (the run frames rise and fall by themselves)
      u.img.setFrame(row + col).setFlipX(dir === 'side' && u.face < 0).setAngle(d.flies && dir === 'side' ? tilt * 0.5 * u.face : 0)
        .setScale(u.ka * (1 + 0.3 * u.sq), u.ka * (1 - 0.38 * u.sq))
        .setPosition(u.px + (hitting ? lx * 0.5 : 0) + u.kb * u.face, u.py - keepHop - fly + (d.flies ? 0 : 0) - u.fall * 2.2 * T).setDepth(D.actor + u.py / 1e5 + (d.flies ? 0.001 : 0));
      hop = 0; lx = hitting ? lx * 0.5 : 0;
    } else u.img.setFrame(moveFrame(r.k, pose)).setFlipX(u.face < 0).setAngle((tilt + u.spin) * u.face).setScale(u.k * sx, u.k * sy)
      .setPosition(u.px + lx + u.kb * u.face, u.py - hop - fly + ly - u.fall * 2.2 * T).setDepth(D.actor + u.py / 1e5 + (d.flies ? 0.001 : 0));
    var shAlt = d.flies ? Math.max(0, Math.min(1, (u.alt || 0) / (1.4 * T))) : 0;
    u.sh.setPosition(u.px + lx * 0.5, u.py + 0.05 * T).setScale(d.flies ? 0.75 - 0.35 * shAlt : (1 - hop / T) * (1 - 0.7 * u.fall)).setAlpha(d.flies ? 0.75 - 0.35 * shAlt : 1 - 0.5 * u.fall);
    x = u.px; y = u.py; // (the effects below go where the picture is)
    if (r.stuck > 0) u.img.setTint(0xb08860); else if (r.slow > 0) u.img.setTint(0x9fd4ff); else if (!u.flash) u.img.clearTint();
    // running: dust behind it
    if (moving && !d.flies && time - u.dustAt > 240) { u.dustAt = time; this.bfx('dust', x + u.face * 0.35 * T, y, { scale: 0.45, life: 60, depth: D.flat + 0.3 }); }
    // hit: a flash, a spark, the number; what hit it: the dog and the goose swing at it
    if (r.hp < u.hp - 0.01) {
      var lost = u.hp - r.hp;
      u.hp = r.hp;
      u.sum = (u.sum || 0) + lost;
      if (time - (u.hitAt || 0) > 450) {
        u.hitAt = time;
        u.flash = true;
        u.img.setTint(0xff9a8a); // (owner, 10 Nov 2026: the white flash was "too much": a light red tint for a moment)
        u.kb = Math.min(0.25, 0.06 + lost / r.max) * T;
        this.time.delayedCall(70, function () { u.flash = false; if (u.img.active) u.img.clearTint(); });
        this.bfx('hit', x + (Math.random() - 0.5) * 0.3 * T, y - 0.6 * T * u.base - fly, { scale: 0.5, life: 50 });
        this.bnum(x, y - 1.3 * T * u.base - fly, '-' + Math.max(1, Math.round(u.sum)), '#ff6a4a', r.id);
        u.sum = 0;
        var by = this.raidB.defs.filter(function (q) { return q.aim === r.id && R.defenses[q.t].chases; })[0];
        if (by) { var sw2 = this.bfx('swoosh', x, y - 0.4 * T, { scale: 0.45, life: 40, flip: by.x > r.x }); if (sw2) sw2.setAlpha(0.6); }
      }
    }
    bar(this, u, x, y - 1.55 * T * u.base - fly, 0.9, r.hp / r.max);
    u.lx = r.x; u.ly = r.y;
  };

  P.bvDefense = function (d, i, time) {
    if (!d.max) return; // (the mud pit: a trap, nothing to hit)
    var bv = this.bv, u = bv.defs[d.id], dx0 = Math.floor(d.hx - 0.5), dy0 = Math.floor(d.hy - 0.5);
    if (!u) {
      var sp = bv.sprites[dx0 + ',' + dy0] || this.raidDefs[i] || null;
      u = bv.defs[d.id] = { hp: d.hp, sp: sp, sx: sp ? sp.x : 0, scy: sp ? sp.scaleY : 1, shotAt: 0 };
    }
    var x = d.x * T, y = d.y * T;
    // at work: it kicks back with each shot (the tower, the sprinkler, the bee box)
    if (d.aim != null && d.hp > 0 && u.sp && u.sp.active && d.t !== 'dog' && time - u.shotAt > 650) {
      u.shotAt = time;
      var spr = u.sp;
      this.tweens.add({ targets: spr, scaleY: u.scy * 0.86, duration: 70, yoyo: true, ease: 'Quad.out', onComplete: function () { if (spr.active) spr.scaleY = u.scy; } });
    }
    if (d.hp < u.hp - 0.01) {
      var lost = u.hp - d.hp;
      u.hp = d.hp;
      u.sum = (u.sum || 0) + lost;
      if (time - (u.hitAt || 0) > 450) {
        u.hitAt = time;
        this.bfx('hit', x + (Math.random() - 0.5) * 0.4 * T, y - 0.5 * T, { scale: 1.0, life: 70 });
        this.bnum(x, y - 1.3 * T, '-' + Math.max(1, Math.round(u.sum)), '#ffffff', d.id);
        u.sum = 0;
        if (u.sp && u.sp.active && d.t !== 'dog') {
          var sp = u.sp;
          sp.setTint(0xffb8a8);
          this.time.delayedCall(60, function () { if (sp.active) sp.clearTint(); });
          this.tweens.add({ targets: sp, x: u.sx + 0.08 * T, yoyo: true, repeat: 1, duration: 40, onComplete: function () { if (sp.active) sp.x = u.sx; } });
        }
        sfx(d.t === 'fence' ? 'chop' : 'hammer');
      }
    }
    if (d.hp <= 0 && !u.down) { // down: a burst, the screen shakes, rubble where it stood
      u.down = true;
      if (u.hb) u.hb.setVisible(false);
      if (u.sp && u.sp.active && d.t !== 'dog') this.tweens.add({ targets: u.sp, alpha: 0, scaleY: u.sp.scaleY * 0.3, duration: 220 });
      this.bfx(d.t === 'fence' ? 'planks' : 'smoke', x, y - 0.5 * T, { scale: 1.2, life: 200 });
      if (d.t !== 'dog') this.bfx('rubble', x, y - 0.1 * T, { scale: d.t === 'fence' ? 0.8 : 1.1, keep: true, depth: D.flat + 0.4 });
      this.cameras.main.shake(180, 0.006);
      sfx('anvil');
      return;
    }
    if (d.hp > 0) bar(this, u, x, y - 1.15 * T, d.t === 'fence' ? 0.6 : 0.9, d.hp / d.max);
  };

  // loot taken: what is taken pops out (a crop pulled up, coins, a sack) and jumps toward the raider; a field tile empty:
  // its crop goes
  P.bvLoot = function (p, time) {
    var bv = this.bv, u = bv.loot[p.id] || (bv.loot[p.id] = { left: p.left, at: 0 });
    if (p.left < u.left - 0.01) {
      u.left = p.left;
      if (time - u.at > 420) {
        u.at = time;
        var x = p.x * T, y = p.y * T, k = p.kind === 'crops' ? 'crop' : p.kind === 'gold' ? 'coins' : 'sack';
        var im = this.bfx(k, x, y - 0.3 * T, { scale: k === 'coins' ? 0.7 : 0.6, keep: true });
        if (im) this.tweens.add({ targets: im, y: y - 1.4 * T, x: x + (Math.random() - 0.5) * 0.8 * T, alpha: 0, duration: 650, ease: 'Quad.out', onComplete: function () { im.destroy(); } });
        sfx(k === 'coins' ? 'coin' : 'harvest');
      }
    }
    if (p.kind === 'crops' && p.left <= 0 && !u.gone) {
      u.gone = true;
      var idx = Math.floor(p.y - 0.5) * this.map.width + Math.floor(p.x - 0.5), spr = this.crops && this.crops[idx];
      if (spr) { this.tweens.killTweensOf(spr); this.tweens.add({ targets: spr, alpha: 0, scale: spr.scale * 0.4, duration: 220 }); }
    }
  };

  // ---------- the HUD: the loot bar with its three star marks, and a big star when one is won ----------
  var hudOn = U.raidHudOn;
  U.raidHudOn = function (b, name) {
    hudOn.call(this, b, name);
    if (!on() || !this.frBox) return;
    var g = this.raidBarG = this.add.graphics();
    this.frBox.add(g);
    this.raidStarsWon = 0;
    this.raidHudRefresh();
  };
  var hudRefresh = U.raidHudRefresh;
  U.raidHudRefresh = function () {
    hudRefresh.call(this);
    var b = this.raidB, g = this.raidBarG;
    if (!b || !g || !g.active) return;
    var x0 = 16, w = W - 120, y = 62, share = Math.max(0, Math.min(1, L.frShare(b)));
    g.clear().fillStyle(0x24160b, 0.78).fillRoundedRect(x0 - 4, y - 4, w + 8, 16, 8).fillStyle(0x4a3220, 1).fillRoundedRect(x0, y, w, 8, 4);
    if (share > 0) g.fillStyle(share >= 0.9 ? 0xffd23f : 0x8be05a, 1).fillRoundedRect(x0, y, Math.max(8, w * share), 8, 4);
    [0.3, 0.6, 0.9].forEach(function (m) { g.fillStyle(share >= m ? 0xffd23f : 0xfff6d8, 1).fillCircle(x0 + w * m, y + 4, 5); });
    var st = L.frStars(b);
    if (st > (this.raidStarsWon || 0)) { this.raidStarsWon = st; this.raidBigStar(st); }
  };
  U.raidBigStar = function (n) {
    var self = this, cx = W / 2, cy = C.VIEW_H * 0.36;
    var c = this.add.container(cx, cy);
    if (this.frBox) this.frBox.add(c); // (in the raid's HUD: the UI hides anything else while a raid is on)
    if (F.images.raid_fx) { F.ensureTexture(this, 'raid_fx'); c.add(this.add.image(0, 0, 'raid_fx', C.FRAID_FX.indexOf('star')).setScale(1.1)); }
    else c.add(this.add.text(0, 0, '★', { fontSize: '96px', color: '#ffd23f' }).setOrigin(0.5));
    c.add(this.add.text(0, 70, n === 1 ? '1 star!' : n + ' stars!', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold', stroke: '#6a4300', strokeThickness: 5 }).setOrigin(0.5).setResolution(F.R || 1));
    c.setScale(0.2);
    sfx('found');
    this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: c, x: W - 40, y: 40, scale: 0.15, alpha: 0.2, delay: 900, duration: 420, ease: 'Quad.in', onComplete: function () { c.destroy(); } });
    void self;
  };
})(window.Farm = window.Farm || {});
