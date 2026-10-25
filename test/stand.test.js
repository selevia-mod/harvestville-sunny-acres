// Unit tests for the farm stand: selling now, shelves with prices and buyers, collecting, orders, and the save.
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
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const fresh = () => { const s = L.newState(); s.seed = 11; s.inv = s.inv.map(() => null); return s; };

test('selling now pays less than the base price, right away', () => {
  const s = fresh();
  L.addItem(s, 'turnip', 4);
  const gold0 = s.gold;
  assert.strictEqual(L.sellNow(s, slotOf(s, 'turnip'), 3), 3 * Math.floor(60 * C.STAND.instant));
  assert.strictEqual(s.gold - gold0, 135);
  assert.strictEqual(L.countItem(s, 'turnip'), 1);
  assert.ok(L.discovered(s, 'turnip'));
  L.addItem(s, 'hoe', 1);
  assert.strictEqual(L.sellNow(s, slotOf(s, 'hoe'), 1), 0, 'tools do not sell');
});

test('a shelf sells after a while at its price, and the coins wait to be collected', () => {
  const s = fresh();
  L.addItem(s, 'turnip', 30);
  assert.strictEqual(L.listItem(s, 0, slotOf(s, 'turnip'), 30, 2), 'ok');
  assert.strictEqual(s.shelves[0].n, C.STAND.perShelf, 'at most perShelf on one shelf');
  assert.strictEqual(L.countItem(s, 'turnip'), 30 - C.STAND.perShelf);
  assert.strictEqual(L.listItem(s, 0, slotOf(s, 'turnip'), 1, 0), 'busy');
  const wait = s.shelves[0].left;
  const [lo, hi] = C.STAND.prices[2].minutes;
  assert.ok(wait >= lo && wait <= hi, 'high price waits ' + wait);
  assert.deepStrictEqual(plain(L.standTick(s, wait - 1).sold), []);
  const sold = L.standTick(s, 1).sold;
  assert.strictEqual(sold.length, 1);
  assert.strictEqual(sold[0].coins, Math.round(60 * 1.4) * 20);
  assert.ok(C.VILLAGER_ORDER.includes(sold[0].buyer));
  assert.strictEqual(L.unlist(s, 0), 'sold', 'a sold lot cannot be taken back');
  const gold0 = s.gold, earned0 = s.stats.earned;
  assert.strictEqual(L.collectStand(s), 1680);
  assert.strictEqual(s.gold - gold0, 1680);
  assert.strictEqual(s.stats.earned - earned0, 1680);
  assert.strictEqual(s.shelves[0], null);
});

test('in town, a lot whose time is up waits for a villager to walk up and buy it', () => {
  const s = fresh();
  L.addItem(s, 'turnip', 4);
  L.listItem(s, 2, slotOf(s, 'turnip'), 4, 0);
  const r = L.standTick(s, 999, true);
  assert.deepStrictEqual(plain(r), { sold: [], due: [2] });
  assert.strictEqual(s.shelves[2].coins, 0, 'not sold until the buyer arrives');
  assert.deepStrictEqual(plain(L.standTick(s, 1, true).due), [2], 'still due');
  const sale = L.sellLot(s, 2, 'rosa');
  assert.strictEqual(sale.buyer, 'rosa');
  assert.strictEqual(s.shelves[2].coins, 240);
  assert.strictEqual(L.sellLot(s, 2, 'lily'), null, 'already sold');
  // away from town, a due lot sells by itself
  L.addItem(s, 'egg', 1);
  L.listItem(s, 3, slotOf(s, 'egg'), 1, 0);
  L.standTick(s, 999, true);
  assert.strictEqual(L.standTick(s, 1).sold.length, 1);
});

test('cheap sells sooner than fair, fair sooner than high', () => {
  const r = C.STAND.prices.map((p) => p.minutes);
  assert.ok(r[0][1] <= r[1][0] && r[1][1] <= r[2][0]);
  assert.ok(C.STAND.prices[0].mult < C.STAND.prices[2].mult && C.STAND.instant < C.STAND.prices[0].mult);
});

test('an unsold lot can be taken back; the night moves the shelves along', () => {
  const s = fresh();
  L.addItem(s, 'egg', 5);
  L.addItem(s, 'milk', 2);
  L.listItem(s, 1, slotOf(s, 'egg'), 5, 1);
  assert.strictEqual(L.unlist(s, 1), 'ok');
  assert.strictEqual(L.countItem(s, 'egg'), 5);
  L.listItem(s, 1, slotOf(s, 'egg'), 5, 1);
  L.listItem(s, 2, slotOf(s, 'milk'), 2, 2);
  const r = L.endDay(s, false, {});
  assert.strictEqual(r.standSold.length, 2, 'fair and high both sell overnight');
  assert.strictEqual(r.standCoins, Math.round(40 * 1.2) * 5 + Math.round(100 * 1.4) * 2);
  assert.strictEqual(r.earned, 0, 'nothing went through the old shipping box');
});

test('orders ask for things you can get, pay a bonus and friendship, then a new one comes', () => {
  const s = fresh();
  L.standTick(s, 200);
  assert.ok(s.orders.every((o) => o.items), 'three orders arrive');
  assert.strictEqual(new Set(s.orders.map((o) => o.from)).size, 3, 'from three different villagers');
  const pool = L.orderCandidates(s);
  s.orders.forEach((o) => o.items.forEach(([id, n]) => {
    assert.ok(pool.includes(id), id + ' can be had now');
    assert.ok(n >= 1 && n <= 10);
  }));
  assert.ok(pool.includes('turnip') && pool.includes('egg') && !pool.includes('tomato'), 'spring crops and Clucky');
  const o = s.orders[0];
  assert.strictEqual(L.deliverOrder(s, 0), 0, 'nothing in the bag yet');
  o.items.forEach(([id, n]) => L.addItem(s, id, n));
  const value = o.items.reduce((sum, [id, n]) => sum + L.basePrice(id) * n, 0);
  const gold0 = s.gold, pts0 = L.friend(s, o.from).pts;
  assert.strictEqual(L.deliverOrder(s, 0), o.gold);
  assert.ok(o.gold >= value * 1.4, 'a bonus over the base price');
  assert.strictEqual(s.gold - gold0, o.gold);
  assert.strictEqual(L.friend(s, o.from).pts - pts0, C.ORDERS.friend);
  o.items.forEach(([id]) => assert.strictEqual(L.countItem(s, id), 0));
  assert.strictEqual(s.orders[0].wait, C.ORDERS.refill);
  L.skipOrder(s, 1);
  assert.strictEqual(s.orders[1].wait, C.ORDERS.skip);
  L.standTick(s, C.ORDERS.skip);
  assert.ok(s.orders[0].items && s.orders[1].items, 'both refilled');
});

test('the stand and the orders survive a save, and an old save loads with empty shelves', () => {
  const s = fresh();
  L.addItem(s, 'potato', 7);
  L.listItem(s, 3, slotOf(s, 'potato'), 7, 0);
  L.addItem(s, 'turnip', 2);
  L.listItem(s, 5, slotOf(s, 'turnip'), 2, 2);
  L.standTick(s, 200);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.shelves), plain(s.shelves));
  assert.deepStrictEqual(plain(back.orders), plain(s.orders));
  assert.strictEqual(back.orderNo, s.orderNo);
  const o = plain(L.serialize(fresh()));
  delete o.sh;
  delete o.od;
  const old = L.deserialize(o);
  assert.strictEqual(old.shelves.length, C.STAND.shelves);
  assert.ok(old.shelves.every((e) => e === null));
  assert.strictEqual(old.orders.length, C.ORDERS.count);
  // a full stand still fits the save budget
  const big = fresh();
  big.shelves = big.shelves.map(() => ({ id: 'carabao_milk', n: 20, price: 2, left: 400, coins: 99999, buyer: 'rosa' }));
  big.orders = big.orders.map(() => ({ from: 'hollis', gold: 99990, items: [['carabao_milk', 10], ['ore_silver', 10], ['fish_m', 10]] }));
  assert.ok(JSON.stringify(L.serialize(big)).length < 2000);
});
