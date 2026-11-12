// The Lost Tower's doors up (owner, 12 Nov 2026: "that door should be around the wall"; prompts
// art-src/LOST-TOWER-DOOR-PROMPTS.md): art-src/tower-doors/zone<n>/door.png, shut on the left and open on the right, become
// assets/props/tower_stairs_<n> (C.TOWER zone art.gate), both halves at one scale, each centred, standing on the same line,
// side by side 4 px apart (19zt-lair.js gateFrame splits them). The game draws it DOOR.w tiles wide in the back wall
// (19zt-lair.js). In the 'tower' pack (tools/tower/tower-art.js), never the page.
//   node tools/tower/door-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'tower-doors');
const OUT = path.join(ROOT, 'assets');
const PPT = 160; // pixels a tile, as the Lair's gate
const DOOR_W = 3.2; // tiles wide, each half: the arch and its two bits of wall (19zt-lair.js DOOR.art)
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('../art/wild-lib') });
  for (let n = 1; n <= 10; n++) {
    const f = path.join(SRC, 'zone' + n, 'door.png');
    if (!fs.existsSync(f)) { console.log('zone ' + n + ': no door yet'); continue; }
    const r = await p.evaluate(async ([src, fw]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
      if (!cl[0] || !cl[1]) throw new Error('the door needs both halves');
      const k = fw / Math.max(cl[0].w, cl[1].w), fh = Math.ceil(Math.max(cl[0].h, cl[1].h) * k), GAP = 4, o = W.canvas(fw * 2 + GAP, fh), g = o.getContext('2d');
      cl.forEach((x, i) => W.draw(g, x.c, x, k, i * (fw + GAP) + fw / 2, fh));
      return Object.assign(W.out(o, 0.85), { w: o.width, h: fh });
    }, [data(f), Math.round(DOOR_W * PPT)]);
    const name = 'props/tower_stairs_' + n, buf = Buffer.from(r.webp.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64')); // (build.js lists props by their .png)
    fs.writeFileSync(path.join(OUT, name + '.webp'), buf);
    console.log(('assets/' + name).padEnd(30), r.w + 'x' + r.h, (buf.length / 1024).toFixed(0) + ' KB webp');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
