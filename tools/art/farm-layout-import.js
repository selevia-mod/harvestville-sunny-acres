// Edit Farm part 1 (docs/edit-farm.md): the owner's pictures for the buildings that leave the farm map
// (art-src/FARM-LAYOUT-PROMPTS.md): art-src/farm-layout/<name>.png -> assets/props/<key>.png/.webp. Each is cut out,
// cropped to its drawing and fitted (whole, not stretched) into a picture the exact shape of the piece, bottom-centred,
// at the props' 128 px a tile (a yard picture is drawn over its piece's box: 19f-yard.js renderYard).
// The house is drawn like the other house levels (19d-home.js showHouse): 5 tiles wide, 5 tall, standing on its block.
// node tools/art/farm-layout-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), ART = path.join(ROOT, 'art-src', 'farm-layout'), OUT = path.join(ROOT, 'assets', 'props');
const U = 96; // (e54, 11 Nov 2026: 96 px a tile, not the props' 128: the page was over its limit with these four in it; drawn over the box all the same)
const PIECES = [
  { src: 'house_1', key: 'house_1', w: 5, h: 5, q: 0.66 },
  // (owner, 11 Nov 2026: the barn and coop only, the doghouse only, a new pond; all at 30 degrees like the new characters)
  { src: 'ranch', key: 'ranch', w: 9, h: 4, q: 0.66 },
  { src: 'doghouse', key: 'dog_yard', w: 2, h: 2, q: 0.7 },
  { src: 'pond', key: 'farm_pond', w: 5, h: 4, q: 0.66 },
];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  for (const pc of PIECES) {
    const r = await p.evaluate(async ([src, OW, OH, Q]) => {
      const c = W.dehalo(W.cutout(await W.load(src))), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, o = W.canvas(OW, OH), k = Math.min(o.width / cw, o.height / ch);
      const og = o.getContext('2d');
      og.imageSmoothingQuality = 'high';
      og.drawImage(c, x0, y0, cw, ch, (o.width - cw * k) / 2, o.height - ch * k, cw * k, ch * k);
      return Object.assign(W.out(o, Q), { cw, ch, k });
    }, [data(path.join(ART, pc.src + '.png')), pc.w * (pc.u || U), pc.h * (pc.u || U), pc.q || 0.72]);
    fs.writeFileSync(path.join(OUT, pc.key + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, pc.key + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    console.log('assets/props/' + pc.key, pc.w * (pc.u || U) + 'x' + pc.h * (pc.u || U), 'drawing ' + r.cw + 'x' + r.ch, (fs.statSync(path.join(OUT, pc.key + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
