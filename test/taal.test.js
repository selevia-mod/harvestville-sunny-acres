// Unit tests for Place 13, Taal Lake (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-13-taal.js, Mang Celso's gifts in
// src/01-logicZZZZZ-place-13-taal.js, maps/taal.json and maps/taal_crater.json): its data and art names, its two maps,
// taming the Little Tagak with Small Fish, Mang Celso's story and its gifts, the Lakeguard set, its local food, and the
// Taal Crater's floors. The engine's own tests are test/places.test.js.
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
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 13; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const P = () => C.PLACES.taal;
const A = (k) => C.WILD.animals[k];
const plain = (x) => JSON.parse(JSON.stringify(x));
const map = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', name + '.json'), 'utf8'));

test('Taal Lake: place 13, opens at 100 hunts, shown in the Jeep; its fixed item ids and every art name are wired', () => {
  const p = P();
  assert.deepStrictEqual([p.n, p.unlock, p.map, p.dungeon.key, p.dev], [13, 100, 'taal', 'taal_crater', undefined]);
  const s = fresh();
  s.wild.n = 99;
  assert.strictEqual(L.placeOpen(s, 'taal'), false);
  s.wild.n = 100;
  assert.strictEqual(L.placeOpen(s, 'taal'), true);
  assert.ok(L.jeepPlaces(s).some((e) => e.id === 'taal' && e.open), 'in the Jeep for everyone (not a dev place)');
  // docs/places-items.json: 12 items, the 4 gear icons, in icon order
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'places-items.json'), 'utf8')).taal;
  const gearIds = plain(C.GEAR_SLOTS.map((k) => C.PLACE_GEAR['taal_' + k].art));
  assert.deepStrictEqual(gearIds, ['lake_hat', 'lake_vest', 'lake_boots', 'lake_charm']);
  j.items.forEach((x) => assert.ok((C.ITEMS[x.id] && C.ITEMS[x.id].place === 'taal') || gearIds.includes(x.id), x.id));
  assert.strictEqual(Object.keys(p.items).length + gearIds.length, 16);
  // until icons_taal.png is in the items sheet, every item shows a stand-in from before (never an icon past the sheet)
  Object.keys(p.items).forEach((id) => assert.ok(C.ICON_ORDER.indexOf(id) < 0 && C.ITEMS[id].icon < C.ICON_ORDER.length, id));
  // the art names (art-src/places/taal/...): the creatures' sheets, Mang Celso, the mouth, the gate, the cave tiles
  const sheets = plain(Object.keys(p.creatures).concat(Object.keys(p.dungeon.creatures)).map((k) => A(k).sheet));
  assert.deepStrictEqual(sheets, ['wild_tagak', 'wild_buwaya', 'wild_royaltagak', 'wild_tagak', 'wild_siyokoy', 'wild_kataw', 'wild_lavabuwaya', 'wild_berberoka']);
  assert.strictEqual(p.npc.sheet, 'npc_mang_celso');
  assert.deepStrictEqual(plain(p.dungeon.art), { mouth: 'props/taal_mouth', gate: 'props/taal_gate', cave: 'taal_cave' });
  // medals: first, guard, boss, tame, chests, story, then 2 for each animal (the rare one has no giant)
  const codes = plain(C.MEDALS.filter((m) => m.place === 'taal').map((m) => m.code));
  assert.deepStrictEqual(codes, [1300, 1301, 1302, 1303, 1304, 1305, 1310, 1311, 1312, 1313, 1314]);
});

test('Taal Lake numbers: a step above Magayon and the Lair; the guard and boss soloable; with friends the boss grows', () => {
  // (Chocolate Hills is built tonight by another session: when it is in, its boss must be under the Berberoka)
  const bohol = C.PLACE_ORDER.map((id) => C.PLACES[id]).find((p) => p.n === 12 && p.dungeon);
  if (bohol) assert.ok(A(bohol.dungeon.boss).hp < A('berberoka').hp, 'a step above Chocolate Hills');
  assert.ok(A('buwaya').hit > A('rhino').hit - 2 && A('buwaya').hp >= A('bear').hp, 'the Buwaya is a Magayon-sized fight');
  assert.ok(A('berberoka').hp > A('bungisngis').hp && !A('berberoka').great, 'the boss: more than the Lair\'s guard, and soloable');
  assert.strictEqual(L.dunHp('berberoka', 1), 40);
  assert.strictEqual(L.dunHp('berberoka', 3), 76, '18 more for each friend');
  assert.strictEqual(L.dunHp('lava_buwaya', 3), 26, 'the guard does not grow');
  assert.ok(A('tagak').flies && A('tagak').shy && A('royal_tagak').rare && A('buwaya').angry, 'shy flier, charger, rare');
  assert.ok(!A('tagak').tameOnly && A('tagak_bata').tameOnly, 'the grown Tagak is a hunt; the Little Tagak is fed, not hunted');
});

test('Taal Crater: 10 floors, the Lava Buwaya leads floor 5, the Berberoka floor 10, Kataw from floor 3, the lift every 5', () => {
  const d = P().dungeon;
  assert.ok(L.dunRoster('taal_crater', 1).every((e) => e.kind === 'siyokoy'), 'floors 1 and 2: Siyokoy only');
  assert.strictEqual(L.dunRoster('taal_crater', 1).length, 3);
  assert.strictEqual(L.dunRoster('taal_crater', 9).length, 6);
  assert.strictEqual(L.dunRoster('taal_crater', 5)[0].kind, 'lava_buwaya');
  assert.strictEqual(L.dunRoster('taal_crater', 5).length, 3, 'the guard and its two');
  assert.strictEqual(L.dunRoster('taal_crater', 10)[0].kind, 'berberoka');
  for (let f = 3; f <= 9; f++) if (f !== 5) assert.ok(L.dunRoster('taal_crater', f).every((e) => e.kind === 'siyokoy' || e.kind === 'kataw'));
  const s = fresh();
  [1, 4, 7, 10].forEach((f) => L.dunReach(s, 'taal_crater', f));
  assert.deepStrictEqual(plain(L.dunStops(s, 'taal_crater')), [1, 6]);
  assert.strictEqual(d.lava.embers, false, 'steam, not lava sparks');
  // the boss's chest once a day, missed days add up to 3
  assert.strictEqual(L.bossDown(s, 'taal'), 1);
  assert.strictEqual(L.bossDown(s, 'taal'), 0, 'one a day');
  s.day += 5;
  assert.strictEqual(L.bossDown(s, 'taal'), 2, 'up to 3 waiting');
  const loot = L.openBossChests(s, 'taal', () => 0.99);
  assert.deepStrictEqual(plain(loot), [['pearl_kataw', 6], ['sulfur_chip', 12], ['arrows', 45]]);
});

test('the maps: the jeep, the lake (water, not walkable) and its pier, the cave door; chests and Mang Celso on free land', () => {
  const m = map('taal'), W = m.width, objs = m.layers.find((l) => l.name === 'Objects').objects;
  const ground = m.layers.find((l) => l.name === 'Ground').data, walls = m.layers.find((l) => l.name === 'Walls').data;
  const first = m.tilesets.find((t) => t.name === 'tiles').firstgid, tiles = m.tilesets.find((t) => t.name === 'tiles');
  const prop = (gid, name) => (tiles.tiles.find((t) => t.id === gid - first) || { properties: [] }).properties.some((p) => p.name === name);
  const by = (name) => objs.find((o) => o.name === name);
  ['jeep', 'from_jeep', 'wild', 'dungeon_door', 'dungeon_mouth', 'from_dungeon'].forEach((n) => assert.ok(by(n), n));
  assert.deepStrictEqual((by('dungeon_door').properties || []).map((p) => [p.name, p.value]), [['to', 'taal_crater'], ['spawn', 'entrance'], ['walk', true]]);
  assert.ok(W >= 30 && m.height >= 26, "about Pulag's size");
  const water = ground.filter((g) => prop(g, 'water')).length;
  assert.ok(water > 120, 'a big lake: ' + water + ' tiles');
  assert.ok(ground.every((g) => !prop(g, 'water') || prop(g, 'collides')), 'the lake is not walkable');
  const tileAt = (x, y) => ({ g: ground[y * W + x], w: walls[y * W + x] });
  // the pier's end: you stand on it with water in front
  assert.ok(!prop(tileAt(17, 6).g, 'collides') && prop(tileAt(17, 5).g, 'water'), 'fish from the end of the pier');
  // under a prop: its tiles (the props' feet are solid)
  const under = new Set();
  objs.filter((o) => o.type === 'prop').forEach((o) => {
    const p = require('../tools/tiles').PROPS[o.name], tx = o.x / 256, ty = o.y / 256 - p.h;
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) under.add((ty + dy) * W + tx + dx);
  });
  P().chests.concat([P().npc.at]).forEach(([x, y]) => {
    const t = tileAt(x, y);
    assert.ok(!t.w && !prop(t.g, 'collides') && !under.has(y * W + x), 'free: ' + x + ',' + y);
  });
  const cave = map('taal_crater'), exit = cave.layers.find((l) => l.name === 'Objects').objects.find((o) => o.name === 'exit');
  assert.deepStrictEqual((exit.properties || []).map((p) => [p.name, p.value]), [['to', 'taal'], ['spawn', 'from_dungeon'], ['label', 'Climb out']]);
  assert.ok(cave.layers.find((l) => l.name === 'Objects').objects.some((o) => o.type === 'dungeon_gate'));
});

test('taming the Little Tagak: Small Fish (from the pier), 9 feedings, it can fly off and come back; its skill spots the rare ones', () => {
  const s = fresh(), t = P().tame;
  assert.deepStrictEqual([t.kind, t.food, t.feedings, t.skill], ['tagak_bata', 'fish_s', 9, 'spot']);
  assert.ok(C.FISH_TABLE.pond.fish_s > 0.5, 'Small Fish are what the lake mostly gives');
  assert.ok(L.wildHere(s, 'taal').some((e) => e.kind === 'tagak_bata'), 'it walks the shore');
  L.addItem(s, 'fish_s', 12);
  s.sel = s.inv.findIndex((x) => x && x.id === 'fish_s');
  assert.strictEqual(L.canFeed(s, 'taal', 'idle', 1.2), true);
  for (let i = 0; i < 4; i++) assert.strictEqual(L.feedTame(s, 'taal', () => 0.9), 'fed');
  assert.strictEqual(L.feedTame(s, 'taal', () => 0.1), 'ran');
  assert.ok(!L.wildHere(s, 'taal').some((e) => e.kind === 'tagak_bata'));
  clock.advance(t.back + 1);
  assert.strictEqual(L.tameHearts(roundTrip(s), 'taal'), 5);
  for (let i = 0; i < 3; i++) assert.strictEqual(L.feedTame(s, 'taal', () => 0.9), 'fed');
  assert.strictEqual(L.feedTame(s, 'taal', () => 0.1), 'tame', 'the 9th tames it');
  assert.strictEqual(L.countItem(s, 'fish_s'), 3);
  assert.strictEqual(L.companionSkill(roundTrip(s)), 'spot');
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 1303));
});

test('Mang Celso: four steps (first visit, a few hunts, the guard, the boss), each gift once; a step skipped still gives its gift', () => {
  const s = fresh(), coffee = () => L.countItem(s, 'kapeng_barako');
  let r = L.talkNpc(s, 'taal');
  assert.strictEqual(r.i, 0);
  assert.match(r.text, /Mang Celso gives you 1 Kapeng Barako\.\)$/);
  assert.strictEqual(coffee(), 1);
  r = L.talkNpc(s, 'taal');
  assert.ok(!/gives you/.test(r.text) && coffee() === 1, 'once');
  L.placeRec(s, 'taal').n = 5;
  r = L.talkNpc(roundTrip(s), 'taal'); // (a round trip keeps how far the story went)
  r = L.talkNpc(s, 'taal');
  assert.strictEqual(r.i, 1);
  assert.strictEqual(L.countItem(s, 'fish_s'), 5, 'fish to start taming with');
  // the guard and the boss both down before you come back: both gifts at once
  const gold = s.gold;
  Object.assign(L.placeRec(s, 'taal'), { g: 1, b: 1 });
  r = L.talkNpc(s, 'taal');
  assert.strictEqual(r.i, 3);
  assert.match(r.text, /gives you 1 Tapang Taal, 4 Sulfur Chip, 3 Kapeng Barako, 500 Gold/);
  assert.deepStrictEqual([L.countItem(s, 'tapang_taal'), L.countItem(s, 'sulfur_chip'), coffee(), s.gold - gold], [1, 4, 4, 500]);
  r = L.talkNpc(roundTrip(s), 'taal');
  assert.ok(!/gives you/.test(r.text), 'never again, after a reload');
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 1305), "Mang Celso's story medal");
  // another place's person is not changed
  assert.ok(!('gifts' in L.talkNpc(s, 'sample_place')));
});

test('the Lakeguard set from Kanor: its drops and Gold; worn whole it takes 8 off a Taal charge (6 elsewhere); the local food cooks', () => {
  const s = fresh();
  s.gold = 30000;
  assert.strictEqual(L.makeGear(s, 'taal_head'), 'short');
  [['plume_tagak', 6], ['shell_lake', 4], ['hide_buwaya', 4], ['tooth_buwaya', 2], ['fin_siyokoy', 4], ['sulfur_chip', 10], ['pearl_berberoka', 1], ['pearl_kataw', 3]].forEach(([id, n]) => L.addItem(s, id, n));
  C.GEAR_SLOTS.forEach((k) => assert.strictEqual(L.makeGear(s, 'taal_' + k), 'ok', k));
  assert.strictEqual(s.gold, 30000 - 4000 - 7000 - 4500 - 7500);
  assert.strictEqual(L.wornSet(s), 'taal');
  assert.strictEqual(L.chargeLoss(s, A('buwaya').hit, 'buwaya'), 15 - 8);
  assert.strictEqual(L.chargeLoss(s, A('berberoka').hit, 'berberoka'), 19 - 8, 'the crater is Taal too');
  assert.strictEqual(L.chargeLoss(s, A('bear').hit, 'bear'), 12 - 6);
  // tapang Taal and kapeng barako in the kitchen
  s.builds.kitchen = 1;
  ['meat_boar', 'garlic', 'egg', 'coffee'].forEach((id) => L.addItem(s, id, 1));
  const recipe = (dish) => C.RECIPES.find((x) => x.dish === dish);
  assert.strictEqual(L.cook(s, recipe('tapang_taal')), 'ok');
  assert.strictEqual(L.cook(s, recipe('kapeng_barako')), 'ok');
  assert.deepStrictEqual([L.countItem(s, 'tapang_taal'), L.countItem(s, 'kapeng_barako')], [1, 1]);
  assert.ok(C.ITEMS.tapang_taal.energy > C.ITEMS.bistek.energy, 'a step above the best dish before it');
  L.addItem(s, 'sulfur_chip', 1);
  assert.ok(L.wildGoods(s).includes('sulfur_chip'), 'Kanor buys sulfur chips');
});
