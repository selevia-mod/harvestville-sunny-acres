// The Lost Tower's weekly board and First in Selebox in the game (owner, 12 Nov 2026; words and numbers
// 00-zzzzzzzzzzzzzzzzzzzzzzzz-tower-board.js, rules 01-logicZZZZZZZZZZZZZZZZZZZZ-tower-board.js, server
// supabase/farm_tower_board.sql):
// - First in Selebox: a big boss beaten for the first time (F.towerFirst, from the Keeper's step) is claimed as a Hall of
//   Fame first (O.claimFirsts: its own words, "FIRST IN SELEBOX!"); the names are on the lighthouse wall in Manila (face the
//   lighthouse beside its door: Read), with last week's Lighthouse Champion and a way to the board.
// - The weekly board: each new floor goes to the server (farm_tower_floor_v1, about once a minute and after each clear;
//   floors cleared offline wait in the save); the board page (Mang Ilaw's shop, Tower tab; the wall) shows the top 10 and
//   your own line; last week's prize (farm_tower_week_prize_v1) is asked once a week, paid once by its id.
// - The Lighthouse Champion's name on a banner over the lighthouse door.
// Offline, or a server without the board yet: everything else plays; the pages say "Join online play" or "very soon".
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var BD = C.TOWER_BOARD;
  var HALL = C.HALL;
  if (!BD || !O || !F.WorldScene) return;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0x7a5a12;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US'); };
  var missing = function (e) { return /could not find the function|schema cache/i.test(String((e && e.message) || e || '')); };
  var mine = function () { return F.session && !F.session.visit ? F.session.state : null; };
  var online = function () { return !!(O.on && F.Net.available()); };
  var meId = function () { return O.me && O.me.id ? String(O.me.id) : null; };
  // a message once nothing else is open (or after a while anyway)
  var whenFree = function (fn, tries) {
    tries = tries || 0;
    if (!F.ui) return;
    if ((F.ui.modals.length || (F.world && F.world.busy)) && tries < 30) return setTimeout(function () { whenFree(fn, tries + 1); }, 1500);
    fn();
  };

  // ---------- First in Selebox ----------
  F.towerFirst = function (floor) {
    var s = mine(), key = 'tower_' + floor;
    if (s && L.hallWant(s, key)) { F.session.dirty = true; O.claimFirsts(); }
  };

  // ---------- new floors, to the server ----------
  // off: the server has no board yet; capDay: today's cap was full (Manila's day: try again tomorrow); prized: the week
  // whose prize was asked; board: the last board answer { at, data }.
  var TB = O.tower = { off: false, busy: false, capDay: -1, prized: '', board: null };
  O.towerSend = function () {
    var s = mine(), day = L.manila().day;
    if (!online() || TB.busy || TB.off || !s || TB.capDay === day) return Promise.resolve(false);
    var out = L.towerBoardTake(s);
    if (!out) return Promise.resolve(false);
    TB.busy = true;
    return F.Net.rpc('farm_tower_floor_v1', { p_floors: out.f, p_request_id: out.id }).then(function (r) {
      TB.busy = false;
      if (!r || typeof r !== 'object') return false;
      if (r.ok !== true) { if (r.code === 'bad') L.towerBoardSent(s, out.id, out.f); return false; } // (a send it can never take: dropped)
      var took = Array.isArray(r.took) ? r.took : [];
      L.towerBoardSent(s, out.id, took);
      F.session.dirty = true;
      TB.board = null;
      if (took.length < out.f.length) { TB.capDay = day; return true; }
      return L.towerBoardRec(s).q.length ? O.towerSend() : true;
    }, function (e) {
      TB.busy = false;
      if (missing(e)) TB.off = true; // (kept: they go when the board is on the server)
      return false;
    });
  };
  // Last week's prize: asked once a week (each time the game is open in a new week), paid once by the claim's id.
  O.towerPrize = function () {
    var s = mine(), wk = L.towerWeek().key;
    if (!online() || TB.off || !s || TB.prized === wk) return;
    TB.prized = wk;
    F.Net.rpc('farm_tower_week_prize_v1', {}).then(function (c) {
      var n = L.towerPrizePay(s, c);
      if (!n) return;
      F.session.dirty = true;
      if (F.Host && F.Host.save) F.Host.save(s);
      F.bus.emit('hud');
      var rank = Math.floor(Number(c.rank)) || 0, floors = Math.floor(Number(c.floors)) || 0;
      whenFree(function () {
        sfx('fanfare');
        F.ui.dialog('LIGHTHOUSE BOARD PRIZE!\n' + (rank >= 1 && rank <= BD.prizes.length ? 'You were #' + rank + ' last week' : 'You climbed ' + fmt(floors) + ' new floors last week') +
          (rank >= 1 && rank <= BD.prizes.length ? ', with ' + fmt(floors) + ' new floor' + (floors === 1 ? '' : 's') : '') + '. +' + fmt(n) + ' Pearls!' +
          (c.title ? '\n\nYou are the ' + BD.title + ' this week! Your name is on the lighthouse banner in Manila.' : ''));
      });
    }, function (e) {
      if (missing(e)) TB.off = true;
      else TB.prized = ''; // (no connection: asked again later)
    });
  };
  // The board (a minute old at most), after our waiting floors are sent. Rejects when it cannot be read.
  O.towerBoard = function () {
    var c = TB.board;
    if (c && Date.now() - c.at < 60000) return Promise.resolve(c.data);
    return O.towerSend().then(function () { return F.Net.rpc('farm_tower_board_v1', {}); }).then(function (r) {
      TB.board = { at: Date.now(), data: L.towerBoardShape(r, meId()) };
      return TB.board.data;
    }, function (e) {
      if (missing(e)) TB.off = true;
      throw e;
    });
  };
  setInterval(function () { O.towerSend(); O.towerPrize(); }, BD.sendEvery);
  // a floor cleared: its news goes now (only a new floor adds anything to send)
  var cleared = P.towerCleared;
  if (cleared) P.towerCleared = function () {
    var n = cleared.apply(this, arguments);
    O.towerSend();
    return n;
  };
  var beforeTravel = P.beforeTravel;
  P.beforeTravel = function () {
    if (beforeTravel) beforeTravel.apply(this, arguments);
    O.towerSend();
    O.towerPrize();
  };

  // ---------- the board page ----------
  // Like the Town Rank page: you (your new floors this week and your place), last week's Champion, the top 10 and your own
  // line under them when you are not in it.
  U.openTowerBoard = function (back) {
    var self = this, s = mine();
    if (!s) return this.toast('Go home first to see the board.', 2400);
    var draw = function (b, note) {
      var PH = 520, top = Math.round((H - PH) / 2), L0 = 36, R0 = W - 36;
      var c = self.openModal(function () { self.closeModal(); if (back) back(); });
      self.panelImg(c, 20, top, W - 40, PH);
      var title = self.txt(W / 2, top + 4, 'LIGHTHOUSE BOARD', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      self.ribbon(c, W / 2, top + 4, 210);
      c.add(title);
      var y = top + 34, left = L.towerWeekLeft(), wait = L.towerBoardWaiting(s);
      self.baked(c, L0, y, 'ui-tower-board-card', R0 - L0, 92, function (g) {
        g.fillStyle(0xfff6dc, 1).fillRoundedRect(0, 0, R0 - L0, 92, 12);
        g.lineStyle(1.5, 0x7a4d26, 0.35).strokeRoundedRect(0, 0, R0 - L0, 92, 12);
      });
      var fit = function (t, w) { if (t.width > w) t.setScale(w / t.width); return t; };
      var me = b ? b.me : null;
      c.add(fit(self.txt(L0 + 12, y + 10, me ? 'This week: ' + fmt(me.floors) + ' new floor' + (me.floors === 1 ? '' : 's') + (me.rank ? '  ·  #' + fmt(me.rank) : '') : 'This week: your new floors', 15, INK, { fontStyle: 'bold' }), R0 - L0 - 24));
      c.add(fit(self.txt(L0 + 12, y + 34, 'Starts over in ' + left + ' day' + (left === 1 ? '' : 's') + ' (Monday, Manila time)' + (wait ? '  ·  ' + wait + ' to send' : ''), 12, '#6a4a2a'), R0 - L0 - 24));
      var ch = b && b.champ;
      c.add(fit(self.txt(L0 + 12, y + 58, ch ? BD.title + ': ' + ch.name + (ch.you ? ' (you)' : '') : BD.title + ': the top climber of last week', 12, ch ? '#9a6a10' : '#8a6a4a', { fontStyle: 'bold' }), R0 - L0 - 24));
      var ly = y + 104;
      c.add(self.txt(W / 2, ly, 'TOP 10 THIS WEEK', 13, '#7a2a1c', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      ly += 22;
      var line = function (r, yy) {
        if (r.you) c.add(self.add.rectangle(W / 2, yy + 11, R0 - L0, 22, 0xffe680, 0.55));
        c.add(self.txt(L0 + 4, yy + 2, '#' + fmt(r.rank), 13, INK, { fontStyle: 'bold' }));
        var nt = fit(self.txt(L0 + 50, yy + 2, r.name + (r.you ? ' (you)' : ''), 13, INK, r.you ? { fontStyle: 'bold' } : {}), 170);
        c.add(nt);
        if (F.frameName && r.id) F.frameName(self, nt, { id: r.id }, { title: false }); // (their name frame: 19zzz...z-name-frames.js)
        c.add(self.txt(R0 - 4, yy + 2, fmt(r.floors), 13, '#5a3a1e', { fontStyle: 'bold' }).setOrigin(1, 0));
      };
      if (!b) c.add(self.txt(W / 2, ly + 70, note, 14, INK, { align: 'center', wordWrap: { width: 260 }, lineSpacing: 3 }).setOrigin(0.5, 0));
      else if (!b.top.length) c.add(self.txt(W / 2, ly + 70, 'Nobody has a new floor this week yet. Be the first!', 14, INK, { align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5, 0));
      else {
        b.top.forEach(function (r, i) { line(r, ly + i * 24); });
        if (me && me.rank && !b.top.some(function (r) { return r.you; })) {
          c.add(self.txt(W / 2, ly + 10 * 24 - 4, '· · ·', 12, '#8a6a4a').setOrigin(0.5, 0));
          line({ rank: me.rank, id: meId(), name: (O.me && L.cleanText(O.me.name, 24)) || 'You', floors: me.floors, you: true }, ly + 10 * 24 + 10);
        }
      }
      self.button(c, W / 2 - 70, top + PH - 44, 124, 40, 'Prizes', function () { self.closeModal(); self.towerPrizes(function () { self.openTowerBoard(back); }); }, BLUE);
      self.button(c, W / 2 + 70, top + PH - 44, 124, 40, 'Close', function () { self.closeModal(); if (back) back(); }, GREY);
      return c;
    };
    if (!online()) return draw(null, BD.offline);
    if (TB.off) return draw(null, BD.soon);
    var ticket = this.swapping;
    O.towerBoard().then(function (b) {
      if (self.swapGone && self.swapGone(ticket)) return;
      draw(b || L.towerBoardShape({ top: [] }), '');
    }, function () {
      if (self.swapGone && self.swapGone(ticket)) return;
      draw(null, TB.off ? BD.soon : 'Could not reach the online world. Check your connection.');
    });
  };
  // What the board pays (the server pays it, once, the next time you play after Monday)
  U.towerPrizes = function (then) {
    var pearl = C.towerIcon ? C.towerIcon('pearl') : C.ICON.star, p = BD.prizes;
    this.dialog('WEEKLY PRIZES', [{ label: 'OK', cb: then }], { rows: [
      [C.ICON.book, BD.words],
      [C.ICON.ribbon, '1st: ' + p[0] + ' Pearls, the title "' + BD.title + '" for a week, and your name on the lighthouse banner.'],
      [pearl, '2nd: ' + p[1] + ' Pearls. 3rd: ' + p[2] + ' Pearls.'],
      [pearl, '4th to 10th: ' + p[3] + ' Pearls each.'],
      [pearl, 'Everyone else with ' + BD.every.floors + ' or more new floors: ' + BD.every.pearls + ' Pearls.'],
      [C.ICON.exclaim, 'Prizes come the next time you play online after Monday. Up to ' + BD.dayCap + ' new floors count each day.'],
    ] });
  };

  // ---------- the lighthouse wall (Manila: face the lighthouse beside its door) ----------
  U.openLighthouseWall = function () {
    var self = this, s = mine();
    var show = function (hall, board) {
      var rows = L.towerWallRows(hall, meId(), s), ch = board && board.champ;
      if (hall && typeof hall === 'object') rows.unshift([C.ICON.ribbon, ch ? BD.title + ' (last week): ' + ch.name + (ch.you ? '  ' + HALL.you : '') + ', ' + fmt(ch.floors) + ' new floors.' : BD.title + ': the top climber of each week. Their name goes on the banner.']);
      sfx('talk');
      return self.dialog(BD.wall, [{ label: 'Close', color: GREY }, { label: 'Weekly board', color: BLUE, cb: function () { self.openTowerBoard(); } }]
        .concat(hall && typeof hall === 'object' && F.myFrameButton ? F.myFrameButton() : []), { rows: rows }); // (My frame: 19zzz...z-name-frames.js)
    };
    if (!online()) return show(null, null);
    var c = show(false, null), done = false; // ("Reading the names...", then the names)
    O.hallData(function (d) {
      var then = function (b) {
        if (done) return;
        done = true;
        var top = self.modals[self.modals.length - 1];
        if (!top || top.c !== c) return;
        self.closeModal();
        show(d, b);
      };
      if (!d || typeof d !== 'object' || TB.off) return then(null);
      O.towerBoard().then(then, function () { then(null); });
    });
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (this.mapKey === 'manila' && o.type === 'mn_spot' && o.name === 'lighthouse') return { label: 'Read', icon: C.ICON.book, run: function () { F.ui.openLighthouseWall(); } };
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- on the lighthouse: the wall's plaque, and the Champion's banner ----------
  var lh = function () { return C.MANILA && C.MANILA.buildings.filter(function (b) { return b.key === 'lighthouse'; })[0]; };
  P.towerWallArt = function () {
    var b = lh(), self = this;
    if (!b || F.session.visit) return;
    var x0 = b.box[0] * T, y1 = (b.box[1] + b.box[3]) * T, d = DEPTH.actor + y1 / 1e5 + 1e-6;
    // a little gold plaque on the left of the door
    var key = 'tw-wall-plaque';
    if (!this.textures.exists(key)) {
      var g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, 96, 70, 10);
      g.fillStyle(0xd9a62e, 1).fillRoundedRect(5, 5, 86, 60, 8);
      g.fillStyle(0xf3e2b3, 1).fillRoundedRect(12, 12, 72, 46, 6);
      g.fillStyle(0x9a7a52, 1).fillRect(22, 22, 52, 5).fillRect(26, 32, 44, 5).fillRect(30, 42, 36, 5);
      g.generateTexture(key, 96, 70);
      g.destroy();
    }
    this.towerWall = { plaque: this.add.image(x0 + 0.5 * T, y1 - 0.42 * T, key).setDisplaySize(0.62 * T, 0.45 * T).setDepth(d), banner: null };
    if (!online() || TB.off) return;
    O.towerBoard().then(function (bd) {
      if (!self.sys || !self.sys.isActive() || self.mapKey !== 'manila' || !self.towerWall || !bd || !bd.champ) return;
      self.towerBanner(bd.champ.name);
    }, function () {});
  };
  P.towerBanner = function (name) {
    var b = lh(), w = this.towerWall;
    if (!b || !w) return;
    if (w.banner) w.banner.forEach(function (o) { o.destroy(); });
    var cx = (b.box[0] + b.box[2] / 2) * T, y = (b.box[1] + b.box[3] - 2.2) * T, d = DEPTH.actor + (b.box[1] + b.box[3]) * T / 1e5 + 2e-6;
    var key = 'tw-banner';
    if (!this.textures.exists(key)) {
      var g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x3d2614, 1).fillRect(0, 0, 300, 12);
      g.fillStyle(0x24365c, 1).fillPoints([{ x: 8, y: 10 }, { x: 292, y: 10 }, { x: 292, y: 100 }, { x: 150, y: 124 }, { x: 8, y: 100 }], true);
      g.fillStyle(0xe0b040, 1).fillRect(8, 16, 284, 6).fillRect(8, 90, 284, 5);
      g.generateTexture(key, 300, 126);
      g.destroy();
    }
    var st = { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontStyle: 'bold', color: '#ffe9a8', stroke: '#1a2440', strokeThickness: 6 };
    var img = this.add.image(cx, y, key).setDisplaySize(1.9 * T, 0.8 * T).setDepth(d);
    var t1 = this.add.text(cx, y - 0.16 * T, 'CHAMPION', Object.assign({ fontSize: '40px' }, st)).setOrigin(0.5).setDepth(d + 1e-7);
    var t2 = this.add.text(cx, y + 0.1 * T, L.cleanText(name, 18) || 'Farmer', Object.assign({ fontSize: '52px' }, st)).setOrigin(0.5).setDepth(d + 1e-7);
    if (t2.displayWidth > 1.7 * T) t2.setScale(1.7 * T / t2.displayWidth);
    w.banner = [img, t1, t2];
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    this.towerWall = null;
    if (this.mapKey === 'manila') this.towerWallArt();
  };
})(window.Farm = window.Farm || {});
