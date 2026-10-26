// Rules for outdoor decorations on the farm (content in 00-outdoor.js): what the farm map leaves free to build
// on, buying into storage, placing, moving and putting away, fences that join their neighbours, beauty (added
// to Home Beauty), the save, and moving older saves onto the wider farm. Wraps the earlier logic files.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = C.OUTDOOR;
  var MAX_ITEMS = 300; // keeps the save small

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.yard = L.newYard();
    return s;
  };

  L.newYard = function () {
    var bag = {};
    O.starter.forEach(function (e) { bag[O.index[e[0]]] = e[1]; });
    return { items: [], bag: bag };
  };

  // ---------- the farm map: where things can go ----------
  // From the farm's Tiled map: noPlace (1 = nothing can be built here: the field, water, buildings, trees, fences,
  // doors, signs, the pen, the dog's yard...), solid (1 = can't walk here), start (the tile outside the house) and
  // needs (groups of tiles; each group must stay reachable from the start: every door, the field, the pen...).
  L.farmInfo = function (map) {
    var W = map.width, H = map.height, T = map.tilewidth, n = W * H;
    var noPlace = new Uint8Array(n), solid = new Uint8Array(n), props = {}, needs = [], start = -1, field = [];
    map.tilesets.forEach(function (ts) {
      (ts.tiles || []).forEach(function (t) {
        var o = {};
        (t.properties || []).forEach(function (p) { o[p.name] = p.value; });
        props[ts.firstgid + t.id] = o;
      });
    });
    map.layers.forEach(function (l) {
      if (l.type !== 'tilelayer' || l.name === 'Soil' || l.name === 'Debris') return;
      l.data.forEach(function (gid, i) {
        if (!gid) return;
        var p = props[gid] || {};
        if (l.name === 'Ground') {
          if (p.tillable) { noPlace[i] = 1; field.push(i); }
          if (p.water) noPlace[i] = solid[i] = 1;
        } else {
          noPlace[i] = 1;
          if (p.collides) solid[i] = 1;
        }
      });
    });
    var rect = function (x0, y0, w, h, fn) {
      for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) fn(y * W + x, x, y);
    };
    var layer = map.layers.filter(function (l) { return l.type === 'objectgroup'; })[0];
    (layer ? layer.objects : []).forEach(function (o) {
      if (o.gid) { // a prop, anchored at its bottom-left
        var tp = props[o.gid] || {}, x0 = Math.round(o.x / T), w = Math.round(o.width / T), h = Math.round(o.height / T), y0 = Math.round(o.y / T) - h;
        rect(x0, y0, w, h, function (i, x, y) {
          noPlace[i] = 1;
          if (!tp.flat && tp.foot && y >= y0 + h - tp.foot) solid[i] = 1;
        });
        return;
      }
      var tx = Math.floor(o.x / T), ty = Math.floor(o.y / T);
      if (o.point) {
        noPlace[ty * W + tx] = 1;
        if (o.name === 'house_door') start = ty * W + tx;
        return;
      }
      var w2 = Math.max(1, Math.round(o.width / T)), h2 = Math.max(1, Math.round(o.height / T)), group = [];
      rect(tx, ty, w2, h2, function (i) { noPlace[i] = 1; group.push(i); });
      var type = o.type || o.class || '';
      if (type === 'pen') { needs.push(group); return; }
      if (type === 'warp' || type === 'shop' || type === 'mail' || type === 'door' || type === 'sign') {
        rect(tx - 1, ty - 1, w2 + 2, h2 + 2, function (i, x, y) { // the tiles next to it (not the corners)
          var side = (x === tx - 1 || x === tx + w2) !== (y === ty - 1 || y === ty + h2);
          if (side) group.push(i);
        });
        needs.push(group);
      }
    });
    for (var x = 0; x < W; x++) { noPlace[x] = noPlace[(H - 1) * W + x] = 1; }
    for (var y = 0; y < H; y++) { noPlace[y * W] = noPlace[y * W + W - 1] = 1; }
    if (field.length) needs.push(field);
    return { w: W, h: H, noPlace: noPlace, solid: solid, start: start, needs: needs };
  };

  // ---------- pieces ----------
  L.yardType = function (t) { return O.types[t]; };
  L.yardBox = function (t, x, y) {
    var type = O.types[t], box = [];
    for (var yy = y; yy < y + type.h; yy++) for (var xx = x; xx < x + type.w; xx++) box.push([xx, yy]);
    return box;
  };
  // the tiles you can't walk through
  L.yardSolid = function (t, x, y) {
    var type = O.types[t];
    if (type.kind === 'path' || type.flat || !type.foot) return [];
    return L.yardBox(t, x, y).filter(function (p) { return p[1] >= y + type.h - type.foot; });
  };
  // the tiles a piece claims (no two pieces on the same layer share one): paths on the ground; everything else
  // by its solid tiles (or its whole picture when you can walk under it)
  var claims = function (t, x, y) {
    var solidTiles = L.yardSolid(t, x, y);
    return solidTiles.length ? solidTiles : L.yardBox(t, x, y);
  };
  var layerOf = function (t) { return O.types[t].kind === 'path' ? 'ground' : 'up'; };

  L.yardOnSale = function (s, t) {
    var fest = O.types[t].festival;
    if (!fest) return true;
    var f = C.FESTIVALS.filter(function (e) { return e.key === fest; })[0];
    return !!f && L.date(s.day).key === L.festSeason(f);
  };

  // Returns 'ok', 'gold' or 'season'.
  L.buyYard = function (s, t, n) {
    var type = O.types[t];
    if (!type) return 'bad';
    n = n || 1;
    if (!L.yardOnSale(s, t)) return 'season';
    if (s.gold < type.price * n) return 'gold';
    s.gold -= type.price * n;
    s.yard.bag[t] = (s.yard.bag[t] || 0) + n;
    return 'ok';
  };

  // Why a piece can't go at (x, y) on the farm, or null. skip = the index of an item being moved.
  L.yardCantPlace = function (s, farm, t, x, y, skip) {
    var type = O.types[t], W = farm.w, i, k;
    if (!type) return 'bad';
    if (x < 1 || y < 1 || x + type.w - 1 > W - 2 || y + type.h - 1 > farm.h - 2) return 'outside';
    var box = L.yardBox(t, x, y);
    for (i = 0; i < box.length; i++) if (farm.noPlace[box[i][1] * W + box[i][0]]) return 'blocked';
    var mine = claims(t, x, y), layer = layerOf(t), taken = {};
    s.yard.items.forEach(function (it, j) {
      if (j === skip || layerOf(it.t) !== layer) return;
      claims(it.t, it.x, it.y).forEach(function (p) { taken[p[1] * W + p[0]] = 1; });
    });
    for (k = 0; k < mine.length; k++) if (taken[mine[k][1] * W + mine[k][0]]) return 'taken';
    if (L.yardSolid(t, x, y).length) {
      var trial = s.yard.items.slice(), it2 = { t: t, x: x, y: y };
      if (skip != null) trial[skip] = it2; else trial.push(it2);
      if (!L.yardReachable(farm, trial)) return 'blocks';
    }
    return null;
  };

  // True when every door, gate, the field and the pen can still be reached from the house.
  L.yardReachable = function (farm, items) {
    var W = farm.w, H = farm.h, blocked = new Uint8Array(farm.solid), seen = new Uint8Array(W * H);
    items.forEach(function (it) { L.yardSolid(it.t, it.x, it.y).forEach(function (p) { blocked[p[1] * W + p[0]] = 1; }); });
    if (farm.start < 0) return true;
    var queue = [farm.start];
    seen[farm.start] = 1;
    for (var q = 0; q < queue.length; q++) {
      var c = queue[q], cx = c % W, cy = (c - cx) / W;
      for (var d = 0; d < 4; d++) {
        var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d], ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || blocked[ni]) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    return farm.needs.every(function (g) { return g.some(function (i) { return seen[i]; }); });
  };

  // From storage onto the farm. Returns the new item's index, or why it can't.
  L.placeYard = function (s, farm, t, x, y) {
    if (!s.yard.bag[t]) return 'none';
    if (s.yard.items.length >= MAX_ITEMS) return 'full';
    var why = L.yardCantPlace(s, farm, t, x, y, null);
    if (why) return why;
    if (--s.yard.bag[t] <= 0) delete s.yard.bag[t];
    s.yard.items.push({ t: t, x: x, y: y });
    return s.yard.items.length - 1;
  };

  L.moveYard = function (s, farm, i, x, y) {
    var it = s.yard.items[i];
    if (!it) return 'none';
    var why = L.yardCantPlace(s, farm, it.t, x, y, i);
    if (why) return why;
    it.x = x;
    it.y = y;
    return 'ok';
  };

  L.storeYard = function (s, i) {
    var it = s.yard.items[i];
    if (!it) return 'none';
    s.yard.items.splice(i, 1);
    s.yard.bag[it.t] = (s.yard.bag[it.t] || 0) + 1;
    return 'ok';
  };

  // The free spot nearest (x, y) for a piece, or null.
  L.yardFindSpot = function (s, farm, t, x, y) {
    var best = null, bestD = Infinity;
    for (var r = 0; r < Math.max(farm.w, farm.h) && !best; r++) {
      for (var yy = y - r; yy <= y + r; yy++) for (var xx = x - r; xx <= x + r; xx++) {
        if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) !== r) continue;
        var d = Math.abs(xx - x) + Math.abs(yy - y);
        if (d < bestD && !L.yardCantPlace(s, farm, t, xx, yy, null)) { best = { x: xx, y: yy }; bestD = d; }
      }
    }
    return best;
  };

  // A fence piece's look: 'h' (joins left or right), 'v' (joins up or down) or 'p' (a post: alone or a corner).
  L.fenceShape = function (s, i) {
    var it = s.yard.items[i], at = {};
    s.yard.items.forEach(function (o) { if (o.t === it.t) at[o.x + ',' + o.y] = 1; });
    var h = at[(it.x - 1) + ',' + it.y] || at[(it.x + 1) + ',' + it.y], v = at[it.x + ',' + (it.y - 1)] || at[it.x + ',' + (it.y + 1)];
    return h && !v ? 'h' : v && !h ? 'v' : 'p';
  };

  // Pieces that no longer fit (the map changed, or a bad save) go back into storage.
  L.yardRepair = function (s, farm) {
    var keep = [], moved = 0;
    s.yard.items.forEach(function (it) {
      var trial = { yard: { items: keep } };
      if (!L.yardCantPlace(trial, farm, it.t, it.x, it.y, null)) keep.push(it);
      else { s.yard.bag[it.t] = (s.yard.bag[it.t] || 0) + 1; moved++; }
    });
    s.yard.items = keep;
    return moved;
  };

  // ---------- beauty ----------
  // Tile pieces count their beauty every time; a second copy of any other piece counts half (as indoors).
  L.yardBeauty = function (s) {
    var seen = {}, total = 0;
    s.yard.items.forEach(function (it) {
      var type = O.types[it.t];
      if (type.kind !== 'prop') { total += type.beauty; return; }
      total += seen[it.t] ? type.beauty * C.HOME.dupe : type.beauty;
      seen[it.t] = 1;
    });
    return Math.round(total);
  };
  var homeBeauty = L.homeBeauty;
  L.homeBeauty = function (s) { return homeBeauty(s) + (s.yard ? L.yardBeauty(s) : 0); };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), flat = [], bag = [];
    s.yard.items.forEach(function (it) { flat.push(it.t, it.x, it.y); });
    Object.keys(s.yard.bag).forEach(function (t) { bag.push(Number(t), s.yard.bag[t]); });
    o.yd = [flat, bag];
    o.fw = C.FARM_W;
    return o;
  };

  function int(v, min, max, fallback) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  }

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    // the farm got wider: tile numbers on the farm move with it
    var fw = int(o.fw, 1, 1000, 24);
    if (fw !== C.FARM_W) {
      var move = function (table) {
        var out = {};
        Object.keys(table).forEach(function (idx) {
          var x = idx % fw, y = Math.floor(idx / fw);
          out[y * C.FARM_W + x] = table[idx];
        });
        return out;
      };
      s.soil = move(s.soil);
      s.debris = move(s.debris);
      if (s.forage) delete s.forage.farm;
    }
    var yd = Array.isArray(o.yd) ? o.yd : null;
    if (!yd) { s.yard = L.newYard(); return s; }
    s.yard = { items: [], bag: {} };
    var flat = Array.isArray(yd[0]) ? yd[0] : [], bag = Array.isArray(yd[1]) ? yd[1] : [];
    for (var i = 0; i + 2 < flat.length && s.yard.items.length < MAX_ITEMS; i += 3) {
      var t = int(flat[i], -1, 999, -1);
      if (O.types[t]) s.yard.items.push({ t: t, x: int(flat[i + 1], 0, 999, 0), y: int(flat[i + 2], 0, 999, 0) });
    }
    for (var k = 0; k + 1 < bag.length; k += 2) {
      var bt = int(bag[k], -1, 999, -1), n = int(bag[k + 1], 0, 9999, 0);
      if (O.types[bt] && n > 0) s.yard.bag[bt] = n;
    }
    return s;
  };
})(window.Farm = window.Farm || {});
