'use strict';
// Name frames: the owner's sheet of the 13 frames (art-src/frames/name_frames.png, 4 x 4 cells, 13 used, in
// C.NAME_FRAMES.keys' order: the 10 boss frames, floor 100 first, then gold, silver, bronze) into the game: each cell cut
// on the grid (where the owner drew it in its cell is where the game expects it: the name's plate is the middle half of
// the cell's height; the outer 30% at each end keeps its shape, the middle stretches with the name), the background
// taken out if it is not see-through, every cell 192 px: assets/name_frames.png and .webp (768 x 768), which
// tools/packs.js puts in the 'frames' pack. The game draws stand-ins until the pack is on the phone
// (src/19zzz...z-name-frames.js paints the sheet over them when it comes).
// Afterwards: node build.js, and the pack file in dist/packs goes to the CDN (app-assets/packs/).
// node tools/art/name-frames-import.js [path/to/sheet.png]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const NF = ctx.window.Farm.Config.NAME_FRAMES;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const sheet = path.resolve(process.argv[2] || path.join(ROOT, 'art-src', 'frames', 'name_frames.png'));
  if (!fs.existsSync(sheet)) throw new Error('no sheet at ' + sheet + ' (the owner\'s 4 x 4 sheet of the name frames)');
  const { chromium } = require('playwright');
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async ([src, n, cell, used, band]) => {
    const img = W.cutout(await W.load(src)), cw = img.width / n, chh = img.height / n;
    const out = W.canvas(n * cell, n * cell), g = out.getContext('2d'), notes = [];
    for (let i = 0; i < n * n; i++) {
      const sx = (i % n) * cw, sy = Math.floor(i / n) * chh;
      if (i >= used) continue; // (the 3 cells after the last frame stay empty)
      g.drawImage(img, sx, sy, cw, chh, (i % n) * cell, Math.floor(i / n) * cell, cell, cell);
      // a check: something drawn across the cell's middle band (the name's plate)
      const d = g.getImageData((i % n) * cell, Math.floor(i / n) * cell, cell, cell).data;
      let x0 = cell, x1 = -1, y0 = cell, y1 = -1;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (d[(y * cell + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 < 0) notes.push('cell ' + (i + 1) + ' is empty');
      else if (y0 > cell * band[0] + 4 || y1 < cell * band[1] - 4 || x1 - x0 < cell * 0.8) notes.push('cell ' + (i + 1) + ': the frame is ' + (x1 - x0 + 1) + ' x ' + (y1 - y0 + 1) + ' px of ' + cell + ', from y ' + y0 + ' to ' + y1 + ' (the plate should fill the cell\'s width and its middle half, ' + Math.round(cell * band[0]) + ' to ' + Math.round(cell * band[1]) + ')');
    }
    return { png: out.toDataURL('image/png'), webp: out.toDataURL('image/webp', 0.8), notes };
  }, [data(sheet), NF.cols, NF.cell, NF.keys.length, NF.band]);
  await b.close();
  save(path.join(ROOT, 'assets', NF.sheet + '.png'), r.png);
  save(path.join(ROOT, 'assets', NF.sheet + '.webp'), r.webp);
  r.notes.forEach((n) => console.warn('look at ' + n));
  console.log(NF.sheet + ':', NF.keys.join(' '), '(' + fs.statSync(path.join(ROOT, 'assets', NF.sheet + '.webp')).size + ' bytes, the frames pack)');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
