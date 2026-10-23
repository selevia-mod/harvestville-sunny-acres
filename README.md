# Sunny Acres

A Harvest Moon style farming game: portrait (9:16), touch-first, built with Phaser 3 in plain JavaScript.
It ships as **one offline HTML file** (`dist/index.html`, about 7 MB) with Phaser, the code, the Tiled map and all
art inlined as data URLs. It makes no network requests and uses no CDNs.

The art is drawn at **256×256 per tile** in a smooth cartoon style and scaled down on screen. A tile is shown at
32 layout pixels, and the game renders at the screen's pixel density (up to 3×) so the detail stays sharp.

## Performance on low-end phones

Tested with the CPU slowed 6x (about OPPO A5 class):

- **Per frame:** about 10 ms (60 fps needs under 16.7 ms).
- **Art cost:** the 256 px art is cheap for the GPU. The world costs under 1 ms per frame at normal CPU speed.
- **UI drawing:** UI panels, slots and buttons are drawn once into textures (`bake()` in `src/12-ui.js`). Live Phaser
  Graphics re-tessellate every frame, and that used to cost most of the frame time, so avoid them in the UI.
- **Startup:** cold start is about 6 s at 6x slowdown. A "Loading your farm…" message shows meanwhile.
- **FPS meter:** pause menu → **Show FPS** puts a frame-rate meter in the corner. The `x2`/`x3` next to it is the
  render scale.

## Play loop (v0.1)

- Walk with the on-screen joystick (drag anywhere on the left/middle of the screen).
- The big action button works on the highlighted tile in front of you and shows what it will do
  (Till / Plant / Water / Refill / Harvest / Ship / Sleep / Shop / Read).
- **Hoe** tills the field (2 energy). **Seeds** plant on tilled soil. The **watering can** (1 energy)
  holds 20 waters. Refill it at the pond.
- Crops grow one stage per *watered* night: Turnip 3 days, Potato 5, Strawberry 7.
- Put crops in the **shipping box** by the house. It pays out overnight.
- **Lily's Seed Shop** (south of the field) is open 9 AM to 5 PM.
- The clock runs from 6 AM. Evening darkens the screen, and at 2 AM you pass out (half energy next day).
  Go to bed at the house door to end the day.
- The bag button shows all 18 slots. The first 6 are the hotbar.

### Animals

- The pen south-west of the field has a **coop** (up to 4 chickens) and a **barn** (up to 4 cows).
  A new game starts with one chicken, Clucky, and 5 Chicken Feed.
- Face an animal and tap the action button:
  - **Collect** an egg or milk when its bubble shows.
  - **Feed** it while holding the right feed: Chicken Feed for chickens, Fodder for cows.
  - **Pet** it once a day.
  - Tap again to see its hearts and today's care.
- A fed animal has produce ready the next morning: Egg 50G, Milk 120G. Ship it like crops.
- Love (0 to 100, shown as 5 hearts) goes up with feeding (+2) and petting (+4). It drops when an animal goes
  hungry (-6) or isn't petted (-3).
- Lily's shop has an **Animals** tab: Chicken 250G, Cow 1000G, Chicken Feed 10G, Fodder 20G.
- Animals wander inside the map's `pen` object, rest and graze, and sleep from 8 PM. Saves from before animals
  existed load with no animals.

Desktop keys for testing: WASD/arrows move, Space/Enter act, 1 to 6 hotbar, E bag, Esc back.

## Host integration

| Hook | Behaviour |
| --- | --- |
| `window.gameHost.state` | Read once at boot. Accepts the saved object (or its JSON string). Invalid data starts a new game. |
| `window.gameHost.save(state)` | Called with a compact JSON-safe object (well under 16 KB) after sleeping, shipping, buying, on `__gameSleep(true)`, and every ~15 s of unsaved play. |
| `window.__gameSleep(true/false)` | `true` saves and stops the game loop (clock, input, rendering). `false` resumes. |
| `window.__gameBack()` | Closes the top panel or dialog, otherwise opens the pause menu. Returns `true` when handled. |

If no `window.gameHost` exists (for example, when you open the file directly in a browser), the game creates one
that keeps the save in `localStorage`.

## Project layout

```
src/            game code, concatenated in filename order
  00-config.js    constants and content tables (items, crops, prices, times)
  01-logic.js     pure rules + save format (unit tested, no Phaser)
  02-host.js      gameHost / __gameSleep / __gameBack bridge
  10-boot.js      registers inlined textures + Tiled maps, animations
  11-world.js     map, player, clock, action-button behaviour
  12-ui.js        HUD, joystick, hotbar, bag / shop / dialog / pause panels
  13-animals.js   the herd in the pen: wandering, poses, produce bubbles, hearts
  20-main.js      decodes images, starts Phaser
maps/farm.json  Tiled map (JSON, embedded tileset). Layers: Ground, Soil, Walls, Above, Objects
assets/*.png    sprite sheets: tiles + ranch (256x256 tiles), player (256x384), crops (256x256),
                animals (384x320), item icons (128x128)
tools/          make-art.js + art/draw.js (draws the art in headless Chromium), make-map.js (seeded the map)
build.js        inlines everything into dist/index.html
test/           logic.test.js (Node) and e2e.test.js (Playwright playthrough)
```

## Commands

```
npm install
npm run build      # -> dist/index.html
npm test           # rules + save-format unit tests
npm run test:e2e   # builds, then plays the game headlessly on a phone-sized screen
npm run art        # redraw assets/*.png (uses Playwright's Chromium)
```

## Editing the map in Tiled

Open `maps/farm.json` in Tiled. Tiles are 256×256. The tileset is embedded and points at `../assets/tiles.png`
(margin 8, spacing 16). Keep it embedded, because the build rejects external tilesets.

Each tile in the sheet has its edge pixels copied into the padding around it, so tiles don't show seams when the GPU
scales them down. The sheets are power-of-two sized so they get mipmaps. If you add art by hand, keep both of those.

- Tile properties drive gameplay: `collides`, `tillable` (field soil), `water` (refill spot), and
  `name` = `tilled` / `tilled_wet` (used by the Soil layer at runtime).
- Leave the **Soil** layer empty. The game paints tilled soil into it.
- **Above** draws over the player (tree tops).
- There are two tilesets: `tiles` and `ranch` (barn, coop, hay, trough).
- Objects use `type`: `spawn` (point), `sleep`, `ship`, `shop`, `pen` (the area animals wander in), and `sign`
  (with a string property `text`).

Run `npm run build` after editing. `tools/make-map.js` was only used to seed the map, and it won't overwrite it
unless you pass `--force`.

## Next up

Towns and villagers, seasons (crop seasons, weather), and more shops.
The save format has a version field (`v`) for migrations.
