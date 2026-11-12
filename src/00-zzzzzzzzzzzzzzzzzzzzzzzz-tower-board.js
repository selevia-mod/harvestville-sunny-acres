// The Lost Tower, step 5 (owner, 12 Nov 2026: docs/superpowers/specs/2026-11-12-lost-tower-design.md, "Guards and
// bosses" (First in Selebox) and "The weekly board"). Words and numbers only: the rules are
// 01-logicZZZZZZZZZZZZZZZZZZZZ-tower-board.js, the world and the pages 19zzz...z-tower-board.js, the server
// supabase/farm_tower_board.sql (the owner applies it; the same file is ~/Downloads/tower-board-SQL/APPLY-tower-board.sql).
// - First in Selebox: the first player ever to beat each big boss (floors 100, 200 ... 1000). Ten more firsts for the Hall
//   of Fame's list (C.HALL.FIRSTS, claimed as the others are: O.claimFirsts), their names on the lighthouse wall in Manila.
// - The weekly board: new Tower floors cleared this week (Manila's week, from Monday 00:00), the top 10 and your own line;
//   last week's prizes in Pearls, paid by the server once.
// Adds nothing to a saved list.
(function (F) {
  'use strict';
  var C = F.Config;
  var TW = C.TOWER;
  var HALL = C.HALL;
  if (!TW || !HALL) return;

  C.TOWER_BOARD = {
    name: 'The Lighthouse Board',
    // every number the server keeps too (farm.tower_board_config): the server's are the ones that pay
    dayCap: 100, // new floors the server counts for one player in one Manila day
    perSend: 50, // floors in one send
    queue: 300, // floors waiting to be sent, at most (newest kept)
    sendEvery: 60000, // ms between sends (and after a floor is cleared)
    prizes: [300, 200, 150, 50, 50, 50, 50, 50, 50, 50], // Pearls for places 1 to 10, last week
    every: { floors: 10, pearls: 10 }, // everyone else with 10+ new floors last week
    frames: ['gold', 'silver', 'bronze'], // places 1 to 3: a frame for the week (kept on the server for when frames come)
    title: 'Lighthouse Champion', // place 1: the title for the week, and the name on the lighthouse banner
    offline: 'Join online play to see the board.',
    soon: 'The weekly board opens very soon. Your new floors are kept until then.',
    words: 'Climb new floors of The Lost Tower this week. Each floor counts once, the first time you clear it. ' +
      'The board starts over every Monday at midnight, Manila time.',
    wall: 'FIRST IN SELEBOX', // (the lighthouse wall: the first players ever to beat each big boss)
  };

  // ---------- First in Selebox: one first for each big boss ----------
  // map 'tower' with its floor: a hunt never wins it by itself (the Lair's floor check is for the Lair); the Tower claims it
  // when the boss's floor is cleared (F.towerFirst). words: what the "first" message says.
  TW.zones.forEach(function (z) {
    var boss = C.WILD.animals[z.boss], floor = z.to;
    HALL.FIRSTS.push({
      key: 'tower_' + floor, map: 'tower', kind: z.boss, floor: floor, tower: true, name: boss.name + ' (floor ' + floor + ')',
      words: 'FIRST IN SELEBOX!\nYou are the first player ever to beat ' + boss.name + ' on floor ' + floor + ' of The Lost Tower! ' +
        'Your name is on the lighthouse wall in Manila for everyone to see.',
    });
  });
})(window.Farm = window.Farm || {});
