// The Rocky Gorge in the world (owner, 18 Nov 2026; content 00-zzz...z-gorge.js, rules 01-logicZ...Z-gorge.js).
// - The two maps are built here at load (L.gorgeMap from Pulag's sheets, L.gorgeCaveMap from Palawan's cave). Tata Ambo
//   and his story, the Little Kalapati, the chests, the medals, the cave, its guards and boss: the places' engine.
// - Manila's Gorge Gate: at 110 hunts its fence goes and the gate is a walk-through way in (and from_gorge, back).
// - The ground: the owner's four textures (the floor, the water, the cliffs' top and face) in this map's copy of the tiles.
// - Flocks: the birds and the living stones start on the ledges, in a row; in the Echo Caves three of a kind together.
// - The Ibong Adarna sings now and then: every animal near it (itself too) stands still for 3 s.
// - The Little Kalapati (spot) coos when the Ibong Adarna is out, and an arrow points the way for a while.
// - The pictures: the 'gorge' pack, as the Jungle's. Cheap phones: an animal more than 3 tiles out of view is not drawn.
// - The first-time tour (C.TIPS gorge_tour), with the owner's pictures.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var G = C.GORGE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  if (!G || !C.PLACES.gorge) return;
  var DEPTH = F.WorldScene.DEPTH, GOLD = 0x7a5a12;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var have = function (key) { return !!(F.images && F.images[key]); };
  var HERE = { gorge: 1, gorge_cave: 1 };
  var here = function (w) { return !!(w && HERE[w.mapKey]); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  C.TIPS.push({ key: 'gorge_tour', text: 'THE ROCKY GORGE' }); // (appended last: a tip is its place in a saved number)

  // ---------- the maps; Manila's way in and out ----------
  var maps = F.ASSETS && F.ASSETS.maps;
  if (maps && maps.pulag && maps.palawan_cave) {
    maps.gorge = L.gorgeMap(maps.pulag);
    maps.gorge_cave = L.gorgeCaveMap(maps.palawan_cave);
  }
  var gate = C.MANILA.gorgeGate; // (back out: in front of it, facing the city)
  if (maps && maps.manila && gate) {
    maps.manila.layers.filter(function (l) { return l.type === 'objectgroup'; })[0].objects.push({ id: 90103, name: 'from_gorge', type: 'spawn', point: true,
      x: (gate.box[0] + gate.box[2] / 2) * T, y: Math.round((gate.box[1] + gate.box[3] + 0.6) * T), width: 0, height: 0, rotation: 0, visible: true, properties: [{ name: 'dir', type: 'string', value: 'down' }] });
  }
  var packHas = function () { return !!(F.packFiles && F.packFiles('gorge').length); };
  if (F.PACK_INFO && packHas()) F.PACK_INFO.gorge = { name: 'The Rocky Gorge', icon: 'bow', desc: 'The Rocky Gorge and the Echo Caves: their animals, props, ground and cave.' };
  var softPacks = F.softPacks;
  F.softPacks = function (map) { return (softPacks ? softPacks(map) : []).concat(HERE[map] && packHas() ? ['gorge'] : []); };

  // ---------- the icons: frames of the items texture (C.GORGE_ICON_BASE), the owner's sheet or the stand-ins ----------
  F.paintGorgeIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var n = C.GORGE_ICONS.length, cv = document.createElement('canvas'), g = cv.getContext('2d'), art = F.images && F.images.gorge_icons, src0 = tex.source[0];
    cv.width = 8 * 128;
    cv.height = Math.ceil(n / 8) * 128;
    C.GORGE_ICONS.forEach(function (name, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128, fr = !art && tex.get(C.ICON[C.GORGE_STAND[name]]);
      if (art) return g.drawImage(art, x, y, 128, 128, x, y, 128, 128);
      if (fr && src0 && src0.image) { var k = (src0.image.naturalWidth || src0.image.width) / src0.width; g.drawImage(src0.image, fr.cutX * k, fr.cutY * k, fr.cutWidth * k, fr.cutHeight * k, x + 6, y + 6, 116, 116); }
    });
    tex.gorgeArt = have('gorge_icons');
    var src = tex.gorgeSrc;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.gorgeSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.GORGE_ICONS.forEach(function (name, i) { var key = C.GORGE_ICON_BASE + i; if (tex.has(key)) tex.remove(key); tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintGorgeIcons(scene);
    return out;
  };
  var iconsIn = function () { var w = F.world, t = w && w.textures && w.textures.exists('items') && w.textures.get('items'); if (t && !t.gorgeArt && have('gorge_icons')) F.paintGorgeIcons(w); };
  F.bus.on('packart', function (k) { if (k === 'gorge_icons') iconsIn(); });
  F.bus.on('packs', iconsIn);

  // ---------- going there: the pack on the way in ----------
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    if (!this.busy && !visiting(this) && HERE[to] && !HERE[this.mapKey] && packHas() && !F.packReady('gorge') && F.packOnPhone('gorge')) {
      if (this.grGate) return;
      var self = this, args = arguments;
      this.grGate = true;
      return F.loadPack('gorge').then(function () { self.grGate = false; if (self.sys && self.sys.isActive()) travel.apply(self, args); });
    }
    return travel.apply(this, arguments);
  };

  // ---------- the ground: the floor, the water, the cliffs' top and face, in this map's own copy of the tiles sheet ----------
  var paintGround = function (w) {
    var ts = w.map && w.map.getTileset('tiles'), list = [['floor', 'ground_gorge'], ['water', 'ground_gorge_water'], ['top', 'ground_gorge_cliff'], ['face', 'ground_gorge_face'], ['faceHi', 'ground_gorge_face', 0], ['faceLo', 'ground_gorge_face', 1]];
    if (!ts || !list.some(function (p) { return have(p[1]); })) return;
    var key = 'tiles-gorge', tex = w.textures;
    if (!tex.exists(key)) {
      var img = (F.bitmaps && F.bitmaps.tiles) || F.images.tiles, full = tex.get('tiles').source[0].width, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = iw / full;
      var c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = iw;
      c.height = ih;
      g.drawImage(img, 0, 0);
      g.imageSmoothingQuality = 'high';
      list.forEach(function (p) {
        if (!have(p[1])) return;
        var q = ts.getTileTextureCoordinates(ts.firstgid + (G.tiles[p[0]] != null ? G.tiles[p[0]] : L.mapKit.TT[p[0]])), pad = Math.round(8 * k), s = Math.round(ts.tileWidth * k), x = Math.round(q.x * k), y = Math.round(q.y * k);
        var im = F.images[p[1]], iw2 = im.naturalWidth || im.width, ih2 = im.naturalHeight || im.height;
        g.clearRect(x - pad, y - pad, s + pad * 2, s + pad * 2);
        if (p[2] != null) g.drawImage(im, 0, p[2] * ih2 / 2, iw2, ih2 / 2, x - pad, y - pad, s + pad * 2, s + pad * 2); // (the taller face: half the picture a tile)
        else g.drawImage(im, x - pad, y - pad, s + pad * 2, s + pad * 2);
        if (p[0] === 'top') { g.fillStyle = 'rgba(40,28,16,0.22)'; g.fillRect(x - pad, y - pad, s + pad * 2, s + pad * 2); } // (the cliffs' top a little darker than the floor)
      });
      var t = tex.create(key, c, full, Math.round(ih / k)), gt = t.source[0].glTexture;
      if (gt) { gt.width = full; gt.height = Math.round(ih / k); }
      Phaser.Textures.Parsers.Image(t, 0);
    }
    ts.setImage(tex.get(key));
  };

  // ---------- in Manila (the gate) and in the Gorge ----------
  var create = P.create;
  P.create = function () {
    this.gorge = null;
    create.apply(this, arguments);
    var self = this, s = this.state, open = L.wildOpen(s, 'gorge');
    var f = F.packedFile && F.packedFile('gorge_icons');
    if (f && !have('gorge_icons') && F.needImage && (open || (F.onPhone && F.onPhone(f.file)))) F.needImage('gorge_icons');
    if (this.mapKey === 'manila' && gate && open && !visiting(this)) this.openGorgeGate();
    if (!here(this) || visiting(this)) return;
    this.gorge = { songs: 0, told: false, point: null };
    if (this.mapKey === 'gorge') paintGround(this);
    if (packHas() && !F.packReady('gorge') && F.canFetch && F.canFetch()) {
      if (F.packOnPhone('gorge')) F.loadPack('gorge');
      else if (!F.packProgress('gorge')) F.downloadPack('gorge').then(function (ok) { if (ok) F.loadPack('gorge'); });
    }
    var npc = C.PLACES.gorge.npc.sheet;
    if (this.mapKey === 'gorge' && !have(npc) && F.needImage && F.packedFile && F.packedFile(npc)) F.needImage(npc);
    if (this.mapKey === 'gorge' && !quiet() && !L.tipSeen(s, 'gorge_tour')) {
      var tries = 0, show = function () {
        if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'gorge_tour')) return;
        if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, show);
        L.takeTip(s, 'gorge_tour');
        F.Host.save(s);
        F.ui.gorgeTour();
      };
      this.time.delayedCall(1600, show);
    }
  };
  // the ground's pictures, when the pack comes in while you are there
  F.bus.on('packs', function () { var w = F.world; if (w && w.mapKey === 'gorge' && w.sys && w.sys.isActive() && w.gorge && !w.textures.exists('tiles-gorge')) paintGround(w); });
  // Manila's Gorge Gate, open: its fence and its arch's solid foot go, and its box is the way in (walk into it)
  P.openGorgeGate = function () {
    var b = gate.box, x0 = b[0] * T, y0 = b[1] * T, x1 = (b[0] + b[2]) * T, y1 = (b[1] + b[3]) * T, x, y;
    for (x = b[0]; x < b[0] + b[2]; x++) for (y = b[1]; y < b[1] + b[3]; y++) { if (this.layers.Walls) this.layers.Walls.removeTileAt(x, y); delete this.blocked[this.idx(x, y)]; }
    this.solids.getChildren().slice().forEach(function (z) { if (z.x > x0 && z.x < x1 && z.y > y0 && z.y < y1) z.destroy(); });
    this.objects = this.objects.filter(function (o) { return o.name !== 'mn_gate_gorge'; });
    this.objects.push({ type: 'warp', name: 'gorge_gate', x0: b[0], y0: b[1], x1: b[0] + b[2] - 1, y1: b[1] + b[3] - 1, px: x0, py: y0, pw: x1 - x0, ph: y1 - y0,
      props: { to: 'gorge', spawn: 'from_city', walk: true } });
  };
  F.bus.on('packart', function (k) {
    var w = F.world, n = w && w.placeNpc;
    if (!n || !w.sys || !w.sys.isActive() || k !== C.PLACES.gorge.npc.sheet || n.p.id !== 'gorge' || n.img.texture.key === k) return;
    F.ensureTexture(w, k);
    n.img.setTexture(k, 0).clearTint();
  });

  // ---------- flocks: on the ledges in a row; in the Echo Caves, three together ----------
  var setupWild = P.setupWild;
  P.setupWild = function () {
    this.grSetup = this.mapKey === 'gorge';
    try { return setupWild.apply(this, arguments); } finally { this.grSetup = false; }
  };
  var addWildAnimal = P.addWildAnimal;
  P.addWildAnimal = function (kind, slot, x, y, sized) {
    var a = addWildAnimal.apply(this, arguments);
    if (this.mapKey === 'gorge_cave' && this.lair && a.def.flock) a.flk = L.caveFlockOf('gorge_cave', this.lair.floor, slot);
    if (this.grSetup && a.def.abreast && a.flk && a.flk.i === 0) {
      var at = L.gorgeLedgeSpot(a.def.flock, Math.random);
      if (at && this.wildFree(at[0], at[1])) { a.x = (at[0] + 0.5) * T; a.y = (at[1] + 0.7) * T; this.drawWild(a); }
    }
    return a;
  };

  // ---------- the Ibong Adarna's song: every animal near stands still for 3 s ----------
  P.adarnaSing = function (a) {
    var self = this, S = WI.song, f = this.feet(), heard = Math.hypot(a.x - f.x, a.y - f.y) < S.hear * T;
    L.adarnaSong(this.wild.animals, a.x, a.y, T).forEach(function (b) { b.still = S.still; b.vx = b.vy = 0; b.mode = 'idle'; b.look = b === a; });
    this.gorge.songs++;
    if (!heard) return;
    sfx('found');
    var ring = this.add.circle(a.x, a.y - 0.4 * T, S.reach * T, 0xffe8a0, 0).setStrokeStyle(10, 0xffd860, 0.7).setDepth(DEPTH.fx).setScale(0.15);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 1400, ease: 'Quad.out', onComplete: function () { ring.destroy(); } });
    for (var i = 0; i < 5; i++) {
      var note = this.add.text(a.x + rand(-0.5, 0.5) * T, a.y - 1.1 * T, i % 2 ? '♫' : '♪', { fontFamily: 'Georgia, serif', fontSize: '96px', color: ['#ff6a6a', '#ffb040', '#f0e040', '#60d060', '#6ab0ff'][i], stroke: '#5a3a10', strokeThickness: 6 })
        .setOrigin(0.5).setDepth(DEPTH.fx);
      this.tweens.add({ targets: note, x: note.x + rand(-1.2, 1.2) * T, y: note.y - rand(1, 1.8) * T, alpha: 0, delay: i * 260, duration: 1500, onComplete: function (tw, t) { t[0].destroy(); } });
    }
    if (!this.gorge.told && !quiet()) { this.gorge.told = true; F.ui.toast('The Ibong Adarna sings! Every animal near it stands still for 3 seconds.', 3000, GOLD); }
  };
  var updateWild = P.updateWild;
  P.updateWild = function (a, dt, frozen) {
    if (!(a.still > 0)) {
      if (a.def.sings && this.gorge && a.mode !== 'flee' && (a.song = (a.song == null ? rand(3000, WI.song.every[0]) : a.song) - dt) <= 0) {
        a.song = rand(WI.song.every[0], WI.song.every[1]);
        this.adarnaSing(a);
      }
      if (!(a.still > 0)) return updateWild.apply(this, arguments);
    }
    a.still -= dt;
    a.vx = a.vy = 0;
    a.t = Math.max(a.t, a.still + 200);
    var r = updateWild.call(this, a, dt, true);
    a.vx = a.vy = 0;
    return r;
  };
  // (while it stands still, a hit or you coming close neither scares it off nor makes it charge)
  var wildFlee = P.wildFlee, wildCharge = P.wildCharge;
  P.wildFlee = function (a) { if (a.still > 0) return; return wildFlee.apply(this, arguments); };
  P.wildCharge = function (a) { if (a.still > 0) return; return wildCharge.apply(this, arguments); };

  // ---------- the Little Kalapati spots the Ibong Adarna: it coos, and an arrow points the way for 6 s ----------
  var updateCompanion = P.updateCompanion;
  P.updateCompanion = function (dt, time) {
    var c = this.comp, gz = this.gorge;
    if (c && gz && this.wild && c.id === 'gorge' && !c.spotted) {
      var ad = this.wild.animals.filter(function (a) { return a.def.sings && a.hp > 0; })[0];
      if (ad) {
        c.spotted = true;
        sfx('found');
        if (this.iconPop) this.iconPop(c.x, c.y - T, C.ICON.exclaim);
        F.ui.toast('The Little Kalapati coos: the Ibong Adarna is out! Follow the arrow.', 3200, GOLD);
        gz.point = { a: ad, until: this.time.now + 6000, img: this.add.image(0, 0, 'fx-huntarrow').setTint(0xffd060).setScale(2.4).setDepth(DEPTH.fx) };
      }
    }
    var p = gz && gz.point;
    if (p) {
      var f = this.feet();
      if (this.time.now > p.until || !(p.a.hp > 0) || this.wild.animals.indexOf(p.a) < 0) { p.img.destroy(); gz.point = null; }
      else { var ang = Math.atan2(p.a.y - f.y, p.a.x - f.x), rr = 1.9 * T; p.img.setPosition(f.x + Math.cos(ang) * rr, f.y - 0.5 * T + Math.sin(ang) * rr).setRotation(ang + Math.PI / 2); }
    }
    return updateCompanion.apply(this, arguments);
  };

  // ---------- drawing only what is near; each creature's own picture the moment it is in ----------
  var wildShow = P.wildShow;
  P.wildShow = function (a, d, dt) {
    if (!here(this)) return wildShow.apply(this, arguments);
    var v = this.cameras.main.worldView, m = 3 * T, on = a.x > v.x - m && a.x < v.right + m && a.y > v.y - m && a.y < v.bottom + m + 2 * T;
    if (a.img.visible !== on) { a.img.setVisible(on); a.sh.setVisible(on); if (a.grass) { a.grass.now.setVisible(on); a.grass.old.setVisible(on); } }
    if (!on) return null;
    if (a.def.place === 'gorge' && a.def.sheet && have(a.def.sheet) && a.img.texture.key !== a.def.sheet) {
      a.img.setTexture(F.ensureTexture(this, a.def.sheet)).clearTint();
      if (have(a.def.sheet + 'shade')) a.sh.setTexture(F.ensureTexture(this, a.def.sheet + 'shade'));
    }
    return wildShow.apply(this, arguments);
  };

  // ---------- the first-time tour, with the owner's pictures ----------
  var K = F.tourKit;
  var ART = ['npc_tata_ambo', 'wild_kalapati', 'wild_adarna', 'wild_batobato', 'props/gorge_bridge', 'props/gorge_mouth', 'wild_batoking', 'wild_gorge_galura', 'ground_gorge'];
  U.gorgeTour = function (done) { var self = this; (K ? K.artReady(ART) : Promise.resolve()).then(function () { self.tour('gorge', done); }); };
  var ground = function (ui, sc) {
    var g = ui.add.graphics();
    g.fillStyle(0xb8a888, 1).fillRoundedRect(4, 70, 264, 58, 10);
    sc.add(g);
    if (have('ground_gorge')) { F.ensureTexture(ui, 'ground_gorge'); sc.add(ui.add.tileSprite(136, 99, 264, 58, 'ground_gorge').setTileScale(0.25)); }
  };
  if (K) F.TOURS.gorge = {
    title: 'THE ROCKY GORGE',
    steps: [
      { text: 'A canyon north of Manila: cliffs, wide ledges and a stream with two rope bridges. Tata Ambo the old climber camps by the gate.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          if (!K.fit(ui, sc, 'props/gorge_bridge', 196, 122, 130, 80, 0)) K.words(ui, sc, 196, 96, 'Rope bridges', 13);
          var p = K.person(ui, sc, 'npc_tata_ambo', C.PLACES.gorge.npc.look, 66, 122, 100);
          if (p) K.tw(ui, move, { targets: p, y: 116, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } },
      { text: 'Birds and living stones stand in rows on the ledges. The Boomerang hits the first one on the way out and again on the way back. No ammo, and a throw costs what an arrow does.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          [0, 1, 2, 3].forEach(function (i) { K.creature(ui, sc, 'kalapati', 0, 132 + i * 34, 112 - (i % 2) * 4, 40); });
          var bm = K.icon(ui, sc, 40, 74, C.wpnIcon('boomerang_0'), 0.4);
          K.tw(ui, move, { targets: bm, x: 128, angle: 720, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          K.words(ui, sc, 70, 40, 'Out and back: 2 hits', 12);
        } },
      { text: 'Listen for the rare Ibong Adarna: when it sings, every animal near it stands still for three seconds.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var a = K.creature(ui, sc, 'adarna', 9, 92, 118, 70);
          if (a) K.tw(ui, move, { targets: a, scaleY: a.scaleY * 1.05, duration: 380, yoyo: true, repeat: -1 });
          K.creature(ui, sc, 'batobato', 0, 206, 120, 46);
          K.words(ui, sc, 206, 52, 'Still 3 s', 14, '#7a5a12');
        } },
      { text: 'Feed the Little Kalapati mung beans, nine times, while it is calm. Then it walks with you and coos when the Ibong Adarna is out.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var c = K.creature(ui, sc, 'squab', 0, 96, 118, 44);
          if (c) K.tw(ui, move, { targets: c, y: 112, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          K.icon(ui, sc, 176, 50, C.ITEMS.mung_bean.icon, 0.3);
          K.words(ui, sc, 214, 98, 'Coo!', 15, '#2f6a1a');
        } },
      { text: 'In the north cliff: the Echo Caves, 50 floors. The Bato King guards every 10th, the grumpy Galura waits on floor 50.',
        draw: function (ui, sc, move) {
          if (!K.fit(ui, sc, 'props/gorge_mouth', 76, 124, 116, 110, 0)) K.words(ui, sc, 76, 70, 'The Echo Caves', 13);
          var g = K.creature(ui, sc, 'gr_galura', 0, 198, 124, 104);
          if (g) K.tw(ui, move, { targets: g, scaleY: g.scaleY * 1.04, duration: 500, yoyo: true, repeat: -1 });
        } },
    ],
  };
})(window.Farm = window.Farm || {});
