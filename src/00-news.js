// What's new in Harvest Ville, newest first (owner, 29 Oct 2026: "in menu add button there for what's new or latest
// update ... v1 for major update and vX.1 for minor update"). v1 is the game as it opened to everyone; the next big
// set of features is v2, smaller rounds v1.1, v1.2 ... Shown once after an update, and any time from the pause menu
// (19s-news.js). Each line: [icon (a C.ICON key), title, a short line].
(function (F) {
  'use strict';
  var C = F.Config;

  C.NEWS = [
    {
      v: '2.1', date: 'November 1, 2026', lines: [
        ['tomato', 'Rare goods at Saffron', 'Out of season? Saffron sells tomato, onion and ginger, and their seeds, at a higher price. Her seeds still wait for their season.'],
        ['bow', 'A real shot', 'Tap Shoot and your farmer lifts the bow, draws the string and lets the arrow fly.'],
        ['gem', 'Deeper in the Mine', 'Past floor 200 the caves change and new ores and gems wait. Each new cave adds 10 to your energy bar, and a lift takes you back there.'],
        ['lumber', 'More wood', 'Branches and a stump fall in your meadow each day, and big trees in Makiling Forest can be cut with the Axe.'],
        ['rod', 'Better rods', 'Bram can upgrade your Fishing Rod: a bigger green bar and slower fish.'],
        ['chest', 'A better Storage', 'Tap an item to read about it, choose how many to move, and arrange your storage with Move.'],
        ['hoe', 'Three toolbars', 'Swipe your toolbar left or right for 18 slots in all. The Bag button stays where it is.'],
        ['bubble', 'Better chat', 'Smaller bubbles, a small box that shows every line, and the Chat panel keeps what was said.'],
        ['hoe', 'The Back Fields', 'Six new blocks of land past the trees, east along the road. Find the For Sale signs.'],
        ['chest', 'No more lost chests', 'Past floor 150 each chest now counts on its own. Skip floors by lift and the ones above stay shut until you open them.'],
        ['calendar', "Today's Event", 'A small bonus for each day of the week. Tap the chip on the left to see today\'s.'],
        ['sparkle', 'Rare surprises', 'A sparkling rock in the Mine or a golden crop on the farm pays extra. Keep your eyes open!'],
        // Not yet: these two wait until the owner has applied supabase/farm_online_12.sql, then move them up.
        // ['turnip', 'Town Goal', 'One target a week for all farms. Give crops or ore in the Town tab of Online, and all who gave share the prize.'],
        // ['star', 'Best Farm of the Week', 'The most liked farm each week wins a prize and a crown in the Online lists.'],
      ],
    },
    {
      v: '2', date: 'October 30, 2026', lines: [
        ['bow', 'The Wild Lands', 'Walk west out of town to Pulag Grassland. Labuyo, rabbits and deer roam free.'],
        ['arrows', 'Hunt with a Bow', "Kanor sells a Bow, arrows and bait at his Lodge. Sneak up slowly, then tap Shoot."],
        ['venison', 'Meat on the ground', 'A hunted animal leaves meat, feathers, furs or antlers. Walk over them to pick up.'],
        ['boar_adobo', 'New dishes', 'Cook Labuyo Tinola, Rabbit Stew, Venison Tapa, Boar Adobo and Inihaw Skewers.'],
        ['tusk', 'Makiling Forest', 'After 10 hunts the forest opens: wild boars charge, and wolves come out at night.'],
        ['tusk_mammoth', 'Magayon Peaks', 'After 40 hunts the volcano slopes open: bears, tigers, rhinos and a mammoth. Bring arrows and food!'],
        ['kaldereta', 'Two more dishes', 'Cook Kaldereta from bear meat and Bistek from mammoth meat.'],
        ['antler', "Kanor's requests", 'A new request every day pays well. He also makes trophies for your house from rare drops.'],
        ['book', "Hunter's Book", 'Every animal has its own size. Your biggest of each is saved, and friends can see it.'],
        ['white_antler', 'Rare animals', 'A White Stag or a Golden Boar shows up now and then. Rain, dawn, dusk and fall bring out more.'],
        ['bow', 'Hunt with friends', 'A friend goes hunting: join them from their farm. Same animals, and everyone who hits one shares the hunt.'],
        ['leather_thick', 'The Tannery', 'Build it in your yard: furs and hides become leather. The biggest bags, Gold tools and top houses need what you hunt.'],
        ['bistek', 'Dishes with powers', 'Hunted dishes give 10 minutes of a special power. Read a dish in your bag to see which.'],
        ['great_tusk', 'The Great Mammoth', 'Every Saturday and Sunday on Magayon, for two or more hunters. Land 3 hits to share a Great Tusk.'],
        ['chest', 'A bigger monthly quest', 'New every month: daily quests, planting, weekly chests, hunting and cooking. The chest now holds 50 Pet Meals.'],
        ['sparkle', 'Friends walk smoothly', 'Friends on your farm no longer stop and start, and you see them riding their horses.'],
      ],
    },
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
