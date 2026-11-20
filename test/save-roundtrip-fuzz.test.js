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
  const furnKinds = H.types.map((t, i) => i).filter((i) => H.types[i].key !== 'trophy_city_order'); // (the plaque, 18 Nov: the stream plays as before)
  const items = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].kind !== 'tool' && !C.ITEMS[k].sea); // (the sea's: their own stream, below)
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
  // the horse cart and the Grand Market (18 Nov 2026), on a random stream of their own (so the actions above play as
  // they always did): make it, load it (the Silo, the bag), unload, send Mang Kardo (and he comes back), sell, deliver;
  // and the horse's stamina (a hit while riding, coming back over time: its last count saved in 'hs')
  let r2 = seed ^ 0x5bd1e995;
  const crnd = () => { r2 = (r2 * 1103515245 + 12345) & 0x7fffffff; return r2 / 0x7fffffff; };
  const cint = (n) => Math.floor(crnd() * n), cpick = (xs) => xs[cint(xs.length)];
  const farmCrops = L.gmCrops ? L.gmCrops() : [];
  const cart = () => {
    const c = cint(8), crop = cpick(farmCrops);
    if (c === 0) {
      if (!s.horse) s.horse = { name: 'Chestnut', love: 0, pet: 0 };
      s.gold += 20000; s.lumber = (s.lumber || 0) + 60; L.addItem(s, 'ore_copper', 10); L.addItem(s, 'farm_cement', 3);
      L.gmMakeCart(s);
    } else if (c === 1) {
      if (crnd() < 0.5) { L.siloPut(s, crop, 1 + cint(80)); L.gmLoadSilo(s, crop, 1 + cint(80)); }
      else {
        const q = cint(3), n = 1 + cint(60);
        if (q) L.addItemQ(s, crop, n, q); else L.addItem(s, crop, n);
        const i = s.inv.findIndex((x) => x && x.id === crop && (x.q || 0) === q);
        if (i >= 0) L.gmLoadBag(s, i, 1 + cint(60));
      }
    } else if (c === 2) { const ks = Object.keys(s.gm.cargo); if (ks.length) L.gmUnload(s, cpick(ks), 1 + cint(60)); }
    else if (c === 3) {
      const cs = L.gmContracts(s), ct = crnd() < 0.5 && cs.length ? cpick(cs) : null;
      if (ct) { L.siloPut(s, ct.crop, 100); L.gmLoadSilo(s, ct.crop, 100); }
      L.gmSend(s, ct ? ct.k : 'sell', L.nowMin() - cint(40));
    }
    else if (c === 4) L.gmFinish(s, L.nowMin());
    else if (c === 5) { const ks = L.gmCargoCrops(s); if (ks.length) L.gmSell(s, cpick(ks), s.day); }
    else if (c === 6) { const cs = L.gmContracts(s), ct = cs.length && cpick(cs); if (ct) { L.siloPut(s, ct.crop, 100); L.gmLoadSilo(s, ct.crop, 100); L.gmDeliver(s, ct.k); } }
    else if (s.horse && L.horseHit) { if (crnd() < 0.5) L.horseHit(s); else L.horseRegen(s, L.nowMin() + cint(300)); } // (the horse: hit while riding, its stamina coming back)
  };
  // Manila Friends (18 Nov 2026), on a random stream of their own as well: a chat, a gift (a dislike too, so the hearts
  // fall below an unlock reached), their story steps (a scene, a favour asked and handed over), a new day, and each
  // unlock used (the blessing, studying with Bea, the free meal, the weekly trade, the train, ammo). Aling Rosa's 4th
  // contract and Mang Kardo's lower fee come in through the cart's actions above once their hearts are there.
  let r3 = seed ^ 0x2545f491;
  const mrnd = () => { r3 = (r3 * 1103515245 + 12345) & 0x7fffffff; return r3 / 0x7fffffff; };
  const mint = (n) => Math.floor(mrnd() * n), mpick = (xs) => xs[mint(xs.length)];
  const MF = C.MNF, mnKeys = MF ? MF.order : [];
  const manila = () => {
    const k = mpick(mnKeys), d = MF.friends[k], c = mint(9);
    if (c === 0) L.talk(s, k);
    else if (c === 1 || c === 2) {
      const id = c === 2 ? mpick(d.dislikes) : mpick(d.loves.concat(d.likes, ['turnip', 'egg']));
      L.addItem(s, id, 1);
      const i = s.inv.findIndex((x) => x && x.id === id && !x.q);
      if (i >= 0) L.giveGift(s, k, i);
    } else if (c === 3) { // a story step: the hearts for it, then the scene (or the favour handed over)
      const n = L.mnsNext(s, k);
      if (!n) return;
      L.friend(s, k).met = 1;
      if (L.mnHearts(s, k) < n.hearts) L.addFriend(s, k, n.hearts * 10 - L.friend(s, k).pts);
      s.energy = Math.max(s.energy, 30);
      if (n.state === 'asked') { L.addItem(s, n.step.bring[0], n.step.bring[1]); L.mnsHandOver(s, k); } else L.mnsStart(s, k, n.i, mint(2));
    } else if (c === 4) L.mnNewDay(s);
    else if (c === 5) { L.friend(s, k).met = 1; L.addFriend(s, k, 10 + mint(40)); } // (hearts from chats and gifts over many days)
    else if (c === 6) { s.energy = mint(30); if (mrnd() < 0.5) L.mnBless(s); else L.mnFreeMeal(s); }
    else if (c === 7) { if (mrnd() < 0.5) L.mnStudy(s, mpick(C.SKILLS.order)); else { const o = L.mnTradeOffer(s); L.addItem(s, o.give, o.n); L.mnTrade(s); } }
    else if (mrnd() < 0.5) L.manilaRide(s); else L.buyAmmo(s, mpick(['bullets', 'javelins']), 1 + mint(3));
  };
  // Mang Danny's Trading Post and the Talipapa (18 Nov 2026), on a random stream of their own too: buying (a full bag
  // fills the basket), selling to Mang Danny, a tour seen (a new day's full shelves: manila-trade.test.js)
  let r4 = seed ^ 0x1b873593;
  const trnd = () => { r4 = (r4 * 1103515245 + 12345) & 0x7fffffff; return r4 / 0x7fffffff; };
  const tint = (n) => Math.floor(trnd() * n), tpick = (xs) => xs[tint(xs.length)];
  const shops = C.MNTRADE ? Object.keys(C.MNTRADE.shops) : [];
  const trade = () => {
    const shop = tpick(shops), id = tpick(L.txItems(shop)), c = tint(5);
    if (c < 3) L.txBuy(s, shop, id, 1 + tint(12));
    else if (c === 3) { const d = tpick(L.txItems('danny')); if (trnd() < 0.5) L.addItem(s, d, 1 + tint(9)); L.txSell(s, d, 1 + tint(12)); }
    else L.txTourTake(s, tpick(C.MNTRADE.tours));
  };
  // the Manila Cup's tries and Race Day's bets (18 Nov 2026), on a random stream of their own too: a try (with a horse that
  // may race, lent for the try only), a ride finished, its best sent, a bet, bets paid by the clock, a week's prize, the
  // 3-runs reward, a tour seen; at times up to three weeks on (the cup's week and the day's bet limit roll over)
  let r5 = seed ^ 0x2c1b3c6d;
  const qrnd = () => { r5 = (r5 * 1103515245 + 12345) & 0x7fffffff; return r5 / 0x7fffffff; };
  const qint = (n) => Math.floor(qrnd() * n);
  const hex = (n) => { let h = ''; for (let i = 0; i < n; i++) h += '0123456789abcdef'[qint(16)]; return h; };
  const cup = () => {
    const c = qint(8), at = clock.ms + qint(21) * 864e5 + qint(1440) * 6e4;
    if (c === 0) { const h = s.horse; s.horse = { name: 'Cup', love: 60, pet: 0, g: 1 }; L.mcBeginTry(s, at); s.horse = h; }
    else if (c === 1) L.mcFinish(s, { done: true, laps: [9000 + qint(4000), 9000 + qint(4000), 9000 + qint(4000)], knocks: qint(6) }, at);
    else if (c === 2) { const q = L.mcToSend(s); if (q) L.mcSent(s, q.id, qrnd() < 0.7); }
    else if (c === 3) { const n = L.rdNext(at); L.rdBet(s, n, qint(6), 100 * (1 + qint(500)), at); }
    else if (c === 4) L.rdSettle(s, at + qint(90) * 6e4);
    else if (c === 5) L.mcPrizePay(s, { ok: true, id: hex(8) + '-' + hex(4) + '-4' + hex(3) + '-8' + hex(3) + '-' + hex(12), rank: 1 + qint(12), ms: 30000 + qint(9000) });
    else if (c === 6) L.mcWeekly(s, at);
    else L.mcTourTake(s, qrnd() < 0.5 ? 'cup' : 'race');
  };
  // the trucks and the City Order (18 Nov 2026), on a random stream of their own: making one (the Market Stars it needs),
  // switching (a load bigger than the new one leaves some parked), loading, unloading a parked one, a City Order delivery
  // started and answered (taken in part, "not there", refused, or no answer yet: it waits in the save), Mang Kardo taking
  // it, and the week's prizes
  let r6 = seed ^ 0x68e31da4;
  const vrnd = () => { r6 = (r6 * 1103515245 + 12345) & 0x7fffffff; return r6 / 0x7fffffff; };
  const vint = (n) => Math.floor(vrnd() * n), vpick = (xs) => xs[vint(xs.length)];
  const vhex = () => { let h = ''; for (let i = 0; i < 32; i++) h += vint(16).toString(16); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32); };
  const TRK = C.TRUCKS;
  const trucks = () => {
    const c = vint(9), i = 1 + vint(3), crop = vpick(farmCrops), wk = L.coWeek(L.clock()).day;
    if (c === 0) {
      const R = TRK.list[i];
      s.gm.ms = Math.max(s.gm.ms, R.stars); s.gold += R.gold; s.lumber = (s.lumber || 0) + R.lumber;
      R.needs.forEach((n) => L.addItem(s, n[0], n[1]));
      L.trkMake(s, i);
    } else if (c === 1) L.trkSwitch(s, vint(4));
    else if (c === 2) { L.siloPut(s, crop, 1 + vint(400)); L.gmLoadSilo(s, crop, 1 + vint(400)); }
    else if (c === 3) L.trkUnloadParked(s, vint(4));
    else if (c === 4) { const ks = L.gmCargoCrops(s); if (ks.length) L.coBegin(s, vpick(ks), 1 + vint(300), vrnd() < 0.3 ? 'k' : 's', vhex(), wk); }
    else if (c === 5 || c === 6) {
      const k = vint(5);
      L.coAnswer(s, k === 0 ? 'missing' : k === 1 ? { ok: false, code: 'done' } : k === 2 ? null : { ok: true, took: vint(250), done: vrnd() < 0.2 }, L.nowMin() - vint(40));
    } else if (c === 7) L.coPay(s, [{ day: wk - 7 * vint(3), stars: 3, plaque: vrnd() < 0.3 }]);
    else L.gmFinish(s, L.nowMin());
  };
  // Bram's farm machines (18 Nov 2026), on a random stream of their own too: one made, the Tractor's pass (a 3x3 or a row
  // of 9: debris cleared, soil tilled), the Seeder's, the Harvester's (into the Silo, the bag, the basket), one put away in
  // Storage, a made one taken back at the Forge
  let r7 = seed ^ 0x5bd1e995;
  const xrnd = () => { r7 = (r7 * 1103515245 + 12345) & 0x7fffffff; return r7 / 0x7fffffff; };
  const xint = (n) => Math.floor(xrnd() * n), xpick = (xs) => xs[xint(xs.length)];
  const MK = C.MACHINE_KINDS || [];
  const machines = () => {
    const c = xint(6), d = xpick([[0, 1], [0, -1], [1, 0], [-1, 0]]), k = xpick(MK);
    const tiles = L.mkTiles(8 + xint(40), 8 + xint(28), d[0], d[1], xrnd() < 0.3).map((p) => p[1] * C.FARM_W + p[0]);
    if (c === 0) { s.gold += C.MACHINES[k].gold; s.lumber = (s.lumber || 0) + C.MACHINES[k].lumber; C.MACHINES[k].needs.forEach((n) => L.addItem(s, n[0], n[1])); L.mkMake(s, k); }
    else if (c === 1) { s.energy = Math.max(s.energy, 40); L.mkTill(s, tiles.map((idx) => ({ idx, clear: s.debris[idx] || null, till: 1 }))); }
    else if (c === 2) { const id = xpick(seeds); L.addItem(s, id, 1); L.mkPlant(s, tiles, L.mkSeedSlot(s, id)); }
    else if (c === 3) {
      tiles.forEach((i) => { const t = s.soil[i]; if (t && t.c && !C.CROPS[t.c].sickle) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1 - xint(30); } });
      L.mkHarvest(s, tiles);
    }
    else if (c === 4) { const i = s.inv.findIndex((x) => x && x.id === k); if (i >= 0 && s.store) L.storeIn(s, i); }
    else L.mkBack(s, k);
  };
  // driving them (20 Nov 2026), on a random stream of its own: a strip at a time along a row (the Tractor's energy paid as it
  // goes, the Seeder's packet, the Harvester's tank), unloading at the Silo (a Silo with no room too)
  let r8 = seed ^ 0x2545f491;
  const yrnd = () => { r8 = (r8 * 1103515245 + 12345) & 0x7fffffff; return r8 / 0x7fffffff; };
  const yint = (n) => Math.floor(yrnd() * n), ypick = (xs) => xs[yint(xs.length)];
  const due = { c: 0 };
  const driving = () => {
    const c = yint(4), d = ypick([[0, 1], [0, -1], [1, 0], [-1, 0]]), n = 1 + yint(8);
    let x = 8 + yint(40), y = 8 + yint(28);
    for (let j = 0; j < n; j++, x += d[0], y += d[1]) {
      const tiles = L.mkStrip(x, y, d[0], d[1]).map((p) => p[1] * C.FARM_W + p[0]);
      if (c === 0) { s.energy = Math.max(s.energy, 20); L.mkTill(s, tiles.map((idx) => ({ idx, clear: s.debris[idx] || null, till: 1 })), due); }
      else if (c === 1) { const id = ypick(seeds); L.addItem(s, id, 1); L.mkPlant(s, tiles, L.mkSeedSlot(s, id)); }
      else if (c === 2) tiles.forEach((i) => { const t = s.soil[i]; if (t && t.c && !C.CROPS[t.c].sickle) { t.w = 1; t.p = L.nowMin() - C.CROPS[t.c].mins - 1; } L.mkTankPick(s, i); });
    }
    if (c === 3) L.mkUnload(s);
  };
  // Sea trips (18 Nov 2026), on a random stream of their own too: a ticket (Kapitana Marisol's free one as well), sea fish
  // landed (weighed: the sea's fish book), a snag, a clump scooped, the Marlin lost or landed, her task handed in, a friend
  // aboard, the trip's end (the crate's Capiz Shells, into the bag or the basket); a sea fish or a dish now and then
  let r9 = seed ^ 0x7feb352d;
  const zrnd = () => { r9 = (r9 * 1103515245 + 12345) & 0x7fffffff; return r9 / 0x7fffffff; };
  const zint = (n) => Math.floor(zrnd() * n);
  const SEA = C.SEA;
  const seaItems = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].sea);
  const sea = () => {
    const c = zint(10);
    if (c === 0) { if (zrnd() < 0.3) L.friend(s, 'mn_marisol').pts = 80; if (!L.hasRod(s)) L.addItem(s, 'rod', 1); s.gold += SEA.ticket; L.seaStart(s, clock.ms - zint(600000), zrnd() < 0.5, zrnd); }
    else if (c === 1) L.landFish(s, SEA.ids[zint(6)], zrnd);
    else if (c === 2) L.landFish(s, 'seaweed');
    else if (c === 3) L.seaScoop(s);
    else if (c === 4) { if (zrnd() < 0.5) L.seaMarlinLost(s, clock.ms - zint(60000)); else L.landFish(s, 'marlin', zrnd); }
    else if (c === 5) { const t = L.seaTaskNow(s); if (t.kind === 'bring') L.addItem(s, t.id, t.n); else s.sea.tk = 1; L.seaTaskDo(s); }
    else if (c === 6) L.seaFriend(s, 'a1b2c3d4-0000-4000-8000-0000000000' + String(zint(40)).padStart(2, '0'), 'Friend ' + zint(9), s.day + zint(3));
    else if (c === 7) L.addItem(s, seaItems[zint(seaItems.length)], 1 + zint(5));
    else L.seaEnd(s, clock.ms);
    delete s.lastFish; // (the last catch's weight on screen: never saved, as the river's)
  };
  for (let a = 1; a <= steps; a++) {
    if (SEA && zrnd() < 0.1) sea();
    if (L.gmMakeCart && crnd() < 0.12) cart();
    if (L.mkStrip && yrnd() < 0.1) driving();
    if (TRK && vrnd() < 0.1) trucks();
    if (MF && mrnd() < 0.1) manila();
    if (shops.length && trnd() < 0.1) trade();
    if (L.mcBeginTry && qrnd() < 0.1) cup();
    if (MK.length && xrnd() < 0.1) machines();
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
