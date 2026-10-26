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
    z.on('pointerup', function () { c.setScale(1); onTap(); });
    c.add(z);
    if (parent) parent.add(c);
    return c;
  };

  // ---------- the top bar ----------
  var HUD = { y: 9, h: 40 };
  var BAR = { x: 173, w: 60, h: 12 }; // the energy bar inside its chip
  var WEATHER_X = 98, CHIP_END = 132; // the clock chip's second line: the date, then the weather

  U.buildHud = function () {
    var self = this, y = HUD.y, h = HUD.h, cy = y + h / 2;
    this.canvasImg(null, 0, 0, 'ui-hud3', W, 64, function (g) {
      g.fillStyle = vgrad(g, 0, 64, 'rgba(24,14,6,0.55)', 'rgba(24,14,6,0)');
      g.fillRect(0, 0, W, 64);
      chip(g, 24, y, 112, h); // clock
      chip(g, 156, y, 86, h); // energy
      chip(g, 262, y, 58, h); // gold
      badge(g, 26, cy, 20, '#fffaea', '#e8cf98'); // the season, its icon on top
      badge(g, 156, cy, 17, '#ffe680', '#e9a91c'); // energy
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
    this.add.image(156, cy, 'items', C.ICON.bolt).setScale(0.25);
    this.energyText = this.txt(BAR.x + BAR.w / 2, cy, '', 10, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    // gold: the coin on the chip's edge, the amount right-aligned
    this.add.image(263, cy, 'items', C.ICON.coin).setScale(0.32);
    this.goldText = this.txt(313, cy, '', 15, '#7a4d12', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    // pause: a round wooden button
    this.pauseBtn = this.roundButton(null, 340, cy, 17, WOOD, 'pause', null, function () { if (!self.modals.length) self.openPause(); });
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
    var self = this, set = function (n) { self.goldText.setText(money(n)); fit(self.goldText, 44); };
    if (this.goldShown == null || gold <= this.goldShown) {
      if (this.goldTween) this.goldTween.remove();
      this.goldShown = gold;
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
  var SIDE = { x: W - 30, r: 22, quests: 134, online: 196, decorate: 420 };
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
    this.panelImg(c, 12, 76, W - 24, 530);
    var title = this.txt(W / 2, 79, o.title, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    fit(title, W - 150);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, Math.max(150, title.displayWidth + 54)));
    c.add(title);
    this.closeButton(c, W - 34, 96, function () { self.closeModal(); });
    if (o.talk) {
      this.button(c, 50, 104, 60, 28, 'Talk', function () {
        var r = L.talk(F.session.state, o.talk);
        if (r.first) F.world.progress('meet');
        sfx('talk');
        F.world.changed();
        self.say(o.talk, C.VILLAGERS[o.talk].name, r.line);
      }, BLUE);
    }
    // one line under the ribbon (two when there are no tabs), shrunk to fit rather than cut off
    var subW = o.talk ? 220 : 290;
    var sub = this.txt(o.talk ? W / 2 + 26 : W / 2, 104, '', 13, '#6a4a2a', { align: 'center', wordWrap: o.tabs ? null : { width: subW } }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () {
      sub.setText(o.sub ? o.sub() : '').setScale(1);
      if (o.tabs && sub.width > subW) sub.setScale(subW / sub.width);
    };
    showSub();
    o.refresh = showSub;
    var y0 = 140;
    if (o.tabs) {
      this.tabSwitch(c, 152, o.tabs, o.tab, function (key) { self.closeModal(); o.reopen(key, 0); });
      y0 = 178;
    }
    var rows = o.rows, page = o.page || 0, per = rows.length > 5 ? 4 : 5;
    var pages = Math.max(1, Math.ceil(rows.length / per));
    rows.slice(page * per, page * per + per).forEach(function (row, i) { self.listRow(c, y0 + i * ROW_STEP, row); });
    if (!rows.length && o.empty) c.add(this.txt(W / 2, y0 + 50, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    if (pages > 1) {
      var ny = y0 + per * ROW_STEP + 20;
      c.add(this.txt(W / 2, ny, (page + 1) + ' / ' + pages, 15, INK, { fontStyle: 'bold' }).setOrigin(0.5));
      if (page > 0) this.roundButton(c, W / 2 - 64, ny, 16, GREY_BTN, 'left', null, function () { self.closeModal(); o.reopen(o.tab, page - 1); });
      if (page < pages - 1) this.roundButton(c, W / 2 + 64, ny, 16, BLUE, 'right', null, function () { self.closeModal(); o.reopen(o.tab, page + 1); });
    }
    return o;
  };
  var GREY_BTN = 0xa08a68;

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
      z.on('pointerup', function () {
        if (on) return;
        sfx('pick');
        onPick(t[0]);
      });
      tc.add([tt, z]);
      c.add(tc);
    });
  };

  // A list row: a card, the icon on a round badge, the name, a progress bar when the description starts with
  // "n/m" (quests and goals), the rest of the description, and up to two buttons.
  U.lookListRow = function (c, y, row) {
    var self = this;
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
    var cx = 36 + SLOT / 2, cy = y + 15 + SLOT / 2;
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
      c.add(this.add.image(cx, y + 15 + SLOT - 2, 'people', C.VILLAGER_ORDER.indexOf(row.people) * 9).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 0, 128, 150));
    } else if (row.icon != null) {
      c.add(this.add.image(cx, cy, 'items', row.icon).setScale(ICON));
    }
    var name = this.txt(90, y + 7, row.name, row.name.length > 18 ? 13 : 14, INK, { fontStyle: 'bold', wordWrap: { width: 136 } });
    c.add(name);
    var dy = Math.max(26, 7 + name.height + 2), desc = row.desc || '';
    // a player who is playing right now: a green dot and "online" under the name
    if (row.online) {
      c.add(this.add.circle(94, y + dy + 5, 4, 0x3fa535).setStrokeStyle(1.5, 0xffffff));
      c.add(this.txt(101, y + dy + 5, 'online', 10, '#2f7a22', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      dy += 13;
    }
    // "3/9. Prize: 150G." -> a bar showing 3 of 9, then "Prize: 150G."
    var m = /^(\d+)\s*\/\s*(\d+)\.?\s*/.exec(desc);
    if (m && Number(m[2]) > 0) {
      var have = Math.min(Number(m[1]), Number(m[2])), need = Number(m[2]), bw = 96;
      this.canvasImg(c, 90, y + dy + 1, 'ui-rowbar', bw, 10, function (g) {
        rrect(g, 0, 0, bw, 10, 5);
        g.fillStyle = '#c9a26b';
        g.fill();
        rrect(g, 1.5, 1.5, bw - 3, 7, 3.5);
        g.fillStyle = '#7a5a3a';
        g.fill();
      });
      if (have > 0) {
        var fw = Math.max(8, (bw - 3) * have / need);
        this.canvasImg(c, 91.5, y + dy + 2.5, 'ui-rowbarfill-' + Math.round(fw), fw, 7, function (g) {
          rrect(g, 0, 0, fw, 7, 3.5);
          g.fillStyle = vgrad(g, 0, 7, have >= need ? '#ffe680' : '#a6ef7c', have >= need ? '#e9a91c' : '#3fa535');
          g.fill();
        });
      }
      c.add(this.txt(90 + bw + 6, y + dy + 6, have + '/' + need, 10, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      desc = desc.slice(m[0].length);
      dy += 14;
    }
    c.add(this.txt(90, y + dy, desc, dy > 26 ? 10 : 11, '#6a4a2a', { wordWrap: { width: 136 }, lineSpacing: 1 }));
    var b = row.buttons || [];
    b.forEach(function (btn, k) {
      var by = b.length === 1 ? y + ROW_H / 2 : y + 20 + k * 34;
      self.button(c, W - 82, by, 100, 30, btn.label, btn.cb, btn.color || GREEN);
    });
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
    var fw = Math.max(10, (bw - 4) * pct);
    this.canvasImg(c, 28, top + 42, 'ui-beautyfill-' + Math.round(fw), fw, 8, function (g) {
      rrect(g, 0, 0, fw, 8, 4);
      g.fillStyle = vgrad(g, 0, 8, '#ffb3d1', '#d0587a');
      g.fill();
    });
    c.add(this.txt(W - 26, top + 30, next ? next[1] + ' at ' + next[0] : 'Top level!', 11, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(1, 0.5));
  };
})(window.Farm = window.Farm || {});
