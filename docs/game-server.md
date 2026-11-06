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
| `hi` | `v: 1`, `token`, `topic`, `map`, `floor`, `name`, `look` (`boy`/`girl`), `x`, `y`, `dir`, `hg` (gear bits, `L.gearBits`), `sk` (sneak power 0/1), `b` (1: a menu is open), `bk` (1: this phone's Bakunawa is ready today, `L.bakunawaReady`) | once, on connect (and on every reconnect); after `bye`, again on the same socket for another floor |
| `mv` | `x`, `y`, `dir`, `m` (1 moving, 0 still), `hg`, `sk`, `b` (1 while a menu is open) | while moving at most 10 a second, once when it stops, and when `b` changes |
| `hit` | `s` (monster slot), `d` (damage, `L.bowDamage`), `n` (this phone's own hit counter) | each arrow that hits, at once |
| `pi` | `c` (phone's clock, ms) | every 2 s (the server answers `po`: the round trip is measured) |
| `bye` | | leaving the floor (closing the socket also counts) |

### Server → phone

| t | fields | when |
|---|---|---|
| `wl` | `you` (your id), `tick` (ms, 50), `mons` (every monster, packed), `ppl` (everyone else: `[id, name, look, x, y, dir, m]`), `cap` (8), `n` (the tick number now), `st` (server clock ms) | after a good `hi`; a floor already clear also sends `cl` right after it |
| `no` | `why`: `auth` / `topic` / `full` / `version` | a `hi` refused (the phone plays on the old way); the socket is then closed with 4010 / 4011 / 4012 / 4013 |
| `tk` | `n` (tick number), `st` (server clock ms), `m` (monsters that changed, packed), `gone` (slots removed, a killed one too, after its `dn`), `p` (players that moved: `[id, x, y, dir, m]`), `left` (ids that left), `come` (new players: as in `wl.ppl`); every field always there (empty `[]`) | every 50 ms, only if anything changed for that phone |
| `hp` | `s`, `hp`, `by` (id of the hitter), `n` (that phone's hit counter, so it knows its own hit was counted) | each hit, at once, to everyone. A hit not counted (within 150 ms of that phone's last on it, or from 12 tiles or more away) gets an `hp` to that phone only, with the hp as it is (its bar comes back) |
| `dn` | `s`, `kind` (its name, e.g. `sigbin`), `x`, `y`, `by` (ids who earned a share: `minHits` hits or the last hit), `size` | a monster down: each phone in `by` gives itself the drops (`L.huntDrops`, as today) |
| `bp` | `s`, `hit` (the monster's `def.hit`) | to one phone only: a charge reached you (the phone takes the energy, `L.chargeLoss`, and the bump, as `wildHit`) |
| `cl` | | the floor is clear (every monster down): the gate down opens on every phone |
| `po` | `c` (as sent), `st` (server clock) | answer to `pi` |

Closing codes: 1001 the server is restarting (reconnect), 4001 the same player connected again on another socket
(this one is let go), 4002 no `hi` within 10 s, 4003 nothing heard for 20 s, 4010-4013 after a `no` (above), 1008 far
too many messages. Limits: 4 KB a message; 60 messages a second a phone (more are dropped, 180 closes it).

**Not on the server yet** (step 1): bait (`bt`) and a friend's arrow in flight (`ar`). The phone keeps sending them on
the old relay (Supabase Realtime) as today; the server's monsters never go to bait.

**Packed monster** (as `L.wildPack`): `[slot, kindIndex, x, y, dirIndex, left, modeIndex, hp, size*100, look, max]`, with
place creatures at `1000 + WI.more.indexOf(kind)` (the game's `L.wildPack` / `L.wildUnpack` already do this).

## What the server does (it owns the monsters)

- Loads the map JSON (`maps/<map>.json`): walkable tiles (as the game's `walkable`), the `wild` zone object, blocked
  props. One floor's monsters: what the game would put there for a first visitor (the cave's floor list: see
  `19zt-lair.js` and `01-logicZZZZ-places.js`), as strong as the game makes them (`L.lairHp` for the Lair by floor,
  `L.dunHp` for a place's boss by the number of players: it grows by `hpEach` for each player more than it has seen,
  as the game does, and never shrinks when one leaves).
- Runs every monster at 20 Hz with the game's own rules (`updateWild`, `wildDecide`, `wildFlee`, `wildCharge`,
  `wildBack` in `19v-wild.js`, ported to plain JS without Phaser): the crew is every player in the room at their last
  reported place, with their gear and sneak bits, but those with a menu open (`b`: 1, as the game's `wildCrew(!busy)`); walls, the zone and flying fleers as in the game.
- A hit: `hp -= d` (never more than one hit per 150 ms per phone per monster; `d` clamped to 1 .. the best bow's
  damage + 1 for a strong shot, Hunting 5+: 4 today; not from 12 tiles or more away); counts `hits[id]`; at 0, down with
  `by` (`minHits` hits, plus the last hitter). The Bakunawa (Lair floor 50) walks in as in `19zt-lair.js` when 2 or more
  are there and at least 2 of them say `bk: 1` (each phone still records its own day), once for the room.
- A player is the token's `sub`; the same player again takes their place back (their hits still count). An empty floor
  keeps its monsters, standing still, 30 s, then goes.
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
