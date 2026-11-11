// Farm Raids on the real farm (owner, 9 Nov 2026: "use the real farm design, let the player design it so it will be
// more meaning full"). A raid opens a farm like a visit: its own fields, fences, pen, house and the defenses its farmer
// placed with Decorate. The farm's walls are its map's (trees, buildings, water); fences, scarecrows, the dog and the new
// defenses fight; the loot is where it is: ripe crops in the field, eggs and milk at the pen, the stall's goods and the
// Gold pot at the house. Practice: the bandit farms (a layout made here) and "Test my farm" (a copy of your own).
// Rules: 01-logicZZZZZZZZZZZ-raids.js; the panel and the HUD's look: 19zzzzzzzzzzzzzzzzz-farm-raids.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;
  var O = C.OUTDOOR;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, RED = 0xc0503a;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var raiding = function (w) { return !!(w && F.session.raid && F.session.visit && F.session.visit.raid && w.mapKey === 'farm'); };

  // ---------- a bandit farm: a state on the real farm map (crops, animals, fences, defenses) ----------
  // Its pieces sit where a farmer would put them: fences round the field and the pen, defenses near what they guard.
  L.banditState = function (b, mine) {
    var s = L.visitState({ v: 1, day: mine.day, look: 'boy', home: { level: 3 }, soil: [], yard: [], animals: [], pets: { dog: b.defs.dog ? 'Bantay' : '' } }, mine);
    s.isVisit = true;
    s.banditKey = b.key;
    // (a bandit's own fences only: the new-farm template's 60-piece field fence walled every bandit farm alike, so its own
    // fences hardly fitted; once raiders could no longer land in the field, 10 Nov 2026, that wall decided every battle)
    var ff = O.index.field_fence;
    s.yard.items = s.yard.items.filter(function (it) { return it.t !== ff; });
    return s;
  };

  // ---------- the battle's farm, from the world on screen ----------
  // opts (a farm's own raid copy, 19zzzzzzzzzzzzzzzzzzz-farm-raids-real.js): { gold, stall, produce, levels, name }
  P.raidFarm = function (opts) {
    var self = this, s = this.state, w = this.map.width, h = this.map.height, b = opts || F.session.raid, defs = [], loot = [], skip = {};
    var lv = function (k) { return b.levels ? b.levels[k] || 1 : 1; };
    // defenses from the yard: fences (all kinds), the new pieces, scarecrows
    s.yard.items.forEach(function (it) {
      var type = O.types[it.t];
      if (!type) return;
      var k = type.kind === 'fence' ? 'fence' : type.defense || C.FRAID_YARD_DEF[type.key];
      if (!k) return;
      var fy = it.y + Math.max(0, type.h - Math.max(1, type.foot || 1));
      defs.push({ t: k, x: it.x, y: fy, lv: lv(k), strong: !!type.strong });
      skip[fy * w + it.x] = 1; // (its tile is the defense, not a wall)
    });
    var zone = function (kind) { return (this.zones && this.zones[kind] || [])[0]; }.bind(this);
    var dogYard = zone('dogarea'), pen = zone('pen'), door = (this.objects || []).filter(function (o) { return o.name === 'house_door'; })[0];
    var hasDog = s.banditDefs ? !!s.banditDefs.dog : !!s.dog; // (a bandit farm: only its own list's dog)
    if (hasDog && dogYard) defs.push({ t: 'dog', x: Math.floor((dogYard.x0 + dogYard.x1) / 2), y: Math.floor((dogYard.y0 + dogYard.y1) / 2), lv: lv('dog') });
    // the loot: each ripe crop where it grows; eggs and milk at the pen; the stall's goods and the Gold pot at the door
    Object.keys(s.soil).forEach(function (idx) {
      var t = s.soil[idx], st = t.c ? L.cropStage(t) : -1, i = Number(idx);
      if (st === 3) return loot.push({ kind: 'crops', x: i % w, y: Math.floor(i / w), n: 1 });
      // a farm's own raid copy (opts): a crop still growing (watered) is there too, with when it ripens (the server's clock,
      // ms): a farm whose crops ripen while its farmer is away can be raided then (L.frRealFarm takes only the ripe ones)
      if (opts && st >= 0 && st < 3 && !L.needsWater(t)) loot.push({ kind: 'crops', x: i % w, y: Math.floor(i / w), n: 1, at: (t.p + L.growMins(t)) * 60000 });
    });
    var grown = opts ? opts.produce || 0 : s.animals.filter(function (a) { return !a.young; }).length * 2; // (a real farm: its eggs and milk waiting)
    if (pen && grown) loot.push({ kind: 'produce', x: Math.floor((pen.x0 + pen.x1) / 2), y: Math.floor((pen.y0 + pen.y1) / 2), n: grown });
    if (door) {
      var dx = door.x0, dy = door.y1 + 1;
      loot.push({ kind: 'gold', x: dx, y: dy, n: b.gold || 0 });
      if (b.stall) loot.push({ kind: 'stall', x: dx + 2, y: dy, n: b.stall });
    }
    loot = loot.filter(function (p) { return p.n > 0; });
    // the walls: what you cannot walk on, but the defenses' tiles
    var solid = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) solid.push(!skip[y * w + x] && (!this.inMap(x, y) || !this.walkable(x, y) || this.blocked[this.idx(x, y)]) ? '1' : '0');
    // only as many of each defense as the farm's Raid Camp allows (a bandit farm: its own list)
    if (!s.banditDefs) defs = L.frCapDefs(defs, opts && opts.camp != null ? opts.camp : L.frState(F.session.state).camp);
    // where raiders never come down (owner, 10 Nov 2026: "Attacker can put raider in the middle of the farm, my defense
    // cant put in the middle"): the field and a tile round it, the pen; and 3 tiles from any crop, defense or loot
    var nd = new Uint8Array(w * h);
    var mark = function (x, y) { if (x >= 0 && y >= 0 && x < w && y < h) nd[y * w + x] = 1; };
    // (the field is its plots, where they stand: Edit Farm, 10 Nov 2026; until then the map's field mask, F.farm().field,
    // whose values were read as tile numbers till 10 Nov 2026, so the field was never kept clear)
    // The ranch too, and a tile round it, wherever it stands (owner, 11 Nov 2026: "Keep raiders off the ranch and one tile
    // around it"): nothing can stand inside it to guard the pen, and its gate, in the front fence, opens onto the bottom path.
    s.yard.items.forEach(function (it) {
      var type = O.types[it.t];
      if (!type || !(type.fieldPlot || type.building === 'ranch')) return;
      L.yardBox(it.t, it.x, it.y).forEach(function (p) { for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) mark(p[0] + dx, p[1] + dy); });
    });
    ((this.zones && this.zones.pen) || []).forEach(function (z) { for (var y = z.y0; y <= z.y1; y++) for (var x = z.x0; x <= z.x1; x++) mark(x, y); });
    var farm = { w: w, h: h, solid: solid.join(''), defs: defs, loot: loot, name: (opts && opts.name) || (F.session.visit && F.session.visit.name) || '', keep: R.battle.keepReal,
      noDrop: Array.prototype.map.call(nd, function (v) { return v ? '1' : '0'; }).join('') };
    farm.drop = L.frDropCells(farm);
    delete farm.noDrop; // (the drop cells carry it; the copy stays small)
    void self;
    return farm;
  };

  // ---------- into a raid ----------
  // opts: { kind: 'bandit', key } | { kind: 'test' }
  F.raidFarmStart = function (opts) {
    var mine = F.session.state, army = L.frArmy(mine), seed = (opts && opts.seed | 0) || (Date.now() & 0x7fffffff) || 1, st, name, extra = {};
    if (!Object.keys(army).length) { sfx('nope'); return F.ui.toast('Train some raiders first (Party).', 2400); }
    if (opts.kind === 'test') {
      st = L.visitState(L.snapshot(mine), mine);
      st.isVisit = true;
      name = 'Your farm (a test)';
      extra = { gold: 1000, stall: 20, levels: L.frState(mine).dlv };
    } else {
      var b = R.bandits.filter(function (x) { return x.key === opts.key; })[0];
      st = L.banditLayout(b, mine, seed);
      name = b.name;
      extra = { gold: b.loot.gold, stall: b.loot.stall, levels: null, lv: b.lv };
    }
    F.session.raid = { kind: opts.kind, key: opts.key || null, army: army, seed: seed, gold: extra.gold, stall: extra.stall, levels: extra.levels || (extra.lv ? R.defenseOrder.reduce(function (o, k) { o[k] = extra.lv; return o; }, {}) : null) };
    F.session.visit = { host: 'raid', name: name, state: st, raid: true, liked: false, gift: null, friend: false, likes: 0, beauty: 0 };
    F.session.riding = false;
    F.ui.closeAll();
    F.Online.restartWorld();
  };
  F.raidFarmLeave = function () {
    var back = F.session.raid && F.session.raid.kind;
    F.session.raid = null;
    if (F.ui && F.ui.raidHudOff) F.ui.raidHudOff();
    F.Online.leaveVisit(null);
    if (back && back !== 'replay' && F.ui) F.ui.time.delayedCall(900, function () { if (F.ui.openRaidCamp) F.ui.openRaidCamp('practice'); });
  };

  // ---------- the world in a raid ----------
  var create = P.create;
  P.create = function () {
    // (a restarted scene is the same object: last raid's battle must not carry over)
    this.raidB = null; this.raidDone = false; this.raidStarted = false; this.raidUnits = {}; this.raidDefs = []; this.raidDown = null; this.raidShotAt = null;
    create.call(this);
    if (!raiding(this)) return;
    var self = this;
    // a bandit farm: its pieces go on this map first (they need the map), then the farm opens again with them
    if (this.state.banditDefs && !this.state.banditBuilt) { this.raidBanditPieces(); this.time.delayedCall(30, function () { self.scene.restart(); }); return; }
    this.time.delayedCall(50, function () { self.raidSetup(); });
  };
  P.raidSetup = function () {
    this.scene.bringToTop('UI'); // (a restart from inside a restart can leave the farm over the buttons)
    var self = this, rd = F.session.raid, cam = this.cameras.main;
    // a made-up farm (SQL part 28): its copy is the farm laid out here, as a player's own phone makes theirs; the battle then
    // runs on it exactly as on a real one (the game server checks it against the server's numbers)
    if (rd.kind === 'ghost' && !rd.copy) {
      rd.copy = this.raidFarm({ gold: rd.gold, stall: rd.stall, produce: rd.produce, levels: rd.levels, name: F.session.visit.name });
      rd.copy.value = L.frCopyValue(rd.copy);
    }
    // (a real raid or its replay: the defender's frozen copy, only its share of the loot: 01-logicZZZZZZZZZZZZ-raids2.js)
    this.raidB = L.frStart(rd.copy ? L.frRealFarm(rd.copy, rd.cap, rd.seed, rd.cut) : this.raidFarm(), rd.army, rd.seed);
    this.raidAcc = 0;
    this.raidStarted = false;
    this.raidUnits = {};
    this.raidDefs = [];
    // the farmer steps out of it; the camera is yours to move (drag), a little further out
    if (this.player) { this.player.setVisible(false); if (this.player.body) this.player.body.enable = false; }
    if (this.dog && this.dog.sprite) { this.dog.sprite.setVisible(false); if (this.dog.sh) this.dog.sh.setVisible(false); }
    cam.stopFollow();
    cam.setZoom(cam.zoom * 0.62);
    var door = (this.objects || []).filter(function (o) { return o.name === 'house_door'; })[0];
    if (door) cam.centerOn((door.x0 + 0.5) * T, (door.y1 - 2) * T);
    // where raiders may come down: a soft light over the open ground
    var b = this.raidB, f = b.farm, g = this.add.graphics().setDepth(F.WorldScene.DEPTH.flat + 0.05);
    g.fillStyle(0xfff3c4, 0.16);
    for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) if (f.drop.charCodeAt(y * f.w + x) === 49) g.fillRect(x * T, y * T, T, T);
    this.raidDropShade = g;
    // the dog and the goose move in a raid: drawn here; the rest are the yard's own pictures
    b.defs.forEach(function (dd, i) {
      var img = null;
      if (dd.t === 'dog') { img = F.Anim.image(self, dd.x * T, dd.y * T, C.DOG); }
      self.raidDefs[i] = img;
    });
    // taps: drag to look around, a tap on the green ground sends the picked raider in
    if (this.raidInputs) this.raidInputs.forEach(function (e) { self.input.off(e[0], e[1]); });
    this.raidInputs = [];
    var on = function (ev, fn) { self.input.on(ev, fn); self.raidInputs.push([ev, fn]); };
    // like the raid games (owner, 10 Nov 2026: "why I cant move the screen, I cant see the other side of the farm": the
    // green ground covers most of a farm, and a press there sent raiders in): drag anywhere looks around; a tap on the
    // green ground sends one raider; press and HOLD there, and they keep coming, along your finger if you slide it
    var tileOf = function (p) { var wp = cam.getWorldPoint(p.x, p.y); return { x: Math.floor(wp.x / T), y: Math.floor(wp.y / T) }; };
    var HOLD = 260, SLOP = 12; // (ms still before the stream starts; px a finger may wobble and still be a tap)
    on('pointerdown', function (p) {
      if (!self.raidB || self.raidB.end || (F.ui && F.ui.raidOnHud && F.ui.raidOnHud(p))) { self.raidDown = null; return; }
      var tl = tileOf(p);
      self.raidDown = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false, edge: L.frEdge(self.raidB, tl.x, tl.y), last: tl, at: Date.now(), t0: Date.now() };
    });
    on('pointermove', function (p) {
      var d = self.raidDown;
      if (!self.raidB || !p.isDown || !d) return;
      if (d.deploy) { // (holding: raiders come where the finger goes)
        var tl = tileOf(p);
        if ((tl.x !== d.last.x || tl.y !== d.last.y) && L.frEdge(self.raidB, tl.x, tl.y)) { d.last = tl; d.at = Date.now(); self.raidDropAt(tl.x, tl.y, true); }
        return;
      }
      var dx = (p.x - d.x) / cam.zoom, dy = (p.y - d.y) / cam.zoom;
      if (!d.moved && Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > SLOP) d.moved = true;
      if (d.moved) cam.setScroll(d.sx - dx, d.sy - dy);
    });
    on('pointerup', function (p) {
      var d = self.raidDown;
      self.raidDown = null;
      if (!d || d.deploy || d.moved || !self.raidB || self.raidB.end || (F.ui && F.ui.raidOnHud && F.ui.raidOnHud(p))) return;
      var tl = tileOf(p);
      self.raidDropAt(tl.x, tl.y); // a tap: one raider (where they cannot come down: it says where they can)
    });
    // (each frame: a press held still on the green ground turns into the stream; P.update keeps it coming)
    this.raidHoldCheck = function () {
      var d = self.raidDown;
      if (!d || d.deploy || d.moved || !d.edge || Date.now() - d.t0 < HOLD) return;
      d.deploy = true; d.at = Date.now();
      self.raidDropAt(d.last.x, d.last.y);
    };
    if (F.ui && F.ui.raidHudOn) F.ui.raidHudOn(this.raidB, F.session.visit.name);
  };
  P.raidDropAt = function (x, y, quiet) {
    var b = this.raidB, k = F.ui.raidSel;
    if (!k || !b.left[k] || b.left[k].n <= 0) {
      // (that one is all in: the next one that has any left)
      k = Object.keys(b.left).filter(function (x2) { return b.left[x2].n > 0; })[0];
      if (!k) return quiet ? null : F.ui.raidSay('Everyone is in!');
      F.ui.raidSel = k;
    }
    if (!L.frEdge(b, x, y)) return quiet ? null : F.ui.raidSay('Send raiders in on the green ground.');
    if (!L.frDrop(b, k, x, y)) return;
    this.raidStarted = true;
    sfx('pick');
    F.ui.raidHudRefresh();
  };
  // the raiders' pictures (as the hunting animals'; the crows their own)
  var STAND = { goat: 'kambing', crow: 'labuyo', cat: 'musang', carabao: 'carabaoligaw', monkey: 'unggoy', boar: 'boar', rooster: 'labuyo', bayawak: 'bayawak' };
  var frameOf = function (scene, k, f) {
    if (k === 'crow' && F.images.raid_crow) return { key: F.ensureTexture(scene, 'raid_crow'), frame: f, w: 0.8, px: 178 };
    if (k === 'cat' && F.images.raid_cat) return { key: F.ensureTexture(scene, 'raid_cat'), frame: f, w: 0.85, px: 178 }; // (the owner's masked cat, 9 Nov 2026)
    var WI = C.WILD, kind = STAND[k], def = WI.animals[kind] || WI.animals.rabbit;
    if (def.sheet && F.images[def.sheet]) return { key: F.ensureTexture(scene, def.sheet), frame: (def.row || 0) * 12 + f, w: def.w, px: def.px };
    var row = WI.order.indexOf(def.sheetRow || kind);
    if (row >= 0 && F.images.wild) return { key: F.ensureTexture(scene, 'wild'), frame: row * 12 + f, w: def.w, px: def.px };
    if (def.sheet && F.needImage) F.needImage(def.sheet);
    if (F.needImage) F.needImage('wild');
    return { key: 'items', frame: L.raiderIcon(k), w: 0.9, px: 128 * 0.9, icon: true };
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.raidB || !raiding(this)) return;
    var b = this.raidB, hold = this.raidDown;
    if (this.raidHoldCheck) this.raidHoldCheck();
    if (hold && hold.deploy && !b.end && Date.now() - hold.at > 220) { hold.at = Date.now(); this.raidDropAt(hold.last.x, hold.last.y, true); }
    if (this.raidStarted && !b.end) {
      this.raidAcc += Math.min(delta, 250);
      while (this.raidAcc >= R.battle.tick && !b.end) { this.raidAcc -= R.battle.tick; var ev = b.events.length; if (this.raidReplayDrops) this.raidReplayDrops(); L.frStep(b); this.raidEvents(ev); }
      F.ui.raidHudRefresh();
      if (b.end) this.raidFinish();
    }
    this.raidDraw(time);
  };
  P.raidDraw = function (time) {
    var self = this, b = this.raidB;
    b.raiders.forEach(function (r) {
      var u = self.raidUnits[r.id];
      if (!u) {
        var fr = frameOf(self, r.k, 6);
        u = self.raidUnits[r.id] = { img: self.add.image(r.x * T, r.y * T, fr.key, fr.frame).setOrigin(0.5, 0.92).setScale(fr.w * T / fr.px), lx: r.x };
        if (r.k === 'crow' && !F.images.raid_crow) u.img.setTint(0x3a3a4a);
        u.bar = self.add.rectangle(r.x * T, r.y * T, 0.7 * T, 0.09 * T, 0x7fd05a).setOrigin(0, 0.5).setDepth(F.WorldScene.DEPTH.fx);
      }
      if (r.hp <= 0) { if (!u.gone) { u.gone = true; self.tweens.add({ targets: [u.img, u.bar], alpha: 0, duration: 400 }); } return; }
      var moving = Math.abs(r.x - u.lx) > 0.0005 || Math.abs(r.y - u.ly) > 0.0005, left = r.x < u.lx;
      var f = frameOf(self, r.k, moving ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 6);
      if (f.key !== u.img.texture.key) u.img.setTexture(f.key, f.frame).setScale(f.w * T / f.px);
      u.img.setFrame(f.frame).setFlipX(moving && !f.icon ? !left && Math.abs(r.x - u.lx) > 0.0005 : u.img.flipX).setPosition(r.x * T, r.y * T).setDepth(F.WorldScene.DEPTH.actor + r.y * T / 1e5).setAlpha(r.stuck > 0 ? 0.7 : 1);
      u.bar.setPosition(r.x * T - 0.35 * T, r.y * T - 1.1 * T).setSize(0.7 * T * Math.max(0, r.hp / r.max), 0.09 * T).setVisible(r.hp < r.max);
      u.lx = r.x; u.ly = r.y;
    });
    b.defs.forEach(function (dd, i) {
      var img = self.raidDefs[i];
      if (!img) return;
      var mv = Math.abs(dd.x * T - img.x) > 1;
      if (dd.hp > 0) img.setFrame(C.DOG.frame0 + (mv ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 9)).setFlipX(mv ? dd.x * T > img.x : img.flipX);
      img.setPosition(dd.x * T, dd.y * T).setDepth(F.WorldScene.DEPTH.actor + dd.y * T / 1e5).setAlpha(dd.hp > 0 ? 1 : 0.3);
    });
    this.raidShots(time);
  };
  // ---------- the battle's effects (the owner's raid_fx: prompt #7) ----------
  // a defense at work: the watchtower's pebble flies, the sprinkler sprays, the bees swarm, the goose honks
  var SHOT = { tower: { fx: 'pebble', every: 700 }, sprinkler: { fx: 'water', every: 500 }, beebox: { fx: 'bees', every: 900 }, goose: { fx: 'honk', every: 800 } };
  P.raidFx = function (k, x, y, scale) {
    if (!F.images.raid_fx) return null;
    F.ensureTexture(this, 'raid_fx');
    return this.add.image(x, y, 'raid_fx', F.raidFx(k)).setScale((scale || 0.8) * T / 128).setDepth(F.WorldScene.DEPTH.fx);
  };
  P.raidShots = function (time) {
    var self = this, b = this.raidB, last = this.raidShotAt || (this.raidShotAt = {});
    if (!F.images.raid_fx || !this.raidStarted || b.end) return;
    b.defs.forEach(function (d) {
      var sh = SHOT[d.t], tg = d.aim != null && b.raiders.filter(function (r) { return r.id === d.aim; })[0];
      if (!sh || d.hp <= 0 || !tg || tg.hp <= 0 || time - (last[d.id] || 0) < sh.every) return;
      last[d.id] = time;
      var x0 = d.x * T, y0 = d.y * T - 0.6 * T, x1 = tg.x * T, y1 = tg.y * T - 0.5 * T, ang = Math.atan2(y1 - y0, x1 - x0), im;
      if (sh.fx === 'pebble') { // from the top of the tower
        im = self.raidFx('pebble', x0, y0 - 1.2 * T, 0.45).setRotation(ang);
        self.tweens.add({ targets: im, x: x1, y: y1, duration: 260, onComplete: function () { im.destroy(); } });
      } else if (sh.fx === 'bees') { // a swarm over the raider, buzzing
        im = self.raidFx('bees', x1, y1 - 0.4 * T, 0.75);
        self.tweens.add({ targets: im, x: x1 + 0.15 * T, yoyo: true, repeat: 1, duration: 140 });
        self.tweens.add({ targets: im, alpha: 0, delay: 500, duration: 300, onComplete: function () { im.destroy(); } });
      } else { // the spray and the honk: from the defense toward the raider (both drawn facing right)
        var far = Math.min(Math.hypot(x1 - x0, y1 - y0), 2.2 * T);
        im = self.raidFx(sh.fx, x0 + Math.cos(ang) * far * 0.5, y0 + Math.sin(ang) * far * 0.5, sh.fx === 'water' ? 1.1 : 0.7).setRotation(ang).setAlpha(0.95);
        if (Math.abs(ang) > Math.PI / 2) im.setFlipY(true); // (never upside down)
        self.tweens.add({ targets: im, alpha: 0, scale: im.scale * 1.15, duration: 420, onComplete: function () { im.destroy(); } });
      }
    });
  };
  // a splash, a puff: where something happened
  P.raidBurst = function (k, x, y, scale) {
    var im = this.raidFx(k, x, y, scale);
    if (!im) return;
    var s0 = im.scale;
    im.setScale(s0 * 0.5);
    this.tweens.add({ targets: im, scale: s0, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: im, alpha: 0, delay: 450, duration: 350, onComplete: function () { im.destroy(); } });
  };
  P.raidEvents = function (from) {
    var self = this, b = this.raidB;
    b.events.slice(from).forEach(function (e) {
      var who = e[2], at = b.raiders.filter(function (x) { return x.id === who; })[0] || b.defs.filter(function (x) { return x.id === who; })[0];
      var word = { scared: 'Eek!', stuck: 'Stuck!', gone: 'Out!', down: 'Down!', alarm: 'DONG!' }[e[1]];
      if (at && word) self.floatTextAt(at.x * T, at.y * T - 1.2 * T, word);
      if (at && e[1] === 'stuck') self.raidBurst('mud', at.x * T, at.y * T - 0.2 * T, 0.9);
      if (at && (e[1] === 'gone' || e[1] === 'down')) self.raidBurst('puff', at.x * T, at.y * T - 0.4 * T, 0.9);
      if (e[1] === 'alarm') sfx('found');
    });
  };
  P.raidFinish = function () {
    if (this.raidDone) return;
    this.raidDone = true;
    var s = F.session.state, b = this.raidB, rd = F.session.raid, used = {};
    b.moves.forEach(function (m) { used[m[1]] = (used[m[1]] || 0) + 1; });
    L.frUse(s, used);
    var prize = rd.kind === 'bandit' ? L.banditPrize(s, rd.key, b) : { gold: 0, pts: 0, stars: L.frStars(b), test: true };
    F.Host.save(s);
    sfx(prize.stars ? 'fanfare' : 'nope');
    F.ui.raidResult(b, prize);
  };
  // in a raid the camera is yours (owner, 10 Nov 2026: "why I cannot control the screen when I attacking?"): it no longer
  // follows the (hidden) farmer, which pulled every drag back
  var updateCamera = P.updateCamera;
  P.updateCamera = function (lerp) { if (this.raidB && raiding(this)) return; return updateCamera.call(this, lerp); };
  // in a raid nothing on the farm is yours to use
  var resolve = P.resolve;
  P.resolve = function () { if (raiding(this)) return null; return resolve.call(this); };

  // ---------- a bandit farm's layout on the real farm map ----------
  // A field of ripe crops in the farm's field, animals in the pen, fences round them, its defenses near what they guard.
  L.banditLayout = function (b, mine, seed) {
    var s = L.banditState(b, mine), rnd = L.frRand(seed);
    s.banditDefs = b.defs;
    s.banditSeed = seed;
    s.banditLoot = b.loot;
    void rnd;
    return s;
  };
  // the world builds the bandit's pieces on its map once it knows the map (fields, the pen)
  var setupYard = P.raidBanditPieces = function () {
    var self = this, s = this.state, w = this.map.width;
    if (!s.banditDefs || s.banditBuilt) return;
    s.banditBuilt = true;
    var rnd = L.frRand(s.banditSeed), pen = ((this.zones && this.zones.pen) || [])[0];
    var free = function (x, y) { return self.inMap(x, y) && self.walkable(x, y) && !self.blocked[self.idx(x, y)]; };
    // the field: its plots (Edit Farm, 10 Nov 2026; the map's field sign stood over the second one)
    var onField = {}, fb = null;
    s.yard.items.forEach(function (it) {
      if (!O.types[it.t] || !O.types[it.t].fieldPlot) return;
      L.yardBox(it.t, it.x, it.y).forEach(function (p) {
        onField[p[1] * w + p[0]] = 1;
        fb = fb ? { x0: Math.min(fb.x0, p[0]), y0: Math.min(fb.y0, p[1]) } : { x0: p[0], y0: p[1] };
      });
    });
    // ripe crops: a patch at the top of the field, from its second plot
    var crops = ['turnip', 'potato', 'carrot', 'corn'], n = s.banditLoot.crops, fx = fb ? fb.x0 + 4 : 10, fy = fb ? fb.y0 : 12;
    for (var k = 0, tries = 0; k < n && tries < 400; tries++) {
      var x = fx + (tries % 10), y = fy + Math.floor(tries / 10);
      if (!free(x, y) || (fb && !onField[y * w + x])) continue;
      var id = crops[Math.floor(rnd() * crops.length)];
      s.soil[y * w + x] = { c: id, p: L.nowMin() - L.growMins({ c: id, w: 1 }) - 5, w: 1, r: 0 }; // (just ripe)
      k++;
    }
    // animals in the pen
    for (var a = 0; a < Math.ceil(s.banditLoot.produce / 2); a++) L.addAnimal(s, a % 2 ? 'cow' : 'chicken', false);
    // fences round the field patch and the pen, defenses near the field and the house
    var farmInfo = F.farm ? F.farm() : null;
    var put = function (key, x, y) { // (by the yard's own rules: what would go back to storage is never put)
      var t = O.index[key];
      if (!free(x, y) || (farmInfo && L.yardCantPlace(s, farmInfo, t, x, y, null))) return false;
      s.yard.items.push({ t: t, x: x, y: y });
      self.blocked[self.idx(x, y)] = true;
      return true;
    };
    var nf = b0(s.banditDefs.fence), ring = [];
    for (var i = -1; i <= 10; i++) { ring.push([fx + i, fy - 1]); ring.push([fx + i, fy + Math.ceil(n / 10)]); }
    for (var j = 0; j < Math.ceil(n / 10); j++) { ring.push([fx - 1, fy + j]); ring.push([fx + 10, fy + j]); }
    var gap = Math.floor(rnd() * ring.length);
    for (var q = 0; q < ring.length && nf > 0; q++) { var pt = ring[(gap + 2 + q) % ring.length]; if (put('wood_fence', pt[0], pt[1])) nf--; }
    // near what it guards: rings out from (cx, cy), the nearest open spots first (in a seeded order), up to 12 tiles
    var near = function (key, cnt, cx, cy, r) {
      var c = 0;
      for (var rr = Math.max(1, r - 2); rr <= 12 && c < cnt; rr++) {
        var ring = [];
        for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rr) ring.push([cx + dx, cy + dy]);
        for (var i2 = ring.length - 1; i2 > 0; i2--) { var j2 = Math.floor(rnd() * (i2 + 1)), tmp = ring[i2]; ring[i2] = ring[j2]; ring[j2] = tmp; }
        for (var k2 = 0; k2 < ring.length && c < cnt; k2++) if (put(key, ring[k2][0], ring[k2][1])) { c++; k2 += 3; } // (spread out a little)
      }
    };
    near('scarecrow', b0(s.banditDefs.scarecrow), fx + 5, fy + 1, 4);
    near('def_sili', b0(s.banditDefs.sili), fx + 5, fy + 1, 5);
    near('def_mudpit', b0(s.banditDefs.mudpit), fx + 5, fy - 3, 4);
    near('def_sprinkler', b0(s.banditDefs.sprinkler), fx + 5, fy + 1, 5);
    // (the pen's defenses at its gate, the way in: since Edit Farm, 10 Nov 2026, nothing stands inside the ranch)
    var ranch = L.buildingsOf(s, 'ranch')[0], gate = ranch && L.maskTiles(ranch.t, ranch.x, ranch.y, 'G')[0];
    var px = gate ? gate[0] : pen ? Math.floor((pen.x0 + pen.x1) / 2) : fx + 15, py = gate ? gate[1] + 1 : pen ? Math.floor((pen.y0 + pen.y1) / 2) : fy;
    near('def_goose', b0(s.banditDefs.goose), px, py, 3);
    near('def_beebox', b0(s.banditDefs.beebox), px, py, 4);
    var door = (this.objects || []).filter(function (o) { return o.name === 'house_door'; })[0], hx = door ? door.x0 : 30, hy = door ? door.y1 + 2 : 10;
    near('def_tower', b0(s.banditDefs.tower), hx, hy, 4);
    near('def_kampana', b0(s.banditDefs.kampana), hx, hy, 3);
    if (!s.dog && s.banditDefs.dog) s.dog = { name: 'Bantay', love: 0, pet: 0 };
  };
  var b0 = function (v) { return v || 0; };
  void setupYard;
})(window.Farm = window.Farm || {});
