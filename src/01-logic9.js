// Real time: the farm follows the phone's clock. L.catchUp brings a farm up to now: energy that came back while
// you were away, and every midnight that went by since (each one a L.endDay: animals, the shipping box, the
// weather, mail, villagers, quests...). The days' reports are merged into one "while you were away" report.
// Crops need nothing here: they grow by the clock (01-logic.js).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var MAX_DAYS = 30; // more days away than this: the ones before are skipped (nothing much changes anyway)

  // Returns null when it is still the same day, else the merged report of the days that went by.
  L.catchUp = function (s, now, info) {
    if (now == null) now = L.clock();
    var today = L.dayOf(now);
    s.time = L.minuteOf(now);
    L.regen(s, Math.floor(now / 60000));
    if (today <= s.day) return null; // (a clock set back does not undo days)
    if (today - s.day > MAX_DAYS) s.day = today - MAX_DAYS;
    var days = [];
    while (s.day < today) days.push(L.endDay(s, false, info));
    var r = L.mergeReports(days);
    L.regen(s, Math.floor(now / 60000));
    return r;
  };

  L.mergeReports = function (days) {
    var last = days[days.length - 1], r = {};
    Object.keys(last).forEach(function (k) { r[k] = last[k]; });
    r.days = days.length;
    var sum = function (k) { return days.reduce(function (a, d) { return a + (d[k] || 0); }, 0); };
    var all = function (k) { return days.reduce(function (a, d) { return a.concat(d[k] || []); }, []); };
    var any = function (k) { var hit = null; days.forEach(function (d) { if (d[k]) hit = d[k]; }); return hit; };
    r.earned = sum('earned');
    r.shipped = all('shipped');
    r.produced = {};
    days.forEach(function (d) { Object.keys(d.produced || {}).forEach(function (id) { r.produced[id] = (r.produced[id] || 0) + d.produced[id]; }); });
    r.born = all('born');
    r.hungry = all('hungry').filter(function (n, i, a) { return a.indexOf(n) === i; });
    r.weeds = sum('weeds');
    r.mail = sum('mail');
    r.standSold = all('standSold');
    ['newSeason', 'built', 'wedding', 'lunch', 'horse', 'homeUp', 'visitor', 'goalDone'].forEach(function (k) { r[k] = any(k); });
    r.passedOut = false;
    return r;
  };
})(window.Farm = window.Farm || {});
