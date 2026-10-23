// More 128x128 icons: upgraded tools, materials, ores, fish, forage, dishes, weather and odds and ends.
// Runs after draw.js and adds to window.ART.ICON_DRAW.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, OUT = A.OUT;
  var D = A.ICON_DRAW;

  // metal colours for tool levels: basic steel, copper, silver, gold
  var METAL = [
    ['#f1f4f7', '#b9c1ca', '#7f8893'],
    ['#ffd2a8', '#e08a4a', '#9a4f22'],
    ['#ffffff', '#dfe8f2', '#9aa9bb'],
    ['#fff6c0', '#f4c133', '#b8860b'],
  ];

  function handle(g, x0, y0, x1, y1, w) {
    var a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    g.save();
    g.translate(x0, y0);
    g.rotate(a);
    rrect(g, 0, -w / 2, len, w, w / 2);
    paint(g, lin(g, 0, -w / 2, 0, w / 2, [[0, '#e5ac6d'], [1, '#935a2f']]), 5);
    g.restore();
  }

  function shine(g, x, y, l) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + l, y + l * 0.35);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.stroke();
  }

  function hoeIcon(m) {
    return function (g) {
      handle(g, 22, 112, 92, 34, 14);
      g.beginPath();
      g.moveTo(78, 14);
      g.lineTo(120, 30);
      g.quadraticCurveTo(118, 62, 100, 74);
      g.quadraticCurveTo(96, 50, 70, 34);
      g.closePath();
      paint(g, lin(g, 78, 14, 110, 70, [[0, m[0]], [0.5, m[1]], [1, m[2]]]), 5);
      shine(g, 84, 24, 24);
      ell(g, 80, 32, 10, 10);
      paint(g, m[2], 4);
    };
  }

  function canIcon(m, body) {
    return function (g) {
      g.beginPath();
      g.arc(52, 42, 26, Math.PI, 0);
      g.lineWidth = 9;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = body[1];
      g.stroke();
      g.beginPath();
      g.moveTo(80, 76);
      g.lineTo(112, 44);
      g.lineTo(120, 52);
      g.lineTo(88, 92);
      g.closePath();
      paint(g, lin(g, 80, 50, 120, 90, [[0, body[0]], [1, body[2]]]), 5);
      ell(g, 116, 46, 10, 14, -0.8);
      paint(g, body[1], 5);
      rrect(g, 20, 46, 66, 66, 14);
      paint(g, lin(g, 20, 0, 86, 0, [[0, body[0]], [0.6, body[1]], [1, body[2]]]), 5);
      rrect(g, 20, 66, 66, 10, 3);
      paint(g, m[1], 3);
      rrect(g, 30, 54, 12, 40, 6);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
    };
  }

  function axeIcon(m) {
    return function (g) {
      handle(g, 24, 112, 84, 22, 14);
      g.beginPath();
      g.moveTo(66, 20);
      g.quadraticCurveTo(96, 6, 116, 30);
      g.quadraticCurveTo(110, 62, 92, 72);
      g.lineTo(74, 46);
      g.closePath();
      paint(g, lin(g, 66, 10, 116, 70, [[0, m[0]], [0.5, m[1]], [1, m[2]]]), 5);
      shine(g, 82, 20, 22);
    };
  }

  function hammerIcon(m) {
    return function (g) {
      handle(g, 24, 112, 80, 40, 14);
      g.save();
      g.translate(84, 36);
      g.rotate(-0.95);
      rrect(g, -34, -16, 68, 32, 8);
      paint(g, lin(g, 0, -16, 0, 16, [[0, m[0]], [0.5, m[1]], [1, m[2]]]), 5);
      shine(g, -26, -8, 30);
      g.restore();
    };
  }

  function sickleIcon(m) {
    return function (g) {
      handle(g, 30, 114, 54, 70, 14);
      g.beginPath();
      g.moveTo(50, 74);
      g.bezierCurveTo(40, 30, 76, 6, 112, 22);
      g.bezierCurveTo(84, 22, 62, 40, 62, 78);
      g.closePath();
      paint(g, lin(g, 40, 10, 112, 80, [[0, m[0]], [0.5, m[1]], [1, m[2]]]), 5);
    };
  }

  var CAN_BODY = [
    ['#7dd0ee', '#46a7d1', '#2e86ad'],
    ['#ffc79a', '#e08a4a', '#9a4f22'],
    ['#f4f8fc', '#c9d4e0', '#8f9fb3'],
    ['#fff3a0', '#f2c53d', '#b8860b'],
  ];
  for (var lvl = 1; lvl <= 3; lvl++) {
    D['hoe_' + lvl] = hoeIcon(METAL[lvl]);
    D['can_' + lvl] = canIcon(METAL[lvl], CAN_BODY[lvl]);
    D['axe_' + lvl] = axeIcon(METAL[lvl]);
    D['hammer_' + lvl] = hammerIcon(METAL[lvl]);
    D['sickle_' + lvl] = sickleIcon(METAL[lvl]);
  }
  D.axe = axeIcon(METAL[0]);
  D.hammer = hammerIcon(METAL[0]);
  D.sickle = sickleIcon(METAL[0]);

  D.brush = function (g) {
    g.save();
    g.translate(64, 64);
    g.rotate(-0.5);
    rrect(g, -46, -22, 92, 34, 14);
    paint(g, lin(g, 0, -22, 0, 12, [[0, '#d9a066'], [1, '#93582d']]), 5);
    for (var x = -38; x <= 38; x += 10) {
      rrect(g, x - 3, 12, 6, 20, 2);
      paint(g, '#f2e2b8', 2);
    }
    g.restore();
  };

  D.milker = function (g) {
    g.beginPath();
    g.moveTo(26, 40);
    g.lineTo(102, 40);
    g.lineTo(92, 116);
    g.lineTo(36, 116);
    g.closePath();
    paint(g, lin(g, 26, 0, 102, 0, [[0, '#f4f8fc'], [0.5, '#c9d4e0'], [1, '#8f9fb3']]));
    g.beginPath();
    g.arc(64, 40, 38, Math.PI, 0);
    g.lineWidth = 8;
    g.strokeStyle = OUT;
    g.stroke();
    ell(g, 64, 40, 38, 10);
    paint(g, '#ffffff', 5);
    rrect(g, 34, 72, 60, 16, 6);
    paint(g, '#4aa3e8', 4);
  };

  D.rod = function (g) {
    g.beginPath();
    g.moveTo(18, 116);
    g.quadraticCurveTo(60, 70, 116, 14);
    g.lineWidth = 10;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#c98b4f';
    g.stroke();
    g.beginPath();
    g.moveTo(116, 14);
    g.lineTo(112, 92);
    g.lineWidth = 2;
    g.strokeStyle = '#ffffff';
    g.stroke();
    ell(g, 40, 96, 12, 12);
    paint(g, '#9aa3ad', 4);
    ell(g, 112, 98, 8, 8);
    paint(g, '#e5383f', 4);
  };

  D.lumber = function (g) {
    [[64, 92], [40, 70], [88, 70]].forEach(function (p, i) {
      rrect(g, p[0] - 40, p[1] - 14, 80, 28, 14);
      paint(g, lin(g, 0, p[1] - 14, 0, p[1] + 14, [[0, '#c98b4f'], [1, '#865a2e']]));
      ell(g, p[0] + 34, p[1], 10, 13);
      paint(g, '#f2cf96', 4);
      ell(g, p[0] + 34, p[1], 4, 5);
      g.fillStyle = 'rgba(140,90,40,0.6)';
      g.fill();
      void i;
    });
  };

  function rock(g, x, y, r, fill) {
    g.beginPath();
    g.moveTo(x - r, y + r * 0.6);
    g.quadraticCurveTo(x - r * 1.1, y - r * 0.4, x - r * 0.3, y - r * 0.8);
    g.quadraticCurveTo(x + r * 0.6, y - r * 1.0, x + r, y - r * 0.1);
    g.quadraticCurveTo(x + r * 1.05, y + r * 0.6, x + r * 0.4, y + r * 0.75);
    g.closePath();
    paint(g, fill || rad(g, x - r * 0.3, y - r * 0.4, 2, x, y, r * 1.2, [[0, '#e8ecef'], [0.55, '#aab2bb'], [1, '#737c86']]));
  }

  D.stone = function (g) {
    rock(g, 44, 82, 30);
    rock(g, 84, 86, 26);
    rock(g, 64, 56, 28);
  };

  function oreIcon(c1, c2) {
    return function (g) {
      rock(g, 64, 70, 46, rad(g, 50, 52, 2, 64, 70, 56, [[0, '#a7a09a'], [1, '#5f5852']]));
      [[46, 58, 9], [76, 64, 11], [58, 86, 8], [86, 88, 7], [40, 82, 6]].forEach(function (n) {
        ell(g, n[0], n[1], n[2], n[2] * 0.8, 0.4);
        paint(g, rad(g, n[0] - 3, n[1] - 3, 1, n[0], n[1], n[2], [[0, c1], [1, c2]]), 3);
      });
    };
  }
  D.ore_copper = oreIcon('#ffc79a', '#c4661e');
  D.ore_silver = oreIcon('#ffffff', '#9fb4cc');
  D.ore_gold = oreIcon('#fff3a0', '#e0a21e');

  D.gem = function (g) {
    g.beginPath();
    g.moveTo(36, 44);
    g.lineTo(92, 44);
    g.lineTo(112, 62);
    g.lineTo(64, 116);
    g.lineTo(16, 62);
    g.closePath();
    paint(g, lin(g, 16, 44, 112, 116, [[0, '#e9b8ff'], [0.5, '#a54fe0'], [1, '#5e1f99']]));
    g.beginPath();
    g.moveTo(16, 62);
    g.lineTo(112, 62);
    g.moveTo(36, 44);
    g.lineTo(50, 62);
    g.lineTo(64, 116);
    g.lineTo(78, 62);
    g.lineTo(92, 44);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.stroke();
    A.star(g, 98, 30, 12, 4, '#ffffff');
  };

  function fishIcon(len, body, belly, fin, crown) {
    return function (g) {
      g.save();
      g.translate(54, 66);
      g.rotate(-0.3);
      var l = len * 0.74, h = len * 0.33;
      g.beginPath();
      g.moveTo(l * 0.52, 0);
      g.lineTo(l * 0.8, -h * 0.75);
      g.lineTo(l * 0.8, h * 0.75);
      g.closePath();
      paint(g, fin, 5);
      ell(g, 0, 0, l * 0.55, h);
      paint(g, lin(g, 0, -h, 0, h, [[0, body], [0.6, body], [1, belly]]));
      ell(g, -l * 0.32, -h * 0.2, 6, 6);
      g.fillStyle = OUT;
      g.fill();
      ell(g, -l * 0.33, -h * 0.25, 2, 2);
      g.fillStyle = '#fff';
      g.fill();
      g.beginPath();
      g.moveTo(-l * 0.1, -h * 0.9);
      g.quadraticCurveTo(l * 0.1, -h * 1.5, l * 0.25, -h * 0.85);
      paint(g, fin, 4);
      g.restore();
      if (crown) A.star(g, 98, 26, 14, 5, '#ffe36a');
    };
  }
  D.fish_s = fishIcon(70, '#7cc3ea', '#e6f6ff', '#4a90c9');
  D.fish_m = fishIcon(94, '#9bbf5a', '#eef3d2', '#6a8f2a');
  D.fish_l = fishIcon(116, '#f08a4a', '#ffe6cc', '#c4561e');
  D.fish_k = fishIcon(116, '#c38bff', '#ffe6f8', '#ff6b9a', true);

  D.herb = function (g) {
    g.beginPath();
    g.moveTo(64, 120);
    g.quadraticCurveTo(60, 70, 64, 20);
    g.lineWidth = 7;
    g.strokeStyle = '#3d8a28';
    g.stroke();
    [[-0.9, 96], [0.9, 86], [-0.8, 62], [0.8, 52], [0, 30]].forEach(function (l) {
      A.leaf(g, 64, l[1], 36, 14, l[0], A.LEAF);
    });
  };

  D.berry = function (g) {
    A.leaf(g, 64, 40, 34, 14, -0.8, A.LEAF);
    A.leaf(g, 64, 40, 34, 14, 0.8, A.LEAF);
    [[50, 64], [78, 64], [64, 82], [44, 88], [84, 88], [64, 104]].forEach(function (b) {
      ell(g, b[0], b[1], 15, 15);
      paint(g, rad(g, b[0] - 5, b[1] - 5, 1, b[0], b[1], 15, [[0, '#c9a6ff'], [1, '#5a2a99']]), 4);
    });
  };

  D.mushroom = function (g) {
    rrect(g, 50, 66, 28, 50, 12);
    paint(g, lin(g, 50, 0, 78, 0, [[0, '#fff8ea'], [1, '#e2d2b4']]));
    g.beginPath();
    g.moveTo(14, 72);
    g.quadraticCurveTo(14, 16, 64, 16);
    g.quadraticCurveTo(114, 16, 114, 72);
    g.closePath();
    paint(g, lin(g, 0, 16, 0, 72, [[0, '#e76a3a'], [1, '#a83c1e']]));
    [[40, 42, 8], [72, 32, 7], [90, 56, 6], [56, 58, 5]].forEach(function (d) {
      ell(g, d[0], d[1], d[2], d[2] * 0.8);
      g.fillStyle = '#fff4e0';
      g.fill();
    });
  };

  D.root = function (g) {
    g.beginPath();
    g.moveTo(64, 30);
    g.bezierCurveTo(96, 40, 90, 86, 70, 110);
    g.lineTo(60, 116);
    g.bezierCurveTo(40, 90, 34, 44, 64, 30);
    paint(g, lin(g, 30, 30, 96, 110, [[0, '#f3dcae'], [1, '#c49a5e']]));
    [[54, 60], [72, 76], [58, 92]].forEach(function (l) {
      g.beginPath();
      g.moveTo(l[0] - 8, l[1]);
      g.lineTo(l[0] + 8, l[1] + 3);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(120,80,40,0.6)';
      g.stroke();
    });
    A.leaf(g, 64, 32, 30, 10, -0.5, A.DARK_LEAF);
    A.leaf(g, 64, 32, 30, 10, 0.5, A.DARK_LEAF);
  };

  // ---------- dishes ----------
  function plate(g) {
    ell(g, 64, 86, 56, 26);
    paint(g, lin(g, 0, 60, 0, 112, [[0, '#ffffff'], [1, '#d9e2ec']]));
    ell(g, 64, 84, 40, 17);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(150,170,190,0.6)';
    g.stroke();
  }

  function bowl(g, soup, bits) {
    ell(g, 64, 62, 52, 18);
    paint(g, lin(g, 0, 44, 0, 80, [[0, soup[0]], [1, soup[1]]]));
    g.beginPath();
    g.moveTo(12, 62);
    g.quadraticCurveTo(16, 116, 64, 116);
    g.quadraticCurveTo(112, 116, 116, 62);
    g.quadraticCurveTo(64, 82, 12, 62);
    paint(g, lin(g, 0, 62, 0, 116, [[0, '#ffffff'], [1, '#c9d4e0']]));
    (bits || []).forEach(function (b) {
      ell(g, b[0], b[1], b[2], b[2] * 0.7);
      paint(g, b[3], 2.5);
    });
  }

  function steam(g) {
    [44, 64, 84].forEach(function (x) {
      g.beginPath();
      g.moveTo(x, 40);
      g.bezierCurveTo(x - 10, 28, x + 10, 22, x, 8);
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.stroke();
    });
  }

  D.boiled_egg = function (g) {
    plate(g);
    [44, 84].forEach(function (x) {
      ell(g, x, 78, 20, 15);
      paint(g, '#ffffff', 4);
      ell(g, x, 78, 9, 8);
      paint(g, '#ffc23d', 3);
    });
  };
  D.hot_milk = function (g) {
    rrect(g, 28, 40, 60, 72, 12);
    paint(g, lin(g, 28, 0, 88, 0, [[0, '#ffffff'], [1, '#d9e2ec']]));
    g.beginPath();
    g.arc(92, 76, 18, -Math.PI / 2, Math.PI / 2);
    g.lineWidth = 10;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#ffffff';
    g.stroke();
    ell(g, 58, 44, 26, 7);
    paint(g, '#fff8ea', 3);
    steam(g);
  };
  D.baked_potato = function (g) {
    plate(g);
    A.potato(g, 64, 76, 0.75, -0.1);
    rrect(g, 52, 58, 24, 14, 4);
    paint(g, '#fff0a0', 3);
  };
  D.jam = function (g) {
    rrect(g, 30, 38, 68, 78, 14);
    paint(g, lin(g, 30, 0, 98, 0, [[0, '#ff6b7a'], [1, '#b51e2a']]));
    rrect(g, 26, 22, 76, 20, 6);
    paint(g, '#f2e2b8', 4);
    rrect(g, 40, 62, 48, 30, 6);
    paint(g, '#fff6dc', 3);
    A.strawberry(g, 64, 78, 0.22);
  };
  D.tomato_soup = function (g) { bowl(g, ['#ff7a5c', '#d9452b'], [[50, 60, 6, '#ffffff'], [76, 64, 5, '#7bc043']]); steam(g); };
  D.grilled_fish = function (g) {
    plate(g);
    D.fish_m(g);
    [50, 64, 78].forEach(function (x) {
      g.beginPath();
      g.moveTo(x - 6, 58);
      g.lineTo(x + 6, 74);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(70,40,20,0.7)';
      g.stroke();
    });
  };
  D.veggie_stew = function (g) { bowl(g, ['#c98447', '#8c5326'], [[46, 60, 8, '#ff9a3d'], [66, 56, 7, '#f3dcae'], [84, 62, 6, '#7bc043']]); steam(g); };
  D.pumpkin_pie = function (g) {
    plate(g);
    g.beginPath();
    g.moveTo(24, 84);
    g.lineTo(100, 60);
    g.quadraticCurveTo(108, 80, 100, 96);
    g.closePath();
    paint(g, lin(g, 24, 60, 100, 96, [[0, '#ffb04a'], [1, '#d9741e']]));
    g.beginPath();
    g.moveTo(100, 60);
    g.quadraticCurveTo(108, 80, 100, 96);
    g.lineWidth = 9;
    g.strokeStyle = '#e8c48a';
    g.stroke();
    ell(g, 70, 72, 10, 6);
    paint(g, '#ffffff', 2);
  };
  D.mushroom_soup = function (g) { bowl(g, ['#f3e3bf', '#c9a66b'], [[50, 60, 7, '#a0643a'], [78, 62, 6, '#a0643a']]); steam(g); };
  D.sandwich = function (g) {
    g.beginPath();
    g.moveTo(14, 96);
    g.lineTo(64, 40);
    g.lineTo(114, 96);
    g.closePath();
    paint(g, lin(g, 0, 40, 0, 96, [[0, '#f6d38f'], [1, '#d9a052']]));
    g.beginPath();
    g.moveTo(22, 96);
    g.lineTo(106, 96);
    g.lineTo(100, 106);
    g.lineTo(28, 106);
    g.closePath();
    paint(g, '#7bc043', 4);
    g.beginPath();
    g.moveTo(26, 106);
    g.lineTo(102, 106);
    g.lineTo(96, 116);
    g.lineTo(32, 116);
    g.closePath();
    paint(g, '#e5484d', 4);
  };
  D.hot_soup = function (g) { bowl(g, ['#ffd27a', '#e0a52a'], [[52, 60, 7, '#7bc043'], [76, 62, 6, '#ff9a3d']]); steam(g); };
  D.tonic = function (g) {
    rrect(g, 52, 10, 24, 26, 4);
    paint(g, '#c98b4f', 4);
    g.beginPath();
    g.moveTo(52, 34);
    g.lineTo(76, 34);
    g.quadraticCurveTo(108, 60, 100, 116);
    g.lineTo(28, 116);
    g.quadraticCurveTo(20, 60, 52, 34);
    paint(g, lin(g, 28, 34, 100, 116, [[0, '#b9ef7a'], [1, '#3b8a2a']]));
    A.leaf(g, 64, 96, 30, 12, 0.3, { hi: '#ffffff', base: '#e8ffd0', dark: '#a8d88a' });
  };

  D.egg_l = function (g) {
    A.egg(g, 64, 68, 1.18);
    A.star(g, 100, 28, 13, 4, '#ffe36a');
  };
  D.milk_l = function (g) {
    D.milk(g);
    A.star(g, 100, 28, 13, 4, '#ffe36a');
    rrect(g, 34, 70, 60, 34, 6);
    paint(g, '#f4c133', 4);
    g.font = 'bold 22px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#7a3d1a';
    g.fillText('MILK', 64, 88);
  };
  D.seed_grass = function (g) {
    rrect(g, 22, 10, 84, 108, 10);
    paint(g, lin(g, 0, 10, 0, 118, [[0, '#fff6dc'], [1, '#ecd9aa']]), 5);
    g.save();
    g.beginPath();
    g.roundRect(22, 10, 84, 108, 10);
    g.clip();
    g.fillStyle = '#5fa84a';
    g.fillRect(22, 88, 84, 30);
    g.restore();
    for (var i = 0; i < 7; i++) {
      var x = 36 + i * 9;
      g.beginPath();
      g.moveTo(x - 4, 80);
      g.quadraticCurveTo(x, 50, x + (i % 2 ? 8 : -6), 30);
      g.quadraticCurveTo(x + 2, 56, x + 4, 80);
      paint(g, i % 2 ? '#6cc23f' : '#4f9a33', 2.5);
    }
  };
  D.blue_feather = function (g) {
    g.save();
    g.translate(64, 64);
    g.rotate(0.6);
    g.beginPath();
    g.moveTo(0, -56);
    g.bezierCurveTo(30, -36, 26, 30, 0, 50);
    g.bezierCurveTo(-26, 30, -30, -36, 0, -56);
    paint(g, lin(g, 0, -56, 0, 50, [[0, '#bfe6ff'], [0.5, '#4a90e2'], [1, '#2a4fa0']]));
    g.beginPath();
    g.moveTo(0, -46);
    g.lineTo(0, 62);
    g.lineWidth = 4;
    g.strokeStyle = '#1f3570';
    g.stroke();
    for (var y = -34; y < 40; y += 12) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(16, y - 8);
      g.moveTo(0, y);
      g.lineTo(-16, y - 8);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.stroke();
    }
    g.restore();
  };
  D.miracle = function (g) {
    g.beginPath();
    g.arc(64, 78, 38, 0, Math.PI * 2);
    paint(g, rad(g, 52, 64, 4, 64, 78, 40, [[0, '#ffd6ea'], [1, '#e0559a']]));
    rrect(g, 50, 18, 28, 26, 4);
    paint(g, '#f2e2b8', 4);
    D.heart(g);
  };

  // ---------- weather ----------
  function cloud(g, dark) {
    [[44, 58, 26], [70, 48, 32], [92, 62, 22], [64, 66, 26]].forEach(function (c) {
      ell(g, c[0], c[1], c[2], c[2]);
      paint(g, dark ? '#7f8a99' : '#ffffff', 0);
    });
    rrect(g, 20, 54, 92, 34, 17);
    paint(g, lin(g, 0, 20, 0, 88, dark ? [[0, '#9aa5b4'], [1, '#5c6675']] : [[0, '#ffffff'], [1, '#d9e4ef']]), 5);
  }
  D.rain = function (g) {
    cloud(g, false);
    [[40, 100], [64, 108], [88, 100]].forEach(function (d) {
      ell(g, d[0], d[1], 6, 10);
      paint(g, '#4aa3e8', 3);
    });
  };
  D.storm = function (g) {
    cloud(g, true);
    g.beginPath();
    g.moveTo(70, 80);
    g.lineTo(54, 104);
    g.lineTo(66, 104);
    g.lineTo(56, 124);
    g.lineTo(82, 96);
    g.lineTo(70, 96);
    g.lineTo(78, 80);
    g.closePath();
    paint(g, '#ffd23f', 4);
  };
  D.snow = function (g) {
    cloud(g, false);
    [[40, 104], [64, 112], [88, 104]].forEach(function (d) { A.star(g, d[0], d[1], 9, 3, '#bfe6ff'); });
  };

  // ---------- odds and ends ----------
  D.ribbon = function (g) {
    [[-0.4, 44], [0.4, 84]].forEach(function (t) {
      g.save();
      g.translate(t[1], 84);
      g.rotate(t[0]);
      g.beginPath();
      g.moveTo(-12, 0);
      g.lineTo(12, 0);
      g.lineTo(12, 40);
      g.lineTo(0, 30);
      g.lineTo(-12, 40);
      g.closePath();
      paint(g, '#2a6fd0', 4);
      g.restore();
    });
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      ell(g, 64 + Math.cos(a) * 30, 56 + Math.sin(a) * 30, 12, 12);
      paint(g, '#4a90e2', 3);
    }
    ell(g, 64, 56, 26, 26);
    paint(g, '#ffe36a', 4);
    A.star(g, 64, 56, 14, 6, '#ffffff');
  };
  D.bobber = function (g) {
    ell(g, 64, 70, 30, 30);
    paint(g, '#ffffff');
    g.save();
    g.beginPath();
    g.arc(64, 70, 30, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#e5383f';
    g.fillRect(30, 36, 70, 34);
    g.restore();
    ell(g, 64, 70, 30, 30);
    g.lineWidth = 5;
    g.strokeStyle = OUT;
    g.stroke();
    rrect(g, 60, 20, 8, 22, 3);
    paint(g, '#5a3a1e', 3);
  };
  D.exclaim = function (g) {
    D.bubble(g);
    rrect(g, 54, 22, 20, 46, 8);
    paint(g, '#e5383f', 4);
    ell(g, 64, 84, 11, 11);
    paint(g, '#e5383f', 4);
  };
  D.gift = function (g) {
    rrect(g, 20, 52, 88, 64, 8);
    paint(g, lin(g, 0, 52, 0, 116, [[0, '#ff8aa4'], [1, '#e0557a']]));
    rrect(g, 14, 38, 100, 22, 6);
    paint(g, '#ff9ab5');
    g.fillStyle = '#ffe36a';
    g.fillRect(56, 38, 16, 78);
    [[-1, 0], [1, 0]].forEach(function (d) {
      ell(g, 64 + d[0] * 18, 30, 18, 11, d[0] * 0.5);
      paint(g, '#ffe36a', 4);
    });
  };
  D.calendar = function (g) {
    rrect(g, 18, 22, 92, 92, 10);
    paint(g, '#ffffff');
    rrect(g, 18, 22, 92, 26, 10);
    paint(g, '#e5484d');
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
      rrect(g, 28 + c * 20, 56 + r * 18, 12, 10, 2);
      g.fillStyle = r === 1 && c === 2 ? '#e5484d' : '#c9d4e0';
      g.fill();
    }
  };
  D.note = function (g) {
    g.beginPath();
    g.moveTo(48, 96);
    g.lineTo(48, 24);
    g.lineTo(100, 14);
    g.lineTo(100, 86);
    g.lineWidth = 12;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 6;
    g.strokeStyle = '#4a90e2';
    g.stroke();
    ell(g, 36, 98, 18, 14, -0.3);
    paint(g, '#4a90e2');
    ell(g, 88, 88, 18, 14, -0.3);
    paint(g, '#4a90e2');
  };
  D.dog = function (g) {
    g.save();
    g.translate(-10, -20);
    g.scale(0.4, 0.4);
    A.dog(g, 2);
    g.restore();
  };
  D.ring = function (g) {
    ell(g, 64, 78, 36, 32);
    g.lineWidth = 16;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 10;
    g.strokeStyle = '#f4c133';
    g.stroke();
    g.beginPath();
    g.moveTo(48, 40);
    g.lineTo(80, 40);
    g.lineTo(90, 28);
    g.lineTo(64, 8);
    g.lineTo(38, 28);
    g.closePath();
    paint(g, lin(g, 38, 8, 90, 40, [[0, '#e6f9ff'], [1, '#7cc3ea']]), 4);
  };
  D.lunch = function (g) {
    rrect(g, 14, 50, 100, 62, 12);
    paint(g, lin(g, 0, 50, 0, 112, [[0, '#ff9ab5'], [1, '#e0557a']]));
    rrect(g, 14, 50, 100, 18, 8);
    paint(g, '#ffd6e2', 4);
    g.beginPath();
    g.arc(64, 50, 20, Math.PI, 0);
    g.lineWidth = 8;
    g.strokeStyle = OUT;
    g.stroke();
    A.flower(g, 64, 88, 14, '#ffffff', '#ffe27a');
  };
})();
