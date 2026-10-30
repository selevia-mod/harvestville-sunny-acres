'use strict';
// Magayon Peaks art (owner, 30 Oct 2026; prompts in art-src/MAGAYON-PROMPTS.md, pictures in art-src/magayon/) into the
// game, without rebuilding every sheet (the animals: tools/art/animals3q-import.js):
//   art-src/icons/<name>.png  the 8 new icons, and painted into assets/items.png/.webp at the end of the sheet
//   assets/props/<name>.*     the 6 props and the pili tree, at 160 px a tile
//   tiles.png/.webp           wild_ash and wild_lava, made seamless from one corner quarter of each picture
// The tiger's and rhino's drops have no pictures yet: art-src/magayon/icons_magayon2.png when it comes, recoloured
// stand-ins until then.
// node tools/art/magayon-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { TILES, PROPS } = require('../tiles');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'magayon');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const PPT = 160;
const ICONS = ['meat_bear', 'fur_bear', 'claw_bear', 'meat_mammoth', 'tusk_mammoth', 'wool_mammoth', 'kaldereta', 'bistek'];
const ICONS2 = ['pelt_tiger', 'claw_tiger', 'hide_rhino', 'horn_rhino'];
// a stand-in: an icon with its tones moved onto a colour ramp [dark, middle, light]
const STAND = { pelt_tiger: ['fur_bear', ['#3a1d0a', '#d9781f', '#f8c878']], claw_tiger: ['claw_bear', ['#6a5a48', '#d8c8a8', '#fff6e0']],
  hide_rhino: ['wool_mammoth', ['#3e3a36', '#8d867c', '#c4bdb0']], horn_rhino: ['tusk_mammoth', ['#6e5a40', '#c9b48e', '#efe2c4']] };
const PROP_SHEET = ['lava_boulder', 'hot_spring', 'sulfur_vent', 'ash_fern', 'abaca', 'charred_log'];
const GROUND = [['ground_magayon.png', 'wild_ash'], ['ground_lava.png', 'wild_lava']];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(30), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });

  // ---------- icons ----------
  const second = path.join(SRC, 'icons_magayon2.png');
  const icons = await p.evaluate(async ([src, names, src2, names2, stand]) => {
    const out = {}, one = (c, x) => {
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), x.c, x, Math.min(128 * 0.88 / x.w, 128 * 0.88 / x.h), 64, null, 64);
      return o;
    };
    const cl = W.cells(W.cutout(await W.load(src)), 4, 2, 0.02), cv = {};
    names.forEach((n, i) => { if (!cl[i]) throw new Error(n + ' is missing'); cv[n] = one(null, cl[i]); out[n] = W.out(cv[n], 0.85); });
    if (src2) {
      const cl2 = W.cells(W.dehalo(W.cutout(await W.load(src2))), 4, 1, 0.02);
      names2.forEach((n, i) => { if (!cl2[i]) throw new Error(n + ' is missing'); out[n] = W.out(one(null, cl2[i]), 0.85); });
    } else names2.forEach((n) => {
      const [from, ramp] = stand[n], o = W.canvas(128, 128), g = o.getContext('2d');
      g.drawImage(cv[from], 0, 0);
      const px = g.getImageData(0, 0, 128, 128), d = px.data, hex = ramp.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255, t = l < 0.5 ? l * 2 : (l - 0.5) * 2, a = hex[l < 0.5 ? 0 : 1], z = hex[l < 0.5 ? 1 : 2];
        for (let k = 0; k < 3; k++) d[i + k] = a[k] + (z[k] - a[k]) * t;
      }
      g.putImageData(px, 0, 0);
      out[n] = W.out(o, 0.85);
    });
    return out;
  }, [data(path.join(SRC, 'icons_magayon.png')), ICONS, fs.existsSync(second) ? data(second) : null, ICONS2, STAND]);
  fs.mkdirSync(path.join(ROOT, 'art-src', 'icons'), { recursive: true });
  Object.keys(icons).forEach((n) => fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(icons[n].png.split(',')[1], 'base64')));
  const order = C.ICON_ORDER;
  const items = await p.evaluate(async ([old, list]) => {
    const im = await W.load(old), rows = Math.ceil(list.length / 8), sheet = W.canvas(1152, rows * 144), g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (const [i, src] of list.map((x, i) => [i, x]).filter((x) => x[1])) {
      const ic = await W.load(src);
      g.clearRect(8 + (i % 8) * 144, 8 + Math.floor(i / 8) * 144, 128, 128);
      g.drawImage(ic, 8 + (i % 8) * 144, 8 + Math.floor(i / 8) * 144);
    }
    return W.out(sheet, 0.86);
  }, [data(path.join(OUT, 'items.png')), order.map((n) => (icons[n] ? icons[n].png : null))]);
  save('items', items);

  // ---------- props, at 160 px a tile, standing on the bottom edge ----------
  const props = await p.evaluate(async ([src, names, tree, dims, PPT]) => {
    const out = {}, cl = W.cells(W.cutout(await W.load(src)), 3, 2), put = (n, x) => {
      const w = dims[n].w * PPT, h = dims[n].h * PPT, o = W.canvas(w, h);
      W.draw(o.getContext('2d'), x.c, x, Math.min(w * 0.98 / x.w, h * 0.98 / x.h), w / 2, h - 2);
      out[n] = W.out(o, 0.82);
    };
    names.forEach((n, i) => { if (!cl[i]) throw new Error(n + ' is missing'); put(n, cl[i]); });
    // the tree came with a soft glow around its leaves: a clean edge instead
    const t = W.cells(W.cutout(await W.load(tree)), 1, 1, 0.02)[0], tg = t.c.getContext('2d'), d = tg.getImageData(0, 0, t.w, t.h);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = Math.max(0, Math.min(255, (d.data[i] - 150) * 255 / 80));
    tg.putImageData(d, 0, 0);
    put('pili_tree', t);
    return out;
  }, [data(path.join(SRC, 'props_magayon.png')), PROP_SHEET, data(path.join(SRC, 'tree_pili.png')), PROPS, PPT]);
  Object.keys(props).forEach((n) => save('props/' + n, props[n]));

  // ---------- ground tiles: a corner quarter made seamless, into tiles.png (full) and tiles.webp (half) ----------
  const ground = await p.evaluate(async ([list, old, ids, cols]) => {
    const im = await W.load(old), sheet = W.canvas(im.width, im.height), g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (let n = 0; n < list.length; n++) {
      const src = await W.load(list[n]), S = 256, q = W.canvas(S, S), qg = q.getContext('2d');
      qg.imageSmoothingQuality = 'high';
      qg.drawImage(src, 0, 0, src.width / 2, src.height / 2, 0, 0, S, S);
      const a = qg.getImageData(0, 0, S, S), sh = W.canvas(S, S), sg = sh.getContext('2d');
      sg.drawImage(q, -S / 2, -S / 2); sg.drawImage(q, S / 2, -S / 2); sg.drawImage(q, -S / 2, S / 2); sg.drawImage(q, S / 2, S / 2);
      const bb = sg.getImageData(0, 0, S, S), A = a.data, B = bb.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const e = Math.min(x, S - 1 - x, y, S - 1 - y) / (S * 0.3), w = Math.max(0, 1 - e), i = (y * S + x) * 4;
        for (let ch = 0; ch < 3; ch++) A[i + ch] = Math.round(A[i + ch] * (1 - w) + B[i + ch] * w);
        A[i + 3] = 255;
      }
      qg.putImageData(a, 0, 0);
      const id = ids[n], x0 = 8 + (id % cols) * 272, y0 = 8 + Math.floor(id / cols) * 272;
      g.clearRect(x0 - 8, y0 - 8, 272, 272);
      g.drawImage(q, x0, y0);
      g.drawImage(q, 0, 0, 1, S, x0 - 8, y0, 8, S); g.drawImage(q, S - 1, 0, 1, S, x0 + S, y0, 8, S);
      g.drawImage(sheet, x0 - 8, y0, S + 16, 1, x0 - 8, y0 - 8, S + 16, 8); g.drawImage(sheet, x0 - 8, y0 + S - 1, S + 16, 1, x0 - 8, y0 + S, S + 16, 8);
    }
    const half = W.canvas(sheet.width / 2, sheet.height / 2), hg = half.getContext('2d');
    hg.imageSmoothingQuality = 'high';
    hg.drawImage(sheet, 0, 0, half.width, half.height);
    return { png: sheet.toDataURL('image/png'), webp: half.toDataURL('image/webp', 0.8) };
  }, [GROUND.map((x) => data(path.join(SRC, x[0]))), data(path.join(OUT, 'tiles.png')), GROUND.map((x) => TILES.T[x[1]]), TILES.COLS]);
  save('tiles', ground);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
