// Four more first-time tours (owner, 4 Oct 2026: every feature gets one; 3 Nov 2026: Today's Event, Rare surprises and
// the deeper Mine only had a toast). The card and its rules are 19ze-tours.js (U.tour); these add the steps and when each
// opens: the Tailor Shop the first time you talk to Tita Luz, Today's Event the first time its pop-up or badge opens,
// Rare surprises the first time one is near (a sparkling rock on your floor, a golden crop on your farm), and the deep
// Mine the first time you reach a cave past floor 200. Each shows once (a bit in s.tips, 01-logicK.js) and again from
// What's new (Show me).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, INK = K.INK;

  // ---------- pieces ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var thumb = function (ui, sc, x, y, i, girl, scale) {
    F.ensureTexture(ui, 'looks_thumbs');
    var im = ui.add.image(x, y, 'looks_thumbs', i * 2 + (girl ? 1 : 0)).setOrigin(0.5, 1).setScale(scale || 0.5);
    sc.add(im);
    return im;
  };
  var girl = function () { return F.session && F.session.state.look === 'girl'; };

  // ---------- the tours ----------
  F.TOURS.tailor = {
    title: 'THE TAILOR SHOP',
    steps: [
      {
        text: 'Tita Luz sews a look for every season. One look dresses your whole farmer.',
        draw: function (ui, sc, move) {
          [0, 1, 3, 7].forEach(function (k, n) {
            var im = thumb(ui, sc, 46 + n * 60, 118, k, girl(), 0.5);
            tw(ui, move, { targets: im, y: 110, duration: 420, delay: n * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Some looks are bought with your farm’s Gold, festival looks with Coins or Stars. The Christmas Elf is free.',
        draw: function (ui, sc, move) {
          thumb(ui, sc, 70, 120, 1, girl(), 0.52);
          icon(ui, sc, 70, 18, C.ICON.coin, 0.2);
          thumb(ui, sc, 200, 120, 5, girl(), 0.52);
          var st = icon(ui, sc, 186, 18, C.ICON.star, 0.2), cn = icon(ui, sc, 214, 18, C.ICON.coin, 0.2);
          tw(ui, move, { targets: [st, cn], scale: { from: 0.2, to: 0.25 }, duration: 380, yoyo: true, repeat: -1 });
          words(ui, sc, 136, 70, 'or', 13, '#6a4a2a');
        },
      },
      {
        text: 'Wear a look anywhere. Change it any time from the pause menu, under Looks.',
        draw: function (ui, sc, move) {
          var a = thumb(ui, sc, 96, 120, 0, girl(), 0.55), b = thumb(ui, sc, 176, 120, 3, girl(), 0.55);
          if (move) { b.setAlpha(0); ui.tweens.add({ targets: b, alpha: 1, duration: 300, delay: 500, hold: 1200, yoyo: true, repeat: -1, repeatDelay: 500 }); ui.tweens.add({ targets: a, alpha: 0.25, duration: 300, delay: 500, hold: 1200, yoyo: true, repeat: -1, repeatDelay: 500 }); }
          icon(ui, sc, 136, 62, C.ICON.ribbon, 0.22);
        },
      },
      {
        text: 'Friends see your look when they visit, and when you play together.',
        draw: function (ui, sc, move) {
          thumb(ui, sc, 96, 120, 6, false, 0.52);
          thumb(ui, sc, 176, 120, 7, true, 0.52);
          var h = icon(ui, sc, 136, 40, C.ICON.heart, 0.22);
          tw(ui, move, { targets: h, y: 30, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
    ],
  };
  F.TOURS.event = {
    title: "TODAY'S EVENT",
    steps: [
      {
        text: 'Every day of the week has a small bonus, like Fish Monday or Timber Tuesday.',
        draw: function (ui, sc, move) {
          var cal = icon(ui, sc, 136, 50, C.ICON.calendar, 0.36);
          tw(ui, move, { targets: cal, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1 });
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d, i) { words(ui, sc, 34 + i * 34, 108, d, 11, i === 1 ? '#a8740c' : '#6a4a2a'); });
        },
      },
      {
        text: 'The small round badge on the left shows today’s. Tap it to read what it does.',
        draw: function (ui, sc, move) {
          var ring = ui.add.circle(70, 66, 22, 0xfff3cf).setStrokeStyle(2, 0xc9a26b);
          sc.add(ring);
          var ic = icon(ui, sc, 70, 66, C.ICON.lumber != null ? C.ICON.lumber : C.ICON.calendar, 0.2);
          tw(ui, move, { targets: [ring, ic], scale: '*=1.12', duration: 420, yoyo: true, repeat: -1 });
          words(ui, sc, 176, 66, 'Timber Tuesday', 13);
        },
      },
      {
        text: 'A new bonus comes at midnight, the same day for every farm.',
        draw: function (ui, sc, move) {
          words(ui, sc, 100, 66, '12:00 AM', 15);
          var b = icon(ui, sc, 186, 66, C.ICON.sparkle, 0.3);
          tw(ui, move, { targets: b, angle: 360, duration: 2400, repeat: -1 });
        },
      },
    ],
  };
  F.TOURS.rare = {
    title: 'RARE SURPRISES',
    steps: [
      {
        text: 'Now and then a rock in the Mine sparkles. Break it for something extra.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 136, 76, C.ITEMS.ore_gold.icon, 0.42);
          [[96, 40], [176, 46], [120, 104], [166, 100]].forEach(function (p, i) {
            var s = icon(ui, sc, p[0], p[1], C.ICON.sparkle, 0.16);
            tw(ui, move, { targets: s, alpha: { from: 1, to: 0.15 }, scale: { from: 0.16, to: 0.22 }, duration: 420, delay: i * 160, yoyo: true, repeat: -1 });
          });
        },
      },
      {
        text: 'A golden crop glows on your farm. Pick it for bonus Gold.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 110, 76, C.ICON.turnip, 0.42).setTint(0xffd75a);
          var coin = icon(ui, sc, 186, 76, C.ICON.coin, 0.3);
          tw(ui, move, { targets: coin, y: 56, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'They are rare, so keep your eyes open. A friend may hear about yours!',
        draw: function (ui, sc, move) {
          var s = icon(ui, sc, 136, 66, C.ICON.sparkle, 0.4);
          tw(ui, move, { targets: s, angle: 360, duration: 2000, repeat: -1 });
        },
      },
    ],
  };
  F.TOURS.mine = {
    title: 'THE DEEP MINE',
    steps: [
      {
        text: 'Past floor 200 the caves change, with new ores and gems to find.',
        draw: function (ui, sc, move) {
          [C.ITEMS.ore_copper.icon, C.ITEMS.ore_silver.icon, C.ITEMS.ore_gold.icon, C.ICON.gem].forEach(function (f, i) {
            var im = icon(ui, sc, 46 + i * 60, 70, f, 0.3);
            tw(ui, move, { targets: im, y: 60, duration: 400, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Each new cave you reach adds 10 to your energy bar, for good.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 100, 66, C.ICON.bolt, 0.4);
          var t = words(ui, sc, 176, 66, '+10', 22, '#3f7a2a');
          tw(ui, move, { targets: t, y: 52, alpha: { from: 0.3, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'The lift by the ladder takes you straight back to the deepest cave you found.',
        draw: function (ui, sc, move) {
          var rope = ui.add.rectangle(136, 0, 3, 40, 0x5a3a1e).setOrigin(0.5, 0);
          var cage = ui.add.container(136, 60);
          cage.add([ui.add.rectangle(0, 0, 54, 60, 0xc9a26b).setStrokeStyle(3, 0x5a3a1e), ui.add.rectangle(-13, 0, 2, 52, 0x5a3a1e), ui.add.rectangle(13, 0, 2, 52, 0x5a3a1e),
            ui.add.rectangle(0, -6, 50, 2, 0x5a3a1e), ui.add.image(0, 12, 'items', C.ICON.gem).setScale(0.16)]);
          sc.add([rope, cage]);
          var low = 92;
          tw(ui, move, { targets: cage, y: low, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', onUpdate: function () { rope.height = cage.y - 30; } });
          rope.height = 30;
          words(ui, sc, 220, 30, 'LIFT', 13, '#5a3a1e');
        },
      },
    ],
  };

  // ---------- when each opens ----------
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  // when nothing else is up: no panel, no trip between maps
  var whenFree = function (w, fn, tries) {
    tries = tries || 0;
    if (!w.sys || !w.sys.isActive() || tries > 40) return;
    if (w.busy || !F.ui || F.ui.modals.length || document.getElementById('farm-ask')) return w.time.delayedCall(1500, function () { whenFree(w, fn, tries + 1); });
    fn();
  };

  U.tailorTour = function (then) {
    if (!take('tailor_tour')) return false;
    this.tour('tailor', then);
    return true;
  };
  var openEvent = U.openEvent;
  U.openEvent = function () {
    var self = this;
    if (take('event_tour')) return this.tour('event', function () { openEvent.call(self); });
    return openEvent.call(this);
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this, s = F.session && F.session.state;
    if (!s || (this.state && this.state.isVisit) || quiet()) return;
    if (this.mapKey === 'mine' && L.mineBand(F.session.mineFloor) && !L.tipSeen(s, 'mine_tour')) {
      this.time.delayedCall(1800, function () { whenFree(self, function () { if (take('mine_tour')) F.ui.tour('mine'); }); });
    }
    if ((this.mapKey === 'mine' || this.mapKey === 'farm') && !L.tipSeen(s, 'rare_tour')) {
      this.time.delayedCall(2500, function () {
        var near = (self.sparks && Object.keys(self.sparks).length) || (self.goldFx && Object.keys(self.goldFx).some(function (k) { return self.goldFx[k]; }));
        if (near) whenFree(self, function () { if (take('rare_tour')) F.ui.tour('rare'); });
      });
    }
  };
})(window.Farm = window.Farm || {});
