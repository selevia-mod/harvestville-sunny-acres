// Home storage (owner, 30 Oct 2026, from players: "a storage box in the house to leave items in"). Every farm gets a
// free Dresser once: by the wall if it fits, else in the furniture storage to place with Decorate.
// One cabinet, one storage (owner, 5 Nov 2026): every Dresser and Wardrobe in the house has its own 60 slots, so two
// cabinets are two storages (120 slots). s.store stays one list (like the bag: null or { id, n }), cut in 60s: box b is
// s.store[b * 60 .. b * 60 + 59] and belongs to the b-th cabinet in the house (in s.home.items order). A cabinet with
// things in it can't be put away; an empty one takes its 60 slots with it. There is always at least one box, so things
// kept while no cabinet stands (the free Dresser still in furniture storage) wait for the next one placed.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  C.STORE_SIZE = 60; // a cabinet's slots
  C.STORE_BOXES = 6; // the most cabinets that keep things (360 slots): six full ones keep the biggest farm's save under 16 KB
  ['dresser', 'wardrobe'].forEach(function (k) { H.types[H.typeIndex[k]].use = 'storage'; });

  var SIZE = C.STORE_SIZE;
  var isCabinet = function (it) { return !!it && !!H.types[it.t] && H.types[it.t].use === 'storage'; };
  // The cabinets standing in the house, as indexes into s.home.items, in box order.
  L.cabinets = function (s) {
    var out = [];
    s.home.items.forEach(function (it, i) { if (isCabinet(it)) out.push(i); });
    return out;
  };
  L.boxCount = function (s) { return Math.max(1, Math.ceil((s.store || []).length / SIZE)); };
  // The box of home piece i (a cabinet), or -1.
  L.boxOf = function (s, i) {
    if (!isCabinet(s.home.items[i])) return -1;
    var b = L.cabinets(s).indexOf(i);
    return b < C.STORE_BOXES ? b : -1;
  };
  L.boxSlots = function (s, b) { return s.store.slice(b * SIZE, (b + 1) * SIZE); };
  L.boxUsed = function (s, b) { return L.boxSlots(s, b).filter(Boolean).length; };
  // "Dresser", or "Wardrobe 2" when there is more than one of that kind.
  L.boxName = function (s, b) {
    var cab = L.cabinets(s), it = s.home.items[cab[b]];
    if (!it) return 'Storage';
    var same = cab.filter(function (i) { return s.home.items[i].t === it.t; });
    return H.types[it.t].name + (same.length > 1 ? ' ' + (same.indexOf(cab[b]) + 1) : '');
  };
  // Every cabinet standing has its 60 slots (never fewer than one box; nothing is ever cut off).
  L.fitBoxes = function (s) {
    var want = Math.min(C.STORE_BOXES, Math.max(1, L.cabinets(s).length)) * SIZE;
    while (s.store.length < want) s.store.push(null);
    while (s.store.length % SIZE) s.store.push(null);
  };
  // Runs fn with s.store narrowed to box b, so storeIn / storeOut / moveStore (and their quality versions) work on that
  // cabinet alone, with indexes 0..59. What fn changed goes back into the whole list.
  L.inBox = function (s, b, fn) {
    var all = s.store, base = b * SIZE, part = all.slice(base, base + SIZE);
    while (part.length < SIZE) part.push(null);
    s.store = part;
    try { return fn(); } finally {
      for (var k = 0; k < SIZE; k++) all[base + k] = part[k] || null;
      s.store = all;
    }
  };

  var placeFurn = L.placeFurn;
  L.placeFurn = function (s, t, v, x, y, f) {
    var r = placeFurn(s, t, v, x, y, f);
    if (typeof r === 'number' && s.store) L.fitBoxes(s);
    return r;
  };
  // A cabinet goes into furniture storage only when it is empty, and takes its (empty) box with it.
  var storeFurn = L.storeFurn;
  L.storeFurn = function (s, i) {
    var b = s.store ? L.boxOf(s, i) : -1;
    if (b >= 0 && L.boxUsed(s, b)) return 'notempty';
    var r = storeFurn(s, i);
    if (r === 'ok' && b >= 0 && L.boxCount(s) > 1) s.store.splice(b * SIZE, SIZE);
    return r;
  };

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
    L.fitBoxes(s);
    return s;
  };

  L.storeCount = function (s) { return s.store.filter(Boolean).length; };

  // Puts `count` from bag slot i (all of it when not given) into storage, stacked with the same item first. Returns how
  // many went in.
  L.storeIn = function (s, i, count) {
    var slot = s.inv[i];
    if (!slot) return 0;
    var max = L.stackLimit(slot.id), want = Math.min(count || slot.n, slot.n), n = want, k;
    for (k = 0; k < s.store.length && n > 0; k++) {
      var st = s.store[k];
      if (st && st.id === slot.id && st.n < max) { var add = Math.min(n, max - st.n); st.n += add; n -= add; }
    }
    for (k = 0; k < s.store.length && n > 0; k++) {
      if (!s.store[k]) { var put = Math.min(n, max); s.store[k] = { id: slot.id, n: put }; n -= put; }
    }
    var moved = want - n;
    slot.n -= moved;
    if (slot.n <= 0) s.inv[i] = null;
    return moved;
  };

  // Takes `count` from storage slot k (all of it when not given) into the bag. Returns how many came out (what doesn't
  // fit stays).
  L.storeOut = function (s, k, count) {
    var st = s.store[k];
    if (!st) return 0;
    var want = Math.min(count || st.n, st.n), moved = want - L.addItem(s, st.id, want);
    st.n -= moved;
    if (st.n <= 0) s.store[k] = null;
    return moved;
  };

  // Moves what is in storage slot `from` to slot `to`, like L.moveSlot in the bag: an empty slot, a swap, or stacked.
  L.moveStore = function (s, from, to) {
    var a = s.store[from];
    if (!a) return 'empty';
    if (from === to || to < 0 || to >= s.store.length) return 'same';
    var b = s.store[to];
    if (b && b.id === a.id) {
      var n = Math.min(Math.max(0, L.stackLimit(a.id) - b.n), a.n);
      b.n += n;
      a.n -= n;
      if (a.n <= 0) s.store[from] = null;
    } else {
      s.store[to] = a;
      s.store[from] = b || null;
    }
    return 'ok';
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
    // as many boxes as cabinets standing, or as the save kept (a cabinet that didn't fit back keeps its things)
    var boxes = Math.min(C.STORE_BOXES, Math.max(1, L.cabinets(s).length, Math.ceil(Math.min(st.length, C.STORE_BOXES * SIZE) / SIZE)));
    for (var k = 0; k < boxes * SIZE; k++) {
      var e = st[k], id = Array.isArray(e) && String(e[0]), n = Array.isArray(e) ? int(e[1], 0, C.MAX_STACK, 0) : 0;
      s.store.push(id && C.ITEMS[id] && n > 0 ? { id: id, n: Math.min(n, L.stackLimit(id)) } : null);
    }
    if (!Array.isArray(o.kp)) L.giveDresser(s); // a farm from before storage: its free Dresser
    L.fitBoxes(s);
    return s;
  };
})(window.Farm = window.Farm || {});
