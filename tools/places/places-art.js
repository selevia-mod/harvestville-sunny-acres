'use strict';
// The new hunting places' pictures (owner, 6 Nov 2026: Banaue Terraces, Chocolate Hills, Taal Lake, Sierra Madre and
// Palawan) go in their own pack, 'places' (tools/packs.js), not the page and not the Wild Lands' pack, so a phone that has
// the Wild Lands keeps opening Pulag at once. Each picture is in the pack only once tools/art has made it (banaue-import.js,
// places-import.js, animals3q-import.js places); until then the game draws its stand-in, so nothing here is needed to
// play. (Not here: a place's ground tileset, like assets/banaue_ground, stays in the page with its map; Kanor's Jeep and
// the Hall of Fame are in the page too: they stand in Pulag and Central Park.)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');

const keys = () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
  const C = ctx.window.Farm.Config, out = [];
  C.PLACE_ORDER.map((id) => C.PLACES[id]).filter((p) => p.n > 10 && !p.dev).forEach((p) => {
    if (p.npc && p.npc.sheet) out.push(p.npc.sheet);
    const art = (p.dungeon && p.dungeon.art) || {};
    ['mouth', 'gate', 'cave'].forEach((k) => { if (art[k]) out.push(art[k]); });
  });
  (C.WILD.more || []).forEach((k) => { const d = C.WILD.animals[k]; if (d.sheet) out.push(d.sheet, d.sheet + 'shade'); });
  // Banaue's own props (its map's 'place_prop' objects: tools/places/banaue-map.js), the others' (tools/art/places-import.js)
  ['wall', 'hut', 'fern', 'rack', 'boulder', 'grass'].forEach((n) => out.push('props/banaue_' + n));
  Object.keys(C.PLACE_PROP_KINDS || {}).forEach((id) => C.PLACE_PROP_KINDS[id].forEach((k) => out.push('props/' + id + '_' + k)));
  // their ground (Chocolate Hills' and the three of C.PLACE_GROUND: painted into their maps' tiles when you arrive)
  ['bohol'].concat(C.PLACE_GROUND || []).forEach((id) => out.push('ground_' + id, 'ground_' + id + '_water'));
  return [...new Set(out)];
};

module.exports = {
  packed: () => keys().filter((k) => fs.existsSync(path.join(ASSETS, k + '.webp'))),
  all: keys,
};
