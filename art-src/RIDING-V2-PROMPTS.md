# Harvest Ville riding, new art (owner, 10 Nov 2026: "we need to redo all the horse riding art")

A real gallop: 4 frames for each way the horse goes, and a standing row. Every picture is ONE sprite sheet,
**1536 x 1536, a 4 x 4 grid of 384 x 384 cells**, transparent background (or flat magenta #FF00FF).

Make them **in this order**, and send me step 1 and step 2 before the rest: I put them in the game and show you first.

1. `horse.png`: the saddled horse alone. Attach `references/horse-old.png` (the horse we have now: keep its colours and its red saddle).
2. `default-boy.png` and `default-girl.png`: the farmer in farm clothes on that horse. Attach **your new `horse.png`** and `references/default-reference.png`.
3. Then, for each costume below: `<costume>-boy.png` and `<costume>-girl.png`. Attach your new `horse.png` and `references/<costume>-reference.png` (top row the boy, bottom row the girl).

## The grid (the same in every picture)

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
|---|---|---|---|---|
| 1: galloping TOWARD the camera | gallop 1 | gallop 2 | gallop 3 | gallop 4 |
| 2: galloping AWAY from the camera | gallop 1 | gallop 2 | gallop 3 | gallop 4 |
| 3: galloping to the LEFT | gallop 1 | gallop 2 | gallop 3 | gallop 4 |
| 4: standing still | facing the camera | facing away | facing left | rearing up happily, facing left |

---

## Step 1: horse.png

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no numbers, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN from above at about 45 degrees. An ANIMATION sprite sheet: a neat grid of 4 columns by 4 rows of equal cells (1536 x 1536 in all, each cell 384 x 384), one frame per cell, each centered in its cell with clear empty space around it, nothing touching the cell edges. No lines between cells. The same horse in every cell: identical design, colors, size and proportions. A real, sturdy farm horse (not a pony, not a toy): a chestnut-brown coat, a dark brown mane and tail, white socks on the lower legs, gentle friendly eyes, wearing a red leather saddle with a saddle blanket, stirrups hanging on both sides, and a bridle with reins; like the attached reference picture, but a proper horse with a longer neck and longer legs. NO rider. Every frame stands on the same invisible ground line near the bottom of its cell: the hooves that touch the ground are always at that same height, so the horse never floats. NO dust, NO motion lines, NO shadow on the ground (the game adds these). Row 1, GALLOPING TOWARD THE CAMERA (facing down the screen, front-and-top view, head and chest in front), 4 frames of one smooth gallop: 1) front hooves reaching forward, 2) front hooves landing, back legs gathering under the body, 3) back hooves pushing off, the body stretched, 4) all four hooves tucked under, the moment of flight, a little higher. Row 2, GALLOPING AWAY FROM THE CAMERA (facing up the screen, back-and-top view: its rump, tail and saddle), the same 4 gallop frames, the tail flowing behind. Row 3, GALLOPING TO THE LEFT (three-quarter side view from above, the head on the left), the same 4 gallop frames, mane and tail flowing back. Row 4: 1) standing still facing the camera, 2) standing still facing away, 3) standing still facing left, 4) rearing up happily on its back legs facing left, front hooves raised. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

## Step 2 and 3: the farmer riding it (write the costume in place of [OUTFIT] and "boy" or "girl" in place of [boy / girl])

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. No text, no letters, no numbers, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the camera looks DOWN from above at about 45 degrees. An ANIMATION sprite sheet: a neat grid of 4 columns by 4 rows of equal cells (1536 x 1536 in all, each cell 384 x 384), one frame per cell, each centered in its cell with clear empty space around it, nothing touching the cell edges. No lines between cells. EXACTLY the horse of the first reference picture, in every cell exactly the same pose, size and place as in that picture's grid, now with the farmer of the second reference picture RIDING it, drawn together as one: the [boy / girl] sits deep in the saddle astride the horse (never standing on it, never floating above it), one leg down each side of the horse with the feet in the stirrups, knees bent, back straight and leaning a little forward with the gallop, both hands holding the reins in front, a big happy face; the same face, hair and outfit as the reference: [OUTFIT]. The same cute chibi farmer as in the game, small on a big horse: the rider's whole body about as tall as the horse's neck and head. The rider moves with the horse: bobbing down as the hooves land, rising as the horse pushes off; the hair, scarf, ribbons or hat flutter a little with the speed. Every frame stands on the same invisible ground line near the bottom of its cell (the hooves on the ground always at the same height). NO dust, NO motion lines, NO shadow on the ground (the game adds these). Row 1: galloping toward the camera (the horse's head in front, the rider's face and body behind it, both legs at the horse's sides), 4 frames. Row 2: galloping away from the camera (the rider's back, both legs down the horse's sides), 4 frames. Row 3: galloping to the LEFT (three-quarter side view from above: the near leg down the horse's side in the stirrup, the far leg hidden), 4 frames. Row 4: 1) standing still facing the camera, 2) standing still facing away, 3) standing still facing left, the rider waving, 4) the horse rearing up happily facing left, the rider holding on and cheering. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### What to write for [OUTFIT]

| File | [OUTFIT] |
|---|---|
| default | the farm clothes: a red cap (pink for the girl) and denim overalls (lilac for the girl) over a yellow shirt (pink for the girl) |
| elf | Christmas Elf: a green elf suit and a pointed hat with a bell |
| straw | Straw Farmer: a straw hat, a plaid shirt and sturdy work boots |
| ranch | Ranch Hand: a cowboy hat, a red flannel shirt and a leather vest |
| winter | Cozy Winter: a teal knit beanie with a cream pom-pom, a teal cable-knit sweater, a long cream scarf, grey trousers and brown boots |
| flower | Spring Festival: a flower crown, with a lei for him and a sundress for her |
| santa | Santa Claus: the red suit with white trim, the hat and the big black boots |
| fiesta | Barrio Fiesta: a salakot, with a barong for him and a blue Filipiniana for her |
| bunny | Bunny Hop: a soft pink suit and a hood with bunny ears |
| fire | Lair Fire: a red bandana and a flame vest for him, a flame dress for her |
| terrace | Terrace Keeper: a rattan headband with a rice sprig and a vest striped like the rice terraces |
| hills | Hill Wanderer: a dotted cocoa bandana and a jacket with little round hills on the hem |
| lake | Lake Spirit: a pearl headband and sea-green clothes with white waves |
| forest | Forest Guardian: a leaf bandana or a leaf crown, and moss-green clothes with leaves on the hem |
| feather | Moon Feather: midnight blue with gold feathers and a little silver moon |

31 pictures in all: 1 horse + 15 outfits x 2 (boy, girl). Save them with exactly these names and send them in one zip.
