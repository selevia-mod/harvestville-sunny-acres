# Harvest Ville: Bakunawa's Lair art (owner, 4 Nov 2026)

A dungeon under Magayon Peaks: floors of lava caves and fire creatures from Filipino legend, drawn cute (docs/lair-design.md).
Until these come the game uses stand-ins: each creature borrows another animal's picture with a colour over it, and the
8 icons are drawn by tools/art/lair-icons.js. Make each picture with its prompt and save it in **`art-src/lair/`** with the
file name shown (the furniture one in `art-src/furniture/`; the Fire look's six with the other looks, in
~/Documents/harvest-hat-art). Send them in a zip like before; the names are all that matter.

Tips: 1024x1536 is tall, 1536x1024 is wide, the rest are square 1024x1024. If the background comes out magenta or white
instead of see-through, that's okay too. The creatures must all come together (the game counts them in this order).

| # | File | Size | Goes in with |
|---|---|---|---|
| 1 | wild_santelmo.png | 1024x1536 | `node tools/art/animals3q-import.js`, then drop `sheetRow`/`tint` in src/00-zzzzzzlair.js |
| 2 | wild_sigbin.png | 1024x1536 | same |
| 3 | wild_tikbalang.png | 1024x1536 | same |
| 4 | wild_bungisngis.png | 1024x1536 | same |
| 5 | wild_bakunawa.png | 1024x1536 | same |
| 6 | icons_lair.png | 1024x1024 | `node tools/art/lair-import.js` |
| 7 | lair_mouth.png | 1024x1024 | importer to come (drawn by the game today) |
| 8 | lair_gate.png | 1536x1024 | importer to come (drawn by the game today) |
| 9-12 | cave_floor.png, cave_lava.png, cave_rock_top.png, cave_rock_face.png | 1024x1024 | importer to come (the game repaints the Mine's cave tiles today) |
| 13 | furniture/volcano.png | 1024x1024 | importer to come (5 new pieces) |
| 14-19 | fire-boy-walk.png ... fire-girl-archer.png | as the other looks | the looks cutter, then `node tools/art/tailor-import.js` (add 'fire' to LOOKS) |

## The creatures (12 poses each, like every wild animal)

The same sheet as the Wild Lands and Magayon animals (tools/art/animals3q-import.js): 3 columns x 4 rows. Rows 1-3 are
walking toward you, away from you and to the LEFT (stand, step, step; the game flips the left ones for right). Row 4 is
special: column 1 faces you (it looks up when you come near), column 2 is its idle pose facing left (eating, resting),
column 3 is it running or charging to the left (it swaps with the step pose while it runs; for the Santelmo, its flight).

### 1. `wild_santelmo.png` (1024x1536, tall)
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN at the creature from above at about 45 degrees, so you always see the top of its back and head as well as its body, exactly like the farmer character in the same game. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The same creature in every cell: identical design, colors, size and proportions, standing on the same invisible ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. The creature: a Santelmo, a small friendly floating fire wisp from Filipino legend: a round soft orange-and-yellow flame body like a little teardrop with a curling flame tip on top, a white-hot heart, two big shiny black eyes and a small happy smile, rosy cheeks, two tiny flame arms. It has no legs: it floats a little above the ground line and its flame tail flickers below it. Cute and gentle, never scary. It lives in a dark lava cave, so it is bright and easy to see against dark red-brown rock: warm clear colors and a clean dark outline all round. Row 1: floating toward the camera (facing down, front-and-top view). Row 2: floating away from the camera (facing up, back-and-top view). Row 3: floating to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: hovering still, bobbing a little higher with its flame tip leaning back, bobbing a little lower with its flame tip leaning forward. Row 4, left to right: hovering and smiling at the camera, its tiny arms raised in a wave; dozing in mid-air with its eyes closed and its flame burning low and calm, facing left; zooming away fast to the LEFT, stretched long like a comet with a trail of small sparks behind it. No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### 2. `wild_sigbin.png` (1024x1536, tall)
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN at the creature from above at about 45 degrees, so you always see the top of its back and head as well as its body, exactly like the farmer character in the same game. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The same creature in every cell: identical design, colors, size and proportions, standing on the same invisible ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. The creature: a Sigbin, a small cute night creature from Filipino legend: the size of a goat kid, goat-like, sitting up a little like a kangaroo, dusky violet-grey fur with a lighter belly, very big floppy ears it can clap together, two tiny curved dark horns, a long thin whip-like tail with a tuft at the end, round golden eyes, a shy little smile. Cute and harmless, never scary. It lives in a dark lava cave, so it is bright and easy to see against dark red-brown rock: warm clear colors and a clean dark outline all round. Row 1: walking toward the camera (facing down, front-and-top view). Row 2: walking away from the camera (facing up, back-and-top view). Row 3: walking to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: standing still, mid-step with one leg forward, mid-step with the other leg forward. Row 4, left to right: sitting up on its hind legs, ears spread wide, facing the camera; bending down and peeking backwards at you through its own hind legs (the Sigbin of legend walks backwards), facing left; hopping away fast to the LEFT in a big bound, tail streaming behind. No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### 3. `wild_tikbalang.png` (1024x1536, tall)
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN at the creature from above at about 45 degrees, so you always see the top of its back and head as well as its body, exactly like the farmer character in the same game. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The same creature in every cell: identical design, colors, size and proportions, standing on the same invisible ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. The creature: a Tikbalang, a tall cute trickster from Filipino legend: it stands on two long legs with horse hooves, a horse's head with a long friendly face, a big cheeky grin and bright eyes, a wild flowing dark brown mane down its back, long arms, a warm chestnut-brown coat, a simple woven vest. Lanky and playful, never scary. It lives in a dark lava cave, so it is bright and easy to see against dark red-brown rock: warm clear colors and a clean dark outline all round. Row 1: walking toward the camera (facing down, front-and-top view). Row 2: walking away from the camera (facing up, back-and-top view). Row 3: walking to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: standing still, mid-step with one long leg forward, mid-step with the other long leg forward. Row 4, left to right: standing with its arms crossed and grinning at the camera; squatting down with its knees up higher than its head, as the Tikbalang of legend sits, facing left; running fast to the LEFT in a long galloping stride, mane flying. No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### 4. `wild_bungisngis.png` (1024x1536, tall)
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN at the creature from above at about 45 degrees, so you always see the top of its back and head as well as its body, exactly like the farmer character in the same game. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The same creature in every cell: identical design, colors, size and proportions, standing on the same invisible ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. The creature: a Bungisngis, a laughing one-eyed giant from Filipino legend, drawn chubby and cute: a big round body, short stubby legs, a single huge round friendly eye in the middle of its face, a very wide grinning mouth that shows big white teeth, two little tusks, olive-green skin, a tuft of dark hair, a simple brown loincloth and a leather strap across its chest. Jolly and silly, never scary; it is a big guard, much bigger than a person. It lives in a dark lava cave, so it is bright and easy to see against dark red-brown rock: warm clear colors and a clean dark outline all round. Row 1: stomping toward the camera (facing down, front-and-top view). Row 2: stomping away from the camera (facing up, back-and-top view). Row 3: stomping to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: standing still, mid-step with one leg forward, mid-step with the other leg forward. Row 4, left to right: throwing its head back laughing out loud with both hands on its belly, facing the camera; sitting on the ground giggling into its hands, facing left; charging to the LEFT with its head down, arms swinging, a little dust behind its feet. No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### 5. `wild_bakunawa.png` (1024x1536, tall)
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN at the creature from above at about 45 degrees, so you always see the top of its back and head as well as its body, exactly like the farmer character in the same game. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The same creature in every cell: identical design, colors, size and proportions, standing on the same invisible ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. The creature: the Bakunawa, the huge moon-eating sea serpent of Filipino legend, drawn majestic but friendly-looking: a long dragon-like serpent body in deep night-sky blue with silver scales that shimmer like stars, a silver belly, a long finned crest down its back, gill-like frills on its head, two small horns, long whiskers, big kind silver eyes and a wide mouth with a gentle smile. Its body is coiled so the whole serpent fits in its cell; it moves by slithering, with no legs. It is the last boss, so it is grand, but cute, never scary. It lives in a dark lava cave, so it is bright and easy to see against dark red-brown rock: warm clear colors and a clean dark outline all round. Row 1: slithering toward the camera (facing down, front-and-top view). Row 2: slithering away from the camera (facing up, back-and-top view). Row 3: slithering to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: coiled still with its head raised, its body sliding in an S curve one way, its body sliding in an S curve the other way. Row 4, left to right: rearing up tall with its mouth open toward a small silver moon floating above its head, facing the camera; resting in a tight coil with its eyes half closed, facing left; lunging fast to the LEFT, body stretched out, frills spread. Every pose fits fully inside its cell: curl the long body to fit rather than cutting it off. No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

## The icons

### 6. `icons_lair.png` (1024x1024)
Item 7 is the Magma Bow, one level past the Gold Bow: attach `art-src/icons/bow_3.png` (the Gold Bow) with this prompt.
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A set of 8 game item icons, each a single object seen from a slight angle, bold and readable at small size. Arranged as a neat grid of 4 columns by 2 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Row by row, left to right: 1) an Ember Shard: a small cluster of three sharp glowing red-orange crystals with a yellow-white hot core, a warm orange glow around them; 2) a Santelmo Flame: a little friendly flame floating on its own, orange and yellow with a white-hot heart, two tiny dot eyes and a small smile; 3) a Sigbin Horn: one small curved dark violet-grey horn with ridged rings and a pale tip; 4) a Tikbalang Mane: a long lock of thick, dark brown wavy hair tied at the top with a red cord; 5) a Bungisngis Tooth: one big shiny white tooth, a cartoon molar with two roots; 6) a Bakunawa Scale: one large rounded scale in deep night-sky blue with tiny stars and a small crescent moon in it, a bright silver rim and a silver shimmer across it; 7) the Magma Bow: the SAME shape and the same diagonal angle as the attached Gold Bow, but made of glossy black obsidian with glowing orange-red lava cracks running along it, molten orange-gold bands at the grip and the tips, and a warm orange string; 8) the Fire Charm: a round gold amulet on a brown cord, a dark red stone in the middle with a bright orange flame inside it. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

## Magayon and the cave

### 7. `lair_mouth.png` (1024x1024)
On Magayon's north slope, at the head of the trail. In the game it is about 3 tiles wide by 3 tall, with the door (1 tile
wide) in the middle of its bottom edge where the player walks in.
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. One single game prop: the entrance to a cave going down into a volcano, Bakunawa's Lair. A rounded mound of dark charcoal-grey volcanic rock with a little green moss and small ferns on top, and in the middle of its front a big dark cave opening, an arch wide enough for a person to walk in, its doorway at the bottom middle. Warm orange light glows from deep inside the cave and a few thin wisps of steam curl out of it. Carved into the rock round the arch, a simple coiled sea-serpent shape. Two torches in iron holders either side of the opening, with small flames. The prop faces straight toward the viewer, symmetrical left to right, its base along the bottom of the picture. Its shape is about 3 wide by 3 tall. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

### 8. `lair_gate.png` (1536x1024, wide)
The way down to the next floor, on the cave floor: about 2 tiles by 2. Closed until every creature on the floor is down,
then it opens and glows. Two pictures of the same gate side by side.
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. Two game props side by side, in 2 columns of equal cells, the same object in each, at the same size and the same place in its cell, centered with clear empty space around it. No lines between cells. The object: a square stone stairway going down into the floor of a lava cave, seen from above at the game's angle, framed by a border of carved dark stone blocks with a coiled sea-serpent pattern. Left cell, CLOSED: two heavy black obsidian doors lie shut over the stairway, with an iron ring on each and dull red cracks between them, a little dark and cold. Right cell, OPEN: the same frame with the doors swung open to the sides, stone steps going down into the dark, and bright warm orange-gold light glowing up out of the opening with a few sparks floating up. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

### 9-12. The cave's tiles (1024x1024 each)
Every floor of the Lair is one cave made of the Mine's tiles, which the game paints red and orange until these come.
They must sit side by side without a seam.

#### 9. `cave_floor.png`
```
A seamless, tileable square texture seen from directly above that fills the whole picture edge to edge. Even lighting, no vignette, nothing cut off at the edges, no single big object, no mirror symmetry and no repeating kaleidoscope pattern, so copies can sit side by side without a visible seam. the floor of a lava cave: warm dark red-brown volcanic stone, flat and walkable, with small black pebbles, fine ash, a few thin cracks that glow faint orange, and soft warm light. Calm and not too busy, so creatures stand out on it.
```

#### 10. `cave_lava.png`
```
A seamless, tileable square texture seen from directly above that fills the whole picture edge to edge. Even lighting, no vignette, nothing cut off at the edges, no single big object, no mirror symmetry and no repeating kaleidoscope pattern, so copies can sit side by side without a visible seam. a pool of molten lava seen from above: bright orange and yellow lava with darker red-orange crusts floating on it, soft glowing swirls and a few bubbles. Hot and glowing but simple and cartoon-like, not photo-real.
```

#### 11. `cave_rock_top.png`
```
A seamless, tileable square texture seen from directly above that fills the whole picture edge to edge. Even lighting, no vignette, nothing cut off at the edges, no single big object, no mirror symmetry and no repeating kaleidoscope pattern, so copies can sit side by side without a visible seam. the top of a thick cave wall seen from above: rough dark charcoal-brown volcanic rock with deep cracks and a few lumps, darker than a cave floor, with a faint red glow deep in the cracks.
```

#### 12. `cave_rock_face.png`
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. A tileable texture of the face of a cave wall seen from the front, as the low wall along the top of a top-down game room: rough dark charcoal-brown volcanic rock with ledges and cracks, a faint orange glow in a few cracks, lit softly from below by lava. It repeats left to right without a seam and fills the whole picture edge to edge, darker at the top and a little lighter at the bottom edge where it meets the floor. No single big object, no vignette.
```

## The house: a Volcano furniture set

### 13. `furniture/volcano.png` (1024x1024)
Five new pieces for the house, bought with what the Lair gives.
```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. For a top-down farming game like Stardew Valley or Harvest Moon. A set of 5 pieces of furniture for a cozy farmhouse, all in one matching Volcano style: glossy black obsidian and dark basalt stone, glowing orange lava accents, warm red cushions and a little gold. Every piece faces straight toward the viewer, seen from the front and a little above: NOT turned to the side, NOT drawn at a diagonal or isometric angle, symmetrical left to right. Things that lie on the floor are seen from directly above. Arranged as a grid of 3 columns by 2 rows of equal cells, one piece per cell, each centered in its cell with clear empty space around it, all at the same scale (a chair is small, a fireplace is big). No lines between cells. Row by row, left to right: 1) a stone fireplace built of dark lava rock with glowing coals and a warm fire; 2) a tall lava lamp, a glass column on a black stand with soft orange blobs glowing inside; 3) an obsidian armchair with plump red cushions and gold feet; 4) a round rug lying flat on the floor, seen from above, deep night-blue with a silver coiled sea-serpent and a crescent moon on it; 5) a small volcano model on a little wooden table, with a thin wisp of smoke and a tiny glow at the top. Leave the last cell empty. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

## Tita Luz's Tailor Shop: the Fire look

Made like the 8 looks the shop sells now: a real image EDIT of the farmer's own sheets, so every pose stays where it is.
Attach the EDIT TARGET from `targets/` in ~/Documents/harvest-hat-art/looks-5-job.zip (boy-walk.png, girl-walk.png,
boy-tools.png, girl-tools.png, boy-archer.png, girl-archer.png). Do the two walk pictures first and check them; the tools
and archer pictures copy the outfit from the approved walk picture.

### 14. `fire-boy-walk.png` (1024x1536). Attach targets/boy-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

The attached image is the EDIT TARGET: a 1024 x 1536 sheet with 9 poses of the same farmer boy, in 3 columns and 3 rows of equal cells, on flat magenta. Rows from top to bottom: facing the camera, facing away, facing left. Columns from left to right: standing still, left foot forward, right foot forward.

TASK
Keep the same farmer boy and change ONLY the clothes:
Replace a red baseball cap with a dark red bandana tied round the head, its two ends flicking out at the back like little flames. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a yellow shirt and blue overalls with a charcoal-black sleeveless hunter's jacket with orange-and-yellow flame shapes rising from its hem, over a dark red shirt, black trousers and a brown belt with a small gold flame buckle.
Replace the brown boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 9 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 3 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1536 pixels.

FINAL CHECK BEFORE SENDING
Count 9 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```

### 15. `fire-girl-walk.png` (1024x1536). Attach targets/girl-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

The attached image is the EDIT TARGET: a 1024 x 1536 sheet with 9 poses of the same farmer girl, in 3 columns and 3 rows of equal cells, on flat magenta. Rows from top to bottom: facing the camera, facing away, facing left. Columns from left to right: standing still, left foot forward, right foot forward.

TASK
Keep the same farmer girl and change ONLY the clothes:
Replace a pink baseball cap with a red hair band with a small gold flame ornament on one side. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a pink shirt and lilac overalls with a dark red dress with orange-to-yellow flame shapes rising from its hem, and a short black jacket over it with a little gold flame pin.
Replace the pink boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 9 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 3 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1536 pixels.

FINAL CHECK BEFORE SENDING
Count 9 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```

### 16. `fire-boy-tools.png` (1024x1024). Attach targets/boy-tools.png and your finished fire-boy-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

I am attaching two images.
Image 1 is the EDIT TARGET: a 1024 x 1024 sheet with 6 poses of the same farmer boy, in 3 columns and 2 rows of equal cells, on flat magenta. Top row: facing the camera with both arms raised high, facing the camera with both arms swung down in front, facing away with both arms raised high. Bottom row: facing away with arms swung down in front, facing left with arms raised up and back, facing left with arms swung forward and down. The hands are empty.
Image 2 shows the same character already wearing the outfit. Copy the outfit exactly from Image 2: the same headwear, clothes, colours and details. Do not copy its poses.

TASK
Keep the same farmer boy and change ONLY the clothes:
Replace a red baseball cap with a dark red bandana tied round the head, its two ends flicking out at the back like little flames. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a yellow shirt and blue overalls with a charcoal-black sleeveless hunter's jacket with orange-and-yellow flame shapes rising from its hem, over a dark red shirt, black trousers and a brown belt with a small gold flame buckle.
Replace the brown boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses. No bow, string, arrow or tool.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 6 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 2 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1024 pixels.

FINAL CHECK BEFORE SENDING
Count 6 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```

### 17. `fire-girl-tools.png` (1024x1024). Attach targets/girl-tools.png and your finished fire-girl-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

I am attaching two images.
Image 1 is the EDIT TARGET: a 1024 x 1024 sheet with 6 poses of the same farmer girl, in 3 columns and 2 rows of equal cells, on flat magenta. Top row: facing the camera with both arms raised high, facing the camera with both arms swung down in front, facing away with both arms raised high. Bottom row: facing away with arms swung down in front, facing left with arms raised up and back, facing left with arms swung forward and down. The hands are empty.
Image 2 shows the same character already wearing the outfit. Copy the outfit exactly from Image 2: the same headwear, clothes, colours and details. Do not copy its poses.

TASK
Keep the same farmer girl and change ONLY the clothes:
Replace a pink baseball cap with a red hair band with a small gold flame ornament on one side. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a pink shirt and lilac overalls with a dark red dress with orange-to-yellow flame shapes rising from its hem, and a short black jacket over it with a little gold flame pin.
Replace the pink boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses. No bow, string, arrow or tool.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 6 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 2 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1024 pixels.

FINAL CHECK BEFORE SENDING
Count 6 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```

### 18. `fire-boy-archer.png` (1024x1536). Attach targets/boy-archer.png and your finished fire-boy-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

I am attaching two images.
Image 1 is the EDIT TARGET: a 1024 x 1536 sheet with 9 archery poses of the same farmer boy, in 3 columns and 3 rows of equal cells, on flat magenta. Rows from top to bottom: facing the camera, facing away, facing left. Columns from left to right: ready, full draw, let go. The hands are empty: the game draws the bow.
Image 2 shows the same character already wearing the outfit. Copy the outfit exactly from Image 2: the same headwear, clothes, colours and details. Do not copy its poses.

TASK
Keep the same farmer boy and change ONLY the clothes:
Replace a red baseball cap with a dark red bandana tied round the head, its two ends flicking out at the back like little flames. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a yellow shirt and blue overalls with a charcoal-black sleeveless hunter's jacket with orange-and-yellow flame shapes rising from its hem, over a dark red shirt, black trousers and a brown belt with a small gold flame buckle.
Replace the brown boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses. No bow, string, arrow or tool.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 9 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 3 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1536 pixels.

FINAL CHECK BEFORE SENDING
Count 9 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```

### 19. `fire-girl-archer.png` (1024x1536). Attach targets/girl-archer.png and your finished fire-girl-walk.png
```
Use case: precise-object-edit. Asset type: outfit version of an existing game character sprite sheet.

I am attaching two images.
Image 1 is the EDIT TARGET: a 1024 x 1536 sheet with 9 archery poses of the same farmer girl, in 3 columns and 3 rows of equal cells, on flat magenta. Rows from top to bottom: facing the camera, facing away, facing left. Columns from left to right: ready, full draw, let go. The hands are empty: the game draws the bow.
Image 2 shows the same character already wearing the outfit. Copy the outfit exactly from Image 2: the same headwear, clothes, colours and details. Do not copy its poses.

TASK
Keep the same farmer girl and change ONLY the clothes:
Replace a pink baseball cap with a red hair band with a small gold flame ornament on one side. It sits properly on the head and fits it, not bigger than the head and shoulders. No cap under it.
Replace a pink shirt and lilac overalls with a dark red dress with orange-to-yellow flame shapes rising from its hem, and a short black jacket over it with a little gold flame pin.
Replace the pink boots with black boots with orange laces.

KEEP EXACTLY THE SAME
The same face, hair, skin, big-head chibi proportions, painted cartoon style, outline and shading. Every pose keeps the same position, size, direction, arms, hands, legs and feet inside its cell. Do not move, resize or redesign the character. Do not add new poses. No bow, string, arrow or tool.

The outfit looks right from each side, level on the head and never tilted. Every detail stays the same in all 9 poses. Arms and hands stay visible in front of the clothes. No real fire, glow or smoke: the flames are only a pattern on the cloth.

LAYOUT IS CRITICAL
Exactly 3 columns and 3 rows. One character fully inside each cell, with magenta clearance on all sides. Nothing touches or crosses a cell edge. The top of the headwear stays at about the same height as the top of the old cap. The feet in each row stay at exactly the same height as in the EDIT TARGET: do not slide any row up or down.

BACKGROUND
Flat solid magenta #FF00FF everywhere outside the character. Do not use magenta inside the outfit. Any pink stays soft and pale, never bright or hot pink. No shadow, floor, text, labels, grid lines or extra objects.

FILE
One picture, 1024 x 1536 pixels.

FINAL CHECK BEFORE SENDING
Count 9 poses. None of the old cap or clothes anywhere. The headwear is level and the same size in every pose.
```
