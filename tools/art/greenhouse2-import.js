// Greenhouse v2 (owner, 8 Nov 2026: "Greenhouse looks odd, need to polish and improve"; prompts in
// art-src/GREENHOUSE-V2-PROMPTS.md). From art-src/props/:
//   greenhouse_back.png   the back wall and its low roof, behind the crops   -> assets/props/greenhouse_back.*  (512x496)
//   greenhouse_front.png  the side walls and the front with its open door    -> assets/props/greenhouse_front.* (512x496)
//   ws_greenhouse.png     the whole greenhouse, for lists, the tour, Decorate -> assets/props/ws_greenhouse.*   (512x496)
// and from the floor as it is (assets/props/greenhouse_floor.png) its beds' soil cut out -> assets/props/greenhouse_beds.*
// (512x384): laid over the tilled soil, so the soil shows only inside each wooden bed (src/19zz-farmtech.js).
// node tools/art/greenhouse2-import.js
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
  const gh = await p.evaluate(async ([back, front, whole, floor, GW, GHH, ROOF, cols, rows]) => {
    // A wall picture, stretched to the greenhouse's box: the generator's faint dust and its warm fringe round the white
    // wood go, and so do specks standing apart from the walls (as farmtech-import.js did for the v1 frame).
    const wall = async (src) => {
      const c = W.canvas(GW, GHH + ROOF), g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high';
      g.drawImage(await W.load(src), 0, 0, GW, GHH + ROOF);
      const w = c.width, h = c.height, im = g.getImageData(0, 0, w, h), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 24) d[i + 3] = 0;
        const warm = Math.max(d[i], d[i + 1]) - d[i + 2];
        if (d[i + 3] < 200 && warm > 70 && Math.max(d[i], d[i + 1]) > 150) d[i + 3] = 0;
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
      g.putImageData(im, 0, 0);
      return c;
    };
    // The beds: the floor with each bed's soil cut out. From each tile's middle, out to the bed's wooden board (orange,
    // bright) on each side; the soil inside, less 2 px, goes.
    const f = W.canvas(GW, GHH), fg = f.getContext('2d', { willReadFrequently: true });
    fg.drawImage(await W.load(floor), 0, 0, GW, GHH);
    const fim = fg.getImageData(0, 0, GW, GHH), fd = fim.data, T = GW / cols, holes = [];
    const wood = (x, y) => { const i = (y * GW + x) * 4; return fd[i] > 165 && fd[i + 1] > 95 && fd[i] - fd[i + 2] > 70; };
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const cx = Math.round((k + 0.5) * T), cy = Math.round((r + 0.5) * T);
      let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
      while (x0 > k * T + 4 && !wood(x0 - 1, cy)) x0--;
      while (x1 < (k + 1) * T - 4 && !wood(x1 + 1, cy)) x1++;
      while (y0 > r * T + 4 && !wood(cx, y0 - 1)) y0--;
      while (y1 < (r + 1) * T - 4 && !wood(cx, y1 + 1)) y1++;
      holes.push({ r, k, x0, x1, y0, y1 });
    }
    // the beds stand in straight rows and columns: each side is the middle value of its column or row (a highlight on
    // one board must not make one bed narrower)
    const mid = (a) => a.slice().sort((u, v) => u - v)[Math.floor(a.length / 2)];
    const colOf = (k, key) => mid(holes.filter((h) => h.k === k).map((h) => h[key])), rowOf = (r, key) => mid(holes.filter((h) => h.r === r).map((h) => h[key]));
    holes.forEach((h) => {
      const x0 = colOf(h.k, 'x0') + 2, x1 = colOf(h.k, 'x1') - 2, y0 = rowOf(h.r, 'y0') + 2, y1 = rowOf(h.r, 'y1') - 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fd[(y * GW + x) * 4 + 3] = 0;
      h.cut = [x0, y0, x1, y1];
    });
    fg.putImageData(fim, 0, 0);
    // the whole one: cut out, standing on the bottom of the same box, not stretched
    const x = W.cells(W.dehalo(W.cutout(await W.load(whole))), 1, 1, 0.02)[0], o = W.canvas(GW, GHH + ROOF);
    W.draw(o.getContext('2d'), x.c, x, Math.min(GW * 0.98 / x.w, (GHH + ROOF - 2) / x.h), GW / 2, GHH + ROOF - 1);
    return { back: W.out(await wall(back), 0.86), front: W.out(await wall(front), 0.86), beds: W.out(f, 0.86), whole: W.out(o, 0.84), holes };
  }, [data(path.join(ROOT, 'art-src', 'props', 'greenhouse_back.png')), data(path.join(ROOT, 'art-src', 'props', 'greenhouse_front.png')),
    data(path.join(ROOT, 'art-src', 'props', 'ws_greenhouse.png')), data(path.join(OUT, 'props', 'greenhouse_floor.png')), GW, GHH, ROOF,
    C.GREENHOUSE.w, C.GREENHOUSE.h]);
  save('props/greenhouse_back', gh.back);
  save('props/greenhouse_front', gh.front);
  save('props/greenhouse_beds', gh.beds);
  save('props/ws_greenhouse', gh.whole);
  console.log('bed holes (x0 y0 x1 y1):', JSON.stringify(gh.holes.map((h) => h.cut)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
