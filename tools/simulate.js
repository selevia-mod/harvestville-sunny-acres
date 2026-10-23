'use strict';
// Plays the game's real rules (src/00-*, src/01-*) for a year with a sensible, energy-limited strategy and
// prints how money and progress grow. Used to balance prices, growth times and energy costs.
// Run: node tools/simulate.js [days] [--quiet]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console, Math };
vm.createContext(ctx);
const SRC = path.join(__dirname, '..', 'src');
fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;

const DAYS = Number(process.argv[2]) || 112;
const QUIET = process.argv.includes('--quiet');
const FIELD = Array.from({ length: 224 }, (_, i) => i); // the farm's tillable field, as plain indexes here
const rng = (() => { let a = 99; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();

const s = L.newState({ fieldTiles: FIELD });
s.seed = 4242;
const log = [];
const note = (msg) => log.push('day ' + s.day + ' (' + L.formatDate(s.day) + '): ' + msg);
const milestones = {};
const once = (key, msg) => { if (!milestones[key]) { milestones[key] = s.day; note(msg); } };

function spend(n) { return L.spendEnergy(s, n); }
function slot(id) { return s.inv.findIndex((x) => x && x.id === id); }

// The best seed to plant today: most money per tile per day, if it can ripen before the season ends.
function bestSeed() {
  const d = L.date(s.day), left = C.DAYS_PER_SEASON - d.day;
  let best = null, bestValue = 0;
  L.seedsInSeason(s.day).forEach((id) => {
    const item = C.ITEMS[id], crop = C.CROPS[item.crop];
    if (crop.sickle || crop.days > left) return;
    const harvests = crop.regrow ? 1 + Math.floor((left - crop.days) / crop.regrow) : 1;
    const value = (C.ITEMS[crop.item].sell * harvests * 9 - item.price) / Math.max(crop.days, left);
    if (value > bestValue) { bestValue = value; best = id; }
  });
  return best;
}

function day() {
  const weather = L.weather(s, s.day);
  // animals: collect, feed, pet
  s.animals.forEach((a, i) => {
    if (a.ready) { const got = L.collect(s, i); if (got[0] !== '!') L.ship(s, slot(got)); }
    const feed = C.ANIMALS[a.kind].feed;
    if (!a.young && !L.hasItem(s, feed)) L.buy(s, feed, 5);
    if (!a.young) L.feedAnimal(s, i, slot(feed));
    L.petAnimal(s, i);
    if (L.hasItem(s, 'brush')) L.brushAnimal(s, i);
  });
  // harvest everything ripe and ship it
  Object.keys(s.soil).forEach((k) => {
    const t = s.soil[k];
    if (L.isRipe(t) && !C.CROPS[t.c].sickle) L.harvest(s, Number(k));
  });
  ['turnip', 'potato', 'strawberry', 'tomato', 'corn', 'carrot', 'pumpkin', 'herb', 'berry', 'mushroom', 'root', 'ore_copper', 'gem', 'fish_s', 'fish_m', 'fish_l', 'fish_k']
    .forEach((id) => { while (slot(id) >= 0) L.ship(s, slot(id)); });
  // forage on the farm (3 a day)
  for (let i = 0; i < C.FORAGE_COUNT.farm; i++) L.takeForage(s, 'farm', 1000 + i);
  // water what is growing (rain does it for free)
  const growing = Object.keys(s.soil).filter((k) => s.soil[k].c && !L.isRipe(s.soil[k]));
  if (!C.WEATHER[weather].waters) {
    growing.forEach((k) => {
      if (s.soil[k].w) return;
      if (s.water <= 0) L.refill(s);
      if (spend(L.toolEnergy(s, 'can', 1))) L.water(s, Number(k));
    });
  }
  // plant: fill empty tilled tiles, till more cleared field, clear debris when needed
  const seed = bestSeed();
  let empty = Object.keys(s.soil).filter((k) => !s.soil[k].c).map(Number);
  while (seed && s.energy > 30) {
    if (empty.length < 9) {
      const free = FIELD.filter((i) => !s.soil[i] && !s.debris[i]).slice(0, 9 - empty.length);
      if (free.length) {
        let tilled = 0;
        free.forEach((i) => { if (s.energy > 30 && spend(L.toolEnergy(s, 'hoe', 1))) { L.till(s, i); tilled++; } });
        empty = Object.keys(s.soil).filter((k) => !s.soil[k].c).map(Number);
        if (!tilled) break;
        continue;
      }
      // clear some debris (weeds, branches, stones; stumps and boulders when the tools allow)
      const deb = FIELD.find((i) => s.debris[i] && L.debrisHits(s, s.debris[i], C.DEBRIS[s.debris[i]].tool) > 0);
      if (deb == null) break;
      const k = s.debris[deb], tool = C.DEBRIS[k].tool, hits = L.debrisHits(s, k, tool);
      if (!spend(L.toolEnergy(s, tool, 1) * hits)) break;
      L.clearDebris(s, deb);
      continue;
    }
    if (s.gold < C.ITEMS[seed].price) break;
    L.buy(s, seed, 1);
    const n = L.plantBag(s, empty.slice(0, 9), slot(seed));
    if (typeof n !== 'number') break;
    const planted = empty.slice(0, 9);
    if (!C.WEATHER[weather].waters) planted.forEach((i) => { if (s.water <= 0) L.refill(s); if (spend(L.toolEnergy(s, 'can', 1))) L.water(s, i); });
    empty = empty.slice(9);
  }
  // spare energy on rainy days (or when nothing to plant): the mine
  if (s.energy > 25 && (C.WEATHER[weather].waters || !seed || L.date(s.day).key === 'winter')) {
    let floor = 1;
    while (s.energy > 12) {
      const cost = L.mineEnergy(s, floor);
      if (!spend(cost)) break;
      const drop = L.mineDrop(floor, rng());
      if (drop === 'stone') s.stone++;
      else if (drop) L.addItem(s, drop, 1);
      if (rng() < 0.12) { floor++; L.reachFloor(s, floor); if (L.hasChest(floor)) L.openChest(s, floor); }
    }
  }
  // purchases, in a sensible order
  if (!L.hasItem(s, 'brush') && s.gold > 400) { L.buy(s, 'brush', 1); }
  if (L.space(s, 'chicken') > 0 && s.gold > 900 && L.animalCount(s, 'chicken') < 4) { L.buyAnimal(s, 'chicken'); once('chicken2', 'bought a second chicken'); }
  if (!L.hasItem(s, 'milker') && s.gold > 1500) L.buy(s, 'milker', 1);
  if (L.hasItem(s, 'milker') && L.space(s, 'cow') > 0 && s.gold > 1500) { const r = L.buyAnimal(s, 'cow'); if (typeof r === 'number') once('cow', 'bought the first cow'); }
  C.TOOL_KEYS.forEach((t) => { if (L.upgradeTool(s, t) === 'ok') note('upgraded the ' + t + ' to ' + C.TOOL_LEVELS[s.tools[t]]); });
  ['kitchen', 'bighouse', 'stable', 'barn2', 'coop2'].forEach((b) => {
    if (!s.builds[b] && !s.project) {
      const def = C.BUILDS[b];
      if (s.lumber < def.lumber && s.gold > def.gold + C.LUMBER_PRICE * (def.lumber - s.lumber) + 1500) L.buyMaterial(s, 'lumber', def.lumber - s.lumber);
      if (s.stone < def.stone && s.gold > def.gold + 1500) L.buyMaterial(s, 'stone', def.stone - s.stone);
      if (L.startBuild(s, b) === 'ok') note('started the ' + def.name);
    }
  });
  // sleep
  const r = L.endDay(s, false, { fieldTiles: FIELD });
  if (r.built) once('b_' + r.built, C.BUILDS[r.built].name + ' finished');
  return r;
}

console.log('Simulating ' + DAYS + ' days with the real rules...\n');
console.log('day  date        gold   earned/day  planted  animals  tools        lumber stone');
const rows = [];
let week = 0;
for (let d = 0; d < DAYS; d++) {
  const r = day();
  week += r.earned;
  if (s.day % 7 === 1) {
    const planted = Object.values(s.soil).filter((t) => t.c).length;
    const row = String(s.day - 1).padEnd(5) + L.formatDate(s.day - 1).padEnd(12) + String(s.gold).padStart(6) + String(Math.round(week / 7)).padStart(11) +
      String(planted).padStart(10) + String(s.animals.length).padStart(9) + '  ' + C.TOOL_KEYS.map((t) => s.tools[t]).join('') + '        ' +
      String(s.lumber).padStart(5) + String(s.stone).padStart(6);
    rows.push(row);
    console.log(row);
    week = 0;
  }
}
console.log('\nTotal shipped: ' + s.stats.earned + 'G, deepest mine floor ' + s.stats.deepest);
if (!QUIET) {
  console.log('\nMilestones:');
  log.forEach((l) => console.log('  ' + l));
}
