// Skills on screen (rules: 01-logicZ-skills.js, content: 00-zzzzzzz-skills.js). XP comes in quietly as you farm, mine,
// fish and hunt; a level-up shows a small card with what the new level gives (tap it for the Skills panel). The Skills
// panel opens from your farmer card in the pause menu, or from the Collection: four bars and the next perk of each, and
// a tap on a skill lists all of its perks. On a visit, the player menu says the farmer's levels. A tour after your
// first level-up (or the first time Skills opens).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var SK = C.SKILLS;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK, SLOT = K.SLOT, ICON = K.ICON;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, RED = 0xc0503a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var iconOf = function (key) { return C.ICON[SK.skills[key].icon]; };

  // ---------- the farmer's own actions count (see L.skillAct) ----------
  ['useTool', 'harvest', 'plantArea'].forEach(function (name) {
    var orig = P[name];
    P[name] = function () {
      var self = this, args = arguments;
      return L.skillAct(this.state, function () { return orig.apply(self, args); });
    };
  });

  // a mine rock: what it held is what breakRock put in `items`
  var breakRock = P.breakRock;
  P.breakRock = function (idx, t, items) {
    var before = {};
    Object.keys(items).forEach(function (k) { before[k] = items[k]; });
    var show = breakRock.apply(this, arguments);
    if (!show || this.state.isVisit) return show;
    var drop = null;
    Object.keys(items).forEach(function (k) { if (items[k] > (before[k] || 0)) drop = k; });
    var more = L.skillRock(this.state, drop);
    if (more) items[more] += 1; // (the swing's "+2 Copper Ore")
    return show;
  };

  // the reel game: a bigger bar and slower fish with the perks; a catch counts as yours, a miss teaches a little
  var startFishGame = U.startFishGame;
  U.startFishGame = function (fishId, done) {
    var w = F.world, s = w && w.state, G = C.FISH_GAME;
    if (!s || s.isVisit) return startFishGame.apply(this, arguments);
    var base = G[fishId] || G.fish_m, reel = L.skillReel(s, base);
    if (reel.zone !== base.zone || reel.speed !== base.speed) {
      var mine = Object.create(G); // (the rest still read through to the real table)
      mine[fishId] = reel;
      C.FISH_GAME = mine; // read once as the game starts
    }
    try {
      return startFishGame.call(this, fishId, function (ok) {
        if (!ok) { L.skillFishMiss(s); if (w.changed) w.changed(); return done(ok); }
        return L.skillAct(s, function () { return done(ok); });
      });
    } finally {
      C.FISH_GAME = G;
    }
  };

  // hunting: a strong shot now and then; giants a little more often
  var wildStruck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    var s = this.state;
    if (friend || !s) return wildStruck.apply(this, arguments);
    s.skHit = L.skillStrong(s) ? 1 : 0;
    var strong = s.skHit;
    try { wildStruck.apply(this, arguments); } finally { s.skHit = 0; }
    if (strong) this.floatTextAt(a.x, a.y - 1.6 * C.TILE, 'Strong shot!');
  };
  var wildSize = L.wildSize;
  L.wildSize = function (rnd) {
    var size = wildSize(rnd), s = F.session && F.session.state;
    return s && !F.session.visit ? L.skillGiant(size, C.WILD.giant, L.skillPerk(s, 'hunt', 'giant'), rnd) : size;
  };

  // ---------- after each action: a level-up card, a perk's little moment ----------
  var changed = P.changed;
  P.changed = function () {
    changed.apply(this, arguments);
    var self = this;
    if (L.skillPops.length) {
      var pops = L.takeSkillPops();
      this.time.delayedCall(450, function () {
        if (!self.player || !self.player.active) return;
        var f = self.feet();
        pops.forEach(function (p, i) { if (p.key === 'farm') self.floatTextAt(f.x, f.y - (2.4 + i * 0.6) * C.TILE, 'Lucky! +1 ' + C.ITEMS[p.id].name); });
      });
    }
    if (L.skillUps.length && F.ui) F.ui.skillUps(L.takeSkillUps());
  };

  // The level-up cards wait their turn: one at a time, never over a panel.
  U.skillUps = function (ups) {
    var self = this;
    this.skQueue = (this.skQueue || []).concat(ups);
    if (this.skBusy) return;
    var next = function (tries) {
      if (!self.skQueue.length) { self.skBusy = false; return self.skillsTourSoon(); }
      if ((self.modals.length || (F.world && F.world.busy)) && tries < 40) return self.time.delayedCall(700, function () { next(tries + 1); });
      self.levelCard(self.skQueue.shift(), function () { next(0); });
    };
    this.skBusy = true;
    this.time.delayedCall(1100, function () { next(0); }); // after the action's own words
  };

  // A small centred card: the skill, its new level and what it gives. Tap it for the Skills panel.
  U.levelCard = function (up, then) {
    var self = this, def = SK.skills[up.key], perk = def.perks.filter(function (p) { return p.at === up.level; })[0];
    var nxt = def.perks.filter(function (p) { return p.at > up.level; })[0];
    var line = perk ? perk.text : nxt ? 'Next perk at level ' + nxt.at + '.' : '';
    var cw = 292, x0 = (W - cw) / 2, y0 = 178;
    var c = this.add.container(0, C.EXTRA / 2).setDepth(95);
    var body = this.txt(W / 2 + 26, 0, line, 13, INK, { align: 'center', wordWrap: { width: cw - 92 }, lineSpacing: 2 }).setOrigin(0.5, 0);
    var ch = Math.max(104, 64 + body.height + 14);
    this.panelImg(c, x0, y0, cw, ch);
    this.ribbon(c, W / 2, y0 + 4, 170);
    c.add(this.txt(W / 2, y0 + 4, 'LEVEL UP!', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5));
    c.add(this.add.image(x0 + 18, y0 + 30, this.slotTex('plain')).setOrigin(0).setScale(1 / F.R));
    c.add(this.add.image(x0 + 20 + SLOT / 2, y0 + 32 + SLOT / 2, 'items', iconOf(up.key)).setScale(ICON));
    c.add(this.txt(W / 2 + 26, y0 + 32, def.name + '  Level ' + up.level, 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    body.setY(y0 + 58).setColor(perk ? '#2f5a22' : '#6a4a2a');
    c.add(body);
    var z = this.add.zone(W / 2, y0 + ch / 2, cw, ch).setInteractive({ useHandCursor: true });
    c.add(z);
    var gone = false, close = function (open) {
      if (gone) return;
      gone = true;
      self.tweens.killTweensOf(c);
      c.destroy();
      if (open && !self.modals.length) self.openSkills();
      if (then) then();
    };
    F.tapOn(z, function () { close(true); });
    this.skCard = c;
    sfx('fanfare');
    c.setAlpha(0);
    c.y += 14;
    this.tweens.add({ targets: c, alpha: 1, y: c.y - 14, duration: 240, ease: 'Back.out' });
    this.time.delayedCall(200, function () { if (!gone && self.confetti) self.confetti(W / 2, y0 + C.EXTRA / 2 + 20); });
    this.time.delayedCall(3600, function () {
      if (gone) return;
      self.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: function () { close(false); } });
    });
    // a panel opening over it: it goes (it is not a panel)
    var watch = this.time.addEvent({ delay: 200, loop: true, callback: function () { if (gone) return watch.remove(); if (self.modals.length) { watch.remove(); close(false); } } });
  };

  // ---------- the Skills panel ----------
  // st: whose (yours when left out); who: their name (a friend's, read only); back(): after X
  U.openSkills = function (st, who, back) {
    var self = this, s = st || F.session.state, own = !st || st === F.session.state;
    if (own && !who && this.skillsTour(function () { self.openSkills(st, who, back); })) return;
    var c = this.openModal(function () { self.closeModal(); if (back) back(); });
    var RH = 88, GAP = 6, PH = 84 + SK.order.length * (RH + GAP) + 10, top = Math.round((H - PH) / 2);
    this.panelImg(c, 12, top, W - 24, PH);
    c.add(this.txt(W / 2, top + 14, who ? who + "'s Skills" : 'Skills', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, top + 28, 46, 34, 'X', function () { self.closeModal(); if (back) back(); }, RED);
    c.add(this.txt(W / 2, top + 46, own ? 'Tap a skill to see all of its perks.' : 'What ' + who + ' is good at.', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5, 0));
    SK.order.forEach(function (key, i) {
      var def = SK.skills[key], info = L.skillInfo(s, key), y = top + 78 + i * (RH + GAP), nx = L.skillNextPerk(s, key);
      self.baked(c, 24, y, 'ui-skrow', W - 48, RH, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, W - 48, RH, 10); });
      c.add(self.add.image(30, y + 10, self.slotTex('plain')).setOrigin(0).setScale(1 / F.R));
      c.add(self.add.image(32 + SLOT / 2, y + 12 + SLOT / 2, 'items', iconOf(key)).setScale(ICON));
      c.add(self.txt(88, y + 8, def.name, 15, INK, { fontStyle: 'bold' }));
      c.add(self.txt(W - 36, y + 8, 'Level ' + info.level, 15, info.level >= SK.max ? '#a8740c' : '#2f5a22', { fontStyle: 'bold' }).setOrigin(1, 0));
      // the bar
      var bw = W - 36 - 88;
      c.add(self.add.rectangle(88, y + 36, bw, 10, 0x3d2614, 0.25).setOrigin(0, 0.5));
      c.add(self.add.rectangle(89, y + 36, Math.max(info.part > 0 ? 3 : 0, (bw - 2) * info.part), 8, info.level >= SK.max ? 0xffd23f : GREEN).setOrigin(0, 0.5));
      var under = !own ? (info.level >= SK.max ? 'Top level!' : '')
        : info.to ? fmt(info.xp - info.from) + ' / ' + fmt(info.to - info.from) + ' XP to level ' + (info.level + 1) : 'Top level! ' + fmt(info.xp) + ' XP';
      if (under) c.add(self.txt(88, y + 44, under, 11, '#6a4a2a'));
      var perkLine = nx ? 'Level ' + nx.at + ': ' + nx.text : 'All of its perks are yours.';
      if (!own) perkLine = L.skillPerks(s, key).length ? L.skillPerks(s, key).length + ' of ' + def.perks.length + ' perks' : 'No perks yet';
      var pl = self.txt(88, y + (under ? 59 : 46), perkLine, 11, nx || !own ? INK : '#2f5a22', { wordWrap: { width: bw }, lineSpacing: 1 });
      if (pl.height > 30) pl.setFontSize(10);
      c.add(pl);
      if (own) {
        var z = self.add.zone(W / 2, y + RH / 2, W - 48, RH).setInteractive({ useHandCursor: true });
        F.tapOn(z, function () { self.skillPerksDialog(key, function () { self.openSkills(st, who, back); }); });
        c.add(z);
      }
    });
    return c;
  };

  // All the perks of one skill: the ones you have ticked.
  U.skillPerksDialog = function (key, then) {
    var s = F.session.state, def = SK.skills[key], n = L.skillLevel(s, key);
    this.closeModal();
    this.dialog(def.name.toUpperCase() + '  LEVEL ' + n, [{ label: 'OK', cb: then }], {
      rows: [[C.ICON.book, def.verb + ' Each level up makes you better.']].concat(def.perks.map(function (p) {
        return [p.at <= n ? C.ICON.star : iconOf(key), 'Level ' + p.at + (p.at <= n ? ' \u2713  ' : ':  ') + p.text];
      })),
    });
  };

  // ---------- where Skills opens ----------
  // the farmer card in the pause menu: "Skills" at the right of the date line
  var openPause = U.openPause;
  U.openPause = function () {
    openPause.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1];
    if (!m || F.session.visit) return;
    var c = m.c, date = null, R0 = W - 42;
    c.list.forEach(function (o) { if (o.type === 'Text' && / · /.test(o.text) && /\d{4}/.test(o.text)) date = o; });
    if (!date) return;
    var y = date.y, sum = SK.order.reduce(function (a, k) { return a + L.skillLevel(F.session.state, k); }, 0);
    var link = this.add.container(0, 0);
    var t = this.txt(R0 - 12, y, 'Skills', 12, '#2f6fae', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    var star = this.add.image(t.x - t.width - 9, y, 'items', C.ICON.star).setScale(0.13);
    link.add([star, t]);
    var left = star.x - 9;
    if (date.x + date.displayWidth > left - 4) date.setScale((left - 4 - date.x) / date.width); // (a long date makes room)
    var z = this.add.zone((left + R0) / 2, y, R0 - left + 6, 28).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { self.closeModal(); self.openSkills(null, null, function () { self.openPause(); }); });
    link.add(z);
    link.name = 'skills-link';
    link.sum = sum;
    c.add(link);
  };
  // the Collection: a small Skills button, left of Crop stars (19k-farm2.js, 132) and Hunts (19v-wild.js, 228)
  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.apply(this, arguments);
    var self = this, m = this.modals[this.modals.length - 1];
    if (!m) return;
    this.button(m.c, 54, 150, 60, 30, 'Skills', function () { self.closeModal(); self.openSkills(null, null, function () { self.openCollection(); }); }, GREY);
  };
  // a visit: the player menu says the farmer's levels, on its top line (Farm 4 · Mine 2 · Fish 7 · Hunt 1)
  var listPanel = U.listPanel;
  var playerMenu = U.playerMenu;
  U.playerMenu = function (id, who) {
    var v = F.session.visit, st = v && v.host === id && v.state;
    if (!st || !SK.order.some(function (k) { return L.skillLevel(st, k) > 1; })) return playerMenu.apply(this, arguments);
    var self = this;
    this.listPanel = function (o) {
      delete self.listPanel;
      var line = SK.order.map(function (k) { return SK.skills[k].short + ' ' + L.skillLevel(st, k); }).join(' · ');
      o.sub = function () { return line; };
      return listPanel.call(self, o);
    };
    try { return playerMenu.apply(this, arguments); } finally { delete this.listPanel; }
  };

  // ---------- the tour ----------
  var take = function (key) {
    var s = F.session && F.session.state;
    if (!s || F.session.visit || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  // the first time Skills opens: the tour first (true when it took over)
  U.skillsTour = function (then) {
    if (!take('skills_tour')) return false;
    this.tour('skills', then);
    return true;
  };
  // after the first level-up card
  U.skillsTourSoon = function () {
    var self = this, s = F.session && F.session.state;
    if (!s || L.tipSeen(s, 'skills_tour') || quiet()) return;
    var tries = 0, open = function () {
      if (L.tipSeen(s, 'skills_tour')) return;
      if ((self.modals.length || (F.world && F.world.busy) || document.getElementById('farm-ask')) && tries++ < 30) return self.time.delayedCall(1500, open);
      if (take('skills_tour')) self.tour('skills');
    };
    this.time.delayedCall(600, open);
  };

  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.skills = {
    title: 'SKILLS',
    steps: [
      {
        text: 'Farming, mining, fishing and hunting: you get better at each just by doing it.',
        draw: function (ui, sc, move) {
          SK.order.forEach(function (k, n) {
            var x = 46 + n * 60, im = icon(ui, sc, x, 56, iconOf(k), 0.32);
            words(ui, sc, x, 104, SK.skills[k].name, 11);
            tw(ui, move, { targets: im, y: 46, duration: 380, delay: n * 160, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Each level up says what it gives: less energy, a bigger green bar, an extra crop, a strong shot...',
        draw: function (ui, sc, move) {
          icon(ui, sc, 64, 66, C.ICON.rod, 0.36);
          var t = words(ui, sc, 170, 46, 'LEVEL UP!', 18, '#a8740c');
          words(ui, sc, 170, 76, 'Fishing  Level 3', 14);
          words(ui, sc, 170, 100, 'A 10% bigger green bar', 12, '#2f5a22');
          tw(ui, move, { targets: t, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'Find Skills on your farmer card in the pause menu. Friends can see your levels too.',
        draw: function (ui, sc, move) {
          words(ui, sc, 70, 40, 'Farming', 13);
          words(ui, sc, 226, 40, 'Level 4', 13, '#2f5a22');
          sc.add(ui.add.rectangle(36, 66, 200, 12, 0x3d2614, 0.25).setOrigin(0, 0.5));
          var bar = ui.add.rectangle(37, 66, 198, 10, GREEN).setOrigin(0, 0.5).setScale(move ? 0.1 : 0.6, 1);
          sc.add(bar);
          words(ui, sc, 136, 96, 'Level 5: 15% less energy', 12);
          tw(ui, move, { targets: bar, scaleX: 1, duration: 1800, repeat: -1, repeatDelay: 500, ease: 'Sine.inOut' });
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
