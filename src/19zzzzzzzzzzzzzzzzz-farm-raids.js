// Farm Raids on screen, step 1 (owner, 9 Nov 2026; docs/raids.md; rules 01-logicZZZZZZZZZZZ-raids.js):
//  - the Raid Camp on your farm (Mira's, Workshops): tap it for its panel: Party (train), Raiders (level up),
//    Defenses (level up; placing them on your farm comes with real raids), Practice (the bandit farms)
//  - a battle: its own screen over the game. Drag to look around; pick a raider below and tap the light edge of the
//    farm to send it in. 2 minutes; the loot and the stars count up at the top; End stops it.
// Until their pictures are in (art-src/RAID-PROMPTS.md), raiders and defenses borrow pictures the game has.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;
  var O = C.OUTDOOR;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0xe9a91c, RED = 0xc0503a;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var world = function () { return F.world; };
  // Mira's cards say what the Raid Camp and each defense do (not just the beauty)
  var yardInfo = F.yardInfo;
  F.yardInfo = function (s, i) {
    var type = O.types[i];
    if (type && type.key === 'raid_camp') return 'Train raiders here and raid bandit farms. One per farm.' + (L.yardCantBuy && L.yardCantBuy(s, i) ? ' You have one.' : '');
    if (type && type.defense && R.defenses[type.defense]) return R.defenses[type.defense].say + ' Guards your farm in a raid.';
    return yardInfo ? yardInfo(s, i) : null;
  };

  // ---------- the Raid Camp on the farm (a workshop-like piece: one per farm) ----------
  // (the Raid Camp and the defenses you place: 00-zzzzzzzzzzzzzzzzz-raids.js)
  var campAt = function (s, x, y) {
    var items = (s.yard && s.yard.items) || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], type = O.types[it.t];
      if (type && type.key === 'raid_camp' && x >= it.x && x < it.x + type.w && y >= it.y && y < it.y + type.h) return it;
    }
    return null;
  };
  L.hasRaidCamp = function (s) { return ((s.yard && s.yard.items) || []).some(function (it) { var t = O.types[it.t]; return t && t.key === 'raid_camp'; }); };
  var farm2Action = P.farm2Action;
  P.farm2Action = function (t) {
    var s = this.state;
    if (campAt(s, t.x, t.y)) return { label: 'Raids', icon: C.ICON.ri_flag != null ? C.ICON.ri_flag : C.ICON.star, run: function () { F.ui.openRaidCamp('party'); } };
    return farm2Action.call(this, t);
  };

  // the Farm Shield in your hands: Use (24 hours); one already up: it says so
  var resolveShield = P.resolve;
  P.resolve = function () {
    var s = this.state, held = L.held ? L.held(s) : null, self = this;
    if (held && held.id === 'farm_shield' && !F.session.visit) {
      return { label: 'Use', icon: C.ICON.ri_shield != null ? C.ICON.ri_shield : C.ICON.star, run: function () {
        var left = L.shieldLeft(s, Date.now());
        var go = function () {
          if (L.useShield(s, s.sel, Date.now()) !== 'ok') return;
          sfx('found');
          self.floatTextAt(self.feet().x, self.feet().y - 1.6 * C.TILE, 'SHIELDED!');
          F.ui.toast('Your farm is shielded for 24 hours. Raiding another farm breaks it.', 3200, 0x2f5a22);
          self.changed();
          self.save();
        };
        if (left > 3600000) return F.ui.confirm('USE ANOTHER SHIELD?\nYour shield still has ' + Math.floor(left / 3600000) + ' hours. A new one starts 24 hours from now.', go);
        go();
      } };
    }
    return resolveShield.call(this);
  };

  // ---------- pictures (borrowed until the raid art is in) ----------
  var RAIDER_ICON = { goat: 'horn_goat', crow: 'feather_labuyo', cat: 'cat_basket', carabao: 'horn_carabao', monkey: 'banana_wild', boar: 'tusk', rooster: 'feather_labuyo', bayawak: 'scale_bayawak' };
  var DEF_ICON = { dog: 'dog', scarecrow: null, fence: null, goose: 'egg', beebox: 'wild_honey', mudpit: null, sprinkler: 'act_wish', tower: 'act_board', sili: 'chili', kampana: 'act_bell' };
  L.raiderIcon = function (k) { if (C.FRAID_ICONS_IN && C.ICON['ri_' + k] != null) return C.ICON['ri_' + k]; var n = RAIDER_ICON[k]; return C.ICON[n] != null ? C.ICON[n] : C.ICON.star; };
  L.defenseIcon = function (k) { var n = DEF_ICON[k]; return n && C.ICON[n] != null ? C.ICON[n] : k === 'scarecrow' ? C.ICON.star : C.ICON.sparkle; };
  // a defense's own picture: props/def_<k> (tools/art/raids-import.js), the yard's scarecrow, a copper sprinkler, the dog
  var DEF_PROP = { beebox: 1, mudpit: 1, tower: 1, sili: 1, kampana: 1, fence: 1, sprinkler: 1 };
  F.defensePic = function (scene, k) {
    if (DEF_PROP[k] && F.images['props/def_' + k]) return { key: F.ensureTexture(scene, 'props/def_' + k), frame: undefined };
    if (k === 'scarecrow' && F.yardImg) { var y = F.yardImg(scene, O.index.scarecrow); return { key: y.key, frame: y.frame }; }
    if (k === 'goose' && F.images.guard_goose) return { key: F.ensureTexture(scene, 'guard_goose'), frame: 0 };
    if (k === 'dog') return { key: F.ensureTexture(scene, 'animals'), frame: C.DOG.frame0 };
    if (k === 'sprinkler') return { key: 'items', frame: C.ICON.sprinkler_copper };
    return { key: 'items', frame: L.defenseIcon(k) };
  };
  if (F.SHEETS) { ['raid_crow', 'guard_goose', 'raid_cat'].forEach(function (k) { F.SHEETS[k] = F.SHEETS.wild; F.SHEETS[k + 'shade'] = F.SHEETS.wildshade; }); }
  if (F.SHEETS) F.SHEETS.raid_fx = { frameWidth: 128, frameHeight: 128 }; // the battle's effects (C.FRAID_FX)
  F.raidFx = function (k) { return C.FRAID_FX.indexOf(k); };
  // a defense from the Raid Camp: one from storage, or bought now, and straight into Decorate to put it down
  U.raidDefensePlace = function (t) {
    var s = F.session.state, w = F.world;
    if (!s.yard.bag[t]) {
      var r = L.buyYard(s, t, 1);
      if (r === 'gold') { sfx('nope'); return this.toast('Not enough Gold.'); }
      if (r === 'cap') { sfx('nope'); return this.toast('That is all your Raid Camp allows. Upgrade it for more.'); }
      if (r !== 'ok') { sfx('nope'); return this.toast("Mira can't sell that right now."); }
      sfx('coin');
      if (w) { w.changed(); w.save(); }
    }
    this.closeAll();
    if (!w || w.mapKey !== 'farm' || F.session.visit) return this.toast('In your yard storage. Place it with Decorate on your farm.', 3500);
    this.openDecor();
    if (w.yd) { w.yardPlace(t); this.toast('Drag it where it should guard, then OK.', 3500, 0x2f5a22); }
  };

  // ---------- the first-time tour (owner, 4 Oct 2026: every new feature gets one) ----------
  // (its tip goes last of all, after the dog's name: a tip's place is its bit in the save; 'raid_tour' is the Town Raid's)
  C.TIPS.push({ key: 'farmraid_tour', text: 'FARM RAIDS' });
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var ri = function (k) { return C.ICON['ri_' + k] != null ? C.ICON['ri_' + k] : C.ICON.star; };
  F.TOURS.raids = {
    title: 'FARM RAIDS',
    steps: [
      {
        text: 'Train raiders at your Raid Camp: goats eat crops, crows fly over fences, cats take eggs and milk.',
        draw: function (ui, sc, move) {
          ['goat', 'crow', 'cat', 'carabao'].forEach(function (k, n) {
            var im = icon(ui, sc, 52 + n * 56, 66, ri(k), 0.36);
            if (move) ui.tweens.add({ targets: im, y: 56, duration: 380, delay: n * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Raid a farm: press and drag on the green ground to send them in. Two minutes to grab what you can.',
        draw: function (ui, sc, move) {
          var f = icon(ui, sc, 80, 70, ri('flag'), 0.38), g = icon(ui, sc, 180, 70, ri('goat'), 0.3);
          if (move) ui.tweens.add({ targets: g, x: 220, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          void f;
        },
      },
      {
        text: 'Guard your own farm: buy defenses at Mira\'s (Defenses) and place them with Decorate. Fences and your dog help too.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 90, 70, ri('shield'), 0.38);
          var d = icon(ui, sc, 180, 70, C.ICON.dog, 0.34);
          if (move) ui.tweens.add({ targets: d, angle: { from: -8, to: 8 }, duration: 300, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Practice on the bandit farms first, or test your own. Stars win Gold and Raid Points.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 90, 70, ri('bandit'), 0.38);
          var p = icon(ui, sc, 180, 70, ri('points'), 0.36);
          if (move) ui.tweens.add({ targets: p, scale: p.scale * 1.15, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // ---------- the panel ----------
  var TABS = [['party', 'Party'], ['raiders', 'Raiders'], ['defenses', 'Defenses'], ['practice', 'Raid']]; // (owner, 10 Nov 2026: "why its called practice?": real raids are there too)
  var why = { lumber: 'Not enough lumber: chop branches and stumps.', stone: 'Not enough stone: smash stones and rocks.', busy: 'The camp is already being upgraded.', gold: 'Not enough Gold.', space: 'The camp is full. Upgrade it for a bigger party.', locked: 'A higher camp opens it.', top: 'Already the best.', need: 'You need something from hunting first (see what it needs).', buy: 'Buy a Raid Camp at Mira\'s first.',
    // (farm economy v2: raiders eat crops; levels need the Mixer's materials)
    crops: 'Not enough of its food: plant it, or keep it in your Silo.', cement: 'You need Farm Cement from the Mixer.', rope: 'You need Rope from the Mixer.', mats: 'You need materials from the Mixer (see what it needs).' };
  var food = function (c) { return c ? c[1] + ' ' + C.ITEMS[c[0]].name : ''; };
  U.openRaidCamp = function (tab, page) {
    var self = this, s = F.session.state, r = L.frState(s), now = Date.now();
    if (!(window.gameHost && window.gameHost.quiet) && L.takeTip(s, 'farmraid_tour')) { // (the first time: the tour first)
      if (F.world) F.world.save();
      return this.tour('raids', function () { self.openRaidCamp(tab, page); });
    }
    if (!r.camp && L.hasRaidCamp(s)) r.camp = 1; // (the camp you placed is level 1)
    L.trainDone(s, now);
    // (9 Nov 2026, owner's video: each Train tap drew the panel again at the top: the same tab keeps its place now)
    var redo = function (t, p) {
      var m = self.modals[self.modals.length - 1], at = m && m.c && m.c.slimAt, same = !t || t === tab;
      self.closeModal();
      self.openRaidCamp(t || tab, p == null ? page : p);
      var n = self.modals[self.modals.length - 1];
      if (same && at && n && n.c && n.c.slimScroll) n.c.slimScroll(at);
    };
    // the next raider to finish: the panel shows it joining (it counted them only when it opened, so "9 training" sat still)
    var soon = r.train.length ? r.train[0].until - Date.now() : 0;
    if (soon > 0 && soon < 10 * 60000) this.time.delayedCall(soon + 150, function () {
      var m = self.modals[self.modals.length - 1];
      if (m && m.c && m.c.raidCampTab === tab && !self.raidCampBusy) redo(tab);
    });
    var act = function (res, ok) { if (res !== 'ok') { sfx('nope'); return self.toast(why[res] || 'Not now.', 2200); } sfx('coin'); if (world()) { world().changed(); world().save(); } redo(); if (ok) self.toast(ok, 2000, 0x2f5a22); };
    // (a raider's queue: when the next one is ready, as m:ss)
    var clockOf = function (ms) { var sec = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
    var nextOf = function (k) { var t = r.train.filter(function (x) { return x.k === k; })[0]; return t ? clockOf(t.until - Date.now()) : ''; };
    var rows = [];
    if (tab === 'party') {
      // the Farm Shield (owner, 9 Nov 2026): how long, or how to get one
      var left = L.shieldLeft(s, now), hh = Math.floor(left / 3600000), mm = Math.floor(left % 3600000 / 60000), have = L.countItem(s, 'farm_shield');
      rows.push({ icon: C.ICON.ri_shield != null ? C.ICON.ri_shield : C.ICON.star, name: left ? 'Shielded: ' + hh + 'h ' + mm + 'm left' : 'No shield',
        desc: left ? 'Nobody can raid your farm. Raiding someone breaks it.' : have ? 'You have ' + have + ' Farm Shield' + (have > 1 ? 's' : '') + ': use one from your bag (24 hours).' : 'Finish a day\'s story chapter for a Farm Shield.' });
      var next = R.camp.levels[r.camp], building = L.campDone(s, L.clock());
      // (owner, 9 Nov 2026: an upgrade needs lumber, stone, things from hunting and building time)
      var needs = next ? [next.lumber ? next.lumber + ' lumber' : '', next.stone ? next.stone + ' stone' : '', next.need ? next.need[1] + ' ' + C.ITEMS[next.need[0]].name : '', next.cement ? next.cement + ' Farm Cement' : '', next.rope ? next.rope + ' Rope' : '', next.mins ? (next.mins >= 60 ? next.mins / 60 + 'h' : next.mins + ' min') + ' to build' : ''].filter(Boolean).join(', ') : '';
      var hm = function (ms) { var m = Math.ceil(ms / 60000); return (m >= 60 ? Math.floor(m / 60) + 'h ' : '') + (m % 60) + 'm'; };
      // the party's room in the name, always in sight (owner, 10 Nov 2026: "while building, I cannot see how many raiders")
      var room = ' · Party ' + L.armySpace(s) + '/' + L.campSpace(s);
      rows.push({ icon: C.ICON.ri_flag != null ? C.ICON.ri_flag : C.ICON.star, name: (building ? 'Camp building Lv ' + (r.camp + 1) : 'Raid Camp, level ' + r.camp) + room, tag: null,
        desc: building ? hm(building) + ' left. It still raids and trains while it builds.'
          : (next ? 'Needs ' + needs + '. Next level\'s room: ' + next.space + '.' : 'Top level!'), // (a slim row cuts the end: the needs first)
        buttons: next && r.camp && !building ? [{ label: next.gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.campUpgrade(s, L.clock()), 'The Raid Camp upgrade has started!'); } }] : [] });
      R.raiderOrder.forEach(function (k) {
        var d = R.raiders[k], open = L.raiderOpen(s, k), have = r.army[k] || 0, wait = r.train.filter(function (t) { return t.k === k; }).length;
        rows.push({ icon: L.raiderIcon(k), name: d.name + (have ? '  x' + have : ''), desc: open ? (wait ? wait + ' training, next in ' + nextOf(k) + '. ' : '') + (d.crop ? 'Eats ' + food(d.crop) + ' (you have ' + L.cropHave(s, d.crop[0]) + '). ' : '') + d.say : 'Opens with a bigger Raid Camp.',
          buttons: open ? [{ label: 'Train ' + d.gold + 'G', color: GREEN, cb: function () { act(L.trainRaider(s, k, Date.now())); } }] : [] });
      });
    } else if (tab === 'raiders') {
      R.raiderOrder.forEach(function (k) {
        var d = R.raiders[k], lv = L.raiderLv(s, k), open = L.raiderOpen(s, k), need = R.level.need[lv], gold = R.level.gold[lv];
        rows.push({ icon: L.raiderIcon(k), name: d.name + '  Lv ' + lv, desc: !open ? 'Not open yet.' : lv >= 5 ? 'Top level!' : 'Next: stronger and grabs more. ' + (need || L.raiderUpCrops(s, k) ? 'Needs ' + [need ? food(need) : '', food(L.raiderUpCrops(s, k))].filter(Boolean).join(' + ') + '.' : ''),
          buttons: open && lv < 5 ? [{ label: gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.raiderUp(s, k), d.name + ' is level ' + (lv + 1) + '!'); } }] : [] });
      });
    } else if (tab === 'defenses') {
      // (owner, 10 Nov 2026: "i bought all the defenses but how can I put it in the farm?": the Gold button here only
      // levelled them; the pieces were sold at Mira's) each row: how many are on the farm, Buy (and place it now), Lv up
      var OD = C.OUTDOOR, onFarm = function (t) { return s.yard.items.filter(function (it) { return it.t === t; }).length; };
      R.defenseOrder.forEach(function (k) {
        var d = R.defenses[k], lv = L.defenseLv(s, k), gold = R.defLevel.gold[lv];
        var pic = F.defensePic(self, k), sz = pic.key === 'items' ? null : { key: pic.key, frame: pic.frame, w: 128, h: 128 };
        var t = OD.index['def_' + k] != null ? OD.index['def_' + k] : k === 'scarecrow' ? OD.index.scarecrow : null, type = t != null ? OD.types[t] : null;
        var placed = t != null ? onFarm(t) : 0, stored = t != null ? s.yard.bag[t] || 0 : 0, cap = L.defenseCap(s, k), full = isFinite(cap) && placed + stored >= cap;
        // (owner, 10 Nov 2026: a limit per camp level, like a Town Hall's)
        var lim = isFinite(cap) ? (k === 'scarecrow' ? ' (' + cap + ' fight in a raid)' : ' of ' + cap) : '';
        var where = k === 'dog' ? (s.dog ? 'Your dog guards the farm. ' : 'Adopt a dog to guard the farm. ')
          : type ? placed + lim + ' on your farm' + (stored ? ', ' + stored + ' in storage' : '') + '. ' + (full && type.defense ? (cap ? 'A bigger Raid Camp allows more. ' : 'A bigger Raid Camp opens it. ') : '') : '';
        var btns = [];
        if (type && (stored || !full || !type.defense)) btns.push({ label: (stored ? 'Place' : 'Buy ' + type.price.toLocaleString('en-US') + 'G'), color: GREEN, cb: function () { self.raidDefensePlace(t); } });
        if (lv < 5) btns.push({ label: 'Lv ' + (lv + 1) + ' ' + gold.toLocaleString('en-US') + 'G', color: BLUE, cb: function () { act(L.defenseUp(s, k), 'Every ' + d.name + ' is level ' + (lv + 1) + '!'); } });
        var mats = lv < 5 && L.defenseMats(s, k);
        rows.push({ icon: sz ? undefined : pic.frame, img: sz || undefined, name: d.name + '  Lv ' + lv, desc: (mats ? 'Next level: ' + food(mats) + '. ' : '') + where + d.say, buttons: btns });
      });
    } else {
      // step 2 (19zzzzzzzzzzzzzzzzzzz-farm-raids-real.js): real farms first, then the board
      if (self.raidFind) {
        rows.push({ icon: C.ICON.ri_flag != null ? C.ICON.ri_flag : C.ICON.star, name: 'Raid a player', desc: 'A real farm near your power. ' + R.daily + ' raids a day, ' + R.real.energy + ' energy each.',
          buttons: [{ label: 'Find', color: RED, cb: function () { self.raidFind([]); } }] });
        rows.push({ icon: C.ICON.ri_points != null ? C.ICON.ri_points : C.ICON.star, name: 'Raid Points this week', desc: 'The top raiders win Gold every week.',
          buttons: [{ label: 'Board', color: BLUE, cb: function () { self.raidBoard(); } }] });
        if (self.raidLog) rows.push({ icon: C.ICON.ri_shield != null ? C.ICON.ri_shield : C.ICON.star, name: 'Raids on your farm', desc: 'Who raided you this week: Replay, and a free Revenge.',
          buttons: [{ label: 'See', color: BLUE, cb: function () { self.raidLog(); } }] });
      }
      R.bandits.forEach(function (b, i) {
        var stars = r.won[b.key] || 0, open = L.banditOpen(s, i);
        rows.push({ icon: C.ICON.ri_bandit != null ? C.ICON.ri_bandit : C.ICON.chest, name: b.name + '  ' + ['☆☆☆', '★☆☆', '★★☆', '★★★'][stars], desc: open ? 'Up to ' + b.loot.gold.toLocaleString('en-US') + ' Gold and its crops, eggs and stall goods.' : 'Win a star on the one before.',
          buttons: open ? [{ label: 'Raid', color: RED, cb: function () { self.startRaid(b.key); } }] : [] });
      });
      rows.push({ icon: C.ICON.ri_shield != null ? C.ICON.ri_shield : C.ICON.star, name: 'Test my farm', desc: 'Raid a copy of your own farm: see how your fences and defenses hold. Nothing of yours is taken.',
        buttons: [{ label: 'Test', color: BLUE, cb: function () { if (F.raidFarmStart) F.raidFarmStart({ kind: 'test' }); } }] });
    }
    this.listPanel({
      title: 'Raid Camp', tab: tab, page: page || 0, rows: rows, tabs: TABS, slim: true,
      reopen: function (t, p) { self.openRaidCamp(t, p); },
      sub: function () { return 'Power ' + L.farmPower(s) + '   ·   Raid Points ' + r.pts + '   ·   ' + s.gold.toLocaleString('en-US') + 'G'; },
    });
    var top = this.modals[this.modals.length - 1];
    if (top && top.c) top.c.raidCampTab = tab;
    // the training times count down while you watch (owner, 10 Nov 2026: "The time is not working real time?"): each second
    // the "next in m:ss" in a raider's row is written again (its row: the one whose name is that raider's)
    if (tab === 'party' && top && top.c && r.train.length) {
      var byName = {};
      R.raiderOrder.forEach(function (k) { byName[R.raiders[k].name] = k; });
      var tick = this.time.addEvent({ delay: 1000, loop: true, callback: function () {
        if (!top.c.active || self.modals[self.modals.length - 1] !== top) return tick.remove();
        var walk = function (list) {
          list.forEach(function (o) {
            if (o.type === 'Text' && o.text.indexOf(' training, next in ') > 0 && o.parentContainer) {
              var nm = o.parentContainer.list.filter(function (x) { return x.type === 'Text' && byName[x.text.split('  x')[0]] != null; })[0];
              var k = nm && byName[nm.text.split('  x')[0]];
              if (k == null) return;
              var t = nextOf(k);
              if (t) o.setText(o.text.replace(/next in \d+:\d\d/, 'next in ' + t));
            }
            if (o.list) walk(o.list);
          });
        };
        walk(top.c.list);
      } });
    }
  };
  // the party you have, as the battle wants it: { k: { n, lv } }
  L.frArmy = function (s) {
    var r = L.frState(s), out = {};
    R.raiderOrder.forEach(function (k) { if (r.army[k]) out[k] = { n: r.army[k], lv: L.raiderLv(s, k) }; });
    return out;
  };
  U.startRaid = function (key) {
    var s = F.session.state, army = L.frArmy(s);
    if (!Object.keys(army).length) { sfx('nope'); return this.toast('Train some raiders first (Party).', 2400); }
    var b = R.bandits.filter(function (x) { return x.key === key; })[0], seed = (Date.now() & 0x7fffffff) || 1;
    this.closeAll();
    // (owner, 9 Nov 2026: on the real farm map, 19zzzzzzzzzzzzzzzzzz-farm-raids-world.js)
    if (F.raidFarmStart) return F.raidFarmStart({ kind: 'bandit', key: key });
    F.raidBattle({ bandit: b, farm: L.banditFarm(b, seed), army: army, seed: seed });
  };

  // ---------- the battle screen ----------
  var PX = 21; // screen pixels a tile (16 tiles: the width of the screen)
  var WI = C.WILD;
  var STAND = { goat: 'kambing', crow: 'labuyo', cat: 'musang', carabao: 'carabaoligaw', monkey: 'unggoy', boar: 'boar', rooster: 'labuyo', bayawak: 'bayawak' };
  var TINT = { crow: 0x3a3a4a };
  var CROW = { w: 0.8, px: 178 }; // (its sheet: tools/art/animals3q-import.js raids)
  var sheetFrame = function (scene, k, f) { // a raider's picture: its own sheet, else the wild sheet's row
    if (k === 'crow' && F.images.raid_crow) return { key: F.ensureTexture(scene, 'raid_crow'), frame: f, def: CROW, own: true };
    if (k === 'cat' && F.images.raid_cat) return { key: F.ensureTexture(scene, 'raid_cat'), frame: f, def: { w: 0.85, px: 178 }, own: true };
    var kind = STAND[k], def = WI.animals[kind] || WI.animals.rabbit;
    if (def.sheet && F.images[def.sheet]) return { key: F.ensureTexture(scene, def.sheet), frame: (def.row || 0) * 12 + f, def: def };
    var row = WI.order.indexOf(def.sheetRow || kind);
    if (row >= 0 && F.images.wild) return { key: F.ensureTexture(scene, 'wild'), frame: row * 12 + f, def: def };
    // its sheet is in a pack not here yet (the Wild Lands', a place's): its icon for now, the sheet asked for
    if (def.sheet && F.needImage) F.needImage(def.sheet);
    if (F.needImage) F.needImage('wild');
    return { key: 'items', frame: L.raiderIcon(k), def: { w: 1, px: 128 * 0.9 }, icon: true };
  };
  F.RaidScene = class extends Phaser.Scene {
    constructor() { super('FarmRaid'); }
    init(data) { this.data0 = data; }
    create() {
      var self = this, d = this.data0, farm = d.farm, Wd = farm.w * PX, Hd = farm.h * PX;
      this.b = L.frStart(farm, d.army, d.seed);
      Object.keys(d.army).forEach(function (k) { sheetFrame(self, k, 6); }); // (asks for any sheet not here yet)
      this.acc = 0;
      this.started = false;
      this.sel = Object.keys(d.army)[0];
      this.layer = this.add.container(0, 0);
      this.hud = this.add.container(0, 0);
      var cam = this.cameras.main;
      cam.setZoom(F.R).setBounds(-12, -70, Wd + 24, Hd + 200).centerOn(Wd / 2, Hd / 2 + 20);
      cam.setBackgroundColor('#3a6b2a');
      this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setZoom(F.R).centerOn(W / 2, C.VIEW_H / 2);
      cam.ignore(this.hud);
      this.hudCam.ignore(this.layer);
      this.drawFarm();
      this.drawHud();
      // drag to look around; a tap on the edge drops the picked raider
      this.input.on('pointerdown', function (p) { self.downAt = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }; self.dragged = false; });
      this.input.on('pointermove', function (p) {
        if (!p.isDown || !self.downAt || self.onHud(p)) return;
        var dx = (p.x - self.downAt.x) / cam.zoom, dy = (p.y - self.downAt.y) / cam.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 6) self.dragged = true;
        if (self.dragged) cam.setScroll(self.downAt.sx - dx, self.downAt.sy - dy);
      });
      this.input.on('pointerup', function (p) {
        if (self.dragged || self.onHud(p) || self.b.end) return;
        var wp = cam.getWorldPoint(p.x, p.y), tx = Math.floor(wp.x / PX), ty = Math.floor(wp.y / PX);
        self.drop(tx, ty);
      });
      F.raidOn = true;
    }
    onHud(p) { var y = p.y / F.R; return y > C.VIEW_H - 120 || y < 64; }
    drawFarm() {
      var farm = this.b.farm, g = this.add.graphics(), e = R.battle.edge;
      this.layer.add(g);
      g.fillStyle(0x6fae4a, 1).fillRect(0, 0, farm.w * PX, farm.h * PX);
      for (var y = 0; y < farm.h; y++) for (var x = 0; x < farm.w; x++) if ((x + y) % 2) g.fillStyle(0x66a444, 1).fillRect(x * PX, y * PX, PX, PX);
      // the edge where raiders come in: lighter, with a dashed line
      g.fillStyle(0xfff3c4, 0.22);
      g.fillRect(0, 0, farm.w * PX, e * PX).fillRect(0, (farm.h - e) * PX, farm.w * PX, e * PX).fillRect(0, e * PX, e * PX, (farm.h - 2 * e) * PX).fillRect((farm.w - e) * PX, e * PX, e * PX, (farm.h - 2 * e) * PX);
      g.lineStyle(2, 0xfff3c4, 0.7).strokeRect(e * PX, e * PX, (farm.w - 2 * e) * PX, (farm.h - 2 * e) * PX);
      var self = this;
      // the loot
      this.lootImgs = this.b.loot.map(function (p) {
        var c = self.add.container(p.x * PX, p.y * PX);
        if (p.kind === 'crops') c.add(self.add.ellipse(0, 4, PX * 1.1, PX * 0.6, 0x6b4a2a));
        var icon = { crops: C.ICON.turnip, produce: C.ICON.egg, stall: C.ICON.act_stall != null ? C.ICON.act_stall : C.ICON.crate, gold: C.ICON.coin }[p.kind];
        c.add(self.add.image(0, -2, 'items', icon).setScale(PX * (p.kind === 'gold' || p.kind === 'stall' ? 1.4 : 1) / 128));
        self.layer.add(c);
        return c;
      });
      // the defenses
            this.defImgs = this.b.defs.map(function (dd) {
        var c = self.add.container(dd.x * PX, dd.y * PX), pic = F.defensePic(self, dd.t), SIZE = { fence: 1.05, mudpit: 1.1, tower: 1.7, beebox: 1.2, sili: 1.1, kampana: 1.3, scarecrow: 1.2, goose: 1.1, dog: 1.0 };
        var im = self.add.image(0, PX * 0.45, pic.key, pic.frame).setOrigin(0.5, 1);
        if (pic.key === 'items') im.setOrigin(0.5).setPosition(0, 0).setScale(PX * 0.95 / 128);
        else { var wd = (SIZE[dd.t] || 1) * PX; im.setScale(wd / im.width); if (dd.t === 'mudpit') im.setOrigin(0.5).setPosition(0, 0); }
        if (dd.t === 'dog' || dd.t === 'goose') { im.setOrigin(0.5, 0.92).setPosition(0, PX * 0.3); im.setScale((dd.t === 'dog' ? C.DOG.w * PX / C.DOG.px : 1.0 * PX / 176)); }
        if (dd.t === 'mudpit') im.setAlpha(0.75); // (hidden in the game's rules: the raider does not see it; you do, faintly)
        c.add(im);
        c.pic = im;
        if (R.defenses[dd.t].dps) c.add(self.add.circle(0, 0, R.defenses[dd.t].range * PX, 0xffffff, 0.04).setStrokeStyle(1, 0xffffff, 0.12));
        self.layer.add(c);
        return c;
      });
      this.unitImgs = {};
    }
    drawHud() {
      var self = this, h = this.hud, top = this.add.graphics();
      top.fillStyle(0x24160b, 0.72).fillRoundedRect(8, 8, W - 16, 48, 14);
      h.add(top);
      this.title = this.add.text(20, 14, this.data0.bandit.name, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#fff6d8', fontStyle: 'bold' }).setResolution(F.R);
      this.timeText = this.add.text(W - 20, 14, '2:00', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '15px', color: '#ffe680', fontStyle: 'bold' }).setOrigin(1, 0).setResolution(F.R);
      this.lootText = this.add.text(20, 33, '', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#e8dcc0' }).setResolution(F.R);
      this.starText = this.add.text(W - 20, 34, '☆☆☆', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '14px', color: '#ffd23f' }).setOrigin(1, 0).setResolution(F.R);
      h.add([this.title, this.timeText, this.lootText, this.starText]);
      // the raiders to send: a card each, the picked one bright
      var keys = Object.keys(this.data0.army), bw = Math.min(70, (W - 24 - 8 * (keys.length - 1)) / Math.max(1, keys.length)), y = C.VIEW_H - 62;
      var bar = this.add.graphics();
      bar.fillStyle(0x24160b, 0.72).fillRoundedRect(6, y - 50, W - 12, 108, 14);
      h.add(bar);
      this.cards = {};
      keys.forEach(function (k, i) {
        var x = 12 + bw / 2 + i * (bw + 8), c = self.add.container(x, y), bg = self.add.graphics();
        c.add(bg);
        c.add(self.add.image(0, -10, 'items', L.raiderIcon(k)).setScale(0.3));
        var n = self.add.text(0, 18, '', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#fff6d8', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R);
        c.add(n);
        var z = self.add.zone(0, 0, bw, 64).setInteractive({ useHandCursor: true });
        z.on('pointerup', function () { self.sel = k; self.refreshHud(); });
        c.add(z);
        h.add(c);
        self.cards[k] = { c: c, bg: bg, n: n, w: bw };
      });
      this.hint = this.add.text(W / 2, y - 40, 'Pick a raider, then tap the light edge to send it in.', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: '#fff6d8' }).setOrigin(0.5).setResolution(F.R);
      h.add(this.hint);
      // End
      var end = this.add.container(W - 44, 82), eb = this.add.graphics();
      eb.fillStyle(RED, 1).fillRoundedRect(-34, -14, 68, 28, 12);
      end.add([eb, this.add.text(0, 0, 'End', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
      var ez = this.add.zone(0, 0, 68, 28).setInteractive({ useHandCursor: true });
      ez.on('pointerup', function () { if (!self.b.end) { self.b.end = 'stopped'; self.finish(); } });
      end.add(ez);
      h.add(end);
      this.refreshHud();
    }
    refreshHud() {
      var self = this, b = this.b;
      Object.keys(this.cards).forEach(function (k) {
        var cd = self.cards[k], left = b.left[k] ? b.left[k].n : 0, on = self.sel === k;
        cd.bg.clear().fillStyle(on ? 0xe9a91c : 0x5a3a1e, on ? 0.95 : 0.8).fillRoundedRect(-cd.w / 2, -30, cd.w, 60, 10);
        cd.n.setText(R.raiders[k].name + ' x' + left);
        if (cd.n.width > cd.w - 4) cd.n.setScale((cd.w - 4) / cd.n.width);
        cd.c.setAlpha(left ? 1 : 0.45);
      });
      var t = b.taken, secs = Math.max(0, Math.ceil((b.ticks - b.t) * R.battle.tick / 1000));
      this.timeText.setText(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
      this.lootText.setText('Crops ' + Math.floor(t.crops || 0) + '  ·  Eggs/milk ' + Math.floor(t.produce || 0) + '  ·  Stall ' + Math.floor(t.stall || 0) + '  ·  Gold ' + Math.floor(t.gold || 0));
      var st = L.frStars(b);
      this.starText.setText('★★★'.slice(0, st) + '☆☆☆'.slice(st));
    }
    drop(x, y) {
      var b = this.b, k = this.sel;
      if (!k || !b.left[k] || b.left[k].n <= 0) { this.flash('None left. Pick another raider.'); return; }
      if (!L.frEdge(b, x, y)) { this.flash('Send raiders in from the light edge.'); return; }
      var r = L.frDrop(b, k, x, y);
      if (!r) return;
      this.started = true;
      sfx('pick');
      this.refreshHud();
    }
    flash(msg) { var self = this; this.hint.setText(msg).setColor('#ffd23f'); this.time.delayedCall(1600, function () { self.hint.setText('Pick a raider, then tap the light edge to send it in.').setColor('#fff6d8'); }); }
    update(time, delta) {
      var b = this.b;
      if (!b || !this.started || b.end) { this.drawUnits(time); return; }
      this.acc += Math.min(delta, 250);
      while (this.acc >= R.battle.tick && !b.end) { this.acc -= R.battle.tick; this.evStart = b.events.length; L.frStep(b); this.showEvents(); }
      this.drawUnits(time);
      this.refreshHud();
      if (b.end) this.finish();
    }
    showEvents() {
      var self = this, b = this.b;
      b.events.slice(this.evStart).forEach(function (e) {
        var who = e[2], r = b.raiders.filter(function (x) { return x.id === who; })[0], dd = b.defs.filter(function (x) { return x.id === who; })[0];
        var at = r || dd;
        if (!at) return;
        var word = { scared: 'Eek!', stuck: 'Stuck!', gone: 'Out!', down: 'Down!', alarm: 'DONG!' }[e[1]];
        if (!word) return;
        var t = self.add.text(at.x * PX, at.y * PX - 18, word, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '11px', color: e[1] === 'alarm' ? '#ffd23f' : '#ffffff', fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5).setResolution(F.R);
        self.layer.add(t);
        self.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: function () { t.destroy(); } });
        if (e[1] === 'down' && dd) { var img = self.defImgs[b.defs.indexOf(dd)]; if (img) self.tweens.add({ targets: img, alpha: 0.15, duration: 300 }); }
      });
    }
    drawUnits(time) {
      var self = this, b = this.b;
      b.raiders.forEach(function (r) {
        var u = self.unitImgs[r.id];
        if (!u) {
          var fr = sheetFrame(self, r.k, 6), sc = (fr.def.w || 1) * PX / (fr.def.px || 140) * (r.k === 'crow' && !fr.own ? 0.7 : 1);
          u = self.unitImgs[r.id] = { img: self.add.image(r.x * PX, r.y * PX, fr.key, fr.frame).setOrigin(0.5, 0.92).setScale(sc), bar: self.add.rectangle(r.x * PX, r.y * PX - 22, 18, 3, 0x7fd05a).setOrigin(0, 0.5), lx: r.x, step: 0 };
          if (TINT[r.k] && !fr.own) u.img.setTint(TINT[r.k]);
          self.layer.add([u.img, u.bar]);
        }
        if (r.hp <= 0) { if (!u.gone) { u.gone = true; self.tweens.add({ targets: [u.img, u.bar], alpha: 0, duration: 400 }); } return; }
        var moving = Math.abs(r.x - u.lx) > 0.001, left = r.x < u.lx;
        u.step = moving ? u.step + 1 : 0;
        var f = sheetFrame(self, r.k, moving ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 6);
        if (f.key !== u.img.texture.key) { u.img.setTexture(f.key, f.frame).setScale((f.def.w || 1) * PX / (f.def.px || 140)); if (!f.icon && TINT[r.k] && !f.own) u.img.setTint(TINT[r.k]); else u.img.clearTint(); }
        u.img.setFrame(f.frame).setFlipX(moving && !f.icon ? !left : u.img.flipX).setPosition(r.x * PX, r.y * PX - (f.icon ? Math.abs(Math.sin(time / 110 + r.x)) * 3 : 0)).setDepth(r.y);
        u.img.setAlpha(r.stuck > 0 ? 0.7 : 1);
        u.bar.setPosition(r.x * PX - 9, r.y * PX - 24).setSize(18 * Math.max(0, r.hp / r.max), 3).setVisible(r.hp < r.max);
        u.lx = r.x;
      });
      b.defs.forEach(function (dd, i) {
        var img = self.defImgs[i];
        if (!img || !R.defenses[dd.t].chases) return;
        var mv = Math.abs(dd.x * PX - img.x) > 0.05, left = dd.x * PX < img.x;
        img.setPosition(dd.x * PX, dd.y * PX).setDepth(dd.y);
        if (img.pic && dd.hp > 0) {
          var base = dd.t === 'dog' ? C.DOG.frame0 : 0, k = mv ? 6 + [1, 0, 2, 0][Math.floor(time / 120) % 4] : 9;
          img.pic.setFrame(base + k).setFlipX(mv ? !left : img.pic.flipX);
        }
      });
      b.loot.forEach(function (p, i) { var img = self.lootImgs[i]; if (img) img.setAlpha(0.3 + 0.7 * Math.max(0, p.left / p.n)); });
    }
    finish() {
      if (this.done) return;
      this.done = true;
      var self = this, s = F.session.state, b = this.b, used = {};
      b.moves.forEach(function (m) { used[m[1]] = (used[m[1]] || 0) + 1; });
      L.frUse(s, used);
      var prize = L.banditPrize(s, this.data0.bandit.key, b);
      if (F.world) { F.world.changed(); F.world.save(); }
      sfx(prize.stars ? 'fanfare' : 'nope');
      // the results card
      var h = this.hud, y0 = C.VIEW_H / 2 - 120, card = this.add.graphics();
      card.fillStyle(0x000000, 0.45).fillRect(0, 0, W, C.VIEW_H);
      card.fillStyle(0xfff6dc, 1).fillRoundedRect(24, y0, W - 48, 230, 18).lineStyle(3, 0x7a4d26, 1).strokeRoundedRect(24, y0, W - 48, 230, 18);
      h.add(card);
      var line = function (y, str, size, color) { var t = self.add.text(W / 2, y, str, { fontFamily: F.UI_FONT || 'sans-serif', fontSize: size + 'px', color: color || INK, fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setResolution(F.R); h.add(t); return t; };
      line(y0 + 28, prize.stars ? 'Raid won!' : 'Raid over', 18);
      if (!F.raidGoldStars(this, h, W / 2, y0 + 70, prize.stars)) line(y0 + 66, '★★★'.slice(0, prize.stars) + '☆☆☆'.slice(prize.stars), 30, '#e9a91c');
      line(y0 + 108, Math.round(L.frShare(b) * 100) + '% of the loot taken', 12, '#7a5a3a');
      line(y0 + 136, '+' + prize.gold.toLocaleString('en-US') + ' Gold   ·   +' + prize.pts + ' Raid Points', 14, '#2f5a22');
      var btn = this.add.container(W / 2, y0 + 190), bg = this.add.graphics();
      bg.fillStyle(GREEN, 1).fillRoundedRect(-80, -20, 160, 40, 16);
      btn.add([bg, this.add.text(0, 0, 'Back to the farm', { fontFamily: F.UI_FONT || 'sans-serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
      var z = this.add.zone(0, 0, 160, 40).setInteractive({ useHandCursor: true });
      z.on('pointerup', function () { F.raidLeave(); });
      btn.add(z);
      h.add(btn);
      this.result = prize;
    }
  };
  // ---------- the raid's HUD over the real farm (the UI scene; your own buttons hide meanwhile) ----------
  var FONT = function () { return F.UI_FONT || 'sans-serif'; };
  U.raidHudOn = function (b, name) {
    var self = this;
    this.raidHudOff();
    this.raidHidden = this.children.list.filter(function (o) { return o.visible; });
    this.raidHidden.forEach(function (o) { o.setVisible(false); });
    var h = this.frBox = this.add.container(0, 0).setDepth(95);
    var top = this.add.graphics();
    top.fillStyle(0x24160b, 0.78).fillRoundedRect(8, 8, W - 16, 48, 14);
    h.add(top);
    var tx = function (x, y, str, size, color, ox) { var t = self.add.text(x, y, str, { fontFamily: FONT(), fontSize: size + 'px', color: color, fontStyle: 'bold' }).setOrigin(ox || 0, 0).setResolution(F.R); h.add(t); return t; };
    tx(20, 14, name, 13, '#fff6d8');
    this.frTime = tx(W - 20, 14, '2:00', 15, '#ffe680', 1);
    this.raidLoot = tx(20, 34, '', 11, '#e8dcc0');
    this.raidStars = tx(W - 20, 33, '☆☆☆', 14, '#ffd23f', 1);
    var keys = Object.keys(b.left), bw = Math.min(70, (W - 24 - 8 * (keys.length - 1)) / Math.max(1, keys.length)), y = C.VIEW_H - 62, bar = this.add.graphics();
    bar.fillStyle(0x24160b, 0.78).fillRoundedRect(6, y - 50, W - 12, 108, 14);
    h.add(bar);
    this.raidSel = keys[0];
    this.raidCards = {};
    keys.forEach(function (k, i) {
      var x = 12 + bw / 2 + i * (bw + 8), c = self.add.container(x, y), bg = self.add.graphics();
      c.add([bg, self.add.image(0, -10, 'items', L.raiderIcon(k)).setScale(0.3)]);
      var n = self.add.text(0, 18, '', { fontFamily: FONT(), fontSize: '11px', color: '#fff6d8', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R);
      c.add(n);
      var z = self.add.zone(0, 0, bw, 64).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () { self.raidSel = k; self.raidHudRefresh(); });
      c.add(z);
      h.add(c);
      self.raidCards[k] = { c: c, bg: bg, n: n, w: bw };
    });
    this.raidHint = tx(W / 2, y - 47, 'Pick a raider, then press and drag on the green ground.', 11, '#fff6d8', 0.5);
    this.raidHint.setFontStyle('normal');
    var end = this.add.container(W - 44, 82), eb = this.add.graphics();
    eb.fillStyle(RED, 1).fillRoundedRect(-34, -14, 68, 28, 12);
    end.add([eb, this.add.text(0, 0, 'End', { fontFamily: FONT(), fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
    var ez = this.add.zone(0, 0, 68, 28).setInteractive({ useHandCursor: true });
    F.tapOn(ez, function () { var w = F.world; if (!w || !w.raidB) return; if (!w.raidB.end) { w.raidB.end = 'stopped'; w.raidFinish(); } });
    end.add(ez);
    h.add(end);
    this.raidB = b;
    this.raidHudRefresh();
  };
  U.raidHudOff = function () {
    if (this.frBox) { this.frBox.destroy(); this.frBox = null; }
    (this.raidHidden || []).forEach(function (o) { if (o.active) o.setVisible(true); });
    this.raidHidden = null;
    this.raidB = null;
  };
  // (the UI's own refreshes show its pieces again now and then: in a raid, they stay hidden and the raid's HUD shows)
  var uiUpdate = U.update;
  U.update = function (time, delta) {
    uiUpdate.call(this, time, delta);
    if (!this.frBox) return;
    if (!this.frBox.visible) this.frBox.setVisible(true);
    var box = this.frBox;
    this.children.list.forEach(function (o) { if (o !== box && o.visible && o.depth < 200 && o.type !== 'Text' || (o !== box && o.visible && o.type === 'Text' && !o.raidKeep && o.depth < 200 && o.depth !== 95)) o.setVisible(false); });
  };
  U.raidOnHud = function (p) { if (!this.frBox) return false; var y = p.y / F.R; return y > C.VIEW_H - 115 || y < 100; };
  U.raidSay = function (msg) {
    var self = this;
    if (!this.raidHint) return;
    this.raidHint.setText(msg).setColor('#ffd23f');
    if (this.raidSayT) this.raidSayT.remove();
    this.raidSayT = this.time.delayedCall(1800, function () { if (self.raidHint && self.raidHint.active) self.raidHint.setText('Pick a raider, then press and drag on the green ground.').setColor('#fff6d8'); });
  };
  U.raidHudRefresh = function () {
    var self = this, b = this.raidB;
    if (!b || !this.frBox) return;
    Object.keys(this.raidCards).forEach(function (k) {
      var cd = self.raidCards[k], left = b.left[k] ? b.left[k].n : 0, on = self.raidSel === k;
      cd.bg.clear().fillStyle(on ? 0xe9a91c : 0x5a3a1e, on ? 0.95 : 0.8).fillRoundedRect(-cd.w / 2, -30, cd.w, 60, 10);
      cd.n.setText(R.raiders[k].name + ' x' + left);
      if (cd.n.width > cd.w - 4) cd.n.setScale((cd.w - 4) / cd.n.width);
      cd.c.setAlpha(left ? 1 : 0.45);
    });
    var tk = b.taken, secs = Math.max(0, Math.ceil((b.ticks - b.t) * R.battle.tick / 1000)), st = L.frStars(b);
    this.frTime.setText(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
    this.raidLoot.setText('Crops ' + Math.floor(tk.crops || 0) + '  ·  Eggs/milk ' + Math.floor(tk.produce || 0) + '  ·  Stall ' + Math.floor(tk.stall || 0) + '  ·  Gold ' + Math.floor(tk.gold || 0));
    if (this.raidLoot.width > W - 120) this.raidLoot.setScale((W - 120) / this.raidLoot.width);
    this.raidStars.setText('★★★'.slice(0, st) + '☆☆☆'.slice(st));
  };
  // the stars won: the owner's gold stars (raid_fx) popping in one by one, the ones not won faint; false: no picture
  F.raidGoldStars = function (sc, h, x, y, n) {
    if (!F.images.raid_fx) return false;
    var key = F.ensureTexture(sc, 'raid_fx');
    for (var i = 0; i < 3; i++) {
      var star = sc.add.image(x + (i - 1) * 54, y - (i === 1 ? 4 : 0), key, F.raidFx('star')).setScale(0);
      if (i >= n) star.setTint(0x6b5a40).setAlpha(0.35);
      h.add(star);
      sc.tweens.add({ targets: star, scale: i === 1 ? 0.42 : 0.35, duration: 320, delay: 200 + i * 260, ease: 'Back.out' });
    }
    return true;
  };
  U.raidResult = function (b, prize) {
    var self = this, h = this.frBox;
    if (!h) return;
    var y0 = C.VIEW_H / 2 - 120, card = this.add.graphics();
    card.fillStyle(0x000000, 0.45).fillRect(0, 0, W, C.VIEW_H);
    card.fillStyle(0xfff6dc, 1).fillRoundedRect(24, y0, W - 48, 230, 18).lineStyle(3, 0x7a4d26, 1).strokeRoundedRect(24, y0, W - 48, 230, 18);
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, C.VIEW_H), Phaser.Geom.Rectangle.Contains); // (keeps taps off the farm)
    h.add(card);
    var line = function (y, str, size, color) { var t = self.add.text(W / 2, y, str, { fontFamily: FONT(), fontSize: size + 'px', color: color || INK, fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setResolution(F.R); h.add(t); return t; };
    line(y0 + 28, prize.title || (prize.test ? 'Your farm\'s test' : prize.stars ? 'Raid won!' : 'Raid over'), 18); // (title / line: a real raid's, 19zzzzzzzzzzzzzzzzzzz-farm-raids-real.js)
    if (!F.raidGoldStars(this, h, W / 2, y0 + 70, prize.stars)) line(y0 + 66, '★★★'.slice(0, prize.stars) + '☆☆☆'.slice(prize.stars), 30, '#e9a91c');
    line(y0 + 108, Math.round(L.frShare(b) * 100) + '% of the loot taken', 12, '#7a5a3a');
    line(y0 + 136, prize.line || (prize.test ? (prize.stars >= 2 ? 'Your defenses need work!' : 'Your farm held up well!') : '+' + prize.gold.toLocaleString('en-US') + ' Gold   ·   +' + prize.pts + ' Raid Points'), 14, '#2f5a22');
    // (10 Nov 2026: the star bonus the game pays, part of the Gold; server part 27)
    // (farm economy v2: the crops your raiders carried home, into your Silo)
    var extra = [prize.bonus > 0 && !prize.line ? 'incl. a ' + prize.bonus.toLocaleString('en-US') + ' Gold star bonus' : '', prize.crops > 0 ? '+' + prize.crops + ' crops to your Silo' : ''].filter(Boolean);
    if (extra.length) line(y0 + 154, extra.join('   ·   '), 11, '#6a4a2a');
    var btn = this.add.container(W / 2, y0 + 190), bg = this.add.graphics();
    bg.fillStyle(GREEN, 1).fillRoundedRect(-80, -20, 160, 40, 16);
    btn.add([bg, this.add.text(0, 0, 'Back to the farm', { fontFamily: FONT(), fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setResolution(F.R)]);
    var z = this.add.zone(0, 0, 160, 40).setInteractive({ useHandCursor: true });
    F.tapOn(z, function () { if (F.raidFarmLeave) F.raidFarmLeave(); });
    btn.add(z);
    h.add(btn);
    this.raidPrize = prize;
  };

  // open and close the battle over the game (the farm waits underneath)
  F.raidBattle = function (data) {
    var g = F.game;
    if (!g.scene.getScene('FarmRaid')) g.scene.add('FarmRaid', F.RaidScene, false);
    if (g.scene.isActive('World')) g.scene.pause('World');
    if (g.scene.isActive('UI')) g.scene.sleep('UI');
    g.scene.start('FarmRaid', data);
    g.scene.bringToTop('FarmRaid');
  };
  F.raidLeave = function () {
    var g = F.game;
    g.scene.stop('FarmRaid');
    g.scene.resume('World');
    g.scene.wake('UI');
    F.raidOn = false;
    if (F.ui && F.ui.openRaidCamp) F.ui.openRaidCamp('practice');
  };
})(window.Farm = window.Farm || {});
