// Rules for online play (settings in 00-online.js): the snapshot of your farm that other players see (house,
// furniture, yard, crops, animals; never your bag, gold or progress), rebuilding a visited farm from someone
// else's snapshot (every value checked: it comes from another player), weekly scores, and the save.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME, O = C.OUTDOOR;

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.net = L.newNet();
    return s;
  };
  // pb: refills sent to the server whose answer never came (request id, currency, price, version, ms sent), so a lost
  // answer can be settled later: the energy is given if the server took the payment, or the entry is dropped.
  L.newNet = function () { return { id: '', name: '', code: '', wk: 0, e0: 0, q0: 0, named: 0, off: 0, pb: [] }; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  L.cleanBuys = function (list) {
    return (Array.isArray(list) ? list : []).filter(function (b) {
      return Array.isArray(b) && UUID.test(String(b[0])) && (b[1] === 'coins' || b[1] === 'stars');
    }).slice(-3).map(function (b) { return [String(b[0]), b[1], int(b[2], 0, 1e5, 0), int(b[3], 0, 1e6, 0), int(b[4], 0, 1e14, 0)]; });
  };

  // ---------- the snapshot ----------
  L.snapshot = function (s) {
    var soil = [];
    Object.keys(s.soil).forEach(function (idx) {
      var t = s.soil[idx];
      // [tile, crop + 1, its stage now (0 seeds .. 3 ripe, 4 withered), watered]
      if (soil.length < 400) soil.push([Number(idx), t.c ? C.CROP_KEYS.indexOf(t.c) + 1 : 0, t.c ? L.cropStage(t) : 0, t.w ? 1 : 0]);
    });
    var debris = [];
    Object.keys(s.debris).forEach(function (idx) { if (debris.length < 800) debris.push([Number(idx), C.DEBRIS_KEYS.indexOf(s.debris[idx])]); });
    return {
      v: 1, day: s.day, look: s.look === 'girl' ? 'girl' : 'boy',
      home: { level: s.home.level, wall: s.home.wall, floor: s.home.floor, items: s.home.items.map(function (it) { return [it.t, it.v, it.x, it.y, it.f]; }) },
      yard: s.yard.items.map(function (it) { return [it.t, it.x, it.y]; }),
      soil: soil,
      debris: debris,
      animals: s.animals.slice(0, 40).map(function (a) { return [a.kind, a.name, a.young ? 1 : 0]; }),
      builds: { coop2: s.builds.coop2 ? 1 : 0, barn2: s.builds.barn2 ? 1 : 0, stable: s.builds.stable ? 1 : 0, kitchen: s.builds.kitchen ? 1 : 0 },
      pets: { cat: s.cat ? 1 : 0, horse: s.horse ? 1 : 0, dog: s.dog ? s.dog.name : '' },
    };
  };

  var int = function (v, min, max, fallback) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  };
  var str = function (v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : ''; };

  // A state to walk around someone else's farm in: their house, furniture, yard, crops and animals, nothing else.
  // `snap` is untrusted: anything unknown or out of range is dropped.
  L.visitState = function (snap, mine) {
    var now = L.nowMin();
    snap = snap && typeof snap === 'object' ? snap : {};
    var s = L.newState();
    s.seed = 1;
    s.day = mine ? mine.day : int(snap.day, 1, 1e6, 1); // today, the same sky as yours (their snapshot may be days old)
    s.time = mine ? mine.time : 10 * 60;
    s.look = snap.look === 'girl' ? 'girl' : 'boy';
    s.goal = 1e6; // no first-days goals
    s.debris = {};
    var home = snap.home && typeof snap.home === 'object' ? snap.home : {};
    s.home = L.newHome(int(home.level, 1, H.levels.length, 1));
    s.home.wall = int(home.wall, 0, H.styles.length - 1, 0);
    s.home.floor = int(home.floor, 0, H.styles.length - 1, 0);
    s.home.items = [];
    (Array.isArray(home.items) ? home.items : []).slice(0, 200).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var t = int(e[0], -1, 1e6, -1), v = int(e[1], -1, 1e6, -1);
      if (!H.types[t] || !H.styles[v]) return; // unknown pieces are dropped, not guessed
      var x = int(e[2], 0, 40, 0), y = int(e[3], 0, 40, 0);
      if (L.cantPlace(s, t, x, y, null)) return; // keeps the room walkable and every piece in bounds
      s.home.items.push({ t: t, v: v, x: x, y: y, f: e[4] ? 1 : 0 });
    });
    s.yard = { items: [], bag: {} };
    (Array.isArray(snap.yard) ? snap.yard : []).slice(0, 300).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var t = int(e[0], -1, 1e6, -1);
      if (O.types[t]) s.yard.items.push({ t: t, x: int(e[1], 0, 999, 0), y: int(e[2], 0, 999, 0) });
    });
    s.soil = {};
    (Array.isArray(snap.soil) ? snap.soil : []).slice(0, 400).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var idx = int(e[0], -1, 1e6, -1), crop = C.CROP_KEYS[int(e[1], 0, 1e6, 0) - 1] || null;
      if (idx > 1e5) return;
      if (idx < 0) return;
      var t = { w: e[3] ? 1 : 0, c: crop, p: 0, r: 0 };
      if (crop) { // planted long enough ago to show the stage it was at (and it grows on from there)
        var stage = int(e[2], 0, 4, 0), grow = L.growMins(t);
        t.p = now - (stage === 4 ? grow + L.witherMins(t) + 1 : [0.1, 0.35, 0.7, 1][stage] * grow + (stage === 3 ? 1 : 0));
      }
      s.soil[idx] = t;
    });
    (Array.isArray(snap.debris) ? snap.debris : []).slice(0, 800).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var idx = int(e[0], -1, 1e5, -1), kind = C.DEBRIS_KEYS[int(e[1], -1, 1e6, -1)];
      if (idx >= 0 && kind && !s.soil[idx]) s.debris[idx] = kind;
    });
    var b = snap.builds && typeof snap.builds === 'object' ? snap.builds : {};
    ['coop2', 'barn2', 'stable', 'kitchen'].forEach(function (k) { if (b[k]) s.builds[k] = 1; });
    s.animals = [];
    (Array.isArray(snap.animals) ? snap.animals : []).forEach(function (e) {
      if (!Array.isArray(e) || C.ANIMAL_KEYS.indexOf(e[0]) < 0 || L.space(s, e[0]) <= 0) return; // (never 'constructor' and co.)
      s.animals.push({ kind: e[0], name: str(e[1], 16) || C.ANIMALS[e[0]].names[0], love: 50, fed: 1, pet: 1, ready: 0, brushed: 1, young: e[2] ? 3 : 0, preg: 0 });
    });
    var pets = snap.pets && typeof snap.pets === 'object' ? snap.pets : {};
    s.dog.name = str(pets.dog, 16) || s.dog.name;
    s.dog.pet = 1;
    s.cat = pets.cat ? { name: C.CAT.name, love: 50, pet: 1 } : null;
    s.horse = pets.horse && s.builds.stable ? { name: C.HORSE.name, love: 50, pet: 1 } : null;
    s.map = 'farm';
    s.player = { x: null, y: null, dir: 'down' };
    return s;
  };

  // ---------- weekly scores (for the leaderboards) ----------
  // Earnings and daily quests count from the start of the week (by the phone's calendar).
  L.weekScores = function (s, today) {
    var wk = L.weekOf(L.dayNum(today));
    if (s.net.wk !== wk) {
      s.net.wk = wk;
      s.net.e0 = s.stats.earned;
      s.net.q0 = L.count(s, 'dquest');
    }
    return { beauty: L.homeBeauty(s), earned: Math.max(0, s.stats.earned - s.net.e0), quests: Math.max(0, L.count(s, 'dquest') - s.net.q0) };
  };

  // ---------- who fits on a farm ----------
  // The first `max` visitors to arrive (by when they joined, then by id) may stay; the owner never counts.
  // `others` are the other players' presence states, `me` = { id, at }.
  L.visitorFits = function (others, me, host, max) {
    if (me.id === host) return true;
    var list = (others || []).filter(function (p) { return p && p.id !== host && p.id !== me.id; }).concat([me]);
    list.sort(function (a, b) { return (Number(a.at) || 0) - (Number(b.at) || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return list.indexOf(me) < max;
  };

  // A name typed by a player (a farm name, a message): one line, no control characters, trimmed.
  L.cleanText = function (v, max) {
    return typeof v === 'string' ? str(v.replace(/\s+/g, ' '), 1000).trim().slice(0, max) : '';
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.nt = [s.net.id, s.net.name, s.net.code, s.net.wk, s.net.e0, s.net.q0, s.net.named ? 1 : 0, s.net.off ? 1 : 0];
    if (s.net.pb && s.net.pb.length) o.pb = L.cleanBuys(s.net.pb);
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var n = Array.isArray(o.nt) ? o.nt : [];
    s.net = { id: str(n[0], 40), name: str(n[1], 24), code: str(n[2], 8), wk: int(n[3], 0, 1e7, 0), e0: int(n[4], 0, 1e12, 0), q0: int(n[5], 0, 1e9, 0), named: n[6] ? 1 : 0, off: n[7] ? 1 : 0, pb: L.cleanBuys(o.pb) };
    // energy up to the max a beautiful home AND yard give (the yard is only back now): a paid refill survives a reload
    s.energy = int(o.e, 0, L.maxEnergy(s), L.maxEnergy(s));
    return s;
  };
})(window.Farm = window.Farm || {});
