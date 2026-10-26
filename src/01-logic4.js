// Rules for the farmhouse: upgrading it (levels from C.HOME), buying furniture into storage, placing, moving,
// turning and storing it, wallpapers and floors, and the Home Beauty score (more max energy, villagers notice).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.home = L.newHome(1);
    return s;
  };

  // A home at a level with the starter furniture. items: [{ t (type), v (style), x, y, f (mirrored) }]
  // bag: furniture in storage, 'type.style' -> count. walls / floors: owned styles (bitmask); wall / floor: in use.
  L.newHome = function (level) {
    return {
      level: level, wall: 0, floor: 0, walls: 1, floors: 1, bag: {},
      items: H.starter.map(function (e) { return { t: H.typeIndex[e[0]], v: 0, x: e[1], y: e[2], f: 0 }; }),
    };
  };

  L.homeLevel = function (s) { return H.levels[s.home.level - 1]; };
  L.homeSize = function (s) { var m = L.homeLevel(s).map; return { w: m[0], h: m[1] }; };
  L.furnKey = function (t, v) { return t + '.' + v; };
  L.furnName = function (t, v) { return (v ? H.styles[v].name + ' ' : '') + H.types[t].name; };
  L.furnPrice = function (t, v) { return Math.round(H.types[t].price * H.styles[v].price / 10) * 10; };
  L.furnBeauty = function (t, v) { return Math.round(H.types[t].beauty * H.styles[v].beauty); };
  L.wallPrice = function (v) { return v ? Math.round(H.wallPrice * H.styles[v].price / 10) * 10 : 0; };

  // A festival edition is sold during its festival's season.
  L.styleOnSale = function (s, v) {
    var st = H.styles[v];
    if (!st.festival) return true;
    var fest = C.FESTIVALS.filter(function (f) { return f.key === st.festival; })[0];
    return !!fest && L.date(s.day).key === L.festSeason(fest);
  };

  // ---------- the house upgrade ----------
  L.nextHome = function (s) { return H.levels[s.home.level] || null; };

  // Returns 'ok', or 'max' / 'busy' / 'gold' / 'lumber' / 'stone'.
  L.startHomeUpgrade = function (s) {
    var next = L.nextHome(s);
    if (!next) return 'max';
    if (s.project) return 'busy';
    if (s.gold < next.gold) return 'gold';
    if (s.lumber < next.lumber) return 'lumber';
    if (s.stone < next.stone) return 'stone';
    s.gold -= next.gold;
    s.lumber -= next.lumber;
    s.stone -= next.stone;
    s.project = { id: 'house', done: s.day + next.days };
    return 'ok';
  };
  C.BUILD_KEYS.push('house'); // the save stores the project as an index into BUILD_KEYS (appended)

  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var upgrade = s.project && s.project.id === 'house' && s.day + 1 >= s.project.done;
    if (upgrade) s.project = null;
    var r = endDay(s, passedOut, info);
    if (upgrade) {
      s.home.level = Math.min(H.levels.length, s.home.level + 1);
      r.homeUp = s.home.level;
      L.syncHome(s);
    }
    // a new kitchen comes with a counter (by the wall if there's room, else in storage)
    if (r.built === 'kitchen' && !L.homeHas(s, 'kitchen')) {
      var kt = H.typeIndex.kitchen, spot = L.cantPlace(s, kt, 1, 7, null) ? L.findSpot(s, kt, 1, 7, null) : { x: 1, y: 7 };
      if (spot) s.home.items.push({ t: kt, v: 0, x: spot.x, y: spot.y, f: 0 });
      else s.home.bag[L.furnKey(kt, 0)] = (s.home.bag[L.furnKey(kt, 0)] || 0) + 1;
    }
    r.beauty = L.homeBeauty(s);
    // once a week a friend drops by and says what they think of the place
    if (s.day % 7 === 0) {
      var friends = C.VILLAGER_ORDER.filter(function (k) { return s.friends[k] && s.friends[k].met && L.friendHearts(s, k) >= 2 && s.spouse !== k; });
      if (friends.length) {
        var who = friends[Math.floor(L.rand(s.seed, s.day, 501) * friends.length)];
        r.visitor = { who: who, line: L.homeComment(s, L.rand(s.seed, s.day, 502)) || 'What a nice little home you have!' };
        L.addFriend(s, who, 3);
      }
    }
    return r;
  };

  // ---------- energy and beauty ----------
  L.homeBeauty = function (s) {
    var seen = {}, score = s.home.level * 10;
    s.home.items.forEach(function (it) {
      var k = L.furnKey(it.t, it.v), b = L.furnBeauty(it.t, it.v);
      score += seen[k] ? b * H.dupe : b;
      seen[k] = 1;
    });
    score += Math.round(H.wallBeauty * (H.styles[s.home.wall].beauty + H.styles[s.home.floor].beauty));
    return Math.round(score);
  };

  L.homeTier = function (s) {
    var b = L.homeBeauty(s), tier = 0;
    H.tiers.forEach(function (t, i) { if (b >= t[0]) tier = i; });
    return tier;
  };
  L.homeBonus = function (s) { return H.tiers[L.homeTier(s)][2]; };
  L.maxEnergy = function (s) { return C.MAX_ENERGY + (s.home ? L.homeBonus(s) : 0); };

  // Something a villager might say about the home (r in [0, 1)), or null for a plain home.
  L.homeComment = function (s, r) {
    var lines = H.comments[L.homeTier(s)];
    return lines ? lines[Math.floor(r * lines.length)] : null;
  };

  // Now and then a friend says what they've heard about your home (once you have a Cozy one).
  var talk = L.talk;
  L.talk = function (s, key) {
    var r = talk(s, key);
    if (r.first || s.spouse === key || !s.home || !L.homeTier(s)) return r;
    if (L.rand(s.seed, s.day, 520 + C.VILLAGER_ORDER.indexOf(key)) < 0.2) r.line = L.homeComment(s, L.rand(s.seed, s.day, 540 + C.VILLAGER_ORDER.indexOf(key))) || r.line;
    return r;
  };

  // ---------- buying ----------
  // Returns 'ok', 'gold', 'season' or 'needs' (the kitchen counter needs Mira's Kitchen first).
  L.buyFurn = function (s, t, v) {
    var type = H.types[t];
    if (!type || !H.styles[v]) return 'bad';
    if (!L.styleOnSale(s, v)) return 'season';
    if (type.needs && !s.builds[type.needs]) return 'needs';
    var price = L.furnPrice(t, v);
    if (s.gold < price) return 'gold';
    s.gold -= price;
    var k = L.furnKey(t, v);
    s.home.bag[k] = (s.home.bag[k] || 0) + 1;
    if (type.use === 'cat' && !s.cat) s.cat = { name: C.CAT.name, love: 0, pet: 0 };
    return 'ok';
  };

  // kind: 'wall' or 'floor'. Buys it if needed and puts it up. Returns 'ok', 'gold' or 'season'.
  L.setSurface = function (s, kind, v) {
    var owned = kind === 'wall' ? 'walls' : 'floors';
    if (!(s.home[owned] & (1 << v))) {
      if (!L.styleOnSale(s, v)) return 'season';
      if (s.gold < L.wallPrice(v)) return 'gold';
      s.gold -= L.wallPrice(v);
      s.home[owned] |= 1 << v;
    }
    s.home[kind] = v;
    return 'ok';
  };

  // ---------- placing ----------
  // The tiles a piece covers (box) and the solid ones (foot), at (x, y).
  L.furnTiles = function (t, x, y) {
    var type = H.types[t], box = [], foot = [];
    for (var yy = y; yy < y + type.h; yy++) {
      for (var xx = x; xx < x + type.w; xx++) {
        box.push([xx, yy]);
        if (type.place === 'floor' && yy >= y + type.h - type.foot) foot.push([xx, yy]);
      }
    }
    return { box: box, foot: foot };
  };

  // Why a piece can't go at (x, y) (or null if it can). skip = the index of an item being moved.
  L.cantPlace = function (s, t, x, y, skip) {
    var type = H.types[t], size = L.homeSize(s), w = size.w, h = size.h, i;
    if (!type) return 'bad';
    if (x < 1 || x + type.w - 1 > w - 2) return 'outside';
    if (type.place === 'wall') {
      if (y !== 0) return 'wall';
    } else {
      var footTop = type.place === 'flat' ? y : y + type.h - type.foot;
      if (footTop < 2 || y + type.h - 1 > h - 2) return 'outside';
    }
    var mine = L.furnTiles(t, x, y);
    var layerOf = function (ty) { return H.types[ty].place; };
    var key = function (p) { return p[0] + ',' + p[1]; };
    var taken = {};
    s.home.items.forEach(function (it, k) {
      if (k === skip) return;
      var tiles = L.furnTiles(it.t, it.x, it.y);
      if (layerOf(it.t) === 'floor') tiles.foot.forEach(function (p) { taken['foot ' + key(p)] = 1; });
      else tiles.box.forEach(function (p) { taken[layerOf(it.t) + ' ' + key(p)] = 1; });
    });
    var check = type.place === 'floor' ? mine.foot.map(function (p) { return 'foot ' + key(p); }) : mine.box.map(function (p) { return type.place + ' ' + key(p); });
    for (i = 0; i < check.length; i++) if (taken[check[i]]) return 'taken';
    if (type.place === 'floor') {
      for (i = 0; i < mine.foot.length; i++) {
        var p = mine.foot[i];
        if (p[1] === h - 2 && H.door.indexOf(p[0]) >= 0) return 'door';
      }
      // everything you use (beds, the TV, the kitchen...) must still be reachable from the door
      var trial = s.home.items.slice();
      var it2 = { t: t, x: x, y: y };
      if (skip != null) trial[skip] = it2; else trial.push(it2);
      if (!L.homeReachable(s, trial)) return 'blocks';
    }
    return null;
  };

  // True when every piece with a use has a free floor tile next to its solid part, reachable from the door.
  L.homeReachable = function (s, items) {
    var size = L.homeSize(s), w = size.w, h = size.h, solid = {}, seen = {};
    items.forEach(function (it) {
      if (H.types[it.t].place !== 'floor') return;
      L.furnTiles(it.t, it.x, it.y).foot.forEach(function (p) { solid[p[1] * w + p[0]] = 1; });
    });
    var free = function (x, y) { return x >= 1 && x <= w - 2 && y >= 2 && y <= h - 2 && !solid[y * w + x]; };
    var queue = [[H.door[0], h - 2]];
    seen[(h - 2) * w + H.door[0]] = 1;
    while (queue.length) {
      var c = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c[0] + d[0], ny = c[1] + d[1], n = ny * w + nx;
        if (!seen[n] && free(nx, ny)) { seen[n] = 1; queue.push([nx, ny]); }
      });
    }
    return items.every(function (it) {
      var type = H.types[it.t];
      if (!type.use || type.place !== 'floor') return true;
      return L.furnTiles(it.t, it.x, it.y).foot.some(function (p) {
        return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var x = p[0] + d[0], y = p[1] + d[1]; return seen[y * w + x]; });
      });
    });
  };

  // Puts a piece from storage at (x, y). Returns the new item's index, or a reason it can't.
  L.placeFurn = function (s, t, v, x, y, f) {
    var k = L.furnKey(t, v);
    if (!s.home.bag[k]) return 'none';
    var why = L.cantPlace(s, t, x, y, null);
    if (why) return why;
    if (--s.home.bag[k] <= 0) delete s.home.bag[k];
    s.home.items.push({ t: t, v: v, x: x, y: y, f: f ? 1 : 0 });
    return s.home.items.length - 1;
  };

  L.moveFurn = function (s, i, x, y, f) {
    var it = s.home.items[i];
    if (!it) return 'none';
    var why = L.cantPlace(s, it.t, x, y, i);
    if (why) return why;
    it.x = x;
    it.y = y;
    if (f != null) it.f = f ? 1 : 0;
    return 'ok';
  };

  // Puts a placed piece into storage. The last bed stays (you need somewhere to sleep).
  L.storeFurn = function (s, i) {
    var it = s.home.items[i];
    if (!it) return 'none';
    if (H.types[it.t].use === 'sleep' && s.home.items.filter(function (o) { return H.types[o.t].use === 'sleep'; }).length < 2) return 'lastbed';
    s.home.items.splice(i, 1);
    var k = L.furnKey(it.t, it.v);
    s.home.bag[k] = (s.home.bag[k] || 0) + 1;
    return 'ok';
  };

  // The nearest free spot to (x, y) for a piece, or null.
  // Spots where the whole picture is clear of other pieces (not just the solid feet) come first.
  L.findSpot = function (s, t, x, y, skip) {
    var size = L.homeSize(s), best = null, bestD = Infinity, layer = H.types[t].place === 'flat' ? 'flat' : 'up';
    var used = {};
    s.home.items.forEach(function (it, k) {
      if (k === skip || (H.types[it.t].place === 'flat' ? 'flat' : 'up') !== layer) return;
      L.furnTiles(it.t, it.x, it.y).box.forEach(function (p) { used[p[0] + ',' + p[1]] = 1; });
    });
    for (var yy = 0; yy < size.h; yy++) {
      for (var xx = 0; xx < size.w; xx++) {
        var overlap = L.furnTiles(t, xx, yy).box.some(function (p) { return used[p[0] + ',' + p[1]]; });
        var d = Math.abs(xx - x) + Math.abs(yy - y) + (overlap ? 1000 : 0);
        if (d < bestD && !L.cantPlace(s, t, xx, yy, skip)) { best = { x: xx, y: yy }; bestD = d; }
      }
    }
    return best;
  };

  L.homeHas = function (s, use) { return s.home.items.some(function (it) { return H.types[it.t].use === use; }); };

  // ---------- what the older rules look for ----------
  // The Farmhouse (level 3) replaced the House Extension, which the marriage rules check for.
  L.syncHome = function (s) {
    if (s.builds.bighouse && s.home.level < H.marryLevel) s.home.level = H.marryLevel; // built the old way
    if (s.home.level >= H.marryLevel) s.builds.bighouse = 1;
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), hm = s.home;
    o.hm = [hm.level, hm.wall, hm.floor, hm.walls, hm.floors,
      [].concat.apply([], hm.items.map(function (it) { return [it.t, it.v, it.x, it.y, it.f]; })), hm.bag];
    return o;
  };

  function int(v, min, max, fallback) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return null;
    var nt = H.types.length, ns = H.styles.length;
    if (Array.isArray(o.hm)) {
      var lv = int(o.hm[0], 1, H.levels.length, 1);
      var hm = s.home = { level: lv, wall: int(o.hm[1], 0, ns - 1, 0), floor: int(o.hm[2], 0, ns - 1, 0), walls: int(o.hm[3], 0, (1 << ns) - 1, 1) | 1, floors: int(o.hm[4], 0, (1 << ns) - 1, 1) | 1, bag: {}, items: [] };
      var flat = Array.isArray(o.hm[5]) ? o.hm[5] : [];
      for (var i = 0; i + 4 < flat.length && hm.items.length < 200; i += 5) {
        var it = { t: int(flat[i], 0, nt - 1, 0), v: int(flat[i + 1], 0, ns - 1, 0), x: int(flat[i + 2], 0, 40, 1), y: int(flat[i + 3], 0, 40, 2), f: flat[i + 4] ? 1 : 0 };
        if (!L.cantPlace(s, it.t, it.x, it.y, null)) hm.items.push(it);
        else hm.bag[L.furnKey(it.t, it.v)] = (hm.bag[L.furnKey(it.t, it.v)] || 0) + 1; // doesn't fit: into storage
      }
      var bag = o.hm[6] && typeof o.hm[6] === 'object' ? o.hm[6] : {};
      Object.keys(bag).forEach(function (k) {
        var p = k.split('.'), t = int(p[0], -1, nt - 1, -1), v = int(p[1], -1, ns - 1, -1);
        if (t >= 0 && v >= 0) hm.bag[L.furnKey(t, v)] = (hm.bag[L.furnKey(t, v)] || 0) + int(bag[k], 0, 999, 0);
        if (!hm.bag[L.furnKey(t, v)]) delete hm.bag[L.furnKey(t, v)];
      });
      if (!hm.items.some(function (x) { return H.types[x.t].use === 'sleep'; })) { // never without a bed
        var spot = L.findSpot(s, H.typeIndex.bed, 1, 2, null);
        if (spot) hm.items.push({ t: H.typeIndex.bed, v: 0, x: spot.x, y: spot.y, f: 0 });
      }
    } else {
      s.home = L.oldHome(s);
    }
    L.syncHome(s);
    s.energy = int(o.e, 0, 1000, L.maxEnergy(s)); // capped to the max at the end of loading (01-logic8.js), once the yard is back
    return s;
  };

  // A save from before the home could be decorated: the house it had, with the furniture it had, where it was.
  L.oldHome = function (s) {
    var big = !!s.builds.bighouse, home = L.newHome(big ? H.marryLevel : 1);
    var add = function (key, x, y) { home.items.push({ t: H.typeIndex[key], v: 0, x: x, y: y, f: 0 }); };
    if (big) { add('window', 8, 0); add('double_bed', 8, 2); add('dresser', 9, 6); add('calendar', 10, 0); }
    if (s.builds.kitchen) add('kitchen', 1, 7);
    if (s.builds.f_plant) add('big_plant', 3, 1);
    if (s.builds.f_music) add('music_box', 5, 2);
    if (s.builds.f_aquarium) add('aquarium', 1, 5);
    if (s.builds.f_cat) add('cat_bed', 6, 6);
    return home;
  };

})(window.Farm = window.Farm || {});
