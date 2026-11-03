// Farmhands' rules (content 00-zzzzzzz-farmhands.js, on screen 19zz-farmhands.js). Named 01-logicZ-... so it loads after
// every 01-logicN.js (a plain 01-logic-... would sort before 01-logic.js).
// They work in rounds by the phone's clock: every C.FH.every minutes from 6 AM to 9 PM each hired farmhand does what
// there is to do at that minute (up to C.FH.perRound jobs), until its jobs for the day are used up. A day's wage is
// taken at its first job that day, so a day with nothing to do costs nothing; without enough gold they do not work.
// Time away is caught up round by round, each day before its midnight (so rain, produce and growing happen in the
// right order), the same as if you had watched. Saved: s.fh ('fh').
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var FH = C.FH;

  C.TIPS.push({ key: 'farmhands_tour', text: 'FARMHANDS' }); // the first time you open the inn's Farmhands tab

  var int = function (v, min, max, fallback) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  };
  var fresh = function (at) { return { at: at, hands: {}, log: {} }; };
  var def = function (key) { return C.FARMHANDS[key]; };

  // ---------- who works for you ----------
  L.fhOf = function (s, key) { return (s.fh && s.fh.hands[key]) || null; };
  L.fhHired = function (s, key) { var h = L.fhOf(s, key); return !!(h && h.on); };
  L.fhAny = function (s) { return !!s.fh && C.FH_KEYS.some(function (k) { return L.fhHired(s, k); }); };
  L.fhUnlocked = function (s, key) { return ((s.stats && s.stats.earned) || 0) >= def(key).unlock; };
  L.fhLevel = function (s, key) { var h = L.fhOf(s, key); return h ? h.lv : 1; };
  L.fhJobs = function (s, key, lv) { return def(key).jobs[(lv || L.fhLevel(s, key)) - 1]; };
  L.fhWage = function (s, key, lv) { return def(key).wage[(lv || L.fhLevel(s, key)) - 1]; };
  L.fhDoneToday = function (s, key) { var h = L.fhOf(s, key); return h && h.d === s.day ? h.n : 0; };
  L.fhPaidToday = function (s, key) { var h = L.fhOf(s, key); return !!(h && h.paid === s.day); };
  // the days worked a promotion still needs (0 = it can be done now), or -1 at the top level
  L.fhToPromote = function (s, key) {
    var h = L.fhOf(s, key);
    if (!h || h.lv >= FH.ranks.length) return -1;
    return Math.max(0, FH.promote[h.lv] - h.days);
  };
  L.fhAtWork = function (time) { return time >= FH.from && time < FH.to; };

  // 'ok' | 'locked' (your farm has not earned enough yet) | 'already'. Someone who worked for you before comes back
  // at the level they had.
  L.fhHire = function (s, key) {
    if (!def(key)) return 'bad';
    if (L.fhHired(s, key)) return 'already';
    if (!L.fhUnlocked(s, key)) return 'locked';
    L.fhWork(s); // the others' rounds up to now first
    var h = s.fh.hands[key] || { lv: 1, days: 0, d: s.day, n: 0, paid: -1, np: -1, nf: -1 };
    h.on = 1;
    if (h.d !== s.day) { h.d = s.day; h.n = 0; }
    s.fh.hands[key] = h;
    return 'ok';
  };
  L.fhFire = function (s, key) {
    if (!L.fhHired(s, key)) return 'none';
    L.fhWork(s);
    s.fh.hands[key].on = 0;
    return 'ok';
  };
  // 'ok' | 'days' (not long enough yet) | 'max' | 'none'
  L.fhPromote = function (s, key) {
    if (!L.fhHired(s, key)) return 'none';
    var left = L.fhToPromote(s, key);
    if (left < 0) return 'max';
    if (left > 0) return 'days';
    L.fhWork(s);
    s.fh.hands[key].lv += 1;
    return 'ok';
  };

  // ---------- the jobs ----------
  // Each finds up to `room` jobs at minute m (nothing is changed yet): [{ cost, ... }]; do(s, job, m) does one.
  var basketRoom = function (s, id, n) { return ((s.basket || {})[id] || 0) + n <= 999; };
  var toBasket = function (s, id, n) { s.basket = s.basket || {}; s.basket[id] = Math.min(999, (s.basket[id] || 0) + n); };
  var storeCount = function (s, id) { return (s.store || []).reduce(function (a, x) { return a + (x && x.id === id ? x.n : 0); }, 0); };
  var takeFeed = function (s, id) {
    var st = s.store || [];
    for (var k = 0; k < st.length; k++) {
      if (st[k] && st[k].id === id) {
        st[k].n -= 1;
        if (st[k].n <= 0) st[k] = null;
        return true;
      }
    }
    return L.removeItem(s, id, 1) > 0;
  };
  var JOBS = {
    water: {
      find: function (s, m, room, soil) {
        var out = [];
        for (var i = 0; i < soil.length && out.length < room; i++) {
          var t = s.soil[soil[i]];
          if (t && t.c && L.needsWater(t)) out.push({ cost: 1, idx: soil[i] });
        }
        return out;
      },
      do: function (s, j, m) {
        var t = s.soil[j.idx];
        L.wet(t, Math.max(m, t.p || 0));
        return 1;
      },
    },
    harvest: {
      find: function (s, m, room, soil) {
        var out = [], add = {};
        for (var i = 0; i < soil.length && out.length < room; i++) {
          var idx = soil[i], t = s.soil[idx], crop = t && t.c && C.CROPS[t.c];
          if (!crop || crop.sickle || L.cropStage(t, m) !== 3) continue;
          if (L.goldenTile && L.goldenTile(s, idx)) continue; // a golden crop is left for you to pick
          add[crop.item] = (add[crop.item] || 0) + 1;
          if (!basketRoom(s, crop.item, add[crop.item])) continue;
          out.push({ cost: 1, idx: idx, item: crop.item });
        }
        return out;
      },
      do: function (s, j, m) { // as a picked crop is left: dry, and empty unless it grows back
        var t = s.soil[j.idx], crop = C.CROPS[t.c];
        toBasket(s, j.item, 1);
        t.w = 0;
        delete t.f; // (fertilizer lasts one crop, as when you pick it: 01-logicZ-farmtech.js)
        if (crop.regrow) {
          t.p = m;
          t.r = 1;
        } else {
          t.c = null;
          t.p = 0;
          t.r = 0;
          delete t.h;
        }
        if (L.autoWater) L.autoWater(s, j.idx, m); // (a sprinkler keeps it wet, as when you pick it)
        return 1;
      },
    },
    animals: { // each animal: what it made goes in the basket (1 job), then it is fed (1 job)
      find: function (s, m, room) {
        var out = [], feed = {}, add = {}, hungry = false;
        s.animals.forEach(function (a, i) {
          var d = C.ANIMALS[a.kind];
          if (a.ready && out.length < room) {
            var item = a.ready === 2 ? d.large : d.product;
            add[item] = (add[item] || 0) + 1;
            if (basketRoom(s, item, add[item])) out.push({ cost: 1, i: i, collect: item });
          }
          if (a.young || a.fed || out.length >= room) return;
          if (feed[d.feed] == null) feed[d.feed] = L.countItem(s, d.feed) + storeCount(s, d.feed);
          if (feed[d.feed] <= 0) { hungry = true; return; }
          feed[d.feed] -= 1;
          out.push({ cost: 1, i: i, feed: d.feed });
        });
        out.hungry = hungry;
        return out;
      },
      do: function (s, j) {
        var a = s.animals[j.i];
        if (j.collect) {
          toBasket(s, j.collect, 1 + (a.bx || 0)); // (a rare animal's second one too: 01-logicZ-breeding.js)
          a.ready = 0;
          a.bx = 0;
          return 0; // (counted as collected, not fed)
        }
        if (!takeFeed(s, j.feed)) return 0;
        a.fed = 1;
        a.love = Math.max(0, Math.min(C.LOVE.max, a.love + C.LOVE.feed));
        return 1;
      },
    },
    fruit: {
      find: function (s, m, room) {
        var out = [], items = (s.yard && s.yard.items) || [];
        if (!L.treeOf || !s.fruit) return out;
        for (var i = 0; i < items.length && out.length < room; i++) {
          var st = L.treeOf(items[i].t) && L.treeState(s, items[i], m);
          if (st && st.ripe && basketRoom(s, st.tree.fruit, st.tree.n)) out.push({ cost: 1, i: i, item: st.tree.fruit, n: st.tree.n });
        }
        return out;
      },
      do: function (s, j, m) {
        var it = s.yard.items[j.i];
        s.fruit[it.x + ',' + it.y] = m;
        toBasket(s, j.item, j.n);
        return j.n;
      },
    },
  };

  var logOf = function (s, key) { return s.fh.log[key] || (s.fh.log[key] = { a: 0, b: 0, g: 0, u: 0, nf: 0 }); };

  // One round at minute m of today (s.day). Jobs done go into `out` ({ key, job, m, idx | i, item, n }).
  var round = function (s, m, soil, out) {
    C.FH_KEYS.forEach(function (key) {
      var h = s.fh.hands[key], d = def(key);
      if (!h || !h.on) return;
      if (h.d !== s.day) { h.d = s.day; h.n = 0; }
      var room = Math.min(FH.perRound, d.jobs[h.lv - 1] - h.n);
      if (room <= 0) return;
      var jobs = JOBS[d.job].find(s, m, room, soil);
      if (jobs.hungry && h.nf !== s.day) { h.nf = s.day; logOf(s, key).nf += 1; }
      if (!jobs.length) return;
      if (h.paid !== s.day) {
        var wage = d.wage[h.lv - 1];
        if (s.gold < wage) {
          if (h.np !== s.day) { h.np = s.day; logOf(s, key).u += 1; }
          return;
        }
        s.gold -= wage;
        h.paid = s.day;
        h.days += 1;
        logOf(s, key).g += wage;
      }
      jobs.forEach(function (j) {
        var n = JOBS[d.job].do(s, j, m), lg = logOf(s, key);
        h.n += j.cost;
        if (j.collect) lg.b += 1;
        else lg.a += n;
        j.key = key;
        j.job = d.job;
        j.m = m;
        out.push(j);
      });
    });
  };

  // The minute (counted like L.nowMin) of `min` minutes after the phone's midnight on day `day`.
  var dayMin = function (day, min) {
    var d = L.date(day);
    return Math.floor(new Date(d.year, d.month - 1, d.day, 0, min).getTime() / 60000);
  };
  L.fhDayMin = dayMin;

  // Works today's rounds from the last one done up to minute `upto` (now when not given). Returns the jobs done.
  L.fhWork = function (s, upto) {
    var fh = s.fh, out = [];
    if (!fh) return out;
    if (upto == null) upto = L.nowMin();
    if (upto <= fh.at) return out;
    if (fh.nextDay === s.day && upto < fh.next) { fh.at = upto; return out; }
    var n = Math.ceil((FH.to - FH.from) / FH.every), next = Infinity;
    if (L.fhAny(s)) {
      var soil = Object.keys(s.soil || {}).map(Number).sort(function (a, b) { return a - b; });
      for (var k = 0; k < n; k++) {
        var m = dayMin(s.day, FH.from + k * FH.every);
        if (m <= fh.at) continue;
        if (m > upto) { next = m; break; }
        round(s, m, soil, out);
      }
    } else {
      for (var j = 0; j < n; j++) { var mj = dayMin(s.day, FH.from + j * FH.every); if (mj > upto) { next = mj; break; } }
    }
    fh.at = upto;
    fh.next = next;
    fh.nextDay = s.day;
    return out;
  };

  // The jobs done in the last moments (for the farm to show them being done), taken once by the world.
  L.fhRecent = [];
  L.fhTakeRecent = function () { var r = L.fhRecent; L.fhRecent = []; return r; };

  // What they did since the last morning report: { key: { a, b, g, u, nf } } or null; the log starts over.
  L.fhTakeLog = function (s) {
    if (!s.fh) return null;
    var lg = s.fh.log, any = Object.keys(lg).some(function (k) { var e = lg[k]; return e.a || e.b || e.g || e.u || e.nf; });
    s.fh.log = {};
    return any ? JSON.parse(JSON.stringify(lg)) : null;
  };

  // The morning report's line about them, or ''.
  L.fhReport = function (lg) {
    if (!lg) return '';
    var parts = [], wages = 0, notes = [];
    var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
    C.FH_KEYS.forEach(function (key) {
      var e = lg[key], d = def(key);
      if (!e) return;
      wages += e.g || 0;
      if (d.job === 'water' && e.a) parts.push(d.name + ' watered ' + plural(e.a, 'crop', 'crops'));
      if (d.job === 'harvest' && e.a) parts.push(d.name + ' picked ' + plural(e.a, 'crop', 'crops') + ' into the basket');
      if (d.job === 'animals' && (e.a || e.b)) {
        parts.push(d.name + (e.a ? ' fed the animals ' + plural(e.a, 'time', 'times') : '') + (e.a && e.b ? ' and' : '') +
          (e.b ? ' put ' + plural(e.b, 'thing', 'things') + ' they made in the basket' : ''));
      }
      if (d.job === 'fruit' && e.a) parts.push(d.name + ' picked ' + plural(e.a, 'fruit', 'fruit') + ' into the basket');
      if (e.u) notes.push(d.name + ' did not work: there was not enough gold for the wage.');
      if (e.nf) notes.push(d.name + ' ran out of animal feed. Keep some in your Storage or bag.');
    });
    var text = parts.length ? 'Your farmhands: ' + parts.join(', ') + '.' + (wages ? ' Wages: ' + wages + 'G.' : '') : '';
    return (text + (notes.length ? ' ' + notes.join(' ') : '')).trim();
  };

  // ---------- Rosa's letters ----------
  // The first farmhand your farm earns brings 'fh_inn'; each one after that its own letter. A farm that has earned
  // enough for several at once gets the one letter.
  var checkMail = L.checkMail;
  L.checkMail = function (s) {
    var got = checkMail(s), sent = s.sent || [], ready = C.FH_KEYS.filter(function (k) { return L.fhUnlocked(s, k); });
    if (!ready.length || !s.mail) return got;
    var post = function (key) { if (sent.indexOf(key) >= 0) return false; sent.push(key); s.mail.push(key); return true; };
    if (sent.indexOf('fh_inn') < 0) {
      post('fh_inn');
      ready.forEach(function (k) { if (sent.indexOf('fh_' + k) < 0) sent.push('fh_' + k); });
      return true;
    }
    ready.forEach(function (k) { if (!L.fhHired(s, k) && post('fh_' + k)) got = true; });
    return got;
  };

  // ---------- the day and time away ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.fh = fresh(Math.floor((info && info.now != null ? info.now : L.clock()) / 60000));
    return s;
  };

  // Before a midnight: the rest of that day's rounds (up to now, if it is still that day).
  var endDay = L.endDay;
  L.endDay = function (s, passedOut, info) {
    if (s.fh) L.fhWork(s, Math.min(L.nowMin(), dayMin(s.day + 1, 0) - 1));
    return endDay.call(this, s, passedOut, info);
  };

  // Coming back: the days that went by (each through L.endDay above), what they did for the report, then today up to now.
  var catchUp = L.catchUp;
  L.catchUp = function (s, now, info) {
    var r = catchUp.call(this, s, now, info);
    if (!s.fh) return r;
    if (r) {
      var lg = L.fhTakeLog(s);
      if (lg) r.fh = lg;
    }
    var at = Math.floor((now == null ? L.clock() : now) / 60000);
    var done = L.fhWork(s, at).filter(function (j) { return j.m >= at - 15; }); // only what was just done is shown
    if (done.length) L.fhRecent = L.fhRecent.concat(done).slice(-60);
    return r;
  };

  // ---------- save ----------
  // fh: { a: minute done up to (from today's start), h: [[hand, hired, level, days worked, counters' day (from today),
  // jobs that day, paid that day, unpaid that day, no feed that day]], l: [[hand, a, b, wages, unpaid, nofeed]] }
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), fh = s.fh;
    if (!fh) return o;
    var h = [], l = [];
    C.FH_KEYS.forEach(function (key, i) {
      var x = fh.hands[key], e = fh.log[key];
      if (x) h.push([i, x.on ? 1 : 0, x.lv, x.days, x.d - s.day, x.n, x.paid === x.d ? 1 : 0, x.np === x.d ? 1 : 0, x.nf === x.d ? 1 : 0]);
      if (e && (e.a || e.b || e.g || e.u || e.nf)) l.push([i, e.a, e.b, e.g, e.u, e.nf]);
    });
    if (h.length || l.length) o.fh = { a: Math.round(fh.at - s.day * 1440), h: h, l: l };
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var f = o.fh && typeof o.fh === 'object' ? o.fh : null;
    s.fh = fresh(f ? s.day * 1440 + int(f.a, -1e7, 1e7, L.nowMin() - s.day * 1440) : L.nowMin());
    if (!f) return s;
    (Array.isArray(f.h) ? f.h : []).forEach(function (e) {
      var key = Array.isArray(e) && C.FH_KEYS[e[0]];
      if (!key || s.fh.hands[key]) return;
      var d = s.day + int(e[4], -1e6, 0, 0);
      s.fh.hands[key] = {
        on: e[1] ? 1 : 0, lv: int(e[2], 1, FH.ranks.length, 1), days: int(e[3], 0, 1e5, 0), d: d,
        n: int(e[5], 0, 1e4, 0), paid: e[6] ? d : -1, np: e[7] ? d : -1, nf: e[8] ? d : -1,
      };
    });
    (Array.isArray(f.l) ? f.l : []).forEach(function (e) {
      var key = Array.isArray(e) && C.FH_KEYS[e[0]];
      if (!key) return;
      s.fh.log[key] = { a: int(e[1], 0, 1e6, 0), b: int(e[2], 0, 1e6, 0), g: int(e[3], 0, 1e8, 0), u: int(e[4], 0, 1e4, 0), nf: int(e[5], 0, 1e4, 0) };
    });
    return s;
  };
})(window.Farm = window.Farm || {});
