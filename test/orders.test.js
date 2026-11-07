// Unit tests for what the Market Stall's orders ask for (a player, 7 Nov 2026: "they keep asking for carabao milk even
// though I don't have that"): only what this farm can get now, a fair amount of it, a mix across the board, and an
// older unfair order swapped for a fresh one when the stall opens.
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

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const FARM = L.farmInfo(MAP);
const ix = C.OUTDOOR.index;
const animal = (kind, more) => Object.assign({ kind, name: kind, love: 10, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0 }, more || {});
// A farm well into the game (orders ask for 2-3 things). Clucky the hen comes with every new farm.
const fresh = (seed) => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = seed; s.stats.earned = 30000; return s; };
// Every item the board asks for over many new orders: the three slots refilled again and again.
const asked = (s, rounds = 60) => {
  const out = [];
  for (let k = 0; k < rounds; k++) {
    L.standTick(s, 300);
    s.orders.forEach((o, i) => { if (o.items) { out.push(...o.items); L.skipOrder(s, i); } });
  }
  return out;
};
const ids = (list) => new Set(list.map((it) => it[0]));

test('no carabao: never Carabao Milk (nor Kesong Puti), on any farm, in any order', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = fresh(seed);
    L.addItem(s, 'milker', 1);
    s.animals.push(animal('cow'));
    const got = ids(asked(s, 20));
    assert.ok(!got.has('carabao_milk'), 'seed ' + seed + ': carabao milk asked of a farm with no carabao');
  }
  const s = fresh(5);
  s.gold = 1e6;
  s.yard.items = []; // (the field's fence: land.test.js)
  L.buyYard(s, ix.dairy, 1);
  L.placeYard(s, FARM, ix.dairy, 25, 14);
  L.discover(s, 'kesong_puti');
  L.discover(s, 'cheese');
  L.addItem(s, 'milker', 1);
  s.animals.push(animal('cow'));
  const pool = L.orderCandidates(s);
  assert.ok(!pool.includes('kesong_puti'), 'no carabao milk to make it from');
  assert.ok(pool.includes('cheese'), 'a cow gives the milk for cheese');
  assert.ok(!L.requestPool(s).some((e) => e[0] === 'kesong_puti'), 'villagers\' requests too');
});

test('with a grown carabao and a milker: Carabao Milk can be asked, a day\'s worth at most (2 a day each)', () => {
  const s = fresh(3);
  s.animals.push(animal('carabao'));
  assert.ok(!L.orderCandidates(s).includes('carabao_milk'), 'no milker: it can\'t be milked (L.collect says !milker)');
  L.addItem(s, 'milker', 1);
  assert.ok(L.orderCandidates(s).includes('carabao_milk'));
  assert.strictEqual(L.orderCap(s, 'carabao_milk'), 24 / C.ANIMAL_HOURS.carabao);
  const milk = asked(s).filter((it) => it[0] === 'carabao_milk');
  assert.ok(milk.length > 0, 'it comes up');
  milk.forEach((it) => assert.ok(it[1] >= 1 && it[1] <= 2, 'one carabao: at most 2, asked ' + it[1]));
  s.animals.push(animal('carabao'));
  assert.strictEqual(L.orderCap(s, 'carabao_milk'), 4, 'two carabaos: 4');
  // a calf gives nothing yet; a happy one gives its large kind (a cow's Large Milk, not Milk)
  const t = fresh(3);
  L.addItem(t, 'milker', 1);
  t.animals.push(animal('carabao', { young: 2 }), animal('cow', { love: C.LOVE.large }));
  const pool = L.orderCandidates(t);
  assert.ok(!pool.includes('carabao_milk') && !pool.includes('milk') && pool.includes('milk_l'), JSON.stringify(pool));
});

test('fish only with a fishing rod (in the bag or the cabinet)', () => {
  const s = fresh(7);
  const fish = (list) => list.some((it) => C.ITEMS[it[0]].kind === 'fish');
  assert.ok(!fish(asked(s)), 'no rod: no fish');
  s.store = [{ id: 'rod', n: 1 }];
  assert.ok(L.orderCandidates(s).includes('fish_s'), 'a rod put away still fishes');
  assert.ok(fish(asked(s)), 'with a rod, fish come up');
});

test('variety: no item on two of the three orders at once while there is anything else to ask for', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = fresh(seed);
    for (let k = 0; k < 15; k++) {
      L.standTick(s, 300);
      const all = [].concat(...s.orders.filter((o) => o.items).map((o) => o.items.map((it) => it[0])));
      assert.strictEqual(new Set(all).size, all.length, 'seed ' + seed + ': ' + JSON.stringify(s.orders.map((o) => o.items)));
      L.skipOrder(s, k % 3);
    }
  }
  // only one thing to ask for: every order may ask for it
  const s = fresh(9);
  L.orderCandidates = ((base) => { const f = () => ['turnip']; f.base = base; return f; })(L.orderCandidates);
  try {
    L.standTick(s, 300);
    assert.ok(s.orders.every((o) => o.items && o.items[0][0] === 'turnip'));
  } finally { L.orderCandidates = L.orderCandidates.base; }
});

test('an older unfair order is swapped for a fresh fair one when the stall opens, at once and only once', () => {
  const s = fresh(4);
  L.addItem(s, 'turnip', 10);
  s.orders = [
    { from: 'lily', gold: 2420, items: [['carabao_milk', 7], ['fish_s', 4]] }, // no carabao, no rod
    { from: 'rosa', gold: 300, items: [['turnip', 3], ['egg', 1]] }, // fair: turnips in season, Clucky lays
    { from: 'mira', gold: 1500, items: [['carabao_milk', 2]] },
  ];
  const gold = s.gold;
  assert.ok(!L.orderFair(s, s.orders[0]) && L.orderFair(s, s.orders[1]) && !L.orderFair(s, s.orders[2]));
  assert.strictEqual(L.fixOrders(s), 2);
  assert.strictEqual(s.gold, gold, 'no penalty');
  assert.ok(s.orders.every((o) => o.items), 'replaced at once, no wait');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.orders[1].items)), [['turnip', 3], ['egg', 1]], 'the fair one stays');
  s.orders.forEach((o) => o.items.forEach((it) => assert.notStrictEqual(it[0], 'carabao_milk')));
  assert.strictEqual(L.fixOrders(s), 0, 'once: the new ones are fair');
  // too much for the farm's animals in a day: swapped too, unless the farmer already has enough
  const t = fresh(4);
  L.addItem(t, 'milker', 1);
  t.animals.push(animal('carabao'));
  t.orders = [{ from: 'lily', gold: 900, items: [['carabao_milk', 7]] }, { wait: 30 }, { wait: 60 }];
  assert.ok(!L.orderFair(t, t.orders[0]), '7 from one carabao');
  L.addItem(t, 'carabao_milk', 7);
  assert.ok(L.orderFair(t, t.orders[0]), 'already has 7: it can be delivered');
});

test('pay is as before: the items\' base price times the bonus', () => {
  const s = fresh(2);
  L.standTick(s, 300);
  s.orders.forEach((o) => {
    const value = o.items.reduce((sum, [id, n]) => sum + L.basePrice(id) * n, 0);
    assert.strictEqual(o.gold, Math.round(value * C.ORDERS.bonus / 10) * 10);
  });
});
