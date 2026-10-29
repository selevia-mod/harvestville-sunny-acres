// Unit tests for home storage (owner, 30 Oct 2026): the Dresser and the Wardrobe share 60 slots, every farm gets a
// free Dresser once, putting away / taking out whole stacks, the save, older saves, and the save size with it all full.
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
require('./clock')(ctx);
const H = C.HOME;
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const dressers = (s) => s.home.items.filter((it) => it.t === H.typeIndex.dresser).length;

test('a new farm has 60 empty storage slots and a Dresser where nothing hides it', () => {
  const s = L.newState();
  assert.strictEqual(s.store.length, 60);
  assert.ok(s.store.every((x) => x === null));
  assert.strictEqual(dressers(s), 1);
  const d = s.home.items.find((it) => it.t === H.typeIndex.dresser);
  assert.strictEqual(L.cantPlace(s, d.t, d.x, d.y, s.home.items.indexOf(d)), null, 'a legal spot');
  assert.strictEqual(H.types[H.typeIndex.dresser].use, 'storage');
  assert.strictEqual(H.types[H.typeIndex.wardrobe].use, 'storage');
});

test('put a whole stack away, it stacks with the same item; take it out, what does not fit stays', () => {
  const s = L.newState();
  s.inv[8] = { id: 'carrot', n: 40 };
  s.inv[9] = { id: 'carrot', n: 70 };
  assert.strictEqual(L.storeIn(s, 8), 40);
  assert.strictEqual(s.inv[8], null);
  assert.strictEqual(L.storeIn(s, 9), 70);
  assert.deepStrictEqual(plain(s.store.slice(0, 2)), [{ id: 'carrot', n: 99 }, { id: 'carrot', n: 11 }]);
  assert.strictEqual(L.storeCount(s), 2);
  // a full bag: nothing comes out
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'stone_x', n: 1 };
  assert.strictEqual(L.storeOut(s, 0), 0);
  // one free slot: 99 come out, the other stack stays
  s.inv[17] = null;
  assert.strictEqual(L.storeOut(s, 0), 99);
  assert.strictEqual(s.store[0], null);
  assert.strictEqual(L.storeOut(s, 1), 0);
  assert.deepStrictEqual(plain(s.store[1]), { id: 'carrot', n: 11 });
  // a full storage takes nothing more
  for (let k = 0; k < s.store.length; k++) if (!s.store[k]) s.store[k] = { id: 'egg', n: 99 };
  s.inv[3] = { id: 'milk', n: 2 };
  assert.strictEqual(L.storeIn(s, 3), 0);
  assert.deepStrictEqual(plain(s.inv[3]), { id: 'milk', n: 2 });
});

test('storage is saved; an older save gets its free Dresser once, and not if it has one', () => {
  const s = L.newState();
  s.store[0] = { id: 'egg', n: 5 };
  s.store[59] = { id: 'milk', n: 3 };
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.store[0]), { id: 'egg', n: 5 });
  assert.deepStrictEqual(plain(back.store[59]), { id: 'milk', n: 3 });
  assert.strictEqual(back.store.length, 60);
  assert.strictEqual(dressers(back), 1, 'not a second one');
  // a farm from before storage, without a Dresser
  const old = L.newState();
  old.home.items = old.home.items.filter((it) => it.t !== H.typeIndex.dresser);
  const o = plain(L.serialize(old));
  delete o.kp;
  const got = L.deserialize(o);
  assert.strictEqual(dressers(got), 1, 'its free Dresser');
  assert.ok(got.store.every((x) => x === null));
  assert.strictEqual(dressers(roundTrip(got)), 1, 'once');
  // ... with a Dresser in furniture storage already: none more
  const had = L.newState();
  had.home.items = had.home.items.filter((it) => it.t !== H.typeIndex.dresser);
  had.home.bag[L.furnKey(H.typeIndex.dresser, 2)] = 1;
  const o2 = plain(L.serialize(had));
  delete o2.kp;
  const got2 = L.deserialize(o2);
  assert.strictEqual(dressers(got2), 0);
  assert.strictEqual(got2.home.bag[L.furnKey(H.typeIndex.dresser, 0)], undefined);
  // bad entries are dropped
  const o3 = plain(L.serialize(L.newState()));
  o3.kp = [['nope', 3], ['egg', -2], ['egg', 500], 'x'];
  const got3 = L.deserialize(o3);
  assert.strictEqual(got3.store[0], null);
  assert.strictEqual(got3.store[1], null);
  assert.deepStrictEqual(plain(got3.store[2]), { id: 'egg', n: 99 });
});

test('a full 90-slot bag and full storage still save under 16 KB', () => {
  const s = L.newState();
  C.ANIMAL_KEYS.forEach((k) => { for (let i = 0; i < C.ANIMALS[k].max; i++) s.animals.push({ kind: k, name: 'Buttercup 99', love: 100, fed: 1, pet: 1, ready: 2 }); });
  for (let i = 0; i < 24 * 38; i++) if (!s.debris[i]) s.soil[i] = { w: 1, c: 'pumpkin', d: 9 };
  L.resizeBag(s, C.BAG_SIZES.length - 1);
  s.inv = s.inv.map(() => ({ id: 'seed_strawberry', n: 99 }));
  s.store = s.store.map(() => ({ id: 'seed_strawberry', n: 99 }));
  const size = JSON.stringify(L.serialize(s)).length;
  assert.ok(size < C.MAX_SAVE_BYTES, 'save is ' + size + ' bytes');
});
