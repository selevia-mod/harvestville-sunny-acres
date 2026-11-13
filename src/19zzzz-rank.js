// Town Rank and the Hall of Fame in the game (owner, 6 Nov 2026; words and numbers 00-zzzzzzzzzzz-rank.js, rules
// 01-logicZZZZ-rank.js, server supabase/farm_online_22.sql, map tools/make-map.js hall()).
//   Town Rank: the points you earn go to the server about once a minute (and when you change place or the app goes to
//   the background); the Town Rank page shows your rank, your points, how far to the next rank and the Top 100. It opens
//   from Online > Ranks (Town Rank), from your farmer card in the pause menu and from the Hall's big board (not
//   from Me: a sixth row there would push Leave online play onto a second page).
//   Others see your rank's colour as a small badge by your name over your head. Looks only, never power.
//   The Hall of Fame: Central Park's door now goes in. Plaques on the walls and pedestals with trophies show names from
//   the server (farm_hall_v1); walking up to one and tapping Read shows them, with "That's you!" on your own. Out the
//   door you are back in the park in front of the hall. Inside, you are on your own farm's live room, as in the house
//   or the mine (the park's room is only for the park: its message budget), so the park's seat is given back.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var RK = C.RANK;
  var HALL = C.HALL;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0x7a5a12;
  var noop = function () {};
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US'); };
  var int = function (v, lo, hi) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
  var name = function (n) { return (L.cleanName ? L.cleanName(n) : L.cleanText(n, 24)) || 'Farmer'; };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  // the server part not applied yet (Supabase: "Could not find the function ... in the schema cache")
  var missing = function (e) { return /could not find the function|schema cache/i.test(String((e && e.message) || e || '')); };
  var mine = function () { return F.session && !F.session.visit ? F.session.state : null; };

  // ---------- what the server said about our month ----------
  // known: it has answered this time the game is open; off: part 22 is not on the server yet.
  O.rank = { known: false, off: false, month: '', points: 0, tier: 0, best: 0, rank: 0 };
  O.rankAnswer = function (r) {
    if (!r || typeof r !== 'object' || r.points == null) return;
    var R = O.rank, s = mine();
    R.known = true;
    R.month = typeof r.month === 'string' ? r.month : R.month;
    R.points = int(r.points, 0, 1e9);
    R.tier = int(r.tier, 0, 4);
    R.best = Math.max(R.best, int(r.best, 0, 4));
    if (r.rank != null) R.rank = int(r.rank, 0, 1e7);
    if (s) L.rankServer(s, r);
    F.bus.emit('rank');
  };
  // What to show for our month: the server's (what the board shows) once it has answered this month, else ours.
  O.rankMine = function () {
    var s = mine(), t = s ? L.rankNow(s) : { p: 0, b: 0, m: 0 }, R = O.rank, here = R.known && R.month === L.monthKey(t.m);
    var pts = here ? R.points : t.p;
    return { points: pts, tier: here ? R.tier : L.rankTier(pts), best: Math.max(t.b, R.best, here ? R.tier : 0), rank: here ? R.rank : 0, server: here };
  };

  // ---------- sending what we earned ----------
  var sending = false;
  O.rankSend = function () {
    var s = mine();
    if (!O.on || sending || !s || O.rank.off || !F.Net.available()) return Promise.resolve(false);
    var list = L.rankTake(s);
    if (!list.length) return Promise.resolve(false);
    sending = true;
    var chain = Promise.resolve();
    list.forEach(function (it) {
      chain = chain.then(function () {
        return F.Net.rpc('farm_rank_add_v1', { p_source: it.src, p_points: it.n, p_request_id: it.id }).then(function (r) {
          L.rankSent(s, it.id); // (answered: counted, or over today's cap; either way it is done)
          O.rankAnswer(r);
        }, function (e) {
          if (missing(e)) O.rank.off = true; // (kept: it goes when the part is on the server)
          throw e;
        });
      });
    });
    return chain.then(function () { sending = false; F.session.dirty = true; return true; }, function () { sending = false; return false; });
  };
  setInterval(function () { O.rankSend(); O.claimFirsts(); }, RK.sendEvery);
  var beforeTravel = P.beforeTravel;
  P.beforeTravel = function (to) {
    if (beforeTravel) beforeTravel.apply(this, arguments);
    O.rankSend();
  };
  var sleep = window.__gameSleep;
  window.__gameSleep = function (sleeping) {
    if (sleeping) O.rankSend();
    return sleep.apply(this, arguments);
  };
  // our rank, for the others: the badge by our name over our head
  var myState = O.myState;
  O.myState = function () {
    var st = myState.apply(O, arguments);
    st.tr = O.rankMine().tier;
    return st;
  };

  // A new rank this month: said once, as it happens (the first, Bronze, also brings the tour).
  var lastTick = 0;
  var tick = P.tickClock;
  P.tickClock = function () {
    var r = tick.apply(this, arguments), now = Date.now();
    if (now - lastTick >= 1000) { lastTick = now; this.rankCheck(); }
    return r;
  };
  P.rankCheck = function () {
    var s = mine();
    if (!s || !F.ui) return;
    var k = L.rankTier(L.rankNow(s).p);
    if (F.session.rankTier == null || k < F.session.rankTier) { F.session.rankTier = k; return; } // (the game just opened, or a new month)
    if (k === F.session.rankTier) return;
    F.session.rankTier = k;
    var d = L.rankTierDef(k);
    sfx('found');
    F.ui.toast('Town Rank: ' + d.name + '! Your title this month: ' + d.title + '.', 3400, GOLD);
    if (!L.tipSeen(s, 'rank_tour') && !quiet()) this.time.delayedCall(3600, function () { if (F.ui) F.ui.rankTour(); });
  };

  // ---------- firsts ----------
  O.claimFirsts = function () {
    var s = mine();
    if (!O.on || !s || !s.tr || !s.tr.fq.length || O.firstsBusy || !F.Net.available()) return;
    var key = s.tr.fq[0], f = L.hallFirst(key);
    O.firstsBusy = true;
    F.Net.rpc('farm_hall_first_v1', { p_key: key }).then(function (r) {
      O.firstsBusy = false;
      if (!r || typeof r !== 'object') return;
      L.hallClaimed(s, key);
      F.session.dirty = true;
      O.hallCache = null; // (the hall reads its names again)
      if (r.first && f) {
        var show = function (tries) {
          if (!F.ui) return;
          if ((F.ui.modals.length || (F.world && F.world.busy)) && tries < 30) return setTimeout(function () { show(tries + 1); }, 1500);
          sfx('found');
          F.ui.dialog(f.words || 'A FIRST FOR HARVEST VILLE!\nYou are the first player ever to beat ' + f.name + '! Your name is in the Hall of Fame in Central Park for everyone to see.'); // (words: the Tower's "First in Selebox")
        };
        setTimeout(function () { show(0); }, 2600);
      }
      if (s.tr.fq.length) O.claimFirsts();
    }, function () { O.firstsBusy = false; });
  };
  // a hunt you had a share in: a first, if it is one (the Lair's guards: on their own floor)
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    wildDown.apply(this, arguments);
    var s = mine();
    if (!a || !a.mine || !s || F.session.visit) return;
    var key = L.hallFirstOf(this.mapKey, a.kind, this.mapKey === 'lair' ? F.session.lairFloor || 1 : 0);
    if (key && L.hallWant(s, key)) { F.session.dirty = true; O.claimFirsts(); }
  };

  // ---------- the Mine: a rock is a point ----------
  var breakRock = P.breakRock;
  P.breakRock = function () {
    var r = breakRock.apply(this, arguments);
    if (r) L.rankRock(this.state);
    return r;
  };

  // ---------- the badge by a name ----------
  var badgeKey = function (scene, k) {
    var key = 'rank-badge-' + k;
    if (scene.textures.exists(key)) return key;
    var d = L.rankTierDef(k), g = scene.make.graphics({ x: 0, y: 0 }, false), r = 46;
    g.fillStyle(0x3d2614, 1).fillCircle(50, 50, r + 4);
    g.fillStyle(d.color, 1).fillCircle(50, 50, r);
    g.fillStyle(0xffffff, 0.35).fillCircle(42, 40, r * 0.45);
    var pts = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 14 : 30; pts.push({ x: 50 + Math.cos(a) * rr, y: 52 + Math.sin(a) * rr }); }
    g.fillStyle(0xfffaf0, 1).fillPoints(pts, true);
    g.generateTexture(key, 100, 100);
    g.destroy();
    return key;
  };
  var syncSprites = O.syncSprites;
  O.syncSprites = function () {
    var w = F.world, before = w && w.remotes ? Object.assign({}, w.remotes) : {};
    syncSprites.apply(O, arguments);
    if (!w || !w.remotes || !w.sys || !w.sys.isActive()) return;
    Object.keys(before).forEach(function (id) { var r = before[id]; if (r.rk && w.remotes[id] !== r) { r.rk.destroy(); r.rk = null; } });
    Object.keys(w.remotes).forEach(function (id) {
      var r = w.remotes[id], p = O.others[id], k = p ? p.tr || 0 : 0;
      if (r.rk && r.rkTier !== k) { r.rk.destroy(); r.rk = null; }
      if (!k || r.rk) return;
      r.rkTier = k;
      r.rk = w.add.image(r.x, r.y, badgeKey(w, k)).setDepth(DEPTH.Above + 2);
      placeBadge(r);
    });
  };
  var placeBadge = function (r) {
    var t = r.tag;
    if (!t || !r.rk) return;
    r.rk.setPosition(t.x - t.displayWidth / 2 - 56, t.y - t.displayHeight / 2 + 4).setAlpha(t.alpha);
  };
  var update = O.update;
  O.update = function (w) {
    var out = update.apply(O, arguments);
    if (w && w.remotes) Object.keys(w.remotes).forEach(function (id) { placeBadge(w.remotes[id]); });
    return out;
  };

  // ---------- the hall's door, and the hall ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var self = this;
    if (o.type === 'hall') return { label: 'Enter', icon: -1, run: function () { self.travel('hall', 'entrance'); } };
    if (o.type === 'plaque' && this.mapKey === 'hall') return { label: 'Read', icon: C.ICON.book, run: function () { self.readPlaque(o.props.spot); } };
    return extraObjectAction.call(this, o, held, def);
  };
  // following a friend into the hall (its door is not a road)
  var follow = O.follow;
  O.follow = function (to) {
    var w = F.world;
    if (w && !w.busy && w.mapKey === 'park' && to === 'hall') return w.travel('hall', 'entrance');
    return follow.apply(O, arguments);
  };

  // The names: asked once a minute at most (O.hallCache), while online. null = not online; false = asking; 'soon' =
  // the server has no Hall of Fame yet; else the server's answer.
  O.hallData = function (then) {
    if (!O.on || !F.Net.available()) return then(null);
    var c = O.hallCache;
    if (c && Date.now() - c.at < 60000) return then(c.data);
    F.Net.rpc('farm_hall_v1', {}).then(function (r) {
      O.hallCache = { at: Date.now(), data: r && typeof r === 'object' ? r : null };
      then(O.hallCache.data);
    }, function (e) { then(missing(e) ? 'soon' : null); });
  };

  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    if (this.mapKey !== 'hall') return;
    var self = this;
    this.buildHall();
    this.hallNames = O.on && F.Net.available() ? false : null;
    O.hallData(function (d) {
      if (!self.sys || !self.sys.isActive() || self.mapKey !== 'hall') return;
      self.hallNames = d;
      var open = self.plaqueOpen, top = F.ui && F.ui.modals[F.ui.modals.length - 1];
      if (open && top && top.c === open.c) { F.ui.closeModal(); self.readPlaque(open.spot); } // (it said "Reading the names...")
    });
    // the first time in: the tour, once the fade is done
    var s = mine();
    if (s && !L.tipSeen(s, 'hall_tour') && !quiet()) {
      var tries = 0, show = function () {
        if (!self.sys || !self.sys.isActive() || self.mapKey !== 'hall' || !F.ui) return;
        if ((F.ui.modals.length || self.busy) && tries++ < 20) return self.time.delayedCall(1000, show);
        if (!L.takeTip(s, 'hall_tour')) return;
        F.Host.save(s);
        F.ui.tour('hall');
      };
      this.time.delayedCall(900, show);
    }
  };

  // indoors: the lamps are on at night, as in the house, and the house's music by day
  var darkness = U.darkness;
  U.darkness = function () {
    var d = darkness.apply(this, arguments);
    return F.world && F.world.mapKey === 'hall' ? d * 0.35 : d;
  };
  var musicMood = P.musicMood;
  P.musicMood = function () {
    var m = musicMood.apply(this, arguments);
    return this.mapKey === 'hall' && m !== 'night' && m !== 'festival' ? 'house' : m;
  };

  P.readPlaque = function (spot) {
    var sp = HALL.spots[spot], self = this;
    if (!sp || !F.ui) return;
    var shape = L.hallShape(spot, this.hallNames, O.me && O.me.id, mine());
    var buttons = sp.kind === 'top' ? [{ label: 'Close', color: GREY }, { label: 'Town Rank', color: BLUE, cb: function () { F.ui.openTownRank(); } }]
      : (sp.kind === 'firsts' || sp.kind === 'first') && F.myFrameButton && F.myFrameButton().length ? [{ label: 'Close', color: GREY }].concat(F.myFrameButton()) : null; // (name frames: 19zzz...z-name-frames.js)
    sfx('talk');
    var c = F.ui.dialog(shape.title, buttons, { rows: shape.rows });
    this.plaqueOpen = this.hallNames === false ? { spot: spot, c: c } : null;
  };

  // ---------- drawing the hall ----------
  var tex = function (scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    var g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  };
  var plaqueTex = function (g) {
    g.fillStyle(0x2a170a, 0.5).fillRoundedRect(8, 14, 184, 280, 22);
    g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, 184, 280, 22);
    g.fillStyle(0xd9a62e, 1).fillRoundedRect(8, 8, 168, 264, 18);
    g.fillStyle(0xf6d46a, 1).fillRoundedRect(12, 10, 160, 10, 5);
    g.fillStyle(0x6b3d1e, 1).fillRoundedRect(20, 20, 144, 240, 12);
    g.fillStyle(0x7d4a26, 1).fillRoundedRect(28, 28, 128, 150, 10);
    g.fillStyle(0xf3e2b3, 1).fillRoundedRect(34, 192, 116, 56, 8);
    g.fillStyle(0x9a7a52, 1).fillRect(48, 206, 88, 7).fillRect(58, 222, 68, 7).fillRect(66, 236, 52, 5);
  };
  var boardTex = function (g) {
    g.fillStyle(0x2a170a, 0.5).fillRoundedRect(8, 14, 480, 280, 24);
    g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, 480, 280, 24);
    g.fillStyle(0xd9a62e, 1).fillRoundedRect(10, 10, 460, 260, 18);
    g.fillStyle(0xf6d46a, 1).fillRoundedRect(16, 12, 448, 10, 5);
    g.fillStyle(0x1f3d2a, 1).fillRoundedRect(24, 26, 432, 228, 12);
    g.fillStyle(0x2c5238, 1).fillRoundedRect(32, 34, 416, 60, 10);
    g.fillStyle(0xe8dcc0, 0.55);
    [118, 150, 182, 214].forEach(function (y, i) { g.fillRect(70, y, 340 - i * 40, 9); });
  };
  var pedestalTex = function (g) {
    g.fillStyle(0x2a170a, 0.35).fillEllipse(90, 250, 180, 34);
    g.fillStyle(0x7d746a, 1).fillRoundedRect(4, 196, 172, 50, 10);
    g.fillStyle(0x9a9084, 1).fillRoundedRect(10, 200, 160, 20, 8);
    g.fillStyle(0xd8d0c0, 1).fillRect(34, 66, 112, 136);
    g.fillStyle(0xbdb3a2, 1).fillRect(34, 66, 18, 136).fillRect(128, 66, 18, 136);
    g.fillStyle(0xefe8da, 1).fillRect(64, 66, 22, 136);
    g.fillStyle(0xece4d4, 1).fillRoundedRect(14, 40, 152, 32, 8);
    g.fillStyle(0xd9a62e, 1).fillRect(14, 64, 152, 8);
  };
  var CUPS = { gold: [0xf2c230, 0xffe680, 0xb88a10], silver: [0xc4ccd6, 0xf2f6fa, 0x8a96a4], champion: [0xd070f0, 0xf4c8ff, 0x8a2ab0] };
  var cupTex = function (kind) {
    var c = CUPS[kind] || CUPS.gold;
    return function (g) {
      g.lineStyle(14, 0x3d2614, 1).strokeCircle(26, 54, 22).strokeCircle(124, 54, 22);
      g.lineStyle(9, c[0], 1).strokeCircle(26, 54, 22).strokeCircle(124, 54, 22);
      g.fillStyle(0x3d2614, 1).fillRoundedRect(28, 10, 94, 92, { tl: 6, tr: 6, bl: 44, br: 44 });
      g.fillStyle(c[0], 1).fillRoundedRect(34, 14, 82, 84, { tl: 4, tr: 4, bl: 38, br: 38 });
      g.fillStyle(c[1], 0.7).fillRoundedRect(44, 20, 18, 56, 9);
      g.fillStyle(0x3d2614, 1).fillRect(62, 96, 26, 26).fillRoundedRect(38, 118, 74, 26, 8);
      g.fillStyle(c[2], 1).fillRect(66, 98, 18, 22);
      g.fillStyle(c[0], 1).fillRoundedRect(42, 122, 66, 18, 6);
    };
  };

  P.buildHall = function () {
    var self = this;
    this.game.renderer.config.backgroundColor = Phaser.Display.Color.HexStringToColor('#1c120a');
    // the red carpet, from the door up to the board
    var cx = 9 * T;
    this.add.rectangle(cx, 2 * T, 1.7 * T, 11.2 * T, 0x8e2a22).setOrigin(0.5, 0).setDepth(DEPTH.Soil);
    this.add.rectangle(cx, 2 * T, 1.46 * T, 11.2 * T, 0xa8352a).setOrigin(0.5, 0).setDepth(DEPTH.Soil);
    [-1, 1].forEach(function (side) { self.add.rectangle(cx + side * 0.7 * T, 2 * T, 0.06 * T, 11.2 * T, 0xe0b040).setOrigin(0.5, 0).setDepth(DEPTH.Soil); });
    var plaque = tex(this, 'hall-plaque', 184, 300, plaqueTex), board = tex(this, 'hall-board', 488, 300, boardTex), stand = tex(this, 'hall-pedestal', 180, 268, pedestalTex);
    var furn = null;
    this.hallBits = [];
    this.objects.filter(function (o) { return o.type === 'plaque'; }).forEach(function (o) {
      var sp = HALL.spots[o.props.spot];
      if (!sp) return;
      var x = (o.x0 + o.x1 + 1) / 2 * T, ic = C.ICON[sp.icon] != null ? C.ICON[sp.icon] : C.ICON.star;
      if (o.props.spot === 'board') {
        self.add.image(x, 1.95 * T, board).setOrigin(0.5, 1).setDisplaySize(1.9 * T, 1.17 * T).setDepth(DEPTH.Walls + 0.1);
        self.add.text(x, 0.98 * T, 'TOWN RANK', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '50px', fontStyle: 'bold', color: '#ffe9a8', stroke: '#1f3d2a', strokeThickness: 8 })
          .setOrigin(0.5).setDepth(DEPTH.Walls + 0.2);
        self.add.image(x - 0.62 * T, 1.45 * T, 'items', C.ICON.star).setScale(0.62).setDepth(DEPTH.Walls + 0.2);
        self.add.image(x + 0.62 * T, 1.45 * T, 'items', C.ICON.star).setScale(0.62).setDepth(DEPTH.Walls + 0.2);
      } else if (o.props.spot[0] === 'w') {
        var side = o.x0 === 0 || o.x1 === self.map.width - 1, y = side ? (o.y0 + 0.95) * T : 1.92 * T, sc = side ? 0.62 : 1;
        if (side) x = o.x0 === 0 ? 0.72 * T : (self.map.width - 0.72) * T;
        self.add.image(x, y, plaque).setOrigin(0.5, 1).setScale(sc * 0.82).setAlpha(sp.kind === 'soon' ? 0.55 : 1).setDepth(DEPTH.Walls + 0.1);
        var top = y - 300 * sc * 0.82 + 92 * sc * 0.82;
        var art = sp.trophy && C.HOME.types.map(function (t) { return t.key; }).indexOf(sp.trophy);
        if (art != null && art >= 0 && F.images && F.images.furn_0) {
          furn = furn || F.furnTexture(self, 0);
          var im = self.add.image(x, top, furn, art).setDepth(DEPTH.Walls + 0.2);
          im.setScale(Math.min(0.62 * T / im.width, 0.5 * T / im.height));
        } else if (sp.kind !== 'soon') self.add.image(x, top, 'items', ic).setScale(0.62 * sc).setDepth(DEPTH.Walls + 0.2);
      } else { // a pedestal: solid, with its cup and the record's thing floating over it
        var wide = o.x1 > o.x0, bottom = (o.y1 + 1) * T, d = DEPTH.actor + bottom / 1e5;
        self.add.image(x, bottom, stand).setOrigin(0.5, 1).setDisplaySize((wide ? 1.3 : 0.86) * T, 1.27 * T).setDepth(d);
        var cup = tex(self, 'hall-cup-' + (sp.cup || 'gold'), 150, 150, cupTex(sp.cup));
        self.add.image(x, bottom - 1.06 * T, cup).setOrigin(0.5, 1).setScale(wide ? 0.95 : 0.72).setDepth(d + 1e-6);
        var glow = self.add.circle(x, bottom - 1.95 * T, 0.32 * T, 0xffe680, 0.28).setDepth(d + 2e-6).setBlendMode(Phaser.BlendModes.ADD);
        var thing = self.add.image(x, bottom - 1.95 * T, 'items', ic).setScale(wide ? 0.85 : 0.68).setDepth(d + 3e-6);
        self.tweens.add({ targets: [thing, glow], y: '-=' + 0.12 * T, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        for (var tx = o.x0; tx <= o.x1; tx++) self.blocked[self.idx(tx, o.y0)] = true;
        var zone = self.add.zone(x, (o.y0 + 0.5) * T, (o.x1 - o.x0 + 1) * T - 16, T - 16);
        self.physics.add.existing(zone, true);
        self.solids.add(zone);
      }
    });
  };

  // ---------- the Town Rank page ----------
  var medal = function (ui, c, x, y, k, r) {
    var d = L.rankTierDef(k), key = 'ui-rank-medal-' + k + '-' + r;
    ui.baked(c, x - r - 2, y - r - 2, key, 2 * r + 4, 2 * r + 4, function (g) {
      g.fillStyle(0x3d2614, 1).fillCircle(r + 2, r + 2, r + 2);
      g.fillStyle(d ? d.color : 0xd8c8a8, 1).fillCircle(r + 2, r + 2, r);
      g.fillStyle(0xffffff, 0.3).fillCircle(r - r * 0.2, r - r * 0.25, r * 0.45);
    });
    c.add(ui.add.image(x, y, 'items', C.ICON.star).setScale(r / 110).setAlpha(d ? 1 : 0.4));
  };
  U.rankTour = function (then) {
    var s = mine();
    if (s && L.takeTip(s, 'rank_tour')) F.Host.save(s);
    this.tour('rank', then);
  };
  // The Town Rank page, centred: your rank and points this month, how far to the next, the Top 100 (10 a page).
  U.openTownRank = function (page, back) {
    var self = this, s = mine();
    if (!s) return this.toast('Go home first to see your Town Rank.', 2400);
    if (!L.tipSeen(s, 'rank_tour') && !quiet()) return this.rankTour(function () { self.openTownRank(page, back); });
    var draw = function (board, note) {
      var me = O.rankMine(), k = me.tier, d = L.rankTierDef(k), next = L.rankNext(me.points), t = L.rankNow(s);
      var PH = 548, top = Math.round((H - PH) / 2), L0 = 36, R0 = W - 36;
      var c = self.openModal(function () { self.closeModal(); if (back) back(); });
      self.panelImg(c, 20, top, W - 40, PH);
      var title = self.txt(W / 2, top + 4, 'TOWN RANK', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      self.ribbon(c, W / 2, top + 4, 180);
      c.add(title);
      // you
      var y = top + 34;
      self.baked(c, L0, y, 'ui-rank-card', R0 - L0, 112, function (g) {
        g.fillStyle(0xfff6dc, 1).fillRoundedRect(0, 0, R0 - L0, 112, 12);
        g.lineStyle(1.5, 0x7a4d26, 0.35).strokeRoundedRect(0, 0, R0 - L0, 112, 12);
      });
      medal(self, c, L0 + 34, y + 38, k, 24);
      // one row each, shrunk to fit rather than wrapped (owner's screenshot, 7 Nov 2026: the hint ran into the bar)
      var oneRow = function (t) { var w = R0 - L0 - 80; if (t.width > w) t.setScale(w / t.width); return t; };
      c.add(oneRow(self.txt(L0 + 68, y + 12, (d ? d.name : 'No rank yet') + '  ·  ' + fmt(me.points) + ' points', 15, INK, { fontStyle: 'bold' })));
      c.add(oneRow(self.txt(L0 + 68, y + 33, d ? '"' + d.title + '"' : 'Everything you do here earns points.', 12, d ? (d.css || INK) : '#6a4a2a', { fontStyle: d ? 'bold' : 'normal' })));
      // the bar to the next rank
      var bx = L0 + 68, bw = R0 - bx - 12, by = y + 56, part = next ? Math.max(0, Math.min(1, 1 - next.need / (next.def.at - (d ? d.at : 0)))) : 1;
      c.add(self.add.rectangle(bx, by, bw, 10, 0x5a3a1e).setOrigin(0, 0.5));
      if (part > 0) c.add(self.add.rectangle(bx + 1, by, Math.max(2, (bw - 2) * part), 7, next ? next.def.color : d.color).setOrigin(0, 0.5));
      c.add(self.txt(bx, by + 9, next ? next.def.name + ' at ' + fmt(next.def.at) + ': ' + fmt(next.need) + ' to go' : 'The top rank. Well done!', 11, '#6a4a2a'));
      var best = L.rankTierDef(me.best);
      c.add(self.txt(L0 + 12, y + 90, L.monthName(t.m) + (me.rank ? '  ·  #' + fmt(me.rank) + ' in town' : '') + '  ·  starts over in ' + L.rankDaysLeft() + ' day' + (L.rankDaysLeft() === 1 ? '' : 's') +
        (best ? '  ·  best ever: ' + best.name : ''), 11, '#8a6a4a', { wordWrap: { width: R0 - L0 - 20 } }));
      // the Top 100
      var ly = y + 124;
      c.add(self.txt(W / 2, ly, 'TOP ' + RK.top + ' THIS MONTH', 13, '#7a2a1c', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      ly += 22;
      var rows = board && Array.isArray(board.top) ? board.top.filter(function (r) { return r && typeof r === 'object'; }) : null;
      var per = 10, pages = rows ? Math.max(1, Math.ceil(rows.length / per)) : 1;
      page = Math.max(0, Math.min(pages - 1, page || 0));
      if (!rows) {
        c.add(self.txt(W / 2, ly + 70, note, 14, INK, { align: 'center', wordWrap: { width: 260 }, lineSpacing: 3 }).setOrigin(0.5, 0));
      } else if (!rows.length) {
        c.add(self.txt(W / 2, ly + 70, 'Nobody has points this month yet. Be the first!', 14, INK, { align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5, 0));
      } else {
        var meId = O.me && O.me.id, line = function (r, i, yy) {
          var mine2 = String(r.id) === meId, tk = int(r.tier, 0, 4);
          if (mine2) c.add(self.add.rectangle(W / 2, yy + 11, R0 - L0, 22, 0xffe680, 0.55));
          c.add(self.txt(L0 + 4, yy + 2, '#' + int(r.rank, 1, 1e7), 13, INK, { fontStyle: 'bold' }));
          if (tk) c.add(self.add.circle(L0 + 50, yy + 11, 6, L.rankTierDef(tk).color).setStrokeStyle(1.5, 0x3d2614));
          var n = self.txt(L0 + 62, yy + 2, name(r.name) + (mine2 ? ' (you)' : ''), 13, INK, mine2 ? { fontStyle: 'bold' } : {});
          if (n.width > 150) n.setScale(150 / n.width);
          c.add(n);
          c.add(self.txt(R0 - 4, yy + 2, fmt(r.points), 13, '#5a3a1e', { fontStyle: 'bold' }).setOrigin(1, 0));
        };
        rows.slice(page * per, page * per + per).forEach(function (r, i) { line(r, i, ly + i * 24); });
        var meRow = board.me && typeof board.me === 'object' && int(board.me.rank, 0, 1e7) > 0 ? board.me : null;
        if (meRow && !rows.slice(page * per, page * per + per).some(function (r) { return String(r.id) === meId; })) {
          c.add(self.txt(W / 2, ly + per * 24 - 4, '· · ·', 12, '#8a6a4a').setOrigin(0.5, 0));
          line({ id: meId, rank: meRow.rank, name: O.me && O.me.name, points: meRow.points, tier: meRow.tier }, per, ly + per * 24 + 10);
        }
        if (pages > 1) {
          var py = top + PH - 96;
          c.add(self.txt(W / 2, py, (page + 1) + ' / ' + pages, 14, INK, { fontStyle: 'bold' }).setOrigin(0.5));
          if (page > 0) self.button(c, W / 2 - 90, py, 80, 32, 'Back', function () { self.closeModal(); page--; draw(board, note); }, GREY);
          if (page < pages - 1) self.button(c, W / 2 + 90, py, 80, 32, 'More', function () { self.closeModal(); page++; draw(board, note); }, BLUE);
        }
      }
      self.button(c, W / 2 - 70, top + PH - 44, 124, 40, 'How to earn', function () { self.closeModal(); self.rankHelp(function () { self.openTownRank(page, back); }); }, BLUE);
      self.button(c, W / 2 + 70, top + PH - 44, 124, 40, 'Close', function () { self.closeModal(); if (back) back(); }, GREY);
      return c;
    };
    if (!O.on || !F.Net.available()) return draw(null, RK.offline);
    if (O.rank.off) return draw(null, 'The Top ' + RK.top + ' opens very soon. Your points are kept until then.');
    var ticket = this.swapping;
    O.rankSend().then(function () { return F.Net.rpc('farm_rank_board_v1', {}); }).then(function (r) {
      if (self.swapGone(ticket)) return;
      if (r && r.me) O.rankAnswer(Object.assign({ month: r.month }, r.me));
      draw(r && typeof r === 'object' ? r : { top: [] }, '');
    }).catch(function (e) {
      if (self.swapGone(ticket)) return;
      if (missing(e)) O.rank.off = true;
      draw(null, O.rank.off ? 'The Top ' + RK.top + ' opens very soon. Your points are kept until then.' : 'Could not reach the online world. Check your connection.');
    });
  };
  // How points come: each kind, how many, and what is left today.
  U.rankHelp = function (then) {
    var s = mine(), room = s ? L.rankRoom(s) : {};
    var rows = RK.order.map(function (k) {
      var d = RK.sources[k];
      return [C.ICON[d.icon] != null ? C.ICON[d.icon] : C.ICON.star, d.name + ': ' + d.what + '. Up to ' + fmt(d.day) + ' a day' + (room[k] < d.day ? ' (' + fmt(room[k]) + ' left today).' : '.')];
    });
    rows.push([C.ICON.ribbon, RK.tiers.map(function (t) { return t.name + ' ' + fmt(t.at); }).join(', ') + ' points in a month. Rewards are looks only: a badge colour by your name and a title. It starts over on the 1st (Manila time); your best ever stays.']);
    this.dialog('HOW TO EARN POINTS', [{ label: 'OK', cb: then }], { rows: rows });
  };

  // Online > Ranks > Town Rank (19h-online.js asks for it): your line, and the top 10, like the other ranks.
  U.openTownBoard = function (show, fail, kindRow) {
    var self = this;
    var meRow = function () {
      var me = O.rankMine(), d = L.rankTierDef(me.tier);
      return {
        icon: C.ICON.star, name: (d ? d.name : 'No rank yet') + ': ' + fmt(me.points) + ' points', desc: (me.rank ? '#' + fmt(me.rank) + ' this month. ' : '') + 'Looks only, never power.',
        buttons: [{ label: 'Open', color: BLUE, cb: function () { self.closeModal(); self.openTownRank(0, function () { self.openOnline('ranks', 0); }); } }],
      };
    };
    O.rankSend().then(function () { return F.Net.rpc('farm_rank_board_v1', {}); }).then(function (r) {
      if (r && r.me) O.rankAnswer(Object.assign({ month: r.month }, r.me));
      var rows = [kindRow('ranks'), meRow()].concat((r && Array.isArray(r.top) ? r.top : []).slice(0, 10).map(function (x) {
        var d = L.rankTierDef(int(x.tier, 0, 4)), you = O.me && String(x.id) === O.me.id;
        return { id: String(x.id), icon: C.ICON.ribbon, name: '#' + int(x.rank, 1, 1e7) + ' ' + name(x.name) + (you ? ' (you)' : ''), desc: fmt(x.points) + ' points this month' + (d ? ', ' + d.name : '') + '.' };
      }));
      show(rows, 'Everything you do for Harvest Ville counts. Starts over on the 1st.', null);
    }).catch(function (e) {
      if (!missing(e)) return fail(e);
      O.rank.off = true;
      show([kindRow('ranks'), meRow(), { icon: C.ICON.exclaim, name: 'Coming soon', desc: 'The Top 100 opens very soon. Your points are kept.' }], '', null);
    });
  };
  // the farmer card in the pause menu: your rank this month (best ever on the page), on the card's row of links
  var openPause = U.openPause;
  U.openPause = function () {
    openPause.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1];
    if (!m || F.session.visit || !m.c.pauseLinks) return;
    var me = O.rankMine(), d = L.rankTierDef(me.tier), best = L.rankTierDef(me.best);
    this.pauseLink(m.c, 'rank-link', { dot: (d || best || { color: 0xd8c8a8 }).color }, d ? d.name : best ? 'Best: ' + best.name : 'Rank', function () { self.openTownRank(0, function () { self.openPause(); }); });
  };

  // ---------- the first-time tours (owner, 4 Oct 2026: every new feature gets one; the card: 19ze-tours.js) ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var dot = function (ui, sc, x, y, k, r) { var d = L.rankTierDef(k), c = ui.add.circle(x, y, r, d.color).setStrokeStyle(2, 0x3d2614); sc.add(c); return c; };
  F.TOURS.rank = {
    title: 'TOWN RANK',
    steps: [
      {
        text: 'Everything you do for Harvest Ville earns Town Rank points: farming, cooking, fishing, mining, hunting and helping the town.',
        draw: function (ui, sc, move) {
          ['turnip', 'bread', 'fish_m', 'ore_copper', 'meat_boar', 'crate'].forEach(function (k, i) {
            var im = icon(ui, sc, 36 + i * 40, 70, C.ICON[k], 0.24);
            tw(ui, move, { targets: im, y: 62, duration: 380, yoyo: true, repeat: -1, delay: i * 140, ease: 'Sine.inOut' });
          });
          var p = words(ui, sc, 136, 26, '+5 points', 16, '#2f7a22');
          tw(ui, move, { targets: p, scale: 1.18, duration: 420, yoyo: true, repeat: -1 });
          words(ui, sc, 136, 112, 'Each kind has a daily limit: fair for everyone.', 11, '#5a3a1e');
        },
      },
      {
        text: 'Points this month make your rank: Bronze, Silver, Gold, then Champion. The Top 100 is on the board.',
        draw: function (ui, sc, move) {
          [1, 2, 3, 4].forEach(function (k, i) {
            var x = 42 + i * 63, d = dot(ui, sc, x, 56, k, 18);
            icon(ui, sc, x, 56, C.ICON.star, 0.16);
            words(ui, sc, x, 92, L.rankTierDef(k).name, 12, L.rankTierDef(k).css);
            words(ui, sc, x, 110, fmt(L.rankTierDef(k).at), 10, '#6a4a2a');
            tw(ui, move, { targets: d, scale: 1.15, duration: 360, yoyo: true, repeat: -1, delay: i * 260 });
          });
        },
      },
      {
        text: 'Your rank\'s colour shows by your name for everyone, with a title. Looks only, never power. It starts over on the 1st; your best ever stays.',
        draw: function (ui, sc, move) {
          var key = F.ensureTexture(ui, 'player');
          sc.add(ui.add.image(136, 128, key, 0).setOrigin(0.5, 1).setScale(0.26));
          var tag = words(ui, sc, 146, 22, 'Juan', 16, '#fff27a').setStroke('#3d2614', 4);
          var d = dot(ui, sc, 146 - tag.width / 2 - 16, 22, 3, 10);
          tw(ui, move, { targets: [d], scale: 1.25, duration: 420, yoyo: true, repeat: -1 });
          words(ui, sc, 136, 44, '"Hero of Harvest Ville"', 11, '#c99a10');
        },
      },
    ],
  };
  F.TOURS.hall = {
    title: 'THE HALL OF FAME',
    steps: [
      {
        text: 'The Hall of Fame keeps the names of Harvest Ville\'s best: the biggest catches, the Derby\'s biggest fish and the Town Rank champions.',
        draw: function (ui, sc, move) {
          [['gold_tusk', 60], ['fish_k', 136], ['ribbon', 212]].forEach(function (e, i) {
            var im = icon(ui, sc, e[1], 62, C.ICON[e[0]], 0.34);
            tw(ui, move, { targets: im, y: 54, duration: 420, yoyo: true, repeat: -1, delay: i * 200, ease: 'Sine.inOut' });
          });
          words(ui, sc, 136, 112, 'Wild Boar: Juan, 121.5 kg', 12, '#5a3a1e');
        },
      },
      {
        text: 'Be the first to beat the Bakunawa or a Lair guard and your name goes up here for good.',
        draw: function (ui, sc, move) {
          var b = icon(ui, sc, 136, 58, C.ICON.bakunawa_scale, 0.42);
          tw(ui, move, { targets: b, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1 });
          var f = words(ui, sc, 136, 112, 'FIRST!', 18, '#a8740c');
          tw(ui, move, { targets: f, scale: 1.2, duration: 380, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Walk up to a plaque and tap Read. Your own record says "That\'s you!" Out the door is the park.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 136, 50, C.ICON.book, 0.36);
          var y = words(ui, sc, 136, 104, HALL.you, 17, '#2f7a22');
          tw(ui, move, { targets: y, scale: 1.18, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
