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
  // The panel is the usual wide one (12 px in from each side, like the bag and the shop); the week sits inside its
  // frame with the same 16 px margin left and right and the same 8 px gap between every card (owner, 7 Nov 2026: "the
  // design was off": the cards ran over the frame, the day 7 note floated and a big gap sat above Claim).
  var PX = 12, TW = 70, TH = 92, GAP = 8, ROW_W = TW * 4 + GAP * 3, BIG_W = TW * 2 + GAP;

  var iconOf = function (r) { return r.stars && !r.gold ? C.ICON.sunbeam : r.item && !r.gold ? C.ITEMS[r.item].icon : r.gold && (r.item || r.stars) ? C.ICON.chest : C.ICON.coin; };
  // one short line per card: "3 Treats", not "3 Animal Treat" over two lines
  var shortLabel = function (r) {
    if (r.gold && (r.item || r.stars)) return 'Big chest';
    if (r.gold) return r.gold + 'G';
    if (r.stars) return r.stars + ' Sunbeam' + (r.stars > 1 ? 's' : '');
    var name = C.ITEMS[r.item].name;
    return r.n > 1 ? r.n + ' ' + name.split(' ').pop() + 's' : name;
  };
  var oneLine = function (t, w) { if (t.width > w) t.setScale(w / t.width); return t; };

  U.showLoginGift = function () {
    var self = this, s = F.session.state, g = L.loginGift(s, F.today());
    if (!g) return;
    var c = this.openModal(function () { self.closeModal(); });
    var note = this.txt(W / 2, 0, g.day > 1 ? 'Day ' + g.day + ' in a row!\nCome back tomorrow for the next one.' : 'Come back every day!\nMiss a day and it starts again at Day 1.', 13, INK,
      { align: 'center', wordWrap: { width: ROW_W - 10 } }).setOrigin(0.5, 0);
    // top to bottom: ribbon, the line, the two rows of the week, Claim; the panel is as tall as that and no taller
    var NOTE_Y = 28, gridY = NOTE_Y + Math.ceil(note.height) + 12, btnY = gridY + TH * 2 + GAP + 18 + 21, h = btnY + 21 + 20;
    var y0 = Math.round(Math.max(84, (H - h) / 2 - 30));
    this.panelImg(c, PX, y0, W - PX * 2, h);
    var title = this.txt(W / 2, y0 + 4, 'DAILY GIFT', 16, '#ffe9a8', { fontStyle: 'bold', align: 'center', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, 190);
    c.add(title);
    note.y = y0 + NOTE_Y;
    c.add(note);
    // the week: days 1-4 on top, 5-7 under them; day 7 is two cards wide and gold, its whole chest written on it
    var top = y0 + gridY, left = Math.round((W - ROW_W) / 2), today = null;
    C.LOGIN.forEach(function (r, k) {
      var day = k + 1, row = k < 4 ? 0 : 1, col = row ? k - 4 : k, big = day === C.LOGIN.length;
      var w = big ? BIG_W : TW, x = left + col * (TW + GAP), y = top + row * (TH + GAP);
      var got = day < g.day, now = day === g.day;
      var tile = self.add.container(x, y);
      c.add(tile);
      self.baked(tile, 0, 0, 'ui-cal2-' + (now ? 'now' : got ? 'got' : 'next') + (big ? '-big' : ''), w, TH, function (gr) {
        var fill = big ? (got ? 0xd9c48a : 0xffe08a) : now ? 0xfff3c4 : got ? 0xd9c79a : 0xf2e2b6;
        gr.fillStyle(fill, 1).fillRoundedRect(0, 0, w, TH, 10);
        if (big && !got) gr.fillStyle(0xfff0bf, 1).fillRoundedRect(4, 4, w - 8, 18, 7); // a shine along the top
        gr.lineStyle(now ? 4 : big ? 3 : 2, now ? GREEN : big ? 0xc8901c : 0xc9a26b, 1).strokeRoundedRect(1, 1, w - 2, TH - 2, 10);
      });
      tile.add(self.txt(got ? (w - 18) / 2 : w / 2, 6, 'Day ' + day, 12, now ? '#2f5a22' : big ? '#7a4a0a' : '#6a4a2a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      var ic;
      if (big) {
        // the chest on the left, what is in it on the right
        ic = self.add.image(38, 54, 'items', iconOf(r)).setScale(0.4);
        tile.add(ic);
        tile.add(oneLine(self.txt(72, 26, shortLabel(r), 11, '#7a4a0a', { fontStyle: 'bold' }), w - 78));
        tile.add(oneLine(self.txt(72, 42, L.rewardLabel(r).split(' + ').join('\n+ '), 10, INK, { lineSpacing: 1 }), w - 78));
      } else {
        ic = self.add.image(w / 2, 46, 'items', iconOf(r)).setScale(0.34);
        tile.add(ic);
        tile.add(oneLine(self.txt(w / 2, TH - 8, shortLabel(r), 11, INK, { align: 'center' }).setOrigin(0.5, 1), w - 8));
      }
      if (got) {
        ic.setAlpha(0.45);
        // a green tick badge in the corner, clear of the "Day N"
        self.baked(tile, w - 21, 3, 'ui-cal2-tick', 18, 18, function (gr) { gr.fillStyle(GREEN, 1).fillCircle(9, 9, 9); gr.lineStyle(1.5, 0x2f5a22, 1).strokeCircle(9, 9, 8.2); });
        tile.add(self.txt(w - 12, 12, '✓', 12, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
      }
      if (now) { today = { tile: tile, icon: ic }; self.tweens.add({ targets: ic, scale: ic.scale * 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); }
    });
    var claimed = false;
    this.button(c, W / 2, y0 + btnY, 150, 42, 'Claim', function () {
      if (claimed) return;
      var r = L.claimLogin(s, F.today());
      if (r === 'full') { self.closeModal(); return self.toast('Your bag is full! Make room, then open Quests to claim it.'); }
      if (typeof r !== 'object') return self.closeModal();
      claimed = true;
      sfx('coin');
      world().changed();
      world().save();
      // the card goes at once (the next tap is yours), and today's gift pops up where its tile was
      var at = today ? { x: today.tile.x + today.icon.x, y: c.y + today.tile.y + today.icon.y, frame: today.icon.frame.name, scale: today.icon.scale } : null;
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
