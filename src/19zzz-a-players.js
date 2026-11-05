// Players' ideas and reports, on screen (owner, 5 Nov 2026; content 00-zzzzzzzz-players.js, rules 01-logicZZ-players.js):
//   - a Lamp Post or Paper Lantern you place glows at night (only the town's own lamps did);
//   - what a hunted animal leaves lands where you can walk (it could fall inside a tree or a rock);
//   - "x2" over what Double Drops doubled, and a word when Double Drops starts;
//   - Craft at Mira's (Outdoor): yard pieces from your own harvest;
//   - Drop in the Bag: the stack lies on the ground 5 minutes. You can pick it up again; a friend on the same map can
//     too, and it reaches them as a gift (the server's friends-only rules and daily limits, farm_give_v1). Nothing
//     dropped is saved: closing the game or leaving the map clears what you dropped;
//   - the tours: the new ideas (the first time you open the Bag) and Double Drops (the first time it is on).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var T = C.TILE;
  var OD = C.OUTDOOR;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68;
  var GLOW_DEPTH = 31, ACTOR = 10, SHADOW = 9;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var world = function () { return F.world; };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };

  // ---------- lamps and lanterns in the yard glow at night ----------
  var LIGHTS = { lamp: 1, lantern: 1 };
  P.yardGlowsDraw = function () {
    var self = this;
    (this.yardGlows || []).forEach(function (g) { g.destroy(); });
    this.yardGlows = [];
    if (this.mapKey !== 'farm' || !this.textures.exists('fx-glow') || !this.state.yard) return;
    this.state.yard.items.forEach(function (it) {
      var type = OD.types[it.t];
      if (!type || !LIGHTS[type.prop]) return;
      var x = (it.x + type.w / 2) * T, y = (it.y + type.h) * T - type.h * T * 0.8;
      self.yardGlows.push(self.add.image(x, y, 'fx-glow').setDisplaySize(3.2 * T, 3.2 * T).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH).setAlpha(0));
    });
    if (this.nightRect) this.applyDark(this.nightRect.alpha);
  };
  var renderYard = P.renderYard;
  P.renderYard = function () {
    renderYard.apply(this, arguments);
    this.yardGlowsDraw();
  };
  var setupPolish = P.setupPolish;
  P.setupPolish = function () {
    setupPolish.apply(this, arguments);
    this.yardGlowsDraw(); // (the glow picture is made here, after the yard is first drawn)
  };
  var applyDark = P.applyDark;
  P.applyDark = function (alpha) {
    applyDark.call(this, alpha);
    var lit = Math.min(1, alpha / 0.35);
    (this.yardGlows || []).forEach(function (g) { g.setAlpha(lit * 0.85); });
  };

  // ---------- CLOSED signs only where something is closed now (the shops never close: the school, the Mayor's) ----------
  P.updateNightSigns = function () {
    var self = this, st = this.state, closed = [];
    this.objects.forEach(function (o, i) {
      var key = o.type === 'door' && o.props && o.props.building, b = key && C.BUILDINGS[key];
      if (b && b.open && L.sleepTime(st) && !L.buildingOpen(st, key)) closed.push(i);
      else if ((o.type === 'stand' || o.type === 'shop') && !L.shopOpen(st)) closed.push(i);
    });
    var sig = closed.join(',');
    if ((this.nightSig || '') === sig && (this.nightSigns || closed.length === 0)) return;
    this.nightSig = sig;
    (this.nightSigns || []).forEach(function (t) { t.destroy(); });
    this.nightSigns = closed.length ? [] : null;
    closed.forEach(function (i) {
      var o = self.objects[i];
      self.nightSigns.push(self.add.text((o.x0 + o.x1 + 1) / 2 * T, o.y0 * T + 40, 'Zzz  CLOSED', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '96px', fontStyle: 'bold', color: '#ffe9a8',
        backgroundColor: '#5a3a1e', padding: { x: 26, y: 10 },
      }).setOrigin(0.5, 1).setDepth(32));
    });
  };

  // ---------- a hunted animal's things land where you can walk ----------
  var nearestWalkable = function (sc, tx, ty) {
    for (var r = 1; r <= 3; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (sc.walkable(tx + dx, ty + dy)) return [tx + dx, ty + dy];
      }
    }
    return null;
  };
  var dropWild = P.dropWild;
  P.dropWild = function (id, x, y) {
    var tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (!this.walkable(tx, ty)) {
      var spot = nearestWalkable(this, tx, ty);
      if (spot) { x = (spot[0] + 0.5) * T; y = (spot[1] + 0.6) * T; }
    }
    return dropWild.call(this, id, x, y);
  };

  // ---------- Double Drops: "x2", and a word when it starts ----------
  var showX2 = function (sc, x, y) {
    if (!L.doubled) return;
    L.doubled = 0;
    sc.floatTextAt(x, y, 'x2 Double Drops!');
  };
  var harvest = P.harvest;
  P.harvest = function (t, idx) {
    L.doubled = 0;
    var r = harvest.apply(this, arguments);
    showX2(this, (t.x + 0.5) * T, (t.y - 1) * T);
    return r;
  };
  var pickForage = P.pickForage;
  P.pickForage = function (idx) {
    L.doubled = 0;
    var x = (idx % this.map.width + 0.5) * T, y = (Math.floor(idx / this.map.width) - 0.6) * T;
    var r = pickForage.apply(this, arguments);
    showX2(this, x, y);
    return r;
  };
  var clockText = function (ms) { var d = new Date(ms); return L.formatTime(d.getHours() * 60 + d.getMinutes()); };
  L.doubleWords = function (win) {
    return 'Double Drops until ' + clockText(win.end) + '! Crops you pick, forage, mine rocks and hunts give twice as much.';
  };
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  var update = P.update;
  P.update = function (time, dt) {
    update.call(this, time, dt);
    this.dblCheck = (this.dblCheck || 0) - (dt || 16);
    if (this.dblCheck <= 0) {
      this.dblCheck = 15000;
      var win = L.doubleNow(), ui = F.ui;
      if (win && ui && F.session.dblShown !== win.end && !this.busy && !ui.modals.length) {
        F.session.dblShown = win.end;
        if (take('double_tour')) ui.tour('double', noop);
        else ui.toast(L.doubleWords(win), 4200, 0x7a4d12);
      }
    }
    this.groundTick(dt || 16);
  };

  // ---------- Craft at Mira's ----------
  var needsText = function (s, r) {
    return r.needs.map(function (n) {
      var name = n[0] === 'lumber' ? 'Lumber' : n[0] === 'stone' ? 'Stone' : L.itemName(s, n[0]);
      var have = n[0] === 'lumber' || n[0] === 'stone' ? s[n[0]] : L.countItem(s, n[0]);
      return n[1] + ' ' + name + ' (' + Math.min(have, 999) + ')';
    }).join(', ');
  };
  U.openCraft = function (page) {
    var self = this, s = F.session.state;
    var rows = C.CRAFT.map(function (r) {
      var t = OD.index[r.key], type = OD.types[t], missing = L.craftMissing(s, r.key);
      return {
        img: self.yardImg(t), name: type.name,
        desc: 'Needs ' + needsText(s, r) + '. +' + type.beauty + ' beauty.' + (s.yard.bag[t] ? ' You have ' + s.yard.bag[t] + '.' : ''),
        buttons: [{
          label: 'Craft', color: missing.length ? GREY : GREEN, cb: function () {
            var why = L.craftMissing(s, r.key);
            if (why.length) {
              sfx('nope');
              return self.toast('You need ' + why.map(function (n) { return n[1] + ' more ' + (n[0] === 'lumber' ? 'Lumber' : n[0] === 'stone' ? 'Stone' : L.itemName(s, n[0])); }).join(' and ') + '.');
            }
            if (L.craft(s, r.key) !== 'ok') return;
            sfx('hammer');
            world().changed();
            world().save();
            self.closeModal();
            self.openCraft(page);
            self.toast(type.name + ' made! It is in your yard storage. Place it with Decorate.');
          },
        }],
      };
    });
    return this.listPanel({
      title: 'Craft it yourself', tab: 'outdoor', page: page || 0, rows: rows,
      reopen: function (tab, p) { self.openCraft(p); },
      sub: function () { return 'Grow the flowers, cotton and wheat; Mira helps you make the piece.'; },
      corner: { label: 'Back', color: GREY, cb: function () { self.closeModal(); self.openOutdoor(null, 0); } },
    });
  };
  F.craftRow = function (ui) {
    var first = OD.index[C.CRAFT[0].key];
    return {
      img: ui.yardImg(first), name: 'Craft it yourself', desc: 'Make flower beds, hedges, a scarecrow and more from your own harvest, for no gold.',
      buttons: [{ label: 'See all', color: BLUE, cb: function () { ui.closeModal(); ui.openCraft(0); } }],
    };
  };

  // ---------- dropping things on the ground ----------
  // F.ground: what is lying on this phone's maps. mine: { k, id, n, q, map, fl, x, y, until }; theirs: by owner id + k.
  var G = F.ground = { mine: [], theirs: {}, next: 1, asked: {} };
  var floorNow = function () { return O && O.floorHere ? O.floorHere(world() ? world().mapKey : 'farm') : 0; };
  var online = function () { return !!(O && O.on && O.me && O.chan); };
  var here = function (d) { var w = world(); return w && d.map === w.mapKey && (d.fl || 0) === (floorNow() || 0); };
  var tellDrops = function () {
    if (!online()) return;
    var now = Date.now();
    O.send('drs', { list: G.mine.map(function (d) { return [d.k, d.id, d.n, d.map, d.fl || 0, Math.round(d.x), Math.round(d.y), Math.max(0, d.until - now)]; }) });
  };
  P.dropOnGround = function (slot, n) {
    var s = F.session.state, it = s.inv[slot];
    if (!it || !L.canDrop(s, slot)) return;
    if (G.mine.length >= C.DROP.most) return F.ui.toast('You have ' + C.DROP.most + ' things on the ground already. Pick one up first.');
    var id = it.id, q = it.q || 0, took = L.removeAt(s, slot, n);
    if (!took) return;
    var f = this.feet(), fr = this.front(0.6);
    var d = { k: G.next++, id: id, n: took, q: q, map: this.mapKey, fl: floorNow() || 0, x: fr.x, y: fr.y, until: Date.now() + C.DROP.mins * 60000 };
    if (!this.walkable(Math.floor(d.x / T), Math.floor(d.y / T))) { d.x = f.x; d.y = f.y + 0.2 * T; }
    d.away = 1; // (you are standing on it: it waits until you step off)
    G.mine.push(d);
    sfx('pick');
    this.drawGround();
    this.changed();
    this.save();
    tellDrops();
    F.ui.toast('You dropped ' + (took > 1 ? took + ' ' : 'your ') + L.itemName(s, id) + (took > 1 ? '. They disappear in ' : '. It disappears in ') + C.DROP.mins + ' minutes. A friend here can pick it up.', 3200);
  };
  // Draws what lies on this map, and forgets what is gone.
  P.drawGround = function () {
    var self = this, keep = {};
    this.groundImgs = this.groundImgs || {};
    var list = G.mine.filter(here).map(function (d) { return { key: 'm' + d.k, d: d }; });
    Object.keys(G.theirs).forEach(function (k) { if (here(G.theirs[k])) list.push({ key: 't' + k, d: G.theirs[k] }); });
    list.forEach(function (e) {
      keep[e.key] = 1;
      if (self.groundImgs[e.key]) return;
      var d = e.d, img = self.add.image(d.x, d.y - 0.3 * T, 'items', L.iconOf(F.session.state, d.id)).setScale(1.2).setDepth(ACTOR + d.y / 1e5);
      if (!self.textures.exists('fx-wildshadow')) { var c = self.textures.createCanvas('fx-wildshadow', 64, 20), g = c.getContext(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(32, 10, 30, 8, 0, 0, Math.PI * 2); g.fill(); c.refresh(); }
      var sh = self.add.image(d.x, d.y - 0.04 * T, 'fx-wildshadow').setDisplaySize(0.62 * T, 0.2 * T).setDepth(SHADOW);
      self.tweens.add({ targets: img, y: d.y - 0.42 * T, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      self.groundImgs[e.key] = { img: img, sh: sh };
    });
    Object.keys(this.groundImgs).forEach(function (k) {
      if (keep[k]) return;
      var o = self.groundImgs[k];
      self.tweens.killTweensOf(o.img);
      o.img.destroy();
      o.sh.destroy();
      delete self.groundImgs[k];
    });
  };
  var giveBack = function (s, d) {
    var left = d.q && L.addItemQ ? L.addItemQ(s, d.id, d.n, d.q) : L.addItem(s, d.id, d.n);
    if (left) s.basket[d.id] = Math.min(999, (s.basket[d.id] || 0) + left);
    return left;
  };
  P.groundTick = function (dt) {
    this.groundMs = (this.groundMs || 0) - dt;
    if (this.groundMs > 0 || !this.player) return;
    this.groundMs = 250;
    var self = this, s = F.session.state, now = Date.now(), f = this.feet(), changed = false;
    var near = function (d) { return Math.hypot(d.x - f.x, d.y - f.y) < 0.6 * T; };
    // gone after their minutes
    var before = G.mine.length;
    G.mine = G.mine.filter(function (d) { return d.until > now; });
    if (G.mine.length !== before) { changed = true; tellDrops(); }
    Object.keys(G.theirs).forEach(function (k) { if (G.theirs[k].until <= now || !O.others[G.theirs[k].owner]) { delete G.theirs[k]; changed = true; } });
    if (!this.busy) {
      // yours: step off it, then walk onto it again to pick it up
      G.mine.forEach(function (d) {
        if (!here(d)) return;
        if (d.away) { if (Math.hypot(d.x - f.x, d.y - f.y) > 1.3 * T) d.away = 0; return; } // (clearly stepped off it first)
        if (!near(d)) return;
        if (!L.canAdd(s, d.id, d.n)) { if (!self.saidGroundFull) { self.saidGroundFull = true; F.ui.toast('Your bag is full! Make room to pick it up.'); } return; }
        giveBack(s, d);
        d.gone = 1;
        self.iconPop(d.x, d.y - 0.3 * T, L.iconOf(s, d.id));
        sfx('pick');
        changed = true;
      });
      if (G.mine.some(function (d) { return d.gone; })) { G.mine = G.mine.filter(function (d) { return !d.gone; }); self.changed(); tellDrops(); }
      // a friend's: ask them for it (it comes as their gift)
      Object.keys(G.theirs).forEach(function (k) {
        var d = G.theirs[k];
        if (!here(d) || !near(d) || (G.asked[k] && now - G.asked[k] < 4000) || !online()) return;
        G.asked[k] = now;
        O.send('drt', { to: d.owner, k: d.k });
      });
    }
    void changed;
    this.drawGround();
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    this.groundImgs = {};
    if (this.player) this.drawGround();
  };
  // Leaving the map or the game: what you dropped on it is gone.
  var travel = P.travel;
  P.travel = function () {
    var w = this, had = G.mine.length;
    G.mine = G.mine.filter(function (d) { return d.map !== w.mapKey; });
    if (had !== G.mine.length) tellDrops();
    return travel.apply(this, arguments);
  };

  // ---------- online: what friends dropped, and taking it ----------
  if (O) {
    var onMessage = O.onMessage;
    O.onMessage = function (event, payload) {
      var p = payload && typeof payload === 'object' ? payload : {}, who = typeof p.id === 'string' ? O.others[p.id] : null;
      if (event === 'drs' && who) {
        Object.keys(G.theirs).forEach(function (k) { if (G.theirs[k].owner === who.id) delete G.theirs[k]; });
        (Array.isArray(p.list) ? p.list : []).slice(0, C.DROP.most).forEach(function (e) {
          if (!Array.isArray(e) || !C.ITEMS[e[1]] || C.ITEMS[e[1]].kind === 'tool') return;
          var k = Math.floor(Number(e[0])) || 0, left = Math.max(0, Math.min(C.DROP.mins * 60000, Number(e[7]) || 0));
          if (!k || !left) return;
          G.theirs[who.id + ':' + k] = { owner: who.id, k: k, id: e[1], n: Math.max(1, Math.min(99, Math.floor(Number(e[2])) || 1)), map: String(e[3]), fl: Math.floor(Number(e[4])) || 0, x: Number(e[5]) || 0, y: Number(e[6]) || 0, until: Date.now() + left };
        });
        if (world()) world().drawGround();
        return;
      }
      if (event === 'drt' && who && O.me && p.to === O.me.id) { O.dropTaken(who, Math.floor(Number(p.k)) || 0); return; }
      onMessage.call(O, event, payload);
    };
    // A friend walked onto something you dropped: it goes to them as a gift; if the server says no, it stays.
    O.dropTaken = function (who, k) {
      var d = G.mine.filter(function (x) { return x.k === k; })[0];
      if (!d || d.taking) return;
      d.taking = 1;
      F.Net.rpc('farm_give_v1', { p_to: who.id, p_item: d.id, p_n: d.n }).then(function (r) {
        d.taking = 0;
        if (!(r && r.ok)) return;
        G.mine = G.mine.filter(function (x) { return x !== d; });
        tellDrops();
        O.send('give', { to: who.id });
        F.Host.save(F.session.state);
        if (world()) world().drawGround();
        if (F.ui) F.ui.toast(who.name + ' picked up your ' + L.itemName(F.session.state, d.id) + '.', 2400, 0x2f5a22);
      }, function () { d.taking = 0; });
    };
    // every 20 s, so a friend who just came sees it too
    setInterval(function () { if (G.mine.length) tellDrops(); }, 20000);
  }

  // ---------- the Bag: Drop ----------
  U.askDrop = function () {
    var self = this, s = F.session.state, slot = s.sel, it = s.inv[slot];
    if (!it || !L.canDrop(s, slot)) return this.toast(it ? 'Tools stay in your bag.' : 'Hold something to drop it.');
    var name = L.itemName(s, it.id), buttons = [{ label: 'Cancel', color: GREY }, { label: 'Drop 1', cb: function () { self.closeModal(); world().dropOnGround(slot, 1); } }];
    if (it.n > 1) buttons.push({ label: 'Drop ' + it.n, color: BLUE, cb: function () { self.closeModal(); world().dropOnGround(slot, it.n); } });
    this.dialog('DROP IT?\nPut your ' + name + (it.n > 1 ? ' (you have ' + it.n + ')' : '') + ' on the ground? It disappears in ' + C.DROP.mins + ' minutes. Walk onto it to pick it up again, or a friend here can take it.', buttons);
  };
  var openInventory = U.openInventory;
  U.openInventory = function () {
    var self = this;
    if (take('players_tour')) return this.tour('players', function () { self.openInventory(); });
    return openInventory.apply(this, arguments);
  };

  // ---------- the tours ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.players = {
    title: 'NEW: YOUR IDEAS',
    steps: [
      {
        text: 'You asked, we listened! Every shop in town now stays open all night.',
        draw: function (ui, sc, move) {
          var moon = words(ui, sc, 90, 60, '24 h', 26, '#7a4d12');
          icon(ui, sc, 190, 62, C.ICON.crate, 0.4);
          tw(ui, move, { targets: moon, scale: 1.15, duration: 600, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Animals don\'t wait for morning any more: a fed chicken lays 8 hours later, and a cow, pig or carabao gives 12 hours later. Feed them again for the next one!',
        draw: function (ui, sc, move) {
          var egg = icon(ui, sc, 100, 60, C.ITEMS.egg.icon, 0.34), milk = icon(ui, sc, 180, 60, C.ITEMS.milk.icon, 0.34);
          words(ui, sc, 100, 102, '8 h', 14);
          words(ui, sc, 180, 102, '12 h', 14);
          tw(ui, move, { targets: [egg, milk], y: 52, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Mira now works on two jobs at once: a building and a house upgrade, or two buildings.',
        draw: function (ui, sc, move) {
          [100, 180].forEach(function (x, n) {
            var h = icon(ui, sc, x, 62, C.ICON.crate, 0.36);
            tw(ui, move, { targets: h, y: 54, duration: 420, delay: n * 210, yoyo: true, repeat: -1 });
          });
          words(ui, sc, 140, 108, '1 + 1', 16);
        },
      },
      {
        text: 'New seeds at Lily\'s: Rose, Sampaguita, Gumamela, Cotton, Sugarcane, Cacao and Oregano.',
        draw: function (ui, sc, move) {
          C.NEW_CROPS.forEach(function (k, n) {
            var i = icon(ui, sc, 34 + n * 36, 62 + (n % 2) * 14, C.ITEMS[k].icon, 0.26);
            tw(ui, move, { targets: i, y: i.y - 8, duration: 500, delay: n * 120, yoyo: true, repeat: -1 });
          });
        },
      },
      {
        text: 'Grow them, then craft flower beds, hedges, a scarecrow and more at Mira\'s (Outdoor, Craft it yourself). The Bakery makes Sikwate and Chocolate Cake.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 60, C.ITEMS.rose.icon, 0.3);
          icon(ui, sc, 110, 60, C.ITEMS.gumamela.icon, 0.3);
          words(ui, sc, 156, 60, '=', 22);
          var img = F.yardImg(ui, OD.index.flower_bed), bed = ui.add.image(214, 62, img.key, img.frame).setDisplaySize(70, 70);
          sc.add(bed);
          tw(ui, move, { targets: bed, scale: bed.scale * 1.1, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Don\'t need something? Hold it and tap Drop in your Bag. It lies on the ground 5 minutes, and a friend with you can pick it up.',
        draw: function (ui, sc, move) {
          var i = icon(ui, sc, 136, 30, C.ITEMS.cotton.icon, 0.3);
          tw(ui, move, { targets: i, y: 82, duration: 700, ease: 'Bounce.out', repeat: -1, repeatDelay: 600 });
          words(ui, sc, 136, 112, '5:00', 14, '#7a5a3a');
        },
      },
    ],
  };
  F.TOURS.double = {
    title: 'DOUBLE DROPS',
    steps: [
      {
        text: 'Every Wednesday and Saturday, 12 to 1 PM and 8 to 10 PM: Double Drops!',
        draw: function (ui, sc, move) {
          var x2 = words(ui, sc, 136, 62, 'x2', 40, '#a8740c');
          tw(ui, move, { targets: x2, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Crops you pick, forage, mine rocks and what a hunted animal leaves: you get twice as much.',
        draw: function (ui, sc, move) {
          [C.ITEMS.tomato.icon, C.ITEMS.ore_copper.icon, C.ITEMS.meat_boar ? C.ITEMS.meat_boar.icon : C.ICON.crate].forEach(function (f, n) {
            var a = icon(ui, sc, 70 + n * 66, 52, f, 0.28), b = icon(ui, sc, 86 + n * 66, 66, f, 0.28);
            tw(ui, move, { targets: b, alpha: 0.3, duration: 500, delay: n * 200, yoyo: true, repeat: -1 });
            void a;
          });
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
