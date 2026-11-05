// Bayanihan Projects on the test server (supabase/farm_online_20.sql; owner, 6 Nov 2026): the same answers as
// farm_project_state_v1, farm_project_give_v1 and farm_project_claim_v1, kept in memory. Installed by test/net-mock.js.
// Tests can make the numbers small (db.bh.projects[i].needs[k].goal, .cap ...), move a player's gifts a day back
// (db.bh.gifts: each has .day), or say the part is not applied yet (db.noBh).
const PROJECTS = [
  ['bridge', [['lumber', 1500, 1, 60], ['stone', 1000, 1, 60], ['ore_copper', 400, 2, 25], ['fish_s', 300, 2, 15]]],
  ['market', [['wheat', 1500, 1, 60], ['egg', 600, 2, 20], ['milk', 300, 3, 12], ['bread', 200, 4, 8], ['ore_silver', 200, 3, 10]]],
  ['fountain', [['stone', 1500, 1, 60], ['ore_silver', 300, 3, 12], ['fish_m', 200, 3, 10], ['butter', 80, 6, 4], ['gem', 40, 10, 2]]],
  ['bell', [['ore_copper', 800, 2, 25], ['ore_gold', 250, 4, 8], ['feather_labuyo', 300, 1, 20], ['antler', 60, 5, 3], ['cake', 60, 8, 3]]],
  ['pier', [['lumber', 2500, 1, 80], ['meat_boar', 150, 2, 6], ['tusk', 80, 4, 3], ['fish_l', 120, 5, 4], ['cheese', 60, 6, 3]]],
];

function install(rpc, db, need) {
  db.bh = {
    projects: PROJECTS.map(([key, needs], i) => ({
      key, ord: i + 1, cap: 800, tier2: 150, tier3: 500, gold: [300, 1000, 2500], started: i ? null : Date.now(), doneAt: null,
      needs: needs.map(([item, goal, pts, dayMax]) => ({ item, goal, pts, dayMax, have: 0 })),
    })),
    gifts: [], // { uid, rid, project, item, n, pts, hood, day }
    givers: new Map(), // project:uid -> { pts, n, last }
    hoods: new Map(), // project:hood -> pts
    claims: new Map(), // project:uid -> { tier, gold }
  };
  const B = db.bh;
  const day = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // (the Philippines, like farm.bh_day)
  const current = () => B.projects.find((p) => !p.doneAt) || null;
  const tier = (p, pts) => (pts >= p.tier3 ? 3 : pts >= p.tier2 ? 2 : pts >= 1 ? 1 : 0);
  const giver = (key, uid) => B.givers.get(key + ':' + uid) || { pts: 0, n: 0, last: 0 };
  const today = (uid, key, item) => B.gifts.filter((g) => g.uid === uid && g.project === key && g.item === item && g.day === day()).reduce((a, g) => a + g.n, 0);
  const hoodOf = (uid) => (db.hoodOf && db.hoodOf.get(uid) ? db.hoodOf.get(uid).hood : null);
  const canGive = (uid) => !(db.guests && db.guests.has(uid)) && !(db.banned && db.banned.has(uid));
  const player = (uid) => { if (!uid) throw new Error('not signed in'); return db.players.has(uid); };
  const blocked = (a, b) => db.blocks.some((x) => (x.by === a && x.who === b) || (x.by === b && x.who === a));
  const no = (code, more) => Object.assign({ ok: false, code }, more || {});
  const fns = {
    farm_project_state_v1(uid) {
      if (!player(uid)) return no('not-player');
      need(uid);
      const p = current();
      let cur = null;
      if (p) {
        const hid = hoodOf(uid), h = hid != null && db.hoods.get(hid);
        const top = [...B.givers.entries()].filter(([k]) => k.startsWith(p.key + ':')).map(([k, g]) => ({ id: k.slice(p.key.length + 1), g }))
          .filter((x) => x.id === uid || (db.players.has(x.id) && !db.players.get(x.id).hidden && !blocked(uid, x.id)))
          .sort((a, b) => b.g.pts - a.g.pts || a.g.last - b.g.last).slice(0, 10)
          .map((x) => ({ id: x.id, name: db.players.get(x.id) ? db.players.get(x.id).farm_name : 'Farm', pts: x.g.pts, me: x.id === uid }));
        cur = {
          key: p.key, ord: p.ord, cap: p.cap, tiers: [1, p.tier2, p.tier3], gold: p.gold.slice(),
          needs: p.needs.map((n) => ({ item: n.item, goal: n.goal, have: n.have, pts: n.pts, day_max: n.dayMax, today: today(uid, p.key, n.item) })),
          mine: giver(p.key, uid).pts, givers: [...B.givers.keys()].filter((k) => k.startsWith(p.key + ':')).length, top,
          hood: h ? { name: h.name, pts: B.hoods.get(p.key + ':' + hid) || 0 } : null,
        };
      }
      return {
        ok: true, current: cur, can_give: canGive(uid),
        done: B.projects.filter((x) => x.doneAt).map((x) => ({ key: x.key, ago: Math.floor((Date.now() - x.doneAt) / 1000), mine: giver(x.key, uid).pts,
          tier: tier(x, giver(x.key, uid).pts), claimed: B.claims.has(x.key + ':' + uid) })),
      };
    },
    farm_project_give_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      if (!a.p_request_id) return no('request-required');
      if (!db.players.has(uid)) return no('not-player');
      const g = B.gifts.find((x) => x.uid === uid && x.rid === a.p_request_id);
      if (g) {
        const p = B.projects.find((x) => x.key === g.project), n = p.needs.find((x) => x.item === g.item);
        return { ok: true, again: true, project: g.project, item: g.item, n: g.n, have: n.have, goal: n.goal, today: today(uid, g.project, g.item), mine: giver(g.project, uid).pts, done: !!p.doneAt };
      }
      if (!canGive(uid)) return no('guest');
      const want = Math.floor(Number(a.p_n));
      if (!a.p_item || !(want >= 1) || want > 100000) return no('bad');
      const p = current();
      if (!p) return no('closed');
      if (a.p_project && a.p_project !== p.key) return no('moved', { project: p.key });
      const nd = p.needs.find((x) => x.item === a.p_item);
      if (!nd) return no('closed');
      if (nd.have >= nd.goal) return no('met');
      const given = today(uid, p.key, nd.item);
      if (given >= nd.dayMax) return no('day');
      const mine = giver(p.key, uid);
      if (mine.pts + nd.pts > p.cap) return no('cap');
      const take = Math.min(want, nd.goal - nd.have, nd.dayMax - given, Math.floor((p.cap - mine.pts) / nd.pts)), hid = hoodOf(uid);
      B.gifts.push({ uid, rid: a.p_request_id, project: p.key, item: nd.item, n: take, pts: take * nd.pts, hood: hid, day: day() });
      nd.have += take;
      B.givers.set(p.key + ':' + uid, { pts: mine.pts + take * nd.pts, n: mine.n + take, last: Date.now() });
      if (hid != null) B.hoods.set(p.key + ':' + hid, (B.hoods.get(p.key + ':' + hid) || 0) + take * nd.pts);
      let done = false;
      if (p.needs.every((x) => x.have >= x.goal)) {
        p.doneAt = Date.now();
        const next = current();
        if (next && !next.started) next.started = Date.now();
        done = true;
      }
      return { ok: true, project: p.key, item: nd.item, n: take, have: nd.have, goal: nd.goal, today: given + take, mine: mine.pts + take * nd.pts, done };
    },
    farm_project_claim_v1(uid, a) {
      if (!uid) throw new Error('not signed in');
      if (!db.players.has(uid)) return no('not-player');
      const p = B.projects.find((x) => x.key === a.p_project);
      if (!p) return no('bad');
      if (!p.doneAt) return no('not-done');
      const c = B.claims.get(p.key + ':' + uid);
      if (c) return { ok: true, again: true, project: p.key, tier: c.tier, gold: c.gold };
      if (!canGive(uid)) return no('guest');
      const t = tier(p, giver(p.key, uid).pts);
      if (!t) return no('none');
      B.claims.set(p.key + ':' + uid, { tier: t, gold: p.gold[t - 1] });
      return { ok: true, project: p.key, tier: t, gold: p.gold[t - 1] };
    },
  };
  Object.keys(fns).forEach((n) => { rpc[n] = (uid, a) => { if (db.noBh) throw new Error('Could not find the function public.' + n + ' in the schema cache'); return fns[n](uid, a || {}); }; });
}

module.exports = { install, PROJECTS };
