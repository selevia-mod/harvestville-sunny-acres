// Today's Event on screen (rules: 01-logicH.js): a small chip at the top of the left column, over the dish and Power-Up
// chips, and one short pop-up on the first open of the day. There it is under the goal banner and the toasts, across
// from the side buttons, and well above the chat box over the joystick.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var CHIP = { x: 8, y: 194, h: 24, pad: 9 };

  U.openEvent = function () {
    var day = L.dayOf(L.clock()), ev = L.eventOf(day), next = L.eventOf(day + 1);
    this.dialog(ev.name.toUpperCase(), null, { rows: [[C.ICON[ev.icon], ev.text], [C.ICON.calendar, 'Tomorrow: ' + next.name + '.']] });
  };

  // Drawn when the day changes (the name decides its width), then only shown, hidden and moved.
  U.drawEventChip = function (ev) {
    var self = this, h = CHIP.h, c = this.eventChipBox;
    if (c) c.removeAll(true);
    else c = this.eventChipBox = this.add.container(CHIP.x, CHIP.y).setDepth(45);
    var text = this.txt(27, h / 2, ev.name, 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    var w = 27 + text.width + CHIP.pad, bg = this.add.graphics();
    bg.fillStyle(0x24160b, 0.78).fillRoundedRect(0, 0, w, h, h / 2);
    bg.lineStyle(1.5, 0xffd23f, 0.9).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, h / 2 - 1);
    var icon = this.add.image(14, h / 2, 'items', C.ICON[ev.icon]).setScale(0.17);
    var zone = this.add.zone(w / 2, h / 2, w + 8, h + 12).setInteractive({ useHandCursor: true }); // a fair size for a thumb
    F.tapOn(zone, function () { if (!self.modals.length) self.openEvent(); });
    c.add([bg, icon, text, zone]);
    this.eventChipFor = ev.key;
  };

  U.eventChip = function () {
    var ev = L.eventOf();
    if (this.eventChipFor !== ev.key) this.drawEventChip(ev);
    this.eventChipBox.setVisible(!F.session.visit && !this.decorating);
  };

  // (once a second, with the dish and Power-Up chips)
  var powerChip = P.powerChip;
  P.powerChip = function () {
    powerChip.call(this);
    if (F.ui && F.ui.add && F.ui.goalBar) F.ui.eventChip();
  };

  // ---------- the first open of the day ----------
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this, s = F.session.state;
    if ((this.state && this.state.isVisit) || (window.gameHost && window.gameHost.quiet) || !L.eventPopup(s)) return;
    var show = function () {
      if (!self.sys || !self.sys.isActive() || !L.eventPopup(s)) return;
      if (self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return self.time.delayedCall(2500, show);
      L.eventShown(s);
      self.save();
      F.ui.openEvent();
    };
    this.time.delayedCall(5000, show); // after the login gift and What's New
  };

  // ---------- Gem Sunday ----------
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var floor = F.session.mineFloor, gem = L.mineGem(floor), had = items[gem] || 0;
    var r = breakRock.call(this, idx, t, items);
    if (r && (items[gem] || 0) > had && L.gemBonus(this.state, floor, gem)) items[gem] += 1;
    return r;
  };
})(window.Farm = window.Farm || {});
