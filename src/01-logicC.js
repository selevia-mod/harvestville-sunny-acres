// Home storage (owner, 30 Oct 2026, from players: "a storage box in the house to leave items in"). The Dresser and
// the Wardrobe open it, every one of them the same 60 slots (s.store, like the bag: null or { id, n }). Every farm
// gets a free Dresser once: by the wall if it fits, else in the furniture storage to place with Decorate.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  C.STORE_SIZE = 60;
  ['dresser', 'wardrobe'].forEach(function (k) { H.types[H.typeIndex[k]].use = 'storage'; });

  // The free Dresser: next to the bed side of the room if there's room, else into the furniture storage.
  L.giveDresser = function (s) {
    var t = H.typeIndex.dresser;
    var owned = s.home.items.some(function (it) { return it.t === t; }) ||
      Object.keys(s.home.bag).some(function (k) { return +k.split('.')[0] === t && s.home.bag[k] > 0; });
    if (owned) return null;
    var spot = L.clearSpot(s, t);
    if (spot) { s.home.items.push({ t: t, v: 0, x: spot.x, y: spot.y, f: 0 }); return 'placed'; }
    s.home.bag[L.furnKey(t, 0)] = (s.home.bag[L.furnKey(t, 0)] || 0) + 1;
    return 'bag';
  };

  // A spot where the whole piece shows (not only its feet free: nothing standing in front of or behind it), nearest
  // the right-hand wall by the bed, or null.
  L.clearSpot = function (s, t) {
    var size = L.homeSize(s), best = null, bd = Infinity, box = {};
    s.home.items.forEach(function (it) {
      if (H.types[it.t].place === 'flat') return;
      L.furnTiles(it.t, it.x, it.y).box.forEach(function (p) { box[p[0] + ',' + p[1]] = 1; });
    });
    for (var y = 1; y < size.h; y++) for (var x = 1; x < size.w; x++) {
      if (L.cantPlace(s, t, x, y, null)) continue;
      if (L.furnTiles(t, x, y).box.some(function (p) { return box[p[0] + ',' + p[1]]; })) continue;
      var d = Math.abs(x - (size.w - 3)) + Math.abs(y - 2) * 1.5;
      if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    return best;
  };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.store = [];
    for (var i = 0; i < C.STORE_SIZE; i++) s.store.push(null);
    L.giveDresser(s);
    return s;
  };

  L.storeCount = function (s) { return s.store.filter(Boolean).length; };

  // Puts the whole stack from bag slot i into storage (stacked with the same item first). Returns how many went in.
  L.storeIn = function (s, i) {
    var slot = s.inv[i];
    if (!slot) return 0;
    var max = L.stackLimit(slot.id), n = slot.n, k;
    for (k = 0; k < s.store.length && n > 0; k++) {
      var st = s.store[k];
      if (st && st.id === slot.id && st.n < max) { var add = Math.min(n, max - st.n); st.n += add; n -= add; }
    }
    for (k = 0; k < s.store.length && n > 0; k++) {
      if (!s.store[k]) { var put = Math.min(n, max); s.store[k] = { id: slot.id, n: put }; n -= put; }
    }
    var moved = slot.n - n;
    slot.n = n;
    if (slot.n <= 0) s.inv[i] = null;
    return moved;
  };

  // Takes the whole stack in storage slot k into the bag. Returns how many came out (what doesn't fit stays).
  L.storeOut = function (s, k) {
    var st = s.store[k];
    if (!st) return 0;
    var left = L.addItem(s, st.id, st.n), moved = st.n - left;
    st.n = left;
    if (st.n <= 0) s.store[k] = null;
    return moved;
  };

  // ---------- save: 'kp' (what you keep), always written (even empty): an older save is known by not having it ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), st = s.store.map(function (x) { return x ? [x.id, x.n] : 0; });
    while (st.length && !st[st.length - 1]) st.pop();
    o.kp = st;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.store = [];
    var st = Array.isArray(o.kp) ? o.kp : [];
    for (var k = 0; k < C.STORE_SIZE; k++) {
      var e = st[k], id = Array.isArray(e) && String(e[0]), n = Array.isArray(e) ? int(e[1], 0, C.MAX_STACK, 0) : 0;
      s.store.push(id && C.ITEMS[id] && n > 0 ? { id: id, n: Math.min(n, L.stackLimit(id)) } : null);
    }
    if (!Array.isArray(o.kp)) L.giveDresser(s); // a farm from before storage: its free Dresser
    return s;
  };
})(window.Farm = window.Farm || {});
