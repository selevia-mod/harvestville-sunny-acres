// The Manila Cup and Race Day, the rules (numbers 00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-cup.js, the world
// 19zzz...z-manila-cup.js, the server supabase/farm_manila_cup.sql). Pure, no Phaser:
// - Manila's cup week (Monday 8 AM to Sunday 7 PM) and the tries (the first of a Manila day free, then C.MANILA_CUP.tryGold);
// - the track: the oval's centre line (a rounded rectangle from the layout), where a rider is along it, the hurdles on it;
// - a ride (L.mcTrialStep, a frame at a time): the sprint bar (its own, never the horse's stamina), jumps, knocked
//   hurdles, laps; a perfect ride (the floor no lap may beat, here and on the server);
// - the week's best (sent to the server once), the 3-runs reward, the board's prize paid once by its claim's id;
// - Race Day: each race's horses, odds and (only once it has started) its result, from its number alone; bets, the limits,
//   paying by the clock (a bet survives closing the game).
// Saved: s.mc as 'mc'.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var MC = C.MANILA_CUP;
  var RD = C.RACE_DAY;
  var M = C.MANILA;
  if (!MC || !MC.on) return;
  var DAY = 864e5, MANILA = 8 * 3600e3, MIN = 60000;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var uuid = function () {
    var h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'[Math.floor(Math.random() * 4)] + h.slice(17, 20) + '-' + h.slice(20, 32);
  };
  var now = function (ms) { return ms == null ? L.clock() : ms; };
  var mday = function (ms) { return Math.floor((now(ms) + MANILA) / DAY); };

  // ---------- the week ----------
  // day: Manila's day number of its Monday; key: 'YYYY-MM-DD' (the server's week); open, close: ms; on: open now; done:
  // the Monday of the latest week whose results are out (its Sunday 7 PM has passed)
  L.mcWeek = function (ms) {
    var t = now(ms), day = mday(t), mon = day - (day + 3) % 7; // (1 Jan 1970 was a Thursday)
    var open = mon * DAY + MC.open * MIN - MANILA, close = (mon + 6) * DAY + MC.close * MIN - MANILA;
    return { day: mon, key: new Date(mon * DAY).toISOString().slice(0, 10), open: open, close: close, on: t >= open && t < close, done: t >= close ? mon : mon - 7 };
  };

  // ---------- the track ----------
  // The centre line of the oval (2 tiles wide), a rounded rectangle, clockwise on the screen: up the west side through the
  // arch (the start and finish, s = 0), east along the top in front of the grandstand, down the east side, west along the
  // bottom. s: tiles along it from the line.
  var TB = M.ground.filter(function (g) { return g[0] === 'track'; })[0], R = MC.radius;
  var X0 = TB[1] + 1, Y0 = TB[2] + 1, X1 = TB[1] + TB[3] - 1, Y1 = TB[2] + TB[4] - 1;
  var IX0 = X0 + R, IY0 = Y0 + R, IX1 = X1 - R, IY1 = Y1 - R, QA = Math.PI * R / 2;
  var SEG = [ // from the top of the west side's arc, clockwise: [kind, start u, ...]
    ['a', IX0, IY0, Math.PI], ['h', IY0 - R, IX0, IX1], ['a', IX1, IY0, -Math.PI / 2], ['v', IX1 + R, IY0, IY1],
    ['a', IX1, IY1, 0], ['h', IY1 + R, IX1, IX0], ['a', IX0, IY1, Math.PI / 2], ['v', IX0 - R, IY1, IY0],
  ];
  var LEN = 0;
  SEG.forEach(function (g) { g.u = LEN; g.len = g[0] === 'a' ? QA : Math.abs(g[3] - g[2]); LEN += g.len; });
  var uOf = function (bx, by, k) { // where on segment k a point of it is
    var g = SEG[k];
    if (g[0] === 'a') { var a = Math.atan2(by - g[2], bx - g[1]) - g[3]; while (a < -0.5) a += 2 * Math.PI; while (a > 2 * Math.PI - 0.5) a -= 2 * Math.PI; return g.u + Math.max(0, Math.min(QA, a * R)); }
    return g.u + Math.abs((g[0] === 'h' ? bx : by) - g[2]);
  };
  var U0 = uOf(X0, MC.arch[1] + MC.arch[3] / 2, 7); // the arch's middle on the west side
  var wrap = function (u) { u %= LEN; return u < 0 ? u + LEN : u; };
  // Where a point (in tiles) is: { s: along the line (0 to LEN), off: how far out of it (+ outside, - inside) }
  L.mcProj = function (px, py) {
    var qx = Math.max(IX0, Math.min(IX1, px)), qy = Math.max(IY0, Math.min(IY1, py)), dx = px - qx, dy = py - qy, d = Math.sqrt(dx * dx + dy * dy), k;
    if (d > 1e-9) {
      var bx = qx + dx / d * R, by = qy + dy / d * R, W = px < IX0, E = px > IX1, N = py < IY0, S = py > IY1;
      k = N && W ? 0 : N && E ? 2 : S && E ? 4 : S && W ? 6 : N ? 1 : E ? 3 : S ? 5 : 7;
      return { s: wrap(uOf(bx, by, k) - U0), off: d - R };
    }
    var ds = [py - IY0, IX1 - px, IY1 - py, px - IX0], m = 0; // (inside the inner rectangle: the nearest side)
    for (k = 1; k < 4; k++) if (ds[k] < ds[m]) m = k;
    var sx = m === 1 ? IX1 + R : m === 3 ? IX0 - R : px, sy = m === 0 ? IY0 - R : m === 2 ? IY1 + R : py;
    return { s: wrap(uOf(sx, sy, m * 2 + 1) - U0), off: -(ds[m] + R) };
  };
  // The point s along the line, off tiles out of it (+ outside), and the way it goes there ({ x, y, dx, dy })
  L.mcPoint = function (s, off) {
    var u = wrap(s + U0), k = 0;
    while (k < 7 && u >= SEG[k + 1].u) k++;
    var g = SEG[k], t = u - g.u, x, y, dx, dy, o = off || 0;
    if (g[0] === 'a') { var a = g[3] + t / R; x = g[1] + Math.cos(a) * (R + o); y = g[2] + Math.sin(a) * (R + o); dx = -Math.sin(a); dy = Math.cos(a); }
    else if (g[0] === 'h') { var sg = g[3] > g[2] ? 1 : -1; x = g[2] + sg * t; y = g[1] - sg * o; dx = sg; dy = 0; }
    else { var sv = g[3] > g[2] ? 1 : -1; x = g[1] + sv * o; y = g[2] + sv * t; dx = 0; dy = sv; }
    return { x: x, y: y, dx: dx, dy: dy };
  };
  L.mcLen = function () { return LEN; };
  // On the track (a tile of the ring, not its cut corners, not the grass inside)
  L.mcOnTrack = function (x, y) {
    var tx = Math.floor(x), ty = Math.floor(y);
    if (tx < TB[1] || ty < TB[2] || tx >= TB[1] + TB[3] || ty >= TB[2] + TB[4]) return false;
    if (tx >= TB[1] + 2 && ty >= TB[2] + 2 && tx < TB[1] + TB[3] - 2 && ty < TB[2] + TB[4] - 2) return false;
    return !M.trackCorners.some(function (c) { return c[0] === tx && c[1] === ty; });
  };
  // the hurdles: where each is along the line (the decor's hurdles, by their middles), in order round the lap
  var HURDLES = M.decor.filter(function (d) { return d[0] === 'hurdle'; }).map(function (d) { return { x: d[1], y: d[2], w: d[3], h: d[4], s: L.mcProj(d[1] + d[3] / 2, d[2] + d[4] / 2).s }; })
    .sort(function (a, b) { return a.s - b.s; });
  L.mcHurdles = function () { return HURDLES; };
  // where a rider starts: 2.2 tiles before the line, in the middle of the track
  L.mcStart = function () { var p = L.mcPoint(-2.2, 0); return { x: p.x, y: p.y, dir: 'up' }; };

  // ---------- a perfect ride ----------
  // Riding the inner edge of the track (the shortest way round), at the horse's top speed, sprinting the whole bar each lap,
  // never knocking a hurdle. No lap may be under MC.floor of it (here and on the server).
  L.mcPerfect = function () {
    var v = C.SPEED * C.HORSE.speed / C.TILE, inner = 2 * (TB[3] - 4) + 2 * (TB[4] - 4), sp = v * MC.sprint.mult * MC.sprint.ms / 1000;
    var lap = Math.round((sp >= inner ? inner / (v * MC.sprint.mult) : (inner - sp) / v + MC.sprint.ms / 1000) * 1000);
    return { lap: lap, total: lap * MC.laps, floor: Math.floor(lap * MC.floor) };
  };
  L.mcValid = function (laps, knocks) {
    var f = L.mcPerfect().floor;
    return Array.isArray(laps) && laps.length === MC.laps && laps.every(function (x) { return x === Math.floor(x) && x >= f && x < 600000; }) && knocks === Math.floor(knocks) && knocks >= 0 && knocks <= MC.laps * 6;
  };
  L.mcTotal = function (laps, knocks) { return laps.reduce(function (a, x) { return a + x; }, 0) + knocks * MC.knockMs; };

  // ---------- a ride, a frame at a time ----------
  // t: { ms (riding time), laps: [ms], lapAt, s (where along the line), d (along this lap; it starts a little before the
  // line), bar (the sprint bar, 0-1), air (ms left in the air), gap, knocks, hd (this lap's hurdles passed, bits), done }
  L.mcTrialNew = function () { return { ms: 0, laps: [], lapAt: 0, s: null, d: 0, bar: 1, air: 0, gap: 0, knocks: 0, hd: 0, done: false, sprinting: false }; };
  // dt ms; x, y: the rider's feet in tiles; sprint: the button held; jump: tapped. { mult: the speed (1 riding, more
  // sprinting, less off the track), ev: ['jump', 'land', 'clear', 'knock', 'lap', 'finish'] }
  L.mcTrialStep = function (t, dt, x, y, sprint, jump) {
    var ev = [];
    if (t.done) return { mult: 0, ev: ev };
    t.ms += dt;
    if (t.air > 0) { t.air -= dt; if (t.air <= 0) { t.air = 0; t.gap = MC.jump.gap; ev.push('land'); } } else if (t.gap > 0) t.gap = Math.max(0, t.gap - dt);
    if (jump && t.air <= 0 && t.gap <= 0) { t.air = MC.jump.ms; ev.push('jump'); }
    var mult = 1;
    t.sprinting = !!sprint && t.bar > 0;
    if (t.sprinting) { t.bar = Math.max(0, t.bar - dt / MC.sprint.ms); mult = MC.sprint.mult; }
    if (!L.mcOnTrack(x, y)) mult *= MC.off;
    var a = L.mcProj(x, y).s;
    if (t.s == null) { t.s = a; t.d = a > LEN / 2 ? a - LEN : a; return { mult: mult, ev: ev }; }
    var dd = a - t.s;
    if (dd > LEN / 2) dd -= LEN;
    if (dd < -LEN / 2) dd += LEN;
    t.s = a;
    if (Math.abs(dd) > 3) return { mult: mult, ev: ev }; // (across the grass inside: no way round counts)
    var was = t.d;
    t.d += dd;
    HURDLES.forEach(function (h, i) {
      if (t.hd & (1 << i) || !(was < h.s && t.d >= h.s)) return;
      t.hd |= 1 << i;
      if (t.air > 0) ev.push('clear');
      else { t.knocks++; ev.push('knock'); }
    });
    if (t.d >= LEN) {
      t.laps.push(Math.round(t.ms - t.lapAt));
      t.lapAt = t.ms;
      t.d -= LEN;
      t.hd = 0;
      t.bar = 1; // (full again at the start of each lap)
      ev.push('lap');
      if (t.laps.length >= MC.laps) { t.done = true; t.total = L.mcTotal(t.laps, t.knocks); ev.push('finish'); }
    }
    return { mult: mult, ev: ev };
  };

  // ---------- the save's record ----------
  var fresh = function () { return { wk: 0, wr: 0, wb: 0, wl: null, ev: 0, fd: -1, q: null, sent: 0, bets: [], bd: 0, bs: 0, bw: 0, bl: 0, tour: 0, paid: [] }; };
  var rec = function (s) { return s.mc || (s.mc = fresh()); };
  L.mcRec = rec;

  // ---------- the week's runs ----------
  // A new week: the last one's 3-runs reward, if it had 3 runs (paid once its results are out), then the count starts over.
  // Also pays this week's once Sunday 7 PM has passed. Returns { gold, oats, runs } paid, or null.
  var everyPay = function (s, m) {
    var e = MC.every;
    m.ev = 1;
    s.gold += e.gold;
    var left = L.addItem(s, 'oats', e.oats);
    if (left > 0) { s.basket = s.basket || {}; s.basket.oats = Math.min(999, (s.basket.oats || 0) + left); }
    return { gold: e.gold, oats: e.oats, runs: m.wr };
  };
  L.mcWeekly = function (s, ms) {
    var w = L.mcWeek(ms), m = rec(s), out = null;
    if (m.wk && m.wk !== w.day) {
      if (m.wr >= MC.every.runs && !m.ev && m.wk < w.day) out = everyPay(s, m);
      m.wk = w.day; m.wr = 0; m.wb = 0; m.wl = null; m.ev = 0; m.sent = 0;
    } else if (m.wk === w.day && now(ms) >= w.close && m.wr >= MC.every.runs && !m.ev) out = everyPay(s, m);
    if (!m.wk) m.wk = w.day;
    if (m.q && m.q.wk !== w.day) m.q = null; // (a best from a week gone: too late to count)
    return out;
  };

  // ---------- tries ----------
  L.mcTryCost = function (s, ms) { return rec(s).fd === mday(ms) ? MC.tryGold : 0; };
  // May you ride? 'ok' with the cost, or why not: 'closed', 'horse' (with why: its words), 'gold'
  L.mcCanTry = function (s, ms) {
    if (!L.mcWeek(ms).on) return { why: 'closed' };
    var r = L.horseCanRide(s, 'manila');
    if (!r.ok) return { why: 'horse', words: L.horseWhy(s, r) };
    var cost = L.mcTryCost(s, ms);
    if (s.gold < cost) return { why: 'gold', cost: cost };
    return { ok: true, cost: cost };
  };
  // Starts a try: pays for it (or uses today's free one). { ok, cost, week } or the why of L.mcCanTry
  L.mcBeginTry = function (s, ms) {
    L.mcWeekly(s, ms);
    var c = L.mcCanTry(s, ms);
    if (!c.ok) return c;
    var m = rec(s);
    if (c.cost) s.gold -= c.cost;
    else m.fd = mday(ms);
    return { ok: true, cost: c.cost, week: L.mcWeek(ms).day };
  };
  // A ride finished (t done), started at startMs: one more run this week, and the week's best if it is.
  // { ok, ms, best, runs } or { ok: false, why: 'fast' }
  L.mcFinish = function (s, t, startMs) {
    L.mcWeekly(s, startMs);
    if (!t || !t.done || !L.mcValid(t.laps, t.knocks)) return { ok: false, why: 'fast' };
    var m = rec(s), total = L.mcTotal(t.laps, t.knocks), best = !m.wb || total < m.wb;
    m.wr++;
    if (best) {
      m.wb = total;
      m.wl = t.laps.slice();
      m.q = { id: uuid(), wk: m.wk, laps: t.laps.slice(), k: t.knocks };
    }
    return { ok: true, ms: total, best: best, runs: m.wr };
  };
  // the week's best waiting for the server: { id, week (its key), laps, knocks } or null
  L.mcToSend = function (s) {
    var q = rec(s).q;
    return q ? { id: q.id, week: new Date(q.wk * DAY).toISOString().slice(0, 10), laps: q.laps.slice(), knocks: q.k } : null;
  };
  // The server answered send id ('ok': it has it; 'bad', 'fast', 'week', 'closed': it never will): it goes
  L.mcSent = function (s, id, ok) {
    var m = rec(s);
    if (!m.q || m.q.id !== id) return false;
    if (ok) m.sent = L.mcTotal(m.q.laps, m.q.k);
    m.q = null;
    return true;
  };
  L.mcTime = function (ms) { ms = Math.max(0, Math.round(ms)); var m = Math.floor(ms / 60000), sec = (ms % 60000) / 1000; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(2); };

  // ---------- the board's prize (the server's claim, paid once by its id) ----------
  L.mcPrizeFor = function (rank) {
    rank = int(rank, 0, 1e7, 0);
    if (rank < 1 || rank > MC.prizes.length) return null;
    return { gold: MC.prizes[rank - 1], piece: rank <= 3 ? MC.cups[rank - 1] : MC.ribbon, title: rank === 1 };
  };
  // c: { ok, id, week, rank, ms }: the place's Gold (the game's table) and its cup or ribbon into storage. Returns the
  // prize paid, or null (not a claim, or paid already).
  L.mcPrizePay = function (s, c) {
    if (!s || s.isVisit || !c || typeof c !== 'object' || c.ok !== true || typeof c.id !== 'string') return null;
    var id = c.id.toLowerCase(), p = L.mcPrizeFor(c.rank), m = rec(s);
    if (!ID.test(id) || !p || m.paid.indexOf(id) >= 0) return null;
    m.paid.push(id);
    if (m.paid.length > 12) m.paid.splice(0, m.paid.length - 12);
    s.gold += p.gold;
    var k = L.furnKey(C.HOME.typeIndex[p.piece], 0);
    s.home.bag[k] = (s.home.bag[k] || 0) + 1;
    return { gold: p.gold, piece: p.piece, rank: int(c.rank, 1, 10, 1), title: p.title, ms: int(c.ms, 0, 6e5, 0) };
  };
  // The board's answer (farm_mcup_board_v1), checked: { week, open, top: [{ rank, id, name, ms, you }], me: { rank, ms,
  // runs }, champ: { id, name, ms, you } | null }
  var nm = function (v) { return (L.cleanName ? L.cleanName(v) : L.cleanText(v, 24)) || 'Farmer'; };
  var list = function (v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; };
  L.mcBoardShape = function (r, me) {
    if (!r || typeof r !== 'object') return null;
    var you = function (id) { return !!me && String(id) === me; }, mm = r.me && typeof r.me === 'object' ? r.me : {};
    var ch = r.champ && typeof r.champ === 'object' && r.champ.id ? r.champ : null;
    return {
      week: typeof r.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.week) ? r.week : '',
      top: list(r.top).slice(0, 10).map(function (x, i) { return { rank: int(x.rank, 1, 1e7, i + 1), id: String(x.id), name: nm(x.name), ms: int(x.ms, 0, 6e5, 0), you: you(x.id) }; }),
      me: { rank: int(mm.rank, 0, 1e7, 0), ms: int(mm.ms, 0, 6e5, 0) },
      champ: ch ? { id: String(ch.id), name: nm(ch.name), ms: int(ch.ms, 0, 6e5, 0), you: you(ch.id) } : null,
    };
  };

  // ---------- tours (a bit each) ----------
  L.mcTourTake = function (s, key) {
    var i = MC.tours.indexOf(key), m = rec(s);
    if (i < 0 || (m.tour >> i) & 1) return false;
    m.tour |= 1 << i;
    return true;
  };

  // ---------- Race Day: the races ----------
  var PER = Math.floor((RD.last - RD.first) / RD.every) + 1; // races a day
  RD.perDay = PER;
  // a race's number: Manila's day number x PER + its place in the day; its start (ms)
  L.rdStart = function (n) { var d = Math.floor(n / PER), k = n - d * PER; return d * DAY + (RD.first + k * RD.every) * MIN - MANILA; };
  L.rdClose = function (n) { return L.rdStart(n) - RD.closeMs; };
  L.rdOpenAt = function (n) { return L.rdStart(n) - RD.every * MIN; }; // (bets open when the race before it starts)
  // The next race you can bet on (its bets not closed yet) at ms
  L.rdNext = function (ms) {
    var t = now(ms), d = mday(t), min = (t + MANILA - d * DAY) / MIN, k = Math.ceil((min + RD.closeMs / MIN - RD.first) / RD.every);
    var n = d * PER + Math.max(0, Math.min(PER, k));
    while (L.rdClose(n) <= t) n++;
    return n;
  };
  // the race running at ms (started, its result not out yet), or -1
  L.rdRunning = function (ms) { var t = now(ms), n = L.rdNext(t) - 1; return n >= 0 && t >= L.rdStart(n) && t < L.rdStart(n) + RD.resultMs ? n : -1; };
  L.rdOpen = function (n, ms) { var t = now(ms); return t >= L.rdOpenAt(n) && t < L.rdClose(n); };
  // A small hash of the race's number and a salt: [0, 1), the same on every phone
  var hash = function (n, salt) {
    var h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt + 0x632be5ab | 0, 0x85ebca77)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // The race's field: 6 of the horses, each with its form (1-5 stars), its chance (p) and its odds. No result here.
  var CLASS = RD.horses.map(function (h, i) { return 0.85 + hash(i, 7) * 0.4; }); // (each horse's own class, for ever)
  L.rdRace = function (n) {
    var pool = RD.horses.map(function (h, i) { return i; });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(hash(n, 11 + i) * (i + 1)), x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    var pick = pool.slice(0, 6), w = pick.map(function (h, k) { var f = 0.5 + hash(n, 31 + k); return CLASS[h] * Math.pow(f, 8); }), sum = w.reduce(function (a, b) { return a + b; }, 0);
    var horses = pick.map(function (h, k) {
      var p = RD.floor + (1 - 6 * RD.floor) * w[k] / sum, odds = Math.max(RD.odds[0], Math.min(RD.odds[1], Math.round((1 - RD.edge) / p * 10) / 10));
      return { i: h, name: RD.horses[h][0], silk: RD.horses[h][1], coat: RD.horses[h][2], p: p, odds: odds, form: Math.max(1, Math.min(5, Math.round(p * 11))) };
    });
    return { n: n, start: L.rdStart(n), horses: horses };
  };
  // The result, only once the race has started (never before, so nothing can show it): { order: [places by lane],
  // times: [s by lane], photo }. ms: now (left out: the clock)
  L.rdResult = function (n, ms) {
    if (now(ms) < L.rdStart(n)) return null;
    var race = L.rdRace(n), left = [0, 1, 2, 3, 4, 5], order = [];
    for (var k = 0; k < 6; k++) {
      var tot = left.reduce(function (a, j) { return a + race.horses[j].p; }, 0), u = hash(n, 101 + k) * tot, at = 0;
      while (at < left.length - 1 && u >= race.horses[left[at]].p) { u -= race.horses[left[at]].p; at++; }
      order.push(left.splice(at, 1)[0]);
    }
    var times = [], t = RD.run[0] + hash(n, 201) * (RD.run[1] - RD.run[0]);
    order.forEach(function (j, k) { if (k) { t += 0.05 + hash(n, 211 + k) * 1.1; } times[j] = t; });
    return { order: order, times: times, photo: times[order[1]] - times[order[0]] < RD.photo };
  };
  // How far along (tiles, 0 to RD.laps laps) each lane's horse is, t s after the start: each runs at its own pace with a
  // little surge and fade (always forward), past the line at its finish time, then canters on
  L.rdAlong = function (n, res, t) {
    var D = RD.laps * LEN;
    return res.times.map(function (T, j) {
      var f = Math.max(0, t) / T;
      if (f >= 1) { var x = Math.min(4, t - T); return D + D / T * x * (1 - x / 8); } // (slowing to a stop)
      var a = 0.035 + hash(n, 301 + j) * 0.03, k = 1 + Math.floor(hash(n, 311 + j) * 3), ph = hash(n, 321 + j) * 6.283;
      return D * (f + a * Math.sin(6.283 * k * f + ph) * f * (1 - f));
    });
  };

  // ---------- Race Day: bets ----------
  var today = function (m, ms) { var d = mday(ms); if (m.bd !== d) { m.bd = d; m.bs = 0; m.bw = 0; m.bl = 0; } return m; };
  L.rdToday = function (s, ms) { var m = today(rec(s), ms); return { staked: m.bs, won: m.bw, lost: m.bl, left: Math.max(0, RD.day - m.bs) }; };
  L.rdBetOn = function (s, n) { return rec(s).bets.filter(function (b) { return b.n === n; })[0] || null; };
  // A bet of a Gold on lane h of race n: { ok, odds, win } or { why: 'closed' | 'horse' | 'min' | 'max' | 'one' | 'day' | 'gold' }
  L.rdBet = function (s, n, h, a, ms) {
    var m = today(rec(s), ms);
    a = Number(a);
    if (!L.rdOpen(n, ms)) return { why: 'closed' };
    if (h !== Math.floor(h) || h < 0 || h > 5) return { why: 'horse' };
    if (!(a === Math.floor(a)) || a < RD.min) return { why: 'min' };
    if (a > RD.max) return { why: 'max' };
    if (L.rdBetOn(s, n)) return { why: 'one' };
    if (m.bs + a > RD.day) return { why: 'day' };
    if (s.gold < a) return { why: 'gold' };
    var odds = L.rdRace(n).horses[h].odds;
    s.gold -= a;
    m.bs += a;
    m.bets.push({ n: n, h: h, a: a });
    return { ok: true, odds: odds, win: L.rdPay(a, odds) };
  };
  L.rdPay = function (a, odds) { return Math.floor(a * Math.round(odds * 10) / 10); };
  // Pays every bet whose result is out by now (closing the game never loses one: it is in the save until it is paid).
  // Returns [{ n, h, a, win, pay, winner (name), odds }]
  L.rdSettle = function (s, ms) {
    var m = rec(s), t = now(ms), out = [], d = mday(t);
    if (!m.bets.length) return out;
    today(m, t);
    m.bets = m.bets.filter(function (b) {
      if (t < L.rdStart(b.n) + RD.resultMs) return true;
      var race = L.rdRace(b.n), res = L.rdResult(b.n, t), win = res.order[0] === b.h, odds = race.horses[b.h].odds, pay = win ? L.rdPay(b.a, odds) : 0;
      s.gold += pay;
      if (Math.floor((L.rdStart(b.n) + MANILA) / DAY) === d) { if (win) m.bw += pay - b.a; else m.bl += b.a; }
      out.push({ n: b.n, h: b.h, a: b.a, win: win, pay: pay, odds: odds, horse: race.horses[b.h].name, winner: race.horses[res.order[0]].name, photo: res.photo });
      return false;
    });
    return out;
  };

  // ---------- the day and the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.mc = fresh();
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), m = s.mc, x = {};
    if (!m) return o;
    if (m.wk) x.w = [m.wk, m.wr, m.wb, m.ev ? 1 : 0].concat(m.wl || []);
    if (m.fd >= 0) x.f = m.fd;
    if (m.q) x.q = [m.q.id, m.q.wk, m.q.k].concat(m.q.laps);
    if (m.sent) x.s = m.sent;
    if (m.bets.length) x.b = [].concat.apply([], m.bets.map(function (b) { return [b.n, b.h, b.a]; }));
    if (m.bd) x.t = [m.bd, m.bs, m.bw, m.bl];
    if (m.tour) x.u = m.tour;
    if (m.paid.length) x.p = m.paid.slice();
    if (Object.keys(x).length) o.mc = x;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var m = fresh(), x = o && o.mc && typeof o.mc === 'object' && !Array.isArray(o.mc) ? o.mc : {}, ms = function (v) { return int(v, 0, 6e5, 0); };
    if (Array.isArray(x.w)) {
      m.wk = int(x.w[0], 0, 1e7, 0); m.wr = int(x.w[1], 0, 1e5, 0); m.wb = ms(x.w[2]); m.ev = x.w[3] ? 1 : 0;
      var wl = x.w.slice(4, 4 + MC.laps).map(ms);
      if (wl.length === MC.laps && m.wb) m.wl = wl;
    }
    if (x.f != null) m.fd = int(x.f, -1, 1e7, -1);
    if (Array.isArray(x.q) && typeof x.q[0] === 'string' && ID.test(x.q[0])) {
      var laps = x.q.slice(3, 3 + MC.laps).map(ms);
      if (laps.length === MC.laps) m.q = { id: x.q[0], wk: int(x.q[1], 0, 1e7, 0), k: int(x.q[2], 0, 99, 0), laps: laps };
    }
    m.sent = ms(x.s);
    if (Array.isArray(x.b)) {
      for (var i = 0; i + 2 < x.b.length && m.bets.length < 20; i += 3) {
        var n = int(x.b[i], -1, 1e9, -1), h = int(x.b[i + 1], -1, 99, -1), a = int(x.b[i + 2], 0, 1e9, 0);
        if (n >= 0 && h >= 0 && h <= 5 && a >= RD.min && a <= RD.max && !m.bets.some(function (b) { return b.n === n; })) m.bets.push({ n: n, h: h, a: a });
      }
    }
    if (Array.isArray(x.t)) { m.bd = int(x.t[0], 0, 1e7, 0); m.bs = int(x.t[1], 0, 1e9, 0); m.bw = int(x.t[2], 0, 1e9, 0); m.bl = int(x.t[3], 0, 1e9, 0); }
    m.tour = int(x.u, 0, 255, 0);
    m.paid = (Array.isArray(x.p) ? x.p : []).filter(function (id) { return typeof id === 'string' && ID.test(id); }).slice(-12);
    s.mc = m;
    return s;
  };
})(window.Farm = window.Farm || {});
