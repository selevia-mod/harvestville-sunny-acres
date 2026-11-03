// Skills: the rules (content in 00-zzzzzzz-skills.js, on screen in 19zz-skills.js). XP for farming, mining, fishing and
// hunting, levels 1 to 10, and the perks, which stack with the dish powers (01-logicD.js): each is worked out on top of
// what the power already gave. Saved as 'sk2': [XP of each skill in C.SKILLS.order]; friends see the levels in the
// published snapshot ('sk2': [levels]).
// (Named 01-logicZ-, not 01-logic-, so it loads after 01-logic.js and 01-logicN.js: '-' sorts before '.' and letters.)
//
// Only what you do yourself counts: farming and fishing XP is given inside L.skillAct (the world wraps the farmer's own
// tool swings, picking and reeling in it), so anything else that tills, waters or picks (a sprinkler, a farmhand) gives
// none. Nothing counts on someone else's farm (s.isVisit).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var SK = C.SKILLS;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var MOST = SK.need[SK.max];

  // the tour (19zz-skills.js): appended last, like every tip
  C.TIPS.push({ key: 'skills_tour', text: 'SKILLS' });

  // a random number in [0, 1): the tests swap it
  L.skillRnd = Math.random;
  var roll = function () { return L.skillRnd(); };

  // ---------- XP and levels ----------
  L.skillLevelOf = function (xp) {
    for (var n = SK.max; n > 1; n--) if (xp >= SK.need[n]) return n;
    return 1;
  };
  L.skillXp = function (s, key) { return (s.sk2 && s.sk2[key]) || 0; };
  L.skillLevel = function (s, key) { return L.skillLevelOf(L.skillXp(s, key)); };
  // Where a skill stands: { level, xp, from (XP at this level), to (XP for the next, or null at the top), part (0..1) }
  L.skillInfo = function (s, key) {
    var xp = L.skillXp(s, key), n = L.skillLevel(s, key), from = SK.need[n], to = n < SK.max ? SK.need[n + 1] : null;
    return { level: n, xp: xp, from: from, to: to, part: to ? (xp - from) / (to - from) : 1 };
  };
  // The perks of a skill you have at your level, and the next one to come (or null).
  L.skillPerks = function (s, key) { var n = L.skillLevel(s, key); return SK.skills[key].perks.filter(function (p) { return p.at <= n; }); };
  L.skillNextPerk = function (s, key) { var n = L.skillLevel(s, key); return SK.skills[key].perks.filter(function (p) { return p.at > n; })[0] || null; };
  // The value of one perk field at your level: a later perk with the same field replaces an earlier one.
  L.skillPerk = function (s, key, field) {
    var v = 0;
    L.skillPerks(s, key).forEach(function (p) { if (p[field] != null) v = p[field]; });
    return v;
  };

  // Level-ups waiting to be shown (the world takes them after each action): [{ key, level }]
  L.skillUps = [];
  L.takeSkillUps = function () { var u = L.skillUps; L.skillUps = []; return u; };
  // Little moments a perk made (one more crop, ore or a strong shot), for the world to show: [{ key, id }]
  L.skillPops = [];
  L.takeSkillPops = function () { var p = L.skillPops; L.skillPops = []; return p; };

  // Adds XP; returns the new level when it went up, else 0.
  L.skillAdd = function (s, key, n) {
    if (!s || s.isVisit || !SK.skills[key] || !(n > 0)) return 0;
    s.sk2 = s.sk2 || {};
    var before = L.skillLevel(s, key);
    s.sk2[key] = Math.min(MOST, L.skillXp(s, key) + Math.floor(n));
    var after = L.skillLevel(s, key);
    if (after > before) {
      L.skillUps.push({ key: key, level: after });
      return after;
    }
    return 0;
  };

  // Runs fn with s as the farmer acting: farming and fishing XP only count in here.
  var acting = null;
  L.skillAct = function (s, fn) {
    var was = acting;
    acting = s;
    try { return fn(); } finally { acting = was; }
  };
  L.skillActing = function (s) { return !!s && acting === s; };
  var mine = function (s) { return acting === s && !s.isVisit; };

  // ---------- farming ----------
  var gain = function (name, key, xpOf) {
    var orig = L[name];
    L[name] = function (s) {
      var r = orig.apply(L, arguments);
      if (s && mine(s)) { var n = xpOf(r); if (n > 0) L.skillAdd(s, 'farm', n * SK.skills.farm.xp[key]); }
      return r;
    };
  };
  gain('till', 'till', function (r) { return r === 'ok' || r === 'cleared' ? 1 : 0; });
  gain('water', 'water', function (r) { return r === 'ok' ? 1 : 0; });
  gain('plantBag', 'plant', function (r) { return typeof r === 'number' ? r : 0; });
  gain('cut', 'cut', function (r) { return typeof r === 'string' && r[0] !== '!' ? 1 : 0; });
  // picking: XP, and (Farming 7+) a chance of one more of the crop, on top of the crop power's own chance
  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var got = harvest.apply(L, arguments);
    if (typeof got !== 'string' || got[0] === '!' || !mine(s)) return got;
    L.skillAdd(s, 'farm', SK.skills.farm.xp.harvest);
    var p = L.skillPerk(s, 'farm', 'extra');
    if (p && roll() < p && L.addItem(s, got, 1) === 0) L.skillPops.push({ key: 'farm', id: got });
    return got;
  };
  var toolEnergy = L.toolEnergy;
  L.toolEnergy = function (s, tool, n) {
    var e = toolEnergy(s, tool, n), cut = tool === 'hoe' || tool === 'can' ? L.skillPerk(s, 'farm', 'tools') : 0;
    return cut ? Math.max(1, Math.round(e * (1 - cut))) : e;
  };
  var canCapacity = L.canCapacity;
  L.canCapacity = function (s) { return canCapacity(s) + L.skillPerk(s, 'farm', 'can'); };

  // ---------- mining ----------
  var mineEnergy = L.mineEnergy;
  L.mineEnergy = function (s, floor) {
    var e = mineEnergy(s, floor), cut = L.skillPerk(s, 'mine', 'rocks');
    return cut ? Math.max(1, Math.round(e * (1 - cut))) : e;
  };
  // A rock was smashed (the world calls this; drop = what it held, or null): XP, and (Mining 5+) maybe one more of its
  // ore or gem. Returns the extra item's id when there was one.
  L.skillRock = function (s, drop) {
    if (!s || s.isVisit) return null;
    var X = SK.skills.mine.xp, ore = !!drop && drop !== 'stone';
    L.skillAdd(s, 'mine', X.rock + (ore ? X.ore : 0));
    var p = ore ? L.skillPerk(s, 'mine', 'extra') : 0;
    if (p && roll() < p && L.canAdd(s, drop, 1)) {
      L.addItem(s, drop, 1);
      L.skillPops.push({ key: 'mine', id: drop });
      return drop;
    }
    return null;
  };

  // ---------- fishing ----------
  // A size made a giant more often (m times as often in all): if it is not one already, a second chance.
  L.skillGiant = function (size, giant, m, rnd) {
    if (!(m > 1) || size >= giant.size[0]) return size;
    var g = giant.odds, p = (g * m - g) / (1 - g);
    return rnd() < p ? giant.size[0] + rnd() * (giant.size[1] - giant.size[0]) : size;
  };
  var weighing = null;
  var fishSize = L.fishSize;
  L.fishSize = function (rnd) {
    var size = fishSize(rnd), s = weighing;
    return s ? L.skillGiant(size, C.FISH_SIZE.giant, L.skillPerk(s, 'fish', 'giant'), rnd) : size;
  };
  var landFish = L.landFish;
  L.landFish = function (s, id, rnd) {
    if (!mine(s)) return landFish.apply(L, arguments);
    weighing = s;
    var got;
    try { got = landFish.apply(L, arguments); } finally { weighing = null; }
    if (got === '!full' || typeof got !== 'string') return got;
    var X = SK.skills.fish.xp;
    L.skillAdd(s, 'fish', (X[got] || X.other) + (s.lastFish && s.lastFish.giant ? X.giant : 0));
    return got;
  };
  L.skillFishMiss = function (s) { return L.skillAdd(s, 'fish', SK.skills.fish.xp.miss); };
  // The reel game for this fish: a bigger bar and a slower fish with the perks ({ speed, zone } in, a copy out).
  L.skillReel = function (s, base) {
    var bar = L.skillPerk(s, 'fish', 'bar') || 1;
    return { speed: base.speed * (1 - L.skillPerk(s, 'fish', 'slow')), zone: bar > 1 ? Math.min(0.9, base.zone * bar) : base.zone };
  };

  // ---------- hunting ----------
  var hunted = L.hunted;
  L.hunted = function (s, area, slot, kind, size) {
    var r = hunted.apply(L, arguments), def = C.WILD.animals[kind], X = SK.skills.hunt.xp;
    if (def) L.skillAdd(s, 'hunt', Math.min(X.most, def.hp * X.hp) + (def.rare || def.great ? X.rare : L.wildGiant(size || 1) ? X.giant : 0));
    return r;
  };
  // (Hunting 3+) now and then the arrow is not used up
  var shoot = L.shoot;
  L.shoot = function (s) {
    var r = shoot.apply(L, arguments), p = r === 'ok' && !s.isVisit ? L.skillPerk(s, 'hunt', 'save') : 0;
    if (p && roll() < p) L.addItem(s, 'arrows', 1);
    return r;
  };
  // (Hunting 5+) a strong shot hits once more: the world rolls it for each of your arrows that hits (s.skHit, never saved)
  L.skillStrong = function (s) { var p = s.isVisit ? 0 : L.skillPerk(s, 'hunt', 'strong'); return !!p && roll() < p; };
  var bowDamage = L.bowDamage;
  L.bowDamage = function (s) { return bowDamage(s) + (s.skHit || 0); };

  // ---------- save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.sk2 = {};
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (SK.order.some(function (k) { return L.skillXp(s, k); })) o.sk2 = SK.order.map(function (k) { return L.skillXp(s, k); });
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.sk2 = {};
    if (Array.isArray(o.sk2)) SK.order.forEach(function (k, i) { var n = int(o.sk2[i], 0, MOST, 0); if (n) s.sk2[k] = n; });
    s.water = int(o.w, 0, L.canCapacity(s), L.canCapacity(s)); // (the bigger can: its water was cut to the plain can's)
    return s;
  };

  // ---------- friends see your levels ----------
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var o = snapshot(s), lv = SK.order.map(function (k) { return L.skillLevel(s, k); });
    if (lv.some(function (n) { return n > 1; })) o.sk2 = lv;
    return o;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, me) {
    var s = visitState(snap, me), lv = snap && Array.isArray(snap.sk2) ? snap.sk2 : null; // (`snap` is untrusted)
    s.sk2 = {};
    if (lv) SK.order.forEach(function (k, i) { var n = int(lv[i], 1, SK.max, 1); if (n > 1) s.sk2[k] = SK.need[n]; });
    return s;
  };
})(window.Farm = window.Farm || {});
