// Hunting places in the world and their pages (owner, 6 Nov 2026; data 00-zzzzzzzzz-places.js and each place's file,
// rules 01-logicZZZZ-places.js; each place's cave is the Lair's own code, 19zt-lair.js, with the place's data).
//  - Kanor's Jeep: by his Lodge in Pulag (and at each new place, to go back): a centred list of every hunting place,
//    open or not by your hunts, with "% explored" and Go. Pulag, Makiling and Magayon keep their walking trails.
//  - In a place: its person (3-4 lines of story that open as you go), its hidden chests (they show when you come near),
//    its tame animal (hold its food, sneak close while it is calm, Feed), and the door down to its cave.
//  - The companion you tamed follows you in the Wild Lands with its one skill; the others wait at Kanor's (his Pals tab).
//  - The Gear page (from the Bag and the Collection): four slots, what each piece takes off a charge.
//  - Kanor's Make tab: the trophies, then every place's set pieces. Medals: from the pause menu's farmer card, the
//    Collection, and a friend's card when you visit them. The boss of a cave leaves a chest once a day (up to 3 wait).
//  - The four first-time tours: the Jeep, Gear, Taming, Medals.
// Stand-in art: the jeep, a hidden chest's sparkle are drawn here; a place's people and creatures borrow others' rows
// until their own pictures are in (C.PLACES[id].npc.sheet, a creature's sheet).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, GOLD = 0x7a5a12, OK_GREEN = 0x2f5a22;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var FRAME_H = 252, FEET = 233; // a wild.png frame, and its feet line (as 19v-wild.js)

  // ---------- sheets and floors the places bring ----------
  WI.more.forEach(function (k) {
    var d = WI.animals[k];
    if (!d.sheet) return;
    F.SHEETS[d.sheet] = F.SHEETS.wild;
    F.SHEETS[d.sheet + 'shade'] = F.SHEETS.wildshade;
  });
  C.PLACE_ORDER.forEach(function (id) {
    var p = C.PLACES[id];
    if (p.npc && p.npc.sheet) F.SHEETS[p.npc.sheet] = F.SHEETS.people; // (9 frames like a villager's)
    if (p.dungeon && !p.legacy) F.FLOORS[p.dungeon.key] = p.dungeon.floors;
  });

  // ---------- new medals: a word on screen ----------
  // (L.medalCheck gives them; this says so, one after another, with the date kept in the save)
  P.medalNews = function (list) {
    var shown = (list || []).filter(function (m) { return m && L.placeShown(m.place); });
    if (!shown.length) return;
    this.time.delayedCall(2800, function () { // (after the hunt's own words; several at once in one line)
      if (!F.ui) return;
      sfx('fanfare');
      F.ui.toast('MEDAL! ' + shown[0].title + (shown.length > 1 ? ' and ' + (shown.length - 1) + ' more' : '') + '. See them under Medals.', 2800, GOLD);
    });
  };
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    var s = this.state, before = Object.assign({}, s.medals || {});
    wildDown.call(this, a);
    this.medalNews(Object.keys(s.medals || {}).filter(function (c) { return !before[c]; }).map(function (c) { return C.MEDAL_BY_CODE[c]; }));
    // a place's cave: its boss leaves the day's chest where it fell
    var lr = this.lair;
    if (lr && !lr.cfg.lair && a.def.boss && a.kind === lr.cfg.d.boss && a.mine && L.bossChests(s, lr.cfg.place) > 0) this.bossChestAt(a.x, a.y, true);
  };
  var medalsNow = function (w) { w.medalNews(L.medalCheck(w.state)); };

  // ---------- Kanor's Jeep ----------
  // drawn here (a stand-in): a little green jeep, side on, with a canvas top. Its own picture: props/kanor_jeep.
  var jeepTexture = function (w) {
    if (F.images && F.images['props/kanor_jeep']) return F.ensureTexture(w, 'props/kanor_jeep');
    if (w.textures.exists('fx-jeep')) return 'fx-jeep';
    var c = w.textures.createCanvas('fx-jeep', 360, 220), g = c.getContext(), line = '#2a1a0e';
    g.lineJoin = 'round';
    g.lineWidth = 7;
    g.strokeStyle = line;
    // the canvas top
    g.fillStyle = '#c9b48a';
    g.beginPath(); g.moveTo(70, 40); g.lineTo(250, 40); g.lineTo(262, 96); g.lineTo(64, 96); g.closePath(); g.fill(); g.stroke();
    // the body
    var body = g.createLinearGradient(0, 90, 0, 170);
    body.addColorStop(0, '#6f9a4a');
    body.addColorStop(1, '#3f6328');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(24, 100); g.lineTo(300, 100); g.lineTo(336, 128); g.lineTo(340, 168); g.lineTo(20, 168); g.closePath(); g.fill(); g.stroke();
    // windows, a lamp, a bumper
    g.fillStyle = '#bfe3f2';
    g.fillRect(86, 52, 64, 38); g.strokeRect(86, 52, 64, 38);
    g.fillRect(166, 52, 66, 38); g.strokeRect(166, 52, 66, 38);
    g.fillStyle = '#ffe48a';
    g.beginPath(); g.arc(328, 140, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#8a8a8a';
    g.fillRect(14, 160, 336, 12); g.strokeRect(14, 160, 336, 12);
    // wheels
    [86, 268].forEach(function (x) {
      g.fillStyle = '#2b2622';
      g.beginPath(); g.arc(x, 172, 34, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#a8a29a';
      g.beginPath(); g.arc(x, 172, 13, 0, Math.PI * 2); g.fill();
    });
    // KANOR on the side
    g.fillStyle = '#fff3c4';
    g.font = 'bold 30px "Trebuchet MS", Verdana, sans-serif';
    g.fillText('KANOR', 120, 144);
    c.refresh();
    return 'fx-jeep';
  };
  P.setupJeep = function () {
    var o = this.objects.filter(function (x) { return x.type === 'jeep'; })[0];
    if (!o || this.jeep) return;
    var x = (o.x0 + o.x1 + 1) / 2 * T, foot = (o.y1 + 1) * T;
    var key = jeepTexture(this), img = this.add.image(x, foot + 0.15 * T, key).setOrigin(0.5, 1);
    img.setDisplaySize(2.4 * T, key === 'fx-jeep' ? 1.47 * T : 2.4 * T * img.height / img.width); // (the owner's picture keeps its own shape)
    F.depthTo(img, DEPTH.actor + foot / 1e5);
    for (var y = o.y0; y <= o.y1; y++) for (var tx = o.x0; tx <= o.x1; tx++) this.blocked[this.idx(tx, y)] = true;
    var zone = this.add.zone(x, (o.y0 + o.y1 + 1) / 2 * T, (o.x1 - o.x0 + 1) * T - 24, (o.y1 - o.y0 + 1) * T - 24);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    this.jeep = { img: img, o: o };
  };

  U.openJeep = function (page) {
    var self = this, s = F.session.state, w = F.world, here = w ? L.placeOf(w.mapKey) : null;
    if (L.takeTip(s, 'jeep_tour') && !quiet()) { F.Host.save(s); return this.tour('jeep', function () { self.openJeep(page); }); }
    var rows = L.jeepPlaces(s).map(function (e) {
      var p = C.PLACES[e.id], at = here === e.id, icon = p.icon ? C.ICON[p.icon] : null;
      if (icon == null) icon = C.ICON.bow;
      return {
        icon: e.open ? icon : C.ICON.exclaim, name: e.name,
        desc: e.open ? e.pct + '% explored.' + (p.legacy ? '' : ' ' + L.placeHunts(s, e.id) + ' hunts here.') : 'Opens at ' + e.unlock + ' hunts. You have ' + s.wild.n + '.',
        buttons: [{ label: at ? 'Here' : e.open ? 'Go' : 'Locked', color: at || !e.open ? GREY : GREEN, cb: function () {
          if (at) return;
          if (!e.open) { sfx('nope'); return self.toast('Kanor: "' + e.unlock + ' hunts first. You have ' + s.wild.n + '."', 2600); }
          self.closeModal();
          sfx('door');
          if (w) w.travel(p.map, p.jeep);
        } }],
      };
    });
    this.listPanel({ title: "Kanor's Jeep", rows: rows, page: page || 0, reopen: function (t, p) { self.openJeep(p); },
      sub: function () { return 'Where to? Hunts so far: ' + s.wild.n + '.'; } });
  };

  // ---------- a place's person ----------
  var npcLook = function (p) {
    var n = p.npc;
    if (n.sheet && F.images && F.images[n.sheet]) return { key: n.sheet, frame: 0 };
    var i = C.VILLAGER_ORDER.indexOf(n.look);
    return { key: 'people', frame: Math.max(0, i) * 9 }; // (a stand-in: a villager's look)
  };
  P.setupPlaceNpc = function (p) {
    var n = p.npc, look = npcLook(p), x = (n.at[0] + 0.5) * T, y = (n.at[1] + 0.8) * T;
    F.ensureTexture(this, look.key);
    var img = this.add.sprite(x, y, look.key, look.frame).setOrigin(0.5, 0.83).setScale(2);
    F.depthTo(img, DEPTH.actor + y / 1e5);
    var tag = this.add.text(x, y - 1.75 * T, n.name, { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '64px', fontStyle: 'bold', color: '#fff6e0', stroke: '#3d2614', strokeThickness: 10 }).setOrigin(0.5, 1).setDepth(DEPTH.fx);
    var zone = this.add.zone(x, y - 0.15 * T, 0.6 * T, 0.35 * T);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    this.blocked[this.idx(n.at[0], n.at[1])] = true;
    this.placeNpc = { x: x, y: y, img: img, tag: tag, p: p, look: look };
  };
  P.talkPlaceNpc = function () {
    var s = this.state, n = this.placeNpc, p = n.p, r = L.talkNpc(s, p.id);
    sfx('talk');
    var f = this.feet();
    if (n.look.key === 'people' || n.look.key === p.npc.sheet) n.img.setFrame(n.look.frame + (Math.abs(f.x - n.x) > Math.abs(f.y - n.y) ? 6 : f.y < n.y ? 3 : 0)).setFlipX(f.x > n.x && Math.abs(f.x - n.x) > Math.abs(f.y - n.y));
    var next = p.npc.lines[r.i + 1];
    var gift = r.engineGift && r.gift ? '\n\nYou got ' + r.gift.map(function (x) { var it = C.ITEMS[x[0]]; return x[1] + ' ' + (x[1] > 1 && it.plural ? it.plural.charAt(0).toUpperCase() + it.plural.slice(1) : it.name); }).join(', ') + '.' + (r.left ? ' Some went to your basket at home.' : '') : '';
    F.ui.dialog(p.npc.name.toUpperCase() + '\n' + r.text + gift + (r.last || r.isNew ? '' : '\n\n(' + (next && next.hint ? next.hint : 'Come back after more hunting here.') + ')'));
    this.changed();
    medalsNow(this);
    this.save();
  };

  // ---------- hidden chests ----------
  P.setupPlaceChests = function (p) {
    var self = this, s = this.state;
    F.ensureTexture(this, 'props/chest');
    this.placeChests = p.chests.map(function (c, i) {
      if (L.placeChestOpened(s, p.id, i)) return null;
      var x = (c[0] + 0.5) * T, y = (c[1] + 0.85) * T;
      var img = self.add.image(x, y, 'props/chest').setOrigin(0.5, 1).setDisplaySize(0.9 * T, 0.9 * T).setAlpha(0);
      F.depthTo(img, DEPTH.actor + y / 1e5);
      return { i: i, tx: c[0], ty: c[1], x: x, y: y, img: img, seen: 0 };
    });
  };
  P.updatePlaceChests = function () {
    var f = this.feet(), self = this;
    (this.placeChests || []).forEach(function (c) {
      if (!c) return;
      var d = Math.hypot(c.x - f.x, c.y - f.y) / T, want = d < 3 ? 1 : d < 4.5 ? (4.5 - d) / 1.5 * 0.6 : 0; // (hidden: it shows as you come near)
      c.img.setAlpha(c.img.alpha + (want - c.img.alpha) * 0.15);
      if (want > 0.9 && !c.seen) { c.seen = 1; self.iconPop(c.x, c.y - T, C.ICON.sparkle); sfx('found'); }
    });
  };
  P.openPlaceChestAt = function (c) {
    var s = this.state, id = L.placeOf(this.mapKey), loot = L.openPlaceChest(s, id, c.i);
    if (!loot) return;
    var left = L.giveLoot(s, loot);
    sfx('coin');
    this.iconPop(c.x, c.y - T, C.ICON.chest);
    this.tweens.add({ targets: c.img, alpha: 0, scale: c.img.scale * 1.2, duration: 500, onComplete: function () { c.img.destroy(); } });
    this.placeChests[this.placeChests.indexOf(c)] = null;
    var p = C.PLACES[id];
    F.ui.toast('A hidden chest! ' + loot.map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; }).join(', ') + '. (' + L.placeChestsOpened(s, id) + ' of ' + p.chests.length + ')' + (left ? ' Some went to your basket at home.' : ''), 3000, OK_GREEN);
    this.changed();
    medalsNow(this);
    this.save();
  };

  // ---------- the boss's chest (a place's cave) ----------
  P.bossChestAt = function (x, y, fresh) {
    if (this.bossChest) return;
    F.ensureTexture(this, 'props/chest');
    var img = this.add.image(x, y, 'props/chest').setOrigin(0.5, 1).setDisplaySize(1.1 * T, 1.1 * T);
    F.depthTo(img, DEPTH.actor + y / 1e5);
    this.bossChest = { x: x, y: y, img: img };
    if (fresh) {
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 600, delay: 1400 });
      var n = L.bossChests(this.state, this.lair.cfg.place);
      this.time.delayedCall(2000, function () { if (F.ui) F.ui.toast('The boss left ' + (n > 1 ? n + ' chests' : 'a chest') + '! Open ' + (n > 1 ? 'them' : 'it') + ' before you go.', 3000, GOLD); });
    }
  };
  P.openBossChest = function () {
    var s = this.state, id = this.lair.cfg.place, n = L.bossChests(s, id), loot = L.openBossChests(s, id), b = this.bossChest;
    var left = L.giveLoot(s, loot);
    sfx('fanfare');
    this.iconPop(b.x, b.y - T, C.ICON.chest);
    b.img.destroy();
    this.bossChest = null;
    F.ui.toast((n > 1 ? n + ' chests: ' : 'The chest: ') + loot.map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; }).join(', ') + '.' + (left ? ' Some went to your basket at home.' : ''), 3200, GOLD);
    this.changed();
    this.save();
  };

  // ---------- taming ----------
  var tameNear = function (w) { // the tame animal you face, close enough to matter: { a, d (tiles) } or null
    var id = L.placeOf(w.mapKey), p = id && C.PLACES[id];
    if (!p || !p.tame || !w.wild) return null;
    var pt = w.front(0.6), best = null;
    w.wild.animals.forEach(function (a) {
      if (a.kind !== p.tame.kind) return;
      var d = Math.hypot(a.x - pt.x, (a.y - 0.2 * T) - pt.y) / T;
      if (d < 2.6 && (!best || d < best.d)) best = { a: a, d: d, p: p };
    });
    return best;
  };
  P.feedTameAnimal = function (n) {
    var self = this, s = this.state, p = n.p, a = n.a, r = L.feedTame(s, p.id);
    if (r === 'away') return F.ui.toast('It is wary of you for now. Come back a little later.', 2400);
    if (r === 'food' || r === 'tamed') return;
    sfx(r === 'tame' ? 'fanfare' : 'pick');
    this.iconPop(a.x, a.y - 1.1 * a.def.w * T, C.ICON.heart);
    var have = L.tameHearts(s, p.id), need = p.tame.feedings, name = a.def.name;
    if (r === 'fed') { a.mode = 'eat'; a.vx = a.vy = 0; a.t = 1600; F.ui.toast(name + ' ate it! Hearts ' + have + ' of ' + need + '.', 2000, OK_GREEN); }
    if (r === 'ran') {
      this.wildFlee(a, this.feet());
      F.ui.toast(name + ' ate it, then ran off! (' + have + ' of ' + need + ') It will be back in about ' + p.tame.back + ' minutes.', 3000);
      this.time.delayedCall(1800, function () { if (self.wild && self.wild.animals.indexOf(a) >= 0 && !self.wildFollowing()) self.wildGone(a); });
    }
    if (r === 'tame') {
      this.wildGone(a);
      F.ui.toast(name + ' is tamed! It comes along with you now. (Swap at Kanor\'s, Pals.)', 3400, GOLD);
      if (L.companion(s) === p.id) this.setupCompanion(a.x, a.y);
    }
    this.changed();
    medalsNow(this);
    this.save();
  };
  // Not for the Bow: the ring never marks it, an arrow only scares it.
  var wildTarget = P.wildTarget;
  P.wildTarget = function () {
    var a = wildTarget.call(this);
    if (!a || !a.def.tameOnly || !this.wild) return a;
    var all = this.wild.animals;
    this.wild.animals = all.filter(function (x) { return !x.def.tameOnly; });
    try { return wildTarget.call(this); } finally { this.wild.animals = all; }
  };
  var wildStruck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    if (!a.def.tameOnly) return wildStruck.call(this, a, friend);
    if (!this.wild.lead) this.wildFlee(a, friend || this.feet());
    if (!friend && F.ui) F.ui.toast('Not that one: it wants feeding, not hunting. Hold its favourite food.', 2600);
  };
  // its hearts over it while you are near
  P.updateTameHearts = function () {
    var id = L.placeOf(this.mapKey), p = id && C.PLACES[id], s = this.state, f = this.feet();
    if (!p || !p.tame || !this.wild) return;
    this.wild.animals.forEach(function (a) {
      if (a.kind !== p.tame.kind) return;
      var near = Math.hypot(a.x - f.x, a.y - f.y) / T < 4;
      if (!a.hearts) a.hearts = a.img.scene.add.text(a.x, a.y, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '110px', fontStyle: 'bold', color: '#e0405a', stroke: '#fff6e0', strokeThickness: 16 }).setOrigin(0.5, 1).setDepth(DEPTH.fx);
      a.hearts.setVisible(near).setText('♥ ' + L.tameHearts(s, id) + '/' + p.tame.feedings).setPosition(a.x, a.y - a.lift - (0.5 + a.def.w * 0.7) * a.size * T);
    });
  };
  var wildGone = P.wildGone;
  P.wildGone = function (a) {
    wildGone.call(this, a);
    if (a.hearts) a.hearts.destroy();
  };

  // ---------- the companion ----------
  var compFrame = function (def, kind, k) {
    if (def.sheet && F.images && F.images[def.sheet]) return { key: def.sheet, frame: (def.row || 0) * 12 + k };
    return { key: 'wild', frame: WI.order.indexOf(def.sheetRow || kind) * 12 + k };
  };
  P.setupCompanion = function (x, y) {
    var s = this.state, id = L.companion(s);
    if (this.comp || !id || !this.wild || F.session.visit && !F.session.visit.inTown) return;
    var kind = C.PLACES[id].tame.kind, def = WI.animals[kind], f = this.feet(), fr = compFrame(def, kind, 0);
    x = x != null ? x : f.x - C.COMPANION.behind * T;
    y = y != null ? y : f.y + 0.2 * T;
    var scale = def.w * T / def.px * 0.85;
    var img = this.add.image(x, y, F.ensureTexture(this, fr.key), fr.frame).setOrigin(0.5, FEET / FRAME_H).setScale(scale);
    if (def.tint && fr.key === 'wild') img.setTint(def.tint);
    var sh = this.add.image(x, y + 4, 'fx-wildshadow').setDisplaySize(def.w * 0.7 * T, def.w * 0.22 * T).setDepth(DEPTH.shadow);
    this.comp = { id: id, kind: kind, def: def, x: x, y: y, img: img, sh: sh, scale: scale, dir: 'side', flip: false, still: 0, target: null, spotted: false, arrowT: 0 };
  };
  P.updateCompanion = function (dt, time) {
    var c = this.comp, s = this.state, f = this.feet(), self = this, skill = C.COMPANION_SKILLS[C.PLACES[c.id].tame.skill], key = C.PLACES[c.id].tame.skill;
    // its skill
    if (key === 'fetch' && !c.target) {
      c.look = (c.look || 0) - dt;
      if (c.look <= 0) {
        c.look = skill.every;
        c.target = (this.wildDrops || []).filter(function (d) { return Math.hypot(d.x - f.x, d.y - f.y) < skill.reach * T && L.canAdd(s, d.id, 1); })[0] || null;
      }
    }
    if (c.target && this.wildDrops.indexOf(c.target) < 0) c.target = null; // (picked up by you, or the dog)
    if (key === 'spot' && !c.spotted && this.wild) {
      var rare = this.wild.animals.filter(function (a) { return a.def.rare; })[0];
      if (rare) { c.spotted = true; sfx('found'); this.iconPop(c.x, c.y - T, C.ICON.exclaim); F.ui.toast(c.def.name + ' spotted something rare: a ' + rare.def.name + '!', 3000, GOLD); }
    }
    if (key === 'arrows') {
      c.arrowT += dt;
      if (c.arrowT > skill.every) {
        c.arrowT = 0;
        if (Math.random() < skill.chance && L.canAdd(s, 'arrows', 1)) { L.addItem(s, 'arrows', 1); this.iconPop(c.x, c.y - T, C.ICON.arrows); sfx('pick'); this.changed(); }
      }
    }
    // where it goes: to the drop it fetches, or a little behind you
    var tx, ty, speed = C.SPEED, v = this.dirVec();
    if (c.target) { tx = c.target.x; ty = c.target.y; speed = C.SPEED * 1.5; } else { tx = f.x - v[0] * C.COMPANION.behind * T + v[1] * 0.4 * T; ty = f.y - v[1] * C.COMPANION.behind * T * 0.7 + 0.15 * T; }
    var dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy), k;
    if (!c.target && dist > C.COMPANION.run * T) speed = C.SPEED * 1.45;
    if (dist > 12 * T) { c.x = tx; c.y = ty; dist = 0; }
    if (dist > 0.3 * T) {
      var step = Math.min(dist, speed * dt / 1000 * Math.min(1, dist / (0.8 * T) + 0.35));
      c.x += dx / dist * step;
      c.y += dy / dist * step;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax > ay * 1.2) c.dir = 'side'; else if (ay > ax * 1.2) c.dir = dy > 0 ? 'down' : 'up';
      if (ax > 6) c.flip = dx > 0;
      var STEPS = [1, 0, 2, 0], base = c.dir === 'side' ? 6 : c.dir === 'up' ? 3 : 0;
      k = base + STEPS[Math.floor(time / 150) % 4];
      c.still = 0;
    } else {
      c.still += dt;
      if (c.target) { // picked up: into your bag
        var d = c.target;
        c.target = null;
        if (this.wildDrops.indexOf(d) >= 0 && L.canAdd(s, d.id, 1)) {
          L.addItem(s, d.id, 1);
          L.discover(s, d.id);
          this.iconPop(f.x, f.y - 1.2 * T, L.iconOf(s, d.id));
          d.img.destroy();
          d.sh.destroy();
          this.wildDrops.splice(this.wildDrops.indexOf(d), 1);
          sfx('pick');
          this.changed();
        }
      }
      k = c.still > 1200 ? 10 : c.dir === 'side' ? 6 : c.dir === 'up' ? 3 : 0;
    }
    var fr = compFrame(c.def, c.kind, k);
    c.img.setFrame(fr.frame).setFlipX(k >= 6 && c.flip).setPosition(c.x, c.y);
    c.sh.setPosition(c.x, c.y + 4);
    F.depthTo(c.img, DEPTH.actor + c.y / 1e5);
    void self;
  };

  // ---------- setting up a place ----------
  var create = P.create;
  P.create = function () {
    this.jeep = null;
    this.placeNpc = null;
    this.placeChests = null;
    this.comp = null;
    this.bossChest = null;
    create.call(this);
    var s = this.state, v = F.session.visit;
    if (v && !v.inTown) return;
    this.setupJeep();
    var id = L.placeOf(this.mapKey), p = id && C.PLACES[id];
    if (p && !p.legacy && this.mapKey === p.map) {
      if (p.npc) this.setupPlaceNpc(p);
      if (p.chests.length) this.setupPlaceChests(p);
    }
    if (this.wild && L.companion(s)) this.setupCompanion();
    // a place's cave, back on its boss floor with chests still waiting
    var lr = this.lair;
    if (lr && !lr.cfg.lair && lr.floor === lr.cfg.d.bossFloor && L.bossChests(s, lr.cfg.place) > 0) {
      var e = this.points.entrance, ex = e ? e.x : this.map.widthInPixels / 2, ey = e ? e.y : this.map.heightInPixels / 2;
      this.bossChestAt(ex + 1.5 * T, ey + 1.2 * T, false);
    }
    // the Taming tour, the first time you meet a place's tame animal
    var self = this;
    if (p && p.tame && !p.legacy && !L.tamed(s, id) && !L.tipSeen(s, 'tame_tour') && !quiet()) {
      var tries = 0, show = function () {
        if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'tame_tour')) return;
        if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, show);
        L.takeTip(s, 'tame_tour');
        F.Host.save(s);
        F.ui.tour('tame');
      };
      this.time.delayedCall(2200, show);
    }
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.busy || !this.sys.isActive()) return;
    var dt = Math.min(delta, 100);
    if (this.placeChests) this.updatePlaceChests();
    if (this.comp) this.updateCompanion(dt, time);
    if (this.wild) this.updateTameHearts();
    // a place's boss: stronger for each friend who comes down (the phone running the floor)
    var lr = this.lair;
    if (lr && !lr.cfg.lair && this.wild && !this.wild.lead) {
      var crew = 1 + Object.keys(this.remotes || {}).length;
      this.wild.animals.forEach(function (a) {
        if (!a.def.boss || !a.def.hpEach || !a.crew || crew <= a.crew) return;
        a.hp += a.def.hpEach * (crew - a.crew);
        a.max += a.def.hpEach * (crew - a.crew);
        a.crew = crew;
      });
    }
  };

  // Following a friend's floor: a boss that grew for the crew grows on this phone too (the Lair's only ever shrink).
  var wildHear = P.wildHear;
  P.wildHear = function (t, rows) {
    wildHear.call(this, t, rows);
    if (!this.lair || this.lair.cfg.lair || !this.wild) return;
    var list = this.wild.animals;
    (Array.isArray(rows) ? rows.slice(0, 60) : []).map(L.wildUnpack).forEach(function (r) {
      if (!r || !WI.animals[r.kind].hpEach) return;
      var a = list.filter(function (x) { return x.slot === r.slot; })[0];
      if (a && r.max > (a.max || 0)) { a.hp += r.max - (a.max || a.def.hp); a.max = r.max; a.hp = Math.min(a.hp, r.hp); }
    });
  };

  // What the action button does: the jeep, the person, a chest, Feed.
  var resolve = P.resolve;
  P.resolve = function () {
    var self = this, s = this.state, pt = this.front(0.7), t = this.facing();
    if (this.placeNpc && Math.hypot(pt.x - this.placeNpc.x, pt.y - this.placeNpc.y) < 0.9 * T) return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.talkPlaceNpc(); } };
    var chest = (this.placeChests || []).filter(function (c) { return c && c.img.alpha > 0.5 && ((c.tx === t.x && c.ty === t.y) || Math.hypot(pt.x - c.x, pt.y - (c.y - 0.3 * T)) < 0.75 * T); })[0];
    if (chest) return { label: 'Open', icon: C.ICON.chest, run: function () { self.openPlaceChestAt(chest); } };
    if (this.bossChest && Math.hypot(pt.x - this.bossChest.x, pt.y - (this.bossChest.y - 0.3 * T)) < 0.95 * T) return { label: 'Open', icon: C.ICON.chest, run: function () { self.openBossChest(); } };
    var n = tameNear(this), held = L.held(s);
    if (n && held && held.id === n.p.tame.food) {
      if (L.tamed(s, n.p.id)) return null;
      if (L.canFeed(s, n.p.id, n.a.mode, n.d)) return { label: 'Feed', icon: C.ITEMS[held.id].icon, run: function () { self.feedTameAnimal(n); } };
      var why = L.tameAway(s, n.p.id) ? 'It is wary of you for now. Come back a little later.' : n.a.mode === 'flee' ? 'It is scared. Sneak up slowly: push the joystick only a little.' : 'Come closer, slowly.';
      return { label: 'Feed', icon: C.ITEMS[held.id].icon, disabled: true, why: why };
    }
    return resolve.call(this);
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type === 'jeep' && this.jeep) return { label: 'Jeep', icon: C.ICON.crate, run: function () { F.ui.openJeep(); } };
    return extraObjectAction.call(this, o, held, def);
  };
  // (the jeep first, even with the Bow in your hands)
  var resolve2 = P.resolve;
  P.resolve = function () {
    if (this.jeep) {
      var t = this.facing(), o = this.jeep.o; // (not objectAt: the 'wild' zone under it comes first)
      if (t.x >= o.x0 && t.x <= o.x1 && t.y >= o.y0 && t.y <= o.y1) return this.extraObjectAction(o, null, null);
    }
    return resolve2.call(this);
  };
  // leaving a place's map: what the companion fetched is yours already; nothing to keep

  // ---------- the Gear page ----------
  var pieceText = function (g) {
    if (!g) return '';
    if (g.old) return g.desc;
    return g.less + ' less energy when something charges you.';
  };
  U.openGear = function (back) {
    var self = this, s = F.session.state;
    if (L.takeTip(s, 'gear_slots_tour') && !quiet()) { F.Host.save(s); return this.tour('gear_slots', function () { self.openGear(back); }); }
    var rows = C.GEAR_SLOTS.map(function (slot) {
      var id = L.worn(s, slot), g = id ? L.gearPiece(id) : null, have = L.piecesFor(s, slot).length;
      return { icon: g ? g.icon : C.ICON.bag, name: C.GEAR_SLOT_NAMES[slot] + ': ' + (g ? g.name : 'nothing'),
        desc: g ? pieceText(g) : have ? 'You have ' + have + ' to wear.' : 'Kanor makes pieces from what you hunt.',
        buttons: [{ label: 'Change', color: have ? GREEN : GREY, cb: function () {
          if (!have) return self.toast('Kanor makes gear in his Make tab, from what each place gives.', 2600);
          self.closeModal();
          self.openGearSlot(slot, back);
        } }] };
    });
    var set = L.wornSet(s), less = L.gearLess(s, null);
    this.listPanel({
      title: 'Gear', page: 0, rows: rows,
      corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
      sub: function () { return less ? 'A charge costs you ' + less + ' less' + (set ? ', ' + (less + C.GEAR_SET_BONUS) + ' less in ' + C.PLACES[set].name : '') + ' (never under 1).' : 'Wear gear to lose less energy when something charges you.'; },
      reopen: function () { self.openGear(back); },
    });
  };
  U.openGearSlot = function (slot, back, page) {
    var self = this, s = F.session.state, on = L.worn(s, slot);
    var rows = L.piecesFor(s, slot).map(function (id) {
      var g = L.gearPiece(id), wearing = on === id;
      return { icon: g.icon, name: g.name + (wearing ? ' (on)' : ''), desc: pieceText(g) + (g.place ? ' ' + C.PLACES[g.place].name + ' set.' : ''),
        buttons: [{ label: wearing ? 'Take off' : 'Wear', color: wearing ? GREY : GREEN, cb: function () {
          if (wearing) L.takeOff(s, slot); else L.wear(s, id);
          sfx('pick');
          if (F.Online && F.Online.retrack && F.Online.on) F.Online.retrack(); // (friends' phones go by your cloak and boots)
          F.session.dirty = true;
          if (F.world) F.world.save();
          self.closeModal();
          self.openGear(back);
        } }] };
    });
    this.listPanel({ title: C.GEAR_SLOT_NAMES[slot], page: page || 0, rows: rows,
      corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openGear(back); } },
      sub: function () { return 'One piece in each slot.'; }, reopen: function (t, p) { self.openGearSlot(slot, back, p); } });
  };
  // the Bag: a Gear button by its title
  var openInventory = U.openInventory;
  U.openInventory = function () {
    openInventory.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1], title = null;
    if (!m || F.session.visit) return;
    m.c.list.forEach(function (o) { if (o.type === 'Text' && o.text === 'Bag') title = o; });
    if (title) this.button(m.c, 66, title.y + 14, 72, 30, 'Gear', function () { self.closeModal(); self.openGear(function () { self.openInventory(); }); }, BLUE);
  };

  // ---------- Kanor: the Make tab (trophies, then the set pieces) and the Pals tab ----------
  var needLine = function (s, needs) { return needs.map(function (n) { return n[1] + ' ' + C.ITEMS[n[0]].name + ' (' + L.countItem(s, n[0]) + ')'; }).join(', '); };
  var openKanor = U.openKanor;
  U.openKanor = function (tab, page) {
    var self = this, s = F.session.state, list = this.listPanel, again = function () { self.closeModal(); self.openKanor(tab, page); };
    this.listPanel = function (o) {
      delete self.listPanel;
      o.tabs = [['buy', 'Buy'], ['sell', 'Sell'], ['job', 'Request'], ['make', 'Make'], ['pals', 'Pals']];
      if (tab === 'make') {
        C.PLACE_ORDER.filter(L.placeShown).forEach(function (id) {
          C.GEAR_SLOTS.forEach(function (slot) {
            var g = C.PLACE_GEAR[id + '_' + slot];
            if (!g) return;
            if (L.ownsPiece(s, g.id)) { o.rows.push({ icon: g.icon, name: g.name + ' (yours)', desc: C.GEAR_SLOT_NAMES[slot] + ': ' + g.less + ' less energy a charge. Wear it from Gear.' }); return; }
            var ok = s.gold >= g.gold && L.hasNeeds(s, g.needs);
            o.rows.push({ icon: g.icon, name: g.name, desc: C.GEAR_SLOT_NAMES[slot] + ', ' + g.less + ' less a charge. ' + needLine(s, g.needs) + '.',
              buttons: [{ label: fmt(g.gold) + 'G', color: ok ? GREEN : GREY, cb: function () {
                var r = L.makeGear(s, g.id);
                if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
                if (r === 'short') { sfx('nope'); return self.toast('You need ' + needLine(s, g.needs) + '. Hunt in ' + C.PLACES[id].name + '!', 3000); }
                if (r !== 'ok') return;
                sfx('coin');
                self.toast(g.name + '! ' + (L.worn(s, slot) === g.id ? 'You are wearing it.' : 'Wear it from Gear (in the Bag).'), 2600, OK_GREEN);
                F.world.changed();
                F.world.save();
                again();
              } }] });
          });
        });
      } else if (tab === 'pals') {
        var out = L.companion(s);
        o.tab = 'pals';
        o.rows = L.companions(s).map(function (id) {
          var t = C.PLACES[id].tame, def = WI.animals[t.kind], sk = C.COMPANION_SKILLS[t.skill], with_ = out === id;
          return { icon: C.ITEMS[t.food].icon, name: def.name + (with_ ? ' (with you)' : ''), desc: sk.name + ': ' + sk.text,
            buttons: [{ label: with_ ? 'Rest' : 'Take', color: with_ ? GREY : GREEN, cb: function () {
              L.setCompanion(s, with_ ? '' : id);
              sfx('pick');
              F.world.changed();
              F.world.save();
              if (F.world.comp) { F.world.comp.img.destroy(); F.world.comp.sh.destroy(); F.world.comp = null; }
              F.world.setupCompanion();
              again();
            } }] };
        });
        o.empty = 'Tame an animal in a hunting place: hold its favourite food and sneak up while it is calm. One comes along with you; the others wait here.';
        o.sub = function () { return 'One comes along with you at a time.'; };
      }
      return (list || U.listPanel).call(self, o);
    };
    try { return openKanor.call(this, tab === 'pals' ? 'make' : tab, page); } finally { delete this.listPanel; }
  };

  // ---------- Medals ----------
  // A page of medals in a grid (5 x 4), locked ones as dark shapes; tap one for its name and the day it was earned.
  var PER = 20;
  U.openMedals = function (st, who, back, page) {
    var self = this, mine = !who, s = st || F.session.state;
    if (mine && L.takeTip(F.session.state, 'medals_tour') && !quiet()) { F.Host.save(F.session.state); return this.tour('medals', function () { self.openMedals(st, who, back, page); }); }
    var list = L.medalList(), got = list.filter(function (m) { return L.hasMedal(s, m.code); }).length;
    page = Math.max(0, Math.min(Math.ceil(list.length / PER) - 1, page || 0));
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 530);
    c.add(this.txt(W / 2, 88, (who ? who + "'s" : 'My') + ' Medals', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); if (back) back(); }, 0xc0503a);
    c.add(this.txt(W / 2, 116, got + ' of ' + list.length + ' medals', 13, '#7a5a3a').setOrigin(0.5, 0));
    var cell = 62, cols = 5, x0 = (W - cols * cell) / 2, y0 = 146;
    var name = this.txt(W / 2, y0 + 4 * cell + 14, 'Tap a medal.', 15, INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    var when = this.txt(W / 2, y0 + 4 * cell + 40, '', 13, '#6a4a2a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add([name, when]);
    list.slice(page * PER, page * PER + PER).forEach(function (m, i) {
      var x = x0 + (i % cols) * cell, y = y0 + Math.floor(i / cols) * cell, has = L.hasMedal(s, m.code);
      self.baked(c, x + 3, y + 3, 'ui-medal' + (has ? 1 : 0) + (m.big ? 'b' : ''), cell - 6, cell - 6, function (g) {
        g.fillStyle(has ? (m.big ? 0xf2c95a : 0xe8cf98) : 0xcdb88e, 1).fillCircle((cell - 6) / 2, (cell - 6) / 2, (cell - 6) / 2);
        g.lineStyle(3, has ? 0xa8740c : 0x9a8a6a, 1).strokeCircle((cell - 6) / 2, (cell - 6) / 2, (cell - 6) / 2 - 2);
      });
      var icon = self.add.image(x + cell / 2, y + cell / 2, 'items', m.icon).setScale(0.3);
      if (!has) icon.setTint(0x000000).setAlpha(0.3); // (a silhouette: still to earn)
      c.add(icon);
      var z = self.add.zone(x + cell / 2, y + cell / 2, cell, cell).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () {
        sfx('pick');
        name.setText(has ? m.title : '???  ' + C.PLACES[m.place].name);
        when.setText(has ? 'Earned ' + L.formatDate(s.medals[m.code]) + ', ' + L.date(s.medals[m.code]).year + '.' : 'Not yet. ' + hint(m));
      });
      c.add(z);
    });
    var pages = Math.ceil(list.length / PER), ny = 572;
    if (pages > 1) {
      c.add(this.txt(W / 2, ny, (page + 1) + ' / ' + pages, 15, INK, { fontStyle: 'bold' }).setOrigin(0.5));
      if (page > 0) this.button(c, W / 2 - 90, ny, 90, 34, 'Back', function () { self.closeModal(); self.openMedals(st, who, back, page - 1); }, GREY);
      if (page < pages - 1) this.button(c, W / 2 + 90, ny, 90, 34, 'More', function () { self.closeModal(); self.openMedals(st, who, back, page + 1); }, BLUE);
    }
  };
  var hint = function (m) {
    var p = C.PLACES[m.place];
    return { first: 'Hunt in ' + p.name + '.', guard: 'Beat the guard of its cave.', boss: 'Beat the boss of its cave.', tame: 'Tame the animal of ' + p.name + '.',
      chests: 'Find every hidden chest in ' + p.name + '.', story: 'Hear the whole story of ' + (p.npc ? p.npc.name : 'its person') + '.', hunt: 'Hunt one in ' + p.name + '.',
      giant: 'Hunt a giant one.' }[m.kind] || '';
  };
  // the pause menu's farmer card: "Medals" under Rename, at the right of the birthday line
  var openPause = U.openPause;
  U.openPause = function () {
    openPause.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1], ren = null;
    if (!m || F.session.visit) return;
    var find = function (list) { list.forEach(function (o) { if (o.type === 'Text' && o.text === 'Rename') ren = o; if (o.list) find(o.list); }); };
    find(m.c.list);
    if (!ren) return;
    var y = ren.y + 23, x1 = ren.x, link = this.add.container(0, 0);
    // Town Rank's link (19zzzz-rank.js) sits at the right of the same line: Medals goes just left of its badge, and the
    // birthday line shrinks to fit before it (6 Nov 2026: the two were drawn one over the other)
    var rank = m.c.list.filter(function (o) { return o.name === 'rank-link'; })[0], dot = rank && rank.list.filter(function (o) { return o.type === 'Arc'; })[0];
    if (dot) { x1 = dot.x - 16; y = dot.y; }
    var t = this.txt(x1, y, 'Medals ' + L.medalCount(F.session.state), 12, '#2f6fae', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    if (dot) {
      var bday = null, findB = function (list) { list.forEach(function (o) { if (o.type === 'Text' && /^(Birthday:|Set your birthday)/.test(o.text)) bday = o; if (o.list) findB(o.list); }); };
      findB(m.c.list);
      var room = t.x - t.width - 10;
      if (bday && bday.x + bday.width * bday.scaleX > room) bday.setScale(Math.max(0.5, (room - bday.x) / bday.width));
    }
    var z = this.add.zone(x1 - t.width / 2, y, t.width + 10, 24).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { self.closeModal(); self.openMedals(null, null, function () { self.openPause(); }); });
    link.add([t, z]);
    link.name = 'medals-link';
    m.c.add(link);
  };
  // the Collection: Medals and Gear in its row of books
  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1];
    if (!m) return;
    this.collectionButton(m.c, 'medals', 'Medals', function () { self.closeModal(); self.openMedals(null, null, function () { self.openCollection(); }); }, GREY);
    this.collectionButton(m.c, 'gear', 'Gear', function () { self.closeModal(); self.openGear(function () { self.openCollection(); }); }, GREY);
  };
  // a friend's card (the player menu on a visit): their Hunter's Book and their Medals, side by side
  var bookRow = U.bookRow;
  U.bookRow = function (who) {
    var self = this, row = bookRow.call(this, who), st = F.session.visit && F.session.visit.state;
    if (!st) return row;
    row.name = "Hunter's Book & Medals";
    row.desc = 'What ' + who + ' hunted, and ' + L.medalCount(st) + ' medals.';
    row.buttons = [{ label: 'Book', cb: row.buttons[0].cb }, { label: 'Medals', color: GOLD, cb: function () {
      self.closeModal();
      self.openMedals(st, who, function () { self.playerMenu(F.session.visit.host, who); });
    } }];
    return row;
  };

  // ---------- the tours ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.jeep = {
    title: "KANOR'S JEEP",
    steps: [
      { text: "Kanor's Jeep by his Lodge takes you to every hunting place. More open as your hunts add up.",
        draw: function (ui, sc, move) { var b = icon(ui, sc, 136, 62, C.ICON.crate, 0.4); tw(ui, move, { targets: b, x: 156, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); words(ui, sc, 136, 112, 'Where to?', 14); } },
      { text: 'Each place shows how much of it you have explored: its animals, chests, story, guard and boss.',
        draw: function (ui, sc, move) { var t = words(ui, sc, 136, 66, '42% explored', 18, '#2f5a22'); tw(ui, move, { targets: t, scale: 1.1, duration: 500, yoyo: true, repeat: -1 }); } },
      { text: 'Every new place has its own Jeep stop to bring you back, and a cave of its own.',
        draw: function (ui, sc, move) { icon(ui, sc, 90, 66, C.ICON.crate, 0.32); var c = icon(ui, sc, 190, 66, C.ICON.chest, 0.32); tw(ui, move, { targets: c, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1 }); } },
    ],
  };
  F.TOURS.gear_slots = {
    title: 'GEAR',
    steps: [
      { text: 'Wear gear in four slots: Head, Body, Feet and Charm. Open Gear from the Bag.',
        draw: function (ui, sc, move) { ['gear_cloak', 'gear_boots', 'gear_charm', 'bag'].forEach(function (k, n) { var i = icon(ui, sc, 52 + n * 56, 66, C.ICON[k], 0.28); tw(ui, move, { targets: i, y: 58, duration: 420, delay: n * 150, yoyo: true, repeat: -1 }); }); } },
      { text: 'When something charges you, Head and Feet take 1 off the energy it costs, Body and Charm 2.',
        draw: function (ui, sc, move) { var t = words(ui, sc, 136, 66, '-10  ->  -4', 20, '#a8402a'); tw(ui, move, { targets: t, scale: 1.1, duration: 500, yoyo: true, repeat: -1 }); } },
      { text: "Kanor makes a set for each place from what it gives (his Make tab). All four of one set: 2 more off there.",
        draw: function (ui, sc, move) { icon(ui, sc, 100, 66, C.ICON.bow, 0.3); var g = icon(ui, sc, 180, 66, C.ICON.gear_cloak, 0.34); tw(ui, move, { targets: g, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1 }); } },
    ],
  };
  F.TOURS.tame = {
    title: 'TAMING',
    steps: [
      { text: 'Each hunting place has one animal to tame. Hold its favourite food in your hands.',
        draw: function (ui, sc, move) { var b = icon(ui, sc, 136, 62, C.ICON.berry, 0.4); tw(ui, move, { targets: b, y: 54, duration: 500, yoyo: true, repeat: -1 }); } },
      { text: 'Sneak up while it is calm (push the joystick only a little), face it close by and tap Feed.',
        draw: function (ui, sc, move) { var h = icon(ui, sc, 136, 62, C.ICON.heart, 0.36); tw(ui, move, { targets: h, scale: 0.42, duration: 400, yoyo: true, repeat: -1 }); } },
      { text: 'Each feeding fills its hearts. It may run off: it comes back later. Fill them all and it is yours.',
        draw: function (ui, sc) { words(ui, sc, 136, 66, '♥ ♥ ♥ ♡ ♡', 22, '#d2394a'); } },
      { text: 'It follows you when you hunt, with a skill of its own. Swap who comes along at Kanor\'s, Pals.',
        draw: function (ui, sc, move) { var s = icon(ui, sc, 136, 66, C.ICON.star, 0.34); tw(ui, move, { targets: s, angle: 360, duration: 2400, repeat: -1 }); } },
    ],
  };
  F.TOURS.medals = {
    title: 'MEDALS',
    steps: [
      { text: 'Medals for what you do in each place: the first hunt, each animal, a giant one, the tame, the chests, the story.',
        draw: function (ui, sc, move) { var r = icon(ui, sc, 136, 62, C.ICON.ribbon, 0.42); tw(ui, move, { targets: r, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1 }); } },
      { text: 'Beat a cave\'s guard and its boss for the big ones. Dark ones are still to earn.',
        draw: function (ui, sc) { icon(ui, sc, 100, 66, C.ICON.star, 0.34); icon(ui, sc, 176, 66, C.ICON.star, 0.34).setTint(0x000000).setAlpha(0.3); } },
      { text: 'Friends see your medals when they tap More on your farm. Show off!',
        draw: function (ui, sc, move) { var h = icon(ui, sc, 136, 62, C.ICON.heart, 0.34); tw(ui, move, { targets: h, scale: 0.4, duration: 400, yoyo: true, repeat: -1 }); } },
    ],
  };
})(window.Farm = window.Farm || {});
