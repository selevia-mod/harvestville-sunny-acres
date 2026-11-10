// Manila's rules (content: 00-zzzzzzzzzzzzzzzzzzz-manila.js; the world: 19zzzzzzzzzzzzzzzzzzzzzzzzz-manila.js).
// - L.manilaMap(town): the city's Tiled map, built from the layout in C.MANILA (no maps/manila.json: the page is nearly
//   full). It uses the town's own tile and season sheets (the same numbers, so the trees and grass change with the
//   season) and one sheet of its own, 'manila_ground' (cobbles, plaza tiles, the bay walk, the bay, the old walls, the
//   track, the rails): drawn on a canvas by the game until the owner's pictures come in the 'manila' pack.
// - The train: L.manilaFare, L.manilaRide (250G one way, the first ride free).
// - The valley road: L.manilaRoad, the hook for the horse rule (farm-economy-v2 part 5: 6 hearts and Horseshoes).
// - Its people: where each one is at an hour (L.manilaSpot), what they say (L.manilaTalk).
// - The save: Manila is saved as the town (so an older copy of the game opens in town, at the farm road), with the spot
//   in the city in `mp`; rides and who you have met in `mn`. Nothing anyone has is touched.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MANILA;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- the map ----------
  // Manila's own ground sheet: 5 x 2 tiles of 256 (stored at half size), margin 8, spacing 16, like the town's sheets.
  // (city life, 11 Nov 2026: 5 x 5 now, with the city's ground: asphalt, sidewalk, concrete, the crosswalks; and the plaza's
  // floor drawn over 3 x 3 tiles, so the owner's plaza picture is 3 times bigger: plaza0..plaza8, by x % 3 and y % 3)
  M.GROUND = { NAME: 'manila_ground', SIZE: 256, MARGIN: 8, SPACING: 16, COLS: 5, ROWS: 5,
    T: { cobble: 0, cobble2: 1, baywalk: 2, bay: 3, bay2: 4, wall: 5, track: 6, rails: 7, asphalt: 8, sidewalk: 9, concrete: 10, cross_h: 11, cross_v: 12,
      plaza0: 14, plaza1: 15, plaza2: 16, plaza3: 17, plaza4: 18, plaza5: 19, plaza6: 20, plaza7: 21, plaza8: 22 },
    SOLID: { bay: 1, bay2: 1, wall: 1, rails: 1 }, WATER: { bay: 1, bay2: 1 }, ROAD: { asphalt: 1 } };
  var G = M.GROUND;
  G.IMAGE_W = 2 * G.MARGIN + G.COLS * G.SIZE + (G.COLS - 1) * G.SPACING;
  G.IMAGE_H = 2 * G.MARGIN + G.ROWS * G.SIZE + (G.ROWS - 1) * G.SPACING;
  // the town's tiles this map uses (tools/tiles.js: TILES.T)
  var TT = { grass: 5, grass2: 6, grass3: 12, flowers: 13, path: 27, water: 34, fenceH: 41, fenceV: 48, fencePost: 55, treeTL: 61, treeTR: 62, treeBL: 68, treeBR: 69,
    bush: 75, rock: 76, shipbox: 84, sign: 85, dock: 91, plaza: 92, sand: 93 };
  M.TOWN_TILES = TT;

  // a small seeded random, so the city is the same on every phone
  var rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  var prop = function (name, type, value) { return { name: name, type: type, value: value }; };

  L.manilaMap = function (town) {
    var W = M.W, Hh = M.H, S = G.SIZE, r = rng(20261111);
    var sets = town.tilesets.filter(function (ts) { return ts.name === 'tiles' || ts.name === 'seasons'; }).map(function (ts) { return JSON.parse(JSON.stringify(ts)); });
    var tiles = sets.filter(function (ts) { return ts.name === 'tiles'; })[0];
    if (!tiles) throw new Error('L.manilaMap: the town map has no tiles sheet');
    var next = sets.reduce(function (m, ts) { return Math.max(m, ts.firstgid + ts.tilecount); }, 1);
    var own = { firstgid: next, name: G.NAME, image: '../assets/' + G.NAME + '.png', imagewidth: G.IMAGE_W, imageheight: G.IMAGE_H, tilewidth: S, tileheight: S,
      columns: G.COLS, tilecount: G.COLS * G.ROWS, margin: G.MARGIN, spacing: G.SPACING, tiles: [] };
    Object.keys(G.T).forEach(function (k) {
      var p = [];
      if (G.SOLID[k]) p.push(prop('collides', 'bool', true));
      if (G.WATER[k]) p.push(prop('water', 'bool', true));
      p.push(prop('name', 'string', 'mn_' + k));
      own.tiles.push({ id: G.T[k], properties: p });
    });
    sets.push(own);
    var tg = function (k) { return tiles.firstgid + TT[k]; }, mg = function (k) { return own.firstgid + G.T[k]; };
    var layer = function () { var a = new Array(W * Hh); for (var i = 0; i < a.length; i++) a[i] = 0; return a; };
    var ground = layer(), walls = layer(), above = layer(), objects = [], id = 1;
    var inMap = function (x, y) { return x >= 0 && y >= 0 && x < W && y < Hh; };
    var put = function (l, x, y, gid) { if (inMap(x, y)) l[y * W + x] = gid; };
    var KIND = {
      grass: function () { var v = r(); return tg(v < 0.7 ? 'grass' : v < 0.92 ? 'grass2' : 'grass3'); },
      flowers: function () { return tg('flowers'); }, path: function () { return tg('path'); }, sand: function () { return tg('sand'); },
      dock: function () { return tg('dock'); }, tplaza: function () { return tg('plaza'); }, water: function () { return tg('water'); },
      cobble: function () { return mg(r() < 0.75 ? 'cobble' : 'cobble2'); }, plaza: function (x, y) { return mg('plaza' + ((y % 3) * 3 + (x % 3))); },
      asphalt: function () { return mg('asphalt'); }, sidewalk: function () { return mg('sidewalk'); }, concrete: function () { return mg('concrete'); },
      cross_h: function () { return mg('cross_h'); }, cross_v: function () { return mg('cross_v'); },
      baywalk: function () { return mg('baywalk'); }, bay: function () { return mg(r() < 0.7 ? 'bay' : 'bay2'); }, wall: function () { return mg('wall'); },
      track: function () { return mg('track'); }, rails: function () { return mg('rails'); },
    };
    var fill = function (kind, x0, y0, w, h) {
      for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) put(ground, x, y, KIND[kind](x, y));
    };
    fill(M.base || 'grass', 0, 0, W, Hh);
    M.ground.forEach(function (g) { fill(g[0], g[1], g[2], g[3], g[4]); });
    M.trackCorners.forEach(function (c) { put(ground, c[0], c[1], KIND.grass()); });
    // the jeepney's loop road (city life): 2 lanes of asphalt along its path, a sidewalk on both sides (over plain ground
    // only: never over the plaza, the cobbles, the bay walk), then the crosswalks
    if (M.jeep) {
      var plainG = function (g) { return g === mg('concrete') || g === tg('grass') || g === tg('grass2') || g === tg('grass3') || g === tg('path') || g === tg('sand') || g === tg('flowers'); };
      var road = {};
      L.manilaRoadTiles().forEach(function (t) { road[t[1] * W + t[0]] = 1; put(ground, t[0], t[1], mg('asphalt')); });
      Object.keys(road).forEach(function (k) {
        var x = k % W, y = Math.floor(k / W);
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1], i = ny * W + nx;
          if (inMap(nx, ny) && !road[i] && plainG(ground[i])) put(ground, nx, ny, mg('sidewalk'));
        });
      });
      (M.jeep.cross || []).forEach(function (c) { fill(c[4] === 'v' ? 'cross_v' : 'cross_h', c[0], c[1], c[2], c[3]); });
    }

    // what nothing random may stand on: every building, prop, sign, spot and way through
    var taken = {};
    var take = function (x, y, w, h) { for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) taken[yy * W + xx] = 1; };
    var obj = function (name, type, x, y, w, h, props) {
      var o = { id: id++, name: name, type: type, x: x * S, y: y * S, width: w * S, height: h * S, rotation: 0, visible: true };
      if (props) o.properties = props;
      objects.push(o);
      return o;
    };
    var point = function (name, x, y, dir) {
      objects.push({ id: id++, name: name, type: 'place', point: true, x: Math.round(x * S), y: Math.round(y * S), width: 0, height: 0, rotation: 0, visible: true,
        properties: dir ? [prop('dir', 'string', dir)] : undefined });
    };
    var drawn = function (key, stand, box, foot, extra) {
      var p = [prop('stand', 'string', stand), prop('foot', 'int', foot)];
      Object.keys(extra || {}).forEach(function (k) { if (extra[k] != null && extra[k] !== '') p.push(prop(k, typeof extra[k] === 'number' ? 'int' : 'string', extra[k])); });
      obj(key, 'mn_prop', box[0], box[1], box[2], box[3], p);
      take(box[0], box[1], box[2], box[3]);
    };
    M.buildings.forEach(function (b) {
      drawn(b.key, b.stand, b.box, b.foot, { art: b.art || '', label: b.name || '', text: b.text || '', tint: b.tint || 0, who: b.who || '', station: b.station ? 1 : 0, box: b.flat ? 0 : 1,
        v: b.v, shed: b.shed, mall: b.mall ? 1 : 0, ferris: b.ferris ? 1 : 0, flat: b.flat ? 1 : 0 });
    });
    M.props.forEach(function (p, i) { drawn('p' + i, p[0], [p[1], p[2], p[3], p[4]], p[5], { art: p[6] || '' }); });
    M.baywalk.lamps.forEach(function (y, i) { drawn('bl' + i, 'lamp', [15, y, 1, 2], 1, { art: 'street_lamp' }); });
    M.baywalk.benches.forEach(function (y, i) { drawn('bb' + i, 'bench', [12, y, 2, 1], 1, { art: 'park_bench' }); });
    // the owner's decorations (drawn only once their pictures are in: no stand-in)
    (M.decor || []).forEach(function (d, i) { drawn('d' + i, '', [d[1], d[2], d[3], d[4]], d[5], { art: d[0] }); });

    // the station's rails: solid, drawn by the game
    obj('mn_rails', 'mn_rails', 56, 10, W - 56, 2);
    // signs (a sign tile, solid, and its words), the berths, the gates
    var sign = function (name, x, y, text) {
      put(walls, x, y, tg('sign'));
      obj(name, 'sign', x, y, 1, 1, [prop('text', 'string', text)]);
      take(x, y, 1, 1);
    };
    M.signs.forEach(function (s, i) { sign('mn_sign' + i, s[0], s[1], s[2]); });
    M.berths.forEach(function (b, i) { sign('mn_berth' + (i + 1), b[0], b[1], 'BERTH ' + (i + 1) + '\nEmpty for now. Boats are coming to Manila Bay soon!'); });
    M.gates.forEach(function (g) {
      var b = g.box;
      take(b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2);
      if (g.warp) obj('plains_gate', 'warp', b[0], b[1], b[2], b[3], [prop('to', 'string', 'town'), prop('spawn', 'string', 'from_manila'), prop('walk', 'bool', true)]);
      else {
        // closed for now: a fence across the road, and the gate itself says so
        var fy = b[1] === 0 ? b[1] + 1 : b[1];
        for (var x = b[0]; x < b[0] + b[2]; x++) put(walls, x, fy, tg('fenceH'));
        obj('mn_gate_' + g.key, 'mn_gate', b[0], b[1], b[2], b[3], [prop('text', 'string', g.text)]);
      }
      sign('mn_gatesign_' + g.key, g.sign[0], g.sign[1], g.text);
    });
    // the fences (a ring of posts and rails, one gap for the gate)
    (M.fences || []).forEach(function (f) {
      for (var x = f[0]; x <= f[2]; x++) [f[1], f[3]].forEach(function (y) { if (!(y === f[1] && x === f[4])) put(walls, x, y, tg(x === f[0] || x === f[2] ? 'fencePost' : 'fenceH')); });
      for (var y = f[1] + 1; y < f[3]; y++) [f[0], f[2]].forEach(function (x) { put(walls, x, y, tg('fenceV')); });
      take(f[0], f[1], f[2] - f[0] + 1, f[3] - f[1] + 1);
    });
    // the quay's crates
    M.crates.forEach(function (c) { put(walls, c[0], c[1], tg('shipbox')); take(c[0], c[1], 1, 1); });

    // spawns and the people's spots (kept free)
    Object.keys(M.spawns).forEach(function (k) { var p = M.spawns[k]; point(k, p[0], p[1], p[2]); take(Math.floor(p[0]) - 1, Math.floor(p[1]) - 1, 3, 3); });
    Object.keys(M.spots).forEach(function (k) { var p = M.spots[k]; point('mn_' + k, p[0], p[1]); take(Math.floor(p[0]), Math.floor(p[1]), 1, 1); });

    // trees (2 x 2: the top in Above, the trunk in Walls, solid) and bushes, on grass only, never on what is kept free
    var grassy = function (x, y) {
      var g = ground[y * W + x];
      return inMap(x, y) && !taken[y * W + x] && !walls[y * W + x] && (g === tg('grass') || g === tg('grass2') || g === tg('grass3') || g === tg('sand'));
    };
    var tree = function (x, y) {
      if (!grassy(x, y) || !grassy(x + 1, y) || !grassy(x, y + 1) || !grassy(x + 1, y + 1)) return false;
      put(above, x, y, tg('treeTL'));
      put(above, x + 1, y, tg('treeTR'));
      put(walls, x, y + 1, tg('treeBL'));
      put(walls, x + 1, y + 1, tg('treeBR'));
      take(x, y, 2, 2);
      return true;
    };
    M.trees.forEach(function (row) {
      for (var y = row[1]; y <= row[3]; y += 2) for (var x = row[0]; x <= row[2]; x += 2) tree(x, y);
    });
    M.looseTrees.forEach(function (t) { tree(t[0], t[1]); });
    M.bushes.forEach(function (b) { if (grassy(b[0], b[1])) { put(walls, b[0], b[1], tg('bush')); take(b[0], b[1], 1, 1); } });
    // scattered decorations: on grass with a tile of grass all round (no walk is ever narrowed)
    (M.scatter || []).forEach(function (sc, k) {
      var w = sc[6], h = sc[7], placed = 0;
      for (var tries = 0; placed < sc[5] && tries < 600; tries++) {
        var x = sc[1] + Math.floor(r() * (sc[3] - sc[1] - w + 2)), y = sc[2] + Math.floor(r() * (sc[4] - sc[2] - h + 2)), ok = true;
        for (var yy = y - 1; yy <= y + h && ok; yy++) for (var xx = x - 1; xx <= x + w && ok; xx++) ok = grassy(xx, yy);
        if (!ok) continue;
        drawn('s' + k + '_' + placed, '', [x, y, w, h], sc[8], { art: sc[0] });
        placed++;
      }
    });

    var tl = function (lid, name, data) { return { id: lid, name: name, type: 'tilelayer', width: W, height: Hh, x: 0, y: 0, opacity: 1, visible: true, data: data }; };
    return {
      compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: W, height: Hh, tilewidth: S, tileheight: S, nextlayerid: 5, nextobjectid: id,
      layers: [tl(1, 'Ground', ground), tl(2, 'Walls', walls), tl(3, 'Above', above),
        { id: 4, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objects }],
      tilesets: sets,
    };
  };

  // What a tile of the built map is: walkable (no solid tile, not under a building's or prop's foot), for the tests and
  // the people's paths; strict: nor anywhere in a building's box (the people never walk behind a building). ({ W, H, ok(x, y) })
  L.manilaGrid = function (map, strict) {
    var W = map.width, Hh = map.height, solid = {}, block = new Uint8Array(W * Hh);
    map.tilesets.forEach(function (ts) { (ts.tiles || []).forEach(function (t) { (t.properties || []).forEach(function (p) { if (p.name === 'collides' && p.value) solid[ts.firstgid + t.id] = 1; if (strict && p.name === 'name' && p.value === 'mn_asphalt') solid[ts.firstgid + t.id] = 1; }); }); }); // (strict: people keep off the road but at the crosswalks)
    map.layers.forEach(function (l) { if (l.type === 'tilelayer') l.data.forEach(function (g, i) { if (solid[g]) block[i] = 1; }); });
    var S = map.tilewidth;
    map.layers.filter(function (l) { return l.type === 'objectgroup'; })[0].objects.forEach(function (o) {
      if (o.type !== 'mn_prop' && o.type !== 'mn_rails') return;
      var x0 = Math.round(o.x / S), y0 = Math.round(o.y / S), w = Math.round(o.width / S), h = Math.round(o.height / S), foot = h;
      if (o.type === 'mn_prop') (o.properties || []).forEach(function (p) { if (p.name === 'foot') foot = p.value; });
      if (strict && o.type === 'mn_prop' && (o.properties || []).some(function (p) { return p.name === 'box' && p.value; })) foot = h; // (a building's whole box)
      for (var y = y0 + h - foot; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < Hh) block[y * W + x] = 1;
    });
    return { W: W, H: Hh, block: block, ok: function (x, y) { return x >= 0 && y >= 0 && x < W && y < Hh && !block[y * W + x]; } };
  };
  // A path of tiles from a to b on that grid (4 ways), or null. [[x, y], ...] from the tile after a to b.
  var bfsFrom = null; // (one array, reused: a path is looked for often, by many people)
  L.manilaPath = function (grid, ax, ay, bx, by, most) {
    var W = grid.W, start = ay * W + ax, goal = by * W + bx, q = [start], qi = 0, seen = 0;
    if (!grid.ok(bx, by)) return null;
    if (!bfsFrom || bfsFrom.length !== W * grid.H) bfsFrom = new Int32Array(W * grid.H);
    bfsFrom.fill(-2);
    var from = bfsFrom;
    from[start] = -1;
    most = most || 4000;
    while (qi < q.length && seen++ < most) {
      var c = q[qi++];
      if (c === goal) {
        var out = [];
        for (var k = goal; k !== start; k = from[k]) out.unshift([k % W, Math.floor(k / W)]);
        return out;
      }
      var cx = c % W, cy = Math.floor(c / W), nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var nx = cx + nb[i][0], ny = cy + nb[i][1], n = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < grid.H && from[n] === -2 && grid.ok(nx, ny)) { from[n] = c; q.push(n); }
      }
    }
    return null;
  };

  // ---------- the train ----------
  var rec = function (s) { if (!s.mn) s.mn = { r: 0, met: 0 }; return s.mn; };
  L.manilaFare = function (s) { return rec(s).r < M.freeRides ? 0 : M.fare; };
  // Pays for one ride (to 'manila' or home to 'town'): 'ok' (and the fare), or 'gold'.
  L.manilaRide = function (s) {
    var m = rec(s), fare = L.manilaFare(s);
    if (s.gold < fare) return { ok: false, why: 'gold', fare: fare };
    s.gold -= fare;
    m.r++;
    return { ok: true, fare: fare };
  };

  // ---------- the valley road ----------
  // Can you take the valley road now? (riding: on the horse.) Step 1: always (walked). Farm-economy-v2 part 5 (the horse
  // going out: 6 hearts and Horseshoes) fills this in when C.MANILA.horseRoad is turned on.
  L.manilaRoad = function (s, riding) {
    if (!M.on) return { ok: false, why: 'The valley road is closed for now.' };
    if (!M.horseRoad) return { ok: true };
    var h = L.horseRoadOk ? L.horseRoadOk(s, riding) : null; // (economy part 5's own check, when it exists)
    if (h && !h.ok) return { ok: false, why: h.why || 'The valley road is long: ride your horse (' + M.horseHearts + ' hearts and Horseshoes).' };
    return { ok: true };
  };

  // ---------- the people ----------
  // Where someone is at this minute of the day: a spot name (C.MANILA.spots), 'in:x' standing at x's door.
  L.manilaSpot = function (key, minute) {
    var p = M.people[key], at = null;
    if (!p) return null;
    p.schedule.forEach(function (e) { if (minute >= e[0]) at = e[1]; });
    if (!at) at = p.schedule[p.schedule.length - 1][1]; // (before the day's first: still where the night left them)
    return at.indexOf('in:') === 0 ? 'door_' + at.slice(3) : at;
  };
  // What they say this time: the first time, who they are (and they remember you); then their lines in turn.
  L.manilaTalk = function (s, key, n) {
    var p = M.people[key], i = M.people.order.indexOf(key), m = rec(s);
    if (!p || i < 0) return null;
    var met = !!(m.met & (1 << i));
    if (!met) { m.met |= 1 << i; return { text: p.met, first: true }; }
    return { text: p.lines[int(n, 0, 1e6, 0) % p.lines.length], first: false };
  };
  L.manilaMet = function (s, key) { var i = M.people.order.indexOf(key); return i >= 0 && !!(rec(s).met & (1 << i)); };

  // ---------- the goal arrow's way out ----------
  if (C.ROUTES) {
    C.ROUTES.manila = {};
    Object.keys(C.ROUTES).forEach(function (m) {
      if (m === 'manila') return;
      C.ROUTES.manila[m] = 'plains_gate';
      if (C.ROUTES[m]) C.ROUTES[m].manila = m === 'town' ? 'road_east' : C.ROUTES[m].town;
    });
  }

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.mn = { r: 0, met: 0 };
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var inCity = s.map === 'manila';
    var o = serialize(inCity ? Object.assign({}, s, { map: 'town' }) : s);
    var m = s.mn || {};
    if (m.r || m.met) o.mn = [int(m.r, 0, 1e7, 0), int(m.met, 0, 0xffff, 0)];
    if (inCity) {
      delete o.p; // (an older game: in town at its usual way in, not at the city's spot)
      var p = s.player || {};
      if (p.x != null) o.mp = [int(p.x, 0, 1e5, 0), int(p.y, 0, 1e5, 0), ['down', 'up', 'left', 'right'].indexOf(p.dir) >= 0 ? ['down', 'up', 'left', 'right'].indexOf(p.dir) : 0];
      else o.mp = 1;
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var a = o && Array.isArray(o.mn) ? o.mn : [];
    s.mn = { r: int(a[0], 0, 1e7, 0), met: int(a[1], 0, 0xffff, 0) };
    if (o && o.mp && s.map === 'town') {
      if (M.on) {
        s.map = 'manila';
        if (Array.isArray(o.mp) && o.mp.length === 3) s.player = { x: int(o.mp[0], 0, M.W * 256, 0), y: int(o.mp[1], 0, M.H * 256, 0), dir: ['down', 'up', 'left', 'right'][int(o.mp[2], 0, 3, 0)] };
        else s.player = { x: null, y: null, dir: 'down', spawn: 'from_train' };
      } else s.player = { x: null, y: null, dir: 'down', spawn: 'platform_w' }; // (the city is shut: off the train in town)
    }
    return s;
  };
})(window.Farm = window.Farm || {});
