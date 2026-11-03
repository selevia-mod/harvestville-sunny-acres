# Farmhands art: prompts

The four farmhands you hire at the Sunny Inn (src/00-zzzzzzz-farmhands.js). Until these exist the game cuts stand-ins
from the out-of-town visitors in the people sheet (Andoy = the visiting farmer, Lucing = the young mother, Berto = the old
traveller, Kiko = the student), so a farmhand can look like a shopper in town. Generate each picture and save it under
`art-src/` with the file name shown, then send them over.

Tips:
- Same 3 x 3 walking sheet as the villagers (row 1 facing the camera, row 2 facing away, row 3 facing left; columns:
  standing, left step, right step), on a transparent or plain magenta background.
- They are working people: clothes a little worn, a tool or bag that says their job, never the same colours as a villager.

Wiring (for whoever imports them): the game uses an image named `farmhands` when `assets/farmhands.png` (and its .webp)
is there: 9 columns x 4 rows of 128 x 192 cells, no margin, full size (not in assets/sizes.json), one farmhand a row in
`C.FH_KEYS` order (andoy, lucing, berto, kiko), each row the 9 cells of its sheet read left to right, top to bottom.
Nothing else changes (src/19zz-farmhands.js, F.fhTexture).

## 1. characters/fh_andoy.png  (1024x1536)

Andoy, waterer.

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A walking sprite sheet of Andoy, a lanky young farmhand in a wide straw hat, a faded blue shirt and rolled-up trousers, carrying a tin watering can, chibi proportions with a big head, same scale as a small farmer boy. Arranged as a neat grid of 3 columns by 3 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. The same character in every cell, identical design, colors, size and proportions. Each cell shows the full body from head to feet, standing on the same invisible ground line near the bottom of the cell, nothing touching the cell edges. Rows from top to bottom: facing the camera (walking down), facing away from the camera (walking up), facing left (side view). Columns from left to right: standing still, mid-step with the left foot forward, mid-step with the right foot forward. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

## 2. characters/fh_lucing.png  (1024x1536)

Lucing, harvester.

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A walking sprite sheet of Lucing, a cheerful woman with a ponytail, a yellow blouse, a green apron and a woven harvest basket on her hip, chibi proportions with a big head, same scale as a small farmer boy. Arranged as a neat grid of 3 columns by 3 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. The same character in every cell, identical design, colors, size and proportions. Each cell shows the full body from head to feet, standing on the same invisible ground line near the bottom of the cell, nothing touching the cell edges. Rows from top to bottom: facing the camera (walking down), facing away from the camera (walking up), facing left (side view). Columns from left to right: standing still, mid-step with the left foot forward, mid-step with the right foot forward. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

## 3. characters/fh_berto.png  (1024x1536)

Berto, animal hand.

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A walking sprite sheet of Berto, a stocky older man with a flat cap, a brown vest over a white shirt and a feed sack over one shoulder, chibi proportions with a big head, same scale as a small farmer boy. Arranged as a neat grid of 3 columns by 3 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. The same character in every cell, identical design, colors, size and proportions. Each cell shows the full body from head to feet, standing on the same invisible ground line near the bottom of the cell, nothing touching the cell edges. Rows from top to bottom: facing the camera (walking down), facing away from the camera (walking up), facing left (side view). Columns from left to right: standing still, mid-step with the left foot forward, mid-step with the right foot forward. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

## 4. characters/fh_kiko.png  (1024x1536)

Kiko, fruit picker.

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A walking sprite sheet of Kiko, a wiry teenage boy with messy hair, round glasses, a green shirt with rolled sleeves and a cloth sling bag for fruit, chibi proportions with a big head, same scale as a small farmer boy. Arranged as a neat grid of 3 columns by 3 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. The same character in every cell, identical design, colors, size and proportions. Each cell shows the full body from head to feet, standing on the same invisible ground line near the bottom of the cell, nothing touching the cell edges. Rows from top to bottom: facing the camera (walking down), facing away from the camera (walking up), facing left (side view). Columns from left to right: standing still, mid-step with the left foot forward, mid-step with the right foot forward. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```
