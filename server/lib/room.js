// One room: one cave floor of one farm's world (`topic|map|floor`), up to 8 phones (docs/game-server.md). It owns the
// floor's monsters: it makes them as a first visitor would find them, runs them at 20 Hz with the game's rules
// (lib/wild.js), takes the phones' hits, and tells every phone what changed (`tk`), each hit (`hp`), each kill (`dn`),
// a charge that reached one of them (`bp`, to that phone only) and the floor cleared (`cl`).
'use strict';

const HIT_GAP = 150; // ms: at most one hit per phone per monster in this time
const HIT_REACH = 12; // tiles: a hit from further than this from the monster is not counted (the longest bow is 7 + 1)
const DIRS = { down: 1, up: 1, left: 1, right: 1, side: 1 };

const num = (v, lo, hi, def) => { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
// a name or a look others will see: no control or invisible characters, at most `max` long
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
// how a player looks, from their `hi` (O.myState): the look they wear (64 at most), the party hat, on their horse
const lookOf = (lk) => {
  const o = lk && typeof lk === 'object' && !Array.isArray(lk) ? lk : {};
  return { cs: clean(o.cs, 64), pt: o.pt ? 1 : 0, rd: o.rd ? 1 : 0 };
};

class Room {
  constructor(game, key, topic, map, floor, cfg, mapData) {
    const R = game.R;
    this.game = game;
    this.R = R;
    this.key = key;
    this.topic = topic;
    this.map = map;
    this.floor = floor;
    this.cfg = cfg;
    this.cap = game.cap;
    this.players = new Map(); // id -> player
    this.mons = []; // the monsters still up
    this.started = false; // (the monsters are made when the first phone comes)
    this.clear = false;
    this.n = 0;
    this.seq = 0; // (the order they joined in: a phone's wl already has everyone before it)
    this.emptySince = game.now();
    // the floor the monsters walk on
    this.fl = {
      T: R.T, W: mapData.W, H: mapData.H, zone: mapData.zone, rand: game.rand, crew: [],
      free: game.maps.floorGround(mapData, floor < cfg.floors),
    };
    // Lair floor 50: the Bakunawa walks in for two or more, once (19zt-lair.js wildArrive)
    const LA = R.C.LAIR;
    this.bakunawa = cfg.lair && floor === LA.bakunawaFloor ? { next: this.span(R.WI.arrive[0], R.WI.arrive[1]), done: false } : null;
    // what changed since the last tick
    this.sent = new Map(); // slot -> the packed row last sent
    this.goneNow = [];
    this.moved = new Set();
    this.leftNow = [];
    this.comeNow = [];
  }

  span(a, b) { return a + this.game.rand() * (b - a); }
  get size() { return this.players.size; }
  pack(a) { return this.R.L.wildPack(a); }
  // [id, name, look, x, y, dir, m] as in step 1, and an 8th, how they look (`lk`), when their phone said
  pplRow(p) { const r = [p.id, p.name, p.look, Math.round(p.x), Math.round(p.y), p.dir, p.m]; if (p.lk) r.push(p.lk); return r; }
  dirOf(v, def) { return typeof v === 'string' && DIRS[v] ? v : def; }

  send(p, msg) { if (p.conn) this.game.send(p.conn, msg); }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    this.players.forEach((p) => { if (p !== except && p.conn) this.game.sendRaw(p.conn, s); });
  }

  // ---------- phones coming and going ----------
  // A good `hi`: a new phone, or the same player back (a reconnect: their old socket is let go). Returns 'full' or null.
  join(conn, uid, hi) {
    const R = this.R, T = R.T, now = this.game.now();
    let p = this.players.get(uid);
    if (!p && this.players.size >= this.cap) return 'full';
    const x = num(hi.x, 0, this.fl.W * T, this.fl.W * T / 2), y = num(hi.y, 0, this.fl.H * T, this.fl.H * T / 2);
    const fresh = !p;
    if (p) {
      if (p.conn && p.conn !== conn) this.game.replaced(p.conn);
    } else {
      p = { id: uid, seq: ++this.seq, lastHit: {}, speed: 0, mvAt: 0 };
      this.players.set(uid, p);
    }
    p.conn = conn;
    p.name = typeof hi.name === 'string' ? hi.name.slice(0, 24) : 'Farmer';
    p.look = hi.look === 'girl' ? 'girl' : 'boy';
    p.x = x;
    p.y = y;
    p.dir = typeof hi.dir === 'string' && DIRS[hi.dir] ? hi.dir : 'down';
    p.m = 0;
    p.hg = num(hi.hg, 0, 0xffff, 0) | 0;
    p.sk = hi.sk ? 1 : 0;
    p.b = hi.b ? 1 : 0; // a menu open: the monsters do not see them (19v-wild.js wildCrew(!busy))
    p.bk = hi.bk ? 1 : 0; // their Bakunawa is ready today (L.bakunawaReady, on their phone)
    if (hi.lk && typeof hi.lk === 'object') p.lk = lookOf(hi.lk); else delete p.lk; // (how they look, passed on)
    p.speed = 0;
    p.mvAt = now;
    conn.room = this;
    conn.player = p;
    this.emptySince = 0;
    this.crew();
    if (!this.started) { // the floor as a first visitor finds it, around this first phone
      this.started = true;
      this.mons = this.game.wild.populate(this.fl, this.cfg, this.floor, { x, y });
      this.mons.forEach((a) => this.sent.set(a.slot, this.pack(a).join(',')));
      if (!this.mons.length && !this.bakunawa) this.clear = true;
    }
    this.grow();
    if (fresh) { this.comeNow.push(p.id); this.leftNow = this.leftNow.filter((id) => id !== p.id); }
    else this.moved.add(p.id);
    const others = [];
    this.players.forEach((q) => { if (q !== p) others.push(this.pplRow(q)); });
    this.send(p, { t: 'wl', you: p.id, tick: this.game.tickMs, mons: this.mons.map((a) => this.pack(a)), ppl: others, cap: this.cap, n: this.n, st: now });
    if (this.clear) this.send(p, { t: 'cl' }); // (a floor already cleared opens for a friend who comes later)
    return null;
  }

  // A phone left (bye, or its socket closed). A reconnect that already took its place leaves it be.
  leave(conn) {
    const p = conn.player;
    conn.room = null;
    conn.player = null;
    if (!p || p.conn !== conn) return;
    this.players.delete(p.id);
    this.moved.delete(p.id);
    this.comeNow = this.comeNow.filter((id) => id !== p.id);
    this.leftNow.push(p.id); // (even one who came within this tick: a phone that joined since has them in its wl)
    this.crew();
    if (!this.players.size) this.emptySince = this.game.now();
  }

  // Who the monsters can see: everyone here but those with a menu open.
  crew() { this.fl.crew = Array.from(this.players.values()).filter((p) => !p.b); }

  // A place's boss grows for each friend who comes down (19zzzzz-places.js update): hpEach more each, never less.
  grow() {
    if (this.cfg.lair) return;
    const crew = this.players.size;
    this.mons.forEach((a) => {
      if (!a.def.boss || !a.def.hpEach || !a.crew || crew <= a.crew) return;
      a.hp += a.def.hpEach * (crew - a.crew);
      a.max += a.def.hpEach * (crew - a.crew);
      a.crew = crew;
    });
  }

  // ---------- what a phone says ----------
  move(p, msg) {
    const T = this.R.T, now = this.game.now();
    const x = num(msg.x, 0, this.fl.W * T, p.x), y = num(msg.y, 0, this.fl.H * T, p.y);
    const m = msg.m ? 1 : 0, gap = Math.max(50, now - p.mvAt);
    // how fast they go (a shy one hears you rush): from their reports, smoothed a little against the network's jitter
    const v = m ? Math.min(this.R.C.SPEED * 3, Math.hypot(x - p.x, y - p.y) * 1000 / gap) : 0;
    p.speed = m ? (p.speed + v) / 2 : 0;
    p.mvAt = now;
    p.x = x;
    p.y = y;
    if (typeof msg.dir === 'string' && DIRS[msg.dir]) p.dir = msg.dir;
    p.m = m;
    if (msg.hg != null) p.hg = num(msg.hg, 0, 0xffff, 0) | 0;
    if (msg.sk != null) p.sk = msg.sk ? 1 : 0;
    if (msg.b != null && (msg.b ? 1 : 0) !== p.b) { p.b = msg.b ? 1 : 0; this.crew(); }
    this.moved.add(p.id);
  }

  hit(p, msg) {
    const R = this.R, now = this.game.now(), slot = Number(msg.s), n = num(msg.n, 0, 1e9, 0);
    const a = this.mons.filter((x) => x.slot === slot)[0];
    if (!a) return; // (down already: its `dn` is on the way)
    const raw = Number(msg.d);
    if (!isFinite(raw) || raw <= 0) return;
    const d = Math.max(1, Math.min(R.maxDamage, Math.floor(raw)));
    const last = p.lastHit[slot] || 0;
    // too soon after this phone's last hit on it, or from too far: not counted (the phone's bar is put right)
    if (now - last < HIT_GAP || Math.hypot(a.x - p.x, a.y - p.y) > HIT_REACH * R.T) {
      this.send(p, { t: 'hp', s: a.slot, hp: a.hp, by: p.id, n });
      return;
    }
    p.lastHit[slot] = now;
    const down = this.game.wild.wildStruck(this.fl, a, p, d);
    this.broadcast({ t: 'hp', s: a.slot, hp: Math.max(0, a.hp), by: p.id, n });
    if (down) this.down(a, p.id);
  }

  // Hunted: everyone with a share (its minHits hits, and whoever landed the last one) gives themselves the drops.
  down(a, last) {
    this.mons.splice(this.mons.indexOf(a), 1);
    this.sent.delete(a.slot);
    this.goneNow.push(a.slot);
    const need = a.def.minHits || 1;
    const by = Object.keys(a.hits).filter((id) => a.hits[id] >= need);
    if (last && by.indexOf(last) < 0) by.push(last);
    this.broadcast({ t: 'dn', s: a.slot, kind: a.kind, x: Math.round(a.x), y: Math.round(a.y), by, size: Math.round(a.size * 100) / 100 });
    if (!this.mons.length) this.cleared();
  }

  cleared() {
    if (this.clear) return;
    this.clear = true;
    this.broadcast({ t: 'cl' });
  }

  // ---------- every 50 ms ----------
  step(dt) {
    if (!this.players.size || !this.started) return;
    this.n++;
    const W = this.game.wild, fl = this.fl;
    this.arrive(dt);
    const reach = (a, p) => this.send(p, { t: 'bp', s: a.slot, hit: a.def.hit || 0 });
    for (let i = 0; i < this.mons.length; i++) W.updateWild(fl, this.mons[i], dt, reach);
    this.tell();
  }

  arrive(dt) {
    const b = this.bakunawa, R = this.R;
    if (!b || b.done) return;
    b.next -= dt;
    if (b.next > 0) return;
    b.next = this.span(R.WI.arrive[0], R.WI.arrive[1]);
    // two hunters or more, and at least two whose Bakunawa is ready today (each phone keeps its own day)
    let ready = 0;
    this.players.forEach((p) => { if (p.bk) ready++; });
    if (this.players.size < 2 || ready < 2) return;
    const e = this.cfg.roster(this.floor).filter((x) => R.WI.animals[x.kind].great && !this.mons.some((a) => a.slot === x.slot))[0];
    if (!e) return;
    const a = this.game.wild.bakunawaRises(this.fl, e.slot, this.players.size);
    if (!a) return;
    b.done = true;
    this.mons.push(a);
    this.clear = false;
  }

  // What changed, to every phone: monsters that moved or changed, slots gone, players that moved, came or left.
  tell() {
    const m = [];
    this.mons.forEach((a) => {
      const row = this.pack(a), s = row.join(',');
      if (this.sent.get(a.slot) === s) return;
      this.sent.set(a.slot, s);
      m.push(row);
    });
    const moved = [], come = [];
    this.moved.forEach((id) => { const p = this.players.get(id); if (p) moved.push({ id, s: JSON.stringify([id, Math.round(p.x), Math.round(p.y), p.dir, p.m]) }); });
    this.comeNow.forEach((id) => { const p = this.players.get(id); if (p) come.push({ id, seq: p.seq, s: JSON.stringify(this.pplRow(p)) }); });
    const shared = m.length || this.goneNow.length || this.leftNow.length;
    if (shared || moved.length || come.length) {
      const head = '{"t":"tk","n":' + this.n + ',"st":' + this.game.now() + ',"m":' + JSON.stringify(m) + ',"gone":' + JSON.stringify(this.goneNow) + ',"left":' + JSON.stringify(this.leftNow);
      this.players.forEach((p) => {
        if (!p.conn) return;
        const pm = moved.filter((x) => x.id !== p.id), pc = come.filter((x) => x.seq > p.seq); // (not yourself, nor one your wl had)
        if (!shared && !pm.length && !pc.length) return; // (only they moved)
        this.game.sendRaw(p.conn, head + ',"p":[' + pm.map((x) => x.s).join(',') + '],"come":[' + pc.map((x) => x.s).join(',') + ']}', true);
      });
    }
    this.goneNow = [];
    this.leftNow = [];
    this.comeNow = [];
    this.moved.clear();
  }
}

module.exports = { Room, HIT_GAP, HIT_REACH, num, clean, lookOf };
