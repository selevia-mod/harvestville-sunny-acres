'use strict';
// The Tailor Shop looks at the 30-degree camera (owner's pictures, approved 11 Nov 2026; 30DEG-PROMPTS.md 54-137), cut
// into the farmer's own sheet layouts, the way his own sheets are cut, so a look walks, swings and shoots exactly where
// his farm clothes do:
//   art-src/looks/<look>-<boy|girl>-walk.png (3 x 3) + -tools.png (3 x 2)
//        -> art-src/looks/cut/<look>-<boy|girl>.png         15 frames of 256 x 384 (9 walk, then 6 tool swings), 1024 x 2048
//   art-src/looks/<look>-<boy|girl>-archer.png (3 x 3)
//        -> art-src/looks/cut/<look>-<boy|girl>-archer.png  9 frames of 288 x 384, 912 x 1200
// Then: node tools/art/tailor-import.js (the WebP copies for the CDN and the shop's pictures).
// (The old cutter, look-cut.cjs, stood each pose on the old farmer's EDIT TARGET pictures; there are none at 30 degrees.)
// How: the walk as the farmer's (tools/art/import.js 'frames': one scale for the 9, the tallest filling the frame, each
// pose's middle on the frame's middle and its feet on line 372), times the look's SIZE below (a tall hat would otherwise
// make the farmer under it smaller: SIZE brings his body back to the farm clothes' size, judged against them). The tool
// swings and the bow are sized from the walk: each sheet's front pose stands as tall next to the look's walk as the
// farmer's own does next to his (tools: arms down, 0.98; bow: ready, 0.916), so a hat counts the same in all three.
// The bow poses are stood like tools/art/archer-import.js's: the feet's middle on the frame's middle. Anything past a
// frame's edge is reported (and the sheet made a little smaller to fit). Background: the flat magenta out, the magenta
// shut inside the drawing too, the generator's edge glow and the faint shadows under the feet (owner's list, 11 Nov).
// node tools/art/looks-cut.js [look ...]   (none: all 14)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'looks');
const OUT = path.join(SRC, 'cut');
const LOOKS = ['elf', 'straw', 'ranch', 'winter', 'flower', 'santa', 'fiesta', 'bunny', 'fire', 'terrace', 'hills', 'lake', 'forest', 'feather'];
// a look's size against the farm clothes (1: as cut by its own tallest pose). Below 1 never; above 1 for a look whose
// headwear stands well above the farmer's cap, so the body under it is the farmer's size (judged in a line-up, 12 Nov 2026)
const SIZE = { default: 1 };
const TOOLS_K = 0.98, BOW_K = 0.916; // (the farmer's: tools frame 10 is 349 of his walk's 356; his bow front, 327 of 357)

(async () => {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : LOOKS;
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  await p.addScriptTag({ content: `
    // a look's picture: magenta out (also shut inside), its dark magenta shadow and pockets out, the edge glow softened
    window.clean = async (src) => {
      const c = W.cutout(await W.load(src), { holes: true }), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), q = d.data;
      for (let i = 0; i < q.length; i += 4) { const r = q[i], gg = q[i + 1], bl = q[i + 2]; if (q[i + 3] && r - gg > 40 && bl - gg > 40 && gg < 90 && Math.abs(r - bl) < 90 && bl - r < 30) q[i + 3] = 0; }
      g.putImageData(d, 0, 0);
      return W.dehalo(c);
    };
    // the feet's middle: the solid pixels in the bottom 14 % of a piece
    window.feetMid = (x) => {
      const d = x.c.getContext('2d').getImageData(0, 0, x.w, x.h).data, y0 = Math.round(x.h * 0.86);
      let lo = x.w, hi = -1;
      for (let y = y0; y < x.h; y++) for (let X = 0; X < x.w; X++) if (d[(y * x.w + X) * 4 + 3] > 128) { if (X < lo) lo = X; if (X > hi) hi = X; }
      return hi < 0 ? x.w / 2 : (lo + hi) / 2;
    };
    // lays pieces into frames: k their scale, mid(x) the point of each that goes on the frame's middle; returns what was cut off
    window.lay = (g, cl, first, cols, fw, k, mid) => {
      const cut = [];
      cl.forEach((x, i) => {
        const f = first + i, fx = 8 + (f % cols) * (fw + 16), fy = 8 + Math.floor(f / cols) * 400;
        const left = fw / 2 - mid(x) * k, top = 372 - x.h * k, over = Math.max(0, -left, left + x.w * k - fw, -top);
        if (over > 0.5) cut.push(f + ':' + Math.ceil(over));
        g.save(); g.beginPath(); g.rect(fx, fy, fw, 384); g.clip();
        g.imageSmoothingQuality = 'high';
        g.drawImage(x.c, 0, 0, x.w, x.h, fx + left, fy + top, x.w * k, x.h * k);
        g.restore();
      });
      return cut;
    };
    window.room = (cl, k, fw, mid) => Math.min(1, ...cl.map((x) => Math.min(372 / (x.h * k), (fw / 2) / (mid(x) * k), (fw / 2) / ((x.w - mid(x)) * k))));
  ` });
  for (const look of keys) for (const who of ['boy', 'girl']) {
    const src = (part) => 'data:image/png;base64,' + fs.readFileSync(path.join(SRC, `${look}-${who}-${part}.png`)).toString('base64');
    const r = await p.evaluate(async ([walk, tools, bow, size, TOOLS_K, BOW_K]) => {
      const cw = W.cells(await clean(walk), 3, 3, 0.02), ct = W.cells(await clean(tools), 3, 2, 0.02), ca = W.cells(await clean(bow), 3, 3, 0.02);
      [cw, ct, ca].forEach((cl, j) => cl.forEach((x, i) => { if (!x) throw new Error(['walk', 'tools', 'archer'][j] + ' pose ' + (i + 1) + ' is missing'); }));
      const centre = (x) => x.w / 2;
      // the walk: as the farmer's, times the look's size; never past the frame (then all three a little smaller)
      let kw = Math.min(...cw.map((x) => Math.min(256 * 0.94 / x.w, 372 * 0.96 / x.h))) * size;
      const hw = cw[0].h * kw; // (its standing front pose's height in the frame)
      let kt = hw * TOOLS_K / ct[1].h, ka = hw * BOW_K / ca[0].h;
      const fit = Math.min(room(cw, kw, 256, centre), room(ct, kt, 256, centre), room(ca, ka, 288, feetMid));
      kw *= fit; kt *= fit; ka *= fit;
      const sheet = W.canvas(1024, 2048), g = sheet.getContext('2d'), arch = W.canvas(912, 1200), ga = arch.getContext('2d');
      const cut = lay(g, cw, 0, 3, 256, kw, centre).concat(lay(g, ct, 9, 3, 256, kt, centre), lay(ga, ca, 0, 3, 288, ka, feetMid).map((s) => 'A' + s));
      return { sheet: sheet.toDataURL('image/png'), arch: arch.toDataURL('image/png'), k: [kw, kt, ka].map((x) => +x.toFixed(4)), fit: +fit.toFixed(3), cut };
    }, [src('walk'), src('tools'), src('archer'), SIZE[look] || 1, TOOLS_K, BOW_K]).catch((e) => { throw new Error(`${look}-${who}: ${e.message}`); });
    fs.writeFileSync(path.join(OUT, `${look}-${who}.png`), Buffer.from(r.sheet.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, `${look}-${who}-archer.png`), Buffer.from(r.arch.split(',')[1], 'base64'));
    console.log(`${look}-${who}`.padEnd(14), 'scales walk/tools/bow', r.k.join(' / '), r.fit < 1 ? '(made ' + r.fit + ' to fit)' : '', r.cut.length ? 'cut off: ' + r.cut.join(' ') : '');
  }
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
