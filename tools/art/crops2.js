// Drawn stand-ins for the crops added with real-time farming (the generated pictures in art-src/ replace them):
// each crop's growing and ripe plant, its icon and its seed packet, drawn from its plant/shape/colours in
// C.CROPS, and the one withered plant shared by every crop. Called from makeArt (draw.js) before the sheets.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, leaf = A.leaf, LEAF = A.LEAF, mound = A.mound;
  var D = A.ICON_DRAW;

  var shade = function (hex, k) { // lighter (k > 0) or darker (k < 0)
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  };
  var shine = function (g, x, y, rx, ry) {
    ell(g, x, y, rx, ry, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
  };
  var GREEN = { hi: '#b9ef7a', base: '#6cc23f', dark: '#3b8a2a' };
  var palOf = function (c) { return { hi: shade(c, 0.35), base: c, dark: shade(c, -0.35) }; };

  // ---------- the crop itself (centred on x, y; s = scale, 1 = about 100 px across) ----------
  function produce(g, sp, x, y, s) {
    var c = sp.color, c2 = sp.color2;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    switch (sp.shape) {
      case 'round':
        ell(g, 0, 6, 44, 40);
        paint(g, rad(g, -14, -8, 4, 0, 6, 50, [[0, shade(c, 0.45)], [0.6, c], [1, shade(c, -0.3)]]));
        shine(g, -16, -8, 10, 7);
        for (var k = 0; k < 3; k++) leaf(g, 0, -28, 26, 9, -0.8 + k * 0.8, palOf(c2.charAt(0) === '#' && c2 !== '#ffffff' ? c2 : '#6cc23f'));
        break;
      case 'long':
        g.rotate(0.5);
        ell(g, 0, 8, 18, 50);
        paint(g, lin(g, -18, 0, 18, 0, [[0, shade(c, 0.35)], [0.6, c], [1, shade(c, -0.3)]]));
        shine(g, -7, -8, 5, 16);
        rrect(g, -8, -50, 16, 14, 5);
        paint(g, '#5a8a2a', 4);
        break;
      case 'leaf':
        [-1.0, -0.5, 0, 0.5, 1.0].forEach(function (a) { leaf(g, 0, 44, 88, 30, a * 0.8, palOf(c)); });
        ell(g, 0, 40, 26, 10);
        paint(g, shade(c2, 0.2), 4);
        break;
      case 'berry':
        [[-20, 14], [20, 14], [0, -6], [-28, -14], [28, -14], [0, 30], [-10, 6], [12, -26]].forEach(function (p, i) {
          ell(g, p[0], p[1], 15, 15);
          paint(g, rad(g, p[0] - 5, p[1] - 5, 2, p[0], p[1], 16, [[0, shade(c, 0.45)], [1, c]]), 3);
          if (i < 4) shine(g, p[0] - 5, p[1] - 5, 4, 3);
        });
        leaf(g, 0, -34, 26, 10, -0.6, GREEN);
        leaf(g, 0, -34, 26, 10, 0.6, GREEN);
        break;
      case 'pod':
        g.rotate(-0.4);
        g.beginPath();
        g.moveTo(-52, 6);
        g.quadraticCurveTo(0, -36, 52, 6);
        g.quadraticCurveTo(0, 30, -52, 6);
        paint(g, lin(g, 0, -20, 0, 26, [[0, shade(c, 0.35)], [1, c2]]));
        [-30, -10, 10, 30].forEach(function (px) { ell(g, px, 2, 10, 10); paint(g, shade(c, 0.2), 2); });
        break;
      case 'lump':
        g.beginPath();
        g.moveTo(-44, 0);
        g.bezierCurveTo(-46, -34, 10, -40, 40, -18);
        g.bezierCurveTo(56, 0, 40, 34, 0, 34);
        g.bezierCurveTo(-30, 34, -42, 22, -44, 0);
        paint(g, rad(g, -12, -10, 4, 0, 0, 56, [[0, shade(c, 0.35)], [0.7, c], [1, c2]]));
        [[-14, -8], [14, 6], [-2, 18]].forEach(function (p) { ell(g, p[0], p[1], 3, 2); g.fillStyle = c2; g.fill(); });
        break;
      case 'big':
        ell(g, 0, 8, 52, 44);
        paint(g, rad(g, -16, -10, 6, 0, 8, 62, [[0, shade(c, 0.4)], [0.65, c], [1, shade(c, -0.35)]]));
        g.save();
        g.beginPath();
        g.ellipse(0, 8, 52, 44, 0, 0, Math.PI * 2);
        g.clip();
        for (var sx = -40; sx <= 40; sx += 20) { // stripes
          g.beginPath();
          g.ellipse(sx, 8, 6, 46, 0, 0, Math.PI * 2);
          g.fillStyle = shade(c, -0.25);
          g.globalAlpha = 0.45;
          g.fill();
          g.globalAlpha = 1;
        }
        g.restore();
        if (c2 && c2 !== c) { ell(g, 22, 24, 16, 12); paint(g, c2, 3); } // a cut slice for watermelon-like colours
        shine(g, -18, -12, 12, 8);
        rrect(g, -5, -44, 10, 14, 4);
        paint(g, '#6b8a2a', 3);
        break;
      case 'flower':
        g.beginPath();
        g.moveTo(0, 60);
        g.quadraticCurveTo(-6, 20, 0, -10);
        g.lineWidth = 8;
        g.strokeStyle = '#3d8a28';
        g.stroke();
        leaf(g, 0, 40, 40, 14, -0.9, GREEN);
        for (var p = 0; p < 7; p++) {
          var a = p * Math.PI * 2 / 7;
          ell(g, Math.cos(a) * 22, -18 + Math.sin(a) * 22, 15, 22, a + Math.PI / 2);
          paint(g, lin(g, 0, -40, 0, 0, [[0, shade(c, 0.4)], [1, c]]), 3);
        }
        ell(g, 0, -18, 15, 15);
        paint(g, c2, 3);
        break;
      case 'cob':
        A.cornCob(g, 0, 0, 0.9, 0.3);
        break;
      case 'grain':
        for (var i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(i * 6, 56);
          g.quadraticCurveTo(i * 10, 0, i * 18, -40);
          g.lineWidth = 4;
          g.strokeStyle = shade(c2, -0.2);
          g.stroke();
          for (var gy = -42; gy < 0; gy += 9) { ell(g, i * 17 + (gy + 40) * i * 0.1, gy, 5, 8, i * 0.3); paint(g, c, 2); }
        }
        rrect(g, -18, 26, 36, 10, 4);
        paint(g, '#c84a3a', 3);
        break;
      default:
        ell(g, 0, 0, 40, 40);
        paint(g, c);
    }
    g.restore();
  }

  // ---------- the plant in the field (256 x 256, standing on the bottom centre) ----------
  function plant(g, sp, ripe) {
    var c = sp.color, kind = sp.plant;
    if (kind === 'root') {
      mound(g, ripe ? 74 : 62);
      [-1.0, -0.5, 0, 0.5, 1.0].forEach(function (a) { leaf(g, 128, ripe ? 186 : 214, ripe ? 112 : 92, 30, a, LEAF); });
      if (ripe) produce(g, sp, 128, 182, 0.7);
    } else if (kind === 'leafy') {
      mound(g, 70);
      var n = ripe ? 9 : 6, len = ripe ? 100 : 76;
      for (var i = 0; i < n; i++) leaf(g, 128, 214, len, 34, -1.3 + (2.6 * i) / (n - 1), ripe && sp.shape !== 'long' ? palOf(c === '#fff6e0' || c === '#e8f0d0' ? '#7fb85a' : c) : LEAF);
      if (ripe) produce(g, sp, 128, sp.shape === 'leaf' ? 150 : 172, sp.shape === 'leaf' ? 0.9 : 0.8);
    } else if (kind === 'bush' || kind === 'vine') {
      mound(g, 70);
      if (kind === 'vine') { // a stake to climb
        rrect(g, 122, 40, 12, 180, 4);
        paint(g, '#a87a4a', 3);
      }
      var top = kind === 'vine' ? 60 : 100;
      for (var b = 0; b < 8; b++) leaf(g, 128 + (b % 2 ? 14 : -14), 214 - b * ((214 - top) / 8), 60, 22, b % 2 ? 1.0 : -1.0, LEAF);
      if (ripe) {
        var spots = sp.shape === 'berry' ? [[90, 150], [166, 130], [110, 100], [150, 176]] : [[96, 150], [160, 120], [116, 96]];
        spots.forEach(function (q) { produce(g, sp, q[0], q[1], sp.shape === 'berry' ? 0.42 : 0.5); });
      }
    } else if (kind === 'stalk') {
      mound(g, 60);
      [-14, 0, 14].forEach(function (dx, k) {
        g.beginPath();
        g.moveTo(128 + dx, 222);
        g.quadraticCurveTo(128 + dx * 2, 120, 128 + dx * 3, ripe ? 30 : 80);
        g.lineWidth = 9;
        g.strokeStyle = sp.shape === 'grain' ? (ripe ? '#c8a24a' : '#7cbf4a') : '#4f9a33';
        g.stroke();
        leaf(g, 128 + dx * 2, 150 - k * 20, 70, 18, dx < 0 ? -1.0 : 1.0, LEAF);
      });
      if (ripe) produce(g, sp, 128, sp.shape === 'grain' ? 70 : 110, sp.shape === 'grain' ? 0.9 : 0.6);
    } else if (kind === 'ground') {
      mound(g, 84);
      [-1.3, -0.7, 0.7, 1.3, 0].forEach(function (a) { leaf(g, 128, 210, ripe ? 80 : 96, 36, a, LEAF); });
      if (ripe) produce(g, sp, 128, 178, 0.95);
    } else if (kind === 'flower') {
      mound(g, 56);
      if (ripe) produce(g, sp, 128, 140, 1.2);
      else {
        g.beginPath();
        g.moveTo(128, 222);
        g.quadraticCurveTo(122, 160, 128, 110);
        g.lineWidth = 9;
        g.strokeStyle = '#3d8a28';
        g.stroke();
        leaf(g, 128, 190, 60, 20, -0.9, LEAF);
        leaf(g, 128, 170, 60, 20, 0.9, LEAF);
        ell(g, 128, 104, 14, 22);
        paint(g, lin(g, 0, 82, 0, 126, [[0, shade(c, 0.2)], [1, '#5fa84a']]), 4);
      }
    }
  }

  // A crop left too long: brown, drooping stalks.
  function withered(g) {
    mound(g, 66);
    var BROWN = { hi: '#c8a070', base: '#9a7044', dark: '#5a3e22' };
    [-1.6, -1.0, -0.4, 0.5, 1.2, 1.8].forEach(function (a, i) { leaf(g, 128 + (i - 2.5) * 8, 214, 70 + (i % 2) * 18, 20, a, BROWN); });
    g.beginPath();
    g.moveTo(128, 222);
    g.quadraticCurveTo(136, 150, 168, 132);
    g.lineWidth = 7;
    g.strokeStyle = '#6a4a28';
    g.stroke();
  }

  function seedPacket(sp) {
    return function (g) {
      rrect(g, 22, 10, 84, 108, 10);
      paint(g, lin(g, 0, 10, 0, 118, [[0, '#fff6dc'], [1, '#ecd9aa']]), 5);
      g.save();
      g.beginPath();
      g.roundRect(22, 10, 84, 108, 10);
      g.clip();
      g.fillStyle = sp.shape === 'leaf' || sp.color === '#fff6e0' ? '#5fa84a' : sp.color;
      g.fillRect(22, 88, 84, 30);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(22, 10, 84, 14);
      g.restore();
      produce(g, sp, 64, 56, 0.5);
      [[44, 102], [64, 106], [84, 102]].forEach(function (p) {
        ell(g, p[0], p[1], 5, 3.5, 0.4);
        paint(g, '#f3dca8', 2, '#6a4020');
      });
    };
  }

  // Fills in whatever has no art yet: plants for the crops sheet, icons for the crop and its seeds.
  A.prepareCrops = function (sets) {
    var C2 = A.CROP_DRAW;
    Object.keys(sets.CROPS).forEach(function (k) {
      var sp = sets.CROPS[k];
      if (!C2[k]) C2[k] = [null, null, function (g) { plant(g, sp, false); }, function (g) { plant(g, sp, true); }];
      if (!D[sp.item]) D[sp.item] = function (g) { produce(g, sp, 64, 66, 0.92); };
      if (!D['seed_' + k]) D['seed_' + k] = seedPacket(sp);
    });
    A.CROP_WITHERED = withered;
  };
})();
