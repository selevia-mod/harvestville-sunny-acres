# Hunting places engine (owner, 6 Nov 2026)

How to add one of the ten new hunting places (Banaue Terraces, Chocolate Hills, Taal Lake, Sierra Madre, Palawan
Underground River, ...) on top of the shared engine. A place is **one data file + two maps** (its own map and its
cave). You should not need to read the engine's code; this page is the contract.

Engine files (do not change them for one place; if you must, say so in your report):

| File | What it is |
|---|---|
| `src/00-zzzzzzzzz-places.js` | the registry `F.addPlace`, gear slots, taming defaults, companion skills, medals, `F.placeIcons` |
| `src/01-logicZZZZ-places.js` | the rules and the save (gear math, taming, medals, chests, story, % explored, the cave's floors) |
| `src/19zt-lair.js` | the Lair's code, now run for every cave (`F.dungeonOf(map)` gives the cave's settings) |
| `src/19zzzzz-places.js` | the world and the pages: the Jeep, the person, chests, taming, companion, Gear, Medals, Kanor's tabs, tours |
| `tools/make-map.js` | `placeCave()` and `caveMouth()` helpers for your maps; `samplePlace()` as an example |
| `test/places.test.js` | unit tests; the first test checks **every** place's data, so run it after adding yours |

## 1. Your data file

Name it `src/00-zzzzzzzzzz-place-<nn>-<id>.js` (ten z's), `nn` = the owner's number (01 Banaue ... 05 Palawan). It must
load after `src/00-zzzzzzzzz-places.js` (nine z's) and after Central Park's `00-zzzzzzzzz-park.js`; ten z's does both.

```js
(function (F) {
  'use strict';
  var C = F.Config;
  F.addPlace({
    id: 'banaue', n: 11,                 // n = 10 + the owner's number (11..20). Medal codes are n*100+..., so never reuse one.
    name: 'Banaue Terraces', unlock: 60, // opens at 60 hunts (s.wild.n)
    map: 'banaue',                       // maps/banaue.json
    grass: 1,                            // which tuft the animals stand in: 0 Pulag, 1 Makiling, 2 Magayon (optional)
    icon: 'feather_itik',                // its row icon in the Jeep's list (optional)
    shut: 'Banaue is far up north',      // optional: Kanor's line when it is still shut
    opened: 'BANAUE TERRACES IS OPEN\nKanor: "..."', // optional: said once, the hunt that opens it

    items: {                             // NEW items only (an item from before: just name it in drops/needs)
      feather_itik: { name: 'Itik Feather', kind: 'hunt', sell: 40, standIn: 'feather_labuyo', desc: '...' },
      meat_itik: { name: 'Itik Meat', kind: 'meat', sell: 50, standIn: 'meat_labuyo', desc: '...' },
    },
    creatures: {                         // the map's animals (rows of C.WILD.animals, same fields as src/00-wild.js)
      itik: { name: 'Wild Duck', sheetRow: 'labuyo', tint: 0xd8c8a0, sheet: 'wild_itik',  // see "Art" below
              px: 165, w: 0.9, kg: 1.2, hp: 1, walk: 0.6, run: 4.6, shy: 2.8, flies: true,
              drops: [['meat_itik', 1, 1], ['feather_itik', 1, 0.7]] },
      bayawak: { ..., angry: 2.6, hit: 10, ground: true },
      golden_itik: { ..., rare: true, respawn: 120 },
    },
    animals: { itik: 3, bayawak: 2 },    // how many roam (like C.WILD.areas)
    extra: [{ kind: 'golden_itik', n: 1, when: 'rare' }],    // 'dawn' | 'dusk' | 'rain' | 'fall' | 'rare'

    tame: { kind: 'some_creature', food: 'heirloom_rice', feedings: 8, runOff: 0.2, back: 20, skill: 'fetch' },
    //   kind: one of `creatures` (it becomes tameOnly: never for the Bow); food: any item id;
    //   skill: 'fetch' (picks up drops near you) | 'spot' (says when a rare one is out) | 'arrows' (finds arrows)
    //   feedings 6-10, runOff = chance it runs off after a feeding, back = minutes until it is back.

    gear: { name: 'Terrace', pieces: {   // Kanor makes these (his Make tab). id = the icon's id in places-items.json
      head:  { id: 'terrace_hat',     name: 'Terrace Hat',     standIn: 'gear_cloak', needs: [['feather_itik', 6]], gold: 3000 },
      body:  { id: 'terrace_vest',    name: 'Terrace Vest',    standIn: 'gear_cloak', needs: [...], gold: 5000 },
      feet:  { id: 'terrace_sandals', name: 'Terrace Sandals', standIn: 'gear_boots', needs: [...], gold: 3000 },
      charm: { id: 'terrace_charm',   name: 'Terrace Charm',   standIn: 'gear_charm', needs: [...], gold: 5000 },
    } },
    //   Head/Feet take 1 off each charge, Body/Charm 2, all four 2 more vs THIS place's creatures (map and cave). Min 1.

    chests: [[4, 3], [20, 7], [9, 18], [25, 22], [14, 12]],   // 5 hidden chests: TILE positions on your map (free tiles)
    chestLoot: [['arrows', 5, 1], ['terrace_stone', 2, 1], ['heirloom_rice', 1, 0.5]],  // [item, n, chance] per chest

    npc: { name: 'Lola Bugan', look: 'clara', sheet: 'npc_lola_bugan', at: [12, 6], lines: [
      { text: 'Welcome to the terraces...' },                       // the first line has no need
      { text: '...', need: { hunts: 5 }, hint: 'Hunt here a few times.' },   // hint: shown while the next is locked
      { text: '...', need: { tame: 1 } },
      { text: '...', need: { boss: 1 } },
    ] },
    //   look: a villager key (C.VILLAGER_ORDER) used until `sheet` is in. need: hunts (here) | tame | guard | boss |
    //   chests (how many) | floor (deepest cave floor). Lines open one after another; 3-4 lines (at most 6).

    dungeon: {
      key: 'banaue_cave', name: 'Terrace Tunnels', floors: 10, liftEvery: 5, guardFloor: 5, bossFloor: 10,
      count: { base: 3, per: 4, max: 6 },   // creatures a floor: base + floor/per, at most max
      escort: 2,                            // how many come with the guard / the boss (default 2)
      creatures: {                          // the cave's own (they never walk in; the floor is the floor)
        kibaan: { ... }, cave_bayawak: { ... },
        kibaan_chief: { ..., boss: true },                              // the guard: boss: true gives it the big bar
        amomongo: { ..., boss: true, hp: 30, hpEach: 15, minHits: 3 },  // soloable; hpEach more per friend; minHits = a share
      },
      floorKinds: [['kibaan', 1, 10], ['cave_bayawak', 4, 10]],   // who is on which floors: [kind, from, to]
      guard: 'kibaan_chief', boss: 'amomongo',
      chest: [['staff_kibaan', 1, 1], ['fur_amomongo', 2, 1], ['arrows', 10, 1]],  // the boss's daily chest
      look: { floor: [3 colours], wall: [...], top: [...], crust: [...] },        // the cave tiles' colours (dark to light)
      lava: { rim: '#06161e', hot: ['#bff4ff', '#4ec4e0', '#1a6a8c'], plate: ['rgba(...)', 'rgba(...)'], embers: false },
      //     the 'void' pools: water or lava colours; embers: true for lava sparks
      bg: '#06141a', propTint: 0x9cc8d8, icon: 'staff_kibaan',   // background, the props' light, the lift's icon
      art: { mouth: 'props/banaue_mouth', gate: 'props/banaue_gate', cave: 'banaue_cave' },  // see "Art"
    },
  });
})(window.Farm = window.Farm || {});
```

`F.addPlace` throws (the page will not start, the unit tests fail at load) on a clash: an item, creature or id that
already exists, a medal code taken, a missing piece of gear, a tame food that is not an item.

What it does for you: makes `C.WILD.areas[id]` and `[dungeon.key]` (so the Bow, the dog, Hunter's gear, the Wild Lands
download pack, "join them?" and hunting with friends all work), the routes for the goal arrow, the four gear pieces, the
medals (first hunt, each animal, a giant of each, the rare one, guard, boss, tame, all chests, the story), the place's
line in the Jeep, and "% explored" (animals met incl. the tame, chests, story lines, guard, boss).

**Saved by name, never by index:** your creatures go in `C.WILD.more`, not `C.WILD.order`; places are saved by id
(`pl`), medals by code (`md`), gear by piece id (`gw`, `go`). So places can ship in any order. Do **not** push to
`C.WILD.order`, `C.TIPS` (in the middle), `C.COUNTERS` or any list saved by index from a place file.

## 2. Your two maps

Make them in `tools/make-map.js` (add your functions to `MAPS` and run `npm run map -- --force=<name>`), or in Tiled.
Look at `samplePlace()` and `placeCave()` there.

**The place map** (`maps/<map>.json`, any size; Pulag is 32 x 28). Objects (layer "Objects"):

| Object | type | name | Notes |
|---|---|---|---|
| the jeep back | `jeep` | `jeep` | a 2 x 1 rect: the jeep is drawn standing on it; tapping it opens the Jeep list |
| arrival | point, type `spawn` | `from_jeep` | where the jeep brings you; next to the jeep |
| roaming area | `wild` | `wild` | the rect the animals roam (like Pulag's) |
| cave door | `warp` | `dungeon_door` | props: `to` = your dungeon key, `spawn` = `entrance`, `walk` = true |
| cave mouth | point, type `place` | `dungeon_mouth` | half a tile right of the door's tile, its y = door's bottom; the mouth is drawn there and the rock round the door is made solid |
| back from the cave | point, type `spawn` | `from_dungeon` | just under the door |

`caveMouth(m, caveKey, cx, top)` in make-map adds the last four for the door tile (cx, top). Keep the `chests` tiles and
the person's `at` tile free (no props, no walls). The person stands on `npc.at`; chests are drawn on their tiles and
show as you come within 3 tiles.

**The cave map** (`maps/<dungeon.key>.json`): `placeCave(key, placeMap, { w, h, seed, pools, pillars, gate, props })`
builds one in the Lair's layout. Its rules:

- the indoor tileset's cave tiles (`cave`, `cave2`, `cave_wall`, `cave_top`), pools of `void` (painted lava or water
  in your `lava` colours);
- a `ladder_up` at (5, 2), spawn point `entrance` at (5.5, 3.6), warp `exit` at (5, 2) with `to` = your place map,
  `spawn` = `from_dungeon`, `label` = `Climb out`;
- the lift is drawn on tiles (2..3, 2..3) once you have a second stop: keep them floor;
- a `dungeon_gate` object (2 x 2) for the gate down (`lair_gate` works too);
- a `wild` rect for where the creatures roam.

Floors are not saved (as in the mine and the Lair): a game closed in the cave opens at `from_dungeon` on the place
map. A game closed on the place map opens there.

## 3. Art (the owner's pictures; drawn stand-ins until they exist)

The ids are fixed in `docs/places-items.json`. Wire them by name; the engine falls back to stand-ins by itself.

| Picture (art-src/places/<place>/) | Goes to | How the engine uses it |
|---|---|---|
| `icons_<id>.png` (4 x 4, json order) | painted into `assets/items.png` by your import step | then call `F.placeIcons([...16 ids in json order])` at the top of your data file. Until then items use `standIn`. Never call it before the art is in the sheet (an icon past its end draws nothing). Ids from before (`kaldereta`) keep theirs. |
| `wild_<creature>.png` (3 x 4) | `assets/wild_<creature>.png` + `wild_<creature>shade.png`, 12 frames in the wild sheet's order and frame size (224 x 252, margin 8, spacing 16; see tools/art/wild3q-import.js) | `sheet: 'wild_<creature>'`, `row: 0`. Until the image exists: `sheetRow` (another animal's row) + `tint`. |
| `npc_<name>.png` (3 x 3) | `assets/npc_<name>.png` in the villagers' frame size (128 x 192, 9 frames like a `people` row) | `npc.sheet`. Until then `npc.look` (a villager). |
| `<id>_mouth.png`, `<id>_gate.png` | `assets/props/<id>_mouth.png`, `assets/props/<id>_gate.png` (gate: shut and open side by side, 4 px apart, like `props/lair_gate`) | `dungeon.art.mouth` / `.gate`. Until then the drawn mouth (tinted `propTint`) and the drawn stone gate. |
| `<id>_cave_floor/_water/_rock_top/_rock_face.png` | one strip `assets/<id>_cave.png` laid out like `assets/lair_cave` (tiles of 128: cave, cave2, wall, top, void; then the pool texture 192 px at x = 640; see tools/art/lair-world-import.js) | `dungeon.art.cave`. Until then the Mine's cave tiles painted in `look` colours, pools in `lava` colours. |
| `ground_<id>.png`, `ground_<id>_water.png`, `props_<id>.png` | your map's tileset / props (tools/tiles.js, tools/art) | your map |
| the jeep | `assets/props/kanor_jeep.png` (optional) | drawn stand-in until then |

Big art belongs in the `wild` pack (tools/packs.js) like Pulag's, not in the page. **Page size**: after the engine the
page is about 19.0 MB of a 19.5 MiB limit (build.js stops past it). Each map is 25-35 KB; keep art in packs.

## 4. Tests

- `test/places.test.js`'s first test validates every place's data: run `node --test test/places.test.js`.
- Your place's own unit tests: a new `test/<id>.test.js`, added to `package.json`'s `test` script.
- e2e: copy the `hunting places (SAMPLE)` test in `test/e2e.test.js` (Jeep, tame, chest, person, cave, boss chest,
  medals) and the online one in `test/e2e-online.test.js` (two phones, the boss stronger for two, a chest each), for
  your place. In tests, `window.gameHost.devPlaces = true` shows `dev: true` places.
- Old tests that check "the newest icon is last" (`test/players.test.js`: `chocolate_cake`) need updating once you append
  icons with `F.placeIcons`.

## 5. Removing the sample

Delete `src/00-zzzzzzzzzz-place-99-sample.js`, `maps/sample_place.json`, `maps/sample_cave.json`, the
`sample_place`/`sample_cave` entries in `tools/make-map.js`' `MAPS`, the tests marked SAMPLE in `test/places.test.js`
and the two `hunting places (SAMPLE)` e2e tests; rebuild. Nothing else refers to it.

## 6. What the engine does not do (yet)

- **Friends see your companion?** No: your companion is drawn only on your phone.
- **Hunting now / Biggest catch** (server, part 14): the server knows only Pulag, Makiling and Magayon, so a hunter in a
  new place shows as "in Pulag", and place creatures are not on the Biggest catch board. A server change (SQL) is
  needed for more; the engine sends nothing new.
- **Medals for friends** ride in the farm snapshot (`md`, already published with the farm): no server change.
- **What's new**: none from the engine; each place adds its own line (Central Park took 2.4; use the next).
