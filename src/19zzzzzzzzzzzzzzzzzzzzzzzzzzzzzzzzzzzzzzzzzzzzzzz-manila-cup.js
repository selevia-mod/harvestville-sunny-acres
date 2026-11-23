// The Manila Cup and Race Day in the world (owner, 18 Nov 2026; numbers 00-zzz...z-manila-cup.js, rules
// 01-logicZZZ...Z-manila-cup.js, the server supabase/farm_manila_cup.sql: written, not applied). Mang Kardo runs both.
// - Talk to him: the Cup, Race Day or a chat. The race arch opens the Cup, the grandstand Race Day, Manila's Hall of Fame
//   shows the week's Manila Cup Champion.
// - The Cup: your horse (6 hearts and Horseshoes; Mang Kardo fetches it if it is not here) round the oval 3 times, alone.
//   Jump (its button, or a tap with a second finger) over the 6 hurdles; hold the action button to sprint (the race's own
//   bar, full again each lap: the horse's stamina is never touched). Your week's best goes to the server once; until the
//   SQL is in, your own best and "Results open soon". The week's prize is claimed once by its id.
// - Race Day: 6 house horses (the saddled horse's sheet, tinted, a jockey in its silks on top) run the oval every 10
//   minutes for everyone in Manila, a cheering crowd in front of the grandstand; both drawn only when on screen. Bet at the
//   grandstand; Watch follows the pack (a photo finish when close). A bet is paid by the clock, wherever you are.
// - The cups and the ribbon in the house: a second picture added to each furniture sheet (the owner's cups from the
//   'manila' pack; drawn stand-ins until it is on the phone), so the house, Decorate and every list show them.
// - Two first-time tours. Gold is the game's own money: nothing here is bought or traded.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var MC = C.MANILA_CUP;
  var RD = C.RACE_DAY;
  var M = C.MANILA;
  if (!MC || !MC.on || !F.WorldScene || !M) return;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, DARK = 0x2f5a22;
  var DAY = 864e5, MANILA = 8 * 3600e3;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var col = function (c) { return '#' + ('00000' + c.toString(16)).slice(-6); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var visiting = function (w) { var v = F.session.visit; return !!((w && w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var mine = function () { var s = F.session && F.session.state; return s && !s.isVisit && !F.session.visit && !F.session.raid ? s : null; };
  var raceTime = function (n) { return L.formatTime(((L.rdStart(n) + MANILA) % DAY) / 60000); };
  var dirty = function () { F.session.dirty = true; if (F.world) F.world.save(); };
  // a message once nothing else is open and you are not watching a race (or after a while anyway)
  var whenFree = function (fn, tries) {
    tries = tries || 0;
    if (!F.ui) return;
    var w = F.world;
    if ((F.ui.modals.length || (w && (w.busy || w.mc || w.rdWatch))) && tries < 40) return setTimeout(function () { whenFree(fn, tries + 1); }, 1200);
    fn();
  };

  // ---------- the cups and the ribbon in every furniture sheet ----------
  var PIECES = MC.cups.concat(MC.ribbon), ART = ['props/manila_cup_gold', 'props/manila_cup_silver', 'props/manila_cup_bronze'];
  var CV = null, sources = [];
  var drawCups = function () {
    var cv = CV || (CV = document.createElement('canvas'));
    cv.width = 512;
    cv.height = 128;
    var g = cv.getContext('2d'), ct = F.images && F.images.contests && F.images.contests.naturalWidth ? F.images.contests : null;
    g.clearRect(0, 0, 512, 128);
    g.imageSmoothingQuality = 'high';
    var fitIn = function (img, sx, sy, sw, sh, x) { var k = Math.min(120 / sw, 124 / sh), w = sw * k, h = sh * k; g.drawImage(img, sx, sy, sw, sh, x + 64 - w / 2, 126 - h, w, h); };
    ['#f2c230', '#d8dde4', '#d08a4a'].forEach(function (tone, i) {
      var pic = F.images && F.images[ART[i]];
      if (pic && pic.naturalWidth) return fitIn(pic, 0, 0, pic.naturalWidth, pic.naturalHeight, i * 128);
      // (not on the phone yet: the contests' gold cup, turned silver or bronze; or a cup drawn here)
      var one = document.createElement('canvas'), o = one.getContext('2d');
      one.width = one.height = 128;
      if (ct) o.drawImage(ct, 4 * 180, 0, 240, 240, 4, 4, 120, 120);
      else {
        o.fillStyle = '#6b4424'; o.fillRect(34, 100, 60, 22);
        o.fillStyle = '#f2c230'; o.beginPath(); o.moveTo(28, 18); o.lineTo(100, 18); o.quadraticCurveTo(98, 78, 64, 82); o.quadraticCurveTo(30, 78, 28, 18); o.fill();
        o.fillRect(56, 80, 16, 20);
        o.lineWidth = 6; o.strokeStyle = '#f2c230'; o.beginPath(); o.arc(24, 40, 14, 1.2, 5.2); o.stroke(); o.beginPath(); o.arc(104, 40, 14, -2, 1.9); o.stroke();
      }
      if (i) { o.globalCompositeOperation = 'source-atop'; o.globalAlpha = 0.62; o.fillStyle = tone; o.fillRect(0, 0, 128, 128); }
      g.drawImage(one, i * 128, 0);
    });
    if (ct) fitIn(ct, 0, 0, 176, 288, 384); // (the ribbon: the contests' blue rosette)
    else { g.fillStyle = '#3a7fe0'; g.beginPath(); g.arc(448, 52, 34, 0, 7); g.fill(); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(448, 52, 18, 0, 7); g.fill(); g.fillStyle = '#2a5fb0'; g.fillRect(430, 80, 14, 40); g.fillRect(452, 80, 14, 40); }
    return cv;
  };
  var wantCups = function () {
    if (!F.needImage || !F.packedFile || !F.canFetch || !F.canFetch()) return;
    ART.forEach(function (k) { var f = F.packedFile(k); if (f && !(F.images && F.images[k]) && F.onPhone(f.file)) F.needImage(k); });
  };
  var furnTexture = F.furnTexture;
  if (furnTexture) F.furnTexture = function (scene) {
    var key = furnTexture.apply(this, arguments), tex = scene.textures.get(key);
    if (tex && !tex.mcCups && typeof Phaser !== 'undefined') {
      var cv = CV || drawCups(), src = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
      tex.source.push(src);
      PIECES.forEach(function (k, i) { var t = C.HOME.typeIndex[k]; tex.remove(t); tex.add(t, tex.source.length - 1, i * 128, 0, 128, 128); });
      tex.mcCups = src;
      sources.push(src);
      wantCups();
    }
    return key;
  };
  if (F.bus) F.bus.on('packart', function (k) {
    if (ART.indexOf(k) < 0 || !CV) return;
    drawCups();
    sources = sources.filter(function (src) { return src.image && src.glTexture; });
    sources.forEach(function (src) { src.update(); });
  });

  // ---------- the server: the week's best, the board, the prize ----------
  var O = F.Online || {};
  var NET = { off: false, busy: false, prized: '', board: null };
  var missing = function (e) { return /could not find the function|schema cache/i.test(String((e && e.message) || e || '')); };
  var online = function () { return !!(O.on && F.Net && F.Net.available && F.Net.available()); };
  var meId = function () { return O.me && O.me.id ? String(O.me.id) : null; };
  F.mcNet = NET;
  F.mcSend = function () {
    var s = mine(), q = s && L.mcToSend(s);
    if (!q || !online() || NET.off || NET.busy) return Promise.resolve(false);
    NET.busy = true;
    return F.Net.rpc('farm_mcup_run_v1', { p_request_id: q.id, p_week: q.week, p_laps: q.laps, p_knocks: q.knocks }).then(function (r) {
      NET.busy = false;
      if (!r || typeof r !== 'object') return false;
      if (r.ok === true || ['bad', 'fast', 'week'].indexOf(r.code) >= 0) { L.mcSent(s, q.id, r.ok === true); NET.board = null; dirty(); }
      return r.ok === true;
    }, function (e) { NET.busy = false; if (missing(e)) NET.off = true; return false; });
  };
  F.mcPrize = function () {
    var s = mine(), wk = L.mcWeek().done;
    if (!s || !online() || NET.off || NET.prized === wk) return;
    NET.prized = wk;
    F.Net.rpc('farm_mcup_prize_v1', {}).then(function (c) {
      var p = L.mcPrizePay(s, c);
      if (!p) return;
      dirty();
      F.bus.emit('hud');
      whenFree(function () {
        sfx('fanfare');
        var name = C.HOME.types[C.HOME.typeIndex[p.piece]].name;
        F.ui.dialog('MANILA CUP PRIZE!', null, { rows: [
          [C.ICON.ribbon, 'You were #' + p.rank + ' in the Manila Cup last week, in ' + L.mcTime(p.ms) + '!'],
          [C.ICON.coin, '+' + fmt(p.gold) + ' Gold.'],
          [C.ICON.star, 'The ' + name + ' for your house: it is in your furniture storage.'],
        ].concat(p.title ? [[C.ICON.ribbon, 'You are the ' + MC.title + '! Your name is on Manila\'s Hall of Fame this week.']] : []) });
      });
    }, function (e) { if (missing(e)) NET.off = true; else NET.prized = ''; });
  };
  F.mcBoard = function () {
    var c = NET.board;
    if (c && Date.now() - c.at < 60000) return Promise.resolve(c.data);
    return F.mcSend().then(function () { return F.Net.rpc('farm_mcup_board_v1', {}); }).then(function (r) {
      NET.board = { at: Date.now(), data: L.mcBoardShape(r, meId()) };
      return NET.board.data;
    }, function (e) { if (missing(e)) NET.off = true; throw e; });
  };
  setInterval(function () { F.mcSend(); F.mcPrize(); }, MC.sendEvery);

  // ---------- Race Day on the server (owner, 24 Nov 2026: "Approve"; supabase/farm_race_day.sql) ----------
  // In the app, the server keeps each race's secret number and tells it once the race has started (farm_race_v1); a bet
  // goes to the server first, which takes it only while bets are open by its own clock (farm_race_bet_v1); a bet is paid
  // only by the server's word (farm_race_settle_v1). So no clock trick and no reading of the game shows a winner ahead.
  // Betting needs the internet. Until the SQL is in (the functions missing), Race Day plays the old way, as before.
  var RNET = { off: false, asked: {}, settling: {}, betting: false };
  F.rdNet = RNET;
  L.rdServerOn = function () { return !!(F.Net && F.Net.available && F.Net.available()) && !RNET.off; };
  var rdMissing = function (e) { if (missing(e)) { RNET.off = true; return true; } return false; };
  // the secret numbers of race n and the few before it, once n has started (asked at most every 2 s a race)
  F.rdSeedFetch = function (n) {
    if (!L.rdServerOn() || L.rdSeeds[n] != null || (RNET.asked[n] && Date.now() - RNET.asked[n] < 2000)) return;
    RNET.asked[n] = Date.now();
    F.Net.rpc('farm_race_v1', { p_from: n - 6, p_to: n }).then(function (r) {
      var seeds = r && typeof r === 'object' && r.seeds && typeof r.seeds === 'object' ? r.seeds : {};
      Object.keys(seeds).forEach(function (k) { L.rdSeedSet(Number(k), Number(seeds[k])); });
    }, function (e) { rdMissing(e); });
  };
  // the bets the server took whose result is out: asked one by one, again a while later when there is no answer
  F.rdSettleNet = function (s) {
    if (!s || !L.rdServerOn()) return;
    L.rdDue(s).forEach(function (n) {
      var k = String(n);
      if (RNET.settling[k] && Date.now() - RNET.settling[k] < 15000) return;
      RNET.settling[k] = Date.now();
      F.Net.rpc('farm_race_settle_v1', { p_n: n }).then(function (r) {
        delete RNET.settling[k];
        if (mine() !== s) return;
        var out = L.rdPayBet(s, n, r);
        if (!out) return;
        dirty(); F.bus.emit('hud');
        if (out.back) whenFree(function () { F.ui.toast('Your ' + fmt(out.back) + ' Gold bet on the ' + raceTime(n) + ' race did not reach Mang Kardo. It is back with you.', 3200); });
        else if (!out.gone) whenFree(function () { F.ui.rdPaid(out); });
      }, function (e) {
        if (!rdMissing(e)) return;
        // (the server lost its Race Day: what this phone bet comes back)
        delete RNET.settling[k];
        var out = mine() === s && L.rdPayBet(s, n, { why: 'none' });
        if (out && out.back) { dirty(); F.bus.emit('hud'); }
      });
    });
  };

  // ---------- once a second, on any map of your own game: the 3-runs reward, bets paid by the clock ----------
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var r = tickClock.apply(this, arguments);
    if (r || this.clockMs !== 0 || visiting(this)) return r;
    var s = this.state, now = L.clock(), ev = L.mcWeekly(s, now), paid = L.rdSettle(s, now);
    F.rdSettleNet(s);
    if (ev || paid.length) { this.changed(); this.save(); F.bus.emit('hud'); }
    if (ev) whenFree(function () {
      sfx('fanfare');
      F.ui.dialog('MANILA CUP: 3 RUNS!', null, { rows: [[C.ICON.horse, 'You rode ' + ev.runs + ' runs in the Manila Cup last week. Mang Kardo says thank you!'],
        [C.ICON.coin, '+' + fmt(ev.gold) + ' Gold.'], [C.ITEMS.oats ? C.ITEMS.oats.icon : C.ICON.star, '+' + ev.oats + ' oats for your horse.']] });
    });
    paid.forEach(function (b) { whenFree(function () { F.ui.rdPaid(b); }); });
    return r;
  };

  // ---------- Mang Kardo, the race arch, the grandstand, the Hall of Fame ----------
  var mnTalk = P.mnTalk;
  P.mnTalk = function (v) {
    if (!v || v.key !== 'kardo' || visiting(this) || !L.manilaMet(this.state, 'kardo')) return mnTalk.apply(this, arguments);
    var self = this, args = arguments;
    sfx('talk');
    F.ui.dialog('MANG KARDO\nThe Manila Cup and Race Day are mine! What will it be?', [
      { label: 'Manila Cup', color: GREEN, cb: function () { F.ui.mcOpenCup(); } },
      { label: 'Race Day', color: BLUE, cb: function () { F.ui.rdOpen(); } },
      { label: 'Chat', color: GREY, cb: function () { mnTalk.apply(self, args); } },
    ]);
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o && this.mapKey === 'manila' && !visiting(this)) {
      if (o.type === 'mc_arch') return { label: 'Cup', icon: C.ICON.horse, run: function () { F.ui.mcOpenCup(); } };
      if (o.type === 'mn_spot' && o.name === 'grandstand') return { label: 'Race Day', icon: C.ICON.horse, run: function () { F.ui.rdOpen(); } };
      if (o.type === 'mn_spot' && o.name === 'hall') return { label: 'Look', icon: -1, run: function () { F.ui.mcHall(); } };
    }
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- the house horses, their jockeys and the crowd: built when first near, drawn only when on screen ----------
  var RIDE_PX = 174, LANE = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
  var COATS = [0xffffff, 0xb89880, 0x8a6e60, 0x5e4c46, 0xe8d0b8, 0x74625a]; // (the coats: the horse's own, and darker)
  var TBOX = M.ground.filter(function (g) { return g[0] === 'track'; })[0];
  var jockeys = function (scene) {
    var key = 'mc-jockeys';
    if (scene.textures.exists(key)) return key;
    var tx = scene.textures.createCanvas(key, 64 * RD.horses.length, 80), g = tx.getContext();
    RD.horses.forEach(function (h, i) {
      var x = i * 64, c = col(h[1]);
      g.lineWidth = 3; g.strokeStyle = '#3d2614';
      g.fillStyle = c; g.beginPath(); g.ellipse(x + 32, 50, 15, 17, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(x + 32, 38); g.lineTo(x + 40, 50); g.lineTo(x + 32, 62); g.lineTo(x + 24, 50); g.fill();
      g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(x + 32, 26, 10, 0, 7); g.fill(); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x + 32, 23, 10.5, Math.PI, 0); g.fill(); g.stroke();
      g.fillRect(x + 30, 12, 4, 4);
      tx.add(i, 0, x, 0, 64, 80);
    });
    tx.refresh();
    return key;
  };
  P.rdBuild = function () {
    var self = this, sheet = F.images.horse_ride ? 'horse_ride' : 'animals', sc = sheet === 'horse_ride' ? C.HORSE.w * T / RIDE_PX : F.Anim.scale(C.HORSE), jk = jockeys(this);
    F.ensureTexture(this, sheet);
    var rd = this.rd = { n: -1, res: null, sheet: sheet, f0: sheet === 'horse_ride' ? 0 : C.HORSE.frame0, horses: [], crowd: [], on: false, cullMs: 0, cheer: 0 };
    for (var j = 0; j < 6; j++) {
      var hs = this.add.image(0, 0, sheet, rd.f0 + 3).setOrigin(0.5, 233 / 252).setScale(sc).setVisible(false);
      var jo = this.add.image(0, 0, jk, 0).setOrigin(0.5, 1).setScale(0.62 * T / 64).setVisible(false);
      rd.horses.push({ img: hs, jo: jo, along: 0 });
    }
    // the crowd in front of the grandstand (the city folk's looks, cheering when the horses run)
    var st = M.buildings.filter(function (b) { return b.key === 'grandstand'; })[0], looks = M.crowd.looks.filter(function (l) { return F.images[l[0]]; });
    if (!looks.length) looks = [['tw_people', 0], ['tw_people', 1], ['tw_people', 2], ['tw_people', 3]];
    if (st) for (var i = 0; i < 10; i++) {
      var lk = looks[i % looks.length];
      F.ensureTexture(this, lk[0]);
      var x = (st.box[0] + 0.7 + i * (st.box[2] - 1.4) / 9) * T, y = (st.box[1] + st.box[3] + 0.55 + (i % 2) * 0.25) * T;
      var p = this.add.image(x, y, lk[0], lk[1] * 9).setOrigin(0.5, 0.83).setScale(2).setVisible(false);
      if (M.crowd.tints[i % M.crowd.tints.length]) p.setTint(M.crowd.tints[i % M.crowd.tints.length]);
      F.depthTo(p, DEPTH.actor + y / 1e5);
      rd.crowd.push({ img: p, y: y, k: i });
    }
    void self;
  };
  var inView = function (scene, x0, y0, x1, y1) { var v = scene.cameras.main.worldView, m = 2 * T; return x1 > v.x - m && x0 < v.right + m && y1 > v.y - m && y0 < v.bottom + m; };
  // the race to show now: running, or lining up in the last minute before its start (-1: none)
  var raceNow = function (now) {
    var n = L.rdNext(now) - 1; // (the latest race whose bets are closed: lining up, or running until its result)
    if (n >= 0 && now < L.rdStart(n) + RD.resultMs) return n;
    return L.rdStart(n + 1) - now <= 60000 ? n + 1 : -1;
  };
  P.rdUpdate = function (dt, time) {
    var now = L.clock(), n = raceNow(now), rd = this.rd, watch = this.rdWatch;
    if (!rd) { if (n < 0 || !(watch || inView(this, (TBOX[1] - 2) * T, (TBOX[2] - 6) * T, (TBOX[1] + TBOX[3] + 2) * T, (TBOX[2] + TBOX[4] + 2) * T))) return; this.rdBuild(); rd = this.rd; }
    rd.cullMs -= dt;
    if (rd.cullMs <= 0) { rd.cullMs = 300; rd.view = !!watch || inView(this, (TBOX[1] - 2) * T, (TBOX[2] - 6) * T, (TBOX[1] + TBOX[3] + 2) * T, (TBOX[2] + TBOX[4] + 2) * T); }
    var showH = n >= 0 && rd.view, hour = ((now + MANILA) % DAY) / 3600e3, showC = rd.view && hour >= 6 && hour < 22.5;
    if (showH !== rd.on) { rd.on = showH; rd.horses.forEach(function (h) { h.img.setVisible(showH); h.jo.setVisible(showH); }); }
    if (showC !== rd.crowdOn) { rd.crowdOn = showC; rd.crowd.forEach(function (p) { p.img.setVisible(showC); }); }
    var running = n >= 0 && now >= L.rdStart(n);
    if (showC) rd.crowd.forEach(function (p) { // (cheering while they run: a hop each)
      var hop = running ? Math.abs(Math.sin(time / 170 + p.k * 1.7)) * 0.18 * T : 0;
      p.img.y = p.y - hop;
    });
    if (n < 0 && watch) this.rdWatchEnd();
    if (!showH && !this.rdWatch) return;
    if (rd.n !== n && n >= 0) {
      rd.n = n; rd.res = null; rd.race = L.rdRace(n);
      rd.race.horses.forEach(function (h, j) { var o = rd.horses[j]; o.img.setTint(COATS[h.i % COATS.length]); o.jo.setFrame(h.i); });
    }
    if (n < 0) return;
    var t = (now - L.rdStart(n)) / 1000, along;
    if (t >= 0 && !rd.res) { rd.res = L.rdResult(n, now); if (!rd.res) F.rdSeedFetch(n); } // (never before the start; on the server's word)
    if (t < 0 || !rd.res) along = [0, 0, 0, 0, 0, 0].map(function (z, j) { return -1.2 - (j % 2) * 0.4; }); // (at the start until the word comes)
    else along = L.rdAlong(n, rd.res, t);
    var LEN = L.mcLen(), A = F.Anim;
    rd.horses.forEach(function (o, j) {
      var a = along[j], p = L.mcPoint(a, LANE[j]), x = p.x * T, y = p.y * T, side = Math.abs(p.dx) > Math.abs(p.dy), moving = t >= 0 && a < RD.laps * LEN + 3;
      var k = side ? (moving ? (Math.floor(time / 110 + j) % 2 ? 11 : 7) : 6) : (p.dy > 0 ? 0 : 3) + (moving ? A.STEPS[Math.floor(time / 100 + j) % 4] : 0);
      o.along = a;
      o.img.setPosition(x, y).setFrame(rd.f0 + k).setFlipX(side && p.dx > 0);
      F.depthTo(o.img, DEPTH.actor + y / 1e5);
      o.jo.setPosition(x + (side ? (p.dx > 0 ? -0.1 : 0.1) * T : 0), y - (side ? 0.8 : p.dy > 0 ? 1.0 : 1.05) * T);
      F.depthTo(o.jo, DEPTH.actor + y / 1e5 + 0.00001);
    });
    if (this.rdWatch) this.rdWatchStep(n, t, along);
  };

  // ---------- watching a race: the camera on the leader, the order on screen, a photo finish ----------
  P.rdWatchStart = function () {
    var now = L.clock(), n = raceNow(now);
    if (n < 0) n = L.rdNext(now);
    if (L.rdStart(n) - now > 60000) { F.ui.toast('The ' + raceTime(n) + ' race starts in ' + Math.ceil((L.rdStart(n) - now) / 60000) + ' minutes. Watch then!', 2600); return false; }
    this.rdWatch = { n: n, done: false, photo: false, at: null };
    F.input.reset();
    F.ui.rdHud(true);
    sfx('drumroll');
    return true;
  };
  P.rdWatchEnd = function () {
    this.rdWatch = null;
    if (F.ui) F.ui.rdHud(false);
  };
  P.rdWatchStep = function (n, t, along) {
    var w = this.rdWatch, rd = this.rd;
    if (w.n !== n) { if (w.done) return this.rdWatchEnd(); w.n = n; }
    var lead = 0;
    along.forEach(function (a, j) { if (a > along[lead]) lead = j; });
    var p = L.mcPoint(Math.max(-1, along[lead]), 0);
    w.at = { x: p.x * T, y: p.y * T + T };
    if (F.ui) F.ui.rdHudStep(rd.race, along, t);
    var res = rd.res;
    if (!res || w.done) { if (w.done && t > (res ? res.times[res.order[5]] : 30) + 3) this.rdWatchEnd(); return; }
    var first = res.times[res.order[0]];
    if (t >= first) {
      w.done = true;
      sfx('fanfare');
      if (res.photo) F.ui.rdPhoto(rd.race, res);
      F.ui.rdHudResult(rd.race, res);
    }
  };
  var updateCamera = P.updateCamera;
  P.updateCamera = function (lerp) {
    var w = this.rdWatch;
    if (!w || !w.at) return updateCamera.apply(this, arguments);
    var at = w.at;
    this.feet = function () { return at; };
    try { return updateCamera.call(this, Math.min(lerp, 0.1)); } finally { delete this.feet; }
  };

  // ---------- the Cup: a ride ----------
  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    if (this.mc) this.mcEnd(true);
    this.rdWatch = null;
    this.rd = null;
    if (F.ui && F.ui.rdHud) F.ui.rdHud(false);
    setupExtras.apply(this, arguments);
    if (this.mapKey === 'manila') { var a = MC.arch; this.objects.push({ type: 'mc_arch', name: 'mc_arch', x0: a[0], y0: a[1], x1: a[0] + a[2] - 1, y1: a[1] + a[3] - 1, props: {} }); }
  };
  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    var r = updateExtras.apply(this, arguments);
    if (this.mapKey === 'manila') this.rdUpdate(dt, time);
    var mc = this.mc, h = this.horse;
    if (mc && h && mc.t.air > 0) { // in the air: up and down over the hurdle (the shadow stays on the ground)
      var lift = Math.sin(Math.PI * (1 - mc.t.air / MC.jump.ms)) * 0.55 * T;
      h.sprite.y -= lift;
      if (this.rider && this.rider.visible) this.rider.y -= lift;
    }
    return r;
  };
  // Start a ride (from the Cup panel): the checks, the cost, the horse at the start
  P.mcRide = function () {
    var self = this, s = this.state, now = L.clock(), c = L.mcCanTry(s, now);
    if (this.mapKey !== 'manila' || visiting(this) || this.mc) return false;
    if (!c.ok) {
      sfx('nope');
      F.ui.toast(c.why === 'closed' ? 'The Manila Cup is closed now. It opens Monday 8 AM, Manila time.' : c.why === 'horse' ? c.words : 'Another try is ' + fmt(c.cost) + ' Gold.', 3200);
      return false;
    }
    var go = function () {
      var b = L.mcBeginTry(s, L.clock());
      if (!b.ok) return F.ui.toast('Not now.');
      self.mcBegin();
    };
    if (c.cost) F.ui.confirm('ANOTHER TRY\nYour free try today is used. Ride again for ' + fmt(c.cost) + ' Gold?', go);
    else go();
    return true;
  };
  P.mcBegin = function () {
    var S = F.session, st = L.mcStart(), x = st.x * T, y = st.y * T;
    var mc = this.mc = { t: L.mcTrialNew(), count: 3000, jump: false, start: L.clock(), borrowed: false, hitch: !!S.gmHitch, prev: { horseAt: S.horseAt, follow: S.horseFollow }, last: -1 };
    F.input.reset();
    if (F.ui) F.ui.closeAll();
    if (mc.hitch) { S.gmHitch = false; if (this.gmCart) this.gmCart.img.setVisible(false); }
    if (!this.horse) { // (Mang Kardo's stable boy fetches it from home)
      mc.borrowed = true;
      var h = this.horse = { x: x, y: y + 20, sprite: F.Anim.image(this, x, y, C.HORSE), sh: F.Anim.shadow(this, x, y, C.HORSE), face: 'up', faceFlip: false };
      this.rider = this.rider || this.add.image(0, 0, F.playerKey(this), 6).setVisible(false);
      if (F.images.horse_ride && F.images.horse_rideshade) {
        var hs = C.HORSE.w * T / RIDE_PX;
        h.ride = true;
        h.sprite.setTexture(F.ensureTexture(this, 'horse_ride'), 10).setScale(hs);
        h.sh.setTexture(F.ensureTexture(this, 'horse_rideshade'), 10).setScale(hs);
        this.rideTexture(h, null);
      }
      F.ui.toast("Mang Kardo's stable boy brought " + this.state.horse.name + ' from your farm!', 2400);
    }
    if (S.riding) this.setFeet(x, y);
    else { this.horse.x = x; this.horse.y = y + 20; this.mount(); }
    this.dir = 'up';
    this.player.body.setVelocity(0, 0);
    this.changed();
    this.save();
    if (F.ui) F.ui.mcHud(true);
    sfx('drumroll');
  };
  // the ride ends: finished (t done) or stopped. quiet: the scene is starting over (no words).
  P.mcEnd = function (silent) {
    var mc = this.mc, S = F.session;
    if (!mc) return;
    this.mc = null;
    if (F.ui) F.ui.mcHud(false);
    if (mc.hitch) { S.gmHitch = true; if (this.gmCart && this.gmCart.img) this.gmCart.img.setVisible(true); }
    if (mc.borrowed && this.horse && !silent) { // (back to your farm with the stable boy)
      if (S.riding) this.dismount();
      this.horse.sprite.destroy(); this.horse.sh.destroy();
      this.horse = null;
      if (this.rider) { this.rider.destroy(); this.rider = null; }
    }
    if (mc.borrowed) { S.riding = false; S.horseAt = mc.prev.horseAt; S.horseFollow = mc.prev.follow; }
  };
  P.mcStop = function () {
    if (!this.mc) return;
    this.mcEnd();
    F.ui.toast('Ride stopped. This try is used.', 2400);
  };
  // each frame: the countdown, then the ride (its speed: riding, sprinting, off the track)
  var move = P.move;
  P.move = function (body) {
    var mc = this.mc, w = this.rdWatch;
    if (w && !mc) { body.setVelocity(0, 0); this.moving = false; return; } // (watching a race: you stand at the grandstand)
    if (!mc) return move.apply(this, arguments);
    var dt = Math.min(250, this.game.loop.delta);
    if (mc.count > 0 || mc.t.done) {
      var was = Math.ceil(mc.count / 1000);
      mc.count -= dt;
      body.setVelocity(0, 0);
      this.moving = false;
      if (mc.t.done) return;
      if (Math.ceil(mc.count / 1000) !== was) { sfx(mc.count > 0 ? 'tick' : 'neigh'); if (F.ui) F.ui.mcCount(mc.count > 0 ? String(Math.ceil(mc.count / 1000)) : 'GO!'); }
      return;
    }
    var f = this.feet(), r = L.mcTrialStep(mc.t, dt, f.x / T, f.y / T, !!F.input.holding, mc.jump);
    mc.jump = false;
    var self = this;
    r.ev.forEach(function (e) { self.mcEvent(e); });
    if (mc.t.done) { body.setVelocity(0, 0); this.moving = false; return; }
    var k = r.mult / (L.power(this.state, 'walk') ? 1.2 : 1), sp = C.SPEED;
    C.SPEED = sp * k;
    try { return move.apply(this, arguments); } finally { C.SPEED = sp; }
  };
  P.mcEvent = function (e) {
    var f = this.feet(), mc = this.mc;
    if (e === 'jump') sfx('swoosh');
    else if (e === 'clear') this.floatTextAt(f.x, f.y - 2.2 * T, 'Clear!');
    else if (e === 'knock') { sfx('woodbreak'); this.floatTextAt(f.x, f.y - 2.2 * T, '+1.5 s'); this.cameras.main.shake(140, 0.004); if (this.bits && this.bits.dust) this.bits.dust.explode(4, f.x, f.y); }
    else if (e === 'lap') { sfx('tick'); if (mc.t.laps.length < MC.laps) F.ui.mcCount('Lap ' + (mc.t.laps.length + 1)); }
    else if (e === 'finish') this.mcFinished();
    if (F.ui) F.ui.mcHudStep(mc.t, e);
  };
  P.mcFinished = function () {
    var self = this, s = this.state, mc = this.mc, t = mc.t, r = L.mcFinish(s, t, mc.start);
    sfx('fanfare');
    this.changed();
    this.save();
    F.mcSend();
    this.time.delayedCall(900, function () {
      self.mcEnd();
      F.ui.mcCard(t, r);
    });
  };
  // the action button while riding the Cup: Sprint (hold); nothing else
  var updateAction = P.updateAction;
  P.updateAction = function (time) {
    if (!this.mc && !this.rdWatch) return updateAction.apply(this, arguments);
    var key = this.mc ? 'mc-sprint' : 'mc-watch';
    if (this.hintKey !== key) { this.hintKey = key; F.bus.emit('hint', this.mc ? { label: 'Sprint', icon: C.ICON.horse } : { label: 'Watching', icon: -1, disabled: true }); }
    this.cursor.setVisible(false);
    F.input.action = false;
    F.input.released = false;
  };
  P.mcJump = function () { if (this.mc && this.mc.count <= 0) this.mc.jump = true; };

  // ---------- the HUD while you ride ----------
  var ACT = { x: 294, y: 512 + C.EXTRA };
  U.mcHud = function (on) {
    var self = this;
    if (this.mcH) { this.mcH.off(); this.mcH.c.destroy(); this.mcH = null; }
    if (!on) return;
    var c = this.add.container(0, 0).setDepth(90), y0 = 70;
    this.canvasImg(c, 46, y0, 'mc-hud-card', 268, 64, function (g) {
      g.fillStyle = 'rgba(36,22,11,0.82)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, 268, 64, 12); else g.rect(0, 0, 268, 64); g.fill();
    });
    var lap = this.txt(60, y0 + 8, 'LAP 1/' + MC.laps, 16, '#fff3c8', { fontStyle: 'bold' });
    var time = this.txt(300, y0 + 8, '0:00.00', 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
    var pen = this.txt(200, y0 + 8, '', 13, '#ff9a7a', { fontStyle: 'bold' }).setOrigin(1, 0);
    c.add([lap, time, pen, this.txt(60, y0 + 38, 'SPRINT', 11, '#ffd27a', { fontStyle: 'bold' })]);
    var track = this.add.rectangle(112, y0 + 45, 150, 12, 0x3a2414).setOrigin(0, 0.5), fill = this.add.rectangle(112, y0 + 45, 150, 12, 0xffb030).setOrigin(0, 0.5);
    c.add([track, fill]);
    var big = this.txt(W / 2, H / 2 - 40 + C.EXTRA / 2, '3', 64, '#fff3c8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 8 }).setOrigin(0.5);
    c.add(big);
    // Jump: its own button left of the action button (and a tap with a second finger, or K on a keyboard)
    var jb = this.add.container(ACT.x - 92, ACT.y + 6);
    jb.add(this.add.circle(0, 0, 30, 0x2f6aa0, 0.92).setStrokeStyle(3, 0xffffff, 0.85));
    jb.add(this.txt(0, 0, 'Jump', 14, '#ffffff', { fontStyle: 'bold', stroke: '#1a3a5a', strokeThickness: 3 }).setOrigin(0.5));
    var jz = this.add.zone(0, 0, 70, 70).setInteractive();
    jz.on('pointerdown', function () { jb.setScale(0.88); if (F.world) F.world.mcJump(); });
    jz.on('pointerup', function () { jb.setScale(1); });
    jz.on('pointerout', function () { jb.setScale(1); });
    jb.add(jz);
    c.add(jb);
    var stop = this.button(c, W / 2, y0 + 86, 72, 30, 'Stop', function () { self.confirm('STOP THE RIDE?\nThis try is used.', function () { if (F.world) F.world.mcStop(); }); }, GREY);
    void stop;
    var tap = function (p) { if (F.world && F.world.mc && self.joyId !== null && p.id !== self.joyId && !self.modals.length) F.world.mcJump(); };
    this.input.on('pointerdown', tap);
    var kb = this.input.keyboard, key = function (e) { if (e.key === 'k' || e.key === 'K') { if (F.world) F.world.mcJump(); } };
    if (kb) kb.on('keydown', key);
    this.mcH = { c: c, lap: lap, time: time, pen: pen, fill: fill, big: big, jb: jb, ms: 0,
      off: function () { self.input.off('pointerdown', tap); if (kb) kb.off('keydown', key); } };
  };
  U.mcCount = function (str) {
    var h = this.mcH;
    if (!h) return;
    this.tweens.killTweensOf(h.big);
    h.big.setText(str).setAlpha(1).setScale(1.3).setVisible(true);
    this.tweens.add({ targets: h.big, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: h.big, alpha: 0, delay: 650, duration: 300 });
  };
  U.mcHudStep = function (t, e) {
    var h = this.mcH;
    if (!h) return;
    h.lap.setText('LAP ' + Math.min(MC.laps, t.laps.length + 1) + '/' + MC.laps);
    h.pen.setText(t.knocks ? '+' + (t.knocks * MC.knockMs / 1000).toFixed(1) + ' s' : '');
    if (e === 'knock') { this.tweens.killTweensOf(h.pen); h.pen.setScale(1.4); this.tweens.add({ targets: h.pen, scale: 1, duration: 300 }); }
  };
  var uiUpdate = U.update;
  U.update = function (time, delta) {
    if (uiUpdate) uiUpdate.apply(this, arguments);
    var h = this.mcH, w = F.world, mc = w && w.mc;
    if (!h || !mc) return;
    h.fill.width = 150 * mc.t.bar;
    h.fill.fillColor = mc.t.sprinting ? 0xffe060 : 0xffb030;
    h.ms += delta;
    if (h.ms >= 60) { h.ms = 0; h.time.setText(L.mcTime(mc.t.ms + mc.t.knocks * MC.knockMs)); }
  };
  // Back while riding: stop?
  var back = U.back;
  U.back = function () {
    var w = F.world;
    if (w && w.mc && !this.modals.length) { var self = this; this.confirm('STOP THE RIDE?\nThis try is used.', function () { w.mcStop(); }); return true; }
    if (w && w.rdWatch && !this.modals.length) { w.rdWatchEnd(); return true; }
    return back.apply(this, arguments);
  };
  // the finish card
  U.mcCard = function (t, r) {
    var self = this, s = mine(), m = s ? L.mcRec(s) : null, rows = [];
    if (!r || !r.ok) rows.push([C.ICON.exclaim, 'That ride is faster than a perfect ride can be. It does not count.']);
    else {
      rows.push([C.ICON.horse, 'Laps: ' + t.laps.map(function (x) { return (x / 1000).toFixed(2) + ' s'; }).join(' · ')]);
      if (t.knocks) rows.push([C.ICON.exclaim, t.knocks + ' hurdle' + (t.knocks === 1 ? '' : 's') + ' knocked: +' + (t.knocks * MC.knockMs / 1000).toFixed(1) + ' s']);
      else rows.push([C.ICON.star, 'Every hurdle cleared!']);
      rows.push([C.ICON.ribbon, r.best ? 'A new best this week!' : 'Your best this week: ' + L.mcTime(m.wb)]);
      rows.push([C.ICON.gift, 'Runs this week: ' + r.runs + (r.runs < MC.every.runs ? ' (' + MC.every.runs + ' for ' + fmt(MC.every.gold) + ' Gold and ' + MC.every.oats + ' oats)' : ' (the 3-runs reward comes Sunday 7 PM)')]);
    }
    this.dialog('FINISH! ' + (r && r.ok ? L.mcTime(r.ms) : ''), [
      { label: 'Again', color: GREEN, cb: function () { if (F.world) F.world.mcRide(); } },
      { label: 'Board', color: BLUE, cb: function () { self.mcOpenBoard(); } },
      { label: 'OK', color: GREY },
    ], { rows: rows });
  };

  // ---------- the Cup's panel, the board, the Hall of Fame ----------
  var ARTS = ['props/manila_race_arch', 'props/manila_hurdle', 'props/manila_grandstand', 'npc_mang_kardo'].concat(ART);
  var artReady = function () {
    var want = ARTS.filter(function (k) { var f = F.packedFile && F.packedFile(k); return !(F.images && F.images[k]) && f && F.onPhone && F.onPhone(f.file) && F.canFetch(); });
    if (!want.length || !F.needImage) return Promise.resolve();
    return Promise.race([Promise.all(want.map(F.needImage)), new Promise(function (r) { setTimeout(r, 1500); })]);
  };
  var touring = false;
  var tourFirst = function (ui, key, then) {
    var s = mine();
    if (touring) return true;
    if (!s || quiet() || !L.mcTourTake(s, key)) return false;
    F.Host.save(s);
    touring = true;
    var go = function () { touring = false; ui.tour('mc_' + key, then); };
    artReady().then(go, go);
    return true;
  };
  F.mcTourFirst = tourFirst;
  U.mcOpenCup = function () {
    var self = this, s = mine(), now = L.clock();
    if (!s) return;
    if (tourFirst(this, 'cup', function () { self.mcOpenCup(); })) return;
    var w = L.mcWeek(now), m = L.mcRec(s), cost = L.mcTryCost(s, now), p = MC.prizes;
    this.dialog('THE MANILA CUP', [
      { label: 'Ride', color: GREEN, cb: function () { if (F.world) F.world.mcRide(); } },
      { label: 'Board', color: BLUE, cb: function () { self.mcOpenBoard(); } },
      { label: 'Close', color: GREY },
    ], { rows: [
      [C.ICON.horse, MC.laps + ' laps of the oval, alone. Tap Jump over the 6 hurdles (a knock: +1.5 s). Hold the action button to sprint.'],
      [C.ICON.star, w.on ? 'Open until Sunday 7 PM, Manila time. Your best time of the week counts.' : 'Closed now. It opens Monday 8 AM, Manila time.'],
      [C.ICON.ribbon, m.wb ? 'Your best this week: ' + L.mcTime(m.wb) + '. Runs: ' + m.wr + '.' : 'No ride yet this week.'],
      [C.ICON.coin, cost ? 'Next try: ' + fmt(cost) + ' Gold (the first each day is free).' : 'Your first try today is free!'],
      [C.ICON.gift, 'Sunday 7 PM: 1st ' + fmt(p[0]) + ' Gold and the Gold Cup, 2nd ' + fmt(p[1]) + ', 3rd ' + fmt(p[2]) + ', 4th-10th ' + fmt(p[3]) + ' and a ribbon. 3 runs: ' + fmt(MC.every.gold) + ' Gold and ' + MC.every.oats + ' oats.'],
    ] });
  };
  U.mcOpenBoard = function () {
    var self = this, s = mine();
    if (!s) return;
    var m = L.mcRec(s);
    var draw = function (b, note) {
      var PH = 520, top = Math.round((H - PH) / 2), L0 = 36, R0 = W - 36;
      var c = self.openModal(function () { self.closeModal(); });
      self.panelImg(c, 20, top, W - 40, PH);
      var title = self.txt(W / 2, top + 4, 'MANILA CUP BOARD', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      self.ribbon(c, W / 2, top + 4, 220);
      c.add(title);
      var y = top + 34, me = b ? b.me : null;
      self.baked(c, L0, y, 'ui-mc-board-card', R0 - L0, 92, function (g) {
        g.fillStyle(0xfff6dc, 1).fillRoundedRect(0, 0, R0 - L0, 92, 12);
        g.lineStyle(1.5, 0x7a4d26, 0.35).strokeRoundedRect(0, 0, R0 - L0, 92, 12);
      });
      var fit = function (t, w) { if (t.width > w) t.setScale(w / t.width); return t; };
      c.add(fit(self.txt(L0 + 12, y + 10, 'Your best this week: ' + (m.wb ? L.mcTime(m.wb) : 'no ride yet') + (me && me.rank ? '  ·  #' + fmt(me.rank) : ''), 15, INK, { fontStyle: 'bold' }), R0 - L0 - 24));
      c.add(fit(self.txt(L0 + 12, y + 34, (L.mcWeek().on ? 'Results Sunday 7 PM (Manila time)' : 'Closed until Monday 8 AM') + '  ·  runs: ' + m.wr, 12, '#6a4a2a'), R0 - L0 - 24));
      var ch = b && b.champ;
      c.add(fit(self.txt(L0 + 12, y + 58, ch ? MC.title + ': ' + ch.name + (ch.you ? ' (you)' : '') + ', ' + L.mcTime(ch.ms) : MC.title + ': last week\'s fastest rider', 12, ch ? '#9a6a10' : '#8a6a4a', { fontStyle: 'bold' }), R0 - L0 - 24));
      var ly = y + 104;
      c.add(self.txt(W / 2, ly, 'TOP 10 THIS WEEK', 13, '#7a2a1c', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      ly += 22;
      var line = function (r, yy) {
        if (r.you) c.add(self.add.rectangle(W / 2, yy + 11, R0 - L0, 22, 0xffe680, 0.55));
        c.add(self.txt(L0 + 4, yy + 2, '#' + fmt(r.rank), 13, INK, { fontStyle: 'bold' }));
        var nt = fit(self.txt(L0 + 50, yy + 2, r.name + (r.you ? ' (you)' : ''), 13, INK, r.you ? { fontStyle: 'bold' } : {}), 170);
        c.add(nt);
        if (F.frameName && r.id) F.frameName(self, nt, { id: r.id }, { title: false });
        c.add(self.txt(R0 - 4, yy + 2, L.mcTime(r.ms), 13, '#5a3a1e', { fontStyle: 'bold' }).setOrigin(1, 0));
      };
      if (!b) c.add(self.txt(W / 2, ly + 70, note, 14, INK, { align: 'center', wordWrap: { width: 260 }, lineSpacing: 3 }).setOrigin(0.5, 0));
      else if (!b.top.length) c.add(self.txt(W / 2, ly + 70, 'Nobody has ridden this week yet. Be the first!', 14, INK, { align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5, 0));
      else {
        b.top.forEach(function (r, i) { line(r, ly + i * 24); });
        if (me && me.rank && !b.top.some(function (r) { return r.you; })) line({ rank: me.rank, id: meId(), name: (O.me && L.cleanText(O.me.name, 24)) || 'You', ms: me.ms, you: true }, ly + 10 * 24 + 10);
      }
      self.button(c, W / 2 - 70, top + PH - 44, 124, 40, 'Prizes', function () { self.closeModal(); self.mcPrizes(function () { self.mcOpenBoard(); }); }, BLUE);
      self.button(c, W / 2 + 70, top + PH - 44, 124, 40, 'Close', function () { self.closeModal(); }, GREY);
      return c;
    };
    if (!online()) return draw(null, 'Join online play to see the board. ' + MC.soon);
    if (NET.off) return draw(null, MC.soon);
    var ticket = this.swapping;
    F.mcBoard().then(function (b) {
      if (self.swapGone && self.swapGone(ticket)) return;
      draw(b || L.mcBoardShape({ top: [] }), '');
    }, function () {
      if (self.swapGone && self.swapGone(ticket)) return;
      draw(null, NET.off ? MC.soon : 'Could not reach the online world. Check your connection.');
    });
  };
  U.mcPrizes = function (then) {
    var p = MC.prizes, e = MC.every;
    this.dialog('MANILA CUP PRIZES', [{ label: 'OK', cb: then }], { rows: [
      [C.ICON.ribbon, '1st: ' + fmt(p[0]) + ' Gold, the Gold Horseshoe Cup for your house, and "' + MC.title + '" on Manila\'s Hall of Fame for the week.'],
      [C.ICON.coin, '2nd: ' + fmt(p[1]) + ' Gold and the Silver Cup. 3rd: ' + fmt(p[2]) + ' Gold and the Bronze Cup.'],
      [C.ICON.coin, '4th to 10th: ' + fmt(p[3]) + ' Gold and a ribbon.'],
      [C.ICON.gift, 'Everyone with ' + e.runs + ' runs in a week: ' + fmt(e.gold) + ' Gold and ' + e.oats + ' oats.'],
      [C.ICON.exclaim, 'Results Sunday 7 PM, Manila time. Prizes come the next time you play online.'],
    ] });
  };
  U.mcHall = function () {
    var self = this, s = mine();
    var show = function (b, note) {
      sfx('talk');
      var ch = b && b.champ;
      self.dialog("MANILA'S HALL OF FAME", null, { rows: [
        [C.ICON.ribbon, ch ? MC.title + ': ' + ch.name + (ch.you ? ' (you!)' : '') + ', ' + L.mcTime(ch.ms) + '.' : MC.title + ': ' + note],
        [C.ICON.horse, 'The Manila Cup: ride it all week (talk to Mang Kardo at the Stables). The fastest rider of the week takes the title.'],
        [C.ICON.star, "The city's best hunters and farmers: coming soon!"],
      ] });
    };
    if (!s || !online()) return show(null, s && L.mcRec(s).wb ? 'your best this week is ' + L.mcTime(L.mcRec(s).wb) + '. ' + MC.soon : MC.soon);
    if (NET.off) return show(null, MC.soon);
    F.mcBoard().then(function (b) { show(b, 'nobody yet. Be the first!'); }, function () { show(null, MC.soon); });
  };

  // ---------- Race Day: the betting window ----------
  U.rdOpen = function (pick, amount) {
    var self = this, s = mine(), now = L.clock();
    if (!s) return;
    if (tourFirst(this, 'race', function () { self.rdOpen(); })) return;
    var n = L.rdNext(now), race = L.rdRace(n), open = L.rdOpen(n, now), bet = L.rdBetOn(s, n), day = L.rdToday(s, now);
    var sel = bet ? bet.h : pick != null ? pick : -1, amt = amount || 1000;
    var PH = 580, top = Math.round((H - PH) / 2), L0 = 34, R0 = W - 34;
    var c = this.openModal(function () { stopTimer(); self.closeModal(); });
    this.panelImg(c, 20, top, W - 40, PH);
    var title = this.txt(W / 2, top + 4, 'RACE DAY', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, top + 4, 190);
    c.add(title);
    c.add(this.txt(W / 2, top + 28, 'The ' + raceTime(n) + ' race', 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var clock = this.txt(W / 2, top + 50, '', 13, '#7a4a1e', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    c.add(clock);
    var y0 = top + 74, RH = 44, hi = this.add.rectangle(W / 2, 0, R0 - L0, RH - 4, 0xffe680, 0.7).setVisible(false);
    c.add(hi);
    c.add(this.txt(R0 - 6, y0 - 2, 'odds', 11, '#8a6a4a').setOrigin(1, 1));
    var winT = this.txt(W / 2, top + 452, '', 14, '#2f5a22', { fontStyle: 'bold' }).setOrigin(0.5, 0), amtT = this.txt(W / 2, top + 356, '', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5);
    var refresh = function () {
      if (sel >= 0) hi.setVisible(true).setY(y0 + sel * RH + RH / 2);
      amtT.setText(bet ? fmt(bet.a) + ' Gold' : fmt(amt) + ' Gold');
      var h = sel >= 0 ? race.horses[sel] : null;
      winT.setText(bet ? 'Your bet: ' + fmt(bet.a) + ' on ' + race.horses[bet.h].name + '. A win pays ' + fmt(L.rdPay(bet.a, race.horses[bet.h].odds)) + '.'
        : h ? 'If ' + h.name + ' wins: ' + fmt(L.rdPay(amt, h.odds)) + ' Gold' : 'Pick a horse.');
    };
    race.horses.forEach(function (h, j) {
      var y = y0 + j * RH;
      self.canvasImg(c, L0 + 4, y + 6, 'rd-silk-' + h.i, 30, 30, function (g) {
        g.fillStyle = col(h.silk); g.beginPath(); g.arc(15, 15, 13, 0, 7); g.fill();
        g.lineWidth = 2; g.strokeStyle = '#3d2614'; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(15, 6); g.lineTo(22, 15); g.lineTo(15, 24); g.lineTo(8, 15); g.fill();
      });
      c.add(self.txt(L0 + 44, y + 6, h.name, 15, INK, { fontStyle: 'bold' }));
      c.add(self.txt(L0 + 44, y + 25, 'Form ' + new Array(h.form + 1).join('★') + new Array(6 - h.form).join('☆'), 11, '#9a6a10'));
      c.add(self.txt(R0 - 6, y + 12, 'x' + h.odds.toFixed(1), 17, '#7a2a1c', { fontStyle: 'bold' }).setOrigin(1, 0));
      if (j) c.add(self.add.rectangle(W / 2, y, R0 - L0 - 10, 1, 0xc9a26b, 0.6));
      var z = self.add.zone(W / 2, y + RH / 2, R0 - L0, RH).setInteractive();
      F.tapOn(z, function () { if (bet || !open) return; sel = j; sfx('pick'); refresh(); });
      c.add(z);
    });
    c.add(amtT);
    var step = function (d) { var i = RD.chips.indexOf(amt); amt = Math.max(RD.min, Math.min(RD.max, d > 0 ? (RD.chips[i + 1] || amt + RD.chips[0]) : (RD.chips[i - 1] || amt - RD.chips[0]))); sfx('pick'); refresh(); };
    if (!bet && open) {
      this.button(c, L0 + 34, top + 356, 50, 36, '-', function () { step(-1); }, GREY);
      this.button(c, R0 - 34, top + 356, 50, 36, '+', function () { step(1); }, GREY);
      RD.chips.forEach(function (v, i) {
        self.button(c, L0 + 30 + i * 58, top + 404, 54, 32, v >= 1000 ? v / 1000 + 'K' : String(v), function () { amt = v; sfx('pick'); refresh(); }, 0xc8963f);
      });
    }
    c.add(winT);
    var by = top + PH - 74;
    if (!bet && open) this.button(c, W / 2 - 104, by, 96, 40, 'Bet', function () { self.rdPlace(n, sel, amt); }, GREEN);
    this.button(c, bet || !open ? W / 2 - 54 : W / 2, by, 96, 40, 'Watch', function () { stopTimer(); self.closeModal(); if (F.world) F.world.rdWatchStart(); }, BLUE);
    this.button(c, bet || !open ? W / 2 + 54 : W / 2 + 104, by, 96, 40, 'Close', function () { stopTimer(); self.closeModal(); }, GREY);
    c.add(this.txt(W / 2, top + PH - 40, 'Bets today: won ' + fmt(day.won) + ' · lost ' + fmt(day.lost) + ' · ' + fmt(day.staked) + ' of ' + fmt(RD.day) + ' bet', 11, '#6a4a2a').setOrigin(0.5, 0));
    var tick = function () {
      var t = L.clock(), left = L.rdClose(n) - t;
      if (!c.scene) return stopTimer(); // (closed)
      if (left <= 0 && open) { // (closed for bets: the next race, unless something is open on top)
        if (self.modals[self.modals.length - 1].c !== c) return;
        stopTimer(); self.closeModal(); return self.rdOpen();
      }
      var st = L.rdStart(n) - t;
      clock.setText(L.rdOpen(n, t) ? 'Bets close in ' + Math.floor(left / 60000) + ':' + ('0' + Math.floor(left / 1000) % 60).slice(-2)
        : bet ? 'Starts in ' + Math.max(0, Math.ceil(st / 1000)) + ' s' : 'Bets open ' + L.formatTime(((L.rdOpenAt(n) + MANILA) % DAY) / 60000) + '. Races 6 AM to 10 PM.');
    };
    var timer = this.time.addEvent({ delay: 1000, loop: true, callback: tick });
    var stopTimer = function () { timer.remove(); };
    tick();
    refresh();
    return c;
  };
  U.rdPlace = function (n, h, a) {
    var self = this, s = mine();
    if (h < 0) { sfx('nope'); return this.toast('Pick a horse first: tap its row.'); }
    var race = L.rdRace(n), horse = race.horses[h];
    var no = function (why) {
      sfx('nope');
      var day = L.rdToday(s);
      return self.toast({ closed: 'Bets on this race are closed.', min: 'At least ' + RD.min + ' Gold.', max: 'At most ' + fmt(RD.max) + ' Gold a race.', one: 'One bet a race.',
        day: 'Up to ' + fmt(RD.day) + ' Gold a day: ' + fmt(day.left) + ' left today.', gold: 'Not enough Gold.',
        net: 'Betting needs the internet. Try again when you are online.' }[why] || 'Not now.', 2800);
    };
    var go = function () {
      var first = L.rdCheck(s, n, h, a, L.clock());
      if (first) return no(first.why);
      if (!L.rdServerOn()) return placed(L.rdBet(s, n, h, a, L.clock()));
      if (RNET.betting) return;
      RNET.betting = true;
      F.Net.rpc('farm_race_bet_v1', { p_n: n, p_h: h, p_a: a }).then(function (r) {
        RNET.betting = false;
        if (mine() !== s) return;
        if (r && r.ok === true) return placed(L.rdBet(s, n, h, a, L.clock(), true));
        no(r && typeof r.why === 'string' ? r.why : '');
      }, function (e) {
        RNET.betting = false;
        if (rdMissing(e)) return placed(L.rdBet(s, n, h, a, L.clock())); // (no Race Day on the server yet: the old way)
        no('net');
      });
    };
    var placed = function (r) {
      if (!r.ok) return no(r.why);
      sfx('coin');
      dirty();
      F.bus.emit('hud');
      self.closeAll();
      self.rdOpen();
      self.toast('Bet placed: ' + fmt(a) + ' Gold on ' + horse.name + ' (x' + horse.odds.toFixed(1) + '). Good luck!', 2600, DARK);
    };
    if (a > RD.confirm) return this.confirm('A BIG BET\nBet ' + fmt(a) + ' Gold on ' + horse.name + ' (x' + horse.odds.toFixed(1) + ')?\nIf it wins you get ' + fmt(L.rdPay(a, horse.odds)) + '. If not, the ' + fmt(a) + ' is gone.', go);
    go();
  };
  // a bet paid (or lost), the next free moment
  U.rdPaid = function (b) {
    sfx(b.win ? 'coin' : 'nope');
    this.dialog('THE ' + raceTime(b.n) + ' RACE', null, { rows: [
      [C.ICON.horse, b.winner + ' won' + (b.photo ? ', in a photo finish!' : '!')],
      b.win ? [C.ICON.coin, 'Your ' + fmt(b.a) + ' on ' + b.horse + ' (x' + b.odds.toFixed(1) + '): you won ' + fmt(b.pay) + ' Gold!'] : [C.ICON.exclaim, 'Your ' + fmt(b.a) + ' on ' + b.horse + ': not this time.'],
    ] });
  };

  // ---------- Race Day: watching ----------
  U.rdHud = function (on) {
    if (this.rdH) { this.rdH.c.destroy(); this.rdH = null; }
    if (!on) return;
    var self = this, c = this.add.container(0, 0).setDepth(90), y0 = 70;
    this.canvasImg(c, 60, y0, 'rd-hud-card', 240, 138, function (g) { g.fillStyle = 'rgba(36,22,11,0.72)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, 240, 138, 12); else g.rect(0, 0, 240, 138); g.fill(); });
    var head = this.txt(W / 2, y0 + 5, '', 13, '#fff3c8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    c.add(head);
    var rows = [];
    for (var i = 0; i < 6; i++) {
      var dot = this.add.circle(80, y0 + 34 + i * 17, 6, 0xffffff).setStrokeStyle(1.5, 0x000000, 0.6), name = this.txt(92, y0 + 27 + i * 17, '', 12, '#ffffff', { fontStyle: 'bold' });
      c.add([dot, name]);
      rows.push({ dot: dot, name: name });
    }
    this.button(c, W / 2, y0 + 158, 120, 30, 'Stop watching', function () { if (F.world) F.world.rdWatchEnd(); }, GREY);
    this.rdH = { c: c, head: head, rows: rows, ms: 0, fixed: false };
    void self;
  };
  U.rdHudStep = function (race, along, t) {
    var h = this.rdH;
    if (!h || h.fixed || (h.ms = (h.ms || 0) + 1) % 8) return; // (8 frames apart)
    var order = [0, 1, 2, 3, 4, 5].sort(function (a, b) { return along[b] - along[a]; }), LEN = L.mcLen();
    h.head.setText(t < 0 ? 'The ' + raceTime(race.n) + ' race starts in ' + Math.ceil(-t) + ' s' : 'Lap ' + Math.min(RD.laps, 1 + Math.floor(Math.max(0, along[order[0]]) / LEN)) + '/' + RD.laps + '   ' + t.toFixed(1) + ' s');
    order.forEach(function (j, k) { var x = race.horses[j]; h.rows[k].dot.setFillStyle(x.silk); h.rows[k].name.setText((k + 1) + '. ' + x.name + '  x' + x.odds.toFixed(1)); });
  };
  U.rdHudResult = function (race, res) {
    var h = this.rdH;
    if (!h) return;
    h.fixed = true;
    h.head.setText('RESULT: ' + race.horses[res.order[0]].name + ' wins!');
    res.order.forEach(function (j, k) { var x = race.horses[j]; h.rows[k].dot.setFillStyle(x.silk); h.rows[k].name.setText((k + 1) + '. ' + x.name + '  ' + res.times[j].toFixed(2) + ' s'); });
  };
  // the photo: the two noses at the line
  U.rdPhoto = function (race, res) {
    var self = this, a = race.horses[res.order[0]], b = race.horses[res.order[1]], gap = res.times[res.order[1]] - res.times[res.order[0]];
    var c = this.openModal(function () { self.closeModal(); });
    var PH = 300, top = Math.round((H - PH) / 2);
    this.panelImg(c, 30, top, W - 60, PH);
    this.ribbon(c, W / 2, top + 4, 190);
    c.add(this.txt(W / 2, top + 4, 'PHOTO FINISH!', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    this.canvasImg(c, 56, top + 36, 'rd-photo-' + a.i + '-' + b.i, 248, 130, function (g) {
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 248, 130);
      g.fillStyle = '#b89a6a'; g.fillRect(0, 96, 248, 34);
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(170, 0); g.lineTo(170, 130); g.stroke();
      [[a, 168, 34], [b, 150, 72]].forEach(function (q) { // (each horse: a nose to the line, its jockey's silks)
        g.fillStyle = '#7a5032'; g.beginPath(); g.ellipse(q[1] - 46, q[2] + 18, 46, 16, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(q[1] - 6, q[2] + 6, 14, 9, -0.5, 0, 7); g.fill();
        g.fillStyle = col(q[0].silk); g.beginPath(); g.arc(q[1] - 52, q[2] - 4, 11, 0, 7); g.fill();
        g.strokeStyle = '#3d2614'; g.lineWidth = 2; g.stroke();
      });
      g.fillStyle = 'rgba(120,90,40,0.18)'; g.fillRect(0, 0, 248, 130);
    });
    c.add(this.txt(W / 2, top + 180, a.name + ' by a nose!', 18, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, top + 208, '1st ' + a.name + ', 2nd ' + b.name + ', ' + gap.toFixed(2) + ' s apart', 13, '#6a4a2a').setOrigin(0.5, 0));
    this.button(c, W / 2, top + PH - 40, 120, 40, 'OK', function () { self.closeModal(); }, GREEN);
    sfx('found');
    return c;
  };

  // ---------- the first-time tours ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  var fitPic = function (ui, sc, key, cx, bottom, w, h, frame) {
    if (!(F.images && F.images[key])) return null;
    F.ensureTexture(ui, key);
    var fr = ui.textures.getFrame(key, frame), k = Math.min(w / fr.realWidth, h / fr.realHeight), img = ui.add.image(cx, bottom, key, frame).setOrigin(0.5, 1).setScale(k);
    sc.add(img);
    return img;
  };
  var kardo = function (ui, sc, cx, bottom, h) {
    var def = M.people.kardo, own = F.images && F.images[def.sheet], img = fitPic(ui, sc, own ? def.sheet : 'tw_people', cx, bottom, h, h, own ? 0 : def.look[0] * 9);
    if (img && !own) img.setTint(def.look[1]);
    return img;
  };
  var silks = function (ui, sc, y, move) {
    RD.horses.slice(0, 6).forEach(function (h, i) {
      var d = ui.add.circle(46 + i * 36, y, 12, h[1]).setStrokeStyle(2, 0x3d2614);
      sc.add(d);
      tw(ui, move, { targets: d, y: y - 8, duration: 260, delay: i * 90, yoyo: true, repeat: -1, repeatDelay: 300 });
    });
  };
  F.TOURS.mc_cup = {
    title: 'THE MANILA CUP',
    steps: [
      { text: 'Mang Kardo\'s weekly race: ride ' + MC.laps + ' laps of the oval alone, Monday 8 AM to Sunday 7 PM. Your best time of the week counts. The first try each day is free.',
        draw: function (ui, sc, move) {
          var k = kardo(ui, sc, 64, 124, 100);
          if (k) tw(ui, move, { targets: k, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          if (!fitPic(ui, sc, 'props/manila_race_arch', 186, 122, 120, 110)) icon(ui, sc, 186, 66, C.ICON.horse, 0.4);
        } },
      { text: 'Six hurdles stand on the track. Tap Jump just before each one: a knocked hurdle costs 1.5 seconds.',
        draw: function (ui, sc, move) {
          fitPic(ui, sc, 'props/manila_hurdle', 160, 118, 130, 70);
          var h = icon(ui, sc, 70, 92, C.ICON.horse, 0.34);
          tw(ui, move, { targets: h, x: 240, duration: 1400, repeat: -1 });
          tw(ui, move, { targets: h, y: 46, duration: 350, delay: 330, yoyo: true, repeat: -1, repeatDelay: 700, ease: 'Sine.out' });
        } },
      { text: 'Hold the action button to sprint. The sprint bar is the race\'s own: it is full again at every lap, and your horse\'s stamina is never used.',
        draw: function (ui, sc, move) {
          var tr = ui.add.rectangle(40, 64, 192, 18, 0x3a2414).setOrigin(0, 0.5), fl = ui.add.rectangle(40, 64, 192, 18, 0xffb030).setOrigin(0, 0.5);
          sc.add([tr, fl]);
          words(ui, sc, 136, 30, 'SPRINT', 14, '#a8740c');
          words(ui, sc, 136, 102, 'Lap 1 · Lap 2 · Lap 3: full again', 12);
          tw(ui, move, { targets: fl, width: 0, duration: 1600, repeat: -1, repeatDelay: 500 });
        } },
      { text: 'Results Sunday 7 PM: 1st ' + fmt(MC.prizes[0]) + ' Gold and the Gold Horseshoe Cup, 2nd ' + fmt(MC.prizes[1]) + ' and Silver, 3rd ' + fmt(MC.prizes[2]) + ' and Bronze, 4th-10th ' + fmt(MC.prizes[3]) + ' and a ribbon. 3 runs: ' + fmt(MC.every.gold) + ' Gold and 3 oats.',
        draw: function (ui, sc, move) {
          ART.forEach(function (k, i) {
            var img = fitPic(ui, sc, k, 70 + i * 66 + (i === 0 ? 0 : 0), i === 0 ? 120 : 124, i === 0 ? 76 : 60, i === 0 ? 96 : 76);
            if (!img) img = icon(ui, sc, 70 + i * 66, 70, C.ICON.ribbon, 0.3);
            if (i === 0) tw(ui, move, { targets: img, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1 });
          });
        } },
    ],
  };
  F.TOURS.mc_race = {
    title: 'RACE DAY',
    steps: [
      { text: 'A race every 10 minutes, 6 AM to 10 PM: six horses, each in its own silks. Bet on one at the grandstand.',
        draw: function (ui, sc, move) {
          if (!fitPic(ui, sc, 'props/manila_grandstand', 136, 92, 240, 80)) words(ui, sc, 136, 60, 'GRANDSTAND', 16);
          silks(ui, sc, 112, move);
        } },
      { text: 'The odds say what a win pays: x2.4 pays 2.4 times your bet. A favourite pays less, a long shot more. The house keeps a little, so most bets lose.',
        draw: function (ui, sc, move) {
          [['Kidlat', 'x1.9', 0xf2c230], ['Tala', 'x4.2', 0x3ab0a0], ['Agila', 'x9.0', 0x4a8a3a]].forEach(function (r, i) {
            sc.add(ui.add.circle(60, 34 + i * 34, 10, r[2]).setStrokeStyle(2, 0x3d2614));
            words(ui, sc, 120, 34 + i * 34, r[0], 14);
            var o = words(ui, sc, 210, 34 + i * 34, r[1], 15, '#7a2a1c');
            if (i === 2) tw(ui, move, { targets: o, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
          });
        } },
      { text: RD.min + ' to ' + fmt(RD.max) + ' Gold a race, one bet a race, up to ' + fmt(RD.day) + ' Gold a day. Watch from the grandstand, or leave: a win is paid either way.',
        draw: function (ui, sc, move) {
          var k = kardo(ui, sc, 64, 124, 100);
          if (k) tw(ui, move, { targets: k, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 186, 46, fmt(RD.day), 22, '#a8740c');
          words(ui, sc, 186, 76, 'a day at most', 13);
        } },
    ],
  };

  // the betting and the board keep the server in step after travelling too
  var beforeTravel = P.beforeTravel;
  P.beforeTravel = function () {
    if (this.mc) this.mcEnd();
    if (this.rdWatch) this.rdWatchEnd();
    var r = beforeTravel ? beforeTravel.apply(this, arguments) : undefined;
    F.mcSend();
    F.mcPrize();
    return r;
  };
})(window.Farm = window.Farm || {});
