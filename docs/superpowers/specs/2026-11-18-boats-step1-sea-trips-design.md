# Manila Bay boats, step 1: deep-sea fishing trips (owner, 18 Nov 2026)

The owner's answers to docs/manila-boats-plan.md: the five ideas one step at a time, in my order (1 sea trips, 2 sunset
cruise, 3 islands, 4 your own boat, 5 bay events); tickets first, a yacht later; friends can ride together; riding costs
no energy, fishing costs what it costs today. Owner: "how can we make this boat ideas turn into something useful":
answered by the uses below, approved ("Yes, write the step 1 plan"). Nothing here is built until the owner approves this
plan. It ships only after the 2.7.0 store build is approved, and never by OTA without the owner's word.

## Why it matters (what the sea gives that nothing else does)
Fishing today: 4 river fish (Small, Medium, Large, King Trout), one dish (Grilled Fish, +45 energy), sold or given as gifts.
The sea adds:
1. **Food with power.** Five sea dishes in the Kitchen: more energy, and some give a short power (the existing ones:
   'charge' a charge hurts half, 'walk' 20% faster, 'shots' cost no energy), for the hunting grounds, the Tower and the
   deep mine. Never an energy cost added anywhere (owner's rule).
2. **Things only the sea has.** Seaweed (the Mixer makes Sea Fertilizer: the best Silver and Gold crop odds in the game)
   and Capiz Shells (sold, loved as gifts by Manila Friends, and kept for the island and yacht furniture of later steps).
   ("Pearls" is taken: the Lost Tower's Pearls. So the sea's shell is the Capiz Shell.)
3. **Money.** Sea fish sell better than river fish, and the Talipapa's fish vendor buys them.
4. **Friends.** Up to 4 on one boat; the more aboard, the better the catch for everyone; a trip together adds friendship.
5. **A goal.** The Marlin, the sea's boss fish: a medal, the Biggest catch board, "first to catch" on the Hall of Fame.
6. **Manila Friends.** Kapitana Marisol asks for sea fish; her hearts give better spots and, later, a free ticket a day.

## 1. The trip
- **Where:** Manila's pier, berth 1: Kapitana Marisol's fishing boat (the berth's sign changes from "coming soon").
- **Needs:** a fishing rod (any), Manila open. **Ticket: 3,000 Gold** a trip (decided by me), bought from Marisol.
- **How long:** **10 real minutes** at sea; a bell at 1 minute left; then the boat comes back to the pier by itself.
  Leaving early (the "Back to the pier" button) keeps every fish caught. Closing the game mid-trip keeps the catch (saved
  as you go); the trip ends.
- **The map:** its own small map: the boat's deck (walkable, about 14 x 8 tiles) on open water, the city skyline far off.
  **4 fishing spots** (bubbles and diving birds) round the boat; each moves every 90 seconds, so you walk the deck to them.
- **Fishing:** the same cast and the same mini game as today (C.FISH_GAME), the same **2 energy a cast** (C.FISH_ENERGY).
  Riding the boat costs nothing.

## 2. The sea fish (6, plus the Marlin)
| Fish | Chance a bite | Sells | Mini game |
|---|---|---|---|
| Galunggong (round scad) | 30% | 80 | easy |
| Pusit (squid) | 20% | 120 | easy |
| Maya-Maya (red snapper) | 18% | 200 | medium |
| Lapu-Lapu (grouper) | 14% | 320 | medium |
| Tanigue (Spanish mackerel) | 11% | 450 | hard |
| Tuna (tambakol) | 7% | 700 | hard |
- Each has a size (kg) like today's fish; the fish book keeps your biggest of each (the list is appended, never reordered).
- **Snags:** 10% of casts bring up **Seaweed** instead (no fish); a clump floating by the deck can be scooped (free).
  After each trip, a crate on the deck has **1-3 Capiz Shells**.

## 3. The Marlin (the boss fish; not a dungeon)
- **At most once a trip**, after the first 5 minutes, a big shadow circles one spot. Cast there: the Marlin bites.
- **The fight:** the same mini game made harder: faster, a smaller zone, and it must be held three times in a row (it
  runs and pulls between). Lose it and it may come back once more that trip.
- **With friends:** everyone aboard can reel; each friend reeling makes the zone a little wider for all.
- **Sells 5,000.** Caught: the **Marlin medal** in the fish book, your weight on the **Biggest catch** board, and the first
  player ever to catch one goes on Manila's **Hall of Fame** ("First Marlin").

## 4. With friends (the hunting grounds' rooms)
- Up to **4 players on one boat**, through the game server's rooms like the hunting places ("Hunting now" lists the boat).
  Each pays their own ticket; the trip's clock is the first player's.
- **The group bonus:** each extra player aboard: +10% chance of the bigger fish for everyone (3 friends: +30%).
- **Friendship:** a trip together gives +1 friendship with each friend aboard (once a day each).
- Offline or alone: the same trip, solo.

## 5. The Kitchen: five sea dishes (ingredients from the farm's own crops)
| Dish | Needs | Gives |
|---|---|---|
| Fried Galunggong | galunggong + rice | +40 energy |
| Adobong Pusit | pusit + garlic + onion | +55 energy; 5 minutes: shots cost no energy |
| Sinigang na Lapu-Lapu | lapu-lapu + tomato + radish | +60 energy; 10 minutes: a charge hurts half |
| Kinilaw na Tuna | tuna + onion + ginger | +70 energy; 10 minutes: you walk 20% faster |
| Inihaw na Marlin | marlin + garlic + sili | +150 energy, and all three powers for 10 minutes |
A power from a dish replaces the same power from another (never adds up), as today.

## 6. Seaweed and Capiz Shells
- **Sea Fertilizer** (Mixer): 3 Seaweed + 1 Fertilizer: a 3x3 patch with the best Silver and Gold crop odds in the game
  (better than Rich Fertilizer).
- **Capiz Shells:** sell 150; loved by Kapitana Marisol and two other Manila Friends; kept for the furniture of steps 3-4.

## 7. Kapitana Marisol (a Manila Friend already)
- New tasks: "Bring me 5 Tanigue", "a Tuna over 20 kg", and so on: hearts as her other tasks.
- **At 6 hearts** (already: a better pier spot) also a 5th fishing spot at sea, nearer the boat.
- **At 8 hearts:** one free ticket a day.

## Rules
- Nothing already in the game changes for players (river fishing, Grilled Fish, the four river fish stay as they are).
- **Save:** a new top-level key from the free list (the save-keys test checks it); the fish book appended; old saves load
  unchanged; save generation stays 3; the save fuzz covers trips, catches, snags and shells on its own random stream.
- **Server:** SQL written for the owner, never applied by me: the boat for "Hunting now" (farm.hunt_maps 'sea'), the sea
  fish for the Biggest catch (farm.catch_kinds) and "First Marlin" (farm.hall_first_keys 'sea_boss'), from
  `node tools/places/server-rows.js sea`. If the game server itself needs a change for the boat's room, I ask before any
  deploy.
- **Page size:** all sea pictures in their own download (a 'sea' pack); the game draws stand-ins until the art comes, as
  for the trucks. The page stays under 19.5 MB.
- **First-time tour:** "Sea Trips" (the boat, the spots, the Marlin, friends). Pop-ups centred. Bottom sheets clear the
  Android buttons.
- **Tests:** unit tests (fish odds, the Marlin's once-a-trip rule, the group bonus, tickets, the 10 minutes, no energy for
  riding, dishes, Sea Fertilizer, save), a browser playthrough (buy a ticket, fish, a snag, the Marlin, back to the pier),
  and the frame time with the CPU slowed 4x. No phone checks unless the owner says a phone is free.

## The art the owner makes (stand-ins until then)
Kapitana Marisol's fishing boat (side and from above, about the jeepney's size), the deck as a map piece, sea water with
waves, 7 fish (icon + a sprite each; the Marlin big), Seaweed and Capiz Shell icons, 5 dish icons, a Sea Fertilizer icon.
Cute, like the hunting grounds. I write the prompts once the plan is approved.

## Numbers (decided by me; the owner can change any)
Ticket 3,000 Gold; trip 10 minutes; 4 spots moving every 90 s; snag 10%; 1-3 shells a trip; Marlin after 5 minutes, at
most once (one retry); group bonus +10% a friend; the fish table and prices above; dish energies above; Sea Fertilizer
3 Seaweed + 1 Fertilizer; Capiz sells 150.

## Later steps (not now)
2 the sunset cruise, 3 island trips, 4 the yacht (no tickets, faster trips, more room, a house trophy), 5 bay events.
