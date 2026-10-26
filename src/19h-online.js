// Phase 4 at runtime: online play, with the player's account in the app the game runs in (no sign-in here; you
// can leave online play, and join again, from the Online panel). Publishing your farm for
// others to visit, visiting a farm (a look-only copy built by L.visitState: nothing there can be changed, and
// your own save is never touched), seeing everyone on the same farm live (the owner and up to 8 visitors),
// likes and gifts, the leaderboards, friends and messages. The transport is F.Net (02-net.js), the database
// side supabase/farm_online.sql, the rules 01-logic8.js. Without the app's transport none of this shows.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var ON = C.ONLINE;
  var DEPTH = F.WorldScene.DEPTH;
  var IDLE_FRAME = { down: 0, up: 3, left: 6, right: 6 };
  var FEET_OFFSET = 128; // the sprite's centre sits this far above the feet (as in 11-world.js)
  var MAPS = { farm: 1, house: 1, town: 1, mine: 1 };
  var DIRS = { down: 1, up: 1, left: 1, right: 1 };
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var errText = function (e) {
    var m = (e && e.message) || String(e || '');
    if (/not signed in|JWT|auth/i.test(m)) return 'Sign in to Selebox to play online.';
    if (/fetch|network|offline|timeout/i.test(m)) return 'Could not reach the online world. Check your connection.';
    if (/no such farm/i.test(m)) return 'That farm is not online any more.';
    if (/name not allowed/i.test(m)) return 'That name is not allowed. Please pick a kinder one.';
    return 'Something went wrong online. Please try again.';
  };

  // ---------- the online session (lives across map changes) ----------
  var O = F.Online = {
    on: false, // signed in and joined
    me: null, // { id, name, code, listed }
    chan: null, // the live channel we are on ('farm:<id>', our own or the farm we are visiting)
    topic: '',
    others: {}, // id -> the others on the channel: { id, name, look, map, x, y, dir, m, at, host, t }
    seen: false, // had the first presence list on this channel
    lastSnap: '',
    mvMs: 0,
    last: null, // where we last told the others we were
    blocked: {}, // id -> farm name: the players we blocked (the server keeps them away; this hides any still on a farm)
  };

  O.start = function () {
    if (O.started) return;
    O.started = true;
    F.Net.init();
    if (!F.Net.available()) return;
    O.connect().catch(noop);
    O.timer = setInterval(function () { if (!F.Host.sleeping) O.publish(false); }, ON.publishEvery);
  };

  // Joins online play with the app's signed-in account (unless the player left it).
  O.connect = function () {
    if (O.on) return Promise.resolve(O.me);
    if (O.joining) return O.joining;
    O.joining = F.Net.session().then(function (uid) {
      if (!uid) throw new Error('not signed in');
      if (F.session.state.net.off) return null;
      return O.joined();
    });
    var done = function () { O.joining = null; };
    O.joining.then(done, done);
    return O.joining;
  };

  // Joined: our player row (made the first time), our channel, our farm published, gifts collected.
  O.joined = function (name) {
    return F.Net.rpc('farm_join_v1', { p_farm_name: name || null }).then(function (r) {
      if (!r || !r.id) throw new Error('join failed');
      var s = F.session.state;
      O.me = { id: String(r.id), name: L.cleanText(r.farm_name, 24) || 'Harvest Ville', code: String(r.friend_code || ''), listed: r.listed !== false };
      s.net.id = O.me.id;
      s.net.name = O.me.name;
      s.net.code = O.me.code;
      F.Host.save(s);
      O.on = true;
      O.ensureChannel();
      F.bus.emit('online');
      F.Net.rpc('farm_blocked_v1', {}).then(function (list) {
        O.blocked = {};
        (list || []).forEach(function (b) { O.blocked[String(b.id)] = L.cleanText(b.farm_name, 24) || 'Farmer'; });
      }, noop);
      return O.publish(true).then(function () { return O.collect(true); }).then(function () { return O.prizes(); })
        .then(function () { return L.settleRefills ? L.settleRefills().catch(noop) : null; }).then(function () { return O.me; });
    });
  };

  // Stops playing online (after leaving it): back to your own farm, off the channel.
  O.disconnect = function () {
    O.leaveChannel();
    O.on = false;
    O.me = null;
    O.blocked = {};
    O.lastSnap = '';
    var going = F.session.visit;
    F.session.visit = null;
    if (going) O.restartWorld();
    F.bus.emit('online');
  };

  // Shares our farm (only when it changed; otherwise just says we are still here).
  O.publish = function (force) {
    if (!O.on || O.publishing) return Promise.resolve(false);
    var s = F.session.state, snap = L.snapshot(s), sc = L.weekScores(s, F.today()), key = JSON.stringify([snap, sc]);
    if (!force && key === O.lastSnap) return F.Net.rpc('farm_heartbeat_v1', {}).then(function () { return false; }, function () { return false; });
    O.publishing = true;
    return F.Net.rpc('farm_publish_v1', { p_data: snap, p_beauty: sc.beauty, p_house_level: s.home.level, p_earned_week: sc.earned, p_quests_week: sc.quests })
      .then(function (ok) { if (ok) O.lastSnap = key; return !!ok; }, function () { return false; })
      .then(function (ok) { O.publishing = false; return ok; });
  };

  // Gifts visitors left at our farm: 100G for each gold gift, a Star for each star gift.
  O.collect = function (auto) {
    return F.Net.rpc('farm_collect_v1', {}).then(function (r) {
      var gold = Math.max(0, Math.floor(Number(r && r.gold) || 0)), stars = Math.max(0, Math.floor(Number(r && r.stars) || 0));
      if (!gold && !stars) {
        if (!auto && F.ui) F.ui.toast('No gifts waiting right now. Visitors can leave you one a day.');
        return null;
      }
      var s = F.session.state, from = (Array.isArray(r.from) ? r.from : []).map(function (n) { return L.cleanText(n, 24); }).filter(Boolean);
      s.gold += gold * ON.giftGold;
      s.stars += stars;
      F.Host.save(s);
      F.bus.emit('hud');
      sfx('coin');
      var got = [gold ? '+' + gold * ON.giftGold + 'G' : '', stars ? '+' + stars + (stars > 1 ? ' Sunbeams' : ' Sunbeam') : ''].filter(Boolean).join(' and ');
      if (F.ui) F.ui.toast('Visitors left you gifts: ' + got + '!' + (from.length ? '\nFrom ' + from.slice(0, 4).join(', ') + (from.length > 4 ? ' and more.' : '.') : ''), 3600, 0x7a4d12);
      return { gold: gold, stars: stars };
    }).catch(function (e) { if (!auto && F.ui) F.ui.toast(errText(e)); return null; });
  };

  // Last week's rank prizes (top 10 on each board), claimed once when the game opens: a panel says what was won.
  var BOARD = { beauty: 'Home Beauty', earned: 'Gold earned', quests: 'Daily quests done' };
  O.prizes = function () {
    return F.Net.rpc('farm_prizes_v1', {}).then(function (list) {
      var won = (Array.isArray(list) ? list : []).filter(function (p) { return p && BOARD[p.kind]; });
      if (!won.length) return null;
      var s = F.session.state, gold = 0, stars = 0;
      won.forEach(function (p) { gold += Math.max(0, Math.min(10000, Number(p.gold) || 0)); stars += Math.max(0, Math.min(10, Number(p.stars) || 0)); });
      s.gold += gold;
      s.stars += stars;
      F.Host.save(s);
      F.bus.emit('hud');
      sfx('coin');
      var show = function () {
        if (!F.ui || F.ui.modals.length) return setTimeout(show, 1500);
        F.ui.dialog('LAST WEEK\'S PRIZES', null, {
          rows: won.map(function (p) {
            return [C.ICON.ribbon, '#' + p.rank + ' in ' + BOARD[p.kind] + ': +' + String(p.gold).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'G and ' + p.stars + (p.stars > 1 ? ' Sunbeams' : ' Sunbeam')];
          }),
        });
      };
      show();
      return won;
    }).catch(function () { return null; });
  };

  // ---------- the live channel ----------
  O.topicNow = function () {
    if (!O.on) return '';
    return 'farm:' + (F.session.visit ? F.session.visit.host : O.me.id);
  };

  O.myState = function () {
    var w = F.world, f = w && w.player ? w.feet() : { x: 0, y: 0 };
    return {
      id: O.me.id, name: O.me.name, look: F.session.state.look === 'girl' ? 'girl' : 'boy', map: w ? w.mapKey : 'farm',
      x: Math.round(f.x), y: Math.round(f.y), dir: w ? w.dir || 'down' : 'down', m: 0, host: !F.session.visit, at: O.joinedAt, t: Date.now(),
    };
  };

  O.ensureChannel = function () {
    var topic = O.topicNow();
    if (topic && topic === O.topic) {
      if (O.chan) O.chan.track(O.myState());
      O.syncSprites();
      return;
    }
    O.leaveChannel();
    if (!topic) return;
    O.topic = topic;
    O.joinedAt = Date.now();
    O.seen = false;
    O.chan = F.Net.join(topic, O.myState(), { presence: O.onPresence, message: O.onMessage });
  };

  O.leaveChannel = function () {
    if (O.chan) {
      try { O.chan.leave(); } catch (e) { /* already gone */ }
    }
    O.chan = null;
    O.topic = '';
    O.others = {};
    O.syncSprites();
  };

  // Everything from the channel comes from other players: checked before it is used.
  var clean = function (p) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || p.id.length > 64) return null;
    var num = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(200 * T, v)) : 0; };
    return {
      id: p.id, name: L.cleanText(p.name, 24) || 'Farmer', look: p.look === 'girl' ? 'girl' : 'boy', map: MAPS[p.map] ? p.map : 'town',
      x: num(p.x), y: num(p.y), dir: DIRS[p.dir] ? p.dir : 'down', m: p.m ? 1 : 0, host: p.id === O.hostId(), at: Number(p.at) || 0,
      rt: 0, // when this phone last heard where they are (only this phone's clock orders updates)
    };
  };

  O.hostId = function () { return F.session.visit ? F.session.visit.host : O.me && O.me.id; };

  O.onPresence = function (list) {
    if (!O.chan) return;
    var before = O.others, now = {}, raw = [];
    (Array.isArray(list) ? list : []).forEach(function (p) {
      var q = clean(p);
      if (!q || q.id === O.me.id) return;
      raw.push(q);
      if (O.blocked[q.id]) return;
      var old = before[q.id];
      // a presence list can carry an older stop than the moves heard since: keep the fresher position
      if (old && old.rt && Date.now() - old.rt < 3000 && old.map === q.map) { q.x = old.x; q.y = old.y; q.dir = old.dir; q.m = old.m; q.rt = old.rt; }
      now[q.id] = q;
    });
    var v = F.session.visit;
    if (v && !O.seen && !L.visitorFits(raw, { id: O.me.id, at: Infinity }, v.host, ON.maxVisitors)) {
      O.leaveVisit('This farm is full right now (' + ON.maxVisitors + ' visitors). Try again in a little while!');
      return;
    }
    // the owner sees the first 8 visitors (more cannot stay)
    if (!v) {
      var keep = {};
      Object.keys(now).map(function (id) { return now[id]; }).sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); })
        .slice(0, ON.maxVisitors).forEach(function (q) { keep[q.id] = q; });
      now = keep;
    }
    var came = Object.keys(now).filter(function (id) { return !before[id]; }).map(function (id) { return now[id]; });
    var went = Object.keys(before).filter(function (id) { return !now[id]; }).map(function (id) { return before[id]; });
    O.others = now;
    if (came.length && O.chan) O.chan.track(O.myState()); // newcomers see where we are now, not where we last stopped
    var first = !O.seen;
    O.seen = true;
    if (F.ui && (came.length || went.length)) {
      var names = function (l) { return l.map(function (p) { return p.name; }).slice(0, 3).join(', ') + (l.length > 3 ? ' and ' + (l.length - 3) + ' more' : ''); };
      if (!v && came.length) { sfx('found'); F.ui.toast(names(came) + (came.length > 1 ? ' are' : ' is') + ' visiting your farm!', 3000, 0x2f5a22); }
      else if (v && came.length) {
        var host = came.filter(function (p) { return p.id === v.host; })[0], guests = came.filter(function (p) { return p.id !== v.host; });
        var msg = [];
        if (host) msg.push(host.name + ' is home! Say hi.');
        if (guests.length) msg.push(names(guests) + (first ? (guests.length > 1 ? ' are' : ' is') + ' visiting too.' : ' came to visit too.'));
        F.ui.toast(msg.join('\n'), 3000, 0x2f5a22);
      } else if (went.length && !first) F.ui.toast(names(went) + ' went home.', 2000);
    }
    O.syncSprites();
  };

  // A like or gift note from the same farmer at most once a minute (the server allows one a day anyway).
  var noted = {};
  var once = function (id, kind) {
    var k = id + ':' + kind, now = Date.now();
    if (noted[k] && now - noted[k] < 60000) return false;
    noted[k] = now;
    return true;
  };

  O.onMessage = function (event, payload) {
    var p = payload && typeof payload === 'object' ? payload : {};
    var who = typeof p.id === 'string' ? O.others[p.id] : null;
    if (!who) return;
    if (event === 'mv') {
      var q = clean(Object.assign({}, who, p, { id: who.id, name: who.name, look: who.look, at: who.at }));
      if (!q) return;
      q.rt = Date.now();
      var changedMap = q.map !== who.map;
      O.others[q.id] = q;
      if (changedMap) O.syncSprites();
    } else if (event === 'emote') {
      O.showEmote(who.id, p.k === 'heart' ? 'heart' : 'wave');
    } else if (event === 'like' && !F.session.visit && once(who.id, 'like')) {
      O.showEmote(who.id, 'heart');
      if (F.ui) F.ui.toast(who.name + ' liked your farm!', 2400, 0x2f5a22);
    } else if (event === 'gift' && !F.session.visit && once(who.id, 'gift')) {
      if (F.ui) F.ui.toast(who.name + ' left you a gift! Open Online, then Me, to collect it.', 3200, 0x7a4d12);
    }
  };

  O.send = function (event, payload) {
    if (O.chan) O.chan.send(event, Object.assign({ id: O.me.id }, payload || {}));
  };

  // ---------- the others' farmers, drawn on this map ----------
  var tagStyle = function (host) {
    return { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '84px', fontStyle: 'bold', color: host ? '#9fe8ff' : '#fff27a', stroke: '#3d2614', strokeThickness: 15 };
  };

  O.syncSprites = function () {
    var w = F.world;
    if (!w || !w.remotes || !w.sys || !w.sys.isActive()) return;
    var want = {};
    Object.keys(O.others).forEach(function (id) {
      var p = O.others[id];
      if (p.map === w.mapKey && w.mapKey !== 'town' && w.mapKey !== 'mine') want[id] = p;
    });
    Object.keys(w.remotes).forEach(function (id) {
      var r = w.remotes[id];
      if (want[id] && want[id].look === r.look) return;
      r.spr.destroy();
      r.shadow.destroy();
      r.tag.destroy();
      delete w.remotes[id];
    });
    Object.keys(want).forEach(function (id) {
      if (w.remotes[id]) return;
      var p = want[id], key = F.ensureTexture(w, p.look === 'girl' ? 'player_girl' : 'player');
      var r = { id: id, look: p.look, x: p.x, y: p.y, anim: '' };
      r.shadow = w.add.image(p.x, p.y + 16, 'fx-shadow').setDepth(DEPTH.shadow); // (made by the world scene)
      r.spr = w.add.sprite(p.x, p.y - FEET_OFFSET, key, IDLE_FRAME[p.dir]).setFlipX(p.dir === 'right').setDepth(DEPTH.actor + p.y / 1e5);
      r.tag = w.add.text(p.x, p.y - 1.45 * T, p.name + (p.host ? ' (owner)' : ''), tagStyle(p.host)).setOrigin(0.5, 1).setDepth(DEPTH.Above + 2);
      w.remotes[id] = r;
    });
  };

  O.showEmote = function (id, kind) {
    var w = F.world, at = null;
    if (!w || !w.remotes) return;
    if (id === (O.me && O.me.id)) at = w.feet();
    else if (w.remotes[id]) at = { x: w.remotes[id].x, y: w.remotes[id].y };
    if (!at) return;
    if (kind === 'heart') { w.emote({ x: at.x, y: at.y }, C.ICON.heart); return; }
    var t = w.add.text(at.x, at.y - 1.6 * T, 'Hi!', tagStyle(false)).setOrigin(0.5, 1).setDepth(DEPTH.Above + 3).setScale(1.3);
    w.tweens.add({ targets: t, y: t.y - 60, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: 2 });
    w.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: function () { t.destroy(); } });
  };

  // Each frame: the others glide to where they last said they were, and we tell them where we are.
  O.update = function (w, dt) {
    if (!w.remotes) return;
    var self = this;
    Object.keys(w.remotes).forEach(function (id) {
      var r = w.remotes[id], p = self.others[id];
      if (!p) return;
      var dx = p.x - r.x, dy = p.y - r.y, d = Math.sqrt(dx * dx + dy * dy), step = C.SPEED * 1.25 * dt / 1000;
      if (d > 6 * T || d <= step) { r.x = p.x; r.y = p.y; } else { r.x += dx / d * step; r.y += dy / d * step; }
      var moving = d > 8 || p.m, dir = p.dir;
      if (moving && d > 8) dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      var anim = moving ? 'walk-' + (dir === 'left' || dir === 'right' ? 'side' : dir) + (r.look === 'girl' ? '-g' : '') : '';
      if (anim !== r.anim) {
        r.anim = anim;
        if (anim) r.spr.anims.play(anim, true);
        else { r.spr.anims.stop(); r.spr.setFrame(IDLE_FRAME[dir]); }
      }
      F.depthTo(r.spr.setFlipX(dir === 'right').setPosition(r.x, r.y - FEET_OFFSET), DEPTH.actor + r.y / 1e5);
      r.shadow.setPosition(r.x, r.y + 16);
      r.tag.setPosition(r.x, r.y - 1.45 * T);
    });
    if (!this.chan || w.busy) return;
    // Nobody on this map to tell: no moves (only a change of map, so the others stop drawing us where we were).
    var alone = true;
    for (var k in this.others) { if (this.others[k].map === w.mapKey) { alone = false; break; } }
    if (alone && !(Object.keys(this.others).length && this.last && this.last.map !== w.mapKey)) return;
    var f = w.feet(), last = this.last, moved = !last || last.map !== w.mapKey || Math.abs(f.x - last.x) > 4 || Math.abs(f.y - last.y) > 4 || last.dir !== w.dir;
    this.mvMs -= dt;
    if (this.mvMs > 0) return;
    if (moved) {
      this.last = { x: f.x, y: f.y, dir: w.dir, map: w.mapKey, m: 1 };
      this.mvMs = ON.moveEvery;
      this.send('mv', { map: w.mapKey, x: Math.round(f.x), y: Math.round(f.y), dir: w.dir, m: 1, t: Date.now() });
    } else if (last && last.m) {
      last.m = 0; // stopped: say so, and leave our place in the presence list for anyone who joins later
      this.send('mv', { map: w.mapKey, x: Math.round(f.x), y: Math.round(f.y), dir: w.dir, m: 0, t: Date.now() });
      this.chan.track(this.myState());
    }
  };

  // ---------- visiting ----------
  O.visit = function (host) {
    if (!O.on || !F.world || F.world.busy || O.visiting) return Promise.resolve(false);
    if (host === O.me.id) { F.ui.toast('That is your own farm!'); return Promise.resolve(false); }
    F.ui.toast('Walking over...', 1500);
    O.visiting = true;
    var done = function (v) { O.visiting = false; return v; };
    return F.Net.rpc('farm_visit_v1', { p_host: host }).then(function (r) {
      if (!O.on || !F.world || F.world.busy) return false; // left online play (or the map is changing) meanwhile
      if (!r || !r.data) throw new Error('no such farm');
      var mine = F.session.state, st = L.visitState(r.data, mine);
      st.look = mine.look; // you look like yourself on their farm
      st.isVisit = true;
      F.session.visit = {
        host: String(r.id), name: L.cleanText(r.farm_name, 24) || 'Farmer', state: st, liked: !!r.liked, gift: r.gift || null,
        friend: !!r.friend, likes: Math.max(0, Number(r.likes) || 0), beauty: Math.max(0, Number(r.beauty) || 0),
      };
      F.session.riding = false;
      F.session.horseAt = null;
      O.leaveChannel(); // our own farm's news must not read as news about the farm we are walking to
      O.restartWorld();
      return true;
    }).catch(function (e) { F.ui.toast(errText(e)); return false; }).then(done);
  };

  O.leaveVisit = function (why) {
    if (!F.session.visit) return;
    F.session.visit = null;
    O.leaveChannel(); // now: until the farm reloads, that farm's news would read as news about ours
    if (F.ui && why) F.ui.toast(why, 3200);
    O.restartWorld();
  };

  // Fades out and rebuilds the world: on the visited farm, or back where you were in your own game.
  O.restartWorld = function () {
    var w = F.world;
    if (F.ui) F.ui.closeAll();
    F.Host.save(F.session.state);
    if (!w) return;
    w.busy = true;
    w.charge = null;
    if (w.player && w.player.body) w.player.body.setVelocity(0, 0);
    F.input.reset();
    sfx('door');
    w.cameras.main.fadeOut(250, 0, 0, 0);
    w.cameras.main.once('camerafadeoutcomplete', function () { w.scene.restart(); });
  };

  // ---------- the world while visiting: look, walk, wave; nothing else ----------
  var P = F.WorldScene.prototype;
  var visiting = function (w) { return !!(w.state && w.state.isVisit); };

  var create = P.create;
  P.create = function () {
    var v = F.session.visit;
    if (v) {
      var mine = F.session.state;
      F.session.state = v.state;
      try { create.call(this); } finally { F.session.state = mine; }
    } else {
      create.call(this);
    }
    this.remotes = {};
    O.last = null;
    O.mvMs = 0;
    if (O.on) O.ensureChannel();
    if (v && F.ui) F.ui.toast('Welcome to ' + v.name + '! Look around, wave, leave a like or a gift.', 3200, 0x2f5a22);
  };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.remotes) O.update(this, Math.min(delta, 100));
  };

  // On a visit only the clock runs (yours, for the time and your energy); your farm catches up when you get home.
  var tickClock = P.tickClock;
  P.tickClock = function (dt) {
    if (!visiting(this)) return tickClock.call(this, dt);
    this.clockMs += dt;
    if (this.clockMs < 1000) return false;
    this.clockMs = 0;
    var own = F.session.state, before = Math.floor(own.time);
    own.time = this.state.time = L.minuteOf(L.clock());
    L.regen(own);
    if (Math.floor(own.time) !== before) F.bus.emit('hud');
    return false;
  };

  // Saving while visiting saves your own game (anything you did in your bag or the menus), never the copy.
  var save = P.save;
  P.save = function () {
    if (!visiting(this)) return save.call(this);
    F.Host.save(F.session.state);
    F.session.dirty = false;
    this.saveMs = 0;
  };

  // Their farmhouse door works; the road to town takes you home.
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    if (visiting(this) && to !== 'farm' && to !== 'house') { O.leaveVisit(); return; }
    return travel.call(this, to, spawn, floor);
  };

  P.remoteAt = function (x, y) {
    var best = null, bestD = 0.9 * T, self = this;
    Object.keys(this.remotes || {}).forEach(function (id) {
      var r = self.remotes[id], d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD) { bestD = d; best = r; }
    });
    return best;
  };

  var resolve = P.resolve;
  P.resolve = function () {
    var pt = this.front(0.7), r = this.remoteAt(pt.x, pt.y);
    if (r) {
      var p = O.others[r.id];
      return { label: 'Wave', icon: C.ICON.heart, run: function () { O.wave(); if (p) F.ui.toast('You waved at ' + p.name + '.', 1600); } };
    }
    var a = resolve.call(this);
    if (!visiting(this) || !a) return a;
    var t = this.facing(), o = this.inMap(t.x, t.y) ? this.objectAt(t.x, t.y) : null;
    if (o && (o.type === 'warp' || o.type === 'sign')) return a;
    return { label: a.label, icon: a.icon, disabled: true, why: 'This is ' + F.session.visit.name + "'s farm: look, but don't touch! Wave, like or leave a gift instead." };
  };

  O.wave = function () {
    if (!O.me) return;
    O.send('emote', { k: 'wave' });
    O.showEmote(O.me.id, 'wave');
    sfx('talk');
  };

  // ---------- the UI ----------
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, GOLD = 0xe9a91c, GREY = 0xa08a68, RED = 0xc0503a, PINK = 0xd0587a;
  var U = F.UIScene.prototype;

  var uiCreate = U.create;
  U.create = function () {
    uiCreate.call(this);
    var self = this;
    O.start();
    this.onlineBtn = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.button(this.onlineBtn, W - 44, 152, 74, 30, 'Online', function () { self.openOnline('visit', 0); }, BLUE);
    this.visitBar = null;
    var show = function () { self.showOnline(); };
    F.bus.on('online', show);
    F.bus.on('map', show);
    this.events.once('shutdown', function () { F.bus.off('online', show); F.bus.off('map', show); });
    this.showOnline();
  };

  var checkQuests = U.checkQuests;
  U.checkQuests = function () {
    checkQuests.call(this);
    this.onlineBtn.setVisible(F.Net.available() && !this.decorating && !F.session.visit);
  };

  // The Online button, or (while visiting) the bar with Like, Gift, Wave and Home.
  U.showOnline = function () {
    var self = this, v = F.session.visit;
    this.onlineBtn.setVisible(F.Net.available() && !this.decorating && !v);
    if (this.decorBtn && v) this.decorBtn.setVisible(false);
    if (this.visitBar) { this.visitBar.destroy(); this.visitBar = null; }
    if (!v) return;
    var c = this.visitBar = this.add.container(0, 0).setDepth(40);
    this.baked(c, 8, 136, 'ui-visitbar', W - 16, 58, function (g) {
      g.fillStyle(0x3d2614, 0.82).fillRoundedRect(0, 0, W - 16, 58, 12);
    });
    c.add(this.txt(W / 2, 140, 'Visiting ' + v.name, 12, '#ffe9a8', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var bw = 62, list = [['Like', PINK, function () { self.likeFarm(); }], ['Gift', GOLD, function () { self.giftFarm(); }], ['Wave', BLUE, function () { O.wave(); }],
      ['More', GREY, function () { self.playerMenu(v.host, v.name); }], ['Home', GREEN, function () { O.leaveVisit(); }]];
    list.forEach(function (b, i) { self.button(c, W / 2 + (i - (list.length - 1) / 2) * (bw + 5), 174, bw, 30, b[0], b[2], b[1]); });
  };

  U.likeFarm = function () {
    var self = this, v = F.session.visit;
    if (!v) return;
    if (v.liked) return this.toast('You already liked this farm today.');
    F.Net.rpc('farm_like_v1', { p_host: v.host }).then(function (ok) {
      v.liked = true;
      if (!ok) return self.toast('You already liked this farm today.');
      sfx('found');
      O.send('like', {});
      O.showEmote(O.me.id, 'heart');
      self.toast('You liked ' + v.name + "'s farm!", 2200, 0x2f5a22);
    }).catch(function (e) { self.toast(errText(e)); });
  };

  U.giftFarm = function () {
    var self = this, v = F.session.visit;
    if (!v) return;
    if (v.gift) return this.toast('You already left a gift here today.');
    var give = function (kind) {
      F.Net.rpc('farm_gift_v1', { p_host: v.host, p_gift: kind }).then(function (r) {
        if (r === 'ok') {
          v.gift = kind;
          sfx('coin');
          O.send('gift', { g: kind });
          self.toast('You left ' + v.name + ' a ' + (kind === 'star' ? 'Sunbeam' : ON.giftGold + 'G') + ' gift!', 2400, 0x7a4d12);
        } else if (r === 'limit') {
          self.toast(kind === 'star' ? 'You can give one Sunbeam gift a day. Try a gold gift!' : 'You have given all 5 gold gifts for today.');
        } else if (r === 'already') {
          v.gift = kind;
          self.toast('You already left a gift here today.');
        } else self.toast('That gift could not be sent.');
      }).catch(function (e) { self.toast(errText(e)); });
    };
    this.dialog('LEAVE A GIFT\nGifts are free to give! ' + v.name + ' collects them next time they play.', [
      { label: ON.giftGold + 'G', color: GOLD, cb: function () { give('gold'); } },
      { label: '1 Sunbeam', color: BLUE, cb: function () { give('star'); } },
    ], {
      rows: [[C.ICON.gift, 'LEAVE A GIFT'], [C.ICON.coin, 'Gold gift: they get ' + ON.giftGold + 'G. Up to 5 farms a day.'], [C.ICON.sunbeam, 'Sunbeam gift: they get 1 Sunbeam. Once a day.']],
    });
  };

  // ---------- typing: a real text box over the game ----------
  // opts: { password, hint, ok }. done(text) gets the text, or nothing if cancelled.
  U.askText = function (title, value, max, done, opts) {
    opts = opts || {};
    var self = this, closed = false, modal;
    var box = document.createElement('div');
    box.id = 'farm-ask';
    box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:24vh;z-index:20;font-family:"Trebuchet MS",Verdana,sans-serif;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#f6e3b4;border:3px solid #3d2614;border-radius:14px;padding:14px;width:min(300px,86vw);box-shadow:0 6px 0 rgba(30,16,6,.35);';
    var label = document.createElement('div');
    label.textContent = title;
    label.style.cssText = 'font-weight:bold;color:#3d2614;font-size:16px;margin-bottom:8px;text-align:center;';
    var input = document.createElement('input');
    input.type = opts.password ? 'password' : opts.email ? 'email' : 'text';
    input.maxLength = max;
    input.value = value || '';
    input.autocomplete = opts.password ? 'current-password' : opts.email ? 'email' : 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;font-size:17px;padding:9px 10px;border:2px solid #9a7a4a;border-radius:9px;background:#fffaf0;color:#3d2614;';
    var hint = document.createElement('div');
    hint.textContent = opts.hint || '';
    hint.style.cssText = 'font-size:12px;color:#6a4a2a;margin-top:6px;text-align:center;';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-top:12px;';
    var mk = function (text, bg, cb) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.style.cssText = 'flex:1;font:bold 16px "Trebuchet MS",Verdana,sans-serif;color:#fff;background:' + bg + ';border:2px solid #3d2614;border-radius:10px;padding:9px 0;text-shadow:0 1px 0 #3d2614;';
      b.addEventListener('click', cb);
      row.appendChild(b);
      return b;
    };
    var close = function (v) {
      if (closed) return;
      closed = true;
      if (box.parentNode) box.parentNode.removeChild(box);
      if (self.modals.length && self.modals[self.modals.length - 1].c === modal) self.closeModal();
      if (v != null) done(v);
    };
    mk('Cancel', '#c0703a', function () { close(null); });
    mk(opts.ok || 'OK', '#5fa84a', function () { close(input.value); });
    // keys typed here are for the box, not the game
    ['keydown', 'keyup', 'keypress'].forEach(function (k) { input.addEventListener(k, function (e) { e.stopPropagation(); }); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') close(input.value);
      else if (e.key === 'Escape') close(null);
    });
    card.appendChild(label);
    card.appendChild(input);
    if (opts.hint) card.appendChild(hint);
    card.appendChild(row);
    box.appendChild(card);
    modal = this.openModal(function () { close(null); });
    document.body.appendChild(box);
    setTimeout(function () { input.focus(); }, 0);
    return { close: close };
  };

  // ---------- the Online panel: Visit, Friends, Ranks, Me ----------
  var TABS = [['visit', 'Visit'], ['friends', 'Friends'], ['ranks', 'Ranks'], ['me', 'Me']];
  var KINDS = { visit: [['popular', 'Most beautiful'], ['recent', 'Just updated'], ['friends', 'Friends'], ['following', 'People you follow']], ranks: [['beauty', 'Home Beauty'], ['earned', 'Gold earned'], ['quests', 'Daily quests done']] };
  var nextKind = function (tab, k) {
    var l = KINDS[tab], i = l.map(function (x) { return x[0]; }).indexOf(k);
    return l[(i + 1) % l.length][0];
  };
  var kindName = function (tab, k) { return KINDS[tab].filter(function (x) { return x[0] === k; })[0][1]; };
  var name = function (n) { return L.cleanText(n, 24) || 'Farmer'; };

  // then(): runs once the panel is up (a toast shown before it would be hidden by the panel)
  U.openOnline = function (tab, page, then) {
    var self = this;
    if (!F.Net.available()) return this.dialog('ONLINE PLAY\nOpen Harvest Ville from the Selebox app to visit other farms, make friends and climb the leaderboards!');
    if (!O.on) return this.joinPanel(tab, page, then);
    if (!F.session.state.net.named) return this.firstName(function () { self.openOnline(tab, page, then); });
    this.onlineKind = this.onlineKind || { visit: 'popular', ranks: 'beauty' };
    var o = { title: 'Online', tab: tab, page: page, tabs: TABS, reopen: function (t, p) { self.openOnline(t, p); } };
    var show = function (rows, sub, empty) {
      o.rows = rows;
      o.sub = function () { return sub; };
      o.empty = empty;
      self.listPanel(o);
      if (then) then();
    };
    var fail = function (e) { self.toast(errText(e)); };
    // Report or block a player, then come back to this tab.
    var more = function (id, n, back) {
      return { label: 'More', color: GREY, cb: function () { self.closeModal(); self.playerMenu(id, n, function (then) { self.openOnline(back, 0, then); }); } };
    };
    var kindRow = function (t) {
      var k = self.onlineKind[t];
      return {
        icon: t === 'visit' ? C.ICON.sparkle : C.ICON.ribbon, name: 'Showing: ' + kindName(t, k), desc: 'Tap Change to see another list.',
        buttons: [{ label: 'Change', color: GREY, cb: function () { self.onlineKind[t] = nextKind(t, k); self.closeModal(); self.openOnline(t, 0); } }],
      };
    };
    if (tab === 'visit') {
      F.Net.rpc('farm_list_v1', { p_kind: this.onlineKind.visit, p_limit: 30 }).then(function (list) {
        var rows = [kindRow('visit')].concat((list || []).map(function (f) {
          return {
            icon: C.ICON.spring, name: name(f.farm_name), online: !!f.online,
            desc: 'Beauty ' + (Number(f.beauty) || 0) + ', house level ' + (Number(f.house_level) || 1) + ', ' + (Number(f.likes_week) || 0) + ' likes this week.',
            buttons: [{ label: 'Visit', cb: function () { O.visit(String(f.id)); } }, more(String(f.id), name(f.farm_name), 'visit')],
          };
        }));
        show(rows, 'Walk around, wave, leave a like or a gift.', null);
      }).catch(fail);
    } else if (tab === 'friends') {
      F.Net.rpc('farm_friends_v1', {}).then(function (list) {
        var rows = [{
          icon: C.ICON.letter, name: 'Your code: ' + O.me.code, desc: 'Give your code to a friend, or add theirs.',
          buttons: [{ label: 'Add', cb: function () { self.addFriend(); } }],
        }];
        (list || []).forEach(function (f) {
          var id = String(f.id), n = name(f.farm_name), unread = Number(f.unread) || 0;
          var answer = function (yes) {
            return function () {
              F.Net.rpc('farm_friend_answer_v1', { p_other: id, p_accept: yes }).then(function (r) {
                self.closeModal();
                self.openOnline('friends', 0, function () { self.toast(r === 'friends' ? 'You and ' + n + ' are friends now!' : 'Removed.', 2200, r === 'friends' ? 0x2f5a22 : undefined); });
              }).catch(fail);
            };
          };
          if (f.status === 'request') rows.push({ icon: C.ICON.heart, name: n, desc: 'Wants to be your friend.', buttons: [{ label: 'Accept', cb: answer(true) }, { label: 'No', color: RED, cb: answer(false) }] });
          else if (f.status === 'sent') rows.push({ icon: C.ICON.heart, name: n, desc: 'Request sent. Waiting for them to accept.', buttons: [{ label: 'Cancel', color: GREY, cb: answer(false) }] });
          else {
            rows.push({
              icon: C.ICON.heart, name: n, online: !!f.online,
              desc: unread ? unread + ' new message' + (unread > 1 ? 's' : '') + '!' : f.via === 'selebox' ? 'You follow each other on Selebox.' : 'Your friend.',
              buttons: [{ label: unread ? 'Chat (' + unread + ')' : 'Chat', color: BLUE, cb: function () { self.closeModal(); self.openChat(id, n); } }, { label: 'Visit', cb: function () { O.visit(id); } }],
            });
          }
        });
        show(rows, 'Friends visit and write. So do people you follow back on Selebox.', null);
      }).catch(fail);
    } else if (tab === 'ranks') {
      var k = this.onlineKind.ranks;
      F.Net.rpc('farm_leaderboard_v1', { p_kind: k }).then(function (list) {
        var rows = [kindRow('ranks')].concat((list || []).map(function (r) {
          var mine = !!r.me, rk = Number(r.rank) || 0;
          var prize = rk >= 1 && rk <= 10 ? { gold: [5000, 3000, 2000][rk - 1] || 1000, stars: [5, 3, 2][rk - 1] || 1 } : null;
          return {
            reward: prize, rewardPrefix: prize ? 'Prize' : null,
            icon: C.ICON.ribbon, name: '#' + (Number(r.rank) || 0) + ' ' + name(r.farm_name) + (mine ? ' (you)' : ''),
            desc: kindName('ranks', k) + ': ' + (Number(r.score) || 0) + (k === 'earned' ? 'G' : '') + ' this week.',
            buttons: mine ? [] : [{ label: 'Visit', cb: function () { O.visit(String(r.id)); } }, more(String(r.id), name(r.farm_name), 'ranks')],
          };
        }));
        show(rows, 'Top 10 win prizes every Monday!', null);
      }).catch(fail);
    } else {
      var me = O.me;
      show([
        {
          icon: C.ICON.tag, name: 'Farm: ' + me.name, desc: 'The name others see.',
          buttons: [{ label: 'Rename', cb: function () { self.renameFarm(); } }].concat(self.shareButtons ? self.shareButtons() : []),
        },
        { icon: C.ICON.gift, name: 'Gifts from visitors', desc: 'Gifts your visitors left you.', reward: { gold: ON.giftGold, stars: 1 }, rewardPrefix: 'Each gift', buttons: [{ label: 'Collect', color: GOLD, cb: function () { O.collect(false); } }] },
        { icon: C.ICON.letter, name: 'Who came by', desc: 'Visitors in the last 7 days.', buttons: [{ label: 'See', color: BLUE, cb: function () { self.closeModal(); self.openVisitors(); } }] },
        {
          icon: C.ICON.sparkle, name: me.listed ? 'Farm shown in lists' : 'Farm hidden',
          desc: me.listed ? 'Anyone can find and visit it.' : 'Only friends can visit it.',
          buttons: [{ label: me.listed ? 'Hide' : 'Show', color: GREY, cb: function () { self.setListed(!me.listed); } },
            { label: 'Blocked', color: GREY, cb: function () { self.closeModal(); self.openBlocked(); } }],
        },
        {
          icon: C.ICON.exclaim, name: 'Leave online play', desc: 'Deletes your online farm, friends and messages.',
          buttons: [{ label: 'Leave', color: RED, cb: function () { self.leaveOnline(); } }],
        },
      ].concat(self.meExtras ? self.meExtras() : []), 'Your friend code: ' + me.code, null);
    }
  };

  // Not online: joining (again, after leaving), or still connecting.
  U.joinPanel = function (tab, page, then) {
    var self = this, s = F.session.state;
    var join = function () {
      s.net.off = 0;
      F.Host.save(s);
      self.toast('Connecting...', 1500);
      O.connect().then(function (me) {
        if (me) self.openOnline(tab, page, then);
      }).catch(function (e) { self.toast(errText(e)); });
    };
    if (!s.net.off) return join(); // it did not connect at the start: try again
    this.dialog('PLAY ONLINE\nVisit other farms and see who is there, leave likes and gifts, make friends and climb the weekly ranks.\n\n' +
      'Others can visit your farm: your house, furniture, yard, crops and animals. Your bag and gold stay private.',
    [{ label: 'Not now', color: GREY }, { label: 'Join', cb: join }]);
  };

  // The first time the Online panel opens: name the farm (it starts as your Selebox name).
  U.firstName = function (done) {
    var s = F.session.state, self = this;
    this.askText('Name your farm', O.me.name, 24, function (n) {
      s.net.named = 1;
      F.Host.save(s);
      n = L.cleanText(n, 24);
      if (!n || n === O.me.name) return done();
      F.Net.rpc('farm_join_v1', { p_farm_name: n }).then(function (r) {
        O.me.name = L.cleanText(r && r.farm_name, 24) || n;
        s.net.name = O.me.name;
        F.Host.save(s);
        if (O.chan) O.chan.track(O.myState());
        done();
      }).catch(function (e) { self.toast(errText(e)); });
    }, { hint: 'Others see this name. You can change it later.' });
  };

  U.renameFarm = function () {
    var self = this;
    this.askText('Rename your farm', O.me.name, 24, function (n) {
      n = L.cleanText(n, 24);
      if (n && n !== O.me.name) self.saveName(n);
    });
  };

  U.saveName = function (n) {
    var self = this;
    F.Net.rpc('farm_join_v1', { p_farm_name: n }).then(function (r) {
      O.me.name = L.cleanText(r && r.farm_name, 24) || n;
      F.session.state.net.name = O.me.name;
      F.Host.save(F.session.state);
      if (O.chan) O.chan.track(O.myState());
      var said = function () { self.toast('Your farm is called ' + O.me.name + '.', 2200, 0x2f5a22); };
      if (self.modals.length) { self.closeModal(); self.openOnline('me', 0, said); } else said();
    }).catch(function (e) { self.toast(errText(e)); });
  };

  U.setListed = function (yes) {
    var self = this;
    F.Net.rpc('farm_set_listed_v1', { p_listed: yes }).then(function () {
      O.me.listed = yes;
      self.closeModal();
      self.openOnline('me', 0, function () { self.toast(yes ? 'Anyone can find your farm now.' : 'Your farm is hidden. Friends can still visit.'); });
    }).catch(function (e) { self.toast(errText(e)); });
  };

  U.leaveOnline = function () {
    var self = this;
    this.confirm('LEAVE ONLINE PLAY?\nYour online farm, likes, friends and messages are deleted. Your game itself stays.', function () {
      F.Net.rpc('farm_leave_v1', {}).then(function () {
        var s = F.session.state;
        s.net = L.newNet();
        s.net.off = 1; // until you join again from the Online panel
        F.Host.save(s);
        self.closeAll();
        O.disconnect();
        self.toast('You left online play. Join again any time from the Online button.');
      }).catch(function (e) { self.toast(errText(e)); });
    });
  };

  U.addFriend = function () {
    var self = this;
    this.askText("Your friend's code", '', 8, function (code) {
      code = code.replace(/\s+/g, '').toUpperCase();
      if (!code) return;
      F.Net.rpc('farm_friend_add_v1', { p_code: code }).then(function (r) {
        var say = { requested: 'Friend request sent!', friends: 'You are friends now!', already: 'You are already friends.', waiting: 'Still waiting for them to accept.', nocode: 'No farm has that code.', self: 'That is your own code!', limit: 'Your friends list is full.' }[r] || 'That did not work.';
        self.closeAll();
        self.openOnline('friends', 0, function () { self.toast(say, 2400, r === 'requested' || r === 'friends' ? 0x2f5a22 : undefined); });
      }).catch(function (e) { self.toast(errText(e)); });
    }, { hint: '8 letters and numbers, from their Online panel.' });
  };

  U.openVisitors = function (then) {
    var self = this;
    F.Net.rpc('farm_visitors_v1', {}).then(function (list) {
      var rows = (list || []).map(function (v) {
        var extra = [v.liked ? 'liked your farm' : '', v.gift ? 'left a ' + (v.gift === 'star' ? 'Sunbeam' : 'gold') + ' gift' : ''].filter(Boolean).join(' and ');
        var id = String(v.id), n = name(v.farm_name);
        return {
          icon: v.gift ? C.ICON.gift : v.liked ? C.ICON.heart : C.ICON.letter, name: n, desc: 'Came on ' + String(v.day || '').slice(0, 10) + (extra ? ', ' + extra : '') + '.',
          buttons: [{ label: 'More', color: GREY, cb: function () { self.closeModal(); self.playerMenu(id, n, function (then) { self.openVisitors(then); }); } }],
        };
      });
      self.listPanel({ title: 'Who came by', rows: rows, page: 0, reopen: function () { self.closeModal(); self.openVisitors(); }, sub: function () { return 'The last 7 days.'; }, empty: 'No visitors yet.\nShare your friend code!' });
      if (then) then();
    }).catch(function (e) { self.toast(errText(e)); });
  };

  // A conversation with a friend: the latest messages, newest at the bottom.
  U.openChat = function (id, who, then) {
    var self = this;
    F.Net.rpc('farm_messages_v1', { p_with: id }).then(function (list) {
      var c = self.openModal(function () { self.closeModal(); self.openOnline('friends', 0); });
      self.panelImg(c, 12, 66, W - 24, 540);
      c.add(self.txt(W / 2, 82, who, 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
      self.button(c, W - 48, 96, 46, 34, 'X', function () { self.closeModal(); }, RED);
      self.button(c, 52, 96, 62, 34, 'More', function () {
        self.closeModal();
        self.playerMenu(id, who, function (then) { if (O.blocked[id]) self.openOnline('friends', 0, then); else self.openChat(id, who, then); });
      }, GREY);
      var top = 128, bottom = 540, y = bottom, shown = 0;
      (list || []).some(function (m) { // newest first: stack upwards until the panel is full
        var mine = !!m.mine, t = self.txt(mine ? W - 34 : 34, 0, L.cleanText(m.body, 200), 13, mine ? '#1f4a7a' : INK, { wordWrap: { width: 220 }, align: mine ? 'right' : 'left', lineSpacing: 2 }).setOrigin(mine ? 1 : 0, 1);
        var h = t.height + 18;
        if (y - h < top) { t.destroy(); return true; }
        var bg = self.add.rectangle(mine ? W - 26 : 26, y + 2, t.width + 16, t.height + 10, mine ? 0xbfdcf5 : 0xe8cf98).setOrigin(mine ? 1 : 0, 1);
        t.setY(y - 3);
        c.add([bg, t]);
        y -= h;
        shown++;
        return false;
      });
      if (!shown) c.add(self.txt(W / 2, 300, 'No messages yet. Say hello!', 15, INK).setOrigin(0.5));
      if (then) then();
      self.button(c, W / 2 - 70, 572, 120, 38, 'Back', function () { self.closeModal(); self.openOnline('friends', 0); }, GREY);
      self.button(c, W / 2 + 70, 572, 120, 38, 'Write', function () {
        self.askText('Message to ' + who, '', 200, function (body) {
          body = L.cleanText(body, 200);
          if (!body) return;
          F.Net.rpc('farm_message_send_v1', { p_to: id, p_body: body }).then(function (r) {
            if (r !== 'ok') return self.toast(r === 'limit' ? 'That is 50 messages today. More tomorrow!' : r === 'word' ? 'Please keep it kind: that message has a word that is not allowed.' : 'That message could not be sent.');
            self.closeModal();
            self.openChat(id, who);
          }).catch(function (e) { self.toast(errText(e)); });
        }, { ok: 'Send' });
      }, BLUE);
    }).catch(function (e) { self.toast(errText(e)); });
  };

  // ---------- keeping it friendly: report and block ----------
  // A player's options, from the lists, a chat or a visit. back(): where to go after an action (optional).
  U.playerMenu = function (id, who, back) {
    var self = this, blocked = !!O.blocked[id];
    this.listPanel({
      title: who, page: 0, sub: function () { return 'Keep Harvest Ville friendly.'; },
      reopen: function () { self.closeModal(); self.playerMenu(id, who, back); },
      rows: [
        {
          icon: C.ICON.exclaim, name: 'Report', desc: 'A rude farm name or messages? Tell Selebox.',
          buttons: [{ label: 'Report', color: RED, cb: function () { self.closeModal(); self.reportPlayer(id, who, back); } }],
        },
        {
          icon: C.ICON.exclaim, name: blocked ? 'Unblock' : 'Block',
          desc: blocked ? 'Let them find, visit and message you again.' : "They can't visit, find or message you, and you won't see them.",
          buttons: [{ label: blocked ? 'Unblock' : 'Block', color: blocked ? GREY : RED, cb: function () { self.closeModal(); self.blockPlayer(id, who, !blocked, back); } }],
        },
      ],
    });
  };

  U.reportPlayer = function (id, who, back) {
    var self = this;
    var send = function (reason, note) {
      F.Net.rpc('farm_report_v1', { p_target: id, p_reason: reason, p_note: note || null }).then(function (r) {
        var say = function (text, color) { var show = function () { self.toast(text, 2600, color); }; if (back) back(show); else show(); };
        if (r !== 'ok') return say({ already: 'You already reported ' + who + ' today.', limit: 'That is a lot of reports today. Try again tomorrow.' }[r] || 'That report could not be sent.');
        if (O.blocked[id]) return say('Thank you. Selebox will take a look.', 0x2f5a22);
        self.dialog('REPORT SENT\nThank you. Selebox will take a look.\n\nDo you also want to block ' + who + '?', [
          { label: 'Not now', color: GREY, cb: function () { if (back) back(); } },
          { label: 'Block', color: RED, cb: function () { self.blockPlayer(id, who, true, back); } },
        ]);
      }).catch(function (e) { self.toast(errText(e)); });
    };
    var pick = function (reason) { return function () { self.closeModal(); send(reason); }; };
    this.listPanel({
      title: 'Report ' + who, page: 0, sub: function () { return 'What is wrong?'; },
      reopen: function () { self.closeModal(); self.reportPlayer(id, who, back); },
      rows: [
        { icon: C.ICON.tag, name: 'Rude farm name', desc: 'The name others see is not okay.', buttons: [{ label: 'Report', color: RED, cb: pick('name') }] },
        { icon: C.ICON.letter, name: 'Rude messages', desc: 'Their messages to you are not okay. Selebox sees the last ones.', buttons: [{ label: 'Report', color: RED, cb: pick('messages') }] },
        {
          icon: C.ICON.exclaim, name: 'Something else', desc: 'Tell Selebox in a few words.',
          buttons: [{ label: 'Write', color: RED, cb: function () {
            self.closeModal();
            self.askText('What happened?', '', 200, function (t) { send('other', L.cleanText(t, 200)); }, { ok: 'Send' });
          } }],
        },
      ],
    });
  };

  U.blockPlayer = function (id, who, yes, back) {
    var self = this;
    var go = function () {
      F.Net.rpc('farm_block_v1', { p_other: id, p_block: yes }).then(function (r) {
        if (r === 'blocked') {
          O.blocked[id] = who;
          delete O.others[id];
          O.syncSprites();
        } else if (r === 'unblocked') delete O.blocked[id];
        var show = function () { self.toast({ blocked: who + ' is blocked.', unblocked: who + ' is unblocked.', limit: 'Your blocked list is full.' }[r] || 'That did not work.', 2400); };
        if (r === 'blocked' && F.session.visit && F.session.visit.host === id) return O.leaveVisit(who + ' is blocked.');
        if (back) back(show); else show();
      }).catch(function (e) { self.toast(errText(e)); });
    };
    if (!yes) return go();
    this.confirm('BLOCK THIS FARMER?\n' + who + " won't be able to visit or find your farm, message you or add you as a friend, and you won't see them on farms. If you are friends, that ends too.", go);
  };

  U.openBlocked = function (then) {
    var self = this;
    F.Net.rpc('farm_blocked_v1', {}).then(function (list) {
      O.blocked = {};
      var rows = (list || []).map(function (b) {
        var id = String(b.id), n = name(b.farm_name);
        O.blocked[id] = n;
        return { icon: C.ICON.exclaim, name: n, desc: 'Blocked.', buttons: [{ label: 'Unblock', color: GREY, cb: function () { self.closeModal(); self.blockPlayer(id, n, false, function (then) { self.openBlocked(then); }); } }] };
      });
      self.listPanel({ title: 'Blocked farms', rows: rows, page: 0, reopen: function () { self.closeModal(); self.openBlocked(); }, sub: function () { return 'They cannot reach you.'; }, empty: 'Nobody is blocked.' });
      if (then) then();
    }).catch(function (e) { self.toast(errText(e)); });
  };

  // The app going to the background puts the game to sleep: leave the live channel (visitors would see a frozen
  // farmer holding a place), and join again on waking.
  var sleep = window.__gameSleep;
  window.__gameSleep = function (sleeping) {
    var was = F.Host.sleeping;
    sleep(sleeping);
    if (!O.on || !!sleeping === was) return;
    if (sleeping) O.leaveChannel();
    else O.ensureChannel();
  };

  // Decorate mode hides the Online button too
  var openDecor = U.openDecor;
  U.openDecor = function () {
    if (F.session.visit) return this.toast("You can only decorate your own farm.");
    openDecor.call(this);
    this.onlineBtn.setVisible(false);
  };

  void H;
})(window.Farm = window.Farm || {});
