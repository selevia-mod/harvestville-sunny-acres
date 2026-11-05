// Place 15, Palawan Underground River (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-15-palawan.js, maps/palawan.json,
// maps/palawan_cave.json): its data and art names, its two maps, its numbers (the hardest of the first five, below the
// Lair's deep floors), Mang Pido's story and its small gifts, the Paniki pup, the River Caves and the local dish.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const WI = C.WILD;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 15; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const ID = 'palawan';
const P = C.PLACES[ID];
const D = P.dungeon;
const map = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', name + '.json'), 'utf8'));

test('Palawan: place 15 at 160 hunts, the fixed item ids, every art name wired, the River Caves', () => {
  assert.deepStrictEqual([P.n, P.unlock, P.map, D.key, D.name, D.floors, D.guardFloor, D.bossFloor], [15, 160, 'palawan', 'palawan_cave', 'River Caves', 10, 5, 10]);
  // every id in docs/places-items.json is an item here, or a piece of the Cavern set
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'places-items.json'), 'utf8')).palawan;
  const gearArt = C.GEAR_SLOTS.map((k) => C.PLACE_GEAR[ID + '_' + k].art);
  assert.deepStrictEqual(plain(gearArt), ['cavern_hat', 'cavern_vest', 'cavern_boots', 'cavern_charm']);
  j.items.forEach((x) => assert.ok((C.ITEMS[x.id] && C.ITEMS[x.id].place === ID) || gearArt.includes(x.id), x.id));
  // the owner's pictures, by name (art-src/PLACES-1-5-PROMPTS.md, 73-90)
  const sheets = {};
  Object.keys(P.creatures).concat(Object.keys(D.creatures)).forEach((k) => { sheets[k] = WI.animals[k].sheet; });
  assert.deepStrictEqual(sheets, { paniki: 'wild_paniki', sawa: 'wild_sawa', golden_sawa: 'wild_goldensawa', paniki_pup: 'wild_paniki',
    cave_crab: 'wild_cavecrab', glow_eel: 'wild_gloweel', balinsasayaw: 'wild_balinsasayaw', minokawa: 'wild_minokawa' });
  Object.keys(sheets).forEach((k) => assert.ok(WI.order.includes(WI.animals[k].sheetRow), k + ': a stand-in row until its picture'));
  assert.strictEqual(P.npc.sheet, 'npc_mang_pido');
  assert.ok(C.VILLAGER_ORDER.includes(P.npc.look), 'a villager look until then');
  assert.deepStrictEqual(plain(D.art), { mouth: 'props/palawan_mouth', gate: 'props/palawan_gate', cave: 'palawan_cave' });
  // the animals, the tame, the gear set's name
  assert.deepStrictEqual(plain(P.kinds), ['paniki', 'sawa', 'golden_sawa']);
  assert.ok(WI.animals.paniki.shy && WI.animals.paniki.flies && WI.animals.sawa.angry && WI.animals.golden_sawa.rare);
  assert.deepStrictEqual(plain(WI.animals.paniki.drops[0]), ['fig_wild', 1, 1], 'a bat drops the fruit it carried');
  assert.deepStrictEqual([P.tame.kind, P.tame.food, P.tame.feedings, P.tame.skill], ['paniki_pup', 'mango', 10, 'spot']);
  assert.ok(WI.animals.paniki_pup.tameOnly && !WI.animals.paniki.tameOnly, 'the pup is fed, the grown Paniki hunted');
  assert.strictEqual(P.gear.name, 'Cavern');
  assert.strictEqual(P.chests.length, 5);
  // the story: 4 lines (first visit, a few hunts, the guard, the boss), each with a small gift that is an item
  assert.deepStrictEqual(plain(P.npc.lines.map((l) => l.need ? Object.keys(l.need)[0] : 'first')), ['first', 'hunts', 'guard', 'boss']);
  P.npc.lines.forEach((l, i) => { assert.ok(l.gift && l.gift.length, 'line ' + i); l.gift.forEach((g) => assert.ok(C.ITEMS[g[0]] && g[1] > 0)); });
  // 16 medals, codes 1500 and up
  const mine = C.MEDALS.filter((m) => m.place === ID).map((m) => m.code);
  assert.deepStrictEqual(plain(mine), [1500, 1501, 1502, 1503, 1504, 1505, 1510, 1511, 1512, 1513, 1514]);
});

test('Palawan: its numbers are the hardest of the five places, still below the Lair\'s deep floors', () => {
  const A = WI.animals;
  // above every place from before (Magayon's toughest: the mammoth's 9 hp, the mammoth's 18 hit)
  assert.ok(A.sawa.hp >= 8 && A.golden_sawa.hit >= 18);
  // below the Lair's deep floors: the Bungisngis on floor 40 (24 + 0.5 x 40 hp) and the Bakunawa (60 hp, hits 22)
  const deepGuard = A.bungisngis.hp + C.LAIR.bossHpPer * 40;
  [D.guard, D.boss].concat(Object.keys(D.creatures)).forEach((k) => assert.ok(A[k].hp < deepGuard && A[k].hit < A.bakunawa.hit, k));
  assert.ok(A.minokawa.hp < A.bakunawa.hp && A.minokawa.hpEach < A.bakunawa.hpEach);
  // and above the other new places (whichever are in this game)
  C.PLACE_ORDER.filter((id) => id !== ID && !C.PLACES[id].legacy && !C.PLACES[id].dev).forEach((id) => {
    const o = C.PLACES[id];
    assert.ok(P.unlock > o.unlock, id + ' opens first');
    if (o.dungeon && o.dungeon.boss) assert.ok(A.minokawa.hp >= A[o.dungeon.boss].hp, id + ': its boss is no tougher');
    if (o.gear) assert.ok(C.PLACE_GEAR.palawan_charm.gold >= C.PLACE_GEAR[id + '_charm'].gold, id + ': its gear no dearer');
  });
  // soloable, stronger with friends
  assert.strictEqual(L.dunHp('minokawa', 1), 42);
  assert.strictEqual(L.dunHp('minokawa', 3), 70);
  assert.strictEqual(L.dunHp('balinsasayaw', 3), 28, 'the guard is the same for everyone');
});

test('Palawan maps: the jeep, the cave door and mouth, the wild zone; the chests and Mang Pido on free sand or grass; the cave climbs out to the beach', () => {
  const m = map('palawan'), cave = map('palawan_cave');
  assert.deepStrictEqual([m.width, m.height], [32, 28], 'about Pulag\'s size');
  const objs = m.layers.find((l) => l.name === 'Objects').objects;
  const by = (n) => objs.find((o) => o.name === n);
  ['jeep', 'from_jeep', 'wild', 'dungeon_door', 'dungeon_mouth', 'from_dungeon'].forEach((n) => assert.ok(by(n), n));
  assert.strictEqual(by('dungeon_door').properties.find((p) => p.name === 'to').value, 'palawan_cave');
  const ts = m.tilesets.find((t) => t.name === 'tiles'), solid = new Set(ts.tiles.filter((t) => t.properties.some((p) => p.name === 'collides')).map((t) => t.id + ts.firstgid));
  const layer = (n) => m.layers.find((l) => l.name === n).data;
  const at = (n, x, y) => layer(n)[y * m.width + x];
  // the river is there (water, not walkable), with the dock and the bridge over it
  let water = 0;
  layer('Ground').forEach((g) => { if (solid.has(g)) water++; });
  assert.ok(water > 60, water + ' water tiles');
  // nothing on the chests' tiles or the person's
  const props = objs.filter((o) => o.type === 'prop').map((o) => ({ x0: o.x / 256, y0: o.y / 256 - o.height / 256, x1: (o.x + o.width) / 256, y1: o.y / 256 }));
  P.chests.concat([P.npc.at]).forEach(([x, y]) => {
    assert.ok(!solid.has(at('Ground', x, y)) && !at('Walls', x, y) && !at('Above', x, y), x + ',' + y + ' is free ground');
    assert.ok(!props.some((p) => x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1), x + ',' + y + ' has no prop on it');
  });
  const exit = cave.layers.find((l) => l.name === 'Objects').objects.find((o) => o.name === 'exit');
  assert.deepStrictEqual(exit.properties.map((p) => p.value), ['palawan', 'from_dungeon', 'Climb out']);
  assert.ok(cave.layers.find((l) => l.name === 'Objects').objects.some((o) => o.type === 'dungeon_gate'));
});

test('Mang Pido: each line\'s small gift once; a line skipped by doing two things at once still gives its gift; kept in the save', () => {
  const s = fresh();
  let r = L.talkNpc(s, ID);
  assert.deepStrictEqual(plain([r.i, r.gift, r.left]), [0, [['mango', 3]], 0]);
  assert.strictEqual(L.countItem(s, 'mango'), 3);
  r = L.talkNpc(s, ID);
  assert.strictEqual(r.gift, undefined, 'once');
  assert.strictEqual(L.countItem(s, 'mango'), 3);
  // 5 hunts and the guard, then a talk: two lines open, both gifts
  for (let i = 0; i < 5; i++) L.hunted(s, ID, i % 3, 'sawa', 1);
  L.hunted(s, D.key, 0, D.guard, 1);
  r = L.talkNpc(s, ID);
  assert.deepStrictEqual(plain([r.i, r.gift]), [2, [['cashew_palawan', 3], ['arrows', 15]]]);
  assert.strictEqual(roundTrip(s).places.palawan.st, 3, 'the lines read are kept');
  L.hunted(s, D.key, 0, D.boss, 1);
  r = L.talkNpc(s, ID);
  assert.deepStrictEqual(plain([r.i, r.last, r.gift]), [3, true, [['ginataang_alimasag', 1]]]);
  assert.ok(L.hasMedal(L.medalCheck(s) && s, 1505), "Mang Pido's story");
  // the pup: 10 mangoes, never the Bow's
  const t = fresh();
  L.addItem(t, 'mango', 20);
  for (let i = 0; i < 9; i++) assert.strictEqual(L.feedTame(t, ID, () => 0.9), 'fed');
  assert.strictEqual(L.feedTame(t, ID, () => 0.1), 'tame');
  assert.deepStrictEqual([L.companion(t), L.companionSkill(t)], [ID, 'spot']);
});

test('the River Caves: crabs from floor 1, eels from floor 3, the Queen leads floor 5, the Minokawa floor 10; the daily chest; Ginataang Alimasag', () => {
  const kinds = (f) => L.dunRoster(D.key, f).map((e) => e.kind);
  assert.ok(kinds(1).every((k) => k === 'cave_crab') && kinds(1).length === 3);
  assert.ok(kinds(4).length === 4 && kinds(4).some((k) => k === 'glow_eel'));
  assert.deepStrictEqual([kinds(5)[0], kinds(5).length], ['balinsasayaw', 3]);
  assert.deepStrictEqual([kinds(10)[0], kinds(10).length], ['minokawa', 3]);
  assert.ok(kinds(9).length === 6, 'at most 6 a floor');
  const s = fresh();
  assert.strictEqual(L.hunted(s, D.key, 0, D.boss, 1).chests, 1);
  const loot = plain(L.openBossChests(s, ID, () => 0));
  assert.deepStrictEqual(loot, [['feather_minokawa', 1], ['stalactite_chip', 4], ['arrows', 15], ['golden_scale', 1], ['cashew_palawan', 2]]);
  // the local dish: cooked in the Kitchen from a crab shell, ginger and chili; its power halves a charge
  const r = C.RECIPES.find((x) => x.dish === 'ginataang_alimasag');
  assert.deepStrictEqual(plain(r.needs), ['shell_crab', 'ginger', 'chili']);
  s.builds.kitchen = 1;
  ['shell_crab', 'ginger', 'chili'].forEach((id) => L.addItem(s, id, 1));
  assert.strictEqual(L.cook(s, r), 'ok');
  assert.strictEqual(L.countItem(s, 'ginataang_alimasag'), 1);
  assert.strictEqual(C.DISH_POWERS.ginataang_alimasag.key, 'charge');
  assert.ok(C.ITEMS.cashew_palawan.energy > 0 && C.ITEMS.stalactite_chip.kind === 'hunt', 'a snack, a material Kanor buys');
});
