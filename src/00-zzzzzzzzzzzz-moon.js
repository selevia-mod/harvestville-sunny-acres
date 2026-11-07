// Haliya's Moon Bow (owner, 8 Nov 2026). Haliya is the moon goddess of the Bicol stories who keeps the moon from the
// Bakunawa. Past the Magma Bow: the same reach (7 tiles; owner: "8 is so much overpower") and the same hit (3), but each
// arrow goes through the first creature it hits and hits the one behind it too (the "Moon arrow"), with a white moon
// shine friends can see (19v-wild.js, 19w-bow.js). Kanor makes it from the Magma Bow, each place cave's boss part, the
// Bakunawa's scales and 600,000 Gold (owner: "so they grind the mine also"). Rules 01-logicZZZZZZZ-moon.js; Kanor's row
// 19zu-lair-ui.js. Loaded after every other 00- file: its icon is the last of C.ICON_ORDER (nothing moves).
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;

  // the bow's fifth level: reach and hit as the Magma Bow's (C.WILD.bow.range and .damage, by level)
  WI.bow.range.push(7);
  WI.bow.damage.push(3);
  C.MOON_BOW = {
    name: "Haliya's Moon Bow", level: 5, gold: 600000,
    pierce: 1, // creatures an arrow goes through (and still hits the next)
    // the Magma Bow is traded in (it is the bow you have: it becomes this one); about 3 kills of each cave's boss (on its
    // floor 50) and 3 Bakunawa hunts
    needs: [['fur_amomongo', 6], ['moss_nuno', 3], ['pearl_berberoka', 3], ['bark_kapre', 6], ['feather_minokawa', 6], ['bakunawa_scale', 5]],
    shine: 0xeaf4ff, // the moon's white (a touch of blue)
  };
  if (C.ICON_ORDER.indexOf('bow_5') < 0) C.ICON_ORDER.push('bow_5');
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
})(window.Farm = window.Farm || {});
