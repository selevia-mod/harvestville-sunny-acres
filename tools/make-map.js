'use strict';
// Seeds the Tiled (1.10) JSON maps in maps/: farm, house, town and mine. You can open and edit them in Tiled.
// After the first run the JSON files are the source of truth; this script won't overwrite an existing map
// unless you pass --force (or --force=<map> for one map).
const fs = require('fs');
const path = require('path');
const { SIZE, TILES, RANCH, SEASONS, INDOOR, PROPS, SEASON_NAMES, SEASONAL, blockId } = require('./tiles');

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
  pathRect(8, 7, 11, 7); // to the farm stand and the order board
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
  m.prop('mailbox', 3, 5);
  m.prop('farm_stand', 9, 5);
  m.prop('order_board', 9, 8);
  m.prop('stable', 18, 32, [prop('requires', 'string', 'stable')]);
  const keep = (x, y) => (x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 - 1 && y <= PEN.y1)
    || (x >= 11 && x <= 14 && y >= 2 && y <= 9) || (x >= 8 && x <= 11 && y >= 4 && y <= 9) || (x === 3 && y >= 4 && y <= 7) || x === 2 || x === 21 || (x >= 17 && y >= 31 && y <= 35);
  decorate(m, r, keep, [[T.tallgrass, 16], [T.bush, 6], [T.rock, 4], [T.stump, 2]]);

  m.point('spawn', 'spawn', 6.5, 7.6);
  m.point('house_door', 'spawn', 6.5, 7.6, [prop('dir', 'string', 'down')]);
  m.point('from_town', 'spawn', 11.5, 35.6, [prop('dir', 'string', 'up')]);
  m.obj('house_door', 'warp', 6, 6, 1, 1, [prop('to', 'string', 'house'), prop('spawn', 'string', 'door'), prop('label', 'string', 'Enter')]);
  m.obj('road_south', 'warp', 10, 37, 4, 1, [prop('to', 'string', 'town'), prop('spawn', 'string', 'from_farm'), prop('walk', 'bool', true)]);
  m.obj('farm_stand', 'stand', 9, 6, 2, 1);
  m.obj('order_board', 'orders', 9, 8, 2, 2);
  m.obj('mailbox', 'mail', 3, 6);
  m.point('horse', 'place', 17.3, 35.2);
  m.obj('seed_shop', 'shop', 16, 31, 2, 1);
  m.obj('incubator', 'incubator', 7, 28, 2, 2);
  m.obj('field_sign', 'sign', 8, 9, 1, 1, [prop('text', 'string', 'MY FIELD\nClear weeds, branches and stones, then till, plant and water every day. Sell your crops at the farm stand by the house.')]);
  m.obj('road_sign', 'sign', 13, 35, 1, 1, [prop('text', 'string', 'SOUTH: Willowbrook\nThe town is just down the road. Say hello to everyone!')]);
  m.obj('animal_pen', 'pen', 3, 31, 7, 4);
  m.obj('dog_yard', 'dogarea', 11, 5, 4, 5);
  [[11, 2, 4, 3], [2, 11, 1, 14], [14, 34, 3, 2], [21, 26, 1, 6]].forEach(([x, y, w, h], i) => m.obj('forage_' + i, 'forage', x, y, w, h));
  return m.json();
}

// ---------- house ----------
function house() {
  const m = new MapBuilder('house', 12, 10, ['indoor', 'props'], ['Ground', 'Walls', 'Closed']);
  m.rect('Ground', 0, 0, 11, 9, 'indoor', (x, y) => ((x + y) % 2 ? I.floor : I.floor2));
  m.rect('Walls', 0, 0, 11, 0, 'indoor', I.wall);
  m.rect('Walls', 0, 1, 11, 1, 'indoor', I.wall_low);
  m.rect('Walls', 0, 0, 0, 9, 'indoor', I.wall_side);
  m.rect('Walls', 11, 0, 11, 9, 'indoor', I.wall_side);
  m.rect('Walls', 1, 9, 10, 9, 'indoor', I.wall_side);
  m.put('Walls', 5, 9, null, 0); // the front door
  m.put('Walls', 6, 9, null, 0);
  // before the extension is built, the east wing (x 7..10) is closed off
  m.rect('Closed', 7, 0, 10, 9, 'indoor', I.void);
  m.layerProps.Closed = [prop('unless', 'string', 'bighouse')];

  m.prop('window', 1, 0);
  m.prop('shelf', 3, 0);
  m.prop('fireplace', 5, 0);
  m.prop('window', 8, 0, [prop('requires', 'string', 'bighouse')]);
  m.prop('bed', 1, 2);
  m.prop('tv', 4, 2);
  m.prop('plant', 6, 2);
  m.prop('rug', 2, 5);
  m.prop('table', 3, 5);
  m.prop('kitchen', 1, 7, [prop('requires', 'string', 'kitchen')]);
  m.prop('doormat', 5, 8);
  m.prop('bed2', 8, 2, [prop('requires', 'string', 'bighouse')]);
  m.prop('dresser', 9, 6, [prop('requires', 'string', 'bighouse')]);
  m.prop('wall_calendar', 10, 0, [prop('requires', 'string', 'bighouse')]);
  // furniture bought from Mira
  m.prop('big_plant', 3, 1, [prop('requires', 'string', 'f_plant')]);
  m.prop('music_box', 5, 2, [prop('requires', 'string', 'f_music')]);
  m.prop('aquarium', 1, 5, [prop('requires', 'string', 'f_aquarium')]);
  m.prop('cat_bed', 6, 6, [prop('requires', 'string', 'f_cat')]);

  m.point('door', 'spawn', 6, 8.6, [prop('dir', 'string', 'up')]);
  m.point('bed', 'spawn', 2, 4.5, [prop('dir', 'string', 'down')]);
  m.point('spouse', 'place', 6.5, 4.5);
  m.obj('exit', 'warp', 5, 9, 2, 1, [prop('to', 'string', 'farm'), prop('spawn', 'string', 'house_door'), prop('walk', 'bool', true)]);
  m.obj('bed', 'sleep', 1, 2, 2, 2);
  m.obj('tv', 'tv', 4, 2);
  m.obj('music_box', 'musicbox', 5, 2, 1, 1, [prop('requires', 'string', 'f_music')]);
  m.obj('aquarium', 'aquarium', 1, 5, 2, 2, [prop('requires', 'string', 'f_aquarium')]);
  m.obj('cat_area', 'catarea', 1, 4, 6, 4);
  m.obj('kitchen', 'kitchen', 1, 7, 3, 2, [prop('requires', 'string', 'kitchen')]);
  return m.json();
}

// ---------- town ----------
function town() {
  const m = new MapBuilder('town', 30, 36, ['tiles', 'seasons', 'props'], ['Ground', 'Walls', 'Above']);
  const r = rng(77);
  grassFill(m, r);
  const path = (x0, y0, x1, y1) => m.rect('Ground', x0, y0, x1, y1, 'tiles', T.path);
  m.rect('Ground', 8, 14, 21, 22, 'tiles', T.plaza);
  path(14, 0, 15, 13); // road from the farm into the plaza
  path(2, 11, 29, 12); // the main street
  path(4, 8, 5, 10); // town hall
  path(24, 8, 25, 10); // inn
  path(4, 19, 7, 20); // forge -> plaza
  path(22, 19, 25, 20); // woodshop -> plaza
  path(13, 23, 14, 31); // plaza -> dock
  path(4, 27, 25, 28); // clinic / cottage street
  path(20, 29, 21, 31); // cabin
  m.rect('Ground', 0, 32, 29, 35, 'tiles', T.water); // the river
  m.rect('Ground', 13, 31, 14, 33, 'tiles', T.dock);

  for (let x = 0; x < m.W; x += 2) if (x !== 14) m.tree(x, 0);
  for (let y = 2; y <= 28; y += 2) {
    m.tree(0, y);
    if (y < 8 || y > 13) m.tree(28, y);
  }
  [[4, 29], [7, 29], [2, 30], [24, 29], [26, 30]].forEach(([x, y]) => m.tree(x, y));

  m.prop('mayor', 2, 3);
  m.prop('inn', 22, 3);
  m.prop('forge', 2, 15);
  m.prop('woodshop', 23, 15);
  m.prop('clinic', 3, 23);
  m.prop('cottage', 23, 23);
  m.prop('cabin', 19, 28);
  m.prop('mine_entrance', 26, 8);
  m.prop('fountain', 13, 15);
  m.prop('notice', 9, 13);
  [[8, 14], [21, 14], [8, 21], [21, 21]].forEach(([x, y]) => m.prop('lamp', x, y - 1));
  m.prop('bench', 10, 22);
  m.prop('bench', 18, 22);
  m.prop('flowerbed', 10, 10);
  m.prop('flowerbed', 18, 10);
  // festival decorations (only shown on the day)
  m.prop('flower_arch', 13, 12, [prop('festival', 'string', 'flower')]);
  [[10, 15], [19, 15], [10, 19], [19, 19]].forEach(([x, y]) => m.prop('lantern', x, y, [prop('festival', 'string', 'fireworks,starry')]));
  [[9, 16], [19, 16]].forEach(([x, y]) => m.prop('pumpkin_pile', x, y, [prop('festival', 'string', 'harvest,cowfest')]));
  m.prop('festive_tree', 17, 13, [prop('festival', 'string', 'starry')]);

  const keep = (x, y) => (x >= 8 && x <= 21 && y >= 13 && y <= 23) || y >= 31;
  decorate(m, r, keep, [[T.tallgrass, 10], [T.bush, 6]]);

  // spawns, warps and doors
  m.point('from_farm', 'spawn', 15, 1.6, [prop('dir', 'string', 'down')]);
  m.point('from_mine', 'spawn', 28, 11.6, [prop('dir', 'string', 'down')]);
  m.obj('road_north', 'warp', 14, 0, 2, 1, [prop('to', 'string', 'farm'), prop('spawn', 'string', 'from_town'), prop('walk', 'bool', true)]);
  m.obj('mine_door', 'warp', 27, 10, 2, 1, [prop('to', 'string', 'mine'), prop('spawn', 'string', 'entrance'), prop('label', 'string', 'Enter')]);
  const doors = { mayor: [4, 7, 2], inn: [24, 7, 2], forge: [4, 18, 1], woodshop: [25, 18, 1], clinic: [4, 26, 2], cottage: [24, 26, 2], cabin: [20, 30, 2] };
  Object.keys(doors).forEach((b) => {
    const [x, y, w] = doors[b];
    m.obj('door_' + b, 'door', x, y, w, 1, [prop('building', 'string', b)]);
    m.point('door_' + b, 'place', x + w / 2, y + 1.5);
  });
  // places villagers walk between (hub = plaza_c: every walk goes through it)
  [['plaza_c', 14.5, 19.6], ['plaza_n', 14.5, 13.6], ['plaza_e', 19.5, 18.5], ['plaza_w', 9.5, 18.5], ['plaza_s', 14.5, 22.4],
    ['dock', 13.9, 31.4], ['forest', 6.5, 31.2]].forEach(([n, x, y]) => m.point(n, 'place', x, y));
  [[11.5, 19.6], [14.5, 19.6], [17.5, 19.6], [10.2, 21.2], [18.8, 21.2], [12.2, 22.3], [16.8, 22.3]]
    .forEach(([x, y], i) => m.point('fest_' + i, 'place', x, y));
  [[2, 27, 9, 4], [16, 2, 6, 8], [26, 25, 2, 5]].forEach(([x, y, w, h], i) => m.obj('forage_' + i, 'forage', x, y, w, h));
  m.put('Walls', 16, 2, 'tiles', T.sign);
  m.obj('town_sign', 'sign', 16, 2, 1, 1, [prop('text', 'string', 'WILLOWBROOK\nTown Hall, Inn, Forge, Woodshop and Clinic around the plaza. The mine is east, the river south.')]);
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

const MAPS = { farm, house, town, mine };
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
