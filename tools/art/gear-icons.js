// Drawn icons for Hunter's gear (3 Nov 2026), until generated pictures replace them: the Camo Cloak, the Quiet Boots
// and the Big Quiver (src/00-zzzzhunt.js). Runs after draw.js; tools/art/icons-fill.js paints them into the items sheet.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, ell = A.ell, paint = A.paint;
  var D = A.ICON_DRAW;
  var OUT = '#4a2e18';

  D.gear_cloak = function (g) {
    // a hooded cape, green with darker leaf spots
    g.beginPath();
    g.moveTo(64, 14);
    g.bezierCurveTo(88, 14, 96, 34, 92, 48);
    g.bezierCurveTo(104, 70, 112, 96, 116, 116);
    g.quadraticCurveTo(64, 126, 12, 116);
    g.bezierCurveTo(16, 96, 24, 70, 36, 48);
    g.bezierCurveTo(32, 34, 40, 14, 64, 14);
    g.closePath();
    paint(g, lin(g, 0, 14, 0, 120, [[0, '#7aa04a'], [1, '#4e7430']]), 5, OUT);
    g.save();
    g.clip();
    [[40, 70, 10, 6, 0.6], [78, 64, 12, 7, -0.4], [58, 92, 13, 7, 0.2], [92, 98, 10, 6, 0.9], [30, 100, 9, 5, -0.7], [66, 40, 8, 5, 0.3]].forEach(function (l) {
      ell(g, l[0], l[1], l[2], l[3], l[4]);
      g.fillStyle = '#3a5a22';
      g.fill();
    });
    g.restore();
    // the face opening of the hood
    ell(g, 64, 40, 15, 13);
    paint(g, '#2a3a18', 3, OUT);
    // a wooden toggle
    ell(g, 64, 60, 6, 4);
    paint(g, '#c08a4a', 3, OUT);
  };

  D.gear_boots = function (g) {
    var boot = function (x, flip) {
      g.save();
      g.translate(x, 0);
      if (flip) { g.translate(0, 0); g.scale(-1, 1); }
      g.beginPath();
      g.moveTo(-14, 22);
      g.lineTo(14, 22);
      g.lineTo(16, 82);
      g.quadraticCurveTo(44, 84, 46, 100);
      g.lineTo(46, 108);
      g.lineTo(-16, 108);
      g.closePath();
      paint(g, lin(g, 0, 22, 0, 108, [[0, '#a8794a'], [1, '#7a5230']]), 5, OUT);
      // a soft sole
      g.beginPath();
      g.moveTo(-17, 104);
      g.lineTo(47, 104);
      g.quadraticCurveTo(48, 114, 44, 116);
      g.lineTo(-15, 116);
      g.closePath();
      paint(g, '#5a4a3a', 4, OUT);
      // the fold at the top, and laces
      g.beginPath();
      g.rect(-16, 18, 32, 14);
      paint(g, '#c8a070', 4, OUT);
      g.strokeStyle = '#efe0c0';
      g.lineWidth = 3;
      [46, 58, 70].forEach(function (y) { g.beginPath(); g.moveTo(-6, y); g.lineTo(8, y + 4); g.stroke(); });
      g.restore();
    };
    boot(38, false);
    boot(92, true);
  };

  D.gear_quiver = function (g) {
    // the arrows' feathers, then the quiver over them
    [[46, -0.18, '#d8503a'], [62, -0.05, '#f0c040'], [78, 0.08, '#d8503a'], [92, 0.2, '#f0c040']].forEach(function (a) {
      g.save();
      g.translate(a[0], 40);
      g.rotate(a[1]);
      g.fillStyle = '#7a5a3a';
      g.fillRect(-2, -8, 4, 40);
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(8, -6);
      g.lineTo(0, -10);
      g.lineTo(-8, -6);
      g.closePath();
      paint(g, a[2], 3, OUT);
      g.restore();
    });
    g.save();
    g.translate(66, 78);
    g.rotate(0.06);
    g.beginPath();
    g.moveTo(-34, -34);
    g.lineTo(34, -34);
    g.lineTo(26, 44);
    g.quadraticCurveTo(0, 52, -26, 44);
    g.closePath();
    paint(g, lin(g, 0, -34, 0, 48, [[0, '#9a6a3a'], [1, '#6a4422']]), 5, OUT);
    g.beginPath();
    g.rect(-36, -40, 72, 12);
    paint(g, '#c89a5a', 4, OUT);
    g.beginPath();
    g.rect(-30, 6, 60, 9);
    paint(g, '#c89a5a', 3, OUT);
    g.restore();
  };
})();
