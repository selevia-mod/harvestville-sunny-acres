// Unit tests for Central Park online (owner, 6 Nov 2026; src/19zzz-c-park-online.js): the park's slower message pace
// (C.ONLINE.park) and how the others still walk smoothly from it (L.trailAt with tr.every, src/01-logic8.js); the tour
// and the What's new line. The rooms, seats and the message counts are in test/e2e-online.test.js.
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
require('./clock')(ctx);

// A walk as it reaches this phone: a step every `every` ms from their phone, each arriving a little late.
const walk = (steps, every, speed, lateMs) => {
  const tr = { list: [], off: 0, heard: 0, every };
  const sent = [];
  for (let i = 0; i < steps; i++) sent.push({ t: i * every, x: 1000 + speed * i * every / 1000, y: 500, dir: 'right', m: 1 });
  return { tr, sent, deliver(upTo) {
    sent.filter((s) => !s.got && s.t + lateMs(s) <= upTo).forEach((s) => { s.got = true; L.trailNote(tr, s, s.t + lateMs(s)); });
  } };
};

test('the park\'s numbers: once a second while walking, every 2 s past 20 others, a beat every 30 s; farms keep 250 ms', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(C.ONLINE.park)), { moveEvery: 1000, busyMoveEvery: 2000, busyAt: 20, beatEvery: 30000 });
  assert.strictEqual(C.ONLINE.moveEvery, 250);
  // the budget the owner was told: 30 walkers in each of 3 parks, each heard by 29 others (+1 sent), stays under 2,500/s
  const perSec = (every) => 3 * 30 * (1000 / every) * 30;
  assert.ok(perSec(C.ONLINE.park.busyMoveEvery) < 2500, String(perSec(C.ONLINE.park.busyMoveEvery)));
});

test('in the park a friend walks at an even speed from one step a second (or one every 2 s), however unevenly they arrive', () => {
  [1000, 2000].forEach((every) => {
    const uneven = [40, 260, 90, 330, 30, 190, 120, 280];
    const w = walk(14, every, C.SPEED, (s) => uneven[Math.round(s.t / every) % uneven.length]);
    let was = null, min = Infinity, max = 0;
    for (let now = 3 * every; now < 9 * every; now += 16) {
      w.deliver(now);
      const at = L.trailAt(w.tr, now);
      assert.ok(at && at.moving, every + ': walking all the way at ' + now);
      if (was !== null) { const v = (at.x - was) / 16 * 1000; min = Math.min(min, v); max = Math.max(max, v); }
      was = at.x;
    }
    assert.ok(min > C.SPEED * 0.9 && max < C.SPEED * 1.1, every + ': steady speed, got ' + Math.round(min) + ' to ' + Math.round(max));
  });
});

test('in the park a late step: straight on for longer, then they wait; a stop ends exactly where they stopped', () => {
  const w = walk(6, 1000, C.SPEED, () => 50), last = w.sent[5];
  w.deliver(100000);
  const slow = 1000 - C.ONLINE.moveEvery;
  const at = (past) => L.trailAt(w.tr, last.t + C.ONLINE.moveDelay + slow + past + w.tr.off);
  assert.ok(Math.abs(at(300).x - (last.x + C.SPEED * 0.3)) < 1, 'straight on');
  const most = C.ONLINE.moveAhead + slow / 2;
  assert.ok(Math.abs(at(most + 300).x - (last.x + C.SPEED * most / 1000)) < 1, 'no further than that');
  assert.strictEqual(at(2 * (C.ONLINE.moveEvery + slow) + 1).moving, false, 'no walking on the spot');
  // a stop between two steps: drawn walking to it, then standing there
  const tr = { list: [], off: 0, heard: 0, every: 1000 };
  L.trailNote(tr, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(tr, { t: 2000, x: C.SPEED, y: 0, dir: 'right', m: 1 }, 2000);
  L.trailNote(tr, { t: 2400, x: C.SPEED * 1.4, y: 0, dir: 'right', m: 0 }, 2400);
  const end = L.trailAt(tr, 2400 + C.ONLINE.moveDelay + slow + 500);
  assert.deepStrictEqual([end.x, end.moving], [C.SPEED * 1.4, false]);
  // a farm's trail (no every) is drawn as before
  const farm = { list: [], off: 0, heard: 0 };
  L.trailNote(farm, { t: 1000, x: 0, y: 0, dir: 'right', m: 1 }, 1000);
  L.trailNote(farm, { t: 1250, x: 288, y: 0, dir: 'right', m: 1 }, 1250);
  assert.strictEqual(L.trailAt(farm, 1250 + C.ONLINE.moveDelay).x, 288);
});

test('Central Park\'s tour has its tip, last in the list; What\'s new 2.4 (6 Nov 2026) links it', () => {
  // (the Friendship Book's tour tip, 6 Nov 2026, was appended after it: a tip's place in the list is its saved bit)
  assert.deepStrictEqual(C.TIPS.slice(-2).map((t) => t.key).join(), 'park_tour,friends_tour');
  const s = L.newState();
  assert.strictEqual(L.tipSeen(s, 'park_tour'), false);
  L.takeTip(s, 'park_tour');
  assert.strictEqual(L.tipSeen(L.deserialize(JSON.parse(JSON.stringify(L.serialize(s)))), 'park_tour'), true, 'kept in the save');
  assert.strictEqual(C.NEWS[0].v, '2.4');
  assert.strictEqual(C.NEWS[0].date, 'November 6, 2026');
  assert.ok(C.NEWS[0].lines.some((l) => l[1] === 'Central Park' && l[3] === 'park' && C.ICON[l[0]] != null));
  const tour = fs.readFileSync(path.join(__dirname, '..', 'src', '19zzz-c-park-online.js'), 'utf8');
  assert.match(tour, /F\.TOURS\.park = \{/);
});
