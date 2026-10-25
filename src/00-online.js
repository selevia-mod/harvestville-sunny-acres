// Online play (Phase 4): settings. The database side is supabase/farm_online.sql; the game talks to it through
// F.Net (src/02-net.js). Online stays off until url and key are filled in (after the SQL is applied).
(function (F) {
  'use strict';
  F.Config.ONLINE = {
    url: '', // e.g. 'https://<project>.supabase.co'
    key: '', // the project's publishable (anon) key
    auth: 'both', // 'guest' (play as a guest), 'account' (sign in with an app account) or 'both'
    maxVisitors: 8, // on one farm at a time, besides the owner
    publishEvery: 60 * 1000, // how often a changed farm is published (ms)
    moveEvery: 250, // how often your position is sent while you walk (ms)
    giftGold: 100, // what a gold gift is worth to the farm you leave it at
  };
})(window.Farm = window.Farm || {});
