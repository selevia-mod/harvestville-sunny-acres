// The rig's arithmetic (the farmer boy built from parts while he shoots the Rifle: 19zzzzzzzzzzzzzzzzzzzzzzzzzzzzz-rig.js).
// Pure, no Phaser, unit tested: the two-bone reach of an arm, the shot's timing curves, and how far he may turn to aim.
(function (F) {
  'use strict';
  var L = F.Logic;
  var C = F.Config;

  // The rig's timing (ms): the rifle comes up, he holds the aim, the shot, the kick and its settling.
  C.RIG = { raise: 150, kickIn: 30, hitStop: 45, settle: 250, fadeMs: 80,
    // how far the aim may turn from the way he faces (radians): side on, down (-) and up (+); facing you or away, sideways
    side: [-0.5, 0.6], ahead: 0.5,
    lean: 0.25, // the body turns this share of the aim's turn
  };

  // An arm from the shoulder (sx, sy) reaching for (tx, ty): the elbow and where the wrist ends up, the upper arm l1 long
  // and the forearm l2. bend: +1 or -1, which way the elbow goes. Too far: the arm straight, pointing at it; too close:
  // folded as far as it goes.
  L.rigIK = function (sx, sy, tx, ty, l1, l2, bend) {
    var dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    var lo = Math.abs(l1 - l2) + 0.001, hi = l1 + l2 - 0.001, dd = Math.max(lo, Math.min(hi, d));
    var cosB = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), B = Math.acos(Math.max(-1, Math.min(1, cosB))) * (bend < 0 ? -1 : 1);
    var ex = sx + Math.cos(a + B) * l1, ey = sy + Math.sin(a + B) * l1;
    var fa = Math.atan2(sy + Math.sin(a) * dd - ey, sx + Math.cos(a) * dd - ex);
    return { ex: ex, ey: ey, wx: ex + Math.cos(fa) * l2, wy: ey + Math.sin(fa) * l2, reach: d <= hi + 0.01 };
  };
  // Which way the elbow bends: side on it hangs down (the larger y); facing you or away it goes outwards (away from x 0).
  L.rigBend = function (view, sx, sy, tx, ty, l1, l2) {
    var a = L.rigIK(sx, sy, tx, ty, l1, l2, 1), b = L.rigIK(sx, sy, tx, ty, l1, l2, -1);
    if (view === 'side') return a.ey >= b.ey ? 1 : -1;
    return Math.abs(a.ex) >= Math.abs(b.ex) ? 1 : -1;
  };

  var ease = function (u) { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); };
  // 0 (the rifle low) to 1 (up to the shoulder), eased, ms after the shot began
  L.rigRaise = function (ms) { return ease(ms / C.RIG.raise); };
  // The kick, 0..1, ms after the shot went: in fast, held a moment (the hit-stop), then settling back.
  L.rigKick = function (ms) {
    var R = C.RIG;
    if (ms < 0) return 0;
    if (ms < R.kickIn) return ms / R.kickIn;
    if (ms < R.kickIn + R.hitStop) return 1;
    return 1 - ease((ms - R.kickIn - R.hitStop) / R.settle);
  };
  // The aim, in the rig's own frame (facing right is drawn as facing left, mirrored): `ang` the way to the animal, `dir`
  // the way he faces. Returns { ang (radians, in the rig), dev (how far from straight ahead) }, held within C.RIG's limits.
  L.rigAim = function (dir, ang) {
    var R = C.RIG, wrap = function (v) { while (v > Math.PI) v -= 2 * Math.PI; while (v < -Math.PI) v += 2 * Math.PI; return v; };
    if (dir === 'right') ang = Math.PI - ang; // (mirrored)
    var ahead = dir === 'down' ? Math.PI / 2 : dir === 'up' ? -Math.PI / 2 : Math.PI;
    var dev = wrap(ang - ahead);
    if (dir === 'left' || dir === 'right') dev = Math.max(R.side[0], Math.min(R.side[1], dev)); // (side on: + is the muzzle up)
    else dev = Math.max(-R.ahead, Math.min(R.ahead, dev));
    return { ang: ahead + dev, dev: dev };
  };
})(window.Farm = window.Farm || {});
