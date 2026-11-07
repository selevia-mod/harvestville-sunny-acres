// Haliya's Moon Bow: the rules (content 00-zzzzzzzzzzzz-moon.js). The bow's level 5: made at Kanor's from the Magma Bow
// (level 4), the five caves' boss parts, Bakunawa Scales and Gold. Saved as o.mnb (the bow's level in 'wl' stops at the
// Gold Bow, and o.mgb brings back the Magma Bow: 01-logicN.js); loaded after it, so the Magma Bow is there to become this.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MOON_BOW;
  C.TIPS.push({ key: 'moonbow_tour', text: "HALIYA'S MOON BOW" }); // (the tour, once: 19zu-lair-ui.js)

  L.hasMoonBow = function (s) { return L.bowLevel(s) >= M.level; };
  // How many creatures an arrow from this bow goes through (and hits the next): 0, or the Moon Bow's 1.
  L.bowPierce = function (level) { return level >= M.level ? M.pierce : 0; };
  // Is a shot from a bow of this level a Moon arrow (the moon shine; a friend's shot says its bow's level)?
  L.moonShot = function (level) { return Number(level) >= M.level; };
  // The bow's own picture, by level (a friend's shot says its level): Bow, Copper, Silver, Gold, Magma, Moon.
  L.bowIcon = function (level) {
    level = Math.max(0, Math.min(M.level, Math.floor(Number(level) || 0)));
    return C.ICON[level ? 'bow_' + level : 'bow'];
  };

  // 'ok' | 'have' | 'nobow' | 'magma' (the Magma Bow first) | 'gold' | 'short' (the parts)
  L.makeMoonBow = function (s) {
    if (L.hasMoonBow(s)) return 'have';
    if (!L.hasBow(s)) return 'nobow';
    if (L.bowLevel(s) < M.level - 1) return 'magma';
    if (s.gold < M.gold) return 'gold';
    if (M.needs.some(function (n) { return L.countItem(s, n[0]) < n[1]; })) return 'short';
    s.gold -= M.gold;
    M.needs.forEach(function (n) { L.removeItem(s, n[0], n[1]); });
    s.tools.bow = M.level;
    return 'ok';
  };

  var itemName = L.itemName;
  L.itemName = function (s, id) { return id === 'bow' && L.hasMoonBow(s) ? M.name : itemName(s, id); };
  var iconOf = L.iconOf;
  L.iconOf = function (s, id) { return id === 'bow' && L.hasMoonBow(s) ? C.ICON.bow_5 : iconOf(s, id); };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (L.hasMoonBow(s)) o.mnb = 1;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    if (o.mnb === 1 && L.hasBow(s) && L.bowLevel(s) === M.level - 1) s.tools.bow = M.level;
    return s;
  };
})(window.Farm = window.Farm || {});
