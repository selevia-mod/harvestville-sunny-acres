// The deep Mine on screen, floor 1,201 and down (rules and numbers: 01-logicZ...-deep-mine.js; the swings on a tough
// rock: 14-actions.js useTool). A cracked rock shows its cracks (kept for the day, like the broken ones). The grumpy
// critters wander the floor; one that sees you close huffs ("Hmph!") and, a moment later, charges: step aside, or it takes
// a little energy, as a cave monster's charge does. Hold the Hammer and face one: Bonk (free). Bonked down, it scampers
// off and leaves an ore. On your own floors only (a friend's mine you follow into has none). The first time past floor
// 1,200: a centred tour, "THE DEEP HALLS" (tip deep_tour).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var D = C.MINE.deep;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var FRAME_H = 252, FEET = 233, FACING = { down: 0, up: 3, side: 6 }, STEPS = [1, 0, 2, 0];
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };

  C.TIPS.push({ key: 'deep_tour', text: 'THE DEEP HALLS' }); // (appended last: a tip is its place in a saved number)

  // ---------- cracks on a tough rock ----------
  P.crackRock = function (idx, t, hits) {
    var m = this.mine, n = (m.cracks && m.cracks[idx]) || 0;
    if (!n) return;
    m.crackG = m.crackG || {};
    var g = m.crackG[idx] || (m.crackG[idx] = this.add.graphics().setDepth(DEPTH.Walls + 0.1));
    var x = t.x * T, y = t.y * T, k = Math.min(1, n / Math.max(1, hits - 1));
    g.clear().lineStyle(14, 0x1a1008, 0.85);
    g.beginPath();
    g.moveTo(x + 0.5 * T, y + 0.2 * T); g.lineTo(x + 0.42 * T, y + (0.2 + 0.3 * k) * T); g.lineTo(x + 0.55 * T, y + (0.3 + 0.45 * k) * T);
    if (k > 0.4) { g.moveTo(x + 0.42 * T, y + 0.42 * T); g.lineTo(x + (0.42 - 0.2 * k) * T, y + 0.55 * T); }
    if (k > 0.7) { g.moveTo(x + 0.55 * T, y + 0.55 * T); g.lineTo(x + (0.55 + 0.22 * k) * T, y + 0.62 * T); }
    g.strokePath();
    if (n === 1 && this.floatText) this.floatText(t, 'Tough rock! ' + (hits - n) + ' more');
  };
  var setupMine = P.setupMine;
  P.setupMine = function () {
    setupMine.call(this);
    var v = F.session.visit, seed = v && v.inTown && v.state.mineSeed, key = (seed ? 'v' + seed + ':' : '') + this.state.day + ':' + F.session.mineFloor;
    var all = F.session.mineCracks = F.session.mineCracks || {}, self = this, w = this.map.width;
    this.mine.cracks = all[key] = all[key] || {};
    Object.keys(this.mine.cracks).forEach(function (i) {
      if (self.mine.broken[i]) return;
      self.crackRock(+i, { x: i % w, y: Math.floor(i / w) }, L.rockHitsAt(self.state, F.session.mineFloor, +i, self.mine.seed));
    });
  };
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var show = breakRock.apply(this, arguments), g = this.mine && this.mine.crackG && this.mine.crackG[idx];
    if (show && g) { g.destroy(); delete this.mine.crackG[idx]; }
    return show;
  };

  // ---------- the critters ----------
  // Their pictures: a row of the Wild Lands' sheet in their own colour once that pack is on the phone (it is opened then,
  // from the phone, for the next floor); until then a small drawn stand-in, one picture each, grumpy brows and all.
  var frameOf = function (def, k) { return WI.order.indexOf(def.row) * 12 + k; };
  var art = function () { return !!(F.images && F.images.wild); };
  // the owner's own picture of each (18 Nov 2026, the 'vehicles' pack: tools/art/vehicles-import.js; 160 x 150 as the
  // stand-in, facing left) is used first once it is on the phone
  var own = function (kind) { return !!(F.images && F.images['critter_' + kind]); };
  var standIn = function (scene, kind) {
    if (own(kind)) return F.ensureTexture(scene, 'critter_' + kind);
    var key = 'fx-critter-' + kind;
    if (scene.textures.exists(key)) return key;
    var Wd = 160, Hd = 150, c = scene.textures.createCanvas(key, Wd, Hd), g = c.getContext(), col = '#' + ('00000' + D.critters[kind].tint.toString(16)).slice(-6);
    var blob = function (x, y, rx, ry, fill) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = '#2a1a10'; g.stroke(); };
    if (kind === 'bat') { [[-1, 30], [1, 130]].forEach(function (w) { g.beginPath(); g.moveTo(80, 80); g.quadraticCurveTo(w[1], 20, w[1] + w[0] * 26, 92); g.quadraticCurveTo(w[1] - w[0] * 6, 70, 80, 100); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 6; g.strokeStyle = '#2a1a10'; g.stroke(); }); }
    else { blob(52, 46, 16, 18, col); blob(108, 46, 16, 18, col); } // (ears)
    blob(80, 90, kind === 'piglet' ? 56 : 48, kind === 'piglet' ? 46 : 50, col);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(62, 70, 16, 10, -0.5, 0, Math.PI * 2); g.fill();
    [62, 98].forEach(function (x) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, 84, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a1008'; g.beginPath(); g.arc(x + 2, 86, 5, 0, Math.PI * 2); g.fill(); });
    g.lineWidth = 7; g.strokeStyle = '#1a1008'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(48, 66); g.lineTo(72, 76); g.moveTo(112, 66); g.lineTo(88, 76); g.stroke(); // (grumpy)
    if (kind === 'piglet') blob(80, 108, 18, 12, '#d8a8a8'); else { g.fillStyle = '#e08a8a'; g.beginPath(); g.arc(80, 102, 7, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = 5; g.beginPath(); g.arc(80, 128, 10, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); // (a frown)
    c.refresh();
    return key;
  };
  // The owner's picture of a kind just came in (owner, 24 Nov 2026, floor 3,101: "the enemies on mine looks like hasnt an
  // art yet": the first deep floor of a visit kept the drawn stand-ins, the pictures fetched only for the next floor).
  // The critters on this floor take it at once, the stand-in or the Wild Lands' row put away.
  P.deepOwnArt = function (kind) {
    if (!this.deep || !own(kind) || !this.sys || !this.sys.isActive()) return;
    var key = F.ensureTexture(this, 'critter_' + kind);
    this.deep.forEach(function (a) {
      if (a.kind !== kind || (a.img.texture && a.img.texture.key === key)) return;
      a.art = false;
      a.scale = a.def.w * T / 160;
      a.img.setTexture(key).setOrigin(0.5, 0.95).setScale(a.scale).clearTint().setFlipX(false);
    });
  };
  if (F.bus) F.bus.on('packart', function (k) {
    var m = /^critter_([a-z]+)$/.exec(String(k || ''));
    if (m && F.world && F.world.deepOwnArt) F.world.deepOwnArt(m[1]);
  });
  // (asked for as soon as you are in the Mine with the deep floors reached: they are small, about 8 KB each)
  var askOwnArt = function () {
    if (!F.needImage || !F.canFetch || !F.canFetch()) return;
    D.critterOrder.forEach(function (k) { if (!own(k) && F.packedFile && F.packedFile('critter_' + k)) F.needImage('critter_' + k); });
  };
  P.deepSetup = function () {
    var floor = F.session.mineFloor, n = L.critterCount(floor), kinds = L.critterKinds(floor), rect = this.zones.minefloor[0];
    var s = F.session.state;
    if (!F.session.visit && (n || (s && s.stats && s.stats.deepest >= D.from - 100))) askOwnArt();
    if (!n || F.session.visit) return;
    if (!art() && F.packOnPhone && F.packOnPhone('wild') && !F.packReady('wild')) F.loadPack('wild');
    var f = this.feet(), free = [];
    for (var y = rect.y0; y <= rect.y1; y++) for (var x = rect.x0; x <= rect.x1; x++) {
      if (this.walkable(x, y) && Math.hypot((x + 0.5) * T - f.x, (y + 0.5) * T - f.y) > 4 * T) free.push([x, y]);
    }
    var drawn = art(), key = drawn ? F.ensureTexture(this, 'wild') : null;
    this.deep = [];
    for (var i = 0; i < n && free.length; i++) {
      var kind = kinds[Math.floor(Math.random() * kinds.length)], def = D.critters[kind], at = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      var wild = drawn && !own(kind), scale = wild ? def.w * T / WI.animals[def.row].px : def.w * T / 160, px = (at[0] + 0.5) * T, py = (at[1] + 0.7) * T;
      var a = { kind: kind, def: def, x: px, y: py, hp: L.critterHp(kind, floor), max: L.critterHp(kind, floor), mode: 'idle', t: rand(800, 2500), vx: 0, vy: 0,
        cool: 2500, dir: 'side', left: true, step: 0, hitT: 0, scale: scale, art: wild,
        img: wild ? this.add.image(px, py, key, frameOf(def, FACING.side)).setOrigin(0.5, FEET / FRAME_H).setScale(scale).setTint(def.tint)
          : this.add.image(px, py, standIn(this, kind)).setOrigin(0.5, 0.95).setScale(scale),
        sh: this.add.ellipse(px, py, def.w * T * 0.8, def.w * T * 0.28, 0x000000, 0.32).setDepth(DEPTH.shadow) };
      this.deep.push(a);
    }
    if (!this.deep.length) this.deep = null;
  };
  // Free floor for a critter (a bat flies over rocks, never out of the floor).
  P.deepFree = function (a, x, y) {
    var r = this.zones.minefloor[0], tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) return false;
    return a.def.flies || this.walkable(tx, ty);
  };
  P.deepUpdate = function (dt) {
    var self = this, f = this.feet(), busy = this.busy || !F.ui || F.ui.blocking();
    this.deep.forEach(function (a) {
      var d = Math.hypot(a.x - f.x, a.y - f.y) / T, def = a.def;
      a.cool -= dt;
      a.t -= dt;
      if (busy && a.mode !== 'idle') { a.mode = 'idle'; a.vx = a.vy = 0; a.t = 1500; }
      if (!busy && a.cool <= 0 && d < def.angry && (a.mode === 'idle' || a.mode === 'walk')) { // (a warning first: time to step aside)
        a.mode = 'warn';
        a.vx = a.vy = 0;
        a.t = 750;
        a.left = f.x < a.x;
        if (self.floatTextAt) self.floatTextAt(a.x, a.y - 1.1 * T, 'Hmph!');
      } else if (a.t <= 0) {
        if (a.mode === 'warn') {
          var ang = Math.atan2(f.y - a.y, f.x - a.x);
          a.mode = 'charge';
          a.vx = Math.cos(ang) * def.run * T;
          a.vy = Math.sin(ang) * def.run * T;
          a.t = 1400;
          sfx('nope');
        } else {
          if (a.mode === 'charge') a.cool = 3500;
          var r = Math.random(), g = rand(0, Math.PI * 2);
          if (r < 0.45) { a.mode = 'idle'; a.vx = a.vy = 0; a.t = rand(1500, 4000); } else { a.mode = 'walk'; a.vx = Math.cos(g) * def.walk * T; a.vy = Math.sin(g) * def.walk * T * 0.7; a.t = rand(1200, 3000); }
        }
      }
      if (a.mode === 'charge' && d < 0.55) self.deepHit(a, f);
      if (a.vx || a.vy) {
        var nx = a.x + a.vx * dt / 1000, ny = a.y + a.vy * dt / 1000;
        if (self.deepFree(a, nx, ny)) { a.x = nx; a.y = ny; } else { a.vx = a.vy = 0; a.t = Math.min(a.t, 300); }
        var ax = Math.abs(a.vx), ay = Math.abs(a.vy);
        if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = a.vy > 0 ? 'down' : 'up';
        if (ax > 4) a.left = a.vx < 0;
        a.step += dt;
      }
      var fast = a.mode === 'charge', moving = a.vx || a.vy;
      var fr = !moving ? (a.mode === 'warn' ? 9 : a.mode === 'idle' && d < def.angry * 1.8 ? 9 : FACING[a.dir]) : fast && a.dir === 'side' ? (Math.floor(a.step / 120) % 2 ? 11 : 7) : FACING[a.dir] + STEPS[Math.floor(a.step / (fast ? 110 : 180)) % 4];
      var lift = def.flies ? 0.3 * T + Math.sin(a.step / 120 + a.x) * 0.06 * T : 0, squash = 0;
      if (a.hitT > 0) { a.hitT -= dt; squash = Math.max(0, a.hitT / 180) * 0.22; }
      if (a.art) a.img.setFrame(frameOf(def, fr)).setFlipX(fr >= 6 && fr !== 9 && !a.left).setTint(a.hitT > 90 ? 0xffffff : def.tint);
      else { a.img.setFlipX(!a.left); squash += moving ? Math.abs(Math.sin(a.step / (fast ? 70 : 140))) * 0.06 : 0; if (a.hitT > 90) a.img.setTintFill(0xffffff); else a.img.clearTint(); }
      a.img.setPosition(a.x, a.y - lift).setScale(a.scale * (1 + squash), a.scale * (1 - squash));
      a.sh.setPosition(a.x, a.y);
      F.depthTo(a.img, DEPTH.actor + a.y / 1e5);
      if (a.bar) { a.bar[0].setPosition(a.x, a.y - 1.05 * T); a.bar[1].setPosition(a.x - 0.4 * T, a.y - 1.05 * T); }
    });
  };
  // A charge reached you: its energy (L.critterLoss), a bump, and it backs off (as a cave monster's, 19v-wild.js wildHit).
  P.deepHit = function (a, f) {
    var s = this.state, lost = L.critterLoss(s, a.kind, F.session.mineFloor), dx = f.x - a.x, dy = f.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
    s.energy = Math.max(0, s.energy - lost);
    this.floatTextAt(f.x, f.y - 1.6 * T, '-' + lost + ' energy');
    this.cameras.main.shake(140, 0.003);
    for (var k = 1; k > 0.2; k /= 2) {
      var nx = f.x + dx / len * 0.5 * T * k, ny = f.y + dy / len * 0.5 * T * k;
      if (!this.feetFit || this.feetFit(nx, ny)) { this.setFeet(nx, ny); var b = this.player.body; b.prev.copy(b.position); b.prevFrame.copy(b.position); break; }
    }
    a.mode = 'walk';
    a.vx = -dx / len * a.def.walk * T;
    a.vy = -dy / len * a.def.walk * T;
    a.t = 2200;
    a.cool = 4500;
    F.bus.emit('hud');
    this.changed();
    if (s.energy <= 0) this.faint();
  };
  // The critter in front of you, near enough to bonk.
  P.deepTarget = function () {
    if (!this.deep) return null;
    var pt = this.front(0.7), best = null, bd = 1.05 * T;
    this.deep.forEach(function (a) { var d = Math.hypot(a.x - pt.x, a.y - 0.25 * T - pt.y); if (d < bd) { bd = d; best = a; } });
    return best;
  };
  P.deepBonk = function (a) {
    var self = this, s = this.state, floor = F.session.mineFloor;
    this.animateUse(L.iconOf(s, 'hammer'), 'swing');
    this.time.delayedCall(this.IMPACT ? this.IMPACT.swing : 110, function () {
      if (!self.deep || self.deep.indexOf(a) < 0) return;
      a.hp -= 1;
      a.hitT = 180;
      sfx('smash');
      if (!a.bar) a.bar = [self.add.rectangle(a.x, a.y, 0.84 * T, 0.13 * T, 0x2a1a10).setDepth(DEPTH.fx), self.add.rectangle(a.x, a.y, 0.8 * T, 0.09 * T, 0xe0503a).setOrigin(0, 0.5).setDepth(DEPTH.fx)];
      a.bar[1].width = 0.8 * T * Math.max(0, a.hp) / a.max;
      if (a.mode !== 'charge') { a.mode = 'idle'; a.vx = a.vy = 0; a.t = 600; a.cool = Math.max(a.cool, 900); }
      if (a.hp > 0) return;
      self.deep.splice(self.deep.indexOf(a), 1);
      var puff = self.add.circle(a.x, a.y - 0.3 * T, 0.4 * T, 0xd8d0c0, 0.8).setDepth(DEPTH.fx);
      self.tweens.add({ targets: puff, scale: 1.8, alpha: 0, duration: 420, onComplete: function () { puff.destroy(); } });
      [a.img, a.sh].concat(a.bar).forEach(function (o) { o.destroy(); });
      var id = L.critterDrop(floor), name = a.def.name;
      if (L.addItem(s, id, 1) > 0) return F.ui.toast('The ' + name + ' scampers off. Your bag is full!');
      L.discover(s, id);
      self.floatTextAt(a.x, a.y - 1.2 * T, '+1 ' + C.ITEMS[id].name);
      F.ui.toast('The ' + name + ' scampers off, grumbling. It dropped ' + C.ITEMS[id].name + '!', 2200);
      self.changed();
    });
  };

  var resolve = P.resolve;
  P.resolve = function () {
    var held = this.deep && L.held(this.state), a = held && held.id === 'hammer' ? this.deepTarget() : null, self = this;
    if (a) return { label: 'Bonk', icon: L.iconOf(this.state, 'hammer'), run: function () { self.deepBonk(a); } };
    return resolve.call(this);
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.deep && !this.busy && this.sys.isActive()) this.deepUpdate(Math.min(delta, 100));
  };

  // ---------- the tour, the first time past floor 1,200 ----------
  var create = P.create;
  P.create = function () {
    this.deep = null;
    create.call(this);
    if (this.mapKey !== 'mine') return;
    this.deepSetup();
    var self = this, s = F.session.state;
    if (!L.deepTier(F.session.mineFloor) || F.session.visit || quiet() || L.tipSeen(s, 'deep_tour')) return;
    var tries = 0, show = function () {
      if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'deep_tour')) return;
      if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, show);
      L.takeTip(s, 'deep_tour');
      F.Host.save(s);
      F.ui.tour('deep_mine');
    };
    this.time.delayedCall(2200, show);
  };

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.deep_mine = {
    title: 'THE DEEP HALLS',
    steps: [
      { text: 'The deep halls grow harder: past floor 1,200 a rock takes a few more swings. A better Hammer breaks it sooner, and a rock costs no more energy than before.',
        draw: function (ui, sc, move) {
          var rock = icon(ui, sc, 132, 72, C.ICON.stone, 0.62), crack = ui.add.rectangle(128, 70, 5, 30, 0x1a1008).setAngle(18);
          sc.add(crack);
          var h = icon(ui, sc, 192, 44, C.ITEMS.hammer.icon, 0.34);
          tw(ui, move, { targets: h, angle: { from: -10, to: -55 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          tw(ui, move, { targets: rock, scale: { from: 1, to: 0.94 }, duration: 380, yoyo: true, repeat: -1, delay: 190 });
        } },
      { text: 'Grumpy critters live down here. When one huffs, step aside! Bonk it with your Hammer (free) and it scampers off, leaving an ore.',
        draw: function (ui, sc, move) {
          var key = art() ? F.ensureTexture(ui, 'wild') : null;
          D.critterOrder.forEach(function (k, i) {
            var def = D.critters[k], x = 64 + i * 72;
            var im = key && !own(k) ? ui.add.image(x, 104, key, frameOf(def, 9)).setOrigin(0.5, 1).setScale(0.32).setTint(def.tint) : ui.add.image(x, 104, standIn(ui, k)).setOrigin(0.5, 1).setScale(0.42);
            sc.add(im);
            tw(ui, move, { targets: im, y: im.y - 8, duration: 320, delay: i * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
          var t = ui.txt(136, 18, 'Hmph!', 14, '#7a2a1a', { fontStyle: 'bold' }).setOrigin(0.5);
          sc.add(t);
        } },
      { text: 'And the deeper you go, the more Starstone and Diamond the rocks hold.',
        draw: function (ui, sc, move) {
          [C.ITEMS.starstone.icon, C.ITEMS.diamond.icon].forEach(function (f, i) {
            var im = icon(ui, sc, 100 + i * 72, 66, f, 0.36);
            tw(ui, move, { targets: im, scale: 0.42, duration: 520, delay: i * 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        } },
    ],
  };
})(window.Farm = window.Farm || {});
