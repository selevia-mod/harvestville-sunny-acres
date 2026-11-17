// Old saves load without losing anything (owner, 17 Nov 2026: "we need to fix the root cause"). Every past loss came
// from how a save was written or how an older save was read (the wider farm dropped sprinklers, Edit Farm a farmhouse,
// the limits cut what was over them). test/old-saves/ holds farms played and saved by the released games e30, e41, e49,
// e54, e55, e60 and e64 (each with its own rules: 1,500 random actions), with what the player owned there ('had', counted
// after that game's own load). This game must load every one and hold at least as much of everything.
// To add a version: extract it (git archive hv-ota-eNN src maps) and run the same maker (see the commit that added this).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error } };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
require('./clock')(ctx);

// what a player owns, by name (the same counting the maker used on the old game)
const own = (s) => {
  const O = C.OUTDOOR, H = C.HOME, n = {};
  const add = (k, v) => { if (v > 0) n[k] = (n[k] || 0) + v; };
  const yk = (t) => 'yard:' + (O.types[t] ? O.types[t].key : '#' + t);
  s.yard.items.forEach((it) => add(yk(it.t), 1));
  Object.keys(s.yard.bag).forEach((t) => add(yk(t), s.yard.bag[t]));
  const fk = (t, v) => 'furn:' + (H.types[t] ? H.types[t].key : '#' + t) + '.' + v;
  s.home.items.forEach((it) => add(fk(it.t, it.v), 1));
  Object.keys(s.home.bag).forEach((k) => { const p = k.split('.'); add(fk(Number(p[0]), Number(p[1])), s.home.bag[k]); });
  const items = (list) => (list || []).forEach((x) => x && add('item:' + x.id, x.n || 1));
  items(s.inv); items(s.store); items(s.box); items(s.shelves);
  Object.keys(s.basket || {}).forEach((id) => add('item:' + id, s.basket[id]));
  Object.keys(s.soil || {}).forEach((k) => { const t = s.soil[k]; if (t.sp && C.SPRINKLERS[t.sp - 1]) add('item:' + C.SPRINKLERS[t.sp - 1].id, 1); if (t.c) add('crop:' + t.c, 1); });
  (s.animals || []).forEach((a) => add('animal:' + a.kind, 1));
  // the horse cart's load and a load on the road with Mang Kardo (18 Nov 2026; older games have none)
  const cargo = (c) => Object.keys(c || {}).forEach((k) => add('item:' + k.split('~')[0], c[k]));
  if (s.gm) { cargo(s.gm.cargo); if (s.gm.trip) cargo(s.gm.trip.cargo); }
  // the trucks' parked loads and a City Order delivery waiting for its answer (18 Nov 2026)
  if (s.gm) { Object.keys(s.gm.park || {}).forEach((v) => cargo(s.gm.park[v])); if (s.gm.co && s.gm.co.q) cargo(s.gm.co.q.lots); }
  ['gold', 'lumber', 'stone', 'pearls'].forEach((k) => add(k, s[k] || 0));
  return n;
};
const DIR = path.join(__dirname, 'old-saves');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

test('there are old saves from seven released games', () => {
  assert.ok(files.length >= 14, files.length + ' files');
  assert.deepStrictEqual([...new Set(files.map((f) => f.split('-')[0]))], ['e30', 'e41', 'e49', 'e54', 'e55', 'e60', 'e64']);
});

files.forEach((f) => {
  test('a farm saved by ' + f.replace('.json', '') + ' loads with everything its player owned', () => {
    const { had, save } = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const s = L.deserialize(JSON.parse(JSON.stringify(save)));
    const now = own(s);
    const lost = Object.keys(had).filter((k) => (now[k] || 0) < had[k]).map((k) => k + ' ' + had[k] + ' -> ' + (now[k] || 0));
    assert.deepStrictEqual(lost, []);
    // and its first save in this game keeps it all too
    const again = own(L.deserialize(JSON.parse(JSON.stringify(L.serialize(s)))));
    const lost2 = Object.keys(now).filter((k) => (again[k] || 0) < now[k]).map((k) => k + ' ' + now[k] + ' -> ' + (again[k] || 0));
    assert.deepStrictEqual(lost2, []);
  });
});
