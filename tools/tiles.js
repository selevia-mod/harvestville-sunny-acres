'use strict';
// Shared tileset layouts: used by make-art.js (drawing) and make-map.js (map + tile properties).
// Every tile is 256x256. Tiles sit in a padded grid (MARGIN around the sheet, SPACING between
// tiles) and each tile's edge pixels are extruded into the padding, so neighbouring tiles never
// bleed into each other when the GPU scales them down. Sheets are powers of two for mipmaps.
const SIZE = 256;
const MARGIN = 8;
const SPACING = 16;
const pow2 = (n) => 2 ** Math.ceil(Math.log2(n));

// blocks: multi-tile pictures placed at fixed cells; singles fill the free cells in order.
function layout(name, cols, imageW, blocks, singles) {
  const used = new Set();
  Object.values(blocks).forEach((b) => {
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) used.add((b.row + dy) * cols + b.col + dx);
  });
  const T = {};
  let next = 0;
  singles.forEach((s) => {
    while (used.has(next)) next++;
    T[s] = next;
    used.add(next);
  });
  const rows = Math.ceil((Math.max(...used) + 1) / cols);
  const imageH = pow2(MARGIN * 2 + rows * (SIZE + SPACING) - SPACING);
  // Tiled and Phaser derive the grid from the image size, so count the tiles the same way.
  const gridCols = Math.floor((imageW - MARGIN * 2 + SPACING) / (SIZE + SPACING));
  const gridRows = Math.floor((imageH - MARGIN * 2 + SPACING) / (SIZE + SPACING));
  if (gridCols !== cols) throw new Error(`${name}: image width does not give ${cols} columns`);
  return {
    NAME: name, SIZE, MARGIN, SPACING, COLS: cols, ROWS: rows, IMAGE_W: imageW, IMAGE_H: imageH,
    TILECOUNT: gridCols * gridRows, T, BLOCKS: blocks,
  };
}

const TILES = layout('tiles', 7, 2048, {
  house: { col: 0, row: 0, w: 5, h: 4 },
  shop: { col: 0, row: 4, w: 6, h: 4 },
  pond: { col: 0, row: 8, w: 5, h: 4 },
}, [
  'grass', 'grass2', 'grass3', 'flowers', 'field', 'tilled', 'tilledWet', 'path', 'water',
  'fenceH', 'fenceV', 'fencePost', 'treeTL', 'treeTR', 'treeBL', 'treeBR',
  'bush', 'rock', 'stump', 'tallgrass', 'shipbox', 'sign',
]);

const RANCH = layout('ranch', 3, 1024, {
  barn: { col: 0, row: 0, w: 3, h: 3 },
  coop: { col: 0, row: 3, w: 2, h: 2 },
}, ['hay', 'trough']);

// Every season's version of the tiles that change with the seasons, laid out season by season.
// The map is drawn with the spring tiles from TILES; the game swaps them for the current season.
const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter'];
const SEASONAL = ['grass', 'grass2', 'grass3', 'flowers', 'field', 'path', 'treeTL', 'treeTR', 'treeBL', 'treeBR', 'bush', 'tallgrass'];
const SEASONS = layout('seasons', 7, 2048, {}, [].concat(...SEASON_NAMES.map((s) => SEASONAL.map((k) => s + '_' + k))));

function blockId(set, name, dx, dy) {
  const b = set.BLOCKS[name];
  return (b.row + dy) * set.COLS + b.col + dx;
}

module.exports = { SIZE, MARGIN, SPACING, TILES, RANCH, SEASONS, SEASON_NAMES, SEASONAL, TILESETS: [TILES, RANCH, SEASONS], blockId };
