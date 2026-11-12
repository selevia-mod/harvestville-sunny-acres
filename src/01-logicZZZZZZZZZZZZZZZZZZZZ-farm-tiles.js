// A farm tile's number between phones while some still run the 64-wide farm (lands 7-9, 12 Nov 2026: C.FARM_W 64 -> 75).
// A save and a snapshot say their width (fw), but some numbers travel without one: the owner's live field for visitors
// (19zg-live-farm.js), a friend's watering (farm_help_v1) and picking (farm_pick_v1, kept on the server till claimed).
// An old app reads every such number as y * 64 + x, so a new app sends that, and reads what it gets as that:
//   L.tileOut(i): this farm's tile -> y * 64 + x; a tile at x 64+ (only on lands 7-9, which an old app has not got) ->
//                 FAR + y * 200 + x: past any 64-wide farm tile (64 x 38), so an old app finds nothing there and leaves
//                 it (its live field: past its map; its help and pick: no soil there), and below a fruit tree's number
//                 (01-logicB.js L.treeTile, 50000+); within the server's 0..100000.
//   L.tileIn(n):  what came (an old app's or a new one's) -> this farm's tile, or -1.
// A new app's snapshot is written as an old app reads it (fw 64), the tiles at x 64+ beside it (fx), which only a new
// app reads: an old app moved a 75-wide one with x up to 74, so those tiles came out a row lower at x 0-10, and its
// sprinklers (sp) and cleared decorations (dco), never moved, all on other tiles. Once every phone has the 75-wide farm,
// both can go (and the snapshot's fw 75 come back); a help or a pick waits on the server at most a few days.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var OLD = 64, FAR = 20000, ROW = 200, TREE0 = 50000;
  L.TILE_OLD_W = OLD;
  L.tileOut = function (i) {
    i = Number(i);
    if (!Number.isInteger(i) || i < 0) return -1;
    var x = i % C.FARM_W, y = Math.floor(i / C.FARM_W), n = x < OLD ? y * OLD + x : FAR + y * ROW + x;
    return n < (x < OLD ? FAR : TREE0) ? n : -1; // (no farm is that tall: 38 rows)
  };
  L.tileIn = function (n) {
    if (typeof n !== 'number' && !(typeof n === 'string' && n)) return -1; // (null and '' are not tile 0)
    n = Number(n);
    if (!Number.isInteger(n) || n < 0 || n >= TREE0) return -1;
    var far = n >= FAR, x = far ? (n - FAR) % ROW : n % OLD, y = far ? Math.floor((n - FAR) / ROW) : Math.floor(n / OLD);
    return x < C.FARM_W ? y * C.FARM_W + x : -1;
  };

  // ---------- the snapshot (friends' visits, a raid's look) ----------
  var farOut = function (i) { return Number(i) % C.FARM_W >= OLD; };
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var snap = snapshot.apply(this, arguments);
    if (!snap || C.FARM_W === OLD || snap.fw !== C.FARM_W) return snap;
    var fx = { s: [], d: [], sp: [], dco: [] }, sp = [], n = 0;
    var rows = function (list, far) {
      return (list || []).filter(function (e) {
        var keep = !farOut(e[0]);
        e[0] = L.tileOut(e[0]);
        if (!keep && e[0] >= 0) far.push(e);
        return keep && e[0] >= 0;
      });
    };
    snap.soil = rows(snap.soil, fx.s);
    snap.debris = rows(snap.debris, fx.d);
    if (Array.isArray(snap.sp)) {
      for (var k = 0; k + 1 < snap.sp.length; k += 2) (farOut(snap.sp[k]) ? fx.sp : sp).push(L.tileOut(snap.sp[k]), snap.sp[k + 1]);
      snap.sp = sp;
    }
    if (Array.isArray(snap.dco)) snap.dco = snap.dco.filter(function (i) { if (farOut(i)) fx.dco.push(L.tileOut(i)); return !farOut(i); }).map(L.tileOut);
    Object.keys(fx).forEach(function (k) { if (fx[k].length) n++; else delete fx[k]; });
    if (n) snap.fx = fx;
    snap.fw = OLD;
    return snap;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var fw = snap && typeof snap === 'object' ? Math.floor(Number(snap.fw)) || 38 : C.FARM_W; // (01-logicE.js: none is 38)
    if (fw === C.FARM_W) return visitState.apply(this, arguments);
    var o = Object.assign({}, snap), fx = fw === OLD && snap.fx && typeof snap.fx === 'object' ? snap.fx : null;
    var list = function (v, most) { return Array.isArray(v) ? v.slice(0, most) : []; };
    var move = function (i) { i = Math.floor(Number(i)); return i >= 0 ? Math.floor(i / fw) * C.FARM_W + i % fw : -1; };
    if (fx) { // a new app's: all of it at this width, nothing moved after
      var rows = function (main, far, most) {
        return list(main, most).concat(list(far, most)).filter(Array.isArray).map(function (e) { return [L.tileIn(e[0])].concat(e.slice(1)); });
      };
      o.soil = rows(snap.soil, fx.s, C.SNAP_SOIL);
      o.debris = rows(snap.debris, fx.d, 800);
      o.dco = list(snap.dco, 2000).concat(list(fx.dco, 2000)).map(L.tileIn);
      o.fw = C.FARM_W;
    }
    // the sprinklers were never moved with the soil (01-logicZ-farmtech.js puts them on the soil as it is by then)
    if (Array.isArray(snap.sp)) {
      var sp = [], from = list(snap.sp, 240).concat(fx ? list(fx.sp, 240) : []);
      for (var k = 0; k + 1 < from.length; k += 2) sp.push(fx ? L.tileIn(from[k]) : move(from[k]), from[k + 1]);
      o.sp = sp;
    } else if (fx && Array.isArray(fx.sp)) {
      o.sp = list(fx.sp, 240).map(function (v, k) { return k % 2 ? v : L.tileIn(v); });
    }
    return visitState.call(this, o, mine);
  };
})(window.Farm = window.Farm || {});
