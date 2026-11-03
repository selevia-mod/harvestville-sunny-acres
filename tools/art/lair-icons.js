// Drawn icons for Bakunawa's Lair (4 Nov 2026), until generated pictures replace them (art-src/LAIR-PROMPTS.md):
// what its creatures leave, the Magma Bow and the Fire Charm (src/00-zzzzzzlair.js). Runs after draw.js;
// tools/art/icons-fill.js paints them into the items sheet.
// The Magma Bow is the Gold Bow's own picture made obsidian, so the two read as the same bow, one level up:
// ICON_FROM names the picture it needs and icons-fill.js loads it into ART.IMG before drawing (a drawing is not async).
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, ell = A.ell, paint = A.paint, rng = A.rng;
  var D = A.ICON_DRAW;
  A.ICON_FROM = A.ICON_FROM || {};
  A.ICON_FROM.bow_4 = 'bow_3';
  A.IMG = A.IMG || {};

  function poly(g, pts) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.closePath();
  }
  function glow(g, color, blur) {
    g.shadowColor = color;
    g.shadowBlur = blur;
  }
  function noGlow(g) {
    g.shadowColor = 'rgba(0,0,0,0)';
    g.shadowBlur = 0;
  }
  // a soft round light behind a hot thing
  function halo(g, x, y, r, rgb, a) {
    g.fillStyle = rad(g, x, y, 0, x, y, r, [[0, 'rgba(' + rgb + ',' + a + ')'], [0.55, 'rgba(' + rgb + ',' + a * 0.35 + ')'], [1, 'rgba(' + rgb + ',0)']]);
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a four-pointed twinkle
  function twinkle(g, x, y, r, color) {
    g.beginPath();
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y);
    g.quadraticCurveTo(x, y, x, y - r);
    g.fillStyle = color;
    g.fill();
  }
  // a flame with two tongues, its foot at (64, 116) and about 104 tall (scaled and moved by the caller)
  function flamePath(g) {
    g.beginPath();
    g.moveTo(64, 116);
    g.bezierCurveTo(34, 116, 22, 92, 32, 70);
    g.bezierCurveTo(38, 56, 48, 50, 48, 30);
    g.bezierCurveTo(58, 40, 62, 48, 62, 56);
    g.bezierCurveTo(68, 42, 74, 26, 88, 12);
    g.bezierCurveTo(88, 34, 106, 52, 102, 82);
    g.bezierCurveTo(100, 104, 86, 116, 64, 116);
    g.closePath();
  }
  function fireFill(g, cx, cy, r) {
    return rad(g, cx, cy, 2, cx, cy, r, [[0, '#fffbe0'], [0.28, '#ffe070'], [0.6, '#ff9a2e'], [0.86, '#f0581c'], [1, '#d8401a']]);
  }

  // ---------- Ember Shard: three glowing red-orange crystals ----------
  function crystal(g, x, y, w, h, ang) {
    var R1 = [w * 0.1, -h * 0.74], R2 = [w * 0.1, w * 0.16];
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    var outline = [[-w / 2, 0], [-w / 2, -h * 0.72], [0, -h], [w / 2, -h * 0.72], [w / 2, 0], R2];
    // the glow round it, then each face
    glow(g, 'rgba(255,110,30,0.95)', 16);
    poly(g, outline);
    g.fillStyle = '#c83a14';
    g.fill();
    noGlow(g);
    poly(g, [[-w / 2, 0], [-w / 2, -h * 0.72], [0, -h], R1, R2]);
    g.fillStyle = lin(g, 0, -h, 0, 0, [[0, '#ffe9a8'], [0.35, '#ffac44'], [1, '#e8521c']]);
    g.fill();
    poly(g, [R1, [0, -h], [w / 2, -h * 0.72], [w / 2, 0], R2]);
    g.fillStyle = lin(g, 0, -h, 0, 0, [[0, '#f07a2a'], [0.5, '#c8361a'], [1, '#8a1a0c']]);
    g.fill();
    poly(g, [[-w / 2, -h * 0.72], [0, -h], R1]);
    g.fillStyle = '#fff4cc';
    g.fill();
    // the hot core showing through
    g.save();
    poly(g, outline);
    g.clip();
    ell(g, -w * 0.12, -h * 0.4, w * 0.16, h * 0.3);
    g.fillStyle = 'rgba(255,250,210,0.55)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,240,0.85)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-w * 0.32, -h * 0.66);
    g.lineTo(-w * 0.32, -h * 0.12);
    g.stroke();
    g.restore();
    poly(g, outline);
    g.lineWidth = 4;
    g.strokeStyle = '#5a1408';
    g.stroke();
    g.restore();
  }
  D.ember_shard = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    halo(g, 64, 74, 60, '255,120,40', 0.55);
    // a bed of dark rock
    [[38, 108, 18, 9], [88, 108, 20, 9], [62, 112, 24, 10]].forEach(function (r) {
      ell(g, r[0], r[1], r[2], r[3]);
      paint(g, lin(g, 0, r[1] - r[3], 0, r[1] + r[3], [[0, '#5a4a4e'], [1, '#2a2026']]), 4, '#1a1012');
    });
    crystal(g, 36, 104, 24, 52, -0.42);
    crystal(g, 92, 104, 26, 60, 0.38);
    crystal(g, 62, 108, 34, 94, -0.04);
    // embers rising
    [[20, 40, 3.5], [108, 30, 3], [100, 62, 2.5], [28, 70, 2.5], [76, 10, 2.5]].forEach(function (e) {
      glow(g, 'rgba(255,140,40,1)', 8);
      ell(g, e[0], e[1], e[2], e[2]);
      g.fillStyle = '#ffd060';
      g.fill();
    });
    noGlow(g);
  };

  // ---------- Santelmo Flame: a friendly little fire wisp ----------
  D.santelmo_flame = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    halo(g, 64, 80, 58, '255,150,50', 0.5);
    g.save();
    g.translate(64, 122);
    g.scale(0.92, 0.92);
    g.translate(-64, -120);
    glow(g, 'rgba(255,120,30,0.9)', 18);
    flamePath(g);
    g.fillStyle = fireFill(g, 62, 90, 60);
    g.fill();
    noGlow(g);
    g.lineWidth = 4.5;
    g.strokeStyle = '#9a2e0c';
    g.stroke();
    // the brighter heart of the fire
    g.save();
    g.translate(64, 116);
    g.scale(0.62, 0.55);
    g.translate(-64, -116);
    flamePath(g);
    g.fillStyle = 'rgba(255,246,190,0.75)';
    g.fill();
    g.restore();
    // its face
    [[50, 86], [78, 86]].forEach(function (e) {
      ell(g, e[0], e[1], 6, 8);
      g.fillStyle = '#3a1406';
      g.fill();
      ell(g, e[0] - 2, e[1] - 3, 2.4, 2.8);
      g.fillStyle = '#ffffff';
      g.fill();
    });
    [[40, 97], [88, 97]].forEach(function (b) {
      ell(g, b[0], b[1], 7, 4);
      g.fillStyle = 'rgba(240,70,60,0.45)';
      g.fill();
    });
    g.beginPath();
    g.arc(64, 94, 7, 0.2 * Math.PI, 0.8 * Math.PI);
    g.lineWidth = 3.5;
    g.strokeStyle = '#3a1406';
    g.stroke();
    g.restore();
    // sparks
    glow(g, 'rgba(255,150,40,1)', 6);
    twinkle(g, 20, 44, 7, '#ffe070');
    twinkle(g, 112, 56, 6, '#ffe070');
    ell(g, 110, 26, 3, 3);
    g.fillStyle = '#ffd060';
    g.fill();
    ell(g, 18, 82, 2.5, 2.5);
    g.fill();
    noGlow(g);
  };

  // ---------- Sigbin Horn: a small, curved dark horn ----------
  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }
  D.sigbin_horn = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // the outer curve runs base to tip, the inner one tip to base
    var O = [[70, 116], [36, 106], [16, 70], [32, 14]], I = [[32, 14], [42, 54], [68, 80], [108, 94]];
    var horn = function () {
      g.beginPath();
      g.moveTo(O[0][0], O[0][1]);
      g.bezierCurveTo(O[1][0], O[1][1], O[2][0], O[2][1], O[3][0], O[3][1]);
      g.bezierCurveTo(I[1][0], I[1][1], I[2][0], I[2][1], I[3][0], I[3][1]);
      g.closePath();
    };
    horn();
    paint(g, lin(g, 30, 16, 92, 108, [[0, '#b8aac8'], [0.28, '#6a5a80'], [0.7, '#3a2e48'], [1, '#241c2c']]), 0);
    g.save();
    horn();
    g.clip();
    // the rings that ridge a horn
    for (var k = 1; k <= 7; k++) {
      var t = k / 8.2, a = bez(O[0], O[1], O[2], O[3], t), b = bez(I[3], I[2], I[1], I[0], t);
      var mx = (a[0] + b[0]) / 2 + 5, my = (a[1] + b[1]) / 2 + 6;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(mx, my, b[0], b[1]);
      g.lineWidth = 3.5 - t * 1.5;
      g.strokeStyle = 'rgba(16,8,24,0.6)';
      g.stroke();
      g.beginPath();
      g.moveTo(a[0] - 2, a[1] - 3);
      g.quadraticCurveTo(mx - 2, my - 3, b[0] - 2, b[1] - 3);
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(210,190,240,0.35)';
      g.stroke();
    }
    // the shine down its back
    g.beginPath();
    g.moveTo(58, 104);
    g.bezierCurveTo(34, 92, 26, 62, 34, 26);
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.stroke();
    g.restore();
    horn();
    g.lineWidth = 5;
    g.strokeStyle = '#1a1020';
    g.stroke();
    // the rough end where it was attached
    ell(g, 89, 105, 21, 9, -0.58);
    paint(g, lin(g, 76, 96, 102, 114, [[0, '#8a5a3a'], [1, '#4a2a1a']]), 4.5, '#1a1020');
    ell(g, 89, 105, 12, 4.5, -0.58);
    paint(g, '#3a2014', 0);
    // a glint on the tip
    ell(g, 36, 28, 3, 6, -0.3);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fill();
  };

  // ---------- Tikbalang Mane: a lock of long, dark, wavy hair ----------
  // one strand of the lock: they all follow the same S wave, a little apart, fanning out toward the ends
  function strand(g, off, ph, wid, len, top, bottom, shine) {
    var at = function (t) { return [60 + off * (0.25 + 0.75 * t) + 15 * Math.sin(t * Math.PI * 1.9 + ph) * (0.25 + t), 34 + len * t]; };
    var L = [], R = [], C = [], N = 30;
    for (var i = 0; i <= N; i++) {
      var t = i / N, p = at(t), q = at(Math.min(1, t + 0.01)), o = at(Math.max(0, t - 0.01));
      var dx = q[0] - o[0], dy = q[1] - o[1], n = Math.sqrt(dx * dx + dy * dy) || 1, w = wid * (t < 0.08 ? 0.55 + t * 5.6 : 1 - Math.pow(t, 1.6) * 0.88);
      L.push([p[0] - dy / n * w, p[1] + dx / n * w]);
      R.push([p[0] + dy / n * w, p[1] - dx / n * w]);
      C.push([p[0] - dy / n * w * 0.35, p[1] + dx / n * w * 0.35]);
    }
    g.beginPath();
    L.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    R.reverse().forEach(function (p) { g.lineTo(p[0], p[1]); });
    g.closePath();
    paint(g, lin(g, 0, 34, 0, 34 + len, [[0, top], [1, bottom]]), 3, '#0a0604');
    // a streak of light along it
    g.beginPath();
    C.slice(3, N - 6).forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.lineWidth = Math.max(1.5, wid * 0.32);
    g.strokeStyle = shine;
    g.stroke();
  }
  D.tikbalang_mane = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // the back strands first, darker
    strand(g, -20, 0.5, 8, 84, '#2a1c16', '#120a08', 'rgba(150,110,80,0.35)');
    strand(g, 22, 0.1, 8, 82, '#2a1c16', '#120a08', 'rgba(150,110,80,0.35)');
    strand(g, -10, 0.35, 10, 88, '#3a2820', '#1a100c', 'rgba(170,130,96,0.45)');
    strand(g, 12, 0.2, 10, 86, '#3a2820', '#1a100c', 'rgba(170,130,96,0.45)');
    strand(g, 0, 0.28, 11, 90, '#4a3428', '#1e140e', 'rgba(200,154,112,0.55)');
    // the tuft above the tie
    [[-0.5, 16], [-0.15, 20], [0.2, 18], [0.55, 14]].forEach(function (f) {
      g.save();
      g.translate(64, 30);
      g.rotate(f[0]);
      ell(g, 0, -f[1] / 2 - 2, 6, f[1] / 2 + 2);
      paint(g, lin(g, 0, -f[1] - 4, 0, 0, [[0, '#5a4030'], [1, '#2a1c14']]), 3, '#0a0604');
      g.restore();
    });
    // the red cord that ties it
    g.save();
    g.translate(64, 32);
    g.rotate(-0.08);
    A.rrect(g, -15, -7, 30, 14, 5);
    paint(g, lin(g, 0, -7, 0, 7, [[0, '#f0623a'], [1, '#a82410']]), 3.5, '#4a1206');
    g.beginPath();
    g.moveTo(-15, 0);
    g.lineTo(15, 0);
    g.lineWidth = 2;
    g.strokeStyle = '#ffc040';
    g.stroke();
    g.restore();
  };

  // ---------- Bungisngis Tooth: a big white tooth ----------
  D.bungisngis_tooth = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    var tooth = function () {
      g.beginPath();
      g.moveTo(26, 46);
      g.bezierCurveTo(22, 16, 48, 8, 64, 22);
      g.bezierCurveTo(80, 8, 106, 16, 102, 46);
      g.bezierCurveTo(100, 62, 94, 72, 90, 86);
      g.bezierCurveTo(88, 102, 86, 118, 76, 118);
      g.bezierCurveTo(68, 118, 68, 102, 64, 90);
      g.bezierCurveTo(60, 102, 60, 118, 52, 118);
      g.bezierCurveTo(42, 118, 40, 102, 38, 86);
      g.bezierCurveTo(34, 72, 28, 62, 26, 46);
      g.closePath();
    };
    tooth();
    paint(g, lin(g, 24, 0, 104, 0, [[0, '#ffffff'], [0.5, '#f8f2e2'], [1, '#dccca8']]), 0);
    g.save();
    tooth();
    g.clip();
    // older at the roots, shaded on the right, a dip between the bumps
    g.fillStyle = lin(g, 0, 60, 0, 120, [[0, 'rgba(220,196,140,0)'], [1, 'rgba(206,176,120,0.75)']]);
    g.fillRect(0, 60, 128, 68);
    ell(g, 104, 60, 22, 50);
    g.fillStyle = 'rgba(150,120,80,0.28)';
    g.fill();
    g.beginPath();
    g.moveTo(64, 24);
    g.quadraticCurveTo(62, 38, 56, 46);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(150,120,80,0.45)';
    g.stroke();
    g.restore();
    tooth();
    g.lineWidth = 5;
    g.strokeStyle = '#5a4630';
    g.stroke();
    // shine
    ell(g, 40, 30, 10, 5.5, -0.7);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fill();
    ell(g, 34, 50, 3.5, 7, -0.15);
    g.fill();
    twinkle(g, 92, 24, 9, '#ffffff');
  };

  // ---------- Bakunawa Scale: dark blue, a silver rim and shimmer, like a piece of the night sky ----------
  D.bakunawa_scale = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    var scale = function (k) {
      g.save();
      g.translate(64, 66);
      g.scale(k, k);
      g.translate(-64, -66);
      g.beginPath();
      g.moveTo(64, 10);
      g.bezierCurveTo(90, 18, 112, 40, 110, 70);
      g.bezierCurveTo(108, 100, 88, 120, 64, 120);
      g.bezierCurveTo(40, 120, 20, 100, 18, 70);
      g.bezierCurveTo(16, 40, 38, 18, 64, 10);
      g.closePath();
      g.restore();
    };
    halo(g, 64, 66, 62, '150,180,255', 0.35);
    scale(1);
    paint(g, rad(g, 52, 48, 4, 64, 70, 66, [[0, '#4a6ad0'], [0.45, '#1e3488'], [1, '#0a1440']]), 0);
    g.save();
    scale(1);
    g.clip();
    // stars
    var r = rng(46);
    for (var i = 0; i < 26; i++) {
      var sx = r.range(22, 106), sy = r.range(18, 116), sz = r.range(0.8, 2.2);
      ell(g, sx, sy, sz, sz);
      g.fillStyle = 'rgba(230,240,255,' + r.range(0.5, 1).toFixed(2) + ')';
      g.fill();
    }
    twinkle(g, 44, 84, 7, '#eef4ff');
    twinkle(g, 86, 98, 5, '#eef4ff');
    twinkle(g, 70, 34, 4.5, '#eef4ff');
    // a small moon, the one it wants to eat
    ell(g, 82, 54, 11, 11);
    g.fillStyle = '#eef2ff';
    g.fill();
    ell(g, 87, 50, 10, 10);
    g.fillStyle = '#22388e';
    g.fill();
    // the silver shimmer across it
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lin(g, 20, 24, 104, 112, [[0, 'rgba(200,215,255,0)'], [0.34, 'rgba(200,215,255,0)'], [0.44, 'rgba(210,225,255,0.42)'], [0.5, 'rgba(240,245,255,0.6)'], [0.58, 'rgba(210,225,255,0.3)'], [0.7, 'rgba(200,215,255,0)'], [1, 'rgba(200,215,255,0)']]);
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'source-over';
    // a ridge down the middle, as a scale has
    g.beginPath();
    g.moveTo(64, 16);
    g.quadraticCurveTo(60, 70, 64, 116);
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(170,195,255,0.35)';
    g.stroke();
    g.restore();
    // an inner line, then the silver rim, then the outline
    scale(0.82);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(180,200,255,0.4)';
    g.stroke();
    scale(1);
    g.lineWidth = 9;
    g.strokeStyle = lin(g, 20, 14, 108, 120, [[0, '#ffffff'], [0.3, '#c4cde4'], [0.6, '#7a88a8'], [1, '#b8c4e0']]);
    g.stroke();
    scale(1.045);
    g.lineWidth = 3;
    g.strokeStyle = '#0a0e24';
    g.stroke();
    ell(g, 36, 40, 7, 3.5, -0.9);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();
  };

  // ---------- Magma Bow: the Gold Bow made obsidian, with lava in its cracks ----------
  function magmaFromGoldBow(g, im) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var h = c.getContext('2d', { willReadFrequently: true });
    h.drawImage(im, 0, 0, 128, 128);
    var d = h.getImageData(0, 0, 128, 128), q = d.data;
    var body = document.createElement('canvas');
    body.width = body.height = 128;
    var bg = body.getContext('2d'), bd = bg.createImageData(128, 128);
    var mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
    var ramp = function (stops, t) {
      t = Math.max(0, Math.min(1, t));
      for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
      return stops[stops.length - 1][1];
    };
    var OBS = [[0, [14, 10, 18]], [0.45, [40, 34, 54]], [0.75, [84, 76, 110]], [1, [170, 160, 210]]];
    var LAVA = [[0, [110, 20, 6]], [0.45, [220, 70, 14]], [0.8, [255, 160, 40]], [1, [255, 236, 150]]];
    for (var i = 0; i < q.length; i += 4) {
      if (!q[i + 3]) continue;
      var r = q[i], gr = q[i + 1], b = q[i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), l = mx / 255, s = mx ? (mx - mn) / mx : 0;
      var hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = ((gr - b) / (mx - mn)) % 6; else if (mx === gr) hue = (b - r) / (mx - mn) + 2; else hue = (r - gr) / (mx - mn) + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      var out;
      if (l < 0.22) out = [16, 8, 10]; // the outline
      else if (s < 0.3 && l > 0.6) out = [255, 200, 130]; // the string, warm
      else if (hue >= 37 && hue < 70) out = ramp(LAVA, Math.pow(l, 1.3)); // gold → molten
      else {
        out = ramp(OBS, Math.pow(l, 1.6)); // wood → obsidian
        if (q[i + 3] > 200) bd.data[i + 3] = 255; // (where the cracks may run)
      }
      q[i] = out[0]; q[i + 1] = out[1]; q[i + 2] = out[2];
    }
    h.putImageData(d, 0, 0);
    g.save();
    glow(g, 'rgba(255,100,20,0.55)', 10); // a warm light round the whole bow
    g.drawImage(c, 0, 0);
    g.restore();
    bg.putImageData(bd, 0, 0);
    // lava cracks, only on the obsidian (the body mask), glowing
    var cr = document.createElement('canvas');
    cr.width = cr.height = 128;
    var k = cr.getContext('2d'), rnd = rng(404);
    k.lineCap = 'round';
    k.lineJoin = 'round';
    for (var n = 0; n < 70; n++) {
      var x = rnd.range(6, 122), y = rnd.range(6, 122), a = rnd.range(0, Math.PI), pts = [[x, y]];
      for (var j = 0; j < 4; j++) {
        a += rnd.range(-0.9, 0.9);
        x += Math.cos(a) * rnd.range(3, 7);
        y += Math.sin(a) * rnd.range(3, 7);
        pts.push([x, y]);
      }
      // red-hot at the sides of a crack, yellow in it
      [[2.2, '#e0461a'], [0.9, '#ffd870']].forEach(function (w) {
        k.beginPath();
        pts.forEach(function (p, i) { if (i) k.lineTo(p[0], p[1]); else k.moveTo(p[0], p[1]); });
        k.lineWidth = w[0];
        k.strokeStyle = w[1];
        k.stroke();
      });
    }
    k.globalCompositeOperation = 'destination-in';
    k.drawImage(body, 0, 0);
    g.save();
    glow(g, 'rgba(255,90,20,0.9)', 5);
    g.drawImage(cr, 0, 0);
    g.restore();
  }
  // (no Gold Bow picture: a plain drawn bow in the same pose)
  function drawnMagmaBow(g) {
    g.beginPath();
    g.moveTo(108, 14);
    g.lineTo(14, 110);
    g.lineWidth = 2;
    g.strokeStyle = '#ffc880';
    g.stroke();
    g.beginPath();
    g.moveTo(110, 12);
    g.bezierCurveTo(70, 8, 50, 30, 60, 56);
    g.bezierCurveTo(32, 50, 8, 70, 12, 112);
    g.lineWidth = 14;
    g.strokeStyle = '#120a0e';
    g.stroke();
    g.lineWidth = 8;
    g.strokeStyle = '#3a3248';
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = '#ff9a30';
    g.stroke();
  }
  D.bow_4 = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (A.IMG.bow_3) magmaFromGoldBow(g, A.IMG.bow_3);
    else drawnMagmaBow(g);
  };

  // ---------- Fire Charm: an amulet with a flame ----------
  D.gear_charm = function (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // the cord
    g.beginPath();
    g.moveTo(26, 6);
    g.quadraticCurveTo(30, 34, 58, 44);
    g.moveTo(102, 6);
    g.quadraticCurveTo(98, 34, 70, 44);
    g.lineWidth = 7;
    g.strokeStyle = '#3a1e0c';
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#a8602a';
    g.stroke();
    // the ring it hangs from
    ell(g, 64, 44, 8, 7);
    g.lineWidth = 8;
    g.strokeStyle = '#4a2e18';
    g.stroke();
    g.lineWidth = 4.5;
    g.strokeStyle = '#f0c050';
    g.stroke();
    // the gold disc
    ell(g, 64, 82, 36, 36);
    paint(g, lin(g, 30, 46, 98, 118, [[0, '#fff0a8'], [0.35, '#f0b840'], [0.75, '#c07a1a'], [1, '#8a5210']]), 5, '#4a2e18');
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      ell(g, 64 + Math.cos(a) * 30, 82 + Math.sin(a) * 30, 2.6, 2.6);
      g.fillStyle = i % 2 ? '#fff4c0' : '#a86a14';
      g.fill();
    }
    // the dark stone in it, with the flame
    ell(g, 64, 82, 24, 24);
    paint(g, rad(g, 58, 76, 2, 64, 82, 26, [[0, '#6a1a10'], [0.6, '#3a0c0a'], [1, '#1a0606']]), 4, '#4a2e18');
    g.save();
    ell(g, 64, 82, 22, 22);
    g.clip();
    halo(g, 64, 88, 26, '255,120,30', 0.6);
    g.translate(64, 101);
    g.scale(0.33, 0.33);
    g.translate(-64, -116);
    glow(g, 'rgba(255,130,30,1)', 30);
    flamePath(g);
    g.fillStyle = fireFill(g, 62, 92, 60);
    g.fill();
    noGlow(g);
    g.lineWidth = 8;
    g.strokeStyle = '#a8300c';
    g.stroke();
    g.restore();
    // the shine on the gold and the stone
    ell(g, 44, 62, 8, 4, -0.8);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
    ell(g, 56, 70, 4, 2.5, -0.8);
    g.fillStyle = 'rgba(255,220,200,0.5)';
    g.fill();
  };
})();
