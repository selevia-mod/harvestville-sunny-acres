// Name frames (owner, 13 Nov 2026: docs/superpowers/specs/2026-11-13-name-frames-design.md, "lets build it"; the game
// only). Words and numbers: the rules are 01-logicZZZZZZZZZZZZZZZZZZZZZZ-name-frames.js, the pictures and the pages
// 19zzz...z-name-frames.js, the server supabase/farm_name_frames.sql (the owner applies it; the same file is
// ~/Downloads/name-frames-SQL/APPLY-name-frames.sql).
// - First in Selebox: the first player ever to beat each of the Tower's 10 big bosses wears that boss's frame, forever.
// - The weekly Lighthouse Board: last week's places 1, 2, 3 wear gold, silver, bronze this week; place 1 also has the
//   title "Lighthouse Champion" for the week.
// The frames' order is the picture sheet's (4 x 4 cells, 13 used): the 10 boss frames, floor 100 first, then gold,
// silver, bronze. Adds nothing to a saved list.
(function (F) {
  'use strict';
  var C = F.Config;
  var TW = C.TOWER;
  var BD = C.TOWER_BOARD;
  if (!TW || !BD || !C.WILD) return;
  var looks = {};
  // a realm's frame: its walls' colour, its light's bright rim (C.TOWER.zones' look and lava)
  TW.zones.forEach(function (z) {
    var boss = C.WILD.animals[z.boss];
    looks['tower_' + z.to] = {
      name: boss.name + ' Frame', short: boss.name, floor: z.to, realm: z.name,
      plate: z.look.wall[1], deep: z.look.wall[0], light: z.look.wall[2], rim: z.lava.hot[0], gem: z.lava.hot[1],
    };
  });
  var metal = {
    gold: { plate: '#c8901e', deep: '#7a5210', light: '#f2c84a', rim: '#fff0b0', gem: '#ffffff' },
    silver: { plate: '#8c98a8', deep: '#4c5664', light: '#c8d2de', rim: '#ffffff', gem: '#e8f4ff' },
    bronze: { plate: '#9a5a28', deep: '#5a3010', light: '#cc8a50', rim: '#ffd0a0', gem: '#fff0d8' },
  };
  BD.frames.forEach(function (k, i) {
    looks[k] = Object.assign({ name: k.charAt(0).toUpperCase() + k.slice(1) + ' Frame', short: k.charAt(0).toUpperCase() + k.slice(1), place: i + 1, week: true }, metal[k]);
  });

  C.NAME_FRAMES = {
    keys: TW.zones.map(function (z) { return 'tower_' + z.to; }).concat(BD.frames), // (the sheet's order)
    looks: looks,
    title: BD.title, // place 1's title, for the week
    cache: 10 * 60000, // ms an answer is kept on the phone
    retry: 30000, // ms before an id asked without an answer is asked again
    most: 60, // ids in one ask (the server's limit too)
    batch: 250, // ms the new players in a room are gathered before they are asked for
    sheet: 'name_frames', cols: 4, cell: 192, // the owner's pictures: a 4 x 4 sheet (the 'frames' pack)
    // a cell: the name's plate is the middle band of the cell (rows 0.25 to 0.75); the ends (0.3 of the width each) keep
    // their shape, the middle stretches with the name
    band: [0.25, 0.75], ends: 0.3,
    words: {
      page: 'MY FRAME',
      sub: 'The frame round your name, for everyone in Harvest Ville to see.',
      auto: 'Auto', autoDesc: "This week's board frame if you have one, else your newest boss frame.",
      none: 'No frame', noneDesc: 'Just your name.',
      wearing: 'Wearing',
      none_yet: 'Beat a big boss of The Lost Tower first (First in Selebox), or finish in the top 3 of the weekly Lighthouse Board, to win a frame.',
      offline: 'Join online play to see your frames.',
      soon: 'Name frames are coming very soon.',
      fail: 'Could not reach the online world. Check your connection.',
      picked: 'You wear the {name} now.',
      pickedAuto: 'Your frame is picked for you now.',
      pickedNone: 'No frame round your name now.',
    },
  };
})(window.Farm = window.Farm || {});
