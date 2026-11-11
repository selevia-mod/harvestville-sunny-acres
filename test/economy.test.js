// Unit tests for farm economy v2, part 1 (src/00-zzzzzzzzzzzzzzzzzz-economy.js, src/01-logicZZZZZZZZZZZZZ-economy.js;
// docs/farm-economy-v2.md section 1): no more seasons for planting, the greenhouse's 25%, the 8 new crops, old saves.
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
const W = C.FARM_W;
const GH = C.OUTDOOR.index.greenhouse;
const ix = C.OUTDOOR.index;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const at = (x, y) => y * W + x;
const fresh = (m = 4, d = 1) => { clock.set(2026, m, d, 10, 0); const s = L.newState(); s.seed = 11; s.yard.items = []; s.gold = 1e6; L.takeNotes(); return s; };
const give = (s, id, n = 1) => { L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id); };
const NEW = ['banana', 'oats', 'peanut', 'cassava', 'taro', 'mung_bean', 'pineapple', 'bitter_gourd'];
// C.CROP_KEYS before economy v2 (the save stores a crop as its place in this list: append only)
const OLD_KEYS = ['turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin', 'grass', 'radish', 'lettuce', 'peas', 'cabbage',
  'cauliflower', 'onion', 'tulip', 'okra', 'chili', 'cucumber', 'bell_pepper', 'eggplant', 'sunflower', 'melon', 'watermelon', 'spinach',
  'bok_choy', 'beet', 'garlic', 'sweet_potato', 'cranberry', 'rice', 'grapes', 'kale', 'celery', 'broccoli', 'leek', 'parsnip', 'red_cabbage',
  'brussels', 'ginger', 'winter_squash', 'coffee', 'wheat', 'rose', 'sampaguita', 'gumamela', 'cotton', 'sugarcane', 'cacao', 'oregano'];

test('every crop can be planted in every month, out in the field (no more seasons)', () => {
  for (let m = 1; m <= 12; m++) {
    const s = fresh(m, 15);
    C.CROP_KEYS.forEach((k, i) => {
      const idx = at(4 + (i % 20), 4 + Math.floor(i / 20));
      s.soil[idx] = { w: 1, c: null, p: 0, r: 0 };
      assert.ok(L.cropInSeason(k, s.day), k + ' in month ' + m);
      assert.strictEqual(L.plant(s, idx, give(s, 'seed_' + k)), 'ok', k + ' planted in month ' + m);
      assert.strictEqual(s.soil[idx].c, k);
    });
    assert.deepStrictEqual(plain(L.seedsInSeason(s.day)), plain(C.SHOP_STOCK), 'Lily sells every seed in month ' + m);
    C.CROP_KEYS.forEach((k) => assert.ok(C.SHOP_STOCK.includes('seed_' + k), k));
  }
});

test('a crop never dies or stops at a season\'s turn; fruit trees fruit all year, each on its own hours', () => {
  clock.set(2026, 5, 31, 22, 0); // the last hours of spring
  const s = L.newState();
  s.yard.items = [];
  s.soil[5] = { w: 1, c: null, p: 0, r: 0 };
  L.plant(s, 5, give(s, 'seed_coffee')); // (a winter crop, before)
  const r = clock.nextDay(L, s);
  assert.strictEqual(r.newSeason, 'Summer');
  assert.strictEqual(s.soil[5].c, 'coffee');
  clock.advance(C.CROPS.coffee.mins);
  assert.ok(L.isRipe(s.soil[5]));
  // the trees: each its hours, in every month
  const hours = { apple_tree: 6, orange_tree: 8, mango_tree: 12, peach_tree: 10 };
  Object.keys(hours).forEach((k) => assert.strictEqual(C.FRUIT_TREES[k].hours, hours[k], k + ' keeps its hours'));
  for (let m = 1; m <= 12; m++) {
    const f = fresh(m, 10);
    Object.keys(hours).forEach((k, i) => { L.buyYard(f, ix[k], 1); L.placeYard(f, FARM, ix[k], 22 + i * 3, 14); });
    f.yard.items.forEach((it) => assert.ok(L.treeState(f, it).inSeason, 'month ' + m));
    clock.advance(12 * 60);
    f.yard.items.forEach((it, i) => assert.strictEqual(L.pickTree(f, i), L.treeOf(it.t).fruit, L.treeOf(it.t).fruit + ' in month ' + m));
    assert.strictEqual(L.countItem(f, 'mango'), 3, 'mangoes in month ' + m);
    assert.strictEqual(L.countItem(f, 'apple'), 3, 'apples in month ' + m);
  }
});

test('the 8 new crops: on the price ladder, energy like the crops that take as long, seeds at Lily\'s, appended', () => {
  assert.deepStrictEqual(plain(C.ECON_CROPS), NEW);
  assert.deepStrictEqual(plain(C.CROP_KEYS.slice(0, OLD_KEYS.length)), OLD_KEYS, 'the older crops keep their places (the save)');
  assert.deepStrictEqual(plain(C.CROP_KEYS.slice(OLD_KEYS.length)), NEW, 'the new ones after them');
  const want = {
    banana: ['Saba Banana', 720, 75, 18, 8], oats: ['Oats', 360, 55, 14, 8], peanut: ['Peanut', 240, 50, 12, 7], cassava: ['Cassava', 1440, 100, 25, 10],
    taro: ['Taro', 720, 75, 18, 8], mung_bean: ['Mung Bean', 240, 50, 12, 7], pineapple: ['Pineapple', 1440, 100, 25, 10], bitter_gourd: ['Bitter Gourd', 360, 55, 14, 8],
  };
  // the ladder as the older crops (and the players' seeds) have it: grow time -> [seed price, sell], and their energy
  const ladder = {}, energy = {};
  OLD_KEYS.filter((k) => !C.CROPS[k].sickle && C.ITEMS[k].energy).forEach((k) => {
    ladder[C.CROPS[k].mins] = [C.ITEMS['seed_' + k].price, C.ITEMS[k].sell];
    if (!C.NEW_CROPS.includes(k)) energy[C.CROPS[k].mins] = C.ITEMS[k].energy;
  });
  NEW.forEach((k, i) => {
    const [name, mins, seed, sell, en] = want[k], c = C.CROPS[k], it = C.ITEMS[k], sd = C.ITEMS['seed_' + k];
    assert.strictEqual(it.name, name);
    assert.strictEqual(c.mins, mins, k);
    assert.strictEqual(c.item, k);
    assert.deepStrictEqual([sd.price, it.sell], [seed, sell], k + ' price');
    assert.deepStrictEqual(plain([sd.price, it.sell]), plain(ladder[mins]), k + ' is on the ladder');
    assert.strictEqual(it.energy, en, k + ' energy');
    assert.strictEqual(it.energy, energy[mins], k + ' gives what the crops that take as long give');
    assert.strictEqual(it.kind, 'crop');
    assert.strictEqual(sd.kind, 'seed');
    assert.strictEqual(sd.crop, k);
    assert.strictEqual(sd.name, name + ' Seeds');
    assert.match(sd.desc, /^Plants 3x3\. Ready in /);
    assert.ok(C.SHOP_STOCK.includes('seed_' + k), k + ' at Lily\'s');
    assert.strictEqual(c.art, OLD_KEYS.length + i, k + ': its frames after every older crop');
    assert.strictEqual(C.ICON_ORDER[it.icon], k);
    assert.strictEqual(C.ICON_ORDER[sd.icon], 'seed_' + k);
    assert.ok(L.marketable(k), k + ' sells between farms');
  });
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(-16 - C.HORSE_ICONS.length - C.ECON2_ICONS.length, -C.HORSE_ICONS.length - C.ECON2_ICONS.length)), plain(NEW.concat(NEW.map((k) => 'seed_' + k))), 'their icons at the end (then only the horse gear, part 5, and parts 2-4\'s potions and materials)');
  assert.strictEqual(C.CROP_WITHERED, 2 + C.CROP_KEYS.length * 2);
  // the crops sheet and the game agree on its size, and it holds the withered frame
  const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'crops.png')), sizes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'sizes.json'), 'utf8'));
  assert.deepStrictEqual(sizes.crops, [png.readUInt32BE(16), png.readUInt32BE(20)]);
  assert.ok(C.CROP_WITHERED < 7 * Math.floor((sizes.crops[1] - 8 + 16) / 272));
});

test('the hunting drops are not the farm\'s crops: Wild Bananas and Heirloom Rice stay their own items', () => {
  assert.ok(C.ITEMS.banana_wild && C.ITEMS.banana && C.ITEMS.heirloom_rice && C.ITEMS.rice);
  assert.notStrictEqual(C.ITEMS.banana_wild, C.ITEMS.banana);
  assert.notStrictEqual(C.ITEMS.banana_wild.icon, C.ITEMS.banana.icon);
  assert.notStrictEqual(C.ITEMS.banana_wild.name, C.ITEMS.banana.name);
  assert.notStrictEqual(C.ITEMS.heirloom_rice.icon, C.ITEMS.rice.icon);
  assert.notStrictEqual(C.ITEMS.heirloom_rice.name, C.ITEMS.rice.name);
  assert.ok(!C.CROPS.banana_wild && !C.CROPS.heirloom_rice, 'no field grows the hunt drops');
  assert.strictEqual(C.CROPS.banana.item, 'banana');
  assert.strictEqual(C.CROPS.rice.item, 'rice');
  // a planted banana gives the farm's banana, not the wild one
  const s = fresh();
  s.soil[7] = { w: 1, c: 'banana', p: L.nowMin() - C.CROPS.banana.mins - 1, r: 0, h: 1 };
  assert.strictEqual(L.harvest(s, 7), 'banana');
  assert.strictEqual(L.countItem(s, 'banana'), 1);
  assert.strictEqual(L.countItem(s, 'banana_wild'), 0);
  // the Kare-Kare still wants the wild bananas
  assert.ok(C.RECIPES.some((r) => r.dish === 'kare_kare' && r.needs.includes('banana_wild') && !r.needs.includes('banana')));
});

test('the greenhouse: crops planted inside grow 25% faster; outside, the same as ever; once only', () => {
  const s = fresh();
  assert.strictEqual(C.GREENHOUSE.faster, 0.25);
  L.buyYard(s, GH, 1);
  assert.strictEqual(L.placeYard(s, FARM, GH, 24, 14), 0);
  const inside = at(25, 15), dry = at(26, 15), out = at(30, 15);
  assert.strictEqual(L.till(s, inside), 'ok');
  s.soil[out] = { w: 1, c: null, p: 0, r: 0 }; // wet field soil
  s.soil[dry] = { w: 0, c: null, p: 0, r: 0 }; // greenhouse soil the misters have not reached yet
  NEW.concat('turnip', 'tulip').forEach((k) => {
    [inside, dry, out].forEach((i) => { s.soil[i].c = null; s.soil[i].p = 0; s.soil[i].w = i === dry ? 0 : 1; delete s.soil[i].h; });
    const n = L.plantBag(s, [inside, dry, out], give(s, 'seed_' + k));
    assert.strictEqual(n, 3, k);
    const mins = C.CROPS[k].mins;
    assert.strictEqual(L.cropLeft(s.soil[inside]), Math.round(mins * 0.75), k + ' inside, on wet soil');
    assert.strictEqual(L.cropLeft(s.soil[dry]), Math.round(mins * 0.75), k + ' inside, on soil the misters wet as it was planted: boosted once');
    assert.strictEqual(L.cropLeft(s.soil[out]), mins, k + ' outside: as ever');
  });
  // saved and loaded, then the morning's misters: the time left does not change again
  const left = L.cropLeft(s.soil[inside]);
  const t = roundTrip(s);
  L.autoWaterAll(t);
  L.endDay(t, false, null);
  assert.ok(Math.abs(L.cropLeft(t.soil[inside]) - left) <= 1, 'not boosted twice');
  clock.advance(left);
  assert.ok(L.isRipe(s.soil[inside]) && !L.isRipe(s.soil[out]));
});

test('the greenhouse says so: 25% faster, waters itself, no weeds; Saffron has no out-of-season goods', () => {
  assert.ok(C.TRADER.rare.length === 0);
  for (let m = 1; m <= 12; m++) { const s = fresh(m, 10); assert.deepStrictEqual(plain(L.traderRare(s)), []); }
  const news = [].concat(...C.NEWS.map((n) => n.lines));
  assert.match(news.find((l) => l[1] === 'The Greenhouse')[2], /25% faster/);
  news.forEach((l) => assert.doesNotMatch(l[2], /out of season\?|in any season/i, l[1]));
  Object.keys(C.ITEMS).filter((id) => C.ITEMS[id].kind === 'seed').forEach((id) => assert.doesNotMatch(C.ITEMS[id].desc, /spring|summer|fall|winter/i, id));
});

test('old saves load and keep their crops (by their place in the crop list), fruit trees and their timers', () => {
  const s = fresh(11, 3);
  // crops of every older kind, growing and ripe, as a save from before economy v2 stores them (the format is unchanged)
  OLD_KEYS.forEach((k, i) => { s.soil[at(2 + (i % 30), 3 + Math.floor(i / 30))] = { w: 1, c: k, p: L.nowMin() - (i % 2 ? C.CROPS[k].mins + 1 : 5), r: 0, h: 1 }; });
  L.buyYard(s, ix.apple_tree, 1);
  L.buyYard(s, ix.mango_tree, 1);
  const a = L.placeYard(s, FARM, ix.apple_tree, 30, 14), m = L.placeYard(s, FARM, ix.mango_tree, 34, 14);
  clock.advance(60);
  const save = JSON.parse(JSON.stringify(L.serialize(s)));
  // the save names each crop by its number: the numbers the older game gave them
  const groups = save.f.filter((g) => g[0] > 0);
  groups.forEach((g) => assert.ok(g[0] - 1 < OLD_KEYS.length && C.CROP_KEYS[g[0] - 1] === OLD_KEYS[g[0] - 1]));
  const t = L.deserialize(save);
  OLD_KEYS.forEach((k, i) => {
    const idx = at(2 + (i % 30), 3 + Math.floor(i / 30));
    assert.strictEqual(t.soil[idx].c, k, k + ' kept');
    assert.strictEqual(L.cropStage(t.soil[idx]), L.cropStage(s.soil[idx]), k + ' at the same stage');
  });
  assert.strictEqual(L.treeState(t, t.yard.items[a]).left, L.treeState(s, s.yard.items[a]).left, 'the apple tree keeps its timer');
  assert.strictEqual(L.treeState(t, t.yard.items[m]).left, 11 * 60);
  clock.advance(5 * 60);
  assert.strictEqual(L.pickTree(t, a), 'apple', 'apples in November (they were fall and winter only: still yes)');
  // and a new crop saves and loads too
  t.soil[at(40, 20)] = { w: 1, c: 'pineapple', p: L.nowMin() - 30, r: 0, h: 1 };
  const back = roundTrip(t);
  assert.strictEqual(back.soil[at(40, 20)].c, 'pineapple');
  assert.ok(JSON.stringify(L.serialize(back)).length < C.MAX_SAVE_BYTES);
});
