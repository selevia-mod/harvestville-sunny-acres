// Manila in the world (owner, 11 Nov 2026; content 00-zzzzzzzzzzzzzzzzzzz-manila.js, rules 01-logicZZZZZZZZZZZZZZ-manila.js).
// - The map is built here at load from the layout (L.manilaMap), so the page carries no Manila map. The town gets the
//   valley road east (a walk-through warp over its last 2 tiles, x 52-53: a visitor waiting at the very end cannot block
//   it) and a spot to come back to (from_manila).
// - The ground's own sheet, 'manila_ground': drawn here on a canvas (cobbles, plaza tiles, the bay walk, the bay, old
//   stone, the track, the rails), with the owner's ground textures painted in once they are on the phone (the pack's
//   manila_tex_<slot>).
// - Buildings and props: their own pictures from the pack (props/manila_<art>), else a town picture scaled into the box
//   with a small name label. Their foot is solid; looking at one says what it is ("Coming soon" for the shops).
// - The 7 city people walk between their spots by the hour and wander a little; Talk to them. Their own sheets come in the
//   pack (npc_<name>); until then they wear the train visitors' looks, tinted.
// - The train: Willowbrook Station's Manila tab, and the station door in Manila. The valley road: walk off the town's
//   east end; come back out the Plains Gate. (The horse rule: L.manilaRoad.)
// - Cheap phones: the tilemap draws only what is in view; still pictures are culled (19zzzz-perf.js); the labels and
//   name tags are culled here; nothing new over 4096 px (the drawn ground is 680 x 272).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var M = C.MANILA;
  var G = M.GROUND;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var me = function () { return F.session && F.session.state; };
  if (!M || !M.on) return;

  C.TIPS.push({ key: 'manila_hello', text: 'MANILA' }); // (appended last: a tip is its place in a saved number)

  // ---------- the map, and the town's valley road ----------
  var maps = F.ASSETS && F.ASSETS.maps;
  if (maps && maps.town) {
    maps.manila = L.manilaMap(maps.town);
    var og = maps.town.layers.filter(function (l) { return l.type === 'objectgroup'; })[0];
    if (og && !og.objects.some(function (o) { return o.name === 'road_east'; })) {
      og.objects.push({ id: 90001, name: 'road_east', type: 'warp', x: 52 * T, y: 11 * T, width: 2 * T, height: 2 * T, rotation: 0, visible: true,
        properties: [{ name: 'to', type: 'string', value: 'manila' }, { name: 'spawn', type: 'string', value: 'from_valley' }, { name: 'walk', type: 'bool', value: true }] });
      og.objects.push({ id: 90002, name: 'from_manila', type: 'place', point: true, x: Math.round(51.3 * T), y: Math.round(11.6 * T), width: 0, height: 0, rotation: 0, visible: true,
        properties: [{ name: 'dir', type: 'string', value: 'left' }] });
    }
  }
  // the people's own sheets, when they come (9 frames like a villager's)
  M.people.order.forEach(function (k) { if (F.SHEETS && F.SHEETS.people) F.SHEETS[M.people[k].sheet] = F.SHEETS.people; });
  // the pack: its name for the Downloads page, once it has anything in it (tools/manila/manila-import.js)
  if (F.PACK_INFO && F.packFiles && F.packFiles('manila').length) {
    F.PACK_INFO.manila = { name: 'Manila', icon: 'star', desc: "Manila's own pictures: its buildings, its people and its ground." };
  }

  // ---------- the ground sheet: drawn, with the owner's textures painted in when they are here ----------
  var TEX = function (slot) { return 'manila_tex_' + slot; };
  var drawGround = function () {
    var half = 2, S = G.SIZE / half, MG = G.MARGIN / half, SP = G.SPACING / half;
    var cv = document.createElement('canvas');
    cv.width = G.IMAGE_W / half;
    cv.height = G.IMAGE_H / half;
    var g = cv.getContext('2d'), seed = 1111;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var one = document.createElement('canvas');
    one.width = one.height = S;
    var o = one.getContext('2d');
    var stones = function (base, dark, light, moss) {
      o.fillStyle = dark;
      o.fillRect(0, 0, S, S);
      var rows = 6, rh = S / rows;
      for (var r = 0; r < rows; r++) {
        var x = -((r % 2) * rh * 0.6);
        while (x < S) {
          var w = rh * (0.9 + rnd() * 0.7);
          o.fillStyle = base;
          o.beginPath();
          if (o.roundRect) o.roundRect(x + 1.5, r * rh + 1.5, w - 3, rh - 3, rh * 0.35); else o.rect(x + 1.5, r * rh + 1.5, w - 3, rh - 3);
          o.fill();
          o.fillStyle = light;
          o.fillRect(x + 4, r * rh + 3, w * 0.45, 2);
          if (moss && rnd() < 0.18) { o.fillStyle = moss; o.fillRect(x + w - 4, r * rh + rh - 4, 4, 3); }
          x += w;
        }
      }
    };
    var TILES = [
      function () { stones('#c8bba4', '#8f8372', '#ddd3c0', '#7e9a5a'); }, // cobble
      function () { stones('#bfb19a', '#877a68', '#d4c8b2', '#6f9150'); }, // cobble2
      function () { o.fillStyle = '#efe0bf'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(150,110,70,0.35)'; o.lineWidth = 3; o.strokeRect(1.5, 1.5, S - 3, S - 3); }, // plaza (cream)
      function () { o.fillStyle = '#d99a6a'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(120,60,30,0.35)'; o.lineWidth = 3; o.strokeRect(1.5, 1.5, S - 3, S - 3); }, // plaza2 (terracotta)
      function () { // the bay walk: long pale slabs, a little round tile
        o.fillStyle = '#e6d8b8'; o.fillRect(0, 0, S, S);
        o.fillStyle = 'rgba(150,120,80,0.35)';
        for (var y = 0; y < S; y += S / 4) o.fillRect(0, y, S, 2);
        for (var k = 0; k < 4; k++) o.fillRect(((k * 37) % S), k * S / 4, 2, S / 4);
        o.fillStyle = '#e48a4a'; o.beginPath(); o.arc(S * 0.75, S * 0.38, 7, 0, 7); o.fill();
        o.fillStyle = '#4a8ac8'; o.beginPath(); o.arc(S * 0.75, S * 0.38, 3.5, 0, 7); o.fill();
      },
      function () { o.fillStyle = '#2f8096'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(190,235,240,0.45)'; o.lineWidth = 2; for (var k = 0; k < 6; k++) { var x = rnd() * S, y = rnd() * S; o.beginPath(); o.moveTo(x, y); o.quadraticCurveTo(x + 9, y - 5, x + 18, y); o.stroke(); } }, // bay
      function () { o.fillStyle = '#2f8096'; o.fillRect(0, 0, S, S); o.fillStyle = 'rgba(255,255,230,0.7)'; for (var k = 0; k < 5; k++) o.fillRect(rnd() * S, rnd() * S, 3, 2); o.strokeStyle = 'rgba(190,235,240,0.35)'; o.lineWidth = 2; o.beginPath(); o.moveTo(10, 80); o.quadraticCurveTo(30, 72, 50, 80); o.stroke(); }, // bay2
      function () { // old stone wall: big blocks, a lit top
        o.fillStyle = '#857a68'; o.fillRect(0, 0, S, S);
        for (var r = 0; r < 4; r++) for (var c = -1; c < 3; c++) { o.fillStyle = (r + c) % 2 ? '#b3a68e' : '#a89a82'; o.fillRect(c * S / 2 + (r % 2) * S / 4 + 2, r * S / 4 + 2, S / 2 - 4, S / 4 - 4); }
        o.fillStyle = 'rgba(255,245,220,0.25)'; o.fillRect(0, 0, S, 6);
      },
      function () { o.fillStyle = '#c9a36f'; o.fillRect(0, 0, S, S); o.fillStyle = 'rgba(110,75,40,0.35)'; for (var k = 0; k < 40; k++) o.fillRect(rnd() * S, rnd() * S, 3, 2); }, // track
      function () { // the rails: gravel, sleepers, two rails along
        o.fillStyle = '#9a9184'; o.fillRect(0, 0, S, S);
        o.fillStyle = 'rgba(60,50,40,0.3)'; for (var k = 0; k < 50; k++) o.fillRect(rnd() * S, rnd() * S, 3, 3);
        o.fillStyle = '#6e4a2c'; for (var x = 6; x < S; x += S / 4) o.fillRect(x, S * 0.18, S / 8, S * 0.64);
        o.fillStyle = '#c7ccd2'; o.fillRect(0, S * 0.3, S, 6); o.fillRect(0, S * 0.62, S, 6);
      },
    ];
    // the owner's ground pictures (the pack's manila_tex_<slot>): a tile, and its twin moved by half (it wraps)
    var tex = function (slot, shift) {
      var img = F.images && F.images[TEX(slot)];
      if (!img) return false;
      o.imageSmoothingQuality = 'high';
      if (!shift) { o.drawImage(img, 0, 0, S, S); return true; }
      [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach(function (q) { o.drawImage(img, S / 2 + q[0] * S, S / 2 + q[1] * S, S, S); });
      return true;
    };
    var OWN = [['cobble'], ['cobble', 1], ['plaza'], ['plaza'], ['baywalk'], ['bay'], ['bay', 1]];
    TILES.forEach(function (draw, i) {
      o.clearRect(0, 0, S, S);
      if (!(OWN[i] && tex(OWN[i][0], OWN[i][1]))) draw();
      var x = MG + (i % G.COLS) * (S + SP), y = MG + Math.floor(i / G.COLS) * (S + SP);
      g.drawImage(one, x - MG, y - MG, S + 2 * MG, S + 2 * MG); // (into the margin too: no seams between tiles)
      g.drawImage(one, x, y);
    });
    return cv;
  };
  // The ground sheet for this visit: drawn again (and the old one let go) when more of the owner's textures came in.
  var groundSig = null;
  var groundReady = function (scene) {
    var sig = Object.keys(M.art.ground).filter(function (k) { return F.images && F.images[TEX(k)]; }).join(',');
    if (F.images[G.NAME] && sig === groundSig) return;
    groundSig = sig;
    if (scene.textures.exists(G.NAME)) scene.textures.remove(G.NAME);
    F.images[G.NAME] = drawGround();
    F.sizes = F.sizes || {};
    F.sizes[G.NAME] = [G.IMAGE_W, G.IMAGE_H];
  };

  var buildMap = P.buildMap;
  P.buildMap = function () {
    if (this.mapKey === 'manila') { this.outdoors = true; groundReady(this); }
    return buildMap.apply(this, arguments);
  };
  var musicMood = P.musicMood;
  P.musicMood = function () {
    var m = musicMood.apply(this, arguments);
    return this.mapKey === 'manila' && m !== 'night' && m !== 'festival' ? 'town' : m;
  };

  // ---------- buildings and props ----------
  var LABEL = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '104px', fontStyle: 'bold', color: '#fff6e0', stroke: '#3d2614', strokeThickness: 16 };
  P.mnDrawProp = function (o) {
    var p = o.props, own = p.art && F.images && F.images['props/manila_' + p.art] ? 'props/manila_' + p.art : null;
    var key = own || (/^tw_/.test(p.stand) ? p.stand : 'props/' + p.stand);
    if (!F.images[key]) return null;
    F.ensureTexture(this, key);
    // its own shape (128 px a tile), fitted into the box, standing on its bottom
    var pw = (o.x1 - o.x0 + 1) * T, ph = (o.y1 - o.y0 + 1) * T, left = o.x0 * T, bottom = (o.y1 + 1) * T;
    var fr = this.textures.getFrame(key), nw = fr.realWidth * 2, nh = fr.realHeight * 2, k = Math.min(pw / nw, ph / nh), dw = nw * k, dh = nh * k;
    var img = this.add.image(left + (pw - dw) / 2, bottom, key).setOrigin(0, 1).setDisplaySize(dw, dh);
    F.depthTo(img, DEPTH.actor + bottom / 1e5);
    if (!own && p.tint) img.setTint(p.tint);
    this.props.push(img);
    // its foot: solid
    var foot = Math.min(o.y1 - o.y0 + 1, p.foot || 0);
    if (foot > 0) {
      for (var y = o.y1 - foot + 1; y <= o.y1; y++) for (var x = o.x0; x <= o.x1; x++) this.blocked[this.idx(x, y)] = true;
      var zone = this.add.zone(left + pw / 2, bottom - foot * T / 2 + 8, pw - 16, foot * T - 16);
      this.physics.add.existing(zone, true);
      this.solids.add(zone);
    }
    if (!own && p.label) this.mn.labels.push(this.add.text(left + pw / 2, bottom - dh - 0.05 * T, p.label, LABEL).setOrigin(0.5, 1).setDepth(DEPTH.fx));
    return { type: 'mn_spot', name: o.name, x0: o.x0, y0: o.y1 - Math.max(1, foot) + 1, x1: o.x1, y1: o.y1, props: p };
  };

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.apply(this, arguments);
    this.mn = null;
    if (this.mapKey !== 'manila') return;
    var self = this, spots = [];
    this.mn = { labels: [], people: [], cullMs: 0, schedMs: 0 };
    this.objects = this.objects.filter(function (o) {
      if (o.type !== 'mn_prop') return true;
      var spot = self.mnDrawProp(o);
      if (spot && (spot.props.text || spot.props.station || spot.props.who)) spots.push(spot);
      return false;
    }).concat(spots);
    this.mn.grid = L.manilaGrid(maps.manila);
    this.mnPeople();
    var s = this.state;
    if (!(window.gameHost && window.gameHost.quiet) && L.takeTip(s, 'manila_hello')) {
      this.save();
      this.time.delayedCall(700, function () {
        if (F.ui) F.ui.dialog('WELCOME TO MANILA\nThe big city by the bay! The Central Plaza is in the middle, the station up north, the Grand Market east and the port by the bay.\n\nThe shops and the hunting grounds open soon. Say hello to the people!');
      });
    } else if (F.ui) this.time.delayedCall(500, function () { if (F.ui) F.ui.toast('Manila', 1600); });
  };

  // ---------- the city people ----------
  var WALK = 1.7 * T; // world units a second
  var CHEAP = !!(F.cheapPhone && F.cheapPhone()); // (an OPPO A5-class phone: the people wander half as often)
  var IDLE = { down: 0, up: 3, left: 6, right: 6 };
  var spotXY = function (name) { var p = M.spots[name]; return p ? { x: p[0] * T, y: p[1] * T } : null; };
  var lookOf = function (def) {
    if (F.images && F.images[def.sheet]) return { key: def.sheet, row: 0, tint: 0 };
    return { key: 'tw_people', row: def.look[0], tint: def.look[1] };
  };
  P.mnPeople = function () {
    var self = this, s = this.state;
    M.people.order.forEach(function (k) {
      var def = M.people[k], look = lookOf(def);
      F.ensureTexture(self, look.key);
      ['down', 'up', 'side'].forEach(function (d, j) {
        var f = look.row * 9 + j * 3, ak = 'mn-' + k + '-' + look.key + '-' + d;
        if (!self.anims.exists(ak)) self.anims.create({ key: ak, frames: self.anims.generateFrameNumbers(look.key, { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
      });
      var spot = L.manilaSpot(k, s.time), at = spotXY(spot) || spotXY('plaza_s');
      var sp = self.add.sprite(at.x, at.y, look.key, look.row * 9).setOrigin(0.5, 0.83).setScale(2);
      if (look.tint) sp.setTint(look.tint);
      self.physics.add.existing(sp);
      sp.body.setSize(60, 30).setOffset(34, 145).setImmovable(true);
      sp.body.moves = false;
      self.physics.add.collider(self.player, sp);
      var tag = self.add.text(at.x, at.y - 1.75 * T, def.name, LABEL).setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(0.7);
      var v = { key: k, def: def, look: look, sp: sp, tag: tag, x: at.x, y: at.y, spot: spot, path: [], hold: 0, wander: 3000 + Math.random() * 5000, dir: 'down', talks: 0 };
      self.mnPlace(v);
      self.mn.people.push(v);
    });
  };
  P.mnPlace = function (v) {
    v.sp.setPosition(v.x, v.y);
    F.depthTo(v.sp, DEPTH.actor + v.y / 1e5);
    v.sp.body.updateFromGameObject();
    v.tag.setPosition(v.x, v.y - 1.75 * T);
  };
  P.mnFace = function (v, dir) {
    v.dir = dir;
    v.sp.anims.stop();
    v.sp.setFrame(v.look.row * 9 + IDLE[dir]).setFlipX(dir === 'right');
  };
  P.mnGo = function (v, tx, ty) {
    var g = this.mn.grid, fx = Math.floor(v.x / T), fy = Math.floor(v.y / T);
    if (fx === tx && fy === ty) return;
    var path = L.manilaPath(g, fx, fy, tx, ty, 9000);
    if (path) v.path = path;
    else { v.x = (tx + 0.5) * T; v.y = (ty + 0.6) * T; v.path = []; this.mnPlace(v); } // (somewhere it cannot walk from: there at once)
  };
  P.mnUpdatePeople = function (dt) {
    var self = this, s = this.state, mn = this.mn, g = mn.grid;
    mn.schedMs -= dt;
    var check = mn.schedMs <= 0;
    if (check) mn.schedMs = 2000;
    mn.people.forEach(function (v) {
      if (check) {
        var spot = L.manilaSpot(v.key, s.time);
        if (spot !== v.spot && spotXY(spot)) { v.spot = spot; var p = M.spots[spot]; self.mnGo(v, Math.floor(p[0]), Math.floor(p[1])); }
      }
      if (v.hold > 0) { v.hold -= dt; return; }
      if (!v.path.length) {
        v.wander -= dt;
        if (v.wander > 0) return;
        v.wander = (5000 + Math.random() * 7000) * (CHEAP ? 2 : 1);
        var home = M.spots[v.spot];
        if (!home) return;
        var hx = Math.floor(home[0]), hy = Math.floor(home[1]), tries = 6;
        while (tries--) {
          var tx = hx + Math.round(Math.random() * 4 - 2), ty = hy + Math.round(Math.random() * 4 - 2);
          if (g.ok(tx, ty)) { self.mnGo(v, tx, ty); break; }
        }
        return;
      }
      var n = v.path[0], gx = (n[0] + 0.5) * T, gy = (n[1] + 0.6) * T, dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy), step = WALK * dt / 1000;
      // (the farmer standing in the way: wait a moment)
      var f = self.feet();
      if (Math.hypot(f.x - gx, f.y - gy) < 0.6 * T) { v.hold = 600; if (v.sp.anims.isPlaying) self.mnFace(v, v.dir); return; }
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (d <= step) { v.x = gx; v.y = gy; v.path.shift(); } else { v.x += dx / d * step; v.y += dy / d * step; }
      var ak = 'mn-' + v.key + '-' + v.look.key + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir);
      if (v.sp.anims.currentAnim == null || v.sp.anims.currentAnim.key !== ak || !v.sp.anims.isPlaying) v.sp.play(ak);
      v.sp.setFlipX(dir === 'right');
      v.dir = dir;
      self.mnPlace(v);
      if (!v.path.length) self.mnFace(v, dir);
    });
  };
  P.mnPersonAt = function (x, y) {
    var best = null, bd = 0.9 * T;
    ((this.mn && this.mn.people) || []).forEach(function (v) { var d = Math.hypot(v.x - x, v.y - 0.3 * T - y); if (d < bd) { bd = d; best = v; } });
    return best;
  };
  P.mnTalk = function (v) {
    var s = this.state, f = this.feet(), r = L.manilaTalk(s, v.key, v.talks++);
    if (!r) return;
    v.hold = 4000;
    v.path = [];
    this.mnFace(v, Math.abs(f.x - v.x) > Math.abs(f.y - v.y) ? (f.x > v.x ? 'right' : 'left') : f.y < v.y ? 'up' : 'down');
    sfx('talk');
    F.ui.dialog(v.def.name.toUpperCase() + '\n' + (r.first ? '(' + v.def.role + ')\n' : '') + r.text);
    if (r.first) this.save();
  };

  // ---------- the frame ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (!this.mn || this.busy) return;
    var dt = Math.min(delta, 100), mn = this.mn;
    this.mnUpdatePeople(dt);
    mn.cullMs -= dt;
    if (mn.cullMs > 0) return;
    mn.cullMs = 300;
    // the labels and name tags: only near the view (the camera's middle, about a screen and a half round it)
    var cam = this.cameras.main, cx = cam.midPoint.x, cy = cam.midPoint.y, rx = cam.width / cam.zoom * 0.9 + 3 * T, ry = cam.height / cam.zoom * 0.9 + 3 * T;
    var near = function (o) { return Math.abs(o.x - cx) < rx && Math.abs(o.y - cy) < ry; };
    mn.labels.forEach(function (t) { t.setVisible(near(t)); });
    mn.people.forEach(function (v) { v.tag.setVisible(near(v.tag)); });
  };

  // ---------- the action button ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mn) {
      var self = this, pt = this.front(0.7), v = this.mnPersonAt(pt.x, pt.y);
      if (v) return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.mnTalk(v); } };
    }
    return resolve.apply(this, arguments);
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (this.mapKey === 'manila') {
      if (o.type === 'mn_spot' && o.props.station) return { label: 'Train', icon: C.ICON.calendar, run: function () { F.ui.mnTrain('town'); } };
      if (o.type === 'mn_spot' && o.props.text) return { label: 'Look', icon: -1, run: function () { F.ui.dialog((o.props.label || 'Manila').toUpperCase() + '\n' + o.props.text); } };
      if (o.type === 'mn_gate') return { label: 'Gate', icon: -1, run: function () { F.ui.dialog(o.props.text); } };
      if (o.type === 'mn_rails') return null;
    }
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- going there: the valley road, and the pack ----------
  var travel = P.travel;
  P.travel = function (to, spawn) {
    if (to === 'manila' && !this.busy) {
      var s = this.state, why = F.session.visit ? 'Manila is for your own game: go there from your own town.' : null;
      if (!why && spawn === 'from_valley') { var r = L.manilaRoad(s, !!F.session.riding); if (!r.ok) why = r.why; }
      if (why) {
        if (F.ui) F.ui.toast(why, 2600);
        var back = this.points.from_manila;
        if (spawn === 'from_valley' && back) this.setFeet(back.x, back.y); // (off the road's end, or it would take you again)
        return;
      }
      // the city's own pictures: in first if they are on the phone (a moment); else the stand-ins (they wait in Downloads)
      if (F.packFiles && F.packFiles('manila').length && !F.packReady('manila') && F.packOnPhone('manila')) {
        if (this.mnGate) return;
        var self = this, args = arguments;
        this.mnGate = true;
        return F.loadPack('manila').then(function () { self.mnGate = false; if (self.sys && self.sys.isActive()) travel.apply(self, args); });
      }
    }
    return travel.apply(this, arguments);
  };

  // ---------- the train ----------
  // Willowbrook Station's panel gets a Manila tab; it opens the ticket (as Manila Central's door does).
  var twTabs = U.twTabs;
  U.twTabs = function (s) {
    var t = twTabs.apply(this, arguments);
    if (!F.session.visit) t = t.concat([['manila', 'Manila']]);
    return t;
  };
  var openStation = U.openStation;
  U.openStation = function (tab) {
    if (tab === 'manila') return this.mnTrain('manila');
    return openStation.apply(this, arguments);
  };
  U.mnTrain = function (to) {
    var self = this, s = me(), w = F.world;
    if (!s || !w) return;
    if (F.session.visit) return this.dialog('THE TRAIN\nRide the train from your own game.');
    var fare = L.manilaFare(s), there = to === 'manila';
    var head = there ? 'TRAIN TO MANILA\nThe big city by the bay: the Central Plaza, the Grand Market, the old walled quarter and the port.'
      : 'MANILA CENTRAL\nThe train home to Willowbrook Station.';
    var price = fare ? 'A ticket is ' + fmt(fare) + 'G one way. You have ' + fmt(s.gold) + 'G.' : 'Your first ride is free!';
    var road = there ? '\n\n(Or walk the valley road: east out of town, past Market Street.)' : '\n\n(Or walk the valley road home: out the Plains Gate, east.)';
    this.dialog(head + '\n\n' + price + road, [
      { label: 'Not now', color: GREY },
      { label: fare ? 'Ride ' + fmt(fare) + 'G' : 'Ride free', color: GREEN, cb: function () {
        var r = L.manilaRide(s);
        if (!r.ok) { sfx('nope'); return self.toast('A ticket is ' + fmt(r.fare) + 'G. You have ' + fmt(s.gold) + 'G.', 2600); }
        sfx(r.fare ? 'coin' : 'pick');
        F.bus.emit('hud');
        self.toast('All aboard! Next stop: ' + (there ? 'Manila Central.' : 'Willowbrook.'), 2200);
        if (F.world) F.world.travel(to, there ? 'from_train' : 'platform_w');
      } },
    ]);
  };
})(window.Farm = window.Farm || {});
