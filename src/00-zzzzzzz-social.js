// Barangays, the weekly Bayanihan Cup and the Market board (owner, 4 Nov 2026: "Neighborhoods with a weekly Derby;
// ads for your market stall"). A barangay is a team of up to 30 farms; each week every barangay gets the same tasks,
// and the points its members score rank it in a group of barangays its size. Rules 01-logicZ-social.js; on screen
// 19zz-social.js (barangays and the Cup), 19zz-social-ads.js (the Market board), 19zz-social-tours.js; the server
// supabase/farm_online_16.sql and _17.sql (the numbers there decide; the ones here only show them).
(function (F) {
  'use strict';
  var C = F.Config;

  C.NB = {
    max: 30, // members
    nameMin: 3,
    nameMax: 20,
    postMax: 80, // letters in a line on the news board (the server cuts a longer one there too)
    // the badges a barangay can pick (existing item icons; the server checks the same 8 names)
    badges: ['carabao', 'mango', 'sunflower', 'fish_k', 'star', 'heart', 'cow', 'gem'],
    badgeNames: { carabao: 'Carabao', mango: 'Mango', sunflower: 'Sunflower', fish_k: 'Big Fish', star: 'Star', heart: 'Heart', cow: 'Cow', gem: 'Gem' },
    // the Cup's kinds of task: the game's own counter (L.count), an icon, and the words
    tasks: {
      harvest: { counter: 'harvest', icon: 'turnip', text: 'Harvest {n} crops' },
      fish: { counter: 'fish', icon: 'fish_m', text: 'Catch {n} fish' },
      hunt: { counter: 'hunt', icon: 'bow', text: 'Hunt {n} animals' },
      order: { counter: 'order', icon: 'crate', text: 'Fill {n} orders' },
      collect: { counter: 'collect', icon: 'egg', text: 'Collect {n} eggs or milk' },
      care: { counter: 'care', icon: 'brush', text: 'Care for animals {n} times' },
      cooked: { counter: 'cooked', icon: 'veggie_stew', text: 'Cook {n} dishes' },
      plant: { counter: 'plant', icon: 'seed_turnip', text: 'Plant {n} seeds' },
      forage: { counter: 'forage', icon: 'mushroom', text: 'Forage {n} wild things' },
      request: { counter: 'request', icon: 'letter', text: 'Finish {n} villager requests' },
    },
    leagues: { s: ['Small league', '1 to 5 farms'], m: ['Middle league', '6 to 15 farms'], l: ['Big league', '16 to 30 farms'] },
    // shown before the server says (farm_nb_v1 sends the real ones)
    prizes: [[3000, 3], [2000, 2], [1200, 1]],
    baseGold: 500,
    minPlace: 400,
    weekTasks: 6,
    dayTasks: 3,
  };

  C.ADS = { hours: 4 }; // the Market board: how long a stall stays on it (free once a day)
})(window.Farm = window.Farm || {});
