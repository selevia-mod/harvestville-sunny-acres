// The game server's heart, with no network in it (lib/server.js puts it on a WebSocket): the rooms, each phone's
// connection, every message in (docs/game-server.md "Phone -> server") and the 20 Hz tick. A connection is anything
// with send(string) and close(code, reason), so the tests drive it with fake phones.
'use strict';
const { rules } = require('./rules');
const { makeMaps } = require('./maps');
const makeWild = require('./wild');
const { Room } = require('./room');
const { PubRoom, isPubMap } = require('./pub');

const VERSION = 1;
const TOPIC = /^farm:[0-9a-f-]{36}$/; // a farm's live room (step 1: caves only; the park comes later)
const ROOM_KEEP = 30000; // ms an empty floor stays as it is (a dropped phone comes back to the same monsters)
const HELLO_WAIT = 10000; // ms to say `hi` after connecting
const IDLE = 20000; // ms with nothing heard (a phone pings every 2 s): its socket is closed
const MSG_MAX = 60; // messages a second a phone may send (more are dropped; three times that closes it)
const BUSY_BYTES = 1 << 20; // a phone this far behind on what we sent misses ticks until it catches up
// the socket's close code after a `no` (4001 replaced by a reconnect, 4002 no hi, 4003 quiet)
const REFUSED = { auth: 4010, topic: 4011, full: 4012, version: 4013 };

class Game {
  constructor(opts) {
    const o = opts || {};
    this.R = o.rules || rules();
    this.maps = makeMaps(this.R);
    this.wild = makeWild(this.R);
    this.auth = o.auth; // { check(token, topic) -> Promise<{ uid } | { why }> }
    this.now = o.now || Date.now;
    this.rand = o.rand || Math.random;
    this.cap = o.cap || 8;
    this.pubCap = o.pubCap || 0; // (0: PUB_CAP)
    this.pub = new Map(); // a hunting place -> its public rooms (n -> room)
    this.tickMs = 50;
    this.log = o.log || (() => {});
    this.rooms = new Map();
    this.conns = new Set();
    this.last = this.now();
    this.stats = { in: 0, out: 0, bytesOut: 0, slowest: 0, ticks: 0, since: this.now() };
  }

  // ---------- connections ----------
  connect(sock) {
    const c = { sock, room: null, player: null, said: false, busy: false, open: true, at: this.now(), heard: this.now(), sec: 0, count: 0 };
    this.conns.add(c);
    return c;
  }

  sendRaw(c, s, droppable) {
    if (!c.open) return;
    if (droppable && c.sock.bufferedAmount > BUSY_BYTES) return; // (a slow phone skips ticks; the next one has the news)
    this.stats.out++;
    this.stats.bytesOut += s.length;
    try { c.sock.send(s); } catch (e) { /* (closing) */ }
  }
  send(c, msg) { this.sendRaw(c, JSON.stringify(msg)); }

  close(c, code, why) {
    if (!c.open) return;
    this.closed(c);
    try { c.sock.close(code || 1000, why || ''); } catch (e) { /* (gone) */ }
  }
  closed(c) {
    if (!c.open) return;
    c.open = false;
    if (c.room) c.room.leave(c, true);
    this.conns.delete(c);
  }
  // the same player came back on a new socket: the old one goes
  replaced(c) {
    c.room = null;
    c.player = null;
    this.close(c, 4001, 'replaced');
  }
  refuse(c, why) {
    this.send(c, { t: 'no', why });
    this.close(c, REFUSED[why] || 4010, why);
  }

  // ---------- messages ----------
  message(c, raw) {
    if (!c.open) return;
    const now = this.now();
    this.stats.in++;
    c.heard = now;
    const sec = Math.floor(now / 1000);
    if (sec !== c.sec) { c.sec = sec; c.count = 0; }
    if (++c.count > MSG_MAX) { if (c.count > MSG_MAX * 3) this.close(c, 1008, 'too many'); return; }
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    if (msg.t === 'hi') return this.hello(c, msg);
    if (msg.t === 'pi') return this.send(c, { t: 'po', c: Number(msg.c) || 0, st: now });
    const room = c.room, p = c.player;
    if (!room || !p) return;
    if (msg.t === 'mv') room.move(p, msg);
    else if (msg.t === 'hit') room.hit(p, msg);
    else if (msg.t === 'bye') room.leave(c);
    else if (room.pub && msg.t === 'bt') room.bait(p, msg); // (a cave's bait and arrows stay on the old relay: step 1)
    else if (room.pub && msg.t === 'ar') room.arrow(p, msg);
  }
  // A phone this far behind on what we sent (it misses ticks until it catches up).
  behind(c) { return c.sock.bufferedAmount > BUSY_BYTES; }

  async hello(c, hi) {
    if (c.busy) return;
    if (hi.v !== VERSION) return this.refuse(c, 'version');
    if (hi.topic === 'pub') return this.helloPub(c, hi);
    const cfg = this.R.dungeonOf(hi.map), floor = Math.floor(Number(hi.floor));
    const map = cfg ? this.maps.get(cfg.key) : null;
    if (typeof hi.topic !== 'string' || !TOPIC.test(hi.topic) || !map || !map.zone || !(floor >= 1 && floor <= cfg.floors)) return this.refuse(c, 'topic');
    if (typeof hi.token !== 'string' || !hi.token || hi.token.length > 4096) return this.refuse(c, 'auth');
    c.busy = true;
    c.said = true;
    let r;
    try { r = await this.auth.check(hi.token, hi.topic); } catch (e) { r = { why: 'auth' }; }
    c.busy = false;
    if (!c.open) return;
    if (!r || !r.uid) return this.refuse(c, r && r.why === 'topic' ? 'topic' : 'auth');
    if (c.room) c.room.leave(c); // (a new floor on the same socket)
    const key = hi.topic + '|' + cfg.key + '|' + floor;
    let room = this.rooms.get(key);
    if (!room) { room = new Room(this, key, hi.topic, cfg.key, floor, cfg, map); this.rooms.set(key, room); }
    const no = room.join(c, String(r.uid), hi);
    if (no) return this.refuse(c, no);
  }

  // A hunting place, open to everyone (docs/game-server.md "Step 2"): any good token; the server picks the room.
  async helloPub(c, hi) {
    const map = hi.map;
    if (!isPubMap(this.R, this.maps, map)) return this.refuse(c, 'topic');
    if (typeof hi.token !== 'string' || !hi.token || hi.token.length > 4096) return this.refuse(c, 'auth');
    c.busy = true;
    c.said = true;
    let r;
    try { r = await this.auth.check(hi.token, 'pub'); } catch (e) { r = { why: 'auth' }; }
    c.busy = false;
    if (!c.open) return;
    if (!r || !r.uid) return this.refuse(c, 'auth');
    if (c.room) c.room.leave(c); // (another place, or a cave, on the same socket)
    const uid = String(r.uid), room = this.pickPub(map, uid, typeof hi.with === 'string' ? hi.with.slice(0, 64) : '');
    const no = room.join(c, uid, hi);
    if (no) return this.refuse(c, no); // (never: the room picked has space)
  }

  // Which room of a place: where this player already is (a second socket takes their place back); else the `with`
  // player's, if it has space; else the one they were in a moment ago (a dropped line, 30 s); else the fullest with
  // space (so a place feels alive; the lowest number first); else a new one, the lowest free number.
  pickPub(map, uid, withId) {
    let list = this.pub.get(map);
    if (!list) this.pub.set(map, (list = new Map()));
    const rooms = Array.from(list.values()).sort((a, b) => a.ch - b.ch), now = this.now();
    const space = (r) => r.players.size < r.cap;
    let room = rooms.filter((r) => r.players.has(uid))[0]
      || (withId && withId !== uid ? rooms.filter((r) => r.players.has(withId) && space(r))[0] : null)
      || rooms.filter((r) => space(r) && r.recent.has(uid) && now - r.recent.get(uid) < 30000)[0];
    if (!room) {
      rooms.forEach((r) => { if (space(r) && (!room || r.players.size > room.players.size)) room = r; });
    }
    if (!room) {
      let n = 1;
      while (list.has(n)) n++;
      room = new PubRoom(this, map, n, this.maps.get(map));
      list.set(n, room);
      this.rooms.set(room.key, room);
    }
    return room;
  }
  // An empty public room goes at once (a new one is made fresh).
  dropRoom(room) {
    if (this.rooms.get(room.key) === room) this.rooms.delete(room.key);
    const list = this.pub.get(room.map);
    if (list && list.get(room.ch) === room) list.delete(room.ch);
  }

  // ---------- every 50 ms ----------
  tick() {
    const now = this.now(), dt = Math.max(0, Math.min(100, now - this.last)), t0 = process.hrtime.bigint();
    this.last = now;
    this.rooms.forEach((room, key) => {
      if (room.players.size) room.step(dt);
      else if (room.pub || now - room.emptySince > ROOM_KEEP) { if (room.pub) this.dropRoom(room); else this.rooms.delete(key); }
    });
    // phones that never said hi, or went quiet
    this.conns.forEach((c) => {
      if (!c.said && now - c.at > HELLO_WAIT) this.close(c, 4002, 'no hi');
      else if (now - c.heard > IDLE) this.close(c, 4003, 'quiet');
    });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    this.stats.ticks++;
    if (ms > this.stats.slowest) this.stats.slowest = ms;
    return ms;
  }

  // The minute's numbers (and they start again): rooms, players, messages a second, the slowest tick.
  report() {
    const now = this.now(), s = this.stats, secs = Math.max(0.001, (now - s.since) / 1000);
    let players = 0, pub = 0, pubPlayers = 0;
    this.rooms.forEach((r) => { players += r.players.size; if (r.pub) { pub++; pubPlayers += r.players.size; } });
    const out = { rooms: this.rooms.size, players, pub, pubPlayers, conns: this.conns.size, inPerSec: s.in / secs, outPerSec: s.out / secs, kbOutPerSec: s.bytesOut / 1024 / secs, slowestMs: s.slowest, ticks: s.ticks };
    this.stats = { in: 0, out: 0, bytesOut: 0, slowest: 0, ticks: 0, since: now };
    return out;
  }

  shutdown() { Array.from(this.conns).forEach((c) => this.close(c, 1001, 'server restarting')); }
}

module.exports = { Game, VERSION, ROOM_KEEP, IDLE };
