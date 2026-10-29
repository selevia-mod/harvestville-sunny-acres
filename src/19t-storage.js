// Home storage (owner, 30 Oct 2026): tap a Dresser or a Wardrobe at home and choose Storage. Two tabs: Storage
// (tap an item to take it into your bag) and Bag (tap an item to put it away). 30 slots a page, like the bag.
// Rules in 01-logicC.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, INK = K.INK, SLOT = K.SLOT;
  var GREEN = 0x5fa84a, BROWN = 0x9a7a4a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var PAGE = 30;

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type !== 'storage') return extraObjectAction.call(this, o, held, def);
    if (F.session.visit) return { label: 'Storage', icon: C.ICON.chest, disabled: true, why: "That's where " + F.session.visit.name + ' keeps their things.' };
    return { label: 'Storage', icon: C.ICON.chest, run: function () { F.ui.openItemStorage(); } };
  };

  U.openItemStorage = function (tab) {
    var self = this, s = F.session.state, w = F.world;
    var c = this.openModal();
    tab = tab || 'store';
    var page = 0;
    var list = function () { return tab === 'store' ? s.store : s.inv; };
    var pages = function () { return Math.ceil(list().length / PAGE); };
    var cols = 6, gap = 6, x0 = (W - (cols * SLOT + (cols - 1) * gap)) / 2, rows = 5;
    var extra = (rows - 3) * (SLOT + gap), top = Math.max(70, 104 - extra / 2), y0 = top + 104;
    this.panelImg(c, 14, top, W - 28, 478 + extra);
    var title = this.txt(W / 2, top + 18, '', 21, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    c.add(title);
    // the tabs: the one you are on is green
    var tabs = {};
    [['store', 'Storage', W / 2 - 62], ['bag', 'Bag', W / 2 + 62]].forEach(function (t) {
      tabs[t[0]] = {
        on: self.button(c, t[2], top + 70, 112, 36, t[1], function () {}, GREEN),
        off: self.button(c, t[2], top + 70, 112, 36, t[1], function () { tab = t[0]; page = 0; sfx('pick'); self.refresh(); }, BROWN),
      };
    });
    var prev = this.button(c, 64, top + 30, 52, 38, '<', function () { page = (page + pages() - 1) % pages(); sfx('pick'); self.refresh(); }, BROWN);
    var next = this.button(c, W - 64, top + 30, 52, 38, '>', function () { page = (page + 1) % pages(); sfx('pick'); self.refresh(); }, BROWN);
    var widgets = [];
    for (var k = 0; k < PAGE; k++) {
      (function (k) {
        var x = x0 + (k % cols) * (SLOT + gap), y = y0 + Math.floor(k / cols) * (SLOT + gap);
        widgets.push(self.slotWidget(c, x, y, function () {
          var i = page * PAGE + k, it = list()[i];
          if (!it) return;
          var name = L.itemName(s, it.id), n;
          if (tab === 'store') {
            n = L.storeOut(s, i);
            if (!n) { sfx('nope'); return self.toast('Your bag is full. Put something away first.'); }
            self.toast('Took ' + (n > 1 ? n + ' ' : '') + name + ' into your bag.' + (s.store[i] ? ' The rest did not fit.' : ''), 1800);
          } else {
            n = L.storeIn(s, i);
            if (!n) { sfx('nope'); return self.toast('Your storage is full.'); }
            self.toast('Put ' + (n > 1 ? n + ' ' : '') + name + ' away.' + (s.inv[i] ? ' The rest did not fit.' : ''), 1800);
          }
          sfx('pick');
          F.session.dirty = true;
          w.changed();
          w.save();
          self.refresh();
        }));
      })(k);
    }
    var note = this.txt(W / 2, y0 + rows * (SLOT + gap) + 10, '', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add(note);
    this.button(c, W / 2, y0 + rows * (SLOT + gap) + 70, 120, 42, 'Close', function () { self.closeModal(); });
    this.storePage = function () { return { tab: tab, page: page }; };
    this.invRefresh = function () {
      var items = list(), n = pages();
      if (page >= n) page = n - 1;
      widgets.forEach(function (wd, k) {
        var i = page * PAGE + k, on = i < items.length;
        if (!on) {
          [wd.bg, wd.icon, wd.count, wd.barBg, wd.bar].forEach(function (o) { o.setVisible(false); });
          wd.zone.disableInteractive();
          return;
        }
        wd.bg.setVisible(true);
        wd.zone.setInteractive();
        self.drawSlot(wd, items[i], false);
      });
      ['store', 'bag'].forEach(function (t) { tabs[t].on.setVisible(tab === t); tabs[t].off.setVisible(tab !== t); });
      prev.setVisible(n > 1);
      next.setVisible(n > 1);
      var used = items.filter(Boolean).length;
      title.setText((tab === 'store' ? 'Storage' : 'Bag') + (n > 1 ? '  ' + (page + 1) + '/' + n : ''));
      note.setText((tab === 'store' ? 'Tap an item to take it into your bag. ' : 'Tap an item to put it away in storage. ') + used + ' of ' + items.length + ' slots used.');
    };
    this.invRefresh();
  };
})(window.Farm = window.Farm || {});
