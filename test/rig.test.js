// Unit tests for the Rifle's rig arithmetic (owner, 11 Nov 2026: the farmer boy built from parts while he shoots;
// src/01-logicZZZZZZZZZZZZZZZ-rig.js): an arm's two-bone reach, which way the elbow bends, the raise and kick curves, the
// aim's limits, and the parts' joints the importer wrote (src/00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js).
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
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || '') + ' ' + a + ' ~ ' + b);

test('an arm reaches what is in reach: the wrist on the target, both bones their length', () => {
  for (const [tx, ty] of [[60, 20], [-30, 70], [10, -50], [75, 0]]) {
    for (const bend of [1, -1]) {
      const r = L.rigIK(0, 0, tx, ty, 50, 40, bend);
      assert.ok(r.reach);
      near(Math.hypot(r.ex, r.ey), 50, 1e-6, 'upper arm');
      near(Math.hypot(r.wx - r.ex, r.wy - r.ey), 40, 1e-6, 'forearm');
      near(r.wx, tx, 0.01, 'x'); near(r.wy, ty, 0.01, 'y');
    }
  }
});

test('too far: the arm straight, pointing at it; too close: folded, never broken', () => {
  const far = L.rigIK(0, 0, 300, 0, 50, 40, 1);
  assert.strictEqual(far.reach, false);
  near(far.wx, 90, 0.01, 'straight'); near(far.wy, 0, 0.5);
  const close = L.rigIK(0, 0, 1, 0, 50, 40, 1);
  near(Math.hypot(close.wx, close.wy), 10, 0.01, 'folded as far as it goes');
  assert.ok([far, close].every((r) => [r.ex, r.ey, r.wx, r.wy].every(Number.isFinite)));
});

test('the elbow: side on it hangs down; facing you or away it goes outwards', () => {
  const pick = (view, sx, tx, ty) => { const b = L.rigBend(view, sx, 0, tx, ty, 50, 40); return L.rigIK(sx, 0, tx, ty, 50, 40, b); };
  const s = pick('side', 0, -70, 0);
  assert.ok(s.ey > 0, 'below the line from shoulder to hand');
  const right = pick('ahead', 40, 10, 50), left = pick('ahead', -40, -10, 50);
  const other = (sx, tx, ty) => { const b = L.rigBend('ahead', sx, 0, tx, ty, 50, 40); return L.rigIK(sx, 0, tx, ty, 50, 40, -b); };
  assert.ok(right.ex > other(40, 10, 50).ex, 'out to the right');
  assert.ok(left.ex < other(-40, -10, 50).ex, 'out to the left');
});

test('the shot\'s timing: raised in 0.15 s, eased; the kick in fast, held a moment (the hit-stop), settled by 0.33 s', () => {
  assert.strictEqual(L.rigRaise(0), 0);
  assert.ok(L.rigRaise(75) > 0.8, 'eased: most of the way at half time');
  assert.strictEqual(L.rigRaise(C.RIG.raise), 1);
  assert.strictEqual(L.rigRaise(999), 1);
  assert.strictEqual(L.rigKick(-5), 0);
  near(L.rigKick(15), 0.5, 1e-9);
  assert.strictEqual(L.rigKick(C.RIG.kickIn + 10), 1, 'the hit-stop');
  assert.ok(L.rigKick(C.RIG.kickIn + C.RIG.hitStop + 100) < 0.3);
  near(L.rigKick(C.RIG.kickIn + C.RIG.hitStop + C.RIG.settle), 0, 1e-9, 'settled');
  assert.ok(C.RIG.kickIn + C.RIG.hitStop + C.RIG.settle <= C.WEAPONS.rifle.still - 260, 'settled before he can move on');
  assert.strictEqual(C.WEAPONS.rifle.gap, 1400, 'still 1.4 s a shot');
});

test('the aim turns towards the animal within limits, mirrored facing right', () => {
  const up = L.rigAim('left', Math.atan2(-0.3, -1));
  near(up.ang, Math.PI + Math.atan(0.3), 1e-9); assert.ok(up.dev > 0, 'muzzle up is +');
  const steep = L.rigAim('left', -Math.PI / 2 - 0.1);
  near(steep.dev, C.RIG.side[1], 1e-9, 'held at the limit');
  const right = L.rigAim('right', Math.atan2(-0.3, 1));
  near(right.ang, up.ang, 1e-9, 'facing right is drawn as facing left');
  near(L.rigAim('down', Math.PI / 2 + 2).dev, C.RIG.ahead, 1e-9);
  near(L.rigAim('up', -Math.PI / 2).dev, 0, 1e-9);
});

test('the parts the importer wrote: every part, its joints inside it, arms that hang down, a gap in the gripping hand', () => {
  const R = C.RIG_BOY;
  assert.ok(R && R.tall > 100, 'imported');
  const want = { head_front: ['neck'], head_back: ['neck'], head_left: ['neck'], head_aim: ['neck'], body_front: ['neck', 'hip', 'shoulderL', 'shoulderR'],
    body_back: ['neck', 'hip', 'shoulderL', 'shoulderR'], body_left: ['neck', 'hip', 'shoulder'], legs_front: ['hip'], legs_back: ['hip'], legs_left: ['hip'],
    arm_upper: ['shoulder', 'elbow'], arm_fore: ['elbow', 'wrist'], hand_open: ['wrist'], hand_grip: ['wrist', 'grip'] };
  Object.keys(want).forEach((n) => {
    const p = R.parts[n];
    assert.ok(p && p.f.length === 4, n);
    want[n].forEach((j) => { const v = p.pv[j]; assert.ok(v && v[0] >= 0 && v[0] <= p.f[2] && v[1] >= 0 && v[1] <= p.f[3] + 0.5, n + '.' + j); });
    assert.ok(p.f[0] + p.f[2] <= 1024 && p.f[1] + p.f[3] <= 1024, n + ' in the picture');
  });
  assert.ok(R.parts.arm_upper.pv.elbow[1] > R.parts.arm_upper.pv.shoulder[1], 'the elbow below the shoulder');
  assert.ok(R.parts.arm_fore.pv.wrist[1] > R.parts.arm_fore.pv.elbow[1]);
  assert.ok(R.parts.hand_grip.pv.grip[1] > R.parts.hand_grip.pv.wrist[1], 'the grip below the wrist');
});
