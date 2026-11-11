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
