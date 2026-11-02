// Added after the v2.1 list (owner, 2 Nov 2026): Today's Event, a small bonus for each day of the week, the same on
// every phone like the Weekend Market, and the rare surprises. Rules: 01-logicH.js. On screen: 19za-events.js.
(function (F) {
  'use strict';
  var C = F.Config;

  // By the day of the week, 0 Sunday .. 6 Saturday. key: what the rules look for. icon: a C.ICON key.
  C.EVENTS = [
    { key: 'gems', name: 'Gem Sunday', icon: 'gem', text: 'Gems from Mine rocks come in twos.' },
    { key: 'fish', name: 'Fish Monday', icon: 'fish_m', text: 'Fish sell for 25% more at the market stall.' },
    { key: 'wood', name: 'Timber Tuesday', icon: 'lumber', text: 'Branches, stumps and big trees give 1 more Lumber.' },
    { key: 'lucky', name: 'Lucky Wednesday', icon: 'sparkle', text: 'Golden crops and sparkling rocks are twice as common.' },
    { key: 'friends', name: 'Friendly Thursday', icon: 'heart', text: 'A chat with a villager counts double.' },
    { key: 'feast', name: 'Feast Friday', icon: 'lunch', text: 'Food gives 20% more energy.' },
    { key: 'hunt', name: 'Hunter Saturday', icon: 'antler', text: 'Kanor pays 15% more for meat, furs and hunted goods.' },
  ];
  C.EVENT = { fish: 1.25, lumber: 1, talk: 2, food: 1.2, hunt: 1.15 };

  // Rare surprises (owner, 2 Nov 2026). About 1 rock in 40 sparkles, the same rocks for friends in that mine; each pays once,
  // and at most rockDay a day pay. About 1 ripe crop in 100 is golden: picking it pays cropPay times its price on top of the
  // crop. Lucky Wednesday makes both twice as common. Rules: 01-logicH.js. On screen: 19zb-rare.js.
  C.RARE = { rock: 1 / 40, rockDay: 10, crop: 1 / 100, cropPay: 6, lucky: 2 };

  // The Town Goal and Best Farm of the Week, online (supabase/farm_online_12.sql decides everything; the numbers there win).
  // give: how many one tap gives. max...: the most this game believes for a prize, whatever comes back.
  // Rules: 01-logicI.js. On screen: the Town tab of the Online panel, 19zc-town.js.
  C.TOWN = { give: 10, maxGold: 1000, maxStars: 1, bestGold: 5000, bestStars: 5, words: { crop: 'crops', ore: 'ore' }, icons: { crop: 'turnip', ore: 'ore_gold' } };
})(window.Farm = window.Farm || {});
