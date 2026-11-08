// Farm Raids' pictures (owner, 9 Nov 2026; prompts art-src/RAID-PROMPTS.md). The crows and the guard goose are creature
// sheets (tools/art/animals3q-import.js raids); this does the rest:
//   art-src/raids/raid_camp.png  -> assets/props/raid_camp.*  (3 x 3 tiles, standing on its bottom edge)
//   art-src/raids/defenses.png   -> assets/props/def_<beebox|mudpit|tower|sili|kampana|fence>.* (a 3 x 2 grid)
//   art-src/raids/raid_icons.png -> 12 icons (C.FRAID_ICONS) into assets/items.png / items.webp (appended: nothing moves)
// node tools/art/raids-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const ART = path.join(ROOT, 'art-src', 'raids');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
const PPT = 160; // pixels a tile for props (as places-import.js)
const DEFS = [['beebox', 1.3], ['mudpit', 1.2], ['tower', 1.8], ['sili', 1.2], ['kampana', 1.4], ['fence', 1.1]]; // [key, tiles wide]

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const one = (src, cols, rows, i, w) => p.evaluate(async ([s, cols, rows, i, w]) => {
    const x = W.cells(W.dehalo(W.cutout(await W.load(s))), cols, rows, 0.02)[i];
    if (!x) throw new Error('cell ' + i + ' is missing');
    const oh = Math.round(w * x.h / x.w), o = W.canvas(w, oh);
    W.draw(o.getContext('2d'), x.c, x, w / x.w, w / 2, oh);
    return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
  }, [src, cols, rows, i, w]);
  const done = [];
  if (fs.existsSync(path.join(ART, 'raid_camp.png'))) {
    // (a square 3 x 3 like the other workshops: the yard draws it at its footprint's size)
    const r = await p.evaluate(async (s) => {
      const x = W.cells(W.dehalo(W.cutout(await W.load(s))), 1, 1, 0.02)[0], S = 480, k = Math.min(S / x.w, S / x.h), o = W.canvas(S, S);
      W.draw(o.getContext('2d'), x.c, x, k, S / 2, S);
      return Object.assign(W.out(o, 0.85), { w: S, h: S });
    }, data(path.join(ART, 'raid_camp.png')));
    save(path.join(OUT, 'props', 'raid_camp.png'), r.png); save(path.join(OUT, 'props', 'raid_camp.webp'), r.webp); done.push('camp ' + r.w + 'x' + r.h);
  }
  if (fs.existsSync(path.join(ART, 'defenses.png'))) {
    const src = data(path.join(ART, 'defenses.png'));
    for (let i = 0; i < DEFS.length; i++) {
      const r = await one(src, 3, 2, i, Math.round(DEFS[i][1] * PPT));
      save(path.join(OUT, 'props', 'def_' + DEFS[i][0] + '.png'), r.png); save(path.join(OUT, 'props', 'def_' + DEFS[i][0] + '.webp'), r.webp);
      done.push(DEFS[i][0]);
    }
  }
  // the guard goose standing (frame 9 of its sheet: tools/art/animals3q-import.js raids) as its yard piece
  if (fs.existsSync(path.join(OUT, 'guard_goose.png'))) {
    const r = await p.evaluate(async (src) => {
      const im = await W.load(src), fw = im.width / 12, o = W.canvas(Math.round(fw), im.height);
      o.getContext('2d').drawImage(im, 9 * fw, 0, fw, im.height, 0, 0, fw, im.height);
      return W.out(o, 0.85);
    }, data(path.join(OUT, 'guard_goose.png')));
    save(path.join(OUT, 'props', 'def_goose.png'), r.png); save(path.join(OUT, 'props', 'def_goose.webp'), r.webp); done.push('goose piece');
  }
  if (fs.existsSync(path.join(ART, 'raid_icons.png'))) {
    const icons = await p.evaluate(async ([src, names]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 3, 0.02), out = {};
      names.forEach((n, i) => {
        if (!cl[i]) throw new Error(n + ' is missing');
        const o = W.canvas(128, 128);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.9 / cl[i].w, 128 * 0.9 / cl[i].h), 64, null, 64);
        out[n] = o.toDataURL('image/png');
      });
      return out;
    }, [data(path.join(ART, 'raid_icons.png')), C.FRAID_ICONS]);
    C.FRAID_ICONS.forEach((n) => save(path.join(ROOT, 'art-src', 'icons', n + '.png'), icons[n]));
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
    save(path.join(OUT, 'items.png'), items.png); save(path.join(OUT, 'items.webp'), items.webp);
    done.push('12 icons');
  }
  await b.close();
  console.log('raids art:', done.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
