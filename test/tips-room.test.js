// Tips and tours seen, past the 62nd (src/01-logicL.js): s.tips holds 0-30, s.tq 31-62 (its bit 31 too: a signed number),
// s.tq2 (saved 'tz') 63-94. 9 Nov 2026: tq came back as 0 when its bit 31 (tip 62, 'dog_name') was set, and tip 63 took
// tip 31's place.
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
require('./clock')(ctx).set(2026, 11, 9, 10, 0);
// this file's own copy of the game: pad the list to 95 tips (the real list is shorter)
while (C.TIPS.length < 95) C.TIPS.push({ key: 'pad_' + C.TIPS.length, text: 'PAD' });
const key = (i) => C.TIPS[i].key;
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));

test('tips 31-62 in s.tq: the last one (bit 31) keeps the rest after a save and load', () => {
  const s = L.newState();
  [31, 40, 61].forEach((i) => assert.ok(L.takeTip(s, key(i))));
  assert.ok(L.takeTip(s, key(62)), 'tip 62 (bit 31)');
  assert.ok(s.tq < 0, 'bit 31 makes the number negative');
  const back = roundTrip(s);
  [31, 40, 61, 62].forEach((i) => assert.ok(L.tipSeen(back, key(i)), 'tip ' + i + ' still seen'));
  [32, 60].forEach((i) => assert.ok(!L.tipSeen(back, key(i)), 'tip ' + i + ' still new'));
});

test('tips 63-94 in their own number (tz): not tip 31 or 32', () => {
  const s = L.newState();
  assert.ok(L.takeTip(s, key(31)));
  assert.ok(!L.tipSeen(s, key(63)), 'seeing tip 31 is not seeing tip 63');
  assert.ok(L.takeTip(s, key(63)), 'tip 63 shows the first time');
  assert.ok(!L.tipSeen(s, key(32)), 'nor does it mark tip 32');
  assert.ok(L.takeTip(s, key(94)));
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  assert.ok(o.tz < 0 && o.tq === 1, 'tips 63 and 94 in tz, tip 31 in tq');
  const back = L.deserialize(o);
  [31, 63, 94].forEach((i) => assert.ok(L.tipSeen(back, key(i)), 'tip ' + i + ' still seen'));
  assert.ok(!L.takeTip(back, key(63)), 'and it does not show again');
});

test('a save made by e45 with tq negative (tip 62 seen) loads every tip in it', () => {
  const s = L.newState();
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  o.tq = (1 << 31) + (1 << 29) + 7; // bits 31, 29, 0-2: what e45 saved after the dog's name was asked
  const back = L.deserialize(o);
  [31, 32, 33, 60, 62].forEach((i) => assert.ok(L.tipSeen(back, key(i)), 'tip ' + i));
  assert.ok(!L.tipSeen(back, key(61)), 'tip 61 (bit 30) was not seen');
  assert.strictEqual(roundTrip(L.newState()).tq2, 0, 'a new farm: none past 62');
});
