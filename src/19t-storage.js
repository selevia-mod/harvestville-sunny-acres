// Home storage (owner, 30 Oct 2026): tap a Dresser or a Wardrobe at home and choose Storage. Two tabs: Storage
// (tap an item to take it into your bag) and Bag (tap an item to put it away). 30 slots a page, like the bag.
// One cabinet, one storage (owner, 5 Nov 2026): each cabinet opens its own 60 slots. Rules in 01-logicC.js.
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
    var b = o.item != null ? L.boxOf(F.session.state, o.item) : 0;
    if (b < 0) return { label: 'Storage', icon: C.ICON.chest, disabled: true, why: 'You have ' + C.STORE_BOXES + ' cabinets keeping things already.' };
    return { label: 'Storage', icon: C.ICON.chest, run: function () { F.ui.openItemStorage(null, b); } };
  };

  U.openItemStorage = function (tab, box) {
    var self = this, s = F.session.state, w = F.world;
    var c = this.openModal();
    tab = tab || 'store';
    box = Math.max(0, Math.min(L.boxCount(s) - 1, box || 0));
    var inBox = function (fn) { return L.inBox(s, box, fn); };
    var page = 0, moving = null; // moving: the slot picked up with Move
    var list = function () { return tab === 'store' ? L.boxSlots(s, box) : s.inv; };
    var saved = function () {
      F.session.dirty = true;
      w.changed();
      w.save();
    };
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
        off: self.button(c, t[2], top + 70, 112, 36, t[1], function () { tab = t[0]; page = 0; moving = null; sfx('pick'); self.refresh(); }, BROWN),
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
          if (moving != null) {
            var from = moving, r = tab === 'store' ? inBox(function () { return L.moveStore(s, from, i); }) : L.moveSlot(s, moving, i);
            moving = null;
            if (r === 'ok') { sfx('pick'); saved(); }
            self.refresh();
            return;
          }
          if (it) self.openStoreItem(tab, i, function () { moving = i; self.refresh(); }, saved, box);
        }));
      })(k);
    }
    var note = this.txt(W / 2, y0 + rows * (SLOT + gap) + 10, '', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add(note);
    this.button(c, W / 2, y0 + rows * (SLOT + gap) + 70, 120, 42, 'Close', function () { self.closeModal(); });
    this.storePage = function () { return { tab: tab, page: page, box: box }; };
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
        wd.icon.setAlpha(moving === i ? 0.45 : 1);
      });
      ['store', 'bag'].forEach(function (t) { tabs[t].on.setVisible(tab === t); tabs[t].off.setVisible(tab !== t); });
      prev.setVisible(n > 1);
      next.setVisible(n > 1);
      var used = items.filter(Boolean).length;
      title.setText((tab === 'store' ? (L.cabinets(s).length > 1 ? L.boxName(s, box) : 'Storage') : 'Bag') + (n > 1 ? '  ' + (page + 1) + '/' + n : ''));
      note.setText(moving != null && items[moving] ? 'Now tap where to put the ' + L.itemName(s, items[moving].id) + '.' + (n > 1 ? ' The arrows change page.' : '') : 'Tap an item to read about it, ' + (tab === 'store' ? 'take it or move it. ' : 'put it away or move it. ') + used + ' of ' + items.length + ' slots used.');
    };
    this.invRefresh();
  };

  // One item in the box or the bag: what it is, how many to move across, and Move to arrange it.
  U.openStoreItem = function (tab, i, onMove, saved, box) {
    box = box || 0;
    var self = this, s = F.session.state, store = tab === 'store', it = (store ? L.boxSlots(s, box) : s.inv)[i], def = C.ITEMS[it.id] || {};
    var where = L.cabinets(s).length > 1 ? 'This ' + L.boxName(s, box) : 'Your storage';
    var c = this.openModal(), h = 262, top = (C.VIEW_H - h) / 2, name = L.itemName(s, it.id);
    this.panelImg(c, 34, top, W - 68, h);
    c.add(this.add.image(W / 2, top + 42, 'items', L.iconOf(s, it.id)).setScale(0.42));
    c.add(this.txt(W / 2, top + 72, name + (it.n > 1 ? '  x' + it.n : ''), 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var d = def.desc || '';
    if (L.energyOf(it.id)) d += ' (+' + L.energyOf(it.id) + ' energy)';
    if (def.sell) d += ' Sells for ' + def.sell + 'G.';
    c.add(this.txt(W / 2, top + 96, d, 12, '#5a3a1e', { align: 'center', wordWrap: { width: W - 96 } }).setOrigin(0.5, 0));
    var move = function (n) {
      var moved = L.inBox(s, box, function () { return store ? L.storeOut(s, i, n) : L.storeIn(s, i, n); });
      self.closeModal();
      if (!moved) { sfx('nope'); return self.toast(store ? 'Your bag is full. Put something away first.' : where + ' is full.' + (L.cabinets(s).length > 1 ? ' Try another cabinet.' : ' Another Dresser or Wardrobe gives you 60 more slots.')); }
      self.toast((store ? 'Took ' : 'Put ') + (moved > 1 ? moved + ' ' : '') + name + (store ? ' into your bag.' : ' away.'), 1800);
      sfx('pick');
      saved();
      self.refresh();
    };
    var y = top + 172, half = Math.floor(it.n / 2), amounts = it.n === 1 ? [[store ? 'Take' : 'Put away', 1]] : [['1', 1]];
    if (it.n > 10) amounts.push(['10', 10]);
    if (half > 1) amounts.push(['Half', half]);
    if (it.n > 1) amounts.push(['All', it.n]);
    if (it.n > 1) c.add(this.txt(W / 2, y - 26, store ? 'How many to take?' : 'How many to put away?', 12, '#7a5a3a').setOrigin(0.5, 0));
    var bw = it.n === 1 ? 150 : 62;
    amounts.forEach(function (a, k) { self.button(c, W / 2 + (k - (amounts.length - 1) / 2) * (bw + 6), y + 8, bw, 36, a[0], function () { move(a[1]); }, GREEN); });
    this.button(c, W / 2 - 62, y + 56, 112, 36, 'Move', function () { self.closeModal(); onMove(); }, BROWN);
    this.button(c, W / 2 + 62, y + 56, 112, 36, 'Close', function () { self.closeModal(); }, BROWN);
  };
})(window.Farm = window.Farm || {});
