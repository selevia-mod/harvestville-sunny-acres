// The villagers: one parametric character drawer, styled per villager. Frames are drawn in the farmer's
// 256x384 space and stored at half size (128x192), which is still sharper than a phone shows them.
// Sheet order follows Config.VILLAGER_ORDER; each villager has 9 frames: down/up/side x stand/stepA/stepB.
(function () {
  'use strict';
  var A = window.ART, lin = A.lin, rad = A.rad, rrect = A.rrect, ell = A.ell, paint = A.paint, OUT = A.OUT;

  var LOOKS = {
    lily: { skin: ['#ffe0c4', '#f2b88e'], hair: ['#c86a33', '#9a4a1e'], style: 'long', shirt: ['#fff6e8', '#eadcc4'], outfit: 'dress', dress: ['#ff8aa4', '#e0557a'], flower: '#ffd84d', shoes: '#8a4a2a' },
    hollis: { skin: ['#f6d2b4', '#e0a888'], hair: ['#f2f2f2', '#c9c9c9'], style: 'bald', shirt: ['#ffffff', '#dfe6ee'], outfit: 'coat', coat: ['#7a5aa8', '#523a80'], pants: ['#6e6e7a', '#4f4f5a'], mustache: '#e8e8e8', shoes: '#3b2a20', glasses: true },
    bram: { skin: ['#e9b48a', '#c98a60'], hair: ['#6a3a1e', '#4a2510'], style: 'bald', shirt: ['#9aa3ad', '#6e7782'], outfit: 'apron', apron: ['#8a5a30', '#5e3b1b'], pants: ['#4f4f5a', '#3a3a44'], beard: '#6a3a1e', shoes: '#2b1d14', big: true },
    mira: { skin: ['#f7cfa8', '#dea27a'], hair: ['#7a4524', '#4f2a12'], style: 'short', shirt: ['#ffffff', '#dfe6ee'], outfit: 'overalls', over: ['#6cbf57', '#4a9a3c'], pants: ['#6cbf57', '#4a9a3c'], hat: 'bandana', hatColor: ['#ff9a3d', '#d9741e'], shoes: '#6a3a1e' },
    rosa: { skin: ['#f6d2b4', '#e0a888'], hair: ['#9a8a80', '#6e6058'], style: 'bun', shirt: ['#e5484d', '#b52e33'], outfit: 'dressApron', dress: ['#e5484d', '#b52e33'], apron: ['#ffffff', '#e6e6e6'], shoes: '#5a3420', big: true },
    leo: { skin: ['#d9a07a', '#b57a55'], hair: ['#2f2a28', '#1a1614'], style: 'short', shirt: ['#ffffff', '#dfe6ee'], outfit: 'vest', vest: ['#3f6fc0', '#2d4f8f'], pants: ['#8a7454', '#64523a'], hat: 'bucket', hatColor: ['#a8b06a', '#7a8244'], shoes: '#4a3020' },
    ivy: { skin: ['#ffe6d0', '#f2bfa0'], hair: ['#2f4a3a', '#1c2e24'], style: 'long', shirt: ['#fff6e8', '#eadcc4'], outfit: 'dress', dress: ['#b48ae0', '#8a5fc0'], leaf: true, shoes: '#5a3a5a' },
    // the bigger town (src/00-town2.js)
    pearl: { skin: ['#f8dcc4', '#e6b498'], hair: ['#f0f0f0', '#c4c4c4'], style: 'bun', shirt: ['#fff6e8', '#eadcc4'], outfit: 'dress', dress: ['#a58ad0', '#7a60a8'], glasses: true, shoes: '#6a4a3a' },
    ewan: { skin: ['#efc4a0', '#d29c78'], hair: ['#f2f2f2', '#c9c9c9'], style: 'short', shirt: ['#dfe9f2', '#b8c8d6'], outfit: 'vest', vest: ['#2f4f7a', '#1f3a5e'], pants: ['#7a6448', '#5a4834'], beard: '#ececec', hat: 'flatcap', hatColor: ['#3f5f8a', '#2a446a'], cane: true, shoes: '#3b2a20' },
    pip: { skin: ['#ffdcc0', '#f0b48e'], hair: ['#8a5a2a', '#5e3a18'], style: 'short', shirt: ['#ff6b5a', '#d9483a'], pants: ['#4a78c8', '#33599a'], hat: 'cap', hatColor: ['#4a90e0', '#2f6ab8'], child: true, shoes: '#ffffff' },
    daisy: { skin: ['#ffe2c8', '#f2bc98'], hair: ['#f2d06a', '#d4aa3a'], style: 'long', shirt: ['#ffffff', '#ececec'], outfit: 'dress', dress: ['#ffd84d', '#f2b01e'], flower: '#ffffff', child: true, shoes: '#ff8aa4' },
    clara: { skin: ['#fbe0c8', '#ecb894'], hair: ['#7a4a2a', '#52301a'], style: 'bun', shirt: ['#ffffff', '#e6ecef'], outfit: 'dress', dress: ['#3fa8a0', '#2a807a'], glasses: true, shoes: '#5a3a2a' },
    tomas: { skin: ['#e8b890', '#c8906a'], hair: ['#8a8a8a', '#5e5e5e'], style: 'short', shirt: ['#2e2e38', '#1e1e26'], outfit: 'coat', coat: ['#33333e', '#1f1f28'], pants: ['#2a2a32', '#1a1a22'], collar: true, shoes: '#1a1a1a' },
    hana: { skin: ['#fde4cc', '#eebc9a'], hair: ['#2a2220', '#141010'], style: 'bun', shirt: ['#ff9ab5', '#e07090'], outfit: 'dressApron', dress: ['#ff9ab5', '#e07090'], apron: ['#ffffff', '#ececec'], hat: 'chef', shoes: '#6a3a2a' },
    marco: { skin: ['#e4ac80', '#c4865c'], hair: ['#2a1e18', '#140c08'], style: 'short', shirt: ['#ffffff', '#e6e6e6'], outfit: 'vest', vest: ['#b5302a', '#86201c'], pants: ['#3a3a4a', '#26262e'], mustache: '#2a1e18', hat: 'bandana', hatColor: ['#f2c13a', '#c8961e'], shoes: '#4a2a18' },
    sora: { skin: ['#f6dcc0', '#e2b694'], hair: ['#2a3a5e', '#18223e'], style: 'short', shirt: ['#ffffff', '#e6ecef'], outfit: 'coat', coat: ['#e08a3a', '#b8641e'], pants: ['#4a5a6a', '#33404e'], hat: 'beret', hatColor: ['#c83a5a', '#9a2440'], shoes: '#3a2a20' },
    hale: { skin: ['#f2cfb0', '#dca888'], hair: ['#b8b0a8', '#8a8078'], style: 'bun', shirt: ['#bfe0f2', '#94c0dc'], outfit: 'coat', coat: ['#ffffff', '#dde4ea'], pants: ['#5a6472', '#404854'], glasses: true, scope: true, shoes: '#3a3a44' },
    nina: { skin: ['#ffe4d0', '#f2bca0'], hair: ['#b85a3a', '#8a3a22'], style: 'long', shirt: ['#ffffff', '#ececec'], outfit: 'dress', dress: ['#8ac8f0', '#5aa0d4'], hat: 'nurse', hatColor: ['#ffffff', '#e6e6e6'], shoes: '#ffffff' },
    owen: { skin: ['#f2c8a4', '#dca07c'], hair: ['#d4742e', '#a8521a'], style: 'short', shirt: ['#4ab0a0', '#2f8a7c'], outfit: 'vest', vest: ['#8a6a44', '#644a2e'], pants: ['#3f5f9a', '#2c4472'], shoes: '#4a3020' },
    poppy: { skin: ['#ffe0cc', '#f2b8a0'], hair: ['#e8507a', '#b8305a'], style: 'long', shirt: ['#fff6e8', '#eadcc4'], outfit: 'dressApron', dress: ['#6cbf57', '#4a9a3c'], apron: ['#fff6dc', '#eadcb8'], flower: '#ff5a7a', shoes: '#6a3a2a' },
    finn: { skin: ['#f8d8bc', '#e4ae8e'], hair: ['#f0c85a', '#c89a2e'], style: 'short', shirt: ['#ffffff', '#e6ecef'], outfit: 'coat', coat: ['#3a6ac8', '#284c96'], pants: ['#2e3e66', '#1e2a48'], hat: 'cap', hatColor: ['#3a6ac8', '#284c96'], satchel: true, shoes: '#3a2a20' },
    elliot: { skin: ['#f4d2b4', '#dea888'], hair: ['#4a3426', '#2e1e14'], style: 'short', shirt: ['#ffffff', '#e6ecef'], outfit: 'vest', vest: ['#7a5a3a', '#5a4026'], pants: ['#6a6a74', '#4a4a54'], glasses: true, shoes: '#3a2a20' },
    jules: { skin: ['#e8b48c', '#c88c66'], hair: ['#7a4ab8', '#58308e'], style: 'short', shirt: ['#ffd84d', '#e6b01e'], outfit: 'vest', vest: ['#2a2a30', '#18181e'], pants: ['#2a2a30', '#18181e'], hat: 'beanie', hatColor: ['#e5484d', '#b52e33'], shoes: '#1a1a1a' },
    // visitors from out of town (Config.SHOPPERS)
    visitor_farmer: { skin: ['#eebc94', '#d09870'], hair: ['#6a4a2a', '#4a3018'], style: 'short', shirt: ['#d94a3a', '#a8302a'], outfit: 'overalls', over: ['#4a78c8', '#33599a'], pants: ['#4a78c8', '#33599a'], hat: 'straw', hatColor: ['#f2d47a', '#d4ae4a'], shoes: '#5a3a20' },
    visitor_tourist: { skin: ['#ffdcc4', '#f2b494'], hair: ['#c8783a', '#9a5422'], style: 'short', shirt: ['#ff9a3d', '#e0741e'], pants: ['#d8c49a', '#b8a274'], hat: 'sunhat', hatColor: ['#fff1c8', '#e6d29a'], shoes: '#ffffff' },
    visitor_mother: { skin: ['#f6d0b0', '#e0a888'], hair: ['#5a3a22', '#3a2412'], style: 'long', shirt: ['#ffffff', '#ececec'], outfit: 'coat', coat: ['#f2c83a', '#d4a41e'], pants: ['#4a6ab8', '#33508e'], satchel: true, shoes: '#8a4a2a' },
    visitor_elder: { skin: ['#efc8a8', '#d4a284'], hair: ['#d8d8d8', '#aaaaaa'], style: 'short', shirt: ['#f2efe6', '#d8d2c4'], outfit: 'vest', vest: ['#8a5a30', '#5e3b1b'], pants: ['#5a5a62', '#404048'], mustache: '#dcdcdc', hat: 'flatcap', hatColor: ['#8a6a4a', '#644a32'], cane: true, shoes: '#2b1d14' },
    visitor_student: { skin: ['#f8dcc4', '#e4b494'], hair: ['#1e1e24', '#0e0e12'], style: 'short', shirt: ['#5ab85a', '#3a943a'], outfit: 'coat', coat: ['#5ab85a', '#3a943a'], pants: ['#3a4a6a', '#28344e'], glasses: true, satchel: true, shoes: '#ffffff' },
    visitor_chef: { skin: ['#e6b088', '#c88a64'], hair: ['#3a2a20', '#20160e'], style: 'short', shirt: ['#ffffff', '#e6e6e6'], outfit: 'coat', coat: ['#ffffff', '#e2e6ea'], pants: ['#2a2a30', '#18181e'], mustache: '#3a2a20', hat: 'chef', big: true, shoes: '#1a1a1a' },
  };
  A.LOOKS = LOOKS;

  function grad(g, x0, y0, x1, y1, pair) {
    return lin(g, x0, y0, x1, y1, [[0, pair[0]], [1, pair[1]]]);
  }

  // ---------- front / back ----------
  function front(g, L, back, step, bob) {
    var swing = step === 1 ? 10 : step === 2 ? -10 : 0;
    var lift = [step === 1 ? 14 : 0, step === 2 ? 14 : 0];
    var skirt = L.outfit === 'dress' || L.outfit === 'dressApron';
    var wide = L.big ? 10 : 0;
    // hair behind the head (long hair)
    var hy = 108 + bob;
    if (L.style === 'long') {
      rrect(g, 46, hy - 40, 164, back ? 170 : 150, 60);
      paint(g, grad(g, 0, hy - 60, 0, hy + 130, L.hair));
    }
    // legs
    [[86, lift[0]], [132, lift[1]]].forEach(function (l) {
      var top = skirt ? 300 : 262;
      rrect(g, l[0] + (skirt ? 6 : 0), top + bob, skirt ? 28 : 40, 92 - l[1] - (top - 262) - bob, 12);
      paint(g, skirt ? grad(g, 0, top, 0, 354, L.skin) : grad(g, l[0], 0, l[0] + 40, 0, L.pants));
      rrect(g, l[0] - 2, 340 - l[1], 44, 30, 13);
      paint(g, L.shoes);
    });
    // arms
    [[40 - wide, swing], [182 + wide, -swing]].forEach(function (a) {
      var sleeve = L.outfit === 'coat' ? L.coat : L.shirt;
      rrect(g, a[0], 186 + bob + a[1], 36, 86, 18);
      paint(g, grad(g, a[0], 0, a[0] + 36, 0, sleeve));
      ell(g, a[0] + 18, 278 + bob + a[1], 18, 18);
      paint(g, L.skin[0]);
    });
    // torso
    var tx = 64 - wide, tw = 128 + wide * 2;
    if (skirt) {
      g.beginPath();
      g.moveTo(tx + 6, 176 + bob);
      g.lineTo(tx + tw - 6, 176 + bob);
      g.lineTo(tx + tw + 14, 312 + bob);
      g.quadraticCurveTo(128, 324 + bob, tx - 14, 312 + bob);
      g.closePath();
      paint(g, grad(g, 0, 176, 0, 320, L.dress));
      if (L.outfit === 'dressApron' && !back) {
        rrect(g, 88, 200 + bob, 80, 104, 14);
        paint(g, grad(g, 0, 200, 0, 304, L.apron), 5);
      }
      if (!back) {
        rrect(g, 96, 172 + bob, 64, 26, 12);
        paint(g, L.shirt[0], 4);
      }
    } else {
      rrect(g, tx, 176 + bob, tw, 108, 38);
      paint(g, grad(g, 0, 176, 0, 284, L.outfit === 'coat' ? L.coat : L.shirt));
      rrect(g, 72 - wide, 246 + bob, 112 + wide * 2, 52, 20);
      paint(g, grad(g, 0, 246, 0, 298, L.pants));
      if (!back) {
        if (L.outfit === 'overalls') {
          rrect(g, 88, 200 + bob, 80, 74, 14);
          paint(g, grad(g, 0, 200, 0, 274, L.over));
          [[96, 204], [160, 204]].forEach(function (p) { ell(g, p[0], p[1] + bob, 7, 7); paint(g, '#ffd84d', 4); });
        } else if (L.outfit === 'apron') {
          rrect(g, 84 - wide / 2, 196 + bob, 88 + wide, 110, 12);
          paint(g, grad(g, 0, 196, 0, 306, L.apron), 5);
        } else if (L.outfit === 'vest') {
          [[tx + 2, 54], [tx + tw - 56, 54]].forEach(function (v) {
            rrect(g, v[0], 180 + bob, v[1], 96, 22);
            paint(g, grad(g, 0, 180, 0, 276, L.vest), 5);
          });
        } else if (L.outfit === 'coat') {
          rrect(g, 104, 182 + bob, 48, 96, 10);
          paint(g, L.shirt[0], 4);
          ell(g, 128, 200 + bob, 10, 8);
          paint(g, '#e5383f', 3);
        }
      }
    }
    // head
    [[52, hy + 10], [204, hy + 10]].forEach(function (e) {
      ell(g, e[0], e[1], 16, 20);
      paint(g, L.skin[1]);
    });
    ell(g, 128, hy, 80, 78);
    paint(g, back && L.style !== 'bald' ? grad(g, 0, hy - 78, 0, hy + 78, L.hair)
      : rad(g, 104, hy - 20, 8, 128, hy, 86, [[0, L.skin[0]], [1, L.skin[1]]]));
    if (!back) face(g, L, hy);
    hair(g, L, hy, back);
    if (L.hat) hat(g, L, hy, back, false);
  }

  function face(g, L, hy) {
    A.eyes(g, 100, 156, hy + 18);
    if (L.glasses) {
      [100, 156].forEach(function (x) {
        ell(g, x, hy + 18, 20, 18);
        g.lineWidth = 5;
        g.strokeStyle = '#3b2312';
        g.stroke();
      });
    }
    ell(g, 84, hy + 44, 14, 8);
    g.fillStyle = 'rgba(255,110,110,0.4)';
    g.fill();
    ell(g, 172, hy + 44, 14, 8);
    g.fill();
    if (L.beard) {
      g.beginPath();
      g.moveTo(56, hy + 12);
      g.quadraticCurveTo(62, hy + 96, 128, hy + 104);
      g.quadraticCurveTo(194, hy + 96, 200, hy + 12);
      g.quadraticCurveTo(170, hy + 50, 128, hy + 50);
      g.quadraticCurveTo(86, hy + 50, 56, hy + 12);
      paint(g, L.beard, 5);
    }
    if (L.mustache || L.beard) {
      [[-1], [1]].forEach(function (d) {
        ell(g, 128 + d[0] * 18, hy + 40, 20, 9, d[0] * 0.25);
        paint(g, L.mustache || L.beard, 4);
      });
    } else {
      g.beginPath();
      g.arc(128, hy + 40, 18, 0.2 * Math.PI, 0.8 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
    }
  }

  function hair(g, L, hy, back) {
    if (L.style === 'bald') {
      [[58, hy + 2], [198, hy + 2]].forEach(function (p) {
        ell(g, p[0], p[1], 16, 26);
        paint(g, L.hair[0], 4);
      });
      return;
    }
    if (back) {
      if (L.style === 'bun') {
        ell(g, 128, hy - 76, 30, 26);
        paint(g, grad(g, 0, hy - 100, 0, hy - 50, L.hair));
      }
      return;
    }
    g.beginPath();
    g.moveTo(50, hy + 6);
    g.quadraticCurveTo(56, hy - 84, 128, hy - 82);
    g.quadraticCurveTo(200, hy - 84, 206, hy + 6);
    g.quadraticCurveTo(178, hy - 30, 128, hy - 26);
    g.quadraticCurveTo(80, hy - 30, 50, hy + 6);
    paint(g, grad(g, 0, hy - 84, 0, hy, L.hair), 5);
    if (L.style === 'bun') {
      ell(g, 128, hy - 84, 30, 26);
      paint(g, grad(g, 0, hy - 110, 0, hy - 58, L.hair));
    }
    if (L.flower) A.flower(g, 190, hy - 40, 20, L.flower, '#ff8a3d');
    if (L.leaf) A.leaf(g, 186, hy - 30, 40, 16, 0.7, A.LEAF);
  }

  function hat(g, L, hy, back, side) {
    var c = L.hatColor, cx = side ? 130 : 128;
    if (L.hat === 'bandana') {
      g.beginPath();
      g.arc(cx, hy - 20, 80, Math.PI * 1.05, Math.PI * 1.95);
      g.closePath();
      paint(g, grad(g, 0, hy - 100, 0, hy - 20, c));
      rrect(g, cx - 82, hy - 34, 164, 24, 10);
      paint(g, c[1], 5);
      [[0.4], [-0.3]].forEach(function (k) {
        if (back || side) {
          ell(g, cx + 76, hy - 10, 18, 10, k[0] + 1.2);
          paint(g, c[1], 4);
        }
      });
      for (var i = 0; i < 4; i++) {
        ell(g, cx - 40 + i * 26, hy - 60 + (i % 2) * 14, 5, 5);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fill();
      }
    } else if (L.hat === 'cap') { // a peaked cap (the brim points forward, or to the left when seen from the side)
      g.beginPath();
      g.arc(cx, hy - 30, 74, Math.PI, 0);
      g.closePath();
      paint(g, grad(g, 0, hy - 104, 0, hy - 30, c));
      if (side) ell(g, cx - 70, hy - 30, 44, 12);
      else if (!back) ell(g, cx, hy - 26, 66, 16);
      if (side || !back) paint(g, c[1], 4);
      ell(g, cx, hy - 104, 9, 7);
      paint(g, c[1], 3);
    } else if (L.hat === 'chef') {
      rrect(g, cx - 66, hy - 70, 132, 40, 10);
      paint(g, '#ffffff', 5);
      [[-38, -110, 40], [0, -126, 46], [38, -110, 40]].forEach(function (p) {
        ell(g, cx + p[0], hy + p[1], p[2], p[2] * 0.9);
        paint(g, '#ffffff', 5);
      });
      rrect(g, cx - 64, hy - 66, 128, 34, 8);
      g.fillStyle = '#ffffff';
      g.fill();
    } else if (L.hat === 'beret') {
      ell(g, cx + (side ? 6 : 10), hy - 66, 82, 34, side ? 0.12 : -0.12);
      paint(g, grad(g, 0, hy - 100, 0, hy - 32, c));
      ell(g, cx + 4, hy - 100, 8, 8);
      paint(g, c[1], 3);
    } else if (L.hat === 'straw' || L.hat === 'sunhat') {
      var brim = L.hat === 'sunhat' ? 120 : 104;
      ell(g, cx, hy - 32, brim, 28);
      paint(g, grad(g, 0, hy - 60, 0, hy - 4, c));
      g.beginPath();
      g.moveTo(cx - 62, hy - 40);
      g.quadraticCurveTo(cx - 58, hy - 116, cx, hy - 116);
      g.quadraticCurveTo(cx + 58, hy - 116, cx + 62, hy - 40);
      g.closePath();
      paint(g, grad(g, 0, hy - 116, 0, hy - 40, c));
      rrect(g, cx - 62, hy - 60, 124, 16, 6);
      paint(g, L.hat === 'sunhat' ? '#ff8aa4' : '#c8302a', 3);
    } else if (L.hat === 'flatcap') {
      g.beginPath();
      g.moveTo(cx - 80, hy - 26);
      g.quadraticCurveTo(cx - 72, hy - 100, cx + 6, hy - 98);
      g.quadraticCurveTo(cx + 80, hy - 92, cx + 82, hy - 30);
      g.closePath();
      paint(g, grad(g, 0, hy - 100, 0, hy - 26, c));
      if (!back) {
        ell(g, side ? cx - 64 : cx, hy - 26, side ? 40 : 76, 13);
        paint(g, c[1], 4);
      }
    } else if (L.hat === 'nurse') {
      rrect(g, cx - 46, hy - 106, 92, 40, 8);
      paint(g, '#ffffff', 4);
      if (!back) {
        rrect(g, cx - 6, hy - 100, 12, 28, 2);
        g.fillStyle = '#e5484d';
        g.fill();
        rrect(g, cx - 14, hy - 92, 28, 12, 2);
        g.fill();
      }
    } else if (L.hat === 'beanie') {
      g.beginPath();
      g.arc(cx, hy - 24, 80, Math.PI, 0);
      g.closePath();
      paint(g, grad(g, 0, hy - 104, 0, hy - 24, c));
      rrect(g, cx - 82, hy - 40, 164, 26, 10);
      paint(g, c[1], 4);
      ell(g, cx, hy - 108, 18, 16);
      paint(g, '#ffffff', 4);
    } else if (L.hat === 'bucket') {
      ell(g, cx, hy - 26, 104, 26);
      paint(g, grad(g, 0, hy - 50, 0, hy, c));
      g.beginPath();
      g.moveTo(cx - 70, hy - 30);
      g.quadraticCurveTo(cx - 66, hy - 108, cx, hy - 108);
      g.quadraticCurveTo(cx + 66, hy - 108, cx + 70, hy - 30);
      g.closePath();
      paint(g, grad(g, 0, hy - 108, 0, hy - 30, c));
      rrect(g, cx - 70, hy - 50, 140, 14, 5);
      paint(g, '#5a3a1e', 3);
    }
  }

  // ---------- side (facing left) ----------
  function side(g, L, step, bob) {
    var legA = step === 1 ? 0.42 : step === 2 ? -0.3 : 0.06;
    var legB = step === 1 ? -0.3 : step === 2 ? 0.42 : -0.06;
    var arm = step === 1 ? -0.45 : step === 2 ? 0.45 : 0;
    var skirt = L.outfit === 'dress' || L.outfit === 'dressApron';
    var hy = 108 + bob;
    if (L.style === 'long') {
      rrect(g, 110, hy - 40, 98, 150, 48);
      paint(g, grad(g, 0, hy - 40, 0, hy + 110, L.hair));
    }
    var leg = function (ang, far) {
      g.save();
      g.translate(far ? 132 : 126, 270 + bob);
      g.rotate(ang);
      rrect(g, -18, skirt ? 20 : -10, 36, skirt ? 56 : 84, 12);
      paint(g, skirt ? L.skin[far ? 1 : 0] : grad(g, -18, 0, 18, 0, far ? [L.pants[1], L.pants[1]] : L.pants));
      rrect(g, -32, 66, 54, 30, 13);
      paint(g, L.shoes);
      g.restore();
    };
    var limb = function (ang, far) {
      g.save();
      g.translate(far ? 136 : 124, 196 + bob);
      g.rotate(ang);
      var sleeve = L.outfit === 'coat' ? L.coat : L.shirt;
      rrect(g, -16, -10, 32, 84, 16);
      paint(g, grad(g, -16, 0, 16, 0, far ? [sleeve[1], sleeve[1]] : sleeve));
      ell(g, 0, 78, 17, 17);
      paint(g, L.skin[0]);
      g.restore();
    };
    leg(legB, true);
    limb(-arm, true);
    if (skirt) {
      g.beginPath();
      g.moveTo(92, 176 + bob);
      g.lineTo(170, 176 + bob);
      g.lineTo(190, 310 + bob);
      g.quadraticCurveTo(132, 322 + bob, 72, 310 + bob);
      g.closePath();
      paint(g, grad(g, 0, 176, 0, 320, L.dress));
      if (L.outfit === 'dressApron') {
        rrect(g, 76, 206 + bob, 40, 96, 12);
        paint(g, L.apron[0], 4);
      }
    } else {
      rrect(g, 84 - (L.big ? 8 : 0), 174 + bob, 96 + (L.big ? 16 : 0), 112, 36);
      paint(g, grad(g, 84, 0, 180, 0, L.outfit === 'coat' ? L.coat : L.shirt));
      rrect(g, 88, 238 + bob, 90, 56, 20);
      paint(g, grad(g, 0, 238, 0, 294, L.pants));
      if (L.outfit === 'overalls') {
        rrect(g, 88, 196 + bob, 56, 70, 12);
        paint(g, grad(g, 0, 196, 0, 266, L.over));
      } else if (L.outfit === 'apron') {
        rrect(g, 76, 196 + bob, 44, 108, 10);
        paint(g, L.apron[0], 4);
      } else if (L.outfit === 'vest') {
        rrect(g, 92, 180 + bob, 76, 96, 22);
        paint(g, grad(g, 0, 180, 0, 276, L.vest));
      }
      leg(legA, false);
    }
    if (skirt) leg(legA, false);
    // head
    ell(g, 128, hy, 76, 76);
    paint(g, rad(g, 104, hy - 20, 8, 128, hy, 84, [[0, L.skin[0]], [1, L.skin[1]]]));
    if (L.style !== 'bald') {
      g.beginPath();
      g.moveTo(150, hy - 70);
      g.quadraticCurveTo(212, hy - 40, 200, hy + 30);
      g.quadraticCurveTo(170, hy + 10, 150, hy + 20);
      g.closePath();
      paint(g, grad(g, 0, hy - 70, 0, hy + 30, L.hair), 5);
      g.beginPath();
      g.moveTo(60, hy - 30);
      g.quadraticCurveTo(80, hy - 84, 150, hy - 76);
      g.quadraticCurveTo(200, hy - 60, 200, hy - 10);
      g.quadraticCurveTo(150, hy - 40, 60, hy - 30);
      paint(g, grad(g, 0, hy - 84, 0, hy - 10, L.hair), 5);
      if (L.style === 'bun') {
        ell(g, 170, hy - 66, 26, 24);
        paint(g, grad(g, 0, hy - 90, 0, hy - 40, L.hair));
      }
    } else {
      ell(g, 170, hy + 4, 18, 26);
      paint(g, L.hair[0], 4);
    }
    ell(g, 154, hy + 12, 16, 20);
    paint(g, L.skin[1]);
    ell(g, 50, hy + 22, 14, 13);
    paint(g, L.skin[1], 5);
    A.eyes(g, 86, 86, hy + 10);
    if (L.glasses) {
      ell(g, 86, hy + 10, 18, 16);
      g.lineWidth = 5;
      g.strokeStyle = '#3b2312';
      g.stroke();
    }
    if (L.beard) {
      g.beginPath();
      g.moveTo(60, hy + 20);
      g.quadraticCurveTo(70, hy + 96, 140, hy + 80);
      g.quadraticCurveTo(160, hy + 40, 150, hy + 20);
      g.quadraticCurveTo(110, hy + 50, 60, hy + 20);
      paint(g, L.beard, 5);
    } else if (L.mustache) {
      ell(g, 66, hy + 40, 18, 8, 0.2);
      paint(g, L.mustache, 4);
    } else {
      g.beginPath();
      g.arc(70, hy + 44, 14, 0.25 * Math.PI, 0.75 * Math.PI);
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.stroke();
    }
    if (L.flower) A.flower(g, 150, hy - 56, 18, L.flower, '#ff8a3d');
    if (L.leaf) A.leaf(g, 150, hy - 50, 36, 14, 0.5, A.LEAF);
    if (L.hat) hat(g, L, hy, false, true);
    limb(arm, false);
  }

  function person(g, key, dir, step) {
    var L = LOOKS[key], bob = step ? -6 : 0;
    g.save();
    g.scale(0.5, 0.5);
    if (L.child) { // smaller, feet on the same line
      g.translate(128, 372);
      g.scale(0.74, 0.74);
      g.translate(-128, -372);
    }
    if (L.satchel && dir === 'up') satchel(g, L, dir, bob);
    if (dir === 'side') side(g, L, step, bob);
    else front(g, L, dir === 'up', step, bob);
    extras(g, L, dir, step, bob);
    g.restore();
  }

  // Bits drawn over a person: a priest's collar, a stethoscope, a postbag, a walking stick.
  function extras(g, L, dir, step, bob) {
    var back = dir === 'up', sideOn = dir === 'side';
    if (L.collar && !back) {
      rrect(g, sideOn ? 96 : 110, 178 + bob, sideOn ? 30 : 36, 16, 4);
      paint(g, '#ffffff', 3);
    }
    if (L.scope && !back && !sideOn) {
      g.beginPath();
      g.moveTo(98, 184 + bob);
      g.quadraticCurveTo(96, 250 + bob, 128, 256 + bob);
      g.quadraticCurveTo(160, 250 + bob, 158, 184 + bob);
      g.lineWidth = 7;
      g.strokeStyle = '#4a4f58';
      g.stroke();
      ell(g, 128, 262 + bob, 14, 14);
      paint(g, '#c0c6cc', 4);
    }
    if (L.satchel && !back) satchel(g, L, dir, bob);
    if (L.cane) {
      var x = sideOn ? 54 : 40, lean = step === 1 ? 8 : step === 2 ? -8 : 0;
      g.beginPath();
      g.moveTo(x + lean, 262 + bob);
      g.lineTo(x - 6, 366);
      g.lineWidth = 11;
      g.lineCap = 'round';
      g.strokeStyle = '#6a4024';
      g.stroke();
      g.beginPath();
      g.arc(x + lean + 12, 262 + bob, 14, Math.PI, 0);
      g.stroke();
    }
  }

  function satchel(g, L, dir, bob) {
    var back = dir === 'up';
    g.beginPath();
    g.moveTo(80, 180 + bob);
    g.lineTo(176, 270 + bob);
    g.lineWidth = 10;
    g.strokeStyle = '#6a4024';
    g.stroke();
    if (!back) {
      rrect(g, 150, 250 + bob, 62, 50, 10);
      paint(g, lin(g, 0, 250, 0, 300, [[0, '#a8743f'], [1, '#7a4e26']]), 5);
    }
  }
  A.person = person;
  A.PEOPLE_COLS = 18;

  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra ? prevExtra(sets) : { sheets: {}, props: {} };
    // villagers, then the visitors; 18 frames a row (two villagers), so 29 people fit under 4096 px
    var dirs = ['down', 'up', 'side'], order = sets.VILLAGER_ORDER.concat(sets.SHOPPER_KEYS || []);
    var cols = A.PEOPLE_COLS, rows = Math.ceil(order.length * 9 / cols);
    out.sheets.people = A.frameSheet(cols, rows, 128, 192, 8 + cols * 144 - 8, 8 + rows * 208 - 8, function (g, c, r) {
      var f = r * cols + c, v = order[Math.floor(f / 9)];
      if (!v) return false;
      if (!LOOKS[v]) throw new Error('no look for villager ' + v);
      var local = f % 9;
      person(g, v, dirs[Math.floor(local / 3)], local % 3);
    }, function (c, r) { return 'people:' + (r * cols + c); });
    return out;
  };
})();
