# Handoff: Sunny Acres (for the next Claude)

You are picking up **Sunny Acres**, a Harvest Moon style farming game. It runs as a mini game inside the
**Selebox** app (React Native). This file is the state of things at the handoff (26 Oct 2026, written for a local
Claude Code taking over from the cloud session; last commit before this file: `46da024`). The README has the full game description and file layout. Read both before changing
anything.

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
- Art: all of the owner's generated pictures imported: batches 01-07, the last 6, and the 39 new-crop
  pictures (New-Crops-Batch-01..04). Every job in `tools/art-manifest.js` has its picture; nothing is
  waiting on art.
- **Real time, FarmVille style** (the owner's latest request, rules and game side done, see below).

Published preview (offline, no Online button there): https://claude.ai/artifact/4Nz2b6Q7q1tuA2AW2L9CnP
(version 33: real time, 40 crops with their real pictures, shops 6 AM-11 PM). The artifact limit is 16 MB per
page; the game is about 13.9 MB. All tests pass: 146 unit, 18 browser playthroughs, the 3-phone online test.

## The real-time redesign (what the owner asked for, and what was decided)

The owner: "use the real time and date of the user's phone; crops grow by time, like FarmVille; users cannot just
sleep to gain energy; birthdays and events are shared by all users (Lily's birthday on Oct 27 for everyone)";
"Season by real month"; "10 plants for every season". Decided with them (or by me, told to them, not objected to):

- **Clock:** game time = the phone's time (`L.clock()`; the app may give `window.gameHost.now()`, e.g. server
  time; the tests use it to control time). `s.day` is the real local date as a day number since 1970
  (`L.dayOf`), `s.start` the farm's first day, `s.time` minutes after midnight. No passing out, no sleeping.
- **New day at midnight:** `L.catchUp(s, now, info)` (src/01-logic9.js) runs `L.endDay` once per day that went
  by (max 30) and merges the reports; it runs on load (10-boot.js) and once a second in the world
  (`tickClock` in 11-world.js), which shows the "A NEW DAY" / "WELCOME BACK" report where the player stands.
  A clock set back never undoes days.
- **Seasons by month:** Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov, Winter Dec-Feb (`C.SEASON_OF_MONTH`).
- **Birthdays and festivals on fixed real dates**, the same for everyone: `birthday: [month, day]`,
  `FESTIVALS[].date`. Lily is Oct 27. Festivals: Flower Apr 14, Fireworks Jul 24, Harvest Oct 12, Cow Nov 20,
  Starry Dec 24 (day festivals 8 AM-9 PM, night ones 5 PM-midnight). Weather is the same for every player.
- **Crops (FarmVille):** 40 crops, 10 per season, 15 minutes to 2 days (`C.CROPS[k].mins`), plus grass for
  fodder. Soil tile = `{ w, c, p, r }`: p = planted minute, w = watered (25% faster, rain waters too), r =
  grass regrowing. No watering needed. A ripe crop withers after as long again as it grew (min 4 h): stage 4,
  cleared with the Hoe. Seeds sold in season; a planted crop grows on into the next season. Prices come from the
  growing time (profit per tile = `1.5 + 2.5 * sqrt(hours)`, see the comment in `src/00-config.js`). Saves store soil in groups (`soilGroups`).
- **Energy:** comes back by itself, 1 point every 3 minutes (`C.ENERGY_EVERY`, `L.regen`), also while the
  game is closed. The bed only explains this. Fainting in the mine sends you home.
- **Shops and the market stall:** open 6 AM-11 PM real time (school 8-3 on weekdays). At night "Zzz CLOSED"
  signs show (19e-town.js) and shops say "<owner> is sleeping. Come back at 6:00 AM." (`closedText`,
  16-panels.js; `L.sleepTime`).
- **Old saves** (no `rt` key) carry on from today (`L.deserialize` shifts building/wedding days, converts crops).
- **Art:** all 41 crops, the withered plant and the crop/seed icons are real pictures in `art-src/` (the 39
  from `art-src/NEW-CROPS-PROMPTS.md` were imported). The crops sheet is 7 frames wide (2048x4096) with a
  withered frame (`C.CROP_WITHERED`). The drawn stand-ins in `tools/art/crops2.js` are only used if a
  picture is removed. Every job in `tools/art-manifest.js` now has its picture.

## Real-time status

Done and tested: rules (146 unit tests), game side, all crop art, browser tests rewritten for the real clock
(`test/e2e.test.js`: `open(save, when)`, `makeSave(edit, when)` with a date `[y, m, d, h, min]`, default
`START` = Wed 1 Apr 2026 10 AM; helpers `setClock`, `advance(minutes)`, `nextMorning()`), README, and a
real-time economy simulator (`npm run simulate`: 4 visits a day). Crop prices were rescaled for harvests
several times a day: profit per tile = 1.5 + 2.5 x sqrt(hours).

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
4. Not ours but noted to the owner: in the Selebox project, tables `books_v2_category_terms` and
   `notification_push_policy` have row-level security off. The owner decides.

## Last session (26 Oct 2026), in short

1. Shops, Lily's stand and the town market stall open 6 AM-11 PM real time; at night they say
   "<owner> is sleeping. Come back at 6:00 AM." and show "Zzz CLOSED" signs (commit `985b5ac`).
2. The 39 new-crop pictures imported and checked in the field (growing, ripe, withered) and in the shop
   (commit `46da024`). Published as artifact version 33.
3. Lesson: the world (and so `updateExtras`, which puts up the night signs every 2 s) does not update while a
   dialog is open. Browser tests that look for something the world draws must close the dialog first.

Nothing is half-done. The next work is the "What is left" list above, which waits on the owner and their app
developer, or whatever new request the owner brings.

## Moving from the cloud to a local machine

- Clone: `git clone https://github.com/selevia-mod/harvestville-sunny-acres.git` (branch `main`), then
  `npm install` and `npx playwright install chromium`. Node 18+ (the cloud used Node 22).
- `dist/index.html` is committed, so the built game is already in the repo. Rebuild after any change to
  `src/`, `assets/` or `maps/`.
- Python 3 with Pillow is handy for checking art (sizes, transparent corners), not required to build.
- The published preview was made from the cloud's scratch folder. To update the same link from a new
  conversation, publish `dist/index.html` with the artifact URL above (read the artifact first, as the tool
  asks). If your setup has no artifact tool, open `dist/index.html` in a phone-sized browser window instead,
  and tell the owner the online link was not updated.
- `shot.png` in the repo root is an old screenshot; harmless.

## How to work on it

```
npm install
npx playwright install chromium   # locally (the cloud had it preinstalled)
npm run build                     # -> dist/index.html
npm test                          # 146 rule/save/bridge unit tests, seconds (they control time with test/clock.js)
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
  logic9; logic9 is the real-time catch-up, which must call the fully wrapped `L.endDay`). Each layer saves its own short key (`o.yd`, `o.p3`, `o.nt`, ...). Keep saves small; old saves must
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
  mode (a sandbox state swapped in for WorldScene.create; tools off, only your clock and energy tick, saves
  go to your own game; snapshots send each crop's stage), live presence and remote farmers with name tags, the text box (`askText`, a DOM input).
- `test/net-mock.js` is an in-memory stand-in for the database functions and supabase-js realtime, used by
  `test/bridge.test.js` and `test/e2e-online.test.js`.
