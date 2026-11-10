// Unit tests for farm tech (src/00-zzzzzzz-farmtech.js, src/01-logicZ-farmtech.js): sprinklers that keep their tiles
// watered under the real-time growth rules, fertilizer and Silver / Gold crops, the greenhouse, and the save ('ft').
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; s.yard.items = []; s.gold = 1e6; L.takeNotes(); return s; };
const at = (x, y) => y * W + x;
const tilled = (s, ...idxs) => idxs.forEach((i) => { s.soil[i] = { w: 0, c: null, p: 0, r: 0 }; });
const give = (s, id, n = 1) => { L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id); };
const ripe = (s, idx, crop) => { s.soil[idx] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0, h: 1 }; };
// the first tile (from x) whose crop comes out at quality q
const tileFor = (s, q, crop = 'turnip', f = 0) => {
  for (let x = 2; x < 60; x++) for (let y = 2; y < 40; y++) {
    const i = at(x, y);
    ripe(s, i, crop);
    if (f) s.soil[i].f = f;
    if (L.cropGrade(s, i) === q) return i;
    delete s.soil[i];
  }
  throw new Error('no tile');
};

test('three sprinklers, five new items with icons, two fertilizers at Lily, the greenhouse at Mira, and the tours', () => {
  assert.deepStrictEqual(plain(C.SPRINKLERS.map((x) => [x.id, x.gold, x.ore, x.n])),
    [['sprinkler_copper', 800, 'ore_copper', 3], ['sprinkler_silver', 2000, 'ore_silver', 3], ['sprinkler_gold', 4500, 'ore_gold', 3]]);
  ['sprinkler_copper', 'sprinkler_silver', 'sprinkler_gold', 'fert', 'fert_rich'].forEach((id) => {
    assert.ok(C.ITEMS[id] && typeof C.ITEMS[id].icon === 'number' && C.ICON_ORDER[C.ITEMS[id].icon] === id, id);
  });
  const at5 = C.ICON_ORDER.indexOf('sprinkler_copper');
  assert.deepStrictEqual(plain(C.ICON_ORDER.slice(at5, at5 + 5)), ['sprinkler_copper', 'sprinkler_silver', 'sprinkler_gold', 'fert', 'fert_rich'], 'appended in a row');
  assert.ok(C.ICON_ORDER.indexOf('gear_charm') < at5, 'after the ones before');
  assert.ok(C.SHOP_SUPPLIES.includes('fert') && C.SHOP_SUPPLIES.includes('fert_rich'));
  assert.deepStrictEqual([C.ITEMS.fert.price, C.ITEMS.fert_rich.price], [10, 30]);
  const gh = C.OUTDOOR.types[GH];
  assert.ok(gh.key === 'greenhouse' && gh.kind === 'plot' && gh.cat === 'land' && gh.one && gh.w === 4 && gh.h === 3);
  assert.ok(C.OUTDOOR.types.slice(GH + 1).every((t) => t.cat === 'none' || C.FRAID_PIECES.indexOf(t) >= 0), 'appended last (later files append only pieces that are not sold: Bayanihan Projects\' rewards; and the Farm Raids pieces, 9 Nov 2026)');
  ['sprinkler_tour', 'quality_tour', 'greenhouse_tour'].forEach((k) => assert.ok(C.TIPS.some((t) => t.key === k), k));
  const news = C.NEWS.find((n) => n.v === '2.2').lines.map((l) => l[3]);
  ['sprinkler', 'quality', 'greenhouse'].forEach((k) => assert.ok(news.includes(k), k + ' in What\'s new'));
});

test('a sprinkler\'s reach: copper the 4 beside it, silver the 8 around it, gold the 5x5; never off the map\'s edge', () => {
  assert.strictEqual(L.sprinklerReach(0).length, 4);
  assert.strictEqual(L.sprinklerReach(1).length, 8);
  assert.strictEqual(L.sprinklerReach(2).length, 24);
  assert.deepStrictEqual(plain(L.sprinklerTiles(at(10, 10), 0)).sort((a, b) => a - b), [at(10, 9), at(9, 10), at(11, 10), at(10, 11)]);
  assert.strictEqual(L.sprinklerTiles(at(0, 10), 1).length, 5, 'nothing wraps to the row before');
  assert.strictEqual(L.sprinklerTiles(at(W - 1, 10), 2).length, 14);
});

test('Bram makes a sprinkler for gold and ore', () => {
  const s = fresh();
  s.gold = 500;
  assert.strictEqual(L.makeSprinkler(s, 0), 'gold');
  s.gold = 1000;
  assert.strictEqual(L.makeSprinkler(s, 0), 'ore');
  L.addItem(s, 'ore_copper', 4);
  assert.strictEqual(L.makeSprinkler(s, 0), 'ok');
  assert.strictEqual(s.gold, 200);
  assert.strictEqual(L.countItem(s, 'ore_copper'), 1);
  assert.strictEqual(L.countItem(s, 'sprinkler_copper'), 1);
});

test('placed on tilled soil, a sprinkler waters its tiles: a seed there starts growing at once (unwatered, a seed stays a seed)', () => {
  const s = fresh(), c = at(20, 20), n = at(20, 19), far = at(23, 20);
  tilled(s, c, n, far);
  const slot = give(s, 'seed_turnip');
  assert.strictEqual(L.plantBag(s, [n, far], slot), 2);
  assert.ok(L.needsWater(s.soil[n]) && L.needsWater(s.soil[far]), 'both wait for water');
  clock.advance(30);
  assert.strictEqual(L.cropStage(s.soil[n]), 0, 'still a seed');
  const sp = give(s, 'sprinkler_copper');
  assert.strictEqual(L.placeSprinkler(s, at(5, 5), sp), 'nosoil');
  assert.strictEqual(L.placeSprinkler(s, n, sp), 'crop');
  assert.strictEqual(L.placeSprinkler(s, c, sp), 'ok');
  assert.strictEqual(L.countItem(s, 'sprinkler_copper'), 0);
  assert.strictEqual(s.soil[c].sp, 1);
  assert.ok(s.soil[n].w && !L.needsWater(s.soil[n]), 'watered the minute it was placed');
  assert.strictEqual(s.soil[n].p, L.nowMin(), 'grows from now: no time skipped');
  assert.ok(!s.soil[far].w, 'out of reach');
  clock.advance(15);
  assert.ok(L.isRipe(s.soil[n]));
  // picked: the soil would be dry, the sprinkler waters it again; the next seed grows at once
  assert.strictEqual(L.harvest(s, n), 'turnip');
  assert.ok(s.soil[n].w, 'wet again');
  L.plantBag(s, [n], give(s, 'seed_turnip'));
  assert.ok(!L.needsWater(s.soil[n]));
  // a newly tilled tile in reach is wet; the sprinkler's own tile gets no seed
  delete s.soil[at(21, 20)];
  assert.strictEqual(L.till(s, at(21, 20)), 'ok');
  assert.ok(s.soil[at(21, 20)].w);
  assert.strictEqual(L.plantBag(s, [c], give(s, 'seed_turnip')), 'nospace');
  assert.ok(!s.soil[c].c);
});

test('picked up again: back in the bag, the soil stays tilled; a full bag keeps it on the field', () => {
  const s = fresh(), c = at(20, 20);
  tilled(s, c);
  L.placeSprinkler(s, c, give(s, 'sprinkler_gold'));
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'stone_x' in C.ITEMS ? 'stone_x' : 'turnip', n: 99 };
  assert.strictEqual(L.pickUpSprinkler(s, c), 'full');
  assert.strictEqual(s.soil[c].sp, 3);
  s.inv[0] = null;
  assert.strictEqual(L.pickUpSprinkler(s, c), 'ok');
  assert.ok(s.soil[c] && !s.soil[c].sp);
  assert.strictEqual(L.countItem(s, 'sprinkler_gold'), 1);
  assert.strictEqual(L.pickUpSprinkler(s, c), 'none');
});

test('every morning and on load the sprinklers water what they reach; rain or not', () => {
  const s = fresh(), c = at(20, 20), e = at(21, 21);
  tilled(s, c, e);
  L.placeSprinkler(s, c, give(s, 'sprinkler_silver'));
  s.soil[e].w = 0; // (dried by an older version of the game)
  const t = roundTrip(s);
  assert.ok(t.soil[e].w, 'on load');
  t.soil[e].w = 0;
  clock.nextDay(L, t);
  assert.ok(t.soil[e].w, 'in the morning');
});

test('a sprinkler never waters a friend\'s farm on a visit, and a ripe crop is left alone', () => {
  const s = fresh(), c = at(20, 20), e = at(20, 21);
  tilled(s, c, e);
  L.placeSprinkler(s, c, give(s, 'sprinkler_copper'));
  ripe(s, e, 'turnip');
  s.soil[e].w = 0;
  delete s.soil[e].h; // (a crop from before the water rule: ripe on dry soil)
  assert.strictEqual(L.autoWater(s, e), false, 'ripe');
  s.soil[e] = { w: 0, c: null, p: 0, r: 0 };
  s.isVisit = true;
  assert.strictEqual(L.autoWater(s, e), false);
});

test('fertilizer: a 3x3 patch, before planting or on seeds and sprouts; Rich beats plain; used up when the crop is picked', () => {
  const s = fresh(), idxs = [];
  for (let y = 20; y < 23; y++) for (let x = 20; x < 23; x++) idxs.push(at(x, y));
  tilled(s, ...idxs.slice(0, 8)); // (the 9th is not tilled)
  const slot = give(s, 'fert', 2);
  assert.strictEqual(L.fertilize(s, idxs, slot), 8);
  assert.strictEqual(L.countItem(s, 'fert'), 1);
  assert.strictEqual(L.fertilize(s, idxs, slot), 'nospace', 'already fertilized');
  assert.strictEqual(L.fertilize(s, idxs, give(s, 'fert_rich')), 8, 'Rich goes over plain');
  assert.ok(idxs.slice(0, 8).every((i) => s.soil[i].f === 2));
  assert.strictEqual(L.fertilize(s, idxs, give(s, 'turnip')), 'nofert');
  ripe(s, idxs[0], 'turnip');
  assert.ok(!L.canFertilize(s, idxs[0], 2), 'too late for a ripe crop');
  s.soil[idxs[0]].f = 2;
  assert.strictEqual(L.harvest(s, idxs[0]), 'turnip');
  assert.ok(!s.soil[idxs[0]].f, 'used up');
});

test('quality: chances by fertilizer and crop stars; worked out from the tile, the same every time', () => {
  const s = fresh(), t = { c: 'turnip', f: 0 };
  assert.deepStrictEqual(plain(L.qualityChance(s, t)), [0.1, 0.02]);
  t.f = 1;
  assert.deepStrictEqual(plain(L.qualityChance(s, t)), [0.3, 0.1]);
  t.f = 2;
  assert.deepStrictEqual(plain(L.qualityChance(s, t)), [0.4, 0.25]);
  s.mast.turnip = 200; // a Silver crop star: two stars
  const ch = L.qualityChance(s, t);
  assert.ok(Math.abs(ch[0] - 0.46) < 1e-9 && Math.abs(ch[1] - 0.29) < 1e-9);
  // over many tiles, Rich Fertilizer gives far more Silver and Gold than none
  const count = (f) => {
    let n = [0, 0, 0];
    for (let i = 0; i < 2000; i++) { s.soil[i] = { w: 1, c: 'turnip', p: i * 7, r: 0, f }; n[L.cropGrade(s, i)]++; }
    return n;
  };
  s.mast.turnip = 0;
  const none = count(0), rich = count(2);
  assert.ok(none[2] < 100 && rich[2] > 380, 'gold: ' + none[2] + ' vs ' + rich[2]);
  assert.ok(rich[1] > 650 && none[1] < 300, 'silver: ' + none[1] + ' vs ' + rich[1]);
  const i = tileFor(s, 2);
  assert.strictEqual(L.cropGrade(s, i), 2);
  assert.strictEqual(L.cropGrade(s, i), 2, 'the same again');
  ripe(s, at(1, 1), 'grass');
  assert.strictEqual(L.cropGrade(s, at(1, 1)), 0, 'grass is never graded');
});

test('a Gold crop goes into the bag on its own stack with a mark; a normal one stacks with the others', () => {
  const s = fresh();
  L.takeFtNotes();
  const g = tileFor(s, 2), n = tileFor(s, 0);
  assert.strictEqual(L.harvest(s, n), 'turnip');
  assert.strictEqual(L.harvest(s, g), 'turnip');
  const slots = s.inv.filter((x) => x && x.id === 'turnip');
  assert.deepStrictEqual(plain(slots.map((x) => [x.n, x.q || 0])), [[1, 0], [1, 2]]);
  assert.deepStrictEqual(plain(L.takeFtNotes()), [{ idx: g, item: 'turnip', q: 2 }]);
  assert.strictEqual(L.bestQuality(s, 'turnip'), 2);
  assert.strictEqual(L.bestQuality(s, 'potato'), -1);
  // the contests' call: L.cropQuality(slot, s, slotIndex) -> stars 0, 1, 2
  const gi = s.inv.findIndex((x) => x && x.q === 2), ni = s.inv.findIndex((x) => x && x.id === 'turnip' && !x.q);
  assert.strictEqual(L.cropQuality(s.inv[gi], s, gi), 2);
  assert.strictEqual(L.cropQuality(s.inv[ni], s, ni), 0);
  assert.strictEqual(L.cropQuality({ id: 'tomato', n: 1, q: 1 }, s), 1);
  assert.strictEqual(L.cropQuality(null, s, gi), 2, 'by its index');
  assert.strictEqual(L.cropQuality(null, s), 0);
  L.addItem(s, 'turnip', 3);
  assert.deepStrictEqual(plain(s.inv.filter((x) => x && x.id === 'turnip').map((x) => [x.n, x.q || 0])), [[4, 0], [1, 2]], 'normal ones stack apart');
  assert.strictEqual(L.addItemQ(s, 'turnip', 2, 2), 0);
  assert.deepStrictEqual(plain(s.inv.filter((x) => x && x.id === 'turnip').map((x) => [x.n, x.q || 0])), [[4, 0], [3, 2]]);
  assert.strictEqual(L.countItem(s, 'turnip'), 7, 'all count as turnips');
  assert.strictEqual(L.countQuality(s, 'turnip', 1), 3);
  // taking by name (a recipe, a request): normal ones first
  assert.strictEqual(L.removeItem(s, 'turnip', 5), 5);
  assert.deepStrictEqual(plain(s.inv.filter((x) => x && x.id === 'turnip').map((x) => [x.n, x.q || 0])), [[2, 2]]);
  assert.strictEqual(L.takeQuality(s, 'turnip', 2, 1), 1);
  assert.strictEqual(L.countQuality(s, 'turnip', 2), 1);
});

test('Silver and Gold sell for 1.5 and 2 times: the shipping box, Sell now and a shelf', () => {
  const s = fresh();
  assert.deepStrictEqual([L.qualityPrice('tulip', 0), L.qualityPrice('tulip', 1), L.qualityPrice('tulip', 2), L.qualityPrice('turnip', 1)], [34, 51, 68, 8]);
  s.inv = s.inv.map(() => null);
  L.addItem(s, 'tulip', 2);
  L.addItemQ(s, 'tulip', 3, 2);
  L.addItemQ(s, 'tulip', 1, 1);
  const r = L.ship(s, 1);
  assert.deepStrictEqual(plain(r), { id: 'tulip', n: 3, q: 2, value: 204 });
  L.ship(s, 0);
  assert.deepStrictEqual(plain(s.box), [{ id: 'tulip', n: 3, q: 2 }, { id: 'tulip', n: 2 }], 'apart in the box');
  assert.strictEqual(L.boxValue(s), 204 + 68);
  // the box survives a save
  assert.deepStrictEqual(plain(roundTrip(s).box), [{ id: 'tulip', n: 2 }, { id: 'tulip', n: 3, q: 2 }]);
  const res = L.endDay(s, false, null);
  assert.strictEqual(res.earned, 272);
  // Sell now pays the stall's share of the Silver price
  const silver = s.inv.findIndex((x) => x && x.q === 1), before = s.gold;
  assert.strictEqual(L.sellNow(s, silver, 1), L.withQuality(1, () => L.instantPrice('tulip', 1)));
  assert.ok(s.gold - before > L.instantPrice('tulip', 1), 'more than a normal one');
  // a shelf keeps the quality and is paid for it; unlisted, it comes back Gold
  L.addItemQ(s, 'tulip', 2, 2);
  const g = s.inv.findIndex((x) => x && x.q === 2);
  assert.strictEqual(L.listItem(s, 0, g, 2, 1), 'ok');
  assert.strictEqual(s.shelves[0].q, 2);
  assert.strictEqual(roundTrip(s).shelves[0].q, 2, 'saved');
  assert.strictEqual(L.unlist(s, 0), 'ok');
  assert.strictEqual(L.countQuality(s, 'tulip', 2), 2);
  L.listItem(s, 0, s.inv.findIndex((x) => x && x.q === 2), 2, 1);
  const sale = L.sellLot(s, 0, 'lily');
  assert.strictEqual(sale.coins, L.withQuality(2, () => L.shelfPrice('tulip', 2, 1)));
  assert.strictEqual(sale.coins, Math.round(68 * C.STAND.prices[1].mult) * 2);
});

test('the bag and Storage: qualities never stack together when moved; Storage keeps them', () => {
  const s = fresh();
  s.inv = s.inv.map(() => null);
  s.inv[0] = { id: 'turnip', n: 2 };
  s.inv[1] = { id: 'turnip', n: 1, q: 2 };
  assert.strictEqual(L.moveSlot(s, 1, 0), 'ok');
  assert.deepStrictEqual(plain(s.inv.slice(0, 2)), [{ id: 'turnip', n: 1, q: 2 }, { id: 'turnip', n: 2 }], 'swapped');
  assert.strictEqual(L.storeIn(s, 0), 1);
  assert.strictEqual(L.storeIn(s, 1), 2);
  const st = s.store.filter(Boolean).filter((x) => x.id === 'turnip');
  assert.deepStrictEqual(plain(st.map((x) => [x.n, x.q || 0])), [[1, 2], [2, 0]]);
  const t = roundTrip(s);
  assert.deepStrictEqual(plain(t.store.filter(Boolean).filter((x) => x.id === 'turnip').map((x) => [x.n, x.q || 0])), [[1, 2], [2, 0]]);
  const k = s.store.findIndex((x) => x && x.q === 2);
  assert.strictEqual(L.storeOut(s, k), 1);
  assert.strictEqual(L.bestQuality(s, 'turnip'), 2);
});

test('the greenhouse: one, 12,000G; crops inside grow 25% faster, misters water it, no weeds, no sprinkler inside', () => {
  const s = fresh();
  assert.strictEqual(L.yardPrice(s, GH), 12000);
  assert.strictEqual(L.buyYard(s, GH, 1), 'ok');
  assert.strictEqual(L.buyYard(s, GH, 1), 'have');
  assert.ok(L.hasGreenhouse(s));
  assert.strictEqual(L.placeYard(s, FARM, GH, 24, 14), 0);
  const inside = at(25, 15), out = at(30, 15);
  assert.ok(L.inGreenhouse(s, inside) && !L.inGreenhouse(s, out) && L.inGreenhouse(s, at(27, 16)) && !L.inGreenhouse(s, at(28, 16)));
  assert.strictEqual(L.till(s, inside), 'ok');
  assert.ok(s.soil[inside].w, 'watered as soon as it is tilled');
  // (economy v2, 11 Nov 2026: no more seasons) a summer seed in spring grows outside too
  tilled(s, out);
  const melon = give(s, 'seed_melon', 2);
  assert.ok(L.cropInSeason('melon', s.day));
  assert.strictEqual(L.plantBag(s, [out, inside], melon), 2, 'both tiles');
  assert.strictEqual(s.soil[inside].c, 'melon');
  assert.strictEqual(s.soil[out].c, 'melon');
  assert.ok(!L.needsWater(s.soil[inside]), 'growing at once');
  assert.ok(L.needsWater(s.soil[out]), 'the field tile waits for water');
  assert.ok(L.canPlantHere(s, 'melon', [inside]) && L.canPlantHere(s, 'melon', [out]));
  assert.strictEqual(L.cropLeft(s.soil[inside]), Math.round(C.CROPS.melon.mins * 0.75), 'inside: 25% faster');
  clock.advance(Math.round(C.CROPS.melon.mins * 0.75));
  assert.ok(L.isRipe(s.soil[inside]));
  assert.strictEqual(L.harvest(s, inside), 'melon');
  assert.ok(s.soil[inside].w, 'watered again');
  tilled(s, at(26, 15));
  assert.strictEqual(L.placeSprinkler(s, at(26, 15), give(s, 'sprinkler_copper')), 'greenhouse');
  // no weeds inside on a new season
  s.debris[at(26, 16)] = 'weed';
  L.endDay(s, false, null);
  assert.ok(!s.debris[at(26, 16)]);
  // saved and loaded: still there
  const t = roundTrip(s);
  assert.ok(L.inGreenhouse(t, inside));
});

test('a plot put away gives its sprinklers back; moved, they go along; soil cleaned away gives them back too', () => {
  const s = fresh(), P = C.OUTDOOR.index.farm_plot;
  L.buyYard(s, P, 1);
  const i = L.placeYard(s, FARM, P, 24, 14);
  tilled(s, at(25, 15));
  L.placeSprinkler(s, at(25, 15), give(s, 'sprinkler_silver'));
  assert.strictEqual(L.moveYard(s, FARM, i, 30, 14), 'ok');
  assert.strictEqual(s.soil[at(31, 15)].sp, 2, 'moved with its plot');
  assert.strictEqual(L.storeYard(s, i), 'ok');
  assert.strictEqual(L.countItem(s, 'sprinkler_silver'), 1);
  assert.ok(!s.soil[at(31, 15)]);
  // soil left where nothing is (a bad save): cleaned away, its sprinkler comes back
  const j = at(40, 3);
  tilled(s, j);
  L.placeSprinkler(s, j, give(s, 'sprinkler_silver'));
  assert.strictEqual(L.countItem(s, 'sprinkler_silver'), 1);
  L.cleanSoil(s, FARM);
  assert.ok(!s.soil[j]);
  assert.strictEqual(L.countItem(s, 'sprinkler_silver'), 2);
});

test('the save: sprinklers, fertilizer and qualities come back; an old save (no ft) loads; a farm with none writes no ft', () => {
  const s = fresh();
  assert.strictEqual(L.serialize(s).ft, undefined);
  const c = at(20, 20), f = at(22, 22);
  tilled(s, c, f);
  L.placeSprinkler(s, c, give(s, 'sprinkler_gold'));
  s.soil[f].f = 2;
  s.inv = s.inv.map((x, k) => (k < 3 ? x : null));
  s.inv[5] = { id: 'tomato', n: 4, q: 1 };
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  assert.ok(o.ft && o.ft.s && o.ft.f && o.ft.q);
  const t = L.deserialize(o);
  assert.strictEqual(t.soil[c].sp, 3);
  assert.strictEqual(t.soil[f].f, 2);
  assert.deepStrictEqual(plain(t.inv[5]), { id: 'tomato', n: 4, q: 1 });
  // the same save without ft: an old save
  delete o.ft;
  const old = L.deserialize(o);
  assert.ok(old && !old.soil[c].sp && !old.inv[5].q);
  // junk in ft is ignored
  o.ft = { s: [c, 99, 'x', 1], q: [5, 7, -1, 2], b: [['nope', 1, 1], 'x'], f: null };
  const junk = L.deserialize(o);
  assert.ok(junk && !junk.soil[c].sp && !junk.inv[5].q);
  assert.ok(JSON.stringify(L.serialize(s)).length < 16000);
});
