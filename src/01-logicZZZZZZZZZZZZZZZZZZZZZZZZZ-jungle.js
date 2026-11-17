// The Bamboo Jungle, the rules (content 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzz-jungle.js; the world 19zzz...z-jungle.js).
// - The maps, built in code (no maps/jungle.json: the page is nearly full), with the Plains' kit (L.mapKit):
//   L.jungleMap(template) from Pulag's sheets, L.jungleCaveMap(template) from a place cave's (the game server builds them
//   the same way: server/lib/maps.js). A prop object's y is its bottom (Tiled's, the world's addProp).
// - Tall bamboo blocks long shots (owner): L.jungleClumps(map) is where the bamboo stands; L.bambooStop says how far a shot
//   goes before the first clump more than C.WILD.bambooFrom (4) tiles out, or null (nothing in its way).
// - zigzag (owner): L.zigzagTurn(ms), how far off its line a zigzagging runner is going now (one way, then the other).
// - The goal arrow: the Jungle and its cave are reached through Manila's Jungle Gate; not in Kanor's Jeep (noJeep).
// No new save key: the place saves as every place does (pl.jungle, pk, pm).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var J = C.JUNGLE;
  if (!J || !C.PLACES.jungle || !L.mapKit) return;
  var K = L.mapKit, prop = K.prop;
  var named = function (sets, n) { return sets.filter(function (t) { return t.name === n; })[0]; };

  // The Jungle, 52 x 52: bamboo everywhere but the glades and the 2-tile trails between them, the waterfall pool in the
  // middle with a stream out of it each way (stepping stones and a bamboo bridge where a trail crosses), Diday's hut
  // in the gate glade, the cave's mouth in the far south. A ring of trees round it, its gap at the top: the way back to Manila.
  L.jungleMap = function (template) {
    var sets = K.copySets(template, ['tiles', 'seasons', 'props']), tiles = named(sets, 'tiles');
    if (!tiles) throw new Error('L.jungleMap: the template has no tiles sheet');
    var props = K.propsOf(named(sets, 'props') || { tiles: [] });
    var W = J.W, Hh = J.H, b = K.build(W, Hh, sets), r = K.rng(20261122), tg = function (k) { return tiles.firstgid + K.TT[k]; };
    var open = new Uint8Array(W * Hh), x, y, i;
    var each = function (bx, f) { for (var yy = bx[1]; yy < bx[1] + bx[3]; yy++) for (var xx = bx[0]; xx < bx[0] + bx[2]; xx++) if (b.inMap(xx, yy)) f(xx, yy); };
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) b.put(b.ground, x, y, tg('grass'));
    J.glades.forEach(function (g) { each(g, function (xx, yy) { open[yy * W + xx] = 1; }); });
    J.trails.forEach(function (t) { each(t, function (xx, yy) { open[yy * W + xx] = 1; b.put(b.ground, xx, yy, tg('trail')); }); });
    // the ring of trees (as the Plains'), the gate's gap at the top
    var gx = J.gate[0], gap = function (tx) { return tx >= gx && tx <= gx + 1; };
    var tree = function (tx, ty) {
      b.put(b.above, tx, ty, tg('treeTL')); b.put(b.above, tx + 1, ty, tg('treeTR'));
      b.put(b.walls, tx, ty + 1, tg('treeBL')); b.put(b.walls, tx + 1, ty + 1, tg('treeBR'));
    };
    for (x = 0; x < W; x += 2) {
      if (gap(x) || gap(x + 1)) [x, x + 1].forEach(function (tx) { if (!gap(tx)) b.put(b.walls, tx, 0, tg('bush')); });
      else { b.put(b.walls, x, 0, tg('treeBL')); b.put(b.walls, x + 1, 0, tg('treeBR')); }
      tree(x, Hh - 2);
    }
    for (y = 1; y < Hh - 2; y += 2) [0, W - 2].forEach(function (tx) { tree(tx, y); b.put(b.walls, tx, y, tg('bush')); b.put(b.walls, tx + 1, y, tg('bush')); });
    b.take(0, 0, W, 1); b.take(0, Hh - 2, W, 2); b.take(0, 0, 2, Hh); b.take(W - 2, 0, 2, Hh);
    // the pool (its corners rounded) and the streams; where a trail crosses, its ground stays (the stones or the bridge go over)
    var pd = J.pool;
    each(pd, function (xx, yy) { if (!((xx === pd[0] || xx === pd[0] + pd[2] - 1) && (yy === pd[1] || yy === pd[1] + pd[3] - 1))) b.put(b.ground, xx, yy, tg('water')); });
    J.streams.forEach(function (st) { for (x = st[0]; x < st[0] + st[2]; x++) { if (!J.crossings.some(function (c) { return x >= c[1] && x <= c[1] + 1 && st[1] === c[2]; })) b.put(b.ground, x, st[1], tg('water')); b.take(x, st[1], 1, 1); } });

    // ---------- objects ----------
    var addProp = function (name, tx, foot, keep) { // (its foot on row `foot`; the picture stands up from there)
      var p = props[name];
      if (!p) return false;
      var o = b.obj(name, 'prop', tx, foot + 1, p.w, p.h);
      o.gid = p.gid;
      if (!keep) b.take(tx, foot + 1 - p.h, p.w, p.h);
      return true;
    };
    var sign = function (name, tx, ty, text) { b.put(b.walls, tx, ty, tg('sign')); b.obj(name, 'sign', tx, ty, 1, 1, [prop('text', 'string', text)]); b.take(tx, ty, 1, 1); };
    // the way back to Manila, and where you come in
    b.obj('road_north', 'warp', gx, 0, 2, 1, [prop('to', 'string', 'manila'), prop('spawn', 'string', 'from_jungle'), prop('walk', 'bool', true)]);
    b.point('from_city', 'spawn', gx + 1, 2.6, 'down');
    // the cave's door (the mouth's point, the door, where you come back up)
    var dr = J.door;
    b.point('dungeon_mouth', 'place', dr[0] + 0.5, dr[1] + 1, null);
    b.obj('dungeon_door', 'warp', dr[0], dr[1], 1, 1, [prop('to', 'string', 'jungle_cave'), prop('spawn', 'string', 'entrance'), prop('walk', 'bool', true)]);
    b.point('from_dungeon', 'spawn', dr[0] + 0.5, dr[1] + 1.7, 'down');
    b.take(dr[0] - 2, dr[1] - 3, 5, 6);
    sign('sign_jungle', gx - 1, 3, 'THE BAMBOO JUNGLE\nNorth: the gate back to Manila. South, past the waterfall pool: the Bamboo Hollows.');
    sign('sign_hollows', J.trails[10][0] - 1, 42, 'THE BAMBOO HOLLOWS\nThe way down is in the rock ahead. 50 floors. Bring javelins.');
    // the crossings, the waterfall, Diday's hut and her things (walk-on ones keep their ground free)
    J.crossings.forEach(function (c) { addProp(c[0] === 'bridge' ? 'flower_arch' : 'wildflowers', c[0] === 'bridge' ? c[1] - 0.5 : c[1], c[2], true); });
    addProp('rainforest_tree', J.falls[0], J.falls[1]);
    addProp('shack', J.hut[0], J.hut[1]);
    addProp('trader_tent', J.rack[0], J.rack[1]);
    addProp('pumpkin_pile', J.baskets[0], J.baskets[1]);
    addProp('lamp', J.chime[0], J.chime[1]);
    // the chests' tiles and Diday's, kept free; a few bigger plants by the glades
    C.PLACES.jungle.chests.forEach(function (c) { b.take(c[0] - 1, c[1] - 1, 3, 3); });
    var at = C.PLACES.jungle.npc.at;
    b.take(at[0] - 1, at[1] - 1, 3, 3);
    b.take(gx - 1, 0, 4, 4);
    var STAND = { treefern: 'pine_tree', banana: 'mud_spring', log: 'mossy_log' };
    var fieldFree = function (tx, ty, w, h) {
      for (var yy = ty; yy < ty + h; yy++) for (var xx = tx; xx < tx + w; xx++) if (!b.inMap(xx, yy) || open[yy * W + xx] || b.taken[yy * W + xx] || b.walls[yy * W + xx]) return false;
      return true;
    };
    J.deco.forEach(function (d) { var p = props[STAND[d[0]]]; if (p && fieldFree(d[1], d[2] + 1 - p.h, p.w, p.h)) addProp(STAND[d[0]], d[1], d[2]); });
    // the bamboo: a clump on every 2 x 2 of the field (rows of bricks), now and then a thicket or a banana tree; under the
    // top of each a bush tile, so the whole clump is solid (nobody walks unseen behind the pictures)
    for (y = 1; y < Hh - 3; y += 2) {
      for (x = 2 + ((y >> 1) & 1); x < W - 3; x += 2) {
        if (!fieldFree(x, y, 2, 2)) continue;
        var k = r();
        addProp(k < 0.64 ? 'bamboo_bush' : k < 0.92 ? 'fern_bush' : 'mud_spring', x, y + 1);
        b.put(b.walls, x, y, tg('bush')); b.put(b.walls, x + 1, y, tg('bush'));
      }
    }
    // a strip one tile high (between a row of clumps and a trail): bamboo standing on it, its top over the row behind
    for (y = 1; y < Hh - 2; y++) for (x = 2; x < W - 3; x++) if (fieldFree(x, y, 2, 1) && addProp('bamboo_bush', x, y, true)) b.take(x, y, 2, 1);
    // what is left of the field (a tile too narrow for a clump): undergrowth
    for (i = 0; i < W * Hh; i++) if (!open[i] && !b.taken[i] && !b.walls[i]) b.walls[i] = tg('bush');
    b.obj('wild', 'wild', 2, 1, W - 4, Hh - 3);
    return b.done();
  };

  // The Bamboo Hollows, one floor used for all 50 (as every place's cave): four short earth rooms held by bamboo roots,
  // with doorways between them (corners: the Javelin again), a green pool or two.
  L.jungleCaveMap = function (template) {
    var sets = K.copySets(template, ['indoor', 'props']), ind = named(sets, 'indoor');
    if (!ind) throw new Error('L.jungleCaveMap: the template has no indoor sheet');
    var props = K.propsOf(named(sets, 'props') || { tiles: [] });
    var W = 28, Hh = 18, b = K.build(W, Hh, sets), r = K.rng(2222), ig = function (n) { return ind.firstgid + n; };
    var VOID = 5, CAVE = 6, CAVE2 = 7, WALL = 8, TOP = 9, LADDER = 11, x, y;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) b.put(b.ground, x, y, ig(r() < 0.5 ? CAVE : CAVE2));
    for (x = 0; x < W; x++) { b.put(b.walls, x, 0, ig(TOP)); b.put(b.walls, x, Hh - 1, ig(TOP)); if (x > 0 && x < W - 1) b.put(b.walls, x, 1, ig(WALL)); }
    for (y = 0; y < Hh; y++) { b.put(b.walls, 0, y, ig(TOP)); b.put(b.walls, W - 1, y, ig(TOP)); }
    // the roots between the rooms: across the middle (its top, then its face), and down the middle; a doorway in each half
    for (x = 1; x < W - 1; x++) if (x !== 6 && x !== 7 && x !== 20 && x !== 21) { b.put(b.walls, x, 8, ig(TOP)); b.put(b.walls, x, 9, ig(WALL)); }
    for (y = 2; y < Hh - 1; y++) if (y !== 5 && y !== 6 && y !== 13 && y !== 14 && y !== 9) b.put(b.walls, 13, y, ig(TOP));
    b.put(b.walls, 13, 9, ig(WALL));
    // green pools
    [[22, 3, 3, 2], [3, 13, 2, 2], [16, 15, 3, 1]].forEach(function (p) { for (y = p[1]; y < p[1] + p[3]; y++) for (x = p[0]; x < p[0] + p[2]; x++) b.put(b.walls, x, y, ig(VOID)); });
    // the ladder up, by the way in (the lift stands left of it: 19zt-lair.js LIFT)
    b.put(b.walls, 5, 2, ig(LADDER));
    b.point('entrance', 'spawn', 5.5, 3.6, 'down');
    b.obj('exit', 'warp', 5, 2, 1, 1, [prop('to', 'string', 'jungle'), prop('spawn', 'string', 'from_dungeon'), prop('label', 'string', 'Climb out')]);
    b.obj('dungeon_gate', 'dungeon_gate', 23, 14, 2, 2);
    // roots and rocks along the rooms (the cave's colour: C.PLACES.jungle.dungeon.propTint)
    [['mossy_log', 9, 6], ['mushroom_rock', 18, 3], ['boulder_moss', 2, 7], ['mushroom_rock', 10, 15], ['mossy_log', 18, 12]].forEach(function (p) {
      var q = props[p[0]];
      if (!q) return;
      var o = b.obj(p[0], 'prop', p[1], p[2] + 1, q.w, q.h);
      o.gid = q.gid;
    });
    b.obj('wild', 'wild', 1, 2, W - 2, Hh - 3);
    return b.done();
  };

  // Where the bamboo stands on a built map: { W, H, at(x, y) } (each tall clump's solid tiles: its foot, and the bush
  // under its top; not the top of one leaning over a trail)
  L.jungleClumps = function (map) {
    var W = map.width, Hh = map.height, grid = new Uint8Array(W * Hh), ps = named(map.tilesets, 'props'), tall = {};
    var walls = map.layers.filter(function (l) { return l.name === 'Walls'; })[0].data;
    (ps ? ps.tiles : []).forEach(function (t) { (t.properties || []).forEach(function (p) { if (p.name === 'prop' && J.clumps.indexOf(p.value) >= 0) tall[ps.firstgid + t.id] = 1; }); });
    map.layers.filter(function (l) { return l.type === 'objectgroup'; })[0].objects.forEach(function (o) {
      if (!tall[o.gid]) return;
      var x0 = Math.round(o.x / 256), w = Math.round(o.width / 256), y1 = Math.round(o.y / 256) - 1, h = Math.round(o.height / 256);
      for (var yy = y1 - h + 1; yy <= y1; yy++) for (var xx = x0; xx < x0 + w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < Hh && (yy === y1 || walls[yy * W + xx])) grid[yy * W + xx] = 1;
    });
    return { W: W, H: Hh, grid: grid, at: function (x, y) { return x >= 0 && y >= 0 && x < W && y < Hh && grid[y * W + x] === 1; } };
  };
  // A shot from (x, y) going `ang` (radians) for `range` (all in tiles): how far it goes before tall bamboo more than
  // C.WILD.bambooFrom tiles out stops it, or null (it flies its whole way). Bamboo nearer than that it flies past.
  L.bambooStop = function (at, x, y, ang, range) {
    var c = Math.cos(ang), s = Math.sin(ang);
    for (var d = WI.bambooFrom + 0.125; d <= range; d += 0.25) if (at(Math.floor(x + c * d), Math.floor(y + s * d))) return d;
    return null;
  };
  // A zigzagging runner, `ms` into its run: radians off its straight line (one way, then the other)
  L.zigzagTurn = function (ms) { var z = WI.zigzag; return (Math.floor(ms / z.every) % 2 ? -1 : 1) * z.turn; };
  // A pair (flock: 2, the Baboy-damo) stands side by side, across its way, near enough for the Moon Javelin's pair hit
  // (C.WEAPON_PAIR); a flock of 3 stands in a line as before (the Plains').
  var flockSpot = L.flockSpot;
  L.flockSpot = function (x, y, ang, i, T, w, n) {
    if (n !== 2 || !i) return flockSpot.apply(this, arguments);
    var gap = WI.pairGap * (T || C.TILE);
    return { x: x - Math.sin(ang) * gap, y: y + Math.cos(ang) * gap };
  };

  // ---------- the goal arrow's way out: through Manila's Jungle Gate ----------
  var R = C.ROUTES;
  Object.keys(R).forEach(function (m) {
    if (m === 'jungle' || m === 'jungle_cave') return;
    R.jungle[m] = 'road_north';
    R[m].jungle = m === 'manila' ? 'jungle_gate' : R[m].manila;
    R[m].jungle_cave = R[m].jungle;
  });
  R.jungle.jungle_cave = 'dungeon_door';
})(window.Farm = window.Farm || {});
