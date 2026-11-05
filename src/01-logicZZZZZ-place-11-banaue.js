// Banaue Terraces' rules (owner, 6 Nov 2026; the place is src/00-zzzzzzzzzz-place-11-banaue.js): Lola Bugan "gives
// small rewards" as her story goes on. A line of a place's person may carry a gift ([[item, n]]): it is given once,
// when that line opens to you (the story's own save, 'st', already knows how far you have heard). Talking after
// several lines opened at once (the guard and the boss both beaten before you came back) gives every one of their
// gifts, though she says only the newest line. Into the bag, or the basket at home when the bag is full. Written for
// any place's lines, so it does nothing to a line without one.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  var talkNpc = L.talkNpc;
  L.talkNpc = function (s, id) {
    var heard = L.placeRec(s, id).st, r = talkNpc(s, id), lines = C.PLACES[id].npc.lines, gift = [];
    for (var i = heard; i <= r.i; i++) (lines[i].gift || []).forEach(function (x) {
      var same = gift.filter(function (g) { return g[0] === x[0]; })[0];
      if (same) same[1] += x[1]; else gift.push([x[0], x[1]]);
    });
    if (gift.length) {
      r.gift = gift;
      r.basket = L.giveLoot(s, gift); // (how many went to the basket)
    }
    return r;
  };
  // What a line gives, in words: "4 Heirloom Rice and 10 Arrows"
  L.giftWords = function (gift) {
    var w = (gift || []).map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; });
    return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w.join('');
  };
})(window.Farm = window.Farm || {});
