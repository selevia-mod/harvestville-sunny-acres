// The Lost Tower's food icons (owner, 13 Nov 2026; prompt ~/Downloads/tower-food-art/PROMPTS.md):
// art-src/tower-food/tower_food_icons.png (the owner's sheet, 8 a row; 6 a row also read when it is 1536 x 1024) becomes
// assets/tower_food_icons: 22 cells of 128 x 128, 8 a row, in C.FOOD_ICONS' order, each icon trimmed, fitted inside the
// cell with a small margin and centred (a generated sheet is never quite on its grid). In the 'tower' pack (never the page).
//   node tools/tower/food-icons-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'tower-food', 'tower_food_icons.png');
const OUT = path.join(ROOT, 'assets', 'tower_food_icons');
const N = 22, CELL = 128, PAD = 6;

(async () => {
  if (!fs.existsSync(SRC)) { console.log('no ' + path.relative(ROOT, SRC) + ' yet'); return; }
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('../art/wild-lib') });
  const r = await p.evaluate(async ([src, N, CELL, PAD]) => {
    const im = await W.load(src), cols = im.width > im.height * 2 ? 8 : 6, rows = Math.ceil(N / cols);
    const cl = W.cells(W.dehalo(W.cutout(im)), cols, rows, 0);
    const o = W.canvas(8 * CELL, Math.ceil(N / 8) * CELL), g = o.getContext('2d'), miss = [];
    for (let i = 0; i < N; i++) {
      const x = cl[i];
      if (!x) { miss.push(i + 1); continue; }
      const k = Math.min((CELL - PAD * 2) / x.w, (CELL - PAD * 2) / x.h), cx = (i % 8) * CELL + CELL / 2, bottom = Math.floor(i / 8) * CELL + CELL / 2 + x.h * k / 2;
      W.draw(g, x.c, x, k, cx, bottom);
    }
    return Object.assign(W.out(o, 0.9), { w: o.width, h: o.height, cols, miss });
  }, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), N, CELL, PAD]);
  await b.close();
  if (r.miss.length) throw new Error('no icon in cells ' + r.miss.join(', '));
  fs.writeFileSync(OUT + '.png', Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(OUT + '.webp', Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/tower_food_icons', r.w + 'x' + r.h, 'from a sheet of ' + r.cols + ' a row,', (fs.statSync(OUT + '.webp').size / 1024).toFixed(0) + ' KB webp');
})().catch((e) => { console.error(e); process.exit(1); });
