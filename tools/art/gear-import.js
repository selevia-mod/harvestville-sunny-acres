'use strict';
// Hunter's gear icons (5 Nov 2026; art-src/GEAR-ICONS-PROMPTS.md): art-src/hunt2/icons_gear.png, 3 columns by 1
// row, into art-src/icons/<name>.png and painted over the drawn stand-ins (tools/art/gear-icons.js) in assets/items.png
// (8 columns) and items.webp (16 columns). Icons keep their numbers.
// node tools/art/gear-import.js
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
const ICONS = ['gear_cloak', 'gear_boots', 'gear_quiver'];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const file = path.join(SRC, 'icons_gear.png');
  if (!fs.existsSync(file)) throw new Error('no ' + path.relative(ROOT, file) + ' yet');
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const icons = await p.evaluate(async ([src, names]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 3, 1, 0.02), out = {};
    names.forEach((n, i) => {
      if (!cl[i]) throw new Error(n + ' is missing');
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
      out[n] = o.toDataURL('image/png');
    });
    return out;
  }, [data(file), ICONS]);
  ICONS.forEach((n) => fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(icons[n].split(',')[1], 'base64')));
  const items = await p.evaluate(async ([old, list]) => {
    const im = await W.load(old), rows = Math.ceil(list.length / 8), sheet = W.canvas(1152, Math.max(im.height, rows * 144)), g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (let i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      const x = 8 + (i % 8) * 144, y = 8 + Math.floor(i / 8) * 144;
      g.clearRect(x, y, 128, 128);
      g.drawImage(await W.load(list[i]), x, y);
    }
    return W.itemsOut(sheet, 0.72);
  }, [data(path.join(OUT, 'items.png')), C.ICON_ORDER.map((n) => icons[n] || null)]);
  fs.writeFileSync(path.join(OUT, 'items.png'), Buffer.from(items.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'items.webp'), Buffer.from(items.webp.split(',')[1], 'base64'));
  await b.close();
  console.log('icons:', ICONS.join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
