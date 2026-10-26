// Rules for Phase 3 (content in 00-quests.js): counting what you do; daily quests, weekly and monthly goals, the
// login gift and achievements (by the phone's calendar: `today` is 'YYYY-MM-DD', passed in by the game);
// villagers' requests with a streak bonus (by the game's days); the travelling trader; Stars; the Power-Up and
// the Pet Meal. Wraps the earlier logic files.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var Q = C.QUESTS;

  // ---------- counting ----------
  var STAT = { earned: 1, fish: 1, cooked: 1 };
  L.count = function (s, c) { return STAT[c] ? s.stats[c] || 0 : s.cnt[c] || 0; };
  L.bump = function (s, c, n) { s.cnt[c] = (s.cnt[c] || 0) + (n == null ? 1 : n); };

  var ok = function (r) { return r === 'ok'; };
  var got = function (r) { return typeof r === 'string' && r && r[0] !== '!' && r !== 'already'; };
  // wraps L[name] so a successful call counts towards counter c
  var countOn = function (name, c, success, amount) {
    var fn = L[name];
    L[name] = function (s) {
      var r = fn.apply(L, arguments);
      if (success(r)) L.bump(s, c, amount ? amount(r) : 1);
      return r;
    };
  };
  countOn('harvest', 'harvest', got);
  countOn('water', 'water', ok);
  countOn('till', 'till', ok);
  countOn('plantBag', 'plant', function (r) { return typeof r === 'number' && r > 0; }, function (r) { return r; });
  countOn('giveGift', 'gift', function (r) { return r && !r.error; });
  countOn('collect', 'collect', got);
  ['petAnimal', 'brushAnimal', 'feedAnimal'].forEach(function (n) { countOn(n, 'care', ok); });
  countOn('clearDebris', 'clear', function (r) { return !!r; });
  countOn('deliverOrder', 'order', function (r) { return r > 0; });
  countOn('reachFloor', 'floor', function (r) { return r === true; });
  countOn('takeForage', 'forage', got);
  ['petDog', 'petCat', 'petHorse'].forEach(function (n) { countOn(n, 'pet', ok); });
  countOn('placeYard', 'decor', function (r) { return typeof r === 'number'; });
  countOn('placeFurn', 'decor', function (r) { return typeof r === 'number'; });
  // a talk counts once per villager per day
  var talk = L.talk;
  L.talk = function (s, key) {
    var first = !L.friend(s, key).talked, r = talk(s, key);
    if (first) L.bump(s, 'talk');
    return r;
  };

  // ---------- new state ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    L.phase3(s);
    return s;
  };
  // (also used for older saves)
  L.phase3 = function (s) {
    s.cnt = s.cnt || {};
    s.stars = s.stars || 0;
    s.dq = s.dq || null; // daily quests
    s.wq = s.wq || null; // weekly goals
    s.mq = s.mq || null; // monthly goals
    s.lg = s.lg || { last: 0, streak: 0, claimed: 0 }; // login gift
    s.seen = s.seen || 0; // the last real day you played
    s.ach = s.ach || 0; // achievements claimed (bits)
    s.rq = s.rq || { day: 0, list: [], streak: 0, last: 0 }; // requests
    s.trd = s.trd || { day: 0, sold: {} }; // what the trader bought today
    s.pwr = s.pwr || { day: 0, until: 0 }; // Power-Up
    s.pm = s.pm || { day: 0, fed: 0 }; // Pet Meals given today (bits: dog, cat, horse)
  };

  // ---------- real dates ----------
  // 'YYYY-MM-DD' -> days since 1970-01-01
  L.dayNum = function (today) {
    var p = String(today).split('-');
    return Math.floor(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / 864e5);
  };
  L.weekOf = function (dn) { return dn - ((new Date(dn * 864e5).getUTCDay() + 6) % 7); }; // that week's Monday
  L.monthOf = function (today) { return String(today).slice(0, 7); };

  // ---------- rewards ----------
  L.rewardFits = function (s, r) { return !r.item || L.canAdd(s, r.item, r.n || 1); };
  L.giveReward = function (s, r) {
    if (!L.rewardFits(s, r)) return false;
    if (r.gold) s.gold += r.gold;
    if (r.stars) s.stars += r.stars;
    if (r.item) L.addItem(s, r.item, r.n || 1);
    return true;
  };
  L.rewardLabel = function (r) {
    var out = [];
    if (r.gold) out.push(r.gold + 'G');
    if (r.stars) out.push(r.stars + (r.stars > 1 ? ' Sunbeams' : ' Sunbeam'));
    if (r.item) out.push((r.n > 1 ? r.n + ' ' : '') + C.ITEMS[r.item].name);
    return out.join(' + ');
  };

  // ---------- daily quests, weekly goals, monthly goals ----------
  // (every season has crops now, so every quest fits any day)
  var fits = function () { return true; };
  var pick = function (s, list, n, seed) {
    var out = [], pool = list.filter(function (q) { return fits(s, q); });
    for (var k = 0; out.length < n && k < 60; k++) {
      var q = pool[Math.floor(L.rand(s.seed, seed, k) * pool.length)];
      if (q && out.indexOf(q) < 0 && !out.some(function (o) { return o.c === q.c; })) out.push(q);
    }
    return out;
  };
  // a quest as stored: { c, n, text, reward, b (the counter when it began), done (claimed) }
  var start = function (s, q, reward) {
    return { c: q.c, n: q.n, text: q.text.replace('{n}', q.n), reward: reward || q.reward, b: L.count(s, q.c), done: 0 };
  };

  // Brings the daily, weekly and monthly lists up to date for the real date. Returns what is new.
  L.refreshQuests = function (s, today) {
    var dn = L.dayNum(today), news = {};
    if (s.seen !== dn) {
      s.seen = dn;
      L.bump(s, 'login');
    }
    if (!s.dq || s.dq.d !== dn) {
      var easy = pick(s, Q.easy, 5, dn * 7 + 1), medium = pick(s, Q.medium, 2, dn * 7 + 2);
      var hard = Q.hard.map(function (h, k) { return start(s, pick(s, h.list, 1, dn * 7 + 3 + k)[0], Q.prizes[h.prize]); });
      s.dq = { d: dn, all: 0, list: easy.map(function (q) { return start(s, q); }).concat(medium.map(function (q) { return start(s, q); }), hard) };
      s.dq.list.forEach(function (q, k) { q.tier = k < 5 ? 'easy' : k < 7 ? 'medium' : 'hard'; });
      news.daily = true;
    }
    var wk = L.weekOf(dn);
    if (!s.wq || s.wq.w !== wk) {
      s.wq = { w: wk, chest: 0, list: pick(s, C.WEEKLY.goals, C.WEEKLY.count, wk * 3 + 9).map(function (q) { return start(s, q); }) };
      news.weekly = true;
    }
    var mo = L.monthOf(today);
    if (!s.mq || s.mq.m !== mo) {
      s.mq = { m: mo, chest: 0, list: C.MONTHLY.goals.map(function (q) { return start(s, q); }) };
      // logging in today counts for this month
      s.mq.list.forEach(function (q) { if (q.c === 'login') q.b -= 1; });
      news.monthly = true;
    }
    return news;
  };

  L.questOf = function (s, kind) { return { daily: s.dq, weekly: s.wq, monthly: s.mq }[kind]; };
  L.questProgress = function (s, q) { return Math.max(0, Math.min(q.n, L.count(s, q.c) - q.b)); };
  L.questReady = function (s, q) { return !q.done && L.questProgress(s, q) >= q.n; };

  // Claims quest i of a list ('daily', 'weekly' or 'monthly'). Returns the reward, or why not.
  L.claimQuest = function (s, kind, i) {
    var set = L.questOf(s, kind), q = set && set.list[i];
    if (!q) return 'none';
    if (q.done) return 'done';
    if (L.questProgress(s, q) < q.n) return 'notyet';
    if (!L.giveReward(s, q.reward)) return 'full';
    q.done = 1;
    if (kind === 'daily') L.bump(s, 'dquest');
    return q.reward;
  };

  // The bonus for finishing every quest in a list (the daily bonus, the weekly and monthly chests).
  L.chestOf = function (kind) { return { daily: Q.all, weekly: C.WEEKLY.chest, monthly: C.MONTHLY.chest }[kind]; };
  L.chestReady = function (s, kind) {
    var set = L.questOf(s, kind);
    return !!set && !(kind === 'daily' ? set.all : set.chest) && set.list.every(function (q) { return q.done; });
  };
  L.claimChest = function (s, kind) {
    if (!L.chestReady(s, kind)) return 'notyet';
    var r = L.chestOf(kind), set = L.questOf(s, kind);
    if (!L.giveReward(s, r)) return 'full';
    if (kind === 'daily') set.all = 1; else set.chest = 1;
    if (kind === 'weekly') L.bump(s, 'wchest');
    return r;
  };

  // Anything waiting to be claimed (for the "!" on the Quests button).
  L.questsWaiting = function (s) {
    var n = 0;
    ['daily', 'weekly', 'monthly'].forEach(function (k) {
      var set = L.questOf(s, k);
      if (!set) return;
      set.list.forEach(function (q) { if (L.questReady(s, q)) n++; });
      if (L.chestReady(s, k)) n++;
    });
    C.ACHIEVEMENTS.forEach(function (a, i) { if (L.achReady(s, i)) n++; });
    return n;
  };

  // ---------- the login gift ----------
  // The gift waiting today ({ day: 1..7, reward }), or null once claimed.
  L.loginGift = function (s, today) {
    var dn = L.dayNum(today);
    if (dn <= s.lg.claimed) return null; // only a day after the last claim (setting the date back gives nothing)
    var day = s.lg.last === dn - 1 ? s.lg.streak % C.LOGIN.length + 1 : 1;
    return { day: day, reward: C.LOGIN[day - 1] };
  };
  L.claimLogin = function (s, today) {
    var g = L.loginGift(s, today);
    if (!g) return 'done';
    if (!L.giveReward(s, g.reward)) return 'full';
    var dn = L.dayNum(today);
    s.lg = { last: dn, streak: g.day, claimed: dn };
    return g;
  };

  // ---------- achievements ----------
  L.achValue = function (s, a) {
    var what = a.test[0];
    if (what === 'deepest') return s.stats.deepest || 0;
    if (what === 'friends5') return C.VILLAGER_ORDER.filter(function (k) { return L.friendHearts(s, k) >= 5; }).length;
    if (what === 'married') return s.spouse ? 1 : 0;
    if (what === 'animals') return s.animals.length;
    // pieces standing in the yard now (placing and storing the same piece again and again doesn't add up)
    if (what === 'decor') return s.yard && s.yard.items ? s.yard.items.length : 0;
    if (what === 'home') return s.home.level;
    if (what === 'beauty') return L.homeBeauty(s);
    return L.count(s, what);
  };
  L.achDone = function (s, i) { return !!(s.ach & (1 << i)); };
  L.achReady = function (s, i) { var a = C.ACHIEVEMENTS[i]; return !L.achDone(s, i) && L.achValue(s, a) >= a.test[1]; };
  L.claimAch = function (s, i) {
    if (!L.achReady(s, i)) return 'notyet';
    s.ach |= 1 << i;
    s.stars += C.ACHIEVEMENTS[i].stars;
    return C.ACHIEVEMENTS[i];
  };

  // ---------- villagers' requests ----------
  var DISHES = ['boiled_egg', 'hot_milk', 'baked_potato', 'jam', 'grilled_fish'];
  // What a request could ask for today: [item, min, max]
  L.requestPool = function (s) {
    var pool = [];
    L.seedsInSeason(s.day).forEach(function (seed) {
      var crop = C.ITEMS[seed].crop;
      if (crop && C.ITEMS[crop] && C.ITEMS[crop].sell && seed !== 'seed_grass') pool.push([crop, 3, 6]);
    });
    var kinds = {};
    s.animals.forEach(function (a) { kinds[a.kind] = 1; });
    Object.keys(kinds).forEach(function (k) { var p = C.ANIMALS[k].product; if (p) pool.push([p, 2, 3]); });
    if (L.hasItem(s, 'rod')) pool.push(['fish_s', 1, 2], ['fish_m', 1, 2]);
    var fg = L.forageItem(s.day);
    if (fg) pool.push([fg, 1, 3]);
    if (s.builds.kitchen) DISHES.forEach(function (d) { pool.push([d, 1, 1]); });
    if ((s.stats.deepest || 0) >= 1) pool.push(['ore_copper', 3, 5]);
    if ((s.stats.deepest || 0) >= 10) pool.push(['ore_silver', 2, 4]);
    // never something a shop sells (buying it and handing it in would pay more than it cost)
    return pool.filter(function (e) { return !C.ITEMS[e[0]].price; });
  };
  var valueOf = function (id) { var it = C.ITEMS[id]; return it.sell || (it.energy || 10) * 4; };

  // The day's requests: a few on the notice board and one from a villager in person (someone you have met).
  L.ensureRequests = function (s) {
    if (s.rq.day === s.day) return s.rq.list;
    var pool = L.requestPool(s), list = [], R = C.REQUESTS, used = {};
    var make = function (where, who, k) {
      if (!pool.length || !who) return;
      var e = pool[Math.floor(L.rand(s.seed, s.day, 700 + k) * pool.length)];
      var n = e[1] + Math.floor(L.rand(s.seed, s.day, 720 + k) * (e[2] - e[1] + 1));
      list.push({ from: who, id: e[0], n: n, gold: Math.max(80, Math.round(valueOf(e[0]) * n * R.pay / 10) * 10), where: where, done: 0 });
    };
    var everyone = C.VILLAGER_ORDER.filter(function (k) { return !C.VILLAGERS[k].child; });
    for (var k = 0; k < R.board; k++) {
      var who = everyone[Math.floor(L.rand(s.seed, s.day, 740 + k) * everyone.length)];
      if (used[who]) who = everyone[(everyone.indexOf(who) + k + 1) % everyone.length];
      used[who] = 1;
      make('board', who, k);
    }
    var met = C.VILLAGER_ORDER.filter(function (k2) { return L.friend(s, k2).met && !used[k2] && s.spouse !== k2; });
    for (var p = 0; p < R.person && met.length; p++) make('person', met[Math.floor(L.rand(s.seed, s.day, 760 + p) * met.length)], 10 + p);
    s.rq.day = s.day;
    s.rq.list = list;
    return list;
  };

  L.streakBonus = function (s) {
    var live = s.rq.last >= s.day - 1 ? s.rq.streak : 0;
    return Math.min(C.REQUESTS.streakMax, Math.max(0, live) * C.REQUESTS.streakStep);
  };
  L.requestFor = function (s, key) {
    L.ensureRequests(s);
    var i = -1;
    s.rq.list.forEach(function (r, k) { if (r.where === 'person' && r.from === key && !r.done) i = k; });
    return i;
  };
  L.canFinishRequest = function (s, i) { var r = s.rq.list[i]; return !!r && !r.done && L.countItem(s, r.id) >= r.n; };

  // Hands over the items. Returns { gold, pts, bonus } or a reason.
  L.finishRequest = function (s, i) {
    var r = s.rq.list[i];
    if (!r || r.done) return 'none';
    if (L.countItem(s, r.id) < r.n) return 'missing';
    L.removeItem(s, r.id, r.n);
    // the streak: one more if yesterday had a finished request, else it starts again
    if (s.rq.last !== s.day) {
      s.rq.streak = s.rq.last === s.day - 1 ? s.rq.streak + 1 : 1;
      s.rq.last = s.day;
    }
    var bonus = Math.min(C.REQUESTS.streakMax, (s.rq.streak - 1) * C.REQUESTS.streakStep);
    var gold = Math.round(r.gold * (1 + bonus));
    var pts = C.REQUESTS.pts[r.where];
    s.gold += gold;
    L.friend(s, r.from).met = 1;
    L.addFriend(s, r.from, pts);
    r.done = 1;
    L.bump(s, 'request');
    return { gold: gold, pts: pts, bonus: bonus };
  };

  // ---------- the travelling trader ----------
  L.traderHere = function (s) {
    var t = C.TRADER;
    return t.days.indexOf(L.weekday(s.day)) >= 0 && s.time >= t.open[0] && s.time < t.open[1] && !L.festivalOn(s.day);
  };
  L.traderWanted = function (s) {
    var out = [], b = C.TRADER.buys;
    for (var k = 0; out.length < C.TRADER.wanted && k < 40; k++) {
      var id = b[Math.floor(L.rand(s.seed, s.day, 800 + k) * b.length)];
      if (out.indexOf(id) < 0) out.push(id);
    }
    return out;
  };
  L.traderPrice = function (s, id) {
    var t = C.TRADER;
    return Math.round(C.ITEMS[id].sell * (L.traderWanted(s).indexOf(id) >= 0 ? t.wantedPay : t.pay));
  };
  L.traderLeft = function (s, id) {
    if (s.trd.day !== s.day) s.trd = { day: s.day, sold: {} };
    return Math.max(0, C.TRADER.perDay - (s.trd.sold[id] || 0));
  };
  // Sells n of an item from the bag. Returns the gold, or a reason.
  L.traderSell = function (s, id, n) {
    if (C.TRADER.buys.indexOf(id) < 0) return 'nobuy';
    n = Math.min(n, L.traderLeft(s, id), L.countItem(s, id));
    if (n <= 0) return 'none';
    var gold = L.traderPrice(s, id) * n;
    L.removeItem(s, id, n);
    s.trd.sold[id] = (s.trd.sold[id] || 0) + n;
    s.gold += gold;
    s.stats.earned += gold;
    L.discover(s, id);
    return gold;
  };

  // The festival piece a swap gives today (any season): furniture { t, v } or a yard piece { t }.
  L.swapPiece = function (s, kind) {
    var r = L.rand(s.seed, s.day, kind === 'yard' ? 830 : 820);
    if (kind === 'yard') {
      var yards = C.OUTDOOR.types.map(function (t, i) { return i; }).filter(function (i) { return C.OUTDOOR.types[i].festival; });
      return { t: yards[Math.floor(r * yards.length)] };
    }
    var styles = C.HOME.styles.map(function (st, i) { return i; }).filter(function (i) { return C.HOME.styles[i].festival; });
    var types = C.HOME.types.map(function (t, i) { return i; }).filter(function (i) { return !C.HOME.types[i].needs; });
    return { t: types[Math.floor(r * types.length)], v: styles[Math.floor(L.rand(s.seed, s.day, 821) * styles.length)] };
  };
  L.canSwap = function (s, i) {
    var sw = C.TRADER.swaps[i];
    return !!sw && sw.give.every(function (g) { return g[0] === 'stars' ? s.stars >= g[1] : L.countItem(s, g[0]) >= g[1]; });
  };
  L.traderSwap = function (s, i) {
    var sw = C.TRADER.swaps[i];
    if (!sw) return 'none';
    if (!L.canSwap(s, i)) return 'missing';
    if (sw.get.item && !L.canAdd(s, sw.get.item, sw.get.n || 1)) return 'full';
    sw.give.forEach(function (g) { if (g[0] === 'stars') s.stars -= g[1]; else L.removeItem(s, g[0], g[1]); });
    var out = sw.get;
    if (sw.get.item) L.addItem(s, sw.get.item, sw.get.n || 1);
    if (sw.get.stars) s.stars += sw.get.stars;
    if (sw.get.furniture) {
      var f = L.swapPiece(s, 'furniture'), k = L.furnKey(f.t, f.v);
      s.home.bag[k] = (s.home.bag[k] || 0) + 1;
      out = { furniture: f };
    }
    if (sw.get.yard) {
      var y = L.swapPiece(s, 'yard');
      s.yard.bag[y.t] = (s.yard.bag[y.t] || 0) + 1;
      out = { yard: y };
    }
    L.bump(s, 'trade');
    return out;
  };

  // ---------- the Power-Up and the Pet Meal ----------
  L.usePowerUp = function (s, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || slot.id !== 'power_up') return 'none';
    L.removeAt(s, slotIndex, 1);
    s.energy = Math.max(s.energy, L.maxEnergy(s));
    s.pwr = { day: s.day, until: s.time + C.POWER_UP.minutes };
    return 'ok';
  };
  // the 2 hours run on past midnight (until counts minutes from the start of the day it was drunk)
  L.powered = function (s) { return s.day * 1440 + s.time < s.pwr.day * 1440 + s.pwr.until; };
  var spendEnergy = L.spendEnergy;
  L.spendEnergy = function (s, amount) {
    if (L.powered(s)) return true;
    return spendEnergy(s, amount);
  };

  var PETS = ['dog', 'cat', 'horse'];
  // which: 'dog', 'cat' or 'horse'. Once a day each.
  L.feedPet = function (s, which, slotIndex) {
    var pet = s[which], bit = 1 << PETS.indexOf(which), slot = s.inv[slotIndex];
    if (!pet) return 'none';
    if (!slot || slot.id !== 'pet_meal') return 'nomeal';
    if (s.pm.day !== s.day) s.pm = { day: s.day, fed: 0 };
    if (s.pm.fed & bit) return 'already';
    L.removeAt(s, slotIndex, 1);
    s.pm.fed |= bit;
    pet.love = Math.min(C.LOVE.max, pet.love + C.PET_MEAL_LOVE);
    return 'ok';
  };

  // ---------- day end and save ----------
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    L.ensureRequests(s);
    return r;
  };

  var packQ = function (set) { return set ? set.list.map(function (q) { return [C.COUNTERS.indexOf(q.c), q.n, q.b, q.done, q.reward, q.text, q.tier || '']; }) : null; };
  var unpackQ = function (rows) {
    return (Array.isArray(rows) ? rows : []).filter(function (e) { return Array.isArray(e) && C.COUNTERS[e[0]]; }).map(function (e) {
      var q = { c: C.COUNTERS[e[0]], n: Math.max(1, Number(e[1]) || 1), b: Number(e[2]) || 0, done: e[3] ? 1 : 0, reward: e[4] && typeof e[4] === 'object' ? e[4] : { gold: 100 }, text: String(e[5] || '') };
      if (e[6]) q.tier = String(e[6]);
      return q;
    });
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.p3 = {
      c: C.COUNTERS.map(function (c) { return s.cnt[c] || 0; }), st: s.stars, a: s.ach, sn: s.seen,
      dq: s.dq ? [s.dq.d, s.dq.all, packQ(s.dq)] : 0, wq: s.wq ? [s.wq.w, s.wq.chest, packQ(s.wq)] : 0, mq: s.mq ? [s.mq.m, s.mq.chest, packQ(s.mq)] : 0,
      lg: [s.lg.last, s.lg.streak, s.lg.claimed],
      rq: [s.rq.day, s.rq.streak, s.rq.last, s.rq.list.map(function (r) { return [C.VILLAGER_ORDER.indexOf(r.from), r.id, r.n, r.gold, r.where === 'person' ? 1 : 0, r.done]; })],
      tr: [s.trd.day, s.trd.sold], pw: [s.pwr.day, s.pwr.until], pm: [s.pm.day, s.pm.fed],
    };
    return o;
  };
  var num = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var p = o.p3 && typeof o.p3 === 'object' ? o.p3 : {};
    s.cnt = {};
    (Array.isArray(p.c) ? p.c : []).forEach(function (v, i) { if (C.COUNTERS[i]) s.cnt[C.COUNTERS[i]] = Math.max(0, num(v)); });
    s.stars = Math.max(0, num(p.st));
    s.ach = num(p.a);
    s.seen = num(p.sn);
    s.dq = Array.isArray(p.dq) ? { d: num(p.dq[0]), all: p.dq[1] ? 1 : 0, list: unpackQ(p.dq[2]) } : null;
    s.wq = Array.isArray(p.wq) ? { w: num(p.wq[0]), chest: p.wq[1] ? 1 : 0, list: unpackQ(p.wq[2]) } : null;
    s.mq = Array.isArray(p.mq) ? { m: String(p.mq[0]), chest: p.mq[1] ? 1 : 0, list: unpackQ(p.mq[2]) } : null;
    var lg = Array.isArray(p.lg) ? p.lg : [];
    s.lg = { last: num(lg[0]), streak: Math.max(0, Math.min(C.LOGIN.length, num(lg[1]))), claimed: num(lg[2]) };
    var rq = Array.isArray(p.rq) ? p.rq : [];
    s.rq = {
      day: num(rq[0]), streak: Math.max(0, num(rq[1])), last: num(rq[2]),
      list: (Array.isArray(rq[3]) ? rq[3] : []).filter(function (e) { return Array.isArray(e) && C.VILLAGER_ORDER[e[0]] && C.ITEMS[e[1]]; }).map(function (e) {
        return { from: C.VILLAGER_ORDER[e[0]], id: e[1], n: Math.max(1, num(e[2])), gold: Math.max(0, num(e[3])), where: e[4] ? 'person' : 'board', done: e[5] ? 1 : 0 };
      }),
    };
    var tr = Array.isArray(p.tr) ? p.tr : [];
    s.trd = { day: num(tr[0]), sold: tr[1] && typeof tr[1] === 'object' ? tr[1] : {} };
    var pw = Array.isArray(p.pw) ? p.pw : [];
    s.pwr = { day: num(pw[0]), until: num(pw[1]) };
    var pm = Array.isArray(p.pm) ? p.pm : [];
    s.pm = { day: num(pm[0]), fed: num(pm[1]) };
    L.phase3(s);
    return s;
  };
})(window.Farm = window.Farm || {});
