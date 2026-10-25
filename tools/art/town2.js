// Drawn stand-ins for the bigger Willowbrook (the generated pictures in art-src/ replace them): the new shops
// and homes, the park and beach decorations, the sand of the beach, and icons for the bakery's goods, the
// bouquet and the animal treat. Runs after props.js and extra3.js.
(function () {
  'use strict';
  var A = window.ART, S = A.S, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var P = A.PROP_DRAW, D = A.ICON_DRAW, building = A.building, text = A.propText;
  var grad = function (g, y0, y1, a, b) { return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]); };

  // windows for the common sizes (full-resolution pixels, 256 per tile)
  var WIN = {
    '4x4': [[90, 560, 140, 170], [794, 560, 140, 170]],
    '5x4': [[110, 560, 220, 180], [950, 560, 220, 180]],
    '6x4': [[110, 560, 260, 180], [1166, 560, 260, 180]],
    '6x5': [[130, 720, 240, 220], [1166, 720, 240, 220]],
    '4x5': [[90, 720, 140, 200], [794, 720, 140, 200]],
    '4x3': [[80, 420, 150, 140], [794, 420, 150, 140]],
  };
  var size = function (p) { return Math.round(p.W / S) + 'x' + Math.round(p.H / S); };

  function awning(g, x, y, w, h, a, b) {
    var n = Math.max(4, Math.round(w / 70)), sw = w / n;
    for (var i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(x + i * sw, y);
      g.lineTo(x + (i + 1) * sw, y);
      g.lineTo(x + (i + 1) * sw, y + h - 18);
      g.quadraticCurveTo(x + (i + 0.5) * sw, y + h + 10, x + i * sw, y + h - 18);
      g.closePath();
      paint(g, i % 2 ? b : a, 5);
    }
  }

  // ---------- shops ----------
  P.bakery = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#fff3dc', '#efd8b0'], roof: ['#a86a44', '#7a4428', '#5a2e18'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#ff9ab5', '#e07090'], windows: WIN[size(p)], warm: true, chimney: 960, sign: [640, 400, 400, 110, 'BAKERY'],
      extra: function (g) {
        awning(g, 90, 520, 260, 90, '#ff9ab5', '#ffffff');
        awning(g, 930, 520, 260, 90, '#ff9ab5', '#ffffff');
        [[160, 700], [240, 690], [1000, 700], [1080, 690]].forEach(function (b) { // loaves in the windows
          ell(g, b[0], b[1], 34, 20);
          paint(g, grad(g, b[1] - 20, b[1] + 20, '#f2b46a', '#b8743a'), 4);
        });
      },
    });
  };
  P.florist = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#e8fff2', '#c4ecd6'], roof: ['#ff8ab0', '#e05a88', '#b83a66'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#ffffff', '#dfe6ea'], arch: true, windows: WIN[size(p)], sign: [512, 400, 380, 100, 'FLOWERS'],
      extra: function (g, W, H) {
        for (var i = 0; i < 6; i++) {
          var x = 70 + i * 34, x2 = 784 + i * 34;
          rrect(g, x - 14, H - 100, 28, 30, 6);
          paint(g, '#c8743a', 3);
          A.flower(g, x, H - 112, 16, ['#ff5a7a', '#ffd84d', '#c38bff'][i % 3], '#ffe27a');
          rrect(g, x2 - 14, H - 100, 28, 30, 6);
          paint(g, '#c8743a', 3);
          A.flower(g, x2, H - 112, 16, ['#ffffff', '#ff8ab0', '#ffd84d'][i % 3], '#ffe27a');
        }
      },
    });
  };
  P.post = function (p) {
    return building(p.W, p.H, {
      wall: 'stone', wallCol: ['#d8a080', '#b07050'], roof: ['#4a6ac8', '#2f4c96', '#1f3670'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#3a6ac8', '#284c96'], windows: WIN[size(p)], sign: [640, 400, 380, 110, 'POST'], signCol: ['#e6f0ff', '#b8ccf0'],
      extra: function (g, W, H) {
        rrect(g, 1090, H - 260, 90, 120, 18); // a red post box by the door
        paint(g, grad(g, H - 260, H - 140, '#ff5a4a', '#c8302a'), 6);
        rrect(g, 1104, H - 230, 62, 10, 4);
        g.fillStyle = '#3a1a14';
        g.fill();
        rrect(g, 1120, H - 140, 30, 80, 4);
        paint(g, '#6a6e76', 4);
      },
    });
  };
  P.library = function (p) {
    return building(p.W, p.H, {
      wall: 'stone', wallCol: ['#e6dcc8', '#bcae94'], roof: ['#4a8a5a', '#2f6a3e', '#1f4a2a'], roofTop: 120, eave: 600,
      door: p.door, doorCol: ['#7a4f2a', '#5a3a1e'], windows: WIN[size(p)], warm: true, sign: [768, 560, 520, 110, 'LIBRARY'],
      extra: function (g) {
        [370, 1126].forEach(function (x) {
          rrect(g, x, 660, 40, 560, 12);
          paint(g, grad(g, 660, 1220, '#ffffff', '#c9c4b8'), 6);
        });
        // an open book over the sign
        g.beginPath();
        g.moveTo(768, 470);
        g.quadraticCurveTo(700, 430, 640, 450);
        g.lineTo(640, 510);
        g.quadraticCurveTo(700, 490, 768, 520);
        g.quadraticCurveTo(836, 490, 896, 510);
        g.lineTo(896, 450);
        g.quadraticCurveTo(836, 430, 768, 470);
        g.closePath();
        paint(g, '#fffaf0', 6);
      },
    });
  };
  P.school = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#e5604d', '#b8402e'], roof: ['#8a909a', '#5e646e', '#40464e'], roofTop: 130, eave: 470,
      door: p.door, doorCol: ['#ffffff', '#dfe6ea'], windows: WIN[size(p)], sign: [768, 400, 420, 110, 'SCHOOL'],
      extra: function (g, W) {
        rrect(g, W / 2 - 70, 20, 140, 150, 10); // the bell tower
        paint(g, grad(g, 20, 170, '#ffffff', '#d8d8d8'), 6);
        g.beginPath();
        g.moveTo(W / 2 - 90, 30);
        g.lineTo(W / 2, -40);
        g.lineTo(W / 2 + 90, 30);
        g.closePath();
        paint(g, '#5e646e', 6);
        ell(g, W / 2, 100, 34, 38);
        paint(g, rad(g, W / 2 - 10, 90, 4, W / 2, 100, 40, [[0, '#ffe58a'], [1, '#d4a21e']]), 5);
      },
    });
  };
  P.chapel = function (p) {
    return building(p.W, p.H, {
      wall: 'stone', wallCol: ['#f8f6f0', '#d8d4ca'], roof: ['#6a7a9a', '#4a5a7a', '#33405a'], roofTop: 330, eave: 600,
      door: p.door, doorCol: ['#8a5a30', '#5e3b1b'], arch: true, windows: WIN[size(p)],
      extra: function (g, W) {
        rrect(g, W / 2 - 90, 120, 180, 260, 10); // the steeple
        paint(g, grad(g, 120, 380, '#ffffff', '#d8d4ca'), 6);
        g.beginPath();
        g.moveTo(W / 2 - 110, 130);
        g.lineTo(W / 2, -10);
        g.lineTo(W / 2 + 110, 130);
        g.closePath();
        paint(g, '#4a5a7a', 6);
        ell(g, W / 2, 250, 44, 50);
        paint(g, rad(g, W / 2 - 12, 236, 4, W / 2, 250, 52, [[0, '#ffe58a'], [1, '#d4a21e']]), 5);
        // a round stained-glass window
        ell(g, W / 2, 470, 70, 70);
        paint(g, '#fffaf0', 6);
        ['#ff6b7a', '#ffd84d', '#6cbf57', '#4a90e0'].forEach(function (c, k) {
          g.beginPath();
          g.moveTo(W / 2, 470);
          g.arc(W / 2, 470, 56, k * Math.PI / 2, (k + 1) * Math.PI / 2);
          g.closePath();
          g.fillStyle = c;
          g.fill();
        });
      },
    });
  };
  P.vet = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#ffffff', '#e2eaee'], roof: ['#6cbf57', '#3f8a2f', '#2a6a1f'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#6cbf57', '#3f8a2f'], windows: WIN[size(p)], sign: [640, 400, 340, 110, 'VET'],
      extra: function (g) { // a paw print on the roof
        [[640, 300, 34], [596, 252, 14], [624, 236, 14], [656, 236, 14], [684, 252, 14]].forEach(function (c) {
          ell(g, c[0], c[1], c[2], c[2] * 0.9);
          paint(g, '#ffffff', 4);
        });
      },
    });
  };
  P.shack = function (p) {
    return building(p.W, p.H, {
      wall: 'log', wallCol: ['#e8c08a', '#b88a52'], roof: ['#4ab0e0', '#2a88b8', '#1a6890'], roofTop: 60, eave: 330,
      door: p.door, doorCol: ['#ffffff', '#d8e4ea'], doorH: 230, windows: WIN[size(p)], sign: [512, 270, 300, 90, 'FISH'], signCol: ['#e6f6ff', '#b8dcf0'],
      extra: function (g, W, H) {
        ell(g, 880, H - 150, 60, 24); // a fish on the sign post
        paint(g, '#8ab8d4', 4);
        g.beginPath();
        g.moveTo(930, H - 150);
        g.lineTo(970, H - 180);
        g.lineTo(970, H - 120);
        g.closePath();
        paint(g, '#8ab8d4', 4);
      },
    });
  };
  // the homes on the lane, four colours
  [['#fff0a8', '#ecd270', '#ee7563', '#c23d32', '#8e3128'], ['#cfe6ff', '#a4c8ee', '#5b8fd6', '#2f5fa8', '#1f4a8a'],
    ['#e6d6ff', '#c4acee', '#8a6ac8', '#6a4aa8', '#4a2e88'], ['#ffd8c0', '#f2b494', '#6cbf57', '#3f8a2f', '#2a6a1f']].forEach(function (c, k) {
    P['townhouse_' + (k + 1)] = function (p) {
      return building(p.W, p.H, {
        wall: 'siding', wallCol: [c[0], c[1]], roof: [c[2], c[3], c[4]], roofTop: 90, eave: 470,
        door: p.door, doorCol: ['#fff1dc', '#e2c8a8'], arch: k % 2 === 1, windows: WIN[size(p)], chimney: k % 2 ? 160 : 760,
        extra: function (g, W, H) {
          for (var i = 0; i < 5; i++) A.flower(g, 80 + i * 30, H - 76, 14, ['#ff6b7a', '#ffd84d', '#ffffff'][(i + k) % 3], '#ffe27a');
        },
      });
    };
  });

  // ---------- market, park and beach ----------
  P.wagon = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, W / 2 - 20, 30, 0.35);
      rrect(g, 60, 300, W - 120, 330, 20); // the body
      paint(g, grad(g, 300, 630, '#c98b4f', '#8a5a30'), 8);
      for (var y = 340; y < 630; y += 60) { g.fillStyle = 'rgba(70,40,15,0.35)'; g.fillRect(60, y, W - 120, 6); }
      [[80, 240], [240, 240], [400, 220], [560, 240]].forEach(function (c, i) { // goods on the counter
        rrect(g, c[0], c[1], 120, 70, 12);
        paint(g, ['#ff9a3d', '#6cbf57', '#e5484d', '#ffd84d'][i], 5);
      });
      g.beginPath(); // the canopy
      g.moveTo(30, 230);
      g.quadraticCurveTo(W / 2, -40, W - 30, 230);
      g.closePath();
      paint(g, grad(g, 0, 230, '#e5484d', '#a8302a'), 8);
      awning(g, 30, 200, W - 60, 70, '#ffd84d', '#e5484d');
      [[150, H - 70], [W - 150, H - 70]].forEach(function (w) { // wheels
        ell(g, w[0], w[1], 70, 70);
        paint(g, '#5a3a1e', 8);
        ell(g, w[0], w[1], 22, 22);
        paint(g, '#c98b4f', 5);
      });
    };
  };
  P.gazebo = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 40, W / 2 - 30, 40, 0.3);
      ell(g, W / 2, H - 130, W / 2 - 40, 110); // the floor
      paint(g, grad(g, H - 240, H - 20, '#f2e2c4', '#c8b08a'), 8);
      [140, 330, 694, 884].forEach(function (x) { // posts
        rrect(g, x - 18, 330, 36, H - 470 + (x === 330 || x === 694 ? 60 : 0), 12);
        paint(g, grad(g, 330, H - 100, '#ffffff', '#d8d8d8'), 6);
      });
      g.beginPath(); // the roof
      g.moveTo(60, 360);
      g.lineTo(W / 2, 40);
      g.lineTo(W - 60, 360);
      g.quadraticCurveTo(W / 2, 420, 60, 360);
      g.closePath();
      paint(g, grad(g, 40, 420, '#ee7563', '#a8302a'), 8);
      ell(g, W / 2, 50, 26, 26);
      paint(g, '#ffd84d', 5);
      g.beginPath();
      g.moveTo(120, 560);
      g.quadraticCurveTo(W / 2, 600, W - 120, 560);
      g.lineWidth = 14;
      g.strokeStyle = '#ffffff';
      g.stroke();
    };
  };
  P.playground = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, W / 2 - 20, 30, 0.3);
      // swings
      g.lineCap = 'round';
      g.lineWidth = 22;
      g.strokeStyle = '#4a90e0';
      g.beginPath();
      g.moveTo(60, H - 30);
      g.lineTo(140, 120);
      g.lineTo(440, 120);
      g.lineTo(520, H - 30);
      g.stroke();
      [210, 370].forEach(function (x) {
        g.lineWidth = 5;
        g.strokeStyle = '#6a6e76';
        g.beginPath();
        g.moveTo(x - 30, 120);
        g.lineTo(x - 30, 470);
        g.moveTo(x + 30, 120);
        g.lineTo(x + 30, 470);
        g.stroke();
        rrect(g, x - 46, 460, 92, 24, 8);
        paint(g, '#e5484d', 4);
      });
      // slide
      rrect(g, 640, 200, 30, H - 230, 8);
      paint(g, '#c0c6cc', 4);
      rrect(g, 790, 200, 30, H - 230, 8);
      paint(g, '#c0c6cc', 4);
      rrect(g, 620, 180, 220, 40, 10);
      paint(g, '#ffd84d', 5);
      g.beginPath();
      g.moveTo(820, 200);
      g.quadraticCurveTo(900, 420, 990, H - 50);
      g.lineTo(940, H - 30);
      g.quadraticCurveTo(860, 440, 780, 220);
      g.closePath();
      paint(g, grad(g, 200, H, '#ff9a3d', '#e0741e'), 6);
    };
  };
  function stall(p, a, b, goods) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 10, 22, 0.3);
      rrect(g, 40, 230, W - 80, H - 260, 14);
      paint(g, grad(g, 230, H - 30, '#c98b4f', '#8a5a30'), 6);
      [60, W - 80].forEach(function (x) { rrect(g, x, 60, 20, 200, 6); paint(g, '#7a4f2a', 4); });
      awning(g, 20, 40, W - 40, 110, a, b);
      goods.forEach(function (c, i) {
        ell(g, 120 + i * 70, 220, 34, 26);
        paint(g, c, 4);
      });
    };
  }
  P.fruit_stall = function (p) { return stall(p, '#6cbf57', '#ffffff', ['#e5484d', '#ffd84d', '#ff9a3d', '#9a5ac8', '#6cbf57'].slice(0, 5)); };
  P.cloth_stall = function (p) { return stall(p, '#4a90e0', '#ffffff', ['#ff8ab0', '#4a90e0', '#ffd84d', '#ffffff', '#9a5ac8'].slice(0, 5)); };
  P.statue = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 20, 24, 0.35);
      rrect(g, 60, H - 260, W - 120, 240, 16); // pedestal
      paint(g, grad(g, H - 260, H - 20, '#c8c4bc', '#8e8a82'), 8);
      ell(g, W / 2, 190, 70, 72); // a figure holding up a sheaf of wheat
      paint(g, grad(g, 120, 260, '#dcd8d0', '#a8a49c'), 7);
      rrect(g, W / 2 - 80, 250, 160, 280, 50);
      paint(g, grad(g, 250, 530, '#dcd8d0', '#a8a49c'), 7);
      g.beginPath();
      g.moveTo(W / 2 + 60, 300);
      g.lineTo(W / 2 + 120, 80);
      g.lineWidth = 26;
      g.lineCap = 'round';
      g.strokeStyle = '#bcb8b0';
      g.stroke();
      ell(g, W / 2 + 124, 60, 30, 50);
      paint(g, '#e6c86a', 5);
    };
  };
  P.boat = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      g.beginPath();
      g.moveTo(40, H / 2);
      g.quadraticCurveTo(W / 2, 20, W - 40, H / 2 - 30);
      g.quadraticCurveTo(W - 10, H / 2, W - 40, H / 2 + 30);
      g.quadraticCurveTo(W / 2, H - 20, 40, H / 2);
      g.closePath();
      paint(g, grad(g, 20, H - 20, '#ffffff', '#c8d4dc'), 8);
      g.beginPath();
      g.moveTo(110, H / 2);
      g.quadraticCurveTo(W / 2, 90, W - 110, H / 2 - 20);
      g.quadraticCurveTo(W - 80, H / 2, W - 110, H / 2 + 20);
      g.quadraticCurveTo(W / 2, H - 90, 110, H / 2);
      g.closePath();
      paint(g, grad(g, 90, H - 90, '#c98b4f', '#8a5a30'), 5);
      [W / 2 - 80, W / 2 + 100].forEach(function (x) { rrect(g, x - 16, 120, 32, H - 240, 8); paint(g, '#e8c08a', 4); });
    };
  };
  P.umbrella = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      rrect(g, 60, H - 150, W - 120, 120, 16); // a towel
      paint(g, '#4ab0e0', 5);
      for (var x = 80; x < W - 80; x += 60) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x, H - 150, 24, 120); }
      rrect(g, W / 2 - 8, 120, 16, H - 200, 6);
      paint(g, '#8a8f96', 3);
      g.beginPath();
      g.moveTo(30, 190);
      g.quadraticCurveTo(W / 2, -40, W - 30, 190);
      g.closePath();
      paint(g, grad(g, 0, 190, '#ff5a7a', '#e0305a'), 6);
      g.beginPath();
      g.moveTo(W / 2, 40);
      g.lineTo(W / 2 - 80, 190);
      g.lineTo(W / 2 + 80, 190);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
    };
  };
  P.easel = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      g.lineCap = 'round';
      g.lineWidth = 14;
      g.strokeStyle = '#8a5a30';
      g.beginPath();
      g.moveTo(W / 2, 40);
      g.lineTo(50, H - 20);
      g.moveTo(W / 2, 40);
      g.lineTo(W - 50, H - 20);
      g.moveTo(W / 2, 60);
      g.lineTo(W / 2, H - 40);
      g.stroke();
      rrect(g, 30, 80, W - 60, 220, 8);
      paint(g, '#ffffff', 6);
      rrect(g, 46, 96, W - 92, 120, 4);
      g.fillStyle = '#8ad0f0';
      g.fill();
      ell(g, W / 2 + 30, 250, 50, 30);
      g.fillStyle = '#6cbf57';
      g.fill();
      rrect(g, 20, 290, W - 40, 22, 6);
      paint(g, '#8a5a30', 4);
    };
  };

  // ---------- sand ----------
  A.TILE_DRAW.sand = function () {
    var c = A.canvas(S, S), g = c.getContext('2d'), r = A.rng(331);
    g.fillStyle = '#f0d9a0';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 140; i++) {
      ell(g, r.range(0, S), r.range(0, S), r.range(2, 5), r.range(2, 4));
      g.fillStyle = r() < 0.5 ? 'rgba(190,150,90,0.45)' : 'rgba(255,250,230,0.6)';
      g.fill();
    }
    return c;
  };

  // ---------- icons ----------
  D.bread = function (g) {
    ell(g, 64, 72, 50, 32);
    paint(g, grad(g, 40, 104, '#f2b46a', '#a8642e'), 5);
    [40, 60, 80].forEach(function (x) {
      g.beginPath();
      g.moveTo(x, 54);
      g.lineTo(x + 14, 72);
      g.lineWidth = 6;
      g.strokeStyle = '#ffe2b0';
      g.stroke();
    });
  };
  D.cookie = function (g) {
    [[48, 70], [80, 58]].forEach(function (c) {
      ell(g, c[0], c[1], 32, 30);
      paint(g, grad(g, c[1] - 30, c[1] + 30, '#f2c88a', '#c8904a'), 5);
      [[-10, -6], [8, -10], [4, 10], [-12, 12]].forEach(function (d) {
        ell(g, c[0] + d[0], c[1] + d[1], 5, 5);
        g.fillStyle = '#5a3420';
        g.fill();
      });
    });
  };
  D.cake = function (g) {
    rrect(g, 20, 58, 88, 50, 12);
    paint(g, grad(g, 58, 108, '#fff6e8', '#f2d8b8'), 5);
    rrect(g, 20, 76, 88, 10, 3);
    g.fillStyle = '#ff8ab0';
    g.fill();
    rrect(g, 16, 44, 96, 22, 11);
    paint(g, '#ffffff', 5);
    [36, 64, 92].forEach(function (x) { A.strawberry(g, x, 36, 0.32); });
  };
  D.bouquet = function (g) {
    g.beginPath();
    g.moveTo(46, 70);
    g.lineTo(64, 118);
    g.lineTo(82, 70);
    g.closePath();
    paint(g, grad(g, 70, 118, '#ffe9f0', '#f2b8c8'), 5);
    [[44, 52, '#ff5a7a'], [64, 40, '#ffd84d'], [84, 52, '#c38bff'], [54, 66, '#ffffff'], [76, 66, '#ff8ab0']].forEach(function (f) {
      A.flower(g, f[0], f[1], 15, f[2], '#ffe27a');
    });
  };
  D.treat = function (g) { // a bone-shaped biscuit
    g.save();
    g.translate(64, 64);
    g.rotate(-0.5);
    rrect(g, -34, -12, 68, 24, 10);
    paint(g, grad(g, -12, 12, '#f2c88a', '#c8904a'), 5);
    [[-38, -10], [-38, 10], [38, -10], [38, 10]].forEach(function (c) {
      ell(g, c[0], c[1], 14, 14);
      paint(g, '#e8b878', 5);
    });
    g.restore();
    A.star(g, 100, 28, 12, 4, '#ffe36a');
  };
})();
