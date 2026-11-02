// Invite Friends rewards (owner, 2 Nov 2026). The server keeps them until the game takes them, once: gold goes straight to
// the save, refills wait in s.rf for the Energy panel. If the server has nothing, or can't be reached, nothing shows.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var MOST = { harvest_gold: 1000000, harvest_energy: 1000 }; // far past any real reward: a bad answer can't flood a save

  var take = function (kind) {
    return F.Net.rpc('invite_collect_game_rewards_v1', { p_kind: kind }).then(function (r) {
      var n = r && r.ok ? Math.floor(Number(r.amount)) || 0 : 0;
      return Math.max(0, Math.min(MOST[kind], n));
    }, function () { return 0; });
  };

  O.inviteCollect = function () {
    return take('harvest_gold').then(function (gold) {
      return take('harvest_energy').then(function (refills) {
        if (!gold && !refills) return;
        var s = F.session.state;
        s.gold += gold;
        s.rf = L.refillsLeft(s) + refills;
        F.Host.save(s);
        F.bus.emit('hud');
        if (F.Audio) F.Audio.sfx('coin');
        var rows = [];
        if (gold) rows.push([C.ICON.coin, '+' + fmt(gold) + 'G for your farm.']);
        if (refills) rows.push([C.ICON.bolt, refills + ' free energy ' + (refills === 1 ? 'refill' : 'refills') + '. Tap your energy to use one.']);
        var show = function () {
          if (!F.ui || F.ui.modals.length) return setTimeout(show, 1500);
          F.ui.dialog('INVITE FRIENDS', null, { rows: rows });
        };
        show();
      });
    });
  };
})(window.Farm = window.Farm || {});
