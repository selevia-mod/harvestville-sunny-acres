// Daily adventures (owner, 8 Nov 2026; docs/quests-adventures.md): a villager asks for a quest item that exists only
// while that quest is on ("It must be something only show when the quest is on"), found or hunted in a place, and
// handed over. Its 16 pictures: art-src/QUEST-ITEMS-PROMPTS.md, in by tools/art/quest-items-import.js (appended to the
// icons: nothing moves). Rules: 01-logicZZZZZZZZZ-adventures.js; on screen: 19zzzzzzzzzzzzzz-adventures.js.
(function (F) {
  'use strict';
  var C = F.Config;
  // key, who (a villager's key, or 'luz' Tita Luz, 'kanor' Mang Kanor), item, map, how ('find' | 'hunt'), n (pieces),
  // tier ('easy': one hidden piece; 'medium': three pieces; 'hard': a marked creature), kind (the hunted creature),
  // say (asking), thanks (handed over)
  C.ADVENTURES = [
    { key: 'hammer', who: 'bram', item: 'Lucky Hammer', map: 'mine', how: 'find', n: 1, tier: 'easy',
      say: 'I dropped my lucky hammer down the mine!', thanks: 'My lucky hammer! The forge sings again. Thank you!' },
    { key: 'moonflower', who: 'ivy', item: 'Moon Flower', map: 'farm', how: 'find', n: 1, tier: 'easy',
      say: 'A moon flower opened on your farm. I need it for medicine.', thanks: 'Still glowing! This will help so many people.' },
    { key: 'letters', who: 'finn', item: 'Lost Letter', items: 'Lost Letters', map: 'town', how: 'find', n: 3, tier: 'medium',
      say: 'The wind took three letters out of my bag!', thanks: 'All three! Nobody misses their mail today. Thanks, friend!' },
    { key: 'bell', who: 'owen', item: 'Little Lamb Bell', map: 'pulag', how: 'find', n: 1, tier: 'easy',
      say: 'A lamb came home without its bell. It\'s somewhere in Pulag.', thanks: 'Ding-ding! The little lamb will be so happy.' },
    { key: 'orchid', who: 'poppy', item: 'Wild Waling-waling', items: 'Wild Waling-waling', map: 'makiling', how: 'find', n: 3, tier: 'medium',
      say: 'Three wild orchids for the fiesta altar, please.', thanks: 'The queen of orchids! The altar will be beautiful.' },
    { key: 'ember', who: 'sora', item: 'Ember Stone', map: 'magayon', how: 'hunt', n: 1, tier: 'hard', kind: 'bear',
      say: 'A bear sits on a glowing ember stone in Magayon. I want its colour!', thanks: 'Warm as fire! My next painting will glow.' },
    { key: 'shawl', who: 'pearl', item: 'Old Woven Shawl', map: 'banaue', how: 'find', n: 1, tier: 'easy',
      say: 'My old shawl blew away at the terraces. My mother wove it.', thanks: 'Oh, my mother\'s shawl... Salamat, anak.' },
    { key: 'bulul', who: 'elliot', item: 'Little Bulul', map: 'banaue', how: 'hunt', n: 1, tier: 'hard', kind: 'bayawak',
      say: 'A Bayawak ran off with the library\'s little bulul carving!', thanks: 'Back on its shelf, safe and sound. Thank you!' },
    { key: 'kite', who: 'pip', item: 'Runaway Kite', map: 'bohol', how: 'find', n: 1, tier: 'easy',
      say: 'My kite flew all the way to the Chocolate Hills!', thanks: 'My kite! Wanna fly it with me after school?' },
    { key: 'cacao', who: 'hana', item: 'Golden Cacao Pod', items: 'Golden Cacao Pods', map: 'bohol', how: 'find', n: 3, tier: 'medium',
      say: 'Golden cacao makes the best chocolate bread.', thanks: 'Golden cacao! Chocolate bread for the whole town tomorrow.' },
    { key: 'tooth', who: 'kanor', item: 'Old Buwaya Tooth', map: 'taal', how: 'hunt', n: 1, tier: 'hard', kind: 'buwaya',
      say: 'The old Buwaya of Taal: one tooth for my trophy wall.', thanks: 'Hah! That old Buwaya finally met its match. Good hunting!' },
    { key: 'lure', who: 'ewan', item: 'Lucky Lure', map: 'taal', how: 'find', n: 1, tier: 'easy',
      say: 'My lucky lure washed up somewhere on the shore of Taal.', thanks: 'Sixty years with this lure! The fish had better watch out.' },
    { key: 'silk', who: 'luz', item: 'Golden Silk Thread', items: 'Golden Silk Threads', map: 'sierra', how: 'find', n: 3, tier: 'medium',
      say: 'Golden silk from the Sierra, for a fiesta gown!', thanks: 'Ay, ang ganda! The fiesta gown will shine like the sun.' },
    { key: 'flute', who: 'jules', item: 'Bamboo Flute', map: 'sierra', how: 'hunt', n: 1, tier: 'hard', kind: 'unggoy',
      say: 'A monkey ran off with the Kapre\'s bamboo flute!', thanks: 'Listen to that sound! A new song, just for you.' },
    { key: 'map', who: 'marco', item: 'Treasure Map Piece', items: 'Treasure Map Pieces', map: 'palawan', how: 'find', n: 3, tier: 'medium',
      say: 'An old map, torn in three. Find the pieces and we split the treasure!', thanks: 'X marks the spot! Partners, you and me.' },
    { key: 'lily', who: 'hale', item: 'Glowing Cave Lily', map: 'palawan', how: 'find', n: 1, tier: 'easy',
      say: 'A lily that glows in the dark. It helps sleepy patients.', thanks: 'Beautiful. My patients will sleep well tonight.' },
  ];
  C.ADVENTURE_ICONS = C.ADVENTURES.map(function (a) { return 'qi_' + a.key; });
  C.ADVENTURE_ICONS.forEach(function (n) { if (C.ICON_ORDER.indexOf(n) < 0) C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  C.ADVENTURE_ICONS_IN = true; // (their picture is in the items sheet: tools/art/quest-items-import.js, 8 Nov 2026)
  // the day: 3 normal quests and 3 adventures, any 5 open the day's chest; all 6, one Sunbeam more
  C.DAILY2 = { normal: 3, need: 5, six: { stars: 1 }, goodDays: 5 };
  // prizes: one hidden piece, three pieces, a hunt
  C.ADVENTURE_PRIZES = { easy: { gold: 500 }, medium: [{ item: 'power_up', n: 1 }, { item: 'pet_meal', n: 1 }], hard: { stars: 1 } };
  // how hard (owner, 8 Nov 2026: "a little bit hard but not too hard"): docs/quests-adventures.md
  C.ADVENTURE_FEEL = { hidden: 4, apart: 15, away: 10, help: 120000, back: 60000, hpX: 2, hpXBig: 1.5, runX: 1.15 };
  // where the people stand who are not villagers
  C.ADVENTURE_PEOPLE = { luz: { name: 'Tita Luz', map: 'park' }, kanor: { name: 'Mang Kanor', map: 'pulag' } };
})(window.Farm = window.Farm || {});
