// Driving Bram's farm machines (owner, 19 Nov 2026: "Make the harvester or other machine to make it realistic, like a real
// harvester in real world"; 20 Nov: "Yes approve"; docs/superpowers/specs/2026-11-20-machines-drive-design.md).
// - Hold a machine in the bag on your own farm: the action button says Get in (the Seeder: Push). The machine is about
//   3 tiles long (C.MACHINES.drive); the farmer sits in the Tractor and the Harvester and walks behind the Seeder,
//   holding its handle. The joystick steers it, slower than walking, in 4 directions (19b-feel.js P.move asks
//   P.driveLimit); fences, buildings, trees, stumps, boulders and water stop it (the farmer's own walls).
// - It works a strip of 3 tiles across its way as it goes, each tile once as it passes, through the same rules as the
//   hand: the Harvester's header in front cuts every ripe crop into its tank (L.mkTankPick; Unload at the Silo), the
//   Tractor pushes weeds, branches and stones aside at its nose and tills with its plough behind (L.mkTill, its energy
//   paid as it goes), the Seeder's drills under its hopper plant the packet held last (the seed bag's plantArea). It never
//   crushes a crop: what it does not work it rolls over unchanged.
// - Get out (or Let go) puts it back in the bag; leaving the farm, a door, a visit or a raid: you get out first.
// - The owner's pictures: 'machine_<kind>_side' (facing right, mirrored for the left), '_front' (driving down),
//   '_back' (driving up), from the 'vehicles' pack; until a front or back comes the side picture stands in.
// - A rumble as it goes, dust behind the Tractor, cut straw behind the Harvester, seeds from the Seeder, an engine's chug
//   (the Seeder: its wheels), drawn only on screen. The tank shows over the action button.
// - A first-time tour, DRIVING MACHINES, the first time you get in (skipped when the Forge's tour told of it).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MACHINES, K = C.MACHINE_KINDS;
  if (!M || !M.drive) return;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var INK = F.UI_CONST.INK;
  var DARK_GREEN = 0x2f5a22;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || v || F.session.raid); };
  var VEC = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
  var VIEW = { right: 'side', left: 'side', down: 'front', up: 'back' };
  var have = function (k) { return !!(F.images && F.images[k]); };
  // where the farmer sits in each picture (fractions of it from its left and top: the seat), how much of the farmer
  // shows above it (px of the 384 tall frame, from the top: to the hips on the open Tractor, head and shoulders in the
  // Harvester's cab) and how big. Tuned on the owner's pictures in the game, 20 Nov 2026.
  var SEAT = {
    tractor: { side: [0.43, 0.42], front: [0.5, 0.36], back: [0.5, 0.44], show: 228, size: 0.82 },
    harvester: { side: [0.63, 0.47], front: [0.5, 0.56], back: [0.5, 0.43], show: 176, size: 0.7 },
  };
  var MSG_MS = 3500; // the same message at most this often

  // ---------- the pictures ----------
  // [texture key, width in tiles] for kind k seen from `view`; the side picture until a front or back is here
  P.driveTex = function (k, view) {
    var R = M.drive[k];
    if (view !== 'side' && have('machine_' + k + '_' + view)) return [F.ensureTexture(this, 'machine_' + k + '_' + view), R.ends, view];
    if (have('machine_' + k + '_side')) return [F.ensureTexture(this, 'machine_' + k + '_side'), R.side, 'side'];
    return [F.mkTex(this, k), R.side, 'side'];
  };

  // ---------- where it is ----------
  // its middle: the farmer's feet (the seat), or the Seeder pushed ahead of the farmer
  P.driveMid = function (dir) {
    var f = this.feet(), d = this.drive, v = VEC[dir || this.dir] || VEC.down, push = (d && d.R.push) || 0;
    return { x: f.x + v[0] * push * T, y: f.y + v[1] * push * T };
  };
  // the tile at `ahead` tiles from its middle, going dir
  P.driveTile = function (dir, ahead) {
    var c = this.driveMid(dir), v = VEC[dir];
    return { x: Math.floor((c.x + v[0] * ahead * T) / T), y: Math.floor((c.y + v[1] * ahead * T) / T) };
  };
  // Can its nose go onto this tile? The farmer's walls stop it; the Tractor goes through what it pushes aside.
  P.drivePass = function (tx, ty) {
    if (!this.inMap(tx, ty)) return false;
    if (this.walkable(tx, ty)) return true;
    var d = this.drive, idx = this.idx(tx, ty);
    if (!d || d.k !== 'tractor' || this.blocked[idx]) return false;
    if (d.cleared[idx]) return true; // (pushed aside a moment ago: its picture goes as the swing lands)
    var w = this.mkWork('tractor', [[tx, ty]])[0];
    return !!(w && w.clear);
  };
  // 19b-feel.js P.move: along its way only (it turns, it does not crab), and its nose stops at a wall
  P.driveLimit = function (nx, ny, dir) {
    var d = this.drive, v = VEC[dir];
    if (!d || !v) return [nx, ny];
    if (v[0]) ny = 0; else nx = 0;
    var t = this.driveTile(dir, d.R.nose + 0.12);
    if ((nx * v[0] > 0 || ny * v[1] > 0) && !this.drivePass(t.x, t.y)) return [0, 0];
    return [nx, ny];
  };

  // ---------- getting in and out ----------
  P.canDrive = function () {
    return this.mapKey === 'farm' && !visiting(this) && !F.session.riding && !this.busy && !!this.player && !this.fishing;
  };
  P.getIn = function (k) {
    var self = this, s = this.state;
    if (this.drive || !this.canDrive()) return;
    if (!quiet() && !L.mkDriveTourSeen(s)) {
      L.mkDriveTourTake(s);
      this.save();
      return F.ui.tour('machines_drive', function () { if (L.mkHeld(self.state) === k) self.getIn(k); });
    }
    this.player.body.setVelocity(0, 0);
    this.drive = { k: k, R: M.drive[k], due: { c: 0 }, cleared: {}, last: {}, done: { till: 0, clear: 0, plant: 0, cut: 0 }, said: {}, fx: 0, snd: 0, view: null };
    F.session.driving = k;
    if (k === 'seeder') { var sl = L.mkSeedSlot(s, F.session.mkSeed); this.drive.seed = sl >= 0 ? s.inv[sl].id : null; }
    this.drive.img = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    if (!this.drive.R.push) {
      var S = SEAT[k];
      this.drive.seat = this.add.image(0, 0, F.playerKey(this), 0).setOrigin(0.5, S.show / 384).setScale(S.size);
      this.drive.seat.setCrop(0, 0, 256, S.show);
    }
    // its shadow on the ground (the farmer's own, wider)
    if (this.shadow) this.drive.sh = this.add.image(0, 0, this.shadow.texture.key, this.shadow.frame.name).setAlpha(this.shadow.alpha);
    this.idle();
    this.driveDraw(this.time.now, 0);
    sfx(this.drive.R.push ? 'rattle' : 'engine');
    this.hintKey = null;
    F.bus.emit('hud');
  };
  P.getOut = function (travelling) {
    var d = this.drive;
    if (!d) return;
    this.drive = null;
    F.session.driving = null;
    if (d.img) d.img.destroy();
    if (d.seat) d.seat.destroy();
    if (d.sh) d.sh.destroy();
    if (this.player) this.player.setVisible(true).setAlpha(1);
    if (this.shadow) this.shadow.setVisible(true);
    if (this.player && this.player.body) this.player.body.setVelocity(0, 0);
    if (F.ui && F.ui.mkTankShow) F.ui.mkTankShow(null);
    this.idle();
    this.hintKey = null;
    var n = d.done, words = [];
    if (n.cut) words.push(n.cut + ' cut');
    if (n.till) words.push(n.till + ' tilled');
    if (n.clear) words.push(n.clear + ' cleared');
    if (n.plant) words.push(n.plant + ' planted');
    if (words.length && F.ui) F.ui.toast('The ' + M[d.k].name + ': ' + words.join(', ') + '.' + (d.k === 'harvester' && L.mkTankN(this.state) ? ' ' + L.mkTankN(this.state) + ' crops wait in its tank.' : ''), 2600, DARK_GREEN);
    this.changed();
    if (!travelling) this.save(); // (its tank, what it did: kept now; a trip saves on its own)
  };
  var beforeTravel = P.beforeTravel;
  P.beforeTravel = function () {
    if (this.drive) this.getOut(true);
    if (beforeTravel) return beforeTravel.apply(this, arguments);
  };
  var create = P.create;
  P.create = function () {
    this.drive = null;
    F.session.driving = null;
    return create.apply(this, arguments);
  };

  // ---------- the Silo ----------
  P.nearSilo = function () {
    var O = C.OUTDOOR, t = O && O.index && O.index.silo, s = this.state, c = this.driveMid();
    if (t == null) return false;
    var tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    return (s.yard.items || []).some(function (it) {
      if (it.t !== t) return false;
      var dx = Math.max(it.x - tx, 0, tx - (it.x + 2)), dy = Math.max(it.y - ty, 0, ty - (it.y + 3));
      return Math.max(dx, dy) <= 2;
    });
  };
  P.driveUnload = function () {
    var s = this.state, r = L.mkUnload(s), f = this.feet();
    if (!r.silo && !r.bag) {
      sfx('nope');
      return F.ui.toast(r.left ? 'The Silo and your bag are full. Make room, then Unload again.' : 'The tank is empty.');
    }
    sfx('harvest');
    var words = [];
    if (r.silo) words.push(r.silo + ' into the Silo');
    if (r.bag) words.push(r.bag + ' Silver and Gold into your bag');
    this.floatTextAt(f.x, f.y - 2.2 * T, '+' + (r.silo + r.bag));
    F.ui.toast('Unloaded: ' + words.join(', ') + '.' + (r.left ? ' No room for ' + r.left + ': they wait in the tank.' : ''), 3000, DARK_GREEN);
    this.changed();
    this.save();
  };

  // ---------- the action button ----------
  P.driveAction = function () {
    var self = this, d = this.drive, k = d.k;
    if (k === 'harvester' && L.mkTankN(this.state) > 0 && this.nearSilo()) return { label: 'Unload', icon: C.ITEMS.corn.icon, run: function () { self.driveUnload(); } };
    return { label: d.R.push ? 'Let go' : 'Get out', icon: C.ITEMS[k].icon, run: function () { self.getOut(); } };
  };
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.drive) return this.driveAction();
    var self = this, k = L.mkHeld(this.state);
    if (k && this.canDrive()) return { label: M.drive[k].push ? 'Push' : 'Get in', icon: C.ITEMS[k].icon, run: function () { self.getIn(k); } };
    var r0 = resolve.call(this);
    if (!k || (r0 && !r0.disabled)) return r0; // (with it in your hands elsewhere: what the button does anyway, a door...)
    return { label: M.drive[k].push ? 'Push' : 'Get in', icon: C.ITEMS[k].icon, disabled: true, why: 'The ' + M[k].name + ' works in your own field, on the farm.' };
  };

  // ---------- the work, as it goes ----------
  var say = function (w, key, words) {
    var d = w.drive, now = w.time.now;
    if (d.said[key] && now - d.said[key] < MSG_MS) return;
    d.said[key] = now;
    F.ui.toast(words);
  };
  // (the hand's own effects, without the hand's: no float over each strip, no jolt that stops it)
  var floatText = P.floatText, floatTextAt = P.floatTextAt, animateUse = P.animateUse;
  P.floatText = function () { if (this.driveQuiet) return; return floatText.apply(this, arguments); };
  P.floatTextAt = function () { if (this.driveQuiet) return; return floatTextAt.apply(this, arguments); };
  P.animateUse = function () { if (this.driveQuiet) return; return animateUse.apply(this, arguments); };
  var quietly = function (w, fn) { w.driveQuiet = true; try { return fn(); } finally { w.driveQuiet = false; } };

  P.driveHarvest = function (t, tiles) {
    var s = this.state, d = this.drive, ripe = this.mkWork('harvester', tiles);
    if (!ripe.length) return;
    var room = Math.max(0, Math.floor((M.tank - L.mkTankN(s)) / M.most)), w = this.map.width;
    if (!room) return say(this, 'full', 'The tank is full: drive to the Silo and Unload.');
    var some = ripe.slice(0, room).map(function (i) { return [i % w, Math.floor(i / w)]; });
    var out = {}, harvest = L.harvest, reach = L.chargeTiles;
    L.harvest = function (st, i) { return L.mkTankPick(st, i, harvest, out); };
    L.chargeTiles = function () { return some; };
    var self = this;
    try { quietly(this, function () { self.harvest(t, self.idx(some[0][0], some[0][1])); }); } finally { L.harvest = harvest; L.chargeTiles = reach; }
    d.done.cut += some.filter(function (p) { return !L.isRipe(s.soil[self.idx(p[0], p[1])]); }).length;
    if (ripe.length > some.length) say(this, 'full', 'The tank is full: drive to the Silo and Unload.');
  };
  // A packet plants M.sow tiles (a 3x3 by hand), a strip at a time: d.sown = { id, left } is what the last packet still
  // plants, so a strip takes a new one only when that has run out (and the last of a packet is planted even when the bag
  // has no more). Planted from a bag of its own for that moment (as L.mkPick picks), so the seed bag's own planting
  // (plantArea: its rules, its sound, its counts) takes that one and never the bag's.
  P.driveSeed = function (t, tiles) {
    var s = this.state, d = this.drive, self = this, free = this.mkWork('seeder', tiles), w = this.map.width;
    if (!free.length) return;
    var sown = d.sown || (d.sown = { id: null, left: 0 }), slot = -1, id = sown.id;
    if (sown.left < free.length) {
      // the packet you held last when you took hold of it, and only that: out of it, it stops (no other crop mid-row)
      slot = d.seed ? L.mkSeedSlot(s, d.seed) : -1;
      if (slot >= 0 && s.inv[slot].id !== d.seed) slot = -1;
      if (slot < 0 && !sown.left) return say(this, 'seeds', d.seed ? 'Out of ' + C.ITEMS[d.seed].name + '. Let go, hold another seed packet, then Push again.' : 'Out of seeds. The Seeder plants the seed packets in your bag.');
      if (slot >= 0) id = sown.id = d.seed;
      else free = free.slice(0, sown.left);
    }
    var area = free.map(function (i) { return [i % w, Math.floor(i / w)]; });
    var bag = s.inv, sel = s.sel, n = 0;
    s.inv = [{ id: id, n: 1 }, null, null, null, null, null, null, null];
    s.sel = 0;
    try { quietly(this, function () { self.plantArea(t, area); }); } finally { s.inv = bag; s.sel = sel; this.hintKey = null; }
    free.forEach(function (i) { if (s.soil[i] && s.soil[i].c) n++; });
    if (!n) return;
    if (slot >= 0) { L.removeAt(s, slot, 1); sown.left += M.sow - n; } else sown.left -= n;
    d.done.plant += n;
    F.bus.emit('hud');
  };
  // the Tractor: 'clear' at its nose (weeds, branches, stones; stumps and boulders stop it), 'till' under its plough
  P.driveTill = function (t, tiles, part) {
    var self = this, s = this.state, d = this.drive, w = this.map.width;
    var plan = this.mkWork('tractor', tiles).filter(function (p) { return part === 'clear' ? p.clear : !p.clear; });
    if (part === 'clear') plan = plan.map(function (p) { return { idx: p.idx, clear: p.clear, deco: p.deco, till: 0 }; });
    if (!plan.length) return;
    var r = L.mkTill(s, plan, d.due);
    if (r === 'tired') { say(this, 'tired', "You're too tired. Eat something, or take a break: energy comes back by itself."); return; }
    if (r === 'none' || !r) return;
    var at = function (i) { return { x: i % w, y: Math.floor(i / w) }; }, deco = {};
    plan.forEach(function (p) { if (p.deco) deco[p.idx] = 1; });
    r.cleared.forEach(function (i) { d.cleared[i] = 1; });
    d.done.till += r.till;
    d.done.clear += r.clear;
    // what you see lands a moment later, as a swing's does (the rules happened now)
    this.time.delayedCall(this.IMPACT ? this.IMPACT.swing : 110, function () {
      if (!self.layers) return;
      var walls = false;
      r.cleared.forEach(function (i) {
        self.popOut(deco[i] ? 'Walls' : 'Debris', at(i));
        if (deco[i]) { self.removeDeco(i); walls = true; } else self.removeDebrisTile(i);
      });
      if (walls) self.recollide();
      if (r.cleared.length) { if (self.layers.Debris) self.layers.Debris.setCollisionByProperty({ collides: true }); sfx('leaves'); }
      r.tilled.forEach(function (i) { self.refreshTile(i); if (self.soilPop) self.soilPop(at(i)); });
      if (r.tilled.length) sfx('till');
      if (r.lumber) self.flyTile(t, C.ICON.lumber);
      if (r.stone) self.flyTile(t, C.ICON.stone);
    });
    if (r.clear) this.progress('clear', r.clear);
    if (r.till) this.progress('till', r.till);
    this.changed();
  };
  // each line it works, once each time it comes onto a new tile while going
  P.driveWork = function (dir) {
    var d = this.drive, v = VEC[dir], self = this;
    var line = function (name, ahead, fn) {
      var t = self.driveTile(dir, ahead), key = t.x + ',' + t.y + ',' + dir;
      if (d.last[name] === key) return;
      d.last[name] = key;
      fn.call(self, t, L.mkStrip(t.x, t.y, v[0], v[1]));
    };
    if (d.k === 'tractor') {
      line('nose', d.R.nose + 0.12, function (t, tiles) { this.driveTill(t, tiles, 'clear'); });
      line('work', d.R.work, function (t, tiles) { this.driveTill(t, tiles, 'till'); });
    } else if (d.k === 'harvester') line('work', d.R.work, this.driveHarvest);
    else line('work', d.R.work, this.driveSeed);
  };

  // ---------- each frame ----------
  P.driveDraw = function (time, speed) {
    var d = this.drive, k = d.k, dir = this.dir, view = VIEW[dir] || 'front', tex = this.driveTex(k, view), img = d.img;
    var c = this.driveMid(dir), going = speed > C.SPEED * 0.1;
    if (img.texture.key !== tex[0]) img.setTexture(tex[0]);
    var src = img.texture.getSourceImage(), wd = tex[1] * T, ht = wd * src.height / src.width;
    img.setDisplaySize(wd, ht);
    // its wheels on the ground: side on under the middle, coming at you its nose, going away its tail (nearest you)
    var base = c.y + (tex[2] === 'side' ? 0.3 : view === 'front' ? d.R.nose * 0.75 : d.R.tail * 0.75) * T;
    var bob = d.R.push ? (going ? Math.abs(Math.sin(time / 70)) * 0.012 * T : 0) : Math.abs(Math.sin(time / (going ? 38 : 55))) * (going ? 0.02 : 0.008) * T;
    img.setPosition(c.x, base - bob).setFlipX(dir === 'left');
    F.depthTo(img, DEPTH.actor + base / 1e5 + (d.R.push && view === 'side' ? -0.0003 : 0));
    if (d.sh) d.sh.setPosition(c.x, base - 0.06 * T).setDisplaySize(wd * 0.92, 0.42 * T).setDepth(DEPTH.shadow);
    var seat = d.seat;
    if (seat) {
      var sp = SEAT[k][tex[2]] || SEAT[k].side, fx = sp[0], fy = sp[1];
      if (dir === 'left') fx = 1 - fx;
      var key = F.playerKey(this), frame = view === 'side' ? 6 : view === 'back' ? 3 : 0;
      if (seat.texture.key !== key) seat.setTexture(key, frame);
      if (seat.frame.name !== frame) seat.setFrame(frame);
      seat.setCrop(0, 0, 256, SEAT[k].show);
      seat.setFlipX(view === 'side' && dir === 'right').setPosition(c.x + (fx - 0.5) * wd, base - bob - ht + fy * ht);
      F.depthTo(seat, DEPTH.actor + base / 1e5 + 0.0001);
      this.player.setVisible(false);
      if (this.shadow) this.shadow.setVisible(false);
    }
    // the feel, only where you can see it
    if (!going || time - d.fx < 90) return;
    d.fx = time;
    var cam = this.cameras.main.worldView, v = VEC[dir];
    if (!cam.contains(c.x, c.y)) return;
    var back = d.k === 'harvester' ? -d.R.tail : d.k === 'tractor' ? d.R.work : d.R.work, bx = c.x + v[0] * back * T, by = c.y + v[1] * back * T + 0.2 * T;
    if (d.k === 'tractor') { this.burst('dust', bx, by, 1); this.burst('dirt', bx, by, 1); }
    else if (d.k === 'harvester') { this.burst('leaf', bx, by - 0.3 * T, 1); this.burst('dust', c.x + v[0] * d.R.work * T, by, 1); }
    else this.burst('dirt', bx, by, 1);
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    var d = this.drive;
    if (!d || !this.player || !this.player.body) return;
    // put away, a horse, or no longer on your own farm: out
    if (L.mkHeld(this.state) !== d.k || !this.canDrive() && !this.busy) return this.getOut();
    var b = this.player.body, speed = Math.hypot(b.velocity.x, b.velocity.y);
    this.driveDraw(time, speed);
    if (this.busy || (F.ui && F.ui.blocking())) return;
    if (speed > C.SPEED * d.R.speed * 0.2) this.driveWork(this.dir);
    // the engine's chug (the Seeder: its wheels), quicker as it goes
    var every = d.R.push ? (speed > 10 ? 210 : 0) : speed > 10 ? 260 : 620;
    if (every && time - d.snd > every) { d.snd = time; sfx(d.R.push ? 'rattle' : 'engine'); }
    if (F.ui && F.ui.mkTankShow) F.ui.mkTankShow(d.k === 'harvester' ? L.mkTankN(this.state) : null);
  };

  // ---------- the tank, over the action button ----------
  U.mkTankShow = function (n) {
    if (n == null) { if (this.mkTankText) this.mkTankText.setVisible(false); this.mkTankN = null; return; }
    if (!this.mkTankText) {
      var c = this.chargeText;
      this.mkTankText = this.txt(c.x, c.y - 4, '', 13, '#fff27a', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 4 }).setOrigin(0.5);
    }
    this.mkTankText.setVisible(true);
    if (n === this.mkTankN) return;
    this.mkTankN = n;
    var full = n + M.most > M.tank;
    this.mkTankText.setText((full ? 'Tank full ' : 'Tank ') + n + ' / ' + M.tank).setColor(full ? '#ffb08a' : '#fff27a');
  };

  // ---------- the first-time tour ----------
  var pic = function (ui, sc, k, view, x, y, w) {
    var R = M.drive[k], key = 'machine_' + k + '_' + view, tex = have(key) ? F.ensureTexture(ui, key) : have('machine_' + k + '_side') ? F.ensureTexture(ui, 'machine_' + k + '_side') : F.mkTex(ui, k);
    var img = ui.add.image(x, y, tex).setOrigin(0.5, 1), src = img.texture.getSourceImage();
    img.setDisplaySize(w, w * src.height / src.width);
    sc.add(img);
    void R;
    return img;
  };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var cell = function (ui, sc, x, y, kind) {
    return ui.canvasImg(sc, x - 11, y - 11, 'mkd-tour-' + kind, 22, 22, function (g) {
      g.fillStyle = kind === 'grass' ? '#7cbc4a' : '#8a5a32'; g.fillRect(1, 1, 20, 20);
      if (kind !== 'grass') { g.fillStyle = 'rgba(40,20,8,0.25)'; for (var k = 4; k < 20; k += 6) g.fillRect(3, k, 16, 2); }
      if (kind === 'sprout') { g.fillStyle = '#5fa84a'; g.fillRect(10, 6, 3, 9); g.fillRect(6, 6, 5, 3); }
      if (kind === 'ripe') { g.fillStyle = '#3e7a2e'; g.fillRect(9, 3, 4, 10); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(11, 14, 5, 0, 7); g.fill(); }
    });
  };
  // a field 3 rows deep the machine drives along, the rows changing behind it
  var field = function (ui, sc, move, k, from, to) {
    for (var c = 0; c < 9; c++) for (var r = 0; r < 3; r++) {
      var x = 40 + c * 24, y = 66 + r * 22;
      cell(ui, sc, x, y, from);
      var after = cell(ui, sc, x, y, to).setAlpha(move ? 0 : 1);
      tw(ui, move, { targets: after, alpha: 1, duration: 200, delay: 300 + c * 260, hold: 2600 - c * 260, yoyo: true, repeat: -1, repeatDelay: 600 });
    }
    var m = pic(ui, sc, k, 'side', 20, 116, k === 'harvester' ? 96 : 80);
    tw(ui, move, { targets: m, x: 250, duration: 2600, delay: 200, repeat: -1, repeatDelay: 1000 });
  };
  F.TOURS.machines_drive = {
    title: 'DRIVING MACHINES',
    steps: [
      {
        text: 'Your machines are driven now. Hold one in your bag on your farm and tap Get in. Get out puts it back in your bag.',
        draw: function (ui, sc, move) {
          ['tractor', 'harvester'].forEach(function (k, i) {
            var m = pic(ui, sc, k, i ? 'front' : 'side', 82 + i * 120, 118, i ? 96 : 110);
            tw(ui, move, { targets: m, y: 115, duration: 120, yoyo: true, repeat: -1 });
          });
        },
      },
      {
        text: 'Steer with the joystick. It works 3 tiles across as it goes, and never crushes a crop that is still growing.',
        draw: function (ui, sc, move) { field(ui, sc, move, 'tractor', 'grass', 'soil'); },
      },
      {
        text: 'The Harvester cuts every ripe crop into its tank (' + M.tank + '). Full? Drive next to the Silo and tap Unload.',
        draw: function (ui, sc, move) {
          field(ui, sc, move, 'harvester', 'ripe', 'soil');
          var t = ui.txt(150, 22, 'Tank 24 / ' + M.tank, 13, INK, { fontStyle: 'bold' }).setOrigin(0.5);
          sc.add(t);
        },
      },
      {
        text: 'You push the Seeder along: it plants the seeds you held last, one a tile, until the packet runs out.',
        draw: function (ui, sc, move) { field(ui, sc, move, 'seeder', 'soil', 'sprout'); },
      },
    ],
  };
  void K;
})(window.Farm = window.Farm || {});
