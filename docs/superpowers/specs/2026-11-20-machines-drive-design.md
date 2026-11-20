# Farm machines you drive (owner, 20 Nov 2026)

Owner, 19 Nov 2026: "Make the harvester or other machine to make it realistic, like a real harvester in real world."
Owner picked "A. You drive it". **APPROVED by the owner, 20 Nov 2026: "Yes approve, give me the 6 prompts".**
Mock-up shown first (made in the real game): ~/Documents/machines-realistic-2026-11-19/2-mockup-drive-it.png.
Ships only after the 2.7.0 store build is approved, never by OTA without the owner's word.

Today (src/*machines*.js): held in a bag slot, the machine stands small in front of the farmer; a tap jolts it forward
once and works the 3x3 ahead (held: a row of 9). This replaces that with driving.

## 1. Getting in and out
- Your own farm only (as today). Hold the machine in the bag on the farm: the action button says **Get in**. The machine
  appears where you stand, about **3 tiles long** (side view); the farmer is in its seat (the Tractor, the Harvester) or
  walks behind it holding the handle (the Seeder is a push planter: realistic).
- **Get out** (the action button while driving): it parks back into the bag. Leaving the farm, opening a door, a
  visit or a raid: you get out first, on your own.

## 2. Driving
- The joystick steers it, slower than walking: Harvester 0.6x, Tractor 0.8x, Seeder 0.85x (decided by me).
- It cannot go through fences, buildings, trees, stumps, boulders or water (the farmer's own walls); it turns in 4
  directions. Side pictures left/right (the owner's, facing right, mirrored); up/down use the owner's 6 new front/back
  pictures (art below); until they come the side picture stands in.

## 3. Working as it drives
- Each machine works a **3-tile strip** under its front edge, across its way (the 3 tiles side by side that its front
  passes over), each tile once as it passes, through the same world actions as today (the counts, crop stars, skills
  and Double Drops the same):
  - **Harvester:** picks every ripe crop into its **tank** (not straight to the Silo). Sickle crops as today: left.
  - **Tractor:** tills, and clears weeds, branches and stones on its way (L.mkTill); stumps and boulders stop it.
  - **Seeder:** plants the seed packet held last, one seed a tile, until the packet runs out ("Out of seeds").
- **It never crushes a crop:** it rolls over unripe crops, sprinklers' tiles and paths without changing them.
- **Energy:** as today (8 tiles' worth for 9 by hand; picking and planting free). No fuel (owner's rule: never an
  energy tax).

## 4. The Harvester's tank
- Holds **60 crops** (decided by me). Full: it stops cutting and says "Tank full: drive to the Silo".
- Next to the Silo: **Unload** (the action button) empties it into the Silo (what does not fit stays in the tank).
- The tank is saved (a new top-level save key from the free list; the save-keys test checks it): never lost, whatever
  happens (closing the game mid-field, getting out, a raid).

## 5. The feel
A rumble as it drives (a small bob), dust behind the Tractor, cut straw behind the Harvester, seeds dropping from the
Seeder, an engine sound (the Seeder: wheels only). Drawn only while on the screen. A tank meter on the Harvester's chip.

## 6. Rules
- Nothing else changes for players. Old saves load unchanged; save generation stays 3; the save fuzz covers getting
  in/out, driving, the tank and unloading on its own random stream.
- First-time tour "DRIVING MACHINES" with the owner's machine pictures, centred.
- Online: a friend visiting your farm sees you on foot (machines are your own farm's, as today).
- Frame time with the CPU slowed 4x, against the 13-14 ms budget; the page stays under 19.5 MiB (the new pictures go in
  the 'vehicles' pack).
- Tests: unit (the strip, the tank, unloading, never crushing, energy, save) and a browser playthrough of each machine.
  No phone checks unless the owner says a phone is free.

## Art (the owner makes it): 6 pictures
Front and back of each machine, 1024x1024, 30-degree camera, no driver:
~/Documents/machines-realistic-2026-11-19/MACHINES-FRONT-BACK-PROMPTS.md (copy: art-src/MACHINES-FRONT-BACK-PROMPTS.md).

## Built (20 Nov 2026, branch manila/machines-drive, worktree ~/Documents/hv-drive): what I decided while building
- The owner's 6 front/back pictures came the same day ("check this and start building"); checked (see-through, same
  machines and colours as the side pictures) and cut into the 'vehicles' pack: machine_<kind>_<side|front|back>, at
  C.MACHINES.drive's widths (side 2.8 / 2.4 / 3.4 tiles; front and back 2.2 / 1.9 / 3.0).
- Where each works, realistic: the Harvester's header in front; the Tractor pushes weeds, branches and stones aside at
  its nose and tills with its plough behind (the plough is at its back in the owner's picture); the Seeder's drills under
  its hopper. Still a 3-tile strip each.
- The Seeder's button says Push / Let go (the Tractor and Harvester: Get in / Get out).
- Seeds: a packet plants 9 tiles from the Seeder, as a packet does by hand (the 3x3), so driving never costs more seeds.
  It plants only the packet held last; when that runs out it stops and says "Out of <seeds>" (no other crop mid-row).
- The tank: a tile is cut only with room for all it can give (6, as the Silo's rule), so it reads "Tank full" from 55.
  Saved (key mkt) when you get out, unload, travel, and by the game's own autosave.
- The Tractor's energy is paid as it goes: 8/9 of the hand's over the whole drive (a point carried between strips).
- Machines only turn in 4 directions (no sideways crab), and stop when the nose meets a wall.
