// Unit tests for the farmhouse: levels and upgrades, buying furniture, placing it (walls, floor, rugs, the door,
// reachability), storing it, wallpapers and floors, Home Beauty, the save, and older saves.
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
const H = C.HOME;
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const T = (key) => H.typeIndex[key];
const fresh = () => { const s = L.newState(); s.seed = 3; return s; };
const sleep = (s, n = 1) => { let r; for (let i = 0; i < n; i++) r = L.endDay(s, false, {}); return r; };

test('the home data: 10 levels that only grow, 27 kinds of furniture in 10 styles', () => {
  assert.strictEqual(H.levels.length, 10);
  for (let i = 1; i < H.levels.length; i++) {
    const a = H.levels[i - 1], b = H.levels[i];
    assert.ok(b.map[0] >= a.map[0] && b.map[1] >= a.map[1] && b.gold > a.gold, b.name);
  }
  assert.strictEqual(H.types.length, 27);
  assert.strictEqual(H.styles.length, 10);
  assert.strictEqual(H.styles.filter((st) => st.festival).length, 5);
  H.styles.forEach((st) => { if (st.festival) assert.ok(C.FESTIVALS.some((f) => f.key === st.festival), st.key); });
  H.types.forEach((t) => assert.ok(['floor', 'wall', 'flat'].includes(t.place) && t.w >= 1 && t.h >= 1 && t.foot <= t.h, t.key));
});

test('a new farm starts in a Cozy Cabin with the starter furniture, all of it validly placed', () => {
  const s = fresh();
  assert.strictEqual(s.home.level, 1);
  assert.strictEqual(L.homeLevel(s).name, 'Cozy Cabin');
  assert.strictEqual(s.home.items.length, H.starter.length + 1, 'and the free Dresser (storage, 30 Oct)');
  s.home.items.forEach((it, i) => assert.strictEqual(L.cantPlace(s, it.t, it.x, it.y, i), null, H.types[it.t].key));
  assert.ok(L.homeHas(s, 'sleep') && L.homeHas(s, 'tv'));
  assert.strictEqual(L.homeTier(s), 0, 'a plain home to start with');
  assert.strictEqual(L.maxEnergy(s), C.MAX_ENERGY);
});

test('Mira upgrades the house one level at a time, and it takes days', () => {
  const s = fresh();
  s.gold = 1e6; s.lumber = 1e4; s.stone = 1e4;
  assert.strictEqual(L.startHomeUpgrade(s), 'ok');
  assert.strictEqual(s.gold, 1e6 - H.levels[1].gold);
  assert.strictEqual(L.startHomeUpgrade(s), 'busy');
  const r = sleep(s);
  assert.strictEqual(r.homeUp, 2);
  assert.strictEqual(s.home.level, 2);
  L.startHomeUpgrade(s);
  assert.strictEqual(sleep(s).homeUp, undefined, 'the Farmhouse takes 2 days');
  assert.strictEqual(sleep(s).homeUp, 3);
  assert.ok(s.builds.bighouse, 'the Farmhouse is big enough to marry');
  s.home.level = 10;
  assert.strictEqual(L.startHomeUpgrade(s), 'max');
  const poor = fresh();
  assert.strictEqual(L.startHomeUpgrade(poor), 'gold');
});

test('furniture goes into storage when bought; festival editions only in their season', () => {
  const s = fresh();
  s.gold = 1e5;
  assert.strictEqual(L.buyFurn(s, T('sofa'), 3), 'ok');
  assert.strictEqual(s.gold, 1e5 - L.furnPrice(T('sofa'), 3));
  assert.strictEqual(L.furnPrice(T('sofa'), 3), 2550);
  assert.deepStrictEqual(plain(s.home.bag), { [T('sofa') + '.3']: 1 });
  assert.strictEqual(L.buyFurn(s, T('bed'), H.styleIndex.flower), 'ok', 'spring: the Flower Festival set is on sale');
  assert.strictEqual(L.buyFurn(s, T('bed'), H.styleIndex.starry), 'season');
  assert.strictEqual(L.buyFurn(s, T('kitchen'), 0), 'needs', 'a counter needs the Kitchen first');
  s.gold = 10;
  assert.strictEqual(L.buyFurn(s, T('chair'), 0), 'gold');
  const c = fresh();
  c.gold = 1e5;
  L.buyFurn(c, T('cat_bed'), 0);
  assert.ok(c.cat, 'a cat basket brings the cat');
});

test('placing: wall things on the back wall, floor things on the floor, nothing on top of anything', () => {
  const s = fresh();
  s.gold = 1e5;
  ['painting', 'chair', 'rug', 'sofa'].forEach((k) => L.buyFurn(s, T(k), 0));
  assert.strictEqual(L.placeFurn(s, T('painting'), 0, 4, 3, 0), 'wall');
  assert.strictEqual(L.placeFurn(s, T('painting'), 0, 1, 0, 0), 'taken', 'the window is there');
  assert.strictEqual(typeof L.placeFurn(s, T('painting'), 0, 3, 0, 0), 'string', 'the shelf is there');
  const size = L.homeSize(s);
  assert.strictEqual(L.cantPlace(s, T('chair'), 0, 4, null), 'outside');
  assert.strictEqual(L.cantPlace(s, T('chair'), size.w - 1, 4, null), 'outside');
  assert.strictEqual(L.cantPlace(s, T('chair'), 3, 1, null), 'outside', 'not up on the wall');
  assert.strictEqual(L.cantPlace(s, T('chair'), 1, 3, null), 'taken', 'the bed is there');
  assert.strictEqual(L.cantPlace(s, T('chair'), 5, 8, null), 'door', 'not in the doorway');
  assert.strictEqual(L.cantPlace(s, T('rug'), 2, 5, null), 'taken', 'one rug on top of another');
  assert.strictEqual(L.cantPlace(s, T('chair'), 3, 5, null), null, 'a chair can stand on a rug');
  const i = L.placeFurn(s, T('chair'), 0, 2, 7, 1);
  assert.strictEqual(typeof i, 'number');
  assert.strictEqual(s.home.items[i].f, 1, 'turned');
  assert.strictEqual(s.home.bag[T('chair') + '.0'], undefined, 'out of storage');
  assert.strictEqual(L.placeFurn(s, T('chair'), 0, 3, 7, 0), 'none', 'no more chairs in storage');
});

test('nothing may cut the bed, the TV or the kitchen off from the door', () => {
  const s = fresh();
  s.gold = 1e6;
  s.home.items = s.home.items.filter((it) => !['rug', 'table', 'plant', 'dresser'].includes(H.types[it.t].key));
  // a row of dressers across the room below the bed and the TV
  for (let k = 0; k < 3; k++) L.buyFurn(s, T('dresser'), 0);
  assert.strictEqual(typeof L.placeFurn(s, T('dresser'), 0, 1, 4, 0), 'number');
  assert.strictEqual(typeof L.placeFurn(s, T('dresser'), 0, 3, 4, 0), 'number');
  assert.strictEqual(L.cantPlace(s, T('dresser'), 5, 4, null), 'blocks', 'the last gap stays open');
});

test('moving and storing; the last bed stays', () => {
  const s = fresh();
  const tv = s.home.items.findIndex((it) => H.types[it.t].key === 'tv');
  assert.strictEqual(L.moveFurn(s, tv, 6, 6, 1), 'ok');
  assert.deepStrictEqual([s.home.items[tv].x, s.home.items[tv].y, s.home.items[tv].f], [6, 6, 1]);
  assert.strictEqual(L.moveFurn(s, tv, 1, 2), 'taken');
  assert.strictEqual(L.storeFurn(s, tv), 'ok');
  assert.strictEqual(s.home.bag[T('tv') + '.0'], 1);
  const bed = s.home.items.findIndex((it) => H.types[it.t].key === 'bed');
  assert.strictEqual(L.storeFurn(s, bed), 'lastbed');
  const spot = L.findSpot(s, T('tv'), 4, 4, null);
  assert.ok(spot && L.cantPlace(s, T('tv'), spot.x, spot.y, null) === null);
});

test('Home Beauty: furniture, styles, a second copy counts half, walls and floors; more energy each morning', () => {
  const s = fresh();
  const b0 = L.homeBeauty(s);
  s.gold = 1e7;
  L.buyFurn(s, T('plant'), 4);
  L.placeFurn(s, T('plant'), 4, 6, 6, 0);
  assert.strictEqual(L.homeBeauty(s) - b0, L.furnBeauty(T('plant'), 4));
  L.buyFurn(s, T('plant'), 4);
  L.placeFurn(s, T('plant'), 4, 6, 7, 0);
  assert.strictEqual(L.homeBeauty(s) - b0, Math.round(L.furnBeauty(T('plant'), 4) * 1.5));
  assert.strictEqual(L.setSurface(s, 'wall', 4), 'ok');
  assert.strictEqual(L.setSurface(s, 'floor', 2), 'ok');
  assert.ok(s.home.walls & (1 << 4) && s.home.floors & (1 << 2));
  const gold = s.gold;
  assert.strictEqual(L.setSurface(s, 'wall', 0), 'ok');
  assert.strictEqual(L.setSurface(s, 'wall', 4), 'ok', 'owned: switching back is free');
  assert.strictEqual(s.gold, gold);
  // a lovely home: more max energy in the morning
  s.home.level = 10;
  ['sofa', 'armchair', 'wardrobe', 'clock', 'desk', 'dresser', 'aquarium', 'painting', 'mirror', 'floor_lamp', 'big_plant', 'nightstand']
    .forEach((k) => [3, 4].forEach((v) => {
      L.buyFurn(s, T(k), v);
      const spot = L.findSpot(s, T(k), 10, 6, null);
      if (spot) L.placeFurn(s, T(k), v, spot.x, spot.y, 0);
    }));
  assert.ok(L.homeTier(s) >= 3, 'tier ' + L.homeTier(s));
  assert.strictEqual(L.maxEnergy(s), C.MAX_ENERGY + L.homeBonus(s));
  s.energy = 0;
  clock.advance(24 * 60);
  L.regen(s);
  assert.strictEqual(s.energy, C.MAX_ENERGY + L.homeBonus(s), 'energy comes back up to the higher maximum');
  assert.strictEqual(roundTrip(s).energy, s.energy, 'the extra energy survives a reload');
  assert.ok(L.homeComment(s, 0.3), 'villagers have something nice to say');
});

test('once a week a friend visits and says what they think', () => {
  const s = fresh();
  L.friend(s, 'lily').met = 1;
  L.friend(s, 'lily').pts = 50;
  let visit = null;
  for (let d = 0; d < 7 && !visit; d++) visit = sleep(s).visitor;
  assert.ok(visit && visit.who === 'lily' && visit.line);
});

test('the home survives a save; an older save keeps its house and furniture where they were', () => {
  const s = fresh();
  s.gold = 1e6;
  L.buyFurn(s, T('wardrobe'), 2);
  L.buyFurn(s, T('mirror'), 1);
  L.placeFurn(s, T('mirror'), 1, 6, 0, 1);
  L.setSurface(s, 'floor', 3);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.home), plain(s.home));
  // an old save with the House Extension, the kitchen and Mira's furniture
  const o = plain(L.serialize(fresh()));
  delete o.hm;
  o.bd = C.BUILD_KEYS.map((k) => (['bighouse', 'kitchen', 'f_music', 'f_cat'].includes(k) ? 1 : 0));
  const old = L.deserialize(o);
  assert.strictEqual(old.home.level, H.marryLevel);
  const keys = old.home.items.map((it) => H.types[it.t].key);
  ['double_bed', 'kitchen', 'music_box', 'cat_bed', 'bed', 'tv'].forEach((k) => assert.ok(keys.includes(k), k));
  old.home.items.forEach((it, i) => assert.strictEqual(L.cantPlace(old, it.t, it.x, it.y, i), null, H.types[it.t].key));
  // a broken save never leaves you without a bed
  const bad = plain(L.serialize(fresh()));
  bad.hm[5] = [];
  assert.ok(L.homeHas(L.deserialize(bad), 'sleep'));
  // a big home still fits the save budget
  const big = fresh();
  big.home.level = 10;
  for (let k = 0; k < 120; k++) big.home.items.push({ t: k % 27, v: k % 10, x: 10, y: 10, f: 1 });
  for (let k = 0; k < 270; k++) big.home.bag[(k % 27) + '.' + (k % 10)] = 99;
  assert.ok(JSON.stringify(L.serialize(big)).length < 6000);
});
