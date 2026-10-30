// The Wild Lands rules (owner, 30 Oct 2026; content in 00-wild.js, the world side in 19v-wild.js): which animals
// roam each place right now, a hunted animal's slot waiting C.WILD.respawn minutes, what it leaves, Makiling opening
// after 10 hunts, the Bow (bought from Kanor, upgraded with gold and ore), arrows and bait, selling to Kanor, his request
// of the day, trophies, each animal's size and the Hunter's Book, and who comes out with the hour, weather and season.
// Saved as 'wl': [hunts, bow level + 1 (0 = no bow yet), hunts per animal in C.WILD.order, [area, slot, minutes ago]...,
// the day of the last request done, biggest of each animal in C.WILD.order (tenths of a kg)].
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var AREAS = Object.keys(WI.areas); // stable order: used by the save
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  C.TIPS.push({ key: 'wild', text: 'THE WILD LANDS' }, { key: 'kanor', text: 'KANOR' });
  C.COLLECTION.push('meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar', 'feather_labuyo', 'fur_rabbit', 'antler', 'tusk',
    'pelt_wolf', 'fang_wolf', 'tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw', 'white_antler', 'gold_tusk');

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.wild = { n: 0, by: {}, gone: {}, job: 0, best: {} }; // gone: 'area:slot' -> the minute it was hunted; best: kind -> tenths of a kg
    return s;
  };

  L.isWildMap = function (map) { return !!WI.areas[map]; };
  L.isNight = function (s) { return s.time >= WI.nightFrom || s.time < WI.nightTo; };

  // The animals of a place, one per slot: [{ slot, kind, when }], in a fixed order.
  L.wildSlots = function (area) {
    var out = [], a = WI.areas[area];
    if (!a) return out;
    Object.keys(a.animals).forEach(function (kind) {
      for (var i = 0; i < a.animals[kind]; i++) out.push({ slot: out.length, kind: kind });
    });
    (a.extra || []).forEach(function (x) {
      for (var i = 0; i < x.n; i++) out.push({ slot: out.length, kind: x.kind, when: x.when });
    });
    return out;
  };

  // Is the rare animal of a place about? For each 2 hours of each day, the same for everyone.
  L.wildRare = function (s, area) { return L.rand(20261030, s.day, Math.floor(s.time / 120), AREAS.indexOf(area)) < WI.rareOdds; };
  L.wildWhen = function (s, area, when) {
    if (when === 'dawn') return s.time >= 5 * 60 && s.time < 8 * 60;
    if (when === 'dusk') return s.time >= 17 * 60 && s.time < 19.5 * 60;
    if (when === 'rain') { var w = L.weather(s, s.day); return w === 'rain' || w === 'storm'; }
    if (when === 'fall') return L.date(s.day).key === 'fall';
    if (when === 'rare') return L.wildRare(s, area);
    return true;
  };

  // The ones roaming there now: not hunted a little while ago, and wolves only at night.
  L.wildHere = function (s, area) {
    var now = L.nowMin();
    return L.wildSlots(area).filter(function (e) {
      var at = s.wild.gone[area + ':' + e.slot], def = WI.animals[e.kind];
      if (at != null && now - at < (def.respawn || WI.respawn)) return false;
      if (e.when && !L.wildWhen(s, area, e.when)) return false;
      return !def.night || L.isNight(s);
    });
  };

  // What Kanor says about today: [line].
  L.wildNews = function (s) {
    var out = [], w = L.weather(s, s.day);
    if (L.wildRare(s, 'pulag')) out.push('A White Stag was seen in Pulag. It will not stay long!');
    if (L.wildOpen(s, 'makiling') && L.wildRare(s, 'makiling')) out.push('A Golden Boar is loose in Makiling. Careful!');
    if (w === 'rain' || w === 'storm') out.push('Rain brings deer down to Pulag and boars out in Makiling.');
    if (L.date(s.day).key === 'fall') out.push('Fall: more boars in Makiling.');
    if (L.wildWhen(s, 'pulag', 'dawn')) out.push('Dawn: rabbits are feeding in Pulag.');
    if (L.wildWhen(s, 'pulag', 'dusk')) out.push('Dusk: deer are moving.');
    return out;
  };

  // How big an animal is, against the usual size (rnd: a function giving 0..1).
  L.wildSize = function (rnd) {
    var g = WI.giant;
    if (rnd() < g.odds) return g.size[0] + rnd() * (g.size[1] - g.size[0]);
    return 0.8 + rnd() * 0.4;
  };
  L.wildGiant = function (size) { return size >= WI.giant.size[0]; };
  L.wildKg = function (kind, size) { return Math.round(WI.animals[kind].kg * size * 10) / 10; };

  // What an animal leaves on the ground: [[item, n]] (rnd: a function giving 0..1).
  L.huntDrops = function (kind, rnd) {
    var out = [];
    WI.animals[kind].drops.forEach(function (d) { if (d[2] >= 1 || rnd() < d[2]) out.push([d[0], d[1]]); });
    return out;
  };

  // A hunt: the slot waits for its animal to come back. Returns { opened: 'makiling' } when that hunt opens it, and
  // { kg, record: true } when this is the biggest of its kind so far (not for the very first).
  L.hunted = function (s, area, slot, kind, size) {
    var before = L.wildOpen(s, 'makiling'), kg = L.wildKg(kind, size || 1), tenths = Math.round(kg * 10), old = s.wild.best[kind] || 0;
    s.wild.gone[area + ':' + slot] = L.nowMin();
    s.wild.n += 1;
    s.wild.by[kind] = (s.wild.by[kind] || 0) + 1;
    if (tenths > old) s.wild.best[kind] = tenths;
    return { opened: !before && L.wildOpen(s, 'makiling') ? 'makiling' : null, kg: kg, record: !!old && tenths > old };
  };

  // ---------- Kanor's request of the day ----------
  L.wildJob = function (s) {
    var open = L.wildOpen(s, 'makiling'), pool = WI.jobs.filter(function (j) { return open || !j[2]; });
    var j = pool[Math.floor(L.rand(s.seed, s.day, 910) * pool.length)];
    return { item: j[0], n: j[1], gold: Math.ceil(C.ITEMS[j[0]].sell * j[1] * WI.jobPay / 10) * 10, done: s.wild.job === s.day };
  };
  L.doWildJob = function (s) {
    var j = L.wildJob(s);
    if (j.done) return 'done';
    if (L.countItem(s, j.item) < j.n) return 'short';
    L.removeItem(s, j.item, j.n);
    s.gold += j.gold;
    if (s.stats) s.stats.earned += j.gold;
    s.wild.job = s.day;
    return 'ok';
  };

  // ---------- trophies ----------
  L.makeTrophy = function (s, i) {
    var t = WI.trophies[i];
    if (!t) return 'none';
    if (s.gold < t.gold) return 'gold';
    if (t.needs.some(function (n) { return L.countItem(s, n[0]) < n[1]; })) return 'short';
    t.needs.forEach(function (n) { L.removeItem(s, n[0], n[1]); });
    s.gold -= t.gold;
    var k = L.furnKey(C.HOME.typeIndex[t.type], 0);
    s.home.bag[k] = (s.home.bag[k] || 0) + 1;
    return 'ok';
  };

  L.wildOpen = function (s, area) { var a = WI.areas[area]; return !!a && s.wild.n >= (a.unlock || 0); };

  // ---------- the Bow ----------
  L.hasBow = function (s) { return L.hasItem(s, 'bow') || (s.store || []).some(function (x) { return x && x.id === 'bow'; }); };
  L.bowLevel = function (s) { return s.tools.bow || 0; };
  L.bowRange = function (s) { return WI.bow.range[L.bowLevel(s)]; };
  L.bowDamage = function (s) { return WI.bow.damage[L.bowLevel(s)]; };
  L.buyBow = function (s) {
    if (L.hasBow(s)) return 'have';
    if (s.gold < WI.bow.price) return 'gold';
    if (!L.canAdd(s, 'bow', 1)) return 'full';
    s.gold -= WI.bow.price;
    L.addItem(s, 'bow', 1);
    return 'ok';
  };
  L.nextBow = function (s) { return WI.bow.upgrades[L.bowLevel(s)] || null; };
  L.upgradeBow = function (s) {
    var up = L.nextBow(s);
    if (!up) return 'max';
    if (!L.hasBow(s)) return 'nobow';
    if (s.gold < up.gold) return 'gold';
    if (L.countItem(s, up.ore) < up.n) return 'ore';
    s.gold -= up.gold;
    L.removeItem(s, up.ore, up.n);
    s.tools.bow = L.bowLevel(s) + 1;
    return 'ok';
  };

  // One arrow and a little energy for a shot.
  L.shoot = function (s) {
    if (!L.hasItem(s, 'arrows')) return 'arrows';
    if (s.energy < WI.shotEnergy) return 'tired';
    L.removeItem(s, 'arrows', 1);
    s.energy -= WI.shotEnergy;
    return 'ok';
  };

  // Kanor's shop: arrows by the pack, bait one at a time.
  L.buyWild = function (s, id) {
    var n = id === 'arrows' ? WI.arrowPack : 1, price = C.ITEMS[id].price;
    if (s.gold < price) return 'gold';
    if (!L.canAdd(s, id, n)) return 'full';
    s.gold -= price;
    L.addItem(s, id, n);
    return 'ok';
  };
  // Kanor buys what the wild gives (meat, feathers, furs, antlers, tusks, pelts, fangs): every one in your bag.
  L.wildGoods = function (s) {
    var out = [];
    s.inv.forEach(function (x) {
      if (x && (C.ITEMS[x.id].kind === 'meat' || C.ITEMS[x.id].kind === 'hunt') && out.indexOf(x.id) < 0) out.push(x.id);
    });
    return out;
  };
  L.sellToKanor = function (s, id) {
    var n = L.countItem(s, id);
    if (!n) return 0;
    L.removeItem(s, id, n);
    var g = n * C.ITEMS[id].sell;
    s.gold += g;
    if (s.stats) s.stats.earned += g;
    return g;
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), w = s.wild, gone = [], now = L.nowMin();
    Object.keys(w.gone).forEach(function (k) {
      var ago = now - w.gone[k], p = k.split(':');
      if (ago < 120 && AREAS.indexOf(p[0]) >= 0) gone.push([AREAS.indexOf(p[0]), +p[1], ago]);
    });
    if (w.n || L.bowLevel(s) || L.hasBow(s) || gone.length) {
      o.wl = [w.n, L.hasBow(s) ? L.bowLevel(s) + 1 : 0, WI.order.map(function (k) { return w.by[k] || 0; }), gone, w.job, WI.order.map(function (k) { return w.best[k] || 0; })];
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.wild = { n: 0, by: {}, gone: {}, job: 0, best: {} };
    var wl = Array.isArray(o.wl) ? o.wl : null;
    if (wl) {
      s.wild.n = int(wl[0], 0, 1e7, 0);
      s.tools.bow = Math.max(0, int(wl[1], 0, C.TOOL_LEVELS.length, 0) - 1);
      (Array.isArray(wl[2]) ? wl[2] : []).forEach(function (n, i) { if (WI.order[i]) s.wild.by[WI.order[i]] = int(n, 0, 1e7, 0); });
      var now = L.nowMin();
      (Array.isArray(wl[3]) ? wl[3] : []).slice(0, 50).forEach(function (g) {
        if (!Array.isArray(g) || !AREAS[g[0]]) return;
        s.wild.gone[AREAS[g[0]] + ':' + int(g[1], 0, 99, 0)] = now - int(g[2], 0, 1e4, 0);
      });
      s.wild.job = int(wl[4], 0, 1e7, 0);
      (Array.isArray(wl[5]) ? wl[5] : []).forEach(function (n, i) { if (WI.order[i]) s.wild.best[WI.order[i]] = int(n, 0, 1e6, 0); });
    }
    return s;
  };

  // ---------- friends see your Hunter's Book ----------
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var o = snapshot(s), w = s.wild;
    if (w.n) o.hb = [WI.order.map(function (k) { return w.by[k] || 0; }), WI.order.map(function (k) { return w.best[k] || 0; })];
    return o;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine), hb = snap && Array.isArray(snap.hb) ? snap.hb : null; // (`snap` is untrusted)
    if (hb) WI.order.forEach(function (k, i) {
      s.wild.by[k] = int(Array.isArray(hb[0]) ? hb[0][i] : 0, 0, 1e7, 0);
      s.wild.best[k] = int(Array.isArray(hb[1]) ? hb[1][i] : 0, 0, 1e6, 0);
    });
    return s;
  };
})(window.Farm = window.Farm || {});
