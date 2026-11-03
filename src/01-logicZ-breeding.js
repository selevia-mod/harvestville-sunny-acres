// The rules of animal breeds (00-zzzzzzz-breeding.js). Every farm animal has a breed: a.br, an index into
// C.BREEDS[kind] (0 = the art as it is; animals from before breeds are all 0). Lily sells the common ones (a colour you
// have not found yet while there is one); a newborn takes after its parents, with a small chance of a rare colour;
// a rare animal gives one more of its produce each morning it was fed (a.bx: that one is still waiting). The Miracle
// Potion works on pigs and carabaos as well as cows now. Found colours stay in the Breeds book (s.brf: a bitmask per
// kind, in C.ANIMAL_KEYS order); completing a kind wins a prize once (s.brp: a bit per kind).
// Saved as 'br': [one number per animal in the save's own animal order (breed + 16 if a bonus waits), s.brf, s.brp].
// (Named 01-logicZ-: a name like 01-logic-breeding.js sorts BEFORE 01-logic.js, so it could not wrap it.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var BR = C.BREEDING;
  var BONUS_BIT = 16;

  C.TIPS.push({ key: 'breeds_tour', text: 'ANIMAL BREEDS' });

  var kindIndex = function (kind) { return C.ANIMAL_KEYS.indexOf(kind); };
  var list = function (kind) { return C.BREEDS[kind] || [{ key: 'plain', name: (C.ANIMALS[kind] || {}).name || kind }]; };
  var int = function (v, min, max, fallback) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  };

  // ---------- reading breeds ----------
  L.breedOf = function (a) {
    var b = a && a.br | 0;
    return b > 0 && b < list(a.kind).length ? b : 0;
  };
  L.breedDef = function (kind, b) { return list(kind)[b] || list(kind)[0]; };
  L.isRare = function (a) { return !!(a && L.breedDef(a.kind, L.breedOf(a)).rare); };
  L.commonBreeds = function (kind) { return list(kind).map(function (d, i) { return d.rare ? -1 : i; }).filter(function (i) { return i >= 0; }); };
  L.rareBreeds = function (kind) { return list(kind).map(function (d, i) { return d.rare ? i : -1; }).filter(function (i) { return i >= 0; }); };

  // For other features (contests, ...): an animal's breed { kind, index, key, name, rare }, or null. Called as
  // L.animalBreed(animal, s, i) (the record first: the contests' call) or L.animalBreed(s, i).
  L.animalBreed = function (x, y, z) {
    var a = x && x.kind ? x : x && x.animals ? x.animals[y] : y && y.animals ? y.animals[z] : null;
    if (!a || !C.ANIMALS[a.kind]) return null;
    var b = L.breedOf(a), d = L.breedDef(a.kind, b);
    return { kind: a.kind, index: b, key: d.key, name: d.name, rare: !!d.rare };
  };

  // ---------- choosing a breed ----------
  L.brRandom = Math.random; // (the tests swap it)
  var pick = function (arr, rnd) { return arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))]; };

  // A newborn's breed from its mother's and father's (indexes, or null when there is none).
  L.pickBreed = function (kind, mother, father, rnd) {
    rnd = rnd || L.brRandom;
    var defs = list(kind), rares = L.rareBreeds(kind), commons = L.commonBreeds(kind);
    var rareParent = [mother, father].some(function (b) { return b != null && defs[b] && defs[b].rare; });
    if (rares.length && rnd() < (rareParent ? BR.rareKin : BR.rare)) {
      // a rare parent passes on its own rare colour
      var own = [mother, father].filter(function (b) { return b != null && defs[b] && defs[b].rare; });
      return own.length ? own[0] : pick(rares, rnd);
    }
    var like = rnd() < BR.likeMother ? [mother, father] : [father, mother];
    for (var k = 0; k < 2; k++) if (like[k] != null && defs[like[k]] && !defs[like[k]].rare) return like[k];
    return pick(commons, rnd);
  };

  // What Lily's shop sends: a common colour you have not found yet, while there is one; else any common one.
  L.shopBreed = function (s, kind, rnd) {
    var commons = L.commonBreeds(kind), fresh = commons.filter(function (b) { return !L.breedFound(s, kind, b); });
    return fresh.length ? fresh[0] : pick(commons, rnd || L.brRandom);
  };

  // ---------- the Breeds book ----------
  L.breedFound = function (s, kind, b) { var k = kindIndex(kind); return k >= 0 && !!((s.brf && s.brf[k]) & (1 << b)); };
  // Notes a breed as found; true the first time.
  L.markBreed = function (s, kind, b) {
    var k = kindIndex(kind);
    if (k < 0 || L.breedFound(s, kind, b)) return false;
    s.brf = s.brf || [];
    while (s.brf.length <= k) s.brf.push(0);
    s.brf[k] |= 1 << b;
    return true;
  };
  L.breedsFound = function (s, kind) { return list(kind).filter(function (d, b) { return L.breedFound(s, kind, b); }).length; };
  L.breedsDone = function (s, kind) { return L.breedsFound(s, kind) === list(kind).length; };
  L.breedPrizeTaken = function (s, kind) { var k = kindIndex(kind); return k >= 0 && !!(s.brp & (1 << k)); };
  // 'ok', 'notyet' (not every colour found), 'taken', or 'full' (no room for the prize's item)
  L.claimBreedPrize = function (s, kind) {
    var p = BR.prize[kind];
    if (!p || !L.breedsDone(s, kind)) return 'notyet';
    if (L.breedPrizeTaken(s, kind)) return 'taken';
    if (p.item && L.addItem(s, p.item, 1) > 0) return 'full';
    s.gold += p.gold || 0;
    s.brp = (s.brp || 0) | (1 << kindIndex(kind));
    return 'ok';
  };
  L.breedPrizesReady = function (s) {
    return C.ANIMAL_KEYS.filter(function (k) { return BR.prize[k] && L.breedsDone(s, k) && !L.breedPrizeTaken(s, k); });
  };

  // ---------- new animals get a breed ----------
  // births: while L.endDay runs, the animals it will add, in its order: { kind, mother } (mother: the animal, or null)
  var births = null;
  // (breed 0 is no property at all: the animal is as it always was)
  var setBreed = function (a, b) { if (b) a.br = b; else delete a.br; };
  var adults = function (s, kind, not) { return s.animals.filter(function (a) { return a.kind === kind && !a.young && a !== not; }); };

  var addAnimal = L.addAnimal;
  L.addAnimal = function (s, kind, young) {
    var birth = young && births && births.length ? births[0] : null;
    // L.endDay names a calf 'cow' whoever its mother is: a pig's is a piglet, a carabao's a calf
    if (birth && (birth.kind === kind || (kind === 'cow' && C.ANIMALS[birth.kind].home === 'barn'))) {
      births.shift();
      kind = birth.kind;
      young = C.ANIMALS[kind].grow;
    } else birth = null;
    var i = addAnimal.call(this, s, kind, young), a = s.animals[i], b;
    if (birth) {
      var mother = birth.mother || null;
      if (!mother) { // a chick from the incubator: one of the hens in the coop
        var hens = adults(s, kind, null);
        mother = hens.length ? pick(hens, L.brRandom) : null;
      }
      var others = adults(s, kind, mother), father = others.length ? pick(others, L.brRandom) : null; // (the newborn is young: not one)
      b = L.pickBreed(kind, mother ? L.breedOf(mother) : null, father ? L.breedOf(father) : null, L.brRandom);
    } else {
      b = L.shopBreed(s, kind, L.brRandom);
    }
    setBreed(a, b);
    // a first find: for the day report or the shop's toast (hidden: not saved, not compared, gone on a reload)
    if (L.markBreed(s, kind, b)) Object.defineProperty(a, 'brNew', { value: 1, writable: true, configurable: true, enumerable: false });
    return i;
  };

  // The Miracle Potion: pigs and carabaos too.
  var givePotion = L.givePotion;
  L.givePotion = function (s, i, slotIndex) {
    var a = s.animals[i], slot = s.inv[slotIndex];
    if (!a || a.kind === 'cow' || BR.potion.indexOf(a.kind) < 0) return givePotion.call(this, s, i, slotIndex);
    if (!slot || slot.id !== 'miracle') return 'nopotion';
    if (a.young) return 'young';
    if (a.preg) return 'already';
    if (a.love < C.LOVE.potion) return 'love';
    if (L.space(s, a.kind) <= 0) return 'full';
    L.removeAt(s, slotIndex, 1);
    a.preg = C.PREGNANT_DAYS;
    return 'ok';
  };

  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var due = [], layers = [];
    s.animals.forEach(function (a) {
      if (a.preg === 1) due.push({ kind: a.kind, mother: a });
      if (!a.young && a.fed && L.isRare(a)) layers.push(a);
    });
    if (s.inc === 1) due.push({ kind: 'chicken', mother: null });
    var outer = births;
    births = due;
    var r;
    try { r = endDay.call(this, s, passedOut, info); } finally { births = outer; }
    layers.forEach(function (a) {
      if (!a.ready) return;
      a.bx = BR.bonus;
      var item = a.ready === 2 ? C.ANIMALS[a.kind].large : C.ANIMALS[a.kind].product;
      if (r && r.produced) r.produced[item] = (r.produced[item] || 0) + BR.bonus;
    });
    return r;
  };

  // Collecting from a rare animal: its bonus as well (if the bag is full, the bonus waits in the pen).
  var collect = L.collect;
  L.collect = function (s, i) {
    var a = s.animals[i], ready = a && a.ready;
    var got = collect.call(this, s, i);
    if (!a || !a.bx || typeof got !== 'string' || got[0] === '!') return got;
    var left = a.bx;
    while (left > 0 && L.addItem(s, got, 1) === 0) left--;
    a.bx = 0;
    if (left > 0) { a.ready = ready; a.bx = left - 1; }
    return got;
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.brf = s.brf || [];
    s.brp = 0;
    s.animals.forEach(function (a) { setBreed(a, L.breedOf(a)); L.markBreed(s, a.kind, L.breedOf(a)); delete a.brNew; });
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.br = [
      s.animals.map(function (a) { return L.breedOf(a) + (a.bx ? BONUS_BIT : 0); }),
      C.ANIMAL_KEYS.map(function (k, i) { return (s.brf && s.brf[i]) | 0; }),
      s.brp | 0,
    ];
    return o;
  };

  // Gives each animal of `animals` its breed from `entries` (the raw list it was rebuilt from: [kind or kind index, name, ...]),
  // matching them up in order (a rebuilt list only ever drops entries).
  var matchUp = function (animals, entries, codes, kindOf) {
    var j = 0;
    entries.forEach(function (e, k) {
      var a = animals[j];
      if (!a || !Array.isArray(e) || kindOf(e) !== a.kind) return;
      var name = typeof e[1] === 'string' ? e[1] : null;
      if (name != null && name.slice(0, 16) !== a.name && name) return;
      var code = int(codes[k], 0, 2 * BONUS_BIT - 1, 0), b = code & (BONUS_BIT - 1);
      setBreed(a, b < list(a.kind).length ? b : 0);
      if (code & BONUS_BIT && L.isRare(a) && a.ready) a.bx = BR.bonus;
      j++;
    });
  };

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var br = Array.isArray(o.br) ? o.br : [];
    s.animals.forEach(function (a) { delete a.br; delete a.bx; delete a.brNew; });
    if (Array.isArray(br[0]) && Array.isArray(o.a)) {
      // the save's animals are [kind index, love, fed, pet, ready, name, ...]: the name is e[5]
      var entries = o.a.map(function (e) { return Array.isArray(e) ? [C.ANIMAL_KEYS[e[0]], typeof e[5] === 'string' ? e[5] : ''] : null; });
      matchUp(s.animals, entries, br[0], function (e) { return e[0]; });
    }
    s.brf = [];
    if (Array.isArray(br[1])) C.ANIMAL_KEYS.forEach(function (k, i) { s.brf[i] = int(br[1][i], 0, (1 << list(k).length) - 1, 0); });
    s.brp = int(br[2], 0, (1 << C.ANIMAL_KEYS.length) - 1, 0);
    s.animals.forEach(function (a) { L.markBreed(s, a.kind, L.breedOf(a)); }); // (old saves: what is in the pen now)
    return s;
  };

  // ---------- friends see your colours ----------
  var snapshot = L.snapshot;
  if (snapshot) {
    L.snapshot = function (s) {
      var snap = snapshot.apply(this, arguments);
      if (snap && Array.isArray(snap.animals)) snap.animals.forEach(function (e, k) { if (Array.isArray(e) && s.animals[k] && L.breedOf(s.animals[k])) e.push(L.breedOf(s.animals[k])); });
      return snap;
    };
  }
  var visitState = L.visitState;
  if (visitState) {
    L.visitState = function (snap, mine) {
      var s = visitState.apply(this, arguments);
      if (!s || !snap || !Array.isArray(snap.animals)) return s;
      s.animals.forEach(function (a) { delete a.br; delete a.bx; delete a.brNew; });
      var codes = snap.animals.map(function (e) { return Array.isArray(e) ? int(e[3], 0, BONUS_BIT - 1, 0) : 0; });
      var entries = snap.animals.map(function (e) { return Array.isArray(e) ? [e[0], typeof e[1] === 'string' && e[1] ? e[1] : null] : null; });
      matchUp(s.animals, entries, codes, function (e) { return e[0]; });
      return s;
    };
  }

  // ---------- painting a breed (19zz-breeding.js runs this on every pixel of the frames, once per breed) ----------
  var hex = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  var smooth = function (e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // How much a pixel is the coat (0 to 1), by its lightness y (0-1), colourfulness c (0-1) and hue h (degrees).
  var SEL = {
    pale: function (y, c) { return smooth(0.28, 0.42, y) * (1 - smooth(0.26, 0.42, c)); }, // white feathers, not the comb, beak or eyes
    dark: function (y, c) { return (1 - smooth(0.3, 0.44, y)) * (1 - smooth(0.16, 0.28, c)) * smooth(0.04, 0.1, y); }, // black spots, not the outline
    neutral: function (y, c) { return (1 - smooth(0.16, 0.28, c)) * smooth(0.04, 0.1, y); }, // the whole coat, black and white
    pink: function (y, c, h) {
      var hd = Math.min(Math.abs(h - 350), 360 - Math.abs(h - 350)); // pink skin: around 350 degrees
      return (1 - smooth(32, 50, hd)) * smooth(0.06, 0.14, c) * smooth(0.25, 0.4, y);
    },
    grey: function (y, c) { return (1 - smooth(0.14, 0.24, c)) * (1 - smooth(0.66, 0.78, y)) * smooth(0.04, 0.1, y); }, // the grey hide, not the horns
  };
  L.breedSel = SEL;
  L.breedRamp = function (paint) { return paint.ramp.map(hex); };
  // Paints RGBA pixels in place (an ImageData's data): every coat pixel takes the ramp's colour for its lightness, as
  // much as it is coat. No allocations in the loop (a breed's frames are about 190,000 pixels, on a low-end phone).
  L.breedPaintPixels = function (paint, px) {
    if (!paint) return px;
    var ramp = L.breedRamp(paint), sel = SEL[paint.sel] || SEL.neutral, lo = paint.range[0], span = paint.range[1] - lo, last = ramp.length - 1;
    for (var i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b), d = mx - mn;
      var c = d / 255, y = (0.299 * r + 0.587 * g + 0.114 * b) / 255, h = 0;
      if (d) {
        if (mx === r) h = ((g - b) / d + 6) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      var w = sel(y, c, h);
      if (w <= 0) continue;
      var t = (y - lo) / span;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var seg = t * last, k = Math.min(last - 1, Math.floor(seg)), f = seg - k, A = ramp[k], B = ramp[k + 1];
      px[i] = Math.round(r + (A[0] + (B[0] - A[0]) * f - r) * w);
      px[i + 1] = Math.round(g + (A[1] + (B[1] - A[1]) * f - g) * w);
      px[i + 2] = Math.round(b + (A[2] + (B[2] - A[2]) * f - b) * w);
    }
    return px;
  };
  // One pixel of a breed: [r, g, b] in, [r, g, b] out.
  L.breedPixel = function (paint, r, g, b) {
    var px = L.breedPaintPixels(paint, [r, g, b, 255]);
    return [px[0], px[1], px[2]];
  };
})(window.Farm = window.Farm || {});
