'use strict';
// Willowbrook Station's pictures (4 Nov 2026; prompts in art-src/TOWN-PROMPTS.md, "Willowbrook Station art"), from
// art-src/station/*.png into the town's own sheets (128 px a tile, like the other buildings; all of them only in town,
// let go elsewhere by 19zzzz-perf.js):
//   assets/tw_station   the station, 5 x 4 tiles, standing on its bottom edge, STATION written on its blank sign
//   assets/tw_train     the whole train in one picture, 12 x 2 tiles: engine, two coaches, the van, one scale for all,
//                       wheels on the bottom edge (the game slides it in and out, 19zz-town.js)
//   assets/tw_rails     the track, 12 x 1 tiles: a piece of rails.png exactly 8 sleepers long, its two ends blended over
//                       a gravel gap so it repeats with no seam, laid end to end at full size and then made small
//   assets/tw_crates    3 frames of 128 x 128: the open crate, the full one (lid on, green tick), the empty pallet
//   assets/tw_people    the five visitors off the train, a row of 9 frames of 128 x 192 each (C.TW.visitors, then the
//                       Collector), cut like the villagers' sheet (tools/art/import.js: one scale for a person's 9 frames,
//                       feet on line 186), so they stand as tall as the villagers
// node tools/art/station-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'station');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const TW = ctx.window.Farm.Config.TW;
const PPT = 128;
const data = (f) => {
  const file = path.join(SRC, f);
  if (!fs.existsSync(file)) throw new Error('no ' + path.relative(ROOT, file) + ' yet');
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
};
const save = (name, r) => {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(('assets/' + name).padEnd(20), r.size, (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  await p.addScriptTag({ content: `
    // the box of a canvas's solid pixels
    window.box = (c) => {
      const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    window.clean = async (src) => W.dehalo(W.cutout(await W.load(src)));
    window.res = (c, q) => Object.assign(W.out(c, q || 0.8), { size: c.width + 'x' + c.height });
  ` });

  // (people: only the visitors' sheet, e.g. after their 30-degree pictures, 12 Nov 2026)
  if (!process.argv.includes('people')) {
  // ---------- the station ----------
  save('tw_station', await p.evaluate(async ([src, PPT]) => {
    const c = await clean(src), bx = box(c), w = 5 * PPT, h = 4 * PPT, o = W.canvas(w, h), g = o.getContext('2d');
    const k = Math.min(w * 0.98 / bx.w, h * 0.98 / bx.h), left = (w - bx.w * k) / 2, top = h - 1 - bx.h * k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, bx.x, bx.y, bx.w, bx.h, left, top, bx.w * k, bx.h * k);
    // the blank board over the door (about 455..815 x 505..590 in the 1280 x 1024 picture) gets the station's name
    const at = (x, y) => [left + (x - bx.x) * k, top + (y - bx.y) * k];
    const [sx, sy] = at(635, 548), size = Math.round(52 * k);
    g.font = 'bold ' + size + 'px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, size * 0.16);
    g.strokeStyle = '#2a170b';
    g.strokeText('STATION', sx, sy);
    g.fillStyle = '#ffe9a8';
    g.fillText('STATION', sx, sy);
    return res(o);
  }, [data('station.png'), PPT]));

  // ---------- the train: engine, coach, coach, van, each in its own 3 tiles, one scale for all ----------
  save('tw_train', await p.evaluate(async ([srcs, PPT]) => {
    const cars = [];
    for (const s of srcs) { const c = await clean(s); cars.push({ c, b: box(c) }); }
    const slot = 3 * PPT, h = 2 * PPT, o = W.canvas(4 * slot, h), g = o.getContext('2d');
    const k = Math.min(...cars.map((x) => Math.min(slot / x.b.w, (h - 2) / x.b.h)));
    g.imageSmoothingQuality = 'high';
    [0, 1, 1, 2].forEach((n, i) => {
      const x = cars[n];
      g.drawImage(x.c, x.b.x, x.b.y, x.b.w, x.b.h, i * slot + (slot - x.b.w * k) / 2, h - 1 - x.b.h * k, x.b.w * k, x.b.h * k);
    });
    return res(o);
  }, [[data('train_engine.png'), data('train_coach.png'), data('train_van.png')], PPT]));

  // ---------- the rails ----------
  // rails.png: the gravel bed fills rows ~118..398; sleepers every 103 px (the first at x 30), the gaps between them
  // gravel. The piece from x 72 is 8 sleepers (824 px) long; its first 50 px (a gap) are blended with the 50 px just past
  // its end (the same gap one piece on), so where one piece ends the next begins with the very same pixels.
  save('tw_rails', await p.evaluate(async ([src, PPT]) => {
    const im = await W.load(src), A = 72, P = 824, B = 50, Y0 = 112, H = 288;
    const s = W.canvas(im.width, im.height), sg = s.getContext('2d');
    sg.drawImage(im, 0, 0);
    const d = sg.getImageData(0, 0, im.width, im.height).data, tile = W.canvas(P, H), tg = tile.getContext('2d'), t = tg.createImageData(P, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < P; x++) {
      const i = ((Y0 + y) * im.width + A + x) * 4, j = ((Y0 + y) * im.width + A + P + x) * 4, o = (y * P + x) * 4, f = x < B ? x / B : 1;
      for (let c = 0; c < 4; c++) t.data[o + c] = x < B ? d[j + c] * (1 - f) + d[i + c] * f : d[i + c];
    }
    tg.putImageData(t, 0, 0);
    W.dehalo(tile);
    const k = PPT / H, long = W.canvas(Math.ceil(12 * PPT / k), H), lg = long.getContext('2d');
    for (let x = 0; x < long.width; x += P) lg.drawImage(tile, x, 0);
    const o = W.canvas(12 * PPT, PPT), g = o.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(long, 0, 0, long.width, H, 0, 0, 12 * PPT, PPT);
    return res(o);
  }, [data('rails.png'), PPT]));

  // ---------- the crates: one scale for the three, standing on line 124 ----------
  save('tw_crates', await p.evaluate(async (src) => {
    const cl = W.cells(await clean(src), 3, 1, 0.02);
    if (cl.some((x) => !x)) throw new Error('crates.png: a crate is missing');
    const o = W.canvas(8 * 2 + 3 * 128 + 2 * 16, 144), g = o.getContext('2d');
    const k = Math.min(...cl.map((x) => Math.min(128 * 0.92 / x.w, 124 * 0.95 / x.h)));
    cl.forEach((x, i) => W.draw(g, x.c, x, k, 8 + i * 144 + 64, 8 + 124));
    return res(o);
  }, data('crates.png')));

  }

  // ---------- the visitors: a row each, 9 frames (rows of the picture: down, up, left; columns: still, step, step) ----------
  const who = TW.visitors.concat([TW.collector]).map((v) => v.key);
  save('tw_people', await p.evaluate(async (srcs) => {
    const FW = 128, FH = 192, BASE = 186, o = W.canvas(8 * 2 + 9 * FW + 8 * 16, 8 * 2 + srcs.length * FH + (srcs.length - 1) * 16), g = o.getContext('2d');
    for (let r = 0; r < srcs.length; r++) {
      const cl = W.cells(await clean(srcs[r]), 3, 3, 0.02);
      if (cl.some((x) => !x)) throw new Error('visitor ' + (r + 1) + ': a frame is missing');
      const k = Math.min(...cl.map((x) => Math.min(FW * 0.94 / x.w, BASE * 0.96 / x.h)));
      cl.forEach((x, i) => {
        const fx = 8 + i * (FW + 16), fy = 8 + r * (FH + 16);
        g.save();
        g.beginPath(); g.rect(fx, fy, FW, FH); g.clip();
        W.draw(g, x.c, x, k, fx + FW / 2, fy + BASE);
        g.restore();
      });
    }
    return res(o, 0.6); // (the villagers' sheet's quality, tools/art/squeeze.js)
  }, who.map((k) => data(k + '.png'))));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
