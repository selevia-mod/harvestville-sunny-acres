// Hunting places (owner, 6 Nov 2026): ten new places past Pulag, each with its own dungeon, reached by Kanor's Jeep at
// his Lodge. This file is the shared engine's data side: the registry (F.addPlace), the gear slots, taming, the medals
// and the jeep. Each place is mostly data in its own file, 00-zzzzzzzzzz-place-<nn>-<id>.js (loaded after this one),
// plus a map; how to add one is in docs/hunting-places-engine.md. Rules 01-logicZZZ-places.js; the world and the pages
// 19zzzzz-places.js; the dungeons are the Lair's own code (19zt-lair.js), run with each place's data.
// No Coins buy any of it: everything here comes from playing (owner, 6 Nov 2026).
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;

  // What there was before the places. A place's creatures are NOT appended to C.WILD.order (that list is saved by index
  // in 'wl', and the places may ship in any order): they go in C.WILD.more and are saved by name ('pk', 01-logicZZZ-places.js).
  C.PLACE_BASE = { kinds: WI.order.length, areas: Object.keys(WI.areas).length };
  WI.more = [];

  C.PLACES = {}; // id -> the place (below, F.addPlace)
  C.PLACE_ORDER = []; // ids, as registered (the jeep sorts them by unlock)
  C.DUNGEONS = {}; // a dungeon's map key -> its place id

  // ---------- gear: four slots (owner, 6 Nov 2026) ----------
  // "gear is good so when are wearing it, they attack from monster will take less 1 or 2 energy": each place has a set
  // of four pieces Kanor makes from its drops and Gold. Head and Feet take 1 off each hit, Body and Charm 2; all four of
  // one set take 2 more off for that place's own creatures. A hit never costs less than 1.
  C.GEAR_SLOTS = ['head', 'body', 'feet', 'charm'];
  C.GEAR_SLOT_NAMES = { head: 'Head', body: 'Body', feet: 'Feet', charm: 'Charm' };
  C.GEAR_LESS = { head: 1, body: 2, feet: 1, charm: 2 };
  C.GEAR_SET_BONUS = 2;
  C.GEAR_MIN_HIT = 1;
  // The Hunter's gear from before keeps its own effects and is worn in a slot now (the Big Quiver stays as it is).
  C.GEAR_SLOT_OF = { cloak: 'body', boots: 'feet', charm: 'charm' };
  C.PLACE_GEAR = {}; // piece id (<place>_<slot>) -> { id, place, slot, name, icon, needs, gold, less }

  // ---------- taming (owner, 6 Nov 2026: "a little bit hard but not too hard") ----------
  // Feed the place's tamable animal its favourite food while it is calm, close (within `near` tiles) with the food in
  // your hands. Each feeding fills its heart meter; after each it may run off (runOff), and comes back `back` minutes
  // later; `feedings` feedings tame it. A place's own tame data can change any of these.
  C.TAME = { feedings: 8, runOff: 0.2, back: 20, near: 1.5 };
  // A companion's one small skill (the place's tame.skill). One out at a time; the others wait at Kanor's Lodge.
  C.COMPANION_SKILLS = {
    fetch: { name: 'Fetcher', text: 'Picks up what a hunt leaves on the ground near you.', reach: 3, every: 1500 },
    spot: { name: 'Spotter', text: 'Spots a rare animal: it says so, and points the way.' },
    arrows: { name: 'Arrow finder', text: 'Now and then finds a lost arrow for you.', every: 90000, chance: 0.5 },
  };
  C.COMPANION = { behind: 1.3, run: 2.8 }; // tiles behind you; further than `run`, it runs to catch up

  // ---------- the dungeon's daily chest (owner, 6 Nov 2026) ----------
  // The boss of a place's dungeon gives a chest once a day for each hunter; missed days add up, to 3 waiting chests.
  C.BOSS_CHEST = { max: 3 };

  // ---------- medals (owner, 6 Nov 2026: "like pokedex but more modern ... I defeat the boss") ----------
  // Each place's medals are made from its data (F.addPlace): first hunt there, each of its animals, a giant of each, the
  // guard, the boss, the tame, every hidden chest, its story. A medal's code is the place's n x 100 + its own number, so
  // codes never move when places come in any order (saved as codes, 'md'). icon: a frame of the items sheet.
  C.MEDALS = [];
  C.MEDAL_BY_CODE = {};
  var addMedal = function (m) {
    if (C.MEDAL_BY_CODE[m.code]) throw new Error('medal code ' + m.code + ' is taken (' + C.MEDAL_BY_CODE[m.code].id + ')');
    C.MEDALS.push(m);
    C.MEDAL_BY_CODE[m.code] = m;
  };
  // the medals of a place, from its data (codes: first 0, guard 1, boss 2, tame 3, chests 4, story 5, then 10 + 2i and
  // 11 + 2i for the hunt and the giant of its i-th animal)
  var makeMedals = function (p) {
    var base = p.n * 100, frame = function (x) { return C.ITEMS[x] ? C.ITEMS[x].icon : C.ICON[x] != null ? C.ICON[x] : C.ICON.star; };
    var icon = function (kind) { var d = WI.animals[kind]; return frame(d && d.drops && d.drops[0] ? d.drops[0][0] : 'bow'); };
    addMedal({ code: base, id: p.id + ':first', place: p.id, kind: 'first', title: 'First hunt in ' + p.name, icon: frame('bow') });
    if (p.dungeon && p.dungeon.guard) addMedal({ code: base + 1, id: p.id + ':guard', place: p.id, kind: 'guard', title: WI.animals[p.dungeon.guard].name + ' defeated', icon: icon(p.dungeon.guard) });
    if (p.dungeon && p.dungeon.boss) addMedal({ code: base + 2, id: p.id + ':boss', place: p.id, kind: 'boss', title: WI.animals[p.dungeon.boss].name + ' defeated', icon: icon(p.dungeon.boss), big: true });
    if (p.tame) addMedal({ code: base + 3, id: p.id + ':tame', place: p.id, kind: 'tame', title: WI.animals[p.tame.kind].name + ' tamed', icon: frame(p.tame.food) });
    if (p.chests && p.chests.length) addMedal({ code: base + 4, id: p.id + ':chests', place: p.id, kind: 'chests', title: 'Every chest in ' + p.name, icon: frame('chest') });
    if (p.npc && p.npc.lines && p.npc.lines.length) addMedal({ code: base + 5, id: p.id + ':story', place: p.id, kind: 'story', title: p.npc.name + "'s story", icon: frame('book') });
    p.kinds.forEach(function (kind, i) {
      var d = WI.animals[kind];
      addMedal({ code: base + 10 + i * 2, id: p.id + ':hunt:' + kind, place: p.id, kind: 'hunt', animal: kind, title: (d.rare ? 'Rare: ' : '') + d.name, icon: icon(kind), big: !!d.rare });
      if (!d.rare && !d.great) addMedal({ code: base + 11 + i * 2, id: p.id + ':giant:' + kind, place: p.id, kind: 'giant', animal: kind, title: 'Giant ' + d.name, icon: icon(kind) });
    });
  };

  // ---------- the places from before: in the jeep's list too, and they keep their walking trails ----------
  // jeep: the spawn point the jeep brings you to there (Pulag has the jeep itself, by Kanor's Lodge).
  var kindsOf = function (area) {
    var a = WI.areas[area], out = Object.keys(a.animals);
    (a.extra || []).forEach(function (x) { if (out.indexOf(x.kind) < 0 && !WI.animals[x.kind].great) out.push(x.kind); });
    return out;
  };
  [
    { id: 'pulag', n: 1, jeep: 'from_jeep', icon: 'feather_labuyo' },
    { id: 'makiling', n: 2, jeep: 'from_pulag', icon: 'tusk' },
    { id: 'magayon', n: 3, jeep: 'from_makiling', icon: 'claw_bear', dungeon: { key: 'lair', guard: 'bungisngis', boss: 'bakunawa', lair: true } },
  ].forEach(function (p) {
    var a = WI.areas[p.id];
    p.legacy = true;
    p.name = a.name;
    p.map = p.id;
    p.unlock = a.unlock || 0;
    p.kinds = kindsOf(p.id);
    C.PLACES[p.id] = p;
    C.PLACE_ORDER.push(p.id);
    makeMedals(p);
  });

  // ---------- adding a place ----------
  var need = function (ok, what) { if (!ok) throw new Error('F.addPlace: ' + what); };
  // An icon by name: its own picture once it is in the items sheet (F.placeIcons), else the stand-in named (an icon
  // that is there already), else the chest.
  var iconOf = function (name, standIn) {
    if (typeof name === 'number') return name;
    if (C.ICON[name] != null) return C.ICON[name];
    return C.ICON[standIn] != null ? C.ICON[standIn] : C.ICON.chest;
  };
  // A place's own icons (docs/places-items.json: icons_<place>.png, 4 x 4 in that file's order), appended to the items
  // sheet's list ONLY once tools/art has painted them into assets/items.png (call it from the place's file, after the
  // art is in; never before: an icon past the sheet's end draws nothing). Ids already there (kaldereta) keep theirs.
  F.placeIcons = function (ids) {
    ids.forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
    C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  };
  F.addPlace = function (p) {
    need(p && /^[a-z][a-z0-9_]*$/.test(p.id) && !C.PLACES[p.id] && !WI.areas[p.id], 'a new lowercase id');
    need(p.n > 3 && p.n < 1000 && !C.PLACE_ORDER.some(function (k) { return C.PLACES[k].n === p.n; }), p.id + ': its own number n (11-20 for the owner\'s ten places)');
    need(p.name && p.map, p.id + ': a name and a map');
    p.unlock = p.unlock || 0;
    p.jeep = p.jeep || 'from_jeep';
    // its items first (drops, foods, gear needs): an icon by name, from the items sheet
    Object.keys(p.items || {}).forEach(function (id) {
      var it = p.items[id];
      need(!C.ITEMS[id], p.id + ': item ' + id + ' already exists (to use one from before, just name it in drops and needs)');
      need(/^[a-z][a-z_]{0,23}$/.test(id), p.id + ': item id ' + id + ' (lowercase letters and _, at most 24: the server takes it)');
      it.icon = iconOf(id, it.standIn || it.icon); // (its own picture when it is in; until then the stand-in)
      it.place = p.id;
      C.ITEMS[id] = it;
    });
    // its creatures: the map's animals and the dungeon's, each one row of WI.animals
    var addKind = function (kind, def, extra) {
      need(!WI.animals[kind], p.id + ': creature ' + kind + ' already exists');
      Object.keys(extra).forEach(function (k) { def[k] = extra[k]; });
      def.place = p.id;
      WI.animals[kind] = def;
      WI.more.push(kind);
    };
    Object.keys(p.creatures || {}).forEach(function (kind) { addKind(kind, p.creatures[kind], {}); });
    var d = p.dungeon;
    if (d) {
      need(d.key && /^[a-z][a-z0-9_]*$/.test(d.key) && !WI.areas[d.key], p.id + ': a dungeon map key');
      d.floors = d.floors || 10;
      d.liftEvery = d.liftEvery || 5;
      d.guardFloor = d.guardFloor || 5;
      d.bossFloor = d.bossFloor || d.floors;
      d.count = d.count || { base: 3, per: 4, max: 6 };
      d.map = d.map || d.key;
      Object.keys(d.creatures || {}).forEach(function (kind) { addKind(kind, d.creatures[kind], { dungeon: d.key, respawn: 0 }); });
      C.DUNGEONS[d.key] = p.id;
    }
    // the map's animals: a wild place like Pulag (L.isWildMap, L.wildHere, the Bow, the dog, friends)
    WI.areas[p.id] = {
      name: p.name, animals: p.animals || {}, extra: p.extra || [], unlock: p.unlock, place: p.id,
      shut: p.shut || p.name + ' is further than you have hunted yet',
      opened: p.opened || p.name.toUpperCase() + ' IS OPEN\nKanor: "' + p.unlock + ' hunts! Ride my Jeep by the Lodge to ' + p.name + '."',
    };
    if (d) WI.areas[d.key] = { name: d.name || p.name + ' Cave', animals: {}, unlock: p.unlock, place: p.id, dungeon: true, shut: p.name + "'s cave is further than you have hunted yet" };
    // its gear set: four pieces, each with what Kanor needs and his Gold
    if (p.gear) {
      C.GEAR_SLOTS.forEach(function (slot) {
        var g = p.gear.pieces && p.gear.pieces[slot];
        need(g && g.name && g.needs && g.gold > 0, p.id + ': a ' + slot + ' piece');
        var id = p.id + '_' + slot;
        C.PLACE_GEAR[id] = { id: id, place: p.id, slot: slot, name: g.name, icon: iconOf(g.id || g.icon, g.standIn || 'gear_cloak'), art: g.id || null, needs: g.needs, gold: g.gold, less: C.GEAR_LESS[slot] };
      });
    }
    if (p.tame) {
      var t = p.tame;
      ['feedings', 'runOff', 'back', 'near'].forEach(function (k) { if (t[k] == null) t[k] = C.TAME[k]; });
      need(WI.animals[t.kind] && C.ITEMS[t.food] && C.COMPANION_SKILLS[t.skill], p.id + ': a tame kind, food and skill');
      WI.animals[t.kind].tameOnly = true; // (not for the Bow)
    }
    // the kinds its medals and "% explored" count: its animals (and the rare one), then the tame
    p.kinds = Object.keys(p.animals || {});
    (p.extra || []).forEach(function (x) { if (p.kinds.indexOf(x.kind) < 0 && !WI.animals[x.kind].great) p.kinds.push(x.kind); });
    p.chests = p.chests || [];
    C.PLACES[p.id] = p;
    C.PLACE_ORDER.push(p.id);
    makeMedals(p);
    // the way out toward everywhere else (the goal arrow): the jeep back to Pulag, and from the cave its ladder
    var R = C.ROUTES;
    R[p.id] = {};
    Object.keys(R).forEach(function (m) {
      if (m === p.id) return;
      R[p.id][m] = 'jeep';
      R[m][p.id] = m === 'pulag' ? 'jeep' : R[m].pulag;
    });
    if (d) {
      R[d.key] = {};
      Object.keys(R).forEach(function (m) {
        if (m === d.key) return;
        R[d.key][m] = 'exit';
        R[m][d.key] = m === p.id ? 'dungeon_door' : R[m][p.id];
      });
    }
    return p;
  };

  // the Lair is Magayon's dungeon: its own medals (above, from its guard and boss) and its own code (19zt-lair.js)
  C.DUNGEONS.lair = 'magayon';
})(window.Farm = window.Farm || {});
