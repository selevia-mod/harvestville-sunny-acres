// Farm economy v2, parts 2, 3 and 4 on the farm and in the panels (content 00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js, rules
// 01-logicZZZZZZZZZZZZZZZZZ-economy2.js):
//  - the Silo: every farm gets one the first time it opens (C.SILO.at, or the nearest free spot); face it for its panel:
//    store the bag's crops, take some out, make it bigger
//  - the Mixer is a workshop (19k-farm2.js runs it like the Bakery)
//  - potions: drunk, with a chip for each under the dish's (its icon and the minutes left)
//  - pictures: the Mixer and the Silo are drawn here until the owner's pictures are in assets/props (mixer.png, silo.png);
//    the materials' and potions' icons are drawn here until the 'econ' pack (the owner's, tools/art/economy2-icons.js) is
//    on the phone, then painted from it. Neither adds a picture to the page.
// (the Raid Camp's crops and materials, and the crops a raid brings home: in the raid panels themselves)
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR, S = C.SILO, T = C.TILE;
  var P = F.WorldScene.prototype, U = F.UIScene.prototype;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, OUT = '#3b2312';
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var own = function (w) { return w && w.mapKey === 'farm' && !w.state.isVisit && !F.session.visit && !F.session.raid; };
  var canvas = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  var shape = function (g, fill, pts, lw) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = lw || 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
  };
  var oval = function (g, fill, x, y, rx, ry, lw) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = lw || 4; g.strokeStyle = OUT; g.stroke(); };
  var box = function (g, fill, x, y, w, h, lw) { shape(g, fill, [x, y, x + w, y, x + w, y + h, x, y + h], lw); };

  // ---------- the stand-in pictures (64 a tile; seen a little from above) ----------
  var DRAW = {
    'props/mixer': function () { // a wooden hut with a red roof, a big mixing barrel with its paddle, a sack
      var cv = canvas(192, 192), g = cv.getContext('2d');
      box(g, '#b07a46', 14, 92, 112, 94);
      for (var y = 108; y < 186; y += 16) { g.beginPath(); g.moveTo(16, y); g.lineTo(124, y); g.lineWidth = 2; g.strokeStyle = 'rgba(59,35,18,0.35)'; g.stroke(); }
      shape(g, '#c8463a', [4, 96, 30, 40, 110, 40, 136, 96]);
      box(g, '#6b4020', 54, 130, 32, 56);
      box(g, '#8fc7e8', 24, 112, 22, 18, 3);
      oval(g, '#9a6a3a', 154, 132, 34, 16);
      box(g, '#9a6a3a', 120, 132, 68, 50, 0);
      g.beginPath(); g.moveTo(120, 132); g.lineTo(120, 176); g.quadraticCurveTo(154, 196, 188, 176); g.lineTo(188, 132); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      [146, 164].forEach(function (y) { g.beginPath(); g.moveTo(120, y); g.quadraticCurveTo(154, y + 16, 188, y); g.lineWidth = 5; g.strokeStyle = '#5d636b'; g.stroke(); });
      oval(g, '#e8d9a8', 154, 132, 28, 11, 3);
      g.beginPath(); g.moveTo(150, 132); g.lineTo(176, 84); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#d8b46a'; g.stroke();
      shape(g, '#e2c48e', [92, 186, 96, 156, 112, 150, 124, 158, 126, 186], 3);
      return cv;
    },
    'props/silo': function () { // a tall round silo with metal bands, a red dome, a ladder and a little door
      var cv = canvas(192, 256), g = cv.getContext('2d');
      g.beginPath(); g.moveTo(36, 70); g.lineTo(36, 236); g.quadraticCurveTo(96, 258, 156, 236); g.lineTo(156, 70); g.closePath();
      g.fillStyle = '#d9c9a4'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      [100, 140, 180, 220].forEach(function (y) { g.beginPath(); g.moveTo(36, y); g.quadraticCurveTo(96, y + 18, 156, y); g.lineWidth = 6; g.strokeStyle = '#8a929c'; g.stroke(); });
      g.beginPath(); g.moveTo(30, 74); g.quadraticCurveTo(30, 8, 96, 6); g.quadraticCurveTo(162, 8, 162, 74); g.quadraticCurveTo(96, 92, 30, 74); g.closePath();
      g.fillStyle = '#c8463a'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.moveTo(70, 22); g.quadraticCurveTo(88, 12, 110, 14); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke();
      [128, 146].forEach(function (x) { g.beginPath(); g.moveTo(x, 84); g.lineTo(x, 236); g.lineWidth = 4; g.strokeStyle = '#6b4020'; g.stroke(); });
      for (var y = 96; y < 236; y += 18) { g.beginPath(); g.moveTo(128, y); g.lineTo(146, y); g.lineWidth = 3; g.strokeStyle = '#6b4020'; g.stroke(); }
      box(g, '#7a4a22', 60, 196, 34, 46);
      shape(g, '#e2c48e', [8, 250, 10, 222, 40, 218, 42, 250], 3);
      oval(g, '#f2c94c', 18, 220, 7, 5, 2); oval(g, '#e07a3a', 32, 219, 7, 5, 2);
      return cv;
    },
  };
  // ---------- the stand-in icons (128 a cell) ----------
  var bottle = function (g, liquid) {
    shape(g, '#e8f4f8', [44, 46, 84, 46, 84, 56, 98, 70, 98, 112, 30, 112, 30, 70, 44, 56]);
    shape(g, liquid, [34, 78, 94, 78, 94, 108, 34, 108], 0);
    box(g, '#b07a46', 50, 30, 28, 16, 3);
  };
  var sack = function (g, cloth, top) {
    shape(g, cloth, [30, 52, 98, 52, 110, 112, 18, 112]);
    oval(g, top, 64, 50, 36, 12, 3);
  };
  var ICON = {
    ginger_tonic: function (g) { bottle(g, '#f29a2e'); oval(g, '#e2c48e', 98, 104, 16, 9, 3); },
    ampalaya_brew: function (g) { bottle(g, '#6ab04a'); oval(g, '#4f9f3a', 98, 104, 18, 10, 3); },
    pineapple_juice: function (g) { shape(g, '#fff6dc', [34, 34, 94, 34, 86, 114, 42, 114]); shape(g, '#f6cf4a', [37, 52, 91, 52, 86, 110, 42, 110], 0); oval(g, '#f2b632', 90, 36, 14, 10, 3); },
    hunters_coffee: function (g) { shape(g, '#fff6dc', [24, 52, 96, 52, 88, 104, 32, 104]); oval(g, '#5a3a1a', 60, 54, 34, 8, 3); g.beginPath(); g.arc(98, 74, 12, -1.4, 1.4); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); oval(g, '#fff6dc', 60, 110, 46, 7, 3); },
    farm_cement: function (g) { sack(g, '#b8b4ac', '#d8d4cc'); shape(g, '#9aa3ad', [80, 96, 110, 76, 116, 84, 88, 104], 3); },
    rope: function (g) { [40, 30, 20, 10].forEach(function (r) { g.beginPath(); g.ellipse(64, 72, r * 1.2, r, 0, 0, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#c9965a'; g.stroke(); }); },
    sili_powder: function (g) { sack(g, '#f0e2c0', '#d8323c'); shape(g, '#d8323c', [50, 94, 80, 86, 86, 92, 56, 100], 3); },
    beeswax: function (g) { shape(g, '#f2b632', [20, 66, 64, 46, 108, 66, 108, 98, 64, 118, 20, 98]); shape(g, '#f6cf4a', [20, 66, 64, 46, 108, 66, 64, 86], 3); oval(g, '#3b2312', 70, 40, 7, 5, 2); },
  };
  // the icons' canvas (the owner's from the 'econ' pack once it is here), as frames of the items texture: their own icon
  // numbers, the sheet's empty cells after the last icon, until they are painted into the sheet itself (C.ECON2_ICONS_IN)
  var iconCanvas = function () {
    var cv = canvas(512, 256), g = cv.getContext('2d'), art = F.images && F.images.econ2_icons;
    if (art) g.drawImage(art, 0, 0, 512, 256);
    else C.ECON2_ICONS.forEach(function (id, i) { g.save(); g.translate((i % 4) * 128, Math.floor(i / 4) * 128); ICON[id](g); g.restore(); });
    return cv;
  };
  F.paintEcon2Icons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || C.ECON2_ICONS_IN || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = iconCanvas(), src = tex.econ2Src;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.econ2Src = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.ECON2_ICONS.forEach(function (id, i) {
      var key = C.ICON[id];
      if (tex.has(key)) tex.remove(key);
      tex.add(key, at, (i % 4) * 128, Math.floor(i / 4) * 128, 128, 128);
    });
  };
  // The owner's pictures are fetched when a page that shows these goods first opens (the bag, a workshop such as the
  // Mixer, the Silo, the Kitchen, a shop), never as the game opens: the farm comes first (19zl-packs-ui.js). Until then,
  // and offline, the drawn ones above.
  var fetchIcons = function () {
    if (F.needImage && F.packedFile && !(F.images && F.images.econ2_icons) && F.packedFile('econ2_icons')) F.needImage('econ2_icons');
  };
  // (wrapped at the end of this file, once the Silo's page is here too)
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    if (DRAW[key] && F.images && !F.images[key]) F.images[key] = DRAW[key]();
    var had = key === 'items' && scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintEcon2Icons(scene);
    return out;
  };
  if (F.bus) F.bus.on('packart', function (key) { if (key === 'econ2_icons' && F.world) F.paintEcon2Icons(F.world); });
  if (F.PACK_INFO) F.PACK_INFO.econ = { name: 'Farm goods', icon: 'gift', desc: 'The pictures of the Mixer\'s materials and the crop potions.' };

  // ---------- the Silo on the farm ----------
  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    if (own(this)) L.giveSilo(this.state, F.farm()); // (saved with the farm's next save)
    return buildObjects.apply(this, arguments);
  };
  var siloAt = function (s, x, y) {
    var t = O.index.silo;
    return (s.yard.items || []).filter(function (it) { return it.t === t && x >= it.x && x < it.x + 3 && y >= it.y && y < it.y + 4; })[0];
  };
  var farm2Action = P.farm2Action;
  P.farm2Action = function (t) {
    if (siloAt(this.state, t.x, t.y)) return { label: 'Silo', icon: C.ITEMS.corn.icon, run: function () { F.ui.openSilo(0); } };
    return farm2Action.call(this, t);
  };
  var name = function (id) { return C.ITEMS[id].name; };
  U.openSilo = function (page) {
    var self = this, s = F.session.state, sl = L.silo(s), next = L.siloNext(s);
    var done = function (msg) { sfx('coin'); if (F.world) { F.world.changed(); F.world.save(); } self.closeModal(); self.openSilo(page); if (msg) self.toast(msg, 2200, 0x2f5a22); };
    var rows = [{ icon: C.ITEMS.wheat.icon, name: 'Store your crops',
      desc: 'Every crop in your bag goes in. The Raid Camp, the Mixer, the Kitchen and the workshops take from it; won raids fill it.',
      buttons: [{ label: 'Store all', color: GREEN, cb: function () {
        var n = L.siloStore(s);
        if (!n) { sfx('nope'); return self.toast(L.siloCount(s) >= L.siloCap(s) ? 'The Silo is full. Make it bigger.' : 'No crops in your bag to store.', 2200); }
        done(n + ' crops stored.');
      } }] }];
    rows.push({ icon: C.ITEMS.farm_cement.icon, name: next ? 'Bigger Silo: room for ' + next.cap : 'The biggest Silo',
      desc: next ? 'Needs ' + next.gold.toLocaleString('en-US') + 'G, ' + next.lumber + ' lumber, ' + next.cement + ' Farm Cement (from the Mixer).' : 'Room for ' + L.siloCap(s) + ' crops.',
      buttons: next ? [{ label: 'Build', color: BLUE, cb: function () {
        var r = L.siloUp(s);
        if (r !== 'ok') { sfx('nope'); return self.toast({ gold: 'Not enough Gold.', lumber: 'Not enough lumber.', cement: 'You need ' + next.cement + ' Farm Cement from the Mixer.' }[r] || 'Not now.', 2400); }
        done('The Silo holds ' + L.siloCap(s) + ' crops now!');
      } }] : [] });
    Object.keys(sl.c).sort(function (a, b) { return name(a) < name(b) ? -1 : 1; }).forEach(function (id) {
      rows.push({ icon: C.ITEMS[id].icon, name: name(id) + '  x' + sl.c[id], desc: '',
        buttons: [{ label: 'Take ' + Math.min(S.take, sl.c[id]), color: GREY, cb: function () {
          if (!L.siloOut(s, id, S.take)) { sfx('nope'); return self.toast('Your bag is full!'); }
          done();
        } }] });
    });
    this.listPanel({ title: 'Silo', rows: rows, page: page || 0, slim: true, reopen: function (tab, p) { self.openSilo(p); },
      sub: function () { return 'Level ' + (sl.lv + 1) + '   ·   ' + L.siloCount(s) + ' / ' + L.siloCap(s) + ' crops'; } });
  };
  var yardInfo = F.yardInfo;
  F.yardInfo = function (s, i) {
    var type = O.types[i];
    if (type && type.key === 'silo') return 'Keeps your crops: ' + L.siloCap(s) + ' to start, more as you build it up.';
    return yardInfo ? yardInfo(s, i) : null;
  };

  // ---------- potions ----------
  var resolve = P.resolve;
  P.resolve = function () {
    var r = resolve.apply(this, arguments), held = L.held(this.state);
    if (r && r.label === 'Eat' && held && C.DRINKS.indexOf(held.id) >= 0) r.label = 'Drink';
    return r;
  };
  var eat = P.eat;
  P.eat = function () {
    var s = this.state, held = L.held(s), p = held && C.POTIONS[held.id];
    if (!p) return eat.apply(this, arguments);
    var nm = C.ITEMS[held.id].name, gain = L.eat(s, s.sel), f = this.feet();
    sfx('eat');
    if (gain > 0) this.floatTextAt(f.x, f.y - 2 * T, '+' + gain + ' energy');
    F.ui.toast(nm + ': for ' + L.potionMins(p.key) + ' minutes, ' + p.text + '.', 3000);
    this.powerChip();
    this.changed();
  };
  // a chip for each potion on, under the dish's and the Power-Up's
  var ICON_OF = {};
  Object.keys(C.POTIONS).forEach(function (id) { ICON_OF[C.POTIONS[id].key] = C.ITEMS[id].icon; });
  var chip = P.powerChip;
  P.powerChip = function () {
    chip.apply(this, arguments);
    var ui = F.ui, s = F.session.state;
    if (!ui || !ui.add || !ui.dishChip) return;
    var y = 238 + (ui.dishChip.visible ? 30 : 0) + (ui.powerChipBox && ui.powerChipBox.visible ? 30 : 0);
    ui.potChips = ui.potChips || {};
    C.POTION_KEYS.forEach(function (k) {
      var left = L.potionLeft(s, k), c = ui.potChips[k];
      if (!c && left > 0) {
        var bg = ui.add.rectangle(0, 0, 74, 26, 0x2e1c0c, 0.78).setOrigin(0, 0.5);
        var ic = ui.add.image(14, 0, 'items', ICON_OF[k]).setScale(0.17);
        var tx = ui.add.text(27, 0, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff6e0' }).setOrigin(0, 0.5);
        c = ui.potChips[k] = { box: ui.add.container(8, y, [bg, ic, tx]).setDepth(45), text: tx };
      }
      if (!c) return;
      c.box.setVisible(left > 0);
      if (left > 0) { c.box.setY(y); c.text.setText(Math.ceil(left) + ' min'); y += 30; }
    });
  };

  // ---------- the goods' pictures, fetched as their pages first open (fetchIcons, above) ----------
  ['openInventory', 'openWorkshop', 'openSilo', 'openKitchen', 'openShop'].forEach(function (name) {
    var open = U[name];
    if (typeof open !== 'function') return;
    U[name] = function () { fetchIcons(); return open.apply(this, arguments); };
  });
})(window.Farm = window.Farm || {});
