// The robot's sums for "what part of the screen is free" (tools/robot/screen.js): node --test test/robot-screen.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../tools/robot/screen');

// a 360x640 screen, cells of 2: a top bar 0-48 and a bottom panel from 440 down covered
const mask = (() => {
  const cell = 2, cols = 180, rows = 320, bits = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bits.push(r * cell < 48 || r * cell >= 440 ? '1' : '0');
  return { cell, cols, rows, W: 360, H: 640, bits: bits.join('') };
})();

test('the free band is between the bar and the panel', () => {
  assert.deepStrictEqual(S.freeBand(mask), { top: 48, bottom: 440 });
});
test('a tile fits only where its middle half is out from under both', () => {
  const S0 = S.prefix(mask), fit = S.fitGrid(mask, S0, 20, 20, 0.25);
  assert.strictEqual(fit(100, 200, 100, 200), true); // in the middle
  assert.strictEqual(fit(100, 450, 100, 600), false); // under the panel, wherever it goes
  assert.strictEqual(fit(100, 450, 100, 600) || fit(100, 300, 100, 600), true); // a camera that can bring it up: yes
  assert.strictEqual(fit(100, 0, 100, 20), false); // under the top bar
});
test('covered share: off the screen counts as covered', () => {
  const S0 = S.prefix(mask);
  assert.strictEqual(S.coveredShare(mask, S0, 0, 100, 20, 120), 0);
  assert.strictEqual(S.coveredShare(mask, S0, 0, 500, 20, 520), 1);
  assert.strictEqual(S.coveredShare(mask, S0, -20, 100, 0, 120), 1);
});
