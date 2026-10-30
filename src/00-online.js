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
    giftGold: 100, // what a gold gift is worth to the farm you leave it at
  };
})(window.Farm = window.Farm || {});
