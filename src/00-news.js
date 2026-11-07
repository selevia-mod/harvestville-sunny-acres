// What's new in Harvest Ville, newest first (owner, 29 Oct 2026: "in menu add button there for what's new or latest
// update ... v1 for major update and vX.1 for minor update"). v1 is the game as it opened to everyone; the next big
// set of features is v2, smaller rounds v1.1, v1.2 ... Shown once after an update, and any time from the pause menu
// (19s-news.js). Each line: [icon (a C.ICON key), title, a short line, and optionally a tour: F.TOURS key, 19ze-tours.js].
(function (F) {
  'use strict';
  var C = F.Config;

  C.NEWS = [
    {
      v: '2.12', date: 'November 8, 2026', lines: [
        // (owner, 8 Nov 2026: e41)
        ['ember_shard', 'Caves 50 floors deep', 'Every hunting place\'s cave now goes down 50 floors, like the Lair: a guard on every 10th floor, tougher each time, and the boss on floor 50. The lift stops every 10 floors.'],
        ['bow', 'Haliya\'s Moon Bow', 'The new best bow. Kanor makes it from your Magma Bow, every cave boss\'s part, Bakunawa Scales and 600,000 Gold. Each arrow goes through the first creature and hits the one behind it.', 'moonbow'],
      ],
    },
    {
      v: '2.11', date: 'November 8, 2026', lines: [
        // (owner, 8 Nov 2026: e40)
        ['chest', 'Your buildings are back', 'Setting a birthday made some farms forget their Stable, Bigger Coop and Bigger Barn. They are back, with a letter from the Mayor, 20,000 gold, lumber and stone.'],
        ['egg', 'Faster eggs and milk', 'A chicken lays 4 hours after it eats, and a cow, pig or carabao gives 6 hours after.'],
        ['heart', 'Animals work while you are away', 'Eggs and milk now come even when the game is closed. Feed them, come back later, and collect.'],
        ['star', 'Greenhouse on your new land', 'A greenhouse on the land you bought can be tilled and planted now, like one in your field.'],
      ],
    },
    {
      v: '2.10', date: 'November 7, 2026', lines: [
        // (owner, 7 Nov 2026: e38, after the owner's 19:58 recording; "0.1 s" OK'd)
        ['bow', 'Friends\' arrows hit', 'A friend\'s arrow now leaves from where you see them and stops in the animal it reaches, so a hit no longer looks like a miss.'],
        ['star', 'Smoother players', 'Other players now show about 0.1 seconds behind instead of up to 0.35, and no longer jump forward after they shoot.'],
        ['heart', 'Friend requests reach you', 'When someone adds you, a note with Accept comes up within half a minute, and they hear it when you say yes.'],
      ],
    },
    {
      v: '2.9', date: 'November 7, 2026', lines: [
        // (owner, 7 Nov 2026: "Push e36")
        ['bow', 'The Great Mammoth for everyone', 'Everyone who lands 3 hits on the Great Mammoth gets a share, even when a stranger lands the last one.'],
        ['star', 'Online opens at once', 'The Online menu opens straight away, and the number on the Online button comes back by itself after a weak signal.'],
        ['heart', 'Villagers stand apart', 'Villagers no longer bunch up or stand inside the fountain, so you can always talk to them.'],
      ],
    },
    {
      v: '2.8', date: 'November 7, 2026', lines: [
        // (draft for the owner: e35)
        ['heart', 'Friends meet in dungeons', 'Go down the same dungeon floor as a friend and you are there together. No need to visit their farm first.', 'play_together'],
        ['bow', 'Who is hunting here', 'Tap Online in a hunting place to see who is hunting near you, and add them as a friend in one tap.'],
        ['bow', 'Fair hunting for everyone', 'More animals come out when more hunters are in a place, so everyone finds about as many as when hunting alone.'],
        ['star', 'Follow a friend', 'When a friend goes somewhere, a small note at the top lets you follow them. No more pop-ups in the middle of a hunt.'],
        ['chest', 'Smoother and neater', 'Hunters walk without sliding, a kill waits for the arrow, and the Daily Gift and Market orders look cleaner. Villagers only ask for what you can get.'],
      ],
    },
    {
      v: '2.7', date: 'November 7, 2026', lines: [
        // (owner, 7 Nov 2026: approved as written)
        ['heart', 'Chat with everyone', 'Every hunting place has its Chat button now. Say hi to anyone hunting there, friends or not.'],
        ['bow', 'Smoother hunting together', 'Other hunters walk smoothly instead of jumping, and their costume stays on when they shoot.'],
        ['bow', 'Hunts with friends', 'When a hunter who isn\'t your friend lands the last hit, the hunt is theirs. Add them as a friend to share next time.'],
      ],
    },
    {
      v: '2.6', date: 'November 7, 2026', lines: [
        // (owner, 7 Nov 2026: "open it to everyone up to 30"; docs/game-server.md "Step 2")
        ['bow', 'Hunt with everyone', 'Every hunting place is open to all players now, up to 30 in a place. Hunt the same animals together: everyone who hits one gets a share when it goes down.', 'hunt_open'],
        ['star', 'Medal frames', 'Each medal you earn sits in its own frame: gold for a boss, rainbow for a rare animal, silver for a guard, a tame, a story or a giant, bronze for the rest.'],
        ['bow', 'Smoother dungeons with friends', 'A monster you beat stays down on your friends\' phones too, and a cleared floor\'s way down opens for a friend who comes in later.'],
      ],
    },
    {
      v: '2.5', date: 'November 7, 2026', lines: [
        ['star', 'Gear stars', 'Kanor puts up to 3 stars on a piece you own, from its place\'s boss and guard parts. Each star takes 1 more energy off a charge there.', 'gear_stars'],
        ['bag', '999 in a slot', 'A bag slot now holds 999 of one thing, and so does each storage slot. Tools still take a slot each.'],
        ['heart', 'Chat in Central Park', 'The Chat button is always there in the park, so you can say hi to whoever walks in next.'],
      ],
    },
    {
      v: '2.4', date: 'November 6, 2026', lines: [
        ['heart', 'Central Park', 'Up the road by the Station: one park for everyone in Harvest Ville. Meet other players, chat, wave and make friends. Park 1, 2 and 3 hold 30 each.', 'park'], // (19zzz-c-park-online.js)
        // (owner, 6 Nov 2026: "Finish all the one we talk earlier": the rest of the night's update, in one version)
        ['bow', 'Five new hunting places', 'Ride Kanor\'s Jeep from his Lodge to Banaue Terraces, Chocolate Hills, Taal Lake, Sierra Madre and the Palawan Underground River. Each opens after more hunts, with its own animals, a local friend and hidden chests.', 'jeep'],
        ['ember_shard', 'A dungeon under each', 'Ten floors, a guard on floor 5 and a boss on floor 10 you can beat alone (more friends, a bigger boss). Its chest waits once a day, up to 3.'],
        ['gear_cloak', 'Hunter\'s gear sets', 'Kanor makes a set of 4 from each place. In its own place, every piece takes energy off a charge, and the whole set even more.', 'gear_slots'],
        ['heart', 'Tame a friend', 'Each place has a young animal to tame with its favourite food. It follows you and helps you hunt.', 'tame'],
        ['star', 'Medals', 'Medals for what you do out hunting, from your first hunt to each boss. Friends see them on your card.', 'medals'],
        ['crate', 'Bayanihan Projects', 'Build the town together with every farmer in Harvest Ville at the board by the plaza. Each finished project changes the town for everyone.', 'bh'],
        ['bow', 'Town Raid', 'Monday and Thursday at 8 PM, raiders come at your fields. Everyone online fills one town bar, and a win gives the whole town a bonus day.', 'raid'],
        ['ribbon', 'Town Rank', 'Points for all you do this month: Bronze, Silver, Gold and Champion. It starts over on the 1st.', 'rank'],
        ['chest', 'The Hall of Fame', 'Inside Central Park: the biggest catches, the first to beat each boss, and the Town Rank champions.', 'hall'],
        ['letter', 'Villager stories', 'Every villager has a story that opens at 2, 4, 6 and 8 hearts. Follow them in the Friendship Book.', 'friends'],
      ],
    },
    {
      v: '2.3', date: 'November 5, 2026', lines: [
        ['seed_rose', 'Your ideas: new seeds', 'Rose, Sampaguita, Gumamela, Cotton, Sugarcane, Cacao and Oregano at Lily\'s. Craft yard pieces from them at Mira\'s.', 'players'], // (19zzz-a-players.js)
        ['star', 'Double Drops', 'Wednesday and Saturday, 12 to 1 PM and 8 to 10 PM: crops, forage, mine rocks and hunts give twice as much.', 'double'],
        ['egg', 'Eggs every 8 hours', 'A fed chicken lays 8 hours later, and a cow, pig or carabao gives its milk or truffle 12 hours later. Feed them again for the next one.'],
        ['crate', 'Shops open all night', 'Every shop in town stays open day and night now. Mira takes two jobs at once.'],
        ['bag', 'Drop what you don\'t need', 'Hold it and tap Drop in your Bag. It stays on the ground 5 minutes, and a friend with you can pick it up.'],
        ['sikwate', 'Sikwate and Chocolate Cake', 'The Bakery makes both from your own cacao.'],
        ['chest', 'Every cabinet, its own storage', 'Each Dresser and Wardrobe at home keeps its own 60 slots. Two cabinets, two storages: 120 slots. Empty a cabinet before you put it away.'],
        ['ember_shard', 'The Volcano set', 'Kanor makes five pieces of Lair furniture from what the Lair gives. The Bakunawa Rug is the most beautiful thing in any house.'],
        ['star', 'The Fire look', 'Help bring down a Bakunawa for a 1 in 10 chance at the Fire look, or have Kanor make it.'],
        ['ribbon', 'A green ribbon', '4th place in a festival contest gets a green ribbon for taking part.'],
        ['rain', 'Fixes from your reports', 'Lamp Posts and Paper Lanterns glow at night. Rain waters what you plant on a rainy day. Growing wheat no longer looks withered. Room for 500 yard pieces. Hunting drops land where you can reach them. The clearing quest asks for 15, and mine rocks count.'],
      ],
    },
    {
      v: '2.2', date: 'November 4, 2026', lines: [
        ['ember_shard', "Bakunawa's Lair", 'A cave mouth on Magayon leads down 50 floors of lava caves. Clear each floor with your Bow, beat the guards, and face the Bakunawa with friends.', 'lair'],
        ['bow_4', 'The Magma Bow and the Fire Charm', 'Kanor makes them from what the Lair gives: the best bow there is, and a charm that softens every charge.'],
        ['can', 'Farmhands', 'Andoy, Lucing, Berto and Kiko look for work at the Sunny Inn. They water, pick crops, feed animals and pick fruit for a daily wage, even while you are away.', 'farmhands'], // (19zz-farmhands.js)
        ['fish_l', 'The Fishing Derby', 'Every fish has its own weight now. On Fish Monday the biggest of each fish goes on the Derby board in Online, Ranks.', 'derby'],
        ['calendar', 'A Daily gift calendar', 'See the whole week of gifts at a glance. Day 7 is a big chest: 2 Sunbeams, 1,500G and a Power-Up.'],
        ['letter', 'Farm photos', 'Share farm opens photo mode: a frame with your farm\'s name, a Hi! from your farmer, then Snap to post it on Selebox.', 'photo'],
        ['bow', 'Hunting now', 'See who is out hunting and tap Join. Add a new hunting partner as a friend, and try for the Biggest catch of the week in Online, Ranks.', 'hunt_together'],
        ['heart', 'Your dog comes hunting', 'Your farm dog follows you in the Wild Lands, points at hidden animals and fetches what a hunt leaves behind.', 'hunt_dog'],
        ['gear_cloak', "Hunter's gear", 'Kanor sells a Camo Cloak, Quiet Boots and a Big Quiver. Buy each once: always on when you hunt.', 'gear'],
        ['ribbon', 'The Tailor Shop', "Tita Luz's shop is just south of the plaza. Eight looks for your farmer, and the Christmas Elf is free.", 'tailor'],
        ['heart', 'Play together', "See friends swing, fish and shoot as they do it, hear them nearby, and watch the owner's farm change while you visit."],
        ['bubble', 'Reactions', 'Wave now has Hi!, Love, Haha!, Wow!, Yay! and Aww.'],
        ['star', 'Big moments', 'Friends hear when you find the ladder down, catch the King Trout or hunt a rare animal.'],
        ['calendar', 'A smaller badge', "Today's Event is a small badge on the left now. Tap it to read today's bonus."],
        ['ribbon', 'Festival contests', 'An Animal Contest at the Cow Festival, a Crop Contest at the Harvest Festival and a Noche Buena Cook-off on Starry Night. Win ribbons, Gold and the year\'s trophy!', 'contest'],
        ['star', 'Skills', 'Get better at farming, mining, fishing and hunting just by doing them: ten levels each, with a small perk now and then. See them on your farmer card.', 'skills'], // (19zz-skills.js)
        ['chicken', 'Animal breeds', 'Hens, cows, pigs and carabaos come in colours, and babies take after their parents. About 1 in 25 is born rare! Find them all in the Breeds book (Collection).', 'breeds'], // (19zz-breeding.js)
        ['crate', 'Willowbrook Station', 'Up the lane by the Post Office: trains bring visitors and big cargo orders, and your Town Level grows.', 'station'], // 19zz-town.js
        ['carabao', 'Barangays', 'Team up with up to 30 farms under Online, Friends. Every week the Bayanihan Cup gives each barangay the same tasks: points, places and prizes for all who help.', 'nb'],
        ['crate', 'The Market board', 'Advertise your stall for 4 hours, free once a day. See who is selling and buy from their stall, in Online, Market.', 'ads'],
      ],
    },
    {
      v: '2.1', date: 'November 1, 2026', lines: [
        ['tomato', 'Rare goods at Saffron', 'Out of season? Saffron sells tomato, onion and ginger, and their seeds, at a higher price. Her seeds still wait for their season.'],
        ['bow', 'A real shot', 'Tap Shoot and your farmer lifts the bow, draws the string and lets the arrow fly.'],
        ['gem', 'Deeper in the Mine', 'Past floor 200 the caves change and new ores and gems wait. Each new cave adds 10 to your energy bar, and a lift takes you back there.', 'mine'],
        ['lumber', 'More wood', 'Branches and a stump fall in your meadow each day, and big trees in Makiling Forest can be cut with the Axe.'],
        ['rod', 'Better rods', 'Bram can upgrade your Fishing Rod: a bigger green bar and slower fish.'],
        ['chest', 'A better Storage', 'Tap an item to read about it, choose how many to move, and arrange your storage with Move.'],
        ['hoe', 'Three toolbars', 'Swipe your toolbar left or right for 18 slots in all. The Bag button stays where it is.'],
        ['bubble', 'Better chat', 'Smaller bubbles, a small box that shows every line, and the Chat panel keeps what was said.'],
        ['hoe', 'The Back Fields', 'Six new blocks of land past the trees, east along the road. Find the For Sale signs.', 'land'],
        ['chest', 'No more lost chests', 'Past floor 150 each chest now counts on its own. Skip floors by lift and the ones above stay shut until you open them.'],
        ['calendar', "Today's Event", 'A small bonus for each day of the week. Tap the badge on the left to see today\'s.', 'event'],
        ['sparkle', 'Rare surprises', 'A sparkling rock in the Mine or a golden crop on the farm pays extra. Keep your eyes open!', 'rare'],
        ['turnip', 'Town Goal', 'One target a week for all farms. Give crops or ore in the Town tab of Online, and all who gave share the prize.', 'town'],
        ['star', 'Best Farm of the Week', 'The most liked farm each week wins a prize and a crown in the Online lists.'],
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
