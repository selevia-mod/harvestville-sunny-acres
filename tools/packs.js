'use strict';
// Art that is downloaded when needed instead of living in the page (owner, 3 Nov 2026: "users need to download assets
// to see the skin, or they can download it while playing", like Mobile Legends). build.js leaves these out of
// dist/index.html and writes each to dist/packs/<key>.<hash>.webp, for the CDN (app-assets/packs/). The game
// asks the app for them (src/10b-packs.js). A pack's names and words for players are in src/10b-packs.js.
const WILD_PROPS = ['trail_sign', 'pili_tree', 'hot_spring', 'sulfur_vent', 'lava_boulder', 'charred_log', 'abaca', 'ash_fern', 'rainforest_tree',
  'mud_spring', 'mossy_log', 'fern_bush', 'mushroom_rock', 'jungle_grass', 'hunters_lodge', 'pine_tree', 'boulder_moss', 'bamboo_bush', 'wildflowers',
  'tall_grass', 'arrow_fly'];
module.exports = {
  // Pulag, Makiling and Magayon: their animals, Kanor, the bow poses, the flying arrow and the props only they use
  wild: ['wild', 'wildshade', 'wildgrass', 'kanor', 'archer', 'archer_girl'].concat(WILD_PROPS.map((n) => 'props/' + n))
    .concat(require('./places/banaue-art').packed()), // (Banaue Terraces' pictures, once they are in: owner, 6 Nov 2026)
  // the farmers in their party hats, on their birthday
  party: ['player_bday', 'player_girl_bday'],
};
