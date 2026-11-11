// The look of the top bar, the side buttons (Quests, Online, Decorate) and the list panels they open (owner, 26 Oct
// 2026: "polish the header, the buttons and the panels"). The same objects the rest of the UI reads (timeText,
// goldText, energyBar, questBtn, onlineBtn, decorBtn, listPanel/listRow) in a mobile farm-game style: cream chips
// with their icon on the edge, round icon buttons with a label, ribbon titles, a sliding tab switch, progress bars.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, INK = K.INK, SLOT = K.SLOT, ICON = K.ICON;
  var D = F.UI_DRAW, rrect = D.rrect, circle = D.circle, vgrad = D.vgrad, shade = D.shade;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GOLD = 0xe9a91c, RED = 0xc0503a, WOOD = 0xa0703e;
  var EDGE = '#5a3a1e';
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // ---------- drawing ----------
  // A cream chip with a dark edge, a soft shadow and a gloss on top.
  function chip(g, x, y, w, h) {
    rrect(g, x, y + 3, w, h, h / 2);
    g.fillStyle = 'rgba(30,16,6,0.35)';
    g.fill();
    rrect(g, x, y, w, h, h / 2);
    g.fillStyle = EDGE;
    g.fill();
    rrect(g, x + 2, y + 2, w - 4, h - 4, h / 2 - 2);
    g.fillStyle = vgrad(g, y + 2, y + h - 2, '#fffaea', '#efd6a0');
    g.fill();
    rrect(g, x + 8, y + 4, w - 16, (h - 8) / 2, (h - 8) / 4);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fill();
  }
  // A round badge: dark edge, a coloured face lit from the top, and a gloss.
  function badge(g, cx, cy, r, top, bottom) {
    circle(g, cx, cy + 2.5, r);
    g.fillStyle = 'rgba(30,16,6,0.35)';
    g.fill();
    circle(g, cx, cy, r);
    g.fillStyle = EDGE;
    g.fill();
    circle(g, cx, cy, r - 2.5);
    g.fillStyle = vgrad(g, cy - r, cy + r, top, bottom);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy - r * 0.45, r * 0.58, r * 0.26, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.fill();
  }
  function line(g, pts, width, color) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineWidth = width;
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = color;
    g.stroke();
  }

  // The pictures on the small round buttons: drawn, so they stay crisp at any size. The four big ones on the right are
  // painted (owner, 2 Nov 2026; assets/sidebtn, tools/art/sidebuttons-import.js).
  var PAINTED = { quests: 0, online: 1, decorate: 2, chat: 3 };
  var GLYPH = {
    // a minus and a plus (the stall's how-many, 8 Nov 2026)
    minus: function (g, cx, cy, r) {
      var a = r * 0.4;
      line(g, [[cx - a, cy], [cx + a, cy]], 5.5, EDGE);
      line(g, [[cx - a, cy], [cx + a, cy]], 3, '#ffffff');
    },
    plus: function (g, cx, cy, r) {
      var a = r * 0.4;
      line(g, [[cx - a, cy], [cx + a, cy]], 5.5, EDGE);
      line(g, [[cx, cy - a], [cx, cy + a]], 5.5, EDGE);
      line(g, [[cx - a, cy], [cx + a, cy]], 3, '#ffffff');
      line(g, [[cx, cy - a], [cx, cy + a]], 3, '#ffffff');
    },
    // the Decorate panel's (owner, 8 Nov 2026: "Lets improve this panel"): a quarter-turn arrow, into the box, a tick
    turn: function (g, cx, cy, r) { // a circular arrow going round (clockwise), its head a filled triangle
      var a = r * 0.44, s = -Math.PI / 2 + 0.6, e = s + Math.PI * 2 - 1.25; // (the gap at the top, the head pointing round into it)
      g.lineCap = 'round';
      [[5.5, EDGE], [3, '#ffffff']].forEach(function (st) {
        g.beginPath();
        g.arc(cx, cy, a, s, e, false);
        g.lineWidth = st[0];
        g.strokeStyle = st[1];
        g.stroke();
      });
      var px = cx + a * Math.cos(e), py = cy + a * Math.sin(e), tx = -Math.sin(e), ty = Math.cos(e), nx = Math.cos(e), ny = Math.sin(e), h = r * 0.34, w = r * 0.27;
      g.beginPath();
      g.moveTo(px + tx * h, py + ty * h);
      g.lineTo(px + nx * w - tx * 2, py + ny * w - ty * 2);
      g.lineTo(px - nx * w - tx * 2, py - ny * w - ty * 2);
      g.closePath();
      g.lineJoin = 'round';
      g.lineWidth = 2.6;
      g.strokeStyle = EDGE;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fill();
    },
    store: function (g, cx, cy, r) { // a storage box with its lid on
      var a = r * 0.44;
      rrect(g, cx - a, cy - a * 0.3, a * 2, a * 1.3, 3);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 2.2;
      g.strokeStyle = EDGE;
      g.stroke();
      rrect(g, cx - a * 1.15, cy - a * 0.78, a * 2.3, a * 0.52, 3);
      g.fillStyle = '#fff3d6';
      g.fill();
      g.stroke();
      rrect(g, cx - a * 0.38, cy + a * 0.08, a * 0.76, a * 0.22, 2); // its handle
      g.fillStyle = EDGE;
      g.fill();
    },
    tick: function (g, cx, cy, r) {
      var a = r * 0.42;
      line(g, [[cx - a, cy], [cx - a * 0.25, cy + a * 0.7], [cx + a, cy - a * 0.6]], 6, EDGE);
      line(g, [[cx - a, cy], [cx - a * 0.25, cy + a * 0.7], [cx + a, cy - a * 0.6]], 3.2, '#ffffff');
    },
    // an ×
    close: function (g, cx, cy, r) {
      var a = r * 0.36;
      line(g, [[cx - a, cy - a], [cx + a, cy + a]], 5, EDGE);
      line(g, [[cx + a, cy - a], [cx - a, cy + a]], 5, EDGE);
      line(g, [[cx - a, cy - a], [cx + a, cy + a]], 2.6, '#ffffff');
      line(g, [[cx + a, cy - a], [cx - a, cy + a]], 2.6, '#ffffff');
    },
    // the pause bars
    pause: function (g, cx, cy, r) {
      [-1, 1].forEach(function (k) {
        rrect(g, cx + k * r * 0.26 - 2.5, cy - r * 0.38, 5, r * 0.76, 2);
        g.fillStyle = '#fff6dc';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = EDGE;
        g.stroke();
      });
    },
    left: function (g, cx, cy, r) { line(g, [[cx + r * 0.18, cy - r * 0.34], [cx - r * 0.2, cy], [cx + r * 0.18, cy + r * 0.34]], 3.4, '#ffffff'); },
    right: function (g, cx, cy, r) { line(g, [[cx - r * 0.18, cy - r * 0.34], [cx + r * 0.2, cy], [cx - r * 0.18, cy + r * 0.34]], 3.4, '#ffffff'); },
  };

  // A round glossy button with a drawn picture and (optionally) a label under it.
  U.roundButton = function (parent, x, y, r, color, glyph, label, onTap) {
    var c = this.add.container(x, y);
    if (PAINTED[glyph] != null) {
      var size = (r - 2) * 2;
      c.add(this.add.circle(0, 2, size / 2, 0x1e1006, 0.35));
      c.add(this.add.image(0, 0, F.ensureTexture(this, 'sidebtn'), PAINTED[glyph]).setDisplaySize(size, size));
    } else {
      c.add(this.canvasImg(null, -r - 4, -r - 4, 'ui-round-' + glyph + '-' + r + '-' + color, r * 2 + 8, r * 2 + 11, function (g) {
        var cx = r + 4, cy = r + 4;
        badge(g, cx, cy, r, shade(color, 0.35), shade(color, -0.12));
        g.save();
        GLYPH[glyph](g, cx, cy, r);
        g.restore();
      }));
    }
    if (label) c.add(this.txt(0, r + 8, label, 11, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    var z = this.add.zone(0, label ? 5 : 0, r * 2 + 10, r * 2 + (label ? 22 : 8)).setInteractive({ useHandCursor: true });
    z.on('pointerdown', function () { c.setScale(0.9); });
    z.on('pointerout', function () { c.setScale(1); });
    F.tapOn(z, function () { c.setScale(1); onTap(); });
    c.add(z);
    if (parent) parent.add(c);
    return c;
  };

  // ---------- the top bar ----------
  var HUD = { y: 9, h: 40 };
  var BAR = { x: 168, w: 54, h: 12 }; // the energy bar inside its chip
  var WEATHER_X = 98, CHIP_END = 132; // the clock chip's second line: the date, then the weather

  U.buildHud = function () {
    var self = this, y = HUD.y, h = HUD.h, cy = y + h / 2;
    this.canvasImg(null, 0, 0, 'ui-hud3', W, 64, function (g) {
      g.fillStyle = vgrad(g, 0, 64, 'rgba(24,14,6,0.55)', 'rgba(24,14,6,0)');
      g.fillRect(0, 0, W, 64);
      chip(g, 24, y, 112, h); // clock
      chip(g, 150, y, 80, h); // energy
      chip(g, 248, y, 72, h); // gold: room for 99,999 next to the coin
      badge(g, 26, cy, 20, '#fffaea', '#e8cf98'); // the season, its icon on top
      badge(g, 150, cy, 17, '#ffe680', '#e9a91c'); // energy
      rrect(g, BAR.x - 2, cy - BAR.h / 2 - 2, BAR.w + 4, BAR.h + 4, (BAR.h + 4) / 2);
      g.fillStyle = '#4a2c14';
      g.fill();
      rrect(g, BAR.x, cy - BAR.h / 2, BAR.w, BAR.h, BAR.h / 2);
      g.fillStyle = vgrad(g, cy - BAR.h / 2, cy + BAR.h / 2, '#2a170a', '#5a3a1e');
      g.fill();
    });
    // the season, the time, and a second line with the date and the weather
    this.seasonIcon = this.add.image(26, cy, 'items', C.SEASONS[0].icon).setScale(0.21);
    this.timeText = this.txt(49, y + 14, '', 17, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.dayText = this.txt(49, y + 30, '', 11, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.weatherIcon = this.add.image(WEATHER_X, y + 30, 'items', 0).setScale(0.13);
    // the weather's name (and "Mine B3" underground) shows only in the mine, where the date gives way to it
    this.weatherText = this.txt(49, y + 30, '', 11, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    // energy: a bolt on the badge, a thick bar and the number on it
    var fill = function (key, top, bottom) {
      return self.bakeCanvas(key, BAR.w, BAR.h, function (g) {
        rrect(g, 0, 0, BAR.w, BAR.h, BAR.h / 2);
        g.fillStyle = vgrad(g, 0, BAR.h, top, bottom);
        g.fill();
        rrect(g, 3, 2, BAR.w - 6, 3, 1.5);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fill();
      });
    };
    this.energyFills = [fill('ui-energy3-red', '#ff8a7a', '#d93a3a'), fill('ui-energy3-yellow', '#ffe680', '#e9a91c'), fill('ui-energy3-green', '#a6ef7c', '#3fa535')];
    this.energyBar = this.add.image(BAR.x, cy - BAR.h / 2, this.energyFills[2]).setOrigin(0).setScale(1 / F.R);
    this.add.image(150, cy, 'items', C.ICON.bolt).setScale(0.25);
    this.energyText = this.txt(BAR.x + BAR.w / 2, cy, '', 10, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    // tap the energy chip: when it is full, and where to get more
    var ez = this.add.zone(150 + 38, cy, 96, h + 8).setInteractive({ useHandCursor: true });
    F.tapOn(ez, function () { if (!self.modals.length) self.openEnergy(); });
    // gold: the coin on the chip's edge, the amount right-aligned
    this.add.image(250, cy, 'items', C.ICON.coin).setScale(0.32);
    this.goldText = this.txt(313, cy, '', 15, '#7a4d12', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    // pause: a round wooden button
    this.pauseBtn = this.roundButton(null, 340, cy, 17, WOOD, 'pause', null, function () { if (!self.modals.length) self.openPause(); });
  };

  // Energy: now, when the next point comes, when it is full, and the ways to get more.
  U.openEnergy = function () {
    var s = F.session.state, max = L.maxEnergy(s), now = L.nowMin(), e = Math.floor(s.energy);
    var fmt = function (mins) { mins = Math.max(1, Math.ceil(mins)); var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + 'h ' : '') + (m || !h ? m + 'm' : '').trim(); };
    var head = e >= max ? 'Your energy is full!' : 'Full in ' + fmt((max - e - 1) * L.regenEvery(s) + (L.regenEvery(s) - (now - s.regen))) + '.';
    // (a refill is offered even when full: it adds its whole amount on top, 5 Nov 2026)
    var fits = !L.refillFits || L.refillFits(s, C.FREE_REFILL || 100); // (a free refill: up to 1,000)
    var self = this, buy = L.canRefill && L.canRefill() && (!L.refillFits || L.refillFits(s, 100, 'coins')), free = fits ? L.refillsLeft(s) : 0;
    var useFree = function () {
      var gain = L.useFreeRefill(s);
      F.Host.save(s);
      F.bus.emit('hud');
      self.toast('+' + gain + ' energy. ' + L.refillsLeft(s) + ' free ' + (L.refillsLeft(s) === 1 ? 'refill' : 'refills') + ' left.', 2400, 0x2f5a22);
    };
    this.dialog('Energy ' + e + ' / ' + max, free ? [{ label: 'OK', color: 0xa08a68 }, { label: 'Free refill (' + free + ')', cb: useFree }] : buy ? [{ label: 'OK', color: 0xa08a68 }, { label: 'Refill', cb: function () { self.openRefill(); } }] : null, {
      rows: [
        [C.ICON.bolt, head],
        [C.ICON.moon, 'It comes back by itself: 1 point every ' + C.ENERGY_EVERY + ' minutes, even while the game is closed.'],
        [C.ICON.carrot, 'Eat crops, eggs, fish or dishes from your bag: tap the button with nothing in front of you.'],
        [C.ICON.lunch, 'Rosa\'s Inn and Ivy\'s Clinic in town sell food and tonics. A kitchen lets you cook big meals.'],
        [C.ICON.sparkle, 'A lovelier home raises your max energy (Home Beauty).'],
        [C.ICON.heart, 'Planting, harvesting, selling, talking and visiting farms cost no energy.'],
      ].concat(L.canRefill && L.canRefill() ? [[C.ICON.power_up, 'In a hurry? Refill with Selebox Coins or Stars.']] : []),
    });
  };

  // Fits a text into a width (shrinks it, never grows it).
  var fit = function (t, w) { t.setScale(1); if (t.width > w) t.setScale(w / t.width); };

  var refresh = U.refresh;
  U.refresh = function () {
    refresh.call(this);
    var s = F.session.state, pct = Math.max(0, Math.min(1, s.energy / L.maxEnergy(s)));
    this.energyBar.setCrop(0, 0, Math.max(BAR.h, BAR.w * pct) * F.R, BAR.h * F.R);
    var mine = !!(F.world && F.world.mapKey === 'mine');
    this.dayText.setVisible(!mine);
    this.weatherIcon.setVisible(!mine).setX(Math.min(CHIP_END - 12, 49 + this.dayText.width + 10));
    this.weatherText.setVisible(mine);
    fit(this.dayText, CHIP_END - 12 - 49 - 10);
    fit(this.weatherText, CHIP_END - 6 - 49);
  };

  // Gold as a plain number with thousands commas (the coin says what it is); 100,000 and up as "123k".
  var money = function (n) { return n < 100000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : Math.floor(n / 1000) + 'k'; };
  U.showGold = function (gold) {
    var self = this, set = function (n) { self.goldText.setText(money(n)); fit(self.goldText, 313 - 272); };
    if (this.goldShown == null || gold <= this.goldShown) {
      if (this.goldTween) this.goldTween.remove();
      this.goldShown = gold;
      this.goldTarget = null; // (else a later roll back up to the last target stops short: 28 Oct, stuck on 300 after a visit)
      set(gold);
      return;
    }
    if (this.goldTarget === gold) return;
    this.goldTarget = gold;
    if (this.goldTween) this.goldTween.remove();
    var from = this.goldShown;
    this.goldTween = this.tweens.addCounter({
      from: from, to: gold, duration: Math.min(1200, 300 + (gold - from) / 2), ease: 'Quad.out',
      onUpdate: function (tw) { self.goldShown = Math.round(tw.getValue()); set(self.goldShown); },
      onComplete: function () { self.goldShown = gold; set(gold); },
    });
    this.tweens.add({ targets: this.goldText, scaleX: { from: this.goldText.scaleX * 1.18, to: this.goldText.scaleX }, scaleY: { from: 1.18, to: 1 }, duration: 300 });
  };

  // ---------- the side buttons ----------
  // owner, 26 Oct: Decorate sits right under Online (one column at the top right)
  var SIDE = { x: W - 30, r: 22, quests: 134, online: 196, decorate: 258, chat: 320 }; // (chat: 19m-chat.js, owner 27 Oct: an icon under Decorate)
  U.SIDE = SIDE;

  var create = U.create;
  U.create = function () {
    create.call(this);
    var self = this;
    this.questBtn.removeAll(true);
    this.roundButton(this.questBtn, SIDE.x, SIDE.quests, SIDE.r, GOLD, 'quests', 'Quests', function () { self.openQuests('daily', 0); });
    this.questBadge.setPosition(SIDE.x + 15, SIDE.quests - 17);
    this.questBadgeText.setPosition(SIDE.x + 15, SIDE.quests - 17);
    this.onlineBtn.removeAll(true);
    this.roundButton(this.onlineBtn, SIDE.x, SIDE.online, SIDE.r, BLUE, 'online', 'Online', function () { self.openOnline(F.GameServer && F.GameServer.pubLive && F.GameServer.pubLive() ? 'here' : 'visit', 0); }); // (a hunting place: who is here first)
    var decor = function () {
      if (!self.decorBtn) return;
      self.decorBtn.removeAll(true);
      self.decorBtn.setY(0); // (19d-home.js put it near the bottom, by the action button)
      self.roundButton(self.decorBtn, SIDE.x, SIDE.decorate, SIDE.r, WOOD, 'decorate', 'Decorate', function () { self.openDecor(); });
    };
    F.bus.on('map', decor);
    this.events.once('shutdown', function () { F.bus.off('map', decor); });
    decor();
  };

  // While visiting a farm its bar sits where Quests is: Quests waits until you are home.
  var checkQuests = U.checkQuests;
  U.checkQuests = function () {
    checkQuests.call(this);
    var away = !!(F.session && F.session.visit), n = L.questsWaiting(F.session.state);
    if (away) this.questBtn.setVisible(false);
    this.questBadge.setVisible(n > 0 && !away && this.questBtn.visible);
    this.questBadgeText.setVisible(n > 0 && !away && this.questBtn.visible);
  };

  // ---------- the list panels (quests, online, shops...) ----------
  var ROW_H = 74, ROW_STEP = 80;

  U.closeButton = function (parent, x, y, onTap) {
    return this.roundButton(parent, x, y, 15, RED, 'close', null, onTap);
  };

  // Reached from the base listPanel (16-panels.js), so the wrappers added by later files (the Woodshop's house row and
  // Outdoor tab) still run first.
  // o.rowH: taller cards for a panel whose rows say more (What's new); fewer of them on a page.
  // Which style a panel gets (owner, 8 Nov 2026: tiles and filters "the default style" for what you browse by picture,
  // slim rows that scroll "for quest and similar"): set here by its title (and tab), unless the panel says itself.
  var TILE_PANELS = ["Lily's Seed Stand", "Marco's Wagon", "Owen's Animal Clinic", "Poppy's Flowers", 'Tailor Shop', 'Sell at your stall', 'Storage',
    'Yard Storage', 'Kitchen', 'Craft it yourself', 'Gear', 'Breeds book', 'Wallpaper', 'Floor'];
  U.panelStyle = function (o) {
    if (o.slim != null || o.tiles != null || o.paged) return;
    var t = String(o.title || '');
    if (/^What's new/.test(t)) return; // (its long notes keep their tall cards and pages)
    if (TILE_PANELS.indexOf(t) >= 0 || / Furniture$/.test(t) || o.tab === 'outdoor' || (t === "Mira's Woodshop" && o.tab === 'furniture')) o.tiles = true; // (Mira's outdoor catalog and its sections)
    else o.slim = true;
  };
  U.lookListPanel = function (o) {
    this.panelStyle(o);
    var h0 = ROW_H, s0 = ROW_STEP;
    if (o.rowH) { ROW_H = o.rowH; ROW_STEP = o.rowH + 6; }
    try { return listPanel.call(this, o); } finally { ROW_H = h0; ROW_STEP = s0; }
  };
  var listPanel = function (o) {
    if (o.tiles) return tilePanel.call(this, o);
    if (o.slim) return slimPanel.call(this, o);
    var self = this, c = this.openModal();
    // the list's layout first, so a short list gets a shorter panel (a paged one keeps the full height)
    var rows = o.rows, page = o.page || 0, per = rows.length * ROW_STEP > 400 ? Math.floor(320 / ROW_STEP) : Math.floor(400 / ROW_STEP);
    var pages = Math.max(1, Math.ceil(rows.length / per)), shown = rows.slice(page * per, page * per + per);
    var y0 = o.tabs ? 178 : 140;
    // an empty list's words: the panel grows to hold them (owner's screenshot, 7 Nov 2026: Kanor's Pals ran out past it)
    var empty = !rows.length && o.empty ? this.txt(W / 2, y0 + 40, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0) : null;
    var bottom = pages > 1 ? y0 + per * ROW_STEP + 48 : y0 + shown.length * ROW_STEP + (shown.length ? 10 : empty ? Math.max(110, 40 + empty.height + 30) : 110);
    this.panelImg(c, 12, 76, W - 24, Math.max(220, Math.min(530, bottom - 76)));
    var title = this.txt(W / 2, 79, o.title, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    fit(title, W - 150);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, Math.max(150, title.displayWidth + 54)));
    c.add(title);
    this.closeButton(c, W - 26, 84, function () { self.closeModal(); });
    // a small pill at the top left: Talk to the shop's keeper, or the panel's own (Back, Events: o.corner)
    var corner = o.corner || (o.talk ? { label: 'Talk', color: BLUE, cb: function () {
      var r = L.talk(F.session.state, o.talk);
      if (L.hello(F.session.state, o.talk)) F.world.progress('meet');
      sfx('talk');
      F.world.changed();
      self.say(o.talk, C.VILLAGERS[o.talk].name, r.line);
    } } : null);
    if (corner) this.pillButton(c, 58, 113, 64, 26, corner.label, corner.cb, corner.color || GREY_BTN);
    // one line under the ribbon (two when there are no tabs), shrunk to fit rather than cut off
    var subW = corner ? 200 : W - 110;
    var sub = this.txt(corner ? W / 2 + 30 : W / 2, 104, '', 13, '#6a4a2a', { align: 'center', wordWrap: o.tabs ? null : { width: subW } }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () {
      sub.setText(o.sub ? o.sub() : '').setScale(1);
      if (o.tabs && sub.width > subW) sub.setScale(subW / sub.width);
      if (!o.tabs && sub.height > 34) sub.setScale(34 / sub.height); // two lines at most, above the first row
    };
    showSub();
    o.refresh = showSub;
    if (o.tabs) this.tabSwitch(c, 152, o.tabs, o.tab, function (key) { self.swapTo(function () { o.reopen(key, 0); }); });
    shown.forEach(function (row, i) { self.listRow(c, y0 + i * ROW_STEP, row); });
    if (empty) c.add(empty);
    if (pages > 1) this.pager(c, y0 + per * ROW_STEP + 18, page, pages, function (p) { self.swapTo(function () { o.reopen(o.tab, p); }); });
    return o;
  };
  var GREY_BTN = 0xa08a68;

  // ---------- slim rows that scroll (owner, 8 Nov 2026: "use A for quest and similar"; only 4 tall rows fitted a page) ----------
  // o.slim: the same rows (icon, name, tag, progress, reward, desc, buttons, done), each a 56 px card, every one of them
  // in the panel at once, scrolled with a finger (or the mouse wheel), no pages. A row out of view takes no taps.
  var SLIM = { h: 56, step: 60 };
  var slimPanel = function (o) {
    var self = this, c = this.openModal(), rows = o.rows;
    var y0 = o.tabs ? 178 : 140, full = y0 + rows.length * SLIM.step + 10;
    var empty = !rows.length && o.empty ? this.txt(W / 2, y0 + 40, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0) : null;
    var ph = Math.max(220, Math.min(530, (empty ? y0 + 40 + empty.height + 40 : full) - 76));
    this.panelImg(c, 12, 76, W - 24, ph);
    var title = this.txt(W / 2, 79, o.title, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    fit(title, W - 150);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, Math.max(150, title.displayWidth + 54)));
    c.add(title);
    this.closeButton(c, W - 26, 84, function () { self.closeModal(); });
    if (o.corner) this.pillButton(c, 58, 113, 64, 26, o.corner.label, o.corner.cb, o.corner.color || GREY_BTN);
    var subW = o.corner ? 200 : W - 110, sub = this.txt(o.corner ? W / 2 + 30 : W / 2, 104, '', 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () { sub.setText(o.sub ? o.sub() : '').setScale(1); if (sub.width > subW) sub.setScale(subW / sub.width); };
    showSub();
    o.refresh = showSub;
    if (o.tabs) this.tabSwitch(c, 152, o.tabs, o.tab, function (key) { self.swapTo(function () { o.reopen(key, 0); }); });
    if (empty) { c.add(empty); return o; }
    // the rows: one container, masked to the panel, moved by a finger
    var top = y0 - 4, bottom = 76 + ph - 12, list = this.add.container(0, 0);
    // the rows in view first, the rest a few a frame after (owner, 11 Nov 2026: "online menu, it feels like a bit heavy":
    // all 30 rows at once took a quarter of a second in one frame on the OPPO); c.slimAll() builds the rest at once
    // (the top four at once; the rest, three a frame, are there before a finger can scroll). Not in the browser tests, which
    // read a list the moment it opens: there every row is built at once, as before (Farm.listStagger forces either way).
    var stagger = window.Farm.listStagger !== undefined ? window.Farm.listStagger : !(window.navigator && window.navigator.webdriver);
    var built = stagger ? Math.min(rows.length, 4) : rows.length;
    rows.slice(0, built).forEach(function (row, i) { self.slimRow(list, y0 + i * SLIM.step, row); });
    c.add(list);
    this.scrollList(c, list, top, bottom, full - 10 - y0 + 4, SLIM.h);
    var more = function (all) {
      if (!c.scene || built >= rows.length) return;
      var end = all ? rows.length : Math.min(rows.length, built + 3);
      for (; built < end; built++) self.slimRow(list, y0 + built * SLIM.step, rows[built]);
      if (c.slimScroll) c.slimScroll(c.slimAt || 0); // (a new row out of view takes no taps)
      if (built < rows.length) self.time.delayedCall(16, function () { more(false); });
    };
    c.slimAll = function () { more(true); };
    var into = c.slimInto;
    if (into) c.slimInto = function (obj) { more(true); return into(obj); };
    if (built < rows.length) this.time.delayedCall(16, function () { more(false); });
    return o;
  };
  // A list in a panel that scrolls: masked between top and bottom (panel units), content `height` tall; a finger drags
  // it (a flick glides), the mouse wheel too; a thin bar at the right; a child out of view takes no taps; a drag that
  // starts on a button does not press it (F.dragTap). c.slimInto(obj) scrolls obj's row into view (tests).
  U.scrollList = function (c, list, top, bottom, height, rowH) {
    var self = this, view = bottom - top;
    var shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff).fillRect(16, top + c.y, W - 32, view);
    list.setMask(shape.createGeometryMask());
    var span = Math.max(0, height - view), at = 0, bar = null;
    if (span > 0) {
      bar = this.add.rectangle(W - 21, top, 4, Math.max(30, view * view / (view + span)), 0x7a4d26, 0.45).setOrigin(0.5, 0);
      c.add(bar);
    }
    var place = function (y) {
      at = Math.max(-span, Math.min(0, y));
      c.slimAt = at; // (where it is scrolled to: a panel drawn again can go back there)
      list.y = at;
      if (bar) bar.y = top + (view - bar.height) * (span ? -at / span : 0);
      list.list.forEach(function (r) {
        var h = r.rowH || rowH, ry = r.y + at, on = ry + h / 2 > top && ry + h / 2 < bottom;
        var walk = function (x) { if (x.input) x.input.enabled = on; if (x.list) x.list.forEach(walk); };
        walk(r);
      });
    };
    place(0);
    c.slimScroll = function (y) { place(y); };
    var glide = null;
    c.slimInto = function (obj) {
      if (glide) { glide.stop(); glide = null; }
      var r = obj; while (r && r.parentContainer !== list) r = r.parentContainer;
      if (!r) return;
      var h = r.rowH || rowH;
      if (r.y + at < top) place(top - r.y); else if (r.y + h + at > bottom) place(bottom - h - r.y);
    };
    if (span <= 0) return place;
    // (the pointer in the panel's own units: the UI camera is zoomed to the screen's pixels)
    var cam = this.cameras.main, wy = function (p) { return cam.getWorldPoint(p.x, p.y).y; };
    var drag = null, input = this.input;
    var down = function (p) {
      var m = self.modals[self.modals.length - 1];
      if (!m || m.c !== c) return;
      var py = wy(p), y = py - c.y;
      if (y < top || y > bottom) return;
      if (glide) { glide.stop(); glide = null; } // (a finger stops a glide)
      drag = { y: py, at: at, moved: false, t: Date.now(), vy: 0, ly: py };
      F.dragTap = false;
    };
    var move = function (p) {
      if (!drag || !p.isDown) return;
      var py = wy(p), dy = py - drag.y, now = Date.now();
      if (!drag.moved && Math.abs(dy) > 8) { drag.moved = true; F.dragTap = true; }
      if (!drag.moved) return;
      drag.vy = (py - drag.ly) / Math.max(1, now - drag.t);
      drag.t = now; drag.ly = py;
      place(drag.at + dy);
    };
    var up = function () {
      if (!drag) return;
      var v = drag.vy, moved = drag.moved;
      drag = null;
      if (moved && Math.abs(v) > 0.2) {
        var from = at, to = at + v * 260;
        glide = self.tweens.addCounter({ from: 0, to: 1, duration: 420, ease: 'Quad.out', onUpdate: function (tw) { if (c.active) place(from + (to - from) * tw.getValue()); } });
      }
      self.time.delayedCall(0, function () { F.dragTap = false; });
    };
    var wheel = function (p, over, dx, dy) { var m = self.modals[self.modals.length - 1]; if (m && m.c === c) place(at - dy * 0.6); };
    input.on('pointerdown', down);
    input.on('pointermove', move);
    input.on('pointerup', up);
    input.on('wheel', wheel);
    c.once('destroy', function () { input.off('pointerdown', down); input.off('pointermove', move); input.off('pointerup', up); input.off('wheel', wheel); });
    return place;
  };
  // ---------- tiles and filters (owner, 8 Nov 2026: B and C, "the default style" for the panels you browse by picture) ----------
  // o.tiles: the same rows as pictures, three a line, scrolled; a tap opens one (its words and its buttons). Sorted into
  // what you can get now, what needs more (gold or parts), and what you have. o.filters [[key, label]] + o.groupOf(row):
  // chips at the top (the choice is kept while the panel is reopened). A row's state: row.state, else done = have,
  // a grey button = need, else can.
  var TILE = { w: 98, h: 112, gap: 6, cols: 3 }, GREY_ANY = [0xa08a68, 0x9a8a72, 0x8a8a8a];
  var SECTIONS = { can: 'You can get now', need: 'Needs more gold or parts', have: 'You have it' };
  U.tileFilters = {};
  U.rowState = function (row) {
    if (row.state) return row.state;
    if (row.done) return 'have';
    var b = (row.buttons || [])[0];
    if (!b) return 'have';
    return b.color != null && (GREY_ANY.indexOf(b.color) >= 0 || b.color === GREY_BTN) ? 'need' : 'can';
  };
  var tilePanel = function (o) {
    var self = this, c = this.openModal(), y0 = o.tabs ? 178 : 140, ph = 530;
    this.panelImg(c, 12, 76, W - 24, ph);
    var title = this.txt(W / 2, 79, o.title, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    fit(title, W - 150);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, Math.max(150, title.displayWidth + 54)));
    c.add(title);
    this.closeButton(c, W - 26, 84, function () { self.closeModal(); });
    if (o.corner) this.pillButton(c, 58, 113, 64, 26, o.corner.label, o.corner.cb, o.corner.color || GREY_BTN);
    var subW = o.corner ? 200 : W - 110, sub = this.txt(o.corner ? W / 2 + 30 : W / 2, 104, '', 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () { sub.setText(o.sub ? o.sub() : '').setScale(1); if (sub.width > subW) sub.setScale(subW / sub.width); };
    showSub();
    o.refresh = showSub;
    if (o.tabs) this.tabSwitch(c, 152, o.tabs, o.tab, function (key) { self.swapTo(function () { o.reopen(key, 0); }); });
    var key = o.title + '|' + (o.tab || ''), pick = o.filters ? (U.tileFilters[key] || o.filters[0][0]) : null, top = y0;
    // the filter chips
    if (o.filters) {
      var fx = 24;
      o.filters.forEach(function (f) {
        var on = f[0] === pick, t = self.txt(0, 0, f[1], 11, on ? '#ffffff' : '#5a3a1e', { fontStyle: 'bold' }).setOrigin(0.5);
        var w = Math.max(44, t.width + 18), chip = self.add.container(fx + w / 2, y0 + 10);
        var cw = Math.round(w), bg = self.bake('ui-chip-' + cw + '-' + (on ? 1 : 0), cw, 22, function (g) { g.fillStyle(on ? 0x5fa84a : 0xe2c890, 1).fillRoundedRect(0, 0, cw, 22, 11); });
        chip.add([self.add.image(-cw / 2, -11, bg).setOrigin(0).setDisplaySize(cw, 22), t]);
        var z = self.add.zone(0, 0, w, 26).setInteractive({ useHandCursor: true });
        F.tapOn(z, function () { if (on) return; sfx('pick'); U.tileFilters[key] = f[0]; self.swapTo(function () { o.reopen(o.tab, 0); }); });
        chip.add(z);
        c.add(chip);
        fx += w + 6;
      });
      top = y0 + 28;
    }
    var rows = o.rows.filter(function (r) { return !pick || pick === 'all' || (o.groupOf && o.groupOf(r) === pick); });
    var bottom = 76 + ph - 12;
    if (!rows.length) {
      c.add(this.txt(W / 2, top + 40, o.empty || 'Nothing here yet.', 14, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0));
      return o;
    }
    var list = this.add.container(0, 0), y = top + 2, x0 = (W - (TILE.cols * TILE.w + (TILE.cols - 1) * TILE.gap)) / 2, jobs = [];
    var groups = { can: [], need: [], have: [] };
    rows.forEach(function (r) { groups[U.rowState(r)].push(r); });
    var many = ['can', 'need', 'have'].filter(function (k) { return groups[k].length; }).length > 1;
    ['can', 'need', 'have'].forEach(function (k) {
      if (!groups[k].length) return;
      if (many) {
        var hd = self.txt(x0 + 2, y + 2, (o.sections && o.sections[k]) || SECTIONS[k], 11, k === 'can' ? '#2f6a1a' : '#8a6a42', { fontStyle: 'bold' });
        list.add(hd);
        y += 20;
      }
      groups[k].forEach(function (r, i) {
        var col = i % TILE.cols;
        if (i && !col) y += TILE.h + TILE.gap;
        jobs.push([x0 + col * (TILE.w + TILE.gap), y, r, k]);
      });
      y += TILE.h + TILE.gap + 4;
    });
    // the tiles in view first, the rest six a frame after (owner, 11 Nov 2026: Lily's shop opened with a quarter-second
    // stop on the OPPO, every tile built at once); c.slimAll() builds the rest at once
    var built = 0, more = function (n) {
      if (!c.scene) return;
      for (var end = Math.min(jobs.length, built + n); built < end; built++) self.tile(list, jobs[built][0], jobs[built][1], jobs[built][2], jobs[built][3], o);
      if (c.slimScroll) c.slimScroll(c.slimAt || 0); // (a new tile out of view takes no taps)
      if (built < jobs.length) self.time.delayedCall(16, function () { more(6); });
    };
    c.add(list);
    this.scrollList(c, list, top - 2, bottom, y - top, TILE.h);
    var stagger = window.Farm.listStagger !== undefined ? window.Farm.listStagger : !(window.navigator && window.navigator.webdriver); // (as the rows above)
    var first = stagger ? jobs.filter(function (j) { return j[1] < bottom; }).length : jobs.length;
    for (; built < first; built++) self.tile(list, jobs[built][0], jobs[built][1], jobs[built][2], jobs[built][3], o);
    if (c.slimScroll) c.slimScroll(c.slimAt || 0);
    c.slimAll = function () { more(jobs.length); };
    var into = c.slimInto;
    if (into) c.slimInto = function (obj) { more(jobs.length); return into(obj); };
    if (built < jobs.length) this.time.delayedCall(16, function () { more(6); });
    return o;
  };
  // One tile: its picture, its name (two lines at most), its price or a tick.
  U.tile = function (parent, x, y, row, state, o) {
    var self = this, r = this.add.container(x, y), w = TILE.w, h = TILE.h, b = (row.buttons || [])[0];
    r.rowH = h;
    r.row = row; // (the tests: a tile by what its panel offers)
    // the card and its picture's round back, drawn once into a picture per look and shown as an image (owner, 11 Nov 2026:
    // the seed shop ran at 13 fps on the OPPO: 57 live Graphics in one panel were drawn again every frame)
    var bg = this.bake('ui-tile-' + w + 'x' + h + '-' + state, w, h + 3, function (g) {
      g.fillStyle(0x7a4d26, 0.18).fillRoundedRect(0, 3, w, h, 10);
      g.fillStyle(state === 'have' ? 0xf0e6cf : 0xfffbf0, 1).fillRoundedRect(0, 0, w, h, 10);
      g.lineStyle(1.5, state === 'can' ? 0x7fbf5a : 0xd9b77f, 1).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 10);
      g.fillStyle(0xf2d79a, 0.9).fillCircle(w / 2, 36, 27);
    });
    r.add(this.add.image(0, 0, bg).setOrigin(0).setDisplaySize(w, h + 3));
    var pic = this.tilePicture(row, w / 2, 36, 48);
    if (pic) { if (state === 'have') pic.setAlpha(0.6); r.add(pic); }
    var name = this.txt(w / 2, 68, row.name || '', 10, state === 'have' ? '#8a7a5a' : INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: w - 10 } }).setOrigin(0.5, 0);
    if (name.height > 26) name.setScale(26 / name.height);
    r.add(name);
    var price = state === 'have' ? '✓ Yours' : b ? b.label : '';
    if (price) {
      var pt = this.txt(w / 2, h - 11, price, 10, state === 'can' ? '#2f6a1a' : state === 'need' ? '#9a7a5a' : '#5a8a3a', { fontStyle: 'bold' }).setOrigin(0.5);
      if (pt.width > w - 8) pt.setScale((w - 8) / pt.width);
      r.add(pt);
    }
    // what else it takes or gives (row.reward: "Also needs: 5 Soft Leather"), small, above the price (9 Nov 2026: a
    // Bigger Bag's leather was only in its opened panel)
    if (row.reward && state !== 'have' && !row.done) {
      var ch = this.add.container(0, 0);
      this.rewardChips(ch, 0, 0, 10000, row.reward, null); // (the words "Also needs": in its opened panel)
      var chw = 0;
      ch.list.forEach(function (o2) { chw = Math.max(chw, o2.x + (o2.displayWidth || o2.width || 0) * (o2.originX === 0.5 ? 0.5 : 1)); });
      var k = Math.min(0.85, (w - 8) / Math.max(1, chw));
      ch.setScale(k).setPosition((w - chw * k) / 2, 78);
      r.add(ch);
      name.setY(63); // (one line of name above it, the price below)
      if (name.displayHeight > 14) name.setScale(Math.min(name.scaleX, 14 / name.height));
    }
    if (row.tag) r.add(this.txt(w - 6, 6, row.tag, 8, '#ffffff', { fontStyle: 'bold', backgroundColor: '#c0503a', padding: { x: 3, y: 1 } }).setOrigin(1, 0));
    var z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerdown', function () { r.setScale(0.97); });
    z.on('pointerout', function () { r.setScale(1); });
    F.tapOn(z, function () { r.setScale(1); sfx('pick'); if (row.onPick) return row.onPick(); self.tileOpen(row, state, o); }); // (onPick: the tile does it at once)
    r.add(z);
    parent.add(r);
    return r;
  };
  // A row's picture: an item icon, a furniture or look picture (row.img { key, frame }, row.sheet { key, frame }).
  U.tilePicture = function (row, x, y, size) {
    var im = null;
    if (row.people) { // a villager's face: the top of their first frame (Post Office, Friendship Book...)
      F.ensureTexture(this, 'people');
      im = this.add.image(x, y - size / 2, 'people', C.VILLAGER_ORDER.indexOf(row.people) * 9).setOrigin(0.5, 0).setCrop(0, 0, 128, 150);
      im.setScale(size / 150);
      return im;
    }
    if (row.sheet) { F.ensureTexture(this, row.sheet.key); im = this.add.image(x, y, row.sheet.key, row.sheet.frame || 0); }
    else if (row.img) im = this.add.image(x, y, row.img.furn != null ? F.furnTexture(this, row.img.furn) : row.img.key, row.img.frame); // (furniture: its style's sheet)
    else if (row.icon != null) im = this.add.image(x, y, 'items', row.icon);
    if (im) { var k = size / Math.max(im.width, im.height); im.setScale(k); }
    return im;
  };
  // A tile opened: a small panel over the list with its picture, name, words and buttons.
  U.tileOpen = function (row, state, o) {
    var self = this, c = this.openModal(function () { self.closeModal(); }), b = row.amount ? [] : row.buttons || [];
    c.tileDetail = row.name || true; // (the tests: a tile's own panel)
    var desc = this.txt(W / 2, 0, row.desc || '', 12, '#6a4a2a', { align: 'center', wordWrap: { width: W - 90 }, lineSpacing: 2 }).setOrigin(0.5, 0);
    // (4 or more buttons, e.g. Buy x1 / x10 / x20 / x50: two to a row, owner 9 Nov 2026)
    var grid = b.length > 3, brows = grid ? Math.ceil(b.length / 2) : 1;
    var h = 170 + desc.height + (b.length ? 56 + (brows - 1) * 46 : 10) + (row.amount ? 102 : 0), y0 = Math.round((640 - h) / 2);
    this.panelImg(c, 24, y0, W - 48, h);
    c.add(this.add.circle(W / 2, y0 + 48, 34, 0xf2d79a));
    var pic = this.tilePicture(row, W / 2, y0 + 48, 60);
    if (pic) c.add(pic);
    var name = this.txt(W / 2, y0 + 92, row.name || '', 16, INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: W - 90 } }).setOrigin(0.5, 0);
    c.add(name);
    desc.setY(y0 + 100 + name.height);
    c.add(desc);
    if (row.progress) c.add(this.txt(W / 2, desc.y + desc.height + 6, row.progress[0] + ' of ' + row.progress[1], 11, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    if (row.reward && !row.done) { // (its chips too: what it costs besides, what it gives)
      var rc = this.add.container(0, 0);
      this.rewardChips(rc, 0, 0, W - 90, row.reward, row.rewardPrefix);
      var rcw = 0;
      rc.list.forEach(function (o2) { rcw = Math.max(rcw, o2.x + (o2.displayWidth || o2.width || 0) * (o2.originX === 0.5 ? 0.5 : 1)); });
      rc.setPosition((W - rcw) / 2, desc.y + desc.height + (row.progress ? 24 : 6));
      c.add(rc);
    }
    this.closeButton(c, W - 38, y0 + 12, function () { self.closeModal(); });
    var per = grid ? 2 : b.length, bw = Math.min(150, (W - 90 - (per - 1) * 10) / Math.max(1, per));
    b.forEach(function (btn, k) {
      var col = grid ? k % 2 : k, row = grid ? Math.floor(k / 2) : 0, inRow = grid ? Math.min(2, b.length - row * 2) : b.length;
      var x = W / 2 + (col - (inRow - 1) / 2) * (bw + 10), y = y0 + h - 34 - (brows - 1 - row) * 46;
      self.pillButton(c, x, y, bw, 36, btn.label, function () { self.closeModal(); btn.cb(); }, btn.color || GREEN);
    });
    if (row.amount) this.amountPicker(c, y0 + h - 34, row.amount);
  };
  // How many to buy: - and + (hold one: it keeps going, then by tens), the amount, and one Buy button with the price
  // (owner, 10 Nov 2026: "How about i want x100? Make it allowed to + -"). a: { price(n), buy(n), max, start, word(n) }
  U.amountPicker = function (c, yBuy, a) {
    var self = this, max = a.max || 999, n = Math.max(1, Math.min(max, a.start || 1)), held = null;
    var num = this.txt(W / 2, yBuy - 92, '', 22, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    var sub = this.txt(W / 2, yBuy - 69, '', 11, '#6a4a2a').setOrigin(0.5);
    c.add([num, sub]);
    var buy = null;
    var draw = function () {
      num.setText('x' + n);
      sub.setText(a.word ? a.word(n) : '');
      var price = a.price(n), can = F.session.state.gold >= price;
      if (buy) buy.destroy();
      buy = self.pillButton(c, W / 2, yBuy, 200, 38, (n > 1 ? 'Buy ' + n + '  ' : 'Buy ') + (n > 1 ? price.toLocaleString('en-US') : price) + 'G', function () { // (one: 'Buy 60G', as before)
        if (!can) { if (F.Audio) F.Audio.sfx('nope'); return self.toast('Not enough gold.'); }
        self.closeModal(); a.buy(n);
      }, can ? GREEN : 0xa08a68);
      c.amountN = n; // (the tests)
    };
    var step = function (d) { if (!num.scene) return stop(); var m = Math.max(1, Math.min(max, n + d)); if (m !== n) { n = m; draw(); if (F.Audio) F.Audio.sfx('pick'); } };
    var stop = function () { if (held) { held.remove(); held = null; } };
    var side = function (x, glyph, d) {
      var b = self.pillButton(c, x, yBuy - 84, 54, 40, glyph, function () {}, 0x4a90c9), z = b.list[b.list.length - 1], k = 0;
      b.list[1].setFontSize(24);
      z.on('pointerdown', function () {
        stop(); step(d); k = 0;
        held = self.time.addEvent({ delay: 380, callback: function () {
          held = self.time.addEvent({ delay: 90, loop: true, callback: function () { k++; step(k > 10 ? d * 10 : d); } });
        } });
      });
      z.on('pointerup', stop); z.on('pointerout', stop);
      c.amountStep = c.amountStep || {}; c.amountStep[d > 0 ? 'up' : 'down'] = step.bind(null, d); // (the tests)
    };
    side(W / 2 - 92, '\u2212', -1);
    side(W / 2 + 92, '+', 1);
    this.events.once('shutdown', stop);
    draw();
  };

  // A slim row: a 56 px card; the icon; the name (and a HARD tag); under it a small bar with its count and the prize, then
  // one line of description; the button on the right (two: side by side, smaller), or a Done tick.
  U.slimRow = function (parent, y, row) {
    var self = this, r = this.add.container(0, y), b = (row.buttons || []).slice(0, 2), H = SLIM.h; // (more buttons: in its opened tile)
    var right = b.length ? (b.length > 1 ? 2 * 62 + 4 : 72) : row.done ? 34 : 0;
    r.add(this.canvasImg(null, 22, 0, 'ui-slimrow', W - 44, H + 3, function (g) {
      rrect(g, 0, 3, W - 44, H, 10);
      g.fillStyle = 'rgba(122,77,38,0.18)';
      g.fill();
      rrect(g, 0, 0, W - 44, H, 10);
      g.fillStyle = vgrad(g, 0, H, '#fffdf6', '#f5e4bd');
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#d9b77f';
      g.stroke();
    }));
    r.add(this.add.circle(46, H / 2, 17, 0xf2d79a).setStrokeStyle(1.5, 0xd9b77f));
    if (row.img || row.sheet || row.people) { var pi = this.tilePicture(row, 46, H / 2, row.people ? 32 : 28); if (pi) r.add(pi); }
    else if (row.icon != null) r.add(this.add.image(46, H / 2, 'items', row.icon).setScale(0.2).setAlpha(row.done ? 0.55 : 1));
    var x = 70, textW = W - 44 - (x - 22) - right - 10;
    var name = this.txt(x, 6, row.name || '', 12, row.done ? '#8a7a5a' : INK, { fontStyle: 'bold' });
    var tagW = 0;
    if (row.tag) {
      var tg = this.txt(0, 7, row.tag, 9, '#ffffff', { fontStyle: 'bold', backgroundColor: '#c0503a', padding: { x: 4, y: 1 } });
      tagW = tg.width + 5;
      r.add(tg);
      self.time.delayedCall(0, function () { if (tg.active) tg.setX(x + name.displayWidth + 5); });
    }
    if (name.width > textW - tagW) name.setScale((textW - tagW) / name.width);
    r.add(name);
    if (row.online) { // (a friend online: a green dot after the name)
      var ox = x + name.displayWidth + 8;
      r.add(this.add.circle(ox, 13, 4, 0x3fa535).setStrokeStyle(1.5, 0xffffff));
      r.add(this.txt(ox + 7, 13, 'online', 10, '#2f7a22', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    }
    var ly = 25, lx = x, desc = row.desc || '', progress = row.progress;
    var m = !progress && /^(\d+)\s*\/\s*(\d+)\.?\s*/.exec(desc);
    if (m && Number(m[2]) > 0) { progress = [Number(m[1]), Number(m[2])]; desc = desc.slice(m[0].length); }
    if (progress && progress[1] > 0 && !row.done) {
      var have = Math.min(progress[0], progress[1]), need = progress[1], bw = 54, fw = Math.max(0, Math.round((bw - 2) * have / need));
      r.add(this.add.rectangle(lx, ly + 5, bw, 8, 0x6a4a2a).setOrigin(0, 0.5));
      if (fw > 0) r.add(this.add.rectangle(lx + 1, ly + 5, fw, 6, have >= need ? 0xe9a91c : 0x5fb84a).setOrigin(0, 0.5));
      var cnt = this.txt(lx + bw + 4, ly + 5, have + '/' + need, 10, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      r.add(cnt);
      lx += bw + 8 + cnt.width + 6;
    }
    if (row.reward && !row.done) {
      // one line of chips, all of them: a little smaller when they do not fit (9 Nov 2026: a Gold tool's "2 Boar Tusk"
      // chip was dropped from Bram's list)
      var tmp = this.add.container(lx, ly - 3), room = x + textW - lx;
      this.rewardChips(tmp, 0, 0, 10000, row.reward, row.rewardPrefix);
      var cw = 0;
      tmp.list.forEach(function (o2) { cw = Math.max(cw, o2.x + (o2.displayWidth || o2.width || 0) * (o2.originX != null && o2.originX === 0.5 ? 0.5 : 1)); });
      if (cw > room) tmp.setScale(Math.max(0.55, room / cw));
      r.add(tmp);
    }
    if (desc) { // (under the bar and prize; right under the name when the row has neither)
      var d = this.txt(x, lx === x && !(row.reward && !row.done) ? 26 : 40, desc, 10, '#7a5a3a');
      // a little smaller first (down to 80%: "20 a day, 60G a work day" whole, 9 Nov 2026), then cut with …
      var fit = Math.max(0.8, Math.min(1, textW / d.width));
      d.setScale(fit);
      var words = desc.split(' ');
      while (d.width * fit > textW && words.length > 2) { words.pop(); d.setText(words.join(' ').replace(/[,.;:]$/, '') + '…'); }
      r.add(d);
    }
    var bx = W - 22 - 8;
    if (b.length === 1) this.pillButton(r, bx - 32, H / 2, 64, 28, b[0].label, b[0].cb, b[0].color || GREEN);
    else if (b.length > 1) b.slice(0, 2).forEach(function (btn, k) { self.pillButton(r, bx - 30 - (1 - k) * 66, H / 2, 60, 26, btn.label, btn.cb, btn.color || GREEN); });
    else if (row.done) r.add(this.txt(bx - 14, H / 2, '✓', 18, '#3fa535', { fontStyle: 'bold' }).setOrigin(0.5));
    if (row.onTap) { var zt = this.add.zone(22 + (W - 44 - right) / 2, H / 2, W - 44 - right, H).setInteractive({ useHandCursor: true }); F.tapOn(zt, row.onTap); r.addAt(zt, 1); }
    parent.add(r);
    return r;
  };

  // Pages: one centred bar, the arrows on both ends (the one that can't go further fades), a dot per page between
  // them, the current one lit. Tapping a dot jumps to that page.
  // Too many pages for a dot each in the screen's width (What's new): the bar says "5 / 20" instead.
  U.pager = function (c, y, page, pages, go) {
    var self = this, dot = 14, inner = pages * dot + 12, w = inner + 2 * 40, count = w > W - 40;
    if (count) w = 170;
    this.canvasImg(c, W / 2 - w / 2, y - 17, 'ui-pager-' + (count ? 'n' : pages), w, 36, function (g) {
      rrect(g, 0, 2, w, 32, 16);
      g.fillStyle = 'rgba(122,77,38,0.18)';
      g.fill();
      rrect(g, 0, 0, w, 32, 16);
      g.fillStyle = vgrad(g, 0, 32, '#ead2a0', '#dcbd87');
      g.fill();
    });
    [[-1, 'left'], [1, 'right']].forEach(function (d) {
      var to = page + d[0], ok = to >= 0 && to < pages;
      var b = self.roundButton(c, W / 2 + d[0] * (w / 2 - 17), y - 1, 15, ok ? BLUE : GREY_BTN, d[1], null, function () { if (ok) go(to); });
      if (!ok) b.setAlpha(0.4);
    });
    if (count) return c.add(this.txt(W / 2, y - 1, (page + 1) + ' / ' + pages, 15, '#5a3a1a', { fontStyle: 'bold' }).setOrigin(0.5));
    for (var k = 0; k < pages; k++) {
      (function (k) {
        var x = W / 2 - (pages - 1) * dot / 2 + k * dot, on = k === page;
        var d = self.add.circle(x, y - 1, on ? 5 : 3.5, on ? 0x3fa535 : 0x9a7a52).setStrokeStyle(on ? 2 : 0, 0xffffff);
        c.add(d);
        if (!on) {
          var z = self.add.zone(x, y - 1, dot, 28).setInteractive({ useHandCursor: true });
          F.tapOn(z, function () { go(k); });
          c.add(z);
        }
      })(k);
    }
  };

  // Tabs as one sliding switch: a track, the chosen tab lit green.
  U.tabSwitch = function (c, y, tabs, current, onPick) {
    var self = this, n = tabs.length, x0 = 30, tw = Math.floor((W - 60) / n);
    this.canvasImg(c, x0 - 3, y - 19, 'ui-tabtrack-' + n, tw * n + 6, 40, function (g) {
      rrect(g, 0, 2, tw * n + 6, 36, 18);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fill();
      rrect(g, 0, 0, tw * n + 6, 36, 18);
      g.fillStyle = vgrad(g, 0, 36, '#c9a26b', '#dcbd87');
      g.fill();
    });
    tabs.forEach(function (t, k) {
      var on = t[0] === current, tc = self.add.container(x0 + tw * k + tw / 2, y);
      if (on) {
        tc.add(self.canvasImg(null, -tw / 2 + 1, -15, 'ui-tabon-' + tw, tw - 2, 32, function (g) {
          rrect(g, 0, 2, tw - 2, 28, 14);
          g.fillStyle = 'rgba(30,16,6,0.3)';
          g.fill();
          rrect(g, 0, 0, tw - 2, 28, 14);
          g.fillStyle = vgrad(g, 0, 28, '#8fd16a', '#4f9a3a');
          g.fill();
          rrect(g, 6, 2, tw - 14, 10, 5);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fill();
        }));
      }
      var tt = self.txt(0, -1, t[1], 13, on ? '#ffffff' : '#5a3a1e', on ? { fontStyle: 'bold', stroke: '#2f5a22', strokeThickness: 3 } : { fontStyle: 'bold' }).setOrigin(0.5);
      fit(tt, tw - 10);
      var z = self.add.zone(0, 0, tw, 32).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () {
        if (on) return;
        sfx('pick');
        onPick(t[0]);
      });
      tc.add([tt, z]);
      c.add(tc);
    });
  };

  // A pill button for rows: fully rounded, a coloured gradient with a gloss, a dark edge, white bold label.
  U.pillButton = function (parent, x, y, w, h, label, onTap, color) {
    var c = this.add.container(x, y);
    color = color || GREEN;
    c.add(this.canvasImg(null, -w / 2, -h / 2, 'ui-pill-' + w + 'x' + h + '-' + color, w, h + 3, function (g) {
      rrect(g, 0, 3, w, h, h / 2);
      g.fillStyle = 'rgba(30,16,6,0.3)';
      g.fill();
      rrect(g, 0, 0, w, h, h / 2);
      g.fillStyle = shade(color, -0.45);
      g.fill();
      rrect(g, 1.5, 1.5, w - 3, h - 3, h / 2 - 1.5);
      g.fillStyle = vgrad(g, 1.5, h - 1.5, shade(color, 0.22), shade(color, -0.08));
      g.fill();
      rrect(g, 7, 3.5, w - 14, (h - 7) / 2, (h - 7) / 4);
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.fill();
    }));
    var t = this.txt(0, -1, label, 13, '#ffffff', { fontStyle: 'bold', stroke: shade(color, -0.55), strokeThickness: 3 }).setOrigin(0.5);
    fit(t, w - 14);
    var z = this.add.zone(0, 0, w, h + 6).setInteractive({ useHandCursor: true });
    z.on('pointerdown', function () { c.setScale(0.93); });
    z.on('pointerout', function () { c.setScale(1); });
    F.tapOn(z, function () { c.setScale(1); onTap(); });
    c.add([t, z]);
    if (parent) parent.add(c);
    return c;
  };

  // Prize chips: a small cream pill per part of a reward, its icon and amount (150G, 2 Sunbeams, 3 Pet Meals).
  U.rewardChips = function (c, x, y, maxW, reward, prefix) {
    var self = this, parts = [];
    if (reward.gold) parts.push([C.ICON.coin, money(reward.gold)]);
    if (reward.stars) parts.push([C.ICON.sunbeam, String(reward.stars)]);
    if (reward.item) parts.push([C.ITEMS[reward.item].icon, (reward.n > 1 ? reward.n + ' ' : '') + C.ITEMS[reward.item].name]);
    // more: [[item, n]], each its own chip (a forge upgrade's Boar Tusks were once only in the text, cut off: 5 Nov 2026)
    (reward.more || []).forEach(function (m) { if (C.ITEMS[m[0]]) parts.push([C.ITEMS[m[0]].icon, (m[1] > 1 ? m[1] + ' ' : '') + C.ITEMS[m[0]].name]); });
    var cx = x, cy = y, rowH = 20;
    if (prefix) {
      var p = this.txt(cx, cy + 8, prefix + ':', 10, '#8a6a42', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      c.add(p);
      cx += p.width + 5;
    }
    parts.forEach(function (part) {
      var t = self.txt(0, 0, part[1], 10, '#6a3f12', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      if (t.width > maxW - 30) t.setScale((maxW - 30) / t.width);
      var w = Math.round(t.displayWidth + 26);
      if (cx + w > x + maxW && cx > x) { cx = x; cy += rowH; }
      c.add(self.canvasImg(null, cx, cy, 'ui-rchip-' + w, w, 17, function (g) {
        rrect(g, 0.5, 0.5, w - 1, 16, 8);
        g.fillStyle = '#fff4d6';
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = '#d9b77f';
        g.stroke();
      }));
      c.add(self.add.image(cx + 9, cy + 8.5, 'items', part[0]).setScale(0.12));
      t.setPosition(cx + 18, cy + 8.5);
      c.add(t);
      cx += w + 4;
    });
    return cy + rowH - y;
  };

  // A list row: a card; the icon on a round badge; the name (with a HARD tag), a progress bar, prize chips or the
  // description; on the right the row's buttons as pills, or a Done stamp. Rows may give structured fields:
  // progress [have, need], reward { gold, stars, item, n } (+ rewardPrefix), done, tag, online. A description that
  // starts with "n/m" still gets a bar (older rows).
  U.lookListRow = function (c, y, row) {
    // row.buttonsBelow: the text takes the full width and the button sits at the bottom right, by the chips
    var self = this, b = row.buttons || [], below = !!row.buttonsBelow && b.length === 1;
    var right = (b.length && !below) || (row.done && !below) ? 96 : 0;
    var textW = W - 52 - 64 - right - 8;
    this.canvasImg(c, 26, y, 'ui-row3' + (ROW_H === 74 ? '' : '-' + ROW_H), W - 52, ROW_H + 4, function (g) {
      rrect(g, 1, 3, W - 54, ROW_H, 12);
      g.fillStyle = 'rgba(122,77,38,0.2)';
      g.fill();
      rrect(g, 1, 1, W - 54, ROW_H, 12);
      g.fillStyle = vgrad(g, 1, ROW_H, '#fffdf6', '#f5e4bd');
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#d9b77f';
      g.stroke();
    });
    if (row.done) { // a finished row is quieter
      c.add(this.add.rectangle(27, y + 1, W - 54, ROW_H, 0xeadbb8, 0.45).setOrigin(0));
    }
    var cx = 36 + SLOT / 2, cy = y + ROW_H / 2;
    this.canvasImg(c, cx - 25, cy - 25, 'ui-rowbadge', 50, 52, function (g) {
      circle(g, 25, 27, 23);
      g.fillStyle = 'rgba(122,77,38,0.25)';
      g.fill();
      circle(g, 25, 25, 23);
      g.fillStyle = '#c99a5a';
      g.fill();
      circle(g, 25, 25, 20.5);
      var rg = g.createRadialGradient(20, 18, 3, 25, 25, 21);
      rg.addColorStop(0, '#fffdf4');
      rg.addColorStop(1, '#f0d9a8');
      g.fillStyle = rg;
      g.fill();
    });
    if (row.people) {
      F.ensureTexture(this, 'people');
      c.add(this.add.image(cx, cy + SLOT / 2 - 2, 'people', C.VILLAGER_ORDER.indexOf(row.people) * 9).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 0, 128, 150));
    } else if (row.sheet) { // a picture from a sheet: { key, frame, scale } (the Tailor Shop's looks)
      F.ensureTexture(this, row.sheet.key);
      c.add(this.add.image(cx, cy + SLOT / 2 + 2, row.sheet.key, row.sheet.frame || 0).setOrigin(0.5, 1).setScale(row.sheet.scale || 0.3));
    } else if (row.icon != null) {
      c.add(this.add.image(cx, cy, 'items', row.icon).setScale(ICON));
    }
    // the middle column, laid out from the top, then centred in the card
    var mid = this.add.container(0, 0), my = 0;
    c.add(mid);
    var tagW = 0;
    if (row.tag) {
      var tagT = this.txt(0, 0, row.tag, 9, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
      tagW = Math.round(tagT.width + 12);
      mid.add(this.canvasImg(null, 90, my + 2, 'ui-tag-' + tagW, tagW, 14, function (g) {
        rrect(g, 0, 0, tagW, 14, 7);
        g.fillStyle = '#c0503a';
        g.fill();
      }));
      tagT.setPosition(90 + tagW / 2, my + 9);
      mid.add(tagT);
      tagW += 5;
    }
    var name = this.txt(90 + tagW, my, row.name, row.name.length > 22 ? 13 : 14, INK, { fontStyle: 'bold', wordWrap: { width: textW - tagW }, lineSpacing: 1 });
    mid.add(name);
    my += name.height + 3;
    if (row.hearts != null) { // friendship, as the villager dialog shows it (12-ui.js heartIcons)
      this.heartIcons(mid, 90, my + 7, row.hearts, Math.min(16, (textW - 4) / 10));
      my += 17;
    }
    if (row.online) {
      mid.add(this.add.circle(94, my + 6, 4, 0x3fa535).setStrokeStyle(1.5, 0xffffff));
      mid.add(this.txt(101, my + 6, 'online', 10, '#2f7a22', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      my += 14;
    }
    var desc = row.desc || '', progress = row.progress;
    var m = !progress && /^(\d+)\s*\/\s*(\d+)\.?\s*/.exec(desc);
    if (m && Number(m[2]) > 0) {
      progress = [Number(m[1]), Number(m[2])];
      desc = desc.slice(m[0].length);
    }
    if (progress && progress[1] > 0) {
      // the count first: the bar takes what is left beside it (owner, 8 Nov 2026: Bayanihan's "214/1500" ran under Give)
      var have = Math.min(progress[0], progress[1]), need = progress[1];
      var count = this.txt(0, my + 6.5, have + '/' + need, 10, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      var bw = Math.max(30, Math.min(110, textW - Math.ceil(count.width) - 8));
      mid.add(this.canvasImg(null, 90, my + 1, 'ui-rowbar-' + bw, bw, 11, function (g) {
        rrect(g, 0, 0, bw, 11, 5.5);
        g.fillStyle = '#6a4a2a';
        g.fill();
      }));
      if (have > 0) {
        var fw = Math.max(9, Math.min(bw - 3, Math.round((bw - 3) * have / need / 4) * 4)), gold = have >= need; // 4px steps: a few textures, not one per width
        mid.add(this.canvasImg(null, 91.5, my + 2.5, 'ui-rowbarfill-' + Math.round(fw) + (gold ? 'g' : ''), fw, 8, function (g) {
          rrect(g, 0, 0, fw, 8, 4);
          g.fillStyle = vgrad(g, 0, 8, gold ? '#ffe680' : '#a6ef7c', gold ? '#e9a91c' : '#3fa535');
          g.fill();
          rrect(g, 2, 1, fw - 4, 2.5, 1.25);
          g.fillStyle = 'rgba(255,255,255,0.45)';
          g.fill();
        }));
      }
      mid.add(count.setX(90 + bw + 6));
      my += 16;
    }
    if (desc && !(row.reward && row.done)) {
      // at most what fits in the card: a long description is cut at a word, with an ellipsis
      var room = ROW_H - 10 - my - (row.reward ? 20 : 0);
      var d = this.txt(90, my, desc, 10, '#7a5a3a', { wordWrap: { width: textW }, lineSpacing: 1 });
      var words = desc.split(' ');
      while (d.height > Math.max(14, room) && words.length > 3) {
        words.pop();
        d.setText(words.join(' ').replace(/[,.;:]$/, '') + '…');
      }
      mid.add(d);
      my += d.height + 3;
    }
    if (row.reward) my += this.rewardChips(mid, 90, my, below ? textW - 96 : textW, row.reward, row.rewardPrefix);
    var top = Math.max(y + 6, Math.round(cy - my / 2));
    mid.y = top;
    if (my > ROW_H - 8) mid.setScale(Math.max(0.8, (ROW_H - 8) / my)).setPosition(90 * (1 - mid.scaleX), y + 4);
    // the laid-out pieces go straight into the panel (texts in a nested container would look like buttons to code
    // that finds a button by its label)
    var k = mid.scaleX, ox = mid.x, oy = mid.y;
    mid.list.slice().forEach(function (o) {
      mid.remove(o);
      o.setPosition(ox + o.x * k, oy + o.y * k).setScale(o.scaleX * k, o.scaleY * k);
      c.add(o);
    });
    mid.destroy();
    // the right column: the buttons, or a Done stamp
    var rx = W - 30 - right / 2;
    if (below) {
      this.pillButton(c, W - 30 - 46, y + ROW_H - 17, 88, 26, b[0].label, b[0].cb, b[0].color || GREEN);
    } else if (b.length) {
      var bh = b.length > 1 ? 28 : 32, gap = 5, total = b.length * bh + (b.length - 1) * gap;
      b.forEach(function (btn, k) {
        self.pillButton(c, rx, cy - total / 2 + bh / 2 + k * (bh + gap), right - 8, bh, btn.label, btn.cb, btn.color || GREEN);
      });
    } else if (row.done) {
      this.canvasImg(c, rx - 15, cy - 22, 'ui-donestamp', 30, 32, function (g) {
        badge(g, 15, 15, 14, '#a6ef7c', '#3fa535');
        line(g, [[9, 15.5], [13.5, 20], [21.5, 10.5]], 3.4, '#ffffff');
      });
      c.add(this.txt(rx, cy + 17, 'Done', 11, '#2f7a22', { fontStyle: 'bold' }).setOrigin(0.5));
    }
  };

  // ---------- decorate mode: a ribbon title and Home Beauty as a bar to the next level ----------
  ['drawDecorBar', 'drawYardBar'].forEach(function (k) {
    var draw = U[k];
    if (!draw) return;
    U[k] = function (info) {
      var r = draw.call(this, info);
      if (this.decorBar) this.decorHeader(this.decorBar, k === 'drawYardBar' ? 'Decorate your yard' : 'Decorate your home');
      // the side buttons step aside straight away (checkQuests would hide Quests only on its next tick)
      [this.questBtn, this.questBadge, this.questBadgeText, this.onlineBtn].forEach(function (o) { if (o) o.setVisible(false); });
      return r;
    };
  });

  U.decorHeader = function (c, label) {
    var s = F.session.state, old = this.beautyLine(s), top = 440;
    c.list.forEach(function (o) { if (o.type === 'Text' && o.text === old) o.setVisible(false); });
    var title = this.txt(W / 2, top + 2, label, 15, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, top + 2, title.width + 54);
    c.add(title);
    var tiers = C.HOME.tiers, b = L.homeBeauty(s), tier = L.homeTier(s), cur = tiers[tier], next = tiers[tier + 1];
    // (owner, 8 Nov 2026: the line ran into "Top level!": the right words first, the left fits what is left)
    var right = this.txt(W - 26, top + 30, next ? next[1] + ' at ' + next[0] : 'Top level!', 11, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    var left = this.txt(26, top + 30, 'Beauty ' + b + '  ·  ' + cur[1] + (cur[2] ? ' (+' + cur[2] + ' energy)' : ''), 12, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    var room = W - 52 - right.width - 12;
    if (left.width > room) left.setScale(room / left.width);
    c.add(left);
    var bw = W - 52, pct = next ? Math.max(0, Math.min(1, (b - cur[0]) / (next[0] - cur[0]))) : 1;
    this.canvasImg(c, 26, top + 40, 'ui-beautybar', bw, 12, function (g) {
      rrect(g, 0, 0, bw, 12, 6);
      g.fillStyle = '#7a5a3a';
      g.fill();
    });
    var fw = Math.max(10, Math.min(bw - 4, Math.round((bw - 4) * pct / 4) * 4)); // 4px steps: a few textures, not one per width
    this.canvasImg(c, 28, top + 42, 'ui-beautyfill-' + Math.round(fw), fw, 8, function (g) {
      rrect(g, 0, 0, fw, 8, 4);
      g.fillStyle = vgrad(g, 0, 8, '#ffb3d1', '#d0587a');
      g.fill();
    });
    c.add(right);
  };
})(window.Farm = window.Farm || {});

// ---------- the action button: a picture for every action ----------
// Enter, Go down, Read (a sign) and Withered had no icon (an empty ring). They get drawn ones: a door, stairs
// down, a signpost and a wilted sprout.
(function (F) {
  'use strict';
  var D = F.UI_DRAW, rrect = D.rrect, circle = D.circle, vgrad = D.vgrad;
  var U = F.UIScene.prototype;
  var S = 46; // drawn at the size the item icons show on the button
  var EDGE = '#5a3a1e';
  var stroke = function (g, w) { g.lineWidth = w || 2; g.strokeStyle = EDGE; g.stroke(); };
  var DRAW = {
    Enter: function (g) { // a wooden door with a round top and a knob
      g.beginPath();
      g.moveTo(11, 42); g.lineTo(11, 18); g.arc(23, 18, 12, Math.PI, 0); g.lineTo(35, 42); g.closePath();
      g.fillStyle = vgrad(g, 6, 42, '#c98a4a', '#8a5a2a');
      g.fill();
      stroke(g, 2.2);
      [17, 23, 29].forEach(function (x) { g.beginPath(); g.moveTo(x, 12 + (x === 23 ? -4 : 0)); g.lineTo(x, 40); g.lineWidth = 1.2; g.strokeStyle = 'rgba(90,58,30,0.55)'; g.stroke(); });
      circle(g, 30, 28, 2.4);
      g.fillStyle = '#ffd23f';
      g.fill();
      stroke(g, 1.2);
      rrect(g, 7, 41, 32, 4, 2);
      g.fillStyle = '#9a9a9a';
      g.fill();
      stroke(g, 1.2);
    },
    'Go down': function (g) { // stone steps going down, with an arrow
      [[8, 14, 30], [14, 22, 24], [20, 30, 18], [26, 38, 12]].forEach(function (st) {
        rrect(g, st[0], st[1], st[2], 8, 2);
        g.fillStyle = vgrad(g, st[1], st[1] + 8, '#c8c2b8', '#8f877c');
        g.fill();
        stroke(g, 1.6);
      });
      g.beginPath();
      g.moveTo(36, 6); g.lineTo(36, 22); g.lineTo(31, 17); g.moveTo(36, 22); g.lineTo(41, 17);
      g.lineCap = g.lineJoin = 'round';
      g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
      g.lineWidth = 2.6; g.strokeStyle = '#ffd23f'; g.stroke();
    },
    Read: function (g) { // a signpost
      rrect(g, 20, 20, 6, 24, 2);
      g.fillStyle = '#8a5a2a';
      g.fill();
      stroke(g, 1.6);
      rrect(g, 5, 8, 36, 18, 3);
      g.fillStyle = vgrad(g, 8, 26, '#e0b070', '#b8834a');
      g.fill();
      stroke(g, 2);
      [13, 18].forEach(function (y, k) { g.beginPath(); g.moveTo(11, y); g.lineTo(k ? 28 : 35, y); g.lineWidth = 2; g.strokeStyle = 'rgba(90,58,30,0.7)'; g.stroke(); });
    },
    Withered: function (g) { // a brown, drooping sprout on soil
      g.beginPath();
      g.ellipse(23, 40, 16, 5, 0, 0, Math.PI * 2);
      g.fillStyle = '#6a4a2a';
      g.fill();
      g.beginPath();
      g.moveTo(23, 39); g.quadraticCurveTo(22, 24, 30, 18);
      g.lineWidth = 3; g.strokeStyle = '#8a6a3a'; g.stroke();
      [[30, 18, 38, 26], [25, 27, 14, 31]].forEach(function (l) {
        g.beginPath();
        g.moveTo(l[0], l[1]); g.quadraticCurveTo((l[0] + l[2]) / 2, l[1] - 6, l[2], l[3]);
        g.quadraticCurveTo((l[0] + l[2]) / 2 + 2, l[3] - 1, l[0], l[1]);
        g.fillStyle = '#a07a3a';
        g.fill();
        stroke(g, 1.4);
      });
    },
  };

  var setHint = U.setHint;
  U.setHint = function (a) {
    setHint.call(this, a);
    var draw = a && (a.icon == null || a.icon < 0) ? DRAW[a.label] : null;
    if (!this.actionGlyph) {
      this.actionGlyph = this.add.image(0, -6, '__DEFAULT').setVisible(false);
      this.actionBtn.addAt(this.actionGlyph, this.actionBtn.getIndex(this.actionIcon) + 1);
    }
    if (!draw) return this.actionGlyph.setVisible(false);
    var key = 'ui-act-' + a.label.replace(/\W/g, '');
    this.bakeCanvas(key, S, S, draw);
    this.actionGlyph.setTexture(key).setScale(1 / F.R).setVisible(true).setAlpha(a.disabled ? 0.45 : 1).setY(-6);
    this.actionLabel.setY(42 - 8);
  };
})(window.Farm = window.Farm || {});
