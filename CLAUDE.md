# Sunny Acres

Read `HANDOFF.md` first (state of the project, what is left, how to test, conventions), then `README.md`.

- Never apply `supabase/farm_online.sql` or change the Selebox Supabase project without the owner's explicit OK.
- The game page must make no network calls; online play goes through `window.gameHost.net` (`bridge/`).
- Run `npm test` after changes; run the browser suites (`test/e2e.test.js`, `test/e2e-online.test.js`) one at
  a time after a build.
- Talk to the owner in plain, non-technical language.
