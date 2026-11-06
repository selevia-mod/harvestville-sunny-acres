# Harvest Ville: the big update, ready for your check (built 6 Nov 2026)

You asked: "Finish all the one we talk earlier ... i will check all tomorrow." Everything is built and tested on the
computer. **Nothing is pushed**, and nothing has been tried on a phone yet (both phones were in use).

## What's in it

| # | Feature | Where to find it | What the player does |
|---|---|---|---|
| 14 | **Central Park** | In town, up the path north of the Station (flower arch, "CENTRAL PARK" sign) | One park for everyone. Park 1, 2 and 3 hold 30 each, with a chip to switch. Meet people, chat and wave. The map is 40 × 34 with a fountain plaza, pond, picnic lawn, stage and playground. |
| 10 | **Hall of Fame** (your museum idea) | The big building at the top of Central Park | Plaques with the names of the biggest catch of each animal, Derby records, the first to beat each boss, and the Town Rank champions. "That's you!" appears on your own. |
| — | **5 new hunting places** | Kanor's Jeep, by his Lodge in Pulag | Banaue Terraces (60 hunts), Chocolate Hills (80), Taal Lake (100), Sierra Madre (130), Palawan Underground River (160). Each has 3 animals, a local friend with a 4-step story and gifts, and 5 hidden chests. |
| 7 | **A dungeon in each place** | The cave door in each place | 10 floors, a guard on floor 5 and a boss on floor 10 you can beat alone. The boss gets bigger with friends. The boss chest comes once a day and saves up to 3. |
| 2 | **Gear** | Kanor's Lodge, Make tab; Bag → Gear | One 4-piece set per place, working only in its own place and dungeon. Head and Feet take 1 energy off each monster hit, Body and Charm take 2, and a full set takes 2 more. A hit never drops below a third, and the old Fire Charm works only from Pulag to the Lair (7 Nov balance). |
| 3 | **Taming** | A young animal in each place | Feed it its favourite food about 8–10 times; it may run off and come back. It then follows you and helps (fetches drops or spots rares). |
| 4 | **Medals** | Pause → farmer card → Medals; also on a friend's card | Medals for your first hunt, each animal, the rare one, the guard, the boss, the tame, all chests and the story, shown as silhouettes until earned. |
| 9 | **Bayanihan Projects** | The board by the plaza (and Online → Friends) | The whole server builds one project at a time: the Old Bridge, Market Hall, Plaza Fountain, Chapel Bell and Old Pier. The town changes for everyone, and each project gives a real benefit. Rewards: Helper 300G, Builder 1,000G, Hero 2,500G, plus a title and a yard piece. |
| 11 | **Town Raid** (instead of the World Boss) | Your own farm, Monday and Thursday 8:00–8:30 PM | Raiders hit your crops: boars, crows, sparks or typhoon debris. Everyone online fills one town bar. Chests come at 10, 80 and 200 hits, and a town win gives everyone Double Drops until the next midnight. A raid takes 2 crops at most. |
| 12 | **Town Rank** | Online → Ranks → Town Rank; the farmer card | Points from farming, cooking, fishing, mining, hunting and helping, each with a daily cap. Bronze 300, Silver 2,000, Gold 8,000, Champion 20,000 a month. The reward is a title and a badge colour only, and it resets on the 1st. |
| 13 | **Villager stories** | Talk to villagers; Pause → Friends (now the Friendship Book) | A story for each of the 23 villagers at 2, 4, 6 and 8 hearts. What you answer changes the outcome. Rewards: recipes, seeds, decor, photos, friend discounts, and a secret at 8 hearts. |
| — | **Fixes from tonight** | — | Hunting together: friends no longer appear as a floating bow and no longer freeze. Kanor and Tita Luz stay open. A long chat line now shows in full. You can't get stuck in the Lair's wall. Costumes no longer download again. |

Not done, as you decided: monster cards (no), the World Boss (Town Raid replaces it), Hunter Rank (Town Rank replaces it).

**Boss difficulty** goes up place by place: Amomongo 30 → Great Nuno 34 → Berberoka 40 → Kapre 41 → Minokawa 42
(health alone), all still below the Lair's deep floors.

## Before it can go out (in this order)

1. **Read and change the notes if you like.** The app's What's New is drafted for e30 and is staff-only. The game's What's New 2.4 has 11 lines.
2. **Apply the SQL**, one file at a time, in the Supabase SQL editor. Each is safe to run twice. After each one, I check it read-only on the server.
   - `supabase/farm_online_19.sql`: Central Park, the 3 parks of 30.
   - `supabase/farm_online_20.sql`: Bayanihan Projects.
   - `supabase/farm_online_21.sql`: Town Raid.
   - `supabase/farm_online_22.sql`: Town Rank and the Hall of Fame.
   - `supabase/farm_online_23.sql` (added 7 Nov): every new place on the server. "Hunting now" shows the real place,
     the Biggest catch has the new animals, and the Hall of Fame has a "first to beat" for the 5 new bosses.
   - The server already has every older part these need (I checked: parts 14, 15, 16 and 18).
3. **Upload two downloads to the CDN**, to `app-assets/packs/`. I can upload them on your word.
   - **Furniture styles:** 45 files (2.4 MB). To make room on the page, the 9 furniture styles and their sleeping
     pictures now download when first needed. Until the files are on the CDN, players with a style see the Classic look.
   - **Hunting places:** 126 files (5.8 MB), your 94 pictures cut for the game: the people, animals, dungeons, props and
     ground of the 5 places. It downloads by itself like the others, and the Jeep asks for it before your first trip.
     Pulag and the Wild Lands download did not change, so nobody downloads it again.
4. **Phone test** on the OPPO and the iPhone, when they're free.
5. **Push e30** on your word.

## Art

Your 94 pictures are in (7 Nov), all but one:
- **Siyokoy** (Taal Crater) came out with a fake grey checkerboard painted behind it, so it still uses its stand-in.
  One new picture fixes it: `places/taal/wild_siyokoy.png`, same prompt (number 50), on a see-through or magenta background.
- **The ground pictures** came out photo-style, so in the game they look a bit darker and busier than the cartoon
  props (most of all Banaue's paddies and the Chocolate Hills river). They work; redo them in the cartoon style if you
  don't like them.
- **The jeep stop sign and the medal frames** are not used yet. The places keep their wooden signs, and the medals
  keep their drawn frames.

Each feature's doc lists the extra art that would make it nicer:
- `docs/bayanihan-projects.md`
- `docs/town-raid.md`
- `docs/town-rank-and-hall-of-fame.md`
- `docs/places/*.md`

## Tests

- **Unit tests:** 552/552.
- **Server SQL checks** on a throwaway database: 550+, every part run twice.
- **App tests:** release and Harvest Ville, 881/881.
- **Every feature has its own play-through test.** Some fail only when the computer is overloaded and pass when run alone.

## Things to know

- **Town Raid:** friends see different raiders on each phone; only the town bar is shared. This keeps the server cost tiny.
- **"Firsts" in the Hall of Fame** are claimed by the phone; the server only makes sure the first one wins.
- **"Hunting now" and "Biggest catch"** know every place once part 23 is in. A future place's server rows come from
  `node tools/places/server-rows.js <place>`, so nobody types them by hand.
- **Central Park load:** moves are sent once a second, and only while walking. Even 3 full parks stay well under the server's message limit.
- **Hall of Fame and the park seat:** going inside the Hall gives up your park seat, and coming out asks for one again.
- **Not checked on a phone yet.**
