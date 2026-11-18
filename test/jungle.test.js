// The Bamboo Jungle (owner, 18 Nov 2026; src/00-zzz...z-jungle.js, src/01-logicZ...Z-jungle.js): Manila's second hunting
// ground, the Javelin's, and its 50-floor cave, the Bamboo Hollows. The unlock at 70 hunts, its animals and their stats,
// the Baboy-damo's pairs, the Pilandok's zigzag, tall bamboo stopping long shots, the Biik and its fetch skill, the cave,
// drops, prices, the dish and the Bamboo set, every Javelin level built from what the game drops, a shot's energy, the
// horse, the map and Manila's Jungle Gate, and the saves.
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
const fresh = () => { clock.set(2026, 11, 18, 10, 0); const s = L.newState(); s.seed = 22; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const P = C.PLACES.jungle;
const D = P.dungeon;
const A = WI.animals;
const J = C.JUNGLE;
const map = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', name + '.json'), 'utf8'));
const tame = (s) => { L.addItem(s, 'cassava', 20); for (let i = 0; i < 30 && !L.tamed(s, 'jungle'); i++) { const r = L.feedTame(s, 'jungle', () => 0.99); if (r === 'ran') L.placeRec(s, 'jungle').ta = 0; } };
// the notes' (docs/manila-proposals.md 3b) hits to bring one down and a charge's energy
const NOTES = { bugkon: 3, kalaw: 4, baboydamo: 6, maral: 5, tuko: 2, pilandok: 6, kagwang: 6, kawayansprite: 5, jg_tigma: 26, bamboogiant: 40 };
const NOTE_HIT = { baboydamo: 15, maral: 13, kagwang: 13, jg_tigma: 16, bamboogiant: 19 };

// A built map's walkable tiles, as the world reads them (11-world.js: any colliding tile; a prop's foot rows above its
// object's y, Tiled's bottom), and a flood fill from a tile.
const walker = (m) => {
  const W = m.width, H = m.height, solid = {}, block = new Uint8Array(W * H);
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => (t.properties || []).forEach((p) => { if (p.name === 'collides' && p.value) solid[ts.firstgid + t.id] = 1; })));
  m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => l.data.forEach((g, i) => { if (solid[g]) block[i] = 1; }));
  const ps = m.tilesets.find((t) => t.name === 'props');
  m.layers[3].objects.filter((o) => o.gid).forEach((o) => {
    const t = ps.tiles.find((x) => x.id === o.gid - ps.firstgid), pr = {};
    (t.properties || []).forEach((p) => { pr[p.name] = p.value; });
    if (!pr.foot || pr.flat) return;
    const x0 = Math.round(o.x / 256), w = Math.round(o.width / 256), y1 = Math.round(o.y / 256) - 1;
    for (let y = y1 - pr.foot + 1; y <= y1; y++) for (let x = x0; x < x0 + w; x++) block[y * W + x] = 1;
  });
  const from = (x0, y0) => {
    const seen = new Uint8Array(W * H), q = [y0 * W + x0];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = Math.floor(c / W);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { const nx = x + d[0], ny = y + d[1], n = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[n] && !block[n]) { seen[n] = 1; q.push(n); } });
    }
    return (x, y) => seen[y * W + x] === 1;
  };
  return { W, H, block, ok: (x, y) => !block[y * W + x], from };
};

test('the Bamboo Jungle: place 22, opens at 70 hunts, reached by Manila\'s Jungle Gate (not the Jeep), its cave the Bamboo Hollows; Diday', () => {
  assert.deepStrictEqual([P.n, P.unlock, P.map, D.key, D.name, D.floors, P.pack], [22, 70, 'jungle', 'jungle_cave', 'The Bamboo Hollows', 50, 'jungle']);
  const s = fresh();
  s.wild.n = 69;
  assert.strictEqual(L.wildOpen(s, 'jungle'), false, '69 hunts: shut');
  assert.strictEqual(L.wildOpen(s, 'jungle_cave'), false);
  s.wild.n = 70;
  assert.strictEqual(L.wildOpen(s, 'jungle'), true, '70 hunts: open');
  assert.strictEqual(L.wildOpen(s, 'jungle_cave'), true);
  assert.ok(L.isWildMap('jungle') && L.isWildMap('jungle_cave'), 'a hunting place: the Bow, the dog, friends');
  assert.ok(!L.jeepPlaces(s).some((e) => e.id === 'jungle' || e.id === 'plains'), 'not in Kanor\'s Jeep');
  assert.ok(L.jeepPlaces(s).some((e) => e.id === 'palawan'));
  // Diday, her picture (in the 'manila' pack already: she walked the city before), 4 lines each with a gift
  assert.deepStrictEqual([P.npc.name, P.npc.sheet], ['Diday', 'npc_diday']);
  assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'npc_diday.png')));
  assert.ok(require('../tools/manila/manila-art').all().includes('npc_diday'), 'in the manila pack');
  assert.deepStrictEqual(plain(P.npc.lines.map((l) => (l.need ? Object.keys(l.need)[0] : 'first'))), ['first', 'hunts', 'guard', 'boss']);
  P.npc.lines.forEach((l, i) => { assert.ok(l.gift && l.gift.length, 'line ' + i); l.gift.forEach((g) => assert.ok(C.ITEMS[g[0]] && g[1] > 0, g[0])); });
  assert.ok(P.npc.lines.some((l) => /cassava/i.test(l.text)), 'she tells you what the Biik eats');
  // medals from 2200
  const codes = C.MEDALS.filter((m) => m.place === 'jungle').map((m) => m.code);
  assert.ok(codes.length >= 10 && codes.every((c) => c >= 2200 && c < 2300));
  // the opening words; the Plains stay place 21 at 30 hunts
  assert.match(WI.areas.jungle.opened, /70 hunts/);
  assert.deepStrictEqual([C.PLACES.plains.n, C.PLACES.plains.unlock], [21, 30]);
});

test('its animals: the notes\' animals about 1.5 times harder (hits) and a little harder hitting; they hide until you are 2 to 3 tiles off', () => {
  assert.deepStrictEqual(plain(P.kinds), ['bugkon', 'kalaw', 'baboydamo', 'tuko', 'maral', 'pilandok']);
  assert.deepStrictEqual(plain(P.animals), { bugkon: 4, kalaw: 4, baboydamo: 4, tuko: 4 });
  const HP = { bugkon: 5, kalaw: 6, baboydamo: 9, maral: 8, tuko: 3, pilandok: 9, kagwang: 9, kawayansprite: 8, jg_tigma: 38, bamboogiant: 58 };
  Object.keys(NOTES).forEach((k) => {
    assert.strictEqual(A[k].hp, HP[k], k);
    assert.ok(A[k].hp >= NOTES[k] * 1.4 && A[k].hp <= NOTES[k] * 1.7, k + ': about 1.5 times the notes, ' + A[k].hp + ' for ' + NOTES[k]);
  });
  Object.keys(NOTE_HIT).forEach((k) => assert.ok(A[k].hit > NOTE_HIT[k] && A[k].hit <= NOTE_HIT[k] + 2, k + ' hits ' + A[k].hit));
  assert.strictEqual(A.bamboogiant.hpEach, 22);
  // close quarters: the shy ones run at 2 to 3.4 tiles, the angry ones jump at you from 2.2 to 4
  ['bugkon', 'kalaw', 'tuko', 'pilandok', 'kawayansprite'].forEach((k) => assert.ok(A[k].shy >= 2 && A[k].shy <= 3.4, k + ' shy ' + A[k].shy));
  ['baboydamo', 'maral', 'kagwang'].forEach((k) => assert.ok(A[k].angry >= 2.2 && A[k].angry <= 3, k + ' angry ' + A[k].angry));
  // the Javelin (reach 1 to 5) reaches them; the notes' extras: the Maral at dusk, the Pilandok rare
  assert.ok(P.extra.some((x) => x.kind === 'maral' && x.when === 'dusk') && P.extra.some((x) => x.kind === 'pilandok' && x.when === 'rare'));
  assert.ok(A.pilandok.rare && A.pilandok.respawn === 120 && A.pilandok.run === 6.8);
  // every creature has the owner's picture (art-src/manila/jungle) and a stand-in row until it is in
  Object.keys(P.creatures).concat(Object.keys(D.creatures)).forEach((k) => {
    assert.ok(fs.existsSync(path.join(ROOT, 'art-src', 'manila', 'jungle', (A[k].src || A[k].sheet) + '.png')), k + ': ' + A[k].sheet);
    assert.ok(WI.order.includes(A[k].sheetRow), k + ': a stand-in row');
    assert.ok(A[k].px > 0 && A[k].place === 'jungle', k);
    (A[k].drops || []).forEach((d) => assert.ok(C.ITEMS[d[0]], k + ' drops ' + d[0]));
  });
  // the Jungle's Tigmamanukan is its own (the Lost Tower keeps its own, its own picture)
  assert.ok(A.tigmamanukan && A.tigmamanukan.tower && A.tigmamanukan.sheet === 'wild_tigmamanukan');
  assert.deepStrictEqual([A.jg_tigma.name, A.jg_tigma.sheet], ['Tigmamanukan', 'wild_jungle_tigma']);
  // the bosses: grumpy (bosses), our own Bamboo Giant
  assert.ok(A.jg_tigma.boss && A.bamboogiant.boss && A.bamboogiant.minHits === 3);
  assert.ok(A.biik.tameOnly && !A.biik.drops.length);
});

test('the Baboy-damo go about in pairs (flock 2), side by side: the Moon Javelin hits both; the Plains\' threes stand in a line as before', () => {
  assert.strictEqual(A.baboydamo.flock, 2);
  ['bugkon', 'kalaw', 'tuko', 'maral', 'pilandok'].forEach((k) => assert.ok(!A[k].flock, k));
  const slots = L.wildSlots('jungle'), pigs = slots.filter((e) => e.kind === 'baboydamo' && !e.when).map((e) => e.slot);
  const rain = slots.filter((e) => e.kind === 'baboydamo' && e.when === 'rain').map((e) => e.slot);
  assert.strictEqual(pigs.length, 4);
  assert.deepStrictEqual(plain(L.flockOf('jungle', pigs[1])), plain({ lead: pigs[0], slots: pigs.slice(0, 2), i: 1 }));
  assert.deepStrictEqual(plain(L.flockOf('jungle', pigs[2])), plain({ lead: pigs[2], slots: pigs.slice(2, 4), i: 0 }));
  assert.deepStrictEqual(plain(L.flockOf('jungle', rain[1])), plain({ lead: rain[0], slots: rain, i: 1 }), 'the rain\'s two: a pair of their own');
  // side by side, across the way it goes, nearer than the Moon Javelin's pair reach
  const T = C.TILE, x = 20 * T, y = 20 * T;
  [0, Math.PI / 2, Math.PI, 1].forEach((ang) => {
    const b = L.flockSpot(x, y, ang, 1, T, A.baboydamo.w, 2), d = Math.hypot(b.x - x, b.y - y) / T;
    assert.ok(d >= 0.9 && d < C.WEAPON_PAIR, 'beside it: ' + d.toFixed(2));
    assert.ok(Math.abs((b.x - x) * Math.cos(ang) + (b.y - y) * Math.sin(ang)) < 0.01 * T, 'not behind: across its way');
  });
  assert.deepStrictEqual(plain(L.flockSpot(x, y, 0, 0, T, 1.4, 2)), { x, y }, 'the leader where it is');
  assert.deepStrictEqual(plain(L.flockSpot(x, y, 0, 1, T, 1.3, 3)), plain(L.flockSpot(x, y, 0, 1, T, 1.3)), 'a flock of 3: the Plains\' line');
  assert.strictEqual(L.weaponMoon('javelin', 5), 'pair');
});

test('zigzag: the Pilandok dodges side to side as it runs (one way, then the other), the others run straight', () => {
  assert.strictEqual(A.pilandok.zigzag, true);
  Object.keys(A).filter((k) => k !== 'pilandok').forEach((k) => assert.ok(!A[k].zigzag, k));
  const Z = WI.zigzag;
  assert.strictEqual(L.zigzagTurn(0), Z.turn);
  assert.strictEqual(L.zigzagTurn(Z.every - 1), Z.turn);
  assert.strictEqual(L.zigzagTurn(Z.every), -Z.turn);
  assert.strictEqual(L.zigzagTurn(2 * Z.every + 5), Z.turn);
  // over a run it keeps its way on the whole (as far one side as the other), but never goes straight for long
  let sum = 0;
  for (let ms = 0; ms < 20 * Z.every; ms += 10) sum += L.zigzagTurn(ms);
  assert.ok(Math.abs(sum) < 1e-9, 'it keeps going away: ' + sum);
  assert.ok(Z.turn >= 0.5 && Z.turn < Math.PI / 2 && Z.every >= 250 && Z.every <= 500, 'a dodge, not a turn back');
});

test('tall bamboo blocks your shots longer than 4 tiles: a shot that would pass through a clump past 4 tiles stops at it', () => {
  assert.strictEqual(WI.bambooFrom, 4);
  // a row of bamboo at x = 6 (tiles) across the way, shooting right from (0.5, 3.5)
  const at = (x) => x === 6;
  const wall = (x, y) => at(x) && y >= 0;
  const stop = L.bambooStop(wall, 0.5, 3.5, 0, 8);
  assert.ok(stop >= 5.5 && stop <= 5.75, 'stops at the clump: ' + stop);
  assert.strictEqual(L.bambooStop(wall, 0.5, 3.5, 0, 5), null, 'a shot that ends short of it');
  assert.strictEqual(L.bambooStop(wall, 3.5, 3.5, 0, 8), null, 'the clump within 4 tiles: it flies past (only longer shots stop)');
  assert.strictEqual(L.bambooStop(wall, 0.5, 3.5, Math.PI, 8), null, 'the other way: nothing there');
  assert.strictEqual(L.bambooStop(() => true, 0, 0, 0, 4), null, 'a shot of 4 tiles or less: never');
  assert.ok(L.bambooStop(() => true, 0, 0, 0, 4.5) > 4, 'just past 4: at the first clump past 4');
  // the built Jungle: the bamboo's tiles; a long shot along an open trail flies free, one into the bamboo stops
  const m = L.jungleMap(map('pulag')), cl = L.jungleClumps(m);
  let n = 0;
  for (let i = 0; i < cl.grid.length; i++) n += cl.grid[i];
  assert.ok(n > 300, 'bamboo all over: ' + n + ' tiles');
  J.glades.concat(J.trails).forEach((g) => { for (let y = g[1]; y < g[1] + g[3]; y++) for (let x = g[0]; x < g[0] + g[2]; x++) assert.ok(!cl.grid[y * cl.W + x], 'no bamboo stands on open ground ' + x + ',' + y); });
  assert.strictEqual(L.bambooStop(cl.at, 26, 10.5, Math.PI / 2, 7.5), null, 'down the trail to the pool: free');
  const into = L.bambooStop(cl.at, 6, 14.5, 0, 10);
  assert.ok(into > 4 && into < 10, 'across the north-west glade into the bamboo: stopped at ' + into);
  // the stand-ins that are bamboo: the bamboo and the thicket (not the banana, the fern, the log)
  assert.deepStrictEqual(plain(J.clumps), ['bamboo_bush', 'fern_bush']);
  assert.deepStrictEqual([C.PLACE_PROP_SWAP.jungle.bamboo_bush, C.PLACE_PROP_SWAP.jungle.fern_bush], ['bamboo', 'thicket']);
});

test('the Biik: planted cassava, 9 feedings; tamed, it walks with you and fetches what a hunt leaves', () => {
  assert.deepStrictEqual([P.tame.kind, P.tame.food, P.tame.feedings, P.tame.skill], ['biik', 'cassava', 9, 'fetch']);
  assert.ok(C.ITEMS.cassava && C.CROPS.cassava, 'cassava is planted');
  assert.ok(C.COMPANION_SKILLS.fetch.reach > 0);
  const s = fresh(), bag = s.inv.length;
  tame(s);
  assert.ok(L.tamed(s, 'jungle'));
  assert.strictEqual(L.companion(s), 'jungle');
  assert.strictEqual(L.companionSkill(s), 'fetch');
  assert.strictEqual(s.inv.length, bag, 'no carrying: the bag is the same');
  const back = roundTrip(s);
  assert.ok(L.tamed(back, 'jungle') && back.comp === 'jungle');
  // the Tamaraw Calf too: one out at a time, the other waits at the Lodge
  L.addItem(s, 'oats', 20);
  for (let i = 0; i < 30 && !L.tamed(s, 'plains'); i++) { const r = L.feedTame(s, 'plains', () => 0.99); if (r === 'ran') L.placeRec(s, 'plains').ta = 0; }
  assert.strictEqual(L.setCompanion(s, 'jungle'), 'ok');
  assert.strictEqual(L.companionSkill(s), 'fetch');
  assert.strictEqual(s.inv.length, bag, 'the calf\'s 6 slots went back with it');
});

test('the Bamboo Hollows: 50 floors, a lift every 10, a Tigmamanukan on every 10th (tougher each time), the Bamboo Giant on 50', () => {
  assert.deepStrictEqual([D.floors, D.liftEvery, D.guardFloor, D.guardEvery, D.bossFloor], [50, 10, 10, 10, 50]);
  assert.deepStrictEqual([D.guard, D.boss], ['jg_tigma', 'bamboogiant']);
  const guards = [];
  for (let f = 1; f <= 50; f++) { const w = L.dunWho(D, f); if (w) guards.push(f + ':' + w); }
  assert.deepStrictEqual(guards, ['10:jg_tigma', '20:jg_tigma', '30:jg_tigma', '40:jg_tigma', '50:bamboogiant']);
  assert.ok(L.dunHp('jg_tigma', 1, 40) > L.dunHp('jg_tigma', 1, 10), 'deeper guards are tougher');
  assert.strictEqual(L.dunHp('bamboogiant', 1, 50), A.bamboogiant.hp, 'soloable');
  assert.strictEqual(L.dunHp('bamboogiant', 3, 50), A.bamboogiant.hp + 2 * A.bamboogiant.hpEach, 'more health for each friend');
  assert.ok(L.dunRoster('jungle_cave', 1).every((e) => e.kind === 'kawayansprite'));
  assert.strictEqual(L.dunRoster('jungle_cave', 10)[0].kind, 'jg_tigma');
  assert.strictEqual(L.dunRoster('jungle_cave', 50)[0].kind, 'bamboogiant');
  assert.ok(L.dunRoster('jungle_cave', 35).some((e) => e.kind === 'kagwang'));
  const s = fresh();
  s.wild.n = 70;
  assert.deepStrictEqual(plain(L.dunStops(s, 'jungle_cave')), [1]);
  L.dunReach(s, 'jungle_cave', 34);
  assert.deepStrictEqual(plain(L.dunStops(s, 'jungle_cave')), [1, 11, 21, 31]);
  L.hunted(s, 'jungle_cave', 0, 'jg_tigma', 1);
  assert.strictEqual(L.placeRec(s, 'jungle').g, 1);
  L.hunted(s, 'jungle_cave', 0, 'bamboogiant', 1);
  assert.strictEqual(L.bossChests(s, 'jungle'), 1);
  const loot = L.openBossChests(s, 'jungle', () => 0);
  assert.ok(loot.some((x) => x[0] === 'bamboo_heart'));
  assert.strictEqual(L.horseZone('jungle_cave'), 'cave');
  // the built cave: short rooms with doorways, the way back up, the gate down, the creatures' zone; you can walk from the
  // ladder to the gate
  const cave = L.jungleCaveMap(map('palawan_cave')), obj = cave.layers[3].objects;
  ['entrance', 'exit', 'dungeon_gate', 'wild'].forEach((n) => assert.ok(obj.some((o) => o.name === n), n));
  assert.strictEqual(obj.filter((o) => o.name === 'exit')[0].properties[0].value, 'jungle');
  const w = walker(cave), reach = w.from(5, 3), g = obj.find((o) => o.name === 'dungeon_gate');
  assert.ok(reach(g.x / 256 - 1, g.y / 256), 'the ladder to the gate down');
  [[2, 3], [25, 3], [2, 15], [25, 15]].forEach((p) => assert.ok(reach(p[0], p[1]), 'every room ' + p));
  assert.ok(!w.ok(13, 3) && !w.ok(10, 8), 'roots between the rooms');
});

test('drops and prices: the Jungle\'s 60 to 300, the silver hoof 1,500, the guard\'s feather 900-2,200, the boss\'s heart 1,400-3,400; the dish', () => {
  ['fur_bugkon', 'feather_kalaw', 'casque_kalaw', 'meat_baboy', 'warty_tusk', 'maral_pelt', 'whisker_maral', 'skin_tuko', 'cape_kagwang', 'twig_sprite']
    .forEach((id) => assert.ok(C.ITEMS[id].sell >= 60 && C.ITEMS[id].sell <= 300, id + ' ' + C.ITEMS[id].sell));
  assert.strictEqual(C.ITEMS.silver_hoof.sell, 1500);
  assert.ok(C.ITEMS.tigmamanukan_feather.sell >= 900 && C.ITEMS.tigmamanukan_feather.sell <= 2200);
  assert.ok(C.ITEMS.bamboo_heart.sell >= 1400 && C.ITEMS.bamboo_heart.sell <= 3400);
  // every item: its own icon painted at load (the page's items sheet does not grow)
  Object.keys(P.items).forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it.sell > 0 && it.name && it.desc && it.place === 'jungle', id);
    assert.strictEqual(it.icon, C.jungleIcon(id), id + ': its painted icon');
    assert.ok(/^[a-z][a-z_]{0,23}$/.test(id), id);
  });
  assert.strictEqual(C.JUNGLE_ICONS.length, 20);
  assert.ok(!C.JUNGLE_ICONS.some((id) => C.ICON_ORDER.includes(id)), 'not in the page\'s items sheet');
  assert.ok(C.JUNGLE_ICON_BASE >= C.PLAINS_ICON_BASE + C.PLAINS_ICONS.length, 'past the Plains\' frames');
  C.JUNGLE_ICONS.forEach((id) => assert.ok(C.ICON[C.JUNGLE_STAND[id]] != null, id + ': a stand-in until the pack is in'));
  // the dish: Sinigang na Baboy-damo, wild pork, taro and tomato, 110 energy; its power: charges cost half
  assert.ok(C.RECIPES.some((r) => r.dish === 'sinigang_baboy' && r.needs.join() === 'meat_baboy,taro,tomato'));
  assert.strictEqual(C.ITEMS.sinigang_baboy.energy, 110);
  assert.strictEqual(C.DISH_POWERS.sinigang_baboy.key, 'charge');
  ['taro', 'tomato'].forEach((id) => assert.ok(C.CROPS[id], id + ' is planted'));
  // the hidden chests and the boss chest give items there are
  P.chestLoot.concat(D.chest).forEach((x) => assert.ok(C.ITEMS[x[0]], x[0]));
  assert.strictEqual(P.chests.length, 5);
});

test('the Bamboo set: four pieces at 30,000 to 60,000 Gold each plus the Jungle\'s drops (about 10 times the notes)', () => {
  const pieces = C.GEAR_SLOTS.map((k) => C.PLACE_GEAR['jungle_' + k]);
  assert.deepStrictEqual(plain(pieces.map((g) => g.name)), ['Bamboo Hat', 'Maral Vest', 'Bamboo Sandals', 'Pilandok Charm']);
  assert.deepStrictEqual(plain(pieces.map((g) => g.gold)), [30000, 50000, 35000, 60000]);
  pieces.forEach((g) => {
    g.needs.forEach((n) => assert.strictEqual(C.ITEMS[n[0]].place, 'jungle', g.name + ' needs ' + n[0] + ': a Jungle item'));
    assert.strictEqual(g.icon, C.jungleIcon(g.art), g.name + ': the owner\'s icon');
  });
  const s = fresh();
  s.gold = 200000;
  pieces.forEach((g) => { g.needs.forEach((n) => L.addItem(s, n[0], n[1])); assert.strictEqual(L.makeGear(s, g.id), 'ok', g.name); });
  assert.strictEqual(L.wornSet(s), 'jungle');
  assert.strictEqual(s.gold, 200000 - 175000);
  assert.strictEqual(L.gearLess(s, 'baboydamo'), 1 + 2 + 1 + 2 + C.GEAR_SET_BONUS);
  assert.strictEqual(L.gearLess(s, 'bamboogiant'), 1 + 2 + 1 + 2 + C.GEAR_SET_BONUS, 'and in its cave');
  assert.strictEqual(L.gearLess(s, 'toro'), 0, 'only against the Jungle\'s own creatures');
});

// What the game gives: every creature's drops, every place's chests and boss chests, the mine's bands, the workshops
// (the Mixer), lumber from the farm.
const sources = () => {
  const got = new Set(['lumber']);
  Object.keys(A).forEach((k) => (A[k].drops || []).forEach((d) => got.add(d[0])));
  C.PLACE_ORDER.forEach((id) => { const p = C.PLACES[id]; (p.chestLoot || []).forEach((x) => got.add(x[0])); if (p.dungeon && p.dungeon.chest) p.dungeon.chest.forEach((x) => got.add(x[0])); });
  ((C.MINE && C.MINE.bands) || []).forEach((b) => b.ids.forEach((id) => got.add(id)));
  Object.keys(C.WORKSHOPS).forEach((w) => (C.WORKSHOPS[w].recipes || []).forEach((r) => got.add(r.out)));
  return got;
};

test('every Javelin level, Basic to Moon, can be built from what the game drops: the weapons file\'s ids are the drops\' ids', () => {
  const got = sources();
  ['warty_tusk', 'maral_pelt', 'tigmamanukan_feather', 'bamboo_heart'].forEach((id) => {
    assert.ok(C.ITEMS[id] && C.ITEMS[id].place === 'jungle', id + ' is a Jungle item');
    assert.ok(got.has(id), id + ' drops');
  });
  assert.ok(A.baboydamo.drops.some((d) => d[0] === 'warty_tusk') && A.maral.drops.some((d) => d[0] === 'maral_pelt'));
  assert.ok(A.jg_tigma.drops.some((d) => d[0] === 'tigmamanukan_feather') && A.bamboogiant.drops.some((d) => d[0] === 'bamboo_heart'));
  // every material each level lists is in the game now (the Rocky Gorge's galura_feather too, since 18 Nov 2026)
  C.WEAPONS.javelin.buy.forEach((b, lv) => {
    b.needs.forEach((n) => assert.ok(C.ITEMS[n[0]] || n[0] === 'lumber' || n[0] === 'galura_feather', 'Javelin level ' + lv + ': ' + n[0]));
    L.weaponNeeds(b.needs).forEach((n) => assert.ok(got.has(n[0]), 'Javelin level ' + lv + ': ' + n[0] + ' comes from somewhere'));
  });
  // the Moon level asks for the Plains', the Gorge's and the Lair's boss parts too, which are in the game
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.javelin.buy[5].needs)), [['bamboo_heart', 6], ['arimaonga_mane', 3], ['galura_feather', 3], ['bakunawa_scale', 5]]);
  assert.strictEqual(C.ITEMS.arimaonga_mane.place, 'plains');
  const s = fresh();
  s.gold = 1e7;
  s.lumber = 100;
  for (let lv = 0; lv < 6; lv++) {
    const next = L.nextWeapon(s, 'javelin');
    assert.strictEqual(next.level, lv);
    next.needs.forEach((n) => { if (n[0] !== 'lumber') L.addItem(s, n[0], n[1]); });
    assert.strictEqual(L.getWeapon(s, 'javelin'), 'ok', 'level ' + lv);
  }
  assert.strictEqual(L.itemName(s, 'javelin'), 'Moon Javelin');
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.javelin.buy[1].needs)), [['ore_copper', 8], ['rope', 3], ['warty_tusk', 4]]);
  assert.deepStrictEqual(plain(L.weaponNeeds(C.WEAPONS.javelin.buy[3].needs)), [['ore_gold', 8], ['rope', 6], ['tigmamanukan_feather', 3]]);
  // and the Rifle's and the Boomerang's Moon levels now ask for the Bamboo Heart too
  assert.ok(L.weaponNeeds(C.WEAPONS.rifle.buy[5].needs).some((n) => n[0] === 'bamboo_heart'));
  assert.ok(L.weaponNeeds(C.WEAPONS.boomerang.buy[5].needs).some((n) => n[0] === 'bamboo_heart'));
});

test('a shot costs what the Bow\'s does (2): the Javelin, the Rifle, the Bow, in the Jungle and its cave', () => {
  const s = fresh();
  assert.strictEqual(C.SHOT_ENERGY.jungle, undefined);
  assert.strictEqual(C.SHOT_ENERGY.jungle_cave, undefined);
  ['jungle', 'jungle_cave'].forEach((m) => { s.map = m; assert.strictEqual(L.shotEnergy(s, WI.shotEnergy), 2, m); });
  assert.strictEqual(C.WEAPON_ENERGY, 2);
  s.map = 'jungle';
  s.gold = 1e6; s.lumber = 50; s.energy = 100;
  L.addItem(s, 'rope', 2);
  assert.strictEqual(L.getWeapon(s, 'javelin'), 'ok');
  L.buyAmmo(s, 'javelins', 1);
  assert.strictEqual(L.fireWeapon(s, 'javelin'), 'ok');
  assert.strictEqual(s.energy, 98, 'a throw: 2');
  L.addItem(s, 'arrows', 5);
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(s.energy, 96, 'an arrow: 2');
});

test('the horse: rides free; 8 hearts and Horseshoes in the Jungle, 10 and the Lantern Bridle in the Hollows; only a hit tires it', () => {
  const H = C.HORSE_OUT, s = fresh();
  s.horse = { name: 'Chestnut', love: 7 * H.loveHeart, pet: 0 };
  assert.strictEqual(L.horseZone('jungle'), 'hunt');
  assert.strictEqual(L.horseMayGo(s, 'jungle').why, 'hearts');
  assert.strictEqual(L.horseMayGo(s, 'jungle').need, 8);
  s.horse.love = 8 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'jungle').why, 'shoes');
  s.horse.g = 1 << H.gearOrder.indexOf('horseshoes');
  assert.ok(L.horseMayGo(s, 'jungle').ok);
  assert.strictEqual(L.horseMayGo(s, 'jungle_cave').why, 'hearts');
  s.horse.love = 10 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'jungle_cave').why, 'lantern');
  s.horse.g |= 1 << H.gearOrder.indexOf('lantern_bridle');
  assert.ok(L.horseMayGo(s, 'jungle_cave').ok);
  assert.strictEqual(L.horseRide(s, 'jungle', 40), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina, 'riding is free');
  L.horseHit(s);
  assert.strictEqual(L.horseStamina(s), H.stamina - H.hitDrain, 'a hit tires it');
  assert.strictEqual(L.horseKnocks('jungle_cave', A.jg_tigma, 0), true, 'the guard can knock you off in the cave');
  assert.strictEqual(L.horseKnocks('jungle', A.baboydamo, 0), false, 'not in the Jungle itself');
});

test('the map: the gate back to Manila at the top, trails 2 tiles wide between the bamboo, the pool and its streams, every place in reach', () => {
  const m = L.jungleMap(map('pulag')), obj = m.layers[3].objects, by = (n) => obj.filter((o) => o.name === n)[0];
  assert.deepStrictEqual([m.width, m.height], [J.W, J.H]);
  const road = by('road_north');
  assert.deepStrictEqual(plain(road.properties.map((p) => p.value)), ['manila', 'from_jungle', true]);
  assert.deepStrictEqual([road.x / 256, road.y / 256, road.width / 256], [J.gate[0], 0, 2]);
  ['from_city', 'dungeon_door', 'dungeon_mouth', 'from_dungeon', 'wild', 'sign_jungle', 'sign_hollows'].forEach((n) => assert.ok(by(n), n));
  assert.strictEqual(by('dungeon_door').properties[0].value, 'jungle_cave');
  const w = walker(m), sp = by('from_city'), reach = w.from(Math.floor(sp.x / 256), Math.floor(sp.y / 256));
  assert.ok(reach(J.gate[0], 0) && reach(J.gate[0] + 1, 0), 'up to the gate');
  assert.ok(reach(J.door[0], J.door[1] + 1), 'to the cave\'s door');
  assert.ok(reach(J.door[0], J.door[1]), 'and into it');
  assert.ok(reach(P.npc.at[0], P.npc.at[1] + 1), 'Diday');
  P.chests.forEach((c) => assert.ok(reach(c[0], c[1]), 'chest ' + c));
  J.glades.forEach((g) => assert.ok(reach(g[0] + 1, g[1] + g[3] - 1), 'glade ' + g));
  J.crossings.forEach((c) => { assert.ok(reach(c[1], c[2]), c[0] + ' at ' + c[1] + ',' + c[2]); assert.ok(reach(c[1], c[2] - 1) && reach(c[1], c[2] + 1), 'across it'); });
  // the streams are water but where a trail crosses; the pool is water
  const water = (x, y) => w.block[y * w.W + x] && !reach(x, y);
  J.streams.forEach((st) => assert.ok(water(st[0] + 3, st[1]), 'stream at ' + (st[0] + 3)));
  assert.ok(water(J.pool[0] + 3, J.pool[1] + 2), 'the pool');
  // the bamboo is solid: nobody walks unseen behind the pictures; every open tile of the map is a glade or a trail
  let lost = 0;
  for (let y = 1; y < J.H - 1; y++) for (let x = 2; x < J.W - 2; x++) {
    if (!reach(x, y)) continue;
    const near = J.glades.concat(J.trails).some((g) => x >= g[0] - 1 && x <= g[0] + g[2] && y >= g[1] - 1 && y <= g[1] + g[3]);
    if (!near) lost++;
  }
  assert.ok(lost <= 6, 'walkable only on the glades and trails (and a tile by them): ' + lost + ' others');
  // the trails are 2 wide
  J.trails.forEach((t) => assert.ok(Math.min(t[2], t[3]) === 2, 'trail ' + t));
  // the props: the owner's 12 over the stand-ins
  assert.strictEqual(J.kinds.length, 12);
  assert.deepStrictEqual(plain(Object.values(C.PLACE_PROP_SWAP.jungle).sort()), plain(J.kinds.slice().sort()));
  assert.ok(C.PLACE_GROUND.includes('jungle'));
});

test('Manila\'s Jungle Gate: south, on the turned-round city\'s bottom edge; shut until 70 hunts, then the way in; the goal arrow', () => {
  const M = C.MANILA, g = M.jungleGate;
  assert.strictEqual(g.key, 'jungle');
  assert.deepStrictEqual(plain(g.box), [58, 88, 4, 2], 'x 28 in the layout, turned round: 90 - 28 - 4');
  assert.ok(g.box[1] + g.box[3] === M.H, 'on the south edge');
  assert.match(g.text, /opens at 70 hunts/);
  assert.ok(!/soon/i.test(g.text));
  assert.ok(M.gates.filter((x) => x.key === 'gorge').every((x) => /opens at 110 hunts/.test(x.text)), 'the Gorge Gate: when it opens (the Rocky Gorge, 18 Nov 2026)');
  assert.ok(!M.pass.gate_jungle, 'shut, nothing about the gate changes: the world opens it (19zzz...z-jungle.js)');
  // the goal arrow: to the Jungle through the gate; out of it by the north gap
  assert.strictEqual(C.ROUTES.manila.jungle, 'jungle_gate');
  assert.strictEqual(C.ROUTES.manila.jungle_cave, 'jungle_gate');
  assert.strictEqual(C.ROUTES.town.jungle, C.ROUTES.town.manila);
  assert.strictEqual(C.ROUTES.jungle.manila, 'road_north');
  assert.strictEqual(C.ROUTES.jungle.farm, 'road_north');
  assert.strictEqual(C.ROUTES.jungle.jungle_cave, 'dungeon_door');
  assert.strictEqual(C.ROUTES.jungle_cave.manila, 'exit');
  assert.strictEqual(C.ROUTES.plains.jungle, 'road_east', 'from the Plains: east to Manila');
});

test('saves: no new key; the Jungle saves as a place (on its map: Pulag + its name, in its cave: at the door); old saves load as before', () => {
  const s = fresh(), keys = Object.keys(L.serialize(s)).sort();
  s.wild.n = 70;
  s.map = 'jungle';
  const o = L.serialize(s);
  assert.strictEqual(o.pm, 'jungle');
  assert.strictEqual(o.m, L.serialize(Object.assign({}, s, { map: 'pulag' })).m, 'saved as Pulag for an older game');
  assert.strictEqual(L.deserialize(plain(o)).map, 'jungle');
  s.map = 'jungle_cave';
  const c = L.serialize(s);
  assert.ok(c.pd === 1 && c.pm === 'jungle');
  const back = L.deserialize(plain(c));
  assert.strictEqual(back.map, 'jungle');
  assert.strictEqual(back.player.spawn, 'from_dungeon');
  const t = fresh();
  t.wild.n = 70;
  L.hunted(t, 'jungle', 6, 'tuko', 1);
  L.hunted(t, 'jungle', 0, 'pilandok', 1);
  L.talkNpc(t, 'jungle');
  tame(t);
  const r = roundTrip(t);
  assert.strictEqual(L.placeHunts(r, 'jungle'), 2);
  assert.strictEqual(r.wild.by.tuko, 1);
  assert.ok(L.tamed(r, 'jungle') && r.comp === 'jungle');
  assert.ok(L.hasMedal(r, 2200), 'first hunt in the Bamboo Jungle');
  assert.deepStrictEqual(Object.keys(L.serialize(fresh())).sort(), keys);
  assert.strictEqual(C.SAVE_GEN, 3);
});
