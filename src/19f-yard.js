// Outdoor decorations at runtime: your yard on the farm (fences that join up, paths, hedges, garden and yard
// pieces), Decorate mode outdoors (tap a piece and drag it, put it away, place pieces from storage; fences, paths
// and hedges are placed tile by tile with a tap each), and Mira's Outdoor catalog. Rules are in 01-logic6.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var O = C.OUTDOOR;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var U = 128, CELL = 3 * U, GAP = 16, COLS = 6; // the yard sheet's layout (tools/art/outdoor.js)
  var WHY = {
    outside: "It doesn't fit there.", blocked: "You can't build there.", taken: "Something's already there.",
    blocks: 'That would block the way to a door, the field or the pen.', full: 'Your yard is full! Put something away first.', player: "You're standing there!",
  };
  var TILE_KINDS = { fence: 1, path: 1, hedge: 1 };

  // The farm map's free land, worked out once.
  F.farm = function () {
    if (!F.farmMemo) F.farmMemo = L.farmInfo(F.ASSETS.maps.farm);
    return F.farmMemo;
  };

  // The yard sheet, with a frame per piece (fences: 'key:h', 'key:v', 'key:p').
  F.yardTexture = function (scene) {
    var key = 'yard';
    if (scene.textures.exists(key)) return key;
    F.ensureTexture(scene, key);
    var tex = scene.textures.get(key), k = 0;
    O.types.forEach(function (t) {
      if (t.prop) return;
      var names = t.kind === 'fence' ? [t.key + ':h', t.key + ':v', t.key + ':p'] : [t.key];
      names.forEach(function (name) {
        var x = 8 + (k % COLS) * (CELL + GAP), y = 8 + Math.floor(k / COLS) * (CELL + GAP), w = t.kind === 'fence' ? 1 : t.w, h = t.kind === 'fence' ? 1 : t.h;
        tex.add(name, 0, x, y + CELL - h * U, w * U, h * U);
        k++;
      });
    });
    return key;
  };

  // A piece's picture for a list row or a sprite: { key, frame, w, h } (w, h in half-resolution pixels).
  F.yardImg = function (scene, t, shape) {
    var type = O.types[t];
    if (type.prop) return { key: F.ensureTexture(scene, 'props/' + type.prop), frame: undefined, w: type.w * U, h: type.h * U };
    return { key: F.yardTexture(scene), frame: type.key + (type.kind === 'fence' ? ':' + (shape || 'h') : ''), w: type.w * U, h: type.h * U };
  };

  var P = F.WorldScene.prototype;

  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (this.mapKey !== 'farm') return;
    var moved = L.yardRepair(this.state, F.farm());
    if (moved) this.time.delayedCall(800, function () { if (F.ui) F.ui.toast(moved + (moved > 1 ? ' pieces' : ' piece') + ' of your yard went back into storage.'); });
    this.yardSprites = [];
    this.yardZones = [];
    this.renderYard();
  };

  // Draws every piece and makes the solid ones solid.
  P.renderYard = function () {
    var self = this, s = this.state;
    this.yardSprites.forEach(function (img) { img.destroy(); });
    this.yardZones.forEach(function (z) { self.solids.remove(z, true, true); });
    Object.keys(this.yardBlocked || {}).forEach(function (i) { delete self.blocked[i]; });
    this.yardSprites = [];
    this.yardZones = [];
    this.yardBlocked = {};
    s.yard.items.forEach(function (it, i) {
      var type = O.types[it.t], img = F.yardImg(self, it.t, type.kind === 'fence' ? L.fenceShape(s, i) : null);
      var sp = self.add.image(it.x * T, (it.y + type.h) * T, img.key, img.frame).setOrigin(0, 1).setDisplaySize(type.w * T, type.h * T);
      sp.setDepth(type.kind === 'path' ? DEPTH.Ground + 0.5 : !type.foot ? DEPTH.flat : DEPTH.actor + (it.y + type.h) * T / 1e5);
      self.yardSprites[i] = sp;
      var solid = L.yardSolid(it.t, it.x, it.y);
      if (!solid.length) return;
      solid.forEach(function (p) {
        var k = self.idx(p[0], p[1]);
        if (!self.blocked[k]) { self.blocked[k] = true; self.yardBlocked[k] = 1; }
      });
      var rows = type.foot, fy = it.y + type.h - rows;
      var zone = self.add.zone((it.x + type.w / 2) * T, (fy + rows / 2) * T, type.w * T - 16, rows * T - 16);
      self.physics.add.existing(zone, true);
      self.solids.add(zone);
      self.yardZones.push(zone);
    });
  };

  // ---------- Decorate mode outdoors ----------
  var updateCamera = P.updateCamera;
  P.updateCamera = function (lerp) {
    if (!this.yd) updateCamera.call(this, lerp);
  };

  P.startYard = function () {
    if (this.mapKey !== 'farm' || this.yd) return;
    var cam = this.cameras.main, f = this.feet();
    this.busy = true;
    F.input.reset();
    this.yd = { sel: null, drag: null, pan: null, brush: null, zoom: cam.zoom };
    cam.setZoom(cam.zoom * 0.6);
    cam.centerOn(Math.max(f.x, 22 * T), f.y + T);
    this.ydBox = this.add.graphics().setDepth(DEPTH.fx + 1);
    this.input.on('pointerdown', this.yardDown, this);
    this.input.on('pointermove', this.yardMove, this);
    this.input.on('pointerup', this.yardUp, this);
    this.yardChanged();
    sfx('pick');
  };

  P.endYard = function () {
    if (!this.yd) return;
    this.cameras.main.setZoom(this.yd.zoom);
    this.input.off('pointerdown', this.yardDown, this);
    this.input.off('pointermove', this.yardMove, this);
    this.input.off('pointerup', this.yardUp, this);
    this.ydBox.destroy();
    this.yd = null;
    this.busy = false;
    this.unstick();
    this.updateCamera(1);
    this.changed();
    this.save();
    F.bus.emit('yard', null);
  };

  // The piece under a world point: things in front first, paths last.
  P.yardAt = function (wx, wy) {
    var best = -1, bestKey = -Infinity;
    this.state.yard.items.forEach(function (it, i) {
      var type = O.types[it.t];
      if (wx < it.x * T || wx >= (it.x + type.w) * T || wy < it.y * T || wy >= (it.y + type.h) * T) return;
      var key = (type.kind === 'path' ? 0 : 1000) + it.y + type.h;
      if (key > bestKey) { bestKey = key; best = i; }
    });
    return best < 0 ? null : best;
  };

  // A solid piece can't go where the farmer stands.
  P.yardOnPlayer = function (t, x, y) {
    var f = this.feet(), fx = Math.floor(f.x / T), fy = Math.floor(f.y / T);
    return L.yardSolid(t, x, y).some(function (p) { return p[0] === fx && p[1] === fy; });
  };

  P.yardWhy = function (t, x, y, skip) {
    return L.yardCantPlace(this.state, F.farm(), t, x, y, skip) || (this.yardOnPlayer(t, x, y) ? 'player' : null);
  };

  P.yardSelect = function (i) {
    this.yd.sel = i;
    this.yd.brush = null;
    this.yardChanged();
  };

  P.yardChanged = function (bad) {
    var d = this.yd, g = this.ydBox;
    g.clear();
    if (d.sel != null) {
      var it = this.state.yard.items[d.sel], type = O.types[it.t];
      var x = (d.drag && d.drag.at ? d.drag.at.x : it.x) * T, y = (d.drag && d.drag.at ? d.drag.at.y : it.y) * T;
      g.lineStyle(16, bad ? 0xff5a4a : 0xffe27a, 1).strokeRoundedRect(x + 8, y + 8, type.w * T - 16, type.h * T - 16, 24);
    }
    F.bus.emit('yard', { sel: d.sel, brush: d.brush });
  };

  P.yardDown = function (p, over) {
    var d = this.yd;
    if (!d || over.length || (F.ui && F.ui.blocking())) return;
    var tx = Math.floor(p.worldX / T), ty = Math.floor(p.worldY / T);
    if (d.brush != null) { // placing fences, paths or hedges: one per tap
      d.tap = { id: p.id, x: p.x, y: p.y, tx: tx, ty: ty, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
      return;
    }
    var i = this.yardAt(p.worldX, p.worldY);
    if (i != null) {
      var it = this.state.yard.items[i];
      if (d.sel !== i) this.yardSelect(i);
      d.drag = { i: i, id: p.id, dx: tx - it.x, dy: ty - it.y, at: null };
    } else {
      d.pan = { id: p.id, x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, moved: false };
    }
  };

  P.yardMove = function (p) {
    var d = this.yd, cam = this.cameras.main;
    if (!d || !p.isDown) return;
    var pan = d.pan || d.tap;
    if (d.drag && p.id === d.drag.id) {
      var it = this.state.yard.items[d.drag.i], type = O.types[it.t];
      var x = Math.floor(p.worldX / T) - d.drag.dx, y = Math.floor(p.worldY / T) - d.drag.dy;
      if ((d.drag.at && d.drag.at.x === x && d.drag.at.y === y) || (!d.drag.at && x === it.x && y === it.y)) return;
      d.drag.at = { x: x, y: y };
      var img = this.yardSprites[d.drag.i], why = this.yardWhy(it.t, x, y, d.drag.i);
      img.setPosition(x * T, (y + type.h) * T).setAlpha(0.85).setDepth(DEPTH.fx).setTint(why ? 0xff8a80 : 0xffffff);
      this.yardChanged(!!why);
    } else if (pan && p.id === pan.id) {
      if (Math.abs(p.x - pan.x) + Math.abs(p.y - pan.y) > 8) pan.moved = true;
      if (pan.moved) cam.setScroll(pan.sx - (p.x - pan.x) / cam.zoom, pan.sy - (p.y - pan.y) / cam.zoom);
    }
  };

  P.yardUp = function (p) {
    var d = this.yd;
    if (!d) return;
    if (d.drag && p.id === d.drag.id) {
      var drag = d.drag;
      d.drag = null;
      if (drag.at) {
        var it = this.state.yard.items[drag.i], why = this.yardWhy(it.t, drag.at.x, drag.at.y, drag.i);
        var r = why || L.moveYard(this.state, F.farm(), drag.i, drag.at.x, drag.at.y);
        if (r === 'ok') sfx('stepWood');
        else { sfx('nope'); F.ui.toast(WHY[r] || "It can't go there."); }
        this.renderYard();
      }
      this.yardChanged();
    } else if (d.tap && p.id === d.tap.id) {
      var tap = d.tap;
      d.tap = null;
      if (!tap.moved) this.yardBrush(tap.tx, tap.ty);
    } else if (d.pan && p.id === d.pan.id) {
      if (!d.pan.moved && d.sel != null) this.yardSelect(null);
      d.pan = null;
    }
  };

  // One fence, path or hedge from storage onto a tapped tile.
  P.yardBrush = function (x, y) {
    var s = this.state, d = this.yd, t = d.brush;
    if (!s.yard.bag[t]) { d.brush = null; this.yardChanged(); return; }
    var why = this.yardWhy(t, x, y, null), r = why || L.placeYard(s, F.farm(), t, x, y);
    if (typeof r !== 'number') { sfx('nope'); F.ui.toast(WHY[r] || "It can't go there."); return; }
    sfx('stepWood');
    if (!s.yard.bag[t]) d.brush = null;
    this.renderYard();
    this.yardChanged();
  };

  P.yardStore = function () {
    var d = this.yd;
    if (!d || d.sel == null) return;
    L.storeYard(this.state, d.sel);
    sfx('pick');
    this.renderYard();
    this.yardSelect(null);
  };

  // From storage: tile pieces start a tap-to-place brush; other pieces go near the middle of the view.
  P.yardPlace = function (t) {
    var s = this.state, d = this.yd, type = O.types[t];
    if (TILE_KINDS[type.kind]) {
      d.sel = null;
      d.brush = t;
      this.yardChanged();
      return;
    }
    var mid = this.cameras.main.midPoint, farm = F.farm();
    var spot = L.yardFindSpot(s, farm, t, Math.floor(mid.x / T), Math.floor(mid.y / T));
    if (spot && this.yardOnPlayer(t, spot.x, spot.y)) spot = L.yardFindSpot(s, farm, t, Math.floor(mid.x / T) + type.w + 1, Math.floor(mid.y / T));
    if (!spot) { sfx('nope'); return F.ui.toast('There is no room for it. Put something away first.'); }
    var i = L.placeYard(s, farm, t, spot.x, spot.y);
    if (typeof i !== 'number') { sfx('nope'); return F.ui.toast(WHY[i] || "It doesn't fit."); }
    sfx('stepWood');
    this.renderYard();
    this.yardSelect(i);
  };

  // ---------- the UI: the bar, storage, Mira's Outdoor catalog ----------
  var K = F.UI_CONST, W = K.W, HGT = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, BROWN = 0x9a6a3a;
  var world = function () { return F.world; };
  var UI = F.UIScene.prototype;

  var create = UI.create;
  UI.create = function () {
    create.call(this);
    var self = this;
    F.bus.on('yard', function (info) { if (info) self.drawYardBar(info); else self.closeDecorBar(); });
  };

  var openDecor = UI.openDecor;
  UI.openDecor = function () {
    if (!world() || world().mapKey !== 'farm') return openDecor.call(this);
    if (this.blocking()) return;
    if (!this.tipYard) {
      this.tipYard = true;
      this.toast('Your yard: the meadow east of the field. Tap a piece to move it, drag the grass to look around.', 4500, 0x2f5a22);
    }
    world().startYard();
  };

  var back = UI.back;
  UI.back = function () {
    if (!this.modals.length && world() && world().yd) { world().endYard(); return true; }
    return back.call(this);
  };

  UI.drawYardBar = function (info) {
    var self = this, s = F.session.state, w = world();
    if (this.decorBar) this.decorBar.destroy();
    this.decorating = true;
    if (this.decorBtn) this.decorBtn.setVisible(false);
    F.input.reset();
    var c = this.decorBar = this.add.container(0, 0).setDepth(90), top = 440;
    c.add(this.add.rectangle(0, top, W, HGT - top, 0x000000, 0.001).setOrigin(0).setInteractive());
    this.panelImg(c, 6, top, W - 12, HGT - top - 6);
    c.add(this.txt(W / 2, top + 14, this.beautyLine(s), 13, INK, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0));
    var y1 = top + 68;
    if (info.brush != null) {
      var bt = O.types[info.brush];
      c.add(this.txt(W / 2, y1 - 12, 'Tap the grass to place ' + bt.name + ' (' + (s.yard.bag[info.brush] || 0) + ' left)', 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
      this.button(c, W / 2, y1 + 26, 160, 34, 'Done placing', function () { w.yd.brush = null; w.yardChanged(); }, GREEN);
    } else if (info.sel != null) {
      var it = s.yard.items[info.sel], type = O.types[it.t];
      c.add(this.txt(W / 2, y1 - 12, type.name + '   +' + type.beauty + ' beauty', 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
      this.button(c, W / 2 - 60, y1 + 26, 110, 34, 'Put away', function () { w.yardStore(); }, GREY);
      this.button(c, W / 2 + 60, y1 + 26, 80, 34, 'OK', function () { w.yardSelect(null); }, GREEN);
    } else {
      c.add(this.txt(W / 2, y1 - 8, 'Tap a piece to move it. Place more from Storage.\nBuy them at Mira\'s Woodshop (Outdoor tab).', 12, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
    }
    var n = Object.keys(s.yard.bag).reduce(function (sum, k) { return sum + s.yard.bag[k]; }, 0), y2 = HGT - 42;
    this.button(c, 90, y2, 150, 38, 'Storage' + (n ? ' ' + n : ''), function () { self.openYardStorage(0); }, BROWN);
    this.button(c, 270, y2, 150, 38, 'Done', function () { w.endYard(); sfx('pick'); }, GREEN);
  };

  UI.yardImg = function (t) { return F.yardImg(this, t); };

  UI.openYardStorage = function (page) {
    var self = this, s = F.session.state;
    var rows = Object.keys(s.yard.bag).map(Number).sort(function (a, b) { return a - b; }).map(function (t) {
      var type = O.types[t];
      return {
        img: self.yardImg(t), name: type.name, desc: 'You have ' + s.yard.bag[t] + '. +' + type.beauty + ' beauty' + (TILE_KINDS[type.kind] ? ' each.' : '.'),
        buttons: [{ label: 'Place', cb: function () { self.closeModal(); world().yardPlace(t); } }],
      };
    });
    this.listPanel({
      title: 'Yard Storage', rows: rows, page: page, reopen: function (tab, p) { self.openYardStorage(p); },
      sub: function () { return 'Outdoor pieces you own that are not in the yard.'; },
      empty: 'Nothing in storage.\nBuy fences, paths and garden pieces at Mira\'s Woodshop (Outdoor).',
    });
  };

  // Mira's Woodshop gets an Outdoor tab.
  var TABS = [['build', 'Build'], ['furniture', 'Furniture'], ['outdoor', 'Outdoor'], ['materials', 'Materials']];
  var listPanel = UI.listPanel;
  UI.listPanel = function (o) {
    if (o.title === "Mira's Woodshop" && o.tabs) o.tabs = TABS;
    return listPanel.call(this, o);
  };
  var openWoodshop = UI.openWoodshop;
  UI.openWoodshop = function (tab, page) {
    if (tab === 'outdoor') return this.openOutdoor(null, page);
    return openWoodshop.call(this, tab, page);
  };

  // cat null: the catalog's pages; else that page's pieces.
  UI.openOutdoor = function (cat, page) {
    var self = this, s = F.session.state, rows, o;
    if (cat == null) {
      rows = O.cats.map(function (c) {
        var first = O.types.filter(function (t) { return t.cat === c[0]; })[0];
        return {
          img: self.yardImg(O.index[first.key]), name: c[1], desc: c[2],
          buttons: [{ label: 'See all', color: BLUE, cb: function () { self.closeModal(); self.openOutdoor(c[0], 0); } }],
        };
      });
    } else {
      rows = O.types.map(function (t, i) { return i; }).filter(function (i) { return O.types[i].cat === cat; }).map(function (i) {
        var type = O.types[i], onSale = L.yardOnSale(s, i), tile = TILE_KINDS[type.kind];
        var fest = type.festival && C.FESTIVALS.filter(function (f) { return f.key === type.festival; })[0];
        return {
          img: self.yardImg(i), name: type.name,
          desc: type.price + 'G' + (tile ? ' each' : '') + '. +' + type.beauty + ' beauty.' + (onSale ? '' : ' Sold in ' + fest.season + '.') + (s.yard.bag[i] ? ' You have ' + s.yard.bag[i] + '.' : ''),
          buttons: !onSale ? [] : (tile ? [1, 10] : [1]).map(function (n, k) {
            return {
              label: 'Buy ' + (n > 1 ? n + ' ' : '') + type.price * n + 'G', color: k ? BLUE : GREEN, cb: function () {
                var r = L.buyYard(s, i, n);
                if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
                if (r !== 'ok') { sfx('nope'); return self.toast("Mira can't sell that right now."); }
                sfx('coin');
                world().changed();
                world().save();
                self.closeModal();
                self.openOutdoor(cat, page);
                self.toast('In your yard storage. Place it with Decorate on the farm.');
              },
            };
          }),
        };
      });
    }
    var title = cat == null ? "Mira's Woodshop" : O.cats.filter(function (c) { return c[0] === cat; })[0][1];
    o = this.listPanel({
      title: title, tab: 'outdoor', page: page, rows: rows, talk: cat == null ? 'mira' : null, tabs: cat == null ? TABS : null,
      reopen: function (tab, p) { if (cat != null && tab === 'outdoor') self.openOutdoor(cat, p); else self.openWoodshop(tab, p); },
      sub: function () { return s.gold + 'G   ' + (cat == null ? 'Fences, paths, gardens and more for your yard.' : 'Bought pieces go to your yard storage.'); },
    });
    if (cat != null) this.button(this.modals[this.modals.length - 1].c, 50, 96, 56, 34, 'Back', function () { self.closeModal(); self.openOutdoor(null, 0); }, GREY);
    return o;
  };
})(window.Farm = window.Farm || {});
