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
// frame (it stays down in the leap), stored at half the size. Each rider's sheet is first brought to the farm clothes'
// boy's size (`ref`), and the horse alone to his pony's width galloping (`side`), (assets/sizes.json holds the full size). The standing row is brought to its gallop rows' scale (see `fit`). Both are in the 'riding' pack (tools/packs.js). Prints each sheet's frame-14
// (standing, left) horse width: C.RIDE2.px.  node tools/art/riding-v2-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'art-src', 'riding', 'v2'), OUT = path.join(ROOT, 'assets');
const FW = 252, FH = 252, FEET = 233, K = 0.6, SHADE = 2; // (K: for a 1536 px picture; keep FW/FH in step with C.RIDE2)
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
// (the farm clothes' boy first: every rider's sheet is brought to his size, see `ref`)
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f === 'horse.png' || /^[a-z]+-(boy|girl)\.png$/.test(f))
  .sort((a, c) => (a === 'default-boy.png' ? -1 : c === 'default-boy.png' ? 1 : a < c ? -1 : a > c ? 1 : 0)) : [];
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
  let ref = 0, side = 0;
  for (const f of files) {
    const name = f === 'horse.png' ? 'ride2_horse' : 'ride2_' + f.slice(0, -4).replace('-', '_');
    const cut = (ref, hn) => p.evaluate(async ([src, FW, FH, FEET, K, SHADE, ref, hn]) => {
      const im = await W.load(src), w = im.width, h = im.height, cw = w / 4, ch = h / 4;
      // each cell's pieces (a piece goes to the cell its middle is in: a tall pose reaching into the next row stays its own)
      const cl = W.cells(W.dehalo(W.cutout(im)), 4, 4, 0.02);
      cl.forEach((x, i) => { if (!x) throw new Error('frame ' + i + ' is missing'); });
      // its ground: the bottom of its biggest piece (the horse, with its rider), in its cell
      const g16 = cl.map((x, i) => x.foot - Math.floor(i / 4) * ch);
      // (owner, 11 Nov 2026: "running and standing are different size": the generator drew row 4, standing, bigger than
      // the gallop rows, mostly its horse; the rider's cap hardly changes.) Each standing frame is brought to the scale of
      // its direction's gallop row (toward you: row 1, away: row 2, left and rearing: row 3), measured by the square root
      // of what it covers (horse and rider), which the legs' pose hardly changes, unlike its height. The rearing horse is
      // folded up (less to see), so it takes the standing-left frame's scale.
      const size = cl.map((x) => { const q = x.c.getContext('2d').getImageData(0, 0, x.w, x.h).data; let n = 0; for (let j = 3; j < q.length; j += 4) if (q[j] > 128) n++; return Math.sqrt(n); });
      const rowSize = (r) => (size[r * 4] + size[r * 4 + 1] + size[r * 4 + 2] + size[r * 4 + 3]) / 4;
      // (owner, 11 Nov 2026: the cute pony set: the generator drew some outfits up to 15 % smaller or bigger than others.)
      // Every rider's sheet is brought to the farm clothes' boy's size: its gallop rows (what they cover, as a share of the
      // picture) the same as his. The horse alone keeps its picture's share (it has no rider to measure against).
      const gal = (rowSize(0) + rowSize(1) + rowSize(2)) / 3 * 1536 / w, norm = ref ? ref / gal : hn || 1, k = K * 1536 / w * norm;
      const fit = (r, i) => Math.max(0.8, Math.min(1.05, rowSize(r) / size[i]));
      const sc = cl.map(() => 1);
      sc[12] = fit(0, 12); sc[13] = fit(1, 13); sc[14] = fit(2, 14); sc[15] = sc[14];
      const line = g16.map((g, i) => (i < 12 ? Math.max(g16[i - i % 4], g16[i - i % 4 + 1], g16[i - i % 4 + 2], g16[i - i % 4 + 3]) : g));
      const o = W.canvas(FW * 4, FH * 4), g = o.getContext('2d', { willReadFrequently: true }), sh = W.canvas(FW * 4, FH * 4), sg = sh.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const widths = [];
      for (let i = 0; i < 16; i++) {
        const fx = (i % 4) * FW, fy = Math.floor(i / 4) * FH, sx = (i % 4) * cw, sy = Math.floor(i / 4) * ch;
        g.save(); g.beginPath(); g.rect(fx, fy, FW, FH); g.clip();
        const x = cl[i]; // (placed as in its cell: the cell's middle on the frame's middle, its ground on FEET)
        const kk = k * sc[i]; // (a standing frame at its gallop row's scale, its hooves still on FEET)
        g.drawImage(x.c, 0, 0, x.w, x.h, fx + FW / 2 + (x.left - sx - cw / 2) * kk, fy + FEET + (x.top - sy - line[i]) * kk, x.w * kk, x.h * kk);
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
      // (the shadows stored at half the size, a quarter of the memory: they are soft; the game draws them at full size)
      const small = W.canvas(FW * 4 / SHADE, FH * 4 / SHADE), smg = small.getContext('2d');
      smg.imageSmoothingQuality = 'high';
      smg.drawImage(sh, 0, 0, small.width, small.height);
      return Object.assign(W.out(o, 0.8), { shade: W.out(small, 0.7), widths, line: g16, sc: sc.slice(12), gal, norm });
    }, [data(path.join(SRC, f)), FW, FH, FEET, K, SHADE, ref, hn]);
    let r = await cut(f === 'horse.png' ? 0 : ref, 1);
    // the horse alone: as wide galloping to the left as the farm clothes' boy's pony (it has no rider to measure by)
    if (f === 'horse.png') r = await cut(0, side / (r.widths.slice(8, 12).reduce((a, x) => a + x, 0) / 4));
    if (f === 'default-boy.png') { ref = r.gal; side = r.widths.slice(8, 12).reduce((a, x) => a + x, 0) / 4; }
    const put = (n, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, n), buf); return (buf.length / 1024).toFixed(0) + ' KB'; };
    put(name + '.png', r.png);
    put(name + 'shade.png', r.shade.png);
    sizes[name + 'shade'] = [FW * 4, FH * 4]; // (its full size: 10-boot.js ensureTexture)
    console.log('assets/' + name, FW * 4 + 'x' + FH * 4, put(name + '.webp', r.webp), '+ shade', put(name + 'shade.webp', r.shade.webp),
      '; px (frame 14)', r.widths[14], '; widths', r.widths.join(','), '; ground in cell', r.line.map((x) => Math.round(x)).join(','), '; standing scaled', r.sc.map((x) => x.toFixed(3)).join(','), '; sheet scaled', r.norm.toFixed(3));
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
