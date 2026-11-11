# Lands 7, 8 and 9 (owner, 12 Nov 2026)

Owner: "Lets add new 3 slot farm land, this its much more Gold + Pearl, today we have 6 additional lands, the 6th is 320k
Gold. 7 = 800k Gold + XX Pearl, 8 = 1.6M Gold + XX Pearl, 9 = 3M Gold + XX Pearl."

## Why
The top players have finished the farm: most own all 6 lands and hold millions of Gold (12 Nov data: #1 33.7M, five
players over 1M) with nothing left to buy. Lands 7 to 9 give that Gold a use, and the Pearls make sure they are earned by
climbing Manila's Lighthouse Tower, not only bought.

## Prices

| Land | Gold | Pearls | About where in the Tower you have that many Pearls |
|---|---|---|---|
| 7 | 800,000 | 250 | floor 100 |
| 8 | 1,600,000 | 800 | floor 200 |
| 9 | 3,000,000 | 2,500 | floor 400 |

Pearls are spent when the land is bought (they are also the Tower keeper's shop money, so a player chooses). Gold and
Pearls are both needed; one without the other says what is missing ("You need 120 more Pearls").

## Where they are
A third column of 10 x 10 blocks on the right of the two that are there, the same size as lands 1 to 6:
- Today the farm is 64 tiles wide: the blocks are x 40-49 and 51-60, the track x 61, the tree line x 62-63.
- The farm grows to **75 wide**: the tree line at x 62-63 becomes a track (x 61) and the new blocks x 62-71
  (rows 3-12, 14-23 and 25-34, like the others), a track at x 72 between them and the new tree line at x 73-74.
- Order: nearest the way in first, as 1 to 6 were: land 7 at the bottom (y 25), 8 in the middle (y 14), 9 at the top (y 3).
- Each block is grass with a fence round it and a For Sale sign until it is bought, as today.

## How it is built
- `C.LAND.blocks` and `C.LAND.prices` get three more entries; a new `C.LAND.pearls` = [0, 0, 0, 0, 0, 0, 250, 800, 2500].
- `L.buyLand` also checks and takes Pearls (`s.pearls`, saved as `prl`; the Tower is where they come from).
- The map: a one-off tool like `tools/widen-farm.js` (which took the farm from 38 to 64 wide) adds the 11 columns to
  `maps/farm.json`. Saves and visit snapshots already carry the farm's width (`fw`), and the game already moves an older
  save's crops, soil and yard pieces to the same places when the farm grows (it did it for 24 -> 38 -> 64). A save from a
  64-wide farm is moved the same way to 75, once.
- `C.FARM_W` becomes 75. Everything that walks the farm by `FARM_W` (soil indexes, raids' farm copy, the yard) follows it.
- The page grows by the wider map only (a few KB; the margin today is about 164 KB).

## When it ships
With the Lighthouse Tower, or after it: before the Tower nobody can have Pearls. If they ship first, the three signs say
"Needs Pearls from the Lighthouse Tower in Manila, coming soon" and cannot be bought.

## Tests
- Unit: prices; buying with too little Gold or too few Pearls is refused and takes nothing; buying land 7 takes both; land
  9 needs 8 first; a 64-wide save keeps every crop, soil tile and yard piece on the same spot after the farm grows to 75,
  and is not moved twice; a friend's 64-wide snapshot shows right.
- Browser: walk to the new column, the signs, buy land 7, place a piece on it, raids' farm copy is 75 wide.
- Phones: OPPO and iPhone, shown to the owner before any publish.
