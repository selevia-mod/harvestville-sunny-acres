// Unit tests for the farmhands' rules (src/00-zzzzzzz-farmhands.js, src/01-logicZ-farmhands.js): hiring, the daily jobs
// and wage, each job (water, harvest, animals, fruit), time away caught up fairly, the report line and the save.
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
let rain = {}; // day -> true: it rains that day
L.weather = (s, day) => (rain[day] ? 'rain' : 'sunny');

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', 'farm.json'), 'utf8'));
const FARM = L.farmInfo(MAP);
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
// a farm at 10 AM on a spring Wednesday that has earned enough for everyone, with 5,000G
const fresh = (h = 10, mi = 0) => {
  rain = {};
  clock.set(2026, 4, 1, h, mi);
  const s = L.newState();
  s.seed = 11;
  s.yard.items = [];
  s.animals = [];
  s.stats.earned = 1e5;
  s.gold = 5000;
  L.takeNotes();
  L.fhTakeRecent();
  return s;
};
const tick = (s, mins) => { clock.advance(mins); return L.catchUp(s, clock.ms, null); };
const seeds = (s, idxs, crop) => idxs.forEach((i) => { s.soil[i] = { w: 0, c: crop, p: L.nowMin(), r: 0, h: 1 }; }); // planted, dry
const ripe = (s, idx, crop) => { s.soil[idx] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0, h: 1 }; };

test('four farmhands, each with a name, a job, a stand-in face, three levels of jobs and wages; they come once the farm has earned enough', () => {
  assert.deepStrictEqual(plain(C.FH_KEYS), ['andoy', 'lucing', 'berto', 'kiko']);
  const faces = C.SHOPPERS.map((x) => x.key);
  C.FH_KEYS.forEach((k) => {
    const d = C.FARMHANDS[k];
    assert.ok(d.name && d.title && d.look && d.line && d.what, k);
    assert.ok(faces.includes(d.face), k + ' face');
    assert.strictEqual(d.jobs.length, 3);
    assert.strictEqual(d.wage.length, 3);
    for (let i = 1; i < 3; i++) assert.ok(d.jobs[i] > d.jobs[i - 1] && d.wage[i] > d.wage[i - 1], k + ' each level does more, for more');
  });
  assert.ok(C.TIPS.some((t) => t.key === 'farmhands_tour'));
  const s = fresh();
  s.stats.earned = 2999;
  assert.strictEqual(L.fhUnlocked(s, 'andoy'), true);
  assert.strictEqual(L.fhUnlocked(s, 'lucing'), false);
  assert.strictEqual(L.fhHire(s, 'lucing'), 'locked');
  assert.strictEqual(L.fhHire(s, 'andoy'), 'ok');
  assert.strictEqual(L.fhHire(s, 'andoy'), 'already');
  assert.strictEqual(L.fhHire(s, 'nobody'), 'bad');
  assert.strictEqual(L.fhHired(s, 'andoy'), true);
  assert.strictEqual(L.fhAny(s), true);
  assert.strictEqual(L.fhFire(s, 'andoy'), 'ok');
  assert.strictEqual(L.fhFire(s, 'andoy'), 'none');
  assert.strictEqual(L.fhAny(s), false);
});

test('the waterer waters crops waiting for water at the next round (they grow from that minute), up to his jobs a day, for one wage a day', () => {
  const s = fresh(10, 3);
  L.fhHire(s, 'andoy');
  seeds(s, [100, 101, 102], 'potato');
  s.soil[103] = { w: 0, c: null, p: 0, r: 0 }; // tilled, nothing planted: left alone
  tick(s, 5); // 10:08: no round yet
  assert.strictEqual(s.soil[100].w, 0);
  assert.strictEqual(s.gold, 5000);
  tick(s, 2); // 10:10
  assert.deepStrictEqual([100, 101, 102, 103].map((i) => s.soil[i].w), [1, 1, 1, 0]);
  assert.strictEqual(s.soil[100].p, L.fhDayMin(s.day, 10 * 60 + 10), 'grows from the round');
  assert.strictEqual(L.cropStage(s.soil[100]), 0);
  assert.strictEqual(s.gold, 5000 - 60, 'the day\'s wage, at the first job');
  assert.strictEqual(L.fhPaidToday(s, 'andoy'), true);
  assert.strictEqual(L.fhDoneToday(s, 'andoy'), 3);
  const recent = L.fhTakeRecent();
  assert.deepStrictEqual(plain(recent.map((j) => [j.key, j.job, j.idx])), [['andoy', 'water', 100], ['andoy', 'water', 101], ['andoy', 'water', 102]], 'for the farm to show');
  // more seeds later the same day: no second wage; 12 a round at most, 20 a day at Lv 1
  const more = [];
  for (let i = 0; i < 25; i++) more.push(200 + i);
  seeds(s, more, 'potato');
  tick(s, 10);
  assert.strictEqual(L.fhDoneToday(s, 'andoy'), 15);
  tick(s, 10);
  assert.strictEqual(L.fhDoneToday(s, 'andoy'), 20, 'his jobs for the day are done');
  tick(s, 60);
  assert.strictEqual(more.filter((i) => s.soil[i].w).length, 17);
  assert.strictEqual(s.gold, 5000 - 60);
  // the next morning: the rest, and a new wage
  const r = clock.nextDay(L, s, null, 5);
  assert.ok(r.fh && r.fh.andoy.a === 20 && r.fh.andoy.g === 60, 'yesterday, for the report');
  tick(s, 60); // 6:00
  assert.strictEqual(more.filter((i) => s.soil[i].w).length, 25);
  assert.strictEqual(s.gold, 5000 - 120);
  assert.strictEqual(s.fh.hands.andoy.days, 2, 'days worked');
});

test('a day with nothing to do costs nothing; without enough gold they do not work (and say so); out of hours they rest', () => {
  const s = fresh();
  L.fhHire(s, 'andoy');
  tick(s, 120);
  assert.strictEqual(s.gold, 5000, 'nothing to water: no wage');
  s.gold = 59;
  seeds(s, [100], 'turnip');
  tick(s, 30);
  assert.strictEqual(s.soil[100].w, 0);
  assert.strictEqual(s.gold, 59);
  s.gold = 60;
  tick(s, 10);
  assert.strictEqual(s.soil[100].w, 1, 'paid: he works');
  assert.strictEqual(s.gold, 0);
  let lg = L.fhTakeLog(s);
  assert.deepStrictEqual(plain(lg.andoy), { a: 1, b: 0, g: 60, u: 1, nf: 0 });
  assert.match(L.fhReport(lg), /Andoy watered 1 crop\. Wages: 60G\. Andoy did not work: there was not enough gold/);
  // 9 PM to 6 AM: nothing
  clock.set(2026, 4, 1, 21, 5);
  L.catchUp(s, clock.ms, null);
  seeds(s, [101], 'turnip');
  s.gold = 1000;
  tick(s, 60);
  assert.strictEqual(s.soil[101].w, 0, 'gone home');
  clock.nextDay(L, s, null, 5);
  tick(s, 59);
  assert.strictEqual(s.soil[101].w, 0, '5:59');
  tick(s, 1);
  assert.strictEqual(s.soil[101].w, 1, 'the first round, 6:00 AM');
  assert.strictEqual(s.soil[101].p, L.fhDayMin(s.day, 360));
});

test('the harvester picks ripe crops into the basket (not grass, not golden ones, not unripe or withered), dry and empty after', () => {
  const s = fresh();
  L.fhHire(s, 'lucing');
  ripe(s, 10, 'turnip');
  ripe(s, 11, 'potato');
  s.soil[12] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0, h: 1 }; // growing
  s.soil[13] = { w: 1, c: 'turnip', p: L.nowMin() - 1e5, r: 0, h: 1 }; // withered
  ripe(s, 14, 'grass');
  ripe(s, 15, 'turnip');
  const golden = L.goldenTile;
  L.goldenTile = (st, idx) => idx === 15;
  tick(s, 10);
  L.goldenTile = golden;
  assert.deepStrictEqual(plain(s.basket), { turnip: 1, potato: 1 });
  assert.deepStrictEqual(plain(s.soil[10]), { w: 0, c: null, p: 0, r: 0 });
  assert.strictEqual(s.soil[12].c, 'turnip');
  assert.strictEqual(s.soil[13].c, 'turnip', 'withered: for the Hoe');
  assert.strictEqual(s.soil[14].c, 'grass');
  assert.strictEqual(s.soil[15].c, 'turnip', 'golden: left for you');
  assert.strictEqual(s.gold, 5000 - 80);
  assert.match(L.fhReport(L.fhTakeLog(s)), /Lucing picked 2 crops into the basket\. Wages: 80G\./);
  // a crop that grows back is picked like a friend would: it grows again from the round, once watered
  C.CROPS.tomato.regrow = 60;
  try {
    ripe(s, 20, 'tomato');
    tick(s, 10);
    assert.strictEqual(s.basket.tomato, 1);
    assert.deepStrictEqual([s.soil[20].c, s.soil[20].r, s.soil[20].w], ['tomato', 1, 0]);
    assert.strictEqual(L.needsWater(s.soil[20]), true);
  } finally { delete C.CROPS.tomato.regrow; }
});

test('the animal hand puts what they made in the basket and feeds them, from your Storage first, then your bag; no feed is noted', () => {
  const s = fresh();
  ['chicken', 'chicken', 'cow', 'chicken'].forEach((k) => L.addAnimal(s, k));
  s.animals[3].young = 3; // a chick: not fed yet
  s.animals[0].ready = 1;
  s.animals[2].ready = 2;
  s.inv = s.inv.map((x) => (x && C.ITEMS[x.id].kind === 'feed' ? null : x)); // (a new farm starts with some)
  s.store[5] = { id: 'chicken_feed', n: 1 };
  L.addItem(s, 'chicken_feed', 5);
  L.addItem(s, 'fodder', 1);
  L.fhHire(s, 'berto');
  tick(s, 10);
  assert.deepStrictEqual(plain(s.basket), { egg: 1, milk_l: 1 }, 'collected, the cow without a milker');
  assert.deepStrictEqual(s.animals.map((a) => a.fed), [1, 1, 1, 0]);
  assert.strictEqual(s.store[5], null, 'Storage first');
  assert.strictEqual(L.countItem(s, 'chicken_feed'), 4);
  assert.strictEqual(L.countItem(s, 'fodder'), 0);
  assert.strictEqual(s.animals[0].love, C.LOVE.feed);
  assert.strictEqual(L.fhDoneToday(s, 'berto'), 5);
  // overnight they make something; he collects it in the morning and feeds them again, 6 jobs a day at Lv 1
  const r = clock.nextDay(L, s, null, 6);
  assert.ok(r.fh.berto.a === 3 && r.fh.berto.b === 2);
  assert.match(L.fhReport(r.fh), /Berto fed the animals 3 times and put 2 things they made in the basket\. Wages: 60G\./);
  // (the 6:00 round came with the morning) two eggs and the cow's milk in; the cow could not be fed
  assert.strictEqual(L.fhDoneToday(s, 'berto'), 5);
  assert.deepStrictEqual(plain(s.basket), { egg: 3, milk_l: 1, milk: 1 });
  assert.deepStrictEqual(s.animals.map((a) => a.fed), [1, 1, 0, 0]);
  assert.ok(s.fh.hands.berto.nf === s.day, 'no fodder left for the cow');
  assert.match(L.fhReport(L.fhTakeLog(s)), /Berto ran out of animal feed/);
});

test('the fruit picker picks ripe fruit trees into the basket; a tree out of season waits', () => {
  const s = fresh();
  const ix = C.OUTDOOR.index;
  s.gold = 1e6;
  L.buyYard(s, ix.mango_tree, 1);
  L.buyYard(s, ix.apple_tree, 1);
  const m = L.placeYard(s, FARM, ix.mango_tree, 25, 14);
  L.placeYard(s, FARM, ix.apple_tree, 30, 14);
  L.fhHire(s, 'kiko');
  const gold = s.gold;
  tick(s, 20 * 60 + 10); // the mango is ripe at 10 PM, after hours: picked at 6 AM
  assert.deepStrictEqual(plain(s.basket), { mango: 3 });
  assert.strictEqual(L.treeState(s, s.yard.items[m]).ripe, false);
  assert.strictEqual(s.gold, gold - 50);
});

test('time away is caught up round by round, each day before its midnight: rain, growing, picking and wages in order', () => {
  const s = fresh(22, 0); // planted at night, after hours
  L.fhHire(s, 'andoy');
  L.fhHire(s, 'lucing');
  seeds(s, [100, 101], 'turnip');
  seeds(s, [102], 'tulip'); // 2 days
  const day0 = s.day;
  rain[day0 + 2] = true;
  clock.set(2026, 4, 4, 9, 0); // back three days later
  const r = L.catchUp(s, clock.ms, null);
  assert.strictEqual(r.days, 3);
  // day 1: watered at 6:00, ripe at 6:15, picked at 6:20
  assert.strictEqual(s.basket.turnip, 2);
  assert.strictEqual(s.soil[100].c, null);
  // the tulip: watered at 6:00 on day 1, so ripe at 6:00 on day 3, picked then
  assert.strictEqual(s.basket.tulip, 1);
  // wages: Andoy worked day 1 only (day 2 was rain... and nothing waited for water anyway); Lucing day 1 and day 3
  assert.strictEqual(s.fh.hands.andoy.days, 1);
  assert.strictEqual(s.fh.hands.lucing.days, 2);
  assert.strictEqual(s.gold, 5000 - 60 - 80 * 2);
  assert.strictEqual(r.fh.andoy.a, 3);
  assert.strictEqual(r.fh.lucing.a, 2, 'the report is about the days that went by; the tulip was picked this morning');
  assert.strictEqual(L.fhTakeRecent().length, 0, 'nothing from long ago is shown being done');
});

test('rain waters first: on a rainy day the waterer has nothing to do and takes no wage', () => {
  const s = fresh(22, 0);
  L.fhHire(s, 'andoy');
  seeds(s, [100], 'potato');
  rain[s.day + 1] = true;
  clock.nextDay(L, s, null, 12);
  assert.strictEqual(s.soil[100].w, 1);
  assert.strictEqual(s.soil[100].p, L.fhDayMin(s.day, 360), 'the rain at 6 AM');
  assert.strictEqual(s.gold, 5000);
});

test('promotion: after 5 days worked Lv 2 (more jobs, a bigger wage), after 15 Lv 3; letting go keeps what they learned', () => {
  const s = fresh();
  L.fhHire(s, 'andoy');
  assert.strictEqual(L.fhToPromote(s, 'andoy'), 5);
  assert.strictEqual(L.fhPromote(s, 'andoy'), 'days');
  s.fh.hands.andoy.days = 5;
  assert.strictEqual(L.fhPromote(s, 'andoy'), 'ok');
  assert.strictEqual(L.fhLevel(s, 'andoy'), 2);
  assert.strictEqual(L.fhJobs(s, 'andoy'), 45);
  assert.strictEqual(L.fhWage(s, 'andoy'), 140);
  assert.strictEqual(L.fhToPromote(s, 'andoy'), 10);
  s.fh.hands.andoy.days = 15;
  L.fhPromote(s, 'andoy');
  assert.strictEqual(L.fhToPromote(s, 'andoy'), -1);
  assert.strictEqual(L.fhPromote(s, 'andoy'), 'max');
  L.fhFire(s, 'andoy');
  assert.strictEqual(L.fhPromote(s, 'andoy'), 'none');
  L.fhHire(s, 'andoy');
  assert.strictEqual(L.fhLevel(s, 'andoy'), 3, 'back at the level they had');
});

test('the save keeps them (and what they did for the report); old saves load with nobody hired; a broken one is cleaned', () => {
  const s = fresh();
  assert.strictEqual(L.serialize(s).fh, undefined, 'nobody hired: nothing saved');
  L.fhHire(s, 'andoy');
  L.fhHire(s, 'berto');
  L.fhFire(s, 'berto');
  seeds(s, [100], 'potato');
  tick(s, 10);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.fh.hands), plain(s.fh.hands));
  assert.deepStrictEqual(plain(back.fh.log), plain(s.fh.log));
  assert.strictEqual(back.fh.at, s.fh.at);
  assert.ok(JSON.stringify(L.serialize(s).fh).length < 120, 'small');
  // the next round goes on from there (no round done twice)
  tick(s, 0);
  const again = roundTrip(s);
  seeds(again, [101], 'potato');
  clock.advance(10);
  L.catchUp(again, clock.ms, null);
  assert.strictEqual(again.soil[101].w, 1);
  assert.strictEqual(again.gold, 5000 - 60, 'paid once today');
  // a save from before farmhands
  const o = plain(L.serialize(fresh()));
  delete o.fh;
  const old = L.deserialize(o);
  assert.deepStrictEqual(plain(old.fh.hands), {});
  assert.strictEqual(old.fh.at, L.nowMin());
  // broken data
  o.fh = { a: 'x', h: [[9, 1, 1], 'junk', [0, 1, 99, -5, 7, 'n', 1, 0, 0], [0, 1, 1]], l: [[1, -3, 2, 50, 0, 0], [7]] };
  const b = L.deserialize(o);
  assert.deepStrictEqual(plain(b.fh.hands), { andoy: { on: 1, lv: 3, days: 0, d: b.day, n: 0, paid: b.day, np: -1, nf: -1 } });
  assert.deepStrictEqual(plain(b.fh.log), { lucing: { a: 0, b: 2, g: 50, u: 0, nf: 0 } });
  o.fh = 'nope';
  assert.deepStrictEqual(plain(L.deserialize(o).fh.hands), {});
});

test('a long time away: 40 days with everyone hired catches up quickly and charges only the days with work', () => {
  const s = fresh();
  ['andoy', 'lucing', 'berto', 'kiko'].forEach((k) => L.fhHire(s, k));
  for (let i = 0; i < 300; i++) seeds(s, [1000 + i], 'turnip');
  L.addAnimal(s, 'chicken');
  L.addItem(s, 'chicken_feed', 10);
  const t0 = Date.now();
  clock.set(2026, 5, 11, 9, 0);
  const r = L.catchUp(s, clock.ms, null);
  assert.ok(Date.now() - t0 < 3000, 'quick');
  assert.ok(r.fh.andoy.a > 0 && r.fh.lucing.a > 0 && r.fh.berto.a > 0);
  // 300 turnips at 20 a day: 15 days of watering; the chicken fed for 10 days
  assert.strictEqual(s.fh.hands.andoy.days, 15);
  assert.strictEqual(s.fh.hands.berto.days >= 10, true);
  assert.strictEqual(s.fh.hands.kiko.days, 0, 'no trees: never paid');
});

test("Rosa writes when the first farmhand checks in at her inn, then once for each new one (one letter for a farm that earned enough for several)", () => {
  const s = fresh();
  s.stats.earned = 500;
  s.mail = [];
  L.checkMail(s);
  assert.ok(!s.mail.some((k) => /^fh_/.test(k)), 'not yet');
  s.stats.earned = 3500; // Andoy and Lucing at once
  assert.strictEqual(L.checkMail(s), true);
  assert.deepStrictEqual(s.mail.filter((k) => /^fh_/.test(k)), ['fh_inn']);
  assert.match(L.letter('fh_inn').text, /Sunny Inn/);
  L.checkMail(s);
  assert.strictEqual(s.mail.filter((k) => /^fh_/.test(k)).length, 1, 'once');
  s.stats.earned = 6000;
  L.checkMail(s);
  assert.deepStrictEqual(s.mail.filter((k) => /^fh_/.test(k)), ['fh_inn', 'fh_berto']);
  assert.match(L.letter('fh_berto').text, /Berto just checked in at my inn, looking for work as an animal hand/);
  assert.deepStrictEqual(plain(roundTrip(s).sent.filter((k) => /^fh_/.test(k))), ['fh_inn', 'fh_andoy', 'fh_lucing', 'fh_berto'], 'saved');
});

test('the report line: everyone in one sentence with the wages, then any notes; nothing when they did nothing', () => {
  assert.strictEqual(L.fhReport(null), '');
  assert.strictEqual(L.fhReport({ andoy: { a: 0, b: 0, g: 0, u: 0, nf: 0 } }), '');
  assert.strictEqual(L.fhReport({
    andoy: { a: 1, b: 0, g: 60, u: 0, nf: 0 }, lucing: { a: 12, b: 0, g: 80, u: 0, nf: 0 },
    berto: { a: 4, b: 1, g: 60, u: 0, nf: 1 }, kiko: { a: 6, b: 0, g: 0, u: 2, nf: 0 },
  }), 'Your farmhands: Andoy watered 1 crop, Lucing picked 12 crops into the basket, Berto fed the animals 4 times and put 1 thing they made in the basket, ' +
    'Kiko picked 6 fruit into the basket. Wages: 200G. Berto ran out of animal feed. Keep some in your Storage or bag. Kiko did not work: there was not enough gold for the wage.');
});
