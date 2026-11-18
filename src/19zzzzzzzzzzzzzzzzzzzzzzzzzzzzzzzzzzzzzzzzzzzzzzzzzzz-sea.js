// Sea trips in the world (boats step 1, owner 18 Nov 2026; content 00-zzz...z-sea.js, rules 01-logicZ...Z-sea.js).
// - Manila: berth 1's sign is Kapitana Marisol's boat (the Sea trip panel: the ticket, her free one at 8 hearts, her sea
//   tasks, the sea's fish book, Hunting now); the boat is drawn in the berth; you come back to the pier ('from_sea').
// - The sea: its own small map (L.seaMap: the deck on open water), drawn from the 'sea' pack or stand-ins drawn here. The
//   4 spots (bubbles under a gull) move every 90 s; you cast only at a spot. The clock and "Back to the pier" in a chip;
//   the bell at 1 minute left; the boat comes back by itself at 10. Seaweed clumps float by (Scoop, free); the crate.
// - The Marlin: its shadow circles a spot after 5 minutes; cast there: 3 holds in a row (U.startFishGame); lost, it comes
//   back once. Landed: its dialog, the Hall of Fame's first ('sea_boss'), the Biggest catch board (sea fish too).
// - Friends: the boat is 'sea' in the farm's room (19h-online.js C.ONLINE_MORE_MAPS) and in "Hunting now"; Join walks you
//   to their farm and aboard (your own ticket), as hunting does; aboard counts (up to 4) give the group bonus.
// - The fish vendor at the Talipapa buys sea fish (a Sell tab); the sea dishes' powers toast and show their chips.
// - The first-time tour, SEA TRIPS (tip sea_tour), the first time the boat's panel opens. Pop-ups are the game's own
//   centred ones; nothing here is a bottom sheet.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var S = C.SEA;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  if (!S || !S.on || !C.MANILA || !L.seaStart) return;
  var T = C.TILE, DEPTH = F.WorldScene.DEPTH, W = F.UI_CONST.W;
  var GOLD = 0x7a5a12, GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, SEA = 0x1f4f7a, DARK_GREEN = 0x2f5a22;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var me = function () { return F.session.state; };
  var have = function (k) { return !!(F.images && F.images[k]); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var nm = function (id) { return C.ITEMS[id].name; };
  var now = function () { return L.clock(); };
  var mmss = function (ms) { var x = Math.ceil(ms / 1000); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var noop = function () {};

  C.TIPS.push({ key: 'sea_tour', text: 'SEA TRIPS' }); // (appended last: a tip is its place in a saved number)

  // ---------- the maps: the sea, and the pier's way back ----------
  var maps = F.ASSETS && F.ASSETS.maps;
  if (maps && maps.pulag) maps.sea = L.seaMap(maps.pulag);
  if (maps && maps.manila) {
    var og = maps.manila.layers.filter(function (l) { return l.type === 'objectgroup'; })[0], pier = L.seaPier();
    og.objects.push({ id: 90121, name: 'from_sea', type: 'spawn', point: true, x: pier.x, y: pier.y, width: 0, height: 0, rotation: 0, visible: true, properties: [{ name: 'dir', type: 'string', value: 'up' }] });
    og.objects.forEach(function (o) { if (o.name === 'mn_berth1') (o.properties || []).forEach(function (p) { if (p.name === 'text') p.value = "BERTH 1\nKapitana Marisol's fishing boat. Sea trips: 10 minutes on the open bay."; }); });
  }

  // ---------- the pack ----------
  var packHas = function () { return !!(F.packFiles && F.packFiles('sea').length); };
  if (F.PACK_INFO && packHas()) F.PACK_INFO.sea = { name: 'Sea Trips', icon: 'star', desc: "Kapitana Marisol's boat, the open sea, its fish and the Marlin." };
  var softPacks = F.softPacks;
  F.softPacks = function (map) { return (softPacks ? softPacks(map) : []).concat(map === 'sea' && packHas() ? ['sea'] : []); };

  // ---------- the icons: frames from C.SEA_ICON_BASE of the items texture (the owner's two sheets, or stand-ins) ----------
  F.paintSeaIcons = function (scene) {
    var tex = scene.textures.exists('items') && scene.textures.get('items'), src0 = tex && tex.source[0];
    if (!tex || !window.Phaser || !Phaser.Textures.TextureSource || !src0 || !src0.image) return;
    var cv = document.createElement('canvas'), g = cv.getContext('2d'), k = (src0.image.naturalWidth || src0.image.width) / src0.width;
    cv.width = 8 * 128;
    cv.height = 2 * 128;
    C.SEA_ICONS.forEach(function (n, i) {
      var x = (i % 8) * 128, y = Math.floor(i / 8) * 128, art = F.images && F.images[i < 8 ? 'sea/sea_fish_icons' : 'sea/sea_items_icons'];
      if (art) {
        var aw = (art.naturalWidth || art.width) / 4, ah = (art.naturalHeight || art.height) / 2, j = i % 8, z = Math.min(128 / aw, 128 / ah);
        return g.drawImage(art, (j % 4) * aw, Math.floor(j / 4) * ah, aw, ah, x + (128 - aw * z) / 2, y + (128 - ah * z) / 2, aw * z, ah * z);
      }
      var st = C.SEA_STAND[n], it = C.ITEMS[st[0]], fr = tex.get(it ? it.icon : C.ICON[st[0]]);
      if (!fr) return;
      var one = document.createElement('canvas'), o = one.getContext('2d');
      one.width = one.height = 128;
      o.drawImage(src0.image, fr.cutX * k, fr.cutY * k, fr.cutWidth * k, fr.cutHeight * k, 6, 6, 116, 116);
      o.globalCompositeOperation = 'source-atop';
      o.globalAlpha = 0.5;
      o.fillStyle = st[1];
      o.fillRect(0, 0, 128, 128);
      g.drawImage(one, x, y);
    });
    tex.seaArt = have('sea/sea_fish_icons') + have('sea/sea_items_icons');
    var src = tex.seaSrc;
    if (src) { src.image = src.source = cv; src.update(); return; }
    src = tex.seaSrc = new Phaser.Textures.TextureSource(tex, cv, cv.width, cv.height);
    tex.source.push(src);
    var at = tex.source.length - 1;
    C.SEA_ICONS.forEach(function (n, i) { var key = C.SEA_ICON_BASE + i; if (tex.has(key)) tex.remove(key); tex.add(key, at, (i % 8) * 128, Math.floor(i / 8) * 128, 128, 128); });
  };
  var ensureTexture = F.ensureTexture;
  F.ensureTexture = function (scene, key) {
    var had = scene.textures.exists(key), out = ensureTexture(scene, key);
    if (key === 'items' && !had) F.paintSeaIcons(scene);
    return out;
  };
  var iconsIn = function () { var w = F.world, t = w && w.textures && w.textures.exists('items') && w.textures.get('items'); if (t && t.seaArt !== have('sea/sea_fish_icons') + have('sea/sea_items_icons')) F.paintSeaIcons(w); };
  F.bus.on('packart', function (k) { if (/^sea\/sea_(fish|items)_icons$/.test(k)) iconsIn(); });
  F.bus.on('packs', iconsIn);
  if (F.world && F.world.textures && F.world.textures.exists('items')) F.paintSeaIcons(F.world);

  // ---------- stand-ins, drawn once (1/4 scale: a tile is 64 px) ----------
  var canvasTex = function (scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    var t = scene.textures.createCanvas(key, w, h);
    draw(t.getContext(), w, h);
    t.refresh();
    return key;
  };
  var Q = 64;
  var path = function (g, pts) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0] * Q, p[1] * Q); else g.moveTo(p[0] * Q, p[1] * Q); }); g.closePath(); };
  var rr = function (g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x * Q, y * Q, w * Q, h * Q, r * Q); else g.rect(x * Q, y * Q, w * Q, h * Q); };
  var drawBoat = function (g) { // the deck from above, pointing right, over the whole map
    var d = S.deck, hs = S.house, cr = S.crate, x0 = d[0], y0 = d[1], x1 = d[0] + d[2], y1 = d[1] + d[3], cy = (y0 + y1) / 2, y;
    g.lineWidth = 6;
    g.strokeStyle = '#5a3a1a';
    g.fillStyle = '#c8a060'; // the bamboo arms and floats
    [x0 + 3, x0 + 10].forEach(function (ax) { g.fillRect((ax - 0.12) * Q, (y0 - 2.1) * Q, 0.24 * Q, (d[3] + 4.2) * Q); g.strokeRect((ax - 0.12) * Q, (y0 - 2.1) * Q, 0.24 * Q, (d[3] + 4.2) * Q); });
    [y0 - 2.45, y1 + 1.75].forEach(function (fy) { rr(g, x0 + 0.6, fy, 12.6, 0.7, 0.35); g.fill(); g.stroke(); });
    path(g, [[x0 - 0.4, y0 - 0.4], [x1 - 0.6, y0 - 0.4], [x1 + 2.4, cy], [x1 - 0.6, y1 + 0.4], [x0 - 0.4, y1 + 0.4], [x0 - 0.8, cy]]);
    g.fillStyle = '#f4f6f8'; g.fill(); g.stroke();
    g.fillStyle = '#5aa8e0'; g.fillRect((x0 - 0.3) * Q, (y1 + 0.05) * Q, (d[2] - 0.4) * Q, 0.25 * Q); g.fillRect((x0 - 0.3) * Q, (y0 - 0.3) * Q, (d[2] - 0.4) * Q, 0.25 * Q);
    g.fillStyle = '#d8453a'; g.fillRect((x0 - 0.3) * Q, (y0 - 0.05) * Q, (d[2] - 0.4) * Q, 0.1 * Q); g.fillRect((x0 - 0.3) * Q, (y1 - 0.05) * Q, (d[2] - 0.4) * Q, 0.1 * Q);
    g.fillStyle = '#d9a860'; g.fillRect(x0 * Q, y0 * Q, d[2] * Q, d[3] * Q); // the planks
    g.strokeStyle = 'rgba(110,70,30,0.45)'; g.lineWidth = 2;
    for (y = y0 + 0.5; y < y1; y += 0.5) { g.beginPath(); g.moveTo(x0 * Q, y * Q); g.lineTo(x1 * Q, y * Q); g.stroke(); }
    g.lineWidth = 7; g.strokeStyle = '#7a4a20'; g.strokeRect(x0 * Q, y0 * Q, d[2] * Q, d[3] * Q); // the rails
    g.lineWidth = 5; g.strokeStyle = '#5a3a1a';
    rr(g, hs[0], hs[1], hs[2], hs[3], 0.15); g.fillStyle = '#f2ead6'; g.fill(); g.stroke(); // the wheelhouse
    rr(g, hs[0] - 0.15, hs[1] - 0.15, hs[2] + 0.3, hs[3] * 0.62, 0.15); g.fillStyle = '#3a78c0'; g.fill(); g.stroke();
    g.fillStyle = '#e04040'; g.beginPath(); g.arc((hs[0] + hs[2] + 0.05) * Q, (hs[1] + 2.2) * Q, 0.28 * Q, 0, 7); g.fill(); g.stroke(); // the life ring
    rr(g, cr[0] + 0.1, cr[1] + 0.05, 0.8, 0.8, 0.1); g.fillStyle = '#a8703a'; g.fill(); g.stroke(); // the crate, its shells
    g.fillStyle = '#ffe4f2'; [[0.35, 0.35], [0.62, 0.4], [0.48, 0.62]].forEach(function (p) { g.beginPath(); g.arc((cr[0] + p[0]) * Q, (cr[1] + p[1]) * Q, 0.13 * Q, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(80,110,90,0.8)'; [[0.6, 0.6], [0.6, 6.6], [5.6, 7.3]].forEach(function (p) { g.beginPath(); g.ellipse((x0 + p[0]) * Q, (y0 + p[1]) * Q, 0.55 * Q, 0.35 * Q, 0, 0, 7); g.fill(); }); // nets
    g.fillStyle = '#b8864a'; [[12.6, 0.6], [8.6, 0.5]].forEach(function (p) { g.beginPath(); g.arc((x0 + p[0]) * Q, (y0 + p[1]) * Q, 0.32 * Q, 0, 7); g.fill(); g.stroke(); }); // baskets
  };
  var drawWater = function (g, w, h) {
    g.fillStyle = '#1f5f9a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,215,240,0.45)'; g.lineWidth = 4;
    [[30, 50], [150, 120], [60, 190], [190, 30], [110, 230]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 22, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,0.5)'; [[90, 80], [210, 170], [20, 140], [170, 220]].forEach(function (p) { g.fillRect(p[0], p[1], 5, 3); });
  };
  var drawSpot = function (g) {
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(64, 48, 52, 30, 0, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)'; [[44, 40, 9], [70, 52, 12], [88, 38, 7], [56, 60, 6], [80, 64, 5]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, 7); g.fill(); });
  };
  var drawGull = function (g) {
    g.strokeStyle = '#5a6a7a'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(8, 30); g.quadraticCurveTo(30, 6, 48, 30); g.quadraticCurveTo(66, 6, 88, 30); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(48, 30, 10, 7, 0, 0, 7); g.fill();
  };
  var drawShadow = function (g) {
    g.fillStyle = 'rgba(10,25,50,0.55)';
    g.beginPath(); g.ellipse(80, 40, 58, 16, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(10, 40); g.lineTo(28, 36); g.lineTo(28, 44); g.fill(); // the bill
    g.beginPath(); g.moveTo(136, 40); g.lineTo(156, 24); g.lineTo(150, 40); g.lineTo(156, 56); g.fill(); // the tail
    g.beginPath(); g.moveTo(60, 26); g.lineTo(84, 8); g.lineTo(100, 26); g.fill(); // the sail fin
  };
  var drawWeed = function (g) {
    g.fillStyle = '#2f8a3a'; g.strokeStyle = '#1f5a22'; g.lineWidth = 4;
    [[30, 34, 22, 14], [56, 28, 20, 16], [44, 46, 26, 12]].forEach(function (e) { g.beginPath(); g.ellipse(e[0], e[1], e[2], e[3], 0.3, 0, 7); g.fill(); g.stroke(); });
  };
  var drawSide = function (g) { // the boat at the berth, from the side, facing left (3.6 x 1.6 tiles)
    g.lineWidth = 5; g.strokeStyle = '#5a3a1a';
    g.fillStyle = '#c8a060'; g.fillRect(0.4 * Q, 1.15 * Q, 2.8 * Q, 0.12 * Q);
    path(g, [[0.05, 0.75], [3.4, 0.85], [3.2, 1.35], [0.6, 1.35]]); g.fillStyle = '#f4f6f8'; g.fill(); g.stroke();
    g.fillStyle = '#d8453a'; g.fillRect(0.5 * Q, 1.0 * Q, 2.8 * Q, 0.08 * Q);
    rr(g, 1.8, 0.25, 0.8, 0.55, 0.06); g.fillStyle = '#f2ead6'; g.fill(); g.stroke();
    g.fillStyle = '#3a78c0'; g.fillRect(1.72 * Q, 0.18 * Q, 0.96 * Q, 0.14 * Q);
    g.fillStyle = '#7a4a20'; g.fillRect(1.2 * Q, 0.02 * Q, 0.06 * Q, 0.75 * Q);
    g.fillStyle = '#e04040'; path(g, [[1.26, 0.04], [1.6, 0.12], [1.26, 0.2]]); g.fill();
  };
  var art = function (scene, key, standKey, w, h, draw) { if (have(key)) return F.ensureTexture(scene, key) || key; return canvasTex(scene, standKey, w, h, draw); };

  // ---------- the HUD chip: the clock, who is aboard, Back to the pier ----------
  var chip = function (on) {
    var ui = F.ui;
    if (!ui || !ui.add) return null;
    if (!on) { if (ui.seaChip) { ui.seaChip.box.destroy(); ui.seaChip = null; } return null; }
    if (ui.seaChip) return ui.seaChip;
    var bg = ui.add.graphics();
    bg.fillStyle(0x10283c, 0.82).fillRoundedRect(0, 0, 160, 86, 10);
    var t1 = ui.add.text(10, 7, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#e8f6ff', resolution: F.R });
    var t2 = ui.add.text(10, 27, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '12px', color: '#bfe0f4', resolution: F.R });
    var box = ui.add.container(W - 168, 184, [bg, t1, t2]).setDepth(45);
    ui.button(box, 80, 66, 148, 30, 'Back to the pier', function () { var w = F.world; if (w && w.sea && !w.busy) w.seaAskBack(); }, BLUE);
    ui.seaChip = { box: box, t1: t1, t2: t2 };
    return ui.seaChip;
  };

  // ---------- Manila: the boat at berth 1 ----------
  P.seaBerth = function () {
    var b = C.MANILA.berths[0], key = art(this, 'sea/boat_marisol_side', 'fx-sea-side', 3.6 * Q, 1.6 * Q, drawSide);
    var img = this.add.image((b[0] + 0.5) * T, (b[1] - 0.1) * T, key).setOrigin(0.5, 1).setDepth(DEPTH.Walls + 0.2);
    if (have('sea/boat_marisol_side')) img.setDisplaySize(4 * T, 4 * T * img.height / img.width); else img.setDisplaySize(3.6 * T, 1.6 * T);
    this.tweens.add({ targets: img, y: img.y + 0.06 * T, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };
  var objectAction = P.objectAction;
  P.objectAction = function (o) {
    if (o && o.name === 'mn_berth1' && this.mapKey === 'manila' && !visiting(this)) return { label: 'Sea trip', icon: C.ICON.tuna, run: function () { F.ui.seaPanel(); } };
    return objectAction.apply(this, arguments);
  };

  // ---------- going aboard ----------
  var whyNot = { busy: 'A trip is on already.', rod: 'You need a fishing rod for a sea trip.', gold: 'A ticket is ' + fmt(S.ticket) + ' Gold.' };
  var aboardNow = function () {
    if (!O || !O.on || !O.others) return 1;
    return 1 + Object.keys(O.others).filter(function (id) { var x = O.others[id]; return x && x.map === 'sea' && !(O.blocked && O.blocked[id]); }).length;
  };
  P.seaBoard = function (opts) {
    opts = opts || {};
    var self = this, s = me();
    if (this.busy) return;
    if (opts.join && aboardNow() > S.most) return F.ui.toast('The boat is full: ' + S.most + ' aboard already.', 2600);
    var r = L.seaStart(s, now(), opts.free);
    if (!r.ok) { sfx('nope'); return F.ui.toast(whyNot[r.why] || 'Not now.', 2600); }
    F.session.seaOn = L.sea(s).t.a;
    F.session.riding = false;
    sfx('coin');
    F.ui.closeAll();
    F.ui.toast(r.paid ? 'Ticket: ' + fmt(r.paid) + ' Gold. All aboard!' : "Kapitana Marisol's free ticket. All aboard!", 2400, SEA);
    this.changed();
    var go = function () { if (self.sys && self.sys.isActive()) self.travel('sea', 'deck'); };
    if (packHas() && !F.packReady('sea') && F.packOnPhone('sea')) F.loadPack('sea').then(go, go);
    else { go(); if (packHas() && F.canFetch && F.canFetch() && !F.packOnPhone('sea') && !F.packProgress('sea')) F.downloadPack('sea').then(function (ok) { if (ok) F.loadPack('sea'); }); }
  };
  // On a visit, the boat is your own game, still in your friend's room (as their town and the hunting grounds are)
  var travel = P.travel;
  P.travel = function (to, spawn) {
    var v = F.session.visit;
    if (to === 'sea' && v && !this.busy) {
      var mine = me();
      v.back = v.back || { map: mine.map, player: mine.player };
      v.inTown = true;
      mine.map = 'sea';
      mine.player = { x: null, y: null, dir: 'up' };
      F.session.spawn = spawn || 'deck';
      return O.restartWorld();
    }
    return travel.apply(this, arguments);
  };

  // ---------- at sea ----------
  var create = P.create;
  P.create = function () {
    this.sea = null;
    this.seaLeaving = false;
    create.apply(this, arguments);
    var self = this, s = me();
    ['sea/sea_fish_icons', 'sea/sea_items_icons'].forEach(function (k) { var f = F.packedFile && F.packedFile(k); if (f && !have(k) && F.needImage && F.onPhone && F.onPhone(f.file)) F.needImage(k); }); // (the bag's sea icons)
    if (this.mapKey === 'sea') return this.seaSetup();
    chip(false);
    if (this.mapKey === 'manila' && !visiting(this)) this.seaBerth();
    if (L.sea(s).t && !visiting(this)) { // (the game was closed at sea, or the boat was left another way: that trip is over)
      F.session.seaSum = L.seaEnd(s, now());
      F.session.seaOn = 0;
      this.changed();
    }
    if (F.session.seaSum && !visiting(this)) {
      var sum = F.session.seaSum;
      F.session.seaSum = null;
      this.time.delayedCall(900, function () { if (self.sys && self.sys.isActive() && F.ui) F.ui.seaSummary(sum); });
    }
  };
  P.seaSetup = function () {
    var self = this, s = me(), t = L.sea(s).t, n = now();
    if (!t || F.session.seaOn !== t.a || L.seaLeft(t, n) <= 0) return this.time.delayedCall(10, function () { self.seaBack('gone'); });
    var st = this.sea = { t: t, slot: -1, list: [], marks: [], clumps: [], bell: n >= L.seaBellAt(t), aboard: 1, met: {}, near: L.seaNearOk(s), mOut: false, mIdx: -1, said: {},
      nextClump: n + 8000 };
    var M = this.map, MW = M.widthInPixels, MH = M.heightInPixels;
    var wk = have('sea/ground_sea_open') ? F.ensureTexture(this, 'sea/ground_sea_open') || 'sea/ground_sea_open' : canvasTex(this, 'fx-sea-water', 256, 256, drawWater);
    var water = this.add.tileSprite(0, 0, MW, MH, wk).setOrigin(0).setDepth(DEPTH.Ground + 0.4);
    water.setTileScale(have('sea/ground_sea_open') ? 1 : 4);
    st.water = water;
    if (this.layers.Ground) this.layers.Ground.setVisible(false); // (under the sea's own water: drawn for nothing on a slow phone)
    if (have('sea/sea_skyline')) {
      var sk = this.add.image(MW / 2, 1.1 * T, F.ensureTexture(this, 'sea/sea_skyline') || 'sea/sea_skyline').setOrigin(0.5, 1).setDepth(DEPTH.Ground + 0.45);
      sk.setScale(MW / sk.width);
    } else {
      var sg = this.add.graphics().setDepth(DEPTH.Ground + 0.45);
      sg.fillStyle(0x9ab8d0, 0.55);
      [[1, 0.7], [2.2, 0.5], [3, 0.9], [4.4, 0.6], [6, 0.8], [13, 0.6], [14.2, 1.0], [15.6, 0.55], [17, 0.75], [18.4, 0.5]].forEach(function (b) { sg.fillRect(b[0] * MW / 20, (1.1 - b[1]) * T, 0.9 * T, b[1] * T); });
      sg.fillStyle(0xf4f6f8, 0.7).fillRect(MW / 2 - 0.4 * T, 0.25 * T, 0.25 * T, 0.85 * T); // the lighthouse
    }
    var deckArt = have('sea/boat_marisol_deck');
    var boat = this.add.image(deckArt ? (S.deck[0] + S.deck[2] / 2 + 0.6) * T : 0, deckArt ? (S.deck[1] + S.deck[3] / 2) * T : 0, deckArt ? F.ensureTexture(this, 'sea/boat_marisol_deck') || 'sea/boat_marisol_deck' : canvasTex(this, 'fx-sea-deck', S.W * Q, S.H * Q, drawBoat))
      .setOrigin(deckArt ? 0.5 : 0, deckArt ? 0.5 : 0).setDepth(DEPTH.Ground + 0.6);
    if (deckArt) boat.setDisplaySize(18.4 * T, 18.4 * T * boat.height / boat.width); else boat.setDisplaySize(MW, MH);
    // the wheelhouse and the crate are solid
    [[S.house[0], S.house[1], S.house[2], S.house[3]], [S.crate[0], S.crate[1], 1, 1]].forEach(function (b) {
      var z = self.add.zone((b[0] + b[2] / 2) * T, (b[1] + b[3] / 2) * T, b[2] * T, b[3] * T);
      self.physics.add.existing(z, true);
      self.solids.add(z);
    });
    if (have('sea/sea_crate')) this.add.image((S.crate[0] + 0.5) * T, (S.crate[1] + 1) * T, F.ensureTexture(this, 'sea/sea_crate') || 'sea/sea_crate').setOrigin(0.5, 1).setDisplaySize(1.1 * T, 1.1 * T).setDepth(DEPTH.actor + (S.crate[1] + 1) * T / 1e5);
    this.tweens.add({ targets: water, tilePositionX: 512, duration: 24000, repeat: -1 });
    st.timer = this.time.addEvent({ delay: 500, loop: true, callback: function () { self.seaTick(); } });
    this.seaTick();
    if (O && O.tellHunt) this.time.delayedCall(450, O.tellHunt);
    if (!quiet() && !L.tipSeen(s, 'sea_tour')) {
      this.time.delayedCall(1400, function () {
        if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'sea_tour') || !F.ui || F.ui.modals.length) return;
        L.takeTip(s, 'sea_tour');
        self.changed();
        F.ui.seaTour();
      });
    }
  };
  P.seaTick = function () {
    var self = this, st = this.sea, t = st && st.t, s = me(), n = now();
    if (!st || this.seaLeaving) return;
    if (L.sea(s).t !== t) return this.seaBack('gone');
    var left = L.seaLeft(t, n);
    if (left <= 0) return this.seaBack('time');
    var slot = L.seaSlot(t, n);
    if (slot !== st.slot) {
      if (st.slot >= 0 && !quiet()) F.ui.toast('The birds moved: the fish are somewhere else now.', 2000, SEA);
      st.slot = slot;
      this.seaSpots(L.seaSpots(t, n, st.near));
    }
    var out = L.seaMarlinOut(t, n), idx = L.seaMarlinSpot(t, n);
    if (out !== st.mOut || idx !== st.mIdx) {
      st.mOut = out;
      st.mIdx = idx;
      this.seaShadow(out ? st.list[idx] : null);
      if (out && !st.said['m' + t.ml]) { st.said['m' + t.ml] = 1; sfx('found'); F.ui.toast(t.ml ? 'The Marlin is back! Its shadow circles a spot.' : 'A big shadow circles a spot: THE MARLIN! Cast there.', 3200, GOLD); }
    }
    if (!st.bell && n >= L.seaBellAt(t)) { st.bell = true; sfx('found'); F.ui.toast('DING DING! The bell: one minute left at sea.', 3000, GOLD); }
    // who is aboard (the farm's room): the group bonus, and friendship at the end
    st.aboard = Math.min(S.most, aboardNow());
    if (O && O.on && O.others) Object.keys(O.others).forEach(function (id) { var x = O.others[id]; if (x && x.map === 'sea') st.met[id] = x.name; });
    // a clump of seaweed floating by
    if (n >= st.nextClump) { st.nextClump = n + S.clumpSec * 1000 * (0.75 + Math.random() * 0.5); this.seaClump(); }
    var c = chip(true);
    if (c) {
      c.t1.setText('At sea  ' + mmss(left));
      c.t2.setText((st.aboard > 1 ? st.aboard + ' aboard: +' + Math.round(L.seaBonus(st.aboard) * 100) + '% big fish' : 'Fish caught: ' + t.n));
    }
    void self;
  };
  P.seaSpots = function (list) {
    var self = this, st = this.sea;
    st.marks.forEach(function (m) { self.tweens.killTweensOf(m); m.destroy(); });
    st.marks = [];
    st.list = list;
    var bk = have('sea/sea_spot') ? F.ensureTexture(this, 'sea/sea_spot') || 'sea/sea_spot' : canvasTex(this, 'fx-sea-spot', 128, 96, drawSpot);
    var gk = have('sea/sea_gull') ? F.ensureTexture(this, 'sea/sea_gull') || 'sea/sea_gull' : canvasTex(this, 'fx-sea-gull', 96, 48, drawGull);
    list.forEach(function (p) {
      var x = (p[0] + 0.5) * T, y = (p[1] + 0.5) * T;
      var b = self.add.image(x, y, bk).setDisplaySize(1.7 * T, 1.25 * T).setDepth(DEPTH.Ground + 0.7);
      var g = self.add.image(x - 0.2 * T, y - 1.1 * T, gk).setDisplaySize(0.9 * T, have('sea/sea_gull') ? 0.9 * T : 0.45 * T).setDepth(DEPTH.fx);
      self.tweens.add({ targets: b, scaleX: b.scaleX * 1.12, scaleY: b.scaleY * 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      self.tweens.add({ targets: g, x: x + 0.3 * T, y: y - 1.3 * T, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      st.marks.push(b, g);
    });
    if (st.mOut) this.seaShadow(list[st.mIdx]);
  };
  P.seaShadow = function (p) {
    var st = this.sea;
    if (st.shadow) { this.tweens.killTweensOf(st.shadow); st.shadow.destroy(); st.shadow = null; }
    if (st.spin) { st.spin.stop(); st.spin = null; }
    if (!p) return;
    var key = canvasTex(this, 'fx-sea-shadow', 160, 64, drawShadow), cx = (p[0] + 0.5) * T, cy = (p[1] + 0.5) * T, img = st.shadow = this.add.image(cx, cy, key).setDisplaySize(2.2 * T, 0.9 * T).setDepth(DEPTH.Ground + 0.65);
    st.spin = this.tweens.addCounter({ from: 0, to: Math.PI * 2, duration: 5000, repeat: -1, onUpdate: function (tw) {
      var a = tw.getValue();
      img.setPosition(cx + Math.cos(a) * 0.7 * T, cy + Math.sin(a) * 0.35 * T).setRotation(a + Math.PI / 2 + Math.PI / 2);
    } });
  };
  P.seaClump = function () {
    var st = this.sea, top = Math.random() < 0.5, y = (top ? S.deck[1] - 1 : S.deck[1] + S.deck[3]) + 0.5, right = Math.random() < 0.5;
    var img = this.add.image((right ? S.W + 1 : -1) * T, y * T, canvasTex(this, 'fx-sea-weed', 80, 64, drawWeed)).setDisplaySize(0.9 * T, 0.7 * T).setDepth(DEPTH.Ground + 0.7);
    var c = { img: img, got: false };
    st.clumps.push(c);
    this.tweens.add({ targets: img, x: (right ? -1 : S.W + 1) * T, duration: 34000, onComplete: function () { img.destroy(); st.clumps = st.clumps.filter(function (k) { return k !== c; }); } });
    return c;
  };
  P.seaScoop = function (c) {
    var s = me(), f = this.feet();
    if (L.seaScoop(s) !== 'ok') return F.ui.toast('Your bag is full!');
    c.got = true;
    this.tweens.killTweensOf(c.img);
    c.img.destroy();
    this.sea.clumps = this.sea.clumps.filter(function (k) { return k !== c; });
    sfx('pick');
    if (this.flyItem) this.flyItem(f.x, f.y - T, C.ICON.seaweed);
    F.ui.toast('Scooped a clump of Seaweed. The Mixer makes Sea Fertilizer with it.', 2400, DARK_GREEN);
    this.changed();
  };
  P.seaAskBack = function () {
    var self = this;
    F.ui.confirm('BACK TO THE PIER?\nKapitana Marisol turns the boat round. You keep every fish you caught.', function () { if (self.sea && !self.busy) self.seaBack('early'); });
  };
  // the end of a trip (any end): the crate's shells, friendship with who came along, then back to the pier
  P.seaBack = function (why) {
    if (this.seaLeaving) return;
    this.seaLeaving = true;
    var s = me(), st = this.sea, r = L.sea(s).t ? L.seaEnd(s, now()) : null;
    if (r) {
      r.why = why;
      r.friends = st ? Object.keys(st.met).filter(function (id) { return L.seaFriend(s, id, st.met[id], s.day); }).map(function (id) { return L.cleanText(st.met[id], 24) || 'Farmer'; }) : [];
      F.session.seaSum = r;
    }
    F.session.seaOn = 0;
    chip(false);
    if (this.fishing) this.endFishing();
    if (F.ui) { F.ui.game2 = null; F.ui.closeAll(); }
    if (why === 'time') sfx('found');
    this.changed();
    var self = this, go = function () { if (self.busy) return self.time.delayedCall(300, go); self.travel('manila', 'from_sea'); };
    go();
  };

  // ---------- the action button aboard: scoop, the crate, Kapitana Marisol at the wheel ----------
  var LINES = ['Watch the birds: where they dive, the fish are.', 'The bigger fish come up for a crew. Bring friends!', 'Tanigue and Tuna fight hard. Hold steady!', 'My lola said: the Marlin only bites for the patient.'];
  var resolve = P.resolve;
  P.resolve = function () {
    var st = this.sea;
    if (st && this.mapKey === 'sea' && !this.fishing && !this.seaLeaving) {
      var self = this, t = this.facing(), hs = S.house;
      var c = st.clumps.filter(function (k) { return !k.got && Math.abs(k.img.x - (t.x + 0.5) * T) < 0.9 * T && Math.abs(k.img.y - (t.y + 0.5) * T) < 0.9 * T; })[0];
      if (c) return { label: 'Scoop', icon: C.ICON.seaweed, run: function () { self.seaScoop(c); } };
      if (t.x === S.crate[0] && t.y === S.crate[1]) return { label: 'Crate', icon: C.ICON.capiz, run: function () { F.ui.dialog('THE CRATE\n' + st.t.sh + ' Capiz Shell' + (st.t.sh > 1 ? 's' : '') + ' in it, for you: Kapitana Marisol hands you the crate at the pier.'); } };
      if (t.x >= hs[0] && t.x < hs[0] + hs[2] && t.y >= hs[1] && t.y < hs[1] + hs[3]) {
        return { label: 'Talk', icon: -1, run: function () { sfx('talk'); F.ui.dialog('KAPITANA MARISOL\n"' + LINES[Math.floor(Math.random() * LINES.length)] + '"'); } };
      }
    }
    return resolve.apply(this, arguments);
  };

  // ---------- fishing aboard: only at a spot; the bite; the Marlin's fight ----------
  var startFishing = P.startFishing;
  P.startFishing = function (t) {
    var st = this.sea;
    if (!st || this.mapKey !== 'sea') return startFishing.apply(this, arguments);
    var i = L.seaSpotAt(st.list, t.x, t.y);
    if (i < 0) return F.ui.toast('Nothing bites out here. Cast at a fishing spot: the bubbles under the birds.', 2600);
    st.cast = { i: i, marlin: st.mOut && i === st.mIdx };
    return startFishing.apply(this, arguments);
  };
  var rollFish = L.rollFish;
  L.rollFish = function () {
    var w = F.world, st = w && w.mapKey === 'sea' && w.sea;
    if (!st) return rollFish.apply(L, arguments);
    if (st.cast && st.cast.marlin && L.seaMarlinOut(st.t, now())) return 'marlin';
    return L.seaRoll(Math.random, st.aboard);
  };
  var startFishGame = U.startFishGame;
  U.startFishGame = function (id, done) {
    var self = this, w = F.world;
    if (id === 'seaweed') {
      done(true);
      return this.toast('A snag! Seaweed came up instead of a fish. The Mixer makes Sea Fertilizer with it.', 2800, DARK_GREEN);
    }
    if (id !== 'marlin') return startFishGame.apply(this, arguments);
    var G = C.FISH_GAME, base = G.marlin, zone = L.seaMarlinZone(w && w.sea ? w.sea.aboard : 1), k = 0;
    var round = function () {
      G.marlin = { speed: base.speed, zone: zone };
      try {
        startFishGame.call(self, 'marlin', function (ok) {
          if (!ok) {
            L.seaMarlinLost(me(), now());
            var t = L.sea(me()).t;
            done(false);
            return self.toast(t && t.ml < S.marlin.tries ? 'The Marlin broke free! It may come back once more.' : 'The Marlin is gone for this trip.', 3000);
          }
          if (++k >= S.marlin.holds) return done(true);
          sfx('bite');
          self.toast('It runs! Hold on: ' + (k + 1) + ' of ' + S.marlin.holds + '.', 1800, GOLD);
          self.time.delayedCall(650, round);
        });
      } finally { G.marlin = base; }
    };
    round();
  };
  // a sea catch: no Derby (the river's alone); the week's Biggest catch board, the Marlin's medal and its first
  var recordDerby = O.recordDerby;
  O.recordDerby = function (lf) {
    if (!lf || !lf.sea) return recordDerby ? recordDerby.apply(O, arguments) : undefined;
    F.session.lastHunt = lf.id;
    if (O.on && !O.huntOff && F.Net && F.Net.available && F.Net.available()) {
      var kg10 = Math.round(lf.kg * 10);
      F.Net.rpc('farm_catch_v1', { p_kind: lf.id, p_kg10: kg10 }).then(function (r) {
        var rank = r && r.ok && Number(r.best) === kg10 ? Math.floor(Number(r.rank)) || 0 : 0;
        if (rank >= 1 && rank <= 10) setTimeout(function () { if (F.ui) F.ui.toast('#' + rank + ' this week for the biggest ' + nm(lf.id) + '! See Online, Ranks.', 3000, GOLD); }, 2800);
      }).catch(noop);
    }
    var w = F.world;
    if (lf.id === 'marlin' && w && w.sea) w.seaMarlinWon(lf);
  };
  P.seaMarlinWon = function (lf) {
    var s = me();
    this.seaShadow(null);
    this.sea.mOut = false;
    sfx('found');
    var self = this;
    this.time.delayedCall(1400, function () {
      if (F.ui && self.sys && self.sys.isActive()) F.ui.dialog('THE MARLIN!\nYou landed the Marlin, ' + lf.kg + ' kg! The Marlin medal is in your Sea fish book, and your weight goes on the Biggest catch board.');
    });
    if (L.hallWant && L.hallWant(s, 'sea_boss')) { F.session.dirty = true; if (O.claimFirsts) O.claimFirsts(); }
  };

  // ---------- the sea dishes: their powers ----------
  var eat = P.eat;
  P.eat = function () {
    var s = this.state, held = L.held(s), pw = held && S.powers[held.id];
    if (!pw || !pw.length) return eat.apply(this, arguments);
    var name = nm(held.id), gain = L.eat(s, s.sel), f = this.feet();
    sfx('eat');
    if (gain > 0) this.floatTextAt(f.x, f.y - 2 * T, '+' + gain + ' energy');
    F.ui.toast(name + ': ' + pw.map(function (p) { return p[1] + ' minutes, ' + S.powerText[p[0]]; }).join('; ') + '.', 3200);
    if (this.powerChip) this.powerChip();
    this.changed();
  };

  // ---------- the Talipapa's fish vendor buys sea fish ----------
  var stall = U.txOpenStall;
  U.txOpenStall = function (role, line, page, tab) {
    var self = this, s = me();
    if (role !== 'fish_vendor' || !stall || !s) return stall ? stall.apply(this, arguments) : undefined;
    var tabs = [['buy', 'Buy'], ['sell', 'Sell sea fish']], lp = this.listPanel;
    if (tab !== 'sell') {
      this.listPanel = function (o) {
        o.tabs = tabs; o.tab = 'buy';
        var re = o.reopen;
        o.reopen = function (t, p) { if (t === 'sell') return self.txOpenStall(role, line, 0, 'sell'); return re(t, p); };
        return lp.call(self, o);
      };
      try { return stall.call(this, role, line, page); } finally { delete this.listPanel; }
    }
    var again = function (msg) { var w = F.world; if (w) { w.changed(); w.save(); } F.bus.emit('hud'); self.swapTo(function () { self.txOpenStall(role, line, page, 'sell'); }); if (msg) self.toast(msg, 2600, DARK_GREEN); };
    var rows = S.ids.filter(function (id) { return L.countItem(s, id) > 0; }).map(function (id) {
      var n = L.countItem(s, id), sell = function (k) { var r = L.seaSell(s, id, k); if (!r.ok) return sfx('nope'); sfx('coin'); again('Sold ' + r.n + ' ' + nm(id) + ' for ' + fmt(r.gold) + 'G.'); };
      return { icon: C.ITEMS[id].icon, name: nm(id) + '  ·  ' + fmt(C.ITEMS[id].sell) + 'G each', desc: 'You have ' + n + '. The stall buys any amount.',
        buttons: [{ label: 'Sell 1', color: GREEN, cb: function () { sell(1); } }, { label: 'Sell all', color: BLUE, cb: function () { sell(n); } }] };
    });
    this.listPanel({ title: 'The Fish Stall', rows: rows, tabs: tabs, tab: 'sell', page: page || 0, empty: "No sea fish in your bag. Catch some on Kapitana Marisol's boat: the stall buys them at their price.",
      reopen: function (t, p) { self.txOpenStall(role, line, p, t); }, sub: function () { return 'Your gold: ' + fmt(s.gold) + 'G.'; } });
  };

  // ---------- friends: "Hunting now", Join, a friend who sails ----------
  var told = false, tellHunt = O.tellHunt;
  O.tellHunt = function () {
    var w = F.world, at = !!(w && w.mapKey === 'sea' && !F.session.visit);
    if ((at || told) && O.on && !O.huntOff && F.Net.available()) {
      if (at !== told) { told = at; F.Net.rpc('farm_hunt_here_v1', { p_map: at ? 'sea' : null }).catch(noop); }
      if (at) return;
    }
    return tellHunt ? tellHunt.apply(O, arguments) : undefined;
  };
  var outAtSea = {};
  if (F.Net && F.Net.rpc) {
    var rpc = F.Net.rpc;
    F.Net.rpc = function (name) {
      var p = rpc.apply(this, arguments);
      if (name === 'farm_hunting_v1' && p && p.then) {
        p = p.then(function (list) { outAtSea = {}; (Array.isArray(list) ? list : []).forEach(function (h) { if (h && h.id && h.map === 'sea') outAtSea[String(h.id)] = 1; }); return list; });
      }
      return p;
    };
  }
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    if (o && o.title === 'Hunting now' && Array.isArray(o.rows)) o.rows.forEach(function (r) { if (r && r.id && outAtSea[r.id]) { r.icon = C.ICON.tuna; r.desc = "Out at sea on Kapitana Marisol's boat." + String(r.desc || '').replace(/^[^.]*\./, ''); } });
    return listPanel.apply(this, arguments);
  };
  var joinHunt = U.joinHunt;
  U.joinHunt = function (id, n, map) {
    if (map !== 'sea') return joinHunt.apply(this, arguments);
    var s = me(), free = L.seaFreeOk(s), v = F.session.visit;
    if (L.sea(s).t) return this.toast(whyNot.busy, 2400);
    if (!L.hasRod(s)) return this.toast(whyNot.rod, 2400);
    if (!free && s.gold < S.ticket) return this.toast(whyNot.gold, 2400);
    this.closeAll();
    if (v && v.host === id) { v.chase = 'sea'; if (O.others[id]) O.hostMoved(v, O.others[id]); return; }
    var w = F.world;
    if (w && w.wildKeep) w.wildKeep();
    O.visit(id, n).then(function (ok) { var nv = F.session.visit; if (ok && nv && nv.host === id) nv.chase = 'sea'; });
  };
  var hostMoved = O.hostMoved;
  O.hostMoved = function (v, host) {
    var w = F.world;
    if (!host || host.map !== 'sea' || !w || w.busy || !F.ui) return hostMoved.apply(O, arguments);
    if (w.mapKey === 'sea') { v.chase = null; return; }
    var board = function () { var ww = F.world; if (ww && !ww.busy && F.session.visit === v) ww.seaBoard({ join: v.name, free: L.seaFreeOk(me()) }); };
    if (v.chase === 'sea') { v.chase = null; return board(); }
    v.asked = v.asked || {};
    if (v.asked['map:sea']) return;
    v.asked['map:sea'] = 1;
    if (F.ui.followNote) F.ui.followNote(v.name + " went out to sea on Kapitana Marisol's boat (a ticket: " + fmt(S.ticket) + 'G).', 'Join them', board, function () { var x = O.others[v.host]; return F.session.visit === v && !!x && x.map === 'sea'; });
  };

  // ---------- the boat's panel at berth 1 ----------
  var taskWords = function (t) { return t.kind === 'bring' ? 'Bring me ' + t.n + ' ' + nm(t.id) : 'A ' + nm(t.id) + ' over ' + t.n + ' kg'; };
  U.seaPanel = function (page) {
    var self = this, s = me();
    if (!s) return;
    if (!L.tipSeen(s, 'sea_tour') && !quiet()) {
      L.takeTip(s, 'sea_tour');
      if (F.world) F.world.changed();
      return this.seaTour(function () { self.seaPanel(page); });
    }
    var w = F.world, board = function (free) { self.closeAll(); if (w && !w.busy) w.seaBoard({ free: free }); };
    var rod = L.hasRod(s), free = L.seaFreeOk(s), task = L.seaTaskNow(s), hearts = L.mnHearts ? L.mnHearts(s, 'mn_marisol') : 0;
    var rows = [{ icon: C.ICON.tuna, name: 'A sea trip: ' + S.mins + ' minutes',
      desc: rod ? 'Fish ' + S.spots + ' moving spots on the open bay. Riding is free; a cast costs ' + C.FISH_ENERGY + ' energy, as on the river.' : 'You need a fishing rod for a sea trip.',
      buttons: rod ? [{ label: 'Ticket ' + fmt(S.ticket) + 'G', color: s.gold >= S.ticket ? GREEN : GREY, cb: function () { board(false); } }].concat(free ? [{ label: 'Free ticket', color: BLUE, cb: function () { board(true); } }] : []) : [] }];
    rows.push({ icon: C.ITEMS[task.id].icon, name: 'Marisol asks: ' + taskWords(task), tag: task.ready ? 'READY' : null,
      desc: (task.kind === 'bring' ? 'You have ' + task.have + '. ' : task.ready ? 'You caught one! ' : 'Catch one at sea. ') + 'For it: friendship with her and ' + fmt(S.taskGold) + ' Gold.',
      buttons: task.ready ? [{ label: 'Give', color: GREEN, cb: function () {
        if (L.seaTaskDo(s) !== 'ok') return sfx('nope');
        sfx('found');
        if (w) { w.changed(); w.save(); }
        F.bus.emit('hud');
        self.swapTo(function () { self.seaPanel(page); });
        self.toast('Kapitana Marisol: "Salamat, Kapitan!" +' + fmt(S.taskGold) + ' Gold.', 2800, DARK_GREEN);
      } }] : [] });
    rows.push({ icon: C.ICON.sea_medal, name: 'Sea fish book', desc: 'Your biggest of each sea fish, and the Marlin medal.', buttons: [{ label: 'See', color: BLUE, cb: function () { self.closeModal(); self.seaBook(0, function () { self.seaPanel(page); }); } }] });
    rows.push({ icon: C.ICON.heart, name: 'Kapitana Marisol: ' + hearts + ' hearts',
      desc: 'At ' + S.hearts.spot + ' hearts: a 5th fishing spot at sea' + (hearts >= S.hearts.spot ? ' (yours)' : '') + '. At ' + S.hearts.free + ': one free ticket a day' + (hearts >= S.hearts.free ? ' (yours)' : '') + '.' });
    var hunt = this.huntRow && this.huntRow(function () { self.seaPanel(page); });
    if (hunt) { hunt.name = 'Hunting now'; hunt.desc = 'Friends out at sea or hunting. Join a boat: up to ' + S.most + ' aboard, a bigger catch for all.'; rows.push(hunt); }
    this.listPanel({ title: "Kapitana Marisol's Boat", rows: rows, page: page || 0,
      corner: { label: 'Help', color: BLUE, cb: function () { self.closeModal(); self.seaTour(function () { self.seaPanel(page); }); } },
      reopen: function (t, p) { self.seaPanel(p); }, sub: function () { return 'Berth 1. Your gold: ' + fmt(s.gold) + 'G.'; } });
  };
  U.seaBook = function (page, back) {
    var self = this, v = L.sea(me());
    var rows = S.fish.map(function (f) {
      var n = v.c[f[0]] || 0, g = v.b[f[0]] || 0;
      return { icon: C.ITEMS[f[0]].icon, name: f[1] + (n ? '' : '  (not caught yet)'), tag: f[0] === 'marlin' && n ? 'MEDAL' : null,
        desc: n ? 'Caught ' + n + '. Biggest: ' + g / 1000 + ' kg. Sells ' + fmt(f[3]) + 'G.' : f[0] === 'marlin' ? 'The boss fish: after 5 minutes at sea its shadow circles a spot.' : Math.round(f[2] * 100) + '% of bites. Sells ' + fmt(f[3]) + 'G.' };
    });
    rows.push({ icon: C.ICON.sea_medal, name: 'The Marlin medal', tag: v.c.marlin ? 'WON' : null, desc: v.c.marlin ? 'Won! You landed the Marlin.' : 'Land the Marlin to win it.' });
    rows.push({ icon: C.ICON.capiz, name: 'Trips: ' + v.tr, desc: 'Seaweed: ' + v.w + '. Capiz Shells: ' + v.cp + '.' + (v.fr.length ? ' Sailed with: ' + v.fr.slice(0, 4).map(function (f) { return f[1] + ' (' + f[2] + ')'; }).join(', ') + '.' : '') });
    this.listPanel({ title: 'Sea fish book', rows: rows, page: page || 0, reopen: function (t, p) { self.seaBook(p, back); },
      corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null, sub: function () { return 'The biggest of each, by weight.'; } });
  };
  U.seaSummary = function (r) {
    if (!r) return;
    var lines = ['BACK AT THE PIER', r.why === 'time' ? 'Ten minutes are up: Kapitana Marisol ties up the boat.' : 'Kapitana Marisol ties up the boat.',
      'Fish caught: ' + r.fish + (r.marlin ? ', the Marlin among them!' : '.') + (r.weed ? ' Seaweed: ' + r.weed + '.' : ''),
      'The crate: ' + r.shells + ' Capiz Shell' + (r.shells > 1 ? 's' : '') + (r.basket ? ' (' + r.basket + ' wait in your basket by the farmhouse).' : ', in your bag.')];
    if (r.friends && r.friends.length) lines.push('A trip together: +1 friendship with ' + r.friends.join(', ') + '.');
    sfx('coin');
    this.dialog(lines.join('\n'));
  };

  // ---------- the first-time tour ----------
  var K = F.tourKit;
  U.seaTour = function (done) {
    var self = this;
    (K ? K.artReady(['sea/boat_marisol_side', 'sea/sea_marlin', 'sea/sea_spot']) : Promise.resolve()).then(function () { self.tour('sea', done); });
  };
  var sea = function (ui, sc) { var g = ui.add.graphics(); g.fillStyle(0x1f5f9a, 1).fillRoundedRect(4, 70, 264, 58, 10); sc.add(g); };
  if (K) F.TOURS.sea = {
    title: 'SEA TRIPS',
    steps: [
      { text: "Kapitana Marisol's boat waits at berth 1 of Manila's pier. A ticket is " + fmt(S.ticket) + ' Gold for ' + S.mins + ' minutes on the open bay. Riding is free.',
        draw: function (ui, sc, move) {
          sea(ui, sc);
          var b = K.fit(ui, sc, 'sea/boat_marisol_side', 136, 120, 200, 90, 0);
          if (!b) { canvasTex(ui, 'fx-sea-side', 3.6 * Q, 1.6 * Q, drawSide); b = K.fit(ui, sc, 'fx-sea-side', 136, 118, 190, 90, 0); }
          if (b) K.tw(ui, move, { targets: b, y: b.y + 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } },
      { text: 'Four fishing spots, bubbles under the birds, move every 90 seconds: walk the deck to them and cast. A cast costs ' + C.FISH_ENERGY + ' energy, as on the river.',
        draw: function (ui, sc, move) {
          sea(ui, sc);
          var sp = K.fit(ui, sc, 'sea/sea_spot', 136, 124, 90, 60, 0) || K.fit(ui, sc, canvasTex(ui, 'fx-sea-spot', 128, 96, drawSpot), 136, 124, 90, 60, 0);
          if (sp) K.tw(ui, move, { targets: sp, scaleX: sp.scaleX * 1.1, scaleY: sp.scaleY * 1.1, duration: 600, yoyo: true, repeat: -1 });
          [0, 1, 2].forEach(function (i) { K.icon(ui, sc, 40 + i * 30, 50, C.ICON[S.ids[i * 2]], 0.24); });
          K.words(ui, sc, 210, 50, 'Every 90 s', 13);
        } },
      { text: 'After 5 minutes the Marlin may circle a spot: a big dark shadow. Cast there and hold it three times in a row! Lose it and it may come back once.',
        draw: function (ui, sc, move) {
          sea(ui, sc);
          var m = K.fit(ui, sc, 'sea/sea_marlin', 136, 126, 180, 110, 0) || K.fit(ui, sc, canvasTex(ui, 'fx-sea-shadow', 160, 64, drawShadow), 136, 112, 170, 70, 0);
          if (m) K.tw(ui, move, { targets: m, x: m.x + 14, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          K.words(ui, sc, 136, 44, '3 holds', 14, '#7a5a12');
        } },
      { text: 'Bring friends: up to ' + S.most + ' on one boat ("Hunting now" lists it). Each extra player: +10% chance of a bigger fish for everyone.',
        draw: function (ui, sc) {
          sea(ui, sc);
          [0, 1, 2, 3].forEach(function (i) { K.icon(ui, sc, 60 + i * 50, 100, C.ICON.tuna, 0.26); });
          K.words(ui, sc, 136, 48, '+10% each', 14, '#2f6a1a');
        } },
      { text: 'Snags bring up Seaweed: the Mixer makes Sea Fertilizer with it. The crate on deck holds 1 to 3 Capiz Shells for you at the pier.',
        draw: function (ui, sc) {
          sea(ui, sc);
          K.icon(ui, sc, 70, 100, C.ICON.seaweed, 0.34);
          K.icon(ui, sc, 136, 100, C.ICON.fert_sea, 0.34);
          K.icon(ui, sc, 202, 100, C.ICON.capiz, 0.34);
        } },
    ],
  };
})(window.Farm = window.Farm || {});
