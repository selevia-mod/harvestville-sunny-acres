'use strict';
// The farmer boy and girl and the villagers at the 30-degree camera (owner's pictures, approved 11 Nov 2026;
// ~/Downloads/30deg-characters/30DEG-PROMPTS.md 1-4 and 8-31, 38-43), into the sheets they always were in, frame for frame:
//   art-src/characters/farmer_walk.png (3 x 3) and farmer_tools.png (3 x 2) -> assets/player      frames 0-8 and 9-14 of 256 x 384
//   art-src/characters/girl_walk.png and girl_tools.png                     -> assets/player_girl frames 0-8 and 9-14
//   art-src/characters/<villager, visitor, trader>.png (3 x 3)             -> assets/people     9 frames of 128 x 192 each, in
//                                                                              C.VILLAGER_ORDER, then C.SHOPPERS, then C.TRADER
// Each picture is cut by the very code that cut the old ones (tools/art/import.js, 'frames' mode: one scale for a
// picture's poses, each pose's feet on the frame's ground line: 372 of 384, 186 of 192), so the game's frames, tools
// and feet stay where they were. tools/make-art.js made these sheets once (it draws every sheet, and can no longer run
// whole: its art list is out of date); this paints only these frames into the sheets as they are. Before cutting, the
// generator's leftovers round a figure go: the faint haze (alpha under 24) and any faint piece away from the drawing (a
// soft shadow under the feet), so a pose's feet, not its shadow, stand on the line. Then: node tools/art/squeeze.js
// player player_girl people (the WebP copies the page carries, at their usual quality).
// node tools/art/characters-import.js [player] [player_girl] [people]   (none: all three)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ART = path.join(ROOT, 'art-src', 'characters');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const ORDER = C.VILLAGER_ORDER.concat(C.SHOPPERS.map((x) => x.key), C.TRADER.key);
const PLAYER = { fw: 256, fh: 384, base: 372, cols: 3, at: (f) => [8 + (f % 3) * 272, 8 + Math.floor(f / 3) * 400] };
const PEOPLE = { fw: 128, fh: 192, base: 186, cols: 18, at: (f) => [8 + (f % 18) * 144, 8 + Math.floor(f / 18) * 208] };
const SHEETS = {
  player: [PLAYER, [['farmer_walk', 3, 3, 0], ['farmer_tools', 3, 2, 9]]],
  player_girl: [PLAYER, [['girl_walk', 3, 3, 0], ['girl_tools', 3, 2, 9]]],
  people: [PEOPLE, ORDER.map((v, i) => [v, 3, 3, i * 9])],
};
const ONLY = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHEETS);

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluate(() => { window.ART = {}; });
  await p.addScriptTag({ path: path.join(__dirname, 'import.js') });
  for (const sheet of ONLY) {
    const [L, pics] = SHEETS[sheet];
    if (!L) throw new Error('no sheet ' + sheet);
    const jobs = [];
    for (const [file, cols, rows, first] of pics) {
      const f = path.join(ART, file + '.png');
      if (!fs.existsSync(f)) throw new Error('art-src/characters/' + file + '.png is missing');
      // the haze and the faint loose pieces (a shadow under the feet) out, before the cut
      const data = await p.evaluate(async (src) => {
        const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), q = d.data, R = 4;
        if (q[3] > 32 || q[(w * h - 1) * 4 + 3] > 32) return src; // (not see-through: import.js takes the flat background away)
        // near: within R px of a solid pixel (alpha 200 and up): the drawing's own soft edge
        const solid = new Uint8Array(w * h), row = new Uint8Array(w * h), near = new Uint8Array(w * h);
        for (let k = 0; k < w * h; k++) solid[k] = q[k * 4 + 3] >= 200 ? 1 : 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let on = 0;
          for (let u = Math.max(0, x - R); u <= Math.min(w - 1, x + R) && !on; u++) on = solid[y * w + u];
          row[y * w + x] = on;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let on = 0;
          for (let v = Math.max(0, y - R); v <= Math.min(h - 1, y + R) && !on; v++) on = row[v * w + x];
          near[y * w + x] = on;
        }
        for (let k = 0; k < w * h; k++) {
          const a = q[k * 4 + 3];
          if (a && (a < 24 || (a < 160 && !near[k]))) q[k * 4 + 3] = 0;
        }
        g.putImageData(d, 0, 0);
        return c.toDataURL('image/png');
      }, 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
      jobs.push({ id: sheet + '_' + file, file: 'characters/' + file + '.png', mode: 'frames', sheet, cols, rows, fw: L.fw, fh: L.fh, base: L.base,
        frames: Array.from({ length: cols * rows }, (_, k) => first + k), data });
    }
    await p.evaluate((list) => { window.ART.OVR = {}; return window.ART.prepareOverrides(list); }, jobs);
    const r = await p.evaluate(async ([sheet, src, L, frames]) => {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const report = [];
      for (const f of frames) {
        const fr = window.ART.OVR[sheet + ':' + f];
        if (!fr) throw new Error(sheet + ': frame ' + f + ' is missing');
        const x = 8 + (f % L.cols) * (L.fw + 16), y = 8 + Math.floor(f / L.cols) * (L.fh + 16);
        g.clearRect(x, y, L.fw, L.fh);
        g.drawImage(fr, x, y);
        // where the figure is in its frame: its top, its bottom (alpha over 24) and its width
        const d = g.getImageData(x, y, L.fw, L.fh).data;
        let top = L.fh, bot = -1, x0 = L.fw, x1 = -1;
        for (let yy = 0; yy < L.fh; yy++) for (let xx = 0; xx < L.fw; xx++) if (d[(yy * L.fw + xx) * 4 + 3] > 24) { if (yy < top) top = yy; bot = yy; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
        report.push([f, top, bot, x1 - x0 + 1]);
      }
      return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.86), report };
    }, [sheet, 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, sheet + '.png')).toString('base64'), { fw: L.fw, fh: L.fh, cols: L.cols },
      jobs.flatMap((j) => j.frames)]);
    fs.writeFileSync(path.join(OUT, sheet + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, sheet + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    console.log('assets/' + sheet, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp (before squeeze.js)');
    // each picture's frames: [frame, top, bottom, width]; a row's tops should match (no bobbing), its bottoms are the line
    for (const j of jobs) console.log('  ' + j.file.padEnd(32), j.frames.map((f) => { const q = r.report.find((x) => x[0] === f); return q[1] + '-' + q[2] + '/' + q[3]; }).join(' '));
  }
  await b.close();
  if (errors.length) throw new Error(errors.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
