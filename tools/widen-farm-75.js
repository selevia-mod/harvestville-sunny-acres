'use strict';
// One-off (owner, 12 Nov 2026: lands 7, 8 and 9, docs/superpowers/specs/2026-11-12-lands-7-9-design.md): the farm map
// grows from 64 to 75 tiles wide for a third column of 10 x 10 blocks. maps/farm.json is the source of truth; this ran
// once and refuses to run again (as tools/widen-farm.js, which took it from 38 to 64). The tree line at x 62-63 goes: x 61
// stays a track, the new blocks are x 62-71 (rows 3-12, 14-23, 25-34), a track at x 72, the new tree line x 73-74.
// Blocks and prices: src/00-zzland.js. Saves and friends' snapshots from the 64-wide farm are moved on load (fw).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'maps', 'farm.json');
const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const OLD = 64, W = 75, H = m.height;
if (m.width !== OLD) throw new Error('already ' + m.width + ' wide');

let a = 2075; // the same grass every run
const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
const GRASS = () => { const r = rnd(); return r < 0.76 ? 6 : r < 0.9 ? 7 : r < 0.96 ? 13 : 14; };
const PATH = 28, TREE = { aboveL: 62, aboveR: 63, wallL: 69, wallR: 70 };

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

// the old right edge goes (its trees on rows 2-35; the top and bottom rows' trees stay)
for (let y = 2; y <= 35; y++) [62, 63].forEach((x) => { put('Walls', x, y, 0); put('Above', x, y, 0); });
for (let x = 64; x <= 72; x += 2) { tree(x, 1); tree(x, 37); } // the top and bottom edges, on to x 73
for (let y = 3; y <= 35; y += 2) tree(73, y); // the new right edge
// the tracks: down x 72, and across the four rows from x 61
for (let y = 2; y <= 35; y++) put('Ground', 72, y, PATH);
[2, 13, 24, 35].forEach((y) => { for (let x = 61; x <= 72; x++) put('Ground', x, y, PATH); });

const sign = m.layers.filter((l) => l.name === 'Objects')[0].objects.filter((o) => o.name === 'land_sign')[0];
const text = sign && sign.properties.filter((p) => p.name === 'text')[0];
if (text) text.value = 'THE BACK FIELDS\nNine blocks of land, 10 by 10 tiles each, fenced until you buy them. Find the For Sale signs: they sell one at a time. The last three take Pearls from The Lost Tower too. Crops and decorations work here as they do at home, and the ponds fill your can.';
m.width = W;
fs.writeFileSync(FILE, JSON.stringify(m));
console.log('farm.json is now', W, 'x', H);
