'use strict';
// The players' seeds and bakes (5 Nov 2026; art-src/PLAYERS-PROMPTS.md), painted over the drawn stand-ins:
// - art-src/crops/<crop>.png (2 columns: growing, ripe) for each of C.NEW_CROPS, into its two frames of assets/crops.png
//   (one scale for both, bottom on the soil line at 236, as tools/art/import.js does for every crop) and crops.webp (half size);
// - art-src/icons/icons_players.png (4 x 4) into art-src/icons/<name>.png and assets/items.png / items.webp (16 columns).
// Frames and icons keep their numbers. tools/art/crops-fill.js leaves a crop with a picture alone from now on.
// node tools/art/players-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ART = path.join(ROOT, 'art-src');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const ICONS = ['rose', 'seed_rose', 'sampaguita', 'seed_sampaguita', 'gumamela', 'seed_gumamela', 'cotton', 'seed_cotton',
  'sugarcane', 'seed_sugarcane', 'cacao', 'seed_cacao', 'oregano', 'seed_oregano', 'sikwate', 'chocolate_cake'];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const crops = C.NEW_CROPS.filter((k) => fs.existsSync(path.join(ART, 'crops', k + '.png')));
  const sheetFile = path.join(ART, 'icons', 'icons_players.png');
  ICONS.forEach((n) => { if (C.ICON_ORDER.indexOf(n) < 0) throw new Error('no icon slot for ' + n); });
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });

  // ---------- crops ----------
  const frames = [];
  for (const k of crops) {
    const two = await p.evaluate(async (src) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
      if (!cl[0] || !cl[1]) throw new Error('a frame is missing');
      // one scale for both frames, so the plant does not shrink when it ripens (import.js frames())
      const s = Math.min(...cl.map((q) => Math.min(256 * 0.94 / q.w, 236 * 0.96 / q.h))) * 0.92;
      return cl.map((q) => { const o = W.canvas(256, 256); W.draw(o.getContext('2d'), q.c, q, s, 128, 236); return o.toDataURL('image/png'); });
    }, data(path.join(ART, 'crops', k + '.png'))).catch((e) => { throw new Error('crops/' + k + '.png: ' + e.message); });
    two.forEach((f, i) => frames.push([2 + C.CROPS[k].art * 2 + i, f]));
  }
  if (frames.length) {
    const r = await p.evaluate(async ([old, frames]) => {
      const im = await W.load(old), sheet = W.canvas(im.width, im.height), g = sheet.getContext('2d');
      g.drawImage(im, 0, 0);
      for (const [f, src] of frames) {
        const x = 8 + (f % 7) * 272, y = 8 + Math.floor(f / 7) * 272;
        if (y + 256 > sheet.height) throw new Error('the crops sheet is full at frame ' + f);
        g.clearRect(x, y, 256, 256);
        g.drawImage(await W.load(src), x, y);
      }
      const half = W.canvas(sheet.width / 2, sheet.height / 2), h = half.getContext('2d');
      h.imageSmoothingQuality = 'high';
      h.drawImage(sheet, 0, 0, half.width, half.height);
      return { png: sheet.toDataURL('image/png'), webp: half.toDataURL('image/webp', 0.72) };
    }, [data(path.join(OUT, 'crops.png')), frames]);
    save(path.join(OUT, 'crops.png'), r.png);
    save(path.join(OUT, 'crops.webp'), r.webp);
  }

  // ---------- icons ----------
  let icons = {};
  if (fs.existsSync(sheetFile)) {
    icons = await p.evaluate(async ([src, names]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = {};
      names.forEach((n, i) => {
        if (!cl[i]) throw new Error(n + ' is missing');
        const o = W.canvas(128, 128);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
        out[n] = o.toDataURL('image/png');
      });
      return out;
    }, [data(sheetFile), ICONS]).catch((e) => { throw new Error('icons/icons_players.png: ' + e.message); });
    ICONS.forEach((n) => save(path.join(ART, 'icons', n + '.png'), icons[n]));
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
    save(path.join(OUT, 'items.png'), items.png);
    save(path.join(OUT, 'items.webp'), items.webp);
  }
  await b.close();
  console.log('crops:', crops.join(' ') || '(none)', '| icons:', Object.keys(icons).length);
})().catch((e) => { console.error(e); process.exit(1); });
