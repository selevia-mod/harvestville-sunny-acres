'use strict';
// The Tailor Shop (owner, 2-3 Nov 2026): Tita Luz, her shop, and the 8 looks, from the finished art in
// ~/Documents/harvest-hat-art (looks-final: the shop and Tita Luz; looks-cutter/out: each look already cut into the
// farmer's own sheet layout, stood on the old farmer's feet). Writes:
//   assets/tita_luz.png/.webp          her 3x3 walking frames of 256x384, like Kanor (in the page)
//   assets/props/tailor_shop.*         the shop at 160 px a tile, 5 by 4 (in the page)
//   assets/looks_thumbs.png/.webp      each look's front pose, boy then girl, 128 x 192 (in the page: the shop's list)
//   assets/looks/<look>-<boy|girl>.webp and -archer.webp   the 36 look sheets: NOT in the page (6 MB). They go on the
//                                      CDN (app-assets/packs/look-<name>.<hash>.webp: build.js; looks/v1/ before the
//                                      30-degree pictures) and come in through the app (19zj-looks.js).
// The Fire look (the Lair's, 5 Nov 2026) was cut in this repo, not in harvest-hat-art: tools/art/fire-look-cut.cjs writes
// art-src/looks/cut/, the same layout as looks-cutter/out, and a look found there is taken from there.
// node tools/art/tailor-import.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { PROPS } = require('../tiles');

const ROOT = path.join(__dirname, '..', '..');
const ART = path.join(os.homedir(), 'Documents', 'harvest-hat-art');
const OUT = path.join(ROOT, 'assets');
const LOOKS = ['elf', 'straw', 'ranch', 'winter', 'flower', 'santa', 'fiesta', 'bunny', 'fire', 'terrace', 'hills', 'lake', 'forest', 'feather']; // (the five caves' looks: 8 Nov 2026, tools/art/look-cut.cjs)
const cutOf = (name) => {
  const here = path.join(ROOT, 'art-src', 'looks', 'cut', name + '.png');
  return fs.existsSync(here) ? here : path.join(ART, 'looks-cutter', 'out', name + '.png');
};
const PPT = 160;
// (Tita Luz at the 30-degree camera, 12 Nov 2026; the looks: tools/art/looks-cut.js writes art-src/looks/cut/ for all 14)
const LUZ30 = path.join(ROOT, 'art-src', 'tailor', 'shop-keeper-clean.png');

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r, png) => {
  if (png !== false) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(34), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};
const LIB = require('./wild-lib');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: LIB });

  // ---------- Tita Luz: 3x3 frames of 256x384 (rows: down, up, side; cols: still, step, step), like Kanor ----------
  const luz = await p.evaluate(async (src) => {
    const c = W.cutout(await W.load(src)), cl = W.cells(c, 3, 3);
    if (cl.some((x) => !x)) throw new Error('tita_luz: a frame is missing');
    const sheet = W.canvas(8 * 2 + 3 * 256 + 2 * 16, 8 * 2 + 3 * 384 + 2 * 16), g = sheet.getContext('2d');
    const k = Math.min(...cl.map((x) => Math.min(240 / x.w, 360 / x.h)));
    cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + (i % 3) * 272 + 128, 8 + Math.floor(i / 3) * 400 + 376));
    return W.out(sheet, 0.82);
  }, data(fs.existsSync(LUZ30) ? LUZ30 : path.join(ART, 'looks-final', 'shop-keeper-clean.png')));
  save('tita_luz', luz);

  // ---------- the shop, standing on the bottom edge of its 5 x 4 tiles ----------
  const shop = await p.evaluate(async ([src, w, h]) => {
    const c = W.cutout(await W.load(src)), cl = W.cells(c, 1, 1)[0], o = W.canvas(w, h);
    W.draw(o.getContext('2d'), cl.c, cl, Math.min(w * 0.98 / cl.w, h * 0.98 / cl.h), w / 2, h - 2);
    return W.out(o, 0.82);
  }, [data(path.join(ART, 'looks-final', 'shop-building-clean.png')), PROPS.tailor_shop.w * PPT, PROPS.tailor_shop.h * PPT]);
  save('props/tailor_shop', shop);

  // ---------- the looks: already laid out; only made into webp (same quality as the farmer's own sheets) ----------
  fs.mkdirSync(path.join(OUT, 'looks'), { recursive: true });
  for (const look of LOOKS) for (const who of ['boy', 'girl']) for (const part of ['', '-archer']) {
    const r = await p.evaluate(async (src) => { const i = await W.load(src), c = W.canvas(i.width, i.height); c.getContext('2d').drawImage(i, 0, 0); return W.out(c, 0.82); },
      data(cutOf(look + '-' + who + part)));
    save('looks/' + look + '-' + who + part, r, false);
  }
  // ---------- the shop's pictures of each look: the front pose, boy then girl, 128 x 192 each (in the page) ----------
  const thumbs = await p.evaluate(async (list) => {
    const sheet = W.canvas(list.length * 128, 192), g = sheet.getContext('2d');
    for (let i = 0; i < list.length; i++) { const im = await W.load(list[i]); g.imageSmoothingQuality = 'high'; g.drawImage(im, 8, 8, 256, 384, i * 128, 0, 128, 192); }
    return W.out(sheet, 0.86);
  }, LOOKS.flatMap((l) => ['boy', 'girl'].map((who) => data(cutOf(l + '-' + who)))));
  save('looks_thumbs', thumbs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
