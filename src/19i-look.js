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

  // The pictures on the round buttons: drawn, so they stay crisp at any size.
  var GLYPH = {
    // a speech bubble with three dots (chat bubbles, 19m-chat.js)
    chat: function (g, cx, cy, r) {
      var w = r * 1.18, h = r * 0.86, x = cx - w / 2, y = cy - h / 2 - r * 0.08;
      g.beginPath();
      g.roundRect(x, y, w, h, h * 0.42);
      g.moveTo(cx - w * 0.2, y + h - 1);
      g.lineTo(cx - w * 0.32, y + h + r * 0.34);
      g.lineTo(cx + w * 0.02, y + h - 1);
      g.fillStyle = '#fffaf0';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = EDGE;
      g.stroke();
      [-1, 0, 1].forEach(function (k) {
        circle(g, cx + k * w * 0.24, y + h / 2, r * 0.09);
        g.fillStyle = '#4a90c9';
        g.fill();
      });
    },
    // a checklist: paper, lines and ticks
    quests: function (g, cx, cy, r) {
      var w = r * 0.92, h = r * 1.12, x = cx - w / 2, y = cy - h / 2;
      rrect(g, x, y, w, h, 3);
      g.fillStyle = '#fffaf0';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = EDGE;
      g.stroke();
      for (var i = 0; i < 3; i++) {
        var ly = y + h * (0.27 + 0.24 * i);
        line(g, [[x + w * 0.42, ly], [x + w * 0.84, ly]], 2, '#b08a5a');
        line(g, [[x + w * 0.13, ly], [x + w * 0.21, ly + 2.5], [x + w * 0.33, ly - 3]], 2.2, i < 2 ? '#3f9a2f' : '#c9b48e');
      }
    },
    // the world: a blue globe with a grid
    online: function (g, cx, cy, r) {
      var R = r * 0.6;
      circle(g, cx, cy, R);
      g.fillStyle = vgrad(g, cy - R, cy + R, '#d6f0ff', '#7cc4ef');
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = '#2f6fa8';
      g.beginPath();
      g.ellipse(cx, cy, R * 0.45, R, 0, 0, Math.PI * 2);
      g.moveTo(cx - R, cy);
      g.lineTo(cx + R, cy);
      g.moveTo(cx, cy - R);
      g.lineTo(cx, cy + R);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy - R * 0.5, R * 0.86, R * 0.16, 0, 0, Math.PI * 2);
      g.ellipse(cx, cy + R * 0.5, R * 0.86, R * 0.16, 0, 0, Math.PI * 2);
      g.lineWidth = 1.1;
      g.stroke();
      circle(g, cx, cy, R);
      g.lineWidth = 2;
      g.strokeStyle = EDGE;
      g.stroke();
    },
    // a paint brush
    decorate: function (g, cx, cy, r) {
      g.translate(cx, cy);
      g.rotate(-Math.PI / 4);
      rrect(g, -3, -r * 0.78, 6, r * 0.82, 3);
      g.fillStyle = '#c98a4a';
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = EDGE;
      g.stroke();
      rrect(g, -4.5, 0, 9, r * 0.24, 2);
      g.fillStyle = '#d9dde3';
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-5, r * 0.24);
      g.quadraticCurveTo(-5.5, r * 0.6, 0, r * 0.8);
      g.quadraticCurveTo(5.5, r * 0.6, 5, r * 0.24);
      g.closePath();
      g.fillStyle = '#ef6a96';
      g.fill();
      g.stroke();
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
    var img = this.canvasImg(null, -r - 4, -r - 4, 'ui-round-' + glyph + '-' + r + '-' + color, r * 2 + 8, r * 2 + 11, function (g) {
      var cx = r + 4, cy = r + 4;
      badge(g, cx, cy, r, shade(color, 0.35), shade(color, -0.12));
      g.save();
      GLYPH[glyph](g, cx, cy, r);
      g.restore();
    });
    c.add(img);
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
    var head = e >= max ? 'Your energy is full!' : 'Full in ' + fmt((max - e - 1) * C.ENERGY_EVERY + (C.ENERGY_EVERY - (now - s.regen))) + '.';
    var self = this, buy = L.canRefill && L.canRefill() && e < max;
    this.dialog('Energy ' + e + ' / ' + max, buy ? [{ label: 'OK', color: 0xa08a68 }, { label: 'Refill', cb: function () { self.openRefill(); } }] : null, {
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
    this.roundButton(this.onlineBtn, SIDE.x, SIDE.online, SIDE.r, BLUE, 'online', 'Online', function () { self.openOnline('visit', 0); });
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
  U.lookListPanel = function (o) {
    var self = this, c = this.openModal();
    // the list's layout first, so a short list gets a shorter panel (a paged one keeps the full height)
    var rows = o.rows, page = o.page || 0, per = rows.length > 5 ? 4 : 5;
    var pages = Math.max(1, Math.ceil(rows.length / per)), shown = rows.slice(page * per, page * per + per);
    var y0 = o.tabs ? 178 : 140;
    var bottom = pages > 1 ? y0 + per * ROW_STEP + 48 : y0 + shown.length * ROW_STEP + (shown.length ? 10 : 110);
    this.panelImg(c, 12, 76, W - 24, Math.max(220, Math.min(530, bottom - 76)));
    var title = this.txt(W / 2, 79, o.title, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    fit(title, W - 150);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, Math.max(150, title.displayWidth + 54)));
    c.add(title);
    this.closeButton(c, W - 26, 84, function () { self.closeModal(); });
    // a small pill at the top left: Talk to the shop's keeper, or the panel's own (Back, Events: o.corner)
    var corner = o.corner || (o.talk ? { label: 'Talk', color: BLUE, cb: function () {
      var r = L.talk(F.session.state, o.talk);
      if (r.first) F.world.progress('meet');
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
    if (!rows.length && o.empty) c.add(this.txt(W / 2, y0 + 50, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    if (pages > 1) this.pager(c, y0 + per * ROW_STEP + 18, page, pages, function (p) { self.swapTo(function () { o.reopen(o.tab, p); }); });
    return o;
  };
  var GREY_BTN = 0xa08a68;

  // Pages: one centred bar, the arrows on both ends (the one that can't go further fades), a dot per page between
  // them, the current one lit. Tapping a dot jumps to that page.
  U.pager = function (c, y, page, pages, go) {
    var self = this, dot = 14, inner = pages * dot + 12, w = inner + 2 * 40;
    this.canvasImg(c, W / 2 - w / 2, y - 17, 'ui-pager-' + pages, w, 36, function (g) {
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
    this.canvasImg(c, 26, y, 'ui-row3', W - 52, ROW_H + 4, function (g) {
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
      var have = Math.min(progress[0], progress[1]), need = progress[1], bw = Math.min(110, textW - 38);
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
      mid.add(this.txt(90 + bw + 6, my + 6.5, have + '/' + need, 10, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0, 0.5));
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
    c.add(this.txt(26, top + 30, 'Home Beauty ' + b + '  ·  ' + cur[1] + (cur[2] ? '  (+' + cur[2] + ' max energy)' : ''), 12, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5));
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
    c.add(this.txt(W - 26, top + 30, next ? next[1] + ' at ' + next[0] : 'Top level!', 11, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(1, 0.5));
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
