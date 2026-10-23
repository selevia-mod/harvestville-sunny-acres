'use strict';
// Seeds maps/farm.json — a regular Tiled (1.10) JSON map you can open and edit in Tiled.
// After the first run the JSON file is the source of truth; this script refuses to overwrite it
// unless you pass --force.
const fs = require('fs');
const path = require('path');
const { SIZE, TILES, RANCH, SEASONS, SEASON_NAMES, SEASONAL, blockId } = require('./tiles');

const T = TILES.T;
const R = RANCH.T;
const FIRSTGID = { tiles: 1, ranch: 1 + TILES.TILECOUNT, seasons: 1 + TILES.TILECOUNT + RANCH.TILECOUNT };

function rng(seed) { // deterministic, so the seeded map is reproducible
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

const OUT = path.join(__dirname, '..', 'maps', 'farm.json');
if (fs.existsSync(OUT) && !process.argv.includes('--force')) {
  console.log('maps/farm.json already exists (edit it in Tiled). Use --force to regenerate.');
  process.exit(0);
}

const W = 24;
const H = 38;
const r = rng(42);
const layer = () => new Array(W * H).fill(0);
const ground = layer(), soil = layer(), walls = layer(), above = layer();
// put() takes a tile id of the main tileset; putRanch() one of the ranch tileset.
const put = (l, x, y, id) => { if (x >= 0 && y >= 0 && x < W && y < H) l[y * W + x] = id + FIRSTGID.tiles; };
const putRanch = (l, x, y, id) => { l[y * W + x] = id + FIRSTGID.ranch; };
const get = (l, x, y) => l[y * W + x] - 1;
const putBlock = (l, set, name, x0, y0) => {
  const b = set.BLOCKS[name];
  for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
    const id = blockId(set, name, dx, dy);
    if (set === RANCH) putRanch(l, x0 + dx, y0 + dy, id);
    else put(l, x0 + dx, y0 + dy, id);
  }
};
const tree = (x, y) => { // (x, y) = top-left of the 2x2 tree
  put(above, x, y, T.treeTL); put(above, x + 1, y, T.treeTR);
  put(walls, x, y + 1, T.treeBL); put(walls, x + 1, y + 1, T.treeBR);
};

// --- ground: grass with variety
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const n = r();
  put(ground, x, y, n < 0.76 ? T.grass : n < 0.9 ? T.grass2 : n < 0.96 ? T.grass3 : T.flowers);
}

// --- farm field (tillable)
const FIELD = { x0: 4, y0: 11, x1: 19, y1: 24 };
for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) put(ground, x, y, T.field);

// --- paths
const pathRect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(ground, x, y, T.path); };
pathRect(6, 7, 7, 10);    // house door -> top field gate
pathRect(8, 7, 10, 7);    // to the shipping box
pathRect(11, 25, 12, 37); // bottom gate -> south exit
pathRect(13, 32, 17, 33); // branch to the shop counter

// --- buildings & pond
putBlock(walls, TILES, 'house', 4, 3);  // door at (6, 6)
putBlock(walls, TILES, 'pond', 15, 3); // transparent corners over the (seasonal) grass
putBlock(walls, TILES, 'shop', 14, 28); // counter at (16..17, 31)
put(walls, 10, 6, T.shipbox);
put(walls, 8, 9, T.sign);
put(walls, 13, 35, T.sign);

// --- field fence with gates at the top (x 6..7) and bottom (x 11..12)
for (let x = 3; x <= 20; x++) {
  if (x !== 6 && x !== 7) put(walls, x, 10, T.fenceH);
  if (x !== 11 && x !== 12) put(walls, x, 25, T.fenceH);
}
for (let y = 11; y <= 24; y++) { put(walls, 3, y, T.fenceV); put(walls, 20, y, T.fenceV); }
[[3, 10], [20, 10], [5, 10], [8, 10], [3, 25], [20, 25], [10, 25], [13, 25]].forEach(([x, y]) => put(walls, x, y, T.fencePost));
for (let x = 10; x <= 13; x++) put(walls, x, 37, T.fenceH); // south road is closed for now
put(walls, 10, 37, T.fencePost); put(walls, 13, 37, T.fencePost);

// --- animal pen (x 2..10, y 27..35) with a barn, a coop and a gate onto the path at y 31..32
const PEN = { x0: 2, y0: 27, x1: 10, y1: 35 };
for (let x = PEN.x0; x <= PEN.x1; x++) { put(walls, x, PEN.y0, T.fenceH); put(walls, x, PEN.y1, T.fenceH); }
for (let y = PEN.y0 + 1; y < PEN.y1; y++) {
  put(walls, PEN.x0, y, T.fenceV);
  if (y !== 31 && y !== 32) put(walls, PEN.x1, y, T.fenceV);
}
[[PEN.x0, PEN.y0], [PEN.x1, PEN.y0], [PEN.x0, PEN.y1], [PEN.x1, PEN.y1], [PEN.x1, 30], [PEN.x1, 33]].forEach(([x, y]) => put(walls, x, y, T.fencePost));
putBlock(walls, RANCH, 'barn', 3, 28);
putBlock(walls, RANCH, 'coop', 7, 28);
putRanch(walls, 9, 28, R.hay);
putRanch(walls, 6, 30, R.trough);
pathRect(10, 31, 10, 32); // through the gate

// --- tree border
for (let x = 0; x < W; x += 2) tree(x, 0);
for (let y = 2; y <= 34; y += 2) { tree(0, y); tree(22, y); }
for (let x = 2; x < W - 2; x += 2) if (x !== 10 && x !== 12) tree(x, 36);

// --- scattered decoration on open grass
const free = (x, y) => {
  if (x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 - 1 && y <= PEN.y1) return false;
  if (get(walls, x, y) >= 0 || get(above, x, y) >= 0) return false;
  const g = get(ground, x, y);
  if (g !== T.grass && g !== T.grass2 && g !== T.grass3 && g !== T.flowers) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (get(ground, nx, ny) === T.path || get(walls, nx, ny) === T.shipbox || get(walls, nx, ny) === T.sign) return false;
  }
  return true;
};
const decor = [[T.tallgrass, 16], [T.bush, 6], [T.rock, 4], [T.stump, 2]];
decor.forEach(([id, count]) => {
  for (let placed = 0, tries = 0; placed < count && tries < 500; tries++) {
    const x = 2 + r.int(W - 4), y = 2 + r.int(H - 5);
    if (x === 2 || x === 21) continue; // keep the side corridors open
    if (!free(x, y)) continue;
    put(walls, x, y, id);
    placed++;
  }
});

// --- tileset tile properties
const prop = (name, type, value) => ({ name, type, value });
const tileProps = { tiles: {}, ranch: {}, seasons: {} };
let current = 'tiles';
const add = (id, ...props) => { tileProps[current][id] = (tileProps[current][id] || []).concat(props); };
[T.fenceH, T.fenceV, T.fencePost, T.treeBL, T.treeBR, T.bush, T.rock, T.shipbox, T.sign, T.stump].forEach((id) => add(id, prop('collides', 'bool', true)));
add(T.water, prop('collides', 'bool', true), prop('water', 'bool', true));
add(T.field, prop('tillable', 'bool', true), prop('name', 'string', 'field'));
add(T.tilled, prop('name', 'string', 'tilled'));
add(T.tilledWet, prop('name', 'string', 'tilled_wet'));
[TILES, RANCH].forEach((set) => {
  current = set.NAME;
  Object.keys(set.BLOCKS).forEach((name) => {
    const b = set.BLOCKS[name];
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      add(blockId(set, name, dx, dy), prop('collides', 'bool', true));
      if (name === 'pond') add(blockId(set, name, dx, dy), prop('water', 'bool', true));
    }
  });
});
add(R.hay, prop('collides', 'bool', true));
add(R.trough, prop('collides', 'bool', true));

// Seasonal tiles: each spring tile names its slot; every season's copy gets the same gameplay properties.
SEASON_NAMES.forEach((season) => {
  SEASONAL.forEach((kind) => {
    current = 'seasons';
    (tileProps.tiles[T[kind]] || []).filter((p) => p.name !== 'name').forEach((p) => add(SEASONS.T[season + '_' + kind], p));
  });
});
current = 'tiles';
SEASONAL.forEach((kind, k) => add(T[kind], prop('seasonal', 'int', k)));

// --- objects (Tiled object layer)
let nextId = 1;
const obj = (name, type, tx, ty, tw = 1, th = 1, props) => ({
  id: nextId++, name, type, x: tx * SIZE, y: ty * SIZE, width: tw * SIZE, height: th * SIZE,
  rotation: 0, visible: true, ...(props ? { properties: props } : {}),
});
const objects = [
  { id: nextId++, name: 'spawn', type: 'spawn', point: true, x: 6.5 * SIZE, y: Math.round(7.6 * SIZE), width: 0, height: 0, rotation: 0, visible: true },
  obj('house_door', 'sleep', 6, 6),
  obj('shipping_box', 'ship', 10, 6),
  obj('seed_shop', 'shop', 16, 31, 2, 1),
  obj('field_sign', 'sign', 8, 9, 1, 1, [prop('text', 'string', 'MY FIELD\nTill soil with the Hoe, plant seeds, and water them every day. Ripe crops go in the shipping box by the house.')]),
  obj('animal_pen', 'pen', 3, 31, 7, 4), // where the animals wander
  obj('road_sign', 'sign', 13, 35, 1, 1, [prop('text', 'string', 'SOUTH: Town\nThe road is closed for repairs. Come back another season!')]),
];

const tileLayer = (id, name, data) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  compressionlevel: -1,
  type: 'map', version: '1.10', tiledversion: '1.10.2',
  orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
  width: W, height: H, tilewidth: SIZE, tileheight: SIZE,
  nextlayerid: 6, nextobjectid: nextId,
  layers: [
    tileLayer(1, 'Ground', ground),
    tileLayer(2, 'Soil', soil),
    tileLayer(3, 'Walls', walls),
    tileLayer(4, 'Above', above),
    { id: 5, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
  ],
  tilesets: [TILES, RANCH, SEASONS].map((set) => ({
    firstgid: FIRSTGID[set.NAME], name: set.NAME, image: '../assets/' + set.NAME + '.png',
    imagewidth: set.IMAGE_W, imageheight: set.IMAGE_H, tilewidth: SIZE, tileheight: SIZE,
    columns: set.COLS, tilecount: set.TILECOUNT, margin: set.MARGIN, spacing: set.SPACING,
    tiles: Object.keys(tileProps[set.NAME]).map(Number).sort((a, b) => a - b).map((id) => ({ id, properties: tileProps[set.NAME][id] })),
  })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(map));
console.log('Wrote', OUT);
