// The trucks and the barangay City Orders in the world (steps 2 and 3 of the truck plan, owner 18 Nov 2026; rules
// 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-trucks.js, numbers C.TRUCKS, the server supabase/farm_city_orders.sql).
// - Bram's Forge: three rows after the Horse Cart's (Pickup, Farm Truck, Big Truck: Market Stars to have, never spent).
// - The farm's vehicle stands by the Stable (the one in use; a truck drawn by the game until its picture comes). Its panel:
//   the same loading tabs, "Drive it yourself" (no horse: a short drive by the valley road, the Plains when they are open,
//   to the Grand Market's loading bay), Mang Kardo, and Your vehicles (switch; the load moves with you, never lost).
// - In Manila the truck waits at the loading bay; at the market it sells and delivers like the cart. Leave the city another
//   way and it drives itself home (its load is the save's). Drawn only while on the screen.
// - The Grand Market's City Order tab: your barangay's order this week (the server's, shared), Deliver from the vehicle or
//   with Mang Kardo; until the SQL is applied it says "City Orders open soon" and takes nothing. The prizes once a week.
// - The tours "Trucks" and "City Orders" (the owner's pictures of the market, Aling Rosa and Mang Kardo); the plaque drawn.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TR = C.TRUCKS;
  var G = C.GRAND_MARKET;
  var M = C.MANILA;
  if (!TR || !TR.on || !G || !G.on || !M) return;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, INK = K.INK, W = K.W;
  var V = TR.list, CO = TR.city;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, DARK_GREEN = 0x2f5a22;
  var CITY = { manila: 1, mall: 1 };
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var visiting = function (w) { var v = F.session.visit; return !!((w.state && w.state.isVisit) || (v && !v.inTown) || F.session.raid); };
  var mine = function () { var s = F.session && F.session.state; return s && !s.isVisit && !F.session.visit ? s : null; };
  var name = function (id) { return C.ITEMS[id] ? C.ITEMS[id].name : id; };
  var iconOf = function (id) { return C.ITEMS[id] ? C.ITEMS[id].icon : C.ICON.crate; };
  var save = function () { var w = F.world; if (w) { w.changed(); w.save(); } };
  var hours = function (mins) { return mins >= 120 ? Math.floor(mins / 60) + ' hours' : mins + ' min'; };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var uuid = function () {
    var h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'[Math.floor(Math.random() * 4)] + h.slice(17, 20) + '-' + h.slice(20, 32);
  };

  // ---------- the trucks' pictures: drawn once each on a canvas (stand-ins until the owner's come) ----------
  // 'side' (the cab on the left; its feet the bottom), 'front' (the nose towards you), 'back' (the tailgate), loaded or empty.
  var PX = 64;
  var rr = function (g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  var box = function (g, x, y, w, h, r, fill, line) { rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); if (line) { g.strokeStyle = line; g.lineWidth = 3; g.stroke(); } };
  var wheel = function (g, x, y, r) { g.fillStyle = '#26221f'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#b9bcc2'; g.beginPath(); g.arc(x, y, r * 0.45, 0, 7); g.fill(); };
  var heap = function (g, cx, top, span) { // (the load: sacks and crops over the bed, as the cart's)
    [['#e8d8a8', -0.3, 0.02, 0.16], ['#e8d8a8', 0.02, -0.03, 0.17], ['#d9c590', 0.3, 0.02, 0.15], ['#f0a030', -0.14, -0.12, 0.1],
      ['#7cbc4a', 0.16, -0.14, 0.1], ['#f2d34a', -0.38, -0.07, 0.08], ['#c8402a', 0.4, -0.07, 0.08]].forEach(function (p) {
      g.fillStyle = p[0]; g.beginPath(); g.ellipse(cx + p[1] * span, top + p[2] * span, p[3] * span, p[3] * span * 0.62, 0, 0, 7); g.fill();
    });
  };
  var shadow = function (g, w, h) { g.fillStyle = 'rgba(30,20,10,0.28)'; g.beginPath(); g.ellipse(w * 0.5, h - 4, w * 0.47, h * 0.06, 0, 0, 7); g.fill(); };
  // how tall the bed's sides are, from the top: the pickup's low, the farm truck's stakes, the big truck's high box
  var BED_TOP = [0.5, 0.3, 0.16];
  var DRAW = {
    side: function (g, w, h, R, loaded) {
      var r = h * 0.15, wy = h - r - 4, yb = wy - r * 0.35, yt = h * BED_TOP[R.kind], bx = w * 0.37, ink = 'rgba(30,20,10,0.55)';
      shadow(g, w, h);
      if (loaded) heap(g, (bx + w * 0.97) / 2, yt + h * 0.04, (w * 0.97 - bx) * 0.9);
      box(g, bx, yt, w * 0.6, yb - yt, 5, R.bed, ink); // the bed
      if (R.kind === 1) { g.strokeStyle = '#6b4424'; g.lineWidth = 4; for (var k = 0; k < 5; k++) { var sx = bx + 6 + k * (w * 0.6 - 12) / 4; g.beginPath(); g.moveTo(sx, yt); g.lineTo(sx, yb); g.stroke(); } }
      if (R.kind === 2) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx + 4, yt + 4, w * 0.6 - 8, (yb - yt) * 0.18); }
      g.fillStyle = '#3b3632'; g.fillRect(w * 0.04, yb - 4, w * 0.93, 8); // the chassis
      var c0 = w * 0.04, c1 = bx + 2, top = h * (R.kind === 2 ? 0.16 : 0.24);
      g.beginPath(); g.moveTo(c0, yb); g.lineTo(c0, h * 0.55); g.lineTo(c0 + (c1 - c0) * 0.3, h * 0.5); g.lineTo(c0 + (c1 - c0) * 0.45, top); g.lineTo(c1, top); g.lineTo(c1, yb); g.closePath();
      g.fillStyle = R.cab; g.fill(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.moveTo(c0 + (c1 - c0) * 0.5, top + 6); g.lineTo(c1 - 6, top + 6); g.lineTo(c1 - 6, h * 0.48); g.lineTo(c0 + (c1 - c0) * 0.36, h * 0.48); g.closePath();
      g.fillStyle = '#bfe3f2'; g.fill(); // the window
      g.fillStyle = R.trim; g.fillRect(c0, h * 0.58, w * 0.93, 5); // a stripe along it
      g.fillStyle = '#ffe48a'; g.fillRect(c0 - 2, h * 0.58, 7, 8); // a headlight
      wheel(g, w * 0.2, wy, r);
      if (R.kind === 2) { wheel(g, w * 0.66, wy, r); wheel(g, w * 0.84, wy, r); } else wheel(g, w * 0.78, wy, r);
    },
    front: function (g, w, h, R, loaded) {
      var top = h * (R.kind === 2 ? 0.3 : 0.36), ink = 'rgba(30,20,10,0.55)';
      shadow(g, w, h);
      if (R.kind) box(g, w * 0.1, h * BED_TOP[R.kind] * 0.6, w * 0.8, h * 0.4, 5, R.bed, ink); // (the bed, over the cab)
      if (loaded) heap(g, w * 0.5, R.kind ? h * BED_TOP[R.kind] * 0.55 : top - 4, w * 0.62);
      [0.08, 0.92].forEach(function (x) { g.fillStyle = '#26221f'; g.fillRect(w * x - w * 0.07, h * 0.7, w * 0.14, h * 0.26); });
      box(g, w * 0.08, top, w * 0.84, h * 0.6, 8, R.cab, ink);
      box(g, w * 0.16, top + h * 0.05, w * 0.68, h * 0.2, 4, '#bfe3f2'); // the windscreen
      box(g, w * 0.3, top + h * 0.33, w * 0.4, h * 0.13, 3, '#3b3632'); // the grille
      [0.18, 0.82].forEach(function (x) { g.fillStyle = '#ffe48a'; g.beginPath(); g.arc(w * x, top + h * 0.39, w * 0.06, 0, 7); g.fill(); });
      box(g, w * 0.04, h * 0.84, w * 0.92, h * 0.07, 3, '#b9bcc2'); // the bumper
      g.fillStyle = R.trim; g.fillRect(w * 0.1, top + h * 0.28, w * 0.8, 4);
    },
    back: function (g, w, h, R, loaded) {
      var yt = h * BED_TOP[R.kind] * 0.7, ink = 'rgba(30,20,10,0.55)';
      shadow(g, w, h);
      if (!R.kind) box(g, w * 0.16, h * 0.2, w * 0.68, h * 0.3, 6, R.cab, ink); // (the pickup's cab over its low sides)
      [0.08, 0.92].forEach(function (x) { g.fillStyle = '#26221f'; g.fillRect(w * x - w * 0.07, h * 0.72, w * 0.14, h * 0.24); });
      box(g, w * 0.06, yt + h * 0.18, w * 0.88, h * 0.82 - yt - h * 0.18, 5, R.bed, ink); // the tailgate
      if (loaded) heap(g, w * 0.5, yt + h * 0.16, w * 0.66);
      g.strokeStyle = 'rgba(30,20,10,0.3)'; g.lineWidth = 2;
      for (var k = 1; k < 3; k++) { var y = yt + h * 0.18 + k * (h * 0.64 - yt - h * 0.18) / 3; g.beginPath(); g.moveTo(w * 0.08, y); g.lineTo(w * 0.92, y); g.stroke(); }
      [0.12, 0.88].forEach(function (x) { g.fillStyle = '#e0412e'; g.fillRect(w * x - w * 0.05, h * 0.66, w * 0.1, h * 0.08); });
      box(g, w * 0.38, h * 0.67, w * 0.24, h * 0.08, 2, '#f4efe6'); // the plate
    },
  };
  // the owner's pictures (18 Nov 2026, the 'vehicles' pack: tools/art/vehicles-import.js) when they are on the phone: the
  // view's width as the stand-in's, its height the picture's own shape
  var ART = [null, 'pickup', 'farmtruck', 'bigtruck'];
  var artOf = function (i, view, loaded) { var k = ART[i] && 'veh_' + ART[i] + '_' + view + '_' + (loaded ? 'full' : 'empty'); return k && F.images && F.images[k] ? k : null; };
  var size = function (i, view) {
    var R = V[i], wd = view === 'side' ? R.w : R.fw, a = F.images && F.images[artOf(i, DRAW[view] ? view : 'side', false)];
    return [wd, a ? wd * (a.naturalHeight || a.height) / (a.naturalWidth || a.width) : view === 'side' ? R.h : R.fh];
  };
  F.trkSize = size;
  F.trkArt = function (i) { return ART[i] || null; };
  F.trkTex = function (scene, i, view, loaded) {
    view = DRAW[view] ? view : 'side';
    var own = artOf(i, view, loaded);
    if (own) return F.ensureTexture(scene, own);
    var key = 'trk-' + i + '-' + view + '-' + (loaded ? 1 : 0);
    if (scene.textures.exists(key)) return key;
    var sz = size(i, view), w = Math.round(sz[0] * PX), h = Math.round(sz[1] * PX), tex = scene.textures.createCanvas(key, w, h);
    DRAW[view](tex.getContext(), w, h, V[i], loaded);
    tex.refresh();
    return key;
  };

  // ---------- the truck in the world ----------
  // on the farm: beside the Stable (its right side, or its left at the farm's edge); in Manila: at the loading bay
  P.trkParkSpot = function (i) {
    var st = this.objects.filter(function (o) { return o.type === 'stable'; })[0], Wd = this.map ? this.map.width : C.FARM_W, w = V[i].w;
    if (st) { var x0 = st.x1 + 1 + w <= Wd - 1 ? st.x1 + 1 : st.x0 - w; return { x: (x0 + w / 2) * T, y: (st.y1 + 1) * T - 8 }; }
    var hp = this.points && this.points.horse;
    return hp ? { x: hp.x + 2 * T, y: hp.y } : null;
  };
  var cartSetup = P.gmCartSetup;
  P.gmCartSetup = function () {
    var s = this.state, u = !visiting(this) && L.trkUse(s), S = F.session, c = this.gmCart;
    if (!u) return cartSetup.apply(this, arguments);
    if (c) { c.img.destroy(); this.objects = this.objects.filter(function (o) { return o !== c.obj; }); }
    this.gmCart = null;
    S.gmHitch = false; // (a truck is never hitched to the horse)
    if (L.gmAway(s)) return;
    var at = null, view = 'side';
    if (this.mapKey === 'farm' && S.trkAt !== 'manila') at = this.trkParkSpot(u);
    else if (this.mapKey === 'manila' && S.trkAt === 'manila') { at = { x: TR.bay[0] * T, y: TR.bay[1] * T }; view = 'front'; }
    if (!at) return;
    var sz = size(u, view), loaded = L.gmLoad(s) > 0, hw = sz[0] * T / 2;
    var img = this.add.image(at.x, at.y, F.trkTex(this, u, view, loaded)).setOrigin(0.5, 1).setDisplaySize(sz[0] * T, sz[1] * T);
    F.depthTo(img, DEPTH.actor + at.y / 1e5 - 0.00005);
    c = this.gmCart = { truck: u, img: img, x: at.x, y: at.y, view: view, loaded: loaded, sz: sz,
      obj: { type: 'gm_cart', name: 'gm_cart', x0: Math.floor((at.x - hw + 0.3 * T) / T), x1: Math.floor((at.x + hw - 0.3 * T) / T), y0: Math.floor((at.y - 1) / T), y1: Math.floor((at.y - 1) / T), props: {} } };
    this.objects.push(c.obj);
  };
  var cartLook = P.gmCartLook;
  P.gmCartLook = function () {
    var c = this.gmCart;
    if (!c || !c.truck) return cartLook.apply(this, arguments);
    var loaded = L.gmLoad(this.state) > 0;
    if (loaded !== c.loaded) { c.loaded = loaded; c.img.setTexture(F.trkTex(this, c.truck, c.view, loaded)).setDisplaySize(c.sz[0] * T, c.sz[1] * T); }
  };
  var atMarket = P.gmAtMarket;
  P.gmAtMarket = function () {
    var c = this.gmCart, d = M.spots && M.spots.door_market;
    if (!c || !c.truck) return atMarket.apply(this, arguments);
    if (this.mapKey !== 'manila' || F.session.trkAt !== 'manila' || visiting(this) || !d) return false;
    var f = this.feet();
    return Math.hypot(f.x - d[0] * T, f.y - d[1] * T) <= G.near * T;
  };
  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    var S = F.session, s = this.state, mineHere = !visiting(this);
    // left the city another way (the train, on foot): the truck drives itself home, its load safe
    if (mineHere && S.trkAt === 'manila' && !CITY[this.mapKey]) {
      S.trkAt = null;
      if (this.mapKey !== 'farm' && L.trkUse(s)) this.time.delayedCall(600, function () { if (F.ui) F.ui.toast('Your ' + L.gmVehName(s) + ' drove itself home to the farm. Its load is safe.', 2800); });
    }
    setupExtras.apply(this, arguments);
    var c = this.gmCart;
    if (S.trkArrive && mineHere) {
      S.trkArrive = false;
      if (c && c.truck) { this.setFeet(c.x, c.y + (this.mapKey === 'manila' ? 1.2 : 0.9) * T); this.dir = 'up'; this.idle(); }
    }
  };
  // (drawn only while on the screen: looked at with the camera, every frame, a few sums. Not in updateExtras: that one
  // stops while a panel is open, and the camera still moves then)
  var updateCamera = P.updateCamera;
  P.updateCamera = function () {
    var r = updateCamera.apply(this, arguments), c = this.gmCart;
    if (c && c.truck) {
      var v = this.cameras.main.worldView, m = 2 * T, on = c.x + c.sz[0] * T > v.x - m && c.x - c.sz[0] * T < v.right + m && c.y > v.y - m && c.y - c.sz[1] * T < v.bottom + m;
      if (on !== c.img.visible) c.img.setVisible(on);
    }
    return r;
  };
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o) {
    if (o && o.type === 'gm_cart' && this.gmCart && this.gmCart.truck) return { label: 'Truck', icon: C.ICON.crate, run: function () { F.ui.gmOpenCart(); } };
    return extraObjectAction.apply(this, arguments);
  };

  // ---------- driving it yourself ----------
  // The valley road, a moment on the screen: the truck rolls past the farm, the town, the Plains (when the road crosses
  // them) to Manila, and you are at the loading bay; or back home by the Stable.
  U.trkDrive = function (to) {
    var self = this, s = mine(), w = F.world, S = F.session, u = s && L.trkUse(s);
    if (!s || !w || w.busy || !u) return;
    var ok = to === 'manila' ? L.trkDriveOk(s) : { ok: true };
    if (!ok.ok) { sfx('nope'); return this.toast(ok.text || 'Not now.', 2600); }
    var rode = S.riding;
    if (rode) w.dismount();
    if (rode || S.horseFollow) { if (to === 'manila') { S.horseFollow = false; S.horseAt = null; } else w.horseWait(); } // (the horse stays)
    var legs = ['Farm', 'Town'].concat(L.valleyVia && L.valleyVia(s, false) ? ['Plains'] : [], ['Manila']);
    if (to !== 'manila') legs.reverse();
    var c = this.openModal(function () { go(); }), ended = false, y0 = 206; // (centred: 228 high in the 640 layout)
    var go = function () {
      if (ended) return;
      ended = true;
      self.closeModal();
      S.trkAt = to === 'manila' ? 'manila' : null;
      S.trkArrive = true;
      w.travel(to === 'manila' ? 'manila' : 'farm', to === 'manila' ? 'from_valley' : 'from_town');
    };
    this.panelImg(c, 24, y0, W - 48, 228);
    c.add(this.txt(W / 2, y0 + 16, to === 'manila' ? 'TO THE GRAND MARKET' : 'HOME TO THE FARM', 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.canvasImg(c, 40, y0 + 48, 'trk-road-' + legs.length, W - 80, 110, function (g) {
      g.fillStyle = '#bcdc98'; g.fillRect(0, 0, W - 80, 110);
      g.fillStyle = '#7a7670'; g.fillRect(0, 70, W - 80, 30);
      g.strokeStyle = '#f4efe6'; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(0, 85); g.lineTo(W - 80, 85); g.stroke();
    });
    legs.forEach(function (n, k) { c.add(self.txt(40 + 14 + k * (W - 108) / (legs.length - 1), y0 + 60, n, 11, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0)); });
    var sz = size(u, 'side'), tw = 30 * sz[0], img = this.add.image(40 + tw / 2, y0 + 48 + 98, F.trkTex(this, u, 'side', L.gmLoad(s) > 0)).setOrigin(0.5, 1).setDisplaySize(tw, 30 * sz[1]).setFlipX(true);
    c.add(img);
    c.add(this.txt(W / 2, y0 + 172, 'By the valley road' + (legs.indexOf('Plains') >= 0 ? ', across the Plains.' : '.') + ' No horse needed.', 12, INK, { align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5, 0));
    if (to !== 'manila') img.setFlipX(false).setX(W - 40 - tw / 2);
    sfx('pick');
    this.tweens.add({ targets: img, x: to === 'manila' ? W - 40 - tw / 2 : 40 + tw / 2, duration: 1600, ease: 'Sine.inOut', onComplete: function () { self.time.delayedCall(250, go); } });
  };

  // ---------- the vehicle's panel ----------
  var tourFirst = function (ui, key, then) { return F.gmTourFirst ? F.gmTourFirst(ui, key, then) : false; };
  var trucksNear = function (s) { return L.trkCount(s) - (L.trkOwns(s, 0) ? 1 : 0) > 0 || L.gmStars(s) >= V[1].stars; };
  var openCart = U.gmOpenCart;
  U.gmOpenCart = function (tab, page) {
    var self = this, s = mine(), w = F.world;
    if (!s || !w || !L.gmHasCart(s)) return;
    if (trucksNear(s) && tourFirst(this, 'trucks', function () { self.gmOpenCart(tab, page); })) return;
    if (L.trkUse(s) && w.mapKey === 'manila' && F.session.trkAt === 'manila') return this.trkCity();
    return openCart.apply(this, arguments);
  };
  // (the farm's cargo tab: the truck's own rows; true: no Hitch row)
  U.trkRows = function (s, rows, away) {
    var self = this, u = L.trkUse(s), wq = L.coWaiting(s);
    if (u) {
      rows.push({ icon: C.ICON.crate, img: { key: F.trkTex(this, u, 'side', L.gmLoad(s) > 0) }, name: 'Drive it yourself',
        desc: away ? 'Mang Kardo has it on the road.' : 'To the Grand Market\'s loading bay in Manila, by the valley road. No horse needed.',
        buttons: away ? [] : [{ label: 'Drive', color: GREEN, cb: function () { self.closeModal(); self.trkDrive('manila'); } }] });
    }
    if (L.trkCount(s) > 1) rows.push({ icon: C.ICON.crate, name: 'Your vehicles', desc: 'Switch to another. The load moves with you.', buttons: [{ label: 'Switch', color: BLUE, cb: function () { self.closeModal(); self.trkGarage(); } }] });
    if (wq) rows.push({ icon: C.ICON.carabao, name: 'On its way: ' + wq + ' crops', desc: 'A City Order delivery waits for its answer. It is never lost.', buttons: [] });
    return !!u;
  };
  // the vehicles: use one, or unload what was left parked in one
  U.trkGarage = function () {
    var self = this, s = mine(), w = F.world;
    if (!s || !w) return;
    var u = L.trkUse(s), rows = [], again = function (msg) { save(); w.gmCartSetup(); self.closeModal(); self.trkGarage(); if (msg) self.toast(msg, 2800, DARK_GREEN); };
    for (var i = 0; i < V.length; i++) {
      if (!L.trkOwns(s, i)) continue;
      (function (i) {
        var held = L.trkLoadOf(s, i), b = [];
        if (i !== u) b.push({ label: 'Use', color: GREEN, cb: function () {
          var r = L.trkSwitch(s, i);
          if (!r.ok) { sfx('nope'); return self.toast(r.why === 'away' ? 'Mang Kardo is on the road with it.' : r.why === 'busy' ? 'A City Order delivery waits for its answer.' : 'Not now.', 2600); }
          sfx('pick');
          again('You use the ' + L.trkNameOf(i) + ' now.' + (r.moved ? ' ' + r.moved + ' crops moved over.' : '') + (r.left ? ' ' + r.left + ' stayed in the ' + L.trkNameOf(u) + '.' : ''));
        } });
        if (i !== u && held) b.push({ label: 'Unload', color: GREY, cb: function () {
          var k = L.trkUnloadParked(s, i);
          if (!k) { sfx('nope'); return self.toast('No room in the Silo or your bag.'); }
          sfx('pick');
          again(k + ' crops unloaded from the ' + L.trkNameOf(i) + '.');
        } });
        rows.push({ icon: C.ICON.crate, img: i ? { key: F.trkTex(self, i, 'side', held > 0) } : null, name: L.trkNameOf(i) + (i === u ? '  (in use)' : ''),
          desc: 'Carries ' + fmt(L.trkCapOf(i)) + '. Holds ' + held + ' crops now.' + (i ? '' : ' Needs the horse.'), buttons: b });
      })(i);
    }
    this.listPanel({ title: 'Your vehicles', rows: rows, reopen: function () { self.trkGarage(); },
      sub: function () { return 'The load moves with you. What a smaller one cannot hold stays in the bigger one.'; } });
  };
  // the truck at the loading bay in Manila: the market, the drive home, its load
  U.trkCity = function () {
    var self = this, s = mine(), u = L.trkUse(s), rows = [];
    rows.push({ icon: C.ICON.coin, name: "Aling Rosa's Grand Market", desc: 'Sell, contracts and the City Order, from the truck.', buttons: [{ label: 'Open', color: BLUE, cb: function () { self.closeModal(); self.gmOpenMarket(); } }] });
    rows.push({ icon: C.ICON.crate, img: { key: F.trkTex(this, u, 'side', L.gmLoad(s) > 0) }, name: 'Drive home', desc: 'Back to the farm by the valley road, parked by the Stable.',
      buttons: [{ label: 'Drive', color: GREEN, cb: function () { self.closeModal(); self.trkDrive('farm'); } }] });
    L.gmCargoCrops(s).forEach(function (id) {
      var n = L.gmCropLoad(s, id);
      rows.push({ icon: iconOf(id), name: name(id) + '  x' + n, desc: 'At the Grand Market today: ' + L.gmPrice(s.day, id, 0) + 'G each.', buttons: [] });
    });
    this.listPanel({ title: L.gmVehName(s), rows: rows, reopen: function () { self.trkCity(); },
      sub: function () { return "At the Grand Market's loading bay: " + L.gmLoad(s) + ' / ' + fmt(L.gmCap(s)) + ' crops.'; } });
  };

  // ---------- Bram's Forge: the trucks' rows ----------
  U.trkForgeRows = function (s, at, per) {
    var self = this, stars = L.gmStars(s);
    return V.slice(1).map(function (R, j) {
      var i = j + 1, have = L.trkOwns(s, i), page = Math.floor((at + j) / per);
      return { icon: C.ICON.crate, img: { key: F.trkTex(self, i, 'side', false) }, name: have ? R.name + ' (made)' : R.name,
        desc: have ? 'It carries ' + fmt(R.cap) + ' crops. No horse needed.' : R.stars + ' Market Stars (kept) + ' + R.lumber + ' lumber. Carries ' + fmt(R.cap) + '.',
        reward: have ? null : { gold: R.gold, more: R.needs }, rewardPrefix: 'Cost', buttonsBelow: true,
        buttons: have ? [] : [{ label: 'Make', color: stars >= R.stars ? BLUE : GREY, cb: function () {
          var r = L.trkMake(s, i);
          if (r === 'stars') { sfx('nope'); return self.toast('Bram makes the ' + R.name + ' for farmers with ' + R.stars + ' Market Stars (they are not spent). You have ' + stars + ': finish Grand Market contracts.', 3400); }
          if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold: ' + fmt(R.gold) + 'G.'); }
          if (r === 'lumber') { sfx('nope'); return self.toast('You need ' + R.lumber + ' lumber.'); }
          if (r === 'needs') { sfx('nope'); return self.toast('You need ' + L.needsText(R.needs) + '.', 2800); }
          if (r !== 'ok') return;
          sfx('anvil');
          save();
          if (F.world && F.world.mapKey === 'farm') F.world.gmCartSetup();
          self.closeModal();
          self.openForge(page);
          self.toast('Vroom! Bram made you a ' + R.name + '. It is parked by your Stable.', 3200, DARK_GREEN);
        } }],
      };
    });
  };
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this, s = mine();
    if (s && trucksNear(s) && tourFirst(this, 'trucks', function () { self.openForge(page); })) return;
    return openForge.apply(this, arguments);
  };

  // ---------- the City Order ----------
  var O = F.Online || {};
  var CS = { at: 0, v: null }; // (the last answer, a short while)
  var online = function () { return !!(O.on && F.Net && F.Net.available()); };
  // { state: 'ok' (order) | 'off' (the SQL not there) | 'offline' | 'nohood' | 'closed' | 'error' }
  var coFetch = function () {
    var wk = L.coWeek(L.clock());
    if (!online()) return Promise.resolve({ state: 'offline' });
    if (O.coOff) return Promise.resolve({ state: 'off' });
    if (!wk.open) return Promise.resolve({ state: 'closed', week: wk });
    var hood = O.nb && O.nb.hood;
    var ask = function (h) { return F.Net.rpc('farm_city_order_v1', { p_kinds: h ? L.coOrder(wk.day, h, 0).kinds : null }); };
    return ask(hood && hood.id).then(function (r) {
      var o = L.coRead(r);
      return o && !o.ok && o.code === 'kinds' && o.hood ? ask(o.hood).then(L.coRead) : o;
    }).then(function (o) {
      var v = !o ? { state: 'error' } : o.ok ? { state: 'ok', order: o } : { state: o.code === 'hood' ? 'nohood' : o.code === 'closed' ? 'closed' : 'error', week: wk };
      CS = { at: Date.now(), v: v };
      return v;
    }, function (e) { if (missing(e)) O.coOff = true; return { state: O.coOff ? 'off' : 'error' }; });
  };
  F.coFetch = coFetch;
  // the prizes (each week once): +3 Market Stars, the plaque the first time
  O.coClaim = function () {
    var s = mine();
    if (!s || !online() || O.coOff) return Promise.resolve([]);
    return F.Net.rpc('farm_city_claim_v1', {}).then(function (list) {
      var paid = L.coPay(s, L.coClaimRead(list));
      if (!paid.length) return paid;
      save();
      if (F.bus) F.bus.emit('hud');
      sfx('found');
      var rows = [];
      paid.forEach(function (p) {
        rows.push([C.ICON.star, 'Your barangay filled its City Order! +' + p.stars + ' Market Stars.']);
        if (p.plaque) rows.push([C.ICON.ribbon, "Its first one: a City Order Plaque for your house (in Decorate's storage)."]);
      });
      var show = function () { var m = F.ui && F.ui.modals; if (!m || (m.length && !m[m.length - 1].coBoard)) return setTimeout(show, 1500); F.ui.dialog('CITY ORDER FILLED!', null, { rows: rows }); };
      show();
      return paid;
    }, function (e) { if (missing(e)) O.coOff = true; return []; });
  };
  var prizes = O.prizes;
  if (prizes) O.prizes = function () {
    return prizes.apply(O, arguments).then(function (won) {
      var s = mine(), c = s && s.gm && s.gm.co;
      return c && c.w > c.p ? O.coClaim().then(function () { return won; }, function () { return won; }) : won;
    });
  };
  // the waiting delivery: sent (again, with its id) and answered
  var sending = false;
  var coSend = function () {
    var s = mine(), q = s && s.gm.co && s.gm.co.q;
    if (!q || sending || !online()) return Promise.resolve(null);
    sending = true;
    var done = function (r) {
      sending = false;
      if (mine() !== s) return null;
      var a = L.coAnswer(s, r, L.nowMin());
      if (a && !a.wait) {
        CS.at = 0;
        save();
        var w = F.world;
        if (w) { if (a.how === 'k') w.gmCartSetup(); else w.gmCartLook(); }
      }
      return a;
    };
    return F.Net.rpc('farm_city_deliver_v1', { p_kind: q.kind, p_n: L.coWaiting(s), p_request_id: q.id })
      .then(done, function (e) { if (missing(e)) { O.coOff = true; return done('missing'); } return done(null); });
  };
  F.coSend = coSend;
  setInterval(function () {
    var s = mine();
    if (s && s.gm && s.gm.co && s.gm.co.q && !(F.Host && F.Host.sleeping)) coSend().then(function (a) { if (a && a.ok && a.done) O.coClaim(); });
  }, 15000);
  var WHY_CO = { missing: 'City Orders open soon. Your crops are still in your vehicle.', full: 'That crop is filled already. Your crops are still in your vehicle.',
    done: 'The order is filled already! Your crops are still in your vehicle.', closed: "This week's City Order has closed. Your crops are still in your vehicle.",
    hood: 'You are not in a barangay now. Your crops are still in your vehicle.' };
  U.coGo = function (kind, how, mode) {
    var self = this, s = mine(), o = CS.v && CS.v.order, w = F.world;
    if (!s || !o) return;
    var i = o.kinds.indexOf(kind), b = L.coBegin(s, kind, o.need - o.got[i], how, uuid(), o.day);
    if (!b.ok) { sfx('nope'); return this.toast(b.why === 'away' ? 'Mang Kardo is on the road.' : b.why === 'busy' ? 'A delivery waits for its answer.' : 'Load ' + name(kind) + ' first.', 2600); }
    save();
    coSend().then(function (a) {
      if (!a) a = { wait: true };
      self.closeAll();
      if (a.wait) { self.toast('No answer yet. Your ' + b.n + ' ' + name(kind) + ' wait safely and go again soon.', 3200); return; }
      if (!a.ok) { sfx('nope'); self.coMsg = [WHY_CO[a.why] || WHY_CO.full]; return self.coOpen(mode); }
      sfx(a.how === 'k' ? 'neigh' : 'coin');
      if (a.how === 'k') { if (a.done) O.coClaim(); return self.toast('Mang Kardo drives off with ' + a.took + ' ' + name(kind) + ' for the City Order. Back in ' + G.driver.mins + ' minutes!', 3400, DARK_GREEN); }
      self.coMsg = ['Delivered ' + a.took + ' ' + name(kind) + ' for the City Order: ' + fmt(a.gold) + 'G!' + (a.back ? ' ' + a.back + ' were not needed.' : ''), DARK_GREEN];
      self.coOpen(mode);
    });
  };
  // the City Order tab ('market': at the Grand Market; 'kardo': Mang Kardo takes it from the farm)
  U.coTab = ['city', 'City Order'];
  var openMarket = U.gmOpenMarket;
  U.gmOpenMarket = function (tab, page) { return tab === 'city' ? this.coOpen('market', page) : openMarket.apply(this, arguments); };
  U.coOpen = function (mode, page, v) {
    var self = this, s = mine(), w = F.world;
    if (!s || !w) return;
    if (tourFirst(this, 'city', function () { self.coOpen(mode, page); })) return;
    var fresh = CS.v && Date.now() - CS.at < 20000;
    v = v || (fresh ? CS.v : { state: 'loading' });
    var rows = [], o = v.order, here = mode === 'market' && w.gmAtMarket(), away = L.gmAway(s), row = function (ic, n, d, b) { rows.push({ icon: ic, name: n, desc: d, buttons: b || [] }); };
    if (v.state === 'loading') row(C.ICON.carabao, 'Asking your barangay...', 'A moment.');
    else if (v.state === 'off') row(C.ICON.star, 'City Orders open soon', 'Your barangay will fill a big order from the city together, every week. Coming soon!');
    else if (v.state === 'offline') row(C.ICON.carabao, 'Go online for City Orders', 'Each barangay fills one together every week. Go online (the Online button) to join in.');
    else if (v.state === 'nohood') {
      row(C.ICON.carabao, 'Join a barangay', 'Each barangay gets one City Order a week, filled by its members together. Find one in Online, Friends, or make your own.',
        online() && !O.nbOff && self.openFindHood ? [{ label: 'Find', color: BLUE, cb: function () { self.swapTo(function () { self.openFindHood(); }); } }] : []);
    } else if (v.state === 'closed') {
      var nx = L.coWeek(L.clock()).next;
      row(C.ICON.calendar, 'Next order: Monday 8 AM', 'City Orders run Monday 8 AM to Sunday 7 PM, Manila time. Opens in ' + hours(Math.max(1, Math.round((nx - L.clock()) / 60000))) + '.');
    } else if (v.state === 'error') row(C.ICON.carabao, 'No answer', 'Could not reach the online world. Try again in a moment.', [{ label: 'Again', color: BLUE, cb: function () { CS.at = 0; self.closeModal(); self.coOpen(mode, page); } }]);
    else {
      if (o.done) row(C.ICON.star, 'Order filled!', '+' + CO.stars + ' Market Stars for each farmer who delivered.');
      o.kinds.forEach(function (k, i) {
        var n = L.gmCropLoad(s, k), left = o.need - o.got[i], each = CO.pay * L.qualityPrice(k, 0), b = [];
        if (left > 0 && n && !o.done && (here || (mode === 'kardo' && !away))) {
          b.push({ label: mode === 'kardo' ? 'Send' : 'Deliver', color: mode === 'kardo' ? BLUE : GREEN, cb: function () { self.coGo(k, mode === 'kardo' ? 'k' : 's', mode); } });
        }
        rows.push({ icon: iconOf(k), name: name(k) + '  ' + o.got[i] + '/' + o.need, progress: [o.got[i], o.need], buttons: b,
          desc: (left > 0 ? 'Pays ' + each + 'G each (2x).' : 'Filled!') + (o.mine[i] ? ' You gave ' + o.mine[i] + '.' : '') + (n ? ' Yours: ' + n + '.' : '') });
      });
    }
    var market = mode === 'market';
    this.listPanel({ title: market ? "Aling Rosa's Grand Market" : 'City Order by Mang Kardo', rows: rows, page: page || 0,
      tab: market ? 'city' : null, tabs: market ? [['prices', 'Prices'], ['contracts', 'Contracts'], this.coTab] : null,
      reopen: function (t, p) { if (!market || t === 'city') self.coOpen(mode, p); else self.gmOpenMarket(t, p); },
      sub: function () {
        if (v.state !== 'ok') return 'One big order a week for your barangay: 2x the sell price, and +' + CO.stars + ' Market Stars when it is filled.';
        return (o.name || 'Your barangay') + ': ' + fmt(o.need * CO.kinds) + ' crops this week. Ends in ' + hours(Math.round(o.endsIn / 60)) + '.' + (mode === 'kardo' ? ' He keeps ' + Math.round((L.gmFeeRate ? L.gmFeeRate(s) : G.driver.fee) * 100) + '%.' : '');
      } });
    if (v.state !== 'loading') this.modals[this.modals.length - 1].coBoard = true; // (the prize may show over it)
    if (v.state !== 'loading' && this.coMsg) { this.toast(this.coMsg[0], 3200, this.coMsg[1]); this.coMsg = null; } // (after the panel: it would hide it)
    if (v.state === 'loading') {
      var top = this.modals[this.modals.length - 1];
      coFetch().then(function (nv) {
        if (self.modals[self.modals.length - 1] !== top) return; // (closed or moved on)
        self.swapping = { m: top, at: Date.now() };
        self.coOpen(mode, page, nv);
        if (nv.state === 'ok') O.coClaim();
      });
    }
  };
  // Mang Kardo's panel: a row for the City Order (once the server has it; offline or before the SQL: no row)
  U.coSendRow = function (s) {
    var self = this;
    if (!online() || O.coOff) return null;
    return { icon: C.ICON.carabao, name: 'Barangay City Order', desc: 'He delivers to your barangay\'s order: 2x the sell price, less his fee.',
      buttons: [{ label: 'Choose', color: BLUE, cb: function () { self.closeModal(); self.coOpen('kardo'); } }] };
  };

  // ---------- the City Order plaque: drawn, its own frame in every furniture style's sheet ----------
  var plaque = function (g) {
    g.fillStyle = '#5a3a1e'; rr(g, 14, 14, 100, 100, 16); g.fill();
    g.fillStyle = '#7d522c'; rr(g, 20, 20, 88, 88, 12); g.fill();
    g.fillStyle = '#d9a640'; g.beginPath(); g.arc(64, 60, 34, 0, 7); g.fill();
    g.fillStyle = '#f3d27a'; g.beginPath(); g.arc(64, 60, 28, 0, 7); g.fill();
    g.fillStyle = '#7a5a24';
    [[42, 44, 6, 18], [50, 38, 7, 24], [59, 46, 6, 16], [67, 34, 8, 28], [77, 42, 6, 20]].forEach(function (b) { g.fillRect(b[0], b[1], b[2], b[3]); }); // the skyline
    g.fillStyle = '#3567b8'; g.fillRect(44, 64, 30, 12); g.fillRect(74, 68, 10, 8); // a truck
    g.fillStyle = '#26221f'; [52, 78].forEach(function (x) { g.beginPath(); g.arc(x, 78, 4, 0, 7); g.fill(); });
    g.fillStyle = '#f3d27a'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('CITY ORDER', 64, 106);
  };
  var furnTexture = F.furnTexture;
  if (furnTexture) F.furnTexture = function (scene, v) {
    var key = furnTexture.apply(this, arguments), t = C.HOME.typeIndex.trophy_city_order, tex = scene.textures.exists(key) && scene.textures.get(key);
    if (tex && !tex.coPlaque && window.Phaser && Phaser.Textures.TextureSource) {
      var cv = document.createElement('canvas');
      tex.coPlaque = cv; // (its own picture: the tests look for it)
      cv.width = cv.height = 128;
      plaque(cv.getContext('2d'));
      tex.remove(t);
      tex.source.push(new Phaser.Textures.TextureSource(tex, cv, 128, 128));
      tex.add(t, tex.source.length - 1, 0, 0, 128, 128);
    }
    return key;
  };

  // ---------- the first-time tours ----------
  var KIT = F.gmKit, icon = KIT.icon, words = KIT.words, tw = KIT.tw, person = KIT.person;
  var fit = function (ui, sc, key, cx, bottom, w, h) { return KIT.fit(ui, sc, key, null, cx, bottom, w, h); };
  var truck = function (ui, sc, i, cx, bottom, k, view, loaded) {
    var sz = size(i, view || 'side'), img = ui.add.image(cx, bottom, F.trkTex(ui, i, view || 'side', loaded)).setOrigin(0.5, 1).setDisplaySize(sz[0] * k, sz[1] * k);
    sc.add(img);
    return img;
  };
  F.TOURS.gm_trucks = {
    title: 'THE TRUCKS',
    steps: [
      { text: "Bram's Forge makes three trucks: the Pickup carries " + V[1].cap + ' crops, the Farm Truck ' + V[2].cap + ' and the Big Truck ' + fmt(V[3].cap) + '.',
        draw: function (ui, sc, move) {
          [[1, 44, 22], [2, 124, 22], [3, 218, 22]].forEach(function (p, n) {
            var t = truck(ui, sc, p[0], p[1], 116, p[2], 'side', true);
            tw(ui, move, { targets: t, y: 112, duration: 380, yoyo: true, repeat: -1, delay: n * 160, ease: 'Sine.inOut' });
          });
        } },
      { text: 'Each needs Market Stars: ' + V[1].stars + ', ' + V[2].stars + ' and ' + V[3].stars + '. They are not spent: earn them with Grand Market contracts.',
        draw: function (ui, sc, move) {
          [V[1], V[2], V[3]].forEach(function (R, n) {
            var st = icon(ui, sc, 56 + n * 80, 54, C.ICON.star, 0.34);
            words(ui, sc, 56 + n * 80, 98, R.stars + ' Stars', 13, '#a8740c');
            tw(ui, move, { targets: st, angle: { from: -10, to: 10 }, duration: 500, yoyo: true, repeat: -1, delay: n * 150 });
          });
        } },
      { text: 'No horse needed: drive it yourself to the Grand Market\'s loading bay, or send Mang Kardo with it. The bigger one takes over; switch any time, the load moves with you.',
        draw: function (ui, sc, move) {
          fit(ui, sc, 'props/manila_grand_market', 70, 126, 130, 110);
          var k = person(ui, sc, 'kardo', 150, 124, 84);
          if (k) tw(ui, move, { targets: k, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          var t = truck(ui, sc, 2, 226, 122, 34, 'front', true);
          tw(ui, move, { targets: t, y: 116, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } },
    ],
  };
  F.TOURS.gm_city = {
    title: 'CITY ORDERS',
    steps: [
      { text: 'Every week your barangay gets one big City Order: ' + CO.kinds + ' crops, ' + CO.per5 + ' for every 5 farmers. Monday 8 AM to Sunday 7 PM.',
        draw: function (ui, sc, move) {
          var r = person(ui, sc, 'rosa', 56, 124, 96);
          if (r) tw(ui, move, { targets: r, y: 118, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          ['corn', 'tomato', 'pumpkin', 'potato'].forEach(function (id, n) {
            var i = icon(ui, sc, 140 + (n % 2) * 70, 40 + Math.floor(n / 2) * 50, C.ITEMS[id].icon, 0.26);
            tw(ui, move, { targets: i, scale: 0.3, duration: 450, yoyo: true, repeat: -1, delay: n * 120 });
          });
        } },
      { text: 'Everyone delivers from their truck or cart at the Grand Market, or with Mang Kardo. Each delivery pays you ' + CO.pay + 'x the sell price!',
        draw: function (ui, sc, move) {
          fit(ui, sc, 'props/manila_grand_market', 76, 126, 140, 116);
          var t = truck(ui, sc, 1, 200, 118, 40, 'side', true);
          tw(ui, move, { targets: t, x: 186, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          var c = icon(ui, sc, 236, 34, C.ICON.coin, 0.32);
          tw(ui, move, { targets: c, y: 26, duration: 400, yoyo: true, repeat: -1 });
        } },
      { text: 'Filled together: +' + CO.stars + ' Market Stars for each farmer who helped. Your barangay\'s first one gives each a City Order Plaque for the house!',
        draw: function (ui, sc, move) {
          var st = icon(ui, sc, 80, 58, C.ICON.star, 0.4);
          words(ui, sc, 80, 104, '+' + CO.stars + ' Stars', 13, '#a8740c');
          tw(ui, move, { targets: st, angle: { from: -12, to: 12 }, duration: 500, yoyo: true, repeat: -1 });
          ui.canvasImg(sc, 168, 18, 'trk-tour-plaque', 96, 96, function (g) { g.scale(0.75, 0.75); plaque(g); });
        } },
    ],
  };
})(window.Farm = window.Farm || {});
