// Farm Raids, the rules (owner, 9 Nov 2026; docs/raids.md; content 00-zzzzzzzzzzzzzzzzz-raids.js). Step 1:
//  - the Raid Camp (bought, levelled), raiders trained (Gold, time) and levelled (Gold + a thing from hunting), the
//    defenses levelled; Farm Power
//  - a battle, worked out here step by step from a seed and the raider drops: the same moves give the same battle on
//    any phone or on the game server (step 2 replays a raid there before anyone gets loot). No Math.random, no trig.
//  - the bandit farms (practice): their farm made from a seed; points and Gold come from the game.
// Saved: 'frd' (not 'fr': friends; the Town Raid has C.RAID, s.raid: 01-logicZZZZ-raid.js).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.FRAID;

  // ---------- your raid things ----------
  L.frState = function (s) {
    if (!s.fr) s.fr = { camp: 0, army: {}, lv: {}, dlv: {}, train: [], pts: 0, won: {} };
    return s.fr;
  };
  L.raiderOpen = function (s, k) {
    var r = L.frState(s);
    for (var i = 0; i < r.camp; i++) if (R.camp.levels[i].open.indexOf(k) >= 0) return true;
    return false;
  };
  L.raiderLv = function (s, k) { return L.frState(s).lv[k] || 1; };
  L.defenseLv = function (s, k) { return L.frState(s).dlv[k] || 1; };
  L.campSpace = function (s) { var r = L.frState(s); return r.camp ? R.camp.levels[r.camp - 1].space : 0; };
  L.armySpace = function (s) {
    var r = L.frState(s), n = 0;
    Object.keys(r.army).forEach(function (k) { n += (r.army[k] || 0) * R.raiders[k].space; });
    r.train.forEach(function (t) { n += R.raiders[t.k].space; });
    return n;
  };
  // Farm Power: raiders' levels + defenses' levels + the farm's level (weights: R.power)
  L.farmPower = function (s) {
    var r = L.frState(s), p = 0;
    R.raiderOrder.forEach(function (k) { if (L.raiderOpen(s, k)) p += L.raiderLv(s, k) * R.power.raider; });
    R.defenseOrder.forEach(function (k) { p += L.defenseLv(s, k) * R.power.defense; });
    return p + (s.home ? s.home.level : 1) * R.power.farm + r.camp * R.power.raider;
  };

  // the Raid Camp: buy it (level 1), then upgrade. 'ok' | 'gold' | 'top'
  L.campUpgrade = function (s) {
    var r = L.frState(s), next = R.camp.levels[r.camp];
    if (!next) return 'top';
    var cost = r.camp ? next.gold : R.camp.price;
    if (s.gold < cost) return 'gold';
    s.gold -= cost;
    r.camp += 1;
    return 'ok';
  };
  // train one raider: 'ok' | 'locked' | 'space' | 'gold'
  L.trainRaider = function (s, k, now) {
    var r = L.frState(s), d = R.raiders[k];
    if (!d || !L.raiderOpen(s, k)) return 'locked';
    if (L.armySpace(s) + d.space > L.campSpace(s)) return 'space';
    if (s.gold < d.gold) return 'gold';
    s.gold -= d.gold;
    var last = r.train.length ? r.train[r.train.length - 1].until : now;
    r.train.push({ k: k, until: Math.max(now, last) + d.secs * 1000 });
    return 'ok';
  };
  // the trained ones join the party; returns how many joined
  L.trainDone = function (s, now) {
    var r = L.frState(s), n = 0;
    while (r.train.length && r.train[0].until <= now) { var t = r.train.shift(); r.army[t.k] = (r.army[t.k] || 0) + 1; n++; }
    return n;
  };
  // level a raider up: 'ok' | 'locked' | 'top' | 'gold' | 'need'
  L.raiderUp = function (s, k) {
    var r = L.frState(s), lv = L.raiderLv(s, k);
    if (!L.raiderOpen(s, k)) return 'locked';
    if (lv >= R.level.mult.length) return 'top';
    var gold = R.level.gold[lv], need = R.level.need[lv];
    if (s.gold < gold) return 'gold';
    if (need && L.countItem(s, need[0]) < need[1]) return 'need';
    s.gold -= gold;
    if (need) L.removeItem(s, need[0], need[1]);
    r.lv[k] = lv + 1;
    return 'ok';
  };
  L.defenseUp = function (s, k) {
    var r = L.frState(s), lv = L.defenseLv(s, k);
    if (!R.defenses[k]) return 'none';
    if (lv >= R.level.mult.length) return 'top';
    var gold = R.defLevel.gold[lv];
    if (s.gold < gold) return 'gold';
    s.gold -= gold;
    r.dlv[k] = lv + 1;
    return 'ok';
  };

  // ---------- the loot cap by power (owner: 10% .. 30%) ----------
  L.frLootCap = function (mine, theirs) {
    var x = theirs / Math.max(1, mine), lo = R.loot.weaker, hi = R.loot.stronger;
    if (x >= hi) return R.loot.high;
    if (x <= lo) return R.loot.low;
    if (x >= 1) return R.loot.mid + (R.loot.high - R.loot.mid) * (x - 1) / (hi - 1);
    return R.loot.low + (R.loot.mid - R.loot.low) * (x - lo) / (1 - lo);
  };

  // ---------- a seeded random (the same numbers on every device) ----------
  L.frRand = function (seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // ---------- a bandit farm (practice) ----------
  // { w, h, defs: [{ t, x, y, lv }], loot: [{ kind, x, y, n }], name }: fields and a pen fenced in, the stall, the Gold pot
  L.banditFarm = function (b, seed) {
    var W = R.battle.w, H = R.battle.h, rnd = L.frRand(seed), defs = [], loot = [], used = {};
    var take = function (x, y) { var k = x + ',' + y; if (used[k]) return false; used[k] = 1; return true; };
    var free = function (x0, y0, x1, y1) {
      for (var t = 0; t < 60; t++) {
        var x = x0 + Math.floor(rnd() * (x1 - x0 + 1)), y = y0 + Math.floor(rnd() * (y1 - y0 + 1));
        if (take(x, y)) return { x: x, y: y };
      }
      return null;
    };
    var e = R.battle.edge + 1;
    // upright: the field (crops) at the top, the pen (eggs, milk) in the middle, the Gold pot by the house and the stall
    // at the bottom; the edge all round is where raiders come in
    var field = { x0: e, y0: e, x1: W - e - 1, y1: e + 5 }, pen = { x0: Math.floor(W / 2) - 1, y0: e + 8, x1: W - e - 1, y1: e + 12 };
    var house = { x: Math.floor(W / 2), y: H - e - 2 }, stall = { x: e + 1, y: H - e - 3 };
    var piles = function (r, kind, total, n) { for (var i = 0; i < n; i++) { var p = free(r.x0 + 1, r.y0 + 1, r.x1 - 1, r.y1 - 1); if (p) loot.push({ kind: kind, x: p.x, y: p.y, n: Math.round(total / n) }); } };
    piles(field, 'crops', b.loot.crops, 6);
    piles(pen, 'produce', b.loot.produce, 3);
    take(stall.x, stall.y); loot.push({ kind: 'stall', x: stall.x, y: stall.y, n: b.loot.stall });
    take(house.x, house.y); loot.push({ kind: 'gold', x: house.x, y: house.y, n: b.loot.gold });
    // fences round the field and the pen, with a gap
    var fence = function (r, want) {
      var ring = [];
      for (var x = r.x0; x <= r.x1; x++) { ring.push([x, r.y0]); ring.push([x, r.y1]); }
      for (var y = r.y0 + 1; y < r.y1; y++) { ring.push([r.x0, y]); ring.push([r.x1, y]); }
      var gap = Math.floor(rnd() * ring.length);
      for (var i = 0; i < ring.length && want > 0; i++) {
        var p = ring[(gap + 2 + i) % ring.length];
        if (take(p[0], p[1])) { defs.push({ t: 'fence', x: p[0], y: p[1], lv: b.lv }); want--; }
      }
    };
    var nf = b.defs.fence || 0;
    fence(field, Math.ceil(nf * 0.6));
    fence(pen, Math.floor(nf * 0.4));
    // the other defenses near what they guard
    var near = { scarecrow: field, sili: field, mudpit: field, dog: pen, goose: pen, beebox: pen,
      tower: { x0: e, y0: e + 7, x1: e + 3, y1: e + 12 }, kampana: { x0: house.x - 2, y0: house.y - 2, x1: house.x + 2, y1: house.y },
      sprinkler: field };
    R.defenseOrder.forEach(function (k) {
      if (k === 'fence') return;
      for (var i = 0; i < (b.defs[k] || 0); i++) {
        var r = near[k] || field, p = free(Math.max(1, r.x0 - 1), Math.max(1, r.y0 - 1), Math.min(W - 2, r.x1 + 1), Math.min(H - 2, r.y1 + 1));
        if (p) defs.push({ t: k, x: p.x, y: p.y, lv: b.lv });
      }
    });
    return { w: W, h: H, defs: defs, loot: loot, name: b.name };
  };

  // ---------- the battle ----------
  // L.frStart(farm, army: { k: { n, lv } }, seed) -> a battle; L.frDrop(b, k, x, y) puts one raider down at the
  // edge (now); L.frStep(b) moves it on by one tick. b.end: 'time' | 'gone' | 'all'. b.taken: { kind: n }.
  var DT = R.battle.tick / 1000;
  var dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  L.frStart = function (farm, army, seed) {
    var total = {};
    farm.loot.forEach(function (p) { total[p.kind] = (total[p.kind] || 0) + p.n; });
    var b = {
      farm: farm, t: 0, ticks: Math.round(R.battle.secs / DT), rnd: L.frRand(seed), seed: seed, next: 1,
      raiders: [], defs: farm.defs.map(function (d, i) {
        var def = R.defenses[d.t], m = L.frDefMult(d.lv);
        return { id: 'd' + i, t: d.t, x: d.x + 0.5, y: d.y + 0.5, hx: d.x + 0.5, hy: d.y + 0.5, lv: d.lv || 1, hp: def.hp * m, max: def.hp * m, dps: def.dps * m, cool: 0, used: false };
      }),
      loot: farm.loot.map(function (p, i) { return { id: 'l' + i, kind: p.kind, x: p.x + 0.5, y: p.y + 0.5, n: p.n, left: p.n }; }),
      total: total, taken: {}, left: {}, alarm: 0, moves: [], end: null, events: [],
    };
    Object.keys(army).forEach(function (k) { b.left[k] = { n: army[k].n, lv: army[k].lv }; });
    return b;
  };
  // where a raider may come down: the edge of the farm (R.battle.edge tiles)
  L.frEdge = function (b, x, y) {
    var e = R.battle.edge, w = b.farm.w, h = b.farm.h;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (b.farm.drop) return b.farm.drop.charCodeAt(y * w + x) === 49; // (a real farm: open ground away from it all)
    return x < e || y < e || x >= w - e || y >= h - e;
  };
  // where raiders may come down on a real farm: open ground at least R.battle.keep tiles from any loot or defense
  L.frDropCells = function (farm) {
    var w = farm.w, h = farm.h, out = [], keep = R.battle.keep, things = farm.loot.concat(farm.defs);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ok = !(farm.solid && farm.solid.charCodeAt(y * w + x) === 49) && !things.some(function (o) { return Math.abs(o.x - x) < keep && Math.abs(o.y - y) < keep; });
      out.push(ok ? '1' : '0');
    }
    return out.join('');
  };
  L.frDrop = function (b, k, x, y) {
    var l = b.left[k];
    if (b.end || !l || l.n <= 0 || !L.frEdge(b, x, y)) return null;
    l.n--;
    var d = R.raiders[k], m = R.level.mult[l.lv - 1];
    var r = { id: 'r' + (b.next++), k: k, x: x + 0.5, y: y + 0.5, hp: d.hp * m, max: d.hp * m, dmg: d.dmg * m, speed: d.speed, carry: d.carry * m, target: null, stuck: 0, flee: 0, fx: 0, fy: 0, slow: 0, cool: 0, got: 0 };
    b.raiders.push(r);
    b.moves.push([b.t, k, x, y]);
    return r;
  };
  // the farm's own walls (a real farm: trees, buildings, water): farm.solid, a string of '1' / '0' a tile, w x h. Fences
  // are not in it: they are defenses, and a raider breaks through them.
  var solid = function (b, x, y) { var f = b.farm; if (x < 0 || y < 0 || x >= f.w || y >= f.h) return true; return !!f.solid && f.solid.charCodeAt(y * f.w + x) === 49; };
  // the way over open ground (4 ways) from a raider to its target's tile or one beside it: [[x, y]...] or null
  var route = function (b, r, tg) {
    var f = b.farm, w = f.w, h = f.h, sx = Math.floor(r.x), sy = Math.floor(r.y), gx = Math.floor(tg.x), gy = Math.floor(tg.y);
    if (!f.solid) return null;
    var from = new Int32Array(w * h).fill(-1), q = [sy * w + sx], head = 0, end = -1;
    from[sy * w + sx] = sy * w + sx;
    while (head < q.length) {
      var k = q[head++], x = k % w, y = (k - x) / w;
      if (Math.abs(x - gx) + Math.abs(y - gy) <= 1) { end = k; break; }
      var nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (var i = 0; i < 4; i++) {
        var nx = nb[i][0], ny = nb[i][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var n = ny * w + nx;
        if (from[n] >= 0 || solid(b, nx, ny)) continue;
        from[n] = k;
        q.push(n);
      }
    }
    if (end < 0) return null;
    var path = [];
    for (var c = end; c !== sy * w + sx; c = from[c]) path.unshift([c % w + 0.5, Math.floor(c / w) + 0.5]);
    return path;
  };
  var fenceAt = function (b, x, y) { for (var i = 0; i < b.defs.length; i++) { var d = b.defs[i]; if (d.t === 'fence' && d.hp > 0 && Math.floor(d.x) === Math.floor(x) && Math.floor(d.y) === Math.floor(y)) return d; } return null; };
  // what a raider goes for: its favourite, else any loot left, else a defense
  var pick = function (b, r) {
    var d = R.raiders[r.k], best = null, bd = 1e9, list = [];
    var lootOf = function (kind) { return b.loot.filter(function (p) { return p.left > 0 && (!kind || p.kind === kind); }); };
    var defsOf = function (f) { return b.defs.filter(function (x) { return x.hp > 0 && !R.defenses[x.t].trap && f(x); }); };
    if (d.likes === 'crops' || d.likes === 'produce' || d.likes === 'stall' || d.likes === 'gold') list = lootOf(d.likes);
    else if (d.likes === 'fences') list = defsOf(function (x) { return x.t === 'fence'; });
    else if (d.likes === 'defenses') list = defsOf(function (x) { return x.t !== 'fence'; });
    else if (d.likes === 'guards') list = defsOf(function (x) { return x.t === 'dog' || x.t === 'goose'; });
    if (!list.length) list = lootOf(null);
    if (!list.length) list = defsOf(function () { return true; });
    list.forEach(function (o) { var dd = dist(r.x, r.y, o.x, o.y); if (dd < bd) { bd = dd; best = o; } });
    return best;
  };
  // a defense's level: hp, damage, a mud pit's hold and a scare's reach x this (R.defLevel.mult; raiders: R.level.mult)
  L.frDefMult = function (lv) { var m = R.defLevel.mult || R.level.mult; return m[Math.max(1, Math.min(m.length, lv || 1)) - 1]; };
  L.frStep = function (b) {
    if (b.end) return;
    b.t++;
    var alive = b.raiders.filter(function (r) { return r.hp > 0; });
    // the alarm (Kampana): the first raider in its reach
    b.defs.forEach(function (d) {
      if (d.t !== 'kampana' || d.hp <= 0 || d.used) return;
      if (alive.some(function (r) { return dist(r.x, r.y, d.x, d.y) <= R.defenses.kampana.range; })) { d.used = true; b.alarm = Math.round(15 / DT); b.events.push([b.t, 'alarm', d.id]); }
    });
    var boost = b.alarm > 0 ? R.defenses.kampana.alarm : 1;
    if (b.alarm > 0) b.alarm--;
    // raiders
    alive.forEach(function (r) {
      var d = R.raiders[r.k];
      if (r.stuck > 0) { r.stuck--; return; }
      // scared: a scarecrow or sili patch near, for the raiders it scares
      if (r.flee <= 0) {
        b.defs.forEach(function (x) {
          var dx = R.defenses[x.t];
          if (x.hp > 0 && dx.scares && dx.scares.indexOf(r.k) >= 0 && dist(r.x, r.y, x.x, x.y) <= dx.range * Math.min(1.6, L.frDefMult(x.lv)) * 0.7 + 0.6) {
            var len = dist(r.x, r.y, x.x, x.y) || 1;
            r.flee = Math.round((dx.hot ? 3 : 2) / DT); r.fx = (r.x - x.x) / len; r.fy = (r.y - x.y) / len; r.target = null;
            b.events.push([b.t, 'scared', r.id, x.id]);
          }
        });
      }
      var sp = d.speed * (r.slow > 0 ? 0.5 : 1) * DT;
      if (r.slow > 0) r.slow--;
      if (r.flee > 0) { r.flee--; r.x = Math.max(0.5, Math.min(b.farm.w - 0.5, r.x + r.fx * sp)); r.y = Math.max(0.5, Math.min(b.farm.h - 0.5, r.y + r.fy * sp)); return; }
      // a mud pit underfoot
      b.defs.forEach(function (x) {
        if (x.t === 'mudpit' && !x.used && !d.flies && dist(r.x, r.y, x.x, x.y) <= R.defenses.mudpit.range) { x.used = true; r.stuck = Math.round(R.defenses.mudpit.stuck * L.frDefMult(x.lv) / DT); b.events.push([b.t, 'stuck', r.id, x.id]); }
      });
      if (!r.target || (r.target.left != null ? r.target.left <= 0 : r.target.hp <= 0)) r.target = pick(b, r);
      var tg = r.target;
      if (!tg) return;
      var dd = dist(r.x, r.y, tg.x, tg.y), reach = tg.left != null ? 0.6 : 1.0;
      if (dd > reach) {
        // on a real farm: the way round its walls (fliers go straight); a fresh way when the target changes
        var wx = tg.x, wy = tg.y;
        if (b.farm.solid && !d.flies) {
          if (r.routeFor !== tg.id) { r.route = route(b, r, tg) || []; r.routeFor = tg.id; }
          while (r.route.length && dist(r.x, r.y, r.route[0][0], r.route[0][1]) < 0.15) r.route.shift();
          if (r.route.length) { wx = r.route[0][0]; wy = r.route[0][1]; }
        }
        var wd = dist(r.x, r.y, wx, wy) || 1, step = Math.min(sp, wd);
        var nx = r.x + (wx - r.x) / wd * step, ny = r.y + (wy - r.y) / wd * step, f = !d.flies && !d.through ? fenceAt(b, nx, ny) : null;
        if (f && f !== tg) { r.target = f; r.routeFor = null; return; } // a fence in the way: through it
        r.x = nx; r.y = ny;
        return;
      }
      if (tg.left != null) { // grab
        var g = Math.min(tg.left, r.carry * DT);
        tg.left -= g; r.got += g;
        b.taken[tg.kind] = (b.taken[tg.kind] || 0) + g;
      } else { // hit
        r.cool -= DT;
        if (r.cool <= 0) { r.cool = 0.8; tg.hp -= r.dmg * (d.likes === 'fences' && tg.t === 'fence' ? 3 : 1); if (tg.hp <= 0) b.events.push([b.t, 'down', tg.id, r.id]); }
      }
    });
    // defenses
    b.defs.forEach(function (x) {
      var dx = R.defenses[x.t];
      if (x.hp <= 0 || !dx.dps) return;
      var reach = dx.range, foes = alive.filter(function (r) { return r.hp > 0 && dist(r.x, r.y, x.x, x.y) <= reach * (dx.chases ? 2 : 1); });
      x.aim = null; // (who it is at, for the pictures: 19zz...-farm-raids-world.js; the battle never reads it)
      if (!foes.length) { if (dx.chases && dist(x.x, x.y, x.hx, x.hy) > 0.1) { var bl = dist(x.x, x.y, x.hx, x.hy); x.x += (x.hx - x.x) / bl * Math.min(bl, 2 * DT); x.y += (x.hy - x.y) / bl * Math.min(bl, 2 * DT); } return; }
      // the one it beats first, else the nearest
      foes.sort(function (p, q) { return (q.k === dx.beats) - (p.k === dx.beats) || dist(p.x, p.y, x.x, x.y) - dist(q.x, q.y, x.x, x.y); });
      var f = foes[0], fd = dist(f.x, f.y, x.x, x.y);
      if (dx.chases && fd > 0.9) { x.x += (f.x - x.x) / fd * 2.2 * DT; x.y += (f.y - x.y) / fd * 2.2 * DT; return; }
      if (!dx.chases && fd > reach) return;
      // (its own level's damage: x.dps, frStart; until 9 Nov 2026 the base dps, so a level never hit harder) and its counter
      var hit = x.dps * boost * DT * (f.k === dx.beats ? R.counter : 1);
      x.aim = f.id;
      (dx.area ? foes.filter(function (r) { return dist(r.x, r.y, x.x, x.y) <= reach; }) : [f]).forEach(function (r) {
        r.hp -= hit;
        if (dx.slows) r.slow = Math.round(1 / DT);
        if (dx.push) { var pl = dist(r.x, r.y, x.x, x.y) || 1; r.x += (r.x - x.x) / pl * 0.6 * DT; r.y += (r.y - x.y) / pl * 0.6 * DT; }
        if (r.hp <= 0) b.events.push([b.t, 'gone', r.id, x.id]);
      });
    });
    var stillIn = b.raiders.some(function (r) { return r.hp > 0; }) || Object.keys(b.left).some(function (k) { return b.left[k].n > 0; });
    var lootLeft = b.loot.some(function (p) { return p.left > 0.01; });
    if (!lootLeft) b.end = 'all';
    else if (b.t >= b.ticks) b.end = 'time';
    else if (!stillIn) b.end = 'gone';
  };
  // the share of all the loot that was taken (0..1), and the stars (30% / 60% / 90%)
  // (each kind by its worth in Gold: 800 Gold must not outweigh a field of crops, 9 Nov 2026)
  L.frShare = function (b) {
    var all = 0, got = 0, v = R.lootValue;
    Object.keys(b.total).forEach(function (k) { all += b.total[k] * (v[k] || 1); got += (b.taken[k] || 0) * (v[k] || 1); });
    return all ? got / all : 0;
  };
  L.frStars = function (b) { var x = L.frShare(b); return x >= 0.9 ? 3 : x >= 0.6 ? 2 : x >= 0.3 ? 1 : 0; };
  // replays the moves (step 2: the game server does this): the same result
  L.frReplay = function (farm, army, seed, moves) {
    var b = L.frStart(farm, army, seed), k = 0;
    while (!b.end) {
      while (k < moves.length && moves[k][0] === b.t) { L.frDrop(b, moves[k][1], moves[k][2], moves[k][3]); k++; }
      L.frStep(b);
    }
    return b;
  };

  // ---------- practice on a bandit farm: the prize (from the game) ----------
  // { gold, pts, stars }; the raiders sent are used up, as in a real raid
  L.banditPrize = function (s, key, b) {
    var bd = R.bandits.filter(function (x) { return x.key === key; })[0], stars = L.frStars(b), r = L.frState(s);
    var v = R.lootValue, gold = Math.round((b.taken.gold || 0) * v.gold + (b.taken.crops || 0) * v.crops + (b.taken.produce || 0) * v.produce + (b.taken.stall || 0) * v.stall);
    var first = stars > (r.won[key] || 0);
    var pts = first ? R.points[stars] - R.points[r.won[key] || 0] : Math.round(R.points[stars] / 5);
    if (first) r.won[key] = stars;
    s.gold += gold;
    r.pts += pts;
    void bd;
    return { gold: gold, pts: pts, stars: stars };
  };
  // the raiders that went in are gone from the party (used: { k: n })
  L.frUse = function (s, used) { var r = L.frState(s); Object.keys(used).forEach(function (k) { r.army[k] = Math.max(0, (r.army[k] || 0) - used[k]); }); };
  // a bandit farm opens when the one before has a star
  L.banditOpen = function (s, i) { return i === 0 || (L.frState(s).won[R.bandits[i - 1].key] || 0) >= 1; };

  // ---------- the Farm Shield (owner, 9 Nov 2026) ----------
  L.shieldLeft = function (s, now) { return Math.max(0, (L.frState(s).shield || 0) - now); };
  // from the bag: 24 hours from now ('ok'), or 'none'
  L.useShield = function (s, slotIndex, now) {
    var slot = s.inv[slotIndex];
    if (!slot || slot.id !== 'farm_shield') return 'none';
    L.removeAt(s, slotIndex, 1);
    L.frState(s).shield = now + R.shield.hours * 3600000;
    return 'ok';
  };
  // raiding another player's farm (step 2) breaks it; practice does not
  L.shieldBreak = function (s) { L.frState(s).shield = 0; };
  // a day's story chapter: a Farm Shield with its prize
  var advStart = L.advStart;
  if (advStart) L.advStart = function (s, a, dn) {
    var q = advStart(s, a, dn);
    if (a.story) q.reward = { gold: (q.reward && q.reward.gold) || 300, item: 'farm_shield', n: 1 };
    return q;
  };

  // ---------- the save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), r = s.fr;
    if (r && (r.camp || r.pts || r.shield)) o.frd = [r.camp, r.army, r.lv, r.dlv, r.train.map(function (t) { return [t.k, t.until]; }), r.pts, r.won, r.shield || 0];
    return o;
  };
  var num = function (v, lo, hi) { v = Math.floor(Number(v)) || 0; return Math.max(lo, Math.min(hi, v)); };
  var map = function (o, keys, lo, hi) { var out = {}; (keys || []).forEach(function (k) { if (o && o[k] != null) out[k] = num(o[k], lo, hi); }); return out; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var a = Array.isArray(o.frd) ? o.frd : null;
    if (a) {
      s.fr = {
        camp: num(a[0], 0, R.camp.levels.length), army: map(a[1], R.raiderOrder, 0, 999), lv: map(a[2], R.raiderOrder, 1, 5), dlv: map(a[3], R.defenseOrder, 1, 5),
        train: (Array.isArray(a[4]) ? a[4] : []).filter(function (t) { return Array.isArray(t) && R.raiders[t[0]]; }).slice(0, 60).map(function (t) { return { k: t[0], until: Number(t[1]) || 0 }; }),
        pts: num(a[5], 0, 1e9), won: map(a[6], R.bandits.map(function (b) { return b.key; }), 0, 3), shield: Math.max(0, Number(a[7]) || 0),
      };
    }
    return s;
  };
})(window.Farm = window.Farm || {});
