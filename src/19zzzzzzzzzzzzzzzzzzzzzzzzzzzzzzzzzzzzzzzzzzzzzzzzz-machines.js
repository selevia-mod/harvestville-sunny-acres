// Bram's farm machines in the world (rules 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-machines.js, numbers C.MACHINES).
// - Bram's Forge: a row each (Make; a made one missing from the bag and Storage: Take it, free).
// - Driven (owner, 20 Nov 2026): getting in, driving and the work it does as it goes are in 19zzz...z-machines-drive.js
//   (this file: the pictures drawn until the owner's are in, what it would do on a tile: P.mkWork, the Forge, the tours).
//   The old way (a tap worked the 3x3 ahead, held a row of 9) is gone.
// - A first-time tour, the first time the Forge opens after the sprinklers' own tour.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MACHINES, K = C.MACHINE_KINDS;
  if (!M) return;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var INK = F.UI_CONST.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, DARK_GREEN = 0x2f5a22;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || v || F.session.raid); };

  // ---------- the pictures: side on, facing right, in a 192 x 128 box (its wheels on y 120) ----------
  var wheel = function (g, x, y, r, hub) {
    g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = hub; g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill();
    g.fillStyle = '#5a4a2a'; g.beginPath(); g.arc(x, y, r * 0.16, 0, 7); g.fill();
  };
  var box = function (g, x, y, w, h, fill, r) {
    g.fillStyle = fill; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r || 8); else g.rect(x, y, w, h); g.fill();
    g.strokeStyle = 'rgba(40,24,10,0.75)'; g.lineWidth = 4; g.stroke();
  };
  var DRAW = {
    tractor: function (g) {
      box(g, 92, 50, 82, 40, '#d8432f', 10); // the bonnet
      g.fillStyle = '#7a1f14'; for (var i = 0; i < 4; i++) g.fillRect(150, 58 + i * 8, 18, 4); // its grille
      box(g, 36, 18, 62, 60, '#f2efe4', 6); // the cab
      g.fillStyle = '#9fd3ea'; g.fillRect(46, 26, 42, 28);
      box(g, 30, 10, 74, 12, '#d8432f', 5); // the roof
      box(g, 132, 22, 9, 30, '#4a4a4a', 3); // the exhaust
      wheel(g, 58, 90, 32, '#f2c230');
      wheel(g, 154, 102, 18, '#f2c230');
    },
    seeder: function (g) {
      g.strokeStyle = '#5a3a1e'; g.lineWidth = 6; g.beginPath(); g.moveTo(26, 82); g.lineTo(186, 82); g.stroke(); // its frame
      g.fillStyle = '#3e7a2e'; g.beginPath(); g.moveTo(40, 22); g.lineTo(156, 22); g.lineTo(140, 76); g.lineTo(56, 76); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,20,8,0.75)'; g.lineWidth = 4; g.stroke();
      box(g, 34, 12, 128, 14, '#f2c230', 5); // the lid
      ['#e9c46a', '#8ab04a', '#d9894a'].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(70 + i * 28, 46, 9, 0, 7); g.fill(); }); // seeds in the window
      g.strokeStyle = '#4a4a4a'; g.lineWidth = 5;
      for (var x = 62; x <= 140; x += 26) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x - 6, 116); g.stroke(); } // the drills
      wheel(g, 40, 102, 18, '#f2c230');
      wheel(g, 160, 102, 18, '#f2c230');
    },
    harvester: function (g) {
      box(g, 20, 40, 130, 58, '#f2c230', 10); // the body
      box(g, 104, 8, 54, 40, '#f2efe4', 6); // the cab
      g.fillStyle = '#9fd3ea'; g.fillRect(112, 14, 38, 24);
      g.strokeStyle = '#8a6a12'; g.lineWidth = 7; g.beginPath(); g.moveTo(34, 44); g.lineTo(14, 16); g.stroke(); // the grain pipe
      box(g, 150, 72, 38, 38, '#c8402a', 6); // the reel
      g.strokeStyle = '#f7d36a'; g.lineWidth = 4;
      for (var a = 0; a < 4; a++) { g.beginPath(); g.moveTo(169, 91); g.lineTo(169 + Math.cos(a * 1.57 + 0.4) * 16, 91 + Math.sin(a * 1.57 + 0.4) * 16); g.stroke(); }
      wheel(g, 116, 98, 24, '#4a4a4a');
      wheel(g, 44, 106, 14, '#4a4a4a');
    },
  };
  var paint = function (g, k) {
    g.save();
    g.fillStyle = 'rgba(40,25,10,0.25)'; g.beginPath(); g.ellipse(100, 121, 86, 7, 0, 0, 7); g.fill();
    g.lineJoin = 'round'; g.lineCap = 'round';
    DRAW[k](g);
    g.restore();
  };
  F.mkDraw = paint;
  // the machine's picture as a texture (the owner's when it is in)
  F.mkTex = function (scene, k) {
    var own = 'machine_' + k;
    if (F.images && F.images[own]) return F.ensureTexture(scene, own);
    var key = 'mk-' + k;
    if (!scene.textures.exists(key)) {
      var t = scene.textures.createCanvas(key, 192, 128);
      paint(t.getContext(), k);
      t.refresh();
    }
    return key;
  };

  // ---------- the icons: frames of the items texture from C.MACHINE_ICON_BASE ----------
  F.paintMachineIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = document.createElement('canvas'), g = cv.getContext('2d'), art = F.images && F.images.machine_icons;
    cv.width = 128 * K.length; cv.height = 128;
    K.forEach(function (k, i) {
      if (art) return g.drawImage(art, i * 128, 0, 128, 128, i * 128, 0, 128, 128);
      g.save(); g.translate(i * 128 + 4, 22); g.scale(0.62, 0.62); paint(g, k); g.restore();
    });
    var src = tex.mkSrc;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.mkSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    K.forEach(function (k, i) { var key = C.MACHINE_ICON_BASE + i; if (tex.has(key)) tex.remove(key); tex.add(key, at, i * 128, 0, 128, 128); });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintMachineIcons(scene);
    return out;
  };

  // ---------- what it would do on these tiles ----------
  // tractor: [{ idx, clear, deco, till }] (L.mkTill's plan); seeder: tilled empty tiles; harvester: ripe crops
  P.mkWork = function (k, tiles) {
    var self = this, s = this.state, out = [];
    tiles.forEach(function (p) {
      var x = p[0], y = p[1];
      if (!self.inMap(x, y)) return;
      var idx = self.idx(x, y), soil = s.soil[idx];
      if (k === 'harvester') { if (L.isRipe(soil) && !C.CROPS[soil.c].sickle) out.push(idx); return; }
      if (k === 'seeder') { if (soil && !soil.c && !soil.sp) out.push(idx); return; }
      if (self.forage[idx] || (soil && soil.sp)) return;
      var kind = s.debris[idx], deco = !kind && !soil ? self.decoAt(x, y) : null;
      if (kind || deco) {
        if (M.clears.indexOf(kind || deco) >= 0) out.push({ idx: idx, clear: kind || deco, deco: deco ? 1 : 0, till: kind && self.isTillable(x, y) ? 1 : 0 });
      } else if ((!soil || L.isWithered(soil)) && self.isTillable(x, y)) out.push({ idx: idx, till: 1 });
    });
    return out;
  };
  // ---------- the seed packet the Seeder plants: the one held last ----------
  var update = P.update;
  P.update = function () {
    update.apply(this, arguments);
    var s = this.state, h = s && L.held(s), d = h && C.ITEMS[h.id];
    if (d && d.kind === 'seed') F.session.mkSeed = h.id;
  };

  // ---------- Bram's Forge ----------
  var withRows = function (ui, extra, fn) {
    var lp = ui.listPanel;
    ui.listPanel = function (o) { o.rows = o.rows.concat(extra(o)); return lp.call(this, o); };
    try { return fn(); } finally { if (ui.hasOwnProperty('listPanel')) delete ui.listPanel; }
  };
  var WHY_NOT = {
    gold: function (R) { return 'Not enough gold: ' + fmt(R.gold) + 'G.'; },
    lumber: function (R) { return 'You need ' + R.lumber + ' lumber.'; },
    needs: function (R) { return 'You need ' + L.needsText(R.needs) + '. The Mixer makes Farm Cement and Rope; ore comes from the mine.'; },
    full: function () { return 'Your bag is full. Make room for it first.'; },
  };
  U.mkRows = function (s, at, per) {
    var self = this;
    return K.map(function (k, i) {
      var R = M[k], made = L.mkMade(s, k), lost = L.mkLost(s, k), page = Math.floor((at + i) / per);
      var done = function (words) {
        sfx('anvil');
        if (F.world) { F.world.changed(); F.world.save(); }
        self.closeModal();
        self.openForge(page);
        self.toast(words, 3400, DARK_GREEN);
      };
      return {
        icon: C.ITEMS[k].icon, name: R.name + (made ? ' (made)' : ''),
        desc: made ? (lost ? 'Bram kept it safe for you: take it back, free.' : 'Hold it in your bag and use it in your field.') : 'Also ' + R.lumber + ' lumber. ' + R.desc,
        reward: made ? null : { gold: R.gold, more: R.needs }, rewardPrefix: 'Cost', buttonsBelow: true,
        buttons: made && !lost ? [] : [{ label: made ? 'Take it' : 'Make', color: made ? GREEN : BLUE, cb: function () {
          var r = made ? L.mkBack(s, k) : L.mkMake(s, k);
          if (r !== 'ok') { sfx('nope'); return self.toast((WHY_NOT[r] || function () { return 'Hmm.'; })(R), 3000); }
          done(made ? 'Here is your ' + R.name + ' again.' : 'Clang! Bram made you a ' + R.name + '. Hold it in your bag and face your field.');
        } }],
      };
    });
  };
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this, s = F.session.state;
    if (!s || s.isVisit || F.session.visit) return openForge.call(this, page);
    if (!quiet() && !L.mkTourSeen(s) && L.tipSeen(s, 'sprinkler_tour')) {
      L.mkTourTake(s);
      F.Host.save(s);
      return this.tour('machines', function () { self.openForge(page); });
    }
    return withRows(this, function (o) {
      var at = o.rows.length;
      return self.mkRows(s, at, at + K.length > 5 ? 4 : 5);
    }, function () { return openForge.call(self, page); });
  };

  // ---------- the first-time tour ----------
  var machine = function (ui, sc, k, x, y, w) {
    var img = ui.add.image(x, y, F.mkTex(ui, k)).setOrigin(0.5, 1).setDisplaySize(w, w * 2 / 3);
    sc.add(img);
    return img;
  };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var soil = function (ui, sc, x, y, kind) { // a 26 px square: grass, tilled soil, or soil with a sprout / a ripe crop
    return ui.canvasImg(sc, x - 13, y - 13, 'mk-tour-' + kind, 26, 26, function (g) {
      g.fillStyle = kind === 'grass' ? '#7cbc4a' : '#8a5a32'; g.fillRect(1, 1, 24, 24);
      g.fillStyle = 'rgba(40,20,8,0.25)'; if (kind !== 'grass') for (var k = 5; k < 24; k += 7) g.fillRect(3, k, 20, 2);
      if (kind === 'sprout') { g.fillStyle = '#5fa84a'; g.fillRect(12, 8, 3, 10); g.fillRect(8, 8, 5, 3); }
      if (kind === 'ripe') { g.fillStyle = '#3e7a2e'; g.fillRect(11, 4, 4, 12); g.fillStyle = '#f0a030'; g.beginPath(); g.arc(13, 17, 6, 0, 7); g.fill(); }
    });
  };
  // a 3x3 patch that turns from one kind into the next as the machine rolls over it
  var patch = function (ui, sc, move, k, from, to) {
    var cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var x = 150 + c * 30, y = 40 + r * 30;
      soil(ui, sc, x, y, from);
      var after = soil(ui, sc, x, y, to).setAlpha(move ? 0 : 1);
      cells.push(after);
      tw(ui, move, { targets: after, alpha: 1, duration: 260, delay: 700 + c * 120, hold: 1400, yoyo: true, repeat: -1, repeatDelay: 500 });
    }
    var m = machine(ui, sc, k, 70, 108, 96);
    tw(ui, move, { targets: m, x: 104, duration: 520, delay: 300, ease: 'Quad.inOut', hold: 900, yoyo: true, repeat: -1, repeatDelay: 900 });
  };
  F.TOURS.machines = {
    title: 'FARM MACHINES',
    steps: [
      {
        text: 'Bram makes three farm machines at the Forge: a Tractor, a Seeder and a Harvester. One of each a farm.',
        draw: function (ui, sc, move) {
          K.forEach(function (k, i) {
            var m = machine(ui, sc, k, 46 + i * 90, 112, 84);
            tw(ui, move, { targets: m, y: 104, duration: 420, delay: i * 160, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Hold one in your bag on your farm and tap Get in. Steer it with the joystick: it works 3 tiles across as it goes.',
        draw: function (ui, sc, move) { patch(ui, sc, move, 'tractor', 'grass', 'soil'); },
      },
      {
        text: 'The Tractor pushes weeds, branches and stones aside and tills behind. You push the Seeder: it plants the seeds you held last.',
        draw: function (ui, sc, move) { patch(ui, sc, move, 'seeder', 'soil', 'sprout'); },
      },
      {
        text: 'The Harvester cuts every ripe crop it drives over into its tank. Full? Drive to the Silo and Unload.',
        draw: function (ui, sc, move) {
          patch(ui, sc, move, 'harvester', 'ripe', 'soil');
          var i = ui.add.image(250, 26, 'items', C.ICON.crate).setScale(0.22);
          sc.add(i);
        },
      },
      {
        text: 'A machine saves you time, not energy: it uses a little less than the same work by hand. Picking and planting stay free.',
        draw: function (ui, sc, move) {
          var m = machine(ui, sc, 'tractor', 96, 112, 110);
          tw(ui, move, { targets: m, angle: { from: -2, to: 2 }, duration: 160, yoyo: true, repeat: -1 });
          var e = ui.add.image(196, 60, 'items', C.ICON.bolt).setScale(0.3);
          sc.add(e);
          var t = ui.txt(196, 104, 'by hand: 18\nmachine: 16', 12, INK, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
          sc.add(t);
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
