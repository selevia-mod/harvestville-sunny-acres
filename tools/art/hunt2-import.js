'use strict';
// The owner's pictures for the Tannery, leather and the Great Tusk (30 Oct 2026; art-src/hunt2/):
//   art-src/icons/<name>.png  the 4 icons, also painted into assets/items.png/.webp (run it again after npm run art)
//   assets/props/ws_tannery   the building, 3x3 tiles at 160 px a tile
// node tools/art/hunt2-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'hunt2');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const NAMES = ['leather_soft', 'leather_thick', 'leather_tough', 'great_tusk'];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const icons = {};
  for (const n of NAMES) {
    icons[n] = await p.evaluate(async (src) => {
      const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), x.c, x, Math.min(128 * 0.88 / x.w, 128 * 0.88 / x.h), 64, null, 64);
      return W.out(o, 0.85);
    }, data(path.join(SRC, n + '.png')));
    fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(icons[n].png.split(',')[1], 'base64'));
  }
  const items = await p.evaluate(async ([old, list]) => {
    const im = await W.load(old), rows = Math.ceil(list.length / 8), sheet = W.canvas(1152, rows * 144), g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (const [i, src] of list.map((x, i) => [i, x]).filter((x) => x[1])) {
      const ic = await W.load(src);
      g.clearRect(8 + (i % 8) * 144, 8 + Math.floor(i / 8) * 144, 128, 128);
      g.drawImage(ic, 8 + (i % 8) * 144, 8 + Math.floor(i / 8) * 144);
    }
    return W.out(sheet, 0.86);
  }, [data(path.join(OUT, 'items.png')), C.ICON_ORDER.map((n) => (icons[n] ? icons[n].png : null))]);
  save('items', items);
  const home = await p.evaluate(async (src) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], o = W.canvas(480, 480);
    W.draw(o.getContext('2d'), x.c, x, Math.min(470 / x.w, 470 / x.h), 240, 478);
    return W.out(o, 0.84);
  }, data(path.join(SRC, 'tannery.png')));
  save('props/ws_tannery', home);
  await b.close();
  console.log('icons, items, ws_tannery written');
})().catch((e) => { console.error(e); process.exit(1); });
