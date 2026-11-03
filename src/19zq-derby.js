// The Fishing Derby (owner, 4 Nov 2026: "Fishing Derby on Mondays: the Biggest catch board, but for fish"; rules
// 01-logicM.js, server supabase/farm_online_15.sql). Every fish you land is weighed (14-actions.js says how heavy). On
// Fish Monday, while you are online, each one goes to the server, and the biggest of each kind is on that Monday's board:
// Online, Ranks, Fishing Derby (Next for another fish). The board stays up all week. A tour the first time you land a
// fish on a Fish Monday. Before part 15 is applied it hides quietly (O.derbyOff).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var GREY = 0xa08a68, GOLD_INK = 0x7a5a12;
  var name = function (n) { return L.cleanText(n, 24) || 'Farmer'; };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var off = function (e) { if (missing(e)) O.derbyOff = true; return O.derbyOff; };
  var kg = function (g) { return (Math.round(g / 100) / 10) + ' kg'; };

  // A fish just landed ({ id, kg }): on Fish Monday, to the Derby.
  O.recordDerby = function (lf) {
    F.session.lastFish = lf.id;
    if (L.derbyOn()) F.ui.derbyTour();
    if (!O.on || O.derbyOff || !L.derbyOn()) return;
    var g = Math.round(lf.kg * 1000);
    F.Net.rpc('farm_derby_v1', { p_kind: lf.id, p_g: g }).then(function (r) {
      if (!r || !r.ok || Number(r.best) !== g) return; // (not bigger than today's)
      var rank = Math.floor(Number(r.rank)) || 0;
      if (rank < 1 || rank > 10) return;
      setTimeout(function () {
        if (F.ui) F.ui.toast('#' + rank + ' in the Fishing Derby for ' + C.ITEMS[lf.id].name + '! See Online, Ranks.', 3000, GOLD_INK);
      }, 2800);
    }).catch(off);
  };

  // Online, Ranks, Fishing Derby (19h-online.js asks for it): the top 10 for one fish; Next for another.
  U.openDerbyBoard = function (show, fail, kindRow, more) {
    var self = this, kinds = C.FISH_ORDER, k = this.derbyKind || F.session.lastFish || 'fish_l';
    if (kinds.indexOf(k) < 0) k = 'fish_l';
    this.derbyKind = k;
    var head = [kindRow('ranks'), {
      icon: C.ITEMS[k].icon, name: 'Fish: ' + C.ITEMS[k].name, desc: 'Tap Next to see another fish.',
      buttons: [{ label: 'Next', color: GREY, cb: function () { self.derbyKind = kinds[(kinds.indexOf(k) + 1) % kinds.length]; self.swapTo(function () { self.openOnline('ranks', 0); }); } }],
    }];
    var on = L.derbyOn();
    F.Net.rpc('farm_derby_board_v1', { p_kind: k }).then(function (list) {
      var rows = head.concat((Array.isArray(list) ? list : []).map(function (r) {
        var id = String(r.id), n = name(r.farm_name), mineRow = !!r.me, rk = Math.floor(Number(r.rank)) || 0;
        return {
          id: id, icon: C.ICON.ribbon, name: '#' + rk + ' ' + n + (mineRow ? ' (you)' : ''), desc: C.ITEMS[k].name + ', ' + kg(Math.max(0, Number(r.g) || 0)) + '.',
          buttons: mineRow ? [] : [{ label: 'Visit', cb: function () { O.visit(id); } }, more(id, n, 'ranks')],
        };
      }));
      if (rows.length === head.length) rows.push({ icon: C.ICON.exclaim, name: 'No catches yet', desc: on ? 'Nobody has landed a ' + C.ITEMS[k].name + ' today. Be the first!' : 'Nobody landed a ' + C.ITEMS[k].name + ' at Monday\'s Derby.' });
      show(rows, on ? 'The Derby is on until midnight!' : 'Monday\'s Derby. Next one: Monday!', null); // (short: one line at the normal size)
    }).catch(function (e) {
      if (off(e)) return show(head.slice(0, 1).concat([{ icon: C.ICON.exclaim, name: 'Coming soon', desc: 'The Fishing Derby is almost here.' }]), '', null);
      fail(e);
    });
  };

  // ---------- its tour: the first fish you land on a Fish Monday ----------
  var K = F.UI_CONST, INK = K.INK;
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.derby = {
    title: 'THE FISHING DERBY',
    steps: [
      {
        text: 'Every fish you catch has its own weight now. A giant one is rare!',
        draw: function (ui, sc, move) {
          var f = icon(ui, sc, 100, 66, C.ICON.fish_l, 0.4);
          tw(ui, move, { targets: f, angle: { from: -10, to: 10 }, duration: 400, yoyo: true, repeat: -1 });
          words(ui, sc, 190, 66, '3.9 kg', 18, '#a8740c');
        },
      },
      {
        text: 'On Fish Monday the Derby is on: the biggest of each fish goes on the board.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 66, C.ICON.calendar, 0.34);
          words(ui, sc, 180, 66, 'Monday', 16);
          var r = icon(ui, sc, 236, 40, C.ICON.ribbon, 0.24);
          tw(ui, move, { targets: r, scale: 0.3, duration: 420, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'See who caught the biggest under Online, Ranks, Fishing Derby. It stays up all week.',
        draw: function (ui, sc) {
          words(ui, sc, 136, 46, '#1  King Trout  17.2 kg', 14, '#a8740c');
          words(ui, sc, 136, 80, '#2  King Trout  14.0 kg', 13);
        },
      },
    ],
  };
  U.derbyTour = function () {
    var self = this, s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, 'derby_tour') || (window.gameHost && window.gameHost.quiet)) return;
    var tries = 0, open = function () {
      if (L.tipSeen(s, 'derby_tour')) return;
      if ((self.modals.length || (F.world && F.world.busy)) && tries++ < 30) return setTimeout(open, 1500);
      L.takeTip(s, 'derby_tour');
      F.Host.save(s);
      self.tour('derby');
    };
    setTimeout(open, 2800); // (after the catch's own words)
  };
})(window.Farm = window.Farm || {});
