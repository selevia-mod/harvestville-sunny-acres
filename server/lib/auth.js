// Who a phone is, and whether it may be in that farm's room (docs/game-server.md "Joining").
//   1. Its Supabase access token: an ES256 JWT, checked against the project's public keys (JWKS, fetched once and
//      kept by jose), not expired; the player is its `sub`.
//   2. The farm: Supabase's own rule, farm_topic_ok_v1(p_topic), asked AS THAT PLAYER (their token), the same rule
//      the live channels use today. A yes is kept a minute, a no ten seconds (a reconnect costs no call).
// The game takes any { check(token, topic) -> Promise<{ uid } | { why: 'auth' | 'topic' }> }, so tests use a fake.
'use strict';

const OK_KEEP = 60000, NO_KEEP = 10000, CALL_WAIT = 3000;

function makeSupabaseAuth(opts) {
  const o = opts || {};
  const url = String(o.url || '').replace(/\/+$/, '');
  const anonKey = o.anonKey;
  if (!url || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are needed');
  const doFetch = o.fetch || globalThis.fetch;
  const issuer = o.issuer === undefined ? url + '/auth/v1' : o.issuer; // ('' : not checked)
  const now = o.now || Date.now;
  let jose = null, keys = o.keys || null; // (keys: a jose key set, for the tests)
  const verify = o.verify || (async (token) => {
    if (!jose) jose = await import('jose');
    if (!keys) keys = jose.createRemoteJWKSet(new URL(o.jwksUrl || url + '/auth/v1/.well-known/jwks.json'));
    const { payload } = await jose.jwtVerify(token, keys, Object.assign({ algorithms: ['ES256'], audience: 'authenticated', clockTolerance: 30 }, issuer ? { issuer } : {}));
    return payload;
  });
  const seen = new Map(); // uid|topic -> { ok, until }

  const topicOk = async (token, topic) => {
    const res = await doFetch(url + '/rest/v1/rpc/farm_topic_ok_v1', {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_topic: topic }),
      signal: AbortSignal.timeout(CALL_WAIT),
    });
    if (!res.ok) throw new Error('farm_topic_ok_v1: ' + res.status);
    return (await res.json()) === true;
  };

  return {
    async check(token, topic) {
      let payload;
      try { payload = await verify(token); } catch (e) { return { why: 'auth' }; }
      const uid = payload && typeof payload.sub === 'string' ? payload.sub : null;
      if (!uid) return { why: 'auth' };
      if (topic === 'pub') return { uid }; // (a hunting place is open to everyone: a good token is all)
      const key = uid + '|' + topic, t = now(), had = seen.get(key);
      if (had && had.until > t) return had.ok ? { uid } : { why: 'topic' };
      let ok;
      try { ok = await topicOk(token, topic); } catch (e) { return { why: 'auth' }; } // (Supabase did not answer: the old way)
      seen.set(key, { ok, until: t + (ok ? OK_KEEP : NO_KEEP) });
      if (seen.size > 5000) seen.forEach((v, k) => { if (v.until <= t) seen.delete(k); });
      return ok ? { uid } : { why: 'topic' };
    },
  };
}

module.exports = { makeSupabaseAuth };
