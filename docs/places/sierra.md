# Place 14: Sierra Madre (owner, 6 Nov 2026)

A deep mountain rainforest, open at **130 hunts**. Ride Kanor's Jeep from his Lodge in Pulag. Under the giant balete
tree is its dungeon, **Kapre's Roots**.

Files: `src/00-zzzzzzzzzz-place-14-sierra.js` (all the data and numbers), `src/01-logicZZZZZ-place-14-sierra.js`
(Ka Ramon's gifts), `maps/sierra.json` and `maps/sierra_cave.json` (made by `sierra()` and `sierra_cave` in
`tools/make-map.js`), tests `test/sierra.test.js` and the Sierra Madre test in `test/e2e.test.js`.

## The place

- **Map** (32 x 28, Pulag's size): mossy forest ground with orchids, a clear river from a small waterfall pool at the
  top (you cannot walk on it; a log bridge crosses it), giant narra trees, rattan palms, ferns, mossy logs, glowing
  mushrooms and jungle grass. The Jeep stops at the bottom left. Ka Ramon stands by the trail. Over the bridge, at the
  top right, the hollow under the giant balete is the way down.
- **Animals**: Unggoy (a shy long-tailed macaque, 4 about, 2 more at dawn; it drops the wild bananas it carried),
  Wild Carabao (charges; 3 about, 1 more in the rain), Silver Carabao (rare, at most 1).
- **Tame**: the **Little Unggoy**, a young one (the grown Unggoy stay for the Bow). Hold **Wild Bananas**, sneak up
  while it is calm, Feed. **10 feedings**; after each it may run off (1 in 4) and is back in about 20 minutes.
  Once tamed it **fetches**: it picks up what a hunt leaves on the ground near you.
- **Hidden chests**: 5 (arrows, wild honey, sometimes wild bananas or narra wood).
- **Ka Ramon, the forest ranger** (4 lines, each with a small gift the first time):
  1. First visit: welcome, "hunt only what you need" (2 Wild Honey).
  2. After 5 hunts here: about the Little Unggoy (10 Arrows).
  3. After the guard of floor 5: the Anggitay Queen guards the roots for the Kapre (2 Narra Wood).
  4. After the Kapre: "plant a tree for every one you take" (1 Kare-Kare, 1 Wild Honey).
  If you did more before talking to him, the gifts of the lines you skipped come all at once.
- **Local food**: **Kare-Kare** (a dish in the Kitchen: any meat + an eggplant + wild bananas, for the banana heart;
  +110 energy), **Wild Honey** (sweet: eat it, +30 energy), **Narra Wood** (a material: the Kapre Charm takes it;
  Kanor buys it). Mira's woodshop was not used: its recipes are saved by their place in a list, so adding one there is
  not safe from a place file.

## Kapre's Roots (10 floors)

Root-woven earth, glowing mushrooms, glowing blue-green pools (not walkable). The lift stops at floors 1 and 6.

- Floors 1-10: **Anggitay** (a small cheerful centaur girl; she gallops off when you come near). From floor 3:
  **Wood Spirits** (walking mossy stumps; slow, but they charge).
- Creatures a floor: 3, one more every 3 floors, at most 6.
- Floor 5: the **Anggitay Queen** (the guard) and two with her.
- Floor 10: the **Kapre**, a huge gentle tree giant covered in moss (no cigar, no smoke; a tree being, not a man).
  **Soloable**; 22 more health for each friend with you. Once a day he leaves a **chest**; missed days add up, up to 3.

## Numbers (a step above Taal Lake, place 13)

| Creature | Health (arrows) | Charges? | Energy a charge | Drops |
|---|---|---|---|---|
| Unggoy | 4 | no (shy, runs at 4.4 tiles) | - | 2 Wild Bananas, Unggoy Fur (70%) |
| Wild Carabao | 10 | yes (3.2 tiles) | 18 | Carabao Hide, Carabao Horn (50%) |
| Silver Carabao (rare) | 14 | yes (3.4 tiles) | 20 | Silver Horn, 2 Carabao Hide |
| Little Unggoy (tame) | - | - | - | - |
| Anggitay | 8 | no (shy) | - | Anggitay Mane (60%), Wild Honey (20%) |
| Wood Spirit | 10 | yes | 15 | Spirit Moss, Narra Wood (40%) |
| Anggitay Queen (floor 5) | 30 | yes | 20 | Queen's Ribbon, 2 Anggitay Mane |
| Kapre (floor 10) | 41 (+16 a friend) | yes | 24 | 2 Kapre Bark, 3 Spirit Moss, 2 Narra Wood (60%) |

The Kapre's daily chest: 2 Kapre Bark, 3 Narra Wood, 2 Wild Honey, 12 Arrows, and a Silver Horn 15% of the time.

Sell prices (Gold): Wild Bananas 35, Unggoy Fur 140, Carabao Hide 300, Carabao Horn 360, Silver Horn 2,400, Anggitay
Mane 480, Spirit Moss 420, Queen's Ribbon 2,200, Kapre Bark 3,200, Narra Wood 220, Wild Honey 160, Kare-Kare 260.

**The Kapre set** (Kanor's Make tab):

| Piece | Takes off a charge | Kanor needs | Gold |
|---|---|---|---|
| Ranger Hat (head) | 1 | 8 Unggoy Fur, 6 Wild Bananas | 4,500 |
| Ranger Vest (body) | 2 | 6 Carabao Hide, 3 Anggitay Mane | 8,000 |
| Ranger Boots (feet) | 1 | 4 Carabao Hide, 4 Spirit Moss | 4,500 |
| Kapre Charm (charm) | 2 | 2 Kapre Bark, 3 Narra Wood, 1 Queen's Ribbon | 8,000 |

All four on: 6 off every charge, 8 off charges from Sierra Madre's creatures (a Wild Carabao's 18 becomes 10). Never
below 1.

**Medals** (codes 1400-1414): first hunt, the Anggitay Queen, the Kapre, the Little Unggoy tamed, every chest, Ka
Ramon's story, then each animal (Unggoy, Wild Carabao, Silver Carabao) and a giant Unggoy and a giant Wild Carabao.

## Art (art-src/places/sierra/; the prompts are in PLACES-1-5-PROMPTS.md)

Every name is wired; until a picture is in, the game draws a stand-in.

| Picture | Wired as | Stand-in until then |
|---|---|---|
| `wild_unggoy.png` | Unggoy and Little Unggoy `sheet: 'wild_unggoy'` | the Sigbin's row, tinted grey-brown |
| `wild_carabaoligaw.png` | Wild Carabao | the Rhino's row, slate grey |
| `wild_silvercarabao.png` | Silver Carabao | the Rhino's row, silver-white |
| `wild_anggitay.png` | Anggitay | the Tikbalang's row, chestnut |
| `wild_woodspirit.png` | Wood Spirit | the Sigbin's row, moss green |
| `wild_anggitayqueen.png` | Anggitay Queen | the Tikbalang's row, cream |
| `wild_kapre.png` | Kapre | the Bungisngis's row, moss green |
| `npc_ka_ramon.png` | `npc.sheet: 'npc_ka_ramon'` | the villager Owen |
| `sierra_mouth.png` | `props/sierra_mouth` | the drawn cave mouth, tinted green |
| `sierra_gate.png` | `props/sierra_gate` | the drawn stone gate |
| `sierra_cave_floor/_water/_rock_top/_rock_face.png` | one strip `sierra_cave` | the Mine's cave tiles in root browns, pools blue-green |
| `icons_sierra.png` (16) | `C.SIERRA_ICONS`, in the json's order | existing icons (mango, rabbit fur, rhino horn, ...) |
| `ground_sierra.png`, `ground_sierra_water.png`, `props_sierra.png` | named in the place's `art` | the Wild Lands' forest ground, the farm's water, Makiling's and Pulag's props |

When the art comes:
- Icons: paint `icons_sierra.png` into `assets/items.png`, then add `F.placeIcons(C.SIERRA_ICONS);` at the top of the
  data file (never before: an icon past the sheet's end draws nothing). Then update `test/players.test.js`'s
  "last icon" check to look at `chocolate_cake`'s index, and `test/sierra.test.js`'s "no icon of its own" line.
- Creatures: import each sheet like the Wild Lands' (tools/art/wild3q-import.js) into the `wild` pack, and set each
  creature's `px` to the width that tool prints.
- Ground and props: they need an import step (new tiles and props in `tools/tiles.js` and tools/art) and then the
  map remade with them. Not done yet: adding tiles and props changes shared sheets the other places use too.

## Not done / to know

- Friends see "in Pulag" for you while you hunt here, and Sierra Madre's animals are not on the Biggest catch board
  (the server knows only the first three places; engine note).
- No What's new line (owner).
- Not tested on a phone yet.
