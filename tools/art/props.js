// Props: house furniture, town buildings, plaza and festival decorations. Each is drawn in full 256-per-tile
// space and stored at half size. Sizes and door columns come from tools/tiles.js (PROPS).
(function () {
  'use strict';
  var A = window.ART, S = A.S, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, OUT = A.OUT;

  function g2(stops, x0, y0, x1, y1, g) {
    return lin(g, x0, y0, x1, y1, stops.map(function (c, i) { return [i / (stops.length - 1), c]; }));
  }

  function text(g, str, x, y, size, fill, stroke) {
    g.font = 'bold ' + size + 'px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (stroke) {
      g.lineWidth = size / 8;
      g.strokeStyle = stroke;
      g.strokeText(str, x, y);
    }
    g.fillStyle = fill;
    g.fillText(str, x, y);
  }

  function windowPane(g, x, y, w, h, warm) {
    rrect(g, x, y, w, h, 12);
    paint(g, '#fffaf0', 8);
    rrect(g, x + 14, y + 14, w - 28, h - 28, 6);
    paint(g, lin(g, 0, y, 0, y + h, warm ? [[0, '#ffe7a3'], [1, '#e0a24a']] : [[0, '#d7f1ff'], [1, '#7cc3ea']]), 4);
    g.fillStyle = '#fffaf0';
    g.fillRect(x + w / 2 - 5, y + 14, 10, h - 28);
    g.fillRect(x + 14, y + h / 2 - 5, w - 28, 10);
    if (!warm) {
      g.beginPath();
      g.moveTo(x + 22, y + h - 24);
      g.lineTo(x + w * 0.45, y + 20);
      g.lineTo(x + w * 0.62, y + 20);
      g.lineTo(x + 40, y + h - 24);
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fill();
    }
  }

  function door(g, cx, bottom, w, h, col, arch, double) {
    g.beginPath();
    g.moveTo(cx - w / 2 - 16, bottom);
    g.lineTo(cx - w / 2 - 16, bottom - h + (arch ? w / 2 : 0));
    if (arch) g.arc(cx, bottom - h + w / 2, w / 2 + 16, Math.PI, 0);
    else g.lineTo(cx + w / 2 + 16, bottom - h);
    g.lineTo(cx + w / 2 + 16, bottom);
    g.closePath();
    paint(g, '#fffaf0', 8);
    g.beginPath();
    g.moveTo(cx - w / 2, bottom);
    g.lineTo(cx - w / 2, bottom - h + (arch ? w / 2 : 16));
    if (arch) g.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0);
    else g.lineTo(cx + w / 2, bottom - h + 16);
    g.lineTo(cx + w / 2, bottom);
    g.closePath();
    paint(g, lin(g, cx - w / 2, 0, cx + w / 2, 0, [[0, col[0]], [1, col[1]]]), 8);
    if (double) {
      g.fillStyle = 'rgba(40,20,10,0.6)';
      g.fillRect(cx - 3, bottom - h + 30, 6, h - 30);
    }
    ell(g, cx + (double ? 22 : w / 2 - 26), bottom - h * 0.42, 11, 11);
    paint(g, rad(g, cx, bottom - h * 0.45, 2, cx + 20, bottom - h * 0.42, 12, [[0, '#fff3a0'], [1, '#d4a01e']]), 4);
  }

  function gableRoof(g, W, top, eave, col, inset, scallop) {
    var path = function () {
      g.beginPath();
      g.moveTo(10, eave);
      g.lineTo(W - 10, eave);
      g.lineTo(W - inset, top);
      g.lineTo(inset, top);
      g.closePath();
    };
    path();
    g.fillStyle = lin(g, 0, top, 0, eave, [[0, col[0]], [1, col[1]]]);
    g.fill();
    g.save();
    path();
    g.clip();
    for (var row = 0, y = top + 34; y < eave + 20; y += 50, row++) {
      for (var x = -40 + (row % 2) * 40; x < W + 40; x += 80) {
        g.beginPath();
        if (scallop) g.arc(x, y, 38, 0.1 * Math.PI, 0.9 * Math.PI);
        else { g.moveTo(x - 40, y + 10); g.lineTo(x + 40, y + 10); }
        g.lineWidth = 6;
        g.strokeStyle = col[2];
        g.stroke();
      }
    }
    g.restore();
    path();
    g.lineWidth = 8;
    g.strokeStyle = OUT;
    g.stroke();
    rrect(g, inset - 16, top - 22, W - inset * 2 + 32, 44, 22);
    paint(g, lin(g, 0, top - 22, 0, top + 22, [[0, col[0]], [1, col[2]]]), 8);
    rrect(g, 4, eave - 14, W - 8, 30, 14);
    paint(g, col[1], 8);
  }

  function walls(g, x, y, w, h, style, col) {
    g.beginPath();
    g.rect(x, y, w, h);
    paint(g, lin(g, 0, y, 0, y + h, [[0, col[0]], [1, col[1]]]), 8);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    var r = A.rng(x + y + w);
    if (style === 'siding') {
      for (var sy = y + 40; sy < y + h; sy += 42) { g.fillStyle = 'rgba(150,110,60,0.3)'; g.fillRect(x, sy, w, 5); }
    } else if (style === 'timber') {
      g.fillStyle = '#7a4f2a';
      for (var tx = x; tx <= x + w; tx += 128) g.fillRect(tx - 8, y, 16, h);
      g.fillRect(x, y + h / 2 - 8, w, 16);
      g.beginPath();
      for (var bx = x; bx < x + w; bx += 128) { g.moveTo(bx, y + h / 2); g.lineTo(bx + 128, y); }
      g.lineWidth = 12;
      g.strokeStyle = '#7a4f2a';
      g.stroke();
    } else if (style === 'stone') {
      for (var ry = y; ry < y + h; ry += 48) {
        for (var rx = x - (ry / 48 % 2) * 40; rx < x + w; rx += 80) {
          rrect(g, rx + 4, ry + 4, 72, 40, 10);
          g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
          g.fill();
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(40,40,40,0.35)';
          g.stroke();
        }
      }
    } else if (style === 'log') {
      for (var ly = y; ly < y + h; ly += 44) {
        rrect(g, x - 20, ly + 2, w + 40, 40, 20);
        g.fillStyle = lin(g, 0, ly, 0, ly + 44, [[0, col[0]], [1, col[1]]]);
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(60,30,10,0.45)';
        g.stroke();
      }
    }
    g.restore();
    g.fillStyle = 'rgba(60,30,10,0.2)';
    g.fillRect(x, y, w, 40);
  }

  function signBoard(g, cx, cy, w, h, str, col) {
    rrect(g, cx - w / 2, cy - h / 2, w, h, 18);
    paint(g, lin(g, 0, cy - h / 2, 0, cy + h / 2, [[0, col ? col[0] : '#fff1c8'], [1, col ? col[1] : '#efcf8e']]), 8);
    text(g, str, cx, cy + 2, h * 0.55, '#7a3d1a', '#fff8e0');
  }

  function footing(g, W, H) {
    rrect(g, 20, H - 60, W - 40, 52, 12);
    paint(g, lin(g, 0, H - 60, 0, H - 8, [[0, '#b9bec4'], [1, '#868c94']]), 8);
  }

  // A town building in the farmhouse style; o.door is [col, width] in tiles, centred on those columns.
  function building(W, H, o) {
    return function (g) {
      A.shadow(g, W / 2, H - 16, W / 2, 30, 0.35);
      var roofTop = o.roofTop || 60, eave = o.eave || Math.round(H * 0.45);
      if (o.chimney) {
        rrect(g, o.chimney, roofTop - 30, 100, eave - roofTop, 8);
        paint(g, lin(g, o.chimney, 0, o.chimney + 100, 0, [[0, '#9a8f86'], [1, '#6e655e']]), 8);
      }
      walls(g, 40, eave - 10, W - 80, H - eave - 50, o.wall, o.wallCol);
      gableRoof(g, W, roofTop, eave, o.roof, o.inset || 120, o.scallop !== false);
      (o.windows || []).forEach(function (w) { windowPane(g, w[0], w[1], w[2], w[3], o.warm); });
      footing(g, W, H);
      var dc = (o.door[0] + o.door[1] / 2) * S;
      door(g, dc, H - 56, o.door[1] > 1 ? 200 : 150, o.doorH || 280, o.doorCol || ['#b8743f', '#86502a'], o.arch, o.door[1] > 1);
      rrect(g, dc - (o.door[1] > 1 ? 130 : 100), H - 64, o.door[1] > 1 ? 260 : 200, 56, 12);
      paint(g, lin(g, 0, H - 64, 0, H - 8, [[0, '#d5d8dc'], [1, '#9ea4ab']]), 8);
      if (o.sign) signBoard(g, o.sign[0], o.sign[1], o.sign[2], o.sign[3], o.sign[4], o.signCol);
      if (o.extra) o.extra(g, W, H, eave);
    };
  }

  var D = {};

  // ---------- town buildings ----------
  D.mayor = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#f5ecd8', '#e2d2b0'], roof: ['#5b8fd6', '#2f5fa8', '#1f4a8a'], roofTop: 120, eave: 600,
      door: p.door, doorCol: ['#7a4f2a', '#5a3a1e'], windows: [[130, 720, 240, 220], [1166, 720, 240, 220]], arch: false,
      sign: [768, 560, 520, 110, 'TOWN HALL'],
      extra: function (g, W) {
        [370, 1166].forEach(function (x) {
          rrect(g, x, 640, 40, 600, 12);
          paint(g, lin(g, x, 0, x + 40, 0, [[0, '#ffffff'], [1, '#c9c9c9']]), 6);
        });
        rrect(g, W / 2 - 6, 0, 12, 150, 4);
        paint(g, '#8a8f96', 4);
        g.beginPath();
        g.moveTo(W / 2 + 6, 8);
        g.lineTo(W / 2 + 120, 34);
        g.lineTo(W / 2 + 6, 62);
        g.closePath();
        paint(g, '#e5484d', 5);
      },
    });
  };

  D.inn = function (p) {
    return building(p.W, p.H, {
      wall: 'timber', wallCol: ['#fff6e8', '#eedfc4'], roof: ['#c9623e', '#9a3d22', '#73260f'], roofTop: 100, eave: 520,
      door: p.door, doorCol: ['#a0643a', '#6e4122'], arch: true, warm: true, chimney: 1180,
      windows: [[110, 620, 220, 200], [1206, 620, 220, 200], [110, 900, 220, 180], [1206, 900, 220, 180]],
      sign: [768, 440, 420, 120, 'INN'],
      extra: function (g) {
        [[300, 860], [1236, 860]].forEach(function (l) {
          rrect(g, l[0], l[1], 10, 60, 3);
          paint(g, '#3b2312', 3);
          ell(g, l[0] + 5, l[1] + 76, 22, 28);
          paint(g, rad(g, l[0] + 5, l[1] + 76, 2, l[0] + 5, l[1] + 76, 28, [[0, '#fff6c0'], [1, '#f2a91e']]), 5);
        });
      },
    });
  };

  D.forge = function (p) {
    return building(p.W, p.H, {
      wall: 'stone', wallCol: ['#a7a9ad', '#7c7f85'], roof: ['#4a4f58', '#2f333a', '#1e2126'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#6e4122', '#4a2a14'], warm: true, chimney: 900,
      windows: [[110, 560, 220, 180], [950, 560, 220, 180]], sign: [640, 400, 380, 110, 'FORGE'], signCol: ['#ffd8a0', '#e0a050'],
      extra: function (g, W, H) {
        [[960, 40, 40], [1010, 0, 30], [930, -10, 24]].forEach(function (c) {
          ell(g, c[0], c[1] + 40, c[2], c[2]);
          g.fillStyle = 'rgba(220,220,220,0.75)';
          g.fill();
        });
        // anvil
        g.beginPath();
        g.moveTo(980, H - 150);
        g.lineTo(1180, H - 150);
        g.lineTo(1140, H - 110);
        g.lineTo(1110, H - 110);
        g.lineTo(1120, H - 70);
        g.lineTo(1040, H - 70);
        g.lineTo(1050, H - 110);
        g.lineTo(1000, H - 110);
        g.closePath();
        paint(g, lin(g, 0, H - 150, 0, H - 70, [[0, '#8a8f96'], [1, '#3a3e44']]), 6);
      },
    });
  };

  D.woodshop = function (p) {
    return building(p.W, p.H, {
      wall: 'log', wallCol: ['#c98b4f', '#93582d'], roof: ['#6cbf57', '#3f8a2f', '#2a6a1f'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#d39a5c', '#93592e'], windows: [[110, 560, 220, 180], [950, 560, 220, 180]],
      sign: [640, 400, 420, 110, 'WOODSHOP'],
      extra: function (g, W, H) {
        for (var i = 0; i < 3; i++) {
          for (var k = 0; k < 3 - i; k++) {
            var cx = 1060 + k * 70 + i * 35, cy = H - 110 - i * 60;
            ell(g, cx, cy, 32, 32);
            paint(g, rad(g, cx, cy, 2, cx, cy, 32, [[0, '#f2cf96'], [1, '#c9955a']]), 5);
          }
        }
      },
    });
  };

  D.clinic = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#ffffff', '#e6ecef'], roof: ['#7fd6c2', '#3fa896', '#2a8070'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#7fd6c2', '#3fa896'], windows: [[90, 560, 140, 170], [794, 560, 140, 170]],
      sign: [512, 400, 380, 100, 'CLINIC'],
      extra: function (g) {
        A.leaf(g, 512, 330, 60, 26, -0.4, A.LEAF);
        A.leaf(g, 512, 330, 60, 26, 0.4, A.LEAF);
      },
    });
  };

  D.cottage = function (p) {
    return building(p.W, p.H, {
      wall: 'siding', wallCol: ['#ffd6e2', '#f2b4c8'], roof: ['#ee7563', '#c23d32', '#8e3128'], roofTop: 90, eave: 470,
      door: p.door, doorCol: ['#fff1dc', '#e2c8a8'], arch: true, windows: [[90, 560, 140, 170], [794, 560, 140, 170]],
      extra: function (g, W, H) {
        for (var i = 0; i < 7; i++) A.flower(g, 70 + i * 24, H - 76, 15, ['#ff6b7a', '#ffd84d', '#ffffff'][i % 3], '#ffe27a');
        for (var k = 0; k < 7; k++) A.flower(g, 790 + k * 24, H - 76, 15, ['#c38bff', '#ffd84d', '#ff9ad5'][k % 3], '#ffe27a');
      },
    });
  };

  D.cabin = function (p) {
    return building(p.W, p.H, {
      wall: 'log', wallCol: ['#b77a45', '#7d4a26'], roof: ['#7f8fa6', '#55657c', '#3b4a5e'], roofTop: 60, eave: 330,
      door: p.door, doorCol: ['#8a5a30', '#5e3b1b'], doorH: 230, windows: [[80, 420, 150, 140], [794, 420, 150, 140]],
      extra: function (g, W, H) {
        // fishing net by the door
        g.save();
        g.translate(870, H - 220);
        for (var i = 0; i < 6; i++) {
          g.beginPath();
          g.moveTo(i * 16, 0);
          g.lineTo(i * 16 + 30, 120);
          g.moveTo(0, i * 20);
          g.lineTo(100, i * 20 + 10);
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(240,230,200,0.85)';
          g.stroke();
        }
        g.restore();
      },
    });
  };

  D.mine_entrance = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2, 28, 0.35);
      g.beginPath();
      g.moveTo(10, H - 20);
      g.lineTo(40, 200);
      g.quadraticCurveTo(140, 40, 380, 50);
      g.quadraticCurveTo(620, 10, 820, 90);
      g.quadraticCurveTo(1000, 160, 1014, H - 20);
      g.closePath();
      paint(g, lin(g, 0, 40, 0, H, [[0, '#a29a90'], [1, '#6a625a']]), 8);
      var r = A.rng(301);
      for (var i = 0; i < 14; i++) {
        ell(g, r.range(80, 940), r.range(120, H - 120), r.range(30, 70), r.range(20, 40));
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
        g.fill();
      }
      // tunnel
      var dc = (p.door[0] + p.door[1] / 2) * S;
      g.beginPath();
      g.moveTo(dc - 190, H - 30);
      g.lineTo(dc - 190, H - 330);
      g.quadraticCurveTo(dc, H - 470, dc + 190, H - 330);
      g.lineTo(dc + 190, H - 30);
      g.closePath();
      paint(g, rad(g, dc, H - 120, 20, dc, H - 200, 260, [[0, '#000000'], [1, '#2a211b']]), 8);
      // wooden frame
      [[dc - 210, 30], [dc + 180, 30]].forEach(function (b) {
        rrect(g, b[0], H - 380, b[1], 350, 8);
        paint(g, lin(g, b[0], 0, b[0] + 30, 0, [[0, '#c98b4f'], [1, '#7d4a26']]), 6);
      });
      rrect(g, dc - 230, H - 400, 460, 40, 10);
      paint(g, lin(g, 0, H - 400, 0, H - 360, [[0, '#c98b4f'], [1, '#7d4a26']]), 6);
      rrect(g, dc + 220, H - 330, 10, 60, 3);
      paint(g, '#3b2312', 3);
      ell(g, dc + 225, H - 250, 22, 28);
      paint(g, rad(g, dc + 225, H - 250, 2, dc + 225, H - 250, 28, [[0, '#fff6c0'], [1, '#f2a91e']]), 5);
      signBoard(g, dc, H - 470, 300, 80, 'MINE');
    };
  };

  D.fountain = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 70, W / 2 - 30, 60, 0.3);
      ell(g, W / 2, H - 200, W / 2 - 20, 150);
      paint(g, lin(g, 0, H - 350, 0, H - 50, [[0, '#d5d8dc'], [1, '#8f949b']]), 8);
      ell(g, W / 2, H - 230, W / 2 - 70, 110);
      paint(g, rad(g, W / 2, H - 240, 10, W / 2, H - 230, W / 2 - 70, [[0, '#7cc6f0'], [1, '#2f86c8']]), 6);
      rrect(g, W / 2 - 40, 260, 80, 260, 20);
      paint(g, lin(g, W / 2 - 40, 0, W / 2 + 40, 0, [[0, '#e8ebee'], [1, '#9aa1a8']]), 6);
      ell(g, W / 2, 270, 130, 50);
      paint(g, lin(g, 0, 220, 0, 320, [[0, '#e8ebee'], [1, '#9aa1a8']]), 6);
      ell(g, W / 2, 262, 100, 34);
      paint(g, '#5fb6ec', 4);
      for (var i = 0; i < 6; i++) {
        var a = -Math.PI / 2 + (i - 2.5) * 0.45;
        g.beginPath();
        g.moveTo(W / 2, 150);
        g.quadraticCurveTo(W / 2 + Math.cos(a) * 160, 60, W / 2 + Math.cos(a) * 230, 250 + Math.abs(i - 2.5) * 10);
        g.lineWidth = 10;
        g.strokeStyle = 'rgba(210,240,255,0.85)';
        g.stroke();
      }
      ell(g, W / 2, 150, 26, 26);
      paint(g, '#e8ebee', 5);
    };
  };

  D.notice = function (p) {
    return function (g) {
      [70, 420].forEach(function (x) {
        rrect(g, x, 200, 24, 300, 8);
        paint(g, '#7d4a26', 6);
      });
      rrect(g, 30, 40, 452, 300, 18);
      paint(g, lin(g, 0, 40, 0, 340, [[0, '#d39a5c'], [1, '#93592e']]), 8);
      [[70, 80, '#fff8e0'], [270, 100, '#ffe0e8'], [120, 210, '#e0f4ff']].forEach(function (n) {
        rrect(g, n[0], n[1], 150, 110, 6);
        paint(g, n[2], 4);
        for (var l = 0; l < 3; l++) { g.fillStyle = 'rgba(80,60,40,0.5)'; g.fillRect(n[0] + 20, n[1] + 26 + l * 26, 100, 6); }
      });
    };
  };

  D.bench = function (p) {
    return function (g) {
      A.shadow(g, p.W / 2, p.H - 20, p.W / 2 - 40, 20);
      [60, p.W - 90].forEach(function (x) { rrect(g, x, 140, 30, 100, 8); paint(g, '#5a3a1e', 6); });
      rrect(g, 30, 60, p.W - 60, 40, 12);
      paint(g, lin(g, 0, 60, 0, 100, [[0, '#d39a5c'], [1, '#93592e']]), 7);
      rrect(g, 20, 120, p.W - 40, 50, 14);
      paint(g, lin(g, 0, 120, 0, 170, [[0, '#d39a5c'], [1, '#93592e']]), 7);
    };
  };

  D.lamp = function (p) {
    return function (g) {
      A.shadow(g, 128, p.H - 20, 50, 14);
      rrect(g, 112, 120, 32, p.H - 140, 10);
      paint(g, lin(g, 112, 0, 144, 0, [[0, '#4a4f58'], [1, '#22252a']]), 6);
      rrect(g, 70, 40, 116, 110, 20);
      paint(g, rad(g, 128, 95, 6, 128, 95, 70, [[0, '#fff8d0'], [1, '#f2c53d']]), 7);
      rrect(g, 60, 20, 136, 30, 10);
      paint(g, '#2f333a', 6);
    };
  };

  D.flowerbed = function (p) {
    return function (g) {
      rrect(g, 20, 110, p.W - 40, 120, 20);
      paint(g, lin(g, 0, 110, 0, 230, [[0, '#9a6238'], [1, '#6c4024']]), 7);
      for (var i = 0; i < 9; i++) {
        A.leaf(g, 50 + i * 52, 160, 50, 18, -0.3 + (i % 3) * 0.3, A.LEAF);
        A.flower(g, 50 + i * 52, 110 + (i % 2) * 20, 20, ['#ff6b7a', '#ffd84d', '#c38bff', '#ffffff'][i % 4], '#ffe27a');
      }
    };
  };

  // ---------- festival decorations ----------
  D.flower_arch = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      var R = W / 2 - 60, cy = H - 60;
      [40, W - 80].forEach(function (x) { rrect(g, x, cy - 40, 40, H - cy + 20, 10); paint(g, '#fff6e8', 6); });
      g.beginPath();
      g.arc(W / 2, cy, R, Math.PI, 0);
      g.lineWidth = 46;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 34;
      g.strokeStyle = '#6cc23f';
      g.stroke();
      for (var i = 0; i <= 14; i++) {
        var a = Math.PI + (i / 14) * Math.PI;
        A.flower(g, W / 2 + Math.cos(a) * R, cy + Math.sin(a) * R, 26, ['#ff6b7a', '#ffd84d', '#ff9ad5', '#ffffff'][i % 4], '#ffe27a');
      }
    };
  };

  D.lantern = function (p) {
    return function (g) {
      rrect(g, 116, 60, 24, p.H - 80, 8);
      paint(g, '#7d4a26', 5);
      g.beginPath();
      g.moveTo(128, 70);
      g.lineTo(230, 120);
      g.lineWidth = 6;
      g.strokeStyle = '#3b2312';
      g.stroke();
      ell(g, 200, 190, 46, 60);
      paint(g, rad(g, 190, 170, 6, 200, 190, 60, [[0, '#fff3a0'], [1, '#e5484d']]), 6);
      rrect(g, 176, 122, 48, 16, 4);
      paint(g, '#3b2312', 3);
    };
  };

  D.pumpkin_pile = function (p) {
    return function (g) {
      A.shadow(g, p.W / 2, p.H - 30, p.W / 2 - 30, 24);
      A.pumpkin(g, 150, 170, 1.0);
      A.pumpkin(g, 360, 180, 0.85);
      A.pumpkin(g, 260, 120, 0.7);
    };
  };

  D.festive_tree = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, 150, 30);
      rrect(g, W / 2 - 30, H - 160, 60, 140, 10);
      paint(g, '#7d4a26', 6);
      for (var i = 0; i < 4; i++) {
        var w = 220 - i * 46, y = H - 150 - i * 140;
        g.beginPath();
        g.moveTo(W / 2 - w, y);
        g.lineTo(W / 2, y - 220);
        g.lineTo(W / 2 + w, y);
        g.closePath();
        paint(g, lin(g, 0, y - 220, 0, y, [[0, '#4fa86a'], [1, '#2a6e3f']]), 7);
      }
      var r = A.rng(321);
      for (var k = 0; k < 16; k++) {
        var yy = r.range(220, H - 180), half = 40 + (yy - 200) * 0.32;
        ell(g, W / 2 + r.range(-half, half), yy, 14, 14);
        paint(g, ['#e5383f', '#ffd23f', '#4a90e2', '#ffffff'][k % 4], 4);
      }
      A.star(g, W / 2, 90, 50, 20, '#ffe36a');
    };
  };

  D.doghouse = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, W / 2 - 30, 30);
      rrect(g, 60, 230, W - 120, H - 260, 14);
      paint(g, lin(g, 0, 230, 0, H - 30, [[0, '#e8b673'], [1, '#b77a45']]), 8);
      g.beginPath();
      g.moveTo(30, 260);
      g.lineTo(W / 2, 60);
      g.lineTo(W - 30, 260);
      g.closePath();
      paint(g, lin(g, 0, 60, 0, 260, [[0, '#e5484d'], [1, '#a8302a']]), 8);
      g.beginPath();
      g.moveTo(W / 2 - 80, H - 30);
      g.lineTo(W / 2 - 80, 360);
      g.arc(W / 2, 360, 80, Math.PI, 0);
      g.lineTo(W / 2 + 80, H - 30);
      g.closePath();
      paint(g, '#3a2414', 6);
      signBoard(g, W / 2, 300, 200, 56, 'BISCUIT');
    };
  };

  // ---------- furniture ----------
  D.bed = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 20, 24);
      rrect(g, 30, 20, W - 60, 120, 20);
      paint(g, lin(g, 0, 20, 0, 140, [[0, '#c98b4f'], [1, '#865a2e']]), 8);
      rrect(g, 40, 90, W - 80, H - 130, 24);
      paint(g, '#fffaf0', 8);
      rrect(g, 70, 110, W - 140, 80, 30);
      paint(g, lin(g, 0, 110, 0, 190, [[0, '#ffffff'], [1, '#dfe6ee']]), 6);
      rrect(g, 40, 220, W - 80, H - 260, 24);
      paint(g, lin(g, 0, 220, 0, H - 40, [[0, p.quilt ? p.quilt[0] : '#7fb0e8'], [1, p.quilt ? p.quilt[1] : '#4a7fc4']]), 8);
      for (var i = 0; i < 3; i++) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(60, 260 + i * 60, W - 120, 10);
      }
      rrect(g, 30, H - 70, W - 60, 50, 14);
      paint(g, '#a8703c', 7);
    };
  };

  D.bed2 = function (p) {
    p.quilt = ['#ff9ab5', '#e0557a'];
    return D.bed(p);
  };

  D.tv = function () {
    return function (g) {
      rrect(g, 40, 150, 176, 90, 10);
      paint(g, lin(g, 0, 150, 0, 240, [[0, '#a8703c'], [1, '#6e4122']]), 6);
      rrect(g, 30, 20, 196, 140, 18);
      paint(g, '#3a3e44', 7);
      rrect(g, 46, 36, 164, 108, 10);
      paint(g, lin(g, 0, 36, 0, 144, [[0, '#9fe0ff'], [1, '#3f8fd0']]), 4);
      g.beginPath();
      g.moveTo(80, 20);
      g.lineTo(60, -10);
      g.moveTo(150, 20);
      g.lineTo(180, -12);
      g.lineWidth = 5;
      g.strokeStyle = '#3a3e44';
      g.stroke();
    };
  };

  D.table = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 30, W / 2 - 40, 30);
      [[60, 40], [W - 140, 40], [60, H - 150], [W - 140, H - 150]].forEach(function (c) {
        rrect(g, c[0], c[1], 80, 80, 16);
        paint(g, lin(g, 0, c[1], 0, c[1] + 80, [[0, '#e0a868'], [1, '#a8703c']]), 6);
      });
      rrect(g, 50, 110, W - 100, H - 230, 26);
      paint(g, lin(g, 0, 110, 0, H - 120, [[0, '#e0a868'], [1, '#b07a42']]), 8);
      rrect(g, 90, 140, W - 180, H - 290, 18);
      paint(g, '#fffaf0', 5);
      A.flower(g, W / 2, H / 2 - 20, 26, '#ff6b7a', '#ffe27a');
    };
  };

  D.fireplace = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      rrect(g, 20, 40, W - 40, H - 50, 18);
      paint(g, lin(g, 0, 40, 0, H - 10, [[0, '#c56a55'], [1, '#8a3f30']]), 8);
      for (var y = 70; y < H - 20; y += 44) {
        for (var x = 30 + (y % 88 ? 0 : 30); x < W - 40; x += 70) {
          rrect(g, x, y, 60, 34, 6);
          g.fillStyle = 'rgba(255,200,170,0.18)';
          g.fill();
        }
      }
      g.beginPath();
      g.moveTo(110, H - 20);
      g.lineTo(110, 250);
      g.quadraticCurveTo(W / 2, 150, W - 110, 250);
      g.lineTo(W - 110, H - 20);
      g.closePath();
      paint(g, '#1a120c', 6);
      [[W / 2 - 50, 0.8], [W / 2, 1.1], [W / 2 + 50, 0.8]].forEach(function (f) {
        g.beginPath();
        g.moveTo(f[0] - 40, H - 40);
        g.quadraticCurveTo(f[0] - 30, H - 40 - 140 * f[1], f[0], H - 60 - 160 * f[1]);
        g.quadraticCurveTo(f[0] + 30, H - 40 - 140 * f[1], f[0] + 40, H - 40);
        g.closePath();
        g.fillStyle = lin(g, 0, H - 220, 0, H - 40, [[0, '#ffe36a'], [1, '#e5483a']]);
        g.fill();
      });
      rrect(g, 0, 20, W, 50, 14);
      paint(g, '#a8703c', 7);
    };
  };

  D.kitchen = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      rrect(g, 20, 120, W - 40, H - 140, 14);
      paint(g, lin(g, 0, 120, 0, H - 20, [[0, '#ffffff'], [1, '#d9e2ec']]), 8);
      for (var x = 40; x < W - 40; x += 240) {
        rrect(g, x, 220, 200, H - 260, 10);
        paint(g, '#eef3f8', 5);
        ell(g, x + 100, 250, 30, 8);
        paint(g, '#9aa3ad', 3);
      }
      rrect(g, 10, 80, W - 20, 60, 14);
      paint(g, lin(g, 0, 80, 0, 140, [[0, '#d39a5c'], [1, '#93592e']]), 8);
      // stove
      rrect(g, W - 300, 70, 240, 70, 10);
      paint(g, '#3a3e44', 6);
      [W - 240, W - 120].forEach(function (cx) { ell(g, cx, 104, 40, 16); paint(g, '#e5483a', 4); });
      // pot
      rrect(g, W - 280, 10, 120, 70, 16);
      paint(g, lin(g, 0, 10, 0, 80, [[0, '#c9d4e0'], [1, '#7f8893']]), 6);
      // cutting board with veggies
      rrect(g, 80, 70, 200, 40, 8);
      paint(g, '#e0a868', 4);
      A.carrot(g, 140, 70);
      A.tomato(g, 220, 82, 0.35);
    };
  };

  D.shelf = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      rrect(g, 20, 20, W - 40, H - 30, 14);
      paint(g, lin(g, 0, 20, 0, H - 10, [[0, '#b77a45'], [1, '#7d4a26']]), 8);
      var r = A.rng(331);
      for (var row = 0; row < 3; row++) {
        var y = 60 + row * 150;
        g.fillStyle = '#5a3a1e';
        g.fillRect(40, y + 110, W - 80, 14);
        for (var x = 50; x < W - 70;) {
          var bw = r.range(26, 44), bh = r.range(70, 104);
          rrect(g, x, y + 110 - bh, bw, bh, 4);
          paint(g, r.pick(['#e5484d', '#4a90e2', '#5fa84a', '#f2c53d', '#9a6ad0']), 3);
          x += bw + 6;
        }
      }
    };
  };

  D.rug = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      ell(g, W / 2, H / 2, W / 2 - 20, H / 2 - 20);
      paint(g, '#c9623e', 6);
      ell(g, W / 2, H / 2, W / 2 - 60, H / 2 - 60);
      paint(g, '#f2c53d', 4);
      ell(g, W / 2, H / 2, W / 2 - 110, H / 2 - 100);
      paint(g, '#e5484d', 4);
    };
  };

  D.plant = function () {
    return function (g) {
      A.shadow(g, 128, 236, 60, 14);
      rrect(g, 70, 140, 116, 100, 18);
      paint(g, lin(g, 70, 0, 186, 0, [[0, '#e0855a'], [1, '#a8502a']]), 7);
      A.puffs(g, [[128, 90, 50], [86, 120, 38], [170, 120, 38]], A.LEAF);
    };
  };

  D.window = function (p) {
    return function (g) {
      windowPane(g, 40, 20, p.W - 80, p.H - 40, false);
      [[30, 40], [p.W - 70, 40]].forEach(function (c) {
        rrect(g, c[0], c[1] - 20, 40, p.H - 40, 12);
        paint(g, lin(g, c[0], 0, c[0] + 40, 0, [[0, '#ff9ab5'], [1, '#e0557a']]), 5);
      });
    };
  };

  D.wall_calendar = function () {
    return function (g) {
      rrect(g, 50, 40, 156, 176, 12);
      paint(g, '#ffffff', 6);
      rrect(g, 50, 40, 156, 50, 12);
      paint(g, '#e5484d', 6);
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
        rrect(g, 66 + c * 34, 104 + r * 34, 22, 20, 4);
        g.fillStyle = '#c9d4e0';
        g.fill();
      }
    };
  };

  D.doormat = function (p) {
    return function (g) {
      rrect(g, 40, 40, p.W - 80, p.H - 80, 20);
      paint(g, lin(g, 0, 40, 0, p.H - 40, [[0, '#d9a066'], [1, '#a66d38']]), 6);
      text(g, 'HOME', p.W / 2, p.H / 2, 70, '#7a3d1a');
    };
  };

  D.dresser = function (p) {
    return function (g) {
      var W = p.W, H = p.H;
      A.shadow(g, W / 2, H - 20, W / 2 - 30, 20);
      rrect(g, 40, 80, W - 80, H - 110, 14);
      paint(g, lin(g, 0, 80, 0, H - 30, [[0, '#e0a868'], [1, '#a8703c']]), 8);
      for (var i = 0; i < 3; i++) {
        rrect(g, 70, 130 + i * 120, W - 140, 90, 10);
        paint(g, '#c98b4f', 5);
        ell(g, W / 2, 175 + i * 120, 14, 10);
        paint(g, '#f4c133', 3);
      }
      rrect(g, W / 2 - 60, 10, 120, 80, 10);
      paint(g, '#bfe6ff', 5);
    };
  };

  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra ? prevExtra(sets) : { sheets: {}, props: {} };
    Object.keys(sets.PROPS).forEach(function (name) {
      var def = sets.PROPS[name];
      if (!D[name]) throw new Error('no art for prop ' + name);
      var W = def.w * S, H = def.h * S;
      var full = A.canvas(W, H);
      D[name]({ W: W, H: H, door: def.door })(full.getContext('2d'));
      var half = A.canvas(def.w * 128, def.h * 128), hg = half.getContext('2d');
      hg.imageSmoothingEnabled = true;
      hg.imageSmoothingQuality = 'high';
      hg.drawImage(full, 0, 0, half.width, half.height);
      out.props[name] = half;
    });
    return out;
  };
})();
