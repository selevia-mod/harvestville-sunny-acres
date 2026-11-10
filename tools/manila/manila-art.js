'use strict';
// Manila's pictures (owner, 11 Nov 2026; art-src/MANILA-PROMPTS.md batches 1-2) go in their own pack, 'manila'
// (tools/packs.js), never the page. Each is in the pack only once tools/manila/manila-import.js has made it from the
// owner's picture; until then the game draws its stand-in (src/19zzzzzzzzzzzzzzzzzzzzzzzzz-manila.js), so nothing here
// is needed to play. The names come from the game's own data (C.MANILA.art, C.MANILA.people).
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
// every key the pack can hold: the ground textures, the single pictures, the sheets' pieces, the people's sheets
const keys = () => {
  const M = config().MANILA, A = M.art, out = [];
  Object.keys(A.ground).forEach((slot) => out.push('manila_tex_' + slot));
  Object.keys(A.singles).forEach((n) => out.push('props/manila_' + n));
  Object.keys(A.sheets).forEach((sh) => A.sheets[sh][2].forEach((n) => out.push('props/manila_' + n)));
  M.people.order.forEach((k) => out.push(M.people[k].sheet));
  (M.crowd.sheets || []).forEach((k) => out.push(k)); // (the three ground guides, passers-by for now)
  // city life (docs/manila-city-life.md): its buildings, props and the jeepney; its people
  if (M.life) { Object.keys(M.life.art).forEach((n) => out.push('props/manila_' + n)); M.life.people.forEach((k) => out.push(k)); }
  return [...new Set(out)];
};

module.exports = {
  config,
  all: keys,
  packed: () => keys().filter((k) => fs.existsSync(path.join(ASSETS, k + '.webp'))),
};
