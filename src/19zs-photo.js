// Farm photos (owner, 4 Nov 2026: "a picture of your farm and farmer, shared to your Selebox feed"). Share farm (pause
// menu, and Online, Me) opens photo mode instead of taking the screen as it is: the buttons and bars go, a frame with your
// farm's name and the date comes, your farmer can say Hi!, Yay! or show a heart, and Snap sends the picture to the Selebox
// post box (19j-social.js, the app opens it). The game keeps going behind it: animals walk, friends move.
// The UI's own camera is hidden (and takes no taps) while a second camera shows only the photo's frame and its buttons.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var T = C.TILE;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, RED = 0xc0503a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var WORDS = { wave: 'Hi!', yay: 'Yay!' };

  var snapShare = U.shareFarm; // the picture of the screen, to the app (19j-social.js)
  U.shareFarm = function () {
    if (typeof (window.gameHost || {}).share !== 'function') return;
    if (F.session.visit) return this.toast('Go home to take a photo of your own farm.');
    this.photoMode();
  };

  // Your farmer says it, over their head (online, friends here see it too).
  var pose = function (kind) {
    var w = F.world;
    if (!w || !w.player) return;
    if (O && O.on && O.me && O.react) return O.react(kind);
    var at = w.feet();
    sfx('talk');
    if (kind === 'heart') return w.emote({ x: at.x, y: at.y }, C.ICON.heart);
    var t = w.add.text(at.x, at.y - 1.6 * T, WORDS[kind] || 'Hi!', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '84px', fontStyle: 'bold', color: '#fff27a', stroke: '#3d2614', strokeThickness: 15 })
      .setOrigin(0.5, 1).setDepth(F.WorldScene.DEPTH.Above + 3).setScale(1.3);
    w.tweens.add({ targets: t, y: t.y - 60, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: 2 });
    w.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: function () { t.destroy(); } });
  };

  U.photoMode = function () {
    var self = this, s = F.session.state, main = this.cameras.main, VH = C.VIEW_H;
    if (this.photo) return;
    this.closeAll();
    var farm = (O && O.on && O.me && O.me.name) || s.name || 'My farm';
    var frame = this.add.container(0, 0).setDepth(9000), bar = this.add.container(0, 0).setDepth(9001);
    // the frame: a white edge and a strip along the bottom with the farm's name and the date
    var g = this.add.graphics();
    g.lineStyle(6, 0xfff8e6, 1).strokeRect(6, 6, W - 12, VH - 12);
    g.fillStyle(0x24160b, 0.72).fillRoundedRect(18, VH - 70, W - 36, 50, 12);
    frame.add(g);
    frame.add(this.txt(34, VH - 62, L.cleanText(farm, 24) || 'My farm', 17, '#ffe9a8', { fontStyle: 'bold' }));
    frame.add(this.txt(34, VH - 40, L.formatDate(s.day) + ', ' + L.date(s.day).year + '  ·  Harvest Ville on Selebox', 11, '#f3e2b8'));
    frame.add(this.add.image(W - 46, VH - 45, 'items', C.ICON.sunbeam).setScale(0.3));
    // the buttons (not in the picture), over a zone that takes every other tap
    var zone = this.add.zone(W / 2, VH / 2, W, VH).setInteractive();
    bar.add(zone);
    var by = VH - 110;
    this.button(bar, 60, by, 74, 38, 'Hi!', function () { pose('wave'); }, BLUE);
    this.button(bar, 140, by, 74, 38, 'Yay!', function () { pose('yay'); }, BLUE);
    this.button(bar, 220, by, 74, 38, 'Love', function () { pose('heart'); }, BLUE);
    this.button(bar, W - 56, by, 84, 38, 'Snap', function () { snap(); }, GREEN);
    this.button(bar, W - 40, 34, 46, 34, 'X', function () { done(); }, RED);
    bar.add(this.txt(W / 2, 30, 'Farm photo', 15, '#fff8e6', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 4 }).setOrigin(0.5));
    // only these show: a camera of their own, the UI's own hidden
    var cam = this.cameras.add(main.x, main.y, main.width, main.height).setZoom(main.zoom).setScroll(main.scrollX, main.scrollY);
    cam.setOrigin(main.originX, main.originY);
    this.children.list.forEach(function (o) { if (o !== frame && o !== bar) cam.ignore(o); });
    main.setVisible(false);
    main.inputEnabled = false;
    var later = function (o) { if (self.photo && o !== frame && o !== bar && o.parentContainer !== frame && o.parentContainer !== bar && !frame.exists(o) && !bar.exists(o)) cam.ignore(o); };
    this.sys.events.on('addedtoscene', later);
    this.photo = { frame: frame, bar: bar, cam: cam };
    sfx('pick');
    var snap = function () {
      if (!self.photo || self.photo.busy) return;
      self.photo.busy = true;
      bar.setVisible(false);
      sfx('found');
      var flash = self.add.rectangle(W / 2, VH / 2, W, VH, 0xffffff, 0.9).setDepth(9002);
      self.time.delayedCall(60, function () {
        flash.setVisible(false);
        snapShare.call(self); // (after its own 80 ms, the picture, then the app opens the post box)
        self.time.delayedCall(600, function () { flash.destroy(); done(); });
      });
    };
    var done = function () {
      if (!self.photo) return;
      self.sys.events.off('addedtoscene', later);
      self.cameras.remove(cam);
      frame.destroy();
      bar.destroy();
      main.setVisible(true);
      main.inputEnabled = true;
      self.photo = null;
    };
    this.time.delayedCall(500, function () { if (self.photoTour) self.photoTour(); });
  };

  // ---------- its tour, the first time ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  F.TOURS.photo = {
    title: 'FARM PHOTOS',
    steps: [
      {
        text: 'Photo mode hides the buttons and frames your farm with its name and the date.',
        draw: function (ui, sc, move) {
          var r = ui.add.rectangle(136, 66, 200, 110).setStrokeStyle(4, 0xfff8e6);
          sc.add(r);
          words(ui, sc, 136, 100, 'Moon Meadow', 13, '#6a4a2a');
          var sun = icon(ui, sc, 136, 52, C.ICON.sunbeam, 0.3);
          if (move) ui.tweens.add({ targets: sun, angle: 360, duration: 3000, repeat: -1 });
        },
      },
      {
        text: 'Make your farmer say Hi! or Yay!, then tap Snap to post it on your Selebox feed.',
        draw: function (ui, sc, move) {
          var a = words(ui, sc, 90, 66, 'Hi!', 20, '#a8740c'), b = words(ui, sc, 180, 66, 'Snap', 18, '#2f5a22');
          if (move) ui.tweens.add({ targets: [a, b], scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
  U.photoTour = function () {
    var s = F.session && F.session.state;
    if (!s || !this.photo || F.session.visit || L.tipSeen(s, 'photo_tour') || (window.gameHost && window.gameHost.quiet)) return;
    L.takeTip(s, 'photo_tour');
    F.Host.save(s);
    var self = this, bar = this.photo.bar;
    bar.setVisible(false); // (the tour's card over the frame; its buttons back after)
    this.cameras.main.setVisible(true);
    this.cameras.main.inputEnabled = true;
    this.tour('photo', function () {
      if (!self.photo) return;
      self.cameras.main.setVisible(false);
      self.cameras.main.inputEnabled = false;
      bar.setVisible(true);
    });
  };
})(window.Farm = window.Farm || {});
