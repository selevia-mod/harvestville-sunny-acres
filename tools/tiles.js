'use strict';
// Shared tileset layout: tile ids used by make-art.js (drawing) and make-map.js (map + tile properties).
const COLS = 16;
const ROWS = 6;

const T = {
  grass: 0, grass2: 1, grass3: 2, field: 3, tilled: 4, tilledWet: 5, path: 6, water: 7,
  fenceH: 8, fenceV: 9, fencePost: 10, treeTL: 11, treeTR: 12, treeBL: 13, treeBR: 14, bush: 15,
  rock: 16, shipbox: 17, sign: 18, flowers: 19, tallgrass: 20, stump: 21,
};

// Multi-tile pictures, in tile units inside the tileset image.
const BLOCKS = {
  house: { col: 0, row: 2, w: 5, h: 4 },
  pond: { col: 5, row: 2, w: 5, h: 4 },
  shop: { col: 10, row: 2, w: 6, h: 4 },
};

function blockId(name, dx, dy) {
  const b = BLOCKS[name];
  return (b.row + dy) * COLS + b.col + dx;
}

module.exports = { COLS, ROWS, SIZE: 16, T, BLOCKS, blockId };
