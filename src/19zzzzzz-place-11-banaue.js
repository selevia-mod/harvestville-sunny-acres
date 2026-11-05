// Banaue Terraces in the world (owner, 6 Nov 2026; the place: src/00-zzzzzzzzzz-place-11-banaue.js).
//  - Its props: the 'place_prop' objects of maps/banaue.json and maps/banaue_cave.json (terrace walls, huts on stilts,
//    tree ferns, rice drying racks, boulders, tall rice grass, the tunnels' mushrooms; F.BANAUE_PROPS). Each is drawn
//    from its own picture (assets/props/<name>, from art-src/places/banaue/props_banaue.png by
//    tools/art/banaue-import.js) once it is in, else from a Wild Lands picture (standIn), else drawn here. Their
//    foot rows are solid, like any prop's.
//  - A place's person who gives something with a line (Lola Bugan, 01-logicZZZZZ-place-11-banaue.js): it says so.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var PROPS = F.BANAUE_PROPS;
  var PX = 96; // canvas pixels a tile, for the drawn stand-ins
  var OUT = '#3d2614';
  var has = function (key) { return !!(F.images && F.images[key]); };

  // ---------- the drawn stand-ins ----------
  var shape = function (g, pts) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); };
  var ink = function (g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 4; g.strokeStyle = OUT; g.stroke(); };
  var rnd = function (seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; };
  var DRAW = {
    // fitted grey stones in three courses, a grassy lip along the top
    banaue_wall: function (g, W, H) {
      var r = rnd(7), top = H * 0.22, rows = 3, rh = (H - top - 4) / rows;
      g.lineJoin = 'round';
      for (var i = 0; i < rows; i++) {
        var x = -r() * 30, y = top + i * rh;
        while (x < W) {
          var w = 44 + r() * 34, c = 150 + Math.floor(r() * 40);
          g.beginPath();
          g.roundRect ? g.roundRect(x + 2, y + 2, w - 4, rh - 4, 10) : g.rect(x + 2, y + 2, w - 4, rh - 4);
          ink(g, 'rgb(' + c + ',' + (c - 4) + ',' + (c - 14) + ')', 3);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(x + 8, y + 6, w * 0.5, 4);
          x += w;
        }
      }
      g.fillStyle = 'rgba(30,20,10,0.25)';
      g.fillRect(0, H - 10, W, 10);
      // the grass on top, hanging a little over the edge
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(W, 0);
      for (var gx = W; gx >= 0; gx -= 12) g.lineTo(gx, top + 4 + (gx / 12 % 2 ? 9 : 0));
      g.closePath();
      ink(g, '#6fbf4a', 3);
      g.fillStyle = '#8fd862';
      g.fillRect(0, 2, W, top * 0.35);
    },
    // a hut on four stilts with a tall pyramid thatched roof
    banaue_hut: function (g, W, H) {
      var cx = W / 2, foot = H - 6, room = H * 0.5;
      g.lineJoin = 'round';
      [0.2, 0.4, 0.6, 0.8].forEach(function (k) { g.beginPath(); g.rect(W * k - 7, room, 14, foot - room); ink(g, '#7a5232', 3); });
      g.beginPath(); g.rect(W * 0.12, room - 12, W * 0.76, 16); ink(g, '#8f6438', 3); // the floor beam
      g.beginPath(); g.rect(W * 0.18, room - H * 0.14, W * 0.64, H * 0.14); ink(g, '#a8784a', 3); // the walls
      g.beginPath(); g.rect(cx - 14, room - H * 0.12, 28, H * 0.11); ink(g, '#4a2e18', 3); // the door
      shape(g, [[cx, 8], [W * 0.98, room - H * 0.12], [W * 0.02, room - H * 0.12]]);
      ink(g, '#c9a24a', 4);
      g.strokeStyle = 'rgba(110,70,20,0.55)';
      g.lineWidth = 3;
      for (var i = 1; i < 7; i++) { var y = 8 + (room - H * 0.12 - 8) * i / 7; g.beginPath(); g.moveTo(cx - (y - 8) * 0.62, y); g.lineTo(cx + (y - 8) * 0.62, y); g.stroke(); }
      g.beginPath(); g.moveTo(cx, 2); g.lineTo(cx, 14); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    },
    // a tree fern: a thin scaly trunk, a big crown of lacy fronds
    banaue_fern: function (g, W, H) {
      var cx = W / 2, top = H * 0.36;
      g.beginPath(); g.moveTo(cx - 9, H - 4); g.quadraticCurveTo(cx - 13, H * 0.62, cx - 4, top); g.lineTo(cx + 6, top); g.quadraticCurveTo(cx + 2, H * 0.62, cx + 9, H - 4); g.closePath();
      ink(g, '#6b4a2c', 3);
      for (var i = 0; i < 13; i++) {
        var a = Math.PI * (1.0 + i / 12), len = W * (0.42 + (i % 3) * 0.04), ex = cx + Math.cos(a) * len, ey = top + Math.sin(a) * len * 0.55 + len * 0.32;
        var mx = (cx + ex) / 2, my = Math.min(top, ey) - len * 0.3;
        g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(mx, my, ex, ey);
        g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
        for (var k = 1; k < 9; k++) { // leaflets along the frond, both sides
          var t = k / 9, u = 1 - t, px = u * u * cx + 2 * u * t * mx + t * t * ex, py = u * u * top + 2 * u * t * my + t * t * ey, s = 11 * (1 - t * 0.6);
          g.beginPath(); g.ellipse(px, py, s, s * 0.42, a + 1.4, 0, Math.PI * 2);
          g.fillStyle = i % 2 ? '#4f9a3a' : '#6cbc4c'; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = 'rgba(40,60,20,0.6)'; g.stroke();
        }
      }
    },
    // a wooden drying rack hung with golden rice bundles
    banaue_rack: function (g, W, H) {
      g.lineJoin = 'round';
      [0.1, 0.9].forEach(function (k) { g.beginPath(); g.rect(W * k - 6, 10, 12, H - 14); ink(g, '#7a5232', 3); });
      [0.22, 0.55].forEach(function (k) { g.beginPath(); g.rect(4, H * k, W - 8, 10); ink(g, '#8f6438', 3); });
      [0.22, 0.55].forEach(function (k) {
        for (var x = W * 0.2; x < W * 0.85; x += W * 0.13) {
          var y = H * k + 10;
          shape(g, [[x - 8, y], [x + 8, y], [x + 13, y + H * 0.26], [x - 13, y + H * 0.26]]);
          ink(g, '#e8c24a', 3);
          g.strokeStyle = 'rgba(150,100,20,0.6)'; g.lineWidth = 2;
          for (var s = -8; s <= 8; s += 5) { g.beginPath(); g.moveTo(x + s * 0.5, y + 4); g.lineTo(x + s, y + H * 0.24); g.stroke(); }
        }
      });
    },
    banaue_boulder: function (g, W, H) {
      g.beginPath(); g.ellipse(W / 2, H * 0.58, W * 0.46, H * 0.4, 0, 0, Math.PI * 2); ink(g, '#9a9a8e', 4);
      g.beginPath(); g.ellipse(W * 0.42, H * 0.36, W * 0.24, H * 0.14, -0.3, 0, Math.PI * 2); g.fillStyle = '#6aa848'; g.fill();
    },
    banaue_grass: function (g, W, H) {
      for (var i = 0; i < 11; i++) {
        var x = W * (0.12 + i * 0.07), lean = (i - 5) * 3;
        g.beginPath(); g.moveTo(x - 5, H - 2); g.quadraticCurveTo(x + lean, H * 0.5, x + lean * 2, 6 + (i % 3) * 10); g.quadraticCurveTo(x + lean, H * 0.55, x + 5, H - 2); g.closePath();
        ink(g, i % 2 ? '#5aa83c' : '#74c04e', 2.5);
      }
    },
    // little glowing mushrooms by the tunnel walls
    banaue_shroom: function (g, W, H) {
      [[0.3, 0.75, 1], [0.62, 0.68, 1.3], [0.48, 0.86, 0.8]].forEach(function (m) {
        var x = W * m[0], y = H * m[1], s = 12 * m[2];
        var gl = g.createRadialGradient(x, y - s, 0, x, y - s, s * 3);
        gl.addColorStop(0, 'rgba(160,255,190,0.55)'); gl.addColorStop(1, 'rgba(160,255,190,0)');
        g.fillStyle = gl; g.fillRect(x - s * 3, y - s * 4, s * 6, s * 6);
        g.beginPath(); g.rect(x - s * 0.3, y - s, s * 0.6, s); ink(g, '#e8e0c8', 2);
        g.beginPath(); g.ellipse(x, y - s, s, s * 0.6, 0, Math.PI, 0); g.closePath(); ink(g, '#8ef0b0', 2);
      });
    },
  };
  // The texture for a prop: its own picture, the stand-in picture, or one drawn here (once a session).
  var propTexture = function (w, name) {
    var d = PROPS[name];
    if (!d.drawnOnly && has('props/' + name)) return { key: F.ensureTexture(w, 'props/' + name), own: true };
    if (d.standIn && has(d.standIn)) return { key: F.ensureTexture(w, d.standIn), own: true };
    var key = 'fx-' + name;
    if (!w.textures.exists(key)) {
      var c = w.textures.createCanvas(key, Math.round(d.w * PX), Math.round(d.h * PX));
      DRAW[name](c.getContext(), c.width, c.height);
      c.refresh();
    }
    return { key: key, own: false };
  };

  // ---------- its props on its two maps ----------
  var mine = function (map) { return L.placeOf(map) === 'banaue'; };
  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (!mine(this.mapKey)) return;
    var self = this, list = this.objects.filter(function (o) { return o.type === 'place_prop' && PROPS[o.name]; });
    this.objects = this.objects.filter(function (o) { return o.type !== 'place_prop'; }); // (never what you face: the 'wild' zone is)
    list.forEach(function (o) { self.addPlaceProp(o); });
  };
  P.addPlaceProp = function (o) {
    var self = this, d = PROPS[o.name], tex = propTexture(this, o.name), bottom = (o.y1 + 1) * T, cols = o.x1 - o.x0 + 1;
    // a wall longer than one section is drawn in sections of 3 tiles (two of 2 for 4, the last one shorter)
    var parts = [], left = o.name === 'banaue_wall' ? cols : 1;
    while (left > 0) { var n = left === 4 ? 2 : Math.min(3, left); parts.push(n); left -= n; }
    var x = o.x0;
    parts.forEach(function (n) {
      var span = o.name === 'banaue_wall' ? n : cols, wpx = (o.name === 'banaue_wall' ? n : d.w) * T, img = self.add.image((x + span / 2) * T, bottom, tex.key).setOrigin(0.5, 1);
      img.setDisplaySize(wpx, tex.own ? (o.name === 'banaue_wall' ? d.w * T : wpx) * img.height / img.width : d.h * T); // (a wall's sections all as tall as a whole one)
      F.depthTo(img, DEPTH.actor + bottom / 1e5);
      self.props.push(img);
      x += span;
    });
    var foot = (o.props && o.props.foot) || 0;
    if (!foot) return;
    for (var y = o.y1 - foot + 1; y <= o.y1; y++) for (var tx = o.x0; tx <= o.x1; tx++) this.blocked[this.idx(tx, y)] = true;
    var zone = this.add.zone((o.x0 + cols / 2) * T, bottom - foot * T / 2 + 8, cols * T - 16, foot * T - 16);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  };

  // ---------- a person's gift: said as it is given ----------
  var talkPlaceNpc = P.talkPlaceNpc;
  P.talkPlaceNpc = function () {
    var got = null, talk = L.talkNpc;
    L.talkNpc = function (s, id) { got = talk(s, id); return got; };
    try { talkPlaceNpc.call(this); } finally { L.talkNpc = talk; }
    if (got && got.gift && F.ui) {
      var name = this.placeNpc.p.npc.name;
      if (F.Audio) F.Audio.sfx('coin');
      F.ui.toast(name + ' gave you ' + L.giftWords(got.gift) + '.' + (got.basket ? ' Some went to your basket at home.' : ''), 3200, 0x2f5a22);
    }
  };
})(window.Farm = window.Farm || {});
