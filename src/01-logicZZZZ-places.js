// Hunting places, the rules (owner, 6 Nov 2026; data 00-zzzzzzzzz-places.js and each place's own file; the world and
// the pages 19zzzzz-places.js). What a place remembers (s.places[id]): hunts there, its hidden chests, how far its story
// went, the tame's hearts, the guard and the boss, the daily boss chest, the deepest cave floor. Also the four gear
// slots and what they take off a charge, taming and the companion out with you, the medals, "% explored", and the
// save: 'pl' (places by id), 'md' (medals: code, day, ...), 'gw' (worn: head, body, feet, charm), 'go' (pieces made),
// 'cp' (the companion out), 'pk' (hunts and the biggest of each place creature, by name), 'pg' (a place's hunted slots
// waiting), 'pm' (the place map you are on). Every key is new: an older save loads as before.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var dev = function () { return !!(F.devPlaces || (typeof window !== 'undefined' && window.gameHost && window.gameHost.devPlaces)); };

  C.TIPS.push({ key: 'jeep_tour', text: "KANOR'S JEEP" }, { key: 'gear_slots_tour', text: 'GEAR' }, { key: 'tame_tour', text: 'TAMING' }, { key: 'medals_tour', text: 'MEDALS' });

  // ---------- places and their maps ----------
  // The place a map belongs to: its own map, or its dungeon (the Lair is Magayon's). null elsewhere.
  L.placeOf = function (map) { return C.PLACES[map] ? map : C.DUNGEONS[map] || null; };
  L.isPlaceDungeon = function (map) { return !!C.DUNGEONS[map] && map !== 'lair'; }; // (a new place's cave, not the Lair)
  L.isNewPlaceMap = function (map) { var id = L.placeOf(map); return !!id && !C.PLACES[id].legacy; };
  L.placeShown = function (id) { var p = C.PLACES[id]; return !!p && (!p.dev || dev()); };
  var rec = function (s, id) {
    s.places = s.places || {};
    return s.places[id] || (s.places[id] = { n: 0, ch: 0, st: 0, t: 0, tm: 0, ta: 0, g: 0, b: 0, dl: -1, bc: 0, deep: 0 });
  };
  L.placeRec = rec;
  var peek = function (s, id) { return (s.places && s.places[id]) || { n: 0, ch: 0, st: 0, t: 0, tm: 0, ta: 0, g: 0, b: 0, dl: -1, bc: 0, deep: 0 }; };
  L.placeOpen = function (s, id) { return L.wildOpen(s, id); };

  // the tame animal roams its place as one more slot, until it is tamed (and not while it ran off)
  var wildSlots = L.wildSlots;
  L.wildSlots = function (area) {
    var out = wildSlots(area), p = C.PLACES[area];
    if (p && p.tame && !p.legacy) out.push({ slot: out.length, kind: p.tame.kind, tame: true });
    return out;
  };
  var wildHere = L.wildHere;
  L.wildHere = function (s, area) {
    var p = C.PLACES[area];
    return wildHere(s, area).filter(function (e) { return !(e.tame && (L.tamed(s, p.id) || L.tameAway(s, p.id))); });
  };

  // How many hunts in a place (a place from before: the hunts of its animals).
  L.placeHunts = function (s, id) {
    var p = C.PLACES[id];
    if (!p) return 0;
    if (!p.legacy) return peek(s, id).n;
    return p.kinds.reduce(function (n, k) { return n + (s.wild.by[k] || 0); }, 0);
  };

  // ---------- a place's cave (a new place's: the Lair keeps its own, 01-logicN.js) ----------
  L.dunOf = function (key) { var id = C.DUNGEONS[key]; return id && key !== 'lair' ? C.PLACES[id].dungeon : null; };
  var seedOf = function (key) { var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return h; };
  // A floor's creatures, in a fixed order: [{ slot, kind }]. The guard leads its floor, the boss its own.
  L.dunRoster = function (key, floor) {
    var d = L.dunOf(key), out = [];
    if (!d) return out;
    floor = int(floor, 1, d.floors, 1);
    var add = function (kind) { out.push({ slot: out.length, kind: kind }); };
    var n = Math.min(d.count.max, d.count.base + Math.floor(floor / d.count.per));
    if (floor === d.bossFloor && d.boss) { add(d.boss); n = d.escort != null ? d.escort : 2; } else if (floor === d.guardFloor && d.guard) { add(d.guard); n = d.escort != null ? d.escort : 2; }
    var pool = (d.floorKinds || []).filter(function (k) { return floor >= k[1] && floor <= k[2]; }).map(function (k) { return k[0]; });
    if (!pool.length) pool = Object.keys(d.creatures || {}).filter(function (k) { return k !== d.guard && k !== d.boss; });
    for (var i = 0; i < n && pool.length; i++) add(pool[Math.floor(L.rand(seedOf(key), floor, i) * pool.length)]);
    return out;
  };
  // How tough one is: a boss is soloable, and takes hpEach more for each friend with you (like the Bakunawa).
  L.dunHp = function (kind, crew) {
    var def = WI.animals[kind];
    return def.hp + (def.boss && def.hpEach ? def.hpEach * Math.max(0, (crew || 1) - 1) : 0);
  };
  L.dunReach = function (s, key, floor) {
    var d = L.dunOf(key), r = rec(s, C.DUNGEONS[key]);
    floor = int(floor, 1, d ? d.floors : 1, 1);
    if (floor <= r.deep) return false;
    r.deep = floor;
    return true;
  };
  L.dunStops = function (s, key) {
    var d = L.dunOf(key), deep = Math.max(1, peek(s, C.DUNGEONS[key]).deep || 1), out = [];
    for (var f = 1; f <= deep; f += d.liftEvery) out.push(f);
    return out;
  };

  // ---------- the boss's chest: once a day, missed days add up to 3 ----------
  // How many chests a boss hunted today would add (0 when today's is had).
  L.bossChestDue = function (s, id) {
    var r = peek(s, id);
    if (r.dl === s.day) return 0;
    return r.dl < 0 ? 1 : Math.min(C.BOSS_CHEST.max, s.day - r.dl);
  };
  L.bossDown = function (s, id) {
    var r = rec(s, id), add = L.bossChestDue(s, id), was = r.bc;
    r.b += 1;
    if (add) { r.bc = Math.min(C.BOSS_CHEST.max, r.bc + add); r.dl = s.day; }
    return r.bc - was;
  };
  L.bossChests = function (s, id) { return peek(s, id).bc; };
  // What a table gives: [[item, n]] (rnd: 0..1)
  var roll = function (table, rnd) {
    var out = [];
    (table || []).forEach(function (t) { if (t[2] >= 1 || rnd() < t[2]) out.push([t[0], t[1]]); });
    return out;
  };
  var merge = function (list) {
    var by = {}, out = [];
    list.forEach(function (x) { if (by[x[0]] == null) { by[x[0]] = out.length; out.push([x[0], 0]); } out[by[x[0]]][1] += x[1]; });
    return out;
  };
  // Opens every waiting chest: what they hold, all together (empty when none wait).
  L.openBossChests = function (s, id, rnd) {
    var r = rec(s, id), d = C.PLACES[id].dungeon, out = [];
    for (var i = 0; i < r.bc; i++) out = out.concat(roll(d.chest, rnd || Math.random));
    r.bc = 0;
    return merge(out);
  };

  // ---------- hidden chests ----------
  L.placeChestOpened = function (s, id, i) { return !!((peek(s, id).ch >> i) & 1); };
  L.placeChestsOpened = function (s, id) { var n = 0, ch = peek(s, id).ch; while (ch) { n += ch & 1; ch >>= 1; } return n; };
  // Opens the i-th hidden chest: what it holds, or null (opened already, or no such chest)
  L.openPlaceChest = function (s, id, i, rnd) {
    var p = C.PLACES[id];
    if (!p || !p.chests[i] || L.placeChestOpened(s, id, i)) return null;
    rec(s, id).ch |= 1 << i;
    return roll(p.chestLoot, rnd || Math.random);
  };
  // Into the bag; what does not fit waits in the basket at home. Returns how many went to the basket.
  L.giveLoot = function (s, loot) {
    var left = 0;
    loot.forEach(function (x) {
      var n = L.addItem(s, x[0], x[1]);
      if (L.discover) L.discover(s, x[0]);
      if (n) { s.basket[x[0]] = Math.min(999, (s.basket[x[0]] || 0) + n); left += n; }
    });
    return left;
  };

  // ---------- the person in each place, and their story ----------
  var unlocked = function (s, id, need) {
    if (!need) return true;
    var r = peek(s, id);
    if (need.hunts && r.n < need.hunts) return false;
    if (need.tame && !r.tm) return false;
    if (need.guard && !r.g) return false;
    if (need.boss && !r.b) return false;
    if (need.chests && L.placeChestsOpened(s, id) < need.chests) return false;
    if (need.floor && r.deep < need.floor) return false;
    return true;
  };
  // the furthest line open (the lines unlock one after another)
  L.npcStep = function (s, id) {
    var lines = C.PLACES[id].npc.lines, i = 0;
    while (i + 1 < lines.length && unlocked(s, id, lines[i + 1].need)) i++;
    return i;
  };
  // Talking: their newest line (and it is read). { i, text, isNew, last } (+ gift, left: what a line gave)
  // A line's small reward (owner, 6 Nov 2026: "small rewards"): line.gift = [[item, n]], given once, for every line
  // opened since you last talked (so one skipped by doing two things at once still gives its gift).
  L.talkNpc = function (s, id) {
    var p = C.PLACES[id], i = L.npcStep(s, id), r = rec(s, id), isNew = i >= r.st, gift = [];
    for (var k = r.st; k <= i; k++) gift = gift.concat(p.npc.lines[k].gift || []);
    r.st = Math.max(r.st, i + 1);
    var out = { i: i, text: p.npc.lines[i].text, isNew: isNew, last: i === p.npc.lines.length - 1 };
    if (gift.length) { out.gift = merge(gift); out.left = L.giveLoot(s, out.gift); }
    return out;
  };

  // ---------- taming ----------
  L.tamed = function (s, id) { return !!peek(s, id).tm; };
  L.tameAway = function (s, id) { return peek(s, id).ta > L.nowMin(); };
  L.tameHearts = function (s, id) { return peek(s, id).t; };
  // Can it be fed now: calm (not charging or running), close, and you hold its food? (mode: the animal's)
  L.canFeed = function (s, id, mode, tiles) {
    var t = C.PLACES[id].tame, held = L.held(s);
    return mode !== 'flee' && mode !== 'charge' && tiles <= t.near && !!held && held.id === t.food && !L.tamed(s, id) && !L.tameAway(s, id);
  };
  // One feeding: 'fed' | 'ran' (it ran off; back in tame.back minutes) | 'tame' (tamed!) | 'food' (none) | 'away' | 'tamed'
  L.feedTame = function (s, id, rnd) {
    var t = C.PLACES[id].tame, r = rec(s, id);
    if (r.tm) return 'tamed';
    if (L.tameAway(s, id)) return 'away';
    if (L.countItem(s, t.food) < 1) return 'food';
    L.removeItem(s, t.food, 1);
    r.t += 1;
    if (r.t >= t.feedings) {
      r.tm = 1;
      if (!s.comp) s.comp = id; // (the first one comes along at once)
      return 'tame';
    }
    if ((rnd || Math.random)() < t.runOff) { r.ta = L.nowMin() + t.back; return 'ran'; }
    return 'fed';
  };
  L.companions = function (s) { return C.PLACE_ORDER.filter(function (id) { return C.PLACES[id].tame && L.tamed(s, id); }); };
  L.companion = function (s) { return s.comp && C.PLACES[s.comp] && L.tamed(s, s.comp) ? s.comp : null; };
  // One out at a time ('' or null: all at the Lodge). 'ok' | 'no'
  L.setCompanion = function (s, id) {
    if (id && !(C.PLACES[id] && L.tamed(s, id))) return 'no';
    s.comp = id || '';
    return 'ok';
  };
  L.companionSkill = function (s) { var id = L.companion(s); return id ? C.PLACES[id].tame.skill : null; };

  // ---------- gear: four slots ----------
  // A piece: a place's (id '<place>_<slot>') or Hunter's gear from before ('g:cloak'); null when unknown.
  L.gearPiece = function (id) {
    if (C.PLACE_GEAR[id]) return C.PLACE_GEAR[id];
    var m = /^g:(.+)$/.exec(id || ''), i = m ? L.gearIndex(m[1]) : -1, g = i >= 0 ? C.GEAR[i] : null;
    return g && C.GEAR_SLOT_OF[g.key] ? { id: id, old: g.key, slot: C.GEAR_SLOT_OF[g.key], name: g.name, icon: g.icon, less: 0, desc: g.short || g.desc } : null;
  };
  L.ownsPiece = function (s, id) {
    var g = L.gearPiece(id);
    if (!g) return false;
    return g.old ? L.hasGear(s, g.old) : (s.gown || []).indexOf(id) >= 0;
  };
  L.worn = function (s, slot) { var id = s.gwear && s.gwear[slot]; return id && L.ownsPiece(s, id) ? id : ''; };
  // what you could wear in a slot: every piece you have for it
  L.piecesFor = function (s, slot) {
    var out = [];
    C.GEAR.forEach(function (g) { if (C.GEAR_SLOT_OF[g.key] === slot && L.hasGear(s, g.key)) out.push('g:' + g.key); });
    (s.gown || []).forEach(function (id) { if (C.PLACE_GEAR[id] && C.PLACE_GEAR[id].slot === slot) out.push(id); });
    return out;
  };
  // 'ok' | 'none' (not yours)
  L.wear = function (s, id) {
    var g = L.gearPiece(id);
    if (!g || !L.ownsPiece(s, id)) return 'none';
    s.gwear = s.gwear || {};
    s.gwear[g.slot] = id;
    return 'ok';
  };
  L.takeOff = function (s, slot) { if (s.gwear) s.gwear[slot] = ''; };
  // Is a piece of Hunter's gear from before on? (a state with no slots yet, a friend's: always on, as before)
  L.wearsOld = function (s, key) {
    if (!L.hasGear(s, key)) return false;
    var slot = C.GEAR_SLOT_OF[key];
    return !slot || !s.gwear || s.gwear[slot] === 'g:' + key;
  };
  var wearIfFree = function (s, id) { var g = L.gearPiece(id); if (g && s.gwear && !L.worn(s, g.slot)) s.gwear[g.slot] = id; };
  var buyGear = L.buyGear;
  L.buyGear = function (s, key) {
    var r = buyGear(s, key);
    if (r === 'ok') wearIfFree(s, 'g:' + key); // (on at once, in its slot, if it is free: as it always was)
    return r;
  };
  // What Hunter's gear from before shows (friends see it too): only what is worn, and the Big Quiver
  var gearBits = L.gearBits;
  L.gearBits = function (s) {
    var b = gearBits(s);
    C.GEAR.forEach(function (g, i) { if (((b >> i) & 1) && !L.wearsOld(s, g.key)) b &= ~(1 << i); });
    return b;
  };
  // Kanor makes a set piece: 'ok' | 'owned' | 'gold' | 'short' | 'none'
  L.makeGear = function (s, id) {
    var g = C.PLACE_GEAR[id];
    if (!g) return 'none';
    if (L.ownsPiece(s, id)) return 'owned';
    if (s.gold < g.gold) return 'gold';
    if (!L.hasNeeds(s, g.needs)) return 'short';
    s.gold -= g.gold;
    L.takeNeeds(s, g.needs);
    s.gown = (s.gown || []).concat([id]);
    wearIfFree(s, id);
    return 'ok';
  };
  // The set worn whole (all four slots from one place), or null.
  L.wornSet = function (s) {
    var place = null;
    for (var i = 0; i < C.GEAR_SLOTS.length; i++) {
      var g = C.PLACE_GEAR[L.worn(s, C.GEAR_SLOTS[i])];
      if (!g || (place && g.place !== place)) return null;
      place = g.place;
    }
    return place;
  };
  // How much the worn pieces take off a hit from this kind (1 for head and feet, 2 for body and charm, 2 more for a whole
  // set against its own place's creatures).
  L.gearLess = function (s, kind) {
    var less = 0, def = kind && WI.animals[kind];
    C.GEAR_SLOTS.forEach(function (slot) { var g = C.PLACE_GEAR[L.worn(s, slot)]; if (g) less += g.less; });
    var set = L.wornSet(s);
    if (set && def && def.place === set) less += C.GEAR_SET_BONUS;
    return less;
  };
  // The energy a charge costs you (hit: the animal's; kind: who charged). A dish's power halves it, the Fire Charm (worn)
  // takes 40% off, then the gear its 1s and 2s. Never less than 1.
  L.chargeLoss = function (s, hit, kind) {
    if (!(hit > 0)) return 0;
    var lost = Math.ceil(hit / (L.power(s, 'charge') ? 2 : 1));
    if (L.wearsOld(s, 'charm')) lost = Math.ceil(lost * C.GEAR_RULES.charm);
    return Math.max(C.GEAR_MIN_HIT, lost - L.gearLess(s, kind));
  };

  // ---------- medals ----------
  var giantAt = function (kind) { return Math.floor(WI.animals[kind].kg * 10 * 1.2); }; // (tenths of a kg: an ordinary one is at most 1.1x, a giant 1.25x)
  L.medalEarned = function (s, m) {
    var p = C.PLACES[m.place], r = peek(s, m.place), by = s.wild.by, best = s.wild.best;
    switch (m.kind) {
      case 'first': return L.placeHunts(s, m.place) > 0;
      case 'guard': return p.legacy ? (by[p.dungeon.guard] || 0) > 0 : !!r.g;
      case 'boss': return p.legacy ? (by[p.dungeon.boss] || 0) > 0 : r.b > 0;
      case 'tame': return !!r.tm;
      case 'chests': return L.placeChestsOpened(s, m.place) >= p.chests.length;
      case 'story': return r.st >= p.npc.lines.length;
      case 'hunt': return (by[m.animal] || 0) > 0;
      case 'giant': return (best[m.animal] || 0) >= giantAt(m.animal);
    }
    return false;
  };
  L.hasMedal = function (s, code) { return !!(s.medals && s.medals[code]); };
  // Gives every medal now earned (today's date): the new ones.
  L.medalCheck = function (s) {
    s.medals = s.medals || {};
    return C.MEDALS.filter(function (m) {
      if (s.medals[m.code] || !L.medalEarned(s, m)) return false;
      s.medals[m.code] = s.day;
      return true;
    });
  };
  // The medals a page shows (a place still in the making only for the tests)
  L.medalList = function () { return C.MEDALS.filter(function (m) { return L.placeShown(m.place); }); };
  L.medalCount = function (s) { return L.medalList().filter(function (m) { return L.hasMedal(s, m.code); }).length; };

  // ---------- "% explored": animals met, chests, the story, the guard, the boss ----------
  L.placeExplored = function (s, id) {
    var p = C.PLACES[id], r = peek(s, id), by = s.wild.by;
    var parts = {
      animals: [p.kinds.filter(function (k) { return (by[k] || 0) > 0; }).length + (p.tame && r.tm ? 1 : 0), p.kinds.length + (p.tame ? 1 : 0)],
      chests: [L.placeChestsOpened(s, id), p.chests ? p.chests.length : 0],
      story: [p.npc ? Math.min(r.st, p.npc.lines.length) : 0, p.npc ? p.npc.lines.length : 0],
      guard: [0, p.dungeon && p.dungeon.guard ? 1 : 0],
      boss: [0, p.dungeon && p.dungeon.boss ? 1 : 0],
    };
    if (parts.guard[1]) parts.guard[0] = (p.legacy ? (by[p.dungeon.guard] || 0) > 0 : !!r.g) ? 1 : 0;
    if (parts.boss[1]) parts.boss[0] = (p.legacy ? (by[p.dungeon.boss] || 0) > 0 : r.b > 0) ? 1 : 0;
    var got = 0, all = 0;
    Object.keys(parts).forEach(function (k) { got += parts[k][0]; all += parts[k][1]; });
    return { pct: all ? Math.floor(got * 100 / all) : 0, parts: parts };
  };

  // ---------- the Jeep's list: every place, by when it opens ----------
  L.jeepPlaces = function (s) {
    return C.PLACE_ORDER.filter(L.placeShown).map(function (id) {
      var p = C.PLACES[id];
      return { id: id, name: p.name, unlock: p.unlock, open: L.wildOpen(s, id), pct: L.placeExplored(s, id).pct, n: p.n };
    }).sort(function (a, b) { return a.unlock - b.unlock || a.n - b.n; });
  };

  // ---------- hunts ----------
  // A hunt in a place counts for it; in its cave, the guard and the boss are remembered (the boss: its chest), and no
  // slot waits (the floor is the floor). Medals come with it: r.medals (new ones), r.chests (boss chests added).
  var hunted = L.hunted;
  L.hunted = function (s, area, slot, kind, size) {
    var r = hunted(s, area, slot, kind, size), a = WI.areas[area], id = a && a.place;
    if (id) {
      var pr = rec(s, id), d = C.PLACES[id].dungeon;
      pr.n += 1;
      if (a.dungeon) {
        delete s.wild.gone[area + ':' + slot];
        if (d && kind === d.guard) pr.g = 1;
        if (d && kind === d.boss) r.chests = L.bossDown(s, id);
      }
    }
    r.medals = L.medalCheck(s);
    return r;
  };

  // ---------- with friends: a place creature on the live channel (C.WILD.more: 1000 and up) ----------
  var wildPack = L.wildPack;
  L.wildPack = function (a) {
    var r = wildPack(a);
    if (r[1] < 0 && WI.more.indexOf(a.kind) >= 0) r[1] = 1000 + WI.more.indexOf(a.kind);
    return r;
  };
  var wildUnpack = L.wildUnpack;
  L.wildUnpack = function (r) {
    if (!Array.isArray(r) || !(Number(r[1]) >= 1000)) return wildUnpack(r);
    var kind = WI.more[Number(r[1]) - 1000];
    if (!kind) return null;
    var q = r.slice();
    q[1] = 0; // (the checks of any animal from before; its own numbers below)
    var o = wildUnpack(q);
    if (!o) return null;
    var def = WI.animals[kind], top = def.hp + (def.hpEach || 0) * 8;
    o.kind = kind;
    o.hp = Math.max(0, Math.min(top, Number(r[7])));
    o.max = Math.max(1, Math.min(top, Number(r[10]) || def.hp));
    return o;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.places = {};
    s.medals = {};
    s.gown = [];
    s.gwear = { head: '', body: '', feet: '', charm: '' };
    s.comp = '';
    return s;
  };
  var REC = ['n', 'ch', 'st', 't', 'tm', 'ta', 'g', 'b', 'dl', 'bc', 'deep'];
  var PULAG_M = null;
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    var own = (s.hg || 0) & ((1 << C.GEAR.length) - 1);
    if (own) o.hg = own; // (what you have, worn or not: L.gearBits is only what is worn now)
    var pl = {};
    Object.keys(s.places || {}).forEach(function (id) {
      var r = s.places[id];
      if (C.PLACES[id] && REC.some(function (k) { return k === 'dl' ? r.dl >= 0 : r[k]; })) pl[id] = REC.map(function (k) { return r[k]; });
    });
    if (Object.keys(pl).length) o.pl = pl;
    var md = [];
    Object.keys(s.medals || {}).forEach(function (code) { if (C.MEDAL_BY_CODE[code]) md.push(+code, s.medals[code]); });
    if (md.length) o.md = md;
    if (s.gwear && C.GEAR_SLOTS.some(function (k) { return s.gwear[k]; })) o.gw = C.GEAR_SLOTS.map(function (k) { return s.gwear[k] || ''; });
    else if (s.gwear) o.gw = 0; // (all off, on purpose: not an old save to dress)
    if (s.gown && s.gown.length) o.go = s.gown.slice();
    if (s.comp) o.cp = s.comp;
    // place creatures by name, and a place's hunted slots by its name (not by their place in a list)
    var pk = {};
    WI.more.forEach(function (k) { if (s.wild.by[k] || s.wild.best[k]) pk[k] = [s.wild.by[k] || 0, s.wild.best[k] || 0]; });
    if (Object.keys(pk).length) o.pk = pk;
    if (Array.isArray(o.wl) && Array.isArray(o.wl[3])) o.wl[3] = o.wl[3].filter(function (g) { return g[0] < C.PLACE_BASE.areas; });
    var pg = [], now = L.nowMin();
    Object.keys(s.wild.gone).forEach(function (k) {
      var p = k.split(':'), a = WI.areas[p[0]];
      if (a && a.place && !C.PLACES[a.place].legacy && now - s.wild.gone[k] < 4320) pg.push([p[0], +p[1], s.wild.gone[k]]);
    });
    if (pg.length) o.pg = pg;
    // on a new place's map: saved as Pulag (the save's list of maps has no places), with its name; in its cave, at the
    // cave's door (floors are not saved, as in the mine and the Lair)
    if (L.isNewPlaceMap(s.map)) {
      if (PULAG_M == null) PULAG_M = serialize(Object.assign({}, s, { map: 'pulag' })).m;
      o.m = PULAG_M;
      o.pm = L.placeOf(s.map);
      if (L.isPlaceDungeon(s.map)) { o.pd = 1; delete o.p; }
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.places = {};
    var pl = o.pl && typeof o.pl === 'object' && !Array.isArray(o.pl) ? o.pl : {};
    Object.keys(pl).forEach(function (id) {
      if (!C.PLACES[id] || !Array.isArray(pl[id])) return;
      var a = pl[id], r = rec(s, id), p = C.PLACES[id], d = p.dungeon;
      r.n = int(a[0], 0, 1e7, 0);
      r.ch = int(a[1], 0, (1 << Math.min(30, p.chests.length)) - 1, 0);
      r.st = int(a[2], 0, p.npc ? p.npc.lines.length : 0, 0);
      r.t = int(a[3], 0, p.tame ? p.tame.feedings : 0, 0);
      r.tm = p.tame && a[4] ? 1 : 0;
      r.ta = int(a[5], 0, 1e10, 0);
      r.g = a[6] ? 1 : 0;
      r.b = int(a[7], 0, 1e7, 0);
      r.dl = int(a[8], -1, 1e7, -1);
      r.bc = int(a[9], 0, C.BOSS_CHEST.max, 0);
      r.deep = int(a[10], 0, d && !d.lair ? d.floors : 0, 0);
    });
    s.medals = {};
    var md = Array.isArray(o.md) ? o.md : [];
    for (var i = 0; i + 1 < md.length && i < 4000; i += 2) if (C.MEDAL_BY_CODE[md[i]]) s.medals[md[i]] = int(md[i + 1], 0, 1e7, s.day);
    s.gown = (Array.isArray(o.go) ? o.go : []).filter(function (id, k, all) { return C.PLACE_GEAR[id] && all.indexOf(id) === k; });
    s.gwear = { head: '', body: '', feet: '', charm: '' };
    if (Array.isArray(o.gw)) C.GEAR_SLOTS.forEach(function (k, j) { var id = String(o.gw[j] || ''); var g = L.gearPiece(id); if (g && g.slot === k && L.ownsPiece(s, id)) s.gwear[k] = id; });
    else if (o.gw !== 0) C.GEAR.forEach(function (g) { if (L.hasGear(s, g.key)) wearIfFree(s, 'g:' + g.key); }); // an old save: what you had stays on
    s.comp = typeof o.cp === 'string' && C.PLACES[o.cp] && L.tamed(s, o.cp) ? o.cp : '';
    var pk = o.pk && typeof o.pk === 'object' && !Array.isArray(o.pk) ? o.pk : {};
    WI.more.forEach(function (k) {
      if (!Array.isArray(pk[k])) return;
      s.wild.by[k] = int(pk[k][0], 0, 1e7, 0);
      s.wild.best[k] = int(pk[k][1], 0, 1e6, 0);
    });
    var now = L.nowMin();
    (Array.isArray(o.pg) ? o.pg : []).slice(0, 50).forEach(function (g) {
      if (!Array.isArray(g) || typeof g[0] !== 'string' || !WI.areas[g[0]] || !WI.areas[g[0]].place) return;
      s.wild.gone[g[0] + ':' + int(g[1], 0, 99, 0)] = Math.min(now, int(g[2], 0, 1e10, 0));
    });
    if (typeof o.pm === 'string' && s.map === 'pulag') {
      if (C.PLACES[o.pm] && !C.PLACES[o.pm].legacy) {
        s.map = o.pm;
        if (o.pd) s.player = { x: null, y: null, dir: 'down', spawn: 'from_dungeon' };
      } else s.player = { x: null, y: null, dir: 'down', spawn: 'from_jeep' }; // (a place this game no longer has: by the jeep)
    }
    L.medalCheck(s); // (what was earned before medals came)
    return s;
  };

  // ---------- friends see your medals, and your place creatures in the Hunter's Book ----------
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var o = snapshot(s), md = [], hp = {};
    Object.keys(s.medals || {}).forEach(function (code) { if (C.MEDAL_BY_CODE[code]) md.push(+code, s.medals[code]); });
    if (md.length) o.md = md;
    WI.more.forEach(function (k) { if (s.wild.by[k]) hp[k] = [s.wild.by[k], s.wild.best[k] || 0]; });
    if (Object.keys(hp).length) o.hp = hp;
    return o;
  };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine), md = snap && Array.isArray(snap.md) ? snap.md : [], hp = snap && snap.hp && typeof snap.hp === 'object' ? snap.hp : {}; // (`snap` is untrusted)
    s.medals = {};
    for (var i = 0; i + 1 < md.length && i < 4000; i += 2) if (C.MEDAL_BY_CODE[md[i]]) s.medals[md[i]] = int(md[i + 1], 0, 1e7, 0);
    WI.more.forEach(function (k) {
      if (!Array.isArray(hp[k])) return;
      s.wild.by[k] = int(hp[k][0], 0, 1e7, 0);
      s.wild.best[k] = int(hp[k][1], 0, 1e6, 0);
    });
    return s;
  };
})(window.Farm = window.Farm || {});
