// A place that fails to open never leaves a black screen (players, 10 Nov 2026: "can't get inside your houses ... scary",
// a friend's house stayed black). If building a map throws, the error goes to the app (window.gameHost.error: the app
// records it in Crashlytics, so we see what broke without the player's phone) and the player is taken back: from a
// friend's farm, home; from anywhere else, to their own farm; with a short note. Never twice in a row for the same place
// (if their own farm itself cannot open, it is reported and the game stays as it is). Loaded last: it wraps every create.
(function (F) {
  'use strict';
  var P = F.WorldScene.prototype;
  var AGAIN_MS = 15000;

  var tell = function (map, e) {
    try {
      var msg = String((e && e.message) || e || 'unknown').slice(0, 300), stack = String((e && e.stack) || '').split('\n').slice(0, 8).join('\n').slice(0, 1500);
      if (window.gameHost && typeof window.gameHost.error === 'function') window.gameHost.error(String(map || ''), msg, stack);
      if (window.console) console.error('[map failed] ' + map + ': ' + msg);
    } catch (e2) { /* the report never gets in the way */ }
  };

  var create = P.create;
  P.create = function () {
    this.mapBroken = false;
    try {
      return create.apply(this, arguments);
    } catch (e) {
      this.mapBroken = true; // (its update would throw on the half-built place and stop the game's loop: the black screen)
      var self = this, map = this.mapKey || (this.state && this.state.map) || '', visit = !!F.session.visit;
      tell((visit ? 'visit:' : '') + map, e);
      var last = F.session.mapFail, now = Date.now();
      F.session.mapFail = { map: map, visit: visit, t: now };
      if (last && last.map === map && last.visit === visit && now - last.t < AGAIN_MS) return; // (it failed again: no loop)
      if (!visit && map === 'farm') return; // (your own farm: nowhere safer to go)
      setTimeout(function () {
        try {
          self.busy = false;
          if (visit && F.Online && F.Online.leaveVisit) F.Online.leaveVisit();
          else {
            var s = F.session.state;
            s.map = 'farm';
            s.player = { x: null, y: null, dir: 'down' };
            F.session.spawn = null;
            self.scene.restart();
          }
          setTimeout(function () {
            if (F.ui && F.ui.toast) F.ui.toast(visit ? 'That farm could not open, so you are back home. Sorry! We have been told.' : 'That place could not open, so you are back on your farm. Sorry! We have been told.', 5000);
          }, 1500);
        } catch (e3) { tell('recover', e3); }
      }, 0);
    }
  };
  var update = P.update;
  P.update = function () {
    if (this.mapBroken) return;
    return update.apply(this, arguments);
  };
})(window.Farm = window.Farm || {});
