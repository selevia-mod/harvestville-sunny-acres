// Mang Danny's Trading Post and the Talipapa's vendors in the world (owner, 18 Nov 2026; content
// 00-zzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-trade.js, rules 01-logicZ...Z-manila-trade.js).
// - Manila: the Trading Post's front says Shop: Buy (2 x the sell price, 20 of each a day), Sell (he pays the sell price,
//   any amount), and his weekly rare trade at the top once he is your friend (8 hearts; still on his talk panel too).
// - The Talipapa's meat, fish and vegetable vendors (5 AM-5 PM at their stalls) say Buy: their few goods, 30 of each a day.
// - A first-time tour each, with the owner's pictures. Panels only: nothing new is drawn or run each frame.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var X = C.MNTRADE;
  var M = C.MANILA;
  if (!X || !X.on || !M || !M.on) return;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var INK = F.UI_CONST.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, DARK_GREEN = 0x2f5a22;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var name = function (id) { return C.ITEMS[id] ? C.ITEMS[id].name : id; };
  var icon = function (id) { return C.ITEMS[id] ? C.ITEMS[id].icon : C.ICON.coin; };
  var mine = function () { var s = F.session && F.session.state; return s && !s.isVisit && !F.session.visit && !F.session.raid ? s : null; };
  var STALL = { meat_vendor: ['The Meat Stall', 'props/manila_talipapa_meat'], fish_vendor: ['The Fish Stall', 'props/manila_talipapa_fish'], veg_vendor: ['The Vegetable Stall', 'props/manila_talipapa_veg'] };
  var hr = function (m) { var h = Math.floor(m / 60) % 24; return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); };
  var tpHours = (M.roles && M.roles.meat_vendor && M.roles.meat_vendor.hours && M.roles.meat_vendor.hours[0]) || [300, 1020];

  // ---------- the tours (the owner's pictures, from the phone if they are there: a moment at most) ----------
  var ART = { post: ['props/manila_trading_post', 'npc_mang_danny'], tp: ['props/manila_talipapa_meat', 'props/manila_talipapa_fish', 'props/manila_talipapa_veg'] };
  var artReady = function (keys) {
    var want = keys.filter(function (k) { var f = F.packedFile && F.packedFile(k); return !(F.images && F.images[k]) && f && F.onPhone && F.onPhone(f.file) && F.canFetch(); });
    if (!want.length || !F.needImage) return Promise.resolve();
    return Promise.race([Promise.all(want.map(F.needImage)), new Promise(function (r) { setTimeout(r, 1500); })]);
  };
  var touring = false;
  var tourFirst = function (ui, key, then) {
    var s = mine();
    if (touring) return true;
    if (!s || (window.gameHost && window.gameHost.quiet) || !ui.tour || L.txTourSeen(s, key)) return false;
    L.txTourTake(s, key);
    if (F.world) F.world.save();
    touring = true;
    var go = function () { touring = false; ui.tour('tx_' + key, then); };
    artReady(ART[key]).then(go, go);
    return true;
  };
  // a picture fitted into a box, its feet on the box's bottom (a person: the first frame of their sheet); else an icon
  var fit = function (ui, sc, key, cx, bottom, w, h, alt) {
    if (!(F.images && F.images[key])) { var i = ui.add.image(cx, bottom - h / 2, 'items', alt).setScale(0.34); sc.add(i); return i; }
    F.ensureTexture(ui, key);
    var fr = ui.textures.getFrame(key, 0), k = Math.min(w / fr.realWidth, h / fr.realHeight), im = ui.add.image(cx, bottom, key, 0).setOrigin(0.5, 1).setScale(k);
    sc.add(im);
    return im;
  };
  var ic = function (ui, sc, x, y, id, k) { var i = ui.add.image(x, y, 'items', typeof id === 'number' ? id : icon(id)).setScale(k || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 13, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var bob = function (ui, move, t) { if (move && t) ui.tweens.add({ targets: t, y: t.y - 6, duration: 430, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); };
  var D = X.shops.danny, TP = X.shops.meat_vendor;
  F.TOURS.tx_post = {
    title: "MANG DANNY'S TRADING POST",
    steps: [
      { text: "The Trading Post is open! Mang Danny buys and sells the Mixer's goods: Farm Cement, Rope, Sili Powder and Beeswax.",
        draw: function (ui, sc, move) { fit(ui, sc, 'props/manila_trading_post', 96, 126, 160, 116, C.ICON.crate); bob(ui, move, fit(ui, sc, 'npc_mang_danny', 214, 124, 96, 96, C.ICON.heart)); } },
      { text: 'He pays what they sell for, any amount. He sells at ' + X.mult + ' times that, up to ' + D.stock + ' of each a day. Making your own still pays!',
        draw: function (ui, sc, move) {
          ic(ui, sc, 136, 52, 'rope', 0.36);
          words(ui, sc, 60, 52, 'Sell ' + L.txPays('rope') + 'G', 14, '#2f5a22');
          words(ui, sc, 214, 52, 'Buy ' + L.txPrice('rope') + 'G', 14, '#a8740c');
          bob(ui, move, words(ui, sc, 136, 108, D.stock + ' a day', 14));
        } },
      { text: 'At 8 hearts with him, his rare trade of the week is in the shop too, at the top.',
        draw: function (ui, sc, move) {
          ic(ui, sc, 80, 64, 'rope', 0.34);
          words(ui, sc, 136, 64, '->', 18);
          bob(ui, move, ic(ui, sc, 192, 64, 'obsidian', 0.34));
          ic(ui, sc, 136, 112, C.ICON.heart, 0.18);
        } },
    ],
  };
  F.TOURS.tx_tp = {
    title: 'THE TALIPAPA',
    steps: [
      { text: "The Talipapa's vendors sell what the Kitchen's recipes need: meat, fish and vegetables, from " + hr(tpHours[0]) + ' to ' + hr(tpHours[1]) + '.',
        draw: function (ui, sc, move) {
          ['meat_vendor', 'fish_vendor', 'veg_vendor'].forEach(function (k, i) { var t = fit(ui, sc, STALL[k][1], 50 + i * 86, 112, 80, 84, icon(X.shops[k].items[0])); if (i === 1) bob(ui, move, t); });
        } },
      { text: 'They ask ' + X.mult + ' times the sell price, ' + TP.stock + ' of each a day. Growing, fishing and hunting your own still pays.',
        draw: function (ui, sc, move) {
          ['meat_boar', 'fish_m', 'garlic'].forEach(function (id, i) { var x = 60 + i * 76; bob(ui, move && i === 1, ic(ui, sc, x, 52, id, 0.3)); words(ui, sc, x, 96, L.txPrice(id) + 'G', 13, '#a8740c'); });
        } },
      { text: 'What you buy goes in your bag. With no room there, it waits in the basket by your farmhouse.',
        draw: function (ui, sc, move) { ic(ui, sc, 80, 64, C.ICON.bag, 0.4); words(ui, sc, 136, 64, '->', 18); bob(ui, move, fit(ui, sc, 'props/basket_full', 194, 100, 72, 72, C.ICON.crate)); } },
    ],
  };

  // ---------- buying and selling ----------
  var BUY_WHY = { stock: 'Sold out for today. More tomorrow!', full: 'No room in your bag or your basket.', shop: 'Not sold here.' };
  var buy = function (ui, s, shop, id, n, again) {
    var r = L.txBuy(s, shop, id, n);
    if (!r.ok) { sfx('nope'); return ui.toast(r.why === 'gold' ? 'That is ' + fmt(r.cost) + 'G. You have ' + fmt(s.gold) + 'G.' : BUY_WHY[r.why], 2400); }
    sfx('coin');
    again('Bought ' + r.n + ' ' + name(id) + ' for ' + fmt(r.gold) + 'G.' + (r.basket ? ' Your bag is full: ' + r.basket + ' wait in your basket by the farmhouse.' : ''));
  };
  var buyRow = function (ui, s, shop, id, again) {
    var left = L.txLeft(s, id), have = L.countItem(s, id);
    return { icon: icon(id), name: name(id) + '  ·  ' + fmt(L.txPrice(id)) + 'G',
      desc: (left ? 'Left today: ' + left + ' of ' + X.shops[shop].stock + '.' : 'Sold out today. More tomorrow!') + ' You have ' + have + '.',
      buttons: [1, Math.min(5, left)].filter(function (n, i) { return left && (!i || n > 1); }).map(function (n, i) {
        return { label: 'Buy ' + n, color: i ? BLUE : GREEN, cb: function () { buy(ui, s, shop, id, n, again); } };
      }) };
  };
  var saved = function () { var w = F.world; if (w) { w.changed(); w.save(); } F.bus.emit('hud'); };

  // ---------- Mang Danny's shop ----------
  U.txOpenPost = function (tab, page) {
    var self = this, s = mine();
    if (!s) return;
    if (tourFirst(this, 'post', function () { self.txOpenPost(tab, page); })) return;
    tab = tab || 'buy';
    var again = function (msg) { saved(); self.swapTo(function () { self.txOpenPost(tab, page); }); if (msg) self.toast(msg, 2600, DARK_GREEN); };
    var rows = [];
    if (tab === 'buy') {
      var o = L.mnTradeOffer && L.mnTradeOffer(s);
      if (o && o.on) {
        rows.push({ icon: icon(o.get), name: 'Rare trade: ' + o.m + ' ' + name(o.get),
          desc: o.done ? "This week's is done. A new one on Monday!" : 'For your ' + o.n + ' ' + name(o.give) + ' (you have ' + o.have + '). One a week.',
          buttons: o.done ? [] : [{ label: 'Trade', color: o.have >= o.n ? GREEN : 0xa08a68, cb: function () {
            var r = L.mnTrade(s);
            if (r !== 'ok') { sfx('nope'); return self.toast(r === 'missing' ? 'You need ' + o.n + ' ' + name(o.give) + '.' : r === 'full' ? 'Your bag is full.' : 'Not now.', 2400); }
            sfx('coin');
            again('A fair trade! ' + o.m + ' ' + name(o.get) + '.');
          } }] });
      }
      L.txItems('danny').forEach(function (id) { rows.push(buyRow(self, s, 'danny', id, again)); });
    } else {
      L.txItems('danny').forEach(function (id) {
        var have = L.countItem(s, id), sell = function (n) {
          var r = L.txSell(s, id, n);
          if (!r.ok) { sfx('nope'); return self.toast('You have no ' + name(id) + '.', 2000); }
          sfx('coin');
          again('Sold ' + r.n + ' ' + name(id) + ' for ' + fmt(r.gold) + 'G.');
        };
        rows.push({ icon: icon(id), name: name(id) + '  ·  ' + fmt(L.txPays(id)) + 'G each', desc: 'You have ' + have + '. He buys any amount.',
          buttons: have ? [{ label: 'Sell 1', color: GREEN, cb: function () { sell(1); } }, { label: 'Sell all', color: BLUE, cb: function () { sell(have); } }] : [] });
      });
    }
    this.listPanel({ title: "Mang Danny's Trading Post", rows: rows, tab: tab, page: page || 0, tabs: [['buy', 'Buy'], ['sell', 'Sell']],
      reopen: function (t, p) { self.txOpenPost(t, p); },
      sub: function () { return 'Your gold: ' + fmt(s.gold) + 'G.  ' + (tab === 'buy' ? D.stock + ' of each a day.' : 'He pays the sell price.'); } });
  };

  // ---------- a Talipapa vendor's stall ----------
  U.txOpenStall = function (role, line, page) {
    var self = this, s = mine(), st = STALL[role];
    if (!s || !st) return;
    if (tourFirst(this, 'tp', function () { self.txOpenStall(role, line, page); })) return;
    var again = function (msg) { saved(); self.swapTo(function () { self.txOpenStall(role, line, page); }); if (msg) self.toast(msg, 2600, DARK_GREEN); };
    this.listPanel({ title: st[0], rows: L.txItems(role).map(function (id) { return buyRow(self, s, role, id, again); }), page: page || 0,
      reopen: function (t, p) { self.txOpenStall(role, line, p); },
      sub: function () { return (line ? '"' + line + '"  ' : '') + 'Your gold: ' + fmt(s.gold) + 'G.'; } });
  };

  // ---------- the action button ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o) {
    if (o && o.type === 'mn_spot' && o.name === 'trading' && this.mapKey === 'manila' && mine()) return { label: 'Shop', icon: C.ICON.coin, run: function () { F.ui.txOpenPost(); } };
    return extraObjectAction.apply(this, arguments);
  };
  // (only near the three stalls: a box round the vendors' posts, 3 tiles out)
  var posts = Object.keys(STALL).map(function (k) { return (M.roles && M.roles[k] && M.roles[k].post) || [-99, -99]; });
  var box = [Math.min.apply(null, posts.map(function (p) { return p[0]; })) - 3, Math.max.apply(null, posts.map(function (p) { return p[0]; })) + 3,
    Math.min.apply(null, posts.map(function (p) { return p[1]; })) - 3, Math.max.apply(null, posts.map(function (p) { return p[1]; })) + 3];
  var resolve = P.resolve;
  P.resolve = function () {
    var f = this.mn && this.feet(), tx = f && f.x / C.TILE, ty = f && f.y / C.TILE;
    if (f && tx > box[0] && tx < box[1] && ty > box[2] && ty < box[3] && !this.mn.mall && mine() && !(this.mnCal && this.mnCal.stage === 'on')) {
      var self = this, pt = this.front(0.7), v = this.mnPersonAt(pt.x, pt.y) ? null : this.mnFolkAt(pt.x, pt.y);
      if (v && STALL[v.role]) {
        return { label: 'Buy', icon: icon(X.shops[v.role].items[0]), run: function () {
          f = self.feet();
          self.mnFolkFace(v, Math.abs(f.x - v.x) > Math.abs(f.y - v.y) ? (f.x > v.x ? 'right' : 'left') : f.y < v.y ? 'up' : 'down');
          v.hold = Math.max(v.hold, 6000);
          F.ui.txOpenStall(v.role, v.lines[Math.floor(Math.random() * v.lines.length)]);
        } };
      }
    }
    return resolve.apply(this, arguments);
  };
})(window.Farm = window.Farm || {});
