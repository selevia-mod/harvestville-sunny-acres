'use strict';
// Farm economy v2's pictures (owner, 11 Nov 2026; art-src/FARM-ECONOMY-V2-PROMPTS.md), painted over the drawn stand-ins.
// Run it when the owner's zip is unpacked into art-src/ (any of the files may be missing: what is there goes in):
// - art-src/crops/<crop>.png (1536x1024, 2 columns: growing, ripe) for each of C.ECON_CROPS, into its two frames of
//   assets/crops.png (one scale for both, bottom on the soil line at 236, as tools/art/players-import.js does) and
//   crops.webp (half size). tools/art/crops-fill.js leaves a crop with a picture alone from then on.
// - art-src/icons/economy-1.png and economy-2.png (1536x1536, 4 x 4, in the prompts' order) cut into
//   art-src/icons/<name>.png, every cell; the ones the game has an icon slot for (C.ICON_ORDER: the 8 crops and their
//   8 seed packets, part 1) also into assets/items.png / items.webp (16 columns). The other cells are for later parts
//   (the Mixer's materials, the crop potions, the horse's gear): their pictures wait in art-src/icons/ under the names
//   below until those parts give them a slot (then run tools/art/icons-fill.js, or this again).
// - The Mixer and the Silo (buildings/mixer.png, silo.png) belong to parts 3 and 4, not here.
// Frames and icons keep their numbers. Afterwards: node build.js (and npm test).
// node tools/art/economy-import.js
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
// the two icon sheets, cell by cell (left to right, top to bottom), as art-src/FARM-ECONOMY-V2-PROMPTS.md lists them
const SHEETS = {
  'economy-1': ['banana', 'oats', 'peanut', 'cassava', 'taro', 'mung_bean', 'pineapple', 'bitter_gourd',
    'farm_cement', 'rope', 'sili_powder', 'beeswax', 'ginger_tonic', 'ampalaya_brew', 'pineapple_juice', 'hunters_coffee'],
  'economy-2': ['horseshoes', 'saddlebags', 'lantern_bridle', 'horse_hay', 'silo_bucket', 'mixer_barrel',
    'seed_banana', 'seed_oats', 'seed_peanut', 'seed_cassava', 'seed_taro', 'seed_mung_bean', 'seed_pineapple', 'seed_bitter_gourd',
    'horse_rosette', 'horse_star'],
};
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  if (!C.ECON_CROPS) throw new Error('no C.ECON_CROPS: src/00-zzzzzzzzzzzzzzzzzz-economy.js is missing');
  C.ECON_CROPS.forEach((k) => { if (SHEETS['economy-1'].indexOf(k) < 0 || SHEETS['economy-2'].indexOf('seed_' + k) < 0) throw new Error(k + ' has no cell in the icon sheets'); });
  const crops = C.ECON_CROPS.filter((k) => fs.existsSync(path.join(ART, 'crops', k + '.png')));
  const sheets = Object.keys(SHEETS).filter((n) => fs.existsSync(path.join(ART, 'icons', n + '.png')));
  if (!crops.length && !sheets.length) {
    console.log('nothing to import yet: art-src/crops/<crop>.png and art-src/icons/economy-1.png / economy-2.png (art-src/FARM-ECONOMY-V2-PROMPTS.md)');
    return;
  }
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
        if (y + 256 > sheet.height) throw new Error('the crops sheet is too short for frame ' + f + ': run tools/art/crops-fill.js first');
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
  const icons = {};
  for (const n of sheets) {
    const got = await p.evaluate(async ([src, names]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = {};
      names.forEach((nm, i) => {
        if (!cl[i]) throw new Error(nm + ' (cell ' + (i + 1) + ') is missing');
        const o = W.canvas(128, 128);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
        out[nm] = o.toDataURL('image/png');
      });
      return out;
    }, [data(path.join(ART, 'icons', n + '.png')), SHEETS[n]]).catch((e) => { throw new Error('icons/' + n + '.png: ' + e.message); });
    Object.keys(got).forEach((nm) => { save(path.join(ART, 'icons', nm + '.png'), got[nm]); icons[nm] = got[nm]; });
  }
  const slotted = Object.keys(icons).filter((nm) => C.ICON_ORDER.indexOf(nm) >= 0);
  if (slotted.length) {
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
    }, [data(path.join(OUT, 'items.png')), C.ICON_ORDER.map((nm) => (slotted.indexOf(nm) >= 0 ? icons[nm] : null))]);
    save(path.join(OUT, 'items.png'), items.png);
    save(path.join(OUT, 'items.webp'), items.webp);
  }
  await b.close();
  const later = Object.keys(icons).filter((nm) => slotted.indexOf(nm) < 0);
  console.log('crops:', crops.join(' ') || '(none)', '| icons in the game:', slotted.length, later.length ? '| kept for later parts: ' + later.join(' ') : '');
})().catch((e) => { console.error(e); process.exit(1); });
