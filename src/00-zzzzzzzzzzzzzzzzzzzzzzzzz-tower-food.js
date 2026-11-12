// The Lost Tower's food (owner, 13 Nov 2026: docs/superpowers/specs/2026-11-13-tower-food-design.md). Content only: the rules
// are 01-logicZZZZZZZZZZZZZZZZZZZZZ-tower-food.js, the world 19zzz...z-tower-food.js.
// - Each realm's 3 normal enemies drop its ingredient (1 in 4, your own kills), its guard 2 always. Ingredients never sell.
// - Each realm's dish (the Kitchen) softens the NEXT realm's trick by half, in the Tower, for 15 minutes; one Tower dish at
//   a time (a new one replaces it), beside the farm dishes' powers and the potions.
// - Lugaw ng Parola (farm crops): energy refills 3x faster in the Tower. The Baon: Mang Ilaw sells it for Gold; packed with
//   up to 3 foods, it feeds you by itself in the Tower when your energy falls under 15.
// Icons: drawn stand-ins painted into frames of the items texture (C.FOOD_ICON_BASE, as the Tower shop's), until the
// owner's 'tower_food_icons' picture (128 cells, 8 a row, this order) is in.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;
  var TW = C.TOWER;
  if (!TW || !TW.zones.length) return;

  var TF = C.TOWER_FOOD = {
    mins: 15, // a Tower dish's power, minutes
    chance: 0.25, // a normal enemy's ingredient
    guard: 2, // the guard's, always
    soft: 0.5, // each power halves its trick
    crack: 3, // Bow or Javelin hits that break a shield with Sinigang na Talangka
    noHeal: 5000, // ms an enemy you hit is not healed (Nido Soup)
    sight: 2, // tiles more in the dark (Inihaw na Talaba)
    revive: 2, // a reviver lies this many times as long (Halo-halo)
    refill: 3, // energy comes back this many times faster (Sopas ng Tala, Lugaw)
    feast: 2, // energy back for each enemy you beat (Balut ng Bakunawa)
    baon: { price: 5000, slots: 3, under: 15 },
    dishes: {}, // dish id -> { key, text, zone }
    ings: [], // the ingredients, realm 1 to 10
  };

  // [ingredient id, its name, its desc; dish id, its name, its desc, needs (with the ingredient first), energy, power key, text]
  var ROWS = [
    ['tw_talangka_meat', 'Talangka Meat', 'Sweet meat from the Tide Stairs\' little crabs.',
      'sinigang_talangka', 'Sinigang na Talangka', 'Sour tamarind soup with talangka, tomato and radish.', ['tomato', 'radish'], 70, 'crack',
      'your Bow and Javelin crack shields too: 3 hits break one (the Rifle still 1)'],
    ['tw_pusit', 'Pusit', 'A squid from Pugita\'s Deep, ink and all.',
      'adobong_pusit', 'Adobong Pusit', 'Squid stewed in its ink with garlic, on rice.', ['garlic', 'rice'], 75, 'puddle', 'a puddle slows you half as much'],
    ['tw_kuhol', 'Kuhol', 'Fat swamp snails from Berberoka\'s Swamp.',
      'ginataang_kuhol', 'Ginataang Kuhol', 'Snails in coconut milk with spinach and chili.', ['spinach', 'chili'], 75, 'song', 'a song slows your shooting half as much'],
    ['tw_frog_legs', 'Frog Legs', 'Moon frog legs from Magindara\'s Lagoon.',
      'pritong_palaka', 'Pritong Palaka', 'Crispy fried frog legs with garlic, in an egg batter.', ['garlic', 'egg'], 80, 'pierce',
      'each shot also hits the enemy right behind its target (half damage)'],
    ['tw_swallow_nest', 'Swallow\'s Nest', 'A white nest from the Storm Gallery\'s cliffs.',
      'nido_soup', 'Nido Soup', 'Swallow\'s nest soup with egg drops and ginger.', ['egg', 'ginger'], 80, 'noheal', 'an enemy you hit is not healed for 5 s'],
    ['tw_talaba', 'Talaba', 'Big oysters from the Kataw Court.',
      'inihaw_talaba', 'Inihaw na Talaba', 'Grilled oysters with garlic and onion.', ['garlic', 'onion'], 85, 'sight', 'you see 2 tiles further in the dark'],
    ['tw_santelmo_pepper', 'Santelmo Pepper', 'A pepper that glows like a santelmo. Very hot.',
      'bicol_express', 'Bicol Express', 'Meat in coconut milk with santelmo peppers and onion.', ['meat', 'onion'], 90, 'split', 'a split copy has half its hits'],
    ['tw_mangosteen', 'Golden Mangosteen', 'A golden fruit from Biringan, the invisible city.',
      'halo_halo_biringan', 'Halo-halo ng Biringan', 'Shaved ice, milk, sugarcane syrup and golden mangosteen.', ['milk', 'sugarcane'], 90, 'revive',
      'a beaten enemy stands up 2x slower'],
    ['tw_star_crab', 'Star Crab Meat', 'Shining crab meat from Mayari\'s Starfall.',
      'sopas_tala', 'Sopas ng Tala', 'Creamy star crab soup with milk and carrot.', ['milk', 'carrot'], 100, 'stars', 'charges cost half, and energy refills 3x faster'],
    ['tw_bakunawa_egg', 'Bakunawa Egg', 'An egg of the moon-eating dragon. Warm.',
      'balut_bakunawa', 'Balut ng Bakunawa', 'A bakunawa egg, boiled, with chili and garlic.', ['chili', 'garlic'], 120, 'feast', 'each enemy you beat gives back 2 energy'],
  ];

  // ---------- the icons: frames past the sheet (after the weapons' 2000 and the Tower shop's 2100) ----------
  C.FOOD_ICON_BASE = 2200;
  C.FOOD_ICONS = ROWS.map(function (r) { return r[0]; }).concat(ROWS.map(function (r) { return r[3]; }), ['lugaw_parola', 'baon']);
  var icon = function (id) { return C.FOOD_ICON_BASE + C.FOOD_ICONS.indexOf(id); };
  var fresh = function (id) { if (C.ITEMS[id]) throw new Error('The Tower\'s food: item ' + id + ' already exists'); };
  var dishText = function (text) { return ' In The Lost Tower, for ' + TF.mins + ' minutes, ' + text + '.'; };

  ROWS.forEach(function (r, i) {
    var z = TW.zones[i], ing = r[0], dish = r[3];
    fresh(ing);
    fresh(dish);
    // (sell 0: never sold, at the stand, the box, the Market or to Kanor; only cooked)
    C.ITEMS[ing] = { name: r[1], kind: 'tower', sell: 0, painted: true, icon: icon(ing), desc: r[2] + ' Only for cooking: it cannot be sold.' };
    // (the dish does not sell either: Tower drops make no new Gold)
    C.ITEMS[dish] = { name: r[4], kind: 'dish', energy: r[7], sell: 0, painted: true, icon: icon(dish), desc: r[5] + dishText(r[9]) };
    C.RECIPES.push({ dish: dish, needs: [ing].concat(r[6]) });
    TF.dishes[dish] = { key: r[8], text: r[9], zone: z.n };
    TF.ings.push(ing);
    z.food = ing;
    z.dish = dish;
    // the drops: each normal enemy its own list (they shared one), the guard's Tinola first
    z.normal.forEach(function (k) { WI.animals[k].drops = [[ing, 1, TF.chance]]; });
    WI.animals[z.guard].drops = WI.animals[z.guard].drops.concat([[ing, TF.guard, 1]]);
  });

  // ---------- Lugaw ng Parola: farm crops, for anyone ----------
  fresh('lugaw_parola');
  C.ITEMS.lugaw_parola = { name: 'Lugaw ng Parola', kind: 'dish', energy: 60, sell: 80, painted: true, icon: icon('lugaw_parola'),
    desc: 'The lighthouse keeper\'s rice porridge with ginger and egg.' + dishText('energy refills 3x faster') };
  C.RECIPES.push({ dish: 'lugaw_parola', needs: ['rice', 'ginger', 'egg'] });
  TF.dishes.lugaw_parola = { key: 'refill', text: 'energy refills 3x faster', zone: 0 };

  // ---------- the Baon: Mang Ilaw's lunchbox, for Gold ----------
  fresh('baon');
  C.ITEMS.baon = { name: 'Baon', kind: 'gear', sell: 0, painted: true, icon: icon('baon'),
    desc: 'Mang Ilaw\'s lunchbox. Pack up to ' + TF.baon.slots + ' foods in it; in The Lost Tower, when your energy falls under ' + TF.baon.under + ', it feeds you by itself.' };
})(window.Farm = window.Farm || {});
