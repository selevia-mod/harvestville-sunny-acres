// Unit tests for farm economy v2, part 2 (docs/farm-economy-v2.md section 2 and 4; src/00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js,
// src/01-logicZZZZZZZZZZZZZZZZZ-economy2.js): raiders eat crops (training, levels), only farm crops, the Silo first; the
// Silo (room, storing, taking out, upgrades, every farm gets one); raids pay in crops (just for fun: the farm raided loses
// nothing); the save.
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
const R = C.FRAID, S = C.SILO, O = C.OUTDOOR;
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const FARM = L.farmInfo(MAP);
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const camp = (lv) => { const s = L.newState(); s.gold = 1e6; s.fr = { camp: lv, army: {}, lv: {}, dlv: {}, train: [], pts: 0, won: {} }; return s; };

test("the owner's foods: about one crop a raider, the big ones a little more; a level-up asks x10, x20, x40, x60", () => {
  const want = { goat: ['cabbage', 1], crow: ['wheat', 1], cat: ['peanut', 2], monkey: ['banana', 2], rooster: ['rice', 2], bayawak: ['taro', 2], carabao: ['corn', 3], boar: ['cassava', 3] };
  R.raiderOrder.forEach((k) => {
    assert.deepStrictEqual(plain(R.raiders[k].crop), want[k], k);
    assert.ok(L.isFarmCrop(R.raiders[k].crop[0]), k + ' eats a crop you plant');
  });
  assert.deepStrictEqual(plain(R.level.crops), [0, 10, 20, 40, 60]);
  // only planted crops: the hunting places' drops are not farm crops
  ['banana_wild', 'heirloom_rice', 'fodder', 'egg', 'fish_s'].forEach((id) => assert.strictEqual(L.isFarmCrop(id), false, id));
  ['banana', 'rice', 'corn', 'wheat', 'sunflower', 'cotton'].forEach((id) => assert.strictEqual(L.isFarmCrop(id), true, id));
  // a full camp of one kind eats about 3 to 6 seed bags (9 crops a bag)
  const full = R.camp.levels[R.camp.levels.length - 1].space;
  R.raiderOrder.forEach((k) => { const d = R.raiders[k], n = Math.floor(full / d.space) * d.crop[1]; assert.ok(n >= 20 && n <= 60, k + ': ' + n + ' crops for a full camp'); });
});

test('training takes its crops, the Silo first, then the bag; not enough: "crops"; the other reasons come first', () => {
  const s = camp(1), now = 1e6;
  assert.strictEqual(L.trainRaider(s, 'goat', now), 'crops', 'no cabbage');
  L.addItem(s, 'cabbage', 2);
  L.siloPut(s, 'cabbage', 1);
  const g = s.gold;
  assert.strictEqual(L.trainRaider(s, 'goat', now), 'ok');
  assert.deepStrictEqual([L.siloHas(s, 'cabbage'), L.countItem(s, 'cabbage'), g - s.gold], [0, 2, R.raiders.goat.gold], 'the Silo first');
  assert.strictEqual(L.trainRaider(s, 'goat', now), 'ok');
  assert.strictEqual(L.countItem(s, 'cabbage'), 1, 'then the bag');
  // the others first: locked, room, gold
  assert.strictEqual(L.trainRaider(s, 'cat', now), 'locked');
  const poor = camp(1);
  poor.gold = 0;
  assert.strictEqual(L.trainRaider(poor, 'goat', now), 'gold');
  const full = camp(1);
  L.siloPut(full, 'cabbage', 50);
  for (let i = 0; i < 10; i++) assert.strictEqual(L.trainRaider(full, 'goat', now), 'ok');
  assert.strictEqual(L.trainRaider(full, 'goat', now), 'space');
  assert.strictEqual(L.siloHas(full, 'cabbage'), 40);
  // a monkey eats 2 Saba Bananas: the Sierra's Wild Bananas don't do
  const m = camp(5);
  L.addItem(m, 'banana_wild', 20);
  assert.strictEqual(L.trainRaider(m, 'monkey', now), 'crops');
  L.addItem(m, 'banana', 2);
  assert.strictEqual(L.trainRaider(m, 'monkey', now), 'ok');
  assert.strictEqual(L.countItem(m, 'banana'), 0);
  // the boar eats 3 cassava
  L.siloPut(m, 'cassava', 3);
  assert.strictEqual(L.trainRaider(m, 'boar', now), 'ok');
  assert.strictEqual(L.siloHas(m, 'cassava'), 0);
});

test("a raider's level-up asks for its crop bundle on top of the hunt item; a level reached stays", () => {
  const s = camp(1);
  L.addItem(s, 'fur_rabbit', 3);
  assert.deepStrictEqual(plain(L.raiderUpCrops(s, 'goat')), ['cabbage', 10]);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'crops');
  L.siloPut(s, 'cabbage', 6);
  L.addItem(s, 'cabbage', 6);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'ok');
  assert.deepStrictEqual([L.raiderLv(s, 'goat'), L.siloHas(s, 'cabbage'), L.countItem(s, 'cabbage'), L.countItem(s, 'fur_rabbit')], [2, 0, 2, 0]);
  assert.deepStrictEqual(plain(L.raiderUpCrops(s, 'goat')), ['cabbage', 20]);
  // the hunt item is asked first, as before
  assert.strictEqual(L.raiderUp(s, 'goat'), 'need');
  // a raider already at level 4 (an old save) keeps it, and its army
  const old = camp(7);
  old.fr.lv.boar = 4; old.fr.army.boar = 5;
  const back = roundTrip(old);
  assert.deepStrictEqual([back.fr.lv.boar, back.fr.army.boar], [4, 5]);
  assert.deepStrictEqual(plain(L.raiderUpCrops(back, 'boar')), ['cassava', 60]);
  back.fr.lv.boar = 5;
  assert.strictEqual(L.raiderUpCrops(back, 'boar'), null, 'top level: nothing more');
});

test('the Silo: 300 crops to start, farm crops only; store all from the bag (a Silver or Gold crop keeps its star), take out', () => {
  const s = L.newState();
  assert.strictEqual(L.siloCap(s), 300);
  assert.deepStrictEqual(plain(S.levels.map((l) => l.cap)), [300, 450, 650, 900, 1200]);
  assert.strictEqual(L.siloPut(s, 'corn', 250), 0);
  assert.strictEqual(L.siloPut(s, 'wheat', 80), 30, '30 did not fit');
  assert.strictEqual(L.siloPut(s, 'egg', 5), 5, 'not a crop');
  assert.strictEqual(L.siloPut(s, 'banana_wild', 5), 5, 'not a farm crop');
  assert.strictEqual(L.siloCount(s), 300);
  assert.strictEqual(L.siloTake(s, 'corn', 40), 40);
  assert.strictEqual(L.siloTake(s, 'corn', 999), 210);
  assert.strictEqual(L.siloHas(s, 'corn'), 0);
  assert.ok(!('corn' in s.silo.c));
  // store all
  const b = L.newState();
  L.addItem(b, 'carrot', 30); L.addItem(b, 'banana_wild', 4); L.addItem(b, 'egg', 3);
  b.inv[b.inv.findIndex((x) => !x)] = { id: 'tomato', n: 5, q: 2 }; // a Gold star tomato
  assert.strictEqual(L.siloStore(b), 30);
  assert.deepStrictEqual([L.siloHas(b, 'carrot'), L.countItem(b, 'carrot'), L.countItem(b, 'banana_wild'), L.countItem(b, 'tomato')], [30, 0, 4, 5]);
  // take out: as much as the bag holds
  assert.strictEqual(L.siloOut(b, 'carrot', 10), 10);
  assert.deepStrictEqual([L.siloHas(b, 'carrot'), L.countItem(b, 'carrot')], [20, 10]);
  b.inv = b.inv.map((x) => x || { id: 'stone_s', n: 1 });
  b.inv = b.inv.map((x) => (x.id === 'carrot' ? { id: 'carrot', n: L.stackLimit('carrot') } : x));
  assert.strictEqual(L.siloOut(b, 'carrot', 10), 0, 'a full bag');
  assert.strictEqual(L.siloHas(b, 'carrot'), 20);
});

test('a bigger Silo: Gold, lumber and Farm Cement, level by level; the crops stay', () => {
  const s = L.newState();
  s.gold = 1e6; s.lumber = 0;
  L.siloPut(s, 'corn', 100);
  assert.strictEqual(L.siloUp(s), 'lumber');
  s.lumber = 1000;
  assert.strictEqual(L.siloUp(s), 'cement');
  L.addItem(s, 'farm_cement', 99);
  const g = s.gold;
  assert.strictEqual(L.siloUp(s), 'ok');
  assert.deepStrictEqual([L.siloCap(s), g - s.gold, 1000 - s.lumber, 99 - L.countItem(s, 'farm_cement'), L.siloHas(s, 'corn')], [450, S.levels[1].gold, S.levels[1].lumber, S.levels[1].cement, 100]);
  while (L.siloUp(s) === 'ok');
  assert.strictEqual(L.siloCap(s), 1200);
  assert.strictEqual(L.siloUp(s), 'top');
  S.levels.slice(2).forEach((l, i) => assert.ok(l.gold > S.levels[i + 1].gold && l.cement > S.levels[i + 1].cement, 'each dearer'));
  const poor = L.newState();
  poor.gold = 10;
  assert.strictEqual(L.siloUp(poor), 'gold');
});

test('every farm gets its Silo once: a new farm where C.SILO.at is free; an old farm there or the nearest free spot; one in storage stays there', () => {
  const t = O.index.silo, type = O.types[t];
  assert.ok(type.key === 'silo' && type.building === 'silo' && type.one && type.w === 3 && type.h === 4 && type.price === 0 && type.prop === 'silo');
  assert.deepStrictEqual(plain(L.yardSolid(t, 0, 0)), [[0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]], 'solid only where the picture stands');
  const s = L.newState();
  assert.strictEqual(L.yardOwned(s, t), 0, 'not before the farm opens');
  assert.strictEqual(L.yardCantPlace(s, FARM, t, S.at[0], S.at[1], null), null, 'its spot is free on a new farm');
  assert.strictEqual(L.giveSilo(s, FARM), true);
  assert.deepStrictEqual(plain(s.yard.items.filter((it) => it.t === t)), [{ t, x: S.at[0], y: S.at[1] }]);
  assert.strictEqual(L.giveSilo(s, FARM), false, 'once');
  assert.strictEqual(L.yardRepair(s, FARM), 0, 'it fits: nothing goes to storage');
  // an old farm with a pond moved onto that spot: the nearest free one
  const o = L.newState(), pond = o.yard.items.find((it) => it.t === O.index.farm_pond);
  pond.x = S.at[0]; pond.y = S.at[1];
  assert.ok(!L.yardCantPlace({ yard: { items: o.yard.items.filter((it) => it !== pond) }, land: o.land, soil: o.soil }, FARM, pond.t, pond.x, pond.y, null));
  L.giveSilo(o, FARM);
  const it = o.yard.items.find((x) => x.t === t);
  assert.ok(it && !(it.x === S.at[0] && it.y === S.at[1]), 'not on the pond');
  o.yard.items.splice(o.yard.items.indexOf(it), 1);
  assert.strictEqual(L.yardCantPlace(o, FARM, t, it.x, it.y, null), null, 'a good spot');
  // put away in storage: it stays there; a visit never gets one
  const st = L.newState();
  st.yard.bag[t] = 1;
  assert.strictEqual(L.giveSilo(st, FARM), false);
  const v = L.newState();
  v.isVisit = true;
  assert.strictEqual(L.giveSilo(v, FARM), false);
  // Mira does not sell it
  assert.strictEqual(type.cat, 'none');
});

test('raids pay in crops: what the battle took from the field, by crop; the farm raided keeps everything', () => {
  const st = L.newState(), W = C.FARM_W;
  const put = (x, y, c) => { st.soil[y * W + x] = { c, w: 1, p: 0, r: 0 }; };
  put(5, 12, 'corn'); put(6, 12, 'corn'); put(7, 12, 'cabbage'); put(8, 12, 'grass');
  const taken = { w: W, items: [['crops', 5, 12, 1], ['crops', 6, 12, 1], ['crops', 7, 12, 1], ['crops', 8, 12, 1], ['crops', 9, 12, 1], ['gold', 3, 3, 400], ['produce', 2, 2, 4]], crops: 5 };
  const got = L.frCropsOf(st, taken);
  assert.deepStrictEqual(plain(got), { corn: 3, cabbage: 1 }, 'grass is not a crop to carry; a tile the farm no longer shows counts as the crop seen most');
  // home: the Silo first, then the bag, the rest is lost
  const s = L.newState();
  L.siloPut(s, 'wheat', 298);
  const home = L.frCropsHome(s, got);
  assert.deepStrictEqual(plain(home), { n: 4, silo: 2, bag: 2, lost: 0 });
  assert.deepStrictEqual([L.siloHas(s, 'corn'), L.countItem(s, 'corn') + L.countItem(s, 'cabbage')], [2, 2]);
  // the defender's farm is never touched
  assert.strictEqual(st.soil[5 * 1 + 12 * W].c, 'corn');
});

test("a real raid's crops wait for the game server, then come home (never more than the server says); kept in the save; the last 5", () => {
  const s = L.newState();
  L.frCropsKeep(s, 'r-1', { corn: 4, taro: 2 });
  L.frCropsKeep(s, 'r-0', {});
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.frc), { 'r-1': { corn: 4, taro: 2 } });
  const home = L.frCropsClaim(back, 'r-1', { crops: 5 });
  assert.strictEqual(home.n, 5, 'the server counted 5');
  assert.deepStrictEqual([L.siloHas(back, 'corn'), L.siloHas(back, 'taro')], [4, 1]);
  assert.strictEqual(L.frCropsClaim(back, 'r-1', { crops: 5 }), null, 'once');
  assert.ok(!roundTrip(back).frc['r-1']);
  for (let i = 0; i < 8; i++) L.frCropsKeep(s, 'raid-' + i, { wheat: 1 });
  assert.deepStrictEqual(Object.keys(s.frc), ['raid-3', 'raid-4', 'raid-5', 'raid-6', 'raid-7']);
  const all = L.frCropsClaim(s, 'raid-7', null);
  assert.strictEqual(all.n, 1, 'no server count: all of it');
});

test('practice: the crops come home instead of their worth in Gold; what will not fit is still paid in Gold', () => {
  const b = { taken: { crops: 6, gold: 300 }, total: { crops: 12, gold: 400 } };
  const s = L.newState();
  s.gold = 0;
  const plainPrize = L.banditPrize(s, 'b1', Object.assign({}, b));
  assert.strictEqual(plainPrize.gold, 300 + 6 * R.lootValue.crops, 'no crops given: as before');
  const t = L.newState();
  t.gold = 0;
  const p = L.banditPrize(t, 'b1', Object.assign({ cropsWon: { turnip: 4, corn: 2 } }, b));
  assert.deepStrictEqual([p.gold, t.gold, p.crops, L.siloHas(t, 'turnip'), L.siloHas(t, 'corn')], [300, 300, 6, 4, 2]);
  // a full Silo and bag: paid in Gold
  const f = L.newState();
  f.gold = 0;
  L.siloPut(f, 'wheat', 300);
  f.inv = f.inv.map(() => ({ id: 'stone_s', n: 1 }));
  const q = L.banditPrize(f, 'b1', Object.assign({ cropsWon: { turnip: 6 } }, b));
  assert.deepStrictEqual([q.gold, q.crops], [300 + 6 * R.lootValue.crops, 0]);
});

test('the workshops and the Kitchen use what is in the Silo, the Silo first', () => {
  const s = L.newState();
  s.yard.items.push({ t: O.index.bakery, x: 30, y: 30 });
  L.siloPut(s, 'wheat', 2);
  L.addItem(s, 'wheat', 2);
  assert.strictEqual(L.canMake(s, 'bakery', 0), true, '3 wheat: 2 in the Silo + 2 in the bag');
  assert.strictEqual(L.countNeed(s, 'wheat'), 4);
  assert.strictEqual(L.startJob(s, 'bakery', 0), 'ok');
  assert.deepStrictEqual([L.siloHas(s, 'wheat'), L.countItem(s, 'wheat')], [0, 1]);
  assert.strictEqual(L.countItem(s, 'wheat'), 1, 'outside a workshop the bag counts only the bag');
  L.siloPut(s, 'wheat', 5);
  assert.strictEqual(L.countItem(s, 'wheat'), 1);
  // the Kitchen
  s.builds.kitchen = 1;
  L.siloPut(s, 'coffee', 1);
  const r = C.RECIPES.find((x) => x.dish === 'kapeng_barako');
  assert.strictEqual(L.hasIngredients(s, r), true);
  assert.strictEqual(L.cook(s, r), 'ok');
  assert.deepStrictEqual([L.siloHas(s, 'coffee'), L.countItem(s, 'kapeng_barako')], [0, 1]);
  // a full bag: the dish needs its room (ingredients from the Silo free none)
  L.siloPut(s, 'coffee', 1);
  s.inv = s.inv.map((x) => x || { id: 'stone_s', n: 1 });
  s.inv = s.inv.map((x) => (x.id === 'kapeng_barako' ? { id: 'stone_s', n: 1 } : x));
  assert.strictEqual(L.cook(s, r), 'full');
  assert.strictEqual(L.siloHas(s, 'coffee'), 1, 'nothing used');
});

test("the save: 'sl', 'ptn' and 'frc' are new keys; the Silo comes back; an old save has an empty one; nonsense is cut to size; small", () => {
  const fresh = L.serialize(L.newState());
  ['sl', 'ptn', 'frc'].forEach((k) => assert.strictEqual(fresh[k], undefined, k + ' is not written for a farm without it'));
  // no other layer writes these keys
  const src = fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => !/economy2/.test(f)).map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
  ['sl', 'ptn', 'frc'].forEach((k) => assert.ok(!new RegExp('\\bo\\.' + k + '\\b|o\\[\'' + k + '\'\\]').test(src), k + ' is used nowhere else'));
  const s = L.newState();
  L.siloPut(s, 'corn', 50); L.siloPut(s, 'pineapple', 7);
  s.silo.lv = 2;
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  assert.deepStrictEqual(o.sl, [2, C.CROP_KEYS.indexOf('corn'), 50, C.CROP_KEYS.indexOf('pineapple'), 7]);
  const back = L.deserialize(o);
  assert.deepStrictEqual(plain(back.silo), { lv: 2, c: { corn: 50, pineapple: 7 } });
  const old = JSON.parse(JSON.stringify(fresh));
  assert.deepStrictEqual(plain(L.deserialize(old).silo), { lv: 0, c: {} });
  o.sl = [99, C.CROP_KEYS.indexOf('corn'), 1e9, C.CROP_KEYS.indexOf('grass'), 5, 9999, 3, 'x', 2];
  assert.deepStrictEqual(plain(L.deserialize(o).silo), { lv: S.levels.length - 1, c: { corn: 1200 } });
  o.frc = [['ok-1', [C.CROP_KEYS.indexOf('corn'), 3]], ['<bad id>', [1, 1]], 5];
  assert.deepStrictEqual(plain(L.deserialize(o).frc), { 'ok-1': { corn: 3 } });
  // a big farm with a full Silo and 5 raids waiting stays under the limit
  const big = L.newState();
  C.CROP_KEYS.forEach((k) => { if (L.isFarmCrop(C.CROPS[k].item)) big.silo.c[C.CROPS[k].item] = 21; });
  big.silo.lv = 4;
  for (let i = 0; i < 5; i++) L.frCropsKeep(big, '00000000-0000-4000-8000-00000000000' + i, { corn: 9, wheat: 9, taro: 9, rice: 9 });
  big.ptn = { charge: L.nowMin() + 9, walk: L.nowMin() + 9, shots: L.nowMin() + 9 };
  const bytes = JSON.stringify(L.serialize(big)).length - JSON.stringify(L.serialize(L.newState())).length;
  assert.ok(bytes < 1200, 'these add ' + bytes + ' bytes at most');
  assert.ok(JSON.stringify(L.serialize(big)).length < C.MAX_SAVE_BYTES);
});
