'use strict';
// The Lost Tower's pictures (owner, 12 Nov 2026; art-src/LOST-TOWER-PROMPTS.md) go in their own pack, 'tower'
// (tools/packs.js), never the page. Each is in the pack only once an importer has made it from the owner's picture; until
// then the game draws its stand-in (a tinted row of the wild sheet for a creature, the caves' tiles in the realm's colours,
// the caves' drawn gate for the stairs), so nothing here is needed to play. The names come from the game's own data
// (C.TOWER): each creature's sheet and its shadow (wild_<id>, wild_<id>shade: tower/zone<n>/wild_<art>.png, art = the
// prompt's file name when the id differs), each realm's stairs (props/tower_stairs_<n>: shut and open side by side, like
// props/lair_gate), cave tiles (tower_cave_<n>: laid out like assets/lair_cave) and 6 props (props/tower_<n>_<k>, k 1..6).
// The importer: tools/tower/tower-import.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');

const config = () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
  return ctx.window.Farm.Config;
};
// every key the pack can hold
const keys = () => {
  const C = config(), out = [];
  C.TOWER.zones.forEach((z) => {
    z.normal.concat([z.guard, z.mini, z.boss]).forEach((k) => { const d = C.WILD.animals[k]; out.push(d.sheet, d.sheet + 'shade'); });
    out.push(z.art.gate, z.art.cave);
    z.art.props.forEach((k) => out.push(k));
  });
  // the Keeper's shop (00-zzzzzzzzzzzzzzzzzzzzzzz-tower-shop.js; prompts ~/Downloads/lost-tower-shop-art/PROMPTS.md): the
  // keeper's 3 x 3 sheet, the shop's icons (C.TOWER_ICONS' order, 8 cells of 128 a row), the Keeper's gear worn (the
  // farmer's poses, boy and girl) and the horse's three looks (overlays laid out like ride2_horse)
  const K = C.KEEPER;
  out.push(K.person.sheet, 'tower_icons', 'tower_food_icons'); // (the Tower's food: tools/tower/food-icons-import.js)
  K.gear.forEach((g) => out.push(g.art + '_boy', g.art + '_girl'));
  K.horse.forEach((h) => out.push(h.art));
  return [...new Set(out)];
};

module.exports = {
  config,
  all: keys,
  packed: () => keys().filter((k) => fs.existsSync(path.join(ASSETS, k + '.webp'))),
};
