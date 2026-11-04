'use strict';
// The festival contests' ribbons and trophy cup (4 Nov 2026; art-src/CONTESTS-PROMPTS.md): art-src/contests/ribbon_<colour>.png
// (512x640) and trophy_cup.png (640x640), into one small sheet, assets/contests.png/.webp, that 19zz-contests.js paints
// from. They are not item icons (the items sheet is full). The biggest place they show is the prize card: a ribbon 76
// px across and the cup 80 px, so 240 px at an iPhone's 3x; the sheet is no bigger than that needs.
//   4 ribbons (blue, red, yellow, green: 1st, 2nd, 3rd, 4th), each in a frame of FW x FH, FW + GAP apart from x 0,
//   every one the same size, its cream centre at (FW / 2, CY) so the game can write the place on it;
//   then the cup, centred in a CUP x CUP frame at x 4 * (FW + GAP).
// The same numbers are in src/19zz-contests.js (ART): change both together.
// node tools/art/contests-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'contests');
const OUT = path.join(ROOT, 'assets');
const RIBBONS = ['blue', 'red', 'yellow', 'green'];
const FW = 176, FH = 288, CY = 100, GAP = 4, CUP = 240;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const files = RIBBONS.map((c) => path.join(SRC, 'ribbon_' + c + '.png')).concat([path.join(SRC, 'trophy_cup.png')]);
  files.forEach((f) => { if (!fs.existsSync(f)) throw new Error('no ' + path.relative(ROOT, f) + ' yet'); });
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async ([list, FW, FH, CY, GAP, CUP]) => {
    // each picture without its specks and fringe, trimmed
    const pics = [];
    for (const src of list) {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0];
      if (!cl) throw new Error('an empty picture');
      pics.push(cl);
    }
    // a ribbon's cream centre: the biggest patch of cream, its box
    const cream = (cl) => {
      const w = cl.w, h = cl.h, d = cl.c.getContext('2d').getImageData(0, 0, w, h).data, lab = new Uint8Array(w * h);
      const is = (k) => { const i = k * 4, R = d[i], G = d[i + 1], B = d[i + 2]; return d[i + 3] > 200 && R > 225 && G > 200 && B > 150 && R - B > 10 && R - B < 95 && R - G < 45; };
      let best = null;
      for (let k0 = 0; k0 < w * h; k0++) {
        if (lab[k0] || !is(k0)) continue;
        const q = [k0];
        lab[k0] = 1;
        let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
        while (q.length) {
          const m = q.pop(), x = m % w, y = (m - x) / w;
          n++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          [x > 0 ? m - 1 : -1, x < w - 1 ? m + 1 : -1, y > 0 ? m - w : -1, y < h - 1 ? m + w : -1].forEach((o) => { if (o >= 0 && !lab[o] && is(o)) { lab[o] = 1; q.push(o); } });
        }
        if (!best || n > best.n) best = { n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      }
      if (!best || best.n < w * h * 0.04) throw new Error('a ribbon without its cream centre');
      return best;
    };
    const rib = pics.slice(0, 4).map((cl) => ({ cl, m: cream(cl) }));
    // one scale for all four (they are the same rosette), as big as fits every frame with the centre on (FW / 2, CY)
    const k = Math.min(...rib.map(({ cl, m }) => Math.min((FW / 2 - 2) / Math.max(m.cx, cl.w - m.cx), (CY - 2) / m.cy, (FH - CY - 2) / (cl.h - m.cy))));
    const sheet = W.canvas(4 * (FW + GAP) + CUP, Math.max(FH, CUP)), g = sheet.getContext('2d');
    g.imageSmoothingQuality = 'high';
    rib.forEach(({ cl, m }, i) => g.drawImage(cl.c, 0, 0, cl.w, cl.h, i * (FW + GAP) + FW / 2 - m.cx * k, CY - m.cy * k, cl.w * k, cl.h * k));
    const cup = pics[4], kc = Math.min((CUP - 6) / cup.w, (CUP - 6) / cup.h);
    W.draw(g, cup.c, cup, kc, 4 * (FW + GAP) + CUP / 2, null, CUP / 2);
    return Object.assign(W.out(sheet, 0.86), { w: sheet.width, h: sheet.height, k, creams: rib.map(({ m }) => [Math.round(m.w * k), Math.round(m.h * k)]) });
  }, [files.map(data), FW, FH, CY, GAP, CUP]);
  fs.writeFileSync(path.join(OUT, 'contests.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'contests.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/contests', r.w + 'x' + r.h, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp, ribbons at',
    r.k.toFixed(3) + 'x, cream centres (w, h) ' + r.creams.map((c) => c[0] + 'x' + c[1]).join(' '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
