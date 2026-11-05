// Unit tests for Central Park (owner, 6 Nov 2026): the map (maps/park.json, tools/make-map.js park()), the road up to it
// from town (tools/park-town.js), the ways in and out for the goal arrow, and the save (src/01-logicZZZ-park.js).
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
const fresh = () => { clock.set(2026, 11, 6, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const { PROPS } = require('../tools/tiles');

const S = 256;
const mapOf = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', name + '.json'), 'utf8'));
const objectsOf = (m) => m.layers.find((l) => l.type === 'objectgroup').objects;
const propsOf = (o) => Object.fromEntries((o.properties || []).map((p) => [p.name, p.value]));
const tileOf = (m, o) => Math.floor(o.y / S) * m.width + Math.floor(o.x / S);

// The tiles a farmer can stand on, from `start`: solid tiles (Walls, water), the solid rows of every prop, and any extra
// solid rectangles (the town's station) are walls. As in station.test.js.
function reach(m, startTile, extraSolid = []) {
  const W = m.width, H = m.height, solid = new Set(), collides = new Set();
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { if ((t.properties || []).some((p) => p.name === 'collides' && p.value)) collides.add(ts.firstgid + t.id); }));
  ['Ground', 'Walls'].forEach((n) => m.layers.find((l) => l.name === n).data.forEach((g, i) => { if (collides.has(g)) solid.add(i); }));
  const propSet = m.tilesets.find((t) => t.name === 'props');
  objectsOf(m).filter((o) => o.gid && !propsOf(o).festival).forEach((o) => {
    const name = propSet.tiles.find((t) => t.id === o.gid - propSet.firstgid).image.replace(/^.*\/|\.png$/g, ''), p = PROPS[name];
    const left = Math.round(o.x / S), bottom = Math.round(o.y / S), w = Math.round(o.width / S); // (as the game: the object's own width)
    for (let y = bottom - (p.foot || 0); y < bottom; y++) for (let x = left; x < left + w; x++) solid.add(y * W + x);
  });
  extraSolid.forEach((o) => { for (let y = o.y / S; y < (o.y + o.height) / S; y++) for (let x = o.x / S; x < (o.x + o.width) / S; x++) solid.add(y * W + x); });
  const seen = new Set([startTile]), q = [startTile];
  while (q.length) {
    const k = q.pop(), x = k % W;
    [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W].forEach((o) => { if (o >= 0 && o < W * H && !seen.has(o) && !solid.has(o)) { seen.add(o); q.push(o); } });
  }
  return { seen, solid };
}

test('the park map: about 30 x 26, town tiles and props, every picture it uses is in the game', () => {
  const m = mapOf('park');
  assert.strictEqual(m.width, 30);
  assert.strictEqual(m.height, 26);
  assert.deepStrictEqual(m.tilesets.map((t) => t.name), ['tiles', 'seasons', 'props'], 'the seasons tileset: it changes with the seasons, like town');
  const propSet = m.tilesets.find((t) => t.name === 'props');
  objectsOf(m).filter((o) => o.gid).forEach((o) => {
    const name = propSet.tiles.find((t) => t.id === o.gid - propSet.firstgid).image.replace(/^.*\/|\.png$/g, '');
    assert.ok(PROPS[name], name + ' is a prop');
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'props', name + '.webp')), name + ' has its picture');
  });
  const names = objectsOf(m).filter((o) => o.gid).map((o) => propSet.tiles.find((t) => t.id === o.gid - propSet.firstgid).image.replace(/^.*\/|\.png$/g, ''));
  ['hall_of_fame', 'fountain', 'gazebo', 'notice', 'bench', 'lamp', 'flowerbed'].forEach((n) => assert.ok(names.includes(n), 'the park has a ' + n));
});

test('the park is for meeting, not work: no water to fish, no field, no forage, no pens, no wild animals', () => {
  const m = mapOf('park');
  const ts = m.tilesets.find((t) => t.name === 'tiles');
  const special = new Set();
  m.tilesets.forEach((t) => (t.tiles || []).forEach((x) => { if ((x.properties || []).some((p) => (p.name === 'water' || p.name === 'tillable') && p.value)) special.add(t.firstgid + x.id); }));
  m.layers.filter((l) => l.data).forEach((l) => l.data.forEach((g, i) => assert.ok(!special.has(g), l.name + ' tile ' + i + ' is water or field')));
  assert.ok(ts);
  const types = new Set(objectsOf(m).map((o) => o.type));
  ['forage', 'pen', 'dogarea', 'catarea', 'wild', 'minefloor', 'shop', 'stand'].forEach((t) => assert.ok(!types.has(t), 'no ' + t));
  assert.strictEqual(L.isWildMap('park'), false);
  assert.ok(!C.FORAGE_COUNT.park);
});

test('the park: in from town at the south gate, the Hall of Fame door, the plaza and the gate can all be walked to', () => {
  const m = mapOf('park'), objs = objectsOf(m), by = (n) => objs.find((o) => o.name === n);
  const spawn = by('from_town'), gate = by('gate'), door = by('hall_door');
  assert.ok(spawn && spawn.point && propsOf(spawn).dir === 'up');
  assert.deepStrictEqual(propsOf(gate), { to: 'town', spawn: 'from_park', walk: true });
  assert.strictEqual(gate.y / S, m.height - 1, 'the gate is on the south edge');
  assert.strictEqual(door.type, 'hall');
  const { seen, solid } = reach(m, tileOf(m, spawn));
  ['from_town', 'door_hall', 'plaza'].forEach((n) => assert.ok(seen.has(tileOf(m, by(n))), n + ' can be walked to'));
  for (let x = gate.x / S; x < (gate.x + gate.width) / S; x++) assert.ok(seen.has((gate.y / S) * m.width + x), 'the gate can be walked into');
  // the door is in the Hall's solid front, with an open tile under it to stand on and face it
  for (let x = door.x / S; x < (door.x + door.width) / S; x++) {
    assert.ok(solid.has((door.y / S) * m.width + x), 'the door is in the wall');
    assert.ok(seen.has((door.y / S + 1) * m.width + x), 'you can stand in front of the door');
  }
  // the spawn is not on the gate (or you would bounce straight back to town)
  assert.ok(Math.floor(spawn.y / S) < gate.y / S);
  // most of the park is open ground: wide paths and lawns
  assert.ok(seen.size > m.width * m.height * 0.55, 'open ground: ' + seen.size);
});

test('town: the dead end by the Station goes up the park road to the top edge; from_park is just inside it; nothing else moved', () => {
  const m = mapOf('town'), objs = objectsOf(m), by = (n) => objs.find((o) => o.name === n);
  const road = by('park_road'), back = by('from_park');
  assert.deepStrictEqual(propsOf(road), { to: 'park', spawn: 'from_town', walk: true });
  assert.deepStrictEqual([road.x / S, road.y / S, road.width / S, road.height / S], [35, 0, 2, 1]);
  assert.ok(back && back.point && propsOf(back).dir === 'down');
  const backTile = tileOf(m, back);
  assert.ok(Math.floor(back.y / S) > 0, 'from_park is not on the warp');
  const station = ['station', 'rails', 'cargo'].map(by);
  const { seen } = reach(m, tileOf(m, by('from_farm')), station);
  assert.ok(seen.has(backTile), 'from_park can be walked to from the farm road');
  assert.ok(seen.has(35) && seen.has(36), 'the warp can be walked into');
  // the road joins the old dead end (x 37-38, y 6, in front of the Station)
  const path = m.tilesets.find((t) => t.name === 'tiles').firstgid + require('../tools/tiles').TILES.T.path, ground = m.layers.find((l) => l.name === 'Ground').data;
  for (let y = 0; y <= 6; y++) assert.strictEqual(ground[y * m.width + 35], path, 'road at 35,' + y);
  [37, 38].forEach((x) => assert.strictEqual(ground[6 * m.width + x], path, 'the dead end at ' + x + ',6'));
  // the old places are where they were (a save standing in town stays put)
  assert.deepStrictEqual([by('from_mine').x, by('from_mine').y], [28 * S, Math.round(11.6 * S)]);
  assert.deepStrictEqual([by('mine_door').x / S, by('mine_door').y / S], [27, 10]);
  assert.deepStrictEqual([by('from_farm').x, by('from_farm').y], [15 * S, Math.round(1.6 * S)]);
});

test('the goal arrow and following a friend know the way to and from the park, from everywhere', () => {
  const R = C.ROUTES;
  const files = { farm: 'farm', house: 'house_1', town: 'town', mine: 'mine', pulag: 'pulag', makiling: 'makiling', magayon: 'magayon', park: 'park' };
  Object.keys(files).forEach((m) => {
    if (m === 'park') return;
    assert.ok(R[m].park, m + ' -> park');
    assert.ok(objectsOf(mapOf(files[m])).some((o) => o.name === R[m].park && o.type === 'warp'), m + ': ' + R[m].park + ' is a way out');
    assert.strictEqual(R.park[m], 'gate', 'park -> ' + m);
  });
  assert.strictEqual(R.town.park, 'park_road');
  assert.ok(objectsOf(mapOf('park')).some((o) => o.name === 'gate'));
});

test('a game closed in the park opens again in town on the park road, and a town save keeps its spot', () => {
  const s = fresh();
  s.map = 'park';
  s.player = { x: 3000, y: 3000, dir: 'left' };
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  const town = JSON.parse(JSON.stringify(L.serialize(Object.assign({}, s, { map: 'town' }))));
  assert.strictEqual(o.m, town.m, 'saved as town (an older game knows that number)');
  assert.strictEqual(o.p, undefined);
  assert.strictEqual(o.pk, 1);
  const back = L.deserialize(o);
  assert.strictEqual(back.map, 'town');
  assert.strictEqual(back.player.spawn, 'from_park');
  assert.strictEqual(back.player.x, null);
  const t = fresh();
  t.map = 'town';
  t.player = { x: 7168, y: 2970, dir: 'down' };
  const tb = roundTrip(t);
  assert.strictEqual(tb.map, 'town');
  assert.strictEqual(tb.player.x, 7168);
  assert.strictEqual(tb.player.y, 2970);
  assert.strictEqual(tb.player.spawn, undefined);
  assert.strictEqual(JSON.parse(JSON.stringify(L.serialize(t))).pk, undefined);
});

test("the Hall of Fame's door says what will hang there", () => {
  assert.strictEqual(C.PARK.hall, "THE HALL OF FAME\nOpening soon: the names of Harvest Ville's best hunters, farmers and anglers will hang here.");
  assert.strictEqual(C.PARK.name, 'Central Park');
});
