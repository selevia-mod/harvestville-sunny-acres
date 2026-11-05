// The test server's Town Rank and Hall of Fame (supabase/farm_online_22.sql; owner, 6 Nov 2026), plugged into
// test/net-mock.js. The same answers as the SQL: points capped per kind per Manila day, a send's id counted once, the
// month's board (best first, ties to whoever got there first, hidden players left out, blocks left out), firsts (first
// come wins, only keys on the list) and the Hall's plaques (records from the Biggest catch and Derby boards).
// Tests may: set db.rankClock = () => ms (the server's clock), put old months in db.rankMonths, set db.hallMore (the
// Bayanihan hook), or db.noRank = true (part 22 not on the server yet).
const SOURCES = { farm: 300, goods: 150, fish: 150, mine: 150, hunt: 150, help: 300, bayanihan: 200 }; // (farm.rank_sources)
const TIERS = [300, 2000, 8000, 20000]; // (farm.rank_tiers)
const FIRSTS = ['bakunawa', 'lair_10', 'lair_20', 'lair_30', 'lair_40', 'greatmammoth']; // (farm.hall_first_keys)

function install(rpc, db, { need, blocked }) {
  const now = () => (db.rankClock ? db.rankClock() : Date.now());
  const manila = (t) => new Date(t + 8 * 3600e3).toISOString(); // (Manila is UTC+8)
  const day = () => manila(now()).slice(0, 10);
  const month = () => manila(now()).slice(0, 7);
  const lastMonth = () => { const d = new Date(now() + 8 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); };
  db.rankDays = new Map(); // uid|day|source -> points
  db.rankMonths = new Map(); // 'YYYY-MM' -> Map(uid -> { points, at })
  db.rankReqs = new Set();
  db.firsts = new Map(); // key -> { uid, at }
  db.hallMore = [];
  db.rankCalls = [];
  let seq = 0;
  const tier = (p) => TIERS.filter((t) => p >= t).length;
  const hidden = (id) => { const p = db.players.get(id); return !p || !!p.hidden; };
  const nameFor = (uid, id) => (db.players.has(id) && !blocked(uid, id) && !hidden(id) ? db.players.get(id).farm_name : null);
  const monthOf = (m) => { if (!db.rankMonths.has(m)) db.rankMonths.set(m, new Map()); return db.rankMonths.get(m); };
  const board = (m) => [...monthOf(m).entries()].filter(([id, r]) => r.points > 0 && !hidden(id))
    .sort((a, b) => b[1].points - a[1].points || a[1].at - b[1].at)
    .map(([id, r], i) => ({ rank: i + 1, id, name: db.players.get(id).farm_name, points: r.points, tier: tier(r.points) }));
  const me = (uid) => {
    const r = monthOf(month()).get(uid), pts = r ? r.points : 0, row = board(month()).find((x) => x.id === uid);
    const top = Math.max(0, ...[...db.rankMonths.values()].map((m) => (m.get(uid) || { points: 0 }).points));
    return { month: month(), points: pts, tier: tier(pts), rank: pts > 0 ? (row ? row.rank : 1 + board(month()).filter((x) => x.points > pts).length) : null, best: tier(top) };
  };
  const off = (n, fn) => (uid, a) => {
    if (db.noRank) throw new Error('Could not find the function public.' + n + ' in the schema cache');
    db.rankCalls.push({ uid, name: n, args: a, at: Date.now() });
    return fn(uid, a || {});
  };
  Object.assign(rpc, {
    farm_rank_add_v1: off('farm_rank_add_v1', (uid, a) => {
      need(uid);
      const cap = SOURCES[a.p_source], n = a.p_points;
      if (!cap) return { ok: false, code: 'bad-source' };
      if (!a.p_request_id || !Number.isInteger(n) || n < 1 || n > 100000) return { ok: false, code: 'bad' };
      let got = 0;
      const fresh = !db.rankReqs.has(a.p_request_id);
      if (fresh) {
        db.rankReqs.add(a.p_request_id);
        const k = uid + '|' + day() + '|' + a.p_source, have = db.rankDays.get(k) || 0;
        got = Math.max(0, Math.min(n, cap - have));
        if (got > 0) {
          db.rankDays.set(k, have + got);
          const m = monthOf(month()), r = m.get(uid) || { points: 0, at: 0 };
          m.set(uid, { points: r.points + got, at: ++seq });
        }
      }
      return Object.assign(me(uid), { ok: true, added: got, again: !fresh });
    }),
    farm_rank_board_v1: off('farm_rank_board_v1', (uid) => {
      need(uid);
      return { month: month(), me: me(uid), top: board(month()).slice(0, 100).filter((r) => !blocked(uid, r.id)) };
    }),
    farm_hall_first_v1: off('farm_hall_first_v1', (uid, a) => {
      need(uid);
      if (!FIRSTS.includes(a.p_key)) return { ok: false, code: 'bad-key' };
      if (!db.firsts.has(a.p_key)) db.firsts.set(a.p_key, { uid, at: ++seq });
      const f = db.firsts.get(a.p_key);
      return { ok: true, first: f.uid === uid, id: f.uid, name: nameFor(uid, f.uid) };
    }),
    farm_hall_v1: off('farm_hall_v1', (uid) => {
      need(uid);
      const records = (map, key) => {
        const best = {};
        for (const [k, v] of map.entries()) {
          const [kind, id] = k.split(':');
          if (hidden(id)) continue;
          if (!best[kind] || v > best[kind].v) best[kind] = { v, id };
        }
        return Object.keys(best).sort().map((kind) => ({ kind, [key]: best[kind].v, id: best[kind].id, name: nameFor(uid, best[kind].id) }));
      };
      const lm = lastMonth(), champ = TIERS[3];
      const counts = {};
      for (const [m, rows] of db.rankMonths.entries()) if (m < month()) for (const [id, r] of rows.entries()) if (r.points >= champ && !hidden(id)) counts[id] = (counts[id] || 0) + 1;
      return {
        catches: records(db.catches, 'kg10'),
        fish: records(db.derby, 'g'),
        firsts: [...db.firsts.entries()].filter(([, f]) => db.players.has(f.uid)).sort((x, y) => x[1].at - y[1].at).map(([key, f]) => ({ key, id: f.uid, name: nameFor(uid, f.uid) })),
        champs: {
          month: lm,
          last: board(lm).slice(0, 3).filter((r) => r.points >= champ).map((r) => ({ id: r.id, name: nameFor(uid, r.id), points: r.points })),
          most: Object.keys(counts).sort((x, y) => counts[y] - counts[x]).slice(0, 3).map((id) => ({ id, name: nameFor(uid, id), months: counts[id] })),
        },
        top: board(month()).slice(0, 10).filter((r) => !blocked(uid, r.id)),
        more: db.hallMore,
      };
    }),
  });
}

module.exports = { install, SOURCES, TIERS, FIRSTS };
