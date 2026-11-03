// Unit tests for barangays, the Bayanihan Cup and the Market board (src/00-zzzzzzz-social.js, src/01-logicZ-social.js):
// a task counts only from when it was picked, the save keeps it (and old saves load), and the server's answers are
// read with care.
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
const fresh = () => { clock.set(2026, 11, 4, 10, 0); const s = L.newState(); s.seed = 7; L.takeNotes(); return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (o) => JSON.parse(JSON.stringify(o));

test('the rules file loads after the others: it wraps the real save', () => {
  const s = fresh();
  assert.strictEqual(s.nb, null);
  assert.ok(C.TIPS.some((t) => t.key === 'nb_tour') && C.TIPS.some((t) => t.key === 'ads_tour'));
  Object.keys(C.NB.tasks).forEach((k) => assert.ok(C.ICON[C.NB.tasks[k].icon] != null, k + ' has an icon'));
  C.NB.badges.forEach((b) => assert.ok(C.ICON[b] != null, b + ' is an icon'));
});

test('every kind of task counts something the game counts', () => {
  const s = fresh();
  Object.keys(C.NB.tasks).forEach((k) => assert.strictEqual(typeof L.count(s, C.NB.tasks[k].counter), 'number', k));
  assert.strictEqual(L.nbTaskText('harvest', 80), 'Harvest 80 crops');
  assert.strictEqual(L.nbTaskText('care', 1000), 'Care for animals 1,000 times');
  assert.strictEqual(L.nbTaskText('dance', 3), '');
});

test('a task counts only from when it was picked', () => {
  const s = fresh();
  L.bump(s, 'harvest', 30); // (before the pick: does not count)
  L.nbStart(s, '2026-11-02', 'harvest', 80);
  assert.deepStrictEqual(plain(L.nbProgress(s)), { kind: 'harvest', goal: 80, n: 0, done: false });
  L.bump(s, 'harvest', 79);
  assert.strictEqual(L.nbProgress(s).n, 79);
  L.bump(s, 'harvest', 5);
  assert.deepStrictEqual(plain(L.nbProgress(s)), { kind: 'harvest', goal: 80, n: 80, done: true }, 'never past the goal');
  s.stats.fish = 4;
  L.nbStart(s, '2026-11-02', 'fish', 12);
  s.stats.fish = 16;
  assert.ok(L.nbProgress(s).done, 'fish count from the stats');
  assert.strictEqual(L.nbStart(s, '2026-11-02', 'dance', 3), null, 'only known kinds');
  assert.strictEqual(L.nbStart(s, 'monday', 'fish', 3), null);
});

test('the server decides what the task is: another phone counts from now; none on the server, none here', () => {
  const s = fresh();
  L.bump(s, 'order', 2);
  assert.strictEqual(L.nbSync(s, { kind: 'order', goal: 3 }, '2026-11-02'), true);
  assert.deepStrictEqual(plain(s.nb), { w: '2026-11-02', k: 'order', g: 3, b: 2 });
  L.bump(s, 'order', 1);
  assert.strictEqual(L.nbSync(s, { kind: 'order', goal: 3 }, '2026-11-02'), false, 'the same task keeps its count');
  assert.strictEqual(L.nbProgress(s).n, 1);
  assert.strictEqual(L.nbSync(s, { kind: 'order', goal: 3 }, '2026-11-09'), true, 'a new week starts again');
  assert.strictEqual(L.nbProgress(s).n, 0);
  assert.strictEqual(L.nbSync(s, null, '2026-11-09'), true);
  assert.strictEqual(s.nb, null);
  assert.strictEqual(L.nbSync(s, null, '2026-11-09'), false);
});

test('the save keeps the task; an old save (no nb) and a broken one load', () => {
  const s = fresh();
  L.bump(s, 'plant', 12);
  L.nbStart(s, '2026-11-02', 'plant', 60);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.nb), { w: '2026-11-02', k: 'plant', g: 60, b: 12 });
  const old = L.serialize(fresh());
  delete old.nb;
  assert.strictEqual(L.deserialize(JSON.parse(JSON.stringify(old))).nb, null, 'an old save');
  assert.strictEqual(L.deserialize(Object.assign({}, old, { nb: ['x', 'plant', 1, 1] })).nb, null, 'a bad week');
  assert.strictEqual(L.deserialize(Object.assign({}, old, { nb: ['2026-11-02', 'dance', 1, 1] })).nb, null, 'a kind the game does not know');
  assert.strictEqual(L.deserialize(Object.assign({}, old, { nb: '2026' })).nb, null);
  assert.ok(!('nb' in L.serialize(fresh())), 'no task: nothing saved');
});

test('reading farm_nb_v1: only what makes sense', () => {
  assert.strictEqual(L.nbRead(null), null);
  assert.strictEqual(L.nbRead({ week: 'soon' }), null);
  const r = L.nbRead({
    week: '2026-11-02', ends_in: 3600, hood: { id: 7, name: '  Mabuhay  ', badge: 'dragon', open: false, code: 'ABC234', leader: true, members: 99, online: 2 },
    tasks: [{ kind: 'harvest', goal: 80, points: 120, minutes: 12, done: true }, { kind: 'dance', goal: 1 }, null],
    pick: { kind: 'fish', goal: 12, points: 100, minutes: 10, ago: 30 },
    cup: { league: 's', score: 340, place: 2, group: [{ name: 'Ilog', badge: 'gem', score: 500 }, { name: 'Mabuhay', score: 340, me: true }] },
    done_week: 2, done_today: 1, max_week: 6, max_day: 3, min_place: 400, base_gold: 500, prizes: [[3000, 3], [2000, 2], [1200, 1]],
  });
  assert.strictEqual(r.hood.id, '7');
  assert.strictEqual(r.hood.name, 'Mabuhay');
  assert.strictEqual(r.hood.badge, 'carabao', 'an unknown badge: the first');
  assert.strictEqual(r.hood.members, 30, 'at most 30');
  assert.strictEqual(r.hood.open, false);
  assert.deepStrictEqual(plain(r.tasks), [{ kind: 'harvest', goal: 80, points: 120, minutes: 12, done: true }]);
  assert.deepStrictEqual(plain(r.pick), { kind: 'fish', goal: 12, points: 100, minutes: 10, ago: 30 });
  assert.strictEqual(r.cup.group.length, 2);
  assert.strictEqual(r.cup.group[1].me, true);
  assert.strictEqual(r.canWin, true);
  const none = L.nbRead({ week: '2026-11-02', hood: null, tasks: [], pick: null, cup: null });
  assert.strictEqual(none.hood, null);
  assert.strictEqual(none.cup, null);
  assert.strictEqual(none.maxWeek, 6);
});

test('prizes: places 1-3 need 400 points; everyone else who took part gets 500G', () => {
  const nb = L.nbRead({ week: '2026-11-02', prizes: [[3000, 3], [2000, 2], [1200, 1]], min_place: 400, base_gold: 500 });
  assert.deepStrictEqual(plain(L.nbPrize(nb, 1, 400)), { gold: 3000, stars: 3 });
  assert.deepStrictEqual(plain(L.nbPrize(nb, 3, 900)), { gold: 1200, stars: 1 });
  assert.deepStrictEqual(plain(L.nbPrize(nb, 1, 399)), { gold: 500, stars: 0 });
  assert.deepStrictEqual(plain(L.nbPrize(nb, 7, 9000)), { gold: 500, stars: 0 });
  assert.deepStrictEqual(plain(L.cupClaimRead([{ gold: 99999, stars: 9, place: 1, name: 'X' }, { gold: 0, stars: 0 }, 'x'])), [{ gold: 3000, stars: 3, place: 1, name: 'X' }], 'never more than the biggest prize');
  assert.deepStrictEqual(plain(L.cupClaimRead(null)), []);
});

test('the news board in words', () => {
  assert.deepStrictEqual(plain(L.nbPostText({ farm_name: 'Ana', kind: 'say', body: 'Hello po!' })), { name: 'Ana', text: 'Hello po!', say: true });
  assert.strictEqual(L.nbPostText({ farm_name: 'Ana', kind: 'task', body: 'harvest:120' }).text, 'Finished a Cup task: +120 points!');
  assert.strictEqual(L.nbPostText({ farm_name: 'Ana', kind: 'join' }).text, 'Joined the barangay. Welcome!');
  assert.strictEqual(L.nbPostText({ kind: 'left' }).name, 'A farmer');
  assert.strictEqual(L.nbAgo(20), 'just now');
  assert.strictEqual(L.nbAgo(3 * 3600), '3 h ago');
});

test('reading the Market board: unknown items and empty stalls are left out', () => {
  const r = L.adsRead({
    ads: [{ id: 'a', farm_name: 'Ana', friend: true, left_s: 3600, lots: 3, items: [{ item: 'turnip', qty: 10, price: 300 }, { item: 'unobtainium', qty: 1, price: 1 }] },
      { id: 'b', farm_name: 'Ben', items: [{ item: 'nope', qty: 1, price: 1 }] }, { farm_name: 'no id' }],
    mine: { on: true, until_s: 1800, used: true, next_s: 7200, hours: 4 },
  });
  assert.strictEqual(r.ads.length, 1);
  assert.deepStrictEqual(plain(r.ads[0].items), [{ item: 'turnip', qty: 10, price: 300 }]);
  assert.strictEqual(r.ads[0].leftMin, 60);
  assert.deepStrictEqual(plain(r.mine), { on: true, leftMin: 30, used: true, nextMin: 120, hours: 4 });
  assert.strictEqual(L.adItems(r.ads[0].items), '10 Turnip for 300G');
  assert.strictEqual(L.adsRead('x'), null);
  assert.deepStrictEqual(plain(L.adsRead({}).ads), []);
});
