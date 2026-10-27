// Drawn stand-ins for the growing farm (src/00-workshop.js): the fruit and the workshop goods (item icons), and
// the workshops, the new fruit trees and the field plot (yard pieces). Generated pictures in art-src/ replace
// them: icons/<name>.png for an icon, outdoor/farm2.png for the yard pieces (tools/art-manifest.js).
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var D = A.ICON_DRAW, Y = A.YARD_DRAW;
  var grad = function (g, y0, y1, a, b) { return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]); };
  var shine = function (g, x, y, rx, ry) {
    ell(g, x, y, rx, ry, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
  };
  var leafy = function (g, x, y, ang) {
    ell(g, x, y, 16, 8, ang);
    paint(g, grad(g, y - 8, y + 8, '#8fd65a', '#3f8f2a'), 3);
  };
  var stem = function (g, x, y) {
    rrect(g, x - 3, y - 14, 6, 16, 3);
    paint(g, '#7a4a24', 2);
  };

  // ---------- fruit ----------
  D.apple = function (g) {
    g.beginPath();
    g.moveTo(64, 40);
    g.bezierCurveTo(30, 18, 10, 60, 30, 92);
    g.bezierCurveTo(42, 112, 56, 108, 64, 102);
    g.bezierCurveTo(72, 108, 86, 112, 98, 92);
    g.bezierCurveTo(118, 60, 98, 18, 64, 40);
    paint(g, rad(g, 48, 52, 6, 64, 70, 56, [[0, '#ff7a7a'], [0.6, '#e5303d'], [1, '#a5161f']]), 5);
    shine(g, 46, 56, 10, 6);
    stem(g, 64, 42);
    leafy(g, 80, 30, -0.5);
  };
  D.orange = function (g) {
    ell(g, 64, 70, 44, 42);
    paint(g, rad(g, 50, 54, 6, 64, 70, 48, [[0, '#ffc06a'], [0.6, '#f7941d'], [1, '#c8650e']]), 5);
    for (var i = 0; i < 14; i++) {
      var a = i * 2.4, r = 12 + (i * 7) % 26;
      ell(g, 64 + Math.cos(a) * r, 70 + Math.sin(a) * r, 2, 2);
      g.fillStyle = 'rgba(160,80,10,0.35)';
      g.fill();
    }
    shine(g, 48, 56, 10, 6);
    leafy(g, 76, 28, -0.4);
    stem(g, 64, 32);
  };
  D.mango = function (g) { // a long kidney shape, green at the stem and golden-red at the tip
    g.beginPath();
    g.moveTo(34, 30);
    g.bezierCurveTo(70, 18, 112, 54, 106, 92);
    g.bezierCurveTo(100, 118, 64, 120, 50, 100);
    g.bezierCurveTo(40, 86, 54, 70, 40, 58);
    g.bezierCurveTo(24, 46, 20, 34, 34, 30);
    paint(g, lin(g, 30, 30, 104, 112, [[0, '#8cc63f'], [0.35, '#f2d24a'], [0.75, '#f7a12e'], [1, '#e8502a']]), 5);
    shine(g, 70, 52, 12, 6);
    stem(g, 36, 32);
    leafy(g, 52, 20, -0.3);
  };
  D.peach = function (g) {
    ell(g, 64, 72, 44, 40);
    paint(g, rad(g, 50, 56, 6, 64, 72, 48, [[0, '#ffe0c0'], [0.5, '#ffaa7a'], [1, '#e8605a']]), 5);
    g.beginPath();
    g.moveTo(64, 36);
    g.quadraticCurveTo(54, 72, 66, 108);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(180,70,60,0.6)';
    g.stroke();
    shine(g, 46, 58, 9, 6);
    leafy(g, 80, 32, -0.5);
  };

  // ---------- the Bakery and the Dairy ----------
  D.pandesal = function (g) {
    [[40, 78], [88, 78], [64, 58]].forEach(function (c) {
      ell(g, c[0], c[1], 28, 22);
      paint(g, grad(g, c[1] - 22, c[1] + 22, '#f6c27a', '#b87434'), 5);
      for (var k = 0; k < 6; k++) {
        ell(g, c[0] - 14 + (k * 11) % 28, c[1] - 10 + (k * 7) % 12, 2.5, 2);
        g.fillStyle = '#fff2d4';
        g.fill();
      }
    });
  };
  D.cream = function (g) {
    g.beginPath();
    g.moveTo(36, 40);
    g.lineTo(92, 40);
    g.lineTo(86, 110);
    g.lineTo(42, 110);
    g.closePath();
    paint(g, grad(g, 40, 110, '#eaf6ff', '#a8c8e0'), 5);
    rrect(g, 90, 54, 18, 34, 9);
    g.lineWidth = 7;
    g.strokeStyle = '#3b2312';
    g.stroke();
    ell(g, 64, 42, 30, 10);
    paint(g, '#fffdf6', 4);
    ell(g, 60, 34, 16, 10);
    paint(g, '#ffffff', 3);
  };
  D.butter = function (g) {
    ell(g, 64, 92, 50, 16);
    paint(g, '#e8f0f6', 4);
    g.beginPath();
    g.moveTo(26, 82);
    g.lineTo(46, 52);
    g.lineTo(102, 52);
    g.lineTo(102, 80);
    g.lineTo(82, 98);
    g.lineTo(26, 98);
    g.closePath();
    paint(g, grad(g, 52, 98, '#fff3a0', '#f2c94c'), 5);
    g.beginPath();
    g.moveTo(26, 82);
    g.lineTo(82, 82);
    g.lineTo(102, 52);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(160,110,20,0.6)';
    g.stroke();
  };
  D.cheese = function (g) {
    g.beginPath();
    g.moveTo(18, 92);
    g.lineTo(104, 46);
    g.lineTo(112, 92);
    g.closePath();
    paint(g, grad(g, 46, 96, '#ffe27a', '#f2b02e'), 5);
    rrect(g, 18, 92, 94, 16, 4);
    paint(g, '#e8a024', 5);
    [[70, 78, 7], [92, 70, 5], [50, 88, 5], [98, 86, 4]].forEach(function (h) {
      ell(g, h[0], h[1], h[2], h[2] * 0.8);
      g.fillStyle = '#d8901a';
      g.fill();
    });
  };
  D.kesong_puti = function (g) {
    ell(g, 64, 88, 54, 24);
    paint(g, grad(g, 64, 112, '#7cc85a', '#2f7a2a'), 4);
    [[-30, 0.5], [30, -0.5]].forEach(function (l) {
      ell(g, 64 + l[0], 86, 26, 10, l[1]);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fill();
    });
    ell(g, 64, 70, 38, 26);
    paint(g, grad(g, 44, 96, '#ffffff', '#e4e8e0'), 5);
    shine(g, 52, 62, 12, 6);
  };

  // ---------- the Jam Maker: a jar with a cloth lid and a picture of what's in it ----------
  function jar(fill, dark, picture) {
    return function (g) {
      rrect(g, 30, 40, 68, 76, 16);
      paint(g, lin(g, 30, 0, 98, 0, [[0, fill], [1, dark]]), 5);
      rrect(g, 24, 24, 80, 22, 8);
      paint(g, '#fff4d6', 4);
      g.beginPath();
      g.moveTo(24, 40);
      g.quadraticCurveTo(64, 54, 104, 40);
      g.lineWidth = 4;
      g.strokeStyle = '#e04a4a';
      g.stroke();
      rrect(g, 40, 62, 48, 34, 7);
      paint(g, '#fff8e8', 3);
      g.save();
      g.translate(64, 79);
      g.scale(0.26, 0.26);
      g.translate(-64, -70);
      picture(g);
      g.restore();
      shine(g, 40, 52, 5, 10);
    };
  }
  D.grape_jelly = jar('#9a5ac8', '#4a1a6a', function (g) { D.grapes(g); });
  D.cranberry_sauce = jar('#e0304a', '#7a0a1e', function (g) { D.cranberry(g); });
  D.apple_jam = jar('#f2a03a', '#a8501a', D.apple);
  D.marmalade = jar('#ffa52e', '#c85a0a', D.orange);
  D.mango_jam = jar('#ffd24a', '#d8861a', D.mango);
  D.peach_jam = jar('#ffb08a', '#d8604a', D.peach);

  // ---------- yard pieces (128 px a tile) ----------
  function hut(roof, roofDark, wall, wallDark, sign) {
    return function (g, W0, H0) {
      // drawn for 256 x 256, scaled to the piece's size
      var W = 256, H = 256;
      g.save();
      g.scale(W0 / W, H0 / H);
      A.shadow(g, W / 2, H - 16, W / 2 - 18, 14, 0.3);
      // walls
      rrect(g, 26, 112, W - 52, H - 128, 8);
      paint(g, grad(g, 112, H - 16, wall, wallDark), 5);
      // door
      rrect(g, W / 2 - 26, H - 92, 52, 76, 10);
      paint(g, grad(g, H - 92, H - 16, '#b87a44', '#7a4a24'), 4);
      ell(g, W / 2 + 14, H - 54, 4, 4);
      g.fillStyle = '#f2c94c';
      g.fill();
      // window
      rrect(g, 44, 140, 40, 34, 6);
      paint(g, grad(g, 140, 174, '#cfefff', '#7cb8e0'), 4);
      // roof
      g.beginPath();
      g.moveTo(10, 124);
      g.lineTo(W / 2, 28);
      g.lineTo(W - 10, 124);
      g.closePath();
      paint(g, grad(g, 28, 124, roof, roofDark), 5);
      for (var i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(10 + i * 22, 124 - i * 24);
        g.lineTo(W - 10 - i * 22, 124 - i * 24);
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.stroke();
      }
      // the sign: a round board with the workshop's goods on it
      ell(g, W - 64, 156, 30, 30);
      paint(g, grad(g, 126, 186, '#fff2d0', '#e2c48a'), 4);
      g.save();
      g.translate(W - 64, 156);
      g.scale(0.36, 0.36);
      g.translate(-64, -66);
      sign(g);
      g.restore();
      g.restore();
    };
  }
  Y.bakery = hut('#e2503a', '#9a2a1e', '#fff0d8', '#e2c8a0', D.bread);
  Y.dairy = hut('#4a90e0', '#24508a', '#ffffff', '#d8e2ea', D.cheese);
  Y.jam_maker = hut('#8a5a3a', '#5a3420', '#ffe6c8', '#e2b888', D.apple_jam);
  Y.orange_tree = A.yardTree('#4aa83a', '#2a7a2a', '#f7941d');
  Y.mango_tree = A.yardTree('#3f8f3a', '#1f5f2a', '#f2c12e');
  Y.peach_tree = A.yardTree('#7cc85a', '#4a8a3a', '#ff9e7a');
  Y.farm_plot = function (g, W, H) {
    rrect(g, 6, 6, W - 12, H - 12, 18);
    paint(g, grad(g, 6, H - 6, '#c8925a', '#8a5a30'), 6);
    rrect(g, 22, 22, W - 44, H - 44, 10);
    g.fillStyle = grad(g, 22, H - 22, '#8a5a36', '#6a4226');
    g.fill();
    var r = A.rng(5);
    for (var k = 0; k < 120; k++) {
      ell(g, r.range(28, W - 28), r.range(28, H - 28), r.range(2, 5), r.range(1, 3));
      g.fillStyle = r() < 0.5 ? 'rgba(40,20,8,0.35)' : 'rgba(200,150,100,0.3)';
      g.fill();
    }
  };
})();
