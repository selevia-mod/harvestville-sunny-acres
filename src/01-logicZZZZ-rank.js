// Town Rank and the Hall of Fame, the rules (owner, 6 Nov 2026; the words and numbers: 00-zzzzzzzzzzz-rank.js; the
// world and the pages: 19zzzz-rank.js; the server: supabase/farm_online_22.sql).
//   Town Rank: what you do earns points (L.rankAdd), each kind capped per day by Manila's clock, as the server caps it.
//   The month's tally starts over on the 1st, Manila time; your best rank ever stays. Points wait in the save until the
//   game sends them (L.rankTake: each send has its own id, so a send that is tried again never counts twice).
//   The Hall of Fame: what each plaque says, from the server's answer (L.hallShape), and which hunts win a "first".
// Saved: s.tr as 'tr'. The hall is saved as the park (which is saved as town: 01-logicZZZ-park.js), so a game closed in
// the hall opens again on the park road.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var RK = C.RANK;
  var HALL = C.HALL;
  var WI = C.WILD;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var DAY = 864e5, MANILA = 8 * 3600e3; // (Manila is UTC+8 all year: no summer time)

  // the first-time tours (19zzzz-rank.js). Appended last: a tip is its place in a saved number.
  C.TIPS.push({ key: 'rank_tour', text: 'TOWN RANK' }, { key: 'hall_tour', text: 'THE HALL OF FAME' });

  // ---------- Manila's calendar ----------
  // month: a number (year x 12 + month 0-11); day: days since 1 Jan 1970 in Manila; next: when the next month starts (ms).
  L.manila = function (ms) {
    var t = (ms == null ? L.clock() : ms) + MANILA, d = new Date(t), y = d.getUTCFullYear(), mo = d.getUTCMonth();
    return { y: y, mo: mo, d: d.getUTCDate(), month: y * 12 + mo, day: Math.floor(t / DAY), next: Date.UTC(y, mo + 1, 1) - MANILA };
  };
  L.monthName = function (month) { return C.MONTHS[((month % 12) + 12) % 12]; };
  L.monthKey = function (month) { var mo = (month % 12) + 1; return Math.floor(month / 12) + '-' + (mo < 10 ? '0' : '') + mo; };
  // days left until the board starts over (1 on the last day of the month)
  L.rankDaysLeft = function (ms) { var now = ms == null ? L.clock() : ms; return Math.max(1, Math.ceil((L.manila(now).next - now) / DAY)); };

  // ---------- the tally ----------
  var fresh = function () { return { m: 0, p: 0, d: 0, dd: {}, q: {}, b: 0, out: [], fq: [], fd: [] }; };
  // The tally as of now: a new month empties it (points not yet sent from last month go too: it started over), a new
  // day empties today's caps.
  L.rankNow = function (s, ms) {
    var t = s.tr = s.tr || fresh(), now = L.manila(ms);
    if (t.m !== now.month) {
      if (t.m) t.out = []; // (last month's sends: the server would count them in this month)
      t.m = now.month;
      t.p = 0;
      t.q = {};
      t.dd = {};
      t.d = now.day;
    }
    if (t.d !== now.day) { t.d = now.day; t.dd = {}; }
    return t;
  };
  // Adds points of one kind (capped by today's room for that kind). Returns how many counted.
  L.rankAdd = function (s, src, n, ms) {
    var def = RK.sources[src];
    n = Math.floor(Number(n));
    if (!s || !def || !(n > 0)) return 0;
    var t = L.rankNow(s, ms), got = Math.min(n, def.day - (t.dd[src] || 0));
    if (got <= 0) return 0;
    t.dd[src] = (t.dd[src] || 0) + got;
    t.q[src] = (t.q[src] || 0) + got;
    t.p += got;
    t.b = Math.max(t.b, L.rankTier(t.p));
    return got;
  };
  // 0 = none yet, 1 Bronze, 2 Silver, 3 Gold, 4 Champion
  L.rankTier = function (points) {
    var k = 0;
    RK.tiers.forEach(function (t, i) { if (points >= t.at) k = i + 1; });
    return k;
  };
  L.rankTierDef = function (k) { return RK.tiers[k - 1] || null; };
  // the next rank and the points still to go (null at Champion)
  L.rankNext = function (points) {
    var k = L.rankTier(points), t = RK.tiers[k];
    return t ? { tier: k + 1, def: t, need: t.at - points } : null;
  };
  // What today still has room for, by kind ({ farm: 120, ... }).
  L.rankRoom = function (s, ms) {
    var t = L.rankNow(s, ms), out = {};
    RK.order.forEach(function (k) { out[k] = Math.max(0, RK.sources[k].day - (t.dd[k] || 0)); });
    return out;
  };

  // ---------- sending ----------
  var uuid = function () {
    var h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'[Math.floor(Math.random() * 4)] + h.slice(17, 20) + '-' + h.slice(20, 32);
  };
  // What to send: [{ id, src, n }], one for each kind waiting. Sends not yet answered come back the same (the same id:
  // the server counts an id once), then the new points with new ids. The points move out of the queue into `out`.
  L.rankTake = function (s, ms) {
    var t = L.rankNow(s, ms);
    RK.order.forEach(function (k) {
      var n = t.q[k] || 0;
      if (n <= 0) return;
      delete t.q[k];
      t.out.push({ id: uuid(), src: k, n: n });
    });
    return t.out.slice();
  };
  // A send the server answered (counted or not): it is done.
  L.rankSent = function (s, id) {
    var t = s.tr;
    if (t) t.out = t.out.filter(function (o) { return o.id !== id; });
  };
  // The server's word on our month: our best rank ever (it saw every month).
  L.rankServer = function (s, r) {
    if (!r || typeof r !== 'object') return;
    var t = s.tr = s.tr || fresh();
    t.b = Math.max(t.b, int(r.best, 0, 4, 0), int(r.tier, 0, 4, 0));
  };

  // ---------- what earns points ----------
  var add = function (s, src, n) { if (s && !s.isVisit) L.rankAdd(s, src, n); };
  var bump = L.bump;
  L.bump = function (s, c, n) {
    bump.apply(L, arguments);
    var k = n == null ? 1 : n, H = RK.help;
    if (!(k > 0)) return;
    if (c === 'harvest' || c === 'collect') add(s, 'farm', k * RK.sources.farm.each);
    else if (c === 'hunt') add(s, 'hunt', k * RK.sources.hunt.each);
    else if (c === 'request') add(s, 'help', k * H.request);
    else if (c === 'order') add(s, 'help', k * H.order);
  };
  var catchFish = L.catchFish;
  L.catchFish = function (s) {
    var r = catchFish.apply(L, arguments);
    if (typeof r === 'string' && r[0] !== '!') add(s, 'fish', RK.sources.fish.each);
    return r;
  };
  var cook = L.cook;
  L.cook = function (s) {
    var r = cook.apply(L, arguments);
    if (r === 'ok') add(s, 'goods', RK.sources.goods.each);
    return r;
  };
  var collectJobs = L.collectJobs;
  L.collectJobs = function (s) {
    var r = collectJobs.apply(L, arguments);
    if (Array.isArray(r) && r.length) add(s, 'goods', r.length * RK.sources.goods.each);
    return r;
  };
  if (L.twFill) {
    var twFill = L.twFill;
    L.twFill = function (s) {
      var r = twFill.apply(L, arguments);
      if (r && typeof r === 'object') add(s, 'help', RK.help.crate + (r.prize ? RK.help.cargo : 0));
      return r;
    };
  }
  // the Mine: one for each rock broken (the world calls this: 19zzzz-rank.js)
  L.rankRock = function (s) { add(s, 'mine', RK.sources.mine.each); };

  // ---------- firsts ----------
  // The first a hunt on `map` (the Lair's floor, if it is the Lair) wins, if any: its key.
  L.hallFirstOf = function (map, kind, floor) {
    var f = HALL.FIRSTS.filter(function (x) { return x.map === map && x.kind === kind && (x.floor == null || x.floor === floor); })[0];
    return f ? f.key : null;
  };
  L.hallFirst = function (key) { return HALL.FIRSTS.filter(function (x) { return x.key === key; })[0] || null; };
  // A first to claim: once each (fd: the server answered; fq: waiting to be sent).
  L.hallWant = function (s, key) {
    if (!L.hallFirst(key) || !s || s.isVisit) return false;
    var t = s.tr = s.tr || fresh();
    if (t.fd.indexOf(key) >= 0 || t.fq.indexOf(key) >= 0) return false;
    t.fq.push(key);
    return true;
  };
  L.hallClaimed = function (s, key) {
    var t = s.tr;
    if (!t) return;
    t.fq = t.fq.filter(function (k) { return k !== key; });
    if (t.fd.indexOf(key) < 0) t.fd.push(key);
  };

  // ---------- what a plaque says ----------
  var nm = function (v) { return (L.cleanName ? L.cleanName(v) : L.cleanText(v, 24)) || 'Farmer'; };
  var kgText = function (kg10) { return (Math.round(Number(kg10)) / 10).toFixed(1) + ' kg'; };
  var gText = function (g) { g = Math.round(Number(g)); return g >= 1000 ? (g / 1000).toFixed(2) + ' kg' : g + ' g'; };
  var icon = function (k) { return C.ICON[k] != null ? C.ICON[k] : C.ICON.star; };
  var animalIcon = function (kind) { var a = WI.animals[kind]; return a && a.drops && C.ITEMS[a.drops[0][0]] ? C.ITEMS[a.drops[0][0]].icon : C.ICON.star; };
  // the animals of a hunting place, in the Hunter's Book's order (not the Lair's creatures)
  L.hallAreaAnimals = function (area) {
    var a = WI.areas[area];
    if (!a) return [];
    var kinds = Object.keys(a.animals || {}).concat((a.extra || []).map(function (e) { return e.kind; }));
    return WI.order.filter(function (k) { return kinds.indexOf(k) >= 0 && WI.animals[k] && !WI.animals[k].lair; });
  };
  // every animal some plaque or pedestal shows
  var shown = function () {
    var out = {};
    Object.keys(HALL.spots).forEach(function (k) {
      var sp = HALL.spots[k];
      if (sp.kind === 'catch') L.hallAreaAnimals(sp.area).forEach(function (a) { out[a] = 1; });
      if (sp.kind === 'animal') out[sp.animal] = 1;
    });
    return out;
  };
  var FISH = ['fish_s', 'fish_m', 'fish_l', 'fish_k'];

  // A plaque's title and rows ([[icon frame, text]]) from the server's farm_hall_v1 answer (null: not online, or not
  // yet answered). me = our player id; s = our game (our own bests). Every name is cleaned (it is someone's typing).
  L.hallShape = function (spotKey, data, me, s) {
    var sp = HALL.spots[spotKey];
    if (!sp) return null;
    var out = { title: sp.title, rows: [], kind: sp.kind };
    var you = function (id) { return me && id === me ? '  ' + HALL.you : ''; };
    var row = function (ic, text) { out.rows.push([ic, text]); };
    var best = function (kind) { var b = s && s.wild && s.wild.best && s.wild.best[kind]; return b ? ' (yours: ' + kgText(b) + ')' : ''; };
    if (sp.kind === 'soon') { row(icon(sp.icon), HALL.soon); return out; }
    if (!data || typeof data !== 'object') {
      row(C.ICON.exclaim, data === false ? HALL.loading : data === 'soon' ? HALL.later : HALL.offline);
      if (sp.kind === 'animal' && s && s.wild && s.wild.best && s.wild.best[sp.animal]) row(animalIcon(sp.animal), 'Your biggest ' + WI.animals[sp.animal].name + ': ' + kgText(s.wild.best[sp.animal]) + '.');
      return out;
    }
    var list = function (v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; };
    var catchOf = function (kind) { return list(data.catches).filter(function (c) { return c.kind === kind; })[0] || null; };
    var catchRow = function (kind) {
      var a = WI.animals[kind], c = catchOf(kind), n = a ? a.name : String(kind);
      if (!c) return row(animalIcon(kind), n + ': nobody yet. Be the first!' + best(kind));
      row(animalIcon(kind), n + ': ' + nm(c.name) + ', ' + kgText(c.kg10) + you(String(c.id)) + (String(c.id) === me ? '' : best(kind)));
    };
    var firstRow = function (key) {
      var f = L.hallFirst(key), c = list(data.firsts).filter(function (x) { return x.key === key; })[0];
      var what = f ? f.name : key;
      if (!c) return row(C.ICON.star, 'First to beat ' + what + ': nobody yet. It could be you!');
      row(C.ICON.star, 'First to beat ' + what + ': ' + nm(c.name) + you(String(c.id)));
    };
    if (sp.kind === 'catch') L.hallAreaAnimals(sp.area).forEach(catchRow);
    else if (sp.kind === 'animal') catchRow(sp.animal);
    else if (sp.kind === 'more') {
      var seen = shown(), more = list(data.catches).filter(function (c) { return !seen[c.kind]; });
      more.forEach(function (c) { catchRow(c.kind); });
      if (!more.length) row(icon(sp.icon), 'New hunting places will put their records here.');
    } else if (sp.kind === 'fish') {
      var kinds = FISH.concat(list(data.fish).map(function (f) { return f.kind; }).filter(function (k) { return FISH.indexOf(k) < 0 && C.ITEMS[k]; }));
      kinds.forEach(function (k) {
        var f = list(data.fish).filter(function (x) { return x.kind === k; })[0], n = C.ITEMS[k] ? C.ITEMS[k].name : k;
        if (!f) return row(icon(k), n + ': nobody yet. Fish on a Monday!');
        row(icon(k), n + ': ' + nm(f.name) + ', ' + gText(f.g) + you(String(f.id)));
      });
    } else if (sp.kind === 'firsts') sp.keys.forEach(firstRow);
    else if (sp.kind === 'first') firstRow(sp.key);
    else if (sp.kind === 'champs') {
      var ch = data.champs && typeof data.champs === 'object' ? data.champs : {}, last = list(ch.last), most = list(ch.most);
      var month = typeof ch.month === 'string' && /^\d{4}-\d{2}$/.test(ch.month) ? C.MONTHS[Number(ch.month.slice(5)) - 1] : 'Last month';
      if (!last.length) row(C.ICON.ribbon, month + ': no Champion yet. ' + RK.tiers[3].at.toLocaleString('en-US') + ' points in a month makes one.');
      last.slice(0, 3).forEach(function (c) { row(C.ICON.ribbon, month + "'s Champion: " + nm(c.name) + ', ' + int(c.points, 0, 1e9, 0).toLocaleString('en-US') + ' points' + you(String(c.id))); });
      if (!sp.last) {
        if (!most.length) row(C.ICON.star, 'Most Champion months: nobody yet.');
        most.slice(0, 3).forEach(function (c) { var n = int(c.months, 0, 9999, 0); row(C.ICON.star, 'Most Champion months: ' + nm(c.name) + ', ' + n + ' month' + (n === 1 ? '' : 's') + you(String(c.id))); });
      }
    } else if (sp.kind === 'top') {
      var top = list(data.top).slice(0, 10);
      if (!top.length) row(C.ICON.star, 'Nobody has points this month yet. Be the first!');
      top.forEach(function (r, i) {
        var tier = L.rankTierDef(int(r.tier, 0, 4, 0));
        row(C.ICON.star, '#' + (int(r.rank, 1, 999, i + 1)) + ' ' + nm(r.name) + ', ' + int(r.points, 0, 1e9, 0).toLocaleString('en-US') + (tier ? ' (' + tier.name + ')' : '') + you(String(r.id)));
      });
    } else if (sp.kind === 'bayanihan') {
      var b = list(data.more).filter(function (x) { return x.key === 'bayanihan'; })[0];
      var rows = b ? list(b.rows) : [];
      if (!b) row(C.ICON.gift, 'Coming soon: the Bayanihan Project\'s top givers will hang here.');
      else if (!rows.length) row(C.ICON.gift, 'Nobody has given yet. Be the first!');
      rows.slice(0, 5).forEach(function (r, i) { row(C.ICON.gift, '#' + (i + 1) + ' ' + nm(r.name) + (r.text ? ', ' + L.cleanText(String(r.text), 30) : '') + you(String(r.id))); });
    }
    return out;
  };

  // ---------- the save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s.map === 'hall' ? Object.assign({}, s, { map: 'park' }) : s); // (the hall: saved as the park, so the park road)
    var t = s.tr;
    if (t && (t.m || t.b || t.fq.length || t.fd.length)) {
      var arr = function (m) { return RK.order.map(function (k) { return m[k] || 0; }); };
      o.tr = { m: t.m, p: t.p, d: t.d, dd: arr(t.dd), q: arr(t.q), b: t.b };
      if (t.out.length) o.tr.o = t.out.map(function (x) { return [x.id, RK.order.indexOf(x.src), x.n]; });
      if (t.fq.length) o.tr.fq = t.fq.slice();
      if (t.fd.length) o.tr.fd = t.fd.slice();
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var t = fresh(), r = o && o.tr;
    if (r && typeof r === 'object') {
      var m = function (a, cap) {
        var out = {};
        (Array.isArray(a) ? a : []).forEach(function (v, i) { var k = RK.order[i]; if (k) { v = int(v, 0, cap ? RK.sources[k].day : 1e6, 0); if (v) out[k] = v; } });
        return out;
      };
      t.m = int(r.m, 0, 1e6, 0);
      t.p = int(r.p, 0, 1e9, 0);
      t.d = int(r.d, 0, 1e7, 0);
      t.dd = m(r.dd, true);
      t.q = m(r.q, false);
      t.b = int(r.b, 0, 4, 0);
      t.out = (Array.isArray(r.o) ? r.o : []).filter(function (x) {
        return Array.isArray(x) && typeof x[0] === 'string' && /^[0-9a-f-]{36}$/.test(x[0]) && RK.order[x[1]] && int(x[2], 0, 1e6, 0) > 0;
      }).map(function (x) { return { id: x[0], src: RK.order[x[1]], n: int(x[2], 1, 1e6, 1) }; });
      var keys = function (a) { return (Array.isArray(a) ? a : []).filter(function (k, i, all) { return L.hallFirst(k) && all.indexOf(k) === i; }); };
      t.fd = keys(r.fd);
      t.fq = keys(r.fq).filter(function (k) { return t.fd.indexOf(k) < 0; });
    }
    s.tr = t;
    return s;
  };
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.tr = fresh();
    return s;
  };
})(window.Farm = window.Farm || {});
