// A villager's story each week (owner, 8-9 Nov 2026: "we always need a story"; the first one approved: Hana's Fiesta
// Bread). Each day of the week, one of the day's 3 adventures is that day's chapter (Monday is chapter 1); 5 chapters
// handed over: a keepsake. Its pictures: art-src/STORY-ITEMS-PROMPTS.md (a 4 x 2 sheet: the 7 chapters' items and the
// keepsake dish), in by tools/art/story-items-import.js; a sparkle until then. Rules: 01-logicZZZZZZZZZ-adventures.js.
(function (F) {
  'use strict';
  var C = F.Config;
  C.STORIES = [{
    key: 'hana_bread', who: 'hana', title: 'Hana\'s Fiesta Bread',
    intro: 'The town fiesta is on Sunday, and Hana wants to bake her grandmother\'s fiesta bread for everyone.',
    keepsake: { stars: 3 }, recipe: 'fiesta_pandesal', need: 5,
    thanks: 'You made the fiesta! Take Grandma\'s Fiesta Pandesal recipe: it\'s yours now. Bake it in your kitchen any time.',
    chapters: [
      { key: 'hb_card', item: 'Grandma\'s Recipe Card', map: 'town', how: 'find', n: 1, tier: 'easy',
        say: 'The wind took Grandma\'s fiesta bread recipe! It\'s somewhere in town.', thanks: 'Grandma\'s card! "A pinch of love," she always wrote.' },
      { key: 'hb_honey', item: 'Wild Honeycomb', items: 'Wild Honeycombs', map: 'pulag', how: 'find', n: 3, tier: 'medium',
        say: 'Fiesta bread needs wild honey from Pulag. Three honeycombs, please!', thanks: 'Golden and sweet! The bees of Pulag are the best.' },
      { key: 'hb_wheat', item: 'Golden Wheat Stalk', items: 'Golden Wheat Stalks', map: 'farm', how: 'find', n: 3, tier: 'medium',
        say: 'Three golden wheat stalks grew on your farm today. Only today!', thanks: 'Golden wheat! The flour will be like sunshine.' },
      { key: 'hb_pan', item: 'Copper Bread Pan', map: 'mine', how: 'find', n: 1, tier: 'easy',
        say: 'Bram borrowed my copper bread pan and dropped it in the mine!', thanks: 'My good pan! Bram owes me a cake now.' },
      { key: 'hb_egg', item: 'Lucky Egg', map: 'pulag', how: 'hunt', n: 1, tier: 'hard', kind: 'labuyo',
        say: 'A wild Labuyo ran off with my lucky egg! It\'s in Pulag.', thanks: 'My lucky egg! Every fiesta bread starts with it.' },
      { key: 'hb_pandan', item: 'Pandan Leaf', items: 'Pandan Leaves', map: 'farm', how: 'find', n: 3, tier: 'medium',
        say: 'Three pandan leaves, for the smell of fiesta.', thanks: 'Smell that! It smells like home.' },
      { key: 'hb_bread', item: 'Fiesta Bread', map: 'house', how: 'find', n: 1, tier: 'easy', open: true,
        say: 'The bread is baking in your kitchen! Bring it to me, the fiesta is starting!', thanks: 'The whole town is cheering! You saved my fiesta.' },
    ],
  }];
  C.STORY_ICONS = [];
  C.STORIES.forEach(function (st) {
    st.chapters.forEach(function (ch, k) {
      ch.who = st.who;
      ch.story = st.key;
      ch.day = k; // (Monday = 0)
      C.ADVENTURES.push(ch);
      C.STORY_ICONS.push('qi_' + ch.key);
    });
  });
  C.STORY_ICONS.push('fiesta_pandesal');
  C.STORY_ICONS.forEach(function (n) { if (C.ICON_ORDER.indexOf(n) < 0) C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.STORY_ICONS_IN = false; // (true once their picture is in the items sheet)
  // the keepsake dish: Grandma's Fiesta Pandesal (its recipe: the story's keepsake)
  // (until its own picture is in: the plain Pandesal's)
  C.ITEMS.fiesta_pandesal = { name: 'Fiesta Pandesal', kind: 'dish', energy: 120, sell: 320, icon: C.STORY_ICONS_IN ? C.ICON.fiesta_pandesal : C.ITEMS.pandesal.icon,
    desc: 'Hana\'s grandmother\'s fiesta bread, soft and sweet with wild honey and pandan.' };
  C.STORY_RECIPES = { fiesta_pandesal: { dish: 'fiesta_pandesal', needs: ['wheat', 'egg', 'milk'] } };
})(window.Farm = window.Farm || {});
