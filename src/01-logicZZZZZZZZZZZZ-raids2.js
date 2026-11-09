// Farm Raids step 2: real raids between players (owner, 9 Nov 2026; docs/raids-step2.md, supabase/farm_online_25.sql).
// The rules both sides use: the phone (the battle, the defender's loss) and our game server (server/lib/fraid.js
// replays the battle with these and L.frReplay, so a phone can't claim what it did not take).
//   L.frCopyValue(farm)        what is out in the open on a farm's raid copy, in Gold (R.lootValue)
//   L.frRealFarm(copy, cap, seed, cut)  the battle's farm (crops ripe by cut): the copy with only its share of the loot (cap, by power): that share
//                              of the ripe crops (picked by the seed) and of the eggs and milk, the stall and the Gold pot
//   L.frArmyOk(army)           an army a Raid Camp could hold (the biggest camp's room, levels 1-5)
//   L.frTaken(b)               what a battle took: { w, items: [[kind, x, y, n]], crops, produce, stall, gold, value }
//   L.frLoss(s, taken, w)      the defender's farm loses it (what is still there: a crop since picked is not lost twice)
//   L.frWin(s, prize, points)  the attacker's prize from the server
//   L.frStallLoot(s), L.frGoldPot(s), L.frProduceLoot(s)   what a farm has out in the open, for its copy
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;

  L.frCopyValue = function (farm) {
    var v = R.lootValue;
    return Math.round(((farm && farm.loot) || []).reduce(function (sum, p) { return sum + (p.n || 0) * (v[p.kind] || 1); }, 0));
  };

  // cut (ms, the server's clock): a growing crop counts only if it is ripe by then (its 'at'); no cut: only the ripe ones
  L.frRealFarm = function (copy, cap, seed, cut) {
    var share = Math.max(0, Math.min(1, Number(cap) || 0)), rnd = L.frRand((seed >>> 0) ^ 0x5bd1e995);
    var crops = [], other = [];
    (copy.loot || []).forEach(function (p) {
      if (p.kind !== 'crops') return other.push(p);
      if (p.at == null || (cut != null && p.at <= cut)) crops.push(p);
    });
    // that share of the crop tiles, picked by the seed (the same on the phone and the server)
    var order = crops.map(function (p, i) { return { p: p, k: rnd(), i: i }; }).sort(function (a, b) { return a.k - b.k || a.i - b.i; });
    var keep = Math.ceil(crops.length * share);
    var loot = order.slice(0, keep).sort(function (a, b) { return a.i - b.i; }).map(function (o) { return { kind: 'crops', x: o.p.x, y: o.p.y, n: o.p.n || 1 }; });
    other.forEach(function (p) { var n = Math.ceil((p.n || 0) * share); if (n > 0) loot.push({ kind: p.kind, x: p.x, y: p.y, n: n }); });
    var farm = { w: copy.w, h: copy.h, solid: copy.solid, defs: (copy.defs || []).map(function (d) { return { t: d.t, x: d.x, y: d.y, lv: Math.max(1, Math.min(5, d.lv || 1)), strong: !!d.strong }; }),
      loot: loot, name: copy.name || '' };
    farm.drop = copy.drop && copy.drop.length === copy.w * copy.h ? copy.drop : L.frDropCells(farm);
    return farm;
  };

  L.frArmyOk = function (army) {
    if (!army || typeof army !== 'object') return false;
    var most = R.camp.levels[R.camp.levels.length - 1].space, used = 0, ok = true;
    Object.keys(army).forEach(function (k) {
      var a = army[k], d = R.raiders[k];
      if (!d || !a || !(a.n >= 0) || a.n !== Math.floor(a.n) || !(a.lv >= 1 && a.lv <= R.level.mult.length)) { ok = false; return; }
      used += a.n * d.space;
    });
    return ok && used <= most;
  };

  L.frTaken = function (b) {
    var v = R.lootValue, out = { w: b.farm.w, items: [], crops: 0, produce: 0, stall: 0, gold: 0, value: 0 };
    b.loot.forEach(function (p) {
      var n = Math.round(p.n - Math.max(0, p.left));
      if (n <= 0) return;
      out.items.push([p.kind, Math.floor(p.x), Math.floor(p.y), n]);
      out[p.kind] = (out[p.kind] || 0) + n;
      out.value += n * (v[p.kind] || 1);
    });
    out.value = Math.round(out.value);
    return out;
  };

  // ---------- what a farm has out in the open (for its copy) ----------
  L.frStallLoot = function (s) { return (s.shelves || []).reduce(function (sum, e) { return sum + (e && !e.coins && e.n > 0 ? e.n : 0); }, 0); };
  L.frGoldPot = function (s) { return L.standCoins ? L.standCoins(s) : 0; }; // the coins waiting at the stall
  L.frProduceLoot = function (s) { return (s.animals || []).reduce(function (sum, a) { return sum + (!a.young && a.ready ? a.ready : 0); }, 0); };

  // ---------- the defender's loss ----------
  // { crops, produce, stall, gold }: what was really lost (the farm may have changed since its copy)
  L.frLoss = function (s, taken, w) {
    var lost = { crops: 0, produce: 0, stall: 0, gold: 0 }, width = (taken && taken.w) || w;
    ((taken && taken.items) || []).forEach(function (it) {
      var kind = it[0], x = it[1], y = it[2], n = it[3];
      if (kind === 'crops') {
        var t = s.soil && s.soil[y * width + x];
        if (!t || !t.c || !L.isRipe(t)) return;
        var crop = C.CROPS[t.c];
        t.w = 0;
        if (crop && crop.regrow) { t.p = L.nowMin(); t.r = 1; } else { t.c = null; t.p = 0; t.r = 0; delete t.h; }
        lost.crops++;
      } else if (kind === 'produce') {
        (s.animals || []).forEach(function (a) { if (n > 0 && !a.young && a.ready) { var k = Math.min(n, a.ready); a.ready -= k; n -= k; lost.produce += k; } });
      } else if (kind === 'stall') {
        (s.shelves || []).forEach(function (e, i) {
          if (n <= 0 || !e || e.coins || !(e.n > 0)) return;
          var k = Math.min(n, e.n);
          e.n -= k; n -= k; lost.stall += k;
          if (e.n <= 0) s.shelves[i] = null;
        });
      } else if (kind === 'gold') {
        (s.shelves || []).forEach(function (e, i) {
          if (n <= 0 || !e || !e.coins) return;
          var k = Math.min(n, e.coins);
          e.coins -= k; n -= k; lost.gold += k;
          if (e.coins <= 0) s.shelves[i] = null; // (a sold shelf with nothing left to collect is empty, as after collecting)
        });
      }
    });
    return lost;
  };

  // ---------- the attacker's prize ----------
  L.frWin = function (s, prize, points) {
    var r = L.frState(s);
    s.gold += Math.max(0, Math.floor(prize) || 0);
    r.pts += Math.max(0, Math.floor(points) || 0);
  };
})(window.Farm = window.Farm || {});
