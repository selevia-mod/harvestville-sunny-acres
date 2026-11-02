'use strict';
// The painted round buttons (owner, 2 Nov 2026), from pictures on flat magenta, each cut to its circle, which also takes off
// any magenta at the edge. The labels stay in the game. node tools/art/sidebuttons-import.js
//   art-src/side_buttons.png, 2 by 2   assets/sidebtn: Quests, Online, Decorate, Chat
//   art-src/visit_buttons.png, 3 by 2  assets/visitbtn: Visit, Like, Gift, Wave, More, Home
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const FRAME = 144;
const SHEETS = [['side_buttons.png', 'sidebtn', 2, 2], ['visit_buttons.png', 'visitbtn', 3, 2]];

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [file, name, cols, rows] of SHEETS) {
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'art-src', file)).toString('base64');
  const r = await p.evaluate(async ([src, FRAME, cols, rows]) => {
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const n = cols * rows, out = canvas(8 * 2 + FRAME * n + 16 * (n - 1), 8 * 2 + FRAME), o = out.getContext('2d'), cw = Math.round(im.width / cols), ch = Math.round(im.height / rows), boxes = [];
    o.imageSmoothingQuality = 'high';
    for (let i = 0; i < n; i++) {
      const c = canvas(cw, ch), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, 0, 0, cw, ch);
      const q = x.getImageData(0, 0, cw, ch).data;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < ch; y++) for (let X = 0; X < cw; X++) {
        const m = (y * cw + X) * 4;
        if (Math.min(q[m], q[m + 2]) - q[m + 1] > 70) continue;
        x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const d = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, fx = 8 + i * (FRAME + 16), k = (FRAME - 2) / d;
      o.save();
      o.beginPath();
      o.arc(fx + FRAME / 2, 8 + FRAME / 2, FRAME / 2 - 1.5, 0, Math.PI * 2);
      o.clip();
      o.drawImage(c, fx + FRAME / 2 - cx * k, 8 + FRAME / 2 - cy * k, cw * k, ch * k);
      o.restore();
      boxes.push([x0, y0, x1, y1]);
    }
    return { png: out.toDataURL('image/png'), webp: out.toDataURL('image/webp', 0.88), boxes };
  }, [src, FRAME, cols, rows]);
  fs.writeFileSync(path.join(ROOT, 'assets', name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'assets', name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(name, JSON.stringify(r.boxes), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
