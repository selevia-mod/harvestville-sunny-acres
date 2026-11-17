// Unit tests for The Manila Cup and Race Day (src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-cup.js,
// src/01-logicZZZZZZZZZZZZZZZZZZZZZZZZ-manila-cup.js) and the server file's numbers (supabase/farm_manila_cup.sql: written,
// not applied).
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
const MC = C.MANILA_CUP, RD = C.RACE_DAY;
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_manila_cup.sql'), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const manila = (y, mo, d, h = 10, mi = 0, sec = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, sec);
const ID = '0f8b2c4e-1d2a-4b3c-9d4e-5f6a7b8c9d0e';
// a farmer with a horse of 6 hearts and Horseshoes, in Manila's week of Monday 16 Nov 2026
const fresh = () => {
  clock.ms = manila(2026, 11, 18, 10);
  const s = L.newState();
  s.horse = { name: 'Chestnut', love: 60, pet: 0, g: 1 << C.HORSE_OUT.gearOrder.indexOf('horseshoes') };
  s.gold = 100000;
  return s;
};
const V = C.SPEED * C.HORSE.speed / C.TILE; // tiles a second, riding
// Rides the centre line from the start for `ms` (or until done): at the speed the ride says (sprint held when `sprint`),
// jumping `jumpAt` tiles before each hurdle (null: never)
const ride = (t, { sprint = false, jumpAt = null, dt = 16, ms = 120000, onEv } = {}) => {
  const st = L.mcStart();
  let d = L.mcProj(st.x, st.y).s - L.mcLen(), mult = 1;
  const H = L.mcHurdles().map((h) => h.s), LEN = L.mcLen();
  for (let k = 0; k * dt < ms && !t.done; k++) {
    const p = L.mcPoint(d, 0), lapD = ((d % LEN) + LEN) % LEN;
    const jump = jumpAt != null && H.some((hs) => lapD < hs && hs - lapD <= jumpAt);
    const r = L.mcTrialStep(t, dt, p.x, p.y, sprint, jump);
    if (onEv) r.ev.forEach((e) => onEv(e, t));
    mult = r.mult;
    d += V * mult * dt / 1000;
  }
  return t;
};

test('the cup\'s week: Monday 8 AM to Sunday 7 PM, Manila time (results at the close)', () => {
  const w = L.mcWeek(manila(2026, 11, 18, 10));
  assert.strictEqual(w.key, '2026-11-16', 'the Monday');
  assert.strictEqual(w.open, manila(2026, 11, 16, 8));
  assert.strictEqual(w.close, manila(2026, 11, 22, 19));
  assert.strictEqual(w.on, true);
  assert.strictEqual(L.mcWeek(manila(2026, 11, 16, 7, 59)).on, false, 'Monday before 8 AM: closed');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 16, 8, 0)).on, true);
  assert.strictEqual(L.mcWeek(manila(2026, 11, 22, 18, 59)).on, true, 'Sunday 6:59 PM: open');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 22, 19, 0)).on, false, 'Sunday 7 PM: closed, the results are out');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 22, 19, 0)).done, w.day, 'this week is done');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 22, 18, 0)).done, w.day - 7, 'before the close: last week is the done one');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 23, 9)).key, '2026-11-23', 'a new week on Monday');
  assert.strictEqual(L.mcWeek(manila(2026, 11, 16, 0, 30)).key, '2026-11-16', 'Manila time, not the phone\'s (UTC: still Sunday)');
});

test('the track: the centre line round the oval, the arch at its start, six hurdles on the two straights', () => {
  const LEN = L.mcLen();
  assert.ok(LEN > 80 && LEN < 90, 'about 84 tiles a lap: ' + LEN);
  for (let s = 0; s < LEN; s += 0.7) {
    const p = L.mcPoint(s, 0), q = L.mcProj(p.x, p.y);
    assert.ok(Math.abs(q.s - s) < 1e-6 && Math.abs(q.off) < 1e-6, 'a point of the line is where it is: ' + s);
    assert.ok(L.mcOnTrack(p.x, p.y), 'the centre line is on the track: ' + s);
  }
  const H = L.mcHurdles();
  assert.strictEqual(H.length, 6);
  H.forEach((h) => { assert.ok(L.mcOnTrack(h.x + 0.5, h.y + 0.5) && L.mcOnTrack(h.x + 1.5, h.y + 0.5), 'across the track'); assert.ok(h.s > 3 && h.s < LEN - 3); });
  assert.ok(!L.mcOnTrack(12, 75), 'the grass inside is not the track');
  const arch = C.MANILA.decor.filter((d) => d[0] === 'race_arch')[0];
  assert.deepStrictEqual(plain(arch.slice(1, 5)), plain(MC.arch));
  assert.deepStrictEqual(plain(C.MANILA.pass.race_arch), [1, 2], 'its opening is the track (2 tiles), its posts either side');
  assert.ok(L.mcOnTrack(arch[1] + 1.5, arch[2] + 1) && L.mcOnTrack(arch[1] + 2.5, arch[2] + 1) && !L.mcOnTrack(arch[1] + 0.5, arch[2] + 1));
});

test('the sprint bar: drains while sprinting, full again at the start of each lap, and never touches the horse\'s stamina', () => {
  const s = fresh();
  s.horse.st = 55;
  const before = plain(s.horse), t = L.mcTrialNew(), bars = [];
  let lowest = 1;
  ride(t, { sprint: true, jumpAt: 1.5, onEv: (e, tt) => { if (e === 'lap') bars.push(tt.bar); } });
  ride(L.mcTrialNew(), { sprint: true, ms: 2500, onEv: () => {} });
  const t2 = L.mcTrialNew();
  ride(t2, { sprint: true, ms: 2000 });
  lowest = t2.bar;
  assert.ok(lowest < 0.4 && lowest > 0.3, 'about 2 of its 3 seconds used: ' + lowest);
  const t3 = L.mcTrialNew();
  ride(t3, { sprint: true, ms: 5000 });
  assert.strictEqual(t3.bar, 0, 'empty after 3 s');
  assert.strictEqual(t3.sprinting, false, 'an empty bar does not sprint');
  assert.deepStrictEqual(bars, [1, 1, 1], 'full at the start of every lap');
  assert.strictEqual(t.done, true);
  assert.deepStrictEqual(plain(s.horse), before, 'the horse is exactly as it was');
  assert.strictEqual(L.horseStamina(s), 55);
  const st = L.mcTrialNew();
  assert.strictEqual(L.mcTrialStep(st, 16, 4, 67.7, true, false).mult, MC.sprint.mult, 'sprinting is faster');
  assert.strictEqual(L.mcTrialStep(st, 16, 4, 67.7, false, false).mult, 1);
  assert.strictEqual(L.mcTrialStep(st, 16, 12, 75, false, false).mult, MC.off, 'off the track: slower');
});

test('jumps, knocked hurdles (1.5 s each) and lap times', () => {
  const clean = ride(L.mcTrialNew(), { jumpAt: 1.5 });
  assert.strictEqual(clean.done, true);
  assert.strictEqual(clean.knocks, 0, 'every hurdle cleared');
  assert.strictEqual(clean.laps.length, 3);
  const lap = L.mcLen() / V * 1000;
  assert.ok(Math.abs(clean.laps[1] - lap) < 40 && Math.abs(clean.laps[2] - lap) < 40, 'a lap takes its length at riding speed: ' + clean.laps + ' ~ ' + lap.toFixed(0));
  assert.ok(clean.laps[0] > clean.laps[1], 'the first from a little before the line');
  assert.strictEqual(clean.total, L.mcTotal(clean.laps, 0));
  const evs = [];
  const knocked = ride(L.mcTrialNew(), { onEv: (e) => evs.push(e) });
  assert.strictEqual(knocked.knocks, 18, 'never jumping: every hurdle knocked, 6 a lap');
  assert.strictEqual(knocked.total, knocked.laps.reduce((a, b) => a + b, 0) + 18 * 1500);
  assert.strictEqual(evs.filter((e) => e === 'knock').length, 18);
  assert.strictEqual(evs.filter((e) => e === 'lap').length, 3);
  assert.strictEqual(evs[evs.length - 1], 'finish');
  // a jump: in the air 0.6 s, then a moment before the next
  const t = L.mcTrialNew();
  L.mcTrialStep(t, 16, 4, 67.7, false, false);
  assert.deepStrictEqual(plain(L.mcTrialStep(t, 16, 4, 67.6, false, true).ev), ['jump']);
  assert.deepStrictEqual(plain(L.mcTrialStep(t, 300, 4, 67.5, false, true).ev), [], 'no jump in the air');
  assert.deepStrictEqual(plain(L.mcTrialStep(t, 200, 4, 67.4, false, true).ev), ['land'], 'down after 0.45 s');
  assert.deepStrictEqual(plain(L.mcTrialStep(t, 50, 4, 67.3, false, true).ev), [], 'a moment after landing');
  assert.deepStrictEqual(plain(L.mcTrialStep(t, 60, 4, 67.2, false, true).ev), ['jump']);
  assert.deepStrictEqual([MC.jump.ms, MC.jump.gap], [450, 100]);
  const gaps = L.mcHurdles().map((h) => h.s).map((x, i, a) => (i ? x - a[i - 1] : x));
  assert.ok(gaps.slice(1).every((g) => g >= 6.9), 'hurdles at least 7 tiles apart: one can be taken after another at a sprint ' + gaps);
  assert.ok((MC.jump.ms + MC.jump.gap) / 1000 * V * MC.sprint.mult < 6.9);
  // cutting across the grass inside counts for nothing
  const cut = L.mcTrialNew();
  L.mcTrialStep(cut, 16, 4, 75, false, false);
  L.mcTrialStep(cut, 16, 23, 75, false, false);
  assert.ok(Math.abs(cut.d - L.mcProj(4, 75).s + L.mcLen()) < 1e-6 || cut.d < 1, 'no progress from a jump across: ' + cut.d);
});

test('the perfect-ride floor: no lap under 95% of the fastest lap the track allows, here and on the server', () => {
  const p = L.mcPerfect();
  assert.deepStrictEqual(plain(p), { lap: 8996, total: 26988, floor: 8546 });
  const sprinted = ride(L.mcTrialNew(), { sprint: true, jumpAt: 1.5 });
  assert.ok(sprinted.laps.every((x) => x > p.lap), 'riding the middle of the track, sprinting: slower than perfect ' + sprinted.laps);
  assert.ok(L.mcValid(sprinted.laps, 0));
  assert.ok(!L.mcValid([8500, 9000, 9000], 0), 'a lap under the floor');
  assert.ok(!L.mcValid([9000, 9000], 0), 'two laps');
  assert.ok(!L.mcValid([9000, 9000, 9000.5], 0), 'whole ms only');
  const s = fresh();
  assert.deepStrictEqual(plain(L.mcFinish(s, { done: true, laps: [8000, 9000, 9000], knocks: 0 }, clock.ms)), { ok: false, why: 'fast' });
  assert.strictEqual(s.mc.wr, 0, 'not counted');
  assert.match(SQL, /'perfect_lap_ms', 8996\b/);
  assert.match(SQL, /'floor_lap_ms', 8546\b/);
  assert.match(SQL, /'knock_ms', 1500\b/);
  assert.match(SQL, /'laps', 3\b/);
  assert.match(SQL, /'open_min', 480\b/);
  assert.match(SQL, /'close_min', 1140\b/);
  assert.match(SQL, new RegExp("'prizes', jsonb_build_array\\(" + MC.prizes.join(', ') + '\\)'));
  assert.match(SQL, /'title', 'Manila Cup Champion'/);
});

test('the SQL file: additive, safe twice, security definer with an empty search_path, players only, not applied, the undo at the bottom', () => {
  assert.match(SQL, /NOT APPLIED: the owner applies it/);
  assert.match(SQL, /set local lock_timeout = '5s';/);
  assert.match(SQL, /notify pgrst, 'reload schema';/);
  assert.ok(!/\bdrop (table|function)\b(?![^\n]*--)/.test(SQL.split('-- ---------- to undo')[0].replace(/^--.*$/gm, '')), 'nothing dropped above the undo');
  ['farm_mcup_run_v1', 'farm_mcup_board_v1', 'farm_mcup_prize_v1'].forEach((f) => {
    assert.match(SQL, new RegExp('create or replace function public\\.' + f + '\\([^)]*\\)\\s*returns jsonb language plpgsql (stable )?security definer set search_path = \'\''));
    assert.match(SQL, new RegExp('grant execute on function[^;]*public\\.' + f));
  });
  ['mcup_config', 'mcup_weeks', 'mcup_requests', 'mcup_claims'].forEach((t) => {
    assert.match(SQL, new RegExp('create table if not exists farm\\.' + t + ' '));
    assert.match(SQL, new RegExp('alter table farm\\.' + t + ' enable row level security'));
  });
  assert.match(SQL, /revoke all on table farm\.mcup_weeks, farm\.mcup_requests, farm\.mcup_claims from public, anon, authenticated/);
  assert.match(SQL, /to authenticated;/);
  assert.ok(!/to anon/.test(SQL), 'never to anon');
  assert.match(SQL, /cannot be bought with real money and cannot be traded between players/);
});

test('tries: the first of a Manila day is free, then 2,000 Gold each; closed outside the week; the horse rule', () => {
  const s = fresh();
  assert.strictEqual(L.mcTryCost(s, clock.ms), 0);
  assert.deepStrictEqual(plain(L.mcBeginTry(s, clock.ms)), { ok: true, cost: 0, week: L.mcWeek(clock.ms).day });
  assert.strictEqual(s.gold, 100000, 'free');
  assert.strictEqual(L.mcTryCost(s, clock.ms), 2000);
  assert.strictEqual(L.mcBeginTry(s, clock.ms).cost, 2000);
  assert.strictEqual(s.gold, 98000);
  assert.strictEqual(L.mcTryCost(s, manila(2026, 11, 18, 23, 59)), 2000, 'still today in Manila');
  assert.strictEqual(L.mcTryCost(s, manila(2026, 11, 19, 0, 1)), 0, 'a new Manila day: free again');
  s.gold = 1999;
  assert.deepStrictEqual(plain(L.mcCanTry(s, clock.ms)), { why: 'gold', cost: 2000 });
  assert.strictEqual(L.mcCanTry(s, manila(2026, 11, 22, 20)).why, 'closed', 'Sunday evening: closed');
  const t = fresh();
  t.horse.love = 50;
  assert.strictEqual(L.mcCanTry(t, clock.ms).why, 'horse');
  assert.match(L.mcCanTry(t, clock.ms).words, /needs 6 hearts/);
  t.horse.love = 60; t.horse.g = 0;
  assert.match(L.mcCanTry(t, clock.ms).words, /Horseshoes/);
  delete t.horse;
  assert.strictEqual(L.mcCanTry(t, clock.ms).why, 'horse');
});

test('the week\'s best, the run count, the 3-runs reward (3,000 Gold and 3 oats, once), and the best sent once', () => {
  const s = fresh();
  const finish = (laps, k) => L.mcFinish(s, { done: true, laps, knocks: k }, clock.ms);
  assert.deepStrictEqual(plain(finish([11000, 10500, 10400], 2)), { ok: true, ms: 34900, best: true, runs: 1 });
  const q = L.mcToSend(s);
  assert.deepStrictEqual(plain({ week: q.week, laps: q.laps, knocks: q.knocks }), { week: '2026-11-16', laps: [11000, 10500, 10400], knocks: 2 });
  assert.strictEqual(finish([12000, 12000, 12000], 0).best, false);
  assert.strictEqual(L.mcToSend(s).id, q.id, 'the best still waits, the same send');
  assert.strictEqual(finish([10000, 10000, 10000], 1).best, true);
  assert.notStrictEqual(L.mcToSend(s).id, q.id, 'a new best: a new send');
  assert.strictEqual(L.mcSent(s, 'other', true), false);
  assert.strictEqual(L.mcSent(s, L.mcToSend(s).id, true), true);
  assert.strictEqual(L.mcToSend(s), null);
  assert.strictEqual(s.mc.wb, 31500);
  assert.strictEqual(s.mc.wr, 3);
  const gold = s.gold;
  assert.strictEqual(L.mcWeekly(s, manila(2026, 11, 22, 18)), null, 'not before the results');
  assert.deepStrictEqual(plain(L.mcWeekly(s, manila(2026, 11, 22, 19, 1))), { gold: 3000, oats: 3, runs: 3 });
  assert.strictEqual(s.gold, gold + 3000);
  assert.strictEqual(s.inv.filter((x) => x && x.id === 'oats').reduce((a, x) => a + x.n, 0), 3);
  assert.strictEqual(L.mcWeekly(s, manila(2026, 11, 23, 9)), null, 'paid once');
  assert.deepStrictEqual([s.mc.wr, s.mc.wb], [0, 0], 'a new week starts over');
  // two runs: nothing; a week skipped over: paid on the next open, once
  const t = fresh();
  L.mcFinish(t, { done: true, laps: [11000, 11000, 11000], knocks: 0 }, clock.ms);
  L.mcFinish(t, { done: true, laps: [11000, 11000, 11000], knocks: 0 }, clock.ms);
  assert.strictEqual(L.mcWeekly(t, manila(2026, 11, 30, 9)), null, 'two runs: no reward');
  const u = fresh();
  for (let i = 0; i < 3; i++) L.mcFinish(u, { done: true, laps: [11000, 11000, 11000], knocks: 0 }, clock.ms);
  const back = roundTrip(u);
  assert.strictEqual(L.mcWeekly(back, manila(2026, 12, 7, 9)).gold, 3000, 'two weeks later, after a reload: paid');
  assert.strictEqual(L.mcToSend(back), null, 'a best from a week gone is not sent');
});

test('the board\'s prizes by place: Gold, the cups and the ribbon into storage, each claim paid once', () => {
  const s = fresh(), H = C.HOME;
  const claim = (rank, id) => ({ ok: true, id: id || ID, week: '2026-11-16', rank, ms: 31000 });
  const expect = [[1, 150000, 'mc_cup_gold'], [2, 80000, 'mc_cup_silver'], [3, 50000, 'mc_cup_bronze'], [4, 20000, 'mc_ribbon'], [10, 20000, 'mc_ribbon']];
  expect.forEach(([rank, gold, piece], i) => {
    const t = fresh(), g = t.gold;
    const r = L.mcPrizePay(t, claim(rank, ID.slice(0, -1) + i));
    assert.strictEqual(r.gold, gold, 'place ' + rank);
    assert.strictEqual(r.piece, piece);
    assert.strictEqual(t.gold, g + gold);
    assert.strictEqual(t.home.bag[L.furnKey(H.typeIndex[piece], 0)], 1, 'the ' + piece + ' in storage');
    assert.strictEqual(r.title, rank === 1);
  });
  assert.ok(L.mcPrizePay(s, claim(1)));
  assert.strictEqual(L.mcPrizePay(s, claim(1)), null, 'the same claim: never twice');
  assert.strictEqual(L.mcPrizePay(roundTrip(s), claim(1)), null, 'nor after a reload');
  assert.strictEqual(L.mcPrizePay(s, claim(11, ID.replace('0f', '1f'))), null, 'no prize past 10th');
  assert.strictEqual(L.mcPrizePay(s, { ok: true, id: 'nope', rank: 1 }), null);
  assert.strictEqual(L.mcPrizePay(s, { ok: false, code: 'none' }), null);
  // the cups are house trophies: placed and saved like any piece
  const t = fresh();
  t.home.level = H.levels.length;
  const cup = H.typeIndex.mc_cup_gold, at = L.findSpot(t, cup, 3, 4, null);
  t.home.bag[L.furnKey(cup, 0)] = 1;
  assert.ok(at);
  L.placeFurn(t, cup, 0, at.x, at.y, 0);
  assert.ok(roundTrip(t).home.items.some((it) => it.t === cup), 'the Gold Horseshoe Cup in the house after a reload');
  ['mc_cup_gold', 'mc_cup_silver', 'mc_cup_bronze', 'mc_ribbon'].forEach((k) => assert.ok(H.types[H.typeIndex[k]].trophy, k + ': never in the shop'));
});

test('Race Day: the races, their fields and odds come from the race number alone; the result only once it has started', () => {
  const n = L.rdNext(manila(2026, 11, 18, 10, 3));
  assert.strictEqual(L.rdStart(n), manila(2026, 11, 18, 10, 10), 'the next race at 10:10');
  assert.strictEqual(L.rdNext(manila(2026, 11, 18, 10, 9, 29)), n);
  assert.strictEqual(L.rdNext(manila(2026, 11, 18, 10, 9, 30)), n + 1, 'its bets close 30 s before the start');
  assert.strictEqual(L.rdStart(L.rdNext(manila(2026, 11, 18, 22, 0))), manila(2026, 11, 19, 6, 0), 'none after 9:50 PM: the next at 6 AM');
  assert.strictEqual(L.rdStart(L.rdNext(manila(2026, 11, 18, 3, 0))), manila(2026, 11, 18, 6, 0));
  assert.strictEqual(RD.perDay, 96);
  assert.strictEqual(L.rdRunning(manila(2026, 11, 18, 10, 10, 5)), n);
  assert.strictEqual(L.rdRunning(manila(2026, 11, 18, 10, 9, 50)), -1, 'not started yet');
  const a = L.rdRace(n), b = L.rdRace(n);
  assert.deepStrictEqual(plain(a), plain(b), 'the same on every phone');
  assert.strictEqual(new Set(a.horses.map((h) => h.name)).size, 6);
  a.horses.forEach((h) => { assert.ok(h.odds >= 1.6 && h.odds <= 9, h.odds); assert.ok(h.form >= 1 && h.form <= 5); assert.ok(RD.horses.some((x) => x[0] === h.name && x[1] === h.silk)); });
  assert.ok(!('order' in a) && !('times' in a) && !JSON.stringify(a).includes('winner'), 'the field says nothing of the result');
  assert.strictEqual(L.rdResult(n, L.rdStart(n) - 1), null, 'never before the start');
  const r = L.rdResult(n, L.rdStart(n));
  assert.deepStrictEqual(plain(r), plain(L.rdResult(n, L.rdStart(n) + 999999)), 'the same whenever it is asked');
  assert.deepStrictEqual(plain(r.order.slice().sort()), [0, 1, 2, 3, 4, 5]);
  const first = r.times[r.order[0]];
  assert.ok(first >= RD.run[0] && first <= RD.run[1], 'the winner in 24-27 s');
  r.order.slice(1).forEach((j, k) => assert.ok(r.times[j] > r.times[r.order[k]], 'in order'));
  // they run: always forward, the winner over the line first
  let last = L.rdAlong(n, r, 0);
  for (let t = 0.25; t < 32; t += 0.25) {
    const now = L.rdAlong(n, r, t);
    now.forEach((x, j) => assert.ok(x >= last[j] - 1e-9, 'forward'));
    last = now;
  }
  const D = RD.laps * L.mcLen();
  assert.ok(L.rdAlong(n, r, first)[r.order[0]] >= D - 1e-6 && L.rdAlong(n, r, first - 0.01).every((x) => x < D), 'the winner reaches the line first');
  // the races vary: different fields, favourites and winners
  const wins = new Set(), fields = new Set();
  for (let k = 0; k < 200; k++) { const rr = L.rdRace(k); fields.add(rr.horses.map((h) => h.i).join()); wins.add(rr.horses[L.rdResult(k, 1e15).order[0]].name); }
  assert.ok(fields.size > 150 && wins.size === 12);
});

test('the house edge: 100,000 races, the house keeps 8-12% whoever you bet on (a Gold sink)', () => {
  const st = [0, 0, 0, 0], back = [0, 0, 0, 0], N = 100000;
  let photos = 0, favMin = 9, longMax = 0;
  for (let n = 0; n < N; n++) {
    const race = L.rdRace(n), res = L.rdResult(n, 1e15), w = res.order[0], hs = race.horses;
    const fav = hs.reduce((b, h, i) => (h.odds < hs[b].odds ? i : b), 0), lng = hs.reduce((b, h, i) => (h.odds > hs[b].odds ? i : b), 0);
    favMin = Math.min(favMin, hs[fav].odds);
    longMax = Math.max(longMax, hs[lng].odds);
    if (res.photo) photos++;
    [n % 6, fav, lng, (n * 7 + 3) % 6].forEach((h, k) => { st[k] += 1000; if (h === w) back[k] += L.rdPay(1000, hs[h].odds); });
  }
  const keep = st.map((x, k) => 1 - back[k] / x);
  console.log('[house edge] any horse ' + (keep[0] * 100).toFixed(1) + '%, the favourite ' + (keep[1] * 100).toFixed(1) + '%, the long shot ' + (keep[2] * 100).toFixed(1) + '%; photo finishes ' + (photos / N * 100).toFixed(1) + '%; odds ' + favMin + 'x to ' + longMax + 'x');
  keep.forEach((k) => assert.ok(k >= 0.08 && k <= 0.12, 'the house keeps ' + (k * 100).toFixed(1) + '%'));
  assert.ok(favMin <= 2 && longMax === 9, 'from a short favourite to the 9x long shot');
  assert.ok(photos > N * 0.05 && photos < N * 0.15, 'now and then a photo finish');
});

test('bets: 100 to 50,000 a race, one a race, 200,000 a day, closing 30 s before the start; a win pays the stake x the odds', () => {
  const s = fresh(), n = L.rdNext(clock.ms);
  s.gold = 500000;
  assert.strictEqual(L.rdBet(s, n, 0, 99, clock.ms).why, 'min');
  assert.strictEqual(L.rdBet(s, n, 0, 50001, clock.ms).why, 'max');
  assert.strictEqual(L.rdBet(s, n, 6, 100, clock.ms).why, 'horse');
  assert.strictEqual(L.rdBet(s, n, 0, 100.5, clock.ms).why, 'min');
  assert.strictEqual(L.rdBet(s, n + 1, 0, 100, clock.ms).why, 'closed', 'the race after next: not open yet');
  const r = L.rdBet(s, n, 2, 50000, clock.ms);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.odds, L.rdRace(n).horses[2].odds);
  assert.strictEqual(r.win, Math.floor(50000 * Math.round(r.odds * 10) / 10));
  assert.strictEqual(s.gold, 450000, 'the stake is taken at once');
  assert.strictEqual(L.rdBet(s, n, 3, 100, clock.ms).why, 'one', 'one bet a race');
  // the day's limit: three more races of 50,000, then no more today
  let at = clock.ms, k = n;
  for (let i = 0; i < 3; i++) { k++; at = L.rdOpenAt(k) + 1000; assert.strictEqual(L.rdBet(s, k, 0, 50000, at).ok, true); }
  k++; at = L.rdOpenAt(k) + 1000;
  assert.strictEqual(L.rdBet(s, k, 0, 100, at).why, 'day', '200,000 bet today');
  assert.deepStrictEqual(plain(L.rdToday(s, at)).staked, 200000);
  assert.strictEqual(L.rdToday(s, at).left, 0);
  const nextDay = L.rdNext(manila(2026, 11, 19, 10));
  assert.strictEqual(L.rdBet(s, nextDay, 0, 100, manila(2026, 11, 19, 10)).ok, true, 'a new Manila day: the limit starts over');
  // closing: open until 30 s before the start
  const m = L.rdNext(manila(2026, 11, 20, 12, 0));
  assert.ok(L.rdOpen(m, L.rdStart(m) - 30001));
  assert.ok(!L.rdOpen(m, L.rdStart(m) - 30000));
  assert.ok(!L.rdOpen(m, L.rdStart(m) - 10 * 60000 - 1), 'not before the race ahead of it starts');
  const poor = fresh();
  poor.gold = 50;
  assert.strictEqual(L.rdBet(poor, L.rdNext(clock.ms), 0, 100, clock.ms).why, 'gold');
  assert.deepStrictEqual([RD.min, RD.max, RD.day, RD.confirm], [100, 50000, 200000, 10000]);
});

test('a bet on a running race survives closing the game and is paid by the clock on the next open, once; won/lost today', () => {
  // find a race we win and one we lose, both today
  const base = L.rdNext(clock.ms);
  let win = -1, lose = -1;
  for (let n = base; n < base + 60 && (win < 0 || lose < 0); n++) { const w = L.rdResult(n, 1e15).order[0]; if (w === 0 && win < 0) win = n; if (w !== 0 && lose < 0) lose = n; }
  [[win, true], [lose, false]].forEach(([n, wins]) => {
    const s = fresh();
    const at = L.rdOpenAt(n) + 5000;
    const r = L.rdBet(s, n, 0, 5000, at), g = s.gold;
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(plain(L.rdSettle(s, L.rdStart(n) + 10000)), [], 'running: nothing yet');
    const saved = JSON.stringify(L.serialize(s)); // the game is closed mid-race
    const back = L.deserialize(JSON.parse(saved));
    assert.deepStrictEqual(plain(back.mc.bets), [{ n, h: 0, a: 5000 }], 'the bet is in the save');
    const paid = L.rdSettle(back, L.rdStart(n) + 3600000); // opened an hour later
    assert.strictEqual(paid.length, 1);
    assert.strictEqual(paid[0].win, wins);
    assert.strictEqual(back.gold, g + (wins ? r.win : 0));
    assert.deepStrictEqual(plain(L.rdSettle(back, L.rdStart(n) + 7200000)), [], 'paid once');
    assert.strictEqual(roundTrip(back).mc.bets.length, 0);
    const day = L.rdToday(back, L.rdStart(n) + 3600000);
    assert.deepStrictEqual([day.won, day.lost], wins ? [r.win - 5000, 0] : [0, 5000]);
  });
});

test('the save: an old save loads unchanged, mc round trips, bad values are cleaned, the generation stays 3', () => {
  const old = L.newState();
  delete old.mc;
  const o = JSON.parse(JSON.stringify(L.serialize(old)));
  assert.ok(!('mc' in o), 'a farm that never raced writes no mc');
  const back = L.deserialize(o);
  assert.deepStrictEqual(plain(back.mc.bets), []);
  assert.strictEqual(back.mc.wk, 0);
  assert.strictEqual(C.SAVE_GEN, 3);
  const s = fresh();
  for (let i = 0; i < 3; i++) L.mcBeginTry(s, clock.ms);
  L.mcFinish(s, { done: true, laps: [11000, 10900, 10800], knocks: 1 }, clock.ms);
  L.rdBet(s, L.rdNext(clock.ms), 4, 1234, clock.ms);
  L.mcTourTake(s, 'race');
  L.mcPrizePay(s, { ok: true, id: ID, rank: 4, ms: 1 });
  const again = roundTrip(s);
  assert.deepStrictEqual(plain(again.mc), plain(s.mc));
  assert.strictEqual(L.mcTourTake(again, 'race'), false);
  assert.strictEqual(L.mcTourTake(again, 'cup'), true);
  const bad = JSON.parse(JSON.stringify(L.serialize(s)));
  bad.mc.b = [1, 9, 100, 2, 0, 50, 3, 0, 999999, 4, 1, 300, 4, 2, 300];
  bad.mc.q = ['not-an-id', 1, 0, 1, 2, 3];
  bad.mc.p = ['x', ID];
  const c = L.deserialize(bad);
  assert.deepStrictEqual(plain(c.mc.bets), [{ n: 4, h: 1, a: 300 }], 'a horse past the 6th, a stake under 100 or over 50,000 are dropped; one bet a race');
  assert.strictEqual(c.mc.q, null);
  assert.deepStrictEqual(plain(c.mc.paid), [ID]);
  assert.ok(JSON.stringify(L.serialize(s)).length < 400 + JSON.stringify(L.serialize(old)).length, 'small in the save');
});
