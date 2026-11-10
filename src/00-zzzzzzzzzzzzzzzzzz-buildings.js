// Edit Farm (owner, 10 Nov 2026: "the defense, their house, farmland and others need to be moveable so they can make
// their farm the best way possible"; docs/edit-farm.md). The buildings the farm map used to draw, as yard pieces.
// Appended (a save keeps a piece's place in C.OUTDOOR.types): only ever add at the end.
// mask: a row a string, read from the farm map they came from (maps/farm.json before tools/edit-farm-map.js):
//   '#' solid, '.' open grass, 'D' the house door (solid: you face it from the tile below), 'W' water (solid),
//   'P' the pen's grass, 'Y' the dog's grass, 'G' the pen's gate (open), 'S' Lily's counter (solid: you shop from the
//   tile below), 'M' the mailbox (solid), 'I' the incubator (solid), 'H' where the horse waits (open).
(function (F) {
  'use strict';
  var C = F.Config, O = C.OUTDOOR;
  var NEW = [
    // the house with its mailbox on the right
    { key: 'farmhouse', name: 'Farmhouse', w: 6, h: 4, building: 'house', keep: true,
      mask: ['#####.', '#####.', '#####.', '##D##M'] },
    // the barn (left), the coop and its incubator (right), the pen below with its gate on the right
    { key: 'ranch', name: 'Animal Ranch', w: 9, h: 9, building: 'ranch', keep: true, hd: 'ranch',
      mask: ['#########', '####.II##', '####.II.#', '#####...#', '#PPPPPPPG', '#PPPPPPPG', '#PPPPPPP#', '#PPPPPPP#', '#########'] },
    // the doghouse at the back, a low fence on the sides, open at the front
    { key: 'dog_yard', name: 'Dog Yard', w: 4, h: 5, building: 'dog', hd: 'dog_yard',
      mask: ['####', '#YY#', '#YY#', '#YY#', 'YYYY'] },
    { key: 'farm_pond', name: 'Pond', w: 5, h: 4, building: 'pond', hd: 'farm_pond',
      mask: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'] },
    { key: 'seed_stand', name: "Lily's Seed Stand", w: 6, h: 4, building: 'shop', one: true,
      mask: ['######', '######', '######', '##SS##'] },
    { key: 'stable_yard', name: 'Stable', w: 3, h: 4, building: 'stable', one: true, prop: 'stable',
      mask: ['...', '###', '###', '.H.'] },
    { key: 'field_plot4', name: 'Field', kind: 'plot', w: 4, h: 4, foot: 0, fieldPlot: true, hd: 'ws_farm_plot',
      mask: ['....', '....', '....', '....'] },
    { key: 'field_plot42', name: 'Field', kind: 'plot', w: 4, h: 2, foot: 0, fieldPlot: true, hd: 'ws_farm_plot',
      mask: ['....', '....'] },
  ];
  NEW.forEach(function (t) {
    t.kind = t.kind || 'prop';
    t.cat = 'none';
    t.price = 0;
    t.beauty = 0;
    t.foot = t.foot == null ? 1 : t.foot; // (the mask decides what is solid: L.yardSolid)
    O.index[t.key] = O.types.length;
    O.types.push(t);
  });
  // Where the farm map drew each one (tile coordinates of the top-left): every farm starts with them here.
  C.BUILDINGS = {
    home: [['farmhouse', 4, 3], ['ranch', 2, 27], ['dog_yard', 11, 5], ['farm_pond', 15, 3], ['farm_pond', 34, 10], ['farm_pond', 34, 20],
      ['seed_stand', 14, 28]],
    stable: ['stable_yard', 18, 32],
    field: { x0: 4, y0: 11, x1: 19, y1: 24 }, // the old field, 16 x 14: twelve 4x4 plots, and four 4x2 for the last 2 rows
  };
})(window.Farm = window.Farm || {});
