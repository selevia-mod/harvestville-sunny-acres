// The task bar at the top ("Clear 3 weeds, branches or stones in your field  2/3") gets small (owner, 9 Nov 2026: "why not
// minimize this"): it shows in full for a few seconds when a task is new (or when you tap it), then shrinks to a small
// pill at the top left: the star and the count ("2/3"). Tap the pill: the full bar again for a few seconds; tap the full
// bar: the task's card, as before. (The bar stays 'visible' as before, so what sits under it keeps its place.)
(function (F) {
  'use strict';
  var U = F.UIScene.prototype;
  var L = F.Logic;
  var SHOW = 6000; // ms in full
  var PILL = { x: 8, y: 68, h: 30 };

  var refreshGoal = U.refreshGoal;
  U.refreshGoal = function () {
    var before = this.goalText ? this.goalText.text : null;
    refreshGoal.apply(this, arguments);
    if (!this.goalBar) return;
    var self = this, s = F.session.state, g = L.goal(s);
    // (made once per task bar: a restarted scene, a New game, is the same object with a new bar)
    if (this.goalPill !== this.goalBar) {
      var bg = this.goalBar.list[0], z = this.goalBar.list[3];
      this.goalFull = [bg, this.goalText];
      this.goalPillBg = this.add.graphics();
      this.goalPillText = this.txt(42, 75, '', 12, '#fff6d8', { fontStyle: 'bold' });
      this.goalBar.addAt(this.goalPillBg, 0);
      this.goalBar.add(this.goalPillText);
      this.goalPill = this.goalBar;
      this.goalSmallAt = 0;
      // tapping: small -> full for a while; full -> the card (the bar's own tap, below)
      var tap = this.add.zone(PILL.x, PILL.y, 120, PILL.h + 4).setOrigin(0).setInteractive({ useHandCursor: true });
      tap.on('pointerdown', function () { if (self.goalSmall && !self.modals.length) self.goalOpen(); });
      this.goalBar.add(tap);
      this.goalTap = tap;
      this.goalZone = z;
    }
    if (!g) return;
    var count = g.need > 1 ? s.gp + '/' + g.need : '';
    if (this.goalPillText.text !== count) this.goalPillText.setText(count);
    if (before !== this.goalText.text && (before == null || this.goalText.text.split('  ')[0] !== String(before).split('  ')[0])) this.goalOpen(); // (a new task: in full; a count going up stays small)
    else this.goalShape();
  };
  U.goalOpen = function () {
    var self = this;
    this.goalSmallAt = Date.now() + SHOW;
    this.goalShape();
    if (this.goalTimer) this.goalTimer.remove();
    this.goalTimer = this.time.delayedCall(SHOW + 50, function () { self.goalShape(); });
  };
  U.goalShape = function () {
    if (!this.goalPill) return;
    var small = Date.now() >= (this.goalSmallAt || 0);
    this.goalSmall = small;
    this.goalFull.forEach(function (o) { o.setVisible(!small); });
    this.goalZone.setVisible(!small).input.enabled = !small;
    this.goalTap.input.enabled = small;
    this.goalPillText.setVisible(small);
    var w = 34 + (this.goalPillText.text ? this.goalPillText.width + 10 : 0);
    this.goalPillBg.clear().setVisible(small);
    if (small) {
      this.goalPillBg.fillStyle(0x24160b, 0.78).fillRoundedRect(PILL.x, PILL.y, w, PILL.h, 10);
      this.goalPillBg.lineStyle(2, 0xffd23f, 0.9).strokeRoundedRect(PILL.x + 1, PILL.y + 1, w - 2, PILL.h - 2, 9);
      this.goalTap.setSize(w, PILL.h + 4);
    }
  };
})(window.Farm = window.Farm || {});
