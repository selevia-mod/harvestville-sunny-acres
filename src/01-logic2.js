// More rules: first-days goals, tips, the collection book and records, mail, heart events, the horse and the
// cat, furniture, the mine's depth and treasure, the fishing mini-game's fish, and the dance score.
// Extends Logic (01-logic.js); wraps a few of its functions to record what happens.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var BITS = 30; // bits per number in the collection bitset (keeps them safe integers in JSON)

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---------- new state ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.goal = 0; // index into GOALS (GOALS.length = all done)
    s.gp = 0; // progress on the current goal
    s.tips = 0; // bitmask of TIPS already shown
    s.col = []; // collection bitset over COLLECTION
    s.stats = { earned: 0, fish: 0, cooked: 0, deepest: 0 };
    s.mail = []; // unread letter keys
    s.sent = []; // one-time letters already sent
    s.horse = null; // { name, love, pet } once the stable is built
    s.cat = null; // { name, love, pet } once the cat basket is bought
    s.chests = 0; // bitmask of mine treasure chests opened (floor 5 = bit 0, 10 = bit 1, ...)
    s.musicDay = 0; // last day the music box was played
    s.look = 'boy'; // the farmer: 'boy' or 'girl', picked at the start
    return s;
  };

  // friends also remember which heart events they have played
  var friend = L.friend;
  L.friend = function (s, key) {
    var f = friend(s, key);
    if (f.ev == null) f.ev = 0;
    return f;
  };

  // ---------- goals ----------
  L.goal = function (s) {
    return C.GOALS[s.goal] || null;
  };

  // Counts an event toward the current goal. Returns { goal, reward } when that finishes it, else null.
  L.progress = function (s, event, n) {
    var g = L.goal(s);
    if (!g || g.event !== event) return null;
    s.gp += n || 1;
    if (s.gp < g.need) return null;
    var r = g.reward;
    if (r.gold) s.gold += r.gold;
    if (r.item) L.addItem(s, r.item, r.n || 1);
    s.goal += 1;
    s.gp = 0;
    return { goal: g, reward: r };
  };

  L.rewardText = function (r) {
    if (r.gold) return '+' + r.gold + 'G';
    if (r.item) return '+' + (r.n || 1) + ' ' + C.ITEMS[r.item].name;
    return '';
  };

  // ---------- tips ----------
  L.tipKey = function (id) {
    var item = C.ITEMS[id];
    if (!item) return null;
    if (item.tool && C.TOOLS[item.tool]) return item.tool;
    if (id === 'rod' || id === 'brush' || id === 'milker') return id;
    if (item.kind === 'seed') return 'seed';
    if (item.kind === 'feed') return 'feed';
    if (item.kind === 'feather') return 'feather';
    if (item.energy) return 'food';
    return null;
  };

  // The tip for a key if it hasn't been shown yet (and marks it shown), else null.
  L.takeTip = function (s, key) {
    var i = C.TIPS.map(function (t) { return t.key; }).indexOf(key);
    if (i < 0 || (s.tips >> i) & 1) return null;
    s.tips |= 1 << i;
    return C.TIPS[i].text;
  };

  // ---------- collection book & records ----------
  L.discovered = function (s, id) {
    var i = C.COLLECTION.indexOf(id);
    return i >= 0 && !!((s.col[Math.floor(i / BITS)] || 0) & (1 << (i % BITS)));
  };

  // Marks an item as found; returns true the first time.
  L.discover = function (s, id) {
    var i = C.COLLECTION.indexOf(id);
    if (i < 0 || L.discovered(s, id)) return false;
    var k = Math.floor(i / BITS);
    while (s.col.length <= k) s.col.push(0);
    s.col[k] |= 1 << (i % BITS);
    return true;
  };

  L.collectionCount = function (s) {
    return C.COLLECTION.filter(function (id) { return L.discovered(s, id); }).length;
  };

  // record what the farmer ships, harvests, collects, forages and cooks
  var wrapDiscover = function (name, idOf) {
    var orig = L[name];
    L[name] = function () {
      var r = orig.apply(L, arguments), id = idOf(r, arguments);
      if (id) L.discover(arguments[0], id);
      return r;
    };
  };
  var itemResult = function (r) { return typeof r === 'string' && r[0] !== '!' ? r : null; };
  wrapDiscover('harvest', itemResult);
  wrapDiscover('cut', itemResult);
  wrapDiscover('collect', itemResult);
  wrapDiscover('takeForage', itemResult);
  wrapDiscover('ship', function (r) { return r ? r.id : null; });
  var cook = L.cook;
  L.cook = function (s, recipe) {
    var r = cook(s, recipe);
    if (r === 'ok') {
      L.discover(s, recipe.dish);
      s.stats.cooked += 1;
    }
    return r;
  };

  // ---------- fishing ----------
  L.rollFish = function (water, r) {
    var table = C.FISH_TABLE[water] || C.FISH_TABLE.pond, acc = 0, keys = Object.keys(table);
    for (var i = 0; i < keys.length; i++) {
      acc += table[keys[i]];
      if (r < acc) return keys[i];
    }
    return keys[0];
  };

  L.landFish = function (s, id) {
    if (L.addItem(s, id, 1) > 0) return '!full';
    s.stats.fish += 1;
    L.discover(s, id);
    return id;
  };

  L.catchFish = function (s, water, r) {
    return L.landFish(s, L.rollFish(water, r));
  };

  // ---------- the mine ----------
  L.mineEnergy = function (s, floor) {
    return L.toolEnergy(s, 'hammer', 1) + Math.floor(floor / 5) * C.MINE.energyPer5;
  };

  L.reachFloor = function (s, floor) {
    s.stats.deepest = Math.max(s.stats.deepest, floor);
  };

  L.hasChest = function (floor) {
    return floor > 0 && floor % C.MINE.chestEvery === 0;
  };

  L.chestOpened = function (s, floor) {
    return !!((s.chests >> (floor / C.MINE.chestEvery - 1)) & 1);
  };

  // Opens the treasure chest on a floor (once ever). Returns { gold, items: [[id, n]] } or { error }.
  L.openChest = function (s, floor) {
    if (!L.hasChest(floor)) return { error: 'none' };
    if (L.chestOpened(s, floor)) return { error: 'opened' };
    var k = floor / C.MINE.chestEvery;
    var items = k === 1 ? [['ore_copper', 3]] : k === 2 ? [['ore_silver', 3]] : k === 3 ? [['ore_gold', 3]] : [['gem', 1], ['ore_gold', 2]];
    var room = items.every(function (it) { return L.canAdd(s, it[0], it[1]); });
    if (!room) return { error: 'full' };
    items.forEach(function (it) {
      L.addItem(s, it[0], it[1]);
      L.discover(s, it[0]);
    });
    var gold = C.MINE.chestGold * k;
    s.gold += gold;
    s.chests |= 1 << (k - 1);
    return { gold: gold, items: items };
  };

  // ---------- festivals: the dance score adds friendship ----------
  var joinFestival = L.joinFestival;
  L.joinFestival = function (s, fest, choice, score) {
    var r = joinFestival(s, fest, choice);
    if (!r.error && fest.kind === 'dance' && score != null) {
      var bonus = Math.round(clamp(score, 0, 1) * C.DANCE_BONUS);
      L.addFriend(s, choice, bonus);
      r.bonus = bonus;
      r.text += score >= 0.8 ? ' Your dancing was wonderful!' : score >= 0.4 ? ' You kept up with the music.' : ' You stepped on a few toes...';
    }
    return r;
  };

  // ---------- heart events ----------
  // The next heart event a villager has for you (by hearts reached), or null.
  L.heartEvent = function (s, key) {
    var list = C.HEART_EVENTS[key] || [], f = L.friend(s, key), h = L.friendHearts(s, key);
    for (var i = 0; i < list.length; i++) {
      if (!((f.ev || 0) >> i & 1) && h >= list[i].hearts) return { i: i, ev: list[i] };
    }
    return null;
  };

  // Plays out the choice. Returns their reply.
  L.finishEvent = function (s, key, i, choice) {
    var f = L.friend(s, key), ev = C.HEART_EVENTS[key][i], c = ev.choice.a[choice];
    f.ev = (f.ev || 0) | (1 << i);
    f.talked = 1;
    L.addFriend(s, key, c[1]);
    return c[2];
  };

  // ---------- pets ----------
  L.petHorse = function (s) {
    if (!s.horse || s.horse.pet) return 'already';
    s.horse.pet = 1;
    s.horse.love = clamp(s.horse.love + C.LOVE.pet, 0, C.LOVE.max);
    return 'ok';
  };

  L.petCat = function (s) {
    if (!s.cat || s.cat.pet) return 'already';
    s.cat.pet = 1;
    s.cat.love = clamp(s.cat.love + C.LOVE.pet, 0, C.LOVE.max);
    return 'ok';
  };

  // ---------- furniture ----------
  L.buyFurniture = function (s, id) {
    var f = C.FURNITURE[id];
    if (s.builds[id]) return 'owned';
    if (s.gold < f.gold) return 'gold';
    s.gold -= f.gold;
    s.builds[id] = 1;
    if (id === 'f_cat' && !s.cat) s.cat = { name: C.CAT.name, love: 0, pet: 0 };
    return 'ok';
  };

  L.playMusicBox = function (s) {
    if (s.musicDay === s.day) return 0;
    s.musicDay = s.day;
    var gain = Math.min(5, L.maxEnergy(s) - s.energy);
    s.energy += gain;
    return gain || -1;
  };

  // ---------- mail ----------
  L.letter = function (key) {
    var base = key.split(':')[0], arg = key.split(':')[1], L0 = C.LETTERS[base];
    var text = L0.text;
    if (base === 'fest') {
      var fest = C.FESTIVALS.filter(function (f) { return f.key === arg; })[0];
      text = text.replace('{fest}', fest.name).replace('{desc}', fest.desc);
    }
    if (base === 'bday') text = text.replace('{who}', C.VILLAGERS[arg].name);
    return { from: L0.from, text: text, gift: L0.gift || null };
  };

  function send(s, key, once) {
    if (once) {
      if (s.sent.indexOf(key) >= 0) return;
      s.sent.push(key);
    }
    s.mail.push(key);
    if (s.mail.length > 8) s.mail.shift();
  }

  // Puts today's letters in the mailbox (called each morning). Returns how many arrived.
  L.checkMail = function (s) {
    var before = s.mail.length + s.sent.length * 100;
    if (s.day >= 2) send(s, 'welcome', true);
    var fest = L.festivalOn(s.day + 1);
    if (fest) send(s, 'fest:' + fest.key);
    L.birthdaysOn(s.day + 1).forEach(function (k) { send(s, 'bday:' + k); });
    C.VILLAGER_ORDER.forEach(function (k) {
      if (s.friends[k] && L.friendHearts(s, k) >= 3) send(s, 'h_' + k, true);
    });
    [[1000, 'ship1'], [5000, 'ship2'], [20000, 'ship3']].forEach(function (m) { if (s.stats.earned >= m[0]) send(s, m[1], true); });
    if (s.stats.deepest >= 10) send(s, 'mine10', true);
    return s.mail.length + s.sent.length * 100 - before > 0;
  };

  // Reads the oldest letter and takes its gift. Returns { key, letter } or { error: 'empty' | 'full' }.
  L.readMail = function (s) {
    if (!s.mail.length) return { error: 'empty' };
    var key = s.mail[0], letter = L.letter(key), g = letter.gift;
    if (g && C.ITEMS[g[0]] && !L.canAdd(s, g[0], g[1])) return { error: 'full' };
    s.mail.shift();
    if (g) {
      if (g[0] === 'gold') s.gold += g[1];
      else if (g[0] === 'lumber' || g[0] === 'stone') s[g[0]] += g[1];
      else L.addItem(s, g[0], g[1]);
    }
    return { key: key, letter: letter };
  };

  // ---------- the day ends ----------
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    var r = endDay(s, passedOut, info);
    s.stats.earned += r.earned;
    (r.shipped || []).forEach(function (b) { L.discover(s, b.id); });
    if (s.builds.stable && !s.horse) {
      s.horse = { name: C.HORSE.name, love: 0, pet: 0 };
      r.horse = true;
    }
    [s.horse, s.cat].forEach(function (p) {
      if (!p) return;
      if (!p.pet) p.love = clamp(p.love - 1, 0, C.LOVE.max);
      p.pet = 0;
    });
    var mailBefore = s.mail.length;
    L.checkMail(s);
    r.mail = s.mail.length > mailBefore ? s.mail.length - mailBefore : 0;
    if (L.progress(s, 'sleep')) r.goalDone = true;
    return r;
  };

  // ---------- save format ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.gl = [s.goal, s.gp];
    o.tp = s.tips;
    o.cl = s.col.slice();
    o.st = [s.stats.earned, s.stats.fish, s.stats.cooked, s.stats.deepest];
    o.ml = s.mail.slice();
    o.sn = s.sent.slice();
    o.hs = s.horse ? [s.horse.love, s.horse.pet] : 0;
    o.ct = s.cat ? [s.cat.love, s.cat.pet] : 0;
    o.ch = s.chests;
    o.mb = s.musicDay;
    o.lk = s.look === 'girl' ? 1 : 0;
    Object.keys(s.friends).forEach(function (k) { if (o.fr[k]) o.fr[k][4] = s.friends[k].ev || 0; });
    return o;
  };

  function int(v, min, max, fallback) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  var letterOk = function (key) {
    if (typeof key !== 'string') return false;
    var p = key.split(':');
    if (!C.LETTERS[p[0]]) return false;
    if (p[0] === 'fest') return C.FESTIVALS.some(function (f) { return f.key === p[1]; });
    if (p[0] === 'bday') return !!C.VILLAGERS[p[1]];
    return true;
  };

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return null;
    if (Array.isArray(o.gl)) {
      s.goal = int(o.gl[0], 0, C.GOALS.length, 0);
      s.gp = int(o.gl[1], 0, 1000, 0);
    } else {
      s.goal = s.day > 1 ? C.GOALS.length : 0; // older farms already know the ropes
    }
    s.tips = int(o.tp, 0, 2147483647, 0);
    s.col = (Array.isArray(o.cl) ? o.cl : []).slice(0, 4).map(function (v) { return int(v, 0, (1 << BITS) - 1, 0); });
    if (Array.isArray(o.st)) {
      s.stats = { earned: int(o.st[0], 0, 1e9, 0), fish: int(o.st[1], 0, 1e7, 0), cooked: int(o.st[2], 0, 1e7, 0), deepest: int(o.st[3], 0, 1e4, 0) };
    }
    s.mail = (Array.isArray(o.ml) ? o.ml : []).filter(letterOk).slice(-8);
    s.sent = (Array.isArray(o.sn) ? o.sn : []).filter(letterOk).slice(0, 40);
    if (Array.isArray(o.hs)) s.horse = { name: C.HORSE.name, love: int(o.hs[0], 0, C.LOVE.max, 0), pet: o.hs[1] ? 1 : 0 };
    if (Array.isArray(o.ct)) s.cat = { name: C.CAT.name, love: int(o.ct[0], 0, C.LOVE.max, 0), pet: o.ct[1] ? 1 : 0 };
    if (s.builds.f_cat && !s.cat) s.cat = { name: C.CAT.name, love: 0, pet: 0 };
    s.chests = int(o.ch, 0, 1 << 20, 0);
    s.musicDay = int(o.mb, 0, 1e6, 0);
    s.look = o.lk === 1 ? 'girl' : 'boy';
    if (o.fr && typeof o.fr === 'object') {
      Object.keys(s.friends).forEach(function (k) {
        var f = o.fr[k];
        s.friends[k].ev = Array.isArray(f) ? int(f[4], 0, 255, 0) : 0;
      });
    }
    return s;
  };
})(window.Farm = window.Farm || {});
