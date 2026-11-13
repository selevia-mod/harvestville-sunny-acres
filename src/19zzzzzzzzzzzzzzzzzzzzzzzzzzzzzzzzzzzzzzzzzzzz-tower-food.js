// The Lost Tower's food in the world (content 00-zzzzzzzzzzzzzzzzzzzzzzzzz-tower-food.js, rules
// 01-logicZZZZZZZZZZZZZZZZZZZZZ-tower-food.js; the spec docs/superpowers/specs/2026-11-13-tower-food-design.md):
// - the ingredients drop as any hunt's drops do (L.huntDrops: on the floor, picked up by walking over them);
// - eating a Tower dish: its toast, and a chip in the potions' row (its icon, the minutes left; dim outside the Tower);
// - the powers on the tricks: a shield cracks (3 Bow or Javelin hits; the third goes as a Rifle's, so a floor the game
//   server runs breaks it too), a pierce hits the one behind at half damage, one you hit is not mended for 5 s, a feast
//   gives back energy (the puddle, the song, the dark, the splitters and the revivers: the rules' own numbers, asked by
//   19zzz...zz-tower-tricks.js);
// - the Baon: Mang Ilaw sells it (his Gear page, for Gold); held, or from the bag, its page packs and unpacks; in the Tower
//   under 15 energy it feeds you by itself (and before you would faint);
// - the icons: drawn stand-ins painted into frames of the items texture (C.FOOD_ICON_BASE), the owner's
//   'tower_food_icons' once it is here.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var TF = C.TOWER_FOOD;
  if (!TF || !F.WorldScene || !C.FOOD_ICONS) return;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, GOLD = 0x7a5a12;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var inTower = function (w) { return !!(w && w.lair && w.lair.cfg.tower); };
  var name = function (id) { return C.ITEMS[id].name; };

  // ---------- the stand-in icons (128 cells, drawn round their middle) ----------
  var OUT = '#2b1a10';
  var poly = function (g, pts, fill, lw) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (lw !== 0) { g.lineWidth = lw || 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(); }
  };
  var ell = function (g, x, y, rx, ry, fill, lw, rot) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    if (lw !== 0) { g.lineWidth = lw || 4; g.strokeStyle = OUT; g.stroke(); }
  };
  var line = function (g, pts, color, lw) {
    g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.lineWidth = lw || 4; g.strokeStyle = color; g.lineCap = 'round'; g.stroke();
  };
  var star = function (g, x, y, r, fill, lw) {
    var p = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r; p.push(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    poly(g, p, fill, lw);
  };
  var glow = function (g, x, y, r, rgb) {
    var gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',0.8)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // a bowl seen a little from above, filled with soup (its colour), then what is in it (fill)
  var bowl = function (g, soup, rim, fill) {
    g.beginPath(); g.moveTo(-48, -2); g.quadraticCurveTo(-44, 44, 0, 46); g.quadraticCurveTo(44, 44, 48, -2); g.closePath();
    g.fillStyle = rim; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    ell(g, 0, -2, 48, 16, rim);
    ell(g, 0, -2, 41, 11, soup, 2);
    if (fill) fill();
  };
  var plate = function (g, fill) { ell(g, 0, 14, 54, 26, '#f4f0e6'); ell(g, 0, 12, 40, 17, '#e4ddcc', 2); if (fill) fill(); };
  var claw = function (g, x, y, s, fill) {
    g.save(); g.translate(x, y); g.scale(s, s);
    poly(g, [-26, 18, -10, -14, 4, -26, 24, -22, 8, -10, 22, -4, 2, 6, -6, 22], fill);
    g.restore();
  };
  var leg = function (g, x, y, rot, fill) {
    g.save(); g.translate(x, y); g.rotate(rot);
    ell(g, 0, -12, 13, 22, fill);
    line(g, [0, 8, 0, 34], OUT, 9); line(g, [0, 8, 0, 34], '#f0e6d0', 5);
    poly(g, [-12, 32, 12, 32, 6, 42, -6, 42], '#f0e6d0', 3);
    g.restore();
  };
  var shell = function (g, x, y, r, fill) { // a snail's spiral shell
    ell(g, x, y, r, r, fill);
    g.beginPath(); for (var t = 0; t < 12; t += 0.3) { var k = r * (1 - t / 13); g.lineTo(x + Math.cos(t) * k * 0.9, y + Math.sin(t) * k * 0.9); }
    g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  };
  var oyster = function (g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    poly(g, [-34, 0, -24, -18, 0, -24, 26, -18, 36, 0, 22, 18, -20, 18], '#8a8e94');
    ell(g, 0, -1, 24, 13, '#f2ece0', 3);
    g.restore();
  };
  var pepper = function (g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    glow(g, 0, 0, 40, '120,180,255');
    g.beginPath(); g.moveTo(-6, -26); g.quadraticCurveTo(18, -16, 10, 12); g.quadraticCurveTo(4, 30, -4, 36); g.quadraticCurveTo(-14, 10, -6, -26); g.closePath();
    g.fillStyle = '#3a8cff'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    line(g, [-2, -10, 4, 14], 'rgba(220,240,255,0.8)', 4);
    poly(g, [-10, -28, 2, -36, 8, -26, -2, -22], '#4a9a3a', 3);
    g.restore();
  };
  var egg = function (g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(0, -40); g.bezierCurveTo(30, -40, 34, 30, 0, 34); g.bezierCurveTo(-34, 30, -30, -40, 0, -40); g.closePath();
    var gr = g.createLinearGradient(-30, -40, 30, 34); gr.addColorStop(0, '#d8e4ff'); gr.addColorStop(1, '#4a6ab0');
    g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    [[-10, -8], [10, 2], [-8, 16], [12, -18]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 7, Math.PI * 0.1, Math.PI * 0.9); g.lineWidth = 3; g.strokeStyle = '#2a4a8a'; g.stroke(); });
    g.beginPath(); g.arc(-10, -24, 7, 0, Math.PI * 2); g.fillStyle = '#fff8d8'; g.fill(); // (the moon it eats)
    g.restore();
  };
  var DRAW = {
    tw_talangka_meat: function (g) { claw(g, -8, 2, 1.5, '#e8703a'); ell(g, 20, 16, 20, 15, '#fff4ea'); ell(g, 14, 12, 7, 4, '#ffd8c8', 0); },
    tw_pusit: function (g) {
      [-14, -6, 2, 10, 18].forEach(function (x, i) { line(g, [x, 10, x + (i - 2) * 6, 46], OUT, 8); line(g, [x, 10, x + (i - 2) * 6, 46], '#d888c8', 4); });
      poly(g, [0, -46, 26, -6, 22, 14, -22, 14, -26, -6], '#c870b8');
      poly(g, [-26, -6, -40, -20, -20, -24], '#c870b8', 3); poly(g, [26, -6, 40, -20, 20, -24], '#c870b8', 3);
      ell(g, -9, 2, 5, 6, '#fff', 2); ell(g, 9, 2, 5, 6, '#fff', 2); ell(g, -9, 3, 2, 3, OUT, 0); ell(g, 9, 3, 2, 3, OUT, 0);
    },
    tw_kuhol: function (g) {
      g.beginPath(); g.moveTo(-46, 30); g.quadraticCurveTo(-40, 10, 10, 14); g.lineTo(40, 18); g.quadraticCurveTo(48, 30, 30, 34); g.closePath();
      g.fillStyle = '#c8b48a'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      line(g, [36, 18, 44, -4], OUT, 4); line(g, [30, 18, 32, -6], OUT, 4); ell(g, 44, -6, 4, 4, OUT, 0); ell(g, 32, -8, 4, 4, OUT, 0);
      shell(g, -4, -4, 30, '#8a6a3a');
    },
    tw_frog_legs: function (g) { leg(g, -16, -6, -0.35, '#b8d890'); leg(g, 16, -6, 0.35, '#b8d890'); },
    tw_swallow_nest: function (g) {
      g.beginPath(); g.moveTo(-46, -10); g.quadraticCurveTo(-40, 36, 0, 38); g.quadraticCurveTo(40, 36, 46, -10); g.closePath();
      g.fillStyle = '#f6f0e0'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      for (var i = 0; i < 6; i++) line(g, [-40 + i * 4, -4 + i * 7, 40 - i * 4, -2 + i * 7], '#d8ccb0', 3);
      ell(g, 0, -10, 46, 10, '#fffaf0', 3);
    },
    tw_talaba: function (g) { oyster(g, 0, 4, 1.35); ell(g, 6, 2, 9, 9, '#fff', 3); ell(g, 3, -1, 3, 2, 'rgba(255,255,255,0.9)', 0); },
    tw_santelmo_pepper: function (g) { pepper(g, 0, 4, 1.25, 0.3); },
    tw_mangosteen: function (g) {
      glow(g, 0, 6, 54, '255,220,120');
      var gr = g.createRadialGradient(-12, -6, 4, 0, 8, 40); gr.addColorStop(0, '#ffe890'); gr.addColorStop(1, '#c88a18');
      ell(g, 0, 8, 38, 34, gr);
      [-22, -8, 8, 22].forEach(function (x) { poly(g, [x, -22, x - 9, -36, x + 9, -36], '#7aa040', 3); });
      ell(g, -12, -2, 8, 5, 'rgba(255,255,255,0.6)', 0, -0.5);
    },
    tw_star_crab: function (g) { star(g, 0, 4, 46, '#b8a0f0'); star(g, 0, 4, 22, '#e8dcff', 3); ell(g, -7, 0, 4, 4, OUT, 0); ell(g, 7, 0, 4, 4, OUT, 0); },
    tw_bakunawa_egg: function (g) { egg(g, 0, 4, 1.25); },
    sinigang_talangka: function (g) {
      bowl(g, '#e8e0a0', '#7a4a2a', function () {
        ell(g, -18, -4, 9, 6, '#e8463a', 2); ell(g, 0, 2, 8, 5, '#f4f0ea', 2); ell(g, 18, -4, 9, 6, '#e8463a', 2);
        claw(g, 6, -16, 0.7, '#e8703a');
      });
    },
    adobong_pusit: function (g) {
      plate(g, function () {
        ell(g, -18, 10, 22, 12, '#fffaf0', 3);
        ell(g, 16, 12, 24, 13, '#1e1a2a', 2);
        [[8, 8], [22, 14], [16, 4]].forEach(function (p) { ell(g, p[0], p[1], 7, 5, '#d888c8', 3); ell(g, p[0], p[1], 3, 2, '#1e1a2a', 0); });
      });
    },
    ginataang_kuhol: function (g) {
      bowl(g, '#f4e8c8', '#b0763a', function () {
        shell(g, -16, -4, 9, '#8a6a3a'); shell(g, 10, 0, 9, '#8a6a3a');
        ell(g, 26, -6, 7, 4, '#4f9f3a', 2); poly(g, [-4, -10, 4, -14, 6, -10, -2, -6], '#d8323c', 2);
      });
    },
    pritong_palaka: function (g) { plate(g, function () { leg(g, -14, 0, -0.9, '#e0a040'); leg(g, 14, 2, 0.9, '#e0a040'); }); },
    nido_soup: function (g) {
      bowl(g, '#f0d890', '#e8e4dc', function () {
        for (var i = 0; i < 4; i++) line(g, [-28 + i * 4, -6 + i * 2, 26 - i * 5, -8 + i * 3], '#fffaf0', 3);
        ell(g, -14, -2, 6, 4, '#f6cf4a', 2); ell(g, 14, 0, 6, 4, '#f6cf4a', 2);
      });
    },
    inihaw_talaba: function (g) {
      plate(g, function () {
        oyster(g, -20, 10, 0.55); oyster(g, 20, 10, 0.55); oyster(g, 0, 22, 0.55);
        [[-20, 9], [20, 9], [0, 21]].forEach(function (p) { ell(g, p[0], p[1], 7, 4, '#f2a03a', 2); });
        line(g, [-36, -14, -26, -24], '#5a5a5a', 3); line(g, [-26, -12, -16, -22], '#5a5a5a', 3); // (grill smoke)
      });
    },
    bicol_express: function (g) {
      bowl(g, '#f0a860', '#d8d0c0', function () {
        [[-20, -4], [4, 0], [20, -6]].forEach(function (p) { ell(g, p[0], p[1], 6, 4, '#a85a3a', 2); });
        pepper(g, -6, -6, 0.32, 1.2); pepper(g, 14, 2, 0.32, -1.1);
      });
    },
    halo_halo_biringan: function (g) {
      poly(g, [-28, -36, 28, -36, 20, 40, -20, 40], 'rgba(230,245,255,0.9)');
      poly(g, [-25, 10, 25, 10, 20, 38, -20, 38], '#9a6ad0', 0);
      poly(g, [-27, -10, 27, -10, 25, 10, -25, 10], '#fffaf0', 0);
      poly(g, [-28, -36, 28, -36, 20, 40, -20, 40], 'rgba(0,0,0,0)');
      ell(g, 0, -40, 24, 12, '#ffe890', 3); ell(g, 0, -46, 12, 9, '#e0a830', 3);
      line(g, [14, -60, 6, -30], '#d8323c', 5);
    },
    sopas_tala: function (g) {
      bowl(g, '#fff4e4', '#6a5ab0', function () {
        star(g, -16, -4, 9, '#b8a0f0', 2); star(g, 14, -2, 9, '#b8a0f0', 2);
        ell(g, 0, 2, 5, 4, '#f08a30', 2); ell(g, 26, -8, 4, 3, '#f08a30', 2);
      });
    },
    balut_bakunawa: function (g) {
      plate(g, function () {
        poly(g, [-22, 10, 22, 10, 16, 30, -16, 30], '#c8c0b0');
        egg(g, 0, -6, 0.62);
        poly(g, [26, 8, 42, 0, 44, 6, 30, 14], '#d8323c', 3);
        ell(g, -32, 14, 8, 7, '#f6f0e0', 3);
      });
    },
    lugaw_parola: function (g) {
      bowl(g, '#fbf6ea', '#c8463a', function () {
        ell(g, -12, -2, 10, 7, '#fff', 2); ell(g, -12, -2, 5, 4, '#f6c030', 0);
        [[10, -8], [18, 0], [4, 2]].forEach(function (p) { line(g, [p[0], p[1], p[0] + 8, p[1] - 2], '#e8b860', 4); });
        ell(g, 24, -8, 3, 3, '#4f9f3a', 0); ell(g, 20, -12, 3, 3, '#4f9f3a', 0);
      });
    },
    baon: function (g) { // a lunchbox, three tins stacked in a carrier with a handle
      line(g, [-30, -8, -30, -44, 30, -44, 30, -8], OUT, 9); line(g, [-30, -8, -30, -44, 30, -44, 30, -8], '#e0b040', 5);
      [[28, '#c8d0dc'], [6, '#d8dee8'], [-16, '#c8d0dc']].forEach(function (t) { poly(g, [-34, t[0] - 11, 34, t[0] - 11, 32, t[0] + 11, -32, t[0] + 11], t[1]); });
      line(g, [-36, 41, 36, 41], OUT, 4);
      ell(g, 0, -27, 34, 6, '#e8ecf2', 3);
      ell(g, 0, 6, 6, 4, '#2f4878', 2);
    },
  };
  var have = function (k) { return !!(F.images && F.images[k]); };
  var iconCanvas = function () {
    var n = C.FOOD_ICONS.length, cv = document.createElement('canvas'), g = cv.getContext('2d'), art = have('tower_food_icons') && F.images.tower_food_icons;
    cv.width = 1024;
    cv.height = Math.ceil(n / 8) * 128;
    C.FOOD_ICONS.forEach(function (id, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
      g.save();
      g.translate(x, y);
      g.beginPath(); g.rect(2, 2, 124, 124); g.clip();
      if (art) g.drawImage(art, x, y, 128, 128, 0, 0, 128, 128);
      else { g.translate(64, 64); DRAW[id](g); }
      g.restore();
    });
    return cv;
  };
  F.paintFoodIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = iconCanvas(), src = tex.foodSrc;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.foodSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.FOOD_ICONS.forEach(function (id, i) {
      var key = C.FOOD_ICON_BASE + i;
      if (tex.has(key)) tex.remove(key);
      tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128);
    });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintFoodIcons(scene);
    return out;
  };
  if (F.bus) F.bus.on('packart', function (key) { if (key === 'tower_food_icons' && F.world) F.paintFoodIcons(F.world); });
  var askIcons = function () { if (!have('tower_food_icons') && F.needImage && F.packedFile && F.packedFile('tower_food_icons')) F.needImage('tower_food_icons'); };
  // (owner, 13 Nov 2026: "Check the drops in towers and the lunch box, why those arts did not change?" - the picture was
  // asked for only by the bag and the Kitchen, so in the Tower the drops and the Baon showed the drawn stand-ins. Ask on
  // the way in, and in Manila too, so it is there before the first drop.)
  if (F.bus) F.bus.on('map', function (key) { if (key === 'tower' || key === 'manila') askIcons(); });

  // ---------- eating a Tower dish ----------
  var eat = P.eat;
  P.eat = function () {
    var s = this.state, held = L.held(s), p = held && TF.dishes[held.id];
    if (!p) return eat.apply(this, arguments);
    var nm = name(held.id), gain = L.eat(s, s.sel), f = this.feet();
    sfx('eat');
    if (gain > 0) this.floatTextAt(f.x, f.y - 2 * T, '+' + gain + ' energy');
    F.ui.toast(nm + ': in The Lost Tower, for ' + TF.mins + ' minutes, ' + p.text + '.' + (inTower(this) ? '' : ' (It works inside the Tower.)'), 3400);
    this.powerChip();
    this.changed();
  };
  // its chip: in the potions' row, after the dish's, the Power-Up's and the potions' chips
  var chip = P.powerChip;
  P.powerChip = function () {
    chip.apply(this, arguments);
    var ui = F.ui, s = F.session.state;
    if (!ui || !ui.add || !ui.dishChip || !s) return;
    var left = L.towerDishLeft(s), c = ui.foodChip;
    if (!c && left > 0) {
      var bg = ui.add.rectangle(0, 0, 74, 26, 0x1e2a4a, 0.82).setOrigin(0, 0.5);
      var ic = ui.add.image(14, 0, 'items', C.ITEMS[s.tfd.id].icon).setScale(0.17);
      var tx = ui.add.text(27, 0, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff6e0' }).setOrigin(0, 0.5);
      c = ui.foodChip = { box: ui.add.container(8, 238, [bg, ic, tx]).setDepth(45), icon: ic, text: tx };
      ui.events.once('shutdown', function () { ui.foodChip = null; });
    }
    if (!c) return;
    c.box.setVisible(left > 0);
    if (!(left > 0)) return;
    var y = 238 - 30, pot = ui.potChips || {};
    [ui.dishChip, ui.powerChipBox].concat(Object.keys(pot).map(function (k) { return pot[k].box; })).forEach(function (b) { if (b && b.visible) y = Math.max(y, b.y); });
    c.box.setY(y + 30).setAlpha(this.mapKey === 'tower' ? 1 : 0.6);
    c.icon.setFrame(C.ITEMS[s.tfd.id].icon);
    c.text.setText(Math.ceil(left) + ' min');
  };

  // ---------- the powers on a hit: a cracked shield, a pierce, no mending ----------
  var piercing = false;
  var struck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    if (friend || piercing || !inTower(this) || this.wild.lead) return struck.apply(this, arguments);
    var s = this.state, w0 = s.wpnHit, k = w0 ? w0.k : null, swap = false, FX = F.towerFx;
    if (a.shield) {
      var n = (a.tfCrack || 0) + 1, r = L.towerShieldCrack(s, k, n);
      if (r === 'crack') { a.tfCrack = n; if (FX) FX.word(this, 'Crack ' + n + '/' + TF.crack, a.x, a.y - (1.5 + a.def.w * a.size) * T, '#ffd8a0'); }
      else if (r === 'break' && k !== 'rifle') { a.tfCrack = 0; swap = true; s.wpnHit = { k: 'rifle', lv: 0 }; } // (as a Rifle's: the server breaks it too)
    }
    var hp = a.hp, d = L.bowDamage(s), out;
    try { out = struck.apply(this, arguments); } finally { if (swap) s.wpnHit = w0; }
    if (L.towerPower(s, 'noheal')) a.tfNoHeal = this.time.now + TF.noHeal;
    if (L.towerPower(s, 'pierce') && a.hp < hp && this.wild) {
      var f = this.feet(), b = L.towerBehind(this.wild.animals, a, f.x, f.y, T);
      if (b) {
        piercing = true;
        s.tfDmg = L.towerPierceDamage(d);
        s.wpnHit = null; // (a pierce is no weapon's: it never breaks a shield)
        try { struck.call(this, b); } finally { piercing = false; s.tfDmg = null; delete s.tfDmg; s.wpnHit = w0; }
        if (L.towerPower(s, 'noheal')) b.tfNoHeal = this.time.now + TF.noHeal;
      }
    }
    return out;
  };
  // a feast: energy back for each enemy you beat
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    var r = wildDown.apply(this, arguments);
    if (inTower(this) && a.mine && this.wild && this.wild.animals.indexOf(a) < 0) {
      var g = L.towerFeast(this.state);
      if (g) { var f = this.feet(); this.floatTextAt(f.x, f.y - 2 * T, '+' + g + ' energy'); F.bus.emit('hud'); }
    }
    return r;
  };

  // ---------- the Baon feeds you ----------
  P.baonCheck = function () {
    var s = this.state;
    if (!inTower(this) || F.session.visit || !L.baonDue(s)) return false;
    var r = L.baonEat(s);
    if (!r) return false;
    var f = this.feet(), left = L.baonList(s).length;
    sfx('eat');
    if (r.gain > 0) this.floatTextAt(f.x, f.y - 2 * T, '+' + r.gain + ' energy');
    if (F.ui) F.ui.toast('Your Baon: you ate the ' + name(r.id) + '! ' + (left ? left + ' more packed.' : 'It is empty now.'), 3000, GOLD);
    F.bus.emit('hud');
    this.powerChip();
    this.changed();
    return true;
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (!inTower(this) || this.busy || !this.sys.isActive()) return;
    if ((this.baonMs = (this.baonMs || 0) - delta) > 0) return;
    this.baonMs = 250;
    this.baonCheck();
  };
  // (a big hit to 0: the Baon first, if it has food)
  var faint = P.faint;
  P.faint = function () {
    if (inTower(this) && this.baonCheck() && this.state.energy > 0) return;
    return faint.apply(this, arguments);
  };

  // ---------- the Baon held, or from the bag: its page ----------
  var resolve = P.resolve;
  P.resolve = function () {
    var r = resolve.apply(this, arguments), held = L.held(this.state);
    if (!r && held && held.id === 'baon' && !F.session.visit) return { label: 'Baon', icon: C.ITEMS.baon.icon, run: function () { F.ui.openBaon(0); } };
    return r;
  };
  U.openBaon = function (page) {
    var self = this, s = F.session.state, list = L.baonList(s), rows = [];
    var again = function (msg) {
      sfx('pick');
      F.session.dirty = true;
      if (F.world) { F.world.changed(); F.world.save(); }
      self.closeModal();
      self.openBaon(page);
      if (msg) self.toast(msg, 1800, 0x2f5a22);
    };
    list.forEach(function (id, k) {
      rows.push({ icon: C.ITEMS[id].icon, name: name(id) + ' (packed)', desc: '+' + L.energyOf(id) + ' energy.' + (k ? '' : ' Eaten first.'),
        buttons: [{ label: 'Unpack', color: GREY, cb: function () {
          if (L.baonUnpack(s, k) !== 'ok') { sfx('nope'); return self.toast('Your bag is full.'); }
          again();
        } }] });
    });
    var seen = {};
    s.inv.forEach(function (slot, i) {
      if (!slot || seen[slot.id] || !L.baonFood(slot.id)) return;
      seen[slot.id] = true;
      rows.push({ icon: C.ITEMS[slot.id].icon, name: name(slot.id) + '  x' + L.countItem(s, slot.id), desc: '+' + L.energyOf(slot.id) + ' energy.',
        buttons: [{ label: 'Pack', color: list.length < TF.baon.slots ? GREEN : GREY, cb: function () {
          var r = L.baonPack(s, i);
          if (r === 'full') { sfx('nope'); return self.toast('The Baon holds ' + TF.baon.slots + '. Unpack one first.'); }
          if (r !== 'ok') { sfx('nope'); return self.toast('Not that.'); }
          again(name(slot.id) + ' packed.');
        } }] });
    });
    if (!rows.length) rows.push({ icon: C.ITEMS.baon.icon, name: 'Nothing to pack', desc: 'Cook something in the Kitchen, then pack it here.' });
    this.listPanel({ title: 'Baon', rows: rows, page: page || 0, slim: true, reopen: function (t, p) { self.openBaon(p); },
      sub: function () { return 'Packed ' + list.length + ' of ' + TF.baon.slots + '. In The Lost Tower, under ' + TF.baon.under + ' energy, it feeds you by itself.'; } });
  };
  // the bag: with the Baon held, a Baon button where Eat is
  var openInventory = U.openInventory;
  U.openInventory = function () {
    askIcons();
    var r = openInventory.apply(this, arguments), s = F.session.state, m = this.modals[this.modals.length - 1], refresh = this.invRefresh, self = this;
    if (!s || !m || !m.c || typeof refresh !== 'function' || !L.baonOwned(s)) return r;
    var eatBtn = null;
    m.c.list.forEach(function (o) { if (!eatBtn && o.type === 'Container' && o.list.some(function (t) { return t.type === 'Text' && t.text === 'Eat'; })) eatBtn = o; });
    if (!eatBtn) return r;
    var btn = this.button(m.c, eatBtn.x, eatBtn.y, 76, 42, 'Baon', function () { self.closeModal(); self.openBaon(0); }, BLUE);
    this.invRefresh = function () {
      refresh.apply(this, arguments);
      var held = L.held(s);
      if (btn.active) btn.setVisible(!!held && held.id === 'baon');
    };
    this.invRefresh();
    return r;
  };
  var openKitchen = U.openKitchen;
  U.openKitchen = function () { askIcons(); return openKitchen.apply(this, arguments); };

  // ---------- Mang Ilaw sells it: his Gear page, for Gold ----------
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    var K = C.KEEPER, s = F.session && F.session.state, self = this;
    if (K && s && o && o.tab === 'gear' && o.title === K.person.name + "'s Shop" && Array.isArray(o.rows)) {
      var own = L.baonOwned(s), price = TF.baon.price;
      var row = { icon: C.ITEMS.baon.icon, name: 'Baon' + (own ? ' (yours)' : ''),
        desc: 'A lunchbox for the Tower: pack ' + TF.baon.slots + ' foods; under ' + TF.baon.under + ' energy it feeds you by itself. Paid in Gold.',
        buttons: [own ? { label: 'Open', color: BLUE, cb: function () { self.closeModal(); self.openBaon(0); } }
          : { label: fmt(price) + 'G', color: (s.gold || 0) >= price ? GREEN : GREY, cb: function () {
            var res = L.baonBuy(s);
            if (res === 'gold') { sfx('nope'); return self.toast('You need ' + fmt(price - (s.gold || 0)) + ' more Gold.', 2400); }
            if (res === 'full') { sfx('nope'); return self.toast('Your bag is full.'); }
            if (res !== 'ok') return null;
            sfx('coin');
            F.session.dirty = true;
            if (F.world) { F.world.changed(); F.world.save(); }
            F.bus.emit('hud');
            self.closeModal();
            self.openKeeper('gear', o.page || 0);
            self.toast('A Baon! Hold it (or open your bag) to pack it with food.', 3000, 0x2f5a22);
            return null;
          } }] };
      var rows = o.rows.slice();
      rows.splice(Math.max(0, rows.length - 1), 0, row); // (before "A new weapon")
      o = Object.assign({}, o, { rows: rows });
    }
    return listPanel.apply(this, [o].concat([].slice.call(arguments, 1)));
  };
})(window.Farm = window.Farm || {});
