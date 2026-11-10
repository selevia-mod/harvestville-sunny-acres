// Edit Farm part 1 (docs/edit-farm.md): what the farm map used to draw as tiles is painted where its piece stands, and
// painted again when it moves: Lily's stand (its 6 x 4 tiles, solid) and the field (the field's ground under every
// field plot, in the season's colour, tillable). The house's picture, its mailbox and the window glows follow the house.
// After Decorate, when a building moved, the farm opens again: the door, the pen, the dog, the horse and the farmhands
// take their new places (12a-buildings-world.js).
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR, T = C.TILE;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var STAND = 29, STAND_COLS = 7; // Lily's stand: tiles 29..34, 36..41, 43..48, 50..55 of the 'tiles' sheet (7 a row)

  var frameGround = function (x, y) {
    var raw = F.ASSETS.maps.farm, g = raw.layers.filter(function (l) { return l.name === 'Ground'; })[0];
    return g ? g.data[y * raw.width + x] : 0;
  };
  // a tile on a layer, in this season's colour when it changes with the seasons (and kept on the seasonal list)
  var paint = function (w, layer, gid, x, y) {
    w.seasonal = (w.seasonal || []).filter(function (e) { return !(e.layer === layer && e.x === x && e.y === y); });
    if (!gid) { if (w.layers[layer] && w.tileAt(layer, x, y)) w.layers[layer].removeTileAt(x, y); return; }
    var slot = w.slotOf && w.slotOf[gid], ts = w.map.getTileset('seasons');
    if (slot === undefined || !ts) { w.putTile(layer, gid, x, y); return; }
    w.seasonal.push({ layer: layer, x: x, y: y, slot: slot });
    w.putTile(layer, ts.firstgid + L.date(w.state.day).season * Object.keys(w.slotOf).length + slot, x, y);
  };

  P.paintBuildings = function () {
    var self = this, s = this.state, now = {};
    if (this.mapKey !== 'farm' || !this.layers || !this.layers.Ground) return;
    (s.yard.items || []).forEach(function (it) {
      var type = O.types[it.t];
      if (!type) return;
      if (type.fieldPlot) L.yardBox(it.t, it.x, it.y).forEach(function (p) { now['Ground:' + p[0] + ',' + p[1]] = self.gids.field; });
      else if (type.building === 'shop') {
        for (var r = 0; r < 4; r++) for (var c = 0; c < 6; c++) now['Walls:' + (it.x + c) + ',' + (it.y + r)] = STAND + r * STAND_COLS + c;
      }
    });
    var was = this.buildingTiles || {};
    Object.keys(was).forEach(function (k) {
      if (now[k] === was[k]) return;
      var parts = k.split(':'), xy = parts[1].split(','), x = Number(xy[0]), y = Number(xy[1]);
      paint(self, parts[0], parts[0] === 'Ground' ? frameGround(x, y) : 0, x, y);
    });
    Object.keys(now).forEach(function (k) {
      if (was[k] === now[k]) return;
      var parts = k.split(':'), xy = parts[1].split(',');
      paint(self, parts[0], now[k], Number(xy[0]), Number(xy[1]));
    });
    this.buildingTiles = now;
    this.recollide();
    // the house's picture and its mailbox where the house stands now
    var hb = F.houseBlock && F.houseBlock(s);
    if (hb && this.houseImg) this.houseImg.setPosition(hb.x * T, (hb.y + hb.h) * T);
    var m = L.buildingsOf(s, 'house')[0], mt = m && L.maskTiles(m.t, m.x, m.y, 'M')[0];
    if (mt) {
      if (!this.mailboxImg) { F.ensureTexture(this, 'props/mailbox'); this.mailboxImg = this.add.image(0, 0, 'props/mailbox').setOrigin(0, 1).setDisplaySize(T, 2 * T); }
      this.mailboxImg.setPosition(mt[0] * T, (mt[1] + 1) * T).setDepth(DEPTH.actor + (mt[1] + 1) * T / 1e5);
    }
  };

  var renderYard = P.renderYard;
  P.renderYard = function () {
    renderYard.apply(this, arguments);
    this.paintBuildings();
  };
  var create = P.create;
  P.create = function () {
    this.buildingTiles = null;
    this.mailboxImg = null;
    return create.apply(this, arguments);
  };

  // a building moved while decorating: the farm opens again, everything in its new place
  var where = function (s) {
    return (s.yard.items || []).filter(function (it) { return L.isBuilding(it.t); }).map(function (it) { return it.t + ':' + it.x + ',' + it.y; }).sort().join(';');
  };
  var startYard = P.startYard;
  P.startYard = function () {
    var was = this.yd;
    startYard.apply(this, arguments);
    if (!was && this.yd) this.yd.buildings = where(this.state);
  };
  var endYard = P.endYard;
  P.endYard = function () {
    var yd = this.yd, moved = yd && yd.buildings != null && yd.buildings !== where(this.state);
    endYard.apply(this, arguments);
    if (!moved) return;
    var self = this;
    this.busy = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', function () { self.state.player = { x: null, y: null, dir: 'down' }; self.scene.restart(); });
  };
})(window.Farm = window.Farm || {});
