// The deeper Mine on screen (bands: 00-zzmine.js, rules: 01-logicF.js). Each band's cave is the same tiles repainted in
// its own colours, with crystals growing out of the rocks: one copy of the indoor sheet at a time, made when you first
// go down to that band. A lift stands left of the ladder once you have reached a new band.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var B = C.MINE.bands;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var LIFT = { x0: 2, y0: 2, x1: 3, y1: 3, w: 2.1, h: 2.75 }; // the tiles it stands on; its picture, in tiles
  var GO = 0x5fa84a, HERE = 0xa08a68;

  var rgb = function (c) { var n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // Three colours as 256 steps, dark to light.
  var ramp = function (cols) {
    var a = cols.map(rgb), out = [];
    for (var i = 0; i < 256; i++) {
      var t = i / 255, lo = t < 0.5 ? a[0] : a[1], hi = t < 0.5 ? a[1] : a[2], k = t < 0.5 ? t * 2 : t * 2 - 1;
      out.push([lo[0] + (hi[0] - lo[0]) * k, lo[1] + (hi[1] - lo[1]) * k, lo[2] + (hi[2] - lo[2]) * k]);
    }
    return out;
  };
  // Keeps a tile's light and shade, in new colours.
  var recolour = function (g, x, y, w, h, cols) {
    var d = g.getImageData(x, y, w, h), p = d.data, lo = 1, hi = 0, map = ramp(cols), i;
    for (i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 40) continue;
      var v = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    var span = hi - lo < 0.06 ? 1 : hi - lo;
    for (i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      var l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      var c = map[Math.max(0, Math.min(255, Math.round((l - (hi - lo < 0.06 ? 0 : lo)) / span * 255)))];
      p[i] = c[0];
      p[i + 1] = c[1];
      p[i + 2] = c[2];
    }
    g.putImageData(d, x, y);
  };
  // A crystal growing out of a rock: (x, y) its foot, in a tile s wide, lit from the top left.
  var shard = function (g, x, y, w, h, lean, cols, s) {
    var left = x - w / 2, right = x + w / 2, tipX = x + lean, tipY = y - h, shoulderY = y - h * 0.68, midX = x + lean * 0.3;
    var path = function (pts) { g.beginPath(); pts.forEach(function (q, i) { g[i ? 'lineTo' : 'moveTo'](q[0] * s, q[1] * s); }); g.closePath(); };
    path([[left, y], [left + lean * 0.7, shoulderY], [tipX, tipY], [right + lean * 0.7, shoulderY], [right, y], [midX, y + 0.02]]);
    g.lineJoin = 'round';
    g.lineWidth = 0.022 * s;
    g.strokeStyle = 'rgba(12,8,16,0.9)';
    g.stroke();
    g.fillStyle = cols[1];
    g.fill();
    path([[midX, y + 0.02], [midX + lean * 0.5, shoulderY], [tipX, tipY], [right + lean * 0.7, shoulderY], [right, y]]);
    g.fillStyle = cols[0];
    g.fill();
    path([[left + lean * 0.7, shoulderY], [tipX, tipY], [midX + lean * 0.5, shoulderY]]);
    g.fillStyle = cols[2];
    g.fill();
  };
  // Mine tiles in the band's colours. Only this one copy of the sheet is kept: going to another band replaces it.
  var bandTexture = function (w, band) {
    var key = 'indoor-' + B[band].key, tex = w.textures, had = F.mineSheet;
    if (had === key) return key;
    if (had && tex.exists(had)) tex.remove(had);
    F.ensureTexture(w, 'indoor');
    var img = (F.bitmaps && F.bitmaps.indoor) || F.images.indoor, full = tex.get('indoor').source[0].width, iw = img.naturalWidth || img.width, k = iw / full;
    var c = document.createElement('canvas');
    c.width = iw;
    c.height = img.naturalHeight || img.height;
    var g = c.getContext('2d', { willReadFrequently: true }), look = B[band].look, ts = w.map.getTileset('indoor');
    g.drawImage(img, 0, 0);
    var at = function (gid) { var p = ts.getTileTextureCoordinates(gid); return { x: Math.round(p.x * k), y: Math.round(p.y * k), s: Math.round(ts.tileWidth * k) }; };
    var seen = {}, skip = {}, paint = function (gid, cols) {
      if (!gid || seen[gid] || skip[gid]) return;
      seen[gid] = 1;
      var t = at(gid);
      recolour(g, t.x, t.y, t.s, t.s, cols);
    };
    var raw = F.ASSETS.maps.mine, width = raw.width;
    skip[w.gids.ladder_down] = 1;
    raw.layers.forEach(function (l) { // the ladder up, under the way out: it stays wood
      if (l.name !== 'Objects') return;
      l.objects.forEach(function (o) {
        if (o.name !== 'exit') return;
        var walls = raw.layers.filter(function (m) { return m.name === 'Walls'; })[0];
        skip[walls.data[Math.floor(o.y / T) * width + Math.floor(o.x / T)]] = 1;
      });
    });
    raw.layers.forEach(function (l) {
      if (l.name === 'Ground') l.data.forEach(function (gid) { paint(gid, look.floor); });
    });
    paint(w.gids.mine_rock, look.rock);
    raw.layers.forEach(function (l) {
      if (l.name === 'Walls') l.data.forEach(function (gid) { paint(gid, look.wall); });
    });
    var r = at(w.gids.mine_rock);
    g.save();
    g.translate(r.x, r.y);
    g.beginPath();
    g.rect(0, 0, r.s, r.s);
    g.clip();
    shard(g, 0.34, 0.5, 0.2, 0.36, -0.06, look.shard, r.s);
    shard(g, 0.68, 0.56, 0.17, 0.3, 0.07, look.shard, r.s);
    shard(g, 0.5, 0.44, 0.24, 0.42, 0.01, look.shard, r.s);
    g.restore();
    var t = tex.create(key, c, full, full), gt = t.source[0].glTexture;
    if (gt) { gt.width = full; gt.height = full; }
    Phaser.Textures.Parsers.Image(t, 0);
    F.mineSheet = key;
    return key;
  };

  // The lift: its picture (owner, 8 Nov 2026: "lift also need an art"; tools/art/workshop-import.js, the Lair's and the
  // caves' too), or this drawing of a timber shaft with a wheel and a cage on its ropes when the picture is not there.
  var liftTexture = function (w) {
    if (F.images && F.images['props/mine_lift']) return F.ensureTexture(w, 'props/mine_lift');
    if (w.textures.exists('fx-minelift')) return 'fx-minelift';
    var W = 336, H = 440, c = w.textures.createCanvas('fx-minelift', W, H), g = c.getContext();
    var line = '#24140a', timber = function (x, y, tw, th, vertical) {
      var gr = vertical ? g.createLinearGradient(x, 0, x + tw, 0) : g.createLinearGradient(0, y, 0, y + th);
      gr.addColorStop(0, '#b67a3e');
      gr.addColorStop(0.5, '#8e5a2c');
      gr.addColorStop(1, '#5c371a');
      g.fillStyle = gr;
      g.strokeStyle = line;
      g.lineWidth = 6;
      g.beginPath();
      g.rect(x, y, tw, th);
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(40,20,8,0.35)';
      g.lineWidth = 2;
      for (var i = 1; i < 3; i++) {
        g.beginPath();
        if (vertical) { g.moveTo(x + tw * i / 3, y + 6); g.lineTo(x + tw * i / 3 + 2, y + th - 6); } else { g.moveTo(x + 6, y + th * i / 3); g.lineTo(x + tw - 6, y + th * i / 3 + 2); }
        g.stroke();
      }
    };
    // the dark shaft behind
    var dark = g.createLinearGradient(0, 40, 0, H);
    dark.addColorStop(0, '#0c0806');
    dark.addColorStop(1, '#1e140e');
    g.fillStyle = dark;
    g.fillRect(34, 40, W - 68, H - 60);
    // the ropes and the cage hanging on them
    g.strokeStyle = '#d8bf8c';
    g.lineWidth = 5;
    [W / 2 - 34, W / 2 + 34].forEach(function (x) { g.beginPath(); g.moveTo(x, 58); g.lineTo(x, 176); g.stroke(); });
    var cx = 70, cy = 170, cw = W - 140, ch = 214;
    g.fillStyle = 'rgba(70,44,22,0.55)';
    g.fillRect(cx, cy, cw, ch);
    g.strokeStyle = '#a9acb2';
    g.lineWidth = 5;
    for (var bar = 1; bar < 5; bar++) { g.beginPath(); g.moveTo(cx + cw * bar / 5, cy + 10); g.lineTo(cx + cw * bar / 5, cy + ch - 10); g.stroke(); }
    timber(cx - 8, cy - 12, cw + 16, 26, false);
    timber(cx - 8, cy + ch - 14, cw + 16, 28, false);
    // the frame
    timber(14, 34, 44, H - 44, true);
    timber(W - 58, 34, 44, H - 44, true);
    timber(2, 22, W - 4, 40, false);
    // the wheel on top
    var wx = W / 2, wy = 44;
    g.fillStyle = '#3a3c42';
    g.strokeStyle = line;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(wx, wy, 38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#8c9098';
    g.lineWidth = 6;
    for (var sp = 0; sp < 3; sp++) {
      var a = sp * Math.PI / 3;
      g.beginPath();
      g.moveTo(wx - Math.cos(a) * 28, wy - Math.sin(a) * 28);
      g.lineTo(wx + Math.cos(a) * 28, wy + Math.sin(a) * 28);
      g.stroke();
    }
    g.fillStyle = '#c8ccd2';
    g.beginPath();
    g.arc(wx, wy, 9, 0, Math.PI * 2);
    g.fill();
    c.refresh();
    return 'fx-minelift';
  };

  var setupLift = function (w) {
    if (F.session.visit || L.liftStops(F.session.state).length < 2) return;
    var b = LIFT, x = (b.x0 + b.x1 + 1) / 2 * T, foot = (b.y1 + 1) * T;
    w.add.image(x, foot + 0.1 * T, liftTexture(w)).setOrigin(0.5, 1).setDisplaySize(b.w * T, b.h * T).setDepth(w.cursor ? w.cursor.depth - 0.01 : DEPTH.actor); // against the back wall: you are always in front
    w.objects.push({ type: 'lift', name: 'lift', x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, props: {} });
    var zone = w.add.zone(x, (b.y0 + b.y1 + 1) / 2 * T, (b.x1 - b.x0 + 1) * T - 30, (b.y1 - b.y0 + 1) * T - 30);
    w.physics.add.existing(zone, true);
    w.solids.add(zone);
    for (var y = b.y0; y <= b.y1; y++) for (var tx = b.x0; tx <= b.x1; tx++) w.blocked[w.idx(tx, y)] = true;
  };

  var create = P.create;
  P.create = function () {
    var me = F.session && F.session.state, before = me ? me.stats.deepest : 0;
    create.call(this);
    if (this.mapKey !== 'mine') return;
    var floor = F.session.mineFloor, band = L.mineBand(floor);
    if (band) this.map.getTileset('indoor').setImage(this.textures.get(bandTexture(this, band)));
    setupLift(this);
    if (L.mineBand(me.stats.deepest) > L.mineBand(before)) {
      this.time.delayedCall(700, function () {
        if (F.ui) F.ui.toast(B[band].name + '! Your energy bar grew by 10, and the lift now stops here.', 4500, 0x4a2f7a);
      });
    } else if (me.stats.deepest > before && floor > 1 && (floor - 1) % C.MINE.liftEvery === 0 && !F.session.visit) {
      this.time.delayedCall(700, function () { if (F.ui) F.ui.toast('Floor ' + floor.toLocaleString('en-US') + '! The lift now stops here.', 3200, 0x4a2f7a); });
    }
  };

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type === 'lift') return { label: 'Lift', icon: C.ICON.crate, run: function () { F.ui.openLift(); } };
    return extraObjectAction.call(this, o, held, def);
  };

  U.openLift = function (page) {
    var self = this, s = F.session.state, here = F.session.mineFloor;
    var rows = L.liftStops(s).slice().reverse().map(function (floor) { // (the deepest first)
      var band = B[L.mineBand(floor)], at = here === floor;
      return {
        icon: C.ITEMS[band.ids[3]].icon, name: 'Floor ' + floor.toLocaleString('en-US'), desc: band.name + (floor === band.from ? ': its first floor' : ''),
        buttons: [{ label: at ? 'Here' : 'Go', color: at ? HERE : GO, cb: function () {
          if (at) return;
          self.closeModal();
          sfx('ladder');
          F.world.travel('mine', 'entrance', floor);
        } }],
      };
    });
    this.listPanel({ title: 'Mine Lift', rows: rows, page: page || 0, reopen: function (t, p) { self.openLift(p); },
      sub: function () { return 'Stops every ' + C.MINE.liftEvery + ' floors you have reached.'; } });
  };
})(window.Farm = window.Farm || {});
