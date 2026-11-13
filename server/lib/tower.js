// The Lost Tower on the game server (docs/game-server.md "Step 4"; the spec docs/superpowers/specs/2026-11-12-lost-tower-design.md,
// "Friends on a floor"; the phone's side src/19zzz...z-tower-friends.js). A tower floor is a cave room (lib/room.js), the
// key `<farm topic>|tower|<floor>`, up to C.TOWER.team (4) players, friends put together by `with` as on any cave floor.
// Its map is built from the floor's number (L.towerMap, lib/maps.js), its enemies are the floor's roster (L.towerRoster:
// the same for everyone, never more for a team), as strong as the floor makes them, and the server runs the realms'
// tricks that move or change an enemy, as the phone does alone (src/19zzz...z-tower-tricks.js):
//   shield  only a Rifle's hit (`k: 'rifle'`) breaks it ('sh' to all), and is spent on it; any other bounces (no damage)
//   heal    every 4 s a healer mends the most hurt one near it ('hl' to all; its new hp in the next tick)
//   flock   its fliers circle a player and dive together (the nearest player to the flock); a dive that reaches one: 'bp'
//   split   a beaten splitter becomes two copies, slots L.towerCopySlot (10000 up), with half its hits
//   revive  a beaten reviver lies 3 s ('ly', its hp a sliver above 0), then stands with half its hits ('up'), unless hit again
//   food    a hit's `pw` (the hitter's Tower dish): Nido Soup, Bicol Express, Halo-halo ng Biringan soften the three above
//   waves   C.TOWER.wave > 0: the next wave comes when the last is mostly down ('wv')
// The phone does the rest itself (the song, the dark, the puddles: they only change what that phone sees or does).
// The last enemy down: 'cl' with `pay: 1` and `nw` (how many on the floor had never cleared it, from each phone's `tn`) to
// everyone on the floor then, and to a player whose line had dropped (30 s) when they come back; each phone pays itself
// (L.towerTeamPay). A player who comes to a cleared floor later gets 'cl' without `pay`.
'use strict';

module.exports = function makeTower(R, W) {
  const { C, L, WI, T, F } = R;
  const TW = C.TOWER, TR = F.towerTricks || {};
  if (!TW || !L.towerRoster) return null;
  const COPY = L.towerCopySlot ? L.towerCopySlot(0, 0) : 10000;
  const span = (fl, a, b) => a + fl.rand() * (b - a);
  const LYING = 0.001; // a lying reviver's hits
  const has = (r, id) => !!(L.towerHas && L.towerHas(r.floor, id));
  const TF = C.TOWER_FOOD;
  const as = (pw) => (L.towerPowerState ? L.towerPowerState(pw) : null) || undefined; // (a hitter's dish, for the game's own rules)

  // a tower room's own state
  const state = (r) => ({
    tn: new Map(), // player id -> 1: this floor is new to them (their hi's `tn`)
    owed: new Set(), // players whose line had dropped when the floor was cleared: paid when they come back
    nw: 0, // at the clear: how many of the floor's players had never cleared it
    roster: L.towerRoster(r.floor),
    placed: new Set(), // the roster's slots put out so far (the waves)
    wave: 0,
    broken: new Set(), // shields broken
    flockOf: has(r, 'flock') ? L.towerFlocks(r.floor) : {}, // slot -> its flock's number
    flocks: {},
    ring: [0, 0],
  });

  // What an enemy carries (L.towerFlags); a splitter's copy: its parent's, but never a shield, a flock, a split or a revive.
  const flagsOf = (f, kind, slot) => {
    if (!L.towerFlags) return {};
    if (slot < COPY) return L.towerFlags(f, kind, slot, false);
    return Object.assign(L.towerFlags(f, kind, Math.floor((slot - COPY) / 2), false), { shield: false, flock: false, split: false, revive: false });
  };
  // as strong as its floor (19zzz...z-tower.js lairStrength): hits, the energy a charge costs, its speed; and its tricks
  const strengthen = (r, a, hp) => {
    const f = r.floor, def = WI.animals[a.kind], role = def.role === 'normal' ? null : def.role, sp = L.towerSpeed(f);
    a.hp = a.max = hp || L.towerHits(f, role);
    a.def = Object.assign({}, def, { hp: a.max, hit: L.towerLoss(f, role), walk: def.walk * sp, run: def.run * sp });
    const tf = flagsOf(f, a.kind, a.slot);
    a.shield = !!tf.shield && !r.tw.broken.has(a.slot);
    a.heal = !!tf.heal;
    a.split = !!tf.split;
    a.revive = !!tf.revive;
    if (a.heal) a.healT = span(r.fl, 0.3, 1) * TR.heal.every; // (not all at once)
    if (tf.flock) joinFlock(r, a);
  };

  // ---------- the floor's enemies ----------
  // one of the roster on the floor: away from the players if it can be (6 tiles, then 3), else anywhere free
  const place = (r, e, from) => {
    const fl = r.fl, near = fl.crew.length ? fl.crew : from ? [from] : null;
    r.tw.placed.add(e.slot);
    const p = W.wildSpot(fl, fl.zone, near, 6) || W.wildSpot(fl, fl.zone, near, 3) || W.wildSpot(fl, fl.zone, null, 0);
    if (!p) return null;
    const a = W.make(fl, e.kind, e.slot, p.x, p.y, 1);
    strengthen(r, a);
    return a;
  };
  const populate = (r, from) => L.towerInWave(r.tw.roster, 0, TW.wave).map((e) => place(r, e, from)).filter(Boolean);
  // enemies still to beat: on the floor (copies too), and the waves to come
  const left = (r) => r.mons.length + r.tw.roster.length - r.tw.placed.size;
  // the next wave, when the last is mostly down
  const waves = (r) => {
    const size = TW.wave, tw = r.tw;
    if (!(size > 0)) return;
    const of = L.towerWaves(tw.roster.length, size);
    if (tw.wave + 1 >= of || !L.towerWaveDue(size, r.mons.length)) return;
    tw.wave++;
    L.towerInWave(tw.roster, tw.wave, size).forEach((e) => {
      if (tw.placed.has(e.slot)) return;
      const a = place(r, e);
      if (a) r.mons.push(a);
    });
    r.broadcast({ t: 'wv', n: tw.wave + 1, of });
  };

  // ---------- flocks (19zzz...z-tower-tricks.js stepFlock / flockMember, round the nearest player) ----------
  const joinFlock = (r, a) => {
    const n = r.tw.flockOf[a.slot];
    if (n == null) return;
    const fl = r.fl, fs = r.tw.flocks[n] || (r.tw.flocks[n] = { n, members: [], x: a.x, y: a.y, ang: span(fl, 0, 6.3), orb: span(fl, 0, 6.3),
      spin: fl.rand() < 0.5 ? -1 : 1, mode: 'circle', t: span(fl, TR.flock.rest[0], TR.flock.rest[1]), c: null, hit: false });
    if (fs.members.indexOf(a) < 0) fs.members.push(a);
    a.fs = fs;
  };
  const leaveFlock = (a) => {
    const m = a.fs && a.fs.members, i = m ? m.indexOf(a) : -1;
    if (i >= 0) m.splice(i, 1);
    a.fs = null;
  };
  const toward = (o, x, y, most) => {
    const dx = x - o.x, dy = y - o.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= most || d < 1) { o.x = x; o.y = y; return d; }
    o.x += dx / d * most;
    o.y += dy / d * most;
    return d;
  };
  const stepFlock = (r, fs, dt) => {
    const lead = fs.members[0], fl = r.fl;
    if (!lead) return;
    let c = null, bd = Infinity;
    fl.crew.forEach((p) => { const d = Math.hypot(fs.x - p.x, fs.y - p.y); if (d < bd) { bd = d; c = p; } });
    fs.c = c;
    if (!c) return;
    const def = lead.def, z = fl.zone, RR = TR.flock.circle * T, s = dt / 1000;
    fs.ang += fs.spin * dt * 0.0025;
    fs.t -= dt;
    if (fs.mode === 'circle') {
      fs.orb += fs.spin * dt * 0.0005;
      toward(fs, c.x + Math.cos(fs.orb) * RR, c.y + Math.sin(fs.orb) * RR * 0.8, def.walk * 2.2 * T * s);
      const near = Math.hypot(fs.x - c.x, fs.y - c.y) < RR + 3 * T;
      if (fs.t <= 0 && def.angry > 0 && near) { fs.mode = 'dive'; fs.t = TR.flock.dive; fs.hit = false; } else if (fs.t <= 0) fs.t = 600;
    } else if (fs.mode === 'dive') {
      toward(fs, c.x, c.y, def.run * 1.15 * T * s);
      if (fs.t <= 0) { fs.mode = 'back'; fs.t = TR.flock.back; }
    } else {
      const dx = fs.x - c.x, dy = fs.y - c.y, d = Math.max(1, Math.hypot(dx, dy));
      toward(fs, fs.x + dx / d * T, fs.y + dy / d * T, def.walk * 2.2 * T * s);
      if (fs.t <= 0) { fs.mode = 'circle'; fs.t = span(fl, TR.flock.rest[0], TR.flock.rest[1]); }
    }
    fs.x = Math.max((z.x0 + 0.5) * T, Math.min((z.x1 + 0.5) * T, fs.x));
    fs.y = Math.max((z.y0 + 0.5) * T, Math.min((z.y1 + 0.5) * T, fs.y));
  };
  const flockMember = (r, a, dt, frozen, reach) => {
    const fs = a.fs, c = fs.c, x0 = a.x, y0 = a.y;
    if (!frozen && c) {
      L.towerRing(fs.members.indexOf(a), fs.members.length, fs.ang, r.tw.ring);
      toward(a, fs.x + r.tw.ring[0] * T, fs.y + r.tw.ring[1] * T, a.def.run * 1.5 * T * dt / 1000);
      if (!a.def.flies && !W.wildFree(r.fl, Math.floor(a.x / T), Math.floor(a.y / T))) { a.x = x0; a.y = y0; } // (on foot: round the rocks)
    }
    const ms = Math.max(1, dt) / 1000;
    a.vx = Math.abs(a.x - x0) > 0.5 ? (a.x - x0) / ms : 0;
    a.vy = Math.abs(a.y - y0) > 0.5 ? (a.y - y0) / ms : 0;
    a.mode = fs.mode === 'dive' ? 'charge' : 'walk'; // (the phones' list has no 'flock': L.wildPack)
    a.t = 1000;
    const ax = Math.abs(a.vx), ay = Math.abs(a.vy);
    if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = a.vy > 0 ? 'down' : 'up';
    if (ax > 4) a.left = a.vx < 0;
    if (c && !frozen && fs.mode === 'dive' && !fs.hit && Math.hypot(a.x - c.x, a.y - c.y) / T < 0.7) { // one reaches them: the flock pulls back
      fs.hit = true;
      fs.mode = 'back';
      fs.t = TR.flock.back;
      reach(a, c);
    }
  };

  // ---------- healers, revivers, splitters ----------
  const heal = (r, a) => {
    const b = L.towerHealPick(a, r.mons, T, r.game.now()); // (one hit with Nido Soup on is not mended a while: a.tfNoHeal)
    if (!b) return;
    b.hp += L.towerHealOf(b);
    r.broadcast({ t: 'hl', s: a.slot, to: b.slot });
  };
  const standUp = (r, a) => {
    a.lying = 0;
    a.hp = L.towerReviveHp(a.max);
    a.cool = 0;
    a.t = 0;
    if (a.def.angry) W.wildCharge(r.fl, a);
    r.broadcast({ t: 'up', s: a.slot, hp: a.hp });
  };
  const split = (r, a, pw) => {
    const fl = r.fl, hp = L.towerSplitHp(a.max, pw === 'split' ? as(pw) : undefined); // (Bicol Express: a quarter, not half)
    for (let i = 0; i < TR.split.n; i++) {
      const slot = L.towerCopySlot(a.slot, i);
      if (r.mons.some((x) => x.slot === slot)) continue;
      let x = a.x + (i ? 1 : -1) * 0.45 * T, y = a.y + (i ? 0.15 : -0.15) * T;
      if (!W.wildFree(fl, Math.floor(x / T), Math.floor(y / T))) { x = a.x; y = a.y; }
      const c = W.make(fl, a.kind, slot, x, y, TR.split.size * a.size);
      strengthen(r, c, hp);
      c.left = !a.left;
      c.t = 250;
      r.mons.push(c);
    }
  };

  // ---------- every tick ----------
  const step = (r, dt, reach) => {
    const fl = r.fl, frozen = !fl.crew.length;
    if (!frozen) Object.keys(r.tw.flocks).forEach((n) => stepFlock(r, r.tw.flocks[n], dt));
    for (let i = 0; i < r.mons.length; i++) {
      const a = r.mons[i];
      if (a.lying) { if (!frozen && (a.lying -= dt) <= 0) standUp(r, a); continue; } // (it lies there; nobody about: the time waits)
      if (a.heal && !frozen && (a.healT -= dt) <= 0) { a.healT = TR.heal.every; heal(r, a); }
      if (a.fs) flockMember(r, a, dt, frozen, reach);
      else W.updateWild(fl, a, dt, reach);
    }
    waves(r);
  };

  // A counted hit (lib/room.js has checked it: not too soon, not too far). k: the weapon ('rifle', ...; none: the Bow).
  // pw: the power of the Tower dish the hitter ate (L.towerHitPower on the phone; owner, 13 Nov 2026): 'noheal' (Nido
  // Soup: the healers leave this one alone a while), 'split' (Bicol Express: its copies at a quarter of its hits), 'revive'
  // (Halo-halo ng Biringan: it lies twice as long). Any other word, or none (an older phone): as before.
  const hit = (r, a, p, d, k, n, pw) => {
    const fl = r.fl;
    if (pw === 'noheal' && TF) a.tfNoHeal = r.game.now() + TF.noHeal;
    if (a.lying) { // a hit while it lies finishes it
      a.lying = 0;
      a.hits[p.id] = (a.hits[p.id] || 0) + 1;
      a.hp = 0;
      r.broadcast({ t: 'hp', s: a.slot, hp: 0, by: p.id, n });
      return r.down(a, p.id);
    }
    if (a.shield) { // no damage: a Rifle's shot breaks the shield and is spent on it
      if (k === TR.shield.breaker) { a.shield = false; r.tw.broken.add(a.slot); r.broadcast({ t: 'sh', s: a.slot, by: p.id }); }
      r.broadcast({ t: 'hp', s: a.slot, hp: a.hp, by: p.id, n });
      if (a.def.angry && !a.fs) { a.cool = 0; W.wildCharge(fl, a); }
      return;
    }
    const down = W.wildStruck(fl, a, p, d);
    r.broadcast({ t: 'hp', s: a.slot, hp: Math.max(0, a.hp), by: p.id, n });
    if (!down) return;
    if (a.revive && !a.revived) { // beaten once: it lies a moment
      a.revived = true;
      a.lying = pw === 'revive' ? L.towerReviveMs(as(pw)) : TR.revive.ms;
      a.hp = LYING; // (still up: the phones' arrows find only what has hits left, and a hit now finishes it)
      a.vx = a.vy = 0;
      a.mode = 'idle';
      r.broadcast({ t: 'ly', s: a.slot });
      return;
    }
    if (a.split) split(r, a, pw); // (its copies are on the floor before it goes: the stairs wait for them)
    r.down(a, p.id);
  };
  // one gone (lib/room.js down)
  const gone = (r, a) => { if (a.fs) leaveFlock(a); };

  // ---------- who is paid ----------
  const joined = (r, uid, hi) => { r.tw.tn.set(uid, hi && hi.tn ? 1 : 0); };
  const welcome = (r) => ({ tl: left(r), sh: r.mons.filter((a) => r.tw.broken.has(a.slot)).map((a) => a.slot), ly: r.mons.filter((a) => a.lying).map((a) => a.slot), wv: r.tw.wave });
  const cleared = (r) => {
    const tw = r.tw, now = r.game.now();
    let nw = 0;
    tw.owed = new Set();
    r.players.forEach((p) => { if (tw.tn.get(p.id)) nw++; });
    r.recent.forEach((at, id) => { if (!r.players.has(id) && now - at < 30000) { tw.owed.add(id); if (tw.tn.get(id)) nw++; } });
    tw.nw = nw;
    r.broadcast({ t: 'cl', pay: 1, nw });
  };
  // the 'cl' a player gets coming to a cleared floor: with `pay` only if they were on it when it was cleared
  const clearFor = (r, uid) => {
    if (!r.tw.owed.has(uid)) return { t: 'cl' };
    r.tw.owed.delete(uid);
    return { t: 'cl', pay: 1, nw: r.tw.nw };
  };

  return { state, populate, left, step, hit, gone, joined, welcome, cleared, clearFor, strengthen };
};
