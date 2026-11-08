// The daily adventures' quest items (owner, 8 Nov 2026; prompt art-src/QUEST-ITEMS-PROMPTS.md):
//   art-src/icons/quest_items.png  16 icons, a 4x4 grid in C.ADVENTURES order, cut into art-src/icons/qi_<key>.png and
//                                  painted into assets/items.png / items.webp at their places (appended: nothing moves)
// Then C.ADVENTURE_ICONS_IN = true (00-zzzzzzzzzzzzzz-adventures.js) shows them. node tools/art/quest-items-import.js
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
const ICONS = C.ADVENTURE_ICONS;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const icons = await p.evaluate(async ([src, names]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.02), out = {};
    names.forEach((n, i) => {
      if (!cl[i]) throw new Error(n + ' is missing');
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.9 / cl[i].w, 128 * 0.9 / cl[i].h), 64, null, 64);
      out[n] = o.toDataURL('image/png');
    });
    return out;
  }, [data(path.join(ART, 'icons', 'quest_items.png')), ICONS]);
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
  await b.close();
  console.log('quest items:', ICONS.length, '| items rows', Math.ceil(C.ICON_ORDER.length / 8));
})().catch((e) => { console.error(e); process.exit(1); });
