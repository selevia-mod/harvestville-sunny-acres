// Unit tests for the Wild Lands (owner, 30 Oct 2026): who roams where and when, hunts and their drops, Makiling
// opening after 10 hunts, the Bow and its upgrades, arrows, Kanor's shop, cooking the meat, and the save.
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
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const kinds = (list) => plain(list.map((e) => e.kind));

test('the places and who roams there: wolves only at night', () => {
  const s = L.newState();
  assert.deepStrictEqual(kinds(L.wildSlots('pulag')), ['labuyo', 'labuyo', 'labuyo', 'rabbit', 'rabbit', 'rabbit', 'deer', 'deer']);
  s.time = 10 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling')), ['deer', 'deer', 'boar', 'boar', 'boar']);
  s.time = 21 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling')).filter((k) => k === 'wolf'), ['wolf', 'wolf']);
  s.time = 3 * 60;
  assert.ok(L.isNight(s));
  assert.ok(L.isWildMap('pulag') && L.isWildMap('makiling') && !L.isWildMap('town'));
});

test('a hunted animal is gone for 45 minutes, then back; Makiling opens on the 10th hunt', () => {
  const s = L.newState();
  s.time = 10 * 60;
  assert.strictEqual(L.wildOpen(s, 'pulag'), true);
  assert.strictEqual(L.wildOpen(s, 'makiling'), false);
  assert.strictEqual(L.hunted(s, 'pulag', 6, 'deer').opened, null);
  assert.deepStrictEqual(kinds(L.wildHere(s, 'pulag')).filter((k) => k === 'deer'), ['deer']);
  clock.advance(44);
  assert.strictEqual(L.wildHere(s, 'pulag').length, 7);
  clock.advance(2);
  assert.strictEqual(L.wildHere(s, 'pulag').length, 8, 'back after 45 minutes');
  for (let i = 0; i < 8; i++) L.hunted(s, 'pulag', 0, 'labuyo');
  assert.strictEqual(L.hunted(s, 'pulag', 1, 'labuyo').opened, 'makiling');
  assert.strictEqual(L.wildOpen(s, 'makiling'), true);
  assert.strictEqual(s.wild.by.labuyo, 9);
  assert.strictEqual(s.wild.by.deer, 1);
});

test('what an animal leaves: always its meat (or pelt), sometimes more', () => {
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.99)), [['venison', 2]]);
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.1)), [['venison', 2], ['antler', 1]]);
  assert.deepStrictEqual(plain(L.huntDrops('wolf', () => 0.99)), [['pelt_wolf', 1]]);
  C.WILD.order.forEach((k) => C.WILD.animals[k].drops.forEach((d) => assert.ok(C.ITEMS[d[0]] && C.ITEMS[d[0]].sell > 0, d[0])));
});

test('the Bow: buy it once, upgrade it with gold and ore, shoot with arrows and energy', () => {
  const s = L.newState();
  s.gold = 500;
  assert.strictEqual(L.buyBow(s), 'gold');
  s.gold = 100000;
  assert.strictEqual(L.buyBow(s), 'ok');
  assert.strictEqual(L.buyBow(s), 'have');
  assert.strictEqual(L.bowRange(s), 6);
  assert.strictEqual(L.shoot(s), 'arrows');
  assert.strictEqual(L.buyWild(s, 'arrows'), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 10);
  s.energy = 1;
  assert.strictEqual(L.shoot(s), 'tired');
  s.energy = 50;
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 9);
  assert.strictEqual(s.energy, 48);
  assert.strictEqual(L.upgradeBow(s), 'ore');
  L.addItem(s, 'ore_copper', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.countItem(s, 'ore_copper'), 0);
  assert.strictEqual(L.itemName(s, 'bow'), 'Copper Bow');
  assert.strictEqual(L.iconOf(s, 'bow'), C.ICON.bow_1);
  assert.strictEqual(L.bowRange(s), 7);
  L.addItem(s, 'ore_silver', 5);
  L.upgradeBow(s);
  assert.strictEqual(L.bowDamage(s), 2);
  L.addItem(s, 'ore_gold', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.upgradeBow(s), 'max');
  assert.ok(!C.TOOL_KEYS.includes('bow'), 'the forge never upgrades it');
});

test('Kanor buys what you hunt; the meat cooks into the new dishes', () => {
  const s = L.newState();
  L.addItem(s, 'venison', 3);
  L.addItem(s, 'pelt_wolf', 1);
  L.addItem(s, 'turnip', 4);
  assert.deepStrictEqual(plain(L.wildGoods(s)), ['venison', 'pelt_wolf']);
  const g = s.gold;
  assert.strictEqual(L.sellToKanor(s, 'venison'), 270);
  assert.strictEqual(s.gold, g + 270);
  assert.strictEqual(L.countItem(s, 'venison'), 0);
  ['tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw'].forEach((d) => {
    const r = C.RECIPES.find((x) => x.dish === d);
    assert.ok(r && C.ITEMS[d].energy > 40, d);
    r.needs.forEach((n) => assert.ok(C.ITEMS[n] || C.FOOD_GROUPS[n], d + ' needs ' + n));
  });
  s.builds.kitchen = 1;
  L.addItem(s, 'meat_boar', 1);
  L.addItem(s, 'onion', 1);
  assert.strictEqual(L.cook(s, C.RECIPES.find((x) => x.dish === 'inihaw')), 'ok', 'any meat for inihaw');
  assert.strictEqual(L.countItem(s, 'inihaw'), 1);
});

test('saved: hunts, the bow and its level, animals still away; older saves start fresh', () => {
  const s = L.newState();
  s.gold = 1e6;
  L.buyBow(s);
  L.addItem(s, 'ore_copper', 5);
  L.upgradeBow(s);
  L.hunted(s, 'makiling', 3, 'boar');
  s.map = 'pulag';
  const b = roundTrip(s);
  assert.strictEqual(b.wild.n, 1);
  assert.strictEqual(b.wild.by.boar, 1);
  assert.strictEqual(L.bowLevel(b), 1);
  assert.strictEqual(b.map, 'pulag');
  assert.strictEqual(L.wildHere(b, 'makiling').filter((e) => e.slot === 3).length, 0, 'still away');
  const old = plain(L.serialize(L.newState()));
  delete old.wl;
  const o = L.deserialize(old);
  assert.deepStrictEqual(plain(o.wild), { n: 0, by: {}, gone: {} });
  assert.ok(!L.hasBow(o));
});
