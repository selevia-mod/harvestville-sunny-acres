// Unit tests for the horse going out (farm economy v2, part 5: src/00-zzzzzzzzzzzzzzzzzzz-horse.js,
// src/01-logicZZZZZZZZZZZZZZ-horse.js; docs/farm-economy-v2.md section 6): the bond opens places, the Stable's gear,
// stamina and food, the knock-off in caves, and old saves.
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
const H = C.HORSE_OUT;

const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 11, 11, 10, 0); const s = L.newState(); s.seed = 11; s.gold = 1e6; s.builds.stable = 1; s.horse = { name: 'Chestnut', love: 0, pet: 0 }; L.takeNotes(); return s; };
const hearts = (s, n) => { s.horse.love = n * H.loveHeart; return s; };
const give = (s, id, n = 1) => { L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id); };
const gear = (s, ...ids) => { ids.forEach((id) => { s.horse.g = (s.horse.g || 0) | (1 << H.gearOrder.indexOf(id)); }); return s; };

test('each map is a kind of place for the horse', () => {
  assert.strictEqual(L.horseZone('farm'), 'farm');
  assert.strictEqual(L.horseZone('town'), 'town');
  assert.strictEqual(L.horseZone('park'), 'town');
  ['pulag', 'makiling', 'magayon'].forEach((m) => assert.strictEqual(L.horseZone(m), 'wild', m));
  ['banaue', 'bohol', 'taal', 'sierra', 'palawan'].forEach((m) => assert.strictEqual(L.horseZone(m), 'hunt', m));
  ['banaue_cave', 'bohol_cave', 'taal_crater', 'sierra_cave', 'palawan_cave', 'lair'].forEach((m) => assert.strictEqual(L.horseZone(m), 'cave', m));
  ['house', 'mine', 'hall', 'nowhere'].forEach((m) => assert.strictEqual(L.horseZone(m), null, m));
  assert.ok(!L.horseOut('farm') && !L.horseOut('town') && L.horseOut('pulag') && L.horseOut('banaue') && L.horseOut('lair'));
});

test('bond opens places: town 3 hearts, the Wild Lands 6, hunting places 8, caves 10 (the owner\'s numbers)', () => {
  assert.deepStrictEqual(plainHearts(), { farm: 0, town: 3, wild: 6, hunt: 8, cave: 10 });
  const s = gear(fresh(), 'horseshoes', 'lantern_bridle');
  const ok = (m) => !!L.horseMayGo(s, m).ok;
  hearts(s, 0);
  assert.ok(ok('farm'), 'the farm: always');
  assert.ok(!ok('town'));
  assert.deepStrictEqual(pick(L.horseMayGo(s, 'town')), { why: 'hearts', need: 3, zone: 'town' });
  hearts(s, 3);
  assert.ok(ok('town') && ok('park') && !ok('pulag'));
  hearts(s, 6);
  assert.ok(ok('pulag') && ok('magayon') && !ok('banaue'));
  hearts(s, 8);
  assert.ok(ok('banaue') && ok('palawan') && !ok('banaue_cave') && !ok('lair'));
  hearts(s, 10);
  assert.ok(ok('banaue_cave') && ok('lair'));
  assert.ok(!ok('house') && !ok('mine'), 'never indoors or down the mine');
  assert.strictEqual(L.horseHearts(hearts(s, 12)), 10, 'at most 10 hearts');
  assert.strictEqual(L.horseMayGo({ horse: null }, 'farm').why, 'none');
});
function plainHearts() { return JSON.parse(JSON.stringify(H.hearts)); }
function pick(r) { return { why: r.why, need: r.need, zone: r.zone }; }

test('Horseshoes outside the farm and town; the Lantern Bridle in caves too', () => {
  const s = hearts(fresh(), 10);
  assert.ok(L.horseMayGo(s, 'town').ok, 'town needs no gear');
  assert.strictEqual(L.horseMayGo(s, 'pulag').why, 'shoes');
  assert.strictEqual(L.horseMayGo(s, 'banaue').why, 'shoes');
  assert.strictEqual(L.horseMayGo(s, 'lair').why, 'shoes');
  gear(s, 'horseshoes');
  assert.ok(L.horseMayGo(s, 'pulag').ok && L.horseMayGo(s, 'banaue').ok);
  assert.strictEqual(L.horseMayGo(s, 'banaue_cave').why, 'lantern');
  gear(s, 'lantern_bridle');
  assert.ok(L.horseMayGo(s, 'banaue_cave').ok);
  // hearts are asked first: a horse without the bond hears about hearts, not shoes
  hearts(s, 5);
  s.horse.g = 0;
  assert.strictEqual(L.horseMayGo(s, 'pulag').why, 'hearts');
  assert.match(L.horseWhy(s, L.horseMayGo(s, 'pulag')), /Chestnut needs 6 hearts for the Wild Lands \(it has 5\)/);
  hearts(s, 6);
  assert.match(L.horseWhy(s, L.horseMayGo(s, 'pulag')), /needs Horseshoes for the Wild Lands\. Make them at the Stable/);
});

test('the Stable makes Horseshoes and the Lantern Bridle; Saddlebags wait for the Mixer\'s Rope', () => {
  const s = fresh();
  s.gold = 100;
  assert.strictEqual(L.horseMake(s, 'horseshoes'), 'gold');
  s.gold = 5000;
  assert.strictEqual(L.horseMake(s, 'horseshoes'), 'needs');
  give(s, 'ore_copper', 7);
  give(s, 'leather_soft', 1);
  assert.strictEqual(L.horseMake(s, 'horseshoes'), 'ok');
  assert.strictEqual(s.gold, 5000 - H.gear.horseshoes.gold);
  assert.strictEqual(L.countItem(s, 'ore_copper'), 2);
  assert.strictEqual(L.countItem(s, 'leather_soft'), 0);
  assert.ok(L.horseHas(s, 'horseshoes'));
  assert.strictEqual(L.horseMake(s, 'horseshoes'), 'have', 'once');
  give(s, 'crystal', 1);
  assert.strictEqual(L.horseMake(s, 'lantern_bridle'), 'ok');
  assert.ok(L.horseHas(s, 'lantern_bridle'));
  // Saddlebags: on the list, not made yet (part 3 deletes `soon`)
  give(s, 'leather_soft', 5);
  assert.strictEqual(L.horseMake(s, 'saddlebags'), 'soon');
  assert.match(H.gear.saddlebags.soon, /Needs Rope from the Mixer, coming soon/);
  assert.strictEqual(L.horseBagExtra(s), 0);
  gear(s, 'saddlebags');
  assert.strictEqual(L.horseBagExtra(s), 12, 'the hook part 3 uses: bag +12');
  assert.strictEqual(L.horseMake(s, 'nothing'), 'none');
  assert.strictEqual(L.horseMake({ horse: null }, 'horseshoes'), 'none');
});

test('the gear icons are appended to the sheet (icon numbers are saved)', () => {
  H.gearOrder.forEach((id) => {
    assert.strictEqual(C.ICON[id], C.ICON_ORDER.indexOf(id));
    assert.strictEqual(H.gear[id].icon, C.ICON[id]);
    assert.ok(C.ICON[id] > C.ICON_ORDER.indexOf('seed_bitter_gourd'), id + ' after part 1\'s icons');
  });
  const size = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
  const h = size(fs.readFileSync(path.join(__dirname, '..', 'assets', 'items.png')))[1];
  H.gearOrder.forEach((id) => assert.ok((Math.floor(C.ICON[id] / 8) + 1) * 144 <= h, id + ' is on the items sheet'));
});

test('stamina drains a tile at a time out there, never on the farm or in town; at 0 it is tired', () => {
  const s = fresh();
  assert.strictEqual(L.horseStamina(s), H.stamina, 'full to start');
  L.horseRide(s, 'farm', 50);
  L.horseRide(s, 'town', 50);
  assert.strictEqual(L.horseStamina(s), H.stamina);
  L.horseRide(s, 'pulag', 10);
  assert.strictEqual(L.horseStamina(s), H.stamina - 10 * H.drain);
  L.horseRide(s, 'pulag', 0.5);
  assert.strictEqual(L.horseStamina(s), H.stamina - 10.5 * H.drain, 'part of a tile counts');
  assert.strictEqual(L.horseRide(s, 'banaue_cave', 1000), 'tired', 'the moment it runs out');
  assert.strictEqual(L.horseStamina(s), 0);
  assert.ok(L.horseTired(s));
  assert.strictEqual(L.horseRide(s, 'pulag', 5), 'ok', 'only said once');
  gear(hearts(s, 10), 'horseshoes');
  assert.strictEqual(L.horseCanRide(s, 'pulag').why, 'tired');
  assert.ok(L.horseMayGo(s, 'pulag').ok, 'a tired horse still walks with you');
  assert.match(L.horseWhy(s, L.horseCanRide(s, 'pulag')), /too tired to carry you\. Feed it oats, an apple or a carrot/);
});

test('oats, apples and carrots feed it; the first feed of a day is a little love; other food is not for it', () => {
  const s = fresh();
  s.horse.st = 0;
  let i = give(s, 'oats', 2);
  assert.strictEqual(L.horseFeed(s, i), 'ok');
  assert.strictEqual(L.horseStamina(s), H.food.oats);
  assert.strictEqual(s.horse.love, H.feedLove, 'love once a day');
  assert.strictEqual(L.countItem(s, 'oats'), 1);
  i = give(s, 'apple', 1);
  assert.strictEqual(L.horseFeed(s, i), 'ok');
  assert.strictEqual(L.horseStamina(s), H.food.oats + H.food.apple);
  assert.strictEqual(s.horse.love, H.feedLove, 'not twice the same day');
  i = give(s, 'carrot', 1);
  assert.strictEqual(L.horseFeed(s, i), 'ok');
  assert.strictEqual(L.horseStamina(s), H.food.oats + H.food.apple + H.food.carrot);
  i = give(s, 'turnip', 1);
  assert.strictEqual(L.horseFeed(s, i), 'food');
  s.horse.st = H.stamina - 5;
  i = s.inv.findIndex((x) => x && x.id === 'oats');
  assert.strictEqual(L.horseFeed(s, i), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina, 'never past full');
  i = give(s, 'oats', 1);
  assert.strictEqual(L.horseFeed(s, i), 'full');
  assert.strictEqual(L.countItem(s, 'oats'), 1, 'a full horse eats nothing');
  assert.ok(!L.horseTired(s));
});

test('a new day: it is rested (full stamina)', () => {
  const s = fresh();
  s.horse.st = 3;
  L.endDay(s, false, null);
  assert.strictEqual(L.horseStamina(s), H.stamina);
});

test('in a cave a big monster\'s hit can knock you off; nowhere else, and not a small one', () => {
  const big = { hit: 20 }, boss = { hit: 8, boss: true }, small = { hit: 11 };
  assert.ok(L.horseKnocks('banaue_cave', big, 0));
  assert.ok(L.horseKnocks('lair', boss, 0));
  assert.ok(!L.horseKnocks('banaue_cave', small, 0), 'a small one');
  assert.ok(!L.horseKnocks('banaue_cave', big, H.knockOdds), 'only on the roll');
  assert.ok(!L.horseKnocks('banaue', big, 0), 'not in a hunting place');
  assert.ok(!L.horseKnocks('pulag', boss, 0), 'not in the Wild Lands');
  assert.ok(!L.horseKnocks('banaue_cave', null, 0));
});

test('the save keeps gear, stamina and the fed day; an old save keeps riding in town (3 hearts once)', () => {
  const s = gear(hearts(fresh(), 7), 'horseshoes');
  s.horse.st = 42.25;
  s.horse.fd = s.day;
  const back = roundTrip(s);
  assert.strictEqual(back.horse.love, 70);
  assert.ok(L.horseHas(back, 'horseshoes') && !L.horseHas(back, 'lantern_bridle'));
  assert.strictEqual(back.horse.st, 42.3);
  assert.strictEqual(back.horse.fd, s.day);
  // a save from before: hs = [love, pet]
  const o = JSON.parse(JSON.stringify(L.serialize(hearts(fresh(), 1))));
  o.hs = [10, 1];
  const old = L.deserialize(o);
  assert.strictEqual(old.horse.love, H.oldHearts * H.loveHeart, 'up to 3 hearts');
  assert.strictEqual(old.horse.pet, 1);
  assert.strictEqual(L.horseStamina(old), H.stamina);
  assert.ok(L.horseMayGo(old, 'town').ok, 'it still rides in town');
  o.hs = [85, 0];
  assert.strictEqual(L.deserialize(o).horse.love, 85, 'more is kept');
  // after that save, the bump never happens again (a horse that lost love keeps what it has)
  const again = L.deserialize(JSON.parse(JSON.stringify(L.serialize(hearts(old, 1)))));
  assert.strictEqual(again.horse.love, 10);
  // no horse: as before
  const none = fresh();
  none.horse = null;
  assert.strictEqual(roundTrip(none).horse, null);
  // nonsense in the save
  const bad = JSON.parse(JSON.stringify(L.serialize(fresh())));
  bad.hs = [50, 0, 'x', 'y', -4];
  const b = L.deserialize(bad);
  assert.strictEqual(b.horse.g, 0);
  assert.strictEqual(b.horse.st, H.stamina);
  assert.strictEqual(b.horse.fd, 0);
  bad.hs = [50, 0, 99, 1e9, 3];
  assert.strictEqual(L.deserialize(bad).horse.g, 7);
  assert.strictEqual(L.deserialize(bad).horse.st, H.stamina);
});

test('the numbers are in one block (C.HORSE_OUT)', () => {
  ['stamina', 'drain', 'feedLove', 'shotGap', 'knockHit', 'knockOdds', 'loveHeart', 'oldHearts'].forEach((k) => assert.strictEqual(typeof H[k], 'number', k));
  assert.deepStrictEqual(Object.keys(H.food).sort(), ['apple', 'carrot', 'oats']);
  Object.keys(H.food).forEach((id) => assert.ok(C.ITEMS[id], id + ' is an item'));
  Object.values(H.gear).forEach((g) => g.needs.forEach((n) => assert.ok(C.ITEMS[n[0]] || n[0] === 'rope', n[0])));
});
