// The Rocky Gorge, the rules (content 00-zzz...z-gorge.js; the world 19zzz...z-gorge.js).
// - The maps, built in code with the Plains' kit (L.mapKit): L.gorgeMap(template) from Pulag's sheets, L.gorgeCaveMap(template)
//   from a place cave's (the game server builds them the same way: server/lib/maps.js). The canyon's cliffs are two tiles
//   of the tiles sheet made solid in this map's own copy of it (C.GORGE.tiles: the top, the face), painted with the owner's
//   textures by the world.
// - Flocks abreast (`abreast: true`): a row on a ledge, the leader in the middle, the others 1 tile to each side in turn
//   (L.flockSpot), each next to the next: inside C.WEAPON_PAIR, so the Moon Boomerang's pair hit finds one.
// - The Echo Caves' flocks: a floor's creatures come three of a kind together (L.dunRoster), one flock (L.caveFlockOf).
// - The Ibong Adarna's song (L.adarnaSong): who stands still.
// No new save key: the place saves as every place does (pl.gorge, pk, pm).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var G = C.GORGE;
  if (!G || !C.PLACES.gorge || !L.mapKit) return;
  var K = L.mapKit, prop = K.prop;
  var named = function (sets, n) { return sets.filter(function (t) { return t.name === n; })[0]; };
  // this map's copy of a sheet: these tiles solid
  var solidTiles = function (ts, ids) {
    ts.tiles = ts.tiles || [];
    ids.forEach(function (id) {
      var t = ts.tiles.filter(function (x) { return x.id === id; })[0];
      if (!t) ts.tiles.push(t = { id: id, properties: [] });
      t.properties = (t.properties || []).filter(function (p) { return p.name !== 'collides'; }).concat([{ name: 'collides', type: 'bool', value: true }]);
    });
  };

  // The Gorge, 52 x 52: a canyon floor between cliffs (4 tiles each side, 4 at the top with a 2-tile face under them, 2 at
  // the bottom with the gap back to Manila); the stream down the middle with two rope bridges; the ledges along both sides
  // (a shelf with a face under it, an outcrop above it, open at its inner end); Tata Ambo's camp by the gate; the cave's
  // door in the north face.
  L.gorgeMap = function (template) {
    var sets = K.copySets(template, ['tiles', 'seasons', 'props']), tiles = named(sets, 'tiles');
    if (!tiles) throw new Error('L.gorgeMap: the template has no tiles sheet');
    solidTiles(tiles, [G.tiles.top, G.tiles.face, G.tiles.faceHi, G.tiles.faceLo]);
    var props = K.propsOf(named(sets, 'props') || { tiles: [] });
    var W = G.W, Hh = G.H, b = K.build(W, Hh, sets), r = K.rng(20261123), x, y;
    var tg = function (k) { return tiles.firstgid + (G.tiles[k] != null ? G.tiles[k] : K.TT[k]); };
    var R = G.rim, gx = G.gate[0], dr = G.door, st = G.stream;
    var set = function (tx, ty, k) { if (b.inMap(tx, ty)) { b.put(b.ground, tx, ty, tg(k)); if (k !== 'floor') b.take(tx, ty, 1, 1); } };
    var row = function (x0, w, ty, k) { for (var xx = x0; xx < x0 + w; xx++) set(xx, ty, k); };
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) set(x, y, x < R || x >= W - R || y < R || y >= Hh - 2 ? 'top' : 'floor');
    for (y = R; y < R + G.face; y++) row(R, W - 2 * R, y, y === R ? 'faceHi' : 'faceLo');
    [Hh - 2, Hh - 1].forEach(function (yy) { set(gx, yy, 'floor'); set(gx + 1, yy, 'floor'); }); // (the gap back to Manila)
    G.ledges.forEach(function (l) { row(l[0], l[2], l[1] - 2, 'top'); row(l[0], l[2], l[1] - 1, 'face'); row(l[0], l[2], l[1] + l[3], 'face'); });
    set(dr[0], dr[1], 'floor'); // (the cave's door, in the face)
    // the stream (water), but where a rope bridge crosses
    for (y = st[1]; y < st[1] + st[3]; y++) {
      if (G.bridges.some(function (by) { return y === by || y === by + 1; })) continue;
      for (x = st[0]; x < st[0] + st[2]; x++) { b.put(b.ground, x, y, tg('water')); b.take(x, y, 1, 1); }
    }

    // ---------- objects ----------
    var addProp = function (name, tx, foot, keep, w, h) { // (its foot on row `foot`; w, h: drawn this size, not the sheet's)
      var p = props[name];
      if (!p) return false;
      var o = b.obj(name, 'prop', tx, foot + 1, w || p.w, h || p.h);
      o.gid = p.gid;
      if (!keep) b.take(Math.floor(tx), foot + 1 - p.h, p.w, p.h);
      return true;
    };
    var sign = function (name, tx, ty, text) { b.put(b.walls, tx, ty, tiles.firstgid + K.TT.sign); b.obj(name, 'sign', tx, ty, 1, 1, [prop('text', 'string', text)]); b.take(tx, ty, 1, 1); };
    b.obj('road_south', 'warp', gx, Hh - 1, 2, 1, [prop('to', 'string', 'manila'), prop('spawn', 'string', 'from_gorge'), prop('walk', 'bool', true)]);
    b.point('from_city', 'spawn', gx + 1, Hh - 3.4, 'up');
    b.point('dungeon_mouth', 'place', dr[0] + 0.5, dr[1] + 1, null);
    b.obj('dungeon_door', 'warp', dr[0], dr[1], 1, 1, [prop('to', 'string', 'gorge_cave'), prop('spawn', 'string', 'entrance'), prop('walk', 'bool', true)]);
    b.point('from_dungeon', 'spawn', dr[0] + 0.5, dr[1] + 1.7, 'down');
    b.take(dr[0] - 2, dr[1] - 1, 5, 4);
    b.take(gx - 1, Hh - 6, 4, 6);
    sign('sign_gorge', gx - 2, Hh - 4, 'THE ROCKY GORGE\nSouth: the gate back to Manila. North, past the rope bridges: the Echo Caves.');
    sign('sign_echo', dr[0] - 2, dr[1] + 2, 'THE ECHO CAVES\nThe way down is in the cliff. 50 floors. Bring a Boomerang.');
    // the rope bridges (walk-on), the waterfall at the stream's head, Tata Ambo's camp, his pulley, the shell horn, the lookout
    G.bridges.forEach(function (by) { addProp('flower_arch', st[0] - 1.4, by + 1, true, st[2] + 2.8, (st[2] + 2.8) / 1.6); b.take(st[0] - 1, by - 1, st[2] + 2, 4); });
    addProp('rainforest_tree', G.falls[0], G.falls[1] + 1);
    addProp('trader_tent', G.camp[0], G.camp[1]);
    addProp('lamp', G.pulley[0], G.pulley[1]);
    addProp('lantern', G.horn[0], G.horn[1]);
    addProp('gazebo', G.lookout[0], G.lookout[1]);
    C.PLACES.gorge.chests.forEach(function (c) { b.take(c[0] - 1, c[1] - 1, 3, 3); });
    var at = C.PLACES.gorge.npc.at;
    b.take(at[0] - 1, at[1] - 1, 3, 3);
    // on each ledge a flat rock at its back, by the cliff
    G.ledges.forEach(function (l) { var lx = l[0] < W / 2 ? l[0] : l[0] + l[2] - 3; if (b.free(lx, l[1], 3, 1)) addProp('mossy_log', lx, l[1]); b.take(l[0], l[1], l[2], l[3]); });
    // scattered on the canyon floor: boulders, thorny grass, crystals, cairns, a few pines by the cliffs
    var scatter = function (name, n, w, hh, edge) {
      for (var k = 0, tries = 0; k < n && tries < 500; tries++) {
        var tx = R + Math.floor(r() * (W - 2 * R - w)), ty = R + G.face + hh + Math.floor(r() * (Hh - R - G.face - hh - 3));
        if (edge && !(tx < R + 3 || tx > W - R - 3 - w)) continue;
        if (!b.free(tx - 1, ty - hh, w + 2, hh + 2)) continue;
        if (addProp(name, tx, ty)) k++;
      }
    };
    scatter('pine_tree', 5, 2, 4, true);
    scatter('boulder_moss', 9, 2, 2);
    scatter('statue', 4, 2, 3);
    scatter('fern_bush', 8, 2, 2);
    scatter('mushroom_rock', 10, 1, 1);
    b.obj('wild', 'wild', R, R + G.face, W - 2 * R, Hh - R - G.face - 2);
    return b.done();
  };

  // The Echo Caves, one floor used for all 50: two wide crystal halls, one above the other, with two wide ways between
  // (groups gather: the Boomerang again), blue pools.
  L.gorgeCaveMap = function (template) {
    var sets = K.copySets(template, ['indoor', 'props']), ind = named(sets, 'indoor');
    if (!ind) throw new Error('L.gorgeCaveMap: the template has no indoor sheet');
    var props = K.propsOf(named(sets, 'props') || { tiles: [] });
    var W = 30, Hh = 18, b = K.build(W, Hh, sets), r = K.rng(2323), ig = function (n) { return ind.firstgid + n; };
    var VOID = 5, CAVE = 6, CAVE2 = 7, WALL = 8, TOP = 9, LADDER = 11, x, y;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) b.put(b.ground, x, y, ig(r() < 0.5 ? CAVE : CAVE2));
    for (x = 0; x < W; x++) { b.put(b.walls, x, 0, ig(TOP)); b.put(b.walls, x, Hh - 1, ig(TOP)); if (x > 0 && x < W - 1) b.put(b.walls, x, 1, ig(WALL)); }
    for (y = 0; y < Hh; y++) { b.put(b.walls, 0, y, ig(TOP)); b.put(b.walls, W - 1, y, ig(TOP)); }
    for (x = 1; x < W - 1; x++) if (!(x >= 7 && x <= 9) && !(x >= 20 && x <= 22)) { b.put(b.walls, x, 9, ig(TOP)); b.put(b.walls, x, 10, ig(WALL)); }
    [[25, 3, 3, 2], [3, 14, 2, 2], [14, 5, 2, 1], [15, 15, 3, 1]].forEach(function (p) { for (y = p[1]; y < p[1] + p[3]; y++) for (x = p[0]; x < p[0] + p[2]; x++) b.put(b.walls, x, y, ig(VOID)); });
    b.put(b.walls, 5, 2, ig(LADDER));
    b.point('entrance', 'spawn', 5.5, 3.6, 'down');
    b.obj('exit', 'warp', 5, 2, 1, 1, [prop('to', 'string', 'gorge'), prop('spawn', 'string', 'from_dungeon'), prop('label', 'string', 'Climb out')]);
    b.obj('dungeon_gate', 'dungeon_gate', 25, 14, 2, 2);
    [['mushroom_rock', 11, 3], ['mushroom_rock', 19, 6], ['boulder_moss', 2, 7], ['mushroom_rock', 12, 15], ['mushroom_rock', 21, 12], ['boulder_moss', 27, 7]].forEach(function (p) {
      var q = props[p[0]];
      if (!q) return;
      var o = b.obj(p[0], 'prop', p[1], p[2] + 1, q.w, q.h);
      o.gid = q.gid;
    });
    b.obj('wild', 'wild', 1, 2, W - 2, Hh - 3);
    return b.done();
  };

  // ---------- flocks abreast ----------
  var flockSpot = L.flockSpot;
  L.flockSpot = function (x, y, ang, i, T, w, n, def) {
    if (!(def && def.abreast) || !i) return flockSpot.apply(this, arguments);
    var gap = WI.rowGap * (T || C.TILE), k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    return { x: x + k * gap, y: y + (i % 2 ? 0.12 : -0.12) * gap };
  };
  // A ledge's tile where a flock of n can stand in a row (its leader in the middle), or null: rnd() picks
  L.gorgeLedgeSpot = function (n, rnd) {
    var l = G.ledges[Math.floor(rnd() * G.ledges.length)], half = Math.ceil(((n || 1) - 1) / 2);
    if (l[2] < 2 * half + 1) return null;
    return [l[0] + half + Math.floor(rnd() * (l[2] - 2 * half)), l[1] + Math.floor(rnd() * l[3])];
  };
  L.gorgeOnLedge = function (tx, ty) { return G.ledges.some(function (l) { return tx >= l[0] && tx < l[0] + l[2] && ty >= l[1] && ty < l[1] + l[3]; }); };

  // ---------- the Echo Caves: three of a kind together ----------
  var dunRoster = L.dunRoster;
  L.dunRoster = function (key, floor) {
    var out = dunRoster(key, floor);
    if (key !== 'gorge_cave') return out;
    var from = out.length && WI.animals[out[0].kind].boss ? 1 : 0;
    for (var i = from; i < out.length; i++) {
      var lead = out[i - ((i - from) % 3)], def = WI.animals[lead.kind];
      if (def.flock) out[i].kind = lead.kind;
    }
    return out;
  };
  // The flock a cave creature is in: { lead, slots, i }, or null
  L.caveFlockOf = function (key, floor, slot) {
    var list = L.dunRoster(key, floor), me = list[slot], def = me && WI.animals[me.kind];
    if (!def || !def.flock) return null;
    var j = slot;
    while (j > 0 && list[j - 1].kind === me.kind) j--;
    var at = j + Math.floor((slot - j) / def.flock) * def.flock, slots = [];
    for (var k = at; k < list.length && k < at + def.flock && list[k].kind === me.kind; k++) slots.push(k);
    return { lead: slots[0], slots: slots, i: slot - at };
  };

  // ---------- the Ibong Adarna's song ----------
  // Who stands still when one at (x, y) sings: every animal near it (itself too), each { x, y, hp } in world units
  L.adarnaSong = function (list, x, y, T) {
    var reach = WI.song.reach * (T || C.TILE);
    return list.filter(function (b) { return b.hp > 0 && Math.hypot(b.x - x, b.y - y) <= reach; });
  };

  // ---------- the goal arrow's way out: through Manila's Gorge Gate ----------
  var R = C.ROUTES;
  Object.keys(R).forEach(function (m) {
    if (m === 'gorge' || m === 'gorge_cave') return;
    R.gorge[m] = 'road_south';
    R[m].gorge = m === 'manila' ? 'gorge_gate' : R[m].manila;
    R[m].gorge_cave = R[m].gorge;
  });
  R.gorge.gorge_cave = 'dungeon_door';
})(window.Farm = window.Farm || {});
