'use strict';
// Farm tech's real pictures (4 Nov 2026; prompts in art-src/FARMTECH-PROMPTS.md), over the stand-ins drawn by
// tools/art/farmtech-icons.js and on canvases in src/19zz-farmtech.js:
//   art-src/icons/farmtech_icons.png  the 5 icons (4 on the top row, 1 below), cut into art-src/icons/<name>.png and
//                                     painted into assets/items.png (8 columns) and items.webp (16 columns). Icons keep
//                                     their numbers; it starts from the current sheet, so every other icon stays.
//   assets/props/greenhouse_floor.*   the floor under the soil, 4x3 tiles at 128 px a tile (as the canvas was)
//   assets/props/greenhouse_frame.*   the glass frame over the crops, the same 4x3 and its roof above (112 px)
//   assets/props/ws_greenhouse.*      the whole greenhouse, for lists and the tour, in that same box
// node tools/art/farmtech-import.js
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
const ICONS = ['sprinkler_copper', 'sprinkler_silver', 'sprinkler_gold', 'fert', 'fert_rich'];
const GW = C.GREENHOUSE.w * 128, GHH = C.GREENHOUSE.h * 128, ROOF = 112; // (src/19zz-farmtech.js draws them in this box)
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(30), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });

  // ---------- the icons: a 4x4 grid, the first five cells used ----------
  // (the sprinklers' drops are small pieces of their own, so only true specks are dropped, not everything under 2%)
  const icons = await p.evaluate(async ([src, names]) => {
    const cl = W.cells(W.dehalo(W.cutout(await W.load(src))), 4, 4, 0.002), out = {};
    names.forEach((n, i) => {
      if (!cl[i]) throw new Error(n + ' is missing');
      const o = W.canvas(128, 128);
      W.draw(o.getContext('2d'), cl[i].c, cl[i], Math.min(128 * 0.88 / cl[i].w, 128 * 0.88 / cl[i].h), 64, null, 64);
      out[n] = o.toDataURL('image/png');
    });
    return out;
  }, [data(path.join(ROOT, 'art-src', 'icons', 'farmtech_icons.png')), ICONS]);
  ICONS.forEach((n) => fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(icons[n].split(',')[1], 'base64')));
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
  save('items', items);

  // ---------- the greenhouse ----------
  const gh = await p.evaluate(async ([floor, frame, whole, GW, GHH, ROOF]) => {
    // the floor: opaque, edge to edge, its 12 beds already one to a tile
    const f = W.canvas(GW, GHH), fg = f.getContext('2d');
    fg.imageSmoothingQuality = 'high';
    fg.drawImage(await W.load(floor), 0, 0, GW, GHH);
    // The frame: its glass is only faintly there (alpha 30-100), so W.dehalo (which drops everything under 96) would
    // take the glass away. Here only the near-invisible dust goes (the generator leaves it over the open middle and
    // round the outside: what is reached from the edges or the middle without crossing glass or wood; a thin spot
    // inside a pane stays glass), the red and yellow fringe round the white wood (warm and see-through, where wood and
    // glass are neither), and specks standing apart from the frame.
    const fr = W.canvas(GW, GHH + ROOF), rg = fr.getContext('2d', { willReadFrequently: true });
    rg.imageSmoothingQuality = 'high';
    rg.drawImage(await W.load(frame), 0, 0, GW, GHH + ROOF);
    const w = fr.width, h = fr.height, im = rg.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const warm = Math.max(d[i], d[i + 1]) - d[i + 2];
      if (d[i + 3] < 200 && warm > 70 && Math.max(d[i], d[i + 1]) > 150) d[i + 3] = 0;
    }
    const open = new Uint8Array(w * h), st = [Math.round(ROOF + GHH / 2) * w + w / 2];
    for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const m = st.pop();
      if (open[m] || d[m * 4 + 3] >= 24) continue;
      open[m] = 1;
      d[m * 4 + 3] = 0;
      const x = m % w;
      if (x > 0) st.push(m - 1); if (x < w - 1) st.push(m + 1); if (m >= w) st.push(m - w); if (m < w * (h - 1)) st.push(m + w);
    }
    const lab = new Int32Array(w * h), sizes = [0];
    for (let k0 = 0; k0 < w * h; k0++) {
      if (lab[k0] || !d[k0 * 4 + 3]) continue;
      const id = sizes.length, q = [k0];
      lab[k0] = id;
      let n = 0;
      while (q.length) {
        const m = q.pop(), x = m % w;
        n++;
        [x > 0 ? m - 1 : -1, x < w - 1 ? m + 1 : -1, m - w, m + w].forEach((o) => { if (o >= 0 && o < w * h && !lab[o] && d[o * 4 + 3]) { lab[o] = id; q.push(o); } });
      }
      sizes.push(n);
    }
    const big = Math.max(...sizes);
    for (let k = 0; k < w * h; k++) if (lab[k] && sizes[lab[k]] < big * 0.02) d[k * 4 + 3] = 0;
    rg.putImageData(im, 0, 0);
    // the whole greenhouse: cut out, standing on the bottom of the same box, not stretched
    const x = W.cells(W.dehalo(W.cutout(await W.load(whole))), 1, 1, 0.02)[0], o = W.canvas(GW, GHH + ROOF);
    W.draw(o.getContext('2d'), x.c, x, Math.min(GW * 0.98 / x.w, (GHH + ROOF - 2) / x.h), GW / 2, GHH + ROOF - 1);
    return { floor: W.out(f, 0.82), frame: W.out(fr, 0.86), whole: W.out(o, 0.84) };
  }, [data(path.join(ROOT, 'art-src', 'props', 'greenhouse_floor.png')), data(path.join(ROOT, 'art-src', 'props', 'greenhouse_frame.png')),
    data(path.join(ROOT, 'art-src', 'props', 'ws_greenhouse.png')), GW, GHH, ROOF]);
  save('props/greenhouse_floor', gh.floor);
  save('props/greenhouse_frame', gh.frame);
  save('props/ws_greenhouse', gh.whole);
  await b.close();
  console.log('icons:', ICONS.join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
