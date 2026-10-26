# Handoff: Sunny Acres (for the next Claude)

You are picking up **Sunny Acres**, a Harvest Moon style farming game. It runs as a mini game inside the
**Selebox** app (React Native). This file is the state of things at the handoff (26 Oct 2026). The README has
the full game description and file layout. Read both before changing anything.

Repo: `selevia-mod/harvestville-sunny-acres`, branch `main`. Commit and push to `main` when the owner asks to
save; they often do ("save it to GitHub"). End commit messages with the attribution lines your harness gives.

## The owner

- Not a programmer. Write to them in plain language: short sentences, no jargon, say what changed and what
  they need to do. They send screenshots of bugs and batches of generated art (zip files).
- They want to approve anything that touches the live database. **Ask before** applying SQL or changing the
  Supabase project.

## The product rules (from the owner's original spec, still binding)

- Phaser 3, plain JavaScript, portrait 360x640 layout, touch-first (joystick + action button).
- Tiled JSON maps, sprite sheets.
- **One offline HTML page** (`dist/index.html`): everything inlined, images as data URLs, **no network calls,
  no CDNs**. Online play goes through the app (see below), never from the page itself.
- Save through `window.gameHost.save(state)`, load from `window.gameHost.state`, save JSON under 16 KB.
- `window.__gameSleep(true/false)` pauses; `window.__gameBack()` handles Back.

## Where things stand

Everything below is built, tested and pushed:

- Phase 1 (core farming), town, people, seasons, festivals, marriage, mine, animals, pets, horse.
- Home (house levels 1-10, furniture, Decorate mode), Town 2.0 (16 more villagers, new shops, visitors).
- Phase 2: outdoor decorations (yard on a 38x38 farm), Home Beauty.
- Phase 3: daily/weekly/monthly quests, login gift, badges, requests and streak, Saffron the trader, Power-Up,
  Pet Meal.
- Phase 4 game side: online play (visiting farms look-only, the owner plus up to 8 visitors see each other live,
  likes, gifts, friends, chat, weekly ranks). Players are online with their **Selebox account**: no sign-in in
  the game, no guests.
- Art: the owner's generated pictures, batches 01-07 (77 pictures) imported.

Published preview (offline, no Online button there): https://claude.ai/artifact/4Nz2b6Q7q1tuA2AW2L9CnP
(version 31). The artifact limit is 16 MB per page; the game is about 12.9 MB.

## What is left (in order)

1. **Database:** `supabase/farm_online.sql` is written and was tested on a local Postgres, but is **not applied**.
   Apply it only when the owner says yes. Target: the existing Selebox Supabase project (`zplisqwoejxrdrpbfass`).
   It is additive only: a `farm` schema with no direct grants, `public.farm_*_v1` SECURITY DEFINER functions,
   and two `realtime.messages` policies for topics `farm:%`. An undo script is at the bottom of the file.
   **Never alter existing Selebox tables.** It reads `public.profiles` (display name, bans) only.
2. **App side:** the Selebox React Native developer adds `bridge/sunnyAcresBridge.js` (guide: `bridge/README.md`).
   The game talks only to `window.gameHost.net`; the bridge answers with the app's signed-in supabase-js client,
   and allows only `farm_*_v1` functions and `farm:<uuid>` channels.
3. **Device test** with 2-3 real Selebox accounts once 1 and 2 are done.
4. **Art:** 6 pictures still on drawn placeholders. Prompts: `art-src/REMAINING-6-PROMPTS.md` (trader,
   trader tent, quest icons, outdoor fences/paths/garden).
5. Not ours but noted to the owner: in the Selebox project, tables `books_v2_category_terms` and
   `notification_push_policy` have row-level security off. The owner decides.

## How to work on it

```
npm install
npx playwright install chromium   # locally (the cloud had it preinstalled)
npm run build                     # -> dist/index.html
npm test                          # 142 rule/save/bridge unit tests, seconds
node --test test/e2e.test.js      # 18 browser playthroughs, ~30 min: run it ALONE, nothing else heavy
node --test test/e2e-online.test.js   # 3 phones online through the real bridge, ~2 min (build first)
npm run art                       # regenerate assets/ from tools/art + art-src/ pictures (~5 min)
```

- Run the e2e suites one at a time. Under load, tests time out (page load > 90 s) and look like failures;
  rerun the failed ones alone before believing them.
- `SHOTS=/some/dir` on either e2e saves screenshots. Look at them after any visual change.
- Tests use `window.gameHost.quiet = true` to keep the daily-gift popup and quest toasts out of the way.

## Code map and conventions

- `src/*.js` are concatenated in filename order by `build.js`. Content in `00-*`, rules in `01-logic*.js` (pure,
  no Phaser, unit tested), host bridge `02-host.js`, network `02-net.js`, then the scenes and mixins `10-*` to
  `20-main.js`.
- Mixins wrap prototypes: `var x = P.x; P.x = function () { ...; return x.call(this, ...); };`. Later files wrap
  earlier ones (e.g. `19h-online.js` wraps WorldScene create/update/save/travel/resolve/tickClock).
- Logic layers wrap `L.newState`, `L.endDay`, `L.serialize`, `L.deserialize` in turn (logic -> logic2 -> ... ->
  logic8). Each layer saves its own short key (`o.yd`, `o.p3`, `o.nt`, ...). Keep saves small; old saves must
  still load (tests cover migrations).
- Unit tests load the source in a `vm` context; compare objects from it with `plain()` (a JSON copy), because
  `deepStrictEqual` fails across realms.
- Match the surrounding style: ES5 in `src/` (no arrow functions there), short comments only where they help.
- Tile = 256 world units; the camera shows a tile at 32 layout px (at most 96 screen px on 3x phones).
- Art pipeline: `tools/make-art.js` draws everything in headless Chromium (`tools/art/*.js`) and replaces
  drawings with the owner's pictures from `art-src/` (`tools/art/import.js`). Sheets are written as PNG
  (for Tiled) and WebP (inlined). World sheets are stored at half size (furniture at 3/4) and scaled back up
  on load (`assets/sizes.json`, `src/20-main.js`); icons, villagers (`people`) and the farmer stay full size.
- Maps: `maps/*.json` (Tiled, embedded tilesets). `npm run map -- --force=<map>` reseeds one from
  `tools/make-map.js` (this overwrites hand edits).
- Importing a new art batch: unzip each zip into its own new empty folder outside the repo, check the files are
  real PNGs at the sizes in the prompts, copy them into `art-src/<folder>/`, `npm run art`, `npm run build`,
  check the size (must stay under 16 MB to publish), screenshot, run the tests, commit.

## Online play, in short

- `src/00-online.js` settings (8 visitors max, publish every 60 s, moves every 250 ms, gold gift = 100G).
- `src/01-logic8.js` rules: the farm snapshot others see (house, furniture, yard, crops, debris, animals, pets;
  never bag or gold), rebuilding a visited farm from untrusted data (`L.visitState`, every value checked),
  `L.visitorFits` (first 8 to arrive stay), weekly scores, the `nt` save (`off` = the player left online play).
- `src/19h-online.js` runtime: auto-join at start, the Online panel (Visit, Friends + chat, Ranks, Me), visit
  mode (a sandbox state swapped in for WorldScene.create; tools off, clock stopped, saves go to your own
  game), live presence and remote farmers with name tags, the text box (`askText`, a DOM input).
- `test/net-mock.js` is an in-memory stand-in for the database functions and supabase-js realtime, used by
  `test/bridge.test.js` and `test/e2e-online.test.js`.
