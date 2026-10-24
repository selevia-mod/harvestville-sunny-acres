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
| Farm | 8.6 / 12.6 ms |
| Farm at night (glows, fireflies) | 8.7 / 13.3 ms |
| Town plaza | 8.6 to 10.3 / 16.3 ms |
| Town in a storm | 11.4 ms avg |
| House, mine | 4.4 to 5.4 ms avg |

- **Frame budget:** 60 fps needs under 16.7 ms, so every place fits.
- **Startup:** cold start is about 8 s at 6x slowdown (about 2 s at full speed). A "Loading your farm…" message
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

- **Goals:** a new farm shows one goal at a time under the top bar: clear debris, till, plant, water, feed
  Clucky, sleep, collect an egg, ship, visit town, meet villagers, harvest. Each one pays a small reward. A
  yellow arrow points the way, even across maps. Tap the goal bar for details.
- **Tips:** the first time you hold each kind of item (a tool, seeds, feed, food...), a tip explains it.
- **Mail:** the mailbox by the house gets letters: a welcome lunch, festival invitations, birthday reminders,
  thank-you gifts from villagers at 3 hearts, and rewards for shipping milestones and deep mine floors.

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

- **Selling:** put crops, produce, fish, ore and forage in the **shipping box** by the house. It pays out overnight.
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

- **Care:** chickens live in the coop and cows in the barn. Feed, pet and **brush** them daily.
- **Produce:** a fed animal has an egg or milk ready the next morning. Cows need a **Milker**. At 3+ hearts they give
  Large Eggs and Large Milk.
- **Chicks and calves:** hold an egg at the coop to put it in the incubator, and a chick hatches in 3 days.
  A Miracle Potion given to a cow with 2+ hearts brings a calf in 7 days. Chicks and calves grow up in a few days.
- **Prices:** Chicken 500G, Cow 2000G. Egg 40G (large 70G), milk 100G (large 150G).
- **Bigger buildings:** Mira builds a Bigger Coop and a Bigger Barn (8 each).
- **Pets:**
  - **Biscuit the dog** lives by the house. Pet him every day.
  - **The horse:** Mira's Stable brings Chestnut the horse. Walk up to him to ride: he's 1.7× faster, he can
    go to town, and his saddlebag ships what you hold from anywhere. He waits outside when you go indoors or
    down the mine.
  - **Mochi the cat** comes with the Cat Basket from Mira's furniture tab and lives in the farmhouse.

### Willowbrook (the town)

- **Getting there:** walk down the road south of the farm.
- **The people:** seven villagers walk their daily schedules between their homes, shops, the plaza, the dock and
  the forest:

  | Who | Role |
  | --- | --- |
  | Lily | Seed stand |
  | Mayor Hollis | Mayor |
  | Bram | Blacksmith |
  | Mira | Carpenter |
  | Rosa | Innkeeper |
  | Leo | Fisherman |
  | Ivy | Herbalist |

- **Friendship:** talk to each villager once a day, and give one gift a day. They love, like, don't mind, or dislike
  each item, and birthday gifts count double. Friendship shows as 10 hearts (pause → Friends).
- **Heart events:** at friendship milestones (2, 4 and 6 hearts for Lily, Mira, Leo and Ivy; 3 for the others),
  talking to them starts a little story scene that ends with a choice.
- **In town:** villagers are solid, show their name when you are near, and hum or react with speech bubbles.
- **Buildings:** doors open shop menus during opening hours. Every panel has a Talk button for the person who runs
  it.
  - Forge: tool upgrades.
  - Woodshop:
    - Built overnight with gold, lumber and stone: Kitchen (2500G + 40 lumber), House Extension (8000G + 100 lumber
      + 30 stone), Bigger Coop (3000G + 40 lumber), Bigger Barn (6000G + 80 lumber + 20 stone), Stable (4000G + 60
      lumber).
    - Furniture: Big Plant, Music Box (a tune and +5 energy once a day), Aquarium (shows the fish you have caught)
      and the Cat Basket.
    - Lumber 50G and stone 30G.
  - Inn: meals.
  - Clinic: tonics.
  - Town Hall: festival news.
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
- **Marriage:** Lily, Mira, Leo and Ivy can marry you. You need 8 hearts, the House Extension and a Blue Feather.
  Show them the feather, and the wedding is 3 days later. Your spouse then lives at the farmhouse and sometimes packs
  you lunch.

### Collection and records

Pause → **Collection** shows 35 things to find: crops, produce, fish, forage, ore and dishes (unknown ones are
silhouettes). It also shows your records: total shipped, fish caught, dishes cooked, the deepest mine floor, and
close friends.

### Balance

`npm run simulate` plays a year with the real rules: an efficient player who waters as much as energy allows,
keeps animals and mines on rainy days. It prints gold and income per week, and when the buildings and upgrades
become affordable. With the current numbers:

| When | What |
| --- | --- |
| Spring | About 21,000G shipped |
| End of spring | The kitchen |
| Early fall | The house extension, so marriage is possible in fall of year 1 |
| End of year 1 | About 200,000G shipped |

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
| `window.gameHost.save(state)` | Called with a compact JSON-safe object (about 2 to 5 KB, always under 16 KB). Saves happen after sleeping, shipping, buying, changing maps, on `__gameSleep(true)`, and every ~15 s of unsaved play. |
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
  13-animals.js     the herd in the pen, chicks and calves, and pets (the dog, the cat)
  14-actions.js     what the action button does: tools, debris, crops, animals, fishing, forage, mine
  15-villagers.js   villagers walking their schedules (path finding), talking, gifts, heart events, proposals
  16-games.js       goal banner + guide arrow, items flying into the bag, choices, fishing and dance mini-games
  16-panels.js      morning report, pause, bag, shops, town buildings, kitchen, festivals, calendar, friends, collection
  17-audio.js       WebAudio music and sound effects
  18-polish.js      tool swings, night darkness with glowing windows, fireflies, name tags, emotes, goals
  19-extras.js      the horse (riding, saddlebag), the cat, the mailbox, mine chests, music box, aquarium
  20-main.js        decodes images, starts Phaser
maps/             Tiled maps (JSON, embedded tilesets): farm, house, town, mine
assets/*.png      sprite sheets and tilesets (256x256 tiles), plus assets/props/*.png (one image per prop)
tools/            make-art.js + art/*.js (draws all the art in headless Chromium), make-map.js (seeds the maps)
build.js          inlines everything into dist/index.html
test/             logic + rules unit tests (Node), e2e.test.js (Playwright playthrough)
```

## Commands

```
npm install
npm run build      # -> dist/index.html
npm test           # rules + save-format unit tests (77 tests)
npm run test:e2e   # builds, then plays the game headlessly on a phone-sized screen (11 tests, ~13 min)
npm run simulate   # plays a year with the real rules and prints the economy
npm run art        # redraw assets/, using any generated pictures in art-src/ (uses Playwright's Chromium)
npm run map        # seed maps/ (won't overwrite existing maps without --force)
```

## Replacing the art with generated pictures

`tools/art-manifest.js` lists every picture the game uses (131 of them), each with:
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
  - A layer can have `requires` / `unless` = a build key (the house's closed-off wing uses `unless: bighouse`).
- **Props** have `foot` (solid rows at the bottom) and `flat` (lies on the floor). On the map, a prop object can
  have `requires`, `unless`, or `festival` (a list of festival keys it shows on).
- **Objects** use `type`:
  - Points: `spawn` and `place` (villager destinations; `fest_0..6` are festival spots).
  - `warp`, with `to`, `spawn`, and `walk` (walk through it) or `label` (use it).
  - `door`, with `building`.
  - `sleep`, `tv`, `kitchen`, `ship`, `shop`, `incubator` and `sign` (with `text`).
  - Areas: `pen`, `dogarea`, `forage` and `minefloor`.

Run `npm run build` after editing.

## Next up

Wrap it as an Android/iOS app with Capacitor; play-test on real phones. The save format has a version field (`v`)
and a migration level (`mg`).
