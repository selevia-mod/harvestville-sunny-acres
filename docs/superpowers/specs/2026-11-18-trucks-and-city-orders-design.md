# Truck plan steps 2 and 3: barangay City Orders and the trucks (owner, 18 Nov 2026)

Owner approved (Phase E): "11, yes" (vehicles: pickup 300 crops, 10 Market Stars + 150,000 Gold; farm truck 800, 30 Stars
+ 600,000; big truck 1,500, 60 Stars + 1,500,000; each also some materials), "12, Barangay" (shared City Orders are filled
by the player's barangay, the game's neighbourhood group), machines later in their own step. Builds on step 1 (the Grand
Market, contracts, Market Stars, the horse cart, Mang Kardo's trips: src/*grand-market*.js). Ships only after the 2.7.0
store build is approved.

## 1. The trucks (Bram's Forge, next to the horse cart row)
| Vehicle | Carries | Needs | Cost (decided by me where not given) |
|---|---|---|---|
| Horse cart (built) | 100 | the horse | 20,000G + 60 lumber + 10 copper ore + 3 Farm Cement |
| Pickup | 300 | 10 Market Stars | 150,000G + 80 lumber + 15 silver ore + 6 Farm Cement + 4 Rope |
| Farm truck | 800 | 30 Market Stars | 600,000G + 120 lumber + 15 gold ore + 12 Farm Cement + 8 Rope |
| Big truck | 1,500 | 60 Market Stars | 1,500,000G + 200 lumber + 20 gold ore + 20 Farm Cement + 12 Rope + 10 obsidian |
- Market Stars are a THRESHOLD (you must have earned that many), not spent.
- One vehicle in use: building a bigger one replaces the cart/smaller vehicle as the farm's vehicle (the old one is
  kept as owned, and you can switch in its panel; cargo moves with you, never lost: if the smaller one can't hold the
  cargo, the extra stays in the bigger one until unloaded).
- Trucks need NO horse: "Drive it yourself" puts you in the truck by the valley road to Manila's Grand Market (same
  road, same Plains crossing when open), parked at the market's loading bay; Mang Kardo can also take any vehicle
  (his fee as now; Manila Friends' 5% at 8 hearts still applies).
- The same loading panel (from the Silo, from the bag, unload) with the vehicle's capacity.
- Art: none yet (the owner draws vehicles tomorrow): draw stand-ins in code like the cart (side/front/back, loaded/empty).

## 2. Barangay City Orders (weekly, shared)
- Each **barangay** (the game's hood / bayanihan group: src/*bayanihan*.js, src/*social*.js, server farm.hoods) gets one
  **City Order a week** (Monday 8 AM Manila to Sunday 7 PM, the raids' and Tower board's week code): about **600 crops
  per 5 members** (scaled by members, decided by me), **4 kinds** from the board's farm crops, from the week and the
  barangay's id (same for every member).
- Members deliver from their vehicle's cargo at the Grand Market (or by Mang Kardo) into the shared order; progress is
  shared through the server: WRITE `supabase/farm_city_orders.sql` (table, RPCs: get this week's order for my
  barangay, deliver n of a crop (server checks the week and caps at what is still needed), claim) with RLS and grants
  like the other farm_*_v1 files. Do NOT apply it; the owner applies SQL. Until applied: the board shows "City Orders
  open soon" and nothing is taken.
- Pay: each delivery pays the deliverer **2x sell** at once (about double, as approved); when the whole order is
  filled, every member who delivered gets **+3 Market Stars** and the barangay's first finished order gives each of them
  a house trophy (a "City Order" plaque, appended to the house types).
- A player with no barangay sees the order board explain how to join one.

## Rules
Nothing already in the game changes for players. Saves: vehicles owned and the active vehicle go into the existing `gm`
key (append parts; never reorder); the week's local delivery record too; old saves load unchanged; generation stays 3;
the save fuzz covers building, switching, loading and delivering on its own random stream. First-time tours: "Trucks"
and "City Orders" (the owner's art where it exists: grand_market, npc_aling_rosa, npc_mang_kardo). Pop-ups centred.
Page size: dev builds with HV_PAGE_LIMIT; keep code compact.
