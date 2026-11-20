'use strict';
// The owner's vehicles, farm machines and deep-mine critters (18 Nov 2026, 30-degree camera, true side views:
// art-src/MANILA-VEHICLES-MACHINES-MINE-PROMPTS.md and art-src/VEHICLES-30DEG-REDO-PROMPTS.md; saved in art-src/vehicles/)
// into the game's sizes, for the 'vehicles' download pack (tools/packs.js). The game draws stand-ins until each is on the
// phone (src/19zzz...z-vehicle-art.js).
//   assets/veh_<cart|pickup|farmtruck|bigtruck>_<side|front|back>_<empty|full>.*  cut with ONE box per empty/full pair (so
//       loading never moves it), PPT px a tile across the game's width for that view (C.TRUCKS, the cart's VIEW)
//   assets/machine_<kind>.*   240 x 160 (the game shows it 1.5 x 1 tiles), feet on the bottom, facing right
//   assets/machine_icons.*    3 icons of 128 in C.MACHINE_KINDS' order
//   assets/machine_<kind>_<side|front|back>.*   driven (owner, 20 Nov 2026): its own shape at C.MACHINES.drive's width
//       in tiles (side: facing right; front: coming at you; back: going away), PPT px a tile, wheels on the bottom
//   assets/critter_<kind>.*   160 x 150 (the stand-in's canvas: the game's scale is def.w tiles for 160 px), feet at 95%
// node tools/art/vehicles-import.js   then node build.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'vehicles');
const OUT = path.join(ROOT, 'assets');
const PPT = 160;
// the width in tiles of each view (the stand-ins' own: src/*grand-market.js VIEW, src/00-*-trucks.js w / fw)
const WIDE = { cart: [2.3, 1.5, 1.5], pickup: [2.7, 1.6, 1.6], farmtruck: [3.3, 1.9, 1.9], bigtruck: [4.1, 2.2, 2.2] };
const VIEWS = ['side', 'front', 'back'];
// the driven machines' widths in tiles, [side, front and back] (src/00-*-machines.js C.MACHINES.drive)
const DRIVE = { tractor: [2.8, 2.2], seeder: [2.4, 1.9], harvester: [3.4, 3.0] };

const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const pic = (name) => { const f = path.join(SRC, name + '.png'); return fs.existsSync(f) ? data(f) : null; };
const put = (file, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, file), buf); return buf.length; };
const save = (name, r) => {
  put(name + '.png', r.png);
  const n = put(name + '.webp', r.webp);
  console.log(('assets/' + name).padEnd(40), (r.w + 'x' + r.h).padEnd(10), (n / 1024).toFixed(0) + ' KB webp');
};

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No art-src/vehicles/ yet: nothing to do (the game keeps its stand-ins).'); return; }
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  await p.evaluate(() => {
    // the box round everything solid (alpha 40 and up)
    W.box = (c) => {
      const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    W.clean = async (src) => W.dehalo(W.cutout(await W.load(src)));
  });
  const done = [];

  // ---------- the cart and the trucks: a pair at a time, one box for both ----------
  for (const v of Object.keys(WIDE)) {
    for (let vi = 0; vi < 3; vi++) {
      const view = VIEWS[vi], e = pic(v + '_' + view + '_empty'), f = pic(v + '_' + view + '_full');
      if (!e || !f) continue;
      const r = await p.evaluate(async ([e, f, ow]) => {
        const cs = [await W.clean(e), await W.clean(f)], bs = cs.map(W.box);
        if (!bs[0] || !bs[1]) throw new Error('an empty picture');
        const x0 = Math.min(bs[0].x, bs[1].x), y0 = Math.min(bs[0].y, bs[1].y);
        const bx = { x: x0, y: y0, w: Math.max(bs[0].x + bs[0].w, bs[1].x + bs[1].w) - x0, h: Math.max(bs[0].y + bs[0].h, bs[1].y + bs[1].h) - y0 };
        const k = ow / bx.w, oh = Math.round(bx.h * k);
        return cs.map((c) => { const o = W.canvas(ow, oh); W.draw(o.getContext('2d'), c, bx, k, ow / 2, oh); return Object.assign(W.out(o, 0.85), { w: ow, h: oh }); });
      }, [e, f, Math.round(WIDE[v][vi] * PPT)]);
      save('veh_' + v + '_' + view + '_empty', r[0]);
      save('veh_' + v + '_' + view + '_full', r[1]);
      done.push(v + ' ' + view);
    }
  }

  // ---------- the machines: 240 x 160, feet on the bottom, in the middle ----------
  for (const k of ['tractor', 'seeder', 'harvester']) {
    const s = pic('machine_' + k);
    if (!s) continue;
    save('machine_' + k, await p.evaluate(async ([s, W0, H0]) => {
      const c = await W.clean(s), bx = W.box(c), k = Math.min((W0 - 8) / bx.w, (H0 - 4) / bx.h), o = W.canvas(W0, H0);
      W.draw(o.getContext('2d'), c, bx, k, W0 / 2, H0 - 2);
      return Object.assign(W.out(o, 0.85), { w: W0, h: H0 });
    }, [s, 240, 160]));
    done.push('machine ' + k);
  }
  // ---------- the machines you drive: side, front, back at their own shape ----------
  for (const k of Object.keys(DRIVE)) {
    for (const view of VIEWS) {
      const s = pic(view === 'side' ? 'machine_' + k : 'machine_' + k + '_' + view);
      if (!s) continue;
      save('machine_' + k + '_' + view, await p.evaluate(async ([s, ow]) => {
        const c = await W.clean(s), bx = W.box(c), oh = Math.round(bx.h * ow / bx.w), o = W.canvas(ow, oh);
        W.draw(o.getContext('2d'), c, bx, ow / bx.w, ow / 2, oh);
        return Object.assign(W.out(o, 0.85), { w: ow, h: oh });
      }, [s, Math.round(DRIVE[k][view === 'side' ? 0 : 1] * PPT)]));
      done.push('machine ' + k + ' ' + view);
    }
  }
  const icons = ['tractor', 'seeder', 'harvester'].map((k) => pic('icon_' + k));
  if (icons.every(Boolean)) {
    save('machine_icons', await p.evaluate(async (list) => {
      const o = W.canvas(3 * 128, 128), g = o.getContext('2d');
      for (let i = 0; i < 3; i++) {
        const c = await W.clean(list[i]), bx = W.box(c);
        W.draw(g, c, bx, Math.min(128 * 0.88 / bx.w, 128 * 0.88 / bx.h), i * 128 + 64, null, 64);
      }
      return Object.assign(W.out(o, 0.85), { w: o.width, h: 128 });
    }, icons));
    done.push('machine icons');
  }

  // ---------- the critters: 160 x 150, feet at 95% ----------
  for (const k of ['mole', 'bat', 'piglet']) {
    const s = pic('critter_' + k);
    if (!s) continue;
    save('critter_' + k, await p.evaluate(async (s) => {
      const c = await W.clean(s), bx = W.box(c), k = Math.min(150 / bx.w, 138 / bx.h), o = W.canvas(160, 150);
      W.draw(o.getContext('2d'), c, bx, k, 80, 142);
      return Object.assign(W.out(o, 0.85), { w: 160, h: 150 });
    }, s));
    done.push('critter ' + k);
  }

  await b.close();
  console.log(done.length ? 'Made: ' + done.join(', ') + '. Then: node build.js' : 'No vehicle pictures yet.');
})().catch((e) => { console.error(e); process.exit(1); });
