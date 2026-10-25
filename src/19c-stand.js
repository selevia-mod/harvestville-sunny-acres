// The farm stand in the world: tap it to sell or collect, the order board next to it, coins and a "!" that
// bob over them, and buyers that come by as the clock runs.
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

  // Buyers come by as the clock runs.
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var s = this.state, before = s.time, ended = tickClock.call(this, dt);
    if (ended || s.time <= before) return ended;
    var sold = L.standTick(s, s.time - before);
    var self = this;
    sold.forEach(function (lot) {
      var who = lot.buyer ? C.VILLAGERS[lot.buyer].name : 'A buyer';
      F.ui.toast(who + ' bought your ' + lot.n + ' ' + C.ITEMS[lot.id].name + '! ' + lot.coins + 'G is waiting at the stand.', 2600, 0x7a4d12);
      if (self.standObj) {
        sfx('coin');
        self.floatTextAt((self.standObj.x0 + 1) * T, (self.standObj.y0 - 0.5) * T, '+' + lot.coins + 'G');
      }
    });
    if (sold.length) this.changed();
    return ended;
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
    if (o.type === 'orders') return { label: 'Orders', icon: C.ICON.note, run: function () { F.ui.openStand('orders'); } };
    return extraObjectAction.call(this, o, held, def);
  };

})(window.Farm = window.Farm || {});
