'use strict';
// Paints the crops added after the last full redraw (C.NEW_CROPS: the players' seeds of 5 Nov 2026) into the crops sheet,
// each crop's growing and ripe frames drawn from its plant, shape and colours (tools/art/crops2.js) until generated
// pictures replace them, and moves the withered frame to its new place after them (C.CROP_WITHERED). Every other frame
// is left as it is. assets/crops.png is the full-size sheet; crops.webp goes out at half size (assets/sizes.json), at
// squeeze.js's quality. (Generated pictures for them go in through tools/art-manifest.js, like every other crop's.)
// node tools/art/crops-fill.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  // (and wheat: its growing frame held the old withered picture, so a growing wheat field looked dead, until 5 Nov 2026)
  // (a crop with its generated picture in art-src/crops/ is tools/art/players-import.js's, and stays as it is)
  // (wheat too, once its picture is in: tools/art/workshop-import.js, 8 Nov 2026)
  const keys = ['wheat'].concat(C.NEW_CROPS || []).filter((k) => !fs.existsSync(path.join(ROOT, 'art-src', 'crops', k + '.png')));
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent('<canvas id="x"></canvas>');
  for (const f of ['draw.js', 'crops2.js']) await p.addScriptTag({ path: path.join(__dirname, f) });
  const r = await p.evaluate(async ([old, crops, keys, withered]) => {
    const A = window.ART;
    A.prepareCrops({ CROPS: crops });
    const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
    const im = await load(old), sheet = document.createElement('canvas');
    sheet.width = im.width; sheet.height = im.height;
    const g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    const cell = (f) => ({ x: 8 + (f % 7) * 272, y: 8 + Math.floor(f / 7) * 272 });
    const put = async (f, draw) => {
      const c = cell(f);
      if (c.y + 256 > sheet.height) throw new Error('the crops sheet is full at frame ' + f);
      const one = document.createElement('canvas');
      one.width = one.height = 256;
      await draw(one.getContext('2d'));
      g.clearRect(c.x, c.y, 256, 256);
      g.drawImage(one, c.x, c.y);
    };
    for (const k of keys) {
      for (let i = 0; i < 2; i++) await put(2 + crops[k].art * 2 + i, (cg) => A.CROP_DRAW[k][2 + i](cg));
    }
    await put(withered, (cg) => A.CROP_WITHERED(cg));
    const half = document.createElement('canvas');
    half.width = sheet.width / 2; half.height = sheet.height / 2;
    const h = half.getContext('2d');
    h.imageSmoothingQuality = 'high';
    h.drawImage(sheet, 0, 0, half.width, half.height);
    return { png: sheet.toDataURL('image/png'), webp: half.toDataURL('image/webp', 0.72) };
  }, [data(path.join(OUT, 'crops.png')), JSON.parse(JSON.stringify(C.CROPS)), keys, C.CROP_WITHERED]);
  fs.writeFileSync(path.join(OUT, 'crops.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'crops.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('crops painted:', keys.join(', '), '; withered at', C.CROP_WITHERED);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
