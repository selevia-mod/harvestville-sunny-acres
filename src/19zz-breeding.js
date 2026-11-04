// Animal breeds on the farm (rules: 01-logicZ-breeding.js, colours: 00-zzzzzzz-breeding.js). A breed with a real
// picture (5 Nov 2026: all of them; assets/breed_<animal>_<key>, one row of 12 frames cut like the animals sheet's, with
// its own shadows in breedshade_<animal>_<key>: tools/art/animals3q-import.js) shows that, put on the GPU only when an
// animal of that colour is on the farm (about 2 MB a colour: a row at the animals sheet's 0.75, its shadows at 1/3). A
// colour without one is the animal's own 12 frames recoloured once, on a small canvas (half size, like the world art:
// about 0.8 MB). Rare ones twinkle now and then. The animal's info says its breed; the
// morning report names a newborn's colour; the Breeds book is in the Collection; a first-time tour on the farm.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, GOLD = 0xd9a21b;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var FW = 224, FH = 252, PAD = 8, GAP = 16; // a frame of the animals sheet (10-boot.js SHEETS), in full-size pixels
  var ROW_W = PAD * 2 + 12 * FW + 11 * GAP, ROW_H = PAD * 2 + FH;

  // A breed's own picture as a texture, from the bitmap decoded off the main thread when there is one (paintLater) or
  // the <img>. Stored small, told its full size, so its frames are in full-size pixels like the animals sheet's
  // (10-boot.js, F.ensureTexture), and numbered like that sheet's (frame0 + 0..11).
  var fromPicture = function (tex, key, img, kind) {
    var full = F.sizes && F.sizes[img], bmp = F.bitmaps && F.bitmaps[img], def = C.ANIMALS[kind];
    if (!full || !def) return false;
    var t = tex.create(key, bmp || F.images[img], full[0], full[1]), src = t.source[0], gt = src.glTexture;
    if (gt) { gt.width = full[0]; gt.height = full[1]; }
    t.add('__BASE', 0, 0, 0, full[0], full[1]);
    for (var n = 0; n < 12; n++) t.add(def.frame0 + n, 0, PAD + n * (FW + GAP), PAD, FW, FH);
    if (bmp) { // (the <img> stays for a GPU context restore, as ensureTexture does)
      src.image = F.images[img];
      if (gt) gt.pixels = F.images[img];
      bmp.close();
      delete F.bitmaps[img];
    }
    return true;
  };

  // ---------- the pictures ----------
  F.Breeds = {
    key: function (kind, b) { return b ? 'animals_br_' + kind + '_' + b : 'animals'; },
    shadeKey: function (kind, b) { return b && F.Breeds.picture(kind, b) ? 'animalshade_br_' + kind + '_' + b : 'animalshade'; },
    // the breed's own picture (its image key), if it has one
    picture: function (kind, b) {
      var d = b && C.BREEDS[kind] && C.BREEDS[kind][b], k = d && 'breed_' + kind + '_' + d.key;
      return k && F.images && F.images[k] && F.images['breedshade_' + kind + '_' + d.key] ? k : null;
    },
    // The texture for a breed (made the first time): its frames are numbered as in the animals sheet (frame0 + 0..11),
    // so the herd's poses work on it unchanged. Breed 0 is the animals sheet itself. Its picture if it has one, else
    // the animal's frames recoloured.
    texture: function (scene, kind, b) {
      var base = F.ensureTexture(scene, 'animals'), key = F.Breeds.key(kind, b), tex = scene.textures;
      if (!b || tex.exists(key)) return key;
      var pic = F.Breeds.picture(kind, b);
      try {
        if (pic && fromPicture(tex, key, pic, kind)) return key;
      } catch (e) { if (tex.exists(key)) tex.remove(key); } // (painted instead)
      var def = C.ANIMALS[kind], paint = L.breedDef(kind, b).paint;
      if (!def || !paint) return base;
      try {
        // (from the animals bitmap while it is kept, 10-boot.js: an <img> is decoded on the main thread when first drawn)
        var src = tex.get(base), img = (F.bitmaps && F.bitmaps.animals) || src.getSourceImage(), ratio = img.width / src.source[0].width;
        var gl = scene.game.renderer.type === Phaser.WEBGL, out = gl ? 0.5 : 1; // stored at half size, like the world art
        var cv = document.createElement('canvas');
        cv.width = Math.ceil(ROW_W * out);
        cv.height = Math.ceil(ROW_H * out);
        var g = cv.getContext('2d', { willReadFrequently: true }); // (read back once: keep it off the GPU)
        for (var k = 0; k < 12; k++) {
          var fr = src.get(def.frame0 + k);
          g.drawImage(img, fr.cutX * ratio, fr.cutY * ratio, fr.cutWidth * ratio, fr.cutHeight * ratio,
            (PAD + k * (FW + GAP)) * out, PAD * out, fr.cutWidth * out, fr.cutHeight * out);
        }
        var data = g.getImageData(0, 0, cv.width, cv.height);
        L.breedPaintPixels(paint, data.data);
        g.putImageData(data, 0, 0);
        var t = tex.create(key, cv, ROW_W, ROW_H), gt = t.source[0].glTexture;
        if (gt) { gt.width = ROW_W; gt.height = ROW_H; } // UVs in full-size pixels (10-boot.js does the same)
        t.add('__BASE', 0, 0, 0, ROW_W, ROW_H); // (as Phaser's own sheet parser does)
        for (var n = 0; n < 12; n++) t.add(def.frame0 + n, 0, PAD + n * (FW + GAP), PAD, FW, FH);
        return key;
      } catch (e) {
        return base; // (never worse than the plain picture)
      }
    },
    // its shadows: a picture's own (made with it), else the animal's
    shade: function (scene, kind, b) {
      var key = F.Breeds.shadeKey(kind, b), tex = scene.textures;
      if (key !== 'animalshade' && !tex.exists(key)) {
        try { fromPicture(tex, key, 'breedshade_' + kind + '_' + C.BREEDS[kind][b].key, kind); } catch (e) { if (tex.exists(key)) tex.remove(key); }
      }
      return tex.exists(key) ? key : F.ensureTexture(scene, 'animalshade');
    },
  };

  // ---------- in the pen ----------
  // A colour not on the GPU yet is put up after the map's first frame, one a frame, the ones on screen first (painting
  // them all in the farm's first frame cost ~0.35 s of boot on a slow phone). A colour with a picture waits for it to be
  // decoded off the main thread first (F.prewarmKey, 10-boot.js: a few ms of upload then, not a decode). Until then that
  // animal and its shadow are hidden. A farm with no breed animal decodes and uploads nothing more.
  F.keepBitmap = F.keepBitmap || {};
  F.keepBitmap.animals = true; // (the herd paints from it; F.dropBitmaps lets it go a few seconds into the map)
  var paintLater = function (sc, m, kind, b) {
    m.sprite.setAlpha(0);
    m.sh.setAlpha(0);
    var q = sc.breedQueue, pic = F.Breeds.picture(kind, b), job = { m: m, kind: kind, b: b, ready: true };
    if (pic && F.prewarmKey) {
      var wait = [F.prewarmKey(pic, null), F.prewarmKey(pic.replace(/^breed_/, 'breedshade_'), null)].filter(Boolean);
      if (wait.length) {
        job.ready = false;
        Promise.all(wait).then(function () { job.ready = true; });
      }
    }
    if (!q) {
      q = sc.breedQueue = { list: [], frame: sc.game.loop.frame };
      var step = function () {
        if (sc.game.loop.frame <= q.frame + 1 || !q.list.length) return;
        var cam = sc.cameras.main, cx = cam.midPoint.x, cy = cam.midPoint.y, ready = q.list.filter(function (o) { return o.ready; });
        if (!ready.length) return;
        ready.sort(function (p, r) { return Math.hypot(p.m.x - cx, p.m.y - cy) - Math.hypot(r.m.x - cx, r.m.y - cy); });
        var job = ready[0], key = F.Breeds.texture(sc, job.kind, job.b), shade = F.Breeds.shade(sc, job.kind, job.b);
        q.list.filter(function (o) { return o.kind === job.kind && o.b === job.b; }).forEach(function (o) {
          if (o.m.sprite.active) o.m.sprite.setTexture(key, o.m.sprite.frame.name).setAlpha(1);
          if (o.m.sh.active) o.m.sh.setTexture(shade, o.m.sh.frame.name).setAlpha(1);
        });
        q.list = q.list.filter(function (o) { return !(o.kind === job.kind && o.b === job.b); });
        if (!q.list.length) done();
      };
      var done = function () { sc.events.off('postupdate', step); sc.events.off('shutdown', done); if (sc.breedQueue === q) sc.breedQueue = null; };
      sc.events.on('postupdate', step);
      sc.events.once('shutdown', done);
    }
    q.list.push(job);
  };
  var add = F.Herd.prototype.add;
  F.Herd.prototype.add = function (i) {
    var m = add.call(this, i), sc = this.scene, a = sc.state.animals[i], b = L.breedOf(a);
    m.rare = L.isRare(a);
    m.twinkle = 1500 + Math.random() * 3000;
    if (b && !sc.textures.exists(F.Breeds.key(a.kind, b)) && C.ANIMALS[a.kind] && L.breedDef(a.kind, b).paint) paintLater(sc, m, a.kind, b);
    else if (b) {
      m.sprite.setTexture(F.Breeds.texture(sc, a.kind, b), m.sprite.frame.name);
      m.sh.setTexture(F.Breeds.shade(sc, a.kind, b), m.sh.frame.name);
    }
    // a new colour from Lily's shop (a newborn's is in the morning report)
    if (a.brNew && this.live && !(F.session && F.session.visit)) {
      delete a.brNew;
      var d = L.breedDef(a.kind, b);
      sc.time.delayedCall(1600, function () {
        if (F.ui) F.ui.toast('New in your Breeds book: the ' + d.name + '! (' + L.breedsFound(sc.state, a.kind) + ' of ' + C.BREEDS[a.kind].length + ')', 3200, 0x2f5a22);
      });
    }
    return m;
  };
  // Colours no animal here has (a friend's, seen on a visit; one sold) are let go a little after the farm is in, so
  // visits do not pile them up on the GPU. The Breeds book makes one again when it shows it (and F.freeTexture,
  // 19zzzz-perf.js, keeps whatever is still on screen).
  var release = function (w) {
    if (!w.sys || !w.sys.isActive() || w.busy || !w.herd || !F.freeTexture) return;
    var want = {};
    w.state.animals.forEach(function (a) {
      var b = L.breedOf(a);
      if (b) want[F.Breeds.key(a.kind, b)] = want['animalshade_br_' + a.kind + '_' + b] = true;
    });
    Object.keys(w.textures.list).forEach(function (k) { if (/^animal(s|shade)_br_/.test(k) && !want[k]) F.freeTexture(k); });
  };
  var update = F.Herd.prototype.update;
  F.Herd.prototype.update = function (dt, time, minutes) {
    update.call(this, dt, time, minutes);
    this.live = true;
    var sc = this.scene;
    this.members.forEach(function (m) {
      if (!m.rare || (m.twinkle -= dt) > 0) return;
      m.twinkle = 2200 + Math.random() * 2600;
      var T = C.TILE, h = sc.add.image(m.x + (Math.random() - 0.5) * m.def.w * T * 0.7, m.y - m.def.height * T * m.small * (0.5 + Math.random() * 0.4), 'items', C.ICON.star)
        .setScale(0.05).setDepth(23).setAlpha(0.95);
      sc.tweens.add({
        targets: h, scale: 0.32, angle: 90, duration: 380, yoyo: true, ease: 'Sine.out',
        onComplete: function (tw, targets) { targets[0].destroy(); },
      });
    });
  };

  // ---------- what the farmer is told ----------
  // Runs fn while F.ui's toast / dialog texts go through edit (then puts them back).
  var withText = function (method, edit, fn) {
    var ui = F.ui;
    if (!ui) return fn();
    var had = Object.prototype.hasOwnProperty.call(ui, method), orig = ui[method];
    ui[method] = function (text) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof text === 'string') args[0] = edit(text);
      return orig.apply(ui, args);
    };
    try { return fn(); } finally { if (had) ui[method] = orig; else delete ui[method]; }
  };
  var babyWord = function (kind) { return kind === 'chicken' ? 'chick' : C.ANIMALS[kind].young || 'calf'; };

  // The animal's info: its breed under its name (and a piglet is not a calf).
  var animalInfo = P.animalInfo;
  P.animalInfo = function (m) {
    var a = this.state.animals[m.i], d = L.breedDef(a.kind, L.breedOf(a));
    var line = d.name + (d.rare ? ' (rare: ' + (1 + C.BREEDING.bonus) + ' a day)' : '') + '.';
    var self = this;
    return withText('toast', function (t) {
      var lines = t.split('\n');
      lines.splice(1, 0, line);
      return lines.join('\n').replace('A calf is on the way', 'A ' + babyWord(a.kind) + ' is on the way');
    }, function () { return animalInfo.call(self, m); });
  };

  // The potion on a chicken: say where chicks come from; on a pig, it is a piglet.
  var potion = P.potion;
  P.potion = function (m) {
    var a = this.state.animals[m.i], self = this;
    if (a.kind === 'chicken') return F.ui.toast('Chicks come from eggs: put an egg in the incubator at the coop.');
    return withText('dialog', function (t) { return t.replace('a calf', 'a ' + babyWord(a.kind)); }, function () { return potion.call(self, m); });
  };

  // The morning report: a newborn's colour (and a rare one is news).
  var dayReport = U.dayReport;
  U.dayReport = function (result, s) {
    var self = this, swap = [];
    (result && result.born || []).forEach(function (i) {
      var a = s.animals[i];
      if (!a) return;
      var d = L.breedDef(a.kind, L.breedOf(a)), was = a.kind === 'chicken' ? 'A chick hatched! Say hello to ' + a.name + '.' : 'A calf was born! Say hello to ' + a.name + '.';
      var now = (d.rare ? 'A RARE ' : 'A ') + babyWord(a.kind) + (a.kind === 'chicken' ? ' hatched! ' : ' was born! ') + 'Say hello to ' + a.name + ', a ' + d.name + (d.rare ? '!' : '.') +
        (a.brNew ? ' New in your Breeds book.' : '');
      delete a.brNew;
      swap.push([was, now]);
    });
    if (!swap.length) return dayReport.call(this, result, s);
    var had = Object.prototype.hasOwnProperty.call(this, 'dialog'), dialog = this.dialog;
    this.dialog = function (text, buttons, opts) {
      swap.forEach(function (p) {
        text = text.replace(p[0], p[1]);
        ((opts && opts.rows) || []).forEach(function (r) { if (r[1] === p[0]) r[1] = p[1]; });
      });
      return dialog.call(self, text, buttons, opts);
    };
    try { return dayReport.call(this, result, s); } finally { if (had) this.dialog = dialog; else delete this.dialog; }
  };

  // ---------- the Breeds book (from the Collection) ----------
  var TABS = [['chicken', 'Hens'], ['cow', 'Cows'], ['pig', 'Pigs'], ['carabao', 'Carabaos']];
  U.openBreeds = function (kind, back) {
    var self = this, s = F.session.state;
    kind = C.BREEDS[kind] ? kind : 'chicken';
    var defs = C.BREEDS[kind], prize = C.BREEDING.prize[kind];
    var rows = defs.map(function (d, b) {
      if (!L.breedFound(s, kind, b)) {
        return { icon: C.ICON.exclaim, name: '???', tag: d.rare ? 'RARE' : null, desc: d.rare ? 'A rare colour: born now and then to your own animals.' : 'Not found yet. Lily sells it.' };
      }
      var have = s.animals.filter(function (a) { return a.kind === kind && L.breedOf(a) === b; }).length;
      return {
        sheet: { key: F.Breeds.texture(self, kind, b), frame: C.ANIMALS[kind].frame0, scale: 0.2 }, name: d.name, tag: d.rare ? 'RARE' : null,
        desc: d.desc + (d.rare ? ' Gives ' + (1 + C.BREEDING.bonus) + ' a day.' : '') + (have ? ' You have ' + have + '.' : ''),
      };
    });
    var done = L.breedsDone(s, kind), taken = L.breedPrizeTaken(s, kind);
    rows.push({
      icon: C.ICON.coin, name: 'Prize: ' + fmt(prize.gold) + 'G' + (prize.item ? ' + ' + C.ITEMS[prize.item].name : ''),
      desc: taken ? 'Claimed. Well done!' : done ? 'Every colour found!' : 'Find all ' + defs.length + ' colours.', done: taken,
      buttons: done && !taken ? [{
        label: 'Claim', color: GOLD, cb: function () {
          var r = L.claimBreedPrize(s, kind);
          if (r === 'full') return self.toast('Your bag is full!');
          if (r !== 'ok') return;
          sfx('coin');
          if (F.world) { F.world.changed(); if (F.world.save) F.world.save(); }
          self.closeModal();
          self.openBreeds(kind, back);
          self.toast('You got ' + fmt(prize.gold) + 'G' + (prize.item ? ' and a ' + C.ITEMS[prize.item].name : '') + '!', 2600, 0x2f5a22);
        },
      }] : null,
    });
    this.listPanel({
      title: 'Breeds book', tabs: TABS, tab: kind, rows: rows, page: 0,
      sub: function () { return L.breedsFound(s, kind) + ' of ' + defs.length + ' found'; },
      reopen: function (tab) { self.openBreeds(tab, back); },
      corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
    });
  };

  // The Collection: a Breeds button in its row of books (16-panels.js, collectionButton).
  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.call(this);
    var self = this, m = this.modals[this.modals.length - 1], c = m && m.c;
    if (!c) return;
    var go = function () { self.closeModal(); self.openBreeds('chicken', function () { self.openCollection(); }); };
    this.collectionButton(c, 'breeds', 'Breeds', go, L.breedPrizesReady(F.session.state).length ? GOLD : GREEN);
  };

  // ---------- the tour ----------
  var beast = function (ui, sc, x, y, kind, b, scale, k) {
    var a = ui.add.image(x, y, F.Breeds.texture(ui, kind, b), C.ANIMALS[kind].frame0 + (k || 0)).setOrigin(0.5, 0.92).setScale(scale || 0.3);
    sc.add(a);
    return a;
  };
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.breeds = {
    title: 'ANIMAL BREEDS',
    steps: [
      {
        text: 'Your animals come in colours now. Lily sells the common ones: a colour you do not have yet, when she has one.',
        draw: function (ui, sc, move) {
          [0, 1, 2].forEach(function (b, n) {
            var a = beast(ui, sc, 66 + n * 70, 118, 'chicken', b, 0.42);
            tw(ui, move, { targets: a, y: 110, duration: 380, delay: n * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'A chick or a calf takes after its parents. About 1 in 25 is born in a RARE colour!',
        draw: function (ui, sc, move) {
          beast(ui, sc, 82, 122, 'cow', 0, 0.42, 6);
          var calf = beast(ui, sc, 168, 120, 'cow', 3, 0.28, 0);
          var st = icon(ui, sc, 196, 52, C.ICON.star, 0.2);
          words(ui, sc, 168, 24, 'RARE!', 14, '#c0503a');
          tw(ui, move, { targets: st, angle: 360, scale: 0.28, duration: 900, yoyo: true, repeat: -1 });
          tw(ui, move, { targets: calf, y: 114, duration: 300, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'A rare animal gives two of its produce each morning. The Miracle Potion works on pigs and carabaos too.',
        draw: function (ui, sc, move) {
          beast(ui, sc, 80, 120, 'chicken', 3, 0.42);
          var e1 = icon(ui, sc, 170, 70, C.ICON.egg_l, 0.3), e2 = icon(ui, sc, 214, 70, C.ICON.egg_l, 0.3);
          tw(ui, move, { targets: [e1, e2], y: 60, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'Find every colour of a kind in the Breeds book (Collection) to win a prize.',
        draw: function (ui, sc, move) {
          var bk = icon(ui, sc, 80, 66, C.ICON.book, 0.4);
          tw(ui, move, { targets: bk, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1 });
          words(ui, sc, 190, 52, '4 of 4 found', 14);
          var p = words(ui, sc, 190, 84, '+1,000G', 16, '#a8740c');
          tw(ui, move, { targets: p, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // shows once, on your own farm, from your second day (or once you have two animals)
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var whenFree = function (w, fn, tries) {
    tries = tries || 0;
    if (!w.sys || !w.sys.isActive() || tries > 40) return;
    if (w.busy || !F.ui || F.ui.modals.length || document.getElementById('farm-ask')) return w.time.delayedCall(1500, function () { whenFree(w, fn, tries + 1); });
    fn();
  };
  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    var self = this, s = F.session && F.session.state;
    if (this.herd) this.time.delayedCall(1500, function () { release(self); });
    if (!s || this.mapKey !== 'farm' || F.session.visit || (this.state && this.state.isVisit) || quiet() || L.tipSeen(s, 'breeds_tour')) return;
    if (!(s.animals.length > 1 || s.day > s.start)) return;
    this.time.delayedCall(3200, function () {
      whenFree(self, function () {
        if (L.tipSeen(s, 'breeds_tour') || quiet()) return;
        L.takeTip(s, 'breeds_tour');
        F.Host.save(s);
        F.ui.tour('breeds');
      });
    });
  };
})(window.Farm = window.Farm || {});
