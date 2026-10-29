// The Market (online, owner 27 Oct 2026): farms sell to each other. What it is for: buying what you need but can't
// make yet (out of season, or before you have the animal or the mine floor) to finish an order, a villager's request
// or a workshop recipe. The Market tab of the Online panel holds your shopping list (L.shoppingList: each item has
// Find, which lists who sells it, friends first), your stall (4 lots of up to 10, for 2 days) and what sold.
// A farm's stall is also in its More menu. The server side is supabase/farm_online_7.sql: it decides who got a lot,
// once; gold and the bag stay in each game (the buyer pays here, the seller collects later).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0xe9a91c;
  var U = F.UIScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var M = C.MARKET;
  var missing = function (e) { return /Could not find the function/i.test((e && e.message) || ''); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var lot = function (id, n) { var it = C.ITEMS[id]; return n + ' ' + (n > 1 && it.plural ? it.plural.charAt(0).toUpperCase() + it.plural.slice(1) : it.name); };
  var save = function () { F.Host.save(F.session.state); F.bus.emit('hud'); if (F.world) F.world.changed(); };

  O.TABS.splice(3, 0, ['market', 'Market']);

  var openOnline = U.openOnline;
  U.openOnline = function (tab, page, then) {
    if (tab === 'market' && O.on && F.session.state.net.named) return this.openMarket(page, then);
    return openOnline.call(this, tab, page, then);
  };

  var soon = function (self) {
    O.marketOff = true;
    self.dialog('THE MARKET\nBuying and selling between farms opens soon!');
  };

  // ---------- the Market tab ----------
  U.openMarket = function (page, then) {
    var self = this, s = F.session.state;
    if (O.marketOff) return soon(this);
    F.Net.rpc('farm_market_mine_v1', {}).then(function (mine) {
      mine = (Array.isArray(mine) ? mine : []).filter(function (r) { return r && C.ITEMS[r.item]; });
      var list = L.shoppingList(s), done = mine.some(function (r) { return r.status !== 'open'; });
      var rows = [
        {
          icon: C.ICON.book, name: 'Shopping list',
          desc: list.length ? list.length + (list.length > 1 ? ' things' : ' thing') + ' your orders, requests and workshops need.' : 'Nothing missing right now.',
          buttons: [{ label: 'Open', color: BLUE, cb: function () { self.closeModal(); self.openShoppingList(0); } }],
        },
        {
          icon: C.ICON.tag, name: 'Sell at your stall', desc: mine.length + ' of ' + M.lots + ' lots. Each stays up for 2 days.',
          buttons: [{ label: 'Sell', color: mine.length < M.lots ? GREEN : GREY, cb: function () {
            if (mine.length >= M.lots) { sfx('nope'); return self.toast(done ? 'Collect first to free a place.' : 'Your stall is full: ' + M.lots + ' lots at a time.'); }
            self.closeModal();
            self.openSell(0);
          } }],
        },
      ].concat(mine.map(function (r) {
        var left = Math.max(0, Math.round((new Date(r.expires_at).getTime() - Date.now()) / 60000));
        var row = { icon: C.ITEMS[r.item].icon, name: lot(r.item, r.qty) + '  ' + fmt(r.price) + 'G' };
        if (r.status === 'sold') {
          row.desc = 'Sold to ' + (L.cleanText(r.buyer_name, 24) || 'a farmer') + '!';
          row.buttons = [{ label: 'Collect', color: GOLD, cb: function () { self.marketCollect(false); } }];
        } else if (r.status === 'expired') {
          row.desc = 'Not sold. Collect it back.';
          row.buttons = [{ label: 'Collect', color: GREY, cb: function () { self.marketCollect(false); } }];
        } else {
          row.desc = 'For sale, ' + L.formatLeft(left) + ' left.';
          row.buttons = [{ label: 'Take back', color: GREY, cb: function () { self.takeBack(r); } }];
        }
        return row;
      }));
      self.listPanel({
        title: 'Online', tab: 'market', tabs: O.TABS, page: page || 0, rows: rows,
        reopen: function (t, p) { self.openOnline(t, p); },
        sub: function () { return 'Buy what you need from other farms. Sell your extras.'; },
      });
      if (then) then();
    }).catch(function (e) { if (missing(e)) return soon(self); self.toast('Could not reach the online world. Check your connection.'); });
  };

  // What you are missing, each with Find.
  U.openShoppingList = function (page) {
    var self = this, s = F.session.state;
    var rows = L.shoppingList(s).map(function (e) {
      return {
        icon: C.ITEMS[e.id].icon, name: lot(e.id, e.n), desc: e.why + ' You have ' + L.countItem(s, e.id) + '.',
        buttons: [{ label: 'Find', color: BLUE, cb: function () { self.closeModal(); self.openFind(e.id, function () { self.openShoppingList(page); }); } }],
      };
    });
    this.listPanel({
      title: 'Shopping list', rows: rows, page: page || 0,
      reopen: function (t, p) { self.openShoppingList(p); },
      sub: function () { return 'What your orders, requests and workshops need. Find who sells it.'; },
      empty: 'Nothing missing right now.\nOrders, villagers\' requests and workshop recipes add to this list.',
      corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openMarket(0); } },
    });
  };

  // Who sells an item: friends first, then the cheapest. back(): the panel to return to; then(): once it is up.
  U.openFind = function (id, back, then) {
    var self = this, s = F.session.state, item = C.ITEMS[id];
    if (O.marketOff) return soon(this);
    F.Net.rpc('farm_market_find_v1', { p_item: id }).then(function (list) {
      var rows = (Array.isArray(list) ? list : [])
        .filter(function (r) { return r && r.id != null; }).map(function (r) {
        var n = Math.max(1, Math.min(M.most, Number(r.qty) || 1)), price = Math.max(1, Number(r.price) || 1);
        return {
          icon: item.icon, name: L.cleanText(r.farm_name, 24) + (r.friend ? '  (friend)' : ''),
          desc: lot(id, n) + ' for ' + fmt(price) + 'G (' + Math.round(price / n) + 'G each).',
          buttons: [{ label: 'Buy', color: s.gold >= price ? GREEN : GREY, cb: function () { self.marketBuy(r, id, n, price, function (t) { self.openFind(id, back, t); }); } }],
        };
      });
      self.listPanel({
        title: item.name, rows: rows, page: 0,
        reopen: function () { self.openFind(id, back); },
        sub: function () { return 'You have ' + L.countItem(s, id) + '. You have ' + fmt(s.gold) + 'G.'; },
        empty: 'Nobody is selling ' + item.name + ' right now.\nTry again later, or ask a friend to put some up.',
        corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
      });
      if (then) then();
    }).catch(function (e) { if (missing(e)) return soon(self); self.toast('Could not reach the online world. Check your connection.'); });
  };

  U.marketBuy = function (r, id, n, price, again) {
    var self = this, s = F.session.state;
    if (s.gold < price) { sfx('nope'); return this.toast('Not enough gold.'); }
    if (!L.canAdd(s, id, n)) { sfx('nope'); return this.toast('Your bag is full!'); }
    if (this.buying) return;
    this.buying = true;
    F.Net.rpc('farm_market_buy_v1', { p_id: r.id }).then(function (res) {
      self.buying = false;
      if (res && res.ok && res.item === id) {
        var got = Math.max(1, Math.min(M.most, Number(res.qty) || n)), paid = Math.max(1, Number(res.price) || price);
        s.gold = Math.max(0, s.gold - paid);
        L.addItem(s, id, got);
        save();
        sfx('coin');
        self.closeModal();
        return again(function () { self.toast('Bought ' + lot(id, got) + ' from ' + (L.cleanText(res.seller, 24) || 'a farmer') + ' for ' + fmt(paid) + 'G.', 2800, 0x2f5a22); });
      }
      sfx('nope');
      var code = res && res.code;
      self.closeModal();
      again(function () { self.toast(code === 'limit' ? 'That is 10 buys today. Come back tomorrow!' : code === 'self' ? 'That is your own lot.' : 'Someone else bought it first.'); });
    }).catch(function () { self.buying = false; self.toast('Could not reach the online world. Check your connection.'); });
  };

  // ---------- your stall ----------
  U.openSell = function (page) {
    var self = this, s = F.session.state, seen = {};
    var rows = [];
    s.inv.forEach(function (slot) {
      if (!slot || seen[slot.id] || !L.marketable(slot.id)) return;
      seen[slot.id] = 1;
      var it = C.ITEMS[slot.id];
      rows.push({
        icon: it.icon, name: it.name, desc: 'You have ' + L.countItem(s, slot.id) + '. Sells for ' + it.sell + 'G each in town.',
        buttons: [{ label: 'Choose', color: GREEN, cb: function () { self.closeModal(); self.openSellLot(slot.id); } }],
      });
    });
    this.listPanel({
      title: 'Sell at your stall', rows: rows, page: page || 0,
      reopen: function (t, p) { self.openSell(p); },
      sub: function () { return 'Pick what to sell. Other farms find it in their Market.'; },
      empty: 'Nothing in your bag can be sold here.\nCrops, fruit, milk, eggs, fish, ore and goods can.',
      corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openMarket(0); } },
    });
  };

  // How many (1, 5 or up to 10) and for how much (low, fair, high).
  U.openSellLot = function (id, n) {
    var self = this, s = F.session.state, have = L.countItem(s, id), most = Math.min(M.most, have);
    n = Math.max(1, Math.min(most, n || most));
    var sizes = [1, 5, most].filter(function (k, i, a) { return k <= most && a.indexOf(k) === i; });
    var rows = L.marketPrices(id, n).map(function (p, k) {
      return {
        icon: C.ITEMS[id].icon, name: lot(id, n) + ' for ' + fmt(p[1]) + 'G',
        desc: [p[0] + ' price: sells fastest.', p[0] + ' price.', p[0] + ' price: for what is hard to find.'][k],
        buttons: [{ label: 'Put up', color: GREEN, cb: function () { self.putUp(id, n, p[1]); } }],
      };
    });
    var next = sizes[(sizes.indexOf(n) + 1) % sizes.length];
    this.listPanel({
      title: C.ITEMS[id].name, rows: rows, page: 0,
      reopen: function () { self.openSellLot(id, n); },
      sub: function () { return 'Selling ' + n + ' of your ' + have + '.' + (sizes.length > 1 ? ' Tap Amount to change.' : ''); },
      corner: sizes.length > 1 ? { label: 'Amount', color: BLUE, cb: function () { self.closeModal(); self.openSellLot(id, next); } } : null,
    });
  };

  U.putUp = function (id, n, price) {
    var self = this, s = F.session.state;
    if (L.countItem(s, id) < n || this.listing) return;
    this.listing = true;
    L.removeItem(s, id, n); // off the bag first: if the app closes now, nothing is copied
    save();
    var putBack = function () { L.addItem(s, id, n); save(); };
    F.Net.rpc('farm_market_list_v1', { p_item: id, p_qty: n, p_price: price }).then(function (r) {
      self.listing = false;
      if (r && r.ok) {
        sfx('coin');
        self.closeModal();
        return self.openMarket(0, function () { self.toast(lot(id, n) + (n > 1 ? ' are' : ' is') + ' up at your stall for ' + fmt(price) + 'G.', 2600, 0x2f5a22); });
      }
      putBack();
      sfx('nope');
      self.toast(r && r.code === 'full' ? 'Your stall is full: ' + M.lots + ' lots at a time.' : 'That could not go up for sale.');
    }).catch(function (e) {
      self.listing = false;
      putBack();
      if (missing(e)) return soon(self);
      self.toast('Could not reach the online world. Check your connection.');
    });
  };

  U.takeBack = function (r) {
    var self = this, s = F.session.state;
    if (!L.canAdd(s, r.item, r.qty)) { sfx('nope'); return this.toast('Make room in your bag first.'); }
    F.Net.rpc('farm_market_cancel_v1', { p_id: r.id }).then(function (res) {
      var back = res && res.ok && C.ITEMS[res.item];
      if (back) {
        L.addItem(s, res.item, Math.max(1, Math.min(M.most, Number(res.qty) || 1)));
        save();
        sfx('pick');
      }
      self.closeModal();
      self.openMarket(0, back ? null : function () { self.toast('It just sold!'); });
    }).catch(function () { self.toast('Could not reach the online world. Check your connection.'); });
  };

  // The gold for what sold and the lots that did not (into the bag; the shipping box if the bag is full).
  U.marketCollect = function (auto) {
    var self = this;
    return O.marketCollect().then(function (r) {
      if (!auto) { self.closeModal(); self.openMarket(0, r ? function () { self.toast(r, 3600, 0x7a4d12); } : null); }
    });
  };
  O.marketCollect = function () {
    if (!O.on || O.marketOff || O.collectingMarket) return Promise.resolve(null);
    O.collectingMarket = true;
    return F.Net.rpc('farm_market_collect_v1', {}).then(function (r) {
      O.collectingMarket = false;
      var s = F.session.state, gold = 0, who = [], lines = [], boxed = 0;
      (r && Array.isArray(r.sold) ? r.sold : []).forEach(function (x) {
        if (!x || !C.ITEMS[x.item]) return;
        gold += Math.max(0, Math.min(100000, Number(x.price) || 0));
        var b = L.cleanText(x.buyer, 24);
        if (b && who.indexOf(b) < 0) who.push(b);
      });
      (r && Array.isArray(r.returned) ? r.returned : []).forEach(function (x) {
        if (!x || !C.ITEMS[x.item]) return;
        var n = Math.max(1, Math.min(M.most, Number(x.qty) || 1)), left = L.addItem(s, x.item, n);
        if (left > 0) { // a full bag: it goes in the shipping box (sold in the morning)
          var e = s.box.filter(function (b) { return b.id === x.item; })[0];
          if (e) e.n += left; else s.box.push({ id: x.item, n: left });
          boxed += left;
        }
        lines.push(lot(x.item, n));
      });
      if (!gold && !lines.length) return null;
      s.gold += gold;
      if (gold) s.stats.earned += gold;
      save();
      if (gold) sfx('coin');
      var text = (gold ? (who.length ? who.slice(0, 3).join(', ') + (who.length > 3 ? ' and more' : '') : 'Farmers') + ' bought from your stall: +' + fmt(gold) + 'G!' : '') +
        (lines.length ? (gold ? '\n' : '') + 'Back from your stall: ' + lines.join(', ') + '.' + (boxed ? ' (Your bag was full: some went in the shipping box.)' : '') : '');
      return text;
    }, function (e) {
      O.collectingMarket = false;
      if (missing(e)) O.marketOff = true;
      return null;
    });
  };
  var collect = O.collect;
  O.collect = function (auto) {
    return collect.call(O, auto).then(function (got) {
      O.marketCollect().then(function (text) { if (text && F.ui) F.ui.toast(text, 3600, 0x7a4d12); }, noop);
      return got;
    });
  };

  // ---------- a farm's stall (its More menu) ----------
  // On a visit the Online button is away (the visit bar is there), so More also opens your own Market (owner, 28 Oct).
  U.marketRow = function () {
    var self = this;
    return {
      icon: C.ICON.book, name: 'Your Market', desc: 'Your shopping list, Find, and your stall.',
      buttons: [{ label: 'Open', color: BLUE, cb: function () { self.swapTo(function () { self.openMarket(0); }); } }],
    };
  };
  U.stallRow = function (id, who, back) {
    var self = this;
    return {
      icon: C.ICON.tag, name: who + "'s stall", desc: 'What this farm is selling.',
      buttons: [{ label: 'Look', color: GREEN, cb: function () { self.closeModal(); self.openStall(id, who, back); } }],
    };
  };
  U.openStall = function (id, who, back, then) {
    var self = this, s = F.session.state;
    if (O.marketOff) return soon(this);
    F.Net.rpc('farm_market_of_v1', { p_host: id }).then(function (list) {
      var rows = (Array.isArray(list) ? list : []).filter(function (r) { return r && C.ITEMS[r.item]; }).map(function (r) {
        var n = Math.max(1, Math.min(M.most, Number(r.qty) || 1)), price = Math.max(1, Number(r.price) || 1);
        return {
          icon: C.ITEMS[r.item].icon, name: lot(r.item, n), desc: fmt(price) + 'G (' + Math.round(price / n) + 'G each). You have ' + L.countItem(s, r.item) + '.',
          buttons: [{ label: 'Buy', color: s.gold >= price ? GREEN : GREY, cb: function () { self.marketBuy(r, r.item, n, price, function (t) { self.openStall(id, who, back, t); }); } }],
        };
      });
      self.listPanel({
        title: who + "'s stall", rows: rows, page: 0,
        reopen: function () { self.openStall(id, who, back); },
        sub: function () { return 'You have ' + fmt(s.gold) + 'G.'; },
        empty: who + ' is not selling anything right now.',
        corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.playerMenu(id, who, back); } } : null, // (no back: from their town's stall)
      });
      if (then) then();
    }).catch(function (e) { if (missing(e)) return soon(self); self.toast('Could not reach the online world. Check your connection.'); });
  };

})(window.Farm = window.Farm || {});
