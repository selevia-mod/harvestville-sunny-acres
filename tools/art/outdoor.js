// The 'yard' sheet: drawn stand-ins for the outdoor decorations that don't reuse a town prop (fences in three
// shapes each, paths, hedges, garden and yard pieces). Generated pictures in art-src/ replace them (overrides
// 'yard:<key>' and 'yard:<key>:<h|v|p>'). The layout is shared with the game: see A.yardFrames.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var U = 128, CELL = 3 * U, GAP = 16, COLS = 6;
  var grad = function (g, y0, y1, a, b) { return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]); };

  // the frames in sheet order: [name, type, w, h] (fences have three shapes)
  A.yardFrames = function (types) {
    var out = [];
    types.forEach(function (t) {
      if (t.prop) return;
      if (t.kind === 'fence') ['h', 'v', 'p'].forEach(function (sh) { out.push([t.key + ':' + sh, t, 1, 1]); });
      else out.push([t.key, t, t.w, t.h]);
    });
    return out;
  };

  // ---------- fences ----------
  var FENCE = {
    wood_fence: { post: ['#c98b4f', '#8a5a30'], rail: ['#d6a36a', '#9a6a3a'] },
    picket_fence: { post: ['#ffffff', '#d8dde2'], rail: ['#ffffff', '#d8dde2'], picket: true },
    stone_wall: { stone: true },
    iron_fence: { post: ['#3a3a44', '#1a1a22'], rail: ['#3a3a44', '#1a1a22'], gold: true },
  };
  function fence(g, key, shape) {
    var f = FENCE[key];
    if (f.stone) {
      var stones = shape === 'h' ? [[10, 70, 40], [46, 64, 44], [86, 70, 40], [118, 66, 30]] : shape === 'v' ? [[40, 30, 40], [72, 56, 42], [44, 90, 44]] : [[44, 60, 40], [84, 66, 36], [62, 88, 40]];
      stones.forEach(function (st) {
        ell(g, st[0], st[1], st[2] / 2 + 6, st[2] / 2);
        paint(g, grad(g, st[1] - 24, st[1] + 24, '#c8c4bc', '#8a867e'), 3);
      });
      return;
    }
    var post = function (x) {
      rrect(g, x - 9, 34, 18, 82, 5);
      paint(g, lin(g, x - 9, 0, x + 9, 0, [[0, f.post[0]], [1, f.post[1]]]), 3);
      if (f.gold) { ell(g, x, 30, 7, 9); paint(g, '#f2c13a', 2); }
      if (f.picket) { g.beginPath(); g.moveTo(x - 9, 34); g.lineTo(x, 22); g.lineTo(x + 9, 34); g.closePath(); paint(g, f.post[0], 3); }
    };
    if (shape === 'h') {
      [56, 86].forEach(function (y) { rrect(g, 0, y, U, 12, 4); paint(g, grad(g, y, y + 12, f.rail[0], f.rail[1]), 3); });
      if (f.picket) [20, 52, 84, 116].forEach(post);
      else [64].forEach(post);
    } else if (shape === 'v') {
      [48, 80].forEach(function (x) { rrect(g, x - 6, 0, 12, U, 4); paint(g, lin(g, x - 6, 0, x + 6, 0, [[0, f.rail[0]], [1, f.rail[1]]]), 3); });
      rrect(g, 46, 40, 36, 60, 6);
      paint(g, grad(g, 40, 100, f.post[0], f.post[1]), 3);
    } else post(64);
  }

  // ---------- paths and hedges ----------
  function path(g, key) {
    var r = A.rng(key.length * 31);
    if (key === 'wood_deck') {
      for (var i = 0; i < 4; i++) {
        g.fillStyle = grad(g, i * 32, i * 32 + 32, '#d6a36a', '#a8723f');
        g.fillRect(0, i * 32, U, 32);
        g.fillStyle = 'rgba(70,40,15,0.5)';
        g.fillRect(0, i * 32 + 30, U, 2);
      }
      return;
    }
    if (key === 'gravel_path') {
      g.fillStyle = '#e2d2b0';
      g.fillRect(0, 0, U, U);
      for (var k = 0; k < 90; k++) { ell(g, r.range(0, U), r.range(0, U), r.range(2, 5), r.range(2, 4)); g.fillStyle = r() < 0.5 ? '#b8a88a' : '#f6ecd6'; g.fill(); }
      return;
    }
    var brick = key === 'brick_path';
    g.fillStyle = brick ? '#8a3a2a' : '#8a8a86';
    g.fillRect(0, 0, U, U);
    for (var y = 0; y < 4; y++) {
      for (var x = -1; x < 4; x++) {
        var px = x * 32 + (y % 2) * 16, py = y * 32;
        rrect(g, px + 2, py + 2, brick ? 28 : 28, 28, brick ? 3 : 8);
        g.fillStyle = brick ? r.pick(['#c8583a', '#b84a30', '#d46a48']) : r.pick(['#d2d0c8', '#c4c2ba', '#dedcd4']);
        g.fill();
      }
    }
  }
  function hedge(g, flowers) {
    rrect(g, 6, 22, U - 12, U - 28, 26);
    paint(g, grad(g, 22, U, '#6cbf57', '#2f7a2a'), 4);
    var r = A.rng(flowers ? 9 : 7);
    for (var i = 0; i < 14; i++) { ell(g, r.range(16, U - 16), r.range(30, U - 20), 9, 7); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill(); }
    if (flowers) for (var k = 0; k < 7; k++) A.flower(g, r.range(20, U - 20), r.range(34, U - 24), 8, '#ff8ab0', '#ffe27a');
  }

  // ---------- garden and yard pieces (drawn at 128 per tile) ----------
  var D = {
    planter: function (g, W, H) {
      rrect(g, 14, 62, W - 28, 54, 8);
      paint(g, grad(g, 62, 116, '#d4744a', '#9a4a2a'), 4);
      for (var i = 0; i < 4; i++) A.flower(g, 30 + i * 22, 50 + (i % 2) * 8, 13, '#e5484d', '#ffe27a');
    },
    rose_bush: function (g, W, H) {
      ell(g, W / 2, H - 46, 52, 40);
      paint(g, grad(g, H - 86, H - 6, '#5aa84a', '#2f6a2a'), 4);
      var r = A.rng(3);
      for (var i = 0; i < 7; i++) A.flower(g, r.range(24, W - 24), r.range(H - 82, H - 26), 10, '#e5304d', '#ff8a9a');
    },
    sunflowers: function (g, W, H) {
      [[34, 70], [64, 40], [94, 78]].forEach(function (f) {
        rrect(g, f[0] - 4, f[1], 8, H - f[1] - 8, 3);
        paint(g, '#4a8a3a', 2);
        for (var k = 0; k < 10; k++) {
          var a = k / 10 * Math.PI * 2;
          ell(g, f[0] + Math.cos(a) * 18, f[1] + Math.sin(a) * 18, 10, 6, a);
          paint(g, '#ffd23a', 2);
        }
        ell(g, f[0], f[1], 12, 12);
        paint(g, '#6a3a1a', 2);
      });
    },
    apple_tree: tree('#4aa83a', '#2a7a2a', '#e5304d'),
    cherry_tree: tree('#ffb0c8', '#e07a9a', '#ffffff'),
    garden_pond: function (g, W, H) {
      ell(g, W / 2, H / 2 + 10, W / 2 - 10, H / 2 - 18);
      paint(g, '#9a9690', 6);
      ell(g, W / 2, H / 2 + 10, W / 2 - 30, H / 2 - 36);
      paint(g, grad(g, 40, H - 30, '#7cc8f0', '#3a88c8'), 3);
      [[110, 120], [250, 140], [190, 100]].forEach(function (p) { ell(g, p[0], p[1], 20, 12); paint(g, '#5aa84a', 2); });
      A.flower(g, 250, 132, 9, '#ffffff', '#ffe27a');
    },
    birdbath: function (g, W, H) {
      rrect(g, W / 2 - 14, 90, 28, H - 110, 6);
      paint(g, grad(g, 90, H, '#d8d4cc', '#9a968e'), 3);
      rrect(g, 30, H - 30, W - 60, 20, 6);
      paint(g, '#a8a49c', 3);
      ell(g, W / 2, 86, 50, 18);
      paint(g, '#c8c4bc', 4);
      ell(g, W / 2, 82, 38, 10);
      g.fillStyle = '#7cc8f0';
      g.fill();
      ell(g, W / 2 + 22, 62, 14, 11);
      paint(g, '#4a90e0', 3);
    },
    scarecrow: function (g, W, H) {
      rrect(g, W / 2 - 5, 70, 10, H - 80, 3);
      paint(g, '#8a5a30', 2);
      rrect(g, 14, 96, W - 28, 12, 4);
      paint(g, '#8a5a30', 2);
      rrect(g, W / 2 - 28, 88, 56, 70, 12);
      paint(g, grad(g, 88, 158, '#e5604d', '#a83a2a'), 3);
      ell(g, W / 2, 66, 26, 26);
      paint(g, '#f2d8a0', 3);
      ell(g, W / 2, 46, 48, 12);
      paint(g, '#e8c060', 3);
      rrect(g, W / 2 - 22, 18, 44, 30, 10);
      paint(g, '#e8c060', 3);
    },
    picnic_table: function (g, W, H) {
      rrect(g, 20, 100, W - 40, 36, 8);
      paint(g, grad(g, 100, 136, '#ffffff', '#e2d6d6'), 4);
      for (var x = 20; x < W - 20; x += 24) { g.fillStyle = 'rgba(229,72,77,0.8)'; g.fillRect(x, 100, 12, 36); }
      [40, W - 52].forEach(function (x) { rrect(g, x, 136, 12, 70, 3); paint(g, '#8a5a30', 2); });
      [[20, 200], [20, 60]].forEach(function (b) { rrect(g, b[0], b[1], W - 40, 16, 5); paint(g, '#a8743f', 3); });
      rrect(g, W / 2 - 26, 70, 52, 34, 8);
      paint(g, '#c8903a', 3);
    },
    swing: function (g, W, H) {
      g.lineCap = 'round';
      g.lineWidth = 12;
      g.strokeStyle = '#8a5a30';
      g.beginPath();
      g.moveTo(20, H - 10);
      g.lineTo(60, 30);
      g.lineTo(W - 60, 30);
      g.lineTo(W - 20, H - 10);
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#6a6e76';
      [90, W - 90].forEach(function (x) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 140); g.stroke(); });
      rrect(g, 70, 130, W - 140, 40, 10);
      paint(g, grad(g, 130, 170, '#4a90e0', '#2f6ab8'), 3);
    },
    birdhouse: function (g, W, H) {
      rrect(g, W / 2 - 5, 90, 10, H - 98, 3);
      paint(g, '#8a5a30', 2);
      rrect(g, W / 2 - 34, 40, 68, 60, 6);
      paint(g, grad(g, 40, 100, '#ffd84d', '#e0a01e'), 3);
      g.beginPath();
      g.moveTo(W / 2 - 44, 46);
      g.lineTo(W / 2, 10);
      g.lineTo(W / 2 + 44, 46);
      g.closePath();
      paint(g, '#c8302a', 3);
      ell(g, W / 2, 68, 10, 10);
      g.fillStyle = '#3a2412';
      g.fill();
    },
    well: function (g, W, H) {
      ell(g, W / 2, H - 60, W / 2 - 20, 44);
      paint(g, grad(g, H - 104, H - 16, '#b8b4ac', '#7a766e'), 5);
      ell(g, W / 2, H - 80, W / 2 - 40, 24);
      g.fillStyle = '#2a3a4a';
      g.fill();
      [40, W - 52].forEach(function (x) { rrect(g, x, 40, 12, H - 120, 4); paint(g, '#8a5a30', 3); });
      g.beginPath();
      g.moveTo(14, 52);
      g.lineTo(W / 2, 6);
      g.lineTo(W - 14, 52);
      g.closePath();
      paint(g, '#c8302a', 4);
      rrect(g, W / 2 - 14, 80, 28, 30, 4);
      paint(g, '#a8743f', 3);
    },
    windmill: function (g, W, H) {
      g.beginPath();
      g.moveTo(W / 2 - 54, H - 10);
      g.lineTo(W / 2 - 32, 120);
      g.lineTo(W / 2 + 32, 120);
      g.lineTo(W / 2 + 54, H - 10);
      g.closePath();
      paint(g, grad(g, 120, H, '#f2e2c4', '#c8b08a'), 4);
      g.beginPath();
      g.moveTo(W / 2 - 40, 126);
      g.lineTo(W / 2, 84);
      g.lineTo(W / 2 + 40, 126);
      g.closePath();
      paint(g, '#c8302a', 4);
      g.save();
      g.translate(W / 2, 120);
      for (var k = 0; k < 4; k++) {
        g.rotate(Math.PI / 2);
        rrect(g, -12, -110, 24, 96, 4);
        paint(g, '#ffffff', 3);
      }
      g.restore();
      ell(g, W / 2, 120, 10, 10);
      paint(g, '#5a3a1e', 3);
      rrect(g, W / 2 - 14, H - 60, 28, 50, 8);
      paint(g, '#8a5a30', 3);
    },
    hay_bales: function (g, W, H) {
      [[W / 2 - 54, H - 54], [W / 2 + 54, H - 54]].forEach(function (b) {
        ell(g, b[0], b[1], 50, 46);
        paint(g, rad(g, b[0] - 10, b[1] - 10, 4, b[0], b[1], 50, [[0, '#f6dc8a'], [1, '#c8a040']]), 4);
      });
      ell(g, W / 2, H - 70, 18, 18);
      paint(g, '#4a90e0', 3);
    },
  };
  function tree(leaf, dark, fruit) {
    return function (g, W, H) {
      A.shadow(g, W / 2, H - 14, W / 2 - 30, 14, 0.3);
      rrect(g, W / 2 - 16, H - 150, 32, 140, 10);
      paint(g, grad(g, H - 150, H, '#9a6a3a', '#6a4424'), 4);
      [[W / 2, 120, 104], [W / 2 - 60, 160, 64], [W / 2 + 60, 160, 64]].forEach(function (c) {
        ell(g, c[0], c[1], c[2], c[2] * 0.9);
        paint(g, rad(g, c[0] - 20, c[1] - 30, 8, c[0], c[1], c[2], [[0, leaf], [1, dark]]), 4);
      });
      var r = A.rng(fruit.length * 7);
      for (var i = 0; i < 9; i++) { ell(g, r.range(40, W - 40), r.range(60, 210), 9, 9); paint(g, fruit, 2); }
    };
  }

  // One frame of the sheet, at 128 px per tile.
  A.yardPiece = function (frame) {
    var name = frame[0], t = frame[1], W = frame[2] * U, H = frame[3] * U, c = A.canvas(W, H), g = c.getContext('2d');
    var O = A.OVR || {};
    if (O['yard:' + name]) { g.drawImage(O['yard:' + name], 0, 0, W, H); return c; }
    if (t.kind === 'fence') fence(g, t.key, name.split(':')[1]);
    else if (t.kind === 'path') path(g, t.key);
    else if (t.kind === 'hedge') hedge(g, t.key === 'flower_hedge');
    else if (D[t.key]) D[t.key](g, W, H);
    else throw new Error('no yard art for ' + t.key);
    return c;
  };

  A.yardSheet = function (types) {
    var frames = A.yardFrames(types), rows = Math.ceil(frames.length / COLS);
    var sheet = A.canvas(8 + COLS * (CELL + GAP) - 8, 8 + rows * (CELL + GAP) - 8), g = sheet.getContext('2d');
    frames.forEach(function (f, k) {
      var x = 8 + (k % COLS) * (CELL + GAP), y = 8 + Math.floor(k / COLS) * (CELL + GAP);
      g.drawImage(A.yardPiece(f), x, y + CELL - f[3] * U);
    });
    return sheet;
  };

  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra(sets);
    out.sheets.yard = A.yardSheet(sets.OUTDOOR.types);
    return out;
  };
})();
