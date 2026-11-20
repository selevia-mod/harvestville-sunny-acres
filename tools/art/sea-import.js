'use strict';
// The owner's sea trips pictures (18 Nov 2026: art-src/SEA-TRIPS-PROMPTS.md, saved in art-src/sea/) into the game's sizes,
// for the 'sea' download pack (tools/packs.js; build.js keys assets/sea/<name> as 'sea/<name>'). The game draws stand-ins
// until each is on the phone (src/19zzz...z-sea.js). Each picture is cut out and fitted to the box the game shows it in,
// so nothing is stretched:
//   sea/boat_marisol_side   the boat at berth 1 (shown 4 tiles wide, its own shape)          640 wide
//   sea/boat_marisol_deck   the deck under the trip (shown 18.4 tiles wide, its own shape)   its own size, up to 2048 wide
//   sea/ground_sea_open     the water, seamless both ways (faded into itself near its edges)    512 x 512
//   sea/sea_skyline         the city far off (shown the map's width, its feet on the horizon)   1536 wide
//   sea/sea_spot            a fishing spot (shown 1.7 x 1.25 tiles)                            272 x 200
//   sea/sea_gull            a diving gull (shown 0.9 x 0.9 tiles)                              144 x 144
//   sea/sea_crate           the deck's crate (shown 1.1 x 1.1 tiles, its feet on the bottom)  176 x 176
//   sea/sea_marlin          the Marlin (the tour)                                              640 wide
//   sea/sea_fish_icons, sea/sea_items_icons   4 x 2 icons each, every icon taken by where it is drawn (one reaching into
//                           its neighbour's box stays its own) and laid out again in clean cells of 128   512 x 256
// node tools/art/sea-import.js   then node build.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'sea');
const OUT = path.join(ROOT, 'assets', 'sea');
const PPT = 160;

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const pic = (name) => { const f = path.join(SRC, name + '.png'); return fs.existsSync(f) ? data(f) : null; };
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/sea/' + name).padEnd(36), (r.w + 'x' + r.h).padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No art-src/sea/ yet: nothing to do (the game keeps its stand-ins).'); return; }
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  await p.evaluate(() => {
    W.box = (c) => {
      const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    W.clean = async (src) => W.dehalo(W.cutout(await W.load(src)));
    // its own shape at width ow (never wider than it is drawn, up to max)
    W.wide = async (src, ow, max) => {
      const c = await W.clean(src), bx = W.box(c), w = Math.min(ow || bx.w, max || 1e9), h = Math.round(bx.h * w / bx.w), o = W.canvas(w, h);
      W.draw(o.getContext('2d'), c, bx, w / bx.w, w / 2, h);
      return Object.assign(W.out(o, 0.85), { w, h });
    };
    // fitted inside a box (a margin of pad), in the middle, or its feet on the bottom
    W.fitIn = async (src, ow, oh, pad, feet) => {
      const c = await W.clean(src), bx = W.box(c), k = Math.min((ow - 2 * pad) / bx.w, (oh - 2 * pad) / bx.h), o = W.canvas(ow, oh);
      W.draw(o.getContext('2d'), c, bx, k, ow / 2, feet ? oh - pad : null, oh / 2);
      return Object.assign(W.out(o, 0.85), { w: ow, h: oh });
    };
  });
  const done = [];
  const one = async (name, fn, args) => { const s = pic(name); if (!s) return; save(name, await p.evaluate(fn, [s].concat(args))); done.push(name); };

  await one('boat_marisol_side', ([s, w]) => W.wide(s, w), [4 * PPT]);
  await one('boat_marisol_deck', ([s, m]) => W.wide(s, 0, m), [2048]);
  await one('sea_skyline', ([s, w]) => W.wide(s, w), [1536]);
  await one('sea_marlin', ([s, w]) => W.wide(s, w), [4 * PPT]);
  await one('sea_spot', ([s, w, h]) => W.fitIn(s, w, h, 4, false), [Math.round(1.7 * PPT), Math.round(1.25 * PPT)]);
  await one('sea_gull', ([s, w]) => W.fitIn(s, w, w, 4, false), [Math.round(0.9 * PPT)]);
  await one('sea_crate', ([s, w]) => W.fitIn(s, w, w, 2, true), [Math.round(1.1 * PPT)]);

  // the water: one 512 tile, seamless both ways: near its edges it fades into itself moved half a tile (whose middle is
  // there), so the wrap meets picture to picture. (Evening out the edge colours instead smeared the sparkles on the edge
  // into streaks down the water.)
  await one('ground_sea_open', async ([s, S]) => {
    const img = await W.load(s), c = W.canvas(S, S), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, S, S);
    const a = g.getImageData(0, 0, S, S).data, im = g.createImageData(S, S), d = im.data, H = S / 2, band = S / 4;
    const ramp = (t) => { const x = Math.min(1, t / band); return x * x * (3 - 2 * x); };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const m = ramp(Math.min(x, S - 1 - x)) * ramp(Math.min(y, S - 1 - y)), i = (y * S + x) * 4, j = (((y + H) % S) * S + (x + H) % S) * 4;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = a[i + ch] * m + a[j + ch] * (1 - m);
      d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.85), w: S, h: S };
  }, [512]);

  // the icons: 4 x 2, each by where it is drawn, in clean cells of 128
  for (const name of ['sea_fish_icons', 'sea_items_icons']) {
    await one(name, async ([s]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 4, 2, 0.02), o = W.canvas(4 * 128, 2 * 128), g = o.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const x = cl[i];
        if (!x) throw new Error('icon ' + (i + 1) + ' is missing');
        W.draw(g, x.c, x, Math.min(128 * 0.88 / x.w, 128 * 0.88 / x.h), (i % 4) * 128 + 64, null, Math.floor(i / 4) * 128 + 64);
      }
      return Object.assign(W.out(o, 0.85), { w: o.width, h: o.height });
    }, []);
  }

  await b.close();
  console.log(done.length ? 'Made: ' + done.join(', ') + '. Then: node build.js' : 'No sea pictures yet.');
})().catch((e) => { console.error(e); process.exit(1); });
