# Sunny Acres

A Harvest Moon style farming game: portrait (9:16), touch-first, built with Phaser 3 in plain JavaScript.
It ships as **one offline HTML file** (`dist/index.html`, about 4.4 MB) with Phaser, the code, the Tiled maps, all
art (as WebP data URLs) and synthesized music. It makes no network requests and uses no CDNs.

The art is drawn at **256×256 per tile** in a smooth cartoon style and scaled down on screen. A tile is shown at
32 layout pixels, and the game renders at the screen's pixel density (up to 3×) so the detail stays sharp.
Props (furniture, town buildings) and villagers are stored at half resolution to save memory.

## Performance on low-end phones

Tested with the CPU slowed 6x (about OPPO A5 class):

| Place | JS time per frame (avg / p95) |
| --- | --- |
| Farm | 9.4 / 16.3 ms |
| Farm at night (glows, fireflies) | 11.2 ms avg |
| Town plaza | 12.4 / 17.9 ms |
| Town in a storm | 9.4 / 15.3 ms |
| House, mine | 6.3 to 7.2 ms avg |

- **Frame budget:** 60 fps needs under 16.7 ms; every place fits on average.
- **Startup:** cold start is about 13 s at 6x slowdown (about 2 to 3 s at full speed); the generated pictures
  made the page bigger (about 11 MB). A "Loading your farm…" message
  shows meanwhile.
- **GPU memory:** only the farm sheets are uploaded at boot. Indoor tiles, villagers and props are added the first
  time a map needs them.
- **UI drawing:** UI panels are drawn once into textures (`bake()` in `src/12-ui.js`). Live Phaser Graphics
  re-tessellate every frame, so avoid them in the UI.
- **FPS meter:** pause menu → **Show FPS**.

## How to play

Drag anywhere to walk. The big action button acts on the highlighted tile and shows what it will do.
Desktop keys for testing: WASD/arrows move, Space/Enter act (hold to charge), 1 to 6 hotbar, E bag, Esc back.

### Getting started

- **Boy or girl:** a new game starts by asking who you will play: the farmer boy or the farmer girl.
- **Goals:** a new farm shows one goal at a time under the top bar: clear debris, till, plant, water, feed
  Clucky, sleep, collect an egg, visit town, sell at the market stall, meet villagers, harvest. Each one pays a small reward. A
  yellow arrow points the way, even across maps. Tap the goal bar for details.
- **Tips:** the first time you hold each kind of item (a tool, seeds, feed, food...), a tip explains it.
- **Mail:** the mailbox by the house gets letters: a welcome lunch, festival invitations, birthday reminders,
  thank-you gifts from villagers at 3 hearts, and rewards for earning milestones and deep mine floors.

### The farm

- **Clearing:** a new farm is overgrown. Use the **Sickle** on weeds, the **Axe** on branches and stumps (lumber),
  and the **Hammer** on stones and boulders (stone). Stumps and boulders take several swings, and boulders need a
  Copper Hammer. A few weeds sprout at each new season.
- **Crops:** hoe the soil, then plant. A **seed bag** sows the 3×3 tilled patch around the tile. Water every day;
  rain does it for you. The Hammer flattens empty tilled soil.
- **Crops by season:**

  | Season | Crops |
  | --- | --- |
  | Spring | Turnip 3 days/60G, Potato 5/80G, Strawberry 7/50G (regrows every 3) |
  | Summer | Tomato 6/60G (regrows every 3), Corn 9/100G (regrows every 4) |
  | Fall | Carrot 4/70G, Pumpkin 10/250G |
  | All but winter | Grass: cut it with the Sickle for Fodder, and it regrows |

- **Selling at the market stall** (north side of the town plaza): crops, produce, fish, ore and forage.
  - **Sell now** pays 75% of the base price straight away.
  - **Shelves** (6 of them, up to 20 of one item each): pick a price and a villager comes by to buy the lot.
    When you are in town you see them walk up to the stall, stop to buy, and go back to their day.
    Low pays 100% in about 40 minutes, Fair 120% in about 2.5 hours, High 140% in about 6 hours (game time).
    Time also passes for the shelves while you are away and overnight. Coins wait at the stall (a coin bobs over
    it) until you collect them.
  - **The order board** on the plaza has 3 villagers' requests, like "5 Eggs + 3 Turnips". Delivering one
    pays 150% of the items' price plus friendship with that villager; a new order comes about an hour later.
    Orders only ask for what you can get now: crops in season, your animals' produce, fish (with a rod) and ore
    from mine floors you have reached. A "!" over the board means you can fill one.
- **Lily's Seed Stand** (south of the field, 9 AM to 5 PM) has Seeds, Animals and Supplies (Brush, Milker,
  Fishing Rod, Miracle Potion, Blue Feather).
- **Days:** the clock runs from 6 AM. At 2 AM you pass out (half energy next day). Sleep in the bed in your
  farmhouse. The **TV** has tomorrow's weather.

### Tools and energy

- **Tool upgrades:** Bram at the forge upgrades each tool: Copper (1000G + 5 Copper Ore), Silver (2500G + 5 Silver
  Ore), Gold (5000G + 5 Gold Ore). Upgrades are instant.
- **Swings:** the farmer raises and swings each tool (or tips the can and seed bag). Chips fly off debris,
  watered crops wiggle, and what you gather flies into the bag.
- **Charging:** upgraded tools use less energy and **charge**. Hold the action button and release: 3 tiles, then
  3×3, then 3×5.
- **Watering can:** it holds 20 waters, up to 60 at Gold. Each tile costs 2 energy with the basic can, less with
  upgrades.
- **Food:** eat food to restore energy (tap Eat with it in hand, or from the bag). With a **kitchen** you cook 9
  recipes from your crops, eggs, milk, fish and mushrooms. Rosa's inn and Ivy's clinic sell meals and tonics.

### Animals

- **Care:** chickens live in the coop; cows, pigs and carabaos in the barn. Feed, pet and **brush** them daily.
  Chickens eat Chicken Feed; the others eat Fodder.
- **Produce:** a fed animal has its produce ready the next morning: an egg, milk, a truffle (pig) or carabao milk.
  Cows and carabaos need a **Milker**. At 3+ hearts chickens and cows give Large Eggs and Large Milk.
- **Chicks and calves:** hold an egg at the coop to put it in the incubator, and a chick hatches in 3 days.
  A Miracle Potion given to a cow with 2+ hearts brings a calf in 7 days. Chicks and calves grow up in a few days.
- **Prices:** Chicken 500G, Pig 1500G, Cow 2000G, Carabao 3000G. Egg 40G (large 70G), milk 100G (large 150G),
  truffle 90G, carabao milk 130G (it cooks like milk).
- **Bigger buildings:** Mira builds a Bigger Coop and a Bigger Barn (8 chickens; 8 cows, 4 pigs and 4 carabaos).
  The small barn holds 4 cows, 2 pigs and 2 carabaos.
- **Pets:**
  - **Biscuit the dog** lives by the house. Pet him every day.
  - **The horse:** Mira's Stable brings Chestnut the horse. Walk up to him to ride: he's 1.7× faster, he can
    go to town, and his saddlebag opens the market stall from anywhere. He waits outside when you go indoors or
    down the mine.
  - **Mochi the cat** comes with the Cat Basket from Mira's furniture catalog and lives in the farmhouse.

### Your home

- **House levels:** the farmhouse grows from a Cozy Cabin (Lv 1, a 6 x 7 room) to a Mansion (Lv 10, 18 x 11).
  Mira builds each level with gold, lumber and stone, in 1 to 5 days; the house on the farm changes with it.
  The Farmhouse (Lv 3) has room for two, which you need to marry. The levels are a table in `src/00-home.js`:
  add a row (and run `npm run map`) for Lv 11 and up.
- **Furniture:** 27 kinds of furniture (beds, sofas, wardrobes, lamps, paintings, a fireplace, a grandfather
  clock...), each in 5 styles (Classic, Rustic, Cottage, Modern, Royal) plus 5 festival editions (Flower
  Festival, Fireworks, Harvest, Cow Festival, Starry Night) sold only in their festival's season. Buy them in
  Mira's Woodshop → Furniture; they go to your storage.
- **Decorate** (the button in the house): tap a piece to choose it and drag it to move it (it turns red where it
  can't go: off the floor, on another piece, in the doorway, or blocking the way to your bed, TV or kitchen).
  Turn it, put it away, place pieces from storage, and change the wallpaper and floor (9 styles each). Drag the
  floor to look around. Wall pieces (windows, paintings, shelves) hang on the back wall.
- **Home Beauty:** every piece adds beauty (a second copy of the same piece counts half), and so do the house
  level, the wallpaper and the floor. Cozy (120), Charming (250), Lovely (450) and Dreamy (750) homes give +5 to
  +20 max energy. Villagers mention a lovely home, and once a week a friend drops by to see it.

### Your yard

- **The meadow:** the farm is 38 tiles wide; the land east of the field is yours to decorate (older saves keep
  their crops in place).
- **Outdoor pieces** (Mira's Woodshop → Outdoor): fences that join up as you place them (wooden, picket, stone,
  iron), paths you can walk on, hedges, garden pieces (flower beds, planters, roses, sunflowers, apple and cherry
  trees, a pond, a fountain, a birdbath, a scarecrow), yard furniture and lights (bench, picnic table, swing, lamp,
  umbrella, birdhouse, wishing well, statue, windmill, gazebo) and festival editions sold in their season.
  A new farm starts with a few fences, a flower bed and a bench in storage.
- **Decorate** on the farm: tap a piece and drag it, or put it away; from Storage, a fence, path or hedge is placed
  with a tap on each tile. Nothing may be built on the field, the pen or the paths to doors, and nothing may wall
  off the house, a door, the field or the pen.
- **Beauty:** outdoor pieces add to Home Beauty (fences, paths and hedges count every tile; other repeats count
  half).

### Willowbrook (the town)

- **Getting there:** walk down the road south of the farm.
- **The town** (54 x 52 tiles): the plaza with the market stall and the order board in the middle; Market Street
  to the east (bakery, flower shop, post office, library, Marco's wagon, market stalls and the vet); the park
  (pond, gazebo, playground, benches); the beach on the lake (pier, boat, the Seaside Shack); and over the bridge
  to the south, the lane of homes, the school and the chapel.
- **The people:** 23 villagers walk their daily schedules between their homes, shops and the town's places. On rest
  days (the 6th and 7th day of each week) there is no school, so the children and the teacher do other things.

  | Who | Role | | Who | Role |
  | --- | --- | --- | --- | --- |
  | Lily | Seed stand | | Clara | Teacher |
  | Mayor Hollis | Mayor | | Father Tomas | Priest |
  | Bram | Blacksmith | | Hana | Baker |
  | Mira | Carpenter | | Marco | Travelling merchant |
  | Rosa | Innkeeper | | Sora | Artist |
  | Leo | Fisherman | | Dr. Hale | Doctor |
  | Ivy | Herbalist | | Nina | Nurse |
  | Grandma Pearl | Grandmother | | Owen | Veterinarian |
  | Grandpa Ewan | Retired fisherman (runs the Seaside Shack) | | Poppy | Florist |
  | Pip | Schoolboy | | Finn | Mail carrier |
  | Daisy | Schoolgirl | | Elliot | Librarian |
  | | | | Jules | Musician |

- **Visitors:** people from out of town (a farmer, a tourist, a chef...) walk in along the valley road during the
  day, look around Market Street and the park, buy at your market stall, and leave.

- **Friendship:** talk to each villager once a day, and give one gift a day. They love, like, don't mind, or dislike
  each item, and birthday gifts count double. Friendship shows as 10 hearts (pause → Friends).
- **Heart events:** at friendship milestones (2, 4 and 6 hearts for the 14 marriage candidates: Lily, Mira, Leo,
  Ivy, Clara, Hana, Marco, Sora, Nina, Owen, Poppy, Finn, Elliot and Jules; 3 for the others),
  talking to them starts a little story scene that ends with a choice.
- **In town:** villagers are solid, show their name when you are near, and hum or react with speech bubbles.
- **Buildings:** doors open shop menus during opening hours. Every panel has a Talk button for the person who runs
  it.
  - Forge: tool upgrades.
  - Woodshop:
    - The house upgrades (see Your home), and built overnight with gold, lumber and stone: Kitchen (2500G + 40
      lumber), Bigger Coop (3000G + 40 lumber), Bigger Barn (6000G + 80 lumber + 20 stone), Stable (4000G + 60
      lumber).
    - The furniture catalog: pick a style, then a piece. The Music Box (a tune and +5 energy once a day), the
      Aquarium (shows the fish you have caught) and the Cat Basket do something too.
    - Lumber 50G and stone 30G.
  - Inn: meals.
  - Clinic: tonics.
  - Town Hall: festival news.
  - Hana's Bakery (7 AM to 3 PM): bread, cookies and strawberry cake, to eat there or take away.
  - Poppy's Flowers: bouquets (a gift almost everyone loves) and potted plants for your house.
  - Post Office: mail what you are holding to anyone you have met (30G). It counts as their gift for the day, at
    three quarters of the friendship.
  - Willow Library: books with tips and the valley's history.
  - Willowbrook School (weekdays, 8 AM to 2 PM): help with a lesson once a day for friendship with Clara, Pip and
    Daisy.
  - Chapel: sit and rest once a day (+15 energy).
  - Owen's Animal Clinic: animal treats (one a day per animal, for more love), the Miracle Potion, a brush, and a
    check-up on how your animals feel.
  - Marco's Wagon on Market Street: four pieces of furniture a day from any style (festival ones too), 20% off.
  - Seaside Shack (Grandpa Ewan, 10 AM to 4 PM): grilled fish and tomato soup.
  - Homes: knock to talk.
- **The notice board** in the plaza lists the next two weeks of events.
- **Fishing:**
  - Hold the rod facing water and wait for the "!". Then tap to hook the fish.
  - To reel it in, hold anywhere on the screen (or the action button) to lift the green bar, and keep the fish
    inside it until the meter is full.
  - Bigger fish are faster and the bar is smaller. The river has bigger fish (and the King Trout) than the farm
    pond.
- **Foraging:** herbs, berries, mushrooms and winter roots appear in the woods on the farm and in town, fresh
  every day.
- **The mine** (east of town): smash rocks with the Hammer for stone, copper, silver, gold and gems. One rock on
  each floor hides the ladder down, and deeper floors have better ore. The floors change daily. Every 5 floors
  the swings cost 1 more energy, and every 5th floor has a treasure chest (once ever). Run out of energy down
  there and you collapse, waking up at home.

### Seasons, weather and festivals

- **Seasons:** Spring, Summer, Fall and Winter, 28 days each. Crops wither when their season ends. The farm and town
  change look, with petals, leaves or snow drifting down.
- **Weather:** sunny, rain, storms (summer) or snow (winter). Rain and storms water the field. The forecast is on
  the TV, and when you go to bed.
- **Festivals** (in the plaza; the calendar in the pause menu shows them and the birthdays):

  | Festival | Date | What you do |
  | --- | --- | --- |
  | Flower Festival | Spring 14 | The Flower Dance: tap when each ring reaches the circle. A better dance means more friendship |
  | Fireworks Night | Summer 24 | Watch with someone you invite |
  | Harvest Festival | Fall 12 | Judges taste your crop, with a drumroll before the prize |
  | Cow Festival | Fall 20 | Your happiest cow competes for the blue ribbon |
  | Starry Night | Winter 24 | Spend the evening with someone |

  Talk to Mayor Hollis there to take part. Shops close on festival days.
- **Marriage:** any of the 14 candidates (see Heart events) can marry you. You need 8 hearts, the Farmhouse (house Lv 3) and a Blue Feather.
  Show them the feather, and the wedding is 3 days later. Your spouse then lives at the farmhouse and sometimes packs
  you lunch.

### Collection and records

Pause → **Collection** shows 37 things to find: crops, produce (truffles and carabao milk too), fish, forage, ore and dishes (unknown ones are
silhouettes). It also shows your records: total earned, fish caught, dishes cooked, the deepest mine floor, and
close friends.

### Balance

`npm run simulate` plays a year with the real rules: an efficient player who waters as much as energy allows,
keeps animals and mines on rainy days. It prints gold and income per week, and when the buildings and upgrades
become affordable. With the current numbers:

| When | What |
| --- | --- |
| Spring | About 21,000G earned |
| End of spring | The kitchen |
| Early fall | The Farmhouse (Lv 3), so marriage is possible in fall of year 1 |
| End of year 1 | About 200,000G earned |

A relaxed player will be well behind that.

### Sound

The music is synthesized live with WebAudio, so there are no audio files. There is a tune for each season, plus
town, house, night, mine and festival tunes, and sound effects for every action. Rain and storms have their own
ambience. Sound starts after the first touch, as browsers require, and is muted on `__gameSleep(true)`. Music and
sounds can be switched off in the pause menu.

## Host integration

| Hook | Behaviour |
| --- | --- |
| `window.gameHost.state` | Read once at boot. Accepts the saved object (or its JSON string). Invalid data starts a new game. |
| `window.gameHost.save(state)` | Called with a compact JSON-safe object (about 2 to 5 KB, always under 16 KB). Saves happen after sleeping, selling, buying, changing maps, on `__gameSleep(true)`, and every ~15 s of unsaved play. |
| `window.__gameSleep(true/false)` | `true` saves, stops the game loop (clock, input, rendering) and suspends audio. `false` resumes. |
| `window.__gameBack()` | Closes the top panel or dialog, otherwise opens the pause menu. Returns `true` when handled. |

If no `window.gameHost` exists (for example, when you open the file directly in a browser), the game creates one
that keeps the save in `localStorage`. Older saves still load. A save from before the town gets the Axe, Hammer and
Sickle (and a Milker if it has cows).

## Project layout

```
src/              game code, concatenated in filename order
  00-config.js      constants and content tables (items, crops, tools, villagers, festivals, recipes, ...)
  00-dialogue.js    what the villagers say, and the TV lines
  01-logic.js       pure rules + save format (unit tested, no Phaser)
  02-host.js        gameHost / __gameSleep / __gameBack bridge
  10-boot.js        textures (lazy for props, villagers, indoor), Tiled maps, animations, the session
  11-world.js       map loading, props, player, camera, clock, travel between maps, sleeping
  12-ui.js          HUD, weather particles, joystick, action button (charge meter), hotbar, dialogs
  00-content2.js    goals, tips, the collection list, pets, furniture, mine depth, mini-game tuning
  00-story.js       letters and heart events
  01-logic2.js      rules for goals, tips, collection, mail, heart events, pets, furniture, chests (wraps 01-logic)
  01-logic3.js      the market stall: selling now, shelves with prices and buyers, the order board
  00-home.js        the house levels, the furniture catalog (kinds and styles), Home Beauty tiers
  01-logic4.js      home rules: upgrades, buying, placing, moving, storing, wallpaper and floor, beauty, save
  00-town2.js       the bigger town: 16 more villagers (schedules, gifts, dialogue, letters, heart events), the
                    new shops and homes, new goods, books, visitors
  01-logic5.js      town rules: days of the week, rest-day schedules, treats, mailing gifts, chapel, school,
                    Marco's deals
  13-animals.js     the herd in the pen, chicks and calves, and pets (the dog, the cat)
  14-actions.js     what the action button does: tools, debris, crops, animals, fishing, forage, mine
  15-villagers.js   villagers walking their schedules (path finding), talking, gifts, heart events, proposals
  16-games.js       goal banner + guide arrow, items flying into the bag, choices, fishing and dance mini-games
  16-panels.js      morning report, pause, bag, shops, town buildings, kitchen, festivals, calendar, friends, collection
  16-stand.js       the market stall's panels: shelves, picking what to sell and for how much, orders
  17-audio.js       WebAudio music and sound effects
  19b-feel.js       game feel: tools land with dirt, chips, splashes and a bump; walking eases in and out,
                    with footstep dust and sounds
  18-polish.js      tool swings, night darkness with glowing windows, fireflies, name tags, emotes, goals
  19-extras.js      the horse (riding, saddlebag), the cat, the mailbox, mine chests, music box, aquarium
  19c-stand.js      the market stall and order board in town: villagers walk up to buy, coins and "!" markers
  19d-home.js       the house inside (furniture, wallpaper, floor), the bigger house on the farm, Decorate mode,
                    storage, Mira's catalog and house upgrades
  19e-town.js       visitors who walk in and shop, the new shops' panels, animal treats
  00-outdoor.js     outdoor decorations: the catalog (fences, paths, hedges, garden, yard, festival)
  01-logic6.js      yard rules: the farm's free land, placing, joining fences, reachability, beauty, save
  19f-yard.js       the yard on the farm, Decorate outdoors, Mira's Outdoor tab
  20-main.js        decodes images, starts Phaser
maps/             Tiled maps (JSON, embedded tilesets): farm, house_1..house_10 (one per level), town, mine
assets/*.png      sprite sheets and tilesets (256x256 tiles), plus assets/props/*.png (one image per prop)
tools/            make-art.js + art/*.js (draws all the art in headless Chromium), make-map.js (seeds the maps)
build.js          inlines everything into dist/index.html
test/             logic + rules unit tests (Node), e2e.test.js (Playwright playthrough)
```

## Commands

```
npm install
npm run build      # -> dist/index.html
npm test           # rules + save-format unit tests (117 tests)
npm run test:e2e   # builds, then plays the game headlessly on a phone-sized screen (17 tests, ~25 min)
npm run simulate   # plays a year with the real rules and prints the economy
npm run art        # redraw assets/, using any generated pictures in art-src/ (uses Playwright's Chromium)
npm run map        # seed maps/ (won't overwrite existing maps without --force)
```

## Replacing the art with generated pictures

`tools/art-manifest.js` lists every picture the game uses (221 of them), each with:
- a file name under `art-src/`
- the size to ask an image generator for
- the in-game size
- a ready-made prompt in one shared style

Save generated PNGs under those names and run `npm run art`. The importer (`tools/art/import.js`) does the
fitting:
- removes flat backgrounds
- splits grids (characters, animals, seasons, icons)
- trims and scales to the sheet's frame size, with feet on the ground line
- makes ground textures seamless
- keeps the drawn art for anything still missing

The generated pictures in `art-src/` so far cover:
- the farmer boy and girl and the villagers
- the animals, including the pig and the carabao
- the farm and town buildings
- the objects on one tile
- the seasonal trees, bushes and tall grass
- the crops and the item icons
- the other ground (tilled soil, water, dock, plaza, floors, walls, cave)

- the cottage and the cabin, and the truffle and carabao milk icons

- the seasonal ground (grass, flowers, field, path in all four seasons)
- the furniture and decorations (house, town and farm)
- the effects that fly when tools land (dirt, wood chips, leaves, water, dust), stone chips

Every other picture in the manifest comes from art-src/. The drawn art in tools/art/ is only the stand-in
for any picture that is removed. Ground textures that already repeat cleanly are kept as they are;
the rest get their edges blended. Ground pieces that sit side by side (the grass variants and flower patches,
the two floors, the two cave floors) are given the same average colour so they don't look like a checkerboard.

See `art-src/README.md`.

## Editing the maps in Tiled

Open `maps/*.json` in Tiled. Tiles are 256×256. The tilesets are embedded and point at `../assets/<name>.png`
(margin 8, spacing 16). Keep them embedded, because the build rejects external tilesets.

Each tile in the sheet has its edge pixels copied into the padding around it, so tiles don't show seams when the GPU
scales them down. The sheets are power-of-two sized so they get mipmaps. If you add art by hand, keep both of those.

- **Tilesets:**
  - `tiles`: farm and town ground, fences, trees, debris, the dock and plaza.
  - `ranch`: barn, coop, hay and trough.
  - `seasons`: the seasonal swaps.
  - `indoor`: floors, walls, cave, ladders and mine rocks.
  - `props`: an image collection of furniture, buildings and decorations, placed as tile objects.
- **Tile properties:**
  - `collides`
  - `tillable` (field soil)
  - `water` (refill and fishing spot)
  - `seasonal` (swapped for the current season)
  - `name`: `tilled`, `tilled_wet`, `debris_<kind>`, `ladder_down` or `mine_rock`, looked up at runtime
- **Layers:**
  - Soil and Debris (farm): leave these empty. The game paints them.
  - Above: drawn over the player.
  - A layer can have `requires` / `unless` = a build key.
  - The house maps are only walls, floor and the door: the furniture is the player's and is placed by the game.
- **Props** have `foot` (solid rows at the bottom) and `flat` (lies on the floor). On the map, a prop object can
  have `requires`, `unless`, or `festival` (a list of festival keys it shows on).
- **Objects** use `type`:
  - Points: `spawn` and `place` (villager destinations; `fest_0..6` are festival spots).
  - `warp`, with `to`, `spawn`, and `walk` (walk through it) or `label` (use it).
  - `door`, with `building`.
  - `sleep`, `tv`, `kitchen`, `stand` (the market stall), `orders` (the order board), `shop`, `incubator` and `sign`
    (with `text`).
  - Areas: `pen`, `dogarea`, `forage` and `minefloor`.

Run `npm run build` after editing.

## Next up

Wrap it as an Android/iOS app with Capacitor; play-test on real phones. The save format has a version field (`v`)
and a migration level (`mg`).
