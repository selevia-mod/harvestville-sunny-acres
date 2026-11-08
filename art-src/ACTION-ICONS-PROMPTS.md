# The action button: its pictures and its ring (owner, 8 Nov 2026: "improve the design of this and the art showing
inside that circle, give me prompt and i will generate")

Today four actions have a picture drawn by code (Enter, Go down, Read a sign, Withered), and a dozen borrow one that
does not fit (the Lift and the Jeep show a crate, Bed a moon, the Bell gold ore, a notice board a calendar, Talk a
ribbon...). Two pictures: the 16 action icons, and the button's ring. Transparent background (or flat magenta
#FF00FF). Save under `art-src/` with the path shown, and send them.

### icons/action_icons.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. Seen from the front and a little from above. No text, no letters, no watermark, no border, no drop shadow box. A set of 16 game action icons, each a single simple object, bold and readable at a very small size inside a round button. Arranged as a neat grid of 4 columns by 4 rows of equal cells, one icon per cell, each centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Row by row, left to right: 1) a small arched wooden door with iron hinges and a round brass knob, slightly open with warm light inside; 2) a stone staircase going down into darkness, seen from above; 3) a wooden signpost with two arrow boards; 4) a wilted brown sprout drooping over a small mound of dry soil; 5) a small mine lift: an iron cage with a wooden frame and a wheel on top; 6) a colorful Philippine jeepney seen from the front, silver with bright paint; 7) a small wooden rowboat with one oar; 8) a golden bell with a red ribbon on top; 9) a wooden notice board on two legs with three pinned paper notes; 10) a cozy single bed with a blue quilt and a white pillow; 11) a small market stall with a red and white striped awning and a crate of vegetables; 12) a little shop front with a green awning and an open sign shape (no letters); 13) a small steam train engine, front three-quarter view, green and red; 14) a round white speech bubble with three dots; 15) a heavy wooden gate held shut with an iron lock and chain; 16) a shiny gold coin falling into rippling blue water. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

### ui/action_ring.png  (1024x1024)

```
Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, warm colors, soft light from the top-left. No text, no letters, no watermark, no border, no drop shadow box. One big round game button frame, seen straight from the front, filling most of the picture: a thick ring of warm polished wood with a thin bright gold inner rim and a soft gold outer rim, small rivets or a subtle carved pattern around it, a gentle highlight along the top-left of the ring and a soft shadow at the bottom-right. The inside of the ring is a flat, very light cream disc (it will hold an icon). The ring is perfectly circular and centered. Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.
```

How they go in: the 16 icons are cut from the grid into the items sheet (new icons at the end: nothing moves) and each
action points at its own; the ring replaces the drawn ring of the action button (its label pill stays).
