// Place 14: Sierra Madre and Kapre's Roots (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-14-sierra.js,
// src/01-logicZZZZZ-place-14-sierra.js, maps/sierra.json, maps/sierra_cave.json): its data and art names, the Unggoy
// hunted and the Little Unggoy tamed, Ka Ramon's story and gifts, the cave's floors and boss, the Kapre set, the map.
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
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 14; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const ID = 'sierra';
const P = () => C.PLACES[ID];
const WA = C.WILD.animals;

test('Sierra Madre: place 14, open at 130 hunts, its 16 items in the icons order, every art name wired', () => {
  const p = P();
  assert.strictEqual(p.n, 14);
  assert.strictEqual(p.name, 'Sierra Madre');
  const s = fresh();
  s.wild.n = 129;
  assert.strictEqual(L.placeOpen(s, ID), false);
  s.wild.n = 130;
  assert.strictEqual(L.placeOpen(s, ID), true);
  assert.ok(L.jeepPlaces(s).some((x) => x.id === ID && x.open), 'in the Jeep\'s list (not a dev place)');
  // the fixed ids (docs/places-items.json), all new and Sierra Madre's, in the icons sheet's order
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'places-items.json'), 'utf8')).sierra;
  assert.deepStrictEqual(plain(C.SIERRA_ICONS), j.items.map((x) => x.id));
  const gearIds = C.GEAR_SLOTS.map((k) => C.PLACE_GEAR[ID + '_' + k].art);
  assert.deepStrictEqual(plain(gearIds), ['ranger_hat', 'ranger_vest', 'ranger_boots', 'kapre_charm']);
  j.items.forEach((x) => { if (!gearIds.includes(x.id)) assert.ok(C.ITEMS[x.id] && C.ITEMS[x.id].place === ID && Number.isInteger(C.ITEMS[x.id].icon), x.id); });
  assert.ok(!C.SIERRA_ICONS.some((x) => C.ICON[x] != null), 'no icon of its own until icons_sierra.png is in the sheet');
  // art: the creatures' sheets, Ka Ramon's, the mouth, the gate, the cave
  const sheets = { unggoy: 'wild_unggoy', carabaoligaw: 'wild_carabaoligaw', silvercarabao: 'wild_silvercarabao', unggoy_bata: 'wild_unggoy',
    anggitay: 'wild_anggitay', woodspirit: 'wild_woodspirit', anggitayqueen: 'wild_anggitayqueen', kapre: 'wild_kapre' };
  Object.keys(sheets).forEach((k) => {
    assert.strictEqual(WA[k].sheet, sheets[k], k);
    assert.ok(C.WILD.order.includes(WA[k].sheetRow) && WA[k].tint, k + ': a stand-in row and tint');
  });
  assert.strictEqual(p.npc.sheet, 'npc_ka_ramon');
  assert.ok(C.VILLAGER_ORDER.includes(p.npc.look));
  assert.deepStrictEqual(plain(p.dungeon.art), { mouth: 'props/sierra_mouth', gate: 'props/sierra_gate', cave: 'sierra_cave' });
  assert.deepStrictEqual(plain(p.art), { ground: 'ground_sierra', water: 'ground_sierra_water', props: 'props_sierra' });
  // medals: n x 100 and up, its own
  assert.ok(C.MEDAL_BY_CODE[1400] && C.MEDAL_BY_CODE[1402].title === 'Kapre defeated' && C.MEDAL_BY_CODE[1401].title === 'Anggitay Queen defeated');
  assert.strictEqual(C.MEDAL_BY_CODE[1403].title, 'Little Unggoy tamed');
  assert.ok(C.MEDALS.filter((m) => m.place === ID).every((m) => m.code >= 1400 && m.code < 1500));
});

test('Sierra Madre: the Unggoy is for the Bow and drops its bananas; the Little Unggoy is tamed with them, ~10 feedings, it may run off', () => {
  assert.ok(!WA.unggoy.tameOnly && WA.unggoy.shy > 0, 'shy, and huntable');
  assert.deepStrictEqual(plain(WA.unggoy.drops[0]), ['banana_wild', 2, 1], 'the bananas it carried');
  assert.ok(WA.carabaoligaw.angry && WA.carabaoligaw.hit, 'the Wild Carabao charges');
  assert.ok(WA.silvercarabao.rare);
  assert.strictEqual(WA.unggoy_bata.tameOnly, true);
  const s = fresh(), t = P().tame;
  assert.strictEqual(t.feedings, 10);
  assert.ok(L.wildSlots(ID).some((e) => e.kind === 'unggoy_bata'), 'it roams the place');
  L.addItem(s, 'banana_wild', 12);
  s.sel = s.inv.findIndex((x) => x && x.id === 'banana_wild');
  assert.strictEqual(L.canFeed(s, ID, 'idle', 1.2), true);
  for (let i = 0; i < 8; i++) assert.strictEqual(L.feedTame(s, ID, () => 0.9), 'fed');
  assert.strictEqual(L.feedTame(s, ID, () => 0.1), 'ran', 'a 1 in 4 it runs off');
  assert.strictEqual(L.feedTame(s, ID, () => 0.9), 'away');
  clock.advance(t.back + 1);
  assert.strictEqual(L.feedTame(s, ID, () => 0.1), 'tame', 'the 10th');
  assert.strictEqual(L.companionSkill(roundTrip(s)), 'fetch', 'it picks up drops for you');
  assert.strictEqual(L.countItem(s, 'banana_wild'), 2);
});

test('Sierra Madre: Ka Ramon\'s four lines open with the hunts, the guard and the boss; each gives its small gift once', () => {
  const s = fresh(), d = P().dungeon;
  let r = L.talkNpc(s, ID);
  assert.strictEqual(r.i, 0);
  assert.match(r.text, /Ka Ramon[\s\S]*\(You got 2 Wild Honey\.\)$/);
  assert.strictEqual(L.countItem(s, 'wild_honey'), 2);
  r = L.talkNpc(s, ID);
  assert.ok(!r.gift && L.countItem(s, 'wild_honey') === 2, 'once');
  for (let i = 0; i < 5; i++) L.hunted(s, ID, 0, 'unggoy', 1);
  const arrows = L.countItem(s, 'arrows');
  assert.match(L.talkNpc(s, ID).text, /Little Unggoy[\s\S]*You got 10 Arrows/);
  assert.strictEqual(L.countItem(s, 'arrows'), arrows + 10);
  // the guard and the boss both down before you talk: both lines' gifts at once
  L.hunted(s, d.key, 0, d.guard, 1);
  L.hunted(s, d.key, 0, d.boss, 1);
  r = L.talkNpc(s, ID);
  assert.strictEqual(r.i, 3);
  assert.match(r.text, /You got 2 Narra Wood, 1 Kare-Kare, 1 Wild Honey\./);
  assert.deepStrictEqual([L.countItem(s, 'narra_wood'), L.countItem(s, 'kare_kare'), L.countItem(s, 'wild_honey')], [2, 1, 3]);
  L.medalCheck(s);
  assert.ok(L.hasMedal(s, 1405), 'his story');
  assert.ok(!L.talkNpc(roundTrip(s), ID).gift, 'never again, after a save too');
  // the forest theme, and no smoke anywhere in the place
  const words = JSON.stringify(P()).toLowerCase();
  assert.ok(!/cigar|smok|tobacco/.test(words));
});

test('Kapre\'s Roots: 10 floors, the Anggitay Queen leads floor 5, the Kapre floor 10 (soloable, stronger with friends), the daily chest', () => {
  const d = P().dungeon;
  assert.strictEqual(d.floors, 10);
  assert.ok(L.dunRoster(d.key, 1).every((e) => e.kind === 'anggitay'), 'floor 1: Anggitay');
  assert.ok(L.dunRoster(d.key, 4).some((e) => e.kind === 'woodspirit') || L.dunRoster(d.key, 6).some((e) => e.kind === 'woodspirit'), 'Wood Spirits deeper');
  assert.deepStrictEqual(plain(L.dunRoster(d.key, 5).map((e) => e.kind)).slice(0, 1), ['anggitayqueen']);
  assert.strictEqual(L.dunRoster(d.key, 5).length, 3, 'the guard and two with her');
  assert.strictEqual(L.dunRoster(d.key, 10)[0].kind, 'kapre');
  assert.ok(L.dunRoster(d.key, 9).length <= 6);
  assert.strictEqual(L.dunHp('kapre', 1), 41, 'soloable (41: between Taal\'s Berberoka 40 and Palawan\'s Minokawa 42, under the Lair\'s deep floors)');
  assert.strictEqual(L.dunHp('kapre', 3), 73, '16 more for each friend');
  assert.strictEqual(WA.kapre.minHits, 3);
  const s = fresh();
  assert.strictEqual(L.hunted(s, d.key, 0, 'kapre', 1).chests, 1);
  s.day += 9;
  L.hunted(s, d.key, 0, 'kapre', 1);
  assert.strictEqual(L.bossChests(s, ID), 3, 'up to 3 wait');
  const loot = plain(L.openBossChests(s, ID, () => 0));
  assert.deepStrictEqual(loot, [['bark_kapre', 6], ['narra_wood', 9], ['wild_honey', 6], ['arrows', 36], ['silver_horn', 3]]);
  assert.deepStrictEqual(plain(L.openBossChests(s, ID, () => 0.99)), [], 'none left');
});

test('Sierra Madre: the Kapre set at Kanor\'s from its drops and Gold; a whole set takes 8 off its own creatures\' charges; Kare-Kare cooks', () => {
  const s = fresh();
  s.gold = 30000;
  [['fur_unggoy', 8], ['banana_wild', 6], ['hide_carabao', 10], ['mane_anggitay', 3], ['moss_spirit', 4], ['bark_kapre', 2], ['narra_wood', 3], ['ribbon_queen', 1]]
    .forEach(([id, n]) => L.addItem(s, id, n));
  C.GEAR_SLOTS.forEach((k) => assert.strictEqual(L.makeGear(s, ID + '_' + k), 'ok', k));
  assert.strictEqual(s.gold, 30000 - 4500 - 8000 - 4500 - 8000);
  assert.strictEqual(L.wornSet(s), ID);
  assert.strictEqual(L.chargeLoss(s, WA.carabaoligaw.hit, 'carabaoligaw'), 10, '18 - 8');
  assert.strictEqual(L.chargeLoss(s, WA.kapre.hit, 'kapre'), 16, 'the cave too');
  assert.strictEqual(L.chargeLoss(s, 18, 'boar'), 12, 'elsewhere, 6 off');
  // Kare-Kare: any meat, an eggplant and wild bananas
  const t = fresh();
  t.builds.kitchen = 1;
  ['meat_boar', 'eggplant', 'banana_wild'].forEach((id) => L.addItem(t, id, 1));
  assert.strictEqual(L.cook(t, C.RECIPES.find((x) => x.dish === 'kare_kare')), 'ok');
  assert.strictEqual(L.countItem(t, 'kare_kare'), 1);
  assert.ok(C.ITEMS.kare_kare.energy > C.ITEMS.bistek.energy && C.ITEMS.wild_honey.energy > 0);
});

test('Sierra Madre\'s map: the Jeep, the wild, the balete\'s door; the river is not walkable; from the Jeep you can walk to Ka Ramon, every chest and the door', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'sierra.json'), 'utf8'));
  const cave = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'sierra_cave.json'), 'utf8'));
  const objs = m.layers.find((l) => l.name === 'Objects').objects, T = m.tilewidth, W = m.width, H = m.height;
  const by = (name) => objs.find((o) => o.name === name);
  ['jeep', 'from_jeep', 'wild', 'dungeon_door', 'dungeon_mouth', 'from_dungeon'].forEach((n) => assert.ok(by(n), n));
  assert.strictEqual(by('dungeon_door').properties.find((x) => x.name === 'to').value, 'sierra_cave');
  const exit = cave.layers.find((l) => l.name === 'Objects').objects.find((o) => o.name === 'exit');
  assert.deepStrictEqual(exit.properties.filter((x) => x.name !== 'label').map((x) => x.value), ['sierra', 'from_dungeon']);
  assert.ok(cave.layers.find((l) => l.name === 'Objects').objects.some((o) => o.type === 'dungeon_gate'));
  // what is solid: walls, water, the props' feet, the jeep, the rock round the mouth
  const props = {};
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { props[t.id + ts.firstgid] = t.properties || []; }));
  const has = (gid, name) => (props[gid] || []).some((x) => x.name === name && x.value);
  const solid = new Set();
  ['Ground', 'Walls'].forEach((ln) => m.layers.find((l) => l.name === ln).data.forEach((g, i) => { if (has(g, 'collides')) solid.add(i); }));
  let water = 0;
  m.layers.find((l) => l.name === 'Ground').data.forEach((g) => { if (has(g, 'water')) water++; });
  assert.ok(water > 30, 'a river and a pool');
  objs.filter((o) => o.type === 'prop').forEach((o) => {
    const foot = (props[o.gid] || []).find((x) => x.name === 'foot').value, x0 = o.x / T, w = o.width / T, bottom = o.y / T;
    for (let y = bottom - foot; y < bottom; y++) for (let x = x0; x < x0 + w; x++) solid.add(y * W + x);
  });
  const j = by('jeep');
  for (let x = j.x / T; x < (j.x + j.width) / T; x++) solid.add((j.y / T) * W + x);
  const door = by('dungeon_door'), cx = door.x / T, top = door.y / T;
  [[cx - 1, top - 2, 1, 3], [cx + 1, top - 2, 1, 3], [cx, top - 2, 1, 2]].forEach(([x0, y0, w, h]) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) solid.add(y * W + x); });
  // a walk from the Jeep's stop
  const start = by('from_jeep'), seen = new Set([Math.floor(start.y / T) * W + Math.floor(start.x / T)]), q = [...seen];
  while (q.length) {
    const i = q.shift(), x = i % W, y = Math.floor(i / W);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || solid.has(k)) return;
      seen.add(k);
      q.push(k);
    });
  }
  const p = P();
  assert.ok(!solid.has(p.npc.at[1] * W + p.npc.at[0]) && seen.has((p.npc.at[1] + 1) * W + p.npc.at[0]), 'Ka Ramon stands on free ground, and you can walk up to him');
  p.chests.forEach(([x, y]) => assert.ok(seen.has(y * W + x), 'chest ' + x + ',' + y + ' can be reached'));
  assert.ok(seen.has(top * W + cx), 'the door down, over the bridge');
  const wild = by('wild');
  assert.ok(wild.width / T >= 20 && wild.height / T >= 20, 'about Pulag\'s size');
});
