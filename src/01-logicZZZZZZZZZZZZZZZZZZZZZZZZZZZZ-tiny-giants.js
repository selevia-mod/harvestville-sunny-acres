// "Giant" hunting medals of the tiny animals (18 Nov 2026, found in the Manila work).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;

  // The Hunter's Book weighs in tenths of a kg. For an animal under about 1 kg an ordinary one can weigh what a giant
  // "should" (a Pugo, 0.2 kg: every one is 0.2), so its Giant medal came on the first hunt. For those (`tiny`: an ordinary
  // one's best weight reaches the giant mark) the medal now comes only with a real giant (size 1.25x or more), when it is
  // hunted. A medal already given stays: L.medalCheck never takes one back, and this only changes how a new one is earned.
  // Today that is the Pugo, Tikling, Kuwago (its biggest ordinary one missed the mark only by a rounding), Tuko and Paniki.
  var giantAt = function (kind) { return Math.floor(WI.animals[kind].kg * 10 * 1.2); };
  L.tinyGiant = function (kind) { var d = WI.animals[kind]; return !!d && Math.round(d.kg * 1.1 * 10) >= giantAt(kind); };
  var medalEarned = L.medalEarned;
  if (medalEarned) {
    L.medalEarned = function (s, m) {
      if (m.kind === 'giant' && L.tinyGiant(m.animal)) return false; // (given by the hunt itself, below)
      return medalEarned(s, m);
    };
    var hunted = L.hunted;
    L.hunted = function (s, area, slot, kind, size) {
      var r = hunted(s, area, slot, kind, size);
      if (r && L.tinyGiant(kind) && L.wildGiant(size || 1)) {
        s.medals = s.medals || {};
        C.MEDALS.forEach(function (m) {
          if (m.kind !== 'giant' || m.animal !== kind || s.medals[m.code]) return;
          s.medals[m.code] = s.day;
          (r.medals = r.medals || []).push(m);
        });
      }
      return r;
    };
  }
})(window.Farm = window.Farm || {});
