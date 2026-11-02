'use strict';
// The real Mine icons (owner, 2 Nov 2026): art-src/mine_icons.png, 5 columns and 2 rows on flat magenta, cut into
// art-src/icons/<name>.png at 128 x 128. Then node tools/art/mine-import.js paints them into the sheets.
// Magenta is only taken from the outside in: Amethyst's own colours look like it. node tools/art/mine-icons-cut.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const NAMES = ['crystal', 'jade', 'obsidian', 'moonstone', 'starstone', 'amethyst', 'emerald', 'ruby', 'sapphire', 'diamond'];

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'art-src', 'mine_icons.png')).toString('base64');
  const r = await p.evaluate(async ([src, names]) => {
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const cw = Math.round(im.width / 5), ch = Math.round(im.height / 2), out = {};
    names.forEach((name, n) => {
      const c = canvas(cw, ch), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, -(n % 5) * im.width / 5, -Math.floor(n / 5) * im.height / 2);
      const d = x.getImageData(0, 0, cw, ch), q = d.data, gone = new Uint8Array(cw * ch), todo = [];
      const pink = (i) => q[i * 4] > 205 && q[i * 4 + 2] > 205 && q[i * 4 + 1] < 120;
      const seed = (i) => { if (!gone[i] && pink(i)) { gone[i] = 1; todo.push(i); } };
      for (let k = 0; k < cw; k++) { seed(k); seed((ch - 1) * cw + k); }
      for (let k = 0; k < ch; k++) { seed(k * cw); seed(k * cw + cw - 1); }
      while (todo.length) {
        const i = todo.pop(), X = i % cw;
        if (X) seed(i - 1);
        if (X < cw - 1) seed(i + 1);
        if (i >= cw) seed(i - cw);
        if (i < cw * (ch - 1)) seed(i + cw);
      }
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let i = 0; i < gone.length; i++) {
        const k = i * 4;
        if (gone[i]) { q[k + 3] = 0; continue; }
        const near = [i - 1, i + 1, i - cw, i + cw].some((m) => gone[m]), over = Math.min(q[k], q[k + 2]) - q[k + 1];
        if (near && over > 12) { q[k + 3] = Math.round(255 * Math.max(0, 1 - over / 60)); q[k + 1] = Math.min(q[k], q[k + 2]); } // the sparkles' pink edge
        if (q[k + 3] > 128) { const X = i % cw, Y = Math.floor(i / cw); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
      }
      x.putImageData(d, 0, 0);
      const o = canvas(128, 128), g = o.getContext('2d'), w = x1 - x0 + 1, h = y1 - y0 + 1, k = 116 / Math.max(w, h);
      g.imageSmoothingQuality = 'high';
      g.drawImage(c, x0, y0, w, h, 64 - w * k / 2, 64 - h * k / 2, w * k, h * k);
      out[name] = o.toDataURL('image/png');
    });
    return out;
  }, [src, NAMES]);
  NAMES.forEach((n) => fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(r[n].split(',')[1], 'base64')));
  fs.writeFileSync(path.join(ROOT, 'art-src', 'mine-stand-ins.json'), '{}');
  console.log('cut', NAMES.length);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
