'use strict';
// Farm economy v2, parts 3 and 4: the owner's icons for the Mixer's 4 materials and the 4 crop potions (cells 9-16 of
// art-src/icons/economy-1.png, art-src/FARM-ECONOMY-V2-PROMPTS.md), out of the page (12 Nov 2026: the page has no room for
// them, about 47 KB): cut into art-src/icons/<name>.png and assets/econ2_icons.png / .webp (4 x 2 cells of 128, in
// C.ECON2_ICONS' order), which tools/packs.js puts in the 'econ' pack. The game draws stand-ins for them until the pack
// is on the phone (19zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-economy2.js paints whichever into their frames of the items texture).
// Afterwards: node build.js, and the pack file in dist/packs goes to the CDN (app-assets/packs/).
// node tools/art/economy2-icons.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const CELLS = ['banana', 'oats', 'peanut', 'cassava', 'taro', 'mung_bean', 'pineapple', 'bitter_gourd',
  'farm_cement', 'rope', 'sili_powder', 'beeswax', 'ginger_tonic', 'ampalaya_brew', 'pineapple_juice', 'hunters_coffee'];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const sheet = path.join(ROOT, 'art-src', 'icons', 'economy-1.png');
  if (!fs.existsSync(sheet)) throw new Error('no art-src/icons/economy-1.png');
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const want = C.ECON2_ICONS.map((id) => CELLS.indexOf(id));
  if (want.some((i) => i < 0)) throw new Error('an icon with no cell: ' + C.ECON2_ICONS.join(' '));
  const r = await p.evaluate(async ([src, want]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = W.canvas(512, 256), g = out.getContext('2d'), one = [];
    want.forEach((ci, i) => {
      const c = cl[ci];
      if (!c) throw new Error('cell ' + (ci + 1) + ' is missing');
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), c.c, c, Math.min(128 * 0.88 / c.w, 128 * 0.88 / c.h), 64, null, 64);
      one.push(o.toDataURL('image/png'));
      g.drawImage(o, (i % 4) * 128, Math.floor(i / 4) * 128);
    });
    return { one, png: out.toDataURL('image/png'), webp: out.toDataURL('image/webp', 0.72) };
  }, [data(sheet), want]);
  C.ECON2_ICONS.forEach((id, i) => save(path.join(ROOT, 'art-src', 'icons', id + '.png'), r.one[i]));
  save(path.join(ROOT, 'assets', 'econ2_icons.png'), r.png);
  save(path.join(ROOT, 'assets', 'econ2_icons.webp'), r.webp);
  await b.close();
  console.log('econ2_icons:', C.ECON2_ICONS.join(' '), '(' + fs.statSync(path.join(ROOT, 'assets', 'econ2_icons.webp')).size + ' bytes, the econ pack)');
})().catch((e) => { console.error(e); process.exit(1); });
