// Skills (owner, 4 Nov 2026: "skill levels for farming, mining, fishing and hunting that get better as you use them").
// Each skill has XP from doing it, levels 1 to 10, and a small perk at levels 3, 5, 7 and 10. Rules in
// 01-logicZ-skills.js, the world and the Skills panel in 19zz-skills.js. Saved as 'sk2'.
(function (F) {
  'use strict';
  var C = F.Config;

  C.SKILLS = {
    order: ['farm', 'mine', 'fish', 'hunt'], // their place in the save: appended only
    // XP to reach each level (level 1 = 0). Weeks of normal play to reach 10, not days: a keen farmer makes about
    // 120 farming XP a day, a big field about 400.
    need: [0, 0, 100, 300, 650, 1150, 1800, 2700, 3900, 5400, 7200],
    max: 10,
    skills: {
      farm: {
        name: 'Farming', icon: 'hoe', verb: 'Till, water, plant and pick crops.',
        // till, water and plant: 1 a tile; pick a crop 2; cut grass 1
        xp: { till: 1, water: 1, plant: 1, harvest: 2, cut: 1 },
        perks: [
          { at: 3, text: 'Your Watering Can holds 5 more water.', can: 5 },
          { at: 5, text: 'The Hoe and the Watering Can use 15% less energy.', tools: 0.15 },
          { at: 7, text: 'A 1 in 20 chance of one more crop when you pick.', extra: 0.05 },
          { at: 10, text: 'A 1 in 10 chance of one more crop when you pick.', extra: 0.1 },
        ],
      },
      mine: {
        name: 'Mining', icon: 'hammer', verb: 'Smash rocks in the Mine.',
        // a rock 3, and 2 more when it held ore or a gem
        xp: { rock: 3, ore: 2 },
        perks: [
          { at: 3, text: 'Rocks take 15% less energy to smash.', rocks: 0.15 },
          { at: 5, text: 'A 1 in 20 chance of one more ore or gem from a rock.', extra: 0.05 },
          { at: 7, text: 'Rocks take 25% less energy to smash.', rocks: 0.25 },
          { at: 10, text: 'A 1 in 10 chance of one more ore or gem from a rock.', extra: 0.1 },
        ],
      },
      fish: {
        name: 'Fishing', icon: 'rod', verb: 'Catch fish in the pond and the river.',
        // by the fish; a giant 4 more; one that got away still teaches you a little
        xp: { fish_s: 4, fish_m: 6, fish_l: 8, fish_k: 30, other: 5, giant: 4, miss: 1 },
        perks: [
          { at: 3, text: 'The green bar is 10% bigger when you reel in.', bar: 1.1 },
          { at: 5, text: 'Fish move 10% slower when you reel in.', slow: 0.1 },
          { at: 7, text: 'Giant fish bite half again as often.', giant: 1.5 },
          { at: 10, text: 'The green bar is 20% bigger when you reel in.', bar: 1.2 },
        ],
      },
      hunt: {
        name: 'Hunting', icon: 'bow', verb: 'Hunt in the Wild Lands.',
        // 5 for each arrow it takes to bring down (60 at most); a giant 5 more; a rare one 20 more
        xp: { hp: 5, most: 60, giant: 5, rare: 20 },
        perks: [
          { at: 3, text: '1 in 10 arrows is not used up when you shoot.', save: 0.1 },
          { at: 5, text: '1 in 10 shots is a strong shot: it hits once more.', strong: 0.1 },
          { at: 7, text: 'Giant animals come out half again as often.', giant: 1.5 },
          { at: 10, text: '1 in 5 shots is a strong shot.', strong: 0.2 },
        ],
      },
    },
  };
})(window.Farm = window.Farm || {});
