// The owner's pictures on the maps of Taal Lake, the Sierra Madre and Palawan (owner, 6 Nov 2026; which is which:
// 00-zzzzzzzzzz-place-16-art.js). Their maps were made with other places' props and Pulag's ground as stand-ins; once
// a place's pictures are in (its pack: tools/places/places-art.js), each stand-in prop shows the place's own (the same
// tile it stands on, the same solid foot, its own shape), and the map's grass and water are painted with its own ground.
// Without the pictures nothing changes.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var real = function (key) { return !!(F.images && F.images[key]); };

  // ---------- the props ----------
  var addProp = P.addProp;
  P.addProp = function (name, o, tp) {
    var r = addProp.apply(this, arguments);
    var swap = C.PLACE_PROP_SWAP[this.mapKey], kind = swap && swap[name];
    if (Array.isArray(kind)) kind = kind[(Math.round(o.x / T) + Math.round(o.y / T)) % kind.length];
    var key = kind && 'props/' + this.mapKey + '_' + kind, img = this.props[this.props.length - 1];
    if (!key || !real(key) || !img || img.texture.key !== 'props/' + name) return r;
    F.ensureTexture(this, key);
    img.setTexture(key).setOrigin(0.5, 1).setPosition(o.x + o.width / 2, o.y);
    img.setDisplaySize(o.width, o.width * img.height / img.width);
    return r;
  };

  // ---------- the ground: the owner's two textures in this map's own copy of the tiles sheet (as Chocolate Hills) ----------
  var groundSheet = function (w, id, gids) {
    var key = 'tiles-' + id, tex = w.textures;
    if (tex.exists(key)) return key;
    var ts = w.map.getTileset('tiles'), img = (F.bitmaps && F.bitmaps.tiles) || F.images.tiles;
    var full = tex.get('tiles').source[0].width, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = iw / full;
    var c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.imageSmoothingQuality = 'high';
    [[gids.grass, 'ground_' + id], [gids.water, 'ground_' + id + '_water']].forEach(function (p) {
      if (p[0] == null || !real(p[1])) return;
      var q = ts.getTileTextureCoordinates(p[0]), pad = Math.round(8 * k), s = Math.round(ts.tileWidth * k);
      var x = Math.round(q.x * k), y = Math.round(q.y * k);
      g.clearRect(x - pad, y - pad, s + pad * 2, s + pad * 2);
      g.drawImage(F.images[p[1]], x - pad, y - pad, s + pad * 2, s + pad * 2);
    });
    var t = tex.create(key, c, full, Math.round(ih / k)), gt = t.source[0].glTexture;
    if (gt) { gt.width = full; gt.height = Math.round(ih / k); }
    Phaser.Textures.Parsers.Image(t, 0);
    return key;
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    var id = this.mapKey;
    if (C.PLACE_GROUND.indexOf(id) < 0 || !(real('ground_' + id) || real('ground_' + id + '_water')) || !this.map || !this.map.getTileset('tiles')) return;
    // this map's grass (its most common ground tile) and its water (the ground tile that is water)
    var n = {}, water = null;
    this.layers.Ground.forEachTile(function (t) { if (t.index < 0) return; n[t.index] = (n[t.index] || 0) + 1; if (t.properties && t.properties.water) water = t.index; });
    var grass = Number(Object.keys(n).sort(function (p, q) { return n[q] - n[p]; })[0]);
    this.map.getTileset('tiles').setImage(this.textures.get(groundSheet(this, id, { grass: grass, water: water })));
  };
})(window.Farm = window.Farm || {});
