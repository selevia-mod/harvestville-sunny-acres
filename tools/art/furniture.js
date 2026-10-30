// The home's furniture sheets (one per style: furn_0 .. furn_9), wallpapers and floors, and the farmhouse
// as it grows (house_2 .. house_10). These are simple stand-ins; generated pictures in art-src/ replace them
// (see tools/art-manifest.js). Runs after props.js.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rrect = A.rrect, ell = A.ell, paint = A.paint;
  var P = A.PROP_DRAW;
  var OUT = '#4a2e18', U = 128; // half resolution: 128 px per tile

  // per style: wood (light, dark), fabric (main, second), accent, metal, and a festival motif
  var PAL = [
    { wood: ['#d39a5a', '#8a5a30'], fab: ['#f4e6c8', '#d9b98a'], acc: '#e5484d', metal: '#c9a227' },
    { wood: ['#d9a35f', '#8f5a2a'], fab: ['#c9473a', '#f3e2c0'], acc: '#3d2614', metal: '#5a5a5a' },
    { wood: ['#faf6ee', '#cfc2ab'], fab: ['#f7b6c8', '#bfe8d4'], acc: '#e98aa8', metal: '#d9c27a' },
    { wood: ['#e3d2b4', '#a88c66'], fab: ['#cfd6dc', '#f4f6f8'], acc: '#5b8ec9', metal: '#8a96a3' },
    { wood: ['#7a3624', '#3d1a10'], fab: ['#a8243a', '#d84a5f'], acc: '#f4c133', metal: '#f4c133' },
    { wood: ['#fff3e2', '#e0c9a8'], fab: ['#ffc2d6', '#ffffff'], acc: '#ff86b0', metal: '#f4c133', motif: 'blossom' },
    { wood: ['#33478a', '#1b2752'], fab: ['#3d55a8', '#f4c133'], acc: '#ff6b6b', metal: '#f4c133', motif: 'star' },
    { wood: ['#c8743a', '#8a4a20'], fab: ['#f29a3d', '#ffd27a'], acc: '#8a3d1a', metal: '#c9a227', motif: 'leaf' },
    { wood: ['#fafafa', '#a0a0a0'], fab: ['#ffffff', '#d93a3a'], acc: '#2a2a2a', metal: '#f4c133', motif: 'spots' },
    { wood: ['#2f4678', '#16244a'], fab: ['#4a6fb0', '#cfe3ff'], acc: '#e8f2ff', metal: '#cfd8e8', motif: 'snow' },
  ];

  function grad(g, y0, y1, a, b) { return lin(g, 0, y0, 0, y1, [[0, a], [1, b]]); }
  function box(g, x, y, w, h, fill, r) {
    rrect(g, x, y, w, h, r == null ? 8 : r);
    paint(g, fill, 5, OUT);
  }
  function wood(g, p, x, y, w, h, r) { box(g, x, y, w, h, grad(g, y, y + h, p.wood[0], p.wood[1]), r); }
  function legs(g, p, x0, x1, y, h) {
    box(g, x0, y, 12, h, p.wood[1], 4);
    box(g, x1 - 12, y, 12, h, p.wood[1], 4);
  }
  function knob(g, p, x, y) { ell(g, x, y, 5, 5); paint(g, p.metal, 3, OUT); }
  function shadow(g, W, H) { A.shadow(g, W / 2, H - 8, W / 2 - 10, 10); }

  // small festival motifs scattered over an area
  function motif(g, p, x, y, w, h, n) {
    if (!p.motif) return;
    for (var i = 0; i < (n || 4); i++) {
      var mx = x + ((i * 37) % 100) / 100 * w, my = y + ((i * 61) % 100) / 100 * h, r = 7;
      g.save();
      g.translate(mx, my);
      if (p.motif === 'blossom') {
        for (var k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); ell(g, 0, -r * 0.7, r * 0.5, r * 0.6); paint(g, '#ff9ec0', 0); }
        ell(g, 0, 0, 3, 3); paint(g, '#ffd23f', 0);
      } else if (p.motif === 'star' || p.motif === 'snow') {
        A.star(g, 0, 0, r, r * 0.45, p.motif === 'star' ? '#ffd23f' : '#ffffff');
      } else if (p.motif === 'leaf') {
        g.rotate(i);
        ell(g, 0, 0, r, r * 0.5); paint(g, i % 2 ? '#e0662a' : '#c94a1a', 0);
      } else if (p.motif === 'spots') {
        ell(g, 0, 0, r * 1.2, r); paint(g, '#2a2a2a', 0);
      }
      g.restore();
    }
  }

  // ---------- one drawing per kind of furniture (W x H = its size in tiles x 128) ----------
  var DRAW = {
    bed: function (g, p, W, H, two) {
      shadow(g, W, H);
      wood(g, p, 8, 8, W - 16, 70, 14); // headboard
      box(g, 14, 50, W - 28, H - 70, p.fab[1], 12);
      var pw = two ? (W - 60) / 2 : W - 70;
      for (var k = 0; k < (two ? 2 : 1); k++) box(g, 30 + k * (pw + 10), 58, pw - 10, 36, '#ffffff', 14);
      box(g, 14, 104, W - 28, H - 124, grad(g, 104, H - 20, p.fab[0], p.fab[1]), 12); // blanket
      motif(g, p, 30, 120, W - 60, H - 150, 6);
      wood(g, p, 8, H - 36, W - 16, 24, 8); // footboard
    },
    double_bed: function (g, p, W, H) { DRAW.bed(g, p, W, H, true); },
    table: function (g, p, W, H) {
      shadow(g, W, H);
      legs(g, p, 40, W - 40, 130, H - 140);
      box(g, 16, 60, W - 32, 90, grad(g, 60, 150, p.fab[1], p.fab[0]), 16); // cloth
      motif(g, p, 30, 70, W - 60, 60, 4);
      ell(g, W / 2, 80, 16, 16); paint(g, p.acc, 4, OUT); // a vase
    },
    chair: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 30, 8, W - 60, 60, 10);
      box(g, 22, 62, W - 44, 26, p.fab[0], 8);
      legs(g, p, 28, W - 28, 86, H - 92);
    },
    sofa: function (g, p, W, H) {
      shadow(g, W, H);
      box(g, 20, 70, W - 40, 100, grad(g, 70, 170, p.fab[0], p.fab[1]), 22); // back
      box(g, 8, 130, 44, 100, p.fab[1], 16);
      box(g, W - 52, 130, 44, 100, p.fab[1], 16);
      box(g, 44, 150, W - 88, 70, p.fab[0], 14); // seat
      motif(g, p, 40, 80, W - 80, 60, 5);
      legs(g, p, 20, W - 20, H - 26, 20);
    },
    armchair: function (g, p, W, H) {
      shadow(g, W, H);
      box(g, 14, 70, W - 28, 120, grad(g, 70, 190, p.fab[0], p.fab[1]), 22);
      box(g, 6, 150, W - 12, 70, p.fab[1], 14);
      motif(g, p, 26, 90, W - 52, 60, 3);
      legs(g, p, 18, W - 18, H - 28, 22);
    },
    rug: function (g, p, W, H) {
      ell(g, W / 2, H / 2, W / 2 - 12, H / 2 - 14);
      paint(g, p.fab[1], 6, OUT);
      ell(g, W / 2, H / 2, W / 2 - 40, H / 2 - 40);
      paint(g, p.fab[0], 0);
      motif(g, p, 70, 60, W - 140, H - 120, 6);
    },
    doormat: function (g, p, W, H) { box(g, 14, 22, W - 28, H - 44, grad(g, 22, H - 22, p.fab[1], p.fab[0]), 12); },
    plant: function (g, p, W, H) {
      shadow(g, W, H);
      for (var k = 0; k < 5; k++) { ell(g, W / 2 + (k - 2) * 14, 50 - Math.abs(k - 2) * -6, 18, 30); paint(g, k % 2 ? '#5fa84a' : '#3f8a30', 4, '#2f5a1e'); }
      box(g, 32, 70, W - 64, H - 78, p.acc, 10);
      motif(g, p, 36, 80, W - 72, 30, 2);
    },
    big_plant: function (g, p, W, H) {
      shadow(g, W, H);
      for (var k = 0; k < 7; k++) { ell(g, W / 2 + ((k % 3) - 1) * 22, 40 + k * 22, 22, 34); paint(g, k % 2 ? '#5fa84a' : '#3f8a30', 4, '#2f5a1e'); }
      box(g, 26, H - 80, W - 52, 72, p.acc, 12);
    },
    floor_lamp: function (g, p, W, H) {
      shadow(g, W, H);
      box(g, W / 2 - 7, 70, 14, H - 90, p.metal, 5);
      box(g, 30, H - 26, W - 60, 16, p.metal, 6);
      g.beginPath(); g.moveTo(34, 76); g.lineTo(W - 34, 76); g.lineTo(W - 18, 12); g.lineTo(18, 12); g.closePath();
      paint(g, grad(g, 12, 76, '#fff6c8', p.fab[1]), 5, OUT);
      motif(g, p, 30, 20, W - 60, 40, 2);
    },
    shelf: function (g, p, W, H) {
      wood(g, p, 12, 12, W - 24, H - 24, 8);
      ['#e5484d', '#5b8ec9', '#5fa84a', '#f4c133', '#a86ad9', '#ff8a3d'].forEach(function (c, k) {
        for (var row = 0; row < 3; row++) box(g, 26 + k * 34, 26 + row * 76, 26, 58, c, 3);
      });
      motif(g, p, 20, 16, W - 40, 20, 3);
    },
    fireplace: function (g, p, W, H) {
      box(g, 10, 30, W - 20, H - 30, grad(g, 30, H, '#c9b8a8', '#8a7a6a'), 8);
      wood(g, p, 0, 20, W, 30, 6);
      box(g, 60, 100, W - 120, H - 110, '#3d2614', 30);
      g.beginPath(); g.moveTo(W / 2 - 40, H - 14); g.quadraticCurveTo(W / 2, 80, W / 2 + 40, H - 14); g.closePath();
      paint(g, grad(g, 100, H, '#ffd23f', '#ff6b2a'), 0);
      motif(g, p, 20, 24, W - 40, 20, 4);
    },
    window: function (g, p, W, H) {
      wood(g, p, 20, 10, W - 40, H - 20, 6);
      box(g, 32, 20, W - 64, H - 40, grad(g, 20, H - 20, '#cfeaff', '#8cc6f0'), 4);
      box(g, 8, 6, 44, H - 12, p.fab[0], 10);
      box(g, W - 52, 6, 44, H - 12, p.fab[0], 10);
      motif(g, p, 12, 20, 36, H - 40, 2);
    },
    painting: function (g, p, W, H) {
      box(g, 24, 14, W - 48, H - 28, p.metal, 6);
      box(g, 36, 24, W - 72, H - 48, grad(g, 24, H - 24, '#9fd6ff', '#7cc06a'), 2);
      ell(g, W / 2 + 30, 50, 12, 12); paint(g, '#ffe36a', 0);
      motif(g, p, 40, 30, W - 80, H - 60, 3);
    },
    calendar: function (g, p, W, H) {
      box(g, 26, 18, W - 52, H - 30, '#fffaf0', 6);
      box(g, 26, 18, W - 52, 24, p.acc, 6);
    },
    mirror: function (g, p, W, H) {
      ell(g, W / 2, H / 2, 46, 52); paint(g, p.metal, 6, OUT);
      ell(g, W / 2, H / 2, 34, 40); paint(g, grad(g, 24, 104, '#f4fbff', '#b8d8ee'), 0);
      motif(g, p, 28, 16, W - 56, 20, 2);
    },
    dresser: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 14, 50, W - 28, H - 70, 8);
      for (var k = 0; k < 3; k++) { box(g, 28, 66 + k * 56, W - 56, 44, p.wood[0], 6); knob(g, p, W / 2, 88 + k * 56); }
      motif(g, p, 30, 60, W - 60, 150, 4);
      legs(g, p, 22, W - 22, H - 22, 16);
    },
    wardrobe: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 14, 14, W - 28, H - 34, 10);
      box(g, 28, 30, W / 2 - 32, H - 70, p.wood[0], 6);
      box(g, W / 2 + 4, 30, W / 2 - 32, H - 70, p.wood[0], 6);
      knob(g, p, W / 2 - 12, H / 2); knob(g, p, W / 2 + 12, H / 2);
      motif(g, p, 30, 40, W - 60, H - 100, 6);
    },
    nightstand: function (g, p, W, H) {
      shadow(g, W, H);
      ell(g, W / 2, 26, 18, 14); paint(g, '#fff6c8', 4, OUT);
      wood(g, p, 22, 46, W - 44, H - 60, 8);
      knob(g, p, W / 2, 80);
    },
    desk: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 10, 90, W - 20, 30, 6);
      wood(g, p, W - 90, 116, 76, H - 126, 6);
      knob(g, p, W - 52, 150);
      box(g, 16, 116, 16, H - 126, p.wood[1], 4);
      box(g, 50, 40, 70, 52, '#fffaf0', 4); // a little stack of paper
      motif(g, p, 20, 96, W - 40, 20, 3);
    },
    clock: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 20, 12, W - 40, H - 24, 14);
      ell(g, W / 2, 62, 30, 30); paint(g, '#fffaf0', 5, OUT);
      g.beginPath(); g.moveTo(W / 2, 62); g.lineTo(W / 2, 40); g.moveTo(W / 2, 62); g.lineTo(W / 2 + 16, 70);
      g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      box(g, W / 2 - 18, 110, 36, 90, '#3d2614', 8);
      ell(g, W / 2, 170, 12, 12); paint(g, p.metal, 3, OUT);
      motif(g, p, 26, 210, W - 52, 30, 2);
    },
    tv: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 14, 14, W - 28, 74, 10);
      box(g, 24, 22, W - 48, 56, grad(g, 22, 78, '#bfe8ff', '#5aa0d8'), 6);
      legs(g, p, 26, W - 26, 86, H - 92);
    },
    kitchen: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 8, 80, W - 16, H - 92, 8);
      box(g, 4, 70, W - 8, 24, '#e8e2d6', 6);
      box(g, 30, 30, 90, 46, '#5a5a5a', 6); // stove
      ell(g, 54, 50, 14, 8); paint(g, '#2a2a2a', 3); ell(g, 96, 50, 14, 8); paint(g, '#2a2a2a', 3);
      box(g, W - 130, 50, 96, 26, '#cfd8e0', 8); // sink
      for (var k = 0; k < 3; k++) { box(g, 26 + k * 118, 110, 100, H - 140, p.wood[0], 6); knob(g, p, 76 + k * 118, 140); }
      motif(g, p, 30, 110, W - 60, H - 150, 5);
    },
    music_box: function (g, p, W, H) {
      shadow(g, W, H);
      box(g, 24, 20, W - 48, 34, p.fab[0], 6); // open lid
      box(g, 18, 54, W - 36, H - 66, grad(g, 54, H - 12, p.fab[0], p.fab[1]), 8);
      ell(g, W / 2, 44, 8, 14); paint(g, '#ffd6e0', 3, OUT);
      motif(g, p, 26, 64, W - 52, 30, 2);
    },
    aquarium: function (g, p, W, H) {
      shadow(g, W, H);
      wood(g, p, 14, 130, W - 28, H - 140, 8);
      box(g, 14, 16, W - 28, 116, grad(g, 16, 132, '#9fe0ff', '#3f8fd0'), 6);
      ell(g, 80, 70, 16, 9); paint(g, '#ff8a3d', 3, OUT);
      ell(g, 170, 96, 14, 8); paint(g, '#ffd23f', 3, OUT);
      motif(g, p, 30, 140, W - 60, 80, 3);
    },
    cat_bed: function (g, p, W, H) {
      ell(g, W / 2, H / 2 + 6, W / 2 - 10, H / 2 - 22); paint(g, grad(g, 30, 100, p.wood[0], p.wood[1]), 5, OUT);
      ell(g, W / 2, H / 2 + 2, W / 2 - 26, H / 2 - 36); paint(g, p.fab[0], 3, OUT);
      motif(g, p, 34, 50, W - 68, 20, 2);
    },
  };

  // A piece of furniture: style v, kind t (from the game's data), at half resolution.
  A.furniture = function (sets, v, t) {
    var type = sets.HOME.types[t], W = type.w * U, H = type.h * U, c = A.canvas(W, H), g = c.getContext('2d');
    var O = A.OVR || {}, key = 'furn:' + v + ':' + t;
    if (O[key]) g.drawImage(O[key], 0, 0, W, H);
    else if (v === 0 && type.prop && A.propHalf && A.propHalf[type.prop]) g.drawImage(A.propHalf[type.prop], 0, 0, W, H);
    else if (DRAW[type.key]) DRAW[type.key](g, PAL[v], W, H); // (trophies: tools/art/trophies-import.js)
    return c;
  };

  // A sheet per style: 4 columns of 3 x 3 tile cells (384 px), one piece per cell in the order of
  // HOME.types, sitting in the bottom-left corner of its cell. The game cuts frames from the same layout.
  A.FURN_CELL = 3 * U;
  A.furnitureSheet = function (sets, v) {
    var n = sets.HOME.types.length, cols = 4, rows = Math.ceil(n / cols), cell = A.FURN_CELL;
    var sheet = A.canvas(8 + cols * (cell + 16) - 8, 8 + rows * (cell + 16) - 8), g = sheet.getContext('2d');
    for (var t = 0; t < n; t++) {
      var type = sets.HOME.types[t], x = 8 + (t % cols) * (cell + 16), y = 8 + Math.floor(t / cols) * (cell + 16);
      g.drawImage(A.furniture(sets, v, t), x, y + cell - type.h * U);
    }
    return sheet;
  };

  // ---------- wallpapers and floors in each style (256 x 256 tiles) ----------
  A.homeSurface = function (kind, v) {
    var S = 256, c = A.canvas(S, S), g = c.getContext('2d'), p = PAL[v], O = A.OVR || {};
    var pic = O['surf:' + (kind === 'floor' ? 'floor' : 'wall') + ':' + v];
    if (pic) g.drawImage(pic, 0, 0, S, S);
    else if (kind === 'floor') {
      g.fillStyle = grad(g, 0, S, p.wood[0], p.wood[1]);
      g.fillRect(0, 0, S, S);
      for (var y = 0; y < S; y += 64) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(0, y, S, 4);
        g.fillRect(((y / 64) % 2) * 128 + 60, y, 4, 64);
      }
    } else {
      g.fillStyle = p.fab[0];
      g.fillRect(0, 0, S, S);
      for (var x = 0; x < S; x += 64) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, 0, 24, S); }
      motif(g, p, 20, 20, S - 40, S - 40, 6);
    }
    if (kind === 'wall_low') { // the skirting board along the bottom
      g.fillStyle = grad(g, S - 80, S, p.wood[0], p.wood[1]);
      g.fillRect(0, S - 80, S, 80);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(0, S - 84, S, 6);
    }
    return c;
  };

  // the sheets join the others (after props.js has made the classic furniture pictures)
  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra(sets);
    A.propHalf = out.props;
    for (var v = 0; v < sets.HOME.styles.length; v++) out.sheets['furn_' + v] = A.furnitureSheet(sets, v);
    return out;
  };

  // ---------- the farmhouse at levels 2..10 (5 x 5 tiles at 256 px; drawn over the house on the farm) ----------
  [2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (lv) {
    P['house_' + lv] = function (p) {
      return function (g) {
        var W = p.W, H = p.H, base = A.houseArt;
        var hue = [0, 0, 20, 330, 200, 120, 280, 40, 180, 300][lv - 1];
        var grow = 0.84 + lv * 0.016; // a little bigger every level
        g.save();
        g.filter = 'hue-rotate(' + hue + 'deg) saturate(' + (1 + lv * 0.03) + ')';
        if (base) g.drawImage(base, (W - W * grow) / 2, H - H * 0.8 * grow, W * grow, H * 0.8 * grow);
        g.restore();
        // a sign with the level, so the stand-ins can be told apart
        rrect(g, W / 2 - 60, H - 150, 120, 56, 12);
        paint(g, '#fff6dc', 6, OUT);
        g.font = 'bold 40px "Trebuchet MS", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = OUT;
        g.fillText('Lv ' + lv, W / 2, H - 121);
      };
    };
  });
})();
