// Unit tests for the Town Raid (owner, 6 Nov 2026; src/00-zzzzzzzzzzz-raid.js, src/01-logicZZZZ-raid.js): the schedule
// by Manila time whatever the phone's time zone, the kinds taking turns, the caps (hits per raid, the rate), the chests
// and the bonus day, the crop-loss cap (never on a friend's farm), the save, and reading the server's answers.
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
// a UTC instant for a Manila wall-clock time (UTC+8)
const manila = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi);

test('raids: Monday and Thursday, 8:00 to 8:30 PM Manila time, whatever the phone\'s time zone; a countdown 30 minutes before', () => {
  // Monday 9 Nov 2026, 8:10 PM in Manila: on
  const on = L.raidNow(manila(2026, 11, 9, 20, 10));
  assert.ok(on, 'Monday 8:10 PM Manila');
  assert.strictEqual(on.id, '20261109');
  assert.strictEqual(on.start, manila(2026, 11, 9, 20, 0));
  assert.strictEqual(on.end, manila(2026, 11, 9, 20, 30));
  assert.strictEqual(L.raidNow(manila(2026, 11, 9, 19, 59)), null, 'a minute before');
  assert.strictEqual(L.raidNow(manila(2026, 11, 9, 20, 30)), null, 'over at 8:30');
  assert.ok(L.raidNow(manila(2026, 11, 12, 20, 0)), 'Thursday 8 PM');
  assert.strictEqual(L.raidNow(manila(2026, 11, 11, 20, 10)), null, 'not Wednesday (Double Drops day)');
  assert.strictEqual(L.raidNow(manila(2026, 11, 10, 20, 10)), null, 'not Tuesday');
  // the next one, from a Tuesday: Thursday's
  const next = L.raidNext(manila(2026, 11, 10, 9, 0));
  assert.strictEqual(next.id, '20261112');
  assert.strictEqual(L.raidWhen(next), 'Thursday 8:00 PM');
  // from Thursday night after the raid: next Monday
  assert.strictEqual(L.raidNext(manila(2026, 11, 12, 21, 0)).id, '20261116');
  // the countdown chip: 30 minutes before
  assert.deepStrictEqual(plain(L.raidPhase(manila(2026, 11, 9, 19, 31))).phase, 'soon');
  assert.strictEqual(L.raidPhase(manila(2026, 11, 9, 19, 29)).phase, null, '31 minutes before: not yet');
  assert.strictEqual(L.raidPhase(manila(2026, 11, 9, 19, 31)).left, 29 * 60000);
  assert.strictEqual(L.raidPhase(manila(2026, 11, 9, 20, 5)).phase, 'on');
  assert.strictEqual(L.raidPhase(manila(2026, 11, 9, 20, 5)).left, 25 * 60000);
  // by id (the results after it ended), and no raid on a Tuesday's id
  assert.deepStrictEqual(plain(L.raidById('20261109')), plain(on));
  assert.strictEqual(L.raidById('20261110'), null);
  assert.strictEqual(L.raidById('nope'), null);
  // the game's clock (the app's server time) is what counts
  clock.ms = manila(2026, 11, 9, 20, 10);
  assert.strictEqual(L.raidNow().id, '20261109');
  clock.set(2026, 4, 1, 10, 0);
});

test('raids: the four kinds take turns (boars, crows, sparks, typhoon), the same on every phone', () => {
  let t = manila(2026, 11, 9, 12, 0);
  const kinds = [];
  for (let i = 0; i < 8; i++) {
    const r = L.raidNext(t);
    kinds.push(r.kind);
    t = r.end;
  }
  assert.deepStrictEqual(kinds.slice(0, 4).slice().sort(), ['boar', 'crow', 'spark', 'typhoon'], 'each kind once in four raids');
  assert.deepStrictEqual(kinds.slice(4), kinds.slice(0, 4), 'then round again');
  C.RAID.order.forEach((k) => {
    const d = C.RAID.kinds[k];
    assert.ok(d.name && d.one && d.verb && d.start && d.lost.includes('{crop}') && d.hp >= 1 && d.most >= 1 && d.tools.length, k + ' has its words and numbers');
    assert.ok(C.ITEMS[d.icon] || C.ICON[d.icon] != null, k + ' has an icon');
  });
  const tip = (k) => C.TIPS.findIndex((t) => t.key === k);
  assert.ok(tip('raid_tour') > tip('park_tour') && tip('park_tour') > 0, 'the tour\'s tip is appended after the older ones (its place is its saved bit)');
});

test('raids: hits stop counting at the cap; the server\'s rate; its answers are kept in bounds', () => {
  const s = L.newState();
  const r = L.raidById('20261109');
  let counted = 0;
  for (let i = 0; i < C.RAID.cap + 50; i++) counted += L.raidHit(s, r);
  assert.strictEqual(counted, C.RAID.cap, 'no more than the cap a raid');
  assert.strictEqual(s.raid.h, C.RAID.cap);
  // a new raid starts again from 0
  assert.strictEqual(L.raidHit(s, L.raidById('20261112')), 1);
  assert.strictEqual(s.raid.id, '20261112');
  assert.strictEqual(s.raid.h, 1);
  // the rate the server allows: about 2 a second plus a burst, never past the cap
  assert.strictEqual(L.raidAllowed(r, r.start), C.RAID.burst);
  assert.strictEqual(L.raidAllowed(r, r.start + 60000), 60 * C.RAID.rate + C.RAID.burst);
  assert.strictEqual(L.raidAllowed(r, r.end), C.RAID.cap);
  // the goal grows with the farmers who help
  assert.strictEqual(L.raidGoal(0), C.RAID.minGoal);
  assert.strictEqual(L.raidGoal(3214), 3214 * C.RAID.perDefender);
  assert.strictEqual(L.raidPct(2154, 3214), 67);
  // answers out of bounds are trimmed; junk reads as nothing
  const a = L.raidRead({ ok: true, raid: '20261109', kind: 'crow', on: true, total: -5, goal: 0, defenders: 3, mine: 9999, added: 5000, ends_in: 600 });
  assert.deepStrictEqual([a.id, a.kind, a.total, a.goal, a.mine, a.added, a.endsIn], ['20261109', 'crow', 0, C.RAID.minGoal, C.RAID.cap, C.RAID.batchMost, 600]);
  assert.strictEqual(L.raidRead({ raid: '../x', kind: 'dragon' }).id, '');
  assert.strictEqual(L.raidRead({ raid: '../x', kind: 'dragon' }).kind, '');
  assert.strictEqual(L.raidRead(null), null);
  const c = L.raidClaimRead({ ok: true, won: true, hits: 120, tier: 9 });
  assert.deepStrictEqual([c.ok, c.won, c.hits, c.tier], [true, true, 120, C.RAID.chests.length]);
});

test('raids: chests by hits (the town won: more gold), alone a smaller one; the bonus day is Double Drops until the end of the next day', () => {
  assert.strictEqual(L.raidChest(9), null, 'fewer than 10 hits: no chest');
  assert.strictEqual(L.raidChest(10).name, 'Helper\'s Chest');
  assert.strictEqual(L.raidChest(80).tier, 2);
  assert.strictEqual(L.raidChest(300).tier, 3);
  assert.strictEqual(L.raidChest(80, false, true).gold, Math.round(C.RAID.chests[1].gold * C.RAID.wonGold), 'won: x1.5 gold');
  assert.strictEqual(L.raidChest(20, true, true).gold, C.RAID.alone.chests[0].gold, 'alone: the small chest, no town bonus');
  assert.strictEqual(L.raidChest(40, true).name, 'Farm Guard Chest');
  assert.deepStrictEqual(plain(L.raidAloneResult({ h: 41 })).won, true);
  assert.deepStrictEqual(plain(L.raidAloneResult({ h: 12 })).won, false);
  // into the bag, the rest in the basket; never Coins or Stars
  const s = L.newState();
  const gold = s.gold, stars = s.stars;
  L.raidGive(s, L.raidChest(250, false, true));
  assert.strictEqual(s.gold, gold + Math.round(1500 * 1.5));
  assert.strictEqual(s.stars, stars, 'no Stars from a raid');
  assert.strictEqual(L.countItem(s, 'fert_rich') + (s.basket.fert_rich || 0), 3);
  assert.strictEqual(L.countItem(s, 'sprinkler_copper') + (s.basket.sprinkler_copper || 0), 1);
  C.RAID.chests.concat(C.RAID.alone.chests).forEach((ch) => ch.items.forEach((it) => assert.ok(C.ITEMS[it[0]], it[0] + ' is an item')));
  // the bonus day: a won raid on Monday 9 Nov: Double Drops until Tuesday midnight (Manila)
  const r = L.raidById('20261109');
  assert.strictEqual(L.raidBonusEnd(r), manila(2026, 11, 11, 0, 0));
  const was = L.raidBonus;
  try {
    assert.strictEqual(L.doubleNow(manila(2026, 11, 10, 9, 0)), null, 'a Tuesday: no Double Drops');
    L.raidSetBonus(s, L.raidBonusEnd(r));
    assert.ok(L.doubleNow(manila(2026, 11, 10, 9, 0)), 'the bonus day: Double Drops on Tuesday');
    assert.strictEqual(L.doubleNow(manila(2026, 11, 10, 9, 0)).end, manila(2026, 11, 11, 0, 0));
    assert.strictEqual(L.doubleNow(manila(2026, 11, 11, 0, 1)), null, 'over at midnight');
    assert.ok(L.doubleNow(manila(2026, 11, 11, 12, 30)), 'Wednesday\'s own Double Drops still come');
    assert.strictEqual(roundTrip(s).raid.b, L.raidBonusEnd(r), 'the bonus day is saved');
  } finally { L.raidBonus = was; }
});

test('raids are gentle: at most 2 crop tiles a raid, never withered ones, never on a friend\'s farm; the save keeps it', () => {
  clock.set(2026, 11, 9, 20, 5);
  const s = L.newState(), r = L.raidById('20261109');
  [300, 301, 302, 303].forEach((idx) => { s.soil[idx] = { w: 1, c: 'turnip', p: L.nowMin() - 5, r: 0 }; });
  s.soil[304] = { w: 1, c: 'turnip', p: L.nowMin() - 99999, r: 0 }; // withered long ago
  assert.ok(L.isWithered(s.soil[304]));
  assert.deepStrictEqual(plain(L.raidCrops(s).sort()), [300, 301, 302, 303], 'withered crops are not targets');
  assert.strictEqual(L.raidTrample(s, r, 304), null, 'a withered one is never "lost"');
  assert.strictEqual(L.raidTrample(s, r, 300), 'turnip');
  assert.ok(s.soil[300] && !s.soil[300].c, 'the soil stays tilled');
  assert.strictEqual(L.raidTrample(s, r, 300), null, 'nothing growing there any more');
  assert.strictEqual(L.raidTrample(s, r, 301), 'turnip');
  assert.strictEqual(L.raidTrample(s, r, 302), null, 'the cap: 2 a raid');
  assert.ok(s.soil[302].c && s.soil[303].c);
  assert.strictEqual(L.raidLossOk(s, r), false);
  // saved and loaded, the cap still holds (closing the game does not reset it)
  L.raidHit(s, r);
  s.raid.sv = 1;
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.raid), { id: '20261109', h: 1, sv: 1, l: 2, c: 0, b: 0 });
  assert.strictEqual(L.raidTrample(back, r, 302), null);
  // the next raid may take 2 again
  assert.strictEqual(L.raidTrample(back, L.raidById('20261112'), 302), 'turnip');
  // a friend's farm: never
  const v = L.newState();
  v.isVisit = true;
  v.soil[300] = { w: 1, c: 'turnip', p: L.nowMin() - 5, r: 0 };
  assert.strictEqual(L.raidTrample(v, r, 300), null);
  assert.ok(v.soil[300].c);
  // an older save (no "rai") loads with no raid record
  const old = plain(L.serialize(L.newState()));
  delete old.rai;
  assert.strictEqual(L.deserialize(old).raid, null);
  assert.ok(!('rai' in plain(L.serialize(L.newState()))), 'nothing saved until a raid');
  // junk in the save is trimmed
  const junk = plain(L.serialize(L.newState()));
  junk.rai = ['x', 1e9, -4, 99, 'yes', -1];
  assert.deepStrictEqual(plain(L.deserialize(junk).raid), { id: '', h: C.RAID.cap, sv: 0, l: C.RAID.lossMost, c: 1, b: 0 });
  clock.set(2026, 4, 1, 10, 0);
});
