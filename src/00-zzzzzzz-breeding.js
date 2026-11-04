// Animal breeds and colours (owner, 4 Nov 2026: "animal breeds and colours, and rare ones to collect"). Each farm
// animal comes in a few colours; the first is the art as it is, the others are drawn by recolouring its frames once
// (19zz-breeding.js, the recipe in L.breedPixel: 01-logicZ-breeding.js). Lily's shop sells the common colours; a chick
// or calf takes after its parents, and now and then one is born in a rare colour. The Breeds book (in the Collection)
// shows what you have found, with a prize for each kind found in full.
// A breed's paint: which pixels of the art are its coat (sel), and the colours they become, dark to light (ramp),
// by how light they were (range: the lightness the ramp spans). A colour with a real picture (art-src/breeds, by its
// key: breed_<animal>_<key>.png; all of them since 5 Nov 2026) shows that instead; the paint stays as its fallback.
(function (F) {
  'use strict';
  var C = F.Config;

  C.BREEDS = {
    chicken: [
      { key: 'white', name: 'White Hen', desc: 'The classic farm hen.' },
      { key: 'brown', name: 'Brown Hen', desc: 'Warm brown feathers.', paint: { sel: 'pale', ramp: ['#5a3018', '#a8652f', '#dca46a'], range: [0.42, 1] } },
      { key: 'black', name: 'Black Hen', desc: 'Glossy black, a little green in the sun.', paint: { sel: 'pale', ramp: ['#101216', '#262c32', '#4c565a'], range: [0.42, 1] } },
      { key: 'golden', name: 'Golden Hen', rare: true, desc: 'Shines like the morning sun.', paint: { sel: 'pale', ramp: ['#6a3604', '#d88e10', '#ffc62a', '#fff0a0'], range: [0.42, 1.2] } },
    ],
    cow: [
      { key: 'spotted', name: 'Spotted Cow', desc: 'Black spots on white.' },
      { key: 'brown', name: 'Brown Spotted Cow', desc: 'Chocolate spots on white.', paint: { sel: 'dark', ramp: ['#2a160a', '#6a3a1c', '#9a5e32'], range: [0, 0.42] } },
      { key: 'tan', name: 'Tan Cow', desc: 'Soft and fawn all over.', paint: { sel: 'neutral', ramp: ['#3a2210', '#a06a3a', '#f0d2a0'], range: [0, 1] } },
      { key: 'highland', name: 'Highland Cow', rare: true, desc: 'A thick red-gold coat from the hills.', paint: { sel: 'neutral', ramp: ['#4a1206', '#c2501c', '#ffc27a'], range: [0, 1] } },
    ],
    pig: [
      { key: 'pink', name: 'Pink Pig', desc: 'Round, pink and happy.' },
      { key: 'black', name: 'Native Black Pig', desc: 'The baboy ramo\'s tame cousin.', paint: { sel: 'pink', ramp: ['#141012', '#3a3034', '#7a6c70'], range: [0.3, 1] } },
      { key: 'ginger', name: 'Ginger Pig', desc: 'Red-gold bristles.', paint: { sel: 'pink', ramp: ['#5a200c', '#c0602a', '#f4b07a'], range: [0.3, 1] } },
      { key: 'moon', name: 'Moonlight Pig', rare: true, desc: 'Pale silver, with a blue shine.', paint: { sel: 'pink', ramp: ['#3c4468', '#9aa8d4', '#f6f8ff'], range: [0.3, 1] } },
    ],
    carabao: [
      { key: 'grey', name: 'Grey Carabao', desc: 'Strong and gentle.' },
      { key: 'mud', name: 'Mud Brown Carabao', desc: 'Loves a good wallow.', paint: { sel: 'grey', ramp: ['#1e120a', '#5e4030', '#a0806a'], range: [0, 0.72] } },
      { key: 'albino', name: 'White Carabao', rare: true, desc: 'A rare pink-white carabao. Good luck, they say.', paint: { sel: 'grey', ramp: ['#9a6466', '#e4b2ae', '#fff2ee'], range: [0, 0.72] } },
    ],
  };

  C.BREEDING = {
    rare: 1 / 25, // a newborn's chance of a rare colour
    rareKin: 1 / 5, // ... when one of its parents is rare itself
    likeMother: 0.5, // a common newborn: its mother's colour, else its father's (or any common one)
    bonus: 1, // a rare animal gives this many more of its produce each morning it was fed
    // completing a kind in the Breeds book
    prize: { chicken: { gold: 1000, item: 'miracle' }, cow: { gold: 2500, item: 'miracle' }, pig: { gold: 2000, item: 'miracle' }, carabao: { gold: 3000, item: 'miracle' } },
    potion: ['cow', 'pig', 'carabao'], // the Miracle Potion works on these now (it was cows only)
  };

  if (C.ITEMS.miracle) C.ITEMS.miracle.desc = 'Give to a cow, pig or carabao with 2+ hearts and a baby arrives in 7 days.';
})(window.Farm = window.Farm || {});
