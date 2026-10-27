// Unit tests for the growing farm (src/00-workshop.js, src/01-logicA.js): crop mastery stars, workshops,
// fruit trees, field plots, helping a friend, orders for your goods, and the save.
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
const W = C.FARM_W;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; s.gold = 1e6; L.takeNotes(); return s; };
const ripe = (s, idx, crop) => { s.soil[idx] = { w: 0, c: crop, p: L.nowMin() - C.CROPS[crop].mins, r: 0 }; };

test('wheat: a 20-minute crop sold by Lily in spring, summer and fall; everything new has a name, an icon and a price', () => {
  assert.strictEqual(C.CROPS.wheat.mins, 20);
  assert.ok(C.SHOP_STOCK.includes('seed_wheat'));
  assert.strictEqual(C.CROP_KEYS[C.CROPS.wheat.art], 'wheat');
  ['wheat', 'apple', 'orange', 'mango', 'peach', 'pandesal', 'cream', 'butter', 'cheese', 'kesong_puti', 'grape_jelly', 'cranberry_sauce',
    'apple_jam', 'marmalade', 'mango_jam', 'peach_jam'].forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it && it.name && typeof it.icon === 'number' && it.sell > 0 && it.energy > 0, id);
    assert.ok(C.COLLECTION.includes(id), id + ' in the collection book');
  });
  assert.strictEqual(new Set(C.COLLECTION).size, C.COLLECTION.length, 'nothing twice in the collection');
});

test('every workshop good sells for more than what goes into it', () => {
  const value = (need) => Math.min(...L.ingredientItems(need).map((id) => C.ITEMS[id].sell));
  C.WORKSHOP_KEYS.forEach((k) => C.WORKSHOPS[k].recipes.forEach((r) => {
    const cost = r.needs.reduce((n, e) => n + value(e[0]) * e[1], 0);
    assert.ok(C.ITEMS[r.out].sell > cost, r.out + ': ' + C.ITEMS[r.out].sell + ' > ' + cost);
  }));
});

test('mastery: 50, 200 and 500 harvests of a crop give Bronze, Silver and Gold stars, each a chance of one more', () => {
  const s = fresh();
  s.mast.turnip = 49;
  ripe(s, 5, 'turnip');
  assert.strictEqual(L.harvest(s, 5), 'turnip');
  assert.deepStrictEqual(plain(L.mastery(s, 'turnip')), { level: 1, have: 50, next: 200 });
  const notes = L.takeNotes();
  assert.deepStrictEqual(plain(notes.filter((n) => n.kind === 'star').map((n) => [n.crop, n.level])), [['turnip', 1]]);
  // with a star, some harvests give one more (10% at Bronze, 30% at Gold)
  s.mast.turnip = 600;
  let extra = 0;
  for (let i = 0; i < 400; i++) {
    ripe(s, 7, 'turnip');
    s.inv = s.inv.map(() => null);
    clock.advance(1);
    L.harvest(s, 7);
    if (L.countItem(s, 'turnip') === 2) extra++;
  }
  assert.ok(extra > 80 && extra < 160, 'about 30%: ' + extra);
  assert.strictEqual(L.takeNotes().filter((n) => n.kind === 'star').length, 0, 'no new star past Gold');
  // grass cut with the sickle doesn't count
  s.soil[9] = { w: 0, c: 'grass', p: L.nowMin() - 200, r: 0 };
  L.cut(s, 9);
  assert.ok(!s.mast.grass);
  assert.strictEqual(roundTrip(s).mast.turnip, s.mast.turnip, 'saved');
});

test('workshops: one of each; only in the yard; three jobs in line, made one after another in real time', () => {
  const s = fresh();
  assert.strictEqual(L.buyYard(s, ix.bakery, 1), 'ok');
  assert.strictEqual(L.buyYard(s, ix.bakery, 1), 'have', 'one Bakery');
  L.addItem(s, 'wheat', 12);
  L.addItem(s, 'egg', 2);
  assert.strictEqual(L.startJob(s, 'bakery', 0), 'none', 'still in storage');
  assert.strictEqual(typeof L.placeYard(s, FARM, ix.bakery, 25, 14), 'number');
  assert.strictEqual(L.startJob(s, 'bakery', 0), 'ok');
  assert.strictEqual(L.countItem(s, 'wheat'), 9, 'three wheat went in');
  assert.strictEqual(L.startJob(s, 'bakery', 1), 'ok');
  assert.strictEqual(L.startJob(s, 'bakery', 0), 'ok');
  assert.strictEqual(L.startJob(s, 'bakery', 0), 'full');
  assert.strictEqual(L.startJob(s, 'bakery', 2), 'full');
  const jobs = plain(s.ws.bakery.map((j) => j[1] - L.nowMin()));
  assert.deepStrictEqual(jobs, [30, 75, 105], 'each starts when the one before is done');
  assert.strictEqual(L.collectJobs(s, 'bakery'), '!none');
  clock.advance(80);
  assert.deepStrictEqual(plain(L.collectJobs(s, 'bakery')), ['bread', 'pandesal']);
  assert.strictEqual(s.ws.bakery.length, 1);
  assert.ok(L.discovered(s, 'pandesal'));
  // saved, and finishes after a restart
  const back = roundTrip(s);
  assert.strictEqual(back.ws.bakery.length, 1);
  clock.advance(30);
  assert.deepStrictEqual(plain(L.collectJobs(back, 'bakery')), ['bread']);
  assert.ok(!back.ws.bakery, 'empty again');
});

test('workshops: missing ingredients, food groups, and a full bag keeps the goods waiting', () => {
  const s = fresh();
  L.buyYard(s, ix.dairy, 1);
  L.placeYard(s, FARM, ix.dairy, 25, 14);
  assert.strictEqual(L.startJob(s, 'dairy', 2), 'missing');
  L.addItem(s, 'milk', 1);
  L.addItem(s, 'milk_l', 1);
  L.addItem(s, 'carabao_milk', 1);
  assert.strictEqual(L.startJob(s, 'dairy', 2), 'ok', 'any milk will do for cheese');
  assert.strictEqual(L.countNeed(s, 'milk'), 0);
  clock.advance(90);
  s.inv = s.inv.map(() => ({ id: 'stone', n: 99 })); // a full bag
  assert.strictEqual(L.collectJobs(s, 'dairy'), '!full');
  assert.strictEqual(L.jobsReady(s, 'dairy'), 1, 'still waiting');
});

test('fruit trees: fruit every few hours in their two seasons; moving keeps the timer, putting away forgets it', () => {
  const s = fresh(); // April: spring
  L.buyYard(s, ix.mango_tree, 1);
  L.buyYard(s, ix.apple_tree, 1);
  const m = L.placeYard(s, FARM, ix.mango_tree, 25, 14);
  const a = L.placeYard(s, FARM, ix.apple_tree, 30, 14);
  assert.strictEqual(L.pickTree(s, m), '!notripe', 'a new tree grows its first fruit');
  assert.strictEqual(L.treeState(s, s.yard.items[m]).left, 12 * 60);
  assert.strictEqual(L.pickTree(s, a), '!season', 'apples in fall and winter');
  clock.advance(6 * 60);
  assert.strictEqual(L.moveYard(s, FARM, m, 26, 20), 'ok');
  assert.strictEqual(L.treeState(s, s.yard.items[m]).left, 6 * 60, 'the move kept its timer');
  clock.advance(6 * 60);
  assert.strictEqual(L.pickTree(s, m), 'mango');
  assert.strictEqual(L.countItem(s, 'mango'), 3);
  assert.strictEqual(L.pickTree(s, m), '!notripe', 'picked: it grows again');
  const back = roundTrip(s);
  assert.strictEqual(L.treeState(back, back.yard.items[m]).left, 12 * 60, 'saved');
  L.storeYard(s, a);
  assert.strictEqual(Object.keys(s.fruit).length, 1);
  // an apple tree bought before trees fruited: ready as soon as its season comes
  const old = fresh();
  old.yard.items.push({ t: ix.apple_tree, x: 30, y: 14 });
  clock.set(2026, 10, 5, 10, 0);
  old.day = L.dayOf(clock.ms);
  assert.strictEqual(L.pickTree(old, 0), 'apple');
});

test('field plots: more land, each dearer, up to 6; till and plant on them; moving takes the crops along', () => {
  const s = fresh();
  assert.strictEqual(L.yardPrice(s, ix.farm_plot), 1500);
  assert.strictEqual(L.buyYard(s, ix.farm_plot, 1), 'ok');
  assert.strictEqual(L.yardPrice(s, ix.farm_plot), 3000);
  for (let i = 1; i < 6; i++) assert.strictEqual(L.buyYard(s, ix.farm_plot, 1), 'ok');
  assert.strictEqual(L.buyYard(s, ix.farm_plot, 1), 'max');
  assert.strictEqual(s.gold, 1e6 - (1500 + 3000 + 4500 + 6000 + 7500 + 9000));
  const p = L.placeYard(s, FARM, ix.farm_plot, 24, 14);
  assert.strictEqual(L.plotAt(s, 25, 15), p);
  assert.strictEqual(L.plotAt(s, 27, 15), -1);
  // nothing else on a plot, not even a path, and a plot never over a path
  L.buyYard(s, ix.stone_path, 2);
  assert.strictEqual(L.placeYard(s, FARM, ix.stone_path, 25, 15), 'taken');
  assert.strictEqual(typeof L.placeYard(s, FARM, ix.stone_path, 30, 20), 'number');
  assert.strictEqual(L.placeYard(s, FARM, ix.farm_plot, 29, 19), 'taken');
  assert.strictEqual(L.placeYard(s, FARM, ix.farm_plot, 25, 15), 'taken', 'no two plots on top of each other');
  // crops on it, moved along with it; it can't be put away with crops on it
  const at = (x, y) => y * W + x;
  ripe(s, at(25, 15), 'turnip');
  assert.strictEqual(L.moveYard(s, FARM, p, 24, 20), 'ok');
  assert.ok(!s.soil[at(25, 15)] && s.soil[at(25, 21)].c === 'turnip');
  assert.strictEqual(L.storeYard(s, p), 'crops');
  assert.strictEqual(L.harvest(s, at(25, 21)), 'turnip');
  assert.strictEqual(L.storeYard(s, p), 'ok');
  assert.ok(!s.soil[at(25, 21)], 'its soil went with it');
});

test('soil is kept only on the field and on plots (a plot moved to storage on load leaves nothing behind)', () => {
  const s = fresh();
  s.soil[15 * W + 10] = { w: 0, c: null, p: 0, r: 0 }; // the field
  s.soil[30 * W + 30] = { w: 0, c: 'turnip', p: 0, r: 0 }; // the meadow, no plot
  assert.strictEqual(L.cleanSoil(s, FARM), 1);
  assert.ok(s.soil[15 * W + 10]);
});

test('orders and requests ask for goods you have made and fruit in season, never shop goods', () => {
  const s = fresh();
  L.buyYard(s, ix.jam_maker, 1);
  L.placeYard(s, FARM, ix.jam_maker, 25, 14);
  L.buyYard(s, ix.mango_tree, 1);
  L.placeYard(s, FARM, ix.mango_tree, 30, 14);
  L.buyYard(s, ix.bakery, 1);
  L.placeYard(s, FARM, ix.bakery, 25, 20);
  assert.ok(!L.orderCandidates(s).includes('mango_jam'), 'not made yet');
  L.discover(s, 'mango_jam');
  L.discover(s, 'bread');
  const o = L.orderCandidates(s), r = L.requestPool(s).map((e) => e[0]);
  assert.ok(o.includes('mango_jam') && o.includes('mango'));
  assert.ok(r.includes('mango_jam') && r.includes('mango'));
  assert.ok(!o.includes('bread') && !r.includes('bread'), "Hana sells bread");
});

test('helping a friend: water their growing crops on a visit; at home, the watered tiles grow faster', () => {
  const v = fresh();
  v.soil[100] = { w: 0, c: 'turnip', p: L.nowMin(), r: 0 };
  v.soil[101] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
  ripe(v, 102, 'turnip');
  assert.deepStrictEqual([100, 101, 102, 103].map((i) => L.helpWater(v, i)), [true, false, false, false]);
  const home = fresh();
  home.soil[100] = { w: 0, c: 'turnip', p: L.nowMin(), r: 0 };
  home.soil[104] = { w: 0, c: null, p: 0, r: 0 };
  assert.strictEqual(L.applyHelp(home, [100, 104, 'x', 99999]), 1);
  assert.strictEqual(home.soil[100].w, 1);
});

test('the save stays small with all of it', () => {
  const s = fresh();
  C.CROP_KEYS.forEach((k) => { s.mast[k] = 999; });
  ['bakery', 'dairy', 'jam_maker'].forEach((k, i) => { L.buyYard(s, ix[k], 1); L.placeYard(s, FARM, ix[k], 24 + i * 3, 14); s.ws[k] = [[0, 1e8], [0, 1e8], [0, 1e8]]; });
  assert.ok(JSON.stringify(L.serialize(s)).length < 16000);
  const back = roundTrip(s);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back.ws)), JSON.parse(JSON.stringify(s.ws)));
});

test('the Market: what can go on a stall, its three prices, and the shopping list of what you are missing', () => {
  const s = fresh();
  assert.ok(L.marketable('milk') && L.marketable('kesong_puti') && L.marketable('mango'));
  assert.ok(!L.marketable('hoe') && !L.marketable('seed_turnip') && !L.marketable('bread'), 'not tools, seeds or what Hana sells');
  Object.keys(C.ITEMS).filter(L.marketable).forEach((id) => assert.match(id, /^[a-z][a-z_]{0,23}$/, 'the server takes ' + id));
  assert.deepStrictEqual(plain(L.marketPrices('milk', 3)), [['Low', 300], ['Fair', 420], ['High', 600]]);
  // an order, a request and a workshop recipe you can't fill yet
  s.orders = [{ from: 'lily', items: [['milk', 2], ['turnip', 3]], gold: 100 }, { wait: 30 }];
  s.rq.list = [{ from: 'bram', id: 'ore_copper', n: 4, gold: 50, where: 'board', done: 0 }, { from: 'mira', id: 'egg', n: 1, done: 1 }];
  L.addItem(s, 'turnip', 3);
  L.buyYard(s, ix.dairy, 1);
  L.placeYard(s, FARM, ix.dairy, 25, 14);
  L.addItem(s, 'milk', 1);
  const list = plain(L.shoppingList(s));
  const of = (id) => list.find((e) => e.id === id);
  assert.strictEqual(of('milk').n, 2, 'cheese needs 3 milk, you have 1');
  assert.match(of('milk').why, /Lily/, 'the order comes first');
  assert.strictEqual(of('ore_copper').n, 4);
  assert.ok(of('carabao_milk'), 'kesong puti');
  assert.ok(!of('turnip') && !of('egg'), 'nothing you have or already gave');
});
