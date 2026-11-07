// Unit tests for looks (src/00-zzzlooks.js, src/01-logicK.js): the Elf is everyone's, Gold looks bought in the game,
// Coins and Stars looks owned when the server says, wearing only what you own, and the save (old saves too).
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
const fresh = () => { clock.set(2026, 11, 3, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));

test('eight looks at the owner\'s prices, then the Lair\'s Fire look, then the five caves\' looks (8 Nov 2026), in a fixed order', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LOOKS.map((l) => l.key))), ['elf', 'straw', 'ranch', 'winter', 'flower', 'santa', 'fiesta', 'bunny', 'fire', 'terrace', 'hills', 'lake', 'forest', 'feather']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LOOKS.map((l) => [l.free || false, l.gold || 0, l.coins || 0, l.stars || 0]))),
    [[true, 0, 0, 0], [false, 50000, 0, 0], [false, 150000, 0, 0], [false, 300000, 0, 0], [false, 0, 100, 150], [false, 0, 150, 0], [false, 0, 150, 200], [false, 0, 150, 200],
      [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0], [false, 0, 0, 0]]);
});

test('the Fire look has no price in the game: it is yours only when the server says so, and then it is worn and saved', () => {
  const s = fresh();
  assert.strictEqual(L.lookDef('fire').reward, 'lair');
  assert.strictEqual(L.ownsLook(s, 'fire'), false);
  assert.strictEqual(L.buyLookGold(s, 'fire'), 'paid');
  assert.strictEqual(L.wearLook(s, 'fire'), false);
  assert.strictEqual(L.ownLooks(s, ['fire']), 1);
  assert.strictEqual(L.wearLook(s, 'fire'), true);
  const back = roundTrip(s);
  assert.strictEqual(L.ownsLook(back, 'fire'), true, 'its bit (the 9th) survives the save');
  assert.strictEqual(L.wornLook(back), 'fire');
});

test('the Elf is everyone\'s; a Gold look is bought once, for its price; a Coins look is not sold here', () => {
  const s = fresh();
  assert.strictEqual(L.ownsLook(s, 'elf'), true);
  assert.strictEqual(L.ownsLook(s, 'straw'), false);
  s.gold = 49999;
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'gold');
  assert.strictEqual(s.gold, 49999);
  s.gold = 60000;
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'ok');
  assert.strictEqual(s.gold, 10000);
  assert.strictEqual(L.buyLookGold(s, 'straw'), 'owned');
  assert.strictEqual(s.gold, 10000, 'never twice');
  assert.strictEqual(L.buyLookGold(s, 'santa'), 'paid');
  assert.strictEqual(L.buyLookGold(s, 'nope'), 'none');
});

test('what the server says you own is yours; nonsense is ignored', () => {
  const s = fresh();
  assert.strictEqual(L.ownLooks(s, ['santa', 'bunny', 'santa', 'x', 7, null]), 2);
  assert.strictEqual(L.ownsLook(s, 'santa') && L.ownsLook(s, 'bunny'), true);
  assert.strictEqual(L.ownLooks(s, 'santa'), 0);
});

test('you wear only what you own; it is saved, and an old save wears its own clothes', () => {
  const s = fresh();
  assert.strictEqual(L.wearLook(s, 'ranch'), false);
  assert.strictEqual(L.wornLook(s), '');
  assert.strictEqual(L.wearLook(s, 'elf'), true);
  assert.strictEqual(L.wornLook(roundTrip(s)), 'elf');
  s.gold = 1e6; L.buyLookGold(s, 'winter'); L.wearLook(s, 'winter');
  const back = roundTrip(s);
  assert.strictEqual(L.wornLook(back), 'winter');
  assert.strictEqual(L.ownsLook(back, 'winter'), true);
  assert.strictEqual(L.ownsLook(back, 'ranch'), false);
  L.wearLook(back, '');
  assert.strictEqual(L.serialize(back).cw, undefined, 'own clothes: nothing saved');
  const old = L.serialize(fresh()); delete old.co; delete old.cw;
  const o = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.deepStrictEqual([o.lk, o.cw], [0, '']);
  const forged = L.serialize(fresh()); forged.cw = 5; // wearing Santa without owning it
  assert.strictEqual(L.wornLook(L.deserialize(forged)), '');
});

test('the four new tours take the next free tip bits, under 31', () => {
  const keys = C.TIPS.map((t) => t.key);
  ['tailor_tour', 'event_tour', 'rare_tour', 'mine_tour'].forEach((k) => assert.ok(keys.indexOf(k) >= 0 && keys.indexOf(k) < 31, k));
  assert.strictEqual(new Set(keys).size, keys.length);
});
