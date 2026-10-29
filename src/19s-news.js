// What's new in Harvest Ville (content and versions in 00-news.js): the list by version from the pause menu, and the
// newest version's notes once, after the game updates (owner, 29 Oct 2026). Never on a new farm: it is all new there.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var BLUE = 0x4a90c9, GREY = 0xa08a68;

  var rowsOf = function (news, header) {
    var rows = [];
    news.forEach(function (n, i) {
      if (header) rows.push({ icon: C.ICON.star, name: 'Version ' + n.v + (i === 0 ? '  (latest)' : ''), desc: n.date });
      n.lines.forEach(function (l) { rows.push({ icon: C.ICON[l[0]] != null ? C.ICON[l[0]] : C.ICON.note, name: l[1], desc: l[2] }); });
    });
    return rows;
  };

  // Every version, newest first. back: what Back opens (the pause menu).
  U.openNews = function (page, back) {
    var self = this;
    this.listPanel({
      title: "What's new", rows: rowsOf(C.NEWS, true), page: page || 0,
      reopen: function (t, p) { self.openNews(p, back); },
      sub: function () { return 'Harvest Ville v' + C.NEWS_LATEST; },
      corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
    });
  };

  // The newest version only, once after an update.
  U.openLatestNews = function (page) {
    var self = this, n = C.NEWS[0];
    this.listPanel({
      title: "What's new in v" + n.v, rows: rowsOf([n], false), page: page || 0,
      reopen: function (t, p) { self.openLatestNews(p); },
      sub: function () { return n.date + '. All updates: pause menu, What\'s new.'; },
      corner: { label: 'All', color: BLUE, cb: function () { self.closeModal(); self.openNews(0, null); } },
    });
  };

  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this, s = F.session.state;
    if (this.mapKey !== 'farm' || (this.state && this.state.isVisit) || (window.gameHost && window.gameHost.quiet) || s.wv === C.NEWS_LATEST) return;
    var show = function () {
      if (!self.sys || !self.sys.isActive() || s.wv === C.NEWS_LATEST) return;
      if (self.busy || !F.ui || F.ui.modals.length || F.session.visit || document.getElementById('farm-ask')) return self.time.delayedCall(2500, show);
      s.wv = C.NEWS_LATEST;
      self.save();
      F.ui.openLatestNews(0);
    };
    this.time.delayedCall(4000, show);
  };
  void L;
})(window.Farm = window.Farm || {});
