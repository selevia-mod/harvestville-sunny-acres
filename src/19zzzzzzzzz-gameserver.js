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
//
// Step 2 (docs/game-server.md, "Step 2"): every hunting place (L.isWildMap, not a cave) is open to everyone, in rooms of
// 30 (Banaue 1, Banaue 2, ...). On one as yourself (your own save, or a visit's town: v.inTown), the same socket says hi
// with topic 'pub' and floor 0, 'with' (the farm you visit, or a friend from your farm's room who is on this place now)
// and 'lk' (how you look). There the server owns the animals as in a cave, and is also who is here: its list (at most
// the 15 nearest, in view) is drawn, your farm's room carries no hunt messages for the place ('wa', 'wh', 'wd', 'wb',
// 'bt', 'ar') and its farmers there are drawn only from the server's list (never twice). Bait ('bt') and your arrows in
// flight ('ar') go to the server, and others' come from it. The place's tame animal stays your own: on this phone only.
// A stranger's farmer opens the Central Park card (Add friend, Report, Block); a blocked one is not drawn. The chip says
// the room: "Banaue 2 · 23 here" (the whole room: the server says how many, `here` in wl and tk).
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
    pSend: 100, // other players send a step this often while they walk (mvEvery) ...
    pMin: 150, // ... and are drawn between pMin + 50 and pMax + 50 ms behind, as their own line's jitter needs (owner,
    pMax: 300, // 7 Nov 2026, on e34: "still a little bit delay on walking"): a good line 200 ms, a bad one up to 350
    holdMost: 900, // ms: a kill or a hit by another hunter waits at most this long for their arrow to land on this screen
    pEvery: 300, // other players: their steps come about this often (a move every 100 ms, and the road's jitter), so
    // they are drawn this much further in the past than the monsters (L.trailAt tr.every: 350 ms in all, as a farm room 400), always with
    // their next step already here (owner, 7 Nov 2026: "I cant see them walking, they just transporting")
    most: 15, // a public room: never more others drawn than this (the server sends at most the 15 nearest)
    nearEvery: 1000, // a public room: who the nearest are, looked at again this often
  };
  var OLD = { wa: 1, wh: 1, wd: 1, wb: 1 }; // the old relay's monster messages
  var HUNT = { wa: 1, wh: 1, wd: 1, wb: 1, bt: 1, ar: 1 }; // ...and, in a public room, bait and arrows too
  var DIRS = { down: 1, up: 1, left: 1, right: 1 };
  var MOST = 400 * T;
  var gen = 0;
  var gs = null; // this floor's session: { w, gen, mode: 'connecting' | 'live' | 'retry' | 'off', ws, ... }

  // a hunting place open to everyone (step 2): a wild map that is not a cave (nor Bakunawa's Lair)
  var pubMap = function (map) { return !!map && L.isWildMap(map) && !(F.dungeonOf && F.dungeonOf(map)); };
  // the place's short name, as the room shows it ("Banaue 2"): the first word of its name
  var placeWord = function (map) {
    var a = WI.areas[map], p = C.PLACES && C.PLACES[map], n = (p && p.name) || (a && a.name) || map;
    return String(n).split(' ')[0];
  };
  var url = function () {
    var u = window.gameHost && window.gameHost.gs;
    return typeof u === 'string' && /^wss?:\/\/./.test(u) ? u : null;
  };
  var num = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(MOST, v)) : null; };
  // the session running this world's floor right now (also while it is connecting or getting its line back)
  var menu = function () { return F.ui && F.ui.blocking && F.ui.blocking() ? 1 : 0; };
  var holding = function (w) { return gs && !gs.dead && w && gs.w === w && gs.gen === w.gsGen && gs.mode !== 'off' ? gs : null; };
  var live = function () { return gs && !gs.dead && gs.mode === 'live' && gs.ws && gs.ws.readyState === 1 ? gs : null; };
  // the public room holding this world (also while it connects or gets its line back; the placeholder while the map opens)
  var pubHolding = function (w) { var g = holding(w); return g && (g.pub || (g.placeholder && pubMap(w.mapKey))) ? g : null; };
  // the server says who is here (a public room; a cave floor too, now that friends meet there from their own farms)
  var pplHolding = function (w) { var g = pubHolding(w) || holding(w); return g && (g.pub || g.pp || (g.placeholder && pubMap(w.mapKey))) ? g : null; };
  var send = function (g, m) {
    if (!g || g.dead || !g.ws || g.ws.readyState !== 1) return false;
    try { g.ws.send(JSON.stringify(m)); g.sent++; return true; } catch (e) { return false; }
  };

  // ---------- a floor's session ----------
  var start = function (w) {
    var pub = pubMap(w.mapKey);
    askFriends(); // (your friends, for a cave's hi: asked once every few minutes)
    gs = {
      w: w, gen: w.gsGen, url: url(), map: w.mapKey, floor: pub ? 0 : O.floorHere(w.mapKey), topic: pub ? 'pub' : O.topic || O.topicNow(), mode: 'connecting',
      ws: null, attempt: 0, tries: 0, everLive: false, you: '', n: 0, sent: 0, got: 0, connects: 0, rtt: null, ppl: {},
      mvMs: 0, piMs: 0, lastMv: null, waitT: null, retryT: null, sn: null, why: '',
      pub: pub, ch: 0, cap: 0, here: 0, baits: {}, drawnKey: '', nearMs: 0, skew: 0, farmTold: false,
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
  // others' bait from the server, off the map
  var dropBaits = function (g) {
    Object.keys(g.baits || {}).forEach(function (id) { var b = g.baits[id]; if (b.img && b.img.active) b.img.destroy(); });
    g.baits = {};
  };
  var restoreSn = function (g, quiet) {
    if (g.sn != null && !O.mapAt) O.mapAt = g.sn;
    g.sn = null;
    if (!quiet && O.on && O.chan && O.retrack) O.retrack();
  };

  // A public room's 'with': the farm you visit (its owner), or a friend from your farm's room who is on this place now.
  // Your friends (and whoever is in your farm's room) for a cave's hi: the server puts you with one of them on this floor.
  var caveFriends = function () {
    var out = {};
    Object.keys(friends.ids || {}).forEach(function (id) { out[id] = 1; });
    Object.keys(O.others || {}).forEach(function (id) { out[id] = 1; });
    if (F.session.visit && F.session.visit.host) out[String(F.session.visit.host)] = 1;
    return Object.keys(out).filter(function (id) { return !O.blocked[id]; }).slice(0, 200);
  };
  var withWho = function (g) {
    var v = F.session.visit;
    if (v && v.host) return String(v.host);
    var ids = Object.keys(O.others || {}).filter(function (id) { var p = O.others[id]; return p && p.map === g.map && !p.fl && !O.blocked[id]; }).sort();
    return ids[0] || '';
  };

  // One try at the line: the token first, then the socket and 'hi'; a 'wl' within 3 s, or this try failed.
  var attempt = function (g) {
    if (g.dead || g.mode === 'off') return;
    var my = ++g.attempt;
    clearTimeout(g.waitT);
    g.waitT = setTimeout(function () { if (g.attempt === my && g.ok !== my) fail(g, 'slow'); }, GS.wait);
    F.Net.token().then(function (token) { return g.pub ? token : friendsWait().then(function () { return token; }); }).then(function (token) {
      if (g.dead || g.attempt !== my || g.failed === my || g.mode === 'off') return;
      if (!token) return fail(g, 'token', true);
      var ws;
      try { ws = new WebSocket(g.url); } catch (e) { return fail(g, 'socket'); }
      g.ws = ws;
      g.connects++;
      ws.onopen = function () {
        var w = g.w, s = F.session.state, f = w.feet();
        var hi = { t: 'hi', v: 1, token: token, topic: g.topic, map: g.map, floor: g.floor, name: O.myName(), look: s.look === 'girl' ? 'girl' : 'boy',
          x: Math.round(f.x), y: Math.round(f.y), dir: w.dir || 'down', hg: L.gearBits ? L.gearBits(s) : 0, sk: L.power(s, 'sneak') ? 1 : 0,
          b: menu(), bk: !g.pub && L.bakunawaReady && L.bakunawaReady(s) ? 1 : 0 }; // (b: a menu open, the monsters leave you be; bk: the Bakunawa may rise for you today)
        var ms = O.myState();
        hi.lk = { cs: ms.cs || '', pt: ms.pt ? 1 : 0, rd: ms.rd ? 1 : 0 }; // (how you look: the others draw you from it)
        if (g.pub) { // a public room: who to be put with
          var mate = withWho(g);
          if (mate) hi.with = mate;
        } else hi.with = caveFriends(); // a cave: your friends, so you land on a friend's floor (owner, 7 Nov 2026: "automatic")
        send(g, hi);
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
    dropBaits(g);
    restoreSn(g);
    if (g.pub || g.pp) { O.syncSprites(); F.bus.emit('pub'); } // (your farm's friends on this place, drawn as before)
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
    dropBaits(g);
    if (g.pub || g.pp) { O.syncSprites(); F.bus.emit('pub'); } // (back to your farm's room's farmers)
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
  // (gsLocal: this phone's own, beside the server's: a place's tame animal in a public room)
  var find = function (w, slot) { return w.wild.animals.filter(function (a) { return a.slot === slot && !a.gsLocal; })[0]; };
  // a packed animal; a public room's more copies of the roster are slots 100, 200 and 300 up (the game's own stop at 99)
  var unpack = function (row) {
    var s = Array.isArray(row) ? Number(row[0]) : NaN;
    if (!(s >= 100 && s < 400 && s === Math.floor(s))) return L.wildUnpack(row);
    var q = row.slice();
    q[0] = s % 100;
    var r = L.wildUnpack(q);
    if (r) r.slot = s;
    return r;
  };
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
  // A player's steps: timed by THEIR phone's clock (c, in their mv) when the server passes it on, so a late message on
  // their side never looks like a stop and a rush on ours (src 'c'); else by the server's tick (src 's').
  var ptrail = function (src) { var t = trail(); t.every = GS.pEvery; t.src = src; return t; };
  var pnote = function (id, at, st, x, y, dir, m) {
    var c = Number(at), src = isFinite(c) && c > 0 ? 'c' : 's', tr = O.trails[id];
    if (!tr || !tr.gs || tr.src !== src) tr = O.trails[id] = ptrail(src);
    var t = src === 'c' ? c : st, had = tr.list.length;
    note(tr, t, x, y, dir, m);
    // their line's jitter (how much later than its quickest a step comes), the worst of late, fading 20 ms a second: they
    // are drawn just far enough behind for the next step to be here (a good line: 200 ms; a bad one: up to 350)
    if (had && tr.list.length) {
      var now = Date.now(), late = now - t - tr.off, fade = tr.jAt ? (now - tr.jAt) * 0.02 : 0;
      tr.jAt = now;
      tr.jit = Math.max(isFinite(late) ? Math.max(0, late) : 0, (tr.jit || 0) - fade);
      tr.every = Math.max(GS.pMin, Math.min(GS.pMax, GS.pSend + tr.jit * 1.2));
    }
  };
  // Still where they stood (no step in this tick): only for one who stopped, and only on the server's clock. One still
  // walking just has its next step on the way: a "still here" point in between was a stop and a rush every tick.
  var pstill = function (id, q, st) {
    var tr = O.trails[id];
    if (q.m || (tr && tr.gs && tr.src === 'c')) return;
    pnote(id, null, st, q.x, q.y, q.dir, q.m);
  };
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
      var r = unpack(row);
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
    if (full) list.slice().forEach(function (a) { if (!seen[a.slot] && !a.gsLocal) w.wildGone(a); });
    else if (st != null) list.forEach(function (a) { // not in this tick: where it was (it stands), so it never drifts
      if (seen[a.slot] || a.gsLocal) return;
      if (!a.path || !a.path.gs) a.path = trail();
      var last = a.path.list[a.path.list.length - 1];
      if (last) note(a.path, st, last.x, last.y, last.dir, 1);
      else note(a.path, st, a.x, a.y, fresh(a), 1);
    });
  };

  // Friends on the floor: their farmers walk along the server's ticks (Supabase still says who they are).
  var player = function (g, id, x, y, dir, m, st, c, still) {
    if (typeof id !== 'string' || !id || id === g.you || id === (O.me && O.me.id)) return;
    x = num(x);
    y = num(y);
    if (x == null || y == null) return;
    var p = g.ppl[id] = { x: x, y: y, dir: DIRS[dir] ? dir : 'down', m: m ? 1 : 0 };
    var o = O.others[id];
    if (o) { o.x = x; o.y = y; o.dir = p.dir; }
    if (st == null) return;
    if (still) return pstill(id, p, st);
    var tr = O.trails[id];
    if (c == null && tr && tr.gs && tr.src === 'c') return; // (a 'come' row has no clock of theirs: their steps go on)
    pnote(id, c, st, p.x, p.y, p.dir, p.m);
  };

  // ---------- a public room's players: the server says who is here ----------
  // A row: [id, name, look, x, y, dir, m, lk] (lk: { cs, pt, rd }, as their hi said it). Drawn as a friend from the farm
  // room is (19h-online.js), as O.who and O.drawnHere give them.
  var pubRow = function (g, row, st) {
    if (!Array.isArray(row)) return;
    var id = row[0];
    if (typeof id !== 'string' || !id || id.length > 64 || id === g.you || id === (O.me && O.me.id)) return;
    var x = num(row[3]), y = num(row[4]);
    if (x == null || y == null) return;
    var lk = row[7] && typeof row[7] === 'object' ? row[7] : {}, cs = typeof lk.cs === 'string' ? lk.cs.slice(0, 64) : '';
    var keep = g.ppl[id];
    if (!keep && Object.keys(g.ppl).length >= 2 * GS.most) return; // (more than the server should ever say: never kept)
    var p = g.ppl[id] = {
      id: id, name: (L.cleanName ? L.cleanName(row[1]) : L.cleanText(row[1], 24)) || 'Farmer', look: row[2] === 'girl' ? 'girl' : 'boy', map: g.map, fl: 0,
      x: x, y: y, dir: DIRS[row[5]] ? row[5] : 'down', m: row[6] ? 1 : 0, host: id === O.hostId(), at: 0, pt: lk.pt ? 1 : 0,
      cs: C.LOOK_INDEX && cs && C.LOOK_INDEX[cs] != null ? cs : '', rd: 0, sk: 0, hg: 0, // (no horses on a hunting place)
      tr: O.others[id] ? O.others[id].tr || 0 : 0, pub: 1,
    };
    void keep;
    if (st == null) return;
    var tr = O.trails[id];
    if (tr && tr.gs && tr.src === 'c') return; // (a 'come' row has no clock of theirs: their steps go on)
    pnote(id, null, st, p.x, p.y, p.dir, p.m);
  };
  var pubMove = function (g, id, x, y, dir, m, st, c) {
    var p = g.ppl[id];
    if (!p) return; // (not in view: their 'come' says who they are first)
    x = num(x);
    y = num(y);
    if (x == null || y == null) return;
    p.x = x;
    p.y = y;
    p.dir = DIRS[dir] ? dir : p.dir;
    p.m = m ? 1 : 0;
    pnote(id, c, st, x, y, p.dir, p.m);
  };
  // A line said in the room: shown as a friend's is (19m-chat.js), every phone checking the words, the speed and blocks.
  var sayHeard = {};
  var pubSay = function (g, m) {
    var id = typeof m.id === 'string' ? m.id.slice(0, 64) : '';
    if (!id || id === g.you || (O.blocked && O.blocked[id]) || !L.chatClean) return;
    var line = L.chatClean(m.s);
    if (!line || !L.chatAllowed(sayHeard[id] = sayHeard[id] || {}, Date.now())) return;
    var p = g.ppl[id], name = (p && p.name) || (L.cleanName ? L.cleanName(m.n) : L.cleanText(m.n, 24)) || 'Farmer';
    O.logLine(id, name, line);
    var w = g.w;
    if (w && w.remotes && w.remotes[id] && w.bubble) w.bubble(id, line);
    if (F.Audio) F.Audio.sfx('talk');
  };
  // Your friends (farm_friends_v1), asked for as you come into a public room and again every few minutes: a hunt there
  // is shared with the hunter's friends only (owner, 7 Nov 2026: "only just the drop and loot should be align with
  // friends"); whoever is in your farm's room with you (a visit) counts too.
  var FRIENDS_EVERY = 5 * 60000;
  var friends = { ids: {}, at: 0, asking: false };
  var askFriends = function () {
    if (friends.asking || Date.now() - friends.at < FRIENDS_EVERY || !F.Net || !F.Net.rpc) return;
    friends.asking = true;
    friends.p = F.Net.rpc('farm_friends_v1', {}).then(function (list) {
      var ids = {};
      (list || []).forEach(function (f) { if (f && f.id && f.status !== 'request' && f.status !== 'sent') ids[String(f.id)] = 1; });
      friends.ids = ids;
      friends.at = Date.now();
    }).catch(function () { friends.at = Date.now() - FRIENDS_EVERY + 30000; }).then(function () { friends.asking = false; });
  };
  // A cave's hi waits for the list (at most 1.5 s) so it can say who your friends are.
  var friendsWait = function () {
    askFriends();
    return Promise.race([friends.p || Promise.resolve(), new Promise(function (r) { setTimeout(r, 1500); })]).catch(function () {});
  };
  var isFriend = function (id) { return !!(id && (friends.ids[id] || (O.others && O.others[id]))); };
  var pubLeft = function (g, id) {
    delete g.ppl[id];
    if (O.trails[id] && O.trails[id].gs) delete O.trails[id];
  };
  // The ones drawn: the nearest 15, never a blocked one.
  var nearest = function (g) {
    var w = g.w, f = w && w.player ? w.feet() : { x: 0, y: 0 };
    return Object.keys(g.ppl).filter(function (id) { return !O.blocked[id]; })
      .sort(function (a, b) { var p = g.ppl[a], q = g.ppl[b]; return Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y) || (a < b ? -1 : 1); })
      .slice(0, GS.most);
  };
  var redraw = function (g) {
    g.drawnKey = nearest(g).slice().sort().join(',');
    O.syncSprites();
    F.bus.emit('pub');
  };
  // Someone else's bait (one each): on the map until it is eaten up (their 'until', on the server's clock).
  var pubBait = function (g, m) {
    var w = g.w, id = typeof m.id === 'string' ? m.id : '', x = num(m.x), y = num(m.y);
    if (!id || id === g.you || x == null || y == null || O.blocked[id] || !w.add) return;
    var until = Number(m.until), left = isFinite(until) && until > 1e12 ? until - (Date.now() - g.skew) : WI.baitMins * 60000;
    left = Math.max(0, Math.min(WI.baitMins * 60000 + 60000, left));
    if (!left) return;
    var old = g.baits[id];
    if (old && old.img && old.img.active) old.img.destroy();
    g.baits[id] = { x: x, y: y, until: Date.now() + left, img: w.add.image(x, y, 'items', C.ICON.bait).setScale(0.7).setDepth(F.WorldScene.DEPTH.actor + y / 1e5) };
  };
  // Someone's arrow in flight: their farmer lets it go (19w-bow.js remoteShot), or just the arrow and a flash of their bow.
  // Another hunter's arrow on this screen: when it lands (it is drawn and let go first, then flies at ARROW 16 tiles a
  // second). Their hit and their kill wait for it (owner, 7 Nov 2026: "The other users hit the bunny and it dies
  // instantly without hitting the arrow yet"), never more than GS.holdMost.
  var ARROW = 16 * T, POSE_MS = 160, shotsSeen = {};
  var shotSeen = function (id, x, y, posed) { if (id) shotsSeen[id] = { at: Date.now(), x: x, y: y, pose: posed ? POSE_MS : 0 }; };
  var landsIn = function (id, a) {
    var sh = shotsSeen[id];
    if (!sh || !a || Date.now() - sh.at > 1500) return 0;
    var fly = Math.hypot(a.x - sh.x, (a.y - 0.3 * a.def.w * T) - sh.y) / ARROW * 1000;
    return Math.max(0, Math.min(GS.holdMost, sh.at + sh.pose + fly - Date.now()));
  };
  // A monster another hunter's arrow is still flying at: what the server says of it waits (in order) until it lands.
  var held = {};
  var holdFor = function (g, w, m, who) {
    var slot = Number(m.s);
    if (m._held || !who || who === g.you) return false;
    if (held[slot]) { held[slot].q.push(m); return true; }
    var wait = landsIn(who, find(w, slot));
    if (wait < 30) return false;
    held[slot] = { q: [m] };
    setTimeout(function () {
      var h = held[slot];
      delete held[slot];
      if (!h || g.dead || g.w !== w) return;
      h.q.forEach(function (x) { x._held = 1; if (x.t === 'gone') { var a = find(w, slot); if (a) w.wildGone(a); } else hear(g, x, g.ok); });
    }, wait);
    return true;
  };
  var pubArrow = function (g, m) {
    var w = g.w, id = typeof m.id === 'string' ? m.id : '';
    if (!id || id === g.you || O.blocked[id] || !isFinite(m.x) || !isFinite(m.y) || !isFinite(m.a)) return;
    var ax = num(m.x), ay = num(m.y), ang = Number(m.a), range = Math.min(8 * T, Number(m.l) || 0), lv = Math.max(0, Math.min(3, Number(m.b) || 0));
    if (ax == null || ay == null) return;
    var r = w.remotes && w.remotes[id], posed = !!(r && w.remoteShot(r, ax, ay, ang, range, lv));
    if (!posed) { w.wildArrow(ax, ay, ang, range, true); w.bowFlash(ax, ay, ang, lv); }
    shotSeen(id, ax, ay, posed);
  };
  // The place's tame animal, your own (never the server's): out once the room says what is here, unless it is already.
  var tameOut = function (g) {
    var w = g.w, zone = w.wild && w.wild.zone;
    if (!zone || w.wild.animals.some(function (a) { return a.gsLocal; })) return;
    var f = w.feet();
    L.wildHere(w.state, w.mapKey).forEach(function (e) {
      if (!e.tame) return;
      var p = w.wildSpot(zone, f, 6);
      if (!p) return;
      var a = w.addWildAnimal(e.kind, e.slot, p.x, p.y);
      a.gsLocal = true;
    });
  };

  var hear = function (g, m, my) {
    var w = g.w;
    if (g.dead || !w || w.gsGen !== g.gen || !w.wild) return;
    var t = m.t;
    if (t === 'no') return fail(g, 'no:' + String(m.why || ''), true);
    if (t === 'wl') {
      g.ok = my;
      g.mode = 'live';
      g.tickN = isFinite(Number(m.n)) ? Number(m.n) : null; // (the ticks after this welcome count on from here)
      g.everLive = true;
      g.tries = 0;
      clearTimeout(g.waitT);
      g.waitT = null;
      g.you = String(m.you || (O.me && O.me.id) || '');
      w.wild.heard = true; // (what is here is what the server says, even nothing: a floor already cleared opens, 19zt-lair.js)
      if (w.lair) w.lair.seen = true;
      var at = isFinite(Number(m.st)) ? Number(m.st) : null; // (the server's clock, when it says)
      if (at != null) g.skew = Date.now() - at;
      apply(w, at, m.mons, true);
      dropTrails(g);
      if (g.pub) {
        g.ch = Math.max(0, Math.min(9999, Math.floor(Number(m.ch)) || 0));
        g.cap = Math.max(0, Math.min(1000, Math.floor(Number(m.cap)) || 0));
        g.here = isFinite(Number(m.here)) ? Math.max(0, Math.floor(Number(m.here))) : 0; // (if the server says the room's whole count)
        (Array.isArray(m.ppl) ? m.ppl.slice(0, 2 * GS.most) : []).forEach(function (p) { pubRow(g, p, at); });
        (Array.isArray(m.bt) ? m.bt.slice(0, 40) : []).forEach(function (b) { if (b && typeof b === 'object') pubBait(g, b); });
        tameOut(g);
        g.farmTold = false;
        redraw(g);
        askFriends();
        if (F.GameServer && typeof F.GameServer.onPubLive === 'function') F.GameServer.onPubLive(g); // (the first time: its tour)
        return;
      }
      if (m.pp) { // (who is here is the server's to say: drawn from its rows, a friend from another farm too)
        g.pp = true;
        g.ppl = {};
        (Array.isArray(m.ppl) ? m.ppl.slice(0, 16) : []).forEach(function (p) { pubRow(g, p, at); });
        redraw(g);
        askFriends();
        if (F.GameServer && typeof F.GameServer.playTogether === 'function') F.GameServer.playTogether(); // (the first time: its tour)
        return;
      }
      (Array.isArray(m.ppl) ? m.ppl.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) player(g, p[0], p[3], p[4], p[5], p[6], at); });
      return;
    }
    if (g.mode !== 'live' || g.ok !== my) return;
    if (t === 'tk') {
      var st = Number(m.st), tn = Number(m.n);
      if (!isFinite(st)) return;
      // a tick older than one already applied never comes after it (it could bring back a monster since gone)
      if (isFinite(tn) && g.tickN != null && tn <= g.tickN) return;
      if (isFinite(tn)) g.tickN = tn;
      g.skew = Math.min(g.skew, Date.now() - st); // (the quickest a tick ever came: the server's clock against ours)
      apply(w, st, m.m, false);
      (Array.isArray(m.gone) ? m.gone : []).forEach(function (slot) { if (held[slot]) { held[slot].q.push({ t: 'gone', s: slot }); return; } var a = find(w, slot); if (a) w.wildGone(a); });
      if (g.pub || g.pp) {
        if (g.pub && isFinite(Number(m.here)) && Math.floor(Number(m.here)) !== g.here) { g.here = Math.max(0, Math.floor(Number(m.here))); F.bus.emit('pub'); } // (someone came or went, near you or not)
        var changed = false, went = {};
        (Array.isArray(m.left) ? m.left : []).forEach(function (id) { if (g.ppl[id]) { pubLeft(g, id); changed = true; went[id] = 1; } });
        (Array.isArray(m.come) ? m.come.slice(0, 2 * GS.most) : []).forEach(function (p) { if (Array.isArray(p)) { pubRow(g, p, st); changed = true; } });
        var stepped = {};
        (Array.isArray(m.p) ? m.p.slice(0, 2 * GS.most) : []).forEach(function (p) { if (Array.isArray(p)) { stepped[p[0]] = 1; pubMove(g, p[0], p[1], p[2], p[3], p[4], st, p[5]); } });
        Object.keys(g.ppl).forEach(function (id) { if (!stepped[id]) pstill(id, g.ppl[id], st); }); // (still: where they stood)
        if (changed) redraw(g);
        void went;
        return;
      }
      (Array.isArray(m.come) ? m.come.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) player(g, p[0], p[3], p[4], p[5], p[6], st); });
      (Array.isArray(m.left) ? m.left : []).forEach(function (id) {
        delete g.ppl[id];
        if (O.trails[id] && O.trails[id].gs) delete O.trails[id];
      });
      var moved = {};
      (Array.isArray(m.p) ? m.p.slice(0, 16) : []).forEach(function (p) { if (Array.isArray(p)) { moved[p[0]] = 1; player(g, p[0], p[1], p[2], p[3], p[4], st, p[5]); } });
      Object.keys(g.ppl).forEach(function (id) { // (still: where they stood)
        if (moved[id]) return;
        var q = g.ppl[id];
        player(g, id, q.x, q.y, q.dir, q.m, st, null, true);
      });
      return;
    }
    if (t === 'say') { if (g.pub || g.pp) pubSay(g, m); return; }
    if (t === 'em') {
      var eid = typeof m.id === 'string' ? m.id : '', k = typeof m.k === 'string' ? m.k : '';
      if ((g.pub || g.pp) && eid && eid !== g.you && !(O.blocked && O.blocked[eid]) && (k === 'heart' || (O.REACT_WORDS && O.REACT_WORDS[k])) && O.showEmote) O.showEmote(eid, k);
      return;
    }
    if (t === 'bt') { if (g.pub) pubBait(g, m); return; }
    if (t === 'ar') { if (g.pub || g.pp) pubArrow(g, m); return; }
    if (t === 'hp') {
      if (holdFor(g, w, m, String(m.by))) return;
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
    if (t === 'dn') {
      if (holdFor(g, w, m, typeof m.lh === 'string' && m.lh ? m.lh : (Array.isArray(m.by) ? String(m.by[m.by.length - 1] || '') : ''))) return;
      return down(g, w, m);
    }
    if (t === 'bp') {
      var b = find(w, m.s);
      if (!b || !F.ui || F.ui.blocking() || w.busy) return; // (a menu open: it never reaches you, as before)
      w.wildHit(b);
      return;
    }
    if (t === 'cl') {
      if (g.pub) return; // (a public room never clears)
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
    var mine = by.indexOf(g.you) >= 0, lh = typeof m.lh === 'string' ? m.lh : '';
    // a hunting place: a share is yours only when you landed the last hit or the one who did is your friend
    var stranger = g.pub && mine && lh && lh !== g.you && !isFriend(lh);
    if (stranger) mine = false;
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
    if (g.pub && a.slot >= 100) a.slot = a.slot % 100; // (a copy's: your record keeps the place's own slot, as the save does)
    if (stranger) a.hits = 0; // (no "it took N hits" toast: it was shared, just not with you)
    w.wildDown(a);
    if (stranger && F.ui) {
      var q = g.ppl[lh];
      F.ui.toast((q ? q.name : 'Another hunter') + ' got it. Hunts are shared with friends only: add them as a friend to share next time.', 3200);
    }
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
    if (a.gsLocal) return this.updateWild(a, dt, false); // (your own tame animal: this phone runs it, as always)
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
    var pg = pubHolding(F.world), cg = !pg && pplHolding(F.world);
    if (cg) { // a cave floor the server says who is on: your talk goes there (a friend from another farm hears it)
      if (event === 'say') { if (cg.mode === 'live' && payload && typeof payload.s === 'string') send(cg, { t: 'say', s: payload.s }); return; }
      if (event === 'emote') { if (cg.mode === 'live' && payload && typeof payload.k === 'string') send(cg, { t: 'em', k: payload.k }); return; }
      if (event === 'ar') return; // (P.tellArrow sends it to the floor)
      if (OLD[event]) return;
    }
    if (pg) {
      if (HUNT[event]) return;
      // chat in a hunting place: to everyone in the room, on our server (owner, 7 Nov 2026: "open to everyone ... Even
      // strangers can talk"); not to your farm's room
      if (event === 'say') { if (pg.mode === 'live' && payload && typeof payload.s === 'string') send(pg, { t: 'say', s: payload.s }); return; }
      // a wave or a reaction: to everyone near you there, strangers too (your farm's room is not on this place)
      if (event === 'emote') { if (pg.mode === 'live' && payload && typeof payload.k === 'string') send(pg, { t: 'em', k: payload.k }); return; }
      // a public room: your farm's room hears where you went (your first step here, and your presence), not each step
      if (event === 'mv' && payload && payload.map === pg.w.mapKey) { if (pg.farmTold) return; pg.farmTold = true; }
    } else if (OLD[event] && holding(F.world)) return;
    return oSend.call(O, event, payload);
  };
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event === 'ar' && payload && typeof payload.id === 'string' && holding(F.world) && !pubHolding(F.world)) shotSeen(payload.id, Number(payload.x), Number(payload.y), !!(F.world.remotes && F.world.remotes[payload.id]));
    if ((pubHolding(F.world) ? HUNT : OLD)[event] && holding(F.world)) return;
    return onMessage.call(O, event, payload);
  };
  // a public room: bait and your arrows go to the server (it tells those who can see them), whoever is drawn here
  var tellBait = P.tellBait;
  P.tellBait = function (x, y) {
    var g = pubHolding(this);
    if (!g) return tellBait.call(this, x, y);
    if (live() === g) send(g, { t: 'bt', x: x, y: y });
  };
  var tellArrow = P.tellArrow;
  P.tellArrow = function (m) {
    var g = pplHolding(this);
    if (!g) return tellArrow.call(this, m);
    var l = live();
    if (l === g) send(g, { t: 'ar', x: m.x, y: m.y, a: m.a, l: m.l, b: m.b });
  };
  // who is here: the server's list (the 15 nearest; not a blocked one); your farm's room's farmers here only through it
  var drawnHere = O.drawnHere;
  O.drawnHere = function (w) {
    var g = pplHolding(w);
    if (!g) return drawnHere.call(O, w);
    var want = {};
    if (g.ppl) nearest(g).forEach(function (id) { want[id] = g.ppl[id]; });
    return want;
  };
  var who = O.who;
  O.who = function (id) {
    var g = pplHolding(F.world);
    if (!g) return who.call(O, id);
    return (g.ppl && g.ppl[id]) || null;
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
    var hold = !!(url() && map && (F.dungeonOf(map) || pubMap(map)) && O.on && O.me && !(v && !v.inTown)); // (a cave, or a hunting place: step 2)
    if (hold) gs = { w: this, gen: this.gsGen, mode: 'connecting', dead: false, placeholder: true };
    create.call(this);
    if (!hold || !gs || !gs.placeholder || gs.w !== this) return;
    gs = null;
    if (this.wild && ((this.lair && F.dungeonOf(this.mapKey)) || pubMap(this.mapKey))) start(this);
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

  // The game put away (another app, the screen off): goodbye at once, so the others' count is right; back on the place
  // when it comes back (P.update below). (owner, 7 Nov 2026: "someone left, but still says Pulag 1 * 3 here")
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden || !gs || gs.dead || gs.mode !== 'live') return;
      end(gs, true);
    });
  }
  var update = P.update;
  P.update = function (time, delta) {
    update.call(this, time, delta);
    if (this.busy || !this.sys.isActive()) return;
    var dt = Math.min(delta, 100);
    // online came after you went down (or the switch was turned on): the server from now on
    if ((!gs || gs.gen !== this.gsGen) && !(typeof document !== 'undefined' && document.hidden) && Math.floor(time / 1000) !== this.gsLook) { // (put away: back when it is seen again)
      this.gsLook = Math.floor(time / 1000);
      if (url() && this.wild && ((this.lair && F.dungeonOf(this.mapKey)) || pubMap(this.mapKey)) && O.on && O.me && !(F.session.visit && !F.session.visit.inTown)) start(this);
    }
    var g = live();
    if (g && g.w === this && g.gen === this.gsGen) {
      var f = this.feet(), s = this.state, last = g.lastMv, b = menu();
      var moved = !last || Math.abs(f.x - last.x) > 4 || Math.abs(f.y - last.y) > 4 || last.dir !== this.dir;
      g.mvMs -= dt;
      if (g.mvMs <= 0 && (moved || (last && last.m) || (last && last.b !== b))) { // (and a menu opening or closing)
        g.lastMv = { x: f.x, y: f.y, dir: this.dir, m: moved ? 1 : 0, b: b };
        g.mvMs = GS.mvEvery;
        send(g, { t: 'mv', x: Math.round(f.x), y: Math.round(f.y), dir: this.dir || 'down', m: moved ? 1 : 0, hg: L.gearBits ? L.gearBits(s) : 0, sk: L.power(s, 'sneak') ? 1 : 0, b: b, c: Date.now() }); // (c: when, on our clock: the others draw our steps by it)
      }
      g.piMs -= dt;
      if (g.piMs <= 0) { g.piMs = GS.piEvery; send(g, { t: 'pi', c: Date.now() }); }
      // a hit the server never answered stops counting: its bar goes back to what the server last said
      if (Math.floor(time / 250) !== g.pendAt) {
        g.pendAt = Math.floor(time / 250);
        this.wild.animals.forEach(function (a) { if (a.gsPend && a.gsPend.length && a.gsHp != null) a.hp = Math.max(0, a.gsHp - pend(a)); });
      }
      if (g.pub) {
        // who the nearest 15 are, now and then (you walk, they walk); and others' bait, gone when its time is up
        g.nearMs -= dt;
        if (g.nearMs <= 0) {
          g.nearMs = GS.nearEvery;
          if (nearest(g).slice().sort().join(',') !== g.drawnKey) redraw(g);
          var now = Date.now();
          Object.keys(g.baits).forEach(function (id) { var b = g.baits[id]; if (b.until <= now) { if (b.img && b.img.active) b.img.destroy(); delete g.baits[id]; } });
        }
      }
    }
    debugLine(this);
  };

  // ---------- a public room: a stranger's card, and the room on screen ----------
  var pubLive = function () { var g = live(); return g && g.pub && F.world && g.w === F.world && g.gen === F.world.gsGen ? g : null; };
  var cardFor = function (id) {
    var g = pubLive();
    if (!g || !g.ppl[id] || !F.ui || !F.ui.parkPlayer || F.ui.modals.length) return false;
    F.ui.parkPlayer(id, 'hunting in ' + placeWord(g.map));
    return true;
  };
  // Facing someone: Wave opens their card (as in Central Park; 19zzz-c-park-online.js).
  var resolve = P.resolve;
  P.resolve = function () {
    var a = resolve.apply(this, arguments);
    if (!a || a.label !== 'Wave' || !pubLive()) return a;
    var pt = this.front(0.7), r = this.remoteAt(pt.x, pt.y);
    if (!r) return a;
    var id = r.id;
    return Object.assign({}, a, { run: function () { if (!cardFor(id)) O.wave(); } });
  };
  // A tap on someone's farmer (a quick touch that does not walk): their card.
  P.remoteTapped = function (sx, sy) {
    var g = pubLive();
    if (!g || !this.remotes || this.busy) return null;
    var pt = this.cameras.main.getWorldPoint(sx, sy), best = null, bd = Infinity, self = this;
    Object.keys(this.remotes).forEach(function (id) {
      var r = self.remotes[id];
      if (!g.ppl[id] || Math.abs(pt.x - r.x) > 0.55 * T || pt.y < r.y - 1.7 * T || pt.y > r.y + 0.3 * T) return;
      var d = Math.hypot(pt.x - r.x, pt.y - (r.y - 0.6 * T));
      if (d < bd) { bd = d; best = id; }
    });
    return best;
  };
  var U = F.UIScene.prototype;
  var CHIP = { x: 8, y: 164, visitY: 130, h: 24 }; // (where Central Park's chip is; on a visit the visit's buttons are there, so above them)
  var uiCreate = U.create;
  U.create = function () {
    uiCreate.apply(this, arguments);
    var self = this, again = function () { self.pubChip(); }, tap = null;
    F.bus.on('pub', again);
    F.bus.on('map', again);
    F.bus.on('online', again);
    this.events.once('shutdown', function () { F.bus.off('pub', again); F.bus.off('map', again); F.bus.off('online', again); });
    this.input.on('pointerdown', function (p, over) { tap = !over.length && !self.modals.length && pubLive() ? { id: p.id, x: p.x, y: p.y, at: Date.now() } : null; });
    this.input.on('pointerup', function (p) {
      var t0 = tap;
      tap = null;
      if (!t0 || t0.id !== p.id || Date.now() - t0.at > 400 || Math.hypot(p.x - t0.x, p.y - t0.y) > 12 * F.R || self.modals.length) return;
      var w = F.world, id = w && w.remoteTapped ? w.remoteTapped(p.x, p.y) : null;
      if (id) cardFor(id);
    });
    this.pubChip();
  };
  // "Banaue 2 · 4 here": the room and how many are here (those near you, and you; the whole room if the server says).
  // Owner, 7 Nov 2026, on e34: "this Pulag 1 * X here is taking some space, need to adjust": on the Online button you
  // already have, the room under it ("Pulag 1" for "Online") and how many are here in a small green badge on it. On a
  // visit (no Online button there) the small chip as before.
  var onlineLabel = function (ui) {
    var c = ui.onlineBtn && ui.onlineBtn.list[0], out = null;
    (c && c.list ? c.list : []).forEach(function (o) { if (!out && o.type === 'Text') out = o; });
    return out;
  };
  U.pubBadge = function (n, caption) {
    var cap = onlineLabel(this);
    if (cap) { if (cap.__online == null) cap.__online = cap.text; cap.setText(caption || cap.__online); }
    var c = this.onlineBtn && this.onlineBtn.list[0];
    if (!n || !c) { if (this.pubBadgeBox) this.pubBadgeBox.setVisible(false); return; }
    if (!this.pubBadgeBox || !this.pubBadgeBox.active) {
      this.pubBadgeBox = this.add.container(0, 0);
      this.pubBadgeBg = this.add.circle(0, 0, 10, 0x5fa84a).setStrokeStyle(2, 0xffffff);
      this.pubBadgeText = this.txt(0, 0, '', 11, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
      this.pubBadgeBox.add([this.pubBadgeBg, this.pubBadgeText]);
      this.onlineBtn.add(this.pubBadgeBox);
    }
    this.pubBadgeBox.setPosition(c.x + 16, c.y - 17).setVisible(true);
    var t = n > 99 ? '99+' : String(n);
    if (this.pubBadgeText.text !== t) { this.pubBadgeText.setText(t); this.pubBadgeBg.setRadius(t.length > 1 ? 12 : 10); }
  };
  U.pubChip = function () {
    var g = pubLive(), on = !!g && g.ch > 0 && !this.decorating;
    if (!on) { if (this.pubChipBox) this.pubChipBox.setVisible(false); this.pubBadge(0); this.pubShown = ''; return; }
    var n = g.here || Object.keys(g.ppl).length + 1, text = placeWord(g.map) + ' ' + g.ch + ' · ' + n + ' here';
    if (this.onlineBtn && F.Net.available() && !F.session.visit) { // (the Online button is there)
      if (this.pubChipBox) this.pubChipBox.setVisible(false);
      this.pubBadge(n, placeWord(g.map) + ' ' + g.ch);
      this.pubShown = text;
      return;
    }
    this.pubBadge(0);
    this.pubShown = text;
    if (!this.pubChipBox) {
      var c = this.pubChipBox = this.add.container(CHIP.x, CHIP.y).setDepth(45);
      this.pubChipBg = this.add.graphics();
      this.pubChipDot = this.add.circle(13, CHIP.h / 2, 4, 0x7ee06a);
      this.pubChipText = this.txt(22, CHIP.h / 2, '', 12, '#fff6d8', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      c.add([this.pubChipBg, this.pubChipDot, this.pubChipText]);
      this.tweens.add({ targets: this.pubChipDot, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    }
    this.pubChipBox.setY(F.session.visit ? CHIP.visitY : CHIP.y);
    if (this.pubChipText.text !== text) {
      this.pubChipText.setText(text);
      var w = Math.ceil(this.pubChipText.width) + 32;
      this.pubChipBg.clear().fillStyle(0x24160b, 0.78).fillRoundedRect(0, 0, w, CHIP.h, CHIP.h / 2);
      this.pubChipBg.lineStyle(1.5, 0xffd23f, 0.85).strokeRoundedRect(0.75, 0.75, w - 1.5, CHIP.h - 1.5, CHIP.h / 2 - 0.75);
    }
    this.pubChipBox.setVisible(true);
  };

  // ---------- Online, Here: who is hunting here (owner, 7 Nov 2026: the count on the Online button; a tap shows them) ----------
  // In a hunting place the Online button opens Here first: the room and how many, then the hunters near you (the nearest
  // 15 the server tells of), each with Add friend (not a friend already) and More (Report, Block). The other tabs as ever.
  var HERE = ['here', 'Here'];
  var openOnline = U.openOnline;
  U.openOnline = function (tab, page, then) {
    var g = pubLive(), at = O.TABS.indexOf(HERE);
    if (g && at < 0) O.TABS.unshift(HERE);
    if (!g && at >= 0) O.TABS.splice(at, 1);
    if (tab !== 'here') return openOnline.apply(this, arguments);
    if (!g || !F.Net.available() || !O.on) return openOnline.call(this, 'visit', page, then);
    var self = this, n = g.here || Object.keys(g.ppl).length + 1, ids = nearest(g);
    var rows = ids.map(function (id) {
      var p = g.ppl[id], state = self.friendState ? self.friendState(id) : undefined;
      var buttons = [];
      if (state !== 'friend' && state !== 'sent' && self.askFriend) buttons.push({ label: 'Add friend', color: 0x5fa84a, cb: function () { self.closeModal(); self.askFriend(id, p.name); } });
      buttons.push({ label: 'More', color: 0xa08a68, cb: function () { self.closeModal(); self.playerMenu(id, p.name, function (next) { self.openOnline('here', 0, next); }); } });
      return {
        id: id, icon: C.ICON.bow, name: p.name, online: true,
        desc: state === 'friend' ? 'Your friend, hunting with you.' : state === 'sent' ? 'Friend request sent.' : 'Hunting near you.',
        buttons: buttons,
      };
    });
    var where = placeWord(g.map) + ' ' + g.ch;
    if (F.GameServer && typeof F.GameServer.playTogether === 'function') F.GameServer.playTogether();
    this.listPanel({
      title: 'Online', tab: 'here', page: page || 0, tabs: O.TABS, rows: rows,
      reopen: function (t, p) { self.openOnline(t, p); },
      sub: function () { return where + ' · ' + n + ' hunting here' + (n - 1 > ids.length ? ' (the nearest ' + ids.length + ' below)' : ''); },
      empty: 'Nobody else is near you right now. Walk around: ' + where + ' holds up to ' + (g.cap || 30) + ' hunters.',
    });
    if (then) then();
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
    pubLive: function () { return !!pubLive(); }, // (19m-chat.js: the Chat button is always there in a hunting place)
    isFriend: isFriend, // (tests)
    friendsNow: function (ids) { friends.ids = ids || {}; friends.at = Date.now(); }, // (tests)
    baits: function () { return gs && gs.baits ? Object.keys(gs.baits).sort() : []; }, // (others' bait drawn here, by whose)
    state: function () {
      var g = gs;
      return g ? { mode: g.mode, why: g.why || '', you: g.you || '', rtt: g.rtt, connects: g.connects || 0, sent: g.sent || 0, got: g.got || 0, n: g.n || 0, map: g.map, floor: g.floor,
        pub: !!g.pub, ch: g.ch || 0, cap: g.cap || 0, here: g.ppl ? Object.keys(g.ppl).length : 0, chip: F.ui && F.ui.pubShown ? F.ui.pubShown : '' } : null; // (what the Online button's badge, or the chip on a visit, says)
    },
  };
})(window.Farm = window.Farm || {});
