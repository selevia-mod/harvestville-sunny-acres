// The Lost Tower, step 4 (owner, 12 Nov 2026: docs/superpowers/specs/2026-11-12-lost-tower-design.md, "The Keeper's shop",
// "Guards and bosses"): the lighthouse keeper's shop (Pearls only) at the lighthouse door in Manila and inside the Tower by
// its way in; the Keeper's gear (works only in the Tower: L.towerLess, L.towerSight); horse gear looks; the big bosses'
// Tower Blessings and the Tide set; the mini boss's horse gear dye. Content only: the rules are
// 01-logicZZZZZZZZZZZZZZZZZZZ-tower-shop.js, the shop and the keeper 19zzz...z-tower-shop.js.
// Pictures: drawn stand-ins until the owner's art is in the 'tower' pack (tools/tower/tower-art.js; the prompts:
// ~/Downloads/lost-tower-shop-art/PROMPTS.md). Their keys are the `art` names below.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;
  var TW = C.TOWER;

  C.KEEPER = {
    // the keeper: a villager's look (a row of the train visitors' sheet, tinted) until his own 3 x 3 sheet comes
    person: { name: 'Mang Ilaw', role: 'Keeper of the lighthouse', look: [3, 0xd8e8ff], sheet: 'npc_keeper',
      hello: 'I am Mang Ilaw. I have kept this lighthouse for fifty years, and the Tower under it. I take Pearls, nothing else.' },
    // where he stands inside the Tower, by the way in (L.TOWER_KEEP keeps it free), in tiles
    inside: [7.5, 3.8],
    // the Keeper's gear: one piece a slot (C.GEAR_SLOTS). less: the share of a tower enemy's hit it takes off (all four:
    // 60%); speed: walking in the Tower; sight: more tiles seen on the Darkness floors (the tricks' TR.dark.lantern).
    // Worn like any gear (the Gear page; the save's 'gw'), as pieces 'k:<id>'; owned: the save's 'kpr' (bits, this order).
    gear: [
      { id: 'hat', slot: 'head', name: "Keeper's Hat", price: 300, less: 0.1, art: 'keeper_hat' },
      { id: 'boots', slot: 'feet', name: "Keeper's Boots", price: 300, less: 0.1, speed: 0.1, art: 'keeper_boots' },
      { id: 'coat', slot: 'body', name: "Keeper's Coat", price: 500, less: 0.2, art: 'keeper_coat' },
      { id: 'lantern', slot: 'charm', name: "Keeper's Lantern", price: 800, less: 0.2, sight: true, art: 'keeper_lantern' },
    ],
    // horse gear looks (cosmetic): the save's 'hlk' [owned bits, worn bits], this order. Until their pictures come (an
    // overlay sheet each, laid out like ride2_horse), the horse wears a tint and the lantern a glow (tint, glow below).
    horse: [
      { id: 'saddle', name: "Keeper's Saddle", price: 400, tint: 0xffd8b0, art: 'horse_look_saddle' },
      { id: 'bridle', name: "Keeper's Bridle", price: 500, tint: 0xd8e4ff, art: 'horse_look_bridle' },
      { id: 'lantern', name: 'Horse Lantern', price: 600, glow: 0xfff0b0, art: 'horse_look_lantern' },
    ],
    weapon: 'A new weapon: coming soon',
  };

  // ---------- the big bosses (floors 100, 200 ... 1000), paid once each: the save's 'twb' (bits, boss 1 to 10) ----------
  // A Tower Blessing, forever: the odd ones (100, 300, 500, 700, 900) +5% damage in the Tower; the even ones (200 ... 1000)
  // +10 most energy, everywhere. And a piece of the Tide set (a costume, looks only: owned and listed until its art comes).
  TW.bless = { damage: 0.05, energy: 10 };
  TW.tide = ['Tide Crown', 'Tide Shell Mantle', 'Tide Cape', 'Tide Gauntlets', 'Tide Sash', 'Tide Belt', 'Tide Bracers', 'Tide Greaves',
    'Tide Boots', 'Tide Trident'];

  // ---------- the icons: painted into frames of the items texture past the sheet (as the weapons' are) ----------
  // The owner's picture, when it comes: tower_icons, 128 x 128 cells in this order, 8 a row.
  C.TOWER_ICON_BASE = 2100;
  C.TOWER_ICONS = ['k_hat', 'k_boots', 'k_coat', 'k_lantern', 'h_saddle', 'h_bridle', 'h_lantern', 'horse_dye', 'tide', 'weapon_soon', 'pearl'];
  C.towerIcon = function (name) { var i = C.TOWER_ICONS.indexOf(name); return i < 0 ? -1 : C.TOWER_ICON_BASE + i; };

  // ---------- the mini boss's chest: food (as before) and a horse gear dye ----------
  // and crop potions (farm economy v2, 00-zzz...-economy2.js, loaded before this): two Ginger Tonics, a Pineapple Juice, and
  // maybe an Ampalaya Brew and a Hunter's Coffee (spec: "Drops a chest: crop potions and a horse gear dye")
  var POTS = [['ginger_tonic', 2, 1], ['pineapple_juice', 1, 1], ['ampalaya_brew', 1, 0.5], ['hunters_coffee', 1, 0.5]].filter(function (d) { return C.ITEMS[d[0]]; });
  C.ITEMS.horse_dye = { name: 'Horse Gear Dye', kind: 'hunt', sell: 250, painted: true, icon: C.towerIcon('horse_dye'),
    desc: 'From a Tower mini boss. One day it colours your horse gear looks; keep it for now.' };
  TW.zones.forEach(function (z) { WI.animals[z.mini].drops = WI.animals[z.mini].drops.concat([['horse_dye', 1, 1]], POTS); });
})(window.Farm = window.Farm || {});
