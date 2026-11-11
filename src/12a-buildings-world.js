// Edit Farm part 1 (docs/edit-farm.md): the buildings are yard pieces (src/00-zzzzzzzzzzzzzzzzzz-buildings.js); here each
// one gives the farm what the map used to: the house door (a warp) and where you come out of it, the mailbox, Lily's
// shop, the incubator, the pen's and the dog's zones, the horse's spot, and the ponds' water. Before every other
// buildObjects wrapper (19d-home.js and on read these), and before setupFarm (the herd and the dog take their zones).
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR, T = C.TILE;
  var P = F.WorldScene.prototype;

  var rect = function (type, name, b, props) {
    return { type: type, name: name, x0: b[0], y0: b[1], x1: b[2], y1: b[3], px: b[0] * T, py: b[1] * T, pw: (b[2] - b[0] + 1) * T, ph: (b[3] - b[1] + 1) * T, props: props || {}, building: true };
  };
  var box = function (tiles) {
    if (!tiles.length) return null;
    var xs = tiles.map(function (p) { return p[0]; }), ys = tiles.map(function (p) { return p[1]; });
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  };
  // the farm's buildings now (the pieces), by kind: [{ it, type }]
  L.buildingsOf = function (s, kind) {
    return ((s && s.yard && s.yard.items) || []).filter(function (it) { return O.types[it.t] && O.types[it.t].building === kind; });
  };

  P.placeBuildings = function () {
    var self = this, s = this.state;
    this.objects = (this.objects || []).filter(function (o) { return !o.building; });
    ['pen', 'dogarea'].forEach(function (z) { if (self.zones[z]) self.zones[z] = self.zones[z].filter(function (o) { return !o.building; }); });
    this.pondWater = {};
    this.mailAt = null;
    (s.yard.items || []).forEach(function (it) {
      var type = O.types[it.t], b = type && type.building;
      if (!b) return;
      var tiles = function (c) { return L.maskTiles(it.t, it.x, it.y, c); };
      if (b === 'house') {
        var d = tiles('D')[0];
        self.objects.push(rect('warp', 'house_door', [d[0], d[1], d[0], d[1]], { to: 'house', spawn: 'door', label: 'Enter' }));
        var pt = { x: (d[0] + 0.5) * T, y: (d[1] + 1.6) * T, props: { dir: 'down' }, type: 'spawn' };
        self.points.house_door = pt;
        self.points.spawn = pt;
        var m = tiles('M')[0];
        if (m) { self.objects.push(rect('mail', 'mailbox', [m[0], m[1], m[0], m[1]])); self.mailAt = m; }
      } else if (b === 'ranch') {
        var pen = box(tiles('P')), inc = box(tiles('I'));
        if (pen) (self.zones.pen = self.zones.pen || []).push(rect('pen', 'animal_pen', pen));
        if (inc) self.objects.push(rect('incubator', 'incubator', inc));
      } else if (b === 'dog') {
        // (the open yard in front of the doghouse: owner, 11 Nov 2026, "check the dog": with the whole yard he slept on its roof)
        (self.zones.dogarea = self.zones.dogarea || []).push(rect('dogarea', 'dog_yard', [it.x, it.y + (type.dogTop || 0), it.x + type.w - 1, it.y + type.h - 1]));
      } else if (b === 'shop') {
        var c = box(tiles('S'));
        if (c) self.objects.push(rect('shop', 'seed_shop', c));
      } else if (b === 'stable') {
        var hs = tiles('H')[0];
        if (hs) self.points.horse = { x: (hs[0] - 1.7) * T, y: (hs[1] + 0.2) * T, props: {}, type: 'place' }; // (where the map had it: 17.3, 35.2)
      } else if (b === 'pond') {
        tiles('W').forEach(function (p) { self.pondWater[p[1] * C.FARM_W + p[0]] = 1; });
      }
    });
  };

  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (this.mapKey !== 'farm') return;
    this.placeBuildings();
  };
  // the ponds' water (fishing, the watering can): the tiles under a pond piece
  var isWater = P.isWater;
  P.isWater = function (x, y) {
    if (this.mapKey === 'farm' && this.pondWater && this.pondWater[y * C.FARM_W + x]) return true;
    return isWater.call(this, x, y);
  };
})(window.Farm = window.Farm || {});
