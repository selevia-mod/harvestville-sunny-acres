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

# Step 2: the hunting places, open to everyone, 30 a room (owner, 7 Nov 2026)

Owner: "open it to everyone up to 30 ... then if we got many players we can open it to 100". Every hunting place
(`L.isWildMap`: Pulag, Makiling, Magayon and the new places: Banaue, Bohol, Taal, Sierra, Palawan) becomes one shared
world for everyone, in rooms of 30 like Central Park's channels (Banaue 1, Banaue 2, ...). Strangers meet and hunt the
same animals. The caves stay as in step 1 (a farm's floor, 8). Nothing goes through Supabase Realtime in a public room
(no message budget: the server carries it all). With no server (switch off, refused, down) the place plays the old way
(your farm's room, friends only), exactly as today.

## Joining a public room

The same socket and `hi`, with `topic: 'pub'`, the place's `map`, `floor: 0`, and:

| field | what |
|---|---|
| `with` | (optional) a player id to be put with: the farm you are visiting (its host), or a friend from your farm's room who is on this place now. |
| `lk` | how you look, drawn by the others: `{ cs, pt, rd }` as `O.myState()` (the look you wear, the party hat, on your horse). The server keeps it short (`cs` 64 chars) and passes it on. |
| `bk` | unused here (0). |

The server picks the room: the `with` player's room of this map if it has space; else the fullest room of this map that
still has space (so places feel alive); else a new one (the lowest free number). The cap is **30** (`PUB_CAP`, one
number to raise to 100 later). `wl` gains `ch` (the room number, shown as "Banaue 2") and `cap` 30. `no` `full` never
happens for `pub` (a new room opens). Any good token may join `pub` (no farm check).

## What the server does in a public room

- **Animals:** the place's own list, as `L.wildHere` would give a player now, from a shared state: today's day and
  minute from the real clock in Philippine time (`L.minuteOf`, as the phones), the same weather (`L.weather`), the
  same rare hours (`L.wildRare`), wolves only at night, the Great Mammoth on its weekend (`great`, needs two or more
  hunters in the room as today). The room has its own `gone` list: a hunted slot comes back after its `respawn` minutes
  (`WI.respawn`, or the animal's own), divided by the crowd: `ceil(players / 5)`, at most 3 (30 hunters must not find
  an empty field). More hunters also bring more animals: for each 6 players beyond the first 6 the room adds one more
  copy of the place's roster (slots `100 * copy + slot`), at most 3 copies in all. New animals walk in as the game's
  `arrive` (20-40 s), never pop in front of anyone.
- **Not on the server:** the place's tame animal (`e.tame`: each player's own, as today: the phone keeps it as a
  local-only animal, never sent, never in the room's list).
- **Bait** (`bt` phone → server: `x`, `y`): the server puts it down for the room (one bait per phone at a time, `WI.baitMins`),
  and its monsters go to it as the game's bait rules (`19v-wild.js`: a shy animal near it walks to it and eats). The
  other phones are told (`bt` server → phone: `id`, `x`, `y`, `until`) and draw it.
- **Arrows in flight** (`ar` phone → server, as the old relay's payload) are passed on to the phones that can see it.
- **Who sees whom (so a cheap phone is never asked to draw 30):** each phone gets the players within `VIEW` tiles of it
  (18 tiles: a phone screen and a margin), at most the **15 nearest**. Coming into view is a `come`, going out of it
  a `left` (the phone treats them as joining and leaving). Animals: all of them (a place has fewer than 40).
- Kills, shares (`by`), the hit checks, `bp` charges, `hp`: as step 1. A public room never sends `cl`.
- An empty public room goes at once (no 30 s keep: a new one is made fresh).

### The wire, exactly (step 2, as built in `server/lib/pub.js`)

- `wl` in a public room: `{ t, you, tick: 50, mons, ppl, cap: 30, ch, n, st }`; `ppl` is the players in your view only
  (below). Right after it, one `bt` for each bait another phone has down now. A public room never sends `cl`.
- A player row (`wl.ppl`, `tk.come`) is `[id, name, look, x, y, dir, m, lk]`: step 1's seven, then `lk` = `{ cs, pt, rd }`
  (`cs` at most 64 characters, `pt` and `rd` 0 / 1). In a public room `lk` is always there (`{ cs: '', pt: 0, rd: 0 }`
  when the phone sent none); in a cave only when that phone's `hi` had one (step 1's rows are unchanged otherwise).
  Names reach strangers without control or invisible characters.
- `tk` in a public room: the same fields; `m` and `gone` are every animal's (all phones), `p` / `come` / `left` are
  about the players in your view only: `come` = came into view (or into the room near you), `left` = went out of view
  (or out of the room while in view).
- `bt` phone → server: `{ t: 'bt', x, y }`; ignored while that phone's bait is still down. Server → the other phones:
  `{ t: 'bt', id, x, y, until }`, `id` the player who put it down, `until` on the **server's clock** (ms, as `st`):
  now + `WI.baitMins` + 30 s, as the game's `layBait`.
- `ar` phone → server: `{ t: 'ar', x, y, a, l, b }` (the old relay's payload). Server → each phone that has the shooter in
  view: `{ t: 'ar', id, x, y, a, l, b }`: `x`, `y` whole pixels on the map, `a` the angle (3 decimals, -7 .. 7), `l` 0 ..
  8 tiles, `b` the bow level 0 .. 3; anything else is dropped. At most 8 a second a phone. It never hurts anything
  (`hit` does).
- `bt` and `ar` in a cave are ignored (step 1: the old relay).
- **Slots 100 and up** (the copies): `100 * copy + slot`, so 0 .. 399. The phones' `L.wildUnpack` (`01-logicD.js`)
  refuses a slot over 99 today: the phone must accept these (up to 399) in a public room, or it will not draw the copies.

### How the server decides (where step 2 leaves a choice)

- Room choice, in order: where this player already is (a second socket takes their place back, the old one closes
  4001); the `with` player's room if it has space; the room this player's line dropped from in the last 30 s, if it has
  space (so a reconnect without `with` finds its friends again); the fullest with space (ties: the lowest number); a
  new one with the lowest free number.
- The clock: Philippine time (UTC+8), the day and minute as `L.dayOf` / `L.minuteOf` give on a phone there; the
  roster is `L.wildHere` on that state, without the tame, worked out once a minute.
- Copies: 1 for 1-11 players, 2 for 12-17, 3 for 18 or more. A copy never has the place's rare or great animal (one of
  those at a time). Each copy has its own 20-40 s arrive timer (one animal at a time, as the game), so a crowd's copies
  fill in at the same pace a single player's roster does. An animal walks in from the zone's edge 6 tiles or more from
  every player, toward the middle (as `wildArrive`).
- Respawn: `(def.respawn || WI.respawn) / min(3, ceil(players / 5))` minutes, worked out when the slot is next due.
  The Great Mammoth's 3 days are not divided (its weekend is not a crowd's). Its strength: `hpEach` x the players here,
  at most its own `hp` (108: what the phones' `L.wildUnpack` shows at most).
- One no longer about (its hour, the rain or the weekend has passed, or a copy the crowd no longer brings) walks off
  once nobody is within 18 tiles of it and it is not running or charging (looked for every 5 s; its slot does not wait).
- View: within 18 tiles, the 15 nearest; one already in view stays until 19 tiles and outranks a newcomer by a tile
  (nobody blinks in and out at the edge). Worked out every tick for each phone.
- Bait: the nearest shy animal within 9 tiles that is not already at a bait goes to it (`toBait`, 20 s), eats within
  0.4 tiles (`eat`, `WI.baitMins`), and flees only from a player within 1.4 tiles while eating (the game's rules).
- Load (`node server/test/load-pub.js`, this Mac, 60 s, 60-250 ms each way): 30 bots on one place: tick p50 0.43 ms,
  p99 1.5 ms, 5.7 KB/s down a phone. 180 bots on 6 places: tick p50 2.1 ms, p99 3.2 ms, slowest 10.4 ms, 5.7 KB/s down a
  phone (8.2 in the busiest second), a kill to all 30 phones p50 465 ms / p95 497 ms, 7.8% of one core.

## What the phone does in a public room

- On a hunting place as yourself (your own save: at home, or on a visit `v.inTown`), with the switch on: join `pub`
  for that map. Your farm's room stays joined and says where you went (as the park), but it carries **no** hunt
  messages there and its farmers are not drawn on that map (the server's list is who is here: never twice).
- Everyone else is drawn from the server: name, look (`lk`), walking between ticks as in the caves. A stranger's
  farmer opens the same player card as in Central Park (Add friend, Report, Block). A blocked player is not drawn.
- The place's name shows its room: "Banaue 2 · 17 here" (where the park shows "Park 2").
- No chat in a hunting place yet (Central Park has it). Emotes and waves as the farm rooms, if they already exist.
- The tame animal stays your own (local only). Your drops, records and energy are yours (as today).

## Tests (step 2)

- `server/test`: room choice (`with`, fullest with space, a new room at 30), respawn by crowd, copies, view (15 nearest
  within 18 tiles), bait, `ar` passed on, the tame never on the server.
- Load: **30 bots on one place, and 6 places at once (180)**, with 60-250 ms each way: the slowest tick, KB/s down per
  phone (target under 8), a kill to everyone.
- Game e2e against the REAL server: 4 real game pages on one place (two strangers, two friends with `with`), one list
  for all, a kill gone for all, a stranger's card, bait, and a cheap-phone check: 29 bots walking round one page
  (the page's frame time while drawing them).
