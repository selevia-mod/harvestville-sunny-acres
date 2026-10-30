'use strict';
// The grass that stands in front of the wild animals' feet (owner, 30 Oct 2026; prompt in art-src/EXTRA-PROMPTS.md):
//   art-src/wild/grass_tufts.png  3 columns (Pulag, Makiling, Magayon) by 2 rows
//   assets/wildgrass.png/.webp    the same grid, each tuft 320x120, standing on the bottom edge of its cell
// node tools/art/grass-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async (src) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 2, 0.02), CW = 320, CH = 120, sheet = W.canvas(CW * 3, CH * 2), g = sheet.getContext('2d');
    cl.forEach((x, i) => {
      if (!x) throw new Error('tuft ' + i + ' is missing');
      W.draw(g, x.c, x, Math.min(CW * 0.98 / x.w, CH * 0.98 / x.h), (i % 3) * CW + CW / 2, Math.floor(i / 3) * CH + CH - 1);
    });
    return W.out(sheet, 0.86);
  }, data(path.join(ROOT, 'art-src', 'wild', 'grass_tufts.png')));
  ['png', 'webp'].forEach((k) => fs.writeFileSync(path.join(OUT, 'wildgrass.' + k), Buffer.from(r[k].split(',')[1], 'base64')));
  await b.close();
  console.log('assets/wildgrass written');
})().catch((e) => { console.error(e); process.exit(1); });
