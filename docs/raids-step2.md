# Farm Raids step 2: real raids between players (design, 9 Nov 2026)

Owner's rules: docs/raids.md. This is how they are built.

## The pieces

1. **Each farm's raid copy (the defender's phone makes it).** Every time a farm saves (at most once a minute), its phone
   also sends a small "raid copy" built by the same code the practice raids use (`P.raidFarm`): the walls, the defenses
   and their levels, the loot out in the open (ripe crops, eggs and milk, stall goods, the Gold pot), and its Farm
   Power. Stored in `farm.raid_copies`, one row per farm. A farm with no loot in it is never listed (owner: skipped).
2. **Finding a farm (Supabase function `farm_raid_find_v1`).** Picks farms near your power (or the list, a stronger one
   if you dare), skipping: your own, empty ones, farms under 7 days old, shielded ones (8 h after a raid, or a Farm
   Shield), and one being raided now. Shows its name, power and loot. **Next** costs a little Gold.
3. **Starting (`farm_raid_start_v1`).** Checks your 5 raids today and your energy, locks the farm for 3 minutes, freezes
   its copy into the raid row and gives a seed. A real raid breaks your own Farm Shield.
4. **The battle (the phone).** Played exactly like practice, on the frozen copy, with the seed. The phone records its
   drops (which raider, where, at which tick).
5. **The check (our game server).** The phone sends its drops to the game server. The server replays them with the
   game's own rules (`L.frReplay`, already in the shared logic files) on the frozen copy, and only then records the
   result with its own key (`farm_raid_settle_v1`, which only the server can call). The phone's own result is never
   trusted.
6. **The prize.** The attacker gets the loot (capped by power: 10-30%) and Raid Points for the stars, on their next
   save. The defender's loss waits as a row in `farm.raid_losses`.
7. **The defender's side.** When they next open the game: a card with who raided, the stars, what was taken, **Replay**
   (the same battle drawn from the drops), **Revenge** (free, against that farm, once) and an 8-hour shield.
8. **Raid Points ranking** with a weekly prize, like the other boards.

## Tables (part 25)

- `farm.raid_copies` (user_id, copy jsonb, power, loot_total, updated_at)
- `farm.raids` (id, attacker, defender, copy jsonb, army jsonb, seed, started_at, state: open / done / expired,
  moves jsonb, stars, taken jsonb, points, settled_at, revenge_of)
- `farm.raid_losses` (raid id, defender, seen_at), `farm.raid_points` (user_id, week, points)
- Every number in `farm.raid_config` (owner: "every number lives on the server").

## Functions (all `security definer`, revoked from public and anon)

`farm_raid_copy_put_v1`, `farm_raid_find_v1`, `farm_raid_start_v1`, `farm_raid_settle_v1` (game server only, by its
own secret), `farm_raid_inbox_v1` (the defender's card), `farm_raid_seen_v1`, `farm_raid_board_v1`.

## What needs the owner

- Apply the SQL (part 25), then I check it read-only.
- The game server gets one new secret (only it can record a result) and the deploy: your OK.
- No new art.
