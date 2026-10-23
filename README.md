# Sunny Acres

A Harvest Moon style farming game: portrait (9:16), touch-first, built with Phaser 3 in plain JavaScript.
It ships as **one offline HTML file** (`dist/index.html`) with Phaser, the code, the Tiled map and all
pixel art inlined as data URLs. It makes no network requests and uses no CDNs.

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
  20-main.js      decodes images, starts Phaser
maps/farm.json  Tiled map (JSON, embedded tileset). Layers: Ground, Soil, Walls, Above, Objects
assets/*.png    sprite sheets: tiles, player (16x24), crops, items (16x16)
tools/          make-art.js (generates the pixel art), make-map.js (seeded the map)
build.js        inlines everything into dist/index.html
test/           logic.test.js (Node) and e2e.test.js (Playwright playthrough)
```

## Commands

```
npm install
npm run build      # -> dist/index.html
npm test           # rules + save-format unit tests
npm run test:e2e   # builds, then plays the game headlessly on a phone-sized screen
npm run art        # regenerate assets/*.png
```

## Editing the map in Tiled

Open `maps/farm.json` in Tiled. The tileset is embedded and points at `../assets/tiles.png`.
Keep it embedded, because the build rejects external tilesets.

- Tile properties drive gameplay: `collides`, `tillable` (field soil), `water` (refill spot), and
  `name` = `tilled` / `tilled_wet` (used by the Soil layer at runtime).
- Leave the **Soil** layer empty. The game paints tilled soil into it.
- **Above** draws over the player (tree tops).
- Objects use `type`: `spawn` (point), `sleep`, `ship`, `shop`, and `sign` (with a string property `text`).

Run `npm run build` after editing. `tools/make-map.js` was only used to seed the map, and it won't overwrite it
unless you pass `--force`.

## Next up

Towns and villagers, seasons (crop seasons, weather), and more shops.
The save format has a version field (`v`) for migrations.
