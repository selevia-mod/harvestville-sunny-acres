// Checking a phone's Supabase token and its farm, with no network: a key made here, and a fake Supabase that answers
// farm_topic_ok_v1 (what it was asked, and with which headers, is kept).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeSupabaseAuth } = require('../lib/auth');

const URL = 'https://example-project.supabase.co';
const TOPIC = 'farm:1234abcd-0000-4000-8000-00000000beef';

async function setup(answer) {
  const jose = await import('jose');
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
  const jwk = Object.assign(await jose.exportJWK(publicKey), { kid: 'k1', alg: 'ES256' });
  const keys = jose.createLocalJWKSet({ keys: [jwk] });
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const ok = typeof answer === 'function' ? answer(JSON.parse(init.body).p_topic) : answer;
    return { ok: true, status: 200, json: async () => ok };
  };
  const sign = (sub, opts) => {
    const o = opts || {};
    let j = new jose.SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256', kid: 'k1' }).setSubject(sub)
      .setIssuer(o.iss || URL + '/auth/v1').setAudience(o.aud || 'authenticated').setIssuedAt();
    j = j.setExpirationTime(o.exp || '1h');
    return j.sign(o.key || privateKey);
  };
  const auth = makeSupabaseAuth({ url: URL, anonKey: 'anon-test-key', fetch, keys });
  return { jose, auth, calls, sign };
}

test('a good token: the player is its sub, and the farm is asked as that player', async () => {
  const { auth, calls, sign } = await setup(true);
  const token = await sign('11111111-2222-4333-8444-555555555555');
  assert.deepStrictEqual(await auth.check(token, TOPIC), { uid: '11111111-2222-4333-8444-555555555555' });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, URL + '/rest/v1/rpc/farm_topic_ok_v1');
  assert.strictEqual(calls[0].init.method, 'POST');
  assert.strictEqual(calls[0].init.headers.apikey, 'anon-test-key');
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer ' + token);
  assert.deepStrictEqual(JSON.parse(calls[0].init.body), { p_topic: TOPIC });
  // again soon (a reconnect): no second call
  await auth.check(token, TOPIC);
  assert.strictEqual(calls.length, 1);
});

test('refused: expired, signed by someone else, another audience or issuer, nonsense; not on the farm', async () => {
  const { jose, auth, calls, sign } = await setup((topic) => topic === TOPIC);
  const other = (await jose.generateKeyPair('ES256')).privateKey;
  const old = Math.floor(Date.now() / 1000) - 3600;
  assert.deepStrictEqual(await auth.check(await sign('u1', { exp: old }), TOPIC), { why: 'auth' });
  assert.deepStrictEqual(await auth.check(await sign('u1', { key: other }), TOPIC), { why: 'auth' });
  assert.deepStrictEqual(await auth.check(await sign('u1', { aud: 'anon' }), TOPIC), { why: 'auth' });
  assert.deepStrictEqual(await auth.check(await sign('u1', { iss: 'https://evil.example/auth/v1' }), TOPIC), { why: 'auth' });
  assert.deepStrictEqual(await auth.check('not.a.token', TOPIC), { why: 'auth' });
  assert.strictEqual(calls.length, 0, 'a bad token never reaches Supabase');
  assert.deepStrictEqual(await auth.check(await sign('u1'), 'farm:99999999-0000-4000-8000-000000000000'), { why: 'topic' });
});

test('a hunting place (topic pub): a good token is all, no farm asked; a bad one still refused', async () => {
  const { auth, calls, sign } = await setup(false); // (on no farm at all)
  assert.deepStrictEqual(await auth.check(await sign('stranger-1'), 'pub'), { uid: 'stranger-1' });
  assert.strictEqual(calls.length, 0, 'Supabase is not asked about a farm');
  assert.deepStrictEqual(await auth.check(await sign('u1', { exp: Math.floor(Date.now() / 1000) - 3600 }), 'pub'), { why: 'auth' });
  assert.deepStrictEqual(await auth.check('not.a.token', 'pub'), { why: 'auth' });
});

test('Supabase not answering: refused (the phone plays the old way), and asked again next time', async () => {
  let up = false;
  const jose = await import('jose');
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
  const keys = jose.createLocalJWKSet({ keys: [Object.assign(await jose.exportJWK(publicKey), { kid: 'k1', alg: 'ES256' })] });
  const fetch = async () => { if (!up) throw new Error('down'); return { ok: true, status: 200, json: async () => true }; };
  const auth = makeSupabaseAuth({ url: URL, anonKey: 'k', fetch, keys });
  const token = await new jose.SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'k1' }).setSubject('u2').setIssuer(URL + '/auth/v1')
    .setAudience('authenticated').setExpirationTime('1h').sign(privateKey);
  assert.deepStrictEqual(await auth.check(token, TOPIC), { why: 'auth' });
  up = true;
  assert.deepStrictEqual(await auth.check(token, TOPIC), { uid: 'u2' });
});

test('no Supabase settings: it will not start', () => {
  assert.throws(() => makeSupabaseAuth({ url: '', anonKey: '' }));
});

// A game pass (SQL 60, security check #8, 23 Nov 2026): the page holds a pass, never the player's sign-in.
const PASS = 'hvp_' + 'ab'.repeat(32);
function passSupabase(owner, rooms) {
  const calls = [];
  const fetch = async (url, init) => {
    const name = url.split('/rpc/')[1], args = JSON.parse(init.body);
    calls.push({ name, args, headers: init.headers });
    const json = (v) => ({ ok: true, status: 200, json: async () => v });
    if (name === 'hvs_who_v1') return json(args.p_pass === PASS ? owner : null);
    if (name === 'hvs_topic_ok_v1') return json(args.p_pass === PASS && rooms.includes(args.p_topic));
    return { ok: false, status: 404, json: async () => null };
  };
  return { fetch, calls };
}

test('a game pass: its player, asked with the public key only (no sign-in sent), the farm through the pass; kept a minute', async () => {
  const sb = passSupabase('pass-owner-1', [TOPIC]);
  const auth = makeSupabaseAuth({ url: URL, anonKey: 'anon-test-key', fetch: sb.fetch, keys: {} });
  assert.deepStrictEqual(await auth.check(PASS, TOPIC), { uid: 'pass-owner-1' });
  assert.deepStrictEqual(sb.calls.map((c) => c.name), ['hvs_who_v1', 'hvs_topic_ok_v1']);
  assert.strictEqual(sb.calls[1].args.p_topic, TOPIC);
  for (const c of sb.calls) {
    assert.strictEqual(c.args.p_pass, PASS);
    assert.strictEqual(c.headers.apikey, 'anon-test-key');
    assert.strictEqual(c.headers.Authorization, undefined, 'no Authorization header');
  }
  assert.deepStrictEqual(await auth.check(PASS, 'pub'), { uid: 'pass-owner-1' });
  assert.deepStrictEqual(await auth.check(PASS, TOPIC), { uid: 'pass-owner-1' });
  assert.strictEqual(sb.calls.length, 2, 'the pass and the farm are kept a minute');
  assert.deepStrictEqual(await auth.check(PASS, 'farm:99999999-0000-4000-8000-000000000000'), { why: 'topic' });
});

test('a pass nobody holds (made up, run out, banned) is refused; a look-alike is not a pass', async () => {
  const sb = passSupabase('pass-owner-1', [TOPIC]);
  const auth = makeSupabaseAuth({ url: URL, anonKey: 'k', fetch: sb.fetch, keys: {} });
  assert.deepStrictEqual(await auth.check('hvp_' + 'cd'.repeat(32), 'pub'), { why: 'auth' });
  assert.deepStrictEqual(await auth.check('hvp_' + 'ZZ'.repeat(32), 'pub'), { why: 'auth' });
  assert.deepStrictEqual(sb.calls.map((c) => c.name), ['hvs_who_v1'], 'a look-alike never reaches Supabase as a pass');
});

test('the old sign-in turned off (HV_JWT=off): a good sign-in is refused, a pass still plays', async () => {
  const { auth: onAuth, sign } = await setup(true);
  const token = await sign('u1');
  assert.deepStrictEqual(await onAuth.check(token, 'pub'), { uid: 'u1' }, 'on: as before');
  const sb = passSupabase('pass-owner-1', [TOPIC]);
  const off = makeSupabaseAuth({ url: URL, anonKey: 'k', fetch: sb.fetch, keys: {}, jwt: false });
  assert.deepStrictEqual(await off.check(token, 'pub'), { why: 'auth' });
  assert.deepStrictEqual(await off.check(PASS, 'pub'), { uid: 'pass-owner-1' });
});
