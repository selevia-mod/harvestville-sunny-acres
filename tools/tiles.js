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
  // field debris (cleared with tools), plus town ground
  'd_weed', 'd_branch', 'd_stone', 'd_stump', 'd_boulder', 'dock', 'plaza',
  'sand', // the beach
  'wild_grass', 'wild_forest', 'wild_trail', // the Wild Lands (tools/art/wild-import.js paints them in)
  'wild_ash', 'wild_lava', // Magayon Peaks (tools/art/magayon-import.js)
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

// House interior and mine cave tiles.
// floor_k / wall_k / wall_low_k: the home's floors and wallpapers in style k (src/00-home.js; 0 is floor and wall)
const HOME_STYLES = 10;
const surfaces = [];
for (let k = 1; k < HOME_STYLES; k++) surfaces.push('floor_' + k, 'wall_' + k, 'wall_low_' + k);
const INDOOR = layout('indoor', 7, 2048, {}, [
  'floor', 'floor2', 'wall', 'wall_low', 'wall_side', 'void',
  'cave', 'cave2', 'cave_wall', 'cave_top', 'ladder_down', 'ladder_up', 'mine_rock',
].concat(surfaces));

// Props: furniture, town buildings and decorations, placed as image objects on maps.
// w x h in tiles; foot = solid rows at the bottom; door = [first column, width] of the door in the bottom row;
// flat props lie on the floor (no collision, drawn under people). Stored at half resolution (128 px per tile).
const PROPS = {
  bed: { w: 2, h: 2, foot: 2 }, bed2: { w: 3, h: 2, foot: 2 }, tv: { w: 1, h: 1, foot: 1 }, table: { w: 2, h: 2, foot: 1 },
  fireplace: { w: 2, h: 2, foot: 0 }, kitchen: { w: 3, h: 2, foot: 1 }, shelf: { w: 2, h: 2, foot: 0 },
  rug: { w: 3, h: 2, foot: 0, flat: true }, plant: { w: 1, h: 1, foot: 1 }, window: { w: 2, h: 1, foot: 0 },
  wall_calendar: { w: 1, h: 1, foot: 0 }, doormat: { w: 2, h: 1, foot: 0, flat: true }, dresser: { w: 2, h: 2, foot: 1 },
  mayor: { w: 6, h: 5, foot: 2, door: [2, 2] }, inn: { w: 6, h: 5, foot: 2, door: [2, 2] },
  forge: { w: 5, h: 4, foot: 2, door: [2, 1] }, woodshop: { w: 5, h: 4, foot: 2, door: [2, 1] },
  clinic: { w: 4, h: 4, foot: 2, door: [1, 2] }, cottage: { w: 4, h: 4, foot: 2, door: [1, 2] },
  cabin: { w: 4, h: 3, foot: 2, door: [1, 2] }, mine_entrance: { w: 4, h: 3, foot: 2, door: [1, 2] },
  fountain: { w: 3, h: 3, foot: 2 }, notice: { w: 2, h: 2, foot: 1 }, bench: { w: 2, h: 1, foot: 1 },
  lamp: { w: 1, h: 2, foot: 1 }, flowerbed: { w: 2, h: 1, foot: 1 },
  flower_arch: { w: 3, h: 2, foot: 0 }, lantern: { w: 1, h: 2, foot: 1 }, pumpkin_pile: { w: 2, h: 1, foot: 1 },
  festive_tree: { w: 2, h: 3, foot: 1 }, doghouse: { w: 2, h: 2, foot: 1 },
  farm_stand: { w: 2, h: 2, foot: 1 }, order_board: { w: 2, h: 2, foot: 1 },
  mailbox: { w: 1, h: 2, foot: 1 }, stable: { w: 3, h: 3, foot: 2 }, chest: { w: 1, h: 1, foot: 1 },
  aquarium: { w: 2, h: 2, foot: 1 }, music_box: { w: 1, h: 1, foot: 1 }, big_plant: { w: 1, h: 2, foot: 1 },
  cat_bed: { w: 1, h: 1, foot: 0, flat: true },
  house_2: { w: 5, h: 5, foot: 0 }, house_3: { w: 5, h: 5, foot: 0 }, house_4: { w: 5, h: 5, foot: 0 },
  house_5: { w: 5, h: 5, foot: 0 }, house_6: { w: 5, h: 5, foot: 0 }, house_7: { w: 5, h: 5, foot: 0 },
  house_8: { w: 5, h: 5, foot: 0 }, house_9: { w: 5, h: 5, foot: 0 }, house_10: { w: 5, h: 5, foot: 0 },
  // the bigger town: shops and homes (door = [first column, width] in the bottom row), park and beach things
  bakery: { w: 5, h: 4, foot: 2, door: [2, 1] }, florist: { w: 4, h: 4, foot: 2, door: [1, 2] },
  post: { w: 5, h: 4, foot: 2, door: [2, 1] }, library: { w: 6, h: 5, foot: 2, door: [2, 2] },
  school: { w: 6, h: 4, foot: 2, door: [2, 2] }, chapel: { w: 4, h: 5, foot: 2, door: [1, 2] },
  vet: { w: 5, h: 4, foot: 2, door: [2, 1] }, shack: { w: 4, h: 3, foot: 2, door: [1, 2] },
  townhouse_1: { w: 4, h: 4, foot: 2, door: [1, 2] }, townhouse_2: { w: 4, h: 4, foot: 2, door: [1, 2] },
  townhouse_3: { w: 4, h: 4, foot: 2, door: [1, 2] }, townhouse_4: { w: 4, h: 4, foot: 2, door: [1, 2] },
  wagon: { w: 3, h: 3, foot: 2 }, gazebo: { w: 4, h: 4, foot: 2 }, playground: { w: 4, h: 3, foot: 1 },
  fruit_stall: { w: 2, h: 2, foot: 1 }, cloth_stall: { w: 2, h: 2, foot: 1 }, statue: { w: 2, h: 3, foot: 1 },
  boat: { w: 3, h: 2, foot: 0, flat: true }, umbrella: { w: 2, h: 2, foot: 1 }, easel: { w: 1, h: 2, foot: 1 },
  trader_tent: { w: 3, h: 2, foot: 1 }, // shown by the game on the trader's days
  // the Wild Lands (tools/art/wild-import.js; stored at 160 px a tile)
  hunters_lodge: { w: 5, h: 4, foot: 2, door: [2, 1] }, tall_grass: { w: 1, h: 1, foot: 0 }, jungle_grass: { w: 1, h: 1, foot: 0 },
  bamboo_bush: { w: 2, h: 2, foot: 1 }, boulder_moss: { w: 2, h: 2, foot: 1 }, wildflowers: { w: 2, h: 1, foot: 0, flat: true },
  trail_sign: { w: 1, h: 2, foot: 1 }, fern_bush: { w: 2, h: 2, foot: 1 }, mossy_log: { w: 3, h: 2, foot: 1 },
  mud_spring: { w: 2, h: 2, foot: 1 }, mushroom_rock: { w: 1, h: 1, foot: 1 },
  pine_tree: { w: 2, h: 4, foot: 1 }, rainforest_tree: { w: 4, h: 4, foot: 2 },
  // Magayon Peaks (tools/art/magayon-import.js)
  lava_boulder: { w: 2, h: 2, foot: 1 }, hot_spring: { w: 2, h: 3, foot: 1 }, sulfur_vent: { w: 2, h: 3, foot: 1 },
  ash_fern: { w: 2, h: 2, foot: 1 }, abaca: { w: 2, h: 3, foot: 1 }, charred_log: { w: 3, h: 2, foot: 1 }, pili_tree: { w: 3, h: 5, foot: 1 },
};

function blockId(set, name, dx, dy) {
  const b = set.BLOCKS[name];
  return (b.row + dy) * set.COLS + b.col + dx;
}

module.exports = { HOME_STYLES, SIZE, MARGIN, SPACING, TILES, RANCH, SEASONS, INDOOR, PROPS, SEASON_NAMES, SEASONAL, TILESETS: [TILES, RANCH, SEASONS, INDOOR], blockId };
