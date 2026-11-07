// A look for each hunting place's cave (owner, 8 Nov 2026), like the Lair's Fire look: never in Tita Luz's shop. Each
// time you share the hunt of a cave's floor-50 boss, a 1 in 10 chance it is yours; or Kanor makes it from 500,000 Gold
// and the cave's boss and guard parts (owner: "Yes okay"). Art: art-src/DUNGEON-LOOKS-PROMPTS.md, cut by
// tools/art/look-cut.cjs, in by tools/art/tailor-import.js; the pictures come from the CDN like every look (Costumes pack).
// Rules 01-logicZZZZZZZ-cave-looks.js; Kanor's rows 19zu-lair-ui.js. After 00-zzzlooks.js: appended, so the save's bits keep.
(function (F) {
  'use strict';
  var C = F.Config;

  var NEW = [
    { key: 'terrace', name: 'Terrace Keeper', reward: 'banaue', desc: 'A rattan headband with a rice sprig and a vest striped like the rice terraces.' },
    { key: 'hills', name: 'Hill Wanderer', reward: 'bohol', desc: 'A dotted cocoa bandana and a jacket with little round hills on the hem.' },
    { key: 'lake', name: 'Lake Spirit', reward: 'taal', desc: 'A pearl headband and sea-green clothes with white waves.' },
    { key: 'forest', name: 'Forest Guardian', reward: 'sierra', desc: 'A leaf bandana or a leaf crown, and moss-green clothes with leaves on the hem.' },
    { key: 'feather', name: 'Moon Feather', reward: 'palawan', desc: 'Midnight blue with gold feathers and a little silver moon.' },
  ];
  NEW.forEach(function (l) { if (C.LOOK_INDEX[l.key] == null) C.LOOKS.push(l); });
  C.LOOK_INDEX = {};
  C.LOOKS.forEach(function (l, i) { C.LOOK_INDEX[l.key] = i; });

  // what Kanor wants for one, besides the place's boss and guard parts (L.starParts): how many of each
  C.CAVE_LOOK = { chance: 0.1, gold: 500000, boss: 4, guard: 2 };
})(window.Farm = window.Farm || {});
