// e40 (owner, 8 Nov 2026): a birthday no longer wipes the farm's buildings (and the farms it wiped are repaired once,
// with a sorry letter: 10,000 gold, the lumber and stone), and animals give while the game is closed.
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
const chickens = (s) => s.animals.filter((a) => a.kind === 'chicken').length;
const hen = (name) => ({ kind: 'chicken', name, love: 0, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0 });

// A farm with everything the bug took: the Stable (and its horse), the Bigger Coop with 7 hens, the Bigger Barn, the
// Cat Basket (and its cat), and the music box in the house.
const builtFarm = () => {
  clock.set(2026, 11, 7, 9, 0);
  const s = L.newState();
  s.seed = 11;
  ['coop2', 'barn2', 'stable', 'f_cat', 'f_music', 'kitchen'].forEach((k) => { s.builds[k] = 1; });
  s.horse = { name: C.HORSE.name, love: 4, pet: 1 };
  s.cat = { name: C.CAT.name, love: 0, pet: 0 };
  s.home.items.push({ t: C.HOME.typeIndex.music_box, v: 0, x: 5, y: 2, f: 0 });
  s.animals = s.animals.filter((a) => a.kind !== 'chicken');
  for (let i = 0; i < 7; i++) s.animals.push(hen('Hen ' + i));
  return s;
};

test('a birthday no longer wipes the buildings: the Stable, the Bigger Coop and Barn and their animals stay, load after load', () => {
  const s = builtFarm();
  assert.strictEqual(L.setBirthday(s, 11, 16), 'ok');
  const o = save(s);
  assert.deepStrictEqual(o.bb, [1116, 0], 'the birthday has its own key');
  assert.strictEqual(o.bd.length, C.BUILD_KEYS.length, 'o.bd is still the builds list');
  let back = L.deserialize(o);
  back = roundTrip(back);
  ['coop2', 'barn2', 'stable', 'f_cat', 'f_music', 'kitchen'].forEach((k) => assert.strictEqual(back.builds[k], 1, k));
  assert.strictEqual(back.builds.bighouse, undefined, 'no big house it never built');
  assert.strictEqual(chickens(back), 7, 'no hen let go');
  assert.strictEqual(back.bd, 1116);
  assert.ok(back.horse && back.cat);
  assert.ok(!back.mail.includes('sorry_bd'), 'a farm the bug never touched gets no letter');
});

test('a farm the bug wiped (saved 29 Oct - 8 Nov 2026) is repaired once: buildings back, 180 lumber, 20 stone, the sorry letter with 10,000 gold', () => {
  const s = builtFarm();
  L.setBirthday(s, 11, 16);
  s.bdy = 2026;
  s.lumber = 10; s.stone = 5; s.gold = 300;
  // what the old code wrote: the birthday over the builds list, and the extra hens already let go
  const o = save(s);
  delete o.bb;
  o.bd = [1116, 2026];
  o.a = o.a.filter((x, i) => !(x[0] === 0 && i > 3 + o.a.findIndex((y) => y[0] === 0)));
  const r = L.deserialize(o);
  ['coop2', 'barn2', 'stable', 'kitchen', 'bighouse', 'f_cat', 'f_music'].forEach((k) => assert.strictEqual(r.builds[k], 1, k + ' back'));
  assert.strictEqual(r.builds.f_plant, undefined, 'no Big Plant it never had');
  assert.strictEqual(r.builds.f_aquarium, undefined, 'no Aquarium it never had');
  assert.strictEqual(r.bd, 1116, 'the birthday is kept');
  assert.strictEqual(r.bdy, 2026);
  assert.strictEqual(r.lumber, 10 + 180);
  assert.strictEqual(r.stone, 5 + 20);
  assert.strictEqual(r.mail[0], 'sorry_bd', 'the letter is the first in the mailbox');
  assert.match(L.letter('sorry_bd').text, /sorry/i);
  // the letter pays the 10,000 gold when it is read
  const read = L.readMail(r);
  assert.strictEqual(read.key, 'sorry_bd');
  assert.strictEqual(r.gold, 300 + 10000);
  // room for 8 hens again: buy one
  assert.ok(L.capacity(r, 'chicken') >= 8);
  // saved and loaded again: no second repair, no second letter
  const again = roundTrip(r);
  assert.strictEqual(again.lumber, 190);
  assert.ok(!again.mail.includes('sorry_bd'));
  assert.strictEqual(again.builds.stable, 1);
  assert.strictEqual(again.bd, 1116);
});

test('a wiped farm without a horse gets no Stable, but still the Bigger Coop and Barn and the gift', () => {
  const s = builtFarm();
  s.horse = null; s.cat = null;
  s.home.items = s.home.items.filter((it) => it.t !== C.HOME.typeIndex.music_box);
  L.setBirthday(s, 3, 4);
  const o = save(s);
  delete o.bb;
  o.bd = [304, 0];
  const r = L.deserialize(o);
  assert.strictEqual(r.builds.stable, undefined);
  assert.strictEqual(r.builds.f_cat, undefined);
  assert.strictEqual(r.builds.f_music, undefined);
  assert.strictEqual(r.builds.coop2, 1);
  assert.strictEqual(r.builds.barn2, 1);
  assert.strictEqual(r.builds.kitchen, 1, 'the kitchen it has now stays');
  assert.strictEqual(r.builds.bighouse, undefined);
  assert.strictEqual(r.mail[0], 'sorry_bd');
});

test('animals give while the game is closed: fed, saved, reopened 4 hours later the egg is there (and 6 for milk)', () => {
  clock.set(2026, 11, 8, 9, 0);
  const s = L.newState();
  s.gold = 1e6;
  L.buyAnimal(s, 'cow');
  L.addItem(s, 'fodder', 3);
  L.addItem(s, 'chicken_feed', 3);
  const h = s.animals.findIndex((a) => a.kind === 'chicken'), c = s.animals.findIndex((a) => a.kind === 'cow');
  s.animals[h].young = 0;
  const slot = (id) => s.inv.findIndex((x) => x && x.id === id);
  assert.strictEqual(L.feedAnimal(s, h, slot('chicken_feed')), 'ok');
  assert.strictEqual(L.feedAnimal(s, c, slot('fodder')), 'ok');
  clock.advance(30);
  const o = save(s); // the game closes half an hour after feeding
  clock.advance(4 * 60); // 1:30 PM
  let r = L.deserialize(o);
  L.catchUp(r, clock.ms);
  assert.strictEqual(r.animals[h].ready, 1, 'the egg came while the game was closed');
  assert.strictEqual(r.animals[c].ready, 0, 'the milk not yet');
  assert.strictEqual(L.animalLeft(r.animals[c]), 90, 'an hour and a half to the milk (3 PM)');
  clock.advance(90);
  r = L.deserialize(o);
  L.catchUp(r, clock.ms);
  assert.strictEqual(r.animals[c].ready, 1, 'the milk 6 hours after feeding');
});

test('an older save (no o.am) counts the time away from its day and time of day', () => {
  clock.set(2026, 11, 8, 9, 0);
  const s = L.newState();
  L.addItem(s, 'chicken_feed', 1);
  const h = s.animals.findIndex((a) => a.kind === 'chicken');
  s.animals[h].young = 0;
  L.feedAnimal(s, h, s.inv.findIndex((x) => x && x.id === 'chicken_feed'));
  L.catchUp(s, clock.ms); // (the time of day follows the clock every second in the game)
  const o = save(s);
  delete o.am;
  clock.advance(5 * 60);
  const r = L.deserialize(o);
  L.catchUp(r, clock.ms);
  assert.strictEqual(r.animals[h].ready, 1);
  // a clock set back never makes time
  clock.set(2026, 11, 8, 8, 0);
  const back = L.deserialize(save(s));
  assert.ok(L.animalLeft(back.animals[h]) <= 4 * 60);
});

test('the shop and the hints say every 4 hours for a chicken, 6 for a cow, pig and carabao', () => {
  assert.deepStrictEqual(plain(C.ANIMAL_HOURS), { chicken: 4, cow: 6, pig: 6, carabao: 6 });
  assert.match(C.ANIMALS.chicken.shop, /every 4 hours/);
  assert.match(C.ANIMALS.cow.shop, /every 6 hours/);
});
