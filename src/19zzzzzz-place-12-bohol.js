// Chocolate Hills in the world (place 12, owner, 6 Nov 2026; data 00-zzzzzzzzzz-place-12-bohol.js). The map's six kinds of
// prop and the Hill Hollows' round door, drawn here until the owner's pictures are in; then theirs (names below).
//  - props (maps/bohol.json objects of type 'bohol', name = kind): the owner's props_bohol.png, cut into
//    assets/props/bohol_<kind>.png (hill, hut, palm, fence, cogon, rock), else a drawn stand-in. Solid at their foot.
//  - the ground: the Wild Lands grass and the water tile; with ground_bohol / ground_bohol_water (assets/ground_bohol.*,
//    assets/ground_bohol_water.*) painted into this map's own copy of the tiles sheet. Without them, the river is tinted green.
//  - the cave mouth: props/bohol_mouth (the owner's), else a dome hill with a round wooden door and a little offering in
//    front ("tabi tabi po": owner, 6 Nov 2026). In you go with a polite word, once a visit.
(function (F) {
  'use strict';
  var C = F.Config;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var MAP = 'bohol', CAVE = 'bohol_cave';
  var real = function (key) { return !!(F.images && F.images[key]); };
  // each kind: solid rows at its foot, and how wide it is drawn for its rect (a palm's leaves reach out past its trunk)
  var KINDS = {
    hill: { foot: 2, wide: 1.08, tall: 0.8 }, hut: { foot: 2, wide: 1.1, tall: 1.05 }, palm: { foot: 1, wide: 2.2, tall: 1.9 },
    fence: { foot: 1, wide: 1, tall: 0.75 }, cogon: { foot: 0, wide: 1.3, tall: 1.25 }, rock: { foot: 1, wide: 1.05, tall: 0.85 },
  };

  // ---------- drawn stand-ins ----------
  var LINE = '#3a2614';
  var canvasTex = function (w, key, W, H, draw) {
    if (w.textures.exists(key)) return key;
    var c = w.textures.createCanvas(key, W, H), g = c.getContext();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = LINE;
    draw(g, W, H);
    c.refresh();
    return key;
  };
  var grad = function (g, y0, y1, stops) { var r = g.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s) { r.addColorStop(s[0], s[1]); }); return r; };
  // a dome hill: golden-brown on top, green at the bottom (the Chocolate Hills in the dry months)
  var drawHill = function (g, W, H) {
    var base = H - 8;
    g.beginPath();
    g.moveTo(10, base);
    g.bezierCurveTo(14, base - H * 0.72, W - 14, base - H * 0.72, W - 10, base);
    g.closePath();
    g.fillStyle = grad(g, base - H * 0.62, base, [[0, '#a86a30'], [0.3, '#c8904a'], [0.5, '#d8b060'], [0.7, '#8ab04a'], [1, '#5e8a34']]);
    g.fill();
    g.lineWidth = 7;
    g.stroke();
    g.fillStyle = 'rgba(255,240,190,0.28)'; // the sun from the top left
    g.beginPath();
    g.ellipse(W * 0.38, base - H * 0.44, W * 0.18, H * 0.08, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(70,50,20,0.35)'; // tufts of grass
    g.lineWidth = 3;
    for (var i = 0; i < 14; i++) {
      var x = W * (0.18 + (i * 0.37) % 0.64), y = base - H * (0.08 + (i * 0.23) % 0.4);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 10); g.moveTo(x, y); g.lineTo(x + 4, y - 9); g.stroke();
    }
  };
  // a nipa hut on stilts: palm-leaf roof, bamboo walls, a little ladder
  var drawHut = function (g, W, H) {
    var base = H - 6, floor = base - H * 0.2, top = H * 0.08;
    g.lineWidth = 6;
    g.fillStyle = '#7a5a34';
    [0.2, 0.5, 0.8].forEach(function (k) { g.fillRect(W * k - 7, floor, 14, base - floor); g.strokeRect(W * k - 7, floor, 14, base - floor); });
    g.fillStyle = grad(g, floor - H * 0.36, floor, [[0, '#e0c486'], [1, '#c8a464']]);
    g.fillRect(W * 0.14, floor - H * 0.36, W * 0.72, H * 0.36);
    g.strokeRect(W * 0.14, floor - H * 0.36, W * 0.72, H * 0.36);
    g.strokeStyle = 'rgba(90,60,20,0.45)';
    g.lineWidth = 3;
    for (var x = W * 0.18; x < W * 0.86; x += 14) { g.beginPath(); g.moveTo(x, floor - H * 0.36); g.lineTo(x, floor); g.stroke(); }
    g.strokeStyle = LINE;
    g.lineWidth = 6;
    g.fillStyle = '#5a3a1c';
    g.fillRect(W * 0.44, floor - H * 0.24, W * 0.14, H * 0.24); // the door
    g.strokeRect(W * 0.44, floor - H * 0.24, W * 0.14, H * 0.24);
    g.beginPath(); // the roof
    g.moveTo(W * 0.04, floor - H * 0.3);
    g.lineTo(W * 0.5, top);
    g.lineTo(W * 0.96, floor - H * 0.3);
    g.closePath();
    g.fillStyle = grad(g, top, floor - H * 0.3, [[0, '#a88a4a'], [1, '#7a6230']]);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(60,40,10,0.5)';
    g.lineWidth = 3;
    for (var r = 1; r < 5; r++) { var y = top + (floor - H * 0.3 - top) * r / 5, half = W * 0.46 * r / 5; g.beginPath(); g.moveTo(W * 0.5 - half, y); g.lineTo(W * 0.5 + half, y); g.stroke(); }
  };
  // a coconut palm: a gently curved trunk, fronds and three coconuts
  var drawPalm = function (g, W, H) {
    var base = H - 6, cx = W * 0.5, top = H * 0.24;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - 12, base);
    g.quadraticCurveTo(cx + 24, H * 0.6, cx - 2, top);
    g.lineTo(cx + 12, top);
    g.quadraticCurveTo(cx + 40, H * 0.6, cx + 12, base);
    g.closePath();
    g.fillStyle = '#9a7448';
    g.fill();
    g.stroke();
    [[-1, -0.1], [-0.8, 0.35], [1, -0.1], [0.8, 0.35], [-0.2, -0.6], [0.3, -0.55]].forEach(function (f) {
      var ex = cx + 5 + f[0] * W * 0.46, ey = top + f[1] * H * 0.2 + H * 0.06;
      g.beginPath();
      g.moveTo(cx + 5, top);
      g.quadraticCurveTo((cx + ex) / 2, top - H * 0.09 + f[1] * 10, ex, ey);
      g.quadraticCurveTo((cx + ex) / 2, top - H * 0.02, cx + 5, top + 8);
      g.fillStyle = f[1] < 0 ? '#5aa03a' : '#4a8a30';
      g.fill();
      g.lineWidth = 4;
      g.stroke();
    });
    g.fillStyle = '#6a4a22';
    [[-10, 10], [8, 14], [-1, 20]].forEach(function (c) { g.beginPath(); g.arc(cx + 5 + c[0], top + c[1], 9, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.stroke(); });
  };
  // a short run of woven bamboo fence
  var drawFence = function (g, W, H) {
    var base = H - 6, top = H * 0.22;
    g.lineWidth = 5;
    g.fillStyle = '#c8b06a';
    [0.32, 0.62].forEach(function (k) { var y = top + (base - top) * k; g.fillRect(6, y - 7, W - 12, 14); g.strokeRect(6, y - 7, W - 12, 14); });
    for (var x = 14; x < W - 6; x += (W - 28) / 5) {
      g.fillStyle = '#d8c27a';
      g.fillRect(x - 7, top, 14, base - top);
      g.strokeRect(x - 7, top, 14, base - top);
      g.strokeStyle = 'rgba(80,60,20,0.5)';
      g.beginPath(); g.moveTo(x - 7, top + (base - top) * 0.47); g.lineTo(x + 7, top + (base - top) * 0.47); g.stroke();
      g.strokeStyle = LINE;
    }
  };
  // a thick clump of cogon grass, where animals hide
  var drawCogon = function (g, W, H) {
    var base = H - 4;
    for (var i = 0; i < 26; i++) {
      var x = W * (0.12 + (i * 0.61) % 0.76), lean = ((i * 7) % 11 - 5) * W * 0.035, h = H * (0.55 + (i * 0.29) % 0.4);
      g.beginPath();
      g.moveTo(x - 5, base);
      g.quadraticCurveTo(x + lean * 0.4, base - h * 0.5, x + lean, base - h);
      g.quadraticCurveTo(x + lean * 0.4 + 3, base - h * 0.5, x + 5, base);
      g.closePath();
      g.fillStyle = i % 3 ? '#b4c85a' : '#dcc470';
      g.fill();
      g.strokeStyle = 'rgba(58,38,20,0.5)';
      g.lineWidth = 1.5;
      g.stroke();
    }
  };
  // a mossy white limestone rock with ferns
  var drawRock = function (g, W, H) {
    var base = H - 6;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(W * 0.08, base);
    [[0.06, 0.55], [0.2, 0.28], [0.42, 0.14], [0.66, 0.2], [0.86, 0.36], [0.94, 0.7]].forEach(function (p) { g.lineTo(W * p[0], H * p[1]); });
    g.lineTo(W * 0.92, base);
    g.closePath();
    g.fillStyle = grad(g, H * 0.14, base, [[0, '#f4ecd8'], [0.6, '#d8ccb0'], [1, '#a89c80']]);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(110,150,70,0.7)'; // moss
    g.beginPath(); g.ellipse(W * 0.4, H * 0.22, W * 0.16, H * 0.06, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,100,70,0.5)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.5, H * 0.3); g.lineTo(W * 0.56, H * 0.55); g.lineTo(W * 0.5, H * 0.8); g.stroke();
    g.fillStyle = '#4a8a30';
    g.strokeStyle = LINE;
    [[0.14, -0.6], [0.2, -0.2], [0.86, 0.4]].forEach(function (f) {
      var x = W * f[0], y = base;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + f[1] * 30, y - 34, x + f[1] * 46, y - 50); g.quadraticCurveTo(x + f[1] * 10, y - 30, x + 8, y); g.closePath(); g.fill(); g.lineWidth = 3; g.stroke();
    });
  };
  var DRAW = { hill: [drawHill, 512, 300], hut: [drawHut, 384, 400], palm: [drawPalm, 320, 400], fence: [drawFence, 384, 140], cogon: [drawCogon, 180, 180], rock: [drawRock, 256, 190] };
  var propTexture = function (w, kind) {
    var art = 'props/bohol_' + kind;
    if (real(art)) return F.ensureTexture(w, art);
    var d = DRAW[kind];
    return canvasTex(w, 'fx-bohol-' + kind, d[1], d[2], d[0]);
  };

  // the round door into a hill, roots and ferns round it, a stone plate of flowers and fruit before it, light under it
  var doorTexture = function (w) {
    return canvasTex(w, 'fx-bohol-door', 384, 364, function (g, W, H) {
      drawHill(g, W, H - 30);
      var cx = W / 2, base = H - 52, r = 64;
      g.lineWidth = 8;
      g.beginPath(); // the door: round, wooden planks, an iron ring
      g.moveTo(cx - r, base);
      g.arc(cx, base - 10, r, Math.PI, 0);
      g.lineTo(cx + r, base);
      g.closePath();
      g.fillStyle = grad(g, base - 80, base, [[0, '#8a5a2c'], [1, '#6a4220']]);
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(40,20,8,0.55)';
      g.lineWidth = 4;
      [-32, 0, 32].forEach(function (dx) { g.beginPath(); g.moveTo(cx + dx, base - 10 - Math.sqrt(r * r - dx * dx) + 4); g.lineTo(cx + dx, base); g.stroke(); });
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 5;
      g.beginPath(); g.arc(cx + 34, base - 30, 9, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,214,120,0.85)'; // the warm light from under the door
      g.fillRect(cx - r + 10, base - 6, (r - 10) * 2, 6);
      g.strokeStyle = '#4a6a2a'; // roots and ferns
      g.lineWidth = 5;
      [[-1, 0.2], [1, 0.4], [-1, 0.75], [1, 0.85]].forEach(function (f) {
        var a = Math.PI * f[1], x = cx + f[0] * Math.cos(a / 2) * (r + 8), y = base - 10 - Math.sin(Math.PI - a) * (r + 6);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + f[0] * 22, y - 10, x + f[0] * 34, y + 12); g.stroke();
      });
      // the offering: a flat stone plate with flowers and a banana, left politely before the door
      var py = H - 22;
      g.strokeStyle = LINE;
      g.lineWidth = 5;
      g.fillStyle = '#c8c0b0';
      g.beginPath(); g.ellipse(cx - 92, py, 34, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#f2d24a';
      g.beginPath(); g.ellipse(cx - 98, py - 8, 18, 6, -0.3, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.stroke();
      ['#ffffff', '#f080a0', '#ffffff'].forEach(function (c, i) {
        g.fillStyle = c;
        g.beginPath(); g.arc(cx - 80 + i * 8, py - 12 - (i % 2) * 5, 6, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.stroke();
      });
    });
  };

  // ---------- the map's props: drawn, solid at their foot, taken out of the objects the farmer can use ----------
  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (this.mapKey !== MAP) return;
    var self = this;
    this.objects = this.objects.filter(function (o) {
      if (o.type !== 'bohol') return true;
      var k = KINDS[o.name];
      if (!k) return false;
      var x = (o.x0 + o.x1 + 1) / 2 * T, foot = (o.y1 + 1) * T, w = (o.x1 - o.x0 + 1) * T * k.wide;
      var img = self.add.image(x, foot, propTexture(self, o.name)).setOrigin(0.5, 1);
      img.setDisplaySize(w, real('props/bohol_' + o.name) ? w * img.height / img.width : (o.y1 - o.y0 + 1) * T * k.tall + (o.name === 'hill' ? 0.25 * T : 0));
      F.depthTo(img, DEPTH.actor + foot / 1e5);
      self.props.push(img);
      if (k.foot) {
        for (var y = o.y1 - k.foot + 1; y <= o.y1; y++) for (var tx = o.x0; tx <= o.x1; tx++) self.blocked[self.idx(tx, y)] = true;
        var zone = self.add.zone(x, foot - k.foot * T / 2 + 8, (o.x1 - o.x0 + 1) * T - 16, k.foot * T - 16);
        self.physics.add.existing(zone, true);
        self.solids.add(zone);
      }
      return false;
    });
  };

  // ---------- the ground: the owner's two textures in this map's own copy of the tiles sheet ----------
  var groundSheet = function (w, gids) {
    var key = 'tiles-bohol', tex = w.textures;
    if (tex.exists(key)) return key;
    var ts = w.map.getTileset('tiles'), img = (F.bitmaps && F.bitmaps.tiles) || F.images.tiles;
    var full = tex.get('tiles').source[0].width, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = iw / full;
    var c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.imageSmoothingQuality = 'high';
    [[gids.grass, 'ground_bohol'], [gids.water, 'ground_bohol_water']].forEach(function (p) {
      var gid = p[0];
      if (gid == null || !real(p[1])) return;
      var q = ts.getTileTextureCoordinates(gid), pad = Math.round(8 * k), s = Math.round(ts.tileWidth * k);
      var x = Math.round(q.x * k), y = Math.round(q.y * k), src = F.images[p[1]];
      g.clearRect(x - pad, y - pad, s + pad * 2, s + pad * 2);
      g.drawImage(src, x - pad, y - pad, s + pad * 2, s + pad * 2);
    });
    var t = tex.create(key, c, full, Math.round(ih / k)), gt = t.source[0].glTexture;
    if (gt) { gt.width = full; gt.height = Math.round(ih / k); }
    Phaser.Textures.Parsers.Image(t, 0);
    return key;
  };

  // ---------- setting up the map and the cave ----------
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this;
    if (this.mapKey === MAP) {
      var gids = this.boholGids();
      if (real('ground_bohol') || real('ground_bohol_water')) this.map.getTileset('tiles').setImage(this.textures.get(groundSheet(this, gids)));
      else this.layers.Ground.forEachTile(function (t) { if (t.index === gids.water) t.tint = 0x8ad49a; }); // (a calm green river)
      // the cave mouth: a hill with a round door (the engine draws a rocky mouth until the owner's picture is in)
      if (!real('props/bohol_mouth')) {
        this.children.list.forEach(function (o) {
          if (o.texture && o.texture.key === 'fx-lairmouth') o.setTexture(doorTexture(self)).clearTint().setDisplaySize(3.7 * T, 3.5 * T);
        });
      }
    }
    // in through the round door: a polite word to the Nuno, once a visit
    if (this.mapKey === CAVE && this.lair && this.lair.floor === 1 && F.session.boholTabi !== F.session.state.day) {
      F.session.boholTabi = F.session.state.day;
      if (!(window.gameHost && window.gameHost.quiet)) this.time.delayedCall(2600, function () { if (F.ui && self.sys && self.sys.isActive()) F.ui.toast('"Tabi tabi po." You ask the Nuno\'s leave, and step softly into the Hill Hollows.', 3200, 0x5a4a22); });
    }
  };
  // this map's grass (its most common ground tile) and its water (the ground tile that is water): their gids
  P.boholGids = function () {
    var n = {}, water = null;
    this.layers.Ground.forEachTile(function (t) { n[t.index] = (n[t.index] || 0) + 1; if (t.properties && t.properties.water) water = t.index; });
    return { grass: Number(Object.keys(n).sort(function (p, q) { return n[q] - n[p]; })[0]), water: water };
  };
})(window.Farm = window.Farm || {});
