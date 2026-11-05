// Central Park (owner, 6 Nov 2026): "not my park, not my friends park, its for everyone park". One open place for every
// player, up the road at the dead end east of the mine (owner: "if users goes that it will drag to Central Park"). This
// file is the place itself: its name, the Hall of Fame's words, and the ways in and out for the goal arrow. The map is
// tools/make-map.js park(); saving it is 01-logicZZZ-park.js; what you can do there is 19zzz-b-park.js. Seeing everyone
// there (Park 1/2/3, 30 each) is the online side's. Adds nothing to a saved list (no icons, items or crops).
(function (F) {
  'use strict';
  var C = F.Config;

  C.PARK = {
    name: 'Central Park',
    // The Hall of Fame's inside comes later (owner, 6 Nov 2026): for now its door says what will be there.
    hall: "THE HALL OF FAME\nOpening soon: the names of Harvest Ville's best hunters, farmers and anglers will hang here.",
  };

  // the way out of each place toward the park, and out of the park toward everywhere else (the goal arrow, following a
  // friend): every place goes the way it goes to town, and town goes up the park road
  var R = C.ROUTES;
  R.park = {};
  Object.keys(R).forEach(function (m) {
    if (m === 'park') return;
    R.park[m] = 'gate';
    R[m].park = m === 'town' ? 'park_road' : R[m].town;
  });
})(window.Farm = window.Farm || {});
