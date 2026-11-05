'use strict';
// The way to Central Park on the town map (owner, 6 Nov 2026: "I am seeing this dead end path way in the right side of
// mining we can use that, if users goes that it will drag to Central Park"). The dead end is the stub of path west of
// the Station's front (x 37-38, y 6), north-east of the mine. It goes on two tiles west and turns north up a short road,
// through a gap in the tree line at the top of the map (two trees out, a bush each side), with an arch over it, to the
// map's top edge, where walking off takes you to the park (as the road north takes you to the farm). Nothing else in
// town moves: no door, spawn or place changes, so a save standing in town stays where it is.
// make-map.js does the same for a freshly made town (parkRoad()); the town map is edited by hand, so this patches the
// existing maps/town.json. Safe to run twice: node tools/park-town.js
const fs = require('fs');
const path = require('path');
const { TILES, PROPS } = require('./tiles');

const S = 256;
const prop = (name, type, value) => ({ name, type, value });
const PARK_ROAD = {
  clear: [34, 0, 37, 1], // the two trees at the top edge (x 34-35 and 36-37), out of the way
  bushes: [[34, 0], [34, 1], [37, 0], [37, 1]], // a bush each side of the gap, so the tree line stays closed beside it
  paths: [[35, 0, 36, 6]], // the road, up from the end of the dead end (the stub ends at x 37)
  sign: [34, 3],
  text: 'CENTRAL PARK\nUp this road: a park for everyone in Harvest Ville. Meet other farmers by the fountain, and see the Hall of Fame.',
  spawn: [36, 1.6], // coming back from the park: just inside the gap, facing town
  warp: [35, 0, 2, 1],
  arch: [34.5, 3], // the flower arch over the road (its bottom-left, in tiles): centred on the road's two tiles
};

// For make-map.js: the same on a MapBuilder.
function parkRoad(m) {
  const R = PARK_ROAD, [cx0, cy0, cx1, cy1] = R.clear;
  m.rect('Walls', cx0, cy0, cx1, cy1, null, 0);
  m.rect('Above', cx0, cy0, cx1, cy1, null, 0);
  R.bushes.forEach(([x, y]) => m.put('Walls', x, y, 'tiles', TILES.T.bush));
  R.paths.forEach(([x0, y0, x1, y1]) => m.rect('Ground', x0, y0, x1, y1, 'tiles', TILES.T.path));
  m.put('Walls', R.sign[0], R.sign[1], 'tiles', TILES.T.sign);
  m.point('from_park', 'spawn', R.spawn[0], R.spawn[1], [prop('dir', 'string', 'down')]);
  m.obj('park_road', 'warp', ...R.warp, [prop('to', 'string', 'park'), prop('spawn', 'string', 'from_town'), prop('walk', 'bool', true)]);
  m.obj('park_sign', 'sign', R.sign[0], R.sign[1], 1, 1, [prop('text', 'string', R.text)]);
  m.prop('flower_arch', R.arch[0], R.arch[1] - PROPS.flower_arch.h);
}

function patch(file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const objects = m.layers.find((l) => l.type === 'objectgroup').objects;
  if (objects.some((o) => o.name === 'park_road')) return false;
  const R = PARK_ROAD, first = m.tilesets.find((t) => t.name === 'tiles').firstgid, W = m.width;
  const layer = (name) => m.layers.find((l) => l.name === name).data;
  const rect = (name, x0, y0, x1, y1, gid) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) layer(name)[y * W + x] = gid; };
  const [cx0, cy0, cx1, cy1] = R.clear;
  rect('Walls', cx0, cy0, cx1, cy1, 0);
  rect('Above', cx0, cy0, cx1, cy1, 0);
  R.bushes.forEach(([x, y]) => rect('Walls', x, y, x, y, TILES.T.bush + first));
  R.paths.forEach(([x0, y0, x1, y1]) => rect('Ground', x0, y0, x1, y1, TILES.T.path + first));
  rect('Walls', R.sign[0], R.sign[1], R.sign[0], R.sign[1], TILES.T.sign + first);
  const propSet = m.tilesets.find((t) => t.name === 'props');
  const arch = propSet.tiles.find((t) => /\/flower_arch\.png$/.test(t.image));
  if (!arch) throw new Error('town.json has no flower_arch in its props');
  let id = m.nextobjectid;
  const add = (o) => objects.push({ id: id++, rotation: 0, visible: true, ...o });
  add({ name: 'from_park', type: 'spawn', point: true, x: Math.round(R.spawn[0] * S), y: Math.round(R.spawn[1] * S), width: 0, height: 0, properties: [prop('dir', 'string', 'down')] });
  add({ name: 'park_road', type: 'warp', x: R.warp[0] * S, y: R.warp[1] * S, width: R.warp[2] * S, height: R.warp[3] * S,
    properties: [prop('to', 'string', 'park'), prop('spawn', 'string', 'from_town'), prop('walk', 'bool', true)] });
  add({ name: 'park_sign', type: 'sign', x: R.sign[0] * S, y: R.sign[1] * S, width: S, height: S, properties: [prop('text', 'string', R.text)] });
  add({ name: 'flower_arch', type: 'prop', gid: propSet.firstgid + arch.id, x: R.arch[0] * S, y: R.arch[1] * S,
    width: PROPS.flower_arch.w * S, height: PROPS.flower_arch.h * S });
  m.nextobjectid = id;
  fs.writeFileSync(file, JSON.stringify(m));
  return true;
}

module.exports = { PARK_ROAD, parkRoad };

if (require.main === module) {
  const file = path.join(__dirname, '..', 'maps', 'town.json');
  console.log(patch(file) ? 'town.json: added the road to Central Park' : 'town.json already has the road to Central Park');
}
