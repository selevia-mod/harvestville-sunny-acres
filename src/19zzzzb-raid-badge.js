// The Town Raid on the screen without a second bar (owner, 9 Nov 2026: the raid bar under "Clear 3 weeds..." takes space).
// - Before it starts (the countdown): a small round chip in the left column, under Today's Event chip: the raid's
//   picture and the time left. Tap it: the Town Raid card, as the bar did.
// - While it is on: the raid bar takes the task bar's place at the top (the task bar comes back when it ends).
(function (F) {
  'use strict';
  var C = F.Config;
  var U = F.UIScene.prototype;
  // The left column, like Today's Event chip (19za-events.js: a 28 px round badge at 8, 194): under it, the dish and
  // Power-Up chips step down while the raid chip shows (owner, 9 Nov 2026: "on the left side, same small size").
  var CHIP = { x: 8, y: 228, h: 24 }, DOWN = 34;

  U.raidBadgeMake = function () {
    var self = this, d = CHIP.h + 4, r = d / 2;
    var c = this.raidBadge = this.add.container(CHIP.x, CHIP.y).setDepth(45).setVisible(false);
    var badge = this.add.image(r, r, this.bake('ui-raid-badge', d + 2, d + 3, function (g) {
      g.fillStyle(0x000000, 0.25).fillCircle(r + 1, r + 2, r);
      g.fillStyle(0x3a140a, 0.95).fillCircle(r + 1, r + 1, r);
      g.lineStyle(1.5, 0xff7a4a, 1).strokeCircle(r + 1, r + 1, r - 0.75);
    })).setScale(1 / F.R);
    this.raidBadgeIcon = this.add.image(r, r, 'items', C.ICON.storm).setScale(0.18);
    // the time, always there, in a small dark tag beside it
    this.raidBadgeTime = this.txt(d + 8, r, '', 12, '#ffd2a8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.raidBadgeBack = this.add.graphics();
    var zone = this.add.zone(r + 18, r, d + 40, d + 2).setInteractive({ useHandCursor: true });
    F.tapOn(zone, function () { if (!self.modals.length && self.raidInfo) self.raidInfo(); });
    c.add([this.raidBadgeBack, this.raidBadgeTime, badge, this.raidBadgeIcon, zone]);
    this.raidBadgeD = d;
  };
  U.raidBadgeTag = function () {
    if (this.raidBadgeMinW == null) { var m = this.txt(0, 0, '00:00', 12, '#ffd2a8', { fontStyle: 'bold' }); this.raidBadgeMinW = m.width; m.destroy(); }
    var d = this.raidBadgeD, w = Math.max(this.raidBadgeTime.width, this.raidBadgeMinW) + 16; // (room for the time before it is filled in)
    this.raidBadgeBack.clear().fillStyle(0x3a140a, 0.8).fillRoundedRect(d, 3, w, d - 6, (d - 6) / 2);
    return d + w;
  };

  // The "raid soon" word: slides out beside the chip for a few seconds, then tucks away (as Today's Event's name).
  U.raidSoonNote = function (text) {
    var self = this;
    if (!this.raidBadge) this.raidBadgeMake();
    if (this.raidNote) { this.raidNote.destroy(); this.raidNote = null; }
    var x0 = this.raidBadgeTag() + 6, t = this.txt(x0 + 9, this.raidBadgeD / 2, text, 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    var back = this.add.graphics(), d = this.raidBadgeD;
    back.fillStyle(0x3a140a, 0.8).fillRoundedRect(x0, 3, t.width + 18, d - 6, (d - 6) / 2);
    var c = this.raidNote = this.add.container(0, 0, [back, t]);
    this.raidBadge.addAt(c, 0);
    this.tweens.add({ targets: this.raidBadgeIcon, scale: 0.22, duration: 160, yoyo: true, repeat: 2 });
    this.tweens.add({ targets: c, alpha: 0, x: -12, delay: 4000, duration: 350, ease: 'Quad.in', onComplete: function () { c.destroy(); if (self.raidNote === c) self.raidNote = null; } });
  };
  // the chips under it step down while it shows
  U.raidChipsMove = function (on) {
    var y = on ? 238 + DOWN : 238;
    if (this.dishChip && this.dishChip.y !== y) this.dishChip.setY(y);
    if (this.powerChipBox && this.powerChipBox.y !== y) this.powerChipBox.setY(y);
  };

  var raidBar = U.raidBar;
  U.raidBar = function (ph) {
    raidBar.call(this, ph);
    if (!this.raidBox) return;
    if (!this.raidBadge) this.raidBadgeMake();
    var soon = ph.phase === 'soon' && !this.decorating, on = ph.phase === 'on' && !this.decorating;
    // before: the badge, not the bar
    if (soon) {
      this.raidBox.setVisible(false);
      var ic = this.raidIcon.frame.name;
      if (this.raidBadgeIcon.frame.name !== ic) this.raidBadgeIcon.setFrame(ic);
      if (this.raidBadgeTime.text !== this.raidTime.text) { this.raidBadgeTime.setText(this.raidTime.text); this.raidBadgeTag(); }
    }
    var showChip = soon && !F.session.visit;
    this.raidBadge.setVisible(showChip);
    this.raidChipsMove(showChip);
    // while it is on: the bar in the task bar's place
    var visitBar = this.visitBar && this.visitBar.visible !== false && F.session.visit;
    if (on && !visitBar) {
      this.raidBox.setY(68);
      if (this.goalBar && this.goalBar.visible) { this.goalBar.setVisible(false); this.goalHidByRaid = true; }
    } else if (this.goalHidByRaid) {
      this.goalHidByRaid = false;
      if (this.refreshGoal) this.refreshGoal();
    }
  };
  // a new task while the raid is on stays hidden until it ends
  var refreshGoal = U.refreshGoal;
  if (refreshGoal) U.refreshGoal = function () {
    refreshGoal.apply(this, arguments);
    if (this.goalHidByRaid && this.goalBar) this.goalBar.setVisible(false);
  };
})(window.Farm = window.Farm || {});
