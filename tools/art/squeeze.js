'use strict';
// Android's WebView will not open a page of 20 MiB or more: it stays on a blank screen, with no error (found on the
// OPPO, 31 Oct 2026, at 21.2 MB; iPhones open it). build.js stops at PAGE_LIMIT. This compresses the sheets a little
// harder from their PNGs, at the same size in pixels. Run it after npm run art or any importer, which write fuller copies.
// node tools/art/squeeze.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', '..', 'assets');
const Q = { people: 0.6, items: 0.72, wild: 0.7, crops: 0.72, animals: 0.72, seasons: 0.72, player: 0.72, player_girl: 0.72, player_bday: 0.72, player_girl_bday: 0.72, indoor: 0.72, kanor: 0.72 };
const FURN = 0.68, PROP = 0.68, PROP_MIN = 30000;

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const list = [];
  fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).forEach((f) => {
    const n = f.slice(0, -4), q = /^furn_/.test(n) ? FURN : Q[n];
    if (q) list.push([n, q]);
  });
  fs.readdirSync(path.join(OUT, 'props')).filter((f) => f.endsWith('.png')).forEach((f) => {
    const n = 'props/' + f.slice(0, -4);
    if (fs.statSync(path.join(OUT, n + '.webp')).size > PROP_MIN) list.push([n, PROP]);
  });
  let saved = 0;
  for (const [n, q] of list) {
    const src = 'data:image/webp;base64,' + fs.readFileSync(path.join(OUT, n + '.webp')).toString('base64');
    const png = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, n + '.png')).toString('base64');
    const url = await p.evaluate(async ([src, png, q]) => {
      const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = s; });
      const now = await load(src), raw = await load(png), c = document.createElement('canvas'); // the size it ships at (some are stored smaller than their PNG)
      c.width = now.width; c.height = now.height;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(raw, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', q);
    }, [src, png, q]);
    const buf = Buffer.from(url.split(',')[1], 'base64'), file = path.join(OUT, n + '.webp'), was = fs.statSync(file).size;
    if (buf.length < was) { fs.writeFileSync(file, buf); saved += was - buf.length; }
  }
  await b.close();
  console.log('saved', (saved / 1e6).toFixed(2), 'MB of webp in', list.length, 'sheets');
})().catch((e) => { console.error(e); process.exit(1); });
