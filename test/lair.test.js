// Unit tests for Bakunawa's Lair's rules (src/00-zzzzzzlair.js, src/01-logicN.js): each floor's creatures, the guards and
// the Bakunawa, the deepest floor and the lift, the Magma Bow, the Fire Charm, and the save.
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
const kinds = (f) => plain(L.lairRoster(f).map((e) => e.kind));

test("the Lair's creatures are appended after every animal before them, and the Lair is a wild place opening with Magayon", () => {
  const order = plain(C.WILD.order);
  assert.deepStrictEqual(order.slice(-5), ['santelmo', 'sigbin', 'tikbalang', 'bungisngis', 'bakunawa']);
  assert.strictEqual(order.indexOf('greatmammoth'), order.length - 6, 'nothing before them moved');
  assert.strictEqual(L.isWildMap('lair'), true);
  const s = fresh();
  s.wild.n = 39;
  assert.strictEqual(L.wildOpen(s, 'lair'), false);
  s.wild.n = 40;
  assert.strictEqual(L.wildOpen(s, 'lair'), true);
  ['santelmo', 'sigbin', 'tikbalang', 'bungisngis', 'bakunawa'].forEach((k) => {
    const d = C.WILD.animals[k];
    assert.ok(d.lair && C.WILD.order.indexOf(k) >= 0 && !d.sheetRow && !d.tint, k + ' has its own row of the wild sheet, in its own colours');
    d.drops.forEach((x) => assert.ok(C.ITEMS[x[0]], k + ': ' + x[0]));
  });
});

test('each floor: 3 creatures, one more every 10 floors (at most 7); a Bungisngis guards each 10th; the Bakunawa on 50', () => {
  assert.strictEqual(L.lairRoster(1).length, 3);
  assert.deepStrictEqual(kinds(1), ['santelmo', 'santelmo', 'santelmo'], 'Santelmo first');
  assert.ok(kinds(12).every((k) => k === 'santelmo' || k === 'sigbin'));
  assert.ok(kinds(25).length === 5);
  assert.ok(L.lairRoster(49).length === 7);
  [10, 20, 30, 40].forEach((f) => { assert.strictEqual(kinds(f)[0], 'bungisngis'); assert.strictEqual(kinds(f).length, 3); });
  assert.deepStrictEqual(kinds(50), ['bakunawa', 'tikbalang', 'tikbalang']);
  assert.deepStrictEqual(kinds(33), kinds(33), 'the same floor holds the same ones');
  assert.ok(L.lairHp('bungisngis', 40) > L.lairHp('bungisngis', 10), 'the guards grow');
  assert.strictEqual(L.lairHp('sigbin', 40), C.WILD.animals.sigbin.hp);
  L.lairRoster(50).forEach((e, i) => assert.strictEqual(e.slot, i));
});

test('the deepest floor and the lift: stops at 1, 11, 21 ... that you reached; the Bakunawa once a day', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(L.lairStops(s)), [1]);
  assert.strictEqual(L.lairReach(s, 7), true);
  assert.strictEqual(L.lairReach(s, 5), false);
  assert.deepStrictEqual(plain(L.lairStops(s)), [1]);
  L.lairReach(s, 23);
  assert.deepStrictEqual(plain(L.lairStops(s)), [1, 11, 21]);
  assert.strictEqual(L.lairReach(s, 999), true);
  assert.strictEqual(s.lair.deep, 50, 'no deeper than the last floor');
  assert.strictEqual(L.bakunawaReady(s), true);
  L.bakunawaHunted(s);
  assert.strictEqual(L.bakunawaReady(s), false);
  s.day += 1;
  assert.strictEqual(L.bakunawaReady(s), true, 'the next day');
});

test('a hunt in the Lair counts in the Hunter\'s Book but leaves no Wild Lands timer', () => {
  const s = fresh();
  L.hunted(s, 'lair', 2, 'sigbin', 1);
  assert.strictEqual(s.wild.by.sigbin, 1);
  assert.strictEqual(s.wild.gone['lair:2'], undefined);
  L.hunted(s, 'pulag', 2, 'deer', 1);
  assert.ok(s.wild.gone['pulag:2'] != null);
});

test('the Magma Bow: after the Gold Bow, for gold and the Lair\'s goods; range 7, hits 3; its name and icon', () => {
  const s = fresh();
  assert.strictEqual(L.makeMagmaBow(s), 'nobow');
  L.addItem(s, 'bow', 1);
  s.tools.bow = 2;
  assert.strictEqual(L.makeMagmaBow(s), 'gold-bow');
  s.tools.bow = 3;
  s.gold = 24999;
  assert.strictEqual(L.makeMagmaBow(s), 'gold');
  s.gold = 30000;
  assert.strictEqual(L.makeMagmaBow(s), 'short');
  L.addItem(s, 'ember_shard', 40); L.addItem(s, 'bakunawa_scale', 3); L.addItem(s, 'obsidian', 5);
  assert.strictEqual(L.makeMagmaBow(s), 'ok');
  assert.strictEqual(s.gold, 5000);
  assert.strictEqual(L.countItem(s, 'ember_shard') + L.countItem(s, 'bakunawa_scale') + L.countItem(s, 'obsidian'), 0);
  assert.strictEqual(L.bowRange(s), 7);
  assert.strictEqual(L.bowDamage(s), 3);
  assert.strictEqual(L.itemName(s, 'bow'), 'Magma Bow');
  assert.strictEqual(L.iconOf(s, 'bow'), C.ICON.bow_4);
  assert.strictEqual(L.makeMagmaBow(s), 'have');
  const back = roundTrip(s);
  assert.strictEqual(L.bowLevel(back), 4, 'kept by the save');
  const o = plain(L.serialize(s));
  delete o.mgb;
  assert.strictEqual(L.bowLevel(L.deserialize(o)), 3, 'an old save reads it as the Gold Bow');
  assert.strictEqual(L.itemName(fresh(), 'hoe'), 'Hoe', 'the other tools as before');
});

test('the Fire Charm: Hunter\'s gear for gold and the Lair\'s goods; a charge costs 40% less', () => {
  const s = fresh();
  s.gold = 10000;
  assert.strictEqual(L.buyGear(s, 'charm'), 'short');
  assert.strictEqual(s.gold, 10000, 'nothing taken');
  L.addItem(s, 'ember_shard', 25); L.addItem(s, 'santelmo_flame', 3);
  assert.strictEqual(L.chargeLoss(s, 10), 10);
  assert.strictEqual(L.buyGear(s, 'charm'), 'ok');
  assert.strictEqual(s.gold, 4000);
  assert.strictEqual(L.countItem(s, 'ember_shard'), 0);
  assert.strictEqual(L.chargeLoss(s, 10), 6);
  assert.strictEqual(L.hasGear(roundTrip(s), 'charm'), true);
  assert.strictEqual(L.buyGear(s, 'charm'), 'owned');
  const t = fresh();
  t.gold = 9999;
  assert.strictEqual(L.buyGear(t, 'cloak'), 'ok', 'the other gear as before: gold only');
});

test('the Lair in the save: the deepest floor and the Bakunawa\'s day; an old save starts at nothing', () => {
  const s = fresh();
  L.lairReach(s, 31);
  L.bakunawaHunted(s);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.lair), { deep: 31, bk: s.day });
  const o = plain(L.serialize(fresh()));
  assert.strictEqual(o.lr, undefined);
  assert.deepStrictEqual(plain(L.deserialize(o).lair), { deep: 0, bk: -1 });
  o.lr = [9999, 'x'];
  assert.deepStrictEqual(plain(L.deserialize(o).lair), { deep: 50, bk: -1 });
});

// Owner, 5 Nov 2026: the Volcano set, made by Kanor from what the Lair gives, dear because it is rare.
test('the Volcano set: five pieces Kanor makes for Gold and Lair drops, the Bakunawa Rug the dearest and most beautiful', () => {
  const want = { volcano_lamp: 30000, volcano_model: 40000, volcano_armchair: 50000, volcano_fireplace: 80000, bakunawa_rug: 200000 };
  Object.keys(want).forEach((k) => {
    const t = C.WILD.trophies.find((x) => x.type === k), type = C.HOME.types[C.HOME.typeIndex[k]];
    assert.ok(t && type && type.trophy && type.lair && type.price === 0, k + ' is made by Kanor, never sold in the catalog');
    assert.strictEqual(t.gold, want[k], k + ' costs ' + want[k] + 'G');
    t.needs.forEach((n) => assert.ok(C.ITEMS[n[0]], k + ': ' + n[0]));
  });
  const beauty = (k) => C.HOME.types[C.HOME.typeIndex[k]].beauty;
  assert.ok(C.HOME.types.every((t) => t.key === 'bakunawa_rug' || t.beauty < beauty('bakunawa_rug')), 'nothing in the house is more beautiful than the Bakunawa Rug');
  // made like a trophy: it costs the Gold and the drops, and goes into the furniture bag
  const s = L.newState();
  const i = C.WILD.trophies.findIndex((x) => x.type === 'volcano_lamp');
  s.gold = 29999;
  L.addItem(s, 'ember_shard', 15); L.addItem(s, 'santelmo_flame', 2);
  assert.strictEqual(L.makeTrophy(s, i), 'gold');
  s.gold = 30000;
  assert.strictEqual(L.makeTrophy(s, i), 'ok');
  assert.strictEqual(s.gold, 0);
  assert.strictEqual(L.countItem(s, 'ember_shard'), 0);
  assert.strictEqual(s.home.bag[L.furnKey(C.HOME.typeIndex.volcano_lamp, 0)], 1);
});
