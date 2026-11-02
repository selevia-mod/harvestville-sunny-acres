// The Town Goal and Best Farm of the Week, the game's side (the server decides: supabase/farm_online_12.sql; on screen:
// 19zc-town.js). Nothing is saved: what you gave, the totals and the prizes all live on the server. What comes back is
// data from outside, so every value is checked here before the game uses it.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var num = function (v, max) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  };

  // This week's goal, or null: nothing usable came back, so nothing shows.
  L.townRead = function (r) {
    if (!r || typeof r !== 'object' || !C.TOWN.words[r.kind] || !(Number(r.target) > 0)) return null;
    return {
      kind: r.kind, target: num(r.target, 1e9), total: num(r.total, 1e9), givers: num(r.givers, 1e6), mine: num(r.mine, 1e6),
      leftToday: num(r.left_today, 1000), min: num(r.min, 1000), gold: num(r.gold, C.TOWN.maxGold), stars: num(r.stars, C.TOWN.maxStars),
      endsIn: num(r.ends_in, 8 * 86400), canGive: r.can_give !== false,
    };
  };

  // What may be given this week: each kind of crop (or ore) in the bag, cheapest first, so the top of the list is what
  // you will miss least.
  L.townItems = function (s, kind) {
    var seen = {}, out = [];
    s.inv.forEach(function (slot) {
      if (!slot || seen[slot.id] || C.ITEMS[slot.id].kind !== kind) return;
      seen[slot.id] = 1;
      out.push({ id: slot.id, n: L.countItem(s, slot.id) });
    });
    return out.sort(function (a, b) { return C.ITEMS[a.id].sell - C.ITEMS[b.id].sell; });
  };
  // How many one tap gives.
  L.townStep = function (town, have) { return Math.min(C.TOWN.give, have, town.leftToday); };

  // The server took n (it may take fewer than asked): those leave the bag. Returns how many left.
  L.townPaid = function (s, id, asked, given) { return L.removeItem(s, id, Math.min(num(given, 1000), asked)); };

  L.bestRead = function (r) {
    if (!r || typeof r !== 'object') return null;
    var w = r.last && typeof r.last === 'object' && typeof r.last.id === 'string' ? r.last : null;
    return {
      last: w ? { id: w.id, name: L.cleanText(w.farm_name, 24) || 'A farm', likes: num(w.likes, 1e6) } : null,
      top: num(r.top, 1e6), mine: num(r.mine, 1e6), gold: num(r.gold, C.TOWN.bestGold), stars: num(r.stars, C.TOWN.bestStars),
    };
  };

  // A claim's answer as [{ gold, stars }]. A week can pay only what a prize is worth, and at most the 4 weeks a claim stays open.
  L.claimRead = function (list, maxGold, maxStars) {
    return (Array.isArray(list) ? list : []).slice(0, 4).map(function (p) {
      return { gold: num(p && p.gold, maxGold), stars: num(p && p.stars, maxStars) };
    }).filter(function (p) { return p.gold || p.stars; });
  };
  L.payClaims = function (s, list) {
    list.forEach(function (p) { s.gold += p.gold; s.stars += p.stars; });
    return list.length;
  };
})(window.Farm = window.Farm || {});
