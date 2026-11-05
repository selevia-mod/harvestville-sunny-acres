'use strict';
// Art that is downloaded when needed instead of living in the page (owner, 3 Nov 2026: "users need to download assets
// to see the skin, or they can download it while playing", like Mobile Legends). build.js leaves these out of
// dist/index.html and writes each to dist/packs/<key>.<hash>.webp, for the CDN (app-assets/packs/). The game
// asks the app for them (src/10b-packs.js). A pack's names and words for players are in src/10b-packs.js.
const fs = require('fs');
const path = require('path');
const ASSETS = path.join(__dirname, '..', 'assets');
const WILD_PROPS = ['trail_sign', 'pili_tree', 'hot_spring', 'sulfur_vent', 'lava_boulder', 'charred_log', 'abaca', 'ash_fern', 'rainforest_tree',
  'mud_spring', 'mossy_log', 'fern_bush', 'mushroom_rock', 'jungle_grass', 'hunters_lodge', 'pine_tree', 'boulder_moss', 'bamboo_bush', 'wildflowers',
  'tall_grass', 'arrow_fly'];
// (6 Nov 2026, the page was 19.46 MB of its 19.5 MiB: these came out of it)
// The furniture styles past Classic (furn_1, furn_2, ...) and their beds with the farmer asleep in them
// (props/sleepbed[2]_v<style>_<boy|girl>). Classic (furn_0, props/sleepbed[2]_<who>) stays in the page: it is what a
// style's piece shows as until its sheet is in (19zl2-packs-art.js).
const STYLES = fs.readdirSync(ASSETS).filter((f) => /^furn_[1-9]\d*\.png$/.test(f)).map((f) => f.slice(0, -4))
  .concat(fs.readdirSync(path.join(ASSETS, 'props')).filter((f) => /^sleepbed2?_v\d+_(boy|girl)\.png$/.test(f)).map((f) => 'props/' + f.slice(0, -4)))
  .sort();
module.exports = {
  // Pulag, Makiling and Magayon: their animals, Kanor, the bow poses, the flying arrow and the props only they use
  // (not the Lair's art: a phone with the Wild Lands on it already must keep reaching the Lair offline)
  wild: ['wild', 'wildshade', 'wildgrass', 'kanor', 'archer', 'archer_girl'].concat(WILD_PROPS.map((n) => 'props/' + n))
    .concat(require('./places/banaue-art').packed()), // (Banaue Terraces' pictures, once they are in: owner, 6 Nov 2026)
  // the farmers in their party hats, on their birthday
  party: ['player_bday', 'player_girl_bday'],
  // the furniture styles a farmer buys at Mira's (and sees in friends' houses)
  styles: STYLES,
};
