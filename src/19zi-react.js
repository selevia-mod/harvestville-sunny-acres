// Reactions (owner, 3 Nov 2026: "more reactions"): Wave opens a small centred card of six, and what you pick shows over
// your farmer for everyone here (O.react, 19h-online.js). A friend on an older game sees a plain "Hi!".
(function (F) {
  'use strict';
  var O = F.Online;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H;
  var BLUE = 0x4a90c9, PINK = 0xd86a8a, GOLD = 0xd9a62a, GREEN = 0x5fa84a, VIOLET = 0x8a6ac9, GREY = 0xa08a68;
  var CHOICES = [['wave', 'Hi!', BLUE], ['heart', 'Love', PINK], ['laugh', 'Haha!', GOLD], ['wow', 'Wow!', VIOLET], ['yay', 'Yay!', GREEN], ['aww', 'Aww...', GREY]];

  U.openReact = function () {
    var self = this;
    if (this.modals.length) return;
    var c = this.openModal(), h = 196, y0 = Math.round((H - h) / 2 - 30);
    this.panelImg(c, 36, y0, W - 72, h);
    var title = this.txt(W / 2, y0 + 4, 'SAY SOMETHING', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, Math.max(170, title.width + 44));
    c.add(title);
    CHOICES.forEach(function (ch, i) {
      var x = W / 2 + (i % 3 - 1) * 92, y = y0 + 62 + Math.floor(i / 3) * 56;
      self.button(c, x, y, 84, 42, ch[1], function () { self.closeModal(); O.react(ch[0]); }, ch[2]);
    });
    this.button(c, W / 2, y0 + h - 28, 110, 34, 'Close', function () { self.closeModal(); }, GREY);
    return c;
  };
})(window.Farm = window.Farm || {});
