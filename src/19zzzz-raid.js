// Town Raid on screen (owner, 6 Nov 2026: "Town Raid, yes agree, it will replace the world boss"; data in
// 00-zzzzzzzzzzz-raid.js, rules in 01-logicZZZZ-raid.js, server in supabase/farm_online_21.sql):
//   - the raiders: on the farm (yours, or a friend's you are visiting), they come at the crops, stand on one a while
//     and, if nobody drives them off, it is lost (at most C.RAID.lossMost a raid, only on your own farm). Each is drawn
//     with a picture we already have (the wild animals' sheet when it is on the phone, else a farm animal, tinted; the
//     typhoon's debris are branch and stone icons): docs/town-raid.md lists the art that would make it nicer;
//   - fighting back: the action button says Hit / Shoo / Douse / Clear when a raider is in reach, and swings the tool you
//     hold (the Bow shoots from further off). No energy is used: energy can be bought, so it must not buy hits;
//   - the hits go to the server every 10 s in one small call (farm_raid_hit_v1, a request id so a retry never counts
//     twice); the town's bar comes back with the answer. No live room is shared: a friend visiting your farm fights
//     on their own phone, their hits count for them, and one small message tells you they helped;
//   - the bar at the top (a countdown 30 minutes before, then "3,214 farmers defending · 67%"), a centred card when it
//     starts, the results card after (the town won or not, your hits, your chest), the bonus day, and the tour;
//   - offline, or with no server yet: the raid still comes, alone, with a small goal of your own.
// (The tests keep raids off with gameHost.quiet unless they ask for them: gameHost.raids.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.RAID;
  var T = C.TILE;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var DEPTH = F.WorldScene.DEPTH;
  var K = F.UI_CONST, W = K.W, INK = K.INK;
  var WI = C.WILD;
  var GREY = 0xa08a68, RED = 0xb8402a;
  var FEET = 233 / 252, FACING = { down: 0, up: 3, side: 6 }, STEPS = [1, 0, 2, 0], EAT = 10, AWAY = 11;
  var ARROW_SPEED = 16 * T;
  var LIGHT = 31; // over the night's dark (30), like a lamp's glow (19zzz-a-players.js)
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var mine = function () { return F.session && F.session.state; };
  var host = function () { return window.gameHost || {}; };
  var quiet = function () { return !!host().quiet; };
  var raidsOn = function () { return !host().quiet || !!host().raids; };
  var online = function () { return !!(O && O.on && O.me && F.Net && F.Net.available()); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var clockText = function (ms) {
    var secs = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(secs / 60), sec = secs % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };
  var uuid = function () {
    var b = new Uint8Array(16), c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  // ---------- this phone's part (not saved: what is saved is in s.raid, 01-logicZZZZ-raid.js) ----------
  // town: the server's last word on the raid on now; server: true once it answered, false when it is not there (part 21
  // not applied yet, or no line): the raid is then fought alone; pending: hits not sent yet; req: the batch on its way
  // (sent again, the same, until it gets an answer); helpers: friends who helped on your farm { id: { name, n } }.
  var RS = F.raid = { id: '', town: null, server: null, pending: 0, req: null, sending: false, sendAt: 0, pollAt: 0, fails: 0, helpers: {},
    warned: '', shown: '', settling: false, settleAt: 0, settleTry: 0, lastAsk: 0, maxed: false };

  var takeTip = function (key) {
    var s = mine();
    if (!s || F.session.visit || L.tipSeen(s, key) || quiet()) return false;
    L.takeTip(s, key);
    F.Host.save(s);
    return true;
  };

  // ---------- talking to the server ----------
  // How often: ours (C.RAID), or slower when the server says so (farm.raid_rules: it can lighten the load without an update).
  var sendSecs = function () { return Math.max(R.sendEvery, (RS.town && RS.town.every) || 0); };
  var pollSecs = function () { return Math.max(R.pollEvery, (RS.town && RS.town.poll) || 0); };
  var missing = function (e) { return /could not find|does not exist|schema cache/i.test((e && e.message) || String(e || '')); };
  var noteFail = function (e) {
    RS.fails++;
    if (missing(e)) RS.server = false; // (part 21 not applied yet: alone, quietly)
  };
  // The bonus day, from the server's word on the last raid (everyone gets it when the town won, even those who missed it).
  var takeLast = function (t) {
    var s = mine(), last = t && t.last, r = last && last.won && L.raidById(last.id);
    if (!s || !r) return;
    var end = L.raidBonusEnd(r);
    if (end <= L.clock() || (L.raidRec(s).b || 0) >= end) return;
    L.raidSetBonus(s, end);
    F.Host.save(s);
    if (F.ui && RS.shown !== r.id) F.ui.toast('The town won ' + L.raidWhen(r).split(' ')[0] + '\'s raid! Double Drops for everyone until midnight tomorrow.', 4200, 0x7a4d12);
  };
  RS.poll = function () {
    if (!online() || RS.sending) return Promise.resolve(null);
    RS.pollAt = Date.now() + pollSecs() * 1000;
    return F.Net.rpc('farm_raid_state_v1', {}).then(function (a) {
      var t = L.raidRead(a);
      if (!t) return null;
      RS.server = true;
      RS.fails = 0;
      if (t.id) RS.town = t;
      takeLast(t);
      return t;
    }, function (e) { noteFail(e); if (RS.server === false) RS.pollAt = Date.now() + 300000; return null; });
  };
  // One batch: up to C.RAID.batchMost hits, with a request id (the same id again on a retry).
  RS.flush = function (r) {
    if (RS.sending || (!RS.pending && !RS.req) || !online() || RS.server === false || !r) return Promise.resolve(null);
    if (!RS.req || RS.req.raid !== r.id) RS.req = { id: uuid(), raid: r.id, n: Math.min(RS.pending, R.batchMost) };
    var req = RS.req, s = mine();
    RS.sending = true;
    RS.sendAt = Date.now() + sendSecs() * 1000;
    return F.Net.rpc('farm_raid_hit_v1', { p_raid: req.raid, p_hits: req.n, p_request_id: req.id }).then(function (a) {
      RS.sending = false;
      var t = L.raidRead(a);
      if (RS.req === req) RS.req = null;
      RS.pending = Math.max(0, RS.pending - req.n);
      if (!t) return null;
      RS.server = true;
      RS.fails = 0;
      if (!t.ok) { // over (too late), the cap, not a player: those hits will never count
        if (t.code === 'cap' || t.code === 'over') RS.pending = 0;
        return t;
      }
      var rec = L.raidRec(s);
      if (rec.id === req.raid) rec.sv = Math.max(rec.sv, t.mine);
      if (t.id) RS.town = t;
      if (t.mine >= t.cap) RS.pending = 0;
      // on a friend's farm: one small word that you helped (their phone shows it over your farmer)
      var v = F.session.visit;
      if (v && t.added && O.chan && O.others[v.host]) O.send('rdh', { n: t.added });
      F.Host.save(s);
      return t;
    }, function (e) {
      RS.sending = false;
      noteFail(e);
      RS.sendAt = Date.now() + Math.min(120000, sendSecs() * 1000 * Math.pow(2, Math.min(3, RS.fails))); // (the same batch, a little later)
      return null;
    });
  };
  // Hits counted on this phone: the bar shows them at once, the server hears them in the next batch.
  RS.hit = function (r) {
    var s = mine();
    if (!L.raidHit(s, r)) {
      if (!RS.maxed && F.ui) { RS.maxed = true; F.ui.toast('That is ' + R.cap + ' hits: the most one farmer can add this raid. Thank you, hero!', 3200, 0x2f5a22); }
      return 0;
    }
    if (online() && RS.server !== false) RS.pending++;
    return 1;
  };

  // ---------- the results ----------
  var chestRows = function (chest) {
    if (!chest) return [];
    var things = chest.items.map(function (it) { return it[1] + ' ' + C.ITEMS[it[0]].name; });
    if (chest.lumber) things.push(chest.lumber + ' Lumber');
    return [[C.ICON.chest, chest.name + ': +' + fmt(chest.gold) + 'G, ' + things.join(', ') + '.']];
  };
  var lostRow = function (rec) {
    return rec.l ? [C.ICON.storm, 'The raid took ' + rec.l + (rec.l === 1 ? ' crop' : ' crops') + ' from your field.'] : [C.ICON.heart, 'Not one crop lost. Well defended!'];
  };
  var helperRow = function () {
    var list = Object.keys(RS.helpers).map(function (id) { return RS.helpers[id]; });
    if (!list.length) return [];
    return [[C.ICON.heart, 'Friends who helped on your farm: ' + list.map(function (h) { return h.name + ' (' + h.n + ')'; }).join(', ') + '.']];
  };
  var showCard = function (title, rows) {
    var show = function () {
      if (!F.ui || F.ui.modals.length || (F.world && F.world.busy) || document.getElementById('farm-ask')) return setTimeout(show, 1500);
      F.ui.dialog(title, null, { rows: rows });
    };
    show();
  };
  // After a raid you were part of: the server's word (online) or your own goal (alone), the chest, once. snap: a copy
  // of your record for it (s.raid moves on to the next raid by itself).
  var kindIcon = function (kind) { return C.ICON[kind.icon] != null ? C.ICON[kind.icon] : C.ITEMS[kind.icon].icon; };
  RS.settle = function (snap) {
    var s = mine(), r = L.raidById(snap.id), kind = L.raidKind(r);
    if (!s || !r || RS.settling) return;
    var mark = function () {
      var cur = L.raidRec(s);
      if (cur.id === snap.id) cur.c = 1;
      F.Host.save(s);
    };
    var finish = function (rows, chest, won, town) {
      mark();
      if (chest) L.raidGive(s, chest);
      if (won && town) L.raidSetBonus(s, L.raidBonusEnd(r));
      F.Host.save(s);
      F.bus.emit('hud');
      if (F.world && F.world.changed) F.world.changed();
      if (chest) sfx('coin');
      RS.helpers = {};
      showCard('RAID RESULTS', rows);
    };
    var next = function () { var n = L.raidNext(r.end); return n ? 'Next raid: ' + L.raidWhen(n) + '.' : ''; };
    var alone = function () {
      if (!snap.h) return mark(); // (there, but no hit: nothing to say)
      var a = L.raidAloneResult(snap);
      var rows = [[kindIcon(kind), a.won ? 'You saved your farm from the ' + kind.many + '! ' + snap.h + ' hits.' : 'You landed ' + snap.h + ' of the ' + R.alone.goal + ' hits your farm needed.']]
        .concat(chestRows(a.chest)).concat([lostRow(snap)]).concat(helperRow());
      rows.push([C.ICON.star, online() ? next() : 'Join online play to defend with everyone, for bigger chests and the town\'s bonus day.']);
      finish(rows, a.chest, false, false);
    };
    var useServer = online() && RS.server !== false && (snap.sv > 0 || RS.pending > 0 || RS.shown === snap.id);
    if (!useServer) return alone();
    RS.settling = true;
    RS.flush(r).then(function () { return F.Net.rpc('farm_raid_claim_v1', { p_raid: snap.id }); }).then(function (x) {
      RS.settling = false;
      var c = L.raidClaimRead(x);
      if (!c) throw new Error('no answer');
      if (c.code === 'claimed' || c.code === 'bad' || c.code === 'old') return mark(); // (shown already, on this phone or another)
      if (c.code === 'early') { RS.settleTry = Date.now() + 20000; return; }
      if (!c.ok && snap.h) return alone(); // (none of your hits reached the town: your own goal instead)
      var pct = L.raidPct(c.total, c.goal), chest = c.ok && c.tier ? L.raidChest(c.hits, false, c.won) : null;
      if (chest && chest.tier > c.tier) chest = L.raidChest(R.chests[c.tier - 1].min, false, c.won); // (the server's word is the last)
      var rows = [[kindIcon(kind), c.won
        ? 'The town won! ' + fmt(c.defenders) + (c.defenders === 1 ? ' farmer' : ' farmers') + ' drove off the ' + kind.many + ' (' + pct + '%).'
        : 'The ' + kind.many + ' got away this time (' + pct + '% of the goal). ' + fmt(c.defenders) + (c.defenders === 1 ? ' farmer' : ' farmers') + ' defended.']];
      if (c.ok) rows.push([C.ICON.ribbon, 'Your hits: ' + c.hits + '.' + (chest ? '' : ' Land ' + R.chests[0].min + ' or more next time for a chest.')]);
      else rows.push([C.ICON.ribbon, 'You didn\'t land a hit this time.']);
      rows = rows.concat(chestRows(chest)).concat([lostRow(snap)]).concat(helperRow());
      rows.push(c.won ? [C.ICON.star, 'Bonus day: Double Drops for everyone until midnight tomorrow!'] : [C.ICON.calendar, next()]);
      finish(rows, chest, c.won, true);
    }).catch(function (e) {
      RS.settling = false;
      noteFail(e);
      if (RS.server === false) return alone(); // (no server for raids yet)
      RS.settleTry = Date.now() + 60000; // (no line: again in a minute, for up to a week)
      if (L.clock() > r.end + 7 * 864e5) mark();
    });
  };

  // ---------- once a second ----------
  RS.tick = function () {
    var s = mine(), ui = F.ui;
    if (!s || !ui || !ui.add || !raidsOn()) { if (ui && ui.raidBox) ui.raidBox.setVisible(false); return; }
    var now = L.clock(), ph = L.raidPhase(now), r = ph.r, rec = s.raid;
    // a raid you were in, over: its results (online: a few seconds after the end, spread so all phones don't ask at once)
    if (rec && rec.id && !rec.c && !RS.settling && Date.now() >= RS.settleTry) {
      var was = L.raidById(rec.id);
      if (was && now >= was.end) {
        if (!RS.settleAt) RS.settleAt = Date.now() + (rec.sv || RS.pending ? 2000 + Math.random() * 15000 : 600);
        if (Date.now() >= RS.settleAt && !ui.modals.length && !(F.world && F.world.busy)) {
          RS.settleAt = 0;
          RS.settle({ id: rec.id, h: rec.h, sv: rec.sv, l: rec.l, c: 0, b: rec.b });
        }
      }
    }
    if (ph.phase === 'soon' && RS.warned !== r.id && !F.session.visit && !ui.modals.length) { // (said once, when nothing covers it)
      RS.warned = r.id;
      if (online() && RS.server !== false && Date.now() >= RS.pollAt) RS.poll();
      // (a short bubble by the countdown badge when it is there: 19zzzzb-raid-badge.js; else the old notice)
      if (ui.raidSoonNote) ui.raidSoonNote(L.raidKind(r).many + ' in ' + Math.ceil(ph.left / 60000) + ' min!');
      else ui.toast('Town Raid in ' + Math.ceil(ph.left / 60000) + ' minutes: ' + L.raidKind(r).many + ' are coming for the fields! Get your tools ready.', 4200, RED);
    }
    if (ph.phase === 'on') {
      if (rec && rec.id && rec.id !== r.id && !rec.c) RS.settle({ id: rec.id, h: rec.h, sv: rec.sv, l: rec.l, c: 0, b: rec.b }); // (the last raid's results, one more try: this one starts now)
      if (RS.id !== r.id) { RS.id = r.id; RS.town = null; RS.pending = 0; RS.req = null; RS.maxed = false; RS.helpers = {}; RS.pollAt = 0; }
      L.raidRec(s, r);
      if (online() && RS.server !== false) {
        if (RS.pending && Date.now() >= RS.sendAt) RS.flush(r);
        else if (!RS.pending && Date.now() >= RS.pollAt) RS.poll();
      } else if (online() && RS.server === false && Date.now() >= RS.pollAt) RS.poll();
      if (RS.shown !== r.id && !ui.modals.length && !(F.world && F.world.busy) && !document.getElementById('farm-ask')) {
        RS.shown = r.id;
        if (takeTip('raid_tour')) ui.tour('raid', function () { ui.raidStartCard(r); });
        else ui.raidStartCard(r);
      }
    } else if (RS.pending && RS.id && r && RS.id !== r.id) { // the end: the last batch (the server takes it a few minutes late)
      var last = L.raidById(RS.id);
      if (last && now < last.end + R.late * 60000 && Date.now() >= RS.sendAt) RS.flush(last);
    }
    ui.raidBar(ph);
  };

  // ---------- the bar at the top ----------
  var BAR = { x: 8, w: 286, h: 30 };
  U.raidBar = function (ph) {
    var self = this, s = mine(), show = ph.phase === 'soon' || ph.phase === 'on';
    if (!this.raidBox) {
      var c = this.raidBox = this.add.container(BAR.x, 102).setDepth(50);
      var bg = this.add.image(0, 0, this.bake('ui-raidbar', BAR.w, BAR.h, function (g) {
        g.fillStyle(0x3a140a, 0.86).fillRoundedRect(0, 0, BAR.w, BAR.h, 10);
        g.lineStyle(2, 0xff7a4a, 0.95).strokeRoundedRect(1, 1, BAR.w - 2, BAR.h - 2, 9);
      })).setOrigin(0).setScale(1 / F.R);
      this.raidIcon = this.add.image(17, BAR.h / 2, 'items', C.ICON.storm).setScale(0.16);
      this.raidText = this.txt(32, 5, '', 12, '#fff6d8', { fontStyle: 'bold' });
      this.raidTime = this.txt(BAR.w - 9, 5, '', 12, '#ffd2a8', { fontStyle: 'bold' }).setOrigin(1, 0);
      this.raidTrack = this.add.rectangle(32, BAR.h - 7, BAR.w - 44, 4, 0x000000, 0.45).setOrigin(0, 0.5);
      this.raidFill = this.add.rectangle(32, BAR.h - 7, 1, 4, 0xffb030).setOrigin(0, 0.5);
      var z = this.add.zone(BAR.w / 2, BAR.h / 2, BAR.w, BAR.h + 4).setInteractive({ useHandCursor: true });
      F.tapOn(z, function () { if (!self.modals.length) self.raidInfo(); });
      c.add([bg, this.raidIcon, this.raidText, this.raidTime, this.raidTrack, this.raidFill, z]);
    }
    var vis = show && !this.decorating;
    this.raidBox.setVisible(vis);
    if (!vis) return;
    var goal = this.goalBar && this.goalBar.visible, visitBar = this.visitBar && this.visitBar.visible !== false && F.session.visit;
    this.raidBox.setY(visitBar ? 112 : goal ? 102 : 68); // (on a visit: under the round Visit button)
    var r = ph.r, kind = L.raidKind(r), rec = L.raidRec(s), text, pct = 0, bar = false;
    var ic = kindIcon(kind);
    if (this.raidIcon.frame.name !== ic) this.raidIcon.setFrame(ic);
    if (ph.phase === 'soon') {
      text = 'Town Raid soon: ' + kind.name;
    } else {
      var t = RS.town, alone = !online() || RS.server === false;
      if (alone) {
        text = 'Defend your farm · ' + Math.min(rec.h, R.alone.goal) + '/' + R.alone.goal;
        pct = Math.min(100, 100 * rec.h / R.alone.goal);
      } else if (t && t.id === r.id) {
        // the town's count, with what this phone has not sent yet
        var total = t.total + Math.max(0, rec.h - t.mine), defenders = t.defenders || (rec.h ? 1 : 0), goalN = Math.max(t.goal, L.raidGoal(defenders));
        pct = L.raidPct(total, goalN);
        text = fmt(defenders) + (defenders === 1 ? ' farmer' : ' farmers') + ' defending · ' + pct + '%';
        pct = Math.min(100, pct);
      } else {
        text = 'Town Raid! Joining the town…';
      }
      bar = true;
    }
    if (this.raidText.text !== text) this.raidText.setText(text).setFontSize(text.length > 34 ? 11 : 12);
    var tt = clockText(ph.left);
    if (this.raidTime.text !== tt) this.raidTime.setText(tt);
    this.raidTrack.setVisible(bar);
    this.raidFill.setVisible(bar && pct > 0).setSize(Math.max(1, (BAR.w - 44) * pct / 100), 4);
  };
  // Toasts go under the bar while it shows (never over it).
  var toast = U.toast;
  U.toast = function (msg, ms, color) {
    toast.call(this, msg, ms, color);
    if (!msg || !this.raidBox || !this.raidBox.visible || (this.modals && this.modals.length)) return;
    var y = this.raidBox.y + BAR.h + 8;
    if (this.toastText.y >= y) return;
    this.toastText.setY(y);
    var b = this.toastText.getBounds();
    this.toastBg.clear().setVisible(true);
    this.toastBg.fillStyle(color || 0x24160b, 0.86).fillRoundedRect(b.x - 12, b.y - 8, b.width + 24, b.height + 16, 10);
  };

  // The card when a raid starts (centred, like every pop-up).
  U.raidStartCard = function (r) {
    var kind = L.raidKind(r), w = F.world, home = w && w.mapKey === 'farm' && !F.session.visit, t = RS.town;
    var ic = kindIcon(kind);
    var rows = [[ic, kind.start]];
    if (!home) rows.push([C.ICON.storm, F.session.visit ? 'They are at this farm too: help your friend! Your hits count for you.' : 'They are at your farm! Go home to defend it.']);
    if (online() && RS.server !== false) {
      rows.push([C.ICON.ribbon, 'Every hit adds to ONE goal the whole town shares' + (t && t.defenders ? ': ' + fmt(t.defenders) + ' farmers are defending now.' : '.')]);
      rows.push([C.ICON.chest, 'Everyone who helps gets a chest. If the town wins: Double Drops for everyone until midnight tomorrow!']);
    } else {
      rows.push([C.ICON.chest, 'Drive off ' + R.alone.goal + ' for your own chest. ' + (online() ? '' : 'Join online play to defend with everyone!')]);
    }
    rows.push([C.ICON.clock != null ? C.ICON.clock : C.ICON.calendar, 'Until ' + L.formatTime((R.start + R.mins) % 1440) + ' (Manila time). Raiders can take at most ' + R.lossMost + ' crops.']);
    this.dialog('TOWN RAID: ' + kind.name.toUpperCase(), [{ label: 'Defend!' }], { rows: rows });
  };
  // The bar, tapped.
  U.raidInfo = function () {
    var ph = L.raidPhase(), r = ph.r;
    if (!r) return;
    var kind = L.raidKind(r), rec = L.raidRec(mine()), t = RS.town, ic = kindIcon(kind);
    var rows = [[ic, ph.phase === 'on' ? kind.start : kind.name + ' starts in ' + Math.ceil(ph.left / 60000) + ' minutes, at ' + L.raidWhen(r) + ' (Manila time).']];
    if (ph.phase === 'on') {
      if (online() && RS.server !== false && t && t.id === r.id) rows.push([C.ICON.ribbon, fmt(t.total + Math.max(0, rec.h - t.mine)) + ' of ' + fmt(t.goal) + ' hits for the town. You: ' + rec.h + '.']);
      else rows.push([C.ICON.ribbon, 'You: ' + rec.h + ' of ' + R.alone.goal + ' hits for your own chest.']);
    }
    rows.push([C.ICON.chest, 'Chests at ' + R.chests.map(function (c) { return c.min; }).join(', ') + ' hits. Hits use no energy.']);
    rows.push([C.ICON.calendar, 'Raids: every Monday and Thursday, 8:00 to 8:30 PM.']);
    this.dialog('TOWN RAID', null, { rows: rows });
  };

  // ---------- the raiders on the farm ----------
  var sheetOf = function (look) { // which picture: the wild sheet when it is on the phone, else a farm animal
    if (look.icons) return null;
    if (look.wild && F.images && F.images.wild && WI && WI.order.indexOf(look.wild) >= 0) return { key: 'wild', base: WI.order.indexOf(look.wild) * 12, tint: look.tint, px: WI.animals[look.wild].px };
    if (look.farm != null) return { key: 'animals', base: look.farm, tint: look.farmTint, px: look.px };
    return { key: 'fx-raidspark', base: -1, tint: 0xffffff, px: 64 };
  };
  var textures = function (sc) {
    if (!sc.textures.exists('fx-raidshadow')) {
      var c = sc.textures.createCanvas('fx-raidshadow', 64, 24), g = c.getContext();
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(32, 12, 30, 10, 0, 0, Math.PI * 2); g.fill();
      c.refresh();
    }
    if (!sc.textures.exists('fx-raidspark')) { // a little flame (until the art comes)
      var k = sc.textures.createCanvas('fx-raidspark', 64, 64), q = k.getContext(), gr = q.createRadialGradient(32, 40, 2, 32, 36, 28);
      gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.35, '#ffc040'); gr.addColorStop(0.7, '#ff6a1a'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      q.fillStyle = gr;
      q.beginPath(); q.moveTo(32, 2); q.bezierCurveTo(44, 20, 58, 30, 52, 46); q.bezierCurveTo(48, 60, 16, 60, 12, 46); q.bezierCurveTo(6, 30, 22, 22, 32, 2); q.fill();
      k.refresh();
    }
    if (!sc.textures.exists('fx-raidarrow')) {
      var a = sc.textures.createCanvas('fx-raidarrow', 64, 16), ag = a.getContext();
      ag.fillStyle = '#7a4a22'; ag.fillRect(4, 7, 46, 3);
      ag.fillStyle = '#d8d8e0'; ag.beginPath(); ag.moveTo(64, 8); ag.lineTo(48, 2); ag.lineTo(48, 14); ag.closePath(); ag.fill();
      ag.fillStyle = '#e8e0c8'; ag.fillRect(0, 3, 10, 3); ag.fillRect(0, 10, 10, 3);
      a.refresh();
    }
  };

  var create = P.create;
  P.create = function () {
    create.apply(this, arguments);
    this.raiders = [];
    this.raidSpawn = 1500;
    var s = mine();
    if (s && s.raid) L.raidBonus = s.raid.b || 0; // (your own farm's bonus day, never a friend's)
  };
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    this.raidSec = (this.raidSec || 0) - delta;
    if (this.raidSec <= 0) { this.raidSec = 1000; RS.tick(); }
    if (this.raiders) this.raidFrame(Math.min(delta, 100), time);
  };

  // The raid's raiders here: on the farm while a raid is on (yours or a friend's), not while a panel is open.
  P.raidHere = function () {
    return raidsOn() && this.mapKey === 'farm' && !!this.player && !!L.raidNow();
  };
  P.raidFrame = function (dt, time) {
    var self = this, r = L.raidNow();
    if (this.busy || !F.ui || F.ui.blocking()) return;
    if (!this.raidHere()) {
      if (this.raiders.length) this.raiders.slice().forEach(function (a) { if (a.mode !== 'flee') self.raiderFlee(a); });
    } else {
      var kind = L.raidKind(r), live = this.raiders.filter(function (a) { return a.mode !== 'flee'; }).length;
      this.raidSpawn -= dt;
      if (this.raidSpawn <= 0 && live < kind.most) {
        this.raidSpawn = (kind.every[0] + Math.random() * (kind.every[1] - kind.every[0])) * 1000;
        this.addRaider(r);
      }
    }
    this.raiders.slice().forEach(function (a) { self.updateRaider(a, dt, time, r); });
  };

  // Which crop a new raider goes for: one near you that no other raider has, else any spot near you.
  P.raidAim = function () {
    var self = this, s = this.state, f = this.feet(), taken = {}, W2 = this.map.width;
    this.raiders.forEach(function (a) { if (a.idx != null) taken[a.idx] = 1; });
    var list = L.raidCrops(s).filter(function (idx) { return !taken[idx]; }).map(function (idx) {
      var x = (idx % W2 + 0.5) * T, y = (Math.floor(idx / W2) + 0.6) * T;
      return { idx: idx, x: x, y: y, d: Math.hypot(x - f.x, y - f.y) };
    }).filter(function (p) { return p.d < 14 * T; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
    if (list.length) return list[Math.floor(Math.random() * list.length)];
    var ang = Math.random() * Math.PI * 2, d = (1.5 + Math.random() * 2.5) * T;
    return { idx: null, x: self.clampX(f.x + Math.cos(ang) * d), y: self.clampY(f.y + Math.sin(ang) * d) };
  };
  P.clampX = function (x) { return Math.max(1.5 * T, Math.min((this.map.width - 1.5) * T, x)); };
  P.clampY = function (y) { return Math.max(1.5 * T, Math.min((this.map.height - 1.5) * T, y)); };

  P.addRaider = function (r) {
    var kind = L.raidKind(r), look = kind.look, aim = this.raidAim(), ang = Math.random() * Math.PI * 2, d = (7 + Math.random() * 3) * T;
    textures(this);
    var x = this.clampX(aim.x + Math.cos(ang) * d), y = this.clampY(aim.y + Math.sin(ang) * d);
    var a = { kind: r.kind, def: kind, hp: kind.hp, x: x, y: y, tx: aim.x, ty: aim.y, idx: aim.idx, mode: 'come', eat: kind.eat * 1000, t: Math.random() * 1000, lift: 0, flip: false, dir: 'side', fade: 0 };
    var sh = sheetOf(look);
    a.sheet = sh;
    if (look.icons) { // flying debris: a branch or a stone, spinning
      a.img = this.add.image(x, y, 'items', C.ICON[look.icons[Math.floor(Math.random() * look.icons.length)]]).setScale(look.w * T / 128).setOrigin(0.5, 0.8);
    } else if (sh.base < 0) { // a drawn spark
      a.img = this.add.image(x, y, sh.key).setScale(look.w * T / 64).setOrigin(0.5, 0.9);
    } else {
      F.ensureTexture(this, sh.key);
      a.img = this.add.image(x, y, sh.key, sh.base + FACING.side).setOrigin(0.5, FEET).setScale(look.w * T / sh.px);
      if (sh.tint) a.img.setTint(sh.tint);
    }
    a.scale = a.img.scaleX;
    a.sh = this.add.image(x, y, 'fx-raidshadow').setDisplaySize(look.w * 0.9 * T, look.w * 0.3 * T).setDepth(DEPTH.shadow);
    if (kind.glow && this.textures.exists('fx-glow')) a.glow = this.add.image(x, y, 'fx-glow').setDisplaySize(2.4 * T, 2.4 * T).setBlendMode(Phaser.BlendModes.ADD).setTint(kind.glow).setDepth(LIGHT - 0.05).setAlpha(0);
    a.img.setAlpha(0);
    this.raiders.push(a);
    this.drawRaider(a, 0);
    return a;
  };

  P.drawRaider = function (a, time) {
    var kind = a.def;
    if (kind.flies) a.lift = (a.mode === 'eat' ? 0.15 : 0.45 + Math.sin(time / 180 + a.t) * 0.12) * T;
    if (a.def.look.icons) a.lift = a.mode === 'eat' ? 0 : (0.6 + Math.sin(time / 200 + a.t) * 0.2) * T;
    a.img.setPosition(a.x, a.y - a.lift);
    a.sh.setPosition(a.x, a.y);
    if (a.glow) a.glow.setPosition(a.x, a.y - a.lift - 0.3 * T).setAlpha((0.55 + Math.sin(time / 120 + a.t) * 0.15) * Math.max(0, Math.min(1, a.fade)));
    F.depthTo(a.img, (a.def.look.light ? LIGHT : DEPTH.actor) + a.y / 1e5); // (a spark is a light: over the night, like the lamps)
    if (a.bar) {
      var by = a.y - a.lift - (a.def.look.w + 0.4) * T;
      a.bar.bg.setPosition(a.x, by);
      a.bar.fill.setPosition(a.x - 0.4 * T, by).setSize(0.8 * T * Math.max(0, a.hp) / a.def.hp, 0.09 * T);
    }
  };

  // Its walking frames (sheet pictures), the spin (debris), the flicker (a drawn spark).
  var pose = function (a, vx, vy, time) {
    if (a.def.look.icons) { a.img.setRotation(a.mode === 'eat' ? 0.3 : time / 160 + a.t); return; }
    var sh = a.sheet;
    if (!sh || sh.base < 0) { a.img.setScale(a.scale * (1 + Math.sin(time / 90 + a.t) * 0.06), a.scale * (1 + Math.cos(time / 110 + a.t) * 0.08)); return; }
    var f;
    if (a.mode === 'eat') f = EAT;
    else if (a.mode === 'flee' && a.def.flies) f = AWAY;
    else {
      var ax = Math.abs(vx), ay = Math.abs(vy);
      if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = vy > 0 ? 'down' : 'up';
      if (ax > 4) a.flip = vx > 0;
      f = FACING[a.dir] + STEPS[Math.floor(time / 140 + a.t) % 4];
    }
    a.img.setFrame(sh.base + f).setFlipX((a.dir === 'side' || f >= EAT) && a.flip);
  };

  P.updateRaider = function (a, dt, time, r) {
    var kind = a.def, s = this.state;
    if (a.fade < 1 && a.mode !== 'flee') { a.fade = Math.min(1, a.fade + dt / 500); a.img.setAlpha(a.fade); }
    if (a.hitT > 0) a.hitT -= dt;
    var speed = kind.speed * T * (a.mode === 'flee' ? 2 : 1), dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), vx = 0, vy = 0;
    if (a.mode === 'come' || a.mode === 'flee') {
      var step = speed * dt / 1000;
      if (d <= step) { a.x = a.tx; a.y = a.ty; } else { vx = dx / d * speed; vy = dy / d * speed; a.x += dx / d * step; a.y += dy / d * step; }
      if (a.mode === 'come' && d <= step) a.mode = 'eat';
      if (a.mode === 'flee') {
        a.fade -= dt / 900;
        a.img.setAlpha(Math.max(0, a.fade));
        a.sh.setAlpha(Math.max(0, a.fade));
        if (a.fade <= 0) return this.raiderGone(a);
      }
    } else if (a.mode === 'eat') {
      a.eat -= dt;
      if (a.idx != null && !(s.soil[a.idx] && s.soil[a.idx].c)) { // (picked or dug up meanwhile: on to another)
        var aim = this.raidAim();
        a.tx = aim.x; a.ty = aim.y; a.idx = aim.idx; a.mode = 'come'; a.eat = kind.eat * 1000;
      } else if (a.eat <= 0) {
        var item = a.idx != null && r ? L.raidTrample(s, r, a.idx) : null;
        if (item) {
          this.refreshTile(a.idx);
          this.floatTextAt(a.x, a.y - T, '-1 ' + C.ITEMS[item].name);
          F.ui.toast(kind.lost.replace('{crop}', C.ITEMS[item].name) + (L.raidRec(mine()).l >= R.lossMost && !s.isVisit ? ' (That is the most a raid can take: the rest of your field is safe.)' : ''), 3000, RED);
          sfx('nope');
          this.changed();
          this.save();
        }
        this.raiderFlee(a);
      }
    }
    pose(a, vx, vy, time);
    this.drawRaider(a, time);
    if (a.mode === 'eat') a.img.y = a.y - a.lift + Math.sin(time / 90 + a.t) * 6; // (pecking, sniffing, smouldering)
  };

  // Off it goes: away from you, fading out.
  P.raiderFlee = function (a) {
    if (a.mode === 'flee') return;
    var f = this.feet(), dx = a.x - f.x, dy = a.y - f.y, d = Math.hypot(dx, dy) || 1;
    a.mode = 'flee';
    a.idx = null;
    a.tx = a.x + dx / d * 6 * T;
    a.ty = a.y + dy / d * 6 * T;
    a.fade = 1;
    if (a.bar) { a.bar.bg.destroy(); a.bar.fill.destroy(); a.bar = null; }
  };
  P.raiderGone = function (a) {
    var i = this.raiders.indexOf(a);
    if (i >= 0) this.raiders.splice(i, 1);
    [a.img, a.sh, a.glow, a.bar && a.bar.bg, a.bar && a.bar.fill].forEach(function (o) { if (o) o.destroy(); });
  };

  // One hit on a raider: it flashes, a tough one shows how much is left; at 0 it is driven off.
  P.raiderStruck = function (a) {
    if (!a || a.mode === 'flee' || this.raiders.indexOf(a) < 0) return;
    var r = L.raidNow();
    if (!r) return;
    a.hp -= 1;
    a.hitT = 160;
    var counted = RS.hit(r);
    if (a.def.look.icons || !a.sheet || a.sheet.base < 0) a.img.setTint(0xffffff); else a.img.setTintFill(0xffffff);
    var img = a.img, tint = a.sheet && a.sheet.base >= 0 ? a.sheet.tint : null;
    this.time.delayedCall(90, function () { if (img.active) { if (tint) img.setTint(tint); else img.clearTint(); } });
    if (this.bits) this.bits.dust.explode(3, a.x, a.y - 0.2 * T);
    this.cameras.main.shake(60, 0.0014);
    if (counted) this.floatTextAt(a.x, a.y - (a.def.look.w + 0.6) * T, '+1');
    if (a.hp <= 0) {
      this.floatTextAt(a.x, a.y - (a.def.look.w + 1.1) * T, a.def.off);
      this.raiderFlee(a);
      return;
    }
    if (!a.bar && a.def.hp > 1) a.bar = { bg: this.add.rectangle(a.x, a.y, 0.86 * T, 0.15 * T, 0x2e1c0c, 0.85).setDepth(DEPTH.fx), fill: this.add.rectangle(a.x, a.y, 0.8 * T, 0.09 * T, 0xe5484d).setOrigin(0, 0.5).setDepth(DEPTH.fx + 0.01) };
    // a hit raider steps back a little
    var f = this.feet(), dx = a.x - f.x, dy = a.y - f.y, d = Math.hypot(dx, dy) || 1;
    a.x = this.clampX(a.x + dx / d * 0.35 * T);
    a.y = this.clampY(a.y + dy / d * 0.35 * T);
  };

  // The nearest raider (not leaving) within `range` tiles of your feet, or null.
  P.raiderNear = function (range) {
    var f = this.feet(), best = null, bd = range * T;
    (this.raiders || []).forEach(function (a) {
      if (a.mode === 'flee' || a.fade < 0.5) return;
      var d = Math.hypot(a.x - f.x, (a.y - a.lift * 0.5) - f.y);
      if (d < bd) { bd = d; best = a; }
    });
    return best;
  };
  P.raidFace = function (a) {
    var f = this.feet(), dx = a.x - f.x, dy = a.y - f.y;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    this.idle();
  };
  var works = function (kind, tool, held) {
    var t = kind.tools;
    if (tool) return t.indexOf('any') >= 0 ? true : t.indexOf(tool) >= 0;
    if (held === 'bow') return t.indexOf('bow') >= 0;
    return t.indexOf('hands') >= 0;
  };
  // What the action button does about a raider, or null (then it farms as always).
  P.raidAction = function () {
    if (!this.raiders || !this.raiders.length || !L.raidNow()) return null;
    var self = this, s = this.state, held = L.held(s), def = held && C.ITEMS[held.id], tool = def && def.tool && C.TOOLS[def.tool] ? def.tool : null;
    var near = this.raiderNear(R.reach);
    if (F.session.riding) return near ? { label: near.def.verb, icon: -1, disabled: true, why: 'Get off your horse to fight them off!' } : null;
    if (held && held.id === 'bow') {
      var far = this.raiderNear(R.bowRange);
      if (far && works(far.def, null, 'bow')) return { label: 'Shoot', icon: L.iconOf(s, 'bow'), run: function () { self.raidShoot(far); } };
      if (far && near === far) return { label: far.def.verb, icon: L.iconOf(s, 'bow'), disabled: true, why: far.def.why || 'Arrows can\'t stop these.' };
    }
    if (!near) return null;
    if (tool && works(near.def, tool)) return { label: near.def.verb, icon: L.iconOf(s, tool), run: function () { self.raidSwing(near, tool); } };
    if (!tool && works(near.def, null, held && held.id)) return { label: near.def.verb, icon: -1, run: function () { self.raidSwing(near, null); } };
    return { label: near.def.verb, icon: tool ? L.iconOf(s, tool) : -1, disabled: true, why: near.def.why || 'Hold a tool to drive it off!' };
  };
  var resolve = P.resolve;
  P.resolve = function () {
    return this.raidAction() || resolve.apply(this, arguments);
  };

  // A tool swung (or a watering can poured, or hands waved) at a raider: it lands a moment later. No energy used.
  P.raidSwing = function (a, tool) {
    var self = this, s = this.state;
    this.raidFace(a);
    if (tool) {
      this.animateUse(L.iconOf(s, tool), tool === 'can' ? 'pour' : 'swing');
      sfx(tool === 'can' ? 'water' : 'chop');
    } else {
      this.acting = 260;
      this.tweens.add({ targets: this.player, y: this.player.y - 0.18 * T, duration: 110, yoyo: true });
      this.floatTextAt(this.feet().x, this.feet().y - 1.6 * T, 'Shoo!');
      sfx('pick');
    }
    this.time.delayedCall(tool === 'can' ? 240 : 150, function () { self.raiderStruck(a); });
  };
  // The Bow: an arrow flies to it (no arrow or energy used in a raid).
  P.raidShoot = function (a) {
    var self = this, f = this.feet();
    this.raidFace(a);
    this.acting = 260;
    textures(this);
    var key = this.textures.exists('props/arrow_fly') ? 'props/arrow_fly' : 'fx-raidarrow';
    var x0 = f.x, y0 = f.y - 0.6 * T, x1 = a.x, y1 = a.y - a.lift - 0.3 * T, ang = Math.atan2(y1 - y0, x1 - x0), ms = Math.max(80, 1000 * Math.hypot(x1 - x0, y1 - y0) / ARROW_SPEED);
    var img = this.add.image(x0, y0, key).setDisplaySize(0.85 * T, 0.28 * T).setRotation(ang).setDepth(DEPTH.fx);
    sfx('bowshot');
    this.tweens.add({ targets: img, x: x1, y: y1, duration: ms, onComplete: function () { img.destroy(); self.raiderStruck(a); } });
  };

  // ---------- friends: who helped on your farm ----------
  if (O) {
    var onMessage = O.onMessage;
    O.onMessage = function (event, payload) {
      var p = payload && typeof payload === 'object' ? payload : {}, who = typeof p.id === 'string' ? O.others[p.id] : null;
      if (event === 'rdh') {
        if (!who || F.session.visit || !L.raidNow()) return;
        var n = Math.max(0, Math.min(R.batchMost, Math.floor(Number(p.n)) || 0));
        if (!n) return;
        var h = RS.helpers[who.id] || (RS.helpers[who.id] = { name: who.name, n: 0 });
        h.n = Math.min(R.cap, h.n + n);
        var w = F.world, rr = w && w.remotes && w.remotes[who.id];
        if (rr && rr.spr && rr.spr.active) w.floatTextAt(rr.x, rr.y - 1.8 * T, '+' + n + ' for the town!');
        return;
      }
      onMessage.call(O, event, payload);
    };
    // When the game connects: the town's word on the last raid (its bonus day) and the next.
    var prizes = O.prizes;
    O.prizes = function () {
      return prizes.call(O).then(function (won) {
        if (raidsOn()) RS.poll();
        return won;
      });
    };
  }

  // ---------- the tour ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.raid = {
    title: 'TOWN RAID',
    steps: [
      {
        text: 'Every Monday and Thursday, 8 PM: something attacks Harvest Ville\'s fields! Boars, crows, sparks or a typhoon.',
        draw: function (ui, sc, move) {
          var crop = icon(ui, sc, 136, 70, C.ITEMS.turnip.icon, 0.3);
          [C.ITEMS.meat_boar.icon, C.ITEMS.feather_labuyo.icon, C.ITEMS.ember_shard.icon, C.ICON.storm].forEach(function (f, n) {
            var i = icon(ui, sc, n < 2 ? 40 + n * 40 : 196 + (n - 2) * 40, 40 + (n % 2) * 40, f, 0.24);
            tw(ui, move, { targets: i, x: 136 + (i.x - 136) * 0.55, duration: 700, delay: n * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
          tw(ui, move, { targets: crop, scale: 0.34, duration: 400, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'They come at YOUR farm. Swing your tools at them, or shoot with your Bow. Sparks? Water them out with the can! Hits use no energy.',
        draw: function (ui, sc, move) {
          ['hoe', 'axe', 'can', 'bow'].forEach(function (k, n) {
            var i = icon(ui, sc, 52 + n * 56, 62, C.ITEMS[k].icon, 0.3);
            tw(ui, move, { targets: i, angle: n === 2 ? 25 : -35, duration: 260, delay: n * 200, yoyo: true, repeat: -1, repeatDelay: 500 });
          });
        },
      },
      {
        text: 'Every hit adds to ONE goal the whole town shares. Farmers all over defend together!',
        draw: function (ui, sc, move) {
          var track = ui.add.rectangle(36, 66, 200, 14, 0x3a140a).setOrigin(0, 0.5), fill = ui.add.rectangle(36, 66, 20, 14, 0xffb030).setOrigin(0, 0.5);
          sc.add(track);
          sc.add(fill);
          words(ui, sc, 136, 36, '3,214 farmers · 67%', 14, '#7a2a12');
          tw(ui, move, { targets: fill, width: 200, duration: 2200, repeat: -1, repeatDelay: 400 });
        },
      },
      {
        text: 'Everyone who helps gets a chest. If the town wins: Double Drops for everyone until midnight tomorrow!',
        draw: function (ui, sc, move) {
          var ch = icon(ui, sc, 100, 64, C.ICON.chest, 0.4);
          var x2 = words(ui, sc, 186, 64, 'x2', 34, '#a8740c');
          tw(ui, move, { targets: ch, y: 54, duration: 420, yoyo: true, repeat: -1 });
          tw(ui, move, { targets: x2, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
  void GREY; void noop;
})(window.Farm = window.Farm || {});
