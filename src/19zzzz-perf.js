// Keeping a long session light (performance review, 4 Nov 2026; low-end bar: an OPPO A5-class phone, 3-4 GB):
//   - GPU memory: the sheets that belong to one place (the Wild Lands' animals, Kanor, Tita Luz, another map's props)
//     are let go when you are somewhere that does not use them, and a furniture style's sheet once Mira's panels close.
//     They come back from their kept Blob while the screen is dark on the way in (F.prewarm, 10-boot.js), so going back
//     shows nothing missing. The farm's own pictures always stay, and so does anything still on screen. The villagers'
//     sheet (people) stays too: the town, the house and many panels use it, and a panel can only make it on the spot.
//   - drawing: a still picture on the map more than 2 tiles outside the view is skipped by the camera (most of a big
//     farm's crops, yard pieces and shadows are off screen). Checked every 150 ms; anything that moved is drawn.
// Loaded after every other 19zz- file, so its create runs last, when the map has made what it needs.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;

  // ---------- GPU memory ----------
  var FREE = /^(tita_luz|kanor|wild|wildshade|wildgrass|archer|archer_girl|furn_\d+|props\/.+)$/;
  var usedIn = function (scene, key) {
    if (!scene || !scene.children) return false;
    var hit = false, walk = function (list) {
      for (var i = 0; i < list.length && !hit; i++) {
        var o = list[i];
        if (o.texture && o.texture.key === key) hit = true;
        else if (o.list && o.list.length) walk(o.list);
      }
    };
    walk(scene.children.list);
    return hit;
  };
  // Lets go of a sheet nothing shows (and the walk cycles cut from it: they are made again with it).
  F.freeTexture = function (key) {
    var game = F.game, tex = game && game.textures;
    if (!tex || !tex.exists(key) || usedIn(F.world, key) || usedIn(F.ui, key)) return false;
    var gone = [];
    game.anims.anims.each(function (k, a) { if (a.frames.some(function (f) { return f.textureKey === key; })) gone.push(k); });
    gone.forEach(function (k) { game.anims.remove(k); });
    tex.remove(key);
    return true;
  };
  // What the place you are in (and the farm, home) does not use.
  F.freeOthers = function (w, only) {
    if (!w || !w.sys || !w.sys.isActive() || w.busy || !F.mapKeys) return [];
    var keep = Object.assign({}, F.mapKeys('farm'), F.mapKeys(w.mapKey)), placed = {}, out = [];
    // (only what a map put up: a picture only a panel shows, like the Outdoor shop's, stays for its next open)
    Object.keys(F.mapNeeds).forEach(function (m) { Object.assign(placed, F.mapNeeds[m]); });
    Object.keys(w.textures.list).forEach(function (k) {
      if (!FREE.test(k) || keep[k] || (only && !only.test(k)) || !(placed[k] || /^furn_\d+$/.test(k))) return;
      if (F.freeTexture(k)) out.push(k);
    });
    return out;
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    // (once the map is in, its fade-in done; while a panel is open, a little later)
    var self = this, tries = 0, later = function () {
      if (F.ui && F.ui.modals.length) { if (++tries < 15) self.time.delayedCall(2000, later); return; }
      F.freeOthers(self);
    };
    this.time.delayedCall(1200, later);
    this.cullSetup();
  };
  // A furniture style's sheet opened in Mira's Catalog goes again a little after the last panel closes.
  var closeModal = U.closeModal;
  U.closeModal = function () {
    closeModal.apply(this, arguments);
    if (this.modals.length) return;
    var self = this;
    if (this.freeLater) this.freeLater.remove(false);
    this.freeLater = this.time.delayedCall(2500, function () { self.freeLater = null; if (!self.modals.length) F.freeOthers(F.world, /^furn_\d+$/); });
  };

  // ---------- off-screen pictures ----------
  // The view is worked out from the camera's scroll after this frame's update (what is about to be drawn), padded by
  // 2 tiles and by twice the way the camera went since the last check (a pan or a gallop is met early). A jump of more
  // than half a tile in one frame (a teleport, a fast pan) checks again at once.
  var EVERY = 150, PAD = 2 * T, JUMP = T / 2;
  P.cullSetup = function () {
    var self = this, cam = this.cameras.main, since = 0, lx = cam.scrollX, ly = cam.scrollY, cx = lx, cy = ly;
    var tick = function (time, dt) {
      var jump = Math.abs(cam.scrollX - lx) > JUMP || Math.abs(cam.scrollY - ly) > JUMP;
      lx = cam.scrollX;
      ly = cam.scrollY;
      if ((since += dt) < EVERY && !jump) return;
      since = 0;
      var go = Math.max(Math.abs(cam.scrollX - cx), Math.abs(cam.scrollY - cy));
      cx = cam.scrollX;
      cy = cam.scrollY;
      self.cull(PAD + 2 * go);
    };
    this.events.on('postupdate', tick);
    this.events.once('shutdown', function () { self.events.off('postupdate', tick); });
  };
  P.cull = function (pad) {
    var cam = this.cameras.main, id = cam.id, list = this.children.list;
    var vw = cam.width / cam.zoom, vh = cam.height / cam.zoom; // (as Camera.preRender works out its worldView)
    var x0 = cam.scrollX + (cam.width - vw) / 2 - pad, y0 = cam.scrollY + (cam.height - vh) / 2 - pad, x1 = x0 + vw + 2 * pad, y1 = y0 + vh + 2 * pad;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.type !== 'Image' && o.type !== 'Sprite') continue;
      var moved = o.cullX !== o.x || o.cullY !== o.y;
      o.cullX = o.x;
      o.cullY = o.y;
      var out = false;
      if (!moved && o.scrollFactorX === 1 && o.scrollFactorY === 1 && o.frame) {
        var w = Math.abs(o.scaleX * o.frame.realWidth), h = Math.abs(o.scaleY * o.frame.realHeight);
        if (o.rotation) { var r = Math.max(w, h); out = o.x + r < x0 || o.x - r > x1 || o.y + r < y0 || o.y - r > y1; }
        else {
          var left = o.x - o.originX * w, top = o.y - o.originY * h;
          out = left + w < x0 || left > x1 || top + h < y0 || top > y1;
        }
      }
      if (out) o.cameraFilter |= id;
      else if (o.cameraFilter & id) o.cameraFilter &= ~id;
    }
  };
})(window.Farm = window.Farm || {});
