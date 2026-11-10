// The typhoon's wind (owner's art, 11 Nov 2026; art-src/WINTER-RIDING-AND-WIND-PROMPTS.md #2):
// art-src/town-raid-anim/wind_streaks.png (4 x 4: each row one gust blowing to the LEFT, its frames: appearing,
// strongest, curling thin, almost gone; row 4 carries leaves) -> assets/ranim_wind.* : 4 columns x 4 rows of FW x FH.
// The wind is soft and see-through, so its glow is kept (no dehalo, which drops all under alpha 96): only the faint
// noise is cleared, and the generator's coloured specks in the glow (pure blue, cyan, yellow) take the colour of what
// is next to them. Every frame is the same window of its cell at one scale: the artist's placement stays, nothing
// jitters between frames. In the 'raiders' pack (tools/packs.js: ranim_*), fetched as Typhoon Night comes
// (src/19zzzzf-town-raid-wind.js, C.TOWN_WIND). node tools/art/town-wind-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'art-src', 'town-raid-anim', 'wind_streaks.png'), OUT = path.join(ROOT, 'assets');
const FW = 320; // keep in step with C.TOWN_WIND.fw (FH is printed: C.TOWN_WIND.fh)
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async ([src, FW]) => {
    const im = await W.load(src), c = W.canvas(im.width, im.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const w = c.width, h = c.height, id = g.getImageData(0, 0, w, h), d = id.data, was = d.slice(), cw = w / 4, ch = h / 4;
    // a speck's colour: the solid wind (or leaf) within 4 px, else the wind's pale blue-white
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = was[i + 3];
      if (!a) continue;
      if (a < 6) { d[i + 3] = 0; continue; }
      if (a >= 120) continue;
      // (a speck: every channel near 0 or near 255, a pure blue, cyan, yellow, red or green; a leaf's own colours stay)
      const pure = [0, 1, 2].every((q) => was[i + q] < 48 || was[i + q] > 207) && !(was[i] > 207 && was[i + 1] > 207 && was[i + 2] > 207);
      if (!pure) continue;
      let r = 0, gg = 0, bb = 0, n = 0;
      for (let v = Math.max(0, y - 4); v <= Math.min(h - 1, y + 4); v++) for (let u = Math.max(0, x - 4); u <= Math.min(w - 1, x + 4); u++) {
        const k = (v * w + u) * 4;
        if (was[k + 3] >= 160) { r += was[k]; gg += was[k + 1]; bb += was[k + 2]; n++; }
      }
      if (n) { d[i] = r / n; d[i + 1] = gg / n; d[i + 2] = bb / n; } else { d[i] = 226; d[i + 1] = 238; d[i + 2] = 250; }
    }
    g.putImageData(id, 0, 0);
    // one window for every cell: what any frame covers (alpha 12 and up), in its cell, with a little room
    let x0 = cw, x1 = 0, y0 = ch, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 12) {
      const u = x % cw, v = y % ch;
      if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v;
    }
    x0 = Math.max(0, x0 - 6); y0 = Math.max(0, y0 - 6); x1 = Math.min(cw - 1, x1 + 6); y1 = Math.min(ch - 1, y1 + 6);
    const k = FW / (x1 - x0 + 1), FH = Math.round((y1 - y0 + 1) * k), o = W.canvas(FW * 4, FH * 4), og = o.getContext('2d');
    og.imageSmoothingQuality = 'high';
    for (let i = 0; i < 16; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      og.drawImage(c, col * cw + x0, row * ch + y0, x1 - x0 + 1, y1 - y0 + 1, col * FW, row * FH, FW, FH);
    }
    return Object.assign(W.out(o, 0.8), { FH, box: [x0, y0, x1, y1] });
  }, [data(SRC), FW]);
  fs.writeFileSync(path.join(OUT, 'ranim_wind.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'ranim_wind.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/ranim_wind', FW * 4 + 'x' + r.FH * 4, (fs.statSync(path.join(OUT, 'ranim_wind.webp')).size / 1024).toFixed(0) + ' KB', 'frame', FW + 'x' + r.FH, 'window', r.box.join(','));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
