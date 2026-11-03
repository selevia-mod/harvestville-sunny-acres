// First-time tours for hunting together (owner, 4 Oct 2026: every feature gets one; the card: 19ze-tours.js). Your dog
// the first time you go into the Wild Lands after the Wild Lands' own welcome; Hunting together on a later trip, when
// you are online (one tour a trip); Hunter's gear the first time you open Kanor's Buy tab with a Bow. Each shows once
// (s.tips / s.tq, 01-logicL.js) and again from What's new (Show me).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var O = F.Online;
  var K = F.UI_CONST, INK = K.INK;
  var DOG = C.DOG;

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var dog = function (ui, sc, x, y, k, flip, scale) {
    F.ensureTexture(ui, 'animals');
    var d = ui.add.image(x, y, 'animals', DOG.frame0 + k).setOrigin(0.5, 0.92).setScale(scale || 0.34).setFlipX(!!flip);
    sc.add(d);
    return d;
  };
  var farmer = function (ui, sc, x, y, frame, scale) {
    var key = F.ensureTexture(ui, F.session && F.session.state.look === 'girl' ? 'player_girl' : 'player');
    var p = ui.add.image(x, y, key, frame || 0).setOrigin(0.5, 1).setScale(scale || 0.3);
    sc.add(p);
    return p;
  };

  F.TOURS.hunt_dog = {
    title: 'YOUR DOG COMES HUNTING',
    steps: [
      {
        text: 'Your farm dog follows you in the Wild Lands, and sits when you stop.',
        draw: function (ui, sc, move) {
          var p = farmer(ui, sc, 150, 122, 6), d = dog(ui, sc, 96, 120, 7, true);
          tw(ui, move, { targets: [p, d], x: '+=40', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'It stops and barks at an animal hiding in the grass. Walk the way it points.',
        draw: function (ui, sc, move) {
          dog(ui, sc, 90, 118, 6, true);
          var m = icon(ui, sc, 90, 44, C.ICON.exclaim, 0.26);
          tw(ui, move, { targets: m, y: 36, duration: 300, yoyo: true, repeat: -1 });
          var g = icon(ui, sc, 210, 96, C.ICON.feather_labuyo != null ? C.ICON.feather_labuyo : C.ICON.bow, 0.26).setAlpha(0.55);
          tw(ui, move, { targets: g, alpha: 0.95, duration: 700, yoyo: true, repeat: -1 });
          words(ui, sc, 150, 66, '>>', 18, '#a8740c');
        },
      },
      {
        text: 'It fetches what a hunt leaves on the ground a little way off, and brings it to your bag.',
        draw: function (ui, sc, move) {
          var meat = icon(ui, sc, 210, 104, C.ICON.meat_boar != null ? C.ICON.meat_boar : C.ICON.bait, 0.24);
          var d = dog(ui, sc, 196, 120, 11, false);
          farmer(ui, sc, 60, 124, 0);
          tw(ui, move, { targets: [d, meat], x: '-=110', duration: 1200, yoyo: true, repeat: -1, hold: 300, ease: 'Sine.inOut' });
        },
      },
    ],
  };

  F.TOURS.hunt_together = {
    title: 'HUNTING TOGETHER',
    steps: [
      {
        text: 'Hunting now shows who is out hunting. Tap Join to hunt with them. Find it under Online, Friends.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 66, C.ICON.bow, 0.36);
          words(ui, sc, 170, 50, 'Hunting now', 14);
          var j = words(ui, sc, 170, 82, 'Join', 15, '#2f5a22');
          tw(ui, move, { targets: j, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'The Great Mammoth only comes out for two or more. A partner is just a tap away.',
        draw: function (ui, sc, move) {
          var a = farmer(ui, sc, 100, 124, 0), b = farmer(ui, sc, 172, 124, 0);
          icon(ui, sc, 136, 30, C.ICON.great_tusk != null ? C.ICON.great_tusk : C.ICON.tusk, 0.28);
          tw(ui, move, { targets: [a, b], y: 118, duration: 380, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Hunted with someone new? You can add them as a friend right after.',
        draw: function (ui, sc, move) {
          var h = icon(ui, sc, 136, 60, C.ICON.heart, 0.34);
          tw(ui, move, { targets: h, scale: 0.4, duration: 400, yoyo: true, repeat: -1 });
          words(ui, sc, 136, 110, 'Add friend', 14, '#2f5a22');
        },
      },
      {
        text: 'Each hunt counts for the Biggest catch of the week. See it under Online, Ranks.',
        draw: function (ui, sc, move) {
          var r = icon(ui, sc, 80, 66, C.ICON.ribbon, 0.36);
          tw(ui, move, { targets: r, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1 });
          words(ui, sc, 180, 50, '#1  121.4 kg', 14, '#a8740c');
          words(ui, sc, 180, 82, '#2  110.2 kg', 13);
        },
      },
    ],
  };

  F.TOURS.gear = {
    title: "HUNTER'S GEAR",
    steps: [
      {
        text: 'Kanor sells three pieces of gear, once each. They are always on when you hunt.',
        draw: function (ui, sc, move) {
          C.GEAR.forEach(function (g, n) {
            var i = icon(ui, sc, 66 + n * 70, 66, g.icon, 0.36);
            tw(ui, move, { targets: i, y: 58, duration: 420, delay: n * 160, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'The Camo Cloak lets you get closer before animals notice. The Quiet Boots let you sneak at a quicker walk.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 56, 66, C.GEAR[0].icon, 0.3);
          icon(ui, sc, 216, 66, C.GEAR[1].icon, 0.3);
          var p = farmer(ui, sc, 112, 124, 6, 0.28);
          tw(ui, move, { targets: p, x: 150, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'With the Big Quiver, a missed arrow often comes back to you.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 66, C.GEAR[2].icon, 0.34);
          var a = icon(ui, sc, 210, 80, C.ICON.arrows, 0.24);
          tw(ui, move, { targets: a, x: 110, y: 60, angle: 360, duration: 900, repeat: -1, repeatDelay: 500, ease: 'Quad.inOut' });
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
  var whenFree = function (w, fn, tries) {
    tries = tries || 0;
    if (!w.sys || !w.sys.isActive() || tries > 40) return;
    if (w.busy || !F.ui || F.ui.modals.length || document.getElementById('farm-ask')) return w.time.delayedCall(1500, function () { whenFree(w, fn, tries + 1); });
    fn();
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this, s = F.session && F.session.state;
    // (not on the trip the Wild Lands' welcome shows: that is this trip's card)
    if (!s || !this.wild || (this.state && this.state.isVisit) || quiet() || !L.tipSeen(s, 'wild')) return;
    this.time.delayedCall(2800, function () {
      whenFree(self, function () {
        if (!L.tipSeen(s, 'hunt_dog_tour')) { if (take('hunt_dog_tour')) F.ui.tour('hunt_dog'); return; }
        if (O && O.on && !O.huntOff && take('hunt_together_tour')) F.ui.tour('hunt_together');
      });
    });
  };
  var openKanor = U.openKanor;
  U.openKanor = function (tab, page) {
    var self = this, s = F.session && F.session.state;
    if (tab === 'buy' && s && L.hasBow(s) && !L.tipSeen(s, 'gear_tour') && take('gear_tour')) return this.tour('gear', function () { openKanor.call(self, tab, page); });
    return openKanor.call(this, tab, page);
  };
})(window.Farm = window.Farm || {});
