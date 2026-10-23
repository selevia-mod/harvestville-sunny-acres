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
| Farm | 7.8 / 10.9 ms |
| Town plaza | 7.2 / 10.7 ms |
| Town in a storm | 8.2 / 12.2 ms |
| House, mine | 5.6 ms avg |

- **Frame budget:** 60 fps needs under 16.7 ms, so every place fits.
- **Startup:** cold start is about 7.7 s at 6x slowdown (about 2 s at full speed). A "Loading your farm…" message
  shows meanwhile.
- **GPU memory:** only the farm sheets are uploaded at boot. Indoor tiles, villagers and props are added the first
  time a map needs them.
- **UI drawing:** UI panels are drawn once into textures (`bake()` in `src/12-ui.js`). Live Phaser Graphics
  re-tessellate every frame, so avoid them in the UI.
- **FPS meter:** pause menu → **Show FPS**.

## How to play

Drag anywhere to walk. The big action button acts on the highlighted tile and shows what it will do.
Desktop keys for testing: WASD/arrows move, Space/Enter act (hold to charge), 1 to 6 hotbar, E bag, Esc back.

### The farm

- **Clearing:** a new farm is overgrown. Use the **Sickle** on weeds, the **Axe** on branches and stumps (lumber),
  and the **Hammer** on stones and boulders (stone). Stumps and boulders take several swings, and boulders need a
  Copper Hammer. A few weeds sprout at each new season.
- **Crops:** hoe the soil, then plant. A **seed bag** sows the 3×3 tilled patch around the tile. Water every day;
  rain does it for you. The Hammer flattens empty tilled soil.
- **Crops by season:**

  | Season | Crops |
  | --- | --- |
  | Spring | Turnip 3 days/60G, Potato 5/110G, Strawberry 7/170G (regrows every 3) |
  | Summer | Tomato 6/130G (regrows), Corn 9/220G (regrows) |
  | Fall | Carrot 4/90G, Pumpkin 10/360G |
  | All but winter | Grass: cut it with the Sickle for Fodder, and it regrows |

- **Selling:** put crops, produce, fish, ore and forage in the **shipping box** by the house. It pays out overnight.
- **Lily's Seed Stand** (south of the field, 9 AM to 5 PM) has Seeds, Animals and Supplies (Brush, Milker,
  Fishing Rod, Miracle Potion, Blue Feather).
- **Days:** the clock runs from 6 AM. At 2 AM you pass out (half energy next day). Sleep in the bed in your
  farmhouse. The **TV** has tomorrow's weather.

### Tools and energy

- **Tool upgrades:** Bram at the forge upgrades each tool: Copper (600G + 5 Copper Ore), Silver (1500G + 5 Silver
  Ore), Gold (3000G + 5 Gold Ore). Upgrades are instant.
- **Charging:** upgraded tools use less energy and **charge**. Hold the action button and release: 3 tiles, then
  3×3, then 3×5.
- **Watering can:** it holds 20 waters, up to 60 at Gold.
- **Food:** eat food to restore energy (tap Eat with it in hand, or from the bag). With a **kitchen** you cook 9
  recipes from your crops, eggs, milk, fish and mushrooms. Rosa's inn and Ivy's clinic sell meals and tonics.

### Animals

- **Care:** chickens live in the coop and cows in the barn. Feed, pet and **brush** them daily.
- **Produce:** a fed animal has an egg or milk ready the next morning. Cows need a **Milker**. At 3+ hearts they give
  Large Eggs and Large Milk.
- **Chicks and calves:** hold an egg at the coop to put it in the incubator, and a chick hatches in 3 days.
  A Miracle Potion given to a cow with 2+ hearts brings a calf in 7 days. Chicks and calves grow up in a few days.
- **Bigger buildings:** Mira builds a Bigger Coop and a Bigger Barn (8 each).
- **Biscuit the dog** lives by the house. Pet him every day.

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
- **Buildings:** doors open shop menus during opening hours. Every panel has a Talk button for the person who runs
  it.
  - Forge: tool upgrades.
  - Woodshop: Kitchen, House Extension, Bigger Coop and Bigger Barn, built overnight with gold, lumber and stone.
    It also sells lumber and stone.
  - Inn: meals.
  - Clinic: tonics.
  - Town Hall: festival news.
  - Homes: knock to talk.
- **The notice board** in the plaza lists the next two weeks of events.
- **Fishing:** hold the rod facing water, wait for the "!", then tap. The river has bigger fish (and the King
  Trout) than the farm pond.
- **Foraging:** herbs, berries, mushrooms and winter roots appear in the woods on the farm and in town, fresh
  every day.
- **The mine** (east of town): smash rocks with the Hammer for stone, copper, silver, gold and gems. One rock on
  each floor hides the ladder down, and deeper floors have better ore. The floors change daily.

### Seasons, weather and festivals

- **Seasons:** Spring, Summer, Fall and Winter, 28 days each. Crops wither when their season ends. The farm and town
  change look, with petals, leaves or snow drifting down.
- **Weather:** sunny, rain, storms (summer) or snow (winter). Rain and storms water the field. The forecast is on
  the TV, and when you go to bed.
- **Festivals** (in the plaza; the calendar in the pause menu shows them and the birthdays):

  | Festival | Date | What you do |
  | --- | --- | --- |
  | Flower Festival | Spring 14 | Dance |
  | Fireworks Night | Summer 24 | Watch with someone |
  | Harvest Festival | Fall 12 | Crop judged for prizes |
  | Cow Festival | Fall 20 | Your happiest cow competes |
  | Starry Night | Winter 24 | Spend the evening with someone |

  Talk to Mayor Hollis there to take part. Shops close on festival days.
- **Marriage:** Lily, Mira, Leo and Ivy can marry you. You need 8 hearts, the House Extension and a Blue Feather.
  Show them the feather, and the wedding is 3 days later. Your spouse then lives at the farmhouse and sometimes packs
  you lunch.

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
  13-animals.js     the herd in the pen, chicks and calves, and the dog
  14-actions.js     what the action button does: tools, debris, crops, animals, fishing, forage, mine
  15-villagers.js   villagers walking their schedules (path finding), talking, gifts, proposals
  16-panels.js      morning report, pause, bag, shops, town buildings, kitchen, festivals, calendar, friends
  17-audio.js       WebAudio music and sound effects
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
npm test           # rules + save-format unit tests (61 tests)
npm run test:e2e   # builds, then plays the game headlessly on a phone-sized screen (10 tests, ~10 min)
npm run art        # redraw assets/ (uses Playwright's Chromium)
npm run map        # seed maps/ (won't overwrite existing maps without --force)
```

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

A horse, more festivals' mini-games, rival romances, and more mine floors with dangers. The save format has a
version field (`v`) and a migration level (`mg`).
