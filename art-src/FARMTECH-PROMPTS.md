# Farm tech: prompts for the real art

Sprinklers, fertilizer and the greenhouse (4 Nov 2026) are drawn by code until these come: the icons by
`tools/art/farmtech-icons.js` (into the items sheet), the greenhouse and the sprinkler's spray on canvases in
`src/19zz-farmtech.js`. Save each under `art-src/` with the path shown and the size shown, then send them.

Use a transparent background (or plain magenta #FF00FF).

How they go in:
- `icons/farmtech_icons.png`: cut into `art-src/icons/<name>.png` (128x128 each) and painted into the items sheet at
  the icons' places (`sprinkler_copper`, `sprinkler_silver`, `sprinkler_gold`, `fert`, `fert_rich`, the last five of
  `C.ICON_ORDER`). On the farm a placed sprinkler is its icon standing on the soil, so the sprinklers must read well
  both as an icon and as a small object on a tile.
- `props/greenhouse_floor.png`, `props/greenhouse_frame.png` and `props/ws_greenhouse.png` become `assets/props/` images;
  `src/19zz-farmtech.js` then uses them in place of `ft-gh-floor`, `ft-gh-frame` and `ft-gh-whole`.

### icons/farmtech_icons.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A set of 5 game item icons, each a single object seen from a slight angle, bold and readable at small size. Arranged as a neat grid of 4 columns by 4 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Row by row, left to right: 1) a small garden sprinkler made of polished copper: a round flat foot, a short post and a head with two little nozzles, two thin arcs of blue water spraying out to the sides; 2) the same sprinkler made of shiny silver, with a four-way head and four arcs of water; 3) the same sprinkler made of bright gold with a little gem on top, a wide ring of water spraying all around it; 4) a tied burlap sack of garden fertilizer with a cream label showing a green sprout; 5) a darker, richer brown sack of premium fertilizer with a golden label showing a green sprout and a small golden sparkle. Leave the remaining cells empty. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

### props/ws_greenhouse.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A small farm greenhouse with a white-painted wooden frame and clear, slightly blue glass walls and a low peaked glass roof, seen from above so the inside is visible: a pale gravel floor with twelve square beds of dark soil edged with wooden boards, in 3 rows of 4. Its base along the bottom of the picture. Its footprint is 4 wide by 3 deep, with the roof's peak rising a little above the back wall. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

### props/greenhouse_floor.png  (1024x768)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, bright warm colors, soft light from the top-left. Seen from directly above. No text, no letters, no watermark, no border, no drop shadow box. The floor of a small greenhouse filling the whole picture edge to edge: pale grey gravel, with twelve square beds of dark brown soil edged with light wooden boards, in 3 rows of 4, each bed centred in its quarter of the width and third of the height, the same size, a little gravel between them. A narrow band of grey stone along all four edges. No walls, no plants.
```

### props/greenhouse_frame.png  (1024x992)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. Only the white-painted wooden frame and glass of a small greenhouse, to lay over its floor: a thin white frame around the edges of the lower three quarters of the picture with a post at each corner, very light and mostly clear glass walls (just a faint blue sheen along the edges), and along the top a low peaked roof of glass panes with white glazing bars, rising above the back wall into the top quarter of the picture. The middle of the picture stays fully transparent, so the plants inside show. Isolated on a fully transparent background (PNG with alpha).
```
