// First-time tours (on screen: 19ze-tours.js): each is a bit in s.tips, like the tips, so it is saved with the farm
// and shows once. Appended last: a tip's place in the list is its bit in the saved number.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  C.TIPS.push({ key: 'land_tour', text: 'THE BACK FIELDS' }, { key: 'town_tour', text: 'TOWN GOAL' });

  // Whether a tip or tour has been shown, without marking it.
  L.tipSeen = function (s, key) {
    var i = C.TIPS.map(function (t) { return t.key; }).indexOf(key);
    return i < 0 || !!((s.tips >> i) & 1);
  };
})(window.Farm = window.Farm || {});
