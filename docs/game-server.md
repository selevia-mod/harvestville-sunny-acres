# The game server (owner, 7 Nov 2026: "seamless, like other online games")

Playing with friends lagged even for two, because **a player's phone ran the monsters** and every message went
phone → Supabase Realtime → phone, one by one through the app bridge. The permanent fix is what online games do: **our
own game server runs the world**, phones send what they do and draw what the server says, smoothly.

- Server: DigitalOcean Singapore, `168.144.137.57`, Ubuntu 24.04, Node 22, behind Caddy at
  `wss://168-144-137-57.sslip.io/` (Caddy terminates TLS and proxies to `127.0.0.1:2567`). `/health` answers `ok`.
- Code: `server/` in this repo (plain Node, the `ws` package; no framework). It loads the game's own rules
  (`src/00-*.js`, `src/01-*.js`, as the tests do with `vm`) so monsters behave exactly as in solo.
- Step 1 (this document): **caves only**: Bakunawa's Lair and every hunting place's dungeon (`F.dungeonOf(map)`), up to
  8 per floor. Then Central Park (30), then the fields. Supabase stays for saves, friends, ranks, chat and payments.

## Who is in a room

A room is one cave floor of one farm's world: `topic|map|floor`, e.g. `farm:<host uid>|banaue_cave|3`. `topic` is the
live room the game is already in (`F.Online.topic`): your own farm, or the farm you visit. Everyone in the same
topic, map and floor shares the same monsters. At most 8 (the 9th is told the floor is full and plays on the old way).

## Joining (one WebSocket per phone, straight from the game page)

The game page connects to `wss://…/` itself (the one place it goes online: owner, 7 Nov 2026, chose "connect the game
straight to our game server"). It asks the app for the Supabase access token first (bridge op `token`).

All messages are JSON objects with a type `t`. Positions are pixels on the map (`C.TILE` = 256 a tile), as the game.

### Phone → server

| t | fields | when |
|---|---|---|
| `hi` | `v: 1`, `token`, `topic`, `map`, `floor`, `name`, `look` (`boy`/`girl`), `x`, `y`, `dir`, `hg` (gear bits, `L.gearBits`), `sk` (sneak power 0/1) | once, on connect (and on every reconnect) |
| `mv` | `x`, `y`, `dir`, `m` (1 moving, 0 still), `hg`, `sk` | while moving at most 10 a second, and once when it stops |
| `hit` | `s` (monster slot), `d` (damage, `L.bowDamage`), `n` (this phone's own hit counter) | each arrow that hits, at once |
| `pi` | `c` (phone's clock, ms) | every 2 s (the server answers `po`: the round trip is measured) |
| `bye` | | leaving the floor (closing the socket also counts) |

### Server → phone

| t | fields | when |
|---|---|---|
| `wl` | `you` (your id), `tick` (ms, 50), `mons` (every monster, packed), `ppl` (everyone else: `[id, name, look, x, y, dir, m]`), `cap` (8) | after a good `hi` |
| `no` | `why`: `auth` / `topic` / `full` / `version` | a `hi` refused (the phone plays on the old way) |
| `tk` | `n` (tick number), `st` (server clock ms), `m` (monsters that changed, packed), `gone` (slots removed), `p` (players that moved: `[id, x, y, dir, m]`), `left` (ids that left), `come` (new players: as in `wl.ppl`) | every 50 ms, only if anything changed |
| `hp` | `s`, `hp`, `by` (id of the hitter), `n` (that phone's hit counter, so it knows its own hit was counted) | each hit, at once, to everyone |
| `dn` | `s`, `kind`, `x`, `y`, `by` (ids who earned a share: `minHits` hits or the last hit), `size` | a monster down: each phone in `by` gives itself the drops (`L.huntDrops`, as today) |
| `bp` | `s`, `hit` (the monster's `def.hit`) | to one phone only: a charge reached you (the phone takes the energy, `L.chargeLoss`, and the bump, as `wildHit`) |
| `cl` | | the floor is clear (every monster down): the gate down opens on every phone |
| `po` | `c` (as sent), `st` (server clock) | answer to `pi` |

**Packed monster** (as `L.wildPack`): `[slot, kindIndex, x, y, dirIndex, left, modeIndex, hp, size*100, look, max]`, with
place creatures at `1000 + WI.more.indexOf(kind)` (the game's `L.wildPack` / `L.wildUnpack` already do this).

## What the server does (it owns the monsters)

- Loads the map JSON (`maps/<map>.json`): walkable tiles (as the game's `walkable`), the `wild` zone object, blocked
  props. One floor's monsters: what the game would put there for a first visitor (the cave's floor list: see
  `19zt-lair.js` and `01-logicZZZZ-places.js`), as strong as the game makes them (`L.lairHp` for the Lair by floor,
  `L.dunHp` for a place's boss by the number of players, recomputed when someone joins or leaves).
- Runs every monster at 20 Hz with the game's own rules (`updateWild`, `wildDecide`, `wildFlee`, `wildCharge`,
  `wildBack` in `19v-wild.js`, ported to plain JS without Phaser): the crew is every player in the room at their last
  reported place, with their gear and sneak bits; walls, the zone and flying fleers as in the game.
- A hit: `hp -= d` (never more than one hit per 150 ms per phone per monster, `d` at most the best bow's damage);
  counts `hits[id]`; at 0, down with `by`. The Bakunawa (Lair floor 50) walks in as in `19zt-lair.js` when 2 or more are
  there, once.
- Never stores anything: rewards stay on each phone (as today). It logs one line a minute: rooms, players, messages a
  second, the slowest tick.

## What the phone does (seamless)

- **Your own farmer** moves as in solo, never waiting.
- **Your hit** shows at once: the flash, the dust, the bar drops by your damage. The server's `hp` corrects it a moment
  later (it is almost always the same). A kill shows its puff when `dn` comes (one round trip, about 0.1 s from
  the Philippines to Singapore).
- **Monsters and friends** are drawn about 100 ms behind, between two ticks (`L.trailAt`), so they glide.
- Lost connection: reconnect at once, then every 1, 2, 4 s; the `wl` that answers is the whole floor again.
- No server (it refused, or did not answer within 3 s): the cave plays the old way (the Supabase relay), as before.
- On by a switch the app sends (`gameHost.gs`: the server's address, or nothing): app_config `sunny_acres_gameserver`
  (`off` / `staff` / `on`, missing = off).

## Tests

- `server/test`: the room logic with fake phones; a bot load test: **8 bots on one floor and 10 floors at once**, with
  60–250 ms of random delay each way. Measured: the slowest tick, messages a second per phone, how long a kill takes
  to reach everyone, bandwidth.
- `test/e2e-gameserver.test.js`: two real game pages against a local server, with delay: one list on both, a kill
  stays killed, the gate opens for both, a dropped connection comes back, and no server means the old way.
