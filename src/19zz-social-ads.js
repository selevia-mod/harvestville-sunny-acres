// The Market board (owner, 4 Nov 2026: "ads for your market stall"; server supabase/farm_online_17.sql). In the Market
// tab of the Online panel: Advertise puts your stall on the board for 4 hours, free once a day, with what you sell; Look
// opens the board: the farms on it now (friends first), each with its cheapest lots, Stall to buy (the Market's own
// buying, U.marketBuy) and Visit to go to their farm. Before part 17 is applied it hides quietly (O.adsOff).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var M = C.MARKET;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, INK_GREEN = 0x2f5a22;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var lot = function (id, n) { var it = C.ITEMS[id]; return n + ' ' + (n > 1 && it.plural ? it.plural.charAt(0).toUpperCase() + it.plural.slice(1) : it.name); };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var off = function (e) { if (missing(e)) O.adsOff = true; return O.adsOff; };
  var net = 'Could not reach the online world. Check your connection.';

  O.ads = null; // the last farm_market_ads_v1, read (L.adsRead), and when
  var at = 0;
  O.adsLoad = function () {
    if (!O.on || O.adsOff) return Promise.resolve(null);
    return F.Net.rpc('farm_market_ads_v1', {}).then(function (r) {
      var a = L.adsRead(r);
      if (a) { O.ads = a; at = Date.now(); }
      return O.ads;
    }, function (e) { off(e); return null; });
  };
  F.bus.on('online', function () { if (!O.on) O.ads = null; });
  // how mine stands now (the minutes count down from when it was read)
  var mine = function () {
    var m = O.ads && O.ads.mine, gone = (Date.now() - at) / 60000;
    if (!m) return null;
    return { on: m.on && m.leftMin - gone > 0, leftMin: m.leftMin - gone, used: m.used && m.nextMin - gone > 0, nextMin: m.nextMin - gone, hours: m.hours };
  };

  // The Market tab waits for the board the first time (so its row is there), and refreshes it after.
  var openMarket = U.openMarket;
  U.openMarket = function (page, then) {
    var self = this, args = arguments, go = function () { openMarket.apply(self, args); };
    if (O.ads || O.adsOff || !O.on) {
      if (O.ads && Date.now() - at > 30000) O.adsLoad();
      if (self.adsTour && self.adsTour(go)) return;
      return go();
    }
    O.adsLoad().then(function () { if (!(self.adsTour && self.adsTour(go))) go(); });
  };

  U.adsRow = function () {
    var self = this, m = mine();
    if (!O.on || O.adsOff || !m) return null;
    var n = O.ads.ads.length, b = [{ label: 'Look', color: BLUE, cb: function () { self.swapTo(function () { self.openAds(); }); } }];
    if (!m.on && !m.used) b.push({ label: 'Advertise', color: GREEN, cb: function () { self.advertise(); } });
    return {
      icon: C.ICON.crate, name: 'Market board',
      desc: m.on ? 'Your stall is on it: ' + L.formatLeft(m.leftMin) + ' left.' : (n ? n + (n > 1 ? ' farms' : ' farm') + ' on it now.' : 'See who is selling today.') +
        (m.used ? ' Yours again in ' + L.formatLeft(m.nextMin) + '.' : ' Show your stall: free once a day.'),
      buttons: b,
    };
  };
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    if (o && o.title === 'Online' && o.tab === 'market' && Array.isArray(o.rows) && !o.adsDone) {
      o.adsDone = true;
      var row = this.adsRow();
      if (row) o.rows = o.rows.slice(0, 2).concat([row], o.rows.slice(2));
    }
    return listPanel.call(this, o);
  };

  U.advertise = function () {
    var self = this;
    if (this.adBusy) return;
    this.adBusy = true;
    F.Net.rpc('farm_market_ad_v1', {}).then(function (r) {
      self.adBusy = false;
      var code = r && r.code;
      if (r && r.ok) {
        sfx('coin');
        var hours = Math.round((Number(r.until_s) || C.ADS.hours * 3600) / 3600);
        return O.adsLoad().then(function () {
          self.swapTo(function () { self.openMarket(0, function () { self.toast('Your stall is on the Market board for ' + hours + ' hours!', 2800, INK_GREEN); }); });
        });
      }
      sfx('nope');
      if (code === 'used') return self.toast('You used today\'s. Free again in ' + L.formatLeft((Number(r.next_s) || 3600) / 60) + '.', 2600);
      self.toast(code === 'empty' ? 'Put something up for sale first: Sell at your stall.' : 'That did not work.', 2600);
    }).catch(function (e) { self.adBusy = false; self.toast(off(e) ? 'Coming soon!' : net); });
  };

  // ---------- the board ----------
  U.openAds = function (then) {
    var self = this, ticket = this.swapping;
    O.adsLoad().then(function (a) {
      if (self.swapGone(ticket)) return;
      if (!a) { self.swapping = null; return self.toast(O.adsOff ? 'Coming soon!' : net); }
      var rows = a.ads.filter(function (x) { return !O.blocked[x.id]; }).map(function (x) {
        var more = x.lots - x.items.length;
        return {
          id: x.id, icon: C.ITEMS[x.items[0].item].icon, name: x.name + (x.friend ? '  (friend)' : ''),
          desc: L.adItems(x.items) + (more > 0 ? ', and ' + more + ' more' : '') + '.',
          buttons: [{ label: 'Stall', color: GREEN, cb: function () { self.swapTo(function () { self.openAdStall(x.id, x.name); }); } },
            { label: 'Visit', color: BLUE, cb: function () { O.visit(x.id); } }],
        };
      });
      self.listPanel({
        title: 'Market board', rows: rows, page: 0,
        reopen: function () { self.openAds(); },
        sub: function () { return 'Farms showing off their stalls today. Tap Stall to buy.'; },
        empty: 'No stalls on the board right now.\nPut yours on it: Advertise, in your Market.',
        corner: { label: 'Back', color: GREY, cb: function () { self.swapTo(function () { self.openMarket(0); }); } },
      });
      if (then) then();
    });
  };

  // One farm's stall from the board: buy with the Market's own buying; Back to the board.
  U.openAdStall = function (id, who, then) {
    var self = this, s = F.session.state, ticket = this.swapping;
    F.Net.rpc('farm_market_of_v1', { p_host: id }).then(function (list) {
      if (self.swapGone(ticket)) return;
      var rows = (Array.isArray(list) ? list : []).filter(function (r) { return r && C.ITEMS[r.item]; }).map(function (r) {
        var n = Math.max(1, Math.min(M.most, Number(r.qty) || 1)), price = Math.max(1, Number(r.price) || 1);
        return {
          icon: C.ITEMS[r.item].icon, name: lot(r.item, n), desc: fmt(price) + 'G (' + Math.round(price / n) + 'G each). You have ' + L.countItem(s, r.item) + '.',
          buttons: [{ label: 'Buy', color: s.gold >= price ? GREEN : GREY, cb: function () { self.marketBuy(r, r.item, n, price, function (t) { self.openAdStall(id, who, t); }); } }],
        };
      });
      self.listPanel({
        title: who + "'s stall", rows: rows, page: 0,
        reopen: function () { self.openAdStall(id, who); },
        sub: function () { return 'You have ' + fmt(s.gold) + 'G.'; },
        empty: who + ' sold everything already!',
        corner: { label: 'Back', color: GREY, cb: function () { self.swapTo(function () { self.openAds(); }); } },
      });
      if (then) then();
    }).catch(function () { self.swapping = null; self.toast(net); });
  };
})(window.Farm = window.Farm || {});
