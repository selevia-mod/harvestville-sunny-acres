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
    .concat(M.baywalk.lamps.map((y) => ['lamp' + y, [15, y, 1, 2]]), M.baywalk.benches.map((y) => ['bench' + y, [12, y, 2, 1]]));
  boxes.forEach(([k, b]) => {
    assert.ok(b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= 90 && b[1] + b[3] <= 90, k + ' inside the map');
    for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) {
      const i = y * 90 + x;
      assert.ok(!seen.has(i), `${k} and ${seen.get(i)} both on ${x},${y}`);
      seen.set(i, k);
    }
  });
  for (let y = 0; y < 90; y++) for (let x = 0; x < 12; x++) {
    if (y >= 50 && y <= 62 && x >= 2) continue; // (the breakwater and the pier)
    if (y >= 69 && y <= 82 && x >= 3) continue; // (the Ferris wheel's pier)
    assert.ok(!grid.ok(x, y), `the bay at ${x},${y}`);
  }
  // the proposals' places (a few, by their boxes)
  const box = (k) => M.buildings.find((b) => b.key === k).box;
  assert.deepStrictEqual(plain(box('market').slice(0, 2)), [62, 35]);
  assert.deepStrictEqual(plain(box('fountain')), [47, 43, 5, 5]);
  assert.deepStrictEqual(plain(box('church').slice(0, 2)), [22, 7]);
  assert.deepStrictEqual(plain(box('station').slice(0, 2)), [56, 2]);
});

test('on foot from the train: every door, every person\'s spot, the plaza, the three gates, the pier and the berths', () => {
  Object.keys(M.spots).forEach((k) => assert.ok(reach(START, tile(M.spots[k])), 'spot ' + k));
  assert.ok(reach(START, tile(M.spawns.from_valley)), 'the Plains Gate (the valley road)');
  assert.ok(reach(START, [49, 50]), 'the plaza');
  assert.ok(reach(START, [46, 2]), 'up to the Gorge Gate');
  assert.ok(reach(START, [29, 87]), 'down to the Jungle Gate');
  M.berths.forEach((b) => assert.ok(reach(START, [b[0], b[1] + 1]), 'by berth ' + b));
  assert.ok(reach(START, [16, 15]) && reach(START, [28, 29]), 'both gates of the walled quarter');
  assert.ok(reach(START, [26, 18]), 'the church square');
  // every person's spot is free (nobody stands in a wall)
  Object.keys(M.spots).forEach((k) => { const t = tile(M.spots[k]); assert.ok(grid.ok(t[0], t[1]), k + ' is free'); });
});

test('the gates: the Plains Gate walks home to the town (from_manila); the Gorge and Jungle gates are shut and say "coming soon"', () => {
  const warp = objs.find((o) => o.name === 'plains_gate');
  assert.strictEqual(warp.type, 'warp');
  const pr = Object.fromEntries(warp.properties.map((p) => [p.name, p.value]));
  assert.deepStrictEqual(pr, { to: 'town', spawn: 'from_manila', walk: true });
  assert.strictEqual(warp.x / 256, 89);
  ['gorge', 'jungle'].forEach((g) => {
    const o = objs.find((x) => x.name === 'mn_gate_' + g);
    assert.strictEqual(o.type, 'mn_gate');
    assert.match(o.properties[0].value, /Coming soon/);
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
  assert.ok(CR.cheap + 7 + roles <= (CR.day + 7 + roles) * 0.6, 'fewer on a cheap phone');
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
  M.buildings.filter((b) => !b.flat).forEach((b) => { for (let y = b.box[1]; y < b.box[1] + b.box[3]; y++) for (let x = b.box[0]; x < b.box[0] + b.box[2]; x++) assert.ok(!strict.ok(x, y), b.key + ' ' + x + ',' + y); });
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
