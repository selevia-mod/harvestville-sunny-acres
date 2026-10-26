// The market stall's panels: the shelves (put a lot up at a price, collect the coins), picking what to sell and
// for how much (or selling it right away), and the order board. Mixed into UIScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, INK = K.INK, SLOT = K.SLOT, ICON = K.ICON;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, RED = 0xc0503a, GOLD = 0xe9a91c;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };
  var state = function () { return F.session.state; };

  // game minutes as "about 2h" / "about 40m"
  var soon = function (m) {
    if (m < 60) return Math.max(5, Math.round(m / 5) * 5) + 'm';
    var h = m / 60;
    return (h < 3 ? Math.round(h * 2) / 2 : Math.round(h)) + 'h';
  };

  var M = {};

  // A card behind a shelf or an order (drawn once per size and kind).
  M.standCard = function (c, x, y, w, h, kind) {
    var fills = { empty: ['#f3e4bf', '#e8d3a3'], selling: ['#fffaea', '#f3e1b6'], sold: ['#e9f8d6', '#c9e8a8'], order: ['#fffaea', '#f3e1b6'] };
    var f = fills[kind];
    return this.canvasImg(c, x, y, 'ui-card-' + kind + '-' + w + 'x' + h, w, h + 3, function (g) {
      g.beginPath();
      g.roundRect(0, 3, w, h, 11);
      g.fillStyle = 'rgba(60,35,15,0.25)';
      g.fill();
      g.beginPath();
      g.roundRect(0, 0, w, h, 11);
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, f[0]);
      gr.addColorStop(1, f[1]);
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = 2;
      if (kind === 'empty') g.setLineDash([6, 5]);
      g.strokeStyle = kind === 'sold' ? '#6fae46' : '#c9a26b';
      g.stroke();
      g.setLineDash([]);
    });
  };

  // The stand window. tab: 'shelves' (default) or 'orders'.
  M.openStand = function (tab) {
    var self = this, s = state();
    if (!L.marketOpen(s)) return this.dialog('MARKET STALL\nZzz... The market is closed for the night: the townsfolk are sleeping.\nCome back at ' + L.formatTime(C.SHOP_OPEN) + '.');
    tab = tab || 'shelves';
    var c = this.openModal();
    this.panelImg(c, 12, 74, W - 24, 528);
    this.ribbon(c, W / 2, 78, 190);
    c.add(this.txt(W / 2, 78, 'Market Stall', 17, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    this.button(c, W - 44, 112, 40, 32, 'X', function () { self.closeModal(); }, RED);
    var reopen = function (t) { self.closeModal(); self.openStand(t || tab); };
    [['shelves', 'Shelves'], ['orders', 'Orders']].forEach(function (t, k) {
      var ready = t[0] === 'orders' && s.orders.some(function (o, i) { return L.canDeliver(s, i); });
      self.button(c, W / 2 + (k ? 66 : -66), 140, 124, 34, t[1] + (ready ? ' !' : ''), function () { if (t[0] !== tab) reopen(t[0]); }, t[0] === tab ? GREEN : GREY);
    });
    if (tab === 'orders') this.standOrders(c, reopen);
    else this.standShelves(c, reopen);
    return c;
  };

  M.standShelves = function (c, reopen) {
    var self = this, s = state(), coins = L.standCoins(s);
    var y0 = 170;
    if (coins) {
      this.button(c, W / 2, y0 + 20, 220, 38, 'Collect ' + coins + 'G', function () { self.collectStand(); reopen(); }, GOLD);
    } else {
      this.button(c, W / 2, y0 + 20, 220, 38, 'Sell from bag', function () { self.openSellPicker(s.shelves.indexOf(null) >= 0 ? s.shelves.indexOf(null) : null); }, BLUE);
    }
    var cw = 148, ch = 104, gx = 10, top = y0 + 48;
    s.shelves.forEach(function (e, i) {
      var x = W / 2 - cw - gx / 2 + (i % 2) * (cw + gx), y = top + Math.floor(i / 2) * (ch + 10);
      var kind = !e ? 'empty' : e.coins ? 'sold' : 'selling';
      self.standCard(c, x, y, cw, ch, kind);
      if (!e) {
        c.add(self.txt(x + cw / 2, y + ch / 2 - 10, '+', 30, '#b8925a', { fontStyle: 'bold' }).setOrigin(0.5));
        c.add(self.txt(x + cw / 2, y + ch / 2 + 20, 'Empty shelf', 12, '#9a7a4a').setOrigin(0.5));
      } else {
        c.add(self.add.image(x + 34, y + 38, 'items', C.ITEMS[e.id].icon).setScale(0.36));
        c.add(self.txt(x + 62, y + 18, C.ITEMS[e.id].name, 12, INK, { fontStyle: 'bold', wordWrap: { width: 82 } }));
        c.add(self.txt(x + 62, y + 50, 'x' + e.n, 13, '#7a5a3a', { fontStyle: 'bold' }));
        if (e.coins) {
          c.add(self.txt(x + cw / 2, y + ch - 22, 'SOLD!  ' + e.coins + 'G', 14, '#3f7d22', { fontStyle: 'bold' }).setOrigin(0.5));
          if (e.buyer) c.add(self.txt(x + cw / 2, y + ch - 7, 'to ' + C.VILLAGERS[e.buyer].name, 10, '#5a7a3a').setOrigin(0.5));
        } else {
          var total = L.shelfPrice(e.id, e.n, e.price);
          c.add(self.txt(x + cw / 2, y + ch - 30, total + 'G  (' + C.STAND.prices[e.price].name + ')', 12, INK, { fontStyle: 'bold' }).setOrigin(0.5));
          c.add(self.txt(x + cw / 2, y + ch - 13, 'buyer in about ' + soon(e.left), 10, '#7a5a3a').setOrigin(0.5));
        }
      }
      var z = self.add.zone(x + cw / 2, y + ch / 2, cw, ch).setInteractive({ useHandCursor: true });
      z.on('pointerup', function () {
        if (!e) return self.openSellPicker(i);
        if (e.coins) { self.collectStand(); return reopen(); }
        self.confirm('TAKE IT BACK?\nPut the ' + e.n + ' ' + C.ITEMS[e.id].name + ' back in your bag?', function () {
          var r = L.unlist(s, i);
          if (r === 'full') return self.toast('Your bag is full.');
          world().changed();
          reopen();
        });
      });
      c.add(z);
    });
    c.add(this.txt(W / 2, top + 3 * (ch + 10) + 2, (L.weekendMarket() ? 'WEEKEND MARKET: Sell now pays the full price!  Shelves up to ' : 'Sell now pays ' + Math.round(C.STAND.instant * 100) + '%.  Shelves pay up to ') + '' + Math.round(C.STAND.prices[2].mult * 100) + '%, but take time.', 11, '#7a5a3a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0));
  };

  M.collectStand = function () {
    var gold = L.collectStand(state());
    if (!gold) return;
    sfx('coin');
    this.toast('+' + gold + 'G from the market stall!', 1800, 0x7a4d12);
    world().changed();
    world().save();
  };

  // Pick something from the bag to sell (shelf = which shelf it goes on, or null to sell only).
  M.openSellPicker = function (shelf) {
    var self = this, s = state();
    var c = this.openModal();
    this.panelImg(c, 14, 140, W - 28, 380);
    this.ribbon(c, W / 2, 144, 200);
    c.add(this.txt(W / 2, 144, 'What to sell?', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    this.button(c, W - 46, 176, 40, 32, 'X', function () { self.closeModal(); }, RED);
    var items = [];
    s.inv.forEach(function (slot, i) { if (slot && L.basePrice(slot.id)) items.push(i); });
    if (!items.length) {
      c.add(this.txt(W / 2, 290, 'Nothing in your bag sells.\nHarvest crops, collect eggs and milk,\ncatch fish or mine ore first.', 14, INK, { align: 'center', lineSpacing: 4 }).setOrigin(0.5));
      return c;
    }
    var cols = 6, gap = 6, x0 = (W - (cols * SLOT + (cols - 1) * gap)) / 2, y0 = 206;
    items.slice(0, 30).forEach(function (inv, k) {
      var x = x0 + (k % cols) * (SLOT + gap), y = y0 + Math.floor(k / cols) * (SLOT + gap);
      var w = self.slotWidget(c, x, y, function () {});
      self.drawSlot(w, s.inv[inv], false);
      // act when the finger lifts (like the shelves underneath), or the lift would land on a shelf
      var z = self.add.zone(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: true });
      z.on('pointerup', function () { self.closeModal(); self.openSellOptions(shelf, inv); });
      c.add(z);
    });
    c.add(this.txt(W / 2, 478, 'Tap an item to pick a price.', 12, '#7a5a3a').setOrigin(0.5));
    return c;
  };

  // How many, and for how much: three shelf prices, or sell right now.
  M.openSellOptions = function (shelf, inv, n) {
    var self = this, s = state(), slot = s.inv[inv];
    if (!slot) return;
    var id = slot.id, item = C.ITEMS[id], max = slot.n;
    var shelfMax = Math.min(max, C.STAND.perShelf);
    n = Math.max(1, Math.min(n || Math.min(max, shelfMax), max));
    var c = this.openModal();
    this.panelImg(c, 14, 108, W - 28, 450);
    this.ribbon(c, W / 2, 112, 210);
    c.add(this.txt(W / 2, 112, item.name, 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    this.button(c, W - 46, 144, 40, 32, 'X', function () { self.closeModal(); }, RED);
    c.add(this.add.image(W / 2, 176, 'items', item.icon).setScale(0.5));
    // quantity stepper
    var again = function (k) { self.closeModal(); self.openSellOptions(shelf, inv, k); };
    this.button(c, W / 2 - 86, 230, 44, 36, '-', function () { if (n > 1) again(n - 1); }, n > 1 ? BLUE : GREY);
    this.button(c, W / 2 + 86, 230, 44, 36, '+', function () { if (n < max) again(n + 1); }, n < max ? BLUE : GREY);
    c.add(this.txt(W / 2, 230, n + ' of ' + max, 17, INK, { fontStyle: 'bold' }).setOrigin(0.5));
    if (max > 1) this.button(c, W / 2, 266, 80, 26, n === max ? 'One' : 'All', function () { again(n === max ? 1 : max); }, GREY);
    var y = 300;
    var shelfFree = shelf != null ? shelf : s.shelves.indexOf(null);
    if (shelfFree >= 0) {
      c.add(this.txt(W / 2, y, 'Put on a shelf' + (n > shelfMax ? ' (' + shelfMax + ' fit on one)' : ''), 12, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5));
      C.STAND.prices.forEach(function (p, k) {
        var by = y + 30 + k * 46, count = Math.min(n, shelfMax);
        self.button(c, W / 2, by, 280, 40, p.name + ': ' + L.shelfPrice(id, count, k) + 'G  (about ' + soon((p.minutes[0] + p.minutes[1]) / 2) + ')', function () {
          if (L.listItem(s, shelfFree, inv, count, k) !== 'ok') return;
          sfx('pick');
          world().progress('ship');
          world().changed();
          world().save();
          self.closeAll();
          self.openStand('shelves');
          self.toast(count + ' ' + item.name + ' on the shelf. A buyer comes in about ' + soon(s.shelves[shelfFree].left) + '.');
        }, [GREEN, BLUE, 0x8a5ac9][k]);
      });
      y += 30 + 3 * 46 + 6;
    } else {
      c.add(this.txt(W / 2, y + 20, 'All 6 shelves are busy. You can still sell right now.', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5));
      y += 60;
    }
    this.button(c, W / 2, y + 14, 280, 40, 'Sell now: ' + L.instantPrice(id, n) + 'G', function () {
      var gold = L.sellNow(s, inv, n);
      if (!gold) return;
      sfx('coin');
      world().progress('ship');
      world().changed();
      world().save();
      self.closeAll();
      self.openStand('shelves');
      self.toast('Sold ' + n + ' ' + item.name + ' for ' + gold + 'G.', 1800, 0x7a4d12);
    }, GOLD);
    return c;
  };

  M.standOrders = function (c, reopen) {
    var self = this, s = state();
    F.ensureTexture(this, 'people');
    c.add(this.txt(W / 2, 182, 'Villagers ask for these. They pay a bonus, and they like you more!', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 290 } }).setOrigin(0.5, 0));
    var ch = 118, top = 214;
    s.orders.forEach(function (o, i) {
      var y = top + i * (ch + 10), x = 26, cw = W - 52;
      self.standCard(c, x, y, cw, ch, o.items ? 'order' : 'empty');
      if (!o.items) {
        c.add(self.txt(W / 2, y + ch / 2, 'A new order comes in about ' + soon(o.wait) + '.', 13, '#9a7a4a').setOrigin(0.5));
        return;
      }
      var vi = C.VILLAGER_ORDER.indexOf(o.from);
      c.add(self.add.image(x + 30, y + 58, 'people', vi * 9).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 0, 128, 150));
      c.add(self.txt(x + 30, y + 72, C.VILLAGERS[o.from].name, 11, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
      o.items.forEach(function (it, k) {
        var ix = x + 84 + k * 70, have = L.countItem(s, it[0]);
        c.add(self.add.image(ix, y + 34, 'items', C.ITEMS[it[0]].icon).setScale(0.3));
        c.add(self.txt(ix, y + 62, Math.min(have, it[1]) + '/' + it[1], 13, have >= it[1] ? '#3f7d22' : '#b04a3a', { fontStyle: 'bold' }).setOrigin(0.5));
      });
      var ok = L.canDeliver(s, i);
      c.add(self.add.image(x + 92, y + 96, 'items', C.ICON.coin).setScale(0.18));
      c.add(self.txt(x + 104, y + 96, o.gold + 'G  +♥', 14, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      self.button(c, x + cw - 56, y + 34, 92, 34, 'Deliver', function () {
        if (!ok) return self.toast('You need everything on the order first.');
        var gold = L.deliverOrder(s, i);
        sfx('gift');
        world().changed();
        world().save();
        self.toast(C.VILLAGERS[o.from].name + ' paid ' + gold + 'G. Thank you!', 2000, 0x7a4d12);
        reopen('orders');
      }, ok ? GREEN : GREY);
      self.button(c, x + cw - 56, y + 80, 92, 28, 'Skip', function () {
        self.confirm('SKIP THIS ORDER?\nA new one comes in about ' + soon(C.ORDERS.skip) + '.', function () {
          L.skipOrder(s, i);
          world().changed();
          reopen('orders');
        });
      }, GREY);
    });
  };

  Object.assign(F.UIScene.prototype, M);
})(window.Farm = window.Farm || {});
