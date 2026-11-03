// Contests at the festivals: the rules (content 00-zzzzzzz-contests.js, on screen 19zz-contests.js). Pure, no Phaser.
// (Named 01-logicZ-: a name like 01-logic-contests.js sorts before 01-logic.js and would load first.)
//
// At the Cow Festival, the Harvest Festival and Starry Night you bring one entry: your best animal, a crop or a dish you
// cooked. Three villagers enter too, picked and scored from the year alone (the same on every phone). The best score
// wins (a tie goes to you). Prizes: a ribbon for 1st to 3rd, Gold, and 1st place is that year's trophy.
// Saved: s.cn = { r: [{ c: contest key, y: year, p: place 1-4, w: what you entered }] } as 'cn' (newest last; 'ct' is the cat's, 01-logic2.js).
// Crop quality (feat/farmtech, L.cropQuality) and animal breeds (feat/breeding, L.animalBreed) count once they are in.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = C.CONTEST;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var SEED = 20261120;
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  C.TIPS.push({ key: 'contest_tour', text: 'FESTIVAL CONTESTS' });

  L.ctDef = function (key) { return C.CONTESTS.filter(function (c) { return c.key === key; })[0] || null; };
  // The contest held at a festival, or null.
  L.ctOf = function (fest) { return fest ? C.CONTESTS.filter(function (c) { return c.fest === fest.key; })[0] || null : null; };
  L.ctFest = function (ct) { return C.FESTIVALS.filter(function (f) { return f.key === ct.fest; })[0]; };
  // The contest you can enter right now (its festival is on, in its hours), or null.
  L.ctNow = function (s) { return L.ctOf(L.festivalNow(s)); };
  var rec = function (s) { s.cn = s.cn || { r: [] }; return s.cn.r; };
  L.ctResult = function (s, key, year) {
    if (year == null) year = L.date(s.day).year;
    return rec(s).filter(function (r) { return r.c === key && r.y === year; })[0] || null;
  };
  L.ctEntered = function (s, key) { return !!L.ctResult(s, key); };
  L.ctRibbons = function (s) { return rec(s).filter(function (r) { return r.p <= 3; }); };
  L.ctTrophies = function (s) { return rec(s).filter(function (r) { return r.p === 1; }); };

  // ---------- what the judges see ----------
  // feat/breeding: L.animalBreed(animal, s, i) -> a breed name, or { name, rare } (rare: true, or a tier number).
  var breedOf = function (s, a, i) {
    if (typeof L.animalBreed !== 'function') return null;
    var b = null;
    try { b = L.animalBreed(a, s, i); } catch (e) { return null; }
    if (!b) return null;
    if (typeof b === 'string') return { name: b, rare: false };
    if (b.index === 0) return null; // (feat/breeding gives every animal its breed: the first colour is the plain one, no points)
    return { name: String(b.name || b.key || ''), rare: !!(b.rare === true || Number(b.rare) > 0 || Number(b.tier) > 0 || Number(b.rarity) > 0) };
  };
  // feat/farmtech: L.cropQuality(slot, s, slotIndex) -> 0 to 3 stars, or { stars } / { level } / { q }.
  var qualityOf = function (s, slot, i) {
    var q = 0;
    if (typeof L.cropQuality === 'function') {
      try { q = L.cropQuality(slot, s, i); } catch (e) { q = 0; }
    }
    if (q && typeof q === 'object') q = q.stars != null ? q.stars : q.level != null ? q.level : q.q;
    return clamp(Math.floor(Number(q)) || 0, 0, 3);
  };
  var inSeason = function (s, id) { var crop = C.ITEMS[id].crop || id; return !!C.CROPS[crop] && L.cropInSeason(crop, s.day); };
  // How many things go into a dish (its recipe; a workshop good counts as two).
  var parts = function (id) {
    var r = C.RECIPES.filter(function (x) { return x.dish === id; })[0];
    return r ? r.needs.length : 2;
  };
  L.ctHomemade = function (id) { var it = C.ITEMS[id]; return !!it && it.kind === 'dish' && !it.price; };

  // Your animal's score, with what went into it.
  L.ctAnimalScore = function (s, i) {
    var a = s.animals[i], A = K.animal, b = breedOf(s, a, i);
    var bonus = b ? (b.rare ? A.rare : A.breed) : 0;
    var score = a.love * A.love + (a.fed ? A.fed : 0) + (a.pet ? A.pet : 0) + (a.brushed ? A.brush : 0) + bonus;
    return { score: clamp(Math.round(score), 0, 100), breed: b, bonus: bonus };
  };
  L.ctCropScore = function (s, slotIndex) {
    var slot = s.inv[slotIndex], P = K.crop, q = qualityOf(s, slot, slotIndex), fresh = inSeason(s, slot.id);
    var score = P.base + C.ITEMS[slot.id].sell * P.price + (fresh ? P.season : 0) + q * P.star;
    return { score: clamp(Math.round(score), 0, 100), stars: q, fresh: fresh };
  };
  L.ctDishScore = function (s, slotIndex) {
    var it = C.ITEMS[s.inv[slotIndex].id], P = K.dish, n = parts(s.inv[slotIndex].id);
    return { score: clamp(Math.round(P.base + (it.energy || 0) * P.energy + n * P.part), 0, 100), parts: n };
  };

  // What you could enter: [{ choice, name, icon, score, ... }], the best first. choice: an animal index or a bag slot.
  L.ctChoices = function (s, key) {
    var ct = L.ctDef(key), out = [];
    if (!ct) return out;
    if (ct.what === 'animal') {
      s.animals.forEach(function (a, i) {
        if (a.young) return;
        var sc = L.ctAnimalScore(s, i);
        out.push({ choice: i, name: a.name, kind: a.kind, icon: C.ANIMALS[a.kind].icon, score: sc.score, breed: sc.breed,
          love: a.love, fed: !!a.fed, pet: !!a.pet, brushed: !!a.brushed });
      });
    } else {
      var seen = {};
      s.inv.forEach(function (slot, i) {
        if (!slot || !C.ITEMS[slot.id]) return;
        var it = C.ITEMS[slot.id];
        if (ct.what === 'crop' ? it.kind !== 'crop' : !L.ctHomemade(slot.id)) return;
        var sc = ct.what === 'crop' ? L.ctCropScore(s, i) : L.ctDishScore(s, i), id = slot.id + '.' + (sc.stars || 0);
        if (seen[id]) return;
        seen[id] = 1;
        out.push({ choice: i, id: slot.id, name: it.name, icon: it.icon, score: sc.score, stars: sc.stars || 0, fresh: sc.fresh, parts: sc.parts, sell: it.sell || 0, energy: it.energy || 0 });
      });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  };

  // ---------- the villagers' entries: from the year alone ----------
  L.ctRivals = function (key, year) {
    var ct = L.ctDef(key), ci = C.CONTEST_ORDER.indexOf(key);
    var pool = ct.rivals.map(function (r, k) { return { r: r, o: L.rand(SEED, year, ci, k) }; });
    pool.sort(function (a, b) { return a.o - b.o; });
    // the grandest of the three entries gets the best score (a carabao over a chicken, a pie over a soup)
    var worth = function (r) { return ct.what === 'animal' ? C.ANIMALS[r[1]].price : ct.what === 'crop' ? C.ITEMS[r[1]].sell : C.ITEMS[r[1]].energy; };
    var three = pool.slice(0, 3).sort(function (a, b) { return worth(b.r) - worth(a.r) || a.o - b.o; });
    return three.map(function (p, t) {
      var r = p.r, tier = K.tiers[t], who = C.VILLAGERS[r[0]].name, own = who + (/s$/.test(who) ? "'" : "'s");
      var score = Math.round(tier[0] + L.rand(SEED + 1, year, ci, t) * (tier[1] - tier[0]));
      var animal = ct.what === 'animal';
      return {
        who: r[0], score: score, me: false,
        name: animal ? own + ' ' + C.ANIMALS[r[1]].name.toLowerCase() + ' ' + r[2] : own + ' ' + C.ITEMS[r[1]].name,
        icon: animal ? C.ANIMALS[r[1]].icon : C.ITEMS[r[1]].icon,
      };
    });
  };

  // ---------- entering ----------
  // Enters `choice` (an animal index, or a bag slot) in the contest on now. Returns { place, gold, trophy, score,
  // entries: every entry, the best first, yours with me: true, text } or { error: 'closed' | 'entered' | 'choice' }.
  L.ctEnter = function (s, key, choice) {
    var ct = L.ctDef(key), fest = L.festivalNow(s);
    if (!ct || !fest || fest.key !== ct.fest) return { error: 'closed' };
    if (L.ctEntered(s, key)) return { error: 'entered' };
    var pick = L.ctChoices(s, key).filter(function (o) { return o.choice === choice; })[0];
    if (!pick && ct.what !== 'animal') {
      // another slot of the same thing counts as that thing
      var slot = s.inv[choice];
      pick = slot && L.ctChoices(s, key).filter(function (o) { return o.id === slot.id; })[0];
      if (pick) pick = Object.assign({}, pick, { choice: choice, score: (ct.what === 'crop' ? L.ctCropScore : L.ctDishScore)(s, choice).score });
    }
    if (!pick) return { error: 'choice' };
    var year = L.date(s.day).year;
    var mine = { who: null, me: true, score: pick.score, icon: pick.icon,
      name: ct.what === 'animal' ? pick.name + ' the ' + C.ANIMALS[pick.kind].name.toLowerCase() : 'Your ' + pick.name };
    var entries = L.ctRivals(key, year).concat([mine]);
    entries.sort(function (a, b) { return b.score - a.score || (b.me ? 1 : 0) - (a.me ? 1 : 0); }); // a tie goes to you
    var place = entries.indexOf(mine) + 1, gold = K.gold[place];
    s.gold += gold;
    var what = '';
    if (ct.what === 'animal') {
      var a = s.animals[choice];
      a.love = clamp(a.love + (place === 1 ? K.love[0] : K.love[1]), 0, C.LOVE.max);
      what = a.name;
    } else {
      what = s.inv[choice].id;
      L.removeAt(s, choice, 1);
    }
    C.VILLAGER_ORDER.forEach(function (k) { L.addFriend(s, k, K.friend); });
    L.addFriend(s, ct.judge, K.judge);
    var r = rec(s);
    r.push({ c: key, y: year, p: place, w: what });
    while (r.length > K.keep) r.shift();
    // the festival itself counts as joined when the contest is all it has (the Cow and Harvest Festivals)
    var f = L.ctFest(ct);
    if (f.kind === 'harvest' || f.kind === 'cow') s.fest[f.key] = year;
    var text = place <= 3
      ? K.places[place] + '! ' + K.ribbons[place] + ' and ' + fmt(gold) + 'G' + (place === 1 ? ', and the ' + year + ' trophy!' : '.')
      : '4th place this time. Thank you for taking part: ' + gold + 'G.';
    return { place: place, gold: gold, trophy: place === 1, score: pick.score, entries: entries, year: year, text: text };
  };

  // A line about a contest today or tomorrow, for the morning report (null when there is none).
  L.ctNote = function (s) {
    var today = L.ctOf(L.festivalOn(s.day)), next = L.ctOf(L.festivalOn(s.day + 1));
    var tip = { animal: 'feed, pet and brush your best animal first', crop: 'bring your finest crop in your bag', dish: 'cook something good in your kitchen' };
    if (today && !L.ctEntered(s, today.key)) {
      var f = L.ctFest(today);
      return 'The ' + today.name + ' is on at the ' + f.name + ' today, ' + L.formatTime(f.from) + ' to ' + L.formatTime(f.to) + ': talk to Mayor Hollis in the plaza, and ' + tip[today.what] + '.';
    }
    if (next) return 'The ' + next.name + ' at the ' + L.ctFest(next).name + ' is tomorrow! Get ready: ' + tip[next.what] + '.';
    return null;
  };

  // ---------- the save ('cn') ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.cn = { r: [] };
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), r = (s.cn && s.cn.r) || [];
    if (r.length) o.cn = r.map(function (x) { return [C.CONTEST_ORDER.indexOf(x.c), x.y, x.p, x.w || '']; });
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.cn = { r: [] };
    (Array.isArray(o.cn) ? o.cn : []).slice(-K.keep).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var key = C.CONTEST_ORDER[e[0]], y = Math.floor(Number(e[1])), p = Math.floor(Number(e[2]));
      if (!key || !(y >= 2020 && y <= 2200) || !(p >= 1 && p <= 4)) return;
      if (s.cn.r.some(function (x) { return x.c === key && x.y === y; })) return; // one a year
      s.cn.r.push({ c: key, y: y, p: p, w: typeof e[3] === 'string' ? e[3].slice(0, 24) : '' });
    });
    return s;
  };
})(window.Farm = window.Farm || {});
