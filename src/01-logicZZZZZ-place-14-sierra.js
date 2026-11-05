// Sierra Madre's rules (owner, 6 Nov 2026; data 00-zzzzzzzzzz-place-14-sierra.js): Ka Ramon's small gifts. The first
// time one of his lines opens for you, its gift goes into your bag (what does not fit waits in the basket at home), and
// his words say what he gave. A line skipped over (you did more before you came to talk) still gives its gift then.
// Only Sierra Madre's lines: the engine's story (01-logicZZZZ-places.js) is unchanged.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var talkNpc = L.talkNpc;
  L.talkNpc = function (s, id) {
    if (id !== 'sierra') return talkNpc(s, id);
    var was = (s.places && s.places[id] && s.places[id].st) || 0, r = talkNpc(s, id), lines = C.PLACES[id].npc.lines, gift = [];
    for (var i = was; i <= r.i; i++) gift = gift.concat(lines[i].gift || []);
    if (!gift.length) return r;
    var left = L.giveLoot(s, gift);
    r.gift = gift;
    r.text += '\n\n(You got ' + gift.map(function (x) { return x[1] + ' ' + C.ITEMS[x[0]].name; }).join(', ') + '.' + (left ? ' Some went to your basket at home.' : '') + ')';
    return r;
  };
})(window.Farm = window.Farm || {});
