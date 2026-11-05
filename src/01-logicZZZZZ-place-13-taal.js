// Taal Lake: Mang Celso's small gifts (owner, 6 Nov 2026: "a 4-step story ... with small rewards"). Each step of his story
// gives its gift once, the first time you hear it (the story's progress is already saved, s.places.taal.st, so nothing
// new is saved). A step skipped because two opened at once still gives its gift. Only Taal's person: the engine's
// L.talkNpc is otherwise unchanged (01-logicZZZZ-places.js). The place itself: 00-zzzzzzzzzz-place-13-taal.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  // by step: items, and Gold
  C.TAAL_GIFTS = [
    { items: [['kapeng_barako', 1]] },
    { items: [['fish_s', 5]] },
    { items: [['tapang_taal', 1], ['sulfur_chip', 4]] },
    { items: [['kapeng_barako', 3]], gold: 500 },
  ];
  var talkNpc = L.talkNpc;
  L.talkNpc = function (s, id) {
    if (id !== 'taal') return talkNpc(s, id);
    var was = L.placeRec(s, id).st, r = talkNpc(s, id), got = [], gold = 0;
    for (var i = was; i <= r.i; i++) {
      var g = C.TAAL_GIFTS[i];
      if (!g) continue;
      if (g.items) { L.giveLoot(s, g.items); got = got.concat(g.items); }
      if (g.gold) { s.gold += g.gold; gold += g.gold; }
    }
    var words = got.map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; });
    if (gold) words.push(gold + ' Gold');
    if (words.length) { r.text += '\n\n(Mang Celso gives you ' + words.join(', ') + '.)'; r.gifts = got; r.gold = gold; }
    return r;
  };
})(window.Farm = window.Farm || {});
