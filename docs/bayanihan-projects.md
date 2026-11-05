# Bayanihan Projects

Your idea from 6 Nov 2026: "Bayani Projects, i like this", and "we are loosing the real purpose of game, the farm and town. We need to make it related to the town."

The whole of Harvest Ville builds Willowbrook together. There is one project at a time. Every player on the server gives to the same project, so there is one progress bar for everyone. When a project is finished, the town changes for every player, a real benefit opens, and everyone who helped gets a reward.

## What players see and do

- **The Bayanihan board** is new in town, on the grass between the plaza and the Woodshop. It has a red "BAYANIHAN" sign, and a green bar under it that shows how far the project is. Walk up and tap **Board**. The same board is a row in **Online > Friends** ("Bayanihan: The Old Bridge"), under the Barangays row.
- The first time the board opens, a short animated tour plays (3 cards).
- **Project tab:** the project and what it is for, how far the whole town has got, and each thing it needs ("Lumber 700/1,500") with a **Give** button. Give asks how many (1, 10 or All). The things leave your bag only after the server says yes. If the network fails, they stay in your bag, and the game asks the server again later with the same request, so a gift is never counted twice and never lost. Below that is your help ("Your help: 25 points", your reward tier) and your barangay's total for this project.
- **Top 10 tab:** the 10 farmers who gave the most to this project (blocked players are left out).
- **Town tab:** all 5 projects (built, building now, or coming later), your titles, and a **Claim** button on each built project you helped with.
- **When a project is built:** a pop-up ("THE OLD BRIDGE IS BUILT! Salamat, Harvest Ville!"), shown once. If you are in town, the change appears on the spot with a sparkle. Other players see it the next time their game checks (every 10 minutes, or when they walk into town).
- **Offline, or not signed in:** the board still shows the project and what it needs, and says "Join online play to help the town." Before part 20 is applied, the board says "Opening soon", the Online row stays hidden, and there are no errors.

## The projects

Numbers are per project, for the whole server. "Points each" is how much one thing counts. "A day" is the most one player can give of that thing per day (days run on Philippine time).

| # | Project | What it needs (how many, points each, most a day) | What changes in town | The benefit | Title and yard piece |
|---|---|---|---|---|---|
| 1 | The Old Bridge | Lumber 1,500 (1, 60), Stone 1,000 (1, 60), Copper Ore 400 (2, 25), Small Fish 300 (2, 15) | A broken footbridge west of the dock (new on the map: a stub on each bank and the river between, with a path to each side) is mended | A shortcut over the river to the lane and the chapel, and a fishing spot on the bridge where bigger fish bite (large fish 30%, King Trout 10%; the river is 20% and 5%) | Bridge Builder, Bayanihan Bench |
| 2 | The Market Hall | Wheat 1,500 (1, 60), Eggs 600 (2, 20), Milk 300 (3, 12), Fresh Bread 200 (4, 8), Silver Ore 200 (3, 10) | A striped roof with a "MARKET HALL" sign over the plaza market stall | Every stall shelf holds 10 more, and every lot sold at the stall pays 10% more | Market Maker, Little Market Stall |
| 3 | The Plaza Fountain | Stone 1,500 (1, 60), Silver Ore 300 (3, 12), Medium Fish 200 (3, 10), Butter 80 (6, 4), Gems 40 (10, 2) | Flower beds on each side of the fountain, and sparkles on the water | A wishing coin at the fountain once a day: a small gift (120 to 300G, fertilizer, a treat or seeds) | Fountain Keeper, Plaza Birdbath |
| 4 | The Chapel Bell | Copper Ore 800 (2, 25), Gold Ore 250 (4, 8), Labuyo Feathers 300 (1, 20), Deer Antlers 60 (5, 3), Strawberry Cake 60 (8, 3) | A bell frame stands beside the chapel from the start; the bell is hung in it | Festival days give more: ring the bell on a festival day for a 500G festival gift, and festival contest prizes pay 25% more | Bell Ringer, Chapel Lantern |
| 5 | The Old Pier | Lumber 2,500 (1, 80), Boar Meat 150 (2, 6), Boar Tusks 80 (4, 3), Large Fish 120 (5, 4), Cheese 60 (6, 3) | The beach pier is built out to the boat | The boatman gives you a fresh catch once a day (2 medium fish and 1 large). The boat is ready to take players to island hunting places later (there is a hook for it in the code) | Pier Captain, Little Bangka |

Every project asks for things from different parts of the game: crops, animal goods, workshop goods, fish, ore from the mine, lumber and stone, and hunted things.

**Rewards** (claimed once each, from the board's Town tab), by the points you gave to that project:

| Tier | Points you gave | Gold | Also |
|---|---|---|---|
| Helper | any gift (1+) | 300G | the title and the yard piece |
| Builder | 150+ | 1,000G | the title and the yard piece |
| Hero | 500+ | 2,500G | the title and the yard piece |

A player can give at most 800 points to one project, so nobody can flood it alone.

## Numbers you can change

The real numbers are on the server, so you can change them any time with plain SQL. Gifts already made keep what they counted.

- What a project needs: `update farm.bh_needs set goal = 2000 where project = 'bridge' and item = 'lumber';` (also `pts` = points each, `day_max` = most a day)
- One player's most points per project, the tiers and their Gold: `update farm.bh_projects set cap = 1000, tier2 = 200, tier3 = 600, gold1 = 300, gold2 = 1200, gold3 = 3000 where key = 'market';`
- The board reads these numbers from the server, so players see your changes. The game file `src/00-zzzzzzzzzzz-bayanihan.js` has the same starting numbers, used only for the offline board. If you change the server a lot, ask for the game file to be updated too.
- In the game file (an OTA is needed to change these): the Market Hall's +10 per shelf and +10% (`hallShelf`, `hallPay`), the wishing coin's gifts (`wish`), the bell's 500G (`bellGold`) and +25% (`contestPay`), the boatman's catch (`boat`), the bridge's fish chances (`C.FISH_TABLE.bridge`), and the most the Give box offers in one tap (`pickMost`, 50).

## What the SQL does (supabase/farm_online_20.sql)

1. Adds six new tables in the `farm` schema (the projects, what each needs, every gift with its request id, each player's total, each barangay's total, claimed rewards). They have row-level security on and no policies, so only the three new functions can use them. Nothing that already exists is changed.
2. Fills in the 5 projects and their needs. It is safe to run twice: a second run keeps your tuned numbers and the progress.
3. `farm_project_state_v1()` gives the board everything it shows. `farm_project_give_v1(item, n, request id, project)` takes a gift, but no more than the need, the player's daily limit and the player's 800-point limit allow. A repeated request gets its first answer back and is counted once. The last gift marks the project done and starts the next one.
4. `farm_project_claim_v1(project)` gives each player's reward once (the Gold amount comes from the server, never from the game). Guests, and banned or suspended accounts, cannot give or claim. Nothing uses Coins or Stars.
5. Run it AFTER part 19 (it needs part 16's barangays). It was tested twice in a row on a throwaway local database (`test/sql/bayanihan-checks.sql`). The undo block is at the bottom of the file.

## Art that would make it nicer

Everything below is a drawn stand-in today. A picture of the same size can replace each one.

- **The Bayanihan board** (2 x 2 tiles): it uses the order board's picture with a red "BAYANIHAN" text sign. A board of its own would look better: a bamboo frame with a woven banner and a little progress bar painted on.
- **The broken Old Bridge** (1 x 2 tiles over the water): drawn posts and a floating plank. Nicer would be a painted broken footbridge and a repaired one (bamboo rails, rope), so the mended bridge is more than plain planks.
- **The Market Hall roof** (about 5 x 3 tiles over the stall): a drawn striped awning with a sign. A painted open-air market hall (wooden posts, a nipa or tin roof, hanging baskets) would be much better.
- **The Plaza Fountain**: today it gets flower beds and sparkles. A "before" (dry, cracked) and "after" (repaired, lit at night) fountain pair would show the change best.
- **The Chapel Bell** (1 x 2 tiles): a drawn wooden frame and a bell. A painted belfry (kampanaryo) with a bronze bell.
- **The Old Pier**: uses the dock tiles and the boat already on the beach. A painted bangka with outriggers, and a boatman villager (for the island trips later).
- **Icons**: a "Bayanihan" icon for the Online row and the tour (today it uses the project's item icons), and title badges for the 5 titles.
- **The 5 reward yard pieces** reuse existing pictures (bench, fruit stall, birdbath, lantern, boat). Their own pictures would make them special: a bridge-plank bench, a mini market hall, a mini fountain, a small bell post, a little bangka.

## Good to know

- The weekly **Town Goal** (Online > Town, part 12) is still there. It is a different thing: a weekly target with a prize, which does not change the town. You may want to keep both, or retire the Town Goal later so players are not confused.
- Titles show on the board (Town tab: "Your titles"). They do not show over the farmer's head or in other players' lists yet. That could be a next step.
- Lumber and stone can be bought with Gold at Mira's, so a player can buy them to give. That uses in-game Gold only (no Coins or Stars), and the daily and per-project limits still apply.
