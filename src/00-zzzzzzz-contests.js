// Contests at the festivals (owner, 4 Nov 2026: "contests at the festivals: animals, crops, cooking"). Content only:
// rules in 01-logicZ-contests.js, on screen in 19zz-contests.js. This file loads after every other 00- file (it changes
// three festivals' descriptions).
//
// Each contest has its own festival, on the real calendar like every festival:
//   the Animal Contest at the Cow Festival (Nov 20), judged by Owen the vet: love and how well it was cared for today
//   the Crop Contest at the Harvest Festival (Oct 12), judged by Lily: how fine the crop is (and its quality, later)
//   the Noche Buena Cook-off on Starry Night (Dec 24), judged by Rosa: a dish you cooked yourself
// Three villagers enter too. Who, with what and how good it is comes from the year alone (L.rand), so it is the same
// on every phone and nobody can roll it again.
// (No icons of its own: see the end of this file.)
(function (F) {
  'use strict';
  var C = F.Config;

  // rivals: [villager, what they bring, its name] (an animal kind and a pet name, or an item id)
  C.CONTESTS = [
    {
      key: 'animal', fest: 'cowfest', name: 'Animal Contest', judge: 'owen', what: 'animal',
      intro: 'Welcome to the Animal Contest! Owen the vet will look at every animal, nose to tail.',
      look: 'A happy animal is a loved one. Fed, petted and brushed today? I can tell.',
      rivals: [['tomas', 'cow', 'Bella'], ['marco', 'carabao', 'Kidlat'], ['pearl', 'chicken', 'Snowball'], ['pip', 'pig', 'Bubbles'],
        ['ewan', 'cow', 'Old Moo'], ['daisy', 'chicken', 'Mimi']],
    },
    {
      key: 'crop', fest: 'harvest', name: 'Crop Contest', judge: 'lily', what: 'crop',
      intro: 'Welcome to the Crop Contest! Lily knows every seed in the valley, so bring your finest.',
      look: 'Size, colour, a good firm feel... and a fine crop is worth more at the market, too.',
      rivals: [['marco', 'pumpkin'], ['poppy', 'sunflower'], ['ewan', 'corn'], ['tomas', 'sweet_potato'], ['ivy', 'ginger'], ['hana', 'strawberry']],
    },
    {
      key: 'cook', fest: 'starry', name: 'Noche Buena Cook-off', judge: 'rosa', what: 'dish',
      intro: 'A Noche Buena cook-off under the stars! Rosa from the Sunny Inn will taste every dish.',
      look: 'A dish made at home, with good things in it. Bought food does not count, my dear!',
      rivals: [['hana', 'cake'], ['pearl', 'pumpkin_pie'], ['marco', 'kaldereta'], ['clara', 'tomato_soup'], ['bram', 'boar_adobo'], ['ewan', 'grilled_fish']],
    },
  ];
  C.CONTEST_ORDER = C.CONTESTS.map(function (c) { return c.key; }); // (append only: the save stores the index)

  // The numbers. gold: by place (1st..4th). tiers: the three rivals' scores, lowest to highest possible, best first.
  // Scores are out of 100:
  //   animal  love x 0.6 (60) + fed 12 + petted 10 + brushed 10 + a breed bonus when breeds come (3, or 8 for a rare one)
  //   crop    20 + its price x 2 (up to 88) + in season 6 + 5 for each quality star when crop quality comes (up to 15)
  //   dish    25 + its energy x 0.45 + 5 for each thing in its recipe
  // keep: how many results the save remembers. love: what the animal gets (1st, the rest). friend: every villager, for
  // taking part; judge: the judge, on top.
  C.CONTEST = {
    gold: [0, 1500, 700, 300, 100], tiers: [[72, 88], [56, 76], [40, 62]], keep: 30, love: [10, 5], friend: 2, judge: 5,
    animal: { love: 0.6, fed: 12, pet: 10, brush: 10, breed: 3, rare: 8 },
    crop: { base: 20, price: 2, season: 6, star: 5 },
    dish: { base: 25, energy: 0.45, part: 5 },
    places: ['', '1st place', '2nd place', '3rd place', '4th place'],
    ribbons: ['', 'Blue ribbon', 'Red ribbon', 'Yellow ribbon'],
  };

  // the festivals say what is on
  var desc = { cowfest: 'Bring your best-loved animal to the Animal Contest. Feed, pet and brush it first!',
    harvest: 'Bring your finest crop to the Crop Contest.',
    starry: 'Spend the starry evening with someone dear, and bring a home-cooked dish to the Noche Buena Cook-off.' };
  C.FESTIVALS.forEach(function (f) { if (desc[f.key]) f.desc = desc[f.key]; });

  // No new icons in the items sheet (it is full: 32 rows of 8, and other features grow it): the ribbons and the trophy
  // are drawn at runtime (19zz-contests.js) until their pictures come (art-src/CONTESTS-PROMPTS.md). Their colours:
  C.CONTEST.colors = [null, ['#3a7fe0', '#2a5fb0'], ['#e04848', '#b02a2a'], ['#f2c230', '#c8961a'], ['#9fbf7a', '#6f8f4a']];
})(window.Farm = window.Farm || {});
