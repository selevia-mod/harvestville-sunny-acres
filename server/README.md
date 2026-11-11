# Harvest Ville game server

Our own server for online play: it runs the monsters of every cave floor (Bakunawa's Lair and each hunting place's
dungeon) for everyone on that floor, so no phone has to. The contract with the game page is
[`docs/game-server.md`](../docs/game-server.md): rooms, every message, who does what.

Plain Node 22 and the `ws` package; `jose` checks the players' Supabase tokens. It loads the game's own rules from
`../src` (the `00-` and `01-` files, as the game's tests do) and the cave maps from `../maps`, so a monster here
behaves as it does in solo. It stores nothing: rewards stay on each phone.

```
server/
  index.js              start here: env, the server, a clean stop on SIGTERM / SIGINT
  lib/rules.js          the game's rules (src/00-*, src/01-*) in a vm; which cave a map is, its floor list
  lib/maps.js           a cave map: walls, solid props, the `wild` zone, the gate down
  lib/wild.js           the monsters' rules, from src/19v-wild.js and src/19zt-lair.js, with no Phaser
  lib/room.js           one floor: phones, monsters, hits, kills, the 20 Hz news
  lib/pub.js            a hunting place open to everyone (step 2): 30 a room, shared animals, bait, arrows, who sees whom
  lib/tower.js          The Lost Tower's floors (step 4): 4 a room, the floor's own enemies and tricks, who is paid at the clear
  lib/game.js           every room and connection, the messages in, the tick (no network: tests drive it)
  lib/server.js         HTTP + WebSocket on 127.0.0.1, /health, the tick on the clock, the minute's log line
  lib/auth.js           a phone's token (ES256, the project's JWKS) and farm_topic_ok_v1, asked as that player
  test/*.test.js        the rooms with fake phones, the token checks, the real server on this machine
  test/load.js          80 bot phones with 60-250 ms delay each way (8 on each of 10 floors)
  test/load-pub.js      180 bot phones on the hunting places (30 on each of 6), 60-250 ms each way
  deploy/harvest-game.service   the systemd unit
```

## Run it here

```bash
cd server
npm ci
SUPABASE_URL=https://zplisqwoejxrdrpbfass.supabase.co SUPABASE_ANON_KEY=<the project's anon key> node index.js
# [game] listening on 127.0.0.1:2567     and once a minute:
# [game] rooms 3, players 12, sockets 12, msgs/s in 41.0 out 240.2, 37.5 KB/s out, slowest tick 1.20 ms
```

`curl http://127.0.0.1:2567/health` answers `ok`. A phone connects to `ws://127.0.0.1:2567/` (on the droplet, through
Caddy: `wss://168-144-137-57.sslip.io/`).

### Environment

| name | | |
|---|---|---|
| `SUPABASE_URL` | needed | the Supabase project (`https://<ref>.supabase.co`); the JWKS is `<url>/auth/v1/.well-known/jwks.json` |
| `SUPABASE_ANON_KEY` | needed | the project's public anon key (the `apikey` header of the farm_topic_ok_v1 call) |
| `PORT` | 2567 | |
| `HOST` | 127.0.0.1 | Caddy in front does TLS; never open this port to the internet |
| `SUPABASE_JWT_ISSUER` | `<url>/auth/v1` | the tokens' `iss`; set it empty to not check it |

Never put the key in the repo: on the droplet it lives in `/etc/harvest-game.env` (root only).

### Tests (this folder only; no network but 127.0.0.1)

```bash
cd server
npm test          # the rooms, the tokens, the real server on a free local port
npm run load      # the load test, 60 s (SECS=120 ROOMS=10 BOTS=8 npm run load)
npm run load-pub  # the hunting places' load test, 60 s (SECS=120 PLACES=6 BOTS=30 npm run load-pub)
```

## Deploy (by hand, by a person: nothing deploys itself)

The droplet: DigitalOcean Singapore `168.144.137.57`, Ubuntu 24.04, Node 22, Caddy. The server lives in
`/opt/harvest-game` with the repo's `src/`, `maps/` and `server/` (it reads the game's rules and maps from there), and
runs as the user `game`.

**Once:**

```bash
ssh root@168.144.137.57
adduser --system --group --home /opt/harvest-game --shell /usr/sbin/nologin game
mkdir -p /opt/harvest-game && chown game:game /opt/harvest-game
node --version                      # v22.x; `which node` must be /usr/bin/node (else change ExecStart in the unit)
cat > /etc/harvest-game.env <<'EOF'
SUPABASE_URL=https://zplisqwoejxrdrpbfass.supabase.co
SUPABASE_ANON_KEY=<the project's anon key>
EOF
chmod 600 /etc/harvest-game.env
```

Caddy (`/etc/caddy/Caddyfile`; WebSockets pass through `reverse_proxy` as they are):

```
168-144-137-57.sslip.io {
	reverse_proxy 127.0.0.1:2567
}
```

then `systemctl reload caddy`.

**Each release** (from the repo's root, on the branch to ship):

```bash
rsync -az --delete --exclude 'server/node_modules' src maps server root@168.144.137.57:/opt/harvest-game/
ssh root@168.144.137.57 '
  cd /opt/harvest-game/server && npm ci --omit=dev &&
  chown -R game:game /opt/harvest-game &&
  cp /opt/harvest-game/server/deploy/harvest-game.service /etc/systemd/system/harvest-game.service &&
  systemctl daemon-reload && systemctl enable harvest-game && systemctl restart harvest-game'
```

A restart tells every phone (close 1001); they reconnect at once and get the whole floor again (the floor's
monsters start fresh after a restart: nothing is stored).

**Check:**

```bash
curl https://168-144-137-57.sslip.io/health          # ok
ssh root@168.144.137.57 'systemctl status harvest-game --no-pager; journalctl -u harvest-game -n 20 --no-pager'
```

**Off** (the phones play the old way, through Supabase Realtime): the app's switch `sunny_acres_gameserver` = `off`,
or `systemctl stop harvest-game`.

## How it decides (where the contract leaves a choice)

- A room is `topic|map|floor`; the monsters are made when the first phone comes, around it, as `setupWild` places them
  for a first visitor (6 tiles or more away). An empty room keeps its monsters, standing still, for 30 s (a dropped
  phone comes back to the same floor), then goes.
- A player is the token's `sub`. The same player again (a reconnect) takes their place back; the old socket is closed
  (4001). Their hits so far still count for the share.
- `wl` also carries `n` and `st` (the tick number and the server's clock), and a floor already clear sends `cl` right
  after `wl`.
- A hit: `d` is clamped to 1 .. the best bow's damage + 1 (a strong shot, Hunting 5+: 4 today). A second hit on the same
  monster from the same phone within 150 ms, or from 12 tiles or more away, is not counted; that phone alone gets an
  `hp` with the hp as it is, so its bar comes back.
- `dn.by`: everyone with `minHits` hits (1 unless the monster says), and the last hitter. `dn.kind` is the kind's name.
  A down monster's slot is also in the next `tk.gone`.
- A charge that reaches a player: `bp` to them, and it backs off (`wildBack`: 2.5 s away, 5 s before it charges again).
- A place's boss grows by `hpEach` for each player more than it has seen (as the game does); it never shrinks when
  one leaves. The Lair's guards are as strong as the floor (`L.lairHp`).
- The Bakunawa (Lair floor 50): 20-40 s timers as `wildArrive`; when one runs out with 2 or more on the floor and at
  least 2 of them said `bk: 1` in their `hi` (their Bakunawa is ready today), it rises (hp `hpEach` x the crew), once
  for the room.
- A player with a menu open (`b: 1` in `hi` / `mv`) is left out of the crew: nothing notices, flees from or charges
  them (the game's `wildCrew(!busy)`). They still count for a boss's strength.
- Bait and a friend's arrow in flight are not on the server yet: the phones keep them on the old relay.
- Limits: 60 messages a second a phone (more are dropped; 180 closes it), 4 KB a message, `hi` within 10 s, closed after
  20 s with nothing heard (a phone pings every 2 s). A phone far behind on what was sent skips ticks.

## The hunting places (step 2: `topic: 'pub'`)

A room is `pub|<map>|<n>` ("Banaue 2"), at most `PUB_CAP` (30) phones, any good token (no farm asked). The full rules
and the wire are in the doc's "Step 2" (its "The wire, exactly" and "How the server decides"); in short: the room is
the `with` player's if it has space, else the fullest with space, else a new one; the animals follow the Philippine
clock, a hunted slot comes back sooner for a crowd, a crowd gets more copies of the roster (slots 100 and up), new ones
walk in out of sight, the tame never comes; bait and arrows in flight go through the server; each phone hears of the 15
nearest players within 18 tiles; no `cl`; an empty public room goes at once.
