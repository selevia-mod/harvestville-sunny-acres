// Gear stars (owner, 7 Nov 2026: "next update", after e30): a place's gear piece goes up to 3 stars at Kanor's (his
// Make tab), each star 1 more energy off a charge from that place's creatures (its map and its dungeon), on top of
// the piece's own 1 or 2. Kanor wants the place's boss part and guard part for it, and Gold: so a boss chest always has
// a use, and the dungeons are worth going back to. It never fails and never breaks. The gear's floor still holds: with
// the gear on, a charge never costs under a third of its hit (C.GEAR_FLOOR, 00-zzzzzzzzz-places.js).
// Saved as o.gs: [[piece id, stars], ...] (only stars of pieces you own count). After every other logic file, so its
// tip comes last in C.TIPS (a save keeps tips by their place in that list).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var int = function (v, lo, hi, d) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

  // star k (1, 2, 3): Gold = this share of the piece's own price; parts = how many of the boss's and the guard's part
  C.GEAR_STAR = { max: 3, gold: [0.5, 1, 2], parts: [1, 2, 3] };
  C.TIPS.push({ key: 'gear_stars_tour', text: 'GEAR STARS' });

  // a place's boss part and guard part: the first thing its dungeon's boss and guard leave
  L.starParts = function (place) {
    var d = C.PLACES[place] && C.PLACES[place].dungeon, b = d && WI.animals[d.boss], g = d && WI.animals[d.guard];
    return b && g ? { boss: b.drops[0][0], guard: g.drops[0][0] } : null;
  };
  L.gearStars = function (s, id) { return int(s.gstar && s.gstar[id], 0, C.GEAR_STAR.max, 0); };
  // What star k of a piece costs: { gold, needs: [[boss part, n], [guard part, n]] }, or null
  L.starCost = function (id, k) {
    var g = C.PLACE_GEAR[id], p = g && L.starParts(g.place);
    if (!p || !(k >= 1 && k <= C.GEAR_STAR.max)) return null;
    var n = C.GEAR_STAR.parts[k - 1];
    return { gold: Math.round(g.gold * C.GEAR_STAR.gold[k - 1] / 100) * 100, needs: [[p.boss, n], [p.guard, n]] };
  };
  // Kanor puts the next star on a piece you own: 'ok' | 'none' | 'notyours' | 'max' | 'gold' | 'short'
  L.starGear = function (s, id) {
    var g = C.PLACE_GEAR[id];
    if (!g) return 'none';
    if (!L.ownsPiece(s, id)) return 'notyours';
    var k = L.gearStars(s, id) + 1, cost = L.starCost(id, k);
    if (k > C.GEAR_STAR.max || !cost) return 'max';
    if (s.gold < cost.gold) return 'gold';
    if (!L.hasNeeds(s, cost.needs)) return 'short';
    s.gold -= cost.gold;
    L.takeNeeds(s, cost.needs);
    s.gstar = s.gstar || {};
    s.gstar[id] = k;
    return 'ok';
  };
  // A piece's name with its stars: "Terrace Hat ★2"
  L.pieceName = function (s, id) {
    var g = C.PLACE_GEAR[id], n = g ? L.gearStars(s, id) : 0;
    return g ? g.name + (n ? ' ' + new Array(n + 1).join('★') : '') : '';
  };
  // What a piece takes off a charge in its place, with its stars
  L.pieceLess = function (s, id) { var g = C.PLACE_GEAR[id]; return g ? g.less + L.gearStars(s, id) : 0; };

  // ---------- what the stars take off ----------
  var gearLess = L.gearLess;
  L.gearLess = function (s, kind) {
    var less = gearLess(s, kind), def = kind && WI.animals[kind], at = def ? def.place || null : undefined;
    C.GEAR_SLOTS.forEach(function (slot) {
      var g = C.PLACE_GEAR[L.worn(s, slot)];
      if (g && (at === undefined || g.place === at)) less += L.gearStars(s, g.id);
    });
    return less;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.gstar = {};
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), gs = [];
    Object.keys(s.gstar || {}).forEach(function (id) { var n = L.gearStars(s, id); if (n && C.PLACE_GEAR[id]) gs.push([id, n]); });
    if (gs.length) o.gs = gs;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.gstar = {};
    (Array.isArray(o.gs) ? o.gs : []).slice(0, 200).forEach(function (e) {
      var id = Array.isArray(e) && String(e[0]), n = Array.isArray(e) ? int(e[1], 0, C.GEAR_STAR.max, 0) : 0;
      if (id && n && C.PLACE_GEAR[id] && L.ownsPiece(s, id)) s.gstar[id] = n;
    });
    return s;
  };
})(window.Farm = window.Farm || {});
