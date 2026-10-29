// What's new in Harvest Ville, newest first (owner, 29 Oct 2026: "in menu add button there for what's new or latest
// update ... v1 for major update and vX.1 for minor update"). v1 is the game as it opened to everyone; the next big
// set of features is v2, smaller rounds v1.1, v1.2 ... Shown once after an update, and any time from the pause menu
// (19s-news.js). Each line: [icon (a C.ICON key), title, a short line].
(function (F) {
  'use strict';
  var C = F.Config;

  C.NEWS = [
    {
      v: '1.2', date: 'October 30, 2026', lines: [
        ['bag', 'A much bigger bag', "Lily sells bigger bags up to 90 slots. Use the arrows to turn the bag's pages."],
        ['chest', 'Storage at home', 'Tap a Dresser or Wardrobe to keep things there: 60 slots. Every farm gets a free Dresser.'],
        ['gift', 'Give to friends', 'Hold food or anything else and face a friend: tap Give. Great for a tired friend in the mine!'],
        ['sparkle', 'Sharper pictures', 'The Bakery, Dairy, Jam Maker, fruit trees, field plot and basket are new and sharp.'],
        ['cake', 'Your party hat', 'On your birthday your farmer wears a party hat all day, and friends see it too.'],
        ['apple', 'Trees show their fruit', 'A fruit tree shows its fruit only when it is ripe. After picking, it stays green until the next fruit.'],
        ['moon', 'Tucked in', 'When you sleep, you are tucked in under your own bed\'s quilt, in every bed style.'],
        ['heart', 'Pick fruit for friends', "A friend's ripe fruit tree goes into their basket too. Only friends can pick: add them first."],
        ['bolt', 'Never boxed in', 'Building next to fences can no longer shut you in, and a farmer who was stuck hops out.'],
      ],
    },
    {
      v: '1.1', date: 'October 29, 2026', lines: [
        ['carrot', 'Harvest Basket', "Pick a friend's ripe crops so none go to waste. They wait in the basket by their mailbox."],
        ['cake', 'Your birthday', 'Set it in the Calendar. On the day: a cake from the mayor, wishes and a party hat.'],
        ['moon', 'Sleep in your bed', 'Tap your bed to nap. Energy comes back 1 point every minute while you sleep.'],
        ['ore_copper', "Follow friends into the mine", 'Same rocks, same floor: dig together. Their town stall shows what they sell.'],
        ['drop', 'Water your seeds', 'Seeds grow once watered. Rain and friends count too.'],
        ['bread', 'New art', 'The Bakery, Dairy, Jam Maker, fruit trees and field plots got painted art.'],
        ['note', 'Fixes', 'Online pages close with one tap, "Say hello" counts everyone, no rain sound on dry visits.'],
      ],
    },
    {
      v: '1', date: 'October 29, 2026', lines: [
        ['turnip', 'Harvest Ville opens', 'Grow crops in real time, keep animals, fish, mine and make friends in town.'],
        ['bread', 'Workshops and fruit trees', 'A Bakery, a Dairy and a Jam Maker work while you play. More land with field plots.'],
        ['heart', 'Farm with friends', "Visit farms, leave likes and gifts, water friends' crops and chat in bubbles."],
        ['tag', 'The Market', 'Sell to other farms and buy what you need for orders and recipes.'],
      ],
    },
  ];
  C.NEWS_LATEST = C.NEWS[0].v;
})(window.Farm = window.Farm || {});
