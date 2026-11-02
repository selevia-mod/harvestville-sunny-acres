// Today's Event (content: 00-zzzlater.js, on screen: 19za-events.js). Each day of the week has one small bonus, from the
// real date, the same on every phone. Saved: s.evSeen ('es'), the last day its pop-up was shown.
// Rare surprises (on screen: 19zb-rare.js): sparkling rocks and golden crops. Saved: s.rr ('rr'), today's paid rocks.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var E = C.EVENT;

  L.eventOf = function (day) { return C.EVENTS[L.date(day == null ? L.dayOf(L.clock()) : day).weekday]; };
  L.eventOn = function (key) { return L.eventOf().key === key; };

  // ---------- Fish Monday: at the market stall, Sell now and the shelves ----------
  var fishy = function (id) { return !!C.ITEMS[id] && C.ITEMS[id].kind === 'fish' && L.eventOn('fish'); };
  var instantPrice = L.instantPrice;
  L.instantPrice = function (id, n) {
    var p = instantPrice(id, n);
    return fishy(id) ? Math.floor(p * E.fish) : p;
  };
  var shelfPrice = L.shelfPrice;
  L.shelfPrice = function (id, n, level) {
    var p = shelfPrice(id, n, level);
    return fishy(id) ? Math.floor(p * E.fish) : p;
  };

  // ---------- Timber Tuesday ----------
  var clearDebris = L.clearDebris;
  L.clearDebris = function (s, idx) {
    var r = clearDebris(s, idx);
    if (r && r.lumber && L.eventOn('wood')) {
      r.lumber += E.lumber;
      s.lumber += E.lumber;
    }
    return r;
  };
  var chopTree = L.chopTree;
  L.chopTree = function (s, i) {
    var r = chopTree(s, i);
    if (typeof r === 'number' && L.eventOn('wood')) {
      r += E.lumber;
      s.lumber += E.lumber;
    }
    return r;
  };

  // ---------- Friendly Thursday: the day's chat counts double ----------
  var talk = L.talk;
  L.talk = function (s, key) {
    var had = !!L.friend(s, key).talked, r = talk(s, key);
    if (!had && L.friend(s, key).talked && L.eventOn('friends')) L.addFriend(s, key, C.FRIEND.talk * (E.talk - 1));
    return r;
  };

  // ---------- Feast Friday ----------
  var eat = L.eat;
  L.eat = function (s, slotIndex) {
    var r = eat(s, slotIndex);
    if (r > 0 && L.eventOn('feast')) {
      var more = Math.min(Math.ceil(r * (E.food - 1)), Math.max(0, L.maxEnergy(s) - s.energy));
      s.energy += more;
      r += more;
    }
    return r;
  };

  // ---------- Hunter Saturday ----------
  L.kanorPay = function (g) { return L.eventOn('hunt') ? Math.floor(g * E.hunt) : g; };
  var sellToKanor = L.sellToKanor;
  L.sellToKanor = function (s, id) {
    var g = sellToKanor(s, id), more = L.kanorPay(g) - g;
    s.gold += more;
    if (s.stats) s.stats.earned += more;
    return g + more;
  };

  // ---------- Gem Sunday: the rock's gem, once more, if it fits (the world calls this when a rock drops one) ----------
  L.mineGem = function (floor) { return C.MINE.bands[L.mineBand(floor)].ids[3]; };
  L.gemBonus = function (s, floor, id) {
    if (id !== L.mineGem(floor) || !L.eventOn('gems') || L.addItem(s, id, 1) > 0) return 0;
    return 1;
  };

  // ---------- the first open of the day ----------
  // Not on a farm's first day: that day belongs to the first goals.
  L.eventPopup = function (s) {
    if (s.day === s.start || s.evSeen === s.day) return null;
    return L.eventOf(s.day);
  };
  L.eventShown = function (s) { s.evSeen = s.day; };

  // ---------- sparkling rocks ----------
  var R = C.RARE, B = C.MINE.bands;
  var lucky = function (rate, day) { return L.eventOf(day).key === 'lucky' ? rate * R.lucky : rate; };
  // Added to a mine floor: which rocks sparkle, from the same numbers as the rocks, so friends in one mine see the same.
  // The rock over the ladder never does (its own moment is the ladder).
  var mineFloor = L.mineFloor;
  L.mineFloor = function (s, floor, floorTiles) {
    var m = mineFloor(s, floor, floorTiles), rate = lucky(R.rock, s.day);
    m.seed = s.seed;
    m.spark = m.rocks.filter(function (idx) { return idx !== m.stairs && L.rand(s.seed, s.day, floor, idx, 30) < rate; });
    return m;
  };
  // What a sparkling rock holds: half the time gold, then the band's best ore, then its gem. The first floors, before the
  // gem can drop, hold only what they drop themselves, so a new farm does not jump ahead.
  L.rockPrize = function (seed, day, floor, idx) {
    var ids = B[L.mineBand(floor)].ids, r = L.rand(seed, day, floor, idx, 32);
    var low = floor < 4 ? 0 : floor < 8 ? 1 : floor < 10 ? 2 : -1;
    if (low >= 0) return r < 0.5 ? { gold: C.ITEMS[ids[low]].sell } : { item: ids[low], n: 2 };
    if (r < 0.5) return { gold: Math.floor(C.ITEMS[ids[3]].sell / 2) };
    return r < 0.85 ? { item: ids[2], n: 2 } : { item: ids[3], n: 1 };
  };
  var rockKey = function (seed, day, floor, idx) { return Math.floor(L.rand(seed, day, floor, idx, 31) * 1e9); };
  var paidToday = function (s) { return s.rr && s.rr.day === s.day ? s.rr.got : []; };
  // Can this rock still pay you? Rocks come back in a new session, so what was paid today is in the save.
  L.rockOpen = function (s, seed, floor, idx) {
    var got = paidToday(s);
    return got.length < R.rockDay && got.indexOf(rockKey(seed, s.day, floor, idx)) < 0;
  };
  // Pays the rock, once. With a full bag the things are paid as their gold. Returns { gold, item, n } or null.
  L.claimRock = function (s, seed, floor, idx) {
    if (!L.rockOpen(s, seed, floor, idx)) return null;
    s.rr = { day: s.day, got: paidToday(s).concat([rockKey(seed, s.day, floor, idx)]) };
    var p = L.rockPrize(seed, s.day, floor, idx), gold = p.gold || 0, n = p.n || 0;
    if (p.item) {
      var left = L.addItem(s, p.item, p.n);
      if (left < p.n) L.discover(s, p.item);
      n = p.n - left;
      gold += left * C.ITEMS[p.item].sell;
    }
    s.gold += gold;
    s.stats.earned += gold;
    return { gold: gold, item: n ? p.item : null, n: n };
  };

  // ---------- golden crops ----------
  // Worked out from the tile and the minute the crop started, so nothing is saved and reopening the game changes nothing.
  L.goldenTile = function (s, idx) {
    var t = s.soil[idx];
    if (s.isVisit || !t || !t.c || C.CROPS[t.c].sickle || !L.isRipe(t)) return false;
    return L.rand(s.seed, idx, Math.floor(t.p), 33) < lucky(R.crop, s.day);
  };
  L.golden = [];
  L.takeGolden = function () { var n = L.golden; L.golden = []; return n; };
  var harvest = L.harvest;
  L.harvest = function (s, idx) {
    var gold = L.goldenTile(s, idx), got = harvest(s, idx);
    if (gold && typeof got === 'string' && got[0] !== '!') {
      var pay = C.ITEMS[got].sell * R.cropPay;
      s.gold += pay;
      s.stats.earned += pay;
      L.golden.push({ idx: idx, item: got, gold: pay });
    }
    return got;
  };

  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.evSeen) o.es = s.evSeen;
    if (paidToday(s).length) o.rr = [s.rr.day].concat(s.rr.got);
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.evSeen = Math.max(0, Math.floor(Number(o.es)) || 0);
    s.rr = Array.isArray(o.rr) ? { day: Math.floor(Number(o.rr[0])) || 0, got: o.rr.slice(1, R.rockDay + 1).map(function (k) { return Math.floor(Number(k)) || 0; }) } : null;
    return s;
  };
})(window.Farm = window.Farm || {});
