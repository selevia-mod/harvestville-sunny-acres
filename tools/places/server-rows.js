'use strict';
// The server rows a hunting place needs (owner, 7 Nov 2026), read from the game's own data, so a new place's part of
// the SQL is never typed by hand: its map for Hunting now (farm.hunt_maps, part 23), its animals for the Biggest catch (farm.catch_kinds: kind and usual weight, part 14)
// and its dungeon boss for the Hall of Fame (farm.hall_first_keys: '<place>_boss', part 22). Prints SQL; the owner runs
// it. node tools/places/server-rows.js [place ...]   (no place: every new place)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config, A = C.WILD.animals;
const want = process.argv.slice(2);
const ids = C.PLACE_ORDER.filter((id) => !C.PLACES[id].legacy && !C.PLACES[id].dev && (!want.length || want.includes(id)));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const kinds = [], firsts = [], maps = [];
ids.forEach((id) => {
  const p = C.PLACES[id];
  maps.push('(' + q(p.map) + ')');
  p.kinds.forEach((k) => kinds.push('(' + q(k) + ', ' + A[k].kg + ')'));
  const f = C.HALL.FIRSTS.find((x) => x.key === id + '_boss');
  if (f) firsts.push('(' + q(f.key) + ', ' + q(f.name + ', ' + p.dungeon.name) + ')');
});
console.log('insert into farm.hunt_maps (map) values ' + maps.join(', ') + ' on conflict (map) do nothing;');
console.log('insert into farm.catch_kinds (kind, kg) values\n  ' + kinds.join(', ') + '\non conflict (kind) do nothing;');
console.log('insert into farm.hall_first_keys (key, what) values\n  ' + firsts.join(',\n  ') + '\non conflict (key) do nothing;');
