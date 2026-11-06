// The monsters' rules, ported from src/19v-wild.js (updateWild, wildDecide, wildFlee, wildCharge, wildBack, wildSpot,
// wildEdge, wildFree, wildInZone) and the cave's wraps of them in src/19zt-lair.js, with no Phaser: the same numbers
// (C.TILE world units a tile; def.walk / run / shy / angry in tiles a second; timers in ms). Only what moves a monster
// is here: its pictures, footprints, grass and dust stay on the phones.
//
// A floor (`fl`) is { T, W, H, zone, free (Uint8Array: ground a monster may stand on), rand, crew }, where crew is
// every player on the floor at their last reported place: { id, x, y, speed, hg, sk }.
'use strict';

module.exports = function makeWild(R) {
  const { C, L, WI, T } = R;
  const span = (fl, a, b) => a + fl.rand() * (b - a);

  // A free tile (the zone, walkable, not the gate) in tiles.
  const wildFree = (fl, x, y) => x >= 0 && y >= 0 && x < fl.W && y < fl.H && !!fl.free[y * fl.W + x];
  // Inside the zone, in world units (a flying fleer only keeps to the zone).
  const wildInZone = (fl, x, y) => {
    const z = fl.zone;
    return x >= z.x0 * T && x <= (z.x1 + 1) * T && y >= z.y0 * T && y <= (z.y1 + 1) * T;
  };
  const farFromAll = (wx, wy, from, away) => !(from || []).some((f) => Math.hypot(wx - f.x, wy - f.y) < away * T);

  // A free tile in `zone` at least `away` tiles from every point of `from` (the game: from you): its middle, or null.
  const wildSpot = (fl, zone, from, away) => {
    for (let tries = 0; tries < 80; tries++) {
      const x = zone.x0 + Math.floor(fl.rand() * (zone.x1 - zone.x0 + 1)), y = zone.y0 + Math.floor(fl.rand() * (zone.y1 - zone.y0 + 1));
      if (!wildFree(fl, x, y)) continue;
      const wx = (x + 0.5) * T, wy = (y + 0.7) * T;
      if (from && !farFromAll(wx, wy, from, away)) continue;
      return { x: wx, y: wy };
    }
    return null;
  };
  // A free tile along the zone's edge, 6 tiles or more from everyone (out of sight), or null.
  const wildEdge = (fl, z, from) => {
    for (let tries = 0; tries < 60; tries++) {
      const side = fl.rand() < 0.5, far = fl.rand() < 0.5;
      const x = side ? (far ? z.x1 : z.x0) : z.x0 + Math.floor(fl.rand() * (z.x1 - z.x0 + 1));
      const y = side ? z.y0 + Math.floor(fl.rand() * (z.y1 - z.y0 + 1)) : (far ? z.y1 : z.y0);
      if (!wildFree(fl, x, y)) continue;
      const wx = (x + 0.5) * T, wy = (y + 0.7) * T;
      if (farFromAll(wx, wy, from, 6)) return { x: wx, y: wy };
    }
    return null;
  };

  // A new monster (addWildAnimal): sized as the game sizes it (a rare one, or `sized`, as given).
  const make = (fl, kind, slot, x, y, sized) => {
    const def = WI.animals[kind];
    const size = sized || (def.rare ? 1 : L.wildSize(fl.rand));
    return { kind, slot, def, hp: def.hp, max: def.hp, hits: {}, x, y, vx: 0, vy: 0, mode: 'idle', t: span(fl, 300, 2500), cool: 0,
      dir: 'side', left: fl.rand() < 0.5, look: false, size };
  };

  // What it does next with nothing on: stand or graze a while, or wander a few tiles.
  const wildDecide = (fl, a) => {
    if (a.mode === 'eat' || a.mode === 'toBait') a.mode = 'idle';
    if (a.mode === 'charge') a.cool = 4000;
    const r = fl.rand();
    a.look = false;
    if (r < 0.45) { a.mode = r < 0.25 ? 'graze' : 'idle'; a.look = r > 0.38; a.vx = a.vy = 0; a.t = span(fl, 1500, 4500); return; }
    const ang = span(fl, 0, Math.PI * 2);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * a.def.walk * T;
    a.vy = Math.sin(ang) * a.def.walk * T * 0.7;
    a.t = span(fl, 1200, 3200);
  };
  const wildFlee = (fl, a, f) => {
    const ang = Math.atan2(a.y - f.y, a.x - f.x) + span(fl, -0.5, 0.5);
    a.mode = 'flee';
    a.vx = Math.cos(ang) * a.def.run * T;
    a.vy = Math.sin(ang) * a.def.run * T;
    a.t = span(fl, 1800, 2600);
  };
  const wildCharge = (fl, a) => { a.mode = 'charge'; a.t = 2600; };
  // It reached someone (or their phone said so): it backs off a while.
  const wildBack = (fl, a, f) => {
    const dx = f.x - a.x, dy = f.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
    a.mode = 'walk';
    a.vx = -dx / len * a.def.walk * T;
    a.vy = -dy / len * a.def.walk * T;
    a.t = 2500;
    a.cool = 5000;
  };

  // One step of one monster (updateWild). onReach(a, player): a charge reached that player (the server tells their
  // phone, `bp`), and it backs off.
  const updateWild = (fl, a, dt, onReach) => {
    let f = null, bd = Infinity;
    fl.crew.forEach((c) => {
      const cd = Math.hypot(a.x - c.x, a.y - c.y);
      if (cd < bd) { bd = cd; f = c; }
    });
    const frozen = !f;
    const def = a.def;
    let dx = 0, dy = 0, d = Infinity;
    if (f) { dx = a.x - f.x; dy = a.y - f.y; d = Math.hypot(dx, dy) / T; }
    a.t -= dt;
    a.cool = Math.max(0, a.cool - dt);
    if (!frozen) {
      const gear = f.hg || 0, notice = L.gearNotice(gear); // Hunter's gear (19zo-gear.js)
      const sneaking = (f.speed || 0) < C.SPEED * L.gearSneak(gear) || !!f.sk;
      if (def.shy && a.mode !== 'flee' && d < def.shy * (sneaking ? 0.55 : 1) * notice && !(a.mode === 'eat' && d > 1.4)) wildFlee(fl, a, f);
      else if (def.angry && a.mode !== 'charge' && !a.cool && d < def.angry * notice) wildCharge(fl, a);
      if (a.mode === 'charge') {
        const len = Math.max(1, Math.hypot(dx, dy));
        a.vx = -dx / len * def.run * T;
        a.vy = -dy / len * def.run * T;
        if (d < 0.7) {
          if (onReach) onReach(a, f);
          wildBack(fl, a, f);
        }
      }
    }
    // bait (a public room's: 19v-wild.js updateWild): it walks to it, a little quicker than a stroll, and eats a while
    if (a.mode === 'toBait' && a.bait && !a.bait.gone) {
      const bx = a.bait.x - a.x, by = a.bait.y - a.y, bl = Math.hypot(bx, by);
      if (bl < 0.4 * T) { a.mode = 'eat'; a.vx = a.vy = 0; a.t = WI.baitMins * 60000; } else { a.vx = bx / bl * def.walk * T * 1.6; a.vy = by / bl * def.walk * T * 1.6; }
    }
    if (a.t <= 0) wildDecide(fl, a);
    // move, around walls (a flying fleer goes over them)
    if (a.vx || a.vy) {
      const nx = a.x + a.vx * dt / 1000, ny = a.y + a.vy * dt / 1000;
      const ok = def.flies && a.mode === 'flee' ? wildInZone(fl, nx, ny) : wildFree(fl, Math.floor(nx / T), Math.floor(ny / T));
      if (ok) { a.x = nx; a.y = ny; } else if (a.mode === 'flee' || a.mode === 'charge') { a.vx = -a.vx * 0.5; a.vy = span(fl, -1, 1) * def.run * T; } else { a.vx = a.vy = 0; a.t = Math.min(a.t, 400); }
      // the way it faces: sideways, or toward / away (a little give, so it does not flicker on a slant)
      const ax = Math.abs(a.vx), ay = Math.abs(a.vy);
      if (ax > ay * 1.2) a.dir = 'side'; else if (ay > ax * 1.2) a.dir = a.vy > 0 ? 'down' : 'up';
      if (ax > 4) a.left = a.vx < 0;
    }
  };

  // An arrow hit it (wildStruck, as the phone running the hunt took a friend's hit): it loses hp, and if still up an
  // angry one charges, a shy one runs from whoever shot.
  const wildStruck = (fl, a, shooter, d) => {
    if (a.def.tameOnly) { wildFlee(fl, a, shooter); return false; } // (never in a cave: an arrow only scares it)
    a.hp -= d;
    a.hits[shooter.id] = (a.hits[shooter.id] || 0) + 1;
    if (a.hp > 0) {
      if (a.def.angry) { a.cool = 0; wildCharge(fl, a); } else wildFlee(fl, a, shooter);
      return false;
    }
    return true;
  };

  // A cave floor's monsters for a first visitor (setupWild + 19zt-lair.js lairStrength): the floor's list, but the
  // Bakunawa (it walks in later, for two or more), each on a free tile 6 or more tiles from `from`.
  const strength = (cfg, floor, a, crew) => {
    const def = a.def;
    if (!cfg.lair) { // a place's cave: its boss as strong as the crew (L.dunHp)
      if (!def.dungeon) return;
      a.hp = a.max = L.dunHp(a.kind, crew);
      a.crew = crew;
      return;
    }
    if (!def.lair || def.great) return;
    a.hp = a.max = L.lairHp(a.kind, floor);
  };
  const populate = (fl, cfg, floor, from) => {
    const out = [];
    cfg.roster(floor).forEach((e) => {
      const def = WI.animals[e.kind];
      if (!def || def.great) return;
      const p = wildSpot(fl, fl.zone, from ? [from] : null, 6);
      if (!p) return;
      const a = make(fl, e.kind, e.slot, p.x, p.y);
      strength(cfg, floor, a, 1);
      out.push(a);
    });
    return out;
  };

  // The Bakunawa rises (19zt-lair.js wildArrive): in the middle or upper part of the floor, as strong as the crew,
  // walking toward the middle and fading in.
  const bakunawaRises = (fl, slot, crew) => {
    const z0 = fl.zone, qx = Math.floor((z0.x1 - z0.x0) / 4);
    const mid = { x0: z0.x0 + qx, x1: z0.x1 - qx, y0: z0.y0, y1: z0.y0 + Math.floor((z0.y1 - z0.y0) * 0.55) };
    const p = wildSpot(fl, mid, fl.crew, 4) || wildSpot(fl, mid) || wildEdge(fl, z0, fl.crew);
    if (!p) return null;
    const a = make(fl, 'bakunawa', slot, p.x, p.y, 1);
    a.hp = a.max = a.def.hpEach * crew;
    const ang = Math.atan2((z0.y0 + z0.y1) / 2 * T - p.y, (z0.x0 + z0.x1) / 2 * T - p.x);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * a.def.walk * T;
    a.vy = Math.sin(ang) * a.def.walk * T;
    a.t = span(fl, 2500, 5000);
    return a;
  };

  // ---------- a hunting place (a public room, docs/game-server.md "Step 2") ----------
  // Its animals for a first visitor (setupWild): each of `list` on a free tile 6 or more tiles from `from`, never the
  // great one (it walks in, for two or more).
  const populatePlace = (fl, list, from) => {
    const out = [];
    list.forEach((e) => {
      const def = WI.animals[e.kind];
      if (!def || def.great) return;
      const p = wildSpot(fl, fl.zone, from ? [from] : null, 6);
      if (p) out.push(make(fl, e.kind, e.slot, p.x, p.y));
    });
    return out;
  };
  // One walks in (wildArrive): from the zone's edge, out of everyone's sight (6 tiles or more from each of `from`), toward
  // the middle. The great one as strong as the crew (hpEach each), its usual size. null: no edge out of sight.
  const walkIn = (fl, kind, slot, from, crew) => {
    const z = fl.zone, p = wildEdge(fl, z, from);
    if (!p) return null;
    const def = WI.animals[kind], a = make(fl, kind, slot, p.x, p.y, def.great ? 1 : null);
    if (def.great) a.hp = a.max = def.hpEach * Math.max(1, crew);
    const ang = Math.atan2((z.y0 + z.y1) / 2 * T - p.y, (z.x0 + z.x1) / 2 * T - p.x);
    a.mode = 'walk';
    a.vx = Math.cos(ang) * def.walk * T;
    a.vy = Math.sin(ang) * def.walk * T;
    a.t = span(fl, 2500, 5000);
    return a;
  };
  // Bait put down (19v-wild.js layBait): the nearest shy one within 9 tiles goes to it (not one already at a bait).
  const layBait = (fl, mons, bait) => {
    let shy = null, bd = Infinity;
    mons.forEach((a) => {
      if (!a.def.shy || a.mode === 'eat' || a.mode === 'toBait') return;
      const d = Math.hypot(a.x - bait.x, a.y - bait.y);
      if (d < bd) { bd = d; shy = a; }
    });
    if (!shy || bd >= 9 * T) return null;
    shy.mode = 'toBait';
    shy.t = 20000;
    shy.bait = bait;
    return shy;
  };

  return { wildFree, wildInZone, wildSpot, wildEdge, make, wildDecide, wildFlee, wildCharge, wildBack, updateWild, wildStruck, populate, bakunawaRises,
    populatePlace, walkIn, layBait };
};
