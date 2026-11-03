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

  // Drawn when the day changes, then only shown, hidden and moved. A small round badge with the day's icon (owner, 3 Nov 2026:
  // "Timber Tuesday is kinda blocking the view"): its name slides out beside it for a few seconds when the day's event is
  // new on screen, then tucks away. A tap opens what it does.
  var NAME_MS = 4000;
  U.drawEventChip = function (ev) {
    var self = this, d = CHIP.h + 4, r = d / 2, c = this.eventChipBox;
    if (c) c.removeAll(true);
    else c = this.eventChipBox = this.add.container(CHIP.x, CHIP.y).setDepth(45);
    var badge = this.add.image(r, r, this.bake('ui-event-badge', d + 2, d + 3, function (g) {
      g.fillStyle(0x000000, 0.25).fillCircle(r + 1, r + 2, r);
      g.fillStyle(0xfff3cf, 0.95).fillCircle(r + 1, r + 1, r);
      g.lineStyle(1.5, 0xc9a26b, 1).strokeCircle(r + 1, r + 1, r - 0.75);
    })).setScale(1 / F.R);
    var icon = this.add.image(r, r, 'items', C.ICON[ev.icon]).setScale(0.18);
    var text = this.txt(d + 8, r, ev.name, 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    var tag = this.add.container(0, 0), tw = text.width + 16, back = this.add.graphics();
    back.fillStyle(0x24160b, 0.72).fillRoundedRect(d, 3, tw, d - 6, (d - 6) / 2);
    tag.add([back, text]);
    var zone = this.add.zone(r + 4, r, d + 16, d + 2).setInteractive({ useHandCursor: true }); // a fair size for a thumb, short of the chips under it
    F.tapOn(zone, function () { if (!self.modals.length) self.openEvent(); });
    c.add([tag, badge, icon, zone]);
    this.eventChipFor = ev.key;
    this.eventTag = tag;
    tag.setAlpha(1).setX(0);
    this.tweens.add({ targets: tag, alpha: 0, x: -12, delay: NAME_MS, duration: 350, ease: 'Quad.in', onComplete: function () { tag.setVisible(false); } });
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
