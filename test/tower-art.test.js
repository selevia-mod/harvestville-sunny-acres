// The Lost Tower's own pictures (owner, 12 Nov 2026; made by tools/tower/tower-import.js): every picture the game asks
// for in the Tower is in the 'tower' pack (out of the page), but the stairs (the owner turned those pictures down: new door
// art comes later), each creature has its size in its own sheet, and the sheets are the wild sheet's frames.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const art = require('../tools/tower/tower-art');
const PACKS = require('../tools/packs');
const C = art.config();
const TW = C.TOWER;
const kinds = (z) => z.normal.concat([z.guard, z.mini, z.boss]);
const webpSize = (f) => { // (as build.js)
  const d = fs.readFileSync(f), k = d.toString('latin1', 12, 16);
  if (k === 'VP8X') return [1 + d.readUIntLE(24, 3), 1 + d.readUIntLE(27, 3)];
  if (k === 'VP8 ') return [d.readUInt16LE(26) & 0x3fff, d.readUInt16LE(28) & 0x3fff];
  const b = d.readUInt32LE(21);
  return [(b & 0x3fff) + 1, ((b >>> 14) & 0x3fff) + 1];
};

test('every creature sheet, shadow, cave tile sheet and prop the Tower asks for is in the tower pack, and the ten doors up', () => {
  const pack = PACKS.tower, want = [];
  TW.zones.forEach((z) => {
    kinds(z).forEach((k) => { const d = C.WILD.animals[k]; want.push(d.sheet, d.sheet + 'shade'); });
    want.push(z.art.cave, z.art.gate);
    z.art.props.forEach((k) => want.push(k));
  });
  assert.strictEqual(want.length, 10 * (12 + 2 + 6));
  want.forEach((k) => assert.ok(pack.includes(k), k + ' is in the tower pack'));
  // and in no other pack (one copy on the phone)
  Object.keys(PACKS).filter((p) => p !== 'tower').forEach((p) => want.forEach((k) => assert.ok(!PACKS[p].includes(k), k + ' is not also in ' + p)));
});

test('each creature has its width walking left in its own sheet (C.TOWER.artPx), and its sheet has the wild sheet\'s 12 frames', () => {
  const sizes = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'sizes.json'), 'utf8'));
  const full = [8 * 2 + 12 * 224 + 11 * 16, 8 * 2 + 252];
  TW.zones.forEach((z) => kinds(z).forEach((k) => {
    const d = C.WILD.animals[k], px = TW.artPx[k];
    assert.ok(px > 60 && px <= 224, k + ': px ' + px);
    const w = webpSize(path.join(ROOT, 'assets', d.sheet + '.webp'));
    const big = d.role === 'mini' || d.role === 'boss';
    if (big) assert.deepStrictEqual(w, full, d.sheet + ': a boss\'s sheet at full size');
    else {
      assert.deepStrictEqual(sizes[d.sheet], full, d.sheet + ': its full size in sizes.json');
      assert.deepStrictEqual(w, full.map((n) => Math.round(n * 0.75)), d.sheet + ': stored at 3/4');
    }
    assert.deepStrictEqual(sizes[d.sheet + 'shade'], full, d.sheet + 'shade: its full size in sizes.json');
  }));
});

test('the cave tiles are laid out like the Lair\'s (5 tiles of 128, the pools\' 192), the props stand 320 wide', () => {
  TW.zones.forEach((z) => {
    assert.deepStrictEqual(webpSize(path.join(ROOT, 'assets', z.art.cave + '.webp')), [128 * 5 + 192, 192], z.art.cave);
    z.art.props.forEach((k) => assert.strictEqual(webpSize(path.join(ROOT, 'assets', k + '.webp'))[0], 320, k));
  });
});
