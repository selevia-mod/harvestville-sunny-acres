// The owner's pictures of the new places' props (owner, 6 Nov 2026; art-src/places/<place>/props_<place>.png, 3 x 2):
// what each of the six is, in the sheet's order (tools/art/places-import.js cuts them into props/<place>_<kind>), and,
// for the maps made with other places' props as stand-ins (maps/taal.json, sierra.json, palawan.json), which stand-in
// each one takes the place of (src/19zzzzzzz-place-art.js; a list: they take turns, so a forest is not all one tree).
// Banaue's props and Chocolate Hills' are their maps' own objects (19zzzzzz-place-11-banaue.js, -12-bohol.js).
(function (F) {
  'use strict';
  var C = F.Config;
  C.PLACE_PROP_KINDS = {
    bohol: ['hill', 'hut', 'palm', 'fence', 'cogon', 'rock'],
    taal: ['banca', 'reeds', 'mango', 'steamrock', 'hut', 'pier'],
    sierra: ['narra', 'rattan', 'waterfall', 'balete', 'junglegrass', 'log'],
    palawan: ['karst', 'mangrove', 'bangka', 'redbush', 'palm', 'junglegrass'],
  };
  C.PLACE_PROP_SWAP = {
    taal: { boat: 'banca', shack: 'hut', bamboo_bush: 'reeds', tall_grass: 'reeds', lava_boulder: 'steamrock', rainforest_tree: 'mango' },
    sierra: { rainforest_tree: ['narra', 'balete'], bamboo_bush: 'rattan', mossy_log: 'log', jungle_grass: 'junglegrass', boulder_moss: 'waterfall' },
    palawan: { boulder_moss: 'karst', rainforest_tree: 'mangrove', boat: 'bangka', pili_tree: 'palm', fern_bush: 'redbush', bamboo_bush: 'redbush', jungle_grass: 'junglegrass' },
  };
  // the maps whose grass and water take the owner's ground pictures (ground_<place>, ground_<place>_water) at run time
  // (Chocolate Hills does its own; Banaue has its own tileset)
  C.PLACE_GROUND = ['taal', 'sierra', 'palawan'];
})(window.Farm = window.Farm || {});
