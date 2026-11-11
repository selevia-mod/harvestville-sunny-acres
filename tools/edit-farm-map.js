// Edit Farm part 1 (docs/edit-farm.md): the farm map keeps only its frame (grass, border trees, the road, the signs,
// the land blocks). The farmhouse, the ranch, the ponds, Lily's stand, the stable, the dog's yard, their objects and
// the field leave the map: they are yard pieces now (src/00-zzzzzzzzzzzzzzzzzz-buildings.js), placed on every farm
// where the map had them (src/01-logicZZZZZZZZZZZZZ-buildings.js). The map as it was: test/fixtures/
// farm-map-before-edit-farm.json. Run once: node tools/edit-farm-map.js (it refuses a map already done).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'maps', 'farm.json');
const map = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if ((map.properties || []).some((p) => p.name === 'editFarm')) { console.log('already done'); process.exit(0); }
const W = map.width, layer = (n) => map.layers.find((l) => l.name === n);
const props = {};
map.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
const P = (g) => props[g] || {};
const ground = layer('Ground'), walls = layer('Walls'), above = layer('Above');
// the farm's grass: the most common plain Ground tile
const count = {};
ground.data.forEach((g) => { if (g && !P(g).tillable && !P(g).water && !P(g).path) count[g] = (count[g] || 0) + 1; });
const GRASS = Number(Object.keys(count).sort((a, b) => count[b] - count[a])[0]);
let cleared = 0;
const clear = (x0, y0, x1, y1, alsoAbove) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (walls.data[y * W + x]) { walls.data[y * W + x] = 0; cleared++; }
    if (alsoAbove && above && above.data[y * W + x]) { above.data[y * W + x] = 0; cleared++; }
  }
};
clear(4, 3, 9, 6, true); // the farmhouse and its mailbox's column (a tuft of grass stood at (9,3))
clear(11, 5, 14, 9, true); // the dog's yard
clear(18, 32, 20, 35, true); // the stable's spot
clear(2, 27, 10, 35, true); // the ranch: barn, coop, trough, hay, the pen's fence
clear(14, 28, 19, 31, true); // Lily's stand
walls.data.forEach((g, i) => { if (P(g).water) { walls.data[i] = 0; cleared++; } }); // the ponds
ground.data.forEach((g, i) => { if (P(g).tillable || P(g).water) { ground.data[i] = GRASS; cleared++; } }); // the field
const GONE = new Set(['house_door', 'spawn', 'mailbox', 'seed_shop', 'animal_pen', 'dog_yard', 'incubator', 'horse', 'doghouse', 'stable']);
const og = map.layers.find((l) => l.type === 'objectgroup');
const before = og.objects.length;
og.objects = og.objects.filter((o) => !GONE.has(o.name));
(map.properties = map.properties || []).push({ name: 'editFarm', type: 'int', value: 1 });
fs.writeFileSync(FILE, JSON.stringify(map));
console.log('farm map: ' + cleared + ' tiles cleared, ' + (before - og.objects.length) + ' objects removed, grass gid ' + GRASS);
