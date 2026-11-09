// Farm Raids step 2: the game server checks a real raid (lib/fraid.js): it replays the phone's drops with the game's own
// rules and records only its own result. Supabase is a fake here that keeps the raid row as part 25 would.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../lib/rules');
const { makeFraid } = require('../lib/fraid');
const { Game } = require('../lib/game');

const R = load();
const { L, C } = R;
const RAID = '11111111-2222-4333-8444-555555555555';

// a 20 x 14 farm with ripe crops, eggs, the stall and its coins, guarded by a dog
const copy = () => {
  const w = 20, h = 14, loot = [];
  for (let i = 0; i < 20; i++) loot.push({ kind: 'crops', x: 4 + (i % 10), y: 6 + Math.floor(i / 10), n: 1 });
  loot.push({ kind: 'produce', x: 16, y: 3, n: 6 }, { kind: 'gold', x: 10, y: 2, n: 300 }, { kind: 'stall', x: 12, y: 2, n: 20 });
  const farm = { w, h, solid: '0'.repeat(w * h), defs: [{ t: 'dog', x: 10, y: 4, lv: 1 }], loot };
  farm.drop = L.frDropCells(farm);
  farm.value = L.frCopyValue(farm);
  return farm;
};
const army = { goat: { n: 8, lv: 2 }, crow: { n: 2, lv: 1 } };

// the phone's battle: 8 goats wherever they may come down, then it runs out
const play = (row) => {
  const b = L.frStart(L.frRealFarm(row.copy, row.cap, row.seed), row.army, row.seed);
  let i = 0;
  for (let y = 0; y < b.farm.h && i < 8; y++) for (let x = 0; x < b.farm.w && i < 8; x++) if (L.frDrop(b, 'goat', x, y)) i++;
  while (!b.end) L.frStep(b);
  return b;
};

// a fake Supabase: the raid row, and what settle was sent (the token must be the attacker's: 'tok:att')
function fakeSupabase(row) {
  const calls = [];
  const fetch = async (url, init) => {
    const name = url.split('/rpc/')[1], args = JSON.parse(init.body), token = init.headers.Authorization.slice(7);
    calls.push({ name, args, token });
    const json = (v) => ({ ok: true, status: 200, json: async () => v });
    if (token !== 'tok:att') return json(null);
    if (name === 'farm_fraid_raid_v1') return json(args.p_raid === row.raid ? row : null);
    if (name === 'farm_fraid_settle_v1') {
      if (args.p_key !== 'server-key') return json({ ok: false, code: 'key' });
      row.state = 'done';
      const prize = Math.min(args.p_taken.value, Math.ceil(row.copy.value * row.cap));
      return json({ ok: true, stars: args.p_stars, prize, points: [2, 10, 25, 50][args.p_stars] });
    }
    return { ok: false, status: 404, json: async () => null };
  };
  return { fetch, calls };
}
const fresh = () => ({ raid: RAID, copy: copy(), army, seed: 99, cap: 0.3, state: 'open' });

test("the server replays the phone's drops: its stars and loot, not the phone's", async () => {
  const row = fresh(), sb = fakeSupabase(row);
  const fr = makeFraid({ url: 'https://sb.test', anonKey: 'anon', key: 'server-key', fetch: sb.fetch, rules: R });
  const b = play(row);
  const r = await fr.settle('tok:att', RAID, b.moves);
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.stars, L.frStars(b));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.taken)), JSON.parse(JSON.stringify(L.frTaken(b))));
  const sent = sb.calls.find((c) => c.name === 'farm_fraid_settle_v1').args;
  assert.strictEqual(sent.p_key, 'server-key');
  assert.strictEqual(sent.p_stars, L.frStars(b));
  assert.ok(r.prize <= Math.ceil(row.copy.value * row.cap));
  assert.strictEqual((await fr.settle('tok:att', RAID, b.moves)).code, 'done', 'once only');
});

test('a phone cannot claim more: odd drops, a drop the rules refuse, an army no camp holds, another player', async () => {
  const fr = (row) => makeFraid({ url: 'https://sb.test', anonKey: 'anon', key: 'server-key', fetch: fakeSupabase(row).fetch, rules: R });
  const row = fresh(), b = play(row);
  assert.strictEqual((await fr(fresh()).settle('tok:att', RAID, [[0, 'goat', 1.5, 2]])).code, 'moves', 'not whole numbers');
  assert.strictEqual((await fr(fresh()).settle('tok:att', RAID, [[5, 'goat', 0, 0], [1, 'goat', 0, 1]])).code, 'moves', 'out of time order');
  const mid = [[0, 'goat', 10, 6]]; // (right on the crops: the rules refuse it)
  assert.strictEqual((await fr(fresh()).settle('tok:att', RAID, mid)).code, 'moves', 'a drop the rules refuse');
  const big = fresh(); big.army = { goat: { n: 5000, lv: 1 } };
  assert.strictEqual((await fr(big).settle('tok:att', RAID, b.moves)).code, 'army');
  assert.strictEqual((await fr(fresh()).settle('tok:someone-else', RAID, b.moves)).code, 'none', "another player's raid");
  assert.strictEqual((await makeFraid({ url: 'https://sb.test', anonKey: 'anon', key: 'wrong', fetch: fakeSupabase(fresh()).fetch, rules: R }).settle('tok:att', RAID, b.moves)).code, 'key');
  assert.strictEqual((await makeFraid({ rules: R }).settle('tok:att', RAID, b.moves)).code, 'off', 'no key set: nothing recorded');
});

test("on the line: a phone sends 'fr' and hears 'frr' (no room needed)", async () => {
  const row = fresh(), b = play(row);
  const fraid = makeFraid({ url: 'https://sb.test', anonKey: 'anon', key: 'server-key', fetch: fakeSupabase(row).fetch, rules: R });
  const game = new Game({ auth: { check: async () => ({ why: 'auth' }) }, rules: R, fraid });
  const heard = [];
  const c = game.connect({ send: (s) => heard.push(JSON.parse(s)), close: () => {}, bufferedAmount: 0 });
  game.message(c, JSON.stringify({ t: 'fr', v: 1, token: 'tok:att', raid: RAID, moves: b.moves }));
  for (let i = 0; i < 20 && !heard.some((m) => m.t === 'frr'); i++) await new Promise((r) => setImmediate(r));
  const ans = heard.find((m) => m.t === 'frr');
  assert.ok(ans && ans.ok && ans.raid === RAID, JSON.stringify(heard));
  assert.strictEqual(ans.stars, L.frStars(b));
  void C;
});
