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

  void W;
})(window.Farm = window.Farm || {});
