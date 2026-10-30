// Hunting that the rest of the game needs (owner, 30 Oct 2026): the Tannery, hunted materials for the top upgrades (and
// the Market, for those who would rather buy them), dishes with a power, and the Great Mammoth, a weekend hunt for two
// or more. Loaded last: everything is appended, so older saves keep working. Rules in 01-logicD.js, the world in 19v-wild.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;
  var O = C.OUTDOOR;
  var H = C.HOME;

  // ---------- new goods (art: tools/art/hunt2-import.js) ----------
  var ITEMS = {
    leather_soft: { name: 'Soft Leather', kind: 'hunt', sell: 130, desc: 'Tanned from rabbit fur. Lily needs it for the biggest bags.' },
    leather_thick: { name: 'Thick Leather', kind: 'hunt', sell: 200, desc: 'Tanned from a wolf pelt. Lily and Mira both need it.' },
    leather_tough: { name: 'Tough Leather', kind: 'hunt', sell: 360, desc: 'Tanned from rhino hide. For the very biggest bag.' },
    great_tusk: { name: 'Great Tusk', kind: 'hunt', sell: 1500, desc: 'From the Great Mammoth. Kanor can make a trophy of three.' },
  };
  Object.keys(ITEMS).forEach(function (id) { if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  Object.keys(ITEMS).forEach(function (id) {
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
  });

  // ---------- the Tannery: a workshop like the Bakery ----------
  C.WORKSHOPS.tannery = {
    name: 'Tannery', slots: 3, desc: 'Turns furs and hides into leather.',
    recipes: [
      { out: 'leather_soft', mins: 45, needs: [['fur_rabbit', 3]] },
      { out: 'leather_thick', mins: 60, needs: [['pelt_wolf', 1]] },
      { out: 'leather_tough', mins: 90, needs: [['hide_rhino', 1]] },
    ],
  };
  C.WORKSHOP_KEYS.push('tannery');
  C.WORKSHOPS.tannery.recipes.forEach(function (r) { C.MADE_IN[r.out] = 'tannery'; });
  O.index.tannery = O.types.length;
  O.types.push({ key: 'tannery', name: 'Tannery', kind: 'prop', cat: 'workshops', w: 3, h: 3, foot: 2, price: 5000, beauty: 4, farm2: true, one: true, hd: 'ws_tannery', what: 'a bamboo tannery with a thatched roof' });
  O.cats.filter(function (c) { return c[0] === 'workshops'; })[0][2] = 'A Bakery, a Dairy, a Jam Maker and a Tannery: they make goods while you play (or sleep).';

  // ---------- hunted materials for the top upgrades ([item, how many]) ----------
  // Only the last of each. What you have already bought is yours; hunters can sell these at the Market to those who do not hunt.
  C.BAG_NEEDS = { 8: [['leather_soft', 5]], 9: [['leather_soft', 5]], 10: [['leather_thick', 5]], 11: [['leather_thick', 5]], 12: [['leather_tough', 5]] }; // by bag level
  C.UPGRADES[2].needs = [['tusk', 2]]; // Gold tools
  [['Villa', [['leather_thick', 10]]], ['Estate', [['wool_mammoth', 10]]], ['Mansion', [['tusk_mammoth', 5]]]].forEach(function (e) {
    H.levels.filter(function (l) { return l.name === e[0]; })[0].needs = e[1];
  });

  // ---------- dishes with a power: 10 minutes on the clock, one at a time ----------
  C.DISH_POWER_MINS = 10;
  C.DISH_POWERS = {
    tinola: { key: 'crop', text: '20% chance of an extra crop at harvest' },
    rabbit_stew: { key: 'sneak', text: 'shy animals notice you less' },
    venison_tapa: { key: 'tools', text: 'tools use 20% less energy' },
    boar_adobo: { key: 'charge', text: 'charges cost half the energy' },
    inihaw: { key: 'bow', text: 'your Bow reaches 1 tile further' },
    kaldereta: { key: 'mine', text: 'the mine uses 30% less energy' },
    bistek: { key: 'walk', text: 'you walk 20% faster' },
  };
  Object.keys(C.DISH_POWERS).forEach(function (id) { C.ITEMS[id].desc += ' For ' + C.DISH_POWER_MINS + ' minutes, ' + C.DISH_POWERS[id].text + '.'; });

  // ---------- the Great Mammoth: Saturday and Sunday in Magayon, for two or more ----------
  WI.order.push('greatmammoth'); // a row of assets/wild.png (the mammoth, darker)
  WI.animals.greatmammoth = {
    name: 'Great Mammoth', px: 172, w: 3.9, ground: true, kg: 7000, hp: 108, walk: 0.5, run: 3, angry: 2.8, hit: 20, great: true, hpEach: 12, minHits: 3, respawn: 4320, // (3 days: once a weekend)
   
    drops: [['meat_mammoth', 6, 1], ['wool_mammoth', 2, 1], ['tusk_mammoth', 1, 1]],
  };
  WI.areas.magayon.extra = (WI.areas.magayon.extra || []).concat([{ kind: 'greatmammoth', n: 1, when: 'great' }]);
  H.types.push({ key: 'trophy_great_mammoth', name: 'Great Mammoth Trophy', w: 2, h: 1, foot: 0, place: 'wall', price: 0, beauty: 80, trophy: true, what: 'two huge gold-veined tusks on a dark wooden wall plaque with gold trim' });
  H.typeIndex.trophy_great_mammoth = H.types.length - 1;
  WI.trophies.push({ type: 'trophy_great_mammoth', needs: [['great_tusk', 3]], gold: 5000 });
})(window.Farm = window.Farm || {});
