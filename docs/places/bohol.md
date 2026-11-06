# Place 12: Chocolate Hills (Bohol) and the Hill Hollows

Owner, 6 Nov 2026. Opens at **80 hunts**, one step past Banaue Terraces (place 11). Kanor's Jeep at his Lodge takes
you there. Until your pictures come in, everything uses drawn stand-ins.

Files: `src/00-zzzzzzzzzz-place-12-bohol.js` (all the numbers), `src/01-logicZZZZZ-place-12-bohol.js` (Mang Tonyo's
gifts), `src/19zzzzzz-place-12-bohol.js` (the drawn props and the round door), `maps/bohol.json`, `maps/bohol_cave.json`
(made by `tools/make-map.js`: `bohol()`, `boholCave()`), tests `test/bohol.test.js` and the e2e
`hunting places: Chocolate Hills`.

## The place

- **Map** (32 x 28, Pulag's size): green grass with dome hills (golden-brown on top, green at the bottom), a calm green
  river from the top edge down into a pool (you can't walk in it; you can fish in it), Mang Tonyo's nipa hut and one more,
  coconut palms, bamboo fences, cogon grass, limestone rocks. The Jeep is at the bottom left; the trail goes past the hut
  up to the Hill Hollows' round door.
- **The round door**: a door in the side of a small hill with a polite offering in front (flowers and a banana on a stone
  plate). The first time you go in each day: *"Tabi tabi po." You ask the Nuno's leave, and step softly into the Hill Hollows.*
- **5 hidden chests**: each gives 8 Arrows, 2 Peanut Kisses, 2 Limestone Chips, and half the time 1 Kape Alamid.

## Animals

| Animal | How it acts | Arrows (hp) | Charge | Drops |
|---|---|---|---|---|
| Wild Goat (3 about, 1 more at dawn) | shy, runs at 4.4 tiles | 3 | - | 2 Goat Meat, Goat Horn (1 in 2) |
| Musang (2 about, 1 more at dusk) | charges at 3.2 tiles | 4 | 13 energy | Musang Tail, Kape Alamid (about 1 in 3) |
| Cocoa Goat (rare) | very shy, fast | 6 | - | 3 Goat Meat, Cocoa Horn |

For comparison: Magayon's bear is 5 hp, 12 energy a charge.

## Taming: the Wild Goat Kid

A young wild goat (the Wild Goat's picture, smaller). Hold **Cabbage**, walk up slowly while it is calm, Feed.
**9 feedings**; after each one there is a **1 in 4** chance it runs off, back in **25 minutes**. Tamed, it follows you
and **fetches** what a hunt leaves on the ground near you. (Wild Goats themselves stay huntable; the kid is the one with
hearts over it.)

## Mang Tonyo, the Bohol guide

Stands by his hut. Four lines; each gives a small gift the first time you read it.

| When | Gift |
|---|---|
| First visit | 3 Peanut Kisses |
| After 5 hunts in the hills | 1 Kape Alamid, 3 Cabbage (for the kid) |
| After the Punso Golem (floor 5) | 15 Arrows, 3 Peanut Kisses |
| After the Great Nuno (floor 10) | 2 Kaldereta, 4 Peanut Kisses |

## The Hill Hollows (10 floors)

Cream limestone with still turquoise cave pools. Each floor: 3 creatures, one more every 4 floors (at most 5). Clear a
floor and the gate down opens; the lift stops at floors 1 and 6 once you have reached them.

| Creature | Floors | Arrows (hp) | Charge | Drops |
|---|---|---|---|---|
| White Duwende | 1-10 | 3 | shy | Duwende Hat (6 in 10), Limestone Chip |
| Black Duwende | 3-10 | 4 | 12 energy | Duwende Pebbles (6 in 10), Limestone Chip |
| **Punso Golem**, the guard of floor 5 (with 2 more) | 5 | 22 | 15 energy | 2 Punso Clay, 3 Limestone Chips |
| **Great Nuno**, the boss of floor 10 (with 2 more) | 10 | 34 alone, +16 for each friend | 18 energy | Nuno Moss, Punso Clay |

The Great Nuno is grumpy but kind: soloable, harder with friends (each must land 3 hits to share him).
**His daily chest** (once a day; missed days add up, up to 3 waiting): 1 Nuno Moss, 3 Peanut Kisses, 2 Kape Alamid,
4 Limestone Chips, 15 Arrows, and half the time 1 Punso Clay.

## The Hollow set (Kanor's Make tab)

| Piece | Needs | Gold | Takes off a charge |
|---|---|---|---|
| Hollow Hat | 6 Goat Horns, 2 Musang Tails | 3,500 | 1 |
| Hollow Vest | 6 Musang Tails, 4 Duwende Hats | 6,000 | 2 |
| Hollow Boots | 4 Goat Horns, 4 Duwende Pebbles | 3,500 | 1 |
| Hollow Charm | 3 Punso Clay, 1 Nuno Moss | 6,000 | 2 |

All four: 2 more off against the hills' and the Hollows' own creatures (a Musang's 13 becomes 5, the Nuno's 18 becomes 10).
(The gear rule, owner 7 Nov 2026: each piece works only against this place's own creatures, here and in its dungeon; a charge never costs under a third of its hit with the gear, and the Fire Charm works only from Pulag to the Lair.)

## Food and drops

| Item | Sells for | Notes |
|---|---|---|
| Kaldereta | (as before) | now also cooks from **Goat Meat + Potato + Bell Pepper** (kalderetang kambing); the bear one stays |
| Peanut Kisses | 45 | a Bohol cookie: +20 energy; from Mang Tonyo, the chests and the Nuno's chest |
| Kape Alamid | 180 | civet coffee: +25 energy; Kanor buys it |
| Goat Meat 70, Goat Horn 95, Musang Tail 140, Cocoa Horn 900 | | |
| Duwende Hat 240, Duwende Pebbles 280, Punso Clay 1,400, Nuno Moss 4,800, Limestone Chip 35 | | |

## Medals (codes 1200-1214)

First hunt in Chocolate Hills, Punso Golem defeated, Great Nuno defeated, Wild Goat Kid tamed, Every chest, Mang
Tonyo's story, Wild Goat, Giant Wild Goat, Musang, Giant Musang, Rare: Cocoa Goat. "% explored" counts the 3 animals
and the kid, the 5 chests, the 4 lines, the guard and the boss.

## Your pictures (art-src/places/bohol/) and where they go

The game looks for these names and uses them as soon as they are in; until then, the stand-in.

| Picture | Goes to | Until then |
|---|---|---|
| `icons_bohol.png` (16 icons) | painted onto the end of `assets/items.png`; then un-comment `F.placeIcons(C.BOHOL_ICONS)` in the data file | each item borrows an icon (antler, venison, coffee, cookie, ...) |
| `wild_kambing.png`, `wild_musang.png`, `wild_cocoagoat.png` | `assets/wild_kambing.png` (+ `...shade.png`), and so on | the deer and wolf rows, tinted |
| `wild_duwendeputi.png`, `wild_duwendeitim.png`, `wild_punsogolem.png`, `wild_greatnuno.png` | `assets/wild_<name>.png` (+ shade) | the Lair's giant and the bear rows, tinted |
| `npc_mang_tonyo.png` | `assets/npc_mang_tonyo.png` | Marco's look |
| `bohol_mouth.png` | `assets/props/bohol_mouth.png` | the drawn hill with a round door |
| `bohol_gate.png` (shut, open) | `assets/props/bohol_gate.png` | the engine's stone seal |
| `bohol_cave_floor/_water/_rock_top/_rock_face.png` | one strip `assets/bohol_cave.png` (like `lair_cave`) | the Mine's cave tiles in cream colours, pools in turquoise |
| `ground_bohol.png`, `ground_bohol_water.png` | `assets/ground_bohol.png`, `assets/ground_bohol_water.png` | the Wild Lands grass; the water tile tinted green |
| `props_bohol.png` (6 props) | cut into `assets/props/bohol_hill/_hut/_palm/_fence/_cogon/_rock.png` | drawn hills, huts, palms, fences, cogon, rocks |

The big ones (animals, Mang Tonyo, the ground, the props) belong in the Wild Lands download pack (`tools/packs.js`), not
in the page. The import step that cuts and paints them is still to be written (like `tools/art/lair-world-import.js`).

## Not done / to know

- The kid is drawn as a smaller Wild Goat (no separate picture asked for).
- The gate down in the Hollows is the engine's drawn stone seal (with a moon) until `bohol_gate.png` is in.
- Hunting now / Biggest catch on the server still say Pulag for anyone here (the engine's note: a server change is needed).
- No What's new line (owner).
