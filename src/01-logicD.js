// The Wild Lands rules (owner, 30 Oct 2026; content in 00-wild.js, the world side in 19v-wild.js): which animals
// roam each place right now, a hunted animal's slot waiting C.WILD.respawn minutes, what it leaves, Makiling opening
// after 10 hunts, the Bow (bought from Kanor, upgraded with gold and ore), arrows and bait, selling to Kanor, his request
// of the day, trophies, each animal's size and the Hunter's Book, and who comes out with the hour, weather and season.
// Saved as 'wl': [hunts, bow level + 1 (0 = no bow yet), hunts per animal in C.WILD.order, [area, slot, the minute it went]...,
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
    'pelt_wolf', 'fang_wolf', 'tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw', 'white_antler', 'gold_tusk',
    'meat_bear', 'fur_bear', 'claw_bear', 'meat_mammoth', 'wool_mammoth', 'tusk_mammoth', 'pelt_tiger', 'claw_tiger', 'hide_rhino', 'horn_rhino', 'kaldereta', 'bistek');

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
    if (when === 'great') return L.weekendMarket(s.day);
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
    if (L.weekendMarket(s.day)) out.push('The Great Mammoth is on Magayon this weekend. It takes two or more hunters: bring a friend!');
    return out;
  };

  // How big an animal is, against the usual size (rnd: a function giving 0..1).
  L.wildSize = function (rnd) {
    var g = WI.giant;
    if (rnd() < g.odds) return g.size[0] + rnd() * (g.size[1] - g.size[0]);
    return 0.9 + rnd() * 0.2;
  };
  L.wildGiant = function (size) { return size >= WI.giant.size[0]; };
  L.wildKg = function (kind, size) { return Math.round(WI.animals[kind].kg * size * 10) / 10; };

  // What an animal leaves on the ground: [[item, n]] (rnd: a function giving 0..1).
  L.huntDrops = function (kind, rnd) {
    var out = [];
    WI.animals[kind].drops.forEach(function (d) { if (d[2] >= 1 || rnd() < d[2]) out.push([d[0], d[1]]); });
    return out;
  };

  // The next place still shut, if any.
  L.wildNext = function (s) {
    return AREAS.filter(function (a) { return !L.wildOpen(s, a); }).sort(function (a, b) { return WI.areas[a].unlock - WI.areas[b].unlock; })[0] || null;
  };

  // A hunt: the slot waits for its animal to come back. Returns { opened: 'makiling' } when that hunt opens a place, and
  // { kg, record: true } when this is the biggest of its kind so far (not for the very first).
  L.hunted = function (s, area, slot, kind, size) {
    var next = L.wildNext(s), kg = L.wildKg(kind, size || 1), tenths = Math.round(kg * 10), old = s.wild.best[kind] || 0;
    s.wild.gone[area + ':' + slot] = L.nowMin();
    s.wild.n += 1;
    s.wild.by[kind] = (s.wild.by[kind] || 0) + 1;
    L.bump(s, 'hunt');
    if (tenths > old) s.wild.best[kind] = tenths;
    return { opened: next && L.wildOpen(s, next) ? next : null, kg: kg, record: !!old && tenths > old };
  };

  // ---------- what the rest of the game needs from hunting ----------
  L.hasNeeds = function (s, needs) { return (needs || []).every(function (n) { return L.countItem(s, n[0]) >= n[1]; }); };
  L.takeNeeds = function (s, needs) { (needs || []).forEach(function (n) { L.removeItem(s, n[0], n[1]); }); };
  L.needsText = function (needs) { return (needs || []).map(function (n) { return n[1] + ' ' + C.ITEMS[n[0]].name; }).join(', '); };
  var nextBag = L.nextBag;
  L.nextBag = function (s) {
    var b = nextBag(s);
    if (b) b.needs = C.BAG_NEEDS[L.bagLevel(s) + 1] || null;
    return b;
  };
  var upgradeBag = L.upgradeBag;
  L.upgradeBag = function (s) {
    var b = L.nextBag(s);
    if (b && s.gold >= b.price && !L.hasNeeds(s, b.needs)) return 'needs';
    var r = upgradeBag(s);
    if (r === 'ok' && b) L.takeNeeds(s, b.needs);
    return r;
  };
  var upgradeTool = L.upgradeTool;
  L.upgradeTool = function (s, tool) {
    var c = L.upgradeCost(s, tool);
    if (c && s.gold >= c.gold && L.countItem(s, c.ore) >= c.n && !L.hasNeeds(s, c.needs)) return 'needs';
    var r = upgradeTool(s, tool);
    if (r === 'ok' && c) L.takeNeeds(s, c.needs);
    return r;
  };
  var startHome = L.startHomeUpgrade;
  L.startHomeUpgrade = function (s) {
    var n = L.nextHome(s);
    if (n && !s.project && s.gold >= n.gold && s.lumber >= n.lumber && s.stone >= n.stone && !L.hasNeeds(s, n.needs)) return 'needs';
    var r = startHome(s);
    if (r === 'ok' && n) L.takeNeeds(s, n.needs);
    return r;
  };

  // ---------- dishes with a power ----------
  // s.dp: { id, until (real minute) }. The newest dish's power replaces the last, and a full stomach still takes one.
  L.power = function (s, key) {
    var d = s.dp, p = d && C.DISH_POWERS[d.id];
    return !!p && p.key === key && L.nowMin() < d.until;
  };
  L.powerLeft = function (s) { var d = s.dp; return d && C.DISH_POWERS[d.id] ? Math.max(0, d.until - L.nowMin()) : 0; };
  var eat = L.eat;
  L.eat = function (s, slotIndex) {
    var slot = s.inv[slotIndex], id = slot && slot.id, p = id && C.DISH_POWERS[id], full = s.energy >= L.maxEnergy(s);
    if (p && full) L.removeAt(s, slotIndex, 1);
    var r = p && full ? 0 : eat(s, slotIndex);
    if (p && (full || r > 0)) s.dp = { id: id, until: L.nowMin() + C.DISH_POWER_MINS };
    return p && full ? -2 : r; // (-2: nothing to refill, the power is on)
  };
  var toolEnergy = L.toolEnergy;
  L.toolEnergy = function (s, tool, n) { var e = toolEnergy(s, tool, n); return L.power(s, 'tools') ? Math.max(1, Math.round(e * 0.8)) : e; };
  var mineEnergy = L.mineEnergy;
  L.mineEnergy = function (s, floor) { var e = mineEnergy(s, floor); return L.power(s, 'mine') ? Math.max(1, Math.round(e * 0.7)) : e; };
  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var got = harvest(s, idx);
    if (typeof got === 'string' && got[0] !== '!' && L.power(s, 'crop') && Math.random() < 0.2) L.addItem(s, got, 1);
    return got;
  };

  // ---------- the Great Mammoth ----------
  // One Great Tusk a week for each hunter (it can come back the same weekend, for the rest of what it leaves).
  L.greatTusk = function (s) {
    var wk = L.weekOf(L.dayOf(L.clock()));
    if (s.wild.gw === wk) return false;
    s.wild.gw = wk;
    return true;
  };

  // ---------- hunting with friends ----------
  // One phone runs the animals of a place and tells the others where they are: whoever came first (ids settle a tie),
  // so everyone works out the same answer from the presence list. Someone from before this update (no sn) cannot.
  L.wildLead = function (list) {
    var best = null;
    (list || []).forEach(function (p) { if (p.sn && (!best || p.sn < best.sn || (p.sn === best.sn && p.id < best.id))) best = p; });
    return best ? best.id : null;
  };
  var DIRS = ['down', 'up', 'side'], MODES = ['idle', 'graze', 'walk', 'flee', 'charge', 'eat', 'toBait'];
  L.wildPack = function (a) {
    return [a.slot, WI.order.indexOf(a.kind), Math.round(a.x), Math.round(a.y), DIRS.indexOf(a.dir), a.left ? 1 : 0, MODES.indexOf(a.mode), a.hp, Math.round(a.size * 100), a.look ? 1 : 0, a.max || WI.animals[a.kind].hp];
  };
  // (what comes off the live channel: anything that is not an animal is dropped)
  L.wildUnpack = function (r) {
    if (!Array.isArray(r) || r.length < 10 || r.slice(0, 9).some(function (v) { return typeof v !== 'number' || !isFinite(v); })) return null;
    var kind = WI.order[r[1]], most = 400 * C.TILE;
    if (!kind || r[0] < 0 || r[0] > 99 || r[0] !== Math.floor(r[0]) || !DIRS[r[4]] || !MODES[r[6]]) return null;
    return { slot: r[0], kind: kind, x: Math.max(0, Math.min(most, r[2])), y: Math.max(0, Math.min(most, r[3])), dir: DIRS[r[4]], left: !!r[5], mode: MODES[r[6]],
      hp: Math.max(0, Math.min(WI.animals[kind].hp, r[7])), size: Math.max(0.5, Math.min(2, r[8] / 100)), look: !!r[9],
      max: Math.max(1, Math.min(WI.animals[kind].hp, Number(r[10]) || WI.animals[kind].hp)) };
  };

  // ---------- Kanor's request of the day ----------
  L.wildJob = function (s) {
    var open = [true, L.wildOpen(s, 'makiling'), L.wildOpen(s, 'magayon')], pool = WI.jobs.filter(function (j) { return open[j[2] || 0]; });
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
  L.bowRange = function (s) { return WI.bow.range[L.bowLevel(s)] + (L.power(s, 'bow') ? 1 : 0); };
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
      var p = k.split(':');
      if (now - w.gone[k] < 4320 && AREAS.indexOf(p[0]) >= 0) gone.push([AREAS.indexOf(p[0]), +p[1], w.gone[k]]); // the minute itself: time away counts too
    });
    if (w.n || L.bowLevel(s) || L.hasBow(s) || gone.length) {
      o.wl = [w.n, L.hasBow(s) ? L.bowLevel(s) + 1 : 0, WI.order.map(function (k) { return w.by[k] || 0; }), gone, w.job, WI.order.map(function (k) { return w.best[k] || 0; }), w.gw || 0];
    }
    if (s.dp && C.DISH_POWERS[s.dp.id]) o.dp = [s.dp.id, s.dp.until];
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
        s.wild.gone[AREAS[g[0]] + ':' + int(g[1], 0, 99, 0)] = Math.min(now, int(g[2], 0, 1e10, 0));
      });
      s.wild.job = int(wl[4], 0, 1e7, 0);
      (Array.isArray(wl[5]) ? wl[5] : []).forEach(function (n, i) { if (WI.order[i]) s.wild.best[WI.order[i]] = int(n, 0, 1e6, 0); });
      s.wild.gw = int(wl[6], 0, 1e7, 0);
    }
    s.dp = Array.isArray(o.dp) && C.DISH_POWERS[o.dp[0]] ? { id: String(o.dp[0]), until: int(o.dp[1], 0, 1e10, 0) } : null;
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
