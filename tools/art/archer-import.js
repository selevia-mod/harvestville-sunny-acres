'use strict';
// The farmers drawing a bow (owner, 2 Nov 2026; pictures in art-src/characters/archer_*.png, 1024x1536 on flat green) into
// assets/archer.png/.webp and assets/archer_girl.png/.webp: 9 poses, rows facing you, away, left; columns ready, full draw,
// let go. The hands are empty: the game draws the bow, its string and the arrow (19w-bow.js). Each pose is stood on the
// feet, because the pictures drift from cell to cell. Frames are 288 wide, not 256, so an outstretched arm fits.
// node tools/art/archer-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SHEETS = [['archer_boy.png', 'archer'], ['archer_girl.png', 'archer_girl']];
// (SCALE: the 30-degree pictures, 12 Nov 2026, draw the farmer a little smaller in the cell than the old ones did: 0.79
// keeps him as big next to his walking sheet as before, about 0.92 of his walking height facing you, crouched to shoot)
const FW = 288, FH = 384, BASE = 372, SCALE = 0.79;

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [file, name] of SHEETS) {
    const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'art-src', 'characters', file)).toString('base64');
    const r = await p.evaluate(async ([src, FW, FH, BASE, SCALE]) => {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const out = canvas(8 * 2 + FW * 3 + 16 * 2, 8 * 2 + FH * 3 + 16 * 2), o = out.getContext('2d');
      const cw = im.width / 3, ch = im.height / 3, report = [];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const w = Math.round(cw), h = Math.round(ch), c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, Math.round(col * cw), Math.round(row * ch), w, h, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h), q = d.data;
        let base = 0, lo = 1e9, hi = -1;
        for (let i = 0; i < q.length; i += 4) {
          const r0 = q[i], g = q[i + 1], b0 = q[i + 2], over = g - Math.max(r0, b0);
          if (g > 110 && over > 34) q[i + 3] = 0; // the green
          else if (over > 0) { q[i + 3] = Math.round(q[i + 3] * Math.max(0, 1 - over / 60)); q[i + 1] = Math.max(r0, b0); } // edge pixels mixed with it
        }
        for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) if (q[(y * w + X) * 4 + 3] > 128) base = y;
        for (let y = Math.round(base - h * 0.14); y <= base; y++) for (let X = 0; X < w; X++) if (q[(y * w + X) * 4 + 3] > 128) { lo = Math.min(lo, X); hi = Math.max(hi, X); }
        x.putImageData(d, 0, 0);
        const fx = 8 + col * (FW + 16), fy = 8 + row * (FH + 16), mid = (lo + hi) / 2;
        o.save();
        o.beginPath(); o.rect(fx, fy, FW, FH); o.clip();
        o.imageSmoothingQuality = 'high';
        o.drawImage(c, fx + FW / 2 - mid * SCALE, fy + BASE - base * SCALE, w * SCALE, h * SCALE);
        o.restore();
        report.push([Math.round(mid), base]);
      }
      return { png: out.toDataURL('image/png'), webp: out.toDataURL('image/webp', 0.8), report };
    }, [src, FW, FH, BASE, SCALE]);
    fs.writeFileSync(path.join(ROOT, 'assets', name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(ROOT, 'assets', name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    console.log(name, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp', JSON.stringify(r.report));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
