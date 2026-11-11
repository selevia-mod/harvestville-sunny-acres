# The Lost Tower (owner, 12 Nov 2026)

Owner: "Lets call the tower, The Lost Tower because I search there's a lost tower in Manila Bay which is kinda
connected." "We want the per floor is getting harder and harder, only strong player can reach the 1000 or atleast they
need 4 player." "Let the game they need to team up to beat the game not to force them to team up just to play."

## Why
The top players have finished everything (12 Nov data: the Lair and all five caves at floor 50, millions of Gold, all 6
lands) and Gold no longer means anything to them. The Lost Tower is the long goal: 1,000 floors that get harder every
floor, paid in **Pearls** (never Gold), which buy what nothing else can: lands 7 to 9, the Keeper's gear, horse gear looks,
and later a new weapon. It is hard enough that the deep floors are beaten by teams, but anyone can climb alone and earn.

## Getting in
The door is the lighthouse at the end of Manila Bay's breakwater (the `lighthouse` prop, Manila's map, src/00-...-manila.js).
Anyone who can reach Manila can go in. Inside, floor 1, or any lift floor you have reached.

## A floor
- One room per floor. Clear **every** enemy and the stairs up open (like the Lair's gate).
- **A lift every 10 floors** (1, 11, 21 ...): you start from any one you have reached; you never start over from floor 1.
- Up to **4 players** on a floor together (friends join you, as in the caves today). Enemies do **not** grow with the team:
  four players share the same floor's enemies, so a team makes a floor much easier. Nothing needs a team to start.
- Energy is the only limit: an enemy that reaches you costs energy (as in the caves). At 0 you are out of the Tower,
  back at the last lift next time. Farm food and crop potions refill energy. No daily floor limit.

## Enemies per floor (owner's numbers)

| Floors | Enemies |
|---|---|
| 1-100 | 20 |
| 101-200 | 25 |
| 201-300 | 30 |
| 301-400 | 45 |
| 401-500 | 50 |
| 501-1000 | 60 |

**Bigger floors** (owner, 12 Nov 2026: "Since this has many enemies, we need to make the floor bigger than the dungeon").
Today a Palawan cave floor is 18 x 14 for at most 7 enemies (about 36 tiles each). The Tower's room grows with its
enemies, a little more crowded than the caves:

| Floors | Enemies | Floor size (tiles) | Tiles per enemy |
|---|---|---|---|
| 1-100 | 20 | 28 x 24 | 34 |
| 101-200 | 25 | 30 x 26 | 31 |
| 201-300 | 30 | 34 x 28 | 32 |
| 301-400 | 45 | 40 x 34 | 30 |
| 401-500 | 50 | 42 x 36 | 30 |
| 501-1000 | 60 | 46 x 38 | 29 |

The floors are **built in code** from the floor number (like Manila's map, L.manilaMap), not drawn maps: the page carries
no map for them, and every floor is laid out differently (pillars, rocks, water, where the stairs are), the same for
every player on it. Each zone has its own look.

**Phones first:** today's caves have at most 7 enemies on a floor. Before anything else is built, a test floor with 60
enemies goes on the OPPO and is measured. If it is too slow, the floor keeps its number but they come in **waves** (for
example 60 = 3 waves of 20, the next wave arriving when the last is mostly down), so the difficulty is the same.

## Normal enemies get stronger every floor
Five things rise with the floor (f = the floor):

| | Rule | Floor 1 | Floor 500 | Floor 1000 |
|---|---|---|---|---|
| Hits to beat (at damage 1) | 2 + f / 25 | 2 | 22 | 42 |
| Energy lost when one reaches you | 2 + f / 50 | 2 | 12 | 22 |
| Speed | +5% every 100 floors, at most +50% | normal | +25% | +50% |
| How many | the table above | 20 | 50 | 60 |
| Tricks | one more every 100 floors | none | 5 | all |

Tricks, one new one per zone, and they stay:

| Floors | New trick |
|---|---|
| 101-200 | Shielded: only a Rifle shot breaks the shield |
| 201-300 | Bursting: a beaten one leaves a puddle that slows you |
| 301-400 | Sirena's song: slows your shooting while you hear it |
| 401-500 | Flying flocks: the Boomerang's double hit is best |
| 501-600 | Healers: they heal the others; beat them first |
| 601-700 | Darkness: you see only near your lantern |
| 701-800 | Splitters: become two when beaten |
| 801-900 | Revivers: stand up again unless finished quickly |
| 901-1000 | all of them |

## The ten realms (owner, 12 Nov 2026: "theme per floors ... filipino mythology")
The tower climbs from the bottom of Manila Bay to the last moon. Every 100 floors is a realm of Filipino mythology with its own
look (floor, pools, wall top, wall face, 6 props, the stairs up) and its own enemies: 3 normal, a guard, a mini boss and the
big boss. The full list, with every picture's prompt and file name: art-src/LOST-TOWER-PROMPTS.md (generator:
tools/art/tower-enemy-prompts.py). Enemies are FIERCE and ANGRY, not gory (owner).

| Floors | Realm | Normal enemies | Guard | Mini boss | Big boss |
|---|---|---|---|---|---|
| 1-100 | Tambanakua's Tide Stairs | talangka, kanaway (flies), igat | alimango (Alimango Knight) | ulang | tambanakua |
| 101-200 | Pugita's Deep (shielded) | kugita, umang (shield), dikya (flies) | kugita_kabalyero | pating (armour) | pugita |
| 201-300 | Berberoka's Swamp (bursting) | palakang_putik, kuhol, parol_multo (flies) | putik_golem | dambuhalang_kuhol | berberoka |
| 301-400 | Magindara's Lagoon (song) | sirena, dikya_buwan (flies), palakang_buwan | sirena_koro | sirenang_bituin | magindara |
| 401-500 | Anitun Tabu's Storm Gallery (flocks) | langay, kabag, ulap (all fly) | lawin_kidlat | bagyo | galura |
| 501-600 | The Kataw Court (healers) | kataw, kataw_manggagamot (healer), kabayo_dagat | bantay_hari | kataw_reyna (heals) | kataw_hari |
| 601-700 | Santelmo's Lantern Spire (darkness) | santelmong_asul, alitaptap (fly), anino | lampara_golem | dambuhalang_anino | dakilang_santelmo |
| 701-800 | Biringan, the Invisible City (splitters) | engkanto, minokawa_sisiw (flies), ulap_blob | bantay_biringan | tigmamanukan | minokawa |
| 801-900 | Mayari's Starfall (revivers) | tala, bituing_alimasag, gamugamo_buwan | bituing_golem | pagong_batong_buwan | tagapag_ingat_bituin |
| 901-1000 | The Seventh Moon (everything) | bakunawa_anak, laho, parola_golem | bakunawa_bata | dakilang_laho | bakunawa_ng_look |

Each creature's picture is `tower/zone<n>/wild_<id>.png` (the 12-pose sheet like the places' creatures); each realm's look
is `tower/zone<n>/{floor,water,rock_top,rock_face,props,stairs}.png`. Until a picture is in: an existing animal's row of the
wild sheet, tinted, and the cave tiles painted in the realm's colours (as the caves do).

## Guards and bosses (owner: "10 - guard, 50 - mini boss, 100 - big boss")
- **Guard** (floors ending in 10, 20, 30, 40, 60, 70, 80, 90): the floor's enemies plus one guard, 5 times a normal
  enemy's hits. Drops energy food.
- **Mini boss** (floors ending in 50): the floor's enemies plus a mini boss, 10 times a normal enemy's hits. Drops a chest:
  crop potions and a horse gear dye.
- **Big boss** (floors ending in 00): the floor's enemies plus the zone's big boss, 40 times a normal enemy's hits, with
  its own attack. No number of players is required; it is simply so strong that a team is the way to beat it. Rewards:
  - **A Tower Blessing, forever:** bosses 100, 300, 500, 700, 900 each give +5% damage inside the Tower; bosses 200,
    400, 600, 800, 1000 each give +10 most energy. All ten: +25% damage in the Tower and +50 energy.
  - **A piece of the Tide set**, a costume (looks only) found nowhere else; all ten complete it.
  - **First in Selebox:** the first players ever to beat each big boss get their names on the lighthouse wall in Manila
    and a frame no one else can have.
  - Its Pearls (below).

## Pearls
Paid when the **last enemy on a floor falls**, with a "+5 Pearls" pop, to every player on that floor.
- **First time:** a player who has never cleared that floor gets its Pearls, alone or in a team (no team bonus).

| Floor | Pearls (zone z = 1 for floors 1-100 ... 10 for 901-1000) | Zone 1 | Zone 10 |
|---|---|---|---|
| Normal | z | 1 | 10 |
| Guard | 5 z | 5 | 50 |
| Mini boss | 30 z | 30 | 300 |
| Big boss | 100 z | 100 | 1,000 |

  A zone pays 260 z: 260 for floors 1-100, 14,300 for all 1,000 floors.
- **Helping:** a player who already cleared that floor, helping a friend clear it, gets **1 Pearl**, at most **50 a day**.
- **Alone on a floor you already cleared: nothing.** Normal enemies drop no Pearls.
- Saved as `prl` (the Pearls) with the deepest floor reached and the boss/first-clear marks.

| Reached floor | Pearls in all |
|---|---|
| 100 | 260 |
| 200 | 780 |
| 300 | 1,560 |
| 400 | 2,600 |
| 1000 | 14,300 |

## The Keeper's shop (Pearls only, at the lighthouse)

| Item | Pearls | What it is |
|---|---|---|
| Keeper's Hat (head) | 300 | gear: enemies reaching you in the Tower cost 10% less energy |
| Keeper's Boots (feet) | 300 | gear: 10% less, and +10% speed in the Tower |
| Keeper's Coat (body) | 500 | gear: 20% less |
| Keeper's Lantern (charm) | 800 | gear: 20% less, and you see farther in the Darkness floors |
| Horse gear looks (saddle, bridle, lantern) | 400-600 each | looks for your horse |
| A new weapon | later | the Tower's own weapon (owner: "soon, not yet") |

The whole Keeper's set: enemies cost 60% less energy in the Tower. The strongest gear in the game, and the first thing a
climber saves for. Lands 7 to 9 take Pearls too (250 / 800 / 2,500; docs/superpowers/specs/2026-11-12-lands-7-9-design.md).

## The weekly board (Manila's Hall of Fame)
Ranked by new floors reached this week.

| Place | Reward |
|---|---|
| 1 | 300 Pearls, a gold frame for the week, the "Lighthouse Champion" title, the name on the lighthouse banner |
| 2 | 200 Pearls, a silver frame |
| 3 | 150 Pearls, a bronze frame |
| 4-10 | 50 Pearls |
| everyone with 10+ new floors | 10 Pearls |

Frames and the title last one week.

## Art (prompts at 30 degrees, like the 30-degree characters)
- The ten zones' floor looks (one room style each).
- About 3 creatures per zone, the 10 big bosses, the mini bosses and guards (bigger, tinted versions of the zone's
  creatures until their own pictures come).
- The Keeper's gear (icons and worn, boy and girl), the Tide set pieces, the horse gear looks.
- Zone 1 can open on drawn stand-ins and existing animal art, so the building does not wait for every picture.

## Build order (each its own update, shown on the phones before any publish)
1. The 60-enemy test floor (46 x 38, the biggest) on the OPPO: all at once, or waves.
2. The Tower itself: floors, enemies and their rules, lifts, Pearls, solo; zone 1 and its big boss.
3. Friends on the same floor (up to 4), helper Pearls with the daily 50.
4. The Keeper's shop and gear, lands 7 to 9.
5. The weekly board and First in Selebox.
6. Zones 2 to 10 as their art comes.

## Tests
- Unit: enemies per floor, hits and energy by floor, the trick of each zone, guard/mini/big boss floors, Pearls first
  time only, helper Pearls stop at 50 a day, nothing alone on a cleared floor, Blessings add up, Keeper's gear numbers,
  the save keeps Pearls and the deepest floor.
- Browser: a floor cleared opens the stairs and pays, a lift, energy at 0 ends the climb, two players on one floor
  share its enemies and both get paid.
- Phones: the OPPO and the iPhone, 60 enemies measured, shown to the owner first.
