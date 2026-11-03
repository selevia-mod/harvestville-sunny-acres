// Drawn icons for farm tech (4 Nov 2026), until generated pictures replace them (art-src/FARMTECH-PROMPTS.md): the
// Copper, Silver and Gold Sprinklers, Fertilizer and Rich Fertilizer (src/00-zzzzzzz-farmtech.js). Runs after draw.js;
// tools/art/icons-fill.js paints them into the items sheet.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, ell = A.ell, paint = A.paint, rrect = A.rrect;
  var D = A.ICON_DRAW;
  var OUT = '#3b2312';

  // a sprinkler: a round foot, a short post, a head with two nozzles, and two arcs of water
  var sprinkler = function (metal) {
    return function (g) {
      // water arcs
      g.lineCap = 'round';
      [[-1, '#7cc8f4'], [1, '#7cc8f4']].forEach(function (a) {
        g.beginPath();
        g.moveTo(64 + a[0] * 18, 40);
        g.quadraticCurveTo(64 + a[0] * 50, 4, 64 + a[0] * 58, 46);
        g.strokeStyle = '#2f7fb8';
        g.lineWidth = 9;
        g.stroke();
        g.strokeStyle = a[1];
        g.lineWidth = 5;
        g.stroke();
      });
      [[10, 56], [118, 56], [20, 70], [108, 70]].forEach(function (d) { ell(g, d[0], d[1], 4, 6); paint(g, '#9fdcff', 2, '#2f7fb8'); });
      // the foot
      ell(g, 64, 106, 40, 13);
      paint(g, lin(g, 0, 94, 0, 120, [[0, metal[1]], [1, metal[2]]]), 5, OUT);
      // the post
      g.beginPath();
      g.rect(56, 52, 16, 52);
      paint(g, lin(g, 56, 0, 72, 0, [[0, metal[0]], [0.5, metal[1]], [1, metal[2]]]), 5, OUT);
      // the head and its nozzles
      rrect(g, 28, 36, 72, 20, 9);
      paint(g, lin(g, 0, 36, 0, 56, [[0, metal[0]], [1, metal[2]]]), 5, OUT);
      ell(g, 64, 46, 13, 13);
      paint(g, metal[1], 4, OUT);
      ell(g, 60, 42, 4, 3);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fill();
    };
  };
  D.sprinkler_copper = sprinkler(['#f4b27a', '#c8743a', '#7a3e18']);
  D.sprinkler_silver = sprinkler(['#ffffff', '#c4ccd6', '#6c7888']);
  D.sprinkler_gold = sprinkler(['#fff2a0', '#f2bf2a', '#9a6a08']);

  // a sack of fertilizer with a label
  var sack = function (cloth, label, rich) {
    return function (g) {
      g.beginPath();
      g.moveTo(34, 30);
      g.quadraticCurveTo(64, 20, 94, 30);
      g.lineTo(104, 104);
      g.quadraticCurveTo(64, 122, 24, 104);
      g.closePath();
      paint(g, lin(g, 0, 24, 0, 118, [[0, cloth[0]], [1, cloth[1]]]), 5, OUT);
      // the tied top
      g.beginPath();
      g.moveTo(40, 30);
      g.quadraticCurveTo(64, 6, 88, 30);
      g.quadraticCurveTo(64, 38, 40, 30);
      paint(g, cloth[0], 4, OUT);
      rrect(g, 52, 24, 24, 8, 3);
      paint(g, '#c89a4a', 3, OUT);
      // the label: a sprout
      ell(g, 64, 74, 26, 22);
      paint(g, label, 4, OUT);
      g.beginPath();
      g.moveTo(64, 90);
      g.lineTo(64, 70);
      g.strokeStyle = '#2f6a22';
      g.lineWidth = 5;
      g.stroke();
      ell(g, 54, 68, 10, 5, -0.5);
      paint(g, '#6fbf4a', 3, '#2f6a22');
      ell(g, 74, 64, 10, 5, 0.5);
      paint(g, '#6fbf4a', 3, '#2f6a22');
      if (rich) { // a sparkle
        g.beginPath();
        [[100, 18], [104, 30], [116, 34], [104, 38], [100, 50], [96, 38], [84, 34], [96, 30]].forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.closePath();
        paint(g, '#ffe066', 3, '#a8740c');
      }
    };
  };
  D.fert = sack(['#c8a070', '#8a6a3a'], '#f4ecd0', false);
  D.fert_rich = sack(['#8a5a3a', '#4e2e1a'], '#ffe9a0', true);
})();
