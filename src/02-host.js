// Bridge to the app shell: window.gameHost (save/load), window.__gameSleep, window.__gameBack.
(function (F) {
  'use strict';
  var C = F.Config;

  // Standalone fallback (e.g. opening the HTML file directly in a browser). A real host
  // provides window.gameHost itself; this keeps the same contract using localStorage.
  // (An app may set up only part of it before the game loads, e.g. just gameHost.net: the rest is filled in.)
  if (!window.gameHost || typeof window.gameHost.save !== 'function') {
    var KEY = 'farm-save-v' + C.SAVE_VERSION;
    var stored = null;
    try { stored = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { stored = null; }
    var gh = window.gameHost = window.gameHost || {};
    if (gh.state === undefined) gh.state = stored;
    gh.save = function (state) {
      this.state = state;
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
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
      Host.saveRefused();
      return false;
    }
    try {
      window.gameHost.save(data);
      Host.remind(state);
      return true;
    } catch (e) {
      console.warn('gameHost.save failed', e);
      return false;
    }
  };

  // A save that doesn't fit never passes quietly: the player is told once a visit, and the app counts it.
  Host.refused = false;
  Host.saveRefused = function () {
    if (Host.refused) return;
    Host.refused = true;
    if (window.gameHost && typeof window.gameHost.report === 'function') window.gameHost.report('save_refused');
    if (F.ui && F.ui.toast) F.ui.toast('Your farm is too full to save! Put some decorations in storage, or sell things from your bag.', 5000);
  };

  // In the app (gameHost.remind): the next crop to ripen, so the phone can remind the player while the game is closed.
  // Sent only when it changes; null when there is nothing growing or Crop alerts is off (pause menu).
  Host.reminded = null;
  Host.remind = function (state) {
    var h = window.gameHost;
    if (!h || typeof h.remind !== 'function') return;
    var next = state.opts && state.opts.alerts === 0 ? null : F.Logic.nextHarvest(state);
    var key = next ? next.at + '|' + next.item : '';
    if (key === Host.reminded) return;
    Host.reminded = key;
    var item = next && C.ITEMS[next.item], what = item ? item.name.toLowerCase() : 'crop';
    try {
      var body = !item || item.kind === 'crop' ? 'Your ' + what + ' crop is ripe! Come and harvest it before it withers.'
        : item.kind === 'fruit' ? 'Your ' + (item.plural || what) + ' are ready to pick!' : 'Your ' + what + ' is ready! Come and collect it.';
      h.remind(next ? { at: next.at * 60000, title: 'Harvest Ville', body: body } : null);
    } catch (e) { /* the app's reminder is optional */ }
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

  // The page put away saves too (owner, 23 Nov 2026: "it should save the game when the users close the app or the
  // game"): the app's sleep message saves as above, but a phone can stop the page before it comes (the app swiped off,
  // iOS freezing the web view), and the 15-second save may be up to 15 seconds behind. Asleep: saved already.
  var hideSave = function () {
    try {
      if (Host.sleeping || !F.session || !F.session.state) return;
      if (Host.save(F.session.state)) F.session.dirty = false;
    } catch (e) { /* (never an error on the way out) */ }
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') hideSave(); });
    window.addEventListener('pagehide', hideSave);
  }

  // Returns true when the game handled Back (closed a panel or opened the pause menu).
  window.__gameBack = function () {
    if (!F.ui) return false;
    return F.ui.back();
  };

  F.Host = Host;
})(window.Farm = window.Farm || {});
