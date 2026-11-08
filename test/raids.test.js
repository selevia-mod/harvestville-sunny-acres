// Farm Raids, step 1 (owner, 9 Nov 2026; docs/raids.md): the rules and the battle.
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
const R = C.RAID;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const rich = () => { const s = L.newState(); s.gold = 1e6; return s; };

test('8 raiders, 10 defenses, 5 bandit farms; every raider opens at some camp level', () => {
  assert.strictEqual(R.raiderOrder.length, 8);
  assert.strictEqual(R.defenseOrder.length, 10);
  assert.strictEqual(R.bandits.length, 5);
  const opened = [].concat(...R.camp.levels.map((l) => l.open));
  assert.deepStrictEqual(plain(opened.slice().sort()), plain(R.raiderOrder.slice().sort()));
});

test('the Raid Camp: bought, then levelled; it opens raiders and makes room; training takes time; levels cost Gold and a hunt', () => {
  const s = rich(), now = 1e6;
  assert.strictEqual(L.trainRaider(s, 'goat', now), 'locked', 'no camp yet');
  assert.strictEqual(L.campUpgrade(s), 'ok');
  assert.strictEqual(s.gold, 1e6 - R.camp.price);
  assert.strictEqual(L.trainRaider(s, 'cat', now), 'locked', 'the cat at camp level 2');
  for (let i = 0; i < 10; i++) assert.strictEqual(L.trainRaider(s, 'goat', now), 'ok');
  assert.strictEqual(L.trainRaider(s, 'goat', now), 'space', '10 places at level 1');
  assert.strictEqual(L.trainDone(s, now + 20000), 1, 'one goat ready after 20 s');
  assert.strictEqual(L.trainDone(s, now + 200000), 9);
  assert.strictEqual(s.raid.army.goat, 10);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'need', 'level 2 needs rabbit fur');
  L.addItem(s, 'fur_rabbit', 3);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'ok');
  assert.strictEqual(L.raiderLv(s, 'goat'), 2);
  assert.strictEqual(L.defenseUp(s, 'dog'), 'ok');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain([back.raid.camp, back.raid.army, back.raid.lv, back.raid.dlv]), plain([1, { goat: 10 }, { goat: 2 }, { dog: 2 }]));
  assert.ok(L.farmPower(back) > 0);
});

test('the loot cap by power (owner): 10% to 30%, 20% for the same', () => {
  assert.strictEqual(L.lootCap(100, 100), 0.2);
  assert.strictEqual(L.lootCap(100, 150), 0.3);
  assert.strictEqual(L.lootCap(100, 400), 0.3);
  assert.ok(Math.abs(L.lootCap(100, 125) - 0.25) < 1e-9);
  assert.ok(Math.abs(L.lootCap(150, 100) - 0.1) < 1e-9);
  assert.ok(L.lootCap(120, 100) > 0.1 && L.lootCap(120, 100) < 0.2);
});

test('a bandit farm: the same from the same seed; loot, fences round the field and pen, its defenses', () => {
  const b = R.bandits[4], a = L.banditFarm(b, 7), c = L.banditFarm(b, 7);
  assert.deepStrictEqual(plain(a), plain(c));
  assert.ok(a.loot.some((p) => p.kind === 'gold') && a.loot.some((p) => p.kind === 'crops') && a.loot.some((p) => p.kind === 'produce'));
  ['dog', 'scarecrow', 'goose', 'tower', 'kampana'].forEach((k) => assert.ok(a.defs.some((d) => d.t === k), k));
  const cells = new Set(a.defs.map((d) => d.x + ',' + d.y).concat(a.loot.map((p) => p.x + ',' + p.y)));
  assert.strictEqual(cells.size, a.defs.length + a.loot.length, 'nothing on top of anything');
});

test('a battle: raiders from the edge only; goats eat crops; the same moves give the same battle (the server can check it)', () => {
  const farm = L.banditFarm(R.bandits[0], 3), army = { goat: { n: 10, lv: 1 }, crow: { n: 5, lv: 1 } };
  const b = L.raidStart(farm, army, 42);
  assert.strictEqual(L.raidDrop(b, 'goat', 10, 10), null, 'not in the middle');
  for (let i = 0; i < 6; i++) L.raidDrop(b, 'goat', 0, 8 + i);
  let n = 0;
  while (!b.end) { if (n === 30) for (let i = 0; i < 5; i++) L.raidDrop(b, 'crow', 1, 2 + i); L.raidStep(b); n++; }
  assert.ok(b.taken.crops > 0, 'crops were eaten');
  assert.ok(['time', 'gone', 'all'].includes(b.end));
  const again = L.raidReplay(farm, army, 42, b.moves);
  assert.deepStrictEqual(plain([again.taken, again.end, again.t]), plain([b.taken, b.end, b.t]), 'replayed: the same');
  assert.ok(L.raidStars(b) >= 0 && L.raidStars(b) <= 3);
});

test('weak to: the scarecrow scares crows away; the dog beats the cat; a mud pit holds a boar', () => {
  const one = (defs, k, lv) => { const farm = { w: 26, h: 20, defs, loot: [{ kind: 'crops', x: 6, y: 10, n: 50 }, { kind: 'produce', x: 6, y: 10, n: 50 }] }; const b = L.raidStart(farm, { [k]: { n: 1, lv: lv || 1 } }, 1); L.raidDrop(b, k, 0, 10); for (let i = 0; i < 200 && !b.end; i++) L.raidStep(b); return b; };
  const free = one([], 'crow'), guarded = one([{ t: 'scarecrow', x: 5, y: 10, lv: 1 }], 'crow');
  assert.ok((guarded.taken.crops || 0) < (free.taken.crops || 0), 'less with a scarecrow');
  assert.ok(guarded.events.some((e) => e[1] === 'scared'));
  const cat = one([{ t: 'dog', x: 5, y: 10, lv: 1 }], 'cat');
  assert.ok(cat.events.some((e) => e[1] === 'gone'), 'the dog caught the cat');
  const boar = one([{ t: 'mudpit', x: 3, y: 10, lv: 1 }], 'boar');
  assert.ok(boar.events.some((e) => e[1] === 'stuck'));
});

test('practice: the prize comes from the game; first stars count more; the next bandit farm opens with a star', () => {
  const s = rich();
  assert.ok(L.banditOpen(s, 0) && !L.banditOpen(s, 1));
  const farm = L.banditFarm(R.bandits[0], 1), b = L.raidStart(farm, { goat: { n: 10, lv: 1 } }, 1);
  for (let i = 0; i < 10; i++) L.raidDrop(b, 'goat', 0, 5 + i);
  while (!b.end) L.raidStep(b);
  const gold = s.gold, r = L.banditPrize(s, 'b1', b);
  assert.strictEqual(s.gold, gold + r.gold);
  if (r.stars) assert.ok(L.banditOpen(s, 1));
  assert.strictEqual(roundTrip(s).raid.pts, r.pts);
});
