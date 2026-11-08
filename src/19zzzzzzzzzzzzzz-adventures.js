// Daily adventures on screen (owner, 8 Nov 2026; docs/quests-adventures.md; rules 01-logicZZZZZZZZZ-adventures.js):
//  - the quest item's pieces: sparkling spots on their map, only while the quest is on (one hidden piece shows only
//    within 4 tiles; three pieces lie at least 15 tiles apart); walk onto one to pick it up
//  - a hunt: one creature there carries it, glowing over its head (harder: more hits, a little quicker), and drops it when caught; gone
//    without that, another comes a minute later
//  - the dog: Go takes you to the place, not to the item. There it sniffs: it barks quicker the closer you are (Warm,
//    Warmer, Hot!), and after 2 minutes without a find it leads you to the next piece. All found: Go leads you to whoever
//    asked; Give hands it over (someone indoors or asleep: Finn takes it to them)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var FEEL = C.ADVENTURE_FEEL;
  var sfx = function (name, soft) { if (F.Audio) { if (soft && F.Audio.sfxSoft) F.Audio.sfxSoft(name, 0.5); else F.Audio.sfx(name); } };
  var mine = function () { return F.session.state; };
  var floorHere = function (w) { return w.mapKey === 'mine' ? F.session.mineFloor : null; };

  // ---------- where an adventure leads (the guide: 19zzzzzzzzzzzzz-guide.js) ----------
  L.advPersonMap = function (who) { return C.ADVENTURE_PEOPLE[who] ? C.ADVENTURE_PEOPLE[who].map : 'town'; };
  L.advPlace = function (s, i) {
    var q = s.dq && s.dq.list[i], a = L.advOf(q);
    if (!a || q.done) return null;
    if (q.gv || (q.got || 0) >= q.n) return { map: L.advPersonMap(a.who), to: 'who:' + a.who, say: 'Let\'s bring it to ' + L.advWho(a) + '!' };
    return { map: a.map, to: 'adv:' + i, say: a.how === 'hunt' ? 'Look for the one with the mark!' : 'Sniff, sniff... it\'s around here!' };
  };
  var guideTo = P.guideTo;
  P.guideTo = function (i) {
    var s = this.state, q = s.dq && s.dq.list[i];
    if (!L.advOf(q)) return guideTo.call(this, i);
    var place = L.advPlace(s, i);
    if (!place || F.session.visit) return false;
    F.session.guide = { i: i, c: 'adv', place: place };
    sfx('woof', true);
    return this.guideRun();
  };
  var here = function (w) { var f = w.feet(), fx = Math.floor(f.x / T), fy = Math.floor(f.y / T); return function (x, y) { return x === fx && y === fy; }; };
  var guideGoal = P.guideGoal;
  P.guideGoal = function (place) {
    var to = place && place.to;
    if (!to || this.mapKey !== place.map || (to.indexOf('adv:') && to.indexOf('who:'))) return guideGoal.call(this, place);
    var s = this.state;
    if (to.indexOf('adv:') === 0) return { goal: here(this), advAt: Number(to.slice(4)) };
    var who = to.slice(4), near = function (px, py) { var tx = Math.floor(px / T), ty = Math.floor(py / T); return function (x, y) { return Math.abs(x - tx) + Math.abs(y - ty) === 1; }; };
    if (who === 'luz' && this.tailor && this.tailor.img.visible) return { goal: near(this.tailor.x, this.tailor.y - 0.2 * T), advWho: who };
    if (who === 'kanor' && this.kanor && this.kanor.img.visible) return { goal: near(this.kanor.x, this.kanor.y), advWho: who };
    var v = (this.villagers && this.villagers.list || []).filter(function (x) { return x.key === who && x.visible && x.sprite && x.sprite.visible; })[0];
    if (v) return { who: v, advWho: who, goal: near(v.sprite.x, v.sprite.y) };
    void s;
    return { goal: here(this), advMail: who }; // (indoors, asleep or away: Finn takes it)
  };
  var guideArrive = P.guideArrive;
  // Kanor's jeep on the way (Pulag's, or a place's): it takes you to the place, or back to Pulag
  L.jeepTo = function (map) {
    var ids = Object.keys(C.PLACES);
    for (var k = 0; k < ids.length; k++) { var p = C.PLACES[ids[k]]; if (p.map === map && p.jeep) return p; }
    return null;
  };
  P.guideArrive = function () {
    var g = this.guide, spot = g && g.spot;
    if (spot && spot.exit && spot.exit.type === 'jeep' && F.session.guide) {
      var to = L.jeepTo(F.session.guide.place.map) || L.jeepTo('pulag');
      this.guide = null;
      if (to && to.map !== this.mapKey) { sfx('door'); this.travel(to.map, to.jeep); }
      return;
    }
    if (!spot || (spot.advAt == null && !spot.advMail)) return guideArrive.call(this);
    var s = this.state, name = L.dogName(s);
    if (spot.advMail) {
      var i = L.advFor(s, spot.advMail), a = i >= 0 && L.advOf(s.dq.list[i]), self = this;
      this.guideStop('arrived');
      if (!a) return;
      return F.ui.dialog(L.advWho(a).toUpperCase() + '\n' + L.advWho(a) + ' is not out right now. Finn the mail carrier can take it to them!', [
        { label: 'Not now', color: 0xa08a68 }, { label: 'Send it', cb: function () { self.advGive(i, null, true); } }]);
    }
    var q = s.dq.list[spot.advAt], ad = L.advOf(q);
    this.guideStop('arrived');
    if (!ad) return;
    if (ad.map === 'mine' && F.session.mineFloor !== L.advFloor(s, s.dq.d)) return F.ui.toast(name + ': the ' + ad.item + ' is on floor ' + L.advFloor(s, s.dq.d) + '! Down we go.', 3000);
    if (ad.how === 'hunt') { F.ui.toast(name + ': look for the ' + C.WILD.animals[ad.kind].name + ' with the gold mark!', 3000, 0x2f5a22); return; }
    F.session.sniff = { i: spot.advAt, map: this.mapKey, at: Date.now() };
    this.guideDogShow();
    F.ui.toast(name + ': sniff, sniff... the ' + L.advItemName(ad, q.n).toLowerCase() + ' must be close. Walk around, I\'ll tell you when it\'s warm!', 3400, 0x2f5a22);
  };
  // the dog stays by you while it sniffs
  var guideDogHide = P.guideDogHide;
  P.guideDogHide = function (force) {
    if (!force && F.session.sniff && F.session.sniff.map === this.mapKey && this.advSpots && this.advSpots.length) return;
    return guideDogHide.call(this);
  };

  // ---------- the pieces on the ground ----------
  var create = P.create;
  P.create = function () {
    create.call(this);
    this.advSpots = [];
    this.advMark = null;
    this.advBackAt = 0;
    if (F.session.sniff && F.session.sniff.map !== this.mapKey) F.session.sniff = null;
    if (F.session.visit || !this.map) return;
    this.advSetup();
  };
  // a free tile: on the map, walkable, nothing on it
  var free = function (w, x, y) { return w.inMap(x, y) && w.walkable(x, y) && !w.blocked[w.idx(x, y)]; };
  P.advSetup = function () {
    var self = this, s = mine();
    (this.advSpots || []).forEach(function (p) { if (p.img) { p.img.destroy(); p.glow.destroy(); } });
    this.advSpots = [];
    var W = this.map.width, H = this.map.height, f = this.feet(), fx = Math.floor(f.x / T), fy = Math.floor(f.y / T);
    L.advActive(s, this.mapKey, floorHere(this)).forEach(function (e) {
      if (e.a.how !== 'find') return;
      var chosen = [], seed = s.dq.d * 100 + e.a.i;
      for (var k = 0; k < e.q.n; k++) {
        var apart = FEEL.apart, away = FEEL.away, spot = null; // (not where you come in: owner, "not too easy")
        for (var t = 0; t < 400 && !spot; t++) {
          if (t === 150) { apart = 10; away = 6; } else if (t === 300) { apart = 5; away = 0; }
          var x = 1 + Math.floor(L.rand(s.seed || 1, seed + k * 7, t) * (W - 2)), y = 1 + Math.floor(L.rand(s.seed || 1, seed + k * 7 + 3, t) * (H - 2));
          if (!free(self, x, y) || Math.abs(x - fx) + Math.abs(y - fy) < away) continue;
          if (chosen.some(function (c) { return Math.abs(c.x - x) + Math.abs(c.y - y) < apart; })) continue;
          spot = { x: x, y: y };
        }
        if (!spot) continue;
        chosen.push(spot);
        if (e.q.gb & (1 << k)) continue; // (found already)
        self.advSpots.push(self.advSpotShow(e, k, spot.x, spot.y));
      }
    });
    this.advHunt();
  };
  var glowTex = function (scene) {
    var key = 'fx-advglow';
    if (scene.textures.exists(key)) return key;
    var t = scene.textures.createCanvas(key, 128, 128), g = t.getContext(), r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,240,160,0.95)');
    r.addColorStop(0.35, 'rgba(255,214,90,0.5)');
    r.addColorStop(1, 'rgba(255,214,90,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    t.refresh();
    return key;
  };
  P.advSpotShow = function (e, k, tx, ty) {
    var x = (tx + 0.5) * T, y = (ty + 0.6) * T, hidden = e.q.n === 1;
    var glow = this.add.image(x, y - 0.2 * T, glowTex(this)).setDisplaySize(1.3 * T, 1.3 * T).setDepth(DEPTH.flat + 0.2).setBlendMode(Phaser.BlendModes.ADD);
    var img = this.add.image(x, y - 0.35 * T, 'items', L.advIcon(e.a)).setScale(0.75 * T / 128).setDepth(DEPTH.actor + y / 1e5);
    this.tweens.add({ targets: img, y: y - 0.5 * T, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: glow, scale: glow.scale * 1.18, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    var p = { i: e.i, k: k, x: x, y: y, img: img, glow: glow, hidden: hidden };
    if (hidden) { img.setAlpha(0); glow.setAlpha(0); }
    return p;
  };
  P.advNearest = function () {
    var f = this.feet(), best = null;
    (this.advSpots || []).forEach(function (p) { var d = Math.hypot(p.x - f.x, p.y - f.y); if (!best || d < best.d) best = { p: p, d: d }; });
    return best;
  };
  P.advPick = function (p) {
    var s = mine(), q = s.dq.list[p.i], a = L.advOf(q), r = L.advFind(s, p.i, p.k), self = this;
    this.advSpots.splice(this.advSpots.indexOf(p), 1);
    this.tweens.killTweensOf([p.img, p.glow]);
    this.tweens.add({ targets: [p.img, p.glow], alpha: 0, y: p.y - 1.2 * T, duration: 500, onComplete: function () { p.img.destroy(); p.glow.destroy(); } });
    if (r === 'no' || !a) return;
    sfx('found');
    this.iconPop(p.x, p.y - 0.6 * T, L.advIcon(a));
    if (F.session.sniff) F.session.sniff.at = Date.now();
    if (r === 'all') {
      F.session.sniff = null;
      F.ui.toast((q.n > 1 ? 'All ' + q.n + ' ' + L.advItemName(a, q.n) + '!' : 'You found the ' + a.item + '!') + ' Bring ' + (q.n > 1 ? 'them' : 'it') + ' to ' + L.advWho(a) + '.', 3200, 0x7a4d12);
      if (this.guideDog && !this.guide) this.time.delayedCall(2200, function () { if (!self.guide && !F.session.sniff) guideDogHide.call(self); });
    } else F.ui.toast('Found ' + (q.got || 0) + ' of ' + q.n + ' ' + L.advItemName(a, q.n) + '!', 2200, 0x2f5a22);
    this.changed();
    this.save();
    if (F.ui.refreshQuestCard) { F.ui.qcKey = null; F.ui.refreshQuestCard(); }
  };

  // ---------- a hunt: the marked creature ----------
  P.advHunt = function () {
    var s = mine();
    if (!this.wild || !this.wild.zone || this.lair) return;
    var e = L.advActive(s, this.mapKey).filter(function (x) { return x.a.how === 'hunt'; })[0];
    if (!e || this.wild.animals.some(function (a) { return a.quest != null; })) return;
    if (this.wildFollowing() && this.wildFollowing() !== 'gs') return; // (a friend runs this hunt: theirs only)
    var def = C.WILD.animals[e.a.kind];
    if (!def) return;
    var p = this.wildSpot(this.wild.zone, this.feet(), 8) || this.wildSpot(this.wild.zone, null, 0);
    if (!p) return;
    var a = this.addWildAnimal(e.a.kind, 'q', p.x, p.y, 1.15);
    var d2 = Object.create(def);
    d2.run = def.run * FEEL.runX;
    a.def = d2;
    a.hp = a.max = Math.round(def.hp * (def.hp >= 4 ? FEEL.hpXBig : FEEL.hpX));
    a.quest = e.i;
    a.gsLocal = true; // (in a public room: this phone runs it, beside the game server's animals)
    // its mark: the thing it carries, glowing over its head (seen from afar)
    this.advMark = this.add.container(a.x, a.y).setDepth(DEPTH.fx);
    this.advMark.add([this.add.image(0, 0, glowTex(this)).setDisplaySize(1.4 * T, 1.4 * T).setBlendMode(Phaser.BlendModes.ADD), this.add.image(0, 0, 'items', L.advIcon(e.a)).setScale(0.8 * T / 128)]);
    this.tweens.add({ targets: this.advMark.list[0], scale: this.advMark.list[0].scale * 1.2, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };
  var wildStruck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    if (a.quest == null || friend) return wildStruck.call(this, a, friend);
    var lead = this.wild.lead; // (yours alone: this phone says when it is down)
    this.wild.lead = null;
    try { return wildStruck.call(this, a, friend); } finally { if (this.wild) this.wild.lead = lead; }
  };
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    var quest = a.quest, s = mine(), map = this.mapKey;
    wildDown.call(this, a);
    if (quest == null) return;
    delete s.wild.gone[map + ':q'];
    var q = s.dq && s.dq.list[quest], ad = L.advOf(q);
    if (!ad || !a.mine) return;
    if (L.advHunted(s, quest) !== 'all') return;
    this.iconPop(a.x, a.y - 1.2 * T, L.advIcon(ad));
    var self = this;
    this.time.delayedCall(1200, function () { if (F.ui) F.ui.toast('You got the ' + ad.item + '! Bring it to ' + L.advWho(ad) + '.', 3200, 0x7a4d12); });
    this.changed();
    this.save();
    if (F.ui.refreshQuestCard) { F.ui.qcKey = null; F.ui.refreshQuestCard(); }
    void self;
  };
  var wildGone = P.wildGone;
  P.wildGone = function (a) {
    wildGone.call(this, a);
    if (a.quest == null) return;
    if (this.advMark) { this.advMark.destroy(); this.advMark = null; }
    this.advBackAt = Date.now() + FEEL.back; // (another comes in a minute, if it is still wanted)
  };

  // ---------- each frame: pick up, the mark, the dog's nose, the help ----------
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (!this.player || !this.sys || !this.sys.isActive() || F.session.visit) return;
    var self = this, f = this.feet(), now = Date.now(), s = mine();
    (this.advSpots || []).slice().forEach(function (p) {
      var d = Math.hypot(p.x - f.x, p.y - f.y);
      if (p.hidden) { var show = d < FEEL.hidden * T ? 1 : 0; if (p.img.alpha !== show && !p.fading) { p.fading = true; self.tweens.add({ targets: [p.img, p.glow], alpha: show, duration: 400, onComplete: function () { p.fading = false; } }); } }
      if (d < 0.7 * T) self.advPick(p);
    });
    if (this.wild && this.advMark) {
      var qa = this.wild.animals.filter(function (a) { return a.quest != null; })[0];
      if (qa) this.advMark.setPosition(qa.x, qa.y - (qa.def.w * T * qa.size + 0.5 * T) + Math.sin(time / 220) * 12);
    }
    if (this.wild && this.advBackAt && now > this.advBackAt) { this.advBackAt = 0; this.advHunt(); }
    var sn = F.session.sniff;
    if (!sn || sn.map !== this.mapKey) return;
    var q = s.dq && s.dq.list[sn.i];
    if (!q || q.gv || (q.got || 0) >= q.n || !this.advSpots.length) { F.session.sniff = null; return; }
    if (!this.guideDog) this.guideDogShow();
    var near = this.advNearest(), tiles = near ? near.d / T : 99;
    // warmer, colder: it barks quicker the closer you are
    var every = tiles < 4 ? 900 : tiles < 8 ? 1600 : tiles < 15 ? 2800 : 4500;
    if (!this.guide && now - (this.advBarkAt || 0) > every) {
      this.advBarkAt = now;
      var d = this.guideDog;
      if (d) {
        sfx('woof', tiles >= 8);
        this.floatTextAt(d.x, d.y - 0.9 * T, tiles < 4 ? 'Hot!' : tiles < 8 ? 'Warmer!' : tiles < 15 ? 'Warm' : 'Sniff...');
        if (d.sprite) this.tweens.add({ targets: d.sprite, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 3, onComplete: function () { if (d.sprite.active) d.sprite.setAngle(0); } });
      }
    }
    // stuck a while: it leads you to the next piece (no one is stuck: owner, "not too hard")
    if (!this.guide && near && now - sn.at > FEEL.help) {
      sn.at = now;
      var px = Math.floor(near.p.x / T), py = Math.floor(near.p.y / T), path = this.guidePath(function (x, y) { return x === px && y === py; }); // (onto it: walking on picks it up)
      if (path && path.length) {
        F.session.guide = { i: sn.i, c: 'adv', place: { map: this.mapKey, to: 'piece', say: '' } };
        this.guide = { path: path, k: 0, spot: { goal: function () { return false; }, advPiece: true }, last: f, at: now, tries: 0 };
        F.ui.toast(L.dogName(s) + ': follow me, I smell it!', 2200, 0x2f5a22);
      }
    }
  };
  // (the help's arrival: just stop; walking on picks it up)
  var arrive = P.guideArrive;
  P.guideArrive = function () {
    var g = this.guide;
    if (g && g.spot && g.spot.advPiece) { this.guide = null; F.session.guide = null; F.bus.emit('guide', 'arrived'); return; }
    return arrive.call(this);
  };

  // ---------- handing it over ----------
  P.advGive = function (i, v, mail) {
    var s = mine(), q = s.dq.list[i], a = L.advOf(q), r = L.advHandOver(s, i);
    if (!a) return;
    if (r === 'full') { sfx('nope'); return F.ui.toast(L.advWho(a) + ' says thank you! Your bag is full: claim the prize in Quests.', 3000); }
    if (typeof r !== 'object') return;
    sfx('coin');
    if (v && this.villagers) { this.villagers.greet(v, this.dir); this.emote(v, C.ICON.heart); }
    var done = function () {
      F.ui.toast('Adventure prize: ' + L.rewardLabel(r) + (C.VILLAGERS[a.who] ? ' and a heart with ' + L.advWho(a) : '') + '!', 2800, 0x7a4d12);
      // the story's keepsake (5 chapters): its person says so
      var st = r.keepsake && C.STORIES.filter(function (x) { return x.key === r.keepsake; })[0];
      if (st) F.ui.time.delayedCall(900, function () { sfx('fanfare'); F.ui.dialog(st.title.toUpperCase() + '\n' + L.advWho(a) + ': "' + st.thanks + '"', [{ label: 'Thank you!' }]); });
    };
    if (mail) F.ui.dialog('FINN\nI\'ll take it to ' + L.advWho(a) + ' right away! ' + L.advWho(a) + ' says: "' + a.thanks + '"', [{ label: 'OK', cb: done }]);
    else if (C.VILLAGERS[a.who] && F.ui.say) { F.ui.say(a.who, L.advWho(a), a.thanks); done(); }
    else F.ui.dialog(L.advWho(a).toUpperCase() + '\n' + a.thanks, [{ label: 'OK', cb: done }]);
    this.changed();
    this.save();
    if (F.ui.refreshQuestCard) { F.ui.qcKey = null; F.ui.refreshQuestCard(); }
  };
  var villagerAction = P.villagerAction;
  P.villagerAction = function (v) {
    var self = this, s = this.state, i = v.shopper || F.session.visit ? -1 : L.advFor(s, v.key);
    if (i >= 0) return { label: 'Give', icon: L.advIcon(L.advOf(s.dq.list[i])), run: function () { self.advGive(i, v); } };
    return villagerAction.call(this, v);
  };
  var resolve = P.resolve;
  P.resolve = function () {
    var self = this, s = this.state, pt = this.front(0.7);
    if (!F.session.visit) {
      var who = this.tailor && this.tailor.img.visible && Math.hypot(pt.x - this.tailor.x, pt.y - this.tailor.y) < 0.9 * T ? 'luz'
        : this.kanor && this.kanor.img.visible && Math.hypot(pt.x - this.kanor.x, pt.y - this.kanor.y) < 0.9 * T ? 'kanor' : null;
      var i = who ? L.advFor(s, who) : -1;
      if (i >= 0) return { label: 'Give', icon: L.advIcon(L.advOf(s.dq.list[i])), run: function () { self.advGive(i, null); } };
    }
    return resolve.call(this);
  };

  // ---------- the first-time tour (owner, 4 Oct 2026: every new feature gets one) ----------
  var U = F.UIScene.prototype, INK = F.UI_CONST.INK;
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size) { var w = ui.txt(x, y, str, size || 12, INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(w); return w; };
  var three = function () { return ['silk', 'tooth', 'kite'].map(function (k) { return L.advIcon(L.advDef(k)); }); };
  F.TOURS.adventure = {
    title: 'DAILY ADVENTURES',
    steps: [
      {
        text: 'Each day: 3 everyday quests and 3 adventures. Finish any 5 to open the day\'s chest.',
        draw: function (ui, sc, move) {
          three().forEach(function (f, n) {
            var im = icon(ui, sc, 60 + n * 56, 66, f, 0.34);
            if (move) ui.tweens.add({ targets: im, y: 56, duration: 420, delay: n * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
          icon(ui, sc, 236, 66, C.ICON.chest, 0.34);
        },
      },
      {
        text: 'A villager asks for something that only shows while the quest is on. Tap Go: your dog takes you there.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 90, 76, C.ICON.dog, 0.36);
          var s = icon(ui, sc, 190, 66, three()[0], 0.36);
          if (move) ui.tweens.add({ targets: s, alpha: { from: 1, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Walk around: your dog barks quicker the closer you are. Warm, warmer, hot!',
        draw: function (ui, sc, move) {
          var a = words(ui, sc, 70, 50, 'Warm', 13), b = words(ui, sc, 140, 70, 'Warmer!', 14), c = words(ui, sc, 220, 92, 'Hot!', 16);
          if (move) [a, b, c].forEach(function (w, n) { ui.tweens.add({ targets: w, scale: 1.2, duration: 300, delay: n * 300, yoyo: true, repeat: -1, repeatDelay: 600 }); });
        },
      },
      {
        text: 'Some are hunted: look for the creature carrying it. Bring it back for a prize. 5 good days open the weekly chest.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 100, 80, C.ICON.bow, 0.36);
          var t = icon(ui, sc, 190, 60, three()[1], 0.34);
          if (move) ui.tweens.add({ targets: t, y: 50, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
    ],
  };
  var openQuests = U.openQuests;
  U.openQuests = function (tab, page) {
    var self = this, s = F.session.state;
    L.refreshQuests(s, F.today());
    if ((tab || 'daily') === 'daily' && L.daily2(s) && !(window.gameHost && window.gameHost.quiet) && L.takeTip(s, 'adv_tour')) {
      if (F.world) F.world.save();
      return this.tour('adventure', function () { openQuests.call(self, tab, page); });
    }
    return openQuests.call(this, tab, page);
  };
})(window.Farm = window.Farm || {});
