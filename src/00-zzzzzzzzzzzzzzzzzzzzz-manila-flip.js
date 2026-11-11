// Manila, turned round (owner, 11 Nov 2026: "the manila was wrong design, it should be flipped, the manila bay should be on
// the right side, the entrance should be in the left side"). The whole layout above (00-zzzzzzzzzzzzzzzzzzz-manila.js and
// 00-zzzzzzzzzzzzzzzzzzzz-manila-life.js) is mirrored left to right here, once, before any rule reads it: the bay, the
// port, the Mall and the Ferris wheel on the east edge; the station, the elevated rail and the Plains Gate (the way in from
// Willowbrook) on the west. Only places move: every picture still faces the camera, its door down.
// How each kind of number turns: a box [x, y, w, h] -> x = 90 - x - w; a tile [x, y] -> x = 89 - x; a point in the
// world (tile units, 80.5 = the middle of tile 80) -> x = 90 - x; a way someone faces, left <-> right.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  if (!M || M.flipped) return;
  var W = M.W;
  var done = typeof WeakSet === 'function' ? new WeakSet() : null; // (a box shared by two lists turns once)
  var once = function (a) { if (!done) return true; if (done.has(a)) return false; done.add(a); return true; };
  var box = function (a, i) { i = i || 0; if (once(a)) a[i] = W - a[i] - a[i + 2]; return a; }; // [.., x, y, w, h]
  var tile = function (a, i) { i = i || 0; if (once(a)) a[i] = W - 1 - a[i]; return a; };
  var point = function (a, i) { i = i || 0; if (once(a)) a[i] = W - a[i]; return a; };
  var DIR = { left: 'right', right: 'left' };
  var face = function (a, i) { if (DIR[a[i]]) a[i] = DIR[a[i]]; };
  var span = function (a, i0, i1) { var x0 = a[i0], x1 = a[i1]; a[i0] = W - 1 - x1; a[i1] = W - 1 - x0; }; // (tiles x0..x1, both in)
  var say = function (s) { return String(s).replace(/\b(east|west)\b/g, function (w) { return w === 'east' ? 'west' : 'east'; }).replace(/\b(East|West)\b/g, function (w) { return w === 'East' ? 'West' : 'East'; }); };

  M.ground.forEach(function (g) { box(g, 1); });
  M.trackCorners.forEach(function (c) { tile(c); });
  M.buildings.forEach(function (b) { box(b.box); if (b.text) b.text = say(b.text); });
  M.props.forEach(function (p) { box(p, 1); });
  // the bay walk's lamps and benches (their x, 15 and 12: L.manilaMap)
  M.baywalk.lampX = W - (M.baywalk.lampX != null ? M.baywalk.lampX : 15) - 1;
  M.baywalk.benchX = W - (M.baywalk.benchX != null ? M.baywalk.benchX : 12) - 2;
  // the tree rows: 2 x 2 trees every 2 tiles from x0 up to x1
  M.trees.forEach(function (r) { var last = r[0] + 2 * Math.floor((r[2] - r[0]) / 2); var x0 = W - 2 - last; r[2] = W - 2 - r[0]; r[0] = x0; });
  M.looseTrees.forEach(function (t) { t[0] = W - 2 - t[0]; });
  M.bushes.forEach(function (b) { tile(b); });
  (M.fences || []).forEach(function (f) { span(f, 0, 2); f[4] = W - 1 - f[4]; });
  M.crates.forEach(function (c) { tile(c); });
  M.berths.forEach(function (b) { tile(b); });
  M.gates.forEach(function (g) { box(g.box); tile(g.sign); g.text = say(g.text); });
  M.signs.forEach(function (s) { tile(s); s[2] = say(s[2]); });
  M.decor.forEach(function (d) { box(d, 1); });
  (M.scatter || []).forEach(function (s) { span(s, 1, 3); });
  Object.keys(M.spawns).forEach(function (k) { point(M.spawns[k]); face(M.spawns[k], 2); });
  Object.keys(M.spots).forEach(function (k) { point(M.spots[k]); });
  // the crowd's places (tiles), and which way they face there
  Object.keys(M.crowd.zones).forEach(function (z) { M.crowd.zones[z].at.forEach(function (q) { tile(q); face(q, 2); }); });
  M.crowd.lines = M.crowd.lines.map(say);
  M.people.order.forEach(function (k) { var p = M.people[k]; p.met = say(p.met); p.lines = p.lines.map(say); });
  // the jeepney: its loop (on tile edges: points), its stops and sheds, the crosswalks
  M.jeep.path.forEach(function (p) { point(p); });
  M.jeep.stops.forEach(function (st) { point(st.at); box(st.shed); point(st.wait); });
  M.jeep.cross.forEach(function (c) { box(c); });
  // the elevated railway: its deck from x0 to x1, pillars (their middles), the buffer's end, the train, platform and stairs
  var R = M.rail;
  if (R) {
    var x0 = R.x0, x1 = R.x1, long = 4 + 4 * R.cars;
    R.x0 = W - x1; R.x1 = W - x0;
    R.pillars = R.pillars.map(function (x) { return W - x; });
    R.end = W - R.end;
    R.train = W - R.train - long;
    if (R.platform != null) R.platform = W - R.platform - 4;
    if (R.stairs != null) R.stairs = W - R.stairs - 2;
    R.flip = true; // (19zzzzzzzzzzzzzzzzzzzzzzzzzz-manila-life.js: the buffer at the east end now, the train's head that way)
  }
  M.railsBox = box([56, 10, W - 56, 2]); // the station's solid rails (L.manilaMap)
  // the roles' posts, the pickleball court; the Mall's door outside (its inside is its own map and stays as it is)
  Object.keys(M.roles).forEach(function (k) { var r = M.roles[k]; if (r.post) { point(r.post); face(r.post, 2); } if (r.court) box(r.court); });
  point(M.mall.out);
  M.flipped = true;
})(window.Farm = window.Farm || {});
