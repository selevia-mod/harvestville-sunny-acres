// Aling Rosa's Grand Market and the horse cart in the world (step 1 of the truck plan, owner 18 Nov 2026; rules
// 01-logicZZZZZZZZZZZZZZZZZZZZZZZ-grand-market.js, numbers C.GRAND_MARKET).
// - Manila: the order board by the Grand Market is the price board (Board), the market itself opens it too (Market):
//   today's prices (the hot crops on top) and the contracts. With your cart there, Sell and Deliver.
// - Bram's Forge: a Horse Cart row (one a farm). The cart stands by the Stable: tap it to load from the Silo or the bag,
//   unload, hitch it to the horse, or send Mang Kardo with it (the gold 30 minutes later, less his 10%).
// - Hitched, the cart rolls behind the horse (ridden or following you) on the farm, in town and in Manila. By the valley
//   road only (the owner's rule: 6 hearts and Horseshoes); the train leaves the horse and cart where they were, as before.
//   Anywhere else the cart goes home by itself; its load is never lost (it is the save's, wherever the cart is).
// - The cart is drawn by the game (no picture of it yet), on a canvas once; it moves only when the horse does. In Manila a
//   horse left standing off the screen is not drawn or moved each frame.
// - Two first-time tours (the board, the cart), with the owner's pictures of the market, Aling Rosa and Mang Kardo.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var G = C.GRAND_MARKET;
  var M = C.MANILA;
  if (!G || !G.on || !M) return;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, DARK_GREEN = 0x2f5a22;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  // a friend's farm or a raid copy: not yours (in their town or out hunting with them you play your own save)
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var mine = function () { var s = F.session && F.session.state; return s && !s.isVisit && !F.session.visit ? s : null; };
  var name = function (id) { return C.ITEMS[id] ? C.ITEMS[id].name : id; };
  var keyName = function (key) { var p = L.gmSplit(key); return (p.q ? L.qualityName(p.q) + ' ' : '') + name(p.id); };
  var iconOf = function (id) { return C.ITEMS[id] ? C.ITEMS[id].icon : C.ICON.crate; };
  var horseName = function (s) { return s.horse ? s.horse.name : 'your horse'; };
  var hours = function (mins) { return mins >= 120 ? Math.floor(mins / 60) + ' hours' : mins >= 60 ? '1 hour ' + (mins - 60) + ' min' : mins + ' min'; };
  var CART_MAPS = { farm: 1, town: 1, park: 1, manila: 1 }; // (where the cart goes with the horse)
  var vehWord = function (s) { return L.trkUse && L.trkUse(s) ? L.gmVehName(s) : 'cart'; }; // (a truck: its name)

  // ---------- the cart's pictures: drawn once each on a canvas (stand-ins until its picture comes) ----------
  // Three views: 'side' (shafts to the left; mirrored for the right), 'front' (seen from where the horse is: the horse
  // going down the screen, the cart above it, clear of the rider's head; its shafts come down towards the horse) and 'back' (the horse going up,
  // the cart below it; its load on top, the shafts going up to the horse). Each loaded or empty.
  var CW = 2.3, CH = 1.7; // the side view's size in tiles (its feet: the bottom)
  var VIEW = { side: { w: CW, h: CH, foot: 1 }, front: { w: 1.5, h: 1.35, foot: 1 }, back: { w: 1.5, h: 1.6, foot: 1 } };
  var heapOf = function (g, w, cx, top, span) { // the load: sacks and crops heaped over the bed
    [['#e8d8a8', -0.28, 0.02, 0.17], ['#e8d8a8', 0.02, -0.02, 0.18], ['#d9c590', 0.3, 0.03, 0.16], ['#f0a030', -0.12, -0.1, 0.11],
      ['#7cbc4a', 0.16, -0.13, 0.1], ['#f2d34a', -0.36, -0.08, 0.08], ['#c8402a', 0.38, -0.08, 0.08]].forEach(function (p) {
      g.fillStyle = p[0]; g.beginPath(); g.ellipse(cx + p[1] * span, top + p[2] * span, p[3] * span, p[3] * span * 0.7, 0, 0, 7); g.fill();
    });
  };
  var planks = function (g, x, y, w, h) {
    g.fillStyle = '#9a6a3c'; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 6); else g.rect(x, y, w, h); g.fill();
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#b07a46'; g.fillRect(x + 2, y + 2, w - 4, h * 0.2);
    g.strokeStyle = 'rgba(60,35,15,0.45)'; g.lineWidth = 2;
    for (var k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + 1, y + h * k / 3); g.lineTo(x + w - 1, y + h * k / 3); g.stroke(); }
  };
  var DRAW = {
    side: function (g, w, h, loaded) {
      g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.ellipse(w * 0.6, h * 0.93, w * 0.36, h * 0.06, 0, 0, 7); g.fill();
      g.strokeStyle = '#6b4424'; g.lineWidth = h * 0.045; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w * 0.3, h * 0.5); g.lineTo(w * 0.03, h * 0.62); g.stroke();
      g.strokeStyle = '#7d522c'; g.beginPath(); g.moveTo(w * 0.3, h * 0.56); g.lineTo(w * 0.05, h * 0.7); g.stroke();
      if (loaded) heapOf(g, w, w * 0.62, h * 0.34, w * 0.62);
      planks(g, w * 0.26, h * 0.34, w * 0.72, h * 0.3);
      var cx = w * 0.62, cy = h * 0.7, r = h * 0.25;
      g.fillStyle = '#4a2e18'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = '#a8794a'; g.beginPath(); g.arc(cx, cy, r * 0.78, 0, 7); g.fill();
      g.strokeStyle = '#5a3a1e'; g.lineWidth = 3;
      for (var s = 0; s < 8; s++) { var a = s * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke(); }
      g.fillStyle = '#3a2412'; g.beginPath(); g.arc(cx, cy, r * 0.18, 0, 7); g.fill();
    },
    // seen end-on: the two wheels edge-on at its sides, the box between them
    front: function (g, w, h, loaded) {
      var fh = h; // (the wheels' bottom: its feet)
      g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.ellipse(w * 0.5, fh - 3, w * 0.46, fh * 0.07, 0, 0, 7); g.fill();
      if (loaded) heapOf(g, w, w * 0.5, fh * 0.4, w * 0.55);
      planks(g, w * 0.14, fh * 0.36, w * 0.72, fh * 0.42);
      g.strokeStyle = '#6b4424'; g.lineWidth = w * 0.05; g.lineCap = 'round';
      [0.36, 0.64].forEach(function (x) { g.beginPath(); g.moveTo(w * x, fh * 0.7); g.lineTo(w * (x + (x < 0.5 ? -0.04 : 0.04)), h - 4); g.stroke(); });
      [0.07, 0.93].forEach(function (x) { g.fillStyle = '#4a2e18'; g.fillRect(w * x - w * 0.055, fh * 0.42, w * 0.11, fh * 0.58); g.fillStyle = '#a8794a'; g.fillRect(w * x - w * 0.025, fh * 0.46, w * 0.05, fh * 0.5); });
    },
    back: function (g, w, h, loaded) {
      g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.ellipse(w * 0.5, h - 3, w * 0.46, h * 0.06, 0, 0, 7); g.fill();
      g.strokeStyle = '#6b4424'; g.lineWidth = w * 0.05; g.lineCap = 'round';
      [0.36, 0.64].forEach(function (x) { g.beginPath(); g.moveTo(w * x, h * 0.45); g.lineTo(w * (x + (x < 0.5 ? 0.03 : -0.03)), 4); g.stroke(); });
      if (loaded) heapOf(g, w, w * 0.5, h * 0.42, w * 0.55);
      planks(g, w * 0.14, h * 0.42, w * 0.72, h * 0.36);
      [0.07, 0.93].forEach(function (x) { g.fillStyle = '#4a2e18'; g.fillRect(w * x - w * 0.055, h * 0.46, w * 0.11, h * 0.52); g.fillStyle = '#a8794a'; g.fillRect(w * x - w * 0.025, h * 0.5, w * 0.05, h * 0.44); });
    },
  };
  F.gmCartTex = function (scene, loaded, view) {
    view = VIEW[view] ? view : 'side';
    var key = 'gm-cart-' + view + '-' + (loaded ? 1 : 0);
    if (scene.textures.exists(key)) return key;
    var PX = 64, V = VIEW[view], w = Math.round(V.w * PX), h = Math.round(V.h * PX), tex = scene.textures.createCanvas(key, w, h);
    DRAW[view](tex.getContext(), w, h, loaded);
    tex.refresh();
    return key;
  };

  // ---------- the cart in the world ----------
  // Hitched, it stays BEHIND the horse whichever way the horse faces: above it going down (drawn behind it), below it going
  // up (drawn in front), beside it going left or right. Turning, it swings round the horse (never through it or the rider)
  // on an oval: its angle eases to the new side. Where it stands from the horse's feet, in tiles, by that angle: across
  // RX (the horse's half length and the cart's), above UP (clear of the rider's head), below DOWN (clear of the horse).
  var RX = 2.15, UP = 2.05, DOWN = 1.5, BEHIND = { down: -Math.PI / 2, up: Math.PI / 2, left: 0, right: Math.PI };
  var offsetOf = function (a) { var sn = Math.sin(a); return { x: Math.cos(a) * RX * T, y: sn * (sn < 0 ? UP : DOWN) * T }; };
  var viewOf = function (a) { var sn = Math.sin(a); return sn < -0.72 ? 'front' : sn > 0.72 ? 'back' : 'side'; };
  // where it is parked on the farm: beside the Stable (its right side, or its left at the farm's edge)
  P.gmParkSpot = function () {
    var st = this.objects.filter(function (o) { return o.type === 'stable'; })[0], W = this.map ? this.map.width : C.FARM_W;
    if (st) {
      var x0 = st.x1 + 1 + CW <= W - 1 ? st.x1 + 1 : st.x0 - CW;
      return { x: (x0 + CW / 2) * T, y: (st.y1 + 1) * T - 8 };
    }
    var hp = this.points && this.points.horse;
    return hp ? { x: hp.x + 2 * T, y: hp.y } : null;
  };
  // which way the horse faces: the rider's way; walking on its own, the way it went (h.face when it stopped)
  P.gmHorseDir = function (h) {
    if (F.session.riding) return this.dir;
    var c = this.gmCart;
    if (c && c.hx != null && (Math.abs(h.x - c.hx) > 2 || Math.abs(h.y - c.hy) > 2)) {
      var dx = h.x - c.hx, dy = h.y - c.hy;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    if (c && c.dir) return c.dir;
    return h.face === 'up' ? 'up' : h.face === 'side' ? (h.faceFlip ? 'right' : 'left') : 'down';
  };
  P.gmCartSetup = function () {
    var S = F.session, s = this.state, c = this.gmCart;
    if (c) { c.img.destroy(); this.objects = this.objects.filter(function (o) { return o !== c.obj; }); }
    this.gmCart = null;
    if (visiting(this) || !L.gmHasCart(s)) return;
    var h = this.horse, at = null, hitched = !!(S.gmHitch && h), ang = 0;
    if (hitched) { ang = BEHIND[this.gmHorseDir(h)] || 0; var o0 = offsetOf(ang); at = { x: h.x + o0.x, y: h.y + o0.y }; }
    else if (this.mapKey === 'farm' && !L.gmAway(s)) at = this.gmParkSpot();
    if (!at) return;
    var loaded = L.gmLoad(s) > 0, view = hitched ? viewOf(ang) : 'side';
    var img = this.add.image(at.x, at.y, F.gmCartTex(this, loaded, view));
    c = this.gmCart = { img: img, x: at.x, y: at.y, ang: ang, view: null, flip: false, hx: h ? h.x : null, hy: h ? h.y : null, dir: null, loaded: loaded,
      obj: { type: 'gm_cart', name: 'gm_cart', x0: 0, y0: 0, x1: 0, y1: 0, props: {} } };
    this.objects.push(c.obj);
    this.gmCartView(view, hitched && Math.cos(ang) < -0.3);
    this.gmCartPlace(at.x, at.y);
  };
  // its picture for a view (and mirrored or not): changed only when that changes
  P.gmCartView = function (view, flip) {
    var c = this.gmCart, V = VIEW[view];
    if (c.view === view && c.flip === flip) return;
    c.view = view;
    c.flip = flip;
    c.img.setTexture(F.gmCartTex(this, c.loaded, view)).setOrigin(0.5, V.foot).setDisplaySize(V.w * T, V.h * T).setFlipX(flip);
  };
  P.gmCartPlace = function (x, y) {
    var c = this.gmCart, o = c.obj, hw = VIEW[c.view].w * T / 2;
    c.x = x; c.y = y;
    c.img.setPosition(x, y);
    F.depthTo(c.img, DEPTH.actor + y / 1e5 - 0.00005); // (by its feet: behind the horse above it, in front below it)
    o.x0 = Math.floor((x - hw + 0.3 * T) / T); o.x1 = Math.floor((x + hw - 0.3 * T) / T);
    o.y0 = o.y1 = Math.floor((y - 1) / T);
  };
  // loaded or empty (its picture changes only when that does)
  P.gmCartLook = function () {
    var c = this.gmCart, s = this.state;
    if (!c) return;
    var loaded = L.gmLoad(s) > 0, view = c.view;
    if (loaded === c.loaded) return;
    c.loaded = loaded;
    c.view = null;
    this.gmCartView(view, c.flip);
  };
  // hitched: behind the horse (only while the horse moves or the cart is still swinging round to its new side)
  P.gmTrail = function (h, dt) {
    var c = this.gmCart, dir = this.gmHorseDir(h), want = BEHIND[dir];
    c.dir = dir;
    var moved = c.hx !== h.x || c.hy !== h.y;
    c.hx = h.x;
    c.hy = h.y;
    if (want == null) want = c.ang;
    // the short way round (angles kept in -pi..pi; half a turn, down <-> up, goes by the right-hand side)
    var d = want - c.ang;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    if (!moved && Math.abs(d) < 0.001) return;
    var far = Math.hypot(c.x - h.x, c.y - h.y) > 6 * T; // (the horse jumped: behind it at once)
    c.ang = far || Math.abs(d) < 0.01 ? want : c.ang + d * (1 - Math.exp(-(dt || 16) / 110));
    if (c.ang > Math.PI) c.ang -= 2 * Math.PI; else if (c.ang <= -Math.PI) c.ang += 2 * Math.PI;
    var o = offsetOf(c.ang);
    this.gmCartView(viewOf(c.ang), Math.cos(c.ang) < -0.3);
    this.gmCartPlace(h.x + o.x, h.y + o.y);
  };
  // the cart is at the Grand Market (Manila, hitched, near Aling Rosa's door)
  P.gmAtMarket = function () {
    var c = this.gmCart, d = M.spots && M.spots.door_market;
    return !!(c && d && this.mapKey === 'manila' && F.session.gmHitch && !visiting(this) && Math.hypot(c.x - d[0] * T, c.y - d[1] * T) <= G.near * T);
  };

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.apply(this, arguments);
    var S = F.session, s = this.state, h = this.horse;
    this.gmCart = null;
    this.gmHorseOff = false;
    this.gmCullMs = 0;
    if (visiting(this)) return;
    // home again with the horse at its Stable (not ridden, not with you): the cart is parked. (Elsewhere it stays with the
    // horse, wherever that waits: in town while you are in a shop, say.)
    if (S.gmHitch && (!L.gmHasCart(s) || L.gmAway(s) || (this.mapKey === 'farm' && (!h || (!S.riding && !S.horseFollow && !(S.horseAt && S.horseAt.map === 'farm')))))) S.gmHitch = false;
    // the cart goes with the horse only on the farm, in town and in Manila: anywhere else it rolls home by itself
    if (S.gmHitch && h && !CART_MAPS[this.mapKey]) {
      S.gmHitch = false;
      this.time.delayedCall(600, function () { if (F.ui) F.ui.toast('Your cart rolled home to the farm. Its load is safe.', 2600); });
    }
    this.gmCartSetup();
    // the price board by the Grand Market: something to face
    if (this.mapKey === 'manila') {
      var b = M.props.filter(function (p) { return p[0] === 'order_board'; })[0];
      if (b) this.objects.push({ type: 'gm_board', name: 'gm_board', x0: b[1], y0: b[2], x1: b[1] + b[3] - 1, y1: b[2] + b[4] - 1, props: {} });
    }
  };

  // ---------- each frame ----------
  var onScreen = function (scene, x, y) {
    var v = scene.cameras.main.worldView, m = 3 * T;
    return x > v.x - m && x < v.right + m && y > v.y - m && y < v.bottom + m;
  };
  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    var h = this.horse, S = F.session;
    // (Manila: a horse standing off the screen, waiting, is not drawn or moved each frame; looked at again every 0.3 s)
    if (h && this.mapKey === 'manila' && !S.riding && !S.horseFollow && !h.run) {
      this.gmCullMs -= dt;
      if (this.gmCullMs <= 0) {
        this.gmCullMs = 300;
        var off = !onScreen(this, h.x, h.y);
        if (off !== this.gmHorseOff) { this.gmHorseOff = off; h.sprite.setVisible(!off); h.sh.setVisible(!off); if (this.gmCart) this.gmCart.img.setVisible(!off); }
      }
      if (this.gmHorseOff) {
        this.horse = null;
        try { return updateExtras.apply(this, arguments); } finally { this.horse = h; }
      }
    } else if (this.gmHorseOff && h) {
      this.gmHorseOff = false;
      h.sprite.setVisible(true);
      h.sh.setVisible(true);
      if (this.gmCart) this.gmCart.img.setVisible(true);
    }
    var r = updateExtras.apply(this, arguments);
    if (this.gmCart && S.gmHitch && this.horse) this.gmTrail(this.horse, dt);
    return r;
  };

  // ---------- Mang Kardo coming back (looked at once a second, on any map of your own game) ----------
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var r = tickClock.apply(this, arguments);
    if (!r && this.clockMs === 0) this.gmCheckTrip();
    return r;
  };
  P.gmCheckTrip = function () {
    var s = this.state;
    if (visiting(this) || this.busy || !s.gm || !s.gm.trip || !F.ui || F.ui.modals.length) return;
    var r = L.gmFinish(s, L.nowMin());
    if (!r) return;
    sfx('coin');
    this.changed();
    this.save();
    if (this.mapKey === 'farm') this.gmCartSetup(); // (the cart is back by the Stable)
    F.ui.gmTripReport(r);
  };
  U.gmTripReport = function (r) {
    var rows = [], c = r.k >= 0;
    var crops = {};
    r.lots.forEach(function (l) { var id = L.gmSplit(l.key).id; crops[id] = (crops[id] || 0) + l.n; });
    Object.keys(crops).forEach(function (id) { rows.push([iconOf(id), (c || r.co ? 'Delivered ' : 'Sold ') + crops[id] + ' ' + name(id) + (r.co ? ' for the City Order.' : c ? ' for the contract.' : ' at the Grand Market.')]); });
    rows.push([C.ICON.coin, 'Aling Rosa paid ' + fmt(r.gold) + 'G. Mang Kardo kept his ' + Math.round((r.rate != null ? r.rate : G.driver.fee) * 100) + '%: ' + fmt(r.fee) + 'G.']);
    rows.push([C.ICON.coin, 'You got ' + fmt(r.net) + 'G!']);
    if (r.star) rows.push([C.ICON.star, 'Contract done: +1 Market Star!']);
    rows.push([C.ICON.crate, 'Your ' + vehWord(F.session.state) + ' is back by the Stable.']);
    this.dialog('MANG KARDO IS BACK!\n' + rows.map(function (x) { return x[1]; }).join('\n'), null, { rows: rows });
  };

  // ---------- the action button ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o && o.type === 'gm_cart') return { label: 'Cart', icon: C.ICON.crate, run: function () { F.ui.gmOpenCart(); } };
    if (o && this.mapKey === 'manila' && !visiting(this) && (o.type === 'gm_board' || (o.type === 'mn_spot' && o.name === 'market'))) {
      return { label: o.type === 'gm_board' ? 'Board' : 'Market', icon: C.ICON.coin, run: function () { F.ui.gmOpenMarket(); } };
    }
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- going places with the horse and the cart ----------
  var travel = P.travel;
  P.travel = function (to, spawn) {
    if (this.busy || visiting(this) || to === this.mapKey || !this.state.horse) return travel.apply(this, arguments);
    var S = F.session, s = this.state;
    // the train takes you, not the horse: it (and the cart) wait where they are, as before
    var train = (to === 'manila' && spawn === 'from_train') || (this.mapKey === 'manila' && spawn === 'platform_w');
    if (train && (S.riding || S.horseFollow) && this.horse) {
      if (S.riding) this.dismount();
      this.horseWait();
    }
    // riding the valley road: the owner's rule (6 hearts and Horseshoes); without it you get off and walk on, and the
    // horse waits at the road's end (as it always did). Riding it costs no stamina (owner, 18 Nov 2026)
    if (to === 'manila' && spawn === 'from_valley' && S.riding) {
      var ok = L.horseRoadOk(s, true);
      if (!ok.ok) {
        this.dismount();
        this.horseWait();
        if (F.ui) F.ui.toast(ok.why + '\nIt waits here; you walk on.', 3600);
      }
    }
    var out = travel.apply(this, arguments);
    return out;
  };

  // ---------- Bram's Forge: the Horse Cart ----------
  var withRows = function (ui, extra, fn) {
    var lp = ui.listPanel;
    ui.listPanel = function (o) { o.rows = o.rows.concat(extra(o)); return lp.call(this, o); };
    try { return fn(); } finally { if (ui.hasOwnProperty('listPanel')) delete ui.listPanel; }
  };
  U.gmCartRow = function (s, page) {
    var self = this, R = G.cart, have = L.gmCartMade(s);
    return {
      icon: C.ICON.crate, name: have ? 'Horse Cart (made)' : 'Horse Cart',
      desc: have ? 'By your Stable. It carries ' + R.cap + ' crops.' : 'Also ' + R.lumber + ' lumber. It carries ' + R.cap + ' crops.',
      reward: have ? null : { gold: R.gold, more: R.needs }, rewardPrefix: 'Cost', buttonsBelow: true,
      buttons: have ? [] : [{ label: 'Make', color: BLUE, cb: function () {
        var r = L.gmMakeCart(s);
        if (r === 'horse') { sfx('nope'); return self.toast('The cart needs a horse to pull it. Mira builds the Stable.', 2800); }
        if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold: ' + fmt(R.gold) + 'G.'); }
        if (r === 'lumber') { sfx('nope'); return self.toast('You need ' + R.lumber + ' lumber.'); }
        if (r === 'needs') { sfx('nope'); return self.toast('You need ' + L.needsText(R.needs) + '.', 2800); }
        if (r !== 'ok') return;
        sfx('anvil');
        if (F.world) { F.world.changed(); F.world.save(); }
        self.closeModal();
        self.openForge(page);
        self.toast('Clang! Bram made you a Horse Cart. It is waiting by your Stable.', 3200, DARK_GREEN);
      } }],
    };
  };
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this, s = F.session.state;
    if (!s || s.isVisit || F.session.visit) return openForge.call(this, page);
    return withRows(this, function (o) {
      var at = o.rows.length, more = self.trkForgeRows ? 3 : 0, per = at + 1 + more > 5 ? 4 : 5; // (the trucks' rows after the cart's)
      return [self.gmCartRow(s, Math.floor(at / per))].concat(more ? self.trkForgeRows(s, at + 1, per) : []);
    }, function () { return openForge.call(self, page); });
  };

  // ---------- the first-time tours ----------
  // the owner's pictures of the market and the two people, from the phone if they are there (a moment at most)
  var ART = ['props/manila_grand_market', 'npc_aling_rosa', 'npc_mang_kardo'];
  var artReady = function () {
    var want = ART.filter(function (k) { var f = F.packedFile && F.packedFile(k); return !(F.images && F.images[k]) && f && F.onPhone && F.onPhone(f.file) && F.canFetch(); });
    if (!want.length || !F.needImage) return Promise.resolve();
    return Promise.race([Promise.all(want.map(F.needImage)), new Promise(function (r) { setTimeout(r, 1500); })]);
  };
  var touring = false;
  var tourFirst = function (ui, key, then) {
    var s = mine();
    if (touring) return true;
    if (!s || quiet() || L.gmTourSeen(s, key)) return false;
    L.gmTourTake(s, key);
    F.Host.save(s);
    touring = true;
    artReady().then(function () { touring = false; ui.tour('gm_' + key, then); }, function () { touring = false; ui.tour('gm_' + key, then); });
    return true;
  };
  F.gmTourFirst = tourFirst;
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  // a picture fitted into a box (its feet on the box's bottom), or the stand-in when it is not on the phone
  var fit = function (ui, sc, key, stand, cx, bottom, w, h, frame) {
    var k = F.images && F.images[key] ? key : stand && F.images && F.images[stand] ? stand : null;
    if (!k) return null;
    F.ensureTexture(ui, k);
    var fr = ui.textures.getFrame(k, frame), s = Math.min(w / fr.realWidth, h / fr.realHeight);
    var img = ui.add.image(cx, bottom, k, frame).setOrigin(0.5, 1).setScale(s);
    sc.add(img);
    return img;
  };
  var person = function (ui, sc, who, cx, bottom, h) {
    var def = M.people[who], own = F.images && F.images[def.sheet];
    var img = fit(ui, sc, own ? def.sheet : 'tw_people', null, cx, bottom, h, h, own ? 0 : def.look[0] * 9);
    if (img && !own) img.setTint(def.look[1]);
    return img;
  };
  F.gmKit = { icon: icon, words: words, tw: tw, fit: fit, person: person }; // (the trucks' tours draw with these too)
  var cart = function (ui, sc, cx, bottom, w, loaded, flip) {
    var img = ui.add.image(cx, bottom, F.gmCartTex(ui, loaded)).setOrigin(0.5, 1).setDisplaySize(w, w * CH / CW).setFlipX(!!flip);
    sc.add(img);
    return img;
  };
  var board = function (ui, sc, x, y, rows) {
    ui.canvasImg(sc, x, y, 'gm-tour-board', 128, 104, function (g) {
      g.fillStyle = '#6b4424'; g.fillRect(14, 84, 8, 20); g.fillRect(106, 84, 8, 20);
      g.fillStyle = '#8a5a32'; g.fillRect(0, 0, 128, 88);
      g.fillStyle = '#f4e4bc'; g.fillRect(6, 6, 116, 76);
    });
    rows.forEach(function (r, i) {
      icon(ui, sc, x + 22, y + 20 + i * 24, C.ITEMS[r[0]].icon, 0.17);
      words(ui, sc, x + 76, y + 20 + i * 24, r[1], 12, r[2] ? '#c0392b' : INK);
    });
  };
  F.TOURS.gm_board = {
    title: "ALING ROSA'S GRAND MARKET",
    steps: [
      {
        text: 'Aling Rosa buys big loads at the Grand Market in Manila: ' + G.minLoad + ' or more of one crop, brought in your Horse Cart.',
        draw: function (ui, sc, move) {
          fit(ui, sc, 'props/manila_grand_market', 'props/inn', 96, 126, 170, 118);
          var r = person(ui, sc, 'rosa', 216, 124, 96);
          if (r) tw(ui, move, { targets: r, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'Her board has new prices every day, the same for everyone: ' + G.mult[0] + ' to ' + G.mult[1] + ' times the sell price. ' + G.hotN + ' hot crops pay up to ' + G.hot[1] + '!',
        draw: function (ui, sc, move) {
          board(ui, sc, 30, 14, [['corn', 'x1.78 HOT', true], ['tomato', 'x1.45'], ['potato', 'x1.12']]);
          var c = icon(ui, sc, 212, 66, C.ICON.coin, 0.4);
          tw(ui, move, { targets: c, scale: 0.46, duration: 400, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Every day, ' + G.contract.n + ' contracts: ' + G.contract.min + ' to ' + G.contract.max + ' of one crop at ' + G.contract.pay + ' times, in 48 hours. Finish one for a Market Star.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 58, C.ITEMS.pumpkin.icon, 0.34);
          words(ui, sc, 70, 104, '200 in 48 h', 13);
          var st = icon(ui, sc, 206, 60, C.ICON.star, 0.38);
          words(ui, sc, 206, 104, '+1 Market Star', 13, '#a8740c');
          tw(ui, move, { targets: st, angle: { from: -12, to: 12 }, duration: 500, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
  F.TOURS.gm_cart = {
    title: 'THE HORSE CART',
    steps: [
      {
        text: 'Bram makes the Horse Cart at his Forge. It carries ' + G.cart.cap + ' crops and stands by your Stable.',
        draw: function (ui, sc, move) {
          var c = cart(ui, sc, 136, 112, 150, false);
          tw(ui, move, { targets: c, x: 146, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          icon(ui, sc, 40, 70, C.ICON.horse, 0.34);
        },
      },
      {
        text: 'Tap it to load crops from the Silo or your bag. Unload them back any time.',
        draw: function (ui, sc, move) {
          cart(ui, sc, 186, 116, 140, true);
          ['corn', 'tomato', 'pumpkin'].forEach(function (id, n) {
            var i = icon(ui, sc, 46, 40 + n * 30, C.ITEMS[id].icon, 0.24);
            tw(ui, move, { targets: i, x: 176, y: 56, alpha: 0, duration: 900, delay: n * 300, repeat: -1, repeatDelay: 300 });
          });
        },
      },
      {
        text: 'Ride it to Manila by the valley road (' + M.horseHearts + ' hearts and Horseshoes), or send Mang Kardo: he is back in ' + G.driver.mins + ' minutes and keeps ' + Math.round(G.driver.fee * 100) + '%.',
        draw: function (ui, sc, move) {
          var k = person(ui, sc, 'kardo', 70, 124, 100);
          if (k) tw(ui, move, { targets: k, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          var c = cart(ui, sc, 188, 112, 130, true, true);
          tw(ui, move, { targets: c, x: 204, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 188, 20, G.driver.mins + ' min', 13);
        },
      },
    ],
  };

  // ---------- the Grand Market: the price board and the contracts (Sell and Deliver with your cart there) ----------
  U.gmOpenMarket = function (tab, page) {
    var self = this, s = mine(), w = F.world;
    if (!s || !w) return;
    if (tourFirst(this, 'board', function () { self.gmOpenMarket(tab, page); })) return;
    tab = tab || 'prices';
    var here = w.gmAtMarket(), rows = [], day = s.day;
    var again = function (msg, color) { if (F.world) { F.world.changed(); F.world.save(); F.world.gmCartLook(); } self.closeModal(); self.gmOpenMarket(tab, page); if (msg) self.toast(msg, 2800, color || DARK_GREEN); };
    if (tab === 'prices') {
      var board = L.gmBoard(day), inCart = here ? L.gmCargoCrops(s) : [];
      // the hot crops on top; with your cart here, its crops next (their Sell buttons), then the rest
      var top = board.filter(function (b) { return b.hot; }), mid = board.filter(function (b) { return !b.hot && inCart.indexOf(b.id) >= 0; }), rest = board.filter(function (b) { return !b.hot && inCart.indexOf(b.id) < 0; });
      var soon = L.mnHotTomorrow ? L.mnHotTomorrow(s) : null; // (Aling Rosa's tip, at 10 hearts: Manila Friends)
      if (soon && soon.length) rows.push({ icon: C.ICON.heart, name: "Tomorrow's hot crops", desc: "Aling Rosa's tip: " + soon.map(name).join(', ') + '.', buttons: [] });
      top.concat(mid, rest).forEach(function (b) {
        var n = here ? L.gmCropLoad(s, b.id) : 0;
        rows.push({ icon: iconOf(b.id), name: name(b.id) + '  x' + b.mult.toFixed(2) + (b.hot ? '  HOT' : ''),
          desc: b.sell + 'G -> ' + b.price + 'G each.' + (n ? ' In your cart: ' + n + '.' : ''),
          buttons: n ? [{ label: 'Sell', color: n >= G.minLoad ? GREEN : GREY, cb: function () {
            var r = L.gmSell(s, b.id, day);
            if (r.why === 'min') { sfx('nope'); return self.toast('Aling Rosa buys ' + G.minLoad + ' or more at a time. You have ' + r.n + ' ' + name(b.id) + '.', 2800); }
            if (!r.ok) { sfx('nope'); return; }
            sfx('coin');
            again('Sold ' + r.n + ' ' + name(b.id) + ' for ' + fmt(r.gold) + 'G!');
          } }] : [] });
      });
    } else {
      L.gmContracts(s).forEach(function (c) {
        var n = here && !c.done ? L.gmCropLoad(s, c.crop) : 0;
        rows.push({ icon: iconOf(c.crop), name: c.need + ' ' + name(c.crop) + (c.done ? '  DONE' : c.rosa ? '  (a friend\'s)' : ''), progress: c.done ? null : [c.got, c.need],
          desc: c.done ? 'Finished! +1 Market Star.' : 'Pays ' + c.each + 'G each. Ends in ' + hours(c.mins) + '.' + (n ? ' Cart: ' + n + '.' : ''),
          buttons: n ? [{ label: 'Deliver', color: L.gmCanDeliver(s, c) ? GREEN : GREY, cb: function () {
            var r = L.gmDeliver(s, c.k);
            if (r.why === 'min') { sfx('nope'); return self.toast('Bring at least ' + r.need + ' ' + name(c.crop) + ' at a time.', 2800); }
            if (!r.ok) { sfx('nope'); return; }
            sfx('coin');
            again(r.done ? 'Contract done! ' + fmt(r.gold) + 'G and a Market Star!' : 'Delivered ' + r.n + ' ' + name(c.crop) + ': ' + fmt(r.gold) + 'G.');
          } }] : [] });
      });
    }
    this.listPanel({ title: "Aling Rosa's Grand Market", rows: rows, tab: tab, page: page || 0,
      tabs: [['prices', 'Prices'], ['contracts', 'Contracts']].concat(this.coTab ? [this.coTab] : []), reopen: function (t, p) { self.gmOpenMarket(t, p); },
      sub: function () {
        var stars = L.gmStars(s) ? '   ·   Market Stars: ' + L.gmStars(s) : '';
        return (here ? 'Your ' + vehWord(s) + ' is here: ' + L.gmLoad(s) + ' crops.' : 'New prices every day. She buys ' + G.minLoad + '+ of a crop, from a Horse Cart.') + stars;
      } });
  };

  // ---------- the cart: load, unload, hitch, send ----------
  var WHY = { cart: 'You have no cart.', full: 'The cart is full: ' + G.cart.cap + ' crops.' };
  // Mang Kardo's fee for this farm (a friend's price: 01-logicZ...Z-manila-friends.js)
  var feeRate = function (s) { return L.gmFeeRate ? L.gmFeeRate(s) : G.driver.fee; };
  var awayText = function (s) { return 'Mang Kardo has the ' + vehWord(s) + ' on the road: back in ' + L.gmLeft(s, L.nowMin()) + ' min.'; };
  U.gmOpenCart = function (tab, page) {
    var self = this, s = mine(), w = F.world, S = F.session;
    if (!s || !w || !L.gmHasCart(s)) return;
    if (w.gmAtMarket()) return this.gmOpenMarket(); // (at the Grand Market: Sell and Deliver)
    if (tourFirst(this, 'cart', function () { self.gmOpenCart(tab, page); })) return;
    var farm = w.mapKey === 'farm', away = L.gmAway(s), rows = [];
    tab = farm ? tab || 'cargo' : 'cargo';
    var again = function (msg) { sfx('pick'); w.changed(); w.save(); w.gmCartLook(); self.closeModal(); self.gmOpenCart(tab, page); if (msg) self.toast(msg, 2200, DARK_GREEN); };
    var why = function () { var y = L.gmWhyNot(s); sfx('nope'); self.toast(y === 'away' ? awayText(s) : y === 'full' && vehWord(s) !== 'cart' ? 'The ' + vehWord(s) + ' is full: ' + fmt(L.gmCap(s)) + ' crops.' : WHY[y] || 'Not now.', 2400); };
    if (tab === 'cargo') {
      if (farm) {
        rows.push({ icon: C.ICON.horse, name: 'Send to the Grand Market', desc: away ? awayText(s) : 'He sells it in Manila. Gold in ' + G.driver.mins + ' min, less ' + Math.round(feeRate(s) * 100) + '%.',
          buttons: away ? [] : [{ label: 'Send', color: BLUE, cb: function () { self.closeModal(); self.gmOpenSend(); } }] });
        if (!(self.trkRows && self.trkRows(s, rows, away, again))) rows.push({ icon: C.ICON.horseshoes != null ? C.ICON.horseshoes : C.ICON.horse, name: S.gmHitch ? 'Hitched to ' + horseName(s) : 'Drive it yourself',
          desc: S.gmHitch ? 'It follows ' + horseName(s) + '. Ride east out of town.' : 'Ride it to Manila: ' + M.horseHearts + ' hearts and Horseshoes.',
          buttons: away ? [] : [{ label: S.gmHitch ? 'Unhitch' : 'Hitch', color: S.gmHitch ? GREY : GREEN, cb: function () {
            if (!S.gmHitch && !w.horse) { sfx('nope'); return self.toast(horseName(s) + ' is not here.'); }
            S.gmHitch = !S.gmHitch;
            w.gmCartSetup();
            again(S.gmHitch ? 'The cart is hitched to ' + horseName(s) + '.' : 'The cart is parked by the Stable.');
          } }] });
      } else rows.push({ icon: C.ICON.coin, name: 'To the Grand Market', desc: "Aling Rosa's market in Manila buys " + G.minLoad + ' or more of a crop from the cart.', buttons: [] });
      L.gmCargoCrops(s).forEach(function (id) {
        [0, 1, 2].forEach(function (q) {
          var key = L.gmKey(id, q), n = s.gm.cargo[key];
          if (!n) return;
          var price = L.gmPrice(s.day, id, q);
          rows.push({ icon: iconOf(id), name: keyName(key) + '  x' + n, desc: price ? 'At the Grand Market today: ' + price + 'G each.' : 'The Grand Market does not buy it.',
            buttons: farm && !away ? [{ label: 'Unload', color: GREY, cb: function () {
              var k = L.gmUnload(s, key);
              if (!k) { sfx('nope'); return self.toast('No room in the Silo or your bag.'); }
              again(k + ' ' + keyName(key) + ' unloaded' + (k < n ? ' (the rest has no room)' : '') + '.');
            } }] : [] });
        });
      });
    } else if (tab === 'silo') {
      var c = L.silo(s).c;
      Object.keys(c).filter(function (id) { return c[id] > 0; }).sort(function (a, b) { return name(a) < name(b) ? -1 : 1; }).forEach(function (id) {
        rows.push({ icon: iconOf(id), name: name(id) + '  x' + c[id], desc: 'In the Silo.', buttons: [10, 0].map(function (n) {
          return { label: n ? 'Load ' + n : 'Load all', color: GREEN, cb: function () {
            var k = L.gmLoadSilo(s, id, n || c[id]);
            if (!k) return why();
            again(k + ' ' + name(id) + ' loaded.');
          } };
        }) });
      });
    } else {
      s.inv.forEach(function (it, i) {
        if (!it || !L.isFarmCrop(it.id)) return;
        var key = L.gmKey(it.id, it.q || 0);
        rows.push({ icon: iconOf(it.id), name: keyName(key) + '  x' + it.n, desc: 'In your bag.', buttons: [10, 0].map(function (n) {
          return { label: n ? 'Load ' + n : 'Load all', color: GREEN, cb: function () {
            var k = L.gmLoadBag(s, i, n || it.n);
            if (!k) return why();
            again(k + ' ' + keyName(key) + ' loaded.');
          } };
        }) });
      });
    }
    this.listPanel({ title: L.gmVehName(s), rows: rows, tab: tab, page: page || 0,
      tabs: farm ? [['cargo', 'Cargo'], ['silo', 'From Silo'], ['bag', 'From bag']] : null,
      reopen: function (t, p) { self.gmOpenCart(t, p); },
      empty: tab === 'silo' ? 'No crops in the Silo.' : tab === 'bag' ? 'No farm crops in your bag.' : '',
      sub: function () { return 'Cargo ' + L.gmLoad(s) + ' / ' + L.gmCap(s) + ' crops' + (away ? '   ·   ' + awayText(s) : ''); } });
  };
  // Mang Kardo: sell at today's board, or fill a contract
  U.gmOpenSend = function () {
    var self = this, s = mine(), w = F.world;
    if (!s || !w) return;
    var WHY_SEND = { empty: 'The ' + vehWord(s) + ' is empty.', min: 'Load ' + G.minLoad + ' or more of a crop first.', none: 'Load its crop first.', done: 'Already finished.', away: 'He is on the road.', busy: 'A City Order delivery is waiting for its answer.' };
    var go = function (how) {
      var r = L.gmSend(s, how, L.nowMin());
      if (!r.ok) { sfx('nope'); return self.toast(WHY_SEND[r.why] || 'Not now.', 2400); }
      F.session.gmHitch = false;
      sfx('neigh');
      w.changed();
      w.save();
      w.gmCartSetup(); // (it is on the road)
      self.closeModal();
      self.toast('Mang Kardo drives off to Manila with ' + r.n + ' crops. Back in ' + G.driver.mins + ' minutes!', 3200, DARK_GREEN);
    };
    var line = function (q) { return q.why ? WHY_SEND[q.why] || 'Not now.' : q.n + ' crops: ' + fmt(q.gold) + 'G, you get ' + fmt(q.net) + 'G after his ' + Math.round((q.rate != null ? q.rate : G.driver.fee) * 100) + '%.'; };
    var q0 = L.gmSendQuote(s, 'sell');
    var rows = [{ icon: C.ICON.coin, name: "Sell at today's prices", desc: line(q0), buttons: q0.why ? [] : [{ label: 'Send', color: BLUE, cb: function () { go('sell'); } }] }];
    L.gmContracts(s).filter(function (c) { return !c.done; }).forEach(function (c) {
      var q = L.gmSendQuote(s, c.k);
      var why = q.why === 'none' ? 'Load ' + name(c.crop) + ' first.' : q.why === 'min' ? 'Load ' + Math.min(G.minLoad, c.left) + ' or more ' + name(c.crop) + ' first.' : line(q);
      rows.push({ icon: iconOf(c.crop), name: 'Contract: ' + c.need + ' ' + name(c.crop), progress: [c.got, c.need], desc: why,
        buttons: q.why ? [] : [{ label: 'Send', color: BLUE, cb: function () { go(c.k); } }] });
    });
    if (this.coSendRow) { var cr = this.coSendRow(s); if (cr) rows.push(cr); }
    this.listPanel({ title: 'Send Mang Kardo', rows: rows, reopen: function () { self.gmOpenSend(); },
      sub: function () { return 'He takes the load, sells it at the Grand Market, and brings the gold in ' + G.driver.mins + ' minutes.'; } });
  };
})(window.Farm = window.Farm || {});
