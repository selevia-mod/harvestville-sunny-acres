'use strict';
// The wild animals redrawn from the game's three-quarter angle (owner, 30 Oct 2026; prompts in
// art-src/ANIMALS-3Q-PROMPTS.md, pictures in art-src/wild-3q/wild_<animal>.png: 3 columns x 4 rows each) into
// assets/wild.png/.webp: a row per animal (C.WILD.order), 12 frames of FW x FH in the pictures' own order:
//   0-2 walking toward you, 3-5 walking away, 6-8 walking left (stand, step, step), 9 facing you (alert, howl),
//   10 eating or sniffing (facing left), 11 running or flying away (facing left).
// Each cell is copied as it is, scaled by K, so the artist's placement stays (no jitter between steps); every animal
// stands on the same ground line (358 in the 1024x1536 pictures) and that line lands on FEET.
// Prints each animal's walking-left width in the sheet: C.WILD.animals[].px.
// node tools/art/wild3q-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'wild-3q');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;

const FW = 224, FH = 252, M = 8, G = 16, K = 0.65, GROUND = 358, FEET = 233; // keep FW/FH/FEET in step with 10-boot.js and 19v-wild.js
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const r = await p.evaluate(async ([list, FW, FH, M, G, K, GROUND, FEET]) => {
    const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = s; });
    const sheet = document.createElement('canvas');
    sheet.width = M * 2 + 12 * FW + 11 * G;
    sheet.height = M * 2 + list.length * FH + (list.length - 1) * G;
    const g = sheet.getContext('2d'), px = [];
    g.imageSmoothingQuality = 'high';
    for (let row = 0; row < list.length; row++) {
      const im = await load(list[row]), cw = im.width / 3, ch = im.height / 4;
      for (let i = 0; i < 12; i++) {
        const sx = (i % 3) * cw, sy = Math.floor(i / 3) * ch, x = M + i * (FW + G), y = M + row * (FH + G);
        g.save();
        g.beginPath(); g.rect(x, y, FW, FH); g.clip();
        g.drawImage(im, sx, sy, cw, ch, x + FW / 2 - cw * K / 2, y + FEET - GROUND * K, cw * K, ch * K);
        g.restore();
      }
      // the walking-left frame's width (frame 6)
      const x6 = M + 6 * (FW + G), y6 = M + row * (FH + G), d = g.getImageData(x6, y6, FW, FH).data;
      let x0 = FW, x1 = -1;
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (d[(y * FW + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      px.push(x1 - x0 + 1);
    }
    return { png: sheet.toDataURL('image/png'), webp: sheet.toDataURL('image/webp', 0.8), px, w: sheet.width, h: sheet.height };
  }, [C.WILD.order.map((a) => data(path.join(SRC, 'wild_' + a + '.png'))), FW, FH, M, G, K, GROUND, FEET]);
  fs.writeFileSync(path.join(OUT, 'wild.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'wild.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/wild', r.w + 'x' + r.h, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
  C.WILD.order.forEach((a, i) => console.log('  ' + a.padEnd(8), 'px', r.px[i]));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
