// Field debris, town ground (dock planks, plaza stones), the indoor/cave tileset, the dog, and grass crops.
// Runs after draw.js; adds to window.ART.
(function () {
  'use strict';
  var A = window.ART, S = A.S, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, OUT = A.OUT;

  // ---------- field debris (transparent tiles on the Debris layer) ----------
  function debrisRock(g, cx, cy, r, big) {
    A.shadow(g, cx, cy + r * 0.7, r * 1.1, r * 0.3);
    g.beginPath();
    g.moveTo(cx - r, cy + r * 0.55);
    g.quadraticCurveTo(cx - r * 1.15, cy - r * 0.35, cx - r * 0.35, cy - r * 0.8);
    g.quadraticCurveTo(cx + r * 0.55, cy - r * 1.05, cx + r, cy - r * 0.15);
    g.quadraticCurveTo(cx + r * 1.08, cy + r * 0.55, cx + r * 0.45, cy + r * 0.72);
    g.closePath();
    paint(g, rad(g, cx - r * 0.3, cy - r * 0.4, 4, cx, cy, r * 1.25, big
      ? [[0, '#d9d4ce'], [0.55, '#9a928a'], [1, '#625b54']]
      : [[0, '#eef1f4'], [0.55, '#aab2bb'], [1, '#737c86']]), 7);
    g.beginPath();
    g.moveTo(cx - r * 0.5, cy - r * 0.45);
    g.quadraticCurveTo(cx, cy - r * 0.7, cx + r * 0.45, cy - r * 0.45);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.stroke();
    if (big) {
      g.beginPath();
      g.moveTo(cx - r * 0.1, cy - r * 0.6);
      g.lineTo(cx + r * 0.1, cy);
      g.lineTo(cx - r * 0.2, cy + r * 0.4);
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(60,50,40,0.5)';
      g.stroke();
    }
  }

  A.TILE_DRAW.d_weed = function () {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(201);
    A.shadow(g, 128, 200, 70, 14, 0.2);
    for (var i = 0; i < 11; i++) {
      var x = 76 + i * 10 + r.range(-4, 4), h = r.range(50, 100), lean = r.range(-34, 34);
      g.beginPath();
      g.moveTo(x - 8, 200);
      g.quadraticCurveTo(x + lean * 0.3, 200 - h * 0.6, x + lean, 200 - h);
      g.quadraticCurveTo(x + lean * 0.3 + 5, 200 - h * 0.5, x + 8, 200);
      g.closePath();
      paint(g, lin(g, 0, 200 - h, 0, 200, [[0, '#9bd65a'], [1, '#3f7f22']]), 3.5, '#2a5a18');
    }
    A.leaf(g, 100, 196, 50, 22, -1.0, A.DARK_LEAF);
    A.leaf(g, 156, 196, 50, 22, 1.0, A.DARK_LEAF);
    return c;
  };

  A.TILE_DRAW.d_branch = function () {
    var c = A.canvas(S, S), g = c.getContext('2d');
    A.shadow(g, 128, 178, 92, 16, 0.25);
    g.save();
    g.translate(128, 160);
    g.rotate(-0.25);
    rrect(g, -90, -14, 180, 28, 14);
    paint(g, lin(g, 0, -14, 0, 14, [[0, '#b77a45'], [1, '#74482a']]), 7);
    rrect(g, 10, -36, 54, 16, 8);
    paint(g, lin(g, 0, -36, 0, -20, [[0, '#b77a45'], [1, '#74482a']]), 6);
    A.leaf(g, 64, -34, 34, 14, 1.2, A.LEAF);
    ell(g, 90, 0, 9, 13);
    paint(g, '#e9c493', 4);
    g.restore();
    return c;
  };

  A.TILE_DRAW.d_stone = function () {
    var c = A.canvas(S, S), g = c.getContext('2d');
    debrisRock(g, 128, 150, 58, false);
    return c;
  };

  A.TILE_DRAW.d_stump = function () {
    var c = A.canvas(S, S), g = c.getContext('2d');
    A.shadow(g, 128, 210, 96, 20, 0.3);
    g.beginPath();
    g.moveTo(46, 110);
    g.lineTo(40, 196);
    g.quadraticCurveTo(128, 232, 216, 196);
    g.lineTo(210, 110);
    paint(g, lin(g, 40, 0, 216, 0, [[0, '#ad7240'], [1, '#6e4122']]), 7);
    [[40, 196, 18, 210], [216, 196, 238, 214]].forEach(function (rt) {
      g.beginPath();
      g.moveTo(rt[0], rt[1] - 20);
      g.quadraticCurveTo(rt[0] + (rt[2] - rt[0]) * 0.6, rt[1], rt[2], rt[3]);
      g.lineTo(rt[0] + (rt[0] < 128 ? 26 : -26), rt[1]);
      paint(g, '#7d4a26', 6);
    });
    ell(g, 128, 110, 82, 34);
    paint(g, rad(g, 128, 110, 4, 128, 110, 82, [[0, '#f2cf96'], [1, '#c9955a']]), 7);
    [56, 36, 18].forEach(function (rr) {
      ell(g, 128, 110, rr, rr * 0.42);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(140,90,40,0.6)';
      g.stroke();
    });
    return c;
  };

  A.TILE_DRAW.d_boulder = function () {
    var c = A.canvas(S, S), g = c.getContext('2d');
    debrisRock(g, 128, 140, 96, true);
    return c;
  };

  A.TILE_DRAW.dock = function () {
    var c = A.canvas(S, S), g = c.getContext('2d');
    for (var i = 0; i < 4; i++) {
      var y = i * 64;
      g.fillStyle = lin(g, 0, y, 0, y + 64, [[0, '#d6a36a'], [1, '#a8723f']]);
      g.fillRect(0, y, S, 64);
      g.fillStyle = 'rgba(70,40,15,0.55)';
      g.fillRect(0, y + 60, S, 4);
      g.fillStyle = 'rgba(255,230,190,0.35)';
      g.fillRect(0, y + 2, S, 3);
      [40 + (i % 2) * 90, 170 - (i % 2) * 60].forEach(function (x) {
        ell(g, x, y + 32, 4, 4);
        g.fillStyle = '#5a3a1e';
        g.fill();
      });
    }
    return c;
  };

  A.TILE_DRAW.plaza = function () {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(211);
    g.fillStyle = '#b9b0a2';
    g.fillRect(0, 0, S, S);
    for (var gy = 0; gy < 4; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var off = (gy % 2) * 32, x = gx * 64 + off, y = gy * 64;
        var col = r.pick(['#ddd5c8', '#d2c9ba', '#e6dfd3', '#cfc4b3']);
        [x, x - S].forEach(function (px) {
          rrect(g, px + 3, y + 3, 58, 58, 8);
          paint(g, col, 3, '#9e9384');
          rrect(g, px + 8, y + 7, 40, 10, 5);
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.fill();
        });
      }
    }
    return c;
  };

  // ---------- indoor + cave tileset ----------
  function woodFloor(dark) {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(dark ? 222 : 221);
    for (var i = 0; i < 4; i++) {
      var y = i * 64, shade = r.range(-0.04, 0.04);
      g.fillStyle = lin(g, 0, y, 0, y + 64, dark
        ? [[0, '#b4824e'], [1, '#93643a']]
        : [[0, 'rgb(' + Math.round(222 + shade * 255) + ',178,120)'], [1, '#c9955e']]);
      g.fillRect(0, y, S, 64);
      g.fillStyle = 'rgba(90,55,25,0.45)';
      g.fillRect(0, y + 61, S, 3);
      var seam = (i % 2) * 128 + 60;
      g.fillRect(seam, y, 3, 64);
      for (var k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(r.range(0, 200), y + r.range(14, 50));
        g.lineTo(r.range(40, 256), y + r.range(14, 50));
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(120,80,40,0.25)';
        g.stroke();
      }
    }
    return c;
  }

  function wall(low) {
    var c = A.canvas(S, S), g = c.getContext('2d');
    g.fillStyle = lin(g, 0, 0, 0, S, [[0, '#f7e3c3'], [1, '#ecd3ab']]);
    g.fillRect(0, 0, S, S);
    for (var x = 0; x < S; x += 64) {
      g.fillStyle = 'rgba(214,170,120,0.35)';
      g.fillRect(x + 30, 0, 4, S);
      for (var y = 20; y < S; y += 64) {
        A.flower(g, x + 12, y + (x % 128 ? 32 : 0), 7, 'rgba(255,170,190,0.55)', 'rgba(255,230,150,0.7)');
      }
    }
    if (low) {
      g.fillStyle = lin(g, 0, 150, 0, S, [[0, '#a8723f'], [1, '#7d4f2a']]);
      g.fillRect(0, 150, S, S - 150);
      g.fillStyle = '#5a3a1e';
      g.fillRect(0, 146, S, 8);
      for (var px = 0; px < S; px += 64) {
        g.fillStyle = 'rgba(60,35,15,0.45)';
        g.fillRect(px, 154, 3, S - 154);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, S - 12, S, 12);
    } else {
      g.fillStyle = '#c99a62';
      g.fillRect(0, 0, S, 14);
      g.fillStyle = '#8a5a30';
      g.fillRect(0, 14, S, 5);
    }
    return c;
  }

  function sideWall() {
    var c = A.canvas(S, S), g = c.getContext('2d');
    g.fillStyle = lin(g, 0, 0, S, 0, [[0, '#6e4a2e'], [1, '#8a5f3c']]);
    g.fillRect(0, 0, S, S);
    for (var y = 0; y < S; y += 32) {
      g.fillStyle = 'rgba(40,25,10,0.35)';
      g.fillRect(0, y, S, 3);
    }
    return c;
  }

  function solid(col) {
    var c = A.canvas(S, S), g = c.getContext('2d');
    g.fillStyle = col;
    g.fillRect(0, 0, S, S);
    return c;
  }

  function caveFloor(seed) {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(seed);
    g.fillStyle = '#6b5a4c';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 18; i++) {
      var px = r() * S, py = r() * S, pr = r.range(24, 60), light = r() < 0.5;
      A.wrap(S, px, py, pr, function (x, y) {
        g.fillStyle = rad(g, x, y, 0, x, y, pr, light
          ? [[0, 'rgba(150,128,108,0.5)'], [1, 'rgba(150,128,108,0)']]
          : [[0, 'rgba(50,40,32,0.45)'], [1, 'rgba(50,40,32,0)']]);
        g.fillRect(x - pr, y - pr, pr * 2, pr * 2);
      });
    }
    for (var k = 0; k < 16; k++) {
      var sx = r() * S, sy = r() * S, sr = r.range(3, 8);
      A.wrap(S, sx, sy, 10, function (x, y) {
        ell(g, x, y, sr, sr * 0.7);
        g.fillStyle = r() < 0.5 ? '#8a7766' : '#4f4238';
        g.fill();
      });
    }
    return c;
  }

  function caveWall(top) {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(top ? 233 : 232);
    g.fillStyle = top ? '#3a302a' : '#57483d';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 9; i++) {
      var x = (i % 3) * 86 + r.range(-10, 10), y = Math.floor(i / 3) * 86 + r.range(-10, 10);
      ell(g, x + 43, y + 43, r.range(34, 48), r.range(28, 40));
      g.fillStyle = top ? 'rgba(80,66,56,0.6)' : 'rgba(120,100,84,0.6)';
      g.fill();
    }
    if (!top) {
      g.fillStyle = 'rgba(20,14,10,0.5)';
      g.fillRect(0, S - 20, S, 20);
    }
    return c;
  }

  function ladder(down) {
    var c = caveFloor(241), g = c.getContext('2d');
    if (down) {
      ell(g, 128, 140, 100, 80);
      paint(g, rad(g, 128, 150, 10, 128, 140, 100, [[0, '#000000'], [1, '#2a211b']]), 8, '#2a211b');
    }
    [92, 164].forEach(function (x) {
      rrect(g, x - 9, down ? 70 : 20, 18, down ? 170 : 236, 6);
      paint(g, lin(g, x - 9, 0, x + 9, 0, [[0, '#d6a36a'], [1, '#8a5a30']]), 5);
    });
    for (var y = down ? 96 : 44; y < (down ? 230 : 250); y += 40) {
      rrect(g, 92, y, 72, 14, 5);
      paint(g, '#c98b4f', 4);
    }
    return c;
  }

  function mineRock() {
    var c = A.canvas(S, S), g = c.getContext('2d');
    debrisRock(g, 128, 146, 76, true);
    return c;
  }

  // ---------- the dog (384x320 frames, facing left; pose 0/1 walk, 2 sit, 3 sleep) ----------
  A.dog = function (g, pose) {
    var fur = ['#e8b673', '#c48945'], dark = '#7a4f2a';
    A.shadow(g, 196, 300, 96, 14);
    if (pose === 3) {
      g.save();
      g.translate(0, 40);
      ell(g, 200, 226, 96, 46);
      paint(g, lin(g, 0, 180, 0, 272, [[0, fur[0]], [1, fur[1]]]));
      ell(g, 118, 232, 46, 40);
      paint(g, lin(g, 0, 192, 0, 272, [[0, fur[0]], [1, fur[1]]]));
      ell(g, 132, 210, 18, 28, 0.6);
      paint(g, dark, 5);
      g.beginPath();
      g.arc(108, 232, 9, 0.1 * Math.PI, 0.9 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
      ell(g, 80, 244, 10, 8);
      paint(g, '#3b2312', 3);
      g.restore();
      return;
    }
    var sit = pose === 2, step = pose === 1 ? 1 : -1;
    // tail
    g.beginPath();
    g.moveTo(270, 196);
    g.quadraticCurveTo(320, 170, 306, sit ? 230 : 130);
    g.lineWidth = 22;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 12;
    g.strokeStyle = fur[1];
    g.stroke();
    var legs = sit ? [[150, 0], [176, 0]] : [[140, step * 0.3], [168, -step * 0.3], [244, -step * 0.3], [270, step * 0.3]];
    legs.forEach(function (l, i) {
      g.save();
      g.translate(l[0], 236);
      g.rotate(l[1]);
      rrect(g, -12, -8, 24, 66, 10);
      paint(g, i % 2 ? fur[1] : fur[0]);
      ell(g, -4, 58, 16, 10);
      paint(g, '#fff1dc', 4);
      g.restore();
    });
    if (sit) {
      ell(g, 236, 236, 64, 52);
      paint(g, lin(g, 0, 180, 0, 290, [[0, fur[0]], [1, fur[1]]]));
      ell(g, 196, 216, 52, 66, -0.3);
      paint(g, lin(g, 0, 150, 0, 282, [[0, fur[0]], [1, fur[1]]]));
    } else {
      rrect(g, 120, 168, 170, 82, 40);
      paint(g, lin(g, 0, 168, 0, 250, [[0, fur[0]], [1, fur[1]]]));
      ell(g, 150, 226, 30, 18);
      g.fillStyle = '#fff1dc';
      g.fill();
    }
    // head
    var hx = sit ? 162 : 116, hy = sit ? 140 : 156;
    ell(g, hx, hy, 52, 46);
    paint(g, rad(g, hx - 14, hy - 16, 4, hx, hy, 56, [[0, fur[0]], [1, fur[1]]]));
    ell(g, hx - 34, hy + 16, 28, 20);
    paint(g, '#fff1dc');
    ell(g, hx - 56, hy + 8, 11, 9);
    paint(g, '#3b2312', 4);
    ell(g, hx + 24, hy - 4, 18, 36, 0.35);
    paint(g, dark);
    A.eyes(g, hx - 18, hx - 18, hy - 8);
    g.beginPath();
    g.moveTo(hx - 50, hy + 30);
    g.quadraticCurveTo(hx - 38, hy + 42, hx - 26, hy + 30);
    g.lineWidth = 4;
    g.strokeStyle = OUT;
    g.stroke();
    // red collar
    rrect(g, hx + 4, hy + 34, 36, 14, 6);
    paint(g, '#e5383f', 4);
  };

  // ---------- grass crop (growing, ripe) ----------
  function grassPatch(g, n, h) {
    var r = A.rng(250 + n);
    for (var i = 0; i < n; i++) {
      var x = 128 + r.range(-80, 80), hh = r.range(h * 0.6, h), lean = r.range(-24, 24);
      g.beginPath();
      g.moveTo(x - 7, 222);
      g.quadraticCurveTo(x + lean * 0.3, 222 - hh * 0.6, x + lean, 222 - hh);
      g.quadraticCurveTo(x + lean * 0.3 + 4, 222 - hh * 0.5, x + 7, 222);
      g.closePath();
      paint(g, lin(g, 0, 222 - hh, 0, 222, [[0, '#b9ef7a'], [1, '#4a9a2b']]), 3.5, '#2f6a1c');
    }
  }
  A.CROP_DRAW.grass = [null, null, function (g) {
    A.mound(g, 78);
    grassPatch(g, 14, 90);
  }, function (g) {
    A.mound(g, 92);
    grassPatch(g, 26, 170);
  }];

  // ---------- extra sheets (called from makeArt) ----------
  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra ? prevExtra(sets) : { sheets: {}, props: {} };
    var indoor = A.tileSheet(sets.INDOOR), T = sets.INDOOR.T;
    indoor.place(T.floor, woodFloor(false), 0, 0);
    indoor.place(T.floor2, woodFloor(true), 0, 0);
    indoor.place(T.wall, wall(false), 0, 0);
    indoor.place(T.wall_low, wall(true), 0, 0);
    indoor.place(T.wall_side, sideWall(), 0, 0);
    indoor.place(T.void, solid('#1a120c'), 0, 0);
    indoor.place(T.cave, caveFloor(231), 0, 0);
    indoor.place(T.cave2, caveFloor(239), 0, 0);
    indoor.place(T.cave_wall, caveWall(false), 0, 0);
    indoor.place(T.cave_top, caveWall(true), 0, 0);
    indoor.place(T.ladder_down, ladder(true), 0, 0);
    indoor.place(T.ladder_up, ladder(false), 0, 0);
    indoor.place(T.mine_rock, mineRock(), 0, 0);
    out.sheets.indoor = indoor.canvas;
    return out;
  };
})();
