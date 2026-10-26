// Selebox around the farm (owner, 26 Oct 2026, items 11, 13, 14): share a picture of your farm to the Selebox feed
// (gameHost.share), and, for Selebox moderators (gameHost.staff), the reported farms and the play numbers. The
// database side is supabase/farm_online_3.sql; the server checks staff itself, gameHost.staff only shows the rows.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var W = F.UI_CONST.W;
  var U = F.UIScene.prototype;
  var SHARE_W = 720;
  var BLUE = 0x4a90c9, GREY = 0xa08a68, RED = 0xc0503a, GREEN = 0x5fa84a;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var host = function () { return window.gameHost || {}; };
  var name = function (n) { return L.cleanText(n, 24) || 'Farmer'; };
  var oops = function (self) { return function () { self.toast('That did not work. Please try again.'); }; };

  // ---------- share my farm ----------
  // The words that go with the picture: plain and fixed, plus the friend code when online.
  L.shareText = function (s, code) {
    var beauty = L.homeBeauty(s);
    return 'My farm in Harvest Ville! Home Beauty ' + beauty + ', house level ' + s.home.level + '.' +
      (code ? ' Visit me with my friend code ' + code + '.' : ' Come and play with me on Selebox.');
  };

  U.shareFarm = function () {
    var self = this, h = host();
    if (typeof h.share !== 'function') return;
    if (F.session.visit) return this.toast('Go home to share your own farm.');
    this.closeAll();
    // two frames so the panel is gone from the picture, then the whole screen as a JPEG
    this.time.delayedCall(80, function () {
      self.game.renderer.snapshot(function (img) {
        var text = L.shareText(F.session.state, F.Online && F.Online.on && F.Online.me ? F.Online.me.code : null);
        try {
          // at most 720 wide, so the picture stays small on its way to the app (a few hundred KB)
          var k = Math.min(1, SHARE_W / (img.width || SHARE_W)), cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k);
          cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          h.share({ text: text, image: cv.toDataURL('image/jpeg', 0.82), width: cv.width, height: cv.height });
        } catch (e) { self.toast('Sharing is not available right now.'); }
      }, 'image/png');
    });
  };

  // Share, next to Rename on the Online › Me tab (also in the pause menu).
  U.shareButtons = function () {
    var self = this;
    return typeof host().share === 'function' ? [{ label: 'Share', color: BLUE, cb: function () { self.shareFarm(); } }] : [];
  };

  // Rows the Online › Me tab adds for Selebox moderators.
  U.meExtras = function () {
    var self = this, h = host(), rows = [];
    if (h.staff) {
      rows.push({ icon: C.ICON.exclaim, name: 'Staff: reported farms', desc: 'Check reports, then clear, hide or rename.', buttons: [{ label: 'Open', color: RED, cb: function () { self.closeModal(); self.openReports(); } }] });
      rows.push({ icon: C.ICON.ribbon, name: 'Staff: play numbers', desc: 'Players, minutes and who comes back.', buttons: [{ label: 'Open', color: GREY, cb: function () { self.closeModal(); self.openStats(); } }] });
    }
    return rows;
  };

  // ---------- staff: reported farms ----------
  var back = function (self) { return function () { self.closeModal(); self.openOnline('me', 0); }; };

  U.openReports = function (then) {
    var self = this;
    F.Net.rpc('farm_reports_v1', {}).then(function (list) {
      var rows = (list || []).map(function (r) {
        var n = name(r.farm_name), k = Number(r.reporters) || 0;
        return {
          icon: C.ICON.exclaim, name: n, tag: r.hidden ? 'HIDDEN' : null,
          desc: k + ' report' + (k === 1 ? '' : 's') + ': ' + String(r.reasons || '').replace(/messages/, 'rude messages').replace(/name/, 'rude name') + '.',
          buttons: [{ label: 'Review', color: RED, cb: function () { self.closeModal(); self.reviewReport(r); } }],
        };
      });
      self.listPanel({
        title: 'Reported farms', rows: rows, page: 0, corner: { label: 'Back', color: GREY, cb: back(self) },
        reopen: function () { self.closeModal(); self.openReports(); },
        sub: function () { return 'Three reports hide a farm until you decide.'; }, empty: 'No open reports. All quiet!',
      });
      if (then) then();
    }).catch(oops(self));
  };

  // One reported farm: what the reporters saw (the name and the last messages, kept by the server), and the decision.
  U.reviewReport = function (r) {
    var self = this, id = String(r.id), n = name(r.farm_name), ev = r.evidence || {};
    var said = (ev.messages || []).slice(0, 3).map(function (m) { return '"' + L.cleanText(m && m.body, 60) + '"'; }).join(' ');
    var decide = function (action, done) {
      return function () {
        F.Net.rpc('farm_moderate_v1', { p_target: id, p_action: action }).then(function (res) {
          self.closeModal();
          self.openReports(function () { self.toast(res === 'ok' ? done : 'That farm is gone already.', 2400, res === 'ok' ? 0x2f5a22 : undefined); });
        }).catch(oops(self));
      };
    };
    this.listPanel({
      title: n, page: 0, corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openReports(); } },
      reopen: function () { self.closeModal(); self.reviewReport(r); },
      sub: function () { return 'Reported as "' + name(ev.farm_name || n) + '".'; },
      rows: [
        { icon: C.ICON.letter, name: said ? 'Their last messages' : 'No messages kept', desc: said || (r.notes ? 'Note: ' + L.cleanText(r.notes, 80) : 'Only the farm name was reported.') },
        { icon: C.ICON.sparkle, name: 'Nothing wrong', desc: 'Show the farm again and close the reports.', buttons: [{ label: 'Clear', color: GREEN, cb: decide('clear', n + ' is shown again.') }] },
        { icon: C.ICON.tag, name: 'Rude name', desc: 'Give it a plain name and show it again.', buttons: [{ label: 'Rename', color: BLUE, cb: decide('rename', n + ' has a plain name now.') }] },
        { icon: C.ICON.exclaim, name: 'Keep it hidden', desc: 'Out of lists and ranks. Friends can still visit.', buttons: [{ label: 'Hide', color: RED, cb: decide('keep', n + ' stays hidden.') }] },
      ],
    });
  };

  // ---------- staff: play numbers ----------
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  L.statDay = function (iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    return isNaN(d) ? String(iso) : DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  };

  U.openStats = function () {
    var self = this;
    F.Net.rpc('farm_stats_v1', { p_days: 14 }).then(function (list) {
      list = list || [];
      var num = function (v) { return Number(v) || 0; };
      var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
      var week = list.slice(0, 7), sum = function (k) { return week.reduce(function (a, d) { return a + num(d[k]); }, 0); };
      var rows = [{
        icon: C.ICON.ribbon, name: 'Last 7 days',
        desc: plural(sum('new_players'), 'new player') + ', ' + plural(sum('minutes'), 'minute') + ' played, busiest day ' + plural(Math.max.apply(null, week.map(function (d) { return num(d.players); }).concat(0)), 'player') + '.',
      }].concat(list.map(function (d) {
        var nw = num(d.new_players);
        return {
          icon: C.ICON.spring, name: L.statDay(d.day) + ': ' + num(d.players) + ' playing',
          desc: nw + ' new, ' + (Number(d.avg_minutes) || 0) + ' min each' + (nw ? '. Back next day ' + num(d.back_next_day) + ', in 7 days ' + num(d.back_in_7_days) : '') + '.',
        };
      }));
      self.listPanel({
        title: 'Play numbers', rows: rows, page: 0, corner: { label: 'Back', color: GREY, cb: back(self) },
        reopen: function () { self.closeModal(); self.openStats(); },
        sub: function () { return 'Players who opened Harvest Ville in Selebox (Manila days).'; }, empty: 'No plays yet.',
      });
    }).catch(oops(self));
  };

  // ---------- energy refills for Selebox Coins or Stars (owner, 26 Oct: 5 Coins or 10 Stars, 100 energy) ----------
  // In the app with gameHost.shop: the server holds the prices and takes the payment (farm_buy_v1); the game adds the
  // energy once the server says it is paid. Each tap has its own request id; after a lost answer the same tap is
  // sent again and the server answers "already paid" instead of charging twice.
  var CUR = { coins: 'Selebox Coins', stars: 'Selebox Stars' };
  var one = { coins: 'Selebox Coin', stars: 'Selebox Star' };
  var curName = function (cur, n) { return n + ' ' + (n === 1 ? one[cur] : CUR[cur]); };
  L.canRefill = function () { return !!(host().shop && F.Net.available()); };

  // Energy after a refill of `amount`: never above the max (a refill tops it up).
  L.refill = function (s, amount) {
    var before = s.energy, max = L.maxEnergy(s);
    s.energy = Math.min(max, s.energy + Math.max(0, Math.floor(amount) || 0));
    if (s.energy >= max) s.regen = L.nowMin();
    return s.energy - before;
  };

  var requestId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };

  U.openRefill = function (then) {
    var self = this, s = F.session.state;
    if (!L.canRefill()) return;
    F.Net.rpc('farm_shop_v1', {}).then(function (shop) {
      var wallet = (shop && shop.wallet) || {}, left = Number(shop && shop.left) || 0, max = L.maxEnergy(s);
      var rows = ((shop && shop.offers) || []).filter(function (o) { return o.item === 'energy'; }).map(function (o) {
        var have = Number(wallet[o.currency]) || 0, price = Number(o.price) || 0, short = have < price;
        var buttons = short
          ? (typeof host().store === 'function' && o.currency === 'coins' ? [{ label: 'Get Coins', color: BLUE, cb: function () { self.closeAll(); host().store(); } }] : [])
          : [{ label: 'Buy', color: GREEN, cb: function () { self.buyRefill(o); } }];
        return {
          icon: C.ICON.bolt, name: '+' + o.amount + ' energy for ' + curName(o.currency, price),
          desc: 'You have ' + curName(o.currency, have) + (short ? ': not enough yet.' : '.'), buttons: buttons,
        };
      });
      self.listPanel({
        title: 'Refill energy', rows: rows, page: 0,
        reopen: function () { self.closeModal(); self.openRefill(); },
        sub: function () { return 'Energy ' + Math.floor(s.energy) + ' / ' + max + '.  ' + (left ? left + ' refill' + (left === 1 ? '' : 's') + ' left today.' : 'No refills left today.'); },
        empty: 'Refills are not on sale right now.',
      });
      if (then) then();
    }).catch(function () { self.toast('Could not reach Selebox. Check your connection.'); });
  };

  var SAY = {
    'insufficient-coins': 'Not enough Selebox Coins. Nothing was taken.',
    'insufficient-stars': 'Not enough Selebox Stars. Nothing was taken.',
    'offer-changed': 'The price just changed. Please look again.',
    'offer-unavailable': 'Refills are not on sale right now.',
    limit: 'That is 20 refills today. More tomorrow!',
    'account-unavailable': 'Your Selebox account cannot buy right now.',
    'wallet-unavailable': 'Your Selebox wallet is not ready. Please try again later.',
  };

  // A refill: asked once (real Coins or Stars), then sent with a request id that is saved first, so an answer lost
  // to a bad connection, a closed app or a crash is settled later instead of being lost (L.cleanBuys, 01-logic8.js).
  var SETTLE_AFTER = 30000; // ms: an unanswered refill older than this is checked with the server
  var save = function (s) { if (F.world && F.world.save) F.world.save(); else F.Host.save(s); };
  var spent = function () { if (typeof host().spent === 'function') { try { host().spent(); } catch (e) { /* optional */ } } };

  // Asks the server about one unanswered refill without paying (price 0 is never a real price: a known request gets
  // its receipt back, an unknown one is refused before any payment). Resolves 'given' | 'none' | 'offline'.
  var settleOne = function (b) {
    var s = F.session.state;
    return F.Net.rpc('farm_buy_v1', { p_item: 'energy', p_currency: b[1], p_price: 0, p_version: b[3], p_request_id: b[0] }).then(function (r) {
      s.net.pb = s.net.pb.filter(function (x) { return x[0] !== b[0]; });
      var gain = r && r.ok ? L.refill(s, Number(r.amount) || 0) : null;
      save(s);
      if (gain === null) return 'none';
      spent();
      if (F.ui) F.ui.toast('Your last refill arrived: +' + gain + ' energy.', 2600, 0x2f5a22);
      return 'given';
    }, function () { return 'offline'; });
  };

  // Settles every unanswered refill old enough (at the start, and before a new one). Resolves 'clear' (none left),
  // 'given' (an earlier refill's energy just arrived) or 'waiting' (one is too recent to check, or no connection).
  L.settleRefills = function () {
    var s = F.session.state, now = Date.now(), list = (s.net && s.net.pb) || [], given = false;
    var old = list.filter(function (b) { return now - b[4] >= SETTLE_AFTER || b[4] > now; });
    if (!old.length || !L.canRefill()) return Promise.resolve(list.length ? 'waiting' : 'clear');
    return old.reduce(function (p, b) {
      return p.then(function () { return settleOne(b).then(function (r) { if (r === 'given') given = true; }); });
    }, Promise.resolve()).then(function () { return given ? 'given' : s.net.pb.length ? 'waiting' : 'clear'; });
  };

  U.buyRefill = function (o) {
    var self = this, s = F.session.state, max = L.maxEnergy(s), e = Math.floor(s.energy);
    if (e >= max) return this.toast("You're already full of energy.");
    if (this.buying) return;
    var gain = Math.min(max, e + (Number(o.amount) || 0)) - e;
    this.confirm('REFILL ENERGY?\n+' + gain + ' energy (' + e + ' to ' + (e + gain) + ') for ' + curName(o.currency, o.price) + '.', function () {
      self.buying = true;
      L.settleRefills().then(function (state) {
        if (state !== 'clear') {
          self.buying = false;
          if (state === 'given') { self.closeAll(); self.refresh(); return; } // that one is what they were paying for
          return self.toast('Still checking your last refill. Try again in a moment.', 2600);
        }
        var b = [requestId(), o.currency, o.price, o.version, Date.now()];
        s.net.pb = (s.net.pb || []).concat([b]);
        save(s); // before sending: an answer lost from here on is settled later
        return F.Net.rpc('farm_buy_v1', { p_item: 'energy', p_currency: b[1], p_price: b[2], p_version: b[3], p_request_id: b[0] }).then(function (r) {
          self.buying = false;
          s.net.pb = s.net.pb.filter(function (x) { return x[0] !== b[0]; }); // answered: nothing left to settle
          if (!r || !r.ok) {
            save(s);
            self.closeAll();
            return self.openRefill(function () { self.toast(SAY[r && r.code] || 'That did not work. Nothing was taken.', 2600); });
          }
          var got = L.refill(s, Number(r.amount) || 0);
          save(s);
          spent();
          self.closeAll();
          self.refresh();
          self.toast('+' + got + ' energy! Paid ' + curName(r.currency, Number(r.price) || 0) + '.', 2600, 0x2f5a22);
          sfx('coin');
        }, function () {
          self.buying = false; // kept in s.net.pb: settled on the next tap or the next start, never paid twice
          self.toast('Could not reach Selebox. If it was paid, the energy comes the next time you play.', 3200);
        });
      });
    });
  };

  void W;
})(window.Farm = window.Farm || {});
