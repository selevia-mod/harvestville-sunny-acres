// Wheat, the workshop's fruit and jams, and the lift (owner, 8 Nov 2026: "wheat, mango and lift also need an art";
// prompts in art-src/WHEAT-MANGO-LIFT-PROMPTS.md), over what was drawn by code:
//   art-src/icons/workshop_icons.png  9 icons (a 4x4 grid, in ICONS' order), cut into art-src/icons/<name>.png and painted
//                                     into assets/items.png / items.webp at their places (icons keep their numbers)
//   art-src/crops/wheat.png           wheat's growing and ripe frames of assets/crops.png (one scale for both, on the soil
//                                     line at 236, as players-import.js does), crops.webp at half size
//   art-src/props/mine_lift.png       assets/props/mine_lift.* (336x440: the Mine's and the Lair's lift box, 2.1 x 2.75 tiles),
//                                     standing on its bottom edge, not stretched
// tools/art/crops-fill.js leaves wheat alone once its picture is here.
// node tools/art/workshop-import.js
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
const ICONS = ['wheat', 'seed_wheat', 'mango', 'apple', 'orange', 'peach', 'mango_jam', 'apple_jam', 'peach_jam'];
const LIFT = { w: 336, h: 440 };
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  ICONS.forEach((n) => { if (C.ICON_ORDER.indexOf(n) < 0) throw new Error('no icon slot for ' + n); });
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });

  // ---------- wheat in the field ----------
  const two = await p.evaluate(async (src) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 2, 1, 0.02);
    if (!cl[0] || !cl[1]) throw new Error('a frame is missing');
    const s = Math.min(...cl.map((q) => Math.min(256 * 0.94 / q.w, 236 * 0.96 / q.h))) * 0.92;
    return cl.map((q) => { const o = W.canvas(256, 256); W.draw(o.getContext('2d'), q.c, q, s, 128, 236); return o.toDataURL('image/png'); });
  }, data(path.join(ART, 'crops', 'wheat.png')));
  const frames = two.map((f, i) => [2 + C.CROPS.wheat.art * 2 + i, f]);
  const cr = await p.evaluate(async ([old, frames]) => {
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
  save(path.join(OUT, 'crops.png'), cr.png);
  save(path.join(OUT, 'crops.webp'), cr.webp);

  // ---------- the icons ----------
  const icons = await p.evaluate(async ([src, names]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = {};
    names.forEach((n, i) => {
      if (!cl[i]) throw new Error(n + ' is missing');
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
      out[n] = o.toDataURL('image/png');
    });
    return out;
  }, [data(path.join(ART, 'icons', 'workshop_icons.png')), ICONS]);
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

  // ---------- the lift ----------
  const lift = await p.evaluate(async ([src, LW, LH]) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(src))), 1, 1, 0.02)[0], o = W.canvas(LW, LH);
    W.draw(o.getContext('2d'), x.c, x, Math.min(LW * 0.98 / x.w, (LH - 2) / x.h), LW / 2, LH - 1);
    return W.out(o, 0.86);
  }, [data(path.join(ART, 'props', 'mine_lift.png')), LIFT.w, LIFT.h]);
  save(path.join(OUT, 'props', 'mine_lift.png'), lift.png);
  save(path.join(OUT, 'props', 'mine_lift.webp'), lift.webp);
  await b.close();
  console.log('wheat frames', frames.map((f) => f[0]).join(', '), '| icons:', ICONS.join(' '), '| lift', LIFT.w + 'x' + LIFT.h);
})().catch((e) => { console.error(e); process.exit(1); });
