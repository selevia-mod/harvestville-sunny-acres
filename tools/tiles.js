'use strict';
// Shared tileset layout: used by make-art.js (drawing) and make-map.js (map + tile properties).
// Every tile is 256x256. Tiles sit in a padded grid (MARGIN around the sheet, SPACING between
// tiles) and each tile's edge pixels are extruded into the padding, so neighbouring tiles never
// bleed into each other when the GPU scales them down. The sheet is a power of two for mipmaps.
const SIZE = 256;
const MARGIN = 8;
const SPACING = 16;
const COLS = 7;
const IMAGE_W = 2048;

// Multi-tile pictures, in tile units inside the tileset image.
const BLOCKS = {
  house: { col: 0, row: 0, w: 5, h: 4 },
  shop: { col: 0, row: 4, w: 6, h: 4 },
  pond: { col: 0, row: 8, w: 5, h: 4 },
};

// Single tiles fill the free cells left around the blocks, in this order.
const SINGLES = [
  'grass', 'grass2', 'grass3', 'flowers', 'field', 'tilled', 'tilledWet', 'path', 'water',
  'fenceH', 'fenceV', 'fencePost', 'treeTL', 'treeTR', 'treeBL', 'treeBR',
  'bush', 'rock', 'stump', 'tallgrass', 'shipbox', 'sign',
];

const used = new Set();
Object.values(BLOCKS).forEach((b) => {
  for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) used.add((b.row + dy) * COLS + b.col + dx);
});
const T = {};
let next = 0;
SINGLES.forEach((name) => {
  while (used.has(next)) next++;
  T[name] = next;
  used.add(next);
});

const ROWS = Math.ceil((Math.max(...used) + 1) / COLS);
const pow2 = (n) => 2 ** Math.ceil(Math.log2(n));
const IMAGE_H = pow2(MARGIN * 2 + ROWS * (SIZE + SPACING) - SPACING);
// Tiled and Phaser derive the grid from the image size, so count the tiles the same way.
const GRID_COLS = Math.floor((IMAGE_W - MARGIN * 2 + SPACING) / (SIZE + SPACING));
const GRID_ROWS = Math.floor((IMAGE_H - MARGIN * 2 + SPACING) / (SIZE + SPACING));
if (GRID_COLS !== COLS) throw new Error('tileset width does not give ' + COLS + ' columns');

function blockId(name, dx, dy) {
  const b = BLOCKS[name];
  return (b.row + dy) * COLS + b.col + dx;
}

function cellXY(id) {
  return [MARGIN + (id % COLS) * (SIZE + SPACING), MARGIN + Math.floor(id / COLS) * (SIZE + SPACING)];
}

module.exports = {
  SIZE, MARGIN, SPACING, COLS, ROWS, IMAGE_W, IMAGE_H, TILECOUNT: GRID_COLS * GRID_ROWS,
  T, BLOCKS, blockId, cellXY,
};
