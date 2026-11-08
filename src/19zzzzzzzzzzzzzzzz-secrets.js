// Quests v2, phase 2 (owner, 8-9 Nov 2026; docs/quests-v2.md):
//  - marks over people: "!" over a villager with a request for you; "?" (gold) when you have what they asked for, or an
//    adventure's thing to hand over (Tita Luz and Mang Kanor too)
//  - your dog's secrets: now and then, as you play on your farm, in town or in Pulag, your dog smells something and
//    says so in a bubble; tap it and the dog leads you there: a buried chest (Dig), a rare forage (a Truffle), or a
//    fishing spot in the water (bubbles: the next fish caught right there is a big one). Two a day at most.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var INK = F.UI_CONST.INK, W = F.UI_CONST.W;
  var sfx = function (name, soft) { if (F.Audio) { if (soft && F.Audio.sfxSoft) F.Audio.sfxSoft(name, 0.5); else F.Audio.sfx(name); } };
  var mine = function () { return F.session.state; };

  // ---------- marks over people ----------
  var qTex = function (scene) {
    var key = 'fx-askq';
    if (scene.textures.exists(key)) return key;
    var t = scene.textures.createCanvas(key, 96, 96), g = t.getContext();
    g.beginPath(); g.arc(48, 50, 40, 0, Math.PI * 2);
    g.fillStyle = '#5a3a1e'; g.fill();
    g.beginPath(); g.arc(48, 46, 38, 0, Math.PI * 2);
    var gr = g.createLinearGradient(0, 8, 0, 84); gr.addColorStop(0, '#ffe680'); gr.addColorStop(1, '#e9a91c');
    g.fillStyle = gr; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#5a3a1e'; g.stroke();
    g.font = 'bold 56px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#5a3a1e'; g.strokeText('?', 48, 48);
    g.fillStyle = '#ffffff'; g.fillText('?', 48, 48);
    t.refresh();
    return key;
  };
  // who gets which mark: { key: { x, y, q } } (worked out a few times a second)
  P.askMarksWanted = function () {
    var s = this.state, out = {};
    if (F.session.visit) return out;
    (this.villagers && this.villagers.list || []).forEach(function (v) {
      if (v.shopper || !v.visible || !v.sprite || !v.sprite.visible) return;
      var i = L.requestFor(s, v.key), q = L.advFor(s, v.key) >= 0 || (i >= 0 && L.canFinishRequest(s, i));
      if (q || i >= 0) out[v.key] = { v: v, q: q };
    });
    if (this.tailor && this.tailor.img.visible && L.advFor(s, 'luz') >= 0) out.luz = { x: this.tailor.x, y: this.tailor.y, q: true };
    if (this.kanor && this.kanor.img.visible && L.advFor(s, 'kanor') >= 0) out.kanor = { x: this.kanor.x, y: this.kanor.y, q: true };
    return out;
  };
  P.updateAskMark = function (time) {
    if (this.askMark) this.askMark.setVisible(false); // (the old one-mark way: 19g-quests.js)
    var self = this, now = Date.now(), marks = this.askMarks = this.askMarks || {};
    if (!this.askWant || now - (this.askAt || 0) > 300) { this.askAt = now; this.askWant = this.askMarksWanted(); }
    var want = this.askWant;
    Object.keys(marks).forEach(function (k) {
      var m = marks[k];
      if (!want[k] || m.q !== want[k].q) { m.img.destroy(); delete marks[k]; }
    });
    Object.keys(want).forEach(function (k) {
      var w = want[k], m = marks[k];
      if (!m) m = marks[k] = { q: w.q, img: w.q ? self.add.image(0, 0, qTex(self)).setDisplaySize(0.9 * T, 0.9 * T) : self.add.image(0, 0, 'items', C.ICON.exclaim).setScale(0.9) };
      var x = w.v ? w.v.x : w.x, y = w.v ? w.v.y : w.y;
      m.img.setPosition(x, y - 2.1 * T + Math.sin(time / 220 + x) * 20).setDepth(DEPTH.Above + 1);
    });
  };

  // ---------- your dog's secrets ----------
  var S = C.SECRETS = { perDay: 2, first: [90000, 180000], every: [240000, 480000], maps: ['farm', 'town', 'pulag'], min: 7, max: 18,
    chest: [[{ gold: 400 }, 30], [{ gold: 800 }, 18], [{ item: 'ore_silver', n: 3 }, 14], [{ item: 'gem', n: 1 }, 10], [{ item: 'treat', n: 2 }, 16], [{ item: 'power_up', n: 1 }, 8], [{ stars: 1 }, 4]] };
  var rand = function (a) { return a[0] + Math.random() * (a[1] - a[0]); };
  // today's (s.dsec = [day, found]): how many more today
  L.secretsLeft = function (s) { var d = s.dsec && s.dsec[0] === s.day ? s.dsec[1] : 0; return Math.max(0, S.perDay - d); };
  L.secretFound = function (s) { s.dsec = [s.day, (s.dsec && s.dsec[0] === s.day ? s.dsec[1] : 0) + 1]; };
  L.chestPrize = function (r) {
    var sum = 0, k;
    for (k = 0; k < S.chest.length; k++) sum += S.chest[k][1];
    var x = r * sum;
    for (k = 0; k < S.chest.length; k++) { x -= S.chest[k][1]; if (x < 0) return S.chest[k][0]; }
    return S.chest[0][0];
  };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); if (s.dsec) o.ds = s.dsec.slice(); return o; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (s && Array.isArray(o.ds)) s.dsec = [Number(o.ds[0]) || 0, Math.max(0, Math.min(S.perDay, Number(o.ds[1]) || 0))];
    return s;
  };

  var create = P.create;
  P.create = function () {
    create.call(this);
    this.secret = null;
    if (!F.session.secretAt) F.session.secretAt = Date.now() + rand(S.first);
  };
  // a free tile S.min..S.max tiles away that the farmer can walk to; for a fishing spot: a water tile beside one
  P.secretSpot = function (kind) {
    var f = this.feet(), fx = Math.floor(f.x / T), fy = Math.floor(f.y / T), w = this.map.width, h = this.map.height, self = this;
    for (var t = 0; t < 200; t++) {
      var x = 1 + Math.floor(Math.random() * (w - 2)), y = 1 + Math.floor(Math.random() * (h - 2)), d = Math.abs(x - fx) + Math.abs(y - fy);
      if (d < S.min || d > S.max) continue;
      if (kind === 'fish') {
        if (!this.isWater || !this.isWater(x, y)) continue;
        var edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (e) { return [x + e[0], y + e[1]]; }).filter(function (p) { return self.inMap(p[0], p[1]) && self.walkable(p[0], p[1]) && !self.blocked[self.idx(p[0], p[1])]; })[0];
        if (!edge) continue;
        var path = this.guidePath(function (a, b) { return a === edge[0] && b === edge[1]; });
        if (path) return { x: x, y: y, sx: edge[0], sy: edge[1] };
      } else {
        if (!this.inMap(x, y) || !this.walkable(x, y) || this.blocked[this.idx(x, y)]) continue;
        if (this.isWater && this.isWater(x, y)) continue;
        var p2 = this.guidePath(function (a, b) { return a === x && b === y; });
        if (p2) return { x: x, y: y, sx: x, sy: y };
      }
    }
    return null;
  };
  // the dog smells something: a bubble; a tap leads there
  P.secretTry = function () {
    var s = this.state;
    if (F.session.visit || S.maps.indexOf(this.mapKey) < 0 || this.secret || this.guide || F.session.sniff || this.busy || !L.secretsLeft(s)) return false;
    if (!F.ui || F.ui.modals.length || (F.ui.blocking && F.ui.blocking()) || F.ui.decorating) return false;
    var kinds = ['chest', 'forage'].concat(this.isWater ? ['fish'] : []), kind = kinds[Math.floor(Math.random() * kinds.length)];
    var spot = this.secretSpot(kind) || (kind === 'fish' ? this.secretSpot('chest') : null);
    if (!spot) return false;
    if (kind === 'fish' && !(spot.x !== spot.sx || spot.y !== spot.sy)) kind = 'chest';
    this.secret = { kind: kind, x: spot.x, y: spot.y, sx: spot.sx, sy: spot.sy, map: this.mapKey, shown: false };
    var line = { chest: 'Arf! I smell something buried over there!', forage: 'Arf! Something smells yummy nearby!', fish: 'Arf! The fish are jumping somewhere close!' }[kind];
    var self = this;
    F.ui.dogSays(L.dogName(s) + ': ' + line, function () { self.secretGo(); });
    sfx('woof', true);
    return true;
  };
  P.secretGo = function () {
    var sc = this.secret;
    if (!sc || sc.map !== this.mapKey || this.guide) return;
    this.secretShow();
    var path = this.guidePath(function (x, y) { return x === sc.sx && y === sc.sy; });
    if (!path) return;
    F.session.guide = { i: -1, c: 'secret', place: { map: this.mapKey, to: 'secret', say: '' } };
    this.guideDogShow();
    this.guide = { path: path, k: 0, spot: { goal: function () { return false; }, secret: true }, last: this.feet(), at: Date.now(), tries: 0 };
  };
  var arrive = P.guideArrive;
  P.guideArrive = function () {
    var g = this.guide;
    if (!g || !g.spot || !g.spot.secret) return arrive.call(this);
    this.guide = null;
    F.session.guide = null;
    F.bus.emit('guide', 'arrived');
    var sc = this.secret, d = this.guideDog;
    if (d && this.huntDogBark) this.huntDogBark(d, 2); else sfx('woof');
    if (sc) F.ui.toast(L.dogName(this.state) + ': ' + ({ chest: 'here! Dig right here!', forage: 'here! Pick it up!', fish: 'here! Cast your line right there!' }[sc.kind]), 2600, 0x2f5a22);
    var self = this;
    this.time.delayedCall(2600, function () { if (!self.guide) self.guideDogHide(true); });
  };
  // its mark on the ground: a mound (chest), a glowing Truffle (forage), bubbles (fish)
  P.secretShow = function () {
    var sc = this.secret;
    if (!sc || sc.shown) return;
    sc.shown = true;
    var x = (sc.x + 0.5) * T, y = (sc.y + 0.6) * T, self = this;
    if (sc.kind === 'fish') {
      sc.img = this.add.container(x, y - 0.1 * T).setDepth(DEPTH.flat + 0.3);
      for (var k = 0; k < 4; k++) {
        var b = this.add.circle((k % 2 ? 1 : -1) * 0.18 * T * (k > 1 ? 0.5 : 1), (k - 1.5) * 0.08 * T, 0.07 * T + k * 0.012 * T, 0xffffff, 0.75).setStrokeStyle(2, 0x8fd0ff, 0.9);
        sc.img.add(b);
        this.tweens.add({ targets: b, y: b.y - 0.25 * T, alpha: 0, duration: 900 + k * 180, repeat: -1, delay: k * 200 });
      }
    } else {
      var icon = sc.kind === 'chest' ? C.ICON.chest : C.ITEMS.truffle.icon;
      sc.img = this.add.container(x, y);
      sc.img.add(this.add.ellipse(0, 0.02 * T, 0.8 * T, 0.32 * T, 0x7a4d26, sc.kind === 'chest' ? 0.85 : 0.25));
      var it = this.add.image(0, -0.25 * T, 'items', icon).setScale((sc.kind === 'chest' ? 0.5 : 0.65) * T / 128).setAlpha(sc.kind === 'chest' ? 0 : 1);
      sc.img.add(it);
      sc.icon = it;
      sc.img.setDepth(DEPTH.actor + y / 1e5);
      this.tweens.add({ targets: sc.img, scaleX: 1.06, scaleY: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    void self;
  };
  P.secretDone = function () {
    var sc = this.secret;
    if (sc && sc.img) sc.img.destroy();
    this.secret = null;
    L.secretFound(this.state);
    F.session.secretAt = Date.now() + rand(S.every);
    this.changed();
    this.save();
  };
  // Dig (the chest) and Pick (the forage), standing on it or facing it
  var resolve = P.resolve;
  P.resolve = function () {
    var sc = this.secret, self = this;
    if (sc && sc.shown && sc.kind !== 'fish' && sc.map === this.mapKey) {
      var f = this.feet(), pt = this.front(0.7), cx = (sc.x + 0.5) * T, cy = (sc.y + 0.5) * T;
      if (Math.hypot(f.x - cx, f.y - cy) < 0.7 * T || Math.hypot(pt.x - cx, pt.y - cy) < 0.6 * T) {
        if (sc.kind === 'chest') return { label: 'Dig', icon: C.ICON.chest, run: function () { self.secretDig(); } };
        return { label: 'Pick', icon: C.ITEMS.truffle.icon, run: function () { self.secretPick(); } };
      }
    }
    return resolve.call(this);
  };
  P.secretDig = function () {
    var s = this.state, prize = L.chestPrize(Math.random()), sc = this.secret;
    if (!L.rewardFits(s, prize)) { sfx('nope'); return F.ui.toast('Your bag is full! Make room first.'); }
    L.giveReward(s, prize);
    sfx('found');
    this.iconPop((sc.x + 0.5) * T, (sc.y + 0.2) * T, prize.stars ? C.ICON.sunbeam : prize.item ? C.ITEMS[prize.item].icon : C.ICON.coin);
    F.ui.toast('A buried chest! ' + L.rewardLabel(prize) + '!', 2800, 0x7a4d12);
    this.secretDone();
  };
  P.secretPick = function () {
    var s = this.state, sc = this.secret, n = 1 + (Math.random() < 0.35 ? 1 : 0);
    if (!L.canAdd(s, 'truffle', n)) { sfx('nope'); return F.ui.toast('Your bag is full! Make room first.'); }
    L.addItem(s, 'truffle', n);
    L.discover(s, 'truffle');
    sfx('pick');
    this.iconPop((sc.x + 0.5) * T, (sc.y + 0.2) * T, C.ITEMS.truffle.icon);
    F.ui.toast((n > 1 ? n + ' Truffles' : 'A Truffle') + '! A rare find.', 2600, 0x7a4d12);
    this.secretDone();
  };
  // a fish caught right by the bubbles: a big one (King Trout now and then), and the spot is gone
  var rollFish = L.rollFish;
  L.rollFish = function (water, r) {
    var w = F.world, sc = w && w.secret;
    if (sc && sc.kind === 'fish' && sc.shown && sc.map === w.mapKey && w.player) {
      var f = w.feet();
      if (Math.hypot(f.x - (sc.x + 0.5) * T, f.y - (sc.y + 0.5) * T) < 2.6 * T) {
        var big = Math.random() < 0.3 ? 'fish_k' : 'fish_l';
        w.time.delayedCall(1200, function () { if (F.ui) F.ui.toast('The secret spot! A big one!', 2400, 0x7a4d12); });
        w.secretDone();
        return big;
      }
    }
    return rollFish(water, r);
  };
  // now and then (not while anything else is going on): the dog smells something
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.player || !this.sys || !this.sys.isActive() || F.session.visit) return;
    var now = Date.now();
    if (this.secret && this.secret.map !== this.mapKey) this.secret = null;
    if (now > (F.session.secretAt || 0)) {
      if (this.secretTry()) F.session.secretAt = now + rand(S.every);
      else F.session.secretAt = now + 20000;
    }
  };

  // ---------- the dog's bubble (as its quest tip, 19zzzzzzzzzzzz-guide.js): a tap does `onTap` ----------
  U.dogSays = function (line, onTap) {
    var t = this.qcTip, self = this;
    if (!t) return;
    t.removeAll(true);
    var words = this.txt(30, 8, line, 10, INK, { wordWrap: { width: 180 }, lineSpacing: 1 });
    var h = Math.max(30, words.height + 14), wd = Math.min(W - 24, Math.max(150, words.width + 40)), bg = this.add.graphics();
    bg.fillStyle(0xfff6dc, 0.97).fillRoundedRect(0, 0, wd, h, 10).lineStyle(1.5, 0x7a4d26, 0.6).strokeRoundedRect(0, 0, wd, h, 10);
    bg.fillStyle(0xfff6dc, 0.97).fillTriangle(18, 0, 30, 0, 22, -7);
    var face = this.add.image(15, h / 2, 'items', C.ICON.dog).setScale(0.14);
    var z = this.add.zone(wd / 2, h / 2, wd, h).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { t.setVisible(false); onTap(); });
    t.add([bg, face, words, z]);
    t.setAlpha(0).setVisible(true);
    this.tweens.killTweensOf(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 250 });
    this.time.delayedCall(9000, function () { self.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: function () { t.setVisible(false); } }); });
  };
})(window.Farm = window.Farm || {});
