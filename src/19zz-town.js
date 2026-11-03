// Willowbrook Station in town (rules: 01-logicz-town.js; panels and the tour: 19zz-town-ui.js). The station, the rails,
// the train and the crates on the platform are drawn here on canvases (stand-ins until the art in
// art-src/TOWN-PROMPTS.md comes); the map holds their places (tools/town-station.js). The train rolls in with a whistle
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
  var PX = 128; // canvas px per tile for the stand-in pictures
  var TRAIN_TILES = 12, TRAIN_H = 1.75, STOP_X = 42.9, OFF_X = 56.5; // the train: its length, height, where it stops, where it is out of sight
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

  // ---------- the pictures (drawn once) ----------
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

  // The station: 5 x 4 tiles. A red tiled roof with a clock, cream walls with timber, a green door and a sign.
  F.twStationTex = function (w) {
    return canvas(w, 'tw-station', 5 * PX, 4 * PX, function (g, W, H) {
      // shadow on the ground
      g.fillStyle = 'rgba(30,20,10,0.25)';
      g.beginPath();
      g.ellipse(W / 2, H - 14, W / 2 - 10, 18, 0, 0, Math.PI * 2);
      g.fill();
      // stone base and the walls
      box(g, 34, H - 52, W - 68, 40, grad(g, H - 52, H - 12, '#b7aa94', '#857a68'), 6);
      box(g, 40, 214, W - 80, H - 262, grad(g, 214, H - 48, '#fbf1d8', '#e8d3a6'), 4);
      // timber frame
      g.fillStyle = '#7a4a24';
      [40, W / 2 - 66, W / 2 + 58, W - 52].forEach(function (x) { g.fillRect(x, 214, 12, H - 262); });
      g.fillRect(40, 214, W - 80, 12);
      // two arched windows
      [[92, 268], [W - 172, 268]].forEach(function (p) {
        g.beginPath();
        g.moveTo(p[0], p[1] + 110);
        g.lineTo(p[0], p[1] + 40);
        g.arc(p[0] + 40, p[1] + 40, 40, Math.PI, 0);
        g.lineTo(p[0] + 80, p[1] + 110);
        g.closePath();
        g.fillStyle = grad(g, p[1], p[1] + 110, '#bfe3f2', '#6aa3c2');
        g.fill();
        g.lineWidth = 7;
        g.strokeStyle = '#5a3a1e';
        g.stroke();
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(p[0] + 40, p[1]);
        g.lineTo(p[0] + 40, p[1] + 110);
        g.moveTo(p[0], p[1] + 58);
        g.lineTo(p[0] + 80, p[1] + 58);
        g.stroke();
        box(g, p[0] - 8, p[1] + 108, 96, 16, '#a0703e', 4, 4); // the sill, with flowers
        ['#e85a8a', '#ffd23f', '#e85a8a', '#ffffff', '#ffd23f'].forEach(function (col, i) {
          g.fillStyle = col;
          g.beginPath();
          g.arc(p[0] + 6 + i * 17, p[1] + 104, 7, 0, Math.PI * 2);
          g.fill();
        });
      });
      // the door: green, two leaves, a little roof over it
      box(g, W / 2 - 46, H - 168, 92, 120, grad(g, H - 168, H - 48, '#4f9a5a', '#2f6a3a'), 8);
      g.lineWidth = 4;
      g.strokeStyle = LINE;
      g.beginPath();
      g.moveTo(W / 2, H - 164);
      g.lineTo(W / 2, H - 50);
      g.stroke();
      g.fillStyle = '#ffe08a';
      g.beginPath();
      g.arc(W / 2 - 10, H - 104, 5, 0, Math.PI * 2);
      g.arc(W / 2 + 10, H - 104, 5, 0, Math.PI * 2);
      g.fill();
      // the roof: red tiles in rows, over the walls
      g.beginPath();
      g.moveTo(6, 232);
      g.lineTo(70, 70);
      g.lineTo(W - 70, 70);
      g.lineTo(W - 6, 232);
      g.closePath();
      g.fillStyle = grad(g, 70, 232, '#d2553c', '#8e2f22');
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = LINE;
      g.stroke();
      g.strokeStyle = 'rgba(60,15,8,0.45)';
      g.lineWidth = 3;
      for (var k = 1; k < 5; k++) {
        var y = 70 + k * 32, inset = 70 - (y - 70) * 64 / 162;
        g.beginPath();
        g.moveTo(inset, y);
        g.lineTo(W - inset, y);
        g.stroke();
      }
      // the gable with the clock
      g.beginPath();
      g.moveTo(W / 2 - 92, 150);
      g.lineTo(W / 2, 18);
      g.lineTo(W / 2 + 92, 150);
      g.closePath();
      g.fillStyle = grad(g, 18, 150, '#fbf1d8', '#e2c995');
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = LINE;
      g.stroke();
      g.fillStyle = '#fffdf2';
      g.beginPath();
      g.arc(W / 2, 98, 34, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 6;
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(W / 2, 98);
      g.lineTo(W / 2, 74);
      g.moveTo(W / 2, 98);
      g.lineTo(W / 2 + 16, 106);
      g.stroke();
      // the sign over the door
      box(g, W / 2 - 150, 236, 300, 52, grad(g, 236, 288, '#5a3a1e', '#3d2614'), 10);
      g.fillStyle = '#ffe9a8';
      g.font = 'bold 34px "Trebuchet MS", Verdana, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('STATION', W / 2, 263);
    });
  };

  // The rails: a gravel bed, sleepers and two rails, 12 tiles long and one tall.
  var railsTex = function (w) {
    return canvas(w, 'tw-rails', TRAIN_TILES * PX, PX, function (g, W) {
      g.fillStyle = grad(g, 34, 124, '#a49a8a', '#7d7466');
      rr(g, 0, 34, W, 90, 10);
      g.fill();
      for (var i = 0; i < 260; i++) { // pebbles
        g.fillStyle = i % 3 ? 'rgba(60,52,44,0.35)' : 'rgba(230,222,206,0.5)';
        g.fillRect((i * 97) % W, 40 + ((i * 53) % 78), 5, 4);
      }
      for (var x = 8; x < W; x += 34) box(g, x, 52, 18, 66, grad(g, 52, 118, '#8a5a30', '#5c371a'), 3, 3);
      [64, 100].forEach(function (y) {
        g.fillStyle = '#5d6168';
        g.fillRect(0, y, W, 10);
        g.fillStyle = '#c9ccd2';
        g.fillRect(0, y, W, 4);
      });
    });
  };
  var bufferTex = function (w) {
    return canvas(w, 'tw-buffer', PX, PX, function (g) {
      box(g, 24, 46, 16, 72, '#5c371a', 3, 4);
      box(g, 88, 46, 16, 72, '#5c371a', 3, 4);
      box(g, 14, 40, 100, 30, grad(g, 40, 70, '#e04a3a', '#a02a20'), 6, 5);
      g.fillStyle = '#ffffff';
      [30, 64, 98].forEach(function (x) { g.fillRect(x - 6, 46, 12, 18); });
    });
  };

  // The train, facing west: the engine, two coaches and a van, 12 tiles long.
  var trainTex = function (w) {
    return canvas(w, 'tw-train', TRAIN_TILES * PX, Math.round(TRAIN_H * PX), function (g, W, H) {
      var base = H - 30; // the top of the wheels' rail
      var wheel = function (x, r, spokes) {
        g.fillStyle = '#c0362a';
        g.beginPath();
        g.arc(x, base + 30 - r, r, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = LINE;
        g.stroke();
        g.fillStyle = '#3a2a22';
        g.beginPath();
        g.arc(x, base + 30 - r, r * 0.3, 0, Math.PI * 2);
        g.fill();
        if (spokes) {
          g.lineWidth = 3;
          for (var a = 0; a < 6; a++) {
            g.beginPath();
            g.moveTo(x, base + 30 - r);
            g.lineTo(x + Math.cos(a) * r * 0.85, base + 30 - r + Math.sin(a) * r * 0.85);
            g.stroke();
          }
        }
      };
      // ---- the engine (0 .. 3 tiles): cowcatcher, boiler, chimney, dome, cab
      var e0 = 6, e1 = 3 * PX - 8;
      g.fillStyle = '#3a2a22';
      g.beginPath();
      g.moveTo(e0, base + 26);
      g.lineTo(e0 + 34, base - 14);
      g.lineTo(e0 + 46, base + 26);
      g.closePath();
      g.fill();
      box(g, e0 + 30, base - 112, 200, 92, grad(g, base - 112, base - 20, '#3f8a5a', '#1f5a34'), 30); // the boiler
      g.fillStyle = '#d9a62a';
      [80, 140, 196].forEach(function (x) { g.fillRect(e0 + x, base - 112, 8, 92); });
      box(g, e0 + 48, base - 182, 38, 74, grad(g, base - 182, base - 108, '#4a4a4a', '#1e1e1e'), 6); // the chimney
      box(g, e0 + 40, base - 192, 54, 16, '#2a2a2a', 5);
      box(g, e0 + 126, base - 140, 44, 32, grad(g, base - 140, base - 108, '#ffd96a', '#c9901e'), 14); // the dome
      box(g, e0 + 14, base - 96, 26, 26, '#ffe98a', 13); // the lamp
      box(g, e0 + 222, base - 170, e1 - e0 - 222, 152, grad(g, base - 170, base - 18, '#c0442e', '#7e2418'), 8); // the cab
      box(g, e0 + 210, base - 186, e1 - e0 - 198, 22, '#3a2a22', 6);
      box(g, e0 + 244, base - 150, 66, 54, grad(g, base - 150, base - 96, '#cfeefa', '#7ab4d2'), 6);
      box(g, e0 + 20, base - 26, e1 - e0 - 20, 18, '#3a2a22', 4); // the frame
      wheel(e0 + 92, 34, true);
      wheel(e0 + 176, 34, true);
      wheel(e0 + 300, 24, false);
      g.lineWidth = 8;
      g.strokeStyle = '#d0d4da';
      g.beginPath();
      g.moveTo(e0 + 92, base - 4);
      g.lineTo(e0 + 176, base - 4);
      g.stroke();
      // ---- two coaches (3 .. 6, 6 .. 9) and the van (9 .. 12)
      var car = function (x0, x1, body, top, windows) {
        g.fillStyle = '#3a2a22';
        g.fillRect(x0 - 10, base - 60, 14, 12); // the coupling
        box(g, x0 + 6, base - 156, x1 - x0 - 12, 138, grad(g, base - 156, base - 18, body, top), 10);
        box(g, x0, base - 172, x1 - x0, 22, '#4a3326', 10); // the roof
        if (windows) {
          for (var k = 0; k < 4; k++) box(g, x0 + 26 + k * 86, base - 136, 62, 56, grad(g, base - 136, base - 80, '#d6f1fb', '#82bcd8'), 8, 4);
          g.fillStyle = '#d9a62a';
          g.fillRect(x0 + 8, base - 62, x1 - x0 - 16, 10);
        } else { // the van: planks, a sliding door
          g.strokeStyle = 'rgba(40,20,8,0.45)';
          g.lineWidth = 3;
          for (var p = x0 + 30; p < x1 - 10; p += 34) { g.beginPath(); g.moveTo(p, base - 150); g.lineTo(p, base - 24); g.stroke(); }
          box(g, (x0 + x1) / 2 - 56, base - 140, 112, 110, grad(g, base - 140, base - 30, '#a8743e', '#7a4f25'), 6);
          g.fillStyle = '#ffe9a8';
          g.font = 'bold 30px "Trebuchet MS", Verdana, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('CARGO', (x0 + x1) / 2, base - 84);
        }
        wheel(x0 + 56, 24, false);
        wheel(x0 + 104, 24, false);
        wheel(x1 - 104, 24, false);
        wheel(x1 - 56, 24, false);
      };
      car(3 * PX, 6 * PX, '#2f6fa0', '#1f4a70', true);
      car(6 * PX, 9 * PX, '#2f6fa0', '#1f4a70', true);
      car(9 * PX, 12 * PX, '#9a5a2c', '#6a3a1a', false);
    });
  };

  var crateTex = function (w, full) {
    return canvas(w, full ? 'tw-crate-full' : 'tw-crate', 112, 112, function (g) {
      g.fillStyle = 'rgba(30,20,10,0.25)';
      g.beginPath();
      g.ellipse(56, 104, 48, 8, 0, 0, Math.PI * 2);
      g.fill();
      box(g, 8, 26, 96, 78, grad(g, 26, 104, '#d29a58', '#9a6430'), 6);
      g.strokeStyle = 'rgba(70,40,15,0.55)';
      g.lineWidth = 4;
      [52, 78].forEach(function (y) { g.beginPath(); g.moveTo(10, y); g.lineTo(102, y); g.stroke(); });
      if (full) { // the lid nailed on, and a green stamp
        box(g, 2, 14, 108, 20, grad(g, 14, 34, '#e2ae6a', '#b07a3a'), 5);
        g.fillStyle = '#3f9a35';
        g.beginPath();
        g.arc(56, 66, 22, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 7;
        g.strokeStyle = '#ffffff';
        g.beginPath();
        g.moveTo(44, 66);
        g.lineTo(53, 76);
        g.lineTo(70, 56);
        g.stroke();
      } else { // open: the inside shows
        g.fillStyle = '#5c371a';
        g.fillRect(14, 28, 84, 10);
      }
    });
  };
  var palletTex = function (w) {
    return canvas(w, 'tw-pallet', 112, 112, function (g) {
      box(g, 8, 82, 96, 20, grad(g, 82, 102, '#c08a4a', '#8a5a2a'), 4, 4);
      g.fillStyle = 'rgba(60,30,10,0.5)';
      [30, 56, 82].forEach(function (x) { g.fillRect(x - 3, 84, 6, 16); });
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

  // every picture, for the tour too (it can open from What's new anywhere)
  F.twTextures = function (scene) {
    F.twStationTex(scene);
    railsTex(scene);
    bufferTex(scene);
    trainTex(scene);
    crateTex(scene, false);
    crateTex(scene, true);
    palletTex(scene);
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
    this.add.image(st.x0 * T, (st.y1 + 1) * T, F.twStationTex(this)).setOrigin(0, 1).setDisplaySize((st.x1 - st.x0 + 1) * T, (st.y1 - st.y0 + 1) * T).setDepth(DEPTH.actor + (st.y1 + 1) * T / 1e5);
    tw.level = this.add.text((st.x0 + 4.2) * T, (st.y1 + 0.2) * T, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '58px', fontStyle: 'bold', color: '#5a3a1e', backgroundColor: '#ffe9a8', padding: { x: 14, y: 4 } })
      .setOrigin(0.5, 1).setDepth(DEPTH.actor + (st.y1 + 1) * T / 1e5 + 0.0001);
    var edge = this.add.graphics().setDepth(DEPTH.flat); // the platform's edge: mind the gap
    edge.fillStyle(0xf2d46a, 1).fillRect(rails.x0 * T, (rails.y1 + 1) * T + 6, (cargo.x1 + 1 - rails.x0) * T, 22);
    this.add.image(rails.x0 * T, (rails.y1 + 1) * T, railsTex(this)).setOrigin(0, 1).setDisplaySize(TRAIN_TILES * T, T).setDepth(DEPTH.flat);
    this.add.image(rails.x0 * T - 0.2 * T, (rails.y1 + 1) * T - 0.1 * T, bufferTex(this)).setOrigin(0, 1).setDisplaySize(T, T).setDepth(DEPTH.actor + 3 * T / 1e5);
    tw.train = this.add.image(OFF_X * T, (rails.y1 + 1) * T - 0.18 * T, trainTex(this)).setOrigin(0, 1).setDisplaySize(TRAIN_TILES * T, TRAIN_H * T).setDepth(DEPTH.actor + (rails.y1 + 1) * T / 1e5).setVisible(false);
    F.twTextures(this);
    for (var i = 0; i < cargo.x1 - cargo.x0 + 1; i++) {
      var x = (cargo.x0 + i + 0.5) * T, y = (cargo.y1 + 1) * T - 12;
      tw.crates.push({
        img: this.add.image(x, y, 'tw-pallet').setOrigin(0.5, 1).setDisplaySize(0.9 * T, 0.9 * T).setDepth(DEPTH.actor + y / 1e5),
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
        c.img.setTexture(!crate ? 'tw-pallet' : crate.done ? 'tw-crate-full' : 'tw-crate').setDisplaySize(0.9 * T, 0.9 * T);
        c.icon.setVisible(!!crate && !crate.done);
        if (crate) c.icon.setFrame(C.ITEMS[crate.id].icon);
      });
    }
    var lv = L.twLevel(s);
    tw.level.setText('Lv ' + lv);
    if (lv !== tw.deco) this.twDecorate(lv);
  };

  // ---------- decorations with the Town Level ----------
  P.twDecorate = function (lv) {
    var tw = this.tw, self = this;
    tw.deco = lv;
    tw.decos.forEach(function (d) { d.destroy(); });
    tw.decos = [];
    var COLORS = [0xe8503a, 0xffd23f, 0x4a90c9, 0x5fa84a, 0xe85a8a];
    // a string of little flags between two points, sagging in the middle
    var flags = function (g, x0, y0, x1, y1) {
      var n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 110)), sag = 0.35 * T;
      var at = function (t) { return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag }; };
      g.lineStyle(7, 0x5a3a1e, 1);
      g.beginPath();
      for (var k = 0; k <= 16; k++) { var p = at(k / 16); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }
      g.strokePath();
      for (var i = 0; i < n; i++) {
        var a = at((i + 0.25) / n), b = at((i + 0.75) / n), m = at((i + 0.5) / n);
        g.fillStyle(COLORS[i % COLORS.length], 1);
        g.fillTriangle(a.x, a.y, b.x, b.y, m.x, m.y + 70);
      }
    };
    if (lv >= TW.flagsAt) { // over the plaza, lamp to lamp
      var g = this.add.graphics().setDepth(DEPTH.Above - 1);
      var top = 13.1 * T, bottom = 20.1 * T, left = 8.5 * T, right = 21.5 * T;
      flags(g, left, top, right, top);
      flags(g, left, bottom, right, bottom);
      flags(g, left, top, 14.5 * T, 17 * T);
      flags(g, right, top, 14.5 * T, 17 * T);
      tw.decos.push(g);
    }
    if (lv >= TW.lanternsAt) { // along Market Street, post to post
      var h = this.add.graphics().setDepth(DEPTH.Above - 1), posts = [29.5, 35, 40.5, 46, 51.5], y = 11.15 * T;
      posts.forEach(function (px, i) {
        h.fillStyle(0x5a3a1e, 1);
        h.fillRect(px * T - 14, y - 0.2 * T, 28, 1.25 * T);
        if (!i) return;
        var x0 = posts[i - 1] * T, x1 = px * T;
        h.lineStyle(6, 0x3d2614, 1);
        h.beginPath();
        for (var k = 0; k <= 12; k++) { var t = k / 12, X = x0 + (x1 - x0) * t, Y = y + Math.sin(Math.PI * t) * 0.3 * T; if (k) h.lineTo(X, Y); else h.moveTo(X, Y); }
        h.strokePath();
        [0.25, 0.5, 0.75].forEach(function (t) {
          var X = x0 + (x1 - x0) * t, Y = y + Math.sin(Math.PI * t) * 0.3 * T;
          h.fillStyle(0xffb03a, 1);
          h.fillCircle(X, Y + 46, 38);
          h.fillStyle(0xfff0b0, 1);
          h.fillCircle(X - 8, Y + 38, 14);
          h.fillStyle(0x8e2f22, 1);
          h.fillRect(X - 22, Y + 4, 44, 12);
        });
      });
      tw.decos.push(h);
    }
    void self;
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
    var tw = this.tw, x = tw.train.x + (tw.moving === 'out' ? 0.6 : 0.52) * T, y = tw.train.y - TRAIN_H * T + 0.05 * T;
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
  var twAnims = function (scene) {
    var n = C.VILLAGER_ORDER.length;
    TW.visitors.concat([TW.collector]).forEach(function (vd) {
      ['down', 'up', 'side'].forEach(function (d, j) {
        var f = (n + vd.look) * 9 + j * 3, key = 'v-' + vd.key + '-' + d;
        if (!scene.anims.exists(key)) scene.anims.create({ key: key, frames: scene.anims.generateFrameNumbers('people', { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
      });
    });
  };
  var makePeopleAnims = F.makePeopleAnims;
  F.makePeopleAnims = function (scene) {
    makePeopleAnims(scene);
    twAnims(scene);
  };

  // One person per visitor (and the Collector), hidden until their train is in.
  V.addTourists = function () {
    var self = this, sc = this.scene, n = C.VILLAGER_ORDER.length;
    twAnims(sc);
    this.tourists = TW.visitors.concat([TW.collector]).map(function (vd, k) {
      var who = k < TW.visitors.length ? k : -1;
      var v = {
        key: vd.key, i: n + vd.look, def: { name: vd.name, line: vd.line }, tourist: true, who: who, place: 'gone', target: null,
        path: [], hold: 0, dir: 'down', visible: false, n: 0, dwell: 0, stops: [], out: -1,
        sprite: sc.add.sprite(0, 0, 'people', (n + vd.look) * 9).setOrigin(0.5, 0.83).setScale(2).setVisible(false),
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
    v.tourists.forEach(function (t) {
      var w = t.visible && wishes.filter(function (x) { return x.who === t.who; })[0], want = w && !w.done;
      if (want && !t.mark) {
        t.mark = {
          b: self.add.image(0, 0, 'tw-wish').setScale(1.9).setDepth(DEPTH.Above + 1),
          i: self.add.image(0, 0, 'items', C.ITEMS[w.id].icon).setScale(0.62).setDepth(DEPTH.Above + 1.01),
        };
      }
      if (!want && t.mark) { t.mark.b.destroy(); t.mark.i.destroy(); t.mark = null; }
      if (t.mark) {
        var y = t.y - 2.45 * T + Math.sin(Date.now() / 300 + t.who) * 14;
        t.mark.b.setPosition(t.x, y);
        t.mark.i.setPosition(t.x, y - 0.13 * T).setFrame(C.ITEMS[w.id].icon);
      }
    });
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
