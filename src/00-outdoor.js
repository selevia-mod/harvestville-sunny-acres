// Outdoor decorations for the farm (Phase 2): fences, paths and hedges placed tile by tile, and garden pieces,
// yard furniture, lights and festival editions placed like furniture. They add to Home Beauty.
// Read by the game and by the art tools (tools/art/outdoor.js draws the 'yard' sheet from this list).
(function (F) {
  'use strict';
  var C = F.Config;

  C.FARM_W = 38; // the farm map's width in tiles (it was 24 before the yard; older saves are moved over)

  C.OUTDOOR = {
    // kind: fence (solid, joins its neighbours), path (flat, walk on it), hedge (solid block), prop (like
    // furniture: w x h tiles, foot = solid rows at the bottom, flat = lies on the ground).
    // cat: the catalog page. prop = an existing prop picture to use (the rest are drawn in the yard sheet).
    // festival: sold only in that festival's season.
    types: [
      { key: 'wood_fence', name: 'Wooden Fence', kind: 'fence', cat: 'fences', price: 40, beauty: 1, what: 'a rustic wooden ranch fence' },
      { key: 'picket_fence', name: 'Picket Fence', kind: 'fence', cat: 'fences', price: 60, beauty: 2, what: 'a white picket fence' },
      { key: 'stone_wall', name: 'Stone Wall', kind: 'fence', cat: 'fences', price: 80, beauty: 2, what: 'a low wall of rounded grey field stones' },
      { key: 'iron_fence', name: 'Iron Fence', kind: 'fence', cat: 'fences', price: 100, beauty: 3, what: 'an elegant black wrought iron fence with gold tips' },
      { key: 'stone_path', name: 'Stone Path', kind: 'path', cat: 'paths', price: 30, beauty: 1, what: 'grey flagstone paving' },
      { key: 'brick_path', name: 'Brick Path', kind: 'path', cat: 'paths', price: 40, beauty: 1, what: 'red brick paving in a herringbone pattern' },
      { key: 'gravel_path', name: 'Gravel Path', kind: 'path', cat: 'paths', price: 20, beauty: 1, what: 'light beige gravel with small pebbles' },
      { key: 'wood_deck', name: 'Wooden Deck', kind: 'path', cat: 'paths', price: 50, beauty: 2, what: 'warm wooden deck planks' },
      { key: 'hedge', name: 'Hedge', kind: 'hedge', cat: 'paths', price: 80, beauty: 2, what: 'a neatly trimmed square green hedge block' },
      { key: 'flower_hedge', name: 'Flowering Hedge', kind: 'hedge', cat: 'paths', price: 120, beauty: 3, what: 'a square green hedge block dotted with pink flowers' },

      { key: 'flower_bed', name: 'Flower Bed', kind: 'prop', cat: 'garden', w: 2, h: 1, foot: 1, price: 300, beauty: 8, prop: 'flowerbed', what: 'a raised wooden flower bed' },
      { key: 'planter', name: 'Planter', kind: 'prop', cat: 'garden', w: 1, h: 1, foot: 1, price: 150, beauty: 4, what: 'a terracotta planter box with red geraniums' },
      { key: 'rose_bush', name: 'Rose Bush', kind: 'prop', cat: 'garden', w: 1, h: 1, foot: 1, price: 200, beauty: 5, what: 'a round green rose bush covered in red roses' },
      { key: 'sunflowers', name: 'Sunflowers', kind: 'prop', cat: 'garden', w: 1, h: 2, foot: 1, price: 180, beauty: 5, what: 'a clump of three tall sunflowers' },
      { key: 'apple_tree', name: 'Apple Tree', kind: 'prop', cat: 'garden', w: 2, h: 3, foot: 1, price: 800, beauty: 12, what: 'a round leafy apple tree with red apples' },
      { key: 'cherry_tree', name: 'Cherry Blossom', kind: 'prop', cat: 'garden', w: 2, h: 3, foot: 1, price: 900, beauty: 14, what: 'a cherry blossom tree in full pink bloom' },
      { key: 'garden_pond', name: 'Garden Pond', kind: 'prop', cat: 'garden', w: 3, h: 2, foot: 2, price: 1500, beauty: 18, what: 'a small oval garden pond edged with stones, with lily pads' },
      { key: 'fountain', name: 'Fountain', kind: 'prop', cat: 'garden', w: 3, h: 3, foot: 2, price: 3000, beauty: 30, prop: 'fountain', what: 'a stone fountain' },
      { key: 'birdbath', name: 'Birdbath', kind: 'prop', cat: 'garden', w: 1, h: 2, foot: 1, price: 400, beauty: 7, what: 'a stone birdbath on a pedestal with a little blue bird' },
      { key: 'scarecrow', name: 'Scarecrow', kind: 'prop', cat: 'garden', w: 1, h: 2, foot: 1, price: 250, beauty: 5, what: 'a friendly scarecrow with a straw hat and a patched shirt' },

      { key: 'bench', name: 'Bench', kind: 'prop', cat: 'yard', w: 2, h: 1, foot: 1, price: 400, beauty: 7, prop: 'bench', what: 'a park bench' },
      { key: 'picnic_table', name: 'Picnic Table', kind: 'prop', cat: 'yard', w: 2, h: 2, foot: 1, price: 700, beauty: 10, what: 'a wooden picnic table with a red checked cloth and a basket' },
      { key: 'swing', name: 'Garden Swing', kind: 'prop', cat: 'yard', w: 2, h: 2, foot: 1, price: 900, beauty: 12, what: 'a wooden A-frame garden swing seat with cushions' },
      { key: 'lamp', name: 'Lamp Post', kind: 'prop', cat: 'yard', w: 1, h: 2, foot: 1, price: 300, beauty: 5, prop: 'lamp', what: 'a lamp post' },
      { key: 'garden_umbrella', name: 'Garden Umbrella', kind: 'prop', cat: 'yard', w: 2, h: 2, foot: 1, price: 500, beauty: 8, prop: 'umbrella', what: 'an umbrella' },
      { key: 'birdhouse', name: 'Birdhouse', kind: 'prop', cat: 'yard', w: 1, h: 2, foot: 1, price: 300, beauty: 6, what: 'a little wooden birdhouse on a tall post' },
      { key: 'well', name: 'Wishing Well', kind: 'prop', cat: 'yard', w: 2, h: 2, foot: 2, price: 1200, beauty: 14, what: 'a round stone wishing well with a little wooden roof and a bucket' },
      { key: 'statue', name: 'Statue', kind: 'prop', cat: 'yard', w: 2, h: 3, foot: 1, price: 2500, beauty: 25, prop: 'statue', what: 'a statue' },
      { key: 'windmill', name: 'Windmill', kind: 'prop', cat: 'yard', w: 2, h: 3, foot: 2, price: 4000, beauty: 35, what: 'a small wooden garden windmill with four white sails' },
      { key: 'gazebo', name: 'Gazebo', kind: 'prop', cat: 'yard', w: 4, h: 4, foot: 2, price: 6000, beauty: 50, prop: 'gazebo', what: 'a gazebo' },

      { key: 'flower_arch', name: 'Flower Arch', kind: 'prop', cat: 'festival', w: 3, h: 2, foot: 0, price: 1500, beauty: 20, prop: 'flower_arch', festival: 'flower', what: 'a flower arch' },
      { key: 'paper_lanterns', name: 'Paper Lantern', kind: 'prop', cat: 'festival', w: 1, h: 2, foot: 1, price: 600, beauty: 10, prop: 'lantern', festival: 'fireworks', what: 'a lantern' },
      { key: 'pumpkin_pile', name: 'Pumpkin Pile', kind: 'prop', cat: 'festival', w: 2, h: 1, foot: 1, price: 500, beauty: 10, prop: 'pumpkin_pile', festival: 'harvest', what: 'pumpkins' },
      { key: 'hay_bales', name: 'Hay Bales', kind: 'prop', cat: 'festival', w: 2, h: 1, foot: 1, price: 500, beauty: 10, festival: 'cowfest', what: 'two round golden hay bales with a blue ribbon rosette' },
      { key: 'festive_tree', name: 'Starry Tree', kind: 'prop', cat: 'festival', w: 2, h: 3, foot: 1, price: 1500, beauty: 20, prop: 'festive_tree', festival: 'starry', what: 'a festive tree' },
    ],
    cats: [['fences', 'Fences', 'Wood, picket, stone and iron. They join up as you place them.'],
      ['paths', 'Paths and hedges', 'Paths you can walk on, and hedges to frame your garden.'],
      ['garden', 'Garden', 'Flower beds, trees, a pond, a fountain and more.'],
      ['yard', 'Yard and lights', 'Benches, a swing, lamps, a well, a windmill, a gazebo.'],
      ['festival', 'Festival editions', 'Only sold during their festival season.']],
    starter: [['wood_fence', 8], ['flower_bed', 1], ['bench', 1]], // a gift in storage to get started
  };

  C.OUTDOOR.index = {};
  C.OUTDOOR.types.forEach(function (t, i) { t.w = t.w || 1; t.h = t.h || 1; t.foot = t.foot == null ? (t.kind === 'path' ? 0 : 1) : t.foot; C.OUTDOOR.index[t.key] = i; });
})(window.Farm = window.Farm || {});
