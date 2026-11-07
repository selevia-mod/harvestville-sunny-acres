// A public room: one hunting place, open to everyone, up to PUB_CAP phones (docs/game-server.md "Step 2"). Key
// `pub|<map>|<n>` (n: "Banaue 2"). It is a Room (lib/room.js: hits, kills, charges, the monsters' rules) with:
//   - the place's animals from one shared state (the real clock in Philippine time, as the phones' L.minuteOf and
//     L.dayOf: the same weather, rare hours, nights and the Great Mammoth's weekend), its own `gone` list, a slot back
//     after its respawn minutes divided by the crowd, more copies of the roster for a crowd, new ones walking in;
//   - bait (`bt`) and arrows in flight (`ar`);
//   - who sees whom: each phone hears of the players within VIEW tiles of it, at most the VIEW_MAX nearest;
//   - no `cl`, and an empty room goes at once.
'use strict';
const { Room, num, clean, lookOf } = require('./room');

const PUB_CAP = 30; // phones a room (owner, 7 Nov 2026: 30 now, maybe 100 later: this one number)
const VIEW = 18; // tiles: the players a phone hears of (a phone screen and a margin)
const VIEW_MAX = 15; // at most this many of them, the nearest (a cheap phone never draws 30)
const VIEW_KEEP = 1; // tiles: one already in view stays to VIEW + this, and outranks a newcomer by this (no flicker at the edge)
// Owner, 7 Nov 2026, on e34: "The wild animals can't accommodate many users since we are sharing on map". What holds a
// hunter back is energy and arrows, not an empty map:
const COPY_EVERY = 4; // one more copy of the roster for each 4 players (1-3: the place's own, 4-7: two, 8-11: three) ...
const COPIES = 4; // ... at most this many in all (slots 100 * copy + slot; the phones take up to 399)
const PUB_RESPAWN = 2; // minutes: a hunted one comes back at most this late here (not a rare one, not the Great Mammoth) ...
const CROWD_EACH = 4; // ... and ceil(players / 4) times sooner ...
const CROWD_MOST = 4; // ... at most 4 times (30 s with 13 or more)
const SWEEP = 5000; // ms: how often one no longer about (a wolf at sunrise, the rain's deer) is looked for, to walk off
const AR_MAX = 8; // arrows in flight a second a phone (more are dropped)
// Chat in a hunting place (owner, 7 Nov 2026: "It should be open to everyone ... Even strangers can talk to each
// other"): a line to everyone in the room, as Central Park's. Each phone checks the words (L.chatClean) and blocks; the
// server keeps lines short and slow (the game's C.CHAT: 60 characters, 1.2 s apart, 12 a minute).
const SAY_MAX = 60, SAY_GAP = 1200, SAY_MINUTE = 12;
const EMOTES = { wave: 1, laugh: 1, wow: 1, yay: 1, aww: 1, heart: 1 }; // (O.REACT_WORDS, 19h-online.js, and the heart)
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
const MANILA = 8 * 3600000; // the phones' clock is Philippine time (UTC+8, no summer time)
const DAY = 864e5;

// The state the phones' L.wildHere reads, for this moment: today's day and minute in Philippine time (L.dayOf,
// L.minuteOf on a phone there), nothing hunted (the room keeps its own gone list), nothing tamed (the tame never comes).
const sharedState = (ms) => {
  const t = ms + MANILA;
  return { day: Math.floor(t / DAY), time: (((t % DAY) + DAY) % DAY) / 60000, wild: { n: 0, by: {}, gone: {}, job: 0, best: {} }, places: {} };
};

// Which maps are hunting places (L.isWildMap, but not a cave, not a place still in the making), with a map and a zone.
const isPubMap = (R, maps, map) => {
  if (typeof map !== 'string' || !R.L.isWildMap(map) || R.dungeonOf(map)) return false;
  const a = R.WI.areas[map], p = R.C.PLACES && R.C.PLACES[map];
  if (!a || a.dungeon || (p && p.dev)) return false;
  const m = maps.get(map);
  return !!(m && m.zone);
};

class PubRoom extends Room {
  constructor(game, map, n, mapData) {
    const R = game.R;
    super(game, 'pub|' + map + '|' + n, 'pub', map, 0, { key: map, lair: false, floors: 0, place: R.L.placeOf(map), pub: true }, mapData);
    this.pub = true;
    this.ch = n;
    this.cap = game.pubCap || PUB_CAP;
    this.gone = new Map(); // slot -> when it was hunted (ms)
    this.next = [];
    for (let c = 0; c < COPIES; c++) this.next.push(this.span(R.WI.arrive[0], R.WI.arrive[1]));
    this.sweepIn = SWEEP;
    this.baits = new Map(); // player id -> { id, x, y, until }
    this.recent = new Map(); // player id -> when their socket closed (a reconnect comes back here)
    this.hereAt = -1;
    this.hereList = [];
  }

  // ---------- the animals ----------
  // The place's roster now, as L.wildHere gives a player on a phone in the Philippines, without the tame (each phone's own).
  here() {
    const now = this.game.now(), minute = Math.floor(now / 60000);
    if (minute !== this.hereAt) {
      const R = this.R;
      this.hereAt = minute;
      this.hereList = R.L.wildHere(sharedState(now), this.map).filter((e) => !e.tame && R.WI.animals[e.kind] && !R.WI.animals[e.kind].tameOnly);
    }
    return this.hereList;
  }
  // How many copies of the roster a crowd this size gets: 1, then one more for each 4 players, at most 4.
  copies() { return Math.min(COPIES, 1 + Math.floor(this.players.size / COPY_EVERY)); }
  crowd() { return Math.min(CROWD_MOST, Math.max(1, Math.ceil(this.players.size / CROWD_EACH))); }
  // Is a hunted slot still waiting? Its respawn minutes, divided by the crowd (the Great Mammoth's weekend is not a crowd's).
  waiting(slot, def) {
    const at = this.gone.get(slot);
    if (at == null) return false;
    const own = def.respawn || this.R.WI.respawn;
    const mins = def.great ? own : (def.rare ? own : Math.min(PUB_RESPAWN, own)) / this.crowd();
    if (this.game.now() - at >= mins * 60000) { this.gone.delete(slot); return false; }
    return true;
  }
  // The roster of copy c (0: the place's own slots; the others: 100 * c + slot, never a rare or great one: one of those).
  roster(c) {
    const WI = this.R.WI, list = this.here();
    if (!c) return list;
    return list.filter((e) => !WI.animals[e.kind].rare && !WI.animals[e.kind].great).map((e) => ({ slot: 100 * c + e.slot, kind: e.kind, when: e.when }));
  }

  // New ones walk in, as the game's wildArrive: each copy of the roster on its own 20-40 s timer, one at a time, a slot
  // that is due (not up, not waiting), the great one only with two or more here.
  arrive(dt) {
    const R = this.R, WI = R.WI, copies = this.copies(), up = new Set(this.mons.map((a) => a.slot));
    for (let c = 0; c < COPIES; c++) {
      this.next[c] -= dt;
      if (this.next[c] > 0) continue;
      this.next[c] = this.span(WI.arrive[0], WI.arrive[1]);
      if (c >= copies) continue;
      const due = this.roster(c).filter((e) => {
        const def = WI.animals[e.kind];
        return !up.has(e.slot) && (this.players.size >= 2 || !def.great) && !this.waiting(e.slot, def);
      });
      if (!due.length) continue;
      const e = due[Math.floor(this.game.rand() * due.length)];
      const a = this.game.wild.walkIn(this.fl, e.kind, e.slot, Array.from(this.players.values()), this.players.size);
      if (!a) continue;
      this.mons.push(a);
      up.add(a.slot);
    }
  }

  // One no longer about (its hour, the rain or the weekend is over, or a copy the crowd no longer brings) walks off once
  // nobody can see it (VIEW tiles from everyone), unless it is busy running or charging.
  sweep() {
    const T = this.R.T, copies = this.copies(), keep = new Set();
    for (let c = 0; c < copies; c++) this.roster(c).forEach((e) => keep.add(e.slot));
    const ps = Array.from(this.players.values());
    for (let i = this.mons.length - 1; i >= 0; i--) {
      const a = this.mons[i];
      if (keep.has(a.slot) || a.mode === 'flee' || a.mode === 'charge') continue;
      if (ps.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < VIEW * T)) continue;
      this.mons.splice(i, 1);
      this.sent.delete(a.slot);
      this.goneNow.push(a.slot);
    }
  }

  // Hunted: as a cave's (the shares, `dn`), and its slot waits.
  down(a, last) {
    this.gone.set(a.slot, this.game.now());
    super.down(a, last);
  }
  cleared() {} // (a public room never sends `cl`)

  // ---------- phones coming and going ----------
  join(conn, uid, hi) {
    const R = this.R, T = R.T, now = this.game.now();
    let p = this.players.get(uid);
    if (!p && this.players.size >= this.cap) return 'full';
    const fresh = !p;
    if (p) {
      if (p.conn && p.conn !== conn) this.game.replaced(p.conn);
    } else {
      p = { id: uid, seq: ++this.seq, lastHit: {}, speed: 0, mvAt: 0, view: new Set(), arSec: 0, arN: 0 };
      this.players.set(uid, p);
    }
    this.recent.delete(uid);
    p.conn = conn;
    p.name = clean(hi.name, 24) || 'Farmer';
    p.look = hi.look === 'girl' ? 'girl' : 'boy';
    p.x = num(hi.x, 0, this.fl.W * T, this.fl.W * T / 2);
    p.y = num(hi.y, 0, this.fl.H * T, this.fl.H * T / 2);
    p.dir = this.dirOf(hi.dir, 'down');
    p.m = 0;
    p.hg = num(hi.hg, 0, 0xffff, 0) | 0;
    p.sk = hi.sk ? 1 : 0;
    p.b = hi.b ? 1 : 0;
    p.bk = 0; // (unused here)
    p.lk = lookOf(hi.lk);
    p.speed = 0;
    p.mvAt = now;
    conn.room = this;
    conn.player = p;
    this.emptySince = 0;
    this.crew();
    if (!this.started) { // the place as a first visitor finds it, around this first phone (setupWild)
      this.started = true;
      this.mons = this.game.wild.populatePlace(this.fl, this.roster(0), { x: p.x, y: p.y });
      this.mons.forEach((a) => this.sent.set(a.slot, this.pack(a).join(',')));
    }
    if (!fresh) this.moved.add(p.id);
    const view = this.viewOf(p, null);
    p.view = new Set(view.map((q) => q.id));
    this.send(p, { t: 'wl', you: p.id, tick: this.game.tickMs, mons: this.mons.map((a) => this.pack(a)), ppl: view.map((q) => this.pplRow(q)), cap: this.cap, ch: this.ch, here: this.players.size, n: this.n, st: now });
    this.baits.forEach((b) => { if (b.id !== p.id && b.until > now) this.send(p, { t: 'bt', id: b.id, x: b.x, y: b.y, until: b.until }); });
    return null;
  }

  leave(conn, closed) {
    const p = conn.player;
    const mine = p && p.conn === conn;
    super.leave(conn);
    if (!mine) return;
    if (closed) {
      this.recent.set(p.id, this.game.now());
      if (this.recent.size > 200) this.recent.forEach((t, id) => { if (this.game.now() - t > 30000) this.recent.delete(id); });
    }
    if (!this.players.size) this.game.dropRoom(this); // (an empty public room goes at once)
  }

  // The players p hears of: within VIEW tiles, the VIEW_MAX nearest. `had` (the ones in view now) stay a little further
  // and outrank a newcomer a little, so nobody blinks in and out at the edge.
  viewOf(p, had) {
    const T = this.R.T, near = VIEW * VIEW * T * T, keep = (VIEW + VIEW_KEEP) * (VIEW + VIEW_KEEP) * T * T, out = [];
    this.players.forEach((q) => {
      if (q === p) return;
      const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, was = !!(had && had.has(q.id));
      if (d2 > (was ? keep : near)) return;
      const d = Math.sqrt(d2);
      out.push({ q, k: was ? d - VIEW_KEEP * T : d });
    });
    if (out.length > VIEW_MAX) { out.sort((a, b) => a.k - b.k); out.length = VIEW_MAX; }
    return out.map((o) => o.q);
  }

  // ---------- what a phone says (beyond a cave's) ----------
  // Bait: one a phone at a time, for WI.baitMins (and the 30 s the game gives it); the nearest shy animal goes to it.
  bait(p, msg) {
    const R = this.R, T = R.T, now = this.game.now(), had = this.baits.get(p.id);
    if (had && had.until > now) return;
    const x = num(msg.x, 0, this.fl.W * T, NaN), y = num(msg.y, 0, this.fl.H * T, NaN);
    if (!isFinite(x) || !isFinite(y)) return;
    if (had) had.gone = true;
    const b = { id: p.id, x: Math.round(x), y: Math.round(y), until: now + R.WI.baitMins * 60000 + 30000 };
    this.baits.set(p.id, b);
    this.game.wild.layBait(this.fl, this.mons, b);
    this.broadcast({ t: 'bt', id: b.id, x: b.x, y: b.y, until: b.until }, p);
  }

  // An arrow in flight: only for the look (it never hurts anything here: `hit` does), to the phones that see the shooter.
  arrow(p, msg) {
    const T = this.R.T, sec = Math.floor(this.game.now() / 1000);
    if (sec !== p.arSec) { p.arSec = sec; p.arN = 0; }
    if (++p.arN > AR_MAX) return;
    const x = num(msg.x, 0, this.fl.W * T, NaN), y = num(msg.y, 0, this.fl.H * T, NaN), a = num(msg.a, -7, 7, NaN);
    if (!isFinite(x) || !isFinite(y) || !isFinite(a)) return;
    const s = JSON.stringify({ t: 'ar', id: p.id, x: Math.round(x), y: Math.round(y), a: Math.round(a * 1000) / 1000, l: Math.round(num(msg.l, 0, 8 * T, 0)), b: num(msg.b, 0, 3, 0) | 0 });
    this.players.forEach((q) => { if (q !== p && q.conn && q.view.has(p.id)) this.game.sendRaw(q.conn, s); });
  }

  // A wave or a reaction ('Hi!', a heart...): to the phones that can see them, as an arrow in flight (at most 2 a second).
  emote(p, msg) {
    const sec = Math.floor(this.game.now() / 1000);
    if (sec !== p.emSec) { p.emSec = sec; p.emN = 0; }
    if (++p.emN > 2 || typeof msg.k !== 'string' || !EMOTES[msg.k]) return;
    const s = JSON.stringify({ t: 'em', id: p.id, k: msg.k });
    this.players.forEach((q) => { if (q !== p && q.conn && q.view.has(p.id)) this.game.sendRaw(q.conn, s); });
  }

  say(p, msg) {
    const now = this.game.now();
    if (typeof msg.s !== 'string') return;
    const s = msg.s.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
    if (!s) return;
    p.says = (p.says || []).filter((t) => now - t < 60000);
    if (p.says.length >= SAY_MINUTE || (p.says.length && now - p.says[p.says.length - 1] < SAY_GAP)) return;
    p.says.push(now);
    this.broadcast({ t: 'say', id: p.id, n: p.name, s }, p);
  }

  // ---------- every 50 ms ----------
  step(dt) {
    if (!this.players.size || !this.started) return;
    this.n++;
    const W = this.game.wild, fl = this.fl, now = this.game.now();
    this.baits.forEach((b, id) => { if (b.until <= now) { b.gone = true; this.baits.delete(id); } });
    this.arrive(dt);
    if ((this.sweepIn -= dt) <= 0) { this.sweepIn = SWEEP; this.sweep(); }
    const reach = (a, p) => this.send(p, { t: 'bp', s: a.slot, hit: a.def.hit || 0 });
    for (let i = 0; i < this.mons.length; i++) W.updateWild(fl, this.mons[i], dt, reach);
    this.tell();
  }

  // What changed, to each phone: every animal that changed (all of them: a place has under 40), and of the players only
  // the ones it sees: who came into view (`come`, the whole row), went out of it (`left`), and moved (`p`).
  tell() {
    const m = [];
    this.mons.forEach((a) => {
      const row = this.pack(a), s = row.join(',');
      if (this.sent.get(a.slot) === s) return;
      this.sent.set(a.slot, s);
      m.push(row);
    });
    const moved = new Map(), rows = new Map();
    this.moved.forEach((id) => { const p = this.players.get(id); if (p) moved.set(id, JSON.stringify(p.mc ? [id, Math.round(p.x), Math.round(p.y), p.dir, p.m, p.mc] : [id, Math.round(p.x), Math.round(p.y), p.dir, p.m])); });
    const rowOf = (q) => { let s = rows.get(q.id); if (!s) rows.set(q.id, (s = JSON.stringify(this.pplRow(q)))); return s; };
    // how many are in the whole room (the phone's "Banaue 2 · 23 here"), when it changed
    const here = this.players.size, newHere = here !== this.hereSent;
    this.hereSent = here;
    const shared = m.length || this.goneNow.length || newHere;
    const head = '{"t":"tk","n":' + this.n + ',"st":' + this.game.now() + (newHere ? ',"here":' + here : '') + ',"m":' + JSON.stringify(m) + ',"gone":' + JSON.stringify(this.goneNow);
    this.players.forEach((p) => {
      if (!p.conn || this.game.behind(p.conn)) return; // (far behind: this tick waits, so its view's news is not lost)
      const now = this.viewOf(p, p.view), ids = new Set(), pm = [], come = [], left = [];
      now.forEach((q) => {
        ids.add(q.id);
        if (!p.view.has(q.id)) come.push(rowOf(q));
        else if (moved.has(q.id)) pm.push(moved.get(q.id));
      });
      p.view.forEach((id) => { if (!ids.has(id)) left.push(id); });
      p.view = ids;
      if (!shared && !pm.length && !come.length && !left.length) return;
      this.game.sendRaw(p.conn, head + ',"p":[' + pm.join(',') + '],"left":' + JSON.stringify(left) + ',"come":[' + come.join(',') + ']}');
    });
    this.goneNow = [];
    this.leftNow = [];
    this.comeNow = [];
    this.moved.clear();
  }
}

module.exports = { PubRoom, isPubMap, sharedState, lookOf, PUB_CAP, VIEW, VIEW_MAX, VIEW_KEEP, COPIES, AR_MAX };
