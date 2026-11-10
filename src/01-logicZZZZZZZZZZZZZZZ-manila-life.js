// Manila city life's rules (content: 00-zzzzzzzzzzzzzzzzzzzz-manila-life.js; the world: 19zzzzzzzzzzzzzzzzzzzzzzzzzz-manila-life.js).
// - The jeepney's loop: its road's tiles (L.manilaRoadTiles), the route with its stops (L.jeepRoute) and where it is at a
//   moment (L.jeepAt): a pure function of the clock, so every phone shows it in the same place with no server.
// - The Mall's inside: its own small map (L.mallMap), built from the house's indoor sheet; saved as Manila at the Mall's door.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var M = C.MANILA;
  var J = M.jeep;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  // ---------- the loop road ----------
  // A segment's centre line runs on tile edges; its 2 lanes are the tiles either side (a corner is covered by both).
  L.manilaRoadTiles = function () {
    var out = [], seen = {}, add = function (x, y) { var k = y * 1000 + x; if (!seen[k]) { seen[k] = 1; out.push([x, y]); } };
    J.path.forEach(function (a, i) {
      var b = J.path[(i + 1) % J.path.length];
      if (a[1] === b[1]) for (var x = Math.min(a[0], b[0]) - 1; x <= Math.max(a[0], b[0]); x++) { add(x, a[1] - 1); add(x, a[1]); }
      else for (var y = Math.min(a[1], b[1]) - 1; y <= Math.max(a[1], b[1]); y++) { add(a[0] - 1, y); add(a[0], y); }
    });
    return out;
  };

  // ---------- the route: segments, the stops along it, how long a loop takes ----------
  var route = null;
  L.jeepRoute = function () {
    if (route) return route;
    var segs = [], d = 0;
    J.path.forEach(function (a, i) {
      var b = J.path[(i + 1) % J.path.length], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      segs.push({ a: a, b: b, len: len, d0: d, dir: b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up' });
      d += len;
    });
    // each stop: how far along the loop it is (its point lies on one segment)
    var stops = J.stops.map(function (st, i) {
      var at = -1;
      segs.forEach(function (sg) {
        if (at >= 0) return;
        var onX = sg.a[1] === sg.b[1] && st.at[1] === sg.a[1] && st.at[0] >= Math.min(sg.a[0], sg.b[0]) && st.at[0] <= Math.max(sg.a[0], sg.b[0]);
        var onY = sg.a[0] === sg.b[0] && st.at[0] === sg.a[0] && st.at[1] >= Math.min(sg.a[1], sg.b[1]) && st.at[1] <= Math.max(sg.a[1], sg.b[1]);
        if (onX || onY) at = sg.d0 + Math.abs(st.at[0] - sg.a[0]) + Math.abs(st.at[1] - sg.a[1]);
      });
      if (at < 0) throw new Error('jeep stop ' + st.key + ' is not on its road');
      return { i: i, d: at };
    }).sort(function (x, y) { return x.d - y.d; });
    var moveMs = 1000 / J.speed;
    route = { segs: segs, len: d, stops: stops, moveMs: moveMs, loopMs: d * moveMs + stops.length * J.stopMs };
    return route;
  };
  // the point d tiles along the loop: { x, y (tiles, on the centre line), dir }
  L.jeepPoint = function (d) {
    var r = L.jeepRoute();
    d = ((d % r.len) + r.len) % r.len;
    for (var i = 0; i < r.segs.length; i++) {
      var sg = r.segs[i];
      if (d <= sg.d0 + sg.len || i === r.segs.length - 1) {
        var k = sg.len ? (d - sg.d0) / sg.len : 0;
        return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * k, y: sg.a[1] + (sg.b[1] - sg.a[1]) * k, dir: sg.dir, seg: i };
      }
    }
    return null;
  };
  var PH = 8 * 3600000, DAY = 864e5; // (the hour as in the Philippines: the same night for every phone)
  var inSpan = function (m, span) { return span[0] > span[1] ? m >= span[0] || m < span[1] : m >= span[0] && m < span[1]; };
  // Where the jeep is at ms (the clock): { x, y, dir, d (tiles along), stop (a stop's index while it waits there, else -1),
  // next (the next stop's index), loop, on (false: off the road this loop, at night), lights }
  L.jeepAt = function (ms) {
    var r = L.jeepRoute(), loop = Math.floor(ms / r.loopMs), t = ms - loop * r.loopMs, d = 0, stop = -1, next = r.stops[0].i;
    for (var k = 0; k <= r.stops.length; k++) {
      var to = k < r.stops.length ? r.stops[k].d : r.len, drive = (to - d) * r.moveMs;
      if (t < drive) { d += t / r.moveMs; next = k < r.stops.length ? r.stops[k].i : r.stops[0].i; t = -1; break; }
      t -= drive;
      d = to;
      if (k === r.stops.length) break;
      if (t < J.stopMs) { stop = r.stops[k].i; next = r.stops[(k + 1) % r.stops.length].i; t = -1; break; }
      t -= J.stopMs;
    }
    var p = L.jeepPoint(d), minute = (((ms + PH) % DAY) + DAY) % DAY / 60000;
    return { x: p.x, y: p.y, dir: p.dir, d: d, stop: stop, next: next, loop: loop, on: !inSpan(minute, J.night) || loop % 2 === 0, lights: inSpan(minute, J.lights) };
  };
  // How long until the jeep is next waiting at stop i (ms; 0 while it is), from ms.
  L.jeepWait = function (ms, i) {
    var r = L.jeepRoute();
    for (var t = 0; t < 3 * r.loopMs; t += 500) { var j = L.jeepAt(ms + t); if (j.stop === i && j.on) return t; }
    return -1;
  };

  // ---------- the Mall inside ----------
  // From the house's indoor sheet (its floor, walls and void), with the Mall's shops and props as Manila's own drawn props.
  L.mallMap = function (house) {
    var A = M.mall, W = A.W, Hh = A.H, S = 256;
    var ts = house.tilesets.filter(function (t) { return t.name === 'indoor'; })[0];
    if (!ts) throw new Error('L.mallMap: the house map has no indoor sheet');
    ts = JSON.parse(JSON.stringify(ts));
    var I = { floor: 0, floor2: 1, wall: 2, wall_low: 3, wall_side: 4, void: 5 }, g = function (k) { return ts.firstgid + I[k]; };
    var lay = function () { var a = new Array(W * Hh); for (var i = 0; i < a.length; i++) a[i] = 0; return a; };
    var ground = lay(), walls = lay(), objects = [], id = 1;
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) {
      var edge = x === 0 || x === W - 1 || y === Hh - 1;
      ground[y * W + x] = edge ? g('void') : y === 0 ? g('wall') : y === 1 ? g('wall_low') : g((x + y) % 2 ? 'floor2' : 'floor');
    }
    var d = A.door;
    for (var dx = 0; dx < d[2]; dx++) ground[d[1] * W + d[0] + dx] = g('floor'); // (the way out)
    var prop = function (n, t, v) { return { name: n, type: t, value: v }; };
    var obj = function (name, type, b, props) { objects.push({ id: id++, name: name, type: type, x: b[0] * S, y: b[1] * S, width: b[2] * S, height: b[3] * S, rotation: 0, visible: true, properties: props }); };
    A.shops.forEach(function (sh) {
      obj(sh.key, 'mn_prop', sh.box, [prop('stand', 'string', '@mall_' + sh.key), prop('foot', 'int', sh.box[3] - 1), prop('art', 'string', sh.art), prop('label', 'string', sh.name),
        prop('text', 'string', sh.text || ''), prop('food', 'int', sh.food ? 1 : 0), prop('box', 'int', 1)]);
    });
    A.props.forEach(function (p, i) { obj('mp' + i, 'mn_prop', [p[1], p[2], p[3], p[4]], [prop('stand', 'string', '@mall_' + p[0]), prop('foot', 'int', p[5]), prop('art', 'string', 'mall_' + p[0])]); });
    obj('exit', 'warp', d, [prop('to', 'string', 'manila'), prop('spawn', 'string', 'from_mall'), prop('walk', 'bool', true)]);
    objects.push({ id: id++, name: 'entrance', type: 'spawn', point: true, x: Math.round(A.entrance[0] * S), y: Math.round(A.entrance[1] * S), width: 0, height: 0, rotation: 0, visible: true, properties: [prop('dir', 'string', 'up')] });
    var tl = function (lid, name, data) { return { id: lid, name: name, type: 'tilelayer', width: W, height: Hh, x: 0, y: 0, opacity: 1, visible: true, data: data }; };
    return {
      compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: W, height: Hh, tilewidth: S, tileheight: S, nextlayerid: 4, nextobjectid: id,
      layers: [tl(1, 'Ground', ground), tl(2, 'Walls', walls), { id: 3, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objects }],
      tilesets: [ts],
    };
  };

  // ---------- the goal arrow's way out of the Mall (its door), and in (through Manila) ----------
  if (C.ROUTES && C.ROUTES.manila) {
    C.ROUTES.mall = {};
    Object.keys(C.ROUTES).forEach(function (m) {
      if (m === 'mall') return;
      C.ROUTES.mall[m] = 'exit';
      C.ROUTES[m].mall = m === 'manila' ? 'mall' : C.ROUTES[m].manila;
    });
  }

  // ---------- the save: inside the Mall is saved as Manila, at the Mall's door ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    if (s.map !== 'mall') return serialize(s);
    var out = M.mall.out;
    return serialize(Object.assign({}, s, { map: 'manila', player: { x: Math.round(out[0] * 256), y: Math.round(out[1] * 256), dir: 'down' } }));
  };
  void int;
})(window.Farm = window.Farm || {});
