# Greenhouse v2 (owner, 8 Nov 2026: "Greenhouse looks odd, need to polish and improve")

What looked odd with v1 (`props/greenhouse_frame.png` over `props/greenhouse_floor.png`): the roof floats above the
top row, the top row of beds is outside the glass (no back wall), and the farmer walks on top of the glass instead of
going in. v2 is three layers on the same 4x3-tile box (128 px a tile, 112 px of roof above), drawn by
`src/19zz-farmtech.js`: the BACK (behind the crops and the farmer), the floor as now, the FRONT (over the farmer when
they are inside, faded so they show). The floor (`props/greenhouse_floor.png`) stays.

Save each under `art-src/props/` at the size shown, transparent background (or flat magenta #FF00FF), then send them.

### props/greenhouse_back.png  (1024x992)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. Only the BACK half of a small farm greenhouse, to stand behind its floor: across the top quarter of the picture, the back wall of clear, slightly blue glass panes in a white-painted wooden frame, full width, standing upright, with a low peaked glass roof above it (white glazing bars, a soft white highlight on the glass). At the far left and far right, the back corner posts. A few small hanging pots or a little shelf with a watering can against the inside of the back wall. Everything below the back wall, the lower three quarters of the picture, stays fully transparent (the floor and the plants show there). Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### props/greenhouse_front.png  (1024x992)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. Only the FRONT and SIDE walls of a small farm greenhouse, to lay over its floor: two side walls running down the left and right edges of the picture from the top quarter to the bottom, and a low front wall along the bottom edge, all of very light, mostly clear glass (only a faint blue sheen and a few soft white reflections) in a thin white-painted wooden frame, with a sturdy white post at each front corner. In the middle of the front wall, an open doorway with a small white wooden door swung open to one side. The middle of the picture, inside the walls, stays fully transparent, so the beds and plants inside show. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### props/ws_greenhouse.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). No text, no letters, no watermark, no border, no drop shadow box. A small, charming farm greenhouse, seen from above so the inside is visible: a white-painted wooden frame with clear, slightly blue glass walls on all four sides, a low peaked glass roof along the back wall, and an open white door in the middle of the front wall. Inside, a pale gravel floor with twelve square beds of dark soil edged with light wooden boards, in 3 rows of 4, with small green sprouts and a few ripe vegetables in them, and a couple of hanging pots on the back wall. Its footprint is 4 wide by 3 deep, its base along the bottom of the picture. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.
```

How they go in: `tools/art/farmtech-import.js` cuts each to its box (512x496 for the back and front, as the v1 frame;
the whole one as before); `src/19zz-farmtech.js` draws the back under the crops, the front over the farmer (faded to
about half while they stand inside), and the soil and crops inside each wooden bed instead of the field's soil strip.
