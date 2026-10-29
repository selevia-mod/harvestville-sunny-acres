// Rules for friends picking your ripe crops into your Harvest Basket, your own birthday, and saying hello for the
// first-days goal (owner, 29 Oct 2026). Loaded after 01-logicA.js, so its save wrapper is the outermost.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  var int = function (v, min, max, fallback) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  };

  // ---------- content ----------
  C.PICK = { tiles: 5, gold: 20 }; // per friend per day: pick up to 5 ripe crops into their basket, 20G for each
  C.LETTERS.mybday = {
    from: 'hollis',
    text: 'Happy birthday! The whole of Harvest Ville wishes you a wonderful day. Hana baked you a cake, and everyone in town would love to say hello. - Mayor Hollis',
    gift: ['cake', 1],
  };
  C.BIRTHDAY_LINES = [
    'Happy birthday, {name}! I hope your day is as sweet as cake.',
    'Is it your birthday today? Happy birthday, {name}!',
    'Happy birthday! The whole town is talking about it, {name}.',
    'Many happy returns, {name}! Do something nice for yourself today.',
  ];
  C.TIPS.push({ key: 'my_birthday', text: 'YOUR BIRTHDAY' }); // a farm without one asks once (19p-party.js)
  C.DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.basket = {}; // item -> how many friends picked for you, waiting by the farmhouse
    s.bd = 0; // your birthday, month * 100 + day (no year); 0 = not set
    s.bdy = 0; // the year the town last celebrated it (one cake a year)
    return s;
  };

  // ---------- saying hello (the first-days goal) ----------
  // Each different person you talk to while the goal is open counts once: villagers you met before, and the
  // shoppers from out of town (owner, 29 Oct: talked to many villagers, and the Young Mother, and it stayed at 2/3,
  // because only meeting a villager for the first time ever counted). Returns true when this talk counts.
  L.hello = function (s, key) {
    var g = L.goal(s);
    if (!g || g.event !== 'meet' || !key) return false;
    var seen = s.helloed && s.helloed.goal === s.goal ? s.helloed : (s.helloed = { goal: s.goal, keys: [] }); // not saved
    if (seen.keys.indexOf(key) >= 0) return false;
    seen.keys.push(key);
    return true;
  };

  // ---------- the Harvest Basket ----------
  var cropItem = function (crop) { return C.CROPS[crop] && !C.CROPS[crop].sickle ? C.CROPS[crop].item : null; };

  // On their farm (a look-only copy): a ripe crop a friend can pick. Returns its crop key, or null.
  L.pickable = function (v, idx) {
    var t = v.soil[idx];
    return t && t.c && L.isRipe(t) && cropItem(t.c) ? t.c : null;
  };
  // Picks it off the copy (so it is gone on screen). Returns what to put back if the server says no.
  L.pickOff = function (v, idx) {
    var t = v.soil[idx];
    if (!L.pickable(v, idx)) return null;
    var keep = JSON.parse(JSON.stringify(t));
    clearPicked(t);
    return keep;
  };
  // A picked tile is left as a harvest leaves it: dry, and empty unless the crop regrows.
  function clearPicked(t) {
    var crop = C.CROPS[t.c];
    t.w = 0;
    if (crop.regrow) {
      t.p = L.nowMin();
      t.r = 1;
    } else {
      t.c = null;
      t.p = 0;
      t.r = 0;
      delete t.h;
    }
  }

  // At home: friends picked these [tile, crop] for you. A crop goes into the basket only if it is still on that
  // tile and ripe (or has withered since: they picked it in time), so nothing is picked twice. Returns how many.
  L.applyPicks = function (s, picks) {
    var n = 0;
    (Array.isArray(picks) ? picks : []).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var t = s.soil[int(e[0], -1, 1e5, -1)], crop = String(e[1] || ''), item = cropItem(crop);
      if (!item || !t || t.c !== crop || L.cropStage(t) < 3) return;
      clearPicked(t);
      s.basket[item] = Math.min(999, (s.basket[item] || 0) + 1);
      n++;
    });
    return n;
  };
  L.basketCount = function (s) {
    return Object.keys(s.basket || {}).reduce(function (a, k) { return a + s.basket[k]; }, 0);
  };
  // Takes the basket into your bag. Returns { got, left }: what did not fit stays in the basket.
  L.takeBasket = function (s) {
    var got = 0;
    Object.keys(s.basket).forEach(function (id) {
      var n = s.basket[id], left = L.addItem(s, id, n);
      got += n - left;
      if (left > 0) s.basket[id] = left;
      else delete s.basket[id];
    });
    return { got: got, left: L.basketCount(s) };
  };

  // ---------- your birthday ----------
  // Returns 'ok' or 'bad'. Month 1-12, day 1-31 (February 29th is kept on the 28th in other years).
  L.setBirthday = function (s, month, day) {
    month = int(month, 0, 99, 0);
    day = int(day, 0, 99, 0);
    if (month < 1 || month > 12 || day < 1 || day > C.DAYS_IN_MONTH[month - 1]) return 'bad';
    s.bd = month * 100 + day;
    return 'ok';
  };
  L.birthdayOf = function (s) {
    return s && s.bd ? { month: Math.floor(s.bd / 100), day: s.bd % 100 } : null;
  };
  L.birthdayText = function (s) {
    var b = L.birthdayOf(s);
    return b ? C.MONTHS[b.month - 1] + ' ' + b.day : 'Not set';
  };
  // Is `day` (a game day number) your birthday?
  L.myBirthdayOn = function (s, day) {
    var b = L.birthdayOf(s);
    if (!b) return false;
    var d = L.date(day), want = b.day;
    if (b.month === 2 && want === 29 && L.date(day + 1).month === 3 && d.day === 28) want = 28; // not a leap year
    return d.month === b.month && d.day === want;
  };
  // On your birthday, the mayor's letter with a cake, once a year. Returns true when it was sent just now.
  L.birthdayMail = function (s) {
    if (!L.myBirthdayOn(s, s.day)) return false;
    var year = L.date(s.day).year;
    if (s.bdy === year) return false;
    s.bdy = year;
    s.mail.push('mybday');
    return true;
  };
  var checkMail = L.checkMail;
  L.checkMail = function (s) {
    var got = checkMail(s);
    return L.birthdayMail(s) || got;
  };
  // Villagers wish you a happy birthday the first time you talk to them on the day.
  var talk = L.talk;
  L.talk = function (s, key) {
    var r = talk(s, key);
    if (r.first || !L.myBirthdayOn(s, s.day)) return r;
    var wished = s.wished && s.wished.day === s.day ? s.wished : (s.wished = { day: s.day, keys: [] }); // not saved
    if (wished.keys.indexOf(key) >= 0) return r;
    wished.keys.push(key);
    var i = Math.max(0, C.VILLAGER_ORDER.indexOf(key)) % C.BIRTHDAY_LINES.length;
    r.line = C.BIRTHDAY_LINES[i].replace('{name}', L.farmerName(s));
    r.birthday = true;
    return r;
  };

  // Friends who visit see that it is your birthday (only the day itself is shared, never the date).
  var snapshot = L.snapshot;
  L.snapshot = function (s) {
    var o = snapshot(s);
    if (L.myBirthdayOn(s, s.day)) { o.bday = s.day; o.bdn = L.farmerName(s); }
    o.basket = Math.min(999, L.basketCount(s));
    o.ms = s.seed; // their mine's rocks, so friends who follow them there see the same ones
    return o;
  };
  L.snapBirthday = function (snap, day) {
    var b = snap && int(snap.bday, 0, 1e6, 0);
    return !!b && Math.abs(b - day) <= 1; // their phone's date may be a day off from yours
  };

  // On their farm: is it their birthday, and how full is their basket.
  var visitState = L.visitState;
  L.visitState = function (snap, mine) {
    var s = visitState(snap, mine);
    s.hostBirthday = L.snapBirthday(snap, mine ? mine.day : s.day);
    s.hostName = s.hostBirthday ? L.cleanName(snap.bdn) : '';
    s.basketN = int(snap && snap.basket, 0, 999, 0);
    s.mineSeed = int(snap && snap.ms, 0, 2147483647, 0);
    return s;
  };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), bk = [];
    Object.keys(s.basket || {}).forEach(function (id) { if (s.basket[id] > 0) bk.push(id, s.basket[id]); });
    if (bk.length) o.bk = bk;
    if (s.bd) o.bd = [s.bd, s.bdy];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.basket = {};
    var bk = Array.isArray(o.bk) ? o.bk : [];
    for (var i = 0; i + 1 < bk.length && i < 200; i += 2) {
      var id = String(bk[i]), n = int(bk[i + 1], 0, 999, 0);
      if (C.ITEMS[id] && n > 0) s.basket[id] = n;
    }
    s.bd = 0;
    s.bdy = 0;
    if (Array.isArray(o.bd)) {
      var md = int(o.bd[0], 0, 9999, 0);
      if (L.setBirthday(s, Math.floor(md / 100), md % 100) === 'ok') s.bdy = int(o.bd[1], 0, 9999, 0);
    }
    return s;
  };
})(window.Farm = window.Farm || {});
