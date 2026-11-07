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

  // ---------- a refill is always the whole +100 (owner, 5 Nov 2026: "they spend real money on this") ----------
  // 5 energy left + a refill = 105; again = 205. It stacks past the max and nothing trims it back (the night, loading the
  // game). How far: up to 9,999 with Selebox Coins, up to 1,000 with Stars or a free refill (owner: "9,999 is okay as
  // long it was coins purchase").
  C.ENERGY_MOST = 1000;
  C.ENERGY_MOST_COINS = 9999;
  L.energyMost = function (currency) { return currency === 'coins' ? C.ENERGY_MOST_COINS : C.ENERGY_MOST; };
  L.refillEnergy = function (s, amount, currency) {
    var before = s.energy, most = Math.max(L.energyMost(currency), before);
    s.energy = Math.min(most, s.energy + Math.max(0, Math.floor(amount) || 0));
    if (s.energy >= L.maxEnergy(s)) s.regen = L.nowMin();
    return s.energy - before;
  };
  // Would a refill of `amount` fit in full (so nothing is paid for energy that would not fit)?
  L.refillFits = function (s, amount, currency) { return Math.floor(s.energy) + (Number(amount) || 0) <= L.energyMost(currency); };
  L.useFreeRefill = function (s) {
    if (!L.refillsLeft(s) || !L.refillFits(s, C.FREE_REFILL)) return 0;
    s.rf = L.refillsLeft(s) - 1;
    return L.refillEnergy(s, C.FREE_REFILL);
  };

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

  // ---------- animals: a product C.ANIMAL_HOURS after each feeding ----------
  // a.fed: eating, its product on the way (since a.ft, a real minute); a.fd: fed today (the night's hungry check).
  // One product waits at a time: a fed animal whose last one is still uncollected makes the next when it is collected.
  L.animalMins = function (a) { return (C.ANIMAL_HOURS[a.kind] || 24) * 60; };
  // Minutes until a fed animal's product (0: due), or null when it is not eating.
  L.animalLeft = function (a, now) {
    if (!a || !a.fed || a.young) return null;
    if (now == null) now = L.nowMin();
    return Math.max(0, Math.ceil((a.ft == null ? now : a.ft) + L.animalMins(a) - now));
  };
  // Makes what is due. Returns { item: n } made.
  L.animalsTick = function (s, now) {
    var made = {};
    if (!s || !s.animals || s.isVisit) return made;
    if (now == null) now = L.nowMin();
    s.animals.forEach(function (a) {
      if (a.young || !a.fed) return;
      if (a.ft == null) { a.ft = now; a.fd = 1; } // (fed by a farmhand, or in an older save)
      if (a.ready || now < a.ft + L.animalMins(a)) return;
      a.ready = a.love >= C.LOVE.large ? 2 : 1;
      a.fed = 0;
      delete a.ft;
      var d = C.ANIMALS[a.kind], item = a.ready === 2 ? d.large : d.product, n = 1;
      if (L.isRare && L.isRare(a) && C.BREEDING) { a.bx = C.BREEDING.bonus; n += C.BREEDING.bonus; }
      made[item] = (made[item] || 0) + n;
    });
    return made;
  };
  var feedAnimal = L.feedAnimal;
  L.feedAnimal = function (s, i, slot) {
    var r = feedAnimal(s, i, slot), a = s.animals[i];
    if (r === 'ok') { a.ft = L.nowMin(); a.fd = 1; }
    return r;
  };
  // Collected: a fed animal that was waiting on it makes the next one at once if it is due.
  var collect = L.collect;
  L.collect = function (s, i) {
    var got = collect(s, i);
    if (typeof got === 'string' && got[0] !== '!') L.animalsTick(s);
    return got;
  };
  var catchUp = L.catchUp;
  L.catchUp = function (s, now, info) {
    var m = Math.floor(now / 60000), made = L.animalsTick(s, m), r = catchUp(s, now, info), more = L.animalsTick(s, m);
    Object.keys(more).forEach(function (k) { made[k] = (made[k] || 0) + more[k]; });
    if (r) r.produced = made;
    return r;
  };
  // The night no longer makes anything: it only checks who was fed today (hungry otherwise) and who was petted.
  var endDayA = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var keep = (s.animals || []).map(function (a) { return { a: a, fed: a.fed, ready: a.ready, bx: a.bx }; });
    keep.forEach(function (k) { k.a.fed = k.a.fd ? 1 : 0; });
    var r = endDayA(s, passedOut, info);
    keep.forEach(function (k) {
      if (s.animals.indexOf(k.a) < 0) return;
      k.a.fed = k.fed;
      k.a.ready = k.ready;
      if (k.bx) k.a.bx = k.bx; else delete k.a.bx;
      delete k.a.fd;
    });
    if (r) r.produced = {};
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
    // each animal: (minutes since it was fed + 1) x 2 + fed today, or 0
    var now = L.nowMin(), af = (s.animals || []).map(function (a) { return (a.fed && a.ft != null ? (Math.max(0, now - a.ft) + 1) * 2 : 0) + (a.fd ? 1 : 0); });
    if (af.some(Boolean)) { o.af = af; o.am = now; } // (am: the minute this was saved, so the time away counts)
    return o;
  };
  // The minute a save was written: o.am, or (older saves) its day and time of day, which follow the phone's clock
  // every second (11-world.js tickClock). Owner, 8 Nov 2026 (players: "animals didn't give milk and eggs"): a load
  // counted "minutes since fed" from the load itself, so the hours the game was closed never counted and an animal only
  // gave when the game stayed open 8 or 12 hours. Never later than now (a clock set back), never more than 30 days ago.
  L.savedMin = function (o, now) {
    var at = Math.floor(Number(o && o.am));
    if (!isFinite(at) || at <= 0) {
      var day = Math.floor(Number(o && o.d)), t = Math.floor(Number(o && o.t));
      if (!isFinite(day) || !isFinite(t) || day <= 0) return now;
      var u = new Date(day * 864e5);
      at = Math.floor(new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime() / 60000) + Math.max(0, Math.min(1439, t));
    }
    return Math.max(now - 30 * 1440, Math.min(now, at));
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    // (energy above the max is kept: a paid refill stacks; the older loaders trimmed it to the max)
    var e = Math.floor(Number(o && o.e));
    if (isFinite(e) && e > s.energy) s.energy = Math.min(C.ENERGY_MOST_COINS, e);
    var af = Array.isArray(o && o.af) ? o.af : [], now = L.savedMin(o, L.nowMin()); // (fed `ago` minutes before the save)
    s.animals.forEach(function (a, i) {
      var v = Math.max(0, Math.min(1e7, Math.floor(Number(af[i])) || 0)), ago = Math.floor(v / 2) - 1;
      delete a.fd; delete a.ft; // (only there when they mean something: an older save's animals look as they did)
      if (v % 2) a.fd = 1;
      if (a.fed && ago >= 0) a.ft = now - ago;
    });
    s.project2 = null;
    var p = o && o.p2, id = Array.isArray(p) && C.BUILD_KEYS[Math.floor(Number(p[0]))];
    if (id && (!s.project || s.project.id !== id) && !(id !== 'house' && s.builds[id])) {
      s.project2 = { id: id, done: s.day + Math.max(0, Math.min(30, Math.floor(Number(p[1])) || 0)) };
      if (!s.project) { s.project = s.project2; s.project2 = null; }
    }
    return s;
  };
})(window.Farm = window.Farm || {});
