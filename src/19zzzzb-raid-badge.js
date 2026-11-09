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
