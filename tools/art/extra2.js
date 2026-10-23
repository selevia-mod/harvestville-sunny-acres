// The horse, the cat, the mailbox, the stable, the mine chest, new furniture, and icons for letters,
// the collection book, pets and furniture. Runs after props.js.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, OUT = A.OUT;
  var D = A.ICON_DRAW, P = A.PROP_DRAW;

  function grad(g, y0, y1, a, b) {
    return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]);
  }

  function line(g, pts, w, color) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.lineWidth = w;
    g.strokeStyle = color || OUT;
    g.lineCap = 'round';
    g.stroke();
  }

  // ---------- the horse (384x320, facing left; poses: walk A, walk B, stand, eat) ----------
  A.horse = function (g, pose) {
    var coat = ['#c98a4f', '#8f5628'], mane = '#4a2a14';
    A.shadow(g, 200, 304, 150, 16);
    var swing = pose === 0 ? 0.22 : pose === 1 ? -0.22 : 0;
    var leg = function (x, ang, far) {
      g.save();
      g.translate(x, 214);
      g.rotate(ang);
      rrect(g, -15, -12, 30, 84, 12);
      paint(g, far ? coat[1] : coat[0]);
      rrect(g, -17, 62, 34, 20, 6);
      paint(g, '#3b2312', 4);
      g.restore();
    };
    leg(126, -swing, true);
    leg(286, swing, true);
    // tail
    g.beginPath();
    g.moveTo(330, 140);
    g.quadraticCurveTo(372, 176, 352, 250);
    g.quadraticCurveTo(336, 200, 318, 168);
    g.closePath();
    paint(g, mane, 5);
    // body
    rrect(g, 96, 112, 248, 116, 56);
    paint(g, grad(g, 112, 228, coat[0], coat[1]));
    ell(g, 228, 150, 60, 18);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fill();
    // saddle
    rrect(g, 188, 104, 92, 44, 16);
    paint(g, grad(g, 104, 148, '#e5484d', '#a8302a'), 5);
    rrect(g, 220, 140, 14, 56, 6);
    paint(g, '#6e4122', 4);
    leg(150, swing, false);
    leg(312, -swing, false);
    // neck and head
    var eat = pose === 3, hy = eat ? 190 : 0;
    g.save();
    if (eat) {
      g.translate(150, 150);
      g.rotate(-1.5);
      g.translate(-150, -150);
    }
    g.beginPath();
    g.moveTo(150, 140);
    g.lineTo(96, 40);
    g.lineTo(52, 70);
    g.lineTo(108, 170);
    g.closePath();
    paint(g, grad(g, 40, 170, coat[0], coat[1]));
    rrect(g, 16, 30, 96, 58, 28);
    paint(g, rad(g, 50, 46, 4, 64, 58, 70, [[0, '#e0a56a'], [1, coat[1]]]));
    ell(g, 30, 64, 22, 20);
    paint(g, '#f0c9a0', 4);
    ell(g, 22, 62, 5, 6);
    g.fillStyle = '#5a3a1e';
    g.fill();
    ell(g, 62, 48, 7, 9);
    g.fillStyle = OUT;
    g.fill();
    ell(g, 60, 45, 2.5, 3);
    g.fillStyle = '#fff';
    g.fill();
    // ears and mane
    g.beginPath();
    g.moveTo(86, 30);
    g.lineTo(96, 4);
    g.lineTo(104, 34);
    g.closePath();
    paint(g, coat[1], 4);
    g.beginPath();
    g.moveTo(98, 28);
    g.quadraticCurveTo(140, 70, 156, 140);
    g.lineTo(136, 146);
    g.quadraticCurveTo(116, 80, 84, 44);
    g.closePath();
    paint(g, mane, 4);
    g.restore();
    void hy;
  };

  // ---------- the cat (384x320 frame, small, facing left; walk A, walk B, sit, sleep) ----------
  A.cat = function (g, pose) {
    var fur = ['#9aa3b0', '#5f6875'], belly = '#e9edf2';
    A.shadow(g, 196, 300, 70, 10);
    if (pose === 3) {
      ell(g, 196, 270, 70, 34);
      paint(g, grad(g, 236, 304, fur[0], fur[1]));
      ell(g, 140, 270, 34, 28);
      paint(g, grad(g, 242, 298, fur[0], fur[1]));
      line(g, [[262, 272], [290, 250], [270, 236]], 12, fur[1]);
      [[124, 248], [150, 246]].forEach(function (e) {
        g.beginPath();
        g.moveTo(e[0] - 8, e[1]);
        g.lineTo(e[0], e[1] - 18);
        g.lineTo(e[0] + 8, e[1]);
        g.closePath();
        paint(g, fur[1], 3);
      });
      g.beginPath();
      g.arc(132, 272, 7, 0.1 * Math.PI, 0.9 * Math.PI);
      g.lineWidth = 4;
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    var sit = pose === 2, step = pose === 1 ? 1 : -1;
    line(g, sit ? [[240, 290], [292, 280], [300, 240]] : [[262, 236], [306, 214], [300, 170]], 14, OUT);
    line(g, sit ? [[240, 290], [292, 280], [300, 240]] : [[262, 236], [306, 214], [300, 170]], 8, fur[0]);
    var legs = sit ? [[170, 0], [190, 0]] : [[150, step * 0.3], [170, -step * 0.3], [236, -step * 0.3], [256, step * 0.3]];
    legs.forEach(function (l, i) {
      g.save();
      g.translate(l[0], 252);
      g.rotate(l[1]);
      rrect(g, -9, -6, 18, 46, 8);
      paint(g, i % 2 ? fur[1] : fur[0], 4);
      g.restore();
    });
    if (sit) {
      ell(g, 214, 256, 48, 42);
      paint(g, grad(g, 214, 298, fur[0], fur[1]));
    } else {
      rrect(g, 136, 204, 140, 60, 30);
      paint(g, grad(g, 204, 264, fur[0], fur[1]));
      ell(g, 170, 248, 26, 12);
      g.fillStyle = belly;
      g.fill();
    }
    var hx = sit ? 184 : 136, hy = sit ? 196 : 196;
    [[hx - 26, hy - 30], [hx + 18, hy - 32]].forEach(function (e) {
      g.beginPath();
      g.moveTo(e[0] - 14, e[1] + 14);
      g.lineTo(e[0], e[1] - 20);
      g.lineTo(e[0] + 14, e[1] + 10);
      g.closePath();
      paint(g, fur[1], 4);
    });
    ell(g, hx, hy, 42, 36);
    paint(g, rad(g, hx - 12, hy - 12, 3, hx, hy, 44, [[0, '#c5ccd6'], [1, fur[1]]]));
    ell(g, hx - 12, hy + 14, 18, 12);
    g.fillStyle = belly;
    g.fill();
    [hx - 22, hx + 4].forEach(function (x) {
      ell(g, x, hy - 4, 6, 9);
      g.fillStyle = '#3a6a2a';
      g.fill();
      ell(g, x, hy - 4, 2, 7);
      g.fillStyle = OUT;
      g.fill();
    });
    ell(g, hx - 10, hy + 8, 5, 4);
    g.fillStyle = '#ff8fa3';
    g.fill();
    line(g, [[hx - 40, hy + 8], [hx - 64, hy + 4]], 2.5);
    line(g, [[hx - 40, hy + 14], [hx - 62, hy + 18]], 2.5);
  };

  // ---------- icons (128x128) ----------
  D.letter = function (g) {
    rrect(g, 14, 30, 100, 70, 10);
    paint(g, grad(g, 30, 100, '#fffaf0', '#f1e2c2'));
    line(g, [[16, 34], [64, 72], [112, 34]], 6);
    ell(g, 64, 74, 13, 13);
    paint(g, '#e5484d', 4);
  };
  D.book = function (g) {
    rrect(g, 24, 16, 80, 100, 10);
    paint(g, grad(g, 16, 116, '#5fa84a', '#3b7a2a'));
    rrect(g, 34, 24, 8, 84, 3);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    A.star(g, 72, 62, 24, 11, '#ffd23f');
    paint(g, '#ffd23f', 4);
  };
  D.horse = function (g) {
    g.save();
    g.translate(1, 14);
    g.scale(0.33, 0.33);
    A.horse(g, 2);
    g.restore();
  };
  D.cat = function (g) {
    g.save();
    g.translate(-50, -60);
    g.scale(0.55, 0.55);
    A.cat(g, 2);
    g.restore();
  };
  D.cat_basket = function (g) {
    ell(g, 64, 86, 50, 26);
    paint(g, grad(g, 60, 112, '#d9a35f', '#9a6630'));
    ell(g, 64, 78, 40, 14);
    paint(g, '#ff9ab5', 4);
    g.save();
    g.translate(8, 6);
    g.scale(0.3, 0.3);
    A.cat(g, 3);
    g.restore();
  };
  D.chest = function (g) {
    rrect(g, 16, 50, 96, 60, 10);
    paint(g, grad(g, 50, 110, '#c98b4f', '#865a2e'));
    rrect(g, 16, 28, 96, 34, 14);
    paint(g, grad(g, 28, 62, '#e0a868', '#a8703c'));
    rrect(g, 54, 52, 20, 22, 4);
    paint(g, '#ffd23f', 4);
    [[30, 28], [90, 28]].forEach(function (b) {
      rrect(g, b[0], b[1], 8, 82, 3);
      paint(g, '#f2c53d', 3);
    });
  };
  D.star = function (g) {
    A.star(g, 64, 66, 52, 24, '#ffd23f');
    paint(g, lin(g, 0, 14, 0, 118, [[0, '#fff3a0'], [1, '#f2b51d']]), 6);
  };
  D.aquarium = function (g) {
    rrect(g, 14, 26, 100, 78, 10);
    paint(g, grad(g, 26, 104, '#bfe6ff', '#3f8fd0'));
    [[48, 60, '#ff9a3d'], [82, 76, '#ffd23f']].forEach(function (f) {
      ell(g, f[0], f[1], 13, 8);
      paint(g, f[2], 3);
    });
    rrect(g, 8, 100, 112, 14, 4);
    paint(g, '#6e4122', 4);
  };
  D.music_box = function (g) {
    rrect(g, 20, 54, 88, 56, 10);
    paint(g, grad(g, 54, 110, '#ff9ab5', '#c04a78'));
    rrect(g, 14, 40, 100, 22, 8);
    paint(g, '#ffd23f', 4);
    line(g, [[78, 14], [78, 36]], 6);
    ell(g, 70, 36, 10, 8);
    paint(g, OUT, 0);
  };
  D.big_plant = function (g) {
    rrect(g, 40, 82, 48, 34, 8);
    paint(g, grad(g, 82, 116, '#e0855a', '#a8502a'));
    A.puffs(g, [[64, 46, 30], [40, 62, 20], [88, 62, 20], [64, 22, 18]], A.LEAF);
  };

  // ---------- props (full 256-per-tile size; stored at half size) ----------
  P.mailbox = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, 70, 16);
      rrect(g, W / 2 - 14, 200, 28, H - 220, 8);
      paint(g, grad(g, 200, H, '#a8703c', '#6e4122'));
      rrect(g, 40, 90, W - 80, 130, 50);
      paint(g, grad(g, 90, 220, '#5b8ee0', '#355fb0'), 7);
      rrect(g, 60, 140, W - 120, 70, 10);
      paint(g, '#2c4f8f', 4);
      // the flag shows letters are waiting; the game raises it with a tint/overlay
      rrect(g, W - 60, 60, 14, 100, 6);
      paint(g, '#e5484d', 4);
      rrect(g, W - 60, 60, 54, 36, 6);
      paint(g, '#e5484d', 4);
    };
  };

  P.stable = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, W / 2 - 30, 34);
      rrect(g, 40, 260, W - 80, H - 290, 12);
      paint(g, grad(g, 260, H - 30, '#d0905a', '#8f5628'), 8);
      for (var x = 70; x < W - 60; x += 56) line(g, [[x, 270], [x, H - 40]], 4, 'rgba(60,30,10,0.35)');
      g.beginPath();
      g.moveTo(10, 290);
      g.lineTo(W / 2, 60);
      g.lineTo(W - 10, 290);
      g.closePath();
      paint(g, grad(g, 60, 290, '#e5484d', '#a8302a'), 8);
      rrect(g, W / 2 - 90, H - 260, 180, 230, 12);
      paint(g, '#4a2a14', 6);
      line(g, [[W / 2 - 90, H - 250], [W / 2 + 90, H - 40]], 12, '#e0a868');
      line(g, [[W / 2 + 90, H - 250], [W / 2 - 90, H - 40]], 12, '#e0a868');
      ell(g, W / 2, 190, 40, 40);
      paint(g, '#fffaf0', 6);
      A.star(g, W / 2, 190, 26, 12, '#e5484d');
      g.fillStyle = '#e5484d';
      g.fill();
      // hay bale
      rrect(g, W - 180, H - 120, 130, 90, 18);
      paint(g, grad(g, H - 120, H - 30, '#f7d774', '#c99a2a'), 6);
    };
  };

  P.chest = function () {
    return function (g) {
      A.shadow(g, 128, 236, 96, 18);
      g.save();
      g.translate(0, 60);
      g.scale(2, 1.4);
      D.chest(g);
      g.restore();
    };
  };

  P.aquarium = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 30, 22);
      rrect(g, 40, H - 170, W - 80, 150, 14);
      paint(g, grad(g, H - 170, H - 20, '#a8703c', '#6e4122'), 7);
      rrect(g, 30, 60, W - 60, H - 220, 18);
      paint(g, grad(g, 60, H - 160, 'rgba(191,230,255,0.95)', 'rgba(63,143,208,0.95)'), 8);
      [[150, 150, '#ff9a3d', 1], [320, 210, '#ffd23f', -1], [230, 260, '#ff6b9a', 1]].forEach(function (f) {
        ell(g, f[0], f[1], 34, 20);
        paint(g, f[2], 5);
        g.beginPath();
        g.moveTo(f[0] + f[3] * 30, f[1]);
        g.lineTo(f[0] + f[3] * 58, f[1] - 20);
        g.lineTo(f[0] + f[3] * 58, f[1] + 20);
        g.closePath();
        paint(g, f[2], 5);
      });
      for (var i = 0; i < 6; i++) {
        ell(g, 80 + i * 60, H - 186, 10, 10);
        paint(g, 'rgba(255,255,255,0.6)', 0);
      }
      line(g, [[110, H - 176], [120, 200], [100, 150]], 12, '#4fae4a');
      line(g, [[W - 110, H - 176], [W - 130, 220], [W - 100, 170]], 12, '#4fae4a');
    };
  };

  P.music_box = function () {
    return function (g) {
      A.shadow(g, 128, 236, 80, 14);
      rrect(g, 40, 120, 176, 110, 16);
      paint(g, grad(g, 120, 230, '#ff9ab5', '#c04a78'), 7);
      rrect(g, 30, 90, 196, 44, 14);
      paint(g, '#ffd23f', 6);
      A.flower(g, 128, 176, 22, '#fffaf0', '#ffd23f');
      line(g, [[190, 40], [190, 90]], 10);
      ell(g, 176, 92, 18, 14);
      paint(g, OUT, 0);
    };
  };

  P.big_plant = function (p) {
    return function (g) {
      var H = p.H;
      A.shadow(g, 128, H - 20, 76, 16);
      rrect(g, 70, H - 150, 116, 130, 20);
      paint(g, lin(g, 70, 0, 186, 0, [[0, '#e0855a'], [1, '#a8502a']]), 7);
      A.puffs(g, [[128, 120, 70], [70, 200, 54], [186, 200, 54], [128, 250, 60], [90, 80, 40], [170, 80, 40]], A.LEAF);
    };
  };

  P.cat_bed = function () {
    return function (g) {
      ell(g, 128, 160, 110, 70);
      paint(g, grad(g, 90, 230, '#d9a35f', '#9a6630'), 7);
      ell(g, 128, 148, 86, 46);
      paint(g, '#ff9ab5', 5);
    };
  };
})();
