# Wheat, mango (and the workshop's fruit and jams), the lift: prompts (owner, 8 Nov 2026: "wheat, mango and lift also need an art")

These are still drawn by code (flat shapes, not the painted look of the rest): the icons of wheat, wheat seeds, mango,
apple, orange, peach and their jams (tools/art/draw.js ICON_DRAW), wheat growing in the field (crop shape 'grain'), and
the lift in the Mine, the Lair and the caves (src/19y-mine.js, src/19zt-lair.js liftTexture). Save each under
`art-src/` with the path shown, at the size shown, transparent background (or flat magenta #FF00FF), and send them.

### icons/workshop_icons.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A set of 9 game item icons, each a single object seen from a slight angle, bold and readable at small size. Arranged as a neat grid of 4 columns by 4 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Row by row, left to right: 1) a sheaf of ripe golden wheat tied with a twist of straw, the heavy ears bending a little; 2) a small kraft-paper seed packet folded at the top, with a picture of golden wheat ears on its front label; 3) a ripe Philippine mango (carabao mango), long and plump, golden yellow with a soft orange blush, a short stem and one green leaf; 4) a shiny red apple with a short stem and a green leaf; 5) a round bright orange with a dimpled peel, a stem and a green leaf; 6) a soft pink-orange peach with a fuzzy blush, a short stem and a green leaf; 7) a glass jar of golden mango jam with a cream cloth cover tied with string and a little mango on its label; 8) the same jar of deep red apple jam with a little apple on its label; 9) the same jar of pink-orange peach jam with a little peach on its label. Leave the remaining cells empty. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep each object inside its cell with some empty margin.
```

### crops/wheat.png  (1536x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. Arranged as a neat grid of 2 columns by 1 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Left: a small clump of young green wheat shoots, still growing. Right: a full clump of tall ripe golden wheat with heavy bending ears. Growing out of a small mound of tilled brown soil at the bottom center of the cell. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### props/mine_lift.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, warm colors, soft light from the top-left. Seen from the front and a little from above, standing against a cave's rock wall. No text, no letters, no watermark, no border, no drop shadow box. An old mine lift, taller than it is wide (about 3 wide to 4 tall): a sturdy frame of thick dark timber beams bolted with iron, a big iron wheel with a rope at the top, and inside the frame a small iron cage with a sliding gate of bars, a wooden floor and a little lantern hanging inside it giving a warm glow; a dark shaft behind the cage. It should read clearly as a lift you can step into to go up and down, in a cozy, not scary, way. Its base along the bottom of the picture. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

How they go in: the icons are cut from the grid into `art-src/icons/<name>.png` (128x128) and painted into the items sheet
at their places (nothing moves); `crops/wheat.png` becomes wheat's growing and ripe frames like every crop; the lift
replaces the drawn `fx-lairlift` and the Mine's lift (same box, its base on the floor).
