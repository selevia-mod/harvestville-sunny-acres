// Unit tests for hunting together's rules (src/00-zzzzhunt.js, src/01-logicL.js): Hunter's gear bought once for Gold,
// what each piece changes, the save (old saves too), and tips past the 31st kept in their own saved number.
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
const plain = (x) => JSON.parse(JSON.stringify(x));

test("Hunter's gear: three pieces at Kanor's prices, their icons at the very end of the items sheet", () => {
  assert.deepStrictEqual(plain(C.GEAR.map((g) => [g.key, g.gold])), [['cloak', 3000], ['boots', 2500], ['quiver', 4000]]);
  const at = C.ICON_ORDER.indexOf('gear_cloak'); // (farm tech's icons come after them: farmtech.test.js)
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(at, at + 3)), ['gear_cloak', 'gear_boots', 'gear_quiver']);
  assert.strictEqual(at, 253, 'after every icon before them');
  C.GEAR.forEach((g) => assert.strictEqual(g.icon, C.ICON['gear_' + g.key]));
});

test("Hunter's gear: bought once, for its price; not without the Gold", () => {
  const s = fresh();
  s.gold = 2999;
  assert.strictEqual(L.buyGear(s, 'cloak'), 'gold');
  assert.strictEqual(L.hasGear(s, 'cloak'), false);
  s.gold = 5000;
  assert.strictEqual(L.buyGear(s, 'cloak'), 'ok');
  assert.strictEqual(s.gold, 2000);
  assert.strictEqual(L.buyGear(s, 'cloak'), 'owned');
  assert.strictEqual(s.gold, 2000, 'never paid twice');
  assert.strictEqual(L.buyGear(s, 'cape'), 'none');
  assert.strictEqual(L.gearBits(s), 1);
});

test("Hunter's gear: the cloak lets you closer, the boots let you sneak faster, the quiver brings arrows back", () => {
  assert.strictEqual(L.gearNotice(0), 1);
  assert.strictEqual(L.gearNotice(1), 0.75);
  assert.strictEqual(L.gearSneak(0), 0.6, 'as before: under 0.6 of full speed is sneaking');
  assert.strictEqual(L.gearSneak(2), 0.85);
  assert.strictEqual(L.gearNotice(2), 1, 'the boots alone do not hide you');
  const s = fresh();
  assert.strictEqual(L.arrowBack(s, () => 0), false, 'no quiver: a miss is a miss');
  s.gold = 9999;
  L.buyGear(s, 'quiver');
  assert.strictEqual(L.arrowBack(s, () => 0.39), true);
  assert.strictEqual(L.arrowBack(s, () => 0.4), false, '2 times in 5');
});

test("Hunter's gear: the save keeps it, an old save has none, junk is dropped", () => {
  const s = fresh();
  assert.strictEqual(roundTrip(s).hg, 0);
  s.gold = 99999;
  L.buyGear(s, 'boots');
  L.buyGear(s, 'quiver');
  const back = roundTrip(s);
  assert.strictEqual(L.hasGear(back, 'boots'), true);
  assert.strictEqual(L.hasGear(back, 'quiver'), true);
  assert.strictEqual(L.hasGear(back, 'cloak'), false);
  const o = plain(L.serialize(s));
  delete o.hg;
  assert.strictEqual(L.deserialize(o).hg, 0, 'an old save');
  o.hg = 255;
  assert.strictEqual(L.deserialize(o).hg, 7, 'only the three pieces');
  o.hg = 'x';
  assert.strictEqual(L.deserialize(o).hg, 0);
});

test('tips past the 31st go in their own saved number: each shows once, old tips keep their places', () => {
  const keys = C.TIPS.map((t) => t.key);
  assert.ok(keys.length > 31, 'more than one saved number holds');
  ['hunt_together_tour', 'hunt_dog_tour', 'gear_tour'].forEach((k) => assert.ok(keys.indexOf(k) >= 29, k + ' appended'));
  assert.strictEqual(keys.indexOf('mine_tour'), 28, 'the tips before keep their bits');
  const s = fresh();
  ['wild', 'mine_tour', 'hunt_together_tour', 'hunt_dog_tour', 'gear_tour'].forEach((k) => {
    assert.strictEqual(L.tipSeen(s, k), false, k);
    assert.ok(L.takeTip(s, k), k);
    assert.strictEqual(L.takeTip(s, k), null, k + ' once');
    assert.strictEqual(L.tipSeen(s, k), true, k);
  });
  assert.ok(s.tq > 0, 'the later ones are in s.tq');
  assert.ok(s.tips < 2147483648 && s.tips > 0);
  const back = roundTrip(s);
  ['wild', 'mine_tour', 'hunt_together_tour', 'hunt_dog_tour', 'gear_tour'].forEach((k) => assert.strictEqual(L.tipSeen(back, k), true, k + ' after the save'));
  assert.strictEqual(L.tipSeen(back, 'kanor'), false, 'one not shown stays not shown');
  assert.strictEqual(roundTrip(fresh()).tq, 0);
});

test('the dog: numbers that make sense', () => {
  const D = C.HUNT_DOG;
  assert.ok(D.sniff[0] < D.sniff[1] && D.fetch[0] < D.fetch[1] && D.sniffEvery[0] < D.sniffEvery[1]);
  assert.ok(D.behind < D.run, 'it runs only when left behind');
});
