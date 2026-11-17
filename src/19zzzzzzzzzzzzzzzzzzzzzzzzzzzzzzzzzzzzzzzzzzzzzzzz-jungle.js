// The Bamboo Jungle in the world (owner, 18 Nov 2026; content 00-zzz...z-jungle.js, rules 01-logicZ...Z-jungle.js).
// - The two maps are built here at load (L.jungleMap from Pulag's sheets, L.jungleCaveMap from Palawan's cave): the page
//   carries no new map. Diday and her story, the Biik, the hidden chests, the medals, the cave, its guards and boss, the
//   daily chest: the places' engine (19zzzzz-places.js, 19zt-lair.js). Flocks (the Baboy-damo's pairs): the Plains' code.
// - Manila's Jungle Gate: at 70 hunts its fence goes and the gate is a walk-through way in (and from_jungle, back).
// - Tall bamboo stops your long shots (bullets, javelins, boomerangs, arrows) at the first clump past 4 tiles, with a
//   puff of leaves; a friend's shots only show. The Pilandok zigzags as it runs.
// - The pictures: the 'jungle' pack, as the Plains' (in on the way when on the phone, else downloaded; stand-ins meanwhile).
// - Cheap phones: an animal more than 3 tiles out of view is not drawn (it still roams); the bamboo, still pictures, is
//   culled by 19zzzz-perf.js.
// - The first-time tour (C.TIPS jungle_tour), with the owner's pictures.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var J = C.JUNGLE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  if (!J || !C.PLACES.jungle) return;
  var OK_GREEN = 0x2f5a22;
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var have = function (key) { return !!(F.images && F.images[key]); };
  var HERE = { jungle: 1, jungle_cave: 1 };
  var here = function (w) { return !!(w && HERE[w.mapKey]); };

  C.TIPS.push({ key: 'jungle_tour', text: 'THE BAMBOO JUNGLE' }); // (appended last: a tip is its place in a saved number)

  // ---------- the maps; Manila's way in and out ----------
  var maps = F.ASSETS && F.ASSETS.maps, CLUMPS = null;
  if (maps && maps.pulag && maps.palawan_cave) {
    maps.jungle = L.jungleMap(maps.pulag);
    maps.jungle_cave = L.jungleCaveMap(maps.palawan_cave);
    CLUMPS = L.jungleClumps(maps.jungle);
  }
  var gate = C.MANILA.jungleGate; // (where you come back out: in front of it, facing the city; the way in: P.create)
  if (maps && maps.manila && gate) {
    maps.manila.layers.filter(function (l) { return l.type === 'objectgroup'; })[0].objects.push({ id: 90102, name: 'from_jungle', type: 'spawn', point: true,
      x: (gate.box[0] + gate.box[2] / 2) * T, y: Math.round((gate.box[1] - 0.5) * T), width: 0, height: 0, rotation: 0, visible: true, properties: [{ name: 'dir', type: 'string', value: 'up' }] });
  }
  // the pack, on the Downloads page once it has anything in it; a game opened in the Jungle takes it in first
  var packHas = function () { return !!(F.packFiles && F.packFiles('jungle').length); };
  if (F.PACK_INFO && packHas()) F.PACK_INFO.jungle = { name: 'The Bamboo Jungle', icon: 'bow', desc: 'The Bamboo Jungle and the Bamboo Hollows: their animals, props, ground and cave.' };
  var softPacks = F.softPacks;
  F.softPacks = function (map) { return (softPacks ? softPacks(map) : []).concat(HERE[map] && packHas() ? ['jungle'] : []); };

  // ---------- the icons: frames of the items texture (C.JUNGLE_ICON_BASE), the owner's sheet or the stand-ins ----------
  F.paintJungleIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var n = C.JUNGLE_ICONS.length, cv = document.createElement('canvas'), g = cv.getContext('2d'), art = F.images && F.images.jungle_icons, src0 = tex.source[0];
    cv.width = 8 * 128;
    cv.height = Math.ceil(n / 8) * 128;
    C.JUNGLE_ICONS.forEach(function (name, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128, fr = !art && tex.get(C.ICON[C.JUNGLE_STAND[name]]);
      if (art) return g.drawImage(art, x, y, 128, 128, x, y, 128, 128);
      if (fr && src0 && src0.image) { var k = (src0.image.naturalWidth || src0.image.width) / src0.width; g.drawImage(src0.image, fr.cutX * k, fr.cutY * k, fr.cutWidth * k, fr.cutHeight * k, x + 6, y + 6, 116, 116); }
    });
    tex.jungleArt = have('jungle_icons');
    var src = tex.jungleSrc;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.jungleSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.JUNGLE_ICONS.forEach(function (name, i) { var key = C.JUNGLE_ICON_BASE + i; if (tex.has(key)) tex.remove(key); tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintJungleIcons(scene);
    return out;
  };
  var iconsIn = function () { var w = F.world, t = w && w.textures && w.textures.exists('items') && w.textures.get('items'); if (t && !t.jungleArt && have('jungle_icons')) F.paintJungleIcons(w); };
  F.bus.on('packart', function (k) { if (k === 'jungle_icons') iconsIn(); });
  F.bus.on('packs', iconsIn);

  // ---------- going there: the pack on the way in ----------
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    if (!this.busy && !visiting(this) && HERE[to] && !HERE[this.mapKey] && packHas() && !F.packReady('jungle') && F.packOnPhone('jungle')) {
      if (this.jgGate) return;
      var self = this, args = arguments;
      this.jgGate = true;
      return F.loadPack('jungle').then(function () { self.jgGate = false; if (self.sys && self.sys.isActive()) travel.apply(self, args); });
    }
    return travel.apply(this, arguments);
  };

  // ---------- in Manila (the gate) and in the Jungle ----------
  var create = P.create;
  P.create = function () {
    this.jungle = null;
    create.apply(this, arguments);
    var self = this, s = this.state, open = L.wildOpen(s, 'jungle');
    // the icons, once the Jungle is open (a small picture)
    var f = F.packedFile && F.packedFile('jungle_icons');
    if (f && !have('jungle_icons') && F.needImage && (open || (F.onPhone && F.onPhone(f.file)))) F.needImage('jungle_icons');
    if (this.mapKey === 'manila' && gate && open && !visiting(this)) this.openJungleGate();
    if (!here(this) || visiting(this)) return;
    this.jungle = { told: false };
    if (packHas() && !F.packReady('jungle') && F.canFetch && F.canFetch()) {
      if (F.packOnPhone('jungle')) F.loadPack('jungle');
      else if (!F.packProgress('jungle')) F.downloadPack('jungle').then(function (ok) { if (ok) F.loadPack('jungle'); });
    }
    var npc = C.PLACES.jungle.npc.sheet;
    if (this.mapKey === 'jungle' && !have(npc) && F.needImage && F.packedFile && F.packedFile(npc)) F.needImage(npc);
    if (this.mapKey === 'jungle' && !quiet() && !L.tipSeen(s, 'jungle_tour')) {
      var tries = 0, show = function () {
        if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'jungle_tour')) return;
        if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, show);
        L.takeTip(s, 'jungle_tour');
        F.Host.save(s);
        F.ui.jungleTour();
      };
      this.time.delayedCall(1600, show);
    }
  };
  // Manila's Jungle Gate, open: its fence and its arch's solid foot go, and its box is the way in (walk into it)
  P.openJungleGate = function () {
    var b = gate.box, x0 = b[0] * T, y0 = b[1] * T, x1 = (b[0] + b[2]) * T, y1 = (b[1] + b[3]) * T, x, y;
    for (x = b[0]; x < b[0] + b[2]; x++) { if (this.layers.Walls) this.layers.Walls.removeTileAt(x, b[1]); for (y = b[1]; y < b[1] + b[3]; y++) delete this.blocked[this.idx(x, y)]; }
    this.solids.getChildren().slice().forEach(function (z) { if (z.x > x0 && z.x < x1 && z.y > y0 && z.y < y1) z.destroy(); });
    this.objects = this.objects.filter(function (o) { return o.name !== 'mn_gate_jungle'; });
    this.objects.push({ type: 'warp', name: 'jungle_gate', x0: b[0], y0: b[1], x1: b[0] + b[2] - 1, y1: b[1] + b[3] - 1, px: x0, py: y0, pw: x1 - x0, ph: y1 - y0,
      props: { to: 'jungle', spawn: 'from_city', walk: true } });
  };
  // Diday's own picture, when it comes
  F.bus.on('packart', function (k) {
    var w = F.world, n = w && w.placeNpc;
    if (!n || !w.sys || !w.sys.isActive() || k !== C.PLACES.jungle.npc.sheet || n.p.id !== 'jungle' || n.img.texture.key === k) return;
    F.ensureTexture(w, k);
    n.img.setTexture(k, 0).clearTint();
  });

  // ---------- tall bamboo stops long shots (yours) ----------
  // How far (world units) a shot from (x, y) going `ang` flies here before the bamboo stops it, or null. (The ground under
  // a shot: it flies about half a tile up.)
  P.bambooStop = function (x, y, ang, range) {
    if (this.mapKey !== 'jungle' || !CLUMPS) return null;
    var d = L.bambooStop(CLUMPS.at, x / T, y / T + 0.45, ang, range / T);
    return d == null ? null : d * T;
  };
  P.bambooPuff = function (x, y) {
    if (this.bits) this.bits.dust.explode(3, x, y);
    for (var i = 0; i < 6; i++) { // (a puff of bamboo leaves where it stopped)
      var leaf = this.add.ellipse(x, y - 0.3 * T, 0.26 * T, 0.1 * T, i % 2 ? 0x6a9a2a : 0xa8d860, 1).setDepth(F.WorldScene.DEPTH.fx).setAngle(60 * i);
      this.tweens.add({ targets: leaf, x: x + (Math.random() - 0.5) * 1.2 * T, y: y + (Math.random() - 0.3) * 0.8 * T, angle: leaf.angle + 240 * (Math.random() - 0.5), alpha: 0, duration: 800 + i * 80, ease: 'Quad.out', onComplete: function (tw, t) { t[0].destroy(); } });
    }
    if (this.jungle && !this.jungle.told && !quiet()) { this.jungle.told = true; F.ui.toast('The tall bamboo stops a shot longer than 4 tiles. Get closer!', 2600, OK_GREEN); }
  };
  var wpnFly = P.wpnFly;
  P.wpnFly = function (o) {
    var stop = o.shown ? null : this.bambooStop(o.x, o.y, o.ang, o.range);
    if (stop == null || stop >= o.range) return wpnFly.call(this, o);
    var sh = wpnFly.call(this, Object.assign({}, o, { range: stop, flight: Math.min(o.flight || stop, stop) }));
    if (sh) sh.bamboo = stop; // (where the bamboo is: a javelin thrown at something nearer comes down before it)
    return sh;
  };
  var wpnStep = P.wpnStep;
  P.wpnStep = function (sh, dt) {
    var on = wpnStep.call(this, sh, dt);
    if (!on && sh.bamboo && !sh.puffed && sh.k !== 'boomerang' && sh.went >= sh.bamboo - 2) { sh.puffed = true; this.bambooPuff(sh.x, sh.y); }
    return on;
  };
  var wildArrow = P.wildArrow;
  P.wildArrow = function (x, y, ang, left, shown, level) {
    var r = wildArrow.apply(this, arguments), stop = shown ? null : this.bambooStop(x, y, ang, left), ar = this.wildArrows && this.wildArrows[this.wildArrows.length - 1];
    if (stop != null && ar && ar.left > stop) { ar.left = stop; var self = this; this.time.delayedCall(Math.round(stop / (Math.hypot(ar.vx, ar.vy) || 1) * 1000), function () { if (self.sys && self.sys.isActive() && ar.img.active) self.bambooPuff(x + Math.cos(ang) * stop, y + Math.sin(ang) * stop); }); } // (not if it hit something first)
    return r;
  };

  // ---------- the Pilandok zigzags as it runs ----------
  var updateWild = P.updateWild;
  P.updateWild = function (a, dt, frozen) {
    if (!a.def.zigzag) return updateWild.apply(this, arguments);
    if (a.mode !== 'flee' || frozen) { a.zz = null; return updateWild.apply(this, arguments); }
    if (a.zz == null) { a.zz = 0; a.zz0 = Math.atan2(a.vy, a.vx); }
    a.zz += dt;
    var sp = a.def.run * T, ang = a.zz0 + L.zigzagTurn(a.zz), vx = a.vx = Math.cos(ang) * sp, vy = a.vy = Math.sin(ang) * sp;
    var r = updateWild.apply(this, arguments);
    if (a.mode === 'flee' && (a.vx !== vx || a.vy !== vy)) a.zz0 = Math.atan2(a.vy, a.vx) - L.zigzagTurn(a.zz); // (off a wall: on from there)
    return r;
  };

  // ---------- drawing only what is near; each creature's own picture the moment it is in ----------
  var wildShow = P.wildShow;
  P.wildShow = function (a, d, dt) {
    if (!here(this)) return wildShow.apply(this, arguments);
    var v = this.cameras.main.worldView, m = 3 * T, on = a.x > v.x - m && a.x < v.right + m && a.y > v.y - m && a.y < v.bottom + m + 2 * T;
    if (a.img.visible !== on) { a.img.setVisible(on); a.sh.setVisible(on); if (a.grass) { a.grass.now.setVisible(on); a.grass.old.setVisible(on); } }
    if (!on) return null;
    if (a.def.place === 'jungle' && a.def.sheet && have(a.def.sheet) && a.img.texture.key !== a.def.sheet) {
      a.img.setTexture(F.ensureTexture(this, a.def.sheet)).clearTint();
      if (have(a.def.sheet + 'shade')) a.sh.setTexture(F.ensureTexture(this, a.def.sheet + 'shade'));
    }
    return wildShow.apply(this, arguments);
  };

  // ---------- the first-time tour, with the owner's pictures ----------
  var K = F.tourKit;
  var ART = ['npc_diday', 'wild_biik', 'wild_baboydamo', 'wild_pilandok', 'props/jungle_bamboo', 'props/jungle_mouth', 'wild_jungle_tigma', 'ground_jungle'];
  U.jungleTour = function (done) { var self = this; (K ? K.artReady(ART) : Promise.resolve()).then(function () { self.tour('jungle', done); }); };
  var ground = function (ui, sc) { // the jungle floor behind a step (the owner's texture, else a drawn green)
    var g = ui.add.graphics();
    g.fillStyle(0x6a9a40, 1).fillRoundedRect(4, 70, 264, 58, 10);
    sc.add(g);
    if (have('ground_jungle')) { F.ensureTexture(ui, 'ground_jungle'); sc.add(ui.add.tileSprite(136, 99, 264, 58, 'ground_jungle').setTileScale(0.25)); }
  };
  var bamboo = function (ui, sc, x, h) { return K.fit(ui, sc, have('props/jungle_bamboo') ? 'props/jungle_bamboo' : 'props/bamboo_bush', x, 124, h * 0.7, h, 0); };
  if (K) F.TOURS.jungle = {
    title: 'THE BAMBOO JUNGLE',
    steps: [
      { text: 'Thick bamboo south of Manila, with tight trails between. Diday weaves baskets by the gate, and the warty Biik roots about.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var p = K.person(ui, sc, 'npc_diday', C.PLACES.jungle.npc.look, 70, 122, 100);
          if (p) K.tw(ui, move, { targets: p, y: 116, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          K.creature(ui, sc, 'biik', 9, 196, 118, 52);
        } },
      { text: 'Tall bamboo stops a shot longer than 4 tiles, and the animals hide until you are 2 or 3 tiles off. The Javelin is fast and hits hard: best here. A throw costs what an arrow does.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          bamboo(ui, sc, 150, 110);
          var j = K.icon(ui, sc, 58, 70, C.wpnIcon('javelin_0'), 0.44);
          K.tw(ui, move, { targets: j, x: 118, duration: 700, yoyo: true, repeat: -1, ease: 'Quad.in' });
          K.words(ui, sc, 222, 40, 'Stops past 4 tiles', 12);
        } },
      { text: 'The Baboy-damo go about in pairs and charge together. The rare Pilandok zigzags as it runs: wait for it to come straight.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          [0, 1].forEach(function (i) { var d = K.creature(ui, sc, 'baboydamo', 7, 70 + i * 26, 112 + i * 12, 54, true); if (d) K.tw(ui, move, { targets: d, x: d.x + 16, duration: 520, yoyo: true, repeat: -1, ease: 'Quad.in', delay: i * 90 }); });
          var p = K.creature(ui, sc, 'pilandok', 7, 206, 116, 46);
          if (p) K.tw(ui, move, { targets: p, y: 96, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } },
      { text: 'Feed the Biik cassava, nine times, while it is calm. Then it walks with you and fetches what a hunt leaves on the ground.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var c = K.creature(ui, sc, 'biik', 0, 96, 118, 54);
          if (c) K.tw(ui, move, { targets: c, y: 112, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          K.icon(ui, sc, 176, 50, C.ITEMS.cassava.icon, 0.3);
          K.words(ui, sc, 214, 98, 'Fetch!', 15, '#2f6a1a');
        } },
      { text: 'In the far south: the Bamboo Hollows, 50 floors. The Tigmamanukan guards every 10th, the sleepy Bamboo Giant waits on floor 50.',
        draw: function (ui, sc, move) {
          if (!K.fit(ui, sc, 'props/jungle_mouth', 76, 124, 116, 110, 0)) K.words(ui, sc, 76, 70, 'The Bamboo Hollows', 13);
          var g = K.creature(ui, sc, 'bamboogiant', 0, 198, 124, 104);
          if (g) K.tw(ui, move, { targets: g, scaleY: g.scaleY * 1.04, duration: 500, yoyo: true, repeat: -1 });
        } },
    ],
  };
})(window.Farm = window.Farm || {});
