// Barangays and the weekly Bayanihan Cup on screen (owner, 4 Nov 2026: "Neighborhoods with a weekly Derby"; rules
// 01-logicZ-social.js, server supabase/farm_online_16.sql).
//   Online, Friends: a Barangay row (yours, or Find). Find lists your friends' barangays first, then the busiest; Make
//     your own (a name, a badge, open or with a code); Code joins a closed one.
//   The Barangay panel: Cup (this week's 8 tasks; Pick one, do it in your game, and it is turned in by itself when it is
//     done), League (your group of 10 barangays your size, and the prizes), Members (who is online, what each did;
//     Leave; the leader sees the code, makes a new one, opens or closes it and can take a member out, who then cannot
//     come back for 7 days) and News (short lines, and who did what). Guests see the Cup but cannot pick a task.
//   When the game connects: last weeks' Cup prizes, once (the server pays what it says).
// Before part 16 is applied all of it hides quietly (O.nbOff): no row, no panel, no message.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var U = F.UIScene.prototype;
  var NB = C.NB;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GREY = 0xa08a68, RED = 0xc0503a, GOLD = 0xe9a91c, INK_GREEN = 0x2f5a22;
  var RETRY = 300000; // a load that failed (not "missing") is tried again this long after
  var TABS = [['cup', 'Cup'], ['league', 'League'], ['members', 'Members'], ['news', 'News']];
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var name = function (n) { return L.cleanText(n, 24) || 'Farmer'; };
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var off = function (e) { if (missing(e)) O.nbOff = true; return O.nbOff; };
  var net = 'Could not reach the online world. Check your connection.';
  var save = function () { F.Host.save(F.session.state); };

  O.nb = null; // the last farm_nb_v1, read (L.nbRead)
  var tried = 0;

  // ---------- loading ----------
  O.nbLoad = function () {
    if (!O.on || O.nbOff) return Promise.resolve(null);
    tried = Date.now();
    return F.Net.rpc('farm_nb_v1', {}).then(function (r) {
      var nb = L.nbRead(r), s = F.session.state;
      if (!nb) return O.nb;
      O.nb = nb;
      if (L.nbSync(s, nb.hood ? nb.pick : null, nb.week)) save();
      return nb;
    }, function (e) { off(e); return null; });
  };
  F.bus.on('online', function () { if (!O.on) O.nb = null; });

  // Last weeks' prizes, when the game connects (after the rank and town prizes).
  O.cupClaim = function () {
    if (!O.on || O.nbOff) return Promise.resolve([]);
    return F.Net.rpc('farm_cup_claim_v1', {}).then(function (list) {
      var won = L.cupClaimRead(list);
      if (!won.length) return won;
      var s = F.session.state;
      L.payClaims(s, won);
      save();
      F.bus.emit('hud');
      sfx('coin');
      var rows = won.map(function (p) {
        return [C.ICON.ribbon, (p.place <= 3 && p.stars ? '#' + p.place + ' in your group! ' : 'Thank you for taking part! ') + p.name + ': +' + fmt(p.gold) + 'G' + (p.stars ? ' and ' + p.stars + (p.stars > 1 ? ' Sunbeams' : ' Sunbeam') : '') + '.'];
      });
      var show = function () {
        if (!F.ui || F.ui.modals.length) return setTimeout(show, 1500);
        F.ui.dialog('BAYANIHAN CUP PRIZES', null, { rows: rows });
      };
      show();
      return won;
    }, function (e) { off(e); return []; });
  };
  var prizes = O.prizes;
  O.prizes = function () {
    return prizes.call(O).then(function (won) {
      return O.cupClaim().then(O.nbLoad).then(function () { return won; }, function () { return won; });
    });
  };

  // ---------- your task: turned in by itself when it is done ----------
  var retryAt = 0, turning = false, saidDay = '';
  O.cupDone = function (byHand) {
    var s = F.session.state, p = L.nbProgress(s);
    if (!O.on || O.nbOff || turning || !p || !p.done) return Promise.resolve(null);
    turning = true;
    return F.Net.rpc('farm_cup_done_v1', {}).then(function (r) {
      turning = false;
      var code = r && r.code, ui = F.ui;
      if (r && r.ok) {
        s.nb = null;
        save();
        sfx('found');
        var hood = O.nb && O.nb.hood ? O.nb.hood.name : 'your barangay';
        var text = 'Bayanihan Cup: ' + L.nbTaskText(p.kind, p.goal) + ' done! +' + (Math.floor(Number(r.points)) || 0) + ' points for ' + hood + '.';
        return O.nbLoad().then(function () { if (ui && !byHand) ui.toast(text, 3400, INK_GREEN); return text; });
      }
      if (code === 'soon') {
        var wait = Math.max(10, Math.floor(Number(r.wait)) || 60);
        retryAt = Date.now() + wait * 1000 + 1000;
        return 'Almost! A Cup task can be turned in ' + L.formatLeft(wait / 60) + ' from now.';
      }
      if (code === 'day') {
        retryAt = Date.now() + 30 * 60000;
        var today = F.today ? F.today() : '';
        if (!byHand && saidDay === today) return null;
        saidDay = today;
        var t = 'That is ' + ((O.nb && O.nb.maxDay) || NB.dayTasks) + ' Cup tasks today. This one counts tomorrow!';
        if (ui && !byHand) ui.toast(t, 3000);
        return t;
      }
      // gone: last week's, or not in that barangay now
      s.nb = null;
      save();
      O.nbLoad();
      return code === 'late' ? 'A new week of the Cup has started. Pick a new task!' : 'That task is not there any more.';
    }, function (e) { turning = false; off(e); retryAt = Date.now() + 60000; return byHand ? net : null; });
  };
  setInterval(function () {
    var s = F.session && F.session.state;
    if (!s || !s.nb || !O.on || O.nbOff || Date.now() < retryAt || F.Host.sleeping) return;
    var p = L.nbProgress(s);
    if (p && p.done) O.cupDone(false);
  }, 3000);

  // ---------- the row in Online, Friends ----------
  U.hoodRow = function () {
    var self = this, nb = O.nb;
    if (!O.on || O.nbOff || !nb) return null;
    var h = nb.hood;
    if (!h) {
      return {
        icon: C.ICON.carabao, name: 'Barangays', desc: 'Team up with up to ' + NB.max + ' farms for the weekly Bayanihan Cup.',
        buttons: [{ label: 'Find', color: BLUE, cb: function () { self.swapTo(function () { self.openFindHood(); }); } }],
      };
    }
    var p = L.nbProgress(F.session.state);
    return {
      icon: L.nbBadgeIcon(h.badge), name: h.name, online: h.online > 0,
      desc: h.members + (h.members === 1 ? ' farm' : ' farms') + '. ' + (nb.cup ? 'Cup: #' + nb.cup.place + ', ' + fmt(nb.cup.score) + ' points.' : 'Bayanihan Cup this week!') +
        (p ? ' Your task: ' + p.n + '/' + p.goal + '.' : ''),
      buttons: [{ label: 'Open', color: BLUE, cb: function () { self.swapTo(function () { self.openHood('cup', 0); }); } }],
    };
  };
  var listPanel = U.listPanel;
  U.listPanel = function (o) {
    if (o && o.title === 'Online' && o.tab === 'friends' && Array.isArray(o.rows) && !o.nbDone) {
      o.nbDone = true;
      var row = this.hoodRow();
      if (row) o.rows = o.rows.slice(0, 1).concat([row], o.rows.slice(1));
      else if (O.on && !O.nbOff && !O.nb && Date.now() - tried > RETRY) O.nbLoad();
    }
    return listPanel.call(this, o);
  };

  // ---------- the Barangay panel ----------
  // tab: 'cup' | 'league' | 'members' | 'news'; then(): once it is up (a toast)
  U.openHood = function (tab, page, then) {
    var self = this, ticket = this.swapping;
    if (O.nbOff) return null;
    O.nbLoad().then(function (nb) {
      if (self.swapGone(ticket)) return;
      if (!nb) { self.swapping = null; return self.toast(net); }
      if (!nb.hood) return self.openFindHood(then);
      var done = function (rows, sub, empty) {
        if (self.swapGone(ticket)) return;
        self.listPanel({
          title: nb.hood.name, tab: tab, tabs: TABS, page: Math.min(page || 0, Math.max(0, Math.ceil(rows.length / (rows.length > 5 ? 4 : 5)) - 1)), rows: rows, empty: empty,
          sub: function () { return sub; },
          reopen: function (t, p) { self.openHood(t, p); },
          corner: { label: 'Back', color: GREY, cb: function () { self.swapTo(function () { self.openOnline('friends', 0); }); } },
        });
        if (then) then();
      };
      var fail = function (e) { self.swapping = null; self.toast(off(e) ? 'Coming soon!' : net); };
      if (tab === 'league') return done(self.leagueRows(nb), 'Groups of 10 barangays your size. Prizes every Monday!');
      if (tab === 'members') {
        return F.Net.rpc('farm_nb_members_v1', {}).then(function (list) { done(self.memberRows(nb, list), nb.hood.members + ' of ' + nb.hood.max + ' farms. ' + nb.hood.online + ' online now.'); }).catch(fail);
      }
      if (tab === 'news') {
        return F.Net.rpc('farm_nb_posts_v1', {}).then(function (list) { done(self.newsRows(nb, list), 'News from your barangay.', null); }).catch(fail);
      }
      done(self.cupRows(nb), 'Ends in ' + L.formatLeft(nb.endsIn / 60) + '. ' + nb.doneWeek + ' of ' + nb.maxWeek + ' tasks this week, ' + nb.doneToday + ' of ' + nb.maxDay + ' today.');
    });
  };

  // The Cup tab: your task now, then the week's tasks.
  U.cupRows = function (nb) {
    var self = this, s = F.session.state, p = L.nbProgress(s), rows = [];
    var full = nb.doneWeek >= nb.maxWeek ? 'week' : nb.doneToday >= nb.maxDay ? 'day' : '';
    if (!nb.canWin) {
      rows.push({ icon: C.ICON.ribbon, name: 'Sign in to play the Cup', desc: 'Guests can be in a barangay, but Cup tasks need a Selebox account.' });
    } else if (p) {
      var t = nb.pick || { points: 0 };
      rows.push({
        icon: L.nbTaskIcon(p.kind), name: 'Your task: ' + L.nbTaskText(p.kind, p.goal), progress: [p.n, p.goal], tag: 'NOW',
        desc: p.done ? 'Done! Turn it in for +' + t.points + ' points.' : '+' + t.points + ' points for your barangay.',
        buttons: [p.done ? { label: 'Turn in', color: GOLD, cb: function () { self.turnIn(); } } : { label: 'Drop', color: GREY, cb: function () { self.dropTask(); } }],
      });
    } else {
      rows.push({
        icon: C.ICON.ribbon, name: full ? 'All done for ' + (full === 'week' ? 'this week' : 'today') + '!' : 'Pick a task',
        desc: full === 'week' ? 'Thank you! A new Cup starts on Monday.' : full === 'day' ? 'Come back tomorrow for more.' : 'One at a time. Do it in your game: it counts from when you pick it.',
      });
    }
    nb.tasks.slice().sort(function (a, b) { return a.done - b.done; }).forEach(function (t) {
      var mine = p && p.kind === t.kind;
      if (mine) return;
      rows.push({
        icon: L.nbTaskIcon(t.kind), name: L.nbTaskText(t.kind, t.goal), done: t.done,
        desc: t.done ? 'You did this one this week.' : '+' + t.points + ' points.' + (t.minutes ? ' Takes at least ' + L.formatLeft(t.minutes) + '.' : ''),
        buttons: t.done || !nb.canWin ? [] : [{ label: 'Pick', color: p || full ? GREY : GREEN, cb: function () { self.pickTask(t); } }],
      });
    });
    return rows;
  };

  U.leagueRows = function (nb) {
    var cup = nb.cup, rows = [], lg = cup ? NB.leagues[cup.league] : null;
    if (!cup) {
      rows.push({ icon: C.ICON.ribbon, name: 'Not in the Cup yet', desc: 'Finish a task: your barangay joins a group of 10 barangays its size.' });
    } else {
      rows.push({ icon: C.ICON.calendar, name: lg[0], desc: 'Barangays of ' + lg[1] + '. You are #' + cup.place + ' of ' + cup.group.length + '.' });
      cup.group.forEach(function (g, i) {
        var prize = L.nbPrize(nb, i + 1, g.score);
        rows.push({
          icon: L.nbBadgeIcon(g.badge), name: '#' + (i + 1) + ' ' + g.name + (g.me ? ' (you)' : ''), desc: fmt(g.score) + ' points.',
          reward: prize, rewardPrefix: 'Prize',
        });
      });
    }
    rows.push({
      icon: C.ICON.gift, name: 'Prizes', reward: { gold: nb.prizes[0][0], stars: nb.prizes[0][1] }, rewardPrefix: '1st',
      desc: '1st to 3rd need ' + fmt(nb.minPlace) + ' points. Everyone who did a task gets ' + fmt(nb.baseGold) + 'G or more.',
    });
    return rows;
  };

  U.memberRows = function (nb, list) {
    var self = this, h = nb.hood, rows = [];
    if (h.leader && h.code) {
      rows.push({
        icon: C.ICON.tag, name: h.open ? 'Open to all' : 'Code: ' + h.code,
        desc: h.open ? 'Anyone can join. Or give friends the code ' + h.code + '.' : 'Closed: only farms with the code can join.',
        buttons: [{ label: 'New code', color: GREY, cb: function () { self.newHoodCode(); } }, { label: h.open ? 'Close' : 'Open', color: GREY, cb: function () { self.setHoodOpen(!h.open); } }],
      });
    } else {
      rows.push({
        icon: C.ICON.tag, name: h.open ? 'Open to all' : 'Closed',
        desc: h.open ? 'Any farm can join.' : 'Only farms with the code can join. The leader has it.',
      });
    }
    (Array.isArray(list) ? list : []).forEach(function (m) {
      if (!m || !m.id || O.blocked[String(m.id)]) return;
      var id = String(m.id), n = name(m.farm_name), tasks = Math.max(0, Math.floor(Number(m.tasks)) || 0), pts = Math.max(0, Math.floor(Number(m.points)) || 0);
      var back = function (then) { self.openHood('members', 0, then); };
      rows.push({
        id: id, icon: C.ICON.heart, name: n + (m.leader ? ' (leader)' : '') + (m.me ? ' (you)' : ''), online: !!m.online && !m.me,
        desc: tasks ? tasks + (tasks > 1 ? ' tasks, ' : ' task, ') + fmt(pts) + ' points this week.' : 'No Cup tasks yet this week.',
        buttons: m.me ? [] : [{ label: 'Visit', cb: function () { O.visit(id); } },
          h.leader ? { label: 'Remove', color: RED, cb: function () { self.kickMember(id, n); } } : { label: 'More', color: GREY, cb: function () { self.closeModal(); self.playerMenu(id, n, back); } }],
      });
    });
    rows.push({ icon: C.ICON.exclaim, name: 'Leave', desc: 'The tasks you finished still count for it this week.', buttons: [{ label: 'Leave', color: RED, cb: function () { self.leaveHood(); } }] });
    return rows;
  };

  U.newsRows = function (nb, list) {
    var self = this, rows = [{
      icon: C.ICON.bubble, name: 'Write', desc: 'A short line for your barangay. Keep it kind!',
      buttons: [{ label: 'Write', color: BLUE, cb: function () { self.writeHood(); } }],
    }];
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (!p || (p.who && O.blocked[String(p.who)])) return;
      var t = L.nbPostText(p), id = p.who ? String(p.who) : '';
      if (!t.text) return;
      rows.push({
        icon: t.say ? C.ICON.bubble : p.kind === 'task' ? C.ICON.ribbon : C.ICON.heart, name: t.name, desc: (t.say ? '"' + t.text + '"' : t.text) + ' (' + L.nbAgo(p.ago) + ')',
        buttons: t.say && id && !p.mine ? [{ label: 'More', color: GREY, cb: function () { self.closeModal(); self.playerMenu(id, t.name, function (then) { self.openHood('news', 0, then); }); } }] : [],
      });
    });
    return rows;
  };

  // ---------- doing things ----------
  var again = function (self, tab, text, color) {
    self.swapTo(function () { self.openHood(tab, 0, text ? function () { self.toast(text, 2600, color); } : null); });
  };
  U.pickTask = function (t) {
    var self = this, s = F.session.state, nb = O.nb;
    if (this.nbBusy || !nb) return;
    if (L.nbProgress(s)) { sfx('nope'); return this.toast('One task at a time. Finish or drop yours first.'); }
    this.nbBusy = true;
    F.Net.rpc('farm_cup_pick_v1', { p_kind: t.kind }).then(function (r) {
      self.nbBusy = false;
      if (r && r.ok && r.kind === t.kind) {
        L.nbStart(s, nb.week, t.kind, Math.floor(Number(r.goal)) || t.goal);
        save();
        sfx('pick');
        return again(self, 'cup', 'Your task: ' + L.nbTaskText(t.kind, s.nb.g) + '. Go for it!', INK_GREEN);
      }
      sfx('nope');
      var code = r && r.code;
      self.toast({ busy: 'You have a task already.', done: 'You did that one this week.', week: 'That is ' + nb.maxWeek + ' tasks this week. Thank you!',
        day: 'That is ' + nb.maxDay + ' tasks today. More tomorrow!', out: 'You are not in a barangay now.',
        guest: 'Cup tasks need a Selebox account. Sign in to play!' }[code] || 'That task is not there any more.', 2600);
      if (code === 'busy' || code === 'out') O.nbLoad();
    }).catch(function (e) { self.nbBusy = false; self.toast(off(e) ? 'Coming soon!' : net); });
  };
  U.dropTask = function () {
    var self = this, s = F.session.state;
    this.confirm('DROP THIS TASK?\nWhat you did for it so far will not count. You can pick it again later.', function () {
      F.Net.rpc('farm_cup_drop_v1', {}).then(function () {
        s.nb = null;
        save();
        again(self, 'cup', 'Task dropped. Pick another!');
      }).catch(function () { self.toast(net); });
    });
  };
  U.turnIn = function () {
    var self = this;
    O.cupDone(true).then(function (text) {
      if (!text) return;
      again(self, 'cup', text, /done!/.test(text) ? INK_GREEN : undefined);
    });
  };
  U.setHoodOpen = function (open) {
    var self = this;
    F.Net.rpc('farm_nb_set_v1', { p_open: open }).then(function (r) {
      again(self, 'members', r === 'ok' ? (open ? 'Open: anyone can join now.' : 'Closed: only farms with the code can join.') : 'Only the leader can change that.');
    }).catch(function () { self.toast(net); });
  };
  U.newHoodCode = function () {
    var self = this;
    this.confirm('MAKE A NEW CODE?\nThe old code stops working. Farms already in stay in.', function () {
      F.Net.rpc('farm_nb_code_v1', {}).then(function (r) {
        var code = r && r.ok && /^[A-Z0-9]{6}$/.test(String(r.join_code || '')) ? String(r.join_code) : '';
        again(self, 'members', code ? 'The new code is ' + code + '.' : 'Only the leader can change that.');
      }).catch(function (e) { self.toast(off(e) ? 'Coming soon!' : net); });
    });
  };
  U.kickMember = function (id, who) {
    var self = this;
    this.confirm('REMOVE ' + who.toUpperCase() + '?\nThey leave your barangay and cannot come back for 7 days. What they did this week still counts.', function () {
      F.Net.rpc('farm_nb_kick_v1', { p_user: id }).then(function (r) {
        again(self, 'members', r === 'ok' ? who + ' is out of your barangay.' : 'That did not work.');
      }).catch(function () { self.toast(net); });
    });
  };
  U.leaveHood = function () {
    var self = this, s = F.session.state, h = O.nb && O.nb.hood;
    this.confirm('LEAVE ' + (h ? h.name.toUpperCase() : 'YOUR BARANGAY') + '?\nYour task now is dropped. The tasks you finished still count for it this week.' + (h && h.members === 1 ? '\nYou are the last one: the barangay closes.' : ''), function () {
      F.Net.rpc('farm_nb_leave_v1', {}).then(function () {
        s.nb = null;
        save();
        return O.nbLoad();
      }).then(function () {
        self.closeAll();
        self.openOnline('friends', 0, function () { self.toast('You left the barangay.', 2400); });
      }).catch(function () { self.toast(net); });
    });
  };
  U.writeHood = function () {
    var self = this;
    this.askText('News for your barangay', '', NB.postMax, function (body) {
      body = L.cleanText(body, NB.postMax);
      if (!body) return;
      F.Net.rpc('farm_nb_post_v1', { p_body: body }).then(function (r) {
        if (r === 'ok') return again(self, 'news');
        self.toast({ word: 'Please keep it kind: that has a word that is not allowed.', limit: 'That is a lot of news today. More tomorrow!', out: 'You are not in a barangay now.' }[r] || 'That could not be sent.', 2600);
      }).catch(function () { self.toast(net); });
    }, { ok: 'Post', hint: 'Every member sees it.' });
  };

  // ---------- finding, making and joining ----------
  U.openFindHood = function (then, q) {
    var self = this, ticket = this.swapping;
    if (O.nbOff) return null;
    F.Net.rpc('farm_nb_find_v1', { p_q: q || null }).then(function (list) {
      if (self.swapGone(ticket)) return;
      var rows = [
        { icon: C.ICON.sparkle, name: 'Make your own', desc: 'Pick a name and a badge. You lead it.', buttons: [{ label: 'Make', color: GREEN, cb: function () { self.makeHood(); } }] },
        { icon: C.ICON.tag, name: 'Have a code?', desc: 'Join a closed barangay with the code its leader gave you.', buttons: [{ label: 'Code', color: BLUE, cb: function () { self.joinByCode(); } }] },
      ];
      (Array.isArray(list) ? list : []).forEach(function (h) {
        if (!h || h.id == null) return;
        var id = String(h.id), n = L.cleanText(h.name, NB.nameMax) || 'Barangay', members = Math.max(1, Math.floor(Number(h.members)) || 1), fr = Math.max(0, Math.floor(Number(h.friends)) || 0);
        var score = Math.max(0, Math.floor(Number(h.score)) || 0);
        rows.push({
          icon: L.nbBadgeIcon(h.badge), name: n,
          desc: members + ' of ' + NB.max + ' farms' + (fr ? ', ' + fr + (fr > 1 ? ' friends' : ' friend') : '') + '.' + (score ? ' ' + fmt(score) + ' Cup points.' : '') + (h.open === false ? ' Needs its code.' : ''),
          buttons: [h.open === false ? { label: 'Code', color: BLUE, cb: function () { self.joinByCode(); } } : { label: 'Join', color: GREEN, cb: function () { self.joinHood(id, null); } }],
        });
      });
      self.listPanel({
        title: q ? 'Barangays: "' + q + '"' : 'Barangays', rows: rows, page: 0,
        reopen: function () { self.openFindHood(null, q); },
        sub: function () { return 'Team up for the weekly Bayanihan Cup.'; },
        corner: { label: 'Search', color: BLUE, cb: function () {
          self.askText('Find a barangay', q || '', NB.nameMax, function (t) {
            t = L.cleanText(t, NB.nameMax);
            self.swapTo(function () { self.openFindHood(null, t.length >= 2 ? t : null); });
          }, { ok: 'Find', hint: 'A part of its name.' });
        } },
      });
      if (then) then();
    }).catch(function (e) { self.swapping = null; self.toast(off(e) ? 'Coming soon!' : net); });
  };

  U.makeHood = function () {
    var self = this;
    this.askText('Name your barangay', '', NB.nameMax, function (n) {
      n = L.cleanText(n, NB.nameMax);
      if (n.length < NB.nameMin) return self.toast('A name of ' + NB.nameMin + ' to ' + NB.nameMax + ' letters, please.', 2400);
      self.closeAll();
      self.pickBadge(n);
    }, { hint: NB.nameMin + ' to ' + NB.nameMax + ' letters. Every farm sees it.', ok: 'Next' });
  };
  U.pickBadge = function (n, page) {
    var self = this;
    this.listPanel({
      title: 'A badge for ' + n, page: page || 0, sub: function () { return 'It shows by your barangay\'s name.'; },
      reopen: function (t, p) { self.pickBadge(n, p); },
      rows: NB.badges.map(function (b) {
        return { icon: C.ICON[b], name: NB.badgeNames[b] || b, desc: '', buttons: [{ label: 'Choose', color: GREEN, cb: function () { self.closeModal(); self.askOpen(n, b); } }] };
      }),
    });
  };
  U.askOpen = function (n, badge) {
    var self = this;
    this.dialog('WHO CAN JOIN?\nOpen: any farm can join ' + n + '.\nWith a code: only farms you give the code to.', [
      { label: 'With a code', color: GREY, cb: function () { self.createHood(n, badge, false); } },
      { label: 'Open', cb: function () { self.createHood(n, badge, true); } },
    ]);
  };
  U.createHood = function (n, badge, open) {
    var self = this;
    if (this.nbBusy) return;
    this.nbBusy = true;
    F.Net.rpc('farm_nb_create_v1', { p_name: n, p_badge: badge, p_open: open }).then(function (r) {
      self.nbBusy = false;
      if (r && r.ok) {
        sfx('found');
        return O.nbLoad().then(function () {
          self.closeAll();
          self.openHood('cup', 0, function () { self.toast(n + ' is yours! ' + (open ? 'Anyone can join.' : 'Give friends the code ' + (O.nb && O.nb.hood ? O.nb.hood.code : '') + '.'), 3200, INK_GREEN); });
        });
      }
      sfx('nope');
      self.toast({ word: 'That name is not allowed. Please pick a kinder one.', taken: 'That name is taken. Try another!', in: 'Leave your barangay first.', limit: 'That is 3 barangays today. Try again tomorrow.',
        snap: 'Your farm is still going online. Try again in a moment.' }[r && r.code] || 'That name will not do. ' + NB.nameMin + ' to ' + NB.nameMax + ' letters, please.', 2800);
    }).catch(function (e) { self.nbBusy = false; self.toast(off(e) ? 'Coming soon!' : net); });
  };
  U.joinByCode = function () {
    var self = this;
    this.askText('The barangay\'s code', '', 6, function (code) {
      code = code.replace(/\s+/g, '').toUpperCase();
      if (code) self.joinHood(null, code);
    }, { hint: '6 letters and numbers, from the barangay\'s leader.', ok: 'Join' });
  };
  U.joinHood = function (id, code) {
    var self = this;
    if (this.nbBusy) return;
    this.nbBusy = true;
    F.Net.rpc('farm_nb_join_v1', { p_id: id ? Number(id) : null, p_code: code || null }).then(function (r) {
      self.nbBusy = false;
      if (r && r.ok) {
        sfx('found');
        var n = L.cleanText(r.name, NB.nameMax) || 'the barangay';
        return O.nbLoad().then(function () {
          self.closeAll();
          self.openHood('cup', 0, function () { self.toast('Welcome to ' + n + '! Pick a Cup task.', 2800, INK_GREEN); });
        });
      }
      sfx('nope');
      if (r && r.code === 'code') return self.joinByCode();
      self.toast({ full: 'That barangay is full: ' + NB.max + ' farms.', gone: code ? 'No barangay has that code.' : 'That barangay is not there any more.', in: 'Leave your barangay first.',
        banned: 'You were taken out of that barangay. You can join it again in a few days.', slow: 'That is a lot of tries. Wait a minute, then try again.',
        snap: 'Your farm is still going online. Try again in a moment.' }[r && r.code] || 'That did not work.', 2600);
    }).catch(function (e) { self.nbBusy = false; self.toast(off(e) ? 'Coming soon!' : net); });
  };

  void noop;
})(window.Farm = window.Farm || {});
