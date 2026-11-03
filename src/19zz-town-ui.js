// Willowbrook Station's panels (rules: 01-logicz-town.js; the station in town: 19zz-town.js): Cargo (the crates as
// cards, the prize on top), Visitors (what the people off the train wish for), Town (the Town Level, what the next one
// brings, every level), and the Kiosk from Town Level 4. The first-time tour, opened by the first visit to the
// station or from What's new, and the bigger stall's shelves (Town Level 2) in the stall's panel.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TW = C.TW;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var K = F.UI_CONST, W = K.W, INK = K.INK, ICON = K.ICON;
  var D = F.UI_DRAW, rrect = D.rrect, vgrad = D.vgrad;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GOLD = 0xe9a91c;
  var TITLE = 'Willowbrook Station';
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var me = function () { return F.session.state; };
  var world = function () { return F.world; };
  var timeOf = function (lm) { return L.formatTime(lm % 1440); };
  var trainsText = function () { return TW.trains.map(function (m) { return L.formatTime(m).replace(':00', ''); }).join(', ').replace(/, ([^,]*)$/, ' and $1'); };
  var nextTrain = function (s) { var n = L.twNextTrain(L.twNow(s)); return n ? timeOf(n.arrive) : ''; };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var dayWord = function (s, lm) { var d = Math.floor(lm / 1440) - s.day; return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'on ' + DAYS[L.date(s.day + d).weekday]; };
  var itemName = function (id, n) { var it = C.ITEMS[id]; return n === 1 || !it.plural ? it.name : it.plural; };

  U.twTabs = function (s) {
    var t = [['cargo', 'Cargo'], ['visitors', 'Visitors'], ['town', 'Town']];
    if (L.twLevel(s) >= TW.kioskAt) t.push(['kiosk', 'Kiosk']);
    return t;
  };

  // ---------- the tour first, then the station ----------
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || (window.gameHost && window.gameHost.quiet)) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  U.openStation = function (tab, page) {
    var self = this, s = me();
    if (take('station_tour')) return this.tour('station', function () { self.openStation(tab, page); });
    L.twTick(s);
    if (world() && world().tw) world().twRefresh(false);
    tab = tab || 'cargo';
    if (tab === 'cargo') return this.twCargo();
    if (tab === 'visitors') return this.twVisitors(page);
    if (tab === 'kiosk' && L.twLevel(s) >= TW.kioskAt) return this.twKiosk(page);
    return this.twTown(page);
  };
  var reopen = function (ui) { return function (tab, p) { ui.openStation(tab, p); }; };

  // ---------- Cargo ----------
  U.twCargo = function () {
    var self = this, s = me(), o = s.tw.o, c = this.openModal();
    this.panelImg(c, 12, 76, W - 24, 530);
    var title = this.txt(W / 2, 79, TITLE, 17, '#fff6d8', { fontStyle: 'bold', stroke: '#5a1a12', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, 79, Math.min(W - 110, title.width + 54));
    c.add(title);
    this.closeButton(c, W - 26, 84, function () { self.closeModal(); });
    var subText = !o ? 'The next order comes with the ' + nextTrain(s) + ' train.'
      : o.full ? 'All filled! The ' + nextTrain(s) + ' train takes them away.'
        : 'Fill them by ' + timeOf(o.due) + ' ' + dayWord(s, o.due) + ' (' + L.formatLeft(L.twLeft(s)) + ' left).';
    var sub = this.txt(W / 2, 104, subText, 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0);
    if (sub.width > W - 60) sub.setScale((W - 60) / sub.width);
    c.add(sub);
    this.tabSwitch(c, 152, this.twTabs(s), 'cargo', function (key) { self.swapTo(function () { self.openStation(key, 0); }); });
    if (!o) {
      c.add(this.txt(W / 2, 250, 'No cargo right now.\nA train brings a new order\nwhen there is none.\n\nTrains come in at\n' + trainsText() + '.', 15, INK, { align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
      return c;
    }
    // the prize, on a gold-edged card
    var filled = L.twFilled(o), total = o.crates.length;
    this.canvasImg(c, 26, 178, 'tw-ui-prize', W - 52, 64, function (g) {
      rrect(g, 1, 3, W - 54, 60, 12);
      g.fillStyle = 'rgba(122,77,38,0.2)';
      g.fill();
      rrect(g, 1, 1, W - 54, 60, 12);
      g.fillStyle = vgrad(g, 1, 61, '#fff6d0', '#f3d98e');
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#d9a62a';
      g.stroke();
    });
    c.add(this.add.image(54, 210, 'items', C.ICON.gift).setScale(ICON));
    c.add(this.txt(82, 186, o.full ? 'Cargo complete!' : 'Fill all ' + total + ' crates', 13, INK, { fontStyle: 'bold' }));
    c.add(this.txt(W - 40, 186, filled + ' / ' + total, 13, '#6a4a2a', { fontStyle: 'bold' }).setOrigin(1, 0));
    this.rewardChips(c, 82, 208, W - 52 - 70, o.prize, o.full ? 'Won' : 'Prize');
    // the crates, two by three
    var cw = 150, ch = 92, gap = 6, x0 = (W - 2 * cw - gap) / 2, y0 = 250;
    o.crates.forEach(function (cr, i) {
      var x = x0 + (i % 2) * (cw + gap), y = y0 + Math.floor(i / 2) * (ch + gap), have = L.countItem(s, cr.id), ready = !cr.done && have >= cr.n;
      self.canvasImg(c, x, y, 'tw-ui-crate-' + (cr.done ? 'done' : ready ? 'ready' : 'open'), cw, ch + 3, function (g) {
        rrect(g, 0, 3, cw, ch, 12);
        g.fillStyle = 'rgba(122,77,38,0.22)';
        g.fill();
        rrect(g, 0, 0, cw, ch, 12);
        g.fillStyle = cr.done ? vgrad(g, 0, ch, '#eaf6d8', '#c9e4a8') : vgrad(g, 0, ch, '#fffdf6', '#f1dfb4');
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = cr.done ? '#6fae46' : ready ? '#3fa535' : '#d9b77f';
        g.stroke();
      });
      c.add(self.txt(x + 10, y + 7, TW.kinds[cr.k].toUpperCase(), 9, '#8a6a42', { fontStyle: 'bold' }));
      c.add(self.add.image(x + 30, y + 44, 'items', C.ITEMS[cr.id].icon).setScale(ICON * 0.9).setAlpha(cr.done ? 0.55 : 1));
      var nm = self.txt(x + 58, y + 20, C.ITEMS[cr.id].name, 12, INK, { fontStyle: 'bold' });
      if (nm.width > cw - 64) nm.setScale((cw - 64) / nm.width);
      c.add(nm);
      c.add(self.txt(x + 58, y + 36, 'x' + cr.n, 14, '#5a3a1e', { fontStyle: 'bold' }));
      if (cr.done) {
        c.add(self.txt(x + cw / 2, y + ch - 16, 'FILLED', 14, '#3f7d22', { fontStyle: 'bold' }).setOrigin(0.5));
        return;
      }
      c.add(self.txt(x + 10, y + ch - 16, 'Pays ' + fmt(cr.pay) + 'G', 11, '#a8740c', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      if (ready) self.pillButton(c, x + cw - 36, y + ch - 17, 58, 24, 'Fill', function () { self.twFillCrate(i); }, GREEN);
      else c.add(self.txt(x + cw - 10, y + ch - 16, 'Have ' + Math.min(have, 999), 10, '#7a5a3a').setOrigin(1, 0.5));
    });
    var tr = L.twTrain(s), rows = Math.ceil(o.crates.length / 2);
    c.add(this.txt(W / 2, y0 + rows * (ch + gap) + 6, tr ? 'The ' + timeOf(tr.arrive) + ' train is in until ' + timeOf(tr.leave) + '.' : 'Next train: ' + nextTrain(s) + '.', 11, '#7a5a3a').setOrigin(0.5, 0));
    return c;
  };

  U.twFillCrate = function (i) {
    var self = this, s = me(), r = L.twFill(s, i);
    if (r === 'full') { sfx('nope'); return this.toast('Make room in your bag for the prize first.'); }
    if (typeof r !== 'object') { sfx('nope'); return this.toast(r === 'missing' ? "You don't have enough yet." : 'That crate is done.'); }
    sfx(r.prize ? 'fanfare' : 'coin');
    if (world()) { world().changed(); world().save(); if (world().tw) world().twRefresh(false); }
    F.bus.emit('hud');
    this.swapTo(function () {
      self.twCargo();
      if (r.prize) {
        var p = r.prize, rows = [[C.ICON.coin, '+' + fmt(p.gold) + 'G (and ' + fmt(r.pay) + 'G for the last crate)'], [C.ICON.sunbeam, '+' + p.stars + (p.stars > 1 ? ' Sunbeams' : ' Sunbeam')]];
        if (p.item) rows.push([C.ITEMS[p.item].icon, '+' + p.n + ' ' + itemName(p.item, p.n)]);
        rows.push([C.ICON.ribbon, '+' + r.pts + ' Town points']);
        self.dialog('CARGO COMPLETE!\nThe whole order is packed. The next train takes it to the city.', [{ label: 'Hooray!', cb: function () { self.twLevelUp(); } }], { rows: rows });
      } else {
        self.toast('+' + fmt(r.pay) + 'G and +' + r.pts + ' Town points. ' + (s.tw.o.crates.length - L.twFilled(s.tw.o)) + ' to go!', 2000, 0x7a4d12);
        self.twLevelUp();
      }
    });
  };

  // A new Town Level, once (after whatever gave the points).
  U.twLevelUp = function () {
    var s = me(), up = s.tw.up;
    if (!up) return;
    s.tw.up = null;
    sfx('fanfare');
    if (world() && world().tw) world().twRefresh(true);
    this.dialog('TOWN LEVEL ' + up.level + '!\nWillowbrook is growing.', null, { rows: [[C.ICON.star, TW.levels[up.level - 1].text], [C.ICON.coin, 'A thank-you from the town: +' + fmt(up.gift) + 'G']] });
  };
  // after a visitor got their wish (19zz-town.js)
  U.twThanks = function (name, r) {
    F.bus.emit('hud');
    this.toast(name + ' paid ' + fmt(r.gold) + 'G' + (r.stars ? ' and ' + r.stars + ' Sunbeam' : '') + '. +' + r.pts + ' Town points!', 2400, 0x7a4d12);
    this.twLevelUp();
  };

  // ---------- Visitors ----------
  U.twVisitors = function (page) {
    var self = this, s = me(), tr = L.twTrain(s), wishes = L.twWishes(s);
    var rows = wishes.map(function (w) {
      var who = L.twWho(w.who), have = L.countItem(s, w.id);
      return {
        icon: C.ITEMS[w.id].icon, name: who.name, tag: w.who < 0 ? 'RARE' : null, done: !!w.done,
        desc: w.done ? 'Happy with the ' + itemName(w.id, w.n) + '. Salamat!' : 'Wishes for ' + w.n + ' ' + itemName(w.id, w.n) + '. You have ' + have + '.',
        reward: w.done ? null : { gold: w.gold, stars: w.stars }, rewardPrefix: 'Pays',
      };
    });
    this.listPanel({
      title: TITLE, tab: 'visitors', tabs: this.twTabs(s), rows: rows, page: page, reopen: reopen(this),
      sub: function () { return tr ? 'In town until ' + timeOf(tr.leave) + '. Find them and talk.' : 'Trains come in at ' + trainsText() + '.'; },
      empty: 'No visitors in town now.\nThe next train comes in at ' + nextTrain(s) + '.\nIts visitors get off and walk about town.',
    });
  };

  // ---------- Town ----------
  U.twTown = function (page) {
    var s = me(), lv = L.twLevel(s), next = L.twNextLevel(s), p = s.tw.p;
    var rows = [{
      icon: C.ICON.ribbon, name: 'Town Level ' + lv, progress: next ? [p - next.from, next.at - next.from] : [1, 1],
      desc: next ? (next.at - p) + ' more Town points to Level ' + next.level + '.' : 'The top level: Willowbrook is a Tourist Town!',
    }];
    if (next) rows.push({ icon: C.ICON.star, name: 'Level ' + next.level + ' brings', desc: next.text });
    rows.push({ icon: C.ICON.crate, name: 'Town points', desc: 'A crate +' + TW.points.crate + ', a full order +' + TW.points.cargo + ', a visitor +' + TW.points.wish + ' (the Collector +' + TW.points.collector + '), a stall sale while a train is in +' + TW.points.sale + '.' });
    rows.push({ icon: C.ICON.calendar, name: 'The trains', desc: 'In at ' + trainsText() + '. Each stays 2 hours. Next: ' + nextTrain(s) + '.' });
    TW.levels.forEach(function (l, i) { rows.push({ icon: i < lv ? C.ICON.star : C.ICON.ribbon, name: 'Level ' + (i + 1) + (i ? ' (' + l.at + ' points)' : ''), desc: l.text, done: i < lv }); });
    this.listPanel({
      title: TITLE, tab: 'town', tabs: this.twTabs(s), rows: rows, page: page, reopen: reopen(this),
      sub: function () { return fmt(p) + ' Town points. ' + s.tw.done + (s.tw.done === 1 ? ' order' : ' orders') + ' filled.'; },
    });
  };

  // ---------- Kiosk ----------
  U.twKiosk = function (page) {
    var self = this, s = me();
    var rows = L.twKiosk(s).map(function (e, i) {
      var item = C.ITEMS[e.id];
      return {
        icon: item.icon, name: item.name, desc: e.left ? e.left + ' left today. ' + item.desc : 'Sold out. More come with tomorrow\'s trains.',
        buttons: e.left ? [{
          label: 'Buy ' + fmt(e.gold) + 'G', cb: function () {
            var r = L.twBuy(s, i);
            if (r !== 'ok') { sfx('nope'); return self.toast(r === 'gold' ? 'Not enough gold.' : r === 'full' ? 'Your bag is full.' : 'Sold out for today.'); }
            sfx('coin');
            if (world()) { world().changed(); world().save(); }
            F.bus.emit('hud');
            self.swapTo(function () { self.twKiosk(page); self.toast('Fresh off the train: 1 ' + item.name + '.'); });
          },
        }] : [],
      };
    });
    this.listPanel({ title: TITLE, tab: 'kiosk', tabs: this.twTabs(s), rows: rows, page: page, reopen: reopen(this), sub: function () { return fmt(s.gold) + 'G   Goods from the city, a few each day.'; } });
  };

  // ---------- a bigger stall (Town Level 2): the stall's panel offers the bigger shelves ----------
  var openSellOptions = U.openSellOptions;
  U.openSellOptions = function () {
    var self = this, args = arguments;
    return L.twWithShelf(L.twShelfCap(me()), function () { return openSellOptions.apply(self, args); });
  };

  // ---------- the tour ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var pic = function (ui, sc, x, y, key, w, h) { var i = ui.add.image(x, y, key).setOrigin(0.5, 1).setDisplaySize(w, h); sc.add(i); return i; };
  F.TOURS.station = {
    title: 'THE TRAIN STATION',
    steps: [
      {
        text: 'Willowbrook Station is up the lane by the Post Office. A train comes in at ' + trainsText() + '.',
        draw: function (ui, sc, move) {
          F.twTextures(ui);
          pic(ui, sc, 52, 122, 'tw-station', 90, 72);
          var t = pic(ui, sc, 112, 118, 'tw-train', 152, 23).setOrigin(0, 1); // (the stage does not clip: the train stays on it)
          if (move) { t.x = 118; t.setAlpha(0); }
          tw(ui, move, { targets: t, x: 106, alpha: 1, duration: 1600, ease: 'Cubic.out', hold: 1600, yoyo: true, repeat: -1, repeatDelay: 300 });
          var p = ui.add.image(116, 84, 'tw-puff').setScale(0.4);
          sc.add(p);
          tw(ui, move, { targets: p, y: 50, alpha: 0, scale: 0.9, duration: 900, repeat: -1 });
        },
      },
      {
        text: 'Each train with no order brings a cargo order. Every crate you fill pays a little; fill them all for a big prize.',
        draw: function (ui, sc, move) {
          F.twTextures(ui);
          [C.ICON.turnip, C.ICON.egg, C.ICON.ore_copper, C.ICON.fish_m].forEach(function (f, i) {
            var x = 52 + i * 56, cr = pic(ui, sc, x, 116, 'tw-crate', 46, 46);
            icon(ui, sc, x, 70, f, 0.2);
            if (move) ui.time.delayedCall(500 + i * 450, function () { if (cr.scene) { cr.setTexture('tw-crate-full').setDisplaySize(46, 46); } });
          });
          var g = icon(ui, sc, 136, 24, C.ICON.gift, 0.26);
          tw(ui, move, { targets: g, scale: { from: 0.22, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Visitors get off and walk about town. Talk to them: give the pasalubong they wish for, and they pay well.',
        draw: function (ui, sc, move) {
          F.ensureTexture(ui, 'people');
          var n = C.VILLAGER_ORDER.length;
          [1, 4, 2].forEach(function (look, i) {
            var p = ui.add.image(70 + i * 66, 124, 'people', (n + look) * 9).setOrigin(0.5, 1).setScale(0.42);
            sc.add(p);
            var b = pic(ui, sc, 70 + i * 66, 48, 'tw-wish', 30, 32);
            var it = icon(ui, sc, 70 + i * 66, 30, [C.ICON.strawberry, C.ICON.milk, C.ICON.apple][i], 0.13);
            tw(ui, move, { targets: [b, it], y: '-=6', duration: 500 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Crates, visitors and stall sales while a train is in give Town points. Each Town Level brings something new.',
        draw: function (ui, sc, move) {
          words(ui, sc, 136, 26, 'TOWN LEVEL', 13, '#5a3a1e');
          var bar = ui.add.rectangle(66, 64, 140, 16, 0x6a4a2a).setOrigin(0, 0.5);
          var fill = ui.add.rectangle(68, 64, 136, 12, 0x3fa535).setOrigin(0, 0.5);
          sc.add([bar, fill]);
          words(ui, sc, 40, 64, 'Lv 1', 12, '#5a3a1e');
          var two = words(ui, sc, 232, 64, 'Lv 2', 12, '#a8740c');
          if (move) fill.scaleX = 0.05;
          tw(ui, move, { targets: fill, scaleX: 1, duration: 1800, repeat: -1, repeatDelay: 600 });
          tw(ui, move, { targets: two, scale: { from: 1, to: 1.25 }, duration: 300, delay: 1700, yoyo: true, repeat: -1, repeatDelay: 2100 });
          [C.ICON.crate, C.ICON.ribbon, C.ICON.star].forEach(function (f, i) { icon(ui, sc, 76 + i * 60, 106, f, 0.22); });
        },
      },
    ],
  };

  // the first time you walk up to the station
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (!this.tw || L.tipSeen(me(), 'station_tour')) return;
    var self = this;
    var check = this.time.addEvent({
      delay: 800, loop: true, callback: function () {
        if (L.tipSeen(me(), 'station_tour')) return check.remove();
        if (!self.twNear(6) || self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return;
        if (!take('station_tour')) return;
        check.remove();
        F.ui.tour('station');
      },
    });
  };
})(window.Farm = window.Farm || {});
