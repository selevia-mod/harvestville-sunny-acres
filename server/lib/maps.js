// A cave's map, read from maps/<map>.json (Tiled JSON) the way the game's world reads it (src/11-world.js):
//   - walkable: no tile of any tile layer has `collides` (buildMap: setCollisionByProperty({ collides: true })), and
//     the tile is not under the solid foot of a prop (addProp: a props tile's `foot` rows, unless `flat`; Banaue's own
//     drawn props, 19zzzzzz-place-11-banaue.js addPlaceProp, by their object's `foot`);
//   - the `wild` zone object, in tiles (buildObjects' rect);
//   - the gate down (lair_gate / dungeon_gate), which is not ground for a monster (19zt-lair.js wildFree).
// A city (Manila: C.MANILA) has no file in maps/: the game builds its map from its layout at run time (L.manilaMap, from
// the town's sheets), and so does this.
'use strict';
const fs = require('fs');
const path = require('path');

const FLIP = 0x1fffffff; // (Tiled keeps flip flags in a gid's top bits)

const propsOf = (list) => {
  const out = {};
  if (Array.isArray(list)) list.forEach((p) => { out[p.name] = p.value; });
  else if (list) Object.keys(list).forEach((k) => { out[k] = list[k]; });
  return out;
};

// One rect object in tiles, as buildObjects makes it.
const rectOf = (o, T) => ({
  x0: Math.floor(o.x / T), y0: Math.floor(o.y / T),
  x1: Math.ceil((o.x + o.width) / T) - 1, y1: Math.ceil((o.y + o.height) / T) - 1,
});

const fileOf = (R, key) => JSON.parse(fs.readFileSync(path.join(R.root, 'maps', key + '.json'), 'utf8'));
const cityMap = (R, key) => (R.C.MANILA && key === R.C.MANILA.key && R.L.manilaMap ? R.L.manilaMap(fileOf(R, 'town')) : null);

function readMap(R, key) {
  const T = R.T, raw = cityMap(R, key) || fileOf(R, key);
  const W = raw.width, H = raw.height;
  const sets = raw.tilesets.slice().sort((a, b) => a.firstgid - b.firstgid);
  const tileProps = {}; // gid -> its properties
  sets.forEach((ts) => (ts.tiles || []).forEach((t) => { tileProps[ts.firstgid + t.id] = propsOf(t.properties); }));

  // walls: any tile layer's tile that collides
  const wall = new Uint8Array(W * H);
  raw.layers.forEach((l) => {
    if (l.type !== 'tilelayer') return;
    const cond = propsOf(l.properties);
    if (cond.requires) return; // (a layer only shown with a building: never in a cave)
    (l.data || []).forEach((gid, i) => {
      const p = gid ? tileProps[gid & FLIP] : null;
      if (p && p.collides) wall[i] = 1;
    });
  });

  // objects: the zone, the gate, solid props
  const blocked = new Uint8Array(W * H);
  const block = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) blocked[y * W + x] = 1; };
  const propSet = raw.tilesets.filter((ts) => ts.name === 'props')[0];
  const banaue = R.L.placeOf(key) === 'banaue', bprops = R.F.BANAUE_PROPS || {};
  let zone = null, gate = null;
  const group = raw.layers.filter((l) => l.type === 'objectgroup')[0];
  (group ? group.objects : []).forEach((o) => {
    const type = o.type || o.class || '', props = propsOf(o.properties);
    if (props.requires) return;
    if (o.gid && propSet) { // a prop: solid at its foot
      const tile = (propSet.tiles || []).filter((t) => t.id === (o.gid & FLIP) - propSet.firstgid)[0];
      const tp = tile ? propsOf(tile.properties) : {};
      const foot = tp.foot || 0;
      if (!tile || !foot || tp.flat) return;
      const x0 = Math.round(o.x / T), w = Math.round(o.width / T), y1 = Math.round(o.y / T) - 1;
      for (let y = y1 - foot + 1; y <= y1; y++) for (let x = x0; x < x0 + w; x++) block(x, y);
      return;
    }
    if (o.point) return;
    const r = rectOf(o, T);
    if (type === 'wild') zone = zone || r;
    else if (type === 'lair_gate' || type === 'dungeon_gate') gate = r;
    else if (type === 'place_prop' && banaue && bprops[o.name] && props.foot) {
      for (let y = r.y1 - props.foot + 1; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) block(x, y);
    }
  });

  const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !wall[y * W + x] && !blocked[y * W + x];
  return { key, W, H, T, zone, gate, walkable };
}

// What a monster may stand on, for one floor: in the zone, walkable, not the gate (floor < the last: it has one).
function floorGround(m, withGate) {
  const z = m.zone, free = new Uint8Array(m.W * m.H), g = withGate ? m.gate : null;
  if (!z) return free;
  for (let y = 0; y < m.H; y++) {
    for (let x = 0; x < m.W; x++) {
      if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) continue;
      if (g && x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1) continue;
      if (m.walkable(x, y)) free[y * m.W + x] = 1;
    }
  }
  return free;
}

function makeMaps(R) {
  const cache = {};
  return {
    get(key) {
      if (!Object.prototype.hasOwnProperty.call(cache, key)) {
        try { cache[key] = readMap(R, key); } catch (e) { cache[key] = null; }
      }
      return cache[key];
    },
    floorGround,
  };
}

module.exports = { makeMaps, readMap, floorGround };
