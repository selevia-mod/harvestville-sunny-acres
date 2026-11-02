// The Town Goal and Best Farm of the Week on screen: the Town tab of the Online panel, a crown by last week's best farm
// in the Online lists, and the prizes when the game connects. Rules: 01-logicI.js. All of it stays hidden until the
// server has it (supabase/farm_online_12.sql): if the calls fail, no tab, no crown, no message.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9;
  var T = C.TOWN;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var RETRY = 300000; // a call that failed is tried again this long after, if you open the Online panel

  O.town = null;
  O.best = null;
  var tried = 0;

  var showTab = function () {
    var has = O.TABS.some(function (t) { return t[0] === 'town'; }), want = !!(O.town || O.best);
    if (want && !has) O.TABS.splice(O.TABS.length - 1, 0, ['town', 'Town']); // before Me
    if (!want && has) O.TABS.splice(O.TABS.map(function (t) { return t[0]; }).indexOf('town'), 1);
  };

  // Both answers, or nothing: never fails.
  O.townLoad = function () {
    tried = Date.now();
    return Promise.all([
      F.Net.rpc('farm_town_goal_v1', {}).then(L.townRead, function () { return null; }),
      F.Net.rpc('farm_best_v1', {}).then(L.bestRead, function () { return null; }),
    ]).then(function (both) {
      O.town = both[0];
      O.best = both[1];
      showTab();
    });
  };

  // ---------- prizes ----------
  // When the game connects, after the rank prizes. The server says how much, once; a panel says what was won.
  O.townClaim = function () {
    var claim = function (name, gold, stars) {
      return F.Net.rpc(name, {}).then(function (list) { return L.claimRead(list, gold, stars); }, function () { return []; });
    };
    return Promise.all([claim('farm_town_claim_v1', T.maxGold, T.maxStars), claim('farm_best_claim_v1', T.bestGold, T.bestStars)]).then(function (both) {
      var town = both[0], best = both[1];
      if (!town.length && !best.length) return;
      var s = F.session.state, words = function (p) { return '+' + fmt(p.gold) + 'G and ' + p.stars + (p.stars > 1 ? ' Sunbeams' : ' Sunbeam'); };
      L.payClaims(s, town);
      L.payClaims(s, best);
      F.Host.save(s);
      F.bus.emit('hud');
      sfx('coin');
      var rows = town.map(function (p) { return [C.ICON.ribbon, 'The town reached its goal: ' + words(p)]; })
        .concat(best.map(function (p) { return [C.ICON.star, 'Best Farm of the Week: ' + words(p)]; }));
      var show = function () {
        if (!F.ui || F.ui.modals.length) return setTimeout(show, 1500);
        F.ui.dialog('TOWN PRIZES', null, { rows: rows });
      };
      show();
    });
  };
  var prizes = O.prizes;
  O.prizes = function () {
    return prizes.call(O).then(function (won) {
      return O.townClaim().then(O.townLoad).then(function () { return won; });
    });
  };

  // ---------- the Town tab ----------
  var openOnline = U.openOnline;
  U.openOnline = function (tab, page, then) {
    if (tab === 'town' && O.on && F.session.state.net.named) return this.openTown(page, then);
    if (O.on && !O.town && !O.best && Date.now() - tried > RETRY) O.townLoad();
    return openOnline.call(this, tab, page, then);
  };

  U.openTown = function (page, then) {
    var self = this, ticket = this.swapping;
    O.townLoad().then(function () {
      if (self.swapGone(ticket)) return;
      if (!O.town && !O.best) return self.openOnline('visit', 0, then); // gone since the tab was drawn
      var rows = [], t = O.town, b = O.best, s = F.session.state;
      if (t) {
        var word = T.words[t.kind];
        rows.push({ icon: C.ICON[T.icons[t.kind]], name: 'Town Goal: ' + word, progress: [t.total, t.target], desc: t.givers + (t.givers === 1 ? ' farmer' : ' farmers') + ' this week. All who give ' + t.min + ' or more share the prize.' });
        rows.push({
          icon: C.ICON.gift, name: 'You gave ' + t.mine, reward: { gold: t.gold, stars: t.stars }, rewardPrefix: 'Prize',
          desc: t.mine >= t.min ? 'You are in, if the town gets there.' : 'Give ' + (t.min - t.mine) + ' more for the prize.',
        });
      }
      if (b) {
        var mine = b.last && O.me && b.last.id === O.me.id;
        rows.push({
          id: b.last ? b.last.id : null, icon: C.ICON.star, name: 'Best Farm of the Week', reward: { gold: b.gold, stars: b.stars }, rewardPrefix: 'Prize', buttonsBelow: true,
          desc: b.last ? (mine ? 'You' : b.last.name) + ' won last week with ' + b.last.likes + (b.last.likes === 1 ? ' like.' : ' likes.') : 'The farm with the most likes each week wins.',
          buttons: b.last && !mine ? [{ label: 'Visit', color: BLUE, cb: function () { O.visit(b.last.id); } }] : [],
        });
      }
      if (t) rows = rows.concat(self.townGiveRows(t, s, page));
      self.listPanel({
        title: 'Online', tab: 'town', tabs: O.TABS, page: Math.min(page || 0, Math.ceil(rows.length / (rows.length > 5 ? 4 : 5)) - 1), rows: rows, // (giving the last of something can empty the last page)
        reopen: function (tab, p) { self.openOnline(tab, p); },
        sub: function () { return t ? 'Ends in ' + L.formatLeft(t.endsIn / 60) + ', Sunday midnight in the Philippines.' : 'Weeks end Sunday midnight in the Philippines.'; },
      });
      if (then) then();
    });
  };

  // One row for each kind of thing that can be given.
  U.townGiveRows = function (t, s, page) {
    var self = this, word = T.words[t.kind];
    if (!t.canGive) return [];
    if (!t.leftToday) return [{ icon: C.ICON.heart, name: 'Thank you!', desc: 'That is all the town can take from you today. Come back tomorrow.' }];
    var list = L.townItems(s, t.kind);
    if (!list.length) return [{ icon: C.ICON[T.icons[t.kind]], name: 'Nothing to give', desc: 'No ' + word + ' in your bag right now.' }];
    return list.map(function (it) {
      var def = C.ITEMS[it.id], n = L.townStep(t, it.n);
      return {
        icon: def.icon, name: def.name + ' x' + it.n, desc: 'Sells for ' + def.sell + 'G each.',
        buttons: [{ label: 'Give ' + n, color: GREEN, cb: function () { self.townGive(it.id, n, page); } }],
      };
    });
  };

  // The bag changes only after the server answers, and by what it took.
  U.townGive = function (id, n, page) {
    var self = this, s = F.session.state;
    if (this.townBusy) return;
    this.townBusy = true;
    F.Net.rpc('farm_town_give_v1', { p_n: n }).then(function (r) {
      self.townBusy = false;
      var gave = r && r.ok ? L.townPaid(s, id, n, r.given) : 0;
      if (gave) {
        F.Host.save(s);
        F.bus.emit('hud');
        if (F.world) F.world.changed();
        sfx('coin');
      }
      self.swapTo(function () { self.openTown(page, function () { self.toast(gave ? 'The town thanks you! ' + gave + ' more for the goal.' : 'That is all the town can take from you today.', 2400, gave ? 0x2f5a22 : undefined); }); });
    }, function () {
      self.townBusy = false;
      self.toast('Could not reach the town. Check your connection.', 2400);
    });
  };

  // ---------- the crown ----------
  var lookListRow = U.lookListRow;
  U.lookListRow = function (c, y, row) {
    var out = lookListRow.call(this, c, y, row);
    if (row.id && O.best && O.best.last && O.best.last.id === row.id) {
      this.canvasImg(c, 58, y + 2, 'ui-crown', 28, 24, function (g) {
        var pts = [[3, 20], [1, 7], [8, 13], [14, 3], [20, 13], [27, 7], [25, 20]];
        g.beginPath();
        pts.forEach(function (p, i) { g[i ? 'lineTo' : 'moveTo'](p[0], p[1]); });
        g.closePath();
        g.lineJoin = 'round';
        g.lineWidth = 3;
        g.strokeStyle = '#5a3a1e';
        g.stroke();
        var gr = g.createLinearGradient(0, 3, 0, 20);
        gr.addColorStop(0, '#ffe680');
        gr.addColorStop(1, '#e9a91c');
        g.fillStyle = gr;
        g.fill();
        g.fillStyle = '#c0503a';
        g.beginPath();
        g.arc(14, 15, 2.2, 0, Math.PI * 2);
        g.fill();
      });
    }
    return out;
  };
})(window.Farm = window.Farm || {});
