// Central Park in the world (owner, 6 Nov 2026; the place: 00-zzzzzzzzz-park.js, the map: tools/make-map.js park()).
// It is a place to meet, not to work: no field, debris, animals, forage or villagers, so every tool, seed and the Bow
// say what they say in town (the action button's own rules, 14-actions.js), and nothing there counts for a quest. Its
// pond (added when the park was made bigger, owner 6 Nov 2026) is to look at: no fishing in it and no filling the can.
// The one thing to use is the Hall of Fame's door, which for now only says what will be inside.
(function (F) {
  'use strict';
  var C = F.Config;
  var P = F.WorldScene.prototype;

  var L = F.Logic;

  // the pond is not water to use (fishing and refills check isWater), only water to look at (its tiles stay solid)
  var isWater = P.isWater;
  P.isWater = function (x, y) {
    return this.mapKey === 'park' ? false : isWater.call(this, x, y);
  };
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mapKey === 'park') {
      var t = this.facing(), held = L.held(this.state);
      if (held && (held.id === 'rod' || held.id === 'can') && !!(this.tileProps('Ground', t.x, t.y).water || this.tileProps('Walls', t.x, t.y).water)) {
        var rod = held.id === 'rod';
        return { label: rod ? 'Fish' : 'Refill', icon: rod ? C.ICON.rod : C.ICON.drop, disabled: true,
          why: rod ? 'No fishing in Central Park: the pond is for everyone to enjoy. Fish in the town river or your farm pond.' : 'The park pond is just to look at. Refill your can at the farm pond or the river.' };
      }
    }
    return resolve.call(this);
  };

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type === 'hall') return { label: 'Enter', icon: -1, run: function () { F.ui.dialog(C.PARK.hall); } };
    return extraObjectAction.call(this, o, held, def);
  };
})(window.Farm = window.Farm || {});
