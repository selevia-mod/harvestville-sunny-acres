// The hunting places, open to everyone (owner, 7 Nov 2026; docs/game-server.md "Step 2"): the first-time tour (owner,
// 4 Oct 2026: every new feature gets one; the card: 19ze-tours.js). It shows the first time you are live in a public
// room (19zzzzzzzzz-gameserver.js calls F.GameServer.onPubLive), once the arrival toast is read.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, INK = K.INK;

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var farmer = function (ui, sc, x, y, girl, flip, scale) {
    var key = F.ensureTexture(ui, girl ? 'player_girl' : 'player');
    var p = ui.add.image(x, y, key, 0).setOrigin(0.5, 1).setScale(scale || 0.26).setFlipX(!!flip);
    sc.add(p);
    return p;
  };
  var pill = function (ui, sc, x, y, str) {
    var t = ui.txt(x + 22, y, str, 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5), w = Math.ceil(t.width) + 32;
    var g = ui.add.graphics();
    g.fillStyle(0x24160b, 0.85).fillRoundedRect(x, y - 12, w, 24, 12);
    g.lineStyle(1.5, 0xffd23f, 0.85).strokeRoundedRect(x + 0.75, y - 11.25, w - 1.5, 22.5, 11.25);
    sc.add([g, ui.add.circle(x + 13, y, 4, 0x7ee06a), t]);
    return w;
  };

  F.TOURS.hunt_open = {
    title: 'HUNTING TOGETHER',
    steps: [
      {
        text: 'The hunting places are open to all players now. Hunt with players from all over Harvest Ville, up to 30 in a place.',
        draw: function (ui, sc, move) {
          [[52, false, false], [104, true, false], [196, false, true], [242, true, true]].forEach(function (f, i) {
            var p = farmer(ui, sc, f[0], 128, f[1], f[2]);
            tw(ui, move, { targets: p, y: 120, duration: 360, yoyo: true, repeat: -1, delay: i * 180, ease: 'Sine.inOut' });
          });
          var b = icon(ui, sc, 148, 52, C.ICON.bow, 0.34);
          tw(ui, move, { targets: b, angle: 12, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'The chip at the top shows your place and how many are hunting there with you.',
        draw: function (ui, sc, move) {
          var w = pill(ui, sc, 60, 46, 'Pulag 2 · 17 here');
          var hand = words(ui, sc, 60 + w / 2, 84, '▲', 18, '#a8740c');
          tw(ui, move, { targets: hand, y: 76, duration: 420, yoyo: true, repeat: -1 });
          farmer(ui, sc, 150, 140, false, false, 0.22);
        },
      },
      {
        text: 'Tap Chat to talk to everyone here. A hunt is shared with your friends: tap a hunter to wave or add them as a friend.',
        draw: function (ui, sc, move) {
          farmer(ui, sc, 86, 132, false, false, 0.22);
          farmer(ui, sc, 196, 132, true, true, 0.22);
          var m = icon(ui, sc, 141, 112, C.ICON.venison, 0.3);
          tw(ui, move, { targets: m, y: 104, duration: 420, yoyo: true, repeat: -1 });
          var h = icon(ui, sc, 141, 40, C.ICON.heart, 0.26);
          tw(ui, move, { targets: h, scale: 0.32, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // e35: playing together (friends meet on a dungeon floor, Here, the follow note): the first time you go down a dungeon
  // floor on the game server, or open Here.
  F.TOURS.play_together = {
    title: 'PLAYING TOGETHER',
    steps: [
      {
        text: 'Go down the same dungeon floor as a friend and you are there together. No need to visit their farm first.',
        draw: function (ui, sc, move) {
          var a = farmer(ui, sc, 96, 130, false, false, 0.24), b = farmer(ui, sc, 186, 130, true, true, 0.24);
          tw(ui, move, { targets: [a, b], y: 122, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          var h = icon(ui, sc, 141, 46, C.ICON.heart, 0.28);
          tw(ui, move, { targets: h, scale: 0.34, duration: 420, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'In a hunting place, tap Online to see who is hunting near you. Add them as a friend in one tap.',
        draw: function (ui, sc, move) {
          var w = pill(ui, sc, 52, 50, 'Pulag 1 · 5 hunting here');
          var hand = words(ui, sc, 52 + w / 2, 88, '▲', 18, '#a8740c');
          tw(ui, move, { targets: hand, y: 80, duration: 420, yoyo: true, repeat: -1 });
          farmer(ui, sc, 141, 146, true, false, 0.22);
        },
      },
      {
        text: 'When a friend goes somewhere, a small note at the top says where. Tap Follow to go with them.',
        draw: function (ui, sc, move) {
          var w = pill(ui, sc, 40, 54, 'Moon went down to floor 4');
          var f = words(ui, sc, 40 + w + 30, 54, 'Follow', 14, '#2f5a22');
          tw(ui, move, { targets: f, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
          farmer(ui, sc, 141, 146, false, false, 0.22);
        },
      },
    ],
  };
  var together = false;
  F.GameServer.playTogether = function () {
    var s = F.session && F.session.state;
    if (together || !s || L.tipSeen(s, 'play_together_tour') || (window.gameHost && window.gameHost.quiet)) return;
    together = true;
    var tries = 0;
    var show = function () {
      var w = F.world;
      if (!F.ui || L.tipSeen(F.session.state, 'play_together_tour')) { together = false; return; }
      if ((F.ui.modals.length || !w || w.busy || document.getElementById('farm-ask')) && tries++ < 40) return setTimeout(show, 1500);
      if (!L.takeTip(F.session.state, 'play_together_tour')) return;
      F.Host.save(F.session.state);
      F.ui.tour('play_together');
    };
    setTimeout(show, 2800);
  };
  var asked = false;
  F.GameServer.onPubLive = function () {
    var s = F.session && F.session.state;
    if (asked || !s || L.tipSeen(s, 'hunt_open_tour') || (window.gameHost && window.gameHost.quiet)) return;
    asked = true;
    var tries = 0;
    var show = function () {
      var w = F.world, st = F.GameServer.state() || {};
      if (!F.ui || st.mode !== 'live' || !st.pub || L.tipSeen(F.session.state, 'hunt_open_tour')) { asked = false; return; }
      if ((F.ui.modals.length || !w || w.busy || document.getElementById('farm-ask')) && tries++ < 40) return setTimeout(show, 1500);
      if (!L.takeTip(F.session.state, 'hunt_open_tour')) return;
      F.Host.save(F.session.state);
      F.ui.tour('hunt_open');
    };
    setTimeout(show, 2800);
  };
})(window.Farm = window.Farm || {});
