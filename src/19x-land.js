// More land on the farm (rules 01-logicE.js, blocks 00-zzland.js): a block you don't own is grass with a fence around it
// and a For Sale sign; one you own has no fence and is field, 10 by 10. The next one for sale has a coin over its sign.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var LAND = C.LAND;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var COIN_Y = -0.9 * T;

  // Field in this season's colours (a field in the map changes with 11-world.js's applySeason; this joins it).
  var fieldTile = function (w, x, y) {
    var gid = w.gids.field, slot = w.slotOf[gid], ts = w.map.getTileset('seasons');
    if (slot === undefined || !ts) return w.putTile('Ground', gid, x, y);
    w.seasonal.push({ layer: 'Ground', x: x, y: y, slot: slot });
    w.putTile('Ground', ts.firstgid + L.date(w.state.day).season * Object.keys(w.slotOf).length + slot, x, y);
  };
  var openBlock = function (w, b) {
    for (var y = b.y0; y <= b.y1; y++) for (var x = b.x0; x <= b.x1; x++) {
      if (w.tileAt('Walls', x, y)) w.layers.Walls.removeTileAt(x, y);
      fieldTile(w, x, y);
    }
  };
  var fenceBlock = function (w, b) {
    var g = w.gids;
    for (var y = b.y0; y <= b.y1; y++) for (var x = b.x0; x <= b.x1; x++) {
      var edgeX = x === b.x0 || x === b.x1, edgeY = y === b.y0 || y === b.y1;
      if (x === b.sign[0] && y === b.sign[1]) w.putTile('Walls', g.land_sign, x, y);
      else if (edgeX && edgeY) w.putTile('Walls', g.fence_post, x, y);
      else if (edgeY) w.putTile('Walls', g.fence_h, x, y);
      else if (edgeX) w.putTile('Walls', g.fence_v, x, y);
    }
  };
  var showCoin = function (w) {
    if (w.landCoin) { w.landCoin.destroy(); w.landCoin = null; }
    var b = LAND.blocks[L.landOwned(w.state)];
    if (!b || w.state.isVisit) return;
    var x = (b.sign[0] + 0.5) * T, y = (b.sign[1] + 0.5) * T + COIN_Y;
    w.landCoin = w.add.image(x, y, 'items', C.ICON.coin).setDepth(DEPTH.Above + 1).setScale(0.9);
    w.tweens.add({ targets: w.landCoin, y: y - 40, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };

  var create = P.create;
  P.create = function () {
    create.call(this);
    this.landCoin = null;
    if (this.mapKey !== 'farm') return;
    var self = this, owned = L.landOwned(this.state);
    LAND.blocks.forEach(function (b, i) { if (i < owned) openBlock(self, b); else fenceBlock(self, b); });
    this.recollide();
    showCoin(this);
  };

  // Soil here is for land you own, and not under a yard piece.
  var isTillable = P.isTillable;
  P.isTillable = function (x, y) {
    return isTillable.call(this, x, y) && !(this.mapKey === 'farm' && x >= LAND.x0 && (!L.landOpen(this.state, x, y) || L.landTaken(this.state, x, y)));
  };

  P.askLand = function (i) {
    var self = this, s = this.state, owned = L.landOwned(s), price = L.landPrice(s), ui = F.ui;
    if (i !== owned) return ui.dialog('FOR SALE\nNot yet. These blocks sell one at a time: look for the sign with a coin over it.');
    var text = 'BUY THIS LAND?\n10 by 10 tiles of your own for ' + price.toLocaleString('en-US') + 'G. You have ' + s.gold.toLocaleString('en-US') + 'G.';
    if (s.gold < price) return ui.dialog(text.replace('BUY THIS LAND?', 'FOR SALE'));
    ui.confirm(text, function () { self.landBought(); });
  };
  P.landBought = function () {
    var s = this.state, i = L.landOwned(s);
    if (L.buyLand(s) !== 'ok') return;
    var b = LAND.blocks[i];
    openBlock(this, b);
    this.recollide();
    showCoin(this);
    for (var k = 0; k < 10; k++) this.puff({ x: b.x0 + Math.floor(Math.random() * 10), y: b.y0 + Math.floor(Math.random() * 10) }, 0xd9b77a, 2);
    sfx('coin');
    this.changed();
    F.ui.toast(LAND.blocks[i + 1] ? 'This land is yours! Till it, plant it or decorate it.' : 'All six blocks are yours!', 3200);
  };

  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mapKey === 'farm' && !this.state.isVisit) {
      var self = this, pt = this.front(0.7), tx = Math.floor(pt.x / T), ty = Math.floor(pt.y / T), owned = L.landOwned(this.state);
      for (var i = owned; i < LAND.blocks.length; i++) {
        if (LAND.blocks[i].sign[0] === tx && LAND.blocks[i].sign[1] === ty) {
          return { label: 'For sale', icon: C.ICON.coin, run: (function (n) { return function () { self.askLand(n); }; })(i) };
        }
      }
    }
    return resolve.call(this);
  };
})(window.Farm = window.Farm || {});
