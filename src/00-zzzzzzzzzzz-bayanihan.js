// Bayanihan Projects (owner, 6 Nov 2026: "Bayani Projects, i like this"; "we are loosing the real purpose of game, the
// farm and town. We need to make it related to the town."). The whole of Harvest Ville builds Willowbrook together: one
// project at a time, every player on the server gives toward the same needs (crops, farm goods, workshop goods, fish,
// ore, lumber and stone, a few hunted things), a barangay's gifts also count for the barangay, and when a project is done
// the town changes for everyone and a real benefit opens. Everyone who gave gets Gold, a title and a yard piece.
// Content only: the rules are 01-logicZZZZ-bayanihan.js, the board, the town and the tour 19zzzz-bayanihan.js, the
// server supabase/farm_online_20.sql (the numbers there are the real ones; these are the same, for the board offline).
(function (F) {
  'use strict';
  var C = F.Config;
  var O = C.OUTDOOR;

  C.BH = {
    // The projects, in order. key: the server's name for it (farm.bh_projects). needs: [item, how many the town needs,
    // points each one is worth, most one farmer may give of it in a day]. 'lumber' and 'stone' are the farm's lumber and
    // stone. deco: the yard piece everyone who gave gets (below). The server holds the real numbers: change both.
    projects: [
      {
        key: 'bridge', name: 'The Old Bridge', title: 'Bridge Builder', icon: 'lumber', deco: 'bh_bench',
        what: 'The footbridge west of the dock fell into the river long ago. Fix it, and the lane and the chapel are a short walk away.',
        benefit: 'A shortcut over the river to the lane and the chapel, and a fishing spot on the bridge where bigger fish bite.',
        needs: [['lumber', 1500, 1, 60], ['stone', 1000, 1, 60], ['ore_copper', 400, 2, 25], ['fish_s', 300, 2, 15]],
      },
      {
        key: 'market', name: 'The Market Hall', title: 'Market Maker', icon: 'crate', deco: 'bh_stall',
        what: 'A roof over the plaza market stall, with room for more on every shelf.',
        benefit: 'Market stall shelves hold 10 more, and every lot sold at the stall pays 10% more.',
        needs: [['wheat', 1500, 1, 60], ['egg', 600, 2, 20], ['milk', 300, 3, 12], ['bread', 200, 4, 8], ['ore_silver', 200, 3, 10]],
      },
      {
        key: 'fountain', name: 'The Plaza Fountain', title: 'Fountain Keeper', icon: 'gem', deco: 'bh_fountain',
        what: 'New stone, flowers and lights around the old fountain: a place for the whole town to meet.',
        benefit: 'Flowers and lights in the plaza, and a wishing coin at the fountain: once a day, a little gift.',
        needs: [['stone', 1500, 1, 60], ['ore_silver', 300, 3, 12], ['fish_m', 200, 3, 10], ['butter', 80, 6, 4], ['gem', 40, 10, 2]],
      },
      {
        key: 'bell', name: 'The Chapel Bell', title: 'Bell Ringer', icon: 'ore_gold', deco: 'bh_lantern',
        what: 'A bronze bell for the chapel, cast from the mine\'s ore and hung by the whole town.',
        benefit: 'Festival days give more: ring the bell on a festival day for a festival gift, and festival contest prizes pay 25% more.',
        needs: [['ore_copper', 800, 2, 25], ['ore_gold', 250, 4, 8], ['feather_labuyo', 300, 1, 20], ['antler', 60, 5, 3], ['cake', 60, 8, 3]],
      },
      {
        key: 'pier', name: 'The Old Pier', title: 'Pier Captain', icon: 'fish_l', deco: 'bh_boat',
        what: 'A longer pier on the beach and a boat for the town. One day it will carry you to the islands.',
        benefit: 'The pier reaches the boat, and the boatman brings you a fresh catch once a day. Island trips are coming!',
        needs: [['lumber', 2500, 1, 80], ['meat_boar', 150, 2, 6], ['tusk', 80, 4, 3], ['fish_l', 120, 5, 4], ['cheese', 60, 6, 3]],
      },
    ],
    // What everyone who gave gets when a project is done, by the points they gave to it (the server decides; these are
    // its numbers, for the board): the tier's Gold, the project's title and its yard piece. Claimed once, at the board.
    tiers: [{ at: 1, name: 'Helper', gold: 300 }, { at: 150, name: 'Builder', gold: 1000 }, { at: 500, name: 'Hero', gold: 2500 }],
    cap: 800, // the most points one farmer can give to one project (so nobody can flood it)
    top: 10, // the top givers the board shows
    pickMost: 50, // the most the Give box offers in one go
    hallShelf: 50, // (was 10 when a shelf held 20) // the Market Hall: each stall shelf holds this many more
    hallPay: 1.1, // the Market Hall: stall sales pay this much more
    wish: [['gold', 120], ['gold', 200], ['fert', 3], ['treat', 1], ['seed', 5], ['gold', 300]], // the fountain's daily wishing coin, one at random
    bellGold: 500, // the Chapel Bell: the festival gift for ringing it on a festival day
    contestPay: 1.25, // the Chapel Bell: festival contest prizes
    boat: [['fish_m', 2], ['fish_l', 1]], // the Old Pier: the boatman's catch, once a day
    names: { lumber: 'Lumber', stone: 'Stone' }, // (not bag items: the farm's lumber and stone)
    // The hook for later (owner, 6 Nov 2026): the boat will carry players to island hunting places. Until then it says so.
    islands: null,
  };

  // The bridge's fishing spot: bigger fish more often than the river (C.FISH_TABLE.river is 35/40/20/5).
  C.FISH_TABLE.bridge = { fish_s: 0.2, fish_m: 0.4, fish_l: 0.3, fish_k: 0.1 };

  // The yard pieces (not sold: cat 'none'; each uses a picture the game already has). Appended: the save keeps a yard
  // piece as its place in this list.
  [
    { key: 'bh_bench', name: 'Bayanihan Bench', kind: 'prop', cat: 'none', w: 2, h: 1, foot: 1, price: 0, beauty: 9, prop: 'bench', what: 'the Old Bridge bench' },
    { key: 'bh_stall', name: 'Little Market Stall', kind: 'prop', cat: 'none', w: 2, h: 2, foot: 1, price: 0, beauty: 12, prop: 'fruit_stall', what: 'a little market stall' },
    { key: 'bh_fountain', name: 'Plaza Birdbath', kind: 'prop', cat: 'none', w: 1, h: 2, foot: 1, price: 0, beauty: 10, like: 'birdbath', what: 'a little fountain' },
    { key: 'bh_lantern', name: 'Chapel Lantern', kind: 'prop', cat: 'none', w: 1, h: 2, foot: 1, price: 0, beauty: 10, prop: 'lantern', what: 'a chapel lantern' },
    { key: 'bh_boat', name: 'Little Bangka', kind: 'prop', cat: 'none', w: 3, h: 2, foot: 0, flat: true, price: 0, beauty: 16, prop: 'boat', what: 'a little boat' },
  ].forEach(function (t) {
    if (O.index[t.key] != null) return;
    O.index[t.key] = O.types.length;
    O.types.push(t);
  });
})(window.Farm = window.Farm || {});
