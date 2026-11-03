'use strict';
// Willowbrook Station (4 Nov 2026) on the town map: up the lane between the Florist and the Post Office, north of Market
// Street. The building, the rails, the train and the crates are drawn by the game (src/19zz-town.js); the map gives
// the ground (a stone platform, two lanes from Market Street), clears the trees and bushes there, and holds the
// places: the station (5 x 4), the rails (12 x 2, out past the east edge), the cargo on the platform (6 x 1), and points
// for the station's front and the platform.
// make-map.js does the same for a freshly made town (station()); the town map is edited by hand, so this patches the
// existing maps/town.json. Safe to run twice: node tools/town-station.js
const fs = require('fs');
const path = require('path');
const { TILES } = require('./tiles');

const S = 256;
const STATION = {
  clear: [[35, 2, 51, 6], [52, 2, 53, 3], [39, 7, 39, 10], [51, 7, 51, 10]], // no trees, bushes or tall grass here
  platform: [42, 4, 51, 5], // stone, where the train stops
  paths: [[37, 6, 44, 6], [39, 7, 39, 10], [51, 6, 51, 10]], // in front of the station, and the lanes down to Market Street
  rects: [['station', 'station', 37, 2, 5, 4], ['rails', 'rails', 42, 2, 12, 2], ['cargo', 'cargo', 46, 4, 6, 1]],
  points: [['station_front', 39.5, 6.6], ['platform_w', 43.5, 5.6], ['platform_e', 49.5, 5.6]],
};

// For make-map.js: the same on a MapBuilder.
function station(m) {
  STATION.clear.forEach(([x0, y0, x1, y1]) => { m.rect('Walls', x0, y0, x1, y1, null, 0); m.rect('Above', x0, y0, x1, y1, null, 0); });
  m.rect('Ground', ...STATION.platform, 'tiles', TILES.T.plaza);
  STATION.paths.forEach(([x0, y0, x1, y1]) => m.rect('Ground', x0, y0, x1, y1, 'tiles', TILES.T.path));
  STATION.rects.forEach(([name, type, x, y, w, h]) => m.obj(name, type, x, y, w, h));
  STATION.points.forEach(([name, x, y]) => m.point(name, 'place', x, y));
}
// keep make-map.js's random bushes off the station's ground
const stationKeep = (x, y) => x >= 35 && y >= 2 && y <= 10 && (y <= 6 || x === 39 || x === 51);

function patch(file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const objects = m.layers.find((l) => l.type === 'objectgroup').objects;
  if (objects.some((o) => o.name === 'station')) return false;
  const first = m.tilesets.find((t) => t.name === 'tiles').firstgid, W = m.width;
  const layer = (name) => m.layers.find((l) => l.name === name).data;
  const rect = (name, x0, y0, x1, y1, gid) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) layer(name)[y * W + x] = gid; };
  STATION.clear.forEach(([x0, y0, x1, y1]) => { rect('Walls', x0, y0, x1, y1, 0); rect('Above', x0, y0, x1, y1, 0); });
  rect('Ground', ...STATION.platform, TILES.T.plaza + first);
  STATION.paths.forEach(([x0, y0, x1, y1]) => rect('Ground', x0, y0, x1, y1, TILES.T.path + first));
  let id = m.nextobjectid;
  const add = (o) => objects.push({ id: id++, rotation: 0, visible: true, ...o });
  STATION.rects.forEach(([name, type, x, y, w, h]) => add({ name, type, x: x * S, y: y * S, width: w * S, height: h * S }));
  STATION.points.forEach(([name, x, y]) => add({ name, type: 'place', point: true, x: Math.round(x * S), y: Math.round(y * S), width: 0, height: 0 }));
  m.nextobjectid = id;
  fs.writeFileSync(file, JSON.stringify(m));
  return true;
}

module.exports = { STATION, station, stationKeep };

if (require.main === module) {
  const file = path.join(__dirname, '..', 'maps', 'town.json');
  console.log(patch(file) ? 'town.json: added Willowbrook Station' : 'town.json already has the station');
}
