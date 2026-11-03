// The Daily gift as a calendar (owner, 4 Nov 2026: "a small prize each day, and a bigger one on day 7"). The same rules
// as before (01-logic7.js: a gift a day, seven in a row, back to Day 1 after a day missed), now shown as a week of tiles:
// the days already got ticked, today's glowing, the ones to come, and day 7 a chest (00-zzzzzmore.js). Claim drops
// today's gift into your bag with a little pop.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var GREEN = 0x5fa84a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };
  var TW = 70, TH = 92, GAP = 8;

  var iconOf = function (r) { return r.stars && !r.gold ? C.ICON.sunbeam : r.item && !r.gold ? C.ITEMS[r.item].icon : r.gold && (r.item || r.stars) ? C.ICON.chest : C.ICON.coin; };
  var shortLabel = function (r) {
    if (r.gold && (r.item || r.stars)) return 'Big chest';
    if (r.gold) return r.gold + 'G';
    if (r.stars) return r.stars + ' Sunbeam' + (r.stars > 1 ? 's' : '');
    return (r.n > 1 ? r.n + ' ' : '') + C.ITEMS[r.item].name;
  };

  U.showLoginGift = function () {
    var self = this, s = F.session.state, g = L.loginGift(s, F.today());
    if (!g) return;
    var c = this.openModal(function () { self.closeModal(); });
    var h = 30 + 36 + TH * 2 + GAP + 54 + 44 + 26, y0 = Math.round(Math.max(84, (H - h) / 2 - 30));
    this.panelImg(c, 24, y0, W - 48, h);
    var title = this.txt(W / 2, y0 + 4, 'DAILY GIFT', 16, '#ffe9a8', { fontStyle: 'bold', align: 'center', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, 190);
    c.add(title);
    c.add(this.txt(W / 2, y0 + 30, g.day > 1 ? 'Day ' + g.day + ' in a row! Come back tomorrow for the next one.' : 'Come back every day! Miss a day and it starts again at Day 1.', 13, INK,
      { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    // the week: days 1-4 on top, 5-7 under them (day 7 twice as wide)
    var top = y0 + 70, today = null;
    C.LOGIN.forEach(function (r, k) {
      var day = k + 1, row = k < 4 ? 0 : 1, col = row ? k - 4 : k, big = day === C.LOGIN.length;
      var w = big ? TW * 2 + GAP : TW, n = row ? 3 : 4, rowW = row ? TW * 4 + GAP * 3 : n * TW + (n - 1) * GAP;
      var x = Math.round((W - rowW) / 2 + col * (TW + GAP)), y = top + row * (TH + GAP);
      var got = day < g.day, now = day === g.day;
      var tile = self.add.container(x, y);
      c.add(tile);
      self.baked(tile, 0, 0, 'ui-cal-' + (now ? 'now' : got ? 'got' : 'next') + (big ? '-big' : ''), w, TH, function (gr) {
        gr.fillStyle(now ? 0xfff3c4 : got ? 0xd9c79a : 0xf2e2b6, 1).fillRoundedRect(0, 0, w, TH, 10);
        gr.lineStyle(now ? 4 : 2, now ? 0x5fa84a : 0xc9a26b, 1).strokeRoundedRect(1, 1, w - 2, TH - 2, 10);
      });
      tile.add(self.txt(w / 2, 6, 'Day ' + day, 12, now ? '#2f5a22' : '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      var ic = self.add.image(w / 2, 46, 'items', iconOf(r)).setScale(big ? 0.42 : 0.34);
      tile.add(ic);
      tile.add(self.txt(w / 2, TH - 8, shortLabel(r), 10, INK, { align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5, 1));
      if (got) {
        ic.setAlpha(0.45);
        tile.add(self.txt(w - 14, 10, '✓', 18, '#2f5a22', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      }
      if (now) { today = { tile: tile, icon: ic, w: w }; self.tweens.add({ targets: ic, scale: ic.scale * 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); }
    });
    var last = C.LOGIN[C.LOGIN.length - 1];
    c.add(this.txt(W / 2, top + TH * 2 + GAP + 10, 'Day 7: ' + L.rewardLabel(last), 12, '#7a5a12', { fontStyle: 'bold', align: 'center', wordWrap: { width: 290 } }).setOrigin(0.5, 0));
    var claimed = false;
    this.button(c, W / 2, y0 + h - 40, 150, 42, 'Claim', function () {
      if (claimed) return;
      var r = L.claimLogin(s, F.today());
      if (r === 'full') { self.closeModal(); return self.toast('Your bag is full! Make room, then open Quests to claim it.'); }
      if (typeof r !== 'object') return self.closeModal();
      claimed = true;
      sfx('coin');
      world().changed();
      world().save();
      // the card goes at once (the next tap is yours), and today's gift pops up where its tile was
      var at = today ? { x: today.tile.x + today.w / 2, y: today.tile.y + 46, frame: today.icon.frame.name, scale: today.icon.scale } : null;
      self.closeModal();
      if (at) {
        var pop = self.add.image(at.x, at.y, 'items', at.frame).setScale(at.scale).setDepth(60);
        self.tweens.add({ targets: pop, y: at.y - 60, scale: at.scale * 1.6, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: function () { pop.destroy(); } });
      }
      self.toast('Day ' + r.day + ' gift: ' + L.rewardLabel(r.reward) + '!', 2600, 0x7a4d12);
    }, GREEN);
    return c;
  };
})(window.Farm = window.Farm || {});
