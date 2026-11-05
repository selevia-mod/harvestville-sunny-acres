// Bayanihan Projects on screen and in town (owner, 6 Nov 2026: "Bayani Projects, i like this"; "We need to make it
// related to the town."; rules 01-logicZZZZ-bayanihan.js, server supabase/farm_online_20.sql, map places
// tools/bayanihan-town.js).
//   The Bayanihan board by the plaza (and a row in Online, Friends): the project the whole server is building, each need
//     with the town's progress, Give (pick how many: the things leave the bag only when the server says ok), your points
//     and reward tier, your barangay's points, the top 10 givers, and the town: what is built, what is next, and the
//     reward to claim for each one you helped.
//   Offline or not signed in: the board shows the project and says "Join online play to help the town." Before part 20
//     is applied it says the projects open soon. No errors either way.
//   The town: the broken Old Bridge (mended when built: a shortcut over the river, and a fishing spot where bigger fish
//     bite), the Market Hall's roof over the stall, flowers and sparkles round the Plaza Fountain (a wishing coin once a
//     day), the Chapel Bell in its frame (ring it on festival days), and the Old Pier out to the boat (the boatman's
//     catch once a day; the islands later). Drawn stand-ins: new art can replace them (docs/bayanihan-projects.md).
//   A first-time tour (owner, 4 Oct 2026: every new feature gets one), the first time the board opens.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var BH = C.BH;
  var T = C.TILE;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, GOLD = 0xe9a91c, INK_GREEN = 0x2f5a22;
  var TABS = [['now', 'Project'], ['top', 'Top 10'], ['town', 'Town']];
  var POLL = 600000, RETRY = 60000, FRESH = 7 * 86400; // (seconds: a project built longer ago than this is not celebrated)
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var me = function () { return F.session && F.session.state; };
  var save = function () { F.Host.save(F.session.state); };
  var quiet = function () { return !!(window.gameHost && window.gameHost.quiet); };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var off = function (e) { if (missing(e)) O.bhOff = true; return O.bhOff; };
  var NET = 'Could not reach the online world. Check your connection.';
  var requestId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };
  // how far along a project is, by points: [given, needed]; pct: 0..1
  var points = function (cur) {
    var have = 0, goal = 0;
    (cur ? cur.needs : []).forEach(function (n) { have += n.have * n.pts; goal += n.goal * n.pts; });
    return [have, goal];
  };
  var pct = function (cur) { var p = points(cur); return p[1] ? p[0] / p[1] : 0; };
  var defNeeds = function (def) { return def.needs.map(function (n) { return { id: n[0], goal: n[1], have: 0, pts: n[2], day: n[3], today: 0 }; }); };

  // ---------- the server's state ----------
  O.bh = null; // the last farm_project_state_v1, read (L.bhRead)
  O.bhOff = false; // part 20 is not applied yet: everything online about it hides quietly
  var tried = 0;
  O.bhLoad = function () {
    if (!O.on || O.bhOff) return Promise.resolve(null);
    tried = Date.now();
    return F.Net.rpc('farm_project_state_v1', {}).then(function (r) {
      var st = L.bhRead(r), s = me();
      if (!st || !s) return O.bh;
      O.bh = st;
      var fresh = L.bhSync(s, st);
      // projects built long ago (a farm that comes online late) are simply there, with no party for each
      st.done.forEach(function (d) { if (d.ago > FRESH && !L.bhClaimable(d)) L.bhCelebrated(s, d.key); });
      if (fresh.length) save();
      F.bus.emit('bh');
      if (fresh.length && F.world && F.world.bh) F.world.bhApply(true);
      O.bhParty();
      return st;
    }, function (e) { off(e); return null; });
  };
  L.bhClaimable = function (d) { return d && d.tier > 0 && !d.claimed; };
  F.bus.on('online', function () { if (!O.on) O.bh = null; });

  // A gift whose answer never came (the app closed, the network dropped): asked again with the same request id, so it
  // counts once; its things leave the bag only if the server took them.
  var asking = false;
  O.bhRetry = function () {
    var s = me(), p = s && L.bhPending(s);
    if (!O.on || O.bhOff || !p || asking) return Promise.resolve(null);
    asking = true;
    return F.Net.rpc('farm_project_give_v1', { p_item: p.i, p_n: p.n, p_request_id: p.r, p_project: p.k }).then(function (r) {
      asking = false;
      var a = L.bhAnswer(s, r, O.bh && O.bh.current);
      save();
      F.bus.emit('hud');
      return a;
    }, function (e) { asking = false; off(e); return null; });
  };

  // When the game connects (after the rank, town and Cup prizes): a gift left waiting, then the town's state.
  var prizes = O.prizes;
  O.prizes = function () {
    return prizes.call(O).then(function (won) {
      return O.bhRetry().then(O.bhLoad).then(function () { return won; }, function () { return won; });
    });
  };
  setInterval(function () {
    if (!O.on || O.bhOff || F.Host.sleeping || Date.now() - tried < POLL) return;
    O.bhRetry().then(O.bhLoad);
  }, 30000);

  // A project just built: the news, once per farm (and where to claim the reward).
  O.bhParty = function () {
    var s = me(), p = s && L.bhToCelebrate(s);
    if (!p || quiet()) return;
    var show = function () {
      var ui = F.ui;
      if (!ui || ui.modals.length || (F.world && F.world.busy)) return setTimeout(show, 1500);
      if (!L.bhToCelebrate(s) || L.bhToCelebrate(s).key !== p.key) return;
      L.bhCelebrated(s, p.key);
      save();
      ui.bhCelebrate(p);
    };
    show();
  };
  U.bhCelebrate = function (p) {
    var self = this, d = O.bh && O.bh.done.filter(function (x) { return x.key === p.key; })[0], mine = d && L.bhClaimable(d);
    sfx('fanfare');
    this.dialog(p.name.toUpperCase() + ' IS BUILT!\nSalamat, Harvest Ville! Everyone built it together.\n' + p.benefit +
      (mine ? '\nYour reward is waiting at the Bayanihan board.' : ''), mine ? [{ label: 'Later', color: GREY }, { label: 'Claim', color: GOLD, cb: function () { self.bhClaimIt(p.key); } }] : null);
  };

  // ---------- the board ----------
  var take = function (key) {
    var s = me();
    if (!s || F.session.visit || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };
  // tab: 'now' | 'top' | 'town'; then(): once it is up (a toast)
  U.openBayanihan = function (tab, page, then) {
    var self = this, ticket = this.swapping;
    if (take('bh_tour')) return this.tour('bh', function () { self.openBayanihan(tab, page, then); });
    tab = tab || 'now';
    if (!O.on || O.bhOff) return this.bhPanel(tab, page, null, then);
    var ready = O.bh && Date.now() - tried < RETRY ? Promise.resolve(O.bh) : O.bhRetry().then(O.bhLoad);
    ready.then(function (st) {
      if (self.swapGone(ticket)) return;
      self.bhPanel(tab, page, st || O.bh, then || (st || O.bh ? null : function () { self.toast(O.bhOff ? 'Bayanihan Projects open soon!' : NET, 2600); }));
    });
  };
  U.bhPanel = function (tab, page, st, then) {
    var self = this, s = me(), cur = st && st.current, def = cur ? cur.def : L.bhNext(s);
    var rows = tab === 'top' ? this.bhTopRows(st) : tab === 'town' ? this.bhTownRows(st) : this.bhNowRows(st, def);
    var sub = tab === 'top' ? (cur ? fmt(cur.givers) + (cur.givers === 1 ? ' farmer has' : ' farmers have') + ' given to ' + def.name + '.' : 'The town\'s top givers.')
      : tab === 'town' ? 'What Harvest Ville has built together.'
        : def ? 'Project ' + (L.bhIndex(def.key) + 1) + ' of ' + BH.projects.length + '. Everyone in Harvest Ville builds it together!' : 'Every project is built. Salamat!';
    var per = rows.length > 5 ? 4 : 5;
    this.listPanel({
      title: 'Bayanihan Projects', tab: tab, tabs: TABS, rows: rows, page: Math.min(page || 0, Math.max(0, Math.ceil(rows.length / per) - 1)),
      sub: function () { return sub; }, empty: tab === 'top' ? 'No gifts yet. Be the first!' : null,
      reopen: function (t, p) { self.openBayanihan(t, p); },
    });
    if (then) then();
  };

  // The project now: what it is for, each need (Give), your help, your barangay.
  U.bhNowRows = function (st, def) {
    var self = this, s = me(), cur = st && st.current, rows = [];
    if (!def) return [{ icon: C.ICON.ribbon, name: 'Willowbrook is built!', desc: 'Every Bayanihan Project is done. New ones are coming!' }];
    var live = !!cur, needs = live ? cur.needs : defNeeds(def), p = live ? pct(cur) : 0;
    rows.push({ icon: C.ICON[def.icon], name: def.name, desc: (live ? Math.floor(p * 100) + '% built (points from every farm). ' : '') + def.benefit, progress: live ? points(cur) : null, tag: 'NOW' });
    if (!live) {
      rows.push(O.bhOff && O.on ? { icon: C.ICON.calendar, name: 'Opening soon', desc: 'The town is getting ready. Bayanihan Projects open soon!' }
        : { icon: C.ICON.heart, name: 'Join online play to help the town.', desc: 'Every farm gives toward the same project, and the town changes for everyone.',
          buttons: F.Net.available() ? [{ label: 'Online', color: BLUE, cb: function () { self.closeAll(); self.openOnline('friends', 0); } }] : [] });
    }
    needs.forEach(function (n) {
      var have = L.bhHave(s, n.id), full = live && n.have >= n.goal;
      rows.push({
        icon: L.bhIcon(n.id), name: L.bhName(n.id) + (live ? ' ' + fmt(n.have) + '/' + fmt(n.goal) : ': ' + fmt(n.goal)), done: full,
        progress: live && !full ? [n.have, n.goal] : null,
        desc: full ? 'The town has all it needs of this. Salamat!' : 'You have ' + fmt(have) + '.' + (live ? ' Today ' + n.today + ' of ' + n.day + '.' : ' Up to ' + n.day + ' a day.') + ' +' + n.pts + (n.pts > 1 ? ' points' : ' point') + ' each.',
        buttons: live && !full ? [{ label: 'Give', color: have > 0 ? GREEN : GREY, cb: function () { self.bhGive(n); } }] : [],
      });
    });
    if (live) {
      var tiers = cur.tiers, t = L.bhTier(cur.mine, tiers), next = tiers[t];
      rows.push({
        icon: C.ICON.ribbon, name: 'Your help: ' + fmt(cur.mine) + ' points', tag: t ? tiers[t - 1].name.toUpperCase() : null,
        desc: (t ? tiers[t - 1].name + ': ' + fmt(tiers[t - 1].gold) + 'G, the title ' + def.title + ' and a yard piece when it is built.' : 'Give anything to earn a reward when it is built.') +
          (next ? ' ' + fmt(next.at) + (next.at === 1 ? ' point' : ' points') + ' for ' + next.name + '.' : '') + ' Most: ' + fmt(cur.cap) + '.',
      });
      if (cur.hood) rows.push({ icon: C.ICON.carabao, name: cur.hood.name, desc: fmt(cur.hood.pts) + ' points from your barangay for ' + def.name + '.' });
      if (!st.canGive) rows.splice(1, 0, { icon: C.ICON.exclaim, name: 'Sign in to give', desc: 'Giving to the town needs a Selebox account.' });
    }
    return rows;
  };

  U.bhTopRows = function (st) {
    var cur = st && st.current;
    if (!cur) return [{ icon: C.ICON.heart, name: 'Join online play to help the town.', desc: 'The top givers show here.' }];
    return cur.top.filter(function (g) { return !O.blocked[g.id]; }).map(function (g, i) {
      return { icon: i < 3 ? C.ICON.ribbon : C.ICON.heart, name: '#' + (i + 1) + ' ' + g.name + (g.me ? ' (you)' : ''), desc: fmt(g.pts) + ' points for ' + cur.def.name + '.',
        buttons: g.me ? [] : [{ label: 'Visit', cb: function () { O.visit(g.id); } }] };
    });
  };

  // The town: every project, built (with its reward to claim), on now, or later; and your titles.
  U.bhTownRows = function (st) {
    var self = this, s = me(), cur = st && st.current, rows = [];
    var titles = L.bhTitles(s);
    if (titles.length) rows.push({ icon: C.ICON.ribbon, name: 'Your titles', desc: titles.join(', ') + '.' });
    BH.projects.forEach(function (p) {
      var built = L.bhBuilt(s, p.key), d = st && st.done.filter(function (x) { return x.key === p.key; })[0];
      var claimed = L.bhClaimed(s, p.key), can = d && L.bhClaimable(d) && !claimed;
      if (d && d.claimed && !claimed && d.tier) can = true; // (claimed on the server, the answer lost: claim again to get it)
      rows.push({
        icon: C.ICON[p.icon], name: p.name, done: built && !can, tag: built ? 'BUILT' : cur && cur.key === p.key ? 'NOW' : null,
        desc: built ? (claimed ? 'Built! You are a ' + p.title + '. ' : d && !d.tier ? 'Built by the town. ' : '') + p.benefit : (cur && cur.key === p.key ? 'Building now. ' : 'Coming later. ') + p.what,
        buttons: can ? [{ label: 'Claim', color: GOLD, cb: function () { self.bhClaimIt(p.key); } }] : [],
      });
    });
    return rows;
  };

  // ---------- giving ----------
  U.bhGive = function (need) {
    var self = this, s = me(), st = O.bh, cur = st && st.current;
    if (!cur || this.bhBusy) return;
    var name = L.bhName(need.id), have = L.bhHave(s, need.id);
    if (!st.canGive) { sfx('nope'); return this.toast('Giving to the town needs a Selebox account. Sign in to help!', 2800); }
    if (L.bhPending(s)) { O.bhRetry(); return this.toast('One moment: your last gift is still on its way.', 2400); }
    var max = Math.min(BH.pickMost, L.bhGiveMax(s, cur, need));
    if (max <= 0) {
      sfx('nope');
      return this.toast(!have ? 'You have no ' + name + ' yet. Bring some from your farm!' : need.today >= need.day ? 'That is all the ' + name + ' you can give today. More tomorrow!'
        : need.have >= need.goal ? 'The town has all the ' + name + ' it needs!' : 'You gave all you can to ' + cur.def.name + '. Salamat!', 2800);
    }
    var pick = [1, 10].filter(function (n) { return n < max; }).concat([max]);
    this.dialog('GIVE ' + name.toUpperCase() + '\nYou have ' + fmt(have) + '. You can give up to ' + max + ' now.\nEach one: +' + need.pts + (need.pts > 1 ? ' points' : ' point') + ' for you and the town.',
      pick.map(function (n, i) { return { label: i === pick.length - 1 && pick.length > 1 ? 'All ' + n : String(n), color: i === pick.length - 1 ? GREEN : BLUE, cb: function () { self.bhSend(need, n); } }; }));
  };
  U.bhSend = function (need, n) {
    var self = this, s = me(), cur = O.bh && O.bh.current;
    if (!cur || this.bhBusy) return;
    this.bhBusy = true;
    var p = L.bhAsk(s, cur.key, need.id, n, requestId());
    save(); // (the request is kept: if the answer never comes, it is asked again with the same id)
    F.Net.rpc('farm_project_give_v1', { p_item: p.i, p_n: p.n, p_request_id: p.r, p_project: p.k }).then(function (r) {
      self.bhBusy = false;
      var a = L.bhAnswer(s, r, cur), name = L.bhName(need.id);
      save();
      F.bus.emit('hud');
      if (F.world && F.world.bh) F.world.bhBoard();
      if (a.ok) {
        sfx('coin');
        var text = 'Salamat! ' + a.n + ' ' + name + ' for ' + cur.def.name + '.';
        // the town's numbers again (everyone's gifts since, the top givers), then the board
        return O.bhLoad().then(function () {
          if (a.done) return self.closeAll(); // (built: the news and the town's change come with the new state)
          self.swapTo(function () { self.openBayanihan('now', 0, function () { self.toast(text, 2600, INK_GREEN); }); });
        });
      }
      sfx('nope');
      var why = { day: 'That is all the ' + name + ' you can give today. More tomorrow!', cap: 'You gave all you can to this project. Salamat!', met: 'The town has all the ' + name + ' it needs!',
        moved: 'The town moved on to the next project!', closed: 'The town does not need that now.', guest: 'Giving to the town needs a Selebox account.' }[a.code] || 'That did not work. Your things are still in your bag.';
      O.bhLoad().then(function () { self.swapTo(function () { self.openBayanihan('now', 0, function () { self.toast(why, 2800); }); }); });
    }, function (e) {
      // no answer: the things stay in the bag, and the request waits to be asked again (O.bhRetry)
      self.bhBusy = false;
      if (off(e)) { s.bh.p = null; save(); }
      self.toast(O.bhOff ? 'Bayanihan Projects open soon!' : NET + ' Your things are still in your bag.', 2800);
    });
  };

  // ---------- the reward ----------
  U.bhClaimIt = function (key) {
    var self = this, s = me(), def = L.bhDef(key);
    if (!def || !O.on || this.bhBusy) return;
    this.bhBusy = true;
    F.Net.rpc('farm_project_claim_v1', { p_project: key }).then(function (r) {
      self.bhBusy = false;
      var got = L.bhClaim(s, key, r);
      if (got === 'claimed') return self.toast('You already have this reward. Salamat!', 2400);
      if (got === 'bad') {
        sfx('nope');
        return self.toast({ none: 'You did not give to this one. Help the next project!', guest: 'Rewards need a Selebox account.', 'not-done': 'Not built yet. Keep giving!' }[r && r.code] || 'That did not work. Try again later.', 2600);
      }
      save();
      F.bus.emit('hud');
      sfx('fanfare');
      self.closeAll();
      self.dialog('THANK YOU, ' + got.title.toUpperCase() + '!\n' + BH.tiers[got.tier - 1].name + ' of ' + def.name + ': +' + fmt(got.gold) + 'G, the title ' + got.title +
        (got.deco ? ', and a ' + got.deco + ' for your yard (in storage: Decorate on your farm).' : '.'));
    }, function () { self.bhBusy = false; self.toast(NET); });
  };

  // ---------- the row in Online, Friends ----------
  U.bhRow = function () {
    var self = this, st = O.bh, s = me();
    if (!O.on || O.bhOff || !st) return null;
    var cur = st.current, claim = st.done.filter(function (d) { return L.bhClaimable(d) && !L.bhClaimed(s, d.key); }).length;
    return {
      icon: C.ICON[cur ? cur.def.icon : 'ribbon'], name: cur ? 'Bayanihan: ' + cur.def.name : 'Bayanihan Projects',
      desc: (claim ? 'A reward to claim! ' : '') + (cur ? Math.floor(pct(cur) * 100) + '% built by the whole town. You gave ' + fmt(cur.mine) + ' points.' : 'Every project is built. Salamat!'),
      buttons: [{ label: claim ? 'Claim' : 'Open', color: claim ? GOLD : BLUE, cb: function () { self.swapTo(function () { self.openBayanihan(claim ? 'town' : 'now', 0); }); } }],
    };
  };
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    if (o && o.title === 'Online' && o.tab === 'friends' && Array.isArray(o.rows) && !o.bhDone) {
      o.bhDone = true;
      var row = this.bhRow();
      if (row) o.rows = o.rows.slice(0, 1).concat([row], o.rows.slice(1));
      else if (O.on && !O.bhOff && !O.bh && Date.now() - tried > RETRY) O.bhLoad();
    }
    return listPanel.call(this, o);
  };

  // ---------- the tour ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.bh = {
    title: 'BAYANIHAN PROJECTS',
    steps: [
      {
        text: 'The whole of Harvest Ville builds Willowbrook together: one project at a time, and every farm gives to the same one.',
        draw: function (ui, sc, move) {
          ['lumber', 'stone', 'ore_copper', 'fish_s'].forEach(function (k, i) {
            var g = icon(ui, sc, 60 + i * 50, 50, C.ICON[k], 0.28);
            tw(ui, move, { targets: g, y: 86, alpha: 0.2, duration: 900, repeat: -1, delay: i * 220, ease: 'Sine.in' });
          });
          sc.add(ui.add.rectangle(24, 104, 120, 12, 0x6a4a2a).setOrigin(0, 0.5));
          var bar = ui.add.rectangle(26, 104, 10, 8, 0x3fa535).setOrigin(0, 0.5);
          sc.add(bar);
          tw(ui, move, { targets: bar, width: 116, duration: 2400, repeat: -1, hold: 500 });
          if (!move) bar.width = 70;
          words(ui, sc, 212, 104, 'The Old Bridge', 12, '#5a3a1e');
        },
      },
      {
        text: 'Give from your bag at the Bayanihan board by the plaza. Your barangay\'s gifts count for it too.',
        draw: function (ui, sc, move) {
          var b = icon(ui, sc, 80, 66, C.ICON.calendar, 0.4);
          tw(ui, move, { targets: b, angle: { from: -5, to: 5 }, duration: 500, yoyo: true, repeat: -1 });
          words(ui, sc, 186, 46, 'Give 10 Lumber', 14);
          var p = words(ui, sc, 186, 82, '+10 points', 14, '#2f7a22');
          tw(ui, move, { targets: p, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
          words(ui, sc, 186, 110, 'Barangay +10', 12, '#5a3a1e');
        },
      },
      {
        text: 'When it is built, the town changes for everyone, and everyone who gave gets Gold, a title and a piece for the yard!',
        draw: function (ui, sc, move) {
          words(ui, sc, 136, 40, 'BRIDGE BUILDER', 15, '#a8740c');
          var g = icon(ui, sc, 96, 86, C.ICON.coin, 0.32), h = icon(ui, sc, 176, 86, C.ICON.gift, 0.32);
          tw(ui, move, { targets: [g, h], scale: 0.38, duration: 420, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // ---------- in town ----------
  var canvas = function (w, key, cw, ch, draw) {
    if (!w.textures.exists(key)) {
      var t = w.textures.createCanvas(key, cw, ch);
      draw(t.getContext(), cw, ch);
      t.refresh();
    }
    return key;
  };
  var LINE = '#2a170b';
  var stroke = function (g, lw) { g.lineWidth = lw || 4; g.strokeStyle = LINE; g.stroke(); };
  var rectTo = function (g, x, y, w, h, fill) { g.beginPath(); g.rect(x, y, w, h); g.fillStyle = fill; g.fill(); stroke(g, 3); };
  // the broken bridge: posts standing out of the river and a plank or two floating (1 x 2 tiles, drawn at a quarter)
  var brokenTex = function (w) {
    return canvas(w, 'bh-broken', 64, 128, function (g) {
      [[8, 14], [48, 14], [8, 92], [48, 92]].forEach(function (p) { rectTo(g, p[0], p[1], 8, 22, '#6b4424'); });
      g.save(); g.translate(30, 62); g.rotate(-0.5); rectTo(g, -22, -5, 44, 10, '#b07a42'); g.restore();
      g.save(); g.translate(22, 40); g.rotate(0.3); rectTo(g, -10, -4, 20, 8, '#a06a36'); g.restore();
    });
  };
  // the Market Hall's roof: a striped awning with its sign, on two posts (5 x 3 tiles at a quarter)
  var hallTex = function (w) {
    return canvas(w, 'bh-hall', 316, 196, function (g) {
      rectTo(g, 6, 60, 10, 134, '#6b4424');
      rectTo(g, 300, 60, 10, 134, '#6b4424');
      for (var i = 0; i < 10; i++) {
        g.beginPath(); g.moveTo(i * 31.6, 22); g.lineTo((i + 1) * 31.6, 22); g.lineTo((i + 1) * 31.6, 62);
        g.arc(i * 31.6 + 15.8, 62, 15.8, 0, Math.PI); g.closePath();
        g.fillStyle = i % 2 ? '#fff4dc' : '#d8463a'; g.fill(); stroke(g, 3);
      }
      g.beginPath(); g.moveTo(0, 24); g.lineTo(158, 2); g.lineTo(316, 24); g.closePath(); g.fillStyle = '#9a3a28'; g.fill(); stroke(g, 3);
      rectTo(g, 98, 4, 120, 26, '#ffe9a8');
      g.fillStyle = '#5a3a1e'; g.font = 'bold 17px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('MARKET HALL', 158, 18);
    });
  };
  // the Chapel Bell's frame (1 x 2 tiles at a quarter); the bell itself is a picture of its own
  var frameTex = function (w) {
    return canvas(w, 'bh-frame', 64, 128, function (g) {
      rectTo(g, 6, 18, 8, 108, '#6b4424');
      rectTo(g, 50, 18, 8, 108, '#6b4424');
      rectTo(g, 0, 10, 64, 12, '#8a5a32');
    });
  };
  var bellTex = function (w) {
    return canvas(w, 'bh-bell', 48, 48, function (g) {
      g.beginPath(); g.moveTo(24, 4); g.quadraticCurveTo(8, 6, 8, 30); g.lineTo(3, 40); g.lineTo(45, 40); g.lineTo(40, 30); g.quadraticCurveTo(40, 6, 24, 4);
      g.fillStyle = '#e0a42a'; g.fill(); stroke(g, 3);
      g.beginPath(); g.arc(24, 42, 5, 0, Math.PI * 2); g.fillStyle = '#8a5a12'; g.fill();
    });
  };

  var rectOf = function (w, type) { return w.objects.filter(function (o) { return o.type === type; })[0] || null; };
  var setupExtras = P.setupExtras;
  P.setupExtras = function () {
    setupExtras.call(this);
    this.bh = null;
    if (this.mapKey !== 'town' || this.state.isVisit) return;
    var board = rectOf(this, 'bh_board');
    if (!board) return;
    var self = this, b = this.bh = { board: board, bridge: rectOf(this, 'bh_bridge'), fountain: rectOf(this, 'bh_fountain'), bell: rectOf(this, 'bh_bell'),
      pier: rectOf(this, 'bh_pier'), boat: rectOf(this, 'bh_boat'), hall: this.points.bh_hall, shown: {}, parts: [] };
    // the board: the order board's picture, a sign over it, and a bar for how far the project is
    var x = board.x0 * T, y = (board.y1 + 1) * T, d = DEPTH.actor + y / 1e5;
    this.add.image(x, y, F.ensureTexture(this, 'props/order_board')).setOrigin(0, 1).setDisplaySize(2 * T, 2 * T).setDepth(d);
    for (var bx = board.x0; bx <= board.x1; bx++) this.blocked[this.idx(bx, board.y1)] = true;
    var zone = this.add.zone(x + T, y - T / 2 + 8, 2 * T - 16, T - 16);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    b.sign = this.add.text(x + T, y - 2 * T + 10, 'BAYANIHAN', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '76px', fontStyle: 'bold', color: '#fff6d8', backgroundColor: '#9a3a28', padding: { x: 14, y: 4 } })
      .setOrigin(0.5, 1).setDepth(d + 0.0001);
    b.barBack = this.add.rectangle(x + 0.2 * T, y + 0.08 * T, 1.6 * T, 30, 0x5a3a1e).setOrigin(0, 0).setDepth(d + 0.0001).setVisible(false);
    b.bar = this.add.rectangle(x + 0.2 * T + 5, y + 0.08 * T + 5, 10, 20, 0x5fd04a).setOrigin(0, 0).setDepth(d + 0.0002).setVisible(false);
    this.bhApply(false);
    if (O.on && !O.bhOff && Date.now() - tried > RETRY) O.bhRetry().then(O.bhLoad);
    var onBh = function () { if (self.bh) self.bhBoard(); };
    F.bus.on('bh', onBh);
    this.events.once('shutdown', function () { F.bus.off('bh', onBh); });
  };

  // The board's bar (when the town's progress is known).
  P.bhBoard = function () {
    var b = this.bh, cur = O.bh && O.bh.current;
    if (!b) return;
    b.barBack.setVisible(!!cur);
    b.bar.setVisible(!!cur);
    if (cur) b.bar.width = Math.max(4, (1.6 * T - 10) * pct(cur));
  };

  // What the built projects changed in town (live: it was just built, with a sparkle where it is).
  P.bhApply = function (live) {
    var self = this, b = this.bh, s = this.state;
    if (!b) return;
    var put = function (r, x0, y0, x1, y1) {
      var gid = r && r.props && Number(r.props.fix);
      if (!gid) return;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) self.putTile('Ground', gid, x, y);
      self.recollide();
    };
    var sparkle = function (tx, ty) {
      if (!live) return;
      sfx('found');
      for (var k = 0; k < 6; k++) {
        var i = self.add.image((tx + Math.random() * 2 - 0.5) * T, (ty + Math.random() * 2 - 1) * T, 'items', C.ICON.sparkle).setScale(0.6).setDepth(DEPTH.Above + 1);
        self.tweens.add({ targets: i, y: i.y - T, alpha: 0, duration: 1400 + k * 120, onComplete: function (tw, t) { t[0].destroy(); } });
      }
    };
    var add = function (img) { b.parts.push(img); return img; };
    // the Old Bridge
    if (b.bridge && !b.shown.bridge) {
      if (L.bhBuilt(s, 'bridge')) {
        if (b.broken) b.broken.destroy();
        b.broken = null;
        put(b.bridge, b.bridge.x0, b.bridge.y0, b.bridge.x1, b.bridge.y1);
        b.shown.bridge = true;
        sparkle(b.bridge.x0, b.bridge.y0);
      } else if (!b.broken) {
        b.broken = add(this.add.image(b.bridge.x0 * T, b.bridge.y0 * T, brokenTex(this)).setOrigin(0).setDisplaySize(T, 2 * T).setDepth(DEPTH.flat));
      }
    }
    // the Market Hall
    if (b.hall && !b.shown.market && L.bhBuilt(s, 'market')) {
      b.shown.market = true;
      add(this.add.image(b.hall.x, b.hall.y, hallTex(this)).setOrigin(0).setDisplaySize(4.9 * T, 3.05 * T).setDepth(DEPTH.actor + (b.hall.y + 3 * T) / 1e5 + 0.001));
      sparkle(b.hall.x / T + 1.5, b.hall.y / T + 1);
    }
    // the Plaza Fountain: flowers each side, and a twinkle on the water
    if (b.fountain && !b.shown.fountain && L.bhBuilt(s, 'fountain')) {
      b.shown.fountain = true;
      var fx = b.fountain.x0, fy = b.fountain.y1 + 1;
      [[fx - 2, fy - 1], [fx + 3, fy - 1]].forEach(function (p) { // (beside it, on the plaza's stones by its sides)
        add(self.add.image(p[0] * T, p[1] * T, F.ensureTexture(self, 'props/flowerbed')).setOrigin(0, 1).setDisplaySize(2 * T, T).setDepth(DEPTH.actor + p[1] * T / 1e5));
      });
      for (var k = 0; k < 3; k++) {
        var tw2 = add(this.add.image((fx + 0.7 + k * 0.8) * T, (fy - 2.3 + (k % 2) * 0.3) * T, 'items', C.ICON.sparkle).setScale(0.45).setDepth(DEPTH.Above - 1).setAlpha(0.2));
        this.tweens.add({ targets: tw2, alpha: 0.95, scale: 0.6, duration: 700 + k * 230, yoyo: true, repeat: -1, delay: k * 300 });
      }
      sparkle(fx + 0.5, fy - 2);
    }
    // the Chapel Bell: the frame waits for its bell
    if (b.bell && !b.frame) {
      var by = (b.bell.y1 + 1) * T;
      b.frame = add(this.add.image(b.bell.x0 * T, by, frameTex(this)).setOrigin(0, 1).setDisplaySize(T, 2 * T).setDepth(DEPTH.actor + by / 1e5));
    }
    if (b.bell && !b.shown.bell && L.bhBuilt(s, 'bell')) {
      b.shown.bell = true;
      b.bellImg = add(this.add.image((b.bell.x0 + 0.5) * T, (b.bell.y0 + 0.2) * T, bellTex(this)).setOrigin(0.5, 0).setDisplaySize(0.72 * T, 0.72 * T).setDepth(DEPTH.actor + (b.bell.y1 + 1) * T / 1e5 + 0.0001));
      sparkle(b.bell.x0, b.bell.y0);
    }
    // the Old Pier: planks out to the boat
    if (b.pier && !b.shown.pier && L.bhBuilt(s, 'pier')) {
      b.shown.pier = true;
      put(b.pier, b.pier.x0, b.pier.y0, b.pier.x1, b.pier.y1);
      sparkle(b.pier.x0, b.pier.y0);
    }
    this.bhBoard();
  };

  // Is the farmer standing on the mended bridge? (its fishing spot)
  P.bhOnBridge = function () {
    var b = this.bh;
    if (!b || !b.bridge || !L.bhBuilt(this.state, 'bridge') || !this.player) return false;
    var f = this.feet(), x = Math.floor(f.x / T), y = Math.floor(f.y / T);
    return x === b.bridge.x0 && y >= b.bridge.y0 - 1 && y <= b.bridge.y1 + 1;
  };
  var rollFish = L.rollFish;
  L.rollFish = function (water, r) {
    var w = F.world;
    if (water === 'river' && w && w.mapKey === 'town' && w.bhOnBridge && w.bhOnBridge()) water = 'bridge';
    return rollFish.call(L, water, r);
  };

  // ---------- what the farmer can do here ----------
  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    var b = this.bh, s = this.state, self = this;
    if (b && o.type && o.type.indexOf('bh_') === 0) {
      var rod = held && held.id === 'rod';
      var about = function (key) {
        var p = L.bhDef(key);
        return { label: 'Look', icon: C.ICON[p.icon], run: function () {
          F.ui.dialog(p.name.toUpperCase() + '\n' + p.what + '\nA Bayanihan Project: give at the board by the plaza.', [{ label: 'OK', color: GREY }, { label: 'Board', cb: function () { F.ui.openBayanihan('now', 0); } }]);
        } };
      };
      switch (o.type) {
        case 'bh_board': return { label: 'Board', icon: C.ICON.calendar, run: function () { F.ui.openBayanihan('now', 0); } };
        case 'bh_bridge': return L.bhBuilt(s, 'bridge') || rod ? null : about('bridge');
        case 'bh_pier': return L.bhBuilt(s, 'pier') || rod ? null : about('pier');
        case 'bh_fountain':
          if (!L.bhBuilt(s, 'fountain')) return null;
          return { label: 'Wish', icon: C.ICON.coin, run: function () { self.bhWish(); } };
        case 'bh_bell': return L.bhBuilt(s, 'bell') ? { label: 'Bell', icon: C.ICON.ore_gold, run: function () { self.bhRing(); } } : about('bell');
        case 'bh_boat': return L.bhBuilt(s, 'pier') && !rod ? { label: 'Boat', icon: C.ICON.fish_l, run: function () { self.bhBoatTalk(); } } : null;
      }
    }
    return extraObjectAction.call(this, o, held, def);
  };

  P.bhWish = function () {
    var s = this.state, r = L.bhWish(s), f = this.feet();
    if (r === 'done') return F.ui.toast('You made your wish today. Come back tomorrow!', 2400);
    if (r === 'full') return F.ui.toast('Your bag is full!', 2000);
    if (!r || typeof r !== 'object') return;
    sfx('coin');
    this.floatTextAt(f.x, f.y - 2 * T, r.gold ? '+' + r.gold + 'G' : '+' + r.n + ' ' + C.ITEMS[r.id].name);
    this.changed();
    this.save();
    F.bus.emit('hud');
    F.ui.toast('Plink! You tossed a coin and made a wish. ' + (r.gold ? 'The fountain gave back ' + r.gold + 'G!' : 'You found ' + r.n + ' ' + C.ITEMS[r.id].name + '!'), 3000, INK_GREEN);
  };
  P.bhRing = function () {
    var s = this.state, r = L.bhRing(s), self = this;
    if (r === 'day') return F.ui.dialog('THE CHAPEL BELL\nThe whole town hung it together. On festival days, ring it for a festival gift, and contest prizes pay more.');
    if (r === 'done') return F.ui.toast('You rang the bell today. Happy festival!', 2400);
    if (!r || typeof r !== 'object') return;
    sfx('tw_bell');
    if (this.bh && this.bh.bellImg) this.tweens.add({ targets: this.bh.bellImg, angle: { from: -18, to: 18 }, duration: 260, yoyo: true, repeat: 3, onComplete: function () { if (self.bh && self.bh.bellImg) self.bh.bellImg.angle = 0; } });
    this.changed();
    this.save();
    F.bus.emit('hud');
    F.ui.toast('Ding, dong! A festival gift from the town: +' + r.gold + 'G!', 3000, INK_GREEN);
  };
  P.bhBoatTalk = function () {
    var s = this.state, self = this;
    if (BH.islands) return BH.islands(this); // (the hook for the island hunting places, later)
    var r = L.bhBoat(s);
    if (r === 'full') return F.ui.toast('Your bag is full!', 2000);
    var line = r === 'done' ? '"That was today\'s catch, friend. Come back tomorrow!"' : '"Fresh from the sea, for the town\'s Pier Captain!" (+' + r.items.map(function (e) { return e[1] + ' ' + C.ITEMS[e[0]].name; }).join(', ') + ')';
    if (r && typeof r === 'object') { sfx('catch'); self.changed(); self.save(); }
    F.ui.dialog('THE BOATMAN\n' + line + '\nOne day this boat will carry you to the islands. Soon!');
  };
})(window.Farm = window.Farm || {});
