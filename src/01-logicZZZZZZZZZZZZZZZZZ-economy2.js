// Farm economy v2, parts 2, 3 and 4, the rules (content in 00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js; docs/farm-economy-v2.md).
//  - Only planted farm crops count (L.isFarmCrop): the hunting places' drops (Wild Bananas, Heirloom Rice) never do.
//  - The Silo (s.silo): room for crops. Workshops (the Mixer too) and the Kitchen use what is in it as if it were in the
//    bag, the Silo first; the Raid Camp's training and levels take their crops from it first, then the bag.
//  - Raids pay in crops: the ripe crops a battle took (from the battle copy, where they grew) come home into the Silo
//    (then the bag). A real raid's crops wait in s.frc until the game server counts the raid; a practice raid's come at
//    once, instead of their worth in Gold (what will not fit is paid in Gold, as before). The farm raided loses nothing.
//  - Materials on the Raid Camp's and the defenses' levels (C.FRAID); the Saddlebags give the bag 12 more slots.
//  - Potions: each its own 10-minute clock (s.ptn), beside a dish's power; L.power says yes for them too. Shots in the
//    five new hunting places cost C.SHOT_ENERGY (Hunter's Coffee: nothing).
// The save: 'sl' = [silo level, crop number, n, ...], 'ptn' = [the potions' end minutes, by C.POTION_KEYS],
// 'frc' = [[raid id, [crop number, n, ...]], ...] (crop numbers: C.CROP_KEYS).
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, R = C.FRAID, S = C.SILO, WI = C.WILD, H = C.HORSE_OUT;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- farm crops ----------
  var CROP_OF = {}; // a farm crop's item -> its crop's number (C.CROP_KEYS)
  C.CROP_KEYS.forEach(function (k, i) { var id = C.CROPS[k] && C.CROPS[k].item; if (C.ITEMS[id] && C.ITEMS[id].kind === 'crop' && CROP_OF[id] == null) CROP_OF[id] = i; });
  L.isFarmCrop = function (id) { return CROP_OF[id] != null; };
  var itemOf = function (n) { var k = C.CROP_KEYS[n]; return k && C.CROPS[k] ? C.CROPS[k].item : null; };

  // ---------- the Silo ----------
  L.silo = function (s) { if (!s.silo) s.silo = { lv: 0, c: {} }; return s.silo; };
  L.siloCap = function (s) { return S.levels[L.silo(s).lv].cap; };
  L.siloCount = function (s) { var c = L.silo(s).c; return Object.keys(c).reduce(function (n, k) { return n + c[k]; }, 0); };
  L.siloHas = function (s, id) { return (s && s.silo && s.silo.c[id]) || 0; };
  // puts up to n of a farm crop in; how many did NOT fit
  L.siloPut = function (s, id, n) {
    if (!L.isFarmCrop(id) || !(n > 0)) return n || 0;
    var k = Math.min(n, L.siloCap(s) - L.siloCount(s));
    if (k > 0) L.silo(s).c[id] = (L.silo(s).c[id] || 0) + k;
    return n - Math.max(0, k);
  };
  // takes up to n out; how many it took
  L.siloTake = function (s, id, n) {
    var c = L.silo(s).c, k = Math.max(0, Math.min(n, c[id] || 0));
    if (k) { c[id] -= k; if (!c[id]) delete c[id]; }
    return k;
  };
  // a farm crop in the Silo and the bag; taking: the Silo first, then the bag
  L.cropHave = function (s, id) { return L.siloHas(s, id) + L.countItem(s, id); };
  L.cropTake = function (s, id, n) { var k = L.siloTake(s, id, n); return k + (n > k ? L.removeItem(s, id, n - k) : 0); };
  // every farm crop in the bag (of plain quality: a Silver or Gold one keeps its star in the bag) into the Silo, while
  // there is room; how many went in
  L.siloStore = function (s) {
    var moved = 0;
    s.inv.forEach(function (slot, i) {
      if (!slot || slot.q || !L.isFarmCrop(slot.id)) return;
      var k = slot.n - L.siloPut(s, slot.id, slot.n);
      if (k > 0) { L.removeAt(s, i, k); moved += k; }
    });
    return moved;
  };
  // up to n of a crop out into the bag (as much as fits); how many came out
  L.siloOut = function (s, id, n) {
    var k = Math.min(n, L.siloHas(s, id));
    if (!(k > 0)) return 0;
    var left = L.addItem(s, id, k);
    L.siloTake(s, id, k - left);
    return k - left;
  };
  L.siloNext = function (s) { return S.levels[L.silo(s).lv + 1] || null; };
  // a bigger Silo: 'ok' | 'top' | 'gold' | 'lumber' | 'cement'
  L.siloUp = function (s) {
    var next = L.siloNext(s);
    if (!next) return 'top';
    if (s.gold < next.gold) return 'gold';
    if ((s.lumber || 0) < next.lumber) return 'lumber';
    if (L.countItem(s, 'farm_cement') < next.cement) return 'cement';
    s.gold -= next.gold;
    s.lumber -= next.lumber;
    L.removeItem(s, 'farm_cement', next.cement);
    L.silo(s).lv++;
    return 'ok';
  };
  // every farm has its Silo: placed once where it fits (C.SILO.at, or the nearest free spot), else in storage. Your own
  // farm only (the world calls it as the farm opens); one already owned (placed or stored) is kept as it is.
  L.giveSilo = function (s, farm) {
    var t = C.OUTDOOR.index.silo;
    if (!s || !s.yard || s.isVisit || L.yardOwned(s, t)) return false;
    var spot = { x: S.at[0], y: S.at[1] };
    if (farm && L.yardCantPlace(s, farm, t, spot.x, spot.y, null)) spot = L.yardFindSpot(s, farm, t, spot.x, spot.y);
    if (spot) s.yard.items.push({ t: t, x: spot.x, y: spot.y });
    else s.yard.bag[t] = (s.yard.bag[t] || 0) + 1;
    return true;
  };

  // ---------- workshops and the Kitchen use the Silo too ----------
  // While one of them runs, a farm crop counts what is in the Silo as well, and is taken from the Silo first.
  var fromSilo = 0;
  var countItem = L.countItem;
  L.countItem = function (s, id) { var n = countItem(s, id); return fromSilo && s && s.silo && CROP_OF[id] != null ? n + (s.silo.c[id] || 0) : n; };
  var removeItem = L.removeItem;
  L.removeItem = function (s, id, n) {
    if (!fromSilo || CROP_OF[id] == null || !s || !s.silo) return removeItem(s, id, n);
    var k = L.siloTake(s, id, n);
    return k + (n > k ? removeItem(s, id, n - k) : 0);
  };
  var silo = function (fn) { return function () { fromSilo++; try { return fn.apply(this, arguments); } finally { fromSilo--; } }; };
  L.countNeed = silo(L.countNeed);
  L.canMake = silo(L.canMake);
  L.startJob = silo(L.startJob);
  L.hasIngredients = silo(L.hasIngredients);
  var cook = silo(L.cook);
  // (the dish needs its room first: ingredients from the Silo free no slot in the bag)
  L.cook = function (s, recipe) { if (recipe && C.ITEMS[recipe.dish] && !L.canAdd(s, recipe.dish, 1) && s.builds.kitchen && L.hasIngredients(s, recipe)) return 'full'; return cook(s, recipe); };

  // ---------- raiders eat crops ----------
  // train one: also 'crops' (not enough of its food)
  var trainRaider = L.trainRaider;
  L.trainRaider = function (s, k, now) {
    var d = R.raiders[k], need = d && d.crop;
    if (need && L.raiderOpen(s, k) && L.armySpace(s) + d.space <= L.campSpace(s) && s.gold >= d.gold && L.cropHave(s, need[0]) < need[1]) return 'crops';
    var r = trainRaider(s, k, now);
    if (r === 'ok' && need) L.cropTake(s, need[0], need[1]);
    return r;
  };
  // a level-up's crops: [food, n] or null
  L.raiderUpCrops = function (s, k) {
    var d = R.raiders[k], lv = L.raiderLv(s, k), n = (R.level.crops || [])[lv];
    return d && d.crop && n ? [d.crop[0], n] : null;
  };
  var raiderUp = L.raiderUp;
  L.raiderUp = function (s, k) {
    var lv = L.raiderLv(s, k), need = R.level.need[lv], food = L.raiderUpCrops(s, k);
    if (food && L.raiderOpen(s, k) && lv < R.level.mult.length && s.gold >= R.level.gold[lv] && !(need && L.countItem(s, need[0]) < need[1]) &&
      L.cropHave(s, food[0]) < food[1]) return 'crops';
    var r = raiderUp(s, k);
    if (r === 'ok' && food) L.cropTake(s, food[0], food[1]);
    return r;
  };

  // ---------- materials on the levels ----------
  // the camp's next level: also 'cement' | 'rope'
  var campUpgrade = L.campUpgrade;
  L.campUpgrade = function (s, now) {
    var r = L.frState(s);
    L.campDone(s, now == null ? L.clock() : now);
    var next = R.camp.levels[r.camp];
    if (r.camp && next && !r.up && s.gold >= next.gold && (s.lumber || 0) >= (next.lumber || 0) && (s.stone || 0) >= (next.stone || 0) &&
      !(next.need && L.countItem(s, next.need[0]) < next.need[1])) {
      if (L.countItem(s, 'farm_cement') < (next.cement || 0)) return 'cement';
      if (L.countItem(s, 'rope') < (next.rope || 0)) return 'rope';
    }
    var res = campUpgrade(s, now);
    if (res === 'ok' && next && r.camp) { L.removeItem(s, 'farm_cement', next.cement || 0); L.removeItem(s, 'rope', next.rope || 0); }
    return res;
  };
  // a defense's next level's material: [item, n] or null
  L.defenseMats = function (s, k) {
    var id = R.defMats[k], n = R.defLevel.mats[L.defenseLv(s, k)];
    return id && n ? [id, n] : null;
  };
  var defenseUp = L.defenseUp;
  L.defenseUp = function (s, k) {
    var m = L.defenseMats(s, k), lv = L.defenseLv(s, k);
    if (m && R.defenses[k] && lv < R.level.mult.length && s.gold >= R.defLevel.gold[lv] && L.countItem(s, m[0]) < m[1]) return 'mats';
    var r = defenseUp(s, k);
    if (r === 'ok' && m) L.removeItem(s, m[0], m[1]);
    return r;
  };

  // ---------- raids pay in crops ----------
  // A farm's raid copy says which crop each of its ripe crops is (copy.ck: a letter a crop, in the order of its loot's
  // crops; '.' unknown): the copy is what the battle is fought on, the farm's look (the visit) may be older or newer.
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  L.frCropCode = function (loot, soil, w) {
    return (loot || []).filter(function (p) { return p.kind === 'crops'; }).map(function (p) {
      var t = soil && soil[p.y * w + p.x], i = t && t.c ? C.CROP_KEYS.indexOf(t.c) : -1;
      return i >= 0 && i < ABC.length ? ABC.charAt(i) : '.';
    }).join('');
  };
  // The crops a battle took, by item: { id: n }. taken: L.frTaken(b) (or the server's own); copy: the battle copy (its
  // ck), else st: the farm it was fought on (its soil). A tile whose crop is not known counts as the crop seen most; a
  // crop that is not a farm crop (grass) is not counted. (st's soil is this app's width, as every state here: taken.w is the
  // width of the phone that made the copy, 64 on an older app; its x and y are tiles, the same on both)
  L.frCropsOf = function (st, taken, copy) {
    var got = {}, unknown = 0, w = C.FARM_W, at = {}, k = 0, ck = copy && typeof copy.ck === 'string' ? copy.ck : '';
    ((copy && copy.loot) || []).forEach(function (p) { if (p.kind === 'crops') { var i = ABC.indexOf(ck.charAt(k++)); if (i >= 0 && C.CROP_KEYS[i]) at[p.x + ',' + p.y] = C.CROP_KEYS[i]; } });
    ((taken && taken.items) || []).forEach(function (it) {
      if (it[0] !== 'crops') return;
      var t = st && st.soil && st.soil[it[2] * w + it[1]], crop = C.CROPS[at[it[1] + ',' + it[2]] || (t && t.c)], id = crop && crop.item;
      if (!crop) { unknown += it[3]; return; }
      if (L.isFarmCrop(id)) got[id] = (got[id] || 0) + it[3];
    });
    var most = Object.keys(got).sort(function (a, b) { return got[b] - got[a]; })[0];
    if (unknown && most) got[most] += unknown;
    return got;
  };
  var total = function (got) { return Object.keys(got || {}).reduce(function (n, k) { return n + got[k]; }, 0); };
  // into the Silo, then the bag: { n: brought home, silo, bag, lost: did not fit }
  L.frCropsHome = function (s, got) {
    var out = { n: 0, silo: 0, bag: 0, lost: 0 };
    Object.keys(got || {}).forEach(function (id) {
      var n = Math.max(0, got[id] | 0), left = L.siloPut(s, id, n);
      out.silo += n - left;
      var off = left ? L.addItem(s, id, left) : 0;
      out.bag += left - off;
      out.lost += off;
    });
    out.n = out.silo + out.bag;
    return out;
  };
  // a real raid's crops wait for the game server (the last 5 raids)
  L.frCropsKeep = function (s, raid, got) {
    if (!raid || !total(got)) return;
    s.frc = s.frc || {};
    s.frc[raid] = got;
    var ids = Object.keys(s.frc);
    while (ids.length > 5) delete s.frc[ids.shift()];
  };
  // the server counted it: its crops come home (no more than the crops the server says were taken); null if none waited
  L.frCropsClaim = function (s, raid, taken) {
    var got = s.frc && s.frc[raid];
    if (!got) return null;
    delete s.frc[raid];
    var most = taken && taken.crops != null ? Math.max(0, taken.crops | 0) : Infinity;
    Object.keys(got).forEach(function (id) { var k = Math.min(got[id], most); got[id] = k; most -= k; });
    return L.frCropsHome(s, got);
  };
  // practice: b.cropsWon (set by the world) come home instead of their worth in Gold; what does not fit is still Gold
  var banditPrize = L.banditPrize;
  L.banditPrize = function (s, key, b) {
    var p = banditPrize(s, key, b), got = b && b.cropsWon;
    if (!got) return p;
    var v = R.lootValue.crops, worth = Math.round((b.taken.crops || 0) * v), home = L.frCropsHome(s, got), d = Math.max(-p.gold, Math.round(home.lost * v) - worth);
    s.gold += d;
    p.gold += d;
    p.crops = home.n;
    return p;
  };

  // ---------- the Saddlebags: 12 more slots in the bag ----------
  var loading = 0; // (a save being loaded with them on: its bag is sized before the horse is read)
  var extra = function (s) { return loading || L.horseBagExtra(s); };
  L.bagLevel = function (s) { return Math.max(0, C.BAG_SIZES.indexOf(s.inv.length - extra(s))); };
  var resizeBag = L.resizeBag;
  L.resizeBag = function (s, level) {
    resizeBag(s, level);
    var size = (C.BAG_SIZES[level] || C.INV_SIZE) + extra(s);
    while (s.inv.length < size) s.inv.push(null);
  };
  var nextBag = L.nextBag;
  L.nextBag = function (s) { var b = nextBag(s); if (b) b.size += extra(s); return b; };
  var horseMake = L.horseMake;
  L.horseMake = function (s, id) {
    var r = horseMake(s, id);
    if (r === 'ok' && id === 'saddlebags') for (var i = 0; i < H.gear.saddlebags.bag; i++) s.inv.push(null);
    return r;
  };

  // ---------- potions ----------
  // a potion's minutes (Hunter's Coffee: 5)
  L.potionMins = function (key) { return (C.POTION_MINS_OF && C.POTION_MINS_OF[key]) || C.POTION_MINS; };
  L.potionLeft = function (s, key) { var p = s && s.ptn; return p && p[key] ? Math.max(0, p[key] - L.nowMin()) : 0; };
  var power = L.power;
  L.power = function (s, key) { return power(s, key) || L.potionLeft(s, key) > 0; };
  // drinking one: its energy (as eating) and its power for its minutes (L.potionMins: a new one resets them, it does not
  // add); with full energy it is drunk for the power alone (-2)
  var eat = L.eat;
  L.eat = function (s, slotIndex) {
    var slot = s.inv[slotIndex], p = slot && C.POTIONS[slot.id];
    if (!p) return eat(s, slotIndex);
    var full = s.energy >= L.maxEnergy(s), r = full ? -2 : eat(s, slotIndex);
    if (full) L.removeAt(s, slotIndex, 1);
    s.ptn = s.ptn || {};
    s.ptn[p.key] = L.nowMin() + L.potionMins(p.key);
    return r;
  };

  // ---------- a shot's energy ----------
  L.shotEnergy = function (s, base) {
    if (L.power(s, 'shots')) return 0;
    var place = s && L.placeOf ? L.placeOf(s.map) : null;
    return place && C.SHOT_ENERGY[place] != null ? C.SHOT_ENERGY[place] : base;
  };
  var shoot = L.shoot;
  L.shoot = function (s) {
    var keep = WI.shotEnergy;
    WI.shotEnergy = L.shotEnergy(s, keep);
    try { return shoot.apply(this, arguments); } finally { WI.shotEnergy = keep; }
  };
  if (L.fireWeapon) {
    var fire = L.fireWeapon;
    L.fireWeapon = function (s) {
      var keep = C.WEAPON_ENERGY;
      C.WEAPON_ENERGY = L.shotEnergy(s, keep);
      try { return fire.apply(this, arguments); } finally { C.WEAPON_ENERGY = keep; }
    };
  }

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function () {
    var s = newState.apply(this, arguments);
    s.silo = { lv: 0, c: {} };
    s.ptn = {};
    s.frc = {};
    return s;
  };
  var pairs = function (map) { var out = []; Object.keys(map || {}).forEach(function (id) { if (CROP_OF[id] != null && map[id] > 0) out.push(CROP_OF[id], map[id]); }); return out; };
  var unpair = function (a, most) {
    var out = {};
    for (var i = 0; Array.isArray(a) && i + 1 < a.length; i += 2) {
      var id = itemOf(int(a[i], -1, 9999, -1)), n = int(a[i + 1], 0, most, 0);
      if (id && L.isFarmCrop(id) && n > 0) out[id] = Math.min(most, (out[id] || 0) + n);
    }
    return out;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), sl = s.silo;
    if (sl && (sl.lv || Object.keys(sl.c).length)) o.sl = [sl.lv].concat(pairs(sl.c));
    var now = L.nowMin(), p = s.ptn || {};
    if (C.POTION_KEYS.some(function (k) { return p[k] > now; })) o.ptn = C.POTION_KEYS.map(function (k) { return p[k] > now ? p[k] : 0; });
    var fr = Object.keys(s.frc || {}).slice(-5).map(function (id) { return [id, pairs(s.frc[id])]; });
    if (fr.length) o.frc = fr;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    // (the Saddlebags' slots: the bag is sized before the horse is read)
    var hs = o && Array.isArray(o.hs) ? o.hs : null, bit = 1 << H.gearOrder.indexOf('saddlebags');
    loading = hs && hs.length >= 3 && (int(hs[2], 0, 1e6, 0) & bit) ? H.gear.saddlebags.bag : 0;
    var s;
    try { s = deserialize(o); } finally { loading = 0; }
    if (!s) return s;
    var sl = Array.isArray(o.sl) ? o.sl : [];
    s.silo = { lv: int(sl[0], 0, S.levels.length - 1, 0), c: {} };
    var c = unpair(sl.slice(1), S.levels[s.silo.lv].cap), room = S.levels[s.silo.lv].cap;
    Object.keys(c).forEach(function (id) { var k = Math.min(c[id], room); if (k > 0) { s.silo.c[id] = k; room -= k; } });
    s.ptn = {};
    if (Array.isArray(o.ptn)) C.POTION_KEYS.forEach(function (k, i) { var v = int(o.ptn[i], 0, 1e10, 0); if (v) s.ptn[k] = v; });
    s.frc = {};
    (Array.isArray(o.frc) ? o.frc : []).slice(-5).forEach(function (e) {
      if (Array.isArray(e) && typeof e[0] === 'string' && /^[0-9a-z-]{1,64}$/i.test(e[0])) { var got = unpair(e[1], 9999); if (total(got)) s.frc[e[0]] = got; }
    });
    return s;
  };
})(window.Farm = window.Farm || {});
