# Place 15: Palawan Underground River (owner, 6 Nov 2026)

Opens at **160 hunts**. Ride Kanor's Jeep from his Lodge in Pulag. Its dungeon is the **River Caves** (10 floors).

Files: `src/00-zzzzzzzzzz-place-15-palawan.js` (all the data), `maps/palawan.json` and `maps/palawan_cave.json`
(made by `palawan()` and `MAPS.palawan_cave` in `tools/make-map.js`), tests `test/palawan.test.js` and the e2e
"hunting places: Palawan Underground River".

## The place

A jungle beach at Sabang, about Pulag's size (32 x 28 tiles):

- white sand to the south, tropical grass and jungle to the north;
- the turquoise river (you cannot walk on it) runs up from the sea into the limestone cliff;
- Mang Pido's small boat dock, with his bangka, and a plank bridge to the east bank;
- karst spires along the cliff, mangroves, red-flowering bushes, coconut palms, jungle grass where animals hide;
- the Jeep stop at the bottom left, the River Caves mouth under the cliff, next to where the river goes into the rock.

Until your ground and props art comes in, the map uses Pulag's tiles and the Wild Lands props: the karst spire is the
mossy boulder, the mangrove the rainforest tree, the red bush the fern bush, the coconut palm the pili tree, the river
the town's water.

## Animals

| Animal | What it does | Health | Hit | Drops |
|---|---|---|---|---|
| Paniki (fruit bat) | shy, flies off | 2 | - | Wild Figs (always: the fruit it carried), Paniki Wing (60%) |
| Sawa (chubby python) | charges | 8 | 16 | Sawa Skin, Sawa Scale (60%) |
| Golden Sawa (rare) | charges | 12 | 18 | 2 Sawa Skin, Golden Scale |

3 Paniki and 3 Sawa roam; 2 more Paniki at dusk, 1 more Sawa in the rain; the Golden Sawa when the rare one is out.

## Taming: the Paniki Pup

A little Paniki pup roams too (the grown Paniki are the ones you hunt). Hold a **mango**, sneak up while it is calm,
Feed. **10 feedings**; after each it may fly off (1 in 4) and comes back in 25 minutes. Its skill: **Spotter** (it
says when a rare animal is out and points the way).

## Mang Pido, the Sabang boatman

He stands at the land end of his dock. Four lines, each with a small gift, given once:

1. First visit: welcome, the River Caves are up by the cliff. Gift: 3 Mangoes.
2. After 5 hunts here: how to tame a pup. Gift: 3 Palawan Cashews.
3. After the guard (floor 5): the swiftlets sing about you. Gift: 15 Arrows.
4. After the boss (floor 10): the Minokawa went home to the sky. Gift: 1 Ginataang Alimasag.

(The gift is new in the engine: any place's line can have `gift: [[item, n]]`.)

## Hidden chests

5 chests (they show when you come within 3 tiles): at tiles (3, 4), (11, 9), (28, 5), (16, 21), (29, 21).
Each: 8 Arrows, 2 Palawan Cashews, 2 Stalactite Chips (70%), 2 Mangoes (50%).

## The River Caves

Wet limestone floors and a turquoise underground river. 3 creatures on a floor, one more every 3 floors, at most 6.
The lift stops every 5 floors you have reached.

| Creature | Floors | Health | Hit | Drops |
|---|---|---|---|---|
| Cave Crab | 1-10 | 6 | 14 | Crab Shell, Stalactite Chip (50%) |
| Glow Eel | 3-10 | 7 | 15 | Glow Light, Stalactite Chip (40%) |
| **Balinsasayaw Queen** (giant cave swiftlet), floor 5 guard | 5 | 28 | 17 | 2 Swiftlet Nests, 3 Stalactite Chips, Glow Light (60%) |
| **Minokawa** (the moon-eating bird of Bagobo legend), floor 10 boss | 10 | 42 alone, +14 for each friend | 20 | 2 Minokawa Feathers, Swiftlet Nest, Golden Scale (10%) |

The Minokawa is soloable; it takes 3 hits to share it with friends. It leaves a chest once a day for each hunter
(missed days add up, up to 3 waiting): Minokawa Feather, 4 Stalactite Chips, 15 Arrows, Golden Scale (25%),
2 Palawan Cashews (50%).

## The Cavern set (Kanor's Make tab)

| Piece | Needs | Gold |
|---|---|---|
| Cavern Hat (Head, 1 less a hit) | 8 Paniki Wings, 3 Glow Lights | 6,000 |
| Cavern Vest (Body, 2 less) | 8 Sawa Skins, 4 Sawa Scales, 4 Crab Shells | 10,000 |
| Cavern Boots (Feet, 1 less) | 4 Sawa Skins, 6 Crab Shells, 6 Stalactite Chips | 6,000 |
| Cavern Charm (Charm, 2 less) | 2 Minokawa Feathers, 3 Swiftlet Nests, 1 Golden Scale | 12,000 |

All four: 2 less again against Palawan's own animals and cave creatures (a hit never costs less than 1).

## Local food

- **Ginataang Alimasag** (dish): cook it in the Kitchen from a Crab Shell, Ginger and Chili. 120 energy, sells for
  420G. Its power: for 10 minutes, charges cost half the energy.
- **Palawan Cashews** (snack): 25 energy, from the chests, Mang Pido and the boss's chest.
- **Stalactite Chip** (material): from the cave; Kanor buys it, and the Cavern Boots need it.

## Medals (codes 1500 and up)

First hunt in Palawan, Balinsasayaw Queen defeated, Minokawa defeated, Paniki Pup tamed, every chest, Mang Pido's
story, Paniki, Giant Paniki, Sawa, Giant Sawa, Rare: Golden Sawa.

## How hard (the numbers)

The hardest of the first five places, still below the Lair's deep floors:

- the place's animals are tougher than Magayon's (its mammoth: 9 health, hits 18): the Sawa 8 / 16, the Golden Sawa 12 / 18;
- the River Caves' guard (28) and boss (42) are below the Lair's floor-40 Bungisngis (44) and the Bakunawa (60, hits 22);
- the unit test checks the boss is no weaker, and the Cavern Charm no cheaper, than any other new place's, once they
  are all in one game.

## Your art (art-src/places/palawan/, prompts 73-90 in PLACES-1-5-PROMPTS.md)

Wired by name, so each picture shows as soon as it is imported:

| Picture | Used as |
|---|---|
| `wild_paniki.png` | the Paniki and the Paniki Pup (`assets/wild_paniki.png` + `wild_panikishade.png`) |
| `wild_sawa.png`, `wild_goldensawa.png` | the Sawa, the Golden Sawa |
| `wild_cavecrab.png`, `wild_gloweel.png`, `wild_balinsasayaw.png`, `wild_minokawa.png` | the cave's creatures |
| `npc_mang_pido.png` | Mang Pido (`assets/npc_mang_pido.png`) |
| `palawan_mouth.png`, `palawan_gate.png` | `assets/props/palawan_mouth.png`, `assets/props/palawan_gate.png` |
| `palawan_cave_floor/_water/_rock_top/_rock_face.png` | one strip, `assets/palawan_cave.png` |
| `icons_palawan.png` | the 16 icons: then turn on the `F.placeIcons([...])` line at the top of the data file |

Not wired yet (they need a tiles/props import step first): `ground_palawan.png`, `ground_palawan_water.png`,
`props_palawan.png`. Until then: the stand-ins above.

Until the pictures come: every creature uses another animal's row, tinted (the Paniki a labuyo, the Sawa a boar, the
cave crab a sigbin, the eel a santelmo, the Queen a big labuyo, the Minokawa the Bakunawa); Mang Pido looks like
Hollis; each item borrows an icon (the figs are berries, the cashews a cookie, and so on).

## Not done

- The server's "Hunting now" and "Biggest catch" know only Pulag, Makiling and Magayon (engine note): a hunter here
  shows as in Pulag.
- No What's new line (owner).
