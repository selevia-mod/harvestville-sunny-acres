'use strict';
// Every image the game uses, as a list of "jobs": one picture to generate (with ChatGPT or any image tool),
// where to save it (art-src/...), the size to ask for, and how tools/make-art.js fits it into the game's sheets.
// A job whose file is missing keeps the built-in drawn art, so pictures can be replaced a few at a time.
// tools/make-art-brief.js turns this list into the art brief page.
const { PROPS } = require('./tiles');
const vm = require('vm');
const fsys = require('fs');
const pth = require('path');

// the home's furniture and styles come from the game's data
const GAME = (() => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const dir = pth.join(__dirname, '..', 'src');
  fsys.readdirSync(dir).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fsys.readFileSync(pth.join(dir, f), 'utf8'), ctx));
  return ctx.window.Farm.Config;
})();
const HOME = GAME.HOME;

// ---------- the shared style, put in front of every prompt ----------
const STYLE = 'Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: ' +
  'rounded friendly shapes, soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, ' +
  'soft light from the top-left. Seen from a top-down three-quarter view (camera looking down at about 45 degrees). ' +
  'No text, no letters, no watermark, no border, no drop shadow box.';
const CUTOUT = 'Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a ' +
  'flat solid pure magenta #FF00FF background with nothing else on it. Keep the whole object inside the picture with some empty margin.';
const TEXTURE = 'A seamless, tileable square texture seen from directly above that fills the whole picture edge to edge. ' +
  'Even lighting, no vignette, nothing cut off at the edges, no single big object, so copies can sit side by side without a visible seam.';
const GRID = (cols, rows) => `Arranged as a neat grid of ${cols} columns by ${rows} rows of equal cells, one item per cell, ` +
  'each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells.';
const CHAR_GRID = 'The same character in every cell, identical design, colors, size and proportions. Each cell shows the full body ' +
  'from head to feet, standing on the same invisible ground line near the bottom of the cell, nothing touching the cell edges.';

const SEASON_LOOK = {
  spring: 'spring: fresh bright green with a few tiny pink and white blossoms',
  summer: 'summer: rich deep lush green under strong sunshine',
  fall: 'fall (autumn): warm orange, gold and russet tones with a few fallen leaves',
  winter: 'winter: covered in soft clean snow with hints of the ground beneath, cool blue shadows',
};
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const jobs = [];
const add = (j) => jobs.push(j);

// ---------- 1. ground textures (opaque, seamless) ----------
const GROUND = {
  grass: 'short meadow grass',
  grass2: 'slightly longer, darker meadow grass with small clumps',
  grass3: 'meadow grass with a few small wildflowers',
  flowers: 'meadow grass with many small colorful wildflowers',
  field: 'untilled farm field: flat bare brown earth with a few pebbles and dry grass tufts',
  path: 'a cobblestone footpath of rounded beige stones',
};
Object.keys(GROUND).forEach((kind) => {
  SEASONS.forEach((season) => {
    add({
      id: `ground_${kind}_${season}`, group: 'Ground (seasons)', file: `ground/${kind}_${season}.png`, gen: '1024x1024',
      final: '256x256 tile', mode: 'texture', targets: [`season:${kind}:${season}`],
      prompt: `${TEXTURE} ${GROUND[kind]}, ${SEASON_LOOK[season]}.`,
      // grass variants and flower patches sit next to plain grass, so they take its average colour (no checkerboard)
      match: ['grass2', 'grass3', 'flowers'].includes(kind) ? `season:grass:${season}` : undefined,
    });
  });
});
const GROUND2 = {
  tilled: ['tiles:tilled', 'freshly hoed dark brown soil in neat soft furrows'],
  tilled_wet: ['tiles:tilledWet', 'freshly hoed soil that has just been watered: darker, wet, slightly shiny dark brown furrows'],
  water: ['tiles:water', 'clear blue pond water with gentle ripples and soft light sparkles'],
  dock: ['tiles:dock', 'wooden dock planks running left to right, warm honey wood with small nail heads'],
  plaza: ['tiles:plaza', 'a town plaza of light grey-beige square paving stones'],
  sand: ['tiles:sand', 'soft warm golden beach sand with a few tiny shells and pebbles'],
  floor: ['indoor:floor', 'warm wooden floorboards for a cozy cottage interior'],
  floor2: ['indoor:floor2', 'warm wooden floorboards for a cozy cottage interior, slightly different plank pattern'],
  wall: ['indoor:wall', 'a cottage interior wall seen from the front: cream wallpaper with a small flower pattern'],
  wall_low: ['indoor:wall_low', 'the bottom of a cottage interior wall seen from the front: cream wallpaper above a wooden skirting board'],
  wall_side: ['indoor:wall_side', 'thick dark wooden log wall seen from above'],
  cave: ['indoor:cave', 'a rocky cave floor of dark brown-grey packed earth and small stones'],
  cave2: ['indoor:cave2', 'a rocky cave floor of dark brown-grey packed earth with a few cracks'],
  cave_wall: ['indoor:cave_wall', 'a rough cave rock wall seen from the front, dark brown-grey stone'],
  cave_top: ['indoor:cave_top', 'the dark rocky top of a cave wall seen from above, almost black brown stone'],
};
Object.keys(GROUND2).forEach((k) => {
  add({
    id: `ground_${k}`, group: 'Ground (other)', file: `ground/${k}.png`, gen: '1024x1024', final: '256x256 tile', mode: 'texture',
    targets: [GROUND2[k][0]], prompt: `${TEXTURE} ${GROUND2[k][1]}.`,
    wrap: k === 'wall_low' ? 'x' : undefined, // one row high: only its sides join up
    match: { cave2: 'indoor:cave', floor2: 'indoor:floor' }[k], // the same average colour as its pair
    tone: { tilled: 'dry', tilled_wet: 'wet' }[k], // dry and wet soil must look clearly different
  });
});

// ---------- 2. objects that sit on one tile (cut out) ----------
const TILE_OBJ = {
  fence_h: ['tiles:fenceH', 'a section of rustic wooden ranch fence running left to right, two horizontal rails between posts, filling the full width so it joins with the next section', true],
  fence_v: ['tiles:fenceV', 'a section of rustic wooden ranch fence running away from the camera (top to bottom of the picture), seen from above, filling the full height so it joins with the next section', true],
  fence_post: ['tiles:fencePost', 'a single sturdy rustic wooden fence post'],
  rock: ['tiles:rock', 'a small grey boulder with moss, decoration'],
  stump: ['tiles:stump', 'an old tree stump with rings on top, decoration'],
  shipbox: ['tiles:shipbox', 'a wooden shipping crate for selling crops, with metal corners and a small brass latch'],
  sign: ['tiles:sign', 'a small wooden signpost with a blank board'],
  d_weed: ['tiles:d_weed', 'a clump of wild green weeds growing in a farm field'],
  d_branch: ['tiles:d_branch', 'a fallen dry tree branch lying on the ground'],
  d_stone: ['tiles:d_stone', 'a small grey stone lying on the ground'],
  d_stump: ['tiles:d_stump', 'a big old tree stump with roots, blocking a farm field'],
  d_boulder: ['tiles:d_boulder', 'a big heavy grey boulder with a crack, blocking a farm field'],
  mine_rock: ['indoor:mine_rock', 'a breakable rock in a mine, grey-brown with small mineral flecks'],
  ladder_down: ['indoor:ladder_down', 'a square hole in a cave floor with the top of a wooden ladder going down into darkness'],
  ladder_up: ['indoor:ladder_up', 'a wooden ladder leaning against a cave wall, going up'],
  hay: ['ranch:hay', 'a stack of golden hay bales'],
  trough: ['ranch:trough', 'a wooden animal feeding trough with hay in it'],
};
Object.keys(TILE_OBJ).forEach((k) => {
  const [target, desc, fill] = TILE_OBJ[k];
  add({
    id: `obj_${k}`, group: 'Objects on one tile', file: `objects/${k}.png`, gen: '1024x1024', final: '256x256 tile',
    mode: fill ? 'fill' : 'sprite', targets: [target], prompt: `${STYLE} ${desc}. ${CUTOUT}`,
  });
});

// ---------- 3. seasonal trees, bushes and tall grass (4 seasons in one picture) ----------
[['tree', 'tree', 'a big round leafy fruit-orchard tree with a short trunk, filling most of the cell', 'tree'],
  ['bush', 'bush', 'a small round leafy bush', 'sprite'],
  ['tallgrass', 'tallgrass', 'a clump of tall wild grass', 'sprite']].forEach(([id, kind, desc, mode]) => {
  add({
    id: `seasonal_${id}`, group: 'Seasonal plants', file: `seasonal/${id}.png`, gen: '1024x1024',
    final: kind === 'tree' ? '512x512 (2x2 tiles) x 4 seasons' : '256x256 x 4 seasons', mode: mode === 'tree' ? 'tree4' : 'season4', kind: kind,
    targets: SEASONS.map((s) => `season:${kind}:${s}`),
    prompt: `${STYLE} The same ${desc} shown four times, once per season. ${GRID(2, 2)} Top-left: ${SEASON_LOOK.spring}. ` +
      `Top-right: ${SEASON_LOOK.summer}. Bottom-left: ${SEASON_LOOK.fall}. Bottom-right: ${SEASON_LOOK.winter}. ${CUTOUT}`,
  });
});

// ---------- 4. buildings drawn into the map tiles ----------
const BLOCKS = [
  ['house', 'tiles', 5, 4, "the farmer's cozy little farmhouse: red tiled roof with a chimney, cream walls, two flower-box windows, a wooden front door in the exact center of the front wall"],
  ['shop', 'tiles', 6, 4, "Lily's seed stand: an open-front wooden market stall with a striped red and white awning, crates of seed packets and vegetables, a counter in the middle of the front"],
  ['pond', 'tiles', 5, 4, 'a natural farm pond of clear blue water with rounded stones and reeds around the edge and two lily pads'],
  ['barn', 'ranch', 3, 3, 'a classic red farm barn with white trim and big double doors in the middle of the front'],
  ['coop', 'ranch', 2, 2, 'a small wooden chicken coop on short legs with a little ramp and a round door'],
];
BLOCKS.forEach(([name, sheet, w, h, desc]) => {
  add({
    id: `building_${name}`, group: 'Farm buildings', file: `buildings/${name}.png`, gen: w > h ? '1536x1024' : '1024x1024',
    final: `${w * 256}x${h * 256} (${w}x${h} tiles)`, mode: 'block', w: w, h: h, targets: [`${sheet}:${name}`],
    prompt: `${STYLE} ${desc}. Front view from the top-down three-quarter camera, the building fills the picture width, ` +
      `its base along the bottom. Footprint ${w} tiles wide by ${h} tall. ${CUTOUT}`,
  });
});

// ---------- 5. props: furniture, town buildings, decorations (one picture each) ----------
const PROP_DESC = {
  bed: 'a cozy single wooden bed with a blue quilt and a white pillow, seen from above at an angle, headboard at the top',
  bed2: 'a cozy double bed for two with a pink quilt and two pillows, headboard at the top',
  tv: 'a small old-fashioned box television on a little wooden stand',
  table: 'a small square wooden dining table with a white tablecloth and two chairs',
  fireplace: 'a red brick fireplace with a warm crackling fire, seen from the front against a wall',
  kitchen: 'a small cottage kitchen counter with a stove, a sink and cupboards, seen from the front',
  shelf: 'a tall wooden bookshelf full of colorful books, seen from the front against a wall',
  rug: 'a round red and gold woven rug lying flat on the floor',
  plant: 'a small potted green houseplant',
  window: 'a cottage window with pink curtains, seen from the front on a wall',
  wall_calendar: 'a paper wall calendar with a red top, seen from the front',
  doormat: 'a woven brown doormat lying flat on the floor',
  dresser: 'a small wooden chest of drawers with brass handles',
  mayor: "the town hall: a stately cream building with a blue roof, white columns and a double door in the middle of the front",
  inn: 'a cozy two-story village inn with a warm wooden front, a hanging sign board (blank) and a door in the middle of the front',
  forge: "the blacksmith's forge: a grey stone building with a dark slate roof, a smoking chimney, an anvil outside and a door in the middle of the front",
  woodshop: "the carpenter's woodshop: a wooden building with a green roof, stacked planks outside and a door in the middle of the front",
  clinic: "the herbalist's clinic: a small white cottage with a mint-green roof, herb pots and a door in the middle of the front",
  cottage: "Lily's cottage: a small cottage with a pink roof, flower boxes and a door in the middle of the front",
  cabin: "the fisherman's log cabin with a fishing net hanging outside and a door in the middle of the front",
  mine_entrance: 'a mine entrance dug into a rocky hillside, framed with wooden beams, a dark opening in the middle and a mine cart rail',
  fountain: 'a round stone town fountain with water splashing from the top',
  notice: 'a wooden town notice board on two legs with a few pinned paper notes (no readable text)',
  bench: 'a wooden park bench',
  lamp: 'a black iron street lamp with a warm glowing lantern on top',
  flowerbed: 'a long low wooden flower planter full of colorful flowers',
  flower_arch: 'a festival arch covered in pink and white flowers, open in the middle so people walk under it',
  lantern: 'a festival paper lantern on a wooden pole, warm orange glow',
  pumpkin_pile: 'a pile of orange pumpkins and squash with autumn leaves',
  festive_tree: 'a winter festival pine tree decorated with lights, ribbons and a star on top',
  doghouse: 'a little wooden doghouse with a red roof and a round entrance (no name sign)',
  mailbox: 'a blue country mailbox on a wooden post with a red flag',
  house_2: "the farmer's Cottage: a cozy one-story farm cottage with cream plaster walls, a red tiled roof, a stone chimney, two windows with flower boxes",
  house_3: "the farmer's Farmhouse: a two-story farmhouse with cream walls, a red tiled roof, a small front porch on two posts and four windows",
  house_4: "the farmer's Big House: a big two-story house with a wide red roof, a covered front porch, a small balcony and six windows",
  house_5: "the farmer's Country House: a large country house of stone and timber with two chimneys and flower pots along the porch",
  house_6: "the farmer's Manor: a manor house of warm stone with a slate blue roof, tall windows and a small round tower on one side",
  house_7: "the farmer's Grand Manor: a grand manor with two wings, a slate roof, dormer windows and a clock above the door",
  house_8: "the farmer's Villa: an elegant villa with white walls, a terracotta roof, arched windows and balconies with plants",
  house_9: "the farmer's Estate: a large estate house with white columns at the entrance, many windows, two chimneys and a gold weather vane",
  house_10: "the farmer's Mansion: a magnificent mansion with white columns, a grand double door, a dome, many tall windows and gold trim",
  farm_stand: 'a cute wooden farm market stall facing straight toward the viewer: a wooden counter with two shelves of wooden crates, a red and white striped awning on two posts, and a small blank chalkboard price sign hanging from the awning (no readable text), symmetrical left to right, the crates empty',
  order_board: 'a wooden delivery order board facing straight toward the viewer, standing on two short posts, with a small shingled roof and three blank paper order cards pinned in a row, each with a small red pin (no readable text), symmetrical left to right',
  stable: 'a small red wooden horse stable with a crossed-plank door in the middle and a hay bale beside it',
  chest: 'a wooden treasure chest with gold bands and a gold lock',
  aquarium: 'a glass aquarium on a wooden cabinet, with colorful little fish and water plants',
  music_box: 'a pink and gold music box with a little winding key',
  big_plant: 'a tall leafy potted plant in a terracotta pot',
  cat_bed: 'a round woven cat basket with a pink cushion, lying flat on the floor',
  // the bigger town
  bakery: "a cozy town bakery with cream walls, a chocolate-brown roof, pink and white striped awnings over the windows, loaves of bread on display and a little chimney",
  florist: 'a small flower shop with mint green walls, a pink roof, an arched door and pots of colourful flowers along the front',
  post: 'a small post office of warm brick with a blue roof, a blue door and a red post box beside the door',
  library: 'a town library of pale stone with a dark green roof, white columns either side of a big wooden double door, and tall warm windows',
  school: 'a little red country schoolhouse with a grey roof, a small white bell tower with a golden bell on top, and a white double door',
  chapel: 'a small white stone village chapel with a slate blue roof, a pointed steeple with a golden bell, a round stained-glass window and an arched wooden double door',
  vet: "a country veterinarian's clinic with white walls, a green roof with a white paw print, and a green door",
  shack: 'a little seaside fish shack made of light wooden planks with a blue roof, a wide serving hatch and a fish sign by the door',
  townhouse_1: 'a cozy small town house with pale yellow walls, a red roof, a chimney and flowers along the front',
  townhouse_2: 'a cozy small town house with pale blue walls, a blue roof, an arched door and flowers along the front',
  townhouse_3: 'a cozy small town house with lavender walls, a purple roof, a chimney and flowers along the front',
  townhouse_4: 'a cozy small town house with peach walls, a green roof, an arched door and flowers along the front',
  wagon: "a travelling merchant's wooden market wagon with big wheels, a red and gold striped canopy, and colourful goods on its counter",
  gazebo: 'a white wooden park gazebo with a red pointed roof, open sides and a round wooden floor',
  playground: 'a small playground with a blue swing set with two red seats and a yellow and orange slide',
  fruit_stall: 'a small market stall with a green and white striped awning and baskets of colourful fruit',
  cloth_stall: 'a small market stall with a blue and white striped awning and folded colourful fabrics',
  statue: 'a stone statue of a farmer holding up a sheaf of golden wheat, on a square stone pedestal',
  boat: 'a small white and wooden rowboat with two benches, floating, seen from above at an angle',
  umbrella: 'a pink and white beach umbrella over a blue striped beach towel',
  easel: "a painter's wooden easel holding a small landscape painting",
};
Object.keys(PROPS).forEach((name) => {
  const p = PROPS[name];
  if (!PROP_DESC[name]) throw new Error('no prop description for ' + name);
  const gen = p.w > p.h * 1.2 ? '1536x1024' : p.h > p.w * 1.2 ? '1024x1536' : '1024x1024';
  const town = ['mayor', 'inn', 'forge', 'woodshop', 'clinic', 'cottage', 'cabin', 'mine_entrance', 'stable'].includes(name);
  const town2 = !!p.door && !town; // the newer town buildings: say where the door goes
  const decor = ['wagon', 'gazebo', 'playground', 'fruit_stall', 'cloth_stall', 'statue', 'boat', 'umbrella', 'easel'].includes(name);
  const home = /^house_\d+$/.test(name);
  add({
    id: `prop_${name}`, group: home ? 'House levels' : town || town2 ? 'Town buildings' : decor ? 'Town decorations' : 'Props and furniture', file: `props/${name}.png`, gen: gen,
    final: `${p.w * 128}x${p.h * 128} (${p.w}x${p.h} tiles, stored at half size)`, mode: 'prop', w: p.w, h: p.h, targets: [`prop:${name}`],
    prompt: `${STYLE} ${PROP_DESC[name]}. ` + (town2 ? 'Seen from the front, with its front door in the middle of the front wall at the bottom. ' : '') + (home ? 'The house faces straight toward the viewer, NOT turned to the side and NOT drawn at a diagonal, with its front door exactly in the middle of the front wall, symmetrical left to right. ' : '') +
      (p.flat ? 'Lying flat on the ground. ' : 'Its base along the bottom of the picture. ') +
      `Its shape is about ${p.w} wide by ${p.h} tall. ${CUTOUT}`,
  });
});

// ---------- 6. the farmer and the villagers ----------
const WALK = 'Rows from top to bottom: facing the camera (walking down), facing away from the camera (walking up), ' +
  'facing left (side view). Columns from left to right: standing still, mid-step with the left foot forward, mid-step with the right foot forward.';
const FARMER = 'a cheerful young farmer boy with a red baseball cap (a small white patch on the front), brown hair, yellow shirt, blue denim overalls and brown boots, chibi proportions with a big head';
add({
  id: 'char_farmer_walk', group: 'Characters', file: 'characters/farmer_walk.png', gen: '1024x1536', final: '9 frames of 256x384',
  mode: 'frames', sheet: 'player', cols: 3, rows: 3, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], fw: 256, fh: 384, base: 372,
  targets: ['player:walk'],
  prompt: `${STYLE} A walking sprite sheet of ${FARMER}. ${GRID(3, 3)} ${CHAR_GRID} ${WALK} ${CUTOUT}`,
});
add({
  id: 'char_farmer_tools', group: 'Characters', file: 'characters/farmer_tools.png', gen: '1024x1024', final: '6 frames of 256x384',
  mode: 'frames', sheet: 'player', cols: 3, rows: 2, frames: [9, 10, 11, 12, 13, 14], fw: 256, fh: 384, base: 372, targets: ['player:tools'],
  prompt: `${STYLE} A tool-use sprite sheet of ${FARMER}, with EMPTY hands (the game draws the tool). ${GRID(3, 2)} ${CHAR_GRID} ` +
    'Top row, left to right: facing the camera with both arms raised high above the head, facing the camera with both arms swung down in front, ' +
    'facing away from the camera with both arms raised high. Bottom row: facing away with arms swung down in front, facing left with arms raised up and back, ' +
    `facing left with arms swung forward and down. ${CUTOUT}`,
});
const GIRL = 'a cheerful young farmer girl with a pink baseball cap, brown hair in two short pigtails, a pink shirt, lilac overalls and pink boots, chibi proportions with a big head';
add({
  id: 'char_girl_walk', group: 'Characters', file: 'characters/girl_walk.png', gen: '1024x1536', final: '9 frames of 256x384',
  mode: 'frames', sheet: 'player_girl', cols: 3, rows: 3, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], fw: 256, fh: 384, base: 372, targets: ['player_girl:walk'],
  prompt: `${STYLE} A walking sprite sheet of ${GIRL}. ${GRID(3, 3)} ${CHAR_GRID} ${WALK} ${CUTOUT}`,
});
add({
  id: 'char_girl_tools', group: 'Characters', file: 'characters/girl_tools.png', gen: '1536x1024', final: '6 frames of 256x384',
  mode: 'frames', sheet: 'player_girl', cols: 3, rows: 2, frames: [9, 10, 11, 12, 13, 14], fw: 256, fh: 384, base: 372, targets: ['player_girl:tools'],
  prompt: `${STYLE} A tool-use sprite sheet of ${GIRL}, with EMPTY hands, in the same six poses as the farmer boy's tool sheet. ${GRID(3, 2)} ${CHAR_GRID} ${CUTOUT}`,
});
const VILLAGERS = {
  lily: 'Lily, a sweet young woman with long ginger-orange hair, a yellow flower in her hair, a pink dress over a cream blouse and brown shoes',
  hollis: 'Mayor Hollis, a kind old man, bald with white hair at the sides, a white mustache, round glasses, a purple coat over a white shirt and grey trousers',
  bram: 'Bram, a big burly blacksmith with a bald head, a thick brown beard, a grey shirt, a brown leather apron and dark trousers',
  mira: 'Mira, a cheerful young carpenter with short brown hair, an orange bandana, green overalls over a white shirt and brown boots',
  rosa: 'Rosa, a plump friendly middle-aged innkeeper with grey hair in a bun, a red dress and a white apron',
  leo: 'Leo, a relaxed young fisherman with short black hair, an olive bucket hat, a blue vest over a white shirt and khaki trousers',
  ivy: 'Ivy, a calm young herbalist with long dark green hair with a leaf clip, a lilac dress and purple shoes',
  pearl: 'Grandma Pearl, a sweet little old lady with silver hair in a bun, round glasses and a lavender dress over a cream blouse',
  ewan: 'Grandpa Ewan, a cheerful old retired fisherman with a white beard, a navy flat cap, a navy waistcoat, brown trousers and a wooden walking stick',
  pip: 'Pip, an energetic 8-year-old boy with messy brown hair, a blue cap, a red T-shirt, blue shorts and white sneakers (child size, a head shorter than the adults)',
  daisy: 'Daisy, a sweet 6-year-old girl with long blond hair with a white flower, a yellow dress and pink shoes (child size, a head shorter than the adults)',
  clara: 'Clara, a kind young schoolteacher with brown hair in a bun, round glasses and a teal dress with a white collar',
  tomas: 'Father Tomas, a gentle middle-aged village priest with short grey hair, a black cassock with a white collar and black shoes',
  hana: "Hana, a cheerful young baker with black hair in a bun, a white chef's hat, a pink dress and a white apron",
  marco: 'Marco, a charming young travelling merchant with black hair, a neat mustache, a yellow bandana, a red waistcoat over a white shirt and dark trousers',
  sora: 'Sora, a dreamy young male artist with dark blue hair, a red beret, an orange painter\'s coat with paint spots and grey trousers',
  hale: "Dr. Hale, a warm middle-aged woman doctor with grey hair in a bun, glasses, a white doctor's coat, a stethoscope and grey trousers",
  nina: "Nina, a bubbly young nurse with long auburn hair, a white nurse's cap with a red cross and a light blue uniform dress",
  owen: 'Owen, a friendly young veterinarian with ginger hair, a teal shirt under a brown vest and blue jeans',
  poppy: 'Poppy, a sunny young florist with long pink hair with a red flower, a green dress and a cream apron',
  finn: 'Finn, an eager young mail carrier with blond hair, a blue postman\'s cap, a blue uniform jacket, a brown mail satchel and dark trousers',
  elliot: 'Elliot, a quiet young librarian with neat dark brown hair, glasses, a brown sweater vest over a white shirt and grey trousers',
  jules: 'Jules, a cool young woman musician with short purple hair, a red beanie, a black vest over a yellow shirt and black trousers',
};
const SHOPPER_LOOKS = {};
GAME.SHOPPERS.forEach((x) => { SHOPPER_LOOKS[x.key] = x.look; });
Object.assign(VILLAGERS, SHOPPER_LOOKS);
const ORDER = GAME.VILLAGER_ORDER.concat(GAME.SHOPPERS.map((x) => x.key));
ORDER.forEach((v, i) => {
  add({
    id: `char_${v}`, group: SHOPPER_LOOKS[v] ? 'Visitors' : i >= 7 ? 'New villagers' : 'Characters', file: `characters/${v}.png`, gen: '1024x1536', final: '9 frames of 128x192 (stored at half size)',
    mode: 'frames', sheet: 'people', cols: 3, rows: 3, frames: Array.from({ length: 9 }, (_, k) => i * 9 + k), fw: 128, fh: 192, base: 186, sheetCols: 14,
    targets: ['people:' + v],
    prompt: `${STYLE} A walking sprite sheet of ${VILLAGERS[v]}, chibi proportions with a big head, same scale as a small farmer boy. ${GRID(3, 3)} ${CHAR_GRID} ${WALK} ${CUTOUT}`,
  });
});

// ---------- 7. animals (4 poses each, all facing left) ----------
// [name, sheet, row, description, size in the frame (1 = fills it), icon cut from the first pose]
const ANIMALS = [
  ['chicken', 'animals', 0, 'a plump white hen with a red comb', 0.5],
  ['cow', 'animals', 1, 'a friendly black and white dairy cow with a golden bell', 0.98],
  ['dog', 'animals', 2, 'a cute tan puppy dog with a red collar', 0.62],
  ['horse', 'animals', 3, 'a chestnut brown horse with a dark mane and a red saddle', 0.8],
  ['cat', 'animals', 4, 'a cute grey tabby cat with green eyes', 0.5],
  ['pig', 'animals2', 0, 'a cute round pink pig with a curly tail', 0.72, 'pig'],
  ['carabao', 'animals2', 1, 'a gentle dark grey carabao (water buffalo) with big curved horns', 1, 'carabao'],
];
ANIMALS.forEach(([name, sheet, row, desc, size, icon]) => {
  const third = name === 'dog' || name === 'cat' ? 'sitting' : name === 'horse' ? 'standing still' : 'eating, head down to the ground';
  add({
    id: `animal_${name}`, group: 'Animals', file: `animals/${name}.png`, gen: '1024x1024', final: '4 frames of 384x320',
    mode: 'frames', sheet: sheet, cols: 2, rows: 2, row: row, fw: 384, fh: 320, base: 300, size: size, icon: icon, targets: [sheet + ':' + name],
    prompt: `${STYLE} A sprite sheet of ${desc}, side view facing LEFT in every cell. ${GRID(2, 2)} ${CHAR_GRID} ` +
      `Top-left: walking, legs apart. Top-right: walking, the other step. Bottom-left: ${third}. Bottom-right: lying down asleep with eyes closed. ${CUTOUT}`,
  });
});

// ---------- 8. crops ----------
const CROPS = {
  turnip: ['a turnip plant with a few leaves', 'a ripe white and purple turnip bulb peeking out of the soil with big green leaves'],
  potato: ['a young potato plant', 'a bushy potato plant with ripe potatoes showing at the base'],
  strawberry: ['a young strawberry plant with white flowers', 'a strawberry plant full of ripe red strawberries'],
  tomato: ['a young tomato vine on a stake', 'a tomato vine on a stake full of ripe red tomatoes'],
  corn: ['a young green corn stalk', 'a tall corn stalk with ripe golden cobs'],
  carrot: ['young carrot tops', 'ripe orange carrots peeking out of the soil with feathery tops'],
  pumpkin: ['a pumpkin vine with a small green pumpkin', 'a vine with a big ripe orange pumpkin'],
  grass: ['short green fodder grass sprouting', 'a tall thick clump of green fodder grass ready to cut'],
};
const MOUND = 'Growing out of a small mound of tilled brown soil at the bottom center of the cell.';
add({
  id: 'crop_seedling', group: 'Crops', file: 'crops/seedling.png', gen: '1536x1024', final: '2 frames of 256x256', mode: 'frames', sheet: 'crops',
  cols: 2, rows: 1, frames: [0, 1], fw: 256, fh: 256, base: 236, size: 0.62, targets: ['crops:seedling'],
  prompt: `${STYLE} ${GRID(2, 1)} Left: freshly sown seeds in a small mound of tilled soil. Right: a tiny green two-leaf sprout in a small mound of tilled soil. ${CUTOUT}`,
});
Object.keys(CROPS).forEach((crop, i) => {
  add({
    id: `crop_${crop}`, group: 'Crops', file: `crops/${crop}.png`, gen: '1536x1024', final: '2 frames of 256x256', mode: 'frames', sheet: 'crops',
    cols: 2, rows: 1, frames: [2 + i * 2, 3 + i * 2], fw: 256, fh: 256, base: 236, size: 0.92, targets: ['crops:' + crop],
    prompt: `${STYLE} ${GRID(2, 1)} Left: ${CROPS[crop][0]}, still growing. Right: ${CROPS[crop][1]}. ${MOUND} ${CUTOUT}`,
  });
});

// ---------- 9. item icons (16 per picture) ----------
const ICONS = {
  hoe: 'a farming hoe', can: 'a blue watering can', seed_turnip: 'a seed packet with a turnip picture', seed_potato: 'a seed packet with a potato picture',
  seed_strawberry: 'a seed packet with a strawberry picture', turnip: 'a white and purple turnip', potato: 'a potato', strawberry: 'a strawberry',
  coin: 'a shiny gold coin', bolt: 'a yellow lightning bolt (energy)', bag: 'a brown leather backpack', moon: 'a crescent moon (sleep)',
  drop: 'a blue water drop', sparkle: 'a golden sparkle star', crate: 'a wooden shipping crate', tag: 'a price tag',
  egg: 'a white egg', milk: 'a glass milk bottle', chicken_feed: 'a sack of chicken feed', fodder: 'a bundle of hay fodder',
  heart: 'a red heart', chicken: 'a white hen', cow: 'a black and white cow face', bubble: 'an empty white speech bubble',
  seed_tomato: 'a seed packet with a tomato picture', seed_corn: 'a seed packet with a corn picture', seed_carrot: 'a seed packet with a carrot picture',
  seed_pumpkin: 'a seed packet with a pumpkin picture', tomato: 'a red tomato', corn: 'a yellow corn cob', carrot: 'an orange carrot', pumpkin: 'an orange pumpkin',
  spring: 'a pink cherry blossom flower', summer: 'a bright yellow sun', fall: 'an orange maple leaf', winter: 'a white snowflake',
  hoe_1: 'a farming hoe with a copper head', hoe_2: 'a farming hoe with a silver head', hoe_3: 'a farming hoe with a gold head',
  can_1: 'a copper watering can', can_2: 'a silver watering can', can_3: 'a gold watering can',
  axe: 'an axe with a steel head', axe_1: 'an axe with a copper head', axe_2: 'an axe with a silver head', axe_3: 'an axe with a gold head',
  hammer: 'a hammer with a steel head', hammer_1: 'a hammer with a copper head', hammer_2: 'a hammer with a silver head', hammer_3: 'a hammer with a gold head',
  sickle: 'a sickle with a steel blade', sickle_1: 'a sickle with a copper blade', sickle_2: 'a sickle with a silver blade', sickle_3: 'a sickle with a gold blade',
  brush: 'an animal grooming brush', milker: 'a cow milking pail with a hose', rod: 'a fishing rod with a reel', lumber: 'a stack of wooden planks',
  stone: 'a pile of grey stones', ore_copper: 'a lump of copper ore', ore_silver: 'a lump of silver ore', ore_gold: 'a lump of gold ore', gem: 'a sparkling purple gem',
  fish_s: 'a small blue fish', fish_m: 'a medium green fish', fish_l: 'a large orange fish', fish_k: 'a legendary purple and pink king trout',
  herb: 'a sprig of wild green herb', berry: 'a cluster of wild blueberries', mushroom: 'a brown forest mushroom', root: 'a knobby winter root',
  boiled_egg: 'a boiled egg cut in half', hot_milk: 'a steaming mug of hot milk', baked_potato: 'a baked potato with butter', jam: 'a jar of strawberry jam',
  tomato_soup: 'a bowl of tomato soup', grilled_fish: 'a grilled fish on a plate', veggie_stew: 'a bowl of vegetable stew', pumpkin_pie: 'a slice of pumpkin pie',
  mushroom_soup: 'a bowl of creamy mushroom soup', sandwich: 'a sandwich', hot_soup: 'a bowl of hot golden soup', tonic: 'a small green energy tonic bottle',
  egg_l: 'a big golden-brown egg', milk_l: 'a big milk bottle with a gold cap', seed_grass: 'a seed packet with a grass picture', blue_feather: 'a magical blue feather',
  miracle: 'a pink magic potion bottle', rain: 'a rain cloud', storm: 'a storm cloud with lightning', snow: 'a snow cloud',
  ribbon: 'a blue prize ribbon rosette', bobber: 'a red and white fishing bobber', exclaim: 'a red exclamation mark', gift: 'a wrapped gift box with a bow',
  calendar: 'a small calendar', note: 'a music note', dog: 'a cute puppy face', ring: 'a gold wedding ring',
  lunch: 'a lunch box', letter: 'a sealed envelope with a red wax seal', book: 'a green book with a gold star', horse: 'a chestnut horse',
  cat: 'a grey cat face', chest: 'a wooden treasure chest', star: 'a golden star', aquarium: 'a little fish tank', music_box: 'a pink music box',
  big_plant: 'a tall potted plant', cat_basket: 'a cat sleeping in a basket',
};
// the icon order must match Config.ICON_ORDER (read from the game's config)
function iconOrder() {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '00-config.js'), 'utf8'), ctx);
  return ctx.window.Farm.Config.ICON_ORDER;
}
const ORDER_ICONS = iconOrder().slice(0, 110); // the 7 icon pictures; later icons are cut from other art
ORDER_ICONS.forEach((n) => { if (!ICONS[n]) throw new Error('no icon description for ' + n); });
for (let i = 0; i < ORDER_ICONS.length; i += 16) {
  const names = ORDER_ICONS.slice(i, i + 16), n = Math.floor(i / 16) + 1;
  const rows = Math.ceil(names.length / 4);
  add({
    id: `icons_${n}`, group: 'Item icons', file: `icons/icons_${n}.png`, gen: '1024x1024', final: names.length + ' icons of 128x128',
    mode: 'icons', cols: 4, rows: 4, names: names, targets: names.map((x) => 'icon:' + x),
    prompt: `${STYLE} A set of ${names.length} game item icons, each a single object seen from a slight angle, bold and readable at small size. ${GRID(4, 4)} ` +
      `Row by row, left to right: ${names.map((x, k) => (k + 1) + ') ' + ICONS[x]).join('; ')}.` + (rows < 4 ? ' Leave the remaining cells empty.' : '') + ` ${CUTOUT}`,
  });
}

add({
  id: 'icons_town', group: 'Item icons', file: 'icons/icons_town.png', gen: '1024x1024', final: '5 icons of 128x128',
  mode: 'icons', cols: 4, rows: 4, names: ['bread', 'cookie', 'cake', 'bouquet', 'treat'], targets: ['bread', 'cookie', 'cake', 'bouquet', 'treat'].map((x) => 'icon:' + x),
  prompt: `${STYLE} A set of 5 game item icons, each a single object seen from a slight angle, bold and readable at small size. ${GRID(4, 4)} ` +
    'Row by row, left to right: 1) a crusty golden loaf of bread; 2) two round butter cookies with chocolate chips; 3) a small round strawberry cream cake; ' +
    '4) a bouquet of colourful flowers wrapped in pink paper; 5) a bone-shaped animal treat biscuit. Leave the remaining cells empty. ' + CUTOUT,
});

// ---------- 10. effects: bits that fly when tools land (4 pieces per picture, a 2 x 2 grid) ----------
// The order is the effects sheet's rows (see makeArt in tools/art/draw.js).
const FX_KINDS = ['dirt', 'wood', 'stone', 'leaf', 'water', 'dust'];
const FX = {
  dirt: 'small clods of rich brown farm soil that fly up when the ground is dug with a hoe: soft, lumpy, rounded dirt clumps with a lighter top and a darker underside',
  wood: 'small wood chips that fly off when a stump or branch is chopped: light tan splinters, a curled shaving, a wedge-shaped chunk and a piece of bark',
  stone: 'small broken rock fragments that fly off when a stone is smashed: chunky, irregular grey pieces with chipped angular edges, a light top face and a darker side',
  leaf: 'small green leaves and grass bits that fly off when weeds are cut: an oval leaf, a curled leaf, a cut blade of grass and a two-leaf sprig',
  water: 'water for a watering can, in this order: a falling teardrop, a round droplet, a splash crown seen from the front, and a flat oval splash ring seen from above',
  dust: 'soft cartoon dust clouds that puff up from the ground, made of a few overlapping round puffs in pale warm beige with a thin light-brown outline',
};
FX_KINDS.forEach((kind) => {
  add({
    id: `fx_${kind}`, group: 'Effects', file: `effects/fx_${kind}.png`, gen: '1024x1024', final: '4 pieces of 128x128',
    mode: 'fx', kind, targets: [`fx:${kind}`],
    prompt: `${STYLE} A set of 4 ${FX[kind]}, each a slightly different shape. Simple bold shapes that stay readable when shown very small. Arranged as a 2 by 2 grid of equal cells, one piece centered in each cell with lots of empty space around it. ${CUTOUT}`,
  });
});

// ---------- 11. the home: furniture (a grid of pieces per style), wallpapers and floors ----------
// Front-facing pictures (not the three-quarter view of the map art), so furniture lines up with the walls.
const FRONT = STYLE.replace(/Seen from a top-down[^.]*\)\. /, '') + ' For a top-down farming game like Stardew Valley or Harvest Moon.';
const FACING = 'Every piece faces straight toward the viewer, seen from the front and a little above: NOT turned to the side, ' +
  'NOT drawn at a diagonal or isometric angle, symmetrical left to right. Things that lie on the floor are seen from directly above.';
const gridOf = (n) => (n > 12 ? [4, 4] : n > 10 ? [4, 3] : [5, 2]);
const furnJob = (v, types, file) => {
  const st = HOME.styles[v], [cols, rows] = gridOf(types.length);
  const list = types.map((t, k) => `${k + 1}) ${HOME.types[t].what}`).join('; ');
  const empty = cols * rows - types.length;
  add({
    id: 'furn_' + file, group: 'Furniture', file: `furniture/${file}.png`, gen: '1024x1024', final: types.length + ' pieces', mode: 'furn',
    v, types, cols, rows, dims: types.map((t) => { const d = HOME.types[t]; return { key: d.key, w: d.w, h: d.h, place: d.place }; }), targets: types.map((t) => `furn:${v}:${t}`),
    prompt: `${FRONT} A set of ${types.length} pieces of furniture for a cozy farmhouse, all in one matching ${st.name} style: ${st.look}. ${FACING} ` +
      `Arranged as a grid of ${cols} columns by ${rows} rows of equal cells, one piece per cell, each centered in its cell with clear empty space ` +
      `around it, all at the same scale (a chair is small, a wardrobe is tall, a bed is big). No lines between cells. Row by row, left to right: ${list}.` +
      (empty ? ` Leave the last ${empty > 1 ? empty + ' cells' : 'cell'} empty.` : '') + ` ${CUTOUT}`,
  });
};
const ALL_TYPES = HOME.types.map((t, i) => i);
furnJob(0, ALL_TYPES.filter((t) => !HOME.types[t].prop), 'classic_new'); // the classic look already has art for the rest
HOME.styles.forEach((st, v) => {
  if (!v) return;
  furnJob(v, ALL_TYPES.slice(0, 16), st.key + '_a');
  furnJob(v, ALL_TYPES.slice(16), st.key + '_b');
});
['wall', 'floor'].forEach((kind) => {
  const styles = HOME.styles.map((st, v) => v).filter((v) => v);
  const list = styles.map((v, k) => `${k + 1}) ${HOME.styles[v].name}: ${HOME.styles[v].look}`).join('; ');
  add({
    id: 'home_' + kind + 's', group: 'Furniture', file: `furniture/${kind}s.png`, gen: '1536x1024', final: styles.length + ' tiles of 256x256',
    mode: 'surf', kind, styles, cols: 5, rows: 2, targets: styles.map((v) => `indoor:${kind}_${v}`),
    prompt: `${FRONT} A set of ${styles.length} square ${kind === 'wall' ? 'wallpaper' : 'floor'} swatches for a cozy farmhouse, each one a seamless, ` +
      `tileable pattern that fills its square edge to edge, seen straight on, with even lighting and no objects. ` +
      `${kind === 'wall' ? 'Wallpaper patterns (stripes, flowers, motifs) with no skirting board.' : 'Floors: wooden planks, tiles or carpet, seen from directly above.'} ` +
      `Arranged as a grid of 5 columns by 2 rows of equal squares with a little empty space between them. Row by row, left to right: ${list}. ` +
      'Leave the last cell empty. Plain white background around the squares.',
  });
});

// ---------- 12. outdoor decorations for the farm (src/00-outdoor.js) ----------
const OD = GAME.OUTDOOR.types.filter((t) => !t.prop);
const fences = OD.filter((t) => t.kind === 'fence'), paths = OD.filter((t) => t.kind === 'path');
const garden = OD.filter((t) => t.kind === 'hedge' || t.kind === 'prop');
add({
  id: 'yard_fences', group: 'Outdoor decorations', file: 'outdoor/fences.png', gen: '1024x1024', final: fences.length * 3 + ' pieces of 128x128',
  mode: 'yard', cols: 3, rows: fences.length, targets: fences.map((t) => 'yard:' + t.key),
  pieces: [].concat(...fences.map((t) => ['h', 'v', 'p'].map((sh) => ({ name: t.key + ':' + sh, w: 1, h: 1, fill: sh !== 'p' })))),
  prompt: `${STYLE} Fence pieces for a farm, ${fences.length} kinds, one kind per row: ${fences.map((t, k) => (k + 1) + ') ' + t.what).join('; ')}. ` +
    'In every row, left to right: a straight fence section running left to right that fills the full width of its cell (so sections join up side by side); ' +
    'a straight fence section running away from the camera, from the top to the bottom of its cell (so sections join up end to end); and a single fence post on its own. ' +
    `Arranged as a grid of 3 columns by ${fences.length} rows of equal square cells, with a little empty space between cells. ${CUTOUT}`,
});
add({
  id: 'yard_paths', group: 'Outdoor decorations', file: 'outdoor/paths.png', gen: '1024x1024', final: paths.length + ' tiles of 256x256',
  mode: 'yardtex', cols: 2, rows: 2, names: paths.map((t) => t.key), targets: paths.map((t) => 'yard:' + t.key),
  prompt: `${STYLE.replace(/Seen from a top-down[^.]*\)\. /, '')} ${paths.length} square swatches of garden paving seen from directly above, each a seamless, tileable pattern ` +
    `that fills its square edge to edge: ${paths.map((t, k) => (k + 1) + ') ' + t.what).join('; ')}. Arranged as a grid of 2 by 2 squares with a little empty space between them. Plain white background around the squares.`,
});
add({
  id: 'yard_garden', group: 'Outdoor decorations', file: 'outdoor/garden.png', gen: '1024x1024', final: garden.length + ' pieces',
  mode: 'yard', cols: 4, rows: 4, targets: garden.map((t) => 'yard:' + t.key),
  pieces: garden.map((t) => ({ name: t.key, w: t.w, h: t.h })),
  prompt: `${STYLE} A set of ${garden.length} garden and yard decorations for a farm, all in the same style and at the same scale (a small planter is small, a windmill is tall). ` +
    `${GRID(4, 4)} Row by row, left to right: ${garden.map((t, k) => (k + 1) + ') ' + t.what).join('; ')}.` + (garden.length < 16 ? ' Leave the remaining cells empty.' : '') + ` ${CUTOUT}`,
});

module.exports = { jobs, STYLE, CUTOUT, TEXTURE, FX_KINDS };
