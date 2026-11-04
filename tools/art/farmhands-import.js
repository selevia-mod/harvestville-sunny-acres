'use strict';
// The four farmhands you hire at the Sunny Inn (pictures in art-src/characters/fh_<key>.png, 1024x1536, the villagers'
// 3 x 3 walking sheet: rows facing you, away, left; columns standing, left step, right step) into assets/farmhands.png
// and .webp: 9 columns x 4 rows of 128 x 192, no margin, one farmhand a row in C.FH_KEYS order (19zz-farmhands.js,
// F.fhTexture). Each sheet is cut by the very code that cuts the villagers' (tools/art/import.js, 'frames' mode: one
// scale for all 9 poses, feet on line 186 of the 192 cell), so they stand at the villagers' and the farmer's scale.
// Once this sheet is there, the stand-ins cut from the visitors (tools/art/cut-sheets.js) are no longer made.
// node tools/art/farmhands-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {}, console, Math };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const KEYS = ctx.window.Farm.Config.FH_KEYS;
const FW = 128, FH = 192, BASE = 186; // as the villagers (tools/art-manifest.js, 'people')

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluate(() => { window.ART = {}; });
  await p.addScriptTag({ path: path.join(__dirname, 'import.js') });
  const jobs = KEYS.map((key, r) => {
    const file = 'characters/fh_' + key + '.png';
    return {
      id: 'fh_' + key, file, mode: 'frames', sheet: 'farmhands', cols: 3, rows: 3, fw: FW, fh: FH, base: BASE,
      frames: Array.from({ length: 9 }, (_, k) => r * 9 + k),
      data: 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'art-src', file)).toString('base64'),
    };
  });
  await p.evaluate((list) => window.ART.prepareOverrides(list), jobs);
  const r = await p.evaluate(([n, FW, FH]) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = 9 * FW;
    c.height = n * FH;
    const tops = [];
    for (let f = 0; f < n * 9; f++) {
      const fr = window.ART.OVR['farmhands:' + f];
      if (!fr) throw new Error('frame ' + f + ' is missing');
      g.drawImage(fr, (f % 9) * FW, Math.floor(f / 9) * FH);
    }
    // the top of each one's standing figure (a check that they come out about the size of a villager)
    for (let row = 0; row < n; row++) {
      const d = g.getImageData(0, row * FH, FW, FH).data;
      let top = FH;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 24) { top = Math.floor((i >> 2) / FW); break; }
      tops.push(top);
    }
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.86), tops };
  }, [KEYS.length, FW, FH]);
  await b.close();
  if (errors.length) throw new Error(errors.join('\n'));
  const OUT = path.join(ROOT, 'assets');
  fs.writeFileSync(path.join(OUT, 'farmhands.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'farmhands.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/farmhands', 9 * FW + 'x' + KEYS.length * FH, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp',
    'head tops', JSON.stringify(KEYS.map((k, i) => k + ' ' + r.tops[i])));
})().catch((e) => { console.error(e); process.exit(1); });
