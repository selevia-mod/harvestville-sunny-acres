'use strict';
// Adds the road to Pulag Grassland (the Wild Lands, 30 Oct 2026) to the existing maps/town.json, the same as wildRoad()
// in make-map.js does for a freshly made town. Safe to run twice. node tools/wild-town.js
const fs = require('fs');
const path = require('path');
const { TILES } = require('./tiles');

const file = path.join(__dirname, '..', 'maps', 'town.json');
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const objects = m.layers.find((l) => l.type === 'objectgroup').objects;
if (objects.some((o) => o.name === 'road_west')) { console.log('town.json already has the road to Pulag'); process.exit(0); }
const first = m.tilesets.find((t) => t.name === 'tiles').firstgid, S = 256, W = m.width;
const put = (layer, x, y, id) => { m.layers.find((l) => l.name === layer).data[y * W + x] = id + first; };
for (let x = 0; x <= 3; x++) put('Ground', x, 20, TILES.T.path);
put('Walls', 2, 21, TILES.T.sign);
const prop = (name, type, value) => ({ name, type, value });
let id = m.nextobjectid;
const add = (o) => objects.push({ id: id++, rotation: 0, visible: true, ...o });
add({ name: 'from_pulag', type: 'spawn', point: true, x: Math.round(1.5 * S), y: Math.round(20.6 * S), width: 0, height: 0, properties: [prop('dir', 'string', 'right')] });
add({ name: 'road_west', type: 'warp', x: 0, y: 20 * S, width: S, height: S, properties: [prop('to', 'string', 'pulag'), prop('spawn', 'string', 'from_town'), prop('walk', 'bool', true)] });
add({ name: 'pulag_sign', type: 'sign', x: 2 * S, y: 21 * S, width: S, height: S, properties: [prop('text', 'string', 'TO PULAG GRASSLAND\nWild animals roam the grassland to the west. Kanor the hunter has his Lodge there.')] });
m.nextobjectid = id;
fs.writeFileSync(file, JSON.stringify(m));
console.log('town.json: added the road to Pulag');
