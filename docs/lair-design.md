# Bakunawa's Lair — design (owner approved 4 Nov 2026: "Use agent and build this")

A dungeon under Magayon Peaks, "like the mine but something else, so players have something to grind". Instead of
breaking rocks with a hammer you clear floors of fire creatures from Filipino legend (drawn cute) with your Bow.

## What is already written (do not rewrite; extend)

- `src/00-zzzzzzlair.js` — content: five creatures appended to `C.WILD.order` / `C.WILD.animals` (`santelmo`, `sigbin`,
  `tikbalang`, `bungisngis` guard of every 10th floor, `bakunawa` floor-50 crew boss with `great: true`), `C.WILD.areas.lair`
  (so `L.isWildMap('lair')` is true and it opens at 40 hunts like Magayon), `C.LAIR` (50 floors, lift every 10, boss every
  10), six new items (`ember_shard`, `santelmo_flame`, `sigbin_horn`, `tikbalang_mane`, `bungisngis_tooth`, `bakunawa_scale`,
  all kind `'hunt'` so Kanor already buys them), icon names `bow_4` and `gear_charm`, the Magma Bow (`C.MAGMA_BOW`, bow level 4:
  range 7, damage 3) and the Fire Charm (4th `C.GEAR` piece, gold plus goods).
- `src/01-logicN.js` — rules: `L.lairRoster(floor)` → `[{slot, kind}]`, `L.lairHp(kind, floor)`, `L.lairBossFloor`,
  `L.bakunawaReady(s)` / `L.bakunawaHunted(s)` (once a day), `L.lairReach(s, floor)` (deepest, true when new),
  `L.lairStops(s)` (1, 11, 21 … reached), `L.makeMagmaBow(s)`, `L.chargeLoss(s, hit)` (Fire Charm; already used by
  `P.wildHit` in 19v-wild.js), `L.hunted` leaves no `lair:` timer. Saved `s.lair = {deep, bk}` as `lr`, Magma Bow as `mb`.
- `test/lair.test.js` — unit tests for the above (passing).
- Each creature borrows an existing animal row of `assets/wild.png` (`def.sheetRow`, e.g. `'labuyo'`) with `def.tint`
  until its own art comes. **Its own row does not exist yet in wild.png**: `frameOf(kind, k)` in 19v-wild.js must use
  `WI.order.indexOf(def.sheetRow || kind)` and the image must be tinted (`setTint(def.tint)`; the shadow untinted).

## The game, in one paragraph

In Magayon Peaks there is a cave mouth (`lair_mouth`) near the north edge. Walk in: floor 1 of the Lair (map key `lair`,
floor in `F.session.lairFloor`, like `F.session.mineFloor` for the mine). A floor is a lava cave room (one map, `maps/lair.json`,
used for every floor, like the mine). Its creatures are `L.lairRoster(floor)`; a cleared creature does not come back on that
floor during this visit (no walking-in from the edges in the Lair: `wildArrive` does nothing there, except the Bakunawa,
which, like the Great Mammoth, only rises when two or more hunters are on floor 50, and only if `L.bakunawaReady`). The
`lair_gate` (down) is closed until every creature on the floor is down; then it glows, and walking onto it goes to floor + 1
(`L.lairReach`). A ladder by the way in climbs out to Magayon. A lift by the way in (`L.lairStops`) takes you to 1, 11, 21 …
Guards: `bungisngis` on floors 10, 20, 30, 40 with `L.lairHp`, a health bar like the Great Mammoth's. Floor 50 is the last.
The Bow, arrows, the dog (19zn-hunt-dog.js), Hunter's gear and hunting with friends all work there because it is a wild map.

## Who does what (files are owned; do not edit another owner's files)

| Owner | Files |
|---|---|
| Lead (main session) | `src/00-zzzzzzlair.js`, `src/01-logicN.js`, `test/lair.test.js`, `src/19zu-lair-ui.js` (Kanor's rows: Magma Bow, Fire Charm; the tour; What's new), `src/00-news.js`, `test/later.test.js`, `test/hunt.test.js`, `package.json` |
| Art agent | `tools/art/*` (new `tools/art/lair-icons.js`), `assets/items.png`, `assets/items.webp`, `art-src/**` (new `art-src/LAIR-PROMPTS.md`), `src/10-boot.js` only if the items sheet frame config must change, `test/wild.test.js` (the icon-order test), the items-sheet test |
| World agent | `maps/lair.json`, `maps/magayon.json`, `tools/make-map.js`, `tools/tiles.js`, `src/19zt-lair.js` (new), and small marked edits in `src/19v-wild.js`, `src/19h-online.js`, `src/19zm-hunt-together.js`, `src/19zl-packs-ui.js`, `src/19r-follow.js`; tests appended at the END of `test/e2e.test.js` and `test/e2e-online.test.js` |

Only the world agent runs `node build.js` and the e2e suites while the agents work. The art agent runs only the art
tools and `npm test`. Never commit; the lead commits.

## Rules of this repo (both agents)

- ES5 in `src/` (Phaser 3, one offline page). Files load in name order. Wrap, don't rewrite: `var x = P.x; P.x = function () { … x.call(this, …) }`.
- Comments say why, in plain words, like the files around them. Owner rulings are quoted with a date.
- Never bump `SAVE_VERSION`. New save keys only through `L.serialize` / `L.deserialize` wrappers.
- Presence events: names match `/^[a-z]{1,16}$/`; presence fields are cleaned in `19h-online.js` `clean`.
- `npm test` (unit), `node --test --test-timeout=900000 test/e2e.test.js`, `node --test --test-timeout=900000 test/e2e-online.test.js`.
  No `--test-name-pattern`-less runs of the two e2e suites more than needed (they take ~10 min each).
- The items sheet: `assets/items.png` 8 columns (for the importers), `assets/items.webp` 16 columns (what the game loads;
  no side over 4096 px), 128 px icons at 144 px pitch, margin 8. It is full at 256 icons; the Lair adds 8 (264).
- Pop-ups always centred. It must look right in the Classic and Glass looks of the app (the game page is the same).
- Every new feature gets a first-time tour (the lead writes the Lair's).
