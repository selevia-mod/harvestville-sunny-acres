// Unit tests for Bram's farm machines, the Tractor, the Seeder and the Harvester (the last part of the truck plan, owner 18
// Nov 2026; src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-machines.js, src/01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-machines.js): the
// recipes, each machine's 3x3 and its row, every rule of the hand tools still holding on each tile (the same farm worked
// by hand and by machine comes out the same), energy never more than by hand, the Harvester's crops into the Silo, the
// bag, the basket and never lost, the Tractor's drops, the field's edge, part blocks, mixed ripe and unripe, the save.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const MM = C.MACHINES, K = C.MACHINE_KINDS, W = C.FARM_W;
const FH = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')).height;
const CM = vm.runInContext('Math', ctx);
// the same random numbers for the hand and the machine (a dish power's or a skill's extra crop)
const seeded = (seed) => { let r = seed; return () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; };
const random = CM.random, skillRnd = L.skillRnd;
const fixRandom = (seed) => { const f = seeded(seed); CM.random = f; L.skillRnd = f; };
test.after(() => { CM.random = random; L.skillRnd = skillRnd; });
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const at = (x, y) => y * W + x;
const fresh = () => {
  clock.set(2026, 11, 18, 10, 0);
  const s = L.newState(); s.seed = 11; s.gold = 1e6; s.lumber = 500; s.energy = 100; s.debris = {}; s.yard.items = [];
  L.takeNotes(); L.takeGolden(); L.takeFtNotes();
  return s;
};
const give = (s, id, n = 1, q = 0) => { if (q) L.addItemQ(s, id, n, q); else L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id && (x.q || 0) === q); };
const mats = (s, k) => { MM[k].needs.forEach((n) => L.addItem(s, n[0], n[1])); };
const tilled = (s, ...idxs) => idxs.forEach((i) => { s.soil[i] = { w: 0, c: null, p: 0, r: 0 }; });
const ripe = (s, idx, crop = 'turnip') => { s.soil[idx] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0, h: 1 }; };
const block = (x, y, dx = 0, dy = 1) => L.mkTiles(x, y, dx, dy).map((p) => at(p[0], p[1]));
const row = (x, y, dx = 0, dy = 1) => L.mkTiles(x, y, dx, dy, true).map((p) => at(p[0], p[1]));
// everything of an item a farm holds: the bag (by quality), the Silo and the basket
const holds = (s, id) => {
  const out = { 0: 0, 1: 0, 2: 0 };
  s.inv.forEach((x) => { if (x && x.id === id) out[x.q || 0] += x.n; });
  out[0] += ((s.silo && s.silo.c[id]) || 0) + ((s.basket || {})[id] || 0);
  return out;
};
const noCrops = (s) => { s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'crop' ? null : x)); return s; };

// ---------- making them ----------
test('the recipes: Tractor 80,000G, Seeder 120,000G, Harvester 200,000G, with lumber, ore, Farm Cement and Rope; one of each a farm', () => {
  assert.deepStrictEqual(plain(K), ['tractor', 'seeder', 'harvester']);
  assert.deepStrictEqual(plain(['gold', 'lumber', 'needs'].map((f) => MM.tractor[f])), [80000, 40, [['ore_copper', 10], ['farm_cement', 4]]]);
  assert.deepStrictEqual(plain(['gold', 'lumber', 'needs'].map((f) => MM.seeder[f])), [120000, 40, [['ore_silver', 10], ['rope', 4]]]);
  assert.deepStrictEqual(plain(['gold', 'lumber', 'needs'].map((f) => MM.harvester[f])), [200000, 60, [['ore_gold', 10], ['farm_cement', 6], ['rope', 6]]]);
  K.forEach((k, i) => {
    const it = C.ITEMS[k];
    assert.ok(it.kind === 'tool' && it.machine === k && it.painted && !it.sell && !it.price && !it.tool, k + ': a tool you hold, never sold or given');
    assert.strictEqual(it.icon, C.MACHINE_ICON_BASE + i, k + ': its painted icon');
    assert.strictEqual(L.stackLimit(k), 1);
  });
  assert.ok(C.MACHINE_ICON_BASE >= C.JUNGLE_ICON_BASE + C.JUNGLE_ICONS.length, 'past the Jungle\'s frames');
  const s = fresh();
  s.gold = 79999;
  assert.strictEqual(L.mkMake(s, 'tractor'), 'gold');
  s.gold = 80000; s.lumber = 39;
  assert.strictEqual(L.mkMake(s, 'tractor'), 'lumber');
  s.lumber = 40;
  L.addItem(s, 'ore_copper', 10); L.addItem(s, 'farm_cement', 3);
  assert.strictEqual(L.mkMake(s, 'tractor'), 'needs');
  L.addItem(s, 'farm_cement', 1);
  const full = s.inv.map((x) => x);
  s.inv = s.inv.map((x) => x || { id: 'hoe', n: 1 });
  assert.strictEqual(L.mkMake(s, 'tractor'), 'full', 'a full bag: nothing taken');
  assert.strictEqual(s.gold, 80000);
  s.inv = full;
  assert.strictEqual(L.mkMake(s, 'tractor'), 'ok');
  assert.deepStrictEqual([s.gold, s.lumber, L.countItem(s, 'ore_copper'), L.countItem(s, 'farm_cement'), L.countItem(s, 'tractor'), s.mk], [0, 0, 0, 0, 1, 1]);
  assert.ok(L.mkMade(s, 'tractor') && !L.mkMade(s, 'seeder'));
  s.gold = 1e6; s.lumber = 500; mats(s, 'tractor');
  assert.strictEqual(L.mkMake(s, 'tractor'), 'have', 'one a farm');
  // the other two
  mats(s, 'seeder'); mats(s, 'harvester');
  assert.strictEqual(L.mkMake(s, 'seeder'), 'ok');
  assert.strictEqual(L.mkMake(s, 'harvester'), 'ok');
  assert.strictEqual(s.gold, 1e6 - 120000 - 200000);
  assert.strictEqual(s.mk, 7);
  // put away in Storage it is still yours; missing from both (never in play), Bram gives it back, free
  const i = s.inv.findIndex((x) => x && x.id === 'seeder');
  L.storeIn(s, i);
  assert.ok(!L.hasItem(s, 'seeder') && L.mkHave(s, 'seeder') && !L.mkLost(s, 'seeder'));
  assert.strictEqual(L.mkBack(s, 'seeder'), 'have');
  s.store = s.store.map((x) => (x && x.id === 'seeder' ? null : x));
  assert.ok(L.mkLost(s, 'seeder'));
  const g = s.gold;
  assert.strictEqual(L.mkBack(s, 'seeder'), 'ok');
  assert.ok(L.hasItem(s, 'seeder') && s.gold === g);
  assert.strictEqual(L.mkMake(s, 'nothing'), 'none');
});

test('where it works: the 3x3 ahead (a Silver tool\'s charged swing) and a row of 9, in each direction', () => {
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
    assert.deepStrictEqual(plain(L.mkTiles(10, 10, dx, dy)), plain(L.chargeTiles(10, 10, dx, dy, 2)), 'the block, facing ' + dx + ',' + dy);
    const r = plain(L.mkTiles(10, 10, dx, dy, true));
    assert.strictEqual(r.length, 9);
    r.forEach((p, d) => assert.deepStrictEqual(p, [10 + dx * d, 10 + dy * d]));
  });
});

// ---------- energy ----------
test('energy: never more than by hand (the cheapest hand way), 8 tiles\' worth for 9, at every tool level, with a dish power and a skill', () => {
  const s = fresh();
  assert.strictEqual(L.mkEnergy(s, { hoe: 9 }), 16, 'a Basic hoe: 18 by hand, 16 by Tractor');
  assert.strictEqual(L.mkEnergy(s, { hoe: 0 }), 0);
  assert.strictEqual(L.mkEnergy(s, { sickle: 1 }), 1, 'one point stays one');
  let checked = 0;
  for (let lv = 0; lv < 4; lv++) {
    s.tools.hoe = s.tools.axe = s.tools.hammer = s.tools.sickle = lv;
    for (const dish of [null, 'tools']) {
      s.dp = dish ? { id: Object.keys(C.DISH_POWERS).find((id) => C.DISH_POWERS[id].key === 'tools'), until: L.nowMin() + 60 } : null;
      for (const xp of [0, 1e7]) {
        s.sk2 = { farm: xp };
        for (let n = 1; n <= 9; n++) for (let c = 0; c <= 9 - n; c++) {
          const counts = { hoe: n, sickle: c % 3, axe: Math.floor(c / 3), hammer: c % 2 };
          const hand = ['hoe', 'sickle', 'axe', 'hammer'].reduce((e, t) => e + (counts[t] ? Math.min(...[counts[t] * L.toolEnergy(s, t, 1), L.toolEnergy(s, t, counts[t])]) : 0), 0);
          const e = L.mkEnergy(s, counts);
          assert.ok(e <= hand && e >= 1, JSON.stringify({ lv, dish, xp, counts, e, hand }));
          assert.strictEqual(e, Math.max(1, Math.floor(hand * 8 / 9 + 1e-9)));
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 500);
});

// ---------- the Tractor ----------
const planOf = (s, idxs, field = () => true) => idxs.map((idx) => {
  const k = s.debris[idx] || null, t = s.soil[idx];
  return k ? { idx, clear: k, till: field(idx) ? 1 : 0 } : !t || L.isWithered(t) ? { idx, till: field(idx) ? 1 : 0 } : { idx };
});
test('the Tractor: one pass tills the 3x3 and clears its weeds, branches and stones with the hand tools\' drops; stumps and boulders stay', () => {
  const s = fresh(), b = block(5, 12);
  s.debris[b[0]] = 'weed'; s.debris[b[1]] = 'branch'; s.debris[b[2]] = 'stone'; s.debris[b[3]] = 'stump'; s.debris[b[4]] = 'boulder';
  const hand = fresh();
  Object.assign(hand.debris, plain(s.debris));
  // by hand: the drops of the same three
  const drops = [b[0], b[1], b[2]].map((i) => plain(L.clearDebris(hand, i)));
  const r = L.mkTill(s, planOf(s, b));
  assert.strictEqual(r.clear, 3);
  assert.strictEqual(r.lumber, drops.reduce((n, d) => n + d.lumber, 0));
  assert.strictEqual(r.stone, drops.reduce((n, d) => n + d.stone, 0));
  assert.deepStrictEqual([s.lumber, s.stone], [500 + r.lumber, r.stone]);
  assert.ok(r.lumber === 1 && r.stone === 1, 'a branch: 1 lumber, a stone: 1 stone');
  assert.deepStrictEqual(plain(r.tilled).sort(), [b[0], b[1], b[2], b[5], b[6], b[7], b[8]].sort(), 'the cleared tiles tilled too');
  assert.strictEqual(s.debris[b[3]], 'stump');
  assert.strictEqual(s.debris[b[4]], 'boulder');
  assert.ok(!s.soil[b[3]] && !s.soil[b[4]]);
  // energy: 7 hoe, 1 sickle, 1 axe, 1 hammer by hand (Basic tools): 14 + 1 + 3 + 3 = 21 -> 18
  assert.strictEqual(r.energy, 18);
  assert.strictEqual(s.energy, 100 - 18);
  // again: nothing left for it (the stump and the boulder are the axe's and the hammer's)
  assert.strictEqual(L.mkTill(s, planOf(s, b)), 'none');
  assert.strictEqual(s.energy, 82);
});

test('the Tractor: a withered crop is cleared as the hoe does, a growing or ripe one never dug up; sprinklers left alone; tired: nothing', () => {
  const s = fresh(), b = block(20, 20);
  tilled(s, b[0]); s.soil[b[0]].c = 'turnip'; s.soil[b[0]].p = L.nowMin() - 5000; s.soil[b[0]].h = 1; s.soil[b[0]].w = 1; // withered
  assert.ok(L.isWithered(s.soil[b[0]]));
  ripe(s, b[1]);
  tilled(s, b[2]); s.soil[b[2]].c = 'turnip'; s.soil[b[2]].p = L.nowMin(); s.soil[b[2]].h = 1; // a seed
  tilled(s, b[3]); s.soil[b[3]].sp = 1; // a sprinkler's tile
  const before = plain([s.soil[b[1]], s.soil[b[2]], s.soil[b[3]]]);
  const r = L.mkTill(s, planOf(s, b));
  assert.ok(r.tilled.includes(b[0]) && !s.soil[b[0]].c, 'the withered one cleared');
  assert.deepStrictEqual(plain([s.soil[b[1]], s.soil[b[2]], s.soil[b[3]]]), before, 'the rest untouched');
  assert.strictEqual(r.till, 6);
  // tired
  const t = fresh(), b2 = block(30, 20);
  t.energy = 11;
  const was = plain(t.soil);
  assert.strictEqual(L.mkTill(t, planOf(t, b2)), 'tired', '9 tiles cost 16');
  assert.deepStrictEqual(plain(t.soil), was);
  assert.strictEqual(t.energy, 11);
});

test('the Tractor: the field\'s edge and part blocks (only field soil is tilled; the rest of the block is left), and the map\'s old decorations', () => {
  const s = fresh(), b = block(5, 12);
  // the world says which tiles are field (here the left column is past the edge)
  const field = (idx) => idx % W !== 6;
  const r = L.mkTill(s, planOf(s, b, field));
  assert.strictEqual(r.till, 6);
  b.forEach((i) => assert.strictEqual(!!s.soil[i], field(i), 'tile ' + i));
  assert.strictEqual(r.energy, Math.floor(12 * 8 / 9));
  // an old bush of the map (a branch, as the axe clears it): paid the same, gone for good, not tilled
  const d = fresh(), idx = at(40, 3);
  const got = L.mkTill(d, [{ idx, clear: 'branch', deco: 1, till: 0 }]);
  assert.deepStrictEqual([got.clear, got.lumber, got.till], [1, 1, 0]);
  assert.ok(L.decoGone(d).includes(idx) && !d.debris[idx] && !d.soil[idx]);
  assert.strictEqual(L.mkTill(d, [{ idx, clear: 'branch', deco: 1 }]), 'none', 'once only');
  assert.strictEqual(L.mkTill(d, [{ idx: at(41, 3), clear: 'stump', deco: 1 }]), 'none', 'an old stump: the axe\'s');
});

test('the Tractor gives the farming XP of tilling by hand; the same farm tilled by hand and by Tractor comes out the same', () => {
  const run = (machine) => {
    const s = fresh(), b = block(8, 14);
    s.debris[b[2]] = 'weed'; s.debris[b[6]] = 'stone';
    s.sk2 = { farm: 100 };
    if (machine) L.mkTill(s, planOf(s, b));
    else L.skillAct(s, () => b.forEach((i) => { if (s.debris[i]) L.clearDebris(s, i); L.till(s, i); }));
    return s;
  };
  const a = run(false), m = run(true);
  assert.deepStrictEqual(plain(m.soil), plain(a.soil));
  assert.deepStrictEqual(plain(m.sk2), plain(a.sk2));
  assert.ok(m.sk2.farm > 100, 'XP for each tile tilled');
  assert.deepStrictEqual([m.lumber, m.stone], [a.lumber, a.stone]);
});

// ---------- the Seeder ----------
test('the Seeder: the seed bag on the 3x3 (one packet a pass); the packet you held last, else the first; partial blocks; sprinklers skipped', () => {
  const s = noCrops(fresh()), b = block(5, 12);
  s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'seed' ? null : x));
  assert.strictEqual(L.mkSeedSlot(s), -1);
  const tu = give(s, 'seed_turnip', 2), po = give(s, 'seed_potato', 2);
  assert.strictEqual(L.mkSeedSlot(s), tu, 'the first in the bag');
  assert.strictEqual(L.mkSeedSlot(s, 'seed_potato'), po, 'the one held last');
  assert.strictEqual(L.mkSeedSlot(s, 'seed_melon'), tu, 'held last but gone: the first');
  tilled(s, ...b.slice(0, 7));
  s.soil[b[1]].sp = 1;
  ripe(s, b[2]);
  assert.strictEqual(L.mkPlant(s, b, po), 5, 'the 5 tilled, empty tiles (not the sprinkler\'s, not the crop\'s, not untilled ones)');
  assert.strictEqual(L.countItem(s, 'seed_potato'), 1, 'one packet');
  assert.ok([0, 3, 4, 5, 6].every((j) => s.soil[b[j]].c === 'potato'));
  assert.strictEqual(s.soil[b[2]].c, 'turnip');
  assert.ok(!s.soil[b[1]].c && !s.soil[b[7]] && !s.soil[b[8]]);
  assert.strictEqual(L.mkPlant(s, b, po), 'nospace');
  assert.strictEqual(L.countItem(s, 'seed_potato'), 1, 'no space: no packet used');
  // a row of 9 with one packet
  const r = row(5, 20);
  tilled(s, ...r);
  assert.strictEqual(L.mkPlant(s, r, po), 9);
  assert.strictEqual(L.countItem(s, 'seed_potato'), 0);
});

test('the Seeder plants as the seed bag does: the season and the greenhouse (25% faster), sprinklers watering, farming XP', () => {
  const run = (machine) => {
    const s = fresh();
    s.sk2 = { farm: 0 };
    assert.strictEqual(L.buyYard(s, C.OUTDOOR.index.greenhouse, 1), 'ok');
    const FARM = L.farmInfo(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')));
    assert.strictEqual(L.placeYard(s, FARM, C.OUTDOOR.index.greenhouse, 24, 14), 0);
    const b = block(29, 15, -1, 0); // a column in the greenhouse, two out
    b.forEach((i) => L.till(s, i));
    const sp = at(30, 15); tilled(s, sp); L.placeSprinkler(s, sp, give(s, 'sprinkler_copper'));
    const slot = give(s, 'seed_melon', 1);
    const n = machine ? L.mkPlant(s, b, slot) : L.skillAct(s, () => L.plantBag(s, b, slot));
    return { s, n, b };
  };
  const a = run(false), m = run(true);
  assert.strictEqual(m.n, a.n);
  assert.deepStrictEqual(plain(m.s.soil), plain(a.s.soil));
  assert.deepStrictEqual(plain(m.s.sk2), plain(a.s.sk2));
  assert.ok(m.b.some((i) => L.inGreenhouse(m.s, i)) && m.b.some((i) => !L.inGreenhouse(m.s, i)));
  assert.ok(m.b.filter((i) => L.inGreenhouse(m.s, i)).every((i) => !L.needsWater(m.s.soil[i])), 'growing at once inside');
  assert.ok(m.s.sk2.farm > 0);
});

// ---------- the Harvester ----------
// a block of ripe crops dressed with every rule there is: fertilizer, a sprinkler, a golden one, crop stars, a skill
const dressed = () => {
  const s = noCrops(fresh()), b = block(12, 12);
  b.forEach((i) => ripe(s, i, 'tomato'));
  s.soil[b[0]].f = 2; s.soil[b[1]].f = 1;
  s.mast = { tomato: C.MASTERY.needs[0] - 2 }; // a star on the way
  s.sk2 = { farm: 1e7 }; // Farming 10: a chance of one more
  const sp = at(13, 11); tilled(s, sp); L.placeSprinkler(s, sp, give(s, 'sprinkler_copper'));
  return { s, b };
};
const findGolden = (s, b) => {
  for (let p = 0; p < 4000; p++) { b.forEach((i) => { s.soil[i].p = L.nowMin() - C.CROPS.tomato.mins - 1 - p; }); if (b.some((i) => L.goldenTile(s, i))) return true; }
  return false;
};
test('the Harvester picks as the hand does, every rule on each tile: quality, fertilizer used, golden crops, crop stars, a skill\'s extra, sprinklers', () => {
  const base = dressed();
  assert.ok(findGolden(base.s, base.b), 'a golden one among them');
  const qs = base.b.map((i) => L.cropGrade(base.s, i));
  assert.ok(qs.some((q) => q > 0), 'a Silver or Gold one among them: ' + qs);
  const run = (machine) => {
    const s = L.deserialize(plain(L.serialize(base.s)));
    s.sk2 = plain(base.s.sk2);
    L.takeNotes(); L.takeGolden(); L.takeFtNotes();
    fixRandom(7);
    const r = machine ? L.mkHarvest(s, base.b) : L.skillAct(s, () => base.b.map((i) => L.harvest(s, i)));
    return { s, r, notes: plain(L.takeNotes()), golden: plain(L.takeGolden()), ft: plain(L.takeFtNotes()) };
  };
  const a = run(false), m = run(true);
  assert.strictEqual(m.r.n, 9);
  assert.deepStrictEqual(plain(m.s.soil), plain(a.s.soil), 'the soil (fertilizer used up, re-wet by the sprinkler) the same');
  assert.deepStrictEqual(holds(m.s, 'tomato'), holds(a.s, 'tomato'), 'the same crops at the same qualities');
  assert.strictEqual(m.s.gold, a.s.gold, 'golden crops pay the same');
  assert.ok(m.golden.length >= 1 && m.golden.length === a.golden.length);
  assert.deepStrictEqual(plain(m.s.mast), plain(a.s.mast), 'crop stars count');
  assert.deepStrictEqual(m.notes, a.notes, 'a new crop star: the same note');
  assert.ok(m.notes.some((n) => n.kind === 'star'));
  assert.deepStrictEqual(plain(m.s.sk2), plain(a.s.sk2), 'farming XP');
  assert.strictEqual(m.ft.length, a.ft.length, 'the Silver and Gold notes');
  const sp = at(13, 11);
  const wet = L.sprinklerTiles(sp, 0).filter((i) => base.b.includes(i));
  assert.ok(wet.length && wet.every((i) => m.s.soil[i].w), 'the sprinkler\'s tiles wet again');
});

test('the Harvester: plain crops into the Silo while it has room, then the bag, then the basket; Silver and Gold keep their star in the bag', () => {
  const s = noCrops(fresh()), b = block(12, 12);
  b.forEach((i) => ripe(s, i, 'corn'));
  const q = b.map((i) => L.cropGrade(s, i)), plainN = q.filter((x) => !x).length;
  s.silo.c.corn = L.siloCap(s) - 2; // room for 2
  fixRandom(3);
  const r = L.mkHarvest(s, b);
  assert.strictEqual(r.n, 9);
  assert.strictEqual(L.siloCount(s), L.siloCap(s), 'the Silo filled');
  assert.strictEqual(r.silo, 2);
  const h = holds(s, 'corn');
  assert.strictEqual(h[1] + h[2], q.filter((x) => x).length, 'the stars in the bag');
  assert.ok(s.inv.some((x) => x && x.id === 'corn' && x.q), 'a starred slot');
  assert.ok(r.bag >= plainN - 2 + (9 - plainN));
  assert.strictEqual(h[0] + h[1] + h[2] - (L.siloCap(s) - 2), r.silo + r.bag + r.basket, 'every crop somewhere');
  // the bag full too: into the basket
  const t = noCrops(fresh()), b2 = block(20, 12);
  b2.forEach((i) => ripe(t, i, 'corn'));
  const plains = b2.filter((i) => !L.cropGrade(t, i));
  t.silo.c.wheat = L.siloCap(t);
  t.inv = t.inv.map((x) => x || { id: 'hoe', n: 1 });
  fixRandom(3);
  const r2 = L.mkHarvest(t, b2);
  assert.strictEqual(r2.n, plains.length, 'the plain ones picked into the basket');
  assert.strictEqual(r2.full, 9 - plains.length, 'a Silver or Gold one with no room in the bag stays ripe in the field');
  assert.ok(b2.filter((i) => L.cropGrade(t, i) > 0).every((i) => L.isRipe(t.soil[i])));
  assert.strictEqual(t.basket.corn, r2.basket);
  assert.ok(r2.basket >= plains.length);
});

test('never lost: with no room in the Silo, the bag or the basket a tile is not picked; what was picked is all somewhere', () => {
  const s = noCrops(fresh()), b = block(12, 12);
  b.forEach((i) => ripe(s, i, 'corn'));
  s.silo.c.wheat = L.siloCap(s);
  s.inv = s.inv.map((x) => x || { id: 'hoe', n: 1 });
  s.basket = { corn: 999 - 6 }; // room for one tile's most (6), not two
  const before = plain(s.soil);
  const r = L.mkHarvest(s, b);
  assert.strictEqual(r.n, 1, 'one tile');
  assert.ok(s.basket.corn <= 999);
  assert.strictEqual(Object.keys(before).filter((i) => s.soil[i] && L.isRipe(s.soil[i])).length, 9 - r.n, 'the rest still ripe in the field');
  assert.strictEqual(L.mkPick(s, b[8], null), '!full');
  // and over many random farms: crops in = crops picked (each tile's crop and its extras), nothing vanishes
  for (let seed = 1; seed <= 40; seed++) {
    const t = noCrops(fresh()), rnd = seeded(seed), tiles = row(5, 12 + (seed % 20), 1, 0);
    tiles.forEach((i) => { if (rnd() < 0.8) ripe(t, i, rnd() < 0.5 ? 'corn' : 'tomato'); if (rnd() < 0.3) t.soil[i] && (t.soil[i].f = 1 + Math.floor(rnd() * 2)); });
    t.silo.c.wheat = Math.floor(rnd() * L.siloCap(t));
    if (rnd() < 0.5) t.inv = t.inv.map((x) => x || (rnd() < 0.8 ? { id: 'hoe', n: 1 } : null));
    const was = ['corn', 'tomato'].map((id) => holds(t, id)), wasN = was.reduce((n, h) => n + h[0] + h[1] + h[2], 0);
    fixRandom(seed);
    const out = L.mkHarvest(t, tiles);
    const now = ['corn', 'tomato'].map((id) => holds(t, id)).reduce((n, h) => n + h[0] + h[1] + h[2], 0);
    assert.strictEqual(now - wasN, out.silo + out.bag + out.basket, 'farm ' + seed);
    assert.ok(now - wasN >= out.n, 'at least one a tile picked');
    assert.ok(Object.values(t.basket || {}).every((n) => n <= 999));
  }
});

test('the Harvester: mixed ripe, growing and withered; grass (the sickle\'s) left; the row of 9; the field\'s edge', () => {
  const s = noCrops(fresh()), r = row(3, 12, 1, 0);
  ripe(s, r[0]); ripe(s, r[2], 'corn'); ripe(s, r[8]);
  tilled(s, r[1]); s.soil[r[1]].c = 'turnip'; s.soil[r[1]].p = L.nowMin(); s.soil[r[1]].h = 1; // a seed
  tilled(s, r[3]); s.soil[r[3]].c = 'turnip'; s.soil[r[3]].p = L.nowMin() - 5000; s.soil[r[3]].h = 1; s.soil[r[3]].w = 1; // withered
  s.soil[r[4]] = { w: 1, c: 'grass', p: L.nowMin() - C.CROPS.grass.mins - 1, r: 0 };
  assert.ok(L.isRipe(s.soil[r[4]]));
  const out = L.mkHarvest(s, r);
  assert.deepStrictEqual(plain(out.picked), [r[0], r[2], r[8]]);
  assert.ok(s.soil[r[1]].c && L.isWithered(s.soil[r[3]]) && s.soil[r[4]].c === 'grass');
  // past the farm's last row: the tiles of a block that are not on the map are not there to pick
  const e = noCrops(fresh()), edge = block(10, FH - 1).filter((i) => i < W * FH);
  assert.strictEqual(edge.length, 3);
  edge.forEach((i) => ripe(e, i));
  assert.strictEqual(L.mkHarvest(e, edge).n, 3);
});

// ---------- the save ----------
test('the save: \'mk\' only when something is made, appended; old saves load unchanged with none; the generation stays 3', () => {
  assert.strictEqual(C.SAVE_GEN, 3);
  const s = fresh();
  assert.strictEqual(L.serialize(s).mk, undefined, 'nothing made: no key');
  mats(s, 'harvester');
  L.mkMake(s, 'harvester');
  L.mkTourTake(s);
  const o = plain(L.serialize(s));
  assert.strictEqual(o.mk, 4 | 8);
  assert.strictEqual(o.gg, 3);
  const back = roundTrip(s);
  assert.ok(L.mkMade(back, 'harvester') && !L.mkMade(back, 'tractor') && L.mkTourSeen(back) && L.hasItem(back, 'harvester'));
  // a broken number: only the known bits
  assert.strictEqual(L.deserialize(Object.assign(plain(o), { mk: 'x' })).mk, 0);
  assert.strictEqual(L.deserialize(Object.assign(plain(o), { mk: 1e9 })).mk, 15);
  // every old save in test/old-saves: no 'mk', loads with nothing made and writes no 'mk'
  const dir = path.join(__dirname, 'old-saves');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0);
  files.forEach((f) => {
    const old = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const save = old.state || old.save || old;
    if (!save || save.v !== C.SAVE_VERSION) return;
    assert.strictEqual(save.mk, undefined, f);
    const st = L.deserialize(plain(save));
    assert.ok(st, f + ' loads');
    assert.strictEqual(st.mk, 0, f);
    assert.strictEqual(L.serialize(st).mk, undefined, f);
  });
});
