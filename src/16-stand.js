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
    // an older order for something this farm can't get (a carabao's milk with no carabao) is swapped for a fair one
    if (L.fixOrders(s)) { world().changed(); world().save(); }
    // the close X and the two tabs line up with the cards' edges (x 26 to W - 26)
    this.button(c, W - 46, 108, 40, 32, 'X', function () { self.closeModal(); }, RED);
    var reopen = function (t) { self.closeModal(); self.openStand(t || tab); };
    [['shelves', 'Shelves'], ['orders', 'Orders']].forEach(function (t, k) {
      var ready = t[0] === 'orders' && s.orders.some(function (o, i) { return L.canDeliver(s, i); });
      self.button(c, k ? W - 26 - 75 : 26 + 75, 146, 150, 34, t[1] + (ready ? ' !' : ''), function () { if (t[0] !== tab) reopen(t[0]); }, t[0] === tab ? GREEN : GREY);
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
      F.tapOn(z, function () {
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
      F.tapOn(z, function () { self.closeModal(); self.openSellOptions(shelf, inv); });
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

  // A small secondary button: cream, brown outline and brown words (Skip next to a big Deliver).
  M.standSoftButton = function (parent, x, y, w, h, label, onTap) {
    var b = this.add.container(x, y);
    var bg = this.canvasImg(null, -w / 2, -h / 2, 'ui-soft-btn-' + w + 'x' + h, w, h + 2, function (g) {
      g.beginPath();
      g.roundRect(1, 2, w - 2, h - 2, 9);
      g.fillStyle = 'rgba(60,35,15,0.18)';
      g.fill();
      g.beginPath();
      g.roundRect(1, 1, w - 2, h - 3, 9);
      g.fillStyle = '#fbf1da';
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#b8925a';
      g.stroke();
    });
    var t = this.txt(0, -1, label, 13, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5);
    var z = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerdown', function () { b.setScale(0.93); });
    z.on('pointerout', function () { b.setScale(1); });
    F.tapOn(z, function () { b.setScale(1); onTap(); });
    b.add([bg, t, z]);
    if (parent) parent.add(b);
    return b;
  };

  // Rounded tiles drawn once: an item's tile, the reward strip and the portrait's round backdrop.
  M.standTile = function (c, x, y, w, h, kind) {
    var look = { item: ['#f8ecd0', '#d9bb8a', 9], reward: ['#fff3cf', '#e2b866', 12], face: ['#f6e3bb', '#d9bb8a', h / 2] }[kind];
    return this.canvasImg(c, x, y, 'ui-stand-' + kind + '-' + w + 'x' + h, w, h, function (g) {
      g.beginPath();
      g.roundRect(1, 1, w - 2, h - 2, look[2]);
      g.fillStyle = look[0];
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = look[1];
      g.stroke();
    });
  };

  // The order board. Each row: who asks (portrait, name under it), what they ask for (each item in a tile, with how
  // many you have of how many: green once you have enough), what they pay, and Deliver (green when you can) with a
  // smaller Skip under it. Rows are all the same size, 12 px inside the card on every side.
  M.standOrders = function (c, reopen) {
    var self = this, s = state();
    F.ensureTexture(this, 'people');
    c.add(this.txt(W / 2, 176, 'Villagers pay a bonus, and like you more!', 12, '#7a5a3a').setOrigin(0.5));
    var ch = 118, top = 194, x = 26, cw = W - 52, pad = 12;
    var colL = x + pad + 30, btnW = 78, colR = x + cw - pad - btnW / 2; // the portrait's and the buttons' centres
    var midL = x + pad + 60 + 6, midR = x + cw - pad - btnW - 6, mid = (midL + midR) / 2; // the items' column
    s.orders.forEach(function (o, i) {
      var y = top + i * (ch + 10);
      self.standCard(c, x, y, cw, ch, o.items ? 'order' : 'empty');
      if (!o.items) {
        c.add(self.txt(W / 2, y + ch / 2, 'A new order comes in about ' + soon(o.wait) + '.', 13, '#9a7a4a').setOrigin(0.5));
        return;
      }
      // who: a round portrait, the name on one line under it
      var vi = C.VILLAGER_ORDER.indexOf(o.from);
      self.standTile(c, colL - 26, y + 22, 52, 52, 'face');
      c.add(self.add.image(colL, y + 72, 'people', vi * 9).setOrigin(0.5, 1).setScale(0.32).setCrop(0, 0, 128, 150));
      var name = self.txt(colL, y + 86, C.VILLAGERS[o.from].name, 12, INK, { fontStyle: 'bold' }).setOrigin(0.5);
      if (name.width > 64) name.setScale(64 / name.width);
      c.add(name);
      // what: up to 3 items, centred in their column
      var n = o.items.length, step = n > 2 ? 42 : 58, tile = n > 2 ? 38 : 42;
      o.items.forEach(function (it, k) {
        var ix = mid + (k - (n - 1) / 2) * step, have = L.countItem(s, it[0]), enough = have >= it[1];
        self.standTile(c, ix - tile / 2, y + pad + (42 - tile) / 2, tile, tile, 'item');
        c.add(self.add.image(ix, y + pad + 21, 'items', C.ITEMS[it[0]].icon).setScale(tile === 42 ? 0.28 : 0.25));
        c.add(self.txt(ix, y + pad + 52, Math.min(have, it[1]) + '/' + it[1], 13, enough ? '#3f7d22' : INK, { fontStyle: 'bold' }).setOrigin(0.5));
      });
      // what they pay
      var rw = Math.min(124, midR - midL), ry = y + ch - pad - 26;
      self.standTile(c, mid - rw / 2, ry, rw, 26, 'reward');
      var pay = self.txt(0, ry + 13, o.gold + 'G', 14, '#8a4f1c', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      var heart = self.txt(0, ry + 13, '+\u2665', 14, '#c8506a', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      var line = 18 + 4 + pay.width + 6 + heart.width, lx = mid - line / 2;
      c.add(self.add.image(lx + 9, ry + 13, 'items', C.ICON.coin).setScale(0.15));
      pay.x = lx + 22;
      heart.x = pay.x + pay.width + 6;
      c.add([pay, heart]);
      // Deliver (green when everything is in the bag), and a smaller Skip
      var ok = L.canDeliver(s, i);
      var deliver = self.button(c, colR, y + 42, btnW, 36, 'Deliver', function () {
        if (!ok) return self.toast('You need everything on the order first.');
        var gold = L.deliverOrder(s, i);
        sfx('gift');
        world().changed();
        world().save();
        self.toast(C.VILLAGERS[o.from].name + ' paid ' + gold + 'G. Thank you!', 2000, 0x7a4d12);
        reopen('orders');
      }, ok ? GREEN : 0xb0a288);
      if (!ok) deliver.setAlpha(0.6);
      self.standSoftButton(c, colR, y + 84, 68, 26, 'Skip', function () {
        self.confirm('SKIP THIS ORDER?\nA new one comes in about ' + soon(C.ORDERS.skip) + '.', function () {
          L.skipOrder(s, i);
          world().changed();
          reopen('orders');
        });
      });
    });
  };

  Object.assign(F.UIScene.prototype, M);
})(window.Farm = window.Farm || {});
