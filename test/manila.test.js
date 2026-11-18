// Unit tests for Manila, step 1 (src/00-zzzzzzzzzzzzzzzzzzz-manila.js, src/01-logicZZZZZZZZZZZZZZ-manila.js): the map
// built from the layout (its size and sheets, nothing on top of anything, every place reachable on foot, the gates), the
// train's tickets, the valley road's hook, the people's hours and words, and the save (an older game opens in town).
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
const M = C.MANILA;
const TOWN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'town.json'), 'utf8'));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const TOWN_TEXT = JSON.stringify(TOWN);
const plain = (v) => JSON.parse(JSON.stringify(v));
const map = plain(L.manilaMap(TOWN));
const grid = L.manilaGrid(map);
const objs = map.layers.find((l) => l.type === 'objectgroup').objects;
const tile = (p) => [Math.floor(p[0]), Math.floor(p[1])];
const reach = (a, b) => (a[0] === b[0] && a[1] === b[1]) || !!L.manilaPath(grid, a[0], a[1], b[0], b[1], 9000);
const START = tile(M.spawns.from_train);
// (owner, 11 Nov 2026: the city is turned round, the bay on the right, the way in on the left: 00-...-manila-flip.js. The
// places below are named as in the layout and turned the same way: a tile x -> 89 - x, a box's x -> 90 - x - w.)
const X = (x) => 89 - x;
const BX = (x, w) => 90 - x - w;

test('the map: 90 x 90, the town\'s own tile and season sheets (same numbers) and Manila\'s ground sheet; the same on every phone', () => {
  assert.strictEqual(map.width, 90);
  assert.strictEqual(map.height, 90);
  assert.deepStrictEqual(map.layers.map((l) => l.name), ['Ground', 'Walls', 'Above', 'Objects']);
  map.layers.filter((l) => l.type === 'tilelayer').forEach((l) => assert.strictEqual(l.data.length, 8100, l.name));
  const names = map.tilesets.map((t) => t.name);
  assert.deepStrictEqual(names, ['tiles', 'seasons', 'manila_ground']);
  ['tiles', 'seasons'].forEach((n) => assert.strictEqual(map.tilesets.find((t) => t.name === n).firstgid, TOWN.tilesets.find((t) => t.name === n).firstgid, n));
  const own = map.tilesets.find((t) => t.name === 'manila_ground');
  assert.strictEqual(own.tilecount, 30); // (5 x 6: the city's ground, the road's lanes and the plaza drawn over 3 x 3 tiles)
  assert.ok(own.imagewidth <= 4096 && own.imageheight <= 4096, 'no sheet over 4096 px');
  assert.strictEqual((own.imagewidth - 2 * own.margin + own.spacing) % (own.tilewidth + own.spacing), 0, 'a whole number of tiles across');
  assert.ok(!map.tilesets.some((t) => t.name === 'props'), 'its buildings are drawn by the game, not Tiled props');
  assert.strictEqual(JSON.stringify(L.manilaMap(TOWN)), JSON.stringify(map), 'built the same every time');
  // (the town's map is not changed by it)
  assert.strictEqual(JSON.stringify(TOWN), TOWN_TEXT);
});

test('the layout: no two buildings or props on the same tile; all inside the map; the bay is water you cannot walk in', () => {
  const seen = new Map();
  const boxes = M.buildings.map((b) => [b.key, b.box]).concat(M.props.map((p, i) => ['prop' + i + ':' + p[0], [p[1], p[2], p[3], p[4]]]))
    .concat(M.baywalk.lamps.map((y) => ['lamp' + y, [M.baywalk.lampX, y, 1, 2]]), M.baywalk.benches.map((y) => ['bench' + y, [M.baywalk.benchX, y, 2, 1]]));
  boxes.forEach(([k, b]) => {
    assert.ok(b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= 90 && b[1] + b[3] <= 90, k + ' inside the map');
    for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) {
      const i = y * 90 + x;
      assert.ok(!seen.has(i), `${k} and ${seen.get(i)} both on ${x},${y}`);
      seen.set(i, k);
    }
  });
  for (let y = 0; y < 90; y++) for (let x0 = 0; x0 < 12; x0++) {
    if (y >= 50 && y <= 62 && x0 >= 2) continue; // (the breakwater and the pier)
    if (y >= 69 && y <= 82 && x0 >= 3) continue; // (the Ferris wheel's pier)
    const x = X(x0); // (the bay on the right: the east edge)
    assert.ok(!grid.ok(x, y), `the bay at ${x},${y}`);
  }
  // the proposals' places (a few, by their boxes)
  const box = (k) => M.buildings.find((b) => b.key === k).box;
  assert.deepStrictEqual(plain(box('market').slice(0, 2)), [BX(62, 11), 35]);
  assert.deepStrictEqual(plain(box('fountain')), [BX(47, 5), 43, 5, 5]);
  assert.deepStrictEqual(plain(box('church').slice(0, 2)), [BX(22, 9), 7]);
  assert.deepStrictEqual(plain(box('station').slice(0, 2)), [BX(56, 9), 2]);
  assert.ok(box('station')[0] < 45 && box('mall')[0] > 45 && box('harbor')[0] > 45, 'the station on the left; the Mall and the port on the right, by the bay');
});

test('on foot from the train: every door, every person\'s spot, the plaza, the three gates, the pier and the berths', () => {
  Object.keys(M.spots).forEach((k) => assert.ok(reach(START, tile(M.spots[k])), 'spot ' + k));
  assert.ok(reach(START, tile(M.spawns.from_valley)), 'the Plains Gate (the valley road)');
  assert.ok(reach(START, [X(49), 50]), 'the plaza');
  assert.ok(reach(START, [X(46), 3]), 'up to (in front of) the Gorge Gate');
  assert.ok(reach(START, [X(29), 87]), 'down to the Jungle Gate');
  M.berths.forEach((b) => assert.ok(reach(START, [b[0], b[1] + 1]), 'by berth ' + b));
  assert.ok(reach(START, [X(16), 15]) && reach(START, [X(28), 29]), 'both gates of the walled quarter');
  assert.ok(reach(START, [X(26), 18]), 'the church square');
  // every person's spot is free (nobody stands in a wall)
  Object.keys(M.spots).forEach((k) => { const t = tile(M.spots[k]); assert.ok(grid.ok(t[0], t[1]), k + ' is free'); });
});

test('the gates: the Plains Gate walks home to the town (from_manila); the Gorge gate and the Jungle gate say when they open (110 and 70 hunts); both shut', () => {
  const warp = objs.find((o) => o.name === 'plains_gate');
  assert.strictEqual(warp.type, 'warp');
  const pr = Object.fromEntries(warp.properties.map((p) => [p.name, p.value]));
  assert.deepStrictEqual(pr, { to: 'town', spawn: 'from_manila', walk: true });
  assert.strictEqual(warp.x / 256, 0, 'on the left edge');
  ['gorge', 'jungle'].forEach((g) => {
    const o = objs.find((x) => x.name === 'mn_gate_' + g);
    assert.strictEqual(o.type, 'mn_gate');
    assert.match(o.properties[0].value, g === 'gorge' ? /opens at 110 hunts/ : /opens at 70 hunts/); // (the Bamboo Jungle and the Rocky Gorge are built: their gates say when)
    const x = o.x / 256, y = g === 'gorge' ? 1 : 88;
    for (let k = 0; k < 4; k++) assert.ok(!grid.ok(x + k, y), g + ': shut at ' + (x + k) + ',' + y);
  });
  // the town's east end: tiles 52-53 on the main street are walkable, so the valley road can start there (the world adds it)
  const tl = TOWN.tilesets.find((t) => t.name === 'tiles'), solid = new Set();
  tl.tiles.forEach((t) => (t.properties || []).forEach((p) => { if (p.name === 'collides' && p.value) solid.add(tl.firstgid + t.id); }));
  [11, 12].forEach((y) => [52, 53].forEach((x) => TOWN.layers.filter((l) => l.type === 'tilelayer').forEach((l) => assert.ok(!solid.has(l.data[y * TOWN.width + x]), 'town ' + x + ',' + y))));
  assert.ok(!TOWN.layers.find((l) => l.type === 'objectgroup').objects.some((o) => o.name === 'road_east'), 'not in the town file: the game adds it');
});

test('the train: the first ride is free, then 250G one way; not enough Gold, no ride and nothing taken', () => {
  const s = fresh();
  s.gold = 300;
  assert.strictEqual(L.manilaFare(s), 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.manilaRide(s))), { ok: true, fare: 0 });
  assert.strictEqual(s.gold, 300);
  assert.strictEqual(L.manilaFare(s), 250);
  assert.strictEqual(L.manilaRide(s).fare, 250);
  assert.strictEqual(s.gold, 50);
  const r = L.manilaRide(s);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.why, 'gold');
  assert.strictEqual(s.gold, 50);
  assert.strictEqual(s.mn.r, 2);
});

test('the valley road: walked for now; the horse rule is one hook (horseRoad + L.horseRoadOk)', () => {
  const s = fresh();
  assert.strictEqual(L.manilaRoad(s, false).ok, true);
  M.horseRoad = true;
  try {
    assert.strictEqual(L.manilaRoad(s, false).ok, true, 'no rule written yet: still open');
    L.horseRoadOk = (st, riding) => (riding ? { ok: true } : { ok: false, why: 'Ride your horse.' });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(L.manilaRoad(s, false))), { ok: false, why: 'Ride your horse.' });
    assert.strictEqual(L.manilaRoad(s, true).ok, true);
  } finally { M.horseRoad = false; delete L.horseRoadOk; }
});

test('the people: 7, each at a spot on the map by the hour; the first words say who they are, then their lines in turn', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(M.people.order)), ['rosa', 'danny', 'lando', 'kardo', 'marisol', 'tibo', 'amparo']);
  M.people.order.forEach((k) => {
    for (let m = 0; m < 1440; m += 30) assert.ok(M.spots[L.manilaSpot(k, m)], k + ' at ' + m + ': ' + L.manilaSpot(k, m));
    const p = M.people[k];
    assert.ok(p.name && p.role && p.met && p.lines.length >= 2, k);
    [p.met].concat(p.lines).forEach((t) => assert.ok(t.length <= 140 && !/[^\x20-\x7e]/.test(t), k + ': short and plain: ' + t));
  });
  assert.strictEqual(L.manilaSpot('rosa', 10 * 60), 'door_market');
  assert.strictEqual(L.manilaSpot('rosa', 12 * 60 + 30), 'plaza_s');
  assert.strictEqual(L.manilaSpot('rosa', 3 * 60), 'barrio1', 'before her day starts: where the night left her');
  assert.strictEqual(L.manilaSpot('kardo', 17 * 60), 'grandstand');
  const s = fresh();
  assert.strictEqual(L.manilaMet(s, 'rosa'), false);
  const a = L.manilaTalk(s, 'rosa', 0);
  assert.strictEqual(a.first, true);
  assert.match(a.text, /Aling Rosa/);
  assert.strictEqual(L.manilaMet(s, 'rosa'), true);
  assert.strictEqual(L.manilaTalk(s, 'rosa', 1).text, M.people.rosa.lines[1]);
  assert.strictEqual(L.manilaTalk(s, 'rosa', 3).text, M.people.rosa.lines[0]);
  assert.strictEqual(L.manilaTalk(s, 'nobody', 0), null);
});

test('the save: in Manila it is saved as the town with the city spot (an older game opens in town); rides and who you met come back', () => {
  const s = fresh();
  L.manilaRide(s);
  L.manilaTalk(s, 'tibo', 0);
  L.manilaTalk(s, 'amparo', 0);
  s.map = 'manila';
  s.player = { x: 49 * 256 + 128, y: 50 * 256 + 128, dir: 'left' };
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  const townIndex = JSON.parse(JSON.stringify(L.serialize(Object.assign(fresh(), { map: 'town' })))).m;
  assert.strictEqual(o.m, townIndex, 'saved as the town');
  assert.strictEqual(o.p, undefined, 'no town spot: an older game uses the town\'s usual way in');
  assert.deepStrictEqual(o.mp, [49 * 256 + 128, 50 * 256 + 128, 2]);
  assert.deepStrictEqual(o.mn, [1, (1 << 5) | (1 << 6)]);
  assert.ok(JSON.stringify(o).length < 16384);
  const b = L.deserialize(o);
  assert.strictEqual(b.map, 'manila');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b.player)), { x: 49 * 256 + 128, y: 50 * 256 + 128, dir: 'left' });
  assert.strictEqual(b.mn.r, 1);
  assert.ok(L.manilaMet(b, 'tibo') && L.manilaMet(b, 'amparo') && !L.manilaMet(b, 'rosa'));
  // somewhere else: no Manila keys at all for a farmer who never went
  const plainSave = JSON.parse(JSON.stringify(L.serialize(fresh())));
  assert.strictEqual(plainSave.mn, undefined);
  assert.strictEqual(plainSave.mp, undefined);
  // an older save (no mn, no mp): nothing lost, Manila not met
  const old = roundTrip(fresh());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(old.mn)), { r: 0, met: 0 });
  assert.strictEqual(old.map, 'farm');
  // Manila shut (C.MANILA.on false): off the train in town
  M.on = false;
  try {
    const c = L.deserialize(o);
    assert.strictEqual(c.map, 'town');
    assert.strictEqual(c.player.spawn, 'platform_w');
  } finally { M.on = true; }
});

test('the goal arrow finds its way out of Manila (the Plains Gate) and into it (the valley road)', () => {
  assert.strictEqual(C.ROUTES.manila.farm, 'plains_gate');
  assert.strictEqual(C.ROUTES.manila.town, 'plains_gate');
  assert.strictEqual(C.ROUTES.town.manila, 'road_east');
  assert.strictEqual(C.ROUTES.farm.manila, C.ROUTES.farm.town);
});

test('the decorations: none on a building, inside the map; the scattered ones only on grass with grass all round', () => {
  const boxes = M.buildings.map((b) => b.box);
  const hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  const decor = objs.filter((o) => o.type === 'mn_prop' && /^(d|s)\d/.test(o.name)).map((o) => [o.name, [o.x / 256, o.y / 256, o.width / 256, o.height / 256]]);
  assert.ok(decor.length >= M.decor.length + 8, 'the decorations and the scattered ones: ' + decor.length);
  decor.forEach(([k, d]) => {
    assert.ok(d[0] >= 0 && d[1] >= 0 && d[0] + d[2] <= 90 && d[1] + d[3] <= 90, k + ' inside');
    boxes.forEach((b) => assert.ok(!hit(d, b), k + ' is not on a building'));
  });
});

test('the crowd: about 55 by day with the roles, about a third at night, fewer on a cheap phone; every place they go is free and reachable without going behind a building or along the road', () => {
  const CR = M.crowd, roles = Object.keys(M.roles).reduce((a, k) => a + M.roles[k].n, 0);
  assert.ok(CR.day + M.people.order.length + roles >= 50, 'at least 50 by day: ' + (CR.day + 7 + roles));
  assert.ok((CR.night + 7 + 2) <= Math.ceil((CR.day + 7 + roles) / 3), 'a third at night (the two guards stay)');
  // (owner, 18 Nov 2026: the same game on every phone: a cheap phone has fewer passers-by, drawn only near the screen;
  // every role, the city's own people at their places, is the same)
  assert.ok(CR.cheap < CR.day && CR.cheapNight <= CR.night, 'fewer passers-by on a cheap phone');
  assert.ok(CR.lines.length >= 20 && CR.lines.every((t) => t.length <= 80 && !/[^\x20-\x7e]/.test(t)), 'short plain lines');
  assert.ok(!CR.looks.some((l) => l[0] === 'people'), 'never Willowbrook\'s villagers');
  const strict = L.manilaGrid(map, true);
  const reachS = (a, b) => (a[0] === b[0] && a[1] === b[1]) || !!L.manilaPath(strict, a[0], a[1], b[0], b[1], 9000);
  Object.keys(CR.zones).forEach((z) => CR.zones[z].at.forEach((q) => {
    assert.ok(strict.ok(q[0], q[1]), `${z} ${q} is free`);
    assert.ok(reachS(START, [q[0], q[1]]), `${z} ${q} is reachable`);
  }));
  Object.keys(M.spots).forEach((k) => assert.ok(reachS(START, tile(M.spots[k])), 'spot ' + k + ' on the strict grid'));
  // the strict grid: no tile of any building's box
  // (but a gate's way through: its opening, M.pass)
  const open = (b, x) => { const p = L.manilaPass(b.art); return !!p && x - b.box[0] >= p[0] && x - b.box[0] <= p[1]; };
  M.buildings.filter((b) => !b.flat).forEach((b) => { for (let y = b.box[1]; y < b.box[1] + b.box[3]; y++) for (let x = b.box[0]; x < b.box[0] + b.box[2]; x++) assert.ok(open(b, x) || !strict.ok(x, y), b.key + ' ' + x + ',' + y); });
});

// ---------- city life: the jeepney (src/01-logicZZZZZZZZZZZZZZZ-manila-life.js) ----------
test('the jeep\'s loop: on its own road all the way, its 6 stops in order, a loop\'s time; where it is depends on the clock alone', () => {
  const J = M.jeep, r = L.jeepRoute();
  assert.strictEqual(r.len, 276);
  assert.deepStrictEqual(plain(r.stops.map((s) => J.stops[s.i].key)), ['station', 'talipapa', 'college', 'mall', 'baywalk', 'plaza']);
  assert.strictEqual(r.loopMs, r.len * 1000 / J.speed + 6 * J.stopMs);
  const own = map.tilesets.find((t) => t.name === 'manila_ground'), roadIds = Object.keys(M.GROUND.ROAD).concat(['cross_h', 'cross_v']).map((k) => own.firstgid + M.GROUND.T[k]);
  const g = map.layers[0].data, road = (x, y) => roadIds.includes(g[y * 90 + x]);
  const DAY = Date.UTC(2026, 3, 1, 4, 0); // (noon in Manila)
  let last = L.jeepAt(DAY);
  for (let t = 0; t < r.loopMs; t += 250) {
    const a = L.jeepAt(DAY + t);
    assert.ok(a.on, 'by day it always runs');
    // on a centre line, with road on both sides of it
    const hx = Number.isInteger(a.y), vx = Number.isInteger(a.x);
    assert.ok(hx || vx, 'on a centre line at ' + t);
    const tx = Math.floor(a.x - (vx ? 0.5 : 0)), ty = Math.floor(a.y - (hx ? 0.5 : 0));
    assert.ok(road(tx, ty) && (hx ? road(tx, ty + 1) : road(tx + 1, ty)), 'on the road at ' + a.x + ',' + a.y);
    assert.ok(Math.abs(a.x - last.x) + Math.abs(a.y - last.y) <= J.speed * 0.25 + 1e-6 || a.loop !== last.loop, 'it never jumps');
    last = a;
  }
  // each stop: it waits there stopMs, at the stop's own point
  J.stops.forEach((st, i) => {
    const w = L.jeepWait(DAY, i);
    assert.ok(w >= 0 && w <= r.loopMs, st.key + ' within a loop');
    const a = L.jeepAt(DAY + w + 100);
    assert.strictEqual(a.stop, i);
    assert.deepStrictEqual([a.x, a.y], plain(st.at));
    assert.strictEqual(L.jeepAt(DAY + w + J.stopMs + 600).stop, -1, 'and goes on');
  });
  assert.deepStrictEqual(plain(L.jeepAt(DAY + 12345)), plain(L.jeepAt(DAY + 12345)), 'the same for every phone');
  const a1 = plain(L.jeepAt(DAY + 12345)), a2 = plain(L.jeepAt(DAY + 12345 + r.loopMs * 2));
  assert.deepStrictEqual([a1.x, a1.y, a1.stop], [a2.x, a2.y, a2.stop], 'the same place every loop');
});

test('the jeep at night: every other loop, its lights on from 6 PM; the waiting sheds are on the sidewalk beside its stops', () => {
  const r = L.jeepRoute(), NIGHT = Date.UTC(2026, 3, 1, 15, 0); // (11 PM in Manila)
  const loops = [0, 1, 2, 3].map((k) => { const ms = NIGHT + k * r.loopMs; return L.jeepAt(ms - (ms % r.loopMs) + 1000); });
  assert.ok(loops.some((a) => a.on) && loops.some((a) => !a.on), 'some loops off');
  loops.forEach((a, k) => { if (k) assert.notStrictEqual(a.on, loops[k - 1].on, 'every other loop'); });
  assert.ok(loops.every((a) => a.lights));
  assert.strictEqual(L.jeepAt(Date.UTC(2026, 3, 1, 4, 0)).lights, false, 'no lights at noon');
  const strict = L.manilaGrid(map, true);
  M.jeep.stops.forEach((st) => {
    const w = [Math.floor(st.wait[0]), Math.floor(st.wait[1])];
    assert.ok(strict.ok(w[0], w[1]), st.key + ': you wait on free ground');
    assert.ok(Math.hypot(st.wait[0] - st.at[0], st.wait[1] - st.at[1]) < 3, st.key + ': beside the stop');
    assert.ok(reach(START, w), st.key + ' reachable');
  });
});

test('the Mall inside: its own small map (the house\'s sheet), shops and a food court, the way out by the door; saved as Manila at the Mall\'s door', () => {
  const house = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'house_1.json'), 'utf8'));
  const mm = plain(L.mallMap(house)), mo = mm.layers.find((l) => l.type === 'objectgroup').objects;
  assert.strictEqual(mm.width, M.mall.W);
  assert.ok(mo.some((o) => o.type === 'warp' && o.properties.some((p) => p.name === 'to' && p.value === 'manila')));
  assert.ok(mo.some((o) => o.name === 'entrance' && o.point));
  assert.strictEqual(mo.filter((o) => o.type === 'mn_prop' && o.properties.some((p) => p.name === 'box')).length, M.mall.shops.length);
  M.mall.food.forEach((f) => assert.ok(L.energyOf(f[0]) > 0 && f[1] > 0, f[0] + ' gives energy'));
  const s = fresh();
  s.map = 'mall';
  s.player = { x: 14 * 256, y: 10 * 256, dir: 'up' };
  const o = JSON.parse(JSON.stringify(L.serialize(s)));
  const b = L.deserialize(o);
  assert.strictEqual(b.map, 'manila');
  assert.deepStrictEqual([Math.round(b.player.x / 256 * 10) / 10, Math.round(b.player.y / 256 * 10) / 10], plain(M.mall.out));
});

test('city life\'s pictures: every file MANILA-CITY-LIFE-PROMPTS.md asks for is known to the importer (used now, or kept for a later step)', (t) => {
  const file = path.join(__dirname, '..', 'art-src', 'MANILA-CITY-LIFE-PROMPTS.md');
  if (!fs.existsSync(file)) return t.skip('no art-src/MANILA-CITY-LIFE-PROMPTS.md here');
  const names = [...new Set([...fs.readFileSync(file, 'utf8').matchAll(/manila\/city\/([a-z0-9_]+)\.png/g)].map((m) => m[1]))];
  assert.ok(names.length >= 74, 'the prompts\' files: ' + names.length);
  const known = new Set(Object.keys(M.life.files).concat(M.life.later));
  assert.deepStrictEqual(names.filter((n) => !known.has(n)), [], 'files the importer does not know');
  assert.deepStrictEqual([...known].filter((n) => !names.includes(n)), [], 'names the importer expects that the prompts do not make');
  assert.ok(!Object.keys(M.life.files).some((n) => M.life.later.includes(n)), 'none both used and later');
  // what the game uses them as: each piece of a sheet once, and the buildings', roles' and sheds' art all come from these files
  const { lifeKeys } = require('../tools/manila/manila-art');
  const made = new Set(Object.keys(M.life.files).flatMap((n) => lifeKeys(n, M.life.files[n])));
  const want = M.buildings.filter((b) => b.art && /^(office_tower|mall|ferris|college|chinatown|pickleball|shed_|shophouse_|dimsum|chestnut)/.test(b.art)).map((b) => 'props/manila_' + b.art);
  want.forEach((k) => assert.ok(made.has(k), k + ' comes from a city-life file'));
  Object.keys(M.roles).concat(Object.keys(M.mall.roles)).forEach((r) => ((M.roles[r] || M.mall.roles[r]).sheets || []).forEach((sh) => assert.ok(made.has(sh), r + ': ' + sh)));
  M.mall.shops.forEach((sh) => assert.ok(made.has('props/manila_' + sh.art), sh.key + ': ' + sh.art));
  M.mall.props.forEach((p) => assert.ok(made.has('props/manila_mall_' + p[0]), 'mall ' + p[0]));
});

test('gates: nobody stands inside a gate\'s picture; a gate walked through is solid but its opening, and its opening goes through', () => {
  const gates = M.decor.map((d) => ({ art: d[0], box: [d[1], d[2], d[3], d[4]] })).concat(M.buildings).filter((b) => /gate|arch/.test(b.art || ''));
  assert.ok(gates.length >= 6, gates.map((g) => g.art).join());
  gates.forEach((g) => {
    const p = L.manilaPass(g.art), [x0, y0, w, h] = g.box;
    for (let y = Math.max(0, y0); y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const inOpening = p && x - x0 >= p[0] && x - x0 <= p[1];
      if (!inOpening) assert.ok(!grid.ok(x, y), g.art + ' ' + x + ',' + y + ' is solid');
      else assert.ok(grid.ok(x, y), g.art + ' ' + x + ',' + y + ' (its opening) is free');
    }
    if (p) assert.ok(reach([x0 + p[0], y0 - 1], [x0 + p[0], y0 + h]), g.art + ': through it, north to south');
  });
  assert.deepStrictEqual(plain(Object.keys(M.pass).sort()), ['chinatown_arch', 'race_arch', 'wall_gate']);
});

test('the valley road comes in on Manila\'s left side (owner: the way in on the left), by the Plains Gate, facing in: free ground, off the jeep\'s road', () => {
  const p = M.spawns.from_valley, t = tile(p), strict = L.manilaGrid(map, true);
  assert.ok(t[0] <= 14, 'the left side: ' + t);
  assert.strictEqual(p[2], 'right');
  assert.ok(strict.ok(t[0], t[1]) && grid.ok(t[0], t[1]), 'free ground (not the road, not a building)');
  // (owner's bug, 11 Nov 2026: she stood inside the gate's picture.) The gate stands beside the avenue's end, solid all
  // over; the arrival and the way out to the valley road are clear of its picture (her sprite is 1.5 tiles tall)
  const gate = M.decor.find((d) => d[0] === 'gate_plains');
  assert.strictEqual(gate[5], gate[4], 'the gate is solid all over');
  for (let y = gate[2]; y < gate[2] + gate[4]; y++) for (let x = gate[1]; x < gate[1] + gate[3]; x++) assert.ok(!grid.ok(x, y), 'gate ' + x + ',' + y);
  assert.ok(t[1] + 1 < gate[2] || t[0] > gate[1] + gate[3], 'she arrives clear of it');
  assert.ok(t[0] - (gate[1] + gate[3] - 1) <= 3 && gate[2] - t[1] <= 4, 'and right by it');
  const out = L.manilaPath(grid, t[0], t[1], X(88), 44, 9000);
  assert.ok(out, 'out to the valley road');
  out.forEach((q) => assert.ok(!(q[0] >= gate[1] && q[0] < gate[1] + gate[3] && q[1] + 1 >= gate[2]), 'the way out passes in front of nothing of the gate: ' + q));
});

// ---------- city life, steps 2 and 4 (src/00-zzzzzzzzzzzzzzzzzzzzzz-manila-life2.js, src/01-logicZZZZZZZZZZZZZZZ-manila-life2.js) ----------
const H = 60;
const STEP24 = ['meat_vendor', 'fish_vendor', 'veg_vendor', 'tp_shopper', 'fishball', 'taho', 'sorbetes', 'college_guard', 'students', 'ballers', 'hopia_baker', 'balut',
  'sampaguita', 'carinderia_cook', 'tanod', 'tricycle_driver', 'enforcer', 'joggers', 'families', 'couple', 'fishermen', 'jeep_driver', 'calesa_driver'];
test('steps 2 and 4: "Coming soon" is gone where the thing works now; the street-food carts and the calesa are no longer still scenery', () => {
  const b = (k) => M.buildings.find((x) => x.key === k);
  ['tp_meat', 'tp_fish', 'tp_veg', 'college_gate', 'college', 'court', 'barangay_hall', 'carinderia', 'hopia', 'tricycle', 'chinatown', 'dimsum_cart', 'castanas_cart'].forEach((k) => {
    assert.ok(b(k), k + ' is still there');
    assert.ok(!/coming soon|soon!/i.test(b(k).text), k + ': ' + b(k).text);
  });
  ['cart_fishball', 'cart_taho', 'cart_sorbetes', 'calesa'].forEach((k) => assert.strictEqual(b(k), undefined, k + ' moves now (drawn with its vendor or driving)'));
  // (and honest about what is not built: the sari-sari store, the fruit stall, the Ferris wheel's rides)
  ['sari_sari', 'ch_fruit', 'ferris'].forEach((k) => assert.match(b(k).text, /soon/i, k));
  // nothing about the people in the old "Chinatown is coming soon"
  assert.ok(!M.roles.dimsum.lines.some((l) => /soon/i.test(l)));
});

test('steps 2 and 4: every new person wears their own sheet (a city-life file); their posts and stops are free, reachable, and off the road and the calesa\'s lanes', () => {
  STEP24.forEach((k) => assert.ok(M.roles[k], k));
  assert.deepStrictEqual(plain(M.life.later), [], 'every person the prompts make is in now');
  const { lifeKeys } = require('../tools/manila/manila-art');
  const made = new Set(Object.keys(M.life.files).flatMap((n) => lifeKeys(n, M.life.files[n])));
  STEP24.forEach((k) => { const r = M.roles[k]; if (r.crowdLooks) return; r.sheets.forEach((sh) => assert.ok(made.has(sh), k + ': ' + sh)); });
  assert.ok(M.roles.families.crowdLooks, 'families: the city folk\'s own looks (no family sheet was asked for)');
  const strict = L.manilaGrid(map, true);
  const reachS = (a, b) => (a[0] === b[0] && a[1] === b[1]) || !!L.manilaPath(strict, a[0], a[1], b[0], b[1], 9000);
  const at = (name, p) => {
    const t = tile(p);
    assert.ok(strict.ok(t[0], t[1]), name + ' free: ' + t);
    assert.ok(reachS(START, t), name + ' reachable: ' + t);
    assert.ok(!L.onCalesaLane(t[0], t[1]), name + ' not on the calesa\'s lanes');
  };
  STEP24.forEach((k) => {
    const r = M.roles[k];
    if (r.post) at(k, r.post);
    (r.posts || []).forEach((p, i) => at(k + i, p));
    if (r.walk) { Object.keys(r.walk.stops).forEach((s) => at(k + '.' + s, r.walk.stops[s])); if (r.walk.home) at(k + '.home', r.walk.home); }
  });
  // the court players on the court, its watchers in front of it facing it, in the evening
  const c = M.roles.ballers.court, court = M.buildings.find((b) => b.key === 'court').box;
  assert.deepStrictEqual(plain(c), plain(court));
  assert.deepStrictEqual(plain(M.crowd.zones.court.w), [0, 0, 4, 0]);
  M.crowd.zones.court.at.forEach((q) => assert.ok(q[1] >= court[1] + court[3] - 1 || q[0] >= court[0] + court[2], 'a watcher outside the court: ' + q));
  // the Talipapa's vendors stand at their own stalls, facing their customers
  [['meat_vendor', 'tp_meat'], ['fish_vendor', 'tp_fish'], ['veg_vendor', 'tp_veg']].forEach(([r, b]) => {
    const p = M.roles[r].post, bx = M.buildings.find((x) => x.key === b).box;
    assert.ok(p[1] >= bx[1] && p[1] < bx[1] + bx[3] + 1 && Math.abs(p[0] - (bx[0] + bx[2])) <= 1, r + ' by its stall');
  });
});

test('steps 2 and 4: who is out by the hour (the Talipapa early, taho in the morning, the court and families in the evening, balut at night); the students always together, at school by day', () => {
  const out = (k, h, m = 0) => L.mnRoleOut(M.roles[k], h * H + m);
  assert.ok(out('meat_vendor', 5, 30) && out('fish_vendor', 9) && !out('veg_vendor', 18), 'the Talipapa from five');
  assert.ok(out('tp_shopper', 8) && !out('tp_shopper', 14));
  assert.ok(out('taho', 6, 30) && out('taho', 9) && !out('taho', 11), 'taho in the morning');
  assert.ok(out('sorbetes', 14) && !out('sorbetes', 20));
  assert.ok(out('ballers', 17) && !out('ballers', 12) && !out('ballers', 21), 'the court in the evening');
  assert.ok(out('families', 17) && !out('families', 10));
  assert.ok(out('joggers', 6) && !out('joggers', 12), 'joggers in the morning');
  assert.ok(out('couple', 18) && out('fishermen', 7) && out('fishermen', 16) && !out('fishermen', 12));
  assert.ok(out('balut', 21) && out('balut', 1) && !out('balut', 12), 'balut at night');
  assert.ok(out('tanod', 3) && out('tanod', 15), 'the tanod: always');
  const plan = M.roles.students.walk.plan, at = (h, m = 0) => L.mnPlanAt(plan, h * H + m);
  assert.strictEqual(at(3), 'in:shed', 'home at night');
  assert.strictEqual(at(7, 30), 'shed', 'off the jeep at the College\'s shed');
  assert.strictEqual(at(10), 'in:gate', 'in class');
  assert.strictEqual(at(12, 15), 'snack', 'fishballs at lunch');
  assert.strictEqual(at(16, 20), 'snack', 'and after class');
  assert.strictEqual(at(18, 10), 'shed', 'the jeep home');
  assert.strictEqual(M.roles.students.group, 3, 'the three always together');
  assert.strictEqual(M.roles.students.n, 3);
  // the fishball cart is at the College when the students come out to eat
  const fb = M.roles.fishball.walk;
  [[12, 15], [16, 20]].forEach(([h, m]) => assert.strictEqual(L.mnPlanAt(fb.plan, h * H + m), 'college', 'fishballs at the College at ' + h + ':' + m));
  assert.strictEqual(L.mnPlanAt(fb.plan, 8 * H), 'plaza');
  assert.strictEqual(L.mnPlanAt(fb.plan, 22 * H), 'in:plaza');
  const snack = M.roles.students.walk.stops.snack, cart = fb.stops.college;
  assert.ok(Math.abs(snack[0] - cart[0]) <= 1 && snack[1] - cart[1] === 2, 'the students eat at the cart');
  // calls and sales
  assert.strictEqual(M.roles.taho.call, 'Tahooo!');
  assert.strictEqual(M.roles.balut.call, 'Baluuut!');
  ['fishball', 'taho', 'sorbetes', 'dimsum', 'castanas', 'hopia_baker', 'balut', 'carinderia_cook'].forEach((k) => assert.ok(M.food[M.roles[k].sells], k + ' sells'));
});

test('street food: small prices (decided by me), Gold for energy eaten on the spot, never past full; not enough Gold or full: nothing taken; nothing new saved', () => {
  Object.keys(M.food).forEach((k) => {
    const f = M.food[k];
    assert.ok(f.price > 0 && f.price <= 35 && f.energy > 0, k + ': ' + f.price + 'G');
    assert.ok(f.price / f.energy >= 2 && f.price / f.energy <= 3, k + ': about the food court\'s Gold an energy');
    assert.ok(C.ITEMS[f.icon], k + ': its icon');
  });
  assert.strictEqual(M.food.fishball.price, 10);
  assert.ok(M.food.taho.price <= M.jeep.fare, 'taho no more than a jeep ride');
  const s = fresh();
  s.gold = 100;
  s.energy = 50;
  const before = Object.keys(JSON.parse(JSON.stringify(L.serialize(s)))).sort();
  const r = L.mnBuyFood(s, 'fishball');
  assert.deepStrictEqual(plain(r), { ok: true, gain: M.food.fishball.energy });
  assert.strictEqual(s.gold, 90);
  assert.strictEqual(s.energy, 50 + M.food.fishball.energy);
  assert.deepStrictEqual(Object.keys(JSON.parse(JSON.stringify(L.serialize(s)))).sort(), before, 'no new save key');
  s.energy = L.maxEnergy(s) - 2;
  assert.strictEqual(L.mnBuyFood(s, 'meal').gain, 2, 'never past full');
  const g = s.gold;
  assert.deepStrictEqual(plain(L.mnBuyFood(s, 'taho')), { ok: false, why: 'full' });
  assert.strictEqual(s.gold, g);
  s.energy = 10; s.gold = 5;
  assert.deepStrictEqual(plain(L.mnBuyFood(s, 'balut')), { ok: false, why: 'gold' });
  assert.strictEqual(s.gold, 5);
  assert.strictEqual(L.mnBuyFood(s, 'nothing').ok, false);
});

test('the calesa: its loop inside the old walls on free cobbles, its stand on the loop; it waits there, goes round, the same on every phone; a ride is twice round for 20G; it rests at night', () => {
  const K = M.calesa, r = L.calesaRoute(), strict = L.manilaGrid(map, true);
  assert.strictEqual(K.fare, 20);
  assert.strictEqual(K.laps, 2);
  L.calesaLaneTiles().forEach((t) => {
    assert.ok(strict.ok(t[0], t[1]), 'lane free: ' + t);
    assert.ok(t[0] >= X(38) && t[0] <= X(18) && t[1] >= 6 && t[1] <= 28, 'inside the old walls: ' + t);
  });
  const w = tile(K.stop.wait);
  assert.ok(strict.ok(w[0], w[1]) && reach(START, w), 'its stand on free ground you can walk to');
  assert.ok(Math.hypot(K.stop.wait[0] - K.stop.at[0], K.stop.wait[1] - K.stop.at[1]) < 2.5, 'beside where it stops');
  const DAY = Date.UTC(2026, 3, 1, 2, 0); // (10 AM in Manila)
  const start = DAY - (DAY % r.loopMs) + r.loopMs; // (a loop's start: at its stand)
  const a = L.calesaAt(start + 100);
  assert.ok(a.on && a.stop, 'waits at its stand');
  assert.deepStrictEqual([a.x, a.y], plain(K.stop.at));
  assert.strictEqual(L.calesaWait(start + 100), 0);
  let last = a;
  for (let t = K.stopMs + 50; t < r.loopMs; t += 250) {
    const b = L.calesaAt(start + t);
    assert.ok(!b.stop, 'goes round');
    assert.ok(Math.abs(b.x - last.x) + Math.abs(b.y - last.y) <= K.speed * 0.25 + 0.01 || last.stop, 'never jumps');
    assert.ok(L.calesaLaneTiles().some((q) => Math.abs(q[0] + 0.5 - b.x) <= 1 && Math.abs(q[1] + 0.5 - b.y) <= 1), 'on its lanes');
    last = b;
  }
  assert.ok(L.calesaWait(start + K.stopMs + 1000) > 0, 'next time round');
  assert.deepStrictEqual(plain(L.calesaAt(start + 7777)), plain(L.calesaAt(start + 7777)), 'the clock alone');
  // a ride: on in loop n at the stand, off at the stand two loops on
  const on = L.calesaAt(start + 100);
  assert.ok(!L.calesaRideDone(on.loop, L.calesaAt(start + r.loopMs + 100)), 'not after one time round');
  assert.ok(L.calesaRideDone(on.loop, L.calesaAt(start + 2 * r.loopMs + 100)), 'off after twice round');
  // at night it rests at its stand
  const night = L.calesaAt(Date.UTC(2026, 3, 1, 15, 0) + 30000);
  assert.ok(!night.on && night.stop && night.x === K.stop.at[0] && night.y === K.stop.at[1]);
  assert.strictEqual(L.calesaWait(Date.UTC(2026, 3, 1, 15, 0)), -1);
  // no city folk's place on its lanes
  Object.keys(M.crowd.zones).forEach((z) => M.crowd.zones[z].at.forEach((q) => assert.ok(!L.onCalesaLane(q[0], q[1]), z + ' ' + q)));
});

test('the elevated train: in from the west, waits along its platform, back out; off the map when away; the clock alone', () => {
  const Z = M.lrt, R = M.rail;
  const phases = new Set(), stops = [];
  for (let t = 0; t < Z.cycle; t += 500) { const a = L.lrtAt(t); phases.add(a.phase); if (a.phase === 'stop') stops.push(a.x); }
  assert.deepStrictEqual([...phases].sort(), ['away', 'in', 'out', 'stop']);
  assert.ok(stops.every((x) => x === Z.stopX));
  const len = 4 + 4 * R.cars + 4; // (a head at each end)
  assert.ok(Z.stopX <= R.platform && Z.stopX + len >= R.platform + 4, 'the whole platform alongside it');
  assert.ok(Z.stopX + len <= R.end, 'short of the buffer');
  assert.ok(Z.fromX + len <= 0, 'away: off the map');
  assert.strictEqual(L.lrtAt(Z.arrive / 2).moving, true);
  assert.ok(L.lrtAt(Z.arrive / 2).x > Z.fromX && L.lrtAt(Z.arrive / 2).x < Z.stopX);
});
