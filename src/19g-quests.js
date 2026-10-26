// Phase 3 at runtime: the Quests button and panel (daily quests, weekly and monthly goals, achievements), the
// daily login gift, villagers' requests (on the notice board, and in person with a "!" over them), the travelling
// trader on Market Street, and using a Power-Up or a Pet Meal. Rules are in 01-logic7.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  // The phone's date, as 'YYYY-MM-DD'.
  F.today = function () {
    var d = new Date(L.clock()), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  // tests (and hosts that show their own popups) can turn off the login gift popup and quest toasts
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };

  // ---------- the world: the trader, the "!" over a villager with a request, Power-Ups and Pet Meals ----------
  var P = F.WorldScene.prototype;

  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    this.trader = null;
    this.askMark = null;
    L.ensureRequests(this.state);
    if (this.mapKey === 'town') this.updateTrader();
  };

  var updateExtras = P.updateExtras;
  P.updateExtras = function (dt, time) {
    updateExtras.call(this, dt, time);
    this.p3ms = (this.p3ms || 0) - dt;
    if (this.p3ms <= 0) {
      this.p3ms = 500;
      if (this.mapKey === 'town') this.updateTrader();
    }
    this.updateAskMark(time);
  };

  // The trader's tent and Saffron herself appear on her days and hours.
  P.updateTrader = function () {
    var here = L.traderHere(this.state), spot = this.points.trader_spot, at = this.points.trader_npc;
    if (!spot || !at || here === !!this.trader) return;
    if (!here) {
      var tr = this.trader;
      tr.tent.destroy();
      tr.npc.destroy();
      this.solids.remove(tr.zone, true, true);
      tr.blocked.forEach(function (k) { delete this.blocked[k]; }, this);
      this.objects = this.objects.filter(function (o) { return o.type !== 'trader'; });
      this.trader = null;
      return;
    }
    var x0 = Math.round(spot.x / T), y0 = Math.round(spot.y / T);
    F.ensureTexture(this, 'props/trader_tent');
    var tent = this.add.image(x0 * T, (y0 + 2) * T, 'props/trader_tent').setOrigin(0, 1).setDisplaySize(3 * T, 2 * T).setDepth(DEPTH.actor + (y0 + 2) * T / 1e5);
    var frame = (C.VILLAGER_ORDER.length + C.SHOPPERS.length) * 9;
    var npc = this.add.sprite(at.x, at.y, F.ensureTexture(this, 'people'), frame).setOrigin(0.5, 0.83).setScale(2).setDepth(DEPTH.actor + at.y / 1e5);
    var zone = this.add.zone((x0 + 1.5) * T, (y0 + 1.5) * T, 3 * T - 16, T - 16);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    var blocked = [];
    for (var x = x0; x < x0 + 3; x++) { var k = this.idx(x, y0 + 1); this.blocked[k] = true; blocked.push(k); }
    this.objects.push({ type: 'trader', name: 'trader', x0: x0, y0: y0, x1: x0 + 2, y1: y0 + 1, props: {} });
    this.trader = { tent: tent, npc: npc, zone: zone, blocked: blocked };
  };

  // A "!" bobs over the villager who has a request for you today.
  P.updateAskMark = function (time) {
    var s = this.state, v = null;
    if (this.villagers) {
      s.rq.list.forEach(function (r) {
        if (r.where !== 'person' || r.done || v) return;
        v = this.villagers.list.filter(function (x) { return x.key === r.from && x.visible; })[0] || null;
      }, this);
    }
    if (!v) { if (this.askMark) this.askMark.setVisible(false); return; }
    if (!this.askMark) this.askMark = this.add.image(0, 0, 'items', C.ICON.exclaim).setScale(0.9).setDepth(DEPTH.Above + 1);
    this.askMark.setVisible(true).setPosition(v.x, v.y - 2.1 * T + Math.sin(time / 220) * 20);
  };

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type === 'trader') return { label: 'Trade', icon: C.ICON.gift, run: function () { F.ui.openTrader('sell'); } };
    return extraObjectAction.call(this, o, held, def);
  };

  // Holding a requested item in front of the villager who asked: hand it over.
  var villagerAction = P.villagerAction;
  P.villagerAction = function (v) {
    var self = this, s = this.state, i = v.shopper ? -1 : L.requestFor(s, v.key);
    if (i >= 0 && L.canFinishRequest(s, i)) return { label: 'Give', icon: C.ITEMS[s.rq.list[i].id].icon, run: function () { self.talkTo(v); } };
    return villagerAction.call(this, v);
  };

  // Someone with a request asks you (or thanks you, if you have the things).
  var talkTo = P.talkTo;
  P.talkTo = function (v) {
    var s = this.state, i = L.requestFor(s, v.key);
    if (i < 0 || (!L.friend(s, v.key).talked && L.heartEvent(s, v.key))) return talkTo.call(this, v);
    var r = s.rq.list[i], item = C.ITEMS[r.id], name = v.def.name;
    this.villagers.greet(v, this.dir);
    if (L.canFinishRequest(s, i)) {
      var res = L.finishRequest(s, i);
      L.talk(s, v.key);
      this.villagers.hearts(v, 4);
      sfx('gift');
      F.ui.say(v.key, name, 'You brought them! Thank you, you are a lifesaver!\n\n(+' + res.gold + 'G' + (res.bonus ? ', with a ' + Math.round(res.bonus * 100) + '% streak bonus' : '') + ', and ' + name + ' likes you more.)');
      this.changed();
      this.save();
      return;
    }
    var t = L.talk(s, v.key);
    sfx('talk');
    this.emote(v, C.ICON.exclaim);
    F.ui.say(v.key, name, t.line + '\n\n"Could you do me a favour today? I need ' + r.n + ' ' + item.name + '. I\'ll pay you ' + r.gold + 'G!"\n(You have ' + L.countItem(s, r.id) + '.)');
    this.changed();
  };

  // Pet Meals for the dog, the cat and the horse; drinking a Power-Up.
  var resolve = P.resolve;
  P.resolve = function () {
    var self = this, s = this.state, held = L.held(s);
    if (held && held.id === 'pet_meal') {
      var pt = this.front(0.7), which = null;
      if (this.dog && this.dog.near(pt.x, pt.y)) which = 'dog';
      else if (this.cat && this.cat.near(pt.x, pt.y)) which = 'cat';
      else if (this.horse && !F.session.riding && Math.hypot(this.horse.x - pt.x, this.horse.y - T * 0.5 - pt.y) < C.HORSE.reach * T) which = 'horse';
      if (which) {
        var pet = s[which], fed = s.pm.day === s.day && (s.pm.fed & (1 << ['dog', 'cat', 'horse'].indexOf(which)));
        if (fed) return { label: 'Feed', icon: C.ICON.pet_meal, disabled: true, why: pet.name + ' already had a Pet Meal today.' };
        return {
          label: 'Feed', icon: C.ICON.pet_meal, run: function () {
            if (L.feedPet(s, which, s.sel) !== 'ok') return;
            sfx({ dog: 'woof', cat: 'meow', horse: 'neigh' }[which]);
            var p = which === 'dog' ? self.dog : which === 'cat' ? self.cat : self.horse;
            self.floatTextAt(p.x, p.y - T, pet.name + ' loves it!');
            self.changed();
          },
        };
      }
    }
    var r = resolve.call(this);
    if (!r && held && held.id === 'power_up') {
      return {
        label: 'Drink', icon: C.ICON.power_up, run: function () {
          if (L.usePowerUp(s, s.sel) !== 'ok') return;
          sfx('eat');
          self.floatTextAt(self.feet().x, self.feet().y - 1.6 * T, 'POWER UP!');
          F.ui.toast('Full energy, and your tools cost no energy for 2 hours!', 3000, 0x7a4d12);
          self.changed();
        },
      };
    }
    return r;
  };

  // ---------- the UI ----------
  var W = F.UI_CONST.W;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GOLD = 0xe9a91c;
  var world = function () { return F.world; };
  var U = F.UIScene.prototype;

  var create = U.create;
  U.create = function () {
    create.call(this);
    var self = this;
    this.questBtn = this.add.container(0, 0).setDepth(40);
    this.button(this.questBtn, W - 44, 116, 74, 30, 'Quests', function () { self.openQuests('daily', 0); }, GOLD);
    // drawn once into a texture (a live stroked circle is ~200 shapes redrawn every frame)
    this.questBadge = this.add.image(W - 12, 104, this.bake('ui-quest-badge', 24, 24, function (g) {
      g.fillStyle(0xe5304d, 1).fillCircle(12, 12, 10);
      g.lineStyle(2, 0xffffff, 1).strokeCircle(12, 12, 10);
    })).setScale(1 / F.R).setDepth(41).setVisible(false);
    this.questBadgeText = this.txt(W - 12, 104, '', 11, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(42).setVisible(false);
    this.p3ms = 0;
    this.readySeen = null;
  };

  var update = U.update;
  U.update = function (time, delta) {
    update.call(this, time, delta);
    this.p3ms -= delta;
    if (this.p3ms > 0 || !F.session || !F.world) return;
    this.p3ms = 1000;
    this.checkQuests();
  };

  // Once a second: a new day of quests, quests that just got done, the login gift.
  U.checkQuests = function () {
    var s = F.session.state, today = F.today();
    var news = L.refreshQuests(s, today);
    if (news.daily && this.readySeen && !quiet()) this.toast('New daily quests are up! Tap Quests to see them.', 3000, 0x2f5a22);
    var ready = {}, fresh = [];
    ['daily', 'weekly', 'monthly'].forEach(function (k) {
      var set = L.questOf(s, k);
      if (set) set.list.forEach(function (q, i) { if (L.questReady(s, q)) { ready[k + i] = 1; fresh.push(q.text); } });
    });
    if (this.readySeen && !quiet()) {
      var newly = Object.keys(ready).filter(function (k) { return !this.readySeen[k]; }, this);
      if (newly.length && !this.blocking()) {
        sfx('found');
        this.toast('Quest complete! Claim your prize in Quests.', 2600, 0x2f5a22);
      }
    }
    this.readySeen = ready;
    var n = L.questsWaiting(s);
    this.questBadge.setVisible(n > 0);
    this.questBadgeText.setVisible(n > 0).setText(n > 9 ? '9+' : String(n));
    this.questBtn.setVisible(!this.decorating);
    // a brand-new farmer gets the daily gift after their first goal, not over the welcome
    var settled = s.goal >= 1 || !L.goal(s);
    if (!quiet() && settled && !this.loginShown && !this.blocking() && !(F.world && F.world.busy) && L.loginGift(s, today)) {
      this.loginShown = true;
      this.showLoginGift();
    }
  };

  U.showLoginGift = function () {
    var self = this, s = F.session.state, g = L.loginGift(s, F.today());
    if (!g) return;
    var row = function (k) {
      var r = C.LOGIN[k];
      return [r.stars ? C.ICON.sunbeam : r.item ? C.ITEMS[r.item].icon : C.ICON.coin, 'Day ' + (k + 1) + ': ' + L.rewardLabel(r) + (k + 1 === g.day ? '   <- today' : k + 1 < g.day ? '   (got it)' : '')];
    };
    var rows = C.LOGIN.map(function (r, k) { return row(k); });
    this.dialog('DAILY GIFT\nCome back every day! Miss a day and it starts again at Day 1.\n' + rows.map(function (x) { return x[1]; }).join('\n'), [{
      label: 'Claim', cb: function () {
        var r = L.claimLogin(s, F.today());
        if (r === 'full') return self.toast('Your bag is full! Make room, then open Quests to claim it.');
        sfx('coin');
        world().changed();
        world().save();
        self.toast('Day ' + r.day + ' gift: ' + L.rewardLabel(r.reward) + '!', 2600, 0x7a4d12);
      },
    }], { rows: rows });
  };

  var iconOf = function (r) { return r.stars ? C.ICON.sunbeam : r.item ? C.ITEMS[r.item].icon : C.ICON.coin; };
  var TABS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['badges', 'Badges']];

  U.openQuests = function (tab, page) {
    var self = this, s = F.session.state, rows = [], today = F.today();
    L.refreshQuests(s, today);
    var claim = function (fn, after) {
      return function () {
        var r = fn();
        if (r === 'full') { sfx('nope'); return self.toast('Your bag is full! Make room first.'); }
        if (typeof r !== 'object') return;
        sfx('coin');
        world().changed();
        world().save();
        self.closeModal();
        self.openQuests(tab, page);
        self.toast(after(r), 2400, 0x7a4d12);
      };
    };
    if (tab === 'badges') {
      rows = C.ACHIEVEMENTS.map(function (a, i) {
        var done = L.achDone(s, i), ready = L.achReady(s, i), v = Math.min(L.achValue(s, a), a.test[1]);
        // progress, reward and done are drawn by the row (19i-look.js): a bar, prize chips, a Done stamp
        return {
          icon: C.ICON.star, name: a.name, desc: a.desc, progress: done ? null : [v, a.test[1]], reward: { stars: a.stars }, done: done,
          buttons: ready ? [{ label: 'Claim', cb: claim(function () { return L.claimAch(s, i); }, function () { return 'Badge earned: ' + a.name + '! +' + a.stars + (a.stars > 1 ? ' Sunbeams' : ' Sunbeam'); }) }] : [],
        };
      });
    } else {
      var set = L.questOf(s, tab), chest = L.chestOf(tab);
      var chestName = { daily: 'Finish all 10 quests today', weekly: 'Weekly chest: finish all 5', monthly: 'Monthly chest: finish all 3' }[tab];
      var chestDone = tab === 'daily' ? set.all : set.chest;
      rows.push({
        icon: C.ICON.chest, name: chestName, reward: chest, done: !!chestDone,
        buttons: L.chestReady(s, tab) ? [{ label: 'Open', color: GOLD, cb: claim(function () { return L.claimChest(s, tab); }, function (r) { return 'Chest: ' + L.rewardLabel(r) + '!'; }) }] : [],
      });
      set.list.forEach(function (q, i) {
        var p = L.questProgress(s, q);
        rows.push({
          icon: iconOf(q.reward), name: q.text, tag: q.tier === 'hard' ? 'HARD' : null,
          progress: q.done ? null : [p, q.n], reward: q.reward, done: !!q.done,
          buttons: L.questReady(s, q) ? [{ label: 'Claim', cb: claim(function () { return L.claimQuest(s, tab, i); }, function (r) { return 'Quest prize: ' + L.rewardLabel(r) + '!'; }) }] : [],
        });
      });
    }
    var month = C.MONTHLY.names[Number(today.slice(5, 7)) - 1];
    this.listPanel({
      title: 'Quests', tab: tab, page: page, rows: rows, tabs: TABS, reopen: function (t, p) { self.openQuests(t, p); },
      sub: function () {
        var when = { daily: 'New quests at midnight', weekly: 'New goals every Monday', monthly: month + ' goals: new on the 1st', badges: 'Badges for big milestones' }[tab];
        return when + '   ·   Sunbeams: ' + s.stars;
      },
    });
  };

  // ---------- the notice board: requests, and the events list ----------
  var noticeBoard = U.noticeBoard;
  U.noticeBoard = function () { this.openBoard(0); };

  U.openBoard = function (page) {
    var self = this, s = F.session.state;
    L.ensureRequests(s);
    var bonus = L.streakBonus(s);
    var rows = s.rq.list.map(function (r, i) {
      var v = C.VILLAGERS[r.from], item = C.ITEMS[r.id], have = L.countItem(s, r.id);
      var desc = r.done ? 'Done. Thank you!' : (r.where === 'person' ? 'Ask ' + v.name.split(' ').pop() + ' in town (look for the "!"). ' : 'You have ' + have + '/' + r.n + '. ') +
        (r.done ? '' : 'Pays ' + Math.round(r.gold * (1 + bonus)) + 'G and friendship.');
      return {
        people: r.from, name: v.name + ': ' + r.n + ' ' + item.name, desc: desc,
        buttons: r.where === 'board' && L.canFinishRequest(s, i) ? [{
          label: 'Give', cb: function () {
            var res = L.finishRequest(s, i);
            if (typeof res !== 'object') return;
            sfx('coin');
            world().changed();
            world().save();
            self.closeModal();
            self.openBoard(page);
            self.toast(v.name + ' says thank you! +' + res.gold + 'G' + (res.bonus ? ' (streak +' + Math.round(res.bonus * 100) + '%)' : ''), 2600, 0x7a4d12);
          },
        }] : [],
      };
    });
    var o = this.listPanel({
      title: 'Notice Board', rows: rows, page: page, reopen: function (t, p) { self.openBoard(p); },
      sub: function () {
        var n = s.rq.last >= s.day - 1 ? s.rq.streak : 0;
        return "Today's requests  ·  Streak " + n + (bonus ? ' (+' + Math.round(bonus * 100) + '% gold)' : '\nOne a day builds bonus gold');
      },
      empty: 'No requests today.',
      corner: { label: 'Events', color: BLUE, cb: function () { self.closeModal(); noticeBoard.call(self); } },
    });
    return o;
  };

  // ---------- the trader ----------
  U.openTrader = function (tab, page) {
    var self = this, s = F.session.state, rows, o;
    if (!L.traderHere(s)) return this.toast('Saffron has packed up for today.');
    var redo = function () { self.closeModal(); self.openTrader(tab, page); };
    if (tab === 'sell') {
      var wanted = L.traderWanted(s);
      rows = C.TRADER.buys.slice().sort(function (a, b) { return (wanted.indexOf(b) >= 0) - (wanted.indexOf(a) >= 0); }).map(function (id) {
        var item = C.ITEMS[id], have = L.countItem(s, id), left = L.traderLeft(s, id), price = L.traderPrice(s, id);
        return {
          icon: item.icon, name: item.name + (wanted.indexOf(id) >= 0 ? '  WANTED' : ''),
          desc: price + 'G each. You have ' + have + '.' + (left < C.TRADER.perDay ? ' She takes ' + left + ' more today.' : ''),
          buttons: have && left ? [1, Math.min(have, left)].filter(function (n, k) { return k === 0 || n > 1; }).map(function (n, k) {
            return {
              label: (k ? 'Sell ' + n : 'Sell 1'), color: k ? BLUE : GREEN, cb: function () {
                var g = L.traderSell(s, id, n);
                if (typeof g !== 'number') return;
                sfx('coin');
                world().changed();
                world().save();
                redo();
                self.toast('Saffron pays you ' + g + 'G.', 2000, 0x7a4d12);
              },
            };
          }) : [],
        };
      });
    } else {
      rows = C.TRADER.swaps.map(function (sw, i) {
        var give = sw.give.map(function (g) { return g[1] + ' ' + (g[0] === 'stars' ? (g[1] > 1 ? 'Sunbeams' : 'Sunbeam') : C.ITEMS[g[0]].name); }).join(' + ');
        var row = { icon: C.ICON.star, name: '', desc: 'For ' + give + '.' };
        if (sw.get.item) { row.icon = C.ITEMS[sw.get.item].icon; row.name = (sw.get.n > 1 ? sw.get.n + ' ' : '') + C.ITEMS[sw.get.item].name; }
        else if (sw.get.stars) { row.name = sw.get.stars + (sw.get.stars > 1 ? ' Sunbeams' : ' Sunbeam'); row.icon = C.ICON.sunbeam; }
        else if (sw.get.furniture) { var f = L.swapPiece(s, 'furniture'); row.img = self.furnImg(f.t, f.v); row.name = L.furnName(f.t, f.v); row.desc += ' Any season!'; }
        else if (sw.get.yard) { var y = L.swapPiece(s, 'yard'); row.img = self.yardImg(y.t); row.name = C.OUTDOOR.types[y.t].name; row.desc += ' Any season!'; }
        row.buttons = L.canSwap(s, i) ? [{
          label: 'Swap', cb: function () {
            var r = L.traderSwap(s, i);
            if (r === 'full') { sfx('nope'); return self.toast('Your bag is full!'); }
            if (typeof r !== 'object') return;
            sfx('coin');
            world().changed();
            world().save();
            redo();
            self.toast('A fair trade! ' + (r.furniture || r.yard ? 'It is in your storage.' : ''), 2200, 0x7a4d12);
          },
        }] : [];
        return row;
      });
    }
    o = this.listPanel({
      title: "Saffron's Tent", tab: tab, page: page, rows: rows, tabs: [['sell', 'Sell'], ['swap', 'Swap']],
      reopen: function (t, p) { self.openTrader(t, p); },
      sub: function () { return s.gold + 'G   Sunbeams: ' + s.stars + (tab === 'sell' ? '   She pays best for WANTED goods.' : '   Rare things for goods or Sunbeams.'); },
    });
    return o;
  };

})(window.Farm = window.Farm || {});
