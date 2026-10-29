// The UI's bigger panels: the morning report, pause menu, bag, shops and town buildings, the kitchen,
// festivals, the calendar and the friends list. Mixed into UIScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, INK = K.INK, COL = K.COL, SLOT = K.SLOT, ICON = K.ICON;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, BROWN = 0x9a7a4a, GREY = 0xa08a68, RED = 0xc0503a;
  var ROW_H = 74, ROW_STEP = 80;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };

  var M = {};

  // ---------- a generic list panel: title, a line of info, tabs, and rows with buttons ----------
  // o: { title, sub(): string, tabs: [[key, label]], tab, reopen(tab, page), rows: [row], page, talk: villager key }
  // row: { icon | people, name, desc, buttons: [{ label, cb, color }] } (at most two buttons, stacked)
  M.listPanel = function (o) {
    if (this.lookListPanel) return this.lookListPanel(o); // the current look (19i-look.js); later files wrap listPanel itself
    var self = this, c = this.openModal();
    this.panelImg(c, 12, 66, W - 24, 540);
    c.add(this.txt(W / 2, 82, o.title, 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 96, 46, 34, 'X', function () { self.closeModal(); }, RED);
    if (o.talk) {
      this.button(c, 50, 96, 56, 34, 'Talk', function () {
        var r = L.talk(F.session.state, o.talk);
        if (L.hello(F.session.state, o.talk)) world().progress('meet');
        sfx('talk');
        world().changed();
        self.say(o.talk, C.VILLAGERS[o.talk].name, r.line);
      }, BLUE);
    }
    var sub = this.txt(W / 2, 114, '', 13, INK, { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () { sub.setText(o.sub ? o.sub() : ''); };
    showSub();
    o.refresh = showSub;
    var y0 = 146;
    if (o.tabs) {
      var tw = Math.min(136, Math.floor(300 / o.tabs.length) - 8);
      o.tabs.forEach(function (t, k) {
        var x = W / 2 + (k - (o.tabs.length - 1) / 2) * (tw + 8);
        self.button(c, x, 162, tw, 34, t[1], function () {
          if (t[0] === o.tab) return;
          self.closeModal();
          o.reopen(t[0], 0);
        }, t[0] === o.tab ? GREEN : GREY);
      });
      y0 = 186;
    }
    var rows = o.rows, page = o.page || 0, per = rows.length > 5 ? 4 : 5;
    var pages = Math.max(1, Math.ceil(rows.length / per));
    rows.slice(page * per, page * per + per).forEach(function (row, i) { self.listRow(c, y0 + i * ROW_STEP, row); });
    if (!rows.length && o.empty) c.add(this.txt(W / 2, y0 + 50, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    if (pages > 1) {
      var ny = y0 + per * ROW_STEP + 18;
      c.add(this.txt(W / 2, ny, (page + 1) + ' / ' + pages, 15, INK, { fontStyle: 'bold' }).setOrigin(0.5));
      if (page > 0) this.button(c, W / 2 - 90, ny, 90, 34, 'Back', function () { self.closeModal(); o.reopen(o.tab, page - 1); }, GREY);
      if (page < pages - 1) this.button(c, W / 2 + 90, ny, 90, 34, 'More', function () { self.closeModal(); o.reopen(o.tab, page + 1); }, BLUE);
    }
    return o;
  };

  M.listRow = function (c, y, row) {
    if (this.lookListRow) return this.lookListRow(c, y, row);
    var self = this;
    this.baked(c, 28, y, 'ui-row', W - 56, ROW_H, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, W - 56, ROW_H, 10); });
    c.add(this.add.image(34, y + 13, this.slotTex('plain')).setOrigin(0).setScale(1 / F.R));
    if (row.people) {
      F.ensureTexture(this, 'people');
      c.add(this.add.image(36 + SLOT / 2, y + 15 + SLOT - 2, 'people', C.VILLAGER_ORDER.indexOf(row.people) * 9).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 0, 128, 150));
    } else if (row.icon != null) {
      c.add(this.add.image(36 + SLOT / 2, y + 15 + SLOT / 2, 'items', row.icon).setScale(ICON));
    }
    var name = this.txt(88, y + 7, row.name, row.name.length > 18 ? 13 : 14, INK, { fontStyle: 'bold', wordWrap: { width: 138 } });
    c.add(name);
    // a long name takes two lines: the description starts under it
    var dy = Math.max(26, 7 + name.height + 2);
    c.add(this.txt(88, y + dy, row.desc || '', dy > 26 ? 10 : 11, '#6a4a2a', { wordWrap: { width: 138 }, lineSpacing: 1 }));
    var b = row.buttons || [];
    b.forEach(function (btn, k) {
      var by = b.length === 1 ? y + ROW_H / 2 : y + 20 + k * 34;
      self.button(c, W - 82, by, 100, 30, btn.label, btn.cb, btn.color || GREEN);
    });
  };

  // Why a shop is shut, as a dialog text: a festival, the night (its keeper is asleep until 6 AM), or its
  // hours (`otherwise`).
  M.closedText = function (name, owner, otherwise) {
    var s = F.session.state, fest = L.festivalOn(s.day);
    var title = name.toUpperCase() + '\n';
    if (fest) return title + 'Closed today: everyone is at the ' + fest.name + ' in the plaza.';
    if (L.sleepTime(s)) {
      var who = owner && C.VILLAGERS[owner] ? C.VILLAGERS[owner].name + ' is' : 'Everyone is';
      return title + 'Zzz... ' + who + ' sleeping.\nCome back at ' + L.formatTime(C.SHOP_OPEN) + '.';
    }
    return title + otherwise;
  };

  // ---------- morning report ----------
  M.dayReport = function (result, s) {
    var lines = [], names = function (keys) { return keys.map(function (k) { return C.VILLAGERS[k].name; }).join(' and '); };
    // each line with an icon (a name from ICON_ORDER, or a frame number)
    var row = function (icon, text) { lines.push([typeof icon === 'number' ? icon : C.ICON_ORDER.indexOf(icon), text]); };
    if (result.wedding) row('ring', 'Today you married ' + C.VILLAGERS[result.wedding].name + '! The whole town came to celebrate. Your spouse now lives with you on the farm.');
    if (result.newSeason) {
      var seeds = L.seedsInSeason(s.day).filter(function (id) { return id !== 'seed_grass'; });
      row(['spring', 'summer', 'fall', 'winter'][L.date(s.day).season], result.newSeason + ' has arrived! Lily now sells ' + seeds.length + ' new kinds of seeds: ' +
        seeds.map(function (id) { return C.ITEMS[C.ITEMS[id].crop].name.toLowerCase(); }).join(', ') + '.' +
        (result.weeds ? ' Weeds sprouted in your field.' : ''));
    }
    if (result.weekend) row('crate', 'Weekend Market! The stall pays the full price for Sell now, and Lily\'s seeds are ' + Math.round(C.WEEKEND.seedOff * 100) + '% off.');
    if (result.festival) row('calendar', 'Today is the ' + result.festival.name + '! ' + result.festival.desc + ' (Town plaza, ' + L.formatTime(result.festival.from) + ' to ' + L.formatTime(result.festival.to) + '.)');
    if (result.birthdays && result.birthdays.length) row('gift', "It's " + names(result.birthdays) + "'s birthday. A gift today counts double!");
    var w = C.WEATHER[result.weather];
    row(w.icon, 'Weather: ' + w.name + '.' + (w.waters ? ' The rain watered your crops.' : ''));
    if (result.built) row('crate', 'Mira finished your ' + C.BUILDS[result.built].name + '!');
    if (result.homeUp) row('crate', 'Mira finished your ' + L.homeLevel(s).name + ' (Lv ' + result.homeUp + ')! More room to decorate.');
    if (result.visitor) row('heart', C.VILLAGERS[result.visitor.who].name + ' dropped by to see your home: "' + result.visitor.line + '"');
    (result.born || []).forEach(function (i) {
      var a = s.animals[i];
      row(C.ANIMALS[a.kind].icon, a.kind === 'chicken' ? 'A chick hatched! Say hello to ' + a.name + '.' : 'A calf was born! Say hello to ' + a.name + '.');
    });
    if (result.shipped.length) {
      var n = result.shipped.reduce(function (sum, b) { return sum + b.n; }, 0);
      row('coin', 'You shipped ' + n + (n > 1 ? ' items' : ' item') + ' and earned ' + result.earned + 'G!');
    }
    if (result.standSold && result.standSold.length) {
      row('crate', 'Buyers came by your market stall: ' + result.standSold.length + (result.standSold.length > 1 ? ' lots' : ' lot') + ' sold. Collect ' + result.standCoins + 'G at the stall in town.');
    } else if (result.standCoins) {
      row('crate', result.standCoins + 'G is waiting at your market stall in town.');
    }
    var made = Object.keys(result.produced || {}).map(function (id) { return result.produced[id] + ' ' + C.ITEMS[id].name; });
    if (made.length) row('egg', 'Your animals made ' + made.join(', ') + '. Collect them in the pen.');
    if (result.hungry && result.hungry.length) row('chicken_feed', result.hungry.join(', ') + (result.hungry.length > 1 ? ' were' : ' was') + ' hungry. Feed your animals every day.');
    if (result.lunch && s.spouse) row('lunch', C.VILLAGERS[s.spouse].name + ' packed you a ' + C.ITEMS[result.lunch].name + ' for lunch.');
    if (result.horse) row('horse', 'The stable is done, and ' + s.horse.name + ' the horse is waiting there! Walk up to ride.');
    if (result.mail) row('letter', 'You have ' + (result.mail > 1 ? result.mail + ' new letters' : 'a new letter') + ' in the mailbox by the house.');
    if (result.goalDone) row('star', 'Goal complete! Check the next one at the top of the screen.');
    var title = result.days > 1 ? 'WELCOME BACK! ' + result.days + ' DAYS WENT BY' : 'A NEW DAY! ' + L.formatDate(s.day).toUpperCase();
    this.dialog(title + '\n' + lines.map(function (l) { return l[1]; }).join('\n'), null, { rows: lines });
    sfx('morning');
  };

  // ---------- pause menu ----------
  M.openPause = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    // The farmer card (owner, 29 Oct: option E): your farmer, name, birthday and the date on top; Resume (green) and
    // Leave game (red) side by side; picture tiles for the places; round switches for the sounds; New game small, at
    // the very bottom (it still asks first).
    var canLeave = !!(window.gameHost && typeof window.gameHost.exit === 'function');
    var canShare = !!(window.gameHost && typeof window.gameHost.share === 'function');
    var inApp = !!(window.gameHost && typeof window.gameHost.remind === 'function');
    var reopen = function () { self.closeModal(); self.openPause(); };
    var PH = 422, top = Math.round((C.HEIGHT - PH) / 2), L0 = 42, R0 = W - 42; // centred, like every panel
    this.panelImg(c, 30, top, W - 60, PH);
    c.add(this.txt(W / 2, top + 10, 'Paused', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    // the card
    var cy = top + 44, card = this.add.graphics();
    card.fillStyle(0xfff6dc, 1).fillRoundedRect(L0, cy, R0 - L0, 78, 12);
    card.lineStyle(1.5, 0x7a4d26, 0.35).strokeRoundedRect(L0, cy, R0 - L0, 78, 12);
    card.fillStyle(0xf2d79a, 1).fillCircle(L0 + 36, cy + 39, 28);
    c.add(card);
    var face = this.add.image(L0 + 36, cy + 41, F.playerKey(this), 0).setCrop(0, 0, 256, 250);
    face.setScale(0.24).setOrigin(0.5, 0.42);
    c.add(face);
    var nm = this.txt(L0 + 74, cy + 18, L.farmerName(s), 17, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    if (nm.width > 130) nm.setScale(130 / nm.width);
    c.add(nm);
    var tap = function (x, y, w, h, cb) {
      var z = self.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
      F.tapOn(z, cb);
      return z;
    };
    var renameRow = this.add.container(0, 0);
    renameRow.add(this.txt(R0 - 12, cy + 18, 'Rename', 12, '#2f6fae', { fontStyle: 'bold' }).setOrigin(1, 0.5));
    renameRow.add(tap(R0 - 40, cy + 18, 76, 30, function () { self.closeModal(); self.askFarmerName(function () { self.openPause(); }); }));
    c.add(renameRow);
    if (this.askBirthday) { // your birthday, under your name (tap to set or change it)
      var b = L.birthdayOf ? L.birthdayOf(s) : null, bd = this.add.container(0, 0);
      bd.add(this.add.image(L0 + 82, cy + 41, 'items', C.ICON.cake).setScale(0.15));
      bd.add(this.txt(L0 + 96, cy + 41, b ? 'Birthday: ' + C.MONTHS[b.month - 1].slice(0, 3) + ' ' + b.day : 'Set your birthday', 13, b ? INK : '#2f6fae', b ? {} : { fontStyle: 'bold' }).setOrigin(0, 0.5));
      bd.add(tap(L0 + 150, cy + 41, 160, 24, function () { self.closeModal(); self.askBirthday(function () { self.openPause(); }); }));
      c.add(bd);
    }
    c.add(this.txt(L0 + 74, cy + 62, L.formatDate(s.day) + ', ' + L.date(s.day).year + '  ·  ' + L.formatTime(s.time), 12, '#8a6a4a').setOrigin(0, 0.5));
    // Resume and Leave game
    var by = cy + 108, half = (R0 - L0 - 10) / 2;
    if (canLeave) {
      this.button(c, L0 + half / 2, by, half, 44, 'Resume', function () { self.closeModal(); }, GREEN);
      // In the Selebox app the host offers gameHost.exit: save, then hand the screen back to the app.
      this.button(c, R0 - half / 2, by, half, 44, 'Leave game', function () {
        world().save();
        self.closeModal();
        self.toast('Saving your farm...', 1200);
        window.gameHost.exit();
      }, RED);
    } else {
      this.button(c, W / 2, by, R0 - L0, 44, 'Resume', function () { self.closeModal(); }, GREEN);
    }
    // picture tiles, 4 a row
    var tw = (R0 - L0 - 18) / 4, th = 58;
    var tile = function (k, ty, icon, label, cb, on) {
      var tx = L0 + k * (tw + 6), g = self.add.graphics(), rc = self.add.container(0, 0);
      var fill = on === true ? 0xd8efc4 : on === false ? 0xe9dcc2 : 0xfff6dc;
      g.fillStyle(fill, 1).fillRoundedRect(tx, ty, tw, th, 10);
      g.lineStyle(1.5, on === true ? 0x5fa84a : 0x7a4d26, on === true ? 0.9 : 0.3).strokeRoundedRect(tx, ty, tw, th, 10);
      rc.add(g);
      var im = self.add.image(tx + tw / 2, ty + 22, 'items', C.ICON[icon]).setScale(0.2);
      if (on === false) im.setAlpha(0.45);
      rc.add(im);
      var t = self.txt(tx + tw / 2, ty + 46, label, 11, INK, { fontStyle: 'bold' }).setOrigin(0.5);
      if (t.width > tw - 6) t.setScale((tw - 6) / t.width);
      rc.add(t);
      rc.add(tap(tx + tw / 2, ty + th / 2, tw, th, cb));
      c.add(rc);
    };
    var t1 = by + 36, t2 = t1 + th + 8, t3 = t2 + th + 8;
    tile(0, t1, 'calendar', 'Calendar', function () { self.openCalendar(0); });
    tile(1, t1, 'heart', 'Friends', function () { self.openFriends(); });
    tile(2, t1, 'book', 'Collection', function () { self.openCollection(); });
    if (this.openNews) tile(3, t1, 'sparkle', "What's new", function () { self.closeModal(); self.openNews(0, function () { self.openPause(); }); });
    tile(0, t2, 'hoe', 'How to play', function () { self.help(); });
    tile(1, t2, 'bag', 'Save now', function () { world().save(); self.toast('Game saved.'); });
    if (canShare) tile(2, t2, 'letter', 'Share farm', function () { self.shareFarm(); });
    // sounds: a switch each (green = on)
    tile(0, t3, 'note', 'Music: ' + (s.opts.music ? 'on' : 'off'), function () { s.opts.music = s.opts.music ? 0 : 1; if (F.Audio) F.Audio.apply(s.opts); F.session.dirty = true; reopen(); }, !!s.opts.music);
    tile(1, t3, 'bubble', 'Sounds: ' + (s.opts.sfx ? 'on' : 'off'), function () { s.opts.sfx = s.opts.sfx ? 0 : 1; if (F.Audio) F.Audio.apply(s.opts); F.session.dirty = true; reopen(); }, !!s.opts.sfx);
    // In the app: the phone reminds you when a crop is ripe (the FPS meter stays in the page on its own)
    if (inApp) tile(2, t3, 'exclaim', 'Alerts: ' + (s.opts.alerts !== 0 ? 'on' : 'off'), function () { s.opts.alerts = s.opts.alerts === 0 ? 1 : 0; F.session.dirty = true; world().save(); reopen(); }, s.opts.alerts !== 0);
    else tile(2, t3, 'bolt', 'FPS: ' + (self.fpsText.visible ? 'on' : 'off'), function () { F.showFps = !self.fpsText.visible; self.fpsText.setVisible(F.showFps); reopen(); }, self.fpsText.visible);
    // New game: small, at the bottom, and it asks first
    var fy = t3 + th + 18, ng = this.add.container(0, 0);
    ng.add(this.txt(L0 + 4, fy, 'New game', 13, '#b8402a', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    ng.add(tap(L0 + 34, fy, 84, 28, function () {
      self.confirm('START A NEW FARM?\nYour current farm, gold, crops, animals and friendships will be gone for good.', function () {
        self.newGame();
      });
    }));
    c.add(ng);
    if (C.NEWS_LATEST) c.add(this.txt(R0 - 4, fy, 'Harvest Ville v' + C.NEWS_LATEST, 12, '#8a6a4a').setOrigin(1, 0.5));
  };

  // ---------- a new farm: play as the boy or the girl ----------
  M.chooseLook = function (done) {
    var self = this, s = F.session.state;
    var c = this.openModal(function () {}); // Back doesn't skip the choice
    this.panelImg(c, 20, 120, W - 40, 400);
    c.add(this.txt(W / 2, 142, 'Who will you play?', 21, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, 172, 'Pick your farmer.', 14, '#7a5a3a').setOrigin(0.5, 0));
    var pick = function (look) {
      s.look = look;
      F.session.dirty = true;
      if (F.world && F.world.applyLook) F.world.applyLook();
      sfx('coin');
      self.closeModal();
      if (look === 'boy') { // the girl's sheet was only needed for the picture: free its memory
        ['down', 'up', 'side'].forEach(function (d) { self.anims.remove('walk-' + d + '-g'); });
        self.textures.remove('player_girl');
      }
      done();
    };
    [['boy', 'player', 'Boy', 0x4a90c9, 0xbfe0f0], ['girl', 'player_girl', 'Girl', 0xd9669a, 0xf8d3e4]].forEach(function (o, i) {
      var x = W / 2 + (i ? 72 : -72);
      self.baked(c, x - 62, 200, 'ui-look-' + o[0], 124, 210, function (g) {
        g.fillStyle(COL.slotEdge, 1).fillRoundedRect(0, 0, 124, 210, 12);
        g.fillStyle(o[4], 1).fillRoundedRect(4, 4, 116, 202, 10);
      });
      c.add(self.add.image(x, 398, F.ensureTexture(self, o[1]), 0).setOrigin(0.5, 1).setScale(0.48));
      var z = self.add.zone(x, 305, 124, 210).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () { pick(o[0]); });
      c.add(z);
      self.button(c, x, 456, 112, 44, o[2], function () { pick(o[0]); }, o[3]);
    });
  };

  // Replaces the save with a fresh farm and restarts both scenes on it.
  M.newGame = function () {
    F.session = F.newSession(null);
    F.Host.save(F.session.state);
    F.input.reset();
    F.ui = null; // the world idles until the new UI scene is up
    world().scene.restart();
    this.scene.restart();
  };

  // ---------- the bag ----------
  M.openInventory = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    // a bigger bag (Lily's Supplies) adds rows: everything below the slots moves down with them
    var cols = 6, gap = 6, x0 = (W - (cols * SLOT + (cols - 1) * gap)) / 2, rowsN = Math.ceil(s.inv.length / cols);
    var extra = (rowsN - 3) * (SLOT + gap), top = Math.max(70, 104 - extra / 2), y0 = top + 56, dy = y0 - 160 + extra;
    this.panelImg(c, 14, top, W - 28, 430 + extra);
    c.add(this.txt(W / 2, top + 18, 'Bag', 21, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var widgets = [];
    var name = this.txt(W / 2, 318 + dy, '', 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    var desc = this.txt(W / 2, 342 + dy, '', 13, INK, { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0);
    var mats = this.txt(W / 2, 404 + dy, '', 13, '#5a3a1e', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5, 0);
    var NOTE = 'Tap an item to hold it. The first row is your hotbar: tap Move to put an item there.';
    var note = this.txt(W / 2, 428 + dy, NOTE, 12, '#7a5a3a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add([name, desc, mats, note]);
    // Move (owner, 27 Oct): pick up the held item, then tap the slot to put it in (a swap, or stacked with the same item)
    var moving = null;
    for (var i = 0; i < s.inv.length; i++) {
      (function (i) {
        var x = x0 + (i % cols) * (SLOT + gap), y = y0 + Math.floor(i / cols) * (SLOT + gap);
        widgets.push(self.slotWidget(c, x, y, function () {
          if (moving != null) {
            var r = L.moveSlot(s, moving, i);
            moving = null;
            if (r === 'ok') { sfx('pick'); F.session.dirty = true; world().hintKey = null; world().save(); }
            self.refresh();
            return;
          }
          if (s.sel === i && s.inv[i]) { self.closeModal(); return; }
          s.sel = i;
          F.session.dirty = true;
          world().hintKey = null;
          self.refresh();
        }));
      })(i);
    }
    var eatBtn = this.button(c, W / 2 - 108, 488 + dy, 96, 42, 'Eat', function () {
      world().eat();
      self.refresh();
    }, BLUE);
    var moveBtn = this.button(c, W / 2, 488 + dy, 96, 42, 'Move', function () {
      if (!L.held(s)) return;
      moving = s.sel;
      self.refresh();
    }, BROWN);
    var stopBtn = this.button(c, W / 2, 488 + dy, 96, 42, 'Cancel', function () { moving = null; self.refresh(); }, GREY);
    this.button(c, W / 2 + 108, 488 + dy, 96, 42, 'Close', function () { self.closeModal(); });
    this.invRefresh = function () {
      widgets.forEach(function (w, i) {
        self.drawSlot(w, s.inv[i], s.sel === i);
        w.icon.setAlpha(moving === i ? 0.45 : 1); // the one being moved
      });
      var held = L.held(s);
      moveBtn.setVisible(moving == null && !!held);
      stopBtn.setVisible(moving != null);
      note.setText(moving != null && s.inv[moving] ? 'Now tap where to put the ' + L.itemName(s, s.inv[moving].id) + '. The first row is your hotbar.' : NOTE);
      name.setText(held ? L.itemName(s, held.id) + (held.n > 1 ? '  x' + held.n : '') : 'Empty hands');
      var d = held ? C.ITEMS[held.id].desc : 'Choose something to hold.';
      if (held && L.energyOf(held.id)) d += ' (+' + L.energyOf(held.id) + ' energy)';
      if (held && C.ITEMS[held.id].sell) d += ' Sells for ' + C.ITEMS[held.id].sell + 'G.';
      desc.setText(d);
      mats.setText('Lumber ' + s.lumber + '     Stone ' + s.stone);
      eatBtn.setVisible(!!held && L.energyOf(held.id) > 0);
    };
    this.invRefresh();
  };

  // ---------- Lily's seed stand ----------
  M.buyButtons = function (id, qtys, after) {
    var self = this, s = F.session.state, item = C.ITEMS[id];
    return qtys.map(function (qty, k) {
      return {
        label: (qty > 1 ? 'Buy ' + qty : 'Buy') + ' ' + L.priceOf(id, s.day) * qty + 'G', color: k ? BLUE : GREEN,
        cb: function () {
          if (item.kind === 'tool' && L.hasItem(s, id)) return self.toast('You already have a ' + item.name + '.');
          var r = L.buy(s, id, qty);
          if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
          if (r === 'full') return self.toast('Your bag is full.');
          sfx('coin');
          self.toast('Bought ' + qty + ' ' + item.name + '.');
          world().changed();
          world().save();
          if (after) after();
        },
      };
    });
  };

  M.openShop = function (tab, page) {
    var self = this, s = F.session.state, o;
    tab = tab || 'seeds';
    var rows = [];
    var itemRow = function (id, qtys) {
      var item = C.ITEMS[id];
      return { icon: item.icon, name: item.name, desc: item.shop || item.desc, buttons: self.buyButtons(id, qtys, function () { o.refresh(); }) };
    };
    if (tab === 'seeds') {
      L.seedsInSeason(s.day).forEach(function (id) { rows.push(itemRow(id, [1, 5])); });
    } else if (tab === 'animals') {
      C.SHOP_ANIMALS.forEach(function (kind) {
        var def = C.ANIMALS[kind];
        rows.push({
          icon: def.icon, name: def.name + ' ' + L.animalCount(s, kind) + '/' + L.capacity(s, kind), desc: def.shop,
          buttons: [{
            label: 'Buy ' + def.price + 'G', cb: function () {
              var r = L.buyAnimal(s, kind);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              if (r === 'full') return self.toast('The ' + def.home + ' is full. Mira can build a bigger one.');
              if (world().herd) world().herd.add(r);
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openShop('animals');
              self.toast('Meet ' + s.animals[r].name + '! Your new ' + def.name.toLowerCase() + ' is in the pen.');
            },
          }],
        });
      });
      C.SHOP_FEED.forEach(function (id) { rows.push(itemRow(id, [1, 5])); });
    } else {
      var bag = L.nextBag(s);
      if (bag) {
        rows.push({
          icon: C.ICON.bag, name: 'Bigger Bag', desc: bag.size + ' slots (now ' + s.inv.length + '): room for more crops, fish and ore.',
          buttons: [{
            label: 'Buy ' + bag.price + 'G', cb: function () {
              var r = L.upgradeBag(s);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openShop('supplies');
              self.toast('Your bag holds ' + s.inv.length + ' things now!', 2400, 0x2f5a22);
            },
          }],
        });
      }
      C.SHOP_SUPPLIES.forEach(function (id) { rows.push(itemRow(id, [1])); });
    }
    o = this.listPanel({
      title: "Lily's Seed Stand", tab: tab, page: page,
      tabs: [['seeds', 'Seeds'], ['animals', 'Animals'], ['supplies', 'Supplies']],
      sub: function () { return 'You have ' + s.gold + 'G' + (L.weekendMarket(s.day) && tab === 'seeds' ? '   Weekend Market: seeds ' + Math.round(C.WEEKEND.seedOff * 100) + '% off!' : ''); },
      rows: rows, reopen: this.openShop.bind(this), talk: 'lily',
      empty: 'LILY: Nothing grows in winter!\nCome back in spring for seeds.\nMeanwhile, see the Animals tab for feed.',
    });
  };

  // ---------- town buildings ----------
  M.openBuilding = function (key) {
    var s = F.session.state, b = C.BUILDINGS[key];
    var ownerInside = C.VILLAGER_ORDER.filter(function (k) { return L.villagerAt(s, k, s.time) === 'in:' + key; })[0];
    if (!b.open) { // a home
      if (ownerInside) {
        var r = L.talk(s, ownerInside);
        sfx('door');
        world().changed();
        return this.say(ownerInside, C.VILLAGERS[ownerInside].name, '(You knock, and the door opens.)\n' + r.line);
      }
      return this.dialog(b.name.toUpperCase() + '\nYou knock, but nobody is home.');
    }
    if (!L.buildingOpen(s, key)) return this.dialog(this.closedText(b.name, b.owner, 'Closed. Open ' + L.formatTime(b.open[0]) + ' to ' + L.formatTime(b.open[1]) + '.'));
    sfx('door');
    if (key === 'forge') return this.openForge();
    if (key === 'woodshop') return this.openWoodshop('build');
    if (key === 'inn') return this.openFoodShop('inn');
    if (key === 'clinic') return this.openFoodShop('clinic');
    if (key === 'mayor') return this.mayorTalk();
  };

  M.mayorTalk = function () {
    var s = F.session.state, r = L.talk(s, 'hollis'), next = this.upcoming(s.day, 60).filter(function (e) { return e.fest; })[0];
    world().changed();
    this.say('hollis', 'Mayor Hollis', r.line + (next ? '\n\n"Our next festival is the ' + next.fest.name + ' on ' + L.formatDate(next.day) + '. ' + next.fest.desc + '"' : ''));
  };

  M.openForge = function () {
    var self = this, s = F.session.state, o;
    var rows = C.TOOL_KEYS.map(function (tool) {
      var cost = L.upgradeCost(s, tool), next = L.toolLevel(s, tool) + 1;
      return {
        icon: L.iconOf(s, tool), name: L.itemName(s, tool),
        // what the upgrade does, then its price as chips (gold and ore)
        desc: cost ? L.upgradeText(s, tool) : 'Fully upgraded! The best ' + C.ITEMS[tool].name.toLowerCase() + ' in the valley.',
        reward: cost ? { gold: cost.gold, item: cost.ore, n: cost.n } : null, rewardPrefix: 'Cost', buttonsBelow: true,
        buttons: cost ? [{
          label: 'Upgrade', cb: function () {
            var r = L.upgradeTool(s, tool);
            if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
            if (r === 'ore') { sfx('nope'); return self.toast('You need ' + cost.n + ' ' + C.ITEMS[cost.ore].name + '. Find ore in the mine.'); }
            sfx('anvil');
            world().changed();
            world().save();
            self.closeModal();
            self.openForge();
            self.toast('Clang! Bram made you a ' + L.itemName(s, tool) + '. Hold the action button to use it on more tiles at once.');
          },
        }] : [],
      };
    });
    o = this.listPanel({
      title: "Bram's Forge", rows: rows, talk: 'bram', reopen: function () { self.openForge(); },
      sub: function () {
        return s.gold + 'G   Ore: ' + ['ore_copper', 'ore_silver', 'ore_gold'].map(function (id) { return L.countItem(s, id) + ' ' + C.ITEMS[id].name.split(' ')[0]; }).join(', ');
      },
    });
  };

  M.openWoodshop = function (tab, page) {
    var self = this, s = F.session.state, o, rows;
    tab = tab || 'build';
    if (tab === 'build') {
      rows = C.BUILD_KEYS.filter(function (id) { return C.BUILDS[id]; }).map(function (id) {
        var b = C.BUILDS[id], building = s.project && s.project.id === id;
        var cost = b.gold + 'G, ' + b.lumber + ' lumber' + (b.stone ? ', ' + b.stone + ' stone' : '');
        return {
          icon: { kitchen: C.ICON.lunch, bighouse: C.ICON.ring, coop2: C.ICON.chicken, barn2: C.ICON.cow, stable: C.ICON.horse }[id],
          name: b.name, desc: s.builds[id] ? 'Built!' : building ? 'Mira is building it. Ready tomorrow.' : cost + '. ' + b.desc,
          buttons: s.builds[id] || building ? [] : [{
            label: 'Build', cb: function () {
              var r = L.startBuild(s, id);
              var why = { busy: 'Mira is busy with another job. One at a time!', gold: 'Not enough gold.', lumber: 'You need ' + b.lumber + ' lumber. Chop branches and stumps, or buy some.', stone: 'You need ' + b.stone + ' stone.' };
              if (r !== 'ok') { sfx('nope'); return self.toast(why[r] || 'Hmm.'); }
              sfx('hammer');
              world().changed();
              world().save();
              self.closeModal();
              self.openWoodshop('build');
              self.say('mira', 'Mira', "Deal! I'll have your " + b.name + ' ready by tomorrow morning.');
            },
          }],
        };
      });
    } else if (tab === 'furniture') {
      rows = C.FURNITURE_KEYS.map(function (id) {
        var f = C.FURNITURE[id];
        return {
          icon: f.icon, name: f.name, desc: s.builds[id] ? 'In your house!' : f.gold + 'G. ' + f.desc,
          buttons: s.builds[id] ? [] : [{
            label: 'Buy ' + f.gold + 'G', cb: function () {
              var r = L.buyFurniture(s, id);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              if (r !== 'ok') return;
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openWoodshop('furniture');
              self.toast(id === 'f_cat' ? 'A cat named ' + s.cat.name + ' moved into your house!' : 'Mira delivered the ' + f.name + ' to your house!');
            },
          }],
        };
      });
    } else {
      rows = [['lumber', C.LUMBER_PRICE], ['stone', C.STONE_PRICE]].map(function (m) {
        return {
          icon: C.ICON[m[0]], name: m[0] === 'lumber' ? 'Lumber' : 'Stone', desc: m[1] + 'G each. For building.',
          buttons: [1, 10].map(function (n, k) {
            return {
              label: 'Buy ' + n + ' ' + m[1] * n + 'G', color: k ? BLUE : GREEN, cb: function () {
                if (L.buyMaterial(s, m[0], n) !== 'ok') { sfx('nope'); return self.toast('Not enough gold.'); }
                sfx('coin');
                o.refresh();
                world().changed();
              },
            };
          }),
        };
      });
    }
    o = this.listPanel({
      title: "Mira's Woodshop", tab: tab, page: page, rows: rows, talk: 'mira', reopen: this.openWoodshop.bind(this),
      tabs: [['build', 'Build'], ['furniture', 'Furniture'], ['materials', 'Materials']],
      sub: function () { return s.gold + 'G   Lumber ' + s.lumber + '   Stone ' + s.stone; },
    });
  };

  // The inn (Rosa's meals) and the clinic (Ivy's tonic): eat it here, or take it with you.
  M.openFoodShop = function (key) {
    var self = this, s = F.session.state, o, inn = key === 'inn';
    var rows = (inn ? C.INN_MENU : C.CLINIC_MENU).map(function (id) {
      var item = C.ITEMS[id];
      return {
        icon: item.icon, name: item.name, desc: item.desc + ' +' + item.energy + ' energy.',
        buttons: [{
          label: (inn ? 'Eat ' : 'Drink ') + item.price + 'G', cb: function () {
            if (s.energy >= L.maxEnergy(s)) return self.toast("You're already full of energy.");
            if (s.gold < item.price) { sfx('nope'); return self.toast('Not enough gold.'); }
            s.gold -= item.price;
            s.energy = Math.min(L.maxEnergy(s), s.energy + item.energy);
            sfx('eat');
            o.refresh();
            world().changed();
            self.toast('Delicious! +' + item.energy + ' energy.');
          },
        }].concat(self.buyButtons(id, [1], function () { o.refresh(); }).map(function (b) { b.label = 'Take ' + item.price + 'G'; b.color = BLUE; return b; })),
      };
    });
    o = this.listPanel({
      title: inn ? 'Sunny Inn' : "Ivy's Clinic", rows: rows, talk: inn ? 'rosa' : 'ivy', reopen: function () { self.openFoodShop(key); },
      sub: function () { return s.gold + 'G   Energy ' + s.energy + '/' + L.maxEnergy(s) + (inn ? '' : '\nIvy: "Rest well and eat well, farmer!"'); },
    });
  };

  // ---------- the kitchen ----------
  M.openKitchen = function (tab, page) {
    var self = this, s = F.session.state;
    var rows = C.RECIPES.map(function (r) {
      var dish = C.ITEMS[r.dish], ok = L.hasIngredients(s, r);
      return {
        icon: dish.icon, name: dish.name, desc: 'Needs ' + r.needs.map(L.ingredientName).join(' + ') + '. +' + dish.energy + ' energy.',
        buttons: [{
          label: 'Cook', color: ok ? GREEN : GREY, cb: function () {
            var res = L.cook(s, r);
            if (res === 'missing') { sfx('nope'); return self.toast('You need ' + r.needs.map(L.ingredientName).join(' + ') + '.'); }
            if (res === 'full') return self.toast('Your bag is full.');
            sfx('cook');
            world().changed();
            self.closeModal();
            self.openKitchen(null, page);
            self.toast('You cooked ' + dish.name + '!');
          },
        }],
      };
    });
    this.listPanel({
      title: 'Kitchen', rows: rows, page: page, reopen: this.openKitchen.bind(this),
      sub: function () { return 'Dishes restore lots of energy. Eat them from your bag.'; },
    });
  };

  // ---------- festivals ----------
  M.openFestival = function (fest, page) {
    var self = this, s = F.session.state;
    if (L.joinedFestival(s, fest)) return this.say('hollis', 'Mayor Hollis', 'Thank you for joining the ' + fest.name + '! Enjoy the rest of the day.');
    var finish = function (r) {
      if (r.error) {
        var why = { nocrop: 'Hold on, that is not a crop!', nocow: 'You need a grown cow to enter the Cow Festival.', choice: 'Hmm?' };
        return self.toast(why[r.error] || 'Hmm.');
      }
      sfx('fanfare');
      self.closeAll();
      self.fireworks(fest.key === 'flower' ? 'petals' : fest.key === 'starry' ? 'stars' : 'fireworks');
      s.time = Math.max(s.time, fest.to - 10);
      world().changed();
      world().save();
      self.dialog(fest.name.toUpperCase() + '\n' + r.text);
    };
    // the judging, with a drumroll
    var judged = function (intro, play) {
      self.closeAll();
      self.playLines([['hollis', intro]], function () {
        sfx('drumroll');
        self.dialog('...', [{ label: 'And the winner is...', cb: function () { finish(play()); } }]);
      });
    };
    if (fest.kind === 'cow') {
      var cows = s.animals.filter(function (a) { return a.kind === 'cow' && !a.young; });
      if (!cows.length) return this.say('hollis', 'Mayor Hollis', 'Welcome to the Cow Festival! Bring a grown cow next year and enter the contest.');
      var best = cows.reduce(function (a, b) { return b.love > a.love ? b : a; });
      return this.dialog('THE COW FESTIVAL\nYour happiest cow, ' + best.name + ', will compete for the blue ribbon. Ready?', [{ label: 'Not yet', color: GREY }, {
        label: 'Enter', cb: function () {
          judged('Here comes ' + best.name + ' from Harvest Ville! What a shiny coat. The judges are taking notes...', function () { return L.joinFestival(s, fest); });
        },
      }]);
    }
    // a dance (a rhythm mini-game) or an evening together
    var withPartner = function (k) {
      self.closeAll();
      if (fest.kind === 'dance') {
        self.startDance(k, function (score) { finish(L.joinFestival(s, fest, k, score)); });
        return;
      }
      self.fireworks(fest.key === 'starry' ? 'stars' : 'fireworks');
      var lines = fest.key === 'starry'
        ? [[k, 'So many stars tonight... Quick, make a wish!'], [k, 'I already know what mine is. Maybe someday I will tell you.']]
        : [[k, 'Ooh! Look at that one! It is like a flower blooming in the sky.'], [k, 'I am really glad I am watching this with you.']];
      self.playLines(lines, function () { finish(L.joinFestival(s, fest, k)); });
    };
    var rows;
    if (fest.kind === 'harvest') {
      var seen = {};
      rows = [];
      s.inv.forEach(function (slot, i) {
        if (!slot || C.ITEMS[slot.id].kind !== 'crop' || seen[slot.id]) return;
        seen[slot.id] = 1;
        rows.push({ icon: C.ITEMS[slot.id].icon, name: C.ITEMS[slot.id].name, desc: 'Sells for ' + C.ITEMS[slot.id].sell + 'G.', buttons: [{
          label: 'Enter', cb: function () {
            judged('Our next entry: a ' + C.ITEMS[slot.id].name + ' from Harvest Ville! The judges take a bite...', function () { return L.joinFestival(s, fest, i); });
          },
        }] });
      });
    } else {
      rows = C.VILLAGER_ORDER.filter(function (k) { return k !== 'hollis' && L.friend(s, k).met; }).map(function (k) {
        return {
          people: k, name: C.VILLAGERS[k].name, desc: L.friendHearts(s, k) + ' hearts',
          buttons: [{ label: fest.kind === 'dance' ? 'Dance' : 'Invite', cb: function () { withPartner(k); } }],
        };
      });
    }
    this.listPanel({
      title: fest.name, rows: rows, page: page, reopen: function (t, p) { self.openFestival(fest, p); },
      sub: function () { return fest.desc; },
      empty: fest.kind === 'harvest' ? 'Bring a crop in your bag to enter!' : 'Make some friends in town first!',
    });
  };

  // Celebration particles over the whole screen for a few seconds.
  M.fireworks = function (kind) {
    var self = this, tex = this.bake('ui-spark', 10, 10, function (g) { g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5); });
    var colors = kind === 'stars' ? [0xfff6c0, 0xbfe0ff] : kind === 'petals' ? [0xffb3d1, 0xfff0f6, 0xffd23f] : [0xff5a5a, 0xffd23f, 0x6ad1ff, 0x9cff6a, 0xff8ae0];
    var n = 0;
    var timer = this.time.addEvent({
      delay: 420, repeat: 9, callback: function () {
        var x = Phaser.Math.Between(60, W - 60), y = Phaser.Math.Between(110, 330);
        var p = self.add.particles(x, y, tex, {
          speed: kind === 'fireworks' ? { min: 60, max: 170 } : { min: 15, max: 60 }, lifespan: 1100, scale: { start: 0.9 / F.R * 2, end: 0 },
          tint: colors[n++ % colors.length], gravityY: kind === 'fireworks' ? 120 : 30, emitting: false,
        }).setDepth(260);
        p.explode(kind === 'fireworks' ? 36 : 14);
        if (kind === 'fireworks') sfx('boom');
        self.time.delayedCall(1300, function () { p.destroy(); });
      },
    });
    return timer;
  };

  // ---------- calendar, notice board, friends ----------
  // Festivals and birthdays in the next `days` days (including today).
  M.upcoming = function (from, days) {
    var out = [];
    for (var d = from; d < from + days; d++) {
      var fest = L.festivalOn(d);
      if (fest) out.push({ day: d, fest: fest });
      if (L.myBirthdayOn && L.myBirthdayOn(F.session.state, d)) out.push({ day: d, mine: true });
      L.birthdaysOn(d).forEach(function (k) { out.push({ day: d, birthday: k }); });
    }
    return out;
  };

  M.noticeBoard = function () {
    var s = F.session.state, events = this.upcoming(s.day, 14);
    var lines = events.map(function (e) {
      return (e.day === s.day ? 'TODAY' : L.formatDate(e.day)) + ': ' + (e.mine ? 'Your birthday!' : e.fest ? e.fest.name + ' (plaza)' : C.VILLAGERS[e.birthday].name + "'s birthday");
    });
    this.dialog('TOWN NOTICE BOARD\n' + (lines.length ? lines.join('\n') : 'Nothing planned in the next two weeks.') + '\n\nThe calendar in the pause menu shows the whole season.');
  };

  // The real month, Monday first: today, festivals, birthdays, and the weather for today and tomorrow.
  M.openCalendar = function (offset) {
    var self = this, s = F.session.state, d = L.date(s.day);
    var m = d.month - 1 + offset, y = d.year + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    var first = L.dayOf(new Date(y, m, 1, 12).getTime()), n = L.dayOf(new Date(y, m + 1, 1, 12).getTime()) - first;
    var lead = (L.date(first).weekday + 6) % 7; // empty cells before the 1st (Monday first)
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 520);
    c.add(this.txt(W / 2, 88, C.MONTHS[m] + ' ' + y + '  (' + L.date(first).name + ')', 18, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); }, RED);
    var cw = 44, ch = 44, x0 = (W - 7 * cw) / 2, y0 = 120;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (name, k) {
      c.add(self.txt(x0 + k * cw + cw / 2, y0, name, 11, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    });
    var events = [];
    for (var i = 0; i < n; i++) {
      var day = first + i, cell = lead + i, x = x0 + (cell % 7) * cw, y = y0 + 18 + Math.floor(cell / 7) * ch;
      var fest = L.festivalOn(day), bdays = L.birthdaysOn(day), today = day === s.day, mine = L.myBirthdayOn && L.myBirthdayOn(s, day);
      var kind = today ? 'today' : day < s.day ? 'past' : 'day';
      this.baked(c, x + 2, y, 'ui-cal2-' + kind, cw - 4, ch - 4, (function (kind) {
        return function (g) {
          g.fillStyle(kind === 'today' ? 0xffd23f : kind === 'past' ? 0xd8bf8a : 0xe8cf98, 1).fillRoundedRect(0, 0, cw - 4, ch - 4, 6);
          if (kind === 'today') g.lineStyle(2, 0x5a3a1e, 1).strokeRoundedRect(1, 1, cw - 6, ch - 6, 6);
        };
      })(kind));
      c.add(this.txt(x + 6, y + 2, String(i + 1), 11, INK, { fontStyle: 'bold' }));
      var soon = day >= s.day && day <= s.day + 1;
      if (mine) c.add(this.add.image(x + cw / 2 + 4, y + 27, 'items', C.ICON.cake).setScale(0.15)); // your birthday (01-logicB.js)
      else if (fest) c.add(this.add.image(x + cw / 2 + 4, y + 27, 'items', C.ICON.ribbon).setScale(0.15));
      else if (bdays.length) c.add(this.add.image(x + cw / 2 + 4, y + 27, 'items', C.ICON.gift).setScale(0.15));
      else if (soon) c.add(this.add.image(x + cw / 2 + 4, y + 27, 'items', C.WEATHER[L.weather(s, day)].icon).setScale(0.11).setAlpha(0.9));
      if (mine) events.push(C.MONTHS[m].slice(0, 3) + ' ' + (i + 1) + '  Your birthday!');
      if (fest) events.push(C.MONTHS[m].slice(0, 3) + ' ' + (i + 1) + '  ' + fest.name);
      bdays.forEach(function (k) { events.push(C.MONTHS[m].slice(0, 3) + ' ' + (i + 1) + '  ' + C.VILLAGERS[k].name + "'s birthday"); });
    }
    var rows = Math.ceil((lead + n) / 7);
    events.push('Every Sat & Sun  Weekend Market');
    c.add(this.txt(W / 2, y0 + 18 + rows * ch + 8, events.join('\n'), 13, INK, { align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0));
    if (offset > 0) this.button(c, W / 2 - 80, 556, 130, 38, 'Back', function () { self.closeModal(); self.openCalendar(offset - 1); }, GREY);
    else if (this.askBirthday) this.button(c, W / 2 - 80, 556, 130, 38, s.bd ? 'My birthday' : 'Set birthday', function () { self.closeModal(); self.askBirthday(function () { self.openCalendar(0); }); }, BROWN);
    if (offset < 11) this.button(c, W / 2 + 80, 556, 130, 38, 'Next month', function () { self.closeModal(); self.openCalendar(offset + 1); }, BLUE);
  };

  M.openCollection = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 530);
    c.add(this.txt(W / 2, 88, 'Collection', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); }, RED);
    c.add(this.txt(W / 2, 116, L.collectionCount(s) + ' of ' + C.COLLECTION.length + ' found', 13, '#7a5a3a').setOrigin(0.5, 0));
    // the records sit beside the bottom of the grid, so the panel always holds them (70 items = 10 rows)
    var big = C.COLLECTION.length > 70, cols = big ? 8 : 7, cell = big ? 36 : 40, x0 = (W - cols * cell) / 2, y0 = 136;
    C.COLLECTION.forEach(function (id, i) {
      var x = x0 + (i % cols) * cell, y = y0 + Math.floor(i / cols) * cell, got = L.discovered(s, id);
      self.baked(c, x + 2, y + 2, 'ui-colcell' + cell, cell - 4, cell - 4, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, cell - 4, cell - 4, 7); });
      var icon = self.add.image(x + cell / 2, y + cell / 2, 'items', C.ITEMS[id].icon).setScale(cell * 0.006);
      if (!got) icon.setTint(0x000000).setAlpha(0.22);
      c.add(icon);
    });
    var st = s.stats;
    var ry = y0 + Math.ceil(C.COLLECTION.length / cols) * cell + 8;
    var rec = this.txt(W / 2, ry, 'RECORDS   Earned ' + st.earned + 'G   Fish ' + st.fish + '   Dishes ' + st.cooked +
      '\nDeepest mine floor ' + (st.deepest || '-') + '   Friends with 5+ hearts ' + C.VILLAGER_ORDER.filter(function (k) { return L.friendHearts(s, k) >= 5; }).length,
    12, INK, { align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0);
    if (rec.width > W - 50) rec.setScale((W - 50) / rec.width);
    if (ry + rec.displayHeight > 592) rec.setY(592 - rec.displayHeight);
    c.add(rec);
  };

  // All 23 villagers, a page at a time (the list panel's pager): face, name, hearts, what you did today.
  M.openFriends = function (page) {
    var self = this, s = F.session.state;
    var rows = C.VILLAGER_ORDER.map(function (k) {
      var f = L.friend(s, k), v = C.VILLAGERS[k];
      if (!f.met) return { icon: C.ICON.exclaim, name: '???', desc: 'Not met yet.' };
      return {
        people: k, name: v.name + (s.spouse === k ? '  (spouse)' : s.engaged && s.engaged.who === k ? '  (engaged)' : ''),
        hearts: f.pts, // drawn hearts (owner, 28 Oct: option B)
        desc: v.role + (f.talked ? '  \u2713 talked' : '') + (f.gifted ? '  \u2713 gift' : ''),
      };
    });
    this.listPanel({
      title: 'Friends', rows: rows, page: page || 0,
      reopen: function (t, p) { self.closeModal(); self.openFriends(p); },
      sub: function () { return C.VILLAGER_ORDER.filter(function (k) { return L.friend(s, k).met; }).length + ' of ' + C.VILLAGER_ORDER.length + ' met. Talk every day, give gifts they like.'; },
    });
  };

  Object.assign(F.UIScene.prototype, M);
})(window.Farm = window.Farm || {});
