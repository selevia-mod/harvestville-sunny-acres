// Chocolate Hills (place 12; data 00-zzzzzzzzzz-place-12-bohol.js): Mang Tonyo's small gifts (owner, 6 Nov 2026: "a
// 4-step story ... with small rewards"). The first time a line of his is read, its gift goes into your bag (what does
// not fit waits in the basket at home), and the line says what it was. Read again, it gives nothing: a line is read once
// (s.places.bohol.st, the engine's own count), so a gift can never come twice, even after a reload.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var ID = 'bohol';

  var talkNpc = L.talkNpc;
  L.talkNpc = function (s, id) {
    var before = id === ID ? L.placeRec(s, id).st : 0, r = talkNpc(s, id);
    if (id !== ID) return r;
    var gifts = [];
    for (var i = before; i <= r.i; i++) { var g = C.PLACES[id].npc.lines[i].gift; if (g) gifts = gifts.concat(g); }
    if (gifts.length) {
      var left = L.giveLoot(s, gifts);
      r.gift = gifts;
      r.text += '\n\nMang Tonyo gives you ' + gifts.map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; }).join(', ') + '.' + (left ? ' (Some went to your basket at home.)' : '');
    }
    return r;
  };
})(window.Farm = window.Farm || {});
