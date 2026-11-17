'use strict';
// The Open Plains' pictures (owner, 18 Nov 2026; art-src/manila/plains/, art-src/MANILA-PROMPTS.md batch 3) go in their own
// pack, 'plains' (tools/packs.js), never the page. Each is in the pack only once tools/manila/plains-import.js (and
// tools/art/animals3q-import.js plains, for the creatures) has made it; until then the game draws its stand-in
// (src/19zzz...z-plains.js), so nothing here is needed to play. The names come from the game's own data (C.PLACES.plains).
// (Ka Pedring's sheet, npc_ka_pedring, is in the 'manila' pack already: he walked the city before his plains opened.)
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
// (and the Bamboo Jungle's, the same way: keys('jungle'), its pack 'jungle'; Diday's sheet is in the 'manila' pack too)
const keys = (id = 'plains') => {
  const C = config(), P = C.PLACES[id], out = [];
  if (!P) return out;
  ['mouth', 'gate', 'cave'].forEach((k) => { if (P.dungeon.art[k]) out.push(P.dungeon.art[k]); });
  (C.WILD.more || []).forEach((k) => { const d = C.WILD.animals[k]; if (d.place === id && d.sheet) out.push(d.sheet, d.sheet + 'shade'); });
  C[id.toUpperCase()].kinds.forEach((k) => out.push('props/' + id + '_' + k));
  out.push('ground_' + id, 'ground_' + id + '_water', id + '_icons');
  return [...new Set(out)];
};

module.exports = {
  config,
  all: keys,
  packed: (id) => keys(id).filter((k) => fs.existsSync(path.join(ASSETS, k + '.webp'))),
};
