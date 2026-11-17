// The Open Plains and the Armory in the world (owner, 18 Nov 2026; content 00-zzz...z-plains.js, rules 01-logicZ...Z-plains.js).
// - The two maps are built here at load (L.plainsMap from Pulag's sheets, L.plainsCaveMap from Palawan's cave): the page
//   carries no new map. The rest of a hunting place (Ka Pedring and his story, the tame, the hidden chests, the medals,
//   the cave, its guards and boss, the daily chest) is the places' engine (19zzzzz-places.js, 19zt-lair.js).
// - The valley road: off the town's east end into the Plains (once they are open: L.valleyVia), along the road east and
//   out to Manila's Plains Gate; and back. Before 30 hunts, or riding a horse that may not go into a hunting ground, the
//   road goes straight, as it always did.
// - Flocks: the Pugo and the Batik Deer go about in threes behind a leader, side by side, and all run when one does.
// - The Plains Halt's trough (the horse drinks: rested at once), Ka Pedring's meadow with the grown Tamaraw (scenery,
//   never targets: no animal walks in, nothing hits them).
// - The pictures: the 'plains' pack (tools/manila/plains-import.js). Taken in on the way in when it is on the phone, else
//   downloaded in the background; until then every creature is a tinted stand-in row, the props the map's stand-ins,
//   the icons copied from items the game has. A creature changes to its own picture the moment it is in.
// - Cheap phones: the map is drawn by the tilemap only where you look; an animal more than 3 tiles out of view is not
//   drawn (its picture and shadow hidden; it still roams), and neither is the herd.
// - The Armory opens: Panday Lando's door in Manila opens F.ui.openArmory (buy, upgrade, ammo, repairs).
// - Two first-time tours (C.TIPS plains_tour, armory_tour), with the owner's pictures.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var PL = C.PLAINS;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  if (!PL || !C.PLACES.plains) return;
  var K = F.UI_CONST, INK = K.INK;
  var GOLD = 0x7a5a12, OK_GREEN = 0x2f5a22;
  var FRAME_H = 252, FEET = 233;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var have = function (key) { return !!(F.images && F.images[key]); };
  var HERE = { plains: 1, plains_cave: 1 };
  var plainsHere = function (w) { return !!(w && HERE[w.mapKey]); };

  C.TIPS.push({ key: 'plains_tour', text: 'THE OPEN PLAINS' }, { key: 'armory_tour', text: 'THE ARMORY' }); // (appended last: a tip is its place in a saved number)

  // ---------- the maps ----------
  var maps = F.ASSETS && F.ASSETS.maps;
  if (maps && maps.pulag && maps.palawan_cave) {
    maps.plains = L.plainsMap(maps.pulag);
    maps.plains_cave = L.plainsCaveMap(maps.palawan_cave);
  }
  // the pack, on the Downloads page once it has anything in it
  var packHas = function () { return !!(F.packFiles && F.packFiles('plains').length); };
  if (F.PACK_INFO && packHas()) F.PACK_INFO.plains = { name: 'The Open Plains', icon: 'bow', desc: "The Open Plains and Sarangay's Halls: their animals, props, ground and cave." };
  // a game opened in the Plains takes its pictures in first when they are on the phone (19zl-packs-ui.js)
  var softPacks = F.softPacks;
  F.softPacks = function (map) { return (softPacks ? softPacks(map) : []).concat(HERE[map] && packHas() ? ['plains'] : []); };

  // ---------- the icons: frames of the items texture (C.PLAINS_ICON_BASE), the owner's sheet or the stand-ins ----------
  var iconCanvas = function (tex) {
    var n = C.PLAINS_ICONS.length, cv = document.createElement('canvas'), g = cv.getContext('2d'), art = F.images && F.images.plains_icons, src = tex.source[0];
    cv.width = 8 * 128;
    cv.height = Math.ceil(n / 8) * 128;
    C.PLAINS_ICONS.forEach(function (name, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
      if (art) return g.drawImage(art, x, y, 128, 128, x, y, 128, 128);
      var fr = tex.get(C.ICON[C.PLAINS_STAND[name]]); // (a stand-in: the frame of an item the game has)
      if (fr && src && src.image) {
        var k = (src.image.naturalWidth || src.image.width) / src.width; // (a sheet stored smaller than its frames say)
        g.drawImage(src.image, fr.cutX * k, fr.cutY * k, fr.cutWidth * k, fr.cutHeight * k, x + 6, y + 6, 116, 116);
      }
    });
    return cv;
  };
  F.paintPlainsIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items');
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource) return;
    var cv = iconCanvas(tex), src = tex.plainsSrc;
    tex.plainsArt = have('plains_icons');
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.plainsSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.PLAINS_ICONS.forEach(function (name, i) {
      var key = C.PLAINS_ICON_BASE + i;
      if (tex.has(key)) tex.remove(key);
      tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128);
    });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintPlainsIcons(scene);
    return out;
  };
  // the owner's icons: asked for once the Plains are open (a small picture), painted in when they come
  var askIcons = function () {
    var s = F.session && F.session.state, f = F.packedFile && F.packedFile('plains_icons');
    if (!f || have('plains_icons') || !s || !F.needImage || !(L.wildOpen(s, 'plains') || (F.onPhone && F.onPhone(f.file)))) return;
    F.needImage('plains_icons');
  };
  F.bus.on('packart', function (k) {
    if (k === 'plains_icons' && F.world && F.world.textures) { var t = F.world.textures.exists('items') && F.world.textures.get('items'); if (t && !t.plainsArt) F.paintPlainsIcons(F.world); }
  });
  F.bus.on('packs', function () {
    if (have('plains_icons') && F.world && F.world.textures) { var t = F.world.textures.exists('items') && F.world.textures.get('items'); if (t && !t.plainsArt) F.paintPlainsIcons(F.world); }
  });

  // ---------- the valley road (and the pack on the way in) ----------
  var wildReady = function () { return !!(F.packReady && (F.packReady('wild') || F.packOnPhone('wild'))); };
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    if (!this.busy && !visiting(this)) {
      var s = this.state, riding = !!F.session.riding;
      if (to === 'manila' && spawn === 'from_valley' && this.mapKey === 'town' && L.valleyVia(s, riding) && wildReady()) return this.travel('plains', 'from_town');
      if (to === 'town' && spawn === 'from_manila' && this.mapKey === 'manila' && L.valleyVia(s, riding) && wildReady()) return this.travel('plains', 'from_city');
      // the Plains' own pictures: in first when they are on the phone (a moment); else the stand-ins
      if (HERE[to] && !HERE[this.mapKey] && packHas() && !F.packReady('plains') && F.packOnPhone('plains')) {
        if (this.plGate) return;
        var self = this, args = arguments;
        this.plGate = true;
        return F.loadPack('plains').then(function () { self.plGate = false; if (self.sys && self.sys.isActive()) travel.apply(self, args); });
      }
    }
    return travel.apply(this, arguments);
  };

  // ---------- in the Plains ----------
  var create = P.create;
  P.create = function () {
    this.plains = null;
    create.apply(this, arguments);
    askIcons();
    if (!plainsHere(this) || visiting(this)) return;
    var self = this, s = this.state;
    this.plains = { herd: [], cullAt: 0 };
    if (this.mapKey === 'plains') this.setupHerd();
    // the pack: downloaded in the background when it is not on the phone (the stand-ins meanwhile)
    if (packHas() && !F.packReady('plains') && F.canFetch && F.canFetch()) {
      if (F.packOnPhone('plains')) F.loadPack('plains');
      else if (!F.packProgress('plains')) F.downloadPack('plains').then(function (ok) { if (ok) F.loadPack('plains'); });
    }
    var npc = C.PLACES.plains.npc.sheet;
    if (this.mapKey === 'plains' && !have(npc) && F.needImage && F.packedFile && F.packedFile(npc)) F.needImage(npc);
    // the first-time tour of the Plains
    if (this.mapKey === 'plains' && !quiet() && !L.tipSeen(s, 'plains_tour')) {
      var tries = 0, show = function () {
        if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'plains_tour')) return;
        if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, show);
        L.takeTip(s, 'plains_tour');
        F.Host.save(s);
        F.ui.plainsTour();
      };
      this.time.delayedCall(1600, show);
    }
  };
  // Ka Pedring's own picture, when it comes (the stand-in villager look until then)
  F.bus.on('packart', function (k) {
    var w = F.world, n = w && w.placeNpc;
    if (!n || !w.sys || !w.sys.isActive() || k !== C.PLACES.plains.npc.sheet || n.p.id !== 'plains' || n.img.texture.key === k) return;
    F.ensureTexture(w, k);
    n.img.setTexture(k, 0).clearTint();
  });

  // The herd: the grown Tamaraw in the meadow (the calf's picture, bigger), grazing and wandering slowly. Scenery only.
  var herdFrame = function (k) {
    var def = WI.animals.tamaraw_calf;
    return have(def.sheet) ? { key: def.sheet, frame: k } : { key: 'wild', frame: WI.order.indexOf(def.sheetRow) * 12 + k };
  };
  var inner = function () { var m = PL.meadow; return { x0: (m[0] + 1.6) * T, y0: (m[1] + 1.9) * T, x1: (m[0] + m[2] - 1.6) * T, y1: (m[1] + m[3] - 1.3) * T }; };
  P.setupHerd = function () {
    var b = inner(), def = WI.animals.tamaraw_calf;
    for (var i = 0; i < PL.herd; i++) {
      var x = b.x0 + (b.x1 - b.x0) * ((i * 0.37 + 0.15) % 1), y = b.y0 + (b.y1 - b.y0) * ((i * 0.61 + 0.2) % 1), fr = herdFrame(10);
      F.ensureTexture(this, fr.key);
      var sc = (1.45 + (i % 2) * 0.15) * T / def.px;
      var img = this.add.image(x, y, fr.key, fr.frame).setOrigin(0.5, FEET / FRAME_H).setScale(sc);
      if (fr.key === 'wild') img.setTint(0x4a4038);
      var sh = this.add.image(x, y + 6, 'fx-wildshadow').setDisplaySize(1.1 * T, 0.32 * T).setDepth(DEPTH.shadow).setAlpha(0.8);
      this.plains.herd.push({ img: img, sh: sh, x: x, y: y, tx: x, ty: y, t: 1500 + i * 900, step: 0, left: i % 2 === 0, mode: 'graze' });
    }
  };
  P.updateHerd = function (dt, view) {
    var b = inner();
    this.plains.herd.forEach(function (h) {
      h.t -= dt;
      if (h.t <= 0) {
        if (h.mode === 'graze') { h.mode = 'walk'; h.tx = b.x0 + Math.random() * (b.x1 - b.x0); h.ty = b.y0 + Math.random() * (b.y1 - b.y0); h.t = 9000; }
        else { h.mode = 'graze'; h.t = 3000 + Math.random() * 5000; }
      }
      var dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy), k = 10;
      if (h.mode === 'walk' && d > 8) {
        var v = Math.min(d, 0.35 * T * dt / 1000);
        h.x += dx / d * v;
        h.y += dy / d * v;
        h.step += dt;
        if (Math.abs(dx) > 4) h.left = dx < 0;
        k = Math.abs(dx) > Math.abs(dy) ? 6 + [1, 0, 2, 0][Math.floor(h.step / 220) % 4] : (dy > 0 ? 0 : 3) + [1, 0, 2, 0][Math.floor(h.step / 220) % 4];
      } else if (h.mode === 'walk') { h.mode = 'graze'; h.t = 3000 + Math.random() * 5000; }
      var on = !view || (h.x > view.x - 2 * T && h.x < view.right + 2 * T && h.y > view.y - 2 * T && h.y < view.bottom + 3 * T);
      h.img.setVisible(on);
      h.sh.setVisible(on);
      if (!on) return;
      var fr = herdFrame(k);
      if (h.img.texture.key !== fr.key) { F.ensureTexture(h.img.scene, fr.key); h.img.setTexture(fr.key); h.img.clearTint(); }
      h.img.setFrame(fr.frame).setFlipX(k >= 6 && !h.left).setPosition(h.x, h.y);
      h.sh.setPosition(h.x, h.y + 6);
      F.depthTo(h.img, DEPTH.actor + h.y / 1e5);
    });
  };

  // No animal roams into the meadow (the herd's), nor spawns in it.
  var wildFree = P.wildFree;
  P.wildFree = function (x, y) {
    if (this.mapKey === 'plains' && L.plainsInMeadow(x, y)) return false;
    return wildFree.call(this, x, y);
  };

  // ---------- flocks ----------
  var addWildAnimal = P.addWildAnimal;
  P.addWildAnimal = function (kind, slot, x, y, sized) {
    var a = addWildAnimal.apply(this, arguments);
    if (a.def.flock && this.wild) a.flk = L.flockOf(this.mapKey, slot);
    return a;
  };
  // the one leading a flock now: its first member still here
  var leaderOf = function (w, a) {
    if (!a.flk) return null;
    var list = w.wild.animals;
    for (var i = 0; i < a.flk.slots.length; i++) {
      var sl = a.flk.slots[i];
      for (var j = 0; j < list.length; j++) if (list[j].slot === sl && list[j].hp > 0) return list[j];
    }
    return null;
  };
  var placeIn = function (a, lead) { // a's place behind the one leading now
    var i = a.flk.slots.indexOf(a.slot) - lead.flk.slots.indexOf(lead.slot);
    var ang = lead.vx || lead.vy ? Math.atan2(lead.vy, lead.vx) : (lead.left ? Math.PI : 0);
    return L.flockSpot(lead.x, lead.y, ang, Math.max(1, i), T, a.def.w, a.def.flock); // (a pair stands side by side: the Jungle's rules)
  };
  // set up: a flock together, round its leader
  var setupWild = P.setupWild;
  P.setupWild = function () {
    setupWild.apply(this, arguments);
    var self = this, w = this.wild;
    if (!w || this.wildFollowing()) return;
    w.animals.forEach(function (a) {
      var lead = leaderOf(self, a);
      if (!lead || lead === a) return;
      var p = placeIn(a, lead);
      if (self.wildFree(Math.floor(p.x / T), Math.floor(p.y / T))) { a.x = p.x; a.y = p.y; a.left = lead.left; self.drawWild(a); }
    });
  };
  // each frame: a follower keeps to its place (it catches up at a trot), and does what its leader does
  var updateWild = P.updateWild;
  P.updateWild = function (a, dt, frozen) {
    if (a.flk && a.mode !== 'flee' && a.mode !== 'charge' && !frozen) {
      var lead = leaderOf(this, a);
      if (lead && lead !== a) {
        if (lead.mode === 'flee') { this.wildFlee(a, { x: a.x - lead.vx, y: a.y - lead.vy }); }
        else {
          var p = placeIn(a, lead), dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
          if (d > 0.45 * T) {
            var sp = Math.min(a.def.run * 0.55, Math.max(a.def.walk * 1.2, d / T)) * T;
            a.mode = 'walk';
            a.vx = dx / d * sp;
            a.vy = dy / d * sp;
          } else {
            a.mode = lead.mode === 'walk' ? 'walk' : lead.mode;
            a.vx = lead.vx;
            a.vy = lead.vy;
            if (!(lead.vx || lead.vy)) a.left = lead.left;
          }
          a.t = 600; // (it never wanders off on its own)
        }
      }
    }
    return updateWild.apply(this, arguments);
  };
  // when one runs, the whole flock runs the same way
  var wildFlee = P.wildFlee;
  var fleeing = false;
  P.wildFlee = function (a, f) {
    wildFlee.apply(this, arguments);
    if (fleeing || !a.flk || !this.wild) return;
    fleeing = true;
    try {
      var self = this, ang = Math.atan2(a.vy, a.vx);
      this.wild.animals.forEach(function (b) {
        if (b === a || !b.flk || b.flk.lead !== a.flk.lead || b.mode === 'flee' || b.hp <= 0) return;
        wildFlee.call(self, b, { x: b.x - Math.cos(ang) * T, y: b.y - Math.sin(ang) * T });
      });
    } finally { fleeing = false; }
  };

  // ---------- drawing only what is near (the Plains and its cave) ----------
  var own = function (def) { return !!(def.sheet && have(def.sheet)); };
  var wildShow = P.wildShow;
  P.wildShow = function (a, d, dt) {
    if (!plainsHere(this)) return wildShow.apply(this, arguments);
    var v = this.cameras.main.worldView, m = 3 * T, on = a.x > v.x - m && a.x < v.right + m && a.y > v.y - m && a.y < v.bottom + m + 2 * T;
    if (a.img.visible !== on) { a.img.setVisible(on); a.sh.setVisible(on); if (a.grass) { a.grass.now.setVisible(on); a.grass.old.setVisible(on); } }
    if (!on) return null;
    // its own picture, the moment it is in (the stand-in row until then)
    if (a.def.place === 'plains' && own(a.def) && a.img.texture.key !== a.def.sheet) {
      a.img.setTexture(F.ensureTexture(this, a.def.sheet)).clearTint();
      if (have(a.def.sheet + 'shade')) a.sh.setTexture(F.ensureTexture(this, a.def.sheet + 'shade'));
    }
    return wildShow.apply(this, arguments);
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (!this.plains || this.busy || !this.sys.isActive()) return;
    if (this.plains.herd.length) this.updateHerd(Math.min(delta, 100), this.cameras.main.worldView);
  };

  // ---------- the Plains Halt's trough; the Armory's door ----------
  var withHorse = function (w) { var S = F.session; return !!(w.state.horse && (S.riding || S.horseFollow) && w.horse); };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var self = this;
    if (o && o.type === 'trough' && this.mapKey === 'plains') {
      if (!withHorse(this)) return { label: 'Look', icon: -1, run: function () { F.ui.dialog('THE PLAINS HALT\nA long trough of cool water by the road. Bring your horse: it drinks and is rested at once.'); } };
      return { label: 'Water', icon: C.ICON.horse != null ? C.ICON.horse : -1, run: function () { self.troughDrink(); } };
    }
    if (o && o.type === 'meadow') return null;
    if (o && this.mapKey === 'manila' && o.type === 'mn_spot' && o.name === 'armory' && C.MANILA.armory && C.MANILA.armory.on && !visiting(this)) {
      return { label: 'Armory', icon: C.wpnIcon('rifle_0'), run: function () { F.ui.openLandoArmory(); } };
    }
    return extraObjectAction.apply(this, arguments);
  };
  P.troughDrink = function () {
    var s = this.state, r = L.troughDrink(s), name = s.horse ? s.horse.name : 'Your horse';
    if (r === 'ok') {
      sfx('water');
      if (this.horse && this.puff) this.puff(this.facing(), 0x9fd8f0, 6);
      F.ui.toast(name + ' drinks from the trough. Rested! Stamina full.', 2600, OK_GREEN);
      F.bus.emit('hud');
      this.changed();
      this.save();
    } else if (r === 'full') F.ui.toast(name + ' is not thirsty: stamina is full.', 2200);
    return r;
  };

  // ---------- the calf's 6 slots: sent back to the Lodge, what was in them went into the bag or home ----------
  var setCompanion = L.setCompanion;
  L.setCompanion = function (s, id) {
    var had = s.inv.length, r = setCompanion.apply(this, arguments);
    if (r === 'ok' && F.ui && F.ui.toast && s.inv.length !== had && !quiet()) {
      F.ui.toast(s.inv.length > had ? 'The Tamaraw Calf carries 6 more things for you.' : s.carryHome ? s.carryHome + ' things the calf carried went home to your basket.' : 'The calf\'s 6 slots go back with it; what was in them is in your bag.', 2800, OK_GREEN);
    }
    s.carryHome = 0;
    if (r === 'ok') F.bus.emit('hud');
    return r;
  };

  // ---------- the Armory (Panday Lando, Manila) ----------
  U.openLandoArmory = function (opts) {
    var self = this, s = F.session && F.session.state;
    if (F.askWeaponArt) F.askWeaponArt();
    if (s && !quiet() && !L.tipSeen(s, 'armory_tour')) {
      L.takeTip(s, 'armory_tour');
      F.Host.save(s);
      return artReady(ARMORY_ART).then(function () { self.tour('armory', function () { self.openLandoArmory(opts); }); });
    }
    return this.openArmory(Object.assign({ title: "Panday Lando's Armory" }, opts || {}));
  };

  // ---------- the first-time tours, with the owner's pictures ----------
  var PLAINS_ART = ['npc_ka_pedring', 'wild_toro', 'wild_batikdeer', 'wild_tamaraw', 'props/plains_mouth', 'wild_sarangay', 'ground_plains'];
  var ARMORY_ART = ['props/manila_armory', 'npc_panday_lando', 'wpn_icons'];
  var artReady = function (list) { // (from the phone if there: a moment at most)
    var want = list.filter(function (k) { var f = F.packedFile && F.packedFile(k); return !have(k) && f && F.onPhone && F.onPhone(f.file) && F.canFetch(); });
    if (!want.length || !F.needImage) return Promise.resolve();
    return Promise.race([Promise.all(want.map(F.needImage)), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
      if (have('wpn_icons') && F.bus) F.bus.emit('packart', 'wpn_icons');
    });
  };
  U.plainsTour = function (done) {
    var self = this;
    artReady(PLAINS_ART).then(function () { self.tour('plains', done); });
  };
  var fit = function (ui, sc, key, cx, bottom, w, h, frame, tint) { // a picture fitted into a box, its feet on the box's bottom
    if (!have(key) && !(ui.textures.exists(key))) return null;
    F.ensureTexture(ui, key);
    var fr = ui.textures.getFrame(key, frame);
    if (!fr) return null;
    var img = ui.add.image(cx, bottom, key, frame).setOrigin(0.5, 1).setScale(Math.min(w / fr.realWidth, h / fr.realHeight));
    if (tint) img.setTint(tint);
    sc.add(img);
    return img;
  };
  var creature = function (ui, sc, kind, k, cx, bottom, h, flip) { // a creature's own picture, else its stand-in row
    var def = WI.animals[kind], mine = have(def.sheet);
    var img = fit(ui, sc, mine ? def.sheet : 'wild', cx, bottom, h * 1.3, h, mine ? (def.row || 0) * 12 + k : WI.order.indexOf(def.sheetRow) * 12 + k, mine ? 0 : def.tint);
    if (img && flip) img.setFlipX(true);
    return img;
  };
  var person = function (ui, sc, sheet, look, cx, bottom, h) {
    if (have(sheet)) return fit(ui, sc, sheet, cx, bottom, h, h, 0);
    return fit(ui, sc, 'people', cx, bottom, h, h, Math.max(0, C.VILLAGER_ORDER.indexOf(look)) * 9);
  };
  var icon = function (ui, sc, x, y, frame, scale) { F.ensureTexture(ui, 'items'); var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.tourKit = { fit: fit, creature: creature, person: person, icon: icon, words: words, tw: tw, artReady: artReady }; // (the Jungle's tour draws the same way)
  var ground = function (ui, sc) { // the plains' grass behind a step (the owner's texture, else a drawn gold-green)
    var g = ui.add.graphics();
    g.fillStyle(0xc9d46a, 1).fillRoundedRect(4, 70, 264, 58, 10);
    sc.add(g);
    if (have('ground_plains')) {
      F.ensureTexture(ui, 'ground_plains');
      var t = ui.add.tileSprite(136, 99, 264, 58, 'ground_plains').setTileScale(0.25);
      sc.add(t);
    }
  };
  F.TOURS.plains = {
    title: 'THE OPEN PLAINS',
    steps: [
      { text: 'Wide golden grassland on the valley road between Willowbrook and Manila. Ka Pedring the herdsman keeps the last wild Tamaraw here.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var p = person(ui, sc, 'npc_ka_pedring', C.PLACES.plains.npc.look, 70, 122, 100);
          if (p) tw(ui, move, { targets: p, y: 116, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          creature(ui, sc, 'tamaraw_calf', 10, 196, 118, 64);
        } },
      { text: 'The animals see you from far off, and the Wild Toro charges from 4 tiles. The Rifle reaches 4 to 8 tiles: hit them first. A shot costs what an arrow does.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var t = creature(ui, sc, 'toro', 11, 200, 118, 70);
          if (t) tw(ui, move, { targets: t, x: 176, duration: 650, yoyo: true, repeat: -1, ease: 'Quad.in' });
          icon(ui, sc, 58, 74, C.wpnIcon('rifle_0'), 0.44);
          words(ui, sc, 58, 116, 'Reach 4-8', 12);
        } },
      { text: 'Batik Deer and Pugo go about in threes, side by side, and run off together. The Moon Rifle\'s shot goes through one into the one behind.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          [0, 1, 2].forEach(function (i) {
            var d = creature(ui, sc, 'batikdeer', 6, 92 + i * 52, 116 - (i % 2) * 6, 58);
            if (d) tw(ui, move, { targets: d, x: d.x - 14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 120 });
          });
        } },
      { text: 'Feed the Tamaraw Calf oats, ten times, while it is calm. Then it walks with you and carries 6 more things in your bag.',
        draw: function (ui, sc, move) {
          ground(ui, sc);
          var c = creature(ui, sc, 'tamaraw_calf', 0, 96, 118, 62);
          if (c) tw(ui, move, { targets: c, y: 112, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          icon(ui, sc, 176, 50, C.ITEMS.oats.icon, 0.3);
          words(ui, sc, 214, 98, '+6 bag', 15, '#2f6a1a');
        } },
      { text: "In the mesa to the north-east: Sarangay's Halls, 50 floors. A Sarangay guards every 10th, the Arimaonga waits on floor 50.",
        draw: function (ui, sc, move) {
          var m = fit(ui, sc, 'props/plains_mouth', 76, 124, 116, 110, 0);
          if (!m) words(ui, sc, 76, 70, "Sarangay's Halls", 13);
          var g = creature(ui, sc, 'sarangay', 9, 198, 124, 104);
          if (g) tw(ui, move, { targets: g, scaleY: g.scaleY * 1.04, duration: 500, yoyo: true, repeat: -1 });
        } },
    ],
  };
  F.TOURS.armory = {
    title: "PANDAY LANDO'S ARMORY",
    steps: [
      { text: 'The Armory is open! Panday Lando makes the Rifle, the Javelin and the Boomerang. They work in every hunting place.',
        draw: function (ui, sc, move) {
          var b = fit(ui, sc, 'props/manila_armory', 92, 126, 170, 120, 0) || fit(ui, sc, 'props/forge', 92, 126, 150, 110, 0);
          void b;
          var p = person(ui, sc, 'npc_panday_lando', 'bram', 222, 124, 96);
          if (p) tw(ui, move, { targets: p, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } },
      { text: 'Buy one, then bring Gold and materials to take it a level up: reach and hit grow, up to the Moon level. Toro Hide and Horn come from the Open Plains.',
        draw: function (ui, sc, move) {
          ['rifle', 'javelin', 'boomerang'].forEach(function (k, i) {
            var ic = icon(ui, sc, 52 + i * 84, 58, C.wpnIcon(k + '_' + (i * 2)), 0.5);
            tw(ui, move, { targets: ic, scale: 0.55, duration: 500, yoyo: true, repeat: -1, delay: i * 160 });
            words(ui, sc, 52 + i * 84, 108, C.WEAPONS[k].name, 12);
          });
        } },
      { text: 'The Rifle needs bullets and the Javelin javelins: buy them here (Ammo). The Boomerang needs none, but it wears out: Lando mends it (Repairs).',
        draw: function (ui, sc, move) {
          var a = icon(ui, sc, 70, 60, C.ITEMS.bullets.icon, 0.46);
          icon(ui, sc, 136, 60, C.ITEMS.javelins.icon, 0.46);
          var bm = icon(ui, sc, 206, 60, C.wpnIcon('boomerang_0'), 0.46);
          tw(ui, move, { targets: bm, angle: 360, duration: 1400, repeat: -1 });
          tw(ui, move, { targets: a, y: 54, duration: 400, yoyo: true, repeat: -1 });
          words(ui, sc, 103, 110, 'Ammo', 13);
          words(ui, sc, 206, 110, 'Repairs', 13);
        } },
    ],
  };
})(window.Farm = window.Farm || {});
