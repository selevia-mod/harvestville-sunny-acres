// The 2nd play test (22 Nov 2026; owner: "A, and the words are ok, fix them all"): the parts the logic owns.
//   2 Manila's Plains Gate sign said the Open Plains was "coming soon"
//   3 40 days away said "30 DAYS WENT BY": the report keeps the days really gone (away), the farm plays the last 30
//   4 the Ribbons page listed the contests as written (Nov 20 first on 22 Nov, after it was over): next first now
// (1, 5, 6 are drawn: test/e2e-play-fixes.test.js)   ROOT=/other/checkout runs it against another copy's src.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.ROOT || path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = (y, m, d) => { clock.set(y, m, d, 10, 0); const s = L.newState(); s.seed = 7; return s; };

test('2: the Plains Gate sign says the way to the Open Plains, not "coming soon"', () => {
  const g = C.MANILA.gates.filter((x) => x.key === 'plains')[0];
  assert.ok(g, 'the Plains Gate');
  assert.ok(!/soon/i.test(g.text), g.text);
  assert.strictEqual(g.text, 'PLAINS GATE\nThe valley road home to Willowbrook goes west from here.\nThe Open Plains: take the east road out of Willowbrook.');
  assert.strictEqual(C.ROUTES.town.plains, 'road_east', 'the Open Plains is through the east road out of Willowbrook');
});

test('3: away 40 days (or 400): the report says so; only the last 30 are played', () => {
  for (const n of [2, 30, 40, 400]) {
    const s = fresh(2026, 11, 22), d0 = s.day;
    clock.set(2026, 11, 22 + n, 8, 0);
    const r = L.catchUp(s, clock.ms);
    assert.strictEqual(r.away, n, n + ' days away');
    assert.strictEqual(r.days, Math.min(n, 30), 'the farm played ' + Math.min(n, 30));
    assert.strictEqual(s.day, d0 + n);
  }
  const s = fresh(2026, 11, 22);
  clock.set(2026, 11, 22, 18, 0);
  assert.strictEqual(L.catchUp(s, clock.ms), null, 'the same day: no report');
});

test('4: the contests, the next one first (22 Nov: Starry Night Dec 24, then Harvest Oct 12, then the Cow Festival Nov 20)', () => {
  const order = (y, m, d) => JSON.parse(JSON.stringify(L.ctUpcoming(fresh(y, m, d)).map((u) => u.fest.key + " " + u.days)));
  assert.deepStrictEqual(order(2026, 11, 22), ['starry 32', 'harvest 324', 'cowfest 363']);
  assert.deepStrictEqual(order(2026, 11, 20), ['cowfest 0', 'starry 34', 'harvest 326'], 'on its day: first, 0 days');
  assert.deepStrictEqual(order(2027, 1, 5), ['harvest 280', 'cowfest 319', 'starry 353']);
});
