// Riding v2, a real gallop (owner's art, approved 11 Nov 2026; art-src/RIDING-V2-PROMPTS.md):
//   art-src/riding/v2/horse.png               the saddled horse alone        -> assets/ride2_horse(.shade)
//   art-src/riding/v2/<outfit>-<boy|girl>.png the farmer riding it           -> assets/ride2_<outfit>_<who>(.shade)
// Each a 4 x 4 grid (any size: the cells are cut by fractions, a 1254 px picture's are 313.5 px): row 1 galloping toward
// you, row 2 away, row 3 to the LEFT (4 frames each), row 4 standing toward you, away, left, and rearing (left).
// Out: 4 x 4 frames of FW x FH (C.RIDE2.fw/fh), in the same order, frame n = row * 4 + column. Every cell is drawn whole
// at one scale for the picture (its share of the picture, so a 1254 px one comes out the size of a 1536 px one), its
// middle on the frame's middle, so the artist's steps stay where they were drawn (nothing jitters). A gallop row stands
// on one ground line (the lowest hooves of its 4 frames: the leap stays up in the air); each standing frame on its own.
// That line is FEET in the frame, as the old sheets' (233 of 252: the animals' origin). The edge glow and the
// generator's coloured specks go (dehalo). The shadow sheet (ride2_*shade): a soft oval on the ground line under each
// frame (it stays down in the leap). Both are in the 'riding' pack (tools/packs.js). Prints each sheet's frame-14
// (standing, left) horse width: C.RIDE2.px.  node tools/art/riding-v2-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'art-src', 'riding', 'v2'), OUT = path.join(ROOT, 'assets');
const FW = 252, FH = 252, FEET = 233, K = 0.6; // (K: for a 1536 px picture; keep FW/FH in step with C.RIDE2)
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f === 'horse.png' || /^[a-z]+-(boy|girl)\.png$/.test(f)).sort() : [];
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  for (const f of files) {
    const name = f === 'horse.png' ? 'ride2_horse' : 'ride2_' + f.slice(0, -4).replace('-', '_');
    const r = await p.evaluate(async ([src, FW, FH, FEET, K]) => {
      const im = await W.load(src), w = im.width, h = im.height, cw = w / 4, ch = h / 4, k = K * 1536 / w;
      // each cell's pieces (a piece goes to the cell its middle is in: a tall pose reaching into the next row stays its own)
      const cl = W.cells(W.dehalo(W.cutout(im)), 4, 4, 0.02);
      cl.forEach((x, i) => { if (!x) throw new Error('frame ' + i + ' is missing'); });
      // its ground: the bottom of its biggest piece (the horse, with its rider), in its cell
      const g16 = cl.map((x, i) => x.foot - Math.floor(i / 4) * ch);
      const line = g16.map((g, i) => (i < 12 ? Math.max(g16[i - i % 4], g16[i - i % 4 + 1], g16[i - i % 4 + 2], g16[i - i % 4 + 3]) : g));
      const o = W.canvas(FW * 4, FH * 4), g = o.getContext('2d', { willReadFrequently: true }), sh = W.canvas(FW * 4, FH * 4), sg = sh.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const widths = [];
      for (let i = 0; i < 16; i++) {
        const fx = (i % 4) * FW, fy = Math.floor(i / 4) * FH, sx = (i % 4) * cw, sy = Math.floor(i / 4) * ch;
        g.save(); g.beginPath(); g.rect(fx, fy, FW, FH); g.clip();
        const x = cl[i]; // (placed as in its cell: the cell's middle on the frame's middle, its ground on FEET)
        g.drawImage(x.c, 0, 0, x.w, x.h, fx + FW / 2 + (x.left - sx - cw / 2) * k, fy + FEET + (x.top - sy - line[i]) * k, x.w * k, x.h * k);
        g.restore();
        // what it covers in its frame, for its shadow (and its width)
        const px = g.getImageData(fx, fy, FW, FH).data;
        let x0 = FW, x1 = -1, y1 = -1;
        for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (px[(y * FW + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (x1 < 0) throw new Error('frame ' + i + ' came out empty');
        if (x0 <= 0 || x1 >= FW - 1 || y1 >= FH - 1) throw new Error('frame ' + i + ' does not fit its ' + FW + ' x ' + FH + ' frame');
        widths.push(x1 - x0 + 1);
        const bw = x1 - x0 + 1, side = i >= 8 && i !== 12 && i !== 13, rx = side ? bw * 0.36 : bw * 0.42;
        sg.save(); sg.beginPath(); sg.rect(fx, fy, FW, FH); sg.clip();
        sg.filter = 'blur(5px)'; sg.fillStyle = 'rgba(0,0,0,0.42)';
        sg.beginPath(); sg.ellipse(fx + (x0 + x1) / 2 + 2, fy + FEET - 3, rx, Math.max(9, rx * (side ? 0.22 : 0.3)), 0, 0, 7); sg.fill();
        sg.restore();
      }
      return Object.assign(W.out(o, 0.8), { shade: W.out(sh, 0.7), widths, line: g16 });
    }, [data(path.join(SRC, f)), FW, FH, FEET, K]);
    const put = (n, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, n), buf); return (buf.length / 1024).toFixed(0) + ' KB'; };
    put(name + '.png', r.png);
    put(name + 'shade.png', r.shade.png);
    console.log('assets/' + name, FW * 4 + 'x' + FH * 4, put(name + '.webp', r.webp), '+ shade', put(name + 'shade.webp', r.shade.webp),
      '; px (frame 14)', r.widths[14], '; widths', r.widths.join(','), '; ground in cell', r.line.map((x) => Math.round(x)).join(','));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
