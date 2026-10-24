// Runs inside headless Chromium (see tools/make-art.js). Draws every sprite sheet with Canvas 2D
// and returns them as PNG data URLs. One tile = 256x256.
(function () {
  'use strict';

  var S = 256;
  var OUT = '#3b2312'; // outline colour
  var LW = 6; // outline width

  // ---------- basics ----------
  function rng(seed) {
    var a = seed >>> 0;
    var next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = function (lo, hi) { return lo + next() * (hi - lo); };
    next.pick = function (list) { return list[Math.floor(next() * list.length)]; };
    return next;
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return c;
  }

  function lin(g, x0, y0, x1, y1, stops) {
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    return gr;
  }

  function rad(g, x0, y0, r0, x1, y1, r1, stops) {
    var gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    return gr;
  }

  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }

  function ell(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  }

  // Fill the current path, then outline it.
  function paint(g, fill, lw, stroke) {
    g.fillStyle = fill;
    g.fill();
    if (lw !== 0) {
      g.lineWidth = lw || LW;
      g.strokeStyle = stroke || OUT;
      g.stroke();
    }
  }

  function shadow(g, x, y, rx, ry, alpha) {
    g.save();
    g.filter = 'blur(' + Math.max(4, ry / 3) + 'px)';
    ell(g, x, y, rx, ry);
    g.fillStyle = 'rgba(20,30,10,' + (alpha || 0.28) + ')';
    g.fill();
    g.restore();
  }

  // Draw fn at every wrapped copy of (x, y) that touches a size x size tile (seamless textures).
  function wrap(size, x, y, reach, fn) {
    [-size, 0, size].forEach(function (dx) {
      [-size, 0, size].forEach(function (dy) {
        var px = x + dx, py = y + dy;
        if (px > -reach && px < size + reach && py > -reach && py < size + reach) fn(px, py);
      });
    });
  }

  // A cluster of shaded puffs with one shared outline (tree crowns, bushes, plants).
  function puffs(g, list, pal) {
    list.forEach(function (p) {
      g.beginPath();
      g.arc(p[0], p[1], p[2] + LW, 0, Math.PI * 2);
      g.fillStyle = OUT;
      g.fill();
    });
    list.forEach(function (p) {
      var x = p[0], y = p[1], r = p[2];
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = rad(g, x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.02,
        [[0, pal.hi], [0.45, pal.base], [1, pal.dark]]);
      g.fill();
    });
    if (pal.marks) {
      var r = rng(list.length * 7 + list[0][0]);
      list.forEach(function (p) {
        for (var i = 0; i < 3; i++) {
          var a = r.range(-2.6, -0.6), d = p[2] * r.range(0.35, 0.7);
          var mx = p[0] + Math.cos(a) * d, my = p[1] + Math.sin(a) * d;
          g.beginPath();
          g.moveTo(mx - 7, my + 3);
          g.quadraticCurveTo(mx, my - 4, mx + 7, my + 3);
          g.lineWidth = 3;
          g.strokeStyle = pal.marks;
          g.stroke();
        }
      });
    }
  }

  var LEAF = { hi: '#b9ef7a', base: '#6cc23f', dark: '#3b8a2a', marks: 'rgba(220,255,170,0.55)' };
  var DARK_LEAF = { hi: '#9fe06a', base: '#58ad37', dark: '#2f7424', marks: 'rgba(210,255,160,0.45)' };

  function leaf(g, bx, by, len, wid, ang, pal) {
    g.save();
    g.translate(bx, by);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    g.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    paint(g, lin(g, -wid, 0, wid, -len, [[0, pal.dark], [0.5, pal.base], [1, pal.hi]]), 5);
    g.beginPath();
    g.moveTo(0, -4);
    g.quadraticCurveTo(wid * 0.12, -len * 0.5, 0, -len * 0.85);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(230,255,190,0.7)';
    g.stroke();
    g.restore();
  }

  function flower(g, x, y, r, petal, center) {
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5 - Math.PI / 2;
      ell(g, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.55, r * 0.42, a);
      paint(g, petal, 2.5, 'rgba(80,50,30,0.55)');
    }
    ell(g, x, y, r * 0.42, r * 0.42);
    paint(g, center, 2.5, 'rgba(120,70,20,0.7)');
  }

  // ---------- produce (shared by crops and icons) ----------
  function turnipBulb(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 62);
    g.bezierCurveTo(-18, 52, -58, 30, -56, -2);
    g.bezierCurveTo(-54, -40, -20, -52, 0, -52);
    g.bezierCurveTo(20, -52, 54, -40, 56, -2);
    g.bezierCurveTo(58, 30, 18, 52, 0, 62);
    paint(g, lin(g, 0, -52, 0, 62, [[0, '#9b3f9c'], [0.38, '#c56bc0'], [0.5, '#f6eef4'], [1, '#e9dfe6']]));
    ell(g, -22, -18, 12, 20, -0.4);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    g.beginPath();
    g.moveTo(0, 60);
    g.lineTo(2, 78);
    g.lineWidth = 5;
    g.strokeStyle = '#cbbbc5';
    g.stroke();
    g.restore();
  }

  function potato(g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(-58, -6);
    g.bezierCurveTo(-60, -34, -24, -42, 4, -38);
    g.bezierCurveTo(40, -36, 62, -22, 60, 4);
    g.bezierCurveTo(58, 32, 24, 40, -6, 38);
    g.bezierCurveTo(-40, 36, -56, 22, -58, -6);
    paint(g, rad(g, -18, -18, 6, 0, 0, 66, [[0, '#f0cf8e'], [0.6, '#cfa060'], [1, '#a87a40']]));
    [[-24, -10], [14, -18], [30, 12], [-8, 18]].forEach(function (p) {
      ell(g, p[0], p[1], 5, 3.5);
      g.fillStyle = '#8a5f2e';
      g.fill();
    });
    ell(g, -28, -20, 14, 7, -0.3);
    g.fillStyle = 'rgba(255,245,210,0.55)';
    g.fill();
    g.restore();
  }

  function strawberry(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 60);
    g.bezierCurveTo(-30, 44, -54, 4, -48, -22);
    g.bezierCurveTo(-42, -46, 42, -46, 48, -22);
    g.bezierCurveTo(54, 4, 30, 44, 0, 60);
    paint(g, rad(g, -14, -20, 4, 0, 0, 64, [[0, '#ff8a8a'], [0.5, '#e8343f'], [1, '#b51e2a']]));
    var r = rng(5);
    for (var i = 0; i < 14; i++) {
      var sx = r.range(-34, 34), sy = r.range(-26, 40);
      if (Math.abs(sx) > 40 - sy * 0.5) continue;
      ell(g, sx, sy, 3, 4.5);
      g.fillStyle = '#ffe27a';
      g.fill();
    }
    ell(g, -18, -18, 10, 14, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fill();
    for (var k = 0; k < 5; k++) {
      leaf(g, 0, -36, 30, 12, -1.3 + k * 0.65, { hi: '#a4e36a', base: '#5cb23a', dark: '#3a7d26' });
    }
    g.restore();
  }

  // ---------- ground tiles (opaque, seamless) ----------
  // Seasons: 0 spring, 1 summer, 2 fall, 3 winter.
  var GRASS = [
    { base: '#79c94a', light: '160,226,98', dark: '78,160,48', blades: ['#58a832', '#66b83a', '#8ed65a', '#4b9a2b', '#a2e06c'] },
    { base: '#5aae37', light: '130,205,78', dark: '45,125,30', blades: ['#3f8f25', '#4fa52f', '#7cc84a', '#367f20', '#8fd85a'] },
    { base: '#b9a648', light: '222,196,98', dark: '150,118,40', blades: ['#9a8a32', '#a89a3a', '#cdb95a', '#8a7a2a', '#dcc870'] },
    { base: '#eef3f8', light: '255,255,255', dark: '170,190,218', blades: ['#a4b48a', '#8ea074'] },
  ];

  function grassTile(seed, extra, ss) {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(seed), P = GRASS[ss || 0];
    g.fillStyle = P.base;
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 16; i++) {
      var px = r() * S, py = r() * S, pr = r.range(28, 70), light = r() < 0.5;
      wrap(S, px, py, pr, function (x, y) {
        var col = light ? P.light : P.dark;
        g.fillStyle = rad(g, x, y, 0, x, y, pr, [[0, 'rgba(' + col + ',' + (light ? 0.55 : 0.45) + ')'], [1, 'rgba(' + col + ',0)']]);
        g.fillRect(x - pr, y - pr, pr * 2, pr * 2);
      });
    }
    // winter: only a few grass tips poke through the snow
    var blades = ss === 3 ? 16 + (extra || 0) / 4 : 120 + (extra || 0);
    for (var b = 0; b < blades; b++) {
      var bx = r() * S, by = r() * S, h = r.range(14, 30) * (ss === 3 ? 0.5 : 1), lean = r.range(-8, 8), col = r.pick(P.blades);
      wrap(S, bx, by, 40, function (x, y) {
        g.beginPath();
        g.moveTo(x - 3.5, y);
        g.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
        g.quadraticCurveTo(x + lean * 0.3 + 2, y - h * 0.55, x + 3.5, y);
        g.closePath();
        g.fillStyle = col;
        g.fill();
      });
    }
    if (ss === 2) fallenLeaves(g, r, 7);
    if (ss === 3) {
      for (var k = 0; k < 18; k++) {
        var sx = r() * S, sy = r() * S;
        wrap(S, sx, sy, 6, function (x, y) {
          ell(g, x, y, 2.5, 2.5);
          g.fillStyle = 'rgba(255,255,255,0.95)';
          g.fill();
        });
      }
    }
    return c;
  }

  function fallenLeaves(g, r, n) {
    for (var i = 0; i < n; i++) {
      var lx = r() * S, ly = r() * S, rot = r.range(0, 6), col = r.pick(['#e8742a', '#d9452b', '#f2b33d']);
      wrap(S, lx, ly, 16, function (x, y) {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.beginPath();
        g.moveTo(-10, 0);
        g.quadraticCurveTo(0, -8, 10, 0);
        g.quadraticCurveTo(0, 8, -10, 0);
        g.fillStyle = col;
        g.fill();
        g.restore();
      });
    }
  }

  // Grass with flowers / seasonal details: 'grass3' (light flowers) or 'flowers' (bright flowers).
  function flowerTile(kind, ss) {
    var bright = kind === 'flowers';
    var c = grassTile(bright ? 4 : 3, 0, ss), g = c.getContext('2d'), r = rng(bright ? 10 : 9);
    if (ss === 0) {
      return addFlowers(c, bright ? 10 : 9, bright
        ? [['#ff6b7a', '#ffe27a'], ['#c38bff', '#ffe27a'], ['#ff9ad5', '#fff3c0']]
        : [['#ffffff', '#ffd84d'], ['#fff3a0', '#ff9a3d']], bright ? 6 : 4);
    }
    if (ss === 1) {
      return addFlowers(c, bright ? 10 : 9, bright
        ? [['#ffcf3d', '#8a4a1a'], ['#ff8a3d', '#ffe27a']]
        : [['#ffffff', '#ffd84d'], ['#8fd0ff', '#ffffff']], bright ? 6 : 4);
    }
    if (ss === 2) {
      fallenLeaves(g, r, bright ? 16 : 10);
      if (!bright) {
        [[70, 90], [170, 170]].forEach(function (p) { // little mushrooms
          rrect(g, p[0] - 5, p[1], 10, 18, 4);
          paint(g, '#fff4e0', 3);
          g.beginPath();
          g.arc(p[0], p[1] + 2, 15, Math.PI, 0);
          g.closePath();
          paint(g, '#c9622e', 3);
        });
      }
      return c;
    }
    // winter: snow mounds, and holly berries on the bright tile
    for (var i = 0; i < (bright ? 3 : 4); i++) {
      var mx = r.range(40, 216), my = r.range(40, 216);
      ell(g, mx, my + 6, 30, 10);
      g.fillStyle = 'rgba(150,170,200,0.35)';
      g.fill();
      ell(g, mx, my, 28, 12);
      g.fillStyle = '#ffffff';
      g.fill();
      if (bright) {
        leaf(g, mx - 6, my - 4, 22, 9, -1.1, DARK_LEAF);
        leaf(g, mx + 6, my - 4, 22, 9, 1.1, DARK_LEAF);
        [[-4, -8], [4, -9], [0, -2]].forEach(function (b) {
          ell(g, mx + b[0], my + b[1], 6, 6);
          paint(g, '#e5383f', 3);
        });
      }
    }
    return c;
  }

  function addFlowers(c, seed, palettes, count) {
    var g = c.getContext('2d'), r = rng(seed);
    for (var i = 0; i < count; i++) {
      var fx = r.range(20, 236), fy = r.range(20, 236), p = r.pick(palettes), fr = r.range(9, 13);
      ell(g, fx, fy + 8, fr, fr * 0.4);
      g.fillStyle = 'rgba(40,90,20,0.3)';
      g.fill();
      flower(g, fx, fy, fr, p[0], p[1]);
    }
    return c;
  }

  function fieldTile(ss) {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(31), snow = ss === 3;
    g.fillStyle = snow ? '#eaf0f6' : '#b87a49';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 22; i++) {
      var px = r() * S, py = r() * S, pr = r.range(20, 60), light = r() < 0.5;
      wrap(S, px, py, pr, function (x, y) {
        g.fillStyle = rad(g, x, y, 0, x, y, pr, snow
          ? (light ? [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']] : [[0, 'rgba(150,110,80,0.4)'], [1, 'rgba(150,110,80,0)']])
          : light
          ? [[0, 'rgba(212,150,98,0.5)'], [1, 'rgba(212,150,98,0)']]
          : [[0, 'rgba(140,88,50,0.45)'], [1, 'rgba(140,88,50,0)']]);
        g.fillRect(x - pr, y - pr, pr * 2, pr * 2);
      });
    }
    for (var k = 0; k < 14; k++) {
      var sx = r() * S, sy = r() * S, sr = r.range(4, 9);
      wrap(S, sx, sy, 12, function (x, y) {
        ell(g, x, y + 2, sr, sr * 0.7);
        g.fillStyle = snow ? 'rgba(120,140,170,0.35)' : 'rgba(90,55,30,0.45)';
        g.fill();
        ell(g, x, y, sr, sr * 0.7);
        g.fillStyle = snow ? '#a89484' : '#d29a63';
        g.fill();
        ell(g, x - sr * 0.3, y - sr * 0.3, sr * 0.4, sr * 0.25);
        g.fillStyle = 'rgba(255,230,190,0.7)';
        g.fill();
      });
    }
    return c;
  }

  // Tilled plot: transparent around the edges so the field shows between plots.
  function tilledTile(wet) {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(wet ? 41 : 40);
    var top = wet ? '#6a4128' : '#94603a', bot = wet ? '#47291a' : '#6f4326';
    var ridgeHi = wet ? '#7d5133' : '#b07446', ridgeLo = wet ? '#523020' : '#83522f';
    rrect(g, 14, 14, 228, 228, 40);
    g.fillStyle = 'rgba(60,30,10,0.35)';
    g.fill();
    rrect(g, 10, 8, 236, 236, 40);
    paint(g, lin(g, 0, 8, 0, 244, [[0, top], [1, bot]]), 6, wet ? '#2e190c' : '#4a2a15');
    for (var i = 0; i < 4; i++) {
      var y = 32 + i * 52;
      rrect(g, 30, y + 22, 196, 14, 7);
      g.fillStyle = 'rgba(30,15,5,0.35)';
      g.fill();
      rrect(g, 28, y, 200, 30, 15);
      g.fillStyle = lin(g, 0, y, 0, y + 30, [[0, ridgeHi], [1, ridgeLo]]);
      g.fill();
      for (var k = 0; k < 4; k++) {
        ell(g, r.range(40, 216), y + r.range(6, 14), r.range(4, 8), 3);
        g.fillStyle = wet ? 'rgba(150,110,80,0.5)' : 'rgba(220,170,120,0.6)';
        g.fill();
      }
      if (wet) {
        ell(g, r.range(60, 196), y + 8, r.range(18, 34), 4);
        g.fillStyle = 'rgba(190,225,255,0.35)';
        g.fill();
      }
    }
    if (wet) {
      for (var d = 0; d < 5; d++) {
        var dx = r.range(36, 220), dy = r.range(30, 220);
        ell(g, dx, dy, 5, 7);
        g.fillStyle = 'rgba(160,210,255,0.6)';
        g.fill();
        ell(g, dx - 1.5, dy - 2.5, 1.8, 2.5);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fill();
      }
    }
    return c;
  }

  function pathTile(ss) {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(51), snow = ss === 3;
    g.fillStyle = snow ? '#cfdbe7' : '#c9a774';
    g.fillRect(0, 0, S, S);
    var fills = snow ? ['#ffffff', '#f3f7fb', '#eaf1f8', '#ffffff'] : ['#ead4a4', '#e2c895', '#d9bd87', '#efdcb2'];
    for (var gy = 0; gy < 4; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var cx = gx * 64 + 32 + r.range(-8, 8) + (gy % 2) * 10, cy = gy * 64 + 32 + r.range(-6, 6);
        var rx = r.range(24, 30), ry = r.range(20, 25), rot = r.range(-0.4, 0.4), f = r.pick(fills);
        wrap(S, cx, cy, 40, function (x, y) {
          ell(g, x + 2, y + 4, rx, ry, rot);
          g.fillStyle = 'rgba(120,90,50,0.35)';
          g.fill();
          ell(g, x, y, rx, ry, rot);
          paint(g, f, 3, snow ? '#b3c3d4' : '#b18e5b');
          ell(g, x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.28, rot);
          g.fillStyle = 'rgba(255,248,225,0.65)';
          g.fill();
        });
      }
    }
    return c;
  }

  function waterTile() {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(61);
    g.fillStyle = '#48a6e0';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 12; i++) {
      var px = r() * S, py = r() * S, pr = r.range(30, 70);
      wrap(S, px, py, pr, function (x, y) {
        g.fillStyle = rad(g, x, y, 0, x, y, pr, [[0, 'rgba(40,120,190,0.45)'], [1, 'rgba(40,120,190,0)']]);
        g.fillRect(x - pr, y - pr, pr * 2, pr * 2);
      });
    }
    waves(g, r, S, S, 14, null);
    return c;
  }

  function waves(g, r, w, h, count, clip) {
    for (var i = 0; i < count; i++) {
      var x = r() * w, y = r() * h, len = r.range(18, 34);
      var draw = function (X, Y) {
        g.beginPath();
        g.moveTo(X - len, Y);
        g.quadraticCurveTo(X - len / 2, Y - 8, X, Y);
        g.quadraticCurveTo(X + len / 2, Y - 8, X + len, Y);
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(220,245,255,0.75)';
        g.stroke();
      };
      if (clip) { if (clip(x, y)) draw(x, y); } else wrap(w, x, y, 40, draw);
    }
  }

  // ---------- multi-tile pictures ----------
  function blobPath(g, cx, cy, rx, ry, seed) {
    var r = rng(seed), k1 = r.range(0, 6), k2 = r.range(0, 6);
    g.beginPath();
    for (var i = 0; i <= 72; i++) {
      var a = i / 72 * Math.PI * 2;
      var m = 1 + 0.035 * Math.sin(3 * a + k1) + 0.025 * Math.sin(5 * a + k2);
      var x = cx + Math.cos(a) * rx * m, y = cy + Math.sin(a) * ry * m;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function pond(grass) {
    var W = 5 * S, H = 4 * S, c = canvas(W, H), g = c.getContext('2d'), r = rng(71);
    if (grass) for (var ty = 0; ty < 4; ty++) for (var tx = 0; tx < 5; tx++) g.drawImage(grass, tx * S, ty * S);
    var cx = W / 2, cy = H / 2 + 10;
    shadow(g, cx, cy + 30, 600, 440, 0.25);
    blobPath(g, cx, cy, 590, 450, 3);
    paint(g, lin(g, 0, cy - 450, 0, cy + 450, [[0, '#f1dda6'], [1, '#d6b779']]), 8);
    blobPath(g, cx, cy, 520, 390, 3);
    g.save();
    g.clip();
    g.fillStyle = rad(g, cx - 60, cy - 40, 40, cx, cy, 560, [[0, '#2876bf'], [0.7, '#45a2de'], [1, '#6fc3ee']]);
    g.fillRect(0, 0, W, H);
    // shade under the far bank
    g.fillStyle = lin(g, 0, cy - 400, 0, cy - 300, [[0, 'rgba(10,50,100,0.45)'], [1, 'rgba(10,50,100,0)']]);
    g.fillRect(0, 0, W, H);
    waves(g, r, W, H, 34, function (x, y) {
      var nx = (x - cx) / 470, ny = (y - cy) / 350;
      return nx * nx + ny * ny < 1;
    });
    g.restore();
    blobPath(g, cx, cy, 520, 390, 3);
    g.lineWidth = 8;
    g.strokeStyle = '#2b6aa0';
    g.stroke();
    // rim stones
    for (var i = 0; i < 30; i++) {
      var a = i / 30 * Math.PI * 2 + r.range(-0.05, 0.05);
      var sx = cx + Math.cos(a) * 556, sy = cy + Math.sin(a) * 420, sr = r.range(22, 34);
      ell(g, sx, sy + 4, sr, sr * 0.7);
      g.fillStyle = 'rgba(60,50,30,0.3)';
      g.fill();
      ell(g, sx, sy, sr, sr * 0.72);
      paint(g, rad(g, sx - sr * 0.3, sy - sr * 0.4, 2, sx, sy, sr, [[0, '#f1f2ee'], [0.6, '#bfc3bd'], [1, '#8d928b']]), 4);
    }
    // lily pads with flowers
    [[430, 420, 58, 0.4], [820, 620, 66, 2.2], [760, 330, 46, 4.0], [470, 690, 40, 1.0]].forEach(function (p, k) {
      g.save();
      g.translate(p[0], p[1]);
      g.rotate(p[3]);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, p[2], 0.35, Math.PI * 2 - 0.1);
      g.closePath();
      paint(g, rad(g, -p[2] * 0.3, -p[2] * 0.3, 4, 0, 0, p[2], [[0, '#a9e576'], [1, '#4f9d34']]), 5);
      g.restore();
      if (k < 2) flower(g, p[0] - 6, p[1] - 10, 22, '#ffb7d5', '#ffe27a');
    });
    // reeds
    [[150, 520], [180, 470], [1120, 560], [1150, 610], [1095, 520]].forEach(function (p, k) {
      g.beginPath();
      g.moveTo(p[0], p[1] + 70);
      g.quadraticCurveTo(p[0] + 6, p[1] + 20, p[0] + (k % 2 ? 10 : -6), p[1] - 70);
      g.lineWidth = 7;
      g.strokeStyle = '#4c8f2e';
      g.stroke();
      rrect(g, p[0] + (k % 2 ? 4 : -12), p[1] - 70, 14, 44, 7);
      paint(g, '#8a5228', 4);
    });
    return c;
  }

  function house() {
    var W = 5 * S, H = 4 * S, c = canvas(W, H), g = c.getContext('2d'), r = rng(81);
    shadow(g, W / 2, 990, 640, 40, 0.35);
    // chimney (behind the roof)
    rrect(g, 890, 40, 112, 220, 8);
    paint(g, lin(g, 890, 0, 1002, 0, [[0, '#c56a55'], [1, '#97483a']]), 8);
    for (var by = 64; by < 250; by += 30) {
      for (var bx = 890 + ((by / 30) % 2) * 28; bx < 1000; bx += 56) {
        rrect(g, bx + 4, by, 46, 22, 4);
        g.fillStyle = 'rgba(255,200,170,0.25)';
        g.fill();
      }
    }
    rrect(g, 874, 20, 144, 44, 10);
    paint(g, '#8b8f94', 8);
    // walls
    g.beginPath();
    g.rect(80, 540, 1120, 420);
    paint(g, lin(g, 0, 540, 0, 960, [[0, '#fbedcc'], [1, '#e9cf9e']]), 8);
    for (var sy = 600; sy < 950; sy += 42) {
      g.fillStyle = 'rgba(170,130,70,0.35)';
      g.fillRect(84, sy, 1112, 5);
    }
    g.fillStyle = 'rgba(80,40,10,0.22)';
    g.fillRect(84, 544, 1112, 50);
    // roof
    var roof = function () {
      g.beginPath();
      g.moveTo(20, 600);
      g.lineTo(1260, 600);
      g.lineTo(1140, 96);
      g.lineTo(140, 96);
      g.closePath();
    };
    roof();
    g.fillStyle = lin(g, 0, 96, 0, 600, [[0, '#ee7563'], [1, '#c23d32']]);
    g.fill();
    g.save();
    roof();
    g.clip();
    for (var row = 0, y = 130; y < 620; y += 54, row++) {
      for (var x = -40 + (row % 2) * 40; x < W + 40; x += 80) {
        g.beginPath();
        g.arc(x, y, 40, 0.1 * Math.PI, 0.9 * Math.PI);
        g.lineWidth = 6;
        g.strokeStyle = 'rgba(120,25,20,0.55)';
        g.stroke();
        g.beginPath();
        g.arc(x, y - 6, 34, 1.15 * Math.PI, 1.6 * Math.PI);
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(255,190,170,0.35)';
        g.stroke();
      }
    }
    g.restore();
    roof();
    g.lineWidth = 8;
    g.strokeStyle = OUT;
    g.stroke();
    rrect(g, 120, 70, 1040, 50, 25);
    paint(g, lin(g, 0, 70, 0, 120, [[0, '#d65448'], [1, '#9d2f27']]), 8);
    rrect(g, 16, 590, 1248, 30, 14);
    paint(g, '#a8342b', 8);
    // windows with shutters and flower boxes
    [200, 860].forEach(function (wx) {
      [wx - 62, wx + 230].forEach(function (sx) {
        rrect(g, sx, 650, 52, 214, 8);
        paint(g, lin(g, sx, 0, sx + 52, 0, [[0, '#6cbf57'], [1, '#4a9a3c']]), 6);
        for (var k = 0; k < 6; k++) {
          g.fillStyle = 'rgba(30,70,20,0.35)';
          g.fillRect(sx + 8, 668 + k * 32, 36, 5);
        }
      });
      rrect(g, wx, 650, 220, 214, 14);
      paint(g, '#fffaf0', 8);
      rrect(g, wx + 18, 668, 184, 178, 8);
      paint(g, lin(g, 0, 668, 0, 846, [[0, '#d7f1ff'], [1, '#7cc3ea']]), 4);
      g.beginPath();
      g.moveTo(wx + 40, 836);
      g.lineTo(wx + 120, 678);
      g.lineTo(wx + 160, 678);
      g.lineTo(wx + 80, 836);
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fill();
      g.fillStyle = '#fffaf0';
      g.fillRect(wx + 104, 668, 12, 178);
      g.fillRect(wx + 18, 750, 184, 12);
      rrect(g, wx - 20, 864, 260, 56, 10);
      paint(g, lin(g, 0, 864, 0, 920, [[0, '#b97b45'], [1, '#865328']]), 6);
      for (var f = 0; f < 6; f++) {
        leaf(g, wx + 4 + f * 42, 866, 34, 12, -0.4 + (f % 3) * 0.4, LEAF);
        flower(g, wx + 10 + f * 42, 852, 17, ['#ff6b7a', '#ffd84d', '#ff9ad5'][f % 3], '#fff3c0');
      }
    });
    // door (block column 2 => x 512..768)
    var door = function () {
      g.beginPath();
      g.moveTo(548, 960);
      g.lineTo(548, 740);
      g.arc(640, 740, 92, Math.PI, 0);
      g.lineTo(732, 960);
      g.closePath();
    };
    g.save();
    g.translate(0, 0);
    g.beginPath();
    g.moveTo(524, 966);
    g.lineTo(524, 738);
    g.arc(640, 738, 116, Math.PI, 0);
    g.lineTo(756, 966);
    g.closePath();
    paint(g, '#fffaf0', 8);
    g.restore();
    door();
    paint(g, lin(g, 548, 0, 732, 0, [[0, '#b8743f'], [1, '#86502a']]), 8);
    [[568, 760], [648, 760], [568, 860], [648, 860]].forEach(function (p) {
      rrect(g, p[0], p[1], 64, 80, 8);
      paint(g, 'rgba(90,50,20,0.25)', 4, 'rgba(70,35,10,0.5)');
    });
    ell(g, 640, 700, 46, 30);
    paint(g, lin(g, 0, 670, 0, 730, [[0, '#d7f1ff'], [1, '#89c9ec']]), 5);
    ell(g, 708, 870, 13, 13);
    paint(g, rad(g, 703, 865, 2, 708, 870, 13, [[0, '#fff3a0'], [1, '#d4a01e']]), 4);
    // stone footing and doorstep
    rrect(g, 60, 950, 1160, 62, 14);
    paint(g, lin(g, 0, 950, 0, 1012, [[0, '#b9bec4'], [1, '#868c94']]), 8);
    for (var st = 0; st < 22; st++) {
      ell(g, 90 + st * 52 + r.range(-6, 6), 980 + r.range(-6, 6), r.range(16, 22), 11);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fill();
    }
    rrect(g, 500, 948, 280, 60, 12);
    paint(g, lin(g, 0, 948, 0, 1008, [[0, '#d5d8dc'], [1, '#9ea4ab']]), 8);
    return c;
  }

  function shop() {
    var W = 6 * S, H = 4 * S, c = canvas(W, H), g = c.getContext('2d');
    shadow(g, W / 2, 985, 760, 40, 0.35);
    // back wall
    g.beginPath();
    g.rect(70, 270, 1396, 690);
    paint(g, lin(g, 0, 270, 0, 960, [[0, '#a3dc96'], [1, '#6fb465']]), 8);
    for (var px = 130; px < 1466; px += 64) {
      g.fillStyle = 'rgba(40,100,40,0.25)';
      g.fillRect(px, 274, 5, 682);
    }
    // roof band
    g.beginPath();
    g.moveTo(20, 320);
    g.lineTo(1516, 320);
    g.lineTo(1430, 170);
    g.lineTo(106, 170);
    g.closePath();
    paint(g, lin(g, 0, 170, 0, 320, [[0, '#b57442'], [1, '#7f4a25']]), 8);
    [220, 270].forEach(function (y, row) {
      g.fillStyle = 'rgba(60,25,10,0.4)';
      g.fillRect(60 + row * 30, y, 1416 - row * 60, 6);
      g.fillStyle = 'rgba(255,210,160,0.3)';
      g.fillRect(60 + row * 30, y + 6, 1416 - row * 60, 4);
    });
    for (var row = 0; row < 3; row++) {
      for (var rx = 130 + (row % 2) * 40; rx < 1420; rx += 80) {
        g.fillStyle = 'rgba(60,25,10,0.35)';
        g.fillRect(rx, 176 + row * 50, 5, 44);
      }
    }
    // side windows
    [150, 1206].forEach(function (wx) {
      rrect(g, wx, 360, 180, 150, 12);
      paint(g, '#fffaf0', 8);
      rrect(g, wx + 14, 374, 152, 122, 6);
      paint(g, lin(g, 0, 374, 0, 496, [[0, '#d7f1ff'], [1, '#7cc3ea']]), 4);
      g.fillStyle = '#fffaf0';
      g.fillRect(wx + 84, 374, 12, 122);
    });
    // hanging sign
    [[560, 200, 590, 60], [976, 200, 946, 60]].forEach(function (l) {
      g.beginPath();
      g.moveTo(l[0], l[1]);
      g.lineTo(l[2], l[3]);
      g.lineWidth = 8;
      g.strokeStyle = '#5a3a1e';
      g.stroke();
    });
    rrect(g, 490, 16, 556, 196, 28);
    paint(g, lin(g, 0, 16, 0, 212, [[0, '#fff1c8'], [1, '#efcf8e']]), 10);
    rrect(g, 512, 36, 512, 156, 18);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(160,100,40,0.5)';
    g.stroke();
    g.font = 'bold 124px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 14;
    g.strokeStyle = '#fff8e0';
    g.strokeText('SEEDS', 768, 120);
    g.fillStyle = '#7a3d1a';
    g.fillText('SEEDS', 768, 120);
    flower(g, 548, 70, 22, '#ff6b7a', '#ffe27a');
    flower(g, 990, 160, 22, '#ffd84d', '#ff9a3d');
    // shopkeeper (behind the counter)
    lily(g, 768, 600);
    // awning
    var awn = function () {
      g.beginPath();
      g.moveTo(50, 430);
      g.lineTo(1486, 430);
      g.lineTo(1486, 540);
      for (var x = 1486; x > 50; x -= 96) g.arc(x - 48, 540, 48, 0, Math.PI);
      g.closePath();
    };
    g.save();
    awn();
    g.clip();
    for (var s = 0, x = 50; x < 1486; x += 96, s++) {
      g.fillStyle = s % 2 ? '#fff6ea' : '#e5484d';
      g.fillRect(x, 420, 96, 180);
    }
    g.fillStyle = lin(g, 0, 430, 0, 590, [[0, 'rgba(255,255,255,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(80,0,0,0.2)']]);
    g.fillRect(40, 420, 1460, 180);
    g.restore();
    awn();
    g.lineWidth = 8;
    g.strokeStyle = OUT;
    g.stroke();
    // poles
    [70, 1450].forEach(function (x) {
      rrect(g, x, 540, 22, 420, 8);
      paint(g, '#c98b4f', 6);
    });
    // counter
    rrect(g, 200, 760, 1136, 210, 14);
    paint(g, lin(g, 0, 760, 0, 970, [[0, '#cf9257'], [1, '#93582d']]), 8);
    for (var cx = 270; cx < 1336; cx += 76) {
      g.fillStyle = 'rgba(70,35,10,0.3)';
      g.fillRect(cx, 790, 6, 170);
    }
    rrect(g, 176, 730, 1184, 52, 14);
    paint(g, lin(g, 0, 730, 0, 782, [[0, '#e6aa6c'], [1, '#b8763f']]), 8);
    // produce crates on the counter
    [[240, 'turnip'], [450, 'potato'], [912, 'strawberry'], [1122, 'carrot']].forEach(function (p) {
      var x = p[0];
      for (var i = 0; i < 5; i++) {
        var ix = x + 30 + i * 30, iy = 660 + (i % 2) * 14;
        if (p[1] === 'turnip') turnipBulb(g, ix, iy, 0.42);
        else if (p[1] === 'potato') potato(g, ix, iy + 8, 0.42, i);
        else if (p[1] === 'strawberry') strawberry(g, ix, iy + 6, 0.4);
        else carrot(g, ix, iy + 4);
      }
      rrect(g, x, 672, 180, 70, 8);
      paint(g, lin(g, 0, 672, 0, 742, [[0, '#d9a066'], [1, '#a66d38']]), 6);
      g.fillStyle = 'rgba(70,35,10,0.35)';
      g.fillRect(x + 6, 704, 168, 6);
    });
    return c;
  }

  function carrot(g, x, y) {
    g.save();
    g.translate(x, y);
    leaf(g, 0, -18, 30, 9, -0.3, LEAF);
    leaf(g, 0, -18, 30, 9, 0.3, LEAF);
    g.beginPath();
    g.moveTo(-14, -20);
    g.quadraticCurveTo(0, -26, 14, -20);
    g.lineTo(2, 30);
    g.closePath();
    paint(g, lin(g, -14, 0, 14, 0, [[0, '#ffb04a'], [1, '#e8741e']]), 4);
    g.restore();
  }

  function lily(g, x, y) {
    // dress + arms
    rrect(g, x - 100, y + 60, 200, 160, 60);
    paint(g, lin(g, 0, y + 60, 0, y + 220, [[0, '#ff8aa4'], [1, '#e0557a']]));
    rrect(g, x - 60, y + 80, 120, 140, 20);
    paint(g, '#fff6e8', 5);
    // hair back
    ell(g, x, y - 10, 96, 92);
    paint(g, lin(g, 0, y - 100, 0, y + 80, [[0, '#c0622e'], [1, '#8e4119']]));
    ell(g, x, y - 104, 40, 34);
    paint(g, '#a5522a');
    // face
    ell(g, x, y + 4, 72, 70);
    paint(g, rad(g, x - 20, y - 20, 6, x, y, 80, [[0, '#ffe0c4'], [1, '#f2b88e']]));
    g.beginPath();
    g.moveTo(x - 74, y - 6);
    g.quadraticCurveTo(x - 50, y - 80, x + 4, y - 60);
    g.quadraticCurveTo(x + 60, y - 84, x + 76, y - 6);
    g.quadraticCurveTo(x + 40, y - 40, x, y - 30);
    g.quadraticCurveTo(x - 40, y - 44, x - 74, y - 6);
    paint(g, lin(g, 0, y - 80, 0, y, [[0, '#c86a33'], [1, '#a2501f']]), 5);
    eyes(g, x - 26, x + 26, y + 6);
    ell(g, x - 44, y + 32, 14, 8);
    g.fillStyle = 'rgba(255,110,110,0.4)';
    g.fill();
    ell(g, x + 44, y + 32, 14, 8);
    g.fill();
    g.beginPath();
    g.arc(x, y + 30, 18, 0.2 * Math.PI, 0.8 * Math.PI);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    flower(g, x + 58, y - 52, 20, '#ffd84d', '#ff8a3d');
  }

  function eyes(g, x1, x2, y) {
    [x1, x2].forEach(function (x) {
      ell(g, x, y, 9, 13);
      g.fillStyle = OUT;
      g.fill();
      ell(g, x - 3, y - 5, 3.5, 4.5);
      g.fillStyle = '#ffffff';
      g.fill();
    });
  }

  // ---------- single object tiles (transparent) ----------
  var WOOD = { light: '#e5ac6d', base: '#c98b4f', dark: '#935a2f' };

  function fencePost(g) {
    shadow(g, 128, 236, 40, 12, 0.3);
    g.beginPath();
    g.moveTo(98, 232);
    g.lineTo(98, 64);
    g.quadraticCurveTo(128, 26, 158, 64);
    g.lineTo(158, 232);
    g.closePath();
    paint(g, lin(g, 98, 0, 158, 0, [[0, WOOD.light], [0.55, WOOD.base], [1, WOOD.dark]]));
    g.beginPath();
    g.moveTo(116, 90);
    g.quadraticCurveTo(122, 150, 114, 210);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(90,50,20,0.45)';
    g.stroke();
  }

  function rail(g, y, h) {
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, WOOD.light], [0.5, WOOD.base], [1, WOOD.dark]]);
    g.fillRect(0, y, S, h);
    g.fillStyle = OUT;
    g.fillRect(0, y - 3, S, 6);
    g.fillRect(0, y + h - 3, S, 6);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, y + h + 3, S, 8);
  }

  function fenceH() {
    var c = canvas(S, S), g = c.getContext('2d');
    rail(g, 92, 30);
    rail(g, 160, 30);
    fencePost(g);
    [[128, 107], [128, 175]].forEach(function (p) {
      ell(g, p[0] - 16, p[1], 4, 4);
      g.fillStyle = '#6b6f75';
      g.fill();
      ell(g, p[0] + 16, p[1], 4, 4);
      g.fill();
    });
    return c;
  }

  function fenceV() {
    var c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = lin(g, 114, 0, 142, 0, [[0, WOOD.light], [1, WOOD.dark]]);
    g.fillRect(113, 0, 30, S);
    g.fillStyle = OUT;
    g.fillRect(110, 0, 6, S);
    g.fillRect(140, 0, 6, S);
    fencePost(g);
    return c;
  }

  function fencePostTile() {
    var c = canvas(S, S);
    fencePost(c.getContext('2d'));
    return c;
  }

  var TREE_LEAF = [
    LEAF,
    { hi: '#9fe06a', base: '#4fa52f', dark: '#2a6e1f', marks: 'rgba(200,255,150,0.45)' },
    { hi: '#ffd27a', base: '#f08a2c', dark: '#b4501c', marks: 'rgba(255,230,170,0.55)' },
    { hi: '#cfe0d4', base: '#6f9a86', dark: '#3f6656', marks: null },
  ];

  function tree(ss) {
    var c = canvas(2 * S, 2 * S), g = c.getContext('2d'), r = rng(91);
    shadow(g, 256, 462, 170, 36, 0.32);
    g.beginPath();
    g.moveTo(196, 476);
    g.quadraticCurveTo(226, 452, 228, 300);
    g.lineTo(284, 300);
    g.quadraticCurveTo(286, 452, 316, 476);
    g.quadraticCurveTo(256, 490, 196, 476);
    paint(g, lin(g, 196, 0, 316, 0, [[0, '#a96d3c'], [0.6, '#7d4a26'], [1, '#5d3418']]), 7);
    [[246, 330, 250, 440], [268, 360, 272, 460]].forEach(function (l) {
      g.beginPath();
      g.moveTo(l[0], l[1]);
      g.quadraticCurveTo(l[0] - 6, (l[1] + l[3]) / 2, l[2], l[3]);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(50,25,10,0.5)';
      g.stroke();
    });
    var crown = [[256, 118, 100], [150, 168, 92], [362, 168, 92], [116, 262, 78], [396, 262, 78], [196, 288, 96], [316, 288, 96], [256, 222, 108]];
    puffs(g, crown, TREE_LEAF[ss || 0]);
    var spot = function () {
      var a = r.range(0, Math.PI * 2), d = r.range(60, 170);
      return [256 + Math.cos(a) * d * 1.1, 220 + Math.sin(a) * d * 0.75];
    };
    if (!ss) { // spring blossoms
      for (var b = 0; b < 12; b++) {
        var p = spot();
        flower(g, p[0], p[1], 15, b % 3 ? '#ffc4dd' : '#ffffff', '#ff8ab5');
      }
    } else if (ss === 2) { // autumn apples
      for (var i = 0; i < 7; i++) {
        var q = spot();
        ell(g, q[0], q[1], 17, 17);
        paint(g, rad(g, q[0] - 5, q[1] - 6, 2, q[0], q[1], 17, [[0, '#ff8b7a'], [1, '#d42c2c']]), 5);
        g.beginPath();
        g.moveTo(q[0], q[1] - 16);
        g.lineTo(q[0] + 3, q[1] - 26);
        g.lineWidth = 4;
        g.strokeStyle = '#5d3418';
        g.stroke();
      }
    } else if (ss === 3) { // snow caps on every puff
      crown.forEach(function (pf) {
        g.beginPath();
        g.ellipse(pf[0] - pf[2] * 0.05, pf[1] - pf[2] * 0.45, pf[2] * 0.78, pf[2] * 0.42, 0, Math.PI, 0);
        g.quadraticCurveTo(pf[0] + pf[2] * 0.3, pf[1] - pf[2] * 0.25, pf[0], pf[1] - pf[2] * 0.3);
        g.quadraticCurveTo(pf[0] - pf[2] * 0.4, pf[1] - pf[2] * 0.2, pf[0] - pf[2] * 0.83, pf[1] - pf[2] * 0.45);
        g.fillStyle = '#ffffff';
        g.fill();
      });
    }
    return c;
  }

  function bush(ss) {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 222, 96, 22);
    var parts = [[128, 128, 62], [76, 168, 54], [180, 168, 54], [128, 180, 62]];
    puffs(g, parts, ss === 2 ? TREE_LEAF[2] : ss === 3 ? TREE_LEAF[3] : DARK_LEAF);
    var dots = [[92, 140], [150, 120], [170, 176], [110, 190], [70, 176]];
    if (!ss) dots.forEach(function (p) { flower(g, p[0], p[1], 13, '#ff9ad5', '#fff3c0'); });
    if (ss === 1) {
      dots.concat([[130, 160], [100, 110]]).forEach(function (p) {
        ell(g, p[0], p[1], 9, 9);
        paint(g, rad(g, p[0] - 3, p[1] - 3, 1, p[0], p[1], 9, [[0, '#9aa8ff'], [1, '#3b4fc4']]), 3);
      });
    }
    if (ss === 3) {
      parts.forEach(function (pf) {
        g.beginPath();
        g.ellipse(pf[0], pf[1] - pf[2] * 0.42, pf[2] * 0.75, pf[2] * 0.4, 0, Math.PI, 0);
        g.closePath();
        g.fillStyle = '#ffffff';
        g.fill();
      });
    }
    return c;
  }

  function rock() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 212, 92, 20);
    g.beginPath();
    g.moveTo(44, 200);
    g.quadraticCurveTo(34, 140, 82, 110);
    g.quadraticCurveTo(122, 76, 170, 96);
    g.quadraticCurveTo(220, 116, 214, 172);
    g.quadraticCurveTo(212, 206, 160, 210);
    g.lineTo(80, 212);
    g.quadraticCurveTo(50, 212, 44, 200);
    paint(g, rad(g, 100, 110, 10, 128, 160, 120, [[0, '#e8ecef'], [0.55, '#aab2bb'], [1, '#737c86']]), 7);
    g.beginPath();
    g.moveTo(96, 120);
    g.quadraticCurveTo(130, 100, 162, 114);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.stroke();
    ell(g, 170, 196, 28, 12);
    g.fillStyle = 'rgba(110,180,70,0.8)';
    g.fill();
    return c;
  }

  function stump() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 214, 84, 18);
    g.beginPath();
    g.moveTo(58, 120);
    g.lineTo(62, 196);
    g.quadraticCurveTo(128, 226, 194, 196);
    g.lineTo(198, 120);
    paint(g, lin(g, 58, 0, 198, 0, [[0, '#ad7240'], [1, '#6e4122']]), 7);
    ell(g, 128, 120, 70, 30);
    paint(g, rad(g, 128, 120, 4, 128, 120, 70, [[0, '#f2cf96'], [1, '#c9955a']]), 7);
    [44, 28, 14].forEach(function (rr) {
      ell(g, 128, 120, rr, rr * 0.42);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(140,90,40,0.6)';
      g.stroke();
    });
    // a little mushroom
    rrect(g, 176, 176, 14, 30, 6);
    paint(g, '#fff4e0', 4);
    g.beginPath();
    g.arc(183, 180, 22, Math.PI, 0);
    g.closePath();
    paint(g, '#e5484d', 4);
    ell(g, 176, 170, 4, 4);
    g.fillStyle = '#fff';
    g.fill();
    return c;
  }

  function tallgrass(ss) {
    var c = canvas(S, S), g = c.getContext('2d'), r = rng(101);
    var cols = [['#a7e06c', '#4a9a2b', '#2f6a1c'], ['#8fd85a', '#3f8f25', '#25601a'], ['#f2d77a', '#b08a3a', '#6e5320'], ['#c9b48a', '#8a7454', '#5a4a34']][ss || 0];
    shadow(g, 128, 214, 70, 12, 0.2);
    for (var i = 0; i < 13; i++) {
      var x = 70 + i * 9 + r.range(-4, 4), h = r.range(70, 130), lean = r.range(-30, 30);
      g.beginPath();
      g.moveTo(x - 7, 214);
      g.quadraticCurveTo(x + lean * 0.3, 214 - h * 0.6, x + lean, 214 - h);
      g.quadraticCurveTo(x + lean * 0.3 + 4, 214 - h * 0.5, x + 7, 214);
      g.closePath();
      paint(g, lin(g, 0, 214 - h, 0, 214, [[0, cols[0]], [1, cols[1]]]), 3.5, cols[2]);
    }
    if (ss === 3) {
      ell(g, 128, 210, 70, 18);
      g.fillStyle = '#ffffff';
      g.fill();
    } else {
      flower(g, 150, 110, 14, ss === 2 ? '#f2a03d' : '#ffffff', '#ffd84d');
    }
    return c;
  }

  function shipbox() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 226, 112, 18, 0.35);
    rrect(g, 26, 96, 204, 130, 12);
    paint(g, lin(g, 0, 96, 0, 226, [[0, '#d39a5c'], [1, '#93592e']]), 7);
    [134, 176].forEach(function (y) {
      g.fillStyle = 'rgba(70,35,10,0.4)';
      g.fillRect(30, y, 196, 5);
    });
    [[26, 96], [196, 96]].forEach(function (p) {
      rrect(g, p[0], p[1], 34, 130, 6);
      paint(g, lin(g, 0, 96, 0, 226, [[0, '#c3c8ce'], [1, '#7d848c']]), 5);
    });
    rrect(g, 14, 60, 228, 50, 14);
    paint(g, lin(g, 0, 60, 0, 110, [[0, '#c98447'], [1, '#8c5326']]), 7);
    rrect(g, 80, 136, 96, 52, 8);
    paint(g, '#fff1c8', 5);
    g.font = 'bold 34px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#7a3d1a';
    g.fillText('SHIP', 128, 164);
    rrect(g, 112, 92, 32, 26, 6);
    paint(g, rad(g, 122, 98, 2, 128, 105, 20, [[0, '#fff3a0'], [1, '#d4a01e']]), 5);
    return c;
  }

  function sign() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 230, 50, 12);
    rrect(g, 114, 120, 28, 112, 8);
    paint(g, lin(g, 114, 0, 142, 0, [[0, WOOD.light], [1, WOOD.dark]]));
    rrect(g, 32, 46, 192, 104, 16);
    paint(g, lin(g, 0, 46, 0, 150, [[0, '#e9b67a'], [1, '#b67a42']]));
    [74, 98, 122].forEach(function (y, i) {
      g.beginPath();
      g.moveTo(62, y);
      g.lineTo(194 - i * 28, y);
      g.lineWidth = 7;
      g.strokeStyle = 'rgba(90,45,15,0.6)';
      g.stroke();
    });
    return c;
  }

  // ---------- farmer (256x384 frames) ----------
  var SKIN = ['#ffe0c4', '#f2b88e'];
  var CAP = ['#f26352', '#c23a2d'];
  var SHIRT = ['#ffe27a', '#f2b43a'];
  var DENIM = ['#5b8ee0', '#355fb0'];
  var BOOT = ['#94572c', '#6a3a1a'];

  function boot(g, x, y, w, toeLeft) {
    rrect(g, x - (toeLeft ? 14 : 4), y, w + (toeLeft ? 18 : 8), 32, 14);
    paint(g, lin(g, 0, y, 0, y + 32, [[0, BOOT[0]], [1, BOOT[1]]]));
  }

  // pose: null (walking), 'raise' (tool up over the head) or 'strike' (tool down in front).
  function farmer(g, dir, step, pose) {
    var bob = step ? -6 : 0;
    if (pose) step = 0;
    var swing = step === 1 ? 10 : step === 2 ? -10 : 0;
    var lift = [0, 0];
    if (step === 1) lift[0] = 16;
    if (step === 2) lift[1] = 16;
    g.save();
    if (dir === 'side') {
      farmerSide(g, step, bob, pose);
      g.restore();
      return;
    }
    var back = dir === 'up';
    // legs + boots
    [[86, lift[0]], [132, lift[1]]].forEach(function (l) {
      rrect(g, l[0], 262 + bob, 40, 92 - l[1] - bob, 12);
      paint(g, lin(g, l[0], 0, l[0] + 40, 0, [[0, DENIM[0]], [1, DENIM[1]]]));
      boot(g, l[0], 340 - l[1], 40, false);
    });
    // arms (in a tool pose they are drawn as limbs pointing up or forward, see below)
    var poseArms = function () {
      var ang = pose === 'raise' ? 2.667 : 0.668;
      limb(g, 60, 196 + bob, -ang, 34, 84, SHIRT, true);
      limb(g, 196, 196 + bob, ang, 34, 84, SHIRT, true);
    };
    if (pose === 'raise' || (pose === 'strike' && back)) poseArms();
    if (!pose) [[40, swing], [182, -swing]].forEach(function (a) {
      rrect(g, a[0], 186 + bob + a[1], 36, 86, 18);
      paint(g, lin(g, a[0], 0, a[0] + 36, 0, [[0, SHIRT[0]], [1, SHIRT[1]]]));
      ell(g, a[0] + 18, 278 + bob + a[1], 18, 18);
      paint(g, rad(g, a[0] + 12, 272 + bob + a[1], 2, a[0] + 18, 278 + bob + a[1], 18, SKIN.map(function (c, i) { return [i, c]; })));
    });
    // shirt + overalls
    rrect(g, 64, 176 + bob, 128, 108, 38);
    paint(g, lin(g, 0, 176, 0, 284, [[0, SHIRT[0]], [1, SHIRT[1]]]));
    rrect(g, 72, 246 + bob, 112, 52, 20);
    paint(g, lin(g, 0, 246, 0, 298, [[0, DENIM[0]], [1, DENIM[1]]]));
    if (!back) {
      rrect(g, 88, 200 + bob, 80, 74, 14);
      paint(g, lin(g, 0, 200, 0, 274, [[0, DENIM[0]], [1, DENIM[1]]]));
      [[96, 204], [160, 204]].forEach(function (p) {
        ell(g, p[0], p[1] + bob, 7, 7);
        paint(g, '#ffd84d', 4);
      });
      rrect(g, 110, 222 + bob, 36, 26, 6);
      paint(g, 'rgba(255,255,255,0.18)', 3, 'rgba(30,50,110,0.7)');
    }
    if (pose === 'strike' && !back) poseArms();
    if (back) {
      g.beginPath();
      g.moveTo(82, 184 + bob);
      g.lineTo(168, 254 + bob);
      g.moveTo(174, 184 + bob);
      g.lineTo(88, 254 + bob);
      g.lineWidth = 16;
      g.strokeStyle = DENIM[1];
      g.stroke();
    }
    // head
    var hy = 108 + bob;
    [[52, hy + 10], [204, hy + 10]].forEach(function (e) {
      ell(g, e[0], e[1], 16, 20);
      paint(g, SKIN[1]);
    });
    ell(g, 128, hy, 80, 78);
    paint(g, back ? lin(g, 0, hy - 78, 0, hy + 78, [[0, '#a45a2c'], [1, '#7a3f1c']])
      : rad(g, 104, hy - 20, 8, 128, hy, 86, SKIN.map(function (c, i) { return [i, c]; })));
    if (!back) {
      g.beginPath();
      g.moveTo(52, hy - 4);
      g.quadraticCurveTo(70, hy - 56, 128, hy - 50);
      g.quadraticCurveTo(186, hy - 56, 204, hy - 4);
      g.quadraticCurveTo(170, hy - 30, 128, hy - 26);
      g.quadraticCurveTo(86, hy - 30, 52, hy - 4);
      paint(g, lin(g, 0, hy - 56, 0, hy, [[0, '#a45a2c'], [1, '#7a3f1c']]), 5);
      eyes(g, 100, 156, hy + 18);
      ell(g, 84, hy + 44, 14, 8);
      g.fillStyle = 'rgba(255,110,110,0.4)';
      g.fill();
      ell(g, 172, hy + 44, 14, 8);
      g.fill();
      g.beginPath();
      g.arc(128, hy + 40, 18, 0.2 * Math.PI, 0.8 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
    }
    // cap
    g.beginPath();
    g.arc(128, hy - 18, 80, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    paint(g, lin(g, 0, hy - 98, 0, hy - 18, [[0, CAP[0]], [1, CAP[1]]]));
    if (!back) {
      ell(g, 128, hy - 16, 94, 22);
      paint(g, lin(g, 0, hy - 38, 0, hy + 6, [[0, CAP[1]], [1, '#992a21']]));
      ell(g, 128, hy - 54, 26, 22);
      paint(g, '#fff8e8', 4);
      leaf(g, 120, hy - 40, 30, 12, 0.6, LEAF);
      leaf(g, 136, hy - 40, 30, 12, -0.6, LEAF);
    } else {
      rrect(g, 104, hy - 30, 48, 14, 6);
      paint(g, '#fff8e8', 4);
    }
    ell(g, 128, hy - 98, 10, 7);
    paint(g, CAP[1], 4);
    g.restore();
  }

  function limb(g, px, py, ang, w, len, cols, hand) {
    g.save();
    g.translate(px, py);
    g.rotate(ang);
    rrect(g, -w / 2, -w / 3, w, len, w / 2);
    paint(g, lin(g, -w / 2, 0, w / 2, 0, [[0, cols[0]], [1, cols[1]]]));
    if (hand) {
      ell(g, 0, len - 4, 17, 17);
      paint(g, SKIN[0]);
    }
    g.restore();
  }

  function farmerSide(g, step, bob, pose) {
    var legA = step === 1 ? 0.42 : step === 2 ? -0.3 : 0.06;
    var legB = step === 1 ? -0.3 : step === 2 ? 0.42 : -0.06;
    var arm = step === 1 ? -0.45 : step === 2 ? 0.45 : 0;
    if (pose === 'raise') arm = -2.9;
    if (pose === 'strike') arm = 1.0;
    var hipY = 270 + bob;
    // back leg, back arm
    sideLeg(g, 132, hipY, legB, true);
    limb(g, 136, 196 + bob, pose ? arm * 0.9 : -arm, 32, 82, [SHIRT[1], '#d8962a'], true);
    // body
    rrect(g, 84, 174 + bob, 96, 112, 36);
    paint(g, lin(g, 84, 0, 180, 0, [[0, SHIRT[0]], [1, SHIRT[1]]]));
    rrect(g, 88, 238 + bob, 90, 56, 20);
    paint(g, lin(g, 0, 238, 0, 294, [[0, DENIM[0]], [1, DENIM[1]]]));
    rrect(g, 88, 196 + bob, 56, 70, 12);
    paint(g, lin(g, 0, 196, 0, 266, [[0, DENIM[0]], [1, DENIM[1]]]));
    sideLeg(g, 126, hipY, legA, false);
    // head (facing left)
    var hy = 108 + bob;
    ell(g, 128, hy, 76, 76);
    paint(g, rad(g, 104, hy - 20, 8, 128, hy, 84, SKIN.map(function (c, i) { return [i, c]; })));
    g.beginPath();
    g.moveTo(150, hy - 70);
    g.quadraticCurveTo(212, hy - 40, 200, hy + 30);
    g.quadraticCurveTo(170, hy + 10, 150, hy + 20);
    g.closePath();
    paint(g, lin(g, 0, hy - 70, 0, hy + 30, [[0, '#a45a2c'], [1, '#7a3f1c']]), 5);
    ell(g, 154, hy + 12, 16, 20);
    paint(g, SKIN[1]);
    ell(g, 50, hy + 22, 14, 13);
    paint(g, SKIN[1], 5);
    eyes(g, 86, 86, hy + 10);
    ell(g, 92, hy + 42, 14, 8);
    g.fillStyle = 'rgba(255,110,110,0.4)';
    g.fill();
    g.beginPath();
    g.arc(70, hy + 44, 14, 0.25 * Math.PI, 0.75 * Math.PI);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    // cap with the brim to the left
    g.beginPath();
    g.moveTo(36, hy - 16);
    g.quadraticCurveTo(10, hy - 14, 14, hy - 4);
    g.quadraticCurveTo(50, hy + 2, 110, hy - 10);
    g.closePath();
    paint(g, lin(g, 0, hy - 20, 0, hy, [[0, CAP[1]], [1, '#992a21']]));
    g.beginPath();
    g.arc(130, hy - 16, 78, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    paint(g, lin(g, 0, hy - 94, 0, hy - 16, [[0, CAP[0]], [1, CAP[1]]]));
    ell(g, 86, hy - 52, 18, 16);
    paint(g, '#fff8e8', 4);
    ell(g, 130, hy - 94, 10, 7);
    paint(g, CAP[1], 4);
    // front arm
    limb(g, 124, 196 + bob, arm, 34, 84, SHIRT, true);
  }

  function sideLeg(g, hx, hy, ang, back) {
    g.save();
    g.translate(hx, hy);
    g.rotate(ang);
    rrect(g, -20, -10, 40, 84, 12);
    paint(g, lin(g, -20, 0, 20, 0, back ? [[0, DENIM[1]], [1, '#24467f']] : [[0, DENIM[0]], [1, DENIM[1]]]));
    rrect(g, -34, 66, 58, 32, 14);
    paint(g, lin(g, 0, 66, 0, 98, back ? [[0, BOOT[1]], [1, '#4d2a12']] : [[0, BOOT[0]], [1, BOOT[1]]]));
    g.restore();
  }

  // ---------- crops (256x256, planted at the bottom centre) ----------
  function mound(g, w) {
    ell(g, 128, 222, w, w * 0.34);
    paint(g, lin(g, 0, 200, 0, 240, [[0, '#9a6238'], [1, '#6c4024']]), 5);
  }

  function cropSeeds(g) {
    mound(g, 70);
    [[100, 214], [124, 206], [150, 214], [114, 226], [140, 226]].forEach(function (p) {
      ell(g, p[0], p[1], 7, 5, 0.4);
      paint(g, '#f3dca8', 3, '#6a4020');
    });
  }

  function cropSprout(g) {
    mound(g, 56);
    g.beginPath();
    g.moveTo(128, 222);
    g.quadraticCurveTo(124, 190, 128, 168);
    g.lineWidth = 8;
    g.strokeStyle = '#3d8a28';
    g.stroke();
    leaf(g, 128, 172, 54, 20, -1.0, LEAF);
    leaf(g, 128, 172, 54, 20, 1.0, LEAF);
  }

  function tomato(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    ell(g, 0, 6, 46, 40);
    paint(g, rad(g, -14, -8, 4, 0, 6, 50, [[0, '#ff8a7a'], [0.55, '#ea3b2e'], [1, '#b52419']]));
    ell(g, -16, -10, 10, 7, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fill();
    for (var k = 0; k < 5; k++) leaf(g, 0, -28, 22, 9, -1.3 + k * 0.65, { hi: '#a4e36a', base: '#5cb23a', dark: '#3a7d26' });
    g.restore();
  }

  function cornCob(g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    ell(g, 0, 0, 22, 54);
    paint(g, lin(g, -22, 0, 22, 0, [[0, '#fff09a'], [1, '#f2b72f']]));
    for (var ry = -40; ry < 46; ry += 12) {
      for (var rx = -14; rx <= 14; rx += 10) {
        ell(g, rx, ry, 4, 5);
        g.fillStyle = 'rgba(200,130,20,0.45)';
        g.fill();
      }
    }
    [-1, 1].forEach(function (side) {
      g.beginPath();
      g.moveTo(side * 6, 54);
      g.quadraticCurveTo(side * 40, 20, side * 18, -30);
      g.quadraticCurveTo(side * 26, 20, side * 2, 54);
      paint(g, lin(g, 0, -30, 0, 54, [[0, '#a4e36a'], [1, '#4f9a33']]), 4);
    });
    g.restore();
  }

  function pumpkin(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    [[-34, 30, 40], [34, 30, 40], [0, 34, 46]].forEach(function (p) {
      ell(g, p[0], 0, p[2] * 0.8, p[1] * 1.45);
      paint(g, rad(g, p[0] - 10, -14, 4, p[0], 0, 60, [[0, '#ffc06a'], [0.6, '#f58a1f'], [1, '#c45d0e']]));
    });
    rrect(g, -7, -58, 14, 20, 5);
    paint(g, '#6b8a2a', 4);
    ell(g, -18, -24, 8, 14, -0.3);
    g.fillStyle = 'rgba(255,240,200,0.5)';
    g.fill();
    g.restore();
  }

  var CROP_DRAW = {
    turnip: [cropSeeds, cropSprout, function (g) {
      mound(g, 62);
      [-0.9, -0.3, 0.3, 0.9].forEach(function (a) { leaf(g, 128, 214, 96, 30, a, LEAF); });
    }, function (g) {
      mound(g, 74);
      [-1.0, -0.5, 0, 0.5, 1.0].forEach(function (a) { leaf(g, 128, 186, 118, 34, a, LEAF); });
      turnipBulb(g, 128, 168, 0.95);
    }],
    potato: [cropSeeds, cropSprout, function (g) {
      mound(g, 64);
      puffs(g, [[104, 170, 44], [152, 170, 44], [128, 142, 46], [128, 186, 42]], DARK_LEAF);
    }, function (g) {
      mound(g, 84);
      potato(g, 84, 216, 0.55, 0.3);
      potato(g, 172, 220, 0.5, -0.4);
      puffs(g, [[86, 150, 56], [170, 150, 56], [128, 104, 58], [128, 172, 56]], DARK_LEAF);
      [[96, 110], [150, 92], [172, 138], [106, 160], [138, 150]].forEach(function (p) {
        flower(g, p[0], p[1], 15, '#d9a6ff', '#ffe27a');
      });
    }],
    strawberry: [cropSeeds, cropSprout, function (g) {
      mound(g, 66);
      puffs(g, [[98, 184, 40], [158, 184, 40], [128, 160, 42]], LEAF);
      flower(g, 108, 160, 15, '#ffffff', '#ffe27a');
      flower(g, 152, 176, 15, '#ffffff', '#ffe27a');
    }, function (g) {
      mound(g, 84);
      puffs(g, [[84, 160, 52], [172, 160, 52], [128, 124, 56], [128, 176, 50]], LEAF);
      [[80, 196], [128, 206], [176, 194], [104, 146], [160, 132], [140, 170]].forEach(function (p) {
        strawberry(g, p[0], p[1], 0.36);
      });
      flower(g, 116, 104, 14, '#ffffff', '#ffe27a');
    }],
    tomato: [cropSeeds, cropSprout, function (g) {
      mound(g, 64);
      puffs(g, [[104, 172, 42], [152, 172, 42], [128, 140, 44]], LEAF);
      flower(g, 110, 150, 13, '#ffe27a', '#f2a03d');
      flower(g, 150, 168, 13, '#ffe27a', '#f2a03d');
    }, function (g) {
      mound(g, 80);
      rrect(g, 122, 40, 12, 186, 5);
      paint(g, '#b07a46', 4);
      puffs(g, [[90, 150, 50], [166, 150, 50], [128, 100, 52], [128, 178, 48]], LEAF);
      [[92, 168], [164, 150], [124, 120], [150, 196], [100, 116]].forEach(function (p) { tomato(g, p[0], p[1], 0.36); });
    }],
    corn: [cropSeeds, cropSprout, function (g) {
      mound(g, 60);
      [-0.5, -0.15, 0.2, 0.55].forEach(function (a) { leaf(g, 128, 216, 130, 22, a, LEAF); });
    }, function (g) {
      mound(g, 70);
      rrect(g, 120, 12, 16, 210, 6);
      paint(g, lin(g, 120, 0, 136, 0, [[0, '#8fd85a'], [1, '#4f9a33']]), 4);
      [-0.8, -0.4, 0.4, 0.8].forEach(function (a, i) { leaf(g, 128, 210 - i * 26, 110, 20, a, LEAF); });
      cornCob(g, 158, 118, 0.85, 0.35);
      [[124, 16], [132, 10], [140, 18]].forEach(function (t) {
        g.beginPath();
        g.moveTo(128, 30);
        g.lineTo(t[0], t[1]);
        g.lineWidth = 5;
        g.strokeStyle = '#e0b04a';
        g.stroke();
      });
    }],
    carrot: [cropSeeds, cropSprout, function (g) {
      mound(g, 60);
      [-0.7, -0.35, 0, 0.35, 0.7].forEach(function (a) { leaf(g, 128, 214, 84, 12, a, LEAF); });
    }, function (g) {
      mound(g, 72);
      [-0.8, -0.45, -0.1, 0.25, 0.6, 0.9].forEach(function (a) { leaf(g, 128, 196, 104, 13, a, LEAF); });
      g.beginPath();
      g.moveTo(96, 196);
      g.quadraticCurveTo(128, 180, 160, 196);
      g.quadraticCurveTo(150, 226, 128, 232);
      g.quadraticCurveTo(106, 226, 96, 196);
      paint(g, lin(g, 96, 0, 160, 0, [[0, '#ffb04a'], [1, '#e8741e']]));
    }],
    pumpkin: [cropSeeds, cropSprout, function (g) {
      mound(g, 70);
      [[96, 186, -0.9], [160, 186, 0.9], [128, 176, 0]].forEach(function (l) { leaf(g, l[0], l[1] + 20, 70, 40, l[2], DARK_LEAF); });
      g.beginPath();
      g.moveTo(60, 214);
      g.quadraticCurveTo(128, 180, 200, 214);
      g.lineWidth = 6;
      g.strokeStyle = '#4f9a33';
      g.stroke();
    }, function (g) {
      mound(g, 90);
      [[70, 200, -1.1], [190, 200, 1.1]].forEach(function (l) { leaf(g, l[0], l[1] + 20, 70, 40, l[2], DARK_LEAF); });
      pumpkin(g, 128, 176, 1.0);
    }],
  };

  // ---------- icons (128x128) ----------
  var I = 128;
  function seedPacket(art, band) {
    return function (g) {
      rrect(g, 22, 10, 84, 108, 10);
      paint(g, lin(g, 0, 10, 0, 118, [[0, '#fff6dc'], [1, '#ecd9aa']]), 5);
      g.save();
      g.beginPath();
      g.roundRect(22, 10, 84, 108, 10);
      g.clip();
      g.fillStyle = band;
      g.fillRect(22, 88, 84, 30);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(22, 10, 84, 14);
      g.restore();
      for (var x = 28; x < 104; x += 10) {
        g.beginPath();
        g.moveTo(x, 10);
        g.lineTo(x + 5, 18);
        g.lineTo(x + 10, 10);
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(120,80,40,0.5)';
        g.stroke();
      }
      art(g);
      [[44, 102], [64, 106], [84, 102]].forEach(function (p) {
        ell(g, p[0], p[1], 5, 3.5, 0.4);
        paint(g, '#f3dca8', 2, '#6a4020');
      });
    };
  }

  var ICON_DRAW = {
    hoe: function (g) {
      g.save();
      g.translate(56, 72);
      g.rotate(Math.PI / 4);
      rrect(g, -7, -50, 14, 104, 7);
      paint(g, lin(g, -7, 0, 7, 0, [[0, '#e5ac6d'], [1, '#935a2f']]), 5);
      g.restore();
      g.beginPath();
      g.moveTo(78, 14);
      g.lineTo(120, 30);
      g.quadraticCurveTo(118, 62, 100, 74);
      g.quadraticCurveTo(96, 50, 70, 34);
      g.closePath();
      paint(g, lin(g, 78, 14, 110, 70, [[0, '#f4f7fa'], [0.5, '#b9c1ca'], [1, '#7f8893']]), 5);
      g.beginPath();
      g.moveTo(84, 24);
      g.lineTo(110, 36);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.stroke();
      ell(g, 80, 32, 10, 10);
      paint(g, '#6b737d', 4);
    },
    can: function (g) {
      g.beginPath();
      g.arc(52, 42, 26, Math.PI, 0);
      g.lineWidth = 9;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#3d9cc4';
      g.stroke();
      g.beginPath();
      g.moveTo(80, 76);
      g.lineTo(112, 44);
      g.lineTo(120, 52);
      g.lineTo(88, 92);
      g.closePath();
      paint(g, lin(g, 80, 50, 120, 90, [[0, '#7dd0ee'], [1, '#2e86ad']]), 5);
      ell(g, 116, 46, 10, 14, -0.8);
      paint(g, '#5fb8dc', 5);
      rrect(g, 20, 46, 66, 66, 14);
      paint(g, lin(g, 20, 0, 86, 0, [[0, '#7dd0ee'], [0.6, '#46a7d1'], [1, '#2e86ad']]), 5);
      rrect(g, 30, 54, 12, 40, 6);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
    },
    seed_turnip: seedPacket(function (g) { turnipBulb(g, 64, 54, 0.42); }, '#b04fa6'),
    seed_potato: seedPacket(function (g) { potato(g, 64, 56, 0.48, 0.2); }, '#a27a44'),
    seed_strawberry: seedPacket(function (g) { strawberry(g, 64, 54, 0.44); }, '#e2363e'),
    turnip: function (g) {
      [-0.5, 0, 0.5].forEach(function (a) { leaf(g, 64, 42, 40, 13, a, LEAF); });
      turnipBulb(g, 64, 68, 0.72);
    },
    potato: function (g) { potato(g, 64, 66, 0.92, -0.15); },
    strawberry: function (g) { strawberry(g, 64, 62, 0.82); },
    coin: function (g) {
      ell(g, 64, 64, 52, 52);
      paint(g, rad(g, 48, 44, 4, 64, 64, 54, [[0, '#fff2a0'], [0.6, '#f4c133'], [1, '#c98a12']]), 5);
      ell(g, 64, 64, 38, 38);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(160,100,10,0.7)';
      g.stroke();
      star(g, 64, 64, 22, 10, '#fff6c0');
    },
    bolt: function (g) {
      g.beginPath();
      g.moveTo(76, 8);
      g.lineTo(26, 70);
      g.lineTo(60, 70);
      g.lineTo(46, 120);
      g.lineTo(102, 52);
      g.lineTo(68, 52);
      g.closePath();
      paint(g, lin(g, 26, 8, 102, 120, [[0, '#fff2a0'], [1, '#f2a91e']]), 5);
    },
    bag: function (g) {
      g.beginPath();
      g.arc(64, 38, 22, Math.PI, 0);
      g.lineWidth = 12;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 6;
      g.strokeStyle = '#8a5a30';
      g.stroke();
      rrect(g, 20, 36, 88, 82, 18);
      paint(g, lin(g, 0, 36, 0, 118, [[0, '#cf9257'], [1, '#93582d']]), 5);
      rrect(g, 20, 36, 88, 40, 18);
      paint(g, lin(g, 0, 36, 0, 76, [[0, '#e2a96c'], [1, '#b0703c']]), 5);
      rrect(g, 54, 64, 20, 18, 4);
      paint(g, '#f4c133', 4);
    },
    moon: function (g) {
      g.beginPath();
      g.arc(60, 64, 46, 0.35 * Math.PI, 1.65 * Math.PI);
      g.arc(82, 52, 38, 1.45 * Math.PI, 0.55 * Math.PI, true);
      g.closePath();
      paint(g, lin(g, 14, 20, 100, 110, [[0, '#fff6c0'], [1, '#f2c53d']]), 5);
      star(g, 100, 92, 10, 4, '#fff6c0');
    },
    drop: function (g) {
      g.beginPath();
      g.moveTo(64, 10);
      g.bezierCurveTo(74, 34, 104, 60, 104, 82);
      g.bezierCurveTo(104, 106, 86, 120, 64, 120);
      g.bezierCurveTo(42, 120, 24, 106, 24, 82);
      g.bezierCurveTo(24, 60, 54, 34, 64, 10);
      paint(g, lin(g, 24, 10, 104, 120, [[0, '#9fdcff'], [1, '#2f86d8']]), 5);
      ell(g, 48, 84, 8, 16, 0.3);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fill();
    },
    sparkle: function (g) {
      star(g, 64, 64, 56, 14, '#ffe36a');
      star(g, 64, 64, 30, 8, '#ffffff');
      star(g, 104, 26, 14, 4, '#ffe36a');
    },
    crate: function (g) {
      rrect(g, 14, 40, 100, 74, 8);
      paint(g, lin(g, 0, 40, 0, 114, [[0, '#d39a5c'], [1, '#93592e']]), 5);
      rrect(g, 8, 22, 112, 28, 8);
      paint(g, lin(g, 0, 22, 0, 50, [[0, '#c98447'], [1, '#8c5326']]), 5);
      g.fillStyle = 'rgba(70,35,10,0.4)';
      g.fillRect(18, 74, 92, 4);
      rrect(g, 54, 44, 20, 16, 4);
      paint(g, '#f4c133', 4);
    },
    tag: function (g) {
      g.save();
      g.translate(64, 64);
      g.rotate(-0.5);
      g.beginPath();
      g.moveTo(-50, 0);
      g.lineTo(-22, -32);
      g.lineTo(48, -32);
      g.lineTo(48, 32);
      g.lineTo(-22, 32);
      g.closePath();
      paint(g, lin(g, 0, -32, 0, 32, [[0, '#ffe27a'], [1, '#f2a91e']]), 5);
      ell(g, -24, 0, 8, 8);
      paint(g, '#fff6dc', 4);
      g.font = 'bold 38px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#7a3d1a';
      g.fillText('G', 16, 2);
      g.restore();
    },
  };

  function star(g, x, y, ro, ri, fill) {
    g.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? ri : ro;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    paint(g, fill, 4);
  }

  // ---------- ranch buildings (barn 3x3, coop 2x2) ----------
  function barn() {
    var W = 3 * S, H = 3 * S, c = canvas(W, H), g = c.getContext('2d');
    shadow(g, W / 2, 742, 372, 26, 0.35);
    // walls
    g.beginPath();
    g.rect(44, 300, 680, 432);
    paint(g, lin(g, 0, 300, 0, 732, [[0, '#dc5444'], [1, '#a8342a']]), 8);
    for (var x = 84; x < 724; x += 40) {
      g.fillStyle = 'rgba(90,15,10,0.28)';
      g.fillRect(x, 304, 5, 424);
    }
    // side windows
    [96, 582].forEach(function (wx) {
      rrect(g, wx, 420, 90, 84, 8);
      paint(g, '#fff8ee', 7);
      rrect(g, wx + 12, 432, 66, 60, 4);
      paint(g, lin(g, 0, 432, 0, 492, [[0, '#ffe7a3'], [1, '#c98a3a']]), 3);
    });
    // gambrel roof with white trim
    var roof = function () {
      g.beginPath();
      g.moveTo(10, 330);
      g.lineTo(124, 150);
      g.lineTo(384, 36);
      g.lineTo(644, 150);
      g.lineTo(758, 330);
      g.closePath();
    };
    roof();
    paint(g, lin(g, 0, 36, 0, 330, [[0, '#a8392e'], [1, '#6e231c']]), 0);
    g.save();
    roof();
    g.clip();
    for (var y = 90; y < 330; y += 40) {
      g.fillStyle = 'rgba(40,5,0,0.3)';
      g.fillRect(0, y, W, 5);
    }
    g.restore();
    roof();
    g.lineWidth = 26;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 14;
    g.strokeStyle = '#fff8ee';
    g.stroke();
    // hay loft
    rrect(g, 318, 168, 132, 112, 10);
    paint(g, '#fff8ee', 8);
    rrect(g, 332, 182, 104, 84, 6);
    paint(g, '#4a2a18', 4);
    g.beginPath();
    g.moveTo(336, 266);
    g.quadraticCurveTo(384, 214, 432, 266);
    g.closePath();
    paint(g, lin(g, 0, 220, 0, 266, [[0, '#ffe27a'], [1, '#d9a53a']]), 3);
    // big door with white X braces (block column 1 => x 256..512)
    rrect(g, 262, 476, 244, 256, 6);
    paint(g, '#fff8ee', 8);
    rrect(g, 278, 492, 212, 240, 4);
    paint(g, lin(g, 0, 492, 0, 732, [[0, '#c43e31'], [1, '#922b22']]), 5);
    g.beginPath();
    g.moveTo(384, 492);
    g.lineTo(384, 732);
    g.moveTo(278, 492);
    g.lineTo(384, 612);
    g.lineTo(278, 732);
    g.moveTo(490, 492);
    g.lineTo(384, 612);
    g.lineTo(490, 732);
    g.lineWidth = 14;
    g.strokeStyle = '#fff8ee';
    g.stroke();
    return c;
  }

  function coop() {
    var W = 2 * S, H = 2 * S, c = canvas(W, H), g = c.getContext('2d');
    shadow(g, W / 2, 490, 236, 20, 0.35);
    [92, 196, 316, 420].forEach(function (x) {
      rrect(g, x - 12, 400, 24, 90, 6);
      paint(g, lin(g, x - 12, 0, x + 12, 0, [[0, '#a96d3c'], [1, '#6e4122']]), 6);
    });
    rrect(g, 56, 196, 400, 220, 14);
    paint(g, lin(g, 0, 196, 0, 416, [[0, '#f6cf7d'], [1, '#d9a248']]), 8);
    for (var y = 236; y < 410; y += 36) {
      g.fillStyle = 'rgba(120,70,20,0.3)';
      g.fillRect(60, y, 392, 5);
    }
    g.beginPath();
    g.moveTo(24, 226);
    g.lineTo(256, 64);
    g.lineTo(488, 226);
    g.closePath();
    paint(g, lin(g, 0, 64, 0, 226, [[0, '#ee7563'], [1, '#b9392f']]), 8);
    g.beginPath();
    g.arc(256, 168, 32, 0, Math.PI * 2);
    paint(g, '#4a2a18', 6);
    g.beginPath();
    g.moveTo(232, 184);
    g.quadraticCurveTo(256, 160, 280, 184);
    g.closePath();
    paint(g, '#f2c94c', 3);
    // little arched door + ramp
    g.beginPath();
    g.moveTo(206, 412);
    g.lineTo(206, 330);
    g.arc(256, 330, 50, Math.PI, 0);
    g.lineTo(306, 412);
    g.closePath();
    paint(g, '#5a3420', 7);
    g.beginPath();
    g.moveTo(214, 404);
    g.lineTo(298, 404);
    g.lineTo(326, 500);
    g.lineTo(186, 500);
    g.closePath();
    paint(g, lin(g, 0, 404, 0, 500, [[0, '#d9a066'], [1, '#a66d38']]), 6);
    [432, 456, 480].forEach(function (y) {
      g.fillStyle = 'rgba(70,35,10,0.45)';
      g.fillRect(196 + (y - 432) * -0.2, y, 120 + (y - 432) * 0.55, 5);
    });
    // nest box with an egg
    rrect(g, 352, 268, 84, 64, 8);
    paint(g, '#c98447', 6);
    egg(g, 394, 284, 0.42);
    return c;
  }

  function hay() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 222, 104, 18);
    rrect(g, 26, 82, 204, 138, 34);
    paint(g, lin(g, 0, 82, 0, 220, [[0, '#ffe58a'], [1, '#d9a53a']]), 7);
    var r = rng(111);
    for (var i = 0; i < 26; i++) {
      var x = r.range(40, 216), y = r.range(96, 206);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + r.range(-14, 14), y + r.range(6, 16));
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(160,100,20,0.6)';
      g.stroke();
    }
    [86, 170].forEach(function (x) {
      g.fillStyle = '#a0522d';
      g.fillRect(x, 84, 10, 134);
    });
    return c;
  }

  function trough() {
    var c = canvas(S, S), g = c.getContext('2d');
    shadow(g, 128, 214, 112, 16);
    [44, 196].forEach(function (x) {
      rrect(g, x, 168, 18, 48, 4);
      paint(g, '#7d4a26', 5);
    });
    g.beginPath();
    g.moveTo(20, 110);
    g.lineTo(236, 110);
    g.lineTo(214, 186);
    g.lineTo(42, 186);
    g.closePath();
    paint(g, lin(g, 0, 110, 0, 186, [[0, '#cf9257'], [1, '#93582d']]), 7);
    ell(g, 128, 114, 102, 16);
    paint(g, lin(g, 0, 98, 0, 130, [[0, '#ffe27a'], [1, '#d9a53a']]), 4);
    var r = rng(121);
    for (var i = 0; i < 24; i++) {
      ell(g, r.range(40, 216), r.range(104, 122), 4, 3);
      g.fillStyle = 'rgba(150,90,20,0.7)';
      g.fill();
    }
    return c;
  }

  // ---------- animals (384x320 frames, facing left, feet at y = 300) ----------
  // pose: 0 walk A, 1 walk B, 2 eat (head down), 3 asleep
  function chicken(g, pose) {
    var cx = 192;
    shadow(g, cx + 6, 300, 74, 14);
    g.save();
    if (pose === 3) g.translate(0, 34);
    else {
      [[cx - 14, pose === 1 ? -10 : 6], [cx + 18, pose === 1 ? 8 : -8]].forEach(function (l) {
        g.beginPath();
        g.moveTo(l[0], 256);
        g.lineTo(l[0] + l[1], 296);
        g.lineTo(l[0] + l[1] - 18, 300);
        g.moveTo(l[0] + l[1], 296);
        g.lineTo(l[0] + l[1] + 8, 300);
        g.lineWidth = 9;
        g.strokeStyle = OUT;
        g.stroke();
        g.lineWidth = 5;
        g.strokeStyle = '#f2a03d';
        g.stroke();
      });
    }
    // tail
    [[-0.9, 40], [-0.45, 46], [0, 40]].forEach(function (f) {
      g.save();
      g.translate(cx + 62, 206);
      g.rotate(f[0]);
      ell(g, 18, -f[1] / 2, 18, f[1] / 1.6);
      paint(g, '#f4f0e8', 6);
      g.restore();
    });
    ell(g, cx + 8, 222, 72, 56);
    paint(g, rad(g, cx - 14, 196, 6, cx + 8, 222, 80, [[0, '#ffffff'], [1, '#e2dacb']]));
    var hx = pose === 2 ? cx - 62 : cx - 50, hy = pose === 2 ? 248 : 168;
    if (pose !== 2) {
      g.beginPath();
      g.moveTo(cx - 70, 200);
      g.quadraticCurveTo(cx - 60, 168, hx + 10, hy + 6);
      g.lineTo(cx - 20, 210);
      g.closePath();
      paint(g, '#f8f5ee', 0);
    }
    // comb + wattle
    [[-12, -36, 12], [2, -42, 13], [16, -36, 12]].forEach(function (b) {
      ell(g, hx + b[0], hy + b[1], b[2], b[2] * 1.15);
      paint(g, '#e5383f', 5);
    });
    ell(g, hx, hy, 36, 34);
    paint(g, rad(g, hx - 10, hy - 12, 4, hx, hy, 38, [[0, '#ffffff'], [1, '#e8e1d4']]));
    ell(g, hx - 26, hy + 30, 9, 14);
    paint(g, '#e5383f', 4);
    g.beginPath();
    g.moveTo(hx - 30, hy - 6);
    g.lineTo(hx - 60, hy + 6);
    g.lineTo(hx - 30, hy + 16);
    g.closePath();
    paint(g, '#ffc23d', 5);
    if (pose === 3) {
      g.beginPath();
      g.arc(hx - 8, hy - 2, 9, 0.1 * Math.PI, 0.9 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
    } else {
      ell(g, hx - 8, hy - 4, 7, 9);
      g.fillStyle = OUT;
      g.fill();
      ell(g, hx - 10, hy - 7, 2.5, 3);
      g.fillStyle = '#fff';
      g.fill();
    }
    // wing
    g.save();
    g.translate(cx + 20, 226);
    g.rotate(-0.15);
    ell(g, 0, 0, 44, 28);
    paint(g, lin(g, 0, -28, 0, 28, [[0, '#ffffff'], [1, '#ddd3c2']]), 5);
    [-14, 4, 22].forEach(function (x) {
      g.beginPath();
      g.moveTo(x, 4);
      g.quadraticCurveTo(x + 8, 18, x + 18, 20);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(120,100,80,0.5)';
      g.stroke();
    });
    g.restore();
    g.restore();
  }

  function cow(g, pose) {
    shadow(g, 196, 302, 156, 18);
    var down = pose === 3 ? 56 : 0;
    var swing = pose === 0 ? 0.16 : pose === 1 ? -0.16 : 0;
    var leg = function (x, ang, far) {
      g.save();
      g.translate(x, 236);
      g.rotate(ang);
      rrect(g, -15, -10, 30, 76, 12);
      paint(g, far ? '#e1dbd0' : '#ffffff');
      rrect(g, -16, 52, 32, 18, 6);
      paint(g, '#4a3a30', 5);
      g.restore();
    };
    if (!down) {
      leg(110, -swing, true);
      leg(282, swing, true);
    }
    g.save();
    g.translate(0, down);
    // tail
    g.beginPath();
    g.moveTo(324, 162);
    g.quadraticCurveTo(354, 196, 344, 244);
    g.lineWidth = 12;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 6;
    g.strokeStyle = '#f4efe6';
    g.stroke();
    ell(g, 344, 252, 12, 18);
    paint(g, '#4a3a30', 5);
    // body with patches
    rrect(g, 70, 136, 266, 122, 60);
    paint(g, lin(g, 0, 136, 0, 258, [[0, '#ffffff'], [1, '#e4ddd1']]));
    g.save();
    rrect(g, 73, 139, 260, 116, 58);
    g.clip();
    [[166, 168, 50, 36, 0.2], [282, 206, 44, 34, -0.3], [118, 236, 36, 22, 0.1], [236, 146, 30, 20, 0]].forEach(function (p) {
      ell(g, p[0], p[1], p[2], p[3], p[4]);
      g.fillStyle = '#2f2a28';
      g.fill();
    });
    g.restore();
    rrect(g, 70, 136, 266, 122, 60);
    g.lineWidth = LW;
    g.strokeStyle = OUT;
    g.stroke();
    if (!down) {
      ell(g, 262, 256, 28, 14);
      paint(g, '#f7b7b0', 5);
    }
    g.restore();
    if (!down) {
      leg(138, swing, false);
      leg(306, -swing, false);
    }
    // head
    var hx = 66, hy = (pose === 2 ? 232 : 150) + down * 0.7;
    ell(g, hx + 30, hy - 40, 26, 12, -0.5);
    paint(g, '#ffffff', 5);
    [[hx - 10, hy - 44], [hx + 18, hy - 50]].forEach(function (h) {
      g.beginPath();
      g.moveTo(h[0] - 6, h[1] + 8);
      g.quadraticCurveTo(h[0] - 4, h[1] - 14, h[0] + 8, h[1] - 18);
      g.quadraticCurveTo(h[0] + 4, h[1] - 4, h[0] + 8, h[1] + 8);
      g.closePath();
      paint(g, '#fff1cf', 4);
    });
    ell(g, hx, hy, 50, 46);
    paint(g, rad(g, hx - 14, hy - 16, 4, hx, hy, 54, [[0, '#ffffff'], [1, '#e4ddd1']]));
    ell(g, hx + 14, hy - 18, 22, 18, 0.4);
    g.fillStyle = '#2f2a28';
    g.fill();
    ell(g, hx - 22, hy + 24, 36, 24);
    paint(g, rad(g, hx - 30, hy + 16, 2, hx - 22, hy + 24, 36, [[0, '#ffd2cc'], [1, '#f0a39a']]));
    [[hx - 36, hy + 22], [hx - 12, hy + 24]].forEach(function (n) {
      ell(g, n[0], n[1], 5, 7);
      g.fillStyle = '#9a4f48';
      g.fill();
    });
    if (pose === 3) {
      g.beginPath();
      g.arc(hx - 12, hy - 8, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
    } else {
      ell(g, hx - 12, hy - 10, 8, 10);
      g.fillStyle = OUT;
      g.fill();
      ell(g, hx - 14, hy - 13, 3, 3.5);
      g.fillStyle = '#fff';
      g.fill();
    }
    // bell
    ell(g, hx + 48, hy + 44, 16, 15);
    paint(g, rad(g, hx + 43, hy + 38, 2, hx + 48, hy + 44, 16, [[0, '#fff3a0'], [1, '#d4a01e']]), 5);
  }

  function egg(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, -46);
    g.bezierCurveTo(30, -46, 40, 10, 38, 22);
    g.bezierCurveTo(36, 44, 18, 52, 0, 52);
    g.bezierCurveTo(-18, 52, -36, 44, -38, 22);
    g.bezierCurveTo(-40, 10, -30, -46, 0, -46);
    paint(g, rad(g, -12, -16, 4, 0, 4, 56, [[0, '#ffffff'], [0.6, '#fbf2e2'], [1, '#e7d6b8']]));
    ell(g, -14, -18, 8, 14, -0.3);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();
    g.restore();
  }

  Object.assign(ICON_DRAW, {
    seed_tomato: seedPacket(function (g) { tomato(g, 64, 56, 0.5); }, '#e2363e'),
    seed_corn: seedPacket(function (g) { cornCob(g, 64, 54, 0.6, 0.4); }, '#e0a52a'),
    seed_carrot: seedPacket(function (g) { g.save(); g.translate(64, 56); g.scale(1.1, 1.1); carrot(g, 0, 0); g.restore(); }, '#e8741e'),
    seed_pumpkin: seedPacket(function (g) { pumpkin(g, 64, 58, 0.45); }, '#c45d0e'),
    tomato: function (g) { tomato(g, 64, 66, 1.05); },
    corn: function (g) { cornCob(g, 64, 66, 0.95, 0.5); },
    carrot: function (g) { g.save(); g.translate(60, 70); g.rotate(0.6); g.scale(1.55, 1.55); carrot(g, 0, 0); g.restore(); },
    pumpkin: function (g) { pumpkin(g, 64, 70, 0.95); },
    spring: function (g) {
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5 - Math.PI / 2;
        ell(g, 64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 22, 17, a);
        paint(g, lin(g, 0, 20, 0, 108, [[0, '#ffd6e8'], [1, '#ff8ab5']]), 5);
      }
      ell(g, 64, 64, 14, 14);
      paint(g, '#ffe27a', 4);
    },
    summer: function (g) {
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        g.beginPath();
        g.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34);
        g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
        g.lineWidth = 14;
        g.strokeStyle = OUT;
        g.stroke();
        g.lineWidth = 7;
        g.strokeStyle = '#ffc23d';
        g.stroke();
      }
      ell(g, 64, 64, 30, 30);
      paint(g, rad(g, 54, 54, 4, 64, 64, 32, [[0, '#fff3a0'], [1, '#f2a91e']]), 5);
    },
    fall: function (g) {
      g.save();
      g.translate(64, 64);
      g.rotate(-0.6);
      g.beginPath();
      g.moveTo(0, -54);
      g.bezierCurveTo(40, -30, 40, 30, 0, 50);
      g.bezierCurveTo(-40, 30, -40, -30, 0, -54);
      paint(g, lin(g, 0, -54, 0, 50, [[0, '#ffc36a'], [1, '#d9532a']]), 5);
      g.beginPath();
      g.moveTo(0, -44);
      g.lineTo(0, 62);
      g.lineWidth = 5;
      g.strokeStyle = '#7a3a1a';
      g.stroke();
      g.restore();
    },
    winter: function (g) {
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        var ex = 64 + Math.cos(a) * 52, ey = 64 + Math.sin(a) * 52;
        [[12, OUT], [6, '#bfe6ff']].forEach(function (st) {
          g.beginPath();
          g.moveTo(64, 64);
          g.lineTo(ex, ey);
          var bx = 64 + Math.cos(a) * 32, by = 64 + Math.sin(a) * 32;
          g.moveTo(bx, by);
          g.lineTo(bx + Math.cos(a + 0.8) * 16, by + Math.sin(a + 0.8) * 16);
          g.moveTo(bx, by);
          g.lineTo(bx + Math.cos(a - 0.8) * 16, by + Math.sin(a - 0.8) * 16);
          g.lineWidth = st[0];
          g.strokeStyle = st[1];
          g.stroke();
        });
      }
    },
    egg: function (g) { egg(g, 64, 66, 1.0); },
    milk: function (g) {
      rrect(g, 46, 12, 36, 18, 6);
      paint(g, '#4aa3e8', 5);
      g.beginPath();
      g.moveTo(48, 30);
      g.lineTo(80, 30);
      g.lineTo(80, 44);
      g.quadraticCurveTo(100, 56, 100, 76);
      g.lineTo(100, 108);
      g.quadraticCurveTo(100, 118, 90, 118);
      g.lineTo(38, 118);
      g.quadraticCurveTo(28, 118, 28, 108);
      g.lineTo(28, 76);
      g.quadraticCurveTo(28, 56, 48, 44);
      g.closePath();
      paint(g, lin(g, 28, 0, 100, 0, [[0, '#ffffff'], [1, '#e6edf2']]));
      rrect(g, 34, 70, 60, 34, 6);
      paint(g, '#4aa3e8', 4);
      g.font = 'bold 22px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText('MILK', 64, 88);
      rrect(g, 36, 48, 10, 18, 5);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
    },
    chicken_feed: function (g) {
      g.beginPath();
      g.moveTo(30, 34);
      g.quadraticCurveTo(64, 20, 98, 34);
      g.lineTo(108, 112);
      g.quadraticCurveTo(64, 124, 20, 112);
      g.closePath();
      paint(g, lin(g, 0, 30, 0, 120, [[0, '#f3e3bf'], [1, '#d6bf8e']]));
      ell(g, 64, 32, 34, 10);
      paint(g, lin(g, 0, 22, 0, 42, [[0, '#ffe27a'], [1, '#d9a53a']]), 4);
      rrect(g, 36, 60, 56, 40, 8);
      paint(g, '#5fa84a', 4);
      g.save();
      g.translate(-10, -30);
      g.scale(0.4, 0.4);
      chicken(g, 0);
      g.restore();
    },
    fodder: function (g) {
      g.save();
      g.translate(64, 70);
      g.scale(0.5, 0.5);
      g.translate(-128, -150);
      var h = hay();
      g.drawImage(h, 0, 0);
      g.restore();
      [[40, 30], [64, 20], [88, 30]].forEach(function (p) {
        g.beginPath();
        g.moveTo(p[0], p[1] + 26);
        g.quadraticCurveTo(p[0] - 6, p[1] + 10, p[0] + 4, p[1]);
        g.lineWidth = 6;
        g.strokeStyle = '#d9a53a';
        g.stroke();
      });
    },
    heart: function (g) {
      g.beginPath();
      g.moveTo(64, 112);
      g.bezierCurveTo(20, 80, 10, 52, 22, 34);
      g.bezierCurveTo(36, 14, 60, 20, 64, 40);
      g.bezierCurveTo(68, 20, 92, 14, 106, 34);
      g.bezierCurveTo(118, 52, 108, 80, 64, 112);
      paint(g, lin(g, 0, 14, 0, 112, [[0, '#ff8a9a'], [1, '#e0304a']]));
      ell(g, 40, 42, 10, 7, -0.6);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fill();
    },
    chicken: function (g) {
      g.save();
      g.translate(-30, -40);
      g.scale(0.5, 0.5);
      chicken(g, 0);
      g.restore();
    },
    cow: function (g) {
      g.save();
      g.translate(-2, -24);
      g.scale(0.34, 0.34);
      cow(g, 0);
      g.restore();
    },
    bubble: function (g) {
      rrect(g, 10, 6, 108, 96, 30);
      paint(g, '#ffffff', 6);
      g.beginPath();
      g.moveTo(52, 98);
      g.lineTo(64, 122);
      g.lineTo(76, 98);
      g.closePath();
      paint(g, '#ffffff', 0);
      g.beginPath();
      g.moveTo(52, 100);
      g.lineTo(64, 122);
      g.lineTo(76, 100);
      g.lineWidth = 6;
      g.strokeStyle = OUT;
      g.stroke();
    },
  });

  // ---------- sheet assembly ----------
  // keyOf(col, row): the key of an imported picture that replaces that frame (see tools/art/import.js)
  function frameSheet(cols, rows, fw, fh, w, h, draw, keyOf) {
    var c = canvas(w, h), g = c.getContext('2d'), O = window.ART.OVR || {};
    for (var r = 0; r < rows; r++) {
      for (var k = 0; k < cols; k++) {
        var f = canvas(fw, fh), key = keyOf && keyOf(k, r);
        if (key && O[key]) f.getContext('2d').drawImage(O[key], 0, 0, fw, fh);
        else if (draw(f.getContext('2d'), k, r) === false) continue;
        g.drawImage(f, 8 + k * (fw + 16), 8 + r * (fh + 16));
      }
    }
    return c;
  }

  // A padded tileset sheet; place() copies a 256x256 tile into its cell and extrudes its edges.
  function tileSheet(L) {
    var sheet = canvas(L.IMAGE_W, L.IMAGE_H), sg = sheet.getContext('2d');
    sg.imageSmoothingEnabled = false;
    var names = {};
    Object.keys(L.T).forEach(function (n) { names[L.T[n]] = n; });
    // An imported picture replaces a tile: tiles:<name>, season:<kind>:<season> (the tiles sheet holds the
    // spring look), or tree:<season> for the four quarters of a tree.
    var override = function (id) {
      var O = window.ART.OVR || {}, name = names[id];
      if (!name) return null;
      var m = /^(spring|summer|fall|winter)_(\w+)$/.exec(name), season = m ? m[1] : 'spring', kind = m ? m[2] : name;
      var tq = /^tree(TL|TR|BL|BR)$/.exec(kind);
      if (tq && O['tree:' + season]) return { src: O['tree:' + season], sx: tq[1][1] === 'R' ? S : 0, sy: tq[1][0] === 'B' ? S : 0 };
      var key = m ? 'season:' + kind + ':' + season : L.NAME + ':' + name;
      if (O[key]) return { src: O[key], sx: 0, sy: 0 };
      if (!m && L.NAME === 'tiles' && O['season:' + name + ':spring']) return { src: O['season:' + name + ':spring'], sx: 0, sy: 0 };
      return null;
    };
    var place = function (id, src, sx, sy) {
      var o = override(id);
      if (o) { src = o.src; sx = o.sx; sy = o.sy; }
      var x = L.MARGIN + (id % L.COLS) * (S + L.SPACING), y = L.MARGIN + Math.floor(id / L.COLS) * (S + L.SPACING);
      var P = L.SPACING / 2;
      sg.drawImage(src, sx, sy, S, S, x, y, S, S);
      sg.drawImage(src, sx, sy, S, 1, x, y - P, S, P);
      sg.drawImage(src, sx, sy + S - 1, S, 1, x, y + S, S, P);
      sg.drawImage(src, sx, sy, 1, S, x - P, y, P, S);
      sg.drawImage(src, sx + S - 1, sy, 1, S, x + S, y, P, S);
      sg.drawImage(src, sx, sy, 1, 1, x - P, y - P, P, P);
      sg.drawImage(src, sx + S - 1, sy, 1, 1, x + S, y - P, P, P);
      sg.drawImage(src, sx, sy + S - 1, 1, 1, x - P, y + S, P, P);
      sg.drawImage(src, sx + S - 1, sy + S - 1, 1, 1, x + S, y + S, P, P);
    };
    var placeBlock = function (name, pic) {
      var B = L.BLOCKS[name], O = window.ART.OVR || {};
      if (O[L.NAME + ':' + name]) pic = O[L.NAME + ':' + name];
      for (var dy = 0; dy < B.h; dy++) for (var dx = 0; dx < B.w; dx++) {
        place((B.row + dy) * L.COLS + B.col + dx, pic, dx * S, dy * S);
      }
    };
    return { canvas: sheet, place: place, placeBlock: placeBlock };
  }

  // Helpers shared with the other art files (tools/art/*.js), which add icons, tiles, props and people.
  window.ART = {
    S: S, OUT: OUT, LW: LW, rng: rng, canvas: canvas, lin: lin, rad: rad, rrect: rrect, ell: ell, paint: paint,
    shadow: shadow, wrap: wrap, puffs: puffs, leaf: leaf, flower: flower, star: star, eyes: eyes, LEAF: LEAF, DARK_LEAF: DARK_LEAF,
    WOOD: WOOD, turnipBulb: turnipBulb, potato: potato, strawberry: strawberry, tomato: tomato, cornCob: cornCob,
    pumpkin: pumpkin, carrot: carrot, egg: egg, chicken: chicken, cow: cow, mound: mound, grassTile: grassTile,
    ICON_DRAW: ICON_DRAW, CROP_DRAW: CROP_DRAW, TILE_DRAW: {}, frameSheet: frameSheet, tileSheet: tileSheet,
    SKIN: SKIN, CAP: CAP, SHIRT: SHIRT, DENIM: DENIM, BOOT: BOOT,
  };

  window.makeArt = function (sets) {
    var main = tileSheet(sets.TILES), T = sets.TILES.T, place = main.place;
    // the main tileset holds the spring look; the seasons tileset holds every season's version
    var seasonal = function (kind, ss) {
      if (kind === 'grass') return grassTile(1, 0, ss);
      if (kind === 'grass2') return grassTile(2, 70, ss);
      if (kind === 'grass3' || kind === 'flowers') return flowerTile(kind, ss);
      if (kind === 'field') return fieldTile(ss);
      if (kind === 'path') return pathTile(ss);
      if (kind === 'bush') return bush(ss);
      if (kind === 'tallgrass') return tallgrass(ss);
      throw new Error('no seasonal art for ' + kind);
    };
    ['grass', 'grass2', 'grass3', 'flowers'].forEach(function (k) { place(T[k], seasonal(k, 0), 0, 0); });
    place(T.field, fieldTile(0), 0, 0);
    place(T.tilled, tilledTile(false), 0, 0);
    place(T.tilledWet, tilledTile(true), 0, 0);
    place(T.path, pathTile(0), 0, 0);
    place(T.water, waterTile(), 0, 0);
    place(T.fenceH, fenceH(), 0, 0);
    place(T.fenceV, fenceV(), 0, 0);
    place(T.fencePost, fencePostTile(), 0, 0);
    var t = tree(0);
    place(T.treeTL, t, 0, 0);
    place(T.treeTR, t, S, 0);
    place(T.treeBL, t, 0, S);
    place(T.treeBR, t, S, S);
    place(T.bush, bush(0), 0, 0);
    place(T.rock, rock(), 0, 0);
    place(T.stump, stump(), 0, 0);
    place(T.tallgrass, tallgrass(0), 0, 0);
    place(T.shipbox, shipbox(), 0, 0);
    place(T.sign, sign(), 0, 0);
    Object.keys(window.ART.TILE_DRAW).forEach(function (name) {
      if (T[name] !== undefined) place(T[name], window.ART.TILE_DRAW[name](), 0, 0);
    });
    main.placeBlock('house', house());
    main.placeBlock('shop', shop());
    main.placeBlock('pond', pond(null)); // transparent corners: the seasonal grass shows through

    var seasons = tileSheet(sets.SEASONS);
    sets.SEASON_NAMES.forEach(function (season, ss) {
      var trees = tree(ss), parts = { treeTL: [0, 0], treeTR: [S, 0], treeBL: [0, S], treeBR: [S, S] };
      sets.SEASONAL.forEach(function (kind) {
        var id = sets.SEASONS.T[season + '_' + kind];
        if (parts[kind]) seasons.place(id, trees, parts[kind][0], parts[kind][1]);
        else seasons.place(id, seasonal(kind, ss), 0, 0);
      });
    });

    var ranch = tileSheet(sets.RANCH);
    ranch.placeBlock('barn', barn());
    ranch.placeBlock('coop', coop());
    ranch.place(sets.RANCH.T.hay, hay(), 0, 0);
    ranch.place(sets.RANCH.T.trough, trough(), 0, 0);

    // player: 3 directions x 3 steps of 256x384; crops: 3 crops x 4 stages; icons: 8x3 of 128;
    // animals: one row per animal, 4 poses of 384x320 (the 2048-wide sheet has room for 5 per row)
    var dirs = ['down', 'up', 'side'];
    // rows 0-2: walking (down, up, side x stand, step A, step B); rows 3-4: tool poses
    // (down raise, down strike, up raise / up strike, side raise, side strike)
    var player = frameSheet(3, 5, 256, 384, 1024, 2048, function (g, col, row) {
      if (row < 3) return farmer(g, dirs[row], col);
      var k = (row - 3) * 3 + col;
      farmer(g, ['down', 'down', 'up', 'up', 'side', 'side'][k], 0, k % 2 ? 'strike' : 'raise');
    }, function (col, row) { return 'player:' + (row * 3 + col); });
    // crops: frame 0 seeds and 1 sprout are shared; then each crop has a growing and a ripe frame
    var cropKeys = sets.CROP_KEYS;
    var crops = frameSheet(3, 6, 256, 256, 1024, 2048, function (g, col, row) {
      var f = row * 3 + col;
      if (f < 2) return CROP_DRAW.turnip[f](g);
      var crop = cropKeys[Math.floor((f - 2) / 2)];
      if (!crop) return false;
      CROP_DRAW[crop][2 + (f - 2) % 2](g);
    }, function (col, row) { return 'crops:' + (row * 3 + col); });
    var iconNames = sets.ICON_ORDER;
    var iconRows = Math.ceil(iconNames.length / 8);
    var items = frameSheet(8, iconRows, I, I, 8 + 8 * (I + 16) - 8, 8 + iconRows * (I + 16) - 8, function (g, k, r) {
      var name = iconNames[r * 8 + k];
      if (!name) return false;
      if (!ICON_DRAW[name]) throw new Error('no icon art for ' + name);
      ICON_DRAW[name](g);
    }, function (k, r) { return iconNames[r * 8 + k] ? 'icon:' + iconNames[r * 8 + k] : null; });
    // one row per animal: chicken, cow, dog, horse, cat
    var animals = frameSheet(4, 5, 384, 320, 2048, 2048, function (g, pose, row) {
      if (row === 0) chicken(g, pose);
      else if (row === 1) cow(g, pose);
      else if (row === 2) window.ART.dog(g, pose);
      else if (row === 3) window.ART.horse(g, pose);
      else window.ART.cat(g, pose);
    }, function (pose, row) { return 'animals:' + row + ':' + pose; });
    // the farmer girl: her own pictures, or the farmer boy recoloured
    var playerGirl = frameSheet(3, 5, 256, 384, 1024, 2048, function (g, col, row) {
      g.filter = window.ART.girlFilter;
      g.drawImage(player, 8 + col * 272, 8 + row * 400, 256, 384, 0, 0, 256, 384);
    }, function (col, row) { return 'player_girl:' + (row * 3 + col); });
    // more animals, 4 poses a row: pig, carabao
    var animals2 = frameSheet(4, 2, 384, 320, 1600, 672, function (g, pose, row) {
      if (row === 0) window.ART.pig(g, pose);
      else window.ART.carabao(g, pose);
    }, function (pose, row) { return 'animals2:' + row + ':' + pose; });
    // PNG for editing (Tiled) and a WebP copy, about 6x smaller, that the build inlines.
    var sheets = { tiles: main.canvas, ranch: ranch.canvas, seasons: seasons.canvas, player: player, player_girl: playerGirl, crops: crops, items: items, animals: animals, animals2: animals2 };
    var extra = window.ART.extra(sets); // indoor tiles, villagers, and the prop images (furniture, town buildings)
    Object.keys(extra.sheets).forEach(function (k) { sheets[k] = extra.sheets[k]; });
    var out = {};
    var encode = function (c) { return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.92) }; };
    Object.keys(sheets).forEach(function (k) { out[k] = encode(sheets[k]); });
    Object.keys(extra.props).forEach(function (k) { out['props/' + k] = encode(extra.props[k]); });
    return out;
  };
})();
