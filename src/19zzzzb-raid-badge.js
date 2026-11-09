// The Town Raid on the screen without a second bar (owner, 9 Nov 2026: the raid bar under "Clear 3 weeds..." takes space).
// - Before it starts (the countdown): a small round badge in the right column, under the round buttons: the raid's
//   picture and the time left. Tap it: the Town Raid card, as the bar did.
// - While it is on: the raid bar takes the task bar's place at the top (the task bar comes back when it ends).
(function (F) {
  'use strict';
  var C = F.Config;
  var U = F.UIScene.prototype;
  var BADGE = { r: 23, y: 382 }; // (the right column: Quests 134, Online 196, Decorate 258, chat 320: 19i-look.js SIDE)

  U.raidBadgeMake = function () {
    var self = this, SIDE = U.SIDE || { x: C.VIEW_W - 30 }, r = BADGE.r;
    var c = this.raidBadge = this.add.container(SIDE.x, BADGE.y).setDepth(50).setVisible(false);
    var ring = this.canvasImg(null, -r - 4, -r - 4, 'ui-raidbadge-' + r, r * 2 + 8, r * 2 + 8, function (g) {
      g.fillStyle = 'rgba(30,16,6,0.35)'; g.beginPath(); g.arc(r + 4, r + 6, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(58,20,10,0.92)'; g.beginPath(); g.arc(r + 4, r + 4, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#ff7a4a'; g.beginPath(); g.arc(r + 4, r + 4, r - 1.5, 0, Math.PI * 2); g.stroke();
    });
    this.raidBadgeIcon = this.add.image(0, -1, 'items', C.ICON.storm).setScale(0.26);
    var pill = this.canvasImg(null, -27, r - 7, 'ui-raidbadge-pill', 54, 18, function (g) {
      var rr = function (x, y, w, h, k) { g.beginPath(); g.moveTo(x + k, y); g.arcTo(x + w, y, x + w, y + h, k); g.arcTo(x + w, y + h, x, y + h, k); g.arcTo(x, y + h, x, y, k); g.arcTo(x, y, x + w, y, k); g.closePath(); };
      g.fillStyle = 'rgba(58,20,10,0.95)'; rr(0, 0, 54, 18, 9); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = '#ff7a4a'; rr(0.75, 0.75, 52.5, 16.5, 8.5); g.stroke();
    });
    this.raidBadgeTime = this.txt(0, r + 2, '', 11, '#ffd2a8', { fontStyle: 'bold' }).setOrigin(0.5);
    var z = this.add.zone(0, 6, r * 2 + 12, r * 2 + 26).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { if (!self.modals.length && self.raidInfo) self.raidInfo(); });
    c.add([ring, this.raidBadgeIcon, pill, this.raidBadgeTime, z]);
    // (it gently pulses: something is coming)
    this.tweens.add({ targets: this.raidBadgeIcon, scale: 0.29, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };

  // The "raid soon" word: one short line in a bubble to the left of the badge, pointing at it; it fades after 4 s (owner,
  // 9 Nov 2026: the old two-line notice covered the task card and Quests). Tap: the Town Raid card.
  U.raidSoonNote = function (text) {
    var self = this;
    if (!this.raidBadge) this.raidBadgeMake();
    if (this.raidNote) { this.raidNote.destroy(); this.raidNote = null; }
    var t = this.txt(0, 0, text, 11, '#fff6d8', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    var w = Math.ceil(t.width) + 22, h = 24, x = this.raidBadge.x - BADGE.r - 10, y = this.raidBadge.y;
    var bg = this.add.graphics();
    bg.fillStyle(0x3a140a, 0.92).fillRoundedRect(-w, -h / 2, w, h, 12);
    bg.lineStyle(1.5, 0xff7a4a, 1).strokeRoundedRect(-w, -h / 2, w, h, 12);
    bg.fillStyle(0x3a140a, 0.92).fillTriangle(-1, -5, -1, 5, 7, 0); // (the point, at the badge)
    t.setPosition(-11, 0);
    var z = this.add.zone(-w / 2, 0, w, h).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { if (!self.modals.length && self.raidInfo) self.raidInfo(); });
    var c = this.raidNote = this.add.container(x, y, [bg, t, z]).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, x: x - 4, duration: 220, ease: 'Sine.out' });
    this.tweens.add({ targets: this.raidBadge, scale: 1.15, duration: 160, yoyo: true, repeat: 2 });
    this.time.delayedCall(4000, function () {
      if (self.raidNote !== c) return;
      self.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: function () { c.destroy(); if (self.raidNote === c) self.raidNote = null; } });
    });
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
      if (this.raidBadgeTime.text !== this.raidTime.text) this.raidBadgeTime.setText(this.raidTime.text);
    }
    this.raidBadge.setVisible(soon && !(this.modals && this.modals.length && this.raidBadgeHideInMenus));
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
