// Friends meet in a dungeon without going to each other's farm first (owner, 7 Nov 2026: "it should be automatic").
// Each phone comes from its own farm (its own topic) and says who its friends are (`with`); the server puts it on a
// friend's floor if one is there with space and the server's own check lets it in (friends, or a farm open to all).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { world } = require('./helpers');

const farm = (n) => 'farm:' + String(n).padStart(8, '0') + '-0000-4000-8000-000000000000';
// the server's check (farm_topic_ok_v1): your own farm, or a friend's
const FRIENDS = { ann: ['bo', 'cy'], bo: ['ann'], cy: ['ann'], dee: [] };
const own = { ann: farm(1), bo: farm(2), cy: farm(3), dee: farm(4) };
const auth = { check: async (token, topic) => {
  const m = /^tok:(.+)$/.exec(token);
  if (!m) return { why: 'auth' };
  const uid = m[1], host = Object.keys(own).find((k) => own[k] === topic);
  if (topic === own[uid] || (host && (FRIENDS[uid] || []).indexOf(host) >= 0)) return { uid };
  return { why: 'topic' };
} };
const at = (w, p) => { const r = p.c.room; return r ? r.topic : null; };

test('a friend going down the same floor lands with you, from their own farm; a stranger does not; 8 at most; back to it after a drop', async () => {
  const w = world({ auth });
  const ann = await w.phone('ann', { topic: own.ann, floor: 3 });
  // Bo, on their own farm, with Ann among their friends: on Ann's floor
  const bo = await w.phone('bo', { topic: own.bo, floor: 3, with: ['ann', 'zed'] });
  assert.strictEqual(at(w, bo), own.ann, 'Bo is on Ann\'s floor');
  assert.deepStrictEqual(bo.last('wl').ppl.map((r) => r[0]), ['ann'], 'and sees Ann');
  assert.strictEqual(bo.last('wl').pp, 1, 'who is here is the server\'s to say');
  w.run(50);
  assert.ok(ann.all('tk').some((m) => (m.come || []).some((r) => r[0] === 'bo')), 'Ann sees Bo come');
  // Dee says Ann is a friend, but the server's check says no: Dee's own floor
  const dee = await w.phone('dee', { topic: own.dee, floor: 3, with: ['ann'] });
  assert.strictEqual(at(w, dee), own.dee);
  // another floor: nobody there, your own
  const cy = await w.phone('cy', { topic: own.cy, floor: 4, with: ['ann'] });
  assert.strictEqual(at(w, cy), own.cy);
  // chat, waves and arrows on a cave floor
  ann.say({ t: 'say', s: 'Tara!' });
  assert.strictEqual(bo.last('say').s, 'Tara!');
  ann.say({ t: 'em', k: 'wave' });
  assert.strictEqual(bo.last('em').k, 'wave');
  // Bo's line drops and comes back: the same floor (Ann's), even without saying friends again
  bo.drop();
  const bo2 = await w.phone('bo', { topic: own.bo, floor: 3 });
  assert.strictEqual(at(w, bo2), own.ann, 'back where Bo was');
  // 8 at most on a floor: the 9th friend of Ann gets their own
  FRIENDS.ann = Object.keys(own);
  for (let i = 0; i < 6; i++) { own['f' + i] = farm(10 + i); FRIENDS['f' + i] = ['ann']; await w.phone('f' + i, { topic: own['f' + i], floor: 3, with: ['ann'] }); }
  assert.strictEqual(ann.c.room.players.size, 8);
  own.f9 = farm(19); FRIENDS.f9 = ['ann'];
  const f9 = await w.phone('f9', { topic: own.f9, floor: 3, with: ['ann'] });
  assert.strictEqual(at(w, f9), own.f9, 'a full floor: your own');
});
