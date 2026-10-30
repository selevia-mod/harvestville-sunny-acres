'use strict';
// Fills any icon that is empty in assets/items.png with its drawing from the art tools (ART.ICON_DRAW), into
// art-src/icons/<name>.png and the items sheet, without redrawing every sheet (owner, 30 Oct 2026: wheat, the fruit and the
// workshop goods had been drawn but never made it into the sheet: they showed as empty squares in the bag).
// node tools/art/icons-fill.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ICONS = path.join(ROOT, 'art-src', 'icons');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent('<canvas id="x"></canvas>');
  for (const f of ['draw.js', 'icons2.js', 'tiles2.js', 'people.js', 'props.js', 'extra2.js', 'extra3.js', 'furniture.js', 'town2.js', 'outdoor.js', 'quests.js', 'crops2.js', 'farm2.js']) {
    await p.addScriptTag({ path: path.join(__dirname, f) });
  }
  const r = await p.evaluate(async ([old, order, crops]) => {
    window.ART.prepareCrops({ CROPS: crops }); // (the crops' and seeds' icons are made here)
    const im = new Image();
    im.src = old;
    await im.decode();
    const sheet = document.createElement('canvas');
    sheet.width = im.width; sheet.height = im.height;
    const g = sheet.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const out = {}, none = [];
    order.forEach((name, i) => {
      const x = 8 + (i % 8) * 144, y = 8 + Math.floor(i / 8) * 144, d = g.getImageData(x, y, 128, 128).data;
      let n = 0;
      for (let k = 3; k < d.length; k += 4) if (d[k] > 40) n++;
      if (n >= 200) return;
      const draw = window.ART.ICON_DRAW[name];
      if (!draw) { none.push(name); return; }
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      draw(c.getContext('2d'));
      g.drawImage(c, x, y);
      out[name] = c.toDataURL('image/png');
    });
    return { png: sheet.toDataURL('image/png'), webp: sheet.toDataURL('image/webp', 0.86), out, none };
  }, ['data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'items.png')).toString('base64'), C.ICON_ORDER, JSON.parse(JSON.stringify(C.CROPS))]);
  Object.keys(r.out).forEach((n) => fs.writeFileSync(path.join(ICONS, n + '.png'), Buffer.from(r.out[n].split(',')[1], 'base64')));
  fs.writeFileSync(path.join(OUT, 'items.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'items.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('filled', Object.keys(r.out).join(' '));
  if (r.none.length) console.log('NO DRAWING for', r.none.join(' '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
