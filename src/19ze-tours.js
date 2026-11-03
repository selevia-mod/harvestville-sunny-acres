// First-time tours (owner, 4 Oct 2026: every new feature ships a short animated how-to, shown once): a centred card
// over the dim, a small moving picture, one line under it, and Skip / Next / Got it. Each shows once per farm (a bit in
// s.tips, 01-logicJ.js) and again from What's new (Show me, 19s-news.js). With Reduce Motion on, the pictures stand
// still. The Back Fields tour opens the first time you walk up to the new land; the Town Goal one the first time you
// open the Town tab, before the tab itself.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var D = F.UI_DRAW;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var T = C.TILE;
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  var SW = 272, SH = 132, CARD_H = 322;
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var still = function () {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };

  // ---------- pieces of the pictures (all baked once: the UI never keeps live Graphics) ----------
  var icon = function (ui, sc, x, y, frame, scale) {
    var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3);
    sc.add(i);
    return i;
  };
  var words = function (ui, sc, x, y, str, size, color) {
    var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5);
    sc.add(t);
    return t;
  };
  var pic = function (ui, sc, x, y, key, w, h, draw) { return ui.canvasImg(sc, x, y, key, w, h, draw); };
  var ground = function (fill, rows) {
    return function (w, h) {
      return function (g) {
        D.rrect(g, 0, 0, w, h, 6);
        g.fillStyle = fill;
        g.fill();
        if (!rows) return;
        g.fillStyle = 'rgba(60,30,10,0.25)';
        for (var y = 8; y < h - 4; y += 10) g.fillRect(5, y, w - 10, 3);
      };
    };
  };
  var soil = ground('#9a6a3c', true), grass = ground('#8fc46a', false);
  var fence = function (w, h) {
    return function (g) {
      g.strokeStyle = '#8a5a32';
      g.lineWidth = 3;
      g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#5a3a1e';
      [[1, 1], [w - 7, 1], [1, h - 7], [w - 7, h - 7]].forEach(function (p) { g.fillRect(p[0], p[1], 6, 6); });
    };
  };
  var tree = function (g) {
    g.fillStyle = '#6b4424';
    g.fillRect(8, 16, 4, 10);
    D.circle(g, 10, 11, 10);
    g.fillStyle = '#3f8a3a';
    g.fill();
  };
  var arrow = function (g) {
    g.fillStyle = '#fff3c8';
    g.strokeStyle = '#5a3a1e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(2, 6); g.lineTo(18, 6); g.lineTo(18, 1); g.lineTo(29, 9); g.lineTo(18, 17); g.lineTo(18, 12); g.lineTo(2, 12);
    g.closePath();
    g.fill();
    g.stroke();
  };
  var sign = function (g) {
    g.fillStyle = '#6b4424';
    g.fillRect(36, 34, 8, 34);
    D.rrect(g, 2, 4, 76, 36, 6);
    g.fillStyle = '#c98c4a';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#5a3a1e';
    g.stroke();
    g.fillStyle = '#3d2614';
    g.font = 'bold 15px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FOR SALE', 40, 23);
  };
  var ring = function (g) {
    D.circle(g, 32, 32, 29);
    g.fillStyle = 'rgba(36,22,11,0.75)';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#ffd23f';
    g.stroke();
  };
  var ripple = function (g) {
    D.circle(g, 32, 32, 28);
    g.lineWidth = 3;
    g.strokeStyle = '#ffffff';
    g.stroke();
  };
  var tag = function (g) {
    D.rrect(g, 0, 0, 78, 30, 8);
    g.fillStyle = '#fff3cf';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#c9a26b';
    g.stroke();
  };
  var bar = function (g) {
    D.rrect(g, 0, 0, 200, 22, 11);
    g.fillStyle = '#5a3a1e';
    g.fill();
    D.rrect(g, 3, 3, 194, 16, 8);
    g.fillStyle = '#e8cf98';
    g.fill();
  };
  var crown = function (g) {
    var pts = [[6, 40], [2, 14], [16, 26], [28, 6], [40, 26], [54, 14], [50, 40]];
    g.beginPath();
    pts.forEach(function (p, i) { g[i ? 'lineTo' : 'moveTo'](p[0], p[1]); });
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 4;
    g.strokeStyle = '#5a3a1e';
    g.stroke();
    var gr = g.createLinearGradient(0, 6, 0, 40);
    gr.addColorStop(0, '#ffe680');
    gr.addColorStop(1, '#e9a91c');
    g.fillStyle = gr;
    g.fill();
    g.fillStyle = '#c0503a';
    D.circle(g, 28, 30, 4);
    g.fill();
  };
  var farmRow = function (g) {
    D.rrect(g, 0, 0, 150, 26, 7);
    g.fillStyle = '#e8cf98';
    g.fill();
  };

  // A tween only when things may move.
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };

  // ---------- the tours ----------
  var TOURS = {
    land: {
      title: 'THE BACK FIELDS',
      steps: [
        {
          text: 'Six new blocks of land wait past the trees, east of your field.',
          draw: function (ui, sc, move) {
            pic(ui, sc, 12, 36, 'ui-tour-myfield', 76, 62, soil(76, 62));
            [[30, 56], [52, 56], [30, 78], [52, 78]].forEach(function (p) { icon(ui, sc, p[0] + 6, p[1], C.ICON.turnip, 0.16); });
            [10, 52, 94].forEach(function (y) { pic(ui, sc, 100, y, 'ui-tour-tree', 20, 26, tree); });
            var blocks = [[140, 90], [140, 48], [140, 6], [196, 90], [196, 48], [196, 6]]; // nearest the way in first
            blocks.forEach(function (b, i) {
              pic(ui, sc, b[0], b[1], 'ui-tour-grass38', 38, 38, grass(38, 38));
              var f = pic(ui, sc, b[0], b[1], 'ui-tour-fence38', 38, 38, fence(38, 38));
              tw(ui, move, { targets: f, alpha: { from: 1, to: 0.45 }, duration: 600, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            });
            var coin = icon(ui, sc, 159, 90, C.ICON.coin, 0.2);
            tw(ui, move, { targets: coin, y: 80, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            var a = pic(ui, sc, 86, 106, 'ui-tour-arrow', 30, 18, arrow);
            tw(ui, move, { targets: a, x: { from: 70, to: 106 }, alpha: { from: 0, to: 1 }, duration: 900, repeat: -1, repeatDelay: 300, ease: 'Quad.out' });
          },
        },
        {
          text: 'Walk up to the For Sale sign with a coin over it, then tap For sale.',
          draw: function (ui, sc, move) {
            pic(ui, sc, 28, 40, 'ui-tour-sign', 80, 70, sign);
            var coin = icon(ui, sc, 68, 26, C.ICON.coin, 0.24);
            tw(ui, move, { targets: coin, y: 14, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            pic(ui, sc, 168, 24, 'ui-tour-ring', 64, 64, ring);
            icon(ui, sc, 200, 50, C.ICON.coin, 0.22);
            words(ui, sc, 200, 70, 'For sale', 11, '#fff3c8');
            words(ui, sc, 200, 104, 'tap', 12);
            var rp = pic(ui, sc, 168, 24, 'ui-tour-ripple', 64, 64, ripple);
            rp.setAlpha(0);
            tw(ui, move, { targets: rp, alpha: { from: 0.9, to: 0 }, scale: { from: rp.scale, to: rp.scale * 1.35 }, x: { from: 168, to: 157 }, y: { from: 24, to: 13 }, duration: 900, repeat: -1, repeatDelay: 300, ease: 'Quad.out' });
          },
        },
        {
          text: 'They sell one at a time, nearest first. Each costs twice the last.',
          draw: function (ui, sc, move) {
            C.LAND.prices.forEach(function (p, i) {
              var x = 10 + (i % 3) * 88, y = 22 + Math.floor(i / 3) * 52;
              var t = pic(ui, sc, x, y, 'ui-tour-tag', 78, 30, tag);
              var w = words(ui, sc, x + 39, y + 15, fmt(p) + 'G', 13);
              if (!move) return;
              t.setAlpha(0);
              w.setAlpha(0);
              ui.tweens.add({ targets: [t, w], alpha: 1, duration: 250, delay: i * 350, hold: 2600 - i * 350, repeatDelay: 400, yoyo: true, repeat: -1 });
            });
          },
        },
        {
          text: 'Land you buy loses its fence and turns into field. Till it, plant it or decorate it.',
          draw: function (ui, sc, move) {
            pic(ui, sc, 20, 18, 'ui-tour-soil96', 96, 96, soil(96, 96));
            var crops = [[44, 44], [68, 44], [92, 44], [44, 70], [68, 70], [92, 70], [44, 96], [68, 96], [92, 96]].map(function (p) { return icon(ui, sc, p[0], p[1], C.ICON.turnip, 0.17); });
            var cover = pic(ui, sc, 20, 18, 'ui-tour-grass96', 96, 96, grass(96, 96));
            var f = pic(ui, sc, 20, 18, 'ui-tour-fence96', 96, 96, fence(96, 96));
            if (move) {
              crops.forEach(function (c) { c.setScale(0); });
              ui.tweens.add({ targets: [cover, f], alpha: { from: 1, to: 0 }, duration: 500, delay: 500, hold: 2400, yoyo: true, repeat: -1, repeatDelay: 500 });
              ui.tweens.add({ targets: crops, scale: { from: 0, to: 0.17 }, duration: 260, delay: ui.tweens.stagger(90, { start: 1100 }), hold: 1600, yoyo: true, repeat: -1, repeatDelay: 1100, ease: 'Back.out' });
            } else {
              cover.setAlpha(0);
              f.setAlpha(0);
            }
            [['Till', C.ICON.hoe], ['Plant', C.ICON.turnip], ['Decorate', C.ICON.sparkle]].forEach(function (r, i) {
              icon(ui, sc, 160, 34 + i * 34, r[1], 0.22);
              sc.add(ui.txt(180, 34 + i * 34, r[0], 13, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5));
            });
          },
        },
      ],
    },
    town: {
      title: 'TOWN GOAL',
      steps: [
        {
          text: 'Each week all farms work together on one Town Goal, like crops or ore.',
          draw: function (ui, sc, move) {
            icon(ui, sc, 100, 28, C.ICON.turnip, 0.26);
            icon(ui, sc, 136, 28, C.ITEMS.ore_gold.icon, 0.26);
            icon(ui, sc, 172, 28, C.ICON.ribbon, 0.26);
            pic(ui, sc, 36, 58, 'ui-tour-bar', 200, 22, bar);
            var fill = ui.add.rectangle(40, 69, 192, 14, GREEN).setOrigin(0, 0.5);
            sc.add(fill);
            fill.scaleX = 0.7;
            tw(ui, move, { targets: fill, scaleX: { from: 0.05, to: 0.7 }, duration: 1800, hold: 900, repeat: -1, repeatDelay: 300, ease: 'Sine.out' });
            words(ui, sc, 136, 102, 'the whole town, together', 12, '#6a4a2a');
          },
        },
        {
          text: 'Open Online, then the Town tab. Give from your bag with the Give button.',
          draw: function (ui, sc, move) {
            icon(ui, sc, 46, 60, C.ICON.bag, 0.4);
            pic(ui, sc, 150, 30, 'ui-tour-bar100', 100, 22, function (g) {
              D.rrect(g, 0, 0, 100, 22, 11);
              g.fillStyle = '#5a3a1e';
              g.fill();
              D.rrect(g, 3, 3, 60, 16, 8);
              g.fillStyle = '#5fa84a';
              g.fill();
            });
            var flying = icon(ui, sc, 46, 60, C.ICON.turnip, 0.22);
            if (move) {
              flying.setAlpha(0);
              ui.tweens.add({ targets: flying, x: { from: 60, to: 200 }, y: { from: 56, to: 41 }, alpha: { from: 1, to: 0.2 }, duration: 800, repeat: -1, repeatDelay: 600, ease: 'Quad.in' });
            }
            var b = ui.button(sc, 200, 100, 100, 32, 'Give 10', function () {}, GREEN);
            tw(ui, move, { targets: b, scale: { from: 1, to: 0.92 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 800 });
          },
        },
        {
          text: 'Give enough this week, and when the town reaches its goal, all who gave share the prize.',
          draw: function (ui, sc, move) {
            var g = icon(ui, sc, 136, 64, C.ICON.gift, 0.42);
            tw(ui, move, { targets: g, y: 56, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            var gold = words(ui, sc, 54, 64, '+' + fmt(C.TOWN.maxGold) + 'G', 15, '#a8740c');
            var sun = words(ui, sc, 222, 64, '+' + C.TOWN.maxStars + (C.TOWN.maxStars > 1 ? ' Sunbeams' : ' Sunbeam'), 15, '#a8740c');
            if (move) ui.tweens.add({ targets: [gold, sun], y: { from: 74, to: 50 }, alpha: { from: 0, to: 1 }, duration: 700, hold: 1200, repeat: -1, repeatDelay: 400, ease: 'Quad.out' });
          },
        },
        {
          text: 'The most liked farm each week wins Best Farm of the Week and a crown. Weeks end Sunday midnight.',
          draw: function (ui, sc, move) {
            [0, 1, 2].forEach(function (i) {
              var y = 40 + i * 32;
              pic(ui, sc, 70, y, 'ui-tour-row', 150, 26, farmRow);
              sc.add(ui.txt(82, y + 13, ['Farm one', 'Farm two', 'Farm three'][i], 12, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5));
              icon(ui, sc, 190, y + 13, C.ICON.heart, 0.14);
              words(ui, sc, 208, y + 13, String([24, 17, 9][i]), 12);
            });
            var cr = pic(ui, sc, 30, 30, 'ui-tour-crown', 56, 46, crown);
            cr.setScale(cr.scale * 0.7);
            tw(ui, move, { targets: cr, y: { from: 30, to: 22 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          },
        },
      ],
    },
  };
  F.TOURS = TOURS;

  // ---------- the card ----------
  // Shows tour `name`; done() runs after Got it, Skip or Back.
  U.tour = function (name, done) {
    var tour = TOURS[name];
    if (!tour) return done && done();
    var self = this, step = 0, move = !still(), ended = false;
    var sc, cap, dots = [], btns;
    var finish = function () {
      if (ended) return;
      ended = true;
      self.tweens.killTweensOf(sc.list);
      self.closeModal();
      if (done) done();
    };
    var c = this.openModal(finish);
    var h = CARD_H, y0 = Math.round(Math.max(84, (H - h) / 2 - 30)), sx = Math.round((W - SW) / 2), sy = y0 + 32;
    this.panelImg(c, 24, y0, W - 48, h);
    var title = this.txt(W / 2, y0 + 4, tour.title, 16, '#ffe9a8', { fontStyle: 'bold', align: 'center', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, Math.min(W - 40, Math.max(170, title.width + 44)));
    c.add(title);
    this.canvasImg(c, sx, sy, 'ui-tour-stage', SW, SH, function (g) {
      D.rrect(g, 0, 0, SW, SH, 10);
      g.fillStyle = D.vgrad(g, 0, SH, '#dff0c4', '#bcdc98');
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#c9a26b';
      g.stroke();
    });
    sc = this.add.container(sx, sy);
    c.add(sc);
    cap = this.txt(W / 2, sy + SH + 14, '', 15, INK, { align: 'center', wordWrap: { width: 268 }, lineSpacing: 3 }).setOrigin(0.5, 0);
    c.add(cap);
    var n = tour.steps.length, dy = y0 + h - 76;
    for (var i = 0; i < n; i++) {
      var d = this.baked(c, W / 2 + (i - (n - 1) / 2) * 16 - 4, dy, 'ui-tour-dot', 8, 8, function (g) { g.fillStyle(0x8a5a32, 1).fillCircle(4, 4, 4); });
      dots.push(d);
    }
    btns = this.add.container(0, 0);
    c.add(btns);

    var show = function () {
      self.tweens.killTweensOf(sc.list);
      sc.removeAll(true);
      var st = tour.steps[step];
      st.draw(self, sc, move);
      cap.setText(st.text);
      dots.forEach(function (d, k) { d.setAlpha(k === step ? 1 : 0.3); });
      btns.removeAll(true);
      var by = y0 + h - 40;
      if (step === n - 1) {
        self.button(btns, W / 2, by, 150, 42, 'Got it', finish, GREEN);
      } else {
        self.button(btns, W / 2 - 67, by, 120, 42, 'Skip', finish, GREY);
        self.button(btns, W / 2 + 67, by, 120, 42, 'Next', function () { step++; show(); }, GREEN);
      }
      if (!move) return;
      sc.setAlpha(0);
      self.tweens.add({ targets: sc, alpha: 1, duration: 180 });
    };
    show();
    // the card pops in, like every dialog
    var parts = c.list.slice(1);
    parts.forEach(function (o) { o.y += 14; });
    this.tweens.add({ targets: parts, y: '-=14', duration: 220, ease: 'Back.out' });
    return c;
  };

  // Marks a tour shown and saves; false when it was shown already, on a visit, or there is no farm yet.
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || (window.gameHost && window.gameHost.quiet)) return false; // (quiet: the tests)
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };

  // ---------- the Back Fields: the first time you walk up to the new land ----------
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (this.mapKey !== 'farm' || this.state.isVisit || L.tipSeen(F.session.state, 'land_tour')) return;
    var self = this, near = (C.LAND.x0 - 4) * T;
    var check = this.time.addEvent({
      delay: 700, loop: true, callback: function () {
        if (!self.player || self.feet().x < near) return;
        if (self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return;
        if (L.tipSeen(F.session.state, 'land_tour')) return check.remove();
        if (!take('land_tour')) return;
        check.remove();
        F.ui.tour('land');
      },
    });
  };

  // ---------- the Town Goal: the first time the Town tab opens, before the tab ----------
  var openTown = U.openTown;
  U.openTown = function (page, then) {
    var self = this;
    if (!(F.Online.town || F.Online.best) || !take('town_tour')) return openTown.call(this, page, then);
    this.tour('town', function () { self.openOnline('town', page, then); });
  };
})(window.Farm = window.Farm || {});
