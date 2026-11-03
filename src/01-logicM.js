// The Fishing Derby's rules (00-zzzzzmore.js): every fish landed has a weight, and the biggest of each kind is kept
// (s.fb: kind -> grams, saved 'fb' in C.FISH_ORDER). On Fish Monday each catch goes to the Derby (19zq-derby.js).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var FS = C.FISH_SIZE;

  // the tours for the Derby and photo mode (19zq-derby.js, 19zs-photo.js). Appended last.
  C.TIPS.push({ key: 'derby_tour', text: 'THE FISHING DERBY' }, { key: 'photo_tour', text: 'FARM PHOTOS' });

  L.fishSize = function (rnd) {
    if (rnd() < FS.giant.odds) return FS.giant.size[0] + rnd() * (FS.giant.size[1] - FS.giant.size[0]);
    return FS.usual[0] + rnd() * (FS.usual[1] - FS.usual[0]);
  };
  L.fishGiant = function (size) { return size >= FS.giant.size[0]; };
  // kg, to a tenth (0.1 kg at the least)
  L.fishKg = function (id, size) { return Math.max(0.1, Math.round((C.FISH_KG[id] || 1) * size * 10) / 10); };
  L.derbyOn = function () { return L.eventOn('fish'); };

  // Landing a fish also weighs it: s.lastFish = { id, kg, giant, record } (a record: bigger than the biggest before).
  var landFish = L.landFish;
  L.landFish = function (s, id, rnd) {
    var got = landFish(s, id);
    s.lastFish = null;
    if (got === '!full' || !C.FISH_KG[got]) return got;
    var size = L.fishSize(rnd || Math.random), kg = L.fishKg(got, size), g = Math.round(kg * 1000), old = (s.fb || {})[got] || 0;
    s.fb = s.fb || {};
    if (g > old) s.fb[got] = g;
    s.lastFish = { id: got, kg: kg, giant: L.fishGiant(size), record: !!old && g > old };
    return got;
  };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.fb = {};
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), fb = s.fb || {};
    if (C.FISH_ORDER.some(function (k) { return fb[k]; })) o.fb = C.FISH_ORDER.map(function (k) { return fb[k] || 0; });
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.fb = {};
    (Array.isArray(o.fb) ? o.fb : []).forEach(function (g, i) {
      var k = C.FISH_ORDER[i], n = Math.floor(Number(g)) || 0;
      if (k && n > 0) s.fb[k] = Math.min(n, Math.round(C.FISH_KG[k] * FS.giant.size[1] * 1000));
    });
    return s;
  };
})(window.Farm = window.Farm || {});
