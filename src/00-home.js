// The farmhouse: its levels (1 to 10 for now; add rows to grow it), the furniture catalog (27 kinds of
// furniture, each in 5 styles plus 5 festival editions), wallpapers and floors, and the Home Beauty score.
// Read by the game and by the art tools (tools/make-art.js draws a sheet of furniture per style).
(function (F) {
  'use strict';
  var C = F.Config;

  C.HOME = {
    // map = the house map's size in tiles, walls included (the floor is x 1..w-2, y 2..h-2; the door is at
    // x 5..6 on the bottom row). Upgrades are built by Mira and take `days`.
    levels: [
      { name: 'Cozy Cabin', map: [8, 10], gold: 0, lumber: 0, stone: 0, days: 0 },
      { name: 'Cottage', map: [10, 10], gold: 3000, lumber: 50, stone: 0, days: 1 },
      { name: 'Farmhouse', map: [12, 10], gold: 8000, lumber: 100, stone: 30, days: 2 },
      { name: 'Big House', map: [14, 11], gold: 15000, lumber: 150, stone: 60, days: 2 },
      { name: 'Country House', map: [15, 12], gold: 25000, lumber: 200, stone: 100, days: 3 },
      { name: 'Manor', map: [16, 12], gold: 40000, lumber: 250, stone: 150, days: 3 },
      { name: 'Grand Manor', map: [17, 13], gold: 60000, lumber: 300, stone: 200, days: 4 },
      { name: 'Villa', map: [18, 13], gold: 90000, lumber: 400, stone: 250, days: 4 },
      { name: 'Estate', map: [19, 14], gold: 130000, lumber: 500, stone: 350, days: 5 },
      { name: 'Mansion', map: [20, 14], gold: 200000, lumber: 600, stone: 500, days: 5 },
    ],
    marryLevel: 3, // the Farmhouse has room for two (it replaces the old House Extension)
    door: [5, 6], // door columns on the bottom row, the same on every level

    // place: floor (stands on the floor; foot = solid rows at the bottom), wall (hangs on the back wall, y = 0),
    // flat (lies on the floor, can be walked over). prop = the classic style's art (an existing prop picture).
    // use = what the action button does with it.
    types: [
      { key: 'bed', name: 'Bed', w: 2, h: 2, foot: 2, place: 'floor', price: 800, beauty: 10, use: 'sleep', prop: 'bed', what: 'a single bed' },
      { key: 'double_bed', name: 'Double Bed', w: 3, h: 2, foot: 2, place: 'floor', price: 3000, beauty: 20, use: 'sleep', prop: 'bed2', what: 'a double bed for two with two pillows' },
      { key: 'table', name: 'Table', w: 2, h: 2, foot: 1, place: 'floor', price: 600, beauty: 8, prop: 'table', what: 'a square dining table' },
      { key: 'chair', name: 'Chair', w: 1, h: 1, foot: 1, place: 'floor', price: 250, beauty: 4, what: 'a wooden chair' },
      { key: 'sofa', name: 'Sofa', w: 2, h: 2, foot: 1, place: 'floor', price: 1500, beauty: 14, what: 'a two-seat sofa' },
      { key: 'armchair', name: 'Armchair', w: 1, h: 2, foot: 1, place: 'floor', price: 900, beauty: 9, what: 'a cosy armchair' },
      { key: 'rug', name: 'Rug', w: 3, h: 2, foot: 0, place: 'flat', price: 500, beauty: 8, prop: 'rug', what: 'a large oval rug lying flat on the floor, seen from above' },
      { key: 'doormat', name: 'Doormat', w: 2, h: 1, foot: 0, place: 'flat', price: 150, beauty: 2, prop: 'doormat', what: 'a doormat lying flat, seen from above' },
      { key: 'plant', name: 'Potted Plant', w: 1, h: 1, foot: 1, place: 'floor', price: 300, beauty: 5, prop: 'plant', what: 'a small potted plant' },
      { key: 'big_plant', name: 'Tall Plant', w: 1, h: 2, foot: 1, place: 'floor', price: 600, beauty: 8, prop: 'big_plant', what: 'a tall potted plant' },
      { key: 'floor_lamp', name: 'Floor Lamp', w: 1, h: 2, foot: 1, place: 'floor', price: 500, beauty: 6, what: 'a tall floor lamp with a glowing shade' },
      { key: 'shelf', name: 'Bookshelf', w: 2, h: 2, foot: 0, place: 'wall', price: 700, beauty: 8, prop: 'shelf', what: 'a bookshelf full of books' },
      { key: 'fireplace', name: 'Fireplace', w: 2, h: 2, foot: 0, place: 'wall', price: 2500, beauty: 18, prop: 'fireplace', what: 'a fireplace with a warm fire' },
      { key: 'window', name: 'Window', w: 2, h: 1, foot: 0, place: 'wall', price: 600, beauty: 6, prop: 'window', what: 'a window with curtains' },
      { key: 'painting', name: 'Painting', w: 2, h: 1, foot: 0, place: 'wall', price: 800, beauty: 10, what: 'a framed landscape painting' },
      { key: 'calendar', name: 'Wall Calendar', w: 1, h: 1, foot: 0, place: 'wall', price: 200, beauty: 3, prop: 'wall_calendar', what: 'a wall calendar' },
      { key: 'mirror', name: 'Mirror', w: 1, h: 1, foot: 0, place: 'wall', price: 500, beauty: 6, what: 'a round wall mirror' },
      { key: 'dresser', name: 'Dresser', w: 2, h: 2, foot: 1, place: 'floor', price: 1200, beauty: 10, prop: 'dresser', what: 'a chest of drawers' },
      { key: 'wardrobe', name: 'Wardrobe', w: 2, h: 3, foot: 1, place: 'floor', price: 2000, beauty: 14, what: 'a tall two-door wardrobe' },
      { key: 'nightstand', name: 'Nightstand', w: 1, h: 1, foot: 1, place: 'floor', price: 400, beauty: 5, what: 'a small bedside table with a lamp' },
      { key: 'desk', name: 'Desk', w: 2, h: 2, foot: 1, place: 'floor', price: 1100, beauty: 9, what: 'a writing desk with a chair' },
      { key: 'clock', name: 'Grandfather Clock', w: 1, h: 2, foot: 1, place: 'floor', price: 1800, beauty: 12, what: 'a tall grandfather clock' },
      { key: 'tv', name: 'TV', w: 1, h: 1, foot: 1, place: 'floor', price: 1500, beauty: 8, use: 'tv', prop: 'tv', what: 'a small television on a stand' },
      { key: 'kitchen', name: 'Kitchen Counter', w: 3, h: 2, foot: 1, place: 'floor', price: 4000, beauty: 15, use: 'kitchen', prop: 'kitchen', needs: 'kitchen', what: 'a kitchen counter with a stove and a sink' },
      { key: 'music_box', name: 'Music Box', w: 1, h: 1, foot: 1, place: 'floor', price: 800, beauty: 8, use: 'musicbox', prop: 'music_box', what: 'a music box on a little table' },
      { key: 'aquarium', name: 'Aquarium', w: 2, h: 2, foot: 1, place: 'floor', price: 1500, beauty: 15, use: 'aquarium', prop: 'aquarium', what: 'a fish tank on a cabinet' },
      { key: 'cat_bed', name: 'Cat Basket', w: 1, h: 1, foot: 0, place: 'flat', price: 600, beauty: 6, use: 'cat', prop: 'cat_bed', what: 'a cat basket with a cushion' },
      // trophies: made by Kanor (C.WILD.trophies), in the classic sheet only (tools/art/trophies-import.js), never sold
      { key: 'trophy_antler', name: 'Antler Trophy', w: 1, h: 1, foot: 0, place: 'wall', price: 0, beauty: 14, trophy: true, what: 'a pair of deer antlers on a wooden wall plaque' },
      { key: 'trophy_tusk', name: 'Tusk Trophy', w: 1, h: 1, foot: 0, place: 'wall', price: 0, beauty: 16, trophy: true, what: 'two boar tusks on a wooden wall plaque' },
      { key: 'wolf_rug', name: 'Wolf Pelt Rug', w: 3, h: 2, foot: 0, place: 'flat', price: 0, beauty: 22, trophy: true, what: 'a grey wolf pelt rug lying flat on the floor' },
      { key: 'trophy_stag', name: 'White Stag Trophy', w: 2, h: 1, foot: 0, place: 'wall', price: 0, beauty: 40, trophy: true, what: 'shining white antlers on a dark wooden wall plaque' },
      { key: 'trophy_goldboar', name: 'Golden Boar Trophy', w: 2, h: 1, foot: 0, place: 'wall', price: 0, beauty: 45, trophy: true, what: 'two gleaming golden tusks on a dark wooden wall plaque' },
      { key: 'trophy_rhino', name: 'Rhino Horn Trophy', w: 1, h: 1, foot: 0, place: 'wall', price: 0, beauty: 30, trophy: true, what: 'a heavy rhino horn on a round wooden wall plaque' },
      { key: 'bear_rug', name: 'Bear Fur Rug', w: 3, h: 2, foot: 0, place: 'flat', price: 0, beauty: 32, trophy: true, what: 'a dark brown bear fur rug lying flat on the floor' },
      { key: 'tiger_rug', name: 'Tiger Pelt Rug', w: 3, h: 2, foot: 0, place: 'flat', price: 0, beauty: 38, trophy: true, what: 'a striped orange tiger pelt rug lying flat on the floor' },
      { key: 'trophy_mammoth', name: 'Mammoth Tusks', w: 2, h: 1, foot: 0, place: 'wall', price: 0, beauty: 55, trophy: true, what: 'two long crossed mammoth tusks on a dark wooden wall plaque' },
    ],

    // styles: the 5 regular ones (always in the catalog) and 5 festival editions (sold during their
    // festival's season). price and beauty multiply the furniture's own.
    styles: [
      { key: 'classic', name: 'Classic', price: 1, beauty: 1, look: 'honey-brown wood and cream fabric (the original look)' },
      { key: 'rustic', name: 'Rustic', price: 1.2, beauty: 1.2, look: 'rough-hewn pine logs, wrought iron and red checkered cloth' },
      { key: 'cottage', name: 'Cottage', price: 1.4, beauty: 1.4, look: 'white-painted wood with pastel pink and mint fabric and small flower patterns' },
      { key: 'modern', name: 'Modern', price: 1.7, beauty: 1.6, look: 'clean light grey and white with light oak and soft blue accents' },
      { key: 'royal', name: 'Royal', price: 2.5, beauty: 2.2, look: 'dark polished mahogany, deep red velvet and gold trim' },
      { key: 'flower', name: 'Flower Festival', price: 2, beauty: 2, festival: 'flower', look: 'cream wood painted with pink cherry blossoms and spring flowers' },
      { key: 'fireworks', name: 'Fireworks', price: 2, beauty: 2, festival: 'fireworks', look: 'navy blue with gold stars and colourful firework bursts' },
      { key: 'harvest', name: 'Harvest', price: 2, beauty: 2, festival: 'harvest', look: 'warm orange and brown with pumpkins, wheat and autumn leaves' },
      { key: 'cowfest', name: 'Cow Festival', price: 2, beauty: 2, festival: 'cowfest', look: 'black and white cow spots, red gingham and little golden bells' },
      { key: 'starry', name: 'Starry Night', price: 2, beauty: 2, festival: 'starry', look: 'deep blue with silver snowflakes and twinkling stars' },
    ],
    wallPrice: 500, // wallpapers and floors cost this x the style's price; classic ones are free
    wallBeauty: 6, // ...and add this x the style's beauty (each)

    // Home Beauty tiers: [from score, name, extra max energy]
    tiers: [[0, 'Plain', 0], [120, 'Cozy', 5], [250, 'Charming', 10], [450, 'Lovely', 15], [750, 'Dreamy', 20]],
    dupe: 0.5, // a second copy of the same piece counts this much

    // the classic furniture in a new Cozy Cabin: [type key, x, y]
    starter: [['window', 1, 0], ['shelf', 3, 0], ['fireplace', 5, 0], ['bed', 1, 2], ['tv', 4, 2], ['plant', 6, 2],
      ['rug', 2, 5], ['table', 3, 5], ['doormat', 5, 8]],

    comments: [ // what villagers say about the home, by tier (1 and up)
      null,
      ["Your place looks cozy! I'd love to see it sometime.", 'I hear your cabin is really homey now.'],
      ['Everyone says your home is charming. You have a good eye!', 'I peeked in your window... so charming! Sorry!'],
      ['Your home is the loveliest in the valley!', "That house of yours... I could live there. Just saying!"],
      ['People come from all over to see your home. It is a dream!', 'Your house is the talk of Willowbrook. Simply dreamy.'],
    ],
  };

  // look things up by key
  C.HOME.typeIndex = {};
  C.HOME.types.forEach(function (t, i) { C.HOME.typeIndex[t.key] = i; });
  C.HOME.styleIndex = {};
  C.HOME.styles.forEach(function (st, i) { C.HOME.styleIndex[st.key] = i; });
})(window.Farm = window.Farm || {});
