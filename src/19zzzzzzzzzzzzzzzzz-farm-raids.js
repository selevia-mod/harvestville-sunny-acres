// Farm Raids on screen, step 1 (owner, 9 Nov 2026; docs/raids.md; rules 01-logicZZZZZZZZZZZ-raids.js):
//  - the Raid Camp on your farm (Mira's, Workshops): tap it for its panel: Party (train), Raiders (level up),
//    Defenses (level up; placing them on your farm comes with real raids), Practice (the bandit farms)
//  - a battle: its own screen over the game. Drag to look around; pick a raider below and tap the light edge of the
//    farm to send it in. 2 minutes; the loot and the stars count up at the top; End stops it.
// Until their pictures are in (art-src/RAID-PROMPTS.md), raiders and defenses borrow pictures the game has.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;
  var O = C.OUTDOOR;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0xe9a91c, RED = 0xc0503a;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var world = function () { return F.world; };

  // ---------- the Raid Camp on the farm (a workshop-like piece: one per farm) ----------
  if (O.index.raid_camp == null) {
    O.index.raid_camp = O.types.length;
    O.types.push({ key: 'raid_camp', name: 'Raid Camp', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: R.camp.price, beauty: 4, one: true,
      hd: 'ws_tannery', what: 'a bamboo raid camp with a pennant flag' }); // (its own picture: raids/raid_camp.png, art-src/RAID-PROMPTS.md)
  }
  var campAt = function (s, x, y) {
    var items = (s.yard && s.yard.items) || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], type = O.types[it.t];
      if (type && type.key === 'raid_camp' && x >= it.x && x < it.x + type.w && y >= it.y && y < it.y + type.h) return it;
    }
    return null;
  };
  L.hasRaidCamp = function (s) { return ((s.yard && s.yard.items) || []).some(function (it) { var t = O.types[it.t]; return t && t.key === 'raid_camp'; }); };
  var farm2Action = P.farm2Action;
  P.farm2Action = function (t) {
    var s = this.state;
    if (campAt(s, t.x, t.y)) return { label: 'Raids', icon: C.ICON.act_board != null ? C.ICON.act_board : C.ICON.star, run: function () { F.ui.openRaidCamp('party'); } };
    return farm2Action.call(this, t);
  };

  // ---------- pictures (borrowed until the raid art is in) ----------
  var RAIDER_ICON = { goat: 'horn_goat', crow: 'feather_labuyo', cat: 'cat_basket', carabao: 'horn_carabao', monkey: 'banana_wild', boar: 'tusk', rooster: 'feather_labuyo', bayawak: 'scale_bayawak' };
  var DEF_ICON = { dog: 'dog', scarecrow: null, fence: null, goose: 'egg', beebox: 'wild_honey', mudpit: null, sprinkler: 'act_wish', tower: 'act_board', sili: 'chili', kampana: 'act_bell' };
  L.raiderIcon = function (k) { var n = RAIDER_ICON[k]; return C.ICON[n] != null ? C.ICON[n] : C.ICON.star; };
  L.defenseIcon = function (k) { var n = DEF_ICON[k]; return n && C.ICON[n] != null ? C.ICON[n] : k === 'scarecrow' ? C.ICON.star : C.ICON.sparkle; };

  // ---------- the panel ----------
  var TABS = [['party', 'Party'], ['raiders', 'Raiders'], ['defenses', 'Defenses'], ['practice', 'Practice']];
  var why = { gold: 'Not enough Gold.', space: 'The camp is full. Upgrade it for a bigger party.', locked: 'A higher camp opens it.', top: 'Already the best.', need: 'You need something from hunting first.', buy: 'Buy a Raid Camp at Mira\'s first.' };
  U.openRaidCamp = function (tab, page) {
    var self = this, s = F.session.state, r = L.frState(s), now = Date.now();
    if (!r.camp && L.hasRaidCamp(s)) r.camp = 1; // (the camp you placed is level 1)
    L.trainDone(s, now);
    var redo = function (t, p) { self.closeModal(); self.openRaidCamp(t || tab, p == null ? page : p); };
    var act = function (res, ok) { if (res !== 'ok') { sfx('nope'); return self.toast(why[res] || 'Not now.', 2200); } sfx('coin'); if (world()) { world().changed(); world().save(); } redo(); if (ok) self.toast(ok, 2000, 0x2f5a22); };
    var rows = [];
    if (tab === 'party') {
      var next = R.camp.levels[r.camp];
      rows.push({ icon: C.ICON.act_board != null ? C.ICON.act_board : C.ICON.star, name: 'Raid Camp, level ' + r.camp, tag: null,
        desc: 'Party room ' + L.armySpace(s) + ' / ' + L.campSpace(s) + '.' + (next ? ' Next level: room for ' + next.space + (next.open.length ? ', opens the ' + R.raiders[next.open[0]].name : '') + '.' : ' Top level!'),
        buttons: next && r.camp ? [{ label: next.gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.campUpgrade(s), 'The Raid Camp is bigger!'); } }] : [] });
      R.raiderOrder.forEach(function (k) {
        var d = R.raiders[k], open = L.raiderOpen(s, k), have = r.army[k] || 0, wait = r.train.filter(function (t) { return t.k === k; }).length;
        rows.push({ icon: L.raiderIcon(k), name: d.name + (have ? '  x' + have : ''), desc: open ? (wait ? wait + ' training. ' : '') + d.say : 'Opens with a bigger Raid Camp.',
          buttons: open ? [{ label: 'Train ' + d.gold + 'G', color: GREEN, cb: function () { act(L.trainRaider(s, k, Date.now())); } }] : [] });
      });
    } else if (tab === 'raiders') {
      R.raiderOrder.forEach(function (k) {
        var d = R.raiders[k], lv = L.raiderLv(s, k), open = L.raiderOpen(s, k), need = R.level.need[lv], gold = R.level.gold[lv];
        rows.push({ icon: L.raiderIcon(k), name: d.name + '  Lv ' + lv, desc: !open ? 'Not open yet.' : lv >= 5 ? 'Top level!' : 'Next: stronger and grabs more. ' + (need ? 'Needs ' + need[1] + ' ' + C.ITEMS[need[0]].name + '.' : ''),
          buttons: open && lv < 5 ? [{ label: gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.raiderUp(s, k), d.name + ' is level ' + (lv + 1) + '!'); } }] : [] });
      });
    } else if (tab === 'defenses') {
      R.defenseOrder.forEach(function (k) {
        var d = R.defenses[k], lv = L.defenseLv(s, k), gold = R.defLevel.gold[lv];
        rows.push({ icon: L.defenseIcon(k), name: d.name + '  Lv ' + lv, desc: d.say,
          buttons: lv < 5 ? [{ label: gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.defenseUp(s, k), d.name + ' is level ' + (lv + 1) + '!'); } }] : [] });
      });
    } else {
      R.bandits.forEach(function (b, i) {
        var stars = r.won[b.key] || 0, open = L.banditOpen(s, i);
        rows.push({ icon: C.ICON.chest, name: b.name + '  ' + ['☆☆☆', '★☆☆', '★★☆', '★★★'][stars], desc: open ? 'Up to ' + b.loot.gold.toLocaleString('en-US') + ' Gold and its crops, eggs and stall goods.' : 'Win a star on the one before.',
          buttons: open ? [{ label: 'Raid', color: RED, cb: function () { self.startRaid(b.key); } }] : [] });
      });
    }
    this.listPanel({
      title: 'Raid Camp', tab: tab, page: page || 0, rows: rows, tabs: TABS, slim: true,
      reopen: function (t, p) { self.openRaidCamp(t, p); },
      sub: function () { return 'Power ' + L.farmPower(s) + '   ·   Raid Points ' + r.pts + '   ·   ' + s.gold.toLocaleString('en-US') + 'G'; },
    });
  };
  // the party you have, as the battle wants it: { k: { n, lv } }
  L.frArmy = function (s) {
    var r = L.frState(s), out = {};
    R.raiderOrder.forEach(function (k) { if (r.army[k]) out[k] = { n: r.army[k], lv: L.raiderLv(s, k) }; });
    return out;
  };
  U.startRaid = function (key) {
    var s = F.session.state, army = L.frArmy(s);
    if (!Object.keys(army).length) { sfx('nope'); return this.toast('Train some raiders first (Party).', 2400); }
    var b = R.bandits.filter(function (x) { return x.key === key; })[0], seed = (Date.now() & 0x7fffffff) || 1;
    this.closeAll();
    F.raidBattle({ bandit: b, farm: L.banditFarm(b, seed), army: army, seed: seed });
  };

  // ---------- the battle screen ----------
  var PX = 26; // screen pixels a tile
  var WI = C.WILD;
  var STAND = { goat: 'kambing', crow: 'labuyo', cat: 'musang', carabao: 'carabaoligaw', monkey: 'unggoy', boar: 'boar', rooster: 'labuyo', bayawak: 'bayawak' };
  var TINT = { crow: 0x3a3a4a };
  var sheetFrame = function (scene, k, f) { // a raider's picture: its own sheet, else the wild sheet's row
    var kind = STAND[k], def = WI.animals[kind] || WI.animals.rabbit;
    if (def.sheet && F.images[def.sheet]) return { key: F.ensureTexture(scene, def.sheet), frame: (def.row || 0) * 12 + f, def: def };
    return { key: F.ensureTexture(scene, 'wild'), frame: WI.order.indexOf(def.sheetRow || kind) * 12 + f, def: def };
  };
  F.RaidScene = class extends Phaser.Scene {
    constructor() { super('FarmRaid'); }
    init(data) { this.data0 = data; }
    create() {
      var self = this, d = this.data0, farm = d.farm, Wd = farm.w * PX, Hd = farm.h * PX;
      this.b = L.frStart(farm, d.army, d.seed);
      this.acc = 0;
      this.started = false;
      this.sel = Object.keys(d.army)[0];
      this.layer = this.add.container(0, 0);
      this.hud = this.add.container(0, 0);
      var cam = this.cameras.main;
      cam.setZoom(F.R).setBounds(-40, -60, Wd + 80, Hd + 200).centerOn(Wd / 2, Hd / 2 + 40);
      cam.setBackgroundColor('#3a6b2a');
      this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setZoom(F.R).centerOn(W / 2, C.VIEW_H / 2);
      cam.ignore(this.hud);
      this.hudCam.ignore(this.layer);
      this.drawFarm();
      this.drawHud();
      // drag to look around; a tap on the edge drops the picked raider
      this.input.on('pointerdown', function (p) { self.downAt = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }; self.dragged = false; });
      this.input.on('pointermove', function (p) {
        if (!p.isDown || !self.downAt || self.onHud(p)) return;
        var dx = (p.x - self.downAt.x) / cam.zoom, dy = (p.y - self.downAt.y) / cam.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 6) self.dragged = true;
        if (self.dragged) cam.setScroll(self.downAt.sx - dx, self.downAt.sy - dy);
      });
      this.input.on('pointerup', function (p) {
        if (self.dragged || self.onHud(p) || self.b.end) return;
        var wp = cam.getWorldPoint(p.x, p.y), tx = Math.floor(wp.x / PX), ty = Math.floor(wp.y / PX);
        self.drop(tx, ty);
      });
      F.raidOn = true;
    }
    onHud(p) { var y = p.y / F.R; return y > C.VIEW_H - 120 || y < 64; }
    drawFarm() {
      var farm = this.b.farm, g = this.add.graphics(), e = R.battle.edge;
      this.layer.add(g);
      g.fillStyle(0x6fae4a, 1).fillRect(0, 0, farm.w * PX, farm.h * PX);
      for (var y = 0; y < farm.h; y++) for (var x = 0; x < farm.w; x++) if ((x + y) % 2) g.fillStyle(0x66a444, 1).fillRect(x * PX, y * PX, PX, PX);
      // the edge where raiders come in: lighter, with a dashed line
      g.fillStyle(0xfff3c4, 0.22);
      g.fillRect(0, 0, farm.w * PX, e * PX).fillRect(0, (farm.h - e) * PX, farm.w * PX, e * PX).fillRect(0, e * PX, e * PX, (farm.h - 2 * e) * PX).fillRect((farm.w - e) * PX, e * PX, e * PX, (farm.h - 2 * e) * PX);
      g.lineStyle(2, 0xfff3c4, 0.7).strokeRect(e * PX, e * PX, (farm.w - 2 * e) * PX, (farm.h - 2 * e) * PX);
      var self = this;
      // the loot
      this.lootImgs = this.b.loot.map(function (p) {
        var c = self.add.container(p.x * PX, p.y * PX);
        if (p.kind === 'crops') c.add(self.add.ellipse(0, 4, PX * 1.1, PX * 0.6, 0x6b4a2a));
        var icon = { crops: C.ICON.turnip, produce: C.ICON.egg, stall: C.ICON.act_stall != null ? C.ICON.act_stall : C.ICON.crate, gold: C.ICON.coin }[p.kind];
        c.add(self.add.image(0, -2, 'items', icon).setScale(PX * (p.kind === 'gold' || p.kind === 'stall' ? 1.4 : 1) / 128));
        self.layer.add(c);
        return c;
      });
      // the defenses
      var fenceKey = F.yardImg ? F.yardImg(this, O.index.wood_fence, 'h') : null, scare = F.yardImg ? F.yardImg(this, O.index.scarecrow) : null;
      this.defImgs = this.b.defs.map(function (dd) {
        var c = self.add.container(dd.x * PX, dd.y * PX);
        if (dd.t === 'fence' && fenceKey) c.add(self.add.image(0, PX * 0.45, fenceKey.key, fenceKey.frame).setOrigin(0.5, 1).setDisplaySize(PX, PX * 0.9));
        else if (dd.t === 'scarecrow' && scare) c.add(self.add.image(0, PX * 0.45, scare.key, scare.frame).setOrigin(0.5, 1).setDisplaySize(PX * 1.1, PX * 1.6));
        else if (dd.t === 'mudpit') c.add(self.add.ellipse(0, 2, PX * 0.95, PX * 0.6, 0x5a3a1e, 0.55));
        else { c.add(self.add.circle(0, 0, PX * 0.48, 0x2e1c0c, 0.25)); c.add(self.add.image(0, 0, 'items', L.defenseIcon(dd.t)).setScale(PX * 0.95 / 128)); }
        if (R.defenses[dd.t].dps) c.add(self.add.circle(0, 0, R.defenses[dd.t].range * PX, 0xffffff, 0.04).setStrokeStyle(1, 0xffffff, 0.12));
        self.layer.add(c);
        return c;
      });
      this.unitImgs = {};
    }
    drawHud() {
      var self = this, h = this.hud, top = this.add.graphics();
      top.fillStyle(0x24160b, 0.72).fillRoundedRect(8, 8, W - 16, 48, 14);
      h.add(top);
      this.title = this.add.text(20, 14, this.data0.bandit.name, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#fff6d8', fontStyle: 'bold' }).setResolution(F.R);
      this.timeText = this.add.text(W - 20, 14, '2:00', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '15px', color: '#ffe680', fontStyle: 'bold' }).setOrigin(1, 0).setResolution(F.R);
      this.lootText = this.add.text(20, 33, '', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#e8dcc0' }).setResolution(F.R);
      this.starText = this.add.text(W - 20, 34, '☆☆☆', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '14px', color: '#ffd23f' }).setOrigin(1, 0).setResolution(F.R);
      h.add([this.title, this.timeText, this.lootText, this.starText]);
      // the raiders to send: a card each, the picked one bright
      var keys = Object.keys(this.data0.army), bw = Math.min(70, (W - 24 - 8 * (keys.length - 1)) / Math.max(1, keys.length)), y = C.VIEW_H - 62;
      var bar = this.add.graphics();
      bar.fillStyle(0x24160b, 0.72).fillRoundedRect(6, y - 50, W - 12, 108, 14);
      h.add(bar);
      this.cards = {};
      keys.forEach(function (k, i) {
        var x = 12 + bw / 2 + i * (bw + 8), c = self.add.container(x, y), bg = self.add.graphics();
        c.add(bg);
        c.add(self.add.image(0, -10, 'items', L.raiderIcon(k)).setScale(0.3));
        var n = self.add.text(0, 18, '', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#fff6d8', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R);
        c.add(n);
        var z = self.add.zone(0, 0, bw, 64).setInteractive({ useHandCursor: true });
        z.on('pointerup', function () { self.sel = k; self.refreshHud(); });
        c.add(z);
        h.add(c);
        self.cards[k] = { c: c, bg: bg, n: n, w: bw };
      });
      this.hint = this.add.text(W / 2, y - 40, 'Pick a raider, then tap the light edge to send it in.', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#fff6d8' }).setOrigin(0.5).setResolution(F.R);
      h.add(this.hint);
      // End
      var end = this.add.container(W - 44, 82), eb = this.add.graphics();
      eb.fillStyle(RED, 1).fillRoundedRect(-34, -14, 68, 28, 12);
      end.add([eb, this.add.text(0, 0, 'End', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
      var ez = this.add.zone(0, 0, 68, 28).setInteractive({ useHandCursor: true });
      ez.on('pointerup', function () { if (!self.b.end) { self.b.end = 'stopped'; self.finish(); } });
      end.add(ez);
      h.add(end);
      this.refreshHud();
    }
    refreshHud() {
      var self = this, b = this.b;
      Object.keys(this.cards).forEach(function (k) {
        var cd = self.cards[k], left = b.left[k] ? b.left[k].n : 0, on = self.sel === k;
        cd.bg.clear().fillStyle(on ? 0xe9a91c : 0x5a3a1e, on ? 0.95 : 0.8).fillRoundedRect(-cd.w / 2, -30, cd.w, 60, 10);
        cd.n.setText(R.raiders[k].name + ' x' + left);
        if (cd.n.width > cd.w - 4) cd.n.setScale((cd.w - 4) / cd.n.width);
        cd.c.setAlpha(left ? 1 : 0.45);
      });
      var t = b.taken, secs = Math.max(0, Math.ceil((b.ticks - b.t) * R.battle.tick / 1000));
      this.timeText.setText(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
      this.lootText.setText('Crops ' + Math.floor(t.crops || 0) + '  ·  Eggs/milk ' + Math.floor(t.produce || 0) + '  ·  Stall ' + Math.floor(t.stall || 0) + '  ·  Gold ' + Math.floor(t.gold || 0));
      var st = L.frStars(b);
      this.starText.setText('★★★'.slice(0, st) + '☆☆☆'.slice(st));
    }
    drop(x, y) {
      var b = this.b, k = this.sel;
      if (!k || !b.left[k] || b.left[k].n <= 0) { this.flash('None left. Pick another raider.'); return; }
      if (!L.frEdge(b, x, y)) { this.flash('Send raiders in from the light edge.'); return; }
      var r = L.frDrop(b, k, x, y);
      if (!r) return;
      this.started = true;
      sfx('pick');
      this.refreshHud();
    }
    flash(msg) { var self = this; this.hint.setText(msg).setColor('#ffd23f'); this.time.delayedCall(1600, function () { self.hint.setText('Pick a raider, then tap the light edge to send it in.').setColor('#fff6d8'); }); }
    update(time, delta) {
      var b = this.b;
      if (!b || !this.started || b.end) { this.drawUnits(time); return; }
      this.acc += Math.min(delta, 250);
      while (this.acc >= R.battle.tick && !b.end) { this.acc -= R.battle.tick; this.evStart = b.events.length; L.frStep(b); this.showEvents(); }
      this.drawUnits(time);
      this.refreshHud();
      if (b.end) this.finish();
    }
    showEvents() {
      var self = this, b = this.b;
      b.events.slice(this.evStart).forEach(function (e) {
        var who = e[2], r = b.raiders.filter(function (x) { return x.id === who; })[0], dd = b.defs.filter(function (x) { return x.id === who; })[0];
        var at = r || dd;
        if (!at) return;
        var word = { scared: 'Eek!', stuck: 'Stuck!', gone: 'Out!', down: 'Down!', alarm: 'DONG!' }[e[1]];
        if (!word) return;
        var t = self.add.text(at.x * PX, at.y * PX - 18, word, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: e[1] === 'alarm' ? '#ffd23f' : '#ffffff', fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5).setResolution(F.R);
        self.layer.add(t);
        self.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: function () { t.destroy(); } });
        if (e[1] === 'down' && dd) { var img = self.defImgs[b.defs.indexOf(dd)]; if (img) self.tweens.add({ targets: img, alpha: 0.15, duration: 300 }); }
      });
    }
    drawUnits(time) {
      var self = this, b = this.b;
      b.raiders.forEach(function (r) {
        var u = self.unitImgs[r.id];
        if (!u) {
          var fr = sheetFrame(self, r.k, 6), sc = (fr.def.w || 1) * PX / (fr.def.px || 140) * (r.k === 'crow' ? 0.7 : 1);
          u = self.unitImgs[r.id] = { img: self.add.image(r.x * PX, r.y * PX, fr.key, fr.frame).setOrigin(0.5, 0.92).setScale(sc), bar: self.add.rectangle(r.x * PX, r.y * PX - 22, 18, 3, 0x7fd05a).setOrigin(0, 0.5), lx: r.x, step: 0 };
          if (TINT[r.k]) u.img.setTint(TINT[r.k]);
          self.layer.add([u.img, u.bar]);
        }
        if (r.hp <= 0) { if (!u.gone) { u.gone = true; self.tweens.add({ targets: [u.img, u.bar], alpha: 0, duration: 400 }); } return; }
        var moving = Math.abs(r.x - u.lx) > 0.001, left = r.x < u.lx;
        u.step = moving ? u.step + 1 : 0;
        var f = sheetFrame(self, r.k, moving ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 6);
        u.img.setFrame(f.frame).setFlipX(moving ? !left : u.img.flipX).setPosition(r.x * PX, r.y * PX).setDepth(r.y);
        u.img.setAlpha(r.stuck > 0 ? 0.7 : 1);
        u.bar.setPosition(r.x * PX - 9, r.y * PX - 24).setSize(18 * Math.max(0, r.hp / r.max), 3).setVisible(r.hp < r.max);
        u.lx = r.x;
      });
      b.defs.forEach(function (dd, i) { var img = self.defImgs[i]; if (img && R.defenses[dd.t].chases) img.setPosition(dd.x * PX, dd.y * PX); });
      b.loot.forEach(function (p, i) { var img = self.lootImgs[i]; if (img) img.setAlpha(0.3 + 0.7 * Math.max(0, p.left / p.n)); });
    }
    finish() {
      if (this.done) return;
      this.done = true;
      var self = this, s = F.session.state, b = this.b, used = {};
      b.moves.forEach(function (m) { used[m[1]] = (used[m[1]] || 0) + 1; });
      L.frUse(s, used);
      var prize = L.banditPrize(s, this.data0.bandit.key, b);
      if (F.world) { F.world.changed(); F.world.save(); }
      sfx(prize.stars ? 'fanfare' : 'nope');
      // the results card
      var h = this.hud, y0 = C.VIEW_H / 2 - 120, card = this.add.graphics();
      card.fillStyle(0x000000, 0.45).fillRect(0, 0, W, C.VIEW_H);
      card.fillStyle(0xfff6dc, 1).fillRoundedRect(24, y0, W - 48, 230, 18).lineStyle(3, 0x7a4d26, 1).strokeRoundedRect(24, y0, W - 48, 230, 18);
      h.add(card);
      var line = function (y, str, size, color) { var t = self.add.text(W / 2, y, str, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: size + 'px', color: color || INK, fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setResolution(F.R); h.add(t); return t; };
      line(y0 + 28, prize.stars ? 'Raid won!' : 'Raid over', 18);
      line(y0 + 66, '★★★'.slice(0, prize.stars) + '☆☆☆'.slice(prize.stars), 30, '#e9a91c');
      line(y0 + 108, Math.round(L.frShare(b) * 100) + '% of the loot taken', 12, '#7a5a3a');
      line(y0 + 136, '+' + prize.gold.toLocaleString('en-US') + ' Gold   ·   +' + prize.pts + ' Raid Points', 14, '#2f5a22');
      var btn = this.add.container(W / 2, y0 + 190), bg = this.add.graphics();
      bg.fillStyle(GREEN, 1).fillRoundedRect(-80, -20, 160, 40, 16);
      btn.add([bg, this.add.text(0, 0, 'Back to the farm', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
      var z = this.add.zone(0, 0, 160, 40).setInteractive({ useHandCursor: true });
      z.on('pointerup', function () { F.raidLeave(); });
      btn.add(z);
      h.add(btn);
      this.result = prize;
    }
  };
  // open and close the battle over the game (the farm waits underneath)
  F.raidBattle = function (data) {
    var g = F.game;
    if (!g.scene.getScene('FarmRaid')) g.scene.add('FarmRaid', F.RaidScene, false);
    if (g.scene.isActive('World')) g.scene.pause('World');
    if (g.scene.isActive('UI')) g.scene.sleep('UI');
    g.scene.start('FarmRaid', data);
    g.scene.bringToTop('FarmRaid');
  };
  F.raidLeave = function () {
    var g = F.game;
    g.scene.stop('FarmRaid');
    g.scene.resume('World');
    g.scene.wake('UI');
    F.raidOn = false;
    if (F.ui && F.ui.openRaidCamp) F.ui.openRaidCamp('practice');
  };
})(window.Farm = window.Farm || {});
