// Looks on screen (owner, 2-3 Nov 2026; rules: 01-logicK.js, the list: 00-zzzlooks.js): Tita Luz at her Tailor Shop in
// town, the shop (All looks / My looks), wearing one anywhere, and friends seeing it. A look's pictures are not in the
// page: they are the Costumes pack (10b-packs.js: the app brings them from the CDN, looks/v1/<name>.webp, or the phone's
// copy), and until they come, or if they never do, the farmer wears their own clothes. Coins and Stars looks are sold by the
// server (farm_looks_v1, farm_look_buy_v1: supabase/farm_online_13.sql); Gold looks in the game.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GOLD = 0xd9a62a, GREY = 0xa08a68;
  var FRAME = { frameWidth: 256, frameHeight: 384, margin: 8, spacing: 16 }, ARCHER = { frameWidth: 288, frameHeight: 384, margin: 8, spacing: 16 };
  var RETRY = 60000; // a look that did not come is asked for again after this long
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var host = function () { return window.gameHost || {}; };
  var who = function (look) { return look === 'girl' ? 'girl' : 'boy'; };

  // ---------- the pictures, from the app ----------
  var asked = {}; // texture key -> { state: 'loading' | 'ready' | 'failed', at }
  var keyOf = function (cos, look, archer) { return 'look_' + cos + '_' + who(look) + (archer ? '_archer' : ''); };
  var fileOf = function (cos, look, archer) { return cos + '-' + who(look) + (archer ? '-archer' : ''); };
  var scene = function () { return F.world || F.ui; };
  // true when the look's picture is ready; otherwise asks for it (once a minute at most) and says false
  F.lookReady = function (cos, look, archer) {
    if (!cos || C.LOOK_INDEX[cos] == null) return false;
    var key = keyOf(cos, look, archer), a = asked[key], sc = scene();
    if (sc && sc.textures && sc.textures.exists(key)) return true;
    if (a && (a.state === 'loading' || (a.state === 'failed' && Date.now() - a.at < RETRY))) return false;
    asked[key] = { state: 'loading', at: Date.now() };
    var file = fileOf(cos, look, archer);
    F.fetchFile({ file: 'looks/v1/' + file }).then(function (url) { gotLook(key, !!archer, url); });
    return false;
  };
  var gotLook = function (key, archer, url) {
    var sc = scene();
    if (!sc || typeof url !== 'string') { asked[key] = { state: 'failed', at: Date.now() }; return; }
    var img = new Image();
    img.onload = function () {
      var s2 = scene();
      if (!s2 || s2.textures.exists(key)) return;
      s2.textures.addSpriteSheet(key, img, archer ? ARCHER : FRAME);
      if (!archer) F.makeWalkAnims(s2, key);
      asked[key] = { state: 'ready', at: Date.now() };
      F.bus.emit('look', key);
    };
    img.onerror = function () { asked[key] = { state: 'failed', at: Date.now() }; };
    img.src = url;
  };

  // The farmer's picture: their look when it is here, else their own clothes (and the party hat on their birthday).
  var sheetFor = F.sheetFor;
  F.sheetFor = function (look, party, cos) {
    return cos && F.lookReady(cos, look) ? keyOf(cos, look) : sheetFor(look, party);
  };
  var walkSuffix = F.walkSuffix;
  F.walkSuffix = function (key) { return key && key.indexOf('look_') === 0 ? '-' + key : walkSuffix(key); };
  F.playerKey = function (sc) {
    var s = F.session && F.session.state, key = s ? F.sheetFor(s.look, F.myParty(), L.wornLook(s)) : 'player';
    return sc ? F.ensureTexture(sc, key) : key;
  };
  F.archerKeyFor = function (look, cos) {
    return cos && F.lookReady(cos, look, true) ? keyOf(cos, look, true) : look === 'girl' ? 'archer_girl' : 'archer';
  };
  // a look came: if it is yours, you wear it now (and friends are told)
  F.bus.on('look', function () {
    var w = F.world;
    if (!w || !w.player || !w.sys || !w.sys.isActive()) return;
    if (w.player.texture.key !== F.playerKey()) {
      w.applyLook();
      if (O.retrack) O.retrack();
    }
  });
  // what you wear is asked for as the world opens, so it is there soon after
  var create = P.create;
  P.create = function () {
    create.call(this);
    var s = F.session && F.session.state, cos = s && L.wornLook(s);
    if (cos) { F.lookReady(cos, s.look); if (L.isWildMap && L.isWildMap(this.mapKey)) F.lookReady(cos, s.look, true); }
    if (this.mapKey === 'town') this.setupTailor();
    else this.tailor = null;
  };

  // ---------- Tita Luz, at her door in the park ----------
  P.setupTailor = function () {
    var p = this.points && this.points.tita_luz, self = this;
    this.tailor = null;
    if (!p) return;
    F.ensureTexture(this, 'tita_luz');
    var img = this.add.sprite(p.x, p.y, 'tita_luz', 0).setOrigin(0.5, 376 / 384);
    F.depthTo(img, DEPTH.actor + p.y / 1e5);
    var zone = this.add.zone(p.x, p.y - 0.15 * T, 0.6 * T, 0.35 * T);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    this.tailor = { x: p.x, y: p.y, img: img, zone: zone };
    this.updateTailor();
    this.time.addEvent({ delay: 300, loop: true, callback: function () { if (self.tailor) self.updateTailor(); } });
  };
  P.tailorOpen = function () { var t = this.state.time; return t >= C.TAILOR.open && t < C.TAILOR.close; };
  P.updateTailor = function () {
    var k = this.tailor, here = this.tailorOpen();
    k.img.setVisible(here);
    k.zone.body.enable = here;
    if (!here || !this.player) return;
    var f = this.feet(), dx = f.x - k.x, dy = f.y - k.y;
    if (Math.hypot(dx, dy) > 3 * T) return k.img.setFrame(0).setFlipX(false);
    if (Math.abs(dx) > Math.abs(dy)) k.img.setFrame(6).setFlipX(dx > 0); // the side frames face left
    else k.img.setFrame(dy < 0 ? 3 : 0).setFlipX(false);
  };
  var resolve = P.resolve;
  P.resolve = function () {
    var k = this.tailor, self = this;
    if (k) {
      var pt = this.front(0.7), d = Math.hypot(pt.x - k.x, pt.y - k.y);
      if (d < 0.9 * T && k.img.visible) return { label: 'Talk', icon: C.ICON.ribbon, run: function () { self.talkTailor(); } };
      if (d < 1.6 * T && !k.img.visible) {
        return { label: 'Closed', icon: C.ICON.ribbon, run: function () { F.ui.dialog('THE TAILOR SHOP\nZzz... Tita Luz is sleeping. Come back at ' + L.formatTime(C.TAILOR.open) + '.'); } };
      }
    }
    return resolve.call(this);
  };
  P.talkTailor = function () {
    sfx('talk');
    if (F.ui.tailorTour && F.ui.tailorTour(function () { F.ui.openTailor('shop', 0); })) return; // the first time (19zk-tours.js)
    F.ui.openTailor('shop', 0);
  };

  // ---------- the server's looks (Coins and Stars) ----------
  O.looks = null; // { offers: { look: [{ currency, price, version }] }, owned: [keys], at }
  var readLooks = function (r) {
    if (!r || typeof r !== 'object') return null;
    var offers = {};
    (Array.isArray(r.offers) ? r.offers : []).forEach(function (o) {
      if (!o || C.LOOK_INDEX[o.look] == null || (o.currency !== 'coins' && o.currency !== 'stars')) return;
      var price = Math.floor(Number(o.price)), version = Math.floor(Number(o.version));
      if (!(price > 0 && price <= 100000) || !(version > 0)) return;
      (offers[o.look] = offers[o.look] || []).push({ currency: o.currency, price: price, version: version });
    });
    var owned = (Array.isArray(r.owned) ? r.owned : []).filter(function (k) { return C.LOOK_INDEX[k] != null; });
    return { offers: offers, owned: owned, at: Date.now() };
  };
  var canPay = function () { return !!(host().shop && F.Net && F.Net.available() && O.on); };
  O.loadLooks = function () {
    if (!F.Net || !F.Net.available() || !O.on) return Promise.resolve(null);
    return F.Net.rpc('farm_looks_v1', {}).then(readLooks, function () { return null; }).then(function (l) {
      if (!l) return O.looks;
      O.looks = l;
      if (L.ownLooks(F.session.state, l.owned)) { F.Host.save(F.session.state); F.bus.emit('hud'); }
      return l;
    });
  };
  // a look bought on another phone is yours here too: asked when the game connects
  var prizes = O.prizes;
  O.prizes = function () {
    return prizes.call(O).then(function (won) { return O.loadLooks().then(function () { return won; }, function () { return won; }); });
  };
  var requestId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  };

  // ---------- the shop ----------
  U.openTailor = function (tab, page) {
    var self = this, fresh = O.looks && Date.now() - O.looks.at < 60000;
    if (fresh || !canPay()) return this.drawTailor(tab, page);
    if (this.tailorBusy) return;
    this.tailorBusy = true;
    O.loadLooks().then(function () { self.tailorBusy = false; self.drawTailor(tab, page); }, function () { self.tailorBusy = false; self.drawTailor(tab, page); });
  };
  U.drawTailor = function (tab, page) {
    var self = this, s = F.session.state, rows = [], worn = L.wornLook(s);
    C.LOOKS.forEach(function (d, i) {
      var owned = L.ownsLook(s, d.key);
      if (tab === 'mine' && !owned) return;
      // a reward look (the Lair's Fire look) is not in the window until it is yours or the server sells it
      if (d.reward && !owned && !(O.looks && O.looks.offers[d.key] && O.looks.offers[d.key].length)) return;
      var row = { sheet: { key: 'looks_thumbs', frame: i * 2 + (s.look === 'girl' ? 1 : 0), scale: 0.36 }, name: d.name, desc: d.desc, buttons: [] };
      if (owned) {
        row.desc = (worn === d.key ? 'Wearing it now. ' : d.free ? 'A gift for everyone. ' : 'Yours. ') + d.desc;
        row.buttons.push(worn === d.key
          ? { label: 'Take off', color: GREY, cb: function () { self.wearLook(''); } }
          : { label: 'Wear', color: GREEN, cb: function () { self.wearLook(d.key); } });
      } else if (d.gold) {
        row.desc = fmt(d.gold) + 'G. ' + d.desc;
        row.buttons.push({ label: fmt(d.gold) + 'G', color: GOLD, cb: function () { self.buyLookGold(d.key); } });
      } else {
        var offers = O.looks && O.looks.offers[d.key];
        if (offers && offers.length && canPay()) {
          row.desc = offers.map(function (o) { return o.price + (o.currency === 'coins' ? ' Coins' : ' Stars'); }).join(' or ') + '. ' + d.desc;
          offers.slice(0, 2).forEach(function (o) {
            row.buttons.push({ label: o.price + (o.currency === 'coins' ? ' Coins' : ' Stars'), color: o.currency === 'coins' ? GOLD : BLUE, cb: function () { self.buyLookPaid(d, o); } });
          });
        } else {
          row.desc = (canPay() ? 'Not for sale right now. ' : 'Bought with Coins or Stars, when you are online. ') + d.desc;
        }
      }
      rows.push(row);
    });
    this.listPanel({
      title: 'Tailor Shop', tab: tab, page: page, rows: rows,
      tabs: [['shop', 'All looks'], ['mine', 'My looks']],
      empty: 'No looks yet. The Christmas Elf is free: find it under All looks.',
      reopen: function (t, p) { self.openTailor(t, p); },
      sub: function () { return 'One look dresses your boy and your girl. Wear it anywhere; friends see it too.'; },
    });
  };
  U.wearLook = function (key) {
    var s = F.session.state, d = L.lookDef(key);
    if (!L.wearLook(s, key)) return;
    F.Host.save(s);
    sfx('pick');
    var w = F.world;
    if (w && w.applyLook) w.applyLook();
    if (O.retrack) O.retrack();
    this.closeAll();
    if (key && !F.lookReady(key, s.look)) this.toast('Tita Luz is getting your ' + d.name + ' ready...', 2400);
    else this.toast(key ? 'You are wearing the ' + d.name + '!' : 'Back in your own clothes.', 2000, 0x2f5a22);
  };
  U.buyLookGold = function (key) {
    var self = this, s = F.session.state, d = L.lookDef(key);
    if (s.gold < d.gold) { sfx('nope'); return this.toast('Not enough gold. ' + d.name + ' is ' + fmt(d.gold) + 'G.', 2400); }
    this.confirm('BUY THIS LOOK?\n' + d.name + ' for ' + fmt(d.gold) + 'G. You have ' + fmt(s.gold) + 'G.', function () {
      if (L.buyLookGold(s, key) !== 'ok') return;
      sfx('coin');
      F.Host.save(s);
      F.bus.emit('hud');
      if (F.world) F.world.changed();
      self.lookBought(d);
    });
  };
  U.lookBought = function (d) {
    var self = this;
    this.closeAll();
    F.lookReady(d.key, F.session.state.look);
    this.dialog('IT IS YOURS!\n' + d.name + ' is in My looks. Wear it now?', [{ label: 'Later' }, { label: 'Wear it', color: GREEN, cb: function () { self.wearLook(d.key); } }]);
  };
  U.buyLookPaid = function (d, o) {
    var self = this, what = o.price + (o.currency === 'coins' ? ' Coins' : ' Stars');
    this.confirm('BUY THIS LOOK?\n' + d.name + ' for ' + what + '. One purchase dresses your boy and your girl.', function () {
      if (self.tailorBusy) return;
      self.tailorBusy = true;
      F.Net.rpc('farm_look_buy_v1', { p_look: d.key, p_currency: o.currency, p_price: o.price, p_version: o.version, p_request_id: requestId() }).then(function (r) {
        self.tailorBusy = false;
        if (r && (r.ok || r.code === 'owned')) {
          L.ownLooks(F.session.state, [d.key]);
          F.Host.save(F.session.state);
          if (O.looks && O.looks.owned.indexOf(d.key) < 0) O.looks.owned.push(d.key);
          if (typeof host().spent === 'function') host().spent(); // the app refreshes your wallet
          sfx('coin');
          return self.lookBought(d);
        }
        var code = r && r.code, say = {
          'insufficient-coins': 'Not enough Coins.', 'insufficient-stars': 'Not enough Stars.', 'offer-changed': 'The price just changed. Have a look again.',
          'offer-unavailable': 'That look is not for sale right now.', limit: 'That is all the shopping for today. Come back tomorrow.',
          'account-unavailable': 'Your account cannot shop right now.', 'wallet-unavailable': 'Your wallet could not be loaded. Try again soon.',
        }[code] || 'That did not go through. Nothing was taken. Try again soon.';
        sfx('nope');
        if (code === 'offer-changed' || code === 'offer-unavailable') O.looks = null;
        self.toast(say, 2800);
        if (code === 'insufficient-coins' && typeof host().store === 'function') self.dialog('NEED MORE COINS?\nThe Selebox store has Coins.', [{ label: 'Not now' }, { label: 'Open store', color: GOLD, cb: function () { host().store(); } }]);
      }, function () {
        self.tailorBusy = false;
        self.toast('Could not reach the shop. Check your connection.', 2400);
      });
    });
  };
})(window.Farm = window.Farm || {});
