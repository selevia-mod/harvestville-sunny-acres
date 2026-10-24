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
  };

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
    if (dir === 'side') side(g, L, step, bob);
    else front(g, L, dir === 'up', step, bob);
    g.restore();
  }
  A.person = person;

  var prevExtra = A.extra;
  A.extra = function (sets) {
    var out = prevExtra ? prevExtra(sets) : { sheets: {}, props: {} };
    var dirs = ['down', 'up', 'side'], order = sets.VILLAGER_ORDER;
    out.sheets.people = A.frameSheet(14, 5, 128, 192, 2048, 1040, function (g, c, r) {
      var f = r * 14 + c, v = order[Math.floor(f / 9)];
      if (!v) return false;
      if (!LOOKS[v]) throw new Error('no look for villager ' + v);
      var local = f % 9;
      person(g, v, dirs[Math.floor(local / 3)], local % 3);
    }, function (c, r) { return 'people:' + (r * 14 + c); });
    return out;
  };
})();
