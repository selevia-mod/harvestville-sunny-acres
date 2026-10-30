'use strict';
// Wild Lands art (owner, 30 Oct 2026; prompts in art-src/WILD-LANDS-PROMPTS.md, pictures in art-src/wild/) into the
// game, without rebuilding every sheet (npm run art redraws them all; this only adds the new pieces):
//   assets/kanor.png/.webp    Kanor's 3x3 walking frames of 256x384, like player.png
//   art-src/icons/<name>.png  the 21 new icons (npm run art picks them up), and painted into assets/items.png/.webp
//   assets/props/<name>.*     the props, the Lodge and the flying arrow, at 160 px a tile
//   tiles.png/.webp           3 new ground tiles (wild_grass, wild_forest, wild_trail), made seamless from one corner
//                             quarter of each picture (the pictures came mirrored, like a kaleidoscope)
// node tools/art/wild-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { TILES, PROPS } = require('../tiles');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'wild');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;

const ICONS = [ // [picture, cols, rows, icon names in order]
  ['icons_wild.png', 4, 4, ['bow', 'bow_1', 'bow_2', 'bow_3', 'arrows', 'bait', 'meat_labuyo', 'meat_rabbit', 'venison', 'meat_boar',
    'feather_labuyo', 'fur_rabbit', 'antler', 'tusk', 'pelt_wolf', 'fang_wolf']],
  ['icons_dishes_wild.png', 3, 2, ['tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw', 'prop:arrow_fly']],
];
const PROP_SHEETS = [
  ['props_pulag.png', 3, 2, ['tall_grass', 'bamboo_bush', null, 'boulder_moss', 'wildflowers', 'trail_sign']], // (the trees: their own pictures)
  ['props_makiling.png', 3, 2, [null, 'fern_bush', 'mossy_log', 'mud_spring', 'jungle_grass', 'mushroom_rock']],
];
const GROUND = [['ground_pulag.png', 'wild_grass'], ['ground_makiling.png', 'wild_forest'], ['ground_trail.png', 'wild_trail']];
const PPT = 160; // prop pixels per tile

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(30), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};

const LIB = require('./wild-lib');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: LIB });

  // (the animals: assets/wild.png comes from tools/art/wild3q-import.js since they were redrawn from above, 30 Oct)

  // ---------- Kanor: 3x3 frames of 256x384 (rows: down, up, left; cols: still, step, step) ----------
  const kanor = await p.evaluate(async (src) => {
    const c = W.cutout(await W.load(src)), cl = W.cells(c, 3, 3);
    if (cl.some((x) => !x)) throw new Error('kanor: a frame is missing');
    const sheet = W.canvas(8 * 2 + 3 * 256 + 2 * 16, 8 * 2 + 3 * 384 + 2 * 16), g = sheet.getContext('2d');
    const k = Math.min(...cl.map((x) => Math.min(240 / x.w, 360 / x.h)));
    cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + (i % 3) * 272 + 128, 8 + Math.floor(i / 3) * 400 + 376));
    return W.out(sheet, 0.82);
  }, data(path.join(SRC, 'hunter_kanor.png')));
  save('kanor', kanor);

  // ---------- icons: art-src/icons/<name>.png, and painted into items.png/.webp after the old ones ----------
  const icons = {};
  for (const [file, cols, rows, names] of ICONS) {
    const r = await p.evaluate(async ([src, cols, rows, names]) => {
      const c = W.cutout(await W.load(src)), cl = W.cells(c, cols, rows), out = {};
      names.forEach((n, i) => {
        if (!cl[i]) throw new Error(n + ' is missing');
        const fly = n.indexOf('prop:') === 0, w = fly ? 192 : 128, h = fly ? 64 : 128, o = W.canvas(w, h);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(w * 0.88 / cl[i].w, h * 0.88 / cl[i].h), w / 2, null, h / 2);
        out[n] = W.out(o, 0.85);
      });
      return out;
    }, [data(path.join(SRC, file)), cols, rows, names]);
    Object.assign(icons, r);
  }
  fs.mkdirSync(path.join(ROOT, 'art-src', 'icons'), { recursive: true });
  Object.keys(icons).forEach((n) => {
    if (n.indexOf('prop:') === 0) return save('props/' + n.slice(5), icons[n]);
    fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(icons[n].png.split(',')[1], 'base64'));
  });
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
  for (const [file, cols, rows, names] of PROP_SHEETS.concat([['hunters_lodge.png', 1, 1, ['hunters_lodge']], ['tree_pine.png', 1, 1, ['pine_tree']], ['tree_rainforest.png', 1, 1, ['rainforest_tree']]])) {
    const r = await p.evaluate(async ([src, cols, rows, names, dims, PPT]) => {
      const c = W.cutout(await W.load(src)), cl = W.cells(c, cols, rows), out = {};
      names.forEach((n, i) => {
        if (!n) return;
        if (!cl[i]) throw new Error(n + ' is missing');
        const w = dims[n].w * PPT, h = dims[n].h * PPT, o = W.canvas(w, h);
        W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(w * 0.98 / cl[i].w, h * 0.98 / cl[i].h), w / 2, h - 2);
        out[n] = W.out(o, 0.82);
      });
      return out;
    }, [data(path.join(SRC, file)), cols, rows, names, PROPS, PPT]);
    Object.keys(r).forEach((n) => save('props/' + n, r[n]));
  }

  // ---------- ground tiles: a corner quarter made seamless, into tiles.png (full) and tiles.webp (half) ----------
  const ground = await p.evaluate(async ([list, old, ids, cols]) => {
    const im = await W.load(old), sheet = W.canvas(im.width, im.height), g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (let n = 0; n < list.length; n++) {
      const src = await W.load(list[n]), S = 256;
      const q = W.canvas(S, S), qg = q.getContext('2d');
      qg.imageSmoothingQuality = 'high';
      qg.drawImage(src, 0, 0, src.width / 2, src.height / 2, 0, 0, S, S); // the top-left quarter: no mirror line in it
      // seamless: blend with a copy moved by half a tile, which is continuous across the edges, near the edges
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
      // the edges pushed out into the padding, so scaled-down tiles never show a seam
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
