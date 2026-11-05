'use strict';
// Bayanihan Projects on the town map (owner, 6 Nov 2026: "We need to make it related to the town"). The map gives the
// places; the game draws what each project changes (src/19zzzz-bayanihan.js):
//   * the Bayanihan board, by the plaza's north-east corner (2 x 2, between the plaza and the Woodshop)
//   * the Old Bridge: a footbridge over the river west of the dock, x 6, from the clinic's lane down to the lane of
//     townhouses. Today it is broken: a stub of planks on each bank (y 32 and 35), the river between (y 33-34), and a
//     path to it from each side. Built, the game lays the planks in between (the tile in 'fix').
//   * the Plaza Fountain (the fountain the plaza has), the Chapel Bell (a bell frame beside the chapel), the Old Pier (the
//     water at the pier's end, where the game lays planks out to the boat) and the boat; the Market Hall's roof goes
//     over the market stall (point bh_hall: its top-left).
// make-map.js does the same for a freshly made town (bayanihanTown()); the town map is edited by hand, so this patches
// the existing maps/town.json. Safe to run twice: node tools/bayanihan-town.js
const fs = require('fs');
const path = require('path');
const { TILES } = require('./tiles');

const S = 256;
const prop = (name, type, value) => ({ name, type, value });
const BH_TOWN = {
  paths: [[6, 29, 6, 31], [6, 36, 6, 39]], // up to the bridge from the clinic's lane, and down to the townhouses' lane
  stubs: [[6, 32], [6, 35]], // what is left of the old bridge, one on each bank
  rects: [
    ['bh_board', 24, 13, 2, 2], ['bh_bridge', 6, 33, 1, 2], ['bh_fountain', 13, 16, 3, 2], ['bh_bell', 7, 45, 1, 2],
    ['bh_pier', 42, 38, 3, 4], ['bh_boat', 45, 40, 3, 2],
  ],
  points: [['bh_hall', 8.55, 12.05]],
};

// For make-map.js: the same on a MapBuilder.
function bayanihanTown(m) {
  const R = BH_TOWN, dock = TILES.T.dock;
  R.paths.forEach(([x0, y0, x1, y1]) => { m.rect('Walls', x0, y0, x1, y1, null, 0); m.rect('Above', x0, y0, x1, y1, null, 0); m.rect('Ground', x0, y0, x1, y1, 'tiles', TILES.T.path); });
  R.stubs.forEach(([x, y]) => m.put('Ground', x, y, 'tiles', dock));
  R.rects.forEach(([name, x, y, w, h]) => m.obj(name, name, x, y, w, h, [prop('fix', 'int', 1 + dock)]));
  R.points.forEach(([name, x, y]) => m.point(name, 'place', x, y));
}
// keep make-map.js's random bushes off the paths to the bridge
const bayanihanKeep = (x, y) => x === 6 && y >= 28 && y <= 40;

function patch(file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const objects = m.layers.find((l) => l.type === 'objectgroup').objects;
  if (objects.some((o) => o.name === 'bh_board')) return false;
  const R = BH_TOWN, first = m.tilesets.find((t) => t.name === 'tiles').firstgid, W = m.width;
  const layer = (name) => m.layers.find((l) => l.name === name).data;
  const rect = (name, x0, y0, x1, y1, gid) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) layer(name)[y * W + x] = gid; };
  R.paths.forEach(([x0, y0, x1, y1]) => { rect('Walls', x0, y0, x1, y1, 0); rect('Above', x0, y0, x1, y1, 0); rect('Ground', x0, y0, x1, y1, TILES.T.path + first); });
  R.stubs.forEach(([x, y]) => rect('Ground', x, y, x, y, TILES.T.dock + first));
  let id = m.nextobjectid;
  const add = (o) => objects.push({ id: id++, rotation: 0, visible: true, ...o });
  R.rects.forEach(([name, x, y, w, h]) => add({ name, type: name, x: x * S, y: y * S, width: w * S, height: h * S, properties: [prop('fix', 'int', TILES.T.dock + first)] }));
  R.points.forEach(([name, x, y]) => add({ name, type: 'place', point: true, x: Math.round(x * S), y: Math.round(y * S), width: 0, height: 0 }));
  m.nextobjectid = id;
  fs.writeFileSync(file, JSON.stringify(m));
  return true;
}

module.exports = { BH_TOWN, bayanihanTown, bayanihanKeep };

if (require.main === module) {
  const file = path.join(__dirname, '..', 'maps', 'town.json');
  console.log(patch(file) ? 'town.json: added the Bayanihan places and the broken Old Bridge' : 'town.json already has the Bayanihan places');
}
