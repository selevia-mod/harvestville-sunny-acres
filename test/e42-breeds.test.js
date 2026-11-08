// e42 (owner, 8 Nov 2026: "Add a small extra repair, also this will not happen again right?"). The birthday bug
// (29 Oct - 8 Nov 2026) let go of the animals past the small coop and barn: the newest ones, so the coloured ones bred or
// bought from Lily. Their colours are still in the Breeds book (s.brf), and an animal never leaves a farm any other way,
// so a colour in the book with none in the pen was lost: one of each comes home, once, with a letter from Lily. And a
// save with more animals than the small coop or barn holds keeps them all (it had the bigger one): never let go again.
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

const plain = (x) => JSON.parse(JSON.stringify(x));
const save = (s) => plain(L.serialize(s));
const roundTrip = (s) => L.deserialize(save(s));
const K = (k) => C.ANIMAL_KEYS.indexOf(k);
const colours = (s, kind) => s.animals.filter((a) => a.kind === kind).map((a) => L.breedOf(a)).sort();
const animal = (kind, name, br) => Object.assign({ kind, name, love: 100, fed: 1, pet: 1, ready: 0, brushed: 0, young: 0, preg: 0 }, br ? { br } : {});

// jeshhhh's farm on 8 Nov (farm.saves): 4 hens, 4 cows, 2 pigs, 2 carabaos, all plain; the Breeds book has Brown Spotted
// and Tan cows, Native Black and Ginger pigs, the Mud Brown carabao. Saved by the old code: the birthday over the builds.
const jeshFarm = () => {
  clock.set(2026, 11, 8, 11, 0);
  const s = L.newState();
  s.animals = [];
  ['Clucky', 'Nugget', 'Pecky', 'Henrietta'].forEach((n) => s.animals.push(animal('chicken', n)));
  ['Daisy', 'Bessie', 'Clover', 'Buttercup'].forEach((n) => s.animals.push(animal('cow', n)));
  ['Oinky', 'Truffles'].forEach((n) => s.animals.push(animal('pig', n)));
  ['Kalabaw', 'Bantay'].forEach((n) => s.animals.push(animal('carabao', n)));
  s.brf = [];
  s.brf[K('chicken')] = 1; s.brf[K('cow')] = 7; s.brf[K('pig')] = 7; s.brf[K('carabao')] = 3;
  const o = save(s);
  delete o.rb;
  delete o.bb;
  o.bd = [724, 0];
  return o;
};

test('a farm the bug wiped gets one of each lost colour back (adults, in the bigger coop and barn), and a letter from Lily', () => {
  const r = L.deserialize(jeshFarm());
  assert.strictEqual(r.builds.barn2, 1);
  assert.deepStrictEqual(colours(r, 'cow'), [0, 0, 0, 0, 1, 2], 'Brown Spotted Cow and Tan Cow');
  assert.deepStrictEqual(colours(r, 'pig'), [0, 0, 1, 2], 'Native Black Pig and Ginger Pig');
  assert.deepStrictEqual(colours(r, 'carabao'), [0, 0, 1], 'Mud Brown Carabao');
  assert.deepStrictEqual(colours(r, 'chicken'), [0, 0, 0, 0], 'no colour of hen was found: none comes');
  const back = r.animals.filter((a) => L.breedOf(a));
  assert.strictEqual(back.length, 5);
  back.forEach((a) => { assert.strictEqual(a.young, 0, 'grown'); assert.ok(a.name, 'named'); });
  assert.deepStrictEqual(r.mail.slice(0, 2), ['sorry_bd', 'breeds_back'], 'the mayor\'s letter first, then Lily\'s');
  assert.match(L.letter('breeds_back').text, /Lily/);
  // their colours are kept by the save, and it is once
  const again = roundTrip(r);
  assert.deepStrictEqual(colours(again, 'cow'), [0, 0, 0, 0, 1, 2]);
  assert.strictEqual(again.animals.length, 17, 'no second lot');
  assert.strictEqual(again.mail.filter((m) => m === 'breeds_back').length, 1, 'the letter (unread) once');
});

test('a farm already repaired by e41 (builds list back) still gets its lost colours, once', () => {
  const o = jeshFarm();
  const r41 = L.deserialize(o);
  const o41 = save(r41);
  // e41 wrote the builds list and no rb; its animals were the 12 plain ones
  delete o41.rb;
  o41.a = o.a; o41.br = o.br;
  const r = L.deserialize(o41);
  assert.deepStrictEqual(colours(r, 'pig'), [0, 0, 1, 2]);
  assert.strictEqual(r.animals.length, 17);
  assert.ok(r.mail.includes('breeds_back'));
  assert.strictEqual(roundTrip(r).animals.length, 17);
});

test('a farm that lost nothing gets nothing (and no letter); a colour comes back only while there is room; rare ones too', () => {
  clock.set(2026, 11, 8, 11, 0);
  const s = L.newState();
  s.animals = [animal('cow', 'A', 1), animal('cow', 'B')];
  s.brf = []; s.brf[K('cow')] = 3;
  const o = save(s);
  delete o.rb;
  const r = L.deserialize(o);
  assert.deepStrictEqual(colours(r, 'cow'), [0, 1]);
  assert.ok(!r.mail.includes('breeds_back'));
  // a full coop: the Golden Hen (rare) waits... no, there is no room: it does not come
  const t = L.newState();
  t.animals = [0, 1, 2, 3].map((i) => animal('chicken', 'H' + i));
  t.brf = []; t.brf[K('chicken')] = 1 | 8 | 4;
  const ot = save(t);
  delete ot.rb;
  const rt = L.deserialize(ot);
  assert.deepStrictEqual(colours(rt, 'chicken'), [0, 0, 0, 0], 'small coop, full: nothing added');
  t.builds.coop2 = 1;
  const ot2 = save(t);
  delete ot2.rb;
  const rt2 = L.deserialize(ot2);
  assert.deepStrictEqual(colours(rt2, 'chicken'), [0, 0, 0, 0, 2, 3], 'Black Hen and the rare Golden Hen');
});

test('never again: a save with more animals than the small coop or barn holds keeps them all, and the bigger building', () => {
  clock.set(2026, 11, 8, 11, 0);
  const s = L.newState();
  s.animals = [];
  for (let i = 0; i < 7; i++) s.animals.push(animal('chicken', 'H' + i));
  for (let i = 0; i < 3; i++) s.animals.push(animal('pig', 'P' + i));
  s.builds.coop2 = 1; s.builds.barn2 = 1;
  const o = save(s);
  // some future mix-up forgets both buildings
  o.bd = o.bd.map(() => 0);
  const r = L.deserialize(o);
  assert.strictEqual(r.animals.filter((a) => a.kind === 'chicken').length, 7, 'no hen let go');
  assert.strictEqual(r.animals.filter((a) => a.kind === 'pig').length, 3, 'no pig let go');
  assert.strictEqual(r.builds.coop2, 1);
  assert.strictEqual(r.builds.barn2, 1);
  // a farm within the small coop and barn gets nothing it did not build
  const n = roundTrip(L.newState());
  assert.strictEqual(n.builds.coop2, undefined);
  assert.strictEqual(n.builds.barn2, undefined);
});
