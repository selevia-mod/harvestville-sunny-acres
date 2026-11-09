// Town Raid, the rules (owner, 6 Nov 2026; data in 00-zzzzzzzzzzz-raid.js, screen in 19zzzz-raid.js, server in
// supabase/farm_online_21.sql):
//   - when: the raid on now, or the next one, by Manila time on the game's clock (the app's server time), like Double
//     Drops. Each raid has an id, its Manila date ('20261109'), and a kind, round and round in C.RAID.order (the
//     server works both out the same way);
//   - your part in a raid (s.raid, saved as 'rai'): the hits you landed, the hits the server took, the crops it cost you
//     (never more than C.RAID.lossMost) and whether its results were shown;
//   - the chests (by hits; the town won: more gold) and the bonus day (Double Drops until the end of the next day);
//   - reading the server's answers (never trusted further than the caps here).
// (Named 01-logicZZZZ-…: it loads after every 01-logicZZZ-… file.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var R = C.RAID;
  var DAY = 864e5, MIN = 60000;

  // (appended last: a tip's place is its saved bit)
  C.TIPS.push({ key: 'raid_tour', text: 'TOWN RAID' });

  var int = function (v, lo, hi) { var n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // ---------- when ----------
  // A raid on Manila day number d (days since 1 Jan 1970 in Manila), the si-th raid day of its week.
  var slot = function (d, si) {
    var start = d * DAY + (R.start - R.tz) * MIN, dt = new Date(d * DAY);
    var week = Math.floor((d + 3) / 7); // (weeks from Monday: 1 Jan 1970 was a Thursday)
    var n = week * R.days.length + si;
    return {
      id: dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate()),
      n: n, day: d, kind: R.order[((n % R.order.length) + R.order.length) % R.order.length], start: start, end: start + R.mins * MIN,
    };
  };
  // The raid on now, or the next one to start: { id, n, day, kind, start, end } (ms).
  L.raidNext = function (ms) {
    var now = ms == null ? L.clock() : ms, d0 = Math.floor((now + R.tz * MIN) / DAY);
    for (var k = -1; k <= 14; k++) {
      var d = d0 + k, si = R.days.indexOf(((d + 4) % 7 + 7) % 7); // (weekday: 0 = Sunday; day 0 was a Thursday)
      if (si < 0) continue;
      var r = slot(d, si);
      if (r.end > now) return r;
    }
    return null;
  };
  // The raid on now, or null.
  L.raidNow = function (ms) {
    var now = ms == null ? L.clock() : ms, r = L.raidNext(now);
    return r && r.start <= now ? r : null;
  };
  // The raid with this id ('20261109'), or null if no raid falls on that date.
  L.raidById = function (id) {
    var m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(id || ''));
    if (!m) return null;
    var d = Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY, si = R.days.indexOf(((d + 4) % 7 + 7) % 7);
    return si < 0 ? null : slot(d, si);
  };
  // What the clock says about raids: { r: the raid, phase: 'on' | 'soon' (within C.RAID.warn minutes) | null, left: ms
  // until it starts ('soon') or ends ('on') }.
  L.raidPhase = function (ms) {
    var now = ms == null ? L.clock() : ms, r = L.raidNext(now);
    if (!r) return { r: null, phase: null, left: 0 };
    if (r.start <= now) return { r: r, phase: 'on', left: r.end - now };
    if (r.start - now <= R.warn * MIN) return { r: r, phase: 'soon', left: r.start - now };
    return { r: r, phase: null, left: r.start - now };
  };
  L.raidKind = function (r) { return R.kinds[r && r.kind] || R.kinds[R.order[0]]; };
  // "Monday 8:00 PM" (Manila time, as the players are told)
  L.raidWhen = function (r) {
    var t = new Date(r.start + R.tz * MIN), m = t.getUTCHours() * 60 + t.getUTCMinutes();
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getUTCDay()] + ' ' + L.formatTime(m);
  };

  // ---------- your part in a raid (s.raid) ----------
  // { id, h: hits you landed (counted up to the cap), sv: hits the server took, l: crop tiles lost, c: 1 once the results
  // were shown (and the chest given), b: the bonus day's end (ms, 0 = none) }
  var blank = function (id, b) { return { id: id, h: 0, sv: 0, l: 0, c: 0, b: b || 0 }; };
  L.raidRec = function (s, r) {
    if (!s.raid) s.raid = blank('', 0);
    if (r && s.raid.id !== r.id) s.raid = blank(r.id, s.raid.b);
    return s.raid;
  };
  // One hit landed on a raider: 1 if it counts (under the cap), else 0.
  L.raidHit = function (s, r) {
    var rec = L.raidRec(s, r);
    if (rec.h >= R.cap) return 0;
    rec.h++;
    return 1;
  };
  // May a raider still take a crop here? Only on your own farm, and only C.RAID.lossMost of them a raid.
  L.raidLossOk = function (s, r) {
    if (!s || s.isVisit || !r) return false;
    return L.raidRec(s, r).l < R.lossMost;
  };
  // The crop tiles a raider may go for: planted, not withered.
  L.raidCrops = function (s) {
    if (!s || !s.soil) return [];
    return Object.keys(s.soil).map(Number).filter(function (idx) { var t = s.soil[idx]; return t && t.c && C.CROPS[t.c] && !L.isWithered(t); });
  };
  // A raider finished on a crop: it is lost (the soil stays tilled). The crop's item id, or null when nothing was lost
  // (a friend's farm, the cap reached, nothing growing there any more).
  L.raidTrample = function (s, r, idx) {
    var t = s && s.soil && s.soil[idx];
    if (!t || !t.c || !C.CROPS[t.c] || L.isWithered(t) || !L.raidLossOk(s, r)) return null;
    var item = C.CROPS[t.c].item;
    t.c = null;
    t.p = 0;
    t.r = 0;
    delete t.h;
    L.raidRec(s, r).l++;
    return item;
  };

  // ---------- the town's goal ----------
  L.raidGoal = function (defenders) { return Math.max(R.minGoal, int(defenders, 0, 1e7) * R.perDefender); };
  // How many hits the server would take by now: never more than the cap, and about C.RAID.rate a second since it began.
  L.raidAllowed = function (r, ms) {
    var secs = Math.max(0, ((ms == null ? L.clock() : ms) - r.start) / 1000);
    return Math.min(R.cap, Math.floor(secs * R.rate) + R.burst);
  };

  // ---------- rewards ----------
  // The chest for so many hits: { tier (1, 2, 3), name, gold, items: [[id, n]] }, or null (too few). alone: the farm's
  // own small goal; won: the town reached its goal (more gold).
  L.raidChest = function (hits, alone, won) {
    var list = alone ? R.alone.chests : R.chests, tier = 0;
    list.forEach(function (c, i) { if (hits >= c.min) tier = i + 1; });
    if (!tier) return null;
    var c = list[tier - 1];
    return { tier: tier, name: c.name, gold: Math.round(c.gold * (won && !alone ? R.wonGold : 1)), items: c.items.map(function (it) { return [it[0], it[1]]; }), lumber: c.lumber || 0 };
  };
  // Into the bag (what does not fit goes in the basket). The gold and the items given.
  L.raidGive = function (s, chest) {
    if (!chest) return null;
    s.gold += chest.gold;
    if (chest.lumber) s.lumber = (s.lumber || 0) + chest.lumber;
    chest.items.forEach(function (it) {
      if (!C.ITEMS[it[0]]) return;
      var left = L.addItem(s, it[0], it[1]);
      if (left && s.basket) s.basket[it[0]] = Math.min(999, (s.basket[it[0]] || 0) + left);
    });
    return chest;
  };
  // Alone: the farm's own goal.
  L.raidAloneResult = function (rec) {
    return { won: rec.h >= R.alone.goal, chest: L.raidChest(rec.h, true, false) };
  };

  // ---------- the bonus day ----------
  // Double Drops from the end of a won raid until midnight (Manila) at the end of the next day.
  L.raidBonusEnd = function (r) { return (r.day + 1 + R.bonus.days) * DAY - R.tz * MIN; };
  L.raidBonus = 0; // your bonus day's end (ms), set from your own farm (never a friend's): 19zzzz-raid.js
  L.raidSetBonus = function (s, until) {
    var rec = L.raidRec(s);
    rec.b = Math.max(rec.b || 0, until || 0);
    L.raidBonus = rec.b;
  };
  var doubleNow = L.doubleNow;
  L.doubleNow = function (ms) {
    var w = doubleNow(ms), t = ms == null ? L.clock() : ms;
    if (!(R.bonus.kind === 'double' && L.raidBonus > t)) return w;
    return { end: Math.max(L.raidBonus, w ? w.end : 0), raid: 1 };
  };

  // ---------- the server's answers ----------
  // farm_raid_state_v1 / farm_raid_hit_v1: { ok, raid, kind, on, starts_in, ends_in (s), total, goal, defenders, mine,
  // cap, added, dup, code, every, poll, last: { raid, won } }
  L.raidRead = function (r) {
    if (!r || typeof r !== 'object') return null;
    var cap = int(r.cap, 0, R.cap) || R.cap;
    return {
      ok: r.ok !== false, code: typeof r.code === 'string' ? r.code.slice(0, 20) : '', id: /^\d{8}$/.test(String(r.raid)) ? String(r.raid) : '',
      kind: R.kinds[r.kind] ? r.kind : '', on: !!r.on, startsIn: int(r.starts_in, 0, 30 * 86400), endsIn: int(r.ends_in, 0, 30 * 86400),
      total: int(r.total, 0, 2e9), goal: Math.max(1, int(r.goal, 0, 2e9) || R.minGoal), defenders: int(r.defenders, 0, 1e8),
      mine: int(r.mine, 0, cap), cap: cap, added: int(r.added, 0, R.batchMost), dup: !!r.dup,
      // how often to send and look (the server can slow every phone down without an app update): seconds, 0 = ours
      every: int(r.every, 0, 300), poll: int(r.poll, 0, 600),
      // the last raid that ended (its bonus day is for everyone, even those who missed it)
      last: r.last && typeof r.last === 'object' && /^\d{8}$/.test(String(r.last.raid)) ? { id: String(r.last.raid), won: !!r.last.won } : null,
    };
  };
  // farm_raid_claim_v1: { ok, won, hits, tier, total, goal, defenders, code }
  L.raidClaimRead = function (r) {
    if (!r || typeof r !== 'object') return null;
    return {
      ok: !!r.ok, code: typeof r.code === 'string' ? r.code.slice(0, 20) : '', won: !!r.won, hits: int(r.hits, 0, R.cap),
      tier: int(r.tier, 0, R.chests.length), total: int(r.total, 0, 2e9), goal: Math.max(1, int(r.goal, 0, 2e9) || R.minGoal), defenders: int(r.defenders, 0, 1e8),
    };
  };
  // "67%" (the bar can pass 100%: the town keeps going)
  L.raidPct = function (total, goal) { return Math.floor(100 * (total || 0) / Math.max(1, goal || 1)); };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) { var s = newState(info); s.raid = null; return s; };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), t = s.raid;
    if (t && (t.id || t.b)) o.rai = [Number(t.id) || 0, t.h, t.sv, t.l, t.c, Math.floor((t.b || 0) / MIN)];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var a = o && Array.isArray(o.rai) ? o.rai : null, id = a && /^\d{8}$/.test(String(a[0])) ? String(a[0]) : '';
    s.raid = a ? { id: id, h: int(a[1], 0, R.cap), sv: int(a[2], 0, R.cap), l: int(a[3], 0, R.lossMost), c: a[4] ? 1 : 0, b: int(a[5], 0, 1e8) * MIN } : null;
    return s;
  };
})(window.Farm = window.Farm || {});
