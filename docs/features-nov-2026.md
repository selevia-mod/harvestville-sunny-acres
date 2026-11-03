# Seven features, built side by side (owner, 4 Nov 2026: "Give this to agent and start building it")

The owner picked these from a comparison with FarmVille, Harvest Moon / Story of Seasons and Hay Day. Each is built by
its own agent in its OWN CLONE of this repo, on its own branch; the lead merges them. Make each feature our own: never
copy another game's names, characters, art, text or exact numbers.

| Agent | Feature | Branch | Server SQL part | Local Postgres port |
|---|---|---|---|---|
| farmtech | Sprinklers, fertilizer and crop quality, a greenhouse | feat/farmtech | — | — |
| breeding | Animal breeds and colours, rare ones to collect | feat/breeding | — | — |
| contests | Contests at the festivals: animals, crops, cooking | feat/contests | — | — |
| skills | Skill levels: farming, mining, fishing, hunting | feat/skills | — | — |
| farmhands | Farmhands you hire for jobs | feat/farmhands | — | — |
| social | Neighborhoods with a weekly Derby; ads for your stall | feat/social | 16 (neighborhoods + derby), 17 (stall ads) | 54351 |
| town | The train station: visitors, big timed orders, a town that grows | feat/town | — (unless truly needed: then 18) | 54361 |

## Setting up your clone (do this first)

```sh
git clone ~/Documents/harvestville-sunny-acres /private/tmp/claude-501/-Users-arcaracalague-Documents-selebox-mobile-main/c772b583-8aef-4c8e-86a4-a1535d9e2165/scratchpad/hv-<agent>
cd …/hv-<agent>
ln -s ~/Documents/harvestville-sunny-acres/node_modules node_modules
git checkout -b feat/<agent>
```

Work, build and test ONLY in your clone. Never touch ~/Documents/harvestville-sunny-acres itself (another agent is building
Bakunawa's Lair there right now, uncommitted: its files will meet yours at merge time). Commit in your clone on your
branch as you go (message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Do not push anywhere.

## How the game is made (read before you write)

- Phaser 3, ES5, one offline page: `node build.js` → `dist/index.html`. Source in `src/`, loaded in NAME order:
  `00-*` content/config, `01-*` rules (pure, testable in node), `02-*` host/net, `1x-*` scenes and UI, `19*` features.
- Add features in NEW files with your own prefix so name order is stable and merges are easy:
  - content: `src/00-zzzzzzz-<agent>.js` (after every other 00- file)
  - rules: `src/01-logicZ-<agent>.js` (after 01-logicN.js; NOT `01-logic-<agent>.js`: "-" sorts before ".", so it would load before 01-logic.js and break the game)
  - world/UI: `src/19zz-<agent>.js` (and more `19zz-<agent>-*.js` if needed)
  Wrap existing functions instead of rewriting them (`var x = P.x; P.x = function () { … x.call(this, …) }`). If you
  must edit an existing file, keep the edit small and mark it with a comment naming your file.
- The save: never bump `SAVE_VERSION`. New keys only through `L.newState` / `L.serialize` / `L.deserialize` wrappers in
  your rules file, with a key no one else uses (farmtech `ft`, breeding `br`, contests `ct`, skills `sk2`, farmhands `fh`,
  social `nb`, town `tw`). Old saves must load (tests for that).
- Tips/tours: one bit each, appended with `C.TIPS.push({ key: '<x>_tour', text: 'TITLE' })` in your rules file
  (01-logicL.js keeps tips past the 31st in `s.tq`). Every new feature ships a first-time animated tour (see
  `src/19zk-tours.js`, `src/19zp-hunt-tours.js`; the card is `U.tour` in `src/19ze-tours.js`) and a What's new line with
  that tour (`src/00-news.js`, version '2.2' entry — append your lines; merge will combine them).
- Icons: `C.ICON_ORDER` is append-only; append yours in your 00- file. Prefer existing icons when one fits. For new ones
  draw stand-ins in `tools/art/<agent>-icons.js` (ART.ICON_DRAW, like `tools/art/gear-icons.js` / `lair-icons.js`), add it
  to `tools/art/icons-fill.js`'s list and run `node tools/art/icons-fill.js && node tools/art/squeeze.js` (the sheet grows
  by itself). New props/buildings/people with no art: draw stand-ins on a canvas at runtime (like `src/19y-mine.js`
  liftTexture) and write image prompts for Codex in `art-src/<AGENT>-PROMPTS.md` in the style of the other prompt docs.
- Online play: transport is `F.Net.rpc(name, args)` to `public.farm_*_v1` Supabase functions; `test/net-mock.js` mirrors
  every function for the tests; SQL lives in `supabase/farm_online_<n>.sql` and is tested by `test/sql/run.sh`
  (`PORT=<your port> sh test/sql/run.sh`). Before a part is applied on the live server the game must hide it quietly.
  Presence fields are cleaned in `src/19h-online.js` `clean`; broadcast event names match `/^[a-z]{1,16}$/`.
- UI: list panels `U.listPanel({ title, tabs, rows, sub, reopen, corner })`, `U.dialog(text, buttons)`, `U.toast`. Pop-ups
  are always centred. The page is 360 wide in layout px. Plain short English words; a little Filipino flavour is welcome.
- Pause menu tiles: `src/16-panels.js` (tile(col, row, icon, label, fn)) — it is full; if you need a tile, put your
  feature somewhere it belongs (a villager, a building, the Quests panel, the Online panel) instead, or ask the lead.

## Tests (required)

- Unit tests for your rules in a new `test/<agent>.test.js`, added to `package.json`'s `test` script. `npm test` passes.
- End-to-end tests appended at the END of `test/e2e.test.js` (and `test/e2e-online.test.js` for online parts), using
  the helpers at the top of those files. Run only yours: `node build.js && node --test --test-timeout=900000
  --test-name-pattern="<your words>" test/e2e.test.js`. Do NOT run the whole e2e suites more than once at the end (they
  take ~10 minutes and other agents share the machine). Take screenshots (`SHOTS=<dir>`) and LOOK at them with Read: it
  must look good and clear on a 360 x 640 phone.
- SQL: `PORT=<your port> sh test/sql/run.sh` with your checks in `test/sql/<agent>-checks.sql` added to run.sh.

## Report back (short)

Branch name and clone path, a few lines on what the feature does for players, the numbers (prices, timings) you chose,
files added/changed, test results (counts), screenshot paths, Codex prompt doc path, the SQL part(s) if any, and what is
left. Keep scope sensible: a solid, fun first version that works on a low-end Android phone beats a huge one.
