// First-time tours for farm tech (owner, 4 Oct 2026: every feature gets one; the card: 19ze-tours.js). Sprinklers the
// first time you open Bram's Forge; Silver and Gold crops the first time you open Lily's Seed Stand (or pick your first
// Silver or Gold crop); the greenhouse the first time you open Mira's Outdoor page. Each shows once (s.tips / s.tq,
// 01-logicL.js) and again from What's new (Show me). (This file loads before 19zz-farmtech.js: after a tour it opens
// the panel through this.openForge, the whole chain, so the Forge still gets its sprinklers.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, INK = K.INK;
  var GH = C.OUTDOOR.index.greenhouse;

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var star = function (ui, sc, x, y, q, scale) { var i = ui.add.image(x, y, ui.ftStarTex(q)).setScale((scale || 1.4) / F.R); sc.add(i); return i; };
  // a square of tilled soil (wet: darker), 26 px
  var soil = function (ui, sc, x, y, wet) {
    return ui.canvasImg(sc, x - 13, y - 13, 'ft-tour-soil' + (wet ? 'w' : ''), 26, 26, function (g) {
      g.fillStyle = wet ? '#5a3a20' : '#9a6a3c';
      g.fillRect(1, 1, 24, 24);
      g.fillStyle = 'rgba(40,20,8,0.25)';
      for (var k = 5; k < 24; k += 7) g.fillRect(3, k, 20, 2);
    });
  };
  var grid = function (ui, sc, cx, cy, n, gap, wet) {
    var out = [];
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var dx = x - (n - 1) / 2, dy = y - (n - 1) / 2;
      out.push({ dx: dx, dy: dy, img: soil(ui, sc, cx + dx * gap, cy + dy * gap, wet && wet(dx, dy)) });
    }
    return out;
  };

  F.TOURS.sprinkler = {
    title: 'SPRINKLERS',
    steps: [
      {
        text: 'Bram makes Copper, Silver and Gold Sprinklers at the Forge, from gold and ore.',
        draw: function (ui, sc, move) {
          C.SPRINKLERS.forEach(function (sp, n) {
            var i = icon(ui, sc, 66 + n * 70, 66, C.ITEMS[sp.id].icon, 0.36);
            tw(ui, move, { targets: i, y: 58, duration: 420, delay: n * 160, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Place one on tilled soil. The tiles around it stay watered, so seeds there grow at once.',
        draw: function (ui, sc, move) {
          var cells = grid(ui, sc, 136, 66, 3, 30);
          cells.forEach(function (c) {
            if (!c.dx && !c.dy) return;
            var wet = soil(ui, sc, 136 + c.dx * 30, 66 + c.dy * 30, true).setAlpha(move ? 0 : 1);
            tw(ui, move, { targets: wet, alpha: 1, duration: 500, delay: 500 + (Math.abs(c.dx) + Math.abs(c.dy)) * 180, hold: 1200, yoyo: true, repeat: -1, repeatDelay: 300 });
          });
          var sp = icon(ui, sc, 136, 62, C.ITEMS.sprinkler_silver.icon, 0.24);
          tw(ui, move, { targets: sp, angle: { from: -6, to: 6 }, duration: 300, yoyo: true, repeat: -1 });
          icon(ui, sc, 226, 66, C.ICON.drop, 0.28);
        },
      },
      {
        text: 'Copper waters the 4 beside it, Silver the 8 around it, Gold a 5x5. Tap one to pick it up again.',
        draw: function (ui, sc, move) {
          [['plus', 50], ['ring', 136], ['big', 222]].forEach(function (r, n) {
            var gap = n === 2 ? 14 : 18, size = n === 2 ? 5 : 3, cells = grid(ui, sc, r[1], 60, size, gap, function (dx, dy) {
              var ax = Math.abs(dx), ay = Math.abs(dy);
              return r[0] === 'big' || (r[0] === 'ring') || ax + ay <= 1;
            });
            cells.forEach(function (c) { c.img.setScale((n === 2 ? 0.5 : 0.65) / F.R); c.img.x = r[1] + c.dx * gap - (n === 2 ? 6.5 : 8.5); c.img.y = 60 + c.dy * gap - (n === 2 ? 6.5 : 8.5); });
            var i = icon(ui, sc, r[1], 58, C.ITEMS[C.SPRINKLERS[n].id].icon, 0.14);
            tw(ui, move, { targets: i, scale: 0.17, duration: 400, delay: n * 200, yoyo: true, repeat: -1 });
            words(ui, sc, r[1], 112, ['4 tiles', '8 tiles', '24 tiles'][n], 12);
          });
        },
      },
    ],
  };

  F.TOURS.quality = {
    title: 'SILVER AND GOLD CROPS',
    steps: [
      {
        text: 'Lily sells Fertilizer. Spread one bag on a 3x3 tilled patch, before you plant or on the seeds.',
        draw: function (ui, sc, move) {
          grid(ui, sc, 150, 70, 3, 30);
          var bag = icon(ui, sc, 60, 60, C.ITEMS.fert.icon, 0.34);
          icon(ui, sc, 236, 60, C.ITEMS.fert_rich.icon, 0.28);
          tw(ui, move, { targets: bag, x: 150, y: 54, duration: 900, yoyo: true, hold: 500, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'Crops picked there come out Silver or Gold more often. A star on the bag slot shows which.',
        draw: function (ui, sc, move) {
          [[70, 0], [136, 1], [202, 2]].forEach(function (p) {
            var i = icon(ui, sc, p[0], 66, C.ITEMS.tomato.icon, 0.34);
            if (p[1]) {
              var st = star(ui, sc, p[0] + 20, 46, p[1], 1.2);
              tw(ui, move, { targets: st, scale: 1.5 / F.R, duration: 400, yoyo: true, repeat: -1, delay: p[1] * 200 });
            }
            words(ui, sc, p[0], 112, ['Normal', 'Silver', 'Gold'][p[1]], 12, p[1] === 2 ? '#a8740c' : INK);
            tw(ui, move, { targets: i, y: 60, duration: 500, yoyo: true, repeat: -1, delay: p[1] * 150 });
          });
        },
      },
      {
        text: 'Silver sells for 1.5 times the price, Gold for 2 times. Your crop stars help a little too.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 60, C.ITEMS.tulip.icon, 0.34);
          star(ui, sc, 90, 42, 2, 1.3);
          words(ui, sc, 170, 46, '34G', 14);
          var g = words(ui, sc, 170, 78, '68G!', 18, '#a8740c');
          tw(ui, move, { targets: g, scale: 1.2, duration: 420, yoyo: true, repeat: -1 });
          icon(ui, sc, 230, 64, C.ICON.coin, 0.28);
        },
      },
    ],
  };

  F.TOURS.greenhouse = {
    title: 'THE GREENHOUSE',
    steps: [
      {
        text: 'Mira sells a Greenhouse under Outdoor, More land. Place it on your farm with Decorate.',
        draw: function (ui, sc, move) {
          var img = F.yardImg(ui, GH), gh = ui.add.image(136, 70, img.key).setDisplaySize(132, 128).setOrigin(0.5);
          sc.add(gh);
          tw(ui, move, { targets: gh, y: 64, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'Inside, any crop grows in any season, and Lily sells you every seed. Summer melons in winter? Yes!',
        draw: function (ui, sc, move) {
          var seasons = C.SEASONS.map(function (s, n) { return icon(ui, sc, 46 + n * 36, 40, s.icon, 0.2); });
          seasons.forEach(function (s, n) { tw(ui, move, { targets: s, alpha: 0.35, duration: 500, delay: n * 250, yoyo: true, repeat: -1 }); });
          var m = icon(ui, sc, 210, 66, C.ITEMS.melon.icon, 0.38);
          icon(ui, sc, 100, 96, C.ITEMS.seed_melon.icon, 0.26);
          tw(ui, move, { targets: m, scale: 0.44, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Its misters water every tile for you, and no weeds come in.',
        draw: function (ui, sc, move) {
          grid(ui, sc, 136, 74, 3, 30, function () { return true; });
          [106, 136, 166].forEach(function (x, n) {
            var d = icon(ui, sc, x, 20, C.ICON.drop, 0.18);
            tw(ui, move, { targets: d, y: 64, alpha: 0, duration: 900, delay: n * 260, repeat: -1 });
          });
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
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this;
    if (take('sprinkler_tour')) return this.tour('sprinkler', function () { self.openForge(page); });
    return openForge.call(this, page);
  };
  var openShop = U.openShop;
  U.openShop = function (tab, page) {
    var self = this;
    if (take('quality_tour')) return this.tour('quality', function () { self.openShop(tab, page); });
    return openShop.call(this, tab, page);
  };
  var openOutdoor = U.openOutdoor;
  U.openOutdoor = function (cat, page) {
    var self = this;
    if (take('greenhouse_tour')) return this.tour('greenhouse', function () { self.openOutdoor(cat, page); });
    return openOutdoor.call(this, cat, page);
  };
  // the first Silver or Gold crop you pick, if you never saw the tour at Lily's
  F.ftQualityFound = function () {
    var ui = F.ui;
    if (!ui || ui.modals.length) return;
    if (take('quality_tour')) ui.time.delayedCall(900, function () { if (!ui.modals.length) ui.tour('quality'); });
  };
})(window.Farm = window.Farm || {});
