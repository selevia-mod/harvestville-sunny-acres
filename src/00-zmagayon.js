// Magayon Peaks (owner, 30 Oct 2026): the third hunting place, the misty slopes of a volcano north of Makiling (not
// snowy: "we dont have snowy place in the philippines"), with the biggest animals: bears, tigers, rhinos and a mammoth.
// All of them charge and take many arrows, so it opens after 40 hunts. Rules are in 01-logicD.js, the world in 19v-wild.js.
// This file loads after every other 00- file on purpose: its icons go at the very end of C.ICON_ORDER, so no older icon
// moves in the items sheet (tools/art/magayon-import.js paints them).
(function (F) {
  'use strict';
  var C = F.Config, WI = C.WILD;

  // (owner, 31 Oct: they pay well, so they come back after 15 minutes, not 6: a round here is worth a day's farming)
  WI.order.push('bear', 'mammoth', 'tiger', 'rhino'); // rows of assets/wild.png, after the others
  Object.assign(WI.animals, {
    bear: { name: 'Bear', respawn: 15, px: 148, w: 1.7, ground: true, kg: 180, hp: 5, walk: 0.7, run: 3.6, angry: 3, hit: 12, drops: [['meat_bear', 2, 1], ['fur_bear', 1, 0.6], ['claw_bear', 1, 0.5]] },
    mammoth: { name: 'Mammoth', respawn: 15, px: 172, w: 2.9, ground: true, kg: 4000, hp: 9, walk: 0.5, run: 3, angry: 2.4, hit: 18, drops: [['meat_mammoth', 4, 1], ['wool_mammoth', 1, 0.7], ['tusk_mammoth', 1, 0.5]] },
    tiger: { name: 'Tiger', respawn: 15, px: 202, w: 1.9, ground: true, kg: 200, hp: 5, walk: 0.8, run: 4.4, angry: 4, hit: 14, drops: [['pelt_tiger', 1, 1], ['claw_tiger', 1, 0.6]] },
    rhino: { name: 'Rhino', respawn: 15, px: 214, w: 2.1, ground: true, kg: 1500, hp: 7, walk: 0.5, run: 3.8, angry: 3, hit: 16, drops: [['hide_rhino', 1, 1], ['horn_rhino', 1, 0.5]] },
  });
  WI.areas.magayon = { name: 'Magayon Peaks', animals: { bear: 3, tiger: 2, rhino: 2, mammoth: 1 }, unlock: 40,
    shut: 'Magayon is bear and tiger country', opened: 'MAGAYON PEAKS IS OPEN\nKanor: "Forty hunts! Few hunters get this far. Take the trail north out of Makiling. Bears, tigers, rhinos, and they say a mammoth. Bring plenty of arrows and food."' };
  WI.areas.makiling.shut = 'Makiling is wild boar and wolf country';
  WI.areas.makiling.opened = 'MAKILING FOREST IS OPEN\nKanor: "Ten hunts! You are ready for the forest. Follow the trail north. Mind the wild boars, and the wolves at night."';
  // jobs: the third value says what must be open first (1 Makiling, 2 Magayon)
  WI.trophies.push(
    { type: 'trophy_rhino', needs: [['horn_rhino', 2]], gold: 1500 },
    { type: 'bear_rug', needs: [['fur_bear', 3], ['claw_bear', 2]], gold: 1500 },
    { type: 'tiger_rug', needs: [['pelt_tiger', 3], ['claw_tiger', 2]], gold: 2000 },
    { type: 'trophy_mammoth', needs: [['tusk_mammoth', 2]], gold: 3000 }
  );
  WI.jobs.push(['fur_bear', 2, 2], ['claw_bear', 2, 2], ['wool_mammoth', 2, 2], ['pelt_tiger', 2, 2], ['hide_rhino', 2, 2]);

  var ITEMS = {
    meat_bear: { name: 'Bear Meat', kind: 'meat', sell: 80, desc: 'Rich, dark meat. Cook it into Kaldereta.' },
    fur_bear: { name: 'Bear Fur', kind: 'hunt', sell: 170, desc: 'A heavy brown fur.' },
    claw_bear: { name: 'Bear Claw', kind: 'hunt', sell: 120, desc: 'A big curved claw.' },
    meat_mammoth: { name: 'Mammoth Meat', kind: 'meat', sell: 90, desc: 'One steak feeds a family. Cook it into Bistek.' },
    wool_mammoth: { name: 'Mammoth Wool', kind: 'hunt', sell: 200, desc: 'Shaggy reddish wool.' },
    tusk_mammoth: { name: 'Mammoth Tusk', kind: 'hunt', sell: 320, desc: 'A long curved tusk.' },
    pelt_tiger: { name: 'Tiger Pelt', kind: 'hunt', sell: 260, desc: 'Orange with dark stripes.' },
    claw_tiger: { name: 'Tiger Claw', kind: 'hunt', sell: 160, desc: 'A sharp pale claw.' },
    hide_rhino: { name: 'Rhino Hide', kind: 'hunt', sell: 240, desc: 'Thick grey hide.' },
    horn_rhino: { name: 'Rhino Horn', kind: 'hunt', sell: 340, desc: 'A heavy horn.' },
    kaldereta: { name: 'Kaldereta', kind: 'dish', energy: 95, sell: 190, desc: 'A rich tomato stew with potato and carrot.' },
    bistek: { name: 'Bistek', kind: 'dish', energy: 100, sell: 220, desc: 'Sliced steak with onion rings and rice.' },
  };
  Object.keys(ITEMS).forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  Object.keys(ITEMS).forEach(function (id) {
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
  });

  C.FOOD_GROUPS.meat.push('meat_bear', 'meat_mammoth');
  C.RECIPES.push({ dish: 'kaldereta', needs: ['meat_bear', 'potato', 'carrot'] }, { dish: 'bistek', needs: ['meat_mammoth', 'onion', 'rice'] });

  // the way out of each place towards the others (the goal arrow follows these)
  var R = C.ROUTES;
  R.magayon = { farm: 'trail_south', house: 'trail_south', town: 'trail_south', mine: 'trail_south', pulag: 'trail_south', makiling: 'trail_south' };
  ['farm', 'house', 'mine', 'town'].forEach(function (m) { R[m].magayon = R[m].pulag; });
  R.pulag.magayon = 'trail_north';
  R.makiling.magayon = 'trail_north';
})(window.Farm = window.Farm || {});
