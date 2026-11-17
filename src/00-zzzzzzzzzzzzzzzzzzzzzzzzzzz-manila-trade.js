// Mang Danny's Trading Post and the Talipapa's three vendors (owner, 18 Nov 2026: "Mang Danny buys and sells Mixer
// materials at about twice what he buys them for, so making your own still pays"; "Talipapa vendors sell cooking
// ingredients: meat, fish and vegetables for recipes"). Content only: the rules in 01-logicZ...Z-manila-trade.js, the
// shops and their tours in 19z...z-manila-trade.js. Only the game's own items; numbers marked (me) were decided by me.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  if (!M || !M.on || !C.WORKSHOPS.mixer) return;
  C.MNTRADE = {
    on: true,
    mult: 2, // what they sell for: 2 x the item's sell price (Mang Danny: the owner's; the Talipapa: me)
    // shop -> its daily stock of each item (Mang Danny: 20, the Talipapa: 30, me) and what it sells. Mang Danny also
    // buys his, at the sell price, any amount. Each item is in one shop only (the save counts by item).
    shops: {
      danny: { stock: 20, buys: 1, items: 'mixer' }, // ('mixer': every Mixer output, whatever it makes)
      // the everyday meats, fish and vegetables the Kitchen's recipes use (the rarer ones stay the hunt's and the places')
      meat_vendor: { stock: 30, items: ['meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar'] },
      fish_vendor: { stock: 30, items: ['fish_s', 'fish_m', 'fish_l'] },
      veg_vendor: { stock: 30, items: ['garlic', 'ginger', 'potato', 'carrot', 'onion', 'tomato', 'chili', 'bitter_gourd'] },
    },
    tours: ['post', 'tp'], // the first-time tours, a bit each in the save (append only)
  };
  // the Trading Post opens: its "Coming soon" goes (the others' stay), and Mang Danny's shelves are full
  M.buildings.forEach(function (b) {
    if (b.key === 'trading') b.text = "Mang Danny's Trading Post. He buys and sells the Mixer's Farm Cement, Rope, Sili Powder and Beeswax.";
  });
  var d = M.people.danny;
  if (d) d.lines[0] = 'My shelves are full now: cement, rope, wax, sili. Come in, come in!';
})(window.Farm = window.Farm || {});
