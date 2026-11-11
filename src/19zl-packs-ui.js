// Packs on screen (rules: 10b-packs.js). Owner, 3 Nov 2026: "make it minimal on game screen, you can also show it in
// detail in the pause menu". So while something downloads there is one small round badge at the top left with a ring
// that fills (tap it for the details); the pause menu's Downloads page lists every pack with its size, what is on the
// phone, a bar while it comes, and Download / Get all. The Wild Lands ask first: walking out of town to Pulag without
// them opens a small centred card (Download / Not now), and you go on in when it is done.
// Owner, 5 Nov 2026: "download should be automatic ... It is necessary so it should be automatically". So a few seconds
// after the game opens, every pack not on the phone yet comes down by itself, one after another (the badge shows it),
// onto the phone only: a pack goes into the page when its place or its look needs it. Downloads and Get all stay, for
// one that failed (it is tried again the next time the game opens).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68;
  var BADGE = { x: 22, y: 160, r: 13 };
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var mb = function (bytes) { var m = bytes / 1048576; return m >= 0.95 ? m.toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; };
  var ORDER = ['wild', 'looks', 'party', 'styles', 'places', 'manila']; // (manila: shown once it has pictures, 19zzzzzzzzzzzzzzzzzzzzzzzzz-manila.js)

  // ---------- the Wild Lands (and the new hunting places), before you go ----------
  var wildMap = function (to) { return L.isWildMap && L.isWildMap(to); };
  // (owner, 6 Nov 2026) the five new places and their dungeons need their own pack as well as the Wild Lands'
  var placeMap = function (to) {
    return (C.PLACE_ORDER || []).some(function (id) { var p = C.PLACES[id]; return p.n > 10 && !p.dev && (p.map === to || !!p.dungeon && p.dungeon.key === to); });
  };
  var packsFor = function (to) { return (wildMap(to) ? ['wild'] : []).concat(placeMap(to) ? ['places'] : []); };
  var OPENING = { wild: 'Opening the Wild Lands...', places: 'Opening the hunting places...' };
  var travel = P.travel;
  P.travel = function gated(to, spawn, floor) {
    var self = this, pack = packsFor(to).filter(function (k) { return !F.packReady(k); })[0];
    if (!pack) return travel.call(this, to, spawn, floor);
    if (this.busy || this.packGate) return;
    var go = function () { self.packGate = false; if (self.sys && self.sys.isActive()) gated.call(self, to, spawn, floor); }; // (then the next pack, if any)
    if (F.packOnPhone(pack) || (F.canFetch() && F.packCount(pack))) { // on the phone already (or most of it, a download cut short: the rest comes now, else the card): only a moment to open it
      this.packGate = true;
      if (F.ui) F.ui.toast(OPENING[pack], 1500);
      return F.loadPack(pack).then(function (ok) { if (ok) go(); else { self.packGate = false; F.ui.askPack(pack); } });
    }
    F.ui.askPack(pack, function () { /* downloaded: you walk on in yourself */ });
  };

  // A centred card: what it is, how big, Download or Not now. then() runs when it is all on the phone.
  U.askPack = function (pack, then) {
    var self = this, info = F.PACK_INFO[pack];
    if (!F.canFetch()) return this.dialog(info.name.toUpperCase() + '\nThis part of the game needs a download, and it can only come through the Selebox app.');
    if (F.packProgress(pack)) return this.toast(info.name + ' is downloading. You can keep playing.', 2200);
    this.dialog(info.name.toUpperCase() + '\n' + info.desc + '\nA one-time download of ' + mb(F.packBytesLeft(pack) || F.packBytes(pack)) + '. You can keep playing while it comes.', [
      { label: 'Not now', color: GREY },
      { label: 'Download', color: GREEN, cb: function () { self.startPack(pack, then); } },
    ]);
  };
  U.startPack = function (pack, then) {
    var self = this, info = F.PACK_INFO[pack];
    sfx('pick');
    F.downloadPack(pack).then(function (ok) {
      if (!ok) { sfx('nope'); return self.toast(info.name + ' did not finish downloading. Try again from Downloads in the pause menu.', 3200); }
      F.loadPack(pack);
      sfx('found');
      self.toast(pack === 'wild' ? 'The Wild Lands are ready! Walk on in to go hunting.' : info.name + ' is ready!', 2800, 0x2f5a22);
      if (then) then();
    });
  };

  // ---------- the small badge while something downloads ----------
  var create = U.create;
  U.create = function () {
    create.call(this);
    var self = this, b = BADGE;
    var c = this.packBadge = this.add.container(b.x, b.y).setDepth(46).setVisible(false);
    c.add(this.add.image(0, 0, this.bake('ui-pack-badge', b.r * 2 + 4, b.r * 2 + 5, function (g) {
      g.fillStyle(0x000000, 0.25).fillCircle(b.r + 2, b.r + 3, b.r);
      g.fillStyle(0x24160b, 0.82).fillCircle(b.r + 2, b.r + 2, b.r);
    })).setScale(1 / F.R));
    c.add(this.add.image(0, 0, this.bake('ui-pack-arrow', 14, 14, function (g) {
      g.fillStyle(0xfff6dc, 1).fillRect(5.5, 1, 3, 7);
      g.fillTriangle(2, 7, 12, 7, 7, 12);
      g.fillRect(2, 12.5, 10, 1.5);
    })).setScale(1 / F.R));
    this.packRing = this.add.graphics();
    c.add(this.packRing);
    var zone = this.add.zone(0, 0, b.r * 2 + 14, b.r * 2 + 14).setInteractive({ useHandCursor: true });
    F.tapOn(zone, function () { if (!self.modals.length) self.openDownloads(); });
    c.add(zone);
    var draw = function () { self.drawPackBadge(); };
    F.bus.on('packs', draw);
    this.events.once('shutdown', function () { F.bus.off('packs', draw); });
  };
  U.drawPackBadge = function () {
    var on = F.anyDownloading(), c = this.packBadge, done = 0, total = 0;
    if (!c) return;
    c.setVisible(on);
    if (!on) return;
    ORDER.forEach(function (p) { var r = F.packProgress(p); if (r) { done += r.done; total += r.total; } });
    var k = total ? done / total : 0, g = this.packRing.clear();
    g.lineStyle(2.5, 0x5a4a30, 1).strokeCircle(0, 0, BADGE.r - 1.5);
    g.lineStyle(2.5, 0x9fe07a, 1).beginPath().arc(0, 0, BADGE.r - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.04, k)).strokePath();
  };

  // ---------- the pause menu's Downloads page ----------
  U.openDownloads = function () {
    var self = this, rows = [], missing = 0;
    ORDER.forEach(function (pack) {
      var info = F.PACK_INFO[pack], files = F.packFiles(pack);
      if (!files.length) return;
      var have = F.packCount(pack), all = have === files.length, r = F.packProgress(pack), size = mb(F.packBytes(pack));
      var row = { icon: C.ICON[info.icon], name: info.name + '  ·  ' + size, desc: info.desc, buttons: [] };
      if (r) { row.progress = [r.done, r.total]; row.desc = 'Downloading... ' + Math.round(r.done / Math.max(1, r.total) * 100) + '%'; }
      else if (all) { row.done = true; row.desc = 'On your phone. ' + info.desc; }
      else {
        missing++;
        if (have) row.desc = have + ' of ' + files.length + ' on your phone. ' + info.desc;
        if (F.canFetch()) row.buttons.push({ label: 'Download', color: GREEN, cb: function () { self.startPack(pack); self.swapTo(function () { self.openDownloads(); }); } });
      }
      rows.push(row);
    });
    this.listPanel({
      title: 'Downloads', rows: rows, page: 0,
      reopen: function () { self.openDownloads(); },
      sub: function () { return F.canFetch() ? 'Extra parts of the game, downloaded once and kept on your phone.' : 'Downloads come through the Selebox app.'; },
      corner: missing > 1 && F.canFetch() ? { label: 'Get all', color: BLUE, cb: function () {
        ORDER.forEach(function (p) { if (!F.packOnPhone(p) && !F.packProgress(p)) F.downloadPack(p).then(function (ok) { if (ok && p !== 'looks') F.loadPack(p); }); });
        self.swapTo(function () { self.openDownloads(); });
      } } : null,
    });
    // the bars move while it is open
    var open = this.modals[this.modals.length - 1], tick = function () {
      if (self.modals[self.modals.length - 1] !== open) return F.bus.off('packs', tick);
      F.bus.off('packs', tick);
      self.swapTo(function () { self.openDownloads(); });
    };
    if (F.anyDownloading()) F.bus.on('packs', tick);
  };

  // ---------- every pack, by itself ----------
  var AUTO_AFTER = 6000; // (the farm's first frames and its own pictures come first)
  var autoStarted = false;
  var autoPacks = function () {
    var h = window.gameHost || {};
    if (autoStarted || !F.canFetch()) return;
    if (h.quiet && !h.autoPacks) return; // (the tests' quiet phone, unless a test asks for it)
    autoStarted = true;
    ORDER.reduce(function (chain, p) {
      return chain.then(function (ok) {
        if (!ok) return false; // offline or the CDN is down: stop, and try again next time
        if (F.packOnPhone(p)) return true;
        return F.downloadPack(p);
      });
    }, Promise.resolve(true));
  };
  var uiCreate = U.create;
  U.create = function () {
    var r = uiCreate.apply(this, arguments);
    this.time.delayedCall(AUTO_AFTER, autoPacks);
    return r;
  };

  // ---------- opening the game where you left it, in the wild ----------
  var bootCreate = F.BootScene.prototype.create;
  F.BootScene.prototype.create = function () {
    var self = this, plugin = this.scene, calls = [];
    plugin.start = function (k, d) { calls.push(['start', k, d]); return plugin; };
    plugin.launch = function (k, d) { calls.push(['launch', k, d]); return plugin; };
    try { bootCreate.call(this); } finally { delete plugin.start; delete plugin.launch; } // (the scenes start below, once the wild is ready)
    var go = function () { calls.forEach(function (c) { self.scene[c[0]](c[1], c[2]); }); };
    var s = F.session && F.session.state;
    var want = s ? packsFor(s.map).filter(function (k) { return !F.packReady(k); }) : [];
    // a place that can do without its pack (Manila: its stand-ins) still takes it in first when it is on the phone
    var soft = s && F.softPacks ? F.softPacks(s.map).filter(function (k) { return !F.packReady(k) && F.packOnPhone(k); }) : [];
    if (!want.length && !soft.length) return go();
    var back = function () { s.map = 'town'; s.player = { x: null, y: null, dir: 'right' }; F.session.spawn = 'from_pulag'; go(); };
    if (!want.every(F.packOnPhone)) return back(); // (in town by the west road: the Wild Lands ask when you walk back out)
    var done = false, timer = setTimeout(function () { if (!done) { done = true; if (want.length) back(); else go(); } }, 8000);
    Promise.all(want.concat(soft).map(F.loadPack)).then(function (r) { if (done) return; done = true; clearTimeout(timer); if (r.slice(0, want.length).every(Boolean)) go(); else back(); });
  };

})(window.Farm = window.Farm || {});
