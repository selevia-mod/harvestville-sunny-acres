# Manila: the rest of the design (PROPOSALS, 11 Nov 2026)

Everything here is **Proposed**: for the owner to accept or change. What the owner already decided is in
docs/big-city-and-weapons.md (Manila, Manila Bay, 90 x 90, the districts, 3 hunting grounds with caves, train or horse,
the weapon table, speeds, ammo, boomerang wear) and docs/farm-economy-v2.md (the Mixer, the Silo, the horse rules). This
page does not change any of that. The pictures: art-src/MANILA-PROMPTS.md (116 pictures, 7 batches).

Not before the raids are finished (owner, 11 Nov 2026).

## Built so far: step 1, the city (11 Nov 2026, branch feat/manila, not released)

Owner: "start it now"; it ships only on the owner's word. Plan: docs/superpowers/plans/2026-11-11-manila-step1.md.
**Built:**
- **The map, 90 x 90**, laid out as section 1 below (the boxes are in src/00-zzzzzzzzzzzzzzzzzzz-manila.js). It is built in
  code when the game opens (L.manilaMap), so the game page carries no Manila map (the page grew by about 45 KB of code).
- **The bay and port** (the breakwater and lighthouse, the pier with 3 empty berths, each with a sign), **the walled
  quarter** (2-tile walls, 4 bastions, the Sea Gate and the Plaza Gate, the church and its square, the Armory, Lola
  Amparo's house, old houses), **Manila Central** (the platform in front of it, the rails), **the Central Plaza**
  (fountain, notice board, Hall of Fame, the stage, lamps, benches), **the Grand Market and Trading Post** (stalls, the
  contract board), **the Stables** (paddock fence), **the grandstand and the oval track**, **the Barrio** (houses, the
  corner store, the kalesa stand, the jeep stop, the court), **Calle Real** (shops and carts), the roads and **the three
  gates**. Shops, the Hall of Fame, the stage, the boats and the Gorge and Jungle gates say "Coming soon".
- **Getting there:** Willowbrook Station has a **Manila** tab: the train, **250 Gold one way, the first ride free**; home
  from Manila Central's door. **The valley road:** walk off the town's east end (Market Street) to the Plains Gate, and
  back out of it. The horse rule (6 hearts + Horseshoes) is one switch and one hook for economy part 5
  (C.MANILA.horseRoad, L.manilaRoad / L.horseRoadOk); for now the road is walked.
- **The 7 city people** (section 2; the three guides come with their grounds) at their places by the hour, wandering a
  little, solid, with a first hello and 3 lines each. Stand-in looks: the train visitors' sheet, tinted.
- **Open to everyone:** the game server's public rooms, 30 a room ("Manila 1"...), no animals (server/lib/pub.js). The
  server side is NOT deployed: until it is, a phone sees only its own farm's room in Manila (as before).
- **Art:** none of the owner's yet. Town pictures stand in, fitted into each box, with a name label; the ground is drawn.
  The owner's batch 1-2 pictures go through `node tools/manila/manila-import.js` (from art-src/manila/) into the
  download pack **'manila'**, and take over the stand-ins once on the phone (each picture on its own).
- **Saves:** in Manila the game is saved as the town plus the city spot, so an older game opens in town; nothing is lost.

**Decided by me (owner can change):** the train runs any time (no timetable) and goes straight there; the first ride
is the free one, either way after that 250G (no Week Pass yet); everyone in the city stays outdoors at night (at their
door) so there is always someone to talk to; the shops show their keeper but sell nothing yet; the train's station door
sells the ticket home (Mang Tibo points to it); the plaza lamps moved one tile so nothing stands on a person's spot; the
platform is in front of the station building and the rails behind it (south); the 6 hurdles and the race come with
the race (M5); no water animation or sunset glow yet (cheap phones).

**Then (11 Nov 2026, the owner's art in):** batches 1-2 imported (`node tools/manila/manila-import.js`) into the 'manila'
pack (64 files, 3.5 MB, for the CDN's app-assets/packs): the 4 ground textures, the 11 buildings, the 7 sheets cut into 42
pieces, the 10 people. The city is dressed with them (gate arches, wall pieces and towers, palms, lamps, carts, kiosks,
pier posts, the race arch and hurdles: drawn only once their pictures are in). **The crowd** (owner: "make it crowded, we
need at least 30 people"): 26 city folk besides the 7 (33 by day, 11 at night, 15 on a cheap phone), going between the
plaza, the market, the bay walk, the platform, the track, the pier, Calle Real, the church, the barrio and the park by the
hour; never behind or through a building; a passer-by says a line about the city. Their looks: the train visitors, the 3
ground guides and the places' guides, tinted (one list, C.MANILA.crowd.looks, for new city-folk sheets). Batches 3-7
(the grounds, weapons, icons) are in art-src/ for later steps.

**Not built yet:** the contracts, the Trading Post, the Armory and the weapons, the grounds and their caves, the race,
Lola Amparo's story chapters, hearts and gifts for the city people, boats.

---

## 1. Manila's layout (Proposed)

The map is 90 x 90 tiles. x goes left to right (0-89), y top to bottom (0-89). The bay is on the west, like the real
city. The valley road from Willowbrook comes in from the east.

| District | Tiles (x, y) | What is there |
|---|---|---|
| **Manila Bay** (water) | x 0-11, all down the west side | Calm bay water. Not walkable. Sunset glow over it from 5 to 7 PM. |
| **The Port** | x 2-20, y 50-66 | Harbor Office (14-19, 54-58), Kapitana Marisol. A wooden pier out into the bay (x 2-12, y 60-62) with 3 empty berths for **boats later**. Crates, rope, a lighthouse on the breakwater (3-5, 50-55). |
| **The Bay Walk** | x 12-15, y 6-48 and y 68-86 | A long seaside promenade: palms, old lamp posts, benches. At sunset the sky and water go orange-pink (a cozy nod to the real bay walk). Fishing from the rail like the town dock (later). |
| **The Walled Quarter** (inspired by Intramuros) | x 16-40, y 4-30 | Old stone walls 2 tiles thick with pointed bastions at the corners. Two gates: the Sea Gate (west, 16, 15) and the Plaza Gate (south, 28, 30). Cobbled lanes, old stone houses. |
| - the Old Stone Church | x 22-30, y 7-15, front to the south | A cozy old stone church with two bell towers and a little square in front (26, 16-19). Bells at 6 AM, noon and 6 PM. No real church's name. |
| - the Armory | x 31-37, y 18-23 | An old fort building, now Panday Lando's armory and forge. |
| - Lola Amparo's house | x 18-22, y 22-27 | The story character; her little museum room. |
| **Manila Central Station** | building x 56-64, y 3-8; platform x 60-86, y 10-11; rails out the east edge at y 8-9 | The train from Willowbrook arrives here. Mang Tibo sells tickets. |
| **Central Plaza** | x 40-58, y 36-54 | The big three-tier fountain in the middle (47-51, 43-47). The notice board (42, 37), Manila's Hall of Fame (51-58, 36-41), the event stage (39-44, 50-53). Where everyone meets. |
| **The Grand Market** | x 60-80, y 34-50 | The covered market hall (62-72, 35-42) with Aling Rosa and the crop Contract Board; stalls; the Trading Post (74-79, 36-41) with Mang Danny. |
| **Stables and Race Track** | x 52-88, y 56-88 | Stables (54-62, 58-63), paddock (54-62, 64-70), the grandstand (68-80, 56-59), the oval track (66-88, 60-86, 2 tiles wide with 6 hurdles). Mang Kardo. |
| **The Barrio** (homes) | x 20-38, y 56-86 | Colorful city houses, a corner store, a kalesa stand, a jeep stop, a small barangay court. Where the people live. |
| **Calle Real** (the old street) | x 16-38, y 31-54 | Shops and street-food carts from the Walled Quarter down to the plaza. |

Roads: a main avenue east-west at y 44-45 (plaza to the East Gate); a road north at x 44-47 (plaza to the Gorge Gate); a
road south-west from the plaza (40, 54) to the Jungle Gate (30, 89).

**The three gates** (one to each hunting ground):
- **Plains Gate** (east, x 87-89, y 43-46). This is also where the valley road comes in: the horse road from Willowbrook
  crosses the Open Plains and enters here.
- **Gorge Gate** (north, x 44-47, y 0-1).
- **Jungle Gate** (south, x 28-31, y 88-89).

**Where you arrive:** by train on the station platform; by horse at the Plains Gate; back from a ground at its gate.

The real-city nods are cozy cartoon inspirations only: no real company names, logos, flags or official seals; the
church, the walls and the bay walk are "inspired by", never copies of a real building.

---

## 2. Manila's people (Proposed)

In the town villagers' format (src/00-town2.js). Hearts, gifts and letters like the town's, later; to start they talk and
run their shops. None of them are marriage candidates (Proposed: the city is a place you visit).

| Key | Name | Role | Looks like |
|---|---|---|---|
| rosa | **Aling Rosa** | Grand Market buyer (crop contracts) | Cheerful, plump, fifties; black bun with a pencil in it, floral blouse, striped apron, a ledger book. |
| danny | **Mang Danny** | Trading Post (Mixer materials) | Wiry, grey hair, thin moustache, faded blue work shirt, canvas apron, rope over one shoulder. |
| lando | **Panday Lando** | Armory smith (weapons, ammo, repairs) | Big and gentle; red bandana, short black beard, soot on one cheek, leather apron. |
| kardo | **Mang Kardo** | Stable master and race host | Lively; wide straw hat, red neckerchief, leather vest, riding boots, a brass hand bell. |
| marisol | **Kapitana Marisol** | Harbor master (boats later) | Confident, forties; navy captain's coat, white cap with a plain anchor, brass spyglass. |
| tibo | **Mang Tibo** | Station master (train tickets) | Kind, round, old; big grey moustache, green railway jacket and cap, pocket watch. |
| amparo | **Lola Amparo** | Story: keeper of the Walled Quarter's stories | Small, bright-eyed; silver bun, round glasses, embroidered blouse with butterfly sleeves, paper fan, old book. |
| pedring | **Ka Pedring** | Open Plains guide (the Tamaraw herdsman) | Weathered, smiling; woven salakot hat, checked shirt, red towel round his neck, herding stick. |
| diday | **Diday** | Bamboo Jungle guide (bamboo weaver) | Sixteen; long braid with a white flower, green blouse, woven wrap skirt, a half-woven basket. |
| ambo | **Tata Ambo** | Rocky Gorge guide (cliff climber) | Cheerful, old; white beard, red knitted cap, wool vest, climbing rope, a seashell horn. |

In code, like the town (birthdays, likes and schedules are Proposed too):

```js
rosa:    { name: 'Aling Rosa', role: 'Grand Market buyer', home: 'market', birthday: [3, 8],
           loves: ['pineapple', 'halo_halo'], likes: ['banana', 'corn', 'bread'], dislikes: ['ore_copper'],
           schedule: [[6 * H, 'in:market'], [12 * H, 'plaza_s'], [13 * H, 'in:market'], [19 * H, 'in:barrio1']] },
danny:   { name: 'Mang Danny', role: 'Trading Post keeper', home: 'trading', birthday: [7, 21],
           loves: ['kapeng_barako'], likes: ['lumber', 'stone'], dislikes: ['cake'],
           schedule: [[6 * H, 'in:trading'], [18 * H, 'calle_cart'], [20 * H, 'in:barrio2']] },
lando:   { name: 'Panday Lando', role: 'Armory smith', home: 'armory', birthday: [11, 2],
           loves: ['ore_gold', 'boar_adobo'], likes: ['ore_silver', 'iron'], dislikes: ['bouquet'],
           schedule: [[6 * H, 'in:armory'], [12 * H, 'church_square'], [13 * H, 'in:armory'], [21 * H, 'in:armory']] },
kardo:   { name: 'Mang Kardo', role: 'Stable master and race host', home: 'stables', birthday: [5, 5],
           loves: ['oats', 'apple'], likes: ['carrot', 'treat'], dislikes: ['fish_s'],
           schedule: [[5 * H, 'in:stables'], [9 * H, 'paddock'], [16 * H, 'grandstand'], [20 * H, 'in:stables']] },
marisol: { name: 'Kapitana Marisol', role: 'Harbor master', home: 'harbor', birthday: [9, 14],
           loves: ['grilled_fish', 'fish_l'], likes: ['fish_m', 'coffee'], dislikes: ['ore_copper'],
           schedule: [[6 * H, 'in:harbor'], [11 * H, 'pier_end'], [17 * H, 'baywalk_sunset'], [19 * H, 'in:harbor']] },
tibo:    { name: 'Mang Tibo', role: 'Station master', home: 'station', birthday: [1, 30],
           loves: ['bread', 'kapeng_barako'], likes: ['cookie'], dislikes: ['bitter_gourd'],
           schedule: [[5 * H, 'in:station'], [22 * H, 'in:barrio3']] },
amparo:  { name: 'Lola Amparo', role: 'Storyteller of the Walled Quarter', home: 'amparo', birthday: [6, 12],
           loves: ['halo_halo', 'bouquet'], likes: ['mung_bean', 'jam'], dislikes: ['ore_copper'],
           schedule: [[6 * H, 'church_square'], [8 * H, 'in:amparo'], [15 * H, 'plaza_fountain'], [18 * H, 'in:amparo']] },
```

The three guides (pedring, diday, ambo) use the places' guide format instead (`npc: { name, look, sheet, at, lines }`):
four lines each with a small gift, like Lola Bugan: (1) welcome + a little of the tame food; (2) after 5 hunts + ammo;
(3) after the cave's guard + materials; (4) after the boss + the ground's dish. Their stories:
- **Ka Pedring** looks after the last wild Tamaraw herd on the plains. The Tamaraw are never hunted (only the calf comes
  home with you, as a friend). The Wild Toro herds push them off the good grass.
- **Diday** weaves baskets from the jungle's bamboo and knows its songs. The Bamboo Giant is old and sleepy, not angry.
- **Tata Ambo** blows his shell horn so the echo tells him where the flocks are. The Galura is a storm bird that guards
  the gorge, and only the brave reach it.
- **Lola Amparo's** story (city): five short chapters about the old city by the bay, the walls, the market, the port
  "where the boats will come back", each with a small gift. It ends at Manila Bay, which sets up the boats.

---

## 3. The hunting grounds (Proposed)

Each about 52 x 52 tiles (~3 times Pulag), its own public room (up to 30), a cave of **50 floors** at the far end like
the five places (lift every 10, the guard on every 10th floor, the boss on floor 50, soloable with more health per
friend, a daily chest). Each has a 4-piece gear set (Kanor makes it, like the places' sets) and a dish.

Every weapon works in every ground; each ground is shaped so one weapon is clearly best there.

Stats are in the C.WILD format (src/00-wild.js): hp = hits to bring it down at damage 1; run = tiles a second; shy = it
runs when you are this close; angry = it charges this close; hit = energy a charge costs; kg = Hunter's Book weight;
drops = [item, how many, chance]. `px` comes from the picture when it arrives. Two new keys are proposed: `flock: n`
(that many come and go together, standing side by side) and `zigzag: true` (it dodges as it runs).

| Ground | Opens at | Energy a shot | Cave | Like (difficulty) |
|---|---|---|---|---|
| Open Plains | 30 hunts | 3 | Sarangay's Halls | between Makiling and Banaue |
| Bamboo Jungle | 70 hunts | 3 | the Bamboo Hollows | about Bohol / Taal |
| Rocky Gorge | 110 hunts | 4 | the Echo Caves | about Sierra / Palawan |

### 3a. The Open Plains (the Rifle) — east of the city, the valley road runs across it

Wide golden grassland, few props in the middle, a pond, a windmill, the **Plains Halt** (a rest stop on the valley road
with a water trough: the horse road from Willowbrook stops here) and Ka Pedring's hut. The Tamaraw meadow (fenced; the
grown Tamaraw graze there and are scenery, never targets). The cave's door is on a low mesa in the far north-east.

**Why the Rifle shines:** you can see far, and these animals run while you are still far off (shy 4.8 to 9), past the
Bow's reach; the Wild Toro charges from 4.5 tiles, and the Rifle (4 to 8) can hit it before it starts. The Moon Rifle's
shot goes through a deer and hits the one behind (the deer come in herds of 3 in a line).

```js
pugo:      { name: 'Pugo', w: 0.6, kg: 0.2, hp: 1, walk: 0.6, run: 5.0, shy: 4.8, flies: true, flock: 3,
             drops: [['meat_pugo', 1, 1], ['egg_pugo', 2, 0.6]] },
tikling:   { name: 'Tikling', w: 0.75, ground: true, kg: 0.35, hp: 2, walk: 0.7, run: 6.2, shy: 5.4,
             drops: [['feather_tikling', 1, 1], ['meat_pugo', 1, 0.4]] },
batikdeer: { name: 'Batik Deer', w: 1.3, kg: 55, hp: 4, walk: 0.8, run: 5.2, shy: 6.5, flock: 3,
             drops: [['venison_batik', 2, 1], ['antler_batik', 1, 0.5]] },
kuwago:    { name: 'Kuwago', w: 0.9, kg: 0.5, hp: 2, walk: 0.5, run: 4.8, shy: 5, flies: true, night: true,
             drops: [['feather_kuwago', 1, 1]] },
toro:      { name: 'Wild Toro', w: 1.9, ground: true, kg: 420, hp: 8, walk: 0.6, run: 4.6, angry: 4.5, hit: 15,
             drops: [['beef_toro', 2, 1], ['hide_toro', 1, 1], ['horn_toro', 1, 0.6]] },
bulalakaw: { name: 'Bulalakaw', w: 1.2, kg: 3, hp: 5, walk: 0.6, run: 7.2, shy: 9, flies: true, rare: true, respawn: 120,
             drops: [['comet_feather', 1, 1]] },               // the comet bird: only a sneaking Rifle reaches it
tamaraw_calf: { name: 'Tamaraw Calf', w: 0.9, ground: true, kg: 60, hp: 1, walk: 0.5, run: 3.8, shy: 2.4, drops: [] },
animals: { pugo: 6, tikling: 4, batikdeer: 6, toro: 3 },
extra: [{ kind: 'kuwago', n: 3, when: 'dusk' }, { kind: 'pugo', n: 3, when: 'dawn' }, { kind: 'toro', n: 2, when: 'rain' },
        { kind: 'bulalakaw', n: 1, when: 'rare' }],
tame: { kind: 'tamaraw_calf', food: 'oats', feedings: 10, runOff: 0.25, back: 20, skill: 'carry' },
```
- **Tame: the Tamaraw Calf**, fed **oats** (planted). Skill proposed: `carry`, a new one: while it walks with you, your
  bag holds 6 more. (If a new skill is too much: `fetch`.) The Tamaraw is real and rare in life, so in the game it is
  only ever a friend, never hunted.
- **Sarangay's Halls** (cave): long straight sandstone halls with old cart rails (long sight lines, the Rifle again).
  - Lampong (little herder dwarf, runs off): `hp: 4, run: 5, shy: 3.6, ground: true, kg: 8`, drops lampong_hat.
  - Cave Salagubang (big beetle, charges): `hp: 5, run: 4.2, angry: 3, hit: 12, ground: true, kg: 6`, drops shell_salagubang.
  - **Sarangay** (guard, every 10th floor): `hp: 22, angry: 3.4, hit: 15, boss: true, kg: 700`, drops sarangay_jewel.
  - **Arimaonga** (boss, floor 50; the sun-maned lion of Maranao legend): `hp: 34, hpEach: 14, minHits: 3, angry: 4,
    hit: 18, boss: true, kg: 1500`, drops mane_arimaonga.
- **Dish:** Kwek-Kwek (egg_pugo + wheat): 70 energy.
- **Chest loot** (the last two icons, like Banaue's terrace stones): cogon_bundle, plains_seeds.
- **Gear (Plainsrunner):** Salakot hat, Toro vest, rancher boots, Comet charm (3,000 to 6,000 Gold + drops).

### 3b. The Bamboo Jungle (the Javelin) — south of the city

Tight 2-tile trails between thick bamboo clumps, small streams with stepping stones, a waterfall pool in the middle,
Diday's weaving hut by the gate, the cave door at the far south.

**Why the Javelin shines:** proposed new rule: **tall bamboo blocks shots longer than 4 tiles**, so long range is
wasted here. The animals hide until you are 2 to 3 tiles away, then run or jump at you: the Javelin is the fastest
(0.35 s) and hits hard (1 to 4). The Moon Javelin hits 2 side by side (the warty pigs come in pairs).

```js
bugkon:     { name: 'Bugkon', w: 0.8, hop: 0.08, kg: 1.8, hp: 3, walk: 0.6, run: 4.4, shy: 2.2,
              drops: [['fur_bugkon', 1, 1]] },
kalaw:      { name: 'Kalaw', w: 1.2, kg: 2.2, hp: 4, walk: 0.6, run: 5.0, shy: 2.8, flies: true,
              drops: [['feather_kalaw', 1, 1], ['casque_kalaw', 1, 0.5]] },
baboydamo:  { name: 'Baboy-damo', w: 1.4, ground: true, kg: 70, hp: 6, walk: 0.7, run: 4.2, angry: 2.2, hit: 15, flock: 2,
              drops: [['meat_baboy', 2, 1], ['tusk_warty', 1, 0.5]] },
maral:      { name: 'Maral', w: 1.0, kg: 4, hp: 5, walk: 0.9, run: 5.0, angry: 2.4, hit: 13, night: true,
              drops: [['pelt_maral', 1, 1], ['whisker_maral', 1, 0.5]] },
tuko:       { name: 'Tuko', w: 0.7, ground: true, kg: 0.3, hp: 2, walk: 0.5, run: 4.0, shy: 2,
              drops: [['skin_tuko', 1, 1]] },
pilandok:   { name: 'Pilandok', w: 0.7, ground: true, kg: 2, hp: 6, walk: 0.8, run: 6.8, shy: 3, zigzag: true,
              rare: true, respawn: 120, drops: [['silver_hoof', 1, 1]] }, // the clever mouse deer: fast and dodging
biik:       { name: 'Biik', w: 0.6, ground: true, kg: 3, hp: 1, walk: 0.6, run: 4.0, shy: 2.2, drops: [] },
animals: { bugkon: 4, kalaw: 4, baboydamo: 4, tuko: 4 },
extra: [{ kind: 'maral', n: 3, when: 'dusk' }, { kind: 'kalaw', n: 2, when: 'dawn' }, { kind: 'baboydamo', n: 2, when: 'rain' },
        { kind: 'pilandok', n: 1, when: 'rare' }],
tame: { kind: 'biik', food: 'cassava', feedings: 9, runOff: 0.25, back: 20, skill: 'fetch' },
```
- **Tame: the Biik** (a warty piglet), fed **cassava** (planted). Skill `fetch` (it noses the drops to you).
- **The Bamboo Hollows** (cave): earth caves held by giant bamboo roots; short rooms, more corners (the Javelin again).
  - Kagwang (gliding colugo, drops on you): `hp: 6, run: 4.6, angry: 3, hit: 13, kg: 1.5`, drops cape_kagwang.
  - Bamboo Sprite (runs off): `hp: 5, run: 5, shy: 3.4, ground: true, kg: 3`, drops twig_sprite.
  - **Tigmamanukan** (guard, the omen bird of Tagalog legend): `hp: 26, angry: 3.6, hit: 16, boss: true, kg: 90`, drops feather_tigma.
  - **Bamboo Giant** (boss, floor 50; our own gentle giant, not from a legend): `hp: 40, hpEach: 16, minHits: 3,
    angry: 4, hit: 19, boss: true, kg: 2200`, drops bamboo_heart.
- **Dish:** Sinigang na Baboy-damo (meat_baboy + taro + tomato): 110 energy.
- **Chest loot:** bamboo_poles, bamboo_mat.
- **Gear (Bamboo):** bamboo hat, Maral vest, bamboo sandals, Pilandok charm.

### 3c. The Rocky Gorge (the Boomerang) — north of the city

A canyon: cliff walls you can't climb, wide ledges, a stream down the middle (x 24-27), two rope bridges, Tata Ambo's
climbers' camp by the gate, the cave door at the far north.

**Why the Boomerang shines:** the birds and the living stones come in **flocks of 3 to 5 standing side by side** on the
ledges. The Boomerang (owner: "double hit") hits the first animal on the way out and the first on the way back, and
needs no ammo, so a flock costs nothing but wear. The Moon Boomerang hits 2 side by side each way (up to 4 a throw).

```js
kalapati: { name: 'Kalapati', w: 0.7, kg: 0.35, hp: 3, walk: 0.6, run: 5.0, shy: 3.4, flies: true, flock: 4,
            drops: [['feather_kalapati', 1, 1], ['meat_kalapati', 1, 0.6]] },
langay:   { name: 'Langay-langayan', w: 0.55, kg: 0.02, hp: 2, walk: 0.6, run: 6.0, shy: 3, flies: true, flock: 5,
            drops: [['feather_langay', 1, 1], ['nest_mud', 1, 0.3]] },
ibid:     { name: 'Ibid', w: 1.1, ground: true, kg: 1.2, hp: 4, walk: 0.6, run: 5.4, shy: 3.2,
            drops: [['sail_ibid', 1, 1]] },
banog:    { name: 'Banog', w: 1.3, kg: 1.6, hp: 6, walk: 0.6, run: 5.2, angry: 4, hit: 14, flies: true,
            drops: [['feather_banog', 1, 1], ['talon_banog', 1, 0.5]] },        // swoops at you
batobato: { name: 'Bato-Bato', w: 0.9, ground: true, kg: 60, hp: 7, walk: 0.5, run: 4.0, angry: 2.6, hit: 13, flock: 3,
            drops: [['pebble_bato', 2, 1], ['gorge_crystal', 1, 0.3]] },        // living stones, roll at you
adarna:   { name: 'Ibong Adarna', w: 1.2, kg: 1, hp: 8, walk: 0.6, run: 6.4, shy: 7, flies: true, rare: true, respawn: 120,
            drops: [['adarna_feather', 1, 1]] },   // when it sings, every animal near stands still for 3 s (a gift to the hunter)
squab:    { name: 'Little Kalapati', w: 0.5, kg: 0.15, hp: 1, walk: 0.5, run: 4.2, shy: 2.2, flies: true, drops: [] },
animals: { kalapati: 8, langay: 5, ibid: 3, batobato: 3 },
extra: [{ kind: 'banog', n: 2, when: 'dawn' }, { kind: 'banog', n: 1, when: 'dusk' }, { kind: 'langay', n: 5, when: 'rain' },
        { kind: 'adarna', n: 1, when: 'rare' }],
tame: { kind: 'squab', food: 'mung_bean', feedings: 9, runOff: 0.22, back: 20, skill: 'spot' },
```
- **Tame: the Little Kalapati** (a young pigeon, the kalapati sheet smaller), fed **mung beans** (planted). Skill `spot`
  (it coos when the Ibong Adarna is out).
- **The Echo Caves** (cave): blue crystal caves, wide rooms where groups gather (the Boomerang again).
  - Alitaptap (big friendly fireflies, groups of 3, flit off): `hp: 4, run: 5.4, shy: 3, flock: 3, kg: 0.5`, drops jar_glow.
  - Kabog (cave bats, groups of 3, dive at you): `hp: 7, run: 5, angry: 3.4, hit: 15, flock: 3, kg: 1`, drops wing_kabog.
  - **Bato King** (guard, chief of the living stones): `hp: 30, angry: 3.4, hit: 17, ground: true, boss: true, kg: 3000`, drops crown_bato.
  - **Galura** (boss, floor 50; the storm eagle of Kapampangan legend): `hp: 44, hpEach: 18, minHits: 3, angry: 4,
    hit: 20, boss: true, kg: 300`, drops feather_galura.
- **Dish:** Ginisang Monggo (mung_bean + meat_kalapati + garlic): 120 energy.
- **Chest loot:** climbing_rope (and the drops above).
- **Gear (Climber):** knitted cap, Banog cape, climbing boots, Adarna charm.

Respect notes (like Banaue's bulul): the creatures are all drawn cute and kind; bosses are grumpy, never wicked. The
Sarimanok (a sacred Maranao symbol) is left out on purpose. The Ibong Adarna is from the old public epic; it "drops a
feather and flies off" like every animal.

Drop prices (Proposed): Plains drops 20 to 150, the comet feather 900; Jungle 60 to 300, the silver hoof 1,500; Gorge
100 to 480, the Adarna feather 2,600. Guard parts 900 to 2,200; boss parts 1,400 to 3,400 (the places' ladder).

---

## 4. Prices and unlocks (Proposed)

Bought and upgraded at the **Armory** (Panday Lando). A weapon's level keeps the owner's range and damage; the speed is
the same at every level (owner). Upgrading needs the level before. Materials: ores from the mine, drops from the
grounds (and the Lair for Magma), and the Mixer's Rope, Farm Cement and Beeswax.

### The Rifle (needs the Open Plains open)
| Level | Gold | Materials |
|---|---|---|
| Basic | 2,500 | 10 lumber, 5 iron |
| Copper | 5,000 | 8 copper ore, 2 Farm Cement, 4 Toro Hide |
| Silver | 12,000 | 8 silver ore, 4 Farm Cement, 4 Toro Horn |
| Gold | 30,000 | 8 gold ore, 6 Farm Cement, 3 Sarangay Jewel |
| Magma | 60,000 | 40 ember shard, 5 obsidian, 3 Arimaonga Mane |
| Moon | 600,000 | the Magma Rifle, 6 Arimaonga Mane, 3 Bamboo Heart, 3 Galura Feather, 5 Bakunawa Scale |

### The Javelin (needs the Bamboo Jungle open)
| Level | Gold | Materials |
|---|---|---|
| Basic | 2,000 | 12 lumber, 2 Rope |
| Copper | 4,000 | 8 copper ore, 3 Rope, 4 Warty Tusk |
| Silver | 10,000 | 8 silver ore, 5 Rope, 4 Maral Pelt |
| Gold | 25,000 | 8 gold ore, 6 Rope, 3 Tigmamanukan Feather |
| Magma | 50,000 | 40 ember shard, 5 obsidian, 3 Bamboo Heart |
| Moon | 600,000 | the Magma Javelin, 6 Bamboo Heart, 3 Arimaonga Mane, 3 Galura Feather, 5 Bakunawa Scale |

### The Boomerang (needs the Rocky Gorge open)
| Level | Gold | Materials |
|---|---|---|
| Basic | 1,500 | 8 lumber, 2 Beeswax |
| Copper | 3,500 | 8 copper ore, 3 Beeswax, 6 Kalapati Feather |
| Silver | 8,000 | 8 silver ore, 4 Beeswax, 4 Banog Feather |
| Gold | 20,000 | 8 gold ore, 5 Beeswax, 3 Bato Crown |
| Magma | 40,000 | 40 ember shard, 5 obsidian, 3 Galura Feather |
| Moon | 600,000 | the Magma Boomerang, 6 Galura Feather, 3 Arimaonga Mane, 3 Bamboo Heart, 5 Bakunawa Scale |

(The Moon prices match Haliya's Moon Bow, 600,000, "so they grind the mine also". Each Moon weapon needs all three
Manila bosses, so a Moon hunter has been everywhere.)

### Ammo, wear and energy
- **Javelins:** 150 Gold for 5 (owner's number). **Bullets:** 200 Gold for 10 (owner's number). Arrows stay 60 for 10.
- **Boomerang wear** (owner's throws: 100 to 600, a warning at 20 left, broken at 0). **Repair to full** at the Armory
  or the town Forge, lumber + Rope + a little Gold (owner's recipe):

| Level | Repair |
|---|---|
| Basic | 2 lumber, 1 Rope, 100 Gold |
| Copper | 3 lumber, 1 Rope, 200 Gold |
| Silver | 4 lumber, 2 Rope, 400 Gold |
| Gold | 5 lumber, 2 Rope, 800 Gold |
| Magma | 6 lumber, 3 Rope, 1,500 Gold |
| Moon | 8 lumber, 4 Rope, 3,000 Gold |

  A broken boomerang is gone (owner). Proposed kindness: a broken Magma or Moon one can be **rebuilt** for half its
  upgrade's Gold (not the materials), so a mistake never costs 600,000.
- **Energy:** 3 a shot in the Plains and Jungle, 4 in the Gorge and every cave (the crop potions matter here).

### Getting there
- **Train** (Willowbrook Station to Manila Central, Mang Tibo): **250 Gold one way**; the first trip is free; a **Week
  Pass** 1,200 Gold (as many rides as you like for 7 days). Straight there, no stops.
- **Horse** on the valley road (owner: 6 hearts + Horseshoes). It goes through the Open Plains and stops at the Plains
  Halt (water trough; the horse drinks: +20 stamina). Proposed: the ride costs about a third of a full stamina bar, so
  bring oats.
- **On horseback in Manila:** allowed, like the town (3 hearts). The grounds count as hunting places: **8 hearts**; the
  caves **10 hearts + Lantern Bridle** (farm-economy-v2).
- **The Stables** sell oats at **30 Gold each** (the farm's oats sell for 14): planting your own is far cheaper.

---

## 5. The Grand Market and the weekly race (Proposed)

### Crop contracts (Aling Rosa's board)
- 3 contracts on the board, new each day at 8 AM (Manila time, like the daily resets), plus 1 big **City Order** each
  week (Monday 8 AM).
- Take one at a time; deliver from your bag or your Silo within 48 hours; a contract left unfinished just goes away.
- They pay about **1.6 to 1.8 times** what the crops sell for at home: planting for Manila beats selling.
- Each finished contract gives 1 **Market Star**. 10 / 30 / 60 stars open bigger contracts that pay 10% more.
- Only planted crops (owner, farm-economy-v2), and Mixer goods.

| Example | Crops (sell value) | Pays |
|---|---|---|
| Corn order (owner's example) | 200 corn (3,600) | 6,000 Gold |
| Stable feed | 150 oats (2,100) | 3,600 Gold |
| Fruit cart | 90 pineapple (2,250) | 3,900 Gold |
| Market greens | 150 cabbage (2,400) | 4,100 Gold |
| Rice and saba | 100 rice + 60 banana (2,880) | 4,900 Gold |
| Soup kitchen | 60 mung bean + 60 bitter gourd (1,560) | 2,700 Gold |
| Builder's order (Mixer) | 30 Farm Cement (~2,600 in crops) | 4,500 Gold |
| **City Order** (weekly, pays about double) | 600 mixed crops, 4 kinds of the board's choosing (~9,000) | 18,000 Gold + 3 Market Stars + a house trophy the first time |

The Trading Post (Mang Danny) buys and sells Mixer materials (Farm Cement, Rope, Sili Powder, Beeswax) at fixed prices,
selling at about twice what it buys for, so making your own pays.

### The weekly horse race: the Manila Cup
Proposed in two steps, to fit the 30-a-room game server:
1. **Time trial (ships first).** All week (Monday 8 AM to Sunday 7 PM) you can ride the track alone: 3 laps of the oval,
   6 hurdles. Tap to gallop (uses stamina), tap to jump; a knocked hurdle costs time. Your **best time** counts. The
   first try each day is free, more tries 200 Gold each. Needs 6 hearts and Horseshoes. Feeding oats before a run fills
   stamina. The server checks every time (no lap faster than a perfect ride).
2. **Live heats (later).** Saturday evening: up to 8 riders race at once in one room, for fun and a ribbon.

Prizes (Sunday 7 PM; the raids stay at 8 PM):
| Place | Prize |
|---|---|
| 1st | 15,000 Gold + the Gold Horseshoe Cup (a house trophy) + "Manila Cup Champion" on the Hall of Fame for the week |
| 2nd | 8,000 Gold + the Silver Cup |
| 3rd | 5,000 Gold + the Bronze Cup |
| 4th to 10th | 2,000 Gold + a ribbon |
| Everyone with 3 runs | 300 Gold + 3 oats |

---

## 6. Build order and risks (Proposed)

Needs first: the raids finished (owner), and farm-economy-v2 step 3 (the Mixer: Rope, Farm Cement, Beeswax) and step 5
(the horse going out) for the valley road and the race.

Small releases, each its own update and its own download pack:
1. **M1, the city.** The map, the train (and the valley road if the horse is ready), the plaza, the people walking,
   Lola Amparo's story, the Grand Market contracts, the Trading Post. Public rooms. Art: batches 1, 2 and the city icons.
2. **M2, the Rifle + the Open Plains.** The Armory, bullets, the Plains, the Tamaraw Calf, Sarangay's Halls (all 50
   floors), the Plainsrunner gear. Art: batch 3, the Rifle part of batch 6.
3. **M3, the Javelin + the Bamboo Jungle.** Javelins, the bamboo line-of-sight rule, the Biik, the Bamboo Hollows.
   Art: batch 4, the Javelin part of batch 6.
4. **M4, the Boomerang + the Rocky Gorge.** Wear and repairs, flocks, the Little Kalapati, the Echo Caves.
   Art: batch 5, the Boomerang part of batch 6.
5. **M5, the Stables + the Manila Cup** (time trial first, live heats later). Art: the race cups.
6. **M6, the Moon weapons** (they need all three bosses, so after M4).
7. **Later: Manila Bay boats** (Kapitana Marisol; the pier's 3 berths are waiting).

Risks:
- **Page size.** The game page is nearly full: every Manila picture goes in a download pack (one per release), with
  drawn stand-ins until it arrives (like the places). The maps (90 x 90 is big) and, if possible, Manila's numbers load
  from the CDN with the pack, not the page. Weapon icons are also new item icons: they go in the pack and are painted
  into the items sheet on load, so the page's items picture does not grow.
- **Low-end phones (OPPO A5).** 8,100 tiles plus props is about 3 farms: draw only what is near the camera, keep the
  bay's water animation light, fewer ambient walkers and no sunset glow on low-end, half-size pack pictures on phones
  under 4 GB, and a loading screen while the pack comes. Test on the OPPO before each release.
- **The game server's 30-a-room public rooms.** Manila opens more rooms as they fill ("Manila 1", "Manila 2"...);
  friends land in the same room where they can. Plaza events happen in every room. Each ground is its own set of rooms
  (30 each) and each cave floor works like today's places. ~20 animals in each ground (more than a place today), shared
  by the server: watch its CPU on the DigitalOcean box. The race starts as a solo time trial so it needs no new room
  type.
- **Balance.** The Rifle's reach (up to 8) could make the old places too easy. Proposed: the new weapons work there too,
  but cost 1 more energy a shot outside Manila's grounds. (Owner to decide.)
- **New engine pieces** (each small, but new): flocks, zigzag, bamboo blocking shots, the boomerang's out-and-back hit,
  the `carry` skill, 3 new player pose sheets (and later the dungeon looks' own versions of them: until then the looks
  use the plain farmer's poses).
- **Old saves:** nothing is lost; everything is appended (items, icons, counters), like every place before.
