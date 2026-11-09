// Farm Raids step 2: real raids between players, the phone's side (owner, 9 Nov 2026: "Finish the step 2";
// docs/raids-step2.md; the server: supabase/farm_online_25.sql and server/lib/fraid.js).
//   - Your farm's raid copy: after a save on your own farm (at most once a minute, online), the same picture of it a
//     practice "Test my farm" uses, with what is out in the open: ripe crops, eggs and milk waiting, the stall's goods
//     and its coins (farm_fraid_copy_put_v1). A farm with nothing out is never listed.
//   - Raid a player (the Raid Camp's Practice tab): a farm near your power, its loot; Raid, or Next (a little Gold).
//   - The battle is the practice battle on that farm's frozen copy, with only its share of the loot (L.frRealFarm).
//   - At the end the drops go to our game server ('fr'), which replays them and records its own result ('frr'); the
//     prize (Gold, Raid Points) is taken once (farm_fraid_claim_v1). No answer: it comes next time (the inbox).
//   - Raided: the next time you open your farm, a card says who, the stars and what was taken (it is gone from your
//     farm), with Replay (the same battle, drawn) and Revenge (free, once); your farm is safe for 8 hours.
//   - Raid Points this week: the board.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;
  var U = F.UIScene.prototype;
  var P = F.WorldScene.prototype;
  var O = F.Online;
  var sfx = function (n) { if (F.Audio) F.Audio.sfx(n); };
  var noop = function () {};
  var FR = F.FR = { copyAt: 0, copyEvery: 60000, inboxAt: 0, inboxEvery: 120000, serverWait: 15000 };
  var online = function () { return !!(F.Net.available() && O.on && O.me); };
  var requestId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  };
  var own = function (w) { return w && w.mapKey === 'farm' && !F.session.visit && !F.session.raid && w.state === F.session.state; };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); };

  // ---------- the first-time tour (owner, 4 Oct 2026); its tip appended after Farm Raids' own ----------
  C.TIPS.push({ key: 'fraid_real_tour', text: 'RAID A PLAYER' });
  var ri = function (k) { return C.ICON['ri_' + k] != null ? C.ICON['ri_' + k] : C.ICON.star; };
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  F.TOURS.fraid = {
    title: 'RAID A PLAYER',
    steps: [
      {
        text: 'Raid a real farm near your power. You see its loot first; Next finds another for a little Gold.',
        draw: function (ui, sc, move) {
          var a = icon(ui, sc, 70, 70, ri('flag'), 0.38), b = icon(ui, sc, 190, 70, ri('points'), 0.34);
          if (move) ui.tweens.add({ targets: [a, b], y: 60, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'You take only part of its loot: more from a stronger farm. ' + R.daily + ' raids a day; raiding breaks your own shield.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 80, 70, ri('goat'), 0.32);
          var s = icon(ui, sc, 180, 70, ri('shield'), 0.36);
          if (move) ui.tweens.add({ targets: s, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Raided? You see who and what they took, watch a Replay, and get a free Revenge. Your farm is then safe for 8 hours.',
        draw: function (ui, sc, move) {
          var d = icon(ui, sc, 90, 70, C.ICON.dog, 0.34);
          icon(ui, sc, 180, 70, ri('shield'), 0.36);
          if (move) ui.tweens.add({ targets: d, angle: { from: -8, to: 8 }, duration: 300, yoyo: true, repeat: -1 });
        },
      },
    ],
  };

  // ---------- your farm's raid copy ----------
  P.raidCopy = function () {
    var s = this.state, farm = this.raidFarm({ gold: L.frGoldPot(s), stall: L.frStallLoot(s), produce: L.frProduceLoot(s), levels: L.frState(s).dlv, camp: L.frState(s).camp, name: O.myName() });
    farm.loot = farm.loot.slice(0, 300);
    farm.value = L.frCopyValue(farm);
    return farm;
  };
  FR.sendCopy = function (w, force) {
    if (!own(w) || !online() || !w.map) return null;
    var now = Date.now();
    if (!force && now - FR.copyAt < FR.copyEvery) return null;
    FR.copyAt = now;
    var s = w.state, copy;
    try { copy = w.raidCopy(); } catch (e) { return null; }
    var left = L.shieldLeft(s, now);
    return F.Net.rpc('farm_fraid_copy_put_v1', { p_copy: copy, p_power: L.farmPower(s), p_loot: copy.value, p_shield_until: left > 0 ? new Date(now + left).toISOString() : null }).catch(noop);
  };
  var save = P.save;
  P.save = function () {
    save.call(this);
    FR.sendCopy(this, false);
  };

  // ---------- the game server's check ----------
  // Promise<{ ok, stars, prize, points } | { ok: false, code }>
  FR.check = function (raid, moves) {
    var url = window.gameHost && window.gameHost.gs;
    if (!url || typeof WebSocket === 'undefined') return Promise.resolve({ ok: false, code: 'off' });
    return F.Net.token().then(function (token) {
      if (!token) return { ok: false, code: 'token' };
      return new Promise(function (resolve) {
        var ws, done = false, finish = function (r) { if (done) return; done = true; clearTimeout(t); try { ws.close(); } catch (e) { /* closed */ } resolve(r); };
        var t = setTimeout(function () { finish({ ok: false, code: 'slow' }); }, FR.serverWait);
        try { ws = new WebSocket(url); } catch (e) { return finish({ ok: false, code: 'socket' }); }
        ws.onopen = function () { ws.send(JSON.stringify({ t: 'fr', v: 1, token: token, raid: raid, moves: moves })); };
        ws.onmessage = function (e) { var m = null; try { m = JSON.parse(e.data); } catch (x) { return; } if (m && m.t === 'frr' && m.raid === raid) finish(m); };
        ws.onerror = ws.onclose = function () { finish({ ok: false, code: 'closed' }); };
      });
    }, function () { return { ok: false, code: 'token' }; });
  };

  // ---------- into a real raid, or a replay ----------
  // opts: { kind: 'real', target } | { kind: 'real', revenge: raid id } | { kind: 'replay', raid (an inbox 'lost' row) }
  var start = F.raidFarmStart;
  F.raidFarmStart = function (opts) {
    if (opts.kind === 'replay') return replay(opts.raid);
    if (opts.kind !== 'real') return start(opts);
    var mine = F.session.state, army = L.frArmy(mine), cost = R.real.energy;
    if (!L.frState(mine).camp && !L.hasRaidCamp(mine)) { sfx('nope'); return F.ui.toast(opts.revenge ? 'Buy a Raid Camp at Mira\'s (Workshops) to raid them back. Your Revenge waits 7 days.' : 'Buy a Raid Camp at Mira\'s (Workshops) first.', 3200); }
    if (!Object.keys(army).length) { sfx('nope'); return F.ui.toast('Train some raiders first (Party).', 2400); }
    if (!opts.revenge && mine.energy < cost && !(L.powered && L.powered(mine))) { sfx('nope'); return F.ui.toast('A raid takes ' + cost + ' energy.', 2400); } // (Revenge is free)
    if (FR.starting) return null;
    FR.starting = true;
    F.ui.toast('Marching out...', 1500);
    return F.Net.rpc('farm_fraid_start_v1', { p_target: opts.target || null, p_army: army, p_request_id: requestId(), p_revenge: opts.revenge || null }).then(function (r) {
      FR.starting = false;
      if (!r || !r.ok) { sfx('nope'); return F.ui.toast(startWhy(r && r.code), 2600); }
      if (!r.look) { sfx('nope'); return F.ui.toast('That farm can\'t be raided right now.', 2400); }
      if (!opts.revenge) L.spendEnergy(mine, cost);
      L.shieldBreak(mine); // (owner: raiding another player breaks your own shield)
      F.Host.save(mine);
      var st = L.visitState(r.look, mine);
      st.isVisit = true;
      F.session.raid = { kind: 'real', raid: r.raid, copy: r.copy, cap: Number(r.cap) || 0, seed: r.seed, army: army, revenge: !!opts.revenge, cut: Date.parse(r.expires_at) || L.clock() };
      F.session.visit = { host: 'raid', name: L.cleanText(r.name, 24) || 'A farm', state: st, raid: true, liked: false, gift: null, friend: false, likes: 0, beauty: 0 };
      F.session.riding = false;
      F.ui.closeAll();
      O.restartWorld();
      return true;
    }, function () { FR.starting = false; sfx('nope'); F.ui.toast('No connection. Try again in a moment.', 2400); });
  };
  var startWhy = function (code) {
    return ({ daily: 'That\'s ' + R.daily + ' raids today. More tomorrow!', 'in-raid': 'Finish your raid first.', shield: 'That farm is shielded now.',
      busy: 'Someone is raiding that farm right now.', 'new': 'That farm is too new to raid.', empty: 'That farm has nothing out to take.',
      'no-revenge': 'That revenge was already used.', off: 'Raids are closed for now.', 'account-unavailable': 'Raids aren\'t open for your account.' })[code] || 'That farm can\'t be raided right now.';
  };
  var replay = function (row) {
    var mine = F.session.state, st = L.visitState(L.snapshot(mine), mine);
    st.isVisit = true;
    F.session.raid = { kind: 'replay', copy: row.copy, cap: Number(row.cap) || 0, seed: row.seed, army: row.army, moves: row.moves || [], mi: 0, cut: row.taken && row.taken.cut };
    F.session.visit = { host: 'raid', name: 'Replay: ' + (L.cleanText(row.name, 20) || 'a raid'), state: st, raid: true, liked: false, gift: null, friend: false, likes: 0, beauty: 0 };
    F.session.riding = false;
    F.ui.closeAll();
    O.restartWorld();
  };
  // a replay: the recorded drops come down on their ticks (before the step, as L.frReplay)
  P.raidReplayDrops = function () {
    var rd = F.session.raid, b = this.raidB;
    if (!rd || rd.kind !== 'replay' || !b) return;
    while (rd.mi < rd.moves.length && rd.moves[rd.mi][0] <= b.t) { var m = rd.moves[rd.mi++]; if (m[0] === b.t) L.frDrop(b, m[1], m[2], m[3]); }
  };
  var setup = P.raidSetup;
  P.raidSetup = function () {
    setup.call(this);
    var rd = F.session.raid;
    if (rd && rd.kind === 'replay') { this.raidStarted = true; if (F.ui.raidSay) F.ui.raidSay('A replay of the raid on your farm.'); }
  };

  // ---------- the end of a real raid ----------
  var finish = P.raidFinish;
  P.raidFinish = function () {
    var rd = F.session.raid;
    if (!rd || (rd.kind !== 'real' && rd.kind !== 'replay')) return finish.call(this);
    if (this.raidDone) return;
    this.raidDone = true;
    var s = F.session.state, b = this.raidB, ui = F.ui, stars = L.frStars(b);
    if (rd.kind === 'replay') {
      sfx('nope');
      return ui.raidResult(b, { stars: stars, gold: 0, pts: 0, title: 'The raid on your farm', line: 'They took ' + Math.round(L.frShare(b) * 100) + '% of what they could reach' });
    }
    var used = {};
    b.moves.forEach(function (m) { used[m[1]] = (used[m[1]] || 0) + 1; });
    L.frUse(s, used);
    F.Host.save(s);
    if (ui.raidSay) ui.raidSay('Checking your raid...');
    FR.check(rd.raid, b.moves).then(function (r) {
      if (!ui.frBox) return;
      if (r && r.ok) {
        L.frWin(s, r.prize, r.points);
        F.Host.save(s);
        F.Net.rpc('farm_fraid_claim_v1', { p_raid: rd.raid }).catch(noop);
        sfx(r.stars ? 'fanfare' : 'nope');
        return ui.raidResult(b, { stars: r.stars, gold: r.prize || 0, pts: r.points || 0 });
      }
      sfx('nope');
      ui.raidResult(b, { stars: stars, gold: 0, pts: 0, title: 'Raid over', line: r && r.code === 'slow' || r && r.code === 'closed' ? 'Checking it: the prize comes next time' : 'This raid could not be counted' });
    });
  };

  // ---------- what waits when you open your farm ----------
  FR.inbox = function (w) {
    if (!own(w) || !online()) return null;
    var now = Date.now();
    if (now - FR.inboxAt < FR.inboxEvery) return null;
    FR.inboxAt = now;
    return F.Net.rpc('farm_fraid_inbox_v1', {}).then(function (r) {
      if (!r || !F.world || !own(F.world)) return;
      var s = F.session.state, gold = 0;
      (r.won || []).forEach(function (x) { // a raid of yours the server counted but this phone never heard back about
        F.Net.rpc('farm_fraid_claim_v1', { p_raid: x.raid }).then(function (ok) {
          if (ok !== 'ok') return;
          L.frWin(s, x.prize, x.points);
          gold += x.prize || 0;
          F.Host.save(s);
          F.ui.toast('Your raid on ' + (L.cleanText(x.name, 20) || 'a farm') + ' counted: +' + (x.prize || 0).toLocaleString('en-US') + ' Gold', 2800, 0x2f5a22);
        }).catch(noop);
      });
      // last week's Raid Points prize (the top 3), once a session
      if (!FR.weekAsked) {
        FR.weekAsked = true;
        F.Net.rpc('farm_fraid_week_prize_v1', {}).then(function (p) {
          if (!p || !p.ok) return;
          s.gold += Math.max(0, p.gold | 0);
          F.Host.save(s);
          F.bus.emit('hud');
          sfx('fanfare');
          F.ui.toast('Raid Points: #' + p.rank + ' last week! +' + (p.gold | 0).toLocaleString('en-US') + ' Gold', 3200, 0x2f5a22);
        }).catch(noop);
      }
      var lost = (r.lost || []).slice(-5);
      lost.forEach(function (x) { lose(x); });
      if (lost.length) F.Host.save(s);
      if (lost.length) showLost(lost, 0);
      void gold;
    }).catch(noop);
  };
  // it is gone from your farm (only what is still there), and seen once
  var lose = function (x) {
    var s = F.session.state, w = F.world;
    x.lost = L.frLoss(s, x.taken || {}, x.taken && x.taken.w);
    if (w && w.refreshTile && x.taken && x.taken.items) x.taken.items.forEach(function (it) { if (it[0] === 'crops') { try { w.refreshTile(it[2] * x.taken.w + it[1]); } catch (e) { /* off the map */ } } });
    F.bus.emit('hud');
    F.Net.rpc('farm_fraid_seen_v1', { p_raid: x.raid }).catch(noop);
  };
  var lostText = function (x) {
    var l = x.lost || {}, bits = [];
    if (l.crops) bits.push(plural(l.crops, 'crop'));
    if (l.produce) bits.push(l.produce + ' eggs and milk');
    if (l.stall) bits.push(plural(l.stall, 'stall good'));
    if (l.gold) bits.push(l.gold.toLocaleString('en-US') + ' Gold from the stall');
    return bits.length ? 'They took ' + bits.join(', ') + '.' : 'They took nothing that was still there.';
  };
  var showLost = function (list, i) {
    var x = list[i], ui = F.ui;
    if (!x) return;
    sfx('nope');
    var stars = Math.max(0, Math.min(3, x.stars || 0)), next = function () { showLost(list, i + 1); };
    var buttons = [{ label: 'Replay', color: 0x4a90c9, cb: function () { F.raidFarmStart({ kind: 'replay', raid: x }); } }];
    if (x.revenge) buttons.push({ label: 'Revenge', color: 0xc0503a, cb: function () { F.raidFarmStart({ kind: 'real', revenge: x.raid }); } });
    buttons.push({ label: 'OK', cb: next });
    ui.dialog('YOUR FARM WAS RAIDED!\n' + (L.cleanText(x.name, 20) || 'A farm') + ' raided you: ' + '★★★'.slice(0, stars) + '☆☆☆'.slice(stars) + '\n' + lostText(x) +
      '\nYour farm is safe for ' + R.real.shieldHours + ' hours.', buttons);
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this;
    if (own(this)) this.time.delayedCall(2500, function () { if (self.sys && self.sys.isActive()) { FR.inbox(self); FR.sendCopy(self, false); } });
  };

  // ---------- the Raid Camp: raid a player, the board ----------
  U.raidFind = function (skip) {
    var self = this, s = F.session.state;
    if (!online()) { sfx('nope'); return this.toast('Raiding players needs online play.', 2400); }
    if (!(window.gameHost && window.gameHost.quiet) && L.takeTip(s, 'fraid_real_tour')) {
      if (F.world) F.world.save();
      return this.tour('fraid', function () { self.raidFind(skip); });
    }
    if (F.world && own(F.world)) FR.sendCopy(F.world, true); // (your own power must be on the server first)
    this.toast('Looking for a farm...', 1200);
    var ask = function (tries) {
      return F.Net.rpc('farm_fraid_find_v1', { p_mode: 'random', p_skip: skip || [] }).then(function (r) {
        if (r && !r.ok && r.code === 'no-copy' && tries < 3) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return ask(tries + 1); });
        return r;
      });
    };
    ask(0).then(function (r) {
      if (!r || !r.ok) { sfx('nope'); return self.toast(r && r.code === 'off' ? 'Raids are closed for now.' : 'No farm to raid right now. Try again soon.', 2400); }
      var f = (r.farms || [])[0];
      if (!f) { sfx('nope'); return self.toast('No farm near your power to raid right now. Try again later.', 2600); }
      var next = Number(r.next_gold) || R.real.nextGold, take = Math.round(f.loot * f.cap);
      self.closeAll();
      self.dialog('RAID ' + (L.cleanText(f.name, 20) || 'A FARM').toUpperCase() + '?\nPower ' + f.power + ' (yours ' + L.farmPower(s) + ')\nOut in the open: about ' +
        take.toLocaleString('en-US') + ' Gold\'s worth for you to take.\nA raid takes ' + R.real.energy + ' energy.', [
        { label: 'Next ' + next + 'G', color: 0x4a90c9, cb: function () {
          if (s.gold < next) { sfx('nope'); return self.toast('Not enough Gold.', 2000); }
          s.gold -= next;
          F.Host.save(s);
          F.bus.emit('hud');
          self.raidFind((skip || []).concat([f.id]));
        } },
        { label: 'Raid', color: 0xc0503a, cb: function () { F.raidFarmStart({ kind: 'real', target: f.id }); } },
      ]);
    }, function () { sfx('nope'); self.toast('No connection. Try again in a moment.', 2400); });
  };
  // Raids on your farm (part 26, farm_fraid_recent_v1): the last 7 days, with Replay and a free Revenge still there after
  // the raided card is closed (9 Nov 2026: tapping OK or Replay on the card lost the Revenge for good)
  U.raidLog = function () {
    var self = this;
    if (!online()) { sfx('nope'); return this.toast('Needs online play.', 2400); }
    F.Net.rpc('farm_fraid_recent_v1', {}).then(function (list) {
      list = Array.isArray(list) ? list : [];
      var rows = list.map(function (x) {
        var stars = Math.max(0, Math.min(3, x.stars || 0)), t = x.taken || {}, bits = [];
        if (t.crops) bits.push(plural(t.crops, 'crop'));
        if (t.produce) bits.push(t.produce + ' eggs/milk');
        if (t.stall) bits.push(plural(t.stall, 'stall good'));
        if (t.gold) bits.push(t.gold + 'G');
        var btns = [{ label: 'Replay', color: 0x4a90c9, cb: function () { F.raidFarmStart({ kind: 'replay', raid: x }); } }];
        if (x.revenge) btns.push({ label: 'Revenge', color: 0xc0503a, cb: function () { F.raidFarmStart({ kind: 'real', revenge: x.raid }); } });
        return { icon: C.ICON.ri_bandit != null ? C.ICON.ri_bandit : C.ICON.star, name: (L.cleanText(x.name, 18) || 'A farm') + '  ' + '★★★'.slice(0, stars) + '☆☆☆'.slice(stars),
          desc: (x.revenge ? 'Revenge is free. ' : 'Revenge used. ') + (bits.length ? 'Took ' + bits.join(', ') + '.' : 'Took nothing.'), buttons: btns }; // (a slim row cuts the end: the important words first)
      });
      if (!rows.length) rows.push({ icon: C.ICON.ri_shield != null ? C.ICON.ri_shield : C.ICON.star, name: 'No raids on your farm', desc: 'Nobody has raided your farm in the last 7 days.' });
      self.closeAll();
      self.listPanel({ title: 'Raids on your farm', rows: rows, slim: true, sub: function () { return 'The last 7 days'; } });
    }, function () { sfx('nope'); self.toast('No connection. Try again in a moment.', 2400); });
  };
  U.raidBoard = function () {
    var self = this;
    if (!online()) { sfx('nope'); return this.toast('The board needs online play.', 2400); }
    F.Net.rpc('farm_fraid_board_v1', {}).then(function (r) {
      if (!r) return;
      var rows = (r.top || []).slice(0, 30).map(function (x, i) {
        var mine = O.me && x.id === O.me.id, prize = (r.prizes || [])[i];
        return { icon: i < 3 ? C.ICON.ri_points != null ? C.ICON.ri_points : C.ICON.star : C.ICON.star, name: (i + 1) + '. ' + (L.cleanText(x.name, 20) || 'A farm') + (mine ? ' (you)' : ''),
          desc: x.points.toLocaleString('en-US') + ' Raid Points' + (prize ? '. Prize: ' + Number(prize).toLocaleString('en-US') + ' Gold' : '') };
      });
      if (!rows.length) rows.push({ icon: C.ICON.star, name: 'No raids yet this week', desc: 'Be the first: raid a player from the Raid Camp.' });
      self.closeAll();
      self.listPanel({ title: 'Raid Points', rows: rows, slim: true, sub: function () { return 'This week: you have ' + (r.me || 0).toLocaleString('en-US') + ' Raid Points'; } });
    }, function () { sfx('nope'); self.toast('No connection. Try again in a moment.', 2400); });
  };
})(window.Farm = window.Farm || {});
