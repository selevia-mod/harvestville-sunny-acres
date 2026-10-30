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

// Shared page code: background removal, pieces, cells, fitting.
const LIB = `
window.W = {
  load: (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = s; }),
  canvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  // transparent pictures stay as they are; a flat magenta/white background touching the edge is flood-filled away
  cutout(img) {
    const c = W.canvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), px = d.data;
    if (px[3] < 32 && px[(w * h - 1) * 4 + 3] < 32) return c;
    const key = [px[0], px[1], px[2]], magenta = key[0] > 180 && key[1] < 90 && key[2] > 180;
    const TOL = magenta ? 150 : 60, SOFT = magenta ? 260 : 120, seen = new Uint8Array(w * h), st = [];
    const dist = (i) => Math.abs(px[i] - key[0]) + Math.abs(px[i + 1] - key[1]) + Math.abs(px[i + 2] - key[2]);
    for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const p = st.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4, dd = dist(i);
      if (dd > SOFT) continue;
      px[i + 3] = dd < TOL ? 0 : Math.round(px[i + 3] * (dd - TOL) / (SOFT - TOL));
      if (dd >= TOL) continue;
      const x = p % w, y = (p - x) / w;
      if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (y > 0) st.push(p - w); if (y < h - 1) st.push(p + w);
    }
    if (magenta) for (let i = 0; i < px.length; i += 4) if (px[i + 3] && px[i] > px[i + 1] + 60 && px[i + 2] > px[i + 1] + 60) {
      const m = Math.min(px[i], px[i + 2]) - px[i + 1]; px[i] -= m * 0.6; px[i + 2] -= m * 0.6;
    }
    g.putImageData(d, 0, 0);
    return c;
  },
  // the grid's cells: every visible piece goes to the cell its middle is in. Each cell comes back as its own canvas
  // holding only its pieces (a neighbour reaching into the box is left out), with the box of those pieces.
  cells(c, cols, rows) {
    const w = c.width, h = c.height, px = c.getContext('2d').getImageData(0, 0, w, h).data;
    const lab = new Int32Array(w * h), on = (k) => px[k * 4 + 3] >= 40, cellOf = [0];
    const out = [];
    for (let k = 0; k < cols * rows; k++) out.push(null);
    let id = 0;
    for (let k0 = 0; k0 < w * h; k0++) {
      if (lab[k0] || !on(k0)) continue;
      id++;
      lab[k0] = id;
      let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0, sx = 0, sy = 0;
      const q = [k0];
      while (q.length) {
        const m = q.pop(), mx = m % w, my = (m - mx) / w;
        n++; sx += mx; sy += my;
        if (mx < x0) x0 = mx; if (mx > x1) x1 = mx; if (my < y0) y0 = my; if (my > y1) y1 = my;
        if (mx > 0 && !lab[m - 1] && on(m - 1)) { lab[m - 1] = id; q.push(m - 1); }
        if (mx < w - 1 && !lab[m + 1] && on(m + 1)) { lab[m + 1] = id; q.push(m + 1); }
        if (my > 0 && !lab[m - w] && on(m - w)) { lab[m - w] = id; q.push(m - w); }
        if (my < h - 1 && !lab[m + w] && on(m + w)) { lab[m + w] = id; q.push(m + w); }
      }
      if (n < 60) { cellOf[id] = -1; continue; } // specks
      const k = Math.min(rows - 1, Math.floor((sy / n) / (h / rows))) * cols + Math.min(cols - 1, Math.floor((sx / n) / (w / cols)));
      cellOf[id] = k;
      out[k] = out[k] ? { x0: Math.min(out[k].x0, x0), y0: Math.min(out[k].y0, y0), x1: Math.max(out[k].x1, x1), y1: Math.max(out[k].y1, y1) } : { x0, y0, x1, y1 };
    }
    return out.map((b, k) => {
      if (!b) return null;
      const cw = b.x1 - b.x0 + 1, ch = b.y1 - b.y0 + 1, o = W.canvas(cw, ch), og = o.getContext('2d');
      og.drawImage(c, b.x0, b.y0, cw, ch, 0, 0, cw, ch);
      const d = og.getImageData(0, 0, cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const L = lab[(b.y0 + y) * w + b.x0 + x];
        // keep this cell's pieces and the soft edge pixels around them (label 0 next to them)
        if (L ? cellOf[L] !== k : false) d.data[(y * cw + x) * 4 + 3] = 0;
      }
      og.putImageData(d, 0, 0);
      return { c: o, x: 0, y: 0, w: cw, h: ch };
    });
  },
  // a piece scaled by k, its middle at cx and its bottom at base (or centred when base is null)
  draw(g, c, b, k, cx, base, cy) {
    const w = b.w * k, h = b.h * k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, b.x, b.y, b.w, b.h, cx - w / 2, base != null ? base - h : cy - h / 2, w, h);
  },
  out: (c, q) => ({ png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', q || 0.8) }),
};`;

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
