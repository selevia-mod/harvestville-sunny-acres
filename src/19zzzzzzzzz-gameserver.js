// The game server, the phone's side (owner, 7 Nov 2026: "seamless, like other online games"; the contract is
// docs/game-server.md). Step 1 is the caves only: Bakunawa's Lair and every hunting place's dungeon (F.dungeonOf).
// With friends, one phone ran a floor's monsters and told the others through Supabase, one message at a time through
// the app (19v-wild.js: wildTell, wildHear, wildCopy; 'wa', 'wh', 'wd', 'wb'), so everyone else saw them late and
// jumpy. Now, when the app gives the server's address (window.gameHost.gs), the game page opens its own WebSocket to it
// on a cave floor, and the server runs that floor's monsters for everyone on it, your own phone too:
// - the monsters are drawn as a friend's were, a moment behind (about 100 ms, between two of the server's ticks);
// - your hit shows at once (the flash, the dust, the bar drops by your damage), and the server's 'hp' puts it right
//   a moment later; the puff comes with its 'dn', and only a phone named in its 'by' gets the drops, as before;
// - a charge that reaches you comes as 'bp'; the gate down opens on 'cl';
// - the others' farmers on the floor walk where the server says (Supabase still says who is here, and their names).
// While it runs a floor, this phone runs none of that floor's monsters itself and sends and hears no 'wa', 'wh', 'wd' or
// 'wb' for it (friends' arrows in flight, 'ar', and bait, 'bt', stay on Supabase as before). A line that drops is
// opened again at once, then after 1, 2 and 4 s; its 'wl' is the whole floor again.
// No answer within 3 s, a 'no', or a line that cannot be opened again: the floor plays the old way, as before.
// Without window.gameHost.gs none of this runs and nothing in the game changes.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var WI = C.WILD;
  var P = F.WorldScene.prototype;
  var O = F.Online;
  var GS = {
    wait: 3000, // no 'wl' by then: the old way
    retry: [0, 1000, 2000, 4000], // a dropped line: opened again at once, then after these
    mvEvery: 100, // at most 10 moves a second while you walk
    piEvery: 2000, // how often the round trip is measured
    delay: 100, // monsters and friends are drawn this far behind the server (L.trailAt)
    every: 50, // the server's tick
    ahead: 100, // a tick that comes late: they keep going this long on their own
    pendMs: 1500, // a hit of yours the server never answered stops counting after this
  };
  var OLD = { wa: 1, wh: 1, wd: 1, wb: 1 }; // the old relay's monster messages
  var DIRS = { down: 1, up: 1, left: 1, right: 1 };
  var MOST = 400 * T;
  var gen = 0;
  var gs = null; // this floor's session: { w, gen, mode: 'connecting' | 'live' | 'retry' | 'off', ws, ... }

  var url = function () {
    var u = window.gameHost && window.gameHost.gs;
    return typeof u === 'string' && /^wss?:\/\/./.test(u) ? u : null;
  };
  var num = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(MOST, v)) : null; };
  // the session running this world's floor right now (also while it is connecting or getting its line back)
  var menu = function () { return F.ui && F.ui.blocking && F.ui.blocking() ? 1 : 0; };
  var holding = function (w) { return gs && !gs.dead && w && gs.w === w && gs.gen === w.gsGen && gs.mode !== 'off' ? gs : null; };
  var live = function () { return gs && !gs.dead && gs.mode === 'live' && gs.ws && gs.ws.readyState === 1 ? gs : null; };
  var send = function (g, m) {
    if (!g || g.dead || !g.ws || g.ws.readyState !== 1) return false;
    try { g.ws.send(JSON.stringify(m)); g.sent++; return true; } catch (e) { return false; }
  };

  // ---------- a floor's session ----------
  var start = function (w) {
    gs = {
      w: w, gen: w.gsGen, url: url(), map: w.mapKey, floor: O.floorHere(w.mapKey), topic: O.topic || O.topicNow(), mode: 'connecting',
      ws: null, attempt: 0, tries: 0, everLive: false, you: '', n: 0, sent: 0, got: 0, connects: 0, rtt: null, ppl: {},
      mvMs: 0, piMs: 0, lastMv: null, waitT: null, retryT: null, sn: null, why: '',
    };
    // Who runs a floor the old way is whoever came first (L.wildLead, by sn): a phone on the server says it has no sn, so a
    // friend still playing the old way (a 9th, or one the server refused) never waits on monsters this phone no longer sends.
    gs.sn = O.mapAt;
    O.mapAt = 0;
    if (O.retrack && O.chan) O.retrack();
    attempt(gs);
    return gs;
  };

  var closeSocket = function (g) {
    var ws = g.ws;
    g.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) { /* already shut */ }
  };
  var clearTimers = function (g) {
    clearTimeout(g.waitT);
    clearTimeout(g.retryT);
    g.waitT = g.retryT = null;
  };
  // the friends drawn from the server go back to what Supabase says of them
  var dropTrails = function (g) {
    Object.keys(O.trails || {}).forEach(function (id) { if (O.trails[id] && O.trails[id].gs) delete O.trails[id]; });
    g.ppl = {};
  };
  var restoreSn = function (g, quiet) {
    if (g.sn != null && !O.mapAt) O.mapAt = g.sn;
    g.sn = null;
    if (!quiet && O.on && O.chan && O.retrack) O.retrack();
  };

  // One try at the line: the token first, then the socket and 'hi'; a 'wl' within 3 s, or this try failed.
  var attempt = function (g) {
    if (g.dead || g.mode === 'off') return;
    var my = ++g.attempt;
    clearTimeout(g.waitT);
    g.waitT = setTimeout(function () { if (g.attempt === my && g.ok !== my) fail(g, 'slow'); }, GS.wait);
    F.Net.token().then(function (token) {
      if (g.dead || g.attempt !== my || g.failed === my || g.mode === 'off') return;
      if (!token) return fail(g, 'token', true);
      var ws;
      try { ws = new WebSocket(g.url); } catch (e) { return fail(g, 'socket'); }
      g.ws = ws;
      g.connects++;
      ws.onopen = function () {
        var w = g.w, s = F.session.state, f = w.feet();
        send(g, { t: 'hi', v: 1, token: token, topic: g.topic, map: g.map, floor: g.floor, name: O.myName(), look: s.look === 'girl' ? 'girl' : 'boy',
          x: Math.round(f.x), y: Math.round(f.y), dir: w.dir || 'down', hg: L.gearBits ? L.gearBits(s) : 0, sk: L.power(s, 'sneak') ? 1 : 0,
          b: menu(), bk: L.bakunawaReady && L.bakunawaReady(s) ? 1 : 0 }); // (b: a menu open, the monsters leave you be; bk: the Bakunawa may rise for you today)
        g.lastMv = null;
        g.piMs = 0;
      };
      ws.onmessage = function (e) {
        if (g.ws !== ws) return;
        var m = null;
        try { m = JSON.parse(e.data); } catch (x) { return; }
        if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
        g.got++;
        hear(g, m, my);
      };
      // (4010-4013: the server refused this phone, after its 'no'; anything else: the line dropped)
      ws.onclose = ws.onerror = function (e) {
        if (g.ws !== ws) return;
        var refused = !!(e && e.code >= 4010 && e.code <= 4013);
        fail(g, refused ? 'refused:' + e.code : 'closed', refused);
      };
    }, function () { if (g.attempt === my) fail(g, 'token', true); });
  };

  // A try went wrong. Never live on this floor yet (or refused): the old way. Live until now: back at once, then after 1,
  // 2 and 4 s; still nothing, the old way.
  var fail = function (g, why, final) {
    g.failed = g.attempt;
    closeSocket(g);
    clearTimeout(g.waitT);
    g.waitT = null;
    if (g.dead || g.mode === 'off') return;
    g.why = why;
    if (final || !g.everLive || g.tries >= GS.retry.length) return fallback(g, why);
    g.mode = 'retry';
    clearTimeout(g.retryT);
    g.retryT = setTimeout(function () { attempt(g); }, GS.retry[g.tries++]);
  };

  // The old way for this floor: as today (the Supabase relay; whoever came first runs the monsters).
  var fallback = function (g, why) {
    clearTimers(g);
    closeSocket(g);
    g.mode = 'off';
    g.why = why;
    dropTrails(g);
    restoreSn(g);
    var w = g.w;
    if (g.dead || !w || w.gsGen !== g.gen || !w.wild || !w.sys || !w.sys.isActive()) return;
    // held back while it connected: the floor's creatures come out now, as they would have (unless a friend runs it)
    if (!w.wildFollowing() && !w.wild.heard && !w.wild.animals.length) w.gsSpawn();
  };

  // Off the floor: 'bye', and the line closed.
  // (quiet: a new map is opening, and says where you are itself)
  var end = function (g, quiet) {
    if (!g || g.dead) return;
    if (g.ws && g.ws.readyState === 1) send(g, { t: 'bye' });
    clearTimers(g);
    closeSocket(g);
    g.dead = true;
    if (g.mode !== 'off') { dropTrails(g); restoreSn(g, quiet); }
    if (g.dbg) { try { g.dbg.destroy(); } catch (e) { /* its scene went */ } g.dbg = null; }
    if (gs === g) gs = null;
  };

  // The floor's creatures, as setupWild (19v-wild.js) and the Lair (19zt-lair.js) put them out for the first one here.
  P.gsSpawn = function () {
    var self = this, zone = this.wild && this.wild.zone, f = this.feet();
    if (!zone) return;
    L.wildHere(this.state, this.mapKey).forEach(function (e) {
      if (WI.animals[e.kind].great) return; // (it walks in, when there are two of you)
      var p = self.wildSpot(zone, f, 6);
      if (!p) return;
      var a = self.addWildAnimal(e.kind, e.slot, p.x, p.y);
      if (self.lair) self.lairStrength(a);
    });
    if (this.lair) this.lair.seen = true;
  };

  // ---------- what the server says ----------
  var find = function (w, slot) { return w.wild.animals.filter(function (a) { return a.slot === slot; })[0]; };
  var kindOf = function (k) {
    if (typeof k === 'string' && WI.animals[k]) return k;
    k = Number(k);
    if (!isFinite(k)) return null;
    return k >= 1000 ? (WI.more || [])[k - 1000] || null : WI.order[k] || null;
  };
  var pend = function (a) {
    var now = Date.now();
    a.gsPend = (a.gsPend || []).filter(function (p) { return now - p.at < GS.pendMs; });
    return a.gsPend.reduce(function (n, p) { return n + p.d; }, 0);
  };
  var trail = function () { return { list: [], off: 0, heard: 0, gs: true }; };
  var feeding = false;
  var note = function (tr, st, x, y, dir, m) {
    feeding = true;
    try { L.trailNote(tr, { t: st, x: x, y: y, dir: dir, m: m }, Date.now()); } finally { feeding = false; }
  };
  var fresh = function (a) { return { dir: a.dir, left: a.left, mode: a.mode, look: a.look }; };
  var setHp = function (w, a, hp) {
    if (hp == null) return;
    a.gsHp = hp; // (the server's own count: what your hits waiting for its answer are taken from)
    a.hp = Math.max(0, hp - pend(a));
    if (a.def.boss || a.hp < (a.max || a.def.hp)) w.wildBar(a);
  };

  // Monsters: the whole floor ('wl', full) or the ones that changed ('tk'). st: the server's clock (none in a 'wl').
  var apply = function (w, st, rows, full) {
    var list = w.wild.animals, seen = {};
    (Array.isArray(rows) ? rows.slice(0, 60) : []).forEach(function (row) {
      var r = L.wildUnpack(row);
      if (!r) return;
      seen[r.slot] = true;
      var a = find(w, r.slot);
      if (a && a.kind !== r.kind) { w.wildGone(a); a = null; }
      var born = !a;
      if (born) {
        a = w.addWildAnimal(r.kind, r.slot, r.x, r.y, r.size);
        a.img.setAlpha(0);
        a.sh.setAlpha(0);
        a.fade = 0;
      }
      if (born || full) { // (a 'wl' puts each where the server has it: after a dropped line, the floor as it is now)
        a.path = trail();
        a.x = r.x;
        a.y = r.y;
        a.dir = r.dir;
        a.left = r.left;
        a.mode = r.mode;
        a.look = r.look;
        if (full) a.gsPend = [];
      }
      if (!a.path || !a.path.gs) a.path = trail();
      if (st != null) note(a.path, st, r.x, r.y, r, 1);
      a.max = r.max;
      setHp(w, a, r.hp);
      if (born && a.def.great) w.wildGreat(a); // (the Bakunawa rising, when the server brings it in)
    });
    if (full) list.slice().forEach(function (a) { if (!seen[a.slot]) w.wildGone(a); });
    else if (st != null) list.forEach(function (a) { // not in this tick: where it was (it stands), so it never drifts
      if (seen[a.slot]) return;
      if (!a.path || !a.path.gs) a.path = trail();
      var last = a.path.list[a.path.list.length - 1];
      if (last) note(a.path, st, last.x, last.y, last.dir, 1);
      else note(a.path, st, a.x, a.y, fresh(a), 1);
    });
  };

  // Friends on the floor: their farmers walk along the server's ticks (Supabase still says who they are).
  var player = function (g, id, x, y, dir, m, st) {
    if (typeof id !== 'string' || !id || id === g.you || id === (O.me && O.me.id)) return;
    x = num(x);
    y = num(y);
    if (x == null || y == null) return;
    var p = g.ppl[id] = { x: x, y: y, dir: DIRS[dir] ? dir : 'down', m: m ? 1 : 0 };
    var o = O.others[id];
    if (o) { o.x = x; o.y = y; o.dir = p.dir; }
    if (st == null) return;
    var tr = O.trails[id];
    if (!tr || !tr.gs) tr = O.trails[id] = trail();
    note(tr, st, p.x, p.y, p.dir, p.m);
  };

  var hear = function (g, m, my) {
    var w = g.w;
    if (g.dead || !w || w.gsGen !== g.gen || !w.wild) return;
    var t = m.t;
    if (t === 'no') return fail(g, 'no:' + String(m.why || ''), true);
    if (t === 'wl') {
      g.ok = my;
      g.mode = 'live';
      g.everLive = true;
      g.tries = 0;
      clearTimeout(g.waitT);
      g.waitT = null;
      g.you = String(m.you || (O.me && O.me.id) || '');
      w.wild.heard = true; // (what is here is what the server says, even nothing: a floor already cleared opens, 19zt-lair.js)
      if (w.lair) w.lair.seen = true;
      var at = isFinite(Number(m.st)) ? Number(m.st) : null; // (the server's clock, when it says)
      apply(w, at, m.mons, true);
      dropTrails(g);
      (Array.isArray(m.ppl) ? m.ppl.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) player(g, p[0], p[3], p[4], p[5], p[6], at); });
      return;
    }
    if (g.mode !== 'live' || g.ok !== my) return;
    if (t === 'tk') {
      var st = Number(m.st);
      if (!isFinite(st)) return;
      apply(w, st, m.m, false);
      (Array.isArray(m.gone) ? m.gone : []).forEach(function (slot) { var a = find(w, slot); if (a) w.wildGone(a); });
      (Array.isArray(m.come) ? m.come.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) player(g, p[0], p[3], p[4], p[5], p[6], st); });
      (Array.isArray(m.left) ? m.left : []).forEach(function (id) {
        delete g.ppl[id];
        if (O.trails[id] && O.trails[id].gs) delete O.trails[id];
      });
      var moved = {};
      (Array.isArray(m.p) ? m.p.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) { moved[p[0]] = 1; player(g, p[0], p[1], p[2], p[3], p[4], st); } });
      Object.keys(g.ppl).forEach(function (id) { // (still: where they stood)
        if (moved[id]) return;
        var q = g.ppl[id];
        player(g, id, q.x, q.y, q.dir, q.m, st);
      });
      return;
    }
    if (t === 'hp') {
      var a = find(w, m.s);
      if (!a) return;
      if (String(m.by) === g.you) a.gsPend = (a.gsPend || []).filter(function (p) { return p.n > Number(m.n); }); // (counted)
      else if (Number(m.hp) < a.hp) { // a friend's arrow: it flinches
        a.hitT = 180;
        if (w.bits) w.bits.dust.explode(2, a.x, a.y - 0.3 * a.def.w * T);
      }
      setHp(w, a, Math.max(0, Math.min(a.max || a.def.hp, Number(m.hp) || 0)));
      return;
    }
    if (t === 'dn') return down(g, w, m);
    if (t === 'bp') {
      var b = find(w, m.s);
      if (!b || !F.ui || F.ui.blocking() || w.busy) return; // (a menu open: it never reaches you, as before)
      w.wildHit(b);
      return;
    }
    if (t === 'cl') {
      if (w.lair) { w.lair.seen = true; w.openLairGate(true); }
      return;
    }
    if (t === 'po') {
      var c = Number(m.c);
      if (isFinite(c)) g.rtt = Math.max(0, Date.now() - c);
    }
  };

  // A monster down: its puff on every phone; the drops only for a phone in 'by' (wildDown's own path for yours).
  var down = function (g, w, m) {
    var a = find(w, m.s), kind = kindOf(m.kind) || (a && a.kind), by = Array.isArray(m.by) ? m.by.map(String) : [];
    if (!kind) return;
    var mine = by.indexOf(g.you) >= 0;
    if (!a) {
      if (w.lair) w.lair.down[m.s] = true;
      if (!mine) return;
      var x0 = num(m.x), y0 = num(m.y);
      if (x0 == null || y0 == null) return;
      a = w.addWildAnimal(kind, Number(m.s), x0, y0, 1); // (it went before this phone saw it fall: the drops are still yours)
    }
    var x = num(m.x), y = num(m.y), size = Number(m.size);
    if (x != null && y != null) { a.x = x; a.y = y; }
    if (isFinite(size) && size > 0) a.size = Math.max(0.5, Math.min(2, size > 3 ? size / 100 : size));
    a.hp = 0;
    a.gsPend = [];
    a.mine = mine;
    a.by = {};
    by.forEach(function (id) { if (id !== g.you) a.by[id] = 9; });
    w.wildDown(a);
  };

  // ---------- the old relay stands aside on this floor ----------
  // Who runs the floor: the server (wildFollowing is truthy, so nothing here runs, tells or spawns its monsters).
  var wildFollowing = P.wildFollowing;
  P.wildFollowing = function () {
    if (holding(this)) return 'gs';
    return wildFollowing.call(this);
  };
  // drawn as a friend's were; a charge that reaches you is the server's to say ('bp'), not this phone's
  var wildCopy = P.wildCopy;
  P.wildCopy = function (a, dt) {
    if (!holding(this)) return wildCopy.call(this, a, dt);
    var cool = a.cool;
    a.cool = Infinity;
    try { wildCopy.call(this, a, dt); } finally { a.cool = cool; }
  };
  // your arrow: everything shows at once (and the bar drops: predicted); the server hears it straight away
  var wildStruck = P.wildStruck;
  P.wildStruck = function (a, friend) {
    var g = holding(this);
    if (!g || friend) return wildStruck.apply(this, arguments);
    var before = a.hp;
    wildStruck.apply(this, arguments);
    var d = before - a.hp; // (the bow's damage, a Strong shot's too: 19zz-skills.js; none for one that wants feeding)
    if (!(d > 0)) return;
    var n = ++g.n;
    if (!send(g, { t: 'hit', s: a.slot, d: d, n: n })) { // (the line is down: it never counted)
      if (a.gsHp != null) a.hp = Math.max(0, a.gsHp - pend(a));
      return;
    }
    a.gsPend = a.gsPend || [];
    a.gsPend.push({ n: n, d: d, at: Date.now() });
  };
  var oSend = O.send;
  O.send = function (event, payload) {
    if (OLD[event] && holding(F.world)) return;
    return oSend.call(O, event, payload);
  };
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (OLD[event] && holding(F.world)) return;
    return onMessage.call(O, event, payload);
  };
  // (a trail the server feeds: drawn about 100 ms behind its ticks, not a Supabase friend's 400 ms; and only it feeds it)
  var trailAt = L.trailAt;
  L.trailAt = function (tr, now) {
    if (!tr || !tr.gs) return trailAt(tr, now);
    var ON = C.ONLINE, d = ON.moveDelay, e = ON.moveEvery, h = ON.moveAhead;
    ON.moveDelay = GS.delay;
    ON.moveEvery = GS.every;
    ON.moveAhead = GS.ahead;
    try { return trailAt(tr, now); } finally { ON.moveDelay = d; ON.moveEvery = e; ON.moveAhead = h; }
  };
  var trailNote = L.trailNote;
  L.trailNote = function (tr, s, now) {
    if (tr && tr.gs && !feeding) return tr;
    return trailNote(tr, s, now);
  };

  // ---------- each floor ----------
  var create = P.create;
  P.create = function () {
    end(gs, true); // (the floor before, or the same one again: a fresh line)
    this.gsGen = ++gen;
    var s = F.session && F.session.state, map = s && s.map, v = F.session && F.session.visit;
    // held from the start, so this phone puts none of the floor's creatures out before the server answers
    var hold = !!(url() && map && F.dungeonOf(map) && O.on && O.me && !(v && !v.inTown));
    if (hold) gs = { w: this, gen: this.gsGen, mode: 'connecting', dead: false, placeholder: true };
    create.call(this);
    if (!hold || !gs || !gs.placeholder || gs.w !== this) return;
    gs = null;
    if (this.lair && this.wild && F.dungeonOf(this.mapKey)) start(this);
  };
  var travel = P.travel;
  P.travel = function (to, spawn, floor) {
    var g = holding(this) || (gs && gs.w === this ? gs : null), was = this.busy;
    var r = travel.call(this, to, spawn, floor);
    if (g && !was && this.busy) end(g); // (on its way off the floor)
    return r;
  };
  var disconnect = O.disconnect;
  O.disconnect = function () {
    end(gs);
    return disconnect.apply(O, arguments);
  };

  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.busy || !this.sys.isActive()) return;
    var dt = Math.min(delta, 100);
    // online came after you went down (or the switch was turned on): the server from now on
    if ((!gs || gs.gen !== this.gsGen) && Math.floor(time / 1000) !== this.gsLook) {
      this.gsLook = Math.floor(time / 1000);
      if (url() && this.lair && this.wild && F.dungeonOf(this.mapKey) && O.on && O.me && !(F.session.visit && !F.session.visit.inTown)) start(this);
    }
    var g = live();
    if (g && g.w === this && g.gen === this.gsGen) {
      var f = this.feet(), s = this.state, last = g.lastMv, b = menu();
      var moved = !last || Math.abs(f.x - last.x) > 4 || Math.abs(f.y - last.y) > 4 || last.dir !== this.dir;
      g.mvMs -= dt;
      if (g.mvMs <= 0 && (moved || (last && last.m) || (last && last.b !== b))) { // (and a menu opening or closing)
        g.lastMv = { x: f.x, y: f.y, dir: this.dir, m: moved ? 1 : 0, b: b };
        g.mvMs = GS.mvEvery;
        send(g, { t: 'mv', x: Math.round(f.x), y: Math.round(f.y), dir: this.dir || 'down', m: moved ? 1 : 0, hg: L.gearBits ? L.gearBits(s) : 0, sk: L.power(s, 'sneak') ? 1 : 0, b: b });
      }
      g.piMs -= dt;
      if (g.piMs <= 0) { g.piMs = GS.piEvery; send(g, { t: 'pi', c: Date.now() }); }
      // a hit the server never answered stops counting: its bar goes back to what the server last said
      if (Math.floor(time / 250) !== g.pendAt) {
        g.pendAt = Math.floor(time / 250);
        this.wild.animals.forEach(function (a) { if (a.gsPend && a.gsPend.length && a.gsHp != null) a.hp = Math.max(0, a.gsHp - pend(a)); });
      }
    }
    debugLine(this);
  };

  // window.gameHost.gsDebug: a small line on screen: the line's state and its round trip.
  var debugLine = function (w) {
    var g = gs && gs.w === w && gs.gen === w.gsGen && !gs.dead ? gs : null, ui = F.ui;
    if (!g || !(window.gameHost && window.gameHost.gsDebug) || !ui || !ui.add) return;
    if (!g.dbg || !g.dbg.active) g.dbg = ui.add.text(8, 300, '', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6e0', backgroundColor: 'rgba(46,28,12,0.7)', padding: { x: 4, y: 2 } }).setDepth(60);
    var line = 'server: ' + (g.mode === 'live' ? (g.rtt != null ? g.rtt + ' ms' : 'live') : g.mode === 'off' ? 'old way (' + g.why + ')' : g.mode);
    if (g.dbg.text !== line) g.dbg.setText(line);
  };

  // (for the tests and the debug line: what the line is doing)
  F.GameServer = {
    config: GS,
    state: function () {
      var g = gs;
      return g ? { mode: g.mode, why: g.why || '', you: g.you || '', rtt: g.rtt, connects: g.connects || 0, sent: g.sent || 0, got: g.got || 0, n: g.n || 0, map: g.map, floor: g.floor } : null;
    },
  };
})(window.Farm = window.Farm || {});
