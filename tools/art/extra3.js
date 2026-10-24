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
