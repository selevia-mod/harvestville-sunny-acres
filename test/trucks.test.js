// Unit tests for the trucks and the barangay City Orders (steps 2 and 3 of the truck plan, owner 18 Nov 2026:
// docs/superpowers/specs/2026-11-18-trucks-and-city-orders-design.md; src/00-zzz...-trucks.js, src/01-logicZZZ...-trucks.js):
// each truck's cost, Market Stars to have (not spent) and load; switching with a load never loses any; a truck needs no
// horse; Mang Kardo takes a truck (his fee, the friends' price); the City Order (its week, the same order for a barangay
// on every phone, its size by members, 4 kinds), 2x pay, "SQL not applied" takes nothing, the prizes (3 Stars, the plaque
// once), no barangay, and the save (old saves unchanged, the parts appended to 'gm').
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const load = () => {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
  return ctx;
};
const ctx = load();
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
const TR = C.TRUCKS, V = TR.list, G = C.GRAND_MARKET, CO = TR.city;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const ID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const manila = (y, mo, d, h = 10, mi = 0) => { clock.ms = Date.UTC(y, mo - 1, d, h - 8, mi); return clock.ms; }; // (Manila time, on any phone)
const fresh = () => {
  manila(2026, 11, 18, 10, 0);
  const s = L.newState(); s.seed = 11; s.gold = 5e6; s.lumber = 1000;
  s.builds.stable = 1; s.horse = { name: 'Chestnut', love: 0, pet: 0 };
  s.gm.cart = 1;
  L.silo(s).lv = C.SILO.levels.length - 1; // (the biggest Silo: 1,200)
  return s;
};
const stock = (s, i) => { V[i].needs.forEach((n) => L.addItem(s, n[0], n[1])); s.gm.ms = Math.max(s.gm.ms, V[i].stars); return s; };
const count = (s) => { // every crop the farm holds: vehicles, parked, waiting, on the road, the Silo, the bag
  const n = {}, add = (c) => Object.keys(c || {}).forEach((k) => { const id = k.split('~')[0]; n[id] = (n[id] || 0) + c[k]; });
  add(s.gm.cargo); Object.keys(s.gm.park || {}).forEach((v) => add(s.gm.park[v]));
  if (s.gm.co && s.gm.co.q) add(s.gm.co.q.lots);
  if (s.gm.trip) add(s.gm.trip.cargo);
  add(L.silo(s).c);
  s.inv.forEach((x) => { if (x && L.isFarmCrop(x.id)) n[x.id] = (n[x.id] || 0) + x.n; });
  return n;
};

// ---------- the trucks ----------
test('three trucks: their loads, Market Stars to have, and costs (the spec\'s numbers)', () => {
  assert.deepStrictEqual(plain(V.slice(1).map((R) => [R.key, R.cap, R.stars, R.gold, R.lumber, R.needs])), [
    ['pickup', 300, 10, 150000, 80, [['ore_silver', 15], ['farm_cement', 6], ['rope', 4]]],
    ['farm_truck', 800, 30, 600000, 120, [['ore_gold', 15], ['farm_cement', 12], ['rope', 8]]],
    ['big_truck', 1500, 60, 1500000, 200, [['ore_gold', 20], ['farm_cement', 20], ['rope', 12], ['obsidian', 10]]],
  ]);
  assert.strictEqual(G.cart.cap, 100, 'the horse cart as it was');
  V.slice(1).forEach((R) => R.needs.forEach((n) => assert.ok(C.ITEMS[n[0]], n[0])));
  // a distinct look each: colour and size
  assert.strictEqual(new Set(V.slice(1).map((R) => R.cab)).size, 3);
  assert.ok(V[1].w < V[2].w && V[2].w < V[3].w && V[1].h < V[2].h && V[2].h < V[3].h);
});

test('Bram makes each truck: Market Stars are a threshold, never spent; then the gold, lumber and materials', () => {
  [1, 2, 3].forEach((i) => {
    const s = fresh(), R = V[i];
    stock(s, i); s.gm.ms = R.stars - 1;
    const gold = s.gold;
    assert.strictEqual(L.trkMake(s, i), 'stars');
    assert.strictEqual(s.gold, gold, 'nothing taken');
    s.gm.ms = R.stars;
    s.gold = R.gold - 1;
    assert.strictEqual(L.trkMake(s, i), 'gold');
    s.gold = R.gold; s.lumber = R.lumber - 1;
    assert.strictEqual(L.trkMake(s, i), 'lumber');
    s.lumber = R.lumber;
    L.removeItem(s, R.needs[0][0], 1);
    assert.strictEqual(L.trkMake(s, i), 'needs');
    L.addItem(s, R.needs[0][0], 1);
    assert.strictEqual(L.trkMake(s, i), 'ok');
    assert.strictEqual(s.gold, 0);
    assert.strictEqual(s.lumber, 0);
    R.needs.forEach((n) => assert.strictEqual(L.countItem(s, n[0]), 0, n[0]));
    assert.strictEqual(L.gmStars(s), R.stars, 'the Stars are kept');
    assert.ok(L.trkOwns(s, i));
    assert.strictEqual(L.trkUse(s), i, 'the bigger one takes over');
    assert.strictEqual(L.gmCap(s), R.cap);
    assert.strictEqual(L.gmVehName(s), R.name);
    assert.strictEqual(L.trkMake(s, i), 'have', 'one each');
  });
});

test('loading a truck: its own room (from the Silo and the bag, as the cart)', () => {
  const s = stock(fresh(), 1);
  L.trkMake(s, 1);
  L.siloPut(s, 'corn', 500);
  assert.strictEqual(L.gmLoadSilo(s, 'corn', 500), 300);
  assert.strictEqual(L.gmWhyNot(s), 'full');
  assert.strictEqual(L.gmUnload(s, 'corn', 50), 50);
  L.addItemQ(s, 'pumpkin', 20, 2);
  assert.strictEqual(L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === 'pumpkin'), 99), 20);
  assert.deepStrictEqual(plain(s.gm.cargo), { corn: 250, 'pumpkin~2': 20 });
});

test('switching vehicles with a load: it moves with you; what the smaller one cannot hold stays parked; nothing lost', () => {
  const s = stock(stock(fresh(), 1), 3);
  L.trkMake(s, 1); L.trkMake(s, 3);
  assert.strictEqual(L.trkUse(s), 3);
  L.siloPut(s, 'corn', 900); L.gmLoadSilo(s, 'corn', 900);
  L.addItemQ(s, 'tomato', 400, 1); L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === 'tomato'), 400);
  const before = count(s);
  assert.strictEqual(L.gmLoad(s), 1300);
  // to the cart (100): 100 moves, 1,200 stay in the Big Truck
  let r = L.trkSwitch(s, 0);
  assert.deepStrictEqual(plain(r), { ok: true, moved: 100, left: 1200 });
  assert.strictEqual(L.trkUse(s), 0);
  assert.strictEqual(L.gmCap(s), 100);
  assert.strictEqual(L.trkLoadOf(s, 3), 1200);
  assert.deepStrictEqual(plain(count(s)), plain(before));
  // the save keeps the parked load
  const b = roundTrip(s);
  assert.deepStrictEqual(plain(b.gm.park), plain(s.gm.park));
  assert.strictEqual(L.trkUse(b), 0);
  // to the Pickup (300): the cart's 100 go in with it, nothing waits in the Pickup; then back to the Big Truck: its own
  // 1,200 and the Pickup's 100 (room for 300 more)
  r = L.trkSwitch(s, 1);
  assert.strictEqual(r.moved, 100);
  r = L.trkSwitch(s, 3);
  assert.deepStrictEqual(plain(r), { ok: true, moved: 100, left: 0 });
  assert.strictEqual(L.gmLoad(s), 1300);
  assert.deepStrictEqual(plain(s.gm.park), {});
  assert.deepStrictEqual(plain(count(s)), plain(before));
  // unloading a parked one: into the Silo and the bag; what fits nowhere stays in it
  L.trkSwitch(s, 1);
  const parked = L.trkLoadOf(s, 3);
  const out = L.trkUnloadParked(s, 3);
  assert.ok(out > 0 && out <= parked);
  assert.strictEqual(L.trkLoadOf(s, 3), parked - out);
  assert.deepStrictEqual(plain(count(s)), plain(before));
  // not while Mang Kardo is on the road with it, nor to one not owned, nor to the one in use
  assert.strictEqual(L.trkSwitch(s, 2).why, 'none');
  assert.strictEqual(L.trkSwitch(s, 1).why, 'same');
  L.gmSend(s, 'sell', L.nowMin());
  assert.ok(s.gm.trip);
  assert.strictEqual(L.trkSwitch(s, 0).why, 'away');
});

test('a truck needs no horse: driving it yourself goes by the valley road\'s walked rules', () => {
  const s = stock(fresh(), 1);
  assert.strictEqual(L.trkDriveOk(s).why, 'cart', 'the cart goes with the horse');
  L.trkMake(s, 1);
  s.horse = null;
  assert.deepStrictEqual(plain(L.trkDriveOk(s)), { ok: true });
  // a farm with no cart and no horse at all can still have a truck in use
  const t = stock(fresh(), 1);
  t.gm.cart = 0; t.horse = null;
  assert.strictEqual(L.trkMake(t, 1), 'ok');
  assert.strictEqual(L.trkUse(t), 1);
  assert.ok(L.gmHasCart(t), 'a vehicle');
  assert.strictEqual(L.gmMakeCart(t), 'horse', 'the cart still needs the horse');
  // the road closed: no drive
  const on = C.MANILA.on;
  C.MANILA.on = false;
  try { assert.strictEqual(L.trkDriveOk(s).why, 'road'); } finally { C.MANILA.on = on; }
});

test('Mang Kardo takes a truck: the whole load, his fee, and 5% with his friendship at 8 hearts', () => {
  const s = stock(fresh(), 2);
  L.trkMake(s, 2);
  L.siloPut(s, 'corn', 800); L.gmLoadSilo(s, 'corn', 800);
  let q = L.gmSendQuote(s, 'sell');
  assert.strictEqual(q.n, 800);
  assert.strictEqual(q.fee, Math.round(q.gold * 0.1));
  const f = L.friend(s, 'mn_kardo'); f.met = 1; f.pts = 80;
  q = L.gmSendQuote(s, 'sell');
  assert.strictEqual(q.fee, Math.round(q.gold * 0.05));
  const now = L.nowMin(), gold = s.gold;
  assert.ok(L.gmSend(s, 'sell', now).ok);
  assert.ok(L.gmAway(s));
  assert.strictEqual(L.gmLoad(s), 0);
  assert.strictEqual(L.trkDriveOk(s).why, 'away');
  const r = L.gmFinish(roundTrip(s), now + G.driver.mins);
  assert.strictEqual(r.net, q.net);
  const b = roundTrip(s);
  L.gmFinish(b, now + G.driver.mins);
  assert.strictEqual(b.gold, gold + q.net);
  assert.strictEqual(L.trkUse(b), 2, 'the truck is back');
});

// ---------- the City Order ----------
test('the City Order week: Monday 8 AM to Sunday 7 PM, Manila time', () => {
  const wk = L.coWeek(manila(2026, 11, 18, 10));
  assert.strictEqual(wk.key, '2026-11-16');
  assert.strictEqual(wk.day, L.coDayOf('2026-11-16'));
  assert.ok(wk.open);
  assert.strictEqual(wk.start, Date.UTC(2026, 10, 16, 0, 0), 'Monday 8 AM in Manila');
  assert.strictEqual(wk.end, Date.UTC(2026, 10, 22, 11, 0), 'Sunday 7 PM in Manila');
  assert.ok(!L.coWeek(manila(2026, 11, 22, 19, 0)).open, 'Sunday 7 PM: closed');
  assert.ok(L.coWeek(manila(2026, 11, 22, 18, 59)).open);
  const early = L.coWeek(manila(2026, 11, 23, 7, 59));
  assert.ok(!early.open && early.key === '2026-11-23' && early.next === Date.UTC(2026, 10, 23, 0, 0), 'Monday 7:59 AM: the new week opens at 8');
  assert.ok(L.coWeek(manila(2026, 11, 23, 8, 0)).open);
});

test('the order: 4 kinds the week and the barangay choose (the same on every phone), 150 of each per 5 members', () => {
  const other = load().window.Farm.Logic, wk = L.coWeek(manila(2026, 11, 18)).day;
  const o = L.coOrder(wk, 42, 7);
  assert.strictEqual(o.kinds.length, 4);
  assert.strictEqual(new Set(o.kinds).size, 4);
  o.kinds.forEach((k) => assert.ok(L.isFarmCrop(k) && L.coCrops(wk).includes(k), k));
  for (let h = 1; h < 40; h++) for (let w = wk - 21; w <= wk + 21; w += 7) assert.deepStrictEqual(plain(L.coOrder(w, h, 5)), plain(other.coOrder(w, h, 5)), 'another phone');
  // different barangays and weeks: different orders
  const by = new Set(); for (let h = 1; h <= 20; h++) by.add(L.coOrder(wk, h, 5).kinds.join());
  assert.ok(by.size >= 18, by.size + ' different orders for 20 barangays');
  assert.notDeepStrictEqual(plain(L.coOrder(wk, 42, 5).kinds), plain(L.coOrder(wk + 7, 42, 5).kinds));
  // size by members: 600 for every 5 (150 of each kind)
  assert.deepStrictEqual([1, 5, 6, 10, 11, 23, 30, 99].map((m) => L.coOrder(wk, 42, m).need), [150, 150, 300, 300, 450, 750, 900, 900]);
  assert.strictEqual(L.coOrder(wk, 42, 5).need * CO.kinds, 600);
});

const orderFor = (s, extra) => L.coRead(Object.assign({ ok: true, week: '2026-11-16', hood: 42, name: 'Masagana', members: 6, kinds: L.coOrder(L.coDayOf('2026-11-16'), 42, 6).kinds, need: 300, got: [0, 0, 0, 0], mine: [0, 0, 0, 0], done: false, ends_in: 3600 }, extra || {}));
const truckFarm = () => { const s = stock(fresh(), 1); L.trkMake(s, 1); return s; };

test('delivering: the crops wait for the server\'s answer; what it took pays 2x the sell price at once, the rest goes back', () => {
  const s = truckFarm(), o = orderFor(s), k = o.kinds[0], wk = o.day;
  L.siloPut(s, k, 250); L.gmLoadSilo(s, k, 250);
  L.addItemQ(s, k, 10, 2); L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === k), 10);
  const before = count(s), gold = s.gold;
  const b = L.coBegin(s, k, 300, 's', ID(1), wk);
  assert.strictEqual(b.n, 260);
  assert.strictEqual(L.gmCropLoad(s, k), 0, 'out of the truck, into the delivery');
  assert.strictEqual(L.coWaiting(s), 260);
  assert.deepStrictEqual(plain(count(s)), plain(before), 'nothing lost while it waits');
  // saved and loaded while it waits: still there, the same id
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.gm.co.q), plain(s.gm.co.q));
  assert.strictEqual(L.coBegin(s, k, 10, 's', ID(2), wk).why, 'busy', 'one at a time');
  assert.strictEqual(L.gmSendQuote(s, 'sell').why, 'busy');
  // no answer yet: it waits
  assert.deepStrictEqual(plain(L.coAnswer(s, null)), { wait: true });
  assert.strictEqual(L.coWaiting(s), 260);
  // the server took 255 (5 were over what the order needed): plain first, then the Gold ones at their 2x
  const r = L.coAnswer(s, { ok: true, took: 255, done: false });
  const plainEach = 2 * C.ITEMS[k].sell, goldEach = 2 * L.qualityPrice(k, 2);
  assert.strictEqual(r.took, 255);
  assert.strictEqual(r.back, 5);
  assert.strictEqual(r.gold, 250 * plainEach + 5 * goldEach);
  assert.strictEqual(s.gold, gold + r.gold);
  assert.deepStrictEqual(plain(s.gm.cargo), { [k + '~2']: 5 }, 'the rest back in the truck');
  assert.strictEqual(L.coWaiting(s), 0);
  assert.deepStrictEqual(plain(L.coMine(s, wk)), { [k]: 255 });
  assert.deepStrictEqual(plain(roundTrip(s).gm.co.d), { [k]: 255 });
  // a reply asking for more than was sent pays only what was sent
  L.siloPut(s, k, 20); L.gmLoadSilo(s, k, 20);
  L.coBegin(s, k, 20, 's', ID(3), wk);
  assert.strictEqual(L.coAnswer(s, { ok: true, took: 999 }).took, 20);
});

test('"the SQL is not applied" (or any no) takes nothing: every crop back in the truck, no gold, nothing recorded', () => {
  ['missing', { ok: false, code: 'hood' }, { ok: false, code: 'closed' }, { ok: false, code: 'done' }, { ok: true, took: 0 }].forEach((reply) => {
    const s = truckFarm(), o = orderFor(s), k = o.kinds[1];
    L.siloPut(s, k, 120); L.gmLoadSilo(s, k, 120);
    const before = plain(s.gm.cargo), gold = s.gold, stars = L.gmStars(s);
    L.coBegin(s, k, 120, 's', ID(4), o.day);
    const r = L.coAnswer(s, reply);
    assert.strictEqual(r.back, 120, JSON.stringify(reply));
    assert.ok(!r.ok);
    assert.deepStrictEqual(plain(s.gm.cargo), before);
    assert.strictEqual(s.gold, gold);
    assert.strictEqual(L.gmStars(s), stars);
    assert.deepStrictEqual(plain(L.coMine(s, o.day)), {});
    assert.strictEqual(L.coWaiting(s), 0);
  });
  assert.strictEqual(L.coAnswer(truckFarm(), 'missing'), null, 'nothing waiting: nothing to do');
});

test('Mang Kardo takes a City Order delivery: booked as he leaves, 2x less his fee 30 minutes later', () => {
  const s = truckFarm(), o = orderFor(s), k = o.kinds[2];
  const f = L.friend(s, 'mn_kardo'); f.met = 1; f.pts = 80; // (the friends' 5%)
  L.siloPut(s, k, 200); L.gmLoadSilo(s, k, 200);
  const gold = s.gold, now = L.nowMin();
  L.coBegin(s, k, 200, 'k', ID(5), o.day);
  const r = L.coAnswer(s, { ok: true, took: 150 }, now);
  assert.strictEqual(r.how, 'k');
  assert.strictEqual(s.gold, gold, 'the gold comes with him');
  assert.ok(L.gmAway(s));
  assert.strictEqual(L.gmCropLoad(s, k), 50, 'what the order did not need stays home');
  const b = roundTrip(s);
  assert.ok(b.gm.trip.co, 'saved as a City Order trip');
  const p = L.gmFinish(b, now + G.driver.mins);
  assert.strictEqual(p.gold, 150 * 2 * C.ITEMS[k].sell);
  assert.strictEqual(p.fee, Math.round(p.gold * 0.05));
  assert.strictEqual(b.gold, gold + p.gold - p.fee);
  assert.ok(p.co);
});

test('the order filled: +3 Market Stars for each who delivered, the plaque only the barangay\'s first time, each week once', () => {
  const s = truckFarm(), H = C.HOME, t = H.typeIndex.trophy_city_order, key = L.furnKey(t, 0), stars = L.gmStars(s);
  assert.ok(H.types[t].trophy && H.types[t].place === 'wall', 'a house trophy');
  assert.strictEqual(t, H.types.length - 1, 'appended last');
  const wk = L.coDayOf('2026-11-16');
  const paid = L.coPay(s, L.coClaimRead([{ week: '2026-11-09', stars: 3, plaque: true }, { week: '2026-11-16', stars: 3, plaque: false }]));
  assert.strictEqual(paid.length, 2);
  assert.strictEqual(L.gmStars(s), stars + 6);
  assert.strictEqual(s.home.bag[key], 1, 'one plaque');
  // asked again (an answer lost on the way): paid once
  assert.strictEqual(L.coPay(s, L.coClaimRead([{ week: '2026-11-16', stars: 3, plaque: true }])).length, 0);
  assert.strictEqual(L.gmStars(s), stars + 6);
  const b = roundTrip(s);
  assert.strictEqual(b.gm.co.p, wk, 'the last week paid is saved');
  assert.strictEqual(L.coPay(b, L.coClaimRead([{ week: '2026-11-16', stars: 3 }])).length, 0);
  assert.strictEqual(b.home.bag[key], 1, 'the plaque in storage, saved');
  // a broken answer pays nothing
  assert.deepStrictEqual(plain(L.coClaimRead([null, { week: 'x', stars: 3 }, { week: '2026-11-23', stars: 50 }])), [{ day: wk + 7, stars: 10, plaque: false }]);
  // Marco's wagon picks from the pieces it always did
  assert.strictEqual(H.wagonN, 42, 'the 42 pieces before the Manila Cup and the plaque');
});

test('reading the server: an order, no barangay, the week closed, or nonsense', () => {
  const o = orderFor(null, { got: [300, 120, 999, 0], mine: [10, 0, 0, 0] });
  assert.ok(o.ok && o.kinds.length === 4 && o.need === 300);
  assert.deepStrictEqual(plain(o.got), [300, 120, 300, 0], 'never over the need');
  assert.ok(!o.done);
  assert.ok(orderFor(null, { got: [300, 300, 300, 300] }).done);
  assert.strictEqual(L.coRead({ ok: false, code: 'hood' }).code, 'hood', 'no barangay: the board says how to join one');
  assert.strictEqual(L.coRead({ ok: false, code: 'closed' }).code, 'closed');
  assert.strictEqual(L.coRead({ ok: true, week: '2026-11-16', kinds: ['corn'] }), null);
  assert.strictEqual(L.coRead(null), null);
  assert.strictEqual(L.coRead({ ok: false, code: 'kinds', hood: 7, members: 3 }).hood, 7, 'the server asks for the kinds: the barangay is told');
});

test('no barangay, offline or no vehicle: nothing to deliver, nothing taken', () => {
  const s = fresh();
  s.gm.cart = 0;
  assert.strictEqual(L.coBegin(s, 'corn', 10, 's', ID(6), 1).why, 'cart');
  const t = truckFarm();
  assert.strictEqual(L.coBegin(t, 'corn', 10, 's', ID(7), 1).why, 'none', 'none of it in the truck');
  L.siloPut(t, 'corn', 10); L.gmLoadSilo(t, 'corn', 10);
  assert.strictEqual(L.coBegin(t, 'corn', 10, 's', 'not-an-id', 1).why, 'none', 'a delivery needs its id');
  assert.strictEqual(L.gmLoad(t), 10);
});

// ---------- the save ----------
test('old saves load unchanged: no trucks, the cart in use, nothing new written; the generation is still 3', () => {
  const DIR = path.join(__dirname, 'old-saves');
  fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).forEach((f) => {
    const { save } = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const s = L.deserialize(plain(save));
    assert.strictEqual(L.trkUse(s), 0, f);
    assert.strictEqual(L.trkCount(s), L.gmCartMade(s) ? 1 : 0);
    const o = plain(L.serialize(s));
    assert.ok(!o.gm || o.gm.length <= 8, f + ': no new parts');
    assert.strictEqual(o.gg, 3);
  });
  // a step-1 farm (the cart, its load, a trip on the road, contracts and Stars): the same 'gm' back
  const s = fresh();
  L.siloPut(s, 'corn', 100); L.gmLoadSilo(s, 'corn', 100);
  s.gm.ms = 4; s.gm.tour = 3;
  L.gmSend(s, 'sell', L.nowMin());
  const o = plain(L.serialize(s)), again = plain(L.serialize(L.deserialize(plain(o))));
  assert.deepStrictEqual(again.gm, o.gm);
  assert.strictEqual(o.gm.length, 7, 'as step 1 wrote it');
  assert.strictEqual(L.trkUse(L.deserialize(o)), 0);
});

test('the save: trucks owned, the one in use, parked loads and the City Order record appended to gm (8 and 9)', () => {
  const s = stock(stock(fresh(), 1), 2);
  L.trkMake(s, 1); L.trkMake(s, 2);
  L.siloPut(s, 'corn', 900); L.gmLoadSilo(s, 'corn', 900);
  L.trkSwitch(s, 1);
  const o = orderFor(s), k = 'corn';
  L.coBegin(s, k, 50, 'k', ID(8), o.day);
  const out = plain(L.serialize(s));
  assert.deepStrictEqual(out.gm[8], [3, 1, [2, 'corn', 0, 500]]);
  assert.deepStrictEqual(out.gm[9], [0, 0, [], [ID(8), o.day, 'corn', 1, ['corn', 0, 50]]]);
  assert.strictEqual(out.gm[0], 1, 'the cart part unchanged');
  const b = L.deserialize(out);
  assert.deepStrictEqual(plain(b.gm.park), { 2: { corn: 500 } });
  assert.deepStrictEqual(plain(b.gm.co.q), plain(s.gm.co.q));
  assert.strictEqual(L.trkUse(b), 1);
  // a broken waiting delivery (no id): its crops back in the vehicle, never lost
  const bad = plain(out);
  bad.gm[9][3][0] = 'x';
  const c = L.deserialize(bad);
  assert.strictEqual(c.gm.co.q, null);
  assert.strictEqual(L.gmCropLoad(c, 'corn'), L.gmCropLoad(b, 'corn') + 50);
  // a vehicle in use the farm does not own: its biggest, and a parked load of an unknown one goes into the one in use
  const odd = plain(out);
  odd.gm[8] = [1, 3, [3, 'corn', 0, 7]];
  const d = L.deserialize(odd);
  assert.strictEqual(L.trkUse(d), 1);
  assert.strictEqual(L.gmCropLoad(d, 'corn'), 250 + 7); // (50 still wait for their answer)
});
