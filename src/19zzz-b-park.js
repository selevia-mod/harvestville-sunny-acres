// Central Park in the world (owner, 6 Nov 2026; the place: 00-zzzzzzzzz-park.js, the map: tools/make-map.js park()).
// It is a place to meet, not to work: no field, debris, animals, forage, water or villagers, so every tool, seed and
// the Bow say what they say in town (the action button's own rules, 14-actions.js), and nothing there counts for a
// quest. The one thing to use is the Hall of Fame's door, which for now only says what will be inside.
(function (F) {
  'use strict';
  var C = F.Config;
  var P = F.WorldScene.prototype;

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type === 'hall') return { label: 'Enter', icon: -1, run: function () { F.ui.dialog(C.PARK.hall); } };
    return extraObjectAction.call(this, o, held, def);
  };
})(window.Farm = window.Farm || {});
