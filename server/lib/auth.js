// Who a phone is, and whether it may be in that farm's room (docs/game-server.md "Joining").
//   1. Its Supabase access token: an ES256 JWT, checked against the project's public keys (JWKS, fetched once and
//      kept by jose), not expired; the player is its `sub`.
//   2. The farm: Supabase's own rule, farm_topic_ok_v1(p_topic), asked AS THAT PLAYER (their token), the same rule
//      the live channels use today. A yes is kept a minute, a no ten seconds (a reconnect costs no call).
// The game takes any { check(token, topic) -> Promise<{ uid } | { why: 'auth' | 'topic' }> }, so tests use a fake.
'use strict';

const OK_KEEP = 60000, NO_KEEP = 10000, CALL_WAIT = 3000;
// A game pass (SQL 60, security check #8, 23 Nov 2026): the app hands the page 'hvp_' + 64 hex, never the player's
// Selebox sign-in. Who it belongs to is asked with the public key (hvs_who_v1), kept a minute; the farm rule through
// hvs_topic_ok_v1. An older app still sends its sign-in (a JWT): checked the old way until `jwt: false` (HV_JWT=off).
const PASS = /^hvp_[0-9a-f]{64}$/;
const isPass = (t) => typeof t === 'string' && PASS.test(t);

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
  const passes = new Map(); // pass -> { uid, until }
  const anonCall = async (name, args) => {
    const res = await doFetch(url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(CALL_WAIT),
    });
    if (!res.ok) throw new Error(name + ': ' + res.status);
    return res.json();
  };
  const passUser = async (pass) => {
    const t = now(), had = passes.get(pass);
    if (had && had.until > t) return had.uid;
    const uid = await anonCall('hvs_who_v1', { p_pass: pass });
    const good = typeof uid === 'string' && uid ? uid : null;
    passes.set(pass, { uid: good, until: t + (good ? OK_KEEP : NO_KEEP) });
    if (passes.size > 5000) passes.forEach((v, k) => { if (v.until <= t) passes.delete(k); });
    return good;
  };

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
      const pass = isPass(token);
      let uid = null;
      if (pass) {
        try { uid = await passUser(token); } catch (e) { return { why: 'auth' }; }
      } else {
        if (o.jwt === false) return { why: 'auth' };
        let payload;
        try { payload = await verify(token); } catch (e) { return { why: 'auth' }; }
        uid = payload && typeof payload.sub === 'string' ? payload.sub : null;
      }
      if (!uid) return { why: 'auth' };
      if (topic === 'pub') return { uid }; // (a hunting place is open to everyone: a good token is all)
      const key = uid + '|' + topic, t = now(), had = seen.get(key);
      if (had && had.until > t) return had.ok ? { uid } : { why: 'topic' };
      let ok;
      try { ok = pass ? (await anonCall('hvs_topic_ok_v1', { p_pass: token, p_topic: topic })) === true : await topicOk(token, topic); } catch (e) { return { why: 'auth' }; } // (Supabase did not answer: the old way)
      seen.set(key, { ok, until: t + (ok ? OK_KEEP : NO_KEEP) });
      if (seen.size > 5000) seen.forEach((v, k) => { if (v.until <= t) seen.delete(k); });
      return ok ? { uid } : { why: 'topic' };
    },
  };
}

module.exports = { makeSupabaseAuth, isPass };
