// Farm tech (owner, 4 Nov 2026: "Give this to agent and start building it"): sprinklers that keep their tiles watered,
// fertilizer and crop quality (normal, Silver and Gold crops that sell for more), and a greenhouse where any crop grows
// in any season. Rules 01-logicZ-farmtech.js; on the farm and in the shops 19zz-farmtech.js; the tours
// 19zz-farmtech-tours.js. Loaded after every other 00- file: its icons go at the very end of C.ICON_ORDER (drawn by
// tools/art/farmtech-icons.js until real art comes: art-src/FARMTECH-PROMPTS.md).
(function (F) {
  'use strict';
  var C = F.Config;
  var O = C.OUTDOOR;

  // ---------- sprinklers: made at Bram's Forge from gold and ore ----------
  // reach: the tiles around it that it keeps watered ('plus' = the 4 beside it, 'ring' = the 8 around it, 'big' = the
  // 5x5 around it). Placed on a tilled tile with no crop; tap it to pick it up again.
  C.SPRINKLERS = [
    { id: 'sprinkler_copper', name: 'Copper Sprinkler', reach: 'plus', gold: 800, ore: 'ore_copper', n: 3, what: 'Waters the 4 tiles beside it.' },
    { id: 'sprinkler_silver', name: 'Silver Sprinkler', reach: 'ring', gold: 2000, ore: 'ore_silver', n: 3, what: 'Waters the 8 tiles around it.' },
    { id: 'sprinkler_gold', name: 'Gold Sprinkler', reach: 'big', gold: 4500, ore: 'ore_gold', n: 3, what: 'Waters the 24 tiles around it (5x5).' },
  ];

  // ---------- fertilizer and crop quality ----------
  // A bag of fertilizer covers the 3x3 tilled patch around a tile, before or just after planting (seeds or a sprout),
  // and lasts until that crop is picked. A hand-picked crop comes out Normal, Silver or Gold; the chances are below
  // (each crop star from Crop stars adds a little more), Silver sells for 1.5 times and Gold for 2 times the price.
  C.QUALITY = {
    names: ['', 'Silver', 'Gold'],
    mult: [1, 1.5, 2],
    chance: [ // [Silver, Gold] by fertilizer level: none, Fertilizer, Rich Fertilizer
      [0.1, 0.02],
      [0.3, 0.1],
      [0.4, 0.25],
    ],
    star: [0.03, 0.02], // more [Silver, Gold] for each crop star (Bronze, Silver, Gold mastery)
  };
  C.FERTS = [
    { id: 'fert', level: 1, name: 'Fertilizer' },
    { id: 'fert_rich', level: 2, name: 'Rich Fertilizer' },
  ];

  // ---------- the greenhouse: one, from Mira (Outdoor, More land) ----------
  // A 4x3 glass house of soil: any crop grows there in any season, its misters keep it watered, and no weeds come in.
  C.GREENHOUSE = { w: 4, h: 3, price: 12000 };

  var ITEMS = {
    sprinkler_copper: { name: 'Copper Sprinkler', kind: 'sprinkler', tier: 0, desc: 'Place it on tilled soil: it keeps the 4 tiles beside it watered.' },
    sprinkler_silver: { name: 'Silver Sprinkler', kind: 'sprinkler', tier: 1, desc: 'Place it on tilled soil: it keeps the 8 tiles around it watered.' },
    sprinkler_gold: { name: 'Gold Sprinkler', kind: 'sprinkler', tier: 2, desc: 'Place it on tilled soil: it keeps the 5x5 around it watered.' },
    fert: { name: 'Fertilizer', kind: 'fert', level: 1, price: 10, desc: 'Spread it on a 3x3 tilled patch. Better odds of Silver and Gold crops.', shop: 'One bag: a 3x3 patch, until its crops are picked. Better odds of Silver and Gold crops.' },
    fert_rich: { name: 'Rich Fertilizer', kind: 'fert', level: 2, price: 30, desc: 'Spread it on a 3x3 tilled patch. The best odds of Silver and Gold crops.', shop: 'The best odds of Silver and Gold crops. One bag: a 3x3 patch, until its crops are picked.' },
  };
  // appended: icon numbers are saved, so the sheet only grows at its end
  Object.keys(ITEMS).forEach(function (id) {
    if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id);
    C.ICON[id] = C.ICON_ORDER.indexOf(id);
    ITEMS[id].icon = C.ICON[id];
    C.ITEMS[id] = ITEMS[id];
  });
  C.SHOP_SUPPLIES.push('fert', 'fert_rich'); // Lily's Seed Stand, Supplies

  // the yard piece (appended: the save keeps a piece's place in this list). kind 'plot': it is soil you till and plant
  // like a Field Plot (01-logicA.js), drawn on a canvas until there is art (19zz-farmtech.js)
  O.index.greenhouse = O.types.length;
  O.types.push({ key: 'greenhouse', name: 'Greenhouse', kind: 'plot', cat: 'land', w: C.GREENHOUSE.w, h: C.GREENHOUSE.h, foot: 0,
    price: C.GREENHOUSE.price, beauty: 0, farm2: true, one: true, gh: true,
    what: 'a small glass greenhouse with a white wooden frame and a peaked glass roof, rows of dark soil inside' });

  // ---------- What's new (the 2.2 entry: these lines come after the others) ----------
  var news = (C.NEWS || []).filter(function (n) { return n.v === '2.2'; })[0];
  if (news) news.lines.push(
    ['sprinkler_silver', 'Sprinklers', 'Bram makes Copper, Silver and Gold Sprinklers. Place one on tilled soil and its tiles stay watered.', 'sprinkler'],
    ['fert', 'Silver and Gold crops', 'Spread Fertilizer from Lily for better odds of Silver and Gold crops. They sell for 1.5 and 2 times the price.', 'quality'],
    ['seed_tulip', 'The Greenhouse', 'Buy one from Mira (Outdoor, More land). Any crop grows inside in any season, and it waters itself. Lily then sells every seed.', 'greenhouse']
  );
})(window.Farm = window.Farm || {});
