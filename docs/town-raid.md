# Town Raid (for the owner, 6 Nov 2026)

You said: "Town Raid, yes agree, it will replace the world boss" and "we are loosing the real purpose of game, the farm
and town". So the big shared fight happens on the farms, not in the Wild Lands. (The World Boss in
`docs/hunters-path-design.md` is the idea this replaces.)

## What players see and do

1. **30 minutes before**: a bar under the goal banner, "Town Raid soon: Giant Boar Stampede · 24:10", and one short
   word: "Town Raid in 30 minutes: Giant Boars are coming for the fields! Get your tools ready."
2. **When it starts** (8:00 PM): the first time ever, a short animated tour (4 cards). Then a card in the middle of the
   screen: what is coming, how to fight it, "every hit adds to ONE goal the whole town shares", the chest and the bonus
   day, and "raiders can take at most 2 crops".
3. **During the raid** (30 minutes): raiders come at the crops on your own farm. They walk or fly in, stand on a crop,
   and if nobody chases them off in time (9 to 14 seconds) that crop is lost. Next to a raider the action button says
   **Hit** (boars), **Shoo** (crows), **Douse** (sparks) or **Clear** (typhoon debris); holding the Bow it says
   **Shoot** from up to 6 tiles away. Each hit shows "+1"; a tough raider shows a small health bar; a beaten one runs off.
   The bar at the top shows the whole town: "3,214 farmers defending · 67%", with the minutes left.
4. **After** (8:30 PM): a results card: did the town win, how many farmers, your hits, your chest, how many crops you
   lost, which friends helped on your farm, and the bonus day (or when the next raid is).
5. **Bonus day**: if the town won, Double Drops for everyone (even those who missed the raid) from the end of the raid
   until midnight the next day: Tuesday or Friday is a whole Double Drops day. Players who open the game the next day
   get a short "The town won Monday's raid! Double Drops for everyone until midnight tomorrow."

**Friends**: a friend visiting your farm during a raid fights the raiders there too. Their hits count for them (their
chest), and you see "+12 for the town!" over their farmer; the results card thanks them by name.

**Alone** (not signed in, offline, or before the server part is applied): the raid still comes to your farm. The bar
says "Defend your farm · 12/40", and the start card says "Join online play to defend with everyone". Land 10 hits for a
small chest, 40 for the Farm Guard Chest. No errors, no messages about servers.

## The four raids (they take turns)

| Raid | Who comes | What works | Hits each | Stand-in picture now |
|---|---|---|---|---|
| Giant Boar Stampede | boars trample crops | any tool, the Bow | 3 | the Wild Lands boar (a farm pig, tinted dark, if the hunting art is not on the phone) |
| Crow Swarm | crows peck crops | any tool, the Bow, empty hands | 1 | the labuyo, tinted black (else a black chicken) |
| Lava Bakunawa's Sparks | sparks land on fields | the Watering Can only | 2 | the Santelmo, glowing (else a drawn flame) |
| Typhoon Night | branches and stones fly in | Hoe, Axe, Hammer, Sickle | 2 | the lumber and stone icons, spinning |

Order: the first raid (Monday 9 Nov 2026) is the boars, then crows, sparks, typhoon, and round again.

## When

Every **Monday and Thursday, 8:00 to 8:30 PM** Philippine time, by the server's clock (the same clock the game uses for
Double Drops, which stay on Wednesday and Saturday).

## Rewards (gold and farm things only, never Coins or Stars)

| Chest | Hits | Inside | Town won |
|---|---|---|---|
| Helper's Chest | 10+ | 300G, 2 Fertilizer | 450G |
| Defender's Chest | 80+ | 800G, 4 Fertilizer, 10 Arrows | 1,200G |
| Hero's Chest | 200+ | 1,500G, 3 Rich Fertilizer, 20 Arrows, 1 Copper Sprinkler | 2,250G |
| Alone: Helper's | 10+ | 150G, 1 Fertilizer | |
| Alone: Farm Guard | 40 | 400G, 2 Fertilizer, 5 Arrows | |

## Fair play and gentle rules

- No Coins or Stars buy anything here. Hits cost **no energy** (energy can be bought, so it must not buy hits), and the
  Bow uses no arrows in a raid.
- At most **300 hits** per player per raid, at most about 2 a second, and at most 60 in one call (the server enforces
  all three; the game stops counting at 300 too). A batch sent twice on a bad line counts once.
- A raid takes **at most 2 crop tiles** from your field, only while you are playing on your own farm. A player who is
  not playing, is in town, or is on a friend's farm loses nothing. Withered crops are never targeted. The soil stays
  tilled.

## Numbers to tune

All in `src/00-zzzzzzzzzzz-raid.js` (game) and the one row of `farm.raid_rules` (server). Change both together for the
schedule, cap and tiers; the batch timing can be changed on the server alone.

| What | Now |
|---|---|
| Days and time | Monday + Thursday, 8:00 PM, 30 minutes |
| Countdown | 30 minutes before |
| Goal | the bigger of 500 hits, or 80 hits per farmer who helped |
| Hits per player per raid | 300 (rate 2 a second, plus 30) |
| Crops a raid can take | 2 |
| Chest tiers | 10, 80, 200 hits |
| Town won | chest gold x1.5, Double Drops until midnight the next day |
| Batches | every 10 s while hitting; a look at the bar every 30 s otherwise (`send_every`, `poll_every` on the server) |
| Raiders | how many at once, how often, how fast, how long they eat: `kinds` in the game file |
| Alone | goal 40, chests at 10 and 40 |

## The server (supabase/farm_online_21.sql), in 5 lines

1. Run it after part 20 (it needs only part 1). Safe to run twice; it adds 3 tables and 6 functions, changes nothing else.
2. `farm.raid_rules`: one row with all the numbers (days, time, length, caps, goal, chest tiers, batch timing).
3. `farm_raid_state_v1()`: the raid on now or next (worked out from the server clock), the town's count, my hits, and whether the last raid was won.
4. `farm_raid_hit_v1(raid, hits, request_id)`: adds my batch, within the caps; the same request id twice counts once.
5. `farm_raid_claim_v1(raid)`: after the raid, once per player: did the town win, my hits, my chest tier. An undo block is at the bottom.

## Message and server cost (small)

- No live room is shared. Nobody's position or raiders are sent anywhere: each phone draws its own raiders.
- A player who keeps hitting sends **one small call every 10 seconds** (about 180 in a full 30 minutes, usually far
  fewer: players stop and start). A player watching sends one look every 30 seconds. One more call after the raid.
- The only live message is a visitor's "I helped" (one every 10 s at most, on that one farm's own line).
- The town's count is kept in 16 rows per raid, so thousands of phones adding at the same moment don't queue on one row.
- If it ever gets busy: raise `send_every` in `farm.raid_rules` (for example to 20 or 30). Every phone slows down at
  once, with no app update. The caps make sure fewer, bigger batches add up to the same.
- After a raid the phones ask for their results spread over 2 to 17 seconds, not all at the same second.

## Pictures that would make it nicer (stand-ins now)

1. **Giant Boar** (12 frames like the wild animals: walking 3 directions, eating, running): bigger, bristly, red eyes, a
   little dust cloud.
2. **Crow** (12 frames: walking, pecking, flying away): black with a shiny blue edge.
3. **Lava Spark** (6 to 8 frames of a flickering ember with a face), and a **steam puff** when doused.
4. **Typhoon debris**: a flying branch, a palm frond, a tin roof sheet, a bucket (4 small pictures), and **wind streaks**.
5. **Raid icons** for the bar, the cards and the tour: a boar head, a crow, a spark, a typhoon swirl (128 px, like the
   item icons).
6. **Chests**: Helper's (wood), Defender's (iron), Hero's (gold), closed and open.
7. A **"Town is safe!" banner** for the results card, and a **"Bonus Day x2"** badge.

## What is not in yet

- Friends on the same farm each see their own raiders (not the same boar). That keeps the message cost near zero;
  sharing them would mean one phone sending every raider's position to the others, like hunting together does.
- The What's new line (you are writing one combined entry).
