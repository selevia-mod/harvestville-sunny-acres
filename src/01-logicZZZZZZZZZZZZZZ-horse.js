// The horse goes out, the rules (farm economy v2, part 5; owner, 11 Nov 2026: docs/farm-economy-v2.md section 6; the
// numbers in C.HORSE_OUT, 00-zzzzzzzzzzzzzzzzzzz-horse.js). Bond opens places: the horse's hearts (its love / 10, on 10
// hearts) say where it can be ridden, and outside the farm and town it needs Horseshoes (caves: the Lantern Bridle too).
// Riding costs no stamina; an enemy's hit while you ride does (C.HORSE_OUT.hitDrain). It comes back by itself like the
// farmer's energy; oats, apples and carrots fill it at once, and it is full again each new day. The save: 'hs' = [love,
// pet, gear bits, stamina, the day it was last fed, its last regen minute]; an older save's 'hs' had only the
// first two (its horse gets at least C.HORSE_OUT.oldHearts hearts once: it could already ride in town).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HORSE_OUT;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- where ----------
  // What kind of place a map is for the horse: 'farm', 'town' (the town and Central Park), 'wild' (Pulag, Makiling,
  // Magayon), 'hunt' (the five hunting places), 'cave' (their caves and the Lair), or null (indoors, the mine: it waits).
  L.horseZone = function (map) {
    if (map === 'farm') return 'farm';
    if (map === 'town' || map === 'park') return 'town';
    if (C.DUNGEONS && C.DUNGEONS[map]) return 'cave';
    var p = C.PLACES && C.PLACES[map];
    if (p && p.map === map) return p.legacy ? 'wild' : 'hunt';
    return null;
  };
  L.horseOut = function (map) { var z = L.horseZone(map); return z === 'wild' || z === 'hunt' || z === 'cave'; };
  // the words for a zone, in a sentence ("Chestnut needs 6 hearts for the Wild Lands")
  L.horseZoneName = function (z) { return { farm: 'the farm', town: 'town', wild: 'the Wild Lands', hunt: 'the hunting places', cave: 'caves' }[z] || 'there'; };

  // ---------- the bond ----------
  L.horseHearts = function (s) { return s.horse ? Math.min(10, Math.floor((s.horse.love || 0) / H.loveHeart)) : 0; };

  // ---------- gear ----------
  var bit = function (id) { return 1 << H.gearOrder.indexOf(id); };
  L.horseHas = function (s, id) { return !!(s.horse && H.gearOrder.indexOf(id) >= 0 && (s.horse.g || 0) & bit(id)); };
  // the Saddlebags' slots (PART 3 wires them into the bag: see C.HORSE_OUT.gear.saddlebags)
  L.horseBagExtra = function (s) { return L.horseHas(s, 'saddlebags') ? H.gear.saddlebags.bag : 0; };
  // Makes a piece at the Stable: 'ok', 'none' (no horse), 'have', 'soon' (its part is not built), 'gold' or 'needs'.
  L.horseMake = function (s, id) {
    var g = H.gear[id];
    if (!s.horse || !g) return 'none';
    if (L.horseHas(s, id)) return 'have';
    if (g.soon) return 'soon';
    if (s.gold < g.gold) return 'gold';
    if (!L.hasNeeds(s, g.needs)) return 'needs';
    s.gold -= g.gold;
    L.takeNeeds(s, g.needs);
    s.horse.g = (s.horse.g || 0) | bit(id);
    return 'ok';
  };

  // ---------- may it go there ----------
  // { ok: true } or { why: 'none' | 'map' | 'hearts' | 'shoes' | 'lantern', need, zone }. Stamina is not asked here: a
  // tired horse still walks with you, it just will not carry you (L.horseTired).
  L.horseMayGo = function (s, map) {
    var z = L.horseZone(map);
    if (!s.horse) return { why: 'none', zone: z };
    if (!z) return { why: 'map', zone: z };
    var need = H.hearts[z] || 0;
    if (L.horseHearts(s) < need) return { why: 'hearts', need: need, zone: z };
    if (L.horseOut(map) && !L.horseHas(s, 'horseshoes')) return { why: 'shoes', zone: z };
    if (z === 'cave' && !L.horseHas(s, 'lantern_bridle')) return { why: 'lantern', zone: z };
    return { ok: true, zone: z };
  };
  L.horseCanRide = function (s, map) {
    var r = L.horseMayGo(s, map);
    if (r.ok && L.horseTired(s)) return { why: 'tired', zone: r.zone };
    return r;
  };
  // why not, in a short line for the player
  L.horseWhy = function (s, r) {
    var n = s.horse ? s.horse.name : 'Your horse', where = L.horseZoneName(r.zone);
    if (r.why === 'hearts') return n + ' needs ' + r.need + ' hearts for ' + where + ' (it has ' + L.horseHearts(s) + '). Pet it and give it Pet Meals.';
    if (r.why === 'shoes') return n + ' needs Horseshoes for ' + where + '. Make them at the Stable.';
    if (r.why === 'lantern') return n + ' needs a Lantern Bridle for caves. Make it at the Stable.';
    if (r.why === 'tired') return n + ' is too tired to carry you. Feed it oats, an apple or a carrot.';
    return n + ' waits outside.';
  };

  // ---------- stamina ----------
  L.horseStamina = function (s) { return s.horse ? (s.horse.st == null ? H.stamina : s.horse.st) : 0; };
  L.horseTired = function (s) { return !!s.horse && L.horseStamina(s) <= 0; };
  // Ridden `tiles` tiles on `map`: riding costs nothing (owner, 18 Nov 2026), so it never tires. Kept for its callers.
  L.horseRide = function () { return 'ok'; };
  // An enemy hit you while you rode: the horse loses C.HORSE_OUT.hitDrain too. Returns 'tired' the moment it runs out.
  L.horseHit = function (s) {
    if (!s.horse) return 'ok';
    var before = L.horseStamina(s);
    if (before >= H.stamina) s.horse.rg = L.nowMin(); // (its regen counts from the hit, as the farmer's energy does)
    s.horse.st = Math.max(0, before - H.hitDrain);
    return before > 0 && s.horse.st <= 0 ? 'tired' : 'ok';
  };
  // Stamina comes back by itself like the farmer's energy (L.regen): a point every C.ENERGY_EVERY real minutes, also while
  // the game is closed, up to full. s.horse.rg: when it last counted (none yet: from now on).
  L.horseRegen = function (s, now) {
    var h = s && s.horse;
    if (!h) return 0;
    if (now == null) now = L.nowMin();
    var st = L.horseStamina(s), every = C.ENERGY_EVERY;
    if (!h.rg || h.rg > now || st >= H.stamina) { h.rg = now; return 0; }
    var n = Math.floor((now - h.rg) / every);
    if (n <= 0) return 0;
    var add = Math.min(n, H.stamina - st);
    h.st = st + add;
    if (h.st >= H.stamina) delete h.st;
    h.rg = L.horseStamina(s) >= H.stamina ? now : h.rg + n * every;
    return add;
  };
  var regen = L.regen;
  L.regen = function (s, now) { var r = regen.apply(this, arguments); L.horseRegen(s, now); return r; };
  L.horseFood = function (id) { return H.food[id] || 0; };
  // Feeds it what is in bag slot `slot`: 'ok', 'none', 'food' (not horse food) or 'full'. +stamina; the first feed of a
  // day is also a little love.
  L.horseFeed = function (s, slot) {
    var it = s.inv[slot], v = it ? L.horseFood(it.id) : 0;
    if (!s.horse) return 'none';
    if (!v) return 'food';
    if (L.horseStamina(s) >= H.stamina) return 'full';
    L.removeAt(s, slot, 1);
    s.horse.st = Math.min(H.stamina, L.horseStamina(s) + v);
    if (s.horse.fd !== s.day) {
      s.horse.fd = s.day;
      s.horse.love = Math.min(C.LOVE.max, (s.horse.love || 0) + H.feedLove);
    }
    return 'ok';
  };

  // ---------- a big monster's hit in a cave ----------
  // Does this hit knock you off? Only in a cave, only a big one (a guard or boss, or a hard hitter), on a roll < the odds.
  L.horseKnocks = function (map, def, roll) {
    if (L.horseZone(map) !== 'cave' || !def) return false;
    var big = !!def.boss || (def.hit || 0) >= H.knockHit;
    return big && roll < H.knockOdds;
  };

  // ---------- the day and the save ----------
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    if (s.horse) delete s.horse.st; // rested in its stable overnight: full (decided by me, owner can change)
    return r;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.horse && Array.isArray(o.hs)) o.hs = [o.hs[0], o.hs[1], s.horse.g || 0, Math.round(L.horseStamina(s) * 10) / 10, s.horse.fd || 0, s.horse.rg || 0];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s || !s.horse || !o || !Array.isArray(o.hs)) return s;
    if (o.hs.length < 3) { // from before this update: it could already ride in town
      s.horse.love = Math.max(s.horse.love, H.oldHearts * H.loveHeart);
      return s;
    }
    // (only what differs from a new horse is kept on it: full stamina, no gear, never fed are left out)
    var g = int(o.hs[2], 0, (1 << H.gearOrder.length) - 1, 0), st = Number(o.hs[3]), fd = int(o.hs[4], 0, 1e7, 0), rg = int(o.hs[5], 0, 1e9, 0);
    if (g) s.horse.g = g;
    if (isFinite(st) && st < H.stamina) s.horse.st = Math.max(0, st);
    if (fd) s.horse.fd = fd;
    if (rg) s.horse.rg = rg; // (a save from before: its stamina comes back from the first count after loading)
    return s;
  };
})(window.Farm = window.Farm || {});
