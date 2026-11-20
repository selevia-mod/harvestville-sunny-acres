// Unit tests for driving the farm machines (owner, 20 Nov 2026: "Yes approve"; docs/superpowers/specs/2026-11-20-machines-
// drive-design.md; src/01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-machines.js): the strip across its way, the Tractor's energy
// paid as it goes (8/9 of the hand's over a whole drive, never more), the Harvester's tank (never more than it holds,
// never a crop lost), unloading at the Silo, the save (the tank, the driving tour) and old saves.
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
const MM = C.MACHINES, W = C.FARM_W;
const CM = vm.runInContext('Math', ctx);
const seeded = (seed) => { let r = seed; return () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; };
const random = CM.random, skillRnd = L.skillRnd;
const fixRandom = (seed) => { const f = seeded(seed); CM.random = f; L.skillRnd = f; };
test.after(() => { CM.random = random; L.skillRnd = skillRnd; });
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const at = (x, y) => y * W + x;
const fresh = () => {
  clock.set(2026, 11, 20, 10, 0);
  const s = L.newState(); s.seed = 11; s.gold = 1e6; s.lumber = 500; s.energy = 100; s.debris = {}; s.yard.items = [];
  L.takeNotes(); L.takeGolden(); L.takeFtNotes();
  return s;
};
const ripe = (s, idx, crop = 'corn') => { s.soil[idx] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0, h: 1 }; };
const noCrops = (s) => { s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'crop' ? null : x)); return s; };
const strip = (x, y, dx, dy) => L.mkStrip(x, y, dx, dy).map((p) => at(p[0], p[1]));
const inBag = (s, id, q = 0) => s.inv.reduce((a, x) => a + (x && x.id === id && (x.q || 0) === q ? x.n : 0), 0);

test('the numbers: speeds slower than walking, the Harvester slowest; a strip of 3; a tank of 60', () => {
  const D = MM.drive;
  assert.deepStrictEqual(plain(Object.keys(D)), plain(C.MACHINE_KINDS));
  assert.deepStrictEqual([D.harvester.speed, D.tractor.speed, D.seeder.speed], [0.6, 0.8, 0.85]);
  Object.keys(D).forEach((k) => {
    assert.ok(D[k].side >= 2.2 && D[k].side <= 3.5, k + ': about 3 tiles long');
    assert.ok(D[k].nose > 0 && D[k].tail > 0 && Math.abs(D[k].work) < D[k].side / 2 + 0.1, k + ': works under itself');
  });
  assert.ok(D.harvester.work > 0, 'the Harvester cuts in front (its header)');
  assert.ok(D.tractor.work < 0, 'the Tractor tills behind (its plough)');
  assert.ok(D.seeder.push > 0, 'the Seeder is pushed ahead of the farmer');
  assert.strictEqual(MM.strip, 3);
  assert.strictEqual(MM.tank, 60);
});

test('the strip: 3 tiles side by side across its way, the middle one where it is', () => {
  assert.deepStrictEqual(plain(L.mkStrip(10, 5, 1, 0)), [[10, 4], [10, 5], [10, 6]], 'going right: a column');
  assert.deepStrictEqual(plain(L.mkStrip(10, 5, -1, 0)), [[10, 6], [10, 5], [10, 4]], 'going left');
  assert.deepStrictEqual(plain(L.mkStrip(10, 5, 0, 1)), [[11, 5], [10, 5], [9, 5]], 'going down: a row');
  assert.deepStrictEqual(plain(L.mkStrip(10, 5, 0, -1)), [[9, 5], [10, 5], [11, 5]], 'going up');
});

test('the Tractor driven: energy paid as it goes, 8 of 9 by hand over a whole drive, never more, a point carried', () => {
  const s = fresh(), due = { c: 0 }, e0 = s.energy;
  let hand = 0, tiles = 0;
  for (let x = 6; x < 24; x++) {
    const plan = strip(x, 14, 1, 0).map((idx) => ({ idx, till: 1 }));
    hand += L.mkHandEnergy(s, { hoe: plan.length });
    const r = L.mkTill(s, plan, due);
    assert.ok(r && r.till === 3, 'column ' + x + ' tilled');
    tiles += r.till;
    assert.ok(due.c >= 0 && due.c < 1, 'what is carried is less than a point');
  }
  const spent = e0 - s.energy;
  assert.strictEqual(tiles, 54);
  assert.strictEqual(spent, Math.floor(hand * MM.save + 1e-9), 'the whole drive: 8/9 of the hand, rounded down once');
  assert.ok(spent < hand, 'never more than by hand');
  // the same strip worked as one tap would cost its own rounding (a strip of 3 alone: 2)
  const t = fresh(), r1 = L.mkTill(t, strip(30, 14, 1, 0).map((idx) => ({ idx, till: 1 })));
  assert.strictEqual(r1.energy, L.mkEnergy(t, { hoe: 3 }));
  // tired: nothing changes, nothing carried
  const u = fresh(); u.energy = 0;
  const due2 = { c: 0.5 };
  assert.strictEqual(L.mkTill(u, strip(8, 20, 1, 0).map((idx) => ({ idx, till: 1 })), due2), 'tired');
  assert.strictEqual(due2.c, 0.5);
  assert.ok(strip(8, 20, 1, 0).every((i) => !u.soil[i]), 'nothing tilled');
});

test('the tank: ripe crops in, never into the Silo or the bag as it cuts; full with no room for all a tile can give', () => {
  const s = noCrops(fresh()), silo0 = L.siloCount(s);
  const tiles = [];
  for (let y = 4; y < 30; y++) for (let x = 6; x < 9; x++) { const i = at(x, y); ripe(s, i); tiles.push(i); }
  fixRandom(5);
  let picked = 0, full = 0;
  const out = {};
  tiles.forEach((i) => { const g = L.mkTankPick(s, i, null, out); if (g === '!full') full++; else if (g[0] !== '!') picked++; });
  assert.ok(picked > 20, 'it cut ' + picked);
  assert.ok(full > 0, 'then it was full');
  assert.strictEqual(L.siloCount(s), silo0, 'nothing into the Silo');
  assert.strictEqual(inBag(s, 'corn') + inBag(s, 'corn', 1) + inBag(s, 'corn', 2), 0, 'nothing into the bag');
  const n = L.mkTankN(s);
  assert.strictEqual(n, out.n, 'all it gave is in the tank');
  assert.ok(n <= MM.tank && n > MM.tank - MM.most, 'full: ' + n + ' of ' + MM.tank);
  assert.ok(L.mkTankFull(s));
  assert.strictEqual(tiles.filter((i) => L.isRipe(s.soil[i])).length, tiles.length - picked, 'what it did not cut stays ripe in the field');
  // a sickle crop and an unripe one: left
  const t = fresh(), a = at(40, 10), b = at(41, 10);
  const sick = Object.keys(C.CROPS).find((k) => C.CROPS[k].sickle);
  if (sick) { ripe(t, a, sick); assert.strictEqual(L.mkTankPick(t, a), '!notripe'); }
  t.soil[b] = { w: 1, c: 'corn', p: L.nowMin(), r: 0, h: 1 };
  assert.strictEqual(L.mkTankPick(t, b), '!notripe');
  assert.strictEqual(L.mkTankN(t), 0);
});

test('unloading at the Silo: plain crops into the Silo, Silver and Gold into the bag, what has no room stays in the tank', () => {
  const s = noCrops(fresh());
  s.mkTank = [['corn', 0, 30], ['corn', 1, 4], ['tomato', 2, 2]];
  s.silo.c = {};
  s.silo.c.wheat = L.siloCap(s) - 20; // room for 20
  const r = L.mkUnload(s);
  assert.deepStrictEqual(plain(r), { silo: 20, bag: 6, left: 10 });
  assert.strictEqual(s.silo.c.corn, 20);
  assert.strictEqual(inBag(s, 'corn', 1), 4);
  assert.strictEqual(inBag(s, 'tomato', 2), 2);
  assert.deepStrictEqual(plain(s.mkTank), [['corn', 0, 10]], 'the rest waits in the tank');
  // the bag full: the starred ones wait too
  const t = noCrops(fresh());
  t.inv = t.inv.map((x) => x || { id: 'hoe', n: 1 });
  t.mkTank = [['corn', 1, 3]];
  assert.deepStrictEqual(plain(L.mkUnload(t)), { silo: 0, bag: 0, left: 3 });
  assert.deepStrictEqual(plain(t.mkTank), [['corn', 1, 3]]);
  // nothing in it
  const u = fresh();
  assert.deepStrictEqual(plain(L.mkUnload(u)), { silo: 0, bag: 0, left: 0 });
});

test('the save: the tank kept exactly (key mkt, only when not empty), the driving tour bit, bad rows dropped, old saves load', () => {
  const s = fresh();
  assert.ok(!('mkt' in plain(L.serialize(s))), 'an empty tank writes nothing');
  s.mkTank = [['corn', 0, 12], ['corn', 2, 1], ['tomato', 0, 3]];
  s.mk = 1 | 4;
  L.mkDriveTourTake(s);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.mkTank), plain(s.mkTank));
  assert.ok(L.mkDriveTourSeen(back) && !L.mkTourSeen(back), 'the driving tour seen, the Forge tour not');
  assert.ok(L.mkMade(back, 'tractor') && L.mkMade(back, 'harvester') && !L.mkMade(back, 'seeder'));
  // the Forge's tour tells of driving: both seen
  const t = fresh(); L.mkTourTake(t);
  assert.ok(L.mkTourSeen(t) && L.mkDriveTourSeen(t));
  // bad rows
  const o = plain(L.serialize(fresh()));
  o.mkt = [['corn', 0, 5], ['nope_item', 0, 3], ['corn', 9, 2], ['corn', 0, -4], 'x', ['tomato', 1, 1e9], ['__proto__', 0, 1]];
  const b = L.deserialize(o);
  assert.deepStrictEqual(plain(b.mkTank), [['corn', 0, 5], ['corn', 3, 2], ['tomato', 1, 999]]);
  // an old save: no tank, its mk bits as they were
  const old = plain(L.serialize(fresh())); delete old.mkt; old.mk = 15;
  const ob = L.deserialize(old);
  assert.deepStrictEqual(plain(ob.mkTank), []);
  assert.strictEqual(ob.mk, 15);
  assert.ok(!L.mkDriveTourSeen(ob), 'an old player sees the driving tour once');
});
