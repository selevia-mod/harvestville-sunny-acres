'use strict';
// Banaue Terraces' pictures that go in the 'wild' pack (tools/packs.js), not the page (owner, 6 Nov 2026): each one
// only once tools/art/banaue-import.js (or animals3q-import.js places, for the creatures) has made it. Until then the
// game draws its stand-in, so nothing here is needed to play. (The ground, assets/banaue_ground, is a tileset: it stays
// in the page.)
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const PROPS = ['wall', 'hut', 'fern', 'rack', 'boulder', 'grass', 'mouth', 'gate'].map((n) => 'props/banaue_' + n);
const SHEETS = ['wild_itik', 'wild_bayawak', 'wild_goldduck', 'wild_kibaan', 'wild_cavebayawak', 'wild_kibaanchief', 'wild_amomongo'];
const ALL = PROPS.concat(['banaue_cave', 'npc_lola_bugan'], ...SHEETS.map((s) => [s, s + 'shade']));

module.exports = {
  all: ALL,
  packed: () => ALL.filter((k) => fs.existsSync(path.join(ASSETS, k + '.webp'))),
};
