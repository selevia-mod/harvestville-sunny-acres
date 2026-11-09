// Town Raid: the raiders that walk (the boars; the fliers are crows, sparks and the typhoon's debris) go round the house,
// fences and trees instead of through them (owner, 9 Nov 2026: a boar "awkwardly walking into the house, looks like they
// are floating"). They come in on open ground, find their way to the crop on the tiles you can walk on, and run off the
// same way. Fliers still go straight.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var T = C.TILE;

  var free = function (w, x, y) { return w.inMap(x, y) && w.walkable(x, y) && !w.blocked[w.idx(x, y)]; };
  var tileOf = function (v) { return Math.floor(v / T); };
  var walks = function (a) { return a && a.def && !a.def.flies; };

  // a free tile near (px, py) (pixels), or null
  P.raidFreeNear = function (px, py, most) {
    var x0 = tileOf(px), y0 = tileOf(py);
    for (var r = 0; r <= (most || 4); r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (free(this, x0 + dx, y0 + dy)) return { x: x0 + dx, y: y0 + dy };
    }
    return null;
  };
  // tile centres from (sx, sy) to (gx, gy) round what you can't walk on (8 ways, no cutting corners); null: no way
  P.raidRoute = function (sx, sy, gx, gy) {
    var self = this, w = this.map.width, h = this.map.height, start = sy * w + sx, goal = gy * w + gx;
    if (start === goal) return [];
    var prev = new Int32Array(w * h).fill(-1), q = [start], seen = 0, okGoal = function (i) { return i === goal; };
    prev[start] = start;
    while (seen < q.length && q.length < 4000) {
      var i = q[seen++], x = i % w, y = (i - x) / w;
      if (okGoal(i)) break;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] >= 0) continue;
        if (n !== goal && !free(self, nx, ny)) continue;
        if (dx && dy && (!free(self, x + dx, y) || !free(self, x, y + dy))) continue; // (no corners)
        prev[n] = i;
        q.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    var path = [];
    for (var k = goal; k !== start; k = prev[k]) path.push([(k % w + 0.5) * T, (Math.floor(k / w) + 0.6) * T]);
    return path.reverse();
  };

  // in on open ground (never on the house or in a tree)
  var addRaider = P.addRaider;
  P.addRaider = function (r) {
    var a = addRaider.call(this, r);
    if (!walks(a)) return a;
    var t = this.raidFreeNear(a.x, a.y, 6);
    if (t) {
      a.x = (t.x + 0.5) * T; a.y = (t.y + 0.6) * T;
      a.img.setPosition(a.x, a.y); a.sh.setPosition(a.x, a.y);
    }
    return a;
  };

  // each step: toward the next tile of its way, not straight at the goal
  var update = P.updateRaider;
  P.updateRaider = function (a, dt, time, r) {
    if (!walks(a) || (a.mode !== 'come' && a.mode !== 'flee')) return update.call(this, a, dt, time, r);
    var key = a.mode + ':' + Math.round(a.tx) + ',' + Math.round(a.ty);
    if (a.routeFor !== key) {
      a.routeFor = key;
      var gt = { x: tileOf(a.tx), y: tileOf(a.ty) };
      if (a.mode === 'flee' && !free(this, gt.x, gt.y)) gt = this.raidFreeNear(a.tx, a.ty, 4) || gt;
      a.route = this.raidRoute(tileOf(a.x), tileOf(a.y), gt.x, gt.y);
      a.goal = { x: a.tx, y: a.ty };
      if (!a.route && a.mode === 'come') { // no way to that crop: another one (or it stays put and is driven off)
        var aim = this.raidAim();
        if (aim.idx !== a.idx) { a.tx = aim.x; a.ty = aim.y; a.idx = aim.idx; a.routeFor = null; }
      }
    }
    if (a.route && a.route.length) {
      var wp = a.route[0];
      if (Math.hypot(wp[0] - a.x, wp[1] - a.y) < 0.15 * T && a.route.length > 1) { a.route.shift(); wp = a.route[0]; }
      // aim at the waypoint for this step, then put the real goal back (the base step ends 'come' at the goal itself)
      var last = a.route.length === 1, gx = a.tx, gy = a.ty;
      if (!last) { a.tx = wp[0]; a.ty = wp[1]; }
      var mode = a.mode;
      update.call(this, a, dt, time, r);
      if (!last && a.mode === 'eat' && mode === 'come') { a.mode = 'come'; } // (reached a waypoint, not the crop)
      if (!last) { a.tx = gx; a.ty = gy; }
      return;
    }
    return update.call(this, a, dt, time, r);
  };

  // The real wild boar (the hunting places' picture), not a farm pig: fetched in the countdown, so the boars look like
  // boars when they come (owner, 9 Nov 2026: "those are not boars, those are Pigs"). Without it (offline), the pig stays.
  var raidBar = F.UIScene.prototype.raidBar;
  F.UIScene.prototype.raidBar = function (ph) {
    raidBar.call(this, ph);
    var look = ph && ph.r && L.raidKind(ph.r).look;
    if ((ph.phase === 'soon' || ph.phase === 'on') && look && look.wild && F.needImage && !(F.images && F.images.wild) && !this.raidWildAsked) {
      this.raidWildAsked = true;
      F.needImage('wild');
    }
  };
})(window.Farm = window.Farm || {});
