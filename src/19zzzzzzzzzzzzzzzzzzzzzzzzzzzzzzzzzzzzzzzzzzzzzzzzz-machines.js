// Bram's farm machines in the world (rules 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-machines.js, numbers C.MACHINES).
// - Bram's Forge: a row each (Make; a made one missing from the bag and Storage: Take it, free).
// - Held in a bag slot, on your own farm: the action button works the 3x3 block ahead (the tiles show first); held down,
//   a row of 9. Each tile goes through the hand's own world action, so everything it shows and counts is the same:
//   the Seeder is the seed bag's plantArea (the packet you held last), the Harvester the hand's harvest (its crops into
//   the Silo: L.mkPick), the Tractor the hoe's till and the hand tools' clearing in one pass (L.mkTill).
// - The machine stands in front of the farmer while it is held, and jolts forward as it works. No picture yet: drawn
//   here once on a canvas (the icons too, into frames of the items texture), the owner's 'machine_<kind>' and
//   'machine_icons' are used once they are in.
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
  var WHY = {
    tractor: 'The Tractor tills the field soil ahead, 3x3 (hold the button: a row of 9), and clears its weeds, branches and stones. Stumps and boulders still need the Axe and the Hammer.',
    seeder: 'The Seeder plants tilled, empty soil ahead, 3x3 (hold the button: a row of 9). Till the soil first.',
    harvester: 'Nothing ripe ahead. The Harvester picks the ripe crops on the 3x3 ahead (hold the button: a row of 9).',
  };
  // the action button with a machine in your hands (null: not here, the button does what it would anyway)
  P.mkAction = function (k) {
    var self = this, s = this.state, R = M[k], icon = C.ITEMS[k].icon;
    if (this.mapKey !== 'farm' || visiting(this) || F.session.riding) return null;
    var t = this.facing(), pt = this.front(0.7);
    if (!this.inMap(t.x, t.y)) return null;
    if ((this.villagers && this.villagers.at(pt.x, pt.y)) || (this.herd && this.herd.at(pt.x, pt.y)) || (this.dog && this.dog.near(pt.x, pt.y))) return null;
    if (this.objectAt(t.x, t.y) || (this.pieceAt && this.pieceAt(t.x, t.y) >= 0) || this.forage[this.idx(t.x, t.y)]) return null;
    var d = this.dirVec(), block = L.mkTiles(t.x, t.y, d[0], d[1]), row = L.mkTiles(t.x, t.y, d[0], d[1], true);
    var why = this.mkWork(k, block).length || this.mkWork(k, row).length ? null : WHY[k];
    if (!why && k === 'seeder' && L.mkSeedSlot(s, F.session.mkSeed) < 0) why = 'The Seeder needs seed packets in your bag. It plants the ones you held last.';
    if (why) return { label: R.verb, icon: icon, preview: block, disabled: true, why: why, mk: k, soft: true };
    return {
      label: R.verb, icon: icon, charge: 1, preview: block, mk: k,
      area: function (lvl) { return lvl ? row : block; },
      run: function (lvl) { self.mkUse(k, t, lvl ? row : block); },
    };
  };
  var resolve = P.resolve;
  P.resolve = function () {
    var k = L.mkHeld(this.state);
    if (!k) return resolve.call(this);
    var a = this.mkAction(k);
    if (a && !a.soft) return a;
    var r0 = resolve.call(this); // (nothing for it ahead: what the button does anyway, a ripe crop by hand...)
    if (r0 && !r0.disabled) return r0;
    return a || r0 || { label: M[k].verb, icon: C.ITEMS[k].icon, disabled: true, why: 'The ' + M[k].name + ' works in your own field, on the farm.' };
  };
  // the charge meter: 3 x 3, then a row of 9
  var showCharge = U.showCharge;
  U.showCharge = function (level) {
    var w = F.world, c = w && w.charge;
    if (level < 0 || !c || !c.action || !c.action.mk) return showCharge.apply(this, arguments);
    this.chargeText.setVisible(true).setText((level ? 'Row of ' + M.row : '3 x 3') + '  ' + new Array(level + 2).join('●'));
    this.tweens.add({ targets: this.chargeText, scale: { from: 1.3, to: 1 }, duration: 160 });
  };

  // ---------- using it ----------
  P.mkUse = function (k, t, tiles) {
    var self = this, s = this.state;
    if (k === 'tractor') return this.mkTractor(t, tiles);
    if (k === 'seeder') {
      var slot = L.mkSeedSlot(s, F.session.mkSeed), sel = s.sel;
      if (slot < 0) return F.ui.toast('The Seeder needs seed packets in your bag.');
      if (!this.mkWork(k, tiles).length) return F.ui.toast(WHY.seeder);
      s.sel = slot;
      this.mkUsing = k;
      try { this.plantArea(t, tiles); } finally { this.mkUsing = null; s.sel = sel; this.hintKey = null; F.bus.emit('hud'); } // (the hotbar: back on the Seeder)
      return;
    }
    if (!this.mkWork(k, tiles).length) return F.ui.toast(WHY.harvester);
    var out = {}, harvest = L.harvest, reach = L.chargeTiles;
    L.harvest = function (st, i) { return L.mkPick(st, i, harvest, out); };
    L.chargeTiles = function () { return tiles; };
    this.mkUsing = k;
    try { this.harvest(t, this.idx(t.x, t.y)); } finally { L.harvest = harvest; L.chargeTiles = reach; this.mkUsing = null; }
    if (!out.silo && !out.bag && !out.basket) return;
    this.mkKick(tiles);
    var f = this.feet();
    if (out.silo) this.time.delayedCall(420, function () { self.floatTextAt(f.x, f.y - 2.2 * T, '+' + out.silo + ' to the Silo'); });
    if (out.basket) F.ui.toast('Your Silo and bag are full: ' + out.basket + ' went to the basket by the farmhouse.', 3200);
  };
  // the Tractor's pass: the clearing and the tilling at once
  P.mkTractor = function (t, tiles) {
    var self = this, s = this.state, plan = this.mkWork('tractor', tiles), r = L.mkTill(s, plan);
    if (r === 'tired') return this.tired();
    if (r === 'none' || !r) return F.ui.toast(WHY.tractor);
    var w = this.map.width, at = function (i) { return { x: i % w, y: Math.floor(i / w) }; }, deco = {};
    plan.forEach(function (p) { if (p.deco) deco[p.idx] = 1; });
    this.mkKick(tiles);
    r.cleared.forEach(function (i) {
      var tile = at(i);
      self.popOut(deco[i] ? 'Walls' : 'Debris', tile);
      if (deco[i]) self.removeDeco(i); else self.removeDebrisTile(i);
    });
    if (r.cleared.length) { this.recollide(); if (this.layers.Debris) this.layers.Debris.setCollisionByProperty({ collides: true }); sfx('leaves'); }
    r.tilled.forEach(function (i) { self.refreshTile(i); if (self.soilPop) self.soilPop(at(i)); });
    sfx('till');
    this.bump(1);
    var notes = [];
    if (r.lumber) { notes.push('+' + r.lumber + ' Lumber'); this.flyTile(t, C.ICON.lumber); }
    if (r.stone) { notes.push('+' + r.stone + ' Stone'); this.flyTile(t, C.ICON.stone); }
    if (notes.length) this.floatText(t, notes.join('  '));
    if (r.clear) this.progress('clear', r.clear);
    if (r.till) this.progress('till', r.till);
    this.changed();
  };
  // (the seed bag's own pour is the Seeder's jolt instead)
  var animateUse = P.animateUse;
  P.animateUse = function () { if (this.mkUsing) return this.mkKick(); return animateUse.apply(this, arguments); };
  // the machine jolts forward and back, dust over the tiles it worked
  P.mkKick = function (tiles) {
    var self = this;
    this.mkT = 360;
    this.acting = Math.max(this.acting || 0, 320);
    (tiles || []).forEach(function (p, i) { if (i % 2 === 0 && self.inMap(p[0], p[1])) self.puff({ x: p[0], y: p[1] }, 0x8a6a42, 1); });
  };

  // ---------- held: in front of the farmer ----------
  var SPOT = { right: [0.95, 0.18], left: [-0.95, 0.18], down: [0, 0.98], up: [0, -0.3] };
  var create = P.create;
  P.create = function () { this.mkSpr = null; this.mkT = 0; return create.apply(this, arguments); };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    var s = this.state, h = s && L.held(s), k = h && C.ITEMS[h.id] && C.ITEMS[h.id].machine;
    if (h && !k && C.ITEMS[h.id] && C.ITEMS[h.id].kind === 'seed') F.session.mkSeed = h.id; // (the Seeder plants these)
    var on = !!k && this.mapKey === 'farm' && !this.busy && !F.session.riding && !!this.player && this.player.visible;
    if (!on) { if (this.mkSpr && this.mkSpr.visible) this.mkSpr.setVisible(false); return; }
    if (!this.mkSpr || this.mkSprK !== k) {
      if (this.mkSpr) this.mkSpr.destroy();
      this.mkSpr = this.add.image(0, 0, F.mkTex(this, k)).setOrigin(0.5, 1).setDisplaySize(1.5 * T, T);
      this.mkSprK = k;
    }
    var f = this.feet(), o = SPOT[this.dir] || SPOT.down, d = this.dirVec(), jolt = 0, bob = 0;
    if (this.mkT > 0) { this.mkT -= delta || 16; var u = Math.max(0, this.mkT) / 360; jolt = Math.sin(u * Math.PI) * 0.35 * T; bob = Math.abs(Math.sin(u * 14)) * 10; }
    var x = f.x + o[0] * T + d[0] * jolt, y = f.y + o[1] * T + d[1] * jolt - bob;
    this.mkSpr.setVisible(true).setPosition(x, y).setFlipX(this.dir === 'left').setDepth(DEPTH.actor + y / 1e5 + (this.dir === 'up' ? -0.001 : 0));
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
        text: 'Hold one in your bag and face your field. A tap works the 3x3 ahead; hold the button for a row of ' + M.row + '.',
        draw: function (ui, sc, move) { patch(ui, sc, move, 'tractor', 'grass', 'soil'); },
      },
      {
        text: 'The Tractor tills and clears weeds, branches and stones. The Seeder plants the seed packet you held last.',
        draw: function (ui, sc, move) { patch(ui, sc, move, 'seeder', 'soil', 'sprout'); },
      },
      {
        text: 'The Harvester picks every ripe crop ahead straight into your Silo, then your bag. Silver and Gold keep their star.',
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
