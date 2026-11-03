// Bakunawa's Lair, the rules (content 00-zzzzzzlair.js; the cave 19zt-lair.js). What each floor holds, the deepest floor
// you reached and the lift's stops, the Bakunawa once a day, the Magma Bow and the Fire Charm. Saved: s.lair = { deep,
// bk (the day the Bakunawa was last hunted) } as 'lr', the Magma Bow as 'mb' (the bow's level past Gold).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var LA = C.LAIR;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  C.TIPS.push({ key: 'lair_tour', text: "BAKUNAWA'S LAIR" });

  // ---------- floors ----------
  L.lairBossFloor = function (floor) { return floor % LA.bossEvery === 0; };
  // A floor's creatures, in a fixed order: [{ slot, kind }]. The same floor holds the same ones every visit.
  L.lairRoster = function (floor) {
    floor = int(floor, 1, LA.floors, 1);
    var out = [], add = function (kind) { out.push({ slot: out.length, kind: kind }); };
    if (floor === LA.bakunawaFloor) { add('bakunawa'); add('tikbalang'); add('tikbalang'); return out; }
    var n = Math.min(LA.count.max, LA.count.base + Math.floor(floor / LA.count.per));
    if (L.lairBossFloor(floor)) { add('bungisngis'); n = 2; }
    var pool = floor < 5 ? ['santelmo'] : floor < 20 ? ['santelmo', 'sigbin'] : ['santelmo', 'sigbin', 'tikbalang'];
    for (var i = 0; i < n; i++) add(pool[Math.floor(L.rand(20261104, floor, i) * pool.length)]);
    return out;
  };
  // How tough one is on that floor (the guards grow with the floor).
  L.lairHp = function (kind, floor) {
    var def = WI.animals[kind];
    return def.boss && !def.great ? Math.round(def.hp + floor * LA.bossHpPer) : def.hp;
  };
  // The Bakunawa rises once a day for each hunter.
  L.bakunawaReady = function (s) { return !s.lair || s.lair.bk !== s.day; };
  L.bakunawaHunted = function (s) { s.lair = s.lair || { deep: 0, bk: -1 }; s.lair.bk = s.day; };

  // Reached a floor: the deepest so far (true when it is a new deepest).
  L.lairReach = function (s, floor) {
    s.lair = s.lair || { deep: 0, bk: -1 };
    floor = int(floor, 1, LA.floors, 1);
    if (floor <= s.lair.deep) return false;
    s.lair.deep = floor;
    return true;
  };
  L.lairStops = function (s) {
    var deep = Math.max(1, (s.lair && s.lair.deep) || 1), out = [];
    for (var f = 1; f <= deep; f += LA.liftEvery) out.push(f);
    return out;
  };

  // A hunt in the Lair leaves no slot waiting (the floor is the floor): the Wild Lands' timers stay for the Wild Lands.
  var hunted = L.hunted;
  L.hunted = function (s, area, slot, kind, size) {
    var r = hunted(s, area, slot, kind, size);
    if (area === 'lair') delete s.wild.gone['lair:' + slot];
    return r;
  };

  // ---------- the Magma Bow ----------
  L.hasMagmaBow = function (s) { return L.bowLevel(s) >= C.MAGMA_BOW.level; };
  // 'ok' | 'have' | 'nobow' | 'gold-bow' (a Gold Bow first) | 'gold' | 'short' (the Lair's goods)
  L.makeMagmaBow = function (s) {
    var m = C.MAGMA_BOW;
    if (L.hasMagmaBow(s)) return 'have';
    if (!L.hasBow(s)) return 'nobow';
    if (L.bowLevel(s) < m.level - 1) return 'gold-bow';
    if (s.gold < m.gold) return 'gold';
    if (m.needs.some(function (n) { return L.countItem(s, n[0]) < n[1]; })) return 'short';
    s.gold -= m.gold;
    m.needs.forEach(function (n) { L.removeItem(s, n[0], n[1]); });
    s.tools.bow = m.level;
    return 'ok';
  };
  // its name and icon (C.TOOL_LEVELS stops at Gold: the other tools do not go past it)
  var itemName = L.itemName;
  L.itemName = function (s, id) { return id === 'bow' && L.hasMagmaBow(s) ? C.MAGMA_BOW.name : itemName(s, id); };
  var iconOf = L.iconOf;
  L.iconOf = function (s, id) { return id === 'bow' && L.hasMagmaBow(s) ? C.ICON.bow_4 : iconOf(s, id); };

  // ---------- the Fire Charm (Hunter's gear with goods to bring) ----------
  var buyGear = L.buyGear;
  L.buyGear = function (s, key) {
    var g = C.GEAR[L.gearIndex(key)];
    if (g && g.needs && !L.hasGear(s, key) && s.gold >= g.gold && g.needs.some(function (n) { return L.countItem(s, n[0]) < n[1]; })) return 'short';
    var r = buyGear(s, key);
    if (r === 'ok' && g.needs) g.needs.forEach(function (n) { L.removeItem(s, n[0], n[1]); });
    return r;
  };
  // the energy a charge costs you (hit: the animal's), with the Fire Charm
  L.chargeLoss = function (s, hit) {
    var lost = Math.ceil((hit || 0) / (L.power(s, 'charge') ? 2 : 1));
    return L.hasGear(s, 'charm') ? Math.ceil(lost * C.GEAR_RULES.charm) : lost;
  };

  // ---------- save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.lair = { deep: 0, bk: -1 };
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.lair && (s.lair.deep || s.lair.bk >= 0)) o.lr = [s.lair.deep, s.lair.bk];
    if (L.hasMagmaBow(s)) o.mb = 1;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var lr = Array.isArray(o.lr) ? o.lr : [];
    s.lair = { deep: int(lr[0], 0, LA.floors, 0), bk: int(lr[1], -1, 1e7, -1) };
    if (o.mb && L.hasBow(s) && L.bowLevel(s) === C.MAGMA_BOW.level - 1) s.tools.bow = C.MAGMA_BOW.level; // (saved as Gold by 'wl')
    return s;
  };
})(window.Farm = window.Farm || {});
