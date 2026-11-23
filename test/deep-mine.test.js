// The deep Mine, floor 1,201 and down (src/01-logicZ...-deep-mine.js; the world: src/19z...-deep-mine.js; the swings:
// src/14-actions.js): the rocks' and the critters' curves by floor, no energy cost added anywhere, the gem chances and a
// gold-per-hour simulation of the deepest player, ore and gem sales counting toward "earned" once, the tiny animals'
// Giant medals (src/01-logicZ...-tiny-giants.js: never one taken away), and old saves. The same rules without the deep Mine (`OLD`: every file but its own)
// are loaded beside them to compare.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const DEEP = /(deep-mine|tiny-giants)\.js$/;
const load = (skipDeep) => {
  const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error } };
  vm.createContext(ctx);
  fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f) && !(skipDeep && DEEP.test(f))).sort()
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
  const clock = require('./clock')(ctx);
  ctx.window.Farm.Logic.weather = () => 'sunny';
  return { C: ctx.window.Farm.Config, L: ctx.window.Farm.Logic, clock };
};
const NEW = load(false), OLD = load(true);
const { C, L, clock } = NEW;
const plain = (x) => JSON.parse(JSON.stringify(x));
const fresh = (W = NEW, hammer = 3) => { W.clock.set(2026, 11, 18, 10, 0); const s = W.L.newState(); s.seed = 7; s.tools.hammer = hammer; return s; };
const FLOORS = [1, 200, 1000, 1200, 1201, 1250, 1300, 1500, 2000, 2252, 2500, 2701, 3000, 9000];

test('the tiers: none to floor 1,200, one more every 100 floors, the deepest from 2,701', () => {
  assert.deepStrictEqual([1, 1200, 1201, 1300, 1301, 2000, 2252, 2500, 2700, 2701, 3000, 1e6].map(L.deepTier), [0, 0, 1, 1, 2, 8, 11, 13, 15, 15, 15, 15]);
});

test('the rocks: one swing to floor 1,200; deeper, more, fewer with a better hammer, capped', () => {
  const avg = (lvl, f) => L.rockHitsAvg(fresh(NEW, lvl), f);
  const table = [1200, 1250, 1500, 2000, 2252, 2500, 3000].map((f) => [f].concat([0, 1, 2, 3].map((l) => +avg(l, f).toFixed(2))));
  console.log('[deep mine] average swings a rock (floor, Basic, Copper, Silver, Gold):', JSON.stringify(table));
  assert.deepStrictEqual(table, [
    [1200, 1, 1, 1, 1], [1250, 1.5, 1.35, 1.25, 1.15], [1500, 2.5, 2.05, 1.75, 1.45], [2000, 5, 3.8, 3, 2.2],
    [2252, 6.5, 4.85, 3.75, 2.65], [2500, 7.5, 5.55, 4.25, 2.95], [3000, 8.5, 6.25, 4.75, 3.25]]);
  for (let l = 0; l < 4; l++) {
    let prev = 0;
    for (let f = 1100; f <= 4000; f += 50) { const a = avg(l, f); assert.ok(a >= prev, 'never easier deeper'); prev = a; }
  }
  // each rock: a whole number, the floor or the ceiling of the average, the same on every phone, averaging out right
  const s = fresh(NEW, 3);
  let sum = 0, n = 0, most = 0;
  for (let idx = 0; idx < 4000; idx++) { const h = L.rockHitsAt(s, 2252, idx); assert.ok(h === 3 || h === 2); assert.strictEqual(h, L.rockHitsAt(s, 2252, idx)); sum += h; n++; }
  assert.ok(Math.abs(sum / n - 2.65) < 0.03, 'average ' + sum / n);
  for (let f = 1; f <= 9000; f += 37) for (let idx = 0; idx < 30; idx++) most = Math.max(most, L.rockHitsAt(fresh(NEW, 3), f, idx));
  assert.strictEqual(most, 4, 'the Gold Hammer never needs more than 4 swings');
  for (let f = 1; f <= 1200; f += 7) assert.strictEqual(L.rockHitsAt(fresh(NEW, 0), f, f), 1, 'the first 1,200 floors are as they were');
  assert.strictEqual(Math.max(...Array.from({ length: 200 }, (_, i) => L.rockHitsAt(fresh(NEW, 0), 9000, i))), 9, 'and the Basic Hammer at most 9');
});

test('the critters: from floor 1,201, more bonks and a little dearer charge each tier, never past the caves\' own monsters', () => {
  const rows = [1200, 1250, 1500, 2000, 2252, 3000].map((f) => [f, L.critterCount(f), L.critterKinds(f).map((k) => k + ' ' + L.critterHp(k, f) + '/' + L.critterHit(k, f)).join(', ')]);
  console.log('[deep mine] critters (floor, how many out, kind bonks/energy a charge):', JSON.stringify(rows));
  assert.deepStrictEqual(rows, [
    [1200, 0, ''], [1250, 1, 'mole 3/6'], [1500, 1, 'mole 4/7, bat 3/6'], [2000, 2, 'mole 7/8, bat 6/7, piglet 8/11'],
    [2252, 3, 'mole 8/9, bat 7/7, piglet 9/12'], [3000, 3, 'mole 10/10, bat 9/8, piglet 11/13']]);
  const biggest = Math.max(...Object.values(C.WILD.animals).map((d) => d.hit || 0));
  for (const k of C.MINE.deep.critterOrder) {
    let hp = 0, hit = 0;
    for (let f = 1201; f <= 6000; f += 100) {
      assert.ok(L.critterHp(k, f) >= hp && L.critterHit(k, f) >= hit);
      hp = L.critterHp(k, f); hit = L.critterHit(k, f);
    }
    assert.ok(hit <= 13 && hit < biggest, k + ': a charge at most 13 (the caves\' own monsters hit up to ' + biggest + ')');
  }
  // a dish's power halves a charge, as for every cave monster
  const s = fresh();
  const full = L.critterLoss(s, 'piglet', 2252);
  s.pw = s.pw || {};
  const was = L.power;
  L.power = (st, key) => key === 'charge';
  assert.strictEqual(L.critterLoss(s, 'piglet', 2252), Math.ceil(full / 2));
  L.power = was;
  assert.strictEqual(L.critterDrop(2252), 'obsidian', 'a bonked critter leaves the cave\'s plainest ore');
});

test('no energy cost added anywhere: the same energy a rock and a tool swing as before, a rock paid once however many swings', () => {
  for (const lvl of [0, 1, 2, 3]) for (const f of FLOORS.concat([4000, 2253])) {
    assert.strictEqual(L.mineEnergy(fresh(NEW, lvl), f), OLD.L.mineEnergy(fresh(OLD, lvl), f), 'rock energy, floor ' + f);
  }
  for (const tool of ['hoe', 'can', 'axe', 'hammer', 'sickle']) for (const n of [1, 3, 9]) assert.strictEqual(L.toolEnergy(fresh(), tool, n), OLD.L.toolEnergy(fresh(OLD), tool, n));
  assert.strictEqual(L.maxEnergy(fresh()), OLD.L.maxEnergy(fresh(OLD)));
  // a 4-swing rock: three free cracks, then the rock's energy once
  const s = fresh(NEW, 0), cracks = {}, hits = 4;
  let spent = 0, broke = 0;
  for (let i = 0; i < hits; i++) { const b = L.strikeRock(cracks, 12, hits); spent += L.rockSwingEnergy(s, 2252, b ? 1 : 0); broke += b ? 1 : 0; }
  assert.strictEqual(broke, 1);
  assert.strictEqual(spent, L.mineEnergy(s, 2252));
  assert.deepStrictEqual(plain(cracks), {}, 'a broken rock is forgotten');
  // the world: energy only on the swing that breaks; bonking a critter never touches energy; only a charge does
  const act = fs.readFileSync(path.join(SRC, '14-actions.js'), 'utf8');
  assert.match(act, /L\.rockSwingEnergy\(s, F\.session\.mineFloor, breaking\)/);
  const world = fs.readFileSync(path.join(SRC, fs.readdirSync(SRC).find((f) => /^19.*deep-mine\.js$/.test(f))), 'utf8');
  const bonk = world.slice(world.indexOf('P.deepBonk'), world.indexOf('var resolve'));
  assert.doesNotMatch(bonk, /energy/, 'a bonk is free');
  assert.strictEqual((world.match(/s\.energy = /g) || []).length, 1, 'one place takes energy: a charge that reaches you (deepHit)');
});

// ---------- the gems and the gold per hour ----------
// The deepest player (floor 2,252) sells about 2.9M gold a day of Star Core gems: at 1,368 gold a rock, about 2,120
// rocks a day. A rock costs 453 energy there, so this is mining on Power-Ups (no energy for 2 hours): about 1,060 rocks
// an hour, 3.4 s a rock. A model of those 3.4 s with the Gold Hammer: a charged swing (3 x 450 ms held, the swing, the
// next press: about 1.7 s) hits about 3 rocks, so 0.57 s of swinging a rock and 2.83 s of the rest (walking, picking
// up, the ladder). Tough rocks add 0.57 s for each extra swing; a critter is about 2 s to reach and 0.45 s a bonk.
const W = 2.83, S = 0.57, BONK = 0.45, REACH = 2, ROCKS = 42; // (a floor: 132 tiles, about 32% rocks)
const goldHour = (Wd, f, lvl = 3) => {
  const v = Wd.L.rockValue ? Wd.L.rockValue(f) : null;
  const value = v != null ? v : (() => { let g = 0; for (let i = 0; i < 4000; i++) { const id = Wd.L.mineDrop(f, (i + 0.5) / 4000); if (id && id !== 'stone') g += Wd.C.ITEMS[id].sell; } return g / 4000; })();
  const hits = Wd.L.rockHitsAvg ? Wd.L.rockHitsAvg(fresh(Wd, lvl), f) : 1;
  let secs = ROCKS * (W + S * hits), gold = ROCKS * value;
  const kinds = Wd.L.critterKinds ? Wd.L.critterKinds(f) : [];
  if (kinds.length) { // (every critter bonked down: it takes longer than a rock for about a rock's ore)
    const n = Wd.L.critterCount(f), hp = kinds.reduce((a, k) => a + Wd.L.critterHp(k, f), 0) / kinds.length;
    secs += n * (REACH + BONK * hp);
    gold += n * Wd.C.ITEMS[Wd.L.critterDrop(f)].sell;
  }
  return { value: Math.round(value), hits: +hits.toFixed(2), perHour: Math.round(gold / secs * 3600) };
};

test('the gems: a little more Starstone and Diamond each tier, out of the empty rolls, capped; floors to 1,200 unchanged', () => {
  for (let f = 1; f <= 1200; f += 13) for (let i = 0; i < 200; i++) { const r = (i + 0.5) / 200; assert.strictEqual(L.mineDrop(f, r), OLD.L.mineDrop(f, r)); }
  const p = (f) => plain(L.deepOdds(f).map((x) => +x.toFixed(4)));
  assert.deepStrictEqual(p(1250), [0.4, 0.22, 0.14, 0.082, 0.0315]);
  assert.deepStrictEqual(p(2252), [0.4, 0.22, 0.14, 0.102, 0.0465]);
  assert.deepStrictEqual(p(3000), [0.4, 0.22, 0.14, 0.11, 0.0525], 'the cap: Starstone 11% (was 8), Diamond 5.25% (was 3)');
  assert.deepStrictEqual(p(9000), p(3000));
  assert.ok(L.deepOdds(1e6).reduce((a, b) => a + b, 0) < 1, 'some rolls still hold nothing');
  assert.strictEqual(L.mineDrop(2252, 0.95), null);
  assert.strictEqual(L.mineDrop(2252, 0.9), 'diamond');
});

test('gold per hour of the deepest player (Gold Hammer, on Power-Ups): about the same or a little lower, never higher', () => {
  const rows = {};
  for (const f of [1200, 2000, 2252, 3000]) {
    const b = goldHour(OLD, f), a = goldHour(NEW, f);
    rows[f] = { before: b.perHour, after: a.perHour, change: +((a.perHour / b.perHour - 1) * 100).toFixed(1), rockBefore: b.value, rockAfter: a.value, swings: a.hits };
  }
  console.log('[deep mine] gold an hour (model: 3.4 s a rock today, Gold Hammer):', JSON.stringify(rows));
  assert.strictEqual(rows[1200].change, 0);
  for (const f of [2000, 2252, 3000]) assert.ok(rows[f].change <= 0 && rows[f].change >= -10, f + ': ' + rows[f].change + '%');
  assert.ok(Math.abs(rows[2252].before - 2.9e6 / 2) / 1.45e6 < 0.05, 'the model matches the live player: ' + rows[2252].before);
  // energy-bound mining (no Power-Up): a rock costs what it did, so its better gems pay more gold for the same energy
  const e = (Wd) => Math.round(goldHour(Wd, 2252).value / Wd.L.mineEnergy(fresh(Wd), 2252) * 100);
  console.log('[deep mine] gold per 100 energy at floor 2,252 (no Power-Up): before', e(OLD), 'after', e(NEW));
  // the slower hammers lose more time: an upgrade is worth it
  const basic = goldHour(NEW, 2252, 0).perHour, gold = goldHour(NEW, 2252, 3).perHour;
  assert.ok(basic < gold * 0.75, 'Basic ' + basic + ' vs Gold ' + gold);
});

// ---------- selling ores and gems counts toward "earned", once ----------
test('ores and gems sold at the stall, to Saffron and in the shipping box add to earned exactly once (the Trading Post does not buy them)', () => {
  for (const id of ['ore_copper', 'ore_gold', 'gem', 'obsidian', 'starstone', 'diamond']) {
    const s = fresh(), slot = () => s.inv.findIndex((x) => x && x.id === id);
    const check = (what, fn) => {
      const g0 = s.gold, e0 = s.stats.earned;
      const r = fn();
      assert.ok(s.gold > g0, id + ' ' + what + ' pays');
      assert.strictEqual(s.stats.earned - e0, s.gold - g0, id + ' ' + what + ': earned = gold, once');
      return r;
    };
    L.addItem(s, id, 12);
    check('sell now', () => L.sellNow(s, slot(), 2));
    check('a stall lot, collected', () => { assert.strictEqual(L.listItem(s, 0, slot(), 2, 1), 'ok'); L.sellLot(s, 0, null); return L.collectStand(s); });
    assert.ok(C.TRADER.buys.includes(id), 'Saffron buys ' + id);
    check('Saffron', () => L.traderSell(s, id, 2));
    if (L.txSell) assert.deepStrictEqual(plain(L.txSell(s, id, 1)), { why: 'item' }, 'Mang Danny buys only the Mixer\'s goods');
    L.ship(s, slot());
    check('the shipping box', () => clock.nextDay(L, s));
  }
});

// ---------- the tiny animals' Giant medals ----------
const areaOf = (kind) => Object.keys(C.WILD.areas).find((a) => (C.WILD.areas[a].animals || {})[kind] || (C.WILD.areas[a].extra || []).some((x) => x.kind === kind));
const giantMedal = (kind) => C.MEDALS.find((m) => m.kind === 'giant' && m.animal === kind);
test('Giant medals of the tiny animals come only with a real giant; a medal already given stays; the others as before', () => {
  const tiny = C.MEDALS.filter((m) => m.kind === 'giant' && L.tinyGiant(m.animal)).map((m) => m.animal).sort();
  assert.deepStrictEqual(plain(tiny), ['kuwago', 'paniki', 'pugo', 'tikling', 'tuko']);
  for (const kind of tiny) {
    const s = fresh(), m = giantMedal(kind), area = areaOf(kind);
    assert.ok(area, kind + ' lives somewhere');
    // before the fix the biggest ordinary one already made the giant mark: on the OLD rules it gives the medal
    const o = fresh(OLD);
    OLD.L.hunted(o, area, 0, kind, 1.099);
    // (the Kuwago, 0.5 kg, sat right on the edge: its biggest ordinary one, 0.549 kg, read 0.5 and missed the 0.6 mark by a
    // rounding; any change in how it is weighed would have tipped it, so it waits for a real giant too)
    if (kind !== 'kuwago') assert.ok(o.medals[m.code], kind + ': the old rules gave it for an ordinary one');
    for (const size of [0.9, 1, 1.099]) L.hunted(s, area, 0, kind, size);
    L.medalCheck(s);
    assert.ok(!s.medals[m.code], kind + ': no Giant medal for ordinary ones');
    const r = L.hunted(s, area, 1, kind, 1.3);
    assert.ok(s.medals[m.code] === s.day, kind + ': a real giant gives it');
    assert.ok(r.medals.some((x) => x.code === m.code), 'and says so');
    assert.ok(!L.hunted(s, area, 2, kind, 1.3).medals.some((x) => x.code === m.code), 'once');
  }
  // never taken away: a farm that has it (from before) keeps it through a load, a check and more hunts
  const s = fresh();
  s.medals = { [giantMedal('pugo').code]: s.day - 30 };
  const back = L.deserialize(plain(L.serialize(s)));
  L.medalCheck(back);
  L.hunted(back, areaOf('pugo'), 0, 'pugo', 1);
  assert.strictEqual(back.medals[giantMedal('pugo').code], s.day - 30);
  // a bigger animal still gets its Giant from its weight, as before
  const b = fresh(), boar = giantMedal('boar') ? 'boar' : 'rabbit';
  L.hunted(b, areaOf(boar), 0, boar, 1.3);
  assert.ok(b.medals[giantMedal(boar).code], boar + ' giant by weight');
  assert.strictEqual(L.tinyGiant(boar), false);
});

// ---------- saves ----------
test('nothing new is saved: the same save keys as before, generation 3, old saves load the same', () => {
  // (the security check's keys, 23 Nov 2026, are new on purpose: 'mr' the stall's record, 'ps' things on their way;
  // the deep Mine itself still adds none)
  const NEW = ['mr', 'ps'], bare = (o) => { NEW.forEach((k) => delete o[k]); return o; };
  const a = bare(L.serialize(fresh())), b = bare(OLD.L.serialize(fresh(OLD)));
  assert.deepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort());
  assert.strictEqual(a.gg, 3);
  const dir = path.join(__dirname, 'old-saves');
  fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), save = raw.save || raw;
    const x = plain(L.serialize(L.deserialize(plain(save)))), y = plain(OLD.L.serialize(OLD.L.deserialize(plain(save))));
    delete x.t; delete y.t; // (when it was written)
    bare(x); bare(y);
    assert.deepStrictEqual(x, y, f + ' loads exactly as without the deep Mine');
  });
});
