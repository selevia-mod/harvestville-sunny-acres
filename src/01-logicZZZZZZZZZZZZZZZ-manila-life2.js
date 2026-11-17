// Manila city life steps 2 and 4: the rules (content: 00-zzzzzzzzzzzzzzzzzzzzzz-manila-life2.js; the world:
// 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-life2.js).
// - The calesa's loop inside the old walls: its lanes (L.calesaLaneTiles), its route (L.calesaRoute) and where it is at a
//   moment (L.calesaAt): the clock alone, like the jeepney, so every phone sees it in the same place. Out of its hours it
//   rests at its stand.
// - The elevated train (L.lrtAt): in from the west, along the platform, back out; the clock alone.
// - Street food (L.mnBuyFood): Gold for energy, eaten on the spot (no item, nothing saved but the Gold and the energy).
// - The people's day (L.mnRoleOut, L.mnPlanAt): when a role is out, and which of its stops it is at by the hour.
// Nothing new is saved: a ride and a snack are in the Gold and the energy; the two tours are tips (appended last).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MANILA;
  if (!M || !M.calesa) return;
  var K = M.calesa;
  var PH = 8 * 3600000, DAY = 864e5; // (the hour in the Philippines: the same on every phone, as the jeep's)
  var phMinute = function (ms) { return (((ms + PH) % DAY) + DAY) % DAY / 60000; };
  var inSpan = function (m, span) { return span[0] > span[1] ? m >= span[0] || m < span[1] : m >= span[0] && m < span[1]; };

  // ---------- a loop along centre lines on tile edges (the jeep's way of it, for the calesa) ----------
  var loopRoute = function (def) {
    var segs = [], d = 0;
    def.path.forEach(function (a, i) {
      var b = def.path[(i + 1) % def.path.length], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      segs.push({ a: a, b: b, len: len, d0: d, dir: b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up' });
      d += len;
    });
    var at = -1, st = def.stop.at;
    segs.forEach(function (sg) {
      if (at >= 0) return;
      var onX = sg.a[1] === sg.b[1] && st[1] === sg.a[1] && st[0] >= Math.min(sg.a[0], sg.b[0]) && st[0] <= Math.max(sg.a[0], sg.b[0]);
      var onY = sg.a[0] === sg.b[0] && st[0] === sg.a[0] && st[1] >= Math.min(sg.a[1], sg.b[1]) && st[1] <= Math.max(sg.a[1], sg.b[1]);
      if (onX || onY) at = sg.d0 + Math.abs(st[0] - sg.a[0]) + Math.abs(st[1] - sg.a[1]);
    });
    if (at < 0) throw new Error('the calesa stand is not on its loop');
    var moveMs = 1000 / def.speed;
    return { segs: segs, len: d, stopD: at, moveMs: moveMs, loopMs: d * moveMs + def.stopMs };
  };
  var point = function (r, d) {
    d = ((d % r.len) + r.len) % r.len;
    for (var i = 0; i < r.segs.length; i++) {
      var sg = r.segs[i];
      if (d <= sg.d0 + sg.len || i === r.segs.length - 1) {
        var k = sg.len ? (d - sg.d0) / sg.len : 0;
        return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * k, y: sg.a[1] + (sg.b[1] - sg.a[1]) * k, dir: sg.dir };
      }
    }
    return null;
  };
  var route = null;
  L.calesaRoute = function () { return route || (route = loopRoute(K)); };
  // The tiles its loop covers (two lanes: the tiles either side of the centre line), [x, y].
  L.calesaLaneTiles = function () {
    var out = [], seen = {};
    var add = function (x, y) { var k = y * 1000 + x; if (!seen[k]) { seen[k] = 1; out.push([x, y]); } };
    K.path.forEach(function (a, i) {
      var b = K.path[(i + 1) % K.path.length];
      if (a[1] === b[1]) for (var x = Math.min(a[0], b[0]) - 1; x <= Math.max(a[0], b[0]); x++) { add(x, a[1] - 1); add(x, a[1]); }
      else for (var y = Math.min(a[1], b[1]) - 1; y <= Math.max(a[1], b[1]); y++) { add(a[0] - 1, y); add(a[0], y); }
    });
    return out;
  };
  // Where the calesa is at ms: { x, y (tiles, on the centre line), dir, d, stop (true while it waits at its stand), loop,
  // on (in its hours; else resting at the stand) }. Each loop starts at the stand: it waits there, then goes round.
  L.calesaAt = function (ms) {
    var r = L.calesaRoute(), loop = Math.floor(ms / r.loopMs), t = ms - loop * r.loopMs;
    var on = inSpan(phMinute(ms), K.hours), d, stop;
    if (!on || t < K.stopMs) { d = r.stopD; stop = true; } else { d = r.stopD + (t - K.stopMs) / r.moveMs; stop = false; }
    var p = point(r, d);
    return { x: p.x, y: p.y, dir: p.dir, d: d % r.len, stop: stop, loop: loop, on: on };
  };
  // How long until it next waits at its stand, from ms (0 while it does; -1 if it is resting: out of its hours).
  L.calesaWait = function (ms) {
    var r = L.calesaRoute(), a = L.calesaAt(ms);
    if (!a.on) return -1;
    if (a.stop) return 0;
    return r.loopMs - (ms - a.loop * r.loopMs);
  };
  // A ride: on at the stand in loop `from`, off at the stand `laps` loops later.
  L.calesaRideDone = function (from, at) { return at.stop && at.loop >= from + K.laps; };
  // (nobody stands about on its lanes: the city folk's places on them are let go)
  var lane = {};
  L.calesaLaneTiles().forEach(function (t) { lane[t[1] * 1000 + t[0]] = 1; });
  L.onCalesaLane = function (x, y) { return !!lane[Math.floor(y) * 1000 + Math.floor(x)]; };
  Object.keys(M.crowd.zones).forEach(function (z) { M.crowd.zones[z].at = M.crowd.zones[z].at.filter(function (q) { return !lane[q[1] * 1000 + q[0]]; }); });

  // ---------- the elevated train ----------
  // { x: its west end (tiles), phase: 'away' | 'in' (coming in) | 'stop' | 'out' (going), moving }
  L.lrtAt = function (ms) {
    var R = M.lrt, t = ((ms % R.cycle) + R.cycle) % R.cycle, k;
    if (t < R.arrive) { k = t / R.arrive; return { x: R.fromX + (R.stopX - R.fromX) * (1 - (1 - k) * (1 - k)), phase: 'in', moving: true }; }
    t -= R.arrive;
    if (t < R.stay) return { x: R.stopX, phase: 'stop', moving: false };
    t -= R.stay;
    if (t < R.leave) { k = t / R.leave; return { x: R.stopX + (R.fromX - R.stopX) * k * k, phase: 'out', moving: true }; }
    return { x: R.fromX, phase: 'away', moving: false };
  };

  // ---------- street food ----------
  // Buy and eat one: { ok: true, gain } | { ok: false, why: 'full' | 'gold' | 'none' }. Its energy, never past the most.
  L.mnBuyFood = function (s, key) {
    var f = M.food[key];
    if (!f) return { ok: false, why: 'none' };
    var most = L.maxEnergy(s);
    if (s.energy >= most) return { ok: false, why: 'full' };
    if (s.gold < f.price) return { ok: false, why: 'gold' };
    s.gold -= f.price;
    var gain = Math.min(f.energy, most - s.energy);
    s.energy += gain;
    return { ok: true, gain: gain };
  };

  // ---------- the people's day ----------
  // Is a role out at this minute (its hours; none: always)?
  L.mnRoleOut = function (role, minute) {
    return !role.hours || role.hours.some(function (h) { return minute >= h[0] && minute < h[1]; });
  };
  // Where a role's schedule says it is at this minute: a stop's name, or 'in:<stop>' (gone in there).
  L.mnPlanAt = function (plan, minute) {
    var at = plan[0][1];
    plan.forEach(function (e) { if (minute >= e[0]) at = e[1]; });
    return at;
  };
})(window.Farm = window.Farm || {});
