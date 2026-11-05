'use strict';
// Banaue Terraces' two maps (owner, 6 Nov 2026; the place: src/00-zzzzzzzzzz-place-11-banaue.js), made by
// tools/make-map.js (npm run map -- --force=banaue, --force=banaue_cave).
//
// maps/banaue.json (32 x 30, about Pulag's size): a mountain of rice terraces seen from above, uphill to the north.
// Four terraces step down the slope; each is a band of grass to walk on, then a paddy (2 rows of water you cannot walk
// in, split into fields by mud dikes), then the stone wall that drops to the next terrace. Stone steps (2 wide) go down
// through each paddy and wall, zig-zagging from the village at the top to the jeep stop at the bottom left. At the top:
// Lola Bugan, the huts on stilts, a rice drying rack and the mouth of the Terrace Tunnels. A ring of trees round it all.
//
// Ground: the place's own small tileset, 'banaue_ground' (assets/banaue_ground.*, 3 x 2 tiles: grass, grass2, paddy,
// paddy2, dike, steps), so the owner's ground pictures (ground_banaue.png, ground_banaue_water.png) take the place of the
// stand-ins by tools/art/banaue-import.js alone: no map change. Its paddies are solid.
// Props: the place's six (props_banaue.png: wall, hut, fern, rack, boulder, grass) are objects of type 'place_prop',
// drawn by src/19zzzzzz-place-11-banaue.js (their own picture once it is in, a drawn stand-in until then). The object is
// the prop's footprint: its solid tiles (foot rows), or the one tile it stands on.
//
// maps/banaue_cave.json (18 x 16): the engine's placeCave layout, with an underground stream (the 'void' pools, painted
// as water by the game) down the east side and two pools, a rock pillar, mossy boulders and glowing mushroom rocks.
module.exports = function banaueMaps(h) {
  const { MapBuilder, rng, prop, T, wildRing, placeCave, caveMouth, SETS, tileProps } = h;

  // ---------- the ground tileset ----------
  const G = { grass: 0, grass2: 1, paddy: 2, paddy2: 3, dike: 4, steps: 5 };
  SETS.banaue_ground = { NAME: 'banaue_ground', SIZE: 256, MARGIN: 8, SPACING: 16, COLS: 3, ROWS: 2, IMAGE_W: 816, IMAGE_H: 544, TILECOUNT: 6, T: G, BLOCKS: {} };
  tileProps.banaue_ground = {};
  [G.paddy, G.paddy2].forEach((id) => { tileProps.banaue_ground[id] = [prop('collides', 'bool', true), prop('name', 'string', 'paddy')]; });

  const W = 32, H = 30;
  // the four terraces: [paddy's first row, its x from, its x to, the stairs' columns (each 2 wide), the dikes' columns]
  const TERRACES = [
    [5, 2, 29, [8, 24], [16]],
    [11, 2, 29, [14, 3], [7, 18]],
    [17, 2, 29, [6, 22], [12, 27]],
    [23, 12, 29, [17], [23]],
  ];
  const CHESTS = [[2, 2], [29, 9], [18, 11], [2, 15], [28, 27]]; // (keep in step with the place's data)
  const NPC = [12, 3];
  const CAVE_DOOR = [20, 2];

  function banaue() {
    const m = new MapBuilder('banaue', W, H, ['tiles', 'seasons', 'banaue_ground'], ['Ground', 'Walls', 'Above']);
    const r = rng(1101);
    m.rect('Ground', 0, 0, W - 1, H - 1, 'banaue_ground', () => (r() < 0.72 ? G.grass : G.grass2));
    wildRing(m, []);
    const keep = new Set(); // tiles nothing may stand on: chests, Lola Bugan, the ways through
    const hold = (x, y) => keep.add(y * W + x);
    CHESTS.forEach(([x, y]) => hold(x, y));
    hold(NPC[0], NPC[1]);
    hold(NPC[0], NPC[1] + 1); // (where you stand to talk to her)
    const taken = new Set(); // tiles a prop stands on
    const place = (name, x, y, w, hgt, foot) => {
      for (let dy = 0; dy < hgt; dy++) for (let dx = 0; dx < w; dx++) {
        const k = (y + dy) * W + x + dx;
        if (keep.has(k) || taken.has(k)) throw new Error(`banaue: ${name} at ${x},${y} is on a tile kept free`);
        taken.add(k);
      }
      m.obj(name, 'place_prop', x, y, w, hgt, foot != null ? [prop('foot', 'int', foot)] : undefined);
    };

    // ---------- the terraces: paddy, dikes, the wall below, the stone steps down ----------
    TERRACES.forEach(([py, x0, x1, stairs, dikes]) => {
      const stair = (x) => stairs.some((s) => x === s || x === s + 1);
      for (let x = x0; x <= x1; x++) {
        if (stair(x)) { m.rect('Ground', x, py, x, py + 2, 'banaue_ground', G.steps); continue; }
        if (dikes.indexOf(x) >= 0) m.rect('Ground', x, py, x, py + 1, 'banaue_ground', G.dike);
        else m.rect('Ground', x, py, x, py + 1, 'banaue_ground', () => (r() < 0.6 ? G.paddy : G.paddy2));
      }
      // the wall, broken only by the steps: one object a stretch (the game draws it in sections of 3 tiles)
      let x = x0;
      while (x <= x1) {
        if (stair(x)) { x++; continue; }
        let run = 0;
        while (x + run <= x1 && !stair(x + run)) run++;
        place('banaue_wall', x, py + 2, run, 1, 1);
        x += run;
      }
    });

    // ---------- the village at the top: Lola Bugan, the huts, the rack, the tunnels' mouth ----------
    caveMouth(m, 'banaue_cave', CAVE_DOOR[0], CAVE_DOOR[1]);
    for (let y = 0; y <= 4; y++) for (let x = CAVE_DOOR[0] - 1; x <= CAVE_DOOR[0] + 1; x++) hold(x, y); // (the mouth's rock, the way out)
    place('banaue_hut', 4, 2, 2, 1, 1);
    place('banaue_hut', 15, 2, 2, 1, 1);
    place('banaue_hut', 27, 2, 2, 1, 1);
    place('banaue_rack', 22, 3, 2, 1, 1);

    // ---------- the jeep stop, bottom left (the 4th terrace leaves room there) ----------
    m.obj('jeep', 'jeep', 4, 24, 2, 1);
    m.point('from_jeep', 'spawn', 4.9, 25.6, [prop('dir', 'string', 'down')]);
    for (let y = 23; y <= 27; y++) for (let x = 3; x <= 7; x++) hold(x, y);
    m.put('Walls', 8, 25, 'tiles', T.sign);
    taken.add(25 * W + 8);
    m.obj('sign_banaue', 'sign', 8, 25, 1, 1, [prop('text', 'string', 'BANAUE TERRACES\nWalk on the dikes and the stone steps, never in the paddies. Lola Bugan lives at the top, by the tunnels. Kanor\'s Jeep waits here.')]);
    place('banaue_rack', 6, 21, 2, 1, 1);

    // ---------- trees, boulders and the tall rice grass the animals hide in ----------
    [[2, 4], [10, 1], [28, 8], [3, 14], [21, 14], [29, 20], [10, 27], [2, 22]].forEach(([x, y]) => place('banaue_fern', x, y, 1, 1, 1));
    [[10, 9], [25, 15], [13, 21], [24, 26]].forEach(([x, y]) => place('banaue_boulder', x, y, 2, 1, 1));
    const grassy = (x, y) => x >= 2 && x <= W - 3 && y >= 1 && y <= H - 3 && !m.get('Walls', x, y) && !m.get('Above', x, y)
      && [G.grass, G.grass2].some((id) => m.is('Ground', x, y, 'banaue_ground', id)) && !keep.has(y * W + x) && !taken.has(y * W + x);
    for (let placed = 0, tries = 0; placed < 26 && tries < 2000; tries++) {
      const x = 2 + r.int(W - 4), y = 1 + r.int(H - 3);
      // (never against a wall's foot or a step, so no way through is ever closed)
      if (!grassy(x, y) || !grassy(x - 1, y) || !grassy(x + 1, y)) continue;
      place('banaue_grass', x, y, 1, 1);
      placed++;
    }

    m.obj('wild', 'wild', 2, 1, W - 4, H - 3);
    return m.json();
  }

  // ---------- the Terrace Tunnels: one room for every floor ----------
  // (its boulders and mushrooms are the place's own props, drawn by the game: so the map carries no props tileset)
  const cave = () => {
    const j = placeCave('banaue_cave', 'banaue', {
      w: 18, h: 16, seed: 1102,
      // the underground stream, coming in at the top right and winding down the east side, and two still pools
      pools: [[12, 2, 13, 4], [13, 5, 14, 6], [14, 7, 15, 8], [15, 9, 16, 11], [2, 10, 3, 11], [10, 9, 10, 9]],
      pillars: [[7, 6]],
      gate: [8, 12],
      props: [],
    });
    j.tilesets = j.tilesets.filter((ts) => ts.name !== 'props');
    const layer = j.layers.find((l) => l.type === 'objectgroup');
    [['banaue_boulder', 1, 6, 2, 1], ['banaue_boulder', 13, 13, 2, 1], ['banaue_shroom', 11, 6, 1, 1], ['banaue_shroom', 4, 12, 1, 1], ['banaue_shroom', 16, 13, 1, 1]].forEach(([name, x, y, w, hgt]) => {
      layer.objects.push({ id: j.nextobjectid++, name, type: 'place_prop', x: x * 256, y: y * 256, width: w * 256, height: hgt * 256, rotation: 0, visible: true,
        properties: [prop('foot', 'int', 1)] });
    });
    return j;
  };

  return { banaue, banaue_cave: cave };
};
