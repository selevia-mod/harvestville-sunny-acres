// Pure game rules: state, inventory, soil, crops, days, shipping, shop and the save format.
// No Phaser in here, so it can be unit-tested in Node.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = {};

  L.newState = function () {
    var s = {
      day: 1,
      time: C.DAY_START,
      gold: C.START_GOLD,
      energy: C.MAX_ENERGY,
      water: C.CAN_CAPACITY,
      player: { x: null, y: null, dir: 'down' }, // feet position in world px; null = map spawn
      sel: 0,
      inv: [],
      box: [], // items in the shipping box, paid out overnight: [{ id, n }]
      soil: {}, // tile index -> { w: watered 0|1, c: crop key or null, d: days grown }
      animals: [], // { kind, name, love 0..100, fed 0|1, pet 0|1 (today), ready 0|1 (produce waiting) }
    };
    for (var i = 0; i < C.INV_SIZE; i++) s.inv.push(null);
    C.START_ITEMS.forEach(function (it) { L.addItem(s, it[0], it[1]); });
    C.START_ANIMALS.forEach(function (kind) { L.addAnimal(s, kind); });
    return s;
  };

  // ---------- inventory ----------
  L.stackLimit = function (id) {
    return C.ITEMS[id].kind === 'tool' ? 1 : C.MAX_STACK;
  };

  L.countItem = function (s, id) {
    return s.inv.reduce(function (sum, slot) { return sum + (slot && slot.id === id ? slot.n : 0); }, 0);
  };

  // Room for n more of an item?
  L.canAdd = function (s, id, n) {
    var room = 0, max = L.stackLimit(id);
    s.inv.forEach(function (slot) {
      if (!slot) room += max;
      else if (slot.id === id) room += max - slot.n;
    });
    return room >= n;
  };

  // Adds up to n items; returns how many did NOT fit.
  L.addItem = function (s, id, n) {
    var max = L.stackLimit(id), i;
    for (i = 0; i < s.inv.length && n > 0; i++) {
      var slot = s.inv[i];
      if (slot && slot.id === id && slot.n < max) {
        var add = Math.min(n, max - slot.n);
        slot.n += add;
        n -= add;
      }
    }
    for (i = 0; i < s.inv.length && n > 0; i++) {
      if (!s.inv[i]) {
        var put = Math.min(n, max);
        s.inv[i] = { id: id, n: put };
        n -= put;
      }
    }
    return n;
  };

  L.removeAt = function (s, index, n) {
    var slot = s.inv[index];
    if (!slot) return 0;
    var taken = Math.min(n, slot.n);
    slot.n -= taken;
    if (slot.n <= 0) s.inv[index] = null;
    return taken;
  };

  L.held = function (s) {
    return s.inv[s.sel] || null;
  };

  // ---------- calendar ----------
  // state.day counts days since the farm started (1 = Spring 1 of year 1).
  L.date = function (day) {
    var n = C.DAYS_PER_SEASON, i = day - 1;
    var season = Math.floor(i / n) % C.SEASONS.length;
    return {
      season: season,
      key: C.SEASONS[season].key,
      name: C.SEASONS[season].name,
      day: (i % n) + 1,
      year: Math.floor(i / (n * C.SEASONS.length)) + 1,
    };
  };

  L.formatDate = function (day) {
    var d = L.date(day);
    return d.name + ' ' + d.day;
  };

  L.cropInSeason = function (crop, day) {
    return C.CROPS[crop].seasons.indexOf(L.date(day).key) >= 0;
  };

  L.seasonsOf = function (crop) {
    return C.CROPS[crop].seasons.map(function (k) {
      return C.SEASONS.filter(function (x) { return x.key === k; })[0].name;
    }).join(' and ');
  };

  // Seed items the shop sells today.
  L.seedsInSeason = function (day) {
    return C.SHOP_STOCK.filter(function (id) { return L.cropInSeason(C.ITEMS[id].crop, day); });
  };

  // ---------- soil & crops ----------
  L.cropStage = function (tile) {
    if (!tile || !tile.c) return -1;
    var days = C.CROPS[tile.c].days;
    if (tile.d >= days) return 3;
    if (tile.d === 0) return 0;
    return tile.d < days / 2 ? 1 : 2;
  };

  L.isRipe = function (tile) {
    return L.cropStage(tile) === 3;
  };

  L.till = function (s, idx) {
    if (s.soil[idx]) return 'already';
    s.soil[idx] = { w: 0, c: null, d: 0 };
    return 'ok';
  };

  L.water = function (s, idx) {
    var t = s.soil[idx];
    if (!t) return 'nosoil';
    if (t.w) return 'already';
    if (s.water <= 0) return 'empty';
    t.w = 1;
    s.water -= 1;
    return 'ok';
  };

  L.refill = function (s) {
    s.water = C.CAN_CAPACITY;
  };

  L.plant = function (s, idx, slotIndex) {
    var t = s.soil[idx], slot = s.inv[slotIndex];
    if (!slot || C.ITEMS[slot.id].kind !== 'seed') return 'noseed';
    if (!t) return 'nosoil';
    if (t.c) return 'occupied';
    if (!L.cropInSeason(C.ITEMS[slot.id].crop, s.day)) return 'season';
    t.c = C.ITEMS[slot.id].crop;
    t.d = 0;
    L.removeAt(s, slotIndex, 1);
    return 'ok';
  };

  // Returns the harvested item id, or an error string starting with '!'.
  L.harvest = function (s, idx) {
    var t = s.soil[idx];
    if (!L.isRipe(t)) return '!notripe';
    var item = C.CROPS[t.c].item;
    if (L.addItem(s, item, 1) > 0) return '!full';
    t.c = null;
    t.d = 0;
    return item;
  };

  L.spendEnergy = function (s, amount) {
    if (s.energy < amount) return false;
    s.energy -= amount;
    return true;
  };

  // ---------- animals ----------
  L.animalCount = function (s, kind) {
    return s.animals.filter(function (a) { return a.kind === kind; }).length;
  };

  // Picks the first unused name from the animal's list, then numbers them (Clucky 2, ...).
  L.nextName = function (s, kind) {
    var names = C.ANIMALS[kind].names, taken = s.animals.map(function (a) { return a.name; });
    for (var round = 1; ; round++) {
      for (var i = 0; i < names.length; i++) {
        var n = round === 1 ? names[i] : names[i] + ' ' + round;
        if (taken.indexOf(n) < 0) return n;
      }
    }
  };

  L.addAnimal = function (s, kind) {
    s.animals.push({ kind: kind, name: L.nextName(s, kind), love: 0, fed: 0, pet: 0, ready: 0 });
    return s.animals.length - 1;
  };

  // Returns the new animal's index, or 'gold' / 'full'.
  L.buyAnimal = function (s, kind) {
    var def = C.ANIMALS[kind];
    if (L.animalCount(s, kind) >= def.max) return 'full';
    if (s.gold < def.price) return 'gold';
    s.gold -= def.price;
    return L.addAnimal(s, kind);
  };

  function addLove(a, n) {
    a.love = Math.max(0, Math.min(C.LOVE.max, a.love + n));
  }

  L.hearts = function (a) {
    return Math.floor(a.love / 20);
  };

  L.feedAnimal = function (s, i, slotIndex) {
    var a = s.animals[i], slot = s.inv[slotIndex];
    if (!slot || C.ITEMS[slot.id].kind !== 'feed') return 'nofeed';
    if (C.ITEMS[slot.id].animal !== a.kind) return 'wrong';
    if (a.fed) return 'already';
    a.fed = 1;
    addLove(a, C.LOVE.feed);
    L.removeAt(s, slotIndex, 1);
    return 'ok';
  };

  L.petAnimal = function (s, i) {
    var a = s.animals[i];
    if (a.pet) return 'already';
    a.pet = 1;
    addLove(a, C.LOVE.pet);
    return 'ok';
  };

  // Returns the collected item id, or an error string starting with '!'.
  L.collect = function (s, i) {
    var a = s.animals[i];
    if (!a.ready) return '!notready';
    var item = C.ANIMALS[a.kind].product;
    if (L.addItem(s, item, 1) > 0) return '!full';
    a.ready = 0;
    return item;
  };

  // ---------- shipping & shop ----------
  L.boxValue = function (s) {
    return s.box.reduce(function (sum, b) { return sum + C.ITEMS[b.id].sell * b.n; }, 0);
  };

  // Moves the whole stack in a slot into the shipping box.
  L.ship = function (s, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || !C.ITEMS[slot.id].sell) return null;
    var entry = s.box.filter(function (b) { return b.id === slot.id; })[0];
    if (entry) entry.n += slot.n;
    else s.box.push({ id: slot.id, n: slot.n });
    s.inv[slotIndex] = null;
    return { id: slot.id, n: slot.n, value: C.ITEMS[slot.id].sell * slot.n };
  };

  L.buy = function (s, id, qty) {
    var cost = C.ITEMS[id].price * qty;
    if (s.gold < cost) return 'gold';
    if (!L.canAdd(s, id, qty)) return 'full';
    s.gold -= cost;
    L.addItem(s, id, qty);
    return 'ok';
  };

  // ---------- time ----------
  L.shopOpen = function (s) {
    return s.time >= C.SHOP_OPEN && s.time < C.SHOP_CLOSE;
  };

  // Ends the day: crops grow, watering resets, the shipping box pays out.
  L.endDay = function (s, passedOut) {
    Object.keys(s.soil).forEach(function (idx) {
      var t = s.soil[idx];
      if (t.c && t.w && !L.isRipe(t)) t.d += 1;
      t.w = 0;
    });
    var hungry = [], produced = {};
    s.animals.forEach(function (a) {
      if (a.fed) {
        a.ready = 1;
        var item = C.ANIMALS[a.kind].product;
        produced[item] = (produced[item] || 0) + 1;
      } else {
        addLove(a, C.LOVE.hungry);
        hungry.push(a.name);
      }
      if (!a.pet) addLove(a, C.LOVE.lonely);
      a.fed = 0;
      a.pet = 0;
    });
    var earned = L.boxValue(s);
    var shipped = s.box;
    s.gold += earned;
    s.box = [];
    var before = L.date(s.day);
    s.day += 1;
    var now = L.date(s.day);
    var withered = 0;
    if (now.season !== before.season) {
      Object.keys(s.soil).forEach(function (idx) {
        var t = s.soil[idx];
        if (t.c && !L.cropInSeason(t.c, s.day)) {
          t.c = null;
          t.d = 0;
          withered++;
        }
      });
    }
    s.time = C.DAY_START;
    s.energy = passedOut ? Math.floor(C.MAX_ENERGY / 2) : C.MAX_ENERGY;
    s.player = { x: null, y: null, dir: 'down' };
    return {
      earned: earned, shipped: shipped, passedOut: !!passedOut, hungry: hungry, produced: produced,
      newSeason: now.season !== before.season ? now.name : null, withered: withered,
    };
  };

  L.formatTime = function (minutes) {
    var m = Math.floor(minutes) % (24 * 60);
    var h = Math.floor(m / 60), mm = Math.floor((m % 60) / 10) * 10;
    var ampm = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ampm;
  };

  // ---------- save format ----------
  // Compact on purpose: the save must stay well under 16 KB of JSON.
  var DIRS = ['down', 'up', 'left', 'right'];

  L.serialize = function (s) {
    var out = {
      v: C.SAVE_VERSION,
      d: s.day,
      t: Math.floor(s.time),
      g: s.gold,
      e: s.energy,
      w: s.water,
      s: s.sel,
      i: s.inv.map(function (slot) { return slot ? [slot.id, slot.n] : 0; }),
      b: s.box.map(function (b) { return [b.id, b.n]; }),
      f: Object.keys(s.soil).map(function (idx) {
        var t = s.soil[idx];
        return [Number(idx), t.w, t.c ? C.CROP_KEYS.indexOf(t.c) + 1 : 0, t.d];
      }),
      a: s.animals.map(function (a) { return [C.ANIMAL_KEYS.indexOf(a.kind), a.love, a.fed, a.pet, a.ready, a.name]; }),
    };
    if (s.player.x != null) out.p = [Math.round(s.player.x), Math.round(s.player.y), DIRS.indexOf(s.player.dir)];
    return out;
  };

  function int(v, min, max, fallback) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  // Returns a full state, or null if the data is not a usable save.
  L.deserialize = function (o) {
    if (!o || typeof o !== 'object' || o.v !== C.SAVE_VERSION) return null;
    var s = L.newState();
    s.day = int(o.d, 1, 1e6, 1);
    s.time = int(o.t, C.DAY_START, C.PASS_OUT - 1, C.DAY_START);
    s.gold = int(o.g, 0, 1e9, C.START_GOLD);
    s.energy = int(o.e, 0, C.MAX_ENERGY, C.MAX_ENERGY);
    s.water = int(o.w, 0, C.CAN_CAPACITY, C.CAN_CAPACITY);
    s.sel = int(o.s, 0, C.INV_SIZE - 1, 0);
    if (Array.isArray(o.i)) {
      s.inv = s.inv.map(function (_, k) {
        var e = o.i[k];
        if (!Array.isArray(e) || !C.ITEMS[e[0]]) return null;
        var n = int(e[1], 1, L.stackLimit(e[0]), 0);
        return n ? { id: e[0], n: n } : null;
      });
    }
    s.box = (Array.isArray(o.b) ? o.b : []).filter(function (e) {
      return Array.isArray(e) && C.ITEMS[e[0]] && C.ITEMS[e[0]].sell;
    }).map(function (e) { return { id: e[0], n: int(e[1], 1, 1e4, 1) }; });
    s.soil = {};
    (Array.isArray(o.f) ? o.f : []).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var idx = int(e[0], 0, 1e6, -1);
      if (idx < 0) return;
      var crop = C.CROP_KEYS[int(e[2], 0, 1e6, 0) - 1] || null;
      s.soil[idx] = { w: e[1] ? 1 : 0, c: crop, d: crop ? int(e[3], 0, C.CROPS[crop].days, 0) : 0 };
    });
    // saves from before animals existed simply have none
    s.animals = (Array.isArray(o.a) ? o.a : []).filter(function (e) {
      return Array.isArray(e) && C.ANIMAL_KEYS[e[0]];
    }).map(function (e) {
      var kind = C.ANIMAL_KEYS[e[0]];
      var name = typeof e[5] === 'string' && e[5] ? e[5].slice(0, 16) : C.ANIMALS[kind].names[0];
      return { kind: kind, name: name, love: int(e[1], 0, C.LOVE.max, 0), fed: e[2] ? 1 : 0, pet: e[3] ? 1 : 0, ready: e[4] ? 1 : 0 };
    });
    C.ANIMAL_KEYS.forEach(function (kind) { // never more than a building holds
      var seen = 0;
      s.animals = s.animals.filter(function (a) { return a.kind !== kind || ++seen <= C.ANIMALS[kind].max; });
    });
    if (Array.isArray(o.p) && o.p.length === 3) {
      s.player = { x: int(o.p[0], 0, 1e5, 0), y: int(o.p[1], 0, 1e5, 0), dir: DIRS[int(o.p[2], 0, 3, 0)] };
    }
    return s;
  };

  F.Logic = L;
})(window.Farm = window.Farm || {});
