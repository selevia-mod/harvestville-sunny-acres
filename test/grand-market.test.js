// Unit tests for Aling Rosa's Grand Market and the horse cart (step 1 of the truck plan, owner 18 Nov 2026:
// docs/superpowers/specs/2026-11-18-grand-market-horse-cart-design.md; src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzz-grand-market.js,
// src/01-logicZZZZZZZZZZZZZZZZZZZZZZZ-grand-market.js): the price board, by cart only and at least 50, quality prices, the
// contracts and Market Stars, the cart's recipe, loading and unloading, Mang Kardo's trips, the horse on the valley road
// and in Manila, and the save (old saves unchanged, nothing in the cart ever lost).
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
L.weather = () => 'sunny';
const G = C.GRAND_MARKET, M = C.MANILA, H = C.HORSE_OUT;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const fresh = () => {
  clock.set(2026, 11, 18, 10, 0);
  const s = L.newState(); s.seed = 11; s.gold = 1e6; s.lumber = 500;
  s.builds.stable = 1; s.horse = { name: 'Chestnut', love: 0, pet: 0 };
  return s;
};
const withCart = () => { const s = fresh(); s.gm.cart = 1; return s; };
const give = (s, id, n = 1, q = 0) => { if (q) L.addItemQ(s, id, n, q); else L.addItem(s, id, n); return s.inv.findIndex((x) => x && x.id === id && (x.q || 0) === q); };
const crops = () => L.gmCrops();
// (a new farm starts with a few seeds in the bag: gone, for the tests of what it can grow)
const noSeeds = (s) => { s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'seed' ? null : x)); s.store = (s.store || []).map((x) => (x && C.ITEMS[x.id].kind === 'seed' ? null : x)); return s; };

// ---------- the price board ----------
test('the board: every farm crop, a multiplier of 1.1 to 1.6 (hot crops 1.6 to 1.8), two decimals', () => {
  assert.ok(crops().length >= 50 && crops().every((id) => L.isFarmCrop(id)));
  assert.ok(!crops().includes('wild_banana') && !L.gmMult(20000, 'egg'), 'only planted farm crops');
  let lo = 9, hi = 0, hotLo = 9, hotHi = 0;
  for (let d = 20000; d < 20365; d++) crops().forEach((id) => {
    const m = L.gmMult(d, id);
    assert.strictEqual(Math.round(m * 100) / 100, m, 'two decimals');
    if (L.gmIsHot(d, id)) { hotLo = Math.min(hotLo, m); hotHi = Math.max(hotHi, m); } else { lo = Math.min(lo, m); hi = Math.max(hi, m); }
  });
  assert.ok(lo >= 1.1 && hi <= 1.6, 'plain ' + lo + '-' + hi);
  assert.ok(hotLo >= 1.6 && hotHi <= 1.8, 'hot ' + hotLo + '-' + hotHi);
  assert.ok(lo < 1.15 && hi > 1.55 && hotLo < 1.65 && hotHi > 1.75, 'the whole range is used');
  // a price is the sell price x the multiplier
  const d = 20410, m = L.gmMult(d, 'corn');
  assert.strictEqual(L.gmPrice(d, 'corn', 0), Math.round(C.ITEMS.corn.sell * m));
});

test('the board is the same for the same day and crop, on every phone (another copy of the game), and changes with the day', () => {
  const other = load().window.Farm.Logic;
  for (let d = 20400; d < 20420; d++) {
    assert.deepStrictEqual(plain(L.gmBoard(d)), plain(other.gmBoard(d)), 'day ' + d);
    assert.deepStrictEqual(plain(L.gmHot(d)), plain(other.gmHot(d)));
    assert.strictEqual(L.gmMult(d, 'corn'), L.gmMult(d, 'corn'));
  }
  // (and it asks no one: the farm's seed plays no part)
  const a = fresh(), b = fresh(); b.seed = 999;
  assert.deepStrictEqual(plain(L.gmBoard(a.day)), plain(L.gmBoard(b.day)));
  // a new day: new multipliers
  const changed = crops().filter((id) => L.gmMult(20410, id) !== L.gmMult(20411, id)).length;
  assert.ok(changed > crops().length * 0.8, changed + ' of ' + crops().length + ' changed');
  assert.notDeepStrictEqual(plain(L.gmHot(20410)), plain(L.gmHot(20411)));
});

test('3 hot crops a day, different crops, on top of the board', () => {
  const seen = new Set();
  for (let d = 20400; d < 20460; d++) {
    const hot = L.gmHot(d), board = L.gmBoard(d);
    assert.strictEqual(hot.length, 3);
    assert.strictEqual(new Set(hot).size, 3);
    assert.deepStrictEqual(plain(board.slice(0, 3).map((b) => b.id).sort()), plain([...hot].sort()), 'hot on top');
    assert.ok(board.slice(0, 3).every((b) => b.hot) && board.slice(3).every((b) => !b.hot));
    assert.strictEqual(board.length, crops().length, 'every crop on it');
    for (let i = 4; i < board.length; i++) assert.ok(board[i - 1].mult >= board[i].mult, 'then the best paying first');
    hot.forEach((id) => seen.add(id));
  }
  assert.ok(seen.size > 30, 'the hot crops move around: ' + seen.size);
});

// ---------- selling ----------
test('at least 50 of one crop: 49 is too few, 50 sells (every quality of it together)', () => {
  const s = withCart();
  s.gm.cargo = { corn: 49 };
  const g0 = s.gold;
  assert.deepStrictEqual(plain(L.gmSell(s, 'corn', s.day)), { why: 'min', n: 49 });
  assert.strictEqual(s.gold, g0);
  assert.strictEqual(s.gm.cargo.corn, 49, 'nothing taken');
  s.gm.cargo = { corn: 45, 'corn~2': 5, tomato: 60 };
  const r = L.gmSell(s, 'corn', s.day);
  assert.ok(r.ok);
  assert.strictEqual(r.n, 50);
  assert.strictEqual(r.gold, 45 * L.gmPrice(s.day, 'corn', 0) + 5 * L.gmPrice(s.day, 'corn', 2));
  assert.strictEqual(s.gold, g0 + r.gold);
  assert.deepStrictEqual(plain(s.gm.cargo), { tomato: 60 }, 'only that crop went');
  assert.strictEqual(s.stats.earned, r.gold);
});

test('by cart only: crops in the bag (or the Silo) do not sell at the Grand Market', () => {
  const s = fresh();
  give(s, 'corn', 200);
  L.siloPut(s, 'corn', 200);
  assert.deepStrictEqual(plain(L.gmSell(s, 'corn', s.day)), { why: 'none' }, 'no cart');
  s.gm.cart = 1;
  assert.deepStrictEqual(plain(L.gmSell(s, 'corn', s.day)), { why: 'none' }, 'an empty cart');
  assert.strictEqual(L.countItem(s, 'corn'), 200);
  assert.strictEqual(L.siloHas(s, 'corn'), 200);
  // and the town stall, the orders and the requests are as they were (the bag's Sell now is its old price)
  const slot = s.inv.findIndex((x) => x && x.id === 'corn');
  assert.strictEqual(L.sellNow(s, slot, 10), L.instantPrice('corn', 10));
});

test('quality: Silver and Gold crops sell at their quality price x the day\'s multiplier', () => {
  const s = withCart(), d = s.day, m = L.gmMult(d, 'pumpkin');
  [1, 2].forEach((q) => {
    assert.ok(L.qualityPrice('pumpkin', q) > C.ITEMS.pumpkin.sell);
    assert.strictEqual(L.gmPrice(d, 'pumpkin', q), Math.round(L.qualityPrice('pumpkin', q) * m));
  });
  assert.ok(L.gmPrice(d, 'pumpkin', 2) > L.gmPrice(d, 'pumpkin', 1) && L.gmPrice(d, 'pumpkin', 1) > L.gmPrice(d, 'pumpkin', 0));
  s.gm.cargo = { 'pumpkin~1': 30, 'pumpkin~2': 20 };
  assert.strictEqual(L.gmSell(s, 'pumpkin', d).gold, 30 * L.gmPrice(d, 'pumpkin', 1) + 20 * L.gmPrice(d, 'pumpkin', 2));
});

// ---------- contracts ----------
test('contracts: 3 a day per farm, 100 to 200 of one crop (in tens), at 1.7x its sell price; the same farm, the same ones', () => {
  const s = fresh();
  for (let d = s.day; d < s.day + 40; d++) {
    const cs = L.gmContractsOf(s, d);
    assert.strictEqual(cs.length, 3);
    assert.strictEqual(new Set(cs.map((c) => c.crop)).size, 3, 'three different crops');
    cs.forEach((c, i) => {
      assert.ok(L.isFarmCrop(c.crop));
      assert.ok(c.need >= 100 && c.need <= 200 && c.need % 10 === 0, String(c.need));
      assert.strictEqual(c.each, Math.round(C.ITEMS[c.crop].sell * 1.7));
      assert.strictEqual(c.k, d * 3 + i);
    });
    assert.deepStrictEqual(plain(cs), plain(L.gmContractsOf(s, d)));
  }
  const needs = new Set();
  for (let d = s.day; d < s.day + 200; d++) L.gmContractsOf(s, d).forEach((c) => needs.add(c.need));
  assert.strictEqual(needs.size, 11, 'every size from 100 to 200 comes up');
  const t = fresh(); t.seed = 12345;
  assert.notDeepStrictEqual(plain(L.gmContractsOf(s, s.day)), plain(L.gmContractsOf(t, t.day)), 'each farm its own');
  // on the board: today's and yesterday's (each runs 48 hours from the start of its day)
  const on = L.gmContracts(s);
  assert.strictEqual(on.length, 6);
  assert.deepStrictEqual(plain(on.map((c) => c.day)), [s.day, s.day, s.day, s.day - 1, s.day - 1, s.day - 1]);
  assert.strictEqual(on[0].mins, 2 * 1440 - 600, 'today\'s: 38 hours left at 10 AM');
  assert.strictEqual(on[3].mins, 1440 - 600, 'yesterday\'s: until midnight');
});

test('deliveries add up (at least 50 a time, or what is left), quality counts as plain, and a finished contract is a Market Star', () => {
  const s = withCart(), c = L.gmContractsOf(s, s.day)[0], id = c.crop;
  const g0 = s.gold;
  s.gm.cargo = { [id]: 30 };
  assert.strictEqual(L.gmDeliver(s, c.k).why, 'min', 'fewer than 50');
  s.gm.cargo = { [id]: 60, [id + '~2']: 40 };
  let r = L.gmDeliver(s, c.k);
  assert.ok(r.ok && !r.done);
  assert.strictEqual(r.n, Math.min(100, c.need));
  assert.strictEqual(r.gold, r.n * c.each, 'Gold ones paid as plain');
  assert.strictEqual(s.gm.cargo[id] || 0, 0, 'the plain ones went first');
  assert.strictEqual(s.gm.con[c.k], r.n);
  const left = c.need - r.n;
  if (left > 0) {
    s.gm.cargo = { [id]: Math.max(left, 1) + 5 };
    if (left < 50) { s.gm.cargo = { [id]: left }; }
    r = L.gmDeliver(s, c.k);
    assert.ok(r.ok && r.done, 'the rest');
    assert.strictEqual(r.n, left, 'never more than it needs');
  } else assert.ok(r.done);
  assert.strictEqual(s.gm.con[c.k], c.need);
  assert.strictEqual(L.gmStars(s), 1, 'a Market Star');
  assert.strictEqual(s.gold, g0 + c.need * c.each);
  assert.strictEqual(L.gmDeliver(s, c.k).why, 'done', 'once');
  assert.strictEqual(L.gmContract(s, c.k).done, true);
  // the last few of a contract may be fewer than 50
  const c2 = L.gmContractsOf(s, s.day)[1];
  s.gm.con[c2.k] = c2.need - 20;
  s.gm.cargo = { [c2.crop]: 20 };
  assert.ok(L.gmDeliver(s, c2.k).done);
  assert.strictEqual(L.gmStars(s), 2);
});

test('the deadline: a contract runs until the end of the next day, then it simply ends (nothing taken, its record let go)', () => {
  const s = withCart(), c = L.gmContractsOf(s, s.day)[2];
  s.gm.cargo = { [c.crop]: 50 };
  L.gmDeliver(s, c.k);
  const gold = s.gold;
  clock.nextDay(L, s);
  assert.ok(L.gmContract(s, c.k), 'still on the board the next day');
  assert.strictEqual(L.gmContract(s, c.k).got, 50);
  clock.nextDay(L, s);
  assert.strictEqual(L.gmContract(s, c.k), null, 'gone after 48 hours');
  assert.strictEqual(s.gm.con[c.k], undefined, 'its record let go');
  assert.strictEqual(L.gmDeliver(s, c.k).why, 'none');
  assert.ok(s.gold >= gold, 'nothing taken back');
  assert.strictEqual(L.gmStars(s), 0);
});

test('contracts ask only for crops this farm can grow now: seeds Lily sells today or it owns, in season, from an open place', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(L.gmGrowable(s)), plain(crops()), 'today Lily sells every farm crop\'s seeds, all year');
  const sells = L.seedsInSeason, inSeason = L.cropInSeason;
  try {
    L.seedsInSeason = () => ['seed_corn', 'seed_tomato', 'seed_grass']; // (a shorter list, as seasons would make it)
    noSeeds(s);
    assert.deepStrictEqual(plain(L.gmGrowable(s)), ['tomato', 'corn'].sort((a, b) => crops().indexOf(a) - crops().indexOf(b)), 'grass is no crop to sell');
    give(s, 'seed_pumpkin', 3);
    assert.ok(L.gmGrowable(s).includes('pumpkin'), 'seeds in the bag count');
    s.store[0] = { id: 'seed_melon', n: 1 };
    assert.ok(L.gmGrowable(s).includes('melon'), 'and in the storage chest');
    L.cropInSeason = (crop) => crop !== 'pumpkin';
    assert.ok(!L.gmGrowable(s).includes('pumpkin'), 'out of season: not even with its seeds');
    L.cropInSeason = inSeason;
    // a seed that belongs to a place counts once that place is open
    C.ITEMS.seed_melon.place = 'makiling';
    try {
      s.wild.n = 0;
      assert.ok(!L.gmGrowable(s).includes('melon'), 'its place is shut');
      s.wild.n = 9999;
      assert.ok(L.gmGrowable(s).includes('melon'), 'its place is open');
    } finally { delete C.ITEMS.seed_melon.place; }
    // the contracts come only from that list, for days not yet looked at
    const t = noSeeds(fresh());
    for (let d = t.day + 1; d < t.day + 60; d++) L.gmContractsOf(t, d).forEach((c) => assert.ok(['corn', 'tomato'].includes(c.crop), c.crop));
  } finally { L.seedsInSeason = sells; L.cropInSeason = inSeason; }
});

test('a list shorter than 3: the same crop again with another amount; and the same answer for the same day, seed and list', () => {
  for (let d = 20000; d < 20200; d++) {
    const one = L.gmPick(['corn'], 11, d);
    assert.strictEqual(one.length, 3);
    assert.ok(one.every((c) => c.crop === 'corn'));
    assert.strictEqual(new Set(one.map((c) => c.need)).size, 3, 'three different amounts');
    one.forEach((c) => assert.ok(c.need >= 100 && c.need <= 200 && c.need % 10 === 0));
    const two = L.gmPick(['corn', 'tomato'], 11, d);
    assert.deepStrictEqual(new Set(two.map((c) => c.crop)).size, 2, 'both crops');
    const pairs = two.map((c) => c.crop + c.need);
    assert.strictEqual(new Set(pairs).size, 3, 'no two the same');
    assert.deepStrictEqual(plain(L.gmPick(['corn', 'tomato'], 11, d)), plain(two));
    assert.deepStrictEqual(plain(L.gmPick(crops(), 11, d).map((c) => c.crop)).length, 3);
    assert.strictEqual(new Set(L.gmPick(crops(), 11, d).map((c) => c.crop)).size, 3, 'a long list: three different crops');
  }
  assert.deepStrictEqual(plain(L.gmPick([], 11, 20000)), [], 'nothing to grow: no contracts');
});

test('a day\'s contracts are kept while they run: buying seeds later that day changes none of them; the save keeps them', () => {
  const sells = L.seedsInSeason;
  try {
    L.seedsInSeason = () => ['seed_corn'];
    const s = noSeeds(fresh()), today = plain(L.gmContracts(s));
    assert.ok(today.every((c) => c.crop === 'corn'));
    L.seedsInSeason = () => ['seed_tomato', 'seed_pumpkin', 'seed_melon'];
    give(s, 'seed_onion', 5);
    assert.deepStrictEqual(plain(L.gmContracts(s)), today, 'the same contracts');
    assert.deepStrictEqual(plain(L.gmContracts(roundTrip(s))), today, 'after a save too');
    clock.nextDay(L, s);
    const next = L.gmContracts(s);
    assert.ok(next.slice(0, 3).every((c) => ['tomato', 'pumpkin', 'melon', 'onion'].includes(c.crop)), 'the new day: the new list');
    assert.deepStrictEqual(plain(next.slice(3).map((c) => c.crop)), ['corn', 'corn', 'corn'], 'yesterday\'s as they were');
    clock.nextDay(L, s);
    assert.deepStrictEqual(Object.keys(s.gm.cs).map(Number).sort(), [s.day - 1], 'a day past its contracts is let go');
  } finally { L.seedsInSeason = sells; }
});

// ---------- the cart ----------
test('the cart: 20,000G, 60 lumber, 10 copper ore and 3 Farm Cement at the Forge; it needs the horse; one a farm', () => {
  assert.deepStrictEqual(plain(G.cart), { cap: 100, gold: 20000, lumber: 60, needs: [['ore_copper', 10], ['farm_cement', 3]] });
  const s = fresh();
  s.horse = null;
  assert.strictEqual(L.gmMakeCart(s), 'horse');
  s.horse = { name: 'Chestnut', love: 0, pet: 0 };
  s.gold = 19999;
  assert.strictEqual(L.gmMakeCart(s), 'gold');
  s.gold = 20500; s.lumber = 59;
  assert.strictEqual(L.gmMakeCart(s), 'lumber');
  s.lumber = 70;
  give(s, 'ore_copper', 10); give(s, 'farm_cement', 2);
  assert.strictEqual(L.gmMakeCart(s), 'needs');
  give(s, 'farm_cement', 1);
  assert.strictEqual(L.gmMakeCart(s), 'ok');
  assert.ok(L.gmHasCart(s));
  assert.deepStrictEqual([s.gold, s.lumber, L.countItem(s, 'ore_copper'), L.countItem(s, 'farm_cement')], [500, 10, 0, 0]);
  assert.strictEqual(L.gmMakeCart(s), 'have', 'one a farm');
  assert.strictEqual(s.gold, 500);
});

test('loading from the Silo and the bag (farm crops only, stars kept), and unloading back: the Silo first, then the bag', () => {
  const s = withCart();
  L.siloPut(s, 'corn', 70);
  give(s, 'tomato', 20);
  const gold = give(s, 'tomato', 5, 2);
  give(s, 'egg', 10);
  assert.strictEqual(L.gmLoadSilo(s, 'corn', 50), 50);
  assert.strictEqual(L.siloHas(s, 'corn'), 20);
  assert.strictEqual(L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === 'tomato' && !x.q), 99), 20);
  assert.strictEqual(L.gmLoadBag(s, gold, 5), 5);
  assert.strictEqual(L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === 'egg'), 10), 0, 'not a farm crop');
  assert.strictEqual(L.gmLoadSilo(s, 'egg', 10), 0);
  assert.deepStrictEqual(plain(s.gm.cargo), { corn: 50, tomato: 20, 'tomato~2': 5 });
  assert.strictEqual(L.countItem(s, 'tomato'), 0);
  assert.strictEqual(L.gmLoad(s), 75);
  // back: plain ones into the Silo, the Gold ones (the Silo keeps no stars) into the bag
  assert.strictEqual(L.gmUnload(s, 'corn'), 50);
  assert.strictEqual(L.siloHas(s, 'corn'), 70);
  assert.strictEqual(L.gmUnload(s, 'tomato~2'), 5);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'tomato' && x.q === 2).reduce((a, x) => a + x.n, 0), 5, 'still Gold');
  // the Silo full: into the bag
  L.siloPut(s, 'potato', L.siloCap(s) - L.siloCount(s));
  assert.strictEqual(L.gmUnload(s, 'tomato', 20), 20);
  assert.strictEqual(L.countItem(s, 'tomato'), 20 + 5);
  assert.strictEqual(L.gmLoad(s), 0);
});

test('never lost: what fits nowhere stays in the cart', () => {
  const s = withCart();
  L.siloPut(s, 'potato', L.siloCap(s));
  for (let i = 0; i < s.inv.length; i++) s.inv[i] = { id: 'stone_block', n: 999 };
  s.gm.cargo = { corn: 40, 'corn~1': 10 };
  assert.strictEqual(L.gmUnload(s, 'corn'), 0);
  assert.strictEqual(L.gmUnloadAll(s), 0);
  assert.deepStrictEqual(plain(s.gm.cargo), { corn: 40, 'corn~1': 10 });
  s.inv[0] = { id: 'corn', n: 990 }; // (room for 9 more corn there)
  assert.strictEqual(L.gmUnload(s, 'corn'), 9);
  assert.deepStrictEqual(plain(s.gm.cargo), { corn: 31, 'corn~1': 10 });
});

test('the cart carries 100 crops, any mix', () => {
  const s = withCart();
  L.siloPut(s, 'corn', 80);
  give(s, 'tomato', 60);
  assert.strictEqual(L.gmLoadSilo(s, 'corn', 80), 80);
  assert.strictEqual(L.gmLoadBag(s, s.inv.findIndex((x) => x && x.id === 'tomato'), 60), 20, 'only 20 more fit');
  assert.strictEqual(L.gmLoad(s), 100);
  assert.strictEqual(L.gmRoom(s), 0);
  assert.strictEqual(L.gmWhyNot(s), 'full');
  assert.strictEqual(L.gmLoadSilo(s, 'corn', 1), 0);
  assert.strictEqual(L.countItem(s, 'tomato'), 40, 'the rest stays in the bag');
});

// ---------- Mang Kardo ----------
test('Mang Kardo: the load sells at the board of the moment he left; the gold 30 minutes later, less his 10%; the cart away meanwhile', () => {
  const s = withCart();
  s.gm.cargo = { corn: 60, 'corn~2': 10, tomato: 20 };
  const now = L.nowMin(), price = L.gmPrice(s.day, 'corn', 0), gp = L.gmPrice(s.day, 'corn', 2), gold = s.gold;
  const q = L.gmSendQuote(s, 'sell');
  assert.strictEqual(q.gold, 60 * price + 10 * gp);
  assert.strictEqual(q.fee, Math.round(q.gold * 0.1));
  assert.strictEqual(q.net, q.gold - q.fee);
  const r = L.gmSend(s, 'sell', now);
  assert.ok(r.ok);
  assert.deepStrictEqual(plain(s.gm.cargo), { tomato: 20 }, 'fewer than 50 tomatoes: they stay in the cart');
  assert.strictEqual(s.gold, gold, 'no gold yet');
  // away: nothing goes in or out, and he cannot go twice
  assert.ok(L.gmAway(s));
  assert.strictEqual(L.gmWhyNot(s), 'away');
  L.siloPut(s, 'corn', 10);
  assert.strictEqual(L.gmLoadSilo(s, 'corn', 10), 0);
  assert.strictEqual(L.gmUnload(s, 'tomato'), 0);
  assert.strictEqual(L.gmSell(s, 'tomato', s.day).why, 'none');
  assert.strictEqual(L.gmSend(s, 'sell', now).why, 'away');
  assert.strictEqual(L.gmLeft(s, now + 12), 18);
  // the board changes at midnight: his prices do not
  assert.strictEqual(L.gmFinish(s, now + 29), null, 'not back yet');
  const back = L.gmFinish(s, now + 30);
  assert.ok(back);
  assert.strictEqual(back.gold, q.gold);
  assert.strictEqual(back.fee, q.fee);
  assert.strictEqual(s.gold, gold + q.net);
  assert.ok(!L.gmAway(s));
  assert.strictEqual(L.gmFinish(s, now + 99), null, 'once');
  assert.strictEqual(L.gmUnload(s, 'tomato'), 20, 'the cart is back');
});

test('Mang Kardo fills a contract: booked as he leaves, its gold (less 10%) and its Market Star when he is back', () => {
  const s = withCart(), c = L.gmContractsOf(s, s.day)[0];
  s.gm.cargo = { [c.crop]: c.need + 7 };
  const now = L.nowMin(), gold = s.gold;
  const r = L.gmSend(s, c.k, now);
  assert.ok(r.ok);
  assert.strictEqual(r.n, c.need, 'what the contract needs, no more');
  assert.strictEqual(s.gm.cargo[c.crop], 7, 'the rest stays in the cart');
  assert.ok(L.gmContract(s, c.k).done, 'booked as he leaves');
  assert.strictEqual(L.gmStars(s), 0);
  const back = L.gmFinish(s, now + 30);
  assert.strictEqual(back.gold, c.need * c.each);
  assert.strictEqual(s.gold, gold + c.need * c.each - Math.round(c.need * c.each * 0.1));
  assert.strictEqual(L.gmStars(s), 1);
  assert.strictEqual(L.gmSend(s, c.k, now).why, 'done');
  assert.strictEqual(L.gmSend(s, 'sell', now).why, 'min');
  s.gm.cargo = {};
  assert.strictEqual(L.gmSend(s, 'sell', now).why, 'empty');
});

test('a trip finishes on a later open: saved on the road, loaded after the 30 minutes, the gold comes in', () => {
  const s = withCart();
  s.gm.cargo = { corn: 100 };
  const now = L.nowMin(), q = L.gmSend(s, 'sell', now);
  clock.advance(5);
  const saved = plain(L.serialize(s)); // (the game is closed 5 minutes later)
  assert.ok(Array.isArray(saved.gm) && Array.isArray(saved.gm[2]), 'the trip is in the save');
  clock.advance(240); // (opened again hours later)
  const b = L.deserialize(saved);
  assert.ok(L.gmAway(b), 'still on the road as it loads');
  const gold = b.gold, r = L.gmFinish(b, L.nowMin());
  assert.ok(r, 'back');
  assert.strictEqual(b.gold, gold + q.net);
  // (and a trip a day later still pays the board of the day he left)
  assert.strictEqual(r.gold, 100 * L.gmPrice(s.day, 'corn', 0));
});

// ---------- the horse ----------
test('L.horseRoadOk: walking the valley road is free as ever; riding it takes 6 hearts and Horseshoes', () => {
  assert.strictEqual(M.horseRoad, true);
  assert.strictEqual(M.horseHearts, 6);
  const s = fresh();
  assert.deepStrictEqual(plain(L.horseRoadOk(s, false)), { ok: true });
  assert.strictEqual(L.manilaRoad(s, false).ok, true, 'on foot: open');
  s.horse.love = 5 * H.loveHeart;
  assert.match(L.horseRoadOk(s, true).why, /Chestnut needs 6 hearts for Manila \(it has 5\)/);
  assert.strictEqual(L.manilaRoad(s, true).ok, false);
  s.horse.love = 6 * H.loveHeart;
  assert.match(L.horseRoadOk(s, true).why, /needs Horseshoes for Manila/);
  s.horse.g = 1 << H.gearOrder.indexOf('horseshoes');
  assert.deepStrictEqual(plain(L.horseRoadOk(s, true)), { ok: true });
  assert.strictEqual(L.manilaRoad(s, true).ok, true);
  s.horse.st = 0;
  assert.match(L.horseRoadOk(s, true).why, /too tired/);
  // the road itself costs the horse nothing (owner, 18 Nov 2026: riding is free)
  assert.strictEqual(L.gmRoadRide, undefined);
});

test('the horse may go into Manila (6 hearts, Horseshoes, as out in the Wild Lands); everywhere else as before', () => {
  assert.strictEqual(L.horseZone('manila'), 'city');
  assert.ok(L.horseOut('manila'));
  assert.strictEqual(L.horseZoneName('city'), 'Manila');
  assert.deepStrictEqual(plain(H.hearts), { farm: 0, town: 3, wild: 6, hunt: 8, cave: 10 }, 'the hearts table unchanged');
  ['farm', 'town', 'park', 'pulag', 'banaue', 'lair', 'house', 'mine', 'mall'].forEach((m) => assert.notStrictEqual(L.horseZone(m), 'city', m));
  assert.strictEqual(L.horseZone('mall'), null, 'never into the Mall');
  const s = fresh();
  s.horse.love = 10 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'manila').why, 'shoes');
  s.horse.g = 1 << H.gearOrder.indexOf('horseshoes');
  assert.ok(L.horseMayGo(s, 'manila').ok);
  assert.ok(L.horseCanRide(s, 'manila').ok);
  s.horse.love = 5 * H.loveHeart;
  assert.strictEqual(L.horseMayGo(s, 'manila').why, 'hearts');
  s.horse.love = 6 * H.loveHeart;
  assert.ok(L.horseMayGo(s, 'pulag').ok && !L.horseMayGo(s, 'banaue').ok, 'the Wild Lands and hunting places as before');
  assert.strictEqual(L.horseRide(s, 'manila', 500), 'ok');
  assert.strictEqual(L.horseStamina(s), H.stamina, 'riding in Manila costs nothing (owner, 18 Nov 2026)');
  // the city switched off: the horse waits outside it, as before
  M.horseRoad = false;
  try { assert.strictEqual(L.horseZone('manila'), null); assert.ok(L.manilaRoad(s, true).ok); } finally { M.horseRoad = true; }
});

// ---------- the save ----------
test('the save: one new key, gm, only when there is something in it; everything comes back', () => {
  const s = fresh();
  assert.strictEqual(L.serialize(s).gm, undefined, 'a farm without a cart writes no gm');
  assert.strictEqual(L.serialize(s).gg, 3, 'save generation 3');
  s.gm.cart = 1;
  s.gm.cargo = { corn: 40, 'corn~1': 3, 'tomato~2': 7, future_crop: 5 };
  const now = L.nowMin();
  s.gm.trip = { at: now - 4, cargo: { pumpkin: 60, 'pumpkin~2': 2 }, pay: { pumpkin: 41, 'pumpkin~2': 90 }, k: -1, st: 0 };
  s.gm.con = { [s.day * 3]: 70, [s.day * 3 + 2]: 120 };
  s.gm.ms = 4;
  s.gm.tour = 3;
  L.gmContracts(s); // (today's and yesterday's contracts, kept while they run)
  assert.deepStrictEqual(Object.keys(s.gm.cs).map(Number).sort(), [s.day - 1, s.day]);
  const o = plain(L.serialize(s));
  assert.ok(Array.isArray(o.gm) && o.gm.length === 7);
  const b = L.deserialize(o);
  assert.deepStrictEqual(plain(b.gm), plain(s.gm));
  assert.deepStrictEqual(plain(L.deserialize(plain(L.serialize(b))).gm), plain(s.gm), 'and again');
  // a contract trip, with its star
  s.gm.trip = { at: now, cargo: { corn: 100 }, pay: { corn: 31 }, k: s.day * 3 + 1, st: 1 };
  assert.deepStrictEqual(plain(roundTrip(s).gm.trip), plain(s.gm.trip));
  assert.ok(JSON.stringify(o.gm).length < 400, 'small: ' + JSON.stringify(o.gm).length + ' bytes');
});

test('old saves load unchanged: no gm (no cart), and their next save writes none', () => {
  const dir = path.join(__dirname, 'old-saves');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 14);
  files.forEach((f) => {
    const { save } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.strictEqual(save.gm, undefined, f + ' had no gm');
    const s = L.deserialize(plain(save));
    assert.deepStrictEqual(plain(s.gm), plain(L.gmNew()), f);
    const again = plain(L.serialize(s));
    assert.strictEqual(again.gm, undefined, f);
  });
  // a broken gm never breaks a load
  [null, 5, 'x', [], [1, 'bad', [1], {}, -3, 'q'], [1, ['corn', 0, -5, 7, 9]]].forEach((bad) => {
    const o = plain(L.serialize(fresh()));
    o.gm = bad;
    const s = L.deserialize(o);
    assert.ok(s && s.gm && typeof s.gm.cargo === 'object');
  });
});

test('the tours: each shows once (a bit each in gm)', () => {
  const s = fresh();
  assert.ok(!L.gmTourSeen(s, 'board'));
  assert.ok(L.gmTourTake(s, 'board'));
  assert.ok(!L.gmTourTake(s, 'board'));
  assert.ok(L.gmTourSeen(s, 'board') && !L.gmTourSeen(s, 'cart'));
  assert.ok(L.gmTourSeen(roundTrip(s), 'board'));
});

test('nothing old changed: the stall, orders, requests and the Silo keep their rules and numbers', () => {
  assert.strictEqual(C.STAND.instant, 0.75);
  assert.strictEqual(C.ORDERS.bonus, 1.5);
  assert.strictEqual(L.basePrice('corn'), C.ITEMS.corn.sell);
  assert.strictEqual(L.instantPrice('corn', 1), Math.floor(C.ITEMS.corn.sell * L.instantShare()));
  assert.strictEqual(L.qualityPrice('corn', 0), C.ITEMS.corn.sell);
});
