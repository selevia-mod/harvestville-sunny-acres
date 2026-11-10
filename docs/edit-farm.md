# Edit Farm: every building movable, saved layouts (owner, 10 Nov 2026)

Owner: "we need to finalize the farm, how users can customize it with the defense, their house, farmland and others
need to be moveable so they can make their farm the best way possible." Decisions (10 Nov 2026): the field as 4x4
plots placed anywhere; new art for the pieces drawn into the map (art-src/FARM-LAYOUT-PROMPTS.md); its own update,
after the raid fixes ship; 2-3 saved layouts (a Farm layout and a War layout), like Clash of Clans.

## What moves (new yard pieces, `one` where there is one)
| Piece | Tiles | Comes with it |
|---|---|---|
| Farmhouse (level 1 art new; 2-10 exist) | 5x4 | the door warp into the house (bottom middle), the mailbox beside it, the farmer's spawn |
| Animal Ranch (new art) | 9x9 | the pen zone (animals roam its inner grass), the barn and coop (capacity unchanged), the incubator spot, the egg/milk raid loot |
| Dog yard (new art) | 4x5 | the dog's zone |
| Stable (art exists) | 3x3 | the horse's spot; only once built, as now |
| Lily's seed stand (art exists) | 2x2 | the shop spot |
| Ponds (new art) | 5x4 each, the 3 the map has | fishing and the watering can's refill |
| Field Plots | 4x4 each | the soil and crops on them (moving a plot already carries its soil) |
| Farm trees (inside the border) | 1x1 | can be chopped (lumber) to make room; the border trees and the road stay |

Defenses, fences, paths, decorations, workshops, fruit trees, the Greenhouse and back-field plots already move.

## The map
The farm map keeps only the frame: the grass, the border trees, the road and its warp to town, the back-field land
blocks. Everything in the table above leaves the map and becomes a yard piece. Code that reads fixed spots reads the
pieces instead: the house door warp and spawn (11-world.js, 19d-home.js HOUSE_BLOCK), the Herd and Dog zones
(14-actions.js), farmhands' rest spots (19zz-farmhands.js), quests' targets (zone dogarea, house_door), raids (loot at
the house door and the pen, the dog's spot, the camera), the drop zone (field = the plots), reachability `needs` (each
door and gate must stay reachable from the road), fishing and water refill (pond pieces), visits and their snapshot.

## Nobody's farm changes by itself
On the first open after the update a farm gets every new piece exactly where the map had it: the house at (4,3), the
ranch over the pen and barn, the dog yard, the ponds, the stand, the stable if built, and its field as 4x4 plots
covering the old field (soil and crops kept, the few edge tiles a 4x4 grid cannot cover kept as their own 4x2 / 2x4
plots or moved with their crops). The farm looks the same until its farmer moves something. A save without them (an
older app) still opens: pieces it does not know stay where they are (append-only types).

## Edit Farm (Decorate, outdoors)
- Tap a building: pick it up, drag it, its footprint green where it fits and red where it does not, OK to put it down.
- Rules: no overlaps; every door, gate, the pen's gate and the road stay reachable (L.yardReachable); never on the
  road or the border; a field plot carries its crops; the house and the ranch can't be put away (stored), only moved.
- **Layouts: 3 slots** (Farm, War, and one more). Save the current layout into a slot; Load one: every piece goes to
  its spot in that layout; a piece bought since goes to storage if it has no spot; a crop field moved by a layout keeps
  its crops. "Use for raids": which layout raiders see (the War one), copied into the farm's raid copy. Layouts are
  saved in the farm save (`s.lay`: up to 3 lists of [piece, x, y]).
- A short first-time tour (real farm art).

## Raids
The raid copy reads the pieces, so the house, ranch, field plots and defenses are where the farmer put them: a layout
is a strategy. With a War layout chosen, the copy uses it (the farm itself stays in its Farm layout).

## Online and visits
A visitor sees the farm as its owner laid it out (the snapshot carries the pieces, as the yard already does).
Town Raid crops and boars find the field plots wherever they are.

## Part 1: done (10-11 Nov 2026, branch feat/edit-farm)
Plan: docs/superpowers/plans/2026-11-10-edit-farm-part1-movable-buildings.md.
- Moved off the map into yard pieces (appended types, src/00-zzzzzzzzzzzzzzzzzz-buildings.js): the farmhouse, the
  Animal Ranch (barn, coop, incubator, pen; its gate in the FRONT fence, as the owner's picture draws it, not on the
  right as the old map had it), the dog's yard, the 3 ponds, Lily's seed stand, the stable (once built), and the field
  as twelve 4x4 + four 4x2 field plots. The map (maps/farm.json) keeps only its frame; the old one is
  test/fixtures/farm-map-before-edit-farm.json.
- Save flag `ef`: a save without it gets every piece once, where the map had it (L.addBuildings, from L.deserialize,
  L.newState and L.visitState); an older friend's snapshot, a bandit farm and a made-up raid farm get them too.
- Each building works where it stands (src/12a-buildings-world.js, src/19fa-buildings-yard.js): the door warp and
  spawn, the mailbox, the shop, the incubator, the pen and dog zones, the horse's spot, the ponds' water; reachability
  (L.farmFor) from the house door. The house and the ranch can only be moved, never put away. A moved building opens
  the farm again after Decorate.
- Raids: the no-drop field is the plots and a tile round them; the bandit farms' crops sit on the plots and their pen
  defenses by the ranch's gate; the Bandit Ranch gained a tower and the Hacienda two towers and a sprinkler (re-judged
  over 5 layouts: the old star table). The guide's field goal is a field plot.
- The ranch and the dog's yard are drawn under the animals and the dog (their pictures hid them; found by the
  before/after screenshots against 78b8af5, where the house, ranch, ponds, stand and field otherwise sit where they were).
- Not in Part 1: layouts (Farm/War), "Use for raids", the tour, choppable farm trees (Part 2). Phones not tested yet.

## Art (owner)
art-src/FARM-LAYOUT-PROMPTS.md: house_1, ranch, dog_yard, pond.

## Order
1. Raid fixes ship first (e51 = Pets' Pet Dash, then ours on top).
2. Then this update, built on that one.
3. Tests: the migration on real saves (live copies, read-only), every piece moved and the house entered, the animals in a
   moved ranch, fishing at a moved pond, a farmhand at a moved field, a raid on a rearranged farm, a visit, a quest
   pointing at the dog yard; then both phones.
