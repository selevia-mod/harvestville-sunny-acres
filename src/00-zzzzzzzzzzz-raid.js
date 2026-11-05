// Town Raid (owner, 6 Nov 2026: "Town Raid, yes agree, it will replace the world boss"; "we are loosing the real purpose
// of game, the farm and town"). Twice a week, at set times by Manila time, something attacks Harvest Ville's fields. The
// raid comes to each player's OWN farm (no big shared room): raiders walk or fly at your crops and you drive them off
// with your tools (and the Bow, if you have one). Every hit you land is sent to the server in small batches and adds to
// ONE goal the whole town shares ("3,214 farmers defending · 67%"). Everyone who helps gets a chest; if the town wins,
// everyone gets a bonus day. Gentle: a raider can take at most a couple of crops, only while you are playing on your farm.
// This file is the data (all the numbers to tune); the rules are in 01-logicZZZZ-raid.js, the screen in 19zzzz-raid.js,
// the server in supabase/farm_online_21.sql (its numbers match these: change both together).
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60;

  C.RAID = {
    // ---------- when ----------
    // Monday and Thursday, 8:00 to 8:30 PM Manila time (UTC+8), by the game's clock (the app's server time). A chip
    // counts down from 30 minutes before. (Double Drops are Wednesday and Saturday: a won raid's bonus day is the
    // Tuesday or Friday after.)
    days: [1, 4], // 0 = Sunday
    start: 20 * H, // minutes after midnight, Manila
    mins: 30, // how long a raid lasts
    tz: 8 * H, // Manila is UTC+8 (no daylight saving)
    warn: 30, // minutes of countdown before it starts
    late: 3, // minutes after the end the server still takes a last batch of hits (a phone on a slow line)

    // ---------- what attacks (one each raid, round and round; the server uses the same order) ----------
    // (Arranged so the first raid, Monday 9 Nov 2026, is the boars; then crows, sparks, the typhoon, and again.)
    // look: which picture stands in for it (the wild animals' sheet when it is on the phone, else a farm animal tinted;
    // see docs/town-raid.md for the pictures that would make it nicer). hp: hits to drive one off. speed: tiles a second.
    // tools: what works on it ('any' = any tool; 'bow': arrows work too; 'hands': shooing with empty hands works).
    // eat: seconds a raider stands on a crop before it is lost. most: raiders on the farm at once.
    order: ['spark', 'typhoon', 'boar', 'crow'],
    kinds: {
      boar: {
        name: 'Giant Boar Stampede', one: 'Giant Boar', many: 'Giant Boars', verb: 'Hit', icon: 'meat_boar',
        look: { wild: 'boar', tint: 0x9a7a66, farm: 24, farmTint: 0x7a5a48, w: 1.5, px: 178 },
        hp: 3, speed: 1.3, eat: 12, most: 4, every: [3, 5], tools: ['any', 'bow'],
        start: 'Giant boars are stampeding toward the fields! Hit them with your tools (or shoot them with your Bow) to chase them off before they trample your crops.',
        lost: 'A boar trampled your {crop}!', off: 'Chased off!',
      },
      crow: {
        name: 'Crow Swarm', one: 'Crow', many: 'Crows', verb: 'Shoo', icon: 'feather_labuyo', flies: true,
        look: { wild: 'labuyo', tint: 0x343444, farm: 0, farmTint: 0x2c2c38, w: 0.85, px: 165 },
        hp: 1, speed: 1.7, eat: 9, most: 6, every: [2, 3.5], tools: ['any', 'bow', 'hands'],
        start: 'A swarm of crows is coming for the crops! Scare them off: swing a tool, wave your hands, or shoot with your Bow.',
        lost: 'The crows pecked your {crop} away!', off: 'Shoo!',
      },
      spark: {
        name: 'Lava Bakunawa\'s Sparks', one: 'Spark', many: 'Sparks', verb: 'Douse', icon: 'ember_shard', flies: true, glow: 0xff8a2a,
        look: { wild: 'santelmo', tint: 0xffb070, farm: null, w: 1, px: 128, light: true }, // (light: it glows over the night)
        hp: 2, speed: 1.1, eat: 14, most: 4, every: [3, 5], tools: ['can'],
        start: 'The Lava Bakunawa is shaking Mt. Magayon! Sparks are raining on the fields. Water them out with your Watering Can!',
        lost: 'A spark burned your {crop}!', off: 'Out!', why: 'Sparks need water! Hold your Watering Can.',
      },
      typhoon: {
        name: 'Typhoon Night', one: 'Debris', many: 'flying debris', verb: 'Clear', icon: 'storm', flies: true,
        look: { icons: ['lumber', 'stone', 'lumber'], w: 0.8 },
        hp: 2, speed: 1.5, eat: 14, most: 5, every: [2.5, 4.5], tools: ['hoe', 'axe', 'hammer', 'sickle'],
        start: 'A typhoon is blowing in! Branches and stones are flying onto the fields. Clear them with your Hoe, Axe, Hammer or Sickle.',
        lost: 'Flying debris flattened your {crop}!', off: 'Cleared!', why: 'Clear debris with the Hoe, Axe, Hammer or Sickle.',
      },
    },
    reach: 1.3, // tiles: how close a raider must be to swing at it
    bowRange: 6, // tiles: the Bow's reach at a raider

    // ---------- gentle: what a raid can take ----------
    // At most this many crop tiles per raid, and only while you are playing on your own farm (nobody loses anything
    // while away, offline, or on a friend's farm). Withered crops are never targeted.
    lossMost: 2,

    // ---------- fair play: no Coins or Stars buy anything here ----------
    // Hits cost no energy (energy can be bought, so it must not buy hits). The server caps hits per player per raid,
    // and at a sane rate; the game stops counting at the same cap.
    cap: 300, // hits per player per raid
    rate: 2, // hits a second, at most, on average (the server allows `burst` more on top)
    burst: 30,
    batchMost: 60, // hits in one call, at most
    sendEvery: 10, // seconds between batches of hits
    pollEvery: 30, // seconds between looks at the town's bar while you are not hitting

    // ---------- the town's goal ----------
    // goal = the bigger of minGoal and perDefender x farmers who landed a hit. Everyone who helps adds to it as they
    // join, so the bar means the same with 20 farmers or 20,000.
    minGoal: 500,
    perDefender: 80,

    // ---------- rewards ----------
    // A chest by how many hits you landed (tiers: at least 10, 80, 200). Gold and farm things, never Coins or Stars.
    // The town won: the chest's gold x1.5, and the bonus day for everyone who helped.
    chests: [
      { min: 10, name: 'Helper\'s Chest', gold: 300, items: [['fert', 2]] },
      { min: 80, name: 'Defender\'s Chest', gold: 800, items: [['fert', 4], ['arrows', 10]] },
      { min: 200, name: 'Hero\'s Chest', gold: 1500, items: [['fert_rich', 3], ['arrows', 20], ['sprinkler_copper', 1]] },
    ],
    wonGold: 1.5,
    // The bonus day (owner: "crops grow faster or Double Drops for the rest of the day, you choose"): Double Drops from
    // the end of a won raid until midnight (Manila) at the end of the NEXT day, so Tuesday or Friday is a whole bonus day.
    bonus: { kind: 'double', days: 1 },

    // ---------- alone (offline, not signed in, or the server is not there yet) ----------
    // The raid still comes to your farm: a small goal of your own and a smaller chest.
    alone: { goal: 40, chests: [{ min: 10, name: 'Helper\'s Chest', gold: 150, items: [['fert', 1]] }, { min: 40, name: 'Farm Guard Chest', gold: 400, items: [['fert', 2], ['arrows', 5]] }] },
  };
})(window.Farm = window.Farm || {});
