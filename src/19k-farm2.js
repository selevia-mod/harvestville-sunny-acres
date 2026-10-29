// The growing farm at runtime (rules in 01-logicA.js, content in 00-workshop.js): workshops and fruit trees you
// face and tap in the yard, the workshop panel, "ready" bubbles over them, field plots you can till and plant,
// crop mastery stars (a toast, and the Crop stars list in the Collection), the one-time "new on your farm" page,
// and, online, watering a friend's growing crops on a visit (and the crops friends watered for you at home).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var OD = C.OUTDOOR;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var visiting = function (w) { return !!(w.state && w.state.isVisit); };
  var stars = function (n) { return new Array(n + 1).join('★') + new Array(3 - n + 1).join('☆'); };
  var cropName = function (crop) { return C.ITEMS[C.CROPS[crop].item].name; };

  // ---------- the farm: plots, bubbles ----------
  var P = F.WorldScene.prototype;

  var isTillable = P.isTillable;
  P.isTillable = function (x, y) {
    return isTillable.call(this, x, y) || (this.mapKey === 'farm' && !this.tileAt('Walls', x, y) && L.plotAt(this.state, x, y) >= 0);
  };

  var renderYard = P.renderYard;
  P.renderYard = function () {
    renderYard.call(this);
    var self = this;
    this.state.yard.items.forEach(function (it, i) {
      if (L.isPlot(it.t) && self.yardSprites[i]) self.yardSprites[i].setDepth(DEPTH.Ground + 0.4); // under the tilled soil
    });
    this.farm2Bubbles();
  };

  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    this.bubbles2 = {}; // (a restarted scene keeps its properties, not its pictures)
    this.helping = false;
    buildObjects.call(this);
    if (this.mapKey !== 'farm') return;
    var self = this;
    this.time.addEvent({ delay: 3000, loop: true, callback: function () { self.farm2Bubbles(); } }); // (on a visit: the trees only)
  };

  // A fruit tree shows its fruit only while it is ripe (owner, 29 Oct: picked trees still had fruit), on a visit too.
  P.treeLooks = function () {
    var self = this, s = this.state, now = L.nowMin();
    if (!this.yardSprites) return;
    s.yard.items.forEach(function (it, i) {
      var type = OD.types[it.t], sp = self.yardSprites[i], st = type.hd && sp && L.treeOf(it.t) && L.treeState(s, it, now);
      if (!st) return;
      var look = F.ensureTexture(self, 'props/' + type.hd + (st.ripe ? '' : '_bare'));
      if (sp.texture.key !== look) sp.setTexture(look).setDisplaySize(type.w * T, type.h * T);
    });
  };

  // A bubble over every workshop with something ready and every tree with ripe fruit.
  P.farm2Bubbles = function () {
    var self = this, s = this.state, want = {};
    this.treeLooks();
    if (!this.yardSprites || !this.bubbles2 || visiting(this)) return;
    var now = L.nowMin();
    s.yard.items.forEach(function (it) {
      var type = OD.types[it.t], icon = null;
      if (C.WORKSHOPS[type.key] && L.jobsReady(s, type.key, now)) icon = C.ITEMS[C.WORKSHOPS[type.key].recipes[s.ws[type.key][0][0]].out].icon;
      var st = L.treeOf(it.t) && L.treeState(s, it, now);
      if (st && st.ripe) icon = C.ITEMS[st.tree.fruit].icon;
      if (icon == null) return;
      var k = it.x + ',' + it.y;
      want[k] = 1;
      var b = self.bubbles2[k];
      if (b && b.icon === icon) return;
      if (b) { b.bg.destroy(); b.img.destroy(); }
      var x = (it.x + type.w / 2) * T, y = it.y * T + (L.treeOf(it.t) ? 0.3 * T : 0.1 * T);
      b = self.bubbles2[k] = { icon: icon, bg: self.add.image(x, y, 'items', C.ICON.bubble).setScale(1.5).setDepth(DEPTH.Above + 1), img: self.add.image(x, y - 9, 'items', icon).setScale(0.95).setDepth(DEPTH.Above + 2) };
      self.tweens.add({ targets: [b.bg, b.img], y: '-=18', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    Object.keys(this.bubbles2).forEach(function (k) {
      if (want[k]) return;
      self.bubbles2[k].bg.destroy();
      self.bubbles2[k].img.destroy();
      delete self.bubbles2[k];
    });
  };

  // The yard piece (a workshop or a fruit tree) covering a tile, as its index, or -1.
  P.pieceAt = function (x, y) {
    var items = this.state.yard.items;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], type = OD.types[it.t];
      if (!C.WORKSHOPS[type.key] && !L.treeOf(it.t)) continue;
      if (x >= it.x && x < it.x + type.w && y >= it.y && y < it.y + type.h) return i;
    }
    return -1;
  };

  // ---------- the action button ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mapKey === 'farm') {
      var t = this.facing(), a = visiting(this) ? this.helpAction(t) : this.farm2Action(t);
      if (a) return a;
    }
    return resolve.call(this);
  };

  P.farm2Action = function (t) {
    var self = this, s = this.state, i = this.pieceAt(t.x, t.y);
    if (i < 0) return null;
    var it = s.yard.items[i], type = OD.types[it.t], w = C.WORKSHOPS[type.key];
    if (w) {
      var ready = L.jobsReady(s, type.key);
      if (ready) return { label: 'Collect', icon: C.ITEMS[w.recipes[s.ws[type.key][0][0]].out].icon, run: function () { self.collectWorkshop(type.key, it); } };
      return { label: 'Open', icon: C.ITEMS[w.recipes[0].out].icon, run: function () { F.ui.openWorkshop(type.key, 0); } };
    }
    var st = L.treeState(s, it), fruit = C.ITEMS[st.tree.fruit];
    if (st.ripe) return { label: 'Pick', icon: fruit.icon, run: function () { self.pickFruit(i); } };
    var when = st.inSeason ? fruit.plural.charAt(0).toUpperCase() + fruit.plural.slice(1) + ' in ' + L.formatLeft(st.left) + '.' : type.name + 's fruit in ' + st.tree.seasons.map(L.seasonName).join(' and ') + '.';
    return { label: 'Growing', icon: fruit.icon, disabled: true, why: when };
  };

  P.collectWorkshop = function (key, it) {
    var got = L.collectJobs(this.state, key);
    if (got === '!full') { sfx('nope'); return F.ui.toast('Your bag is full!'); }
    if (typeof got === 'string') return F.ui.openWorkshop(key, 0);
    var self = this, type = OD.types[it.t];
    sfx('harvest');
    got.slice(0, 3).forEach(function (id, k) {
      self.time.delayedCall(k * 120, function () { self.flyItem((it.x + type.w / 2) * T, (it.y + 0.5) * T, C.ITEMS[id].icon); });
    });
    this.floatTextAt((it.x + type.w / 2) * T, it.y * T, '+' + got.length);
    var tip = L.takeTip(this.state, 'goods');
    if (tip) F.ui.toast(tip, 4500);
    this.changed();
    this.save();
    this.farm2Bubbles();
  };

  P.pickFruit = function (i) {
    var s = this.state, it = s.yard.items[i], type = OD.types[it.t], got = L.pickTree(s, i);
    if (got === '!full') { sfx('nope'); return F.ui.toast('Your bag is full!'); }
    if (got[0] === '!') return;
    sfx('harvest');
    var self = this, n = L.treeOf(it.t).n;
    for (var k = 0; k < n; k++) {
      (function (k) { self.time.delayedCall(k * 110, function () { self.flyItem((it.x + 0.5 + k * 0.5) * T, (it.y + 1) * T, C.ITEMS[got].icon); }); })(k);
    }
    this.floatTextAt((it.x + type.w / 2) * T, it.y * T, '+' + n);
    this.progress('harvest', n);
    var tip = L.takeTip(s, 'fruit');
    if (tip) F.ui.toast(tip, 4500);
    this.changed();
    this.save();
    this.farm2Bubbles();
  };

  // Harvesting: mastery stars and the extra crops they give.
  var harvest = P.harvest;
  P.harvest = function (t, idx) {
    L.takeNotes();
    harvest.call(this, t, idx);
    var self = this, notes = L.takeNotes(), extra = notes.filter(function (n) { return n.kind === 'extra'; });
    if (extra.length) {
      this.time.delayedCall(260, function () { self.floatTextAt((t.x + 0.5) * T, (t.y - 0.6) * T, '+' + extra.length + ' bonus'); });
      this.flyTile(t, C.ITEMS[extra[0].item].icon);
    }
    notes.filter(function (n) { return n.kind === 'star'; }).forEach(function (n) {
      sfx('fanfare');
      var name = C.MASTERY.names[n.level - 1];
      F.ui.toast(name.toUpperCase() + ' STAR! ' + cropName(n.crop) + ' mastery ' + stars(n.level) + '\n' +
        Math.round(C.MASTERY.extra[n.level - 1] * 100) + '% of ' + cropName(n.crop).toLowerCase() + ' harvests now give one more.', 4500, 0x7a4d12);
    });
  };

  // Welcome: the one-time page about what's new, once the farm is quiet.
  var create = P.create;
  P.create = function () {
    create.call(this);
    if (this.mapKey !== 'farm' || visiting(this) || (window.gameHost && window.gameHost.quiet)) return; // (quiet: the tests)
    var self = this;
    var show = function () {
      if (!self.sys || !self.sys.isActive() || self.busy) return;
      if (!F.ui || F.ui.modals.length || F.session.visit) return self.time.delayedCall(2000, show);
      if (!L.takeTip(self.state, 'farm2')) return;
      self.save();
      F.ui.newOnFarm();
    };
    this.time.delayedCall(2500, show);
  };

  // ---------- helping a friend (on their farm) ----------
  var O = F.Online;
  O.helped = {}; // host -> tiles you may still water there today (as the server last said)
  P.helpAction = function (t) {
    var v = F.session.visit, self = this;
    if (!v || !v.friend || !O.on || O.helpOff) return null;
    var idx = this.idx(t.x, t.y), soil = this.state.soil[idx];
    if (!soil || !soil.c || soil.w || L.cropStage(soil) >= 3) return null;
    if (O.helped[v.host] === 0) return { label: 'Water', icon: C.ICON.can, disabled: true, why: 'You helped water ' + C.HELP.tiles + ' of ' + v.name + "'s crops today. Thank you!" };
    return { label: 'Water', icon: C.ICON.can, run: function () { self.helpWater(t, idx); } };
  };

  P.helpWater = function (t, idx) {
    var self = this, v = F.session.visit;
    if (this.helping || !L.helpWater(this.state, idx)) return;
    this.helping = true;
    sfx('water');
    this.refreshTile(idx);
    this.wiggle(idx);
    var undo = function () { var tl = self.state.soil[idx]; if (tl) tl.w = 0; if (self.sys.isActive()) self.refreshTile(idx); };
    F.Net.rpc('farm_help_v1', { p_host: v.host, p_tile: idx }).then(function (r) {
      self.helping = false;
      if (F.session.visit !== v) return;
      if (r && r.ok) {
        O.helped[v.host] = Math.max(0, Number(r.left) || 0);
        var s = F.session.state; // your own farm, not the one you are on
        s.gold += C.HELP.gold;
        F.Host.save(s);
        F.bus.emit('hud');
        sfx('coin');
        self.floatTextAt((t.x + 0.5) * T, t.y * T, '+' + C.HELP.gold + 'G');
        O.send('help', {});
        if (O.helped[v.host] === 0) F.ui.toast('That was your 5th today. ' + v.name + ' will be glad!', 2600, 0x2f5a22);
        return;
      }
      undo();
      var code = r && r.code;
      if (code === 'limit') { O.helped[v.host] = 0; F.ui.toast(Number(r.left) === 0 ? 'You helped enough for today. Thank you!' : 'You helped a lot of farms today! Come back tomorrow.'); } else if (code === 'friends') F.ui.toast('Only friends can help on a farm.');
      else if (code === 'done') F.ui.toast('Already watered today.');
      else F.ui.toast('Could not help right now. Try again in a moment.');
    }).catch(function (e) {
      self.helping = false;
      undo();
      if (/Could not find the function/i.test((e && e.message) || '')) { O.helpOff = true; return F.ui.toast('Helping friends opens soon!'); }
      F.ui.toast('Could not reach the online world. Check your connection.');
    });
  };

  // At home: the crops friends watered for you (taken once).
  O.claimHelps = function () {
    if (!O.on || O.helpOff || O.claimingHelps || F.session.visit) return Promise.resolve(0);
    O.claimingHelps = true;
    return F.Net.rpc('farm_helps_v1', {}).then(function (r) {
      O.claimingHelps = false;
      var tiles = r && Array.isArray(r.tiles) ? r.tiles : [];
      if (!tiles.length || F.session.visit) return 0;
      var s = F.session.state, n = L.applyHelp(s, tiles);
      var from = (Array.isArray(r.from) ? r.from : []).map(function (x) { return L.cleanText(x, 24); }).filter(Boolean);
      F.Host.save(s);
      var w = F.world;
      if (w && w.mapKey === 'farm' && !visiting(w) && w.refreshAllSoil) w.refreshAllSoil();
      if (F.ui) F.ui.toast((from.length ? from.slice(0, 3).join(', ') + (from.length > 3 ? ' and more' : '') : 'Friends') + ' watered ' +
        (n ? n + ' of your crops' : 'your farm') + '! They are growing now.', 3600, 0x2f5a22);
      return n;
    }, function (e) {
      O.claimingHelps = false;
      if (/Could not find the function/i.test((e && e.message) || '')) O.helpOff = true;
      return 0;
    });
  };
  var collect = O.collect;
  O.collect = function (auto) {
    return collect.call(O, auto).then(function (got) { O.claimHelps().catch(noop); return got; });
  };
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event === 'help' && !F.session.visit && payload && O.others[payload.id]) { O.claimHelps().catch(noop); return; }
    onMessage.call(O, event, payload);
  };

  // ---------- the UI ----------
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0xe9a91c;
  var U = F.UIScene.prototype;

  U.openWorkshop = function (key, page) {
    var self = this, s = F.session.state, w = C.WORKSHOPS[key], now = L.nowMin(), jobs = L.jobs(s, key);
    var rows = w.recipes.map(function (rec, r) {
      var out = C.ITEMS[rec.out], can = L.canMake(s, key, r), full = jobs.length >= w.slots;
      var needs = rec.needs.map(function (e) { return e[1] + ' ' + L.ingredientName(e[0]) + ' (' + L.countNeed(s, e[0]) + ')'; }).join(', ');
      return {
        icon: out.icon, name: out.name,
        desc: needs + '\n' + L.formatLeft(rec.mins) + '. Sells for ' + out.sell + 'G.',
        buttons: [{
          label: 'Make', color: can && !full ? GREEN : GREY, cb: function () {
            var res = L.startJob(s, key, r);
            if (res === 'full') { sfx('nope'); return self.toast('The ' + w.name + ' is busy: ' + w.slots + ' in line already. Collect or wait.'); }
            if (res === 'missing') { sfx('nope'); return self.toast('You need ' + needs.replace(/ \(\d+\)/g, '') + '.'); }
            if (res !== 'ok') { sfx('nope'); return self.toast('Place the ' + w.name + ' in your yard first.'); }
            sfx('cook');
            F.world.changed();
            F.world.save();
            self.closeModal();
            self.openWorkshop(key, page);
          },
        }].concat(can || !O.on || !self.openFind ? [] : [{
          // the Market: who sells what's missing (19l-market.js)
          label: 'Find', color: BLUE, cb: function () {
            var need = rec.needs.filter(function (e) { return L.countNeed(s, e[0]) < e[1]; })[0];
            self.closeModal();
            self.openFind(L.ingredientItems(need[0])[0], function () { self.openWorkshop(key, page); });
          },
        }]),
      };
    });
    var line = function () {
      var t = L.nowMin(), list = L.jobs(s, key);
      if (!list.length) return 'Nothing in the line. Pick something to make (' + w.slots + ' at a time).';
      return list.map(function (j, k) {
        var name = C.ITEMS[w.recipes[j[0]].out].name;
        if (j[1] <= t) return name + ': ready!';
        return name + ': ' + (k === 0 || list[k - 1][1] <= t ? L.formatLeft(j[1] - t) : 'next');
      }).join('   ');
    };
    var ready = L.jobsReady(s, key, now);
    this.listPanel({
      title: w.name, rows: rows, page: page,
      reopen: function (tab, p) { self.openWorkshop(key, p); },
      sub: line,
      corner: ready ? { label: 'Collect', color: GOLD, cb: function () {
        self.closeModal();
        var it = s.yard.items.filter(function (x) { return OD.types[x.t].key === key; })[0];
        if (it) F.world.collectWorkshop(key, it);
      } } : null,
    });
  };

  // The Crop stars list (from the Collection).
  U.openMastery = function (page) {
    var self = this, s = F.session.state;
    var keys = C.CROP_KEYS.filter(function (k) { return !C.CROPS[k].sickle; });
    keys.sort(function (a, b) { return (s.mast[b] || 0) - (s.mast[a] || 0); });
    var rows = keys.map(function (k) {
      var m = L.mastery(s, k), item = C.ITEMS[C.CROPS[k].item];
      return {
        icon: item.icon, name: item.name + '  ' + stars(m.level),
        desc: m.have + (m.have === 1 ? ' harvest' : ' harvests') + '.' + (m.next ? ' ' + C.MASTERY.names[m.level] + ' star at ' + m.next + '.' : ' Gold mastery!') +
          (m.level ? '\n' + Math.round(C.MASTERY.extra[m.level - 1] * 100) + '% chance of one more.' : ''),
      };
    });
    this.listPanel({
      title: 'Crop stars', rows: rows, page: page || 0,
      reopen: function (tab, p) { self.openMastery(p); },
      sub: function () { return 'Harvest a crop ' + C.MASTERY.needs.join(', ') + ' times for a Bronze, Silver and Gold star.'; },
      corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openCollection(); } },
    });
  };

  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.call(this);
    var self = this, c = this.modals[this.modals.length - 1].c;
    this.button(c, 64, 100, 80, 30, 'Crop stars', function () { self.closeModal(); self.openMastery(0); }, BLUE);
  };

  // What's new, once: everything the farm can do now, and where to find it.
  U.newOnFarm = function () {
    var self = this, ic = C.ICON, I = C.ITEMS;
    this.dialog('NEW ON YOUR FARM', [{ label: 'OK', cb: function () { self.toast("Buy workshops, trees and plots at Mira's Woodshop (Outdoor).", 4500, 0x2f5a22); } }], {
      rows: [
        [I.bread.icon, 'Workshops: a Bakery, a Dairy and a Jam Maker make goods while you play, or sleep.'],
        [I.mango.icon, 'Fruit trees: apples, oranges, mangoes and peaches, each in two seasons.'],
        [I.seed_wheat.icon, 'More land: Field Plots for your yard. Till and plant on them like the field.'],
        [ic.star, 'Crop stars: harvest a crop 50 times for a star and bonus crops. See them in the Collection.'],
        [ic.can, "Help friends: on a friend's farm, water 5 of their crops a day for 20G each."],
      ],
    });
  };

  // Mira's catalog: what a piece does (workshops, trees, plots), and how many you can still buy.
  F.yardInfo = function (s, i) {
    var type = OD.types[i], why = L.yardCantBuy(s, i);
    if (C.WORKSHOPS[type.key]) return C.WORKSHOPS[type.key].desc + (why ? ' You have one.' : '');
    var tree = L.treeOf(i);
    if (tree) return tree.n + ' ' + C.ITEMS[tree.fruit].plural + ' every ' + tree.hours + 'h, in ' + tree.seasons.map(L.seasonName).join(' and ') + '.';
    if (L.isPlot(i)) return '3x3 more field. ' + (why ? 'All ' + C.PLOTS.max + ' bought.' : (C.PLOTS.max - L.yardOwned(s, i)) + ' of ' + C.PLOTS.max + ' left.');
    return null;
  };

})(window.Farm = window.Farm || {});
