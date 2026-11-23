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

const CALL_WAIT = 5000, MOVES_MOST = 300, CELLS_MOST = 96 * 64, TRIES_MOST = 3;
const { isPass } = require('./auth');
const PASS_FN = { farm_fraid_raid_v1: 'hvs_fraid_raid_v1', farm_fraid_settle_v1: 'hvs_fraid_settle_v1' };

function makeFraid(opts) {
  const o = opts || {};
  const url = String(o.url || '').replace(/\/+$/, '');
  const anonKey = o.anonKey, key = o.key;
  const doFetch = o.fetch || globalThis.fetch;
  const R = o.rules; // lib/rules.js load(): { C, L }
  // (a game pass, SQL 60, 23 Nov 2026: the app hands the page a pass, not the player's sign-in; the server asks with the
  // public key and the pass, through the pass's own functions. An older app still sends the sign-in: the old way.)
  const rpc = async (token, name, args) => {
    const pass = isPass(token);
    const res = await doFetch(url + '/rest/v1/rpc/' + (pass ? PASS_FN[name] : name), {
      method: 'POST',
      headers: pass ? { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' }
        : { apikey: anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(pass ? Object.assign({ p_pass: token }, args) : args),
      signal: AbortSignal.timeout(CALL_WAIT),
    });
    if (!res.ok) throw new Error(name + ': ' + res.status);
    return res.json();
  };
  // the drops a phone may send: [tick, raider, x, y], whole numbers, in time order
  const goodMoves = (moves) => Array.isArray(moves) && moves.length <= MOVES_MOST && moves.every((m, i) =>
    Array.isArray(m) && m.length === 4 && Number.isInteger(m[0]) && m[0] >= 0 && typeof m[1] === 'string' && Number.isInteger(m[2]) && Number.isInteger(m[3]) &&
    (i === 0 || m[0] >= moves[i - 1][0]));

  // checks per raid (security check, 23 Nov 2026: a refused check left the raid open, so one raid could be sent again and
  // again, each a full replay on the one thread every room shares): a few, for a lost answer; then 'tries'
  const tries = new Map();
  const tried = (raid) => {
    const n = (tries.get(raid) || 0) + 1;
    tries.set(raid, n);
    if (tries.size > 20000) tries.delete(tries.keys().next().value);
    return n > TRIES_MOST;
  };
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
        // the drop zone as the rules make it (no closer than R.battle.keepReal to anything), never wider than the phone's
        const own = L.frDropCells({ w: copy.w, h: copy.h, solid: copy.solid, loot: copy.loot, defs: copy.defs, keep: R.C.FRAID.battle.keepReal });
        copy.drop = Array.prototype.map.call(own, (c, i) => (c === '1' && copy.drop.charCodeAt(i) === 49 ? '1' : '0')).join('');
      }
      if (!(copy.w * copy.h <= CELLS_MOST)) return { code: 'copy' }; // (a replay's time grows with the farm: one thread for every room)
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
      if (!isPass(token) && o.jwt === false) return { ok: false, code: 'auth' }; // (the old sign-in turned off)
      if (typeof raid !== 'string' || !/^[0-9a-f-]{36}$/i.test(raid)) return { ok: false, code: 'raid' };
      if (!goodMoves(moves)) return { ok: false, code: 'moves' };
      if (tried(raid)) return { ok: false, code: 'tries' };
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
