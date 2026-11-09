// Farm Raids step 2: the game server checks a real raid (docs/raids-step2.md, supabase/farm_online_25.sql).
// A phone that finished a raid sends { t: 'fr', v: 1, token, raid, moves } (its drops: [tick, raider, x, y]). The server:
//   1. reads the raid AS THAT PLAYER (farm_fraid_raid_v1, their token): the frozen copy, the army, the seed, the cap;
//   2. replays the drops with the game's own rules (L.frRealFarm, L.frReplay: the same files the phone runs), so the
//      stars and what was taken are the server's, never the phone's;
//   3. records it with its own key (farm_fraid_settle_v1, the attacker's token AND FRAID_KEY), and answers
//      { t: 'frr', raid, ok, stars, prize, points } (or { ok: false, code }).
// The game takes any { settle(token, raid, moves, played) -> Promise<answer> }, so tests use a fake fetch. (played: a
// made-up farm's copy, SQL part 28: the phone lays it out, the server checks it has the defenses its numbers say)
'use strict';

const CALL_WAIT = 5000, MOVES_MOST = 300;

function makeFraid(opts) {
  const o = opts || {};
  const url = String(o.url || '').replace(/\/+$/, '');
  const anonKey = o.anonKey, key = o.key;
  const doFetch = o.fetch || globalThis.fetch;
  const R = o.rules; // lib/rules.js load(): { C, L }
  const rpc = async (token, name, args) => {
    const res = await doFetch(url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(CALL_WAIT),
    });
    if (!res.ok) throw new Error(name + ': ' + res.status);
    return res.json();
  };
  // the drops a phone may send: [tick, raider, x, y], whole numbers, in time order
  const goodMoves = (moves) => Array.isArray(moves) && moves.length <= MOVES_MOST && moves.every((m, i) =>
    Array.isArray(m) && m.length === 4 && Number.isInteger(m[0]) && m[0] >= 0 && typeof m[1] === 'string' && Number.isInteger(m[2]) && Number.isInteger(m[3]) &&
    (i === 0 || m[0] >= moves[i - 1][0]));

  return {
    // the check, without the network (the tests, and settle below): { stars, taken } from a raid row and the drops
    // (played: a made-up farm's copy as the phone laid it out, SQL part 28; checked against the server's own numbers)
    judge(row, moves, played) {
      const { L } = R;
      if (!row || !row.copy || !L.frArmyOk(row.army)) return { code: 'army' };
      let copy = row.copy;
      if (copy.ghost) {
        const why = L.frGhostOk(played, copy.ghost);
        if (why) return { code: 'ghost' };
        copy = Object.assign({}, played, { value: copy.value });
      }
      // the crops ripe by the end of the raid's lock (the phone uses the same: farm_fraid_start_v1's expires_at)
      const cut = Date.parse(row.expires_at) || null;
      const farm = L.frRealFarm(copy, row.cap, row.seed, cut);
      const b = L.frReplay(farm, row.army, row.seed, moves);
      if (b.moves.length !== moves.length) return { code: 'moves' }; // (a drop the rules refused: not the phone's battle)
      const taken = L.frTaken(b);
      taken.cut = cut; // (a Replay builds the same farm)
      return { stars: L.frStars(b), taken };
    },
    async settle(token, raid, moves, played) {
      if (!url || !anonKey || !key) return { ok: false, code: 'off' };
      if (typeof token !== 'string' || !token || token.length > 4096) return { ok: false, code: 'auth' };
      if (typeof raid !== 'string' || !/^[0-9a-f-]{36}$/i.test(raid)) return { ok: false, code: 'raid' };
      if (!goodMoves(moves)) return { ok: false, code: 'moves' };
      let row;
      try { row = await rpc(token, 'farm_fraid_raid_v1', { p_raid: raid }); } catch (e) { return { ok: false, code: 'read' }; }
      if (!row) return { ok: false, code: 'none' };
      if (row.state !== 'open') return { ok: false, code: 'done' };
      if (played != null && (typeof played !== 'object' || JSON.stringify(played).length > 48000)) return { ok: false, code: 'copy' };
      const j = this.judge(row, moves, played);
      if (j.code) return { ok: false, code: j.code };
      let res;
      try {
        res = await rpc(token, 'farm_fraid_settle_v1', { p_key: key, p_raid: raid, p_stars: j.stars, p_taken: j.taken, p_moves: moves });
      } catch (e) { return { ok: false, code: 'write' }; }
      if (!res || !res.ok) return { ok: false, code: (res && res.code) || 'write' };
      return { ok: true, stars: res.stars, prize: res.prize, points: res.points, taken: j.taken };
    },
  };
}

module.exports = { makeFraid };
