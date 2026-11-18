// The owner's vehicles, farm machines and deep-mine critters (18 Nov 2026: art-src/vehicles/, tools/art/vehicles-import.js),
// the 'vehicles' download pack. Each picture is fetched when the farm needs it (the cart or a truck you own, a machine you
// made, the machines' icons; the critters on the deep floors, 19zzz...z-deep-mine.js); until it comes the game's own drawn
// stand-in shows, and the moment it comes it takes the stand-in's place. Offline with nothing on the phone: the stand-ins.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var packHas = function () { return !!(F.packFiles && F.packFiles('vehicles').length); };
  if (F.PACK_INFO && packHas()) F.PACK_INFO.vehicles = { name: 'Vehicles', icon: 'crate', desc: "The horse cart and the trucks, Bram's farm machines and the deep Mine's critters." };
  var VIEWS = ['side', 'front', 'back'];
  var have = function (k) { return !!(F.images && F.images[k]); };
  var need = function (keys) {
    if (!F.needImage || !F.canFetch || !F.canFetch() || !F.packedFile) return;
    keys.forEach(function (k) { if (!have(k) && F.packedFile(k)) F.needImage(k); });
  };
  var views = function (name) {
    var out = [];
    VIEWS.forEach(function (v) { out.push('veh_' + name + '_' + v + '_empty', 'veh_' + name + '_' + v + '_full'); });
    return out;
  };
  // what this farm shows: its cart, its trucks, its machines (and the machines' icons, in the bag and at the Forge)
  F.vehWanted = function (s) {
    if (!s || s.isVisit) return [];
    var out = ['machine_icons'];
    if (L.gmCartMade && L.gmCartMade(s)) out = out.concat(views('cart'));
    if (L.trkOwns && F.trkArt) [1, 2, 3].forEach(function (i) { if (L.trkOwns(s, i) && F.trkArt(i)) out = out.concat(views(F.trkArt(i))); });
    if (L.mkMade) (C.MACHINE_KINDS || []).forEach(function (k) { if (L.mkMade(s, k)) out.push('machine_' + k); });
    return out;
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    if (packHas()) need(F.vehWanted(F.session && F.session.state));
  };

  // ---------- a picture came: in its place at once ----------
  var redraw = null;
  var swap = function () {
    redraw = null;
    var w = F.world, c = w && w.gmCart;
    if (!w || !w.sys || !w.sys.isActive() || w.busy || !c) return;
    if (c.truck) {
      var sz = F.trkSize(c.truck, c.view);
      c.sz = sz;
      c.img.setTexture(F.trkTex(w, c.truck, c.view, c.loaded)).setDisplaySize(sz[0] * C.TILE, sz[1] * C.TILE);
    } else if (c.view) {
      var v = c.view;
      c.view = null;
      w.gmCartView(v, c.flip);
    }
  };
  F.bus.on('packart', function (k) {
    if (/^veh_/.test(k) && !redraw) redraw = setTimeout(swap, 120); // (the six views come close together: once for them all)
    if (k === 'machine_icons' && F.world && F.world.textures && F.world.textures.exists('items') && F.paintMachineIcons) F.paintMachineIcons(F.world);
    var w = F.world, m = /^machine_([a-z]+)$/.exec(k);
    if (m && m[1] !== 'icons' && w && w.mkSpr && w.mkSpr.active && L.mkHeld && L.mkHeld(w.state) === m[1]) w.mkSpr.setTexture(F.mkTex(w, m[1])).setDisplaySize(1.5 * C.TILE, C.TILE);
  });
})(window.Farm = window.Farm || {});
