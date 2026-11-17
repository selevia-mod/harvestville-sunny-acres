# Grand Market and the horse cart: step 1 of the truck plan (owner, 18 Nov 2026)

Owner, 13 Nov 2026: trucks, a harvester and farm machines; load the harvest, carry it to Manila's Grand Market and sell
it in bulk; the stand stays small selling. Owner, 18 Nov 2026: "Lets proceed to truck idea for a better planting"; my 5
answers approved ("Yes, okay"): selling first (machines later); drive it yourself or send a driver; daily-changing
prices; shared City Orders later. Answer 3 changed with the owner's OK ("Okay"): the town stall stays exactly as it is
(nothing already in the game changes); the Grand Market simply pays better for big loads.

Ships only after the 2.7.0 store build is approved. Branch manila/grand-market (game repo).

## What the player gets

1. **Aling Rosa's Grand Market** (Manila, the Grand Market building; Aling Rosa is `C.MANILA.people.rosa`). The
   decorative `order_board` prop next to it becomes the **price board**. "Coming soon" goes away from the market only
   (the Trading Post stays "Coming soon").
2. **The price board, new every day, the same for every player:** each farm crop (`L.isFarmCrop`) has today's price,
   its sell price x a multiplier from 1.1 to 1.6, worked out from the game day and the crop's key (a fixed hash, no
   randomness, no server needed). **3 hot crops a day** pay 1.6 to 1.8 (also from the day). The board shows every crop's
   multiplier, the hot crops on top. Quality crops (Silver, Gold) use `L.qualityPrice` x the day's multiplier.
3. **Bulk only, by cart only:** the Grand Market buys a load of **at least 50 of one crop**, and only from a **cart's
   cargo**. (The bag already carries 999 a slot: by cart only, the cart is what makes the trip worth it. The bag keeps
   the town stall, orders, requests and station crates, all unchanged.)
4. **3 contracts a day** on the board (per player, from the day and the player's own seed): "200 Corn in 48 hours" style,
   100 to 200 of one crop, paying 1.7x sell (quality crops count as plain for contracts), filled from cart cargo, in one
   or several deliveries until the deadline. Each finished contract gives **1 Market Star** (a counter for later steps:
   Market Stars buy the bigger vehicles). An unfinished contract simply ends at its deadline; nothing is taken.
5. **The horse cart**, made at **Bram's Forge** (a new row, the existing Forge `withRows` pattern; recipe with
   `L.hasNeeds` / `L.takeNeeds`): 20,000 Gold, 60 lumber, 10 copper ore, 3 Farm Cement (decided by me; the owner can
   change: the new things are priced to be a challenge, owner 18 Nov 2026). Needs the Stable's horse. One cart a farm.
   **It carries 100 crops** (any mix). It stands by the Stable on the farm.
6. **Loading:** tap the cart on the farm: load crops **from the Silo** (`L.siloTake`) or **from the bag** (farm crops
   only), unload back (into the Silo first, then the bag; never lost: if neither has room it stays in the cart).
7. **Two ways to Manila with a loaded cart:**
   - **Drive it yourself:** ride the horse with the cart to Manila by the valley road (the town's east end, the Plains
     Gate). This needs the horse road rules: `C.MANILA.horseRoad` on and `L.horseRoadOk` written for real (today it is
     not defined): the horse at **6 hearts** (`C.MANILA.horseHearts`) and its **Horseshoes** (economy v2 part 5's rule
     outside the farm and town). The horse and cart may go into Manila (the horse zones in
     src/01-logicZZZZZZZZZZZZZZ-horse.js); at the Grand Market, "Sell" and "Deliver" open from the cart. Riding the
     road uses the horse's stamina as any ride.
   - **Send Mang Kardo** (`npc_mang_kardo`, already in the city's people): from the cart on the farm, "Send to the
     Grand Market": he takes the load, it sells at the price board of the moment he left (or fills the chosen
     contract), and the gold arrives **30 real minutes later** minus **his fee, 10% of the sale**, with a message. The
     cart is away (can't be loaded) until he is back. Needs nothing from the horse (he drives).
8. **A first-time tour** for the Grand Market's board and for the cart (the existing tour pattern; the owner's art:
   grand_market.png, npc_aling_rosa.png, npc_mang_kardo.png; the cart itself is drawn by the game until its picture
   comes, as the city's other stand-ins). Pop-ups centred.

## Numbers (decided by me; the owner can change)
- Market multiplier 1.1-1.6, hot 1.6-1.8, contract 1.7, minimum load 50, cart 100, driver fee 10%, driver 30 minutes,
  cart 20,000G + 60 lumber + 10 copper ore + 3 Farm Cement.
- A full cart of corn (sell 18): 100 x 18 x 1.1-1.8 = 1,980-3,240 Gold. Good for newer and middle players; the bigger
  vehicles later carry 300 / 800 / 1,500 for the top players.

## Save
- One new top-level key **`gm`** (unused; every key is listed in the 18 Nov map): `[cart owned 0/1, cargo {crop: n},
  the driver's trip or null {at, cargo, price per crop or contract id}, contracts of the day, Market Stars, tours seen]`.
  Appended only; an old save has no `gm` (no cart). Cargo and a driver's trip are never lost: a load that cannot go
  anywhere stays in the cart; a trip that cannot finish (the game was closed) finishes on the next open by the clock.
- Save generation stays 3 (this whole release is generation 3: an older game cannot write over it).
- The save guard and the stress test cover it: add the cart and its cargo to test/save-roundtrip-fuzz.test.js's random
  actions, and the cargo to the old-saves "owns" count only if it is new (old saves have none).

## Out of scope (later steps)
Shared City Orders with friends; pickup (300), farm truck (800), big truck (1,500) bought with Market Stars and gold;
the seeder, harvester and tractor; the Trading Post.
