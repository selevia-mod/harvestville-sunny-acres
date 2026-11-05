// Drawn icons for the players' ideas (5 Nov 2026, src/00-zzzzzzzz-players.js) until generated pictures replace them:
// Sikwate and Chocolate Cake. (The seven new crops' icons and seed packets are drawn from their colours by crops2.js.)
// Runs after draw.js; tools/art/icons-fill.js paints them into the items sheet.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, ell = A.ell, paint = A.paint, rrect = A.rrect;
  var D = A.ICON_DRAW;
  var OUT = '#3d2614';

  D.sikwate = function (g) { // a cup of thick hot chocolate, steaming
    rrect(g, 26, 46, 62, 62, 14);
    paint(g, lin(g, 26, 0, 88, 0, [[0, '#fff4e2'], [1, '#e2cdb0']]));
    g.beginPath();
    g.arc(92, 76, 16, -Math.PI / 2, Math.PI / 2);
    g.lineWidth = 10;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#fff4e2';
    g.stroke();
    ell(g, 57, 50, 27, 8);
    paint(g, '#6a3a1a', 3);
    ell(g, 50, 48, 9, 3);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    [44, 58, 72].forEach(function (x, i) {
      g.beginPath();
      g.moveTo(x, 36);
      g.bezierCurveTo(x - 8, 28, x + 8, 22, x, 12 + i * 2);
      g.stroke();
    });
  };

  D.chocolate_cake = function (g) {
    rrect(g, 20, 58, 88, 50, 12);
    paint(g, lin(g, 0, 58, 0, 108, [[0, '#8a4a22'], [1, '#5a2e14']]), 5, OUT);
    rrect(g, 20, 78, 88, 8, 3);
    g.fillStyle = '#e8b06a';
    g.fill();
    rrect(g, 16, 44, 96, 22, 11);
    paint(g, '#4a2412', 5, OUT);
    [36, 64, 92].forEach(function (x) {
      ell(g, x, 40, 7, 7);
      paint(g, '#e0405a', 3, OUT);
    });
  };
})();
