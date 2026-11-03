// Hunting together (00-zzzzhunt.js): Hunter's gear (a bit each in s.hg, saved 'hg') and more room for tips and tours.
// s.tips holds the first 31 (a bit each in one saved number, 'tp'); the ones after go in s.tq (saved 'tq'), so a tip
// keeps its place in the list and an old save still knows which it has seen.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var FIRST = 31;
  var GEAR_ALL = (1 << C.GEAR.length) - 1;

  // the tours that came with hunting together (19zm-hunt-together.js, 19zn-hunt-dog.js, 19zo-gear.js). Appended last.
  C.TIPS.push({ key: 'hunt_together_tour', text: 'HUNTING TOGETHER' }, { key: 'hunt_dog_tour', text: 'YOUR DOG COMES HUNTING' },
    { key: 'gear_tour', text: "HUNTER'S GEAR" });

  var place = function (s, key) {
    var i = C.TIPS.map(function (t) { return t.key; }).indexOf(key);
    if (i < 0) return null;
    return i < FIRST ? { k: 'tips', bit: i } : { k: 'tq', bit: i - FIRST };
  };
  L.takeTip = function (s, key) {
    var p = place(s, key);
    if (!p || ((s[p.k] || 0) >> p.bit) & 1) return null;
    s[p.k] = (s[p.k] || 0) | (1 << p.bit);
    return C.TIPS.filter(function (t) { return t.key === key; })[0].text;
  };
  L.tipSeen = function (s, key) {
    var p = place(s, key);
    return !p || !!(((s[p.k] || 0) >> p.bit) & 1);
  };

  // ---------- Hunter's gear ----------
  L.gearIndex = function (key) { return C.GEAR.map(function (g) { return g.key; }).indexOf(key); };
  L.hasGear = function (s, key) { var i = L.gearIndex(key); return i >= 0 && !!(((s.hg || 0) >> i) & 1); };
  L.gearBits = function (s) { return (s.hg || 0) & GEAR_ALL; };
  // 'ok' | 'owned' | 'gold' (not enough) | 'none'
  L.buyGear = function (s, key) {
    var i = L.gearIndex(key);
    if (i < 0) return 'none';
    if (L.hasGear(s, key)) return 'owned';
    if (s.gold < C.GEAR[i].gold) return 'gold';
    s.gold -= C.GEAR[i].gold;
    s.hg = (s.hg || 0) | (1 << i);
    return 'ok';
  };
  // How close a shy animal lets this hunter come, and when they count as sneaking (bits: their gear, here or a friend's).
  L.gearNotice = function (bits) { return bits & 1 ? C.GEAR_RULES.notice : 1; };
  L.gearSneak = function (bits) { return bits & 2 ? C.GEAR_RULES.sneak : 0.6; };
  // A missed arrow: does it come back? (rnd: Math.random)
  L.arrowBack = function (s, rnd) { return L.hasGear(s, 'quiver') && rnd() < C.GEAR_RULES.back; };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.tq = 0;
    s.hg = 0;
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.tq) o.tq = s.tq;
    if (L.gearBits(s)) o.hg = L.gearBits(s);
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.tq = Math.max(0, Math.min(2147483647, Math.floor(Number(o.tq)) || 0));
    s.hg = (Math.floor(Number(o.hg)) || 0) & GEAR_ALL;
    return s;
  };
})(window.Farm = window.Farm || {});
