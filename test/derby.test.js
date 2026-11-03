// Unit tests for the three quick wins' rules (src/00-zzzzzmore.js, src/01-logicM.js): every fish weighed, the biggest of
// each kept in the save, the Derby only on Fish Monday, and the Daily gift's day 7 chest.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 11, 4, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('every fish has a weight: 0.8 to 1.2 times its usual, 1 in 15 a giant (1.4 to 1.6)', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.FISH_ORDER)), ['fish_s', 'fish_m', 'fish_l', 'fish_k']);
  C.FISH_ORDER.forEach((k) => assert.ok(C.FISH_KG[k] > 0 && C.ITEMS[k].kind === 'fish', k));
  assert.strictEqual(L.fishSize(seq(0.5, 0)), 0.8, 'not a giant: the smallest');
  assert.strictEqual(L.fishSize(seq(0.5, 1)), 1.2);
  assert.strictEqual(L.fishSize(seq(0.01, 1)), 1.6, 'a giant');
  assert.strictEqual(L.fishKg('fish_l', 1.1), 3.9);
  assert.strictEqual(L.fishKg('fish_s', 0.2), 0.1, 'never under 0.1 kg');
  for (let i = 0; i < 200; i++) { const z = L.fishSize(Math.random); assert.ok(z >= 0.8 && z <= 1.6); }
});

test('landing a fish weighs it; a bigger one than before is a record; the save keeps the biggest of each', () => {
  const s = fresh();
  assert.strictEqual(L.landFish(s, 'fish_l', seq(0.5, 0.5)), 'fish_l');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.lastFish)), { id: 'fish_l', kg: 3.5, giant: false, record: false }, 'the first is not a record');
  L.landFish(s, 'fish_l', seq(0.5, 0));
  assert.strictEqual(s.lastFish.record, false, 'a smaller one');
  L.landFish(s, 'fish_l', seq(0.01, 1));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.lastFish)), { id: 'fish_l', kg: 5.6, giant: true, record: true });
  assert.strictEqual(s.fb.fish_l, 5600);
  assert.strictEqual(s.stats.fish, 3, 'counted as before');
  const back = roundTrip(s);
  assert.strictEqual(back.fb.fish_l, 5600);
  assert.strictEqual(back.fb.fish_s, undefined);
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  delete o.fb;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.deserialize(o).fb)), {}, 'an old save');
  o.fb = [99999999, 'x', -4, 20000];
  const junk = L.deserialize(o).fb;
  assert.strictEqual(junk.fish_s, 480, 'no small fish over 0.48 kg');
  assert.strictEqual(junk.fish_m, undefined);
  assert.strictEqual(junk.fish_k, 19200, 'the biggest King Trout there can be');
});

test('a full bag lands nothing and weighs nothing', () => {
  const s = fresh();
  s.inv = s.inv.map((x, i) => ({ id: 'stone', n: 999 }));
  L.addItem = ((add) => function (st, id, n) { return st === s ? n : add(st, id, n); })(L.addItem);
  assert.strictEqual(L.landFish(s, 'fish_m', Math.random), '!full');
  assert.strictEqual(s.lastFish, null);
});

test('the Derby is on Fish Monday only (Monday 2 Nov 2026), and Today\'s Event says so', () => {
  clock.set(2026, 11, 2, 10, 0);
  assert.strictEqual(L.derbyOn(), true);
  clock.set(2026, 11, 3, 10, 0);
  assert.strictEqual(L.derbyOn(), false);
  assert.match(C.EVENTS.filter((e) => e.key === 'fish')[0].text, /Fishing Derby/);
});

test('the Daily gift: day 7 is a chest of 2 Sunbeams, 1,500G and a Power-Up; the other days as before', () => {
  assert.strictEqual(C.LOGIN.length, 7);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LOGIN[6])), { stars: 2, gold: 1500, item: 'power_up', n: 1 });
  assert.strictEqual(L.rewardLabel(C.LOGIN[6]), '1500G + 2 Sunbeams + Power-Up');
  const s = fresh();
  const yesterday = L.dayNum('2026-11-03');
  s.lg = { last: yesterday, streak: 6, claimed: yesterday };
  const gold = s.gold, stars = s.stars;
  const r = L.claimLogin(s, '2026-11-04');
  assert.strictEqual(r.day, 7);
  assert.strictEqual(s.gold - gold, 1500);
  assert.strictEqual(s.stars - stars, 2);
  assert.strictEqual(L.countItem(s, 'power_up') >= 1, true);
});
