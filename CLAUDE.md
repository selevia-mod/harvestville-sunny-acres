# Sunny Acres

Read `HANDOFF.md` first (state of the project, what is left, how to test, conventions), then `README.md`.

- Never apply `supabase/farm_online.sql` or change the Selebox Supabase project without the owner's explicit OK.
- The game page must make no network calls; online play goes through `window.gameHost.net` (`bridge/`).
- Run `npm test` after changes; run the browser suites (`test/e2e.test.js`, `test/e2e-online.test.js`) one at
  a time after a build.
- Talk to the owner in plain, non-technical language.
- Before every OTA with game changes: `node tools/robot-check.js --all-tests` (about an hour; `--quick` for a few
  minutes). It plays every panel, every place, festival days, clock jumps, a full bag and random play, runs the tests,
  and writes a one-page report (~/Downloads/robot-check-<date>/report.png) for the owner. Exit code 1 = a problem.
- Players' errors arrive in `farm.errors` (`supabase/farm_errors.sql`, `src/02-report-errors.js`): read it after every
  OTA (read-only): `select day, build, version, platform, map, screen, msg, n, users from farm.errors order by day desc, n desc;`
  The stack's `page:LINE:COL` is a line of that build's dist/index.html (`F.BUILD` = 8 letters of the code's md5).
