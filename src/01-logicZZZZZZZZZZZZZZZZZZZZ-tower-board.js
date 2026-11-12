// The Lost Tower's weekly board and First in Selebox, the rules (words and numbers 00-zzzzzzzzzzzzzzzzzzzzzzzz-tower-board.js,
// the world and pages 19zzz...z-tower-board.js, the server supabase/farm_tower_board.sql). Pure, no Phaser:
// - a floor cleared the first time (L.towerPay: the deepest cleared goes up) waits to be sent to the server
//   (L.towerBoardTake: each send has its own id, the same until answered; L.towerBoardSent: the floors the server has go,
//   the rest wait: today's cap was full);
// - Manila's week (Monday 00:00 to Monday 00:00) and the days left;
// - last week's prize from the server's claim, added to s.pearls once by the claim's id (L.towerPrizePay);
// - what the lighthouse wall says (the ten big bosses' firsts) and the board's rows, every name cleaned.
// Saved: s.twr as 'twr' { q: floors waiting, o: [send id, floors ...], p: claim ids paid }.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var BD = C.TOWER_BOARD;
  var TW = C.TOWER;
  var HALL = C.HALL;
  if (!BD || !TW) return;
  var DAY = 864e5, MANILA = 8 * 3600e3;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var uuid = function () {
    var h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'[Math.floor(Math.random() * 4)] + h.slice(17, 20) + '-' + h.slice(20, 32);
  };
  var fresh = function () { return { q: [], out: null, paid: [] }; };
  var rec = function (s) { return s.twr || (s.twr = fresh()); };
  L.towerBoardRec = rec;
  var okFloor = function (f) { return f === Math.floor(f) && f >= 1 && f <= TW.floors; };

  // ---------- new floors, to the server ----------
  // A floor cleared for the first time: it waits to be sent (once; the newest BD.queue kept). true: added.
  L.towerBoardAdd = function (s, f) {
    f = Number(f);
    if (!s || s.isVisit || !okFloor(f)) return false;
    var r = rec(s);
    if (r.q.indexOf(f) >= 0 || (r.out && r.out.f.indexOf(f) >= 0)) return false;
    r.q.push(f);
    if (r.q.length > BD.queue) r.q.splice(0, r.q.length - BD.queue);
    return true;
  };
  var towerPay = L.towerPay;
  L.towerPay = function (s) {
    var r = L.towerRec(s), was = r.cl, n = towerPay.apply(L, arguments);
    if (r.cl > was) L.towerBoardAdd(s, r.cl);
    return n;
  };
  // What to send: { id, f: [floors] } (up to BD.perSend), or null. A send not yet answered comes back the same (same id).
  L.towerBoardTake = function (s) {
    var r = rec(s);
    if (!r.out && r.q.length) r.out = { id: uuid(), f: r.q.splice(0, BD.perSend) };
    return r.out ? { id: r.out.id, f: r.out.f.slice() } : null;
  };
  // The server answered send `id`: took = the floors it has (counted now, or before). They are done; the others go back to
  // the front of the queue (today's cap was full: they count another day). Returns how many are done.
  L.towerBoardSent = function (s, id, took) {
    var r = rec(s);
    if (!r.out || r.out.id !== id) return 0;
    var have = (Array.isArray(took) ? took : []).map(Number), left = r.out.f.filter(function (f) { return have.indexOf(f) < 0; });
    var done = r.out.f.length - left.length;
    r.out = null;
    r.q = left.concat(r.q.filter(function (f) { return left.indexOf(f) < 0; }));
    return done;
  };
  L.towerBoardWaiting = function (s) { var r = rec(s); return r.q.length + (r.out ? r.out.f.length : 0); };

  // ---------- Manila's week ----------
  // day: Manila's day number of this week's Monday; next: when the next week starts (ms); key: 'YYYY-MM-DD' (the server's week)
  L.towerWeek = function (ms) {
    var t = (ms == null ? L.clock() : ms) + MANILA, day = Math.floor(t / DAY), monday = day - (day + 3) % 7; // (1 Jan 1970 was a Thursday)
    return { day: monday, next: (monday + 7) * DAY - MANILA, key: new Date(monday * DAY).toISOString().slice(0, 10) };
  };
  L.towerWeekLeft = function (ms) { var now = ms == null ? L.clock() : ms; return Math.max(1, Math.ceil((L.towerWeek(now).next - now) / DAY)); };

  // ---------- last week's prize ----------
  // What a place pays (the server's numbers are the ones that pay): places 1-10, else 10 Pearls for 10+ new floors.
  L.towerPrizeFor = function (rank, floors) {
    rank = int(rank, 0, 1e7, 0);
    floors = int(floors, 0, TW.floors, 0);
    if (floors > 0 && rank >= 1 && rank <= BD.prizes.length) return BD.prizes[rank - 1];
    return floors >= BD.every.floors ? BD.every.pearls : 0;
  };
  // The server's claim { ok, id, week, rank, floors, pearls, frame, title }: its Pearls added to s.pearls once, by its id
  // (a claim asked again, or answered twice, never pays twice). Returns the Pearls added.
  L.towerPrizePay = function (s, c) {
    if (!s || s.isVisit || !c || typeof c !== 'object' || c.ok !== true || typeof c.id !== 'string') return 0;
    var id = c.id.toLowerCase(), n = int(c.pearls, 0, 1000, 0), r = rec(s);
    if (!ID.test(id) || !n || r.paid.indexOf(id) >= 0) return 0;
    r.paid.push(id);
    if (r.paid.length > 12) r.paid.splice(0, r.paid.length - 12); // (only last week's claim is ever asked: old ids never come back)
    s.pearls = (s.pearls || 0) + n;
    return n;
  };

  // ---------- what the wall and the board say ----------
  var nm = function (v) { return (L.cleanName ? L.cleanName(v) : L.cleanText(v, 24)) || 'Farmer'; };
  var list = function (v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; };
  // The lighthouse wall's rows ([[icon, text]]) from the Hall of Fame's answer (farm_hall_v1: its 'firsts'); data null: not
  // online, false: reading, 'soon': no Hall on the server yet. A boss nobody has beaten, and you have not reached: '???'.
  L.towerWallRows = function (data, me, s) {
    var star = C.ICON.star, rows = [];
    if (!data || typeof data !== 'object') {
      rows.push([C.ICON.exclaim, data === false ? HALL.loading : data === 'soon' ? HALL.later : HALL.offline]);
      return rows;
    }
    var deep = s ? L.towerRec(s).deep : 0, firsts = list(data.firsts);
    TW.zones.forEach(function (z) {
      var key = 'tower_' + z.to, c = firsts.filter(function (x) { return x.key === key; })[0];
      var boss = c || deep >= z.to ? C.WILD.animals[z.boss].name : '???';
      rows.push([star, 'Floor ' + z.to + ', ' + boss + ': ' + (c ? nm(c.name) + (me && String(c.id) === me ? '  ' + HALL.you : '') : 'nobody yet.')]);
    });
    return rows;
  };
  // The board's answer (farm_tower_board_v1), checked: { week, top: [{ rank, id, name, floors, you }] (10), me: { rank,
  // floors }, champ: { id, name, floors, you } | null } (champ: last week's first, the Lighthouse Champion).
  L.towerBoardShape = function (r, me) {
    if (!r || typeof r !== 'object') return null;
    var you = function (id) { return !!me && String(id) === me; };
    var top = list(r.top).slice(0, 10).map(function (x, i) {
      return { rank: int(x.rank, 1, 1e7, i + 1), id: String(x.id), name: nm(x.name), floors: int(x.floors, 0, TW.floors, 0), you: you(x.id) };
    });
    var m = r.me && typeof r.me === 'object' ? r.me : {}, ch = r.champ && typeof r.champ === 'object' && r.champ.id ? r.champ : null;
    return {
      week: typeof r.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.week) ? r.week : '',
      top: top,
      me: { rank: int(m.rank, 0, 1e7, 0), floors: int(m.floors, 0, TW.floors, 0) },
      champ: ch ? { id: String(ch.id), name: nm(ch.name), floors: int(ch.floors, 0, TW.floors, 0), you: you(ch.id) } : null,
    };
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.twr = fresh();
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), r = s.twr;
    if (r && (r.q.length || r.out || r.paid.length)) {
      o.twr = { q: r.q.slice() };
      if (r.out) o.twr.o = [r.out.id].concat(r.out.f);
      if (r.paid.length) o.twr.p = r.paid.slice();
    }
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var t = fresh(), w = o && o.twr && typeof o.twr === 'object' ? o.twr : null;
    if (w) {
      var seen = {}, floors = function (a) {
        return (Array.isArray(a) ? a : []).map(Number).filter(function (f) { if (!okFloor(f) || seen[f]) return false; seen[f] = 1; return true; });
      };
      if (Array.isArray(w.o) && typeof w.o[0] === 'string' && ID.test(w.o[0])) {
        var f = floors(w.o.slice(1, 1 + BD.perSend));
        if (f.length) t.out = { id: w.o[0], f: f };
      }
      t.q = floors(w.q).slice(-BD.queue);
      t.paid = (Array.isArray(w.p) ? w.p : []).filter(function (id) { return typeof id === 'string' && ID.test(id); }).slice(-12);
    }
    s.twr = t;
    return s;
  };
})(window.Farm = window.Farm || {});
