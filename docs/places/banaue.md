# Place 11: Banaue Terraces (owner, 6 Nov 2026)

The first of the new hunting places. It opens at **60 hunts** and you get there by **Kanor's Jeep** at his Lodge in
Pulag. Its dungeon is the **Terrace Tunnels**.

Files: `src/00-zzzzzzzzzz-place-11-banaue.js` (the data, all the numbers below), `src/01-logicZZZZZ-place-11-banaue.js`
(Lola Bugan's gifts), `src/19zzzzzz-place-11-banaue.js` (the props drawn on the map), `maps/banaue.json` and
`maps/banaue_cave.json` (made by `tools/places/banaue-map.js`), `tools/art/banaue-import.js` (the pictures),
`test/banaue.test.js`, and the Banaue tests in `test/e2e.test.js` and `test/e2e-online.test.js`.

## What the player finds

A green mountain of rice terraces seen from above (32 x 30 tiles, about Pulag's size). Four terraces step down the
slope. Each one has a strip of grass to walk on, then a paddy (water you cannot walk in, with rows of young rice, split
into fields by mud dikes), then the stone wall that drops to the next terrace. Stone steps go down through each paddy
and wall, zig-zagging from the village at the top to the jeep stop at the bottom left.

- **The jeep stop** (bottom left): the Jeep back to Pulag, and a sign.
- **The village** (top): Lola Bugan, three huts on stilts, a rice drying rack, and the mouth of the Terrace Tunnels cut
  into the mountain.
- All over: tree ferns, boulders, another drying rack, and tall rice grass where the animals hide.
- **Animals**: Wild Ducks (shy: they run and fly off), Bayawak (monitor lizards: they charge), and sometimes the rare
  **Golden Duck**. One **calm Wild Duck** walks the paddies with hearts over it. You tame it, you don't hunt it.
- **5 hidden chests**: they only show when you get close.
- **Respect**: the bulul (the sacred Ifugao rice-god carvings) are never enemies. Lola Bugan mentions them kindly once,
  as the guardians of her granary. Everything is family-friendly: the Kibaan and the Amomongo are cute and playful,
  not scary.

## The numbers

Set between Makiling (boar 3 hp / 8 energy a charge, wolf 3 / 10) and Magayon / the Lair (bear 5 / 12, tiger 5 / 14,
Bungisngis 24, Bakunawa 60).

### On the terraces

| Animal | HP (arrows) | Charge costs | Size | Drops |
|---|---|---|---|---|
| Wild Duck | 1 | (shy, flies off) | 1.1 kg | Itik Meat x1 (always), Itik Feather x1 (70%) |
| Bayawak | 4 | 10 energy | 18 kg | Bayawak Scale x1 (always), Bayawak Tail x1 (50%) |
| Golden Duck (rare) | 2 | (very shy, fast) | 1.6 kg | Golden Feather x1, Itik Meat x2 (always) |

- How many roam: 4 Wild Ducks and 3 Bayawak. At dawn 2 more ducks, in the rain 1 more Bayawak. The Golden Duck shows
  up on the game's usual rare schedule, and comes back 120 minutes after it is hunted. The others come back after 6
  minutes, like the Wild Lands.

### Taming (owner: "a little bit hard but not too hard")

- The calm Wild Duck eats **Heirloom Rice**. It takes **8 feedings**. Hold the rice, sneak up slowly while it is calm,
  then tap Feed. After each feeding there is a **1 in 4** chance it flies off and comes back **15 minutes** later. Its
  hearts stay.
- Lola Bugan's first two gifts give you exactly 8 Heirloom Rice. More comes from the hidden chests, the Kibaan and the
  boss's chest.
- Once tamed, it follows you around the Wild Lands as a **Spotter**: it tells you when a rare animal is out (here, the
  Golden Duck) and points the way. You can swap it at Kanor's (Pals tab).

### The Terrace Tunnels (10 floors)

Earthen tunnels with roots, glowing mushrooms, mossy boulders and an underground stream (pools of water you cannot
walk in). Each floor: 3 creatures, 4 from floor 4, 5 from floor 8. Clear a floor and the gate down opens. The lift
by the ladder stops at floors 1 and 6 once you have reached them.

| Creature | Floors | HP | Charge costs | Drops |
|---|---|---|---|---|
| Kibaan (playful little folk, they run) | 1-10 | 2 | (shy) | Kibaan Cap x1 (always), Heirloom Rice x1 (25%), Terrace Stone x1 (30%) |
| Cave Bayawak | 3-10 (twice as many from floor 7) | 5 | 11 | Cave Scale x1 (always), Bayawak Tail x1 (30%) |
| **Kibaan Chief** (guard, floor 5, with 2 others) | 5 | 14 | 12 | Kibaan Staff x1, Kibaan Cap x3, Terrace Stone x2 |
| **Amomongo** (boss, floor 10, with 2 others) | 10 | 30 alone, **+12 for each friend** (42 for two) | 15 | Amomongo Fur x2, Cave Scale x2, Terrace Stone x3 |

- You can beat the Amomongo alone: 30 arrows with a basic bow, 15 with a Silver Bow. With friends, you need to land
  at least 3 hits to get your share.
- **The boss's daily chest**: one a day per hunter. Missed days add up to **3** waiting. Each one has: Amomongo Fur x1,
  Heirloom Rice x2, Terrace Stone x3, Arrows x10, and a 15% chance of a Golden Feather.

### What Kanor pays (Sell)

Itik Feather 25, Itik Meat 32, Terrace Stone 40, Heirloom Rice 50, Kibaan Cap 90, Bayawak Scale 110, Bayawak Tail
140, Cave Scale 160, Adobong Itik 160, Golden Feather 700, Kibaan Staff 900, Amomongo Fur 1,400 Gold.

### The Terrace set (Kanor's Make tab)

| Piece | Kanor needs | Gold | Takes off a charge |
|---|---|---|---|
| Terrace Hat (Head) | 8 Itik Feather, 3 Kibaan Cap | 3,000 | 1 |
| Terrace Vest (Body) | 6 Bayawak Scale, 2 Bayawak Tail, 3 Cave Scale | 5,000 | 2 |
| Terrace Sandals (Feet) | 4 Cave Scale, 6 Terrace Stone | 3,000 | 1 |
| Terrace Charm (Charm) | 2 Amomongo Fur, 1 Kibaan Staff, 3 Heirloom Rice | 6,000 | 2 |

Wearing all four takes **2 more** off charges from Banaue's own creatures (on the terraces and in the tunnels): 6 off
anyone's charge, 8 off Banaue's. A charge never costs less than 1.

### Adobong Itik

Cooked in your **kitchen**, like the Wild Lands dishes: **Itik Meat + Garlic + Heirloom Rice**. Gives **+80
energy**, sells for 160. Duck meat also counts as "meat" in other recipes (like Inihaw).

### Hidden chests (5)

Village corner (2,2), the east end of the second terrace (29,9), on a dike in the middle of the second paddy
(18,11), under the ferns by the west steps (2,15), and the far corner past the jeep (28,27). Each one gives: Arrows
x6, Heirloom Rice x2, Terrace Stone x2, and a 10% chance of a Golden Feather.

### Medals (codes 1100 and up)

First hunt in Banaue Terraces, Kibaan Chief defeated, Amomongo defeated, Wild Duck tamed, Every chest in Banaue
Terraces, Lola Bugan's story, Wild Duck, Giant Wild Duck, Bayawak, Giant Bayawak, Rare: Golden Duck. 11 medals in all.

## Lola Bugan's story

The terrace elder. She stands in the village at the top. Each step opens after the one before it and gives a small
gift, once. If several steps open before you talk to her (for example you beat the guard and the boss in one trip),
you still get all their gifts, and she says the newest line.

1. **First visit**: welcome up the mountain. The terraces were built by hand, stone by stone. A calm wild duck walks
   the paddies. *Gift: 4 Heirloom Rice.*
2. **After 5 hunts here**: you hunt with care, and the paddies stay healthy when hunters only take what they need. The
   old tunnels under the terraces carry the water, and the Kibaan play down there. *Gift: 4 Heirloom Rice, 10 Arrows.*
3. **After the Kibaan Chief (floor 5)**: he only wanted shiny things, and now the water flows freely again. The
   Amomongo at the bottom isn't wicked, only grumpy and hungry. *Gift: 6 Terrace Stone, 2 Heirloom Rice.*
4. **After the Amomongo (floor 10)**: the stream sings again. The bulul by her granary watch over the harvest, and now
   you do too. You are family on these terraces. She cooked for you. *Gift: 2 Adobong Itik, 3 Heirloom Rice.*

While a step is still locked, she gives a hint: "Hunt here a few more times...", "The Kibaan Chief guards floor 5 of
the tunnels.", "The Amomongo waits on floor 10 of the tunnels."

## The pictures: names wired

Every picture in `art-src/PLACES-1-5-PROMPTS.md` (1-18) goes in `art-src/places/banaue/` under these names. Then run
`node tools/art/banaue-import.js` (and `node tools/art/animals3q-import.js places` for the creatures), then
`node build.js`. Each part runs only when its pictures are there. Until then the game uses its stand-ins, so the
pictures can come a few at a time, in any order.

| # | Picture | Becomes | Used for | Stand-in until then |
|---|---|---|---|---|
| 1 | `ground_banaue.png` | `assets/banaue_ground` (grass, grass2) | the map's tileset `banaue_ground` | Pulag's grass, greener |
| 2 | `ground_banaue_water.png` | `assets/banaue_ground` (paddy, paddy2) | the paddies | the farm's water, muddy green, with drawn rice rows |
| 3 | `props_banaue.png` | `assets/props/banaue_wall, _hut, _fern, _rack, _boulder, _grass` | the map's `place_prop` objects | drawn wall, hut, fern, rack; the Wild Lands' mossy boulder and tall grass |
| 4 | `wild_itik.png` | `assets/wild_itik` + `wild_itikshade` | Wild Duck and the calm Wild Duck | the labuyo, tinted brown |
| 5 | `wild_bayawak.png` | `assets/wild_bayawak` + shade | Bayawak | the boar, tinted olive |
| 6 | `wild_goldduck.png` | `assets/wild_goldduck` + shade | Golden Duck | the labuyo, tinted gold |
| 7 | `npc_lola_bugan.png` | `assets/npc_lola_bugan` (9 frames, 128 x 192) | Lola Bugan | Grandma Pearl's look |
| 8 | `banaue_mouth.png` | `assets/props/banaue_mouth` | the tunnels' mouth | the drawn cave mouth, tinted green |
| 9 | `banaue_gate.png` | `assets/props/banaue_gate` | the gate down (shut, open) | the drawn stone seal |
| 10-13 | `banaue_cave_floor/_water/_rock_top/_rock_face.png` | `assets/banaue_cave` | the tunnels' tiles and the stream | the Mine's cave tiles in earth colours, the pools in water colours |
| 14 | `wild_kibaan.png` | `assets/wild_kibaan` + shade | Kibaan | the tikbalang, small, tinted green |
| 15 | `wild_cavebayawak.png` | `assets/wild_cavebayawak` + shade | Cave Bayawak | the boar, tinted pale blue |
| 16 | `wild_kibaanchief.png` | `assets/wild_kibaanchief` + shade | Kibaan Chief | the bungisngis, small, tinted green |
| 17 | `wild_amomongo.png` | `assets/wild_amomongo` + shade | Amomongo | the bear, tinted grey-white |
| 18 | `icons_banaue.png` | 16 slots of `assets/items.png` | the items and the four gear pieces | each item's stand-in icon (rice, stone, jade...) |

After the creatures' import, put the width it prints (`px`) into each creature's `px` in the place's file (the
stand-ins use the borrowed row's px). The icons' import switches the place's file to use them (`ICONS_IN = true`).
The props, Lola Bugan, the creatures and the tunnels' pictures go into the **wild pack** (`tools/places/banaue-art.js`,
read by `tools/packs.js`), not the page. The ground stays in the page (a map tileset can't be in a pack).

I tested the import on made-up pictures: every part ran, and the sizes came out right.

## Page size

The page went from 19,456,174 to 19,541,326 bytes (**+85 KB**): the two maps (28 KB + 7 KB), the ground tiles (18 KB
WebP) and the place's code. Real pictures later go to the wild pack. The only ones that stay in the page are the 16
icons and the ground, and the ground replaces its stand-in at about the same size.

## Not done / later

- **Hunting now / Biggest catch** (the server): a hunter here still shows as "in Pulag", like every new place (engine).
- **What's new**: none (one combined line comes later).
- The stand-in creatures borrow other animals' rows (a duck that looks like a labuyo, a Bayawak that looks like a boar)
  until the owner's pictures come.
