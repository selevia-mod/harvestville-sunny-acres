// Unit tests for Willowbrook Station (src/00-zzzzzzz-town.js, src/01-logicz-town.js; the map: tools/town-station.js):
// the trains by the clock, cargo orders (crates from every part of the game, a deadline, the prize), visitors and their
// wishes, the Town Level and what it unlocks (the bigger stall, the kiosk, the Collector), the save, and the town map.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const TW = C.TW;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const DAY0 = L.dayOf(new Date(2026, 3, 1, 12).getTime()); // Wednesday 1 April 2026
const at = (s, h, m = 0, d = 0) => { s.day = DAY0 + d; s.time = h * 60 + m; return s; };
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; s.inv = s.inv.map(() => null); s.day = DAY0; return s; };
const give = (s, id, n) => { L.addItem(s, id, n); };
const levelTo = (s, lv) => { s.tw.p = TW.levels[lv - 1].at; };
// a farm that has a bit of everything: animals, a rod, a workshop, the mine, a hunt
const rich = () => {
  const s = fresh();
  L.addItem(s, 'rod', 1);
  s.stats.deepest = 12;
  s.wild.by.deer = 3;
  s.wild.by.boar = 1;
  s.yard.items.push({ t: C.OUTDOOR.index.dairy, x: 20, y: 20 });
  L.discover(s, 'cheese');
  L.discover(s, 'butter');
  return s;
};

test('four trains a day by the phone\'s clock, two hours each; the next one after the last is tomorrow at 7', () => {
  const s = fresh();
  assert.strictEqual(L.twTrain(at(s, 6, 59)), null);
  const t7 = L.twTrain(at(s, 7, 0));
  assert.deepStrictEqual([t7.slot, t7.leave - t7.arrive], [0, 120]);
  assert.strictEqual(L.twTrain(at(s, 8, 59)).tn, t7.tn);
  assert.strictEqual(L.twTrain(at(s, 9, 0)), null);
  assert.deepStrictEqual([11, 15, 19].map((h) => L.twTrain(at(s, h, 30)).slot), [1, 2, 3]);
  assert.strictEqual(L.twTrain(at(s, 21, 0)), null);
  const next = L.twNextTrain(L.twNow(at(s, 21, 30)));
  assert.strictEqual(next.arrive, (DAY0 + 1) * 1440 + 7 * 60, 'tomorrow at 7 AM');
  assert.strictEqual(next.tn, t7.tn + 4);
  assert.strictEqual(L.twNextTrain(L.twNow(at(s, 7, 0))).slot, 1, 'from inside a train: the next one');
});

test('the first cargo order waits from the start; later ones come with a train when there is none', () => {
  const s = at(fresh(), 10, 0);
  const ev = L.twTick(s);
  assert.ok(ev.order && !ev.arrived, 'an order now, no train');
  const o = s.tw.o;
  assert.strictEqual(o.crates.length, 4);
  assert.strictEqual(new Set(o.crates.map((c) => c.id)).size, 4, 'four different goods');
  assert.strictEqual(o.due - o.at, 24 * 60, 'a day to fill 4 crates');
  assert.deepStrictEqual(plain(L.twTick(s)), {}, 'nothing more until a train');
  // a train with an order still open brings visitors only
  const ev2 = L.twTick(at(s, 11, 1));
  assert.ok(ev2.arrived && !ev2.order);
  assert.strictEqual(s.tw.o.no, 0);
});

test('crates want goods from different parts of the game, and are worth more than a request', () => {
  const s = rich();
  levelTo(s, 6);
  const pools = L.twPools(s);
  Object.keys(TW.kinds).forEach((k) => assert.ok(pools[k].length, k + ' has goods'));
  assert.ok(pools.workshop.indexOf('cheese') >= 0 && pools.workshop.indexOf('cream') < 0, 'only goods you have made');
  assert.ok(pools.hunt.indexOf('venison') >= 0 && pools.hunt.indexOf('tusk') >= 0 && pools.hunt.indexOf('pelt_wolf') < 0, 'only what you have hunted');
  const o = L.twMakeOrder(at(s, 11), L.twNow(s));
  assert.strictEqual(o.crates.length, 6);
  assert.strictEqual(new Set(o.crates.map((c) => c.k)).size, 6, 'six crates, six kinds of goods');
  assert.strictEqual(o.due - o.at, 48 * 60, 'two days for 6');
  o.crates.forEach((c) => {
    assert.ok(c.n >= 1 && c.n <= TW.most[c.k], c.id);
    assert.ok(c.pay > 0 && c.pay < C.ITEMS[c.id].sell * c.n, c.id + ' pays a little');
  });
  const value = o.crates.reduce((sum, c) => sum + C.ITEMS[c.id].sell * c.n, 0);
  assert.ok(value > 1500, 'a big order: ' + value + 'G of goods');
  assert.ok(o.prize.gold >= value && o.prize.stars === 2 && o.prize.item, 'the prize: more gold than the goods, 2 Sunbeams at level 6, an item');
  // a new farm only has crops, animals and forage: still four crates
  const t = fresh();
  const o2 = L.twMakeOrder(at(t, 11), L.twNow(t));
  assert.strictEqual(o2.crates.length, 4);
  o2.crates.forEach((c) => assert.ok(['crops', 'farm', 'forage'].indexOf(c.k) >= 0, c.k));
});

test('filling crates one by one pays a little each; the last one pays the prize, once', () => {
  const s = at(fresh(), 10);
  L.twTick(s);
  const o = s.tw.o, gold0 = s.gold, stars0 = s.stars;
  assert.strictEqual(L.twFill(s, 0), 'missing');
  give(s, o.crates[0].id, o.crates[0].n);
  const r = L.twFill(s, 0);
  assert.deepStrictEqual([r.pay, r.pts, r.prize], [o.crates[0].pay, TW.points.crate, null]);
  assert.strictEqual(s.gold, gold0 + o.crates[0].pay);
  assert.strictEqual(L.countItem(s, o.crates[0].id), 0);
  assert.strictEqual(L.twFill(s, 0), 'done');
  assert.strictEqual(L.twFill(s, 9), 'none');
  [1, 2, 3].forEach((i) => give(s, o.crates[i].id, o.crates[i].n));
  [1, 2].forEach((i) => assert.strictEqual(typeof L.twFill(s, i), 'object'));
  const pays = o.crates.reduce((sum, c) => sum + c.pay, 0);
  const last = L.twFill(s, 3);
  assert.ok(last.prize, 'the prize');
  assert.strictEqual(last.pts, TW.points.crate + TW.points.cargo);
  assert.strictEqual(s.gold, gold0 + pays + o.prize.gold + s.tw.up.gift, 'every crate, the prize, and the new level\'s gift');
  assert.strictEqual(s.stars, stars0 + o.prize.stars);
  assert.strictEqual(L.countItem(s, o.prize.item), o.prize.n);
  assert.strictEqual(s.tw.done, 1);
  assert.strictEqual(s.tw.p, 4 * TW.points.crate + TW.points.cargo);
  assert.strictEqual(L.twFill(s, 3), 'none', 'a full order takes no more');
});

test('no room for the prize: the last crate waits until there is', () => {
  const s = at(fresh(), 10);
  L.twTick(s);
  const o = s.tw.o;
  o.crates.forEach((c, i) => { if (i) c.done = 1; });
  give(s, o.crates[0].id, o.crates[0].n);
  s.inv = s.inv.map((x) => x || { id: 'stone', n: 999 }); // a full bag
  assert.strictEqual(L.twFill(s, 0), 'full');
  assert.strictEqual(o.crates[0].done, 0);
});

test('time runs out: what was filled went, the rest is gone; the next train brings a new order', () => {
  const s = at(fresh(), 10);
  L.twTick(s);
  const o = s.tw.o;
  give(s, o.crates[0].id, o.crates[0].n);
  L.twFill(s, 0);
  assert.strictEqual(L.twLeft(s), 24 * 60);
  const ev = L.twTick(at(s, 10, 0, 1));
  assert.deepStrictEqual(plain(ev.expired), { filled: 1, of: 4 });
  assert.strictEqual(s.tw.o, null);
  const ev2 = L.twTick(at(s, 11, 0, 1));
  assert.ok(ev2.arrived && ev2.order);
  assert.strictEqual(s.tw.o.no, 1);
  assert.ok(s.tw.o.crates.every((c) => !c.done));
});

test('a full order waits for the next train, which takes it and brings the next', () => {
  const s = at(fresh(), 10);
  L.twTick(s);
  s.tw.o.full = 1;
  assert.deepStrictEqual(plain(L.twTick(at(s, 10, 30))), {});
  const ev = L.twTick(at(s, 11, 0));
  assert.ok(ev.collected && ev.order);
  assert.strictEqual(s.tw.o.full, 0);
  // a full order is never "out of time"
  s.tw.o.full = 1;
  assert.ok(!L.twTick(at(s, 12, 0, 3)).expired);
});

test('visitors: 2 a train, then 3 and 4 with the Town Level; each wishes for something different, and pays well', () => {
  const s = at(rich(), 11, 0);
  L.twTick(s);
  let w = L.twWishes(s);
  assert.strictEqual(w.length, 2);
  assert.ok(w.every((x) => x.who >= 0 && x.gold > C.ITEMS[x.id].sell * x.n && !x.stars));
  levelTo(s, 3);
  L.twTick(at(s, 15, 0));
  assert.strictEqual(L.twWishes(s).length, 3);
  levelTo(s, 7);
  L.twTick(at(s, 19, 0));
  w = L.twWishes(s).filter((x) => x.who >= 0);
  assert.strictEqual(w.length, 4);
  assert.strictEqual(new Set(w.map((x) => x.id)).size, 4, 'four different things');
  assert.strictEqual(new Set(w.map((x) => x.who)).size, 4, 'four different people');
});

test('no visitors on festival days: the town is at the festival', () => {
  const s = fresh();
  s.day = L.dayOf(new Date(2026, 3, 14, 12).getTime()); // the Flower Festival, 14 April
  s.time = 11 * 60;
  L.twTick(s);
  assert.ok(L.twTrain(s), 'the train still runs');
  assert.deepStrictEqual(plain(L.twWishes(s)), []);
});

test('helping a visitor pays and gives Town points; they leave with the train', () => {
  const s = at(fresh(), 11, 0);
  L.twTick(s);
  const w = L.twWishes(s)[0], gold0 = s.gold;
  assert.strictEqual(L.twHelp(s, 0), 'missing');
  give(s, w.id, w.n);
  const r = L.twHelp(s, 0);
  assert.deepStrictEqual([r.gold, r.pts], [w.gold, TW.points.wish]);
  assert.strictEqual(s.gold, gold0 + w.gold);
  assert.strictEqual(L.twHelp(s, 0), 'done');
  L.twTick(at(s, 13, 0));
  assert.deepStrictEqual(plain(L.twWishes(s)), []);
  assert.strictEqual(L.twHelp(s, 1), 'gone');
});

test('the Collector (Town Level 5) comes on one train a day, for something rare, and pays a Sunbeam', () => {
  const s = rich();
  const seen = [];
  for (let d = 0; d < 3; d++) {
    [7, 11, 15, 19].forEach((h) => {
      L.twTick(at(s, h, 5, d));
      if (L.twWishes(s).some((x) => x.who < 0)) seen.push([d, h]);
    });
  }
  assert.deepStrictEqual(seen, [], 'not before level 5');
  levelTo(s, 5);
  for (let d = 3; d < 6; d++) {
    const today = [];
    [7, 11, 15, 19].forEach((h) => {
      L.twTick(at(s, h, 5, d));
      const c = L.twWishes(s).filter((x) => x.who < 0)[0];
      if (c) { today.push(h); assert.strictEqual(c.stars, 1); assert.ok(L.twRarePool(s).some((e) => e[0] === c.id), c.id); }
    });
    assert.strictEqual(today.length, 1, 'once on day ' + d);
  }
  assert.deepStrictEqual(plain(L.twRarePool(fresh())), [], 'a new farm has nothing rare: no Collector');
});

test('Town Level: points make levels, each new level pays the town\'s gift and says what it brings', () => {
  const s = fresh();
  assert.strictEqual(L.twLevel(s), 1);
  assert.deepStrictEqual(plain(L.twNextLevel(s)), { level: 2, at: 12, text: TW.levels[1].text, from: 0 });
  assert.strictEqual(TW.levels.length, 8);
  TW.levels.forEach((l, i) => { if (i) assert.ok(l.at > TW.levels[i - 1].at); });
  s.tw.p = 259;
  assert.strictEqual(L.twLevel(s), 7);
  s.tw.p = 260;
  assert.strictEqual(L.twLevel(s), 8);
  assert.strictEqual(L.twNextLevel(s), null);
  // a new level: the town's gift (250G times the level), kept for the game to show
  const t = at(fresh(), 11, 0);
  L.twTick(t);
  const w = L.twWishes(t)[0], g0 = t.gold;
  give(t, w.id, w.n);
  t.tw.p = 28; // 28 + 3 = 31: level 3
  const r = L.twHelp(t, 0);
  assert.strictEqual(r.level, 3);
  assert.deepStrictEqual(plain(t.tw.up), { level: 3, gift: TW.levelGift * 3 });
  assert.strictEqual(t.gold, g0 + w.gold + t.tw.up.gift);
  assert.strictEqual(L.twHelp(t, 1) === 'missing' && t.tw.up.level, 3);
});

test('while a train is in, stall sales count for the town (4 a train); a visitor can be the buyer', () => {
  const s = at(fresh(), 10, 0);
  give(s, 'turnip', 30);
  const sell = (shelf, buyer) => { L.listItem(s, shelf, s.inv.findIndex((x) => x && x.id === 'turnip'), 1, 0); return L.sellLot(s, shelf, buyer); };
  sell(0, null);
  assert.strictEqual(s.tw.p, 0, 'no train');
  L.twTick(at(s, 11, 0));
  for (let k = 0; k < 6; k++) { sell(k, null); L.collectStand(s); }
  assert.strictEqual(s.tw.p, TW.saleMax * TW.points.sale);
  const sale = sell(0, 'tw_foodie');
  assert.strictEqual(sale.who, 'Food blogger');
  assert.ok(C.VILLAGERS[s.shelves[0].buyer], 'the coins still name a villager (the save keeps villagers only)');
});

test('Town Level 2: a bigger stall, 30 on a shelf, and a save keeps them', () => {
  const s = at(fresh(), 10, 0);
  give(s, 'turnip', 60);
  const slot = () => s.inv.findIndex((x) => x && x.id === 'turnip');
  assert.strictEqual(L.listItem(s, 0, slot(), 60, 0), 'ok');
  assert.strictEqual(s.shelves[0].n, 20);
  levelTo(s, 2);
  assert.strictEqual(L.listItem(s, 1, slot(), 60, 0), 'ok');
  assert.strictEqual(s.shelves[1].n, 30);
  assert.strictEqual(C.STAND.perShelf, 20, 'the stall\'s own number is back');
  assert.strictEqual(roundTrip(s).shelves[1].n, 30);
});

test('the kiosk (Town Level 4): a Power-Up and Pet Meals for gold, a few a day', () => {
  const s = at(fresh(), 10, 0);
  assert.deepStrictEqual(plain(L.twKiosk(s)), []);
  assert.strictEqual(L.twBuy(s, 0), 'none');
  levelTo(s, 4);
  s.gold = 5000;
  assert.deepStrictEqual(plain(L.twKiosk(s).map((e) => [e.id, e.gold, e.left])), [['pet_meal', 350, 3], ['power_up', 1500, 1]]);
  assert.strictEqual(L.twBuy(s, 1), 'ok');
  assert.strictEqual(L.twBuy(s, 1), 'soldout');
  assert.strictEqual(s.gold, 3500);
  assert.strictEqual(L.countItem(s, 'power_up'), 1);
  s.gold = 100;
  assert.strictEqual(L.twBuy(s, 0), 'gold');
  assert.strictEqual(roundTrip(s).tw.k[1][1], 1, 'saved');
  at(s, 10, 0, 1);
  assert.strictEqual(L.twKiosk(s)[1].left, 1, 'more the next day');
});

test('the save: everything comes back; old saves and junk start the station afresh', () => {
  const s = at(rich(), 11, 0);
  levelTo(s, 5);
  L.twTick(s);
  give(s, s.tw.o.crates[0].id, s.tw.o.crates[0].n);
  L.twFill(s, 0);
  s.tw.up = null;
  const b = roundTrip(s);
  assert.deepStrictEqual(plain(b.tw), plain(s.tw));
  assert.ok(JSON.stringify(L.serialize(s).tw).length < 500, 'small');
  const old = L.serialize(fresh());
  delete old.tw;
  const o = L.deserialize(JSON.parse(JSON.stringify(old)));
  assert.deepStrictEqual(plain(o.tw), plain(fresh().tw));
  L.twTick(at(o, 10));
  assert.ok(o.tw.o, 'an old farm gets its first order too');
  const junk = L.serialize(fresh());
  junk.tw = [-5, 'x', 99, 1e12, null, [1, 2, 3, 0, 'a', 'b', 'nope', 1, [['nope', 3, 0, 1, 0], ['turnip', 1e9, 99, -4, 1]]], [[9, 'turnip', 2, 50, 7, 0], 'x'], 'k'];
  const j = L.deserialize(JSON.parse(JSON.stringify(junk))).tw;
  assert.deepStrictEqual([j.p, j.t, j.ts, j.n], [0, -1, 99, 1e6]);
  assert.strictEqual(j.o, null, 'a crate of an unknown kind is dropped, and an order with none is no order');
  assert.deepStrictEqual(plain(j.v), [{ who: TW.visitors.length - 1, id: 'turnip', n: 2, gold: 50, stars: 3, done: 0 }]);
  assert.deepStrictEqual(plain(j.k), [0, []]);
});

test('the tour has its own tip, once', () => {
  const keys = C.TIPS.map((t) => t.key);
  assert.strictEqual(keys.filter((k) => k === 'station_tour').length, 1);
  const s = fresh();
  assert.strictEqual(L.tipSeen(s, 'station_tour'), false);
  assert.ok(L.takeTip(s, 'station_tour'));
  assert.strictEqual(L.tipSeen(roundTrip(s), 'station_tour'), true);
});

test('the town map: the station, its rails and cargo are solid, and every door, spawn and place can still be walked to', () => {
  const { PROPS } = require('../tools/tiles');
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'town.json'), 'utf8'));
  const W = m.width, H = m.height, S = 256, solid = new Set();
  const collides = new Set();
  m.tilesets.forEach((ts) => (ts.tiles || []).forEach((t) => { if ((t.properties || []).some((p) => p.name === 'collides' && p.value)) collides.add(ts.firstgid + t.id); }));
  ['Walls'].forEach((name) => m.layers.find((l) => l.name === name).data.forEach((g, i) => { if (collides.has(g)) solid.add(i); }));
  m.layers.find((l) => l.name === 'Ground').data.forEach((g, i) => { if (collides.has(g)) solid.add(i); }); // water
  const objs = m.layers.find((l) => l.type === 'objectgroup').objects;
  const propSet = m.tilesets.find((t) => t.name === 'props');
  objs.filter((o) => o.gid && !(o.properties || []).some((p) => p.name === 'festival')).forEach((o) => {
    const name = propSet.tiles.find((t) => t.id === o.gid - propSet.firstgid).image.replace(/^.*\/|\.png$/g, ''), p = PROPS[name];
    const left = Math.round(o.x / S), bottom = Math.round(o.y / S);
    for (let y = bottom - (p.foot || 0); y < bottom; y++) for (let x = left; x < left + p.w; x++) solid.add(y * W + x);
  });
  const rect = (name) => objs.find((o) => o.name === name);
  ['station', 'rails', 'cargo'].forEach((n) => {
    const r = rect(n);
    assert.ok(r, n + ' is on the map');
    for (let y = r.y / S; y < (r.y + r.height) / S; y++) for (let x = r.x / S; x < (r.x + r.width) / S; x++) solid.add(y * W + x);
  });
  const spawn = rect('from_farm'), start = Math.floor(spawn.y / S) * W + Math.floor(spawn.x / S);
  const seen = new Set([start]), q = [start];
  while (q.length) {
    const k = q.pop(), x = k % W;
    [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W].forEach((o) => { if (o >= 0 && o < W * H && !seen.has(o) && !solid.has(o)) { seen.add(o); q.push(o); } });
  }
  const tile = (o) => Math.floor(o.y / S) * W + Math.floor(o.x / S);
  const points = objs.filter((o) => o.point && !/^fest_/.test(o.name));
  assert.ok(points.length > 40);
  points.forEach((o) => assert.ok(seen.has(tile(o)), o.name + ' can be walked to'));
  ['station_front', 'platform_w', 'platform_e', 'stall_front', 'from_east', 'from_pulag'].forEach((n) => assert.ok(seen.has(tile(rect(n))), n));
  objs.filter((o) => o.type === 'door').forEach((o) => {
    const x = Math.floor(o.x / S), y = Math.floor(o.y / S);
    assert.ok(seen.has((y + 1) * W + x) || seen.has((y - 1) * W + x), o.name + ': its doorstep'); // (Marco sells from the street above)
  });
  // the station's door is reached from the lane, and the rails never are
  assert.ok(seen.has(6 * W + 39) && seen.has(10 * W + 39) && seen.has(5 * W + 45));
  assert.ok(!seen.has(3 * W + 45));
});
