// Rules for the growing farm (content in 00-workshop.js): crop mastery stars, workshops that make goods in real
// time, fruit trees, field plots (more land in the yard), helping a friend's farm, and their save. Wraps the
// earlier logic files (loaded last of them, so its save wrapper is the outermost).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = C.OUTDOOR;
  var M = C.MASTERY;

  var int = function (v, min, max, fallback) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.mast = {}; // crop -> times harvested by hand
    s.ws = {}; // workshop -> [[recipe, minute it is done], ...] in the order they were started
    s.fruit = {}; // 'x,y' of a fruit tree in the yard -> the minute it was planted or last picked
    return s;
  };

  // What happened that the farm screen should tell you about (stars won, an extra crop): taken once.
  L.notes = [];
  L.takeNotes = function () { var n = L.notes; L.notes = []; return n; };

  // ---------- counting what you have (food groups count every kind) ----------
  L.countNeed = function (s, need) {
    return L.ingredientItems(need).reduce(function (n, id) { return n + L.countItem(s, id); }, 0);
  };
  var takeNeed = function (s, need, n) {
    var used = [];
    L.ingredientItems(need).forEach(function (id) {
      while (n > 0 && L.hasItem(s, id)) { L.removeItem(s, id, 1); used.push(id); n--; }
    });
    return used;
  };

  // ---------- crop mastery ----------
  L.masteryLevel = function (s, crop) {
    var n = (s.mast && s.mast[crop]) || 0, lvl = 0;
    M.needs.forEach(function (need) { if (n >= need) lvl++; });
    return lvl;
  };
  // { level, have, next (harvests for the next star, or 0 at gold) }
  L.mastery = function (s, crop) {
    var lvl = L.masteryLevel(s, crop);
    return { level: lvl, have: (s.mast && s.mast[crop]) || 0, next: M.needs[lvl] || 0 };
  };

  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var t = s.soil[idx], crop = t && t.c;
    var got = harvest(s, idx);
    if (!crop || typeof got !== 'string' || got[0] === '!' || C.CROPS[crop].sickle) return got;
    var before = L.masteryLevel(s, crop);
    s.mast[crop] = Math.min(1e6, (s.mast[crop] || 0) + 1);
    var lvl = L.masteryLevel(s, crop);
    if (lvl > before) L.notes.push({ kind: 'star', crop: crop, level: lvl });
    if (lvl && L.rand(s.seed, L.nowMin(), idx, s.mast[crop]) < M.extra[lvl - 1] && L.addItem(s, got, 1) === 0) L.notes.push({ kind: 'extra', item: got });
    return got;
  };

  // ---------- workshops ----------
  L.yardHas = function (s, key) {
    var t = O.index[key];
    return s.yard.items.some(function (it) { return it.t === t; });
  };
  L.yardOwned = function (s, t) {
    return (s.yard.bag[t] || 0) + s.yard.items.filter(function (it) { return it.t === t; }).length;
  };
  L.jobs = function (s, key) { return s.ws[key] || []; };
  L.jobsReady = function (s, key, now) {
    if (now == null) now = L.nowMin();
    return L.jobs(s, key).filter(function (j) { return j[1] <= now; }).length;
  };
  L.canMake = function (s, key, r) {
    var rec = C.WORKSHOPS[key].recipes[r];
    return rec.needs.every(function (e) { return L.countNeed(s, e[0]) >= e[1]; });
  };

  // Starts a recipe: its ingredients leave the bag now. Returns 'ok', 'none' (not in the yard), 'full' or 'missing'.
  L.startJob = function (s, key, r) {
    var w = C.WORKSHOPS[key], rec = w && w.recipes[r];
    if (!rec) return 'bad';
    if (!L.yardHas(s, key)) return 'none';
    var jobs = s.ws[key] = L.jobs(s, key);
    if (jobs.length >= w.slots) return 'full';
    if (!L.canMake(s, key, r)) return 'missing';
    rec.needs.forEach(function (e) { takeNeed(s, e[0], e[1]); });
    var now = L.nowMin(), last = jobs.length ? jobs[jobs.length - 1][1] : 0;
    jobs.push([r, Math.max(now, last) + rec.mins]);
    return 'ok';
  };

  // Takes everything finished (in order, while the bag has room). Returns the items taken, or '!full' / '!none'.
  L.collectJobs = function (s, key) {
    var jobs = L.jobs(s, key), now = L.nowMin(), got = [];
    while (jobs.length && jobs[0][1] <= now) {
      var out = C.WORKSHOPS[key].recipes[jobs[0][0]].out;
      if (L.addItem(s, out, 1) > 0) break;
      jobs.shift();
      L.discover(s, out);
      got.push(out);
    }
    if (!jobs.length) delete s.ws[key];
    if (got.length) return got;
    return L.jobsReady(s, key, now) ? '!full' : '!none';
  };

  // ---------- fruit trees ----------
  var spot = function (it) { return it.x + ',' + it.y; };
  L.treeOf = function (t) { return O.types[t] && C.FRUIT_TREES[O.types[t].key]; };
  L.treeInSeason = function (tree, day) { return tree.seasons.indexOf(L.date(day).key) >= 0; };
  // { ripe, inSeason, left (minutes until ripe: counted only in season) }
  L.treeState = function (s, it, now) {
    var tree = L.treeOf(it.t);
    if (!tree) return null;
    if (now == null) now = L.nowMin();
    var at = s.fruit[spot(it)], need = tree.hours * 60;
    if (at == null) at = now - need; // a tree from before trees fruited: ready in its season
    var left = Math.max(0, Math.ceil(at + need - now)), inSeason = L.treeInSeason(tree, s.day);
    return { ripe: inSeason && left === 0, inSeason: inSeason, left: left, tree: tree };
  };
  // Picks a ripe tree. Returns the fruit id, or '!notripe' / '!season' / '!full'.
  L.pickTree = function (s, i) {
    var it = s.yard.items[i], st = it && L.treeState(s, it);
    if (!st) return '!bad';
    if (!st.inSeason) return '!season';
    if (!st.ripe) return '!notripe';
    if (!L.canAdd(s, st.tree.fruit, st.tree.n)) return '!full';
    L.addItem(s, st.tree.fruit, st.tree.n);
    L.discover(s, st.tree.fruit);
    s.fruit[spot(it)] = L.nowMin();
    return st.tree.fruit;
  };

  // ---------- field plots ----------
  var isPlot = function (t) { return O.types[t] && O.types[t].kind === 'plot'; };
  L.isPlot = isPlot;
  var boxOf = function (it) {
    var type = O.types[it.t];
    return { x0: it.x, y0: it.y, x1: it.x + type.w - 1, y1: it.y + type.h - 1 };
  };
  var inBox = function (b, x, y) { return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; };
  var overlap = function (a, b) { return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1; };
  // The plot covering a tile (its item index), or -1.
  L.plotAt = function (s, x, y) {
    for (var i = 0; i < s.yard.items.length; i++) if (isPlot(s.yard.items[i].t) && inBox(boxOf(s.yard.items[i]), x, y)) return i;
    return -1;
  };
  var plotTiles = function (it) {
    var b = boxOf(it), out = [];
    for (var y = b.y0; y <= b.y1; y++) for (var x = b.x0; x <= b.x1; x++) out.push(y * C.FARM_W + x);
    return out;
  };

  // What a piece costs now: each field plot costs more than the last.
  L.yardPrice = function (s, t) {
    var type = O.types[t];
    return isPlot(t) ? C.PLOTS.price + C.PLOTS.step * L.yardOwned(s, t) : type.price;
  };
  // Why you can't buy one more (a workshop: one of each; plots: up to C.PLOTS.max), or null.
  L.yardCantBuy = function (s, t) {
    var type = O.types[t];
    if (type.one && L.yardOwned(s, t) >= 1) return 'have';
    if (isPlot(t) && L.yardOwned(s, t) >= C.PLOTS.max) return 'max';
    return null;
  };
  var buyYard = L.buyYard;
  L.buyYard = function (s, t, n) {
    var type = O.types[t];
    if (!type || !(type.one || isPlot(t))) return buyYard(s, t, n);
    if ((n || 1) !== 1) return 'bad';
    var why = L.yardCantBuy(s, t);
    if (why) return why;
    var price = L.yardPrice(s, t);
    if (s.gold < price) return 'gold';
    s.gold -= price;
    s.yard.bag[t] = (s.yard.bag[t] || 0) + 1;
    return 'ok';
  };

  // A plot shares no tile with anything (a path or a fence on a field would be odd), nor anything with a plot.
  var cantPlace = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) {
    var why = cantPlace(s, farm, t, x, y, skip);
    if (why || !O.types[t]) return why;
    var mine = boxOf({ t: t, x: x, y: y }), plot = isPlot(t);
    for (var j = 0; j < s.yard.items.length; j++) {
      var it = s.yard.items[j];
      if (j === skip || (!plot && !isPlot(it.t))) continue;
      if (overlap(mine, boxOf(it))) return 'taken';
    }
    return null;
  };

  // Placing: a new tree starts growing its first fruit; moving takes a tree's fruit and a plot's soil along;
  // putting away forgets them (a plot with crops on it can't be put away).
  var placeYard = L.placeYard;
  L.placeYard = function (s, farm, t, x, y) {
    var i = placeYard(s, farm, t, x, y);
    if (typeof i === 'number' && L.treeOf(t)) s.fruit[x + ',' + y] = L.nowMin();
    return i;
  };
  var moveYard = L.moveYard;
  L.moveYard = function (s, farm, i, x, y) {
    var it = s.yard.items[i];
    if (!it) return moveYard(s, farm, i, x, y);
    var from = { x: it.x, y: it.y }, before = isPlot(it.t) ? plotTiles(it) : null;
    var r = moveYard(s, farm, i, x, y);
    if (r !== 'ok') return r;
    if (L.treeOf(it.t)) {
      var k = from.x + ',' + from.y;
      if (s.fruit[k] != null) { s.fruit[spot(it)] = s.fruit[k]; delete s.fruit[k]; }
    }
    if (before) {
      var d = (it.y - from.y) * C.FARM_W + (it.x - from.x), moved = {};
      before.forEach(function (idx) { if (s.soil[idx]) { moved[idx + d] = s.soil[idx]; delete s.soil[idx]; } });
      Object.keys(moved).forEach(function (idx) { s.soil[idx] = moved[idx]; });
    }
    return r;
  };
  var storeYard = L.storeYard;
  L.storeYard = function (s, i) {
    var it = s.yard.items[i];
    if (!it) return storeYard(s, i);
    if (isPlot(it.t)) {
      var tiles = plotTiles(it);
      if (tiles.some(function (idx) { return s.soil[idx] && s.soil[idx].c; })) return 'crops';
      tiles.forEach(function (idx) { delete s.soil[idx]; });
    }
    if (L.treeOf(it.t)) delete s.fruit[spot(it)];
    return storeYard(s, i);
  };

  // The farm map's field tiles, for keeping soil only where soil can be.
  var farmInfo = L.farmInfo;
  L.farmInfo = function (map) {
    var info = farmInfo(map), field = new Uint8Array(info.w * info.h);
    map.layers.forEach(function (l) {
      if (l.name !== 'Ground' || l.type !== 'tilelayer') return;
      var props = {};
      map.tilesets.forEach(function (ts) { (ts.tiles || []).forEach(function (t) { (t.properties || []).forEach(function (p) { if (p.name === 'tillable' && p.value) props[ts.firstgid + t.id] = 1; }); }); });
      l.data.forEach(function (gid, i) { if (props[gid]) field[i] = 1; });
    });
    info.field = field;
    return info;
  };
  // Soil left where no field or plot is (a plot that went back into storage) is gone.
  L.cleanSoil = function (s, farm) {
    var n = 0;
    Object.keys(s.soil).forEach(function (idx) {
      idx = Number(idx);
      var x = idx % C.FARM_W, y = Math.floor(idx / C.FARM_W);
      if (farm.field && farm.field[idx]) return;
      if (L.plotAt(s, x, y) >= 0) return;
      delete s.soil[idx];
      n++;
    });
    return n;
  };
  var yardRepair = L.yardRepair;
  L.yardRepair = function (s, farm) {
    var moved = yardRepair(s, farm);
    L.cleanSoil(s, farm);
    var keep = {};
    s.yard.items.forEach(function (it) { if (L.treeOf(it.t) && s.fruit[spot(it)] != null) keep[spot(it)] = s.fruit[spot(it)]; });
    s.fruit = keep;
    return moved;
  };

  // ---------- orders and requests can ask for your goods and fruit ----------
  var madeOrGrown = function (s) {
    var out = [];
    C.WORKSHOP_KEYS.forEach(function (k) {
      if (!L.yardHas(s, k)) return;
      C.WORKSHOPS[k].recipes.forEach(function (r) { if (!C.ITEMS[r.out].price && L.discovered(s, r.out)) out.push(r.out); });
    });
    s.yard.items.forEach(function (it) {
      var tree = L.treeOf(it.t);
      if (tree && L.treeInSeason(tree, s.day) && out.indexOf(tree.fruit) < 0) out.push(tree.fruit);
    });
    return out;
  };
  var orderCandidates = L.orderCandidates;
  L.orderCandidates = function (s) {
    var out = orderCandidates(s);
    madeOrGrown(s).forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  };
  var requestPool = L.requestPool;
  L.requestPool = function (s) {
    var pool = requestPool(s);
    madeOrGrown(s).forEach(function (id) { pool.push([id, C.ITEMS[id].kind === 'fruit' ? 3 : 1, C.ITEMS[id].kind === 'fruit' ? 5 : 2]); });
    return pool;
  };

  // ---------- helping a friend's farm ----------
  // On their farm (a look-only copy): waters a growing crop there. Returns true if it did.
  L.helpWater = function (v, idx) {
    var t = v.soil[idx];
    if (!t || !t.c || t.w || L.cropStage(t) >= 3) return false;
    t.w = 1;
    return true;
  };
  // At home: friends watered these tiles. Waters the ones still growing and dry; returns how many.
  L.applyHelp = function (s, tiles) {
    var n = 0;
    (Array.isArray(tiles) ? tiles : []).forEach(function (idx) {
      idx = int(idx, -1, 1e5, -1);
      var t = s.soil[idx];
      if (t && t.c && !t.w && L.cropStage(t) < 3) { t.w = 1; n++; }
    });
    return n;
  };

  // ---------- the Market (online): farms sell to each other ----------
  C.MARKET = { lots: 4, most: 10, prices: [['Low', 1], ['Fair', 1.4], ['High', 2]] };
  // Can it go on a stall? Anything with a selling price (not tools, seeds or shop goods).
  L.marketable = function (id) {
    var it = C.ITEMS[id];
    return !!(it && it.sell > 0 && !it.price && it.kind !== 'tool' && /^[a-z][a-z_]{0,23}$/.test(id));
  };
  // The three prices a lot can ask: [label, gold] (its selling price, 1.4x, 2x)
  L.marketPrices = function (id, n) {
    var base = C.ITEMS[id].sell * n;
    return C.MARKET.prices.map(function (p) { return [p[0], Math.max(1, Math.round(base * p[1]))]; });
  };
  // What you are missing for your orders, villagers' requests and your workshops' recipes: [{ id, n, why }],
  // the orders and requests first. This is what the Market is for: buying what you can't make yet.
  L.shoppingList = function (s) {
    var out = [], seen = {};
    var want = function (id, n, why) {
      if (!L.marketable(id)) return;
      var miss = n - L.countItem(s, id);
      if (miss <= 0) return;
      if (seen[id]) { seen[id].n = Math.max(seen[id].n, miss); return; }
      out.push(seen[id] = { id: id, n: miss, why: why });
    };
    var who = function (k) { return C.VILLAGERS[k] ? C.VILLAGERS[k].name : 'A villager'; };
    (s.orders || []).forEach(function (o) {
      if (o && o.items) o.items.forEach(function (e) { want(e[0], e[1], 'An order from ' + who(o.from) + '.'); });
    });
    (s.rq && s.rq.list || []).forEach(function (r) { if (!r.done) want(r.id, r.n, who(r.from) + ' asked for it.'); });
    C.WORKSHOP_KEYS.forEach(function (k) {
      if (!L.yardHas(s, k)) return;
      C.WORKSHOPS[k].recipes.forEach(function (rec) {
        rec.needs.forEach(function (e) {
          if (L.countNeed(s, e[0]) >= e[1]) return;
          want(L.ingredientItems(e[0])[0], e[1] - L.countNeed(s, e[0]) + L.countItem(s, L.ingredientItems(e[0])[0]), 'For ' + C.ITEMS[rec.out].name + ' (' + C.WORKSHOPS[k].name + ').');
        });
      });
    });
    return out;
  };

  // ---------- chat bubbles (online): short lines over your farmer's head, for whoever is on the same farm ----------
  // They travel over the farm's live room and are not stored, so each phone checks what it shows: one line, at most
  // C.CHAT.max characters, and none of the rude words of the server's list (supabase/farm_online.sql farm.words, the
  // same look-alike letters).
  C.CHAT = {
    max: 60, show: 5000, gap: 1200, perMinute: 12,
    quick: ['Hi!', 'Nice farm!', 'Thank you!', 'Follow me!', 'Wait for me!', 'Come visit me!', 'Let\'s trade!', 'Bye!'],
  };
  var RUDE_PART = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'pussy', 'porn', 'asshole', 'motherfucker',
    'tangina', 'tang ina', 'putangina', 'putang', 'kantot', 'kantutan', 'hindot', 'jakol', 'pakyu', 'pakshet', 'tarantado'];
  var RUDE_WORD = ['dick', 'rape', 'rapist', 'penis', 'vagina', 'sex', 'nude', 'nudes', 'boobs', 'puta', 'gago', 'ulol', 'ulul', 'bobo', 'tanga',
    'pokpok', 'puke', 'titi', 'burat', 'kupal', 'punyeta'];
  var LOOKS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };
  // The line to show, or '' when it can't be shown.
  L.chatClean = function (text) {
    var t = L.cleanText(text, C.CHAT.max);
    if (!t) return '';
    var x = t.toLowerCase().replace(/[0134578@$!|]/g, function (c) { return LOOKS[c]; });
    if (RUDE_PART.some(function (w) { return x.indexOf(w) >= 0; })) return '';
    if (RUDE_WORD.some(function (w) { return new RegExp('(^|[^a-z])' + w + '([^a-z]|$)').test(x); })) return '';
    return t;
  };
  // Rate limits: { last, times } per speaker; true when a new line may be said (or shown) now.
  L.chatAllowed = function (log, now) {
    log.times = (log.times || []).filter(function (t) { return now - t < 60000; });
    if (log.last && now - log.last < C.CHAT.gap) return false;
    if (log.times.length >= C.CHAT.perMinute) return false;
    log.last = now;
    log.times.push(now);
    return true;
  };

  // ---------- tips for the new kinds of goods ----------
  var tipKey = L.tipKey;
  L.tipKey = function (id) {
    var k = C.ITEMS[id] && C.ITEMS[id].kind;
    if (k === 'fruit' || k === 'goods') return k;
    return tipKey(id);
  };

  // ---------- reminders: a workshop's goods and ripe fruit too ----------
  var nextHarvest = L.nextHarvest;
  L.nextHarvest = function (s, now) {
    if (now == null) now = L.nowMin();
    var best = nextHarvest(s, now);
    var offer = function (at, item, n) { if (at > now && (!best || at < best.at)) best = { at: at, item: item, n: n }; };
    C.WORKSHOP_KEYS.forEach(function (k) {
      var j = (s.ws && s.ws[k] || []).filter(function (e) { return e[1] > now; })[0];
      if (j) offer(j[1], C.WORKSHOPS[k].recipes[j[0]].out, 1);
    });
    (s.yard ? s.yard.items : []).forEach(function (it) {
      var st = L.treeOf(it.t) && L.treeState(s, it, now);
      if (st && st.inSeason && st.left > 0) offer(now + st.left, st.tree.fruit, st.tree.n);
    });
    return best;
  };
  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), ms = [], ws = [], fr = [];
    Object.keys(s.mast).forEach(function (k) { var i = C.CROP_KEYS.indexOf(k); if (i >= 0 && s.mast[k] > 0) ms.push(i, s.mast[k]); });
    C.WORKSHOP_KEYS.forEach(function (k, i) {
      var jobs = s.ws[k];
      if (jobs && jobs.length) ws.push([i].concat([].concat.apply([], jobs)));
    });
    Object.keys(s.fruit).forEach(function (k) { var p = k.split(','); fr.push(Number(p[0]), Number(p[1]), s.fruit[k]); });
    o.g2 = [ms, ws, fr];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var g2 = Array.isArray(o.g2) ? o.g2 : [], ms = Array.isArray(g2[0]) ? g2[0] : [], ws = Array.isArray(g2[1]) ? g2[1] : [], fr = Array.isArray(g2[2]) ? g2[2] : [];
    s.mast = {};
    for (var i = 0; i + 1 < ms.length; i += 2) {
      var crop = C.CROP_KEYS[int(ms[i], -1, 999, -1)], n = int(ms[i + 1], 0, 1e6, 0);
      if (crop && n > 0) s.mast[crop] = n;
    }
    s.ws = {};
    ws.forEach(function (e) {
      if (!Array.isArray(e)) return;
      var key = C.WORKSHOP_KEYS[int(e[0], -1, 99, -1)];
      if (!key) return;
      var w = C.WORKSHOPS[key], jobs = [];
      for (var k = 1; k + 1 < e.length && jobs.length < w.slots; k += 2) {
        var r = int(e[k], -1, 99, -1);
        if (w.recipes[r]) jobs.push([r, int(e[k + 1], 0, 1e9, 0)]);
      }
      if (jobs.length) s.ws[key] = jobs;
    });
    s.fruit = {};
    for (var j = 0; j + 2 < fr.length && j < 900; j += 3) s.fruit[int(fr[j], 0, 999, 0) + ',' + int(fr[j + 1], 0, 999, 0)] = int(fr[j + 2], 0, 1e9, 0);
    return s;
  };
})(window.Farm = window.Farm || {});
