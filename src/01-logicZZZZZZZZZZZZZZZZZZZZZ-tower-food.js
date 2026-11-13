// The Lost Tower's food, the rules (content 00-zzzzzzzzzzzzzzzzzzzzzzzzz-tower-food.js, C.TOWER_FOOD; the world
// 19zzz...z-tower-food.js; the spec docs/superpowers/specs/2026-11-13-tower-food-design.md). Pure, no Phaser.
// - A Tower dish: s.tfd = { id, until (real minute) }. One at a time (a new one replaces it), beside the farm dish's power
//   (s.dp) and the potions (s.ptn). Its power works only in the Tower (L.towerPower). A full stomach still takes it (-2).
// - Each power halves one trick, never cancels it: the shield (L.towerShieldCrack), the puddle (L.towerWalk), the song
//   (L.towerGap), the flocks (a pierce: L.towerBehind), the healers (L.towerHealPick with `now`), the dark (L.towerSight),
//   the splitters (L.towerSplitHp), the revivers (L.towerReviveMs); and the energy dishes (charges, the refill, a feast).
// - The Baon: the 'baon' item in the bag; what is packed in it, s.tfb (up to 3 food ids). L.baonEat: in the Tower, under
//   15 energy, the first is eaten (as eating it from the bag: its powers too).
// The save: 'tfd' = [dish id, until], 'tfb' = [food ids].
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TF = C.TOWER_FOOD;
  var TR = F.towerTricks;
  if (!TF || !TR || !TR.shield) return;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- the Tower dish ----------
  L.towerFoodOf = function (id) { return TF.dishes[id] || null; };
  L.towerDishLeft = function (s) { var d = s && s.tfd; return d && TF.dishes[d.id] ? Math.max(0, d.until - L.nowMin()) : 0; };
  L.towerDish = function (s) { return L.towerDishLeft(s) > 0 ? s.tfd.id : null; };
  // is a Tower dish's power on: its dish eaten in the last 15 minutes, and you in the Tower
  L.towerPower = function (s, key) {
    var id = s && s.map === 'tower' ? L.towerDish(s) : null;
    return !!id && TF.dishes[id].key === key;
  };
  var eat = L.eat;
  L.eat = function (s, slotIndex) {
    var slot = s.inv[slotIndex], id = slot && slot.id, p = id && TF.dishes[id];
    if (!p) return eat(s, slotIndex);
    var full = s.energy >= L.maxEnergy(s), r;
    if (full) { L.removeAt(s, slotIndex, 1); r = -2; } else r = eat(s, slotIndex);
    if (r > 0 || r === -2) s.tfd = { id: id, until: L.nowMin() + TF.mins };
    return r;
  };

  // ---------- each power halves its trick ----------
  // the shield: a Bow (k none) or Javelin hit with Sinigang na Talangka cracks it; the n-th crack breaks it (the Rifle: at
  // once, as always). 'break' | 'crack' | 'bounce'
  L.towerShieldCrack = function (s, k, n) {
    if (k === TR.shield.breaker) return 'break';
    if (!L.towerPower(s, 'crack') || !(k == null || k === '' || k === 'javelin')) return 'bounce';
    return n >= TF.crack ? 'break' : 'crack';
  };
  // the puddle: 40% slower, 20% with Adobong Pusit
  var walk = L.towerWalk;
  L.towerWalk = function (inPuddle, s) { return inPuddle && L.towerPower(s, 'puddle') ? 1 - TR.burst.slow * TF.soft : walk(inPuddle); };
  // the song: half as long again between shots, a quarter with Ginataang Kuhol
  var gap = L.towerGap;
  L.towerGap = function (g, sung, s) { return sung && L.towerPower(s, 'song') ? Math.round(g * (1 + TR.song.slow * TF.soft)) : gap(g, sung); };
  // a pierce (Pritong Palaka): the enemy right behind the one hit, along the shot from (fx, fy): alive and standing, within
  // 2 tiles past it and near the line; the nearest. null: none.
  L.towerBehind = function (list, a, fx, fy, tile) {
    var dx = a.x - fx, dy = a.y - fy, len = Math.hypot(dx, dy), best = null, bt = Infinity;
    if (len < 1) return null;
    dx /= len;
    dy /= len;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b === a || !(b.hp > 0) || b.lying) continue;
      var t = (b.x - a.x) * dx + (b.y - a.y) * dy, off = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx);
      if (t <= 0 || t > 2 * tile || off > 0.7 * tile) continue;
      if (t < bt) { best = b; bt = t; }
    }
    return best;
  };
  L.towerPierceDamage = function (d) { return d * TF.soft; };
  // the healers: one hit with Nido Soup on (a.tfNoHeal: until when, the world's ms) is not mended until then
  var healPick = L.towerHealPick;
  L.towerHealPick = function (healer, list, tile, now) {
    if (now == null) return healPick(healer, list, tile);
    return healPick(healer, list.filter(function (a) { return !(a.tfNoHeal > now); }), tile);
  };
  // the dark: 2 tiles more with Inihaw na Talaba
  var sight = L.towerSight;
  L.towerSight = function (s) { return sight(s) + (L.towerPower(s, 'sight') ? TF.sight : 0); };
  // the splitters: a copy has half its parent's hits, a quarter with Bicol Express (s: who beat it)
  var splitHp = L.towerSplitHp;
  L.towerSplitHp = function (max, s) { return L.towerPower(s, 'split') ? L.towerHalf(max, TR.split.part * TF.soft) : splitHp(max); };
  // the revivers: they lie twice as long with Halo-halo ng Biringan
  var reviveMs = L.towerReviveMs;
  L.towerReviveMs = function (s) { return reviveMs(s) * (L.towerPower(s, 'revive') ? TF.revive : 1); };
  // On a floor shared with friends the game server runs the healers, the splitters and the revivers (server/lib/tower.js),
  // so a hit tells it the power of the dish you ate (owner, 13 Nov 2026: "Build the server change now"): `pw` in the 'hit'.
  // The other powers change only what your own phone does, and need nothing from the server.
  TF.server = ['noheal', 'split', 'revive'];
  L.towerHitPower = function (s) {
    for (var i = 0; i < TF.server.length; i++) if (L.towerPower(s, TF.server[i])) return TF.server[i];
    return undefined;
  };
  // (the server's side: a state as if its dish had just been eaten, in the Tower; null for any other word)
  L.towerPowerState = function (key) {
    if (TF.server.indexOf(key) < 0) return null;
    for (var id in TF.dishes) if (TF.dishes[id].key === key) return { map: 'tower', tfd: { id: id, until: L.nowMin() + TF.mins } };
    return null;
  };
  // the energy dishes: Sopas ng Tala halves a charge (as the farm's charge dishes do: once, never twice) and refills 3x
  // faster; Lugaw ng Parola refills 3x faster; Balut ng Bakunawa gives back energy for each enemy you beat
  var power = L.power;
  L.power = function (s, key) { return power(s, key) || (key === 'charge' && L.towerPower(s, 'stars')); };
  var regenEvery = L.regenEvery;
  L.regenEvery = function (s) {
    var e = regenEvery(s);
    return L.towerPower(s, 'stars') || L.towerPower(s, 'refill') ? e / TF.refill : e;
  };
  L.towerFeast = function (s) {
    if (!L.towerPower(s, 'feast')) return 0;
    var add = Math.max(0, Math.min(TF.feast, L.maxEnergy(s) - s.energy));
    s.energy += add;
    return add;
  };
  // (a pierce's half hit: the world sets s.tfDmg while it lands, never saved)
  var bowDamage = L.bowDamage;
  L.bowDamage = function (s) { return s && s.tfDmg != null ? s.tfDmg : bowDamage(s); };

  // ---------- the Baon ----------
  var B = TF.baon;
  L.baonOwned = function (s) { return L.countItem(s, 'baon') > 0; };
  L.baonList = function (s) { return s.tfb || (s.tfb = []); };
  L.baonFood = function (id) { return !!C.ITEMS[id] && id !== 'baon' && L.energyOf(id) > 0; };
  // from Mang Ilaw: 'ok' | 'owned' | 'gold' | 'full'
  L.baonBuy = function (s) {
    if (L.baonOwned(s)) return 'owned';
    if ((s.gold || 0) < B.price) return 'gold';
    if (!L.canAdd(s, 'baon', 1)) return 'full';
    s.gold -= B.price;
    L.addItem(s, 'baon', 1);
    return 'ok';
  };
  // one of a bag slot's food into it: 'ok' | 'nobaon' | 'nofood' | 'full'
  L.baonPack = function (s, slotIndex) {
    var slot = s.inv[slotIndex], list = L.baonList(s);
    if (!L.baonOwned(s)) return 'nobaon';
    if (!slot || !L.baonFood(slot.id)) return 'nofood';
    if (list.length >= B.slots) return 'full';
    L.removeAt(s, slotIndex, 1);
    list.push(slot.id);
    return 'ok';
  };
  // the k-th packed back into the bag: 'ok' | 'none' | 'bag'
  L.baonUnpack = function (s, k) {
    var list = L.baonList(s), id = list[k];
    if (!id) return 'none';
    if (!L.canAdd(s, id, 1)) return 'bag';
    L.addItem(s, id, 1);
    list.splice(k, 1);
    return 'ok';
  };
  L.baonDue = function (s) { return s.map === 'tower' && s.energy < B.under && L.baonList(s).length > 0 && L.baonOwned(s); };
  // In the Tower under 15 energy: the first packed food is eaten, as from the bag (its powers too). { id, gain } or null.
  L.baonEat = function (s) {
    if (!L.baonDue(s)) return null;
    var list = L.baonList(s), id = list[0], inv = s.inv, at = inv.length, r;
    inv.push({ id: id, n: 1 }); // (eaten from a slot of its own past the bag, gone again at once)
    try { r = L.eat(s, at); } finally { inv.length = at; }
    if (!(r > 0 || r === -2)) return null;
    list.shift();
    return { id: id, gain: Math.max(0, r) };
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function () {
    var s = newState.apply(this, arguments);
    s.tfd = null;
    s.tfb = [];
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (L.towerDishLeft(s) > 0) o.tfd = [s.tfd.id, s.tfd.until];
    if (s.tfb && s.tfb.length) o.tfb = s.tfb.slice(0, B.slots);
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var d = o && Array.isArray(o.tfd) ? o.tfd : null;
    s.tfd = d && typeof d[0] === 'string' && TF.dishes[d[0]] ? { id: d[0], until: int(d[1], 0, 1e10, 0) } : null;
    s.tfb = (o && Array.isArray(o.tfb) ? o.tfb : []).filter(function (id) { return typeof id === 'string' && L.baonFood(id); }).slice(0, B.slots);
    return s;
  };
})(window.Farm = window.Farm || {});
