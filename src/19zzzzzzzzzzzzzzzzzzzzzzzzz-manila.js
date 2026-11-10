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
    if (maps.house_1 && L.mallMap) maps.mall = L.mallMap(maps.house_1); // (the Mall inside: city life)
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
  M.crowd.looks.forEach(function (l) { if (F.SHEETS && F.SHEETS.people && !F.SHEETS[l[0]]) F.SHEETS[l[0]] = F.SHEETS.people; });
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
    var speck = function (base, dot, n) { o.fillStyle = base; o.fillRect(0, 0, S, S); o.fillStyle = dot; for (var k = 0; k < n; k++) o.fillRect(rnd() * S, rnd() * S, 2, 2); };
    var DRAW = {
      cobble: function () { stones('#c8bba4', '#8f8372', '#ddd3c0', '#7e9a5a'); },
      cobble2: function () { stones('#bfb19a', '#877a68', '#d4c8b2', '#6f9150'); },
      plaza: function (j) { o.fillStyle = (j % 3 + Math.floor(j / 3)) % 2 ? '#d99a6a' : '#efe0bf'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(150,110,70,0.3)'; o.lineWidth = 3; o.strokeRect(1.5, 1.5, S - 3, S - 3); },
      asphalt: function () { speck('#5d6168', 'rgba(255,255,255,0.12)', 60); },
      sidewalk: function () { o.fillStyle = '#c9c5bb'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(90,85,75,0.35)'; o.lineWidth = 2; o.strokeRect(1, 1, S / 2 - 1, S / 2 - 1); o.strokeRect(S / 2, 1, S / 2 - 1, S / 2 - 1); o.strokeRect(1, S / 2, S / 2 - 1, S / 2 - 1); o.strokeRect(S / 2, S / 2, S / 2 - 1, S / 2 - 1); },
      concrete: function () { speck('#d8d4ca', 'rgba(80,75,65,0.12)', 30); o.strokeStyle = 'rgba(90,85,75,0.18)'; o.lineWidth = 2; o.strokeRect(1, 1, S - 2, S - 2); },
      cross_h: function () { speck('#5d6168', 'rgba(255,255,255,0.1)', 40); o.fillStyle = '#f1efe6'; for (var y = 6; y < S; y += S / 5) o.fillRect(6, y, S - 12, S / 10); },
      cross_v: function () { speck('#5d6168', 'rgba(255,255,255,0.1)', 40); o.fillStyle = '#f1efe6'; for (var x = 6; x < S; x += S / 5) o.fillRect(x, 6, S / 10, S - 12); },
      lane_n: function () { DRAW.asphalt(); o.fillStyle = '#f2c94a'; for (var x = 4; x < S; x += S / 2) o.fillRect(x, S - 3, S / 4, 3); },
      lane_s: function () { DRAW.asphalt(); o.fillStyle = '#f2c94a'; for (var x = 4; x < S; x += S / 2) o.fillRect(x, 0, S / 4, 3); },
      lane_w: function () { DRAW.asphalt(); o.fillStyle = '#f2c94a'; for (var y = 4; y < S; y += S / 2) o.fillRect(S - 3, y, 3, S / 4); },
      lane_e: function () { DRAW.asphalt(); o.fillStyle = '#f2c94a'; for (var y = 4; y < S; y += S / 2) o.fillRect(0, y, 3, S / 4); },
      baywalk: function () { // the bay walk: long pale slabs, a little round tile
        o.fillStyle = '#e6d8b8'; o.fillRect(0, 0, S, S);
        o.fillStyle = 'rgba(150,120,80,0.35)';
        for (var y = 0; y < S; y += S / 4) o.fillRect(0, y, S, 2);
        for (var k = 0; k < 4; k++) o.fillRect(((k * 37) % S), k * S / 4, 2, S / 4);
        o.fillStyle = '#e48a4a'; o.beginPath(); o.arc(S * 0.75, S * 0.38, 7, 0, 7); o.fill();
        o.fillStyle = '#4a8ac8'; o.beginPath(); o.arc(S * 0.75, S * 0.38, 3.5, 0, 7); o.fill();
      },
      bay: function () { o.fillStyle = '#2f8096'; o.fillRect(0, 0, S, S); o.strokeStyle = 'rgba(190,235,240,0.45)'; o.lineWidth = 2; for (var k = 0; k < 6; k++) { var x = rnd() * S, y = rnd() * S; o.beginPath(); o.moveTo(x, y); o.quadraticCurveTo(x + 9, y - 5, x + 18, y); o.stroke(); } },
      bay2: function () { o.fillStyle = '#2f8096'; o.fillRect(0, 0, S, S); o.fillStyle = 'rgba(255,255,230,0.7)'; for (var k = 0; k < 5; k++) o.fillRect(rnd() * S, rnd() * S, 3, 2); o.strokeStyle = 'rgba(190,235,240,0.35)'; o.lineWidth = 2; o.beginPath(); o.moveTo(10, 80); o.quadraticCurveTo(30, 72, 50, 80); o.stroke(); },
      wall: function () { // old stone wall: big blocks, a lit top
        o.fillStyle = '#857a68'; o.fillRect(0, 0, S, S);
        for (var r = 0; r < 4; r++) for (var c = -1; c < 3; c++) { o.fillStyle = (r + c) % 2 ? '#b3a68e' : '#a89a82'; o.fillRect(c * S / 2 + (r % 2) * S / 4 + 2, r * S / 4 + 2, S / 2 - 4, S / 4 - 4); }
        o.fillStyle = 'rgba(255,245,220,0.25)'; o.fillRect(0, 0, S, 6);
      },
      track: function () { o.fillStyle = '#c9a36f'; o.fillRect(0, 0, S, S); o.fillStyle = 'rgba(110,75,40,0.35)'; for (var k = 0; k < 40; k++) o.fillRect(rnd() * S, rnd() * S, 3, 2); },
      rails: function () { // the rails: gravel, sleepers, two rails along
        o.fillStyle = '#9a9184'; o.fillRect(0, 0, S, S);
        o.fillStyle = 'rgba(60,50,40,0.3)'; for (var k = 0; k < 50; k++) o.fillRect(rnd() * S, rnd() * S, 3, 3);
        o.fillStyle = '#6e4a2c'; for (var x = 6; x < S; x += S / 4) o.fillRect(x, S * 0.18, S / 8, S * 0.64);
        o.fillStyle = '#c7ccd2'; o.fillRect(0, S * 0.3, S, 6); o.fillRect(0, S * 0.62, S, 6);
      },
    };
    // the owner's ground pictures (the pack's manila_tex_<slot>): a tile, and its twin moved by half (it wraps)
    var tex = function (slot, shift) {
      var img = F.images && F.images[TEX(slot)];
      if (!img) return false;
      o.imageSmoothingQuality = 'high';
      if (!shift) { o.drawImage(img, 0, 0, S, S); return true; }
      [[-1, -1], [0, -1], [-1, 0], [0, 0]].forEach(function (q) { o.drawImage(img, S / 2 + q[0] * S, S / 2 + q[1] * S, S, S); });
      return true;
    };
    // the plaza's picture over 3 x 3 tiles (owner, 11 Nov 2026: it was too small): tile j of 9 is its part (j % 3, j / 3)
    var plazaPart = function (j) {
      var img = F.images && F.images[TEX('plaza')];
      if (!img) return false;
      o.imageSmoothingQuality = 'high';
      o.drawImage(img, -(j % 3) * S, -Math.floor(j / 3) * S, 3 * S, 3 * S);
      return true;
    };
    var OWN = { 0: ['cobble'], 1: ['cobble', 1], 2: ['baywalk'], 3: ['bay'], 4: ['bay', 1] };
    // city life's ground (the owner's ground_asphalt, ground_asphalt_line, ground_sidewalk, ground_crosswalk, ground_concrete)
    var part = function (slot, sx, rot) { // half of a texture (sx: 0 the left half, 1 the right), stretched over the tile, turned
      var img = F.images && F.images[TEX(slot)];
      if (!img) return false;
      o.save();
      o.translate(S / 2, S / 2);
      if (rot) o.rotate(rot);
      o.drawImage(img, sx * img.width / 2, 0, img.width / 2, img.height, -S / 2, -S / 2, S, S);
      o.restore();
      return true;
    };
    var turned = function (slot) { var img = F.images && F.images[TEX(slot)]; if (!img) return false; o.save(); o.translate(S / 2, S / 2); o.rotate(Math.PI / 2); o.drawImage(img, -S / 2, -S / 2, S, S); o.restore(); return true; };
    var CITY = {
      asphalt: function () { return tex('asphalt'); }, sidewalk: function () { return tex('sidewalk'); }, concrete: function () { return tex('concrete'); },
      cross_v: function () { return tex('crosswalk'); }, cross_h: function () { return turned('crosswalk'); }, // (its stripes run top to bottom)
      lane_w: function () { return part('asphalt_line', 0, 0); }, lane_e: function () { return part('asphalt_line', 1, 0); }, // (its line runs down the middle)
      lane_n: function () { return part('asphalt_line', 0, Math.PI / 2); }, lane_s: function () { return part('asphalt_line', 1, Math.PI / 2); },
    };
    var slot = {};
    Object.keys(G.T).forEach(function (k) { slot[G.T[k]] = k; });
    for (var i = 0; i < G.COLS * G.ROWS; i++) {
      var name = slot[i];
      if (!name) continue;
      o.clearRect(0, 0, S, S);
      var pj = /^plaza(\d)$/.exec(name);
      if (pj) { if (!plazaPart(+pj[1])) DRAW.plaza(+pj[1]); }
      else if (CITY[name]) { if (!CITY[name]()) DRAW[name](); }
      else if (!(OWN[i] && tex(OWN[i][0], OWN[i][1]))) DRAW[name]();
      var x = MG + (i % G.COLS) * (S + SP), y = MG + Math.floor(i / G.COLS) * (S + SP);
      g.drawImage(one, x - MG, y - MG, S + 2 * MG, S + 2 * MG); // (into the margin too: no seams between tiles)
      g.drawImage(one, x, y);
    }
    return cv;
  };
  // The ground sheet for this visit: drawn again (and the old one let go) when more of the owner's textures came in.
  var groundSig = null;
  var groundReady = function (scene) {
    var sig = Object.keys(M.art.ground).concat(['asphalt', 'asphalt_line', 'sidewalk', 'crosswalk', 'concrete']).filter(function (k) { return F.images && F.images[TEX(k)]; }).join(',');
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
    if (this.mapKey === 'mall') { this.outdoors = false; if (F.mnMallGround) F.mnMallGround(this); }
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
    if (p.ferris) { // the Ferris wheel: its stand when the turning wheel is in too, else the whole picture (still), else drawn
      var im = function (k) { return F.images && F.images['props/manila_' + k]; };
      own = im('ferris_stand') && im('ferris_wheel') ? 'props/manila_ferris_stand' : im('ferris_whole') ? 'props/manila_ferris_whole' : null;
    }
    var drawnKey = !own && /^@/.test(p.stand || '') && F.mnStandIn ? F.mnStandIn(this, p.stand.slice(1), p.v || 0) : null; // (city life: drawn by the game)
    var key = own || drawnKey || (/^tw_/.test(p.stand) ? p.stand : 'props/' + p.stand);
    if (!drawnKey && !F.images[key]) return null;
    if (!drawnKey) F.ensureTexture(this, key);
    // its own shape (128 px a tile), fitted into the box, standing on its bottom
    var pw = (o.x1 - o.x0 + 1) * T, ph = (o.y1 - o.y0 + 1) * T, left = o.x0 * T, bottom = (o.y1 + 1) * T;
    var fr = this.textures.getFrame(key), nw = fr.realWidth * 2, nh = fr.realHeight * 2, k = Math.min(pw / nw, ph / nh), dw = nw * k, dh = nh * k;
    var img = this.add.image(left + (pw - dw) / 2, bottom, key).setOrigin(0, 1).setDisplaySize(dw, dh);
    F.depthTo(img, p.flat ? DEPTH.flat : DEPTH.actor + bottom / 1e5); // (flat: a court on the ground)
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
    if (this.mapKey !== 'manila' && this.mapKey !== 'mall') return;
    var self = this, spots = [], mall = this.mapKey === 'mall';
    this.mn = { labels: [], people: [], cullMs: 0, schedMs: 0, mall: mall,
      cr: mall ? Object.assign({ looks: M.crowd.looks, tints: M.crowd.tints, lines: M.mall.lines, zones: M.mall.zones }, M.mall.crowd) : M.crowd };
    this.objects = this.objects.filter(function (o) {
      if (o.type !== 'mn_prop') return true;
      var spot = self.mnDrawProp(o);
      if (spot && (spot.props.text || spot.props.station || spot.props.who || spot.props.food || spot.props.shed != null || spot.props.mall)) spots.push(spot);
      return false;
    }).concat(spots);
    this.mn.grid = L.manilaGrid(maps[this.mapKey], true); // (nobody walks behind a building: its whole box is out of bounds)
    if (!mall) this.mnPeople();
    this.mnCrowd();
    if (this.mnLife) this.mnLife();
    var s = this.state;
    if (mall) return;
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

  // ---------- the city folk: the crowd ----------
  // Owner, 11 Nov 2026: "That was city, make it crowded, we need at least 30 people". Besides the 7 above, C.MANILA.crowd:
  // folk who go from place to place (the plaza, the market's stalls, the bay walk, the platform, the track, the pier,
  // Calle Real, the church square, the barrio, the park), along the paths (never behind or through a building: the strict
  // grid), pause there, turn, sit on a bench, browse a stall; every fourth walks with a friend and they face each other
  // when they stop. More at the market in the morning and on the plaza in the evening (the zones' weights by the hour);
  // about a third of the whole at night. On a cheap phone about 15 in all, they stay in their place, and those far off
  // the screen stand still and are not drawn. Tap one: a line about the city.
  var CR = M.crowd;
  var periodOf = function (min) { var h = min / 60; return h >= 6 && h < 11 ? 0 : h >= 11 && h < 16 ? 1 : h >= 16 && h < 21 ? 2 : 3; };
  var crowdWant = function (cr, min) { var night = periodOf(min) === 3; return CHEAP ? (night ? cr.cheapNight : cr.cheap) : (night ? cr.night : cr.day); };
  var pickZone = function (cr, p) {
    var ks = Object.keys(cr.zones), all = ks.reduce(function (a, k) { return a + cr.zones[k].w[p]; }, 0), r = Math.random() * all;
    for (var i = 0; i < ks.length; i++) { r -= cr.zones[ks[i]].w[p]; if (r < 0) return ks[i]; }
    return ks[0];
  };
  F.mnPeriodOf = periodOf;
  F.mnCheap = CHEAP;
  var folkAnims = function (scene, look) {
    ['down', 'up', 'side'].forEach(function (d, j) {
      var f = look.row * 9 + j * 3, ak = 'mnf-' + look.key + '-' + look.row + '-' + d;
      if (!scene.anims.exists(ak)) scene.anims.create({ key: ak, frames: scene.anims.generateFrameNumbers(look.key, { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
    });
  };
  P.mnCrowd = function () {
    var self = this, mn = this.mn, n = crowdWant(mn.cr, this.state.time);
    mn.folk = [];
    mn.looks = mn.cr.looks.filter(function (l) { return F.images && F.images[l[0]]; });
    mn.lookN = 0;
    mn.crowdMs = 0;
    for (var i = 0; i < n; i++) this.mnFolkAdd(false);
    void self;
  };
  P.mnFolkAdd = function (offScreen) {
    var mn = this.mn, g = mn.grid, p = periodOf(this.state.time), k = mn.lookN++;
    if (!mn.looks.length) return null;
    var CR = mn.cr, l = mn.looks[k % mn.looks.length], tint = CR.tints[Math.floor(k / mn.looks.length) % CR.tints.length];
    var look = { key: l[0], row: l[1], tint: tint };
    F.ensureTexture(this, look.key);
    folkAnims(this, look);
    var zone = pickZone(CR, p), at = null, cam = this.cameras.main.worldView;
    for (var t = 0; t < 8 && !at; t++) {
      var pts = CR.zones[zone].at, q = pts[Math.floor(Math.random() * pts.length)], x = (q[0] + 0.5) * T, y = (q[1] + 0.6) * T;
      if (!g.ok(q[0], q[1])) continue;
      if (offScreen && t < 7 && x > cam.x - 2 * T && x < cam.right + 2 * T && y > cam.y - 2 * T && y < cam.bottom + 3 * T) { zone = pickZone(CR, p); continue; }
      at = { x: x, y: y, q: q };
    }
    if (!at) return null;
    var sp = this.add.sprite(at.x, at.y, look.key, look.row * 9).setOrigin(0.5, 0.83).setScale(2);
    if (look.tint) sp.setTint(look.tint);
    var v = { folk: true, look: look, sp: sp, x: at.x, y: at.y, zone: zone, path: [], hold: 1500 + Math.random() * 6000, dir: 'down', act: at.q[2] || '',
      speed: (1.35 + Math.random() * 0.55) * T, near: true, pal: null };
    // every fourth walks with the one before (a friend: they stop side by side and face each other)
    var last = mn.folk[mn.folk.length - 1];
    if (k % 4 === 3 && last && !last.pal && !last.leaving) { v.pal = last; last.pal = v; v.zone = last.zone; v.follower = true; }
    this.mnFolkPlace(v);
    mn.folk.push(v);
    return v;
  };
  P.mnFolkPlace = function (v) {
    v.sp.setPosition(v.x, v.y);
    F.depthTo(v.sp, DEPTH.actor + v.y / 1e5);
  };
  P.mnFolkFace = function (v, dir) {
    v.dir = dir;
    v.sp.anims.stop();
    v.sp.setFrame(v.look.row * 9 + IDLE[dir]).setFlipX(dir === 'right');
  };
  var ACT_DIR = { browse: 'up', wait: 'down', sit: 'down', left: 'left', right: 'right', up: 'up', down: 'down' };
  // the next place: in the same zone, or (sometimes; never on a cheap phone) another; a friend goes beside the leader
  P.mnFolkNext = function (v) {
    var g = this.mn.grid, p = periodOf(this.state.time), CR = this.mn.cr;
    if (v.role && this.mnRoleNext) return this.mnRoleNext(v);
    if (v.follower && v.pal && !v.pal.gone) {
      var L0 = v.pal.goal;
      if (!L0) return;
      var side = [[1, 0], [-1, 0], [0, 1]].filter(function (d) { return g.ok(L0[0] + d[0], L0[1] + d[1]); })[0];
      if (!side) return;
      return this.mnFolkGo(v, L0[0] + side[0], L0[1] + side[1], 'pal');
    }
    if (!CHEAP && Math.random() < 0.3) v.zone = pickZone(CR, p);
    var pts = CR.zones[v.zone].at;
    for (var t = 0; t < 6; t++) {
      var q = pts[Math.floor(Math.random() * pts.length)];
      if (g.ok(q[0], q[1]) && !(v.goal && v.goal[0] === q[0] && v.goal[1] === q[1])) return this.mnFolkGo(v, q[0], q[1], q[2] || '');
    }
  };
  P.mnFolkGo = function (v, tx, ty, act) {
    var fx = Math.floor(v.x / T), fy = Math.floor(v.y / T), path = fx === tx && fy === ty ? [] : L.manilaPath(this.mn.grid, fx, fy, tx, ty, CHEAP ? 3000 : 9000);
    if (!path) return;
    v.path = path;
    v.goal = [tx, ty];
    v.act = act;
    v.seated = false;
    if (v.pal && !v.follower && v.pal.path && !v.pal.path.length) v.pal.hold = Math.min(v.pal.hold, 300 + Math.random() * 600); // (the friend comes along)
  };
  P.mnUpdateCrowd = function (dt) {
    var self = this, mn = this.mn, f = this.feet();
    // how many there should be for the hour: the extra go once out of sight, new ones come in out of sight
    mn.crowdMs -= dt;
    if (mn.crowdMs <= 0) {
      mn.crowdMs = 5000;
      var want = crowdWant(mn.cr, this.state.time), here = mn.folk.filter(function (v) { return !v.leaving && !v.role; });
      for (var i = here.length - 1; i >= want; i--) here[i].leaving = true;
      for (var j = here.length; j < want; j++) this.mnFolkAdd(true);
    }
    for (var k = mn.folk.length - 1; k >= 0; k--) {
      var v = mn.folk[k];
      if (v.leaving && !v.near) { v.sp.destroy(); v.gone = true; if (v.pal) v.pal.pal = null; mn.folk.splice(k, 1); continue; }
      if (v.riding) continue; // (on the jeep: city life)
      if (CHEAP && !v.near && !v.role) continue; // (a cheap phone: those out of sight stand still)
      if (v.hold > 0) { v.hold -= dt; continue; }
      if (!v.path.length) {
        if (v.arrived) {
          v.arrived = false;
          // there: sit on the bench beside it, face the stall, the train, the track; or look about; a friend faces the other
          var a = ACT_DIR[v.act];
          if (v.act === 'sit') { v.y -= 0.85 * T; v.x += 0.45 * T; v.seated = true; this.mnFolkPlace(v); }
          if (v.pal && v.pal.near !== undefined && !v.pal.path.length && Math.hypot(v.pal.x - v.x, v.pal.y - v.y) < 1.6 * T) {
            this.mnFolkFace(v, Math.abs(v.pal.x - v.x) > Math.abs(v.pal.y - v.y) ? (v.pal.x > v.x ? 'right' : 'left') : v.pal.y > v.y ? 'down' : 'up');
            this.mnFolkFace(v.pal, v.dir === 'right' ? 'left' : v.dir === 'left' ? 'right' : v.dir === 'up' ? 'down' : 'up');
          } else this.mnFolkFace(v, a || ['down', 'left', 'right', 'down'][Math.floor(Math.random() * 4)]);
          v.hold = (CHEAP ? 8000 : 4000) + Math.random() * (CHEAP ? 8000 : 7000);
          continue;
        }
        if (v.seated) { v.y += 0.85 * T; v.x -= 0.45 * T; v.seated = false; this.mnFolkPlace(v); } // (up off the bench)
        // now and then, standing about: turn the head (a new way to face) before going on
        if (!v.act && !v.pal && Math.random() < 0.35) { this.mnFolkFace(v, ['down', 'left', 'right', 'up'][Math.floor(Math.random() * 4)]); v.hold = 1500 + Math.random() * 2500; v.act = 'looked'; continue; }
        this.mnFolkNext(v);
        if (!v.path.length) { v.hold = 1500; continue; }
      }
      var n = v.path[0], gx = (n[0] + 0.5) * T, gy = (n[1] + 0.6) * T, dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy), step = v.speed * dt / 1000;
      if (Math.hypot(f.x - gx, f.y - gy) < 0.5 * T) { v.hold = 500; if (v.sp.anims.isPlaying) this.mnFolkFace(v, v.dir); continue; } // (the farmer in the way)
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (d <= step) { v.x = gx; v.y = gy; v.path.shift(); if (!v.path.length) v.arrived = true; } else { v.x += dx / d * step; v.y += dy / d * step; }
      if (v.near) {
        var ak = 'mnf-' + v.look.key + '-' + v.look.row + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir);
        if (v.sp.anims.currentAnim == null || v.sp.anims.currentAnim.key !== ak || !v.sp.anims.isPlaying) v.sp.play(ak);
        v.sp.setFlipX(dir === 'right');
      }
      v.dir = dir;
      this.mnFolkPlace(v);
      if (!v.path.length && v.near) this.mnFolkFace(v, dir);
    }
    void self;
  };
  P.mnFolkAt = function (x, y) {
    var best = null, bd = 0.8 * T;
    ((this.mn && this.mn.folk) || []).forEach(function (v) { if (v.leaving || v.inside || v.riding) return; var d = Math.hypot(v.x - x, v.y - 0.3 * T - y); if (d < bd) { bd = d; best = v; } });
    return best;
  };
  P.mnFolkTalk = function (v) {
    var f = this.feet();
    v.hold = 4000;
    this.mnFolkFace(v, Math.abs(f.x - v.x) > Math.abs(f.y - v.y) ? (f.x > v.x ? 'right' : 'left') : f.y < v.y ? 'up' : 'down');
    sfx('talk');
    var lines = (v.role && v.lines) || this.mn.cr.lines;
    F.ui.dialog((v.title || 'A PASSER-BY') + '\n' + lines[Math.floor(Math.random() * lines.length)]);
  };

  // ---------- the frame ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.apply(this, arguments);
    if (!this.mn || this.busy) return;
    var dt = Math.min(delta, 100), mn = this.mn;
    this.mnUpdatePeople(dt);
    this.mnUpdateCrowd(dt);
    mn.cullMs -= dt;
    if (mn.cullMs > 0) return;
    mn.cullMs = 300;
    // the labels and name tags: only near the view (the camera's middle, about a screen and a half round it)
    var cam = this.cameras.main, cx = cam.midPoint.x, cy = cam.midPoint.y, rx = cam.width / cam.zoom * 0.9 + 3 * T, ry = cam.height / cam.zoom * 0.9 + 3 * T;
    var near = function (o) { return Math.abs(o.x - cx) < rx && Math.abs(o.y - cy) < ry; };
    mn.labels.forEach(function (t) { t.setVisible(near(t)); });
    mn.people.forEach(function (v) { v.tag.setVisible(near(v.tag)); });
    // the crowd: drawn and walking with its legs only near the view (a cheap phone: and moving at all)
    mn.folk.forEach(function (v) {
      var was = v.near;
      v.near = near(v);
      if (v.near === was) return;
      v.sp.setVisible(v.near && !v.inside && !v.riding);
      if (!v.near && v.sp.anims.isPlaying) v.sp.anims.pause();
      else if (v.near && v.sp.anims.isPaused) v.sp.anims.resume();
    });
  };

  // ---------- the action button ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mn) {
      var self = this, pt = this.front(0.7), v = this.mnPersonAt(pt.x, pt.y);
      if (v) return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.mnTalk(v); } };
      var fk = this.mnFolkAt(pt.x, pt.y);
      if (fk) return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.mnFolkTalk(fk); } };
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
