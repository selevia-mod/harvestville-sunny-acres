// The Decorate panels, redone (owner, 8 Nov 2026: "Lets improve this panel also"): the home's and the yard's.
//  - the header stays (19i-look.js decorHeader: the ribbon, Home Beauty and its bar)
//  - a card for the piece you chose: its picture, its name and beauty, and round buttons with words under them (Turn,
//    Put away, OK); nothing chosen: what to do, in the same card
//  - the bottom: Storage, Walls and Floor as one bar of three, Done beside it (nothing over the panel's edge)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, HGT = K.H, INK = K.INK;
  var D = F.UI_DRAW, rrect = D.rrect, vgrad = D.vgrad;
  var BLUE = 0x4a90c9, GREY = 0xa08a68, GREEN = 0x5fa84a;
  var TOP = 440, CARD = { x: 16, y: TOP + 60, h: 70 }, BAR = { y: HGT - 42, h: 40 };
  var world = function () { return F.world; };
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  // the panel itself, its header, and the room's taps kept off it
  U.decorFrame = function (label) {
    if (this.decorBar) this.decorBar.destroy();
    this.decorating = true;
    if (this.decorBtn) this.decorBtn.setVisible(false);
    F.input.reset();
    var c = this.decorBar = this.add.container(0, C.EXTRA).setDepth(90); // a bottom panel, at the bottom however tall
    c.add(this.add.rectangle(0, TOP, W, HGT - TOP, 0x000000, 0.001).setOrigin(0).setInteractive());
    this.panelImg(c, 6, TOP, W - 12, HGT - TOP - 6);
    this.decorHeader(c, label);
    return c;
  };
  // the card: a cream inset
  U.decorCard = function (c) {
    var w = W - 2 * CARD.x;
    this.canvasImg(c, CARD.x, CARD.y, 'ui-decor-card-' + w, w, CARD.h, function (g) {
      rrect(g, 1, 1, w - 2, CARD.h - 2, 12);
      g.fillStyle = vgrad(g, 0, CARD.h, '#fffaea', '#f3e2bd');
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(122,77,38,0.45)';
      g.stroke();
    });
  };
  // a round button with its word under it, in dark ink (the card is light)
  U.decorRound = function (c, x, glyph, color, word, onTap) {
    var y = CARD.y + 28;
    this.roundButton(c, x, y, 18, color, glyph, null, onTap);
    var t = this.txt(x, y + 27, word, 10, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    c.add(t);
    return t;
  };
  // the piece's picture in a round frame at the card's left; then its name and a line under it
  U.decorPiece = function (c, pic, name, sub) {
    var cx = CARD.x + 34, cy = CARD.y + CARD.h / 2;
    c.add(this.add.circle(cx, cy, 25, 0xf2d79a).setStrokeStyle(2, 0xd9b77f));
    if (pic) {
      var im = this.add.image(cx, cy + 2, pic.key, pic.frame).setFlipX(!!pic.flip);
      im.setScale(Math.min(42 / im.width, 42 / im.height));
      c.add(im);
    }
    var room = W - CARD.x - 150 - (CARD.x + 66);
    var n = this.txt(CARD.x + 66, cy - 10, name, 13, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    if (n.width > room) n.setScale(room / n.width);
    c.add(n);
    c.add(this.txt(CARD.x + 66, cy + 10, sub, 11, '#2f7a2a', { fontStyle: 'bold' }).setOrigin(0, 0.5));
  };
  // nothing chosen: what to do, in the card
  U.decorHint = function (c, line1, line2) {
    c.add(this.add.image(CARD.x + 30, CARD.y + CARD.h / 2, 'items', C.ICON.sparkle).setScale(0.2));
    c.add(this.txt(CARD.x + 54, CARD.y + CARD.h / 2 - 10, line1, 12, INK, { fontStyle: 'bold', wordWrap: { width: W - 2 * CARD.x - 66 } }).setOrigin(0, 0.5));
    c.add(this.txt(CARD.x + 54, CARD.y + CARD.h / 2 + 12, line2, 11, '#7a5a3a', { wordWrap: { width: W - 2 * CARD.x - 66 } }).setOrigin(0, 0.5));
  };
  // the bottom: a bar of tabs (each [word, onTap]) and Done at the right
  U.decorTabs = function (c, tabs, onDone) {
    var self = this, doneW = tabs.length > 1 ? 84 : 100, x0 = 16, x1 = W - 16 - doneW - 8, w = x1 - x0, sw = w / tabs.length, y = BAR.y - BAR.h / 2;
    this.canvasImg(c, x0, y, 'ui-decor-tabs-' + Math.round(w) + '-' + tabs.length, Math.round(w), BAR.h + 3, function (g) {
      rrect(g, 1, 3, w - 2, BAR.h - 2, 12);
      g.fillStyle = 'rgba(60,35,15,0.25)';
      g.fill();
      rrect(g, 1, 1, w - 2, BAR.h - 2, 12);
      g.fillStyle = vgrad(g, 0, BAR.h, '#b9844e', '#8a5a2e');
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#5a3a1e';
      g.stroke();
      for (var k = 1; k < tabs.length; k++) {
        g.beginPath();
        g.moveTo(Math.round(k * sw) + 0.5, 8);
        g.lineTo(Math.round(k * sw) + 0.5, BAR.h - 9);
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(255,240,210,0.35)';
        g.stroke();
      }
    });
    tabs.forEach(function (tab, k) {
      var cx = x0 + sw * k + sw / 2, box = self.add.container(cx, BAR.y);
      var t = self.txt(0, 0, tab[0], 13, '#fff6d8', { fontStyle: 'bold', stroke: '#4a2a12', strokeThickness: 3 }).setOrigin(0.5);
      if (t.width > sw - 10) t.setScale((sw - 10) / t.width);
      var z = self.add.zone(0, 0, sw, BAR.h).setInteractive({ useHandCursor: true });
      z.on('pointerdown', function () { box.setScale(0.94); });
      z.on('pointerout', function () { box.setScale(1); });
      F.tapOn(z, function () { box.setScale(1); tab[1](); });
      box.add([t, z]);
      c.add(box);
    });
    this.button(c, W - 16 - doneW / 2, BAR.y, doneW, BAR.h - 2, 'Done', onDone, GREEN);
  };

  // ---------- the home ----------
  U.drawDecorBar = function (info) {
    var self = this, s = F.session.state, w = world(), c = this.decorFrame('Decorate your home');
    this.decorCard(c);
    var it = info.sel != null ? s.home.items[info.sel] : null;
    if (it) {
      var view = L.furnView ? L.furnView(it.t, it.f) : null;
      var pic = view ? { key: F.furnTurnTexture(this, it.v), frame: view.frame, flip: view.flip } : { key: F.furnTexture(this, it.v), frame: it.t, flip: it.f === 1 };
      this.decorPiece(c, pic, L.furnName(it.t, it.v), '+' + L.furnBeauty(it.t, it.v) + ' beauty');
      var rx = W - CARD.x - 26;
      this.decorRound(c, rx - 96, 'turn', BLUE, L.furnTurns && L.furnTurns(it.t) ? 'Turn' : 'Flip', function () { w.decorTurn(); });
      this.decorRound(c, rx - 48, 'store', GREY, 'Put away', function () { w.decorStore(); });
      this.decorRound(c, rx, 'tick', GREEN, 'OK', function () { w.decorSelect(null); });
    } else {
      this.decorHint(c, 'Tap a piece, then drag it to move it.', 'More furniture at Mira\'s Woodshop in town.');
    }
    var n = Object.keys(s.home.bag).reduce(function (sum, k) { return sum + s.home.bag[k]; }, 0);
    this.decorTabs(c, [['Storage' + (n ? ' ' + n : ''), function () { self.openStorage(0); }], ['Walls', function () { self.openSurfaces('wall', 0); }],
      ['Floor', function () { self.openSurfaces('floor', 0); }]], function () { w.endDecor(); sfx('pick'); });
  };

  // ---------- the yard ----------
  U.drawYardBar = function (info) {
    var self = this, s = F.session.state, w = world(), c = this.decorFrame('Decorate your yard'), O = C.OUTDOOR;
    this.decorCard(c);
    var yardPic = function (t) { var im = F.yardImg ? F.yardImg(self, t) : null; return im && im.key ? { key: im.key, frame: im.frame } : null; };
    if (info.brush != null) {
      var bt = O.types[info.brush];
      this.decorPiece(c, yardPic(info.brush), bt.name, (s.yard.bag[info.brush] || 0) + ' left: tap the grass to place');
      this.decorRound(c, W - CARD.x - 26, 'tick', GREEN, 'Done', function () { w.yd.brush = null; w.yardChanged(); });
    } else if (info.sel != null) {
      var it = s.yard.items[info.sel], type = O.types[it.t], rx = W - CARD.x - 26;
      this.decorPiece(c, yardPic(it.t), type.name, '+' + type.beauty + ' beauty');
      this.decorRound(c, rx - 48, 'store', GREY, 'Put away', function () { w.yardStore(); });
      this.decorRound(c, rx, 'tick', GREEN, 'OK', function () { w.yardSelect(null); });
    } else {
      this.decorHint(c, 'Tap a piece, then drag it to move it.', 'Place more from Storage. Buy them at Mira\'s (Outdoor).');
    }
    var n = Object.keys(s.yard.bag).reduce(function (sum, k) { return sum + s.yard.bag[k]; }, 0);
    this.decorTabs(c, [['Storage' + (n ? ' ' + n : ''), function () { self.openYardStorage(0); }]], function () { w.endYard(); sfx('pick'); });
  };
})(window.Farm = window.Farm || {});
