// The Lost Tower's Keeper in the world (owner, 12 Nov 2026; content 00-zzzzzzzzzzzzzzzzzzzzzzz-tower-shop.js, rules
// 01-logicZZZZZZZZZZZZZZZZZZZ-tower-shop.js):
// - Mang Ilaw, the lighthouse keeper, stands by the lighthouse door in Manila and inside the Tower by its way in; face him
//   for his shop (Pearls only): the Keeper's gear, horse gear looks, "a new weapon: coming soon", and the Tower page (the
//   Blessings from the big bosses and the Tide set);
// - a big boss beaten: its Blessing and its Tide piece, once (and F.towerFirst, the later "First in Selebox" step);
// - the Keeper's Boots: faster walking in the Tower; the horse's looks: a tint and a lantern's glow, until their art comes;
// - the icons: drawn here into frames of the items texture (C.TOWER_ICON_BASE), the owner's tower_icons when it is in.
// Its pictures are the 'tower' pack's (tools/tower/tower-art.js): npc_keeper (a 3 x 3 villager sheet), tower_icons.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var K = C.KEEPER;
  var TW = C.TOWER;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, GOLD = 0x7a5a12;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  if (!K || !TW) return;
  var PERSON = K.person;
  if (F.SHEETS && F.SHEETS.people) F.SHEETS[PERSON.sheet] = F.SHEETS.people;
  var packed = function (k) { return !!(F.packedFile && F.packedFile(k)); };
  var have = function (k) { return !!(F.images && F.images[k]); };

  // ---------- the icons (128 cells) ----------
  var OUT = '#2b1a10';
  var path = function (g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  var paint = function (g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(); };
  var circle = function (g, x, y, r, fill, lw) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); paint(g, fill, lw); };
  var lantern = function (g, s) {
    g.save(); g.scale(s, s);
    var gr = g.createRadialGradient(0, 6, 2, 0, 6, 44); gr.addColorStop(0, 'rgba(255,240,170,0.9)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = gr; g.fillRect(-44, -38, 88, 88);
    g.beginPath(); g.arc(0, -30, 8, Math.PI, 0); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    path(g, [-16, -22, 16, -22, 12, -16, -12, -16]); paint(g, '#c99a3c');
    path(g, [-14, -16, 14, -16, 16, 26, -16, 26]); paint(g, '#fff2a8');
    path(g, [-18, 26, 18, 26, 14, 32, -14, 32]); paint(g, '#c99a3c');
    circle(g, 0, 6, 7, '#ffb43c', 2.5);
    g.restore();
  };
  var DRAW = {
    k_hat: function (g) { // a keeper's navy cap with a gold band
      g.beginPath(); g.ellipse(0, 18, 46, 13, 0, 0, Math.PI * 2); paint(g, '#24365c');
      path(g, [-30, 16, -26, -22, 26, -22, 30, 16]); paint(g, '#2f4878');
      path(g, [-28, 2, 28, 2, 29, 12, -29, 12]); paint(g, '#e0b040', 3);
      circle(g, 0, -10, 6, '#e0b040', 2.5);
    },
    k_boots: function (g) {
      [[-20, 0], [16, 6]].forEach(function (o) { g.save(); g.translate(o[0], o[1]); path(g, [-12, -34, 10, -34, 10, 14, 26, 18, 26, 30, -14, 30]); paint(g, '#5a3a22'); path(g, [-12, -34, 10, -34, 10, -26, -12, -26]); paint(g, '#e0b040', 3); g.restore(); });
    },
    k_coat: function (g) {
      path(g, [-18, -38, 18, -38, 40, -20, 34, 40, -34, 40, -40, -20]); paint(g, '#2f4878');
      path(g, [-4, -38, 4, -38, 4, 40, -4, 40]); paint(g, '#24365c', 2);
      [-20, -4, 12, 28].forEach(function (y) { circle(g, 10, y, 4, '#e0b040', 2); });
      path(g, [-18, -38, 0, -22, 18, -38]); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    },
    k_lantern: function (g) { lantern(g, 1.15); },
    h_saddle: function (g) {
      g.beginPath(); g.moveTo(-42, 4); g.quadraticCurveTo(-30, -26, 0, -12); g.quadraticCurveTo(30, -26, 42, 4); g.quadraticCurveTo(0, 22, -42, 4); paint(g, '#8a4a24');
      g.beginPath(); g.moveTo(-34, 4); g.quadraticCurveTo(0, 16, 34, 4); g.lineWidth = 4; g.strokeStyle = '#e0b040'; g.stroke();
      path(g, [-4, 8, 4, 8, 4, 38, -4, 38]); paint(g, '#5a3a22', 2.5);
      circle(g, 0, 40, 6, '#c8ccd4', 2.5);
    },
    h_bridle: function (g) {
      g.lineWidth = 7; g.strokeStyle = '#7a4424'; g.lineCap = 'round';
      g.beginPath(); g.ellipse(0, -2, 30, 36, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-30, 8); g.lineTo(30, 8); g.stroke();
      [[-30, 8], [30, 8], [0, -38]].forEach(function (p) { circle(g, p[0], p[1], 7, '#e0b040', 2.5); });
    },
    h_lantern: function (g) { g.rotate(-0.2); lantern(g, 1); g.beginPath(); g.moveTo(0, -38); g.lineTo(34, -46); g.lineWidth = 5; g.strokeStyle = '#7a4424'; g.stroke(); },
    horse_dye: function (g) {
      path(g, [-10, -40, 10, -40, 10, -26, -10, -26]); paint(g, '#a87a4a');
      g.beginPath(); g.moveTo(-10, -26); g.quadraticCurveTo(-34, -10, -30, 18); g.quadraticCurveTo(-26, 40, 0, 40); g.quadraticCurveTo(26, 40, 30, 18); g.quadraticCurveTo(34, -10, 10, -26); g.closePath(); paint(g, '#e8f0ff');
      g.beginPath(); g.moveTo(-28, 8); g.quadraticCurveTo(0, -2, 28, 8); g.quadraticCurveTo(26, 38, 0, 38); g.quadraticCurveTo(-26, 38, -28, 8); g.closePath(); g.fillStyle = '#c8463a'; g.fill();
      circle(g, -10, 20, 5, '#4a90c9', 1.5); circle(g, 8, 26, 5, '#5fa84a', 1.5);
    },
    tide: function (g) { // a shell
      g.beginPath(); g.moveTo(0, 36); g.lineTo(-40, -6); g.quadraticCurveTo(0, -56, 40, -6); g.closePath(); paint(g, '#8ad8e8');
      [-24, -8, 8, 24].forEach(function (x) { g.beginPath(); g.moveTo(0, 34); g.lineTo(x, -24); g.lineWidth = 3; g.strokeStyle = '#3a8aa0'; g.stroke(); });
      path(g, [-10, 30, 10, 30, 6, 42, -6, 42]); paint(g, '#5ab0c8', 2.5);
    },
    weapon_soon: function (g) { // (owner, 12 Nov 2026: "just ?, but make it better") a mystery medal in the keeper's navy and gold
      g.scale(1.35, 1.35); // (fills its cell: the others are drawn this big)
      var glow = g.createRadialGradient(0, 0, 30, 0, 0, 47); glow.addColorStop(0, 'rgba(255,214,90,0.55)'); glow.addColorStop(1, 'rgba(255,214,90,0)');
      g.fillStyle = glow; g.fillRect(-47, -47, 94, 94);
      var rim = g.createLinearGradient(0, -44, 0, 44); rim.addColorStop(0, '#ffe58a'); rim.addColorStop(0.5, '#e0a22e'); rim.addColorStop(1, '#a8661a');
      circle(g, 0, 0, 44, rim, 4);
      var disc = g.createRadialGradient(-10, -14, 4, 0, 0, 36); disc.addColorStop(0, '#3a5c9c'); disc.addColorStop(1, '#16264a');
      circle(g, 0, 0, 35, disc, 3);
      g.font = 'bold 60px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = OUT; g.strokeText('?', 1, 5);
      var q = g.createLinearGradient(0, -24, 0, 28); q.addColorStop(0, '#fff6c0'); q.addColorStop(0.55, '#ffd23f'); q.addColorStop(1, '#e09a1a');
      g.fillStyle = q; g.fillText('?', 1, 5);
      g.beginPath(); g.ellipse(-14, -20, 9, 4, -0.7, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill(); // (the disc's shine)
      [[30, -32, 7], [-34, 26, 5], [36, 22, 4]].forEach(function (p) { // little twinkles
        g.beginPath(); g.moveTo(p[0], p[1] - p[2]); g.lineTo(p[0] + p[2] * 0.3, p[1] - p[2] * 0.3); g.lineTo(p[0] + p[2], p[1]); g.lineTo(p[0] + p[2] * 0.3, p[1] + p[2] * 0.3);
        g.lineTo(p[0], p[1] + p[2]); g.lineTo(p[0] - p[2] * 0.3, p[1] + p[2] * 0.3); g.lineTo(p[0] - p[2], p[1]); g.lineTo(p[0] - p[2] * 0.3, p[1] - p[2] * 0.3); g.closePath();
        g.fillStyle = '#fff8d0'; g.fill();
      });
    },
    pearl: function (g) {
      var gr = g.createRadialGradient(-10, -12, 4, 0, 0, 34); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#e8e4f4'); gr.addColorStop(1, '#b8b0d0');
      circle(g, 0, 0, 30, gr);
      g.beginPath(); g.ellipse(-10, -12, 8, 5, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
    },
  };
  var iconCanvas = function () {
    var n = C.TOWER_ICONS.length, cv = document.createElement('canvas'), g = cv.getContext('2d'), art = F.images && F.images.tower_icons;
    cv.width = 1024;
    cv.height = Math.ceil(n / 8) * 128;
    C.TOWER_ICONS.forEach(function (name, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
      g.save();
      g.translate(x, y);
      g.beginPath(); g.rect(2, 2, 124, 124); g.clip();
      if (art && name !== 'weapon_soon') g.drawImage(art, x, y, 128, 128, 0, 0, 128, 128); // (the "?" is always ours)
      else { g.translate(64, 64); DRAW[name](g); }
      g.restore();
    });
    return cv;
  };
  F.paintTowerIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = iconCanvas(), src = tex.towerSrc;
    tex.towerArt = have('tower_icons');
    if (src) { src.image = src.source = cv; src.update(); return; } // (their picture came in: painted again)
    src = tex.towerSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.TOWER_ICONS.forEach(function (name, i) {
      var key = C.TOWER_ICON_BASE + i;
      if (tex.has(key)) tex.remove(key);
      tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128);
    });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintTowerIcons(scene);
    return out;
  };
  // the owner's icons, once their pack picture is here (asked for when the shop opens)
  var iconsArt = function (scene) {
    if (have('tower_icons')) { var tex = scene.textures.exists('items') && scene.textures.get('items'); if (tex && !tex.towerArt) F.paintTowerIcons(scene); }
    else if (packed('tower_icons') && F.needImage) F.needImage('tower_icons');
  };

  // ---------- the keeper: by the lighthouse door (Manila), and by the Tower's way in ----------
  var LABEL = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '104px', fontStyle: 'bold', color: '#fff6e0', stroke: '#3d2614', strokeThickness: 16 };
  // where he stands: { x, y } in world units (his feet), or null on other maps
  P.keeperSpot = function () {
    if (this.mapKey === 'tower') return { x: K.inside[0] * T, y: K.inside[1] * T };
    var d = this.mapKey === 'manila' && L.towerDoor();
    if (!d) return null;
    var tries = [[2, 1], [-2, 1], [2, 2], [-2, 2], [3, 1], [-3, 1], [1, 3], [-1, 3]];
    for (var i = 0; i < tries.length; i++) {
      var tx = d.x + tries[i][0], ty = d.y + tries[i][1];
      if (this.inMap(tx, ty) && this.walkable(tx, ty) && !(this.blocked && this.blocked[this.idx(tx, ty)])) return { x: (tx + 0.5) * T, y: (ty + 0.8) * T };
    }
    return null;
  };
  P.addKeeper = function () {
    var p = this.keeperSpot();
    if (!p || F.session.visit) return;
    var own = have(PERSON.sheet), key = own ? PERSON.sheet : 'tw_people', row = own ? 0 : PERSON.look[0];
    if (!own && packed(PERSON.sheet) && F.needImage) F.needImage(PERSON.sheet);
    F.ensureTexture(this, key);
    var sp = this.add.sprite(p.x, p.y, key, row * 9).setOrigin(0.5, 0.83).setScale(2);
    if (!own) sp.setTint(PERSON.look[1]);
    this.physics.add.existing(sp);
    sp.body.setSize(60, 30).setOffset(34, 145).setImmovable(true);
    sp.body.moves = false;
    this.physics.add.collider(this.player, sp);
    F.depthTo(sp, DEPTH.actor + p.y / 1e5);
    var tag = this.add.text(p.x, p.y - 1.75 * T, PERSON.name, LABEL).setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(0.7);
    this.keeper = { sp: sp, tag: tag, x: p.x, y: p.y };
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    this.keeper = null;
    if (this.mapKey === 'manila' || this.mapKey === 'tower') this.addKeeper();
  };
  var resolve = P.resolve;
  P.resolve = function () {
    var k = this.keeper;
    if (k && !this.busy) {
      var pt = this.front(0.7);
      if (Math.hypot(pt.x - k.x, pt.y - (k.y - 0.3 * T)) < 0.9 * T) {
        var self = this;
        return { label: 'Shop', icon: C.towerIcon('pearl'), run: function () {
          var f = self.feet();
          k.sp.setFrame((self.keeperLookRow()) * 9 + (Math.abs(f.x - k.x) > Math.abs(f.y - k.y) ? 6 : f.y < k.y ? 3 : 0)).setFlipX(f.x > k.x + 0.5 * T);
          sfx('talk');
          F.ui.openKeeper();
        } };
      }
    }
    return resolve.apply(this, arguments);
  };
  P.keeperLookRow = function () { return have(PERSON.sheet) && this.keeper && this.keeper.sp.texture.key === PERSON.sheet ? 0 : PERSON.look[0]; };

  // ---------- the shop ----------
  var PAGES = [['gear', 'Gear'], ['horse', 'Horse'], ['tower', 'Tower']];
  U.openKeeper = function (tab, page) {
    var self = this, s = F.session.state, rows = [];
    tab = tab || 'gear';
    if (F.world) iconsArt(F.world);
    var again = function () { self.closeModal(); self.openKeeper(tab, page); };
    var done = function (r, ok, price) {
      if (r === 'pearls') { sfx('nope'); return self.toast('You need ' + fmt(price - (s.pearls || 0)) + ' more Pearls. Climb The Lost Tower for them.', 2600); }
      if (r !== 'ok') return null;
      sfx('coin');
      self.toast(ok, 2600, 0x2f5a22);
      F.session.dirty = true;
      if (F.world) { F.world.changed(); F.world.save(); }
      F.bus.emit('hud');
      again();
      return null;
    };
    var cost = function (price) { return { label: fmt(price) + ' Pearls', color: (s.pearls || 0) >= price ? GREEN : GREY }; };
    if (tab === 'gear') {
      K.gear.forEach(function (g) {
        var id = 'k:' + g.id, mine = L.keeperOwns(s, g.id), on = L.worn(s, g.slot) === id, b;
        if (!mine) b = Object.assign(cost(g.price), { cb: function () { done(L.keeperBuy(s, g.id), g.name + '! ' + (L.worn(s, g.slot) === id ? 'You are wearing it.' : 'Wear it from your Gear page.'), g.price); } });
        else b = { label: on ? 'Take off' : 'Wear', color: on ? GREY : BLUE, cb: function () { if (on) L.takeOff(s, g.slot); else L.wear(s, id); sfx('pick'); done('ok', on ? g.name + ' off.' : g.name + ' on.'); } };
        rows.push({ icon: C.towerIcon('k_' + g.id), name: g.name + (on ? ' (on)' : ''), desc: C.GEAR_SLOT_NAMES[g.slot] + '. ' + L.keeperText(g), buttons: [b] });
      });
      rows.push({ icon: C.towerIcon('weapon_soon'), name: 'A new weapon', desc: 'Coming soon: the Tower\'s own.', buttons: [{ label: 'Soon', color: GREY, cb: function () { self.toast(K.weapon + '.', 1800); } }] });
    } else if (tab === 'horse') {
      K.horse.forEach(function (h) {
        var mine = L.horseLookOwns(s, h.id), on = L.horseLookOn(s, h.id), b;
        if (!mine) b = Object.assign(cost(h.price), { cb: function () { done(L.horseLookBuy(s, h.id), h.name + '! Your horse wears it now.', h.price); } });
        else b = { label: on ? 'Take off' : 'Wear', color: on ? GREY : BLUE, cb: function () { L.horseLookWear(s, h.id, !on); sfx('pick'); done('ok', h.name + (on ? ' off.' : ' on.')); } };
        rows.push({ icon: C.towerIcon('h_' + h.id), name: h.name + (on ? ' (on)' : ''), desc: 'A look for your horse (looks only).', buttons: [b] });
      });
    } else {
      var dmg = Math.round((L.towerDamage(s) - 1) * 100);
      if (self.openTowerBoard) rows.push({ icon: C.ICON.ribbon, name: 'The weekly board', desc: 'New floors this week, the top 10 and the prizes.', buttons: [{ label: 'Open', color: BLUE, cb: function () { self.closeAll(); self.openTowerBoard(function () { self.openKeeper('tower', 0); }); } }] });
      rows.push({ icon: C.towerIcon('pearl'), name: 'Tower Blessings', desc: '+' + dmg + '% damage in The Lost Tower, +' + L.towerEnergy(s) + ' most energy. Each big boss gives one, forever.' });
      rows.push({ icon: C.towerIcon('tide'), name: 'The Tide set: ' + L.tidePieces(s).length + ' of 10', desc: L.tidePieces(s).length ? L.tidePieces(s).join(', ') + '.' : 'A costume no one else sells: a piece from each big boss.' });
      TW.zones.forEach(function (z, i) {
        var n = i + 1, won = L.towerBeat(s, n), b = L.towerBlessOf(n), boss = C.WILD.animals[z.boss];
        rows.push({ icon: C.towerIcon(won ? 'tide' : 'weapon_soon'), name: 'Floor ' + n * TW.zoneSize + ': ' + (won || L.towerRec(s).deep >= n * TW.zoneSize ? boss.name : '???'),
          desc: (won ? 'Beaten! ' : '') + (b.damage ? '+5% damage in the Tower' : '+10 most energy') + ', and the ' + TW.tide[i] + '.' });
      });
    }
    this.listPanel({
      title: PERSON.name + "'s Shop", tab: tab, page: page || 0, rows: rows, tabs: PAGES,
      sub: function () {
        var less = Math.round(L.keeperLess(s) * 100);
        return 'Pearls ' + fmt(s.pearls || 0) + (tab === 'gear' && less ? '     Worn: ' + less + '% less in the Tower' : tab === 'gear' ? '     Pearls only, from The Lost Tower' : '');
      },
      reopen: function (t, p) { self.openKeeper(t, p); },
    });
  };
  // the Tower page on its own (the Blessings and the Tide set)
  U.openTowerPage = function () { this.openKeeper('tower', 0); };

  // ---------- a big boss beaten: its Blessing and its Tide piece, once ----------
  // First in Selebox (owner: the first players ever to beat each big boss, their names on the lighthouse wall) is a later
  // server step: this hook is where it goes. It does nothing yet.
  F.towerFirst = F.towerFirst || function (bossFloor) { void bossFloor; };
  var cleared = P.towerCleared;
  P.towerCleared = function () {
    L.towerWon = null;
    var n = cleared.apply(this, arguments), w = L.towerWon, self = this;
    L.towerWon = null;
    if (!w) return n;
    F.towerFirst(w.floor);
    F.bus.emit('hud');
    this.time.delayedCall(1400, function () {
      if (!F.ui || !self.sys.isActive()) return;
      sfx('fanfare');
      F.ui.dialog('A TOWER BLESSING!\n' + (w.bless.damage ? '+5% damage in The Lost Tower' : '+10 most energy, everywhere') + ', forever.\n\nAnd a piece of the Tide set: the ' + w.tide + ' (' + L.tidePieces(self.state).length + ' of 10).');
    });
    return n;
  };

  // ---------- the Keeper's Boots: faster in the Tower ----------
  var move = P.move;
  P.move = function () {
    var k = this.mapKey === 'tower' && !F.session.riding ? L.keeperSpeed(this.state) : 1;
    if (k === 1) return move.apply(this, arguments);
    var sp = C.SPEED;
    C.SPEED = sp * k;
    try { return move.apply(this, arguments); } finally { C.SPEED = sp; }
  };

  // ---------- the horse's looks: stand-ins (a tint while it stands alone, a lantern's glow) until their art comes ----------
  // (the art: an overlay sheet for each look, laid out like ride2_horse, drawn over the horse; see the prompts)
  var updateExtras = P.updateExtras;
  P.updateExtras = function () {
    updateExtras.apply(this, arguments);
    var h = this.horse;
    if (!h || !h.sprite || !h.sprite.active) return;
    var looks = F.session.visit ? [] : L.horseLooks(this.state), tint = 0, glow = 0;
    looks.forEach(function (l) { if (l.tint) tint = l.tint; if (l.glow) glow = l.glow; });
    if (tint && !h.ridden) { if (h.hlTint !== tint) { h.sprite.setTint(tint); h.hlTint = tint; } } else if (h.hlTint) { h.sprite.clearTint(); h.hlTint = 0; }
    if (glow && h.sprite.visible) {
      if (!h.hlGlow) h.hlGlow = this.add.circle(0, 0, 0.45 * T, glow, 0.35).setBlendMode(Phaser.BlendModes.ADD);
      var side = this.dir === 'left' || this.dir === 'right', flip = F.session.riding ? !!this.rideFlip : !!h.faceFlip;
      h.hlGlow.setVisible(true).setPosition(h.x + (side ? (flip ? 0.7 : -0.7) * T : 0), h.y - 1.3 * T).setAlpha(0.28 + 0.08 * Math.sin(this.time.now / 300));
      h.hlGlow.setDepth(h.sprite.depth + 0.0001);
    } else if (h.hlGlow) h.hlGlow.setVisible(false);
  };
})(window.Farm = window.Farm || {});
