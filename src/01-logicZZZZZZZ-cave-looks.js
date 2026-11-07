// The caves' looks: the rules (content 00-zzzzzzzzzzzz-cave-looks.js). Owned like any look (s.lk, a bit each: 01-logicK.js).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var CL = C.CAVE_LOOK;

  // The look a place's cave gives (its key), or null.
  L.caveLookOf = function (place) {
    for (var i = 0; i < C.LOOKS.length; i++) if (C.LOOKS[i].reward === place) return C.LOOKS[i].key;
    return null;
  };
  // What Kanor wants for it: [[boss part, n], [guard part, n]], or null.
  L.caveLookNeeds = function (place) {
    var p = L.starParts && L.starParts(place);
    return p ? [[p.boss, CL.boss], [p.guard, CL.guard]] : null;
  };
  // You shared the hunt of a place's floor-50 boss: 1 in 10, its look is yours (only while you do not have it). True when
  // it was given just now. roll is for the tests (Math.random by default).
  L.caveBossHunted = function (s, place, roll) {
    var key = L.caveLookOf(place);
    if (!key || L.ownsLook(s, key) || (roll != null ? roll : Math.random()) >= CL.chance) return false;
    s.lk = (s.lk || 0) | (1 << C.LOOK_INDEX[key]);
    return true;
  };
  // Kanor makes it: 'ok' | 'owned' | 'none' | 'gold' | 'short'
  L.buyCaveLook = function (s, place) {
    var key = L.caveLookOf(place), needs = L.caveLookNeeds(place);
    if (!key || !needs) return 'none';
    if (L.ownsLook(s, key)) return 'owned';
    if (s.gold < CL.gold) return 'gold';
    if (needs.some(function (n) { return L.countItem(s, n[0]) < n[1]; })) return 'short';
    s.gold -= CL.gold;
    needs.forEach(function (n) { L.removeItem(s, n[0], n[1]); });
    s.lk = (s.lk || 0) | (1 << C.LOOK_INDEX[key]);
    return 'ok';
  };
})(window.Farm = window.Farm || {});
