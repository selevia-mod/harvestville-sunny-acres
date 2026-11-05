# Town Rank and the Hall of Fame

Owner, 6 Nov 2026: "Town Rank is better than Hunter ranking", and "inside the museum is the name of the player who
get the big boar, or first defeat boss something like that".

## What players see

**Town Rank**

- Everything you do in Harvest Ville earns points: picking crops, collecting eggs and milk, cooking, workshop goods,
  fishing, breaking rocks in the Mine, hunting, and helping the town (cargo crates at the Station, villagers'
  requests, shipping orders). Later, gifts to the Bayanihan Project count too.
- Points this month give you a rank: **Bronze, Silver, Gold, then Champion**.
- The **Town Rank page** shows your rank, your points, a bar to the next rank, your title, how many days until it
  starts over, your best rank ever, and the **Top 100** (10 a page, your own line marked). "How to earn" lists every
  kind of point and how many are left today.
- It opens from: Online > Ranks (Change until "Town Rank"), your farmer card in the pause menu (the rank at the right
  of the birthday line), and the big board in the Hall of Fame.
- When you reach a new rank a short message says so, with your new title. The first time (Bronze) the Town Rank tour
  plays. The tour also plays the first time you open the page.
- Online, other players see a small badge in your rank's colour by your name, over your head.
- It starts over on the **1st of each month, Manila time**. Your best rank ever stays.
- Without online play the page shows your own points and says "Join online play to see the Top 100."

**The Hall of Fame**

- Central Park's Hall of Fame door now goes in. Inside: a red carpet, plaques on the walls, the Town Rank board in the
  middle of the back wall, and five pedestals with gold, silver and purple cups.
- Walk up to a plaque or pedestal and tap **Read**: the names and the records. Your own says **"That's you!"**.
  Hunting plaques also show your own best next to the record.
- Out the door you are back in the park, in front of the hall.
- Without online play every plaque says "Join online play to see the names." (the boar's pedestal still shows your
  own biggest boar).
- The first time inside, the Hall of Fame tour plays.
- Being the first ever to beat a boss shows a big "A FIRST FOR HARVEST VILLE!" message, and your name goes up for good.

## Points

| What you do | Points | Most a day |
| --- | --- | --- |
| Farming: each crop picked, each egg, milk or other animal product collected | 1 | 300 |
| Cooking and goods: each dish cooked, each workshop good collected | 3 | 150 |
| Fishing: each fish caught | 3 | 150 |
| Mining: each rock broken in the Mine | 1 | 150 |
| Hunting: each animal hunted (the Lair's creatures too) | 5 | 150 |
| Helping the town: a cargo crate 5 (+20 for the last crate of an order), a villager's request 10, a shipping order 5 | 5 to 25 | 300 |
| Bayanihan Project: each gift (when that part comes) | 10 | 200 |

Most in one day: 1,400. A "day" is Manila's day. The server keeps the same daily limits, so a changed game cannot send
more. Nothing bought with Coins or Stars gives points.

## Ranks and rewards

| Rank | Points this month | Title | Badge colour |
| --- | --- | --- | --- |
| Bronze | 300 | Town Helper | bronze |
| Silver | 2,000 | Pride of the Town | silver |
| Gold | 8,000 | Hero of Harvest Ville | gold |
| Champion | 20,000 | Champion of Harvest Ville | purple |

Looks only, never power: the badge by your name, the dot on your farmer card, and the title. Champion needs about 670
points every day of the month. Last month's Champions and the player with the most Champion months go up in the Hall.

## The plaques

| Where | What it shows |
| --- | --- |
| Back wall 1-3 | Biggest catches of Pulag, Makiling and Magayon: the record holder of each animal (biggest ever) |
| Back wall, middle | Town Rank this month: the top 10 (and a button to the Town Rank page) |
| Back wall 4 | Fishing Derby records: the biggest of each fish on any Fish Monday |
| Back wall 5 | Firsts of Bakunawa's Lair: the first to beat the guard of floors 10, 20, 30 and 40 |
| Back wall 6 | Town Rank Champions: last month's, and the most Champion months |
| Left wall | More hunting records: animals of new hunting places, until they get their own plaque |
| Right wall | An empty plaque ("A new plaque will hang here soon.") |
| Pedestal (gold cup) | The biggest Wild Boar |
| Pedestal (big gold cup, middle) | The first to beat the Bakunawa |
| Pedestal (purple cup) | Last month's Champion |
| Pedestal (silver cup) | The first to hunt the Great Mammoth |
| Pedestal (silver cup) | Bayanihan Project top givers (says "Coming soon" until that part comes) |

For the other parts of the game: a new boss is one line in `C.HALL.FIRSTS` (src/00-zzzzzzzzzzz-rank.js) and one row
in `farm.hall_first_keys`. A new hunting place's animals show on "More hunting records" by themselves; giving them
their own plaque is one line in `C.HALL.spots`. The Bayanihan Project adds its points with
`L.rankAdd(s, 'bayanihan', points)` and its plaque by replacing `farm.hall_more()` (a list of `{ key: 'bayanihan',
rows: [{ id, name, text }] }`).

## The SQL (supabase/farm_online_22.sql)

1. Run it after part 21; it only needs parts 1, 14 and 15. Additive and safe to run twice.
2. It adds the points tables (by day, by month), the ids of sends already counted, and the list of firsts.
3. `farm_rank_add_v1` adds points, up to each kind's daily limit; `farm_rank_board_v1` gives the Top 100 and your month.
4. `farm_hall_v1` gives every plaque's names (records come from the Biggest catch and Derby boards already there);
   `farm_hall_first_v1` claims a first (first come wins, only firsts on the list).
5. The undo is at the bottom of the file. Tested on a local Postgres (test/sql/rank-checks.sql, run by test/sql/run.sh).

## Art that would make it nicer

The hall is drawn by the game for now (plaques, board, pedestals, cups, the carpet); the hunting plaques already use
the trophy pictures from the furniture. Real pictures would replace them one by one:

1. `hall/plaque.png` (1 tile wide, 1.5 tall): a dark wooden wall plaque with a gold frame and an empty cream name plate.
2. `hall/board.png` (2 x 1.2 tiles): a green felt notice board with a gold frame and "TOWN RANK" carved at the top.
3. `hall/pedestal.png` (1 x 1.3 tiles) and a wide one (1.3 x 1.3): white marble pedestals with a gold rim.
4. `hall/cup_gold.png`, `hall/cup_silver.png`, `hall/cup_champion.png`: trophy cups (the champion one purple and gold).
5. `hall/carpet.png`: a red carpet runner with gold edges, seamless top to bottom.
6. Rank badges (prompt 93 in art-src/PLACES-1-5-PROMPTS.md, the medal frames) for Bronze, Silver, Gold and Champion,
   to replace the round coloured badge by names and on the Town Rank page.
7. A wall banner or two for the back wall (trophy and medal pictures, no words), and tall arched windows.
