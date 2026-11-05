// The Town Raid on the test server (test/net-mock.js): the same answers as supabase/farm_online_21.sql, kept in memory.
// The server's clock is db.raidNow (ms) when a test sets it, else the real time. db.raid: { raids: { id: { hits: { uid: n },
// recent: { uid: [request ids] }, claimed: { uid: true } } } }; db.raidCalls: every raid call { uid, name, at }.
const RULES = { days: [1, 4], start: 20 * 60, mins: 30, late: 3, kinds: ['spark', 'typhoon', 'boar', 'crow'], cap: 300, rate: 2, burst: 30, batchMost: 60, minGoal: 500, perDefender: 80, tiers: [10, 80, 200], claimDays: 7 };
const DAY = 864e5, MIN = 60000, TZ = 8 * 60;

// the raid on Manila day number d, or null
function onDay(d) {
  const si = RULES.days.indexOf(((d + 4) % 7 + 7) % 7);
  if (si < 0) return null;
  const n = Math.floor((d + 3) / 7) * RULES.days.length + si, dt = new Date(d * DAY), start = d * DAY + (RULES.start - TZ) * MIN;
  const id = dt.getUTCFullYear() + String(dt.getUTCMonth() + 1).padStart(2, '0') + String(dt.getUTCDate()).padStart(2, '0');
  return { id, kind: RULES.kinds[n % RULES.kinds.length], start, end: start + RULES.mins * MIN, day: d };
}
const dayOf = (t) => Math.floor((t + TZ * MIN) / DAY);
function next(t) { for (let k = -1; k <= 14; k++) { const r = onDay(dayOf(t) + k); if (r && r.end > t) return r; } return null; }
function last(t) { for (let k = 0; k <= 14; k++) { const r = onDay(dayOf(t) - k); if (r && r.end <= t) return r; } return null; }
function byId(id) {
  const m = /^(20\d{2})(\d{2})(\d{2})$/.exec(String(id || ''));
  if (!m) return null;
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY, r = onDay(d);
  return r && r.id === id ? r : null;
}

module.exports = function addRaid(rpc, db, need) {
  db.raid = { raids: {} };
  db.raidCalls = [];
  const now = () => db.raidNow || Date.now();
  const of = (id) => db.raid.raids[id] || (db.raid.raids[id] = { hits: {}, recent: {}, claimed: {} });
  const town = (id) => {
    const r = db.raid.raids[id], hits = r ? Object.values(r.hits).filter((n) => n > 0) : [];
    const total = hits.reduce((a, n) => a + n, 0), defenders = hits.length;
    return { total, defenders, goal: Math.max(RULES.minGoal, defenders * RULES.perDefender) };
  };
  const answer = (uid, t, id) => {
    const x = id ? byId(id) : next(t), w = town(x.id), l = last(t), lw = l && town(l.id);
    return { ok: true, raid: x.id, kind: x.kind, on: x.start <= t && t < x.end, starts_in: Math.max(0, Math.ceil((x.start - t) / 1000)), ends_in: Math.max(0, Math.ceil((x.end - t) / 1000)),
      total: w.total, goal: w.goal, defenders: w.defenders, mine: (db.raid.raids[x.id] && db.raid.raids[x.id].hits[uid]) || 0, cap: RULES.cap, every: db.raidEvery || 10, poll: 30,
      last: l ? { raid: l.id, kind: l.kind, won: lw.total >= lw.goal } : null };
  };
  const note = (uid, name) => db.raidCalls.push({ uid, name, at: Date.now() });
  const fns = {
    farm_raid_state_v1(uid) { need(uid); note(uid, 'state'); return answer(uid, now()); },
    farm_raid_hit_v1(uid, a) {
      need(uid);
      note(uid, 'hit');
      const t = now(), n = a.p_hits;
      if (!Number.isInteger(n) || n < 1 || n > RULES.batchMost || !a.p_request_id) return { ok: false, code: 'bad' };
      const x = byId(a.p_raid);
      if (!x) return { ok: false, code: 'bad' };
      if (t < x.start) return { ok: false, code: 'early' };
      if (t > x.end + RULES.late * MIN) return { ok: false, code: 'over' };
      const r = of(x.id), recent = r.recent[uid] || (r.recent[uid] = []), had = r.hits[uid] || 0;
      if (recent.includes(a.p_request_id)) return Object.assign(answer(uid, t, x.id), { added: 0, dup: true });
      const allowed = Math.min(RULES.cap, Math.floor(Math.max(0, (Math.min(t, x.end) - x.start) / 1000) * RULES.rate) + RULES.burst);
      const added = Math.max(0, Math.min(n, RULES.cap - had, allowed - had));
      r.hits[uid] = had + added;
      recent.unshift(a.p_request_id);
      recent.length = Math.min(recent.length, 4);
      return Object.assign(answer(uid, t, x.id), { added, dup: false });
    },
    farm_raid_claim_v1(uid, a) {
      need(uid);
      note(uid, 'claim');
      const t = now(), x = byId(a.p_raid);
      if (!x) return { ok: false, code: 'bad' };
      if (t < x.end) return { ok: false, code: 'early' };
      if (t > x.end + RULES.claimDays * DAY) return { ok: false, code: 'old' };
      const w = town(x.id), res = { won: w.total >= w.goal, total: w.total, goal: w.goal, defenders: w.defenders };
      const r = of(x.id), hits = r.hits[uid] || 0;
      if (!hits) return Object.assign(res, { ok: false, code: 'none', hits: 0, tier: 0 });
      if (r.claimed[uid]) return Object.assign(res, { ok: false, code: 'claimed', hits, tier: 0 });
      r.claimed[uid] = true;
      return Object.assign(res, { ok: true, hits, tier: RULES.tiers.filter((m) => hits >= m).length });
    },
  };
  // (like the real thing before part 21 is applied: db.noRaid = true and these do not exist)
  Object.keys(fns).forEach((name) => { rpc[name] = (uid, a) => { if (db.noRaid) throw new Error('Could not find the function public.' + name + ' in the schema cache'); return fns[name](uid, a); }; });
};
module.exports.RULES = RULES;
