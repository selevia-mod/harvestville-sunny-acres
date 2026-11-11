// The game's own rules, loaded from src/ exactly as the game's tests load them (test/banaue.test.js): every 00- and
// 01- file run in a vm with a bare `window`, so the server's monsters use the very numbers the phones do (C.WILD,
// C.LAIR, the places' caves, L.lairRoster, L.dunRoster, L.lairHp, L.dunHp, L.wildPack, L.gearNotice, ...).
// The world's half of a cave (19zt-lair.js) needs Phaser, so its two small rules the server needs are copied here:
// which cave a map is (F.dungeonOf) and its floor list (cfg.roster).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function load(root) {
  const dir = path.join(root || ROOT, 'src');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  fs.readdirSync(dir).filter((f) => /^0[01]-/.test(f)).sort()
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  const F = ctx.window.Farm;
  const C = F.Config;
  const L = F.Logic;
  const WI = C.WILD;

  // Which cave a map is (19zt-lair.js F.dungeonOf, without its pictures): the Lair, or a hunting place's dungeon.
  const cfgs = {};
  const dungeonOf = (map) => {
    if (typeof map !== 'string' || !Object.prototype.hasOwnProperty.call(C.DUNGEONS, map)) return null;
    if (cfgs[map]) return cfgs[map];
    if (map === 'lair') {
      return (cfgs[map] = { key: 'lair', lair: true, floors: C.LAIR.floors, place: 'magayon', roster: (f) => L.lairRoster(f) });
    }
    const id = C.DUNGEONS[map], d = C.PLACES[id] && C.PLACES[id].dungeon;
    if (!d) return null;
    return (cfgs[map] = { key: map, lair: false, floors: d.floors, place: id, d, roster: (f) => L.dunRoster(map, f) });
  };

  // The hardest an arrow can hit: the best bow, plus one for a strong shot (Hunting 5+, 01-logicZ-skills.js s.skHit).
  // (11 Nov 2026: and the new weapons' best, C.WEAPONS: a Gold or better Javelin hits 4, 5 with a strong shot)
  const maxDamage = Math.max.apply(null, WI.bow.damage.concat(...Object.values(C.WEAPONS || {}).map((w) => w.damage))) + 1;

  return { F, C, L, WI, T: C.TILE, dungeonOf, maxDamage, root: root || ROOT };
}

let cached = null;
module.exports = { load, rules: () => cached || (cached = load()) };
