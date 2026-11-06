// Bakunawa's Lair in the world (owner, 4 Nov 2026: "Use agent and build this"; design docs/lair-design.md; content
// 00-zzzzzzlair.js, rules 01-logicN.js, Kanor's rows and the tour 19zu-lair-ui.js). A cave mouth at the north edge of
// Magayon goes down into one lava cave room (maps/lair.json) used for every floor, like the mine: the floor is
// F.session.lairFloor. Each floor holds its own creatures (L.lairRoster), and none walk in from the edges: clear them
// all and the gate down glows open; walk onto it for the next floor. A ladder by the way in climbs out to Magayon, and
// a lift beside it stops at 1, 11, 21 ... once you have reached them. Floor 50 is the bottom: the Bakunawa rises there,
// like the Great Mammoth, only for two hunters or more, once a day. It is a wild map (L.isWildMap), so the Bow, the dog,
// Hunter's gear and hunting with friends all work as in the Wild Lands; with friends, only those on the same floor are
// together (19h-online.js O.floorHere). The cave's tiles, its lava, the mouth and the gate are the owner's pictures
// (5 Nov 2026; art-src/LAIR-PROMPTS.md 7-12, made into the game's sizes by tools/art/lair-world-import.js), painted over
// the Mine's cave tiles in the Lair's own copy of the indoor sheet, so the Mine and its bands keep theirs. Without them
// (an old page) the cave is the Mine's tiles painted red and orange, and the mouth and the gate are drawn, as before.
// The lift is drawn here.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var LA = C.LAIR;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var friendsHere = function (w) { return Object.keys(w.remotes || {}).length > 0; };
  var floorNow = function () { return (F.session && F.session.lairFloor) || 1; };
  var ADD = Phaser.BlendModes.ADD;
  var GO = 0x5fa84a, HERE = 0xa08a68, FIRE = 0x8a2a12;
  var LIFT = { x0: 2, y0: 2, x1: 3, y1: 3, w: 2.1, h: 2.75 }; // the tiles it stands on, left of the ladder; its picture, in tiles
  var MOUTH = { w: 3.7, h: 3.5 }; // its picture, in tiles, standing on Magayon's 'lair_mouth' point (the real one is as tall as its shape says)
  // The gate's picture is drawn in the game's three-quarter view, a little taller than its 2 x 2 tiles of floor: it is
  // squashed this much so it lies on the floor, and stands this far below its tiles' bottom edge.
  var GATE = { squash: 0.85, drop: 0.08 };
  var ART = { mouth: 'props/lair_mouth', gate: 'props/lair_gate', cave: 'lair_cave' }; // (tools/art/lair-world-import.js)
  var real = function (key) { return !!(F.images && F.images[key]); };
  // the cave tiles' places in the indoor sheet (tools/tiles.js INDOOR)
  var ID = { void: 5, cave: 6, cave2: 7, cave_wall: 8, cave_top: 9 };
  // ...and their places in the Lair's own tiles (assets/lair_cave: 128 px tiles in a row, then the lava at 192 px)
  var CAVE = { cave: 0, cave2: 1, cave_wall: 2, cave_top: 3, void: 4, tile: 128, lava: 640, lavaSize: 192 };
  var SHEET = 'indoor-lair', CROP = 1024; // (the cave tiles are in the sheet's top two rows: only its top quarter is copied)
  F.keepBitmap = F.keepBitmap || {};
  F.keepBitmap.indoor = true; // (the Lair and the mine bands paint from it; F.dropBitmaps lets it go a few seconds in)
  var LOOK = {
    floor: ['#220b07', '#561f13', '#9a4a2c'],
    wall: ['#170707', '#5e2216', '#b8642e'],
    top: ['#0e0404', '#2e0f09', '#561f10'],
    crust: ['#1a0604', '#3e1108', '#742a12'], // under the lava pools (drawn over it, below): cooled rock round their edges
  };

  // ---------- which cave (owner, 6 Nov 2026: each new hunting place has a dungeon of its own) ----------
  // The Lair's code runs every cave: this.lair holds the floor, and this.lair.cfg says which cave it is, with its own
  // floors, lift, colours and art (a place's: C.PLACES[id].dungeon, 01-logicZZZZ-places.js). The Lair's is below, as it was.
  var LAIR_CFG = {
    key: 'lair', lair: true, floors: LA.floors, liftEvery: LA.liftEvery, from: 'magayon', mouth: 'lair_mouth', sheet: SHEET, look: LOOK, art: ART,
    bg: '#140605', propTint: 0xd8957c, embers: true, lift: 'Lair Lift', icon: 'ember_shard', place: 'magayon',
    roster: function (f) { return L.lairRoster(f); }, reach: function (s, f) { return L.lairReach(s, f); }, stops: function (s) { return L.lairStops(s); },
  };
  var cfgs = {};
  F.dungeonOf = function (map) {
    if (map === 'lair') return LAIR_CFG;
    if (!map || !L.isPlaceDungeon || !L.isPlaceDungeon(map)) return null;
    if (cfgs[map]) return cfgs[map];
    var id = C.DUNGEONS[map], p = C.PLACES[id], d = p.dungeon, art = d.art || {};
    return (cfgs[map] = {
      key: map, place: id, floors: d.floors, liftEvery: d.liftEvery, from: p.map, mouth: 'dungeon_mouth', sheet: 'indoor-' + map,
      look: d.look || LOOK, lava: d.lava || null, art: { mouth: art.mouth, gate: art.gate, cave: art.cave }, bg: d.bg || '#140605', propTint: d.propTint || 0xd8957c,
      embers: !!(d.lava ? d.lava.embers : true), lift: (d.name || p.name) + ' Lift', icon: d.icon || 'chest', name: d.name || p.name + ' Cave', d: d,
      roster: function (f) { return L.dunRoster(map, f); }, reach: function (s, f) { return L.dunReach(s, map, f); }, stops: function (s) { return L.dunStops(s, map); },
    });
  };
  // the cave whose mouth is on this map (Magayon: the Lair's)
  var mouthOn = function (map) {
    if (map === 'magayon') return LAIR_CFG;
    var p = C.PLACES && C.PLACES[map];
    return p && !p.legacy && p.dungeon ? F.dungeonOf(p.dungeon.key) : null;
  };
  var isGate = function (o) { return o.type === 'lair_gate' || o.type === 'dungeon_gate'; };

  // ---------- the session and the save ----------
  var newSession = F.newSession;
  F.newSession = function (saved) {
    var s = newSession(saved);
    s.lairFloor = 1;
    return s;
  };
  // The floor is not saved (as in the mine): a game closed in the Lair opens again in Magayon, at the cave mouth.
  // The save keeps a map as its place in a list (01-logic.js), which has no Lair: it is saved as Magayon, without the
  // spot (that was in the cave), and lx says to stand at the mouth.
  var MAGAYON = null;
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.map === 'lair') {
      if (MAGAYON == null) MAGAYON = serialize(Object.assign({}, s, { map: 'magayon' })).m;
      o.m = MAGAYON;
      delete o.p;
      o.lx = 1;
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s && o && o.lx && s.map === 'magayon') s.player = { x: null, y: null, dir: 'down', spawn: 'from_lair' };
    return s;
  };

  // the way out toward everywhere else (the goal arrow, following a friend): up the ladder, and in through the mouth
  var R = C.ROUTES;
  R.lair = {};
  Object.keys(R).forEach(function (m) {
    if (m === 'lair') return;
    R.lair[m] = 'exit';
    R[m].lair = m === 'magayon' ? 'lair_door' : R[m].magayon;
  });

  // ---------- each floor's creatures ----------
  // The Lair's are the floor's, less the ones hunted since you came down (they do not come back while you stay).
  var wildHere = L.wildHere;
  L.wildHere = function (s, area) {
    var cfg = F.dungeonOf(area);
    if (!cfg) return wildHere(s, area);
    var w = F.world, down = (w && w.lair && w.lair.down) || {};
    return cfg.roster(floorNow()).filter(function (e) { return !down[e.slot]; });
  };
  var gateRect = function (cfg) { // (from the map: the game needs it before the map's objects are read)
    var raw = F.ASSETS.maps[cfg.key], o = null;
    raw.layers.forEach(function (l) { (l.objects || []).forEach(function (x) { if (isGate(x)) o = x; }); });
    return o ? { x0: Math.floor(o.x / T), y0: Math.floor(o.y / T), x1: Math.ceil((o.x + o.width) / T) - 1, y1: Math.ceil((o.y + o.height) / T) - 1 } : null;
  };

  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    var tc = F.dungeonOf(to);
    if (tc && !this.busy) F.session.lairFloor = Math.max(1, Math.min(tc.floors, Math.floor(floor) || 1));
    // off this floor: its "gate down is open" note goes too (it stayed up on the next floor)
    if (this.lair && F.ui && F.ui.toastText && F.ui.toastText.visible && /^The gate down is open/.test(F.ui.toastText.text)) F.ui.hideToast();
    return travel.call(this, to, spawn, floor);
  };

  // ---------- the cave's colours ----------
  var rgb = function (c) { var n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var ramp = function (cols) { // three colours as 256 steps
    var a = cols.map(rgb), out = [];
    for (var i = 0; i < 256; i++) {
      var t = i / 255, lo = t < 0.5 ? a[0] : a[1], hi = t < 0.5 ? a[1] : a[2], k = t < 0.5 ? t * 2 : t * 2 - 1;
      out.push([lo[0] + (hi[0] - lo[0]) * k, lo[1] + (hi[1] - lo[1]) * k, lo[2] + (hi[2] - lo[2]) * k]);
    }
    return out;
  };
  var recolour = function (g, x, y, w, h, cols) { // keeps a tile's light and shade, in new colours
    var d = g.getImageData(x, y, w, h), p = d.data, lo = 1, hi = 0, map = ramp(cols), i, v;
    for (i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 40) continue;
      v = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    var span = Math.max(0.06, hi - lo);
    for (i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      v = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      var c = map[Math.max(0, Math.min(255, Math.round((v - lo) / span * 255)))];
      p[i] = c[0];
      p[i + 1] = c[1];
      p[i + 2] = c[2];
    }
    g.putImageData(d, x, y);
  };
  // One of the Lair's own tiles into its cell of the sheet, its edge pixels drawn out into the gap round the cell (what a
  // tile's edge blends with when drawn smaller), as the sheet's own tiles have.
  var putTile = function (g, at, id, cfg) {
    var img = F.images[cfg.art.cave], t = at, pad = t.pad, s = t.s - pad * 2, c = document.createElement('canvas');
    c.width = c.height = t.s;
    var cg = c.getContext('2d');
    cg.imageSmoothingQuality = 'high';
    cg.drawImage(img, CAVE[id] * CAVE.tile, 0, CAVE.tile, CAVE.tile, pad, pad, s, s);
    cg.drawImage(c, pad, pad, 1, s, 0, pad, pad, s);
    cg.drawImage(c, pad + s - 1, pad, 1, s, pad + s, pad, pad, s);
    cg.drawImage(c, 0, pad, t.s, 1, 0, 0, t.s, pad);
    cg.drawImage(c, 0, pad + s - 1, t.s, 1, 0, pad + s, t.s, pad);
    g.clearRect(t.x, t.y, t.s, t.s);
    g.drawImage(c, t.x, t.y);
  };
  // The top of the indoor sheet with the Lair's tiles in the cave's cells (lava in the 'void' one, under the pools; without
  // the pictures, the Mine's in the Lair's colours): made the first time in, and kept for the session.
  var lairSheet = function (w, cfg) {
    var tex = w.textures, SHEET = cfg.sheet, LOOK = cfg.look;
    if (tex.exists(SHEET)) return SHEET;
    F.ensureTexture(w, 'indoor');
    // (from the bitmap decoded on the way in when there is one, 10-boot.js F.prewarm: the <img> is decoded on the spot)
    var img = (F.bitmaps && F.bitmaps.indoor) || F.images.indoor, full = tex.get('indoor').source[0].width, iw = img.naturalWidth || img.width, k = iw / full;
    var c = document.createElement('canvas');
    c.width = iw;
    c.height = Math.round(CROP * k);
    var g = c.getContext('2d', { willReadFrequently: true }), ts = w.map.getTileset('indoor'), pad = Math.round(8 * k);
    g.drawImage(img, 0, 0);
    var at = function (id) { var q = ts.getTileTextureCoordinates(ts.firstgid + id); return { x: Math.round(q.x * k) - pad, y: Math.round(q.y * k) - pad, s: Math.round(ts.tileWidth * k) + pad * 2, pad: pad }; };
    if (real(cfg.art.cave)) ['void', 'cave', 'cave2', 'cave_wall', 'cave_top'].forEach(function (id) { putTile(g, at(ID[id]), id, cfg); });
    else {
      var paint = function (id, cols) { var t = at(id); recolour(g, t.x, t.y, t.s, t.s, cols); };
      var from = at(ID.cave2), to = at(ID.void);
      g.clearRect(to.x, to.y, to.s, to.s);
      g.drawImage(c, from.x, from.y, from.s, from.s, to.x, to.y, to.s, to.s);
      paint(ID.void, LOOK.crust);
      paint(ID.cave, LOOK.floor);
      paint(ID.cave2, LOOK.floor);
      paint(ID.cave_wall, LOOK.wall);
      paint(ID.cave_top, LOOK.top);
    }
    var t = tex.create(SHEET, c, full, CROP), gt = t.source[0].glTexture;
    if (gt) { gt.width = full; gt.height = CROP; }
    Phaser.Textures.Parsers.Image(t, 0);
    return SHEET;
  };

  // ---------- pictures drawn here (the mouth and the gate only when their own art is missing) ----------
  var canvasTex = function (w, key, W, H, draw) {
    if (w.textures.exists(key)) return key;
    var c = w.textures.createCanvas(key, W, H), g = c.getContext();
    draw(g, W, H);
    c.refresh();
    return key;
  };
  var glowTexture = function (w) {
    return canvasTex(w, 'fx-lairglow', 128, 128, function (g) {
      var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,190,90,0.9)');
      gr.addColorStop(0.45, 'rgba(255,110,30,0.45)');
      gr.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
  };
  // A pool of lava over its tiles (cells: [x, y] in tiles; x0, y0 the top left of their box): round at the edges, with a
  // dark rim. Inside, the owner's lava picture (one repeat every 2 tiles), darker toward the rim where it cools; without
  // it, plates of cooling crust drawn with the glow between them. The same pools on every floor: kept while you stay.
  var PX = 96, EDGE = 0.3; // canvas pixels a tile; how far the rim reaches past the pool, in tiles
  var poolTexture = function (w, key, cells, x0, y0, cw, ch, cfg) {
    var lava = cfg.lava || {}, RIM = lava.rim || '#2a0b05', HOT = lava.hot || ['#ffbc48', '#f2761c', '#c2360c'], PLATE = lava.plate || ['rgba(92,22,8,0.9)', 'rgba(128,36,10,0.85)'];
    return canvasTex(w, key, Math.ceil((cw + EDGE * 2) * PX), Math.ceil((ch + EDGE * 2) * PX), function (g, W, H) {
      var seed = cells.length * 7 + x0 * 13 + y0 * 29, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      var has = {}, at = function (c) { return [(c[0] - x0 + 0.5 + EDGE) * PX, (c[1] - y0 + 0.5 + EDGE) * PX]; };
      cells.forEach(function (c) { has[c[0] + ',' + c[1]] = 1; });
      var shape = function (r, half, ctx) { // circles on each tile, joined where tiles touch
        var q = ctx || g;
        q.beginPath();
        cells.forEach(function (c) {
          var p = at(c);
          q.moveTo(p[0] + r * PX, p[1]);
          q.arc(p[0], p[1], r * PX, 0, Math.PI * 2);
          if (has[(c[0] + 1) + ',' + c[1]]) q.rect(p[0], p[1] - half * PX, PX, half * 2 * PX);
          if (has[c[0] + ',' + (c[1] + 1)]) q.rect(p[0] - half * PX, p[1], half * 2 * PX, PX);
          if (has[(c[0] + 1) + ',' + c[1]] && has[c[0] + ',' + (c[1] + 1)] && has[(c[0] + 1) + ',' + (c[1] + 1)]) q.rect(p[0], p[1], PX, PX);
        });
      };
      shape(0.5 + EDGE * 0.8, 0.5 + EDGE * 0.7);
      g.fillStyle = RIM;
      g.fill('nonzero');
      shape(0.56, 0.5);
      if (real(cfg.art.cave)) {
        var pc = document.createElement('canvas');
        pc.width = pc.height = PX * 2;
        pc.getContext('2d').drawImage(F.images[cfg.art.cave], CAVE.lava, 0, CAVE.lavaSize, CAVE.lavaSize, 0, 0, PX * 2, PX * 2);
        g.fillStyle = g.createPattern(pc, 'repeat');
        g.fill('nonzero');
        // the cooler edge: everything outside the pool, dark, casts its shadow in over the lava's edge
        var out = document.createElement('canvas'), og = out.getContext('2d');
        out.width = W;
        out.height = H;
        og.fillStyle = '#2a0b05';
        og.fillRect(0, 0, W, H);
        og.globalCompositeOperation = 'destination-out';
        shape(0.56, 0.5, og);
        og.fill('nonzero');
        g.save();
        g.clip('nonzero');
        g.shadowColor = 'rgba(42,11,5,0.9)';
        g.shadowBlur = PX * 0.2;
        g.drawImage(out, 0, 0);
        g.restore();
        return;
      }
      var hot = g.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, Math.max(W, H) * 0.6);
      hot.addColorStop(0, HOT[0]);
      hot.addColorStop(0.45, HOT[1]);
      hot.addColorStop(1, HOT[2]);
      g.fillStyle = hot;
      g.fill('nonzero');
      g.save();
      g.clip('nonzero');
      // plates of crust, with the glow showing between them
      var n = Math.round(cells.length * 5);
      for (var i = 0; i < n; i++) {
        var px = rnd() * W, py = rnd() * H, r = (0.12 + rnd() * 0.13) * PX, k = 5 + Math.floor(rnd() * 3), a0 = rnd() * 6;
        g.beginPath();
        for (var j = 0; j < k; j++) {
          var a = a0 + j / k * Math.PI * 2, rr = r * (0.7 + rnd() * 0.5);
          g[j ? 'lineTo' : 'moveTo'](px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
        }
        g.closePath();
        g.fillStyle = rnd() < 0.5 ? PLATE[0] : PLATE[1];
        g.fill();
      }
      for (var b = 0; b < cells.length * 2; b++) { // bright bubbles
        g.fillStyle = 'rgba(255,240,170,0.85)';
        g.beginPath();
        g.arc(rnd() * W, rnd() * H, (0.03 + rnd() * 0.04) * PX, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    });
  };
  // The cave mouth: the owner's picture, or (without it) a mound of dark rock with a glowing way in, two amber eyes and
  // fangs over it (a serpent's lair).
  var mouthTexture = function (w, cfg) {
    if (real(cfg.art.mouth)) return F.ensureTexture(w, cfg.art.mouth);
    return canvasTex(w, 'fx-lairmouth', 384, 364, function (g, W, H) {
      var line = '#1e1210', cx = W / 2, base = H - 6;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(6, base);
      [[14, 250], [40, 170], [86, 110], [130, 64], [176, 30], [214, 34], [262, 70], [306, 116], [344, 176], [372, 252], [378, base]].forEach(function (p) { g.lineTo(p[0], p[1]); });
      g.closePath();
      var rock = g.createLinearGradient(0, 20, 0, H);
      rock.addColorStop(0, '#7c6a60');
      rock.addColorStop(0.5, '#54443e');
      rock.addColorStop(1, '#30221e');
      g.fillStyle = rock;
      g.fill();
      g.lineWidth = 9;
      g.strokeStyle = line;
      g.stroke();
      // ledges in the rock
      g.strokeStyle = 'rgba(20,12,10,0.55)';
      g.lineWidth = 5;
      [[[60, 200], [120, 186], [150, 196]], [[236, 192], [290, 180], [330, 204]], [[150, 90], [196, 80], [238, 96]]].forEach(function (l) {
        g.beginPath();
        l.forEach(function (p, i) { g[i ? 'lineTo' : 'moveTo'](p[0], p[1]); });
        g.stroke();
      });
      g.strokeStyle = 'rgba(255,230,200,0.18)';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(96, 106); g.lineTo(134, 70); g.lineTo(176, 38);
      g.stroke();
      // the way in, lit from below by the fire inside
      var aw = 76, top = base - 176;
      g.beginPath();
      g.moveTo(cx - aw, base);
      g.lineTo(cx - aw, top + 70);
      g.quadraticCurveTo(cx - aw, top, cx, top);
      g.quadraticCurveTo(cx + aw, top, cx + aw, top + 70);
      g.lineTo(cx + aw, base);
      g.closePath();
      var fire = g.createRadialGradient(cx, base, 6, cx, base - 20, 190);
      fire.addColorStop(0, '#ffd27a');
      fire.addColorStop(0.28, '#f07a28');
      fire.addColorStop(0.6, '#7a1c0c');
      fire.addColorStop(1, '#180605');
      g.fillStyle = fire;
      g.fill();
      g.lineWidth = 9;
      g.strokeStyle = line;
      g.stroke();
      // fangs along the top of the way in
      g.fillStyle = '#f4e8d4';
      g.strokeStyle = line;
      g.lineWidth = 4;
      [[-50, top + 38, 22], [-18, top + 8, 26], [18, top + 8, 26], [50, top + 38, 22]].forEach(function (f) {
        g.beginPath();
        g.moveTo(cx + f[0] - 11, f[1]);
        g.lineTo(cx + f[0] + 11, f[1]);
        g.lineTo(cx + f[0], f[1] + f[2]);
        g.closePath();
        g.fill();
        g.stroke();
      });
      // two eyes over it
      [-1, 1].forEach(function (side) {
        var ex = cx + side * 50, ey = top - 38;
        g.fillStyle = '#2a1a16';
        g.beginPath();
        g.ellipse(ex, ey - 6, 34, 14, side * 0.2, 0, Math.PI * 2);
        g.fill();
        var eye = g.createRadialGradient(ex, ey, 2, ex, ey, 22);
        eye.addColorStop(0, '#fff2a0');
        eye.addColorStop(0.6, '#ffb43a');
        eye.addColorStop(1, '#c0501a');
        g.fillStyle = eye;
        g.beginPath();
        g.ellipse(ex, ey, 22, 13, side * 0.2, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = line;
        g.stroke();
        g.fillStyle = '#1a0a06';
        g.beginPath();
        g.ellipse(ex, ey, 4, 11, 0, 0, Math.PI * 2);
        g.fill();
      });
    });
  };
  // The gate down: the owner's picture, its two halves (shut, open) as two frames of one texture; without it, a round
  // stone seal in the floor with the moon the Bakunawa eats, and open, a glowing stair going down. Gives [key, frame].
  var gateFrame = function (w, open, cfg) {
    if (!real(cfg.art.gate)) return [gateTexture(w, open), undefined];
    var key = F.ensureTexture(w, cfg.art.gate), t = w.textures.get(key);
    if (!t.has('open')) { // (again after it was let go elsewhere and came back: 19zzzz-perf.js)
      var src = t.source[0], fw = Math.floor((src.width - 4) / 2); // (side by side, 4 px apart: the importer)
      t.add('shut', 0, 0, 0, fw, src.height);
      t.add('open', 0, src.width - fw, 0, fw, src.height);
    }
    return [key, open ? 'open' : 'shut'];
  };
  var gateTexture = function (w, open) {
    return canvasTex(w, open ? 'fx-lairgate1' : 'fx-lairgate0', 256, 256, function (g) {
      var cx = 128, cy = 128;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(cx, cy + 8, 122, 118, 0, 0, Math.PI * 2);
      g.fill();
      var ring = g.createLinearGradient(0, 8, 0, 248);
      ring.addColorStop(0, '#8a7a72');
      ring.addColorStop(1, '#40322e');
      g.fillStyle = ring;
      g.beginPath();
      g.arc(cx, cy, 118, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#1a1010';
      g.stroke();
      for (var k = 0; k < 12; k++) { // the ring's stones
        var a = k / 12 * Math.PI * 2;
        g.strokeStyle = 'rgba(26,16,16,0.7)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96);
        g.lineTo(cx + Math.cos(a) * 116, cy + Math.sin(a) * 116);
        g.stroke();
      }
      g.save();
      g.beginPath();
      g.arc(cx, cy, 94, 0, Math.PI * 2);
      g.clip();
      if (open) {
        var hole = g.createRadialGradient(cx, cy + 10, 4, cx, cy, 96);
        hole.addColorStop(0, '#fff0a8');
        hole.addColorStop(0.3, '#ff9a34');
        hole.addColorStop(0.72, '#b8360e');
        hole.addColorStop(1, '#3a0a06');
        g.fillStyle = hole;
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(70,14,4,0.6)'; // steps going down into the glow
        g.lineWidth = 7;
        for (var st = 0; st < 5; st++) {
          var y = 60 + st * 30, half = 70 - st * 9;
          g.beginPath();
          g.moveTo(cx - half, y);
          g.lineTo(cx + half, y);
          g.stroke();
        }
      } else {
        var slab = g.createRadialGradient(cx - 20, cy - 24, 10, cx, cy, 100);
        slab.addColorStop(0, '#4e3a34');
        slab.addColorStop(1, '#1e1210');
        g.fillStyle = slab;
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(150,40,20,0.75)'; // cracks, faintly lit from below
        g.lineWidth = 4;
        [[0.3, 92], [1.9, 88], [3.4, 90], [4.9, 86]].forEach(function (c) {
          g.beginPath();
          g.moveTo(cx + Math.cos(c[0]) * 46, cy + Math.sin(c[0]) * 46);
          g.lineTo(cx + Math.cos(c[0] + 0.2) * 70, cy + Math.sin(c[0] + 0.2) * 70);
          g.lineTo(cx + Math.cos(c[0] - 0.05) * c[1], cy + Math.sin(c[0] - 0.05) * c[1]);
          g.stroke();
        });
        // the moon
        g.fillStyle = '#d8c89a';
        g.beginPath();
        g.arc(cx - 6, cy, 34, 0.32 * Math.PI, 1.68 * Math.PI, false);
        g.arc(cx + 10, cy, 27, 1.6 * Math.PI, 0.4 * Math.PI, true);
        g.closePath();
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#1a1010';
        g.stroke();
      }
      g.restore();
      g.lineWidth = 6;
      g.strokeStyle = '#1a1010';
      g.beginPath();
      g.arc(cx, cy, 94, 0, Math.PI * 2);
      g.stroke();
    });
  };
  // The lift: an iron cage in a frame of dark stone, with its wheel on top.
  var liftTexture = function (w) {
    return canvasTex(w, 'fx-lairlift', 336, 440, function (g, W, H) {
      var line = '#160c0a', beam = function (x, y, bw, bh, up) {
        var gr = up ? g.createLinearGradient(x, 0, x + bw, 0) : g.createLinearGradient(0, y, 0, y + bh);
        gr.addColorStop(0, '#7a6660');
        gr.addColorStop(0.5, '#54423c');
        gr.addColorStop(1, '#2e2220');
        g.fillStyle = gr;
        g.strokeStyle = line;
        g.lineWidth = 6;
        g.beginPath();
        g.rect(x, y, bw, bh);
        g.fill();
        g.stroke();
      };
      var dark = g.createLinearGradient(0, 40, 0, H);
      dark.addColorStop(0, '#0a0404');
      dark.addColorStop(1, '#2a0c08');
      g.fillStyle = dark;
      g.fillRect(34, 40, W - 68, H - 60);
      g.strokeStyle = '#a89a8a';
      g.lineWidth = 5;
      [W / 2 - 34, W / 2 + 34].forEach(function (x) { g.beginPath(); g.moveTo(x, 58); g.lineTo(x, 176); g.stroke(); });
      var cx = 70, cy = 170, cw = W - 140, ch = 214;
      g.fillStyle = 'rgba(120,40,16,0.45)';
      g.fillRect(cx, cy, cw, ch);
      g.strokeStyle = '#8c8e94';
      g.lineWidth = 6;
      for (var bar = 1; bar < 5; bar++) { g.beginPath(); g.moveTo(cx + cw * bar / 5, cy + 10); g.lineTo(cx + cw * bar / 5, cy + ch - 10); g.stroke(); }
      beam(cx - 8, cy - 12, cw + 16, 26, false);
      beam(cx - 8, cy + ch - 14, cw + 16, 28, false);
      beam(14, 34, 44, H - 44, true);
      beam(W - 58, 34, 44, H - 44, true);
      beam(2, 22, W - 4, 40, false);
      var wx = W / 2, wy = 44;
      g.fillStyle = '#2e3036';
      g.strokeStyle = line;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(wx, wy, 38, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = '#d0703a';
      for (var sp = 0; sp < 3; sp++) {
        var a = sp * Math.PI / 3;
        g.beginPath();
        g.moveTo(wx - Math.cos(a) * 28, wy - Math.sin(a) * 28);
        g.lineTo(wx + Math.cos(a) * 28, wy + Math.sin(a) * 28);
        g.stroke();
      }
    });
  };

  // ---------- Magayon: the cave mouth ----------
  P.setupLairMouth = function () {
    var cfg = mouthOn(this.mapKey), p = cfg && this.points[cfg.mouth];
    if (!p || this.lairMouth) return;
    this.lairMouth = true;
    var img = this.add.image(p.x, p.y + 0.08 * T, mouthTexture(this, cfg)).setOrigin(0.5, 1);
    img.setDisplaySize(MOUTH.w * T, real(cfg.art.mouth) ? MOUTH.w * T * img.height / img.width : MOUTH.h * T);
    if (!cfg.lair && !real(cfg.art.mouth)) img.setTint(cfg.propTint); // (a place's drawn stand-in, in its cave's colour)
    F.depthTo(img, DEPTH.actor + p.y / 1e5);
    var glow = this.add.image(p.x, p.y - 0.3 * T, glowTexture(this)).setDisplaySize(1.6 * T, 1.2 * T).setBlendMode(ADD).setAlpha(0.5).setDepth(img.depth + 0.00001);
    this.tweens.add({ targets: glow, alpha: 0.85, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // the rock around the door is solid; the door (one tile, under the warp) is open
    var cx = Math.floor(p.x / T), foot = Math.round(p.y / T) - 1, self = this;
    [[cx - 1, foot - 2, 1, 3], [cx + 1, foot - 2, 1, 3], [cx, foot - 2, 1, 2]].forEach(function (b) {
      for (var y = b[1]; y < b[1] + b[3]; y++) for (var x = b[0]; x < b[0] + b[2]; x++) self.blocked[self.idx(x, y)] = true;
      var zone = self.add.zone((b[0] + b[2] / 2) * T, (b[1] + b[3] / 2) * T, b[2] * T - 24, b[3] * T - 24);
      self.physics.add.existing(zone, true);
      self.solids.add(zone);
    });
  };

  // ---------- a floor ----------
  var create = P.create;
  P.create = function () {
    var s = F.session && F.session.state, cfg = s ? F.dungeonOf(s.map) : null, on = !!cfg, floor = floorNow();
    // (set before the world is made: setupWild, in 19v-wild.js, asks L.wildHere and wildFree)
    this.lairMouth = false;
    this.lair = on ? { cfg: cfg, floor: floor, down: {}, seen: false, open: false, gate: null, gateRect: floor < cfg.floors ? gateRect(cfg) : null, onGate: false, embers: 0, lava: [] } : null;
    create.call(this);
    this.setupLairMouth();
    if (!this.lair || this.mapKey !== cfg.key) {
      this.lair = null; // (its painted sheet is kept for the session: 2 MB, and painting it again cost ~0.2 s each time in)
      return;
    }
    var self = this, lr = this.lair;
    this.map.getTileset('indoor').setImage(this.textures.get(lairSheet(this, cfg)));
    this.game.renderer.config.backgroundColor = Phaser.Display.Color.HexStringToColor(cfg.bg);
    if (floor === 1) cfg.reach(s, 1);
    this.setupLava();
    this.props.forEach(function (p) { p.setTint(cfg.propTint); }); // (Magayon's rocks, in the light of the lava)
    this.time.addEvent({ delay: 240, loop: true, callback: this.lairEmbers, callbackScope: this });
    this.setupLairGate();
    this.setupLairLift();
    // the creatures on it: as tough as the floor makes them; a guard shows its bar at once
    (this.wild ? this.wild.animals : []).forEach(function (a) { self.lairStrength(a); });
    if (this.wild && !this.wildFollowing()) lr.seen = true; // (a friend here runs it: the floor is clear once their report is)
    var news = F.session.lairNew === floor;
    F.session.lairNew = null;
    this.time.delayedCall(500, function () {
      if (!F.ui || !self.sys.isActive() || F.ui.modals.length) return; // (a panel opened at once: not over its title)
      var line;
      if (cfg.lair) {
        var boss = L.lairBossFloor(floor) && floor < LA.floors, bottom = floor >= LA.floors;
        line = bottom ? "Floor 50, the bottom of the Lair. The Bakunawa sleeps here: it rises only for two hunters or more."
          : "Bakunawa's Lair, floor " + floor + (boss ? '. A Bungisngis guards it!' : '. Clear it to open the gate down.');
      } else { // a place's cave: its guard and its boss
        var d = cfg.d, who = floor === d.bossFloor && d.boss ? d.boss : floor === d.guardFloor && d.guard ? d.guard : null;
        line = cfg.name + ', floor ' + floor + (who ? '. ' + WI.animals[who].name + (who === d.boss ? ' waits at the bottom!' : ' guards it!') : '. Clear it to open the gate down.');
      }
      if (news && (floor - 1) % cfg.liftEvery === 0 && floor > 1) line = 'Floor ' + floor + '! The lift by the way in now stops here.';
      F.ui.toast(line, 3200, FIRE);
    });
  };
  // Lava: a pool drawn over each patch of its tiles, a glow that breathes, and sparks (lairEmbers).
  P.setupLava = function () {
    var self = this, lr = this.lair, lavaGid = this.map.getTileset('indoor').firstgid + ID.void, cells = {}, glows = [];
    this.layers.Walls.forEachTile(function (t) {
      if (t.index !== lavaGid) return;
      cells[t.x + ',' + t.y] = [t.x, t.y];
      lr.lava.push({ x: (t.x + 0.5) * T, y: (t.y + 0.5) * T });
    });
    var n = 0;
    Object.keys(cells).forEach(function (k) {
      if (!cells[k]) return;
      var pool = [], todo = [cells[k]];
      cells[k] = null;
      while (todo.length) {
        var c = todo.pop();
        pool.push(c);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var key = (c[0] + d[0]) + ',' + (c[1] + d[1]); if (cells[key]) { todo.push(cells[key]); cells[key] = null; } });
      }
      var x0 = Math.min.apply(null, pool.map(function (c) { return c[0]; })), y0 = Math.min.apply(null, pool.map(function (c) { return c[1]; }));
      var cw = Math.max.apply(null, pool.map(function (c) { return c[0]; })) - x0 + 1, ch = Math.max.apply(null, pool.map(function (c) { return c[1]; })) - y0 + 1;
      var key = poolTexture(self, (lr.cfg.lair ? 'fx-lairpool' : 'fx-' + lr.cfg.key + 'pool') + (n++) + '-' + x0 + '-' + y0, pool, x0, y0, cw, ch, lr.cfg);
      self.add.image((x0 - EDGE) * T, (y0 - EDGE) * T, key).setOrigin(0, 0).setDisplaySize((cw + EDGE * 2) * T, (ch + EDGE * 2) * T).setDepth(DEPTH.Walls + 0.05);
      glows.push(self.add.image((x0 + cw / 2) * T, (y0 + ch / 2) * T, glowTexture(self)).setDisplaySize((cw + 1.4) * T, (ch + 1.4) * T).setBlendMode(ADD).setAlpha(0.3).setDepth(DEPTH.Walls + 0.1));
    });
    if (glows.length) this.tweens.add({ targets: glows, alpha: 0.5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };
  P.lairStrength = function (a) {
    if (this.lair && !this.lair.cfg.lair) { // a place's cave: its boss is as strong as the crew (L.dunHp)
      if (!a.def.dungeon) return;
      a.hp = a.max = L.dunHp(a.kind, 1 + Object.keys(this.remotes || {}).length);
      a.crew = 1 + Object.keys(this.remotes || {}).length;
      if (a.def.boss) this.wildBar(a);
      return;
    }
    if (!a.def.lair || a.def.great) return;
    a.hp = a.max = L.lairHp(a.kind, this.lair.floor);
    if (a.def.boss) this.wildBar(a);
  };
  P.lairEmbers = function () {
    var lr = this.lair, view = this.cameras.main.worldView;
    if (!lr || !lr.cfg.embers || !lr.lava.length || lr.embers > 14 || this.busy) return;
    var p = lr.lava[Math.floor(Math.random() * lr.lava.length)];
    if (!view.contains(p.x, p.y)) return;
    lr.embers++;
    var c = this.add.circle(p.x + rand(-0.4, 0.4) * T, p.y + rand(-0.3, 0.3) * T, rand(8, 15), Math.random() < 0.5 ? 0xffc050 : 0xff6a20).setDepth(DEPTH.fx).setAlpha(0.9).setBlendMode(ADD);
    this.tweens.add({ targets: c, y: c.y - rand(0.8, 1.8) * T, x: c.x + rand(-0.3, 0.3) * T, alpha: 0, scale: 0.3, duration: rand(900, 1600),
      onComplete: function () { c.destroy(); lr.embers--; } });
  };
  // The cave is as dark by day as by night, lit by its lava (the night sheet is blue: only a touch of it).
  var darkness = U.darkness;
  U.darkness = function () { return F.world && F.dungeonOf(F.world.mapKey) ? 0.1 : darkness.call(this); };
  var musicMood = P.musicMood;
  P.musicMood = function () { return F.dungeonOf(this.mapKey) ? 'mine' : musicMood.call(this); };

  // ---------- the gate down ----------
  P.setupLairGate = function () {
    var lr = this.lair, g = lr.gateRect;
    if (!g) { // floor 50: no way further down
      this.objects = this.objects.filter(function (o) { return !isGate(o); });
      return;
    }
    var x = (g.x0 + g.x1 + 1) / 2 * T, y = (g.y0 + g.y1 + 1) / 2 * T, size = (g.x1 - g.x0 + 1) * T, tf = gateFrame(this, false, lr.cfg);
    var img = this.add.image(x, y, tf[0], tf[1]).setDisplaySize(size, size).setDepth(DEPTH.flat);
    if (tf[1]) { // the picture: on its tiles' bottom edge, the glow over the way down in it
      img.setOrigin(0.5, 1).setPosition(x, (g.y1 + 1 + GATE.drop) * T).setDisplaySize(size, size * img.height / img.width * GATE.squash);
      y = img.y - img.displayHeight * 0.48;
    }
    lr.gate = {
      img: img,
      glow: this.add.image(x, y, glowTexture(this)).setDisplaySize(size * 1.5, size * 1.5).setBlendMode(ADD).setDepth(DEPTH.flat + 0.01).setVisible(false),
      x: x, y: y,
    };
  };
  P.openLairGate = function (loud) {
    var lr = this.lair, self = this;
    if (!lr || !lr.gate || lr.open) return;
    lr.open = true;
    var tf = gateFrame(this, true, lr.cfg);
    lr.gate.img.setTexture(tf[0], tf[1]);
    lr.gate.glow.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: lr.gate.glow, alpha: 0.8, duration: 700, onComplete: function () {
      if (lr.gate.glow.active) self.tweens.add({ targets: lr.gate.glow, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } });
    if (!loud) return;
    sfx('found');
    this.cameras.main.shake(220, 0.003);
    this.time.delayedCall(1400, function () { if (F.ui && self.lair === lr && !self.busy) F.ui.toast('The gate down is open! Walk onto it for floor ' + (lr.floor + 1) + '.', 3000, 0x2f5a22); });
  };
  var sealed = function (w) {
    var n = w.wild ? w.wild.animals.length : 0;
    return 'The gate down is sealed. ' + (n ? n + (n > 1 ? ' creatures are' : ' creature is') + ' still on this floor.' : 'Hunt every creature on this floor to open it.');
  };
  P.lairDown = function () {
    var lr = this.lair, s = this.state, next = lr.floor + 1;
    if (this.busy || !lr.open) return;
    if (lr.cfg.reach(s, next)) F.session.lairNew = next; // (the deepest you have been: the lift's stops)
    this.travel(lr.cfg.key, 'entrance', next);
  };
  P.lairStep = function () {
    var lr = this.lair, g = lr.gateRect, f = this.feet(), tx = Math.floor(f.x / T), ty = Math.floor(f.y / T);
    var on = tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1;
    if (on && !lr.onGate) {
      if (lr.open) { lr.onGate = on; return this.lairDown(); }
      if (F.ui && !F.ui.blocking()) F.ui.toast(sealed(this), 2400);
    }
    lr.onGate = on;
  };

  // ---------- the lift ----------
  P.setupLairLift = function () {
    if (F.session.visit || this.lair.cfg.stops(this.state).length < 2) return;
    var b = LIFT, x = (b.x0 + b.x1 + 1) / 2 * T, foot = (b.y1 + 1) * T;
    this.add.image(x, foot + 0.1 * T, liftTexture(this)).setOrigin(0.5, 1).setDisplaySize(b.w * T, b.h * T).setDepth(this.cursor ? this.cursor.depth - 0.01 : DEPTH.actor); // (against the back wall)
    this.objects.push({ type: 'lairlift', name: 'lift', x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, props: {} });
    var zone = this.add.zone(x, (b.y0 + b.y1 + 1) / 2 * T, (b.x1 - b.x0 + 1) * T - 30, (b.y1 - b.y0 + 1) * T - 30);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    for (var y = b.y0; y <= b.y1; y++) for (var tx = b.x0; tx <= b.x1; tx++) this.blocked[this.idx(tx, y)] = true;
  };
  U.openLairLift = function (page) {
    var self = this, s = F.session.state, here = floorNow(), cfg = (F.world && F.dungeonOf(F.world.mapKey)) || LAIR_CFG;
    var rows = cfg.stops(s).slice().reverse().map(function (floor) { // (the deepest first)
      var at = here === floor;
      return {
        icon: C.ICON[cfg.icon], name: 'Floor ' + floor, desc: floor === 1 ? (cfg.lair ? 'The way in, under Magayon.' : 'The way in.') : cfg.lair ? 'Past the guard of floor ' + (floor - 1) + '.' : 'You have been this far.',
        buttons: [{ label: at ? 'Here' : 'Go', color: at ? HERE : GO, cb: function () {
          if (at) return;
          self.closeModal();
          sfx('ladder');
          F.world.travel(cfg.key, 'entrance', floor);
        } }],
      };
    });
    this.listPanel({ title: cfg.lift, rows: rows, page: page || 0, reopen: function (t, p) { self.openLairLift(p); },
      sub: function () { return cfg.liftEvery > 1 ? 'Stops every ' + cfg.liftEvery + ' floors you have reached.' : 'Stops at every floor you have reached.'; } });
  };

  // What the action button does here: the ladder, the lift and the gate come first, even with the Bow in your hands.
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.lair) {
      var t = this.facing(), o = this.inMap(t.x, t.y) ? this.objectAt(t.x, t.y) : null;
      if (o && (o.type === 'warp' || o.type === 'lairlift' || isGate(o))) {
        var a = this.objectAction(o, L.held(this.state), null);
        if (a) return a;
      }
    }
    return resolve.call(this);
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var self = this;
    if (o.type === 'lairlift') return { label: 'Lift', icon: C.ICON.crate, run: function () { F.ui.openLairLift(); } };
    if (isGate(o) && this.lair && this.lair.gate) {
      if (this.lair.open) return { label: 'Go down', icon: -1, run: function () { self.lairDown(); } };
      return { label: 'Sealed', icon: -1, disabled: true, why: sealed(this) };
    }
    return extraObjectAction.call(this, o, held, def);
  };

  // ---------- every frame ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    var lr = this.lair;
    if (!lr || !this.wild || this.busy || !this.sys.isActive()) return;
    // seen: there were creatures here, or (a friend runs it) their report came, even an empty one: a floor they had
    // already cleared opens for you too (it stayed sealed, waiting for creatures that never came)
    if (this.wild.animals.length || (this.wild.lead && this.wild.heard)) lr.seen = true;
    if (!this.wild.animals.length && lr.seen && lr.gate && !lr.open) this.openLairGate(true);
    if (lr.gate) this.lairStep();
  };

  // ---------- the creatures (wrapping the Wild Lands' own: 19v-wild.js) ----------
  // No walking in from the edges, but the Bakunawa: on floor 50, for two hunters or more, once a day.
  var wildArrive = P.wildArrive;
  P.wildArrive = function (dt) {
    if (!this.lair) return wildArrive.call(this, dt);
    var w = this.wild, s = this.state;
    if (!this.lair.cfg.lair || this.lair.floor !== LA.bakunawaFloor) return; // (a place's cave: its boss is on its floor from the start)
    w.next -= dt;
    if (w.next > 0) return;
    w.next = rand(WI.arrive[0], WI.arrive[1]);
    if (!friendsHere(this) || !L.bakunawaReady(s)) return;
    var e = L.wildHere(s, 'lair').filter(function (x) { return WI.animals[x.kind].great && !w.animals.some(function (a) { return a.slot === x.slot; }); })[0];
    // it rises in the middle or upper part of the floor (at the edge it came up under the joystick, bottom left)
    var z0 = w.zone, qx = Math.floor((z0.x1 - z0.x0) / 4), mid = { x0: z0.x0 + qx, x1: z0.x1 - qx, y0: z0.y0, y1: z0.y0 + Math.floor((z0.y1 - z0.y0) * 0.55) };
    var p = e && (this.wildSpot(mid, this.feet(), 4) || this.wildSpot(mid) || this.wildEdge(w.zone));
    if (!p) return;
    var a = this.addWildAnimal(e.kind, e.slot, p.x, p.y, 1), z = w.zone, crew = 1 + Object.keys(this.remotes || {}).length;
    a.hp = a.max = a.def.hpEach * crew;
    this.wildGreat(a);
    var ang = Math.atan2((z.y0 + z.y1) / 2 * T - p.y, (z.x0 + z.x1) / 2 * T - p.x);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * a.def.walk * T;
    a.vy = Math.sin(ang) * a.def.walk * T;
    a.t = rand(2500, 5000);
    a.img.setAlpha(0);
    a.sh.setAlpha(0);
    a.fade = 0;
  };
  var wildGreat = P.wildGreat;
  P.wildGreat = function (a) {
    if (a.kind !== 'bakunawa') return wildGreat.call(this, a);
    this.wildBar(a);
    this.cameras.main.shake(400, 0.006);
    sfx('found');
    if (F.ui) F.ui.toast('The Bakunawa rises from the lava! Land ' + a.def.minHits + ' hits to share the hunt.', 3400, FIRE);
  };
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    if (!this.lair) return wildDown.call(this, a);
    var s = this.state;
    this.lair.down[a.slot] = true;
    var fire = a.kind === 'bakunawa' && a.mine && L.bakunawaHunted(s); // (everyone with a share: saved with the hunt)
    wildDown.call(this, a);
    if (fire) { // the 1 in 10: after the drops have had their moment
      this.time.delayedCall(2600, function () {
        sfx('fanfare');
        if (F.ui) F.ui.toast('The Lair\'s fire chose you! The Fire look is yours: wear it from Looks.', 4200, FIRE);
      });
    }
    delete s.wild.gone[this.mapKey + ':' + a.slot]; // (a friend's hunt leaves no slot waiting either)
  };
  // a friend runs the floor: what they report is the floor (their guard's bar shows at once)
  var wildHear = P.wildHear;
  P.wildHear = function (t, rows) {
    wildHear.call(this, t, rows);
    if (!this.lair) return;
    this.lair.seen = true;
    var self = this;
    this.wild.animals.forEach(function (a) { if (a.def.boss && !a.def.great && !a.bar) self.wildBar(a); });
  };
  // (Magayon's animals are placed after the mouth's rock is solid)
  var setupWild = P.setupWild;
  P.setupWild = function () {
    this.setupLairMouth();
    return setupWild.call(this);
  };
  // the gate is not ground to stand on for them
  var wildFree = P.wildFree;
  P.wildFree = function (x, y) {
    var g = this.lair && this.lair.gateRect;
    if (g && x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1) return false;
    return wildFree.call(this, x, y);
  };
  // no grass in a cave
  var wildGrass = P.wildGrass;
  P.wildGrass = function (a, dt, seen) { if (!this.lair) wildGrass.call(this, a, dt, seen); };
  // A Santelmo is a ball of fire: it glows, and flickers.
  var addWildAnimal = P.addWildAnimal;
  P.addWildAnimal = function (kind, slot, x, y, sized) {
    var a = addWildAnimal.call(this, kind, slot, x, y, sized);
    if (kind === 'santelmo') {
      a.halo = this.add.image(x, y, glowTexture(this)).setBlendMode(ADD).setAlpha(0.6);
      this.drawWild(a);
    }
    return a;
  };
  var drawWild = P.drawWild;
  P.drawWild = function (a, dt) {
    drawWild.call(this, a, dt);
    if (!a.halo) return;
    var size = (0.9 + a.def.w * 0.9) * a.size * T, flick = 0.5 + Math.sin(this.time.now / 90 + a.slot) * 0.08 + Math.sin(this.time.now / 37) * 0.05;
    a.halo.setPosition(a.x, a.y - a.lift - 0.32 * a.def.w * a.size * T).setDisplaySize(size, size).setAlpha(flick * (a.img.alpha || 0));
    F.depthTo(a.halo, a.img.depth - 0.000001);
  };
  var wildGone = P.wildGone;
  P.wildGone = function (a) {
    wildGone.call(this, a);
    if (a.halo) a.halo.destroy();
  };

  // ---------- with friends ----------
  // The owner went to another floor of the Lair while you are in it: 19r-follow.js asks (19v-wild.js would see the
  // same map and stop there).
  var hostMoved = O.hostMoved;
  O.hostMoved = function (v, host) {
    var w = F.world;
    if (host && F.dungeonOf(host.map) && w && w.mapKey === host.map && host.fl !== F.session.lairFloor && O.hostToLair) return O.hostToLair(v, host);
    return hostMoved.call(O, v, host);
  };
})(window.Farm = window.Farm || {});
