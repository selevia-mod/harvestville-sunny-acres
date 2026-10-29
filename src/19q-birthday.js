// Your birthday (owner, 29 Oct 2026: "let users add their birthday so we can celebrate it also inside the game").
// Set the month and day (no year) from the Calendar, or when the farm asks once. On the day: Mayor Hollis's letter
// with a cake, villagers wish you a happy birthday, a party hat and confetti, a cake on the calendar, and friends who
// visit your farm see that it is your birthday. Rules in 01-logicB.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var mine = function () { return F.session.state; };
  var today = function () { return L.myBirthdayOn(mine(), mine().day); };

  // ---------- setting it ----------
  U.askBirthday = function (done) {
    var self = this, s = mine(), b = L.birthdayOf(s) || { month: L.date(s.day).month, day: L.date(s.day).day };
    var month = b.month, day = b.day;
    var c = this.openModal(function () { self.closeModal(); if (done) done(); });
    this.panelImg(c, 30, 150, W - 60, 300);
    c.add(this.txt(W / 2, 170, 'Your birthday', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, 200, 'Just the month and day. The town celebrates it with you!', 12, '#7a5a3a', { align: 'center', wordWrap: { width: W - 100 } }).setOrigin(0.5, 0));
    var mText = this.txt(W / 2, 262, '', 18, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    var dText = this.txt(W / 2, 318, '', 26, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    c.add([mText, dText]);
    var draw = function () {
      day = Math.min(day, C.DAYS_IN_MONTH[month - 1]);
      mText.setText(C.MONTHS[month - 1]);
      dText.setText(String(day));
    };
    var step = function (which, by) {
      return function () {
        sfx('tick');
        if (which === 'm') month = ((month - 1 + by + 12) % 12) + 1;
        else { var n = C.DAYS_IN_MONTH[month - 1]; day = ((day - 1 + by + n) % n) + 1; }
        draw();
      };
    };
    this.button(c, 74, 262, 48, 40, '<', step('m', -1), BLUE);
    this.button(c, W - 74, 262, 48, 40, '>', step('m', 1), BLUE);
    this.button(c, 74, 318, 48, 40, '<', step('d', -1), BLUE);
    this.button(c, W - 74, 318, 48, 40, '>', step('d', 1), BLUE);
    draw();
    this.button(c, W / 2 - 66, 404, 116, 42, 'Not now', function () { self.closeModal(); if (done) done(); }, GREY);
    this.button(c, W / 2 + 66, 404, 116, 42, 'Save', function () {
      if (L.setBirthday(s, month, day) !== 'ok') return;
      self.closeModal();
      var party = L.birthdayMail(s); // set on the day itself: the letter comes now
      F.session.dirty = true;
      if (F.world && F.world.save) F.world.save();
      sfx('coin');
      if (party && F.world && F.world.startParty) F.world.startParty(true);
      else self.toast('Your birthday is ' + L.birthdayText(s) + '. It is on the calendar!', 2600, 0x2f5a22);
      if (done) done();
    }, GREEN);
  };

  // A farm without a birthday asks once, when the farm is quiet (after the name).
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this;
    if (!(this.state && this.state.isVisit) && today()) this.time.delayedCall(800, function () { self.startParty(false); });
    if (this.state && this.state.isVisit && this.state.hostBirthday) {
      var v = F.session.visit;
      this.time.delayedCall(1800, function () {
        if (v && F.session.visit === v && F.ui) F.ui.toast('Today is ' + (self.state.hostName || v.name) + "'s birthday! Say happy birthday.", 4200, 0x7a4d12);
      });
    }
    if (this.mapKey !== 'farm' || (this.state && this.state.isVisit) || (window.gameHost && window.gameHost.quiet)) return;
    if (mine().bd) return;
    var ask = function () {
      var s = mine();
      if (!self.sys || !self.sys.isActive() || s.bd) return;
      if (self.busy || !s.name || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return self.time.delayedCall(4000, ask);
      if (!L.takeTip(s, 'my_birthday')) return;
      self.save();
      F.ui.dialog('WHEN IS YOUR BIRTHDAY?\nTell the town, and Harvest Ville will celebrate it with you: a letter, a cake and a party hat!',
        [{ label: 'Not now', color: GREY }, { label: 'Set it', cb: function () { F.ui.askBirthday(null); } }]);
    };
    this.time.delayedCall(14000, ask);
  };

  // ---------- the party ----------
  // The hat (the whole day), and confetti with a hello once a session (or right away when you set it on the day).
  P.startParty = function (now) {
    if (!this.sys || !this.sys.isActive() || !this.player || !today()) return;
    if (!(this.state && this.state.isVisit) && L.birthdayMail(mine())) F.session.dirty = true; // (opened on the day, before any morning mail)
    // the farmer in the party hat (the birthday sheets; set on the day, the picture changes right away)
    if (this.player && this.player.texture.key !== F.playerKey() && this.applyLook) {
      this.applyLook();
      if (F.Online && F.Online.retrack) F.Online.retrack(); // friends here see the hat too
    }
    if (F.session.partied && !now) return;
    F.session.partied = true;
    if (F.ui) {
      F.ui.confetti();
      F.ui.toast('Happy birthday, ' + L.farmerName(mine()) + '! ' + (mine().mail.indexOf('mybday') >= 0 ? 'There is a letter for you in the mailbox.' : 'Have a wonderful day!'), 4200, 0x7a4d12);
    }
    sfx('fanfare');
  };
  // Confetti falling over the whole screen for a few seconds.
  U.confetti = function () {
    if (!this.textures.exists('confetti')) {
      var g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 10, 6);
      g.generateTexture('confetti', 10, 6);
      g.destroy();
    }
    var e = this.add.particles(0, -20, 'confetti', {
      x: { min: 0, max: W }, speedY: { min: 160, max: 320 }, speedX: { min: -60, max: 60 }, rotate: { start: 0, end: 540 },
      scale: { min: 0.8, max: 1.4 }, tint: [0xf25c54, 0xffd23f, 0x5fa84a, 0x4a90c9, 0xd36ad6, 0xffffff], lifespan: 3400,
      frequency: 40, quantity: 3, gravityY: 40,
    }).setDepth(400);
    this.time.delayedCall(2600, function () { e.stop(); });
    this.time.delayedCall(6500, function () { e.destroy(); });
  };
})(window.Farm = window.Farm || {});
