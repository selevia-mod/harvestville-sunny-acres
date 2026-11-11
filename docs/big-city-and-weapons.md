# The big city past the valley road, its hunting grounds, and three new weapons (owner, 11 Nov 2026)

Owner: "another big city with connecting hunting grounds but I want to be big that should x3 of town and x3 of
pulag/makiling/magayon and this is open to everyone also. Because we will also add new weapon." The valley road (the
town's east edge, where visitors from out of town come in: tools/make-map.js from_east) leads there.

Size (owner, 11 Nov 2026: "i like your recommendation"): 3 times the AREA. The city about 90 x 90 tiles (the town is
54 x 52); each hunting ground about 3 times Pulag's area. Its art downloads as a pack (the page is nearly full).

For scale: the farm (all 6 lands) 64 x 38 = 2,432 tiles; the town 54 x 52 = 2,808; Pulag 896, Makiling 960, Magayon
1,020. The city 8,100 (3.3 farms); a hunting ground ~2,700 (about the town).

## What it holds (owner, 11 Nov 2026: "I like that, 90x90 it is")
Open to everyone (the game server's public rooms, up to 30 a room).
1. Central Plaza: the big fountain square where everyone meets; the notice board, events, the city's Hall of Fame.
2. The Grand Market: big crop contracts (e.g. 200 corn for 6,000 Gold) and the Trading Post for Mixer materials.
3. The Armory: buy and upgrade the Rifle, Javelin and Boomerang; bullets and javelins; boomerang repairs.
4. The Stables and Race Track: horse gear (Horseshoes, Saddlebags, Lantern Bridle), oats, a weekly horse race.
5. Three gates, one to each hunting ground.

Three hunting grounds (each ~3x Pulag), each suited to one new weapon, each with a cave dungeon at its far end:
- The Open Plains: wide, flat, fast animals seen from far off (the Rifle).
- The Bamboo Jungle: thick and close, animals jumping out near you (the Javelin).
- The Rocky Gorge: cliffs, flocks of birds in groups (the Boomerang's double hit).

Getting there: the train from Willowbrook Station (a ticket), or the valley road on horseback (6 hearts and Horseshoes),
stopping at a hunting ground on the way.

**Name** (owner, 11 Nov 2026): the city is **Manila**; its port is **Manila Bay** ("lets add some port so soon players can
play in boat"): boats come later. Real place names are fine (the game already has Banaue, Taal, Palawan...); no real
company names or logos, no official seals, landmarks only as cozy cartoon inspirations.

Still to decide: its people, the animals of each ground, prices, the order of building.

**When:** not before the raids are finished (owner, 11 Nov 2026: "we will not release this new idea until we fix all the
raids"). Designed now, built after.

## The weapons (owner's numbers, 11 Nov 2026)

| Level | Bow (range / damage) | Rifle | Javelin | Boomerang |
|---|---|---|---|---|
| Basic | 3 / 1 | 4 / 1 | 1 / 1 | 2 / 1 |
| Copper | 4 / 1 | 5 / 2 | 2 / 2 | 3 / 1 |
| Silver | 5 / 2 | 6 / 3 | 2 / 3 | 3 / 2 |
| Gold | 6 / 2 | 7 / 3 | 3 / 4 | 4 / 2 |
| Magma | 7 / 3 | 8 / 4 | 4 / 4 | 5 / 3 |
| Moon | 7 / 3 | 8 / 4 | 5 / 4 | 6 / 3 |

Moon level specials: the Moon Bow and the Moon Rifle go through the first animal and hit the one behind; the Moon
Javelin and the Moon Boomerang hit 2 animals standing side by side. All of them glow.

Owner's first words on each: the Rifle "long range, more powerful but slow attacking"; the Javelin "powerful, fast
attacking, short range"; the Boomerang "not so powerful, not so long range, not so fast attack but no bullets/arrow
needed", and it wears out ("boomerang can be destroy if they did not use materials to fix the durability when its low").

## Speed and ammo (owner, 11 Nov 2026)
- The Javelin is faster than the Bow ("Javelin should be faster than bow") and has ammo: javelins bought like arrows
  ("Javelin also has ammo, they will buy javelin like arrows, only boomerang has no ammo").
- The Rifle has ammo (bullets). The Boomerang has none: it flies back, and it wears out.

| Weapon | Time between shots | Ammo |
|---|---|---|
| Bow | 0.43 s (as now) | arrows, 60G for 10 (6G each) |
| Javelin | 0.35 s | javelins, 150G for 5 (30G each): the most damage a second, so the dearest to use |
| Rifle | 1.4 s (owner, 11 Nov 2026) | bullets, 200G for 10 (20G each) |
| Boomerang | 1.0 s | none; durability, repaired with materials |
(Proposed numbers; the owner set the order: Javelin fastest, Rifle slowest.)
- Speed stays the same at every level (owner, 11 Nov 2026: "that's okay for now, later on if we add new level, we will
  improve it more"); only range and damage grow, and the Moon specials.

## The Boomerang's wear (owner, 11 Nov 2026)
Throws before it breaks, by level ("Make it longer, 100, 200, 300, 400, 500, 600 so in one dungeon, they can only do 1
repair"): Basic 100 · Copper 200 · Silver 300 · Gold 400 · Magma 500 · Moon 600. A warning at 20 throws left; at 0 it
breaks and is gone. A repair at the Forge (lumber + Rope + a little Gold) brings it back to full.

## Built (11 Nov 2026, branch feat/weapons; not in the app yet)
The three weapons are in the game's code (plan: docs/superpowers/plans/2026-11-11-new-weapons.md): the owner's reach,
hit, shot times, ammo, wear and Moon specials. The owner's batch 6 (art-src/weapons) is in, as the weapons pack (914 KB,
not in the page): tools/art/weapons-import.js; each pose sheet's hands are measured in F.WPN_GRIPS (measure again if a
sheet is redrawn). Until a phone has the pack, drawn stand-ins show. Players cannot get them yet: the Armory is `F.ui.openArmory`, for Manila's Armory to open; only a
test switch (`gameHost.devWeapons`) shows a way to it. **Still for the owner: do the new weapons work in the old
hunting places (Pulag to Palawan, the caves, the Lair)?** One switch, `C.WEAPONS_OLD_PLACES`, now off: only Manila's
grounds (`C.WEAPON_GROUNDS`, which Manila fills). Decided while building (can change): a shot costs the Bow's 2 energy;
the boomerang's repair asks for Rope as soon as the Mixer makes it (lumber + Gold until then); a material the game does
not have yet (Farm Cement, Beeswax, Manila's drops) is not asked for until it does; an upgraded boomerang comes back with
its new level's full throws; a broken one is gone and a new one starts at Basic (no rebuild discount yet).
