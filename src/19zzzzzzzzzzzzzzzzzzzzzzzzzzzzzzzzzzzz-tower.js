// The Lost Tower in the world (owner, 12 Nov 2026; content 00-zzzzzzzzzzzzzzzzzzzzzz-tower.js, rules
// 01-logicZZZZZZZZZZZZZZZZZ-tower.js). It runs on the caves' own code (19zt-lair.js): F.dungeonOf('tower') gives the
// floor's realm as a cave (its colours, its roster, the deepest floor and the lift), so the stairs up are the caves' gate
// (shut until every enemy is down), the lift by the way in stops every 10 floors you have reached, and the room is lit as a
// cave. What is the Tower's own:
// - each floor's room is built from its number (L.towerMap) and put in F.ASSETS.maps and Phaser's tilemap cache just
//   before the floor opens (the page carries no tower map);
// - the enemies: as strong as their floor (L.towerHits, L.towerLoss, L.towerSpeed), all at once or in waves (C.TOWER.wave);
// - the door: Manila's lighthouse (the warp 'tower_door', L.manilaMap); in at the last lift you reached; out by the ladder,
//   or with no energy left, back at the lighthouse;
// - Pearls when a floor's last enemy falls, the first time (L.towerPay), a "+N Pearls" pop; the floor, the enemies left and
//   your Pearls on a chip while you climb, and your Pearls in the bag.
// With friends (up to 4 on a floor): the game server holds a tower floor as it holds a cave's (19zzzzzzzzz-gameserver.js,
// server/lib/tower.js), and 19zzz...z-tower-friends.js is the Tower's side of it (the team's Pearls, the tricks it is
// told of, friends' floors on the lift). No server: the floor is this phone's alone, as before. Each realm's trick
// (F.towerTricks): 19zzz...zz-tower-tricks.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var TW = C.TOWER;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var maps = F.ASSETS && F.ASSETS.maps;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var floorNow = function () { return (F.session && F.session.lairFloor) || 1; };
  var GOLD = 0x7a5a12, BLUE = 0x1e4a6a;
  if (!maps || !maps.lair) return;
  F.FLOORS.tower = TW.floors;

  // ---------- the cave each realm is (19zt-lair.js F.dungeonOf) ----------
  var WORDS = {
    note: /^The stairs up are open/,
    open: function (next) { return 'The stairs up are open! Walk through the door for floor ' + next + '.'; },
    sealed: function (w) {
      var n = towerLeft(w);
      return 'The stairs up are sealed. ' + (n ? n + (n > 1 ? ' enemies are' : ' enemy is') + ' still on this floor.' : 'Beat every enemy on this floor to open them.');
    },
    go: 'Go up',
  };
  var LEAD = { guard: ' guards it!', mini: ' waits here: a mini boss!', boss: ' rules this realm. Beat it!' };
  var cfgs = {};
  var towerCfg = function (floor) {
    var zn = L.towerZone(floor);
    if (cfgs[zn]) return cfgs[zn];
    var z = TW.zones[zn - 1];
    return (cfgs[zn] = {
      key: 'tower', tower: true, door: 'wall', zone: z, floors: TW.floors, liftEvery: TW.liftEvery, from: 'manila', mouth: null, sheet: 'indoor-tower-' + zn,
      look: z.look, lava: z.lava, art: { gate: z.art.gate, cave: z.art.cave }, bg: z.bg, propTint: z.propTint, embers: false,
      lift: 'Tower Lift', icon: 'sparkle', name: 'The Lost Tower', d: {}, words: WORDS,
      line: function (f) {
        var role = L.towerRole(f), lead = role && C.WILD.animals[z[role]];
        return 'The Lost Tower, floor ' + f + (f % TW.zoneSize === 1 ? ': ' + z.name : '') + '. ' + (lead ? lead.name + LEAD[role] : 'Beat every enemy to open the stairs up.');
      },
      // the floor's enemies placed so far (all, or the waves that have come)
      roster: function (f) { var w = F.world, lr = w && w.lair; return L.towerInWave(L.towerRoster(f), (lr && lr.cfg.tower && lr.wave) || 0, TW.wave); },
      reach: function (s, f) { return L.towerReach(s, f); },
      stops: function (s) { return L.towerStops(s); },
    });
  };
  var dungeonOf = F.dungeonOf;
  F.dungeonOf = function (map) { return map === 'tower' ? towerCfg(floorNow()) : dungeonOf(map); };
  var inTower = function (w) { return !!(w && w.lair && w.lair.cfg.tower); };
  // The stairs up are a door in the back wall (L.towerMap): the camera may go 5 tiles above a floor's top (2 elsewhere),
  // so walking up to it the door shows below the top bar, the quest strip and the floor's banner, not under them.
  var updateCamera = P.updateCamera;
  P.updateCamera = function (lerp) {
    if (!inTower(this) || !this.map) return updateCamera.call(this, lerp);
    var cam = this.cameras.main, f = this.feet(), vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    var mw = this.map.widthInPixels, mh = this.map.heightInPixels;
    var cx = mw <= vw ? mw / 2 : Phaser.Math.Clamp(f.x, vw / 2, mw - vw / 2);
    var cy = mh <= vh - 3 * T ? mh / 2 + T : Phaser.Math.Clamp(f.y - T, vh / 2 - 5 * T, mh - vh / 2 + 3 * T);
    var cur = cam.midPoint;
    cam.centerOn(cur.x + (cx - cur.x) * lerp, cur.y + (cy - cur.y) * lerp);
  };
  // enemies of this floor still to beat (on the floor, and the waves still to come; and a splitter's copies, lr.extra:
  // 19zzz...zz-tower-tricks.js)
  var towerLeft = function (w) {
    if (w.lair.gsTl != null && w.wildFollowing() === 'gs') return w.lair.gsTl; // (the game server holds the floor: its count)
    var lr = w.lair, r = lr.roster || (lr.roster = L.towerRoster(lr.floor)), n = 0, k; // (asked every frame: the floor's list made once)
    for (k = 0; k < r.length; k++) if (!lr.down[r[k].slot]) n++;
    for (k in lr.extra || {}) if (!lr.down[k]) n++;
    return n;
  };
  F.towerLeft = towerLeft;
  var real = function (key) { return !!(F.images && F.images[key]); };
  var askTiles = function (floor) { var k = TW.zones[L.towerZone(floor) - 1].art.cave; if (!real(k) && F.needImage && F.packedFile && F.packedFile(k)) F.needImage(k); };

  // ---------- each floor's room, put where the scene reads it ----------
  var built = 0;
  var install = function (scene, floor) {
    if (built !== floor || !maps.tower) {
      maps.tower = L.towerMap(floor, maps.lair);
      built = floor;
    }
    var cache = scene.cache.tilemap;
    if (cache.exists('tower') && cache.get('tower').data === maps.tower) return;
    if (cache.exists('tower')) cache.remove('tower');
    cache.add('tower', { format: Phaser.Tilemaps.Formats.TILED_JSON, data: maps.tower });
  };
  var create = P.create;
  P.create = function () {
    var s = F.session && F.session.state;
    if (s && s.map === 'tower') {
      install(this, floorNow());
      var tex = this.textures; // (the pools of the floor before: their pictures are named by where they lay)
      tex.getTextureKeys().forEach(function (k) { if (/^fx-towerpool/.test(k)) tex.remove(k); });
    }
    create.apply(this, arguments);
    var lr = this.lair;
    if (!inTower(this)) return;
    lr.wave = lr.wave || 0;
    lr.paid = false;
    this.towerMs = 0;
  };
  // in at the door: the last lift you reached (owner: never start over from floor 1)
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    if (to === 'tower' && !this.busy) {
      if (F.session.visit) { if (F.ui) F.ui.toast('The Lost Tower is for your own game.', 2400); return; }
      if (floor == null) floor = L.towerStart(this.state);
      floor = Math.max(1, Math.min(TW.floors, Math.floor(floor) || 1));
      askTiles(floor); // (the realm's tiles, on the way: 19zt-lair.js paints them as the floor opens)
    }
    return travel.call(this, to, spawn, floor);
  };

  // the lighthouse's door comes first, even with the Bow in your hands (as the caves' ladder does)
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mapKey === 'manila') {
      var t = this.facing(), o = this.inMap(t.x, t.y) ? this.objectAt(t.x, t.y) : null;
      if (o && o.name === 'tower_door') return this.objectAction(o, L.held(this.state), null);
    }
    return resolve.apply(this, arguments);
  };

  // ---------- the enemies ----------
  // as strong as their floor (a copy of its kind's numbers, made from the kind each time: the next floor's are its own)
  var strength = P.lairStrength;
  P.lairStrength = function (a) {
    if (!inTower(this)) return strength.apply(this, arguments);
    var f = this.lair.floor, def = C.WILD.animals[a.kind], role = def.role === 'normal' ? null : def.role, sp = L.towerSpeed(f);
    a.hp = a.max = L.towerHits(f, role);
    a.def = Object.assign({}, def, { hp: a.max, hit: L.towerLoss(f, role), walk: def.walk * sp, run: def.run * sp });
    if (a.def.boss) this.wildBar(a);
  };
  // every one of the wave is on the floor (somewhere free, a little away from you if it can)
  P.towerPlace = function (fade) {
    var self = this, w = this.wild, f = this.feet(), here = {};
    if (!w) return 0;
    w.animals.forEach(function (a) { here[a.slot] = true; });
    var n = 0;
    L.wildHere(this.state, 'tower').forEach(function (e) {
      if (here[e.slot]) return;
      var p = self.wildSpot(w.zone, f, 6) || self.wildSpot(w.zone, f, 3) || self.wildSpot(w.zone);
      if (!p) return;
      var a = self.addWildAnimal(e.kind, e.slot, p.x, p.y, 1);
      self.lairStrength(a);
      n++;
      if (!fade) return;
      a.img.setAlpha(0);
      a.sh.setAlpha(0);
      a.fade = 0;
    });
    return n;
  };
  var setupWild = P.setupWild;
  P.setupWild = function () {
    var r = setupWild.apply(this, arguments);
    if (inTower(this) && this.wild && !this.wildFollowing()) this.towerPlace(false); // (a crowded floor: none left out)
    return r;
  };
  // No walking in from the edges: the next wave comes when the last is mostly down (C.TOWER.wave).
  var wildArrive = P.wildArrive;
  P.wildArrive = function (dt) {
    if (!inTower(this)) return wildArrive.apply(this, arguments);
    var lr = this.lair, size = TW.wave;
    if (!(size > 0) || lr.wave + 1 >= L.towerWaves(L.towerRoster(lr.floor).length, size)) return;
    if (!L.towerWaveDue(size, this.wild.animals.length)) return;
    lr.wave++;
    if (this.towerPlace(true) && F.ui) F.ui.toast('Wave ' + (lr.wave + 1) + ' of ' + L.towerWaves(L.towerRoster(lr.floor).length, size) + '!', 1800, BLUE);
  };
  // the stairs open only when every enemy of the floor is down, the waves still to come too
  var openGate = P.openLairGate;
  P.openLairGate = function () {
    if (inTower(this) && towerLeft(this) > 0) return;
    return openGate.apply(this, arguments);
  };
  // each one down: no "hunted!" for each of 60, no kilos (the chip counts them down)
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    if (!inTower(this)) return wildDown.apply(this, arguments);
    var ui = F.ui, own = ui && Object.prototype.hasOwnProperty.call(ui, 'toast'), toast = ui && ui.toast;
    if (ui) ui.toast = function () {};
    this.floatTextAt = function () {};
    try { return wildDown.apply(this, arguments); } finally {
      if (ui) { if (own) ui.toast = toast; else delete ui.toast; }
      delete this.floatTextAt;
    }
  };

  // ---------- a floor cleared: Pearls, the first time ----------
  // others: with a team (the game server's 'cl'), how many of the others on the floor were new to it (L.towerTeamPay: a
  // helper's Pearl); none given: alone.
  P.towerCleared = function (others) {
    var lr = this.lair, s = this.state, r = L.towerRec(s), had = lr.floor <= r.cl, team = others != null, f = this.feet(), self = this;
    var n = team ? L.towerTeamPay(s, lr.floor, others) : L.towerPay(s, lr.floor);
    lr.paid = true;
    if (n > 0) {
      sfx('fanfare');
      this.floatTextAt(f.x, f.y - 1.6 * T, '+' + n + ' Pearl' + (n > 1 ? 's' : ''));
      var line = had ? 'Floor ' + lr.floor + ' cleared together! +1 Pearl for helping (' + r.hn + ' of ' + TW.pearls.helperDay + ' today).'
        : 'Floor ' + lr.floor + ' cleared! +' + n + ' Pearl' + (n > 1 ? 's' : '') + '. You have ' + fmt(s.pearls) + '.';
      this.time.delayedCall(300, function () { if (F.ui && self.lair === lr) F.ui.toast(line, 2600, GOLD); });
    } else if (F.ui) F.ui.toast('Floor ' + lr.floor + ' cleared' + (team && had && others > 0 ? ' together! You have helped ' + TW.pearls.helperDay + ' times today: no more helper Pearls until tomorrow.' : '!'), team && had && others > 0 ? 3200 : 1600, BLUE);
    this.changed();
    this.save();
    return n;
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    var lr = this.lair;
    if ((this.towerMs = (this.towerMs || 0) - delta) <= 0) { this.towerMs = 400; this.towerChip(); }
    if (!inTower(this) || !this.wild || this.busy || !this.sys.isActive() || lr.paid || !lr.seen || this.wildFollowing()) return;
    if (towerLeft(this) === 0) this.towerCleared();
  };

  // ---------- out of energy: out at the lighthouse (next time, from the last lift you reached) ----------
  var faint = P.faint;
  P.faint = function () {
    if (!inTower(this)) return faint.apply(this, arguments);
    if (F.ui) F.ui.toast('Out of energy! You climb down and out of the Lost Tower. Eat, rest, and climb again from the last lift you reached.', 4200);
    this.travel('manila', 'from_tower');
  };

  // ---------- the chip: the floor, the enemies left, your Pearls ----------
  P.towerChip = function () {
    var ui = F.ui;
    if (!ui || !ui.add || !ui.sys || !ui.sys.isActive()) return;
    var on = inTower(this) && !this.busy;
    // (owner, 12 Nov 2026: "needs a better location", then: lighter, and in the task bar's place) a light pill in the task
    // bar's row ("Clear 3 weeds..."): behind it while the bar is open, beside its small pill once it shrinks (19zzzzc-goal-pill.js)
    if (!ui.towerChipBox) {
      if (!on) return;
      ui.towerBg = ui.add.graphics();
      ui.towerText = ui.add.text(0, 0, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#6b4a2e' }).setOrigin(0.5, 0.5);
      ui.towerChipBox = ui.add.container(C.WIDTH / 2, CHIP.y, [ui.towerBg, ui.towerText]).setDepth(45);
      ui.towerChipW = 0;
      ui.events.once('shutdown', function () { ui.towerChipBox = null; });
    }
    var full = !!(ui.goalPill && ui.goalPill.visible && !ui.goalSmall); // the task bar open in full: the pill waits behind it
    ui.towerChipBox.setVisible(on && !full);
    if (!on) return;
    var left = towerLeft(this), s = this.state;
    ui.towerText.setText('Floor ' + this.lair.floor + '  ·  ' + (left ? left + ' left' : 'Clear!') + '  ·  ' + fmt(s.pearls || 0) + ' Pearls');
    var w = Math.ceil(ui.towerText.width + 24);
    if (w !== ui.towerChipW) {
      ui.towerChipW = w;
      ui.towerBg.clear().fillStyle(0xfffaf0, 0.78).fillRoundedRect(-w / 2, -CHIP.h / 2, w, CHIP.h, CHIP.h / 2)
        .lineStyle(1.5, 0xc8a27c, 0.9).strokeRoundedRect(-w / 2, -CHIP.h / 2, w, CHIP.h, CHIP.h / 2);
    }
    // in the middle, or right of the task bar's small pill when the two would touch
    var pt = ui.goalPillText, pill = ui.goalPill && ui.goalPill.visible && ui.goalSmall && pt ? (pt.text ? pt.x + pt.width + 10 : pt.x) : 0; // (its right edge: 19zzzzc-goal-pill.js)
    ui.towerChipBox.setPosition(Math.max(C.WIDTH / 2, pill + 8 + w / 2), CHIP.y);
  };
  var CHIP = { y: 83, h: 24 }; // (the task bar's row: its small pill is 68 to 98)
  // the task bar opening or shrinking: the pill follows at once (not on its next 400 ms)
  var goalShape = U.goalShape;
  if (goalShape) U.goalShape = function () { var r = goalShape.apply(this, arguments); if (F.world && F.world.lair && F.world.towerChip) F.world.towerChip(); return r; };

  // ---------- your Pearls in the bag (with the Lumber and the Stone) ----------
  var openInventory = U.openInventory;
  U.openInventory = function () {
    var r = openInventory.apply(this, arguments), s = F.session && F.session.state, refresh = this.invRefresh, m = this.modals[this.modals.length - 1];
    if (!s || !m || typeof refresh !== 'function' || !((s.pearls || 0) > 0 || (s.tower && s.tower.deep))) return r;
    var line = null;
    (function find(list) { list.forEach(function (o) { if (!line && o.type === 'Text' && /^Lumber /.test(o.text)) line = o; if (o.list) find(o.list); }); })(m.c.list);
    if (!line) return r;
    this.invRefresh = function () {
      refresh.apply(this, arguments);
      if (line.active) line.setText(line.text + '     Pearls ' + fmt(s.pearls || 0));
    };
    this.invRefresh();
    return r;
  };

  // ---------- the tower's own pictures (the 'tower' pack: tools/tower/tower-art.js, tools/tower/tower-import.js) ----------
  // What is not in yet is asked for as each floor opens: the realm's tiles and props, and each creature's sheet and shadow
  // (the stairs: the caves' own code, 19zt-lair.js askArt). A creature's sheet that comes while it is on the floor takes over
  // where it stands (its picture, its shadow, its size: C.TOWER.artPx, its own frames' width); the realm's props when they
  // come (each in place of a stand-in prop, on its tile); its tiles from its next floor.
  if (F.PACK_INFO && F.packFiles && F.packFiles('tower').length) {
    F.PACK_INFO.tower = { name: 'The Lost Tower', icon: 'sparkle', desc: "The Lost Tower's creatures and its realms' looks." };
    var soft = F.softPacks;
    F.softPacks = function (map) { var out = soft ? soft(map) : []; return map === 'tower' && out.indexOf('tower') < 0 ? out.concat(['tower']) : out; };
  }
  var ask = function (key) { if (key && !real(key) && F.needImage && F.packedFile && F.packedFile(key)) F.needImage(key); };
  // an enemy in its own picture once its sheet is in (until then its stand-in row, tinted), at the size its picture needs
  var dress = function (w, a) {
    var def = a.def;
    if (!def || !def.tower || !a.img || !a.img.active) return;
    var own = real(def.sheet), key = own ? def.sheet : 'wild', shade = own && real(def.sheet + 'shade') ? def.sheet + 'shade' : 'wildshade';
    if (a.img.texture.key !== key) {
      a.img.setTexture(F.ensureTexture(w, key));
      if (own) a.img.clearTint(); else if (def.tint) a.img.setTint(def.tint);
    }
    if (a.sh && a.sh.texture.key !== shade) a.sh.setTexture(F.ensureTexture(w, shade));
    var px = own && TW.artPx && TW.artPx[a.kind];
    if (px && !a.dressed) { a.dressed = true; a.scale = def.w * T / px * a.size; a.img.setScale(a.scale); }
  };
  var addWildAnimal = P.addWildAnimal;
  P.addWildAnimal = function (kind) {
    var def = C.WILD.animals[kind];
    if (def && def.tower && def.sheet) { ask(def.sheet); ask(def.sheet + 'shade'); }
    var a = addWildAnimal.apply(this, arguments);
    if (a && def && def.tower) dress(this, a);
    return a;
  };
  var wildShow = P.wildShow;
  P.wildShow = function (a) {
    var def = a.def;
    if (def && def.tower && real(def.sheet) && (!a.dressed || (a.sh && a.sh.texture.key === 'wildshade' && real(def.sheet + 'shade')))) dress(this, a); // (it came while out)
    return wildShow.apply(this, arguments);
  };
  // the realm's props: a stand-in prop (z.props) shows one of the realm's six, picked by where it stands, on the same tile
  // with the same solid foot (so the room is the one every phone and the game server build), without the caves' lava light
  var dressProp = function (w, img, o) {
    F.ensureTexture(w, o.key);
    var wd = Math.max(1.3 * T, Math.min(o.width, 2.1 * T));
    img.setTexture(o.key).setOrigin(0.5, 1).setPosition(o.x + o.width / 2, o.y).clearTint();
    img.setDisplaySize(wd, wd * img.height / img.width);
    img.towerProp = true;
  };
  var addProp = P.addProp;
  P.addProp = function (name, o) {
    var r = addProp.apply(this, arguments), s = F.session && F.session.state;
    if (!s || s.map !== 'tower' || this.mapKey !== 'tower') return r;
    var z = TW.zones[L.towerZone(floorNow()) - 1], img = this.props[this.props.length - 1];
    if (!z || !img || img.texture.key !== 'props/' + name || z.props.indexOf(name) < 0) return r;
    var list = z.art.props, key = list[Math.abs(Math.round(o.x / T) * 7 + Math.round(o.y / T) * 3) % list.length];
    img.towerSpot = { x: o.x, y: o.y, width: o.width, key: key };
    if (real(key)) dressProp(this, img, img.towerSpot);
    else ask(key);
    return r;
  };
  F.bus.on('packart', function (key) {
    var w = F.world;
    if (!w || !w.sys || !w.sys.isActive() || !inTower(w) || !real(key)) return;
    (w.props || []).forEach(function (img) { var o = img.towerSpot; if (o && o.key === key && img.active && !img.towerProp) dressProp(w, img, o); });
  });
  // the realm's tiles: its cave sheet is painted once a session (19zt-lair.js lairSheet); painted before its tiles came, it
  // is painted again on the next floor
  var painted = {};
  var create2 = P.create;
  P.create = function () {
    var s = F.session && F.session.state, cfg = s && s.map === 'tower' ? towerCfg(floorNow()) : null;
    if (cfg && painted[cfg.sheet] === false && real(cfg.art.cave) && this.textures.exists(cfg.sheet)) { this.textures.remove(cfg.sheet); delete painted[cfg.sheet]; }
    create2.apply(this, arguments);
    // in Manila, the realm you would go into is fetched ahead (its tiles, its door up, its props), so its first floor is
    // already in its own look (owner's walkthrough, 12 Nov 2026: the first visit's floor 1 was in the stand-in tiles)
    if (this.mapKey === 'manila' && s && !F.session.visit) {
      var z = TW.zones[L.towerZone(L.towerStart(s)) - 1];
      if (z) [z.art.cave, z.art.gate].concat(z.art.props || []).forEach(ask);
    }
    if (!inTower(this)) return;
    var c = this.lair.cfg;
    if (this.textures.exists(c.sheet) && painted[c.sheet] == null) painted[c.sheet] = real(c.art.cave);
    ask(c.art.cave);
    (this.props || []).forEach(function (img) { if (img.towerProp) img.clearTint(); }); // (the caves tint every prop)
    // the realm's own water does not glow like the Lair's lava (the warm light over each pool, 19zt-lair.js setupLava)
    var D = F.WorldScene.DEPTH.Walls + 0.1;
    if (real(c.art.cave)) this.children.list.forEach(function (o) { if (o.type === 'Image' && o.depth === D && o.texture && o.texture.key === 'fx-lairglow') o.setVisible(false); });
  };

  // ---------- for the tests: every enemy of this floor beaten at once (yours) ----------
  F.towerClearFloor = function () {
    var w = F.world, lr = w && w.lair;
    if (!inTower(w)) return false;
    w.wild.animals.slice().forEach(function (a) { a.hp = 0; a.hits = 1; a.mine = true; w.wildDown(a); });
    L.towerRoster(lr.floor).forEach(function (e) { lr.down[e.slot] = true; }); // (and the waves still to come)
    return true;
  };
})(window.Farm = window.Farm || {});
