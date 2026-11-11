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
const R = C.FRAID;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
// (farm economy v2: raiders eat crops, from the Silo first; camp and defense levels need the Mixer's materials)
const rich = () => {
  const s = L.newState();
  s.gold = 1e6;
  R.raiderOrder.forEach((k) => L.siloPut(s, R.raiders[k].crop[0], 30));
  ['farm_cement', 'rope', 'sili_powder', 'beeswax'].forEach((id) => L.addItem(s, id, 99));
  return s;
};

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
  assert.strictEqual(s.fr.army.goat, 10);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'need', 'level 2 needs rabbit fur');
  L.addItem(s, 'fur_rabbit', 3);
  assert.strictEqual(L.raiderUp(s, 'goat'), 'ok');
  assert.strictEqual(L.raiderLv(s, 'goat'), 2);
  assert.strictEqual(L.defenseUp(s, 'dog'), 'ok');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain([back.fr.camp, back.fr.army, back.fr.lv, back.fr.dlv]), plain([1, { goat: 10 }, { goat: 2 }, { dog: 2 }]));
  assert.ok(L.farmPower(back) > 0);
});

// owner, 9 Nov 2026: "Upgrading camp is too easy, i was camp 7 instant"
test('a camp level needs Gold, lumber, stone, things from hunting and building time; one at a time; it trains while it builds; kept in the save', () => {
  const s = rich(), t0 = 5e9;
  s.lumber = 0; s.stone = 0;
  assert.strictEqual(L.campUpgrade(s, t0), 'ok', 'level 1: bought at once');
  assert.strictEqual(s.fr.camp, 1);
  assert.strictEqual(L.campUpgrade(s, t0), 'lumber', 'level 2 needs lumber');
  s.lumber = 1000;
  assert.strictEqual(L.campUpgrade(s, t0), 'stone', 'and stone');
  s.stone = 1000;
  const g = s.gold;
  assert.strictEqual(L.campUpgrade(s, t0), 'ok');
  assert.strictEqual(s.fr.camp, 1, 'not yet: it builds');
  assert.deepStrictEqual([g - s.gold, 1000 - s.lumber, 1000 - s.stone], [4000, 40, 20]);
  assert.strictEqual(L.campUpgrade(s, t0 + 1000), 'busy', 'one upgrade at a time');
  assert.strictEqual(L.trainRaider(s, 'goat', t0 + 1000), 'ok', 'it trains while it builds (owner, 10 Nov 2026)');
  const back = roundTrip(s);
  assert.strictEqual(back.fr.up, t0 + 30 * 60000, 'the build time is saved');
  assert.strictEqual(L.campDone(back, t0 + 29 * 60000) > 0, true, 'still building at 29 minutes');
  assert.strictEqual(L.campDone(back, t0 + 30 * 60000), 0);
  assert.strictEqual(back.fr.camp, 2, 'level 2 after 30 minutes');
  assert.strictEqual(L.trainRaider(back, 'cat', t0 + 31 * 60000), 'ok', 'the cat opens at level 2');
  // level 4 needs rabbit fur; level 7 a mammoth tusk and a whole day
  back.fr.camp = 3;
  assert.strictEqual(L.campUpgrade(back, t0 + 40 * 60000), 'need');
  assert.deepStrictEqual(plain(R.camp.levels.map((l) => l.mins || 0)), [0, 30, 120, 240, 480, 720, 1440]);
  assert.deepStrictEqual(plain(R.camp.levels[6].need), ['tusk_mammoth', 1]);
});

test('the loot cap by power (owner): 10% to 30%, 20% for the same', () => {
  assert.strictEqual(L.frLootCap(100, 100), 0.2);
  assert.strictEqual(L.frLootCap(100, 150), 0.3);
  assert.strictEqual(L.frLootCap(100, 400), 0.3);
  assert.ok(Math.abs(L.frLootCap(100, 125) - 0.25) < 1e-9);
  assert.ok(Math.abs(L.frLootCap(150, 100) - 0.1) < 1e-9);
  assert.ok(L.frLootCap(120, 100) > 0.1 && L.frLootCap(120, 100) < 0.2);
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
  const b = L.frStart(farm, army, 42);
  assert.strictEqual(L.frDrop(b, 'goat', 10, 10), null, 'not in the middle');
  for (let i = 0; i < 6; i++) L.frDrop(b, 'goat', 0, 8 + i);
  let n = 0;
  while (!b.end) { if (n === 30) for (let i = 0; i < 5; i++) L.frDrop(b, 'crow', 1, 2 + i); L.frStep(b); n++; }
  assert.ok(b.taken.crops > 0, 'crops were eaten');
  assert.ok(['time', 'gone', 'all'].includes(b.end));
  const again = L.frReplay(farm, army, 42, b.moves);
  assert.deepStrictEqual(plain([again.taken, again.end, again.t]), plain([b.taken, b.end, b.t]), 'replayed: the same');
  assert.ok(L.frStars(b) >= 0 && L.frStars(b) <= 3);
});

test('weak to: the scarecrow scares crows away; the dog beats the cat; a mud pit holds a boar', () => {
  const one = (defs, k, lv) => { const farm = { w: 16, h: 22, defs, loot: [{ kind: 'crops', x: 6, y: 10, n: 50 }, { kind: 'produce', x: 6, y: 10, n: 50 }] }; const b = L.frStart(farm, { [k]: { n: 1, lv: lv || 1 } }, 1); L.frDrop(b, k, 0, 10); for (let i = 0; i < 200 && !b.end; i++) L.frStep(b); return b; };
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
  const farm = L.banditFarm(R.bandits[0], 1), b = L.frStart(farm, { goat: { n: 10, lv: 1 } }, 1);
  for (let i = 0; i < 10; i++) L.frDrop(b, 'goat', 0, 5 + i);
  while (!b.end) L.frStep(b);
  const gold = s.gold, r = L.banditPrize(s, 'b1', b);
  assert.strictEqual(s.gold, gold + r.gold);
  if (r.stars) assert.ok(L.banditOpen(s, 1));
  assert.strictEqual(roundTrip(s).fr.pts, r.pts);
});

test('a real farm: raiders find the way round its walls, and come down only on open ground away from it all', () => {
  // a wall across the middle with one gap at the right; crops behind it
  const w = 12, h = 10, rows = [];
  for (let y = 0; y < h; y++) { let row = ''; for (let x = 0; x < w; x++) row += (y === 5 && x < 10) ? '1' : '0'; rows.push(row); }
  const farm = { w, h, solid: rows.join(''), defs: [], loot: [{ kind: 'crops', x: 2, y: 8, n: 10 }] };
  farm.drop = L.frDropCells(farm);
  const b = L.frStart(farm, { goat: { n: 1, lv: 1 } }, 1);
  assert.ok(!L.frEdge(b, 2, 7), 'not right by the crops');
  assert.ok(!L.frEdge(b, 5, 5), 'not in the wall');
  assert.ok(L.frEdge(b, 2, 1), 'open ground far away');
  L.frDrop(b, 'goat', 2, 1);
  let crossed = false;
  for (let i = 0; i < 600 && !b.end; i++) { L.frStep(b); const r = b.raiders[0]; if (Math.floor(r.y) === 5) { crossed = true; assert.ok(Math.floor(r.x) >= 10, 'through the gap only: ' + r.x); } }
  assert.ok(crossed, 'it went round');
  assert.ok(b.taken.crops > 0, 'and ate');
});

test('the Farm Shield (owner): a story chapter gives one; used, 24 hours safe; a real raid breaks it; kept in the save', () => {
  const s = L.newState(); s.wild.n = 200;
  L.refreshQuests(s, '2026-11-09');
  const q = s.dq.list.find((x) => x.c === 'adv' && L.advOf(x).story);
  assert.deepStrictEqual(plain([q.reward.item, q.reward.n]), ['farm_shield', 1]); assert.ok(q.reward.gold >= 300, 'and its Gold');
  L.addItem(s, 'farm_shield', 1);
  const slot = s.inv.findIndex((x) => x && x.id === 'farm_shield'), now = 1e12;
  assert.strictEqual(L.shieldLeft(s, now), 0);
  assert.strictEqual(L.useShield(s, slot, now), 'ok');
  assert.strictEqual(L.shieldLeft(s, now + 3600000), 23 * 3600000);
  assert.ok(!s.inv.some((x) => x && x.id === 'farm_shield'), 'used up');
  assert.strictEqual(L.shieldLeft(roundTrip(s), now), 24 * 3600000, 'kept in the save');
  L.shieldBreak(s);
  assert.strictEqual(L.shieldLeft(s, now), 0);
});

test('a defense limit per Raid Camp level (owner, 10 Nov 2026: "If I can buy 100 tower, looks like it was imbalance")', () => {
  const s = L.newState({ fieldTiles: [] }), O = C.OUTDOOR, t = O.index.def_tower;
  s.gold = 1e6;
  L.frState(s).camp = 1;
  assert.strictEqual(L.defenseCap(s, 'tower'), 1);
  assert.strictEqual(L.buyYard(s, t, 1), 'ok');
  assert.strictEqual(L.buyYard(s, t, 1), 'cap', 'one tower at camp 1');
  s.fr.camp = 7;
  assert.strictEqual(L.defenseCap(s, 'tower'), 4);
  for (let i = 0; i < 3; i++) assert.strictEqual(L.buyYard(s, t, 1), 'ok');
  assert.strictEqual(L.buyYard(s, t, 1), 'cap', 'four at camp 7');
  assert.strictEqual(L.buyYard(s, O.index.wood_fence != null ? O.index.wood_fence : 0, 5), 'ok', 'plain pieces: no limit');
  // a raid sees only as many as the camp allows; extra Strong Fences are plain fences
  const defs = [...Array(6)].map(() => ({ t: 'tower' })).concat([...Array(30)].map(() => ({ t: 'fence', strong: true })));
  const seen = L.frCapDefs(defs, 1);
  assert.strictEqual(seen.filter((d) => d.t === 'tower').length, 1);
  assert.strictEqual(seen.filter((d) => d.t === 'fence').length, 30, 'every fence still a wall');
  assert.strictEqual(seen.filter((d) => d.t === 'fence' && d.strong).length, 20, 'only 20 strong at camp 1');
});

test('a real farm: raiders never come down on the field, in the pen or within 3 tiles of a crop or defense', () => {
  const solid = '0'.repeat(20 * 10), nd = [...solid].map((c, i) => (i % 20 < 5 ? '1' : '0')).join('');
  const farm = { w: 20, h: 10, solid, noDrop: nd, keep: 3, defs: [{ t: 'tower', x: 15, y: 5 }], loot: [{ kind: 'crops', x: 10, y: 2, n: 1 }] };
  const d = L.frDropCells(farm);
  const at = (x, y) => d[y * 20 + x] === '1';
  assert.ok(!at(2, 5), 'the field');
  assert.ok(!at(17, 5) && !at(13, 5), '3 tiles round a defense');
  assert.ok(!at(10, 4) && at(10, 6), '3 tiles round a crop');
  assert.ok(at(8, 8), 'open ground');
});
