// The farm's buildings, round 2 (owner, 11 Nov 2026): "make it barn only, no grass, no fence" (players fence their animals
// themselves to guard the milk and eggs), "just build house only no fence, no grass" for the dog, a new pond, all drawn at
// 30 degrees like the new characters. And "try to walk on the side of the barn pond dog house ... looks like theres an
// invisible blocking": the solid tiles now follow the drawings (assets/props, measured tile by tile), not a box round them.
// The ranch's animals live on an open patch in front of it (pen: nothing can be built on it, fences go round it); the dog
// on the open ground in front of his doghouse (dog). Old farms get their old fences as real pieces once (src/01-logic...farm2.js).
(function (F) {
  'use strict';
  var C = F.Config, O = C.OUTDOOR, T = function (k) { return O.types[O.index[k]]; };
  // the barn (left) and the coop (right); the coop's door and ramp at the bottom (the incubator, used from the pen)
  Object.assign(T('ranch'), { w: 9, h: 4, low: false, back: 0, foot: 4, pen: { dx: 1, dy: 4, w: 7, h: 4 },
    mask: ['.........', '.........', '.#######.', '.#####I#.'] });
  Object.assign(T('dog_yard'), { name: 'Doghouse', w: 2, h: 2, low: false, back: 0, dogTop: 0, foot: 2, dog: { dx: -1, dy: 2, w: 4, h: 2 },
    mask: ['..', '##'] });
  // (water where the pond is drawn: the corners are open ground)
  Object.assign(T('farm_pond'), { low: true, mask: ['.....', '.WWW.', 'WWWWW', 'WWWWW'] });
  C.FARM_BUILDINGS.home.forEach(function (b) { if (b[0] === 'dog_yard') { b[1] = 12; b[2] = 6; } }); // (where the doghouse stood)
  // the old pen's and dog yard's fences, given back as real pieces (free, so never sold for Gold)
  O.types.push({ key: 'ranch_fence', name: 'Ranch Fence', kind: 'fence', cat: 'none', price: 0, beauty: 0, w: 1, h: 1, foot: 1, like: 'picket_fence', what: 'a white ranch fence' });
  O.index.ranch_fence = O.types.length - 1;
})(window.Farm = window.Farm || {});
