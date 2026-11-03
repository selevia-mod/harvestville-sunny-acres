// First-time tours for barangays and the Market board (owner, 4 Oct 2026: every feature gets one; the card:
// 19ze-tours.js). Barangays the first time Online, Friends opens with the Barangay row there (part 16 applied); the
// Market board the first time the Market tab opens with it (part 17). Each shows once (s.tips / s.tq, 01-logicL.js),
// and again from What's new (Show me).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var K = F.UI_CONST, INK = K.INK;

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };

  F.TOURS.nb = {
    title: 'BARANGAYS',
    steps: [
      {
        text: 'A barangay is a team of up to 30 farms. Find one, or make your own, under Online, Friends.',
        draw: function (ui, sc, move) {
          ['carabao', 'mango', 'sunflower'].forEach(function (b, i) {
            var g = icon(ui, sc, 76 + i * 60, 58, C.ICON[b], 0.32);
            tw(ui, move, { targets: g, y: 48, duration: 380, yoyo: true, repeat: -1, delay: i * 160, ease: 'Sine.inOut' });
          });
          words(ui, sc, 136, 108, 'Barangay Mabuhay', 15, '#5a3a1e');
        },
      },
      {
        text: 'Every week, the Bayanihan Cup: the same tasks for all. Pick one and do it on your farm.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 54, 66, C.ICON.turnip, 0.34);
          words(ui, sc, 160, 46, 'Harvest 80 crops', 14);
          sc.add(ui.add.rectangle(100, 78, 120, 12, 0x6a4a2a).setOrigin(0, 0.5));
          var bar = ui.add.rectangle(102, 78, 10, 8, 0x3fa535).setOrigin(0, 0.5);
          sc.add(bar);
          tw(ui, move, { targets: bar, width: 116, duration: 1800, repeat: -1, hold: 500 });
          if (!move) bar.width = 80;
          words(ui, sc, 160, 104, '+120 points', 13, '#2f7a22');
        },
      },
      {
        text: 'Points rank your barangay in a group its size. Prizes every Monday, for everyone who helped!',
        draw: function (ui, sc, move) {
          words(ui, sc, 124, 40, '#1  Mabuhay   1,240', 14, '#a8740c');
          words(ui, sc, 124, 70, '#2  Ilog   980', 13);
          var g = icon(ui, sc, 236, 96, C.ICON.gift, 0.3);
          tw(ui, move, { targets: g, scale: 0.36, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  F.TOURS.ads = {
    title: 'THE MARKET BOARD',
    steps: [
      {
        text: 'Advertise puts your Market stall on the board for 4 hours, with what you sell. Free once a day!',
        draw: function (ui, sc, move) {
          var n = icon(ui, sc, 70, 66, C.ICON.crate, 0.36);
          tw(ui, move, { targets: n, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1 });
          icon(ui, sc, 150, 54, C.ICON.turnip, 0.26);
          icon(ui, sc, 196, 54, C.ICON.egg, 0.26);
          words(ui, sc, 172, 96, '4 hours', 15, '#a8740c');
        },
      },
      {
        text: 'Others find it on the board in their Market: Stall to buy from you, or Visit your farm.',
        draw: function (ui, sc, move) {
          words(ui, sc, 136, 40, 'Moon Meadow', 15, '#5a3a1e');
          words(ui, sc, 136, 68, '10 Turnip for 300G', 13);
          var b = words(ui, sc, 136, 100, 'Stall', 15, '#2f5a22');
          tw(ui, move, { targets: b, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // ---------- when each opens ----------
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || (window.gameHost && window.gameHost.quiet)) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  var openOnline = U.openOnline;
  U.openOnline = function (tab, page, then) {
    var self = this, args = arguments;
    if (tab === 'friends' && O.on && O.nb && !O.nbOff && F.session.state.net.named && take('nb_tour')) {
      return this.tour('nb', function () { openOnline.apply(self, args); });
    }
    return openOnline.apply(this, args);
  };
  // (19zz-social-ads.js asks, once the board has loaded: true when the tour opens, then() after it)
  U.adsTour = function (then) {
    if (!O.on || !O.ads || O.adsOff || !take('ads_tour')) return false;
    this.tour('ads', then);
    return true;
  };
})(window.Farm = window.Farm || {});
