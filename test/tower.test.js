// Unit tests for The Lost Tower (docs/superpowers/specs/2026-11-12-lost-tower-design.md; content
// src/00-zzzzzzzzzzzzzzzzzzzzzz-tower.js, rules src/01-logicZZZZZZZZZZZZZZZZZ-tower.js): the config, the 60 creatures, how
// strong each floor is, the floor maps built in code, the door in Manila, the Pearls and the save.
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
const TW = C.TOWER;
const WI = C.WILD;
const fresh = () => { clock.set(2026, 11, 12, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));

// ---------- 1. the config ----------
test('C.TOWER: 1000 floors, 10 realms of 100, a lift every 10, all at once by default', () => {
  assert.strictEqual(TW.floors, 1000);
  assert.strictEqual(TW.liftEvery, 10);
  assert.strictEqual(TW.wave, 0, 'all the enemies at once unless the phone test says otherwise');
  assert.strictEqual(TW.zones.length, 10);
  const names = TW.zones.map((z) => z.name);
  assert.deepStrictEqual(plain(names), ["Tambanakua's Tide Stairs", "Pugita's Deep", "Berberoka's Swamp", "Magindara's Lagoon", "Anitun Tabu's Storm Gallery",
    'The Kataw Court', "Santelmo's Lantern Spire", 'Biringan, the Invisible City', "Mayari's Starfall", 'The Seventh Moon']);
  TW.zones.forEach((z, i) => {
    assert.strictEqual(z.n, i + 1);
    assert.ok(/^[a-z]+$/.test(z.id), 'an id: ' + z.id);
    assert.strictEqual(z.normal.length, 3, z.name + ': 3 normal enemies');
    ['floor', 'wall', 'top', 'crust'].forEach((k) => assert.strictEqual(z.look[k].length, 3, z.name + ' look ' + k));
    assert.ok(z.lava && z.lava.hot.length === 3 && z.lava.rim, z.name + ': its pools');
    assert.ok(/^#[0-9a-f]{6}$/.test(z.bg), z.name + ': its background');
    assert.ok('trick' in z, z.name + ': a trick hook (null for the first realm)');
  });
  assert.strictEqual(TW.zones[0].trick, null);
  assert.deepStrictEqual(plain(TW.zones.slice(1).map((z) => z.trick)), ['shield', 'burst', 'song', 'flock', 'heal', 'dark', 'split', 'revive', 'all']);
  assert.deepStrictEqual(plain(ctx.window.Farm.towerTricks), {}, 'the tricks registry is there, empty for now');
});

test('which realm a floor is in, and the floor bands: enemies and size', () => {
  [[1, 1], [100, 1], [101, 2], [500, 5], [501, 6], [999, 10], [1000, 10]].forEach(([f, z]) => assert.strictEqual(L.towerZone(f), z, 'floor ' + f));
  const want = [[1, 20, 28, 24], [100, 20, 28, 24], [101, 25, 30, 26], [200, 25, 30, 26], [201, 30, 34, 28], [300, 30, 34, 28], [301, 45, 40, 34],
    [400, 45, 40, 34], [401, 50, 42, 36], [500, 50, 42, 36], [501, 60, 46, 38], [777, 60, 46, 38], [1000, 60, 46, 38]];
  want.forEach(([f, n, w, h]) => {
    assert.strictEqual(L.towerCount(f), n, 'enemies on floor ' + f);
    assert.deepStrictEqual(plain(L.towerSize(f)), [w, h], 'size of floor ' + f);
  });
});

test('who leads a floor: a guard on 10 20 30 40 60 70 80 90, a mini boss on 50, the big boss on 100', () => {
  const roles = {};
  for (let f = 1; f <= 200; f++) { const r = L.towerRole(f); if (r) roles[f] = r; }
  assert.deepStrictEqual(roles, { 10: 'guard', 20: 'guard', 30: 'guard', 40: 'guard', 50: 'mini', 60: 'guard', 70: 'guard', 80: 'guard', 90: 'guard', 100: 'boss',
    110: 'guard', 120: 'guard', 130: 'guard', 140: 'guard', 150: 'mini', 160: 'guard', 170: 'guard', 180: 'guard', 190: 'guard', 200: 'boss' });
  assert.strictEqual(L.towerRole(1000), 'boss');
  assert.strictEqual(L.towerRole(950), 'mini');
  assert.strictEqual(L.towerRole(11), null);
});

// ---------- 2. the creatures ----------
test('the 60 creatures: registered by name in C.WILD.more (never C.WILD.order), each a stand-in row and tint until its own sheet', () => {
  const ids = [];
  TW.zones.forEach((z) => ids.push(...z.normal, z.guard, z.mini, z.boss));
  assert.strictEqual(ids.length, 60);
  assert.strictEqual(new Set(ids).size, 60, 'all different');
  ids.forEach((k) => {
    const d = WI.animals[k];
    assert.ok(d, k);
    assert.ok(WI.more.indexOf(k) >= 0, k + ' in C.WILD.more');
    assert.ok(WI.order.indexOf(k) < 0, k + ' not in C.WILD.order');
    assert.ok(d.tower, k + ' is a tower creature');
    assert.ok(WI.order.indexOf(d.sheetRow) >= 0, k + ': a stand-in row of the wild sheet (' + d.sheetRow + ')');
    assert.ok(d.tint > 0, k + ': its tint');
    assert.strictEqual(d.sheet, 'wild_' + k, k + ': its own sheet when the picture comes');
    assert.ok(d.name && d.px > 0 && d.w > 0 && d.walk > 0 && d.run > 0 && d.angry > 0, k + ': the numbers the world needs');
    assert.strictEqual(d.respawn, 0);
    (d.drops || []).forEach((x) => assert.ok(C.ITEMS[x[0]], k + ' drops ' + x[0]));
  });
  // the leaders are bosses (the big bar); the normal ones are not
  TW.zones.forEach((z) => {
    z.normal.forEach((k) => { assert.strictEqual(WI.animals[k].role, 'normal'); assert.ok(!WI.animals[k].boss, k); });
    [['guard', z.guard], ['mini', z.mini], ['boss', z.boss]].forEach(([r, k]) => { assert.strictEqual(WI.animals[k].role, r, k); assert.strictEqual(WI.animals[k].boss, true, k); });
  });
  // the fliers the spec names
  ['kanaway', 'dikya', 'parol_multo', 'dikya_buwan', 'langay', 'kabag', 'ulap', 'alitaptap', 'minokawa_sisiw'].forEach((k) => assert.strictEqual(WI.animals[k].flies, true, k + ' flies'));
  assert.ok(!WI.animals.talangka.flies);
  // the Wild Lands' order and the places' creatures are where they were
  assert.deepStrictEqual(plain(WI.order.slice(-5)), ['santelmo', 'sigbin', 'tikbalang', 'bungisngis', 'bakunawa']);
  assert.ok(WI.more.indexOf('talangka') > WI.more.indexOf(C.PLACES.palawan.dungeon.boss), 'appended after the places');
});

test('the Tower is a wild map, open to everyone (the Bow, the dog and the wild pack all work there)', () => {
  assert.strictEqual(L.isWildMap('tower'), true);
  const s = fresh();
  assert.strictEqual(L.wildOpen(s, 'tower'), true, 'no hunts needed');
  assert.ok(!C.DUNGEONS.tower, 'not a hunting place\'s cave');
  assert.ok(!C.PLACES.tower);
});

// ---------- 3. the strength rules ----------
test('hits to beat at damage 1 = 2 + floor(f / 25); energy lost = 2 + floor(f / 50)', () => {
  [[1, 2], [24, 2], [25, 3], [100, 6], [500, 22], [1000, 42]].forEach(([f, h]) => assert.strictEqual(L.towerHits(f), h, 'hits on floor ' + f));
  [[1, 2], [49, 2], [50, 3], [500, 12], [1000, 22]].forEach(([f, e]) => assert.strictEqual(L.towerLoss(f), e, 'energy on floor ' + f));
});

test('guard 5x, mini boss 10x, big boss 40x a normal enemy\'s hits; each hits harder than a normal one', () => {
  assert.strictEqual(L.towerHits(10, 'guard'), 5 * L.towerHits(10));
  assert.strictEqual(L.towerHits(50, 'mini'), 10 * L.towerHits(50));
  assert.strictEqual(L.towerHits(100, 'boss'), 40 * L.towerHits(100));
  assert.strictEqual(L.towerHits(1000, 'boss'), 40 * 42);
  assert.ok(L.towerLoss(10, 'guard') > L.towerLoss(10));
  assert.ok(L.towerLoss(50, 'mini') > L.towerLoss(50, 'guard'));
  assert.ok(L.towerLoss(100, 'boss') > L.towerLoss(100, 'mini'));
});

test('speed: +5% every 100 floors, at most +50%', () => {
  [[1, 1], [99, 1], [100, 1.05], [250, 1.1], [500, 1.25], [999, 1.45], [1000, 1.5]].forEach(([f, k]) => assert.ok(Math.abs(L.towerSpeed(f) - k) < 1e-9, 'floor ' + f + ': ' + L.towerSpeed(f)));
});

test('a floor\'s enemies: the count for its band, from its realm, the leader first; the same every time; not more with more players', () => {
  const r1 = plain(L.towerRoster(1));
  assert.strictEqual(r1.length, 20);
  r1.forEach((e, i) => { assert.strictEqual(e.slot, i); assert.ok(TW.zones[0].normal.indexOf(e.kind) >= 0, e.kind); });
  assert.deepStrictEqual(plain(L.towerRoster(1)), r1, 'the same floor holds the same ones');
  assert.notDeepStrictEqual(plain(L.towerRoster(2)).map((e) => e.kind), r1.map((e) => e.kind), 'another floor, another mix');
  const g = plain(L.towerRoster(10));
  assert.strictEqual(g.length, 21, 'the floor\'s enemies plus one guard');
  assert.strictEqual(g[0].kind, 'alimango');
  assert.strictEqual(plain(L.towerRoster(50))[0].kind, 'ulang');
  assert.strictEqual(plain(L.towerRoster(100))[0].kind, 'tambanakua');
  assert.strictEqual(plain(L.towerRoster(101)).length, 25);
  assert.ok(plain(L.towerRoster(101)).every((e) => TW.zones[1].normal.indexOf(e.kind) >= 0));
  assert.strictEqual(plain(L.towerRoster(1000)).length, 61);
  assert.strictEqual(plain(L.towerRoster(1000))[0].kind, 'bakunawa_ng_look');
  assert.strictEqual(L.towerRoster.length, 1, 'only the floor: no number of players');
});

test('waves: 0 = all at once; N = waves of N, the next when the last is mostly down', () => {
  const r = L.towerRoster(501);
  assert.strictEqual(L.towerInWave(r, 0, 0).length, 60, 'all at once');
  assert.deepStrictEqual(plain(L.towerInWave(r, 0, 20)).map((e) => e.slot), [...Array(20).keys()]);
  assert.strictEqual(L.towerInWave(r, 1, 20).length, 40);
  assert.strictEqual(L.towerInWave(r, 2, 20).length, 60);
  assert.strictEqual(L.towerWaves(60, 20), 3);
  assert.strictEqual(L.towerWaves(61, 20), 4);
  assert.strictEqual(L.towerWaves(60, 0), 1);
  // the next wave comes when the last is mostly down (at most a fifth of it still up)
  assert.strictEqual(L.towerWaveDue(20, 5), false);
  assert.strictEqual(L.towerWaveDue(20, 4), true);
  assert.strictEqual(L.towerWaveDue(20, 0), true);
  assert.strictEqual(L.towerWaveDue(3, 1), false, 'a small wave: all down first');
  assert.strictEqual(L.towerWaveDue(3, 0), true);
});

test('energy a tower creature costs: its floor\'s hit, halved by a dish\'s power, never under 1; the Fire Charm and place gear do not count here', () => {
  const s = fresh();
  assert.strictEqual(L.chargeLoss(s, L.towerLoss(500), 'talangka'), 12);
  s.hg = 0xff; // (all of Hunter's gear from before, the Fire Charm with it)
  if (L.wear) L.wear(s, 'g:charm');
  assert.strictEqual(L.chargeLoss(s, L.towerLoss(500), 'talangka'), 12, 'the Fire Charm is for the places from before');
  assert.ok(L.chargeLoss(s, 12, 'boar') < 12, '...where it still works');
  assert.strictEqual(L.chargeLoss(s, 1, 'talangka'), 1);
});

// ---------- 4. a map per floor, built in code ----------
const LAIR = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'lair.json'), 'utf8'));
const solidGids = (m) => {
  const out = new Set();
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => (t.properties || []).forEach((p) => { if (p.name === 'collides' && p.value) out.add(ts.firstgid + t.id); })));
  return out;
};
// walkable tiles of a floor (no solid tile, not under a prop's foot), and those reached on foot from the way in
const walkOf = (m) => {
  const W = m.width, H = m.height, solid = solidGids(m), block = new Uint8Array(W * H), S = m.tilewidth;
  m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => l.data.forEach((g, i) => { if (solid.has(g)) block[i] = 1; }));
  const objs = m.layers.find((l) => l.type === 'objectgroup').objects, props = m.tilesets.find((t) => t.name === 'props');
  objs.filter((o) => o.gid).forEach((o) => {
    const t = props.tiles.find((q) => q.id === o.gid - props.firstgid), foot = (t.properties.find((p) => p.name === 'foot') || {}).value || 0;
    const x0 = Math.round(o.x / S), w = Math.round(o.width / S), y1 = Math.round(o.y / S) - 1;
    for (let y = y1 - foot + 1; y <= y1; y++) for (let x = x0; x < x0 + w; x++) block[y * W + x] = 1;
  });
  const seen = new Uint8Array(W * H), q = [3 * W + 5];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop(), x = c % W, y = Math.floor(c / W);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = (y + dy) * W + x + dx; if (!block[n] && !seen[n]) { seen[n] = 1; q.push(n); } });
  }
  return { W, H, block, seen, objs };
};

test('L.towerMap: a floor\'s room in the caves\' layout, sized by its band, the way in at the top left, the way out to Manila\'s lighthouse', () => {
  [1, 101, 250, 333, 450, 777].forEach((f) => {
    const m = plain(L.towerMap(f, LAIR)), sz = plain(L.towerSize(f));
    assert.deepStrictEqual([m.width, m.height], sz, 'floor ' + f);
    assert.deepStrictEqual(m.layers.map((l) => l.name), ['Ground', 'Walls', 'Objects']);
    assert.deepStrictEqual(m.tilesets.map((t) => t.name), LAIR.tilesets.map((t) => t.name), 'the caves\' own sheets');
    m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => assert.strictEqual(l.data.length, sz[0] * sz[1]));
    const objs = m.layers[2].objects, by = (n) => objs.find((o) => o.name === n);
    assert.deepStrictEqual([by('entrance').x, by('entrance').y], [Math.round(5.5 * 256), Math.round(3.6 * 256)], 'the way in, under the ladder');
    const out = by('exit'), pr = Object.fromEntries(out.properties.map((p) => [p.name, p.value]));
    assert.deepStrictEqual([out.type, out.x / 256, out.y / 256], ['warp', 5, 2]);
    assert.deepStrictEqual(pr, { to: 'manila', spawn: 'from_tower', label: 'Go out' });
    assert.strictEqual(by('dungeon_gate').type, 'dungeon_gate');
    assert.deepStrictEqual([by('dungeon_gate').width, by('dungeon_gate').height], [512, 512], 'the stairs up: 2 x 2');
    const wild = by('wild');
    assert.deepStrictEqual([wild.x, wild.y, wild.width, wild.height].map((v) => v / 256), [1, 4, sz[0] - 2, sz[1] - 5]);
    // the walls round it, the ladder, and the lift's tiles left free
    const walls = m.layers[1].data, W = sz[0], lg = LAIR.tilesets[0].firstgid;
    assert.strictEqual(walls[2 * W + 5], lg + 11, 'the ladder up (out)');
    [[2, 2], [3, 2], [2, 3], [3, 3]].forEach(([x, y]) => assert.strictEqual(walls[y * W + x], 0, 'the lift\'s tile ' + x + ',' + y));
    for (let x = 0; x < W; x++) assert.ok(walls[x] && walls[(sz[1] - 1) * W + x], 'top and bottom walls');
  });
});

test('every floor differs and is the same for every player; every free tile and the stairs up are reached on foot from the way in', () => {
  const key = (f) => JSON.stringify(plain(L.towerMap(f, LAIR)).layers.slice(1));
  assert.strictEqual(key(7), key(7), 'the same floor, the same room');
  const many = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(key));
  assert.strictEqual(many.size, 10, 'ten floors, ten rooms');
  for (let f = 1; f <= 1000; f += 7) {
    const m = plain(L.towerMap(f, LAIR)), w = walkOf(m), g = w.objs.find((o) => o.name === 'dungeon_gate');
    for (let i = 0; i < w.W * w.H; i++) if (!w.block[i]) assert.ok(w.seen[i], `floor ${f}: tile ${i % w.W},${Math.floor(i / w.W)} cannot be reached`);
    const gx = g.x / 256, gy = g.y / 256;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => assert.ok(w.seen[(gy + dy) * w.W + gx + dx], `floor ${f}: the stairs up are reached`));
    assert.ok(gy >= Math.floor(w.H / 2) - 1, 'the stairs up are in the lower half');
    // pillars and pools are there, and room for the enemies (at least 20 free tiles each)
    const walls = m.layers[1].data, lg = LAIR.tilesets[0].firstgid;
    assert.ok(walls.some((v) => v === lg + 5), `floor ${f}: pools`);
    const free = Array.from(w.seen).filter(Boolean).length;
    assert.ok(free >= L.towerCount(f) * 20, `floor ${f}: ${free} free tiles for ${L.towerCount(f)}`);
  }
});

// ---------- 6. the door: Manila's lighthouse ----------
const TOWN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'town.json'), 'utf8'));
test('the lighthouse is the door: a warp to the Tower on its foot, "The Lost Tower" on it, the way out in front of it on the breakwater', () => {
  const m = plain(L.manilaMap(TOWN)), objs = m.layers.find((l) => l.type === 'objectgroup').objects, d = plain(L.towerDoor());
  const house = C.MANILA.buildings.find((b) => b.key === 'lighthouse');
  assert.strictEqual(house.name, 'The Lost Tower');
  assert.ok(d.x >= house.box[0] && d.x < house.box[0] + house.box[2] && d.y === house.box[1] + house.box[3] - 1, 'on the lighthouse\'s foot');
  const door = objs.find((o) => o.name === 'tower_door'), pr = Object.fromEntries(door.properties.map((p) => [p.name, p.value]));
  assert.deepStrictEqual([door.type, door.x / 256, door.y / 256], ['warp', d.x, d.y]);
  assert.deepStrictEqual(pr, { to: 'tower', spawn: 'entrance', label: 'Go in' }, 'tapped (not walked into): the way out lands right in front of it');
  const out = objs.find((o) => o.name === 'from_tower');
  const grid = L.manilaGrid(m);
  assert.ok(grid.ok(Math.floor(out.x / 256), Math.floor(out.y / 256)), 'the way out is free ground');
  assert.ok(L.manilaPath(grid, Math.floor(out.x / 256), Math.floor(out.y / 256), Math.floor(C.MANILA.spawns.from_train[0]), Math.floor(C.MANILA.spawns.from_train[1]), 9000), 'and walks to the station');
  assert.strictEqual(new Set(objs.map((o) => o.id)).size, objs.length, 'object ids stay unique');
  // the goal arrow: out by the ladder; into the Tower by the lighthouse
  assert.strictEqual(C.ROUTES.tower.farm, 'exit');
  assert.strictEqual(C.ROUTES.manila.tower, 'tower_door');
  assert.strictEqual(C.ROUTES.town.tower, C.ROUTES.town.manila);
});

// ---------- 7. Pearls, the lift, the save ----------
test('Pearls: paid once, for a floor newer than the deepest cleared: realm z pays z, 5z (guard), 30z (mini boss), 100z (big boss)', () => {
  const s = fresh();
  assert.strictEqual(s.pearls, 0);
  assert.strictEqual(L.towerPay(s, 1), 1);
  assert.strictEqual(L.towerPay(s, 1), 0, 'nothing alone on a floor you cleared');
  assert.strictEqual(s.tower.cl, 1);
  [[10, 5], [50, 30], [100, 100], [101, 2], [150, 60], [200, 200], [901, 10], [910, 50], [950, 300], [1000, 1000]].forEach(([f, n]) => assert.strictEqual(L.towerPearls(f), n, 'floor ' + f));
  // a whole realm pays 260 z: 260 for 1-100, 14,300 for all 1,000
  let z1 = 0, all = 0;
  for (let f = 1; f <= 1000; f++) { all += L.towerPearls(f); if (f <= 100) z1 += L.towerPearls(f); }
  assert.deepStrictEqual([z1, all], [260, 14300]);
  const t = fresh();
  for (let f = 1; f <= 200; f++) L.towerPay(t, f);
  assert.strictEqual(t.pearls, 780, 'reached 200: 780 Pearls');
  for (let f = 1; f <= 200; f++) L.towerPay(t, f);
  assert.strictEqual(t.pearls, 780, 'climbing them again pays nothing');
});

test('helper Pearls (the hook for the online step): 1 on a floor you cleared, helping; at most 50 a day; a new floor still pays its own', () => {
  const s = fresh();
  for (let f = 1; f <= 20; f++) L.towerPay(s, f);
  const before = s.pearls;
  let got = 0;
  for (let k = 0; k < 60; k++) got += L.towerPay(s, 5, { helper: true });
  assert.strictEqual(got, 50, 'at most 50 a day');
  assert.strictEqual(s.pearls, before + 50);
  assert.strictEqual(L.towerPay(s, 21, { helper: true }), 1, 'a floor new to you pays its first-time Pearls, helper or not');
  s.day += 1;
  assert.strictEqual(L.towerPay(s, 5, { helper: true }), 1, 'a new day, 50 more');
});

test('the lift: 1, 11, 21 ... up to the deepest floor reached; the door takes you to the last of them', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(L.towerStops(s)), [1]);
  assert.strictEqual(L.towerStart(s), 1);
  assert.strictEqual(L.towerReach(s, 1), true);
  assert.strictEqual(L.towerReach(s, 1), false, 'not a new deepest');
  [2, 3, 11].forEach((f) => L.towerReach(s, f));
  assert.deepStrictEqual(plain(L.towerStops(s)), [1, 11]);
  L.towerReach(s, 35);
  assert.deepStrictEqual(plain(L.towerStops(s)), [1, 11, 21, 31]);
  assert.strictEqual(L.towerStart(s), 31);
  L.towerReach(s, 5000);
  assert.strictEqual(s.tower.deep, 1000, 'never past the top');
});

test('the save: Pearls as prl, the Tower as tw2 (new keys); an older save has none; in the Tower it is saved in Manila at the lighthouse', () => {
  const s = fresh();
  let o = plain(L.serialize(s));
  assert.ok(!('prl' in o) && !('tw2' in o), 'nothing until you climb');
  const old = roundTrip(s);
  assert.deepStrictEqual([old.pearls, plain(old.tower)], [0, { deep: 0, cl: 0, hd: -1, hn: 0 }]);
  for (let f = 1; f <= 12; f++) { L.towerReach(s, f); L.towerPay(s, f); }
  L.towerPay(s, 3, { helper: true });
  o = plain(L.serialize(s));
  assert.strictEqual(o.prl, s.pearls);
  assert.deepStrictEqual(o.tw2, [12, 12, s.day, 1]);
  const b = roundTrip(s);
  assert.deepStrictEqual([b.pearls, plain(b.tower)], [s.pearls, { deep: 12, cl: 12, hd: s.day, hn: 1 }]);
  // in the Tower: Manila, in front of the lighthouse's door (the floor is not saved)
  s.map = 'tower';
  s.player = { x: 5 * 256, y: 6 * 256, dir: 'up' };
  const d = plain(L.towerDoor()), back = roundTrip(s);
  assert.strictEqual(back.map, 'manila');
  assert.deepStrictEqual([back.player.x, back.player.y], [Math.round(d.out[0] * 256), Math.round(d.out[1] * 256)]);
  assert.strictEqual(back.pearls, s.pearls);
  // bad numbers are clamped
  const bad = L.deserialize(Object.assign(plain(L.serialize(fresh())), { prl: -5, tw2: [99999, 'x', null, 1e9] }));
  assert.deepStrictEqual([bad.pearls, plain(bad.tower)], [0, { deep: 1000, cl: 0, hd: 0, hn: 10000 }]);
  // the save keys are new: nothing else in the save uses them
  const keys = Object.keys(plain(L.serialize(fresh())));
  assert.ok(keys.indexOf('prl') < 0 && keys.indexOf('tw2') < 0);
});

test('a Tower hunt counts as a hunt but leaves no slot waiting and no line in the Hunter\'s Book', () => {
  const s = fresh(), n = s.wild.n;
  L.hunted(s, 'tower', 3, 'talangka', 1);
  assert.strictEqual(s.wild.n, n + 1);
  assert.strictEqual(s.wild.gone['tower:3'], undefined);
  assert.ok(!('talangka' in s.wild.by) && !('talangka' in s.wild.best));
  assert.ok(!('pk' in plain(L.serialize(s))), 'nothing by name in the save');
});
