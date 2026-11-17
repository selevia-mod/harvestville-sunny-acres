// The Open Plains (owner, 18 Nov 2026; src/00-zzz...z-plains.js, src/01-logicZ...Z-plains.js): Manila's first hunting ground,
// the Rifle's, and its 50-floor cave, Sarangay's Halls; and the Armory opening. The unlock at 30 hunts, its animals and
// the flocks, the Tamaraw Calf and its carry skill, the cave, drops, prices, the dish and the Plainsrunner set, every
// Rifle level built from what the game drops, the Armory, a shot's energy, the horse, the valley road and the saves.
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
const plain = (x) => JSON.parse(JSON.stringify(x));
const fresh = () => { clock.set(2026, 11, 18, 10, 0); const s = L.newState(); s.seed = 21; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const P = C.PLACES.plains;
const D = P.dungeon;
const A = WI.animals;
const map = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', name + '.json'), 'utf8'));
const tame = (s) => { L.addItem(s, 'oats', 20); for (let i = 0; i < 30 && !L.tamed(s, 'plains'); i++) { const r = L.feedTame(s, 'plains', () => 0.99); if (r === 'ran') L.placeRec(s, 'plains').ta = 0; } };

test('the Open Plains: place 21, opens at 30 hunts, reached by the valley road (not the Jeep), its cave Sarangay\'s Halls', () => {
  assert.deepStrictEqual([P.n, P.unlock, P.map, D.key, D.name, D.floors], [21, 30, 'plains', 'plains_cave', "Sarangay's Halls", 50]);
  const s = fresh();
  s.wild.n = 29;
  assert.strictEqual(L.wildOpen(s, 'plains'), false, '29 hunts: shut');
  assert.strictEqual(L.wildOpen(s, 'plains_cave'), false);
  s.wild.n = 30;
  assert.strictEqual(L.wildOpen(s, 'plains'), true, '30 hunts: open');
  assert.strictEqual(L.wildOpen(s, 'plains_cave'), true);
  assert.ok(L.isWildMap('plains') && L.isWildMap('plains_cave'), 'a hunting place: the Bow, the dog, friends');
  assert.ok(!L.jeepPlaces(s).some((e) => e.id === 'plains'), 'not in Kanor\'s Jeep: the valley road goes there');
  assert.ok(L.jeepPlaces(s).some((e) => e.id === 'palawan'), 'the Jeep\'s places stay');
  assert.strictEqual(P.npc.name, 'Ka Pedring');
  assert.strictEqual(P.npc.sheet, 'npc_ka_pedring');
  assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'npc_ka_pedring.png')), "Ka Pedring's picture");
  // its 4 lines (first visit, 5 hunts, the guard, the boss), each with a small gift that is an item
  assert.deepStrictEqual(plain(P.npc.lines.map((l) => (l.need ? Object.keys(l.need)[0] : 'first'))), ['first', 'hunts', 'guard', 'boss']);
  P.npc.lines.forEach((l, i) => { assert.ok(l.gift && l.gift.length, 'line ' + i); l.gift.forEach((g) => assert.ok(C.ITEMS[g[0]] && g[1] > 0, g[0])); });
  // medals from 2100
  const codes = C.MEDALS.filter((m) => m.place === 'plains').map((m) => m.code);
  assert.ok(codes.length >= 10 && codes.every((c) => c >= 2100 && c < 2200));
});

test('its animals: the notes\' animals made harder (the owner: difficulty is in the animals), cute names, every drop an item', () => {
  assert.deepStrictEqual(plain(P.kinds), ['pugo', 'tikling', 'batikdeer', 'toro', 'kuwago', 'bulalakaw']);
  assert.deepStrictEqual(plain(P.animals), { pugo: 6, tikling: 4, batikdeer: 6, toro: 3 });
  // the notes' hits to bring one down, and now (about 1.5 times)
  const NOTES = { pugo: 1, tikling: 2, batikdeer: 4, kuwago: 2, toro: 8, bulalakaw: 5, lampong: 4, salagubang: 5, sarangay: 22, arimaonga: 34 };
  Object.keys(NOTES).forEach((k) => assert.ok(A[k].hp > NOTES[k] && A[k].hp <= NOTES[k] * 2, k + ': harder than the notes, ' + A[k].hp));
  // far off: they run while you are still far (shy 4.8 to 9), past the Bow's Basic reach
  ['pugo', 'tikling', 'batikdeer', 'kuwago', 'bulalakaw'].forEach((k) => assert.ok(A[k].shy >= 4.8 && A[k].shy <= 9 && A[k].shy > WI.bow.range[0], k));
  // the Wild Toro charges from 4.5 tiles: a Copper Rifle (reach 5) hits it before it starts
  assert.strictEqual(A.toro.angry, 4.5);
  assert.ok(L.weaponRange('rifle', 1) > A.toro.angry && A.toro.hit >= 15);
  assert.ok(A.bulalakaw.rare && A.bulalakaw.shy === 9, 'the comet bird: only a sneaking Rifle reaches it');
  assert.ok(P.extra.some((x) => x.kind === 'kuwago' && x.when === 'dusk') && P.extra.some((x) => x.kind === 'bulalakaw' && x.when === 'rare'));
  // every creature has the owner's picture (art-src/manila/plains) and a stand-in row until it is in
  Object.keys(P.creatures).concat(Object.keys(D.creatures)).forEach((k) => {
    assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'plains', A[k].sheet + '.png')), k + ': ' + A[k].sheet);
    assert.ok(WI.order.includes(A[k].sheetRow), k + ': a stand-in row');
    (A[k].drops || []).forEach((d) => assert.ok(C.ITEMS[d[0]], k + ' drops ' + d[0]));
  });
  // the grown Tamaraw are never a target: only the calf is a creature, and it is fed, not hunted
  assert.ok(A.tamaraw_calf.tameOnly && !A.tamaraw_calf.drops.length);
  assert.ok(!A.tamaraw, 'no grown Tamaraw creature: the herd is scenery');
});

test('flocks: the Pugo and the Batik Deer in threes (a leader and two behind it, side by side), the others alone', () => {
  assert.strictEqual(A.pugo.flock, 3);
  assert.strictEqual(A.batikdeer.flock, 3);
  ['tikling', 'toro', 'kuwago', 'bulalakaw'].forEach((k) => assert.ok(!A[k].flock, k));
  const slots = L.wildSlots('plains');
  const of = (kind, when) => slots.filter((e) => e.kind === kind && (e.when || '') === (when || '')).map((e) => e.slot);
  const pugo = of('pugo'), deer = of('batikdeer'), dawn = of('pugo', 'dawn');
  assert.deepStrictEqual(plain(L.flockOf('plains', pugo[0])), plain({ lead: pugo[0], slots: pugo.slice(0, 3), i: 0 }));
  assert.deepStrictEqual(plain(L.flockOf('plains', pugo[4])), plain({ lead: pugo[3], slots: pugo.slice(3, 6), i: 1 }));
  assert.deepStrictEqual(plain(L.flockOf('plains', deer[5])), plain({ lead: deer[3], slots: deer.slice(3, 6), i: 2 }));
  assert.deepStrictEqual(plain(L.flockOf('plains', dawn[2])), plain({ lead: dawn[0], slots: dawn, i: 2 }), 'the dawn\'s three are a flock of their own');
  assert.strictEqual(L.flockOf('plains', of('toro')[0]), null);
  assert.strictEqual(L.flockOf('pulag', 0), null, 'no flocks anywhere before');
  // where each stands: the leader where it is; the others in a line behind it, a little to each side
  const T = C.TILE, lead = { x: 10 * T, y: 10 * T };
  assert.deepStrictEqual(plain(L.flockSpot(lead.x, lead.y, 0, 0, T)), lead);
  const a = L.flockSpot(lead.x, lead.y, 0, 1, T), b = L.flockSpot(lead.x, lead.y, 0, 2, T);
  assert.ok(a.x < lead.x && b.x < a.x, 'behind it, going right: further left one after the other');
  assert.ok(Math.abs((lead.x - a.x) / T - WI.flockGap) < 0.01 && Math.abs((a.x - b.x) / T - WI.flockGap) < 0.01, WI.flockGap + ' tiles apart');
  assert.ok(Math.sign(a.y - lead.y) !== Math.sign(b.y - lead.y), 'one to each side');
  // in a line, so the Moon Rifle's shot (through the first into the one behind) meets the next one
  assert.ok(Math.abs(a.y - lead.y) < 0.5 * T && Math.abs(b.y - lead.y) < 0.5 * T);
  const d1 = L.flockSpot(lead.x, lead.y, 0, 1, T, A.batikdeer.w);
  assert.ok((lead.x - d1.x) / T >= A.batikdeer.w, 'a deer stands its own width apart: never on top of the next');
  assert.strictEqual(L.weaponMoon('rifle', 5), 'pierce');
});

test('the Tamaraw Calf: planted oats, 10 feedings; tamed, it carries 6 more things in your bag (and only while it is out)', () => {
  assert.deepStrictEqual([P.tame.kind, P.tame.food, P.tame.feedings, P.tame.skill], ['tamaraw_calf', 'oats', 10, 'carry']);
  assert.ok(C.ITEMS.oats && C.CROPS.oats, 'oats are planted');
  assert.strictEqual(C.COMPANION_SKILLS.carry.slots, 6);
  const s = fresh(), bag = s.inv.length, lv = L.bagLevel(s);
  tame(s);
  assert.ok(L.tamed(s, 'plains'));
  assert.strictEqual(L.companion(s), 'plains', 'the first one tamed comes along');
  assert.strictEqual(L.carrySlots(s), 6);
  assert.strictEqual(s.inv.length, bag + 6, '6 more slots');
  assert.strictEqual(L.bagLevel(s), lv, 'the bag itself is the same bag');
  // fill them, save, load: the slots and what is in them stay
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'cogon_bundle', n: 3 };
  const back = roundTrip(s);
  assert.strictEqual(back.inv.length, bag + 6);
  assert.deepStrictEqual(plain(back.inv[bag + 5]), { id: 'cogon_bundle', n: 3 });
  assert.strictEqual(back.comp, 'plains');
  // a bigger bag at the Market keeps the calf's 6 on top
  assert.strictEqual(L.nextBag(back).size, C.BAG_SIZES[lv + 1] + 6);
  back.gold = 1e7;
  assert.strictEqual(L.upgradeBag(back), 'ok');
  assert.strictEqual(back.inv.length, C.BAG_SIZES[lv + 1] + 6);
  assert.strictEqual(L.bagLevel(back), lv + 1);
  // sent back to the Lodge: the 6 go; what was in them goes into the bag, else home to the basket (nothing lost)
  const t = fresh();
  tame(t);
  t.inv = t.inv.map(() => null);
  t.inv[0] = { id: 'arrows', n: 5 };
  t.inv[t.inv.length - 1] = { id: 'toro_hide', n: 2 };
  t.inv[t.inv.length - 2] = { id: 'egg_pugo', n: 4 };
  assert.strictEqual(L.setCompanion(t, ''), 'ok');
  assert.strictEqual(t.inv.length, bag);
  assert.strictEqual(L.countItem(t, 'toro_hide'), 2, 'into a free slot');
  assert.strictEqual(L.countItem(t, 'egg_pugo'), 4);
  const full = fresh();
  tame(full);
  for (let i = 0; i < full.inv.length; i++) full.inv[i] = { id: 'cogon_bundle', n: L.stackLimit('cogon_bundle') };
  full.inv[full.inv.length - 1] = { id: 'toro_horn', n: 3 };
  L.setCompanion(full, '');
  assert.strictEqual(full.inv.length, bag);
  assert.strictEqual(full.basket.toro_horn, 3, 'no room: home to the basket');
  assert.ok(full.carryHome >= 3, 'the count that went home');
  // out again: the 6 come back
  L.setCompanion(full, 'plains');
  assert.strictEqual(full.inv.length, bag + 6);
  // an old save with no calf: the same bag as before
  assert.strictEqual(roundTrip(fresh()).inv.length, bag);
});

test("Sarangay's Halls: 50 floors, a lift every 10, a Sarangay on every 10th floor (tougher each time), the Arimaonga on 50", () => {
  assert.deepStrictEqual([D.floors, D.liftEvery, D.guardFloor, D.guardEvery, D.bossFloor], [50, 10, 10, 10, 50]);
  assert.deepStrictEqual([D.guard, D.boss], ['sarangay', 'arimaonga']);
  const guards = [];
  for (let f = 1; f <= 50; f++) { const w = L.dunWho(D, f); if (w) guards.push(f + ':' + w); }
  assert.deepStrictEqual(guards, ['10:sarangay', '20:sarangay', '30:sarangay', '40:sarangay', '50:arimaonga']);
  assert.ok(L.dunHp('sarangay', 1, 40) > L.dunHp('sarangay', 1, 10), 'deeper guards are tougher');
  assert.strictEqual(L.dunHp('arimaonga', 1, 50), A.arimaonga.hp, 'soloable');
  assert.strictEqual(L.dunHp('arimaonga', 3, 50), A.arimaonga.hp + 2 * A.arimaonga.hpEach, 'more health for each friend');
  assert.ok(A.sarangay.boss && A.arimaonga.boss && A.arimaonga.minHits === 3);
  // each floor's roster: the guard leads its floor; the beetles come from floor 6
  assert.ok(L.dunRoster('plains_cave', 1).every((e) => e.kind === 'lampong'));
  assert.strictEqual(L.dunRoster('plains_cave', 10)[0].kind, 'sarangay');
  assert.strictEqual(L.dunRoster('plains_cave', 50)[0].kind, 'arimaonga');
  assert.ok(L.dunRoster('plains_cave', 35).some((e) => e.kind === 'salagubang'));
  // the lift: every 10 floors you have reached
  const s = fresh();
  s.wild.n = 30;
  assert.deepStrictEqual(plain(L.dunStops(s, 'plains_cave')), [1]);
  L.dunReach(s, 'plains_cave', 34);
  assert.deepStrictEqual(plain(L.dunStops(s, 'plains_cave')), [1, 11, 21, 31]);
  // the guard and the boss are remembered; the boss's daily chest
  L.hunted(s, 'plains_cave', 0, 'sarangay', 1);
  assert.strictEqual(L.placeRec(s, 'plains').g, 1);
  L.hunted(s, 'plains_cave', 0, 'arimaonga', 1);
  assert.strictEqual(L.bossChests(s, 'plains'), 1);
  const loot = L.openBossChests(s, 'plains', () => 0);
  assert.ok(loot.some((x) => x[0] === 'arimaonga_mane'));
  // the horse in the cave (owner): 10 hearts and the Lantern Bridle
  assert.strictEqual(L.horseZone('plains_cave'), 'cave');
  // the built cave: the way back up, the gate down, the creatures' zone
  const cave = L.plainsCaveMap(map('palawan_cave')), obj = cave.layers[3].objects;
  ['entrance', 'exit', 'dungeon_gate', 'wild'].forEach((n) => assert.ok(obj.some((o) => o.name === n), n));
  assert.strictEqual(obj.filter((o) => o.name === 'exit')[0].properties[0].value, 'plains');
});

test('drops and prices: Plains drops 20 to 150, the comet feather 900, the guard\'s jewel 900-2,200, the boss\'s mane 1,400-3,400', () => {
  const plainsDrops = ['meat_pugo', 'egg_pugo', 'feather_tikling', 'venison_batik', 'antler_batik', 'feather_kuwago', 'beef_toro', 'toro_hide', 'toro_horn', 'lampong_hat', 'shell_salagubang'];
  plainsDrops.forEach((id) => assert.ok(C.ITEMS[id].sell >= 20 && C.ITEMS[id].sell <= 150, id + ' ' + C.ITEMS[id].sell));
  assert.strictEqual(C.ITEMS.comet_feather.sell, 900);
  assert.ok(C.ITEMS.sarangay_jewel.sell >= 900 && C.ITEMS.sarangay_jewel.sell <= 2200);
  assert.ok(C.ITEMS.arimaonga_mane.sell >= 1400 && C.ITEMS.arimaonga_mane.sell <= 3400);
  // every item of the place: its own icon painted at load (the page's items sheet does not grow), sold at the stand
  Object.keys(P.items).forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it.sell > 0 && it.name && it.desc, id);
    if (id !== 'beef_toro') assert.strictEqual(it.icon, C.plainsIcon(id), id + ': its painted icon');
    assert.ok(/^[a-z][a-z_]{0,23}$/.test(id), id);
  });
  assert.strictEqual(C.ITEMS.beef_toro.icon, C.ICON.meat_boar, 'no picture of its own yet: the boar meat\'s');
  assert.ok(!C.PLAINS_ICONS.some((id) => C.ICON_ORDER.includes(id)), 'not in the page\'s items sheet');
  // the dish: Kwek-Kwek, pugo eggs and wheat, 70 energy, and its power
  assert.ok(C.RECIPES.some((r) => r.dish === 'kwek_kwek' && r.needs.join() === 'egg_pugo,wheat'));
  assert.strictEqual(C.ITEMS.kwek_kwek.energy, 70);
  assert.strictEqual(C.DISH_POWERS.kwek_kwek.key, 'sneak');
  // the hidden chests and the boss chest give items there are
  P.chestLoot.concat(D.chest).forEach((x) => assert.ok(C.ITEMS[x[0]], x[0]));
  assert.strictEqual(P.chests.length, 5);
});

test('the Plainsrunner set: four pieces at 30,000 to 60,000 Gold each plus the Plains\' drops (about 10 times the notes)', () => {
  const pieces = C.GEAR_SLOTS.map((k) => C.PLACE_GEAR['plains_' + k]);
  assert.deepStrictEqual(plain(pieces.map((g) => g.name)), ['Salakot Hat', 'Toro Vest', 'Rancher Boots', 'Comet Charm']);
  assert.deepStrictEqual(plain(pieces.map((g) => g.gold)), [30000, 50000, 35000, 60000]);
  pieces.forEach((g) => {
    assert.ok(g.gold >= 30000 && g.gold <= 60000);
    g.needs.forEach((n) => assert.strictEqual(C.ITEMS[n[0]].place, 'plains', g.name + ' needs ' + n[0] + ': a Plains drop'));
    assert.strictEqual(g.icon, C.plainsIcon(g.art), g.name + ': the owner\'s icon');
  });
  const s = fresh();
  s.gold = 200000;
  pieces.forEach((g) => g.needs.forEach((n) => L.addItem(s, n[0], n[1])));
  pieces.forEach((g) => assert.strictEqual(L.makeGear(s, g.id), 'ok', g.name));
  assert.strictEqual(L.wornSet(s), 'plains', 'all four on: the set');
  assert.strictEqual(s.gold, 200000 - 175000);
  assert.strictEqual(L.gearLess(s, 'toro'), 1 + 2 + 1 + 2 + C.GEAR_SET_BONUS, 'a Toro\'s charge costs less');
  assert.strictEqual(L.gearLess(s, 'sawa'), 0, 'only against the Plains\' own creatures');
  assert.ok(L.chargeLoss(s, A.toro.hit, 'toro') < A.toro.hit);
});

// What the game gives: every creature's drops, every place's chests and boss chests, the mine's bands, the workshops
// (the Mixer), lumber from the farm.
const sources = () => {
  const got = new Set(['lumber']);
  Object.keys(A).forEach((k) => (A[k].drops || []).forEach((d) => got.add(d[0])));
  C.PLACE_ORDER.forEach((id) => { const p = C.PLACES[id]; (p.chestLoot || []).forEach((x) => got.add(x[0])); if (p.dungeon && p.dungeon.chest) p.dungeon.chest.forEach((x) => got.add(x[0])); });
  ((C.MINE && C.MINE.bands) || []).forEach((b) => b.ids.forEach((id) => got.add(id))); // (the mine's floors)
  Object.keys(C.WORKSHOPS).forEach((w) => (C.WORKSHOPS[w].recipes || []).forEach((r) => got.add(r.out)));
  return got;
};

test('every Rifle level can be built from what the game drops: the weapons file\'s ids are the drops\' ids', () => {
  const got = sources();
  // the four the Rifle asks for from the Plains, exactly as the weapons file names them, now in the game
  ['toro_hide', 'toro_horn', 'sarangay_jewel', 'arimaonga_mane'].forEach((id) => {
    assert.ok(C.ITEMS[id] && C.ITEMS[id].place === 'plains', id + ' is a Plains item');
    assert.ok(got.has(id), id + ' drops');
  });
  assert.ok(A.toro.drops.some((d) => d[0] === 'toro_hide') && A.toro.drops.some((d) => d[0] === 'toro_horn'));
  assert.ok(A.sarangay.drops.some((d) => d[0] === 'sarangay_jewel') && A.arimaonga.drops.some((d) => d[0] === 'arimaonga_mane'));
  C.WEAPONS.rifle.buy.forEach((b, lv) => {
    L.weaponNeeds(b.needs).forEach((n) => assert.ok(got.has(n[0]), 'Rifle level ' + lv + ': ' + n[0] + ' comes from somewhere'));
  });
  // and built, Basic to Moon, from those (each level asks for what it lists, now that the Plains are in)
  const s = fresh();
  s.gold = 1e7;
  s.lumber = 100;
  s.energy = 999;
  for (let lv = 0; lv < 6; lv++) {
    const next = L.nextWeapon(s, 'rifle');
    assert.strictEqual(next.level, lv);
    next.needs.forEach((n) => { if (n[0] !== 'lumber') L.addItem(s, n[0], n[1]); });
    assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok', 'level ' + lv);
  }
  assert.strictEqual(L.itemName(s, 'rifle'), 'Moon Rifle');
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.rifle.buy[1].needs)), [['ore_copper', 8], ['farm_cement', 2], ['toro_hide', 4]]);
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.rifle.buy[4].needs)), [['ember_shard', 40], ['obsidian', 5], ['arimaonga_mane', 3]]);
});

test('the Armory opens in Manila: buy, upgrade, ammo, repairs; only its "coming soon" goes', () => {
  const M = C.MANILA, arm = M.buildings.filter((b) => b.key === 'armory')[0];
  assert.ok(M.armory && M.armory.on);
  assert.ok(!/soon/i.test(arm.text), 'the Armory says what it sells');
  assert.ok(M.buildings.filter((b) => b.key === 'harbor' || b.key === 'stage').every((b) => /soon/i.test(b.text)), 'the others still say coming soon'); // (the Trading Post opened: manila-trade.test.js)
  assert.ok(!M.people.lando.lines.some((l) => /not ready/i.test(l)), 'Panday Lando: open now');
  const s = fresh();
  s.gold = 1e7; s.lumber = 100;
  ['rope', 'farm_cement', 'beeswax'].forEach((id) => L.addItem(s, id, 50));
  // buy all three (the Javelin and the Boomerang too: they work in every hunting place)
  C.WEAPON_KINDS.forEach((k) => assert.strictEqual(L.getWeapon(s, k), 'ok', k));
  assert.ok(C.WEAPONS_OLD_PLACES && ['pulag', 'palawan', 'plains', 'plains_cave'].every((m) => L.weaponsWork(m)), 'every hunting place');
  assert.ok(!L.weaponsWork('town') && !L.weaponsWork('manila'));
  // upgrade the Rifle with Toro Hide
  ['ore_copper', 'toro_hide'].forEach((id) => L.addItem(s, id, 8));
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(L.weaponLevel(s, 'rifle'), 1);
  // ammo
  const g0 = s.gold;
  assert.strictEqual(L.buyAmmo(s, 'bullets', 2), 'ok');
  assert.strictEqual(L.countItem(s, 'bullets'), 20);
  assert.strictEqual(s.gold, g0 - 2 * C.ITEMS.bullets.price);
  assert.strictEqual(L.buyAmmo(s, 'javelins', 1), 'ok');
  assert.strictEqual(L.countItem(s, 'javelins'), 5);
  // a repair
  s.wpn.left = 10;
  const cost = L.repairCost(s);
  assert.ok(cost && cost.gold > 0);
  assert.strictEqual(L.repairBoomerang(s), 'ok');
  assert.strictEqual(L.throwsLeft(s), L.throwsMax(s));
});

test('a shot costs what the Bow\'s does (the owner: no dearer shots); the energy is the Bow\'s in the Plains and its cave', () => {
  const s = fresh();
  s.map = 'plains';
  assert.strictEqual(C.SHOT_ENERGY.plains, undefined);
  assert.strictEqual(L.shotEnergy(s, WI.shotEnergy), WI.shotEnergy);
  s.map = 'plains_cave';
  assert.strictEqual(L.shotEnergy(s, WI.shotEnergy), WI.shotEnergy);
  assert.strictEqual(C.WEAPON_ENERGY, WI.shotEnergy);
  s.map = 'plains';
  s.gold = 1e6; s.lumber = 50; s.energy = 100;
  L.getWeapon(s, 'rifle');
  L.addItem(s, 'bullets', 5);
  assert.strictEqual(L.fireWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(s.energy, 100 - WI.shotEnergy, 'a Rifle shot: 2');
  L.addItem(s, 'arrows', 5);
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(s.energy, 100 - 2 * WI.shotEnergy, 'an arrow: 2');
});

test('the horse: rides free; 8 hearts and Horseshoes in the Plains, 10 and the Lantern Bridle in the cave; a hit tires it; the trough rests it', () => {
  const H = C.HORSE_OUT, s = fresh();
  s.gold = 1e6;
  s.horse = { name: 'Chestnut', love: 0, pet: 0 };
  assert.strictEqual(L.horseZone('plains'), 'hunt');
  assert.strictEqual(L.horseZone('plains_cave'), 'cave');
  s.horse.love = 7 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'plains').why, 'hearts');
  assert.strictEqual(L.horseMayGo(s, 'plains').need, 8);
  s.horse.love = 8 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'plains').why, 'shoes');
  s.horse.g = 1 << H.gearOrder.indexOf('horseshoes');
  assert.ok(L.horseMayGo(s, 'plains').ok);
  assert.strictEqual(L.horseMayGo(s, 'plains_cave').why, 'hearts');
  s.horse.love = 10 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'plains_cave').why, 'lantern');
  s.horse.g |= 1 << H.gearOrder.indexOf('lantern_bridle');
  assert.ok(L.horseMayGo(s, 'plains_cave').ok);
  // riding costs nothing; a hit takes hitDrain; it comes back by itself; the trough fills it at once
  assert.strictEqual(L.horseRide(s, 'plains', 40), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina);
  L.horseHit(s);
  L.horseHit(s);
  assert.strictEqual(L.horseStamina(s), H.stamina - 2 * H.hitDrain);
  assert.strictEqual(L.troughDrink(s), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina);
  assert.strictEqual(L.troughDrink(s), 'full');
  assert.strictEqual(L.troughDrink(fresh()), 'none');
  // a big monster can knock you off in the cave, not on the plains
  assert.strictEqual(L.horseKnocks('plains_cave', A.sarangay, 0), true);
  assert.strictEqual(L.horseKnocks('plains', A.toro, 0), false);
});

test('the valley road: once the Plains are open it crosses them (town -> Plains -> Plains Gate -> Manila); before, or on a road-only horse, straight as ever', () => {
  const H = C.HORSE_OUT, s = fresh();
  s.wild.n = 0;
  assert.strictEqual(L.valleyVia(s, false), false, 'shut: straight to Manila');
  assert.deepStrictEqual(plain(L.manilaRoad(s, false)), { ok: true }, 'the road itself still works');
  s.wild.n = 30;
  assert.strictEqual(L.valleyVia(s, false), true, 'walking: through the Plains');
  s.horse = { name: 'Chestnut', love: 6 * H.loveHeart, pet: 0, g: 1 << H.gearOrder.indexOf('horseshoes') };
  assert.ok(L.horseRoadOk(s, true).ok, '6 hearts and Horseshoes ride the road');
  assert.strictEqual(L.valleyVia(s, true), false, '...but not into a hunting ground: straight, as before');
  s.horse.love = 8 * H.loveHeart;
  assert.strictEqual(L.valleyVia(s, true), true, '8 hearts: through the Plains on horseback');
  // the built map: the road all the way across, its two ends, where you come in
  const m = L.plainsMap(map('pulag')), W = m.width, obj = m.layers[3].objects, by = (n) => obj.filter((o) => o.name === n)[0];
  assert.deepStrictEqual([m.width, m.height], [C.PLAINS.W, C.PLAINS.H]);
  const west = by('road_west'), east = by('road_east');
  assert.deepStrictEqual(plain(west.properties.map((p) => p.value)), ['town', 'from_manila', true]);
  assert.deepStrictEqual(plain(east.properties.map((p) => p.value)), ['manila', 'from_valley', true]);
  assert.strictEqual(west.x, 0);
  assert.strictEqual(east.x, (W - 1) * 256);
  assert.ok(by('from_town') && by('from_city') && by('dungeon_door') && by('from_dungeon') && by('trough') && by('meadow') && by('wild'));
  // walkable: the road's tiles have no wall and no solid prop; and you can walk from one end to the other, to the cave's
  // door, to Ka Pedring, to the trough and to every hidden chest
  const solid = {};
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => (t.properties || []).forEach((p) => { if (p.name === 'collides' && p.value) solid[ts.firstgid + t.id] = 1; })));
  const block = new Uint8Array(W * m.height);
  m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => l.data.forEach((g, i) => { if (solid[g]) block[i] = 1; }));
  const propSet = m.tilesets.filter((t) => t.name === 'props')[0];
  obj.filter((o) => o.gid).forEach((o) => {
    const t = propSet.tiles.filter((x) => x.id === o.gid - propSet.firstgid)[0], pr = {};
    (t.properties || []).forEach((p) => { pr[p.name] = p.value; });
    if (!pr.foot || pr.flat) return;
    const x0 = Math.round(o.x / 256), w = Math.round(o.width / 256), y1 = Math.round(o.y / 256) + Math.round(o.height / 256) - 1;
    for (let y = y1 - pr.foot + 1; y <= y1; y++) for (let x = x0; x < x0 + w; x++) block[y * W + x] = 1;
  });
  const R = C.PLAINS.road;
  for (let x = 0; x < W; x++) for (let y = R.y; y < R.y + R.h; y++) assert.ok(!block[y * W + x], 'the road at ' + x + ',' + y);
  const seen = new Uint8Array(W * m.height), q = [R.y * W + 2];
  seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % W, y = Math.floor(c / W);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { const nx = x + d[0], ny = y + d[1], n = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < m.height && !seen[n] && !block[n]) { seen[n] = 1; q.push(n); } });
  }
  const reach = (x, y) => seen[y * W + x] === 1;
  assert.ok(reach(W - 1, R.y), 'east end');
  assert.ok(reach(C.PLAINS.door[0], C.PLAINS.door[1] + 1), 'the cave door');
  assert.ok(reach(P.npc.at[0] - 1, P.npc.at[1]), 'Ka Pedring');
  assert.ok(reach(C.PLAINS.halt.trough[0], C.PLAINS.halt.trough[1] + 1), 'in front of the trough');
  P.chests.forEach((c) => assert.ok(reach(c[0], c[1]), 'chest ' + c));
  // the meadow: fenced, no animal there (only the herd)
  assert.ok(L.plainsInMeadow(C.PLAINS.meadow[0] + 3, C.PLAINS.meadow[1] + 3));
  assert.ok(!L.plainsInMeadow(10, 10));
  assert.ok(reach(C.PLAINS.meadow[0] + 3, C.PLAINS.meadow[1] + 3), 'fenced, and in through its gate');
  assert.ok(!reach(C.PLAINS.meadow[0], C.PLAINS.meadow[1] + 2) && !reach(C.PLAINS.meadow[0], C.PLAINS.gateY + 2), 'the fence either side of the gate');
  // the goal arrow: town -> Plains by the road east; the Plains -> Manila east, everywhere else west
  assert.strictEqual(C.ROUTES.town.plains, 'road_east');
  assert.strictEqual(C.ROUTES.manila.plains, 'plains_gate');
  assert.strictEqual(C.ROUTES.plains.manila, 'road_east');
  assert.strictEqual(C.ROUTES.plains.farm, 'road_west');
  assert.strictEqual(C.ROUTES.plains.plains_cave, 'dungeon_door');
});

test('saves: no new key; the Plains save as a place (on its map: Pulag + its name, in its cave: at the door); old saves load as before', () => {
  const s = fresh(), keys = Object.keys(L.serialize(s)).sort();
  s.wild.n = 30;
  s.map = 'plains';
  const o = L.serialize(s);
  assert.strictEqual(o.pm, 'plains');
  assert.strictEqual(o.m, L.serialize(Object.assign({}, s, { map: 'pulag' })).m, 'saved as Pulag for an older game');
  assert.strictEqual(L.deserialize(plain(o)).map, 'plains');
  s.map = 'plains_cave';
  const c = L.serialize(s);
  assert.ok(c.pd === 1 && c.pm === 'plains');
  const back = L.deserialize(plain(c));
  assert.strictEqual(back.map, 'plains');
  assert.strictEqual(back.player.spawn, 'from_dungeon');
  // a hunt, a medal, the tame, the story: all in pl / pk / md, by name
  const t = fresh();
  t.wild.n = 30;
  L.hunted(t, 'plains', 6, 'tikling', 1);
  L.talkNpc(t, 'plains');
  tame(t);
  const r = roundTrip(t);
  assert.strictEqual(L.placeHunts(r, 'plains'), 1);
  assert.strictEqual(r.wild.by.tikling, 1);
  assert.ok(L.tamed(r, 'plains') && r.comp === 'plains');
  assert.ok(L.hasMedal(r, 2100), 'first hunt in the Open Plains');
  // a new game saves exactly the keys it did (nothing new until you play the Plains)
  assert.deepStrictEqual(Object.keys(L.serialize(fresh())).sort(), keys);
  assert.strictEqual(C.SAVE_GEN, 3);
});
