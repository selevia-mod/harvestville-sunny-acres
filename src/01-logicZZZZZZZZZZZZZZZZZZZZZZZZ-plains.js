// The Open Plains, the rules (content 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-plains.js; the world 19zzz...z-plains.js).
// - The maps, built in code (no maps/plains.json: the page is nearly full): L.plainsMap(template) from Pulag's sheets,
//   L.plainsCaveMap(template) from a place cave's (the game server builds them the same way: server/lib/maps.js).
// - Flocks (C.WILD `flock: n`): a place's slots of one kind, n at a time, are one flock with a leader (L.flockOf); they
//   stand side by side behind it in a line (L.flockSpot), come and go together and run off together (the world).
// - The Tamaraw Calf's skill, carry: while it is the companion out, the bag has 6 more slots (L.carrySlots). Sent back
//   to the Lodge, what was in those 6 goes into the bag's free slots, else to the basket at home: nothing is lost.
// - The valley road (L.valleyVia): once the Plains are open it crosses them (town east end -> the Plains -> the Plains
//   Gate -> Manila). Before, or riding a horse that may not go into a hunting ground (8 hearts), it goes straight, as it
//   always did.
// - The Plains Halt's trough (L.troughDrink): the horse drinks, its stamina full at once.
// No new save key: the place saves as every place does (pl.plains, pk, pm); the bag's size is the companion's.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var PL = C.PLAINS;
  if (!PL || !C.PLACES.plains) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- the map ----------
  var prop = function (name, type, value) { return { name: name, type: type, value: value }; };
  var TT = { grass: 94, trail: 96, water: 34, sand: 93, fenceH: 41, fenceV: 48, fencePost: 55, treeTL: 61, treeTR: 62, treeBL: 68, treeBR: 69, bush: 75, sign: 85 };
  var rng = function (seed) { // (the same plains on every phone)
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // a props tileset's gid for a prop by name, and its size in tiles (props are 128 px a tile)
  var propsOf = function (ts) {
    var by = {};
    (ts.tiles || []).forEach(function (t) { (t.properties || []).forEach(function (p) { if (p.name === 'prop') by[p.value] = { gid: ts.firstgid + t.id, w: Math.round(t.imagewidth / 128), h: Math.round(t.imageheight / 128) }; }); });
    return by;
  };
  var build = function (W, Hh, sets) {
    var id = 1, objects = [], taken = new Uint8Array(W * Hh);
    var layer = function () { var a = new Array(W * Hh); for (var i = 0; i < a.length; i++) a[i] = 0; return a; };
    var b = { W: W, H: Hh, ground: layer(), walls: layer(), above: layer(), objects: objects, taken: taken };
    b.inMap = function (x, y) { return x >= 0 && y >= 0 && x < W && y < Hh; };
    b.put = function (l, x, y, gid) { if (b.inMap(x, y)) l[y * W + x] = gid; };
    b.take = function (x, y, w, h) { for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) if (b.inMap(xx, yy)) taken[yy * W + xx] = 1; };
    b.free = function (x, y, w, h) {
      for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) if (!b.inMap(xx, yy) || taken[yy * W + xx] || b.walls[yy * W + xx]) return false;
      return true;
    };
    b.obj = function (name, type, x, y, w, h, props) {
      var o = { id: id++, name: name, type: type, x: Math.round(x * 256), y: Math.round(y * 256), width: Math.round(w * 256), height: Math.round(h * 256), rotation: 0, visible: true };
      if (props) o.properties = props;
      objects.push(o);
      return o;
    };
    b.point = function (name, type, x, y, dir) {
      var o = b.obj(name, type, x, y, 0, 0, dir ? [prop('dir', 'string', dir)] : null);
      o.point = true;
      return o;
    };
    b.done = function () {
      var tl = function (lid, name, data) { return { id: lid, name: name, type: 'tilelayer', width: W, height: Hh, x: 0, y: 0, opacity: 1, visible: true, data: data }; };
      return {
        compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
        width: W, height: Hh, tilewidth: 256, tileheight: 256, nextlayerid: 5, nextobjectid: id,
        layers: [tl(1, 'Ground', b.ground), tl(2, 'Walls', b.walls), tl(3, 'Above', b.above),
          { id: 4, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objects }],
        tilesets: sets,
      };
    };
    return b;
  };
  var copySets = function (template, names) {
    return template.tilesets.filter(function (ts) { return names.indexOf(ts.name) >= 0; }).map(function (ts) { return JSON.parse(JSON.stringify(ts)); });
  };
  L.mapKit = { build: build, propsOf: propsOf, copySets: copySets, rng: rng, TT: TT, prop: prop }; // (the Jungle builds its maps the same way)

  // The Plains, 52 x 52: golden grass, the valley road across the middle (west: Willowbrook, east: Manila), few props in
  // the middle so you see far, the Plains Halt by the road, Ka Pedring's hut and his fenced Tamaraw meadow, a pond, the
  // windmill, and the low mesa in the far north-east with the door down to Sarangay's Halls. A ring of trees round it.
  L.plainsMap = function (template) {
    var sets = copySets(template, ['tiles', 'seasons', 'props']), tiles = sets.filter(function (t) { return t.name === 'tiles'; })[0];
    var props = propsOf(sets.filter(function (t) { return t.name === 'props'; })[0] || { tiles: [] });
    if (!tiles) throw new Error('L.plainsMap: the template has no tiles sheet');
    var W = PL.W, Hh = PL.H, b = build(W, Hh, sets), r = rng(20261118), tg = function (k) { return tiles.firstgid + TT[k]; };
    var R = PL.road, x, y;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) b.put(b.ground, x, y, tg('grass'));
    for (x = 0; x < W; x++) for (y = R.y; y < R.y + R.h; y++) b.put(b.ground, x, y, tg('trail'));
    b.take(0, R.y - 1, W, R.h + 2); // (the road and a tile either side stay clear)
    // the trail up to the mesa, and to the meadow's gate
    for (y = PL.door[1] + 1; y < R.y; y++) b.put(b.ground, PL.door[0], y, tg('trail'));
    b.take(PL.door[0] - 1, PL.door[1], 3, R.y - PL.door[1]);
    for (y = R.y + R.h; y <= PL.gateY; y++) b.put(b.ground, PL.meadow[0] - 2, y, tg('trail'));
    for (x = PL.meadow[0] - 2; x < PL.meadow[0]; x++) b.put(b.ground, x, PL.gateY, tg('trail'));
    b.take(PL.meadow[0] - 3, R.y + R.h, 3, PL.gateY - R.y - R.h + 2);
    // the ring of trees (2 x 2: the top in Above, the trunk in Walls), the road's two ends left open
    var tree = function (tx, ty) {
      b.put(b.above, tx, ty, tg('treeTL')); b.put(b.above, tx + 1, ty, tg('treeTR'));
      b.put(b.walls, tx, ty + 1, tg('treeBL')); b.put(b.walls, tx + 1, ty + 1, tg('treeBR'));
    };
    var road = function (ty) { return ty >= R.y - 1 && ty <= R.y + R.h; };
    for (x = 0; x < W; x += 2) { b.put(b.walls, x, 0, tg('treeBL')); b.put(b.walls, x + 1, 0, tg('treeBR')); tree(x, Hh - 2); }
    for (y = 1; y < Hh - 2; y += 2) {
      [0, W - 2].forEach(function (tx) {
        if (road(y) || road(y + 1)) { if (!road(y)) { b.put(b.walls, tx, y, tg('bush')); b.put(b.walls, tx + 1, y, tg('bush')); } return; }
        tree(tx, y);
        b.put(b.walls, tx, y, tg('bush')); b.put(b.walls, tx + 1, y, tg('bush')); // (under the crown: the edge is solid all the way)
      });
    }
    b.take(0, 0, W, 2); b.take(0, Hh - 3, W, 3); b.take(0, 0, 3, Hh); b.take(W - 3, 0, 3, Hh);
    // the pond: water with a sandy rim
    var pd = PL.pond;
    for (y = pd[1] - 1; y <= pd[1] + pd[3]; y++) for (x = pd[0] - 1; x <= pd[0] + pd[2]; x++) b.put(b.ground, x, y, tg('sand'));
    for (y = pd[1]; y < pd[1] + pd[3]; y++) for (x = pd[0]; x < pd[0] + pd[2]; x++) if (!((x === pd[0] || x === pd[0] + pd[2] - 1) && (y === pd[1] || y === pd[1] + pd[3] - 1))) b.put(b.ground, x, y, tg('water'));
    b.take(pd[0] - 1, pd[1] - 1, pd[2] + 2, pd[3] + 2);
    // Ka Pedring's meadow: a fence all round, its gate (the owner's picture, open) in the left side: you may walk in to see
    // the herd; no wild animal goes in (the world keeps them out)
    var md = PL.meadow, x1 = md[0] + md[2] - 1, y1 = md[1] + md[3] - 1;
    for (x = md[0]; x <= x1; x++) [md[1], y1].forEach(function (fy) { b.put(b.walls, x, fy, tg(x === md[0] || x === x1 ? 'fencePost' : 'fenceH')); });
    for (y = md[1] + 1; y < y1; y++) [md[0], x1].forEach(function (fx) { if (!(fx === md[0] && (y === PL.gateY || y === PL.gateY - 1))) b.put(b.walls, fx, y, tg('fenceV')); });
    b.take(md[0] - 1, md[1] - 1, md[2] + 2, md[3] + 2);
    // the low mesa: the cave's mouth (the owner's picture, 19zt-lair.js) with big boulders either side; nothing else near
    var ms = PL.mesa, dr = PL.door;
    b.take(ms[0] - 1, ms[1], ms[2] + 2, ms[3] + 1);

    // ---------- objects ----------
    var addProp = function (name, tx, ty, solid) { // (its foot on row ty; the picture stands up from there)
      var p = props[name];
      if (!p) return false;
      var o = b.obj(name, 'prop', tx, ty + 1 - p.h, p.w, p.h);
      o.gid = p.gid;
      if (solid !== false) b.take(tx, ty + 1 - p.h, p.w, p.h);
      return true;
    };
    // the way out each end of the valley road, and where you come in
    b.obj('road_west', 'warp', 0, R.y, 1, R.h, [prop('to', 'string', 'town'), prop('spawn', 'string', 'from_manila'), prop('walk', 'bool', true)]);
    b.obj('road_east', 'warp', W - 1, R.y, 1, R.h, [prop('to', 'string', 'manila'), prop('spawn', 'string', 'from_valley'), prop('walk', 'bool', true)]);
    b.point('from_town', 'spawn', 2.5, R.y + 1.0, 'right');
    b.point('from_city', 'spawn', W - 2.5, R.y + 1.0, 'left');
    // the cave's door in the mesa (as every place's: the mouth's point, the door, where you come back up)
    b.point('dungeon_mouth', 'place', dr[0] + 0.5, dr[1] + 1, null);
    b.obj('dungeon_door', 'warp', dr[0], dr[1], 1, 1, [prop('to', 'string', 'plains_cave'), prop('spawn', 'string', 'entrance'), prop('walk', 'bool', true)]);
    b.point('from_dungeon', 'spawn', dr[0] + 0.5, dr[1] + 1.7, 'down');
    // signs
    var sign = function (name, tx, ty, text) { b.put(b.walls, tx, ty, tg('sign')); b.obj(name, 'sign', tx, ty, 1, 1, [prop('text', 'string', text)]); b.take(tx, ty, 1, 1); };
    sign('sign_plains_w', 4, R.y - 2, 'THE OPEN PLAINS\nEast along the valley road: the Plains Halt, then Manila. West: Willowbrook.');
    sign('sign_plains_e', W - 5, R.y + R.h + 1, 'THE OPEN PLAINS\nWest along the valley road: the Plains Halt, then Willowbrook. East: Manila\'s Plains Gate.');
    sign('sign_halls', dr[0] + 2, R.y - 2, "SARANGAY'S HALLS\nNorth, in the mesa: the way down. 50 floors. Bring bullets.");
    // the Plains Halt: the shelter, the trough, a hitching post; the trough is an object the world gives a button
    var h = PL.halt;
    addProp('trader_tent', h.box[0], h.box[1] + h.box[3] - 1);
    addProp('flowerbed', h.trough[0], h.trough[1]);
    b.obj('trough', 'trough', h.trough[0], h.trough[1], 2, 1);
    addProp('lamp', h.hitch[0], h.hitch[1]);
    // Ka Pedring's hut and the meadow's gate; the herd is drawn by the world
    addProp('shack', PL.hut[0], PL.hut[1] + PL.hut[2] - 1);
    addProp('flower_arch', md[0] - 1, PL.gateY, false); // (foot 0: you walk through it)
    b.obj('meadow', 'meadow', md[0] + 1, md[1] + 1, md[2] - 2, md[3] - 2);
    // the windmill
    addProp('pine_tree', PL.windmill[0], PL.windmill[1]);
    b.take(PL.windmill[0] - 1, PL.windmill[1] - 2, 4, 4);
    // the chests' tiles and the guide's, kept free
    C.PLACES.plains.chests.forEach(function (c) { b.take(c[0] - 1, c[1] - 1, 3, 3); });
    var at = C.PLACES.plains.npc.at;
    b.take(at[0] - 1, at[1] - 1, 3, 3);
    // the mesa's boulders
    [[dr[0] - 4, dr[1] + 1], [dr[0] + 3, dr[1] + 1], [dr[0] - 5, dr[1] - 1], [dr[0] + 4, dr[1] - 1]].forEach(function (p) { addProp('boulder_moss', p[0], p[1]); });
    // scattered: flat-topped trees and boulders round the edges, cogon clumps, haystacks, ranch fence, wildflowers (few in
    // the middle: the plains are wide open)
    var edge = function (tx, ty) { return tx < 12 || tx > W - 13 || ty < 10 || ty > Hh - 11; };
    var scatter = function (name, n, w, hh, wantEdge) {
      for (var k = 0, tries = 0; k < n && tries < 400; tries++) {
        var tx = 3 + Math.floor(r() * (W - 6 - w)), ty = 3 + Math.floor(r() * (Hh - 6 - hh));
        if (wantEdge && !edge(tx, ty)) continue;
        if (!b.free(tx - 1, ty - hh, w + 2, hh + 2)) continue;
        if (addProp(name, tx, ty)) k++;
      }
    };
    scatter('rainforest_tree', 7, 2, 2, true);
    scatter('boulder_moss', 6, 2, 2, true);
    scatter('mossy_log', 4, 3, 2, true);
    scatter('pumpkin_pile', 5, 2, 1, false);
    scatter('tall_grass', 26, 1, 1, false);
    scatter('wildflowers', 10, 2, 1, false);
    // the wild animals' zone: inside the ring of trees (not the meadow: the world keeps them out of it)
    b.obj('wild', 'wild', 2, 2, W - 4, Hh - 4);
    return b.done();
  };

  // Sarangay's Halls, one floor used for all 50 (as every place's cave): long straight sandstone halls (the Rifle again),
  // two of them, one above the other, with a long wall between and an amber pool or two.
  L.plainsCaveMap = function (template) {
    var sets = copySets(template, ['indoor', 'props']), ind = sets.filter(function (t) { return t.name === 'indoor'; })[0];
    if (!ind) throw new Error('L.plainsCaveMap: the template has no indoor sheet');
    var props = propsOf(sets.filter(function (t) { return t.name === 'props'; })[0] || { tiles: [] });
    var W = 30, Hh = 14, b = build(W, Hh, sets), r = rng(5050), ig = function (n) { return ind.firstgid + n; };
    var VOID = 5, CAVE = 6, CAVE2 = 7, WALL = 8, TOP = 9, LADDER = 11, x, y;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) b.put(b.ground, x, y, ig(r() < 0.5 ? CAVE : CAVE2));
    for (x = 0; x < W; x++) { b.put(b.walls, x, 0, ig(TOP)); b.put(b.walls, x, Hh - 1, ig(TOP)); if (x > 0 && x < W - 1) b.put(b.walls, x, 1, ig(WALL)); }
    for (y = 0; y < Hh; y++) { b.put(b.walls, 0, y, ig(TOP)); b.put(b.walls, W - 1, y, ig(TOP)); }
    // the long wall between the two halls (its top, then its face), open at both ends
    for (x = 9; x <= 22; x++) { b.put(b.walls, x, 7, ig(TOP)); b.put(b.walls, x, 8, ig(WALL)); }
    // amber pools
    [[25, 3, 3, 2], [3, 10, 3, 2], [14, 11, 2, 1]].forEach(function (p) { for (y = p[1]; y < p[1] + p[3]; y++) for (x = p[0]; x < p[0] + p[2]; x++) b.put(b.walls, x, y, ig(VOID)); });
    // the ladder up, by the way in (the lift stands left of it: 19zt-lair.js LIFT)
    b.put(b.walls, 5, 2, ig(LADDER));
    b.point('entrance', 'spawn', 5.5, 3.6, 'down');
    b.obj('exit', 'warp', 5, 2, 1, 1, [prop('to', 'string', 'plains'), prop('spawn', 'string', 'from_dungeon'), prop('label', 'string', 'Climb out')]);
    b.obj('dungeon_gate', 'dungeon_gate', 25, 10, 2, 2);
    // a few rocks along the halls (the cave's colour: C.PLACES.plains.dungeon.propTint)
    [['mushroom_rock', 12, 3], ['mushroom_rock', 20, 5], ['boulder_moss', 7, 12], ['mushroom_rock', 19, 12]].forEach(function (p) {
      var q = props[p[0]];
      if (!q) return;
      var o = b.obj(p[0], 'prop', p[1], p[2] + 1 - q.h, q.w, q.h);
      o.gid = q.gid;
    });
    b.obj('wild', 'wild', 1, 2, W - 2, Hh - 3);
    return b.done();
  };
  L.plainsInMeadow = function (tx, ty) { var m = PL.meadow; return tx > m[0] && tx < m[0] + m[2] - 1 && ty > m[1] && ty < m[1] + m[3] - 1; };

  // ---------- flocks ----------
  // The flock a slot of an area is in: { lead, slots, i } (i: its place behind the leader), or null (not a flock animal).
  // A place's slots of one kind (its animals, or one line of its extras) are cut into flocks of `flock`, in slot order.
  L.flockOf = function (area, slot) {
    var list = L.wildSlots(area), me = null, k;
    for (k = 0; k < list.length; k++) if (list[k].slot === slot) { me = list[k]; break; }
    var n = me && WI.animals[me.kind] && WI.animals[me.kind].flock;
    if (!n || n < 2) return null;
    var same = list.filter(function (e) { return e.kind === me.kind && (e.when || '') === (me.when || ''); }).map(function (e) { return e.slot; });
    var j = same.indexOf(slot), at = Math.floor(j / n) * n, slots = same.slice(at, at + n);
    return { lead: slots[0], slots: slots, i: j - at };
  };
  // Where the i-th of a flock stands behind its leader at (x, y) going `ang` (radians): in a line behind it, a little to
  // one side and the other (side by side; one behind the other for the Moon Rifle's shot). In world units. w: the
  // animal's width in tiles (a deer stands further apart than a quail: never on top of each other).
  L.flockSpot = function (x, y, ang, i, T, w) {
    if (!i) return { x: x, y: y };
    var gap = WI.flockGap * Math.max(1, w || 1) * (T || C.TILE), side = (i % 2 ? 1 : -1) * 0.35 * gap;
    return { x: x - Math.cos(ang) * gap * i - Math.sin(ang) * side, y: y - Math.sin(ang) * gap * i * 0.7 + Math.cos(ang) * side };
  };

  // ---------- the Tamaraw Calf carries your things ----------
  var carrying = 0; // (a save loading with the calf out: its bag is sized before the companion is read)
  L.carrySlots = function (s) {
    if (carrying) return carrying;
    var skill = s && s.comp && L.companionSkill ? L.companionSkill(s) : null;
    return skill && C.COMPANION_SKILLS[skill] && C.COMPANION_SKILLS[skill].slots || 0;
  };
  var bagLevel = L.bagLevel;
  L.bagLevel = function (s) {
    var c = L.carrySlots(s);
    if (!c) return bagLevel(s);
    var v = Object.create(s);
    v.inv = { length: s.inv.length - c };
    return bagLevel(v);
  };
  var resizeBag = L.resizeBag;
  L.resizeBag = function (s, level) {
    resizeBag(s, level);
    var c = L.carrySlots(s);
    if (!c) return;
    var probe = Object.create(s); // (the size the bag would have without the calf: the Saddlebags' slots too)
    probe.inv = [];
    resizeBag(probe, level);
    while (s.inv.length < probe.inv.length + c) s.inv.push(null);
  };
  var nextBag = L.nextBag;
  L.nextBag = function (s) { var b = nextBag(s); if (b) b.size += L.carrySlots(s); return b; };
  // the bag after the companion changed: c more slots, or the last -c gone (their things into the bag, else the basket)
  var fitBag = function (s, c) {
    var i;
    if (c > 0) { for (i = 0; i < c; i++) s.inv.push(null); return 0; }
    var gone = s.inv.splice(s.inv.length + c, -c), home = 0;
    gone.forEach(function (x) {
      if (!x) return;
      var left = L.addItem(s, x.id, x.n);
      if (left) { s.basket = s.basket || {}; s.basket[x.id] = Math.min(999, (s.basket[x.id] || 0) + left); home += left; }
    });
    if (s.sel >= s.inv.length) s.sel = s.inv.length - 1;
    return home;
  };
  var setCompanion = L.setCompanion;
  L.setCompanion = function (s, id) {
    var before = L.carrySlots(s), r = setCompanion(s, id);
    if (r === 'ok') s.carryHome = fitBag(s, L.carrySlots(s) - before);
    return r;
  };
  var feedTame = L.feedTame;
  L.feedTame = function (s, id, rnd) {
    var before = L.carrySlots(s), r = feedTame(s, id, rnd);
    if (r === 'tame') fitBag(s, L.carrySlots(s) - before);
    return r;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var pl = o && o.pl && o.pl[o.cp], skill = o && typeof o.cp === 'string' && C.PLACES[o.cp] && C.PLACES[o.cp].tame && C.PLACES[o.cp].tame.skill;
    carrying = Array.isArray(pl) && pl[4] && skill && C.COMPANION_SKILLS[skill] ? C.COMPANION_SKILLS[skill].slots || 0 : 0;
    var s;
    try { s = deserialize(o); } finally { carrying = 0; }
    return s;
  };

  // ---------- the valley road ----------
  // Does the valley road cross the Plains now? Once they are open (30 hunts); riding, only on a horse that may go into a
  // hunting ground (8 hearts and Horseshoes): a horse that may only take the road (6 hearts) takes you straight through,
  // as before.
  L.valleyVia = function (s, riding) {
    if (!C.MANILA || !C.MANILA.on || !L.wildOpen(s, 'plains')) return false;
    return !riding || !!L.horseMayGo(s, 'plains').ok;
  };

  // ---------- the Plains Halt ----------
  // The horse drinks at the trough: 'ok' (its stamina full at once), 'full' (it is not thirsty), 'none' (no horse)
  L.troughDrink = function (s) {
    if (!s.horse) return 'none';
    if (L.horseStamina(s) >= C.HORSE_OUT.stamina) return 'full';
    delete s.horse.st;
    s.horse.rg = L.nowMin();
    return 'ok';
  };

  // ---------- the goal arrow's way out, and not in Kanor's Jeep ----------
  var R = C.ROUTES;
  Object.keys(R).forEach(function (m) {
    if (m === 'plains' || m === 'plains_cave') return;
    R.plains[m] = m === 'manila' || (R.town && R.town[m] === 'road_east') ? 'road_east' : 'road_west'; // (what is reached through Manila: east)
    R[m].plains = m === 'town' ? 'road_east' : m === 'manila' ? 'plains_gate' : R[m].town;
    R[m].plains_cave = R[m].plains;
  });
  R.plains.plains_cave = 'dungeon_door';
  var jeepPlaces = L.jeepPlaces;
  L.jeepPlaces = function (s) { return jeepPlaces(s).filter(function (e) { return !C.PLACES[e.id].noJeep; }); };
  void int;
})(window.Farm = window.Farm || {});
