'use strict';
// Seeds the Tiled (1.10) JSON maps in maps/: farm, house, town and mine. You can open and edit them in Tiled.
// After the first run the JSON files are the source of truth; this script won't overwrite an existing map
// unless you pass --force (or --force=<map> for one map).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SIZE, TILES, RANCH, SEASONS, INDOOR, PROPS, SEASON_NAMES, SEASONAL, HOME_STYLES, blockId } = require('./tiles');

// the house levels come from the game's own data
function gameConfig() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'src');
  fs.readdirSync(dir).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx));
  return ctx.window.Farm.Config;
}
const HOME = gameConfig().HOME;

function rng(seed) { // deterministic, so the seeded maps are reproducible
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  return next;
}

const prop = (name, type, value) => ({ name, type, value });
const T = TILES.T, R = RANCH.T, I = INDOOR.T;
const PROP_NAMES = Object.keys(PROPS);

// ---------- tile properties per tileset ----------
const tileProps = { tiles: {}, ranch: {}, seasons: {}, indoor: {}, props: {} };
const add = (set, id, ...props) => { tileProps[set][id] = (tileProps[set][id] || []).concat(props); };
const solid = prop('collides', 'bool', true);
[T.fenceH, T.fenceV, T.fencePost, T.treeBL, T.treeBR, T.bush, T.rock, T.shipbox, T.sign, T.stump].forEach((id) => add('tiles', id, solid));
add('tiles', T.water, solid, prop('water', 'bool', true));
add('tiles', T.field, prop('tillable', 'bool', true), prop('name', 'string', 'field'));
add('tiles', T.tilled, prop('name', 'string', 'tilled'));
add('tiles', T.tilledWet, prop('name', 'string', 'tilled_wet'));
// debris tiles on the farm's Debris layer: the game looks them up by name
[['d_weed', 'weed'], ['d_branch', 'branch'], ['d_stone', 'stone'], ['d_stump', 'stump'], ['d_boulder', 'boulder']].forEach(([tile, kind]) => {
  add('tiles', T[tile], prop('name', 'string', 'debris_' + kind));
  if (kind !== 'weed') add('tiles', T[tile], solid);
});
[[TILES, 'tiles'], [RANCH, 'ranch']].forEach(([set, key]) => {
  Object.keys(set.BLOCKS).forEach((name) => {
    const b = set.BLOCKS[name];
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      add(key, blockId(set, name, dx, dy), solid);
      if (name === 'pond') add(key, blockId(set, name, dx, dy), prop('water', 'bool', true));
    }
  });
});
add('ranch', R.hay, solid);
add('ranch', R.trough, solid);
SEASON_NAMES.forEach((season) => {
  SEASONAL.forEach((kind) => {
    (tileProps.tiles[T[kind]] || []).filter((p) => p.name !== 'name').forEach((p) => add('seasons', SEASONS.T[season + '_' + kind], p));
  });
});
SEASONAL.forEach((kind, k) => add('tiles', T[kind], prop('seasonal', 'int', k)));
['wall', 'wall_low', 'wall_side', 'void', 'cave_wall', 'cave_top', 'ladder_up', 'mine_rock'].forEach((k) => add('indoor', I[k], solid));
// the home's floors and walls are swapped by name for the chosen style
['floor', 'floor2', 'wall', 'wall_low'].forEach((k) => add('indoor', I[k], prop('name', 'string', k)));
for (let k = 1; k < HOME_STYLES; k++) {
  add('indoor', I['floor_' + k], prop('name', 'string', 'floor_' + k));
  ['wall_', 'wall_low_'].forEach((w) => add('indoor', I[w + k], solid, prop('name', 'string', w + k)));
}
add('indoor', I.ladder_down, prop('name', 'string', 'ladder_down'));
add('indoor', I.mine_rock, prop('name', 'string', 'mine_rock'));
PROP_NAMES.forEach((name, id) => {
  const p = PROPS[name];
  add('props', id, prop('prop', 'string', name), prop('foot', 'int', p.foot));
  if (p.flat) add('props', id, prop('flat', 'bool', true));
});

function tilesetJSON(set, firstgid) {
  return {
    firstgid, name: set.NAME, image: '../assets/' + set.NAME + '.png',
    imagewidth: set.IMAGE_W, imageheight: set.IMAGE_H, tilewidth: SIZE, tileheight: SIZE,
    columns: set.COLS, tilecount: set.TILECOUNT, margin: set.MARGIN, spacing: set.SPACING,
    tiles: Object.keys(tileProps[set.NAME]).map(Number).sort((a, b) => a - b).map((id) => ({ id, properties: tileProps[set.NAME][id] })),
  };
}

// An image-collection tileset: one half-resolution image per prop, placed as tile objects.
function propsJSON(firstgid) {
  return {
    firstgid, name: 'props', columns: 0, margin: 0, spacing: 0, tilecount: PROP_NAMES.length,
    tilewidth: 6 * 128, tileheight: 5 * 128, grid: { orientation: 'orthogonal', width: 1, height: 1 },
    tiles: PROP_NAMES.map((name, id) => ({
      id, image: '../assets/props/' + name + '.png', imagewidth: PROPS[name].w * 128, imageheight: PROPS[name].h * 128,
      properties: tileProps.props[id],
    })),
  };
}

const SETS = { tiles: TILES, ranch: RANCH, seasons: SEASONS, indoor: INDOOR };

class MapBuilder {
  constructor(name, W, H, sets, layers) {
    this.name = name;
    this.W = W;
    this.H = H;
    this.first = {};
    let gid = 1;
    sets.forEach((s) => {
      this.first[s] = gid;
      gid += s === 'props' ? PROP_NAMES.length : SETS[s].TILECOUNT;
    });
    this.sets = sets;
    this.layers = {};
    this.layerProps = {};
    layers.forEach((l) => { this.layers[l] = new Array(W * H).fill(0); });
    this.objects = [];
    this.nextId = 1;
    this.covered = new Set(); // tiles under props, kept free of random decoration
  }

  put(layer, x, y, set, id) {
    if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.layers[layer][y * this.W + x] = set ? id + this.first[set] : 0;
  }

  rect(layer, x0, y0, x1, y1, set, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(layer, x, y, set, typeof id === 'function' ? id(x, y) : id);
  }

  get(layer, x, y) {
    return this.layers[layer][y * this.W + x];
  }

  is(layer, x, y, set, id) {
    return this.get(layer, x, y) === id + this.first[set];
  }

  block(layer, set, name, x0, y0) {
    const b = SETS[set].BLOCKS[name];
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) this.put(layer, x0 + dx, y0 + dy, set, blockId(SETS[set], name, dx, dy));
  }

  tree(x, y) { // (x, y) = top-left of the 2x2 tree
    this.put('Above', x, y, 'tiles', T.treeTL);
    this.put('Above', x + 1, y, 'tiles', T.treeTR);
    this.put('Walls', x, y + 1, 'tiles', T.treeBL);
    this.put('Walls', x + 1, y + 1, 'tiles', T.treeBR);
  }

  obj(name, type, tx, ty, tw = 1, th = 1, props) {
    this.objects.push({
      id: this.nextId++, name, type, x: tx * SIZE, y: ty * SIZE, width: tw * SIZE, height: th * SIZE,
      rotation: 0, visible: true, ...(props ? { properties: props } : {}),
    });
  }

  point(name, type, tx, ty, props) {
    this.objects.push({
      id: this.nextId++, name, type, point: true, x: Math.round(tx * SIZE), y: Math.round(ty * SIZE), width: 0, height: 0,
      rotation: 0, visible: true, ...(props ? { properties: props } : {}),
    });
  }

  // A prop placed with its top-left at tile (tx, ty). Tiled anchors tile objects at their bottom-left.
  prop(name, tx, ty, props) {
    const p = PROPS[name];
    for (let dy = -1; dy <= p.h; dy++) for (let dx = -1; dx <= p.w; dx++) this.covered.add((ty + dy) * this.W + tx + dx);
    this.objects.push({
      id: this.nextId++, name, type: 'prop', gid: this.first.props + PROP_NAMES.indexOf(name),
      x: tx * SIZE, y: (ty + p.h) * SIZE, width: p.w * SIZE, height: p.h * SIZE, rotation: 0, visible: true,
      ...(props ? { properties: props } : {}),
    });
  }

  json() {
    let id = 1;
    const layers = Object.keys(this.layers).map((name) => ({
      id: id++, name, type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true,
      data: this.layers[name], ...(this.layerProps[name] ? { properties: this.layerProps[name] } : {}),
    }));
    layers.push({ id: id++, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: this.objects });
    return {
      compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2',
      orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: this.W, height: this.H, tilewidth: SIZE, tileheight: SIZE,
      nextlayerid: id, nextobjectid: this.nextId, layers,
      tilesets: this.sets.map((s) => (s === 'props' ? propsJSON(this.first[s]) : tilesetJSON(SETS[s], this.first[s]))),
    };
  }
}

const isGrass = (m, x, y) => [T.grass, T.grass2, T.grass3, T.flowers].some((id) => m.is('Ground', x, y, 'tiles', id));
function grassFill(m, r) {
  m.rect('Ground', 0, 0, m.W - 1, m.H - 1, 'tiles', () => {
    const n = r();
    return n < 0.76 ? T.grass : n < 0.9 ? T.grass2 : n < 0.96 ? T.grass3 : T.flowers;
  });
}

function decorate(m, r, keepClear, counts) {
  const free = (x, y) => {
    if (keepClear(x, y) || m.covered.has(y * m.W + x) || m.get('Walls', x, y) || m.get('Above', x, y) || !isGrass(m, x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H) continue;
      if (!isGrass(m, nx, ny)) return false; // keep paths, plazas and water edges walkable
    }
    return true;
  };
  counts.forEach(([id, count]) => {
    for (let placed = 0, tries = 0; placed < count && tries < 800; tries++) {
      const x = 2 + r.int(m.W - 4), y = 2 + r.int(m.H - 4);
      if (!free(x, y)) continue;
      m.put('Walls', x, y, 'tiles', id);
      placed++;
    }
  });
}

// ---------- farm ----------
function farm() {
  const m = new MapBuilder('farm', 24, 38, ['tiles', 'ranch', 'seasons', 'props'], ['Ground', 'Soil', 'Debris', 'Walls', 'Above']);
  const r = rng(42);
  grassFill(m, r);
  m.rect('Ground', 4, 11, 19, 24, 'tiles', T.field);
  const pathRect = (x0, y0, x1, y1) => m.rect('Ground', x0, y0, x1, y1, 'tiles', T.path);
  pathRect(6, 7, 7, 10); // house door -> top field gate
  pathRect(8, 7, 10, 7); // to the mailbox
  pathRect(11, 25, 12, 37); // bottom gate -> road to town
  pathRect(13, 32, 17, 33); // branch to the seed stand

  m.block('Walls', 'tiles', 'house', 4, 3); // door at (6, 6)
  m.block('Walls', 'tiles', 'pond', 15, 3); // transparent corners over the (seasonal) grass
  m.block('Walls', 'tiles', 'shop', 14, 28); // counter at (16..17, 31)
  m.put('Walls', 8, 9, 'tiles', T.sign);
  m.put('Walls', 13, 35, 'tiles', T.sign);

  for (let x = 3; x <= 20; x++) {
    if (x !== 6 && x !== 7) m.put('Walls', x, 10, 'tiles', T.fenceH);
    if (x !== 11 && x !== 12) m.put('Walls', x, 25, 'tiles', T.fenceH);
  }
  for (let y = 11; y <= 24; y++) { m.put('Walls', 3, y, 'tiles', T.fenceV); m.put('Walls', 20, y, 'tiles', T.fenceV); }
  [[3, 10], [20, 10], [5, 10], [8, 10], [3, 25], [20, 25], [10, 25], [13, 25]].forEach(([x, y]) => m.put('Walls', x, y, 'tiles', T.fencePost));

  // animal pen with barn, coop and a gate onto the path
  const PEN = { x0: 2, y0: 27, x1: 10, y1: 35 };
  for (let x = PEN.x0; x <= PEN.x1; x++) { m.put('Walls', x, PEN.y0, 'tiles', T.fenceH); m.put('Walls', x, PEN.y1, 'tiles', T.fenceH); }
  for (let y = PEN.y0 + 1; y < PEN.y1; y++) {
    m.put('Walls', PEN.x0, y, 'tiles', T.fenceV);
    if (y !== 31 && y !== 32) m.put('Walls', PEN.x1, y, 'tiles', T.fenceV);
  }
  [[PEN.x0, PEN.y0], [PEN.x1, PEN.y0], [PEN.x0, PEN.y1], [PEN.x1, PEN.y1], [PEN.x1, 30], [PEN.x1, 33]].forEach(([x, y]) => m.put('Walls', x, y, 'tiles', T.fencePost));
  m.block('Walls', 'ranch', 'barn', 3, 28);
  m.block('Walls', 'ranch', 'coop', 7, 28);
  m.put('Walls', 9, 28, 'ranch', R.hay);
  m.put('Walls', 6, 30, 'ranch', R.trough);
  pathRect(10, 31, 10, 32);

  // tree border, with the road south left open
  for (let x = 0; x < m.W; x += 2) m.tree(x, 0);
  for (let y = 2; y <= 34; y += 2) { m.tree(0, y); m.tree(22, y); }
  for (let x = 2; x < m.W - 2; x += 2) if (x !== 10 && x !== 12) m.tree(x, 36);

  m.prop('doghouse', 12, 3);
  m.prop('mailbox', 9, 5);
  m.prop('stable', 18, 32, [prop('requires', 'string', 'stable')]);
  const keep = (x, y) => (x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 - 1 && y <= PEN.y1)
    || (x >= 11 && x <= 14 && y >= 2 && y <= 9) || (x >= 8 && x <= 10 && y >= 4 && y <= 6) || x === 2 || x === 21 || (x >= 17 && y >= 31 && y <= 35);
  decorate(m, r, keep, [[T.tallgrass, 16], [T.bush, 6], [T.rock, 4], [T.stump, 2]]);

  m.point('spawn', 'spawn', 6.5, 7.6);
  m.point('house_door', 'spawn', 6.5, 7.6, [prop('dir', 'string', 'down')]);
  m.point('from_town', 'spawn', 11.5, 35.6, [prop('dir', 'string', 'up')]);
  m.obj('house_door', 'warp', 6, 6, 1, 1, [prop('to', 'string', 'house'), prop('spawn', 'string', 'door'), prop('label', 'string', 'Enter')]);
  m.obj('road_south', 'warp', 10, 37, 4, 1, [prop('to', 'string', 'town'), prop('spawn', 'string', 'from_farm'), prop('walk', 'bool', true)]);
  m.obj('mailbox', 'mail', 9, 6);
  m.point('horse', 'place', 17.3, 35.2);
  m.obj('seed_shop', 'shop', 16, 31, 2, 1);
  m.obj('incubator', 'incubator', 7, 28, 2, 2);
  m.obj('field_sign', 'sign', 8, 9, 1, 1, [prop('text', 'string', 'MY FIELD\nClear weeds, branches and stones, then till, plant and water every day. Sell your crops at the market stall in town.')]);
  m.obj('road_sign', 'sign', 13, 35, 1, 1, [prop('text', 'string', 'SOUTH: Willowbrook\nThe town is just down the road. Say hello to everyone!')]);
  m.obj('animal_pen', 'pen', 3, 31, 7, 4);
  m.obj('dog_yard', 'dogarea', 11, 5, 4, 5);
  [[11, 2, 4, 3], [2, 11, 1, 14], [14, 34, 3, 2], [21, 26, 1, 6]].forEach(([x, y, w, h], i) => m.obj('forage_' + i, 'forage', x, y, w, h));
  return m.json();
}

// ---------- house: one map per level (the furniture is the player's, placed by the game) ----------
function house(level) {
  const [W, Hh] = HOME.levels[level - 1].map, [d0, d1] = HOME.door;
  const m = new MapBuilder('house_' + level, W, Hh, ['indoor', 'props'], ['Ground', 'Walls']);
  m.rect('Ground', 0, 0, W - 1, Hh - 1, 'indoor', (x, y) => ((x + y) % 2 ? I.floor : I.floor2));
  m.rect('Walls', 0, 0, W - 1, 0, 'indoor', I.wall);
  m.rect('Walls', 0, 1, W - 1, 1, 'indoor', I.wall_low);
  m.rect('Walls', 0, 0, 0, Hh - 1, 'indoor', I.wall_side);
  m.rect('Walls', W - 1, 0, W - 1, Hh - 1, 'indoor', I.wall_side);
  m.rect('Walls', 1, Hh - 1, W - 2, Hh - 1, 'indoor', I.wall_side);
  m.put('Walls', d0, Hh - 1, null, 0); // the front door
  m.put('Walls', d1, Hh - 1, null, 0);
  m.point('door', 'spawn', d1, Hh - 1.4, [prop('dir', 'string', 'up')]);
  m.obj('exit', 'warp', d0, Hh - 1, 2, 1, [prop('to', 'string', 'farm'), prop('spawn', 'string', 'house_door'), prop('walk', 'bool', true)]);
  return m.json();
}

// ---------- town ----------
function town() {
  // The old town (x 0..29, y 0..35) keeps its coordinates. East of it: Market Street and the park; south-east:
  // the beach and the lake; over the bridge to the south: the lane of homes, the school and the chapel.
  const m = new MapBuilder('town', 54, 52, ['tiles', 'seasons', 'props'], ['Ground', 'Walls', 'Above']);
  const r = rng(77);
  grassFill(m, r);
  const path = (x0, y0, x1, y1) => m.rect('Ground', x0, y0, x1, y1, 'tiles', T.path);
  m.rect('Ground', 8, 14, 21, 22, 'tiles', T.plaza);
  path(14, 0, 15, 13); // road from the farm into the plaza
  path(2, 11, 53, 12); // the main street, east along Market Street to the valley road
  path(4, 8, 5, 10); // town hall
  path(24, 8, 25, 10); // inn
  path(4, 19, 7, 20); // forge -> plaza
  path(22, 19, 51, 20); // woodshop -> plaza, and on into the park
  path(13, 23, 14, 31); // plaza -> dock
  path(4, 27, 25, 28); // clinic / cottage street
  path(20, 29, 21, 31); // cabin
  path(24, 29, 25, 31); // down to the bridge
  path(48, 18, 48, 18); // vet door
  path(29, 21, 30, 28); // park: west walk down to the beach
  path(31, 26, 51, 27); // park: the pond walk
  path(43, 21, 44, 25); // park: between the pond and the playground
  // the beach and the lake, the river, the bridge and the pier
  m.rect('Ground', 28, 29, 53, 51, 'tiles', T.sand);
  m.rect('Ground', 36, 32, 51, 47, 'tiles', T.water);
  m.rect('Ground', 0, 32, 35, 35, 'tiles', T.water); // the river
  m.rect('Ground', 13, 31, 14, 33, 'tiles', T.dock); // the old dock
  m.rect('Ground', 24, 32, 25, 35, 'tiles', T.dock); // the bridge
  m.rect('Ground', 42, 32, 43, 37, 'tiles', T.dock); // the pier
  // over the bridge: the lane and Chapel Row
  path(24, 36, 25, 48);
  path(2, 40, 29, 41); // the lane, out to the beach
  path(2, 47, 25, 48); // Chapel Row
  m.block('Walls', 'tiles', 'pond', 38, 22); // transparent corners over the grass

  for (let x = 0; x < m.W; x += 2) if (x !== 14) m.tree(x, 0);
  for (let y = 2; y <= 28; y += 2) {
    m.tree(0, y);
    if (y < 8 || (y > 13 && y < 14)) m.tree(28, y);
    if (y < 10 || y > 13) m.tree(52, y);
  }
  for (let y = 36; y <= 48; y += 2) m.tree(0, y);
  for (let x = 2; x <= 26; x += 2) m.tree(x, 50);
  [[4, 29], [7, 29], [2, 30], [26, 30], [16, 2], [44, 2], [48, 2], [31, 2], [50, 22], [22, 43], [26, 43]].forEach(([x, y]) => m.tree(x, y));

  m.prop('mayor', 2, 3);
  m.prop('inn', 22, 3);
  m.prop('forge', 2, 15);
  m.prop('woodshop', 23, 15);
  m.prop('clinic', 3, 23);
  m.prop('cottage', 23, 23);
  m.prop('cabin', 19, 28);
  m.prop('mine_entrance', 26, 8);
  m.prop('fountain', 13, 15);
  m.prop('notice', 19, 13);
  m.prop('farm_stand', 11, 13); // the market stall
  m.prop('order_board', 9, 13); // beside the market stall
  [[8, 14], [21, 14], [8, 21], [21, 21]].forEach(([x, y]) => m.prop('lamp', x, y - 1));
  m.prop('bench', 10, 22);
  m.prop('bench', 18, 22);
  m.prop('flowerbed', 10, 10);
  m.prop('flowerbed', 18, 10);
  // Market Street
  m.prop('bakery', 30, 7);
  m.prop('florist', 35, 7);
  m.prop('post', 40, 7);
  m.prop('library', 45, 6);
  m.prop('wagon', 31, 13);
  m.prop('fruit_stall', 36, 13);
  m.prop('cloth_stall', 39, 13);
  m.prop('statue', 42, 13);
  m.prop('vet', 46, 14);
  [[34, 16], [45, 16]].forEach(([x, y]) => m.prop('lamp', x, y));
  // the park
  m.prop('gazebo', 31, 22);
  m.prop('playground', 45, 22);
  m.prop('easel', 36, 24);
  m.prop('flowerbed', 38, 21);
  m.prop('flowerbed', 41, 21);
  m.prop('bench', 32, 28);
  m.prop('bench', 46, 28);
  // the beach
  m.prop('shack', 30, 37);
  m.prop('umbrella', 30, 44);
  m.prop('umbrella', 33, 48);
  m.prop('boat', 45, 40);
  // the lane and Chapel Row
  m.prop('townhouse_1', 2, 36);
  m.prop('townhouse_2', 7, 36);
  m.prop('townhouse_3', 12, 36);
  m.prop('townhouse_4', 17, 36);
  m.prop('flowerbed', 21, 37);
  m.prop('flowerbed', 21, 38);
  m.prop('chapel', 3, 42);
  m.prop('school', 9, 43);
  m.prop('flowerbed', 16, 45);
  m.prop('lamp', 19, 45);
  // festival decorations (only shown on the day)
  m.prop('flower_arch', 13, 12, [prop('festival', 'string', 'flower')]);
  [[10, 15], [19, 15], [10, 19], [19, 19]].forEach(([x, y]) => m.prop('lantern', x, y, [prop('festival', 'string', 'fireworks,starry')]));
  [[9, 16], [19, 16]].forEach(([x, y]) => m.prop('pumpkin_pile', x, y, [prop('festival', 'string', 'harvest,cowfest')]));
  m.prop('festive_tree', 17, 13, [prop('festival', 'string', 'starry')]);

  // spawns, warps and doors
  m.point('from_farm', 'spawn', 15, 1.6, [prop('dir', 'string', 'down')]);
  m.point('from_mine', 'spawn', 28, 11.6, [prop('dir', 'string', 'down')]);
  m.point('from_east', 'place', 53.5, 11.6); // visitors from out of town come along the valley road
  m.obj('road_north', 'warp', 14, 0, 2, 1, [prop('to', 'string', 'farm'), prop('spawn', 'string', 'from_town'), prop('walk', 'bool', true)]);
  m.obj('mine_door', 'warp', 27, 10, 2, 1, [prop('to', 'string', 'mine'), prop('spawn', 'string', 'entrance'), prop('label', 'string', 'Enter')]);
  const doors = {
    mayor: [4, 7, 2], inn: [24, 7, 2], forge: [4, 18, 1], woodshop: [25, 18, 1], clinic: [4, 26, 2], cottage: [24, 26, 2], cabin: [20, 30, 2],
    bakery: [32, 10, 1], florist: [36, 10, 2], post: [42, 10, 1], library: [47, 10, 2], vet: [48, 17, 1], shack: [31, 39, 2],
    lane1: [3, 39, 2], lane2: [8, 39, 2], lane3: [13, 39, 2], lane4: [18, 39, 2], chapel: [4, 46, 2], school: [11, 46, 2],
  };
  Object.keys(doors).forEach((b) => {
    const [x, y, w] = doors[b];
    m.obj('door_' + b, 'door', x, y, w, 1, [prop('building', 'string', b)]);
    m.point('door_' + b, 'place', x + w / 2, y + 1.5);
  });
  m.obj('door_wagon', 'door', 31, 13, 3, 1, [prop('building', 'string', 'wagon')]); // Marco sells from the street side
  // places villagers walk between (hub = plaza_c: every walk goes through it)
  const places = [['plaza_c', 14.5, 19.6], ['plaza_n', 14.5, 13.6], ['plaza_e', 19.5, 18.5], ['plaza_w', 9.5, 18.5], ['plaza_s', 14.5, 22.4],
    ['dock', 13.9, 31.4], ['forest', 6.5, 31.2],
    ['market_w', 35.5, 12.5], ['market_e', 45.5, 12.5], ['wagon', 34.5, 14.6],
    ['gazebo', 32.5, 26.6], ['park_pond', 40.5, 26.6], ['park_easel', 36.5, 26.6], ['park_bench', 47, 27.4], ['playground', 46.5, 25.6],
    ['beach', 31.5, 42.5], ['pier', 42.5, 36.5], ['lane', 10.5, 40.6], ['lane_garden', 22.5, 39.6], ['chapel_yard', 7.5, 47.6]];
  places.forEach(([n, x, y]) => m.point(n, 'place', x, y));
  // festival spots, one per villager (fest_<index in VILLAGER_ORDER>)
  [[11.5, 19.6], [14.5, 19.6], [17.5, 19.6], [10.2, 21.2], [18.8, 21.2], [12.2, 22.3], [16.8, 22.3],
    [9.5, 18.6], [11, 18.6], [18, 18.6], [19.5, 18.6], [9.5, 20.4], [12.5, 20.4], [14.5, 20.4], [16.5, 20.4], [20.5, 20.4],
    [9.5, 15.6], [11.5, 15.6], [17.5, 15.6], [20.5, 15.6], [11.5, 17.2], [17.5, 17.2], [20.5, 17.2]]
    .forEach(([x, y], i) => m.point('fest_' + i, 'place', x, y));
  [[2, 27, 9, 4], [16, 2, 6, 8], [26, 25, 2, 5], [30, 2, 12, 3], [2, 44, 6, 2]].forEach(([x, y, w, h], i) => m.obj('forage_' + i, 'forage', x, y, w, h));
  m.obj('farm_stand', 'stand', 11, 14, 2, 1);
  m.obj('order_board', 'orders', 9, 13, 2, 2);
  m.point('stall_front', 'place', 12, 15.7); // where buyers stand
  m.put('Walls', 16, 2, 'tiles', T.sign);
  m.obj('town_sign', 'sign', 16, 2, 1, 1, [prop('text', 'string', 'WILLOWBROOK\nTown Hall, Inn, Forge, Woodshop and Clinic around the plaza. Market Street and the park to the east, the beach to the south-east, and over the bridge the lane, the school and the chapel.')]);

  // keep paths, plazas, the beach and everyone's standing spots clear of random bushes
  const spots = new Set(m.objects.filter((o) => o.point).map((o) => Math.floor(o.y / SIZE) * m.W + Math.floor(o.x / SIZE)));
  const keep = (x, y) => (x >= 8 && x <= 21 && y >= 13 && y <= 23) || y >= 31 || spots.has(y * m.W + x)
    || (x >= 29 && y >= 18) || [...spots].some((k) => Math.abs((k % m.W) - x) <= 1 && Math.abs(Math.floor(k / m.W) - y) <= 1);
  decorate(m, r, keep, [[T.tallgrass, 16], [T.bush, 10]]);
  return m.json();
}

// ---------- mine ----------
function mine() {
  const m = new MapBuilder('mine', 14, 16, ['indoor'], ['Ground', 'Walls']);
  const r = rng(9);
  m.rect('Ground', 0, 0, 13, 15, 'indoor', () => (r() < 0.5 ? I.cave : I.cave2));
  m.rect('Walls', 0, 0, 13, 0, 'indoor', I.cave_top);
  m.rect('Walls', 0, 1, 13, 1, 'indoor', I.cave_wall);
  m.rect('Walls', 0, 0, 0, 15, 'indoor', I.cave_top);
  m.rect('Walls', 13, 0, 13, 15, 'indoor', I.cave_top);
  m.rect('Walls', 0, 15, 13, 15, 'indoor', I.cave_top);
  m.put('Walls', 6, 2, 'indoor', I.ladder_up);
  m.point('entrance', 'spawn', 6.5, 3.6, [prop('dir', 'string', 'down')]);
  m.obj('exit', 'warp', 6, 2, 1, 1, [prop('to', 'string', 'town'), prop('spawn', 'string', 'from_mine'), prop('label', 'string', 'Climb out')]);
  m.obj('floor', 'minefloor', 1, 4, 12, 11);
  return m.json();
}

const MAPS = { farm, town, mine };
HOME.levels.forEach((l, i) => { MAPS['house_' + (i + 1)] = () => house(i + 1); });
const force = process.argv.find((a) => a.startsWith('--force'));
Object.keys(MAPS).forEach((name) => {
  const out = path.join(__dirname, '..', 'maps', name + '.json');
  const allowed = force === '--force' || force === '--force=' + name;
  if (fs.existsSync(out) && !allowed) {
    console.log(`maps/${name}.json already exists (edit it in Tiled). Use --force=${name} to regenerate.`);
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(MAPS[name]()));
  console.log('Wrote maps/' + name + '.json');
});
