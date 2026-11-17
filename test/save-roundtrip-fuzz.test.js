// The save round trip, under stress (owner, 17 Nov 2026: "we need to fix the root cause"). Every loss so far was one
// part of the save written wrong (the wider farm's sprinklers, the farmhouse, the limits, a fence on a path), found only
// after players lost pieces. This test plays thousands of random actions with the game's own rules (farm pieces,
// furniture, the bag, the storage chest, crops, sprinklers, animals, the basket, gold), saves and loads again and again,
// and checks that the WHOLE state comes back exactly as it was. A new feature that saves something wrong fails here,
// before it ships. (scratchpad tools/save-roundtrip.js-style; seeds are fixed, so a failure always repeats.)
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
const clock = require('./clock')(ctx); // (a still clock: a time stamp never moves between a save and its load)
const O = C.OUTDOOR, H = C.HOME;
const FARM = L.farmInfo(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8')));

// the same text for the same state: object keys sorted, lists of objects sorted (their order is not what a player owns),
// and a key that is 0, empty or off the same as one not there
const canon = (v) => {
  if (Array.isArray(v)) {
    const xs = v.map(canon);
    return xs.length && xs.every((x) => x.charAt(0) === '{') ? '[' + xs.slice().sort().join(',') + ']' : '[' + xs.join(',') + ']';
  }
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined && v[k] !== null && v[k] !== 0 && v[k] !== false && v[k] !== '').map((k) => k + ':' + canon(v[k])).join(',') + '}';
  return v === undefined ? 'u' : JSON.stringify(v);
};
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
// What loading works out again by itself, not something a player owns: a tile's watering (sprinklers water their tiles
// again when the farm loads).
const DERIVED = { soil: ['w'] };
const CLOCK = { time: 1 }; // (the time of day: worked out from the clock on load)
const strip = (k, v) => {
  if (!DERIVED[k] || !v || typeof v !== 'object') return v;
  const out = {};
  Object.keys(v).forEach((i) => { const t = Object.assign({}, v[i]); DERIVED[k].forEach((f) => delete t[f]); out[i] = t; });
  return out;
};
const differences = (a, b) => {
  const out = [];
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
    if (CLOCK[k]) return;
    const va = strip(k, a[k]), vb = strip(k, b[k]);
    if (canon(va) === canon(vb)) return;
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) {
      new Set([...Object.keys(va), ...Object.keys(vb)]).forEach((j) => {
        const x = canon(va[j]), y = canon(vb[j]);
        if (x !== y) out.push(k + '.' + j + ': ' + x.slice(0, 160) + '  ->  ' + y.slice(0, 160));
      });
    } else out.push(k + ': ' + canon(va).slice(0, 200) + '  ->  ' + canon(vb).slice(0, 200));
  });
  return out;
};

const play = (seed, steps, every) => {
  let r = seed;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const int = (n) => Math.floor(rnd() * n);
  const pick = (a) => a[int(a.length)];
  const yardKinds = O.types.map((t, i) => i).filter((i) => O.types[i].cat !== 'none');
  const furnKinds = H.types.map((t, i) => i);
  const items = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].kind !== 'tool');
  const seeds = items.filter((k) => C.ITEMS[k].kind === 'seed');
  const sprinklers = (C.SPRINKLERS || []).map((sp) => sp.id);
  const kinds = Object.keys(C.ANIMALS);
  // (a fresh game, saved and loaded once: what loading fills in by itself is then part of both sides)
  const tiles = yardKinds.filter((i) => L.isYardTile(i));
  const start = L.newState();
  start.home.level = H.levels.length; // (the biggest house: room for plenty of furniture)
  let s = roundTrip(start);
  s.gold = 5e6;
  const slotOf = (id) => s.inv.findIndex((x) => x && x.id === id);
  for (let a = 1; a <= steps; a++) {
    const k = rnd();
    if (k < 0.12) { // a line of fences, paths or hedges, as players lay them (lines cross: a fence over a path)
      const t = pick(tiles), n = 3 + int(13), down = rnd() < 0.5, x0 = 1 + int(73), y0 = 1 + int(62);
      s.yard.bag[t] = (s.yard.bag[t] || 0) + n;
      for (let j = 0; j < n; j++) L.placeYard(s, FARM, t, down ? x0 : x0 + j, down ? y0 + j : y0);
    }
    else if (k < 0.3) { const t = pick(yardKinds); s.yard.bag[t] = (s.yard.bag[t] || 0) + 1; L.placeYard(s, FARM, t, 1 + int(73), 1 + int(62)); }
    else if (k < 0.36 && s.yard.items.length) L.storeYard(s, int(s.yard.items.length));
    else if (k < 0.41 && s.yard.items.length) L.moveYard(s, FARM, int(s.yard.items.length), 1 + int(73), 1 + int(62));
    else if (k < 0.5) { const t = pick(furnKinds), key = L.furnKey(t, 0); s.home.bag[key] = (s.home.bag[key] || 0) + 1; const at = L.findSpot(s, t, int(20), int(14), null); if (at) L.placeFurn(s, t, 0, at.x, at.y, int(4)); }
    else if (k < 0.53 && s.home.items.length) L.storeFurn(s, int(s.home.items.length));
    else if (k < 0.56 && s.home.items.length) L.moveFurn(s, int(s.home.items.length), int(12), int(10), int(4));
    else if (k < 0.66) L.addItem(s, pick(items), 1 + int(15));
    else if (k < 0.7) { const i = int(s.inv.length); if (s.inv[i]) L.removeAt(s, i, 1 + int(3)); }
    else if (k < 0.74 && s.store) { const i = int(s.inv.length); if (s.inv[i]) L.storeIn(s, i); }
    else if (k < 0.77 && s.store) { const j = int(s.store.length); if (s.store[j]) L.storeOut(s, j); }
    else if (k < 0.79) L.moveSlot(s, int(s.inv.length), int(s.inv.length));
    else if (k < 0.85) { // a field tile: till, plant, a sprinkler
      const idx = (8 + int(30)) * C.FARM_W + 8 + int(40);
      L.till(s, idx);
      if (rnd() < 0.5 && seeds.length) { const id = pick(seeds); L.addItem(s, id, 1); const i = slotOf(id); if (i >= 0) L.plant(s, idx, i); }
      else if (sprinklers.length) { const id = pick(sprinklers); L.addItem(s, id, 1); const i = slotOf(id); if (i >= 0) L.placeSprinkler(s, idx, i); }
    }
    else if (k < 0.87) { const idx = Object.keys(s.soil)[int(Object.keys(s.soil).length)]; if (idx != null && L.pickUpSprinkler) L.pickUpSprinkler(s, Number(idx)); }
    else if (k < 0.9) L.buyAnimal(s, pick(kinds)); // (the game's own buying: only when there is room)
    else if (k < 0.94) { const id = pick(items); s.basket[id] = Math.min(999, (s.basket[id] || 0) + 1 + int(5)); }
    else if (k < 0.96 && L.takeBasket) L.takeBasket(s);
    else s.gold += int(2000) - 1000;
    if (a % every === 0) {
      const back = roundTrip(s), d = differences(s, back);
      if (d.length) return { seed, step: a, d };
      s = back; // play on with the farm as it loaded, as a player reopening the game does
    }
  }
  return { seed, step: steps, d: [] };
};

test('saving and loading 2,000 random actions on 12 farms gives back exactly the same farm, every time', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const r = play(seed * 7919, 2000, 40);
    assert.deepStrictEqual(r.d, [], 'farm ' + seed + ', after action ' + r.step + ':\n' + r.d.join('\n'));
  }
});

test('the stress test catches a save that leaves something out', () => {
  const runs = L.yardRuns;
  L.yardRuns = (items) => runs(items).slice(4); // (a bug: the first line of fences or paths is not written)
  try {
    let caught = false;
    for (let seed = 1; seed <= 12 && !caught; seed++) caught = play(seed * 7919, 2000, 40).d.length > 0;
    assert.ok(caught, 'the broken save was caught');
  } finally { L.yardRuns = runs; }
});
