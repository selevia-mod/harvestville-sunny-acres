// Barangays and the Bayanihan Cup: the rules the game keeps (00-zzzzzzz-social.js). The server keeps the barangays,
// the tasks picked and done, the points and the prizes (supabase/farm_online_16.sql); the game counts how far your task
// has got: s.nb = { w: the week (its Monday), k: the kind, g: the goal, b: the counter when it was picked } (saved 'nb').
// Progress is the counter now less b, so the work only counts from the pick. Also: reading the server's answers
// (never trusting their shape), and the Market board's (supabase/farm_online_17.sql).
// (Named 01-logicZ-... so it loads after 01-logicM.js: '01-logic-' would sort before 01-logic.js.)
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var NB = C.NB;

  // the tours for barangays and the Market board (19zz-social-tours.js). Appended last.
  C.TIPS.push({ key: 'nb_tour', text: 'BARANGAYS' }, { key: 'ads_tour', text: 'THE MARKET BOARD' });

  var int = function (v, lo, hi, d) { var n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  var str = function (v, max) { return L.cleanText(v, max); };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var WEEK = /^\d{4}-\d{2}-\d{2}$/;

  // ---------- tasks ----------
  L.nbTaskText = function (kind, goal) {
    var t = NB.tasks[kind];
    return t ? t.text.replace('{n}', fmt(goal)) : '';
  };
  L.nbTaskIcon = function (kind) { var t = NB.tasks[kind]; return t && C.ICON[t.icon] != null ? C.ICON[t.icon] : C.ICON.star; };
  L.nbBadgeIcon = function (badge) { return NB.badges.indexOf(badge) >= 0 && C.ICON[badge] != null ? C.ICON[badge] : C.ICON.carabao; };
  var counter = function (s, kind) { return L.count(s, NB.tasks[kind].counter) || 0; };

  // A task picked: progress counts from now.
  L.nbStart = function (s, week, kind, goal) {
    if (!NB.tasks[kind] || !WEEK.test(String(week))) return null;
    s.nb = { w: String(week), k: kind, g: int(goal, 1, 1000, 1), b: counter(s, kind) };
    return s.nb;
  };
  // { kind, goal, n, done } for the task now, or null
  L.nbProgress = function (s) {
    var t = s.nb;
    if (!t || !NB.tasks[t.k]) return null;
    var n = Math.max(0, counter(s, t.k) - t.b);
    return { kind: t.k, goal: t.g, n: Math.min(n, t.g), done: n >= t.g };
  };
  // The server says what my task is (pick: { kind, goal } or null, in that week). Another phone, or a pick the save
  // missed, starts counting from now; a task the server no longer has is gone. True when s.nb changed.
  L.nbSync = function (s, pick, week) {
    var t = s.nb;
    if (!pick) { if (t) { s.nb = null; return true; } return false; }
    if (t && t.k === pick.kind && t.w === String(week) && t.g === pick.goal) return false;
    L.nbStart(s, week, pick.kind, pick.goal);
    return true;
  };

  // ---------- the server's answers ----------
  var task = function (t) {
    if (!t || !NB.tasks[t.kind]) return null;
    return { kind: t.kind, goal: int(t.goal, 1, 1000, 1), points: int(t.points, 0, 1000, 0), minutes: int(t.minutes, 0, 600, 0), done: !!t.done };
  };
  // farm_nb_v1 -> { hood: { id, name, badge, open, code, leader, members, online, max } | null, week, endsIn, tasks,
  //   pick: { kind, goal, points, minutes, ago } | null, cup: { league, score, place, group: [{ name, badge, score, me }] } | null,
  //   doneWeek, doneToday, maxWeek, maxDay, minPlace, baseGold, prizes, canWin }, or null if it makes no sense
  L.nbRead = function (r) {
    if (!r || typeof r !== 'object' || !WEEK.test(String(r.week || ''))) return null;
    var h = r.hood && typeof r.hood === 'object' && r.hood.id != null ? r.hood : null, cup = r.cup && typeof r.cup === 'object' ? r.cup : null;
    var pick = task(r.pick);
    return {
      hood: h && {
        id: String(h.id), name: str(h.name, NB.nameMax) || 'Barangay', badge: NB.badges.indexOf(h.badge) >= 0 ? h.badge : 'carabao', open: h.open !== false,
        code: /^[A-Z0-9]{6}$/.test(String(h.code || '')) ? String(h.code) : '', leader: !!h.leader, members: int(h.members, 0, NB.max, 1),
        online: int(h.online, 0, NB.max, 0), max: int(h.max, 1, 100, NB.max),
      },
      week: String(r.week), endsIn: int(r.ends_in, 0, 8 * 86400, 0),
      tasks: (Array.isArray(r.tasks) ? r.tasks : []).map(task).filter(Boolean).slice(0, 12),
      pick: pick && { kind: pick.kind, goal: pick.goal, points: pick.points, minutes: pick.minutes, ago: int(r.pick.ago, 0, 1e7, 0) },
      cup: cup && C.NB.leagues[cup.league] ? {
        league: cup.league, score: int(cup.score, 0, 1e7, 0), place: int(cup.place, 1, 1000, 1),
        group: (Array.isArray(cup.group) ? cup.group : []).slice(0, 10).map(function (g) {
          return { name: str(g && g.name, NB.nameMax) || 'Barangay', badge: NB.badges.indexOf(g && g.badge) >= 0 ? g.badge : 'carabao', score: int(g && g.score, 0, 1e7, 0), me: !!(g && g.me) };
        }),
      } : null,
      doneWeek: int(r.done_week, 0, 100, 0), doneToday: int(r.done_today, 0, 100, 0),
      maxWeek: int(r.max_week, 1, 100, NB.weekTasks), maxDay: int(r.max_day, 1, 100, NB.dayTasks),
      minPlace: int(r.min_place, 0, 1e6, NB.minPlace), baseGold: int(r.base_gold, 0, 1e5, NB.baseGold),
      prizes: (Array.isArray(r.prizes) ? r.prizes : NB.prizes).slice(0, 3).map(function (p, i) {
        return [int(p && p[0], 0, 1e5, NB.prizes[i][0]), int(p && p[1], 0, 20, NB.prizes[i][1])];
      }),
      canWin: r.can_win !== false,
    };
  };

  // The prize a place would win (1-based), as the server pays it.
  L.nbPrize = function (nb, place, score) {
    var p = nb.prizes[place - 1];
    if (p && score >= nb.minPlace) return { gold: p[0], stars: p[1] };
    return { gold: nb.baseGold, stars: 0 };
  };

  // A line on the news board, as the game shows it: { name, text, say }
  L.nbPostText = function (p) {
    var who = str(p && p.farm_name, 24) || 'A farmer', kind = p && p.kind;
    if (kind === 'say') return { name: who, text: str(p.body, 120), say: true };
    if (kind === 'task') {
      var m = /^([a-z]+):(\d+)$/.exec(String(p.body || '')), t = m && NB.tasks[m[1]];
      return { name: who, text: t ? 'Finished a Cup task: +' + int(m[2], 0, 1000, 0) + ' points!' : 'Finished a Cup task!' };
    }
    return { name: who, text: { made: 'Started this barangay.', join: 'Joined the barangay. Welcome!', left: 'Left the barangay.' }[kind] || '' };
  };
  // "5 min ago", "3 h ago", "2 days ago"
  L.nbAgo = function (sec) {
    sec = int(sec, 0, 1e9, 0);
    if (sec < 60) return 'just now';
    return L.formatLeft(sec / 60) + ' ago';
  };

  // Cup prizes from farm_cup_claim_v1: [{ gold, stars, place, name }] (at most 4 weeks; the same caps as the server)
  L.cupClaimRead = function (list) {
    return (Array.isArray(list) ? list : []).slice(0, 4).map(function (p) {
      return { gold: int(p && p.gold, 0, 3000, 0), stars: int(p && p.stars, 0, 3, 0), place: int(p && p.place, 1, 1000, 1), name: str(p && p.name, NB.nameMax) || 'your barangay' };
    }).filter(function (p) { return p.gold || p.stars; });
  };

  // The Market board (farm_market_ads_v1): { ads: [{ id, name, friend, leftMin, lots, items: [{ item, qty, price }] }], mine: { on, leftMin, used, nextMin } }
  L.adsRead = function (r) {
    if (!r || typeof r !== 'object') return null;
    var mine = r.mine && typeof r.mine === 'object' ? r.mine : {};
    return {
      ads: (Array.isArray(r.ads) ? r.ads : []).slice(0, 30).filter(function (a) { return a && a.id; }).map(function (a) {
        return {
          id: String(a.id), name: str(a.farm_name, 24) || 'Farmer', friend: !!a.friend, leftMin: int(a.left_s, 0, 86400, 0) / 60, lots: int(a.lots, 0, 99, 0),
          items: (Array.isArray(a.items) ? a.items : []).filter(function (x) { return x && C.ITEMS[x.item]; }).slice(0, 3).map(function (x) {
            return { item: x.item, qty: int(x.qty, 1, C.MARKET.most, 1), price: int(x.price, 1, 100000, 1) };
          }),
        };
      }).filter(function (a) { return a.items.length; }),
      mine: { on: !!mine.on, leftMin: int(mine.until_s, 0, 86400, 0) / 60, used: !!mine.used, nextMin: int(mine.next_s, 0, 86400, 0) / 60, hours: int(mine.hours, 1, 24, C.ADS.hours) },
    };
  };
  // "10 Turnip for 300G, 5 Eggs for 150G" (as the Market names a lot)
  L.adItems = function (items) {
    return items.map(function (x) { var it = C.ITEMS[x.item]; return x.qty + ' ' + (x.qty > 1 && it.plural ? it.plural.charAt(0).toUpperCase() + it.plural.slice(1) : it.name) + ' for ' + fmt(x.price) + 'G'; }).join(', ');
  };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.nb = null;
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), t = s.nb;
    if (t && NB.tasks[t.k]) o.nb = [t.w, t.k, t.g, t.b];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.nb = null;
    var a = o && o.nb;
    if (Array.isArray(a) && WEEK.test(String(a[0])) && NB.tasks[a[1]]) s.nb = { w: String(a[0]), k: a[1], g: int(a[2], 1, 1000, 1), b: int(a[3], 0, 1e9, 0) };
    return s;
  };
})(window.Farm = window.Farm || {});
