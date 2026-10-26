// The market stall in the town plaza: tap it to sell or collect, the order board nearby, coins and a "!" that
// bob over them, and villagers who walk up to buy what is on the shelves.
// Mixed into WorldScene; runs after 19-extras.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    var self = this, find = function (type) { return self.objects.filter(function (o) { return o.type === type; })[0]; };
    var stand = find('stand'), board = find('orders');
    this.standObj = stand;
    if (stand) {
      this.standCoin = this.add.image((stand.x0 + 1) * T, (stand.y0 - 1.4) * T, 'items', C.ICON.coin).setScale(1.2).setDepth(DEPTH.Above + 1);
      this.tweens.add({ targets: this.standCoin, y: '-=40', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    if (board) {
      this.boardMark = this.add.image((board.x0 + 1) * T, (board.y0 - 0.2) * T, 'items', C.ICON.exclaim).setScale(1).setDepth(DEPTH.Above + 1);
      this.tweens.add({ targets: this.boardMark, scale: 1.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  };

  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    updateExtras.call(this, dt, time);
    var s = this.state;
    if (this.standCoin) this.standCoin.setVisible(L.standCoins(s) > 0);
    if (this.boardMark) {
      var ready = false;
      for (var i = 0; i < s.orders.length; i++) if (L.canDeliver(s, i)) ready = true;
      this.boardMark.setVisible(ready);
    }
  };

  // Buyers come by as the clock runs. In town, a villager walks up to the stall and buys the lot in front of
  // you; anywhere else the sale just happens.
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var s = this.state, before = s.time, ended = tickClock.call(this, dt);
    if (ended || s.time <= before) return ended;
    var self = this, watch = !!(this.standObj && this.villagers && this.points.stall_front);
    var r = L.standTick(s, s.time - before, watch);
    r.sold.forEach(function (sale) { self.announceSale(sale, false); });
    r.due.forEach(function (shelf) { self.sendBuyer(shelf); });
    if (r.sold.length) this.changed();
    return ended;
  };

  // Picks the nearest villager who is out in town and free, and walks them to the stall to buy a lot.
  P.sendBuyer = function (shelf) {
    var self = this, s = this.state;
    this.buyers = this.buyers || {};
    if (this.buyers[shelf]) return;
    var spot = this.points.stall_front, best = null, bestD = Infinity;
    this.villagers.list.forEach(function (v) {
      if (!v.visible || v.errand || v.hideAtEnd) return;
      var d = Math.hypot(v.x - spot.x, v.y - spot.y);
      if (d < bestD) { best = v; bestD = d; }
    });
    var ok = best && this.villagers.errand(best, spot, 'up', 1800, function (v) {
      var sale = L.sellLot(s, shelf, v.key);
      delete self.buyers[shelf];
      if (!sale) return;
      self.emote(v, C.ICON.coin);
      self.announceSale(sale, true);
      self.changed();
    });
    if (ok) this.buyers[shelf] = best.key;
    else { // nobody around to come by: someone buys it anyway
      var sale = L.sellLot(s, shelf, null);
      if (sale) this.announceSale(sale, false);
      this.changed();
    }
  };

  P.announceSale = function (sale, here) {
    var who = sale.buyer ? C.VILLAGERS[sale.buyer].name : 'A buyer';
    F.ui.toast(who + ' bought your ' + sale.n + ' ' + C.ITEMS[sale.id].name + '! ' + sale.coins + 'G is waiting at the market stall.', 2600, 0x7a4d12);
    if (this.standObj) {
      sfx('coin');
      this.floatTextAt((this.standObj.x0 + 1) * T, (this.standObj.y0 - 0.5) * T, '+' + sale.coins + 'G');
    } else if (here) sfx('coin');
  };

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var s = this.state, self = this;
    if (o.type === 'stand') {
      var coins = L.standCoins(s);
      if (coins) {
        return {
          label: 'Collect', icon: C.ICON.coin, run: function () {
            F.ui.collectStand();
            self.floatTextAt((o.x0 + 1) * T, (o.y0 - 0.5) * T, '+' + coins + 'G');
          },
        };
      }
      return { label: 'Sell', icon: C.ICON.crate, run: function () { F.ui.openStand('shelves'); } };
    }
    if (o.type === 'orders') return { label: 'Orders', icon: C.ICON.book, run: function () { F.ui.openStand('orders'); } };
    return extraObjectAction.call(this, o, held, def);
  };

})(window.Farm = window.Farm || {});
