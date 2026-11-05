// Unit tests for animal breeds (src/00-zzzzzzz-breeding.js, src/01-logicZ-breeding.js): colours for every kind, the
// shop's common ones, newborns taking after their parents with a small chance of a rare colour, the rare bonus, the
// Miracle Potion on pigs and carabaos, the Breeds book and its prizes, the save (old saves too) and friends' visits.
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const fresh = () => { clock.set(2026, 11, 4, 10, 0); const s = L.newState(); s.seed = 11; s.gold = 1e6; s.builds.coop2 = 1; s.builds.barn2 = 1; L.takeNotes(); return s; };
const withRandom = (rnd, fn) => { const was = L.brRandom; L.brRandom = rnd; try { return fn(); } finally { L.brRandom = was; } };
const breeds = (s, kind) => plain(s.animals.filter((a) => a.kind === kind).map((a) => L.breedOf(a)));
const B = (kind, key) => C.BREEDS[kind].findIndex((d) => d.key === key);

test('every farm animal has a few colours: the art as it is first, at least one rare, each with a paint and a prize', () => {
  assert.deepStrictEqual(plain(Object.keys(C.BREEDS).sort()), plain(C.ANIMAL_KEYS.slice().sort()));
  C.ANIMAL_KEYS.forEach((k) => {
    const list = C.BREEDS[k];
    assert.ok(list.length >= 3 && list.length <= 8, k);
    assert.ok(!list[0].rare && !list[0].paint, k + ': the first is the art itself');
    assert.ok(list.some((d) => d.rare) && list.filter((d) => !d.rare).length >= 2, k + ': commons and a rare one');
    assert.strictEqual(new Set(list.map((d) => d.name)).size, list.length);
    list.slice(1).forEach((d) => {
      assert.ok(L.breedSel[d.paint.sel], d.name);
      d.paint.ramp.forEach((h) => assert.match(h, /^#[0-9a-f]{6}$/, d.name));
      assert.ok(d.paint.range[0] < d.paint.range[1]);
    });
    assert.ok(C.BREEDING.prize[k].gold > 0 && C.ITEMS[C.BREEDING.prize[k].item], k);
  });
  assert.ok(C.BREEDING.rare >= 1 / 50 && C.BREEDING.rare <= 1 / 20, 'rare: 1 in 20 to 1 in 50');
  assert.ok(C.TIPS.some((t) => t.key === 'breeds_tour'));
  assert.ok(C.NEWS.some((n) => n.lines.some((l) => l[3] === 'breeds')));
});

test('a new game: Clucky is a White Hen, the first in the Breeds book; L.animalBreed says so', () => {
  const s = fresh();
  assert.strictEqual(L.breedOf(s.animals[0]), 0);
  assert.strictEqual(s.animals[0].br, undefined, 'breed 0 is no property at all');
  assert.deepStrictEqual(plain(L.animalBreed(s, 0)), { kind: 'chicken', index: 0, key: 'white', name: 'White Hen', rare: false });
  assert.strictEqual(L.animalBreed(s, 5), null);
  assert.deepStrictEqual(plain(L.animalBreed(s.animals[0], s, 0)), plain(L.animalBreed(s, 0)), 'the contests\' call: the record first');
  s.animals[0].br = B('chicken', 'golden');
  assert.deepStrictEqual(plain(L.animalBreed(s.animals[0], s, 0)), { kind: 'chicken', index: 3, key: 'golden', name: 'Golden Hen', rare: true });
  assert.strictEqual(L.animalBreed(null, s, 9), null);
  delete s.animals[0].br;
  assert.strictEqual(L.breedFound(s, 'chicken', 0), true);
  assert.strictEqual(L.breedsFound(s, 'chicken'), 1);
  assert.strictEqual(L.breedsFound(s, 'cow'), 0);
});

test("Lily's shop sends a common colour you have not found yet, then any common one, never a rare one", () => {
  const s = fresh();
  const got = [1, 2, 3, 4, 5].map(() => L.buyAnimal(s, 'chicken'));
  assert.deepStrictEqual(breeds(s, 'chicken').slice(0, 3), [0, B('chicken', 'brown'), B('chicken', 'black')]);
  assert.strictEqual(got.length, 5);
  assert.ok(breeds(s, 'chicken').every((b) => !C.BREEDS.chicken[b].rare));
  for (let i = 0; i < 200; i++) assert.ok(!C.BREEDS.cow[L.shopBreed(s, 'cow', Math.random)].rare || false);
  withRandom(seq(0.99), () => { L.buyAnimal(s, 'cow'); L.buyAnimal(s, 'cow'); L.buyAnimal(s, 'cow'); L.buyAnimal(s, 'cow'); });
  assert.deepStrictEqual(breeds(s, 'cow'), [0, B('cow', 'brown'), B('cow', 'tan'), B('cow', 'tan')], 'the last common one (rnd 0.99) once all are found');
  assert.strictEqual(L.breedsFound(s, 'cow'), 3);
});

test('a newborn: about 1 in 25 rare (1 in 5 with a rare parent); otherwise its mother\'s or its father\'s colour', () => {
  const brown = B('chicken', 'brown'), black = B('chicken', 'black'), gold = B('chicken', 'golden');
  assert.strictEqual(L.pickBreed('chicken', brown, black, seq(0.03)), gold, 'under 1/25: rare');
  assert.strictEqual(L.pickBreed('chicken', brown, black, seq(0.05, 0.2)), brown, 'mother');
  assert.strictEqual(L.pickBreed('chicken', brown, black, seq(0.05, 0.7)), black, 'father');
  assert.strictEqual(L.pickBreed('chicken', brown, null, seq(0.05, 0.7)), brown, 'no father: mother');
  assert.strictEqual(L.pickBreed('chicken', gold, null, seq(0.1)), gold, 'a rare mother: 1 in 5');
  assert.strictEqual(L.pickBreed('chicken', gold, null, seq(0.3, 0.2, 0)), 0, 'not rare: a common one (her colour is rare)');
  assert.strictEqual(L.pickBreed('chicken', null, null, seq(0.5, 0.5, 0.5)), 1, 'no parents: any common');
  // over many births
  let rare = 0, n = 20000;
  for (let i = 0; i < n; i++) if (C.BREEDS.cow[L.pickBreed('cow', 0, 1, Math.random)].rare) rare++;
  assert.ok(rare / n > 0.03 && rare / n < 0.05, 'about 4%: ' + rare / n);
});

test('a chick from the incubator takes after the hens in the coop; a rare one is news in the Breeds book', () => {
  const s = fresh();
  L.buyAnimal(s, 'chicken'); // brown
  s.animals.forEach((a) => { a.fed = 1; a.pet = 1; });
  L.addItem(s, 'egg', 1);
  assert.strictEqual(L.incubate(s, slotOf(s, 'egg')), 'ok');
  // day 1, 2: nothing; day 3: the chick. rnd: the hen (0.9: the brown one), her partner, not rare, like mother
  L.endDay(s, false, {});
  L.endDay(s, false, {});
  const r = withRandom(seq(0.9, 0.1, 0.5, 0.2), () => L.endDay(s, false, {}));
  assert.strictEqual(r.born.length, 1);
  const chick = s.animals[r.born[0]];
  assert.strictEqual(chick.kind, 'chicken');
  assert.ok(chick.young > 0);
  assert.strictEqual(L.breedOf(chick), B('chicken', 'brown'));
  // another, rare this time
  L.addItem(s, 'egg', 1);
  L.incubate(s, slotOf(s, 'egg'));
  L.endDay(s, false, {});
  L.endDay(s, false, {});
  const r2 = withRandom(seq(0, 0.5, 0.01, 0), () => L.endDay(s, false, {}));
  const gold = s.animals[r2.born[0]];
  assert.strictEqual(L.breedOf(gold), B('chicken', 'golden'));
  assert.strictEqual(gold.brNew, 1, 'a first find (for the morning report)');
  assert.ok(!Object.keys(gold).includes('brNew'), 'never saved');
  assert.strictEqual(L.breedFound(s, 'chicken', B('chicken', 'golden')), true);
});

test('the Miracle Potion: a calf for a cow, a piglet for a pig, a calf for a carabao, each after its mother; not for chickens', () => {
  const s = fresh();
  const pig = L.buyAnimal(s, 'pig'), cara = L.buyAnimal(s, 'carabao'), cow = L.buyAnimal(s, 'cow');
  L.buyAnimal(s, 'pig'); // a second pig: the father
  s.animals[pig].br = B('pig', 'ginger');
  [pig, cara, cow].forEach((i) => { s.animals[i].love = C.LOVE.potion; });
  L.addItem(s, 'miracle', 4);
  assert.strictEqual(L.givePotion(s, 0, slotOf(s, 'miracle')), 'notcow', 'a hen: chicks come from eggs');
  assert.strictEqual(L.givePotion(s, pig, slotOf(s, 'miracle')), 'ok');
  assert.strictEqual(L.givePotion(s, pig, slotOf(s, 'miracle')), 'already');
  assert.strictEqual(L.givePotion(s, cara, slotOf(s, 'miracle')), 'ok');
  assert.strictEqual(L.givePotion(s, cow, slotOf(s, 'miracle')), 'ok');
  assert.strictEqual(L.countItem(s, 'miracle'), 1);
  s.animals[cara].love = 0;
  const before = s.animals.length;
  let born = [];
  withRandom(seq(0.5, 0.2, 0.1), () => { for (let d = 0; d < C.PREGNANT_DAYS; d++) born = born.concat(L.endDay(s, false, {}).born); });
  assert.strictEqual(born.length, 3);
  const babies = born.map((i) => s.animals[i]);
  assert.deepStrictEqual(plain(babies.map((a) => a.kind)), ['pig', 'carabao', 'cow'], 'in the order of their mothers');
  assert.deepStrictEqual(plain(babies.map((a) => a.young)), [C.ANIMALS.pig.grow, C.ANIMALS.carabao.grow, C.ANIMALS.cow.grow].map((n) => n));
  assert.strictEqual(L.breedOf(babies[0]), B('pig', 'ginger'), 'like mother');
  assert.ok(C.ANIMALS.pig.names.some((n) => babies[0].name.startsWith(n)), 'a pig name: ' + babies[0].name);
  assert.strictEqual(s.animals.length, before + 3);
  // the barn has room for what is on the way
  const s2 = fresh();
  L.buyAnimal(s2, 'carabao');
  s2.builds.barn2 = 0;
  L.buyAnimal(s2, 'carabao');
  s2.animals[1].love = C.LOVE.potion;
  L.addItem(s2, 'miracle', 1);
  assert.strictEqual(L.givePotion(s2, 1, slotOf(s2, 'miracle')), 'full');
});

test('a rare animal gives two each morning it was fed; with a full bag the second waits in the pen', () => {
  const s = fresh();
  const hen = s.animals[0];
  hen.br = B('chicken', 'golden');
  hen.fed = 1;
  const r = L.endDay(s, false, {});
  assert.strictEqual(r.produced.egg, 2, 'the morning report counts both');
  assert.strictEqual(hen.bx, 1);
  const eggs = L.countItem(s, 'egg');
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(L.countItem(s, 'egg'), eggs + 2);
  assert.strictEqual(hen.ready, 0);
  assert.ok(!hen.bx);
  // not fed: nothing, not even the bonus
  L.endDay(s, false, {});
  assert.strictEqual(hen.ready, 0);
  assert.ok(!hen.bx);
  // a common hen gives one
  const s2 = fresh();
  s2.animals[0].fed = 1;
  assert.strictEqual(L.endDay(s2, false, {}).produced.egg, 1);
  assert.strictEqual(s2.animals[0].bx, undefined);
  // the bag has room for one egg only
  hen.fed = 1;
  L.endDay(s, false, {});
  s.inv = s.inv.map((x, i) => (i === 0 ? { id: 'egg', n: L.stackLimit('egg') - 1 } : { id: 'stone', n: 1 }));
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(hen.ready, 1, 'the bonus egg still waits');
  assert.strictEqual(L.collect(s, 0), '!full');
  s.inv[1] = null;
  assert.strictEqual(L.collect(s, 0), 'egg');
  assert.strictEqual(hen.ready, 0);
});

test('the Breeds book: find every colour of a kind, then claim its prize once', () => {
  const s = fresh();
  assert.strictEqual(L.claimBreedPrize(s, 'carabao'), 'notyet');
  L.buyAnimal(s, 'carabao');
  L.buyAnimal(s, 'carabao');
  assert.strictEqual(L.breedsFound(s, 'carabao'), 2);
  assert.strictEqual(L.claimBreedPrize(s, 'carabao'), 'notyet');
  assert.deepStrictEqual(plain(L.breedPrizesReady(s)), []);
  assert.strictEqual(L.markBreed(s, 'carabao', B('carabao', 'albino')), true);
  assert.strictEqual(L.markBreed(s, 'carabao', B('carabao', 'albino')), false, 'once');
  assert.strictEqual(L.breedsDone(s, 'carabao'), true);
  assert.deepStrictEqual(plain(L.breedPrizesReady(s)), ['carabao']);
  // a full bag: nothing yet
  const inv = s.inv;
  s.inv = s.inv.map(() => ({ id: 'stone', n: 999 }));
  assert.strictEqual(L.claimBreedPrize(s, 'carabao'), 'full');
  s.inv = inv;
  const gold = s.gold, pots = L.countItem(s, 'miracle');
  assert.strictEqual(L.claimBreedPrize(s, 'carabao'), 'ok');
  assert.strictEqual(s.gold, gold + C.BREEDING.prize.carabao.gold);
  assert.strictEqual(L.countItem(s, 'miracle'), pots + 1);
  assert.strictEqual(L.claimBreedPrize(s, 'carabao'), 'taken');
  assert.strictEqual(L.breedPrizeTaken(s, 'carabao'), true);
  assert.deepStrictEqual(plain(L.breedPrizesReady(s)), []);
  // found colours stay found when the animal is gone
  s.animals = s.animals.filter((a) => a.kind !== 'carabao');
  assert.strictEqual(roundTrip(s).brp, s.brp);
  assert.strictEqual(L.breedsFound(roundTrip(s), 'carabao'), 3);
});

test('breeds survive the save (with a waiting bonus); an old save is all first colours; bad data is cleaned', () => {
  const s = fresh();
  L.buyAnimal(s, 'chicken');
  L.buyAnimal(s, 'cow');
  L.buyAnimal(s, 'cow');
  s.animals[0].br = B('chicken', 'golden');
  s.animals[0].ready = 1;
  s.animals[0].bx = 1;
  L.markBreed(s, 'chicken', B('chicken', 'golden'));
  s.brp = 2;
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.animals.map((a) => L.breedOf(a))), plain(s.animals.map((a) => L.breedOf(a))));
  assert.strictEqual(back.animals[0].bx, 1);
  assert.deepStrictEqual(plain(back.brf), plain(s.brf).concat([0, 0, 0, 0]).slice(0, 4));
  assert.strictEqual(back.brp, 2);
  assert.deepStrictEqual(plain(back.animals), plain(s.animals));
  // an old save (no 'br'): every animal is its first colour, and what is in the pen is in the book
  const old = L.serialize(s);
  delete old.br;
  const o = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.ok(o.animals.length === 4 && o.animals.every((a) => L.breedOf(a) === 0 && !a.bx));
  assert.deepStrictEqual([L.breedsFound(o, 'chicken'), L.breedsFound(o, 'cow'), L.breedsFound(o, 'pig')], [1, 1, 0]);
  assert.strictEqual(o.brp, 0);
  // nonsense
  [{ br: 'x' }, { br: [null, null, null] }, { br: [['a', -5, 1e9, 99], [1e12, -1, 'z'], 1e9] }, { br: [[15, 15, 15, 15], [], -3] }].forEach((bad) => {
    const b = L.deserialize(Object.assign(JSON.parse(JSON.stringify(L.serialize(s))), bad));
    assert.ok(b, JSON.stringify(bad));
    b.animals.forEach((a) => { const k = L.breedOf(a); assert.ok(k >= 0 && k < C.BREEDS[a.kind].length); });
    assert.ok(b.brp >= 0 && b.brp < 16);
    b.brf.forEach((m, i) => assert.ok(m >= 0 && m < (1 << C.BREEDS[C.ANIMAL_KEYS[i]].length)));
  });
  // a save with more animals than the barn holds: the ones kept keep their own colours
  const s3 = fresh();
  s3.builds.barn2 = 0;
  L.buyAnimal(s3, 'pig');
  L.buyAnimal(s3, 'pig');
  s3.builds.barn2 = 1;
  L.buyAnimal(s3, 'pig');
  L.buyAnimal(s3, 'cow');
  s3.animals[2].br = 2;
  s3.animals[4].br = 3;
  const o3 = L.serialize(s3);
  o3.bd = o3.bd.map((v, i) => (C.BUILD_KEYS[i] === 'barn2' ? 0 : v));
  const b3 = L.deserialize(JSON.parse(JSON.stringify(o3)));
  assert.deepStrictEqual(plain(b3.animals.map((a) => a.kind + L.breedOf(a))), ['chicken0', 'pig0', 'pig2', 'cow3']);
});

test("friends see your colours on a visit (the snapshot's 4th field), checked like everything from another player", () => {
  const s = fresh();
  L.buyAnimal(s, 'pig');
  s.animals[1].br = B('pig', 'moon');
  const snap = plain(L.snapshot(s));
  assert.deepStrictEqual(snap.animals[0], ['chicken', 'Clucky', 0], 'the first colour adds nothing');
  assert.deepStrictEqual(snap.animals[1], ['pig', s.animals[1].name, 0, B('pig', 'moon')]);
  const v = L.visitState(snap, fresh());
  assert.deepStrictEqual(plain(v.animals.map((a) => L.breedOf(a))), [0, B('pig', 'moon')]);
  snap.animals[1][3] = 'constructor';
  snap.animals.push(['cow', 'Moo', 0, 99]);
  const v2 = L.visitState(snap, fresh());
  assert.deepStrictEqual(plain(v2.animals.map((a) => L.breedOf(a))), [0, 0, 0]);
});

test('painting a colour: only the coat changes (a red comb and an orange beak stay); every value stays a colour', () => {
  const brown = C.BREEDS.chicken[B('chicken', 'brown')].paint, black = C.BREEDS.pig[B('pig', 'black')].paint;
  assert.deepStrictEqual(plain(L.breedPixel(null, 250, 245, 235)), [250, 245, 235], 'no paint: as it is');
  assert.deepStrictEqual(plain(L.breedPixel(brown, 220, 40, 40)), [220, 40, 40], 'the comb');
  assert.deepStrictEqual(plain(L.breedPixel(brown, 240, 150, 30)), [240, 150, 30], 'the beak');
  assert.deepStrictEqual(plain(L.breedPixel(brown, 30, 20, 15)), [30, 20, 15], 'the outline');
  const white = L.breedPixel(brown, 250, 246, 238);
  assert.ok(white[0] > white[2] + 40 && white[0] < 240, 'a white feather turns brown: ' + white);
  const pink = L.breedPixel(black, 246, 170, 180);
  assert.ok(Math.max(...pink) < 140, 'pink skin turns dark: ' + pink);
  for (let i = 0; i < 3000; i++) {
    const c = [Math.random() * 256 | 0, Math.random() * 256 | 0, Math.random() * 256 | 0];
    C.ANIMAL_KEYS.forEach((k) => C.BREEDS[k].forEach((d) => L.breedPixel(d.paint, c[0], c[1], c[2]).forEach((v) => assert.ok(v >= 0 && v <= 255 && Number.isInteger(v)))));
  }
});

test('the save stays small: a full coop and barn of colours adds well under half a kilobyte', () => {
  const s = fresh();
  for (let i = 0; i < 7; i++) L.buyAnimal(s, 'chicken');
  ['cow', 'pig', 'carabao'].forEach((k) => { while (L.space(s, k) > 0) L.buyAnimal(s, k); });
  s.animals.forEach((a, i) => { a.br = i % C.BREEDS[a.kind].length; a.ready = 1; a.bx = 1; });
  const with_ = JSON.stringify(L.serialize(s)).length, o = L.serialize(s);
  delete o.br;
  assert.ok(with_ - JSON.stringify(o).length < 400, with_ - JSON.stringify(o).length + ' bytes');
});
