// The bigger Willowbrook at runtime: visitors from out of town who walk in, look around, buy at the market stall
// and leave; the new shops' panels (bakery, seaside shack, florist, vet, post office, library, school, chapel,
// Marco's wagon); and animal treats. Rules are in 01-logic5.js, content in 00-town2.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  // where visitors like to go (Tiled points on the town map)
  var STOPS = ['stall_front', 'stall_front', 'market_w', 'market_e', 'plaza_n', 'plaza_e', 'plaza_w', 'park_pond', 'gazebo', 'beach',
    'door_bakery', 'door_florist', 'wagon'];

  // ---------- visitors ----------
  // Their walk cycles follow the villagers' in the people sheet.
  var makePeopleAnims = F.makePeopleAnims;
  F.makePeopleAnims = function (scene) {
    makePeopleAnims(scene);
    var n = C.VILLAGER_ORDER.length;
    C.SHOPPERS.forEach(function (sh, k) {
      ['down', 'up', 'side'].forEach(function (d, j) {
        var f = (n + k) * 9 + j * 3, key = 'v-' + sh.key + '-' + d;
        if (scene.anims.exists(key)) return;
        scene.anims.create({ key: key, frames: scene.anims.generateFrameNumbers('people', { frames: [f + 1, f, f + 2, f] }), frameRate: 6, repeat: -1 });
      });
    });
  };

  var V = F.Villagers.prototype;

  // Visitors join the town's list of people (so they block the way, show a name tag and can buy at the stall),
  // but walk to the stops we give them instead of a schedule.
  V.addShoppers = function () {
    var self = this, sc = this.scene, n = C.VILLAGER_ORDER.length;
    this.shoppers = true;
    this.nextShopper = 0;
    C.SHOPPERS.forEach(function (sh, k) {
      var v = {
        key: sh.key, i: n + k, def: { name: sh.name, line: sh.line, shopper: true }, shopper: true, place: 'gone', target: null,
        path: [], hold: 0, dir: 'down', visible: false, n: 0, dwell: 0, stops: [],
        sprite: sc.add.sprite(0, 0, 'people', (n + k) * 9).setOrigin(0.5, 0.83).setScale(2).setVisible(false),
      };
      sc.physics.add.existing(v.sprite);
      v.sprite.body.setSize(60, 30).setOffset(34, 145).setImmovable(true);
      v.sprite.body.moves = false;
      v.sprite.body.enable = false;
      sc.physics.add.collider(sc.player, v.sprite);
      self.list.push(v);
    });
    // a couple are already in town when you arrive during the day
    if (this.shopHours()) {
      this.list.filter(function (v) { return v.shopper; }).slice(0, 2).forEach(function (v) { self.arrive(v, true); });
    }
  };

  V.shopHours = function () {
    var s = this.scene.state;
    return s.time >= C.SHOPPER.from && s.time < C.SHOPPER.to && !L.festivalOn(s.day); // no visitors on festival days
  };

  var targetOf = V.targetOf;
  V.targetOf = function (v, time) {
    if (v.shopper) return v.target || { place: 'gone', point: null, hide: true };
    return targetOf.call(this, v, time);
  };

  var update = V.update;
  V.update = function (dt, time, frozen) {
    if (this.shoppers && !frozen) this.updateShoppers(dt);
    update.call(this, dt, time, frozen);
  };

  V.updateShoppers = function (dt) {
    var self = this, s = this.scene.state, open = this.shopHours();
    var mine = this.list.filter(function (v) { return v.shopper; });
    if (open && s.time >= this.nextShopper) {
      var out = mine.filter(function (v) { return !v.visible; });
      var here = mine.length - out.length;
      if (out.length && here < C.SHOPPER.max) this.arrive(out[Math.floor(Math.random() * out.length)], false);
      this.nextShopper = s.time + C.SHOPPER.every * (0.5 + Math.random());
    }
    mine.forEach(function (v) {
      if (!v.visible || v.errand || v.path.length || v.hideAtEnd) return;
      v.dwell -= dt;
      if (v.dwell <= 0) self.nextStop(v, !open);
    });
  };

  // A visitor comes in along the valley road (or down from the farm), with a few places to see.
  V.arrive = function (v, already) {
    var pts = this.scene.points, from = Math.random() < 0.65 ? pts.from_east : pts.from_farm;
    if (!from) return;
    var stops = STOPS.slice().sort(function () { return Math.random() - 0.5; });
    v.entry = from;
    v.stops = stops.slice(0, 2 + Math.floor(Math.random() * 3)).filter(function (n) { return pts[n]; });
    var start = already && v.stops.length ? pts[v.stops.shift()] : from;
    this.put(v, start.x, start.y, true);
    v.place = already ? 'here' : 'arrive';
    this.nextStop(v, false);
  };

  // The next place to look at, or the way out of town.
  V.nextStop = function (v, leave) {
    var pts = this.scene.points, name = !leave && v.stops.length ? v.stops.shift() : null;
    v.n++;
    if (name) {
      var p = pts[name], j = function () { return (Math.random() - 0.5) * T * 0.5; };
      v.target = { place: name + '#' + v.n, point: { x: p.x + j(), y: p.y + j() }, hide: false };
      v.dwell = 2500 + Math.random() * 4500;
    } else {
      v.target = { place: 'leave#' + v.n, point: v.entry, hide: true };
    }
  };

  // ---------- they buy at the stall too ----------
  var P = F.WorldScene.prototype;

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    if (this.mapKey === 'town' && this.villagers) this.villagers.addShoppers();
    this.nightSigns = null;
    this.signMs = 0;
  };

  // ---------- at night (11 PM to 6 AM) the shops are shut: a sign on each shop door, the stall and the stand ----------
  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    updateExtras.call(this, dt, time);
    this.signMs -= dt;
    if (this.signMs > 0) return;
    this.signMs = 2000;
    this.updateNightSigns();
  };

  P.updateNightSigns = function () {
    var self = this, night = L.sleepTime(this.state);
    if (!!this.nightSigns === night) return;
    if (!night) {
      this.nightSigns.forEach(function (t) { t.destroy(); });
      this.nightSigns = null;
      return;
    }
    this.nightSigns = [];
    this.objects.forEach(function (o) {
      var b = o.type === 'door' && C.BUILDINGS[o.props.building];
      if (!(b && b.open) && o.type !== 'stand' && o.type !== 'shop') return;
      var sign = self.add.text((o.x0 + o.x1 + 1) / 2 * T, o.y0 * T + 40, 'Zzz  CLOSED', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '96px', fontStyle: 'bold', color: '#ffe9a8',
        backgroundColor: '#5a3a1e', padding: { x: 26, y: 10 },
      }).setOrigin(0.5, 1).setDepth(32); // above the night sheet (18-polish.js), like the lit windows
      self.nightSigns.push(sign);
    });
  };

  // Picks the nearest person out in town and free (a villager or a visitor) and walks them to the stall.
  P.sendBuyer = function (shelf) {
    var self = this, s = this.state;
    this.buyers = this.buyers || {};
    if (this.buyers[shelf]) return;
    var spot = this.points.stall_front, best = null, bestD = Infinity;
    this.villagers.list.forEach(function (v) {
      if (!v.visible || v.errand || v.hideAtEnd) return;
      var d = Math.hypot(v.x - spot.x, v.y - spot.y);
      if (d < bestD) { best = v; bestD = d; }
    });
    var ok = best && this.villagers.errand(best, spot, 'up', 1800, function (v) {
      var sale = L.sellLot(s, shelf, v.shopper ? null : v.key);
      delete self.buyers[shelf];
      if (!sale) return;
      if (v.shopper) sale.who = v.def.name;
      self.emote(v, C.ICON.coin);
      self.announceSale(sale, true);
      self.changed();
    });
    if (ok) this.buyers[shelf] = best.key;
    else {
      var sale = L.sellLot(s, shelf, null);
      if (sale) this.announceSale(sale, false);
      this.changed();
    }
  };

  var announceSale = P.announceSale;
  P.announceSale = function (sale, here) {
    if (!sale.who) return announceSale.call(this, sale, here);
    F.ui.toast('A ' + sale.who.toLowerCase() + ' bought your ' + sale.n + ' ' + C.ITEMS[sale.id].name + '! ' + sale.coins + 'G is waiting at the market stall.', 2600, 0x7a4d12);
    sfx('coin');
    if (this.standObj) this.floatTextAt((this.standObj.x0 + 1) * T, (this.standObj.y0 - 0.5) * T, '+' + sale.coins + 'G');
  };

  // Visitors just say hello.
  var villagerAction = P.villagerAction;
  P.villagerAction = function (v) {
    var self = this;
    if (!v.shopper) return villagerAction.call(this, v);
    return {
      label: 'Talk', icon: C.ICON.bubble, run: function () {
        self.villagers.greet(v, self.dir);
        self.emote(v, 'talk');
        sfx('talk');
        F.ui.dialog(v.def.name.toUpperCase() + '\n"' + v.def.line + '"');
        if (L.hello(self.state, v.key)) self.progress('meet'); // shoppers say hello too (owner, 29 Oct)
      },
    };
  };

  // ---------- animal treats ----------
  var animalAction = P.animalAction;
  P.animalAction = function (m) {
    var self = this, s = this.state, a = s.animals[m.i], held = L.held(s);
    if (held && held.id === 'treat' && !a.ready) {
      if (a.treat) return { label: 'Treat', icon: C.ICON.treat, disabled: true, why: a.name + ' already had a treat today.' };
      return {
        label: 'Treat', icon: C.ICON.treat, run: function () {
          if (L.giveTreat(s, m.i, s.sel) !== 'ok') return;
          sfx('eat');
          if (self.herd && self.herd.hearts) self.herd.hearts(m, 3);
          self.floatTextAt(m.x, m.y - m.def.height * T, a.name + ' loves it!');
          self.changed();
        },
      };
    }
    return animalAction.call(this, m);
  };

  // ---------- the new buildings' panels (mixed into UIScene) ----------
  var BLUE = 0x4a90c9;
  var world = function () { return F.world; };
  var U = F.UIScene.prototype;

  var openBuilding = U.openBuilding;
  U.openBuilding = function (key) {
    var s = F.session.state, b = C.BUILDINGS[key];
    var mine = { bakery: 1, shack: 1, florist: 1, vet: 1, post: 1, library: 1, school: 1, chapel: 1, wagon: 1 };
    if (!mine[key] || !b) return openBuilding.call(this, key);
    if (!L.buildingOpen(s, key)) {
      var when = b.days ? ' on weekdays' : '';
      return this.dialog(this.closedText(b.name, b.owner, key === 'wagon' ? "Marco's wagon is shut. He trades " + L.formatTime(b.open[0]) + ' to ' + L.formatTime(b.open[1]) + '.'
        : 'Closed. Open ' + L.formatTime(b.open[0]) + ' to ' + L.formatTime(b.open[1]) + when + '.'));
    }
    sfx('door');
    if (key === 'bakery') return this.openMenuShop(key, C.BAKERY_MENU);
    if (key === 'shack') return this.openMenuShop(key, C.SHACK_MENU);
    if (key === 'florist') return this.openFlorist(0);
    if (key === 'vet') return this.openVet();
    if (key === 'post') return this.openPost(0);
    if (key === 'library') return this.openLibrary(0);
    if (key === 'school') return this.openSchool();
    if (key === 'chapel') return this.openChapel();
    if (key === 'wagon') return this.openWagon();
  };

  // Eat it here, or take it with you.
  U.openMenuShop = function (key, menu) {
    var self = this, s = F.session.state, b = C.BUILDINGS[key], o;
    var rows = menu.map(function (id) {
      var item = C.ITEMS[id];
      return {
        icon: item.icon, name: item.name, desc: item.desc + ' +' + item.energy + ' energy.',
        buttons: [{
          label: 'Eat ' + item.price + 'G', cb: function () {
            if (s.energy >= L.maxEnergy(s)) return self.toast("You're already full of energy.");
            if (s.gold < item.price) { sfx('nope'); return self.toast('Not enough gold.'); }
            s.gold -= item.price;
            s.energy = Math.min(L.maxEnergy(s), s.energy + item.energy);
            sfx('eat');
            o.refresh();
            world().changed();
            self.toast('Delicious! +' + item.energy + ' energy.');
          },
        }].concat(self.buyButtons(id, [1], function () { o.refresh(); }).map(function (btn) { btn.label = 'Take ' + item.price + 'G'; btn.color = BLUE; return btn; })),
      };
    });
    o = this.listPanel({
      title: b.name, rows: rows, talk: b.owner,
      sub: function () { return s.gold + 'G   Energy ' + s.energy + '/' + L.maxEnergy(s); },
    });
  };

  // Bouquets, and potted plants for the house.
  U.openFlorist = function (page) {
    var self = this, s = F.session.state, H = C.HOME, o;
    var rows = C.FLORIST_STOCK.map(function (id) {
      var item = C.ITEMS[id];
      return { icon: item.icon, name: item.name, desc: item.price + 'G. ' + item.desc, buttons: self.buyButtons(id, [1, 3], function () { o.refresh(); }) };
    }).concat(['plant', 'big_plant'].map(function (key) {
      var t = H.typeIndex[key], price = L.furnPrice(t, 0);
      return {
        img: self.furnImg(t, 0), name: H.types[t].name, desc: price + 'G. For your house: +' + L.furnBeauty(t, 0) + ' beauty.',
        buttons: [{
          label: 'Buy ' + price + 'G', cb: function () {
            if (L.buyFurn(s, t, 0) !== 'ok') { sfx('nope'); return self.toast('Not enough gold.'); }
            sfx('coin');
            o.refresh();
            world().changed();
            world().save();
            self.toast('Poppy will send it to your storage. Place it with Decorate at home.');
          },
        }],
      };
    }));
    o = this.listPanel({ title: "Poppy's Flowers", rows: rows, page: page, talk: 'poppy', reopen: function (tab, p) { self.openFlorist(p); }, sub: function () { return s.gold + 'G'; } });
  };

  U.openVet = function () {
    var self = this, s = F.session.state, o;
    var rows = C.VET_STOCK.map(function (id) {
      var item = C.ITEMS[id];
      return { icon: item.icon, name: item.name, desc: item.price + 'G. ' + item.desc, buttons: self.buyButtons(id, id === 'treat' ? [1, 5] : [1], function () { o.refresh(); }) };
    });
    rows.push({
      icon: C.ICON.heart, name: 'Check-up', desc: 'Owen looks over your animals and tells you how they feel.',
      buttons: [{
        label: 'Ask', color: BLUE, cb: function () {
          var lines = s.animals.map(function (a) {
            return a.name + ' the ' + C.ANIMALS[a.kind].name.toLowerCase() + ': ' + Math.floor(a.love / 10) + ' hearts' + (a.fed ? '' : ', hungry');
          });
          self.say('owen', 'Owen', lines.length ? lines.join('\n') : "You don't have any animals yet! Lily sells them at her stand.");
        },
      }],
    });
    o = this.listPanel({ title: "Owen's Animal Clinic", rows: rows, talk: 'owen', sub: function () { return s.gold + 'G   A treat a day keeps them happy.'; } });
  };

  // Send what you're holding to someone you know.
  U.openPost = function (page) {
    var self = this, s = F.session.state, held = L.held(s);
    var giftable = held && L.giftable(held.id);
    var rows = C.VILLAGER_ORDER.filter(function (k) { return L.friend(s, k).met; }).map(function (k) {
      var f = L.friend(s, k), v = C.VILLAGERS[k];
      return {
        people: k, name: v.name, desc: v.role + (f.gifted ? '. Already got a gift today.' : '.'),
        buttons: f.gifted || !giftable ? [] : [{
          label: 'Send ' + C.POST_FEE + 'G', cb: function () {
            var r = L.mailGift(s, k, s.sel);
            if (r.error === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
            if (r.error) { sfx('nope'); return self.toast("Finn can't send that."); }
            sfx('letter');
            world().changed();
            world().save();
            self.closeModal();
            self.toast('Finn will deliver it today. ' + v.name + (r.reaction === 'love' ? ' will love it!' : r.reaction === 'like' ? ' will like it.' : r.reaction === 'dislike' ? " won't like it much..." : ' will be glad of it.'), 3200);
          },
        }],
      };
    });
    this.listPanel({
      title: 'Post Office', rows: rows, page: page, talk: 'finn', reopen: function (tab, p) { self.openPost(p); },
      sub: function () { return giftable ? 'Sending: ' + C.ITEMS[held.id].name + '. ' + C.POST_FEE + 'G a parcel; it counts as their gift today.' : 'Hold the gift you want to send, then come back.'; },
      empty: 'You need to meet people before you can send them anything.',
    });
  };

  U.openLibrary = function (page) {
    var self = this;
    var rows = C.BOOKS.map(function (b) {
      return {
        icon: C.ICON.book, name: b.title, desc: b.text.slice(0, 48) + '...',
        buttons: [{ label: 'Read', color: BLUE, cb: function () { sfx('pick'); self.dialog(b.title.toUpperCase() + '\n' + b.text); } }],
      };
    });
    this.listPanel({ title: 'Willow Library', rows: rows, page: page, talk: 'elliot', reopen: function (tab, p) { self.openLibrary(p); }, sub: function () { return 'Borrow a book and read it here. Elliot asks for quiet.'; } });
  };

  U.openSchool = function () {
    var self = this, s = F.session.state, done = s.schoolDay === s.day;
    var rows = [{
      people: 'clara', name: "Help with today's lesson", desc: done ? 'You already helped today. The children want you back tomorrow!' : 'Spend an hour with the class. Clara, Pip and Daisy will love it.',
      buttons: done ? [] : [{
        label: 'Help', cb: function () {
          var r = L.helpSchool(s);
          if (r !== 'ok') return self.toast("There's no class right now.");
          sfx('gift');
          world().changed();
          world().save();
          self.closeModal();
          self.say('clara', 'Clara', 'Thank you! The children loved hearing about the farm. Pip has decided he is going to be a cow when he grows up.');
        },
      }],
    }];
    this.listPanel({ title: 'Willowbrook School', rows: rows, talk: 'clara', sub: function () { return 'Class runs 8 AM to 2 PM on weekdays.'; } });
  };

  U.openChapel = function () {
    var self = this, s = F.session.state, rested = s.chapelDay === s.day;
    var rows = [{
      icon: C.ICON.moon, name: 'Sit and rest', desc: rested ? 'You rested here today. Come again tomorrow.' : 'A quiet half hour on the old pews. +' + C.CHAPEL_REST.energy + ' energy, once a day.',
      buttons: rested ? [] : [{
        label: 'Rest', cb: function () {
          var r = L.chapelRest(s);
          sfx('morning');
          world().changed();
          self.closeModal();
          self.toast(r > 0 ? 'The quiet does you good. +' + r + ' energy.' : 'A peaceful moment.');
        },
      }],
    }, {
      icon: C.ICON.ring, name: 'Weddings', desc: 'Father Tomas marries couples here. Win someone\'s heart and show them a Blue Feather.', buttons: [],
    }];
    this.listPanel({ title: 'Chapel', rows: rows, talk: 'tomas', sub: function () { return 'Everyone is welcome.'; } });
  };

  // Marco's daily imported furniture.
  U.openWagon = function () {
    var self = this, s = F.session.state, o;
    var rows = L.wagonDeals(s).map(function (d, i) {
      return {
        img: self.furnImg(d.t, d.v), name: L.furnName(d.t, d.v), desc: d.price + 'G (' + Math.round(C.WAGON.off * 100) + '% off). +' + L.furnBeauty(d.t, d.v) + ' beauty.' + (C.HOME.styles[d.v].festival ? ' A festival piece!' : ''),
        buttons: [{
          label: 'Buy ' + d.price + 'G', cb: function () {
            var r = L.buyDeal(s, i);
            if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
            if (r !== 'ok') return;
            sfx('coin');
            o.refresh();
            world().changed();
            world().save();
            self.toast("Marco: \"A fine choice!\" It's in your storage. Place it with Decorate at home.");
          },
        }],
      };
    });
    o = this.listPanel({ title: "Marco's Wagon", rows: rows, talk: 'marco', sub: function () { return s.gold + 'G   New pieces every day, from all over the kingdom.'; } });
  };
})(window.Farm = window.Farm || {});
