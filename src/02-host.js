// Bridge to the app shell: window.gameHost (save/load), window.__gameSleep, window.__gameBack.
(function (F) {
  'use strict';
  var C = F.Config;

  // Standalone fallback (e.g. opening the HTML file directly in a browser). A real host
  // provides window.gameHost itself; this keeps the same contract using localStorage.
  if (!window.gameHost) {
    var KEY = 'farm-save-v' + C.SAVE_VERSION;
    var stored = null;
    try { stored = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { stored = null; }
    window.gameHost = {
      state: stored,
      save: function (state) {
        this.state = state;
        try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
      },
    };
  }

  var Host = { sleeping: false, game: null };

  Host.load = function () {
    var raw = window.gameHost && window.gameHost.state;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    return F.Logic.deserialize(raw);
  };

  Host.save = function (state) {
    var data = F.Logic.serialize(state);
    var size = JSON.stringify(data).length;
    if (size > C.MAX_SAVE_BYTES) {
      console.warn('Save skipped: ' + size + ' bytes is over the limit');
      return false;
    }
    try {
      window.gameHost.save(data);
      return true;
    } catch (e) {
      console.warn('gameHost.save failed', e);
      return false;
    }
  };

  // Called once the Phaser game exists, so a sleep request made during boot still applies.
  Host.attach = function (game) {
    Host.game = game;
    if (Host.sleeping) game.loop.sleep();
  };

  window.__gameSleep = function (sleeping) {
    sleeping = !!sleeping;
    if (sleeping === Host.sleeping) return;
    Host.sleeping = sleeping;
    if (sleeping && F.session) Host.save(F.session.state);
    if (F.input) F.input.reset();
    if (F.Audio) F.Audio.suspend(sleeping);
    if (!Host.game) return;
    if (sleeping) Host.game.loop.sleep();
    else Host.game.loop.wake();
  };

  // Returns true when the game handled Back (closed a panel or opened the pause menu).
  window.__gameBack = function () {
    if (!F.ui) return false;
    return F.ui.back();
  };

  F.Host = Host;
})(window.Farm = window.Farm || {});
