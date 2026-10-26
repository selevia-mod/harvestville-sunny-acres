// Pure game rules: state, inventory, calendar, weather, tools, field, crops, animals, food, fishing, mine,
// villagers, buildings, festivals, marriage, and the save format. No Phaser in here, so it can be
// unit-tested in Node.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = {};

  // ---------- small helpers ----------
  // Deterministic hash -> [0, 1). Weather, debris, forage spots and mine floors all come from it,
  // so they are the same every time for the same farm.
  L.rand = function () {
    var h = 2166136261;
    for (var i = 0; i < arguments.length; i++) {
      h ^= (arguments[i] | 0) + 0x9e3779b9;
      h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
    }
    return (h >>> 0) / 4294967296;
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // A seeded shuffle of a copy of list.
  L.shuffle = function (list, a, b, c) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(L.rand(a, b, c, i) * (i + 1));
      var t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  };

  // info.fieldTiles: farm tile indexes of tillable field (used for debris and weeds).
  L.newState = function (info) {
    var now = info && info.now != null ? info.now : L.clock();
    var s = {
      day: L.dayOf(now), // today, as a day number (see the calendar below)
      start: L.dayOf(now), // the day the farm started
      time: L.minuteOf(now), // the phone's clock, minutes after midnight
      regen: Math.floor(now / 60000), // when energy last came back (minutes)
      gold: C.START_GOLD,
      energy: C.MAX_ENERGY,
      water: C.TOOLS.can.capacity[0],
      map: 'farm',
      player: { x: null, y: null, dir: 'down' }, // feet position in world px; null = map spawn
      sel: 0,
      inv: [],
      box: [], // items in the shipping box, paid out overnight: [{ id, n }]
      soil: {}, // farm tile index -> { w: watered 0|1 (grows faster), c: crop key or null, p: planted (minutes), r: regrowing }
      animals: [], // see L.addAnimal
      seed: Math.floor(Math.random() * 1e9),
      tools: { hoe: 0, can: 0, axe: 0, hammer: 0, sickle: 0 },
      lumber: 0,
      stone: 0,
      debris: {}, // farm tile index -> debris key
      friends: {}, // villager -> { pts, talked, gifted, met }
      builds: {}, // build key -> 1 once finished
      project: null, // { id, done: day it finishes }
      inc: 0, // days left on the egg in the incubator (0 = empty)
      dog: { name: C.DOG.name, love: 0, pet: 0 },
      forage: {}, // map -> { day, taken: [spot numbers] }
      fest: {}, // festival key -> last year joined
      spouse: null,
      engaged: null, // { who, day: wedding day }
      opts: { music: 1, sfx: 1 },
    };
    for (var i = 0; i < C.INV_SIZE; i++) s.inv.push(null);
    C.START_ITEMS.forEach(function (it) { L.addItem(s, it[0], it[1]); });
    C.START_ANIMALS.forEach(function (kind) { L.addAnimal(s, kind); });
    if (info && info.fieldTiles) s.debris = L.makeDebris(s.seed, info.fieldTiles);
    return s;
  };

  // ---------- inventory ----------
  L.stackLimit = function (id) {
    return C.ITEMS[id].kind === 'tool' ? 1 : C.MAX_STACK;
  };

  L.countItem = function (s, id) {
    return s.inv.reduce(function (sum, slot) { return sum + (slot && slot.id === id ? slot.n : 0); }, 0);
  };

  L.hasItem = function (s, id) {
    return L.countItem(s, id) > 0;
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

  // Removes n of an item from anywhere in the bag; returns how many were removed.
  L.removeItem = function (s, id, n) {
    var left = n;
    for (var i = 0; i < s.inv.length && left > 0; i++) {
      if (s.inv[i] && s.inv[i].id === id) left -= L.removeAt(s, i, left);
    }
    return n - left;
  };

  L.held = function (s) {
    return s.inv[s.sel] || null;
  };

  // The icon for an item, taking tool upgrades into account.
  L.iconOf = function (s, id) {
    var item = C.ITEMS[id], lvl = item.tool ? s.tools[item.tool] || 0 : 0;
    return lvl ? C.ICON[id + '_' + lvl] : item.icon;
  };

  L.itemName = function (s, id) {
    var item = C.ITEMS[id], lvl = item.tool ? s.tools[item.tool] || 0 : 0;
    return lvl ? C.TOOL_LEVELS[lvl] + ' ' + item.name : item.name;
  };

  // ---------- real time and the calendar ----------
  // The game runs on the phone's clock, or the app's if it offers one (window.gameHost.now(), e.g. server time).
  L.clock = function () {
    var h = typeof window !== 'undefined' && window.gameHost;
    var t = h && typeof h.now === 'function' ? Number(h.now()) : NaN;
    return isFinite(t) && t > 0 ? t : Date.now();
  };
  L.nowMin = function () { return Math.floor(L.clock() / 60000); };

  // A day is a day number: the phone's local date counted from 1 Jan 1970.
  L.dayOf = function (ms) {
    var d = new Date(ms);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  };
  L.minuteOf = function (ms) {
    var d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  };

  // Seasons follow the real months: Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov, Winter Dec-Feb.
  L.date = function (day) {
    var d = new Date(day * 864e5), month = d.getUTCMonth() + 1, season = C.SEASON_OF_MONTH[month - 1];
    return {
      season: season,
      key: C.SEASONS[season].key,
      name: C.SEASONS[season].name,
      day: d.getUTCDate(),
      month: month,
      monthName: C.MONTHS[month - 1],
      year: d.getUTCFullYear(),
      weekday: d.getUTCDay(), // 0 Sunday .. 6 Saturday
    };
  };

  // The season a festival falls in (by its month).
  L.festSeason = function (f) { return C.SEASONS[C.SEASON_OF_MONTH[f.date[0] - 1]].key; };

  L.formatDate = function (day) {
    var d = L.date(day);
    return d.monthName.slice(0, 3) + ' ' + d.day;
  };

  L.cropInSeason = function (crop, day) {
    return C.CROPS[crop].seasons.indexOf(L.date(day).key) >= 0;
  };

  L.seasonName = function (key) {
    return C.SEASONS.filter(function (x) { return x.key === key; })[0].name;
  };

  L.seasonsOf = function (crop) {
    return C.CROPS[crop].seasons.map(L.seasonName).join(', ').replace(/, ([^,]*)$/, ' and $1');
  };

  // Seed items the shop sells today.
  L.seedsInSeason = function (day) {
    return C.SHOP_STOCK.filter(function (id) { return L.cropInSeason(C.ITEMS[id].crop, day); });
  };

  // Festivals and birthdays are on fixed real dates, the same day for every player.
  L.festivalOn = function (day) {
    var d = L.date(day);
    return C.FESTIVALS.filter(function (f) { return f.date[0] === d.month && f.date[1] === d.day; })[0] || null;
  };

  // The festival happening right now (today, within its hours), if any.
  L.festivalNow = function (s) {
    var f = L.festivalOn(s.day);
    return f && s.time >= f.from && s.time < f.to ? f : null;
  };

  L.birthdaysOn = function (day) {
    var d = L.date(day);
    return C.VILLAGER_ORDER.filter(function (k) {
      var b = C.VILLAGERS[k].birthday;
      return b[0] === d.month && b[1] === d.day;
    });
  };

  // ---------- weather ----------
  // The same weather for every player on a given day (and always sunny on a new farm's first day).
  L.weather = function (s, day) {
    if ((s && day === s.start) || L.festivalOn(day)) return 'sunny';
    var odds = C.WEATHER_ODDS[L.date(day).key], r = L.rand(20261026, day, 77), acc = 0;
    var keys = Object.keys(odds);
    for (var i = 0; i < keys.length; i++) {
      acc += odds[keys[i]];
      if (r < acc) return keys[i];
    }
    return 'sunny';
  };

  // ---------- tools ----------
  L.toolLevel = function (s, tool) {
    return s.tools[tool] || 0;
  };

  L.canCapacity = function (s) {
    return C.TOOLS.can.capacity[L.toolLevel(s, 'can')];
  };

  // Energy for using a tool on n tiles at its current level.
  L.toolEnergy = function (s, tool, n) {
    var per = C.TOOLS[tool].energy * C.TOOL_ENERGY_SCALE[L.toolLevel(s, tool)];
    return Math.max(1, Math.round(per * (n || 1)));
  };

  // Tiles a charged swing covers. (fx, fy) = the tile in front of the farmer, (dx, dy) = facing.
  // Level 0: 1 tile. 1: a line of 3. 2: a 3x3 patch. 3: 3 wide and 5 deep.
  L.chargeTiles = function (fx, fy, dx, dy, level) {
    var depth = [1, 3, 3, 5][level], half = level >= 2 ? 1 : 0, out = [];
    var px = -dy, py = dx; // perpendicular
    for (var d = 0; d < depth; d++) {
      for (var w = -half; w <= half; w++) out.push([fx + dx * d + px * w, fy + dy * d + py * w]);
    }
    return out;
  };

  L.upgradeCost = function (s, tool) {
    var lvl = L.toolLevel(s, tool);
    return lvl >= C.TOOL_LEVELS.length - 1 ? null : C.UPGRADES[lvl];
  };

  L.upgradeTool = function (s, tool) {
    var cost = L.upgradeCost(s, tool);
    if (!cost) return 'max';
    if (s.gold < cost.gold) return 'gold';
    if (L.countItem(s, cost.ore) < cost.n) return 'ore';
    s.gold -= cost.gold;
    L.removeItem(s, cost.ore, cost.n);
    s.tools[tool] += 1;
    if (tool === 'can') s.water = L.canCapacity(s);
    return 'ok';
  };

  // ---------- field debris ----------
  L.makeDebris = function (seed, fieldTiles) {
    var out = {};
    fieldTiles.forEach(function (idx) {
      var r = L.rand(seed, idx, 5), acc = 0;
      for (var k = 0; k < C.DEBRIS_KEYS.length; k++) {
        acc += C.DEBRIS_START[C.DEBRIS_KEYS[k]];
        if (r < acc) {
          out[idx] = C.DEBRIS_KEYS[k];
          break;
        }
      }
    });
    return out;
  };

  // Swings a tool needs to clear a debris tile: 0 = this tool level can't, -1 = wrong tool.
  L.debrisHits = function (s, kind, tool) {
    var def = C.DEBRIS[kind];
    if (def.tool !== tool) return -1;
    return def.hits[L.toolLevel(s, tool)];
  };

  // Removes debris and pays out its materials.
  L.clearDebris = function (s, idx) {
    var kind = s.debris[idx];
    if (!kind) return null;
    delete s.debris[idx];
    var def = C.DEBRIS[kind];
    s.lumber += def.lumber || 0;
    s.stone += def.stone || 0;
    return { kind: kind, lumber: def.lumber || 0, stone: def.stone || 0 };
  };

  // ---------- soil & crops ----------
  // FarmVille style: a crop grows in real time from the minute it is planted (t.p, in minutes); watered soil
  // (t.w) grows it C.GROW.boost faster. Ripe, it waits as long again as it grew (at least C.GROW.witherMin
  // minutes), then withers: clear it with the Hoe. Stages: 0 seeds, 1 sprout, 2 growing, 3 ripe, 4 withered.
  L.growMins = function (t) {
    var crop = C.CROPS[t.c], mins = t.r && crop.regrow ? crop.regrow : crop.mins;
    return mins * (t.w ? 1 - C.GROW.boost : 1);
  };
  L.witherMins = function (t) {
    return Math.max(C.CROPS[t.c].mins * C.GROW.wither, C.GROW.witherMin);
  };

  L.cropStage = function (tile, now) {
    if (!tile || !tile.c) return -1;
    if (now == null) now = L.nowMin();
    var grow = L.growMins(tile), el = now - tile.p;
    if (el >= grow) return el >= grow + L.witherMins(tile) && !C.CROPS[tile.c].sickle ? 4 : 3;
    if (el < grow * 0.25) return 0;
    return el < grow * 0.5 ? 1 : 2;
  };

  // Minutes until a growing crop is ripe (0 when ripe), or until a ripe one withers.
  L.cropLeft = function (tile, now) {
    if (!tile || !tile.c) return 0;
    if (now == null) now = L.nowMin();
    var grow = L.growMins(tile), el = now - tile.p;
    return el < grow ? Math.ceil(grow - el) : Math.max(0, Math.ceil(grow + L.witherMins(tile) - el));
  };

  L.isRipe = function (tile, now) {
    return L.cropStage(tile, now) === 3;
  };
  L.isWithered = function (tile, now) {
    return L.cropStage(tile, now) === 4;
  };

  // Tills a tile, or clears a withered crop off one.
  L.till = function (s, idx) {
    if (s.debris[idx]) return 'debris';
    var t = s.soil[idx];
    if (t && L.isWithered(t)) {
      t.c = null;
      t.p = 0;
      t.r = 0;
      return 'cleared';
    }
    if (t) return 'already';
    // on a rainy day, freshly tilled soil is already wet
    s.soil[idx] = { w: C.WEATHER[L.weather(s, s.day)].waters ? 1 : 0, c: null, p: 0, r: 0 };
    return 'ok';
  };

  // Watering: the crop on it (or the next one planted) grows faster.
  L.water = function (s, idx) {
    var t = s.soil[idx];
    if (!t) return 'nosoil';
    if (t.w || L.cropStage(t) >= 3) return 'already';
    if (s.water <= 0) return 'empty';
    t.w = 1;
    s.water -= 1;
    return 'ok';
  };

  L.refill = function (s) {
    s.water = L.canCapacity(s);
  };

  // A seed bag plants every tilled, empty tile in idxs (the 3x3 around the target). Returns how many
  // were planted, or 'noseed' / 'season' / 'nospace'.
  L.plantBag = function (s, idxs, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || C.ITEMS[slot.id].kind !== 'seed') return 'noseed';
    var crop = C.ITEMS[slot.id].crop;
    if (!L.cropInSeason(crop, s.day)) return 'season';
    var n = 0, now = L.nowMin();
    idxs.forEach(function (idx) {
      var t = s.soil[idx];
      if (t && !t.c) {
        t.c = crop;
        t.p = now;
        t.r = 0;
        n++;
      }
    });
    if (!n) return 'nospace';
    L.removeAt(s, slotIndex, 1);
    return n;
  };

  // Old single-tile planting, kept for callers that plant one tile.
  L.plant = function (s, idx, slotIndex) {
    var r = L.plantBag(s, [idx], slotIndex);
    if (typeof r === 'number') return 'ok';
    if (r === 'nospace') return s.soil[idx] ? 'occupied' : 'nosoil';
    return r;
  };

  // Picks a ripe crop by hand. Returns the item id, or an error string starting with '!'.
  L.harvest = function (s, idx) {
    var t = s.soil[idx];
    if (!L.isRipe(t)) return '!notripe';
    var crop = C.CROPS[t.c];
    if (crop.sickle) return '!sickle';
    return pick(s, t, crop);
  };

  // Cuts ripe grass with the sickle into fodder.
  L.cut = function (s, idx) {
    var t = s.soil[idx];
    if (!L.isRipe(t) || !C.CROPS[t.c].sickle) return '!notripe';
    return pick(s, t, C.CROPS[t.c]);
  };

  // A picked crop leaves the soil as it was (watering lasts for one crop); grass grows back.
  function pick(s, t, crop) {
    if (L.addItem(s, crop.item, 1) > 0) return '!full';
    t.w = 0;
    if (crop.regrow) {
      t.p = L.nowMin();
      t.r = 1;
    } else {
      t.c = null;
      t.p = 0;
      t.r = 0;
    }
    return crop.item;
  }

  // ---------- energy ----------
  // It comes back by itself, a point every C.ENERGY_EVERY minutes (also while the game is closed).
  L.regen = function (s, now) {
    if (now == null) now = L.nowMin();
    var max = L.maxEnergy ? L.maxEnergy(s) : C.MAX_ENERGY;
    if (!s.regen || s.regen > now || s.energy >= max) { s.regen = now; return 0; }
    var n = Math.floor((now - s.regen) / C.ENERGY_EVERY);
    if (n <= 0) return 0;
    var add = Math.min(n, max - s.energy);
    s.energy += add;
    s.regen = s.energy >= max ? now : s.regen + n * C.ENERGY_EVERY;
    return add;
  };

  L.spendEnergy = function (s, amount) {
    if (s.energy < amount) return false;
    s.energy -= amount;
    return true;
  };

  // ---------- food ----------
  L.energyOf = function (id) {
    return C.ITEMS[id].energy || 0;
  };

  L.eat = function (s, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || !L.energyOf(slot.id)) return 0;
    if (s.energy >= L.maxEnergy(s)) return -1;
    var gain = Math.min(L.energyOf(slot.id), L.maxEnergy(s) - s.energy);
    s.energy += gain;
    L.removeAt(s, slotIndex, 1);
    return gain;
  };

  // The items that satisfy one ingredient (a group name or an item id).
  L.ingredientItems = function (need) {
    return C.FOOD_GROUPS[need] || [need];
  };

  L.ingredientName = function (need) {
    return C.FOOD_GROUPS[need] ? need.charAt(0).toUpperCase() + need.slice(1) : C.ITEMS[need].name;
  };

  L.hasIngredients = function (s, recipe) {
    var counts = {};
    return recipe.needs.every(function (need) {
      var item = L.ingredientItems(need).filter(function (id) { return L.countItem(s, id) - (counts[id] || 0) > 0; })[0];
      if (!item) return false;
      counts[item] = (counts[item] || 0) + 1;
      return true;
    });
  };

  L.cook = function (s, recipe) {
    if (!s.builds.kitchen) return 'nokitchen';
    if (!L.hasIngredients(s, recipe)) return 'missing';
    var used = recipe.needs.map(function (need) {
      return L.ingredientItems(need).filter(function (id) { return L.hasItem(s, id); })[0];
    });
    used.forEach(function (id) { L.removeItem(s, id, 1); });
    if (L.addItem(s, recipe.dish, 1) > 0) { // no room: put the ingredients back
      used.forEach(function (id) { L.addItem(s, id, 1); });
      return 'full';
    }
    return 'ok';
  };

  // ---------- fishing, foraging, mine ----------
  // r = a random number in [0, 1). Returns the fish id, or '!full'.
  L.catchFish = function (s, water, r) {
    var table = C.FISH_TABLE[water] || C.FISH_TABLE.pond, acc = 0, fish = 'fish_s';
    var keys = Object.keys(table);
    for (var i = 0; i < keys.length; i++) {
      acc += table[keys[i]];
      if (r < acc) {
        fish = keys[i];
        break;
      }
    }
    if (L.addItem(s, fish, 1) > 0) return '!full';
    return fish;
  };

  L.forageItem = function (day) {
    return C.FORAGE[L.date(day).key];
  };

  // Which of the candidate tiles hold forage today (deterministic per farm, day and map).
  L.forageSpots = function (s, map, candidates) {
    var n = C.FORAGE_COUNT[map] || 0;
    return L.shuffle(candidates, s.seed, s.day, map.length * 31 + map.charCodeAt(0)).slice(0, n);
  };

  L.forageTaken = function (s, map) {
    var f = s.forage[map];
    return f && f.day === s.day ? f.taken : [];
  };

  L.takeForage = function (s, map, spot) {
    var item = L.forageItem(s.day);
    if (L.addItem(s, item, 1) > 0) return '!full';
    if (!s.forage[map] || s.forage[map].day !== s.day) s.forage[map] = { day: s.day, taken: [] };
    s.forage[map].taken.push(spot);
    return item;
  };

  // A mine floor: which tiles have rocks and which rock hides the ladder down.
  L.mineFloor = function (s, floor, floorTiles) {
    var rocks = floorTiles.filter(function (idx) { return L.rand(s.seed, s.day, floor, idx) < C.MINE.rocks; });
    if (!rocks.length) rocks = floorTiles.slice(0, 1);
    var stairs = rocks[Math.floor(L.rand(s.seed, s.day, floor, 999) * rocks.length)];
    return { rocks: rocks, stairs: stairs };
  };

  // What a broken mine rock drops (r in [0, 1)), or null.
  L.mineDrop = function (floor, r) {
    var acc = 0, drops = C.MINE.drops;
    for (var i = 0; i < drops.length; i++) {
      if (floor < (drops[i].minFloor || 0)) continue;
      acc += drops[i].p;
      if (r < acc) return drops[i].id;
    }
    return null;
  };

  // ---------- animals ----------
  L.capacity = function (s, kind) {
    var big = kind === 'chicken' ? s.builds.coop2 : s.builds.barn2;
    return C.ANIMALS[kind].max * (big ? 2 : 1);
  };

  L.animalCount = function (s, kind) {
    return s.animals.filter(function (a) { return a.kind === kind; }).length;
  };

  // Free places in the coop / barn, counting eggs in the incubator and calves on the way.
  L.space = function (s, kind) {
    var pending = kind === 'chicken' ? (s.inc ? 1 : 0)
      : s.animals.filter(function (a) { return a.preg && a.kind === kind; }).length;
    return L.capacity(s, kind) - L.animalCount(s, kind) - pending;
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

  // young = days until a chick or calf is grown (0 = adult); preg = days until a calf is born.
  L.addAnimal = function (s, kind, young) {
    s.animals.push({ kind: kind, name: L.nextName(s, kind), love: 0, fed: 0, pet: 0, ready: 0, brushed: 0, young: young || 0, preg: 0 });
    return s.animals.length - 1;
  };

  // Returns the new animal's index, or 'gold' / 'full'.
  L.buyAnimal = function (s, kind) {
    var def = C.ANIMALS[kind];
    if (L.space(s, kind) <= 0) return 'full';
    if (s.gold < def.price) return 'gold';
    s.gold -= def.price;
    return L.addAnimal(s, kind);
  };

  function addLove(a, n) {
    a.love = clamp(a.love + n, 0, C.LOVE.max);
  }

  L.hearts = function (a) {
    return Math.floor(a.love / 20);
  };

  L.feedAnimal = function (s, i, slotIndex) {
    var a = s.animals[i], slot = s.inv[slotIndex];
    if (!slot || C.ITEMS[slot.id].kind !== 'feed') return 'nofeed';
    if (C.ANIMALS[a.kind].feed !== slot.id) return 'wrong';
    if (a.young) return 'young';
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

  L.brushAnimal = function (s, i) {
    var a = s.animals[i];
    if (!L.hasItem(s, 'brush')) return 'nobrush';
    if (a.brushed) return 'already';
    a.brushed = 1;
    addLove(a, C.LOVE.brush);
    return 'ok';
  };

  // Returns the collected item id, or an error string starting with '!'. Cows and carabaos need the milker.
  L.collect = function (s, i) {
    var a = s.animals[i];
    if (!a.ready) return '!notready';
    if (C.ANIMALS[a.kind].milk && !L.hasItem(s, 'milker')) return '!milker';
    var def = C.ANIMALS[a.kind], item = a.ready === 2 ? def.large : def.product;
    if (L.addItem(s, item, 1) > 0) return '!full';
    a.ready = 0;
    return item;
  };

  // Puts an egg from the bag into the incubator; a chick hatches in a few days.
  L.incubate = function (s, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || C.FOOD_GROUPS.egg.indexOf(slot.id) < 0) return 'noegg';
    if (s.inc) return 'busy';
    if (L.space(s, 'chicken') <= 0) return 'full';
    L.removeAt(s, slotIndex, 1);
    s.inc = C.INCUBATE_DAYS;
    return 'ok';
  };

  L.givePotion = function (s, i, slotIndex) {
    var a = s.animals[i], slot = s.inv[slotIndex];
    if (!slot || slot.id !== 'miracle') return 'nopotion';
    if (a.kind !== 'cow') return 'notcow';
    if (a.young) return 'young';
    if (a.preg) return 'already';
    if (a.love < C.LOVE.potion) return 'love';
    if (L.space(s, 'cow') <= 0) return 'full';
    L.removeAt(s, slotIndex, 1);
    a.preg = C.PREGNANT_DAYS;
    return 'ok';
  };

  L.petDog = function (s) {
    if (s.dog.pet) return 'already';
    s.dog.pet = 1;
    s.dog.love = clamp(s.dog.love + C.LOVE.pet, 0, C.LOVE.max);
    return 'ok';
  };

  // ---------- villagers ----------
  L.friend = function (s, key) {
    if (!s.friends[key]) s.friends[key] = { pts: 0, talked: 0, gifted: 0, met: 0 };
    return s.friends[key];
  };

  L.friendHearts = function (s, key) {
    return Math.floor(L.friend(s, key).pts / 10);
  };

  function addFriend(s, key, n) {
    var f = L.friend(s, key);
    f.pts = clamp(f.pts + n, 0, C.FRIEND.max);
  }
  L.addFriend = addFriend;

  // A line of dialogue for today, and friendship for chatting (once a day).
  L.talk = function (s, key) {
    var f = L.friend(s, key), D = C.DIALOGUE[key], line;
    var first = !f.met;
    if (first) {
      f.met = 1;
      line = D.intro;
    } else if (s.spouse === key && D.spouse.length) {
      line = D.spouse[s.day % D.spouse.length];
    } else if (L.birthdaysOn(s.day).indexOf(key) >= 0) {
      line = "It's my birthday today!";
    } else if (C.WEATHER[L.weather(s, s.day)].waters && (s.day % 2)) {
      line = D.rain;
    } else {
      var tier = D.tiers[Math.min(3, Math.floor(L.friendHearts(s, key) / 3))];
      line = tier[(s.day + C.VILLAGER_ORDER.indexOf(key)) % tier.length];
    }
    if (!f.talked) {
      f.talked = 1;
      addFriend(s, key, C.FRIEND.talk);
    }
    return { line: line, first: first };
  };

  L.giftable = function (id) {
    var k = C.ITEMS[id].kind;
    return k !== 'tool' && k !== 'seed' && k !== 'feather' && k !== 'potion';
  };

  L.reaction = function (key, id) {
    var v = C.VILLAGERS[key];
    if (v.loves.indexOf(id) >= 0) return 'love';
    if (v.likes.indexOf(id) >= 0) return 'like';
    if (v.dislikes.indexOf(id) >= 0) return 'dislike';
    return 'neutral';
  };

  // Gives the held item as a gift (once a day per villager; birthdays count double).
  L.giveGift = function (s, key, slotIndex) {
    var slot = s.inv[slotIndex], f = L.friend(s, key);
    if (!slot || !L.giftable(slot.id)) return { error: 'nogift' };
    if (f.gifted) return { error: 'already' };
    var reaction = L.reaction(key, slot.id), pts = C.FRIEND[reaction];
    var birthday = L.birthdaysOn(s.day).indexOf(key) >= 0;
    if (birthday && pts > 0) pts *= C.FRIEND.birthday;
    L.removeAt(s, slotIndex, 1);
    f.gifted = 1;
    f.met = 1;
    addFriend(s, key, pts);
    var D = C.DIALOGUE[key];
    return { reaction: reaction, pts: pts, line: birthday && pts > 0 ? D.birthday : D.gift[reaction] };
  };

  // Where a villager is at a time: a place name on the town map, 'in:<building>', 'away', or 'home'
  // (in the farmhouse, once married).
  L.villagerAt = function (s, key, time) {
    var fest = L.festivalOn(s.day);
    if (fest && time >= fest.from - 30 && time < fest.to) return 'fest_' + C.VILLAGER_ORDER.indexOf(key);
    var v = C.VILLAGERS[key];
    if (s.spouse === key) {
      if (time < 9 * 60 || time >= 18 * 60) return 'home';
      var job = v.schedule.filter(function (e) { return e[1] === 'away' || e[1] === 'dock' || e[1] === 'in:' + v.home; })[0];
      return job ? job[1] : 'home';
    }
    var at = v.schedule[0][1];
    v.schedule.forEach(function (e) { if (time >= e[0]) at = e[1]; });
    return at;
  };

  // Lily runs the seed stand on the farm during the day.
  // (The stand keeps shop hours, early to late; when Lily is in town, her helper minds it.)
  L.lilyAtStand = function (s) {
    return L.shopOpen(s);
  };

  // ---------- town services ----------
  L.buildingOpen = function (s, key) {
    var b = C.BUILDINGS[key];
    if (!b.open || L.festivalOn(s.day)) return false;
    return s.time >= b.open[0] && s.time < b.open[1];
  };

  L.startBuild = function (s, id) {
    var b = C.BUILDS[id];
    if (s.builds[id]) return 'built';
    if (s.project) return 'busy';
    if (s.gold < b.gold) return 'gold';
    if (s.lumber < b.lumber) return 'lumber';
    if (s.stone < b.stone) return 'stone';
    s.gold -= b.gold;
    s.lumber -= b.lumber;
    s.stone -= b.stone;
    s.project = { id: id, done: s.day + 1 };
    return 'ok';
  };

  L.buyMaterial = function (s, kind, n) {
    var price = (kind === 'lumber' ? C.LUMBER_PRICE : C.STONE_PRICE) * n;
    if (s.gold < price) return 'gold';
    s.gold -= price;
    s[kind] += n;
    return 'ok';
  };

  // ---------- festivals ----------
  L.joinedFestival = function (s, fest) {
    return s.fest[fest.key] === L.date(s.day).year;
  };

  // Plays the festival. choice: a villager key (dance / date) or an inventory slot (harvest).
  // Returns { text, gold } or { error }.
  L.joinFestival = function (s, fest, choice) {
    if (L.joinedFestival(s, fest)) return { error: 'joined' };
    var out = { gold: 0 };
    if (fest.kind === 'dance' || fest.kind === 'date') {
      if (!C.VILLAGERS[choice]) return { error: 'choice' };
      var pts = s.spouse === choice ? 15 : 10;
      addFriend(s, choice, pts);
      L.friend(s, choice).met = 1;
      var who = C.VILLAGERS[choice].name;
      out.text = fest.kind === 'dance'
        ? 'You dance with ' + who + ' among the flowers. Everyone cheers!'
        : 'You spend the evening with ' + who + '. A night to remember.';
      out.friend = choice;
    } else if (fest.kind === 'harvest') {
      var slot = s.inv[choice];
      if (!slot || C.ITEMS[slot.id].kind !== 'crop') return { error: 'nocrop' };
      var value = C.ITEMS[slot.id].sell, place = value >= 25 ? 1 : value >= 12 ? 2 : 3; // a day's crop or more wins; 4 hours' places
      out.gold = [0, 1000, 500, 200][place];
      out.place = place;
      out.text = 'The judges taste your ' + C.ITEMS[slot.id].name + '... ' + ['', '1st place', '2nd place', '3rd place'][place] + '! You win ' + out.gold + 'G.';
      L.removeAt(s, choice, 1);
      C.VILLAGER_ORDER.forEach(function (k) { addFriend(s, k, 2); });
    } else if (fest.kind === 'cow') {
      var cows = s.animals.filter(function (a) { return a.kind === 'cow' && !a.young; });
      if (!cows.length) return { error: 'nocow' };
      var best = cows.reduce(function (a, b) { return b.love > a.love ? b : a; });
      var h = L.hearts(best), rank = h >= 4 ? 1 : h >= 2 ? 2 : 3;
      out.gold = [0, 1500, 600, 200][rank];
      out.place = rank;
      out.text = best.name + ' wins ' + ['', 'the blue ribbon', '2nd place', '3rd place'][rank] + '! You get ' + out.gold + 'G.';
      if (rank === 1) addLove(best, 10);
    }
    s.gold += out.gold;
    s.fest[fest.key] = L.date(s.day).year;
    return out;
  };

  // ---------- marriage ----------
  // Why the farmer can't propose to someone yet (or null if they can).
  L.proposeBlock = function (s, key) {
    if (!C.VILLAGERS[key].candidate) return 'notcandidate';
    if (s.spouse || s.engaged) return 'taken';
    if (!s.builds.bighouse) return 'house';
    if (L.friend(s, key).pts < C.FRIEND.marry) return 'hearts';
    return null;
  };

  // Shows the Blue Feather (held in slotIndex). Returns 'yes' or the reason it was refused.
  L.propose = function (s, key, slotIndex) {
    var slot = s.inv[slotIndex];
    if (!slot || slot.id !== 'blue_feather') return 'nofeather';
    var block = L.proposeBlock(s, key);
    if (block) return block;
    L.removeAt(s, slotIndex, 1);
    var day = s.day + C.WEDDING_DELAY;
    while (L.festivalOn(day)) day++;
    s.engaged = { who: key, day: day };
    return 'yes';
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
    return s.time >= C.SHOP_OPEN && s.time < C.SHOP_CLOSE && !L.festivalOn(s.day);
  };

  // How long until something, in words: '7 min', '2 h 5 min', '1 day 3 h'.
  L.formatLeft = function (mins) {
    mins = Math.max(1, Math.ceil(mins));
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + ' h' + (m ? ' ' + m + ' min' : '');
    var d = Math.floor(h / 24), hh = h % 24;
    return d + (d > 1 ? ' days' : ' day') + (hh ? ' ' + hh + ' h' : '');
  };

  L.formatTime = function (minutes) {
    var m = Math.floor(minutes) % (24 * 60);
    var h = Math.floor(m / 60), mm = Math.floor((m % 60) / 10) * 10;
    var ampm = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ampm;
  };

  // Ends the day: crops grow, animals produce and grow up, the shipping box pays out, projects finish,
  // weeds sprout at a new season, the weather waters the field, weddings happen.
  // info.fieldTiles (optional): tillable farm tiles, for new weeds.
  // A new day, at the phone's midnight (see L.catchUp, which runs this once for each day that went by).
  // Crops are not touched: they grow by the clock.
  L.endDay = function (s, passedOut, info) {

    var hungry = [], produced = {}, born = [];
    s.animals.forEach(function (a) {
      if (a.young) {
        a.young -= 1;
      } else if (a.fed) {
        a.ready = a.love >= C.LOVE.large ? 2 : 1;
        var item = a.ready === 2 ? C.ANIMALS[a.kind].large : C.ANIMALS[a.kind].product;
        produced[item] = (produced[item] || 0) + 1;
      } else {
        addLove(a, C.LOVE.hungry);
        hungry.push(a.name);
      }
      if (!a.pet) addLove(a, C.LOVE.lonely);
      if (a.preg) {
        a.preg -= 1;
        if (!a.preg) born.push(L.addAnimal(s, 'cow', C.ANIMALS.cow.grow));
      }
      a.fed = 0;
      a.pet = 0;
      a.brushed = 0;
    });
    if (s.inc) {
      s.inc -= 1;
      if (!s.inc) born.push(L.addAnimal(s, 'chicken', C.ANIMALS.chicken.grow));
    }
    if (!s.dog.pet) s.dog.love = clamp(s.dog.love - 1, 0, C.LOVE.max);
    s.dog.pet = 0;

    C.VILLAGER_ORDER.forEach(function (k) {
      if (s.friends[k]) {
        s.friends[k].talked = 0;
        s.friends[k].gifted = 0;
      }
    });

    var earned = L.boxValue(s);
    var shipped = s.box;
    s.gold += earned;
    s.box = [];

    var before = L.date(s.day);
    s.day += 1;
    var now = L.date(s.day);
    var withered = 0, weeds = 0;
    if (now.season !== before.season) {
      Object.keys(s.debris).forEach(function (idx) { if (s.debris[idx] === 'weed' && now.key === 'winter') delete s.debris[idx]; });
      if (now.key !== 'winter' && info && info.fieldTiles) {
        L.shuffle(info.fieldTiles, s.seed, s.day, 3).forEach(function (idx) {
          if (weeds < C.WEEDS_PER_SEASON && !s.soil[idx] && !s.debris[idx]) {
            s.debris[idx] = 'weed';
            weeds++;
          }
        });
      }
    }

    var built = null;
    if (s.project && s.day >= s.project.done) {
      built = s.project.id;
      s.builds[built] = 1;
      s.project = null;
    }

    // rain waters the whole field (growing crops speed up)
    var weather = L.weather(s, s.day);
    if (C.WEATHER[weather].waters) Object.keys(s.soil).forEach(function (idx) { if (L.cropStage(s.soil[idx]) < 3) s.soil[idx].w = 1; });

    var wedding = null, lunch = null;
    if (s.engaged && s.day >= s.engaged.day) {
      wedding = s.engaged.who;
      s.spouse = wedding;
      s.engaged = null;
      L.friend(s, wedding).pts = C.FRIEND.max;
    } else if (s.spouse && s.day % 3 === 0) {
      var dishes = ['boiled_egg', 'baked_potato', 'sandwich', 'hot_soup'];
      lunch = dishes[s.day % dishes.length];
      if (L.addItem(s, lunch, 1) > 0) lunch = null;
    }

    return {
      earned: earned, shipped: shipped, passedOut: !!passedOut, hungry: hungry, produced: produced, born: born,
      newSeason: now.season !== before.season ? now.name : null, withered: withered, weeds: weeds,
      built: built, weather: weather, wedding: wedding, lunch: lunch,
      festival: L.festivalOn(s.day), birthdays: L.birthdaysOn(s.day),
    };
  };

  // ---------- save format ----------
  // Compact on purpose: the save must stay well under 16 KB of JSON.
  var DIRS = ['down', 'up', 'left', 'right'];
  var MAPS = ['farm', 'house', 'town', 'mine'];

  // Soil is saved in groups of tiles that are alike: [crop + 1 (0 = none), planted minute (relative to today),
  // watered + 2 x regrowing, tile, tile, ...]. A seed bag plants 9 tiles at the same minute, so they share one.
  function soilGroups(s) {
    var groups = {}, base = s.day * 1440;
    Object.keys(s.soil).forEach(function (idx) {
      var t = s.soil[idx], c = t.c ? C.CROP_KEYS.indexOf(t.c) + 1 : 0;
      var p = c ? Math.max(t.p - base, -L.growMins(t) - L.witherMins(t) - 1440) : 0; // withered long ago: kept short
      var key = c + ',' + Math.round(p) + ',' + ((t.w ? 1 : 0) + (t.r ? 2 : 0));
      (groups[key] = groups[key] || key.split(',').map(Number)).push(Number(idx));
    });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  L.serialize = function (s) {
    var debris = [];
    Object.keys(s.debris).forEach(function (idx) { debris.push(Number(idx), C.DEBRIS_KEYS.indexOf(s.debris[idx])); });
    var friends = {};
    Object.keys(s.friends).forEach(function (k) {
      var f = s.friends[k];
      friends[k] = [f.pts, f.talked, f.gifted, f.met];
    });
    var forage = {};
    Object.keys(s.forage).forEach(function (m) { if (s.forage[m].day === s.day) forage[m] = [s.forage[m].day].concat(s.forage[m].taken); });
    var out = {
      v: C.SAVE_VERSION,
      mg: 2, // migration level: saves without it get the new starter tools and a dog
      rt: 1, // real time: crops grow by the clock (older saves are converted on load)
      d: s.day,
      s0: s.start,
      rg: s.regen - s.day * 1440,
      t: Math.floor(s.time),
      g: s.gold,
      e: s.energy,
      w: s.water,
      s: s.sel,
      m: MAPS.indexOf(s.map),
      i: s.inv.map(function (slot) { return slot ? [slot.id, slot.n] : 0; }),
      b: s.box.map(function (b) { return [b.id, b.n]; }),
      f: soilGroups(s),
      a: s.animals.map(function (a) {
        return [C.ANIMAL_KEYS.indexOf(a.kind), a.love, a.fed, a.pet, a.ready, a.name, a.brushed, a.young, a.preg];
      }),
      sd: s.seed,
      tl: C.TOOL_KEYS.map(function (k) { return s.tools[k] || 0; }),
      mt: [s.lumber, s.stone],
      db: debris,
      fr: friends,
      bd: C.BUILD_KEYS.map(function (k) { return s.builds[k] ? 1 : 0; }),
      pj: s.project ? [C.BUILD_KEYS.indexOf(s.project.id), s.project.done] : 0,
      ic: s.inc,
      dg: [s.dog.love, s.dog.pet],
      fg: forage,
      fe: s.fest,
      sp: s.spouse || 0,
      en: s.engaged ? [s.engaged.who, s.engaged.day] : 0,
      op: [s.opts.music, s.opts.sfx],
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
    var now = L.clock(), nowMin = Math.floor(now / 60000), today = L.dayOf(now);
    var s = L.newState({ now: now });
    // A save from before real time counted its own days from 1: it carries on from today.
    var shift = 0;
    if (o.rt) {
      s.day = int(o.d, 0, 1e6, today);
      s.start = int(o.s0, 0, s.day, s.day);
      s.regen = s.day * 1440 + int(o.rg, -1e7, 1e7, nowMin - s.day * 1440);
    } else {
      var old = int(o.d, 1, 1e6, 1);
      s.day = today;
      s.start = today - (old - 1);
      shift = today - old;
    }
    s.time = L.minuteOf(now);
    s.gold = int(o.g, 0, 1e9, C.START_GOLD);
    s.energy = int(o.e, 0, C.MAX_ENERGY, C.MAX_ENERGY);
    s.sel = int(o.s, 0, C.INV_SIZE - 1, 0);
    s.map = MAPS[int(o.m, 0, MAPS.length - 1, 0)];
    if (s.map === 'mine') s.map = 'town'; // mine floors aren't saved; come back out at the entrance
    s.seed = int(o.sd, 0, 2e9, 1);
    if (Array.isArray(o.tl)) C.TOOL_KEYS.forEach(function (k, i) { s.tools[k] = int(o.tl[i], 0, C.TOOL_LEVELS.length - 1, 0); });
    s.water = int(o.w, 0, L.canCapacity(s), L.canCapacity(s));
    if (Array.isArray(o.mt)) {
      s.lumber = int(o.mt[0], 0, 1e6, 0);
      s.stone = int(o.mt[1], 0, 1e6, 0);
    }
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
      if (o.rt) { // groups (see soilGroups)
        var c = C.CROP_KEYS[int(e[0], 0, 1e6, 0) - 1] || null, p = s.day * 1440 + int(e[1], -1e7, 1e7, 0), fl = int(e[2], 0, 3, 0);
        e.slice(3, 3 + 2000).forEach(function (x) {
          var i = int(x, 0, 1e6, -1);
          if (i >= 0) s.soil[i] = { w: fl & 1, c: c, p: c ? p : 0, r: c && fl & 2 && C.CROPS[c].regrow ? 1 : 0 };
        });
        return;
      }
      var idx = int(e[0], 0, 1e6, -1);
      if (idx < 0) return;
      var crop = C.CROP_KEYS[int(e[2], 0, 1e6, 0) - 1] || null, t = { w: e[1] ? 1 : 0, c: crop, p: 0, r: 0 };
      if (crop) { // days grown (of the old growing days) becomes the same share of the new growing time
        var oldDays = { turnip: 3, potato: 5, strawberry: 7, tomato: 6, corn: 9, carrot: 4, pumpkin: 10, grass: 4 }[crop] || 1;
        t.p = Math.round(nowMin - Math.min(1, int(e[3], 0, 99, 0) / oldDays) * C.CROPS[crop].mins);
      }
      s.soil[idx] = t;
    });
    // saves from before animals existed simply have none
    s.animals = (Array.isArray(o.a) ? o.a : []).filter(function (e) {
      return Array.isArray(e) && C.ANIMAL_KEYS[e[0]];
    }).map(function (e) {
      var kind = C.ANIMAL_KEYS[e[0]];
      var name = typeof e[5] === 'string' && e[5] ? e[5].slice(0, 16) : C.ANIMALS[kind].names[0];
      return {
        kind: kind, name: name, love: int(e[1], 0, C.LOVE.max, 0), fed: e[2] ? 1 : 0, pet: e[3] ? 1 : 0,
        ready: int(e[4], 0, 2, 0), brushed: e[6] ? 1 : 0, young: int(e[7], 0, 30, 0), preg: int(e[8], 0, 30, 0),
      };
    });
    s.debris = {};
    if (Array.isArray(o.db)) {
      for (var k = 0; k + 1 < o.db.length; k += 2) {
        var kind = C.DEBRIS_KEYS[int(o.db[k + 1], 0, 99, -1)], idx = int(o.db[k], 0, 1e6, -1);
        if (kind && idx >= 0 && !s.soil[idx]) s.debris[idx] = kind;
      }
    }
    s.friends = {};
    if (o.fr && typeof o.fr === 'object') {
      C.VILLAGER_ORDER.forEach(function (key) {
        var f = o.fr[key];
        if (Array.isArray(f)) s.friends[key] = { pts: int(f[0], 0, C.FRIEND.max, 0), talked: f[1] ? 1 : 0, gifted: f[2] ? 1 : 0, met: f[3] ? 1 : 0 };
      });
    }
    s.builds = {};
    if (Array.isArray(o.bd)) C.BUILD_KEYS.forEach(function (k, i) { if (o.bd[i]) s.builds[k] = 1; });
    if (Array.isArray(o.pj) && C.BUILD_KEYS[o.pj[0]] && !s.builds[C.BUILD_KEYS[o.pj[0]]]) {
      s.project = { id: C.BUILD_KEYS[o.pj[0]], done: int(o.pj[1], 1, 1e6, s.day + 1) + shift };
    }
    C.ANIMAL_KEYS.forEach(function (kind) { // never more than a building holds
      var seen = 0;
      s.animals = s.animals.filter(function (a) { return a.kind !== kind || ++seen <= L.capacity(s, kind); });
    });
    s.inc = int(o.ic, 0, C.INCUBATE_DAYS, 0);
    if (Array.isArray(o.dg)) s.dog = { name: C.DOG.name, love: int(o.dg[0], 0, C.LOVE.max, 0), pet: o.dg[1] ? 1 : 0 };
    s.forage = {};
    if (o.fg && typeof o.fg === 'object') {
      Object.keys(o.fg).forEach(function (m) {
        var e = o.fg[m];
        if (Array.isArray(e) && MAPS.indexOf(m) >= 0) s.forage[m] = { day: int(e[0], 0, 1e6, 0), taken: e.slice(1).map(function (x) { return int(x, 0, 1e4, 0); }) };
      });
    }
    s.fest = {};
    if (o.fe && typeof o.fe === 'object') {
      C.FESTIVALS.forEach(function (f) { if (o.fe[f.key]) s.fest[f.key] = int(o.fe[f.key], 0, 1e5, 0); });
    }
    s.spouse = C.VILLAGERS[o.sp] && C.VILLAGERS[o.sp].candidate ? o.sp : null;
    if (Array.isArray(o.en) && C.VILLAGERS[o.en[0]] && !s.spouse) s.engaged = { who: o.en[0], day: int(o.en[1], 1, 1e6, s.day) + shift };
    if (Array.isArray(o.op)) s.opts = { music: o.op[0] ? 1 : 0, sfx: o.op[1] ? 1 : 0 };
    if (Array.isArray(o.p) && o.p.length === 3) {
      s.player = { x: int(o.p[0], 0, 1e5, 0), y: int(o.p[1], 0, 1e5, 0), dir: DIRS[int(o.p[2], 0, 3, 0)] };
    }
    if (s.map !== MAPS[int(o.m, 0, MAPS.length - 1, 0)]) s.player = { x: null, y: null, dir: 'down', spawn: 'from_mine' };
    if (!o.mg) { // a save from before tools and the town: hand out what new farms start with
      ['axe', 'hammer', 'sickle'].forEach(function (id) { if (!L.hasItem(s, id)) L.addItem(s, id, 1); });
      if (s.animals.some(function (a) { return a.kind === 'cow'; }) && !L.hasItem(s, 'milker')) L.addItem(s, 'milker', 1);
    }
    return s;
  };

  F.Logic = L;
})(window.Farm = window.Farm || {});
