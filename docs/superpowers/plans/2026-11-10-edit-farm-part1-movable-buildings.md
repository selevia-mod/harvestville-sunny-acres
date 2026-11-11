# Edit Farm, Part 1: Movable Buildings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The farmhouse, the Animal Ranch (barn + coop + pen), the dog's yard, the 3 ponds, Lily's seed stand, the stable and the crop field (as 4x4 plots) become yard pieces a player can move in Decorate, and every existing farm looks and works exactly as before until its farmer moves something.

**Architecture:** Each building becomes an appended yard type with a *mask* (one string per row: `#` solid, `.` open, `D` door, `W` water, `P` pen grass, `Y` dog grass, `S` shop counter, `M` mailbox, `H` horse spot, `I` incubator). The farm map keeps only its frame (grass, border trees, road, signs, land blocks): a one-time tool removes the drawn buildings and the field from `maps/farm.json`. At runtime, the pieces put back what the map used to give: the solid tiles (through `L.yardSolid`), the door warp, the mailbox, the shop, the pen and dog zones, the incubator, the horse spot, the water (through `P.isWater`), and the placement facts (`start`, `needs`) through a new `L.farmFor(s, base)`. A save flag `ef` migrates every farm once: each building is placed where the map had it, and the field becomes 4x4 plots (plus four 4x2 plots for the last 2 rows) that keep their soil.

**Tech Stack:** Plain ES5 game files in `src/` (concatenated by `node build.js` in name order), Phaser 3, Tiled JSON map, Node `node:test` unit tests run in a `vm` context, Playwright end-to-end tests on `dist/index.html`.

**Spec:** `docs/edit-farm.md`. **Part 2 (its own plan, after this ships):** the 3 saved layouts (Farm, War, one more), "Use for raids", and the first-time tour.

**Worktree:** `~/Documents/hv-editfarm`, branch `feat/edit-farm` (on game `78b8af5`, the e52 game).

**Rules for this repo:**
- New yard types are only ever appended (a save stores a piece's index in `C.OUTDOOR.types`).
- Unit tests: `npm test`. One file: `node --test test/<file>.test.js`. Browser tests: `node build.js` first, then `node --test --test-concurrency=1 test/<file>.test.js` (one file at a time; they are timing-sensitive under load).
- Never `git checkout -f`, `reset --hard` or `clean`. Commit after every task.

---

## File structure

| File | Responsibility |
|---|---|
| `src/00-zzzzzzzzzzzzzzzzzz-buildings.js` (new) | The building types and their masks, appended after every other type (loads after `00-zzzzzzzzzzzzzzzzz-raids.js`). The old map spots (`C.FARM_BUILDINGS.home`). |
| `src/01-logicZZZZZZZZZZZZZ-buildings.js` (new) | Logic: mask reading (`L.maskAt`, `L.yardSolid`, `L.yardWater`, `L.buildingSpots`), `L.farmFor`, the migration `L.addBuildings`, store rules, save flag `ef`, visit snapshot flag. Loads after `01-logicZZZZZZZZZZZZ-raids2.js`. |
| `tools/edit-farm-map.js` (new) | One-time rewrite of `maps/farm.json`: removes the drawn buildings, their objects and the field. Refuses to run twice. |
| `tools/art/farm-layout-import.js` (new) | `art-src/farm-layout/*.png` → `assets/props/house_1`, `ranch`, `dog_yard`, `farm_pond` (`.png` + `.webp`). |
| `src/12a-buildings-world.js` (new) | The world side: after the map's objects are built, each building piece adds its warp, mailbox, shop, incubator, zones and points; `P.isWater` for ponds. Loads before `19d-home.js` so every later wrapper sees the objects. |
| `src/19d-home.js` | `showHouse` draws the house at its piece (level 1 from the new art). |
| `src/18-polish.js`, `src/19p-basket.js`, `src/19zz-farmhands.js` | Window glows, the basket and the farmhands' rest spots follow the house / dog yard / ranch. |
| `src/19zzzzzzzzzzzzzzzzzz-farm-raids-world.js` | The raid's no-drop field reads the field plots, not the map's (now empty) field. |
| `src/19f-yard.js` | The Decorate message for a building that can't be put away; the farm info passed to placement is `L.farmFor`. |
| `test/buildings.test.js` (new) | Unit tests for every logic task. |
| `test/e2e-edit-farm.test.js` (new) | Browser tests: the farm looks and works the same; moved buildings work. |

---

### Task 1: The building types and masks

**Files:**
- Create: `src/00-zzzzzzzzzzzzzzzzzz-buildings.js`
- Create: `test/buildings.test.js`

The old map spots (from `maps/farm.json`, tile coordinates of each piece's top-left):

| Piece | Key | Size | Old top-left | Notes |
|---|---|---|---|---|
| Farmhouse | `farmhouse` | 5x4 | (4,3) | door at (6,6): mask column 2 of the bottom row |
| Animal Ranch | `ranch` | 9x9 | (2,27) | barn (3..5,28..30), coop (7..9,28..29), pen grass (3..9,31..34), gate (10,31..32) on the right side |
| Dog yard | `dog_yard` | 4x5 | (11,5) | doghouse at its top |
| Pond | `farm_pond` | 5x4 | (15,3), (34,10), (34,20) | all water |
| Lily's seed stand | `seed_stand` | 6x4 | (14,28) | counter (16..17,31) |
| Stable | `stable_yard` | 3x3 | (18,32) | only once built; horse at (17.3,35.2) |
| Field plot | `field_plot4` | 4x4 | x 4..19 step 4, y 11,15,19 | 12 of them |
| Field plot (half) | `field_plot42` | 4x2 | x 4..19 step 4, y 23 | 4 of them |

- [ ] **Step 1: Write the failing test** (`test/buildings.test.js`)

```js
// Edit Farm part 1 (docs/edit-farm.md): the buildings as yard pieces, their masks, the migration, placement.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const O = C.OUTDOOR;
const KEYS = ['farmhouse', 'ranch', 'dog_yard', 'farm_pond', 'seed_stand', 'stable_yard', 'field_plot4', 'field_plot42'];

test('the buildings are appended yard types, each mask as big as the piece', () => {
  const first = O.index.farmhouse;
  assert.strictEqual(first, 59, 'appended after the last raid defense (def_sprinkler = 58)');
  KEYS.forEach((k, i) => {
    const t = O.types[O.index[k]];
    assert.ok(t, k);
    assert.strictEqual(O.index[k], first + i, k + ' in order');
    assert.strictEqual(t.mask.length, t.h, k + ' rows');
    t.mask.forEach((row) => assert.strictEqual(row.length, t.w, k + ' row width'));
    assert.strictEqual(t.cat, 'none', k + ' is not for sale');
  });
  assert.strictEqual(O.types[O.index.farmhouse].mask.join('').split('D').length - 1, 1, 'one door');
  assert.ok(O.types[O.index.ranch].mask.some((r) => r.indexOf('G') >= 0), 'the ranch has a gate');
  assert.ok(O.types[O.index.farm_pond].mask.every((r) => /^W+$/.test(r)), 'a pond is all water');
  assert.strictEqual(O.types[O.index.field_plot4].kind, 'plot');
  assert.strictEqual(O.types[O.index.field_plot42].kind, 'plot');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/buildings.test.js`
Expected: FAIL (`Cannot read properties of undefined (reading 'mask')` or index mismatch).

- [ ] **Step 3: Write the types** (`src/00-zzzzzzzzzzzzzzzzzz-buildings.js`)

```js
// Edit Farm (owner, 10 Nov 2026: "the defense, their house, farmland and others need to be moveable so they can make
// their farm the best way possible"; docs/edit-farm.md). The buildings the farm map used to draw, as yard pieces.
// Appended (a save keeps a piece's place in C.OUTDOOR.types): only ever add at the end.
// mask: a row a string. '#' solid, '.' open grass, 'D' the door (a warp, walk onto it), 'W' water, 'P' the pen's grass,
// 'Y' the dog's grass, 'G' a gate (open), 'S' the shop's counter (solid, the shop is the tile in front), 'M' the mailbox
// (solid), 'I' the incubator (solid), 'H' the horse's spot (open).
(function (F) {
  'use strict';
  var C = F.Config, O = C.OUTDOOR;
  var NEW = [
    { key: 'farmhouse', name: 'Farmhouse', w: 5, h: 4, building: 'house', keep: true, hd: 'house_1',
      mask: ['#####', '#####', '#####', '##D##'] },
    { key: 'ranch', name: 'Animal Ranch', w: 9, h: 9, building: 'ranch', keep: true, hd: 'ranch',
      mask: ['#########', '###.###..', '###.##I..', '#########', '#PPPPPPPG', '#PPPPPPPG', '#PPPPPPP#', '#PPPPPPP#', '#########'] },
    { key: 'dog_yard', name: 'Dog Yard', w: 4, h: 5, building: 'dog', hd: 'dog_yard',
      mask: ['####', '#YY#', '#YY#', '#YY#', 'YYYY'] },
    { key: 'farm_pond', name: 'Pond', w: 5, h: 4, building: 'pond', hd: 'farm_pond',
      mask: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'] },
    { key: 'seed_stand', name: "Lily's Seed Stand", w: 6, h: 4, building: 'shop', one: true,
      mask: ['######', '######', '######', '..SS..'] },
    { key: 'stable_yard', name: 'Stable', w: 3, h: 3, building: 'stable', one: true,
      mask: ['###', '###', '.H.'] },
    { key: 'field_plot4', name: 'Field', kind: 'plot', w: 4, h: 4, foot: 0, fieldPlot: true, hd: 'ws_farm_plot',
      mask: ['....', '....', '....', '....'] },
    { key: 'field_plot42', name: 'Field', kind: 'plot', w: 4, h: 2, foot: 0, fieldPlot: true, hd: 'ws_farm_plot',
      mask: ['....', '....'] },
  ];
  NEW.forEach(function (t) {
    t.kind = t.kind || 'prop';
    t.cat = 'none';
    t.price = 0;
    t.beauty = 0;
    t.foot = t.foot == null ? 1 : t.foot; // (the mask decides what is solid: L.yardSolid)
    O.index[t.key] = O.types.length;
    O.types.push(t);
  });
  // Where the farm map drew each one (tile coordinates of the top-left): every farm starts with them here.
  C.FARM_BUILDINGS = {
    home: [['farmhouse', 4, 3], ['ranch', 2, 27], ['dog_yard', 11, 5], ['farm_pond', 15, 3], ['farm_pond', 34, 10], ['farm_pond', 34, 20],
      ['seed_stand', 14, 28]],
    stable: ['stable_yard', 18, 32],
    field: { x0: 4, y0: 11, x1: 19, y1: 24 }, // the old field, 16 x 14: 4x4 plots, and 4x2 for the last 2 rows
  };
})(window.Farm = window.Farm || {});
```

Before committing, check the ranch mask against the map: `node -e` print `maps/farm.json` Walls layer rows 27..35, columns 2..10 (`gid ? '#' : '.'`) and the `animal_pen` (3,31 7x4) and `incubator` (7,28 2x2) objects; fix the mask so every map wall tile is `#` and the pen is `P`. Do the same for the house (4..8, 3..6, door (6,6)), the stand (14..19, 28..31, counter (16..17,31)) and the dog yard (11..14, 5..9; doghouse prop covers (12..13, 3..4) which is *outside* the 4x5 yard: move the dog yard's top-left to (11,3) and make it 4x7 if the doghouse must come along — record the decision in the commit message).

- [ ] **Step 4: Run the test**

Run: `node --test test/buildings.test.js`
Expected: PASS. Then `npm test`: everything still passes (nothing reads the new types yet).

- [ ] **Step 5: Commit**

```bash
git add src/00-zzzzzzzzzzzzzzzzzz-buildings.js test/buildings.test.js
git commit -m "feat(edit-farm): the farm's buildings as appended yard types with masks"
```

---

### Task 2: Masks decide what is solid and what is water

**Files:**
- Create: `src/01-logicZZZZZZZZZZZZZ-buildings.js`
- Test: `test/buildings.test.js`

- [ ] **Step 1: Add the failing tests**

```js
test('a building\'s mask decides its solid tiles, its water and its open tiles', () => {
  const h = O.index.farmhouse, solid = L.yardSolid(h, 4, 3).map((p) => p.join(','));
  assert.strictEqual(solid.length, 19, '20 tiles, the door open');
  assert.ok(!solid.includes('6,6'), 'the door is walked onto');
  assert.deepStrictEqual(L.maskAt(h, 4, 3, 6, 6), 'D');
  const p = O.index.farm_pond;
  assert.strictEqual(L.yardSolid(p, 15, 3).length, 20, 'water is solid');
  assert.strictEqual(L.yardWater(p, 15, 3).length, 20);
  assert.strictEqual(L.yardSolid(O.index.field_plot4, 4, 11).length, 0, 'a field plot is walked on');
  // pieces without a mask keep the foot rule
  assert.strictEqual(L.yardSolid(O.index.bench, 5, 5).length, 2);
});
```

- [ ] **Step 2: Run it**: `node --test test/buildings.test.js` → FAIL (`L.maskAt is not a function`).

- [ ] **Step 3: Implement** (`src/01-logicZZZZZZZZZZZZZ-buildings.js`)

```js
// Edit Farm part 1 (docs/edit-farm.md): the buildings' masks, the farm's placement facts from its pieces, the migration.
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR;
  var SOLID = { '#': 1, W: 1, S: 1, M: 1, I: 1 };

  // the mask letter at tile (tx, ty) of a piece at (x, y), or null (no mask, or outside it)
  L.maskAt = function (t, x, y, tx, ty) {
    var type = O.types[t], row = type && type.mask && type.mask[ty - y];
    return row && tx >= x && tx < x + type.w ? row.charAt(tx - x) : null;
  };
  var withMask = function (t, x, y, test) {
    return L.yardBox(t, x, y).filter(function (p) { return test(L.maskAt(t, x, y, p[0], p[1])); });
  };
  var yardSolid = L.yardSolid;
  L.yardSolid = function (t, x, y) {
    var type = O.types[t];
    if (!type || !type.mask) return yardSolid(t, x, y);
    return withMask(t, x, y, function (c) { return !!SOLID[c]; });
  };
  L.yardWater = function (t, x, y) { return O.types[t] && O.types[t].mask ? withMask(t, x, y, function (c) { return c === 'W'; }) : []; };
  // the tiles of a piece with a given letter
  L.maskTiles = function (t, x, y, letter) { return O.types[t] && O.types[t].mask ? withMask(t, x, y, function (c) { return c === letter; }) : []; };
  L.isBuilding = function (t) { return !!(O.types[t] && O.types[t].building); };
})(window.Farm = window.Farm || {});
```

- [ ] **Step 4: Run**: `node --test test/buildings.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): masks decide a building's solid tiles and water"` (add the new file first: `git add src/01-logicZZZZZZZZZZZZZ-buildings.js`).

---

### Task 3: The farm's placement facts come from its pieces (`L.farmFor`)

**Files:**
- Modify: `src/01-logicZZZZZZZZZZZZZ-buildings.js`
- Test: `test/buildings.test.js`

Today `L.farmInfo(map)` reads the house door (`start`), the doors that must stay reachable (`needs`) and the field from the map, once. With the buildings as pieces these come from `s.yard.items`. `L.farmFor(s, base)` returns a copy of `base` with: `start` = the tile below the farmhouse's door; one `needs` group per building opening (the door's front tile; the ranch's gate tiles plus the tiles right of them; the stand's tiles in front of `S`; the stable's `H`); and water, solid and noPlace from masks are left to the items themselves (they are pieces: `L.yardSolid` already makes them solid, and they claim their tiles). Cache by a key of the building items' positions.

- [ ] **Step 1: Failing tests**

```js
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const BASE = L.farmInfo(MAP);
const fresh = () => { const s = L.newState(); s.seed = 3; s.gold = 1e6; L.takeNotes && L.takeNotes(); return s; };

test('the house door and the buildings\' openings come from the pieces', () => {
  const s = fresh(), f = L.farmFor(s, BASE), W = C.FARM_W;
  assert.strictEqual(f.start, 7 * W + 6, 'below the door at (6,6)');
  const house = s.yard.items.find((it) => it.t === O.index.farmhouse);
  house.x += 10; // moved 10 tiles right
  const f2 = L.farmFor(s, BASE);
  assert.strictEqual(f2.start, 7 * W + 16, 'the door moved with the house');
  assert.ok(f2.needs.length >= 4, 'house, ranch gate, stand, + the map\'s own (road, signs)');
});

test('a fence across the ranch gate is refused: the gate must stay reachable', () => {
  const s = fresh(), t = O.index.wood_fence, f = L.farmFor(s, BASE);
  s.yard.bag[t] = 4;
  // the ranch at (2,27): its gate is the mask's 'G' tiles at (10,31) and (10,32); the tiles right of them are (11,31..32)
  assert.strictEqual(L.yardCantPlace(s, f, t, 11, 31, null), null, 'one tile is fine');
  L.placeYard(s, f, t, 11, 31);
  assert.strictEqual(L.yardCantPlace(s, L.farmFor(s, BASE), t, 11, 32, null), 'blocks', 'closing the gate is not');
});
```

- [ ] **Step 2: Run**: FAIL (`L.farmFor is not a function`). (The first test also needs Task 5's migration to put the buildings in a new farm. Write Task 5's `L.addBuildings` call into `L.newState` now if the test can't pass without it, or mark this test `{ todo: 'needs Task 5' }` and remove the `todo` in Task 5.)

- [ ] **Step 3: Implement** (append inside the IIFE of `src/01-logicZZZZZZZZZZZZZ-buildings.js`)

```js
  // The farm's placement facts with its buildings where they stand: base is L.farmInfo(map) of the farm's frame.
  var cache = { key: null, info: null };
  L.farmFor = function (s, base) {
    var W = base.w, items = (s.yard && s.yard.items) || [], key = '';
    items.forEach(function (it) { if (L.isBuilding(it.t)) key += it.t + ':' + it.x + ',' + it.y + ';'; });
    if (cache.base === base && cache.key === key) return cache.info;
    var info = Object.assign({}, base, { needs: base.needs.slice(), start: base.start });
    var front = function (p) { return (p[1] + 1) * W + p[0]; };
    items.forEach(function (it) {
      var b = O.types[it.t].building;
      if (!b) return;
      if (b === 'house') {
        var door = L.maskTiles(it.t, it.x, it.y, 'D')[0];
        if (door) { info.start = front(door); info.needs.push([front(door)]); }
      } else if (b === 'ranch') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'G').map(function (p) { return p[1] * W + p[0] + 1; }));
      } else if (b === 'shop') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'S').map(front));
      } else if (b === 'stable') {
        info.needs.push(L.maskTiles(it.t, it.x, it.y, 'H').map(function (p) { return p[1] * W + p[0]; }));
      }
    });
    cache = { base: base, key: key, info: info };
    return info;
  };
```

Then route every placement call through it: in the same file,

```js
  var cantPlace = L.yardCantPlace;
  L.yardCantPlace = function (s, farm, t, x, y, skip) { return cantPlace(s, farm && farm.w ? L.farmFor(s, farm.base || farm) : farm, t, x, y, skip); };
```

and make `L.farmFor` set `info.base = base` so a farm already passed through it is not re-wrapped. Check `L.placeYard`, `L.moveYard`, `L.yardRepair` and `L.yardFindSpot` all call `L.yardCantPlace` (01-logic6.js:179-229); if one reads `farm.start` or `farm.needs` directly, pass `L.farmFor(s, farm)` there too.

- [ ] **Step 4: Run**: `node --test test/buildings.test.js` → PASS; `npm test` → all pass (yard.test.js reads `L.farmInfo(MAP)` of the *old* map until Task 4; it must still pass here).

- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): the house door and the buildings' openings come from their pieces (L.farmFor)"`

---

### Task 4: The map keeps only its frame

**Files:**
- Create: `tools/edit-farm-map.js`
- Modify: `maps/farm.json` (by the tool)
- Test: `test/buildings.test.js`

- [ ] **Step 1: Failing test**

```js
test('the farm map keeps only its frame: no house, ranch, ponds, stand, field or their objects', () => {
  const props = {}; MAP.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
  const ground = MAP.layers.find((l) => l.name === 'Ground').data, walls = MAP.layers.find((l) => l.name === 'Walls').data, W = MAP.width;
  assert.ok(!ground.some((g) => props[g] && (props[g].tillable || props[g].water)), 'no field and no water drawn');
  for (let y = 3; y <= 6; y++) for (let x = 4; x <= 8; x++) assert.strictEqual(walls[y * W + x], 0, 'house tile ' + x + ',' + y);
  for (let y = 27; y <= 35; y++) for (let x = 2; x <= 10; x++) assert.strictEqual(walls[y * W + x], 0, 'ranch tile ' + x + ',' + y);
  const names = MAP.layers.find((l) => l.type === 'objectgroup').objects.map((o) => o.name);
  ['house_door', 'mailbox', 'seed_shop', 'animal_pen', 'dog_yard', 'incubator', 'horse', 'doghouse', 'stable', 'spawn'].forEach((n) => assert.ok(!names.includes(n), n + ' is gone'));
  ['road_south', 'from_town', 'field_sign', 'yard_sign', 'road_sign', 'land_sign'].forEach((n) => assert.ok(names.includes(n), n + ' stays'));
  assert.ok(MAP.properties && MAP.properties.some((p) => p.name === 'editFarm'), 'marked done');
});
```

- [ ] **Step 2: Run**: FAIL (the tiles are there).

- [ ] **Step 3: Write the tool** (`tools/edit-farm-map.js`)

```js
// Edit Farm part 1 (docs/edit-farm.md): the farm map keeps only its frame. The buildings, their objects and the field
// leave the map; they are yard pieces now (src/00-zzzzzzzzzzzzzzzzzz-buildings.js). Run once: node tools/edit-farm-map.js
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'maps', 'farm.json');
const map = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if ((map.properties || []).some((p) => p.name === 'editFarm')) { console.log('already done'); process.exit(0); }
const W = map.width, layer = (n) => map.layers.find((l) => l.name === n);
const props = {};
map.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { const o = {}; (t.properties || []).forEach((p) => { o[p.name] = p.value; }); props[ts.firstgid + t.id] = o; }));
const ground = layer('Ground'), walls = layer('Walls'), above = layer('Above');
// the grass under the field and the water: the most common plain Ground gid on the map
const count = {}; ground.data.forEach((g) => { if (g && !props[g]?.tillable && !props[g]?.water && !props[g]?.path) count[g] = (count[g] || 0) + 1; });
const GRASS = Number(Object.keys(count).sort((a, b) => count[b] - count[a])[0]);
const clear = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { walls.data[y * W + x] = 0; if (above) above.data[y * W + x] = 0; } };
clear(4, 3, 8, 6); // the farmhouse
clear(2, 27, 10, 35); // the ranch: barn, coop, trough, hay, pen fence
clear(14, 28, 19, 31); // Lily's stand
ground.data.forEach((g, i) => { if (props[g]?.tillable || props[g]?.water) ground.data[i] = GRASS; }); // the field, the ponds
const GONE = new Set(['house_door', 'mailbox', 'seed_shop', 'animal_pen', 'dog_yard', 'incubator', 'horse', 'doghouse', 'stable', 'spawn']);
const og = map.layers.find((l) => l.type === 'objectgroup');
og.objects = og.objects.filter((o) => !GONE.has(o.name));
(map.properties = map.properties || []).push({ name: 'editFarm', type: 'int', value: 1 });
fs.writeFileSync(FILE, JSON.stringify(map));
console.log('farm map: buildings, field and ponds removed; grass gid', GRASS);
```

Check before running: the dog yard's and stable's map objects are named `dog_yard` (zone) and the props `doghouse` / `stable` (object `name` fields — print `og.objects.map(o => o.name + ':' + (o.gid||''))` first and adjust `GONE` to the real names). The path tiles (6..7, 7..10) and the road stay. `from_town` is the road's spawn and stays.

- [ ] **Step 4: Run the tool, then the tests**

Run: `node tools/edit-farm-map.js` → `farm map: buildings, field and ponds removed; grass gid N`
Run: `node --test test/buildings.test.js` → PASS. Run `npm test`: `yard.test.js`, `land.test.js`, `farm2.test.js` will now fail where they relied on the map's field/house; they are fixed in Task 5 (the migration gives every new farm its buildings back). Note the failing test names in the commit message.

- [ ] **Step 5: Commit**

```bash
git add tools/edit-farm-map.js maps/farm.json test/buildings.test.js
git commit -m "feat(edit-farm): the farm map keeps only its frame (tools/edit-farm-map.js)"
```

---

### Task 5: Every farm gets its buildings, once, where the map had them

**Files:**
- Modify: `src/01-logicZZZZZZZZZZZZZ-buildings.js`
- Modify: `src/00-workshop.js` area via the new file only: Field plots from the migration don't count toward `C.PLOTS.max`
- Test: `test/buildings.test.js`, and fix `test/yard.test.js`, `test/land.test.js`, `test/farm2.test.js` expectations that read the map's field

- [ ] **Step 1: Failing tests**

```js
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));

test('a new farm has its buildings where the map had them, and its field as 16 plots', () => {
  const s = fresh(), at = (k) => s.yard.items.filter((it) => it.t === O.index[k]).map((it) => it.x + ',' + it.y);
  assert.deepStrictEqual(at('farmhouse'), ['4,3']);
  assert.deepStrictEqual(at('ranch'), ['2,27']);
  assert.deepStrictEqual(at('farm_pond'), ['15,3', '34,10', '34,20']);
  assert.strictEqual(at('field_plot4').length, 12);
  assert.strictEqual(at('field_plot42').length, 4);
  assert.deepStrictEqual(at('stable_yard'), [], 'no stable until it is built');
  assert.strictEqual(L.yardRepair(s, BASE), 0, 'all of them fit');
});

test('an older save gets them once, its soil and crops stay on the same tiles, and nothing else moves', () => {
  const s = fresh(), W = C.FARM_W;
  s.yard.items = s.yard.items.filter((it) => !L.isBuilding(it.t)); // as a save from before this update
  s.soil[13 * W + 8] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
  s.builds.stable = 1;
  const o = L.serialize(s); delete o.ef;
  const s2 = L.deserialize(JSON.parse(JSON.stringify(o)));
  assert.strictEqual(s2.yard.items.filter((it) => L.isBuilding(it.t)).length, 7 + 16 + 1, '7 buildings, 16 field plots, the stable');
  assert.strictEqual(s2.soil[13 * W + 8].c, 'turnip');
  assert.strictEqual(L.yardRepair(s2, BASE), 0);
  const s3 = roundTrip(s2);
  assert.strictEqual(s3.yard.items.length, s2.yard.items.length, 'once: not again on the next load');
});

test('the house and the ranch can\'t be put away, only moved; the others can', () => {
  const s = fresh(), i = (k) => s.yard.items.findIndex((it) => it.t === O.index[k]);
  assert.strictEqual(L.storeYard(s, i('farmhouse')), 'keep');
  assert.strictEqual(L.storeYard(s, i('ranch')), 'keep');
  assert.notStrictEqual(L.storeYard(s, i('dog_yard')), 'keep');
});
```

- [ ] **Step 2: Run**: FAIL.

- [ ] **Step 3: Implement** (append to the IIFE in `src/01-logicZZZZZZZZZZZZZ-buildings.js`)

```js
  // ---------- every farm gets its buildings once (save flag 'ef') ----------
  var put = function (s, key, x, y) { s.yard.items.push({ t: O.index[key], x: x, y: y }); };
  L.addBuildings = function (s) {
    var B = C.FARM_BUILDINGS, have = {};
    s.yard.items.forEach(function (it) { var k = O.types[it.t] && O.types[it.t].key; if (k) have[k] = (have[k] || 0) + 1; });
    B.home.forEach(function (b) { if (!have[b[0]]) put(s, b[0], b[1], b[2]); else have[b[0]]--; });
    if (s.builds && s.builds.stable && !have.stable_yard) put(s, B.stable[0], B.stable[1], B.stable[2]);
    if (!have.field_plot4 && !have.field_plot42) {
      var f = B.field;
      for (var y = f.y0; y + 3 <= f.y1; y += 4) for (var x = f.x0; x + 3 <= f.x1; x += 4) put(s, 'field_plot4', x, y);
      for (var x2 = f.x0; x2 + 3 <= f.x1; x2 += 4) put(s, 'field_plot42', x2, f.y1 - 1);
    }
  };
  var newState = L.newState;
  L.newState = function () { var s = newState.apply(this, arguments); L.addBuildings(s); return s; };
  var serialize = L.serialize;
  L.serialize = function (s) { var o = serialize(s); o.ef = 1; return o; };
  var deserialize = L.deserialize;
  L.deserialize = function (o) { var s = deserialize(o); if (s && !o.ef) L.addBuildings(s); return s; };
  // a stable piece once the stable is built
  var build = L.build;
  if (build) L.build = function (s, key) { var r = build.apply(this, arguments); if (key === 'stable' && r === 'ok') L.addBuildings(s); return r; };
  // the house and the ranch are only moved
  var storeYard = L.storeYard;
  L.storeYard = function (s, i) { var it = s.yard.items[i]; return it && O.types[it.t].keep ? 'keep' : storeYard(s, i); };
  // field plots from the old field don't count as bought Field Plots
  var yardOwned = L.yardOwned;
  if (yardOwned) L.yardOwned = function (s, t) { return O.types[t] && O.types[t].fieldPlot ? 0 : yardOwned.apply(this, arguments); };
```

Check: the name of the build function (`grep -n "L.build = \|L.buildIt = \|builds\[" src/01-*.js`), and whether the stable's build sets `s.builds.stable` through it; hook the real function. Check `C.PLOTS.max` counting (`L.yardCantBuy` / `L.yardPrice` in 01-logicA.js:162-167) and exclude `fieldPlot` types there the same way. Then update the old tests that read the map's field (the field now comes from the plots: e.g. `FARM.field` → plot tiles; `FARM.start` → `L.farmFor(s, FARM).start`).

- [ ] **Step 4: Run**: `node --test test/buildings.test.js` → PASS; `npm test` → all pass (after the old tests are updated).

- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): every farm gets its buildings and field plots once, where the map had them (save flag ef)"`

---

### Task 6: The building art

**Files:**
- Create: `tools/art/farm-layout-import.js`
- Create: `assets/props/house_1.png/.webp`, `ranch.png/.webp`, `dog_yard.png/.webp`, `farm_pond.png/.webp`

- [ ] **Step 1:** Write the importer on the pattern of `tools/art/raider-anim-import.js` (Playwright page with `tools/art/wild-lib`: `W.cutout`, `W.dehalo`, `W.out`): for each of `art-src/farm-layout/{house_1,ranch,dog_yard,pond}.png`, cut it out, crop to its alpha box, scale to the piece's width in tiles × 128 px (the props are drawn at 128 px a tile: check `assets/props/house_2.png`'s size against its 5-tile width and use the same ratio), and write `.png` + `.webp`. `pond.png` → `farm_pond`.
- [ ] **Step 2:** Run `node tools/art/farm-layout-import.js`; open each output with `sips -g pixelWidth -g pixelHeight` and check the widths are tiles × the ratio.
- [ ] **Step 3:** `node build.js` and check the page is still under the 20.45 MB limit (`ls -l dist/index.html`). If over, add the four to a pack in `tools/packs.js` (like `riding`) and ask for them with `F.needImage` where they are drawn (Task 7).
- [ ] **Step 4: Commit**: `git add tools/art/farm-layout-import.js assets/props/house_1.* assets/props/ranch.* assets/props/dog_yard.* assets/props/farm_pond.* && git commit -m "feat(edit-farm): the owner's art for the house, ranch, dog yard and pond"`

---

### Task 7: The world: the buildings work where they stand

**Files:**
- Create: `src/12a-buildings-world.js`
- Modify: `src/19d-home.js` (showHouse), `src/18-polish.js:99-102` (window glows), `src/19p-basket.js:14` (basket spot), `src/19zz-farmhands.js:23` (rest spots), `src/19f-yard.js:21-24` (the farm info used by Decorate), `src/19f-yard.js:13-17` (WHY text `keep`)
- Test: `test/e2e-edit-farm.test.js`

- [ ] **Step 1: The failing browser test** (`test/e2e-edit-farm.test.js`; copy `open`, `frames`, `teleport`, `makeSave`, `tapAction` from the top of `test/e2e.test.js`)

```js
test('the farm works as before: in and out of the house, the animals in the pen, the dog in its yard, fishing, Lily\'s shop', async () => {
  const { page, problems, context } = await open(await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; L.addItem(s, 'rod', 1);"));
  const r = await page.evaluate(() => {
    const w = Farm.world, z = w.zones;
    return {
      door: !!w.objects.find((o) => o.type === 'warp' && o.props.to === 'house' && o.x0 === 6 && o.y0 === 6),
      mail: !!w.objects.find((o) => o.type === 'mail'), shop: !!w.objects.find((o) => o.type === 'shop'),
      pen: z.pen && [z.pen[0].x0, z.pen[0].y0], dog: z.dogarea && [z.dogarea[0].x0, z.dogarea[0].y0],
      water: w.isWater(16, 4), spawn: !!w.points.house_door, herd: !!w.herd,
    };
  });
  assert.deepStrictEqual(r, { door: true, mail: true, shop: true, pen: [3, 31], dog: [11, 5], water: true, spawn: true, herd: true });
  await page.evaluate(() => { const o = Farm.world.objects.find((w) => w.type === 'warp' && w.props.to === 'house'); Farm.world.travel(o.props.to, o.props.spawn); });
  await page.waitForFunction(() => Farm.world.mapKey === 'house' && !Farm.world.busy, null, SLOW);
  await page.evaluate(() => Farm.world.travel('farm', 'house_door'));
  await page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  const feet = await page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return [Math.floor(f.x / T), Math.floor(f.y / T)]; });
  assert.deepStrictEqual(feet, [6, 7], 'out at the door');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a moved house: its door warps in, you come out at it, the mailbox goes along', async () => {
  const { page, problems, context } = await open(await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; const h = s.yard.items.find((it) => it.t === Farm.Config.OUTDOOR.index.farmhouse); h.x = 24; h.y = 4;"));
  const door = await page.evaluate(() => { const o = Farm.world.objects.find((w) => w.type === 'warp' && w.props.to === 'house'); return [o.x0, o.y0]; });
  assert.deepStrictEqual(door, [26, 7]);
  await page.evaluate(() => { const o = Farm.world.objects.find((w) => w.type === 'warp' && w.props.to === 'house'); Farm.world.travel(o.props.to, o.props.spawn); });
  await page.waitForFunction(() => Farm.world.mapKey === 'house' && !Farm.world.busy, null, SLOW);
  await page.evaluate(() => Farm.world.travel('farm', 'house_door'));
  await page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  assert.deepStrictEqual(await page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return [Math.floor(f.x / T), Math.floor(f.y / T)]; }), [26, 8]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
```

- [ ] **Step 2:** `node build.js && node --test test/e2e-edit-farm.test.js` → FAIL (no door object: the map no longer has it).

- [ ] **Step 3: Implement** `src/12a-buildings-world.js`

```js
// Edit Farm part 1 (docs/edit-farm.md): the buildings are yard pieces; here each one gives the farm what the map used
// to: the house door (a warp) and its spawn point, the mailbox, Lily's shop, the incubator, the pen and the dog's zones,
// the horse's spot, and the ponds' water. Before every other buildObjects wrapper (19d-home.js and on read these).
(function (F) {
  'use strict';
  var C = F.Config, L = F.Logic, O = C.OUTDOOR, T = C.TILE;
  var P = F.WorldScene.prototype;
  var rect = function (type, name, x0, y0, x1, y1, props) {
    return { type: type, name: name, x0: x0, y0: y0, x1: x1, y1: y1, px: x0 * T, py: y0 * T, pw: (x1 - x0 + 1) * T, ph: (y1 - y0 + 1) * T, props: props || {} };
  };
  var box = function (tiles) {
    var xs = tiles.map(function (p) { return p[0]; }), ys = tiles.map(function (p) { return p[1]; });
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  };
  var buildObjects = P.buildObjects;
  P.buildObjects = function () {
    buildObjects.call(this);
    if (this.mapKey !== 'farm') return;
    var self = this, s = this.state;
    this.pondWater = {};
    (s.yard.items || []).forEach(function (it) {
      var t = O.types[it.t], b = t && t.building;
      if (!b) return;
      var tiles = function (c) { return L.maskTiles(it.t, it.x, it.y, c); };
      if (b === 'house') {
        var d = tiles('D')[0];
        self.objects.push(rect('warp', 'house_door', d[0], d[1], d[0], d[1], { to: 'house', spawn: 'door', label: 'Enter' }));
        var pt = { x: (d[0] + 0.5) * T, y: (d[1] + 1.6) * T, props: { dir: 'down' }, type: 'spawn' };
        self.points.house_door = pt;
        self.points.spawn = pt;
        self.objects.push(rect('mail', 'mailbox', it.x + t.w, it.y + t.h - 1, it.x + t.w, it.y + t.h - 1));
      } else if (b === 'ranch') {
        var pen = box(tiles('P'));
        (self.zones.pen = self.zones.pen || []).push(rect('pen', 'animal_pen', pen[0], pen[1], pen[2], pen[3]));
        var inc = box(tiles('I'));
        self.objects.push(rect('incubator', 'incubator', inc[0], inc[1], inc[2], inc[3]));
      } else if (b === 'dog') {
        var y = box(tiles('Y'));
        (self.zones.dogarea = self.zones.dogarea || []).push(rect('dogarea', 'dog_yard', y[0], y[1], y[2], y[3]));
      } else if (b === 'shop') {
        var c = box(tiles('S'));
        self.objects.push(rect('shop', 'seed_shop', c[0], c[1], c[2], c[3]));
      } else if (b === 'stable') {
        var hs = tiles('H')[0];
        if (hs) self.points.horse = { x: (hs[0] + 0.3) * T, y: (hs[1] + 0.2) * T, props: {}, type: 'place' };
      } else if (b === 'pond') {
        tiles('W').forEach(function (p) { self.pondWater[p[1] * C.FARM_W + p[0]] = 1; });
      }
    });
  };
  var isWater = P.isWater;
  P.isWater = function (x, y) { return (this.pondWater && this.pondWater[y * C.FARM_W + x]) || isWater.call(this, x, y); };
})(window.Farm = window.Farm || {});
```

Check against the old map objects before running (print them from `git show 78b8af5:maps/farm.json`): the warp's `props` (to, spawn, label), the mail object's position relative to the house (it was at (9,6): `it.x + t.w` = 9, `it.y + t.h - 1` = 6 ✓), the shop's tiles (16..17,31), the incubator (7,28 2x2), the pen (3,31 7x4), the dog area (11,5 4x5), the horse point (17.3, 35.2) relative to the stable at (18,32): adjust the `H` mask cell and the offsets until every object lands on its old tile for an unmoved farm. `isWater` must be a prototype method (it is: `11-world.js:378`). The mailbox prop picture (old map prop at (9,5..6)) must be drawn: draw `props/mailbox` at the mail tile in this wrapper (`self.add.image(...)`, origin (0,1), depth `DEPTH.actor + y`), and the doghouse picture (old prop at (12,3..4)) is part of the new `dog_yard` art.

Then in `src/19d-home.js`, replace `HOUSE_BLOCK` with the farmhouse piece:

```js
  var houseAt = function (s) {
    var it = (s.yard.items || []).find(function (i) { return O.types[i.t] && O.types[i.t].building === 'house'; });
    return it ? { x: it.x, y: it.y, w: 5, h: 4 } : null;
  };
  P.showHouse = function () {
    var lv = this.state.home.level, b = houseAt(this.state);
    if (!b) return;
    var key = 'props/house_' + Math.max(1, lv);
    F.ensureTexture(this, key);
    this.houseImg = this.add.image(b.x * T, (b.y + b.h) * T, key).setOrigin(0, 1).setDisplaySize(5 * T, 5 * T).setDepth(DEPTH.actor + (b.y + b.h) * T / 1e5);
  };
```

(`O` = `F.Config.OUTDOOR`; keep any other users of `HOUSE_BLOCK` in that file working through `houseAt`.) In `src/19f-yard.js`'s `renderYard`, skip drawing the farmhouse piece's own sprite (the house picture is `showHouse`'s): `if (O.types[it.t].building === 'house') return;` inside its loop, after its solids are added. Glows (`18-polish.js:99-102`): `(house.x + 1.3) * T, (house.y + 2.1) * T` and `(house.x + 3.7) * T, (house.y + 2.1) * T`. Basket (`19p-basket.js:14`): `[house.x + 6, house.y + 3]`. Farmhands (`19zz-farmhands.js:23`): andoy/lucing/kiko relative to the dog yard's bottom-left (`[it.x + 1.6, it.y + 3.7]`, `[it.x + 0.3, it.y + 3.7]`, `[it.x + 3, it.y + 3.7]`), berto to the ranch gate (`[gate.x + 2, gate.y + 0.7]`), falling back to the old numbers when the piece is not found. Decorate (`19f-yard.js:21-24`): `F.farm()` stays the frame's info; every caller that passes it to `L.yardCantPlace` already goes through `L.farmFor` (Task 3). Add `keep: 'The farmhouse and the ranch stay on your farm: you can move them, not put them away.'` to the `WHY` table.

- [ ] **Step 4:** `node build.js && node --test test/e2e-edit-farm.test.js` → PASS. Then the existing farm suites, one at a time: `node --test --test-concurrency=1 test/e2e.test.js`, `test/e2e-online.test.js`, `test/e2e-farm-raids.test.js`, `test/e2e-raid.test.js`; fix what reads the old fixed spots (search the failures for `house_door`, `field_sign`, `isWater`, `zones.pen`).

- [ ] **Step 5: Commit**: `git add src/12a-buildings-world.js test/e2e-edit-farm.test.js && git commit -am "feat(edit-farm): each building gives the farm its door, mailbox, shop, incubator, zones, horse spot and water where it stands"`

---

### Task 8: Raids and the guide read the pieces

**Files:**
- Modify: `src/19zzzzzzzzzzzzzzzzzz-farm-raids-world.js:72-80` (no-drop field), `:351-403` (bandit layout reads `field_sign`, pen, `house_door`: they still exist as objects/zones, check), `src/19zzzzzzzzzzzz-guide.js:94-100` (`water`, `field`)
- Test: `test/e2e-farm-raids.test.js` (the existing "never land on the field" test), `test/e2e-edit-farm.test.js`

- [ ] **Step 1:** Run `node --test --test-name-pattern="never land on the field" test/e2e-farm-raids.test.js` → FAIL (`F.farm().field` is empty now: the map has no field).
- [ ] **Step 2:** In `raidFarm`, mark the field from the plots instead:

```js
    (s.yard.items || []).forEach(function (it) {
      if (!L.isPlot(it.t)) return;
      L.yardBox(it.t, it.x, it.y).forEach(function (p) { for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) mark(p[0] + dx, p[1] + dy); });
    });
```

and remove the `F.farm().field` loop. Update the test to read the field from the plots (`Farm.session.state.yard.items.filter((it) => Farm.Logic.isPlot(it.t))`).

- [ ] **Step 3:** Add to `test/e2e-edit-farm.test.js`: a farm with its ranch moved to (24,14): `raidFarm()` marks the new pen no-drop and the old pen spot open; a farm with a pond moved: the guide's `water` goal (`Farm.world.guideGoal('water')` or the function the guide uses at `guide.js:94`) finds the moved pond.
- [ ] **Step 4:** Run the raid and edit-farm browser tests → PASS.
- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): raids keep raiders off the field plots and the moved pen; the guide finds moved ponds"`

---

### Task 9: Visits and older friends

**Files:**
- Modify: `src/01-logicZZZZZZZZZZZZZ-buildings.js` (snapshot flag, `visitState`)
- Test: `test/buildings.test.js`

- [ ] **Step 1: Failing test**

```js
test('a visit sees the farm as its owner laid it out; an older friend\'s snapshot gets the buildings where the map had them', () => {
  const s = fresh(), h = s.yard.items.find((it) => it.t === O.index.farmhouse);
  h.x = 24; h.y = 4;
  const v = L.visitState(L.snapshot(s), fresh());
  assert.deepStrictEqual(v.yard.items.filter((it) => it.t === O.index.farmhouse).map((it) => [it.x, it.y]), [[24, 4]]);
  const old = L.snapshot(s); delete old.ef; old.yard = old.yard.filter((e) => !L.isBuilding(e[0]));
  const v2 = L.visitState(old, fresh());
  assert.strictEqual(v2.yard.items.filter((it) => it.t === O.index.farmhouse).length, 1, 'given back at (4,3)');
});
```

- [ ] **Step 2:** Run → FAIL on the second part.
- [ ] **Step 3:** In `src/01-logicZZZZZZZZZZZZZ-buildings.js`:

```js
  var snapshot = L.snapshot;
  L.snapshot = function (s) { var o = snapshot(s); o.ef = 1; return o; };
  var visitState = L.visitState;
  L.visitState = function (snap, mine) { var s = visitState(snap, mine); if (!(snap && snap.ef)) L.addBuildings(s); return s; };
```

Check the snapshot size: a full farm's 7 buildings + 16 plots add ~24 entries of `[t,x,y]` (~250 bytes); `farm.snapshots` allows 32,768 bytes. Check `C.YARD_MAX` (500) still fits the largest live yards (they are ~160 non-tile pieces).

- [ ] **Step 4:** Run `node --test test/buildings.test.js test/online.test.js` → PASS.
- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): visits see the owner's layout; an older snapshot gets the buildings"`

---

### Task 10: Moving buildings in Decorate (browser)

**Files:**
- Test: `test/e2e-edit-farm.test.js`
- Modify if needed: `src/19f-yard.js` (`yardAt` picks a building by its whole box; the drag outline uses the piece's w x h)

- [ ] **Step 1: Failing test** (drag with CDP touch like `test/e2e.test.js:903-935`, the field-fence drag)

```js
test('Decorate: drag the ranch to open grass; the animals live in the new pen; it can\'t be put away; a field plot carries its crops', async () => {
  const { page, problems, context } = await open(await makeSave("s.start -= 3; s.goal = 99; s.wv = Farm.Config.NEWS_LATEST; L.addAnimal(s, 'cow', false);"));
  await page.evaluate(() => Farm.world.startYard());
  const moved = await page.evaluate(() => {
    const s = Farm.session.state, O = Farm.Config.OUTDOOR, i = s.yard.items.findIndex((it) => it.t === O.index.ranch);
    return Farm.Logic.moveYard(s, Farm.farm(), i, 24, 14);
  });
  assert.strictEqual(moved, 'ok');
  assert.strictEqual(await page.evaluate(() => { const s = Farm.session.state, O = Farm.Config.OUTDOOR; return Farm.Logic.storeYard(s, s.yard.items.findIndex((it) => it.t === O.index.ranch)); }), 'keep');
  await page.evaluate(() => Farm.world.endYard());
  await page.evaluate(() => Farm.world.scene.restart());
  await page.waitForFunction(() => Farm.world && Farm.world.mapKey === 'farm' && !Farm.world.busy && Farm.world.herd, null, SLOW);
  const pen = await page.evaluate(() => { const z = Farm.world.zones.pen[0]; return [z.x0, z.y0]; });
  assert.deepStrictEqual(pen, [25, 18]);
  // a field plot moved with a crop on it
  const crop = await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, O = Farm.Config.OUTDOOR, W = Farm.Config.FARM_W, i = s.yard.items.findIndex((it) => it.t === O.index.field_plot4);
    const it = s.yard.items[i]; s.soil[it.y * W + it.x] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 };
    const r = L.moveYard(s, Farm.farm(), i, 40, 5);
    return [r, s.soil[5 * W + 40] && s.soil[5 * W + 40].c];
  });
  assert.deepStrictEqual(crop, ['ok', 'turnip']);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
```

(The move to (40,5) needs bought land: buy a block in the `makeSave` edit, `L.buyLand(s)`, or pick an open grass spot inside the old map left of x 38.)

- [ ] **Step 2:** `node build.js && node --test test/e2e-edit-farm.test.js` → see what fails (picking a 9x9 piece, its outline, the drop rules).
- [ ] **Step 3:** Fix in `src/19f-yard.js` only what the failures name.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit**: `git commit -am "feat(edit-farm): buildings move in Decorate; the house and ranch can't be put away"`

---

### Task 11: The whole farm, and both phones

- [ ] **Step 1:** `npm test` → all pass. `cd server && npm test` → 44 pass (the server loads `src/00-*` and `src/01-*`: the new types and logic must load there without the browser).
- [ ] **Step 2:** All browser suites, one file at a time (they are timing-sensitive): `for f in test/e2e*.test.js; do node --test --test-concurrency=1 $f; done`. A failure that passes when rerun alone is load; anything else is fixed.
- [ ] **Step 3:** Real saves, read-only: copy 5 live saves (`farm.saves`, read-only `select`) into a scratch file; for each, `L.deserialize` → `L.yardRepair(s, F.farm())` must return 0 and the soil count must be unchanged (`test/buildings.test.js`, a test that reads the files from a path in an env var and skips without it).
- [ ] **Step 4:** Screenshot an unmoved farm before (game `78b8af5`) and after: the house, ranch, ponds, stand and field in the same places (look at them side by side).
- [ ] **Step 5:** `docs/edit-farm.md`: mark Part 1 done, list what moved and the save flag `ef`. Commit.
- [ ] **Step 6:** iPhone and OPPO (only when the owner says the phones are free): open the farm, enter and leave the house, fish at a pond, buy at Lily's, move the ranch and the house in Decorate, a raid practice.

---

## Self-review

**Spec coverage:** house, ranch (barn, coop, pen, incubator), dog yard, stable, Lily's stand, 3 ponds, field as 4x4 plots + leftover 4x2: Tasks 1, 5, 7. No overlaps, doors/gates reachable: Task 3 (`L.farmFor` needs) + existing reachability. Never on road/border: the frame's `noPlace` (unchanged). Plot carries crops: existing `L.moveYard` (Task 10 test). House and ranch can't be stored: Task 5. Migration, nobody's farm changes: Tasks 4, 5, 11 (real saves, screenshots). Older app saves still open (append-only types): Task 1. Visits: Task 9. Town Raid crops (soil-based, unchanged) and raids: Task 8. Quests' zone/house_door targets: objects/zones are re-made by Task 7. Farm trees inside the border becoming choppable: **not in Part 1** (they are drawn map tiles; leave for Part 2 with the layouts). Layouts, "Use for raids", tour: **Part 2**.

**Open checks written into the tasks:** the exact ranch/dog-yard masks against the map (Task 1), the prop names to remove (Task 4), the build function name and plot counting (Task 5), the mailbox and doghouse pictures (Task 7), the page size (Task 6).
