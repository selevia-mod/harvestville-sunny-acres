// Unit tests for Mang Danny's Trading Post and the Talipapa's vendors (owner, 18 Nov 2026;
// src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-trade.js, src/01-logicZ...Z-manila-trade.js): Danny's buy and sell prices
// and the 2x margin, the daily stock and its reset, his weekly rare trade (still), each vendor's goods, prices and stock,
// a full bag (the basket, then a clear no), and the save ('tx': old saves load, nothing lost).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(SRC).filter((f) => /^0[01]-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const X = C.MNTRADE;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.gold = 1e6; return s; };
const count = (s, id) => L.countItem(s, id);

test('Mang Danny sells every Mixer good at 2x what he pays, and pays the sell price (Farm Cement 120, Rope 170, Sili Powder 65, Beeswax 260)', () => {
  assert.deepStrictEqual(plain(L.txItems('danny')), ['farm_cement', 'rope', 'sili_powder', 'beeswax']);
  assert.deepStrictEqual(plain(L.txItems('danny')), plain(C.WORKSHOPS.mixer.recipes.map((r) => r.out)), 'every Mixer output');
  const pays = { farm_cement: 120, rope: 170, sili_powder: 65, beeswax: 260 };
  Object.keys(pays).forEach((id) => {
    assert.strictEqual(L.txPays(id), pays[id], id + ' pays');
    assert.strictEqual(L.txPrice(id), 2 * pays[id], id + ' sells');
    assert.strictEqual(L.txPrice(id) / L.txPays(id), 2, 'the 2x margin');
    assert.strictEqual(L.txShopOf(id), 'danny');
  });
  assert.strictEqual(X.shops.danny.stock, 20);
  // buying
  const s = fresh();
  assert.deepStrictEqual(plain(L.txBuy(s, 'danny', 'rope', 3)), { ok: true, n: 3, gold: 1020, basket: 0 });
  assert.strictEqual(s.gold, 1e6 - 1020);
  assert.strictEqual(count(s, 'rope'), 3);
  // selling back: half what it cost, any amount (more than his daily stock)
  L.addItem(s, 'rope', 47);
  assert.deepStrictEqual(plain(L.txSell(s, 'rope', 50)), { ok: true, n: 50, gold: 8500 });
  assert.strictEqual(count(s, 'rope'), 0);
  assert.strictEqual(s.gold, 1e6 - 1020 + 8500);
  assert.strictEqual(L.txSell(s, 'rope', 1).why, 'none', 'nothing to sell');
  L.addItem(s, 'garlic', 5);
  assert.strictEqual(L.txSell(s, 'garlic', 5).why, 'item', 'he buys only his own goods');
  assert.strictEqual(L.txBuy(s, 'danny', 'garlic', 1).why, 'shop', 'and sells only them');
  assert.strictEqual(L.txBuy(s, 'meat_vendor', 'rope', 1).why, 'shop');
  // selling more than you have sells what you have
  L.addItem(s, 'beeswax', 2);
  assert.strictEqual(L.txSell(s, 'beeswax', 9).n, 2);
});

test('the daily stock: 20 of each from Mang Danny, a buy past it is cut to what is left, then sold out; a new day fills the shelf', () => {
  const s = fresh();
  assert.strictEqual(L.txLeft(s, 'farm_cement'), 20);
  assert.strictEqual(L.txBuy(s, 'danny', 'farm_cement', 15).n, 15);
  assert.strictEqual(L.txLeft(s, 'farm_cement'), 5);
  assert.strictEqual(L.txLeft(s, 'rope'), 20, 'each item its own stock');
  const r = L.txBuy(s, 'danny', 'farm_cement', 9);
  assert.strictEqual(r.n, 5, 'only what is left');
  assert.strictEqual(r.gold, 5 * 240);
  assert.strictEqual(L.txBuy(s, 'danny', 'farm_cement', 1).why, 'stock');
  assert.strictEqual(count(s, 'farm_cement'), 20);
  // not enough gold: nothing bought, nothing counted
  s.gold = 100;
  assert.deepStrictEqual(plain(L.txBuy(s, 'danny', 'beeswax', 1)), { why: 'gold', cost: 520 });
  assert.strictEqual(L.txLeft(s, 'beeswax'), 20);
  // the next day (midnight, the game's own new day): full again
  clock.set(2026, 4, 2, 0, 5);
  L.catchUp(s, L.clock(), {});
  assert.strictEqual(L.txLeft(s, 'farm_cement'), 20, 'a new day');
  // and a game opened the next day from a save of the day before: full too
  const s2 = fresh();
  L.txBuy(s2, 'danny', 'rope', 20);
  const saved = plain(L.serialize(s2));
  assert.strictEqual(L.txLeft(L.deserialize(plain(saved)), 'rope'), 0, 'the same day: still sold out');
  clock.set(2026, 4, 2, 9, 0);
  const next = L.deserialize(plain(saved));
  L.catchUp(next, L.clock(), {});
  assert.strictEqual(L.txLeft(next, 'rope'), 20, 'opened the next day');
});

test('the weekly rare trade still works (talk panel and shop share it): once a week at 8 hearts', () => {
  const s = fresh(), o = L.mnTradeOffer(s);
  assert.strictEqual(o.on, false, 'not before 8 hearts');
  assert.strictEqual(L.mnTrade(s), 'locked');
  const f = L.friend(s, 'mn_danny'); f.met = 1; f.pts = 80;
  const t = L.mnTradeOffer(s);
  assert.ok(t.on && !t.done);
  L.addItem(s, t.give, t.n);
  assert.strictEqual(L.mnTrade(s), 'ok');
  assert.strictEqual(count(s, t.get), t.m);
  assert.strictEqual(L.mnTrade(s), 'done', 'one a week');
  assert.strictEqual(roundTrip(s) && L.mnTradeOffer(roundTrip(s)).done, true, 'saved');
  // buying and selling at his shop do not touch it
  L.txBuy(s, 'danny', 'rope', 2);
  L.txSell(s, 'rope', 2);
  assert.strictEqual(L.mnTradeOffer(s).done, true);
});

test('the Talipapa: meat, fish and vegetables the recipes use, at 2x their sell price, 30 of each a day; never a new item', () => {
  const used = new Set();
  C.RECIPES.forEach((r) => r.needs.forEach((n) => (C.FOOD_GROUPS[n] || [n]).forEach((id) => used.add(id))));
  const want = { meat_vendor: 'meat', fish_vendor: 'fish', veg_vendor: 'crop' };
  const seen = {};
  Object.keys(want).forEach((shop) => {
    const items = L.txItems(shop);
    assert.ok(items.length >= 3, shop);
    assert.strictEqual(X.shops[shop].stock, 30);
    items.forEach((id) => {
      assert.ok(C.ITEMS[id], id + ' is an item already in the game');
      assert.strictEqual(C.ITEMS[id].kind, want[shop], id);
      assert.ok(used.has(id), id + ' is used by a recipe');
      assert.strictEqual(L.txPrice(id), 2 * C.ITEMS[id].sell, id + ': 2x');
      assert.ok(!seen[id], id + ' in one shop only'); seen[id] = 1;
      assert.strictEqual(L.txShopOf(id), shop);
    });
  });
  assert.deepStrictEqual(plain(L.txItems('meat_vendor')), ['meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar']);
  assert.deepStrictEqual(plain(L.txItems('fish_vendor')), ['fish_s', 'fish_m', 'fish_l']);
  assert.deepStrictEqual(plain(L.txItems('veg_vendor')), ['garlic', 'ginger', 'potato', 'carrot', 'onion', 'tomato', 'chili', 'bitter_gourd']);
  assert.strictEqual(L.txPrice('meat_boar'), 120);
  assert.strictEqual(L.txPrice('fish_s'), 60);
  assert.strictEqual(L.txPrice('garlic'), 24);
  assert.strictEqual(L.txSell(fresh(), 'garlic', 1).why, 'item', 'the vendors only sell');
  // their stock
  const s = fresh();
  assert.strictEqual(L.txBuy(s, 'fish_vendor', 'fish_m', 30).n, 30);
  assert.strictEqual(L.txBuy(s, 'fish_vendor', 'fish_m', 1).why, 'stock');
  assert.strictEqual(L.txLeft(s, 'fish_s'), 30);
  assert.strictEqual(L.txBuy(s, 'veg_vendor', 'garlic', 40).n, 30, 'cut to the stock');
  assert.strictEqual(count(s, 'garlic'), 30);
  // nothing bought for less than growing or catching it is worth: raw resale and the Mixer's sili powder lose gold
  Object.keys(want).forEach((shop) => L.txItems(shop).forEach((id) => assert.ok(L.txPrice(id) > C.ITEMS[id].sell)));
  assert.ok(3 * L.txPrice('chili') + 2 * L.txPrice('garlic') > L.txPays('sili_powder'), 'bought chili and garlic make no cheap Sili Powder');
});

test('a full bag: what does not fit waits in the basket by the farmhouse; with no room there either, nothing is bought and nothing lost', () => {
  const s = fresh();
  s.inv = s.inv.map(() => ({ id: 'egg', n: C.MAX_STACK }));
  s.inv[0] = { id: 'potato', n: C.MAX_STACK - 2 };
  const r = L.txBuy(s, 'veg_vendor', 'potato', 5);
  assert.deepStrictEqual(plain(r), { ok: true, n: 5, gold: 5 * L.txPrice('potato'), basket: 3 });
  assert.strictEqual(s.inv[0].n, C.MAX_STACK, '2 in the bag');
  assert.strictEqual(s.basket.potato, 3, '3 in the basket');
  // the basket takes them home: they are never lost
  const back = roundTrip(s);
  assert.strictEqual(back.basket.potato, 3);
  // a basket that is full of that item too: no
  s.basket.onion = 999;
  const gold = s.gold;
  assert.strictEqual(L.txBuy(s, 'veg_vendor', 'onion', 1).why, 'full');
  assert.strictEqual(s.gold, gold, 'no gold taken');
  assert.strictEqual(L.txLeft(s, 'onion'), 30, 'no stock taken');
  // Mang Danny's goods the same way
  const d = L.txBuy(s, 'danny', 'rope', 4);
  assert.strictEqual(d.basket, 4);
  assert.strictEqual(s.basket.rope, 4);
});

test('the save: only when there is anything, one key ("tx"); a fresh game and an old save load as before; the tours are bits', () => {
  const s = fresh();
  assert.strictEqual(plain(L.serialize(s)).tx, undefined, 'a fresh game writes nothing');
  assert.strictEqual(C.SAVE_GEN, 3, 'the save generation stays 3');
  L.txBuy(s, 'danny', 'rope', 2);
  L.txBuy(s, 'meat_vendor', 'venison', 7);
  const o = plain(L.serialize(s));
  assert.deepStrictEqual(o.tx, [s.day, ['rope', 2, 'venison', 7], 0]);
  const b = roundTrip(s);
  assert.strictEqual(L.txLeft(b, 'rope'), 18);
  assert.strictEqual(L.txLeft(b, 'venison'), 23);
  // the tours
  assert.ok(!L.txTourSeen(b, 'post') && !L.txTourSeen(b, 'tp'));
  assert.strictEqual(L.txTourTake(b, 'tp'), true);
  assert.strictEqual(L.txTourTake(b, 'tp'), false);
  const c = roundTrip(b);
  assert.ok(L.txTourSeen(c, 'tp') && !L.txTourSeen(c, 'post'));
  assert.deepStrictEqual(plain(L.serialize(c)).tx, [s.day, ['rope', 2, 'venison', 7], 2]);
  // the next day only the tours are written
  clock.set(2026, 4, 2, 9, 0);
  L.catchUp(c, L.clock(), {});
  assert.deepStrictEqual(plain(L.serialize(c)).tx, [0, [], 2]);
  // an old save (no 'tx') loads with full shelves and no tour seen; one with junk in 'tx' too
  delete o.tx;
  const old = L.deserialize(plain(o));
  assert.ok(old && L.txLeft(old, 'rope') === 20 && !L.txTourSeen(old, 'post'));
  ['x', 5, [], [null, 'a', {}], [o.d, ['nope', 4, 'rope', -3, 'rope', 'z'], 'q']].forEach((junk) => {
    const j = L.deserialize(Object.assign(plain(o), { tx: junk }));
    assert.ok(j && L.txLeft(j, 'rope') === 20, JSON.stringify(junk));
  });
  // and nothing else in the save changes: the same save with and without the feature's key
  const keys = Object.keys(plain(L.serialize(old))).sort();
  assert.ok(keys.indexOf('tx') < 0);
});

test('the Trading Post opens: its "Coming soon" goes, the other buildings keep theirs; Mang Danny\'s shelves are full', () => {
  const M = C.MANILA, b = (k) => M.buildings.filter((x) => x.key === k)[0];
  assert.ok(!/soon/i.test(b('trading').text), b('trading').text);
  ['harbor', 'stage'].forEach((k) => assert.match(b(k).text, /soon/i, k));
  assert.ok(!M.people.danny.lines.some((l) => /empty|soon/i.test(l)));
  assert.strictEqual(C.DIALOGUE.mn_danny.tiers[0][0], M.people.danny.lines[0], 'his friendship talk says the same');
});
