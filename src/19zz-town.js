// Willowbrook Station in town (rules: 01-logicZ-town.js; panels and the tour: 19zz-town-ui.js). The station, the rails,
// the train, the crates on the platform and the visitors are painted pictures (art-src/station/, made into the town's own
// sheets by tools/art/station-import.js); the buffer stop, the steam and the wish bubble are still drawn here on canvases.
// The map holds their places (tools/town-station.js). The train rolls in with a whistle
// and steam, its visitors step off and walk about town (the villagers' walking, 15-villagers.js) with what they wish for
// in a bubble, and walk back before it leaves. Flags over the plaza and lanterns along Market Street come with the
// Town Level.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TW = C.TW;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var V = F.Villagers.prototype;
  // the painted sheets (tools/art/station-import.js): the train is one picture of 12 x 2 tiles, its chimney 0.82 tiles from
  // the front; its wheels stand on the near rail, 0.3 tiles above the bottom of the track's picture
  var TW_ART = ['tw_station', 'tw_rails', 'tw_train', 'tw_crates', 'tw_people'];
  var CRATE = 0, CRATE_FULL = 1, PALLET = 2; // the frames of tw_crates
  var TRAIN_TILES = 12, TRAIN_H = 2, CHIMNEY = 0.82, ON_RAIL = 0.3, STOP_X = 42.9, OFF_X = 56.5; // (where it stops, where it is out of sight)
  var ARRIVE_MS = 5200, LEAVE_MS = 4600;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var me = function () { return F.session && F.session.state; };

  // ---------- sounds: a whistle and the engine's chuff ----------
  var A = F.Audio, sfxOf = A.sfx;
  var tone = function (freq, dur, type, vol, slide, delay) {
    var ctx = A.ctx, t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(A.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  var hiss = function (dur, freq, vol, delay) {
    var ctx = A.ctx, t = ctx.currentTime + (delay || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(A.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  };
  var OWN = {
    tw_whistle: function () { // two notes together, a long one and a short one: toot-toooot
      [[0, 0.32], [0.42, 0.9]].forEach(function (p) { tone(587, p[1], 'triangle', 0.16, null, p[0]); tone(740, p[1], 'sine', 0.12, null, p[0]); tone(880, p[1], 'sine', 0.05, 870, p[0]); });
    },
    tw_chuff: function () { for (var i = 0; i < 6; i++) hiss(0.16, 900 - i * 40, 0.2 - i * 0.02, i * 0.24); },
    tw_bell: function () { tone(1320, 0.5, 'sine', 0.12); tone(1980, 0.35, 'sine', 0.05); },
  };
  A.sfx = function (name) {
    if (OWN[name]) { if (A.ctx && A.opts.sfx && A.ctx.state === 'running' && A.noiseBuf) OWN[name](); return; }
    return sfxOf.apply(A, arguments);
  };

  // ---------- the pictures still drawn (once) ----------
  var canvas = function (w, key, cw, ch, draw) {
    if (!w.textures.exists(key)) {
      var t = w.textures.createCanvas(key, cw, ch);
      draw(t.getContext(), cw, ch);
      t.refresh();
    }
    return key;
  };
  var rr = function (g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  var grad = function (g, y0, y1, a, b) { var gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  var LINE = '#2a170b';
  var box = function (g, x, y, w, h, fill, r, lw) {
    rr(g, x, y, w, h, r || 0.01);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = lw || 5;
    g.strokeStyle = LINE;
    g.stroke();
  };

  // the buffer stop at the end of the line (no painted one yet): a red and white beam on two posts
  var bufferTex = function (w) {
    return canvas(w, 'tw-buffer', 128, 128, function (g) {
      box(g, 24, 46, 16, 72, '#5c371a', 3, 4);
      box(g, 88, 46, 16, 72, '#5c371a', 3, 4);
      box(g, 14, 40, 100, 30, grad(g, 40, 70, '#e04a3a', '#a02a20'), 6, 5);
      g.fillStyle = '#ffffff';
      [30, 64, 98].forEach(function (x) { g.fillRect(x - 6, 46, 12, 18); });
    });
  };

  var puffTex = function (w) {
    return canvas(w, 'tw-puff', 64, 64, function (g) {
      var r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      r.addColorStop(0, 'rgba(255,255,255,0.95)');
      r.addColorStop(0.6, 'rgba(236,236,236,0.7)');
      r.addColorStop(1, 'rgba(220,220,220,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
  };
  var wishTex = function (w) {
    return canvas(w, 'tw-wish', 96, 104, function (g) {
      g.beginPath();
      g.arc(48, 46, 40, 0, Math.PI * 2);
      g.moveTo(38, 82);
      g.lineTo(48, 102);
      g.lineTo(58, 82);
      g.fillStyle = '#fffdf2';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#5a3a1e';
      g.stroke();
    });
  };

  // every picture, for the tour too (it can open from What's new anywhere: it asks only for the sheets it shows)
  F.twTextures = function (scene, only) {
    (only || TW_ART).forEach(function (k) { F.ensureTexture(scene, k); });
    bufferTex(scene);
    puffTex(scene);
    wishTex(scene);
  };

  // ---------- setting up in town ----------
  var rectOf = function (w, type) { return w.objects.filter(function (o) { return o.type === type; })[0] || null; };
  var solid = function (w, r) {
    for (var y = r.y0; y <= r.y1; y++) for (var x = r.x0; x <= r.x1; x++) w.blocked[w.idx(x, y)] = true;
    var zone = w.add.zone((r.x0 + r.x1 + 1) / 2 * T, (r.y0 + r.y1 + 1) / 2 * T, (r.x1 - r.x0 + 1) * T - 16, (r.y1 - r.y0 + 1) * T - 16);
    w.physics.add.existing(zone, true);
    w.solids.add(zone);
  };

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    this.tw = null;
    if (this.mapKey !== 'town' || this.state.isVisit) return;
    var st = rectOf(this, 'station'), rails = rectOf(this, 'rails'), cargo = rectOf(this, 'cargo');
    if (!st || !rails || !cargo) return;
    var self = this, s = me();
    [st, rails, cargo].forEach(function (r) { solid(self, r); });
    var tw = this.tw = { st: st, rails: rails, cargo: cargo, train: null, shown: false, moving: false, absent: false, crates: [], sig: '', ms: 0, puffMs: 0, deco: -1, decos: [] };
    this.add.image(st.x0 * T, (st.y1 + 1) * T, F.ensureTexture(this, 'tw_station')).setOrigin(0, 1).setDisplaySize((st.x1 - st.x0 + 1) * T, (st.y1 - st.y0 + 1) * T).setDepth(DEPTH.actor + (st.y1 + 1) * T / 1e5);
    tw.level = this.add.text((st.x0 + 4.2) * T, (st.y1 + 0.2) * T, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '58px', fontStyle: 'bold', color: '#5a3a1e', backgroundColor: '#ffe9a8', padding: { x: 14, y: 4 } })
      .setOrigin(0.5, 1).setDepth(DEPTH.actor + (st.y1 + 1) * T / 1e5 + 0.0001);
    this.add.rectangle(rails.x0 * T, (rails.y1 + 1) * T + 6, (cargo.x1 + 1 - rails.x0) * T, 22, 0xf2d46a).setOrigin(0).setDepth(DEPTH.flat); // the platform's edge: mind the gap
    this.add.image(rails.x0 * T, (rails.y1 + 1) * T, F.ensureTexture(this, 'tw_rails')).setOrigin(0, 1).setDisplaySize(TRAIN_TILES * T, T).setDepth(DEPTH.flat);
    this.add.image(rails.x0 * T - 0.2 * T, (rails.y1 + 1) * T - 0.1 * T, bufferTex(this)).setOrigin(0, 1).setDisplaySize(T, T).setDepth(DEPTH.actor + 3 * T / 1e5);
    tw.train = this.add.image(OFF_X * T, (rails.y1 + 1 - ON_RAIL) * T, F.ensureTexture(this, 'tw_train')).setOrigin(0, 1).setDisplaySize(TRAIN_TILES * T, TRAIN_H * T).setDepth(DEPTH.actor + (rails.y1 + 1) * T / 1e5).setVisible(false);
    F.twTextures(this);
    for (var i = 0; i < cargo.x1 - cargo.x0 + 1; i++) {
      var x = (cargo.x0 + i + 0.5) * T, y = (cargo.y1 + 1) * T - 12;
      tw.crates.push({
        img: this.add.image(x, y, 'tw_crates', PALLET).setOrigin(0.5, 1).setDisplaySize(0.9 * T, 0.9 * T).setDepth(DEPTH.actor + y / 1e5),
        icon: this.add.image(x, y - 0.62 * T, 'items', 0).setScale(0.62).setDepth(DEPTH.actor + y / 1e5 + 0.00001).setVisible(false),
      });
    }
    if (this.villagers) this.villagers.addTourists();
    L.twTick(s);
    this.twRefresh(true);
  };

  // The crates, the level board and the decorations, when what they show has changed (or `force`).
  P.twRefresh = function (force) {
    var tw = this.tw, s = me();
    if (!tw) return;
    var o = s.tw.o, sig = o ? o.no + ':' + o.crates.map(function (c) { return c.done; }).join('') : 'none';
    if (force || sig !== tw.sig) {
      tw.sig = sig;
      tw.crates.forEach(function (c, i) {
        var crate = o && o.crates[i];
        c.img.setFrame(!crate ? PALLET : crate.done ? CRATE_FULL : CRATE).setDisplaySize(0.9 * T, 0.9 * T);
        c.icon.setVisible(!!crate && !crate.done);
        if (crate) c.icon.setFrame(C.ITEMS[crate.id].icon);
      });
    }
    var lv = L.twLevel(s);
    tw.level.setText('Lv ' + lv);
    if (lv !== tw.deco) this.twDecorate(lv);
  };

  // ---------- decorations with the Town Level ----------
  // Drawn once into a small texture (a quarter of the world's size) and shown as one picture: a live Graphics would be
  // drawn again every frame, too much for a low-end phone.
  var DECO = 0.25;
  var bakeDeco = function (w, key, x0, y0, wTiles, hTiles, draw) {
    if (!w.textures.exists(key)) {
      var g = w.make.graphics({ x: 0, y: 0 }, false);
      draw(g, function (x, y) { return { x: (x - x0) * DECO, y: (y - y0) * DECO }; });
      g.generateTexture(key, Math.ceil(wTiles * T * DECO), Math.ceil(hTiles * T * DECO));
      g.destroy();
    }
    return w.add.image(x0, y0, key).setOrigin(0).setScale(1 / DECO).setDepth(DEPTH.Above - 1);
  };
  var COLORS = [0xe8503a, 0xffd23f, 0x4a90c9, 0x5fa84a, 0xe85a8a];
  // a string of little flags between two points, sagging in the middle
  var flags = function (g, to, x0, y0, x1, y1) {
    var n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 110)), sag = 0.35 * T;
    var at = function (t) { return to(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag); };
    g.lineStyle(7 * DECO, 0x5a3a1e, 1);
    g.beginPath();
    for (var k = 0; k <= 16; k++) { var p = at(k / 16); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }
    g.strokePath();
    for (var i = 0; i < n; i++) {
      var a = at((i + 0.25) / n), b = at((i + 0.75) / n), m = at((i + 0.5) / n);
      g.fillStyle(COLORS[i % COLORS.length], 1);
      g.fillTriangle(a.x, a.y, b.x, b.y, m.x, m.y + 70 * DECO);
    }
  };
  P.twDecorate = function (lv) {
    var tw = this.tw;
    tw.deco = lv;
    tw.decos.forEach(function (d) { d.destroy(); });
    tw.decos = [];
    if (lv >= TW.flagsAt) { // over the plaza, lamp to lamp, all round
      tw.decos.push(bakeDeco(this, 'tw-deco-flags', 8 * T, 12.8 * T, 14, 8.2, function (g, to) {
        var top = 13.1 * T, bottom = 20.1 * T, left = 8.5 * T, right = 21.5 * T;
        flags(g, to, left, top, right, top);
        flags(g, to, left, bottom, right, bottom);
        flags(g, to, left, top, left, bottom);
        flags(g, to, right, top, right, bottom);
      }));
    }
    if (lv >= TW.lanternsAt) { // along Market Street, post to post
      tw.decos.push(bakeDeco(this, 'tw-deco-lanterns', 29 * T, 10 * T, 23, 2, function (h, to) {
        var posts = [29.5, 35, 40.5, 46, 51.5], y = 11.15 * T, d = DECO;
        posts.forEach(function (px, i) {
          var top = to(px * T - 12, y - 0.85 * T);
          h.fillStyle(0x5a3a1e, 1);
          h.fillRect(top.x, top.y, 24 * d, 0.95 * T * d); // (short posts: the road stays clear)
          if (!i) return;
          var x0 = posts[i - 1] * T, x1 = px * T;
          h.lineStyle(6 * d, 0x3d2614, 1);
          h.beginPath();
          for (var k = 0; k <= 12; k++) { var q = to(x0 + (x1 - x0) * k / 12, y + Math.sin(Math.PI * k / 12) * 0.3 * T); if (k) h.lineTo(q.x, q.y); else h.moveTo(q.x, q.y); }
          h.strokePath();
          [0.25, 0.5, 0.75].forEach(function (t) {
            var c = to(x0 + (x1 - x0) * t, y + Math.sin(Math.PI * t) * 0.3 * T);
            h.fillStyle(0xffb03a, 1);
            h.fillCircle(c.x, c.y + 46 * d, 38 * d);
            h.fillStyle(0xfff0b0, 1);
            h.fillCircle(c.x - 8 * d, c.y + 38 * d, 14 * d);
            h.fillStyle(0x8e2f22, 1);
            h.fillRect(c.x - 22 * d, c.y + 4 * d, 44 * d, 12 * d);
          });
        });
      }));
    }
  };

  // ---------- the train comes and goes ----------
  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    updateExtras.call(this, dt, time);
    var tw = this.tw;
    if (!tw) return;
    this.twWishMarks();
    if (tw.shown && (tw.moving || Math.random() < dt / 900)) { // steam: puffing hard on the move, now and then when standing
      tw.puffMs -= dt;
      if (tw.puffMs <= 0) { tw.puffMs = tw.moving ? 140 : 0; this.twPuff(); }
    }
    tw.ms -= dt;
    if (tw.ms > 0) return;
    tw.ms = 500;
    var s = me(), tr = L.twTrain(s);
    if (tr && !tw.shown) this.twArrive(tw.absent);
    else if (!tr && tw.shown && !tw.moving) this.twLeave(true);
    if (!tr) tw.absent = true;
    this.twRefresh(false);
  };

  P.twPuff = function () {
    var tw = this.tw, x = tw.train.x + (CHIMNEY + (tw.moving === 'out' ? 0.08 : 0)) * T, y = tw.train.y - TRAIN_H * T + 0.1 * T;
    var p = this.add.image(x, y, 'tw-puff').setScale(1.6 + Math.random()).setDepth(DEPTH.Above - 2).setAlpha(0.9);
    this.tweens.add({ targets: p, x: x + (Math.random() - 0.2) * 0.8 * T, y: y - (0.9 + Math.random() * 0.6) * T, scale: p.scale * 2.2, alpha: 0, duration: 1600 + Math.random() * 600, onComplete: function () { p.destroy(); } });
  };

  // live: you were in town as it came (it rolls in, whistling); otherwise it is simply there.
  P.twArrive = function (live) {
    var tw = this.tw, self = this;
    tw.shown = true;
    tw.train.setVisible(true);
    if (!live) {
      tw.train.x = STOP_X * T;
      this.villagers.twBoard(false);
      return;
    }
    tw.train.x = OFF_X * T;
    tw.moving = 'in';
    sfx('tw_whistle');
    sfx('tw_chuff');
    this.tweens.add({
      targets: tw.train, x: STOP_X * T, duration: ARRIVE_MS, ease: 'Cubic.out', onComplete: function () {
        tw.moving = false;
        sfx('tw_bell');
        for (var k = 0; k < 6; k++) self.twPuff();
        if (self.cameras && self.cameras.main && self.twNear(12)) self.cameras.main.shake(180, 0.0025);
        self.villagers.twBoard(true);
      },
    });
  };
  P.twLeave = function (live) {
    var tw = this.tw;
    this.villagers.twHome();
    if (!live) { tw.shown = false; tw.train.setVisible(false); return; }
    tw.moving = 'out';
    sfx('tw_whistle');
    this.time.delayedCall(700, function () { sfx('tw_chuff'); });
    this.tweens.add({
      targets: tw.train, x: OFF_X * T, duration: LEAVE_MS, delay: 900, ease: 'Cubic.in', onComplete: function () {
        tw.moving = false;
        tw.shown = false;
        tw.train.setVisible(false);
      },
    });
  };
  // Is the farmer within n tiles of the station?
  P.twNear = function (n) {
    var tw = this.tw;
    if (!tw || !this.player) return false;
    var f = this.feet();
    return Math.abs(f.x / T - (tw.st.x0 + 5)) < n && Math.abs(f.y / T - (tw.st.y0 + 3)) < n * 0.8;
  };

  // ---------- the clock: trains, orders, visitors ----------
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var ended = tickClock.call(this, dt), s = me();
    if (!s || !s.tw) return ended;
    var ev = L.twTick(s);
    if (ev.order || ev.expired || ev.arrived) this.changed();
    var ui = F.ui;
    if (ui && !quiet()) {
      if (ev.expired) ui.toast('The cargo time is up: ' + ev.expired.filled + ' of ' + ev.expired.of + ' crates went. A new order comes with the next train.', 3600);
      else if (ev.arrived) ui.toast('Toot toot! The ' + L.formatTime(ev.arrived.arrive % 1440) + ' train is in' + (ev.order ? ', with a new cargo order' : '') + '. Visitors are about town!', 3600, 0x2f5a7a);
    }
    if (s.tw.up && ui && !ui.modals.length) { // a level from a stall sale (the panels show their own)
      var up = s.tw.up;
      s.tw.up = null;
      ui.toast('Town Level ' + up.level + '! ' + TW.levels[up.level - 1].text + ' +' + up.gift + 'G', 4200, 0x7a4d12);
      sfx('fanfare');
      if (this.tw) this.twRefresh(true);
    }
    return ended;
  };

  // ---------- what the farmer can do here ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (this.tw) {
      if (o.type === 'station') return { label: 'Station', icon: C.ICON.calendar, run: function () { F.ui.openStation('cargo'); } };
      if (o.type === 'cargo') return { label: 'Cargo', icon: C.ICON.crate, run: function () { F.ui.openStation('cargo'); } };
      if (o.type === 'rails') {
        var tr = L.twTrain(me());
        if (!tr) return null;
        return { label: 'Train', icon: C.ICON.calendar, run: function () { F.ui.dialog('THE VALLEY TRAIN\nIn from the city at ' + L.formatTime(tr.arrive % 1440) + '. It leaves at ' + L.formatTime(tr.leave % 1440) + ', with its visitors.'); } };
      }
    }
    return extraObjectAction.call(this, o, held, def);
  };

  // ---------- the visitors off the train ----------
  // Each has their own walking sheet: row k of tw_people (C.TW.visitors in order, then the Collector), 9 frames like a
  // villager's in the people sheet (rows of 3: facing you, away, left), so the villagers' walking and standing work as
  // they are. The sheet is the town's own: made here, let go elsewhere (19zzzz-perf.js), with its walks.
  var WHO = TW.visitors.concat([TW.collector]);
  var twAnims = function (scene) {
    F.ensureTexture(scene, 'tw_people');
    WHO.forEach(function (vd, k) {
      ['down', 'up', 'side'].forEach(function (d, j) {
        var f = k * 9 + j * 3, key = 'v-' + vd.key + '-' + d;
        if (!scene.anims.exists(key)) scene.anims.create({ key: key, frames: scene.anims.generateFrameNumbers('tw_people', { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
      });
    });
  };

  // One person per visitor (and the Collector), hidden until their train is in.
  V.addTourists = function () {
    var self = this, sc = this.scene;
    twAnims(sc);
    this.tourists = WHO.map(function (vd, k) {
      var who = k < TW.visitors.length ? k : -1;
      var v = {
        key: vd.key, i: k, def: { name: vd.name, line: vd.line }, tourist: true, who: who, place: 'gone', target: null,
        path: [], hold: 0, dir: 'down', visible: false, n: 0, dwell: 0, stops: [], out: -1,
        sprite: sc.add.sprite(0, 0, 'tw_people', k * 9).setOrigin(0.5, 0.83).setScale(2).setVisible(false),
        mark: null,
      };
      sc.physics.add.existing(v.sprite);
      v.sprite.body.setSize(60, 30).setOffset(34, 145).setImmovable(true);
      v.sprite.body.moves = false;
      v.sprite.body.enable = false;
      sc.physics.add.collider(sc.player, v.sprite);
      self.list.push(v);
      return v;
    });
  };
  var targetOf = V.targetOf;
  V.targetOf = function (v, time) {
    if (v.tourist) return v.target || { place: 'gone', point: null, hide: true };
    return targetOf.call(this, v, time);
  };
  var platform = function (sc) { var p = sc.points; return Math.random() < 0.5 ? p.platform_w : p.platform_e; };

  // The visitors of the train now step off (live: one by one at the doors) or are already out in town.
  V.twBoard = function (live) {
    var self = this, sc = this.scene, s = me(), wishes = L.twWishes(s);
    (this.tourists || []).forEach(function (v) {
      var k = wishes.map(function (w) { return w.who; }).indexOf(v.who);
      if (k < 0 || v.out === s.tw.t) return;
      v.out = s.tw.t;
      var stops = TW.stops.filter(function (n) { return sc.points[n]; }).sort(function () { return Math.random() - 0.5; });
      v.stops = stops.slice(0, 3 + Math.floor(Math.random() * 3));
      v.leaving = false;
      var go = function () {
        var from = platform(sc);
        if (!live && v.stops.length) from = sc.points[v.stops.shift()];
        self.put(v, from.x + (Math.random() - 0.5) * 0.4 * T, from.y, true);
        v.place = 'arrive';
        self.twNext(v);
      };
      if (live) sc.time.delayedCall(400 + k * 700, go);
      else go();
    });
  };
  V.twNext = function (v) {
    var pts = this.scene.points;
    v.n++;
    if (!v.stops.length) v.stops = TW.stops.filter(function (n) { return pts[n]; }).sort(function () { return Math.random() - 0.5; }).slice(0, 2);
    var name = v.stops.shift(), p = pts[name], j = function () { return (Math.random() - 0.5) * T * 0.5; };
    v.target = { place: name + '#' + v.n, point: { x: p.x + j(), y: p.y + j() }, hide: false };
    v.dwell = 3000 + Math.random() * 5000;
  };
  // back to the platform, and onto the train
  V.twBack = function (v) {
    if (v.leaving) return;
    v.leaving = true;
    v.n++;
    v.target = { place: 'train#' + v.n, point: platform(this.scene), hide: true };
  };
  // the train has gone: whoever is still out went with it
  V.twHome = function () {
    var self = this;
    (this.tourists || []).forEach(function (v) {
      v.target = null;
      v.leaving = false;
      v.errand = null;
      if (v.visible) self.put(v, v.x, v.y, false);
      v.place = 'gone';
    });
  };

  var update = V.update;
  V.update = function (dt, time, frozen) {
    if (this.tourists && !frozen) this.twUpdate(dt);
    update.call(this, dt, time, frozen);
  };
  V.twUpdate = function (dt) {
    var self = this, s = me(), tr = L.twTrain(s), now = L.twNow(s);
    this.tourists.forEach(function (v) {
      if (!v.visible || v.errand || v.path.length || v.hideAtEnd) return;
      if (tr && now >= tr.leave - TW.back) return self.twBack(v);
      v.dwell -= dt;
      if (v.dwell <= 0) self.twNext(v);
    });
  };

  // A bubble over each visitor still wishing for something, with the thing in it.
  P.twWishMarks = function () {
    var v = this.villagers, wishes = L.twWishes(me()), self = this;
    if (!v || !v.tourists) return;
    for (var k = 0; k < v.tourists.length; k++) { // (each frame: plain loops, nothing made)
      var t = v.tourists[k], w = null;
      if (t.visible) for (var j = 0; j < wishes.length && !w; j++) if (wishes[j].who === t.who) w = wishes[j];
      var want = w && !w.done;
      if (want && !t.mark) {
        t.mark = {
          b: self.add.image(0, 0, 'tw-wish').setScale(2.3).setDepth(DEPTH.Above + 1),
          i: self.add.image(0, 0, 'items', C.ITEMS[w.id].icon).setScale(0.74).setDepth(DEPTH.Above + 1.01),
        };
      }
      if (!want && t.mark) { t.mark.b.destroy(); t.mark.i.destroy(); t.mark = null; }
      if (t.mark) {
        var y = t.y - 2.55 * T + Math.sin(Date.now() / 300 + t.who) * 14;
        t.mark.b.setPosition(t.x, y);
        t.mark.i.setPosition(t.x, y - 0.15 * T).setFrame(C.ITEMS[w.id].icon);
      }
    }
  };

  // Talking to a visitor: what they would like, and Give when you have it.
  var villagerAction = P.villagerAction;
  P.villagerAction = function (v) {
    var self = this;
    if (!v.tourist) return villagerAction.call(this, v);
    var s = me(), wishes = L.twWishes(s), k = wishes.map(function (w) { return w.who; }).indexOf(v.who), w = wishes[k];
    var can = w && !w.done && L.countItem(s, w.id) >= w.n;
    return { label: can ? 'Give' : 'Talk', icon: can ? C.ICON.gift : C.ICON.bubble, run: function () { self.twTalk(v, k); } };
  };
  P.twTalk = function (v, k) {
    var self = this, s = me(), w = L.twWishes(s)[k], name = v.def.name.toUpperCase();
    this.villagers.greet(v, this.dir);
    this.emote(v, 'talk');
    sfx('talk');
    if (!w) return F.ui.dialog(name + '\n"What a lovely town. My train leaves soon!"');
    if (w.done) return F.ui.dialog(name + '\n"' + TW.thanks[(w.who + 3) % TW.thanks.length] + '"');
    var item = C.ITEMS[w.id], have = L.countItem(s, w.id);
    var line = L.twWho(w.who).line.replace('{n}', w.n).replace('{item}', item.name).replace('{gold}', w.gold).replace('{stars}', w.stars + (w.stars > 1 ? ' Sunbeams' : ' Sunbeam'));
    var text = name + '\n"' + line + '"\n(You have ' + have + '.)';
    if (have < w.n) return F.ui.dialog(text);
    F.ui.dialog(text, [{ label: 'Not now' }, {
      label: 'Give', cb: function () {
        var r = L.twHelp(s, k);
        if (!r || typeof r !== 'object') return;
        sfx('coin');
        self.villagers.hearts(v, 3);
        self.emote(v, C.ICON.heart);
        self.floatTextAt(v.x, v.y - 1.4 * T, '+' + r.gold + 'G');
        self.changed();
        self.save();
        F.ui.twThanks(v.def.name, r);
      },
    }]);
  };
})(window.Farm = window.Farm || {});
