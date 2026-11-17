// The horse goes out (farm economy v2, part 5; owner, 11 Nov 2026: docs/farm-economy-v2.md section 6). Every number in
// one place. The owner's: the hearts each place needs, the three pieces of gear and what they are for, the foods.
// The rest is "decided by me, owner can change" (the doc does not give it). Rules: 01-logicZZZZZZZZZZZZZZ-horse.js; the
// world: 19zzzzzzzzzzzzzzzzzzzzzzzzz-horse-out.js.
(function (F) {
  'use strict';
  var C = F.Config;

  C.HORSE_OUT = {
    // the horse's hearts each kind of place needs (owner): the farm none, town 3, the Wild Lands 6, the five hunting
    // places 8, their caves and Bakunawa's Lair 10
    hearts: { farm: 0, town: 3, wild: 6, hunt: 8, cave: 10 },
    loveHeart: 10, // love a heart: love runs 0-100, so 10 hearts (decided by me, owner can change)
    oldHearts: 3, // a horse from before this update starts with at least this many, so town riding stays open (decided by me)
    stamina: 100, // a full horse (decided by me, owner can change)
    // Riding costs no stamina (owner, 18 Nov 2026: "If riding horse for pleasure or transferring plants, there's should be
    // no energy cost"), anywhere: not the Wild Lands, the hunting places, caves, Manila, the valley road or the cart. Nor
    // does shooting from the saddle. Kept at 0 so nothing reads a number that is gone.
    drain: 0,
    // An enemy's hit while you ride takes this much from the horse too (owner, 18 Nov 2026: "it will lost stamina when
    // hitted by enemies, so when you got hit, the horse lost the energy even the character"): 5, so a full horse takes 20
    // hits (decided by me, owner can change). You lose your own energy for the hit exactly as before.
    hitDrain: 5,
    // Stamina comes back by itself like the farmer's energy (owner, 18 Nov 2026: "It also restore energy per min similar to
    // characters but I can restore immediately by eating"): a point every C.ENERGY_EVERY real minutes, also while the game
    // is closed, up to full (L.horseRegen); food still gives it at once.
    // what each food gives back (owner: oats, carrots and apples; the amounts decided by me, owner can change)
    food: { oats: 40, apple: 25, carrot: 15 },
    feedLove: 2, // the first feed of a day is also a little love (decided by me, owner can change)
    shotGap: 450, // ms between arrows from the saddle (decided by me, owner can change)
    // a big monster can knock you off in a cave (owner): a guard or boss, or one that hits this hard; the chance a hit
    // does it (decided by me, owner can change)
    knockHit: 15,
    knockOdds: 0.35,
    // the Stable's gear (owner: Horseshoes from iron ore + leather, Lantern Bridle from a lantern + crystal, Saddlebags
    // from leather + Rope). The game has no iron ore and no lantern item yet: Copper Ore stands in for the iron, and the
    // lantern's cost is in the Gold (decided by me, owner can change). Saddlebags wait for the Mixer's Rope (part 3).
    gear: {
      horseshoes: { name: 'Horseshoes', needs: [['ore_copper', 5], ['leather_soft', 1]], gold: 800,
        desc: 'Needed past the farm and town.' },
      lantern_bridle: { name: 'Lantern Bridle', needs: [['crystal', 1], ['ore_copper', 2]], gold: 1500,
        desc: 'A crystal lantern, needed in caves.' },
      // PART 3 (the Mixer): Rope comes from it. To turn Saddlebags on: delete `soon` here, and give the bag its 12 more
      // slots where the bag is sized (L.bagLevel / L.resizeBag in 01-logic.js use s.inv.length, and L.deserialize sizes
      // the bag before it puts the items back): L.horseBagExtra(s) says how many.
      saddlebags: { name: 'Saddlebags', needs: [['leather_soft', 2], ['rope', 3]], gold: 1200, bag: 12, soon: 'Needs Rope from the Mixer, coming soon.',
        desc: 'Carry more: bag +12.' },
    },
    gearOrder: ['horseshoes', 'lantern_bridle', 'saddlebags'], // the save keeps them as bits in this order (append only)
  };

  // the gear's icons: appended to the sheet (icon numbers are saved); pictures from art-src/icons/economy-2.png cells
  // 1-3 (tools/art/economy-import.js)
  C.HORSE_OUT.gearOrder.forEach(function (id) {
    if (C.ICON_ORDER.indexOf(id) < 0) C.ICON_ORDER.push(id);
    C.ICON[id] = C.ICON_ORDER.indexOf(id);
    C.HORSE_OUT.gear[id].icon = C.ICON[id];
  });
  C.HORSE_ICONS = C.HORSE_OUT.gearOrder.slice(); // (the tests: what comes after part 1's icons)
})(window.Farm = window.Farm || {});
