'use strict';
// Gear stars (owner, 7 Nov 2026): src/01-logicZZZZZZ-gear-stars.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 11, 7, 10, 0); const s = L.newState(); s.seed = 7; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const A = C.WILD.animals;
const giveAll = (s, needs) => needs.forEach(([id, n]) => L.addItem(s, id, n));
const makeSet = (s, place) => C.GEAR_SLOTS.forEach((slot) => { const g = C.PLACE_GEAR[place + '_' + slot]; s.gold += g.gold; giveAll(s, g.needs); assert.strictEqual(L.makeGear(s, g.id), 'ok'); });

test('stars: each needs the place\'s boss and guard parts and Gold, up to 3, only on a piece you own', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(L.starParts('taal')), { boss: 'pearl_berberoka', guard: 'scale_lava' });
  assert.deepStrictEqual(plain(L.starParts('banaue')), { boss: 'fur_amomongo', guard: 'staff_kibaan' });
  assert.deepStrictEqual(plain(L.starCost('taal_body', 1)), { gold: 3500, needs: [['pearl_berberoka', 1], ['scale_lava', 1]] });
  assert.deepStrictEqual(plain(L.starCost('taal_body', 3)), { gold: 14000, needs: [['pearl_berberoka', 3], ['scale_lava', 3]] });
  assert.strictEqual(L.starCost('taal_body', 4), null);
  assert.strictEqual(L.starGear(s, 'taal_body'), 'notyours');
  assert.strictEqual(L.starGear(s, 'nope'), 'none');
  makeSet(s, 'taal');
  s.gold = 0;
  assert.strictEqual(L.starGear(s, 'taal_body'), 'gold');
  s.gold = 100000;
  assert.strictEqual(L.starGear(s, 'taal_body'), 'short', 'the parts first');
  giveAll(s, [['pearl_berberoka', 6], ['scale_lava', 6]]);
  [1, 2, 3].forEach((k) => { assert.strictEqual(L.starGear(s, 'taal_body'), 'ok'); assert.strictEqual(L.gearStars(s, 'taal_body'), k); });
  assert.strictEqual(L.starGear(s, 'taal_body'), 'max');
  assert.strictEqual(s.gold, 100000 - 3500 - 7000 - 14000);
  assert.strictEqual(L.countItem(s, 'pearl_berberoka'), 0);
  assert.strictEqual(L.pieceName(s, 'taal_body'), 'Lakeguard Vest ★★★');
  assert.strictEqual(L.pieceLess(s, 'taal_body'), 5, '2 of its own and 3 stars');
});

test('stars: 1 more off a charge each, only in the piece\'s own place, never under a third of the hit; kept in the save', () => {
  const s = fresh();
  makeSet(s, 'sierra');
  const kapre = A.kapre.hit, carabao = A.carabaoligaw.hit;
  assert.strictEqual(L.chargeLoss(s, kapre, 'kapre'), kapre - 8, 'the set: 1 + 2 + 1 + 2 + 2');
  s.gold = 1e6;
  giveAll(s, [['bark_kapre', 24], ['ribbon_queen', 24]]);
  assert.strictEqual(L.starGear(s, 'sierra_head'), 'ok');
  assert.strictEqual(L.starGear(s, 'sierra_body'), 'ok');
  assert.strictEqual(L.chargeLoss(s, kapre, 'kapre'), kapre - 10, 'two stars: 2 more');
  assert.strictEqual(L.chargeLoss(s, carabao, 'carabaoligaw'), carabao - 10);
  assert.strictEqual(L.chargeLoss(s, A.boar.hit, 'boar'), A.boar.hit, 'not in Makiling');
  C.GEAR_SLOTS.forEach((slot) => { while (L.starGear(s, 'sierra_' + slot) === 'ok'); });
  assert.deepStrictEqual(plain(C.GEAR_SLOTS.map((slot) => L.gearStars(s, 'sierra_' + slot))), [3, 3, 3, 3]);
  assert.strictEqual(L.chargeLoss(s, kapre, 'kapre'), Math.ceil(kapre / 3), 'all stars: down to the floor, a third of the hit');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(C.GEAR_SLOTS.map((slot) => L.gearStars(back, 'sierra_' + slot))), [3, 3, 3, 3], 'saved');
  assert.strictEqual(L.chargeLoss(back, kapre, 'kapre'), Math.ceil(kapre / 3));
  // a save with stars on pieces it does not own, or bad numbers: dropped
  const o = plain(L.serialize(fresh()));
  o.gs = [['sierra_head', 3], ['taal_body', 2], ['nope', 1], ['sierra_body', 99], 'x'];
  o.go = ['sierra_head', 'sierra_body'];
  const got = L.deserialize(o);
  assert.deepStrictEqual(plain(got.gstar), { sierra_head: 3, sierra_body: 3 });
  assert.strictEqual(L.serialize(fresh()).gs, undefined, 'a new farm saves no stars');
  assert.ok(C.TIPS.some((t) => t.key === 'gear_stars_tour') && C.TIPS[C.TIPS.length - 1].key === 'gear_stars_tour', 'its tour tip comes last');
});
