// Unit tests for farm economy v2, part 4 (docs/farm-economy-v2.md section 5; src/00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js,
// src/01-logicZZZZZZZZZZZZZZZZZ-economy2.js): crop potions brewed in the Kitchen (the owner's four, their effects, 10-minute
// clocks beside a dish's power), and a shot's energy in the five new hunting places (3-4; 2 in the Wild Lands).
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const give = (s, id, n = 1) => { L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id); };

test("the owner's four potions, brewed in the Kitchen from farm crops (the Silo counts)", () => {
  const want = {
    ginger_tonic: ['ginger', 'wild_honey'],
    ampalaya_brew: ['bitter_gourd', 'bitter_gourd', 'ginger'],
    pineapple_juice: ['pineapple', 'pineapple'],
    hunters_coffee: ['coffee', 'coffee', 'sugarcane'],
  };
  Object.keys(want).forEach((id) => {
    const r = C.RECIPES.find((x) => x.dish === id);
    assert.deepStrictEqual(plain(r.needs), want[id], id);
    assert.ok(C.ITEMS[id].icon === C.ICON_ORDER.indexOf(id) && C.ITEMS[id].sell > 0, id);
  });
  assert.strictEqual(C.ITEMS.ginger_tonic.energy, 50, '+50 energy');
  assert.deepStrictEqual(plain(C.POTIONS), {
    ampalaya_brew: { key: 'charge', text: 'a charge hurts half' },
    pineapple_juice: { key: 'walk', text: 'you walk 20% faster' },
    hunters_coffee: { key: 'shots', text: 'shots cost no energy' },
  });
  assert.strictEqual(C.POTION_MINS, 10);
  const s = L.newState();
  s.builds.kitchen = 1;
  L.siloPut(s, 'pineapple', 1);
  L.addItem(s, 'pineapple', 1);
  const r = C.RECIPES.find((x) => x.dish === 'pineapple_juice');
  assert.strictEqual(L.cook(s, r), 'ok');
  assert.deepStrictEqual([L.siloHas(s, 'pineapple'), L.countItem(s, 'pineapple'), L.countItem(s, 'pineapple_juice')], [0, 0, 1]);
  assert.strictEqual(L.cook(s, r), 'missing');
});

test('a potion works for 10 minutes on its own clock, beside a dish; the effects: a charge hurts half, walking 20% faster, free shots', () => {
  const s = L.newState();
  s.energy = 10;
  // the dish's power stays on beside it
  s.dp = { id: 'bistek', until: L.nowMin() + 10 };
  assert.ok(L.power(s, 'walk'));
  s.dp = null;
  assert.strictEqual(L.chargeLoss(s, 10), 10);
  const e0 = s.energy, gain = L.eat(s, give(s, 'ampalaya_brew'));
  assert.strictEqual(gain, C.ITEMS.ampalaya_brew.energy);
  assert.strictEqual(s.energy, e0 + gain);
  assert.strictEqual(L.potionLeft(s, 'charge'), 10);
  assert.ok(L.power(s, 'charge'));
  assert.strictEqual(L.chargeLoss(s, 10), 5, 'a charge hurts half');
  assert.strictEqual(L.countItem(s, 'ampalaya_brew'), 0, 'drunk');
  // another at once: each its own clock; a dish's power too
  L.eat(s, give(s, 'pineapple_juice'));
  s.dp = { id: 'kaldereta', until: L.nowMin() + 10 };
  assert.ok(L.power(s, 'walk') && L.power(s, 'charge') && L.power(s, 'mine'));
  // full energy: drunk for its power alone
  s.energy = L.maxEnergy(s);
  assert.strictEqual(L.eat(s, give(s, 'hunters_coffee')), -2);
  assert.ok(L.power(s, 'shots'));
  assert.strictEqual(L.countItem(s, 'hunters_coffee'), 0);
  // saved, and over after 10 minutes
  clock.advance(4);
  const back = roundTrip(s);
  assert.strictEqual(L.potionLeft(back, 'walk'), 6);
  clock.advance(6);
  assert.ok(!L.power(back, 'walk') && !L.power(back, 'charge') && !L.power(back, 'shots'));
  assert.strictEqual(L.serialize(back).ptn, undefined, 'nothing to save once over');
  // the Ginger Tonic is food: +50 energy, no clock
  const t = L.newState();
  t.energy = 10;
  assert.strictEqual(L.eat(t, give(t, 'ginger_tonic')), 50);
  assert.deepStrictEqual(plain(t.ptn), {});
  // an older save: no clocks; nonsense cut to size
  const o = plain(L.serialize(L.newState()));
  o.ptn = ['x', -5, 1e20];
  assert.deepStrictEqual(plain(L.deserialize(o).ptn), { shots: 1e10 });
});

test('a shot: 3-4 energy in the five new hunting places and their caves, 2 in the Wild Lands; with Hunter\'s Coffee nothing', () => {
  assert.deepStrictEqual(plain(C.SHOT_ENERGY), { banaue: 3, bohol: 3, taal: 3, sierra: 4, palawan: 4 });
  const s = L.newState();
  s.energy = 100;
  s.tools.bow = 1;
  L.addItem(s, 'arrows', 50);
  const cost = (map) => { s.map = map; const e = s.energy; assert.strictEqual(L.shoot(s), 'ok', map); return e - s.energy; };
  assert.deepStrictEqual(['pulag', 'makiling', 'magayon', 'lair', 'farm'].map(cost), [2, 2, 2, 2, 2], 'the Wild Lands as before');
  assert.deepStrictEqual(['banaue', 'bohol', 'taal', 'sierra', 'palawan'].map(cost), [3, 3, 3, 4, 4]);
  assert.deepStrictEqual(['banaue_cave', 'sierra_cave', 'palawan_cave'].map(cost), [3, 4, 4], 'a cave costs what its place does');
  assert.strictEqual(C.WILD.shotEnergy, 2, 'the Bow\'s own number is left as it was');
  // too tired for the dearer shot
  s.map = 'sierra'; s.energy = 3;
  assert.strictEqual(L.shoot(s), 'tired');
  // Hunter's Coffee: free
  s.energy = 0;
  s.ptn = { shots: L.nowMin() + 10 };
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(s.energy, 0);
  // the weapons too
  const w = L.newState();
  w.gold = 1e7; w.lumber = 100; w.energy = 100; w.map = 'palawan';
  L.addItem(w, 'rope', 5);
  assert.strictEqual(L.getWeapon(w, 'javelin'), 'ok');
  L.buyAmmo(w, 'javelins', 1);
  assert.strictEqual(L.fireWeapon(w, 'javelin'), 'ok');
  assert.strictEqual(w.energy, 96);
  w.ptn = { shots: L.nowMin() + 10 };
  assert.strictEqual(L.fireWeapon(w, 'javelin'), 'ok');
  assert.strictEqual(w.energy, 96);
  assert.strictEqual(C.WEAPON_ENERGY, 2);
});
