'use strict';
// One-off (owner, 2 Nov 2026): the farm map grows from 38 to 64 tiles wide for the six land blocks on its right side.
// maps/farm.json is the source of truth; this ran once and refuses to run again. The old tree line at x = 36, 37 stays,
// with one tree gone at the end of a new track from the road. Blocks and prices: src/00-zzland.js.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'maps', 'farm.json');
const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const OLD = 38, W = 64, H = m.height;
if (m.width !== OLD) throw new Error('already ' + m.width + ' wide');

let a = 2011; // the same grass every run
const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
const GRASS = () => { const r = rnd(); return r < 0.76 ? 6 : r < 0.9 ? 7 : r < 0.96 ? 13 : 14; };
const PATH = 28, SIGN = 86, TREE = { aboveL: 62, aboveR: 63, wallL: 69, wallR: 70 };

const grid = {};
m.layers.filter((l) => l.type === 'tilelayer').forEach((l) => {
  const data = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < OLD) data[y * W + x] = l.data[y * OLD + x];
    else if (l.name === 'Ground') data[y * W + x] = GRASS();
  }
  l.data = data;
  l.width = W;
  grid[l.name] = data;
});
const put = (layer, x, y, gid) => { grid[layer][y * W + x] = gid; };
const tree = (x, base) => { put('Walls', x, base, TREE.wallL); put('Walls', x + 1, base, TREE.wallR); put('Above', x, base - 1, TREE.aboveL); put('Above', x + 1, base - 1, TREE.aboveR); };

for (let x = 38; x < W; x += 2) tree(x, 1); // the top edge
for (let x = 36; x < W; x += 2) tree(x, 37); // the bottom edge
for (let y = 3; y <= 35; y += 2) tree(62, y); // the new right edge
// the way in: one tree of the old line goes, at the end of a track along the road's side branch
['Walls', 'Above'].forEach((l) => { [36, 37].forEach((x) => { put(l, x, 33, 0); put(l, x, 32, 0); }); });
for (let x = 18; x <= 39; x++) { put('Ground', x, 32, PATH); put('Ground', x, 33, PATH); }
// tracks around the blocks
for (let y = 2; y <= 35; y++) { put('Ground', 39, y, PATH); put('Ground', 50, y, PATH); put('Ground', 61, y, PATH); }
[2, 13, 24, 35].forEach((y) => { for (let x = 39; x <= 61; x++) put('Ground', x, y, PATH); });
// water for the can, out here: the farm pond's 5 by 4 block, twice, where the tree line was. It reaches two tiles into
// the meadow; a yard piece standing there is moved by L.yardRepair.
[10, 20].forEach((y) => {
  ['Walls', 'Above'].forEach((l) => { [36, 37].forEach((x) => { for (let r = y; r < y + 4; r++) put(l, x, r, 0); }); });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) put('Walls', 34 + c, y + r, 57 + r * 7 + c);
});
put('Walls', 38, 31, SIGN);

// the field's fence leaves the map: it is 60 yard pieces now, so you can move it (C.LAND.fence, 01-logicE.js)
for (let x = 3; x <= 20; x++) { put('Walls', x, 10, 0); put('Walls', x, 25, 0); }
for (let y = 11; y <= 24; y++) { put('Walls', 3, y, 0); put('Walls', 20, y, 0); }

// the fence and sign tiles get names, so the game can find them
const tiles = m.tilesets[0].tiles;
[[41, 'fence_h'], [48, 'fence_v'], [55, 'fence_post'], [85, 'land_sign']].forEach(([id, name]) => {
  tiles.filter((t) => t.id === id)[0].properties.push({ name: 'name', type: 'string', value: name });
});

const objects = m.layers.filter((l) => l.name === 'Objects')[0].objects;
objects.push({
  id: m.nextobjectid++, name: 'land_sign', type: 'sign', x: 38 * 256, y: 31 * 256, width: 256, height: 256, rotation: 0, visible: true,
  properties: [{ name: 'text', type: 'string', value: 'THE BACK FIELDS\nSix blocks of land, 10 by 10 tiles each, fenced until you buy them. Find the For Sale signs: they sell one at a time and each costs twice the last. Crops and decorations work here as they do at home, and the ponds fill your can.' }],
});
m.width = W;
fs.writeFileSync(FILE, JSON.stringify(m));
console.log('farm.json is now', W, 'x', H);
