// Farmhands on screen (rules 01-logicZ-farmhands.js, content 00-zzzzzzz-farmhands.js): hiring them at the Sunny Inn (a
// Farmhands tab), seeing them on the farm (they come up the road at 6 AM, wait by the field, walk to each job and do it:
// a splash, a crop into the basket, a fed hen; at 9 PM they go home), talking to one while they wait, their line in the
// morning report, the first-time tour and the basket's own words for them.
// Their pictures are stand-ins cut from the visitors in the people sheet until art-src/FARMHANDS-PROMPTS.md is drawn:
// a 'farmhands' sheet (9 frames of 128 x 192 for each, in C.FH_KEYS order) replaces them when it is in the assets.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, RED = 0xc0503a;
  var SPEED = 640; // world units a second (a little brisker than the villagers)
  var ACT = 650; // ms spent on each job
  var QUEUE = 16; // more jobs than this waiting: the rest are simply done
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };
  // where each waits between jobs (tiles), and the road they come up from town
  var REST = { andoy: [12.6, 8.7], lucing: [11.3, 8.7], berto: [12, 31.7], kiko: [14, 8.7] }; // (near the field's gate, Berto by the pen)
  var ROAD = [11.5, 37.4];

  // ---------- their pictures ----------
  F.fhTexture = function (scene) {
    var tex = scene.textures;
    if (tex.exists('farmhands')) return 'farmhands';
    var cut = F.images.fh_standin; // (the stand-ins below, cut at build time: tools/art/cut-sheets.js)
    if (F.images.farmhands || cut) {
      var bmp = !F.images.farmhands && F.bitmaps && F.bitmaps.fh_standin; // decoded off the main thread at boot (20-main.js)
      tex.addSpriteSheet('farmhands', bmp || F.images.farmhands || cut, { frameWidth: 128, frameHeight: 192 });
      if (bmp) {
        var one = tex.get('farmhands').source[0];
        one.image = cut; // (kept for a GPU context restore)
        if (one.glTexture) one.glTexture.pixels = cut;
        bmp.close();
        delete F.bitmaps.fh_standin;
      }
    } else {
      // stand-ins: each one's 9 frames from a visitor in the people sheet (128 x 192, margin 8, spacing 16: 10-boot.js)
      var src = F.images.people, cols = Math.floor((src.width + 8) / 144), n = C.VILLAGER_ORDER.length;
      var faces = C.SHOPPERS.map(function (x) { return x.key; });
      var c = tex.createCanvas('farmhands', 9 * 128, C.FH_KEYS.length * 192), g = c.getContext();
      C.FH_KEYS.forEach(function (key, r) {
        var base = (n + Math.max(0, faces.indexOf(C.FARMHANDS[key].face))) * 9;
        for (var k = 0; k < 9; k++) {
          var f = base + k;
          g.drawImage(src, 8 + (f % cols) * 144, 8 + Math.floor(f / cols) * 208, 128, 192, k * 128, r * 192, 128, 192);
          c.add(r * 9 + k, 0, k * 128, r * 192, 128, 192);
        }
      });
      c.refresh();
    }
    C.FH_KEYS.forEach(function (key, r) {
      ['down', 'up', 'side'].forEach(function (d, j) {
        var name = 'fh-' + key + '-' + d, f = r * 9 + j * 3;
        if (scene.anims.exists(name)) return;
        scene.anims.create({ key: name, frames: [f + 1, f, f + 2, f].map(function (x) { return { key: 'farmhands', frame: x }; }), frameRate: 7, repeat: -1 });
      });
    });
    return 'farmhands';
  };
  var row = function (key) { return C.FH_KEYS.indexOf(key); };

  // ---------- on the farm ----------
  var mine = function (w) { return w.mapKey === 'farm' && !(w.state && w.state.isVisit); };

  var create = P.create;
  P.create = function () {
    create.call(this);
    this.fh = null;
    L.fhTakeRecent(); // (done before you came: the field already shows it)
    if (!mine(this)) return;
    this.fh = { hands: {}, hold: {}, walker: { scene: this }, syncMs: 0 };
    this.fhSync(true);
  };

  // Who should be on the farm now: hired, and in work hours. New ones walk up the road (or are already there when
  // you arrive); the ones done for the day, or let go, walk off.
  P.fhSync = function (arriving) {
    var self = this, s = this.state, at = L.fhAtWork(s.time);
    C.FH_KEYS.forEach(function (key) {
      var h = self.fh.hands[key], want = at && L.fhHired(s, key);
      if (want && !h) {
        h = self.fhAdd(key, arriving ? REST[key] : ROAD);
        if (!arriving) self.fhGo(h, REST[key], 'down');
      } else if (!want && h && !h.leaving) {
        h.leaving = true;
        var rest = h.queue.concat(h.job ? [h.job] : []);
        h.queue = [];
        h.job = null;
        rest.forEach(function (j) { self.fhFinish(h, j, true); });
        self.fhGo(h, ROAD, 'down');
      }
    });
  };

  P.fhAdd = function (key, tile) {
    var x = tile[0] * T, y = tile[1] * T;
    var spr = this.add.sprite(x, y, F.fhTexture(this), row(key) * 9).setOrigin(0.5, 0.83).setScale(2);
    var h = { key: key, def: C.FARMHANDS[key], sprite: spr, x: x, y: y, dir: 'down', path: [], queue: [], job: null, wait: 0, leaving: false };
    this.fh.hands[key] = h;
    this.fhStand(h);
    F.depthTo(spr, DEPTH.actor + y / 1e5);
    return h;
  };

  P.fhStand = function (h) {
    h.sprite.anims.stop();
    h.sprite.setFrame(row(h.key) * 9 + (h.dir === 'up' ? 3 : h.dir === 'down' ? 0 : 6)).setFlipX(h.dir === 'right');
  };

  // A walk to a tile (x, y in tiles, at the feet), facing `face` at the end.
  P.fhGo = function (h, tile, face) {
    var x1 = tile[0] * T, y1 = tile[1] * T;
    h.path = F.Villagers.prototype.route.call(this.fh.walker, h.x, h.y, x1, y1);
    h.face = face;
  };

  // Where to stand for a job, and which way to face: [tile x, tile y, dir].
  P.fhSpot = function (j) {
    var s = this.state, Wd = this.map.width;
    if (j.idx != null) {
      var x = j.idx % Wd, y = Math.floor(j.idx / Wd);
      return [x + 0.5, y + 1.62, 'up']; // just below the crop, facing it, like the farmer
    }
    if (j.job === 'animals') {
      var m = this.herd && this.herd.members.filter(function (mm) { return mm.i === j.i; })[0];
      if (m) return [(m.x + 0.75 * T) / T, m.y / T, 'left'];
      return null;
    }
    if (j.job === 'fruit') {
      var it = s.yard.items[j.i], type = it && C.OUTDOOR.types[it.t];
      if (it) return [it.x + type.w / 2, it.y + type.h + 0.6, 'up'];
    }
    return null;
  };

  // New jobs from the rules: each farmhand walks to them in turn. Until they get there the tile keeps its old look.
  P.fhTake = function (jobs) {
    var self = this, now = Date.now();
    this.fhSync(false); // (at 6 AM the first jobs come before anyone is on the farm: they walk up for them)
    jobs.forEach(function (j) {
      var h = self.fh.hands[j.key];
      if (!h || h.leaving || h.queue.length >= QUEUE) return self.fhFinish(h, j, true);
      var until = now + 30000 + h.queue.length * 6000; // (a slow phone: shown done anyway if they take too long)
      if (j.idx != null) self.fh.hold[j.idx] = until;
      if (j.collect && self.herd) self.herd.members.forEach(function (m) { if (m.i === j.i) m.fhShow = until; });
      h.queue.push(j);
    });
    if (this.drawBasket) this.drawBasket();
  };

  // A job's look once it is done (quiet: no effects, e.g. when it was not walked to).
  P.fhFinish = function (h, j, quiet) {
    var self = this;
    if (j.idx != null) {
      delete this.fh.hold[j.idx];
      this.refreshTile(j.idx);
    }
    if (j.collect && this.herd) this.herd.members.forEach(function (m) { if (m.i === j.i) m.fhShow = 0; });
    if (j.job === 'fruit' && this.treeLooks) this.treeLooks();
    if (j.job !== 'water' && this.drawBasket) this.drawBasket();
    if (quiet || !h) return;
    var hx = h.x, hy = h.y;
    // the little action: a dip, as if bending to the job
    this.tweens.add({ targets: h.sprite, scaleY: 1.84, scaleX: 2.08, duration: 160, yoyo: true, ease: 'Quad.out' });
    if (j.job === 'water') {
      var t = { x: j.idx % this.map.width, y: Math.floor(j.idx / this.map.width) }, cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
      var can = this.add.image(hx + 0.3 * T, hy - 0.72 * T, 'items', C.ICON.can).setScale(0.42).setDepth(DEPTH.fx).setAngle(10); // held out over the crop
      this.tweens.add({ targets: can, angle: -35, duration: 220, yoyo: true, hold: 200, onComplete: function () { can.destroy(); } });
      this.time.delayedCall(200, function () {
        if (!self.sys || !self.sys.isActive()) return;
        if (self.splash) self.splash(cx, cy);
        if (self.burst) self.burst('water', cx, cy, 4);
        if (self.wiggle) self.wiggle(j.idx);
      });
      return;
    }
    var item = C.ITEMS[j.item || j.collect || j.feed], icon = item ? item.icon : null, fx = hx - 0.5 * T, fy = hy - T;
    if (j.idx != null) { fx = (j.idx % this.map.width + 0.5) * T; fy = (Math.floor(j.idx / this.map.width) + 0.5) * T; }
    var m = j.job === 'animals' && this.herd && this.herd.members.filter(function (mm) { return mm.i === j.i; })[0];
    if (m) { fx = m.x; fy = m.y - 0.6 * T; }
    if (j.job === 'fruit') {
      var it = this.state.yard.items[j.i], type = it && C.OUTDOOR.types[it.t];
      if (it) { fx = (it.x + type.w / 2) * T; fy = (it.y + type.h * 0.35) * T; }
    }
    if (j.feed && m) this.herd.hearts(m, 2); // the feed goes down, and the animal is pleased
    if (icon == null) return;
    var pop = this.add.image(fx, fy, 'items', icon).setScale(0.55).setDepth(DEPTH.fx);
    this.tweens.add({
      targets: pop, x: j.feed ? fx : hx, y: j.feed ? fy + 0.4 * T : hy - 1.1 * T, scale: 0.4, duration: 380, ease: 'Quad.inOut',
      onComplete: function () { self.tweens.add({ targets: pop, alpha: 0, y: '-=40', duration: 220, onComplete: function () { pop.destroy(); } }); },
    });
  };

  // Each frame: walk, work, wait.
  P.fhUpdate = function (dt) {
    var now = Date.now();
    for (var idx in this.fh.hold) if (this.fh.hold[idx] < now) { delete this.fh.hold[idx]; this.refreshTile(Number(idx)); }
    for (var i = 0; i < C.FH_KEYS.length; i++) this.fhTick(C.FH_KEYS[i], dt); // (each frame: no lists made)
  };
  P.fhTick = function (key, dt) {
    var self = this, h = this.fh.hands[key];
    if (!h) return;
    if (h.wait > 0) { h.wait -= dt; return; }
    if (h.path.length) return self.fhStep(h, dt);
    if (h.job) { // there: do it
      var job = h.job;
      h.dir = h.face || h.dir;
      h.job = null;
      self.fhStand(h);
      self.fhFinish(h, job, false);
      h.wait = ACT;
      return;
    }
    if (h.leaving) { // off the farm
      h.sprite.destroy();
      delete self.fh.hands[key];
      return;
    }
    if (h.queue.length) {
      var j = h.queue.shift(), spot = self.fhSpot(j);
      if (!spot) return self.fhFinish(h, j, true);
      if (j.job === 'animals' && self.herd) self.herd.members.forEach(function (m) { if (m.i === j.i) m.hold = 6000; }); // it waits for him
      h.job = j;
      self.fhGo(h, spot, spot[2]);
      return;
    }
    var r = REST[key];
    if (Math.abs(h.x - r[0] * T) > 8 || Math.abs(h.y - r[1] * T) > 8) return self.fhGo(h, r, 'down');
    if (h.dir !== 'down' && !h.chat) { h.dir = 'down'; self.fhStand(h); }
  };

  P.fhStep = function (h, dt) {
    var p = h.path[0], dx = p.x - h.x, dy = p.y - h.y, d = Math.sqrt(dx * dx + dy * dy), step = SPEED * dt / 1000;
    if (d <= step) {
      h.x = p.x;
      h.y = p.y;
      h.path.shift();
      if (!h.path.length) { h.dir = h.face || 'down'; this.fhStand(h); }
    } else {
      h.x += dx / d * step;
      h.y += dy / d * step;
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      if (dir !== h.dir || !h.sprite.anims.isPlaying) {
        h.dir = dir;
        h.sprite.anims.play('fh-' + h.key + '-' + (dir === 'left' || dir === 'right' ? 'side' : dir), true);
        h.sprite.setFlipX(dir === 'right');
      }
    }
    F.depthTo(h.sprite.setPosition(h.x, h.y), DEPTH.actor + h.y / 1e5);
  };

  // the jobs the rules just did come in with the clock
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    var r = tickClock.call(this, dt);
    var jobs = L.fhRecent.length ? L.fhTakeRecent() : null;
    if (!r && jobs && this.fh && this.sys.isActive()) this.fhTake(jobs);
    return r;
  };

  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    updateExtras.call(this, dt, time);
    if (!this.fh) return;
    this.fh.syncMs -= dt;
    if (this.fh.syncMs <= 0) {
      this.fh.syncMs = 1000;
      this.fhSync(false);
    }
    this.fhUpdate(dt);
    // a name tag over the one you are near while they wait (the farm has no villagers to need it; at work they crowd)
    if (this.nameTag && !this.villagers) {
      var f = this.feet(), near = null, best = 2.2 * T;
      Object.keys(this.fh.hands).forEach(function (k) {
        var h = this.fh.hands[k], d = Math.hypot(h.x - f.x, h.y - f.y);
        if (h.path.length || h.job || h.queue.length) return;
        if (d < best) { best = d; near = h; }
      }, this);
      this.nameTag.setVisible(!!near);
      if (near) this.nameTag.setText(near.def.name).setPosition(near.x, near.y - 1.75 * T);
    }
  };

  // A tile a farmhand is on the way to keeps its old look until they get there.
  // (L.fhRecent: jobs the rules did this very tick, before the farm has taken them: growCrops comes first)
  var pending = function (idx) { for (var i = 0; i < L.fhRecent.length; i++) if (L.fhRecent[i].idx === idx) return true; return false; };
  var refreshTile = P.refreshTile;
  P.refreshTile = function (idx) {
    if (this.fh && (this.fh.hold[idx] || (L.fhRecent.length && pending(idx)))) return;
    return refreshTile.call(this, idx);
  };
  // so does an animal's bubble: what it made is still there until he collects it
  var place = F.Herd.prototype.place;
  F.Herd.prototype.place = function (m, time) {
    place.call(this, m, time);
    if (m.fhShow > Date.now()) { m.bubble.setVisible(true); m.icon.setVisible(true); }
  };

  // Talking to one who is waiting between jobs.
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.fh) {
      var pt = this.front(0.7), self = this, hit = null;
      Object.keys(this.fh.hands).forEach(function (k) {
        var h = self.fh.hands[k];
        if (h.job || h.path.length || h.leaving || h.queue.length || h.wait > 0) return; // (only while they wait)
        if (Math.hypot(h.x - pt.x, h.y - 0.3 * T - pt.y) < 0.75 * T) hit = h;
      });
      if (hit) return { label: 'Talk', icon: C.ICON.bubble, run: function () { self.fhTalk(hit); } };
    }
    return resolve.call(this);
  };
  P.fhTalk = function (h) {
    var s = this.state, d = h.def, f = this.feet();
    h.dir = Math.abs(f.x - h.x) > Math.abs(f.y - h.y) ? (f.x < h.x ? 'left' : 'right') : (f.y < h.y ? 'up' : 'down');
    this.fhStand(h);
    sfx('talk');
    var done = L.fhDoneToday(s, h.key), jobs = L.fhJobs(s, h.key);
    F.ui.dialog(d.name.toUpperCase() + ', ' + d.title.toUpperCase() + '\n"' + d.line + '"\n\n' +
      (done >= jobs ? 'All done for today: ' + done + ' of ' + jobs + '.' : 'Today: ' + done + ' of ' + jobs + ' jobs done.') +
      ' Lv ' + L.fhLevel(s, h.key) + ', ' + C.FH.ranks[L.fhLevel(s, h.key) - 1] + '.');
  };

  // The basket's number counts what they have brought to it so far, not what they are still on the way to pick.
  var drawBasket = P.drawBasket;
  P.drawBasket = function () {
    drawBasket.call(this);
    var b = this.basket, self = this;
    if (!b || !this.fh || !this.sys || !this.sys.isActive()) return;
    var waiting = 0;
    Object.keys(this.fh.hands).forEach(function (k) {
      var h = self.fh.hands[k];
      h.queue.concat(h.job ? [h.job] : []).forEach(function (j) { if (j.job !== 'water' && !j.feed) waiting += j.n || 1; });
    });
    if (!waiting) return;
    var n = Math.max(0, L.basketCount(this.state) - waiting);
    b.img.setTexture(n ? 'props/basket_full' : 'props/basket_empty');
    b.badge.setText(String(Math.min(n, 99))).setVisible(n > 0);
  };

  // The basket says farmhands fill it too.
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type !== 'basket' || !this.fh || L.basketCount(this.state) || !L.fhAny(this.state)) return extraObjectAction.call(this, o, held, def);
    return { label: 'Basket', icon: C.ICON.crate, run: function () {
      F.ui.dialog('YOUR HARVEST BASKET\nWhat your farmhands pick and collect waits here for you, and so do the crops friends pick when they visit.');
    } };
  };

  // ---------- the morning report ----------
  var dayReport = U.dayReport;
  U.dayReport = function (result, s) {
    var line = result && result.fh ? L.fhReport(result.fh) : '';
    if (!line) return dayReport.call(this, result, s);
    var self = this, dialog = this.dialog;
    this.dialog = function (text, buttons, opts) {
      delete self.dialog;
      if (opts && opts.rows) opts.rows.push([C.ICON.can, line]);
      return dialog.call(self, text + '\n' + line, buttons, opts);
    };
    try {
      return dayReport.call(this, result, s);
    } finally {
      if (Object.prototype.hasOwnProperty.call(this, 'dialog')) delete this.dialog;
    }
  };

  // ---------- the inn: a Farmhands tab ----------
  var TABS = [['menu', 'Menu'], ['hands', 'Farmhands']];
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    var self = this;
    if (o.title === 'Sunny Inn' && !o.fhTabs) {
      o.fhTabs = true;
      o.tabs = TABS;
      o.tab = 'menu';
      var reopen = o.reopen;
      o.reopen = function (tab, page) { if (tab === 'hands') self.openFarmhands(); else reopen(tab, page); };
    }
    return listPanel.call(this, o);
  };

  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || (window.gameHost && window.gameHost.quiet)) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };

  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  U.openFarmhands = function () {
    var self = this, s = F.session.state, o;
    if (take('farmhands_tour')) return this.tour('farmhands', function () { self.openFarmhands(); });
    F.fhTexture(this);
    L.fhWork(s);
    var again = function () { self.closeModal(); self.openFarmhands(); };
    var rows = C.FH_KEYS.map(function (key) {
      var d = C.FARMHANDS[key], h = L.fhOf(s, key), lv = L.fhLevel(s, key), hired = L.fhHired(s, key);
      var r = { sheet: { key: 'farmhands', frame: row(key) * 9, scale: 0.29 }, name: d.name + ' · ' + d.title };
      if (!L.fhUnlocked(s, key)) {
        r.progress = [Math.floor(s.stats.earned), d.unlock];
        r.desc = 'Comes once your farm has earned ' + money(d.unlock) + 'G.';
        return r;
      }
      if (!hired) {
        r.desc = d.brief + ' ' + L.fhJobs(s, key) + ' a day, ' + L.fhWage(s, key) + 'G a work day.' + (h && h.days ? ' Lv ' + lv + '.' : '');
        r.buttons = [{ label: 'Hire', cb: function () { self.fhAskHire(key, again); } }];
        return r;
      }
      var left = L.fhToPromote(s, key);
      r.tag = 'Lv ' + lv;
      r.progress = [L.fhDoneToday(s, key), L.fhJobs(s, key)];
      r.desc = L.fhWage(s, key) + 'G a work day. ' + (left > 0 ? 'Lv ' + (lv + 1) + ' in ' + left + (left > 1 ? ' days.' : ' day.') : left === 0 ? 'Ready to promote!' : C.FH.ranks[lv - 1] + '.');
      r.buttons = (left === 0 ? [{ label: 'Promote', cb: function () { self.fhAskPromote(key, again); } }] : [])
        .concat([{ label: 'Let go', color: RED, cb: function () { self.fhAskFire(key, again); } }]);
      return r;
    });
    o = this.listPanel({
      title: 'Sunny Inn', tabs: TABS, tab: 'hands', fhTabs: true, rows: rows, talk: 'rosa',
      reopen: function (tab) { if (tab === 'hands') self.openFarmhands(); else self.openFoodShop('inn'); },
      sub: function () { return s.gold + 'G   Work hours: 6 AM to 9 PM'; },
    });
    return o;
  };

  U.fhAskHire = function (key, then) {
    var self = this, s = F.session.state, d = C.FARMHANDS[key];
    this.dialog(d.name.toUpperCase() + ', ' + d.title.toUpperCase() + '\n"' + d.line + '"\n\n' + d.what + ' Up to ' + L.fhJobs(s, key) + ' ' + (d.job === 'animals' ? 'jobs' : d.job === 'fruit' ? 'trees' : 'crops') +
      ' a day, for ' + L.fhWage(s, key) + 'G on each day there is work. No gold, no work.', [{ label: 'Not now', color: GREY }, {
      label: 'Hire', cb: function () {
        var r = L.fhHire(s, key);
        if (r !== 'ok') { sfx('nope'); return self.toast(r === 'locked' ? d.name + ' is not looking for work yet.' : 'Already working for you.'); }
        sfx('coin');
        world().changed();
        world().save();
        if (then) then();
        self.toast(d.name + ' works for you now! Starting ' + (L.fhAtWork(s.time) ? 'today.' : 'at 6 AM.'), 3000, 0x2f5a22);
      },
    }]);
  };

  U.fhAskPromote = function (key, then) {
    var self = this, s = F.session.state, d = C.FARMHANDS[key], lv = L.fhLevel(s, key) + 1;
    this.dialog('PROMOTE ' + d.name.toUpperCase() + '?\n' + d.name + ' becomes ' + C.FH.ranks[lv - 1] + ' (Lv ' + lv + '): up to ' + L.fhJobs(s, key, lv) + ' a day, for ' + L.fhWage(s, key, lv) + 'G a work day.',
      [{ label: 'Not now', color: GREY }, {
        label: 'Promote', cb: function () {
          if (L.fhPromote(s, key) !== 'ok') return sfx('nope');
          sfx('coin');
          world().changed();
          world().save();
          if (then) then();
          self.toast(d.name + ' is ' + C.FH.ranks[lv - 1] + ' now!', 2400, 0x2f5a22);
        },
      }]);
  };

  U.fhAskFire = function (key, then) {
    var self = this, s = F.session.state, d = C.FARMHANDS[key];
    this.dialog('LET ' + d.name.toUpperCase() + ' GO?\n' + d.name + ' stops working for you. You can hire them again later, at the same level.', [{ label: 'Keep', color: GREY }, {
      label: 'Let go', color: RED, cb: function () {
        L.fhFire(s, key);
        world().changed();
        world().save();
        if (then) then();
        self.toast(d.name + ' says thank you, and goodbye for now.');
      },
    }]);
  };

  // ---------- the tour ----------
  var face = function (ui, sc, x, y, key, scale) {
    F.fhTexture(ui);
    var im = ui.add.image(x, y, 'farmhands', row(key) * 9).setOrigin(0.5, 1).setScale(scale || 0.42);
    sc.add(im);
    return im;
  };
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.farmhands = {
    title: 'FARMHANDS',
    steps: [
      {
        text: 'Farmhands stay at the Sunny Inn. Hire one to water, pick crops, feed the animals or pick fruit.',
        draw: function (ui, sc, move) {
          C.FH_KEYS.forEach(function (key, n) {
            var im = face(ui, sc, 46 + n * 60, 126, key, 0.4);
            tw(ui, move, { targets: im, y: 118, duration: 420, delay: n * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'They work 6 AM to 9 PM, even while you are away. Each does a set amount a day.',
        draw: function (ui, sc, move) {
          var hand = face(ui, sc, 70, 128, 'andoy', 0.42);
          [0, 1, 2].forEach(function (k) { icon(ui, sc, 150 + k * 40, 86, C.ITEMS.seed_turnip.icon, 0.22); });
          var can = icon(ui, sc, 150, 48, C.ICON.can, 0.3);
          tw(ui, move, { targets: can, x: 230, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          tw(ui, move, { targets: hand, x: 92, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 190, 118, '6 AM - 9 PM', 13, '#6a4a2a');
        },
      },
      {
        text: 'Each takes a wage on a day there is work. No gold, no work. You can let them go any time.',
        draw: function (ui, sc, move) {
          face(ui, sc, 80, 128, 'lucing', 0.42);
          var coin = icon(ui, sc, 180, 66, C.ICON.coin, 0.34);
          tw(ui, move, { targets: coin, y: 54, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 180, 108, '80G a work day', 13, '#a8740c');
        },
      },
      {
        text: 'What they pick waits in your Harvest Basket. Work with them for a while to promote them.',
        draw: function (ui, sc, move) {
          var b = icon(ui, sc, 100, 72, C.ICON.crate, 0.4);
          tw(ui, move, { targets: b, scale: { from: 0.4, to: 0.44 }, duration: 420, yoyo: true, repeat: -1 });
          [C.ITEMS.turnip.icon, C.ITEMS.egg.icon, C.ITEMS.apple.icon].forEach(function (f, i) {
            var it = icon(ui, sc, 70 + i * 30, 30, f, 0.2);
            tw(ui, move, { targets: it, y: 62, alpha: { from: 1, to: 0 }, duration: 900, delay: i * 300, repeat: -1 });
          });
          var st = icon(ui, sc, 200, 66, C.ICON.star, 0.34);
          tw(ui, move, { targets: st, angle: 360, duration: 2400, repeat: -1 });
          words(ui, sc, 200, 108, 'Lv 1 > 2 > 3', 13, '#3f7a2a');
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
