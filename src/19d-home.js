// The farmhouse at runtime: the player's furniture (from the furn_<style> sheets), wallpaper and floor, what the
// furniture lets you do (sleep, TV, kitchen...), the upgraded house on the farm, and Decorate mode (tap a piece,
// drag it to move it, turn it, put it away, place pieces from storage, change wallpaper and floor).
// Mixed into WorldScene and UIScene. The rules are in 01-logic4.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var H = C.HOME;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var CELL = 384, U = 128, GAP = 16; // the furniture sheets' layout (tools/art/furniture.js)
  var HOUSE_BLOCK = { x: 4, y: 3, w: 5, h: 4 }; // the farmhouse on the farm map (tiles)
  var WHY = {
    outside: "It doesn't fit there.", wall: 'That one hangs on the back wall.', taken: "Something's already there.",
    door: 'Keep the doorway clear!', blocks: "That would block the way to something you use.", lastbed: 'Every home needs a bed!',
  };

  // The texture for a style's furniture, with a frame per kind of furniture (frame = its index in HOME.types).
  F.furnTexture = function (scene, v) {
    var key = 'furn_' + v;
    if (scene.textures.exists(key)) return key;
    F.ensureTexture(scene, key);
    var tex = scene.textures.get(key);
    H.types.forEach(function (type, t) {
      var x = 8 + (t % 4) * (CELL + GAP), y = 8 + Math.floor(t / 4) * (CELL + GAP);
      tex.add(t, 0, x, y + CELL - type.h * U, type.w * U, type.h * U);
    });
    return key;
  };

  // A wallpaper or floor tile as its own frame of the indoor texture (for previews in the panels).
  F.surfaceFrame = function (scene, kind, v) {
    var key = F.ensureTexture(scene, 'indoor'), tex = scene.textures.get(key), name = kind + (v ? '_' + v : '');
    if (!tex.has(name)) {
      var props = (F.ASSETS.maps.house_1.tilesets.filter(function (ts) { return ts.name === 'indoor'; })[0] || {}).tiles || [];
      var tile = props.filter(function (t) { return (t.properties || []).some(function (p) { return p.name === 'name' && p.value === name; }); })[0];
      if (!tile) return null;
      tex.add(name, 0, 8 + (tile.id % 7) * (256 + GAP), 8 + Math.floor(tile.id / 7) * (256 + GAP), 256, 256);
    }
    return { key: key, frame: name };
  };

  var P = F.WorldScene.prototype;

  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (this.mapKey === 'house') this.buildHome();
    if (this.mapKey === 'farm') this.showHouse();
  };

  // The farmhouse on the farm: from the Cottage up, its picture replaces the cabin's tiles (which stay solid).
  P.showHouse = function () {
    var lv = this.state.home.level, b = HOUSE_BLOCK, walls = this.layers.Walls;
    if (lv < 2 || !walls) return;
    for (var y = b.y; y < b.y + b.h; y++) for (var x = b.x; x < b.x + b.w; x++) {
      var t = walls.getTileAt(x, y);
      if (t) t.setAlpha(0);
    }
    var key = 'props/house_' + lv;
    F.ensureTexture(this, key);
    this.houseImg = this.add.image(b.x * T, (b.y + b.h) * T, key).setOrigin(0, 1).setDisplaySize(5 * T, 5 * T).setDepth(DEPTH.Walls + 0.05);
  };

  // ----- inside
  P.buildHome = function () {
    this.homeSprites = [];
    this.homeZones = [];
    this.applySurfaces();
    this.placeHome();
  };

  // Wallpaper and floor: swap the map's plain tiles for the chosen style's.
  P.applySurfaces = function () {
    var self = this, hm = this.state.home;
    var want = { floor: 'floor', floor2: 'floor', wall: 'wall', wall_low: 'wall_low' };
    ['Ground', 'Walls'].forEach(function (name) {
      var layer = self.layers[name];
      if (!layer) return;
      layer.forEachTile(function (t) {
        var base = t.properties && t.properties.name;
        if (base == null) return;
        var plain = base.replace(/_\d+$/, '');
        if (!want[plain]) return;
        var v = want[plain] === 'floor' ? hm.floor : hm.wall;
        var gid = self.gids[want[plain] + (v ? '_' + v : '')];
        if (gid && gid !== t.index) self.putTile(name, gid, t.x, t.y);
      });
    });
    this.recollide();
  };

  // The furniture: pictures, solid feet, things to use, where you wake up and where your spouse stands.
  P.placeHome = function () {
    var self = this, s = this.state, size = L.homeSize(s);
    this.homeSprites.forEach(function (img) { img.destroy(); });
    this.homeZones.forEach(function (z) { self.solids.remove(z, true, true); });
    this.homeSprites = [];
    this.homeZones = [];
    this.blocked = {};
    this.objects = this.objects.filter(function (o) { return !o.furn; });
    s.home.items.forEach(function (it, i) {
      var type = H.types[it.t];
      self.homeSprites[i] = self.furnSprite(it);
      if (type.place !== 'floor') {
        if (type.use === 'cat') self.objects.push({ type: 'catbed', name: type.key, x0: it.x, y0: it.y, x1: it.x, y1: it.y, props: {}, furn: true });
        return;
      }
      var tiles = L.furnTiles(it.t, it.x, it.y);
      tiles.foot.forEach(function (p) { self.blocked[self.idx(p[0], p[1])] = true; });
      var fy = it.y + type.h - type.foot;
      var zone = self.add.zone((it.x + type.w / 2) * T, (fy + type.foot / 2) * T, type.w * T - 16, type.foot * T - 16);
      self.physics.add.existing(zone, true);
      self.solids.add(zone);
      self.homeZones.push(zone);
      if (type.use && type.use !== 'cat') {
        if (type.use === 'kitchen' && !s.builds.kitchen) return;
        self.objects.push({ type: type.use, name: type.key, x0: it.x, y0: it.y, x1: it.x + type.w - 1, y1: it.y + type.h - 1, props: {}, furn: true, item: i });
      }
    });
    this.zones.catarea = [{ type: 'catarea', px: T, py: 2 * T, pw: (size.w - 2) * T, ph: (size.h - 3) * T, x0: 1, y0: 2, x1: size.w - 2, y1: size.h - 2, props: {} }];
    // wake up beside the bed; the spouse waits by the other side of it
    var beds = s.home.items.filter(function (it) { return H.types[it.t].use === 'sleep'; });
    var bed = beds.filter(function (it) { return H.types[it.t].key === 'double_bed'; })[0] || beds[0];
    if (bed) {
      var bt = H.types[bed.t], cx = bed.x + Math.floor((bt.w - 1) / 2), below = bed.y + bt.h;
      var at = this.nearestFree(cx, below, null);
      if (at) this.points.bed = { x: (at.x + 0.5) * T, y: (at.y + 0.5) * T, props: { dir: 'up' }, type: 'spawn' };
      var other = this.nearestFree(bed.x + bt.w, below, at);
      if (other) this.points.spouse = { x: (other.x + 0.5) * T, y: (other.y + 0.5) * T, props: {}, type: 'place' };
    }
  };

  P.furnSprite = function (it) {
    var type = H.types[it.t], key = F.furnTexture(this, it.v);
    var img = this.add.image(it.x * T, (it.y + type.h) * T, key, it.t).setOrigin(0, 1).setDisplaySize(type.w * T, type.h * T).setFlipX(!!it.f);
    img.setDepth(type.place === 'flat' ? DEPTH.flat : type.place === 'wall' ? DEPTH.Walls + 0.1 : DEPTH.actor + (it.y + type.h) * T / 1e5);
    return img;
  };

  // The walkable floor tile nearest (x, y), other than `not`.
  P.nearestFree = function (x, y, not) {
    var best = null, bestD = Infinity, size = L.homeSize(this.state);
    for (var yy = 2; yy <= size.h - 2; yy++) for (var xx = 1; xx <= size.w - 2; xx++) {
      if (!this.walkable(xx, yy) || (not && not.x === xx && not.y === yy)) continue;
      var d = Math.abs(xx - x) + Math.abs(yy - y) * 1.01;
      if (d < bestD) { bestD = d; best = { x: xx, y: yy }; }
    }
    return best;
  };

  var objectAction = P.extraObjectAction;
  P.extraObjectAction = function (o) {
    if (o.type === 'catbed') {
      var cat = this.state.cat;
      return { label: 'Basket', icon: C.ICON.cat_basket, run: function () { F.ui.toast(cat ? cat.name + "'s favourite spot for a nap." : 'A cosy cat basket.'); } };
    }
    return objectAction.call(this, o);
  };

  // ---------- Decorate mode ----------
  var updateCamera = P.updateCamera;
  P.updateCamera = function (lerp) {
    if (!this.decor) updateCamera.call(this, lerp);
  };

  P.startDecor = function () {
    if (this.mapKey !== 'house' || this.decor) return;
    var self = this, cam = this.cameras.main;
    this.busy = true;
    F.input.reset();
    this.decor = { sel: null, drag: null, pan: null, zoom: cam.zoom };
    // zoom out until the whole room fits across the screen (not smaller than half size)
    cam.setZoom(Math.max(cam.zoom * 0.5, Math.min(cam.zoom, cam.width / (this.map.widthInPixels + T / 2))));
    cam.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2 + T);
    this.decorBox = this.add.graphics().setDepth(DEPTH.fx + 1);
    this.input.on('pointerdown', this.decorDown, this);
    this.input.on('pointermove', this.decorMove, this);
    this.input.on('pointerup', this.decorUp, this);
    this.decorChanged();
    sfx('pick');
    void self;
  };

  P.endDecor = function () {
    if (!this.decor) return;
    var cam = this.cameras.main;
    cam.setZoom(this.decor.zoom);
    this.input.off('pointerdown', this.decorDown, this);
    this.input.off('pointermove', this.decorMove, this);
    this.input.off('pointerup', this.decorUp, this);
    this.decorBox.destroy();
    this.decor = null;
    this.busy = false;
    this.unstick();
    this.updateCamera(1);
    this.changed();
    this.save();
    F.bus.emit('decor', null);
  };

  // The piece under a point (in world units): in front first, rugs and mats last.
  P.furnAt = function (wx, wy) {
    var items = this.state.home.items, best = -1, bestKey = -Infinity;
    items.forEach(function (it, i) {
      var type = H.types[it.t];
      if (wx < it.x * T || wx >= (it.x + type.w) * T || wy < it.y * T || wy >= (it.y + type.h) * T) return;
      var key = (type.place === 'flat' ? 0 : 1000) + it.y + type.h;
      if (key > bestKey) { bestKey = key; best = i; }
    });
    return best < 0 ? null : best;
  };

  P.decorSelect = function (i) {
    this.decor.sel = i;
    this.decorChanged();
  };

  // Redraws the outline around the chosen piece and tells the decorate bar.
  P.decorChanged = function (bad) {
    var d = this.decor, g = this.decorBox;
    g.clear();
    if (d.sel != null) {
      var it = this.state.home.items[d.sel], type = H.types[it.t];
      var x = (d.drag && d.drag.at ? d.drag.at.x : it.x) * T, y = (d.drag && d.drag.at ? d.drag.at.y : it.y) * T;
      g.lineStyle(16, bad ? 0xff5a4a : 0xffe27a, 1).strokeRoundedRect(x + 8, y + 8, type.w * T - 16, type.h * T - 16, 24);
      if (type.place === 'floor' && type.foot) {
        g.fillStyle(bad ? 0xff5a4a : 0xffffff, 0.22).fillRect(x, y + (type.h - type.foot) * T, type.w * T, type.foot * T);
      }
    }
    F.bus.emit('decor', { sel: d.sel });
  };

  P.decorDown = function (p, over) {
    var d = this.decor;
    if (!d || over.length || (F.ui && F.ui.blocking())) return;
    var i = this.furnAt(p.worldX, p.worldY);
    if (i != null) {
      var it = this.state.home.items[i];
      if (d.sel !== i) this.decorSelect(i);
      d.drag = { i: i, id: p.id, dx: Math.floor(p.worldX / T) - it.x, dy: Math.floor(p.worldY / T) - it.y, at: null };
    } else {
      d.pan = { id: p.id, x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, moved: false };
    }
  };

  P.decorMove = function (p) {
    var d = this.decor, cam = this.cameras.main;
    if (!d) return;
    if (d.drag && p.id === d.drag.id && p.isDown) {
      var it = this.state.home.items[d.drag.i], type = H.types[it.t];
      var x = Math.floor(p.worldX / T) - d.drag.dx, y = type.place === 'wall' ? 0 : Math.floor(p.worldY / T) - d.drag.dy;
      if (d.drag.at && d.drag.at.x === x && d.drag.at.y === y) return;
      if (!d.drag.at && x === it.x && y === it.y) return;
      d.drag.at = { x: x, y: y };
      var img = this.homeSprites[d.drag.i];
      img.setPosition(x * T, (y + type.h) * T).setAlpha(0.85);
      img.setDepth(DEPTH.fx);
      var why = L.cantPlace(this.state, it.t, x, y, d.drag.i);
      img.setTint(why ? 0xff8a80 : 0xffffff);
      this.decorChanged(!!why);
    } else if (d.pan && p.id === d.pan.id && p.isDown) {
      var dx = (p.x - d.pan.x) / cam.zoom, dy = (p.y - d.pan.y) / cam.zoom;
      if (Math.abs(p.x - d.pan.x) + Math.abs(p.y - d.pan.y) > 8) d.pan.moved = true;
      cam.setScroll(d.pan.sx - dx, d.pan.sy - dy);
    }
  };

  P.decorUp = function (p) {
    var d = this.decor;
    if (!d) return;
    if (d.drag && p.id === d.drag.id) {
      var drag = d.drag;
      d.drag = null;
      if (drag.at) {
        var r = L.moveFurn(this.state, drag.i, drag.at.x, drag.at.y);
        if (r === 'ok') sfx('stepWood');
        else { sfx('nope'); F.ui.toast(WHY[r] || "It can't go there."); }
        this.placeHome();
      }
      this.decorChanged();
    } else if (d.pan && p.id === d.pan.id) {
      if (!d.pan.moved && d.sel != null) this.decorSelect(null);
      d.pan = null;
    }
  };

  P.decorTurn = function () {
    var d = this.decor, it = d && this.state.home.items[d.sel];
    if (!it) return;
    L.moveFurn(this.state, d.sel, it.x, it.y, !it.f);
    sfx('stepWood');
    this.placeHome();
    this.decorChanged();
  };

  P.decorStore = function () {
    var d = this.decor;
    if (!d || d.sel == null) return;
    var r = L.storeFurn(this.state, d.sel);
    if (r !== 'ok') { sfx('nope'); return F.ui.toast(WHY[r] || "You can't put that away."); }
    sfx('pick');
    this.placeHome();
    this.decorSelect(null);
  };

  // Takes a piece out of storage and puts it as near the middle of the view as it fits.
  P.decorPlace = function (t, v) {
    var s = this.state, cam = this.cameras.main, mid = cam.midPoint;
    var spot = L.findSpot(s, t, Math.floor(mid.x / T), Math.floor(mid.y / T), null);
    if (!spot) { sfx('nope'); return F.ui.toast('There is no room for it. Put something away or upgrade your house.'); }
    var i = L.placeFurn(s, t, v, spot.x, spot.y, 0);
    if (typeof i !== 'number') { sfx('nope'); return F.ui.toast(WHY[i] || "It doesn't fit."); }
    sfx('stepWood');
    this.placeHome();
    this.decorSelect(i);
  };

  P.decorSurface = function (kind, v) {
    var r = L.setSurface(this.state, kind, v);
    if (r === 'gold') { sfx('nope'); return F.ui.toast('Not enough gold.'); }
    if (r === 'season') { sfx('nope'); return F.ui.toast('That one is only sold in its festival season.'); }
    sfx('stepWood');
    this.applySurfaces();
    this.changed();
    this.decorChanged();
  };

  // ---------- the UI: the Decorate button and bar, storage, wallpapers and floors, Mira's catalog ----------
  var K = F.UI_CONST, W = K.W, HGT = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, RED = 0xc0503a, BROWN = 0x9a6a3a;
  var world = function () { return F.world; };
  var U2 = F.UIScene.prototype;

  var create = U2.create;
  U2.create = function () {
    create.call(this);
    var self = this;
    this.decorBtn = null;
    this.decorBar = null;
    var showBtn = function (key) {
      if (self.decorBtn) { self.decorBtn.destroy(); self.decorBtn = null; }
      if (key !== 'house' && key !== 'farm') return; // the farm's yard: see 19f-yard.js
      self.decorBtn = self.add.container(0, 0).setDepth(40);
      self.button(self.decorBtn, W - 62, 438, 108, 34, 'Decorate', function () { self.openDecor(); }, BROWN);
    };
    F.bus.on('map', showBtn);
    F.bus.on('decor', function (info) { if (info) self.drawDecorBar(info); else self.closeDecorBar(); });
    this.events.once('shutdown', function () { F.bus.off('map', showBtn); });
    if (F.world) showBtn(F.world.mapKey);
  };

  // Back leaves Decorate mode (after closing any panel on top of it)
  var back = U2.back;
  U2.back = function () {
    if (!this.modals.length && world() && world().decor) { world().endDecor(); return true; }
    return back.call(this);
  };

  U2.openDecor = function () {
    if (!world() || this.blocking()) return;
    if (!this.tipDecor) {
      this.tipDecor = true;
      this.toast('Tap a piece to choose it, then drag it to move it. Drag the floor to look around.', 4200, 0x2f5a22);
    }
    world().startDecor();
  };

  U2.closeDecorBar = function () {
    if (this.decorBar) this.decorBar.destroy();
    this.decorBar = null;
    this.decorating = false;
    if (this.decorBtn) this.decorBtn.setVisible(true);
  };

  // Home Beauty and its tier, as one line.
  U2.beautyLine = function (s) {
    var b = L.homeBeauty(s), tier = L.homeTier(s), next = H.tiers[tier + 1];
    return 'Home Beauty ' + b + '  ' + H.tiers[tier][1] + (H.tiers[tier][2] ? ' (+' + H.tiers[tier][2] + ' max energy)' : '') +
      (next ? '\nNext: ' + next[1] + ' at ' + next[0] : '');
  };

  U2.drawDecorBar = function (info) {
    var self = this, s = F.session.state, w = world();
    if (this.decorBar) this.decorBar.destroy();
    this.decorating = true;
    if (this.decorBtn) this.decorBtn.setVisible(false);
    F.input.reset();
    var c = this.decorBar = this.add.container(0, 0).setDepth(90);
    var top = 440;
    c.add(this.add.rectangle(0, top, W, HGT - top, 0x000000, 0.001).setOrigin(0).setInteractive()); // keeps taps off the room
    this.panelImg(c, 6, top, W - 12, HGT - top - 6);
    c.add(this.txt(W / 2, top + 14, this.beautyLine(s), 13, INK, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0));
    var it = info.sel != null ? s.home.items[info.sel] : null, y1 = top + 68;
    if (it) {
      var type = H.types[it.t];
      c.add(this.txt(W / 2, y1 - 12, L.furnName(it.t, it.v) + '   +' + L.furnBeauty(it.t, it.v) + ' beauty', 13, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
      this.button(c, W / 2 - 84, y1 + 26, 100, 34, 'Turn', function () { w.decorTurn(); }, BLUE);
      this.button(c, W / 2 + 22, y1 + 26, 100, 34, 'Put away', function () { w.decorStore(); }, GREY);
      this.button(c, W / 2 + 116, y1 + 26, 60, 34, 'OK', function () { w.decorSelect(null); }, GREEN);
    } else {
      c.add(this.txt(W / 2, y1 - 8, 'Tap a piece of furniture to move it.\nBuy more at Mira\'s Woodshop in town.', 12, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0));
    }
    var n = Object.keys(s.home.bag).reduce(function (sum, k) { return sum + s.home.bag[k]; }, 0);
    var y2 = HGT - 42;
    this.button(c, 50, y2, 84, 38, 'Storage' + (n ? ' ' + n : ''), function () { self.openStorage(0); }, BROWN);
    this.button(c, 138, y2, 84, 38, 'Walls', function () { self.openSurfaces('wall', 0); }, BROWN);
    this.button(c, 226, y2, 84, 38, 'Floor', function () { self.openSurfaces('floor', 0); }, BROWN);
    this.button(c, 312, y2, 76, 38, 'Done', function () { w.endDecor(); sfx('pick'); }, GREEN);
  };

  // pictures in list rows: a furniture piece, or a wallpaper or floor tile
  U2.furnImg = function (t, v) {
    var type = H.types[t];
    return { key: F.furnTexture(this, v), frame: t, w: type.w * U, h: type.h * U };
  };

  U2.openStorage = function (page) {
    var self = this, s = F.session.state;
    var rows = Object.keys(s.home.bag).sort().map(function (k) {
      var t = Number(k.split('.')[0]), v = Number(k.split('.')[1]);
      return {
        img: self.furnImg(t, v), name: L.furnName(t, v), desc: 'You have ' + s.home.bag[k] + '. +' + L.furnBeauty(t, v) + ' beauty.',
        buttons: [{ label: 'Place', cb: function () { self.closeModal(); world().decorPlace(t, v); } }],
      };
    });
    this.listPanel({
      title: 'Storage', rows: rows, page: page, reopen: function (tab, p) { self.openStorage(p); },
      sub: function () { return 'Furniture you own that is not in the room.'; },
      empty: 'Nothing in storage.\nBuy furniture at Mira\'s Woodshop, or put a piece away to keep it here.',
    });
  };

  U2.openSurfaces = function (kind, page) {
    var self = this, s = F.session.state, owned = s.home[kind === 'wall' ? 'walls' : 'floors'];
    var rows = H.styles.map(function (st, v) { return v; }).filter(function (v) { return (owned & (1 << v)) || L.styleOnSale(s, v); }).map(function (v) {
      var st = H.styles[v], has = owned & (1 << v), using = s.home[kind] === v;
      var fr = F.surfaceFrame(self, kind, v);
      return {
        img: fr && { key: fr.key, frame: fr.frame, w: 256, h: 256 }, name: st.name + (kind === 'wall' ? ' Wallpaper' : ' Floor'),
        desc: (using ? 'In your room now. ' : has ? 'You own it. ' : L.wallPrice(v) + 'G. ') + (v ? '+' + Math.round(H.wallBeauty * st.beauty) + ' beauty.' : '') + (st.festival ? ' Festival edition!' : ''),
        buttons: using ? [] : [{
          label: has ? 'Use' : 'Buy ' + L.wallPrice(v) + 'G', color: has ? GREEN : BLUE, cb: function () {
            world().decorSurface(kind, v);
            self.closeModal();
            self.openSurfaces(kind, page);
          },
        }],
      };
    });
    this.listPanel({
      title: kind === 'wall' ? 'Wallpaper' : 'Floor', rows: rows, page: page, reopen: function (tab, p) { self.openSurfaces(kind, p); },
      sub: function () { return s.gold + 'G   Festival editions are sold in their season.'; },
    });
  };

  // ---------- Mira's Woodshop: the house upgrade and the furniture catalog ----------
  var openWoodshop = U2.openWoodshop;
  U2.openWoodshop = function (tab, page) {
    tab = tab || 'build';
    if (tab === 'furniture') return this.openCatalog(null, page);
    openWoodshop.call(this, tab, page);
  };

  // The row for the next house level (shown first on the Build tab).
  U2.houseRow = function () {
    var self = this, s = F.session.state, next = L.nextHome(s), cur = L.homeLevel(s);
    var building = s.project && s.project.id === 'house';
    if (!next) return { icon: C.ICON.crate, name: cur.name + ' (Lv ' + s.home.level + ')', desc: 'Your house is as grand as it gets!', buttons: [] };
    var lv = s.home.level + 1, size = next.map[0] - 2 + ' x ' + (next.map[1] - 3);
    var cost = next.gold + 'G, ' + next.lumber + ' lumber' + (next.stone ? ', ' + next.stone + ' stone' : '');
    return {
      icon: C.ICON.crate, name: next.name + ' (Lv ' + lv + ')',
      desc: building ? 'Mira is building it. Ready in ' + Math.max(1, s.project.done - s.day) + ' day(s).' :
        'House upgrade: ' + cost + '. A ' + size + ' room, ' + next.days + (next.days > 1 ? ' days' : ' day') + '.' + (lv === H.marryLevel ? ' Room for two: needed to marry.' : ''),
      buttons: building ? [] : [{
        label: 'Build', cb: function () {
          var r = L.startHomeUpgrade(s);
          var why = { busy: 'Mira is busy with another job. One at a time!', gold: 'Not enough gold.', lumber: 'You need ' + next.lumber + ' lumber. Chop branches and stumps, or buy some.', stone: 'You need ' + next.stone + ' stone.' };
          if (r !== 'ok') { sfx('nope'); return self.toast(why[r] || 'Hmm.'); }
          sfx('hammer');
          world().changed();
          world().save();
          self.closeModal();
          self.openWoodshop('build');
          self.say('mira', 'Mira', 'A ' + next.name + '! I love it. Give me ' + next.days + (next.days > 1 ? ' days' : ' day') + ' and it will be ready. Your furniture stays right where it is.');
        },
      }],
    };
  };

  // the old House Extension is the Farmhouse level now
  var listPanel = U2.listPanel;
  U2.listPanel = function (o) {
    if (o.title === "Mira's Woodshop" && o.tab === 'build' && !o.homeDone) {
      o.homeDone = true;
      o.rows = [this.houseRow()].concat(o.rows.filter(function (r) { return r.name !== C.BUILDS.bighouse.name; }));
    }
    return listPanel.call(this, o);
  };

  var TABS = [['build', 'Build'], ['furniture', 'Furniture'], ['materials', 'Materials']];

  // style null: the styles on sale; else that style's 27 pieces.
  U2.openCatalog = function (v, page) {
    var self = this, s = F.session.state, rows;
    if (v == null) {
      rows = H.styles.map(function (st, k) { return k; }).filter(function (k) { return L.styleOnSale(s, k); }).map(function (k) {
        var st = H.styles[k];
        return {
          img: self.furnImg(H.typeIndex.armchair, k), name: st.name + (st.festival ? ' (festival)' : ''),
          desc: st.look.charAt(0).toUpperCase() + st.look.slice(1) + '.',
          buttons: [{ label: 'See all', color: BLUE, cb: function () { self.closeModal(); self.openCatalog(k, 0); } }],
        };
      });
    } else {
      rows = H.types.map(function (type, t) {
        var price = L.furnPrice(t, v), have = (s.home.bag[L.furnKey(t, v)] || 0) + s.home.items.filter(function (it) { return it.t === t && it.v === v; }).length;
        var locked = type.needs && !s.builds[type.needs];
        return {
          img: self.furnImg(t, v), name: L.furnName(t, v),
          desc: price + 'G. +' + L.furnBeauty(t, v) + ' beauty.' + (have ? ' You have ' + have + '.' : '') + (locked ? ' Needs the Kitchen.' : ''),
          buttons: locked ? [] : [{
            label: 'Buy ' + price + 'G', cb: function () {
              var r = L.buyFurn(s, t, v);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              if (r !== 'ok') { sfx('nope'); return self.toast("Mira can't sell that right now."); }
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openCatalog(v, page);
              self.toast(type.use === 'cat' && s.cat && !self.catSaid ? 'A cat named ' + s.cat.name + ' moved into your house!' : 'Mira will drop it in your storage. Place it with Decorate at home.');
              if (type.use === 'cat') self.catSaid = true;
            },
          }],
        };
      });
    }
    var o = this.listPanel({
      title: v == null ? "Mira's Woodshop" : H.styles[v].name + ' Furniture', tab: 'furniture', page: page, rows: rows, talk: v == null ? 'mira' : null,
      tabs: v == null ? TABS : null,
      reopen: function (tab, p) { if (v != null && tab === 'furniture') self.openCatalog(v, p); else self.openWoodshop(tab, p); },
      sub: function () { return s.gold + 'G   ' + (v == null ? 'Pick a style. Festival editions come with their season.' : 'Bought pieces go to your storage.'); },
    });
    if (v != null) this.button(o.container || this.modals[this.modals.length - 1].c, 50, 96, 56, 34, 'Back', function () { self.closeModal(); self.openCatalog(null, 0); }, GREY);
    return o;
  };

  // list rows can show a picture (furniture, a wallpaper) instead of an item icon
  var listRow = U2.listRow;
  U2.listRow = function (c, y, row) {
    var img = row.img;
    if (img) row = Object.assign({}, row, { icon: null });
    listRow.call(this, c, y, row);
    if (!img) return;
    var box = 38, scale = Math.min(box / img.w, box / img.h);
    c.add(this.add.image(34 + 2 + K.SLOT / 2, y + 13 + 2 + K.SLOT / 2, img.key, img.frame).setScale(scale));
  };
})(window.Farm = window.Farm || {});
