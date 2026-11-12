# Name frames (owner, 13 Nov 2026: "lets build it"; in the game only)

## What
- **First in Selebox**: the first player ever to beat each of the Tower's 10 big bosses (floors 100, 200 ... 1000) gets
  that boss's frame, forever. Only one player can ever have each (the Hall's firsts: `farm.hall_firsts`, keys
  `tower_100` ... `tower_1000`, already live and applied).
- **The weekly Lighthouse Board**: places 1, 2, 3 of last week get a gold, silver or bronze frame for this week (Monday to
  Monday, Manila time). Place 1 also has the title "Lighthouse Champion" for the week. (The weekly claim already keeps
  `frame` and `title`: `farm.tower_week_claims`, live and applied.)
- A player with several frames wears, by default: this week's board frame if any, else their newest boss frame. They
  can pick another of theirs (or none) on a small "My frame" page (from the farmer card / Hall of Fame).

## Where it shows (the game only; not the Selebox profile or comments)
- around the name over the head of other players (online rooms: pub, hunting places, caves, the Tower with friends,
  visits) and over your own head when others are near;
- on the farmer card (a player's card from the online list / visit);
- on the Lighthouse Board rows and the lighthouse wall (First in Selebox), and the Hall of Fame list;
- "Lighthouse Champion" under the name, small, gold, for the week.

## Trust (no faking)
A frame is never taken from what another phone says about itself (presence can be faked). Each phone asks the server:
new SQL (written for the owner to apply, additive and safe twice, with an undo block, like the board's):
- `farm.player_frames_choice (user_id uuid primary key, frame text, at timestamptz)`: the frame a player picked
  (`'auto'` / `'none'` / a frame key they own), RLS on, players cannot read or write it directly;
- `farm_frames_v1(p_ids uuid[])` (security definer, players only, empty search_path, at most 60 ids a call): for each id,
  `{ id, frame, title }`: the frame they wear now (their choice if they still own it, else auto) and the title;
  owned = their tower firsts (`farm.hall_firsts`) + last week's claim (`farm.tower_week_claims`, the week before this
  Manila week);
- `farm_frames_mine_v1()`: the frames I own and my pick; `farm_frame_pick_v1(p_frame text)`: set my pick (must own it).
Phones cache answers 10 minutes; a new player in the room is asked for once (batched).

## Pictures (prompts for the owner; drawn stand-ins until they come)
13 frames, each a ring around a name plate: 10 boss frames (each in its realm's look: the crab's barnacle stone, the
octopus's violet tentacles ... the Bakunawa's white-gold moons), gold, silver, bronze. One sheet, 4 x 4 cells
(13 used), transparent. Stand-in until then: a rounded plate in the realm's colour (or metal) with a thin bright rim.

## Tests
Unit: the pick rules (auto order, a frame no longer owned falls back, none); the cache; the batch of ids. SQL file
test (like the board's): additive, safe twice, definer + empty search_path, players only, undo at the bottom.
Browser: a fake server answering frames; two players in a room, one with a gold frame and the title: the frame round the
name over the head, the title under it; the farmer card; the board rows; picking another frame.
