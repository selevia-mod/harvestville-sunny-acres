// Drawn stand-ins for Phase 3 (the generated pictures in art-src/ replace them): the travelling trader and her
// tent, and icons for the Power-Up and the Pet Meal. Runs after people.js and props.js.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var D = A.ICON_DRAW, P = A.PROP_DRAW;
  var grad = function (g, y0, y1, a, b) { return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]); };

  A.LOOKS.trader = { skin: ['#e8b48c', '#c88c66'], hair: ['#2a1e18', '#140c08'], style: 'long', shirt: ['#fff1c8', '#e6d29a'], outfit: 'coat', coat: ['#8a4ac8', '#6a2ea8'], pants: ['#a8743f', '#7a4e26'], hat: 'beanie', hatColor: ['#ff9a3d', '#e0741e'], satchel: true, shoes: '#5a3420' };

  P.trader_tent = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 20, 26, 0.35);
      rrect(g, 60, 250, W - 120, H - 280, 14); // the counter
      paint(g, grad(g, 250, H - 30, '#c98b4f', '#8a5a30'), 8);
      [['#9a5ac8', 120], ['#ffd84d', 260], ['#4ab0e0', 400], ['#e5484d', 540]].forEach(function (c) { // goods
        ell(g, c[1], 240, 46, 30);
        paint(g, c[0], 5);
      });
      A.star(g, 640, 220, 34, 12, '#ffe36a');
      g.beginPath(); // the tent roof, striped purple and gold
      g.moveTo(20, 210);
      g.lineTo(W / 2, 10);
      g.lineTo(W - 20, 210);
      g.closePath();
      paint(g, grad(g, 10, 210, '#8a4ac8', '#5a2a8a'), 8);
      for (var i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(W / 2, 14);
        g.lineTo(60 + i * 150, 206);
        g.lineTo(120 + i * 150, 206);
        g.closePath();
        g.fillStyle = 'rgba(255,216,77,0.85)';
        g.fill();
      }
      ell(g, W / 2, 12, 16, 16);
      paint(g, '#ffd84d', 4);
    };
  };

  D.power_up = function (g) { // a glowing bottle with a lightning bolt
    ell(g, 64, 70, 46, 46);
    g.fillStyle = 'rgba(255,230,90,0.35)';
    g.fill();
    rrect(g, 40, 46, 48, 66, 16);
    paint(g, grad(g, 46, 112, '#ff9a3d', '#e0441e'), 5);
    rrect(g, 52, 24, 24, 26, 6);
    paint(g, '#c8d4dc', 4);
    g.beginPath();
    g.moveTo(68, 56);
    g.lineTo(54, 82);
    g.lineTo(64, 82);
    g.lineTo(58, 104);
    g.lineTo(76, 74);
    g.lineTo(66, 74);
    g.closePath();
    paint(g, '#ffe36a', 3);
  };
  D.pet_meal = function (g) { // a bowl heaped with food and a bone
    ell(g, 64, 92, 50, 20);
    paint(g, grad(g, 72, 112, '#e5484d', '#a8302a'), 5);
    ell(g, 64, 80, 44, 14);
    paint(g, rad(g, 60, 74, 4, 64, 80, 44, [[0, '#d49a5a'], [1, '#8a5a30']]), 4);
    g.save();
    g.translate(64, 56);
    g.rotate(-0.4);
    rrect(g, -26, -8, 52, 16, 7);
    paint(g, '#fff6e8', 4);
    [[-28, -7], [-28, 7], [28, -7], [28, 7]].forEach(function (c) { ell(g, c[0], c[1], 9, 9); paint(g, '#fff6e8', 4); });
    g.restore();
    A.star(g, 104, 26, 12, 4, '#ffe36a');
  };
})();
