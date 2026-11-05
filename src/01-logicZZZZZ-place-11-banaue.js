// Banaue Terraces' rules (owner, 6 Nov 2026; the place is src/00-zzzzzzzzzz-place-11-banaue.js): Lola Bugan "gives
// small rewards" as her story goes on. A line of a place's person may carry a gift ([[item, n]]): it is given once,
// the first time that line is said (the story's own save, 'st', already knows which lines were said), into the bag,
// or the basket at home when the bag is full. Written for any place's lines, so it does nothing to a line without one.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  var talkNpc = L.talkNpc;
  L.talkNpc = function (s, id) {
    var r = talkNpc(s, id), line = C.PLACES[id].npc.lines[r.i];
    if (r.isNew && line.gift && line.gift.length) {
      r.gift = line.gift.map(function (x) { return [x[0], x[1]]; });
      r.basket = L.giveLoot(s, r.gift); // (how many went to the basket)
    }
    return r;
  };
  // What a line gives, in words: "4 Heirloom Rice and 10 Arrows"
  L.giftWords = function (gift) {
    var w = (gift || []).map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; });
    return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w.join('');
  };
})(window.Farm = window.Farm || {});
