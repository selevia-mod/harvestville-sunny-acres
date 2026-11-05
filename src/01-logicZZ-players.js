// Players' ideas and reports, the rules (owner, 5 Nov 2026; content in 00-zzzzzzzz-players.js, screen in 19zzz-a-players.js):
//   - rain waters what you plant or pick on a rainy day (it only wet the field in the morning before: seeds planted
//     after a harvest waited for water while it rained);
//   - Mira takes two jobs at once (s.project and s.project2, saved as 'p2');
//   - Double Drops: Wednesday and Saturday, 12-1 PM and 8-10 PM Manila time, by the game's clock (the app's server time);
//   - crafting yard pieces at Mira's from your own harvest;
//   - what can be dropped on the ground.
// (Named 01-logicZZ-…: it loads after every 01-logicZ-… file.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = C.OUTDOOR;
  var H = C.HOME;

  // (appended last: a tip's place is its saved bit)
  C.TIPS.push({ key: 'players_tour', text: 'NEW: YOUR IDEAS' }, { key: 'double_tour', text: 'DOUBLE DROPS' });

  // ---------- the shops and the market never close (night is still night: L.sleepTime) ----------
  L.shopOpen = function (s) { return !L.festivalOn(s.day); };
  L.marketOpen = function () { return true; };

  // ---------- rain ----------
  L.raining = function (s) { return !!(s && !s.isVisit && C.WEATHER[L.weather(s, s.day)].waters); };
  // On a rainy day the rain waters any tile with something waiting (planted, picked and growing back): every place
  // that waters a tile by itself (planting, picking, a farmhand, loading the game) asks L.wateredBy.
  var wateredBy = L.wateredBy;
  L.wateredBy = function (s, idx) { return wateredBy(s, idx) || (L.raining(s) ? 'rain' : null); };

  // ---------- Mira: two jobs at once ----------
  // A second job goes in s.project2. The game's own rules only know s.project, so a start with the first slot taken
  // runs with it set aside for a moment, and the job it makes moves to the second slot.
  var newState = L.newState;
  L.newState = function (info) { var s = newState(info); s.project2 = null; return s; };
  L.miraJobs = function (s) { return [s.project, s.project2].filter(Boolean); };
  L.miraBusyWith = function (s, id) { return L.miraJobs(s).filter(function (j) { return j.id === id; })[0] || null; };
  var second = function (start, idOf) {
    return function (s, a) {
      if (!s.project) return start(s, a);
      if (L.miraBusyWith(s, idOf(a))) return 'busy';
      if (s.project2 || (C.MIRA_JOBS || 1) < 2) return 'busy';
      var held = s.project, r;
      s.project = null;
      try { r = start(s, a); } finally {
        if (r === 'ok' && s.project) s.project2 = s.project;
        s.project = held;
      }
      return r;
    };
  };
  L.startBuild = second(L.startBuild, function (id) { return id; });
  L.startHomeUpgrade = second(L.startHomeUpgrade, function () { return 'house'; });

  // The second job finishes the same way the first does (the house grows, a building is built, a kitchen gets its counter).
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info), j = s.project2;
    if (j && s.day >= j.done) {
      s.project2 = null;
      if (j.id === 'house') {
        s.home.level = Math.min(H.levels.length, s.home.level + 1);
        r.homeUp = s.home.level;
        L.syncHome(s);
      } else if (C.BUILDS[j.id]) {
        s.builds[j.id] = 1;
        if (!r.built) r.built = j.id; else r.built2 = j.id;
        if (j.id === 'kitchen' && !L.homeHas(s, 'kitchen')) {
          var kt = H.typeIndex.kitchen, spot = L.cantPlace(s, kt, 1, 7, null) ? L.findSpot(s, kt, 1, 7, null) : { x: 1, y: 7 };
          if (spot) s.home.items.push({ t: kt, v: 0, x: spot.x, y: spot.y, f: 0 });
          else s.home.bag[L.furnKey(kt, 0)] = (s.home.bag[L.furnKey(kt, 0)] || 0) + 1;
        }
      }
      r.beauty = L.homeBeauty(s);
    }
    if (!s.project && s.project2) { s.project = s.project2; s.project2 = null; } // (the first slot is always the older job)
    return r;
  };

  // ---------- Double Drops ----------
  // The window on now (ms, the game's clock) by Manila time: { end: ms } or null.
  L.doubleNow = function (ms) {
    var D = C.DOUBLE, t = (ms == null ? L.clock() : ms) + D.tz * 60000, d = new Date(t);
    if (D.days.indexOf(d.getUTCDay()) < 0) return null;
    var m = d.getUTCHours() * 60 + d.getUTCMinutes();
    for (var i = 0; i < D.windows.length; i++) {
      var w = D.windows[i];
      if (m >= w[0] && m < w[1]) return { end: t - D.tz * 60000 + (w[1] - m) * 60000 - d.getUTCSeconds() * 1000 - d.getUTCMilliseconds() };
    }
    return null;
  };
  // The next window to start after ms: { start, end } (ms).
  L.doubleNext = function (ms) {
    var D = C.DOUBLE, now = ms == null ? L.clock() : ms, local = now + D.tz * 60000;
    var midnight = Math.floor(local / 864e5) * 864e5;
    for (var k = 0; k < 8; k++) {
      var day = midnight + k * 864e5, wd = new Date(day).getUTCDay();
      if (D.days.indexOf(wd) < 0) continue;
      for (var i = 0; i < D.windows.length; i++) {
        var start = day + D.windows[i][0] * 60000 - D.tz * 60000, end = day + D.windows[i][1] * 60000 - D.tz * 60000;
        if (end > now) return { start: start, end: end };
      }
    }
    return null;
  };
  var doubling = function (s) { return !!(s && !s.isVisit && L.doubleNow()); };
  L.doubled = 0; // how many extra the last pick gave (for the screen's "x2")
  // a crop picked by hand: one more (a normal one) if it fits
  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var got = harvest(s, idx);
    L.doubled = 0;
    if (typeof got === 'string' && got[0] !== '!' && doubling(s) && L.addItem(s, got, 1) === 0) L.doubled = 1;
    return got;
  };
  var takeForage = L.takeForage;
  L.takeForage = function (s, map, spot) {
    var got = takeForage(s, map, spot);
    L.doubled = 0;
    if (typeof got === 'string' && got[0] !== '!' && doubling(s) && L.addItem(s, got, 1) === 0) L.doubled = 1;
    return got;
  };
  // a hunted animal leaves twice as much (only your own hunts: L.huntDrops is called by the phone that hunted)
  var huntDrops = L.huntDrops;
  L.huntDrops = function (kind, rnd) {
    var out = huntDrops(kind, rnd);
    return L.doubleNow() ? out.map(function (d) { return [d[0], d[1] * 2]; }) : out;
  };

  // ---------- crafting at Mira's ----------
  L.craftOf = function (key) { return C.CRAFT.filter(function (r) { return r.key === key; })[0] || null; };
  var have = function (s, id) { return id === 'lumber' || id === 'stone' ? s[id] : L.countItem(s, id); };
  // What is missing for a piece: [[item, how many more]] ([] = it can be made).
  L.craftMissing = function (s, key) {
    var r = L.craftOf(key);
    if (!r) return [['?', 1]];
    return r.needs.filter(function (n) { return have(s, n[0]) < n[1]; }).map(function (n) { return [n[0], n[1] - have(s, n[0])]; });
  };
  // Makes it: the goods leave the bag, the piece goes into your yard storage. 'ok', 'missing' or 'bad'.
  L.craft = function (s, key) {
    var r = L.craftOf(key), t = r && O.index[key];
    if (!r || t == null) return 'bad';
    if (L.craftMissing(s, key).length) return 'missing';
    r.needs.forEach(function (n) {
      if (n[0] === 'lumber' || n[0] === 'stone') s[n[0]] -= n[1];
      else L.removeItem(s, n[0], n[1]);
    });
    s.yard.bag[t] = (s.yard.bag[t] || 0) + 1;
    return 'ok';
  };

  // ---------- dropping things ----------
  // Anything but a tool can be dropped (not on a friend's farm).
  L.canDrop = function (s, slot) {
    var it = s.inv[slot], def = it && C.ITEMS[it.id];
    return !!(def && def.kind !== 'tool' && !s.isVisit);
  };

  // ---------- the save: Mira's second job ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.project2) o.p2 = [C.BUILD_KEYS.indexOf(s.project2.id), Math.max(0, s.project2.done - s.day)];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.project2 = null;
    var p = o && o.p2, id = Array.isArray(p) && C.BUILD_KEYS[Math.floor(Number(p[0]))];
    if (id && (!s.project || s.project.id !== id) && !(id !== 'house' && s.builds[id])) {
      s.project2 = { id: id, done: s.day + Math.max(0, Math.min(30, Math.floor(Number(p[1])) || 0)) };
      if (!s.project) { s.project = s.project2; s.project2 = null; }
    }
    return s;
  };
})(window.Farm = window.Farm || {});
