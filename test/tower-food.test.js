// Unit tests for The Lost Tower's food (the spec: docs/superpowers/specs/2026-11-13-tower-food-design.md; content
// src/00-zzzzzzzzzzzzzzzzzzzzzzzzz-tower-food.js, rules src/01-logicZZZZZZZZZZZZZZZZZZZZZ-tower-food.js): each realm's
// ingredient drops only there (1 in 4, the guard 2) and never sells; each dish cooks from its recipe; one Tower dish at a
// time; each power halves its trick (never cancels it), only inside the Tower; Hunter's Coffee 5 minutes, reset not added;
// the Baon eats under 15 energy only in the Tower; the save.
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
const TR = ctx.window.Farm.towerTricks;
const TF = C.TOWER_FOOD;
const TW = C.TOWER;
const WI = C.WILD;
const T = C.TILE;
const clock = require('./clock')(ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const give = (s, id, n = 1) => { L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id); };
const ING = ['tw_talangka_meat', 'tw_pusit', 'tw_kuhol', 'tw_frog_legs', 'tw_swallow_nest', 'tw_talaba', 'tw_santelmo_pepper', 'tw_mangosteen', 'tw_star_crab', 'tw_bakunawa_egg'];
const DISH = ['sinigang_talangka', 'adobong_pusit', 'ginataang_kuhol', 'pritong_palaka', 'nido_soup', 'inihaw_talaba', 'bicol_express', 'halo_halo_biringan', 'sopas_tala', 'balut_bakunawa'];
const fed = (id, map = 'tower') => { const s = L.newState(); s.map = map; s.energy = 10; L.eat(s, give(s, id)); return s; };

test('each realm drops its own ingredient: its 3 normal enemies 1 in 4, its guard 2 always; nowhere else', () => {
  TW.zones.forEach((z, i) => {
    assert.strictEqual(z.food, ING[i], z.name);
    assert.strictEqual(z.normal.length, 3);
    z.normal.forEach((k) => assert.deepStrictEqual(plain(WI.animals[k].drops), [[ING[i], 1, 0.25]], k));
    const g = plain(WI.animals[z.guard].drops);
    assert.deepStrictEqual(g[0], ['tinola', 1, 1], 'the guard\'s Tinola stays first');
    assert.deepStrictEqual(g.filter((d) => ING.includes(d[0])), [[ING[i], 2, 1]], z.guard);
    [z.mini, z.boss].forEach((k) => assert.ok(!WI.animals[k].drops.some((d) => ING.includes(d[0])), k + ' keeps its own drops'));
  });
  // only tower creatures drop them, each only its realm's
  Object.keys(WI.animals).forEach((k) => {
    const d = WI.animals[k], mine = plain((d.drops || []).filter((x) => ING.includes(x[0])).map((x) => x[0]));
    if (!d.tower) return assert.deepStrictEqual(mine, [], k);
    mine.forEach((id) => assert.strictEqual(id, ING[d.zone - 1], k));
  });
  // 1 in 4: L.huntDrops with a fixed roll
  const k = TW.zones[3].normal[0];
  const no = (roll) => L.huntDrops(k, () => roll).length;
  assert.strictEqual(no(0.24), 1);
  assert.strictEqual(no(0.25), 0);
  assert.deepStrictEqual(plain(L.huntDrops(TW.zones[3].guard, () => 0.99)).find((d) => d[0] === 'tw_frog_legs'), ['tw_frog_legs', 2]);
  let n = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 4000; i++) n += L.huntDrops(k, rnd).length;
  assert.ok(n > 900 && n < 1100, 'about 1 in 4: ' + n + ' of 4000');
});

test('the ingredients never sell (the stand, the box, the Market, Kanor); they only cook', () => {
  ING.forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it && !it.sell && !it.energy, id);
    assert.strictEqual(L.basePrice(id), 0, id + ': no price at the stand');
    assert.notStrictEqual(it.kind, 'hunt', id + ': not one of Kanor\'s');
    assert.ok(C.RECIPES.some((r) => r.needs[0] === id), id + ' cooks');
    const s = L.newState();
    give(s, id, 3);
    assert.ok(!L.wildGoods(s).includes(id), 'Kanor does not buy it');
  });
  DISH.forEach((id) => assert.ok(!C.ITEMS[id].sell, id + ': Tower drops make no Gold'));
});

test('each dish cooks from its recipe, with the energy of the spec', () => {
  const want = {
    sinigang_talangka: [['tw_talangka_meat', 'tomato', 'radish'], 70], adobong_pusit: [['tw_pusit', 'garlic', 'rice'], 75],
    ginataang_kuhol: [['tw_kuhol', 'spinach', 'chili'], 75], pritong_palaka: [['tw_frog_legs', 'garlic', 'egg'], 80],
    nido_soup: [['tw_swallow_nest', 'egg', 'ginger'], 80], inihaw_talaba: [['tw_talaba', 'garlic', 'onion'], 85],
    bicol_express: [['tw_santelmo_pepper', 'meat', 'onion'], 90], halo_halo_biringan: [['tw_mangosteen', 'milk', 'sugarcane'], 90],
    sopas_tala: [['tw_star_crab', 'milk', 'carrot'], 100], balut_bakunawa: [['tw_bakunawa_egg', 'chili', 'garlic'], 120],
    lugaw_parola: [['rice', 'ginger', 'egg'], 60],
  };
  const pick = { meat: 'meat_boar', milk: 'milk', egg: 'egg' };
  Object.keys(want).forEach((id) => {
    const r = C.RECIPES.find((x) => x.dish === id);
    assert.deepStrictEqual(plain(r.needs), want[id][0], id);
    assert.strictEqual(C.ITEMS[id].energy, want[id][1], id);
    assert.strictEqual(C.ITEMS[id].kind, 'dish');
    const s = L.newState();
    s.builds.kitchen = 1;
    assert.strictEqual(L.cook(s, r), 'missing');
    r.needs.forEach((n) => give(s, pick[n] || n));
    assert.strictEqual(L.cook(s, r), 'ok', id);
    assert.strictEqual(L.countItem(s, id), 1);
    r.needs.forEach((n) => assert.strictEqual(L.countItem(s, pick[n] || n), 0, n + ' used'));
  });
  assert.deepStrictEqual(Object.keys(TF.dishes).sort(), DISH.concat('lugaw_parola').sort());
  assert.deepStrictEqual(plain(C.FOOD_ICONS), ING.concat(DISH, ['lugaw_parola', 'baon']), 'the 22 icons, in order');
  C.FOOD_ICONS.forEach((id, i) => assert.strictEqual(C.ITEMS[id].icon, C.FOOD_ICON_BASE + i, id));
});

test('one Tower dish at a time (a new one replaces it), 15 minutes, beside the farm dish and the potions; a full stomach still takes it', () => {
  const s = L.newState();
  s.map = 'tower';
  s.energy = 10;
  s.dp = { id: 'boar_adobo', until: L.nowMin() + 10 };
  L.eat(s, give(s, 'pineapple_juice'));
  const gain = L.eat(s, give(s, 'adobong_pusit'));
  assert.ok(gain > 0 && L.countItem(s, 'adobong_pusit') === 0);
  assert.strictEqual(L.towerDish(s), 'adobong_pusit');
  assert.strictEqual(L.towerDishLeft(s), 15);
  assert.ok(L.towerPower(s, 'puddle'));
  assert.ok(L.power(s, 'charge') && L.power(s, 'walk'), 'the farm dish and the potion stay on');
  clock.advance(5);
  s.energy = L.maxEnergy(s);
  assert.strictEqual(L.eat(s, give(s, 'nido_soup')), -2, 'full: eaten for its power');
  assert.strictEqual(L.countItem(s, 'nido_soup'), 0);
  assert.strictEqual(L.towerDish(s), 'nido_soup', 'replaced');
  assert.ok(!L.towerPower(s, 'puddle') && L.towerPower(s, 'noheal'));
  assert.strictEqual(L.towerDishLeft(s), 15, 'a fresh 15 minutes');
  assert.strictEqual(s.dp.id, 'boar_adobo', 'the farm dish is not touched');
  clock.advance(15);
  assert.ok(!L.towerDish(s) && !L.towerPower(s, 'noheal'), 'over after 15 minutes');
});

test('a Tower dish works only inside the Tower', () => {
  DISH.concat('lugaw_parola').forEach((id) => {
    const s = fed(id, 'manila'), key = TF.dishes[id].key;
    assert.strictEqual(L.towerDish(s), id);
    assert.ok(!L.towerPower(s, key), id + ' not in Manila');
    s.map = 'tower';
    assert.ok(L.towerPower(s, key), id + ' in the Tower');
  });
  const s = fed('sopas_tala', 'farm');
  assert.ok(!L.power(s, 'charge'), 'Sopas ng Tala halves no charge on the farm');
  assert.strictEqual(L.regenEvery(s), C.ENERGY_EVERY);
  assert.strictEqual(L.towerSight(fed('inihaw_talaba', 'manila')), TR.dark.sight);
});

test('each power halves its trick, never cancels it', () => {
  const none = L.newState();
  none.map = 'tower';
  // shield: the Bow and the Javelin crack it, 3 hits break it; the Rifle at once; the Boomerang still bounces
  let s = fed('sinigang_talangka');
  assert.deepStrictEqual([1, 2, 3].map((n) => L.towerShieldCrack(s, null, n)), ['crack', 'crack', 'break']);
  assert.deepStrictEqual([1, 2, 3].map((n) => L.towerShieldCrack(s, 'javelin', n)), ['crack', 'crack', 'break']);
  assert.strictEqual(L.towerShieldCrack(s, 'rifle', 1), 'break');
  assert.strictEqual(L.towerShieldCrack(s, 'boomerang', 9), 'bounce');
  assert.deepStrictEqual([null, 'javelin', 'rifle'].map((k) => L.towerShieldCrack(none, k, 9)), ['bounce', 'bounce', 'break'], 'without it: as before');
  // puddle: 40% slower, 20%
  assert.strictEqual(L.towerWalk(true, none), 1 - TR.burst.slow);
  s = fed('adobong_pusit');
  assert.strictEqual(L.towerWalk(true, s), 1 - TR.burst.slow / 2);
  assert.strictEqual(L.towerWalk(false, s), 1);
  // song: 50% longer, 25%
  assert.strictEqual(L.towerGap(1000, true, none), 1500);
  s = fed('ginataang_kuhol');
  assert.strictEqual(L.towerGap(1000, true, s), 1250);
  assert.strictEqual(L.towerGap(1000, false, s), 1000);
  // flocks: a pierce hits the one right behind, at half damage
  const a = { x: 5 * T, y: 5 * T, hp: 3 }, b = { x: 6.2 * T, y: 5.2 * T, hp: 3 }, c = { x: 9 * T, y: 5 * T, hp: 3 }, d = { x: 4 * T, y: 5 * T, hp: 3 };
  const side = { x: 5.5 * T, y: 7 * T, hp: 3 }, down = { x: 5.8 * T, y: 5 * T, hp: 0 };
  assert.strictEqual(L.towerBehind([a, c, d, side, b, down], a, 2 * T, 5 * T, T), b, 'the nearest behind, on the line');
  assert.strictEqual(L.towerBehind([a, c, d, side], a, 2 * T, 5 * T, T), null, 'none near enough');
  assert.strictEqual(L.towerPierceDamage(3), 1.5);
  // healers: one you hit is not mended for 5 s, the others are
  const healer = { x: 0, y: 0, hp: 5, max: 5 }, hurt = { x: T, y: 0, hp: 1, max: 5, tfNoHeal: 6000 }, other = { x: 2 * T, y: 0, hp: 3, max: 5 };
  assert.strictEqual(L.towerHealPick(healer, [healer, hurt, other], T), hurt, 'as before (the game server)');
  assert.strictEqual(L.towerHealPick(healer, [healer, hurt, other], T, 5000), other, 'not mended yet...');
  assert.strictEqual(L.towerHealPick(healer, [healer, hurt, other], T, 6001), hurt, '...after 5 s it is');
  // dark: 2 tiles more
  assert.strictEqual(L.towerSight(fed('inihaw_talaba')), L.towerSight(none) + 2);
  // split: half its hits, a quarter (never under 1)
  assert.strictEqual(L.towerSplitHp(40, none), 20);
  s = fed('bicol_express');
  assert.strictEqual(L.towerSplitHp(40, s), 10);
  assert.strictEqual(L.towerSplitHp(1, s), 1);
  assert.strictEqual(L.towerSplitHp(40), 20, 'the game server: as before');
  // revive: 2x slower
  assert.strictEqual(L.towerReviveMs(none), TR.revive.ms);
  assert.strictEqual(L.towerReviveMs(fed('halo_halo_biringan')), TR.revive.ms * 2);
  // Sopas ng Tala: a charge costs half (once: with an Ampalaya Brew too, still half), the refill 3x faster
  const kind = TW.zones[8].normal[0];
  assert.strictEqual(L.chargeLoss(none, 10, kind), 10);
  s = fed('sopas_tala');
  assert.strictEqual(L.chargeLoss(s, 10, kind), 5);
  L.eat(s, give(s, 'ampalaya_brew'));
  assert.strictEqual(L.chargeLoss(s, 10, kind), 5, 'never a quarter');
  assert.strictEqual(L.regenEvery(s), C.ENERGY_EVERY / 3);
  assert.strictEqual(L.regenEvery(fed('lugaw_parola')), C.ENERGY_EVERY / 3, 'Lugaw: 3x faster');
  assert.strictEqual(L.regenEvery(none), C.ENERGY_EVERY);
  // the refill, by the clock: 12 minutes give 18 energy, not 6
  s = fed('lugaw_parola');
  s.energy = 10;
  L.regen(s);
  clock.advance(12);
  L.regen(s);
  assert.strictEqual(s.energy, 28);
  // Balut ng Bakunawa: 2 energy back for each enemy beaten, never past the most
  s = fed('balut_bakunawa');
  s.energy = 50;
  assert.strictEqual(L.towerFeast(s), 2);
  assert.strictEqual(s.energy, 52);
  s.energy = L.maxEnergy(s) - 1;
  assert.strictEqual(L.towerFeast(s), 1);
  assert.strictEqual(L.towerFeast(none), 0);
});

test("Hunter's Coffee: free shots for 5 minutes, everywhere; another resets the 5 minutes, never adds", () => {
  assert.strictEqual(L.potionMins('shots'), 5);
  assert.strictEqual(L.potionMins('walk'), 10);
  assert.strictEqual(L.potionMins('charge'), 10);
  assert.match(C.ITEMS.hunters_coffee.desc, /for 5 minutes/);
  const s = L.newState();
  s.energy = 10;
  L.eat(s, give(s, 'hunters_coffee'));
  assert.strictEqual(L.potionLeft(s, 'shots'), 5);
  assert.ok(L.power(s, 'shots'));
  assert.strictEqual(L.shotEnergy(s, 2), 0);
  clock.advance(3);
  L.eat(s, give(s, 'hunters_coffee'));
  assert.strictEqual(L.potionLeft(s, 'shots'), 5, 'reset to 5, not 7');
  clock.advance(5);
  assert.ok(!L.power(s, 'shots'));
  L.eat(s, give(s, 'pineapple_juice'));
  assert.strictEqual(L.potionLeft(s, 'walk'), 10, 'Pineapple Juice stays at 10');
});

test('the Baon: bought once for 5,000 Gold, packs up to 3 foods, eats the next under 15 energy only in the Tower', () => {
  const s = L.newState();
  s.gold = 4999;
  assert.strictEqual(L.baonPack(s, give(s, 'tinola')), 'nobaon');
  assert.strictEqual(L.baonBuy(s), 'gold');
  s.gold = 12000;
  assert.strictEqual(L.baonBuy(s), 'ok');
  assert.strictEqual(s.gold, 7000);
  assert.strictEqual(L.baonBuy(s), 'owned', 'one is enough');
  assert.strictEqual(L.baonPack(s, give(s, 'tw_talaba')), 'nofood', 'an ingredient is not food');
  assert.strictEqual(L.baonPack(s, s.inv.findIndex((x) => x && x.id === 'baon')), 'nofood');
  give(s, 'tinola', 1);
  ['tinola', 'sopas_tala', 'ginger_tonic'].forEach((id) => assert.strictEqual(L.baonPack(s, give(s, id)), 'ok', id));
  assert.strictEqual(L.baonPack(s, give(s, 'kaldereta')), 'full');
  assert.deepStrictEqual(plain(s.tfb), ['tinola', 'sopas_tala', 'ginger_tonic']);
  assert.strictEqual(L.countItem(s, 'tinola'), 2, 'one of the three packed');
  assert.strictEqual(L.baonUnpack(s, 2), 'ok');
  assert.strictEqual(L.countItem(s, 'ginger_tonic'), 1);
  assert.strictEqual(L.baonPack(s, give(s, 'ginger_tonic')), 'ok');
  // not in the Tower: never
  s.map = 'manila';
  s.energy = 5;
  assert.strictEqual(L.baonEat(s), null);
  // in the Tower at 15: not yet; at 14: the first
  s.map = 'tower';
  s.energy = 15;
  assert.strictEqual(L.baonEat(s), null);
  s.energy = 14;
  const len = s.inv.length;
  const r = L.baonEat(s);
  assert.deepStrictEqual(plain(r), { id: 'tinola', gain: L.energyOf('tinola') });
  assert.strictEqual(s.energy, 14 + L.energyOf('tinola'));
  assert.strictEqual(s.inv.length, len, 'the bag is as it was');
  assert.strictEqual(L.countItem(s, 'tinola'), 2, 'the bag\'s own Tinola are not eaten');
  // a Tower dish from it: its power too
  s.energy = 0;
  assert.strictEqual(L.baonEat(s).id, 'sopas_tala');
  assert.strictEqual(L.towerDish(s), 'sopas_tala');
  // saved
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.tfb), ['ginger_tonic']);
  assert.strictEqual(L.towerDish(back), 'sopas_tala');
  // no Baon in the bag: it waits
  s.energy = 0;
  L.removeItem(s, 'baon', 1);
  assert.strictEqual(L.baonEat(s), null);
});

test('the save: new keys tfd and tfb only; an older save loads unchanged; nonsense dropped', () => {
  const s = L.newState();
  const o = plain(L.serialize(s));
  assert.strictEqual(o.tfd, undefined);
  assert.strictEqual(o.tfb, undefined);
  const back = L.deserialize(o);
  assert.strictEqual(back.tfd, null);
  assert.deepStrictEqual(plain(back.tfb), []);
  assert.deepStrictEqual(plain(L.serialize(back)), o, 'an older save comes back the same');
  const bad = Object.assign({}, o, { tfd: ['tinola', 5], tfb: ['tw_talaba', 'tinola', 7, '__proto__', 'baon', 'kaldereta', 'tinola', 'bistek'] });
  const b = L.deserialize(bad);
  assert.strictEqual(b.tfd, null, 'not a Tower dish');
  assert.deepStrictEqual(plain(b.tfb), ['tinola', 'kaldereta', 'tinola']);
});
