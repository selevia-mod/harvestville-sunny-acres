// More land (owner, 2 Nov 2026): six blocks of 10 by 10 tiles on the right side of the farm, behind the old tree line.
// They sell one at a time, each for twice the last, 630,000G in all, nearest the way in first. Until then a block is
// grass with a fence around it and a For Sale sign. Rules: 01-logicE.js; on the map: 19x-land.js, tools/widen-farm.js.
// The field's own fence is yard pieces too now (owner, 2 Nov: "allow users to move the default fence"): every farm has
// them placed, free and adding no beauty, drawn like the Wooden Fence. They are not sold.
(function (F) {
  'use strict';
  var C = F.Config;
  var block = function (x0, y0, sign) { return { x0: x0, y0: y0, x1: x0 + 9, y1: y0 + 9, sign: sign }; };
  C.LAND = {
    x0: 38, // from here on, the map is the land: nothing is placed outside the blocks you own
    blocks: [
      block(40, 25, [40, 29]), block(40, 14, [40, 18]), block(40, 3, [40, 7]),
      block(51, 25, [51, 29]), block(51, 14, [51, 18]), block(51, 3, [51, 7]),
    ],
    prices: [10000, 20000, 40000, 80000, 160000, 320000],
    fence: [], // [x, y] of the field's fence, with the gates at the top (6, 7) and the bottom (11, 12)
  };
  for (var x = 3; x <= 20; x++) {
    if (x !== 6 && x !== 7) C.LAND.fence.push([x, 10]);
    if (x !== 11 && x !== 12) C.LAND.fence.push([x, 25]);
  }
  for (var y = 11; y <= 24; y++) C.LAND.fence.push([3, y], [20, y]);

  var O = C.OUTDOOR;
  O.types.push({ key: 'field_fence', name: 'Field Fence', kind: 'fence', cat: 'none', price: 0, beauty: 0, w: 1, h: 1, foot: 1, like: 'wood_fence', what: 'the fence around your field' });
  O.index.field_fence = O.types.length - 1;
})(window.Farm = window.Farm || {});
