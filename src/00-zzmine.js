// The deeper Mine (owner, 1-2 Nov 2026): every 200 floors the rocks hold richer things, and the cave changes colour.
// Floors 1 to 200 are the Mine as it always was. A band drops its cheapest ore, and adds one new ore and one new gem, each
// worth double; the chances stay those of C.MINE.drops. Past floor 1,200 it stays the Star Core. The first time you reach
// a band your energy bar grows by 10 and the lift by the entrance stops there. Rules: 01-logicF.js, the cave: 19y-mine.js,
// the lift's and rocks' looks are drawn there too. Icons: tools/art/mine-import.js (recoloured until the real art comes).
(function (F) {
  'use strict';
  var C = F.Config;

  // ids: the four things after stone, from most to least common. look: how the cave is recoloured, dark to light, for
  // the floor, the walls and the rocks; shard: the colours of the crystals growing out of a rock, dark to light.
  // The lift stops every 50 floors you have reached: 1, 51, 101 ... (owner, 4 Nov 2026: "every floor for now is risky. We
  // want players to spend time"; 50 or 100 to be tried on the phone). Each cave's first floor is one of them.
  C.MINE.liftEvery = 50;
  C.MINE.bands = [
    { from: 1, key: 'cave', name: 'The Mine', ids: ['ore_copper', 'ore_silver', 'ore_gold', 'gem'] },
    { from: 201, key: 'crystal', name: 'Purple Crystal Caves', ids: ['ore_silver', 'ore_gold', 'crystal', 'amethyst'], look: {
      floor: ['#1a1030', '#4a3370', '#8a6cb4'], wall: ['#0e0820', '#2c1c50', '#5c4490'], rock: ['#2a1a4c', '#6a54a0', '#c4b0ec'], shard: ['#4a1fa0', '#9a5cf0', '#ecd8ff'] } },
    { from: 401, key: 'jade', name: 'Green Jade Deep', ids: ['ore_gold', 'crystal', 'jade', 'emerald'], look: {
      floor: ['#0a2018', '#1f5442', '#529a7c'], wall: ['#04140e', '#123a2c', '#2e6c54'], rock: ['#123a2c', '#3f8468', '#a8e0c4'], shard: ['#0a6a44', '#2fc486', '#d4ffe8'] } },
    { from: 601, key: 'obsidian', name: 'Black Obsidian Halls', ids: ['crystal', 'jade', 'obsidian', 'ruby'], look: {
      floor: ['#08080e', '#25222e', '#55505f'], wall: ['#030306', '#14121c', '#38343f'], rock: ['#0c0b14', '#3a3644', '#a29ab4'], shard: ['#6a0a18', '#d92a3c', '#ffc0b8'] } },
    { from: 801, key: 'moonstone', name: 'Blue Moonstone Depths', ids: ['jade', 'obsidian', 'moonstone', 'sapphire'], look: {
      floor: ['#0c1a38', '#27477c', '#6288bc'], wall: ['#060e24', '#16305c', '#37588e'], rock: ['#16305c', '#5478ac', '#cfe2f8'], shard: ['#123a9c', '#3f8cf0', '#e0f4ff'] } },
    { from: 1001, key: 'star', name: 'Golden Star Core', ids: ['obsidian', 'moonstone', 'starstone', 'diamond'], look: {
      floor: ['#2a1a06', '#7a5216', '#c89a3e'], wall: ['#180e02', '#54360c', '#9c7026'], rock: ['#54360c', '#b88a34', '#ffeeb0'], shard: ['#b87a10', '#ffd24a', '#fffbe0'] } },
  ];

  // appended: icon numbers are saved, so the sheet only grows at its end
  var ITEMS = {
    crystal: ['Crystal', 300, 'A cluster of pale purple crystal from the deep caves.'],
    amethyst: ['Amethyst', 800, 'A deep purple stone from the Purple Crystal Caves.'],
    jade: ['Jade', 600, 'Smooth green stone from the Jade Deep.'],
    emerald: ['Emerald', 1600, 'A bright green gem from the Jade Deep.'],
    obsidian: ['Obsidian', 1200, 'Black volcanic glass from the Obsidian Halls.'],
    ruby: ['Ruby', 3200, 'A blood red gem from the Obsidian Halls.'],
    moonstone: ['Moonstone', 2400, 'It glows a little, even in the dark.'],
    sapphire: ['Sapphire', 6400, 'A blue gem from the Moonstone Depths.'],
    starstone: ['Starstone', 4800, 'Warm to the touch, from the Star Core.'],
    diamond: ['Diamond', 12800, 'The rarest thing in the Mine.'],
  };
  Object.keys(ITEMS).forEach(function (id) {
    C.ICON_ORDER.push(id);
    C.ICON[id] = C.ICON_ORDER.length - 1;
    C.ITEMS[id] = { name: ITEMS[id][0], icon: C.ICON[id], kind: 'ore', sell: ITEMS[id][1], desc: ITEMS[id][2] };
  });

  // Saffron buys them too. Her "wanted today" stays among her old goods, which anyone can bring.
  C.TRADER.wantedFrom = C.TRADER.buys.slice();
  Array.prototype.push.apply(C.TRADER.buys, Object.keys(ITEMS));

  // appended: the save keeps which badges are done by their place in this list
  C.MINE.bands.slice(1).forEach(function (b, i) {
    C.ACHIEVEMENTS.push({ key: 'band_' + b.key, name: b.name, desc: 'Reach floor ' + b.from.toLocaleString('en-US') + ' of the mine.', test: ['deepest', b.from], stars: [2, 2, 3, 3, 5][i] });
  });
})(window.Farm = window.Farm || {});
