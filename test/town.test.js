// Unit tests for the bigger Willowbrook: the new villagers, rest days, shops open some days only, animal treats,
// mailing gifts, the chapel, helping at school, Marco's deals, and the save.
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

test('23 villagers: the first 7 keep their places in the order (older saves), the 16 new ones follow', () => {
  assert.deepStrictEqual(plain(C.VILLAGER_ORDER.slice(0, 7)), ['lily', 'hollis', 'bram', 'mira', 'rosa', 'leo', 'ivy']);
  assert.strictEqual(C.VILLAGER_ORDER.length, 23);
  assert.strictEqual(new Set(C.VILLAGER_ORDER).size, 23);
  const candidates = C.VILLAGER_ORDER.filter((k) => C.VILLAGERS[k].candidate);
  assert.strictEqual(candidates.length, 14);
  ['pearl', 'ewan', 'pip', 'daisy', 'tomas', 'hale'].forEach((k) => assert.ok(!C.VILLAGERS[k].candidate, k + ' is not a marriage candidate'));
});

test('every villager has a home building, real places, a birthday in range, and a heart event', () => {
  const places = new Set(['plaza_c', 'plaza_n', 'plaza_e', 'plaza_w', 'plaza_s', 'dock', 'forest', 'away',
    'park_bench', 'park_pond', 'park_easel', 'gazebo', 'playground', 'beach', 'pier', 'market_e', 'market_w', 'wagon',
    'lane', 'lane_garden', 'chapel_yard']);
  C.VILLAGER_ORDER.forEach((k) => {
    const v = C.VILLAGERS[k];
    assert.ok(C.BUILDINGS[v.home], k + ' lives somewhere');
    [].concat(v.schedule, v.rest || []).forEach(([t, at]) => {
      assert.ok(t >= 0 && t < 24 * 60, k);
      if (at.startsWith('in:')) assert.ok(C.BUILDINGS[at.slice(3)], k + ': ' + at);
      else assert.ok(places.has(at), k + ': ' + at);
    });
    assert.ok(v.birthday[1] >= 1 && v.birthday[1] <= C.DAYS_PER_SEASON, k);
    assert.ok(C.HEART_EVENTS[k] && C.HEART_EVENTS[k].length >= (v.candidate ? 3 : 1), k + ' heart events');
  });
});

test('no two villagers share a birthday, and none falls on a festival', () => {
  const seen = {};
  C.VILLAGER_ORDER.forEach((k) => {
    const b = C.VILLAGERS[k].birthday.join(' ');
    assert.ok(!seen[b], k + ' and ' + seen[b] + ' share ' + b);
    seen[b] = k;
    assert.ok(!C.FESTIVALS.some((f) => f.season === C.VILLAGERS[k].birthday[0] && f.day === C.VILLAGERS[k].birthday[1]), k);
  });
});

test('the children go to school on weekdays and play on rest days; the school is shut on rest days', () => {
  const s = fresh();
  s.day = 1; // weekday 1
  assert.strictEqual(L.weekday(1), 1);
  assert.ok(!L.restDay(1));
  assert.strictEqual(L.villagerAt(s, 'pip', 10 * 60), 'in:school');
  s.time = 10 * 60;
  assert.ok(L.buildingOpen(s, 'school'));
  s.day = 6;
  assert.ok(L.restDay(6));
  assert.strictEqual(L.villagerAt(s, 'pip', 10 * 60), 'playground');
  assert.ok(!L.buildingOpen(s, 'school'));
  assert.ok(L.buildingOpen(s, 'bakery'), 'the bakery opens every day');
});

test('the new goods: bakery food has energy, the bouquet is a loved gift, and none of them sells', () => {
  ['bread', 'cookie', 'cake'].forEach((id) => assert.ok(C.ITEMS[id].energy > 0 && C.ITEMS[id].price > 0));
  ['bread', 'cookie', 'cake', 'bouquet', 'treat'].forEach((id) => {
    assert.ok(!C.ITEMS[id].sell, id);
    assert.strictEqual(typeof C.ITEMS[id].icon, 'number');
  });
  assert.ok(L.giftable('bouquet'));
  assert.ok(C.VILLAGER_ORDER.filter((k) => C.VILLAGERS[k].loves.includes('bouquet')).length >= 5);
  C.BAKERY_MENU.concat(C.SHACK_MENU, C.FLORIST_STOCK, C.VET_STOCK).forEach((id) => assert.ok(C.ITEMS[id].price > 0, id));
});

test('an animal treat: once a day per animal, more love, gone at night', () => {
  const s = fresh();
  L.addItem(s, 'treat', 2);
  const a = s.animals[0], love = a.love;
  assert.strictEqual(L.giveTreat(s, 0, slotOf(s, 'treat')), 'ok');
  assert.strictEqual(a.love, love + C.TREAT_LOVE);
  assert.strictEqual(L.giveTreat(s, 0, slotOf(s, 'treat')), 'already');
  assert.strictEqual(L.countItem(s, 'treat'), 1);
  assert.strictEqual(roundTrip(s).animals[0].treat, 1, 'saved');
  L.endDay(s, false);
  assert.strictEqual(L.giveTreat(s, 0, slotOf(s, 'treat')), 'ok');
});

test('mailing a gift costs a fee and gives part of the friendship', () => {
  const s = fresh(), t = fresh();
  [s, t].forEach((x) => { L.friend(x, 'hana').met = 1; L.addItem(x, 'strawberry', 1); });
  const gold = s.gold;
  assert.deepStrictEqual(plain(L.mailGift(s, 'pip', slotOf(s, 'strawberry'))), { error: 'who' }, 'only to people you know');
  const r = L.mailGift(s, 'hana', slotOf(s, 'strawberry'));
  assert.strictEqual(r.reaction, 'love');
  assert.strictEqual(s.gold, gold - C.POST_FEE);
  const direct = L.giveGift(t, 'hana', slotOf(t, 'strawberry'));
  assert.strictEqual(L.friend(s, 'hana').pts, Math.round(direct.pts * C.POST_SHARE));
  L.addItem(s, 'egg', 1);
  assert.deepStrictEqual(plain(L.mailGift(s, 'hana', slotOf(s, 'egg'))), { error: 'gifted' }, 'one gift a day, by hand or by mail');
});

test('the chapel restores a little energy once a day; helping at school befriends the class', () => {
  const s = fresh();
  s.energy = 50;
  s.time = 10 * 60;
  assert.strictEqual(L.chapelRest(s), C.CHAPEL_REST.energy);
  assert.strictEqual(s.energy, 50 + C.CHAPEL_REST.energy);
  assert.strictEqual(s.time, 10 * 60 + C.CHAPEL_REST.minutes);
  assert.strictEqual(L.chapelRest(s), 0);
  assert.strictEqual(roundTrip(s).chapelDay, s.day);
  s.day = 2;
  s.time = 9 * 60;
  assert.strictEqual(L.helpSchool(s), 'ok');
  ['clara', 'pip', 'daisy'].forEach((k) => assert.strictEqual(L.friend(s, k).pts, C.SCHOOL_HELP.pts, k));
  assert.strictEqual(L.helpSchool(s), 'already');
  s.day = 7;
  assert.strictEqual(L.helpSchool(s), 'closed');
});

test("Marco's wagon: 4 discounted pieces a day, different each day, into storage", () => {
  const s = fresh();
  s.gold = 1e6;
  s.time = 10 * 60;
  const deals = L.wagonDeals(s);
  assert.strictEqual(deals.length, C.WAGON.deals);
  deals.forEach((d) => {
    assert.ok(d.v >= 1 && d.price < L.furnPrice(d.t, d.v));
    assert.ok(!C.HOME.types[d.t].needs);
  });
  assert.deepStrictEqual(plain(L.wagonDeals(s)), plain(deals), 'the same all day');
  s.day = 2;
  assert.notDeepStrictEqual(plain(L.wagonDeals(s)), plain(deals), 'new ones tomorrow');
  const d = L.wagonDeals(s)[0];
  assert.strictEqual(L.buyDeal(s, 0), 'ok');
  assert.strictEqual(s.home.bag[L.furnKey(d.t, d.v)], 1);
  assert.strictEqual(s.gold, 1e6 - d.price);
  s.time = 20 * 60;
  assert.strictEqual(L.buyDeal(s, 0), 'closed');
});

test('the save stays small with all 23 villagers befriended', () => {
  const s = fresh();
  C.VILLAGER_ORDER.forEach((k) => { s.friends[k] = { pts: 100, talked: 1, gifted: 1, met: 1, ev: 3 }; });
  const back = roundTrip(s);
  assert.strictEqual(back.friends.jules.pts, 100);
  assert.ok(JSON.stringify(L.serialize(s)).length < C.MAX_SAVE_BYTES);
});
