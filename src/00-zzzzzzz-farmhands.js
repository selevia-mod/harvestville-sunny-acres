// Farmhands (owner, 4 Nov 2026: "farmhands you hire to do jobs for you"). Four helpers stay at the Sunny Inn and look
// for work: one waters your crops, one picks ripe crops into the Harvest Basket, one feeds the animals and collects what
// they made, one picks the fruit trees. Each works a set amount a day, 6 AM to 9 PM, for a daily wage taken on a day
// they do some work (also while you are away). They get better the longer they work for you. Rules 01-logicZ-farmhands.js,
// on screen 19zz-farmhands.js; real art prompts in art-src/FARMHANDS-PROMPTS.md.
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60;

  C.FH = {
    from: 6 * H, to: 21 * H, // work hours: the first round at 6:00 AM, the last at 8:50 PM
    every: 10, // a round every 10 minutes: each farmhand does what there is to do, up to `perRound` jobs
    perRound: 12,
    ranks: ['New', 'Skilled', 'Expert'], // Lv 1, 2, 3
    promote: [0, 5, 15], // days worked for you before they can be promoted to Lv 2, Lv 3
  };

  // jobs: what they do in a day at Lv 1/2/3 (tiles, crops, animal jobs = 2 an animal, trees); wage: gold for a day they work.
  // unlock: they come looking for work once your farm has earned this much gold in all (stats.earned).
  // face: the stand-in picture, a visitor from out of town in the people sheet (00-town2.js C.SHOPPERS), until real art.
  C.FARMHANDS = {
    andoy: {
      name: 'Andoy', job: 'water', title: 'Waterer', face: 'visitor_farmer', unlock: 1000,
      jobs: [20, 45, 80], wage: [60, 140, 260],
      look: 'a lanky young farmhand in a wide straw hat, a faded blue shirt and rolled-up trousers, carrying a tin watering can',
      line: 'Dry soil? Not on my watch. Point me at the field.',
      what: 'Waters crops that wait for water.', brief: 'Waters your seeds.',
    },
    lucing: {
      name: 'Lucing', job: 'harvest', title: 'Harvester', face: 'visitor_mother', unlock: 3000,
      jobs: [20, 45, 80], wage: [80, 180, 320],
      look: 'a cheerful woman with a ponytail, a yellow blouse, a green apron and a woven harvest basket on her hip',
      line: 'I pick them the moment they are ripe. Nothing goes to waste!',
      what: 'Picks ripe crops into your Harvest Basket. Golden crops are left for you.', brief: 'Picks ripe crops.',
    },
    berto: {
      name: 'Berto', job: 'animals', title: 'Animal hand', face: 'visitor_elder', unlock: 6000,
      jobs: [6, 12, 24], wage: [60, 130, 240],
      look: 'a stocky older man with a flat cap, a brown vest over a white shirt and a feed sack over one shoulder',
      line: 'Animals know a kind hand. Leave the feeding to me.',
      what: 'Feeds your animals from your Storage or bag, and puts what they made in the basket.', brief: 'Feeds and collects.',
    },
    kiko: {
      name: 'Kiko', job: 'fruit', title: 'Fruit picker', face: 'visitor_student', unlock: 10000,
      jobs: [2, 4, 8], wage: [50, 110, 200],
      look: 'a wiry teenage boy with messy hair, round glasses, a green shirt with rolled sleeves and a cloth sling bag for fruit',
      line: 'I can climb any tree in the valley. Show me where they are!',
      what: 'Picks ripe fruit trees into the basket.', brief: 'Picks ripe fruit.',
    },
  };
  C.FH_KEYS = ['andoy', 'lucing', 'berto', 'kiko']; // (the save keeps them by their place here: append only)

  // Rosa writes when the first one checks in at her inn, then when each new one comes (01-logicZ-farmhands.js).
  C.LETTERS.fh_inn = { from: 'rosa', text: 'Good news, farmer! A hard worker is staying at my inn and asking for farm work. Come by the Sunny Inn and look under Farmhands. - Rosa' };
  C.FH_KEYS.forEach(function (key) {
    var d = C.FARMHANDS[key], job = d.title.toLowerCase();
    C.LETTERS['fh_' + key] = { from: 'rosa', text: d.name + ' just checked in at my inn, looking for work as ' + (/^[aeiou]/.test(job) ? 'an ' : 'a ') + job + '. Ask for the Farmhands at the Sunny Inn. - Rosa' };
  });
})(window.Farm = window.Farm || {});
