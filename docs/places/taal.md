# Place 13: Taal Lake (and Taal Crater)

Owner's decisions, 6 Nov 2026. Built on the hunting places engine (docs/hunting-places-engine.md).

- Opens at **100 hunts**. Ride Kanor's Jeep from his Lodge in Pulag. The jeep waits at the south-east of the lake to bring you back.
- Files: `src/00-zzzzzzzzzz-place-13-taal.js` (all the data and numbers), `src/01-logicZZZZZ-place-13-taal.js` (Mang Celso's
  gifts), `maps/taal.json` and `maps/taal_crater.json` (made by `tools/make-map.js`: `npm run map -- --force=taal`).
- Everything is drawn with stand-ins until your pictures come in (list at the end).

## The map

A lakeshore on the volcano island, Pulag's size (32 x 28). Dark volcanic sand with patches of grass. The big blue lake fills
the north-east: you cannot walk on it, but you can **fish** from it, best from the end of **Mang Celso's wooden pier**.
Two fishing bancas on the sand, reeds, mango trees, steaming rocks and two nipa huts. The trail runs from the jeep past
Mang Celso and his pier, up to the **crater cave mouth** at the north-west.

## Animals

| Animal | What it does | Health (arrows) | Charge costs | Drops | Back after |
|---|---|---|---|---|---|
| Tagak (egret) x4 | shy, flies off over the lake | 2 | - | Tagak Plume (always), Lake Shell (1 in 2) | 15 min |
| Buwaya (cute crocodile) x2 | charges | 7 | 15 energy | Buwaya Hide (always), Buwaya Tooth (6 in 10) | 15 min |
| Royal Tagak (rare) | very shy, fast, flies | 3 | - | Royal Plume + 2 Tagak Plumes | 2 hours |

## Taming: the Little Tagak

The grown Tagak stays a hunt, so the one you tame is a **Little Tagak** (a young egret that follows Mang Celso's banca for
fish). It walks the shore with the others but the Bow never aims at it.

- Food: **Small Fish** (the lake mostly gives these; Mang Celso also gives you 5).
- **9 feedings**. After a feeding it may fly off (about 1 in 5); it comes back in 20 minutes.
- Its skill: **Spotter**: it tells you when a rare animal (like the Royal Tagak) is out.

## Taal Crater (the dungeon)

10 floors of steaming crater: yellow sulfur rock and pools of green crater water. Clear a floor and its gate down opens.
The lift by the ladder stops at floors 1 and 6 once you have been there.

| Creature | Floors | Health | Charge costs | Drops |
|---|---|---|---|---|
| Siyokoy | 1-10 | 4 | 12 | Siyokoy Fin, Sulfur Chip (1 in 2) |
| Kataw | 3-10 | 6 | 13 | Kataw Pearl (6 in 10), Siyokoy Fin, Sulfur Chip |
| **Lava Buwaya** (floor 5 guard) | 5 | 26 | 17 | Lava Scale, 2 Buwaya Hides, 3 Sulfur Chips |
| **Berberoka** (floor 10 boss) | 10 | 40 alone, +18 for each friend | 19 | Berberoka Pearl, 2 Kataw Pearls, 4 Sulfur Chips |

- Creatures on a floor: 3, one more every 3 floors, at most 7. The guard and the boss each come with 2 others.
- The Berberoka can be beaten alone. With friends it has more health, and each friend needs 3 hits to share it.
- **The boss's daily chest**: once a day; missed days add up, up to 3 waiting. Each holds 2 Kataw Pearls, 4 Sulfur Chips,
  15 Arrows, and maybe a Lava Scale (1 in 2) and a Berberoka Pearl (1 in 4).

## Lakeguard gear (Kanor makes it: his Make tab)

| Piece | Needs | Gold | Takes off each charge |
|---|---|---|---|
| Lakeguard Salakot (head) | 6 Tagak Plumes, 4 Lake Shells | 4,000 | 1 |
| Lakeguard Vest (body) | 4 Buwaya Hides, 2 Buwaya Teeth | 7,000 | 2 |
| Lakeguard Boots (feet) | 4 Siyokoy Fins, 6 Sulfur Chips | 4,500 | 1 |
| Lakeguard Charm (charm) | 1 Berberoka Pearl, 3 Kataw Pearls, 4 Sulfur Chips | 7,500 | 2 |

All four on: 2 more off against Taal's own animals and crater creatures (a Buwaya's 15 becomes 7). A hit never costs less than 1.

## Mang Celso, the Taal fisherman

He stands by his pier. His story opens step by step, and each step gives a small gift once:

| Step | Opens when | Gift |
|---|---|---|
| 1 | your first visit | 1 Kapeng Barako |
| 2 | 5 hunts at Taal Lake | 5 Small Fish (to start taming) |
| 3 | the Lava Buwaya is beaten | 1 Tapang Taal, 4 Sulfur Chips |
| 4 | the Berberoka is beaten | 3 Kapeng Barako, 500 Gold |

## Hidden chests (5)

At the end of the pier, in the reeds by the crater path, beside a nipa hut, by the crater mouth, and on the far shore. They
show when you come within 3 tiles. Each holds 8 Arrows, 3 Small Fish, 2 Sulfur Chips, and maybe a Kapeng Barako and 2 Lake Shells.

## Local food

| Item | What | How |
|---|---|---|
| Tapang Taal | dish, +110 energy (the best dish so far; Bistek is 100), sells 240 | kitchen: Boar Meat + Garlic + Egg |
| Kapeng Barako | drink, +35 energy, sells 70 | kitchen: Coffee Beans |
| Sulfur Chip | material, sells 45 to Kanor | crater creatures, chests; Kanor uses it for the Lakeguard Boots and Charm |

## Item prices (sold to Kanor)

Tagak Plume 55, Lake Shell 40, Buwaya Hide 260, Buwaya Tooth 190, Royal Plume 950, Siyokoy Fin 210, Kataw Pearl 360,
Lava Scale 750, Berberoka Pearl 2,600.

## Medals (11)

First hunt in Taal Lake, Lava Buwaya defeated, Berberoka defeated, Little Tagak tamed, every chest, Mang Celso's story,
Tagak, Giant Tagak, Buwaya, Giant Buwaya, Rare: Royal Tagak. (Codes 1300-1314.)

## How it compares (a step above Chocolate Hills)

The Buwaya is a Magayon-sized fight (bear 5 health, rhino hit 16). The guard and boss are above the Lair's floor guard
(Bungisngis, 24) but under the Bakunawa (60, for groups). Chocolate Hills (place 12) is being built at the same time by
another session; a test checks that its boss stays under the Berberoka once both are in.

## Your pictures (art-src/places/taal/), and what shows until then

| Picture | Wired as | Until it is in |
|---|---|---|
| wild_tagak.png | the Tagak and the Little Tagak (smaller) | the Labuyo, tinted white |
| wild_buwaya.png | the Buwaya | the Wild Boar, tinted green |
| wild_royaltagak.png | the Royal Tagak | the Labuyo, tinted pale blue |
| wild_siyokoy.png | the Siyokoy | the Sigbin, tinted green |
| wild_kataw.png | the Kataw | the Tikbalang, tinted blue |
| wild_lavabuwaya.png | the Lava Buwaya | the Rhino, tinted orange |
| wild_berberoka.png | the Berberoka | the Bungisngis, tinted sea green |
| npc_mang_celso.png | Mang Celso | Grandpa Ewan (the retired fisherman) |
| taal_mouth.png, taal_gate.png | `props/taal_mouth`, `props/taal_gate` | the drawn cave mouth and stone gate |
| taal_cave_floor/_water/_rock_top/_rock_face.png | `taal_cave` (one strip, like `lair_cave`) | the Mine's cave tiles painted yellow, pools painted green |
| icons_taal.png (16 icons) | the item ids in docs/places-items.json | each item borrows an icon from before (feather, coffee, crystal...) |
| ground_taal.png, ground_taal_water.png, props_taal.png | not yet (see below) | Magayon's ash, the Wild Lands grass, sand, water and dock tiles; the boat, bamboo, rainforest tree, sulfur vent, boulder and shop-hut props |

Still to do when the pictures arrive (an import step, like the Lair's): paint the creature sheets, Mang Celso, the mouth,
the gate and the cave strip into `assets/` (the game picks each up by its name on its own), paint the icons into the
items sheet and only then call `F.placeIcons` in the data file, and give the ground and the six props their own tiles.
The ground/props tiles are left for after all five places are merged, because each new tile or prop takes the next number
in a shared list and five places adding them at once would clash.

## Not in this place (yet)

- Friends see "in Pulag" for someone hunting at Taal, and Taal's animals are not on the Biggest catch board (the server
  knows only Pulag, Makiling and Magayon; that needs SQL, not done).
- Taal's items are not in the Collection book (its list is saved by position; adding to it is a shared job).
- No What's New line (as asked).
