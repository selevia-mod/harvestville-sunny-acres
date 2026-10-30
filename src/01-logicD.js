// The Wild Lands rules (owner, 30 Oct 2026; content in 00-wild.js, the world side in 19v-wild.js): which animals
// roam each place right now, a hunted animal's slot waiting C.WILD.respawn minutes, what it leaves, Makiling opening
// after 10 hunts, the Bow (bought from Kanor, upgraded with gold and ore), arrows and bait, and selling to Kanor.
// Saved as 'wl': [hunts, bow level + 1 (0 = no bow yet), hunts per animal in C.WILD.order, [area, slot, minutes ago]...].
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var AREAS = Object.keys(WI.areas); // stable order: used by the save
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  C.TIPS.push({ key: 'wild', text: 'THE WILD LANDS' }, { key: 'kanor', text: 'KANOR' });
  C.COLLECTION.push('meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar', 'feather_labuyo', 'fur_rabbit', 'antler', 'tusk',
    'pelt_wolf', 'fang_wolf', 'tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw');

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.wild = { n: 0, by: {}, gone: {} }; // gone: 'area:slot' -> the minute it was hunted
    return s;
  };

  L.isWildMap = function (map) { return !!WI.areas[map]; };
  L.isNight = function (s) { return s.time >= WI.nightFrom || s.time < WI.nightTo; };

  // The animals of a place, one per slot: [{ slot, kind }], in a fixed order.
  L.wildSlots = function (area) {
    var out = [], a = WI.areas[area];
    if (!a) return out;
    Object.keys(a.animals).forEach(function (kind) {
      for (var i = 0; i < a.animals[kind]; i++) out.push({ slot: out.length, kind: kind });
    });
    return out;
  };

  // The ones roaming there now: not hunted in the last C.WILD.respawn minutes, and wolves only at night.
  L.wildHere = function (s, area) {
    var now = L.nowMin();
    return L.wildSlots(area).filter(function (e) {
      var at = s.wild.gone[area + ':' + e.slot];
      if (at != null && now - at < WI.respawn) return false;
      return !WI.animals[e.kind].night || L.isNight(s);
    });
  };

  // What an animal leaves on the ground: [[item, n]] (rnd: a function giving 0..1).
  L.huntDrops = function (kind, rnd) {
    var out = [];
    WI.animals[kind].drops.forEach(function (d) { if (d[2] >= 1 || rnd() < d[2]) out.push([d[0], d[1]]); });
    return out;
  };

  // A hunt: the slot waits for its animal to come back; returns { opened: 'makiling' } when that hunt opens it.
  L.hunted = function (s, area, slot, kind) {
    var before = L.wildOpen(s, 'makiling');
    s.wild.gone[area + ':' + slot] = L.nowMin();
    s.wild.n += 1;
    s.wild.by[kind] = (s.wild.by[kind] || 0) + 1;
    return { opened: !before && L.wildOpen(s, 'makiling') ? 'makiling' : null };
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
      if (ago < WI.respawn && AREAS.indexOf(p[0]) >= 0) gone.push([AREAS.indexOf(p[0]), +p[1], ago]);
    });
    if (w.n || L.bowLevel(s) || L.hasBow(s) || gone.length) o.wl = [w.n, L.hasBow(s) ? L.bowLevel(s) + 1 : 0, WI.order.map(function (k) { return w.by[k] || 0; }), gone];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.wild = { n: 0, by: {}, gone: {} };
    var wl = Array.isArray(o.wl) ? o.wl : null;
    if (wl) {
      s.wild.n = int(wl[0], 0, 1e7, 0);
      s.tools.bow = Math.max(0, int(wl[1], 0, C.TOOL_LEVELS.length, 0) - 1);
      (Array.isArray(wl[2]) ? wl[2] : []).forEach(function (n, i) { if (WI.order[i]) s.wild.by[WI.order[i]] = int(n, 0, 1e7, 0); });
      var now = L.nowMin();
      (Array.isArray(wl[3]) ? wl[3] : []).slice(0, 50).forEach(function (g) {
        if (!Array.isArray(g) || !AREAS[g[0]]) return;
        s.wild.gone[AREAS[g[0]] + ':' + int(g[1], 0, 99, 0)] = now - int(g[2], 0, WI.respawn, 0);
      });
    }
    return s;
  };
})(window.Farm = window.Farm || {});
