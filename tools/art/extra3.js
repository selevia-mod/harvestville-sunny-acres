// Drawn stand-ins for the pig, the carabao and the farmer girl (the generated pictures in art-src/ replace
// them), and icons for truffles and carabao milk. Runs after extra2.js.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var D = A.ICON_DRAW;

  // a recoloured cow: pink and small for the pig, dark grey with horns for the carabao
  var PIG = 'grayscale(1) sepia(1) hue-rotate(300deg) saturate(2.2) brightness(1.15)';
  var CARABAO = 'grayscale(1) brightness(0.55) contrast(1.2)';
  function tinted(g, filter, draw) {
    g.save();
    g.filter = filter;
    draw();
    g.restore();
  }
  A.pig = function (g, pose) {
    tinted(g, PIG, function () {
      g.translate(192, 300);
      g.scale(0.72, 0.72);
      g.translate(-192, -300);
      A.cow(g, pose);
    });
  };
  function horns(g, x, y, s) {
    g.beginPath();
    g.moveTo(x - 6 * s, y);
    g.quadraticCurveTo(x - 40 * s, y - 6 * s, x - 34 * s, y - 34 * s);
    g.quadraticCurveTo(x - 24 * s, y - 14 * s, x + 6 * s, y - 6 * s);
    g.closePath();
    paint(g, '#efe6d2', 4);
  }
  A.carabao = function (g, pose) {
    tinted(g, CARABAO, function () { A.cow(g, pose); });
    if (pose !== 3) horns(g, pose === 2 ? 84 : 92, pose === 2 ? 210 : 112, 1.3);
  };
  // ---------- effect pieces (128x128), used until a generated picture replaces them ----------
  var OUTLINE = '#4a2e18';
  function shape(g, pts, fill, line) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.closePath();
    paint(g, fill, 5, line);
  }
  function blob(g, parts, top, bottom, line) {
    parts.forEach(function (b) {
      ell(g, b[0], b[1], b[2], b[3]);
      paint(g, lin(g, 0, b[1] - b[3], 0, b[1] + b[3], [[0, top], [1, bottom]]), 5, line);
    });
  }
  var ROCKS = [
    [[30, 70], [52, 38], [92, 34], [104, 66], [80, 94], [40, 92]],
    [[34, 52], [70, 30], [100, 56], [86, 92], [44, 90]],
    [[26, 88], [64, 28], [102, 88]],
    [[38, 46], [90, 40], [96, 84], [44, 90]],
  ];
  A.FX_DRAW = {
    stone: function (g, k) {
      var pts = ROCKS[k];
      shape(g, pts, lin(g, 0, 28, 0, 96, [[0, '#d5d9de'], [0.55, '#9aa1aa'], [1, '#6f7680']]), OUTLINE);
      g.beginPath();
      g.moveTo(pts[0][0] + 10, pts[0][1] - 4);
      g.lineTo(pts[1][0], pts[1][1] + 8);
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.stroke();
    },
    dirt: function (g, k) {
      var sets = [[[64, 66, 34, 28]], [[64, 70, 40, 20]], [[48, 66, 26, 24], [82, 72, 20, 18]], [[64, 66, 24, 22]]];
      blob(g, sets[k], '#b07a45', '#6e4524', OUTLINE);
    },
    wood: function (g, k) {
      var pts = [[[20, 96], [96, 24], [108, 36], [32, 106]], [[30, 40], [98, 52], [90, 88], [36, 78]], [[34, 92], [64, 26], [98, 92]], [[30, 60], [100, 50], [96, 80], [34, 86]]][k];
      shape(g, pts, lin(g, 0, 24, 0, 106, [[0, '#f3d29a'], [1, '#c48945']]), OUTLINE);
    },
    leaf: function (g, k) {
      g.save();
      g.translate(64, 64);
      g.rotate([-0.6, 0.4, -1.1, 0.9][k]);
      g.beginPath();
      g.moveTo(-44, 0);
      g.quadraticCurveTo(0, -36, 44, 0);
      g.quadraticCurveTo(0, 36, -44, 0);
      paint(g, lin(g, 0, -30, 0, 30, [[0, '#9be06a'], [1, '#4f9a36']]), 5, '#2f5a1e');
      g.beginPath();
      g.moveTo(-40, 0);
      g.lineTo(38, 0);
      g.lineWidth = 3;
      g.strokeStyle = '#2f5a1e';
      g.stroke();
      g.restore();
    },
    water: function (g, k) {
      var blue = lin(g, 0, 20, 0, 108, [[0, '#bfe8ff'], [1, '#3e9be0']]);
      if (k === 0) {
        g.beginPath();
        g.moveTo(64, 14);
        g.quadraticCurveTo(100, 64, 92, 84);
        g.arc(64, 82, 28, 0.1, Math.PI - 0.1);
        g.quadraticCurveTo(28, 64, 64, 14);
        paint(g, blue, 5, '#1f6fb5');
      } else if (k === 1) {
        ell(g, 64, 64, 30, 30);
        paint(g, blue, 5, '#1f6fb5');
      } else if (k === 2) {
        shape(g, [[16, 100], [28, 60], [42, 86], [56, 44], [70, 84], [86, 50], [98, 86], [112, 62], [112, 100]], blue, '#1f6fb5');
      } else {
        ell(g, 64, 64, 54, 22);
        g.lineWidth = 12;
        g.strokeStyle = '#7cc8f5';
        g.stroke();
      }
      ell(g, 54, 54, 6, 9);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      if (k < 2) g.fill();
    },
    dust: function (g, k) {
      var sets = [[[64, 64, 34, 30]], [[44, 70, 26, 20], [84, 70, 26, 20], [64, 56, 28, 22]], [[64, 48, 26, 24], [64, 80, 32, 24]], [[64, 66, 22, 20]]];
      blob(g, sets[k], '#fbf3e4', '#e3d2b4', '#b08a5a');
    },
  };

  A.girlFilter = 'hue-rotate(300deg) saturate(1.1)'; // the boy's red and blue become pink and lilac

  D.pig = function (g) {
    g.save();
    g.translate(-60, -40);
    g.scale(0.62, 0.62);
    A.pig(g, 2);
    g.restore();
  };
  D.carabao = function (g) {
    g.save();
    g.translate(-4, 8);
    g.scale(0.34, 0.34);
    A.carabao(g, 2);
    g.restore();
  };
  D.truffle = function (g) {
    [[64, 74, 40, 34], [44, 66, 20, 18], [84, 62, 22, 20], [62, 52, 24, 18]].forEach(function (b) {
      ell(g, b[0], b[1], b[2], b[3]);
      paint(g, lin(g, 0, b[1] - b[3], 0, b[1] + b[3], [[0, '#7a5638'], [1, '#3b2618']]), 5);
    });
    [[52, 78], [70, 86], [80, 70], [58, 62]].forEach(function (p) {
      ell(g, p[0], p[1], 4, 3);
      g.fillStyle = 'rgba(255,230,200,0.35)';
      g.fill();
    });
    A.star(g, 102, 28, 12, 4, '#ffe36a');
  };
  D.carabao_milk = function (g) {
    D.milk(g);
    rrect(g, 34, 70, 60, 34, 6);
    paint(g, '#8a6f5a', 4);
    g.font = 'bold 22px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText('MILK', 64, 88);
    horns(g, 46, 22, 0.6);
    g.save();
    g.translate(128, 0);
    g.scale(-1, 1);
    horns(g, 46, 22, 0.6);
    g.restore();
  };
})();
