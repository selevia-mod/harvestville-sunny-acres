// The Lost Tower, the rules (content 00-zzzzzzzzzzzzzzzzzzzzzz-tower.js; the world 19zzz...z-tower.js; the spec
// docs/superpowers/specs/2026-11-12-lost-tower-design.md). Pure, no Phaser:
// - each floor: its realm, its band (how many enemies, how big), its leader (guard, mini boss, big boss), its enemies in a
//   fixed order (L.towerRoster), how strong they are (L.towerHits, L.towerLoss, L.towerSpeed), the waves;
// - its room, built in code from its number (L.towerMap): the caves' layout (tools/make-map.js placeCave), the same for
//   every player, a different one every floor;
// - the deepest floor reached (the lift's stops), the deepest cleared, and the Pearls (L.towerPay);
// - the door in Manila (the lighthouse) and the save: s.pearls as 'prl', s.tower = { deep, cl, hd, hn } as 'tw2'. A game
//   closed in the Tower is saved in Manila at the lighthouse's door (floors are not saved, as in the caves).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TW = C.TOWER;
  var WI = C.WILD;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var fl = function (f) { return int(f, 1, TW.floors, 1); };

  // ---------- a floor ----------
  L.towerZone = function (f) { return Math.min(TW.zones.length, Math.ceil(fl(f) / TW.zoneSize)); };
  L.towerZoneOf = function (f) { return TW.zones[L.towerZone(f) - 1]; };
  var band = function (f) { f = fl(f); for (var i = 0; i < TW.bands.length; i++) if (f <= TW.bands[i][0]) return TW.bands[i]; return TW.bands[TW.bands.length - 1]; };
  L.towerCount = function (f) { return band(f)[1]; };
  L.towerSize = function (f) { var b = band(f); return [b[2], b[3]]; };
  // who leads it: 'boss' (ends in 00), 'mini' (50), 'guard' (10, 20, 30, 40, 60, 70, 80, 90) or null
  L.towerRole = function (f) {
    f = fl(f);
    var r = f % TW.zoneSize;
    if (r === 0) return 'boss';
    if (r === TW.zoneSize / 2) return 'mini';
    return r % TW.liftEvery === 0 ? 'guard' : null;
  };
  // how strong: hits to beat at damage 1, the energy a hit costs, the speed (role: a leader's, else a normal enemy's)
  var mul = function (role, k) { var r = role && TW.roles[role]; return r ? r[k] : 1; };
  L.towerHits = function (f, role) { return (TW.hits.base + Math.floor(fl(f) / TW.hits.per)) * mul(role, 'hp'); };
  L.towerLoss = function (f, role) { return Math.ceil((TW.loss.base + Math.floor(fl(f) / TW.loss.per)) * mul(role, 'hit')); };
  L.towerSpeed = function (f) { return 1 + Math.min(TW.speed.max, TW.speed.step * Math.floor(fl(f) / TW.speed.per)); };
  // The floor's enemies, in a fixed order: [{ slot, kind }], its leader first. From the floor alone: the same for everyone,
  // and never more for a team.
  L.towerRoster = function (f) {
    f = fl(f);
    var z = L.towerZoneOf(f), role = L.towerRole(f), out = [], n = L.towerCount(f);
    var add = function (kind) { out.push({ slot: out.length, kind: kind }); };
    if (role) add(z[role]);
    for (var i = 0; i < n; i++) add(z.normal[Math.floor(L.rand(TW.seed, f, i) * z.normal.length)]);
    return out;
  };
  // ---------- waves (C.TOWER.wave: 0 all at once; N, waves of N) ----------
  L.towerWaves = function (n, size) { return size > 0 ? Math.ceil(n / size) : 1; };
  L.towerInWave = function (roster, upTo, size) { return size > 0 ? roster.filter(function (e) { return Math.floor(e.slot / size) <= upTo; }) : roster.slice(); };
  // the next wave comes when the last is mostly down: at most waveLeft of it still up
  L.towerWaveDue = function (size, up) { return up <= Math.floor(size * TW.waveLeft); };

  // ---------- the deepest floor, the lift, the Pearls ----------
  var rec = function (s) { return s.tower || (s.tower = { deep: 0, cl: 0, hd: -1, hn: 0 }); };
  L.towerRec = rec;
  // Reached a floor: true when it is a new deepest (the lift stops there once it is one of 1, 11, 21 ...).
  L.towerReach = function (s, f) {
    var r = rec(s);
    f = fl(f);
    if (f <= r.deep) return false;
    r.deep = f;
    return true;
  };
  L.towerStops = function (s) {
    var deep = Math.max(1, rec(s).deep || 1), out = [];
    for (var f = 1; f <= deep; f += TW.liftEvery) out.push(f);
    return out;
  };
  // where the door takes you: the last lift you reached (owner: "you never start over from floor 1")
  L.towerStart = function (s) { var st = L.towerStops(s); return st[st.length - 1]; };
  // What clearing a floor pays the first time: realm z pays z, 5z (guard), 30z (mini boss), 100z (big boss).
  L.towerPearls = function (f) { return L.towerZone(f) * TW.pearls[L.towerRole(f) || 'normal']; };
  // The last enemy of floor f fell: the Pearls it pays (0 when none), added to s.pearls. A floor newer than the deepest
  // you have cleared pays its Pearls (alone or in a team, no team bonus). One you had cleared: nothing, unless you were
  // helping a friend clear it (opts.helper: 1 Pearl, at most 50 a day; with a team: L.towerTeamPay).
  L.towerPay = function (s, f, opts) {
    var r = rec(s), n = 0;
    f = fl(f);
    if (f > r.cl) {
      n = L.towerPearls(f);
      r.cl = f;
    } else if (opts && opts.helper) {
      if (r.hd !== s.day) { r.hd = s.day; r.hn = 0; }
      if (r.hn < TW.pearls.helperDay) { n = TW.pearls.helper; r.hn += n; }
    }
    s.pearls = (s.pearls || 0) + n;
    return n;
  };

  // The last enemy of floor f fell with a team on it (the game server's 'cl': docs/game-server.md, "Step 4"): what it pays
  // you. others: how many of the others on the floor had never cleared it. New to you: its first-time Pearls (no team
  // bonus). Cleared before: 1 helper Pearl (at most 50 a day) when one of the others is new to it; else nothing.
  L.towerTeamPay = function (s, f, others) { return L.towerPay(s, f, { helper: others > 0 }); };

  // A tower creature as a friend's phone or the game server says it (L.wildPack): its hits are its floor's (L.towerHits),
  // far more than its kind's own 2, so the list's cap is the strongest a floor makes it (01-logicD.js caps at the kind's).
  var wildUnpack = L.wildUnpack;
  L.wildUnpack = function (r) {
    var o = wildUnpack(r), def = o && WI.animals[o.kind];
    if (!def || !def.tower) return o;
    var top = L.towerHits(TW.floors, def.role === 'normal' ? null : def.role);
    o.hp = Math.max(0, Math.min(top, Number(r[7]) || 0));
    o.max = Math.max(1, Math.min(top, Number(r[10]) || 1));
    return o;
  };

  // ---------- a tower creature's charge ----------
  // The energy it costs: its floor's (the hit the world gives it, L.towerLoss), halved by a dish's power, never under 1.
  // The Fire Charm and the places' gear do not count in the Tower (the Keeper's gear will: L.towerLess, a later step).
  L.towerLess = function (s, lost) { return lost; };
  var chargeLoss = L.chargeLoss;
  L.chargeLoss = function (s, hit, kind) {
    var def = kind && WI.animals[kind];
    if (!def || !def.tower) return chargeLoss.apply(L, arguments);
    if (!(hit > 0)) return 0;
    return Math.max(1, L.towerLess(s, Math.ceil(hit / (L.power(s, 'charge') ? 2 : 1))));
  };
  // A hunt in the Tower: it counts as a hunt, but leaves no slot waiting (the floor is the floor) and no line in the
  // Hunter's Book (60 kinds would fill the save).
  var hunted = L.hunted;
  L.hunted = function (s, area, slot, kind, size) {
    var r = hunted.apply(L, arguments);
    if (area === 'tower') {
      delete s.wild.gone['tower:' + slot];
      if (WI.animals[kind] && WI.animals[kind].tower) { delete s.wild.by[kind]; delete s.wild.best[kind]; }
    }
    return r;
  };

  // ---------- a floor's room, built in code (like L.manilaMap) ----------
  // The caves' layout (tools/make-map.js placeCave): cave floor, the wall along the top, a ladder at (5, 2) with the way
  // in under it (the way out to Manila), the lift's tiles (2..3, 2..3) left free, the stairs up (a 2 x 2 'dungeon_gate'),
  // rock pillars, pools ('void', painted in the realm's colours) and props, each placed by a seed from the floor's number,
  // with a tile of floor all round each so every tile can be reached. base: a cave map whose tile sheets it uses (the Lair's).
  var ID = { void: 5, cave: 6, cave2: 7, cave_wall: 8, cave_top: 9, ladder_up: 11 };
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
  L.TOWER_KEEP = { x0: 1, y0: 2, x1: 7, y1: 5 }; // the way in: the ladder, the lift, where you arrive
  L.towerMap = function (floor, base) {
    floor = fl(floor);
    var sz = L.towerSize(floor), W = sz[0], H = sz[1], S = base.tilewidth, z = L.towerZoneOf(floor);
    var sets = base.tilesets.map(function (ts) { return JSON.parse(JSON.stringify(ts)); });
    var indoor = sets.filter(function (t) { return t.name === 'indoor'; })[0], props = sets.filter(function (t) { return t.name === 'props'; })[0];
    if (!indoor) throw new Error('L.towerMap: the base map has no indoor sheet');
    var r = rng(Math.floor(L.rand(TW.seed, floor, 7) * 4294967296));
    var gid = function (k) { return indoor.firstgid + ID[k]; };
    var layer = function () { var a = new Array(W * H); for (var i = 0; i < a.length; i++) a[i] = 0; return a; };
    var ground = layer(), walls = layer(), objects = [], id = 1, used = new Uint8Array(W * H);
    var put = function (l, x, y, g) { l[y * W + x] = g; };
    var rect = function (l, x0, y0, x1, y1, g) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { put(l, x, y, g); used[y * W + x] = 1; } };
    for (var i = 0; i < W * H; i++) ground[i] = gid(r() < 0.5 ? 'cave' : 'cave2');
    rect(walls, 0, 0, W - 1, 0, gid('cave_top'));
    rect(walls, 1, 1, W - 2, 1, gid('cave_wall'));
    rect(walls, 0, 0, 0, H - 1, gid('cave_top'));
    rect(walls, W - 1, 0, W - 1, H - 1, gid('cave_top'));
    rect(walls, 0, H - 1, W - 1, H - 1, gid('cave_top'));
    var K = L.TOWER_KEEP, keep = function (x0, y0, x1, y1) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) used[y * W + x] = 2; };
    keep(K.x0, K.y0, K.x1, K.y1);
    // a box (x0..x1, y0..y1) fits when it and a tile all round it are free floor inside the walls
    var fits = function (x0, y0, x1, y1) {
      if (x0 < 2 || y0 < 3 || x1 > W - 3 || y1 > H - 3) return false;
      for (var y = y0 - 1; y <= y1 + 1; y++) for (var x = x0 - 1; x <= x1 + 1; x++) if (used[y * W + x]) return false;
      return true;
    };
    var spot = function (w, h, ylo) { // a random place for a w x h box, or null
      for (var t = 0; t < 60; t++) {
        var x = 2 + Math.floor(r() * (W - 3 - w)), y = (ylo || 3) + Math.floor(r() * Math.max(1, H - 2 - h - (ylo || 3)));
        if (fits(x, y, x + w - 1, y + h - 1)) return [x, y];
      }
      return null;
    };
    // the stairs up: in the lower half, away from the way in
    var g = spot(2, 2, Math.floor(H / 2)) || [Math.floor(W / 2) - 1, H - 4];
    keep(g[0] - 1, g[1] - 1, g[0] + 2, g[1] + 2);
    objects.push({ id: id++, name: 'dungeon_gate', type: 'dungeon_gate', x: g[0] * S, y: g[1] * S, width: 2 * S, height: 2 * S, rotation: 0, visible: true });
    // pillars (the rock's top, its face below) and pools
    var area = W * H, k, p;
    for (k = Math.round(area / 170); k > 0; k--) {
      p = spot(2, 2);
      if (!p) continue;
      rect(walls, p[0], p[1], p[0] + 1, p[1], gid('cave_top'));
      rect(walls, p[0], p[1] + 1, p[0] + 1, p[1] + 1, gid('cave_wall'));
    }
    for (k = Math.round(area / 200); k > 0; k--) {
      var pw = 1 + Math.floor(r() * 3), ph = 1 + Math.floor(r() * 2);
      p = spot(pw, ph);
      if (p) rect(walls, p[0], p[1], p[0] + pw - 1, p[1] + ph - 1, gid('void'));
    }
    // props: the realm's, standing on their foot (solid), the rest of the picture over the floor behind
    var tiles = props ? props.tiles : [];
    for (k = Math.round(area / 220); k > 0 && tiles.length; k--) {
      var name = z.props[Math.floor(r() * z.props.length)];
      var t = tiles.filter(function (q) { return q.image && q.image.replace(/^.*\/|\.png$/g, '') === name; })[0];
      if (!t) continue;
      var tw = Math.round(t.imagewidth / 128), th = Math.round(t.imageheight / 128);
      p = spot(tw, th);
      if (!p) continue;
      for (var yy = p[1]; yy < p[1] + th; yy++) for (var xx = p[0]; xx < p[0] + tw; xx++) used[yy * W + xx] = 1;
      objects.push({ id: id++, name: name, type: 'prop', gid: props.firstgid + t.id, x: p[0] * S, y: (p[1] + th) * S, width: tw * S, height: th * S, rotation: 0, visible: true });
    }
    // the way in and out: the ladder up to Manila's lighthouse
    put(walls, 5, 2, gid('ladder_up'));
    objects.push({ id: id++, name: 'entrance', type: 'spawn', point: true, x: Math.round(5.5 * S), y: Math.round(3.6 * S), width: 0, height: 0, rotation: 0, visible: true, properties: [prop('dir', 'string', 'down')] });
    objects.push({ id: id++, name: 'exit', type: 'warp', x: 5 * S, y: 2 * S, width: S, height: S, rotation: 0, visible: true,
      properties: [prop('to', 'string', 'manila'), prop('spawn', 'string', 'from_tower'), prop('label', 'string', 'Go out')] });
    objects.push({ id: id++, name: 'wild', type: 'wild', x: S, y: 4 * S, width: (W - 2) * S, height: (H - 5) * S, rotation: 0, visible: true });
    var tl = function (lid, nm, data) { return { id: lid, name: nm, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: data }; };
    return {
      compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: W, height: H, tilewidth: S, tileheight: S, nextlayerid: 4, nextobjectid: id, floor: floor,
      layers: [tl(1, 'Ground', ground), tl(2, 'Walls', walls), { id: 3, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objects }],
      tilesets: sets,
    };
  };

  // ---------- the door: the lighthouse at the end of Manila Bay's breakwater ----------
  // Its door is the middle of its bottom row (its foot): face it from the breakwater and go in. Out again: in front of it.
  L.towerDoor = function () {
    var M = C.MANILA, b = M && M.buildings.filter(function (x) { return x.key === 'lighthouse'; })[0];
    if (!b) return null;
    var x = b.box[0] + Math.floor(b.box[2] / 2), y = b.box[1] + b.box[3] - 1;
    return { x: x, y: y, out: [x + 0.5, y + 1.6] };
  };
  var manilaMap = L.manilaMap;
  if (manilaMap) L.manilaMap = function () {
    var m = manilaMap.apply(L, arguments), d = L.towerDoor(), S = m.tilewidth;
    if (!d) return m;
    var og = m.layers.filter(function (l) { return l.type === 'objectgroup'; })[0];
    og.objects.push({ id: m.nextobjectid++, name: 'tower_door', type: 'warp', x: d.x * S, y: d.y * S, width: S, height: S, rotation: 0, visible: true,
      properties: [prop('to', 'string', 'tower'), prop('spawn', 'string', 'entrance'), prop('label', 'string', 'Go in')] });
    og.objects.push({ id: m.nextobjectid++, name: 'from_tower', type: 'place', point: true, x: Math.round(d.out[0] * S), y: Math.round(d.out[1] * S), width: 0, height: 0, rotation: 0, visible: true,
      properties: [prop('dir', 'string', 'down')] });
    return m;
  };
  // the goal arrow: out by the ladder, then the way out of Manila; in by the lighthouse's door
  var R = C.ROUTES;
  if (R && R.manila) {
    R.tower = {};
    Object.keys(R).forEach(function (m) {
      if (m === 'tower') return;
      R.tower[m] = 'exit';
      R[m].tower = m === 'manila' ? 'tower_door' : R[m].manila;
    });
  }

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.pearls = 0;
    s.tower = { deep: 0, cl: 0, hd: -1, hn: 0 };
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var d = s.map === 'tower' ? L.towerDoor() : null;
    // in the Tower: saved in Manila, in front of the lighthouse (floors are not saved: next time from the last lift)
    var o = serialize(d ? Object.assign({}, s, { map: 'manila', player: { x: Math.round(d.out[0] * C.TILE), y: Math.round(d.out[1] * C.TILE), dir: 'down' } }) : s);
    var r = s.tower || {};
    if (s.pearls > 0) o.prl = int(s.pearls, 0, 1e9, 0);
    if (r.deep || r.cl || r.hn) o.tw2 = [int(r.deep, 0, TW.floors, 0), int(r.cl, 0, TW.floors, 0), int(r.hd, -1, 1e7, -1), int(r.hn, 0, 1e4, 0)];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var a = o && Array.isArray(o.tw2) ? o.tw2 : [];
    s.pearls = int(o && o.prl, 0, 1e9, 0);
    s.tower = { deep: int(a[0], 0, TW.floors, 0), cl: int(a[1], 0, TW.floors, 0), hd: int(a[2], -1, 1e7, -1), hn: int(a[3], 0, 1e4, 0) };
    return s;
  };
})(window.Farm = window.Farm || {});
