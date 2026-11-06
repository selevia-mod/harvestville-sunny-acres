// Place 12: Chocolate Hills, Bohol, and its cave the Hill Hollows (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-12-bohol.js,
// src/01-logicZZZZZ-place-12-bohol.js). Its ids against docs/places-items.json, its numbers (a step past Banaue), the tame
// goat kid, Mang Tonyo's gifts, Kaldereta from goat meat, the cave's floors, guard and boss, the boss chest, the Hollow
// set, its medals, and its two maps (what they must hold, every chest and the person reachable from the Jeep).
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
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 12; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const ID = 'bohol', CAVE = 'bohol_cave';
const P = () => C.PLACES[ID];
const A = (k) => C.WILD.animals[k];

test('Chocolate Hills: the 16 ids of docs/places-items.json, in its order; every new item on its own icon (the owner\'s art is in)', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'places-items.json'), 'utf8')).bohol;
  assert.deepStrictEqual(plain(C.BOHOL_ICONS), j.items.map((x) => x.id), 'the icons sheet\'s order');
  const gearArt = plain(C.GEAR_SLOTS.map((slot) => C.PLACE_GEAR[ID + '_' + slot].art));
  assert.deepStrictEqual(gearArt, ['hollow_hat', 'hollow_vest', 'hollow_boots', 'hollow_charm']);
  j.items.forEach((x) => assert.ok(C.ITEMS[x.id] || gearArt.includes(x.id), x.id));
  assert.strictEqual(C.ITEMS.kaldereta.place, undefined, 'Kaldereta is the dish from before, used again');
  Object.keys(P().items).forEach((id) => {
    assert.strictEqual(C.ITEMS[id].place, ID);
    assert.ok(C.ICON_ORDER.indexOf(id) > C.ICON.chocolate_cake, id + ': in the sheet, after the icons from before');
    assert.strictEqual(C.ITEMS[id].icon, C.ICON[id], id + ': its own icon');
  });
  assert.deepStrictEqual([P().n, P().unlock, P().map, P().dungeon.key, P().dungeon.name], [12, 80, 'bohol', CAVE, 'Hill Hollows']);
  // every creature wired to its own picture (art-src/places/bohol/wild_<name>.png), on a stand-in row until then
  const sheets = { kambing: 'wild_kambing', musang: 'wild_musang', cocoagoat: 'wild_cocoagoat', kambing_kid: 'wild_kambing', duwendeputi: 'wild_duwendeputi',
    duwendeitim: 'wild_duwendeitim', punsogolem: 'wild_punsogolem', greatnuno: 'wild_greatnuno' };
  Object.keys(sheets).forEach((k) => { assert.strictEqual(A(k).sheet, sheets[k], k); assert.ok(C.WILD.order.includes(A(k).sheetRow), k); });
  assert.strictEqual(P().npc.sheet, 'npc_mang_tonyo');
  assert.deepStrictEqual(plain(P().dungeon.art), { mouth: 'props/bohol_mouth', gate: 'props/bohol_gate', cave: 'bohol_cave' });
});

test('Chocolate Hills: its numbers, a step past Banaue and Magayon; 80 hunts open it', () => {
  // the map's animals
  assert.deepStrictEqual([A('kambing').hp, A('kambing').shy, A('musang').hp, A('musang').angry, A('musang').hit, A('cocoagoat').hp, A('cocoagoat').rare], [3, 4.4, 4, 3.2, 13, 6, true]);
  assert.ok(A('musang').hit > A('boar').hit && A('musang').hit > A('bear').hit, 'its charge hurts more than Magayon\'s bear');
  assert.deepStrictEqual(plain(P().animals), { kambing: 3, musang: 2 });
  assert.deepStrictEqual(plain(P().kinds), ['kambing', 'musang', 'cocoagoat']);
  // the cave
  const d = P().dungeon;
  assert.deepStrictEqual([A('punsogolem').hp, A('punsogolem').hit, A('greatnuno').hp, A('greatnuno').hpEach, A('greatnuno').hit], [22, 15, 34, 16, 18]); // (34, not 40: under Taal's Berberoka, owner 6 Nov 2026: each place a step up)
  // a step past Banaue (place 11) when it is in, in every number that makes a place harder
  const B = C.PLACES.banaue;
  if (B) {
    assert.ok(P().unlock > B.unlock, 'opens later');
    const most = (ks, f) => Math.max.apply(null, ks.map((k) => A(k)[f] || 0));
    assert.ok(most(Object.keys(P().creatures), 'hit') >= most(Object.keys(B.creatures || {}), 'hit'), 'charges');
    if (B.dungeon && B.dungeon.boss) assert.ok(A(d.boss).hp >= A(B.dungeon.boss).hp, 'its boss');
    if (B.dungeon && B.dungeon.guard) assert.ok(A(d.guard).hp >= A(B.dungeon.guard).hp, 'its guard');
  }
  const s = fresh();
  s.wild.n = 79;
  assert.strictEqual(L.placeOpen(s, ID), false);
  assert.strictEqual(L.hunted(s, 'pulag', 0, 'deer').opened, ID, 'the 80th hunt opens it');
  assert.ok(L.placeOpen(s, ID) && L.wildOpen(s, CAVE));
  assert.match(C.WILD.areas[ID].opened, /CHOCOLATE HILLS IS OPEN/);
  assert.ok(L.jeepPlaces(s).some((p) => p.id === ID && p.open), 'in the Jeep\'s list');
  // what a hunt there gives
  const r = L.hunted(s, ID, 0, 'kambing', 1);
  assert.strictEqual(L.placeHunts(s, ID), 1);
  assert.ok(r.medals.some((m) => m.code === 1200) && r.medals.some((m) => m.code === 1210), 'first hunt in the hills, and the goat');
});

test('Chocolate Hills: the goat kid tames with cabbage in 9 feedings, may run off for 25 minutes, then fetches', () => {
  const s = fresh(), t = P().tame;
  assert.deepStrictEqual([t.kind, t.food, t.feedings, t.runOff, t.back, t.skill], ['kambing_kid', 'cabbage', 9, 0.25, 25, 'fetch']);
  assert.ok(A('kambing_kid').tameOnly && !A('kambing').tameOnly, 'the kid is fed, the wild goats are hunted');
  assert.ok(L.wildHere(s, ID).some((e) => e.kind === 'kambing_kid'), 'it roams the hills');
  L.addItem(s, 'cabbage', 20);
  for (let i = 1; i < 9; i++) assert.strictEqual(L.feedTame(s, ID, () => 0.9), 'fed', 'feeding ' + i);
  assert.strictEqual(L.feedTame(s, ID, () => 0.1), 'tame', 'the ninth tames it');
  const back = roundTrip(s);
  assert.strictEqual(L.companion(back), ID);
  assert.strictEqual(L.companionSkill(back), 'fetch');
  assert.ok(L.hasMedal(L.medalCheck(s) && s, 1203));
  const u = fresh();
  L.addItem(u, 'cabbage', 3);
  assert.strictEqual(L.feedTame(u, ID, () => 0.2), 'ran', 'a 1 in 4 it runs off');
  assert.ok(!L.wildHere(u, ID).some((e) => e.kind === 'kambing_kid'));
  clock.advance(26);
  assert.ok(L.wildHere(u, ID).some((e) => e.kind === 'kambing_kid'), 'back after 25 minutes');
});

test('Mang Tonyo: 4 lines (first visit, a few hunts, the guard, the boss), each with its gift once', () => {
  const s = fresh(), lines = P().npc.lines;
  assert.strictEqual(lines.length, 4);
  assert.deepStrictEqual(plain(lines.map((l) => l.need ? Object.keys(l.need)[0] : null)), [null, 'hunts', 'guard', 'boss']);
  let r = L.talkNpc(s, ID);
  assert.strictEqual(r.i, 0);
  assert.deepStrictEqual(plain(r.gift), [['peanut_kisses', 3]]);
  assert.match(r.text, /Mang Tonyo gives you 3 Peanut Kisses\.$/);
  assert.strictEqual(L.countItem(s, 'peanut_kisses'), 3);
  r = L.talkNpc(roundTrip(s), ID);
  assert.strictEqual(r.gift, undefined, 'read again (even after a reload): nothing more');
  for (let i = 0; i < 5; i++) L.hunted(s, ID, 0, 'kambing', 1);
  r = L.talkNpc(s, ID);
  assert.strictEqual(r.i, 1);
  assert.strictEqual(L.countItem(s, 'kape_alamid'), 1);
  assert.strictEqual(L.countItem(s, 'cabbage'), 3, 'enough to start on the kid');
  // the guard and the boss at once: both gifts on the one talk
  const d = P().dungeon;
  L.hunted(s, CAVE, 0, d.guard, 1);
  L.hunted(s, CAVE, 0, d.boss, 1);
  r = L.talkNpc(s, ID);
  assert.strictEqual(r.i, 3);
  assert.deepStrictEqual(plain(r.gift), [['arrows', 15], ['peanut_kisses', 3], ['kaldereta', 2], ['peanut_kisses', 4]]);
  assert.strictEqual(L.countItem(s, 'kaldereta'), 2);
  assert.strictEqual(L.countItem(s, 'peanut_kisses'), 10);
  assert.ok(L.hasMedal(L.medalCheck(s) && s, 1205), 'the story medal');
  // other places' people give nothing here
  assert.strictEqual(L.talkNpc(s, 'sample_place').gift, undefined);
});

test('Bohol food: Kaldereta cooks from goat meat too; Peanut Kisses and Kape Alamid give energy and sell; Kanor buys the coffee', () => {
  const s = fresh();
  s.builds.kitchen = true;
  const r = C.RECIPES.find((x) => x.dish === 'kaldereta' && x.needs.includes('meat_goat'));
  assert.deepStrictEqual(plain(r.needs), ['meat_goat', 'potato', 'bell_pepper']);
  assert.ok(C.RECIPES.some((x) => x.dish === 'kaldereta' && x.needs.includes('meat_bear')), 'the bear one stays');
  ['meat_goat', 'potato', 'bell_pepper'].forEach((x) => L.addItem(s, x, 1));
  assert.strictEqual(L.cook(s, r), 'ok');
  assert.strictEqual(L.countItem(s, 'kaldereta'), 1);
  assert.ok(C.ITEMS.peanut_kisses.energy > 0 && C.ITEMS.peanut_kisses.sell > 0 && C.ITEMS.kape_alamid.energy > 0);
  L.addItem(s, 'kape_alamid', 2);
  assert.ok(L.wildGoods(s).includes('kape_alamid'));
  assert.strictEqual(L.sellToKanor(s, 'kape_alamid'), 2 * C.ITEMS.kape_alamid.sell);
});

test('the Hill Hollows: 10 floors, White Duwende from 1, Black from 3, the Punso Golem guards 5, the Great Nuno is 10; soloable; the lift; the daily chest stacks to 3', () => {
  const d = P().dungeon, kinds = (f) => plain(L.dunRoster(CAVE, f).map((e) => e.kind));
  assert.deepStrictEqual([d.floors, d.liftEvery, d.guardFloor, d.bossFloor], [10, 5, 5, 10]);
  assert.deepStrictEqual(kinds(1), ['duwendeputi', 'duwendeputi', 'duwendeputi']);
  assert.ok(kinds(2).every((k) => k === 'duwendeputi'));
  for (let f = 3; f <= 9; f++) if (f !== 5) assert.ok(kinds(f).every((k) => k === 'duwendeputi' || k === 'duwendeitim') && kinds(f).length >= 3 && kinds(f).length <= 5, 'floor ' + f);
  assert.ok([3, 4, 6, 7, 8, 9].some((f) => kinds(f).includes('duwendeitim')), 'the Black Duwende is about');
  assert.strictEqual(kinds(5)[0], 'punsogolem');
  assert.strictEqual(kinds(5).length, 3, 'the guard and its two');
  assert.strictEqual(kinds(10)[0], 'greatnuno');
  assert.strictEqual(kinds(10).length, 3);
  assert.deepStrictEqual([L.dunHp('greatnuno', 1), L.dunHp('greatnuno', 2), L.dunHp('greatnuno', 4)], [34, 50, 82], 'soloable; 16 more for each friend');
  assert.strictEqual(L.dunHp('punsogolem', 3), 22, 'the guard is the guard');
  const s = fresh();
  L.dunReach(s, CAVE, 7);
  assert.deepStrictEqual(plain(L.dunStops(roundTrip(s), CAVE)), [1, 6], 'the lift: every 5 floors you reached');
  // the boss: its chest once a day, missed days add up to 3
  assert.strictEqual(L.hunted(s, CAVE, 0, 'greatnuno', 1).chests, 1);
  assert.strictEqual(L.hunted(s, CAVE, 0, 'greatnuno', 1).chests, 0, 'once a day');
  s.day += 9;
  L.hunted(s, CAVE, 0, 'greatnuno', 1);
  assert.strictEqual(L.bossChests(s, ID), 3);
  assert.deepStrictEqual(plain(L.openBossChests(s, ID, () => 0)),
    [['moss_nuno', 3], ['peanut_kisses', 9], ['kape_alamid', 6], ['limestone_chip', 12], ['arrows', 45], ['clay_golem', 3]]);
  assert.deepStrictEqual(plain(L.openBossChests(s, ID, () => 0)), [], 'all opened');
  assert.ok(L.hasMedal(s, 1202) && !L.hasMedal(s, 1201), 'the boss medal; the guard\'s is its own');
});

test('the Hollow set: Kanor makes it from the hills\' drops and Gold; worn whole, a Musang charge costs 13 - 8 = 5, a Nuno\'s 18 - 8 = 10', () => {
  const s = fresh();
  s.gold = 19000;
  [['horn_goat', 10], ['tail_musang', 8], ['hat_duwende', 4], ['pebble_duwende', 4], ['clay_golem', 3], ['moss_nuno', 1]].forEach((x) => L.addItem(s, x[0], x[1]));
  assert.strictEqual(L.makeGear(s, 'bohol_charm'), 'ok');
  assert.strictEqual(L.makeGear(s, 'bohol_head'), 'ok');
  assert.strictEqual(L.makeGear(s, 'bohol_body'), 'ok');
  assert.strictEqual(L.makeGear(s, 'bohol_feet'), 'ok');
  assert.strictEqual(s.gold, 0, '3,500 + 6,000 + 3,500 + 6,000');
  assert.strictEqual(L.wornSet(s), ID);
  assert.deepStrictEqual(plain(C.GEAR_SLOTS.map((k) => C.PLACE_GEAR[ID + '_' + k].name)), ['Hollow Hat', 'Hollow Vest', 'Hollow Boots', 'Hollow Charm']);
  assert.strictEqual(L.chargeLoss(s, A('musang').hit, 'musang'), 5);
  assert.strictEqual(L.chargeLoss(s, A('greatnuno').hit, 'greatnuno'), 10);
  assert.strictEqual(L.chargeLoss(s, A('boar').hit, 'boar'), 2, 'elsewhere: 6 off');
  const t = fresh();
  t.gold = 99999;
  assert.strictEqual(L.makeGear(t, 'bohol_charm'), 'short', 'it needs the hills\' drops');
});

test('Chocolate Hills: its medals, its 5 chests, and % explored (4 animals with the kid, 5 chests, 4 lines, guard, boss)', () => {
  const codes = plain(C.MEDALS.filter((m) => m.place === ID).map((m) => m.code).sort((a, b) => a - b));
  assert.deepStrictEqual(codes, [1200, 1201, 1202, 1203, 1204, 1205, 1210, 1211, 1212, 1213, 1214]);
  assert.strictEqual(C.MEDAL_BY_CODE[1201].title, 'Punso Golem defeated');
  assert.strictEqual(C.MEDAL_BY_CODE[1202].title, 'Great Nuno defeated');
  assert.strictEqual(C.MEDAL_BY_CODE[1214].title, 'Rare: Cocoa Goat');
  const s = fresh();
  assert.deepStrictEqual(plain(L.placeExplored(s, ID).parts), { animals: [0, 4], chests: [0, 5], story: [0, 4], guard: [0, 1], boss: [0, 1] });
  for (let i = 0; i < 5; i++) assert.ok(L.openPlaceChest(s, ID, i, () => 0).some((x) => x[0] === 'peanut_kisses'), 'chest ' + i);
  assert.strictEqual(L.openPlaceChest(s, ID, 2, () => 0), null, 'once');
  assert.ok(L.hasMedal(L.medalCheck(s) && s, 1204), 'every chest');
  assert.strictEqual(L.placeExplored(roundTrip(s), ID).pct, 33, '5 of 15');
});

test('Chocolate Hills\' maps: the Jeep, the cave door and its way back, the person and every chest on free tiles, all reachable from the Jeep; the Hollows\' way in and out', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'bohol.json'), 'utf8'));
  const W = m.width, H = m.height, T = 256, objs = m.layers.find((l) => l.name === 'Objects').objects;
  const by = (name) => objs.find((o) => o.name === name);
  assert.deepStrictEqual(['jeep', 'from_jeep', 'dungeon_door', 'dungeon_mouth', 'from_dungeon', 'wild'].map((n) => !!by(n)), [true, true, true, true, true, true]);
  assert.deepStrictEqual(plain(by('dungeon_door').properties.map((p) => p.value)), [CAVE, 'entrance', true]);
  assert.ok(m.tilesets.every((t) => t.name !== 'props'), 'lean: no props tileset');
  // solid: the tiles that collide, the props' feet, the cave mouth's rock, the jeep, the person
  const ts = m.tilesets[0], solid = new Set();
  ts.tiles.forEach((t) => { if (t.properties.some((p) => p.name === 'collides' && p.value)) solid.add(ts.firstgid + t.id); });
  const layers = m.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Above');
  const FOOT = { hill: 2, hut: 2, palm: 1, fence: 1, cogon: 0, rock: 1 }, covered = new Set(), blocked = new Set();
  objs.filter((o) => o.type === 'bohol').forEach((o) => {
    assert.ok(FOOT[o.name] != null, o.name);
    const x0 = o.x / T, y0 = o.y / T, w = o.width / T, h = o.height / T;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      assert.ok(!covered.has(y * W + x), 'props do not overlap at ' + x + ',' + y);
      covered.add(y * W + x);
      if (y >= y0 + h - FOOT[o.name]) blocked.add(y * W + x);
    }
  });
  const mp = by('dungeon_mouth'), cx = Math.floor(mp.x / T), foot = Math.round(mp.y / T) - 1;
  [[cx - 1, foot - 2, 1, 3], [cx + 1, foot - 2, 1, 3], [cx, foot - 2, 1, 2]].forEach((b) => { for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) { assert.ok(!covered.has(y * W + x), 'clear of the mouth'); blocked.add(y * W + x); } });
  const jeep = by('jeep');
  for (let x = jeep.x / T; x < (jeep.x + jeep.width) / T; x++) blocked.add((jeep.y / T) * W + x);
  const npc = P().npc.at;
  blocked.add(npc[1] * W + npc[0]);
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !blocked.has(y * W + x) && !layers.some((l) => solid.has(l.data[y * W + x]));
  [npc].concat(P().chests).forEach(([x, y]) => assert.ok(!covered.has(y * W + x) && layers.every((l) => !solid.has(l.data[y * W + x])), 'free: ' + x + ',' + y));
  const sp = by('from_jeep'), start = [Math.floor(sp.x / T), Math.floor(sp.y / T)], seen = new Set([start[1] * W + start[0]]), q = [start];
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = (y + dy) * W + x + dx; if (walk(x + dx, y + dy) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); } });
  }
  P().chests.forEach(([x, y]) => assert.ok(seen.has(y * W + x), 'chest at ' + x + ',' + y + ' is reachable'));
  assert.ok(seen.has((npc[1] + 1) * W + npc[0]), 'you can stand before Mang Tonyo');
  assert.ok(seen.has((by('dungeon_door').y / T + 1) * W + by('dungeon_door').x / T), 'and before the door');
  let island = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (walk(x, y) && !seen.has(y * W + x)) island++;
  assert.strictEqual(island, 0, 'no animal can stand where you cannot go');
  // the cave
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'bohol_cave.json'), 'utf8')), co = c.layers.find((l) => l.name === 'Objects').objects;
  const exit = co.find((o) => o.name === 'exit');
  assert.deepStrictEqual(plain(exit.properties.map((p) => p.value)), [ID, 'from_dungeon', 'Climb out']);
  assert.ok(co.some((o) => o.type === 'dungeon_gate') && co.some((o) => o.name === 'entrance') && co.some((o) => o.type === 'wild'));
  assert.ok(fs.statSync(path.join(__dirname, '..', 'maps', 'bohol.json')).size + fs.statSync(path.join(__dirname, '..', 'maps', 'bohol_cave.json')).size < 36000, 'both maps lean');
});
