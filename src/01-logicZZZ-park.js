// Central Park's save (owner, 6 Nov 2026; the place: 00-zzzzzzzzz-park.js). The save keeps the map as its place in a
// list (01-logic.js), and an older copy of the game reading a new number would put the farmer somewhere wrong. So, as the
// Lair is saved as Magayon, the park is saved as town without the spot, and pk says to stand on the park road, just
// outside the way in: a game closed in the park opens again there, one step from going back in.
(function (F) {
  'use strict';
  var L = F.Logic;

  var TOWN = null;
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.map === 'park') {
      if (TOWN == null) TOWN = serialize(Object.assign({}, s, { map: 'town' })).m;
      o.m = TOWN;
      delete o.p;
      o.pk = 1;
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s && o && o.pk && s.map === 'town') s.player = { x: null, y: null, dir: 'down', spawn: 'from_park' };
    return s;
  };
})(window.Farm = window.Farm || {});
