// Online play (Phase 4): settings. The database side is supabase/farm_online.sql. The game reaches it through
// the app it runs in (window.gameHost.net, src/02-net.js), with the player's app account: online play is on
// whenever the app offers it.
(function (F) {
  'use strict';
  F.Config.ONLINE = {
    maxVisitors: 8, // on one farm at a time, besides the owner
    publishEvery: 60 * 1000, // how often a changed farm is published (ms)
    moveEvery: 250, // how often your position is sent while you walk (ms)
    moveDelay: 400, // the others are drawn this far in the past, so the next step has already arrived (ms)
    moveAhead: 200, // a step that comes late: they keep walking this long on their own (ms)
    trackEvery: 20000, // the fewest ms between presence updates: the server closes the line of a phone that sends them often
    goneAfter: 6000, // someone missing from the room this long has left; before that it is a dropped line (ms)
    snapTiles: 14, // someone further than this from where they should be is put there; nearer, they walk over quickly
    giftGold: 100, // what a gold gift is worth to the farm you leave it at
    // Central Park (owner, 6 Nov 2026), up to 30 in one room: every message counts once sent and once for each phone
    // that hears it, and the whole project may send 2,500 a second (more cuts off every live line in the app, Selebox
    // chats too). So there your place goes out about once a second while you walk, and only then (one more when you
    // stop), every 2 s when more than 20 others are there; "still here" to the park every 30 s (19zzz-c-park-online.js).
    park: { moveEvery: 1000, busyMoveEvery: 2000, busyAt: 20, beatEvery: 30000 },
  };
})(window.Farm = window.Farm || {});
