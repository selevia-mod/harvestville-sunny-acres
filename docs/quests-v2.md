# Quests v2: your dog leads the way (owner, 8 Nov 2026)

Owner picks, 8 Nov 2026: option 5 (the dog guide) for the screen, option 2 cut to ONE card for quick access, option 4
(a trail) for the Quests panel's Daily tab, option 3's "!" only for villager requests; "it's always the lead when they
tap"; quests get meaning: (1) a story each week, (2) a reason from a villager on every quest, (3) the dog finds secrets.
"We cannot call it Bantay ... let users name it."

## Phase 1 (e44: Monday 9 Nov)

1. **Your dog's name.** The dog is "Biscuit" for everyone today. A farm asks once ("Your dog needs a name!"), the same
   rules as the farmer's name (16 letters, no rude words: L.cleanName), saved as `dn` (old saves: Biscuit until named).
   Renamed from the Paused card (the birthday line's right: the dog and its name). Friends see it on a visit (snapshot
   `pets.dog`, already sent).
2. **The quest card.** One small card on the left, under the goal banner: the quest's icon, its words, a progress ring
   and "Go". The quest shown: the one you pinned, else the first unfinished daily quest with a place to go. Done: the
   card turns gold, "Tap to claim" (the reward as in the Quests panel), and the next one takes its place.
3. **The dog guide.** "Go" (or a tap on the dog's bubble) = the dog leads: it appears at your side (from its yard on the
   farm; anywhere else it comes running), runs a little ahead along the way, leaving paw prints, and your farmer walks
   after it on their own, through roads and doors to another map (the goal arrow's routes, C.ROUTES). Any touch of the
   joystick stops it at once. There, the dog sits and barks once; nothing is done for you (owner: arriving never acts).
   Now and then, when you stand still, the dog says what to do next in a small bubble ("Arf! Fish are biting at the
   pond."); a tap on it = Go.
   Where each quest leads (by its counter): water, till, plant, harvest: the field; clear: the nearest weed or stone;
   fish: the nearest water's edge; care, collect: the animal pen; pet: the dog's yard; forage: the nearest forage spot;
   talk, gift: the town's fountain (or the nearest villager here); earned: the market stall in town; cooked: the
   house's kitchen; order: the order board; request: the notice board; floor: the mine door. Others (login, decor,
   trade, chests) have no place: no Go.
4. **The quest's reason (owner's idea 2).** Each daily quest says who wants it and why, under its words: "Finn's cat
   is hungry: he asks for fish." The villagers stay the same day long (seeded by the day).
5. **The Daily tab as a trail.** The day's quests as stepping stones on a winding path, done ones green, the next gold,
   the chest at the top (Finish all 10). A tap on a stone: the quest, its reason, Go and Pin.

## Phase 2 (owner approves the first story's villager and lines first)

6. **A story each week.** Every Monday a 7-day story from one villager; each day 3 of the quests are its steps; Sunday
   ends it with something you keep (a sign in town, a recipe, a letter).
7. **The dog finds secrets.** Now and then the dog smells something: it leads you to a buried chest, a rare forage or a
   new fishing spot.
8. **"!" over villagers with a request**, "?" when you have what they asked for.

## Tests
Unit: the dog's name (rules, save), quest places, a path round obstacles, reasons stable for a day. Browser: Go walks
the farmer to the pond on the farm and to the order board in town (through the road), the joystick stops it, the card
turns gold and claims, the trail opens Go and Pin, the name prompt and rename.
